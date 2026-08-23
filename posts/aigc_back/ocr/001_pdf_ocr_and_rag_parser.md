---
weight: 1
title: "开源 PDF OCR 与 RAG 文档解析工具选型"
date: 2026-08-21T22:00:00+08:00
lastmod: 2026-08-22T00:10:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "区分 OCR 引擎、PDF 文档解析器和 RAG 摄取框架，对比本地开源方案，并给出 OCR、文档结构、Chunk 与检索质量的系统评估方法。"
featuredImage:

tags: ["OCR", "PDF", "RAG", "文档解析"]
categories: ["RAG"]

lightgallery: true
---

构建 PDF 知识库时，经常会把 OCR、PDF 解析和 RAG 摄取混为一谈。实际上，它们解决的是三个不同层次的问题：OCR 只负责从像素中识别文字；PDF 解析器还需要恢复标题、段落、表格和阅读顺序；RAG 摄取框架则继续负责分块、元数据、Embedding 和向量库写入。

如果只比较 OCR 字符准确率，很可能选出一个不适合 RAG 的工具。一个工具即使能正确识别每个字，也可能把双栏页面交叉拼接、把表格压平成乱码，最终导致检索召回和引用定位失败。

<!-- more -->

## 1. 先区分三类工具

### 1.1 纯 OCR 引擎

纯 OCR 引擎输入图片，输出文字、检测框和置信度。它们通常不负责：

- PDF 页面渲染；
- 标题和段落结构；
- 多栏阅读顺序；
- 表格结构恢复；
- Markdown 输出；
- RAG 分块、Embedding 和向量索引。

典型项目包括：

| 工具 | 主要特点 | 适合场景 |
| --- | --- | --- |
| PaddleOCR | 中文识别能力强，模型和部署方案丰富 | 中文图片、票据、扫描页 OCR |
| Tesseract | 老牌、CPU 友好、完全离线、语言包丰富 | 简单扫描件、生成可搜索 PDF |
| EasyOCR | PyTorch 实现，支持 80 多种语言，上手简单 | 多语言原型和通用图片 OCR |
| RapidOCR | 使用 ONNX Runtime 等推理后端部署 Paddle 系模型 | CPU 服务、跨平台轻量部署 |
| Surya | 现代文档 OCR，兼顾检测、阅读顺序和版面能力 | 多语言复杂文档、现代模型对照 |

PaddleOCR、EasyOCR、RapidOCR 和 Tesseract 的原始输出仍需要上层程序重建文档结构。对于 RAG 来说，它们是基础能力，不是完整解决方案。

### 1.2 PDF OCR 工作流

