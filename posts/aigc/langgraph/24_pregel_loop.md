---
weight: 1
title: "langgraph pregel loop"
date: 2025-08-01T16:00:00+08:00
lastmod: 2025-08-01T16:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langgraph pregel loop"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

## 1. PregelLoop
```bash
# 提问
上面是 Langgraph PregelLoop 的定义，请给我解释一下 PregelLoop 的语义，并以表格的形式列举 PregelLoop 的属性，并以另一个表格列举 PregelLoop 的方法
```
### 1.1 PregelLoop 语义

`PregelLoop` 是 LangGraph 中实现 Pregel 模式的核心类之一，承担了图执行调度器的角色。它负责以超步（superstep）方式逐步调度图中的节点（`PregelNode`），并在每个 tick 中处理任务的生成、执行、中断判断、检查点记录、流写入以及缓存等一系列关键操作。PregelLoop 应该是 LangGraph 中最复杂的类，也是最核心的类。



| 角色      | 说明                                                         |
| ------- | ---------------------------------------------------------- |
| 图调度器    | 管理 Pregel 模式下的图执行生命周期（构建任务 → 执行任务 → 收集结果 → 写入 checkpoint）。 |
| 状态管理者   | 保存当前步骤、节点状态、通道值、缓存等，用于恢复或继续执行。                             |
| 检查点协作者  | 协调持久化逻辑（通过 `checkpointer`）将中间状态保存至外部系统（如 DB、文件系统）。         |
| 中断机制协调者 | 提供 `interrupt_before` 与 `interrupt_after` 中断控制机制。          |
| 输出协调者   | 控制哪些任务的输出将通过 `stream` 发出，以及是否触发结果值输出。                      |


### 1.3 PregelLoop 属性

| 属性名                                         | 类型                                                  | 说明                                     |
| ------------------------------------------- | --------------------------------------------------- | -------------------------------------- |
| `config`                                    | `RunnableConfig`                                    | 当前执行配置（包含命名空间、恢复标记等元数据）。               |
| `store`                                     | `BaseStore \| None`                                 | 存储层（用于读取通道值等）。                         |
| `stream`                                    | `StreamProtocol \| None`                            | 流系统（用于发送中间状态，如 task、values）。           |
| `step`, `stop`                              | `int`                                               | 当前执行步数、最多步数。                           |
| `input`                                     | `Any \| None`                                       | 初始输入值。                                 |
| `cache`                                     | `BaseCache[WritesT] \| None`                        | 缓存系统。                                  |
| `checkpointer`                              | `BaseCheckpointSaver \| None`                       | 检查点保存器。                                |
| `nodes`                                     | `Mapping[str, PregelNode]`                          | 图中所有节点定义。                              |
| `specs`                                     | `Mapping[str, BaseChannel \| ManagedValueSpec]`     | 通道定义集合。                                |
| `input_keys`, `output_keys`, `stream_keys`  | `str \| list[str]`                                  | 指定输入、输出、流通道 key。                       |
| `skip_done_tasks`                           | `bool`                                              | 是否跳过已完成任务（用于恢复场景）。                     |
| `is_nested`                                 | `bool`                                              | 是否为子图执行（由 `config` 中是否含 task_id 判定）。  |
| `manager`                                   | `AsyncParentRunManager \| ParentRunManager \| None` | 执行管理器。                                 |
| `interrupt_before`, `interrupt_after`       | `All \| Sequence[str]`                              | 中断点配置。                                 |
| `durability`                                | `Durability`                                        | 是否启用持久化机制。                             |
| `retry_policy`                              | `Sequence[RetryPolicy]`                             | 重试策略。                                  |
| `cache_policy`                              | `CachePolicy \| None`                               | 缓存策略。                                  |
| `checkpointer_get_next_version`             | `GetNextVersion`                                    | 获取通道版本号的函数。                            |
| `checkpointer_put_writes`                   | `Callable \| None`                                  | 写入 checkpoint 的方法。                     |
| `checkpointer_put_writes_accepts_task_path` | `bool`                                              | 是否支持传入 `task.path` 参数。                 |
| `_checkpointer_put_after_previous`          | `Callable \| None`                                  | checkpoint 之后的异步提交钩子。                  |
| `_migrate_checkpoint`                       | `Callable \| None`                                  | 检查点迁移逻辑（通常用于版本迁移）。                     |
| `submit`                                    | `Submit`                                            | 异步提交方法（通常是线程池或事件循环封装）。                 |
| `channels`                                  | `Mapping[str, BaseChannel]`                         | 所有运行中的通道状态。                            |
| `managed`                                   | `ManagedValueMapping`                               | 管理的通道值（含版本）。                           |
| `checkpoint`                                | `Checkpoint`                                        | 当前执行中的检查点状态。                           |
| `checkpoint_id_saved`                       | `str`                                               | 最近保存的 checkpoint ID。                   |
| `checkpoint_ns`                             | `tuple[str, ...]`                                   | 当前命名空间（嵌套图结构用）。                        |
| `checkpoint_config`                         | `RunnableConfig`                                    | 用于 checkpoint 的配置快照。                   |
| `checkpoint_metadata`                       | `CheckpointMetadata`                                | checkpoint 的元信息。                       |
| `checkpoint_pending_writes`                 | `list[PendingWrite]`                                | 待保存的写入项。                               |
| `checkpoint_previous_versions`              | `dict[str, str \| float \| int]`                    | 上一个 checkpoint 的通道版本信息。                |
| `prev_checkpoint_config`                    | `RunnableConfig \| None`                            | 上一次的 config 快照（用于调试对比）。                |
| `status`                                    | `Literal[...]`                                      | 当前状态标识：input、pending、done、interrupt、等。 |
| `tasks`                                     | `dict[str, PregelExecutableTask]`                   | 当前调度周期生成的所有任务。                         |
| `output`                                    | `dict[str, Any] \| None`                            | 最终输出。                                  |
| `updated_channels`                          | `set[str] \| None`                                  | 最新被写入的通道集合。                            |
| `trigger_to_nodes`                          | `Mapping[str, Sequence[str]]`                       | 通道变更 -> 触发节点映射关系。                      |


