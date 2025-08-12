---
weight: 1
title: "langgraph 重要流程总结"
date: 2025-08-12T14:00:00+08:00
lastmod: 2025-08-12T14:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langgraph 重要流程总结"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

现在我们学习完了 Langgraph 的所有内容，本节我们要总结回顾一下 Langgraph 的重要流程，包括
1. 中断和恢复
4. 节点间的参数传递
5. channel finish 的执行逻辑


## 1. 中断和恢复

LangGraph 中，通过 Command, interrupt、checkpointer 可以实现允许根据用户反馈暂停和恢复执行。

### 1.1 使用示例

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
from langgraph.checkpoint.memory import InMemorySaver
from langchain_core.tools import tool
from langgraph.types import Command, interrupt


class State(TypedDict):
    messages: Annotated[list, add_messages]

@tool
# 向聊天机器人添加 human_assistance 工具。此工具使用 interrupt 来接收来自人类的信息。
def human_assistance(query: str) -> str:
    """Request assistance from a human."""
    human_response = interrupt({"query": query})
    return human_response["data"]


graph_builder = StateGraph(State)

tool_search = TavilySearch(max_results=2)
tools = [tool_search, human_assistance]
llm_with_tools = llm.bind_tools(tools)


def chatbot(state: State):
    return {"messages": [llm_with_tools.invoke(state["messages"])]}


graph_builder.add_node("chatbot", chatbot)

tool_node = ToolNode(tools=tools)
graph_builder.add_node("tools", tool_node)

graph_builder.add_conditional_edges(
    "chatbot",
    tools_condition,
)
# Any time a tool is called, we return to the chatbot to decide the next step
graph_builder.add_edge("tools", "chatbot")
graph_builder.add_edge(START, "chatbot")

memory = InMemorySaver()
graph = graph_builder.compile(checkpointer=memory)


# 1. 第一调用，中断在 human_assistance 工具
user_input = "I need some expert guidance for building an AI agent. Could you request assistance for me?"
# 通过相同的 thread_id 关联 checkpoint
config = {"configurable": {"thread_id": "1"}}

events = graph.stream(
    {"messages": [{"role": "user", "content": user_input}]},
    config,
    stream_mode="values",
)
for event in events:
    if "messages" in event:
        event["messages"][-1].pretty_print()


# 2. 第二次调用，通过 Command 传入人工回复，进行恢复
human_response = (
    "We, the experts are here to help! We'd recommend you check out LangGraph to build your agent."
    " It's much more reliable and extensible than simple autonomous agents."
)

human_command = Command(resume={"data": human_response})

events = graph.stream(human_command, config, stream_mode="values")
for event in events:
    if "messages" in event:
        event["messages"][-1].pretty_print()

```

可以看到中断和恢复逻辑核心函数是:
1. interrupt
2. Command

### 1.2 interrupt
要理解 interrupt 函数的逻辑，首先要了解 PregelScratchpad。
1. 这个对象在 prepare_single_task 生成任务的过程中调用 _scratchpad 创建。
2. get_null_resume 尝试从 pending_writes 获取 resume
3. 如果没有存在的 resume 就会出发 GraphInterrupt 异常

```python
def interrupt(value: Any) -> Any:
    # 延迟导入，避免循环依赖
    from langgraph._internal._constants import (
        CONFIG_KEY_CHECKPOINT_NS,  # 当前图执行的 checkpoint 命名空间
        CONFIG_KEY_SCRATCHPAD,     # 存储执行过程临时状态的 key
        CONFIG_KEY_SEND,           # 用于发送事件/数据的 key
        RESUME,                    # 表示“恢复执行”的事件类型
    )
    from langgraph.config import get_config   # 获取当前运行图的配置
    from langgraph.errors import GraphInterrupt  # 特殊异常，用来中断图的执行

    # 获取当前运行时的“configurable”部分配置
    conf = get_config()["configurable"]

    # 获取 scratchpad 对象（用来记录中断点、恢复数据等）
    scratchpad = conf[CONFIG_KEY_SCRATCHPAD]

    # 计算当前的中断序号（第几次 interrupt）
    idx = scratchpad.interrupt_counter()

    # 如果 scratchpad 已经有恢复数据（resume），说明是从 checkpoint 恢复执行
    if scratchpad.resume:
        # 如果当前中断序号还没到已存的 resume 数据长度，说明可以直接返回之前的恢复值
        if idx < len(scratchpad.resume):
            return scratchpad.resume[idx]

    # 如果没有已有 resume 数据，则尝试从 scratchpad 获取一个新的“空恢复值”
    v = scratchpad.get_null_resume(True)
    if v is not None:
        # 确保 resume 的长度和当前中断序号一致
        assert len(scratchpad.resume) == idx, (scratchpad.resume, idx)
        # 把新的恢复值加入 resume 列表
        scratchpad.resume.append(v)
        # 通过 CONFIG_KEY_SEND 发送一个 (RESUME, 当前所有恢复值) 事件
        conf[CONFIG_KEY_SEND]([(RESUME, scratchpad.resume)])
        # 返回这个恢复值
        return v

    # 如果既没有已有 resume 数据，也没有新的恢复值，
    # 那么抛出 GraphInterrupt 异常来中断图执行
    # 这里会构造一个 Interrupt 对象，附带 value 和 checkpoint 命名空间
    raise GraphInterrupt(
        (
            Interrupt.from_ns(
                value=value,
                ns=conf[CONFIG_KEY_CHECKPOINT_NS],
            ),
        )
    )

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

