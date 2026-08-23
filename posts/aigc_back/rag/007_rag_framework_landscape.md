---
weight: 7
title: "开源 RAG 框架全景与选型：从 RAGFlow 到 Haystack、LlamaIndex、Open WebUI"
date: 2026-08-22T12:00:00+08:00
lastmod: 2026-08-22T12:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "区分完整 RAG 平台、开发框架和专项框架，对比 RAGFlow、Open WebUI、Dify、FastGPT、Haystack、LlamaIndex、LangChain 等本地开源方案。"
featuredImage:

tags: ["RAG", "知识库", "文档解析", "检索评估"]
categories: ["RAG"]

lightgallery: true
---

除了 RAGFlow，开源社区还有大量被称为“RAG 框架”的项目，但它们并不处于同一层级：Dify 是 AI 应用平台，Haystack 是代码框架，Open WebUI 首先是本地 AI 工作台，LightRAG 则专注图检索。如果把它们直接放在一张功能表中，很容易得出错误结论。

本文按完整 RAG 平台、开发框架和专项框架分类，并结合 PDF/OCR、Chunk、召回率评估这一具体目标给出选型建议。

<!-- more -->

## 1. 先区分三类项目

```text
完整 RAG 平台
  文档上传、知识库、索引、检索、对话、用户和管理 UI

RAG 开发框架
  Loader、Document、Chunker、Retriever、Reranker、Evaluator

专项 RAG 框架
  GraphRAG、企业搜索、本地文档问答或评估
```

RAGFlow 同时覆盖 PDF 解析、OCR、Chunk、混合检索、知识库管理、对话和引用，属于完整平台。LangChain 和 Haystack 主要提供程序组件，不会自动变成一个完整知识库产品。

## 2. 与 RAGFlow 同级的完整平台

| 项目 | 主要定位 | 更擅长什么 | 相比 RAGFlow 的主要不足 |
| --- | --- | --- | --- |
| Open WebUI | 本地 AI 工作台和知识库 | 本地模型、解析器切换、轻量知识库 | 企业摄取和高级结构检索较弱 |
| Dify | AI 应用与工作流平台 | Workflow、Agent、应用发布 | PDF 深度解析不是核心优势 |
| FastGPT | 中文知识库与 Agent 平台 | 中文生态、QA 数据、工作流 | 复杂 OCR 和检索评估需补充 |
| MaxKB | 企业知识库助手 | 简单部署、内部问答 | 检索和 Chunk 实验能力有限 |
| Onyx | 企业搜索平台 | 数据连接器、持续同步、企业搜索 | 扫描 PDF 不是核心方向 |
| Kotaemon | 文档问答工具 | 引用、本地文档 QA、研究实验 | 企业多租户和大规模摄取较弱 |
| AnythingLLM | 本地桌面 AI 应用 | 安装简单、个人知识库 | RAG 细节可调性有限 |

### 2.1 Open WebUI：最适合快速对比解析器

Open WebUI 已不只是 Ollama 的聊天界面。当前知识库支持 Focused Retrieval 和 Full Context、BM25 + 向量混合检索、Cross-Encoder Reranker、多种向量数据库，以及 Tika、Docling、MinerU、PaddleOCR、Marker 等解析后端。

它对本文 PDF/OCR 研究最有价值的地方，是可以在一个现成 UI 中切换多个文档解析器，再对知识库执行查询。它适合快速人工体验和本地模型问答。

不足是它首先是 AI 工作台，不是专门的文档摄取研究平台。父子块、TOC、RAPTOR、GraphRAG、精细任务管理和引用链路不如 RAGFlow 完整，系统化 Recall@K 评估仍需要外部脚本。

### 2.2 Dify：更偏 AI 应用和工作流

Dify 的核心优势是 Knowledge、Workflow、Chatflow、Agent 和 API 发布的组合。知识检索节点可以选择知识库、设置分数阈值、执行 metadata filter，并把命中的 chunk、标题和 metadata 交给后续 LLM 节点。

如果目标是快速构建一个业务应用，Dify 通常比自己写 LangChain 服务高效。但它的差异化能力不在 PDF OCR、表格、公式和 bbox 引用。Community 版的文档摄取主要依赖 Dify ETL，也可以配置 Unstructured ETL。

### 2.3 FastGPT：中文知识库和工作流

FastGPT 提供知识库、数据处理、RAG 检索和可视化工作流，支持 QA 数据、多向量映射、网站同步和第三方知识库接入。它适合中文客服、企业问答和业务 Agent。

它的优势是国内模型与业务接入体验，缺点是 PDF/OCR 不是像 DeepDoc 那样的核心底层，复杂文档解析和检索质量评估仍需要额外工具。选型时还要区分社区自托管与商业版本的功能和许可边界。

