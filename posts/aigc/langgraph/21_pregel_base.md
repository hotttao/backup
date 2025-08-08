---
weight: 1
title: "pregel - 1"
date: 2025-08-01T11:00:00+08:00
lastmod: 2025-08-01T11:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "pregel - 1"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---


经过前面这么多节的铺垫，我们了解了 Pregel 组合的各种对象，现在我们来看看 Pregel 类的实现。

## 1. Pregel
### 1.1 Pregel 属性
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

### 1.2 使用示例

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
# {'b': 'foofoo', 'c': 'foofoofoofoo'}
```

我们以这个示例为切入口，先来学习 Pregel 基础部分。

### 1.3 NodeBuilder

NodeBuilder 是 Pregel 中用于构建节点的类。它提供了一种灵活的方式来定义节点的行为，包括订阅通道、执行操作和写入通道。

#### ✅ NodeBuilder 属性

```python
class NodeBuilder:
    __slots__ = (
        "_channels",
        "_triggers",
        "_tags",
        "_metadata",
        "_writes",
        "_bound",
        "_retry_policy",
        "_cache_policy",
    )

    _channels: str | list[str]
    _triggers: list[str]
    _tags: list[str]
    _metadata: dict[str, Any]
    _writes: list[ChannelWriteEntry]
    _bound: Runnable
    _retry_policy: list[RetryPolicy]
    _cache_policy: CachePolicy | None

    def __init__(
        self,
    ) -> None:
        self._channels = []
        self._triggers = []  # 触发器
        self._tags = []
        self._metadata = {}
        self._writes = []  # 存储写入操作
        self._bound = DEFAULT_BOUND  # 节点执行函数
        self._retry_policy = []
        self._cache_policy = None

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
```

| 属性名             | 类型                        | 初始值说明           | 说明            |
| --------------- | ------------------------- | --------------- | ------------- |
| `_channels`     | `str` 或 `list[str]`       | `[]`            | 订阅的通道（单个或多个）  |
| `_triggers`     | `list[str]`               | `[]`            | 节点被触发时响应的通道   |
| `_tags`         | `list[str]`               | `[]`            | 节点标签（用于标记或筛选） |
| `_metadata`     | `dict[str, Any]`          | `{}`            | 节点元信息         |
| `_writes`       | `list[ChannelWriteEntry]` | `[]`            | 节点执行后的写入通道    |
| `_bound`        | `Runnable`                | `DEFAULT_BOUND` | 节点执行的实际函数     |
| `_retry_policy` | `list[RetryPolicy]`       | `[]`            | 节点重试策略列表      |
| `_cache_policy` | `CachePolicy` 或 `None`    | `None`          | 节点缓存策略        |


从 build 函数可以看到这些属性都是传递给 PregelNode 的参数，其中比较重要的是
1. channels: 节点的读取数据通道
2. triggers: 节点被触发的数据通道
3. writes: 节点的结果写入数据通道

#### NodeBuilder 方法

| 方法名                  | 作用说明                             | 输出类型         |
| -------------------- | -------------------------------- | ------------ |
| `subscribe_only`     | 订阅单个通道，节点仅监听此通道                  | `Self`       |
| `subscribe_to`       | 订阅多个通道，可以配置是否读取其数据               | `Self`       |
| `read_from`          | 仅从指定通道读取数据（不会触发节点执行）             | `Self`       |
| `do`                 | 配置节点执行的函数（可以是组合函数链）              | `Self`       |
| `write_to`           | 设置节点写入的通道，可使用位置参数或命名参数（支持静态值/函数） | `Self`       |
| `meta`               | 添加标签和元信息                         | `Self`       |
| `add_retry_policies` | 添加重试策略                           | `Self`       |
| `add_cache_policy`   | 添加缓存策略                           | `Self`       |
| `build`              | 构建为 `PregelNode` 实例（最终生成的节点对象）   | `PregelNode` |

---

下面是每个函数的代码，

```python
class NodeBuilder:
    __slots__ = (
        "_channels",
        "_triggers",
        "_tags",
        "_metadata",
        "_writes",
        "_bound",
        "_retry_policy",
        "_cache_policy",
    )

    _channels: str | list[str]
    _triggers: list[str]
    _tags: list[str]
    _metadata: dict[str, Any]
    _writes: list[ChannelWriteEntry]
    _bound: Runnable
    _retry_policy: list[RetryPolicy]
    _cache_policy: CachePolicy | None

    def __init__(
        self,
    ) -> None:
        self._channels = []
        self._triggers = []  # 触发器
        self._tags = []
        self._metadata = {}
        self._writes = []  # 存储写入操作
        self._bound = DEFAULT_BOUND  # 节点执行函数
        self._retry_policy = []
        self._cache_policy = None

    # 订阅单个通道，节点将只接收来自该通道的数据
    def subscribe_only(
        self,
        channel: str,
    ) -> Self:
        """Subscribe to a single channel."""
        # 从 channel 读取数据
        if not self._channels:
            self._channels = channel
        else:
            raise ValueError(
                "Cannot subscribe to single channels when other channels are already subscribed to"
            )
        # 被 channel 触发
        self._triggers.append(channel)

        return self

    # 订阅多个通道，节点将在这些通道更新时被触发
    def subscribe_to(
        self,
        *channels: str,
        read: bool = True,
    ) -> Self:
        """Add channels to subscribe to. Node will be invoked when any of these
        channels are updated, with a dict of the channel values as input.

        Args:
            channels: Channel name(s) to subscribe to
            read: If True, the channels will be included in the input to the node.
                Otherwise, they will trigger the node without being sent in input.

        Returns:
            Self for chaining
        """
        if isinstance(self._channels, str):
            raise ValueError(
                "Cannot subscribe to channels when subscribed to a single channel"
            )
        # read 默认为 True，从传入的 channels 内读取数据
        if read:
            if not self._channels:
                self._channels = list(channels)
            else:
                self._channels.extend(channels)
        # 被 channel 触发
        if isinstance(channels, str):
            self._triggers.append(channels)
        else:
            self._triggers.extend(channels)

        return self

    def read_from(
        self,
        *channels: str,
    ) -> Self:
        """Adds the specified channels to read from, without subscribing to them."""
        assert isinstance(self._channels, list), (
            "Cannot read additional channels when subscribed to single channels"
        )
        # 仅读取通道数据，不触发节点执行
        self._channels.extend(channels)
        return self

    # 配置节点执行的函数（可以是组合函数链）
    def do(
        self,
        node: RunnableLike,
    ) -> Self:
        """Adds the specified node."""
        if self._bound is not DEFAULT_BOUND:
            self._bound = RunnableSeq(
                self._bound, coerce_to_runnable(node, name=None, trace=True)
            )
        else:
            # 将输入参数转换为 Runnable 实例
            self._bound = coerce_to_runnable(node, name=None, trace=True)
        return self

    # 设置节点写入的通道
    def write_to(
        self,
        *channels: str | ChannelWriteEntry,
        **kwargs: _WriteValue,
    ) -> Self:
        """Add channel writes.

        Args:
            *channels: Channel names to write to
            **kwargs: Channel name and value mappings

        Returns:
            Self for chaining
        """
        self._writes.extend(
            # 默认写入的数据为 PASSTHROUGH 实际执行时会被替换为 input
            ChannelWriteEntry(c) if isinstance(c, str) else c for c in channels
        )
        self._writes.extend(
            ChannelWriteEntry(k, mapper=v)
            if callable(v)
            else ChannelWriteEntry(k, value=v)
            for k, v in kwargs.items()
        )

        return self

    def meta(self, *tags: str, **metadata: Any) -> Self:
        """Add tags or metadata to the node."""
        self._tags.extend(tags)
        self._metadata.update(metadata)
        return self

    def add_retry_policies(self, *policies: RetryPolicy) -> Self:
        """Adds retry policies to the node."""
        self._retry_policy.extend(policies)
        return self

    def add_cache_policy(self, policy: CachePolicy) -> Self:
        """Adds cache policies to the node."""
        self._cache_policy = policy
        return self
