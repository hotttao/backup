---
weight: 1
title: "pregel 重要流程总结"
date: 2025-08-06T12:00:00+08:00
lastmod: 2025-08-06T12:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "pregel 重要流程总结"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---


本节我们总结回顾一下 Pregel 重要流程，包括
1. PregelLoop 的更新循环
2. PregelLoop 的崩溃恢复
3. 中断执行流程，包括父图发生中断、子图发生中断

<!-- 2. 图中函数参数如何传递 -->

## 1. PregelLoop 的更新循环
### 1.1 任务生成
prepare_next_tasks 会生成两种类型的 task:
- PUSH: 是直接触发 Node 执行，并传入自定义参数
- PULL: 是让 Node 发起检查，自己是否被触发，参数从 Node 监听的 channel 中读入

最终生成的任务包含如下信息:

```python
return PregelExecutableTask(
    packet.node, # 节点名称
    packet.arg,  # 传递给节点执行器的参数
    proc_node,   # proc.node 节点执行器 
    writes,      # dequeue
    ...
    # proc 是 pregelNode
    writers=proc.flat_writers, # 节点的写入通道，[ChannelWrite(self._writes)]
    subgraphs=proc.subgraphs,  # 节点包含的子图

)
```

PregelExecutableTask 初始化是用到了很多 PregelNode 的属性。下面是节点初始化相关的代码，可以看到
1. `writers=[ChannelWrite(self._writes)]`，flat_writers 只是对 writer 里的 ChannelWrite 进行了合并
2. `proc_node=RunnableSeq(self.bound, *writers)`

```python
node2 = (
    NodeBuilder().subscribe_to("b")
    .do(lambda x: x["b"] + x["b"])
    .write_to("c")
)
# write_to 用户设置节点要写入的通道，flat_writers 用于合并 ChannelWrite
class NodeBuilder:
    def write_to(
        self,
        *channels: str | ChannelWriteEntry,
        **kwargs: _WriteValue,
    ) -> Self:

        self._writes.extend(
            ChannelWriteEntry(c) if isinstance(c, str) else c for c in channels
        )
        self._writes.extend(
            ChannelWriteEntry(k, mapper=v)
            if callable(v)
            else ChannelWriteEntry(k, value=v)
            for k, v in kwargs.items()
        )

        return self

    def subscribe_to(
        self,
        *channels: str,
        read: bool = True,
    ) -> Self:
        if isinstance(self._channels, str):
            raise ValueError(
                "Cannot subscribe to channels when subscribed to a single channel"
            )
        if read:
            if not self._channels:
                self._channels = list(channels)
            else:
                # 从哪些 channel 读
                self._channels.extend(channels)

        # 被哪些 channel 触发
        if isinstance(channels, str):
            self._triggers.append(channels)
        else:
            self._triggers.extend(channels)

        return self

    def build(self) -> PregelNode:
        """Builds the node."""
        return PregelNode(
            channels=self._channels,
            triggers=self._triggers,
            tags=self._tags,
            metadata=self._metadata,
            writers=[ChannelWrite(self._writes)],
            bound=self._bound,
            retry_policy=self._retry_policy,
            cache_policy=self._cache_policy,
        )

class PregelNode:
    @cached_property
    def node(self) -> Runnable[Any, Any] | None:
        """Get a runnable that combines `bound` and `writers`."""
        writers = self.flat_writers
        if self.bound is DEFAULT_BOUND and not writers:
            return None
        elif self.bound is DEFAULT_BOUND and len(writers) == 1:
            return writers[0]
        elif self.bound is DEFAULT_BOUND:
            return RunnableSeq(*writers)
        # 初始化时有 bound，也有 writers 所以走的是这个分支
        elif writers:
            return RunnableSeq(self.bound, *writers)
        else:
            return self.bound
```

