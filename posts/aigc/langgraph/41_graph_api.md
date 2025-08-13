---
weight: 1
title: "langgraph graph api"
date: 2025-08-08T12:00:00+08:00
lastmod: 2025-08-08T12:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langgraph graph api"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

这一节我们来学习 langgraph 的 graph api。

## 1. graph api 
### 1.1 graph api 使用示例
我们来看 langgraph 官方文档提供的智能机器人的示例:

```python
from typing import Annotated
from dotenv import load_dotenv, find_dotenv
from langchain_community.chat_models import ChatTongyi

_ = load_dotenv(find_dotenv())  # read local .env file

llm = ChatTongyi(temperature=0.0)

from typing import Annotated

from langchain_tavily import TavilySearch
from langchain_core.messages import BaseMessage
from typing_extensions import TypedDict

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition


class State(TypedDict):
    messages: Annotated[list, add_messages]


graph_builder = StateGraph(State)

tool = TavilySearch(max_results=2)
tools = [tool]
llm_with_tools = llm.bind_tools(tools)


def chatbot(state: State):
    return {"messages": [llm_with_tools.invoke(state["messages"])]}


graph_builder.add_node("chatbot", chatbot)

tool_node = ToolNode(tools=[tool])
graph_builder.add_node("tools", tool_node)

graph_builder.add_conditional_edges(
    "chatbot",
    tools_condition,
)
# Any time a tool is called, we return to the chatbot to decide the next step
graph_builder.add_edge("tools", "chatbot")
graph_builder.add_edge(START, "chatbot")
graph = graph_builder.compile()

print(graph.get_graph().draw_ascii())
```

### 1.2 graph api 类图
![stategraph](/images/langgraph/stategraph.svg)

从 UML 类图可以看到 Stategraph.compile 之后得到的是 CompiledStateGraph，这个类是 Pregel 的子类。


## 2. StateGraph
```python
class StateGraph(Generic[StateT, ContextT, InputT, OutputT]):
    # 容器字段，用于存储图的结构
    edges: set[tuple[str, str]]
    nodes: dict[str, StateNodeSpec[Any, ContextT]]
    branches: defaultdict[str, dict[str, BranchSpec]]
    channels: dict[str, BaseChannel]
    managed: dict[str, ManagedValueSpec]
    schemas: dict[type[Any], dict[str, BaseChannel | ManagedValueSpec]]
    waiting_edges: set[tuple[tuple[str, ...], str]]

    # 输入字段
    compiled: bool
    state_schema: type[StateT]
    context_schema: type[ContextT] | None
    input_schema: type[InputT]
    output_schema: type[OutputT]
    
    def __init__(
        self,
        state_schema: type[StateT],
        context_schema: type[ContextT] | None = None,
        *,
        input_schema: type[InputT] | None = None,
        output_schema: type[OutputT] | None = None,
        **kwargs: Unpack[DeprecatedKwargs],
    ) -> None:
        # 过期字段的警告
        self.nodes = {}
        self.edges = set()
        self.branches = defaultdict(dict)
        self.schemas = {}
        self.channels = {}
        self.managed = {}
        self.compiled = False
        self.waiting_edges = set()

        self.state_schema = state_schema
        self.input_schema = cast(type[InputT], input_schema or state_schema)
        self.output_schema = cast(type[OutputT], output_schema or state_schema)
        self.context_schema = context_schema

        self._add_schema(self.state_schema)
        self._add_schema(self.input_schema, allow_managed=False)
        self._add_schema(self.output_schema, allow_managed=False)
```

_add_schema 用于从输入的 schema 中提取 channels, managed 信息，不过要看懂 _add_schema 代码，需要先了解 Python Annotated 的用法。

### 2.1 `Annotated`

`Annotated` 是 **Python 3.9+**（`typing` 模块）提供的一种 **类型标注扩展机制**，
用来给一个类型加上**额外的元数据**，而不影响这个类型本身。

它的官方定义大概是：

```python
Annotated[原始类型, *额外信息]
```

* **原始类型**：真正的字段类型（比如 `str`, `int`, `list[str]`）。
* **额外信息**：可以是任意 Python 对象（通常是配置、说明、约束等），这些信息会被保存在 `__metadata__` 属性里。

---

#### 基本语法

```python
from typing import Annotated

Name = Annotated[str, "must be non-empty"]
```

这里：

* **类型**：`str`
* **额外信息**：`"must be non-empty"`

---

#### 获取元数据

```python
from typing import get_type_hints

class User:
    name: Annotated[str, "must be non-empty"]

print(get_type_hints(User, include_extras=True))
# {'name': typing.Annotated[str, 'must be non-empty']}

# 访问 __metadata__
typ = get_type_hints(User, include_extras=True)['name']
print(typ.__metadata__)  # ('must be non-empty',)
```


#### 多个元数据

```python
from typing import Annotated

Age = Annotated[int, "in years", {"min": 0, "max": 120}]
print(Age.__metadata__)
# ('in years', {'min': 0, 'max': 120})

# 泛型
from typing import Annotated

# 给 list[str] 添加额外信息
MyList = Annotated[list[str], "sorted", "max length 100"]

print(MyList.__origin__)     # list
print(MyList.__args__)       # (str,)
print(MyList.__metadata__)   # ('sorted', 'max length 100')
```

### 2.2 schema 的定义
下面是一个更复杂的 schema 的定义:

```python
import operator
from typing import Annotated, Literal
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.channels import Topic
from langgraph.managed.is_last_step import RemainingSteps


class State(TypedDict):
    aggregate: Annotated[list, operator.add]
    remaining_steps: RemainingSteps # ManagedValue
    response: Annotated[str, LastValue()]  
```

_add_schema 函数功能就是从 State 的定义中提取 channels, managed 信息。

### 2.2 schema 解析
schema 解析的功能定义在 _get_channels 函数中:

```python
def _get_channels(
    schema: type[dict],
) -> tuple[dict[str, BaseChannel], dict[str, ManagedValueSpec], dict[str, Any]]:
    # 判断输入的 schema是否有类型注解
    if not hasattr(schema, "__annotations__"):
        return (
            # 没有注解默，设置为默认 __root__ channel
            {"__root__": _get_channel("__root__", schema, allow_managed=False)},
            {},
            {},
        )

    # 获取类型注解，以及 Annotated 内的元数据
    # eg: {'name': typing.Annotated[str, 'must be non-empty']}
    type_hints = get_type_hints(schema, include_extras=True)
    all_keys = {
        # _get_channel 根据注解返回 channel 还是 ManagedValue
        name: _get_channel(name, typ)
        for name, typ in type_hints.items()
        if name != "__slots__"
    }
    return (
        {k: v for k, v in all_keys.items() if isinstance(v, BaseChannel)},
        {k: v for k, v in all_keys.items() if is_managed_value(v)},
        type_hints,
    )
```

