---
weight: 1
title: "pregel - 2"
date: 2025-08-01T12:00:00+08:00
lastmod: 2025-08-01T12:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "pregel - 2"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---


## 1. Pregel 的方法
前面我们总结过 Pregel 有如下方法。

| 方法名 | 输入类型 | 输出类型 | 作用 |
|--------|----------|----------|------|
| `__init__` | `nodes`, `channels`, `input_channels`, `output_channels` 等 | `None` | 初始化 Pregel 实例，设置节点、通道、输入输出等配置 |
| `get_graph` | `config: RunnableConfig \| None`, `xray: int \| bool = False` | `Graph` | 返回计算图的可绘制表示 |
| `aget_graph` | `config: RunnableConfig \| None`, `xray: int \| bool = False` | `Graph` | 异步返回计算图的可绘制表示 |
| `_repr_mimebundle_` | `**kwargs: Any` | `dict[str, Any]` | Jupyter 显示图形用的 MIME 包 |
| `copy` | `update: dict[str, Any] \| None = None` | `Self` | 创建 Pregel 对象的副本 |
| `with_config` | `config: RunnableConfig \| None = None`, `**kwargs: Any` | `Self` | 使用更新配置创建 Pregel 副本 |
| `validate` | 无参数 | `Self` | 验证图形配置的有效性 |
| `config_schema` | `include: Sequence[str] \| None = None` | `type[BaseModel]` | 获取配置模式（已弃用） |
| `get_config_jsonschema` | `include: Sequence[str] \| None = None` | `dict[str, Any]` | 获取配置 JSON 模式（已弃用） |
| `get_context_jsonschema` | 无参数 | `dict[str, Any] \| None` | 获取上下文 JSON 模式 |
| `get_input_schema` | `config: RunnableConfig \| None = None` | `type[BaseModel]` | 获取输入模式 |
| `get_input_jsonschema` | `config: RunnableConfig \| None = None` | `dict[str, Any]` | 获取输入 JSON 模式 |
| `get_output_schema` | `config: RunnableConfig \| None = None` | `type[BaseModel]` | 获取输出模式 |
| `get_output_jsonschema` | `config: RunnableConfig \| None = None` | `dict[str, Any]` | 获取输出 JSON 模式 |
| `get_subgraphs` | `namespace: str \| None = None`, `recurse: bool = False` | `Iterator[tuple[str, PregelProtocol]]` | 获取图的子图 |
| `aget_subgraphs` | `namespace: str \| None = None`, `recurse: bool = False` | `AsyncIterator[tuple[str, PregelProtocol]]` | 异步获取图的子图 |
| `get_state` | `config: RunnableConfig`, `subgraphs: bool = False` | `StateSnapshot` | 获取图的当前状态 |
| `aget_state` | `config: RunnableConfig`, `subgraphs: bool = False` | `StateSnapshot` | 异步获取图的当前状态 |
| `get_state_history` | `config: RunnableConfig`, `filter`, `before`, `limit` | `Iterator[StateSnapshot]` | 获取图状态历史 |
| `aget_state_history` | `config: RunnableConfig`, `filter`, `before`, `limit` | `AsyncIterator[StateSnapshot]` | 异步获取图状态历史 |
| `bulk_update_state` | `config: RunnableConfig`, `supersteps: Sequence[Sequence[StateUpdate]]` | `RunnableConfig` | 批量更新图状态 |
| `abulk_update_state` | `config: RunnableConfig`, `supersteps: Sequence[Sequence[StateUpdate]]` | `RunnableConfig` | 异步批量更新图状态 |
| `update_state` | `config: RunnableConfig`, `values`, `as_node`, `task_id` | `RunnableConfig` | 更新图状态 |
| `aupdate_state` | `config: RunnableConfig`, `values`, `as_node`, `task_id` | `RunnableConfig` | 异步更新图状态 |
| `stream` | `input`, `config`, `context`, `stream_mode` 等 | `Iterator[dict[str, Any] \| Any]` | 流式执行图并返回步骤输出 |
| `astream` | `input`, `config`, `context`, `stream_mode` 等 | `AsyncIterator[dict[str, Any] \| Any]` | 异步流式执行图并返回步骤输出 |
| `invoke` | `input`, `config`, `context`, `stream_mode` 等 | `dict[str, Any] \| Any` | 同步执行图并返回最终结果 |
| `ainvoke` | `input`, `config`, `context`, `stream_mode` 等 | `dict[str, Any] \| Any` | 异步执行图并返回最终结果 |
| `clear_cache` | `nodes: Sequence[str] \| None = None` | `None` | 清除指定节点的缓存 |
| `aclear_cache` | `nodes: Sequence[str] \| None = None` | `None` | 异步清除指定节点的缓存 |

