---
weight: 1
title: "pregel prebuit"
date: 2025-08-06T13:00:00+08:00
lastmod: 2025-08-06T13:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "pregel prebuit"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

langgraph 在 prebuilt 下提供了一个 chat agent 实现。这个 agent 比较复杂，为了讲清楚，我们分成几个部分来讲解。
1. 参数校验

## 1. 参数校验
state_schema: 
- 必须包含 `messages` 和 `remaining_steps` 两个字段。
- 如果存在 pre_model_hook 需要给 state 添加 llm_input_messages 收集 pre_model_hook 输出的 message


```python
def create_react_agent(
    model: Union[
        str,
        LanguageModelLike,
        Callable[[StateSchema, Runtime[ContextT]], BaseChatModel],
        Callable[[StateSchema, Runtime[ContextT]], Awaitable[BaseChatModel]],
    ],
    tools: Union[Sequence[Union[BaseTool, Callable, dict[str, Any]]], ToolNode],
    *,
    prompt: Optional[Prompt] = None,
    response_format: Optional[
        Union[StructuredResponseSchema, tuple[str, StructuredResponseSchema]]
    ] = None,
    pre_model_hook: Optional[RunnableLike] = None,
    post_model_hook: Optional[RunnableLike] = None,
    state_schema: Optional[StateSchemaType] = None,
    context_schema: Optional[Type[Any]] = None,
    checkpointer: Optional[Checkpointer] = None,
    store: Optional[BaseStore] = None,
    interrupt_before: Optional[list[str]] = None,
    interrupt_after: Optional[list[str]] = None,
    debug: bool = False,
    version: Literal["v1", "v2"] = "v2",
    name: Optional[str] = None,
    **deprecated_kwargs: Any,
) -> CompiledStateGraph:
    if (
        config_schema := deprecated_kwargs.pop("config_schema", MISSING)
    ) is not MISSING:
        warn(
            "`config_schema` is deprecated and will be removed. Please use `context_schema` instead.",
            category=LangGraphDeprecatedSinceV10,
        )

        if context_schema is None:
            context_schema = config_schema

    if version not in ("v1", "v2"):
        raise ValueError(
            f"Invalid version {version}. Supported versions are 'v1' and 'v2'."
        )

    if state_schema is not None:
        required_keys = {"messages", "remaining_steps"}
        if response_format is not None:
            required_keys.add("structured_response")

        schema_keys = set(get_type_hints(state_schema))
        if missing_keys := required_keys - set(schema_keys):
            raise ValueError(f"Missing required key(s) {missing_keys} in state_schema")

    if state_schema is None:
        state_schema = (
            AgentStateWithStructuredResponse
            if response_format is not None
            else AgentState
        )

    input_schema: StateSchemaType
    if pre_model_hook is not None:
        # Dynamically create a schema that inherits from state_schema and adds 'llm_input_messages'
        if isinstance(state_schema, type) and issubclass(state_schema, BaseModel):
            # For Pydantic schemas
            from pydantic import create_model

            input_schema = create_model(
                "CallModelInputSchema",
                llm_input_messages=(list[AnyMessage], ...),
                __base__=state_schema,
            )
        else:
            # For TypedDict schemas
            class CallModelInputSchema(state_schema):  # type: ignore
                llm_input_messages: list[AnyMessage]

            input_schema = CallModelInputSchema
    else:
        input_schema = state_schema

```

## 2. tool 处理
tool 分为两类:
1. llm_builtin_tools: 字典类型的 tools
2. BaseTool: 用于自定义的 tool
这里有点不太理解，llm_builtin_tools 会被 model 绑定，但是不会传给 tool_node，如果返回 llm_builtin_tools 的 tool call，tool_node 不会报错么？

_should_bind_tools 会判断 model 是否需要绑定 tools
1. 如果 model 没有绑定 tool，返回 True
2. 如果 model 已经绑定 tool，判断传入 tools 与 model 绑定的 tools 是否一致。
    - 如果不一致，抛出 ValueError 异常
    - 如果一致，返回 false