_get_channels 的核心是 _get_channel，可以看到
1. schema 申明的所有字段都会被包装为 channel
2. Langgraph 中所谓的 reducer，会被包装为 BinaryOperatorAggregate


```python
def _get_channel(
    name: str, annotation: Any, *, allow_managed: bool = True
) -> BaseChannel | ManagedValueSpec:
    if manager := _is_field_managed_value(name, annotation):
        if allow_managed:
            return manager
        else:
            raise ValueError(f"This {annotation} not allowed in this position")
    # 返回从 annotation 中解析出来的 channel
    elif channel := _is_field_channel(annotation):
        channel.key = name
        return channel
    # BinaryOperatorAggregate
    elif channel := _is_field_binop(annotation):
        channel.key = name
        return channel
    # 默认返回 LastValue channel
    fallback: LastValue = LastValue(annotation)
    fallback.key = name
    return fallback


def _is_field_channel(typ: type[Any]) -> BaseChannel | None:
    # 解析 `response: Annotated[str, LastValue()]  `
    # __metadata__ 保存的是 Annotated 内的元数据
    if hasattr(typ, "__metadata__"):
        meta = typ.__metadata__
        # 最后一个元素使 Channel 的实例
        if len(meta) >= 1 and isinstance(meta[-1], BaseChannel):
            return meta[-1]
        # 最后一个元素使 Channel 的子类
        elif len(meta) >= 1 and isclass(meta[-1]) and issubclass(meta[-1], BaseChannel):
            # 实例化 Channel 子类
            return meta[-1](typ.__origin__ if hasattr(typ, "__origin__") else typ)
    return None


# 返回的是 BinaryOperatorAggregate channel
def _is_field_binop(typ: type[Any]) -> BinaryOperatorAggregate | None:
    # 解析； `aggregate: Annotated[list, operator.add]`
    if hasattr(typ, "__metadata__"):
        meta = typ.__metadata__
        # 最后一个元素使可执行对象
        if len(meta) >= 1 and callable(meta[-1]):
            sig = signature(meta[-1])
            # 获取函数签名信息
            params = list(sig.parameters.values())
            if (

                sum(
                    p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD)
                    for p in params
                )
                == 2
            ):
                # 函数签名必须是 (a, b) -> c 
                return BinaryOperatorAggregate(typ, meta[-1])
            else:
                raise ValueError(
                    f"Invalid reducer signature. Expected (a, b) -> c. Got {sig}"
                )
    return None


def _is_field_managed_value(name: str, typ: type[Any]) -> ManagedValueSpec | None:
    # 解析 `remaining_steps: RemainingSteps`
    if hasattr(typ, "__metadata__"):
        meta = typ.__metadata__
        if len(meta) >= 1:
            decoration = get_origin(meta[-1]) or meta[-1]
            if is_managed_value(decoration):
                return decoration

    return None
```

### 2.3 _add_schema
_add_schema 会将解析出来的 channel、ManagedValue 添加到 StateGraph 相关的容器字段中。

```python
    def _add_schema(self, schema: type[Any], /, allow_managed: bool = True) -> None:
        if schema not in self.schemas:
            _warn_invalid_state_schema(schema)
            channels, managed, type_hints = _get_channels(schema)
            if managed and not allow_managed:
                names = ", ".join(managed)
                schema_name = getattr(schema, "__name__", "")
                raise ValueError(
                    f"Invalid managed channels detected in {schema_name}: {names}."
                    " Managed channels are not permitted in Input/Output schema."
                )
            # 添加 schema
            self.schemas[schema] = {**channels, **managed}
            for key, channel in channels.items():
                if key in self.channels:
                    if self.channels[key] != channel:
                        # channel 不能重复设置
                        if isinstance(channel, LastValue):
                            pass
                        else:
                            raise ValueError(
                                f"Channel '{key}' already exists with a different type"
                            )
                else:
                    # 添加 channel
                    self.channels[key] = channel
            for key, managed in managed.items():
                if key in self.managed:
                    # ManagedValue 不能重复设置
                    if self.managed[key] != managed:
                        raise ValueError(
                            f"Managed value '{key}' already exists with a different type"
                        )
                else:
                    # 添加 ManagedValue
                    self.managed[key] = managed

```

这里要特别注意，_add_schema 中下面的代码:
1. 每个 channel 都重载了 `__eq__` 方法，用于比较 channel 是否相等。所以这里的 != 不是比较他们是不是相同的实例，而是比较的他们是不是统一类型，是不是觉有相同的参数
2. 这意味着不同的 input_schema 可以通过申明相同的 schema 而共用相同的 channel，从而做到在不同的 Node 之间传递数据。

```python
                if key in self.channels:
                    if self.channels[key] != channel:
                        if isinstance(channel, LastValue):
                            pass
                        else:
                            raise ValueError(
                                f"Channel '{key}' already exists with a different type"
                            )
                else:
                    self.channels[key] = channel
```


StateGraph 初始化之后就是:
1. 添加节点: add_node
2. 添加边: add_conditional_edges/add_edge
3. 编译: compile

### 2.4 add_node

#### StateNodeSpec
stategraph 将 node 定义为 StateNodeSpec，其中 runnable 定义为 StateNode。StateNode Union 中的每一种类型，表示 node 入参的一种定义形式。

```python
@dataclass(**_DC_SLOTS)
class StateNodeSpec(Generic[NodeInputT, ContextT]):
    runnable: StateNode[NodeInputT, ContextT]
    metadata: dict[str, Any] | None
    input_schema: type[NodeInputT]
    retry_policy: RetryPolicy | Sequence[RetryPolicy] | None
    cache_policy: CachePolicy | None
    ends: tuple[str, ...] | dict[str, str] | None = EMPTY_SEQ
    defer: bool = False

# Union 中的每一种类型，表示 node 可能接受的入参
StateNode: TypeAlias = Union[
    _Node[NodeInputT],
    _NodeWithConfig[NodeInputT],
    _NodeWithWriter[NodeInputT],
    _NodeWithStore[NodeInputT],
    _NodeWithWriterStore[NodeInputT],
    _NodeWithConfigWriter[NodeInputT],
    _NodeWithConfigStore[NodeInputT],
    _NodeWithConfigWriterStore[NodeInputT],
    _NodeWithRuntime[NodeInputT, ContextT],
    Runnable[NodeInputT, Any],
]


class _NodeWithConfigWriterStore(Protocol[NodeInputT_contra]):
    def __call__(
        self,
        state: NodeInputT_contra,
        *,
        config: RunnableConfig,
        writer: StreamWriter,
        store: BaseStore,
    ) -> Any: ...
```

