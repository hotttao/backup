---
weight: 4
title: "LangGraph 的流式输出与中断恢复"
date: 2026-08-13T10:00:00+08:00
lastmod: 2026-08-13T10:00:00+08:00
draft: false
author: "tao"
description: "从源码理解 LangGraph 的流式事件、Chat Model Callback，以及 interrupt 与 Command 的中断恢复机制"

tags: ["workflow"]
categories: ["Agent"]

lightgallery: true
---

前文分析了 LangGraph 的 Graph、Channel、Pregel 调度和 Checkpoint。本篇继续回答两个运行时问题：

1. LangGraph 在哪里产生事件，如何收集并输出事件流
2. `interrupt()` 暂停时发生什么，用户如何获得上下文，`Command(resume=...)` 又如何把输入交还给节点

其中 `messages` 模式依赖 LangChain Chat Model 的流式 Callback，因此还会单独分析 `BaseChatModel`、Provider 的 `_stream()` 和 LangGraph 的 `StreamMessagesHandler` 如何连接。

<!-- more -->

## 1. LangGraph 如何实现流式输出

调用 `graph.stream()` 时，Graph 并不是在执行结束后把结果拆成多块返回，而是执行过程中不断产生事件并放入一个队列，调用方对生成器的迭代再不断从队列中取出事件。

先看最常用的接口：

```python
for chunk in graph.stream(
    {"topic": "LangGraph"},
    stream_mode=["updates", "messages", "custom"],
):
    print(chunk)
```

`stream_mode` 决定订阅哪些事件。常见模式包括：

| 模式 | 产生位置 | Payload |
| --- | --- | --- |
| `values` | 每个 Superstep 完成、State Channel 更新后 | 当前完整 State |
| `updates` | 一个节点完成并提交 Writes 时 | 节点名称及其 Partial State 更新 |
| `messages` | Chat Model 的流式 Callback | `AIMessageChunk` 和节点元数据 |
| `custom` | 节点主动调用 `StreamWriter` 时 | 用户传给 writer 的任意值 |
| `tasks` | Task 开始和结束时 | Task、结果、错误等调试信息 |
| `checkpoints` | Checkpoint 创建时 | 与 `get_state()` 接近的状态快照 |

这里的“事件”在 v1 内部统一表示为一个三元组：

```python
StreamChunk = tuple[tuple[str, ...], str, Any]

# (namespace, mode, payload)
((), "updates", {"writer": {"draft": "..."}})
```

`namespace` 表示事件来自顶层 Graph 还是某个 Subgraph，`mode` 表示事件类型，`payload` 是该事件的数据。因此，State 更新、LLM Token 和用户自定义数据虽然来源不同，进入流以后都使用相同的信封结构。

### 1.1 事件在哪里定义和产生

LangGraph 没有一个“所有事件类的枚举”负责产生全部事件。更准确地说，`StreamMode` 定义允许订阅的类别，不同运行时组件在事件真正发生的位置调用统一的 Stream 接口。

#### Pregel Loop 产生运行时事件

`PregelLoop._emit()` 是 `values`、`updates`、`tasks` 和 `checkpoints` 等运行时事件的统一出口。它先检查调用方有没有订阅该 mode，再把数据规范化为 `(checkpoint_ns, mode, payload)`：

```python
def _emit(self, mode, values, *args, **kwargs):
    if self.stream is None or mode not in self.stream.modes:
        return

    for value in values(*args, **kwargs):
        self.stream((self.checkpoint_ns, mode, value))
```

事件的产生时机并不相同：

- Task 准备好时产生 `tasks` 开始事件
- `PregelRunner` 完成节点、得到 `task.writes` 后，`output_writes()` 产生 `updates` 和 Task 结束事件
- `after_tick()` 调用 `apply_writes()` 后产生 `values` 事件，此时看到的是 Superstep 更新后的完整 State
- 创建 Checkpoint 时产生 `checkpoints` 事件

这也解释了 `updates` 和 `values` 的语义差异：前者来自单个 Task 的 Writes，可以在并行节点陆续完成时输出；后者来自 Update 阶段之后的 Channel 快照，表示本轮统一提交后的 State。

