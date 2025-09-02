---
weight: 1
title: "Context Engineering"
date: 2025-08-20T08:00:00+08:00
lastmod: 2025-08-20T08:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Agent Context "
featuredImage: 

tags: ["Context Engineering"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

## 1. Context Engineering
Context Engineering 本质上是 **如何设计和管理 LLM 的上下文窗口，让模型在有限的 token 内得到正确的记忆、知识和状态**。

因为 LLM 的上下文窗口有限（比如 8K/32K/200K tokens），一个复杂的 Agent 需要：

* 保持对话记忆（历史消息）
* 注入外部知识（RAG 检索结果）
* 维护任务状态（工具调用结果、变量）
* 遵守系统约束（persona、目标、规则）

这就需要有一套“上下文管理工程化方法”。

---

### 1.1 Agent 中的上下文工程

在 Agent 系统里，上下文工程通常包括以下几个方面：

#### (1) **记忆类型**

* 短期记忆：对话的最近几轮消息（用来保持连贯性）
* 长期记忆：通过向量检索/知识库加载出来的历史经验
* 工作记忆：任务当前步骤的状态（变量、草稿、partial results）

#### (2) **记忆管理**
* 上下文压缩，用 LLM 对长历史进行摘要（conversation summarization）
* 使用 embedding 做语义压缩，只检索相关部分
* 利用结构化 state（而不是原始自然语言）减少 token 占用

#### (3) **动态上下文构建**

* 每次调用 LLM 时，根据 *任务需要* 动态拼装上下文：

  * 系统提示（system prompt）
  * 当前用户输入
  * 相关的历史对话
  * 相关的知识或工具结果
* 这个过程就像“上下文路由”，决定“哪些信息进入上下文，哪些舍弃”。

#### (4) **多层上下文**

* **全局上下文**：角色、规则、目标（persona / policy）
* **会话上下文**：当前对话的历史、摘要
* **任务上下文**：当前 task 的状态、变量
* **外部上下文**：检索知识、外部 API 结果

## 2. LangGraph 中的上下文工程

在 Langgraph 中:
1. 记忆类型:
    * 短期记忆: 用 State 
    * 长期记忆: 用 Store 
2. 记忆管理:
    * 短期记忆: 可以对 message 进行修剪、删除、总结
    * 长期记忆: Store 支持 embedding，可以通过语义搜索查找相关记忆
4. 多层上下文:
    * Langgraph 中没有区分多层上下文

### 2.1 message 管理
#### 修剪
```python
# 修剪
from langchain_core.messages.utils import (
    trim_messages,
    count_tokens_approximately
)
from langgraph.prebuilt import create_react_agent

# This function will be called every time before the node that calls LLM
def pre_model_hook(state):
    trimmed_messages = trim_messages(
        state["messages"],
        strategy="last",
        token_counter=count_tokens_approximately,
        max_tokens=384,
        start_on="human",
        end_on=("human", "tool"),
    )
    return {"llm_input_messages": trimmed_messages}
```

#### 删除
```python
from langchain_core.messages import RemoveMessage
from langgraph.graph.message import REMOVE_ALL_MESSAGES

# 删除
def delete_messages(state):
    messages = state["messages"]
    if len(messages) > 2:
        # remove the earliest two messages
        return {"messages": [RemoveMessage(id=m.id) for m in messages[:2]]}
# 删除所有
def delete_messages(state):
    return {"messages": [RemoveMessage(id=REMOVE_ALL_MESSAGES)]}
```

#### 摘要

```python
from typing import Any, TypedDict

from langchain.chat_models import init_chat_model
from langchain_core.messages import AnyMessage
from langchain_core.messages.utils import count_tokens_approximately
from langgraph.graph import StateGraph, START, MessagesState
from langgraph.checkpoint.memory import InMemorySaver
from langmem.short_term import SummarizationNode, RunningSummary

model = init_chat_model("anthropic:claude-3-7-sonnet-latest")
summarization_model = model.bind(max_tokens=128)

class State(MessagesState):
    context: dict[str, RunningSummary]  

class LLMInputState(TypedDict):  
    summarized_messages: list[AnyMessage]
    context: dict[str, RunningSummary]

summarization_node = SummarizationNode(
    token_counter=count_tokens_approximately,
    model=summarization_model,
    max_tokens=256,
    max_tokens_before_summary=256,
    max_summary_tokens=128,
)

def call_model(state: LLMInputState):  
    response = model.invoke(state["summarized_messages"])
    return {"messages": [response]}

checkpointer = InMemorySaver()
builder = StateGraph(State)
builder.add_node(call_model)
# 1. 添加 summary node
builder.add_node("summarize", summarization_node)
builder.add_edge(START, "summarize")
# 2. summary node 连接到 call_model
builder.add_edge("summarize", "call_model")
graph = builder.compile(checkpointer=checkpointer)

# Invoke the graph
config = {"configurable": {"thread_id": "1"}}
graph.invoke({"messages": "hi, my name is bob"}, config)
graph.invoke({"messages": "write a short poem about cats"}, config)
graph.invoke({"messages": "now do the same but for dogs"}, config)
final_response = graph.invoke({"messages": "what's my name?"}, config)

final_response["messages"][-1].pretty_print()
print("\nSummary:", final_response["context"]["running_summary"].summary)
```


### 2.2 store 语义搜索

```python
from langchain.embeddings import init_embeddings

store = InMemoryStore(
    index={
        "embed": init_embeddings("openai:text-embedding-3-small"),  # Embedding provider
        "dims": 1536,                              # Embedding dimensions
        "fields": ["food_preference", "$"]              # Fields to embed
    }
)

memories = store.search(
    namespace_for_memory,
    query="What does the user like to eat?",
    limit=3  # Return top 3 matches
)
```

## 3. langmem
langchain 生态提供了 langmem 库用于智能体记忆管理。

记忆的核心有三个部分组成:
1. 记忆类型: 记忆的类型，其决定了记忆如何更新和使用
    - 语义记忆
    - 情景记忆
    - 程序性记忆
2. 写入记忆: 何时（以及由谁）应该形成记忆
3. 存储系统: 记忆应该存储在何处？


### 3.1 记忆类型

下面是关于记忆类型的总结:

| 记忆类型               | 目的    | Agent 示例      | 人类示例              | 典型存储方式       |
| ------------------ | ----- | ------------- | ----------------- | ------------ |
| 语义记忆 (Semantic)    | 事实与知识 | 用户偏好；知识三元组    | 知道 Python 是一种编程语言 | 画像或集合        |
| 情景记忆 (Episodic)    | 过去的经历 | 少样本示例；过往对话的摘要 | 记得你第一天上班的情景       | 集合           |
| 程序性记忆 (Procedural) | 系统行为  | 核心人格与响应模式     | 知道如何骑自行车          | Prompt 规则或集合 |

关于记忆类型的理解很重要，建议多阅读几次[核心概念的文档](https://github.langchain.ac.cn/langmem/concepts/conceptual_guide/#memory-types)。

我们可以做如下类型:
1. 集合:
    - 类似知识库，每一条记录代表一个知识要点
    - 知识更新时，需要考虑已有知识，比如说旧知识已经失效需要删除、或者新知识是对旧知识的补充
    - 类似知识库，从集合中检索知识存在召回率和准确率的问题
    - 
2. 资料卡:
    - 代表独立实体的描述信息，比如说个人资料，唯一
3. 情景记忆:
    - 代表成功回答的过程，捕捉了互动的完整上下文——情境、导致成功的思考过程以及该方法为何有效。
    - 在提示词中作为 example 优化 LLM 输出
4. 程序性记忆:
    - 根据反馈优化提示，基于历史 message，使用 meta prompt 优化 prompt

文档里总结了几幅图，帮助我们理解记忆类型的关系。


|记忆类型|更新方式|
|:---|:---|
|集合|![集合](/images/langgraph/update-list.png)|
|资料卡|![资料卡](/images/langgraph/update-profile.png)|
|情景记忆|无|
|程序性记忆|![程序性记忆](/images/langgraph/update-instructions.png)|

记忆管理在 Langmem 中的核心抽象是 `MemoryManager`，有两种创建方式:
1. `create_memory_manager`: 不支持后端存储
2. `create_memory_store_manager`: 支持后端存储

提示词更新的核心抽象是: 
1. `MetaPromptOptimizer`
2. `MultiPromptOptimizer`

统一的创建入口是 `create_prompt_optimizer`

### 3.2 写入记忆
写入记忆指的是记忆更新的时机

| 形成类型 | 延迟影响 | 更新速度 | 处理负载 | 用例             |
|----------|----------|----------|----------|------------------|
| 主动     | 较高     | 立即     | 响应期间 | 关键上下文更新   |
| 后台     | 无       | 延迟     | 调用之间/之后 | 模式分析、摘要 |

![写入时机](/images/langgraph/hot_path_vs_background.png)

Langmem 中后台更新的核心抽象是 `ReflectionExecutor`

### 3.3 存储系统
Langmem 的存储系统建立在 Langgraph 的 Store 上。提供了命名空间的抽象: `NamespaceTemplate`

现在我们来一一介绍这些核心抽象的实现。

## 4. 使用示例
### 4.1 集合类型记忆
介绍源码之前，我们先来看一下文档里，给出了集合类型记忆的示例:


```python
from langmem import create_memory_manager 
from pydantic import BaseModel

class Triple(BaseModel): 
    """Store all new facts, preferences, and relationships as triples."""
    subject: str
    predicate: str
    object: str
    context: str | None = None

class PreferenceMemory(BaseModel):
    "Store preferences about the user."
    category: str
    preference: str
    context: str

# Configure extraction
manager = create_memory_store_manager(
    "anthropic:claude-3-5-sonnet-latest",
    namespace=("chat", "{user_id}", "triples"),  
    schemas=[Triple],
    instructions="Extract all user information and events as triples.",
    enable_inserts=True,
    enable_deletes=True,
)

my_llm = init_chat_model("anthropic:claude-3-5-sonnet-latest")
# Define app with store context
@entrypoint(store=store) 
def app(messages: list):
    response = my_llm.invoke(
        [
            {
                "role": "system",
                "content": "You are a helpful assistant.",
            },
            *messages
        ]
    )

    # Extract and store triples (Uses store from @entrypoint context)
    manager.invoke({"messages": messages}) 
    return response
```
