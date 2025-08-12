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

_get_channels 的核心是 _get_channel


```python
def _get_channel(
    name: str, annotation: Any, *, allow_managed: bool = True
) -> BaseChannel | ManagedValueSpec:
    if manager := _is_field_managed_value(name, annotation):
        if allow_managed:
            return manager
        else:
            raise ValueError(f"This {annotation} not allowed in this position")
    elif channel := _is_field_channel(annotation):
        channel.key = name
        return channel
    elif channel := _is_field_binop(annotation):
        channel.key = name
        return channel

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

## 3. ToolNode
示例代码中，我们还用到了 ToolNode, tools_condition 这里我们介绍一下他们的实现。

### 3.1 ToolNode


### 3.2 tools_condition