下面是 PregelLoop 初始化的代码，代码比较长:

```python
# Pregel 初始化 SyncPregelLoop 的代码，可以帮助我们理解 SyncPregelLoop 与 Pregel 的关系
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
  pass

class PregelLoop:
    config: RunnableConfig
    store: BaseStore | None
    stream: StreamProtocol | None
    step: int
    stop: int

    input: Any | None
    cache: BaseCache[WritesT] | None
    checkpointer: BaseCheckpointSaver | None
    nodes: Mapping[str, PregelNode]
    specs: Mapping[str, BaseChannel | ManagedValueSpec]  # 所有 channels
    input_keys: str | Sequence[str]
    output_keys: str | Sequence[str]
    stream_keys: str | Sequence[str]
    skip_done_tasks: bool
    is_nested: bool
    manager: None | AsyncParentRunManager | ParentRunManager
    interrupt_after: All | Sequence[str]
    interrupt_before: All | Sequence[str]
    durability: Durability
    retry_policy: Sequence[RetryPolicy]
    cache_policy: CachePolicy | None

    checkpointer_get_next_version: GetNextVersion
    checkpointer_put_writes: Callable[[RunnableConfig, WritesT, str], Any] | None
    checkpointer_put_writes_accepts_task_path: bool
    _checkpointer_put_after_previous: (
        Callable[
            [
                concurrent.futures.Future | None,
                RunnableConfig,
                Checkpoint,
                str,
                ChannelVersions,
            ],
            Any,
        ]
        | None
    )
    _migrate_checkpoint: Callable[[Checkpoint], None] | None
    submit: Submit
    channels: Mapping[str, BaseChannel]
    managed: ManagedValueMapping
    checkpoint: Checkpoint
    checkpoint_id_saved: str
    checkpoint_ns: tuple[str, ...]
    checkpoint_config: RunnableConfig
    checkpoint_metadata: CheckpointMetadata
    checkpoint_pending_writes: list[PendingWrite]
    checkpoint_previous_versions: dict[str, str | float | int]
    prev_checkpoint_config: RunnableConfig | None

    status: Literal[
        "input",
        "pending",
        "done",
        "interrupt_before",
        "interrupt_after",
        "out_of_steps",
    ]
    tasks: dict[str, PregelExecutableTask]
    output: None | dict[str, Any] | Any = None
    updated_channels: set[str] | None = None

    # public

    def __init__(
        self,
        input: Any | None,
        *,
        stream: StreamProtocol | None,
        config: RunnableConfig,
        store: BaseStore | None,
        cache: BaseCache | None,
        checkpointer: BaseCheckpointSaver | None,
        nodes: Mapping[str, PregelNode],
        specs: Mapping[str, BaseChannel | ManagedValueSpec],
        input_keys: str | Sequence[str],
        output_keys: str | Sequence[str],
        stream_keys: str | Sequence[str],
        trigger_to_nodes: Mapping[str, Sequence[str]],
        durability: Durability,
        interrupt_after: All | Sequence[str] = EMPTY_SEQ,
        interrupt_before: All | Sequence[str] = EMPTY_SEQ,
        manager: None | AsyncParentRunManager | ParentRunManager = None,
        migrate_checkpoint: Callable[[Checkpoint], None] | None = None,
        retry_policy: Sequence[RetryPolicy] = (),
        cache_policy: CachePolicy | None = None,
    ) -> None:
        # 处理传入的参数 
        self.stream = stream
        self.config = config
        self.store = store
        self.step = 0
        self.stop = 0
        self.input = input
        self.checkpointer = checkpointer
        self.cache = cache
        self.nodes = nodes
        self.specs = specs
        self.input_keys = input_keys
        self.output_keys = output_keys
        self.stream_keys = stream_keys
        self.interrupt_after = interrupt_after
        self.interrupt_before = interrupt_before
        self.manager = manager
        # 从 config 中提取的参数
        self.is_nested = CONFIG_KEY_TASK_ID in self.config.get(CONF, {})
        self.skip_done_tasks = CONFIG_KEY_CHECKPOINT_ID not in config[CONF]
        self._migrate_checkpoint = migrate_checkpoint
        self.trigger_to_nodes = trigger_to_nodes
        self.retry_policy = retry_policy
        self.cache_policy = cache_policy
        self.durability = durability
        if self.stream is not None and CONFIG_KEY_STREAM in config[CONF]:
            self.stream = DuplexStream(self.stream, config[CONF][CONFIG_KEY_STREAM])
        scratchpad: PregelScratchpad | None = config[CONF].get(CONFIG_KEY_SCRATCHPAD)
        if isinstance(scratchpad, PregelScratchpad):
            # if count is > 0, append to checkpoint_ns
            # if count is 0, leave as is
            if cnt := scratchpad.subgraph_counter():
                self.config = patch_configurable(
                    self.config,
                    {
                        CONFIG_KEY_CHECKPOINT_NS: NS_SEP.join(
                            (
                                config[CONF][CONFIG_KEY_CHECKPOINT_NS],
                                str(cnt),
                            )
                        )
                    },
                )
        # 如果不存在 task_id，说明是 root graph，重置 checkpoint_ns 和 checkpoint_id

        if not self.is_nested and config[CONF].get(CONFIG_KEY_CHECKPOINT_NS):
            self.config = patch_configurable(
                self.config,
                {CONFIG_KEY_CHECKPOINT_NS: "", CONFIG_KEY_CHECKPOINT_ID: None},
            )
        if (
            CONFIG_KEY_CHECKPOINT_MAP in self.config[CONF]
            and self.config[CONF].get(CONFIG_KEY_CHECKPOINT_NS)
            in self.config[CONF][CONFIG_KEY_CHECKPOINT_MAP]
        ):
            self.checkpoint_config = patch_configurable(
                self.config,
                {
                    CONFIG_KEY_CHECKPOINT_ID: self.config[CONF][
                        CONFIG_KEY_CHECKPOINT_MAP
                    ][self.config[CONF][CONFIG_KEY_CHECKPOINT_NS]]
                },
            )
        else:
            self.checkpoint_config = self.config
        if thread_id := self.checkpoint_config[CONF].get(CONFIG_KEY_THREAD_ID):
            if not isinstance(thread_id, str):
                self.checkpoint_config = patch_configurable(
                    self.checkpoint_config,
                    {CONFIG_KEY_THREAD_ID: str(thread_id)},
                )
        self.checkpoint_ns = (
            tuple(cast(str, self.config[CONF][CONFIG_KEY_CHECKPOINT_NS]).split(NS_SEP))
            if self.config[CONF].get(CONFIG_KEY_CHECKPOINT_NS)
            else ()
        )
        self.prev_checkpoint_config = None
```