### 2.4 MaxKB：快速建设企业知识库

MaxKB 支持本地文档、网站知识库、自动切分、向量化、工作流和 MCP，产品界面相对简单，适合内部知识库、客服和教育场景。

它更适合快速交付而不是深入研究。OCR、复杂表格、业务 Chunker、混合召回和系统评估如果有较高要求，通常需要二次开发。

### 2.5 Onyx：企业数据连接器与搜索

Onyx 原名 Danswer，主要解决 Slack、Confluence、Google Drive、SharePoint、GitHub 等企业数据源的连接、同步和搜索。标准模式包括混合索引、后台 Worker、Redis、对象存储和连接器，适合持续变化的企业知识。

如果语料主要来自多个 SaaS 系统，Onyx 比只处理上传文件的平台更合适；如果重点是中文扫描 PDF、论文公式或教材，RAGFlow、MinerU 及专业解析器路线更直接。部分细粒度权限能力需要注意社区版和企业版边界。

### 2.6 Kotaemon：面向文档问答和引用

Kotaemon 是较轻量的文档问答工具，支持本地部署、混合检索、引用、多模态 QA、GraphRAG，并可接入本地 Docling 和 PaddleOCR。

它的代码和 UI 适合个人、研究人员或小团队验证文档 QA；企业级权限、任务调度、持续同步和大规模索引能力弱于 RAGFlow 和 Onyx。

### 2.7 AnythingLLM：最容易开始的本地知识库

AnythingLLM 提供桌面和 Docker 版本，内置文档 RAG、Agent 和无代码 Agent Builder，适合个人或小团队快速完成“上传文档并对话”。

它的优势是简单和隐私友好，弱点是 OCR、复杂版面、Chunk、检索和评估的控制深度有限。它更像开箱即用的本地 AI 应用，不是 RAG 算法实验平台。

## 3. 适合自己开发的 RAG 框架

### 3.1 Haystack：最适合建立检索评估管线

Haystack 以 Component 和 Pipeline 为核心，包含 Document Store、BM25/Dense/Hybrid Retriever、Ranker、Generator 和 Metadata Filter。与多数完整平台相比，它对评估的支持更系统：可以分别评估 Retriever、Generator 或整个 Pipeline，并提供 Document MRR、MAP 等 Evaluator，也能连接 Ragas 和 DeepEval。

它非常适合做控制变量实验：

```text
OpenDataLoader / MinerU / Docling / DeepDoc
  → 统一 Haystack Document
  → 多种 Chunker
  → BM25 / Dense / Hybrid Retriever
  → Reranker
  → MRR、MAP、Recall、端到端评估
```

不足是它没有 RAGFlow 那样完整的知识库管理、用户权限、文档预览和任务 UI，PDF OCR 也需要连接外部解析器。

### 3.2 LlamaIndex：适合研究 Node 和高级检索

LlamaIndex 把 `Document` 定义为原始数据容器，把 `Node` 定义为可以检索的原子单元。围绕 Node，它提供父子节点、递归检索、Sentence Window、Auto-Merging、路由、多索引和检索评估。

它适合研究：

- 父子 Chunk；
- Sentence Window；
- Recursive Retrieval；
- Auto-Merging Retrieval；
- 多索引和多文档路由。

不足是完整应用、权限、任务和文档管理需要自己建设，部分高级解析文档会引导到云端 LlamaParse。本地方案仍应接入 Docling、MinerU、OpenDataLoader 等解析器。

### 3.3 LangChain / LangGraph：集成最广的胶水框架

LangChain 提供大量 Loader、Splitter、Embedding、Vector Store 和 Retriever 集成，文档 Loader 已覆盖 Docling、OpenDataLoader PDF、Unstructured、PyMuPDF 等。LangGraph 可以继续编排查询改写、多路召回、反思和 Agentic RAG。

它的优点是生态广、接入快；缺点是它不替使用者定义高质量 chunk，也不是完整 RAG 产品。评估通常需要 LangSmith、Ragas、DeepEval 或自定义脚本。

当前四个 OCR demo 使用 LangChain `Document + FAISS` 统一验证接入是合理的，但要做严谨的 OCR/Chunk 控制实验，Haystack 的评估组件通常更直接。

## 4. 专项 RAG 框架

### 4.1 LightRAG：轻量知识图谱检索

LightRAG 将文本向量与知识图谱结合，支持 local、global 和 hybrid 等查询模式，适合实体关系、多跳问题、跨文档关系和全局概括。

它不能代替 OCR 和 PDF Parser。正确链路仍是：

```text
PDF Parser
→ 结构化文本和 Chunk
→ LightRAG 抽取实体关系
→ 图与向量联合检索
```

对于合同关系、人物组织关系和跨文档概括可能有价值；对于手机号、金额、项目地址等直接事实，GraphRAG 通常增加了不必要的成本和错误来源。