### 1.2 任务执行循环
任务执行位于 pregel.stream 方法内，整个调用链如下:
1. stream 内创建 `stream = SyncQueue()`
2. `with PregelLoop(input=input, stream=stream.put)`:
    - PregelLoop 初始化，接受 `input` 和 `stream.put`
    - with 调用 `PregelLoop.__enter__` 方法
    - `__enter__` 最后会执行 `self.updated_channels = self._first(input_keys=self.input_keys)`
    - 正常流程下 `_first` 会根据 `input` 生成 updated_channels，即哪些 channel 被更新
3. `loop.tick()`:
    - 调用 `prepare_next_tasks(self.updated_channels)` 生成 task
4. `runner.tick(tasks)`:
    - 调用 run_with_retry(task)
        - `task.writes.clear()`
        - `return task.proc.invoke(task.input, config)`
        - 如前所述 `task.proc` 保存的是 PregelNode.node 属性的返回值，`RunnableSeq(self.bound, *writers)`, writers 对应为 ChannelWrite
        - RunnableSeq.invoke 执行时，会先调用 bound 的 invoke 方法，然后调用 ChannelWrite.invoke 方法
        - ChannelWrite.invoke 调用时会从 `config[CONF][CONFIG_KEY_SEND]` 获取 write 函数，并调用 `write(Sequence[tuple[str, Any]]])`
        - `config[CONF][CONFIG_KEY_SEND]` 是在 `PregelExecutableTask` 初始化时配置的，并在 `run_with_retry` 中对 config 做了合并，最终 `write=task.writes.extend`
        - 所以最终的结果是 `task.proc.invoke(task.input, config)` 将 `[(channel, value)]` 写入到 task.writes 的队列中
    - 调用 `self.commit(task, None)`
        - 调用 `self.put_writes()(task.id, task.writes)`, 而 `self.put_writes()=loop.put_writes`这是在 runner 初始化时传入的
        - `loop.put_writes` 会将 `task.writes` 写入到 `loop.checkpoint_pending_writes` 中，并把 task.writes 保存到 checkpoint db 中。
        - 除了持久化 task.writes，在 loop.put_writes 还有如下调用链:
            - `loop.output_writes`
            - `loop._emit`
            - `self.stream(writes_message)`: self.stream 就是步骤 2 中的 stream.put
    - 最终的结果就是 runner.tick 会把 task 执行的结果(做了格式转换)放到 SyncQueue 中 
5. `yield from _output(stream.get)`: 从 stream 读取计算结果返回出去
6. `loop.after_tick()`:
    - `self.updated_channels=apply_writes(tasks)` 执行 apply_writes
    - apply_writes 会拿到 task.writes 中对 channel 的更新，然后执行对 channel 的更新
    - 返回 updated_channels
    - after_tick 还会检查 update_channels 与 output_channels(pregel 初始化时定义的要从哪些 channel 获取结果) 是否有交集
    - 存在交集，通过 `self.stream` 写入结果
7. 如果 `self.updated_channels` 不为空，回到第三步，否则退出循环
8. 再次执行第 5 步，输出 output_channels 需要的结果

至此我们可以得到一个结论: `updated_channels` 是驱动 graph 向前执行的"源"。

## 2. Pregel 的崩溃恢复

### 2.1 Pregel 初始化
我们先回到最开始 Pregel 的使用示例上:

```python
from langgraph.channels import LastValue, EphemeralValue, Topic
from langgraph.pregel import Pregel, NodeBuilder

node1 = (
    NodeBuilder().subscribe_only("a")
    .do(lambda x: x + x)
    .write_to("b")
)

node2 = (
    NodeBuilder().subscribe_to("b")
    .do(lambda x: x["b"] + x["b"])
    .write_to("c")
)


app = Pregel(
    nodes={"node1": node1, "node2": node2},
    channels={
        "a": EphemeralValue(str),
        "b": LastValue(str),
        "c": EphemeralValue(str),
    },
    input_channels=["a"],
    output_channels=["b", "c"],
)

print(app.invoke({"a": "foo"}))
```

从示例我们可以看到 Pregel 最核心的两个部分: 
1. nodes
2. channels

