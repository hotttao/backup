---
weight: 1
title: "RagFlow Task 执行流程"
date: 2025-08-20T11:00:00+08:00
lastmod: 2025-08-20T11:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "RagFlow Task 执行流程"
featuredImage: 

tags: ["RAG", "RagFlow"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

前两节我们介绍了 ragflow task exector 的启动流程，以及 ragflow 中的表以及 ORM 相关的代码，至此我们已经对 ragflow 中的数据以及如何操作数据有了一定的了解。这一节我们来看 task exector do_handle_task 是如何执行 task 的。

## 1. do_handle_task 执行流程

do_handler_task 的代码很长，我们先借助 ChatGpt 来了解一下 do_handler_task 的执行流程。

---
整体来看，它是一个**文档处理任务处理器**，负责从接收到的任务开始到文档切分、向量化、存储的全流程处理。

### 1.1 函数签名和初始信息

```python
async def do_handle_task(task):
    task_id = task["id"]
    task_from_page = task["from_page"]
    task_to_page = task["to_page"]
    task_tenant_id = task["tenant_id"]
    task_embedding_id = task["embd_id"]
    task_language = task["language"]
    task_llm_id = task["llm_id"]
    task_dataset_id = task["kb_id"]
    task_doc_id = task["doc_id"]
    task_document_name = task["name"]
    task_parser_config = task["parser_config"]
    task_start_ts = timer()
```

从 `task` 对象里提取任务相关信息，task 的获取位于 collect 函数：

```python
async def collect(self):
  task = TaskService.get_task(msg["id"])
  task["task_type"] = msg.get("task_type", "")
```


task 包含如下字段:

| 字段名 | 类型 | 含义 |
|---|---|---|
| id | string | 任务 ID（`Task.id`） |
| doc_id | string | 文档 ID（关联 `Document.id`） |
| from_page | int | 起始页/行（含） |
| to_page | int | 结束页/行（不含或区间上限，依解析器语义） |
| retry_count | int | 当前任务重试次数 |
| kb_id | string | 知识库 ID（`Document.kb_id`） |
| parser_id | string | 文档解析器 ID（`Document.parser_id`） |
| parser_config | JSON | 文档级解析配置（`Document.parser_config`） |
| name | string | 文件名（`Document.name`） |
| type | string | 文件类型/扩展名（`Document.type`） |
| location | string | 文件存储位置/路径（`Document.location`） |
| size | int | 文件大小（字节，`Document.size`） |
| tenant_id | string | 租户 ID（来自 `Knowledgebase.tenant_id`） |
| language | string | 知识库语言（English/Chinese，`Knowledgebase.language`） |
| embd_id | string | 默认向量模型 ID（`Knowledgebase.embd_id`） |
| pagerank | int | 知识库 PageRank 值（`Knowledgebase.pagerank`） |
| kb_parser_config | JSON | 知识库级解析配置（`Knowledgebase.parser_config` 的别名） |
| img2txt_id | string | 默认图转文模型 ID（`Tenant.img2txt_id`） |
| asr_id | string | 默认语音识别模型 ID（`Tenant.asr_id`） |
| llm_id | string | 默认大模型 ID（`Tenant.llm_id`） |
| update_time | int | 任务更新时间（毫秒时间戳，`Task.update_time`） |

task 中比较特殊的是 task_type，他表示了文档处理的任务类型。

在 **RagFlow** 中，处理文档和知识的任务主要有三种类型：**RAPTOR、Graphrag、标准 Chunking**。

#### 1️⃣ 标准 Chunking（Standard Chunking）

**用途**：

* 将文档拆分成固定大小或规则的片段（chunk），生成向量表示（embedding），便于检索。

**特点**：

* 处理流程简单：文档 → 分块 → embedding → 存储。
* 不依赖 LLM 做复杂理解，只是机械拆分。
* 适合大部分基础向量检索场景。

**输出**：

* 文档 chunks
* 对应向量 embeddings

---

#### 2️⃣ RAPTOR

**用途**：

* 面向 **智能分块和知识增强** 的任务。
* 对文档进行 **语义理解**，提取更智能的块内容。

**特点**：

* 结合 **LLM（Chat）** 和 **Embedding 模型**。
* LLM 可以对文档进行 **摘要、关键字段提取、内容优化**，生成更智能的 chunks。
* 输出 chunks 的质量比标准 Chunking 高，向量表示更有语义信息。

**输出**：

* 智能化的文档 chunks
* 对应向量 embeddings
* 可能带有额外的语义标签或结构信息

---

#### 3️⃣ Graphrag

**用途**：

* 用于 **知识图谱构建任务**。
* 将文档/数据转为节点、边结构，便于做图检索、关系查询。

**特点**：

* 依赖 LLM 生成节点和边（实体关系）。
* 可选 `resolution` 或 `community` 配置，控制知识图谱细节。
* 不直接生成 chunks 用于向量检索，而是生成图结构。

**输出**：

* 知识图谱（节点 + 边）
* 可选 metadata（如实体类别、关系类型）

---

#### 4️⃣ 总结对比表

| 任务类型        | 是否用 LLM | 输出内容                  | 特点/用途                   |
| ----------- | ------- | --------------------- | ----------------------- |
| 标准 Chunking | 否       | 文档 chunks + embedding | 机械拆分文档，用于基础向量检索         |
| RAPTOR      | 是       | 智能 chunks + embedding | LLM增强的语义分块，质量更高，可提取关键字段 |
| Graphrag    | 是       | 知识图谱（节点/边）            | 构建知识图谱，适合做关系查询、图分析      |

### 1.2 进度回调和表格解析检查

```python
async def do_handle_task(task):
    # 使用 `partial` 绑定 `task_id` 和页码，方便更新任务进度。
    progress_callback = partial(set_progress, task_id, task_from_page, task_to_page)

    # Infinity 不支持 table parser，直接异常退出
    lower_case_doc_engine = settings.DOC_ENGINE.lower()
    if lower_case_doc_engine == 'infinity' and task['parser_id'].lower() == 'table':
        error_message = "Table parsing method is not supported by Infinity, please use other parsing methods or use Elasticsearch as the document engine."
        progress_callback(-1, msg=error_message)
        raise Exception(error_message)
    # 检查任务是否被取消，如果是则终止任务并通知用户。
    task_canceled = has_canceled(task_id)
    if task_canceled:
        progress_callback(-1, msg="Task has been canceled.")
        return
```


### 1.3 绑定向量模型和初始化知识库

```python
async def do_handle_task(task):
    try:
        # * 创建向量模型 `embedding_model`。
        embedding_model = LLMBundle(task_tenant_id, LLMType.EMBEDDING, llm_name=task_embedding_id, lang=task_language)
        # * `is_strong_enough` 检查模型能力。
        await is_strong_enough(None, embedding_model)
        # * 编码测试文本 `"ok"` 获取向量维度 `vector_size`。
        vts, _ = embedding_model.encode(["ok"])
        vector_size = len(vts[0])
    except Exception as e:
        error_message = f'Fail to bind embedding model: {str(e)}'
        progress_callback(-1, msg=error_message)
        logging.exception(error_message)
        raise 
    # * 根据任务信息初始化知识库环境（可能是 Elasticsearch/Infinity 的索引或本地存储）。
    # * `vector_size` 用于后续向量存储。
    # * 从 index_name 可以看到，每一个租户会创建一个知识库索引
    init_kb(task, vector_size)

def index_name(uid): return f"ragflow_{uid}"

def init_kb(row, vector_size: int):
    idxnm = search.index_name(row["tenant_id"])
    return settings.docStoreConn.createIdx(idxnm, row.get("kb_id", ""), vector_size)
```

LLMBundle 初始化存在以下调用链:

```python
LLMBundle.__init__
LLM4Tenant.__init__
    self.mdl = TenantLLMService.model_instance(tenant_id, llm_type, llm_name, lang=lang, **kwargs)
```

如何根据不同参数，实例化不同的模型，这个是我们关注的重点，标记为 1。

### 1.4 根据任务类型执行不同处理流程


```python
if task.get("task_type", "") == "raptor":
    ...
elif task.get("task_type", "") == "graphrag":
    ...
else:
    ...
```

#### RAPTOR 任务

* 绑定 Chat LLM。
* 在 `kg_limiter` 限流器下调用 `run_raptor` 生成知识片段。
* 输出 `chunks` 和 `token_count`。

#### Graphrag 任务

* 检查配置是否允许 Graphrag。
* 绑定 Chat LLM。
* 在 `kg_limiter` 下调用 `run_graphrag` 构建知识图谱。
* 完成后更新进度并返回。

#### Standard chunking 任务

* 使用 `build_chunks` 将文档切分成小片段（chunk）。
* 如果切分失败，更新进度并返回。
* 对每个 chunk 生成向量嵌入。
* 记录 token 数量和耗时

---

### 1.5 存储 chunks 并更新任务状态

```python
    chunk_count = len(set([chunk["id"] for chunk in chunks]))
    start_ts = timer()
    doc_store_result = ""

    async def delete_image(kb_id, chunk_id):
        try:
            # 异步删除 MinIO 中对应 chunk 的图片。
            async with minio_limiter:
                STORAGE_IMPL.delete(kb_id, chunk_id)
        except Exception:
            logging.exception(
                "Deleting image of chunk {}/{}/{} got exception".format(task["location"], task["name"], chunk_id))
            raise

        # * 按批次将 chunks 写入文档存储（比如 Elasticsearch 或 Infinity）。
        # * 每批写入后：
    
    for b in range(0, len(chunks), DOC_BULK_SIZE):    
        doc_store_result = await trio.to_thread.run_sync(lambda: settings.docStoreConn.insert(chunks[b:b + DOC_BULK_SIZE], search.index_name(task_tenant_id), task_dataset_id))
        task_canceled = has_canceled(task_id)
        # * 检查任务是否被取消。
        if task_canceled:
            progress_callback(-1, msg="Task has been canceled.")
            return
       
        if b % 128 == 0:
            progress_callback(prog=0.8 + 0.1 * (b + 1) / len(chunks), msg="")
        if doc_store_result:
            error_message = f"Insert chunk error: {doc_store_result}, please check log file and Elasticsearch/Infinity status!"
            progress_callback(-1, msg=error_message)
            raise Exception(error_message)
        chunk_ids = [chunk["id"] for chunk in chunks[:b + DOC_BULK_SIZE]]
        chunk_ids_str = " ".join(chunk_ids)
        try:
             # * 调用 `TaskService.update_chunk_ids` 更新 chunk ID。
            TaskService.update_chunk_ids(task["id"], chunk_ids_str)
        except DoesNotExist:
            logging.warning(f"do_handle_task update_chunk_ids failed since task {task['id']} is unknown.")
            doc_store_result = await trio.to_thread.run_sync(lambda: settings.docStoreConn.delete({"id": chunk_ids}, search.index_name(task_tenant_id), task_dataset_id))
            # * 出现异常时：

            #     * 删除已写入的 chunk
            #     * 删除对应图片（`delete_image`）。1
            async with trio.open_nursery() as nursery:
                for chunk_id in chunk_ids:
                    nursery.start_soon(delete_image, task_dataset_id, chunk_id)
            progress_callback(-1, msg=f"Chunk updates failed since task {task['id']} is unknown.")
            return

    logging.info("Indexing doc({}), page({}-{}), chunks({}), elapsed: {:.2f}".format(task_document_name, task_from_page,
                                                                                     task_to_page, len(chunks),
                                                                                     timer() - start_ts))
    # 调用 `DocumentService.increment_chunk_num` 更新文档的 chunk 总数和 token 总数。
    DocumentService.increment_chunk_num(task_doc_id, task_dataset_id, token_count, chunk_count, 0)

    time_cost = timer() - start_ts
    task_time_cost = timer() - task_start_ts
    progress_callback(prog=1.0, msg="Indexing done ({:.2f}s). Task done ({:.2f}s)".format(time_cost, task_time_cost))
    logging.info(
        "Chunk doc({}), page({}-{}), chunks({}), token({}), elapsed:{:.2f}".format(task_document_name, task_from_page,
                                                                                   task_to_page, len(chunks),
                                                                                   token_count, task_time_cost))
```


## 2. standard chunking 任务执行流程
不同的 task_type 有不同的执行流程，这里我们先来看最简单的 standard chunking 任务。

standard chunking 执行了两步:
1. build_chunks
2. embedding

```python
    else:
        # Standard chunking methods
        start_ts = timer()
        chunks = await build_chunks(task, progress_callback)
        logging.info("Build document {}: {:.2f}s".format(task_document_name, timer() - start_ts))
        if not chunks:
            progress_callback(1., msg=f"No chunk built from {task_document_name}")
            return
        # TODO: exception handler
        ## set_progress(task["did"], -1, "ERROR: ")
        progress_callback(msg="Generate {} chunks".format(len(chunks)))
        start_ts = timer()
        try:
            token_count, vector_size = await embedding(chunks, embedding_model, task_parser_config, progress_callback)
        except Exception as e:
            error_message = "Generate embedding error:{}".format(str(e))
            progress_callback(-1, error_message)
            logging.exception(error_message)
            token_count = 0
            raise
        progress_message = "Embedding chunks ({:.2f}s)".format(timer() - start_ts)
        logging.info(progress_message)
        progress_callback(msg=progress_message)
```

### 2.1 build_chunks
这里我们还是借助 ChatGpt。

`build_chunks` 是一个 **异步文档切分、存储、关键词/问题生成和打标签的完整任务处理函数**。它在前面 `do_handle_task` 中被调用，用于把文档拆成 chunks 并处理。

---

#### 1️⃣ 函数签名与大小检查

```python
@timeout(60*80, 1)
async def build_chunks(task, progress_callback):
    if task["size"] > DOC_MAXIMUM_SIZE:
        set_progress(task["id"], prog=-1, msg="File size exceeds( <= %dMb )" % (int(DOC_MAXIMUM_SIZE / 1024 / 1024)))
        return []
```

* 使用 `@timeout` 装饰器限制最大执行时间（这里 80 分钟）。
* 检查文档大小是否超过系统最大限制，超过则直接返回空列表，并更新进度。

---

#### 2️⃣ 获取文件内容

```python
bucket, name = File2DocumentService.get_storage_address(doc_id=task["doc_id"])
binary = await get_storage_binary(bucket, name)
```

* 获取文档在 MinIO 或存储系统中的位置。
* 异步下载文档二进制数据。
* 异常处理

    * `TimeoutError` → 下载超时，更新进度并抛异常。
    * 文件不存在 → 更新进度提示用户找不到文件。
    * 其他异常 → 通用报错处理。

文件如何上传，如何下载，这个是我们关注的重点，标记为 2。


#### 3️⃣ 文档切分（chunking）

```python
chunker = FACTORY[task["parser_id"].lower()]
async with chunk_limiter:
    cks = await trio.to_thread.run_sync(lambda: chunker.chunk(...))
```
* 根据任务解析器 ID 选择 `chunker`（不同类型文档使用不同解析方法）。

如何根据文档的类型选择不同的 chunker，以及如何 chunk，这个是我们关注的重点，标记为 3。

---

#### 4️⃣ 准备 chunks 元数据

```python
docs = []
doc = {
    "doc_id": task["doc_id"],
    "kb_id": str(task["kb_id"])
}
if task["pagerank"]:
    doc[PAGERANK_FLD] = int(task["pagerank"])
```

* 为每个 chunk 准备基础元数据。
* 如果任务中有 `pagerank` 字段，则存储。

---

#### 5️⃣ 上传 chunks 中的图片到 MinIO

```python
async def upload_to_minio(document, chunk):
    ...
```


#### 6️⃣ 关键词生成（可选）

```python
if task["parser_config"].get("auto_keywords", 0):
    ...
```

* 为每个 chunk 生成关键词：

  * 检查缓存
  * 如果没有缓存，调用 LLM（通过线程阻塞执行）
  * 更新缓存并将关键词存入 chunk 元数据
  * 使用 `trio.open_nursery` 并发处理多个 chunk

---

#### 7️⃣ 问题生成（可选）

```python
if task["parser_config"].get("auto_questions", 0):
    ...
```

* 类似关键词生成，为每个 chunk 自动生成问题。
* 调用 LLM 生成问题。
* 缓存结果并更新 chunk 元数据。

---

#### 8️⃣ 文档内容打标签（可选）


```python
if task["kb_parser_config"].get("tag_kb_ids", []):
    ...
```

* 获取 KB 中已有标签。
* 遍历 chunks：

  * 调用 `retrievaler.tag_content` 根据内容打标签
  * 如果没有标签，加入 `docs_to_tag`
* 异步调用 LLM 进行内容打标签，并缓存结果：

  * 使用少量示例 `examples` 提供上下文
  * 并发处理每个 chunk

---

### 2.2 RAG 增强
到这里，其实我不太明白，**关键词生成、问题生成、文档内容打标签** 是干什么的，所以我们向 ChatGpt 提了一个问题:

```bash
能不能给我介绍一下 ragflow 中 关键词生成、问题生成、文档内容打标签 的背景，是干什么的
```

**关键词生成**、**问题生成**、**文档内容打标签**，其实都是 **RAG（Retrieval-Augmented Generation）** 系统中很重要的“增强检索与问答体验”的功能。

---

#### 背景：RAG 的核心问题

RAG 的目标是：

1. 用户提问（Query）
2. 系统在知识库里找到相关文档片段（Chunks）
3. 把这些片段喂给大模型，生成回答

但是这里面有两个挑战：

* **检索精度**：如何保证 query 能准确匹配到合适的文档片段？
* **表达差异**：用户的提问方式和文档原文不一样，单靠向量相似度有时匹配不到。

所以，RAGFlow 里引入了 **关键词生成、问题生成、标签生成** 这类 **辅助增强策略**。

---

#### 🔑 (1) 关键词生成（auto_keywords）

* **做什么**：对每个文档片段自动提取一组关键短语/关键词。
* **目的**：

  * 作为辅助索引：除了 embedding，还可以用关键词（倒排索引）快速筛选候选文档。
  * 提升召回率：当用户 query 里包含关键词时，可以直接快速匹配。
  * 帮助主题聚类或可视化。

👉 举例：
文档片段：

> “RAGFlow 支持从 MinIO 加载文档，并进行分块处理。”
> 自动生成关键词：
> `["RAGFlow", "MinIO", "文档分块"]`

---

#### ❓ (2) 问题生成（auto_questions）

* **做什么**：基于文档片段，自动生成一组“可能的问题”。
* **目的**：

  * 模拟用户提问，提前准备好 Query–Chunk 的映射，提升 **query–chunk 匹配能力**。
  * 作为训练数据，用于训练 / 微调 embedding 模型或 reranker。
  * 让系统更好支持多样化的问法。

👉 举例：
文档片段：

> “RAGFlow 可以自动提取关键词来增强检索。”
> 自动生成问题：

* “RAGFlow 如何增强检索？”
* “它支持关键词提取吗？”

这样，用户问 “RAGFlow 怎么做检索增强？” 时，即使 embedding 没有完全匹配，系统也能通过问题扩展找到相关片段。

---

#### 🏷 (3) 文档内容打标签（content tagging）

* **做什么**：对每个文档片段，自动打上主题标签（Tag），可能是类别、领域、功能等。
* **目的**：

  * 让文档有更清晰的分类体系，支持 **按主题过滤/检索**。
  * 提升知识库可解释性（用户/运营能看到文档的语义分类）。
  * 在多知识库、多领域场景下，用标签区分语境。

👉 举例：
文档片段：

> “RAGFlow 支持向量检索和关键词检索混合。”
> 打标签结果：
> `{"检索": 0.9, "RAGFlow功能": 0.8}`

这样，在用户 query “混合检索” 时，即使文本 embedding 不完全对齐，也可以借助标签匹配。

---

#### 应用场景

* **知识库建设**：大批文档自动处理，生成关键词/标签/问题，减少人工标注。
* **检索增强**：结合向量搜索（语义）+ 关键词搜索（精确）+ 标签搜索（分类），提升准确率。
* **可视化管理**：让运营人员能按关键词、标签、问题来查看和维护知识库。
* **多模态扩展**：比如图片块、表格块也能生成关键词/标签，方便后续检索。

---

✅ **总结**：
在 RAGFlow 中：

* **关键词生成** → 提升检索覆盖面
* **问题生成** → 提升 query–chunk 匹配能力
* **内容打标签** → 提升文档组织和检索精度

它们的核心价值就是：**让用户提问和知识库里的文档之间的语义鸿沟更小，检索更准，回答更好。**

显然**关键词生成**、**问题生成**、**文档内容打标签**，这个是我们关注的重点，标记为 4。

### 2.3 embedding
如何根据前面生成的所有的内容做 embedding，这个必须等到我们了解了前面的内容才能理解。这个是我们关注的重点，标记为 5。

至此，我们标记了 5 个问题:
1. `TenantLLMService.model_instance` 如何实例化模型
2. 如何根据文档的类型选择不同的 chunker
3. **关键词生成**、**问题生成**、**文档内容打标签** 的执行流程
4. 如何 embedding
2. 文件如何上传，如何下载。更一步是解析后的 chunk 如何在 MinIO 和 ES 中存储


下面是我通过断点，获取的一个 task 参数，以及整理的核心调用链的执行过程:

```python
{
	'id': '4d60226c7fde11f08e4c99abb39df9de',
	'doc_id': '6f4757087f7311f088ac639e5785ef57',
	'from_page': 0,
	'to_page': 100000000,
	'retry_count': 0,
	'kb_id': 'a37e77f87f6f11f088ac639e5785ef57',
	'parser_id': 'naive',
	'parser_config': {
		'pages': [...]
	},
	'name': '47_langgraph_summary.md',
	'type': 'doc',
	'location': '47_langgraph_summary.md',
	'size': 35828,
	'tenant_id': '4d6e8fd47f6e11f088ac639e5785ef57',
	'language': 'Chinese',
	'embd_id': 'BAAI/bge-large-zh-v1.5@BAAI',
	'pagerank': 0,
	'kb_parser_config': {
		'pages': [...]
	},
	'img2txt_id': '',
	'asr_id': '',
	'llm_id': '',
	'update_time': 1755925320629,
	'task_type': ''
}


```

调用链:

```python
# 实例化 embedding_model
embedding_model = LLMBundle(
            tenant_id="4d6e8fd47f6e11f088ac639e5785ef57",
            llm_type="embedding",
            llm_name="BAAI/bge-large-zh-v1.5@BAAI",
            lang="Chinese",
        )
    LLM4Tenant.__init___
        self.mdl = TenantLLMService.model_instance(tenant_id, llm_type, llm_name, lang=lang, **kwargs)
            # 获取模型配置
            model_config = TenantLLMService.get_model_config(tenant_id, llm_type, llm_name)
            # 加载模型
            EmbeddingModel[model_config["llm_factory"]](model_config["api_key"], model_config["llm_name"], base_url=model_config["api_base"])
        model_config = TenantLLMService.get_model_config(tenant_id, llm_type, llm_name)

# 分块
chunks = await build_chunks(task, progress_callback)
    # bucket=kb_id, name=47_langgraph_summary.md
    bucket, name = File2DocumentService.get_storage_address(doc_id=task["doc_id"])
    # 从 minio 中下载 47_langgraph_summary.md
    binary = await get_storage_binary(bucket, name)

    # 获取文件解析器
    chunker = FACTORY[task["parser_id"].lower()]
    # naive.chunk 会根据文件名中的文件类型，实例化不同的 parser 进行chunk
    chunker.chunk(
                    task["name"],
                    binary=binary,
                    from_page=task["from_page"],
                    to_page=task["to_page"],
                    lang=task["language"],
                    callback=progress_callback,
                    kb_id=task["kb_id"],
                    parser_config=task["parser_config"],
                    tenant_id=task["tenant_id"],
                )
    upload_to_minio
    doc_question_proposal
    doc_content_tagging
embedding
```
