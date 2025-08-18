---
weight: 1
title: "deerflow langgraph"
date: 2025-08-14T9:00:00+08:00
lastmod: 2025-08-14T9:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "deerflow langgraph"
featuredImage: 

tags: ["mcp"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---


从前面介绍的  deerflow 的整体结构中，可以看到 deerflow 的核心是基于 Langgraph 实现的 Agent。这一节我们就来学习这个 Agent 的构建过程。

## 1. graph
graph build 位于 `src/graph/builder.py`

```python
def _build_base_graph():
    """Build and return the base state graph with all nodes and edges."""
    builder = StateGraph(State)
    builder.add_edge(START, "coordinator")
    builder.add_node("coordinator", coordinator_node)
    builder.add_node("background_investigator", background_investigation_node)
    builder.add_node("planner", planner_node)
    builder.add_node("reporter", reporter_node)
    builder.add_node("research_team", research_team_node)
    builder.add_node("researcher", researcher_node)
    builder.add_node("coder", coder_node)
    builder.add_node("human_feedback", human_feedback_node)
    builder.add_edge("background_investigator", "planner")
    builder.add_conditional_edges(
        "research_team",
        continue_to_running_research_team,
        ["planner", "researcher", "coder"],
    )
    builder.add_edge("reporter", END)
    return builder
```

![deerflow graph](/images/langgraph/architecture.png)

接下来我将从代码、提示词两个维度，介绍上面所有的 node

### 1.1 coordinator
coordinator 是 graph 的入口

#### 提示词模板

#### 代码

```python
@tool
def handoff_to_planner(
    research_topic: Annotated[str, "The topic of the research task to be handed off."],
    locale: Annotated[str, "The user's detected language locale (e.g., en-US, zh-CN)."],
):
    """Handoff to planner agent to do plan."""
    # 这个工具没有返回值，它的唯一作用就是：
    # 让 LLM 在对话中通过调用这个 tool 来“发信号”，
    # 告诉系统 —— “现在要把任务交给 planner agent 来处理”。
    return


def coordinator_node(
    state: State, config: RunnableConfig
) -> Command[Literal["planner", "background_investigator", "__end__"]]:
    """Coordinator node that communicate with customers."""
    # 协调器节点（coordinator），负责与用户对话，并根据情况决定流程走向

    logger.info("Coordinator talking.")

    # 从 config 中提取可配置项（例如资源、参数等）
    configurable = Configuration.from_runnable_config(config)

    # 根据 prompt 模板和当前状态，生成给 LLM 的输入消息
    # 提示词模板位于 prompts 目录下，使用 jinja2 模板引擎

    messages = apply_prompt_template("coordinator", state)

    # 调用 LLM（coordinator agent 专用的模型），并绑定工具 handoff_to_planner
    # 这样 LLM 的输出可以触发 "handoff_to_planner" 工具调用
    response = (
        get_llm_by_type(AGENT_LLM_MAP["coordinator"])
        .bind_tools([handoff_to_planner])
        .invoke(messages)
    )

    # 打印当前 state 的消息，方便调试
    logger.debug(f"Current state messages: {state['messages']}")

    # 默认跳转目标是 __end__（终止 workflow）
    goto = "__end__"

    # 从 state 中取出 locale 和 research_topic，若不存在则设默认值
    locale = state.get("locale", "en-US")         # 默认使用 en-US
    research_topic = state.get("research_topic", "")

    # 如果 LLM 响应中有 tool_calls，说明 coordinator 想把任务交给 planner
    if len(response.tool_calls) > 0:
        goto = "planner"  # 默认交给 planner 处理
        if state.get("enable_background_investigation"):
            # 如果允许“背景调查”，则优先跳到 background_investigator 节点
            goto = "background_investigator"
        try:
            # 遍历所有工具调用
            for tool_call in response.tool_calls:
                if tool_call.get("name", "") != "handoff_to_planner":
                    # 只处理 handoff_to_planner，其它工具忽略
                    continue
                # 如果 tool_call 里传了 locale 和 research_topic，则更新
                if tool_call.get("args", {}).get("locale") and tool_call.get(
                    "args", {}
                ).get("research_topic"):
                    # 结合提示词模板，根据输入确定语言
                    locale = tool_call.get("args", {}).get("locale")
                    research_topic = tool_call.get("args", {}).get("research_topic")
                    break
        except Exception as e:
            # 捕获并记录解析 tool_calls 出错的情况
            logger.error(f"Error processing tool calls: {e}")
    else:
        # 如果没有任何工具调用，说明 LLM 没有正确响应 → 终止执行
        logger.warning(
            "Coordinator response contains no tool calls. Terminating workflow execution."
        )
        logger.debug(f"Coordinator response: {response}")

    # 从 state 取出现有消息列表
    messages = state.get("messages", [])
    if response.content:
        # 如果 LLM 返回了内容，把它加到消息列表里，作为“coordinator”的发言
        messages.append(HumanMessage(content=response.content, name="coordinator"))

    # 返回一个 Command，包含：
    # - update: 更新 state（messages、locale、research_topic、resources）
    # - goto: 下一步跳转的节点（planner / background_investigator / __end__）
    return Command(
        update={
            "messages": messages,
            "locale": locale,
            "research_topic": research_topic,
            "resources": configurable.resources,
        },
        # 跳转目标节点，整个 graph 内没有使用 edge，都是使用 Command 直接跳转
        goto=goto,
    )
```


### 1.2 background_investigation_node
background_investigation_node 的代码比较简单:
1. 实例化用户配置的搜索引擎
2. 执行用户输入的查询
3. 返回 `{"background_investigation_results": 搜索结果}`
4. graph 添加了一个条 edge `builder.add_edge("background_investigator", "planner")`，所以 background_investigation_node 执行完会直接跳转到 planner 节点


### 1.3 planner_node

#### 提示词模板

```python
def planner_node(
    state: State, config: RunnableConfig
) -> Command[Literal["human_feedback", "reporter"]]:
    """
    Planner 节点，用于生成完整的研究计划（Plan）。
    这是多智能体系统中的核心节点之一，负责：
      - 根据用户需求、上下文信息、背景调查结果生成研究计划
      - 判断信息是否充分（has_enough_context）
      - 决定下一步节点是 human_feedback 还是 reporter
    """

    logger.info("Planner generating full plan")
    # 从 RunnableConfig 创建可配置对象，包含最大迭代数、深度思考选项等
    configurable = Configuration.from_runnable_config(config)

    # 获取当前计划迭代次数，如果 state 中没有 plan_iterations 则默认为 0
    plan_iterations = state["plan_iterations"] if state.get("plan_iterations", 0) else 0

    # 根据 planner prompt 模板生成输入消息
    messages = apply_prompt_template("planner", state, configurable)

    # 如果开启了背景调查功能且已有背景调查结果，则将其作为用户消息追加到 LLM 输入中
    if state.get("enable_background_investigation") and state.get(
        "background_investigation_results"
    ):
        messages += [
            {
                "role": "user",
                "content": (
                    "background investigation results of user query:\n"
                    + state["background_investigation_results"]
                    + "\n"
                ),
            }
        ]

    # 根据配置选择 LLM
    if configurable.enable_deep_thinking:
        llm = get_llm_by_type("reasoning")  # 深度推理模型
    elif AGENT_LLM_MAP["planner"] == "basic":
        llm = get_llm_by_type("basic").with_structured_output(
            Plan,
            method="json_mode",  # 输出结构化 JSON
        )
    else:
        llm = get_llm_by_type(AGENT_LLM_MAP["planner"])  # 使用指定类型的 planner LLM

    # 如果计划迭代次数超过最大迭代次数，直接跳到 reporter 节点
    if plan_iterations >= configurable.max_plan_iterations:
        return Command(goto="reporter")

    full_response = ""
    # 根据不同 LLM 类型，选择同步调用或流式调用
    if AGENT_LLM_MAP["planner"] == "basic" and not configurable.enable_deep_thinking:
        # 基础模型同步调用
        response = llm.invoke(messages)
        full_response = response.model_dump_json(indent=4, exclude_none=True)
    else:
        # 高级模型流式调用，将每个 chunk 拼接成完整响应
        response = llm.stream(messages)
        for chunk in response:
            full_response += chunk.content

    logger.debug(f"Current state messages: {state['messages']}")
    logger.info(f"Planner response: {full_response}")

    # 尝试解析 LLM 输出为 JSON 格式的计划
    try:
        curr_plan = json.loads(repair_json_output(full_response))
    except json.JSONDecodeError:
        logger.warning("Planner response is not a valid JSON")
        # 如果不是第一次迭代，跳到 reporter
        if plan_iterations > 0:
            return Command(goto="reporter")
        else:
            # 否则结束 workflow
            return Command(goto="__end__")

    # 如果 LLM 输出中标记上下文信息充足
    if isinstance(curr_plan, dict) and curr_plan.get("has_enough_context"):
        logger.info("Planner response has enough context.")
        new_plan = Plan.model_validate(curr_plan)  # 使用 Plan 模型校验和解析
        return Command(
            update={
                "messages": [AIMessage(content=full_response, name="planner")],
                "current_plan": new_plan,
            },
            goto="reporter",  # 上下文充足，直接进入报告生成节点
        )

    # 如果上下文不充分，则需要 human_feedback 节点进一步处理
    return Command(
        update={
            "messages": [AIMessage(content=full_response, name="planner")],
            "current_plan": full_response,  # 保留原始 LLM 输出
        },
        goto="human_feedback",
    )

```