| 属性名            | 类型                                             | 说明                                                 |
| -------------- | ---------------------------------------------- | -------------------------------------------------- |
| `runnable`     | `StateNode[NodeInputT, ContextT]`              | 节点的可执行对象，通常是一个符合 `StateNode` 接口的函数或类实例，定义了节点的执行逻辑。 |
| `metadata`     | `dict[str, Any] \| None`                       | 节点的元数据，可用于存储额外的描述信息、标签等辅助信息。                       |
| `input_schema` | `type[NodeInputT]`                             | 节点输入数据的模式（Schema），通常用于类型检查和自动文档生成。                 |
| `retry_policy` | `RetryPolicy \| Sequence[RetryPolicy] \| None` | 节点执行失败时的重试策略，可以是单个策略或策略列表。                         |
| `cache_policy` | `CachePolicy \| None`                          | 节点的缓存策略，用于控制结果是否缓存以及缓存失效规则。                        |
| `ends`         | `tuple[str, ...] \| dict[str, str] \| None`    | 节点的结束标志或跳转规则：可以是目标节点名称的元组，或从条件到节点名称的映射。            |
| `defer`        | `bool`                                         | 是否延迟执行该节点，如果为 `True`，节点将在后续某个时间点再执行。               |

defer “当前节点的执行结果不要马上触发后续节点调度，而是延迟到下一轮 tick 才处理。”

defer 的典型用途是：
1. 控制执行节奏：防止在一个 tick 中出现过长的同步调用链（避免阻塞或递归过深）。
2. 批量处理：有些节点需要等到本轮所有节点都跑完后再统一处理下游任务（比如聚合节点、合并更新）。
3. 分阶段执行：让某些逻辑分多个 tick 进行，保持每个 tick 内状态变更的可控性和可观测性。

#### add_node 执行逻辑

下面是 add_node 带注释的源码:
1. 参数检查和标准化入参
2. 根据类型注解，推断 input_schema 和 ends(跳转的目标节点)
3. 将 node 构造成 StateNodeSpec 并添加到 self.nodes 属性中

```python
    def add_node(
        self,
        node: str | StateNode[NodeInputT, ContextT],
        action: StateNode[NodeInputT, ContextT] | None = None,
        *,
        defer: bool = False,
        metadata: dict[str, Any] | None = None,
        input_schema: type[NodeInputT] | None = None,
        retry_policy: RetryPolicy | Sequence[RetryPolicy] | None = None,
        cache_policy: CachePolicy | None = None,
        destinations: dict[str, str] | tuple[str, ...] | None = None,
        **kwargs: Unpack[DeprecatedKwargs],
    ) -> Self:
        if (retry := kwargs.get("retry", MISSING)) is not MISSING:
            warnings.warn(
                "`retry` is deprecated and will be removed. Please use `retry_policy` instead.",
                category=LangGraphDeprecatedSinceV05,
            )
            if retry_policy is None:
                retry_policy = retry  # type: ignore[assignment]

        if (input_ := kwargs.get("input", MISSING)) is not MISSING:
            warnings.warn(
                "`input` is deprecated and will be removed. Please use `input_schema` instead.",
                category=LangGraphDeprecatedSinceV05,
            )
            if input_schema is None:
                input_schema = cast(Union[type[NodeInputT], None], input_)

        if not isinstance(node, str):
            action = node
            if isinstance(action, Runnable):
                node = action.get_name()
            else:
                node = getattr(action, "__name__", action.__class__.__name__)
            if node is None:
                raise ValueError(
                    "Node name must be provided if action is not a function"
                )
        if self.compiled:
            logger.warning(
                "Adding a node to a graph that has already been compiled. This will "
                "not be reflected in the compiled graph."
            )
        # 检查前面 node 的返回值，进行二次检查
        if not isinstance(node, str):
            action = node
            node = cast(str, getattr(action, "name", getattr(action, "__name__", None)))
            if node is None:
                raise ValueError(
                    "Node name must be provided if action is not a function"
                )
        if action is None:
            raise RuntimeError
        if node in self.nodes:
            raise ValueError(f"Node `{node}` already present.")
        if node == END or node == START:
            raise ValueError(f"Node `{node}` is reserved.")

        for character in (NS_SEP, NS_END):
            if character in node:
                raise ValueError(
                    f"'{character}' is a reserved character and is not allowed in the node names."
                )

        inferred_input_schema = None

        ends: tuple[str, ...] | dict[str, str] = EMPTY_SEQ
        try:
            if (
                isfunction(action)
                or ismethod(action)
                or ismethod(getattr(action, "__call__", None))
            ) and (
                # type_hints = {"param": param_type}
                hints := get_type_hints(getattr(action, "__call__"))
                or get_type_hints(action)
            ):
                if input_schema is None:
                    # 获取 action 第一个参数
                    first_parameter_name = next(
                        iter(
                            inspect.signature(
                                cast(FunctionType, action)
                            ).parameters.keys()
                        )
                    )
                    # 获取第一个参数的 type_hints
                    if input_hint := hints.get(first_parameter_name):
                        # 如果参数的 type_hints 是一个类，并且这个类还能获取 type_hints 说明是一个带注解的类型
                        if isinstance(input_hint, type) and get_type_hints(input_hint):
                            inferred_input_schema = input_hint
                # 从返回值推断 ends
                if rtn := hints.get("return"):
                    # Handle Union types
                    rtn_origin = get_origin(rtn)
                    # 处理 Union(...) 的情况，寻找 Command[...] 类型
                    if rtn_origin is Union:
                        # T = TypeVar('T')
                        # get_args(Union[int, Union[T, int], str][int]) == (int, str)
                        rtn_args = get_args(rtn)
                        # Look for Command in the union
                        for arg in rtn_args:
                            arg_origin = get_origin(arg)
                            if arg_origin is Command:
                                rtn = arg
                                rtn_origin = arg_origin
                                break

                    # Check if it's a Command type
                    
                    # def f1(state: State) -> Command[Literal["A", "B"]]
                    # def f2(state: State) -> Union[State, Command[Literal["X"]]]:
                    # 如果函数直接返回 Command[str]（非 Literal），或者 Command 的参数不是 Literal，代码就不会把 ends 填上具体值
                    if (
                        rtn_origin is Command
                        and (rargs := get_args(rtn))
                        # 只处理 Command[Literal[...]] 这种明确列出目标节点名字的写法
                        and get_origin(rargs[0]) is Literal
                        and (vals := get_args(rargs[0]))
                    ):
                        ends = vals
        except (NameError, TypeError, StopIteration):
            pass

        if destinations is not None:
            ends = destinations

        if input_schema is not None:
            self.nodes[node] = StateNodeSpec[NodeInputT, ContextT](
                coerce_to_runnable(action, name=node, trace=False),  # type: ignore[arg-type]
                metadata,
                input_schema=input_schema,
                retry_policy=retry_policy,
                cache_policy=cache_policy,
                ends=ends,
                defer=defer,
            )
        elif inferred_input_schema is not None:
            self.nodes[node] = StateNodeSpec(
                coerce_to_runnable(action, name=node, trace=False),  # type: ignore[arg-type]
                metadata,
                input_schema=inferred_input_schema,
                retry_policy=retry_policy,
                cache_policy=cache_policy,
                ends=ends,
                defer=defer,
            )
        else:
            self.nodes[node] = StateNodeSpec[StateT, ContextT](
                coerce_to_runnable(action, name=node, trace=False),  # type: ignore[arg-type]
                metadata,
                # 默认使用 state_schema 作为入参
                input_schema=self.state_schema,
                retry_policy=retry_policy,
                cache_policy=cache_policy,
                ends=ends,
                defer=defer,
            )

        input_schema = input_schema or inferred_input_schema
        if input_schema is not None:
            self._add_schema(input_schema)

        return self
```