```

### 1.4 示例代码解读

```python
# node1 仅订阅通道 a，并被通道 a 触发，执行函数为 lambda x: x + x，写入通道 b
node1 = (
    NodeBuilder().subscribe_only("a")
    .do(lambda x: x + x)
    .write_to("b")
)

# node2 订阅通道 b，并被通道 b 触发，执行函数为 lambda x: x["b"] + x["b"]，写入通道 c
node2 = (
    NodeBuilder().subscribe_to("b")
    .do(lambda x: x["b"] + x["b"])
    .write_to("c")
)
```

了解了 node 的构建，现在我们来看 Pregel 的 invoke 方法。invoke 方法比较复杂，我们将分为 invoke 输入参数、invoke 执行逻辑两个部分讲解


## 2. Pregel invoke 入参

```python
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
        """Run the graph with a single input and config.

        Args:
            input: The input data for the graph. It can be a dictionary or any other type.
            config: Optional. The configuration for the graph run.
            context: The static context to use for the run.
                !!! version-added "Added in version 0.6.0."
            stream_mode: Optional[str]. The stream mode for the graph run. Default is "values".
            print_mode: Accepts the same values as `stream_mode`, but only prints the output to the console, for debugging purposes. Does not affect the output of the graph in any way.
            output_keys: Optional. The output keys to retrieve from the graph run.
            interrupt_before: Optional. The nodes to interrupt the graph run before.
            interrupt_after: Optional. The nodes to interrupt the graph run after.
            **kwargs: Additional keyword arguments to pass to the graph run.

        Returns:
            The output of the graph run. If stream_mode is "values", it returns the latest output.
            If stream_mode is not "values", it returns a list of output chunks.
        """
