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

在 Pregel 模型中，图的每个节点以同步轮次进行计算（step），节点之间通过消息传递进行通信，每个 step 都是一个迭代单位，直到满足终止条件（如没有更多消息传递或达到最大轮次）。`PregelScratchpad` 就是**在某一轮 Pregel 计算 step 中记录该轮的状态和辅助逻辑的结构体**。

## 1. PregelScratchpad

PregelScratchpad 的定义比较简单，源码如下:

```python
@dataclasses.dataclass(**_DC_KWARGS)
class PregelScratchpad:
    step: int
    stop: int
    # call
    call_counter: Callable[[], int]
    # interrupt
    interrupt_counter: Callable[[], int]
    get_null_resume: Callable[[bool], Any]
    resume: list[Any]
    # subgraph
    subgraph_counter: Callable[[], int]
```

本节我们核心要关注的是 PregelScratchpad 的生成逻辑。PregelScratchpad 的生成位于 `langgraph\pregel\_algo.py` 下的 `_scratchpad`。`_scratchpad` 的调用入口主要是同目录下的 `prepare_single_task` 函数，这一节我们主要学习的就是这两个函数。

## 2. _scratchpad

_scratchpad 的代码并不复杂，复杂的是里面 null_resume_write、task_resume_write、resume_map 这几个变量的语义和生成逻辑。


```python
def _scratchpad(
    parent_scratchpad: PregelScratchpad | None,
    pending_writes: list[PendingWrite],
    task_id: str,
    namespace_hash: str,
    resume_map: dict[str, Any] | None,
    step: int,
    stop: int,
) -> PregelScratchpad:
    if len(pending_writes) > 0:
        # find global resume value
        for w in pending_writes:
            if w[0] == NULL_TASK_ID and w[1] == RESUME:
                null_resume_write = w
                break
        else:
            # None cannot be used as a resume value, because it would be difficult to
            # distinguish from missing when used over http
            null_resume_write = None

        # find task-specific resume value
        for w in pending_writes:
            if w[0] == task_id and w[1] == RESUME:
                task_resume_write = w[2]
                if not isinstance(task_resume_write, list):
                    task_resume_write = [task_resume_write]
                break
        else:
            task_resume_write = []
        del w

        # find namespace and task-specific resume value
        if resume_map and namespace_hash in resume_map:
            mapped_resume_write = resume_map[namespace_hash]
            task_resume_write.append(mapped_resume_write)

    else:
        null_resume_write = None
        task_resume_write = []

    def get_null_resume(consume: bool = False) -> Any:
        if null_resume_write is None:
            if parent_scratchpad is not None:
                return parent_scratchpad.get_null_resume(consume)
            return None
        if consume:
            try:
                pending_writes.remove(null_resume_write)
                return null_resume_write[2]
            except ValueError:
                return None
        return null_resume_write[2]

    # using itertools.count as an atomic counter (+= 1 is not thread-safe)
    return PregelScratchpad(
        step=step,
        stop=stop,
       # call
        call_counter=LazyAtomicCounter(),
        # interrupt
        interrupt_counter=LazyAtomicCounter(),
        resume=task_resume_write,
        get_null_resume=get_null_resume,
        # subgraph
        subgraph_counter=LazyAtomicCounter(),
    )

```

### 2.1 PendingWrite

`PendingWrite = tuple[str, str, Any]` 是三元组，分别表示
1. task_id: 任务 ID
2. channel: 通道名
3. value: 写入 channel 的值


### 2.2 LazyAtomicCounter
LazyAtomicCounter 是一个计数器。

```python
class LazyAtomicCounter:
    __slots__ = ("_counter",)

    _counter: Callable[[], int] | None

    def __init__(self) -> None:
        self._counter = None

    def __call__(self) -> int:
        if self._counter is None:
            with LAZY_ATOMIC_COUNTER_LOCK:
                if self._counter is None:
                    self._counter = itertools.count(0).__next__
        return self._counter()
```

## 3. PregelTask/PregelExecutableTask
prepare_single_task 用于生成 `PregelTask | PregelExecutableTask`。我们先来看看这两个对象的语义。

