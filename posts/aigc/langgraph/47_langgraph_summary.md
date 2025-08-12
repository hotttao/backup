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

可以看到中断和恢复逻辑核心函数是 



## 2. 节点间的参数传递

```python
def prepare_single_task():
    elif task_path[0] == PULL:
        if _triggers(
            channels,
            checkpoint["channel_versions"],
            checkpoint["versions_seen"].get(name),
            checkpoint_null_version,
            proc,
        ):
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

def run_with_retry(
    task: PregelExecutableTask,
    retry_policy: Sequence[RetryPolicy] | None,
    configurable: dict[str, Any] | None = None,
) -> None:
    """Run a task with retries."""
    retry_policy = task.retry_policy or retry_policy
    attempts = 0
    config = task.config
    if configurable is not None:
        config = patch_configurable(config, configurable)
    while True:
        try:
            # clear any writes from previous attempts
            task.writes.clear()
            # 从 task.input 读取输入，input 从 _proc_input 获取
            return task.proc.invoke(task.input, config)


class RunnableCallable(Runnable):
    def invoke(
        self, input: Any, config: RunnableConfig | None = None, **kwargs: Any
    ) -> Any:
        # 处理 runtime，config 等参数

```

## 3. channel finish