node 的定义内包含了如下信息:
1. 从哪些 channel 读
2. 被哪些 channel 触发
2. 更新哪些 channel

所以 Pregel 初始化时会得到如下状态信息:
1. `nodes: dict[str, PregelNode]`
2. `channels: dict[str, BaseChannel]`
3. `trigger_to_nodes: Mapping[str, Sequence[str]]`: channel 到 node 的触发关系、


### 2.2 Pregel 运行时
从 PregelLoop 的更新循环我们得出了结论: `updated_channels` 是驱动 graph 向前执行的"源"。

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

而整个 graph 的状态就保存在 `channels`，`node`, `updated_channels` 中。

### 2.3 checkpoint 保存的内容
为了验证上面得到的结论，我们来看每次 checkpoint 都保存了哪些内容。BaseCheckpointSaver.get_tuple 返回的是 CheckpointTuple

CheckpointTuple 保存了:
1. Checkpoint:
    2. `channel_versions: ChannelVersions`: 
        - eg: `{"c1": "version1", "c2": "version2"}`
        - 含义: channel 到其最新版本的映射
    1. `channel_values: dict[str, Any]`: 
        - eg: `{"c1": "v1", "c2": "v2"}`
        - 含义: channel 到其最新值的映射    
    3. `versions_seen: dict[str, ChannelVersions]`: 
        - eg: `{"node": {"c1": "version1", "c2": "version2"}}`
        - 含义: node 能看到的每个 channel 的版本
2. `pending_writes: list[PendingWrite]`:
    - 保存的是 task.writes 即 task 执行完成后生成的对 `[(channel, value)]`
    - updated_channel 就是基于 task.writes 生成的


```python
class CheckpointTuple(NamedTuple):
    """A tuple containing a checkpoint and its associated data."""

    config: RunnableConfig
    checkpoint: Checkpoint
    metadata: CheckpointMetadata
    parent_config: RunnableConfig | None = None
    pending_writes: list[PendingWrite] | None = None


class Checkpoint(TypedDict):
    """State snapshot at a given point in time."""

    v: int
    """The version of the checkpoint format. Currently 1."""
    id: str
    """The ID of the checkpoint. This is both unique and monotonically
    increasing, so can be used for sorting checkpoints from first to last."""
    ts: str
    """The timestamp of the checkpoint in ISO 8601 format."""
    channel_values: dict[str, Any]
    """The values of the channels at the time of the checkpoint.
    Mapping from channel name to deserialized channel snapshot value.
    """
    channel_versions: ChannelVersions
    """The versions of the channels at the time of the checkpoint.
    The keys are channel names and the values are monotonically increasing
    version strings for each channel.
    """
    versions_seen: dict[str, ChannelVersions]
    """Map from node ID to map from channel name to version seen.
    This keeps track of the versions of the channels that each node has seen.
    Used to determine which nodes to execute next.
    """

class InMemorySaver():
    def get_tuple(self, config: RunnableConfig) -> CheckpointTuple | None:
        
        thread_id: str = config["configurable"]["thread_id"]
        checkpoint_ns: str = config["configurable"].get("checkpoint_ns", "")
        if checkpoint_id := get_checkpoint_id(config):
            if saved := self.storage[thread_id][checkpoint_ns].get(checkpoint_id):
                
                checkpoint, metadata, parent_checkpoint_id = saved
                writes = self.writes[(thread_id, checkpoint_ns, checkpoint_id)].values()
                checkpoint_: Checkpoint = self.serde.loads_typed(checkpoint)
                return CheckpointTuple(
                    config=config,
                    checkpoint={
                        **checkpoint_,
                        "channel_values": self._load_blobs(
                            # 从 channel_versions load channel_values
                            thread_id, checkpoint_ns, checkpoint_["channel_versions"]
                        ),
                    },
                    metadata=self.serde.loads_typed(metadata),
                    pending_writes=[
                        (id, c, self.serde.loads_typed(v)) for id, c, v, _ in writes
                    ],
                    parent_config=(
                        {
                            "configurable": {
                                "thread_id": thread_id,
                                "checkpoint_ns": checkpoint_ns,
                                "checkpoint_id": parent_checkpoint_id,
                            }
                        }
                        if parent_checkpoint_id
                        else None
                    ),
                )


    def put(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions, # 只有发生更新的才有 new_version
    ) -> RunnableConfig:
        c = checkpoint.copy()
        thread_id = config["configurable"]["thread_id"]
        checkpoint_ns = config["configurable"]["checkpoint_ns"]
        values: dict[str, Any] = c.pop("channel_values")  # type: ignore[misc]
        for k, v in new_versions.items():
            self.blobs[(thread_id, checkpoint_ns, k, v)] = (
                self.serde.dumps_typed(values[k]) if k in values else ("empty", b"")
            )
        self.storage[thread_id][checkpoint_ns].update(
            {
                checkpoint["id"]: (
                    self.serde.dumps_typed(c),
                    self.serde.dumps_typed(get_checkpoint_metadata(config, metadata)),
                    config["configurable"].get("checkpoint_id"),  # parent
                )
            }
        )
        return {
            "configurable": {
                "thread_id": thread_id,
                "checkpoint_ns": checkpoint_ns,
                "checkpoint_id": checkpoint["id"],
            }
        }
```

