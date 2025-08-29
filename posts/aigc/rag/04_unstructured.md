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

👌 好的，我来给你介绍一下 **[`unstructured`](https://github.com/Unstructured-IO/unstructured)** 这个库。它是 LangChain 生态里经常会用到的文档解析工具，主要负责 **从各种格式（PDF、Word、HTML、图片等）中提取干净的文本和结构化信息**。

---

## 1. `unstructured` 的组成

这个库的设计理念是：**输入非结构化文档 → 输出结构化的分块 (elements)**。
主要由以下模块组成：

| 模块                            | 作用                                                                    |
| ----------------------------- | --------------------------------------------------------------------- |
| **partition**                 | 文档解析入口，支持多种文档类型（PDF、HTML、DOCX、EML、PPTX、图片等）。                          |
| **elements**                  | 统一的数据结构，表示文档中的不同块，比如 `Title`, `NarrativeText`, `ListItem`, `Table` 等。 |
| **staging**                   | 提供中间处理层，把原始文档解析成 `elements`。                                          |
| **cleaning / chunking**       | 对文本进一步清洗、分块，便于后续向量化或检索。                                               |
| **embeddings / integrations** | 与 LangChain、LlamaIndex 等生态集成，直接将 elements 转换成可嵌入的文本片段。                |

---

## 2. 核心抽象

`unstructured` 的核心抽象是 **Element**。

* 一个文档会被分解为一系列 **Element** 对象。
* 每个 Element 代表文档中的一个语义单元，比如：

  * `Title`（标题）
  * `NarrativeText`（正文）
  * `ListItem`（列表项）
  * `Table`（表格）
  * `Image`（图片，含 OCR 文本）

举个例子，一份 PDF 可能被解析成：

```text
[Title("Annual Report 2024"),
 NarrativeText("This report provides an overview..."),
 ListItem("Revenue increased by 20%"),
 Table("...")]
```

这种抽象的好处是：

* **跨格式统一**（不管是 PDF、Word 还是 HTML，最后都变成 Elements）
* **可控粒度**（你可以按标题分块，或者按自然段分块）

---

## 3. 基础使用

### 3.1 安装

```bash
pip install "unstructured[all-docs]"
```

（带上 `[all-docs]` 会安装各种文档格式支持）

---

### 3.2 解析一个文档

比如解析 PDF：

```python
from unstructured.partition.pdf import partition_pdf

elements = partition_pdf("example.pdf")

for el in elements[:5]:
    print(type(el), el.text)
```

输出可能是：

```text
<class 'unstructured.documents.elements.Title'> Annual Report 2024
<class 'unstructured.documents.elements.NarrativeText'> This report provides...
<class 'unstructured.documents.elements.ListItem'> Revenue increased by 20%
```

---

### 3.3 对不同格式的文档使用对应的 partition

* **Word 文档**

  ```python
  from unstructured.partition.docx import partition_docx
  elements = partition_docx("example.docx")
  ```

* **HTML 页面**

  ```python
  from unstructured.partition.html import partition_html
  elements = partition_html("example.html")
  ```

* **纯文本文件**

  ```python
  from unstructured.partition.text import partition_text
  elements = partition_text("example.txt")
  ```

---

### 3.4 与 LangChain 集成

LangChain 提供了 `UnstructuredLoader` 封装：

```python
from langchain.document_loaders import UnstructuredPDFLoader

loader = UnstructuredPDFLoader("example.pdf")
docs = loader.load()

print(docs[0].page_content[:200])
```

这样就可以把文档直接变成 LangChain 的 `Document` 对象，方便后续做 **向量化检索 (RAG)**。