3. model 是否绑定 tool 可以参考 [LangChain ChatOpenAI](../../program/python/langchain/31_openapi.md)
    - 如果绑定了tool，model 就是一个 RunnableBinding 对象
    - tools 保存在 RunnableBinding 的 kwargs 参数内

```python
def create_react_agent():
    # 初始化一个空列表，用来存放以字典形式定义的内置工具
    llm_builtin_tools: list[dict] = []

    # 判断 tools 是否是 ToolNode 类型
    if isinstance(tools, ToolNode):
        # 如果是 ToolNode，直接取出其中的工具类
        tool_classes = list(tools.tools_by_name.values())
        tool_node = tools
    else:
        # 如果不是 ToolNode：
        # - 把所有字典类型的工具放到 llm_builtin_tools
        llm_builtin_tools = [t for t in tools if isinstance(t, dict)]
        # - 把其他的工具包装成一个新的 ToolNode
        tool_node = ToolNode([t for t in tools if not isinstance(t, dict)])
        # - 取出工具类
        tool_classes = list(tool_node.tools_by_name.values())

    # 判断是否为“动态模型”：
    #   - 不是字符串，也不是 Runnable
    #   - 但是是一个可调用对象（callable）
    is_dynamic_model = not isinstance(model, (str, Runnable)) and callable(model)

    # 判断是否为异步的动态模型（即可调用对象是协程函数）
    is_async_dynamic_model = is_dynamic_model and inspect.iscoroutinefunction(model)

    # 是否启用工具调用功能（只要有工具类就启用）
    tool_calling_enabled = len(tool_classes) > 0

    # 如果模型不是动态的，则进入静态模型分支
    if not is_dynamic_model:
        if isinstance(model, str):
            try:
                # 尝试从 langchain.chat_models 导入 init_chat_model
                from langchain.chat_models import (  # type: ignore[import-not-found]
                    init_chat_model,
                )
            except ImportError:
                # 如果没有安装 langchain，则报错并提示安装
                raise ImportError(
                    "Please install langchain (`pip install langchain`) to "
                    "use '<provider>:<model>' string syntax for `model` parameter."
                )

            # 用 init_chat_model 把字符串形式的 model 转换成 BaseChatModel 实例
            model = cast(BaseChatModel, init_chat_model(model))

        # 判断是否需要绑定工具到模型
        if (
            _should_bind_tools(model, tool_classes, num_builtin=len(llm_builtin_tools))  # type: ignore[arg-type]
            and len(tool_classes + llm_builtin_tools) > 0
        ):
            # 调用模型的 bind_tools 方法，绑定所有工具（类工具 + 内置工具）
            model = cast(BaseChatModel, model).bind_tools(
                tool_classes + llm_builtin_tools  # type: ignore[operator]
            )

        # 构建静态模型（由 prompt runnable 和模型组合）
        static_model: Optional[Runnable] = _get_prompt_runnable(prompt) | model  # type: ignore[operator]
    else:
        # 动态模型的情况：在运行时才会构建 runnable，所以这里先设为 None
        static_model = None

    # 检查工具中是否存在 return_direct=True 的工具，
    # 如果有，则在执行图中需要额外检查这些工具是否被调用
    should_return_direct = {t.name for t in tool_classes if t.return_direct}


def _should_bind_tools(
    model: LanguageModelLike, tools: Sequence[BaseTool], num_builtin: int = 0
) -> bool:
    if isinstance(model, RunnableSequence):
        model = next(
            (
                step
                for step in model.steps
                if isinstance(step, (RunnableBinding, BaseChatModel))
            ),
            model,
        )

    if not isinstance(model, RunnableBinding):
        return True

    if "tools" not in model.kwargs:
        return True

    bound_tools = model.kwargs["tools"]
    if len(tools) != len(bound_tools) - num_builtin:
        raise ValueError(
            "Number of tools in the model.bind_tools() and tools passed to create_react_agent must match"
            f" Got {len(tools)} tools, expected {len(bound_tools) - num_builtin}"
        )

    tool_names = set(tool.name for tool in tools)
    bound_tool_names = set()
    for bound_tool in bound_tools:
        # OpenAI-style tool
        if bound_tool.get("type") == "function":
            bound_tool_name = bound_tool["function"]["name"]
        # Anthropic-style tool
        elif bound_tool.get("name"):
            bound_tool_name = bound_tool["name"]
        else:
            # unknown tool type so we'll ignore it
            continue

        bound_tool_names.add(bound_tool_name)

    if missing_tools := tool_names - bound_tool_names:
        raise ValueError(f"Missing tools '{missing_tools}' in the model.bind_tools()")

    return False
```