#### Chat Model Callback 产生 Token 事件

`messages` 不需要等节点返回。`graph.stream()` 发现订阅了 `messages` 后，会向 LangChain Callback Manager 注册 `StreamMessagesHandler`。Chat Model 每产生一个消息块，Handler 就调用：

```python
self.stream((namespace, "messages", (message_chunk, metadata)))
```

因此 LLM Token 能在节点尚未完成、还没有 State Write 时先流出来。它不是从 State Channel 中拆出来的，而是直接截获 Chat Model 的流式 Callback。

#### 节点产生自定义事件

`custom` 模式会创建一个 `stream_writer`，并通过 `Runtime` 注入节点。节点调用 writer 时，数据直接进入流：

```python
from langgraph.types import StreamWriter


def node(state: State, writer: StreamWriter):
    writer({"stage": "retrieving", "progress": 0.5})
    return {"result": "..."}
```

```python
def stream_writer(value):
    stream.put((namespace, "custom", value))
```

因此自定义进度也不需要先写入 State。

## 2. Chat Model 如何定义流式输出

Chat Model 并不是 LangGraph 定义的，而是 LangChain Core 中的 `BaseChatModel`。LangGraph 不负责调用具体模型服务，它只是注册 Callback Handler，监听模型产生的消息块。

完整调用链如下：

```text
节点调用 model.invoke() / model.stream()
    -> BaseChatModel 判断是否需要流式执行
    -> Provider 的 _stream() 从模型服务逐块读取响应
    -> 每得到一个 ChatGenerationChunk
    -> run_manager.on_llm_new_token(...)
    -> StreamMessagesHandler.on_llm_new_token(...)
    -> (namespace, "messages", (message_chunk, metadata))
    -> LangGraph Stream Queue
```

### 2.1 `BaseChatModel` 的接口

基础类定义在 `langchain_core/language_models/chat_models.py`：

```python
class BaseChatModel(BaseLanguageModel[AIMessage], ABC):
    ...
```

具体模型至少实现非流式生成接口和模型类型：

```python
class MyChatModel(BaseChatModel):
    @property
    def _llm_type(self) -> str:
        return "my-chat-model"

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager=None,
        **kwargs,
    ) -> ChatResult:
        ...
```

支持流式响应的 Provider 还应该实现 `_stream()`：

```python
def _stream(
    self,
    messages: list[BaseMessage],
    stop: list[str] | None = None,
    run_manager: CallbackManagerForLLMRun | None = None,
    **kwargs,
) -> Iterator[ChatGenerationChunk]:
    ...
```

用户调用公开接口，Provider 实现底层接口：

| 公开接口 | Provider 接口 | 返回值 |
| --- | --- | --- |
| `invoke()` | `_generate()` | 完整 `AIMessage` |
| `ainvoke()` | `_agenerate()` | 完整 `AIMessage` |
| `stream()` | `_stream()` | `Iterator[AIMessageChunk]` |
| `astream()` | `_astream()` | `AsyncIterator[AIMessageChunk]` |

基础类的 `_stream()` 只抛出 `NotImplementedError`。OpenAI、Anthropic、Ollama 等 Provider 的子类负责把 SSE、WebSocket 或其他协议转换成 LangChain 的统一消息块。

### 2.2 Message 示例与对应类型

LangGraph 没有重新定义一套 Message，它直接使用 `langchain_core.messages` 中的类型。下面左列是实例化示例，右列是对象在 LangGraph State 或 Stream 中实际对应的 Python 类型。

