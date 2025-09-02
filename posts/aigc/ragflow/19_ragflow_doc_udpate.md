---
weight: 1
title: "RagFlow embedding 和结果上传"
date: 2025-08-20T17:00:00+08:00
lastmod: 2025-08-20T17:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "RagFlow 增强 Rag"
featuredImage: 

tags: ["RagFlow"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

上一节我们讲解了 Ragflow 增强的相关内容。这一节我们讲解文档 embedding 和结果上传相关的内容。


## 1. 内容回顾
前面我们整理了 ragflow 文档处理的调用链。

```python
if task.get("task_type", "") == "raptor":
    chunks, token_count = await run_raptor(task, chat_model, embedding_model, vector_size, progress_callback)
elif task.get("task_type", "") == "graphrag":
    await run_graphrag(task, task_language, with_resolution, with_community, chat_model, embedding_model, progress_callback)
    return
else:
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
        # ragflow 增强
        doc_keyword_extraction
        doc_question_proposal
        doc_content_tagging
    embedding
# 文档更新
settings.docStoreConn.insert(chunks)
TaskService.update_chunk_ids(task["id"], chunk_ids_str)
DocumentService.increment_chunk_num(task_doc_id, task_dataset_id, token_count, chunk_count, 0)
```

从调用链可以看到，标准处理流程我们还有以下内容未介绍:
1. upload_to_minio
2. embedding
3. 文档更新和元数据更新

这一节我们来介绍剩下这部分内容。

## 2. upload_to_minio
这段代码的作用是：
1. 遍历文档切片 (chunk)，构造唯一 ID 和时间戳；
2. 如果有图片，转换成 JPEG 格式后上传到 MinIO 对象存储；
3. 上传成功后，设置 img_id 作为对象存储的唯一标识 `d["img_id"] = "{}-{}".format(task["kb_id"], d["id"])`


```python
    docs = []
    doc = {
        "doc_id": task["doc_id"],
        "kb_id": str(task["kb_id"])
    }
    if task["pagerank"]:
        doc[PAGERANK_FLD] = int(task["pagerank"])

    @timeout(60)  # 给函数设置超时 60 秒，避免单个任务卡死
    async def upload_to_minio(document, chunk):
        try:
            d = copy.deepcopy(document)      # 深拷贝原始文档，避免修改原对象
            d.update(chunk)                  # 合并当前 chunk 信息到文档副本
            # 使用文档内容+doc_id 生成唯一 ID（xxhash 性能高于 MD5/SHA）
            d["id"] = xxhash.xxh64((chunk["content_with_weight"] + str(d["doc_id"])).encode("utf-8", "surrogatepass")).hexdigest()
            d["create_time"] = str(datetime.now()).replace("T", " ")[:19]  # 生成当前时间字符串（格式: YYYY-MM-DD HH:MM:SS）
            d["create_timestamp_flt"] = datetime.now().timestamp()         # Unix 时间戳（浮点数）

            # 如果没有图片字段，直接写入 docs 列表并返回
            if not d.get("image"):
                _ = d.pop("image", None)  # 移除 image 字段（如果有）
                d["img_id"] = ""          # 设置空的图像 ID
                docs.append(d)            # 将文档加入 docs（等待后续写入存储/索引）
                return

            output_buffer = BytesIO()  # 创建内存缓冲区，用于保存图像数据
            try:
                if isinstance(d["image"], bytes):
                    # 如果 image 已经是字节流，直接写入缓冲区
                    output_buffer.write(d["image"])
                    output_buffer.seek(0)
                else:
                    # 如果是 Pillow 图像对象，且为 RGBA 或 P 模式，先转为 RGB
                    if d["image"].mode in ("RGBA", "P"):
                        converted_image = d["image"].convert("RGB")
                        # d["image"].close()  # 原图可关闭释放内存（此处注释掉了）
                        d["image"] = converted_image
                    try:
                        # 保存为 JPEG 格式到缓冲区
                        d["image"].save(output_buffer, format='JPEG')
                    except OSError as e:
                        # 如果保存失败，记录警告日志，但不中断流程
                        logging.warning(
                            "Saving image of chunk {}/{}/{} got exception, ignore: {}".format(
                                task["location"], task["name"], d["id"], str(e))
                        )

                # 受 minio_limiter 限流保护，异步上传图片到 MinIO（对象存储）
                async with minio_limiter:
                    await trio.to_thread.run_sync(lambda: STORAGE_IMPL.put(task["kb_id"], d["id"], output_buffer.getvalue()))

                # 上传成功后，设置 img_id 作为对象存储的唯一标识
                d["img_id"] = "{}-{}".format(task["kb_id"], d["id"])
                # 如果 image 是 Pillow 对象，关闭文件句柄释放内存
                if not isinstance(d["image"], bytes):
                    d["image"].close()
                # 删除 image 引用（避免把图像对象存进数据库/索引里）
                del d["image"]
                # 将处理好的文档追加到 docs 列表
                docs.append(d)
            finally:
                # 确保缓冲区无论成功失败都能关闭，避免内存泄漏
                output_buffer.close()
        except Exception:
            # 捕获所有异常并记录日志，带上 chunk 的位置信息，方便排查
            logging.exception(
                "Saving image of chunk {}/{}/{} got exception".format(task["location"], task["name"], d["id"]))
            raise  # 继续抛出异常，交由上层处理

    # 使用 trio 的并发任务组（nursery），并发处理多个 chunk 的上传
    async with trio.open_nursery() as nursery:
        for ck in cks:
            # 对每个 chunk 启动一个上传任务
            nursery.start_soon(upload_to_minio, doc, ck)

```

### 2.1 对象存储
对象存储是可配置的，默认为 Minio

```python
class Storage(Enum):
    MINIO = 1
    AZURE_SPN = 2
    AZURE_SAS = 3
    AWS_S3 = 4
    OSS = 5
    OPENDAL = 6


class StorageFactory:
    storage_mapping = {
        Storage.MINIO: RAGFlowMinio,
        Storage.AZURE_SPN: RAGFlowAzureSpnBlob,
        Storage.AZURE_SAS: RAGFlowAzureSasBlob,
        Storage.AWS_S3: RAGFlowS3,
        Storage.OSS: RAGFlowOSS,
        Storage.OPENDAL: OpenDALStorage
    }

    @classmethod
    def create(cls, storage: Storage):
        return cls.storage_mapping[storage]()


STORAGE_IMPL_TYPE = os.getenv('STORAGE_IMPL', 'MINIO')
STORAGE_IMPL = StorageFactory.create(Storage[STORAGE_IMPL_TYPE])
```


| 枚举值         | 存储系统/方式     | 鉴权方式              | 特点            | 常见场景      |
| ----------- | ----------- | ----------------- | ------------- | --------- |
| `MINIO`     | MinIO       | Access Key/Secret | **开源自建**，S3 兼容    | 私有化对象存储   |
| `AZURE_SPN` | Azure Blob  | Service Principal | 长期有效、后端安全     | 服务间通信     |
| `AZURE_SAS` | Azure Blob  | SAS Token         | 临时访问、权限可控     | 前端/外部上传下载 |
| `AWS_S3`    | Amazon S3   | Access Key/Secret | 全球最常用、业界标准    | 云存储、AI 数据 |
| `OSS`       | 阿里云 OSS     | Access Key/Secret | 国内云厂商，和阿里生态紧密 | 国内业务      |
| `OPENDAL`   | **OpenDAL 抽象层** | 依赖底层存储            | 跨云统一 API      | 多存储适配     |


## 3. embedding
embedding:
1. 优先使用 question_kwd 作为内容的向量，没有 question_kwd 时，使用 content_with_weight 作为内容的向量
2. 最终向量 = docnm_kwd 向量 * 权重 + 内容向量 * (1 - 权重)
3. 向量保存在 `q_{向量维度}_vec` 这样的 key 中

```python
async def do_handle_task(task):
    else:
        # Standard chunking methods
        try:
            token_count, vector_size = await embedding(chunks, embedding_model, task_parser_config, progress_callback)
        except Exception as e:
            pass


async def embedding(docs, mdl, parser_config=None, callback=None):
    # docs: 待处理的文档列表，每个元素是一个 dict，包含文档内容、标题、关键词等信息
    # mdl:   向量化模型（支持 .encode() 方法，比如 sentence-transformers）
    # parser_config: 配置字典（可选），主要用于控制 filename_embd_weight 权重
    # callback: 回调函数（可选），用于在处理过程中上报进度
    
    if parser_config is None:
        parser_config = {}

    # tts: 存放文档标题（或 docnm_kwd 字段）
    # cnts: 存放文档内容（或问题关键词 / 正文内容）
    tts, cnts = [], []
    for d in docs:
        # docnm_kwd 是文件名，如果没有 docnm_kwd，则默认用 "Title"
        tts.append(d.get("docnm_kwd", "Title"))

        # question_kwd 是问题关键词列表，将其拼接成字符串
        c = "\n".join(d.get("question_kwd", []))
        if not c:
            # 如果没有 question_kwd，就用正文内容（content_with_weight）
            c = d["content_with_weight"]

        # 去掉 HTML 表格相关标签（table, td, caption, tr, th）
        c = re.sub(r"</?(table|td|caption|tr|th)( [^<>]{0,12})?>", " ", c)
        if not c:
            c = "None"
        cnts.append(c)

    tk_count = 0  # 累计 token 数量，用于统计消耗
    if len(tts) == len(cnts):
        # 先对第一个标题做 encode，得到 embedding 和 token 数
        vts, c = await trio.to_thread.run_sync(lambda: mdl.encode(tts[0: 1]))
        # 将该向量复制成与文档数相同的矩阵（即所有标题向量相同）
        tts = np.concatenate([vts for _ in range(len(tts))], axis=0)
        tk_count += c

    @timeout(60)
    def batch_encode(txts):
        """分批编码文本，避免超过模型最大长度"""
        nonlocal mdl
        return mdl.encode([truncate(c, mdl.max_length - 10) for c in txts])

    cnts_ = np.array([])  # 存放所有内容向量
    # 分批处理正文内容，避免一次性输入过多
    for i in range(0, len(cnts), EMBEDDING_BATCH_SIZE):
        async with embed_limiter:  # 限流，避免并发过多
            vts, c = await trio.to_thread.run_sync(lambda: batch_encode(cnts[i: i + EMBEDDING_BATCH_SIZE]))
        if len(cnts_) == 0:
            cnts_ = vts
        else:
            # vts 是某一批正文内容的向量（形状 (batch_size, 768)）
            # cnts_ 是所有内容向量的累积
            # 最终得到所有文档的正文向量矩阵 (len(cnts), 768)
            cnts_ = np.concatenate((cnts_, vts), axis=0)
        tk_count += c
        # 回调进度，范围在 [0.7, 0.9] 左右
        callback(prog=0.7 + 0.2 * (i + 1) / len(cnts), msg="")
    cnts = cnts_

    # 文件名向量的权重（默认 0.1）
    filename_embd_weight = parser_config.get("filename_embd_weight", 0.1)  # 数据库不支持 None，这里做兜底
    if not filename_embd_weight:
        filename_embd_weight = 0.1
    title_w = float(filename_embd_weight)

    # 最终向量 = title 向量 * 权重 + 内容向量 * (1 - 权重)
    # 如果标题向量和内容向量数量一致，就加权融合，否则只用内容向量
    vects = (title_w * tts + (1 - title_w) * cnts) if len(tts) == len(cnts) else cnts

    assert len(vects) == len(docs)

    vector_size = 0
    # 将向量结果写回到 docs 中
    for i, d in enumerate(docs):
        v = vects[i].tolist()
        vector_size = len(v)
        # 存储为 "q_{向量维度}_vec" 这样的 key
        d["q_%d_vec" % len(v)] = v

    # 返回总 token 数 + 向量维度
    return tk_count, vector_size
```

## 4. 文档更新

```python
async def do_handle_task(task):
    # 统计当前文档切分后的唯一 chunk 数量
    chunk_count = len(set([chunk["id"] for chunk in chunks]))
    # 记录任务起始时间（用于耗时统计）
    start_ts = timer()
    # 初始化存储结果
    doc_store_result = ""

    # 定义一个异步函数：删除 MinIO 中存储的图片
    async def delete_image(kb_id, chunk_id):
        try:
            async with minio_limiter:  # 控制并发，避免对 MinIO 造成过大压力
                STORAGE_IMPL.delete(kb_id, chunk_id)
        except Exception:
            logging.exception(
                "Deleting image of chunk {}/{}/{} got exception".format(task["location"], task["name"], chunk_id))
            raise

    # 分批处理 chunks，避免一次性插入过多数据（按 DOC_BULK_SIZE 批次）
    for b in range(0, len(chunks), DOC_BULK_SIZE):
        # 调用 docStoreConn.insert 将当前批次的 chunks 插入到存储/索引系统（可能是 Elasticsearch/Infinity）
        doc_store_result = await trio.to_thread.run_sync(
            lambda: settings.docStoreConn.insert(
                chunks[b:b + DOC_BULK_SIZE],
                search.index_name(task_tenant_id),
                task_dataset_id
            )
        )

        # 检查任务是否被取消
        task_canceled = has_canceled(task_id)
        if task_canceled:
            progress_callback(-1, msg="Task has been canceled.")  # 上报任务被取消
            return

        # 每处理 128 批，更新一次进度条（0.8 ~ 0.9 区间）
        if b % 128 == 0:
            progress_callback(prog=0.8 + 0.1 * (b + 1) / len(chunks), msg="")

        # 如果插入失败，报错并终止任务
        if doc_store_result:
            error_message = f"Insert chunk error: {doc_store_result}, please check log file and Elasticsearch/Infinity status!"
            progress_callback(-1, msg=error_message)
            raise Exception(error_message)

        # 取出当前已经插入的 chunk 的 id 列表，并拼接成字符串
        chunk_ids = [chunk["id"] for chunk in chunks[:b + DOC_BULK_SIZE]]
        chunk_ids_str = " ".join(chunk_ids)

        try:
            # 更新任务服务中的 chunk 记录
            TaskService.update_chunk_ids(task["id"], chunk_ids_str)
        except DoesNotExist:
            # 如果任务不存在，说明 task 已被删除或异常终止
            logging.warning(f"do_handle_task update_chunk_ids failed since task {task['id']} is unknown.")
            # 回滚：删除刚才插入的 chunks
            doc_store_result = await trio.to_thread.run_sync(
                lambda: settings.docStoreConn.delete(
                    {"id": chunk_ids},
                    search.index_name(task_tenant_id),
                    task_dataset_id
                )
            )
            # 同时删除 MinIO 里的相关图片
            async with trio.open_nursery() as nursery:
                for chunk_id in chunk_ids:
                    nursery.start_soon(delete_image, task_dataset_id, chunk_id)
            # 上报失败
            progress_callback(-1, msg=f"Chunk updates failed since task {task['id']} is unknown.")
            return

    # 记录日志：索引完成（包含文档名、页码范围、chunk 数量、耗时）
    logging.info("Indexing doc({}), page({}-{}), chunks({}), elapsed: {:.2f}".format(
        task_document_name, task_from_page, task_to_page, len(chunks), timer() - start_ts
    ))

    # 更新文档服务中的统计信息（chunk 数量、token 数等）
    DocumentService.increment_chunk_num(
        task_doc_id, task_dataset_id, token_count, chunk_count, 0
    )

    # 计算耗时
    time_cost = timer() - start_ts          # 当前阶段耗时
    task_time_cost = timer() - task_start_ts  # 整个任务耗时

    # 上报任务完成
    progress_callback(
        prog=1.0,
        msg="Indexing done ({:.2f}s). Task done ({:.2f}s)".format(time_cost, task_time_cost)
    )

    # 记录最终日志
    logging.info(
        "Chunk doc({}), page({}-{}), chunks({}), token({}), elapsed:{:.2f}".format(
            task_document_name, task_from_page, task_to_page,
            len(chunks), token_count, task_time_cost
        )
    )
```

### 4.1 文档更新
以 es 的更新为例，更新过程的元数据如下:

```python
    def insert(self, documents: list[dict], indexName: str, knowledgebaseId: str = None) -> list[str]:
        # Refers to https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-bulk.html
        operations = []
        for d in documents:
            assert "_id" not in d
            assert "id" in d
            d_copy = copy.deepcopy(d)
            d_copy["kb_id"] = knowledgebaseId
            meta_id = d_copy.pop("id", "tenant_id")
            operations.append(
                # index_name=ragflow_{uid}
                {"index": {"_index": indexName, "_id": meta_id}})
            operations.append(d_copy)
```

### 4.2 文档元数据更新
元数据包括:
1. `TaskService.update_chunk_ids`: 更新 task 表的 chunk_ids 字段
2. `DocumentService.increment_chunk_num`
    - 更新 doucument 表，token_num、chunk_num
    - 更新 knowledgebase 表，token_num、chunk_num


## 5. 总结