主要功能分类:

1. **图形管理**: `get_graph`, `aget_graph`, `validate`, `copy`, `with_config`
2. **模式获取**: `get_input_schema`, `get_output_schema`, `get_context_jsonschema` 等
3. **状态管理**: `get_state`, `aget_state`, `get_state_history`, `update_state` 等
4. **执行控制**: `invoke`, `ainvoke`, `stream`, `astream`
5. **缓存管理**: `clear_cache`, `aclear_cache`
6. **子图操作**: `get_subgraphs`, `aget_subgraphs`

上一节我们介绍了 invoke 方法的入参，这一节我们就来介绍 invoke 方法的实现。invoke 内部主要是调用了 stream 方法。所以我们要先来看 stream 方法。


## 2. stream 方法
stream 方法非常的长，我直接把代码拷贝到 ChatGpt了，让 ChatGpt 给我解释了这段代码，下面的内容是结合 ChatGpt 的回答整理的。如代码里面注释标注的，stream 代码分成如下几块:
1. 参数预处理与默认值解析
2. 设置 stream 管道（事件队列）
3. 配置归一化和 callback 设置
4. 参数标准化
5. Subgraph 处理
6. 消息流模式处理
7. 配置 Runtime
8. 启动主循环：SyncPregelLoop
9. 初始化 PregelRunner
10. 执行 loop.tick 生成 tasks
11. 执行 runner.tick 执行 tasks
12. _output 输出中间结果
13. 执行 loop.after_tick 更新 channel
14. _output 输出最终结果

核心的代码我们在之前介绍 Loop，Runner 时都已经介绍过了。