很大一部分是从 RunnableConfig 中提取相关配置。这里对相关的配置项做一个整理:

```python
{
    "__pregel_task_id": "task_id",    # is_nested = CONFIG_KEY_TASK_ID in configurable，判断当前是不是子图
    "checkpoint_id": "checkpoint_id", # skip_done_tasks = CONFIG_KEY_CHECKPOINT_ID not in configurable
    "checkpoint_ns": "checkpoint_ns",
    "thread_id": "thread_id",
    "__pregel_stream": "StreamProtocol", # 合并 stream
    "__pregel_scratchpad": "scratchpad", # 重新配置 __pregel_checkpoint_ns/subgraph_counter
}
```

#### StreamProtocol
StreamProtocol 是一个带有“输出模式”的流处理协议接口，它包装了一个可调用函数，用于处理流数据（如日志、模型输出、状态更新等）。

```python
StreamChunk = tuple[tuple[str, ...], str, Any]

class StreamProtocol:
    __slots__ = ("modes", "__call__")

    modes: set[StreamMode]

    __call__: Callable[[Self, StreamChunk], None]

    def __init__(
        self,
        __call__: Callable[[StreamChunk], None],
        modes: set[StreamMode],
    ) -> None:
        self.__call__ = cast(Callable[[Self, StreamChunk], None], __call__)
        self.modes = modes

stream=StreamProtocol(stream.put, stream_modes)
stream(stream_chunk)
```