## 3. 工具函数
1. _resolve_model: 获取绑定提示词和 tool 之后的 model
2. _get_model_input_state: 标准化模型输入
    - _validate_chat_history: 检查消息历史里，是否存在 LLM 触发的工具调用（AIMessage.tool_calls），但没有对应的工具返回消息（ToolMessage）。

```python
def create_react_agent():
    def _resolve_model(
        state: StateSchema, runtime: Runtime[ContextT]
    ) -> LanguageModelLike:
        """Resolve the model to use, handling both static and dynamic models."""
        if is_dynamic_model:
            return _get_prompt_runnable(prompt) | model(state, runtime)  # type: ignore[operator]
        else:
            return static_model

    async def _aresolve_model(
        state: StateSchema, runtime: Runtime[ContextT]
    ) -> LanguageModelLike:
        """Async resolve the model to use, handling both static and dynamic models."""
        if is_async_dynamic_model:
            resolved_model = await model(state, runtime)  # type: ignore[misc,operator]
            return _get_prompt_runnable(prompt) | resolved_model
        elif is_dynamic_model:
            return _get_prompt_runnable(prompt) | model(state, runtime)  # type: ignore[operator]
        else:
            return static_model


    def _get_model_input_state(state: StateSchema) -> StateSchema:
        if pre_model_hook is not None:
            messages = (
                _get_state_value(state, "llm_input_messages")
            ) or _get_state_value(state, "messages")
            error_msg = f"Expected input to call_model to have 'llm_input_messages' or 'messages' key, but got {state}"
        else:
            messages = _get_state_value(state, "messages")
            error_msg = (
                f"Expected input to call_model to have 'messages' key, but got {state}"
            )

        if messages is None:
            raise ValueError(error_msg)

        _validate_chat_history(messages)
        # we're passing messages under `messages` key, as this is expected by the prompt
        if isinstance(state_schema, type) and issubclass(state_schema, BaseModel):
            state.messages = messages  # type: ignore
        else:
            state["messages"] = messages  # type: ignore

        return state

def _validate_chat_history(
    messages: Sequence[BaseMessage],
) -> None:
    """Validate that all tool calls in AIMessages have a corresponding ToolMessage."""
    all_tool_calls = [
        tool_call
        for message in messages
        if isinstance(message, AIMessage)
        for tool_call in message.tool_calls
    ]
    tool_call_ids_with_results = {
        message.tool_call_id for message in messages if isinstance(message, ToolMessage)
    }
    tool_calls_without_results = [
        tool_call
        for tool_call in all_tool_calls
        if tool_call["id"] not in tool_call_ids_with_results
    ]
    if not tool_calls_without_results:
        return

    error_message = create_error_message(
        message="Found AIMessages with tool_calls that do not have a corresponding ToolMessage. "
        f"Here are the first few of those tool calls: {tool_calls_without_results[:3]}.\n\n"
        "Every tool call (LLM requesting to call a tool) in the message history MUST have a corresponding ToolMessage "
        "(result of a tool invocation to return to the LLM) - this is required by most LLM providers.",
        error_code=ErrorCode.INVALID_CHAT_HISTORY,
    )
    raise ValueError(error_message)

```