```python
class Pregel(
    PregelProtocol[StateT, ContextT, InputT, OutputT],
    Generic[StateT, ContextT, InputT, OutputT],
):
        # 1. 参数预处理与默认值解析
        if stream_mode is None:
            # if being called as a node in another graph, default to values mode
            # but don't overwrite stream_mode arg if provided
            stream_mode = (
                "values"
                if config is not None and CONFIG_KEY_TASK_ID in config.get(CONF, {})
                else self.stream_mode
            )
        if debug or self.debug:
            print_mode = ["updates", "values"]
        # 2. 设置 stream 管道（事件队列）
        stream = SyncQueue()
        # 3. 配置归一化和 callback 设置
        config = ensure_config(self.config, config)
        callback_manager = get_callback_manager_for_config(config)
        run_manager = callback_manager.on_chain_start(
            None,
            input,
            name=config.get("run_name", self.get_name()),
            run_id=config.get("run_id"),
        )
        try:
            deprecated_checkpoint_during = cast(
                Optional[bool], kwargs.get("checkpoint_during")
            )
            if deprecated_checkpoint_during is not None:
                warnings.warn(
                    "`checkpoint_during` is deprecated and will be removed. Please use `durability` instead.",
                    category=LangGraphDeprecatedSinceV10,
                )
            # 4. 参数标准化
            # assign defaults
            (
                stream_modes,
                output_keys,
                interrupt_before_,
                interrupt_after_,
                checkpointer,
                store,
                cache,
                durability_,
            ) = self._defaults(
                config,
                stream_mode=stream_mode,
                print_mode=print_mode,
                output_keys=output_keys,
                interrupt_before=interrupt_before,
                interrupt_after=interrupt_after,
                durability=durability,
                checkpoint_during=deprecated_checkpoint_during,
            )
            # 5. Subgraph 处理
            if checkpointer is None and (
                durability is not None or deprecated_checkpoint_during is not None
            ):
                warnings.warn(
                    "`durability` has no effect when no checkpointer is present.",
                )
            # set up subgraph checkpointing
            if self.checkpointer is True:
                ns = cast(str, config[CONF][CONFIG_KEY_CHECKPOINT_NS])
                config[CONF][CONFIG_KEY_CHECKPOINT_NS] = recast_checkpoint_ns(ns)
            # set up messages stream mode
            # 6. 消息流模式处理
            if "messages" in stream_modes:
                run_manager.inheritable_handlers.append(
                    StreamMessagesHandler(stream.put, subgraphs)
                )

            # set up custom stream mode
            if "custom" in stream_modes:

                def stream_writer(c: Any) -> None:
                    stream.put(
                        (
                            tuple(
                                get_config()[CONF][CONFIG_KEY_CHECKPOINT_NS].split(
                                    NS_SEP
                                )[:-1]
                            ),
                            "custom",
                            c,
                        )
                    )
            elif CONFIG_KEY_STREAM in config[CONF]:
                stream_writer = config[CONF][CONFIG_KEY_RUNTIME].stream_writer
            else:

                def stream_writer(c: Any) -> None:
                    pass

            # set durability mode for subgraphs
            if durability is not None or deprecated_checkpoint_during is not None:
                config[CONF][CONFIG_KEY_DURABILITY] = durability_
            # 7. 配置 Runtime 和 stream_writer
            runtime = Runtime(
                context=_coerce_context(self.context_schema, context),
                store=store,
                stream_writer=stream_writer,
                previous=None,
            )
            parent_runtime = config[CONF].get(CONFIG_KEY_RUNTIME, DEFAULT_RUNTIME)
            runtime = parent_runtime.merge(runtime)
            config[CONF][CONFIG_KEY_RUNTIME] = runtime
            # 8. 启动主循环：SyncPregelLoop
            with SyncPregelLoop(
                input,
                stream=StreamProtocol(stream.put, stream_modes),
                config=config,
                store=store,
                cache=cache,
                checkpointer=checkpointer,
                nodes=self.nodes,
                specs=self.channels,
                output_keys=output_keys,
                input_keys=self.input_channels,
                stream_keys=self.stream_channels_asis,
                interrupt_before=interrupt_before_,
                interrupt_after=interrupt_after_,
                manager=run_manager,
                durability=durability_,
                trigger_to_nodes=self.trigger_to_nodes,
                migrate_checkpoint=self._migrate_checkpoint,
                retry_policy=self.retry_policy,
                cache_policy=self.cache_policy,
            ) as loop:
                # 9. 初始化 PregelRunner
                runner = PregelRunner(
                    submit=config[CONF].get(
                        CONFIG_KEY_RUNNER_SUBMIT, weakref.WeakMethod(loop.submit)
                    ),
                    put_writes=weakref.WeakMethod(loop.put_writes),
                    node_finished=config[CONF].get(CONFIG_KEY_NODE_FINISHED),
                )
                # enable subgraph streaming
                # Subgraph 处理
                if subgraphs:
                    loop.config[CONF][CONFIG_KEY_STREAM] = loop.stream
                # enable concurrent streaming
                if (
                    self.stream_eager
                    or subgraphs
                    or "messages" in stream_modes
                    or "custom" in stream_modes
                ):
                    # we are careful to have a single waiter live at any one time
                    # because on exit we increment semaphore count by exactly 1
                    waiter: concurrent.futures.Future | None = None
                    # because sync futures cannot be cancelled, we instead
                    # release the stream semaphore on exit, which will cause
                    # a pending waiter to return immediately
                    loop.stack.callback(stream._count.release)

                    def get_waiter() -> concurrent.futures.Future[None]:
                        nonlocal waiter
                        if waiter is None or waiter.done():
                            waiter = loop.submit(stream.wait)
                            return waiter
                        else:
                            return waiter

                else:
                    get_waiter = None  # type: ignore[assignment]
                # Similarly to Bulk Synchronous Parallel / Pregel model
                # computation proceeds in steps, while there are channel updates.
                # Channel updates from step N are only visible in step N+1
                # channels are guaranteed to be immutable for the duration of the step,
                # with channel updates applied only at the transition between steps.
                # 10. step 第一步，生成 tasks
                while loop.tick():
                    for task in loop.match_cached_writes():
                        loop.output_writes(task.id, task.writes, cached=True)
                    # 11. step 第二步，执行 task
                    for _ in runner.tick(
                        [t for t in loop.tasks.values() if not t.writes],
                        timeout=self.step_timeout,
                        get_waiter=get_waiter,
                        schedule_task=loop.accept_push,
                    ):
                        # emit output
                        # 12. 输出中间结果
                        yield from _output(
                            stream_mode, print_mode, subgraphs, stream.get, queue.Empty
                        )
                    # 13. step 第三步，更新 channel
                    loop.after_tick()
                    # wait for checkpoint
                    if durability_ == "sync":
                        loop._put_checkpoint_fut.result()
            # emit output
            # 13. 执行完成，输出结果
            yield from _output(
                stream_mode, print_mode, subgraphs, stream.get, queue.Empty
            )
            # handle exit
            if loop.status == "out_of_steps":
                msg = create_error_message(
                    message=(
                        f"Recursion limit of {config['recursion_limit']} reached "
                        "without hitting a stop condition. You can increase the "
                        "limit by setting the `recursion_limit` config key."
                    ),
                    error_code=ErrorCode.GRAPH_RECURSION_LIMIT,
                )
                raise GraphRecursionError(msg)
            # set final channel values as run output
            run_manager.on_chain_end(loop.output)
        except BaseException as e:
            run_manager.on_chain_error(e)
            raise
```