### 1.4 PregelLoop 方法

PregelLoop 类的方法都比较复杂，接下来我们一一讲解。

| 方法名                                            | 作用                       | 是否私有 | 关键点说明                                     |
| ---------------------------------------------- | ------------------------ | ---- | ----------------------------------------- |
| `__init__`                                     | 初始化所有运行环境、检查点、通道等        | ❌    | 初始化复杂，含 scratchpad、resume、namespace 重写等逻辑 |
| `tick`                                         | 执行一次迭代：构建任务、判断中断、执行缓存    | ❌    | Pregel 超步逻辑的关键入口                          |
| `after_tick`                                   | 完成迭代后的尾处理：写入、emit、更新状态   | ❌    | 会在每次 tick 成功后调用                           |
| `_first`                                       | 初始化输入阶段的 apply 逻辑        | ✅    | 在图起点或恢复时触发                                |
| `_put_checkpoint`                              | 执行 checkpoint 写入         | ✅    | 控制 step 增长、metadata 更新                    |
| `_put_pending_writes`                          | 执行所有缓存写入提交               | ✅    | 提交到 checkpointer                          |
| `put_writes`                                   | 写入一个 task 的 writes 数据    | ❌    | 包含 checkpoint 保存逻辑                        |
| `_match_writes`                                | 将写入匹配到已有任务               | ✅    | 用于 skip\_done\_task 时将缓存应用到 task          |
| `accept_push`                                  | 接收 PUSH 操作并构建新的任务        | ❌    | 从某个 task 中激发出一个新的 task（如 subgraph）        |
| `match_cached_writes` / `amatch_cached_writes` | 匹配缓存中的 writes（未实现）       | ❌    | 接口预留                                      |
| `_suppress_interrupt`                          | 处理 GraphInterrupt 时的行为控制 | ✅    | 主要用于嵌套图控制                                 |
| `output_writes`                                | 发出任务写入的 stream 事件        | ❌    | 控制是否输出、是否过滤 hidden                        |
| `_emit`                                        | 执行 stream 写入             | ✅    | 支持 debug 模式映射                             |


