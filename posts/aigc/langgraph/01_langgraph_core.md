---
weight: 1
title: "langgraph 的核心对象"
date: 2025-08-01T8:00:00+08:00
lastmod: 2025-08-01T8:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langgraph 的核心对象"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

这一节开始我们开始学习 Langgraph 的源码。

## 1. Pregel

通过 Langgraph API 了解到 Langgraph 的运行时由 Pregel 实现。所以我们直接来看 Pregel 的定义:

注: 我先尝试从 UML 类图挖掘 Langgraph 里的核心对象，但是效果并不明显。

```python
class Pregel(
    PregelProtocol[StateT, ContextT, InputT, OutputT],
    Generic[StateT, ContextT, InputT, OutputT],
):
    nodes: dict[str, PregelNode]

    channels: dict[str, BaseChannel | ManagedValueSpec]

    stream_mode: StreamMode = "values"
    """Mode to stream output, defaults to 'values'."""

    stream_eager: bool = False
    """Whether to force emitting stream events eagerly, automatically turned on
    for stream_mode "messages" and "custom"."""

    output_channels: str | Sequence[str]

    stream_channels: str | Sequence[str] | None = None
    """Channels to stream, defaults to all channels not in reserved channels"""

    interrupt_after_nodes: All | Sequence[str]

    interrupt_before_nodes: All | Sequence[str]

    input_channels: str | Sequence[str]

    step_timeout: float | None = None
    """Maximum time to wait for a step to complete, in seconds. Defaults to None."""

    debug: bool
    """Whether to print debug information during execution. Defaults to False."""

    checkpointer: Checkpointer = None
    """Checkpointer used to save and load graph state. Defaults to None."""

    store: BaseStore | None = None
    """Memory store to use for SharedValues. Defaults to None."""

    cache: BaseCache | None = None
    """Cache to use for storing node results. Defaults to None."""

    retry_policy: Sequence[RetryPolicy] = ()
    """Retry policies to use when running tasks. Empty set disables retries."""

    cache_policy: CachePolicy | None = None
    """Cache policy to use for all nodes. Can be overridden by individual nodes.
    Defaults to None."""

    context_schema: type[ContextT] | None = None
    """Specifies the schema for the context object that will be passed to the workflow."""

    config: RunnableConfig | None = None

    name: str = "LangGraph"

    trigger_to_nodes: Mapping[str, Sequence[str]]

```

| 属性名                      | 类型                                                 | 说明                                  | 默认值                              |
| ------------------------ | -------------------------------------------------- | ----------------------------------- | -------------------------------- |
| `nodes`                  | `dict[str, PregelNode]`                            | 图中的节点集合，键为节点名，值为对应节点对象              | 无默认值（必须提供）                       |
| `channels`               | `dict[str, BaseChannel \| ManagedValueSpec]`       | 所有定义的通道，包括状态传递通道、值通道等               | 无默认值                             |
| `stream_mode`            | `StreamMode`（如 `"values"`、`"messages"`、`"custom"`） | 控制流的输出流模式                           | `"values"`                       |
| `stream_eager`           | `bool`                                             | 是否立即输出事件流（如 trace、消息）。部分模式下自动为 True | `False`                          |
| `output_channels`        | `str \| Sequence[str]`                             | 输出数据写入的目标通道                         | 无默认值                             |
| `stream_channels`        | `str \| Sequence[str] \| None`                     | 哪些通道的值将被流式输出（如果未指定，则为所有非保留通道）       | `None`                           |
| `interrupt_after_nodes`  | `All \| Sequence[str]`                             | 指定在哪些节点之后中断执行（可用于调试）                | 无默认值                             |
| `interrupt_before_nodes` | `All \| Sequence[str]`                             | 指定在哪些节点之前中断执行（可用于调试）                | 无默认值                             |
| `input_channels`         | `str \| Sequence[str]`                             | 接收输入的通道名称                           | 无默认值                             |
| `step_timeout`           | `float \| None`                                    | 每一步最大等待时间（秒），防止阻塞                   | `None`                           |
| `debug`                  | `bool`                                             | 是否打印调试信息                            | 默认 `False`（源码中未指定默认但文档描述为 False） |
| `checkpointer`           | `Checkpointer \| None`                             | 用于保存和恢复图状态的检查点管理器                   | `None`                           |
| `store`                  | `BaseStore \| None`                                | 用于持久化共享值（SharedValues）的存储后端         | `None`                           |
| `cache`                  | `BaseCache \| None`                                | 用于节点结果缓存的缓存后端                       | `None`                           |
| `retry_policy`           | `Sequence[RetryPolicy]`                            | 节点执行失败时的重试策略，空序列表示不重试               | `()`（空元组）                        |
| `cache_policy`           | `CachePolicy \| None`                              | 所有节点通用的缓存策略，可被单节点覆盖                 | `None`                           |
| `context_schema`         | `type[ContextT] \| None`                           | `context` 对象的类型，用于强类型验证             | `None`                           |
| `config`                 | `RunnableConfig \| None`                           | 运行配置（用于 tracing、callback 等）         | `None`                           |
| `name`                   | `str`                                              | 图的名称                                | `"LangGraph"`                    |
| `trigger_to_nodes`       | `Mapping[str, Sequence[str]]`                      | 定义触发器到节点的映射（如外部事件触发哪些节点）            | 无默认值                             |