这两个类是 LangGraph 中 Pregel 模式调度系统的一部分，

`PregelTask`：任务的**执行记录（结果）**
* 用于描述某个 **节点任务的执行状态、结果或错误**。
* 通常在调度完成后用于追踪状态，支持错误处理、调试、回溯等。

`PregelExecutableTask`：任务的**调度单元（执行计划）**
* 表示一个准备被调度执行的任务单元，携带输入、处理器、配置、写入目标等信息。
* 通常在 `step_once()` 中被生成并传给执行逻辑。


| 类别   | `PregelExecutableTask` | `PregelTask`    |
| ---- | ---------------------- | --------------- |
| 角色   | 调度器要执行的“待办事项”          | 执行完毕后的“历史记录”    |
| 生命周期 | **前置结构**，被调度使用         | **后置结构**，保存运行结果 |
| 状态   | 尚未运行、正在执行              | 已运行，可能成功/失败     |


结合示意图帮助理解

```
[PregelExecutableTask] --- 调度执行 --> [PregelTask]
```

你可以理解为：

* `PregelExecutableTask` 是一个调度器打包好的“任务指令”，
* 执行完后，就转化为一个 `PregelTask`，记录执行历史（包含错误、返回值、状态等）。

### 3.1 PregelExecutableTask

```python
@dataclass(**_T_DC_KWARGS)
class PregelExecutableTask:
    name: str
    input: Any
    proc: Runnable
    writes: deque[tuple[str, Any]]
    config: RunnableConfig
    triggers: Sequence[str]
    retry_policy: Sequence[RetryPolicy]
    cache_key: CacheKey | None
    id: str
    path: tuple[str | int | tuple, ...]
    writers: Sequence[Runnable] = ()
    subgraphs: Sequence[PregelProtocol] = ()

class CacheKey(NamedTuple):
    """Cache key for a task."""

    ns: tuple[str, ...]
    """Namespace for the cache entry."""
    key: str
    """Key for the cache entry."""
    ttl: int | None
    """Time to live for the cache entry in seconds."""
```

| 属性名            | 类型                         | 默认值    | 含义                    |                |            |
| -------------- | -------------------------- | ------ | --------------------- | -------------- | ---------- |
| `name`         | `str`                      | 无      | 节点名称                  |                |            |
| `input`        | `Any`                      | 无      | 输入数据                  |                |            |
| `proc`         | `Runnable`                 | 无      | 节点的执行体（一个 LCEL 节点）    |                |            |
| `writes`       | `deque[tuple[str, Any]]`   | 无      | 预期要写入的通道与对应值          |                |            |
| `config`       | `RunnableConfig`           | 无      | 当前任务的配置上下文            |                |            |
| `triggers`     | `Sequence[str]`            | 无      | 激活当前节点的依赖 key（谁触发了它）  |                |            |
| `retry_policy` | `Sequence[RetryPolicy]`    | 无      | 重试策略定义                |                |            |
| `cache_key`    | \`CacheKey                 | None\` | `None`                | 用于缓存查找与存储的 key |            |
| `id`           | `str`                      | 无      | 任务的唯一标识符              |                |            |
| `path`         | \`tuple\[str               | int    | tuple, ...]\`         | 无              | 节点在图中的路径标识 |
| `writers`      | `Sequence[Runnable]`       | `()`   | 输出写入副作用处理器（如写入 store） |                |            |
| `subgraphs`    | `Sequence[PregelProtocol]` | `()`   | 嵌套的子图列表（用于子流程）        |                |            |


### 3.2 PregelTask

```python
class PregelTask(NamedTuple):
    """A Pregel task."""

    id: str
    name: str
    path: tuple[str | int | tuple, ...]
    error: Exception | None = None
    interrupts: tuple[Interrupt, ...] = ()
    state: None | RunnableConfig | StateSnapshot = None
    result: Any | None = None