| Message 示例 | LangGraph 中的类型 |
| --- | --- |
| `SystemMessage(content="你是翻译助手")` | `SystemMessage`，完整的 System 指令消息，序列化类型为 `"system"` |
| `HumanMessage(content="把 A 翻译成中文")` | `HumanMessage`，完整的用户输入消息，序列化类型为 `"human"` |
| `AIMessage(content="B")` | `AIMessage`，完整的模型输出消息，序列化类型为 `"ai"` |
| `AIMessage(content="", tool_calls=[{"name": "search", "args": {"q": "LangGraph"}, "id": "call_1", "type": "tool_call"}])` | `AIMessage`，Tool Call 是 `AIMessage.tool_calls` 中的 `ToolCall`，不是独立 Message |
| `ToolMessage(content="搜索结果", tool_call_id="call_1")` | `ToolMessage`，工具执行结果，通过 `tool_call_id` 对应前面的 Tool Call，序列化类型为 `"tool"` |
| `ChatMessage(role="critic", content="需要修改")` | `ChatMessage`，允许自定义 `role` 的完整消息，序列化类型为 `"chat"` |
| `FunctionMessage(name="search", content="搜索结果")` | `FunctionMessage`，旧版函数调用结果，没有 `tool_call_id`；新代码通常使用 `ToolMessage`，序列化类型为 `"function"` |
| `SystemMessageChunk(content="你是")` | `SystemMessageChunk`，可拼接的 System 消息分块 |
| `HumanMessageChunk(content="把 A")` | `HumanMessageChunk`，可拼接的 Human 消息分块 |
| `AIMessageChunk(content="你")` | `AIMessageChunk`，Chat Model 最常见的流式输出分块 |
| `AIMessageChunk(content="", tool_call_chunks=[{"name": "search", "args": "{\"q\":", "id": "call_1", "index": 0, "type": "tool_call_chunk"}])` | `AIMessageChunk`，流式 Tool Call 位于 `tool_call_chunks`，元素类型为 `ToolCallChunk`，不是独立 Message Chunk |
| `ToolMessageChunk(content="部分结果", tool_call_id="call_1")` | `ToolMessageChunk`，可拼接的工具结果分块 |
| `ChatMessageChunk(role="critic", content="需要")` | `ChatMessageChunk`，带自定义 `role` 的消息分块 |
| `FunctionMessageChunk(name="search", content="部分结果")` | `FunctionMessageChunk`，旧版函数结果分块 |
| `RemoveMessage(id="message-id")` | `RemoveMessage`，供 LangGraph Message Reducer 删除指定 ID 的已有消息；它是状态更新指令，不会发送给 Chat Model |

完整消息的联合类型 `AnyMessage` 可以简化为：

```python
AnyMessage = (
    AIMessage
    | HumanMessage
    | SystemMessage
    | ToolMessage
    | ChatMessage
    | FunctionMessage
    | AIMessageChunk
    | HumanMessageChunk
    | SystemMessageChunk
    | ToolMessageChunk
    | ChatMessageChunk
    | FunctionMessageChunk
)
```

其中最常见的对话顺序是：

```text
SystemMessage                 # 系统指令
    -> HumanMessage           # 用户请求
    -> AIMessage              # 模型直接回答
```

带工具调用时则是：

```text
HumanMessage
    -> AIMessage(tool_calls=[ToolCall(...)])
    -> ToolMessage(tool_call_id=...)
    -> AIMessage
```

`ToolCall`、`ToolCallChunk`、`ContentBlock` 和 `ChatGenerationChunk` 都不是 Message：前几者是 Message 内部字段，`ChatGenerationChunk` 则是模型生成层的包装对象。LangGraph 的 `stream_mode="messages"` 最终对外输出的是包装对象中的 `message`，通常为 `AIMessageChunk`。

### 2.3 `_stream()` 产生的是消息块

`_stream()` 每次 Yield 一个 `ChatGenerationChunk`：

```python
ChatGenerationChunk(
    message=AIMessageChunk(content="你")
)
```

其类型关系为：

```text
ChatGenerationChunk
    -> message: BaseMessageChunk
                    -> 通常是 AIMessageChunk
```

Chunk 不只包含文本，还可以携带 Tool Call 增量、Reasoning Content、Usage Metadata、Provider Metadata 和消息 ID。所以 Callback 虽然名为 `on_llm_new_token`，事件单位并不一定严格等于 tokenizer 的一个 Token，更准确地说是 Provider 返回的一个消息 Chunk。

本地 Fake Model 的实现最容易看清这个约定：

```python
def _stream(self, messages, stop=None, run_manager=None, **kwargs):
    response = self.responses[self.i]

    for index, char in enumerate(response):
        yield ChatGenerationChunk(
            message=AIMessageChunk(
                content=char,
                chunk_position=(
                    "last" if index == len(response) - 1 else None
                ),
            )
        )
```