## 2. 核心对象的语义

从 Pregel 类的定义中，我们可以看到以下核心对象:
1. PregelProtocol
2. PregelNode
3. BaseChannel
4. ManagedValueSpec
5. Checkpointer
6. BaseStore
7. BaseCache

我们直接问 ChatGpt 这些对象的语义。

```bash
我正在学习 Langgraph的源码，我注意到 Pregel 的类中包含了如下对象:

1. PregelProtocol
2. PregelNode
3. BaseChannel
4. ManagedValueSpec
5. Checkpointer
6. BaseStore
7. BaseCache

请给我从语义上解释一下这些类的作用
```

非常好，你正在研究 `LangGraph` 的源码，而你列出的这些类和抽象正是理解 `Pregel` 执行模型的核心部分。下面我会从**语义上**解释每个对象的本质作用（而不是机械描述类型），帮助你构建概念体系。

---

### 1. **`PregelProtocol`**

> ✅ 定义 `Pregel` 图必须遵循的「执行协议」的接口。

* **语义作用**：规定 Pregel 图必须实现哪些方法、输入输出格式、如何启动执行等。
* **类比**：这是 Pregel 引擎对外暴露的“行为合同”，类似于 `Runnable` 接口。
* **用途**：

  * 支持类型检查、静态检查。
  * 定义泛型参数（状态类型、输入/输出、上下文类型等）。

---

### 2. **`PregelNode`**

> ✅ 图中每一个节点（Node）都必须是 `PregelNode`，它是图的基本组成单元。

* **语义作用**：封装一段逻辑单元（如调用 LLM、函数、工具等），定义其输入输出和执行规则。
* **职责**：

  * 执行计算。
  * 接收状态并产生新的状态片段。
* **种类**：

  * `FunctionNode`：包装任意 Python 函数。
  * `AgentNode`：包装一个 agent。
  * `EndNode`：标记流程结束。

---

### 3. **`BaseChannel`**

> ✅ 表示「状态通道」或「消息传输通道」的抽象，节点之间靠它通信。

* **语义作用**：在节点之间传输状态、值、消息的管道（可缓存、可共享、可绑定到变量名）。
* **用途**：

  * 将状态从一个节点传递给另一个节点。
  * 可以是只读、只写、缓存等不同形式。
* **类比**：Actor 模型中的“邮箱”，或者数据流编程中的“流”。

---

### 4. **`ManagedValueSpec`**

> ✅ 表示由系统**自动管理的值通道**（如共享值、缓存值、历史状态等）的规范。

* **语义作用**：告诉 Pregel 引擎“这里的值不需要你显式传递，我来管理它的生命周期”。
* **典型用途**：

  * 用于实现 `SharedValue`。
  * 用于缓存节点执行结果或共享全局上下文。
* **类比**：像是 Graph 的内置数据库变量，你声明它，系统帮你持久化和注入。

---

### 5. **`Checkpointer`**

> ✅ Pregel 的「状态保存器」，用于将整个图的运行状态进行 checkpoint（断点存储）。

* **语义作用**：在流程中持久化执行进度，使得可以恢复中断或支持长时间运行。
* **常见用途**：

  * 容错恢复。
  * 长任务断点续跑。
* **类比**：像浏览器的 session store，或深度学习训练中的 model checkpoint。

---

### 6. **`BaseStore`**

> ✅ LangGraph 中的通用「值存储后端」接口。

* **语义作用**：用于 SharedValues、缓存、持久化状态等的一致存储接口。
* **可能实现**：

  * 内存存储（用于测试）
  * Redis
  * S3
* **类比**：是系统内部所有需要“写入/读取值”的地方依赖的统一抽象。

---

### 7. **`BaseCache`**

> ✅ 节点级别的缓存系统，避免重复计算。

* **语义作用**：为每个节点结果提供缓存策略，允许跳过重复计算。
* **工作机制**：

  * 根据输入 hash 生成 cache key。
  * 命中则直接返回缓存结果。
* **类比**：像函数 memoization（记忆化）或分布式系统中的结果缓存。

---

### 总结对照表