Langgraph 中有很多地方会对异常做处理，典型的有如下几个地方:
1. ToolNode 内，执行 _run_one 方法是，会对 tool 的执行做异常处理
2. run_with_retry 实际执行 task 时会对 task 的执行做异常处理

这些地方都不会对 GraphInterrupt 做容错处理。

GraphInterrupt 异常会在如下调用中被处理:
1. Runner.tick
2. PregelLoop.__exit__


```python
class PregelRunner:
    def tick():
            try:
                run_with_retry()
                self.commit(t, None)
            except Exception as exc:
                self.commit(t, exc)
                if reraise and futures:
                elif reraise:
                    raise

    def commit(
        self,
        task: PregelExecutableTask,
        exception: BaseException | None,
    ) -> None:
        elif exception:
            if isinstance(exception, GraphInterrupt):
                # save interrupt to checkpointer
                if exception.args[0]:
                    writes = [(INTERRUPT, exception.args[0])]
                    if resumes := [w for w in task.writes if w[0] == RESUME]:
                        writes.extend(resumes)
                    self.put_writes()(task.id, writes)  # type: ignore[misc]
            elif isinstance(exception, GraphBubbleUp):
                # exception will be raised in _panic_or_proceed
                pass
            else:
                # save error to checkpointer
                task.writes.append((ERROR, exception))
                self.put_writes()(task.id, task.writes)  # type: ignore[misc]
```

当捕获到 `GraphInterrupt` 时：

* 先把 `(INTERRUPT, exception.args[0])` 写入 checkpoint，标记这个任务被中断。
* 再把**同一次中断**中已经生成的所有 `(RESUME, …)` 事件附加上去。
* 这样 checkpoint 中就同时保存了：

  * 中断的触发原因（INTERRUPT）
  * 已知的恢复值（RESUME 列表）

这样做的好处是：

* **完整恢复上下文**：下次 resume 时，不仅知道停在哪，还能知道 resume 数据是什么。
* **支持多次 interrupt**：`scratchpad.resume` 可能会有多个值（比如多阶段暂停/恢复）。


## 2. 节点间的参数传递

首先 Langgraph 中定义的所有 node 都有一个 input_schema，input_schema 中的所有字段都会被包装为 channel 称为 `input_channels`。

从 _get_channel 的实现中可以看到
1. schema 申明的所有字段都会被包装为 channel
2. Langgraph 中所谓的 reducer，对应为 BinaryOperatorAggregate channel

每一个 input_schema 对应的 channel 都收集在 StateGraph.schemas 属性内。

```python
def chatbot(state: State):
    return {"messages": [llm_with_tools.invoke(state["messages"])]}

graph_builder.add_node("chatbot", chatbot)

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
```

在 compile 时，attach_node 会将 node 转换为 PregelNode 时，Pregel.channels 会设置为 `input_channels`。并且每一个 PregelNode 都会涉疫 mapper，这个 mapper 通过闭包保存了 input_schema。