### 2.5 add_edge
add_edge:
1. 如果 start_key 是单节点，添加到 self.edges
2. 如果 start_key 是多节点，添加到 self.waiting_edges


```python
    def add_edge(self, start_key: str | list[str], end_key: str) -> Self:
        if self.compiled:
            logger.warning(
                "Adding an edge to a graph that has already been compiled. This will "
                "not be reflected in the compiled graph."
            )

        if isinstance(start_key, str):
            if start_key == END:
                raise ValueError("END cannot be a start node")
            if end_key == START:
                raise ValueError("START cannot be an end node")

            # run this validation only for non-StateGraph graphs
            if not hasattr(self, "channels") and start_key in set(
                start for start, _ in self.edges
            ):
                raise ValueError(
                    f"Already found path for node '{start_key}'.\n"
                    "For multiple edges, use StateGraph with an Annotated state key."
                )
            # start_key 是单节点，添加到 self.edges
            self.edges.add((start_key, end_key))
            return self

        for start in start_key:
            if start == END:
                raise ValueError("END cannot be a start node")
            if start not in self.nodes:
                raise ValueError(f"Need to add_node `{start}` first")
        if end_key == START:
            raise ValueError("START cannot be an end node")
        if end_key != END and end_key not in self.nodes:
            raise ValueError(f"Need to add_node `{end_key}` first")

        self.waiting_edges.add((tuple(start_key), end_key))
        return self
```

### 2.6 add_conditional_edges

conditional_edges 以 BranchSpec 保存在 self.branches 中。这里我们需要重点理解 BranchSpec

```python
    def add_conditional_edges(
        self,
        source: str,
        path: (
            Callable[..., Hashable | list[Hashable]]
            | Callable[..., Awaitable[Hashable | list[Hashable]]]
            | Runnable[Any, Hashable | list[Hashable]]
        ),
        path_map: dict[Hashable, str] | list[str] | None = None,
    ) -> Self:
        if self.compiled:
            logger.warning(
                "Adding an edge to a graph that has already been compiled. This will "
                "not be reflected in the compiled graph."
            )

        # find a name for the condition
        path = coerce_to_runnable(path, name=None, trace=True)
        name = path.name or "condition"
        # validate the condition
        if name in self.branches[source]:
            raise ValueError(
                f"Branch with name `{path.name}` already exists for node `{source}`"
            )
        # save it
        self.branches[source][name] = BranchSpec.from_path(path, path_map, True)
        if schema := self.branches[source][name].input_schema:
            self._add_schema(schema)
        return self
```

关于边的处理，目前我们可以做一个简单的总结:
1. 如果起点是但节点，边会添加到 self.edges
2. 如果起点是多节点，边会添加到 self.waiting_edges
3. 如果是 condition_edge，边会添加到 self.branches

## 2.7 validate

StateGragph 在 compile 之前会调用 validate 进行参数校验。主要校验的逻辑是，边的起点、结束点是否在 self.nodes 中，以及中断是否在 self.nodes 内。

```python
    def validate(self, interrupt: Sequence[str] | None = None) -> Self:
        # assemble sources
        # 所有边的起点
        all_sources = {src for src, _ in self._all_edges}

        # 所有 condition_edge 的起点
        for start, branches in self.branches.items():
            all_sources.add(start)
        # 所有节点的终点
        for name, spec in self.nodes.items():
            if spec.ends:
                all_sources.add(name)
        # validate sources
        for source in all_sources:
            if source not in self.nodes and source != START:
                raise ValueError(f"Found edge starting at unknown node '{source}'")

        if START not in all_sources:
            raise ValueError(
                "Graph must have an entrypoint: add at least one edge from START to another node"
            )

        # assemble targets
        # 所有边的终点
        all_targets = {end for _, end in self._all_edges}
        for start, branches in self.branches.items():
            for cond, branch in branches.items():
                # ends: dict[Hashable, str] | None
                if branch.ends is not None:
                    for end in branch.ends.values():
                        if end not in self.nodes and end != END:
                            raise ValueError(
                                f"At '{start}' node, '{cond}' branch found unknown target '{end}'"
                            )
                        all_targets.add(end)
                else:
                    # 如果 branch.ends 为空 → 说明分支可能跳到任意节点或直接结束（END）
                    all_targets.add(END)
                    # 把所有节点添加到 target
                    for node in self.nodes:
                        if node != start:
                            all_targets.add(node)
        for name, spec in self.nodes.items():
            if spec.ends:
                all_targets.update(spec.ends)
        for target in all_targets:
            if target not in self.nodes and target != END:
                raise ValueError(f"Found edge ending at unknown node `{target}`")
        # validate interrupts
        # 检查终端、终端必须在 self.nodes
        if interrupt:
            for node in interrupt:
                if node not in self.nodes:
                    raise ValueError(f"Interrupt node `{node}` not found")

        self.compiled = True
        return self
```