| 类名                 | 语义角色      | 类比 / 本质            |
| ------------------ | --------- | ------------------ |
| `PregelProtocol`   | 行为契约接口    | `Runnable`/协议      |
| `PregelNode`       | 执行单元      | 图中的“函数”            |
| `BaseChannel`      | 状态/消息传输通道 | 数据流通道、邮箱           |
| `ManagedValueSpec` | 系统托管值描述   | 全局变量说明             |
| `Checkpointer`     | 执行状态快照保存器 | 断点保存器              |
| `BaseStore`        | 通用键值存储后端  | KV 数据库接口           |
| `BaseCache`        | 节点执行缓存    | 函数缓存 / memoization |

---

对这些对象有了基本的理解之后，我们吸取前面阅读 Langgraph 源码的教训。最开始就列出所有对象的抽象层次。方便我们看源码时理清对象之间的调用关系和调用链。

## 3. PregelProtocol

PregelProtocol 是一个抽象基类，定义了如下接口:

| 方法名                  | 作用描述                       | 返回类型                                   |
| -------------------- | -------------------------- | -------------------------------------- |
| `with_config`        | 克隆当前图实例，附加运行时配置（如 tracing） | `Self`                                 |
| `get_graph`          | 返回可视化图对象（同步）               | `DrawableGraph`                        |
| `aget_graph`         | 返回可视化图对象（异步）               | `DrawableGraph`                        |
| `get_state`          | 获取执行中或已执行任务的当前状态快照（同步）     | `StateSnapshot`                        |
| `aget_state`         | 获取状态快照（异步）                 | `StateSnapshot`                        |
| `get_state_history`  | 获取状态变更的历史记录（同步）            | `Iterator[StateSnapshot]`              |
| `aget_state_history` | 获取状态变更历史（异步）               | `AsyncIterator[StateSnapshot]`         |
| `bulk_update_state`  | 批量写入多个节点的状态变更（同步）          | `RunnableConfig`                       |
| `abulk_update_state` | 批量更新状态（异步）                 | `RunnableConfig`                       |
| `update_state`       | 单次更新状态（同步），如写入中间变量或全局值     | `RunnableConfig`                       |
| `aupdate_state`      | 异步更新状态                     | `RunnableConfig`                       |
| `stream`             | 执行图并以迭代器返回中间输出（同步流式）       | `Iterator[dict[str, Any] \| Any]`      |
| `astream`            | 异步流式执行图                    | `AsyncIterator[dict[str, Any] \| Any]` |
| `invoke`             | 同步执行图（阻塞直到完成），返回最终输出       | `dict[str, Any] \| Any`                |
| `ainvoke`            | 异步执行图，返回最终输出               | `dict[str, Any] \| Any`                |

## 4. PregelNode

PregeNode 表示图中的节点，它的定义如下:

```python
class PregelNode:
    """A node in a Pregel graph. This won't be invoked as a runnable by the graph
    itself, but instead acts as a container for the components necessary to make
    a PregelExecutableTask for a node."""

    channels: str | list[str]
    """The channels that will be passed as input to `bound`.
    If a str, the node will be invoked with its value if it isn't empty.
    If a list, the node will be invoked with a dict of those channels' values."""

    triggers: list[str]
    """If any of these channels is written to, this node will be triggered in
    the next step."""

    mapper: Callable[[Any], Any] | None
    """A function to transform the input before passing it to `bound`."""

    writers: list[Runnable]
    """A list of writers that will be executed after `bound`, responsible for
    taking the output of `bound` and writing it to the appropriate channels."""

    bound: Runnable[Any, Any]
    """The main logic of the node. This will be invoked with the input from 
    `channels`."""

    retry_policy: Sequence[RetryPolicy] | None
    """The retry policies to use when invoking the node."""

    cache_policy: CachePolicy | None
    """The cache policy to use when invoking the node."""

    tags: Sequence[str] | None
    """Tags to attach to the node for tracing."""

    metadata: Mapping[str, Any] | None
    """Metadata to attach to the node for tracing."""

    subgraphs: Sequence[PregelProtocol]
    """Subgraphs used by the node."""
```

### 4.1 属性
提问: 下面是 PregelNode 的定义，请以表格的形式列出每个方法名、作用、输出值类型