### 2.1 stream 管道
`stream=SyncQueue()` SyncQueue 是一个先进先出的队列。实现比较简单，内部是一个 queue 和 信号量。

```python
class SyncQueue:
    """Unbounded FIFO queue with a wait() method.
    Adapted from pure Python implementation of queue.SimpleQueue.
    """

    def __init__(self):
        self._queue = deque()
        self._count = Semaphore(0)
```

引入信号量，是为了给 get 操作提供超时控制。

### 2.2 参数标准化
参数标准化通过 `_default` 方法实现，下面是 `_defaults` 的源码:
```python
    def _defaults(
        self,
        config: RunnableConfig,
        *,
        stream_mode: StreamMode | Sequence[StreamMode],
        print_mode: StreamMode | Sequence[StreamMode],
        output_keys: str | Sequence[str] | None,
        interrupt_before: All | Sequence[str] | None,
        interrupt_after: All | Sequence[str] | None,
        durability: Durability | None = None,
        checkpoint_during: bool | None = None,
    ) -> tuple[
        set[StreamMode],
        str | Sequence[str],
        All | Sequence[str],
        All | Sequence[str],
        BaseCheckpointSaver | None,
        BaseStore | None,
        BaseCache | None,
        Durability,
    ]:
        if config["recursion_limit"] < 1:
            raise ValueError("recursion_limit must be at least 1")
        if output_keys is None:
            output_keys = self.stream_channels_asis
        else:
            # 检查输出 key 是否在 channels 中，self.channels 包含了 pregel 用到的所有 channel
            validate_keys(output_keys, self.channels)
        interrupt_before = interrupt_before or self.interrupt_before_nodes
        interrupt_after = interrupt_after or self.interrupt_after_nodes
        # 合并 stream_modes/pring_mode
        if not isinstance(stream_mode, list):
            stream_modes = {stream_mode}
        else:
            stream_modes = set(stream_mode)
        if isinstance(print_mode, str):
            stream_modes.add(print_mode)
        else:
            stream_modes.update(print_mode)
        # 从配置中获取默认参数
        
        if self.checkpointer is False:
            checkpointer: BaseCheckpointSaver | None = None
        elif CONFIG_KEY_CHECKPOINTER in config.get(CONF, {}):
            checkpointer = config[CONF][CONFIG_KEY_CHECKPOINTER]
        elif self.checkpointer is True:
            raise RuntimeError("checkpointer=True cannot be used for root graphs.")
        else:
            checkpointer = self.checkpointer
        if checkpointer and not config.get(CONF):
            raise ValueError(
                "Checkpointer requires one or more of the following 'configurable' "
                "keys: thread_id, checkpoint_ns, checkpoint_id"
            )
        if CONFIG_KEY_RUNTIME in config.get(CONF, {}):
            store: BaseStore | None = config[CONF][CONFIG_KEY_RUNTIME].store
        else:
            store = self.store
        if CONFIG_KEY_CACHE in config.get(CONF, {}):
            cache: BaseCache | None = config[CONF][CONFIG_KEY_CACHE]
        else:
            cache = self.cache
        if checkpoint_during is not None:
            if durability is not None:
                raise ValueError(
                    "Cannot use both `checkpoint_during` and `durability` parameters."
                )
            elif checkpoint_during:
                durability = "async"
            else:
                durability = "exit"
        if durability is None:
            durability = config.get(CONF, {}).get(CONFIG_KEY_DURABILITY, "async")
        return (
            stream_modes,
            output_keys,
            interrupt_before,
            interrupt_after,
            checkpointer,
            store,
            cache,
            durability,
        )
```