## 4. 节点函数
### 4.1 call_mode
call_model/acall_model: 调用模型，如果还需要继续执行，就返回一个占位的 AIMessage。

```python
    def call_model(
        state: StateSchema, runtime: Runtime[ContextT], config: RunnableConfig
    ) -> StateSchema:
        # 如果模型是异步动态模型（is_async_dynamic_model=True），
        # 但是当前调用方式是同步的 (invoke)，那就报错
        # 提示用户应该使用 ainvoke()/astream()，或者传入一个同步模型
        if is_async_dynamic_model:
            msg = (
                "Async model callable provided but agent invoked synchronously. "
                "Use agent.ainvoke() or agent.astream(), or "
                "provide a sync model callable."
            )
            raise RuntimeError(msg)

        # 从 state 中提取出模型需要的输入（例如消息历史）
        model_input = _get_model_input_state(state)

        if is_dynamic_model:
            # 如果是动态模型（callable，而不是字符串/固定模型）
            # - 在运行时通过 _resolve_model 动态获取真正的模型实例
            # - 然后调用它的 invoke()，得到一个 AIMessage 响应
            dynamic_model = _resolve_model(state, runtime)
            response = cast(AIMessage, dynamic_model.invoke(model_input, config))  # type: ignore[arg-type]
        else:
            # 如果是静态模型（已经初始化好的模型 + prompt）
            # - 直接调用 static_model.invoke()
            response = cast(AIMessage, static_model.invoke(model_input, config))  # type: ignore[union-attr]

        # 给模型的响应（AIMessage）加上 agent 的 name 信息
        response.name = name

        # 检查是否还需要更多步骤（例如：模型调用了工具但还没得到结果）
        if _are_more_steps_needed(state, response):
            # 如果还需要更多步骤，就返回一个“占位”的 AIMessage
            # 表示抱歉，还需要更多处理步骤
            return {
                "messages": [
                    AIMessage(
                        id=response.id,
                        content="Sorry, need more steps to process this request.",
                    )
                ]
            }

        # 如果不需要额外步骤，就把模型的响应包装成列表返回
        # 返回 {"messages": [response]}，框架会把它追加到现有消息列表里
        return {"messages": [response]}

    async def acall_model(
        state: StateSchema, runtime: Runtime[ContextT], config: RunnableConfig
    ) -> StateSchema:
        model_input = _get_model_input_state(state)

        if is_dynamic_model:
            # Resolve dynamic model at runtime and apply prompt
            # (supports both sync and async)
            dynamic_model = await _aresolve_model(state, runtime)
            response = cast(AIMessage, await dynamic_model.ainvoke(model_input, config))  # type: ignore[arg-type]
        else:
            response = cast(AIMessage, await static_model.ainvoke(model_input, config))  # type: ignore[union-attr]

        # add agent name to the AIMessage
        response.name = name
        if _are_more_steps_needed(state, response):
            return {
                "messages": [
                    AIMessage(
                        id=response.id,
                        content="Sorry, need more steps to process this request.",
                    )
                ]
            }
        # We return a list, because this will get added to the existing list
        return {"messages": [response]}
```

`_are_more_steps_needed` 的作用是：
判断 Agent 是否还需要继续执行下一步，规则是结合 **工具调用情况** + **剩余步数** + **是否最后一步** 来决定的。


还需继续执行的条件：


1. **无步数限制 + 最后一步 + 有工具调用**

   ```python
   remaining_steps is None and is_last_step and has_tool_calls
   ```

   → 允许在“最后一步”时仍然触发工具调用。

2. **有步数限制，步数已耗尽（<1），但工具都是直接返回型**

   ```python
   remaining_steps < 1 and all_tools_return_direct
   ```

   → 即使步数为 0，也允许直接返回结果。

3. **有步数限制，步数只剩 1（<2），但还有工具调用**

   ```python
   remaining_steps < 2 and has_tool_calls
   ```

   → 给工具调用保留一步执行的机会。