| 属性名            | 类型                              | 语义作用                                  | 使用场景 / 示例                                                 |
| -------------- | ------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| `channels`     | `str \| list[str]`              | 输入通道名称（单个或多个）。决定从哪些通道读取输入并传给 `bound`。 | `channels="user_input"` 或 `channels=["query", "history"]` |
| `triggers`     | `list[str]`                     | 当这些通道被写入时，当前节点在下一轮中被激活执行。             | 通常用来响应其他节点的输出或外部信号                                        |
| `mapper`       | `Callable[[Any], Any] \| None`  | 在传给 `bound` 之前对输入值进行转换或预处理。           | 如将多个输入组合成特定格式                                             |
| `writers`      | `list[Runnable]`                | 在节点计算完成后，接管输出结果并写入对应通道。可自定义写入行为。      | 比如将 `bound` 的输出写入到多个通道                                    |
| `bound`        | `Runnable[Any, Any]`            | 节点的核心执行逻辑，会接收来自 `channels` 的输入并返回输出。  | 可以是函数、链、LLM 调用等                                           |
| `retry_policy` | `Sequence[RetryPolicy] \| None` | 节点执行失败时的重试策略。支持如指数退避、最大次数等。           | 提高健壮性，处理临时失败                                              |
| `cache_policy` | `CachePolicy \| None`           | 节点的缓存策略。用于跳过相同输入的重复执行。                | 性能优化，节省 LLM token 或 API 请求                                |
| `tags`         | `Sequence[str] \| None`         | 附加在节点上的标记，用于 tracing、debug、日志等用途。     | 如 `["llm", "retriever"]`                                  |
| `metadata`     | `Mapping[str, Any] \| None`     | 附加在节点上的任意键值对信息，用于 tracing 或运行时识别。     | 比如记录节点版本、模型 ID                                            |
| `subgraphs`    | `Sequence[PregelProtocol]`      | 嵌套图，表示该节点内部可递归执行子图。                   | 实现复杂控制流或组件级封装                                             |

### 4.2 方法
PregelNode 没有定义抽象方法，这是我们需要最先关注的对象。

## 5. channel
channel 表示节点之间的数据传输管道，有点类似 golang 中的 channel。BaseChannel 是一个抽象基类。下面是 channel 的 UML 类图:

![channel 类图](/images/langgraph/channel.svg)


### 5.1 BaseChannel 定义的接口

```python
class BaseChannel(Generic[Value, Update, Checkpoint], ABC):
    """Base class for all channels."""

    __slots__ = ("key", "typ")

    # 完整代码省略
```

提问: 上面是 BaseChannel 定义的接口，请以表格的形式列出每个方法名、作用、输出值类型

| 方法名                           | 返回类型                | 作用描述                                                   |
| ----------------------------- | ------------------- | ------------------------------------------------------ |
| `ValueType`                   | `Any`               | 声明通道中存储的值的类型（抽象属性）                                     |
| `UpdateType`                  | `Any`               | 声明可以写入通道的更新类型（抽象属性）                                    |
| `copy()`                      | `Self`              | 返回当前通道的副本，默认基于 `checkpoint()` 和 `from_checkpoint()` 实现 |
| `checkpoint()`                | `Checkpoint \| Any` | 返回通道当前状态的可序列化快照；如通道为空则返回 `MISSING`                     |
| `from_checkpoint(checkpoint)` | `Self`              | 基于 checkpoint 创建一个新的相同通道实例（抽象方法）                       |
| `get()`                       | `Value`             | 读取当前通道的值，若尚未写入则抛出 `EmptyChannelError`（抽象方法）            |
| `is_available()`              | `bool`              | 判断当前通道是否已有值，默认通过调用 `get()` 实现                          |
| `update(values)`              | `bool`              | 使用给定的一组更新更新通道状态，返回是否发生变化（抽象方法）                         |
| `consume()`                   | `bool`              | 表示某个任务已经使用了此通道的值，默认无操作；用于控制消费行为                        |
| `finish()`                    | `bool`              | 表示整个图执行即将结束，通道可据此清理或更改状态，默认无操作                         |

### 5.2 channel 子类
```bash
# 提问
我注意到 langgraph.channels 定义了如下 BaseChannel 的子类，请以表格的形式说明每个子类的语义
any_value.AnyValue
base.BaseChannel
binop.BinaryOperatorAggregate
ephemeral_value.EphemeralValue
last_value.LastValue
last_value.LastValueAfterFinish
named_barrier_value.NamedBarrierValue
named_barrier_value.NamedBarrierValueAfterFinish
topic.Topic
untracked_value.UntrackedValue
```

你列举的这些 `BaseChannel` 子类都定义在 `langgraph.channels` 模块中，它们代表了 LangGraph 中各种**状态通道的语义模型**。每个子类都实现了不同的「值存储」与「更新行为」，用于支持不同的图执行策略，如缓存、流式、聚合、同步屏障等。

以下是这些子类的**语义说明表**：

---

#### ✅ `BaseChannel` 子类语义一览表

