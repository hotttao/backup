---
weight: 1
title: "langgraph api 流程总结"
date: 2025-08-08T13:00:00+08:00
lastmod: 2025-08-08T13:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langgraph api 流程总结"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---


本节我们总结回顾一下 Langgraph API 相关重要的流程，包括
1. StateGraph API 如何映射为 Pregel
2. Function API 如何映射为 Pregel

## 1. StateGraph API 如何映射为 Pregel
在之前的总结里，我们已经学习了 Pregel 执行的过程:

```bash
                      input
                        |
                        | 初始化
                        |
                  updated_channels
                              ^
                   /          \ \
             更新 /        触发 \ \ 生成
                 /              \ \
            channel --- 数据 ---> node
```

在 Pregel 的抽象里只包含 channel、node(PregelNode) 两个核心组件。

而在 StateGraph 里有如下抽象:
1. nodes: `dict[str, StateNodeSpec[Any, ContextT]]`
2. edges: `set[tuple[str, str]]`
3. branches: `defaultdict[str, dict[str, BranchSpec]]`

除了这些抽象，StateGraph 提供的另一个重要功能通过类型注解，声明:
1. node 包含的 channel、ManagedValue

我们需要关注的重点就是 nodes、edges、branches 如何映射为 channel、node

### 1.1 StateNodeSpec -> PregelNode
StateNodeSpec -> PregelNode 的映射位于 CompiledStateGraph.attach_node
1. 每个 node 都会单独定义一个 branch_channel，命名为 `branch:to:{node_key}`
2. node 会被自己的 branch_channel 触发

在 PregelNode 的初始化中:
1. channels: 是从 node 的 input_schema 中解析的 channel
2. mapper: 后续执行时，会将 input 绑定到 input_schema


```python
_CHANNEL_BRANCH_TO = "branch:to:{}"

branch_channel = _CHANNEL_BRANCH_TO.format(key)
# 1. 添加 channel
self.channels[branch_channel] = (
    LastValueAfterFinish(Any)
    if node.defer
    else EphemeralValue(Any, guard=False)
)
# 2. 添加 node
self.nodes[key] = PregelNode(
    triggers=[branch_channel],
    # read state keys and managed values
    channels=("__root__" if is_single_input else input_channels),
    # coerce state dict to schema class (eg. pydantic model)
    mapper=mapper,
    # publish to state keys
    writers=[ChannelWrite(write_entries)],
    metadata=node.metadata,
    retry_policy=node.retry_policy,
    cache_policy=node.cache_policy,
    bound=node.runnable,  # type: ignore[arg-type]
)
```

PregelNode writers 参数的初始化最为复杂:
1. StateGraph.add_node 添加节点时，会从输入函数的返回值解析出 node.ends，ChannelWriteEntry 会根据 node.ends 生成提示信息
2. PregelNode 会填两个 ChannelWriteEntry，ChannelWriteEntry 接收一个 mapper 函数，这个 mapper 函数接收的是 `bound_return=PregelNode.bound(input)` 执行结果
    - output_keys 是 StateGraph 中收集的所有 channel，`output_keys == ["__root__"]` 表示无法解析 input_schema
    - _get_updates 会从 bound_return 中过滤出所有在 output_keys 的返回值，输出为对 channel 的更改，对于嵌套结构会递归处理
    - _get_root 类似 _get_updates，但是因为 `output_keys == ["__root__"]` ，只有一个 channel 默认会把 bound_return 整体作为 `__root__` channel 的值，不回去判断 bound_return 内部是有 `__root__`
    - _control_branch 用于从 bond_return 中提取出 Send 和 Command.goto，生成节点跳转的任务
2. 总结一下 writers 完成以下两个任务:
    - 处理 channel 值设置
    - 处理跨节点跳转任务

```python
    def attach_node(self, key: str, node: StateNodeSpec[Any, ContextT] | None) -> None:
        write_entries: tuple[ChannelWriteEntry | ChannelWriteTupleEntry, ...] = (
            ChannelWriteTupleEntry(
                # 处理 channel 值设置任务
                # 输入没有注解，统一放到 __root__ 的默认channel 中
                mapper=_get_root if output_keys == ["__root__"] else _get_updates
            ),
            ChannelWriteTupleEntry(
                # 处理跨节点跳转任务
                mapper=_control_branch,
                static=(
                    _control_static(node.ends)
                    if node is not None and node.ends is not None
                    else None
                ),
            ),
        )
```

### 1.2 edges
edge 的处理比较简单，edge 会被翻译成节点的 writer:
1. 在 start.writers 添加对 end.branch_channel 的写入任务
2. 前面我们说过，每个节点都会添加一个 branch_channel，并被这个 branch_channel 触发

```python
    def attach_edge(self, starts: str | Sequence[str], end: str) -> None:
        if isinstance(starts, str):
            # subscribe to start channel
            if end != END:
                # edge 的含义表示，一个节点会触发另一节点的执行
                self.nodes[starts].writers.append(
                    ChannelWrite(
                        (ChannelWriteEntry(_CHANNEL_BRANCH_TO.format(end), None),)
                    )
                )
```

