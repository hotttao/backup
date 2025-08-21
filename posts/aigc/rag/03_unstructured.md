---
weight: 1
title: "unstructured 库"
date: 2025-08-19T10:00:00+08:00
lastmod: 2025-08-19T10:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "unstructured 库"
featuredImage: 

tags: ["langgraph 源码", "RAG"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---


### 顶层
- `__init__.py`、`__version__.py`、`errors.py`、`logger.py`、`utils.py`
  - 作用：初始化环境、版本与通用错误/日志/工具函数。
  - 核心对象/函数：通用 `logger`，常见异常类型，懒属性与参数解析工具等。

### documents（文档与元素模型）
- `documents/elements.py`
  - 作用：定义“文档元素”抽象与所有内置元素类型，以及元素元数据与合并策略。
  - 核心对象：
    - `Element` 抽象基类；`Text`、`Title`、`NarrativeText`、`ListItem`、`Header`、`Footer`、`CodeSnippet`、`PageBreak`、`Table`、`TableChunk`、`CompositeElement` 等
    - `ElementMetadata`（动态字段容器，含坐标/页码/语言/链接/HTML/来源/父子等）
    - `CoordinatesMetadata`、`DataSourceMetadata`
    - `ElementType` 与 `TYPE_TO_TEXT_ELEMENT_MAP`
  - 核心函数/装饰器：`process_metadata()`、`assign_and_map_hash_ids(...)`、KV 表单序列化/反序列化工具。
- `documents/coordinates.py`
  - 作用：坐标系与坐标转换。
  - 核心对象：`CoordinateSystem`、`RelativeCoordinateSystem`、`PixelSpace` 等。
- `documents/mappings.py`、`documents/ontology.py`
  - 作用：类型/语义映射与本体（分类/标签）定义。

### partition（统一入口与各格式解析）
- `partition/auto.py`
  - 作用：统一 `partition(...)` 入口；自动检测类型并路由到对应 `partition_*`。
  - 核心对象/函数：`partition(...)`、`file_and_type_from_url(...)`、`decide_table_extraction(...)`、`_PartitionerLoader`（依赖校验+动态 import）。
- `partition/api.py`
  - 作用：通过 REST API 托管服务进行分区。
  - 核心函数：`partition_via_api(...)`、`partition_multiple_via_api(...)`、`get_retries_config(...)`。
- `partition/common/`
  - `common.py`：归一化版面元素为 `Element`、`add_element_metadata(...)`、`exactly_one(...)`、Office 转换等。
  - `lang.py`、`metadata.py`：语言参数校验、层级/元数据处理。
- `partition/utils/`
  - `constants.py`：`PartitionStrategy`、OCR/排序常量与白名单等。
  - `ocr_models/`：Tesseract/Paddle/Google Vision 的 OCR 适配器接口与实现。
  - 其他：`sorting.py`、`xycut.py` 等版面排序/分割算法。
- 各格式分区器（输入→`list[Element]`）
  - 根目录：`pdf.py`、`image.py`、`text.py`、`docx.py`、`pptx.py`、`xlsx.py`、`md.py`、`html/partition.py`、`email.py`、`msg.py`、`json.py`、`ndjson.py`、`csv.py`、`tsv.py`、`xml.py`、`odt.py`、`epub.py`、`org.py`、`rst.py`、`rtf.py`、`ppt.py`、`doc.py` 等
  - 子目录 `pdf_image/`：PDF hi_res/版面推理、OCR、pdfminer/pypdf 工具与表单提取。

### file_utils（文件类型识别与文件工具）
- `file_utils/model.py`
  - 作用：文件类型域模型。
  - 核心对象/函数：`FileType`（枚举 + 依赖/模块/函数名映射）、`create_file_type(...)`、`register_partitioner(...)`。
- `file_utils/filetype.py`
  - 作用：自动检测文件类型（MIME/libmagic/后缀）与特殊分辨（JSON/NDJSON、MS Office、ZIP）。
  - 核心函数：`detect_filetype(...)`、`is_json_processable(...)`、`is_ndjson_processable(...)`；装饰器 `add_metadata(...)`、`add_filetype(...)`。
- `file_utils/encoding.py`、`file_utils/file_conversion.py`、`file_utils/ndjson.py`、`file_utils/google_filetype.py`
  - 作用：编码检测与格式转换、NDJSON I/O、Google 相关类型工具。

### chunking（元素分块）
- `chunking/dispatch.py`
  - 作用：按名称分发分块策略；为 `partition_*` 提供 `@add_chunking_strategy` 装饰器。
  - 核心：`add_chunking_strategy`、`chunk(elements, name, **kwargs)`；注册表含 `"basic"`、`"by_title"`。
- `chunking/basic.py`
  - 作用：基础分块实现（尽量填满窗口，过长文本切分，支持 overlap）。
  - 核心函数：`chunk_elements(...)`。
- `chunking/base.py`
  - 作用：分块通用基建与算法。
  - 核心对象/函数：`ChunkingOptions`、`PreChunker`、`PreChunk`、`_Chunker`、`_TableChunker`、`_HtmlTableSplitter`、边界谓词 `is_title(...)`、`is_on_next_page()`、默认参数常量。
- `chunking/title.py`
  - 作用：`by_title` 策略（按标题/页等语义边界分块）。
  - 核心函数：`chunk_by_title(...)`（与 `ChunkingOptions`/边界谓词配合）。

### cleaners（清洗）
- `cleaners/core.py`、`cleaners/extract.py`、`cleaners/translate.py`
  - 作用：文本清洗、抽取与翻译工具（可对 `Text.apply(...)` 等使用）。

### nlp（NLP 辅助）
- `nlp/patterns.py`、`nlp/tokenize.py`、`nlp/english_words.py`、`nlp/partition.py`
  - 作用：正则/分词/词表与与分区辅助（如 JSON/EML/列表项识别等）。

### embed（向量化）
- `embed/interfaces.py` 及各服务实现：`openai.py`、`huggingface.py`、`vertexai.py`、`bedrock.py` 等
  - 作用：为 `Element` 文本生成嵌入；统一接口 + 多后端实现。
  - 核心对象：各 `Embedder`/客户端封装。

### metrics（评测与统计）
- `metrics/evaluate.py`、`metrics/text_extraction.py`、`metrics/table/*`
  - 作用：元素类型/表格/文本抽取的评测工具与指标。

### common（通用结构）
- `common/html_table.py`
  - 作用：HTML 表格到内部结构（`HtmlTable/HtmlRow/HtmlCell`），供表格分块与处理。

### staging（导入/导出与标注生态）
- `staging/base.py`、`staging/*`（`weaviate.py`、`huggingface.py`、`label_studio.py`、`prodigy.py` 等）
  - 作用：`Element` <-> JSON/NDJSON/平台数据的编解码与对接。

### patches（三方库补丁）
- `patches/pdfminer.py`
  - 作用：修补 `pdfminer` 特定行为以配合抽取流程。

### models（类型标记）
- `models/__init__.py`
  - 作用：类型/协议聚合（多为占位与导出）。

——

### 核心对象总览
- 文档元素：`Element` 及子类（`Text`/`Title`/`ListItem`/`Table`/`CompositeElement`/`TableChunk` 等）
- 元数据：`ElementMetadata`、`CoordinatesMetadata`、`DataSourceMetadata`
- 文件类型与策略：`FileType`、`PartitionStrategy`
- 分块：`ChunkingOptions`、`PreChunker`、`chunk_elements(...)`、`chunk_by_title(...)`
- 统一入口：`partition(...)`、`partition_via_api(...)`

如果你告诉我你主要处理的文件类型（例如 PDF、HTML 或 Office），我可以把对应 `partition_*` 的关键参数与常见陷阱再精简成“速查表”。