### 2.4 checkpoint 的保存逻辑

checkpoint 的保存过程定义在 Loop._put_checkpoint 方法中。核心逻辑有如下几步:
1. create_checkpoint:
    - 生成一个新的 checkpoint_id
    - 从 loop.channels 中读取 channels 的值
    - 基于 loop.checkpoint 生成新的 checkpoint
    - loop.checkpoint 在 put 之后会当做缓存，用于更新
2. get_new_channel_versions:
    - 基于previous_versions, channel_versions 计算 channel 的增量更新
3. 调用 BaseCheckpointSaver.put 保存 checkpoint


```python
    def _put_checkpoint(self, metadata: CheckpointMetadata) -> None:
        # assign step and parents
        exiting = metadata is self.checkpoint_metadata
        if exiting and self.checkpoint["id"] == self.checkpoint_id_saved:
            # checkpoint already saved
            return
        if not exiting:
            metadata["step"] = self.step
            metadata["parents"] = self.config[CONF].get(CONFIG_KEY_CHECKPOINT_MAP, {})
            self.checkpoint_metadata = metadata
        # do checkpoint?
        do_checkpoint = self._checkpointer_put_after_previous is not None and (
            exiting or self.durability != "exit"
        )
        # create new checkpoint
        self.checkpoint = create_checkpoint(
            self.checkpoint,
            self.channels if do_checkpoint else None,
            self.step,
            id=self.checkpoint["id"] if exiting else None,
        )
        # bail if no checkpointer
        if do_checkpoint and self._checkpointer_put_after_previous is not None:
            self.prev_checkpoint_config = (
                self.checkpoint_config
                if CONFIG_KEY_CHECKPOINT_ID in self.checkpoint_config[CONF]
                and self.checkpoint_config[CONF][CONFIG_KEY_CHECKPOINT_ID]
                else None
            )
            self.checkpoint_config = {
                **self.checkpoint_config,
                CONF: {
                    **self.checkpoint_config[CONF],
                    CONFIG_KEY_CHECKPOINT_NS: self.config[CONF].get(
                        CONFIG_KEY_CHECKPOINT_NS, ""
                    ),
                },
            }

            channel_versions = self.checkpoint["channel_versions"].copy()
            new_versions = get_new_channel_versions(
                self.checkpoint_previous_versions, channel_versions
            )
            self.checkpoint_previous_versions = channel_versions

            # save it, without blocking
            # if there's a previous checkpoint save in progress, wait for it
            # ensuring checkpointers receive checkpoints in order
            self._put_checkpoint_fut = self.submit(
                self._checkpointer_put_after_previous,
                getattr(self, "_put_checkpoint_fut", None),
                self.checkpoint_config,
                copy_checkpoint(self.checkpoint),
                self.checkpoint_metadata,
                new_versions,
            )
            self.checkpoint_config = {
                **self.checkpoint_config,
                CONF: {
                    **self.checkpoint_config[CONF],
                    CONFIG_KEY_CHECKPOINT_ID: self.checkpoint["id"],
                },
            }
        if not exiting:
            # increment step
            self.step += 1


def create_checkpoint(
    checkpoint: Checkpoint,
    channels: Mapping[str, BaseChannel] | None,
    step: int,
    *,
    id: str | None = None,
) -> Checkpoint:
    """Create a checkpoint for the given channels."""
    ts = datetime.now(timezone.utc).isoformat()
    if channels is None:
        values = checkpoint["channel_values"]
    else:
        # 从 channels 中读取 values
        values = {}
        for k in channels:
            if k not in checkpoint["channel_versions"]:
                continue
            v = channels[k].checkpoint()
            if v is not MISSING:
                values[k] = v
    return Checkpoint(
        v=LATEST_VERSION,
        ts=ts,
        id=id or str(uuid6(clock_seq=step)),
        channel_values=values,
        channel_versions=checkpoint["channel_versions"],
        versions_seen=checkpoint["versions_seen"],
    )
```