```python
    def _are_more_steps_needed(state: StateSchema, response: BaseMessage) -> bool:
        has_tool_calls = isinstance(response, AIMessage) and response.tool_calls
        # 检查工具是否都属于“直接返回型工具”
        all_tools_return_direct = (
            all(call["name"] in should_return_direct for call in response.tool_calls)
            if isinstance(response, AIMessage)
            else False
        )
        remaining_steps = _get_state_value(state, "remaining_steps", None)
        is_last_step = _get_state_value(state, "is_last_step", False)
        # 还需要继续执行的条件
        return (
            (remaining_steps is None and is_last_step and has_tool_calls)
            or (
                remaining_steps is not None
                and remaining_steps < 1
                and all_tools_return_direct
            )
            or (remaining_steps is not None and remaining_steps < 2 and has_tool_calls)
        )
```


### 4.2 generate_structured_response
generate_structured_response: 处理格式化输出

```python
    def generate_structured_response(
        state: StateSchema, runtime: Runtime[ContextT], config: RunnableConfig
    ) -> StateSchema:
        # 如果传入的是异步模型 (async function)，但是却调用了同步接口，
        # 就抛出错误，提示用户使用 agent.ainvoke() 或 agent.astream()
        if is_async_dynamic_model:
            msg = (
                "Async model callable provided but agent invoked synchronously. "
                "Use agent.ainvoke() or agent.astream(), or provide a sync model callable."
            )
            raise RuntimeError(msg)

        # 从 state 中取出对话历史消息 (通常包含用户消息和 AI 消息)
        messages = _get_state_value(state, "messages")

        # response_format 用来指定输出格式，可以是：
        # - 一个 schema（比如 JSON schema）
        # - 或者 (system_prompt, schema) 二元组，带上额外提示词
        structured_response_schema = response_format

        # 如果 response_format 是二元组，则说明需要先插入 system prompt
        # 比如: ( "你必须用 JSON 格式回答", schema )
        if isinstance(response_format, tuple):
            system_prompt, structured_response_schema = response_format
            # 在原始消息前加一条 SystemMessage，用来指导模型输出格式
            messages = [SystemMessage(content=system_prompt)] + list(messages)
        
        # 解析出真正的 LLM 模型实例
        resolved_model = _resolve_model(state, runtime)

        # 包装模型，强制它输出结构化格式（比如 JSON schema 校验）
        # .with_structured_output() 会让模型自动加上格式化约束
        model_with_structured_output = _get_model(
            resolved_model
        ).with_structured_output(
            cast(StructuredResponseSchema, structured_response_schema)
        )

        # 调用模型，传入消息历史和配置，得到结构化的响应
        response = model_with_structured_output.invoke(messages, config)

        # 返回新的 state，把 structured_response 存进去
        return {"structured_response": response}


    async def agenerate_structured_response(
        state: StateSchema, runtime: Runtime[ContextT], config: RunnableConfig
    ) -> StateSchema:
        messages = _get_state_value(state, "messages")
        structured_response_schema = response_format
        if isinstance(response_format, tuple):
            system_prompt, structured_response_schema = response_format
            messages = [SystemMessage(content=system_prompt)] + list(messages)

        resolved_model = await _aresolve_model(state, runtime)
        model_with_structured_output = _get_model(
            resolved_model
        ).with_structured_output(
            cast(StructuredResponseSchema, structured_response_schema)
        )
        response = await model_with_structured_output.ainvoke(messages, config)
        return {"structured_response": response}
```


### 4.3 should_continue
should_continue 是一个 condition_edge，判断是执行 tool，还是跳转到结果处理。

比较难理解的是 `version= v2` 时，跳转到 `post_model_hook`。
1. 如果 post_model_hook 存在，会添加一个从 post_model_hook 发出的 condition_edge，处理函数是 post_model_hook_router
2. post_model_hook 可能会对 tool call 做处理，所以 post_model_hook_router 在处理 tool 时添加了过滤逻辑