```

invoke 方法接受以下参数:

| 参数名                | 类型                                              | 默认值        | 作用说明                                                                     |
| ------------------ | ----------------------------------------------- | ---------- | ------------------------------------------------------------------------ |
| `input`            | `InputT` \| `Command` \| `None`                 | 无          | 图运行的输入数据，通常为 dict 或任意支持的结构。也可为 `Command` 实例表示特殊指令。                       |
| `config`           | `RunnableConfig` \| `None`                      | `None`     | 可选，用于配置本次运行的上下文，如 tags、metadata、run name、callbacks 等。                    |
| `context`          | `ContextT` \| `None`                            | `None`     | 静态上下文对象（0.6.0 后新增），为整个运行提供共享数据。不同于 input，它不被流经节点，但可用于表达式引用。              |
| `stream_mode`      | `StreamMode`（通常为 `"values"`、`"none"`、`"all"` 等） | `"values"` | 控制运行返回什么类型的数据；默认 `"values"` 表示仅返回最终输出值。其他选项如 `"all"` 表示返回中间节点的所有输出。      |
| `print_mode`       | `StreamMode` \| `Sequence[StreamMode]`          | `()`       | 用于调试，控制哪些输出在控制台打印。不影响实际输出结果。可选 `"values"`、`"all"` 等与 `stream_mode` 相同的值。 |
| `output_keys`      | `str` \| `Sequence[str]` \| `None`              | `None`     | 指定要返回的输出字段，若不设置，返回图的全部输出。用于只关心部分输出结果时提高性能。                               |
| `interrupt_before` | `All` \| `Sequence[str]` \| `None`              | `None`     | 中断图运行的时机点：在指定节点执行前中断运行（用于调试或手动接管节点执行）。                                   |
| `interrupt_after`  | `All` \| `Sequence[str]` \| `None`              | `None`     | 中断图运行的时机点：在指定节点执行后中断运行。                                                  |
| `**kwargs`         | `Any`                                           | 无          | 传入额外参数，这些参数会传递给图的根节点或 `config` 中定义的 callbacks，用于扩展自定义逻辑。                 |

---

其中:

* `input` 与 `context` 是两个不同维度的数据：
  * `input`: 节点可以感知和读取的数据。
  * `context`: 静态共享上下文，一般不会自动传入节点，但支持 `get("key")` 的方式访问。
* `stream_mode` 和 `print_mode` 组合使用时：
  * `stream_mode` 控制实际返回；
  * `print_mode` 控制是否**在终端打印**过程值（调试用途）。
* `interrupt_before` / `interrupt_after` 非常适合用于调试或 LangGraph IDE 场景中注入逻辑。

输入参数中有几个类型我们之前没有见过，我们先来看看。

### 2.1 InputT

```python
# 是 Python 3.11+ 中 带 default 参数的 TypeVar 泛型变量定义，用于类型系统中的泛型约束。
InputT = TypeVar("InputT", bound=StateLike, default=StateT)
```

| 部分                             | 含义说明                                             |
| ------------------------------ | ------------------------------------------------ |
| `TypeVar("InputT", ...)`     | 创建一个类型变量 `InputT`，可用于泛型函数、类、方法中                |
| `bound=StateLike` | 表示 `InputT` 必须是 `StateLike` 子类（上界约束） |
| `default=StateT`                 | 如果使用者不提供具体类型参数时，默认 `InputT = StateT`|  

### 2.2 ContextT

```python
# 是 Python 3.11+ 中 带 default 参数的 TypeVar 泛型变量定义，用于类型系统中的泛型约束。
ContextT = TypeVar("ContextT", bound=Union[StateLike, None], default=None)
```

| 部分                             | 含义说明                                             |
| ------------------------------ | ------------------------------------------------ |
| `TypeVar("ContextT", ...)`     | 创建一个类型变量 `ContextT`，可用于泛型函数、类、方法中                |
| `bound=Union[StateLike, None]` | 表示 `ContextT` 必须是 `StateLike` 或 `None` 的子类（上界约束） |
| `default=None`                 | 如果使用者不提供具体类型参数时，默认 `ContextT = None`|       


### 2.3 StreamMode
StreamMode 控制 PregelLoop 或调度器在执行过程中，以什么粒度、方式、频率将中间结果（包括 task 输出、中断、写入等）传输给使用者。

```python
StreamMode = Literal[
    "values", "updates", "checkpoints", "tasks", "debug", "messages", "custom"
]
"""How the stream method should emit outputs.

- `"values"`: Emit all values in the state after each step, including interrupts.
    When used with functional API, values are emitted once at the end of the workflow.
- `"updates"`: Emit only the node or task names and updates returned by the nodes or tasks after each step.
    If multiple updates are made in the same step (e.g. multiple nodes are run) then those updates are emitted separately.
- `"custom"`: Emit custom data using from inside nodes or tasks using `StreamWriter`.
- `"messages"`: Emit LLM messages token-by-token together with metadata for any LLM invocations inside nodes or tasks.
- `"checkpoints"`: Emit an event when a checkpoint is created, in the same format as returned by get_state().
- `"tasks"`: Emit events when tasks start and finish, including their results and errors.
- `"debug"`: Emit "checkpoints" and "tasks" events, for debugging purposes.
"""
```

| 模式值             | 含义说明                                               | 典型用途                  |
| --------------- | -------------------------------------------------- | --------------------- |
| `"values"`      | 每一步后输出整个状态中的所有值，包括中断点。<br>如果使用函数式 API，仅在最终输出时返回一次。 | 默认模式，适合最终结果导向的运行      |
| `"updates"`     | 每一步后仅输出本次运行中各节点（或任务）返回的更新内容（如写入的通道名和值），多节点会分开多次输出。 | 更轻量的流式模式，便于追踪增量变化     |
| `"custom"`      | 允许节点或任务内部使用 `StreamWriter` 显式发送自定义输出。              | 适合自定义进度信息或日志的输出       |
| `"messages"`    | 对于节点中调用 LLM（大模型）的部分，逐 token 发送消息及相关元数据。            | 流式输出大模型 token，用于聊天可视化 |
| `"checkpoints"` | 每次创建 checkpoint 时发出事件，格式与 `get_state()` 返回值一致。     | 检查状态保存逻辑，适用于持久化观测     |
| `"tasks"`       | 每个任务（如节点）开始与结束时发出事件，包含执行结果或错误。                     | 性能监控、错误定位、任务时间测量      |
| `"debug"`       | 是 `"checkpoints"` 和 `"tasks"` 的组合，便于调试。            | 调试模式，获取完整运行过程         |


### 2.4 Command

Command 的泛型数据类，是 LangGraph 中用于 控制图状态更新和节点跳转的核心指令对象。你可以把它理解为图执行中的“一次行动指令”，在一个节点执行后返回，用于告诉引擎下一步干什么。后面我们讲解 interrupt 时，就能理解 Command 的作用了。我们先看它的实现。

```python
@dataclass(**_DC_KWARGS)
class Command(Generic[N], ToolOutputMixin):
    """One or more commands to update the graph's state and send messages to nodes.

    !!! version-added "Added in version 0.2.24."

    Args:
        graph: graph to send the command to. Supported values are:

            - None: the current graph (default)
            - Command.PARENT: closest parent graph
        update: update to apply to the graph's state.
        resume: value to resume execution with. To be used together with [`interrupt()`][langgraph.types.interrupt].
            Can be one of the following:

            - mapping of interrupt ids to resume values
            - a single value with which to resume the next interrupt
        goto: can be one of the following:

            - name of the node to navigate to next (any node that belongs to the specified `graph`)
            - sequence of node names to navigate to next
            - `Send` object (to execute a node with the input provided)
            - sequence of `Send` objects
    """

    graph: str | None = None
    update: Any | None = None
    resume: dict[str, Any] | Any | None = None
    goto: Send | Sequence[Send | N] | N = ()

    def __repr__(self) -> str:
        # get all non-None values
        contents = ", ".join(
            f"{key}={value!r}" for key, value in asdict(self).items() if value
        )
        return f"Command({contents})"

    def _update_as_tuples(self) -> Sequence[tuple[str, Any]]:
        if isinstance(self.update, dict):
            return list(self.update.items())
        elif isinstance(self.update, (list, tuple)) and all(
            isinstance(t, tuple) and len(t) == 2 and isinstance(t[0], str)
            for t in self.update
        ):
            return self.update
        # 缓存并返回某个 Python 类的注解字段名（__annotations__）的集合
        elif keys := get_cached_annotated_keys(type(self.update)):
            # 将一个对象（通常是 Pydantic 模型或其他带字段的结构）转换成 (key, value) 的字段更新列表
            return get_update_as_tuples(self.update, keys)
        elif self.update is not None:
            return [("__root__", self.update)]
        else:
            return []

    PARENT: ClassVar[Literal["__parent__"]] = "__parent__"
