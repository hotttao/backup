---
weight: 1
title: "PageIndex 原理：从解析、树索引到推理检索"
date: 2026-08-21T22:00:00+08:00
lastmod: 2026-08-21T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "以一份 2 页 AI 全栈开发简历为例，总览 PageIndex 的文档解析、树索引、本地存储和推理检索流程。"
featuredImage:

tags: ["RAG", "PageIndex", "Agent"]
categories: ["AIGC"]

lightgallery: true
---

PageIndex 的核心不是“不分块的向量数据库”，而是把文档建模为一棵带页码范围和摘要的树，然后让 Agent 先判断哪个分支与问题有关，再读取目标页面。

```text
PDF / Markdown
      │
      ├── 解析：恢复文本、页码、阅读顺序和标题
      │
      ├── 建树：生成 title + page range + children
      │
      ├── 优化：合并无效分支，拆分过大叶子
      │
      ├── 增强：为节点写摘要和文档描述
      │
      └── 检索：Agent 阅读树 -> 选页 -> 读原文 -> 回答
```

<!-- more -->

## 1. 本文对应的代码版本

分析基于本地 `tmp/PageIndex`：

- PageIndex 0.2.10。
- commit `8289729affde3b1310deeb88d0abb178e3363afa`。
- 被解析文档：`job/resume-html/宋涛-AI全栈开发-简历.pdf`。
- PDF 共 2 页，由 Headless Chrome/Skia 生成，包含可提取文本，不是扫描件。
- 实验时没有 LLM API Key，因此真实运行了 Flash raw、Flash merge 和 Markdown 方式；Flash full、Standard 与 Cloud 根据入口函数和完整调用链分析。

这一限制很重要：文章中会明确区分“已实跑的结果”和“从源码可确定的流程”，不会伪造 Standard 或 Cloud 的返回值。

## 2. README 里的“多种实现”到底指什么

当前代码实际上有两个维度。

### 2.1 索引在哪里建

| 运行方式 | 解析与存储 | 可见性 |
|---|---|---|
| Local | 本地运行，默认写入 `.pageindex` | 开源实现可完整阅读 |
| Cloud | PageIndex 服务器运行，文档上传到云端 | SDK 中只有 HTTP 客户端，服务端 OCR/建树管线未开源 |

### 2.2 Local 怎样建树

| 方式 | 输入 | 结构从哪里来 | 默认是否用 LLM |
|---|---|---|---|
| Flash | PDF | PDFium 字符坐标、字体、版式统计和书签 | 解析不用；full optimize、摘要和描述会用 |
| Standard / Classic | PDF | LLM 从目录或全文推断层级与起始页 | 会，而且调用次数较多 |
| Markdown | Markdown | `#` ~ `######` 和独立粗体标题 | 建树不用；可选摘要和文档描述会用 |

Flash 又有三档：

1. `summary=False, optimize=False`：纯启发式建树，完全不用 LLM。
2. `summary=False, optimize="merge"`：再加一次确定性成本优化，仍不用 LLM。
3. 默认 `optimize="full"` 且 `summary=True`：merge + LLM expand + 自底向上摘要。

后续每种方式各用一篇文章讲解。

## 3. 索引数据结构

PageIndex 的“索引”本质是可序列化的目录树，不是倒排表或向量集合。

```json
{
  "title": "工作经验",
  "node_id": "0008",
  "start_index": 1,
  "end_index": 2,
  "summary": "候选人的工作经历与主要职责。",
  "nodes": [
    {
      "title": "Media Agent 自媒体运营智能体",
      "node_id": "0009",
      "start_index": 1,
      "end_index": 1,
      "summary": "..."
    }
  ]
}
```

字段语义：

- `title`：路由标签，是 Agent 判断相关性的第一信号。
- `node_id`：深度优先的四位编号，用于定位，不承载语义。
- `start_index` / `end_index`：1-based、包含端点的物理 PDF 页码范围。
- `summary`：节点整个子树覆盖内容的摘要。
- `key_items`：优化时被合并掉的标题。节点少了，但路由信息尽量保留。
- `nodes`：子节点。

`end_index` 是“子树并集”语义：父节点的摘要要描述整个子树，而不只是父标题与第一个子标题之间的引言。

## 4. 以简历为例：解析前能看到什么

这份简历是两页排版复杂、文本量中等的设计版 PDF。