### 2.8 compile
compile 将 Stategraph 编译成 CompiledStateGraph，CompiledStateGraph 继承自 pregel 是 langgraph的运行时。从compile 代码可以看到除了正常的参数传递，CompiledStateGraph 还调用了三个函数:
1. attach_node: 将 StateNodeSpec 转换为 PregelNode
2. attach_edge: 处理 edge
3. attach_branch: 处理 condition_edge

CompiledStateGraph 是如何与 Pregel 关联起来的，我们放到了 [langgraph api 流程总结](./46_api_summary.md) 中。

```python
def compile(
        self,
        checkpointer: Checkpointer = None,
        *,
        cache: BaseCache | None = None,
        store: BaseStore | None = None,
        interrupt_before: All | list[str] | None = None,
        interrupt_after: All | list[str] | None = None,
        debug: bool = False,
        name: str | None = None,
    ) -> CompiledStateGraph[StateT, ContextT, InputT, OutputT]:
        """Compiles the state graph into a `CompiledStateGraph` object.

        The compiled graph implements the `Runnable` interface and can be invoked,
        streamed, batched, and run asynchronously.

        Args:
            checkpointer: A checkpoint saver object or flag.
                If provided, this Checkpointer serves as a fully versioned "short-term memory" for the graph,
                allowing it to be paused, resumed, and replayed from any point.
                If None, it may inherit the parent graph's checkpointer when used as a subgraph.
                If False, it will not use or inherit any checkpointer.
            interrupt_before: An optional list of node names to interrupt before.
            interrupt_after: An optional list of node names to interrupt after.
            debug: A flag indicating whether to enable debug mode.
            name: The name to use for the compiled graph.

        Returns:
            CompiledStateGraph: The compiled state graph.
        """
        # 1. Stategraph 参数校验
        interrupt_before = interrupt_before or []
        interrupt_after = interrupt_after or []

        # validate the graph
        self.validate(
            interrupt=(
                (interrupt_before if interrupt_before != "*" else []) + interrupt_after
                if interrupt_after != "*"
                else []
            )
        )

        # prepare output channels
        output_channels = (
            "__root__"
            if len(self.schemas[self.output_schema]) == 1
            and "__root__" in self.schemas[self.output_schema]
            else [
                key
                for key, val in self.schemas[self.output_schema].items()
                if not is_managed_value(val)
            ]
        )
        stream_channels = (
            "__root__"
            if len(self.channels) == 1 and "__root__" in self.channels
            else [
                key for key, val in self.channels.items() if not is_managed_value(val)
            ]
        )

        compiled = CompiledStateGraph[StateT, ContextT, InputT, OutputT](
            builder=self,
            schema_to_mapper={},
            context_schema=self.context_schema,
            nodes={},
            channels={
                **self.channels,
                **self.managed,
                START: EphemeralValue(self.input_schema),
            },
            input_channels=START,
            stream_mode="updates",
            output_channels=output_channels,
            stream_channels=stream_channels,
            checkpointer=checkpointer,
            interrupt_before_nodes=interrupt_before,
            interrupt_after_nodes=interrupt_after,
            auto_validate=False,
            debug=debug,
            store=store,
            cache=cache,
            name=name or "LangGraph",
        )

        compiled.attach_node(START, None)
        for key, node in self.nodes.items():
            compiled.attach_node(key, node)

        for start, end in self.edges:
            compiled.attach_edge(start, end)

        for starts, end in self.waiting_edges:
            compiled.attach_edge(starts, end)

        for start, branches in self.branches.items():
            for name, branch in branches.items():
                compiled.attach_branch(start, name, branch)

        return compiled.validate()
```
示例代码中，我们还用到了 ToolNode, tools_condition 这里我们介绍一下他们的实现。


## 3. ToolNode

### 3.1 初始化
在调用 `graph_builder.add_node("tools", tool_node)` 时:
1. tool_node 不是可调用对象，所以不会尝试从参数中解析出 input_schema
2. tool_node 的 input_schema 默认为 state_schema
3. ToolNode 初始化有个特殊的 messages_key 参数。就是指定从 input_schema 读取 message 需要访问的字段名。

```python
class ToolNode(RunnableCallable):

    name: str = "ToolNode"

    def __init__(
        self,
        tools: Sequence[Union[BaseTool, Callable]],
        *,
        name: str = "tools",
        tags: Optional[list[str]] = None,
        handle_tool_errors: Union[
            bool, str, Callable[..., str], tuple[type[Exception], ...]
        ] = True,
        messages_key: str = "messages",
    ) -> None:
        """Initialize the ToolNode with the provided tools and configuration.

        Args:
            tools: Sequence of tools to make available for execution.
            name: Node name for graph identification.
            tags: Optional metadata tags.
            handle_tool_errors: Error handling configuration.
            messages_key: State key containing messages.
        """
        # 1. 初始化 RunnableCallable
        super().__init__(self._func, self._afunc, name=name, tags=tags, trace=False)
        self.tools_by_name: dict[str, BaseTool] = {}
        self.tool_to_state_args: dict[str, dict[str, Optional[str]]] = {}
        self.tool_to_store_arg: dict[str, Optional[str]] = {}
        self.handle_tool_errors = handle_tool_errors
        self.messages_key = messages_key
        for tool_ in tools:
            if not isinstance(tool_, BaseTool):
                tool_ = create_tool(tool_)
            self.tools_by_name[tool_.name] = tool_
            # tool inject 处理
            self.tool_to_state_args[tool_.name] = _get_state_args(tool_)
            self.tool_to_store_arg[tool_.name] = _get_store_arg(tool_)
```

#### _get_state_args

_get_state_args 函数是在 LangGraph 里用来分析 Tool 的输入参数，看哪些参数需要自动从 graph state 注入的。

