---
weight: 1
title: "Langchain Rag 相关抽象"
date: 2025-08-19T8:00:00+08:00
lastmod: 2025-08-19T8:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Langchain RAG 相关抽象"
featuredImage: 

tags: ["RAG"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

这个周期里我们来学习 RAG 相关的知识。我们首先会介绍 Langchain 中有关 RAG 的抽象，然后去看 [RagFlow](https://github.com/infiniflow/ragflow) 这个开源项目。

## 1. Langchain Rag
学习 Langchian 中有关 RAG 的抽象之前，我们先看一个使用 Langchian 实现 Rag 的简单示例。

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain.chains import RetrievalQA
from langchain.docstore.document import Document


from dotenv import load_dotenv, find_dotenv
from langchain_community.chat_models import ChatTongyi
from langchain_community.embeddings import DashScopeEmbeddings


_ = load_dotenv(find_dotenv())  # read local .env file

llm = ChatTongyi(temperature=0.0)

# 1. 准备文档
docs = [
    Document(page_content="LangChain 是一个用于构建 LLM 应用的框架。"),
    Document(
        page_content="RAG 代表 Retrieval-Augmented Generation，它结合了检索和生成。"
    ),
    Document(page_content="FAISS 是一个快速的相似度搜索向量数据库。"),
]

# 2. 切分文档
splitter = RecursiveCharacterTextSplitter(chunk_size=100, chunk_overlap=10)
splitted_docs = splitter.split_documents(docs)

# 3. 向量化 & 存储
# embeddings = OpenAIEmbeddings()
embeddings = DashScopeEmbeddings(
    model="text-embedding-v1"
)
vectorstore = FAISS.from_documents(splitted_docs, embeddings)

# 4. 构建 RAG QA Chain
qa = RetrievalQA.from_chain_type(
    llm=llm, retriever=vectorstore.as_retriever(), return_source_documents=True
)

# 5. 提问
query = "什么是 RAG?"
result = qa.invoke({"query": query})

print("用户问题:", query)
print("模型回答:", result["result"])
print("参考文档:", [doc.page_content for doc in result["source_documents"]])
```

## 2. Langchain Rag 相关抽象
langchain_core 中有如下与 Rag 相关的抽象:

### 2.1 `Document`

* **所在位置**: `langchain_core\documents`
* **含义**: 表示被检索的文档。
* **主要属性**:

  * `page_content`: 文本内容
  * `metadata`: 文档元信息（来源、时间、标签等）
* **作用**: 载体，用于向量化和生成模型输入。

### 2.2 `DocumentLoader`
* **所在位置**: `langchain_core\document_loaders`
* **含义**: 定义文档加载器接口
* **主要属性**:

* **作用**: 载体，用于向量化和生成模型输入。


### 2.3 `Embeddings`

* **所在位置**: `langchain_core\embeddings`
* **含义**: 文本向量化接口
* **作用**: 支撑 RAG 中向量检索部分，把文本或 query 映射到向量空间
* **常见实现**:

  * `OpenAIEmbeddings`
  * `HuggingFaceEmbeddings`
  * `TongyiEmbeddings`（自定义）

### 2.5 `Retriever`

* **所在位置**: `langchain_core\retrievers.py`
* **含义**: 定义检索器接口
* **作用**: RAG 的第一步——根据 query 从向量数据库或文档集合中找到相关文档。
* **子类/常见实现**:

  * `VectorStoreRetriever` → 连接 FIASS、Chroma、Weaviate 等向量数据库
  * `TimeWeightedVectorStoreRetriever` → 支持时间加权的检索
  * `KNNRetriever` → 基于近邻搜索的检索

---

### 2.5 `VectorStore`

* **所在位置**: `langchain_core\vectorstores`
* **含义**: 定义向量存储接口
* **作用**: 支撑 RAG 的向量检索能力。
* **常见实现**:

  * `FAISS`
  * `Chroma`
  * `Weaviate`

---

### 2.6 `RetrievalQA`

* **所在位置**: `langchain\chains\retrieval_qa`
* **含义**: 为 Rag 提供的一系列 chain


### 2.7 Rag 执行流程
下面是 Rag 执行的流程:

```text
用户 Query
   │
   ▼
Retriever.get_relevant_documents(query)  ← Embeddings + VectorStore
   │
   ▼
文档列表 (List[Document])
   │
   ▼
LLM (Chain) 生成答案
   │
   ▼
返回用户答案 + 可选参考文档
```

## 3. Document

![UML 类图](/images/langchain/document.svg)

从 UML 类图可以看出，Document 有如下 Base 抽象类：
1. BaseMedia
2. Blob
3. Document
4. BaseDocumentTransformer

### 3.1 提问
让我们问问大模型这这些基类代表的语义。

```bash
我正在阅读  langchain Document 子包的源代码，注意到 Document 包内有如下 base 的抽象类:
1. BaseMedia
2. Blob
3. Document
4. BaseDocumentTransformer
请从语义上解释一下这些类的的作用
```

### 3.2 回答

```bash
BaseMedia
 └── Blob           ← 原始二进制数据
Document           ← 可用于 LLM 的文档
BaseDocumentTransformer ← 文档的处理/转换器
```

- BaseMedia / Blob 强调 原始内容
- Document 强调 可处理、可索引、可喂给 LLM 的内容
- BaseDocumentTransformer 强调 对文档的加工或转换逻辑

#### 1️⃣ `BaseMedia`

* **语义作用**：
  `BaseMedia` 是最底层的媒体资源抽象，用来表示“原始内容载体”。它强调的是 **内容来源或媒介本身**，而不是内容的处理或解析。
* **典型职责**：

  * 定义媒体的基本属性，比如 `mime_type`、`size`、`url` 或本地路径。
  * 提供对原始数据的读取或访问接口。
* **典型场景**：

  * 一段音频文件、视频文件、PDF 文件、图片等。它关注的是“这个内容是什么媒体”，而不是“文本、结构化信息或向量表示”。

---

#### 2️⃣ `Blob`

* **语义作用**：
  `Blob` 可以理解为 `BaseMedia` 的一个子类或者扩展，表示 **二进制大对象（Binary Large Object）**，核心关注的是 **原始二进制数据的封装**。
* **典型职责**：

  * 封装数据内容（bytes）。
  * 提供对数据的读取、写入接口。
  * 可能包含元信息，如 `filename`、`checksum` 等。
* **区别于 BaseMedia**：

  * `BaseMedia` 更抽象，强调“媒介类型和来源”；
  * `Blob` 更具体，强调“数据本身（原始 bytes）及其处理”。
* **典型场景**：

  * 从数据库或存储系统读取的 PDF bytes、图片 bytes、音频 bytes。

---

#### 3️⃣ `Document`

* **语义作用**：
  `Document` 是 LangChain 里最核心的文档抽象，表示 **经过处理、可被 LLM 使用的结构化或半结构化内容**。
* **典型职责**：

  * 保存文档内容（通常是文本，但也可能有嵌入向量、元数据）。
  * 提供元数据字段，例如 `source`、`author`、`timestamp`。
  * 支持分片、文本预处理、向量化等操作。
* **区别于 Blob**：

  * `Blob` 是原始数据；
  * `Document` 是经过处理和包装的内容，可以直接喂给 LLM。
* **典型场景**：

  * PDF 解析后的文本 Document。
  * 网页抓取后的 HTML 文本 Document。
  * CSV、JSON 等结构化数据被转成 Document。

---

#### 4️⃣ `BaseDocumentTransformer`

* **语义作用**：
  这是对 `Document` 做处理或转换的抽象。它不是文档本身，而是 **定义文档如何被加工、转换或增强**。
* **典型职责**：

  * 接收一个或多个 `Document`，输出新的 `Document`。
  * 转换操作可能包括：

    * 文本清洗（去除多余空格、特殊符号）
    * 分段/分片
    * 嵌入生成
    * 格式转换（例如 PDF → 文本 → Document）
* **典型场景**：

  * `TextSplitter`、`EmbeddingGenerator` 等 transformer 类通常实现这个接口。

---

## 4. DocumentLoader

![UML 类图](/images/langchain/doucument_loader.svg)


从 UML 类图可以看出，DocumentLoader 有如下 Base 抽象类：
1. BaseLoader
2. BlobLoader
3. LangSmithLoader
4. BaseBlobParser

### 4.1 提问
让我们问问大模型这这些基类代表的语义。

```bash
我正在阅读  langchain DocumentLoader 子包的源代码，注意到 DocumentLoader 包内有如下 base 的抽象类:
1. BaseLoader
2. BlobLoader
3. LangSmithLoader
4. BaseBlobParser
请给我从语义上解释一下这些类的的作用
```

### 4.2 回答

```bash
BaseLoader                ← 抽象接口，定义 load() 方法
 └── LangSmithLoader       ← 从 LangSmith 平台加载数据
BlobLoader                 ← 加载原始二进制数据
BaseBlobParser             ← 将 Blob 解析成 Document
```

- BaseLoader：获取原始资源
- BlobLoader：获取 bytes
- LangSmithLoader：获取平台数据
- BaseBlobParser：将 bytes 转换为 Document

#### 1️⃣ `BaseLoader`

* **语义作用**：
  `BaseLoader` 是所有 Loader 的顶层抽象，表示 **从某个来源加载原始数据并产出 Document 的能力**。它强调的是“**数据的获取过程**”，而不是具体的文件类型或存储方式。
* **典型职责**：

  * 定义统一接口，例如 `load()` 或 `aload()`（异步加载）。
  * 接收源信息（文件路径、URL、数据库连接等）。
  * 返回 `Document` 或 `Blob`。
* **典型场景**：

  * 从本地文件夹读取文档
  * 从网页或 API 获取内容
  * 从数据库抓取文本

---

#### 2️⃣ `BlobLoader`

* **语义作用**：
  `BlobLoader` 是 `BaseLoader` 的子类，专门用于 **加载原始二进制数据（Blob）**，强调的是 **获取原始 bytes**，而不是直接解析成 Document。
* **典型职责**：

  * 将文件或资源读取为 `Blob` 对象。
  * 提供对原始数据的访问接口。
* **区别**：

  * `BaseLoader` 更抽象，可以直接返回 Document；
  * `BlobLoader` 专注于返回原始二进制数据，通常需要后续解析步骤。
* **典型场景**：

  * 读取 PDF、音频、视频文件的 bytes。

---

#### 3️⃣ `LangSmithLoader`

* **语义作用**：
  `LangSmithLoader` 是 LangChain 对接 **LangSmith 平台数据** 的 Loader，用于 **从 LangSmith API 或数据仓库获取文档/实验记录**。
* **典型职责**：

  * 与 LangSmith 平台交互，获取数据。
  * 将数据封装成 `Document` 或 `Blob`。
* **区别**：

  * 与通用文件/二进制 Loader 不同，它专门针对 LangSmith 平台。
* **典型场景**：

  * 从 LangSmith 上下载实验数据、标注数据、记录文本。

---

#### 4️⃣ `BaseBlobParser`

* **语义作用**：
  `BaseBlobParser` 是 **Blob → Document 的解析器**，强调 **如何把原始二进制数据转成可被 LLM 使用的 Document**。
* **典型职责**：

  * 接收一个或多个 `Blob`。
  * 提取其中的文本或结构化信息。
  * 输出 `Document`（带元数据）。
* **典型场景**：

  * PDF bytes → 文本 Document
  * 图片 bytes → OCR 文本 Document
  * 音频 bytes → 转写文本 Document


## 5. Embeddings

![UML 类图](/images/langchain/embedding.svg)


从 UML 类图可以看出，Embeddings 有如下抽象类：
1. Embeddings
2. FakeEmbeddings
3. DeterministicFakeEmbedding

### 5.1 提问
让我们问问大模型这这些基类代表的语义。

```bash
我正在阅读  langchain Embeddings 子包的源代码，注意到 Embeddings 包内有如下 base 的抽象类:
1. Embeddings
2. FakeEmbeddings
3. DeterministicFakeEmbedding
请给我从语义上解释一下这三个类的的作用
```

### 5.2 回答
```
Embeddings                     ← 抽象接口：文本 → 向量
 └── FakeEmbeddings            ← 测试用伪向量
      └── DeterministicFakeEmbedding  ← 可重复伪向量
```

- Embeddings：真实或通用向量化接口
- FakeEmbeddings：占位或随机向量，用于测试
- DeterministicFakeEmbedding：可重复向量，用于可靠测试


#### 1️⃣ `Embeddings`

* **语义作用**：
  `Embeddings` 是 **生成文本向量表示（embedding）的抽象接口**。它定义了 LLM 或向量化模块如何把文本或文档转换为向量，以便做相似度搜索、向量索引或检索增强（RAG）。
* **典型职责**：

  * 提供接口，如：

    * `embed_text(text: str) -> List[float]`
    * `embed_documents(docs: List[str]) -> List[List[float]]`
  * 抽象不同 Embedding 模型（OpenAI、HuggingFace、SentenceTransformers 等）的统一调用方式。
* **典型场景**：

  * 文本向量化，用于向量数据库存储。
  * 文档检索、语义搜索、聚类等。

---

#### 2️⃣ `FakeEmbeddings`

* **语义作用**：
  `FakeEmbeddings` 是 **Embeddings 的测试/占位实现**，用于不依赖真实模型生成向量的场景。
* **典型职责**：

  * 根据文本返回伪造的向量（通常是固定值、长度占位符或随机向量）。
  * 用于单元测试、调试或不希望调用真实模型时。
* **典型场景**：

  * 测试 pipeline 是否能处理 embeddings 而无需调用实际模型。
  * 验证向量数据库的逻辑是否正确。

---

#### 3️⃣ `DeterministicFakeEmbedding`

* **语义作用**：
  `DeterministicFakeEmbedding` 是 `FakeEmbeddings` 的一种特殊实现，保证 **相同输入总是返回相同向量**。
* **典型职责**：

  * 对同一个文本生成固定、可预测的向量。
  * 用于需要可重复结果的测试场景。
* **典型场景**：

  * 单元测试，确保 embedding 的结果稳定，便于断言。
  * 调试 pipeline 时避免随机性干扰。


## 6. Retriever

![UML 类图](/images/langchain/retriever.svg)


从 UML 类图可以看出，Retriever 有如下 Base 抽象类：
1. BaseRetriever

### 6.1 提问
让我们问问大模型这这些基类代表的语义。

```bash
我正在阅读  langchain Retriever 子包的源代码，注意到 Retriever 包内有如下 base 的抽象类:
1. BaseRetriever

请给我从语义上解释一下这些类的的作用
```

### 6.2 回答

`BaseRetriever` 是整个检索器模块的基础抽象：

```
BaseRetriever
 ├─ 向量数据库检索器（VectorStoreRetriever）
 ├─ 关键词检索器（KeywordRetriever）
 └─ 其他自定义检索器
```

* 抽象了“如何从文档集合中找到相关信息”的通用接口
* 提供统一调用方式给 LLM 或上层应用


#### 1️⃣ `BaseRetriever`

* **语义作用**：
  `BaseRetriever` 是 **所有检索器（Retriever）的顶层抽象**，表示 **从文档集合或向量库中检索相关信息的能力**。它定义了统一的接口，让不同类型的检索器都可以被一致调用，无论底层是向量数据库、关键词搜索还是知识图谱。

* **典型职责**：

  * 提供核心接口，例如：

    * `get_relevant_documents(query: str) -> List[Document]`
    * `aget_relevant_documents(query: str) -> List[Document]`（异步版本）
  * 接收查询输入，返回符合语义或关键词匹配的 `Document` 列表。
  * 可以包含默认的过滤或排序逻辑。

* **典型场景**：

  * 向量数据库（如 FAISS、Chroma）检索相似文档。
  * 文本索引或关键词搜索。
  * RAG（Retrieval-Augmented Generation）系统中 LLM 调用前的知识检索。

* **语义理解**：

  * `BaseRetriever` 不关心 **具体文档存储方式**，只关心 **给定查询，能返回相关 Document**。
  * 它是 LLM 系统中 **查询 → 文档** 流程的核心接口。



## 7. VectorStore

![UML 类图](/images/langchain/vectorstore.svg)


从 UML 类图可以看出，VectorStore 有如下 Base 抽象类：
1. VectorStore
2. InMemoryVectorStore
3. VectorStoreRetriever

### 7.1 提问
让我们问问大模型这这些基类代表的语义。

```bash
我正在阅读  langchain VectorStore 子包的源代码，注意到 VectorStore 包内有如下 base 的抽象类:
1. VectorStore
2. InMemoryVectorStore
3. VectorStoreRetriever
请给我从语义上解释一下这三个类的的作用
```

### 7.2 回答
```
VectorStore                  ← 向量数据库抽象接口
 └── InMemoryVectorStore      ← 内存实现版本（简单/测试用）

VectorStoreRetriever          ← Retriever 封装，调用 VectorStore 返回 Document
```

* `VectorStore`：存储和查询向量
* `InMemoryVectorStore`：内存版本实现
* `VectorStoreRetriever`：检索器封装，方便 LLM 使用


#### 1️⃣ `VectorStore`

* **语义作用**：
  `VectorStore` 是 **向量数据库的抽象接口**，表示一个可以存储和查询向量化文档的通用存储结构。它定义了 **向量的存储、检索、删除等操作** 的统一接口，不依赖具体实现。
* **典型职责**：

  * 存储向量化的文档（Document + embedding）。
  * 提供查询接口，如相似度搜索 (`similarity_search`)。
  * 支持管理向量索引，例如添加、删除、更新向量。
* **典型场景**：

  * FAISS、Chroma、Weaviate、Milvus 等向量数据库的统一抽象。
  * RAG 系统中 LLM 前置的知识检索层。

---

#### 2️⃣ `InMemoryVectorStore`

* **语义作用**：
  `InMemoryVectorStore` 是 `VectorStore` 的 **内存实现版本**，用于 **无需持久化即可存储和查询向量** 的场景。
* **典型职责**：

  * 将文档及其向量存放在内存列表或数组中。
  * 提供相似度搜索接口。
  * 通常用于 **测试、调试或小规模实验**。
* **区别**：

  * `VectorStore` 是抽象接口；
  * `InMemoryVectorStore` 是可直接使用的简单实现，数据仅在内存中。
* **典型场景**：

  * 单元测试和快速原型。
  * 小规模向量检索实验，无需外部数据库依赖。

---

#### 3️⃣ `VectorStoreRetriever`

* **语义作用**：
  `VectorStoreRetriever` 是 **检索器（Retriever）实现**，专门用来 **从 VectorStore 检索相关文档**。
* **典型职责**：

  * 持有一个 `VectorStore` 实例。
  * 提供统一接口 `get_relevant_documents(query)`，通过向量相似度返回 Document 列表。
  * 可以增加过滤条件、返回 top-k 文档等。
* **区别**：

  * `VectorStore` 负责 **存储和查询向量**；
  * `VectorStoreRetriever` 负责 **根据查询返回 Document**，封装了检索逻辑，便于直接作为 LLM 的知识检索层使用。
* **典型场景**：

  * RAG 系统中的向量检索层。
  * 封装向量数据库，使上层 LLM 可以直接调用 `retriever.get_relevant_documents(query)`。