_default 用于标准化 pregel 参数。`_default` 会从 config 中获取如下配置:

```python
{
    "configurable": {
        "__pregel_checkpointer": Checkpointer,
        "__pregel_runtime": Store,
        "__pregel_cache": Cache,
        "__pregel_durability": Durability
    }
}
```

#### durability
`durability` 是用于控制 **LangGraph** 执行过程中的 **状态持久化（checkpoint）策略** 的参数。主要影响 **在图执行过程中的哪个阶段保存中间状态（State）**

| 模式      | 持久化时机      | 安全性 | 性能 | 适合场景          |
| ------- | ---------- | --- | -- | ------------- |
| `sync`  | 每步后同步保存    | 高   | 中  | 高可用要求的生产流程    |
| `async` | 每步后异步保存    | 中   | 高  | 性能优先，风险可接受的流程 |
| `exit`  | 图执行完后才保存一次 | 低   | 最高 | 可重跑流程、实验性流程   |


## 3. invoke 方法
我们对着前面的示例来看 invoke 的代码，invoke 调用 stream，并从 stream 的输出中提取 stream_mode=values 的值，作为 invoke 的返回值。

```python
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


class Pregel(
    PregelProtocol[StateT, ContextT, InputT, OutputT],
    Generic[StateT, ContextT, InputT, OutputT],
):
    def invoke(
        self,
        input: InputT | Command | None,
        config: RunnableConfig | None = None,
        *,
        context: ContextT | None = None,
        stream_mode: StreamMode = "values",
        print_mode: StreamMode | Sequence[StreamMode] = (),
        output_keys: str | Sequence[str] | None = None,
        interrupt_before: All | Sequence[str] | None = None,
        interrupt_after: All | Sequence[str] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any] | Any:
        # 控制输出哪些 channel 
        output_keys = output_keys if output_keys is not None else self.output_channels

        latest: dict[str, Any] | Any = None
        chunks: list[dict[str, Any] | Any] = []
        interrupts: list[Interrupt] = []

        # 核心逻辑在 stream 方法
        for chunk in self.stream(
            input,
            config,
            context=context,
            stream_mode=["updates", "values"]
            if stream_mode == "values"
            else stream_mode,
            print_mode=print_mode,
            output_keys=output_keys,
            interrupt_before=interrupt_before,
            interrupt_after=interrupt_after,
            **kwargs,
        ):
            if stream_mode == "values":
                if len(chunk) == 2:
                    mode, payload = cast(tuple[StreamMode, Any], chunk)
                else:
                    _, mode, payload = cast(
                        tuple[tuple[str, ...], StreamMode, Any], chunk
                    )
                if (
                    mode == "updates"
                    and isinstance(payload, dict)
                    and (ints := payload.get(INTERRUPT)) is not None
                ):
                    interrupts.extend(ints)
                elif mode == "values":
                    latest = payload
            else:
                chunks.append(chunk)

        if stream_mode == "values":
            if interrupts:
                return (
                    {**latest, INTERRUPT: interrupts}
                    if isinstance(latest, dict)
                    else {INTERRUPT: interrupts}
                )
            return latest
        else:
            return chunks
```

