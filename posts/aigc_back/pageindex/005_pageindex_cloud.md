---
weight: 5
title: "PageIndex Cloud：托管 OCR、树索引与推理检索的边界"
date: 2026-08-21T22:40:00+08:00
lastmod: 2026-08-21T22:40:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "从开源 SDK 可验证的 HTTP 调用链出发，说清 PageIndex Cloud 已公开的能力、未开源的服务端细节和简历处理流程。"
featuredImage:

tags: ["RAG", "PageIndex", "OCR"]
categories: ["AIGC"]

lightgallery: true
---

PageIndex Cloud 与 Local 使用同一个 `PageIndexClient`，但不是“把开源代码放到服务器跑”这么简单。README 明确说明 Cloud 使用生产 OCR、托管建树与检索管线，支持图像理解、行级引用、MCP 和 PageIndex File System。

<!-- more -->

## 1. 先说清“实现原理”的可见边界

开源仓库中 `pageindex/cloud_api.py` 是 HTTP SDK，不包含 Cloud 服务端的 OCR、版式理解、建树、图像检索或文件系统实现。

因此可以从源码确定的是：

- 客户端怎样选择 Cloud 模式。
- PDF 如何上传。
- 服务器对外暴露哪些状态和结果格式。
- OCR、tree、retrieval 和 chat 的 API 边界。
- Local 与 Cloud 的功能差异。

不能从开源代码确定的是：

- Cloud 使用哪个 OCR 模型。
- 服务端是否复用 Flash/Standard，或有第三套内部管线。
- 图像、表格、坐标框怎样与树节点对齐。
- 行级引用的具体生成算法。
- PageIndex File System 的跨文档树路由细节。

如果没有服务端代码或官方技术设计文档，不应把本地 Flash 的细节直接宣称为 Cloud 内部实现。

## 2. 怎样进入 Cloud 模式

```python
from pageindex import PageIndexClient

client = PageIndexClient(api_key="pi-...")
```

`api_key is not None` 时，Client 创建 `CloudAPI`；不传 key 则创建 `LocalAPI`。

Cloud 模式禁止传入以下本地参数：

- `index_model`
- `chat_model`
- `model`
- `summary_model`
- `retrieve_model`
- `storage_path`
- `index_backend`
- `chat_backend`

这意味着 Cloud 的索引和 Chat 模型由服务端决定，不是用户通过 Local 参数指定。

## 3. 简历上传请求

```python
result = client.submit_document(
    "job/resume-html/宋涛-AI全栈开发-简历.pdf",
    wait=True,
)
doc_id = result["doc_id"]
```

SDK 对服务器发送：

```http
POST https://api.pageindex.ai/doc/
api_key: pi-...
Content-Type: multipart/form-data

file=<PDF bytes>
if_retrieval=true
```

可选表单字段：

- `mode`：云端处理模式，语义由服务端决定。
- `beta_headers`：JSON 序列化的 beta 能力列表，例如 `block_reference`。
- `folder_id`：文档归属的文件夹/工作区。
- `metadata`：用户自定义 JSON 标签。

与 Local 同步建索引不同，Cloud 上传原本是异步处理。`wait=True` 是 Client 层轮询直到文档可用，而不是上传 HTTP 请求一直保持打开。

## 4. Cloud 处理状态

```python
meta = client.get_document(doc_id)
```

请求：

```http
GET /doc/{doc_id}/metadata/
```

对外状态包括：

- `queued`
- `processing`
- `completed`
- `failed`

元数据中还有文档名、描述、创建时间、页数和文件夹。

概念上可将服务端异步任务理解为：

```text
上传 PDF
   │
   ├── OCR / 版式处理
   ├── Tree generation
   ├── Retrieval preparation
   └── completed / failed
```

上图中的粗粒度阶段由 API 文档字段可确认，但服务端是并行还是串行、中间有哪些模型调用，开源 SDK 并未透露。

## 5. 获取 OCR 结果

```python
page_ocr = client.get_ocr(doc_id, format="page")
node_ocr = client.get_ocr(doc_id, format="node")
raw_ocr = client.get_ocr(doc_id, format="raw")
```

请求：

```http
GET /doc/{doc_id}/?type=ocr&format=page
GET /doc/{doc_id}/?type=ocr&format=node
GET /doc/{doc_id}/?type=ocr&format=raw
```

三种格式用途：

- `page`：按页组织，适合页级引用和工具读取。
- `node`：按树节点组织，适合结构化浏览。
- `raw`：拼接文本，适合导出或交给自己的下游管线。

README 指出 Cloud 使用 hosted OCR，支持图片密集和扫描文档。对本例这种已有可提取中文文本的 PDF，OCR 不是刚需；Cloud 的主要增益会是更强的版式/引用/图像管线和托管服务。

## 6. 获取树

```python
tree = client.get_tree(
    doc_id,
    node_summary=True,
    include_text=False,
)
```

请求：

```http
GET /doc/{doc_id}/?type=tree&summary=true&include_text=false
```

Cloud 与 Local 对外都提供标题、页面引用、子节点和可选摘要。README 的差异表指出：