```

| 属性名          | 类型                      | 默认值            | 含义              |                 |               |
| ------------ | ----------------------- | -------------- | --------------- | --------------- | ------------- |
| `id`         | `str`                   | 无              | 任务的唯一标识符        |                 |               |
| `name`       | `str`                   | 无              | 节点名称（或任务名称）     |                 |               |
| `path`       | \`tuple\[str            | int            | tuple, ...]\`   | 无               | 节点在嵌套子图中的定位路径 |
| `error`      | \`Exception             | None\`         | `None`          | 执行中出现的异常（如果有）   |               |
| `interrupts` | `tuple[Interrupt, ...]` | `()`           | 中断信息（如取消信号）     |                 |               |
| `state`      | \`None                  | RunnableConfig | StateSnapshot\` | `None`          | 执行时的状态或快照     |
| `result`     | \`Any                   | None\`         | `None`          | 节点运行后的返回结果（成功时） |               |

### 3.3 StateSnapshot

```python
class StateSnapshot(NamedTuple):
    """Snapshot of the state of the graph at the beginning of a step."""

    values: dict[str, Any] | Any
    """Current values of channels."""
    next: tuple[str, ...]
    """The name of the node to execute in each task for this step."""
    config: RunnableConfig
    """Config used to fetch this snapshot."""
    metadata: CheckpointMetadata | None
    """Metadata associated with this snapshot."""
    created_at: str | None
    """Timestamp of snapshot creation."""
    parent_config: RunnableConfig | None
    """Config used to fetch the parent snapshot, if any."""
    tasks: tuple[PregelTask, ...]
    """Tasks to execute in this step. If already attempted, may contain an error."""
    interrupts: tuple[Interrupt, ...]
    """Interrupts that occurred in this step that are pending resolution."""
```

StateSnapshot 是 LangGraph 中的一个核心数据结构，用于表示图执行过程中的某个 step 开始前的完整状态快照。可以理解为：PregelLoop 即将执行某一 step 之前，把此时的图状态、输入值、调度计划等打包成一个快照，命名为 StateSnapshot。

| 属性名             | 类型                           | 含义                           |
| --------------- | ---------------------------- | ---------------------------- |
| `values`        | `dict[str, Any] \| Any`      | 图中所有 channel 当前的值（可为字典或原始结构） |
| `next`          | `tuple[str, ...]`            | 当前 step 中需要调度执行的节点名称         |
| `config`        | `RunnableConfig`             | 当前快照对应的运行配置（含 tags、metadata） |
| `metadata`      | `CheckpointMetadata \| None` | 与该快照绑定的 checkpoint 元数据       |
| `created_at`    | `str \| None`                | 快照创建时间（通常是 ISO 时间戳）          |
| `parent_config` | `RunnableConfig \| None`     | 上一个快照所用的配置（用于回溯 parent）      |
| `tasks`         | `tuple[PregelTask, ...]`     | 本 step 要执行的任务（含执行状态、错误等）     |
| `interrupts`    | `tuple[Interrupt, ...]`      | 此 step 中触发的中断事件（如用户取消）       |


StateSnapshot 的使用场景

| 场景         | 用途                         |
| ---------- | -------------------------- |
| **检查点存储**  | 可持久化保存每一步状态用于恢复            |
| **调试与追踪**  | 可以记录每一步执行了哪些任务，出了什么错       |
| **调度分支判断** | `next` 属性用于决定本 step 执行哪些节点 |
| **中断与恢复**  | `interrupts` 表明是否有异常/终止操作  |

### 3.4 Interrupt

```python
@final
@dataclass(init=False, **_DC_SLOTS)
class Interrupt:
    """Information about an interrupt that occurred in a node.

    !!! version-added "Added in version 0.2.24."

    !!! version-changed "Changed in version v0.4.0"
        * `interrupt_id` was introduced as a property

    !!! version-changed "Changed in version v0.6.0"

        The following attributes have been removed:

        * `ns`
        * `when`
        * `resumable`
        * `interrupt_id`, deprecated in favor of `id`
    """

    value: Any
    """The value associated with the interrupt."""

    id: str
    """The ID of the interrupt. Can be used to resume the interrupt directly."""

    def __init__(
        self,
        value: Any,
        id: str = _DEFAULT_INTERRUPT_ID,
        **deprecated_kwargs: Unpack[DeprecatedKwargs],
    ) -> None:
        self.value = value

        if (
            (ns := deprecated_kwargs.get("ns", MISSING)) is not MISSING
            and (id == _DEFAULT_INTERRUPT_ID)
            and (isinstance(ns, Sequence))
        ):
            self.id = xxh3_128_hexdigest("|".join(ns).encode())
        else:
            self.id = id

    @classmethod
    def from_ns(cls, value: Any, ns: str) -> Interrupt:
        return cls(value=value, id=xxh3_128_hexdigest(ns.encode()))

    @property
    @deprecated(
        "`interrupt_id` is deprecated. Use `id` instead.",
        stacklevel=2,
    )
    def interrupt_id(self) -> str:
        warn(
            "`interrupt_id` is deprecated. Use `id` instead.",
            LangGraphDeprecatedSinceV10,
            stacklevel=2,
        )
        return self.id