```python
def _get_state_args(tool: BaseTool) -> dict[str, Optional[str]]:
    """
    分析 Tool 的输入 schema，找出需要自动从 Graph State 注入的参数。

    返回一个映射：
        key   = tool 的参数名
        value = 对应 state 的字段名（如果 None 表示直接注入整个 state）
    """
    # 获取 tool 的完整输入 schema（通常是一个 pydantic.BaseModel）
    full_schema = tool.get_input_schema()

    # 存放映射关系：{ tool参数名: state字段名 或 None }
    tool_args_to_state_fields: dict = {}

    # 遍历 schema 中的所有字段及类型注解
    for name, type_ in get_all_basemodel_annotations(full_schema).items():
        # 找出这个字段的类型参数里所有 InjectedState 注解
        injections = [
            type_arg
            for type_arg in get_args(type_)  # 从 Union[...]、Annotated[...] 里取参数类型
            if _is_injection(type_arg, InjectedState)
        ]

        # 如果同一个参数里标了多个 InjectedState，是不合法的
        if len(injections) > 1:
            raise ValueError(
                f"参数 {name} 上有多个 InjectedState 注解，这是不允许的。"
            )

        # 如果正好有一个 InjectedState 注解
        elif len(injections) == 1:
            injection = injections[0]

            # 如果注解里指定了 field 名，就映射到该 field
            if isinstance(injection, InjectedState) and injection.field:
                tool_args_to_state_fields[name] = injection.field
            # 否则表示整个 state 注入
            else:
                tool_args_to_state_fields[name] = None

        # 如果没有 InjectedState 注解，跳过
        else:
            pass

    return tool_args_to_state_fields

```

执行过程:
* **目标**：找到 Tool 参数中用 `InjectedState` 注解的字段。
* 如果 `InjectedState(field="xxx")` → 说明只注入 `state["xxx"]`。
* 如果 `InjectedState()` → 注入整个 state。
* 如果没加注解 → 不自动注入。
* 如果加了多个 `InjectedState` → 抛错。

下面是一个代码示例:

```python
class MyState(TypedDict):
    user_id: str
    session_data: dict
```

然后你有一个 Tool 输入 schema：

```python
from langchain_core.tools import BaseTool
from langgraph.prebuilt import InjectedState
from typing import Annotated
from pydantic import BaseModel

class MyToolInput(BaseModel):
    # 注入整个 state
    state: Annotated[dict, InjectedState()]
    
    # 只注入 state["user_id"]
    uid: Annotated[str, InjectedState(field="user_id")]

    # 普通参数（不会注入）
    query: str

    # 需要注入 store
    store: Annotated[dict, InjectedStore()]

class MyTool(BaseTool):
    name = "my_tool"
    description = "Example tool"
    args_schema = MyToolInput

    def _run(self, state, uid, query):
        return f"Got uid={uid}, query={query}, state_keys={list(state.keys())}"
```

调用 `_get_state_args(MyTool())`：

```python
result = _get_state_args(MyTool())
print(result)
```

输出：

```python
{
    "state": None,          # None → 表示注入整个 state
    "uid": "user_id"        # 注入 state["user_id"]
}
```

#### _get_store_arg
_get_store_arg 和 _get_state_args 很像，只不过它是专门检测 Tool 里是否有参数需要注入 graph store。

_get_store_arg 只找 InjectedStore 注解（区别于 _get_state_args 里找的是 InjectedState）。

```python
def _get_store_arg(tool: BaseTool) -> Optional[str]:
    """Extract store injection argument from tool annotations.

    This function analyzes a tool's input schema to identify the argument that
    should be injected with the graph store. Only one store argument is supported
    per tool.

    Args:
        tool: The tool to analyze for store injection requirements.

    Returns:
        The name of the argument that should receive the store injection, or None
        if no store injection is required.

    Raises:
        ValueError: If a tool argument has multiple InjectedStore annotations.
    """
    full_schema = tool.get_input_schema()
    for name, type_ in get_all_basemodel_annotations(full_schema).items():
        injections = [
            type_arg
            for type_arg in get_args(type_)
            # InjectedStore
            if _is_injection(type_arg, InjectedStore)
        ]
        if len(injections) > 1:
            raise ValueError(
                "A tool argument should not be annotated with InjectedStore more than "
                f"once. Received arg {name} with annotations {injections}."
            )
        elif len(injections) == 1:
            return name
        else:
            pass

    return None
```

#### _inject_state

这段 `_inject_state` 是 LangGraph 在 Tool 执行前，**把 Graph State 里需要的字段自动注入到 Tool 参数**的关键步骤:

1. 读取 `tool_to_state_args`（来自 `_get_state_args` 生成的映射）。
2. 检查输入格式是否和注入要求匹配。
3. 从 Graph State 里取出对应字段，自动塞进 Tool 的参数里。
4. 返回带有完整参数的 `tool_call`。


```python
    def _inject_state(
        self,
        tool_call: ToolCall,
        input: Union[
            list[AnyMessage],
            dict[str, Any],
            BaseModel,
        ],
    ) -> ToolCall:
        # * 从 `tool_to_state_args`（形如 `{ "tool_name": { "arg_name": "state_field" | None } }`）中取出当前这个 Tool 的映射规则。
        state_args = self.tool_to_state_args[tool_call["name"]]
        # * 如果 `state_args` 不为空，并且 `input` 是 **list** 类型（比如消息列表 `list[AnyMessage]`）：
        if state_args and isinstance(input, list):
            required_fields = list(state_args.values())
            if (
                len(required_fields) == 1
                # 只需要一个字段，并且字段名等于 `self.messages_key`
                and required_fields[0] == self.messages_key
                # `None`（表示整个 state）
                or required_fields[0] is None
            ):
                input = {self.messages_key: input}
            else:
                err_msg = (
                    f"Invalid input to ToolNode. Tool {tool_call['name']} requires "
                    f"graph state dict as input."
                )
                if any(state_field for state_field in state_args.values()):
                    required_fields_str = ", ".join(f for f in required_fields if f)
                    err_msg += f" State should contain fields {required_fields_str}."
                raise ValueError(err_msg)
        # 兼容一个特殊格式
        # {
        # "__type": "tool_call_with_context",
        # "state": {...}
        # }
        if isinstance(input, dict) and input.get("__type") == "tool_call_with_context":
            state = input["state"]
        else:
            state = input

        if isinstance(state, dict):
            tool_state_args = {
                # 从 state 中提取 tool inject 的参数
                tool_arg: state[state_field] if state_field else state
                for tool_arg, state_field in state_args.items()
            }
        else:
            tool_state_args = {
                tool_arg: getattr(state, state_field) if state_field else state
                for tool_arg, state_field in state_args.items()
            }
        # 合并 tool 参数
        tool_call["args"] = {
            **tool_call["args"],
            **tool_state_args,
        }
        return tool_call
```