### 2.4 checkpoint 的保存过程
#### 初始化
第一次执行时，`Loop.__enter__` 内会调用 `Loop._first`，这个方法内会调用
1. apply_writes
    1. 接收 empty_checkpoint
    2. 更新 `checkpoint["versions_seen"]`，初始化时，因为 `checkpoint["channel_versions"]` 为空，所以不会更新
    2. 从 BaseCheckpointSaver 获取下一个版本号 v1
    3. 假设 input 里面包含的 channel 简称为 input_channels
    4. 更新这些channel `channels[chan].update(vals)`
    5. 更新这些 channel 的版本号 `checkpoint["channel_versions"][chan] = v1`
    4. input 输入的 channel，会被收集在 updated_channel 并返回
2. `Loop._put_checkpoint({"source": "input"})`
    1. 把 loop.checkpoint 保存到 BaseCheckpointSaver 中，checkpoint_id 为 ck_v1
    2. ck_v1 checkpoint 中保存了 input_channels 的值和其版本号 v1


```python
    def __enter__(self) -> Self:
        if self.checkpointer:
            saved = self.checkpointer.get_tuple(self.checkpoint_config)
        else:
            saved = None
        if saved is None:
            saved = CheckpointTuple(
                self.checkpoint_config, empty_checkpoint(), {"step": -2}, None, []
            )
        self.checkpoint = saved.checkpoint
        self.updated_channels = self._first(input_keys=self.input_keys)

    def _first(self, *, input_keys: str | Sequence[str]) -> set[str] | None:
        elif input_writes := deque(map_input(input_keys, self.input)):
            updated_channels = apply_writes(
                self.checkpoint,
                self.channels,
                [
                    *discard_tasks.values(),
                    PregelTaskWrites((), INPUT, input_writes, []),
                ],
                self.checkpointer_get_next_version,
                self.trigger_to_nodes,
            )
            # save input checkpoint
            self._put_checkpoint({"source": "input"})
```

#### 第一轮 step
第一轮 step 执行时:
1. 随着 runner.tick() 的执行，会保存 task.writes 到 checkpoint(ck_v1) pending_writes
2. 执行完成后会调用 after_tick，其会再次执行:
    - apply_writes: 
        - 这个时候 `checkpoint["versions_seen"]` 就会依据 task.triggers 更新为 v1
        - 申请 v2 版本号
        - 将 task.triggers 和被更新的 channel 的 version 设置为 v2
    - `self._put_checkpoint({"source": "loop"})`
        1. 把 loop.checkpoint 保存到 BaseCheckpointSaver 中，checkpoint_id 为 ck_v2

3. 进入下一个循环