```

`Interrupt` 是 LangGraph 中用于表示 **节点中断事件** 的类。它用于在图执行过程中标识：

* 某个节点**被人为或逻辑上中断**（例如：用户取消、外部事件打断）
* 中断携带的值（`value`），以及唯一标识符（`id`）
* 可以**挂起**执行状态，稍后通过 `id` 恢复

---

#### 类定义语义解释

```python
@final
@dataclass(init=False, **_DC_SLOTS)
class Interrupt:
```

* 使用 `@final` 修饰，表示此类不可被继承
* 使用 `dataclass(init=False)`，但自己手动定义了 `__init__`
* 使用了 **slots 优化** 内存布局
* 设计上是一个不可变的、结构明确的中断信号容器

---

#### 类的主要作用

> **`Interrupt` 表示图运行中某个节点发生了中断的事件，并且提供恢复用的唯一 ID 以支持 resume。**

这种机制通常用于支持：

* ✅ 异步流程中途暂停（如等待用户输入）
* ✅ 人工干预打断节点执行
* ✅ 状态持久化并可恢复（checkpoint + resume）

---

#### `Interrupt` 的属性说明

| 属性名     | 类型    | 默认值                     | 含义                                         |
| ------- | ----- | ----------------------- | ------------------------------------------ |
| `value` | `Any` | 无（构造时提供）                | 中断事件携带的值，例如中断原因、状态等                        |
| `id`    | `str` | `_DEFAULT_INTERRUPT_ID` | 中断的唯一标识，用于 resume（可通过 namespace hash 自动生成） |

---

#### 方法和属性说明

| 名称             | 类型               | 说明                                  |
| -------------- | ---------------- | ----------------------------------- |
| `__init__`     | 构造方法             | 支持 `ns` 参数，用于根据命名空间生成 ID（兼容老版本）     |
| `from_ns`      | `classmethod`    | 从字符串命名空间构造中断对象（自动生成 ID）             |
| `interrupt_id` | `@property`（已弃用） | 兼容旧版本的 `interrupt_id` 字段，现推荐使用 `id` |

### 3.5 Call
这个 Call 类表示一次函数调用的封装，其语义是在一个可控环境中（带有重试策略、缓存策略和回调函数）调用一个函数 func，并记录传入的输入参数。

```python
Callbacks = Optional[Union[list[BaseCallbackHandler], BaseCallbackManager]]

class Call:
    __slots__ = ("func", "input", "retry_policy", "cache_policy", "callbacks")

    func: Callable
    input: tuple[tuple[Any, ...], dict[str, Any]]
    retry_policy: Sequence[RetryPolicy] | None
    cache_policy: CachePolicy | None
    callbacks: Callbacks

    def __init__(
        self,
        func: Callable,
        input: tuple[tuple[Any, ...], dict[str, Any]],
        *,
        retry_policy: Sequence[RetryPolicy] | None,
        cache_policy: CachePolicy | None,
        callbacks: Callbacks,
    ) -> None:
        self.func = func
        self.input = input
        self.retry_policy = retry_policy
        self.cache_policy = cache_policy
        self.callbacks = callbacks