假设模型回复“你好”，它会依次产生：

```python
ChatGenerationChunk(message=AIMessageChunk(content="你"))
ChatGenerationChunk(
    message=AIMessageChunk(content="好", chunk_position="last")
)
```

### 2.4 `BaseChatModel.stream()` 如何触发 Callback

公开的 `stream()` 建立 Callback 生命周期、调用 Provider 的 `_stream()`，再将 Chunk 同时发送给 Callback 和直接调用方：

```python
def stream(self, input, config=None, **kwargs):
    callback_manager = CallbackManager.configure(
        config.get("callbacks"),
        self.callbacks,
        ...
    )
    (run_manager,) = callback_manager.on_chat_model_start(
        self._serialized,
        [messages],
        ...
    )

    chunks = []
    try:
        for chunk in self._stream(messages, **kwargs):
            run_manager.on_llm_new_token(
                chunk.message.content,
                chunk=chunk,
            )
            chunks.append(chunk)
            yield chunk.message

        generation = merge_chat_generation_chunks(chunks)
        run_manager.on_llm_end(
            LLMResult(generations=[[generation]])
        )
    except BaseException as error:
        run_manager.on_llm_error(error)
        raise
```

一个模型 Chunk 同时进入两条路径：

```text
Provider._stream()
       +-> yield chunk.message
       |       -> model.stream() 调用方
       |
       +-> run_manager.on_llm_new_token(..., chunk=chunk)
               -> Callback Handlers
```

`CallbackManagerForLLMRun.on_llm_new_token()` 遍历本次模型调用的 Handler：

```python
def on_llm_new_token(self, token, *, chunk=None, **kwargs):
    handle_event(
        self.handlers,
        "on_llm_new_token",
        "ignore_llm",
        token=token,
        run_id=self.run_id,
        parent_run_id=self.parent_run_id,
        tags=self.tags,
        chunk=chunk,
    )
```

### 2.5 LangGraph 如何监听 Chat Model

订阅 `messages` 时，LangGraph 创建 `StreamMessagesHandler`，并添加到 Graph Callback Manager 的 `inheritable_handlers`：

```python
if "messages" in stream_modes:
    run_manager.inheritable_handlers.append(
        StreamMessagesHandler(
            stream.put,
            subgraphs,
            parent_ns=...,
        )
    )
```

节点内的 Chat Model 是 Graph 下层的 Runnable，它创建 Callback Manager 时会继承这个 Handler，所以节点无须显式传入 LangGraph Handler。

模型产生 Chunk 后，Handler 收到回调：

```python
def on_llm_new_token(
    self,
    token: str,
    *,
    chunk: ChatGenerationChunk | None = None,
    run_id: UUID,
    **kwargs,
):
    if not isinstance(chunk, ChatGenerationChunk):
        return

    if meta := self.metadata.get(run_id):
        self._emit(meta, chunk.message)
```

这里使用 `chunk.message` 而不是字符串 `token`，以保留 Tool Call 和 Metadata 等结构化数据。`_emit()` 最终写入：

```python
self.stream(
    (
        namespace,
        "messages",
        (message_chunk, metadata),
    )
)
```

### 2.6 为什么节点调用 `invoke()` 也能流式输出

节点经常使用非流式接口：

```python
def translate(state):
    result = model.invoke(state["messages"])
    return {"messages": [result]}
```

但 Graph 外部仍然可以订阅 `messages`。原因是 `BaseChatModel` 会检查 Callback Handler：如果 Provider 实现了 `_stream()`，且存在 Streaming Callback Handler，`invoke()` 内部也会改走 `_stream()`：

```python
def _should_stream(self, *, run_manager=None, **kwargs):
    if type(self)._stream == BaseChatModel._stream:
        return False
    if self._streaming_disabled(**kwargs):
        return False
    if kwargs.get("stream"):
        return True
    if getattr(self, "streaming", None) is True:
        return True

    handlers = run_manager.handlers if run_manager else []
    return any(
        isinstance(handler, _StreamingCallbackHandler)
        for handler in handlers
    )
```