attach_edge 还需要处理一种特殊情况，多个 start 节点触发一个 end 任务。end 任务需要等所有 start 节点都更新后，才能被触发。处理方法是使用一个特殊的 channel。
1. 创建一个 NamedBarrierValue channel，end 节点被这个 channel 触发
2. 每个 start 节点添加对 NamedBarrierValue 更新的 writers。
3. 当 start 节点更新时，会触发 NamedBarrierValue 记录对 start 节点的可见
4. 当所有节点都可见时，NamedBarrierValue 就是 available 
5. apply_writes 会在 updated_channel 应用之后，在检查一下所有 channel 是否 available，这样就可以检测到可用的 NamedBarrierValue，并将其追加到 updated_channel，这样就可以触发 end 节点


```python
    def attach_edge(self, starts: str | Sequence[str], end: str) -> None:
        if isinstance(starts, str):
           pass
        elif end != END:
            channel_name = f"join:{'+'.join(starts)}:{end}"
            # register channel
            if self.builder.nodes[end].defer:
                # 只有所有 starts 都更新，才能从此 channel 获取到值
                self.channels[channel_name] = NamedBarrierValueAfterFinish(
                    str, set(starts)
                )
            else:
                self.channels[channel_name] = NamedBarrierValue(str, set(starts))
            # subscribe to channel
            # node 被合并channel 触发
            self.nodes[end].triggers.append(channel_name)
            # publish to channel
            for start in starts:
                # start 会触发合并 channel 对 start channel 的可见
                # 所有channel 都可见时，合并的 channel 可以获取到值，触发对 end 的更新
                self.nodes[start].writers.append(
                    ChannelWrite((ChannelWriteEntry(channel_name, start),))
                )

def apply_writes():
    # Channels that weren't updated in this step are notified of a new step
    if bump_step:
        for chan in channels:
            if channels[chan].is_available() and chan not in updated_channels:
                if channels[chan].update(EMPTY_SEQ) and next_version is not None:
                    checkpoint["channel_versions"][chan] = next_version
                    # unavailable channels can't trigger tasks, so don't add them
                    if channels[chan].is_available():
                        updated_channels.add(chan)
```

### 1.3 Branch
Branch 处理的是 condition_edge，接收一个处理函数 path，执行完之后输出要跳转的节点。condition_edge 只确定 start 节点，并且不能是多个 start 节点。

Branch 的处理比较复杂，我们先看 attach_branch 提供的两个函数
1. get_writes: 
    - 前面我们提到，每个 node 都有一个触发它的 branch_channel。所以对 node 的触发，必须格式化为 `_CHANNEL_BRANCH_TO`
    - get_writes 用于标准化 channel，并将对 channel 的写入转换为 ChannelWriteEntry
    - ChannelWriteEntry 默认的 value 是 PASSTHROUGH，get_writes 中设置成了 None
2. reader: 
    - path 的入参可能需要从多个 channel 读取值
    - 从哪些 channel 读取值，由 path 的 input_schema 定义
    - reader 用于实现从 channel 读取值，并生成 input_schema 的值
    - reader 调用 ChannelRead.do_read 内部，会从 `config[CONF][CONFIG_KEY_READ]` 获取一个 read 函数，这个 read 函数正是 `prepare_single_task` 在执行时配置的


```python
    def attach_branch(
        self, start: str, name: str, branch: BranchSpec, *, with_reader: bool = True
    ) -> None:
        def get_writes(
            packets: Sequence[str | Send], static: bool = False
        ) -> Sequence[ChannelWriteEntry | Send]:
            writes = [
                (
                    ChannelWriteEntry(
                        # 标准化channel，并设置 value=None
                        p if p == END else _CHANNEL_BRANCH_TO.format(p), None
                    )
                    if not isinstance(p, Send)
                    else p
                )
                for p in packets
                if (True if static else p != END)
            ]
            if not writes:
                return []
            return writes

        if with_reader:
            # get schema
            # branch.input_schema 是从 brach.path 推测的 schema
            schema = branch.input_schema or (
                self.builder.nodes[start].input_schema
                if start in self.builder.nodes # start 还能不在么？
                else self.builder.state_schema
            )
            # 读取数据的 channel
            channels = list(self.builder.schemas[schema])
            # get mapper
            if schema in self.schema_to_mapper:
                mapper = self.schema_to_mapper[schema]
            else:
                # 将输入与 schema 绑定
                mapper = _pick_mapper(channels, schema)
                self.schema_to_mapper[schema] = mapper
            # create reader
            reader: Callable[[RunnableConfig], Any] | None = partial(
                # read: READ_TYPE = config[CONF][CONFIG_KEY_READ] 读取函数
                ChannelRead.do_read,
                # 读取的 channel
                select=channels[0] if channels == ["__root__"] else channels,
                fresh=True,
                # coerce state dict to schema class (eg. pydantic model)
                mapper=mapper,
            )
        else:
            reader = None

        # attach branch publisher
        # 条件分支，表示为 start 节点，写入时，会根据 branch 的函数，动态输出 [(channel,value)]
        self.nodes[start].writers.append(branch.run(get_writes, reader))


class ChannelRead(RunnableCallable):
    @staticmethod
    def do_read(
        config: RunnableConfig,
        *,
        select: str | list[str],
        fresh: bool = False,
        mapper: Callable[[Any], Any] | None = None,
    ) -> Any:
        try:
            read: READ_TYPE = config[CONF][CONFIG_KEY_READ]
        except KeyError:
            raise RuntimeError(
                "Not configured with a read function"
                "Make sure to call in the context of a Pregel process"
            )
        if mapper:
            return mapper(read(select, fresh))
        else:
            return read(select, fresh)


def prepare_single_task():
            return PregelExecutableTask(
                patch_config(
                    
                    configurable={
                        CONFIG_KEY_SEND: writes.extend,
                        CONFIG_KEY_READ: partial(
                            local_read,
                            scratchpad,
                            channels,
                            managed,
                            PregelTaskWrites(task_path, name, writes, triggers),
                        ),
                        
                    },
                ),
            )
```