```python
    def after_tick(self) -> None:
        # finish superstep
        writes = [w for t in self.tasks.values() for w in t.writes]
        # all tasks have finished
        self.updated_channels = apply_writes(
            self.checkpoint,
            self.channels,
            self.tasks.values(),
            self.checkpointer_get_next_version,
            self.trigger_to_nodes,
        )
        # save checkpoint
        self._put_checkpoint({"source": "loop"})
```

#### 发生错误恢复
假设在第二轮 step 中发生了错误，并使用 ck_v2 进行恢复。注意因为 step 执行了一部分，所以 checkpoint(ck_v2) pending_writes 已经保存了部分 task.writes。下面我们来分析一下恢复过程。

1. 初始化 Loop 时，会从 BaseCheckpointSaver 中获取 ck_v2 checkpoint，然后会调用 `Loop._first` 方法。
2. `Loop._first` 方法 resume 的相关逻辑，接下来就直接进入到 tick 方法，调用 `prepare_next_tasks`
3. prepare_next_tasks:
    - 判断 updated_channels 为空并且 `checkpoint["channel_versions"]` 有值，就会假设所有 node 都被触发
    - prepare_single_task 内会对 node 是否被触发做一个判断 `_triggers`
    - `_triggers` 判断的逻辑是`触发这个 node 执行的 channel 的最大版本` 是否大于 `这个 node 能看到 channel 版本`
    - 这个逻辑正好符合我们在 apply_write 的对 trigger node 的更新逻辑。trigger node 的可见版本是上一个版本，最新版本是新生成的版本

由此可见 pending_writes 是否完整不影响错误恢复。

```python
    def __enter__(self) -> Self:
        if self.checkpointer:
            saved = self.checkpointer.get_tuple(self.checkpoint_config)
        self.prev_checkpoint_config = saved.parent_config
        self.checkpoint_id_saved = saved.checkpoint["id"]
        self.checkpoint = saved.checkpoint
        self.checkpoint_metadata = saved.metadata
        # 
        self.checkpoint_pending_writes = (
            [(str(tid), k, v) for tid, k, v in saved.pending_writes]
            if saved.pending_writes is not None
            else []
        )
        self.updated_channels = self._first(input_keys=self.input_keys)


def prepare_next_tasks():
    if updated_channels and trigger_to_nodes:
        triggered_nodes: set[str] = set()
        # Get all nodes that have triggers associated with an updated channel
        for channel in updated_channels:
            if node_ids := trigger_to_nodes.get(channel):
                triggered_nodes.update(node_ids)
        # Sort the nodes to ensure deterministic order
        candidate_nodes: Iterable[str] = sorted(triggered_nodes)
    elif not checkpoint["channel_versions"]:
        candidate_nodes = ()
    else:
        candidate_nodes = processes.keys()

def prepare_single_task():
    elif task_path[0] == PULL:
        if _triggers(
            channels,
            checkpoint["channel_versions"],
            checkpoint["versions_seen"].get(name),
            checkpoint_null_version,
            proc,
        ):

def _triggers(
    channels: Mapping[str, BaseChannel],
    versions: ChannelVersions,
    seen: ChannelVersions | None,
    null_version: V,
    proc: PregelNode,
) -> bool:
    if seen is None:
        for chan in proc.triggers:
            if channels[chan].is_available():
                return True
    else:
        for chan in proc.triggers:
            if channels[chan].is_available() and versions.get(  # type: ignore[operator]
                chan, null_version
            ) > seen.get(chan, null_version):
                return True
    return False
```

pregel 还有个避免 task 重复执行的逻辑

```python
class Pregel:
    def stream():
                while loop.tick():
                    # 从 cache 中恢复 task.writes
                    for task in loop.match_cached_writes():
                        loop.output_writes(task.id, task.writes, cached=True)
                    for _ in runner.tick(
                        # 跳过有 writes 的 task
                        [t for t in loop.tasks.values() if not t.writes],
                        timeout=self.step_timeout,
                        get_waiter=get_waiter,
                        schedule_task=loop.accept_push,
                    ):
```