LangGraph 的 `StreamMessagesHandler` 正是一个 `_StreamingCallbackHandler`：

```text
graph.stream(stream_mode="messages")
    -> 安装 StreamMessagesHandler
    -> 节点调用 model.invoke()
    -> BaseChatModel 发现 Streaming Callback Handler
    -> invoke() 内部使用 model._stream()
    -> 每个 Chunk 触发 on_llm_new_token()
    -> LangGraph 输出 messages 事件
    -> 所有 Chunk 合并成最终 AIMessage
    -> model.invoke() 向节点返回完整 AIMessage
```

因此同一次模型调用有两个观察结果：

```text
                    +-> 每个 AIMessageChunk -> messages 事件
Provider._stream() -+
                    +-> 合并所有 Chunk -> invoke() 返回完整 AIMessage
```

核心结论是：

> **Provider 的 `_stream()` 定义如何产生 `ChatGenerationChunk`；`BaseChatModel` 为每个 Chunk 触发 `on_llm_new_token()`；LangGraph 通过可继承的 `StreamMessagesHandler` 监听 Callback，再将 `chunk.message` 转换成自己的 `messages` 事件。**

## 3. 事件如何被收集和输出

### 3.1 事件如何被收集

同步 `stream()` 会先创建一个线程安全的 `SyncQueue`，然后把它包装成 `StreamProtocol`：

```python
stream = SyncQueue()

with SyncPregelLoop(
    ...,
    stream=StreamProtocol(stream.put, stream_modes),
) as loop:
    ...
```

`StreamProtocol` 只有两个核心成员：

```python
class StreamProtocol:
    modes: set[StreamMode]
    __call__: Callable[[StreamChunk], None]
```

其中 `modes` 是供事件生产者判断是否需要生成某类事件的订阅集合，`__call__` 最终指向 `SyncQueue.put`。于是所有生产者共享同一条路径：

```text
PregelLoop._emit() ───────────────┐
StreamMessagesHandler ────────────┼─> StreamProtocol(...) ─> SyncQueue
Runtime.stream_writer() ──────────┘
```

Queue 是事件的汇合点，但它不负责推导 State 或生成 Token；它只按生产者放入的顺序暂存已经生成的 `StreamChunk`。

### 3.2 Queue 中的事件如何变成调用方看到的流

Pregel 主循环仍按照 `Plan -> Execution -> Update` 执行，但 `PregelRunner.tick()` 在等待并行 Task 的过程中会不断把控制权交还给 `stream()`。每次交还时，`_output()` 都会持续调用 `stream.get()`，直到当前 Queue 被取空：

```python
while loop.tick():
    for _ in runner.tick(...):
        yield from _output(..., stream.get, ...)

    loop.after_tick()

# Graph 结束前再清空一次 Queue
yield from _output(..., stream.get, ...)
```

`_output()` 根据调用参数把内部三元组转换成公开输出。比如同时订阅多个 mode 时，v1 通常输出：

```python
("messages", (message_chunk, metadata))
("updates", {"writer": {"draft": "..."}})
```

如果设置 `subgraphs=True`，输出中还会保留 namespace。v2 则使用带字段名的统一信封：

```python
{
    "type": "updates",
    "ns": (),
    "data": {"writer": {"draft": "..."}},
}
```

所以一条流式事件的完整路径是：

```text
事件发生
  -> 对应组件构造 (namespace, mode, payload)
  -> 生产者根据 StreamProtocol.modes 判断是否订阅
  -> StreamProtocol.__call__ 把事件写入 Queue
  -> SyncQueue.put() 收集
  -> Runner 在执行间隙让出控制权
  -> _output() 从 Queue 取出并转换公开格式
  -> graph.stream() yield 给调用方
```

这里还有一个重要区别：`messages` 和 `custom` 可以在节点执行中途到达 Queue，因此是真正的节点内增量输出；`updates` 必须等节点形成 Writes，`values` 必须等本轮 `apply_writes()` 完成。它们都叫 Streaming，但粒度和产生时机不同。

## 4. `interrupt()` 与 `Command` 如何实现中断和恢复