现在我们再来理解 `branch.run(get_writes, reader)`
1. branch 有三个参数
    - path: branch_func 路由函数
    - ends: 路由函数的输出，映射到哪个节点
    - input_schema: 路由函数的输入 schema
2. run 方法返回的是一个 RunnableCallable
    - 执行入口是 branch._route
    - writer=get_writes
    - reader=reader
    - writer、reader 都会作为 kwargs 最终传递给 branch._route
    - 可以忽略 `ChannelWrite.register_writer` 只是将返回的 Runnable 标识为一个 ChannelWrite，并添加 static
3. branch._route 
    - brach.run 的返回值 是添加到 `node.writers`，他会像 ChannelWrite 一样被调用，即 `invoke(input=bound_return)`
    - `value = reader(config)` 获取 path 函数需要读取的 channel 的值
    - `result = self.path.invoke(value, config)` 返回的路由到哪些 node，或者是 Send
4. branch._finish
    - writer=get_writes，`entries = writer(destinations, False)` 标准化 branch_channel，并将 str 的 branch_channel 转换为 ChannelWriteEntry
    - `if need_passthrough: return ChannelWrite(entries)`: 暂时不知道这个分支何时被调用。
    - `ChannelWrite.do_write(config, entries)`: get_writes 中将 value 设置成了 None，所以会直接调用这个分支，生成对 branch_channel 的写入

```python
class BranchSpec(NamedTuple):
    path: Runnable[Any, Hashable | list[Hashable]]
    ends: dict[Hashable, str] | None
    input_schema: type[Any] | None = None


    def run(
        self,
        writer: _Writer,
        reader: Callable[[RunnableConfig], Any] | None = None,
    ) -> RunnableCallable:
        return ChannelWrite.register_writer(
            RunnableCallable(
                func=self._route,
                afunc=self._aroute,
                writer=writer,
                reader=reader,
                name=None,
                trace=False,
            ),
            list(
                zip_longest(
                    writer([e for e in self.ends.values()], True),
                    [str(la) for la, e in self.ends.items()],
                )
            )
            if self.ends
            else None,
        )


    def _route(
        self,
        input: Any,
        config: RunnableConfig,
        *,
        reader: Callable[[RunnableConfig], Any] | None,
        writer: _Writer,
    ) -> Runnable:
        if reader:
            value = reader(config)
            # passthrough additional keys from node to branch
            # only doable when using dict states
            if (
                isinstance(value, dict)
                and isinstance(input, dict)
                # 如果 input_schema 不是 None，input 返回的对 channel 的修改，应该就已经在 value 中了
                and self.input_schema is None
            ):
                value = {**input, **value}
        else:
            value = input
        result = self.path.invoke(value, config)
        return self._finish(writer, input, result, config)


    def _finish(
        self,
        writer: _Writer,
        input: Any,
        result: Any,
        config: RunnableConfig,
    ) -> Runnable | Any:
        if not isinstance(result, (list, tuple)):
            result = [result]
        if self.ends:
            # 过滤 ends，所以 branch 中的 ends 是强限制
            destinations: Sequence[Send | str] = [
                r if isinstance(r, Send) else self.ends[r] for r in result
            ]
        else:
            destinations = cast(Sequence[Union[Send, str]], result)
        if any(dest is None or dest == START for dest in destinations):
            raise ValueError("Branch did not return a valid destination")
        if any(p.node == END for p in destinations if isinstance(p, Send)):
            raise InvalidUpdateError("Cannot send a packet to the END node")
        entries = writer(destinations, False)
        if not entries:
            return input
        else:
            need_passthrough = False
            for e in entries:
                if isinstance(e, ChannelWriteEntry):
                    if e.value is PASSTHROUGH:
                        need_passthrough = True
                        break
            if need_passthrough:
                return ChannelWrite(entries)
            else:
                ChannelWrite.do_write(config, entries)
                return input
```