- 第 1 页：个人信息、教育背景、专业技能、工作经验的主要部分。
- 第 2 页：早期工作经验和代表性项目。
- 视觉上，`01/02/03/04` 和绿色小标题是一级章节。
- 项目、公司与时间是二级标题。
- “技术栈/项目描述/个人职责”是三级或段落标签。

但 PDF 没有 HTML 的 `<h1>` 语义。它只保留字符、字体、坐标、绘图和页面。PageIndex 必须重新推断“这是标题”，这也是各种方式的主要差别。

## 5. Local SDK 的完整索引流程

README 的一行代码：

```python
doc_id = client.submit_document("report.pdf")["doc_id"]
```

在本地模式下实际会执行：

1. 把路径解析为绝对路径，检查只接受 PDF。
2. 先用 PyPDF2 提取每页文本；全部为空则本地模式直接失败，它没有 OCR 兜底。
3. 根据 `mode` 调用 Flash 或 Standard。未传 `mode` 时默认 Flash。
4. 检查树中的页码没有超出 PyPDF2 读到的页数。这一步非常必要，因为 Flash 用 PDFium、存储页面用 PyPDF2，是两套解析器。
5. 生成 `pi-<uuid>` 文档 ID。
6. 把树中的临时 `text` 字段移除，分别保存树、页文本和元数据。

默认 `.pageindex` 目录的逻辑布局是：

```text
.pageindex/
├── manifest.json
└── docs/
    └── pi-<uuid>/
        ├── doc.json     # 名称、描述、状态、页数、mode
        ├── tree.json    # 去掉原文后的树索引
        └── pages.json   # [{page_index, markdown}, ...]
```

写入 JSON 时先写随机临时文件、`flush` + `fsync`，最后 `os.replace`，避免进程中途失败留下半个 JSON。

## 6. “无向量检索”实际怎么发生

本地 Chat 层不是调用一个“树搜索函数”，而是给通用 LLM Agent 一组文档工具：

- `browse_documents()`：找文档。
- `get_document()`：查状态和元数据。
- `get_document_structure()`：读不带原文的树。
- `get_page_content()`：按页码精确读原文。

Agent 提示词里明确规定：

- 超过 20 页的文档：必须先读结构，再读目标页。
- 20 页及以下的文档：直接读页面。

因此，对这份 2 页简历提问：

> 候选人有哪些证据能证明他有分布式系统开发能力？

默认 Agent 不会先遍历树，而会直接调用：

```text
get_page_content(
  doc_name="宋涛-AI全栈开发-简历.pdf",
  pages="1-2"
)
```

这暴露了一个容易被忽略的事实：对小文档，PageIndex 仍会建树和存树，但默认问答 Agent 为了减少路由开销，可能完全不用这棵树。简历示例主要用于观察“解析和建树”，不是展示长文档树搜索的最佳样本。

## 7. PageIndex 与传统向量 RAG 的真正差别

| 环节 | 向量 RAG | PageIndex |
|---|---|---|
| 建索引 | 切 chunk，计算 embedding | 恢复自然章节，建页码树 |
| 候选生成 | 近似最近邻 | LLM 阅读标题、摘要和对话上下文 |
| 粒度 | 固定 token 窗口或语义 chunk | 章、节、页 |
| 可解释性 | 相似度分数 | 明确的章节路径和页码 |
| 故障类型 | 相似但不相关，或相关但不相似 | 标题识别错、树层级错、Agent 路由错 |

PageIndex 没有消灭检索错误，它只是把主要错误从“向量相似度”转移成了“文档结构恢复 + LLM 路由”。对财报、法律文书、教科书等标题稳定的长文档，这种转移往往有利；对只有 2 页、依赖视觉设计的简历，收益就不一定大。

## 8. 选型结论

1. 文本型、结构规整的长 PDF：先用 Flash full。
2. Flash 结构为空或显著错误：切到 Standard。
3. 已有高质量 Markdown：直接用 Markdown 树，它的层级是最可控的。
4. 扫描件、图片密集 PDF、需要行级引用或图像理解：用 Cloud。
5. 像本例这样的短文档：先问“是否真的需要树索引”，直接把全文交给模型可能更简单。

## 9. 源码导读

- `README.md`：对外概念、Local/Cloud 差异和 SDK 入口。
- `pageindex/client.py`：Local/Cloud 路由和对外 API。
- `pageindex/local_api.py`：本地索引管线。
- `pageindex/local_store.py`：本地 JSON 存储。
- `pageindex/agent_tools.py`：检索工具、20 页阈值和 Agent 阅读策略。