## 2. SyncPregelLoop ContextManager 实现
PregelLoop 一部分参数是在上下文管理器中实现的。上下文管理器实现在 PregelLoop 子类上，这里我们以 SyncPregelLoop 为例。

### 2.1 SyncPregelLoop 初始化
初始化参数完成 checkpointer 相关参数的初始化，并设置 `self.stack`

```python
class SyncPregelLoop(PregelLoop, AbstractContextManager):
    def __init__(
        self,
        input: Any | None,
        *,
        stream: StreamProtocol | None,
        config: RunnableConfig,
        store: BaseStore | None,
        cache: BaseCache | None,
        checkpointer: BaseCheckpointSaver | None,
        nodes: Mapping[str, PregelNode],
        specs: Mapping[str, BaseChannel | ManagedValueSpec],
        trigger_to_nodes: Mapping[str, Sequence[str]],
        durability: Durability,
        manager: None | AsyncParentRunManager | ParentRunManager = None,
        interrupt_after: All | Sequence[str] = EMPTY_SEQ,
        interrupt_before: All | Sequence[str] = EMPTY_SEQ,
        input_keys: str | Sequence[str] = EMPTY_SEQ,
        output_keys: str | Sequence[str] = EMPTY_SEQ,
        stream_keys: str | Sequence[str] = EMPTY_SEQ,
        migrate_checkpoint: Callable[[Checkpoint], None] | None = None,
        retry_policy: Sequence[RetryPolicy] = (),
        cache_policy: CachePolicy | None = None,
    ) -> None:
        super().__init__(
            input,
            stream=stream,
            config=config,
            checkpointer=checkpointer,
            cache=cache,
            store=store,
            nodes=nodes,
            specs=specs,
            input_keys=input_keys,
            output_keys=output_keys,
            stream_keys=stream_keys,
            interrupt_after=interrupt_after,
            interrupt_before=interrupt_before,
            manager=manager,
            migrate_checkpoint=migrate_checkpoint,
            trigger_to_nodes=trigger_to_nodes,
            retry_policy=retry_policy,
            cache_policy=cache_policy,
            durability=durability,
        )
        self.stack = ExitStack()
        if checkpointer:
            # 获取 checkpoint 下一个版本号
            self.checkpointer_get_next_version = checkpointer.get_next_version
            # put_writes 函数用于存储与任务关联的中间产出
            self.checkpointer_put_writes = checkpointer.put_writes
            # 检查put_writes是否接收 task_path 参数
            self.checkpointer_put_writes_accepts_task_path = (
                signature(checkpointer.put_writes).parameters.get("task_path")
                is not None
            )
        else:
            self.checkpointer_get_next_version = increment
            self._checkpointer_put_after_previous = None  # type: ignore[assignment]
            self.checkpointer_put_writes = None
            self.checkpointer_put_writes_accepts_task_path = False
```

### 2.2 ExitStack

`ExitStack` 是 contextlib 提供的 **可组合的上下文管理器堆栈**，我们通过一个示例来了解他的用法:


```python
# 传统写法（静态嵌套）
with open("a.txt") as f1:
    with open("b.txt") as f2:
        ...

# 使用 `ExitStack`（动态注册）
from contextlib import ExitStack

with ExitStack() as stack:
    f1 = stack.enter_context(open("a.txt"))
    f2 = stack.enter_context(open("b.txt"))
    ...
# 所有资源都会在这里自动关闭
```

这在“资源数量不确定”时非常有用，例如：

```python
with ExitStack() as stack:
    files = [stack.enter_context(open(name)) for name in file_list]
```