| 子类名                            | 核心语义                        | 特点 / 使用场景                  |
| ------------------------------ | --------------------------- | -------------------------- |
| `AnyValue`                     | 存储任意值，无聚合、无验证               | 最通用的通道，适用于默认存储单值场景         |
| `BinaryOperatorAggregate`      | 使用二元操作聚合多个更新为单个值            | 适用于数值求和、列表合并等场景（如 `x + y`） |
| `EphemeralValue`               | 值仅在一次任务中可见，用后即焚             | 适用于临时中间变量，不参与状态快照          |
| `LastValue`                    | 始终保留最近一次写入的值（覆盖写）           | 常用于最新状态存储，如最终响应、变量覆盖       |
| `LastValueAfterFinish`         | 与 `LastValue` 类似，但仅在图结束时才可见 | 用于隐藏中间状态，只暴露最终结果           |
| `NamedBarrierValue`            | 所有指定 writers 写入后，才可读取       | 多个节点同步的“屏障”，用于协调依赖         |
| `NamedBarrierValueAfterFinish` | 与上类似，但只在图执行完后暴露             | 延迟暴露聚合值（如日志、结果统计）          |
| `Topic`                        | 发布/订阅消息通道，支持消息广播            | 多节点触发、多输出场景（如事件流）          |
| `UntrackedValue`               | 值可读写，但不会被记录进状态快照            | 适用于只用于推理、不希望持久化的中间值        |

---

#### 📌 各类通道的使用对比（按行为划分）

| 分类         | 子类名                                                    | 特征                   |
| ---------- | ------------------------------------------------------ | -------------------- |
| **单值通道**   | `AnyValue`, `LastValue`                                | 存储最近一次写入             |
| **聚合通道**   | `BinaryOperatorAggregate`, `NamedBarrierValue`         | 多值合并或协调              |
| **只读一次**   | `EphemeralValue`, `UntrackedValue`                     | 用完即失，不记录状态           |
| **最终值通道**  | `LastValueAfterFinish`, `NamedBarrierValueAfterFinish` | 仅在流程结束后暴露            |
| **事件广播通道** | `Topic`                                                | 多订阅者触发，适合多节点 fan-out |

---

#### 🧠 实用示例举例

| 场景                | 建议使用通道                    |
| ----------------- | ------------------------- |
| 保存用户输入并更新状态       | `LastValue`               |
| 聚合多个节点输出为一个结果     | `BinaryOperatorAggregate` |
| 节点 A、B 都完成后触发节点 C | `NamedBarrierValue`       |
| 只想让某个变量在执行结束后暴露   | `LastValueAfterFinish`    |
| 中间推理变量，不记录日志/快照   | `UntrackedValue`          |
| 广播事件给多个监听者节点      | `Topic`                   |


channel 也是我们需要首先关注的对象。

## 6. ManagedValueSpec
ManagedValueSpec 表示 ManagedValue 的所有子类。ManagedValue 定义了一个抽象方法 get，从 PregelScratchpad 获取值。

```python
class ManagedValue(ABC, Generic[V]):
    @staticmethod
    @abstractmethod
    def get(scratchpad: PregelScratchpad) -> V: ...


ManagedValueSpec = type[ManagedValue]
```

### 6.1 PregelScratchpad
PregelScratchpad 定义如下

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

提问:

```bash
我正在阅读 langgraph的源码，注意到 langgraph定义了如下对象

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

PregelScratchpad 的定义如上，请先解释他的语义，在以表格的形式说明他的属性

```

`PregelScratchpad` 是 LangGraph 中用于 Pregel 风格图计算模型的一种“记录器”或“上下文暂存区”，**用于存储和追踪图计算某一步执行过程中的关键状态信息**。其命名中的 "Scratchpad" 意味着“便签纸”或“临时存储”，表明它是短生命周期的临时对象，用于支持 LangGraph 中 Pregel 抽象的每一步执行逻辑。

在 Pregel 模型中，图的每个节点以同步轮次进行计算（step），节点之间通过消息传递进行通信，每个 step 都是一个迭代单位，直到满足终止条件（如没有更多消息传递或达到最大轮次）。`PregelScratchpad` 就是**在某一轮 Pregel 计算 step 中记录该轮的状态和辅助逻辑的结构体**。

---

#### ✅ 总体语义

| 概念             | 含义                                                                    |
| -------------- | --------------------------------------------------------------------- |
| **Pregel**     | 一种由 Google 提出的大规模图计算模型，采用“超级步”迭代方式。LangGraph 中使用此模型来组织多轮 LLM 调用或子图调度。 |
| **Scratchpad** | 表示暂存数据的结构体，用于记录当前 step 的中间状态和辅助计数器。                                   |
| **用途**         | 每个 Pregel 迭代 step 期间，用于追踪当前 step 状态（轮次）、调用次数、是否中断、子图执行情况、resume 数据等。  |

---

#### 📊 属性说明表格

