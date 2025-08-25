---
weight: 1
title: "Agent 工具链"
date: 2025-08-20T11:00:00+08:00
lastmod: 2025-08-20T11:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "RagFlow Do Task"
featuredImage: 

tags: ["Agent Tool"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

## 🔎 1. **观测 / Tracing / Debugging**

这些工具帮你看到 **Prompt、调用链、输入输出、Token 消耗**：

* **Langfuse** 👉 开源，LLMOps 平台（监控+Prompt版本管理+评估）
* **LangSmith (by LangChain)** 👉 LangChain 官方的 LLM observability 平台，和 LCEL / LangGraph 深度集成
* **Phoenix (by Arize AI)** 👉 开源的 LLM observability 工具，支持检索质量、embedding 分析
* **PromptLayer** 👉 早期的 Prompt 版本管理 + 调用日志平台（SaaS）
* **Weights & Biases (W\&B)** 👉 原本是 ML 实验管理，现在也支持 LLM 调用追踪和评估

---

## 📊 2. **评估 / Benchmark / 监控**

这些工具用于 **自动评估模型效果**，类似 “单测 + 监控”：

* **TruLens** 👉 开源，支持对 LLM 应用做 “质量评估指标（groundedness, relevance, toxicity）”
* **Ragas** 👉 专注于 RAG 系统的自动化评估（比如检索覆盖率、回答相关性）
* **Evals (OpenAI)** 👉 OpenAI 官方的 LLM 评测框架，用于构建评估数据集和指标
* **DeepEval** 👉 轻量级 LLM 应用测试框架，类似 `pytest` for LLM

---

## 🧩 3. **Prompt 管理 / 实验平台**

这些偏向 **Prompt 版本管理、实验调优**：

* **PromptLayer** 👉 （重复上面）Prompt 版本控制 + 调用日志
* **Humanloop** 👉 Prompt 管理和 A/B 实验（SaaS）
* **PromptOps** 👉 Prompt 生命周期管理（小众）
* **Weights & Biases (W\&B)** 👉 支持 Prompt/参数实验追踪

---

## 🤖 4. **Agent / Workflow 调试**

这些适合做 **Agent 执行链可视化、调试**：

* **LangSmith** 👉 Agent + Chain 跟踪（LangChain 专用）
* **Griptape Studio** 👉 开源 Agent 框架，带内置观测和调试工具
* **OpenTelemetry + Custom Exporter** 👉 有些公司会把 LLM 调用接到 OTEL 里统一监控

---

## 🏗️ 5. **企业级 LLMOps 平台**

这些更全面，包含 **监控 + 部署 + 数据管理**：

* **Arize AI**（商业版，Phoenix 是开源子集）
* **WhyLabs**（数据监控 + 模型监控）
* **Humanloop**（训练/迭代 + 数据标注）
* **Weights & Biases**（ML 实验 + LLM 集成）

---

✅ 总结
如果你在做 **RAG/Agent 开发**：

* **调试 & 链路追踪** 👉 Langfuse / LangSmith / Phoenix
* **效果评估** 👉 TruLens / Ragas
* **Prompt 实验管理** 👉 PromptLayer / Humanloop
* **企业级** 👉 W\&B / Arize


好的 ✅ 我给你整理了一张对比表，涵盖常见的 LLM/Agent 开发辅助工具（Langfuse、LangSmith、TruLens、Ragas 等），按功能纬度横向对比：

---

## 6. 🔍 LLM & Agent 开发工具对比表

| 工具                           | 核心定位                             | 功能支持                                                                              | 是否开源       | 典型使用场景                          |
| ---------------------------- | -------------------------------- | --------------------------------------------------------------------------------- | ---------- | ------------------------------- |
| **Langfuse**                 | LLM Observability & Debug        | ✅ Tracing（调用链路）<br>✅ Metrics（延迟/Token/成本）<br>✅ Prompt 版本管理<br>✅ 用户反馈收集            | ✅ 开源       | 开发 & 线上观测，替代自建日志系统              |
| **LangSmith (by LangChain)** | 调试 & 监控平台（LangChain 专用）          | ✅ Tracing & Chain/Graph 调试<br>✅ Dataset 评估<br>✅ Prompt 管理<br>✅ Eval 集成            | ❌ 闭源（SaaS） | LangChain / LangGraph 项目调试和生产监控 |
| **Phoenix (by Arize AI)**    | LLM Observability & Embedding 监控 | ✅ 数据分布可视化<br>✅ RAG 检索质量评估<br>✅ Embedding 偏差监控<br>✅ Drift 检测                       | ✅ 开源       | 监控 RAG 系统质量、Embedding 偏移        |
| **TruLens**                  | 评估 & 反馈框架                        | ✅ 自定义指标（Groundedness, Relevance, Toxicity）<br>✅ Feedback Loop<br>✅ 与 LangChain 集成 | ✅ 开源       | 自动评估 LLM 回答质量，持续优化              |
| **Ragas**                    | 专注 RAG 系统的评估                     | ✅ 检索覆盖率<br>✅ 回答正确性<br>✅ Answer-Faithfulness<br>✅ BLEU/ROUGE 等文本指标                 | ✅ 开源       | 评估和对比不同 RAG pipeline            |
| **DeepEval**                 | 测试框架                             | ✅ 类似 `pytest` 的 LLM 测试<br>✅ 支持自动化评估<br>✅ 多模型对比                                    | ✅ 开源       | 对 RAG/Agent 写单测，CI/CD 集成        |
| **PromptLayer**              | Prompt 管理 + 调用日志                 | ✅ Prompt 版本管理<br>✅ 日志追踪<br>✅ 与 OpenAI API 集成方便                                    | ❌ 闭源（SaaS） | 管理和回滚 Prompt 实验                 |
| **Humanloop**                | Prompt Ops 平台                    | ✅ Prompt 管理<br>✅ 人工标注<br>✅ A/B 测试<br>✅ 数据集管理                                      | ❌ 闭源（SaaS） | 企业级 Prompt 优化与实验                |
| **Weights & Biases (W\&B)**  | 实验管理 + LLMOps                    | ✅ LLM 调用日志<br>✅ Prompt & 参数实验追踪<br>✅ Eval & 监控                                    | ❌ 闭源（商业为主） | 大规模实验 + 生产监控                    |

---

📌 **总结：**

* 如果你要做 **开源可自建**：优先看 **Langfuse + TruLens/Ragas + Phoenix**
* 如果你用 **LangChain/LangGraph**：直接用 **LangSmith** 最方便
* 如果是企业级需求：可以考虑 **W\&B / Arize**


## 7. 长短期记忆

我帮你整理一个工具清单，分 **短期记忆** / **长期记忆** 两类，以及常见的开源/托管方案。

---

### 7.1 🧠 短期记忆（Session / Working Memory）

短期记忆通常通过**上下文管理**实现（窗口记忆、会话缓存），常见工具：

* **LangChain Memory**

  * `ConversationBufferMemory`（简单上下文缓存）
  * `ConversationBufferWindowMemory`（窗口记忆，限制长度）
  * `ConversationTokenBufferMemory`（基于 token 的窗口）
  * `ConversationKGMemory`（把上下文提炼为知识图谱）

* **LlamaIndex Memory**

  * `ChatMemoryBuffer`（类似 buffer）
  * `ChatSummaryMemory`（摘要型，节省 token）

* **Haystack Memory**

  * 内置会话存储，可接数据库

👉 短期记忆一般放在 **内存对象 / 缓存** 里，随 session 销毁，不做持久化。

---

### 7.2 🗂️ 长期记忆（Persistent / Episodic Memory）

长期记忆通常需要 **数据库 + 检索** 支撑（结构化事实 + 向量搜索）：

#### 开源方案

* **Mem0**

  * 多层记忆（短期 + 语义 + 情节性）
  * 默认 SQLite + Chroma，可切换 Postgres + Qdrant/Pinecone
  * 强调 token 优化和持续改进

* **Zep**

  * 长期记忆 + **时间记忆（temporal memory）**
  * 支持版本化（可以回溯过去的记忆，而不是覆盖）
  * 有 Python/TS SDK

* **Llongterm**

  * Mind-as-a-Service 模式
  * 提供持久会话记忆存储

* **Cognee**

  * 开源 AI 记忆引擎，偏重本地化和隐私
  * 提供个性化语义检索

* **MemoryGPT / Memoripy**

  * 轻量的长期对话记忆
  * embedding + 本地存储，适合 demo / 研究

#### 向量数据库层（作为记忆后端）

* **Chroma / Qdrant / Weaviate / Milvus / Pinecone**

  * 适合保存语义 embedding，用于“长期记忆检索”
  * 常和 LangChain/LlamaIndex 组合使用

---

### 7.3 ⚡ 实际用法模式


1. **短期记忆**

   * 用 **buffer/window memory** 管理最近几轮对话
   * 节省 token，保证连贯性

2. **长期记忆**

   * 对重要事实做 **摘要/embedding** → 存入 **向量数据库**
   * 需要时检索召回 → 拼接进 prompt

3. **组合策略**

   * 短期：ConversationBuffer（保持最近上下文）
   * 长期：Mem0/Zep + 向量存储（保存事实 & 历史事件）
   * 最终构成“短期记忆 + 长期记忆”的混合架构

---

✅ 总结：

* **短期记忆** → LangChain/LlamaIndex 自带的 Memory 模块就够了。
* **长期记忆** → 推荐用 **Mem0（默认开源选项）** 或 **Zep（功能更全）**；轻量需求可以选 **Llongterm / Cognee / MemoryGPT**。