### 2.3 ContextManager
讲解完 SyncPregelLoop 初始化，我们来讲解 SyncPregelLoop 的上下文管理器的实现。

`__enter__` 主要完成以下几个任务:
1. 加载 checkpoint，load 其参数
2. 初始化 self.submit 参数
3. channels_from_checkpoint 从checkpoint 中恢复 channel 的值

```python
    def __enter__(self) -> Self:
        # 1. load checkpoint
        if self.checkpointer:
            saved = self.checkpointer.get_tuple(self.checkpoint_config)
        else:
            saved = None
        if saved is None:
            # 设置默认 checkpoint
            saved = CheckpointTuple(
                self.checkpoint_config, empty_checkpoint(), {"step": -2}, None, []
            )
        # _migrate_checkpoint 是传入的 Pregel._migrate_checkpoint 方法
        # 在框架检测到某个 Checkpoint 是旧格式（version < 4）时，将其字段结构升级为当前的新版本格式，以便继续使用
        elif self._migrate_checkpoint is not None:
            self._migrate_checkpoint(saved.checkpoint)
        
        # 按照 checkpoint 的 config 为最高优先级，重载 config
        self.checkpoint_config = {
            **self.checkpoint_config,
            **saved.config,
            CONF: {
                CONFIG_KEY_CHECKPOINT_NS: "",
                **self.checkpoint_config.get(CONF, {}),
                **saved.config.get(CONF, {}),
            },
        }
        self.prev_checkpoint_config = saved.parent_config
        self.checkpoint_id_saved = saved.checkpoint["id"]
        self.checkpoint = saved.checkpoint
        self.checkpoint_metadata = saved.metadata
        self.checkpoint_pending_writes = (
            # task_id,channel,value
            [(str(tid), k, v) for tid, k, v in saved.pending_writes]
            if saved.pending_writes is not None
            else []
        )
        # 2. BackgroundExecutor 是线程池，self.submit = BackgroundExecutor.submit 方法
        self.submit = self.stack.enter_context(BackgroundExecutor(self.config))
        self.channels, self.managed = channels_from_checkpoint(
            self.specs, self.checkpoint
        )
        self.stack.push(self._suppress_interrupt)
        self.status = "input"
        self.step = self.checkpoint_metadata["step"] + 1
        self.stop = self.step + self.config["recursion_limit"] + 1
        self.checkpoint_previous_versions = self.checkpoint["channel_versions"].copy()
        self.updated_channels = self._first(input_keys=self.input_keys)

        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> bool | None:
        # unwind stack
        return self.stack.__exit__(exc_type, exc_value, traceback)
```

#### self.submit
```python
self.stack.enter_context(BackgroundExecutor(self.config))
```
这段代码会调用 BackgroundExecutor 的 `__enter__` 方法，`BackgroundExecutor.__enter__` 返回的是其 submit 方法。


#### channels_from_checkpoint

```python
def channels_from_checkpoint(
    specs: Mapping[str, BaseChannel | ManagedValueSpec],
    checkpoint: Checkpoint,
) -> tuple[Mapping[str, BaseChannel], ManagedValueMapping]:
    """Get channels from a checkpoint."""
    channel_specs: dict[str, BaseChannel] = {}
    managed_specs: dict[str, ManagedValueSpec] = {}
    for k, v in specs.items():
        if isinstance(v, BaseChannel):
            channel_specs[k] = v
        else:
            managed_specs[k] = v
    return (
        {
            # load checkpoint 中的 channel 值
            k: v.from_checkpoint(checkpoint["channel_values"].get(k, MISSING))
            for k, v in channel_specs.items()
        },
        managed_specs,
    )
```

至此我们基本上讲解完了 PregelLoop 的初始化，接下来我们来讲解 PregelLoop 的方法。前面我们讲解 Pregel 代码时已经分析了 stream 方法的基本流程。我们将按照下面的顺序介绍 PregelLoop 中的方法:
1. tick
2. match_cached_writes
3. output_writes
4. after_tick
5. _put_checkpoint_fut

## 3. tick