```

#### Command 属性

| 属性名      | 类型                                 | 说明                                                                                                    |
| -------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `graph`  | `str \| None`                      | 指定命令作用的图。<br>- `None` 表示当前图（默认）<br>- `Command.PARENT` 表示最近的父图                                         |
| `update` | `Any \| None`                      | 用于更新图的状态。可以是：<br>- `dict[str, Any]`：字段更新键值对<br>- 支持结构化对象（会转成键值对）<br>- 单个值（会包装为 `("__root__", value)`） |
| `resume` | `dict[str, Any] \| Any \| None`    | 恢复中断执行的值，用于与 `interrupt()` 配合。可为：<br>- 中断 ID 到恢复值的映射<br>- 单一恢复值，应用于最近的中断                              |
| `goto`   | `Send \| Sequence[Send \| N] \| N` | 指定接下来要跳转执行的节点（或节点序列）或发送命令。可以是：<br>- 节点名（`str` 或 `Literal`）<br>- `Send` 对象（含输入数据）<br>- 上述任意组合的列表       |


#### _update_as_tuples 
_update_as_tuples 用于统一 Command update 值，其用到了 get_cached_annotated_keys 和 get_update_as_tuples 两个函数。

```python

# ANNOTATED_KEYS_CACHE 是一个 弱引用字典（WeakKeyDictionary），它的 key 是 Python 的 type（类），value 是该类的注解字段名集合（字符串元组）。
# 类型注解说明了缓存的内容结构：{class: (field1, field2, ...)}
ANNOTATED_KEYS_CACHE: weakref.WeakKeyDictionary[type[Any], tuple[str, ...]] = (
    weakref.WeakKeyDictionary()
)