```


| 属性名            | 类型                                       | 说明                                    |                       |
| -------------- | ---------------------------------------- | ------------------------------------- | --------------------- |
| `func`         | `Callable`                               | 要执行的目标函数（可调用对象）                       |                       |
| `input`        | `tuple[tuple[Any, ...], dict[str, Any]]` | 传递给函数的位置参数和关键字参数，形式如 `(args, kwargs)` |                       |
| `retry_policy` | \`Sequence\[RetryPolicy]                 | None\`                                | 用于控制函数失败后的重试逻辑策略列表，可选 |
| `cache_policy` | \`CachePolicy                            | None\`                                | 控制函数调用结果是否缓存，以及缓存策略   |
| `callbacks`    | `Callbacks`                              | 函数调用过程中的回调钩子，如执行前、执行后、失败时等            |                       |


## 4. prepare_single_task
prepare_single_task 代码非常长，我们先用 ChatGpt 给我们讲解一下它的代码。

这段函数做了三类任务的准备逻辑：**PUSH**、**PUSH + Call**、和 **PULL**。我会为你分模块讲清楚，并标注重点。

---

### 4.1 🔧 函数功能简述

```python
def prepare_single_task(task_path, ..., for_execution, ...) -> PregelTask | PregelExecutableTask | None:
```

这个函数会根据当前的任务路径 `task_path`：

* 构造一个任务 ID 和 checkpoint 命名空间
* 创建运行所需的环境配置和上下文（configurable, scratchpad, runtime, etc.）
* 判断是否要**立即执行（for_execution=True）**，若是则构造 `PregelExecutableTask`，否则只返回轻量级的 `PregelTask`

---

#### 📦 参数说明（选主要的讲）
```python
def prepare_single_task(
    task_path: tuple[Any, ...],
    task_id_checksum: str | None,
    *,
    checkpoint: Checkpoint,
    checkpoint_id_bytes: bytes,
    checkpoint_null_version: V | None,
    pending_writes: list[PendingWrite],
    processes: Mapping[str, PregelNode],
    channels: Mapping[str, BaseChannel],
    managed: ManagedValueMapping,
    config: RunnableConfig,
    step: int,
    stop: int,
    for_execution: bool,
    store: BaseStore | None = None,
    checkpointer: BaseCheckpointSaver | None = None,
    manager: None | ParentRunManager | AsyncParentRunManager = None,
    input_cache: dict[INPUT_CACHE_KEY_TYPE, Any] | None = None,
    cache_policy: CachePolicy | None = None,
    retry_policy: Sequence[RetryPolicy] = (),
) -> None | PregelTask | PregelExecutableTask:
    pass