| 属性名                 | 类型                      | 含义                              | 备注                                         |
| ------------------- | ----------------------- | ------------------------------- | ------------------------------------------ |
| `step`              | `int`                   | 当前 Pregel 执行的 step 编号           | 从 0 开始递增，代表当前迭代轮次                          |
| `stop`              | `int`                   | 是否应该中断执行的标志                     | 通常是一个布尔值（0 或 1），或者是最大 step 限制              |
| `call_counter`      | `Callable[[], int]`     | 当前 step 中 LLM 或子图的调用次数          | 是一个函数，调用它时返回当前调用次数，用于限制或观测调用行为             |
| `interrupt_counter` | `Callable[[], int]`     | 当前 step 中断次数统计                  | 统计当前 step 中的中断（如 early stop、特殊信号）行为次数      |
| `get_null_resume`   | `Callable[[bool], Any]` | 获取一个“空恢复”数据的方法                  | 用于某些 step 不处理输入时提供一个占位 resume 值，参数表示是否强制构造 |
| `resume`            | `list[Any]`             | 上一轮 step 向当前 step 传递的“resume”数据 | 每个节点可能携带状态，从前一轮传给下一轮                       |
| `subgraph_counter`  | `Callable[[], int]`     | 当前 step 中触发的子图数量统计器             | 用于监控子图调用情况，例如用于调试或决策逻辑                     |

---

#### 💡 补充说明

* 这些属性的设计都是“无状态风格” —— 通过传入的函数或参数组合构建一个“只读+函数式”的上下文视图；
* 它不是用于存储图中节点或边的结构，而是计算流控制和追踪；
* 通常由 LangGraph 的 Pregel 执行器自动构建和传入，开发者无需直接操作。

## 7. Checkpointer

```python
Checkpointer = Union[None, bool, BaseCheckpointSaver]
"""Type of the checkpointer to use for a subgraph.
- True enables persistent checkpointing for this subgraph.
- False disables checkpointing, even if the parent graph has a checkpointer.
- None inherits checkpointer from the parent graph."""
```

Checkpointer 有多个可选值:

| 值                        | 类型         | 含义                           | 适用场景                               |
| ------------------------ | ---------- | ---------------------------- | ---------------------------------- |
| `None`                   | `NoneType` | **继承父图的 checkpoint 设置**      | 默认行为，子图不显式声明，沿用外层图的 checkpoint 策略  |
| `True`                   | `bool`     | **启用 checkpointing（使用默认机制）** | 想为子图开启 checkpoint，即使父图没有设置或已禁用     |
| `False`                  | `bool`     | **禁用 checkpointing（显式关闭）**   | 子图不希望参与任何状态保存，即使父图启用了              |
| `BaseCheckpointSaver` 实例 | 自定义类实例     | **使用自定义的 checkpoint 保存器**    | 子图希望使用独立的 checkpoint 机制，如保存位置、策略不同 |


### 7.1 BaseCheckpointSaver
BaseCheckpointSaver 是 checkpointer save 的抽象基类:

```python
class BaseCheckpointSaver(Generic[V]):

    # 序列化器
    serde: SerializerProtocol = JsonPlusSerializer()
```

langgraph 提供了一个默认的 InMemorySaver 实现。

提问: 下面是 BaseCheckpointSaver 的定义，请以表格的形式列出每个方法名、作用、输出值类型