#### _inject_store

```python
    def _inject_store(
        self, tool_call: ToolCall, store: Optional[BaseStore]
    ) -> ToolCall:
        store_arg = self.tool_to_store_arg[tool_call["name"]]
        if not store_arg:
            return tool_call

        if store is None:
            raise ValueError(
                "Cannot inject store into tools with InjectedStore annotations - "
                "please compile your graph with a store."
            )

        tool_call["args"] = {
            **tool_call["args"],
            store_arg: store,
        }
        return tool_call
```

总结一下:
1. inject_store, inject_state 是把 State 的字段映射进 tool_call 的 arg 参数内，发生在 ToolNode 中
2. InjectedToolCallId 是往 Tool.func 传入 tool_id，发生在 tool.run 方法内。

### 3.2 _func
ToolNode 继承自 RunnableCallable，ToolNode.invoke 将调用 ToolNodel._func。

```python

    def _func(
        self,
        input: Union[
            list[AnyMessage],
            dict[str, Any],
            BaseModel,
        ],
        config: RunnableConfig,
        *,
        store: Optional[BaseStore],
    ) -> Any:
        #  从 input 中解析出 tool_calls
        # 对于实例就是，通过 message_key 访问 state_schema 中的 messages，取最后一个 AIMessage
        tool_calls, input_type = self._parse_input(input)
        # 给 tool_call 注入参数，返回完整的 tool_call
        tool_calls = [self.inject_tool_args(call, input, store) for call in tool_calls]
        # 为每一个 tool_call 生成一份配置
        config_list = get_config_list(config, len(tool_calls))
        input_types = [input_type] * len(tool_calls)
        # 使用线程池执行 tool_calls
        with get_executor_for_config(config) as executor:
            outputs = [
                # 实际执行运行的是 _run_one
                *executor.map(self._run_one, tool_calls, input_types, config_list)
            ]

        return self._combine_tool_outputs(outputs, input_type)
```

### 3.3 _run_one

_run_one 会执行一下逻辑:
1. 校验 toll_call 中的 tool 是否在输入的 tool 中
2. 执行 tool.invoke 并处理异常
3. 针对 tool 返回 Command 类型的返回值做校验

```python
    def _run_one(
        self,
        call: ToolCall,                         # 单个 tool 调用的数据（包含 name、id、args 等）
        input_type: Literal["list", "dict", "tool_calls"],  # 输入数据的格式类型
        config: RunnableConfig,                 # 执行时的配置信息（RunnableConfig）
    ) -> ToolMessage:
        """同步执行一次单个 tool 调用。"""
        
        # 先验证 tool 调用是否合法（比如是否存在该 tool，参数是否正确等）
        # 如果验证失败，直接返回一个表示无效调用的 ToolMessage
        if invalid_tool_message := self._validate_tool_call(call):
            return invalid_tool_message

        try:
            # 构造调用参数：把 call 内容展开，并加上 type="tool_call" 标记
            call_args = {**call, **{"type": "tool_call"}}
            
            # 根据 tool 名字找到对应的 tool 实例，并调用其 invoke() 方法执行
            # 这里会进入具体 tool 的实现逻辑
            response = self.tools_by_name[call["name"]].invoke(call_args, config)

        # -------------------- 特殊中断处理（GraphInterrupt 系列） --------------------
        # GraphBubbleUp 是 GraphInterrupt 的一种，它不会被吞掉，而是直接抛出
        # 常见触发场景：
        # (1) tool 内部显式抛出了 GraphInterrupt
        # (2) graph 节点（作为 tool 调用）中抛出了 GraphInterrupt
        # (3) 子图被中断，而该子图是通过 tool 调用的
        except GraphBubbleUp as e:
            raise e

        # -------------------- 普通异常处理 --------------------
        except Exception as e:
            # 确定哪些异常类型需要被处理（其余的直接抛出）
            if isinstance(self.handle_tool_errors, tuple):
                handled_types: tuple = self.handle_tool_errors
            elif callable(self.handle_tool_errors):
                # 根据一个“自定义错误处理函数”的类型注解，推断它能处理哪些异常类型，并返回一个 tuple 形式的异常类型集合。
                handled_types = _infer_handled_types(self.handle_tool_errors)
            else:
                # 默认处理所有异常
                handled_types = (Exception,)

            # 如果没有配置处理函数，或者异常类型不在可处理列表里 → 直接抛出
            if not self.handle_tool_errors or not isinstance(e, handled_types):
                raise e
            # 否则使用配置的处理逻辑生成错误内容
            else:
                content = _handle_tool_error(e, flag=self.handle_tool_errors)

            # 返回一个带错误状态的 ToolMessage，通知调用方 tool 执行失败
            return ToolMessage(
                content=content,           # 错误描述
                name=call["name"],          # tool 名字
                tool_call_id=call["id"],    # 对应的调用 ID
                status="error",             # 标记为错误
            )

        # -------------------- 正常返回处理 --------------------
        # 如果 tool 返回的是 Command 类型，进入命令验证逻辑
        if isinstance(response, Command):
            return self._validate_tool_command(response, call, input_type)
        
        # 如果返回的是 ToolMessage，处理其 content 内容的格式
        elif isinstance(response, ToolMessage):
            # msg_content_output 会把 content 转成标准的 str 或 list 格式
            response.content = cast(
                Union[str, list], msg_content_output(response.content)
            )
            return response

        # 如果返回的是未知类型，直接报错
        else:
            raise TypeError(
                f"Tool {call['name']} returned unexpected type: {type(response)}"
            )
```

### 3.4 _validate_tool_command
_validate_tool_command 对 tool 返回的 Command 类型做校验:
1. Command.update 类型校验：必须和输入格式匹配（dict ↔ dict，list ↔ list）
2. 工具调用回复验证：必须有一个 ToolMessage，且 tool_call_id 对应当前的 call.id