### 4.2 评估框架不是 RAG 平台

Ragas、DeepEval、TruLens、Phoenix 等主要负责评估或观测。它们不会替代文档解析、Chunk 和向量库，但可以与 Haystack、LlamaIndex、LangChain 或完整平台组合，用来计算：

- Context Recall；
- Context Precision；
- Faithfulness；
- Answer Correctness；
- 引用正确率；
- 延迟和成本。

## 5. 按目标选型

| 目标 | 推荐 |
| --- | --- |
| 完整 PDF RAG 平台 | RAGFlow |
| 快速本地知识库和解析器对比 | Open WebUI |
| AI Workflow 和应用发布 | Dify / FastGPT |
| 简单企业内部知识库 | MaxKB |
| 企业数据源持续同步和搜索 | Onyx |
| 个人文档问答和引用 | Kotaemon / AnythingLLM |
| 自定义检索管线与系统评估 | Haystack |
| 父子 Node、递归和高级索引 | LlamaIndex |
| 最大范围的组件集成 | LangChain / LangGraph |
| 图关系和多跳检索 | LightRAG |

## 6. 针对 PDF/OCR 与 Chunk 研究的建议

当前目标不是尽快发布一个聊天机器人，而是回答：不同解析器和 Chunker 在真实问题上的召回质量如何。因此不建议同时安装七个完整平台，而应保留三个层次的对照：

### 第一层：解析器

```text
OpenDataLoader
MinerU
Docling
Unstructured / DeepDoc
```

统一转换成带文本、标题、页码、bbox 和 element ID 的中间结构。

### 第二层：检索与评估框架

优先增加 Haystack：固定同一解析结果，分别测试固定长度、标题感知、业务规则和父子 Chunk；固定同一 Chunk，再比较 BM25、Dense、Hybrid 和 Reranker。

### 第三层：完整平台

选择 RAGFlow 和 Open WebUI 做对照：

- RAGFlow 代表深度文档摄取、父子块、混合检索和引用闭环；
- Open WebUI 代表轻量本地平台、多解析器和快速人工体验。

推荐实验架构：

```text
四个 Parser
  → 统一文档元素
  → Haystack 多 Chunker / 多 Retriever 评估
  → 选出最优组合
  → 分别接入 RAGFlow 与 Open WebUI 验证平台效果
```

## 7. 结论

不存在一个在所有层面都优于 RAGFlow 的框架：

- RAGFlow 的优势是 PDF 解析、知识库摄取、Chunk、检索和引用形成完整闭环；
- Open WebUI 更轻、更适合本地模型和解析器快速切换；
- Dify、FastGPT 更适合工作流和应用交付；
- Onyx 更适合企业连接器和持续搜索；
- Haystack 更适合建立可重复的检索评估；
- LlamaIndex 更适合研究 Node、父子块和高级索引；
- LangChain 的优势是集成范围，而不是默认 RAG 质量；
- LightRAG 解决的是图关系问题，不能替代文档解析。

对于当前 PDF/OCR 项目，最值得增加的不是另一个大而全平台，而是 **Haystack 评估层 + Open WebUI 平台对照**。这样既能系统计算召回指标，又能观察完整产品中的实际使用体验。

## 参考资料

1. [RAGFlow](https://github.com/infiniflow/ragflow)
2. [Open WebUI Knowledge](https://docs.openwebui.com/features/workspace/knowledge/)
3. [Open WebUI RAG](https://docs.openwebui.com/features/chat-conversations/rag/)
4. [Dify Knowledge Retrieval](https://github.com/langgenius/dify-docs/blob/main/en/cloud/use-dify/nodes/knowledge-retrieval.mdx)
5. [FastGPT](https://github.com/labring/FastGPT)
6. [FastGPT 知识库](https://doc.tryfastgpt.ai/docs/guide/knowledge_base/)
7. [MaxKB Documentation](https://docs.maxkb.pro/)
8. [Onyx](https://github.com/onyx-dot-app/onyx)
9. [Kotaemon](https://github.com/Cinnamon/kotaemon)
10. [AnythingLLM](https://anythingllm.com/)
11. [Haystack](https://docs.haystack.deepset.ai/)
12. [Haystack Evaluation](https://docs.haystack.deepset.ai/docs/evaluation)
13. [LlamaIndex RAG](https://github.com/run-llama/llama_index/blob/main/docs/src/content/docs/framework/understanding/rag/index.mdx)
14. [LangChain Retrieval](https://docs.langchain.com/oss/python/langchain/retrieval)
15. [LightRAG](https://github.com/HKUDS/LightRAG)

上一篇：[RAG 框架对比与选型：RAGFlow、Mem0](./006_rag_framework_comparison.md)。