`interrupt_before/after` 是在节点边界暂停；`interrupt(value)` 则可以在节点函数内部动态暂停，并把业务上下文交给用户。后者的关键语义是：

> **`interrupt()` 第一次执行时抛出 `GraphInterrupt`；恢复时节点从头重新执行，同一个 `interrupt()` 再次执行时不再抛异常，而是返回 `Command(resume=...)` 携带的值。**

它不是保存 Python 调用栈，也不是恢复到函数的下一行。

### 4.1 用户如何拿到 A 和 B

`interrupt(value)` 的 `value` 就是节点发给用户的 Payload。比如翻译节点生成 B 后，可以把原文 A、译文 B 和操作说明一起传出：

```python
from typing_extensions import TypedDict
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import StateGraph, START, END
from langgraph.types import Command, interrupt


class State(TypedDict):
    source: str
    translation: str
    approved: bool


def translate_and_review(state: State):
    source = state["source"]
    translation = llm.invoke(f"把下面内容翻译成中文：{source}").content

    approved = interrupt({
        "kind": "translation_review",
        "source": source,
        "translation": translation,
        "question": "是否接受这份翻译？",
    })

    return {
        "translation": translation,
        "approved": bool(approved),
    }


builder = StateGraph(State)
builder.add_node("translate_and_review", translate_and_review)
builder.add_edge(START, "translate_and_review")
builder.add_edge("translate_and_review", END)

graph = builder.compile(checkpointer=InMemorySaver())
config = {"configurable": {"thread_id": "translation-42"}}
```

第一次执行：

```python
for chunk in graph.stream(
    {"source": "A"},
    config,
    stream_mode="updates",
):
    print(chunk)
```

调用方会收到类似事件：

```python
{
    "__interrupt__": (
        Interrupt(
            value={
                "kind": "translation_review",
                "source": "A",
                "translation": "B",
                "question": "是否接受这份翻译？",
            },
            id="interrupt-id",
        ),
    )
}
```

服务端把 `Interrupt.value` 返回给前端，前端就能同时展示 A 和 B。A、B 并不是 LangGraph 自动从节点局部变量中提取出来的；节点必须显式把希望用户看到的信息放入 `interrupt(value)`。

### 4.2 `interrupt()` 第一次执行时发生什么

节点进入 `interrupt(value)` 后会读取当前 Task 的 `PregelScratchpad`：

```python
idx = scratchpad.interrupt_counter()

if 已经存在第 idx 个 resume value:
    return resume_value

raise GraphInterrupt((Interrupt(value=value, id=...),))
```

第一次执行还没有 Resume Value，所以它创建 `Interrupt` 并抛出 `GraphInterrupt`。接下来：

1. `PregelRunner.commit()` 捕获 `GraphInterrupt`
2. Runner 不把它当成普通失败，而是给当前 Task 保存一条 `(__interrupt__, Interrupt(...))` Pending Write
3. `PregelLoop.output_writes()` 把这条 Pending Write 转换成 `updates` 或 `values` 流事件
4. Loop 退出时保存 Checkpoint 和 Pending Writes，并在顶层吞掉 `GraphInterrupt`，所以用户看到的是“正常结束但包含待处理 Interrupt”，而不是未处理异常

由于节点没有正常返回，节点最后的 `return {"translation": ..., ...}` 尚未发生，因而这部分 State Update 也没有提交。Checkpoint 保存的是节点执行前的 State、调度位置以及这次 Interrupt Pending Write。

### 4.3 `Command(resume=...)` 如何把用户输入交回节点

假设用户点击“通过”，应用使用相同的 `thread_id` 恢复：

```python
for chunk in graph.stream(
    Command(resume=True),
    config,
    stream_mode="updates",
):
    print(chunk)
```

内部过程如下：

```text
Command(resume=True)
        -> map_command() 转换成 (NULL_TASK_ID, RESUME, True)
        -> Loop 把 RESUME 保存为 Pending Write
        -> 从 Checkpoint 重新创建被中断的 Task
        -> 为 Task 构造 PregelScratchpad(resume=...)
        -> 节点从第一行重新执行
        -> interrupt_counter() 再次得到相同序号
        -> interrupt() 找到对应 Resume Value，返回 True
        -> approved = True，节点继续执行并正常 return
```