```

下面是 `prepare_single_task` 函数的参数列表，按照功能归类

任务标识相关参数

| 参数名                | 类型                | 说明                            |
| ------------------ | ----------------- | ----------------------------- |
| `task_path`        | `tuple[Any, ...]` | 当前任务路径（决定任务类型，如 PUSH / PULL）  |
| `task_id_checksum` | `str \| None`     | 任务 ID 的校验用 checksum，用于构造唯一 ID |
| `step`             | `int`             | 当前执行步数                        |
| `stop`             | `int`             | 最大允许执行步数                      |

图状态 & Checkpoint 相关

| 参数名                       | 类型           | 说明                      |
| ------------------------- | ------------ | ----------------------- |
| `checkpoint`              | `Checkpoint` | 当前图的检查点，包含状态和快照信息       |
| `checkpoint_id_bytes`     | `bytes`      | 当前检查点 ID 的二进制形式（用于唯一标识） |
| `checkpoint_null_version` | `V \| None`  | 当前检查点的初始版本，通常用于判定是否为新状态 |

节点、通道、输入输出相关

| 参数名              | 类型                          | 说明                           |
| ---------------- | --------------------------- | ---------------------------- |
| `processes`      | `Mapping[str, PregelNode]`  | 图中所有节点定义（name -> PregelNode） |
| `channels`       | `Mapping[str, BaseChannel]` | 通道名称与通道实例映射                  |
| `managed`        | `ManagedValueMapping`       | 由调度器托管的中间值/变量映射              |
| `pending_writes` | `list[PendingWrite]`        | 上一步产生的、尚未提交的写入数据             |

运行配置 & 控制器

| 参数名             | 类型                                                  | 说明                                         |
| --------------- | --------------------------------------------------- | ------------------------------------------ |
| `config`        | `RunnableConfig`                                    | 当前任务的执行配置（可传递 tracing / tags / handlers 等） |
| `for_execution` | `bool`                                              | 是否立即执行任务（返回 ExecutableTask），否则仅调度（Task）    |
| `manager`       | `ParentRunManager \| AsyncParentRunManager \| None` | 上层运行管理器（用于 tracing / callbacks）            |

缓存、存储、持久化策略

| 参数名            | 类型                                        | 说明                 |
| -------------- | ----------------------------------------- | ------------------ |
| `store`        | `BaseStore \| None`                       | 可选的数据存储器，用于通道状态保存  |
| `checkpointer` | `BaseCheckpointSaver \| None`             | 持久化 checkpoint 的组件 |
| `input_cache`  | `dict[INPUT_CACHE_KEY_TYPE, Any] \| None` | 输入缓存，用于避免重复执行      |
| `cache_policy` | `CachePolicy \| None`                     | 缓存策略定义             |
| `retry_policy` | `Sequence[RetryPolicy]`                   | 失败任务的重试策略          |



#### 📌 一、PUSH + Call 类型任务（触发子调用的节点）

```python
if task_path[0] == PUSH and isinstance(task_path[-1], Call):
```

这一分支处理的任务格式是：

```python
(PUSH, parent_path, write_index, parent_id, Call)
```

* 从 `Call` 对象中提取执行函数 `call.func` 和输入 `call.input`
* 生成任务 ID（依赖 `step`, `name`, `parent_path`, `index` 等）
* 构造 `task_checkpoint_ns` 表示命名空间
* 若 `for_execution=True`：

  * 创建 `writes` 队列用于记录写入
  * 创建 `scratchpad`（运行时中间缓存）
  * 构造 `PregelExecutableTask`，注入读取通道、发送、checkpointer 等能力
* 否则返回轻量版 `PregelTask`

📎 **重点概念：**

* PUSH 表示主动写入
* Call 是 graph 中的函数调用型节点
* scratchpad 是该任务的“局部内存”，用于跨读写传递数据

---

#### 📌 二、普通 PUSH 类型任务（Send）

```python
elif task_path[0] == PUSH:
```

这一分支处理的是 `Send` 类型任务，来源于通道的 `pending sends`。

* 从 `channels[TASKS]` 中取出 `Send` 对象（packet）
* 根据 packet 构造目标节点 `proc`、任务 ID、checkpoint 命名空间
* 若 `for_execution=True`：

  * 构造 `writes`, `scratchpad`, `cache_key`
  * 包装为 `PregelExecutableTask`
* 否则返回 `PregelTask`

📎 **重点：**

* `Send` 是其他节点写入 TASKS 通道的指令
* 这个处理类似“中转调度”行为

---

#### 📌 三、PULL 类型任务（被动响应触发）

```python
elif task_path[0] == PULL:
```

这一类任务是**由通道变更自动触发的节点**

* 触发逻辑：检测自己监听的通道是否变化（\_triggers）
* 构造任务 ID 和 checkpoint 命名空间
* 构建输入（`val`）和上下文
* 若 for\_execution 为 True：

  * 构建写入、读取能力、scratchpad 等，注入 `PregelExecutableTask`
* 否则返回 `PregelTask`

📎 **重点概念：**

* PULL 表示节点等待输入变化触发
* 与数据依赖绑定，常用于数据流反应式执行

---

#### ✅ 总结关键逻辑流程图（简化）

```
          task_path
              ↓
    ┌───────────────┬───────────────┬───────────────┐
    │   PUSH + Call │     PUSH      │     PULL      │
    └──────┬────────┴──────┬────────┴──────┬────────┘
           │               │               │
     创建task_id       从Send中取值       检查channel变化
           │               │               │
       构造Call         找到目标proc       构建输入值
           │               │               │
       构建Metadata     构建Metadata     构建Metadata
           │               │               │
      PregelTask或     PregelTask或     PregelTask或
   PregelExecutableTask PregelExecutableTask PregelExecutableTask
```