```python
    def _validate_tool_command(
        self,
        command: Command,
        call: ToolCall,
        input_type: Literal["list", "dict", "tool_calls"],
    ) -> Command:
        """
        验证一个工具节点（ToolNode）返回的 Command 对象是否符合要求。
        主要确保：
        1. Command.update 的类型（list/dict）要与输入数据类型匹配
        2. Command.update 中的消息里必须包含与当前 tool_call 对应的 ToolMessage
        """

        if isinstance(command.update, dict):
            # ✅ Command.update 是 dict 的情况：
            # 这种情况一般出现在 ToolNode 输入是字典格式，例如：
            # {"messages": [AIMessage(..., tool_calls=[...])]}
            if input_type not in ("dict", "tool_calls"):
                raise ValueError(
                    f"Tools can provide a dict in Command.update only when using dict with '{self.messages_key}' key as ToolNode input, "
                    f"got: {command.update} for tool '{call['name']}'"
                )

            # 复制 command 避免修改原对象
            updated_command = deepcopy(command)
            # 强制类型转换，确保是 dict
            state_update = cast(dict[str, Any], updated_command.update) or {}
            # 从 dict 中取出 messages_key 对应的消息列表
            messages_update = state_update.get(self.messages_key, [])

        elif isinstance(command.update, list):
            # ✅ Command.update 是 list 的情况：
            # 这种情况一般出现在 ToolNode 输入是消息列表，例如：
            # [AIMessage(..., tool_calls=[...])]
            if input_type != "list":
                raise ValueError(
                    f"Tools can provide a list of messages in Command.update only when using list of messages as ToolNode input, "
                    f"got: {command.update} for tool '{call['name']}'"
                )

            # 复制 command
            updated_command = deepcopy(command)
            messages_update = updated_command.update

        else:
            # ❌ 如果 update 不是 list 也不是 dict，直接返回原始 command（无需校验）
            return command

        # 将 messages_update 中的元素统一转换为 Message 对象（如果是 dict 格式则会变成对象）
        messages_update = convert_to_messages(messages_update)

        # 特殊情况：如果 messages_update 只包含一个 RemoveMessage(REMOVE_ALL_MESSAGES)
        # 表示要清空所有消息，则不需要做后续验证
        if messages_update == [RemoveMessage(id=REMOVE_ALL_MESSAGES)]:
            return updated_command

        # 检查 Command.update 中是否存在与当前 tool_call 匹配的 ToolMessage
        has_matching_tool_message = False
        for message in messages_update:
            if not isinstance(message, ToolMessage):
                continue

            # 匹配上 tool_call_id，说明这是该工具调用的回复
            if message.tool_call_id == call["id"]:
                # 补齐 ToolMessage.name，确保和 call.name 一致
                message.name = call["name"]
                has_matching_tool_message = True

        # 如果 Command 是发给当前图（graph is None），但没有匹配的 ToolMessage，就报错
        if updated_command.graph is None and not has_matching_tool_message:
            # 提供一个修复用的示例
            example_update = (
                '`Command(update={"messages": [ToolMessage("Success", tool_call_id=tool_call_id), ...]}, ...)`'
                if input_type == "dict"
                else '`Command(update=[ToolMessage("Success", tool_call_id=tool_call_id), ...], ...)`'
            )
            raise ValueError(
                f"Expected to have a matching ToolMessage in Command.update for tool '{call['name']}', got: {messages_update}. "
                "Every tool call (LLM requesting to call a tool) in the message history MUST have a corresponding ToolMessage. "
                f"You can fix it by modifying the tool to return {example_update}."
            )

        return updated_command

```
### 3.5 _combine_tool_outputs

_combine_tool_outputs 用于合并多个 tool_call 的输出结果。

```python
def _combine_tool_outputs(
    self,
    outputs: list[ToolMessage],
    input_type: Literal["list", "dict", "tool_calls"],
) -> list[Union[Command, list[ToolMessage], dict[str, list[ToolMessage]]]]:
    # 如果 outputs 中没有任何 Command 类型（只有普通的 ToolMessage）
    # 那么直接保持原有行为（兼容旧版本的逻辑）
    if not any(isinstance(output, Command) for output in outputs):
        # 如果 input_type == "list"，直接返回原列表
        # 否则（"dict" 模式），返回一个字典，key 为 self.messages_key，值是 outputs 列表
        return outputs if input_type == "list" else {self.messages_key: outputs}

    # 如果 outputs 里包含了 Command
    # 就需要组合 Command 和非 Command 的输出
    # LangGraph 会自动处理 Command 列表和普通节点更新
    combined_outputs: list[
        Command | list[ToolMessage] | dict[str, list[ToolMessage]]
    ] = []

    # parent_command 用于收集所有 "父级图" Command（graph == Command.PARENT）的 goto
    # 因为这些 goto 都可以合并到同一个 Command 里
    parent_command: Optional[Command] = None

    # 遍历所有输出
    for output in outputs:
        if isinstance(output, Command):
            # 如果是父图 Command，且 goto 是 Send 对象列表（代表跳转/发消息的指令）
            if (
                output.graph is Command.PARENT
                and isinstance(output.goto, list)
                and all(isinstance(send, Send) for send in output.goto)
            ):
                if parent_command:
                    # 如果已有 parent_command，则合并它的 goto 列表
                    parent_command = replace(
                        parent_command,
                        goto=cast(list[Send], parent_command.goto) + output.goto,
                    )
                else:
                    # 否则创建一个新的 parent_command
                    parent_command = Command(graph=Command.PARENT, goto=output.goto)
            else:
                # 如果是其他 Command（非父图的 Command），直接加入结果列表
                combined_outputs.append(output)
        else:
            # 如果是普通 ToolMessage
            # 根据 input_type 的不同，包装成 list 或 dict
            combined_outputs.append(
                [output] if input_type == "list" else {self.messages_key: [output]}
            )

    # 如果有合并后的 parent_command，放到结果列表最后
    if parent_command:
        combined_outputs.append(parent_command)

    # 返回组合后的输出
    return combined_outputs

```


## 4. tools_condition

tools_condition 的逻辑很简答，就是判断 messages 的最后一条有没有 tool_calls 属性，有就跳转到 tools 节点，否则跳转到 END 节点。

```python
def tools_condition(
    state: Union[list[AnyMessage], dict[str, Any], BaseModel],
    messages_key: str = "messages",
) -> Literal["tools", "__end__"]:

    if isinstance(state, list):
        ai_message = state[-1]
    elif isinstance(state, dict) and (messages := state.get(messages_key, [])):
        ai_message = messages[-1]
    elif messages := getattr(state, messages_key, []):
        ai_message = messages[-1]
    else:
        raise ValueError(f"No messages found in input state to tool_edge: {state}")
    if hasattr(ai_message, "tool_calls") and len(ai_message.tool_calls) > 0:
        return "tools"
    return "__end__"
```