```python
    # Define the function that determines whether to continue or not
    def should_continue(state: StateSchema) -> Union[str, list[Send]]:
        messages = _get_state_value(state, "messages")
        last_message = messages[-1]
        # If there is no function call, then we finish
        if not isinstance(last_message, AIMessage) or not last_message.tool_calls:
            if post_model_hook is not None:
                return "post_model_hook"
            elif response_format is not None:
                return "generate_structured_response"
            else:
                return END
        # Otherwise if there is, we continue
        else:
            if version == "v1":
                return "tools"
            elif version == "v2":
                if post_model_hook is not None:
                    return "post_model_hook"
                return [
                    Send(
                        "tools",
                        ToolCallWithContext(
                            __type="tool_call_with_context",
                            tool_call=tool_call,
                            state=state,
                        ),
                    )
                    for tool_call in last_message.tool_calls
                ]
```

### 4.4 post_model_hook_router

```python
    if post_model_hook is not None:

        def post_model_hook_router(state: StateSchema) -> Union[str, list[Send]]:
            """Route to the next node after post_model_hook.

            Routes to one of:
            * "tools": if there are pending tool calls without a corresponding message.
            * "generate_structured_response": if no pending tool calls exist and response_format is specified.
            * END: if no pending tool calls exist and no response_format is specified.
            """

            messages = _get_state_value(state, "messages")
            tool_messages = [
                m.tool_call_id for m in messages if isinstance(m, ToolMessage)
            ]
            last_ai_message = next(
                m for m in reversed(messages) if isinstance(m, AIMessage)
            )
            pending_tool_calls = [
                c for c in last_ai_message.tool_calls if c["id"] not in tool_messages
            ]

            if pending_tool_calls:
                return [
                    Send(
                        "tools",
                        ToolCallWithContext(
                            __type="tool_call_with_context",
                            tool_call=tool_call,
                            state=state,
                        ),
                    )
                    for tool_call in pending_tool_calls
                ]
            elif isinstance(messages[-1], ToolMessage):
                return entrypoint
            elif response_format is not None:
                return "generate_structured_response"
            else:
                return END
```

### 4.5 route_tool_responses
决定 tools 是直接返回，还是跳转到 agent/post_model_hook。这里难以理解的是 `if isinstance(m, AIMessage) and m.tool_calls` 这段逻辑。

按照我的理解，所有对 channel 的修改都是在 after_tick 内完成的，如果 send 都在一个周期里，所有对 channel 的 udpate 一定是都更新完成后，才会进入到下一个周期。

所以不存在注释所说的并发调用的问题。

```python
    def route_tool_responses(state: StateSchema) -> str:
        for m in reversed(_get_state_value(state, "messages")):
            if not isinstance(m, ToolMessage):
                break
            if m.name in should_return_direct:
                return END

        # handle a case of parallel tool calls where
        # the tool w/ `return_direct` was executed in a different `Send`
        # 难点理解:
        if isinstance(m, AIMessage) and m.tool_calls:
            if any(call["name"] in should_return_direct for call in m.tool_calls):
                return END
        return entrypoint
```

## 5. graph 构建
### 5.1 不存在 tool
graph:
1. agent: 
    - node: call_model
1. generate_structured_response
    - node: generate_structured_response
    - 解释: 位于最后一步，agent 已经输出结果，在调用 model 时相当于格式化 agent 的结果，所以 generate_structured_response 要获取原始 model 在绑定 