def get_cached_annotated_keys(obj: type[Any]) -> tuple[str, ...]:
    """Return cached annotated keys for a Python class."""
    if obj in ANNOTATED_KEYS_CACHE:
        return ANNOTATED_KEYS_CACHE[obj]
    if isinstance(obj, type):
        keys: list[str] = []
        # 解析类层级结构（MRO）
        for base in reversed(obj.__mro__):
            ann = base.__dict__.get("__annotations__")
            # 描述符类型跳过
            if ann is None or isinstance(ann, types.GetSetDescriptorType):
                continue
            keys.extend(ann.keys())
        return ANNOTATED_KEYS_CACHE.setdefault(obj, tuple(keys))
    else:
        raise TypeError(f"Expected a type, got {type(obj)}. ")



def get_update_as_tuples(input: Any, keys: Sequence[str]) -> list[tuple[str, Any]]:
    """Get Pydantic state update as a list of (key, value) tuples."""
    if isinstance(input, BaseModel):
        # 哪些字段是用户在构造模型时显式传入的（即手动设置过的字段）
        keep = input.model_fields_set
        # 模型定义的所有字段的 类型、默认值、校验信息等元数据。
        defaults = {k: v.default for k, v in type(input).model_fields.items()}
    else:
        keep = None
        defaults = {}

    # NOTE: This behavior for Pydantic is somewhat inelegant,
    # but we keep around for backwards compatibility
    # if input is a Pydantic model, only update values
    # that are different from the default values or in the keep set
    return [
        (k, value)
        for k in keys
        # input 上有 key 键对应的值
        if (value := getattr(input, k, MISSING)) is not MISSING
        and (
            value is not None # 值不为空
            or defaults.get(k, MISSING) is not None # 值为空，但是默认值不为空
            or (keep is not None and k in keep) # 值、默认值都为空，但用户手动设置成了None
        )
    ]