| 能力 | Local | Cloud |
|---|---|---|
| Parsing | 可提取文本 | 托管 OCR |
| Storage | 本地 JSON | 云端 |
| Citation | 页级 | 行级 |
| 图像检索与理解 | 不支持 | 支持 |
| PageIndex File System | 不支持 | 支持 |
| MCP Server | 不支持 | 支持 |

## 7. Cloud 检索 API

旧的显式检索面：

```python
job = client.submit_query(
    doc_id,
    "候选人有哪些分布式计算与云原生经验？",
    thinking=True,
)
result = client.get_retrieval(job["retrieval_id"])
```

对应：

```http
POST /retrieval/
GET  /retrieval/{retrieval_id}/
```

`submit_query/get_retrieval` 在当前 SDK 中标记为 Cloud-only 且 deprecated。新的推荐入口是 Chat 或 MCP/Agent tools。

## 8. Cloud Chat

```python
answer = client.chat(
    "候选人有哪些分布式计算与云原生经验？",
    doc_id=doc_id,
)
```

SDK 最终调用：

```http
POST /chat/completions/
```

payload 中可包含：

- `messages`
- `doc_id` 或文档 ID 列表
- `stream`
- `temperature`
- `enable_citations`

服务端可以返回普通完整响应，或者以 SSE `data:` 事件流式返回。`stream_metadata=True` 时，SDK 保留完整 chunk，可接收引用等元数据事件。

关于“树中每一步怎样选节点”，这些发生在 Cloud 服务端，SDK 不会暴露其内部 prompt 或执行 transcript。可以确定它的产品语义是基于树的推理检索，但不能像 Local `agent_tools.py` 那样逐行还原具体 Agent 规则。

## 9. MCP 与文件级路由

Cloud MCP 对外可提供更完整的文档库工具。从本地 `agent_tools.py` 的兼容合同可看出其核心工具模式：

```text
browse_documents
get_document
get_document_structure
get_page_content
```

Cloud 还可以增加文件夹、语义文档搜索、文档图像等云端能力。

README 提到的 PageIndex File System 是文件级树：单文档内部有一棵章节树，文档库上方还有文件/文件夹层级。概念上是：

```text
文件级树：先找哪份文档
       ↓
文档章节树：再找哪一节
       ↓
页/行/图像：最后读原始证据
```

但其文件级索引如何生成、是否包含向量辅助、怎样计算路由成本，开源 SDK 没有给出答案。

## 10. 以这份简历为例的 Cloud 处理过程

从客户端视角，可以完整描述为：

1. 将 313,727 字节的 2 页 PDF 以 multipart 上传。
2. 服务器返回 `doc_id`，进入 queued/processing。
3. 托管管线产生 OCR 内容与 tree，完成后状态变为 completed。
4. 客户端可独立读 OCR、树或文档元数据。
5. Chat/MCP Agent 使用文档树和页/行内容回答，可启用引用。

这份简历的 Local Flash 初始树质量不理想，Cloud 是否能产生更好的树，需要真实 API Key 实跑后对比，不能仅根据 README 的产品描述下结论。

但由于文档只有 2 页，即使树更好，问答层也可能直接读完全文。Cloud 在此例的主要价值更像托管、引用、MCP 和统一文档库，而不是节省两页文本的上下文。

## 11. 数据、成本与可调试性的取舍

| 维度 | Local | Cloud |
|---|---|---|
| 数据边界 | PDF、树和页文本可留在本机 | PDF 上传到 PageIndex 服务 |
| 模型凭据 | 使用自己的 LLM key | 服务端统一管理 |
| 管线可见性 | Flash/Standard/存储/Agent 源码可调试 | 只能观察 API 输入输出与状态 |
| OCR/图像 | 无生产 OCR/图像理解 | 官方声明支持 |
| 引用 | 页级 | 行级，可开引用事件 |
| 运维 | 自己处理并发、存储和失败 | 托管异步任务与文档库 |

对简历、合同、医疗文档等敏感数据，上云前应根据组织的数据合规、保留策略与服务条款单独评估，不能只根据解析准确率选型。

## 12. 何时选 Cloud

适合：

- 扫描 PDF、图片密集报告、图表理解。
- 需要行级引用和图像取回。
- 需要 MCP、文件夹和跨文档文件系统。
- 不想自己维护 OCR、建树并发、任务状态和文档存储。

优先选 Local：

- 数据不能离开本地/VPC，且没有私有部署合同。
- PDF 以文本为主，Flash 已有足够好的结构。
- 需要完整调试和修改索引算法。
- 已有自己的存储、Agent 和 LLM 网关。

## 13. 源码导读

- `README.md::PageIndex Cloud`：官方公开的能力差异。
- `pageindex/client.py::__init__()`：Local/Cloud 模式选择。
- `pageindex/cloud_api.py::submit_document()`：PDF 上传。
- `get_ocr()`：OCR 三种格式。
- `get_tree()`：树结果。
- `submit_query()/get_retrieval()`：旧检索 API。
- `chat_completions()`：Cloud Chat 与 SSE 解析。
- `pageindex/agent_tools.py`：与 Cloud MCP 工具合同对齐的本地实现。