```python
        workflow = StateGraph(state_schema=state_schema, context_schema=context_schema)
        workflow.add_node(
            "agent",
            RunnableCallable(call_model, acall_model),
            input_schema=input_schema,
        )
        # pre_model_hook -> agent
        if pre_model_hook is not None:
            workflow.add_node("pre_model_hook", pre_model_hook)  # type: ignore[arg-type]
            workflow.add_edge("pre_model_hook", "agent")
            entrypoint = "pre_model_hook"
        else:
            entrypoint = "agent"

        workflow.set_entry_point(entrypoint)
        # agent -> post_model_hook
        if post_model_hook is not None:
            workflow.add_node("post_model_hook", post_model_hook)  # type: ignore[arg-type]
            workflow.add_edge("agent", "post_model_hook")


        if response_format is not None:
            workflow.add_node(
                "generate_structured_response",
                RunnableCallable(
                    generate_structured_response,
                    agenerate_structured_response,
                ),
            )
            # post_model_hook -> generate_structured_response
            if post_model_hook is not None:
                workflow.add_edge("post_model_hook", "generate_structured_response")
            # agent -> generate_structured_response
            else:
                workflow.add_edge("agent", "generate_structured_response")

        return workflow.compile(
            checkpointer=checkpointer,
            store=store,
            interrupt_before=interrupt_before,
            interrupt_after=interrupt_after,
            debug=debug,
            name=name,
        )

```

### 5.2 存在 tool
```python
    workflow = StateGraph(
        state_schema=state_schema or AgentState, context_schema=context_schema
    )

    # Define the two nodes we will cycle between
    workflow.add_node(
        "agent",
        RunnableCallable(call_model, acall_model),
        input_schema=input_schema,
    )

    # Optionally add a pre-model hook node that will be called
    # every time before the "agent" (LLM-calling node)
    if pre_model_hook is not None:
        workflow.add_node("pre_model_hook", pre_model_hook)  # type: ignore[arg-type]
        workflow.add_edge("pre_model_hook", "agent")
        entrypoint = "pre_model_hook"
    else:
        entrypoint = "agent"

    # Set the entrypoint as `agent`
    # This means that this node is the first one called
    workflow.set_entry_point(entrypoint)
    # ===========  上面同没有 tools ====================

    workflow.add_node("tools", tool_node)
    # 收集 agent 可能跳转的节点
    agent_paths = []
    # 收集 post_model 可能跳转的节点
    post_model_hook_paths = [entrypoint, "tools"]

    # agent -> post_model_hook
    if post_model_hook is not None:
        workflow.add_node("post_model_hook", post_model_hook)  # type: ignore[arg-type]
        agent_paths.append("post_model_hook")
        workflow.add_edge("agent", "post_model_hook")
    else:
        agent_paths.append("tools")

    # Add a structured output node if response_format is provided
    if response_format is not None:
        workflow.add_node(
            "generate_structured_response",
            RunnableCallable(
                generate_structured_response,
                agenerate_structured_response,
            ),
        )
        if post_model_hook is not None:
            post_model_hook_paths.append("generate_structured_response")
        else:
            agent_paths.append("generate_structured_response")
    else:
        if post_model_hook is not None:
            post_model_hook_paths.append(END)
        else:
            agent_paths.append(END)

    if post_model_hook is not None:
        # post_model_hook -> 条件路由
        # 决定 post_model_hook 跳转到 [agent/pre_model_hook, tools, generate_structured_response, END]
        workflow.add_conditional_edges(
            "post_model_hook",
            post_model_hook_router,  # type: ignore[arg-type]
            path_map=post_model_hook_paths,
        )

    # agent -> 条件路由
    # 决定 agent 跳转到 [post_model_hook, tools, generate_structured_response, END]
    workflow.add_conditional_edges(
        "agent",
        should_continue,  # type: ignore[arg-type]
        path_map=agent_paths,
    )

    # tools -> 条件路由
    # 决定 tool 是直接返回，还是跳转到 agent/post_model_hook
    if should_return_direct:
        workflow.add_conditional_edges(
            "tools", route_tool_responses, path_map=[entrypoint, END]
        )
    else:
        # tools -> agent
        # tools -> pre_model_hook
        workflow.add_edge("tools", entrypoint)

    # Finally, we compile it!
    # This compiles it into a LangChain Runnable,
    # meaning you can use it as you would any other runnable
    return workflow.compile(
        checkpointer=checkpointer,
        store=store,
        interrupt_before=interrupt_before,
        interrupt_after=interrupt_after,
        debug=debug,
        name=name,
    )
```