| 方法名                                                | 作用                                           | 返回值类型                            |         |
| -------------------------------------------------- | -------------------------------------------- | -------------------------------- | ------- |
| `config_specs`                                     | 定义检查点存储器支持的配置字段（用于参数展示或 UI）                  | `list`                           |         |
| `get(config)`                                      | 获取指定配置的检查点（简化形式，仅取 `checkpoint` 部分）          | \`Checkpoint                     | None\`  |
| `get_tuple(config)`                                | 获取指定配置的检查点元组（包含 checkpoint、metadata、version） | \`CheckpointTuple                | None\`  |
| `list(config, ...)`                                | 列出符合条件的检查点（可加过滤器、上限）                         | `Iterator[CheckpointTuple]`      |         |
| `put(config, checkpoint, metadata, new_versions)`  | 存储一个检查点及其元数据                                 | `RunnableConfig`                 |         |
| `put_writes(config, writes, task_id, task_path)`   | 存储与任务关联的中间产出（write events）                   | `None`                           |         |
| `delete_thread(thread_id)`                         | 删除与特定 thread\_id 相关的所有 checkpoint 和 write 数据 | `None`                           |         |
| `aget(config)`                                     | 异步获取检查点（简化）                                  | \`Awaitable\[Checkpoint          | None]\` |
| `aget_tuple(config)`                               | 异步获取检查点元组                                    | \`Awaitable\[CheckpointTuple     | None]\` |
| `alist(config, ...)`                               | 异步列出检查点列表                                    | `AsyncIterator[CheckpointTuple]` |         |
| `aput(config, checkpoint, metadata, new_versions)` | 异步存储检查点及其版本信息                                | `Awaitable[RunnableConfig]`      |         |
| `aput_writes(config, writes, task_id, task_path)`  | 异步存储中间写入产物                                   | `Awaitable[None]`                |         |
| `adelete_thread(thread_id)`                        | 异步删除与某 thread 相关的所有 checkpoint 和 write       | `Awaitable[None]`                |         |
| `get_next_version(current, channel)`               | 生成下一版本号（默认：数字自增）                             | `V`（泛型，可为 `int/float/str`）       |         |

BaseCheckpointSaver 中比较重要的是:
1. get
2. put
3. put_writes
4. delete_thread

## 8. BaseStore
### 8.1 BaseStore 与 BaseCheckpointSaver
目前为止，我不太明白 BaseStore 和 BaseCheckpointSaver 的区别。我们继续像 ChatGpt 提问。
提问: langgraph中 store 组件的作用，不是有  CheckpointSaver 了么，要 store 干什么

这是一个非常好的问题。`langgraph` 中 `store` 和 `CheckpointSaver` 的职责确实有重叠之处，但它们关注点不同，**分别承担不同粒度的“状态持久化”任务**。

---

#### 🧠 总体区别：`store` vs `CheckpointSaver`

| 组件                     | 关注点             | 作用范围           | 持久化内容                         | 用例               |
| ---------------------- | --------------- | -------------- | ----------------------------- | ---------------- |
| ✅ `CheckpointSaver`    | **子图或图运行状态快照**  | 每个 step / 每个子图 | `Checkpoint`、`metadata`、通道版本号 | 用于断点恢复、中途中断后重跑   |
| ✅ `store`（`BaseStore`） | **通用对象存储（图范围）** | 任意阶段 / 任意作用域   | 任意 Python 对象（可序列化）            | 存模型输出、中间状态、共享数据等 |

---


#### ✅ `CheckpointSaver`

* 专用于**图运行过程的状态快照**，与通道版本（channel versions）、resume 信息、任务路径等绑定；
* 通常仅在 **Pregel 迭代、子图执行边界处** 被调用；
* 是 LangGraph 恢复机制的核心；
* 类型严格，仅支持 `Checkpoint`, `CheckpointTuple` 等内部定义结构；
* 比较“重量级”，频率较低（如每 step 一次）；

---

#### ✅ `store`

* 是一种 **通用的 key-value 存储系统**，你可以随时在图中读写；
* 支持任意可序列化的 Python 对象（JSON、pickle 等）；
* 你可以将 `store` 看作 **LangGraph 中的共享缓存 / 状态仓库**；
* 用途灵活，适用于：

  * 存储中间产物（如 RAG 检索结果、用户输入、LLM 响应）
  * 跨子图/节点共享信息（共享上下文或 embedding 向量）
  * 调试、评估输出日志
  * 或持久保存最终结果（如生成的报告）

---

#### 🔄 举个例子：RAG 场景中二者的协作

| 步骤                | 动作                                     | 使用的组件               |
| ----------------- | -------------------------------------- | ------------------- |
| 用户提出问题            | 输入写入通道                                 | —                   |
| 检索知识库             | 检索结果写入 `store["retrieved_docs"]`       | ✅ `store`           |
| 构造 prompt 并调用 LLM | 将 LLM 响应写入 `store["llm_output"]`       | ✅ `store`           |
| 失败前保存整个图状态        | 写入通道版本 + checkpoint                    | ✅ `CheckpointSaver` |
| 崩溃后恢复现场           | 使用 checkpoint 还原通道、resume 状态           | ✅ `CheckpointSaver` |
| 下游评估节点读取 store    | 读取 `llm_output`, `retrieved_docs` 评估质量 | ✅ `store`           |

---

#### ✳️ 总结一句话

> ✅ `CheckpointSaver` 用于 **LangGraph 的“运行恢复”能力**；
> ✅ `store` 用于 **LangGraph 的“图中信息共享和通用持久化”能力**。

### 8.2 BaseStore 抽象方法
提问: 请以表格的形式列出 BaseStore 每个方法名、作用、输出值类型

| 方法名                | 作用描述                                   | 输出值类型                   |        |
| ------------------ | -------------------------------------- | ----------------------- | ------ |
| `batch`            | 同步批量执行多个操作（如 put、get、delete、search）    | `list[Result]`          |        |
| `abatch`           | 异步批量执行多个操作                             | `list[Result]`          |        |
| `get`              | 同步获取指定 namespace + key 的项              | \`Item                  | None\` |
| `aget`             | 异步获取指定 namespace + key 的项              | \`Item                  | None\` |
| `search`           | 同步在指定 namespace 前缀下进行搜索，可选支持自然语言查询、过滤等 | `list[SearchItem]`      |        |
| `asearch`          | 异步版本的 `search`                         | `list[SearchItem]`      |        |
| `put`              | 同步写入或更新一项数据，支持 TTL 和可选索引字段             | `None`                  |        |
| `aput`             | 异步版本的 `put`                            | `None`                  |        |
| `delete`           | 同步删除一项数据                               | `None`                  |        |
| `adelete`          | 异步版本的 `delete`                         | `None`                  |        |
| `list_namespaces`  | 同步列出命名空间（支持前缀/后缀匹配、层级过滤、分页）            | `list[tuple[str, ...]]` |        |
| `alist_namespaces` | 异步版本的 `list_namespaces`                | `list[tuple[str, ...]]` |        |


## 9. BaseCache
### 9.1 BaseCache 与 BaseStore 
提问: 那 cache的 作用是什么

很好，`langgraph` 中的 `cache` 又是第三类状态机制，和 `store`、`CheckpointSaver` 一样负责“存储”，但**目标完全不同**：它是用来 **避免重复执行耗时操作** 的，尤其是用于 **LLM 调用、函数计算的结果缓存**。

---

#### 🧠 三者职责对比总结

| 机制                  | 用途         | 存储内容                 | 典型用途                         | 生命周期               |
| ------------------- | ---------- | -------------------- | ---------------------------- | ------------------ |
| ✅ `CheckpointSaver` | 图执行快照      | 通道状态 + 版本 + resume 等 | 崩溃恢复、断点续跑                    | **每个 step / 子图级别** |
| ✅ `store`           | 通用对象存储     | 任意键值对（如模型输出）         | 中间结果缓存、共享数据                  | **运行时图上下文级别**      |
| ✅ `cache`           | **避免重复执行** | 输入 → 输出 映射           | LLM 调用、Retriever 查询、工具调用结果复用 | **可持久化，也可内存级别**    |

---

#### ✅ `cache`  作用

* 对于 **纯函数节点**（如 LLM 生成、embedding、retriever 等），如果输入相同，它们的输出理论上也相同；
* 使用 `cache` 就可以：**下次相同输入时直接读取输出，而无需重复请求模型或远程服务**；
* 类似于 `@functools.lru_cache` 但作用在整个图或节点层面；

---

#### 📊 用法对比表：`cache` vs `store` vs `CheckpointSaver`

| 特性     | `cache`         | `store` | `CheckpointSaver` |
| ------ | --------------- | ------- | ----------------- |
| 缓存函数输出 | ✅               | ❌       | ❌                 |
| 存储任意对象 | ❌（通常是输入 → 输出）   | ✅       | ❌（结构化通道状态）        |
| 运行恢复   | ❌               | ❌       | ✅                 |
| 提速作用   | ✅               | ❌（只是存）  | ❌                 |
| 可跨图共享  | ✅（如 RedisCache） | ✅       | ❌（仅图内部）           |


#### ✳️ 总结一句话

1. ✅ `cache` 是为了 **避免不必要的重复计算（提高效率）**；
2. ✅ `store` 是为了 **在图运行期间读写任意共享数据（中间状态）**；
3. ✅ `CheckpointSaver` 是为了 **在图中断/恢复时保留通道状态和执行现场**。


### 9.2 BaseCache 抽象方法

| 方法名      | 作用描述                                                 | 输出值类型                   |
| -------- | ---------------------------------------------------- | ----------------------- |
| `get`    | 同步获取多个缓存项的值（根据多个 `FullKey`）                          | `dict[FullKey, ValueT]` |
| `aget`   | 异步获取多个缓存项的值                                          | `dict[FullKey, ValueT]` |
| `set`    | 同步设置多个缓存项的值及其 TTL（以 `FullKey` 为键，值为 `(ValueT, TTL)`） | `None`                  |
| `aset`   | 异步设置多个缓存项的值及其 TTL                                    | `None`                  |
| `clear`  | 同步清除指定命名空间（`Namespace`）下的缓存项，若未提供则清空所有               | `None`                  |
| `aclear` | 异步清除指定命名空间（`Namespace`）下的缓存项，若未提供则清空所有               | `None`                  |


## 10. 总结 
现在我们已经总览了 pregel 中组合的所有对象，最重要的是我们了解的不同对象的之间的依赖关系，我们按照依赖关系，从最简单的抽象开始逐步学习:
1. PregelNode
2. Channel
3. BaseCheckpointSaver
5. BaseStore
4. BaseCache
7. Pregel 