```python
            mapper = _pick_mapper(input_channels, input_schema)
            # 从 StateGraph.schema 读取出 input_schema 对应的 channel
            input_channels = list(self.builder.schemas[input_schema])
            self.nodes[key] = PregelNode(
                triggers=[branch_channel],
                # read state keys and managed values
                # 设置为 input_channels
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

### 2.1 node 参数传递

我们从前面的 Pregel 实现中就已经知道，prepare_single_task 在生成任务时 会调用 _proc_input：
1. 从 channel 读取数据
2. 调用 mapper 转换输入

```python
def prepare_single_task(
    elif task_path[0] == PULL:
        # (PULL, node name)
        if _triggers():
            # create task input
            try:
                val = _proc_input(
                    proc,
                    managed,
                    channels,
                    for_execution=for_execution,
                    input_cache=input_cache,
                    scratchpad=scratchpad,
                )
                if val is MISSING:
                    return

def _proc_input():
    # 读取 PregelNode.channels 中 channel 的数据
    if isinstance(proc.channels, list):
        val: dict[str, Any] = {}
        for chan in proc.channels:
            if chan in channels:
                if channels[chan].is_available():
                    val[chan] = channels[chan].get()
            else:
                val[chan] = managed[chan].get(scratchpad)

    # If the process has a mapper, apply it to the value
    if for_execution and proc.mapper is not None:
        # 调用 mapper 将 val 转换为 input_schema 实例
        val = proc.mapper(val)

    # Cache the input value
    if input_cache is not None:
        input_cache[proc.input_cache_key] = val

    return val
```

### 2.2 condition edge 参数传递
condition edge 的 path 函数也需要接受参数，condition edge 处理逻辑跟 node 的逻辑是类似的:
1. add_conditional_edges，也会从 path 函数解析出 input_schema，并且也会执行 _add_schema
2. attach_branch 会给 condition edge 对应的 start node，添加一个特殊的 ChannelWrite
3. 这个 ChannelWrite 的 invoke 会执行如下调用链:
    - BranchSpec._route
        - value = reader(config)，这个 reader 函数通过闭包保存了 input_schema
        - 调用 ChannelRead.do_read，从 channel 中读取数据，并执行 mappper()，这个 mapper 和 node 的 mapper 一样包含了 input_schema
        - `result = self.path.invoke(value, config)` 此时 path 函数接受的就是 input_schema 实例
        - `self._finish(writer, input, result, config)` 调用 ChannelWrite.do_write 把对 channel 的更新发送出去

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
        self.branches[source][name] = BranchSpec.from_path(path, path_map, True)
        if schema := self.branches[source][name].input_schema:
            self._add_schema(schema)
        return self


    def attach_branch(
        self, start: str, name: str, branch: BranchSpec, *, with_reader: bool = True
    ) -> None:
        def get_writes():
            pass
        if with_reader:
            reader: Callable[[RunnableConfig], Any] | None = partial(
                # read: READ_TYPE = config[CONF][CONFIG_KEY_READ] 读取函数
                ChannelRead.do_read,
                # 读取的 channel
                select=channels[0] if channels == ["__root__"] else channels,
                fresh=True,
                # coerce state dict to schema class (eg. pydantic model)
                mapper=mapper,
            )
        self.nodes[start].writers.append(branch.run(get_writes, reader))
```

### 2.3 跨节点公用 channel
节点间的参数传递，还有一个非常重要的问题: 假如不同的 input_schema 使用了相同名称的字段，会发生什么。

这个问题我们需要注意，_add_schema 中下面的这段代码:
1. 每个 channel 都重载了 `__eq__` 方法，用于比较 channel 是否相等。所以这里的 != 不是比较他们是不是相同的实例，而是比较的他们是不是统一类型，是不是觉有相同的参数
2. 这意味着不同的 input_schema 可以通过申明相同的 schema 而共用相同的 channel，从而做到在不同的 Node 之间传递数据。

```python
    def _add_schema(self, schema: type[Any], /, allow_managed: bool = True) -> None:
        if schema not in self.schemas:
            for key, channel in channels.items():
                if key in self.channels:
                    # channel 相等判断，不是相同实例的判断
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

在 StateGraph 还有一个传递私有数据的用法，请看下面的示例:

```python
class InputState(TypedDict):
    user_input: str

class OutputState(TypedDict):
    graph_output: str

class OverallState(TypedDict):
    foo: str
    user_input: str
    graph_output: str

class PrivateState(TypedDict):
    bar: str

def node_1(state: InputState) -> OverallState:
    # Write to OverallState
    return {"foo": state["user_input"] + " name"}

def node_2(state: OverallState) -> PrivateState:
    # Read from OverallState, write to PrivateState
    return {"bar": state["foo"] + " is"}

def node_3(state: PrivateState) -> OutputState:
    # Read from PrivateState, write to OutputState
    return {"graph_output": state["bar"] + " Lance"}

builder = StateGraph(OverallState,input_schema=InputState,output_schema=OutputState)
builder.add_node("node_1", node_1)
builder.add_node("node_2", node_2)
builder.add_node("node_3", node_3)
builder.add_edge(START, "node_1")
builder.add_edge("node_1", "node_2")
builder.add_edge("node_2", "node_3")
builder.add_edge("node_3", END)

graph = builder.compile()
graph.invoke({"user_input":"My"})
# {'graph_output': 'My name is Lance'}
```

这个示例能够运行的原理就是我们上面所说的:
1. node_1, node_2, node_3 入参的 schema 都会被转换为 channel
2. 所有的数据都通过 channel 传递，并被合并成 input_schema

### 2.4 runtime/store 传递

最后就是 runtime/store 这些通用参数的传递。在 pregel 的调用链中最后一步执行的是 `task.proc.invoke(task.input, config)`，不会传递额外的参数。

而 StateGraph 中 node 函数之所以能接受额外的参数，是因为 StateGraph 在调用 add_node 使用的是 RunnableCallable。



```python
from dataclasses import dataclass
from typing_extensions import TypedDict

from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph
from langgraph.runtime import Runtime

class State(TypedDict):
    input: str
    results: str

@dataclass
class Context:
    user_id: str

builder = StateGraph(State)

def plain_node(state: State):
    return state

def node_with_runtime(state: State, runtime: Runtime[Context]):
    print("In node: ", runtime.context.user_id)
    return {"results": f"Hello, {state['input']}!"}

def node_with_config(state: State, config: RunnableConfig):
    print("In node with thread_id: ", config["configurable"]["thread_id"])
    return {"results": f"Hello, {state['input']}!"}


builder.add_node("plain_node", plain_node)
builder.add_node("node_with_runtime", node_with_runtime)
builder.add_node("node_with_config", node_with_config)
...


class StateGraph(Generic[StateT, ContextT, InputT, OutputT]):
    def add_node():
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


def coerce_to_runnable(
    thing: RunnableLike, *, name: str | None, trace: bool
) -> Runnable:
    """Coerce a runnable-like object into a Runnable.

    Args:
        thing: A runnable-like object.

    Returns:
        A Runnable.
    """
    if isinstance(thing, Runnable):
        return thing
    elif is_async_generator(thing) or inspect.isgeneratorfunction(thing):
        return RunnableLambda(thing, name=name)
    elif callable(thing):
        if is_async_callable(thing):
            return RunnableCallable(None, thing, name=name, trace=trace)
        else:
            return RunnableCallable(
                thing,
                wraps(thing)(partial(run_in_executor, None, thing)),  # type: ignore[arg-type]
                name=name,
                trace=trace,
            )
    elif isinstance(thing, dict):
        return RunnableParallel(thing)
    else:
        raise TypeError(
            f"Expected a Runnable, callable or dict."
            f"Instead got an unsupported type: {type(thing)}"
        )
```

RunnableCallable 在调用 node 函数时，会根据函数签名，进行额外的传参。
1. 初始化时会对传入的 func 的函数签名进行解析，判断是否有特定的参数
2. invoke 调用的时候，根据解析的结果
    - config 传入 config
    - runtime 传入 runtime
    - 其他参数从 runtime 获取并传入

```python
class RunnableCallable(Runnable):
    """A much simpler version of RunnableLambda that requires sync and async functions."""

    def __init__():
        # 初始化参数会对传入的 func 的函数签名进行解析，判断是否有特定的参数
        for kw, typ, runtime_key, default in KWARGS_CONFIG_KEYS:
            p = params.get(kw)

            if p is None or p.kind not in VALID_KINDS:
                # If parameter is not found or is not a valid kind, skip
                continue

            if typ != (ANY_TYPE,) and p.annotation not in typ:
                # A specific type is required, but the function annotation does
                # not match the expected type.
                continue

            # If the kwarg is accepted by the function, store the key / runtime attribute to inject
            self.func_accepts[kw] = (runtime_key, default)

    def invoke(
        self, input: Any, config: RunnableConfig | None = None, **kwargs: Any
    ) -> Any:
        runtime = config[CONF].get(CONFIG_KEY_RUNTIME)

        for kw, (runtime_key, default) in self.func_accepts.items():
            # If the kwarg is already set, use the set value
            if kw in kwargs:
                continue

            kw_value: Any = MISSING
            if kw == "config":
                kw_value = config
            elif runtime:
                if kw == "runtime":
                    kw_value = runtime
                else:
                    try:
                        # 从 runtime 中获取参数
                        kw_value = getattr(runtime, runtime_key)
                    except AttributeError:
                        pass

            if kw_value is MISSING:
                if default is inspect.Parameter.empty:
                    raise ValueError(
                        f"Missing required config key '{runtime_key}' for '{self.name}'."
                    )
                kw_value = default
            kwargs[kw] = kw_value
```