```

## 3. Pregel.Stream
Pregel.invoke 内部调用的是 stream 方法。所以我们重点关注 stream 方法。stream 方法内部调用了很多其他的对象，这里我们重点关注两点:
1. stream 方法的执行流程
2. 内部使用的对象，为我们下一步学习提供指导。

下面是 stream 的源码及其注释:

```python
    def stream(
        self,
        input: InputT | Command | None,
        config: RunnableConfig | None = None,
        *,
        context: ContextT | None = None,
        stream_mode: StreamMode | Sequence[StreamMode] | None = None,
        print_mode: StreamMode | Sequence[StreamMode] = (),
        output_keys: str | Sequence[str] | None = None,
        interrupt_before: All | Sequence[str] | None = None,
        interrupt_after: All | Sequence[str] | None = None,
        durability: Durability | None = None,
        subgraphs: bool = False,
        debug: bool | None = None,
        **kwargs: Unpack[DeprecatedKwargs],
    ) -> Iterator[dict[str, Any] | Any]:
        
        # 1. 标准化 stream_model
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

        # 2. FIFO 的对象，子图向父图发送数据
        stream = SyncQueue()

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
            # 3. 标准化参数
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
            if checkpointer is None and (
                durability is not None or deprecated_checkpoint_during is not None
            ):
                warnings.warn(
                    "`durability` has no effect when no checkpointer is present.",
                )
            # 4. 处理子图的 checkpoint
            # set up subgraph checkpointing
            if self.checkpointer is True:
                ns = cast(str, config[CONF][CONFIG_KEY_CHECKPOINT_NS])
                config[CONF][CONFIG_KEY_CHECKPOINT_NS] = recast_checkpoint_ns(ns)
            # set up messages stream mode
            # 5. 处理 messages 流模式，添加 callback handler
            if "messages" in stream_modes:
                run_manager.inheritable_handlers.append(
                    StreamMessagesHandler(stream.put, subgraphs)
                )

            # 6. 处理 custom 流模式，添加自定义事件
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
            # 7. 初始化 runtime，run_time 包含了之前创建的 SyncQueue
            runtime = Runtime(
                context=_coerce_context(self.context_schema, context),
                store=store,
                stream_writer=stream_writer,
                previous=None,
            )
            parent_runtime = config[CONF].get(CONFIG_KEY_RUNTIME, DEFAULT_RUNTIME)
            runtime = parent_runtime.merge(runtime)
            config[CONF][CONFIG_KEY_RUNTIME] = runtime
            # 8. 初始化 SyncPregelLoop
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
                # create runner
                # 9. 初始化 PregelRunner，PregelRunner 包含了 SyncPregelLoop 的 submit 和 put_writes 两个方法
                runner = PregelRunner(
                    submit=config[CONF].get(
                        CONFIG_KEY_RUNNER_SUBMIT, weakref.WeakMethod(loop.submit)
                    ),
                    put_writes=weakref.WeakMethod(loop.put_writes),
                    node_finished=config[CONF].get(CONFIG_KEY_NODE_FINISHED),
                )
                # enable subgraph streaming
                # 10. 向子图传递 stream
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
                    # 11. 注册回调函数，在 loop __exit__ 退出时会调用
                    loop.stack.callback(stream._count.release)

                    def get_waiter() -> concurrent.futures.Future[None]:
                        # 只有一个 waiter
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
                # 12. 执行 loop.tick，更新 loop.task 产生新的任务
                while loop.tick():
                    for task in loop.match_cached_writes():
                        loop.output_writes(task.id, task.writes, cached=True)
                    # 13. 执行 runner.tick 执行任务
                    for _ in runner.tick(
                        [t for t in loop.tasks.values() if not t.writes],
                        timeout=self.step_timeout,
                        get_waiter=get_waiter,
                        schedule_task=loop.accept_push,
                    ):
                        # emit output
                        yield from _output(
                            stream_mode, print_mode, subgraphs, stream.get, queue.Empty
                        )
                    # 14. 当前 step 执行完毕，调用 apply_write 更新 channel
                    loop.after_tick()
                    # wait for checkpoint
                    if durability_ == "sync":
                        loop._put_checkpoint_fut.result()
            # emit output
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

在 Stream 的实现中，主要用到了如下对象:
1. RunTime: 
2. SyncPregelLoop: 会包含 Pregel 提供的方法，stream 中核心调用了如下方法:
    - tick
    - match_cached_writes
    - after_tick
3. PregelRunner: 会包含 SyncPregelLoop 提供的方法，stream 中调用了其 tick 方法

后面我们会先学习这几个对象，然后再回到 Pregel 上来。