因此节点拿到用户信息的方式就是普通的函数返回值：

```python
approved = interrupt(review_payload)
# 恢复后，approved 就是 Command(resume=...) 中的值
```

多个 `interrupt()` 按节点内的调用顺序匹配 Resume Value，计数器和 Resume 列表都属于当前 Task。若同时存在多个并行 Interrupt，则应使用 Interrupt ID 精确恢复：

```python
Command(resume={interrupt_id: True})
```

### 4.4 为什么翻译和审核最好拆成两个节点

上面的单节点示例容易说明机制，但不适合直接用于生产。恢复会从节点开头重跑，所以 LLM 会再次生成翻译：

```text
第一次：LLM 生成 B1 -> interrupt 展示 B1
恢复时：LLM 再次调用 -> 可能生成 B2 -> interrupt 返回用户对 B1 的意见
```

这不仅重复消耗 Token，而且用户确认的内容和最终写入的内容可能不一致。更可靠的 Graph 应把“产生待审核结果”和“等待审核”拆开：

```python
def translate(state: State):
    translation = llm.invoke(
        f"把下面内容翻译成中文：{state['source']}"
    ).content
    return {"translation": translation}


def review(state: State):
    approved = interrupt({
        "kind": "translation_review",
        "source": state["source"],
        "translation": state["translation"],
        "question": "是否接受这份翻译？",
    })
    return {"approved": bool(approved)}


builder.add_node("translate", translate)
builder.add_node("review", review)
builder.add_edge(START, "translate")
builder.add_edge("translate", "review")
builder.add_edge("review", END)
```

`translate` 正常结束后，A 和 B 已经进入 State Channel 并保存到 Checkpoint。`review` 被恢复时虽然仍会从头重跑，但它只会重新读取同一份 A、B，再让 `interrupt()` 返回用户意见，不会重新调用 LLM。

完整时序如下：

```text
translate 读取 A
    -> LLM 生成 B
    -> return {translation: B}
    -> Update + Checkpoint，A/B 已持久化
    -> review 读取 A/B
    -> interrupt({source: A, translation: B})
    -> GraphInterrupt + __interrupt__ 流事件
    -> 用户看到 A/B 并提交 approved
    -> Command(resume=approved)
    -> 从 Checkpoint 重建 review Task
    -> review 从头执行并再次调用 interrupt(...)
    -> interrupt() 返回 approved
    -> return {approved: approved}
    -> Graph 继续执行
```

因此，动态中断的本质不是“冻结函数”，而是 **Checkpoint 保存可重建的 Graph/Task 状态，Interrupt Pending Write 保存待回答的问题，Command 写入 Resume Value，节点重放时由 `interrupt()` 把 Resume Value 还原成普通返回值**。

本文的源码核对基于本地安装的 LangGraph `1.2.11` 和 LangChain Core `1.5.4`，关键位置包括：

- `langchain_core/language_models/chat_models.py`：`BaseChatModel`、`stream()`、`_stream()` 以及 Callback 的触发
- `langchain_core/callbacks/manager.py`：分发 `on_llm_new_token()`
- `langchain_core/outputs/chat_generation.py`：`ChatGenerationChunk` 的定义
- `langgraph/pregel/main.py`：创建 Stream Queue、注册消息 Callback、驱动 Loop 并输出 Queue
- `langgraph/pregel/_loop.py`：产生运行时事件、处理中断 Pending Writes、接收 Resume Command
- `langgraph/pregel/_runner.py`：捕获 `GraphInterrupt` 并保存 Interrupt
- `langgraph/pregel/_messages.py`：把 Chat Model 消息块转换成 `messages` 事件
- `langgraph/pregel/_io.py`：把 `Command` 转换成 Pending Writes
- `langgraph/pregel/_algo.py`：恢复 Task 并构造包含 Resume Values 的 `PregelScratchpad`
- `langgraph/types.py`：`StreamChunk`、`Command` 和 `interrupt()` 的公开定义