[OCRmyPDF](https://github.com/ocrmypdf/OCRmyPDF) 是这一层最典型的项目。它使用 Tesseract 作为识别内核，在扫描 PDF 上添加隐藏文本层，并尽量保留原始图片和页面结构。

它的核心产物是“可搜索 PDF”，而不是面向 LLM 的 Markdown：

```text
扫描 PDF
  → 页面渲染与图像预处理
  → Tesseract OCR
  → 写入隐藏文本层
  → 可搜索 PDF
```

OCRmyPDF 特别适合给只接受 PDF、并依赖 PDF 文本层的系统做前处理，但它不会解决复杂表格恢复或面向 RAG 的语义分块。

### 1.3 端到端 PDF 文档解析器

端到端解析器不仅识别文字，还会恢复文档结构：

- 标题层级；
- 段落、列表和脚注；
- 多栏阅读顺序；
- 表格行列关系；
- 公式和图片；
- 页码、bbox 和元素类型；
- Markdown、HTML 或结构化 JSON。

典型项目包括 MinerU、Docling、Marker、LiteParse、OpenDataLoader PDF 和 Unstructured。它们的输出更适合继续进入 RAG 流水线。

## 2. 本地开源 PDF 解析器对比

### 2.1 MinerU：中文复杂文档解析

[MinerU](https://github.com/opendatalab/MinerU) 面向 PDF、图片和 Office 文档生成 Markdown/JSON，支持扫描件检测、OCR、多栏阅读顺序、公式转 LaTeX、表格转 HTML，以及页眉页脚过滤。

当前版本同时提供 pipeline、VLM 和 hybrid 等后端。pipeline 可以在 CPU 或 GPU 上运行；VLM/hybrid 的准确率更高，但需要更多显存和磁盘空间。MinerU 的 pipeline OCR 已升级到 PP-OCRv6。

优点：

- 中文、论文、教材和复杂版面能力强；
- 支持扫描 PDF 和图片输入；
- 公式、表格、阅读顺序处理完整；
- 可以输出 Markdown、JSON 和可视化中间结果；
- 可完全本地运行。

局限：

- 完整安装和模型体积较大；
- VLM/hybrid 后端对显存和内存有要求；
- 它首先是文档解析器，不负责向量索引和检索。

### 2.2 Docling：文档结构与原生分块

[Docling](https://github.com/docling-project/docling) 的核心是统一的 `DoclingDocument`。它把标题、段落、表格、图片、公式、页码和 bbox 保存成结构化文档，而不只是导出一段 Markdown。

Docling 支持多种 OCR 后端，包括 Tesseract、EasyOCR、RapidOCR 和 SuryaOCR；表格结构可以由 TableFormer 等模型处理。输出支持 Markdown、HTML、JSON、DocTags，以及直接面向 RAG 的 JSONL chunks。

优点：

- 文档类型和结构模型丰富；
- 多栏、表格和阅读顺序处理较强；
- 提供原生结构感知分块；
- 与 LangChain、LlamaIndex、Haystack 等框架集成深入；
- 适合做页码引用、bbox 高亮和 visual grounding。

局限：

- 完整依赖和本地模型较重；
- 选项很多，OCR、表格和 VLM 后端需要根据场景配置；
- 中文 OCR 最终效果取决于所选择的 OCR 后端。

### 2.3 Marker：高质量 Markdown 生成

[Marker](https://github.com/datalab-to/marker) 是 Datalab 的 PDF/图片转 Markdown 与 JSON 工具，当前 pipeline 围绕 Surya 模型构建，也可以接入本地 Ollama 或 OpenAI-compatible 服务做额外修正。

优点：

- 复杂排版、论文和公式输出较好；
- 直接生成适合 LLM 阅读的 Markdown；
- 可以完全使用本地模型运行。

局限：

- GPU 体验明显好于 CPU；
- 主要聚焦解析，不提供成熟的 RAG 分块和索引体系；
- 使用 LLM 修正时需要额外部署本地模型，资源占用会上升。

### 2.4 LiteParse：轻量本地解析

[LiteParse](https://github.com/run-llama/liteparse) 是 LlamaIndex 团队开源的轻量本地文档解析器。当前版本以 Rust/PDFium 为核心，内置 Tesseract OCR，也支持通过 OCR Server 接入 PaddleOCR、EasyOCR 等引擎。

它能够输出文本、Markdown 和空间 JSON，并提供文档复杂度检测，用于判断页面是否需要 OCR 或更重的解析流程。

优点：

- 启动快、CPU 友好；
- 内置 OCR，安装相对简单；
- 支持 bbox、页面截图和复杂度检测；
- 提供 Node.js、Python、REST 和 gRPC 接口。

局限：

- 复杂表格、多栏、手写和低质量扫描件不是其强项；
- 虽然来自 LlamaIndex 团队，但开源 LiteParse 本身主要仍是解析器；
- 没有 Docling 那样完整的结构感知分块体系。

### 2.5 OpenDataLoader PDF：阅读顺序与引用定位

[OpenDataLoader PDF](https://github.com/opendataloader-project/opendataloader-pdf) 同时提供确定性 Java 解析和本地 hybrid 模式。普通电子 PDF 可以使用快速路径；扫描件、复杂表格和公式可以转交本地 hybrid 后端处理。

它的 JSON 会为元素保留类型、标题级别、页码和 bbox，适合实现“点击答案引用，跳回 PDF 对应区域”。项目还会过滤隐藏文字、页面外文字等可能影响 LLM 的内容。

优点：

- 多栏阅读顺序和结构化 JSON；
- 每个元素包含页码和 bbox；
- 官方提供 LangChain 和 LlamaIndex Loader；
- 支持本地 hybrid + OCR；
- 适合构建带引用高亮的 PDF RAG。

局限：

- OCR 主要存在于 hybrid 模式；
- hybrid 后端使用 Docling 路线，因此不是全新的 OCR 模型；
- 分块通常仍交给 LangChain、LlamaIndex 或业务代码。

### 2.6 Unstructured：完整的 RAG 摄取 ETL

[Unstructured](https://github.com/Unstructured-IO/unstructured) 不只是 PDF 解析器，更像面向 GenAI/RAG 的数据摄取框架。它提供数据源连接器、文档 partition、元素化输出、分块、Embedding 和向量数据库目标连接器。

优点：

- 支持 PDF、Office、HTML、邮件等大量格式；
- `basic`、`by_title` 等分块策略直接面向 RAG；
- 可以保留原始元素、页码和坐标；
- 可写入 Milvus、Qdrant、Pinecone、Weaviate 等系统；
- 适合持续同步和批量知识库建设。

局限：

- 依赖链复杂；
- PDF 中文 OCR 和复杂版面未必优于 MinerU；
- 官方产品同时包含云服务，要求完全本地时必须明确配置本地 partition、OCR 和 Embedding。

### 2.7 PyMuPDF4LLM：电子 PDF 的快速路径

[PyMuPDF4LLM](https://pymupdf.readthedocs.io/en/latest/pymupdf4llm/) 基于 PyMuPDF，适合快速从带文本层 PDF 中提取 Markdown，并有 LangChain、LlamaIndex 读取方式。

它本身不是 OCR 引擎。扫描 PDF 仍需要 Tesseract 或 OCRmyPDF 等外部 OCR 能力；复杂版面、表格和公式也不是它的主要优势。

## 3. 什么叫“与 RAG 深度集成”

“可以输出 Markdown”只能说明工具容易被 RAG 使用，不等于深度集成。可以从以下几个维度判断：

1. **标准对象适配**：是否直接输出 LangChain `Document` 或 LlamaIndex `Document/Node`；
2. **结构感知分块**：是否依据标题、段落、列表、表格分块，而不是只按字符数切分；
3. **Embedding 对齐**：是否能按照 Embedding 模型 tokenizer 控制 chunk 大小；
4. **Provenance**：chunk 是否保留源文件、页码、bbox、元素 ID；
5. **引用定位**：检索结果能否映射回 PDF 页面或具体区域；
6. **数据连接器**：是否能从对象存储、网盘、数据库等持续摄取；
7. **向量库连接器**：是否能直接写入 Milvus、Qdrant、Weaviate 等；
8. **增量和生产化**：是否支持批处理、失败恢复、服务化和增量更新。

按照这些标准，本地开源项目可以大致分为：

| 等级 | 项目 | RAG 集成深度 | 说明 |
| --- | --- | --- | --- |
| S | Docling | 很深 | 文档结构、原生分块、框架适配、向量库示例和引用定位都较完整 |
| S | Unstructured | 很深 | 数据源到解析、分块、Embedding、向量库的完整摄取流水线 |
| A | OpenDataLoader PDF | 较深 | 官方 LangChain/LlamaIndex Loader，页码和 bbox 适合可追溯 RAG |
| A- | MinerU | 中等偏深 | RAG 产品生态广、解析强，但本地核心与 RAG SDK 之间仍需衔接 |
| B | LiteParse | 中等偏浅 | 输出面向 LLM/RAG，但没有完整的分块、Embedding 和索引层 |
| B | PyMuPDF4LLM | 中等偏浅 | 框架读取方便，主要适合带文本层 PDF |
| C | Marker | 浅 | 高质量 Markdown 解析器，RAG 后续流程需要自行实现 |
| C | OCRmyPDF | 很浅 | 只负责生成可搜索 PDF |
| C | PaddleOCR 等 | 无直接集成 | 只负责从图片识别文字 |

## 4. 深度集成项目分析

### 4.1 Docling：文档结构型 RAG

Docling 的原生 chunker 直接运行在 `DoclingDocument` 上，而不是先把文档压扁成 Markdown：

- `HierarchicalChunker` 根据文档层级生成 chunk；
- `HybridChunker` 在层级分块基础上按照 tokenizer 拆分或合并；
- 表格跨 chunk 时可以重复表头；
- chunk 可以携带标题、caption 和来源元数据；
- `DoclingReader`、`DoclingNodeParser` 可以直接接入 LlamaIndex。

官方示例覆盖 LangChain、LlamaIndex、Haystack，以及 Milvus、Qdrant、Weaviate、OpenSearch 和 MongoDB 等后端。

因此，Docling 不只是“把 PDF 变成文本”，而是在解析结果和检索单元之间建立了结构化桥梁。

### 4.2 Unstructured：数据摄取型 RAG

Unstructured 的重心是完整摄取流水线：

```text
数据源连接器
  → 文档解析与元素分类
  → 清洗和 enrich
  → basic / by_title 分块
  → Embedding
  → 向量库目标连接器
```

它更适合企业中“很多数据源持续进入知识库”的问题，而不是只追求某一份中文 PDF 的最佳解析效果。

### 4.3 OpenDataLoader PDF：可追溯 PDF RAG

OpenDataLoader PDF 官方提供：

- `langchain-opendataloader-pdf`；
- `opendataloader-pdf-llamaindex`；
- 按页拆分为标准 `Document`；
- 页码、元素类型、标题层级和 bbox；
- prompt injection 风险内容过滤。

它的优势在于 PDF 来源追踪，而不是内置完整的检索系统。实际项目中通常继续使用 LangChain splitter 或 LlamaIndex NodeParser。

### 4.4 MinerU：解析生态强，本地 RAG 仍需胶水层

MinerU Ecosystem 列出了 LangChain、LlamaIndex、RAGFlow、RAG-Anything、Dify、FastGPT 和 Flowise 等集成。

但需要注意：官方 `langchain-mineru` 当前的 `flash` 和 `precision` 模式主要调用 MinerU 服务接口，`precision` 还需要 token。它不能直接等同于“本地 MinerU 进程与 LangChain 一体化”。

完全本地时，更常见的路径是：

```text
本地 MinerU
  → Markdown / JSON
  → 转换成 LangChain Document 或 LlamaIndex Node
  → 结构化分块
  → Embedding
  → 向量库
```

所以 MinerU 的文档解析能力很强，但在纯本地 RAG SDK 层仍需要少量业务适配。

## 5. 本地开源测试方案

为了同时衡量 OCR 字符准确率和 RAG 可用性，测试应该拆成两条赛道。

### 5.1 OCR 引擎组

建议测试：

1. PaddleOCR PP-OCRv6：中文准确率基准；
2. Tesseract 5 + `tessdata_best`：CPU 和传统 OCR 基准；
3. EasyOCR：PyTorch 多语言基准；
4. RapidOCR：ONNX CPU 部署基准。

它们直接输入同一张 PNG，记录：

- 原始识别结果；
- bbox 和置信度；
- 字符错误率 CER；
- 内容覆盖率；
- 冷启动和热运行时间；
- CPU/GPU、显存、内存和磁盘占用。

### 5.2 PDF/RAG 解析组

建议重点测试：

1. MinerU：中文 OCR 和复杂版面基准；
2. Docling：结构化分块和 RAG 框架集成基准；
3. OpenDataLoader PDF：bbox、引用定位和安全性基准；
4. Unstructured：完整知识库摄取流水线基准；
5. LiteParse：轻量 CPU 基准；
6. Marker：现代模型 Markdown 质量基准；
7. OCRmyPDF：可搜索 PDF 基准。

为了确保解析器真的使用 OCR，不能直接输入原本带文本层的 PDF。应该把测试 PNG 无损封装成单页、纯图片 PDF，然后交给所有 PDF 解析器。

除了 CER，还需要评价：

- 双栏阅读顺序是否正确；
- 标题、列表和段落是否恢复；
- 表格结构是否保留；
- Markdown 是否适合直接分块；
- chunk 是否保留页码和 bbox；
- 能否映射回原 PDF 进行引用高亮；
- 安装和完全离线运行是否可靠。

## 6. 场景选型

| 场景 | 推荐工具 | 原因 |
| --- | --- | --- |
| 中文扫描教材、论文、本地解析 | MinerU | 中文 OCR、公式、多栏和结构恢复较完整 |
| 表格、合同、企业文档 RAG | Docling | 文档结构、表格和原生分块能力强 |
| 多来源持续同步到向量库 | Unstructured | 数据源、分块、Embedding 和目标连接器完整 |
| PDF 答案需要页码和区域高亮 | OpenDataLoader PDF / Docling | 保留页码、bbox 和结构化元素 |
| 轻量 CPU、本地快速解析 | LiteParse | Rust/PDFium、内置 Tesseract、部署简单 |
| 论文和公式转 Markdown | Marker | 现代模型驱动的 Markdown 输出 |
| 纯文本 PDF 快速读取 | PyMuPDF4LLM | C 底层，速度快 |
| 扫描 PDF 转可搜索 PDF | OCRmyPDF | 成熟的 Tesseract PDF 工作流 |
| 只需要识别中文图片文字 | PaddleOCR | 不需要承担完整 PDF 解析成本 |

## 7. 与 PageIndex 配合

PageIndex 属于 OCR/解析结果的下游消费者，不应该被当作 OCR 工具。

如果 PageIndex 版本只读取 PDF 文本层，可以采用：

```text
扫描 PDF
  → OCRmyPDF
  → 带文本层 PDF
  → PageIndex
```

这条路线改造成本最低，但文档结构质量主要受 Tesseract 文本层和 PageIndex 自身解析能力限制。

如果允许改造 PageIndex，使它接受 Markdown 或结构化 JSON，可以采用：

```text
扫描 PDF
  → MinerU / Docling / OpenDataLoader PDF
  → Markdown / JSON + page + bbox
  → PageIndex 树索引
```

第二条路线更适合复杂文档，也更容易保留标题层级、表格、页码和来源坐标。

## 8. 常见坑点

1. **不要把 OCR 准确率等同于 RAG 质量**：阅读顺序和结构错误可能比少量错字更严重。
2. **不要直接用带文本层 PDF 测 OCR**：解析器可能跳过 OCR，导致测试结论失真。
3. **不要只看 Markdown 外观**：需要检查 chunk 是否保留页码、bbox 和元素关系。
4. **表格不是普通 OCR 问题**：识别文字与恢复表格行列结构是两套能力。
5. **注意本地与云端边界**：部分“官方集成”实际调用云 API，测试时要监控网络请求。
6. **首轮和热运行要分开计时**：模型下载、加载和实际推理时间不能混在一起。
7. **中文简历、财报和论文不能共用一个结论**：应该使用真实业务样本分别评测。

## 9. 四个可运行 Demo 与统一输出

本轮只实现和 RAG 关系最紧密的四个组件：MinerU、Docling、OpenDataLoader PDF 和 Unstructured。完整代码位于 `ocr-benchmark/rag-parsers`，四个 demo 都接受 PDF 或图片，并统一输出：

| 文件 | 用途 |
| --- | --- |
| `document.md` | 人工检查文字、标题、表格和阅读顺序 |
| `document.json` | 保存解析器原生元素、页码、bbox 等结构 |
| `chunks.jsonl` | 统一 RAG 输入，每行包含 `id`、`text` 和 `metadata` |

安装统一使用仓库根目录的 `.venv`：

```powershell
uv pip install --python .venv\Scripts\python.exe -r ocr-benchmark\rag-parsers\requirements.txt
```

四个入口分别是：

```powershell
.venv\Scripts\python.exe ocr-benchmark\rag-parsers\mineru\demo.py <PDF或图片>
.venv\Scripts\python.exe ocr-benchmark\rag-parsers\docling\demo.py <PDF或图片>
.venv\Scripts\python.exe ocr-benchmark\rag-parsers\opendataloader_pdf\demo.py <PDF或图片>
.venv\Scripts\python.exe ocr-benchmark\rag-parsers\unstructured\demo.py <PDF或图片>
```

### 9.1 各组件如何分块

**Docling** 使用原生 `HybridChunker`。它先按 `DoclingDocument` 的标题、列表和表格层级分块，再按照目标 Embedding 模型 tokenizer 的 token 上限拆分或合并。送去 Embedding 的文本使用 `contextualize()` 补入标题路径，这比事后对 Markdown 固定字符切分更可靠。

**Unstructured** 在 partition 阶段启用 `chunking_strategy="by_title"`。输出的 `CompositeElement` 就是检索单元，原始元素、页码和坐标仍保存在 metadata 中。它适合正文、列表和标题较多的业务文档；表格、图片应保持为独立元素。

**OpenDataLoader PDF** 的核心优势是元素级 JSON 和来源定位，而不是原生 chunker。demo 先保留原始 JSON，再用标题感知适配层生成 chunk。生产项目应优先读取 JSON 的标题级别、页码和 bbox，不要先把文档压平成纯文本。

**MinerU** 的本地 `content_list.json` 包含 `text_level`、元素类型、页码和 bbox。demo 按标题聚合连续元素，表格 HTML 保持完整，超过字符上限才二次拆分。这样可以避免“一元素一块”产生大量过碎 chunk；本次三页简历聚合后得到 18 个 chunk。

### 9.2 为什么统一用 LangChain + FAISS

四个解析器都有自己的数据结构，但都可以稳定转换成 LangChain `Document(page_content, metadata)`。因此没有必要为四个工具维护四套检索代码：

```text
四种解析器
  → chunks.jsonl
  → LangChain Document
  → 本地 BGE Embedding
  → FAISS
  → Top-K 或 MMR
  → 将命中的文本、页码、bbox 交给 LLM
```

本地检索命令：

```powershell
.venv\Scripts\python.exe ocr-benchmark\rag-parsers\common\rag_demo.py ocr-benchmark\rag-parsers\mineru\output\chunks.jsonl --query "候选人有哪些 RAG 和 Agent 项目经验？" --top-k 4 --index-dir ocr-benchmark\rag-parsers\mineru\output\faiss --output ocr-benchmark\rag-parsers\mineru\output\retrieval.json
```

默认模型为 `BAAI/bge-small-zh-v1.5`，向量归一化后写入 FAISS。`similarity` 返回距离最小的 Top-K；内容重复较多时使用 `--mode mmr`，先扩大候选集，再平衡相关性和结果多样性。

需要特别区分：检索不是生成。`rag_demo.py` 到选出上下文为止，不调用云端 LLM。真实问答系统还需要把用户问题、命中 chunk 和来源 metadata 组织成 prompt；回答中的引用应来自 metadata，而不是让模型猜页码。

### 9.3 三页简历 PDF 实测：四个解析器

最终测试输入改为 `job/resume-html/宋涛-AI全栈开发-简历-Markdown版.pdf`。它有 3 页、317 KB，并自带 3228 个可提取字符的可靠文本层。因此这组结果衡量的是 PDF 结构解析、阅读顺序和 RAG 分块，而不是扫描图片 OCR；如果强制 OCR，反而会引入不必要的错字。

四个组件均输出 `document.md`、`document.json` 和 `chunks.jsonl`：

| 组件 | Markdown 字符数 | JSON 大小 | chunk 数 | 与 PDF 文本层的归一化编辑距离 |
| --- | ---: | ---: | ---: | ---: |
| OpenDataLoader PDF | 3399 | 42.9 KB | 10 | 0 / 2634（0%） |
| MinerU | 3984 | 21.3 KB | 18 | 1 / 2634（0.04%） |
| Docling | 3682 | 100.1 KB | 22 | 2 / 2634（0.08%） |
| Unstructured | 3341 | 28.5 KB | 10 | 7 / 2634（0.27%） |

这里的比较方法是：以 `pypdf` 提取的原生文本层为参考，将 Markdown/HTML 标签、空白、标点和大小写归一化，再计算 Levenshtein 编辑距离。它适合观察内容丢失和阅读顺序变化，但不能当成 OCR CER，也不能单独代表 chunk 质量。

**OpenDataLoader PDF** 在这个电子 PDF 上表现最稳：Java 快速路径没有字符差异，首页表格恢复为 Markdown 表格，标题层级也最接近原文。10 个 chunk 较粗，适合简历这种短文档，但生产环境应检查单个项目经历是否需要再按职责拆分。

**MinerU** 只出现一处字符差异：博客地址 `hotttao.github.io` 少了一个 `t`。它把首页表格输出为 HTML，并生成 18 个按 `text_level` 聚合的 chunk，页码和 bbox 适合引用定位。对于已有文本层的简单 PDF，pipeline 的模型初始化和版面推理成本明显高于 Java 快速解析。

**Docling** 的正文和表格结构很好，`HybridChunker` 生成 22 个最细致的结构感知 chunk。两字符差异来自姓名“宋涛”没有进入 Markdown，而被输出成 `<!-- image -->` 占位；这也说明只检查正文相似度还不够，必须核对标题和关键实体。Windows 下中文 PDF 文件名会触发 `docling-parse` 加载失败，demo 已通过 ASCII 临时副本兼容，metadata 仍保留原始路径。

**Unstructured** 的 `by_title` 最终生成 10 个 chunk，整体文字完整，但 Markdown 中多出 `©`、`¢`、`e` 等项目符号噪声，首页表格被压平成普通文本。它的优势仍然是多格式摄取和 ETL 生态，而不是这份 PDF 的 Markdown 质量。

这份样本的推荐顺序是：追求电子 PDF 的速度和忠实度优先 OpenDataLoader；追求细粒度原生分块优先 Docling；还要处理扫描件、公式和中文复杂版面时使用 MinerU；需要持续摄取多种数据源时选择 Unstructured。

随后用同一个本地 `bge-small-zh-v1.5` 和 FAISS，以“候选人有哪些 RAG 和 Agent 项目经验？”执行 Top-4 相似度检索：

| 组件 | Top-1 命中 | 项目内容首次出现 | 观察 |
| --- | --- | ---: | --- |
| MinerU | `开发内容` | 第 1 条 | 直接召回 Agent 架构、MCP、Multi-Agent 等开发内容 |
| Unstructured | `工作经验 / Media Agent` | 第 1 条 | 首条包含项目介绍，第三条继续召回详细开发内容 |
| Docling | `求职意向 / 基本信息表` | 第 2 条 | 首条被“AI Agent”求职意向吸引，第二条才是项目开发内容 |
| OpenDataLoader PDF | `姓名 / 基本信息表` | 第 2 条 | 首条被标题和求职意向吸引，第二、四条覆盖项目介绍与开发内容 |

四套结果都能在 Top-4 内覆盖目标项目，但这个测试暴露了短查询下的标题偏置：标题路径有助于上下文，却也可能让包含查询关键词的简历头部排在真正答案之前。生产 RAG 可采用 MMR、metadata 过滤或 reranker；也可以把“求职意向/基本信息”这类低信息块降权。各组件的完整命中内容保存在自身 `output/retrieval.json`，其中包含距离、chunk 文本和来源 metadata。

### 9.4 本地部署中遇到的真实依赖问题

- MinerU 在国内网络应设置 `MINERU_MODEL_SOURCE=modelscope`；pipeline 还缺少一个未正确声明的 `albumentations` 运行依赖。
- MinerU 的底层 `do_parse()` 需要先通过官方 `read_fn()` 把图片转换成单页 PDF 字节，直接传 PNG 字节会被 PDFium 拒绝。
- Docling 和 OpenDataLoader 的 hybrid 服务共享 `docling-layout-heron`，所以二者也共享同一个模型下载故障点。
- OpenDataLoader 的 Java 端要求 Java 11+。demo 使用安装在 `.venv` 中的 `jdk4py`，无需替换系统 Java 8。
- Unstructured 的 `hi_res` 需要显式安装 `unstructured-inference`；Windows 还需要 `python-magic-bin` 和本地 Tesseract/Paddle OCR agent。

这些安装问题也是选型的一部分。解析精度接近时，模型镜像、离线缓存、运行时依赖和升级稳定性会直接决定方案能否进入生产。

## 10. 从“看起来不错”到可量化：OCR 与 Chunk 评估方法论

看到四个解析器不同的 Markdown 和 chunk 后，最容易陷入的问题是：OpenDataLoader 看起来更整洁，MinerU 的 chunk 更多，Docling 的结构更丰富，到底哪一个才算更好？如果不知道目标，确实无法判断。

RAG 的目标不是生成最漂亮的 Markdown，也不是让 chunk 越多或越细，而是：**用户提出问题后，系统能够稳定召回一小组完整、正确、低噪声、可定位的证据，并让 LLM 只根据这些证据回答。** 因此评估必须遵循两条原则：

1. **端到端指标决定方案优劣**：最终看问题能否召回正确证据、回答是否正确；
2. **阶段指标用于定位原因**：OCR、版面解析、chunk、Embedding、排序和生成分别测量，才能知道失败发生在哪里。

整体目标链路是：

```text
原始 PDF
  → 正确恢复文字、结构和阅读顺序
  → 组织成语义完整的证据块
  → 正确证据进入 Top-K
  → LLM 基于证据回答
  → 回答可回跳到原始页码和区域
```

### 10.1 先定义“最小充分证据单元”

在选择解析器和 chunk 大小之前，先回答五个问题：用户会问什么、答案通常出现在哪里、错误代价多大、引用需要精确到哪一级、一个答案是否需要组合多个位置。

理想 chunk 是“最小但充分的证据单元”：单独取出时能理解它在讲什么，完整包含一类问题所需的证据，不混入大量无关主题，并能定位回原文。这个单元取决于业务，而不是固定的 500 字或 512 token。

| 场景 | 典型问题 | 理想证据单元 | 特别要求 |
| --- | --- | --- | --- |
| 简历 | 是否做过 Multi-Agent？ | 一个项目概述或一组项目职责 | 项目名、时间和标题路径不能丢 |
| 合同 | 违约责任是什么？ | 一条完整条款及其条件、例外 | 条款号和引用位置必须准确 |
| 产品手册 | 设备无法启动怎么办？ | 故障、原因、步骤和警告 | 不能把安全警告与步骤切开 |
| 技术文档 | 如何配置鉴权？ | 一个标题下的说明和代码块 | 代码与解释保持在一起 |
| 论文 | 使用了什么数据集？ | 实验段落、表格或图注 | 公式、图表和引用关系要保留 |
| 财报 | 2025 年营收是多少？ | 表名、指标、年份、数值和单位 | 表头必须传播到数值 |
| FAQ | 如何重置密码？ | 一组问题和答案 | 通常一问一答就是一个 chunk |
| 发票/表单 | 税号和金额是多少？ | 字段和值 | 更适合字段化存储，不宜普通分段 |

以当前简历为例，基本信息可以形成一个 chunk；专业技能可以按 Agent、后端、基础架构等类别拆分；每个项目至少分为“项目概述”和“开发内容”；工作经历和教育背景按单位切分。项目地址可以留在项目概述中，不应单独成为缺少上下文的小块。

### 10.2 先统一解析器输出，再比较 Chunker

不同组件输出风格不同，不能直接拿 Markdown 的美观程度做结论。应先映射成统一文档元素：

```json
{
  "element_id": "page-1-element-15",
  "type": "title|paragraph|list|table|image|formula",
  "text": "基于 MCP 集成内容采集工具",
  "heading_path": ["工作经验", "Media Agent", "开发内容"],
  "page": 1,
  "bbox": [39, 83, 544, 185],
  "source": "resume.pdf"
}
```

系统由此拆成两个可独立替换的部分：

```text
解析器 → 统一文档元素 → 业务 Chunker → Embedding → 检索与重排
```

比较解析器时固定同一个 Chunker、Embedding、Top-K 和问题集；比较 Chunker 时固定同一个解析器。否则一次同时改变解析和切分，无法知道提升来自哪里。

### 10.3 建立两套人工标准数据

第一套是 OCR/解析 Ground Truth。对抽样页面人工校正文字、元素类型、标题层级、阅读顺序、表格结构、页码和 bbox。电子 PDF 的文本层可以作为初稿，但不能直接当绝对真值，因为隐藏文本本身也可能乱序或缺字。

第二套是 RAG Ground Truth。每个问题不仅要有标准答案，还要标注证据位置和必须覆盖的事实：

```json
{
  "question": "候选人是否有 Multi-Agent 开发经验？",
  "expected_answer": "支持 Sub-Agent、Teamwork 和 Multi-Agent 任务编排。",
  "required_facts": ["Sub-Agent", "Teamwork", "Multi-Agent 任务编排"],
  "evidence": [{
    "document": "resume.pdf",
    "page": 1,
    "section": "Media Agent > 开发内容",
    "element_ids": ["p1-e21", "p1-e22"]
  }],
  "answerable": true
}
```

问题集要覆盖直接事实、实体、条件、列表、表格、跨段综合和“文档中没有答案”几种类型。最后一种用于测试系统能否拒答，而不是利用模型常识编造。

评测文档也要按真实数据分层：原生文本、扫描、图片和混合 PDF；单栏、多栏、表格、跨页、公式和图文混排；高清、模糊、倾斜和低分辨率。初步选型可以使用 20～30 份文档，正式选型应扩展到 100 份以上，并让各类型占比接近生产语料。

### 10.4 OCR 和文档解析指标

OCR 不能只看一个字符准确率。至少需要下面五组指标。

**文字指标**：

```text
CER =（替换字符数 + 删除字符数 + 插入字符数）/ 标准字符数
```

同时输出严格 CER 和归一化 CER。严格模式保留标点和空白，衡量版面还原；归一化模式忽略非语义格式差异，衡量内容完整性。中文通常重点看 CER，英文还可以补充 WER。

**关键实体指标**：姓名、日期、金额、百分比、电话、URL、合同号和产品型号要单独计算完全匹配率。普通文本只错一个字符影响可能很小，但 URL `hotttao.github.io` 少一个 `t` 应整体判错；合同中的 `10%` 变成 `1%` 更不能被整体 99% 的字符准确率掩盖。

**内容指标**：

```text
内容覆盖率 = 正确恢复的标准元素数 / 标准元素数
幻觉率     = 无法映射到原文的输出元素数 / 输出元素数
```

Unstructured 结果里的 `©`、`¢`、`e` 就应记为噪声或幻觉元素。

**结构和顺序指标**：标题、列表、表格、图片分别计算 Precision、Recall 和 F1；标题还要评估层级和父子关系。阅读顺序可以用元素对顺序正确率或 Kendall Tau，重点抽查双栏串行、跨页段落和页眉页脚污染。阅读顺序错误通常比少量错字更伤害 RAG。

**表格和定位指标**：表格评估行列、合并单元格、单元格文本、表头关联和关键数值，可使用单元格准确率或 TEDS。引用能力评估页码准确率、bbox 覆盖率、bbox IoU 和回跳成功率；metadata 存在不代表它指向正确位置。

### 10.5 Chunk 的静态质量指标

Chunk 首先需要在不运行检索的情况下做结构检查：

| 指标 | 定义 | 典型问题 |
| --- | --- | --- |
| 大小分布 | token 的 P50、P90、最大值、过小和超限比例 | 只有标题的小块、整章大块 |
| 边界完整率 | 没有切断段落、条款、列表、表格的 chunk 比例 | 一句话被机械切成两半 |
| 答案包含率 | 至少一个 chunk 完整包含标准证据的问题比例 | 文字存在但没有完整证据块 |
| 证据分裂率 | 原本连续证据被切到多个块的问题比例 | 条件和结论被分开 |
| 独立可理解性 | 单看 chunk 能否识别对象、章节、时间和单位 | 有内容但不知道属于哪个项目 |
| 主题纯度 | 一个 chunk 是否聚焦一个业务主题 | 电话、教育和项目混在一起 |
| 冗余率 | 重复 token 占全部 chunk token 的比例 | Top-K 被多个近似块占满 |
| Metadata 完整率 | source、page、heading、element、bbox 是否齐全 | 能回答但不能引用原文 |

独立可理解性可以人工按 1～5 分标注：1 分表示完全无法脱离原文理解，3 分表示基本可理解，5 分表示可以直接作为回答证据。大小不是最终目标，它只用于发现异常；不存在适合所有文档的固定最佳长度。

### 10.6 Chunk 的动态检索指标

静态指标合格后，将所有方案放入完全相同的检索系统。固定 Embedding、向量库、相似度、Top-K、是否使用 reranker，只改变待评估的解析器或 Chunker。

核心指标包括：

```text
Recall@K = Top-K 至少包含一个标准证据的问题数 / 问题总数
MRR      = 平均(1 / 第一个正确证据的排名)
Context Precision@K = Top-K 中相关 chunk 数 / K
Evidence Coverage@K = Top-K 覆盖的 required_facts 数 / required_facts 总数
有效证据 Token 比例 = 支持答案的 token / 送入 LLM 的全部 token
```

Recall 表示有没有找到，MRR 表示排得是否靠前，Context Precision 表示噪声有多少，Evidence Coverage 表示多事实问题是否完整。两个方案的 Recall@5 都可能是 100%，但如果一个需要给 LLM 3000 token 才包含 300 token 有效证据，另一个只需要 800 token，后者的 chunk 质量明显更高。

最后再测回答正确性、事实覆盖率、忠实度、引用正确率、引用完整率和无答案问题拒答率。必须区分“正确证据已经召回但 LLM 没用好”和“检索根本没有找到”，两者的修复方向完全不同。

### 10.7 控制变量的实验设计

推荐分三轮实验：

1. **解析器实验**：Docling、MinerU、OpenDataLoader、Unstructured 全部映射到统一元素格式，使用同一个 Chunker 和检索器；
2. **Chunker 实验**：固定最好的解析结果，对比固定长度、标题感知、业务规则、语义切分和父子块；
3. **检索实验**：固定解析和 chunk，对比 BM25、向量、混合检索、MMR、reranker 和 metadata filter。

每个失败问题都要分类，而不是只记录一个总分：

| 现象 | 常见原因 | 优先处理 |
| --- | --- | --- |
| 正确答案根本不存在 | OCR 错误或内容丢失 | 更换 OCR/解析器 |
| 文字存在但答案被切散 | Chunk 边界错误 | 改用结构或业务切分 |
| 正确 chunk 存在但没召回 | Embedding 不匹配 | 混合检索或换模型 |
| 正确 chunk 排名靠后 | 标题偏置或语义排序不足 | reranker、降权或过滤 |
| Top-K 大量重复 | overlap 过大 | 去重、降低重叠、MMR |
| 命中内容无法独立理解 | chunk 太小或缺少父标题 | 补充标题路径和主体 |
| 命中内容包含多个主题 | chunk 太大 | 按业务对象细分 |
| 表格数字没有单位和年份 | 表头没有传播 | 结构化表格切分 |
| 回答正确但引用错误 | metadata 错误 | 修复页码、bbox、元素映射 |

### 10.8 验收门槛与评分方式

不要把所有指标过早压成一个总分。先设置硬性门槛，通过后再用加权分排序。普通企业知识库可以从下面的目标开始，再根据风险和数据难度调整：

| 层级 | 指标 | 初始参考目标 |
| --- | --- | ---: |
| OCR | 原生文本 PDF 归一化字符准确率 | ≥ 99.5% |
| OCR | 清晰扫描件字符准确率 | ≥ 98% |
| OCR | 关键实体完全匹配率 | ≥ 99.5% |
| 解析 | 内容覆盖率 | ≥ 99% |
| 解析 | 阅读顺序正确率 | ≥ 98% |
| 解析 | 页码来源准确率 | 100% |
| Chunk | 答案包含率 | ≥ 98% |
| Chunk | 人为证据分裂率 | ≤ 2% |
| Chunk | 独立可理解性 | ≥ 4/5 |
| Chunk | Metadata 完整率 | 100% |
| 检索 | Recall@3 | ≥ 90% |
| 检索 | Recall@5 | ≥ 95% |
| 检索 | Context Precision@3 | ≥ 70% |
| 检索 | 关键问题 Recall@5 | 100% |

合同、财务、医疗等高风险场景需要把金额、日期、编号、条款和引用设为硬门槛，不能用其他指标的高分抵消。通过硬门槛后，可以按“OCR 与关键实体 20%、结构与顺序 15%、答案包含率 20%、Recall@3 20%、Context Precision@3 10%、引用定位 5%、性能与资源 10%”计算综合分。

### 10.9 回到本次简历测试：应该如何下结论

这份简历的现有结果不能简单归纳成“OpenDataLoader 一定最好”。更准确的结论是：

- OpenDataLoader 的文本忠实度、表格和 Markdown 结构最好，适合作为电子 PDF 的解析底座；
- 它的默认标题感知 chunk 仍有关键词偏置，基本信息排在项目证据之前，说明解析通过但 chunk/排序还需优化；
- MinerU 有一处 URL 字符错误，但项目开发内容直接进入 Top-1，说明这一次查询的 chunk 检索更好；
- Docling 的原生结构和细粒度 chunk 丰富，但姓名遗漏和低信息头部块需要治理；
- Unstructured 能较早召回项目内容，但解析噪声和表格扁平化需要清洗。

下一步应先把 OpenDataLoader 固定为候选解析底座，为简历建立 20～30 个“问题—答案—证据”样本，然后对比默认标题切分、简历业务切分和父子块切分。目标不是让 Markdown 更漂亮，而是让项目、技能、工作经历等正确证据稳定进入 Top-1/Top-3，同时减少无关块和输入 token。

最终的工程流程可以固定为：

```text
1. 明确业务问题和错误成本
2. 定义每类问题的最小充分证据单元
3. 按真实文档分布建立评测集
4. 标注 OCR 真值和“问题—答案—证据”真值
5. 固定 Chunker 比较解析器
6. 固定解析器比较 Chunker
7. 固定解析与 chunk 比较检索和重排
8. 评估最终回答、忠实度、引用和拒答
9. 对失败案例分类并定向优化
10. 使用独立测试集验收，上线后持续回收真实失败样本
```

选型时真正应该问的不是“哪个工具准确率最高”，而是：**在真实文档分布和真实问题上，哪个解析器、Chunker 和检索器组合，能够用最少的上下文稳定召回完整、正确、可引用的证据。**

## 11. 结合 RAGFlow 实现：一套完整 RAG 文档链路做对了什么

前面的四个 demo 刻意把变量压到最少：每个解析器输出统一的 Markdown、JSON 和 chunks，再使用同一个 BGE + FAISS 做向量召回。这适合观察解析器和默认 chunk 的差异，但它缺少生产 RAG 常见的关键词召回、重排、父子块、权限过滤和引用处理。

RAGFlow 是一个适合对照的方法实现。它不是单一 OCR 或 Chunker，而是把下面的环节组织成完整系统：

```text
PDF / 图片
  → DeepDoc 或外部 Parser
  → 统一 Section、Table、Image 和位置元数据
  → Token / Title / Parent-Child Chunk
  → 分词字段 + Embedding + Metadata
  → 全文条件 + Dense KNN 初召回
  → 词项/向量融合或 Reranker
  → 父 Chunk、TOC、RAPTOR、GraphRAG 等上下文增强
  → LLM 回答与引用
```

完整架构和查询链路已经在 [RAGFlow 详解](../rag/004_ragflow.md) 中分析，这里只讨论它对 OCR、chunk 和质量评估的启示。以下结论基于本地 `tmp/ragflow` 的 commit `554fb1133`（2026-08-14），主要核对 `deepdoc/parser/`、`deepdoc/vision/`、`rag/app/naive.py`、`rag/flow/chunker/` 和 `rag/nlp/search.py`。

### 11.1 OCR 与解析层做得好的地方

#### 不是把所有 PDF 都强制走 OCR

`deepdoc/parser/pdf_parser.py` 先通过 PDF 文本层取得字符和坐标，并检测 PUA/CID 乱码、异常字体映射等情况；检测到文本层不可靠时清空该页字符，触发 OCR fallback。这样能避免对正常电子 PDF 重复 OCR，同时又能处理扫描页和乱码文本层。

这是比“所有页统一 OCR”更合理的工程策略：

```text
可靠文本层 → 直接提取，速度快、字符忠实
乱码或无文本层 → OCR
版面、表格和坐标 → 继续结构分析
```

对于本次自带可靠文本层的简历，这种快速路径比强制视觉 OCR 更合适。

#### OCR 后面还有版面和表格恢复

DeepDoc 并不止调用文字识别。`RAGFlowPdfParser` 同时初始化 OCR、Layout Recognizer、Table Structure Recognizer 和文本上下拼接模型；解析过程中还处理表格方向检测、旋转后重新 OCR、页面阅读顺序、图片裁剪和 PDF 坐标。

因此它试图恢复的是“文档元素”，而不是一串纯文本。这一点直接服务于 RAG：表格和图片可以独立处理，正文 chunk 可以保留页码和 bbox，回答才能回跳到原文。

#### 把多种解析器接入同一条摄取链路

当前 `rag/app/naive.py` 的 `PARSERS` 已包含：

```text
DeepDOC
MinerU
Docling
OpenDataLoader
PaddleOCR
SoMark
Mistral OCR
Plain Text / Vision Parser
```

`common/parser_config_utils.py` 负责把模型配置归一化到具体解析器，MinerU、OpenDataLoader 和 PaddleOCR 还能通过租户的 OCR 模型配置创建实例。也就是说，RAGFlow 没有假设一个解析器适合全部文档，而是把解析器作为可替换的摄取组件。

这正是本文四个 demo 更适合的生产形态：OpenDataLoader、MinerU、Docling 不必各自建设一套向量库和问答系统，它们可以只负责文档理解，统一交给后续 RAG 管线。

#### 坐标不是附属字段，而是贯穿解析和引用

DeepDoc 在文字和表格中保留 `position_tag`、`positions`、页码和裁剪图片。OpenDataLoader 适配器也会把外部 JSON 的 bounding box 转成 RAGFlow 坐标，并为表格、图片和文字生成位置记录。Chunker 合并文本时继续合并源元素坐标，最终写入 `position_int`。

这比只保存 `document.md` 更完整：Markdown 用于阅读，结构化位置用于引用、预览、人工核验和错误定位。

### 11.2 Chunk 层做得好的地方

#### 支持结构切分，而不只有固定长度

RAGFlow 的普通路径仍支持 token 上限、分隔符和 overlap，但新 `TitleChunker` 会依次尝试：

1. 使用 PDF outline 判断标题层级；
2. 没有可靠 outline 时，使用标题正则和 layout 的 `section/title/head` 类型；
3. 按标题树合并正文；
4. 表格和图片保持独立元素；
5. 合并 chunk 时继续合并 PDF positions。

这比对 Markdown 每 500 字截断更接近“最小充分证据单元”。特别是合同、技术手册和章节清楚的论文，标题层级往往比字符窗口更能表达业务边界。

#### 父子 Chunk 解决“检索要小、回答要大”的冲突

`TokenChunker` 可以在主 chunk 上使用 `children_delimiters` 再切一层：子块保存 `mom`，索引阶段生成 `mom_id`。查询时 `rag/nlp/search.py::retrieval_by_children()` 让小块正常参加检索，命中后再读取不可直接检索的母块，用完整原文替换子块。

```text
小块：语义集中，容易准确命中
父块：上下文完整，适合交给 LLM
```

这正好可以解决当前 OpenDataLoader 简历结果的问题：详细项目内容块过大，向量主题被稀释；如果把 Agent 架构、通信、记忆、MCP 分成子块进行检索，再把“Media Agent 项目完整经历”作为父块返回，就能兼顾召回精度和回答完整性。

#### Chunk 不只是正文

索引记录除了正文和向量，还可以包含：

- `title_tks`：文档标题词项；
- `important_kwd`：重要关键词；
- `question_tks`：候选问题词项；
- `kb_id`、`doc_id`：检索范围；
- `position_int`：页码和位置；
- `doc_type_kwd`：文本、表格或其他类型；
- `mom_id`：父子关系。

这让检索可以利用标题、关键词、文档范围和类型，而不是只比较一个 `page_content` 向量。

### 11.3 召回与排序做得好的地方

#### 不依赖纯向量 Top-K

`rag/nlp/search.py` 会为同一个问题生成全文查询、查询关键词和查询向量。Elasticsearch 初召回同时使用全文条件和 Dense KNN；候选返回后，再计算查询词项对正文、标题、重要词和候选问题的覆盖率，与向量相似度融合。

默认权重由 `vector_similarity_weight` 控制：

```text
final_score
  = (1 - vector_similarity_weight) × term_similarity
  + vector_similarity_weight × vector_similarity
  + rank_feature
```

如果配置外部 Reranker，则使用问题和候选正文重新打分。相比本文 demo 的“一个向量距离决定排名”，它更能处理产品型号、姓名、URL、合同号等需要精确词项匹配的查询。

#### 候选召回和上下文扩展分层

RAGFlow 没有把所有增强都塞进第一次召回：

- 普通小 chunk 参加基础全文 + Dense 检索；
- 父 chunk 在子块命中后替换；
- TOC 在基础结果之后用于章节导航和补取；
- RAPTOR 摘要作为可检索记录，与普通 chunk 竞争；
- GraphRAG 使用独立图检索分支，再合入证据；
- 最终根据 token 预算组装上下文并生成引用。

这种分层设计让“找候选”和“补上下文”承担不同职责，比无限增大 chunk 或 Top-K 更可控。

#### 范围过滤在相关性检索之前

Tenant、KB、Document 和 metadata filter 先限定允许搜索的范围，再执行全文和向量召回。这既是权限边界，也能减少无关语料竞争。对简历库，可以先按岗位、地区、文档类型或候选人范围过滤，再比较项目和技能 chunk。

### 11.4 OCR 与解析层不足

#### 多解析器不等于自动选出最佳解析器

RAGFlow 提供多个 Parser，但主要仍由 `layout_recognize` 或模型配置选择。DeepDoc 内部能针对文本层乱码做 OCR fallback，却不会自动对同一份文档并行运行 OpenDataLoader、MinerU 和 Docling，再根据 CER、结构或检索指标选择最好结果。

因此“可切换”解决的是工程接入问题，不是质量评估问题。生产环境仍需要本文第 10 章的分层评测集和路由规则，例如：

```text
原生电子 PDF → OpenDataLoader / Plain Text 快速路径
中文扫描教材 → MinerU / PaddleOCR
复杂表格合同 → Docling / OpenDataLoader hybrid
```

#### 统一适配会损失解析器原生语义

RAGFlow 需要把各解析器输出转换为统一的 `sections + tables + positions`。这个方向便于统一索引，但也可能压平原生结构：Docling 的完整文档树、OpenDataLoader 的元素层级、MinerU 的 `text_level` 和内容类型不一定全部进入最终 chunk。

当前 OpenDataLoader 适配器会遍历元素、分类文字/表格/图片/公式并转换 bbox；Docling 响应也会被归一化成中间元素。适配层一旦没有映射某个字段，下游 Chunker 就无法再利用它。因此接入新 Parser 时不能只验证“有文字输出”，还要验证标题层级、表格、公式、图片说明和坐标的保留率。

#### 依赖和部署面较大

DeepDoc 本身包含 OCR、版面、表格和拼接模型；外部 Parser 又可能依赖本地服务、租户模型配置或额外运行时。完整 RAGFlow 还需要关系数据库、对象存储、Redis 和搜索引擎。它适合平台化知识库，但如果需求只是少量电子 PDF 转 Markdown，这套部署明显过重。

### 11.5 Chunk 与检索层不足

#### 默认切分仍然是启发式，不理解具体业务

标题树、分隔符、token 上限和 overlap 都比纯固定窗口更好，但它们仍不知道“一个简历项目”“一条合同责任”“一个故障处理流程”是什么。标题识别错误会沿着树传播；没有标题的长段落仍会回退到长度和分隔符；表格与相邻说明也可能被拆开。

因此 RAGFlow 的 Chunker 是通用基础设施，不会替代业务证据单元设计。简历仍应有项目、技能和经历规则；合同仍应识别章、条、款、条件和例外。

#### 标题和增强字段可能放大关键词偏置

默认词项排序中，`title_tks` 会重复两次，`important_kwd` 重复五次，`question_tks` 重复六次。它能强化重要信息，但也可能强化错误信息。当前简历查询中的“AI Agent 求职意向”已经在纯向量检索中压过项目内容；如果把它当作高权重标题，仍可能继续排在真正项目证据之前。

RAGFlow 提供 Reranker 和权重参数，但不会自动知道“求职意向不是实际项目证据”。需要通过 `section_type`、业务过滤、低信息块降权或标准问题集调参。

#### 全文准入可能漏掉同义表达

当 `vector_similarity_weight < 0.8` 时，基础检索会启用全文 `minimum_should_match` 条件，再让 Dense KNN 在通过全文条件的记录中竞争。这能减少纯向量误召回，但也可能过滤掉没有共享词项、语义却正确的 chunk。只有结果完全为空时才会降低全文门槛；“有一些结果但真正答案被门槛过滤”不会自动触发回退。

因此需要在真实问题集上比较向量权重、全文门槛和跨语言查询，不能把混合检索默认参数当成普适最优值。

#### 父子块会重新引入大上下文

父子检索解决了小块召回问题，但命中后会用完整母块替换子块。同一父块命中多个子块时，系统合并为一条父记录并使用子块分数均值。父块如果是一整章，最终上下文仍可能很大，相关证据 token 比例下降。

父子块的正确目标不是“父块越大越好”，而是：子块负责一个精确事实，父块负责一个完整业务对象。例如简历父块应是“一个项目”，而不是“整份简历”。

#### 高级增强带来成本和新的错误来源

- TOC 依赖目录质量和 LLM 选择，且通常要先从基础结果确定相关文档；
- RAPTOR 摘要与原始 chunk 一起竞争，摘要错误或过于泛化可能挤压精确证据；
- GraphRAG 需要实体关系抽取、N-hop 和额外检索，对普通事实问答可能收益有限；
- 引用补插依赖答案句子与候选 chunk 的词项/向量相似度，不能保证等价于严格事实归因。

这些能力应作为针对特定失败类型的增量实验，而不是全部开启后只看一次回答效果。

#### 系统没有自动完成质量闭环

RAGFlow 提供解析、切分、召回和引用能力，但不会自动为业务生成 OCR Ground Truth、标准证据、Recall@K、证据分裂率和引用正确率报告。可视化 chunk 和人工编辑有助于检查，却不能替代可重复评测。

它解决了“如何运行一条 RAG 管线”，没有替使用者回答“这套配置在我的数据上是否达标”。第 10 章的方法论仍然必须在 RAGFlow 外围实施。

### 11.6 用 RAGFlow 思路改造当前 Demo

当前 demo 的最大限制是所有工具都直接执行纯 Dense Top-4。结合 RAGFlow 的有效设计，可以把下一轮实验升级为：

```text
OpenDataLoader 解析电子 PDF
  → 保留元素类型、标题层级、页码和 bbox
  → 简历业务父块：一个项目 / 一组技能 / 一段经历
  → 检索子块：项目概述、架构、通信、记忆、MCP
  → BM25 + BGE 混合召回 Top-20
  → BGE Reranker 重排
  → 相同 mom_id 的子块替换为项目父块
  → Top-3 交给 LLM，并引用 page + bbox
```

针对当前“候选人有哪些 RAG 和 Agent 项目经验”这个问题：

1. 基本信息 chunk 标记为 `section_type=basic_info`，查询项目时过滤或降权；
2. Docling 的 `开发内容` 补入完整路径 `工作经验 > Media Agent > 开发内容`；
3. OpenDataLoader 的项目地址合入项目概述，不再形成独立小块；
4. 详细开发内容拆成 Agent 架构、通信/UI、记忆/Multi-Agent、MCP/内容生成四个子块；
5. 子块命中后返回完整 Media Agent 项目父块；
6. Reranker 判断 chunk 是否真正回答“项目经验”，而不是只包含 `AI Agent` 关键词。

### 11.7 对 RAGFlow 的总体评价

| 维度 | 做得好的地方 | 不足 |
| --- | --- | --- |
| OCR | 文本层优先、乱码检测、OCR fallback | 没有自动比较多个 Parser 的质量 |
| 版面 | OCR、Layout、表格、阅读顺序和坐标形成闭环 | 复杂模型和依赖带来部署成本 |
| Parser 生态 | DeepDoc、MinerU、Docling、OpenDataLoader 等统一接入 | 统一适配可能损失原生结构字段 |
| Chunk | 标题层级、表格/图片独立、token 和 overlap 可配置 | 默认仍是通用启发式，不理解业务对象 |
| 上下文 | 父子块实现小块检索、大块回答 | 父块过大会降低上下文精度 |
| 检索 | 全文、Dense、词项融合、Reranker 和过滤 | 默认权重也会产生关键词/标题偏置 |
| 高级检索 | TOC、RAPTOR、GraphRAG 针对不同失败类型 | 成本高，且引入摘要、目录和图抽取误差 |
| 引用 | 页码、bbox、图片和引用回填 | 后验相似度补引用不等于严格事实归因 |
| 评估 | UI 和 Chunk 数据便于人工检查 | 没有替业务自动建立 Ground Truth 和质量门禁 |

RAGFlow 最值得借鉴的不是“默认参数”，而是三层分离：**解析器负责恢复事实和结构，子 chunk 负责精确召回，父块及结构增强负责补足回答上下文。** 最需要补充的则是本文第 10 章的评测闭环，以及面向具体业务对象的 Chunker。

## 参考资料

1. [MinerU](https://github.com/opendatalab/MinerU)
2. [MinerU Ecosystem](https://github.com/opendatalab/MinerU-Ecosystem)
3. [Docling](https://github.com/docling-project/docling)
4. [Docling Chunking](https://docling-project.github.io/docling/concepts/chunking/)
5. [Docling Integrations](https://docling-project.github.io/docling/integrations/)
6. [Docling Examples](https://docling-project.github.io/docling/examples/)
7. [OpenDataLoader PDF](https://github.com/opendataloader-project/opendataloader-pdf)
8. [OpenDataLoader PDF LangChain Loader](https://github.com/opendataloader-project/langchain-opendataloader-pdf)
9. [OpenDataLoader PDF LlamaIndex Reader](https://github.com/opendataloader-project/opendataloader-pdf-llamaindex)
10. [Unstructured](https://github.com/Unstructured-IO/unstructured)
11. [Unstructured Chunking](https://docs.unstructured.io/open-source/core-functionality/chunking)
12. [LiteParse](https://github.com/run-llama/liteparse)
13. [Marker](https://github.com/datalab-to/marker)
14. [OCRmyPDF](https://github.com/ocrmypdf/OCRmyPDF)
15. [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)
16. [EasyOCR](https://github.com/JaidedAI/EasyOCR)
17. [RapidOCR](https://github.com/RapidAI/RapidOCR)
18. [Tesseract OCR](https://github.com/tesseract-ocr/tesseract)
