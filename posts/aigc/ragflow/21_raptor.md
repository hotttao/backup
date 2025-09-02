---
weight: 1
title: "RagFlow Raptor 召回增强"

date: 2025-08-20T11:00:00+08:00
lastmod: 2025-08-20T11:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "RagFlow Raptor 召回增强"
featuredImage: 

tags: ["RagFlow"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

在 **RagFlow** 中，处理文档和知识的任务主要有三种类型：**RAPTOR、Graphrag、标准 Chunking**。前面我们学习了标准 chunk 的执行过程。从这一节开始我们来介绍 RAPTOR。

## 1. RAPTOR 执行入口


1. 获取原始文档 chunk 并提取文本与向量。
2. 初始化 RAPTOR 模块，用于聚类和增强生成。
3. 对 chunk 进行处理生成新的片段。
4. 将生成的 chunk 构造成可存储的字典，包括向量、分词、时间戳、ID 等信息。
5. 返回 chunk 列表和 token 总数，用于后续存储或统计。

```python
async def run_raptor(row, chat_mdl, embd_mdl, vector_size, callback=None):
    """
    异步运行 RAPTOR 聚类与增强生成任务，将文档内容切分、编码后进行聚类或向量处理，生成可存储的 chunk 数据。

    参数说明：
    - row: dict, 包含单个文档的元信息，如 doc_id, kb_id, tenant_id, parser_config 等。
    - chat_mdl: LLM 模型实例，用于生成或处理文本。
    - embd_mdl: 向量化模型实例，用于将文本编码为向量。
    - vector_size: int，向量维度，用于从文档 chunk 中获取对应向量字段。
    - callback: 可选回调函数，用于任务进度回调。
    
    返回值：
    - res: list[dict]，每个 dict 是一个处理后的 chunk，包含向量、分词、时间戳等信息。
    - tk_count: int，文本 token 总数，用于统计或计费。
    """

    # 1️⃣ 压力测试：检查 chat_mdl 和 embd_mdl 是否可用、性能是否满足要求
    await is_strong_enough(chat_mdl, embd_mdl)

    # 2️⃣ 从检索器中获取原始文档的 chunk
    chunks = []
    vctr_nm = "q_%d_vec"%vector_size  # 构造向量字段名，如 "q_1536_vec"
    for d in settings.retrievaler.chunk_list(
            row["doc_id"],
            row["tenant_id"],
            [str(row["kb_id"])],
            fields=["content_with_weight", vctr_nm]  # 返回文本内容和向量
    ):
        # 每个 chunk 存储为 (文本, 向量) 的元组
        chunks.append((d["content_with_weight"], np.array(d[vctr_nm])))

    # 3️⃣ 初始化 RAPTOR 聚类/增强生成实例
    raptor = Raptor(
        row["parser_config"]["raptor"].get("max_cluster", 64),  # 最大聚类数
        chat_mdl,  # LLM
        embd_mdl,  # 向量化模型
        row["parser_config"]["raptor"]["prompt"],  # 生成 prompt
        row["parser_config"]["raptor"]["max_token"],  # 最大生成 token 数
        row["parser_config"]["raptor"]["threshold"]  # 聚类或相似度阈值
    )

    original_length = len(chunks)  # 记录原始 chunk 数量

    # 4️⃣ 调用 RAPTOR 对 chunks 进行聚类或增强生成，返回新的 chunk 列表
    chunks = await raptor(chunks, row["parser_config"]["raptor"]["random_seed"], callback)

    # 5️⃣ 构造基础文档信息，用于每个新 chunk 的复制
    doc = {
        "doc_id": row["doc_id"],
        "kb_id": [str(row["kb_id"])],
        "docnm_kwd": row["name"],
        "title_tks": rag_tokenizer.tokenize(row["name"])  # 文档名分词
    }
    if row["pagerank"]:
        doc[PAGERANK_FLD] = int(row["pagerank"])  # 可选 pagerank 字段

    # 6️⃣ 遍历新生成的 chunk，构造可存储的字典对象
    res = []
    tk_count = 0
    for content, vctr in chunks[original_length:]:  # 仅处理新生成的 chunk
        d = copy.deepcopy(doc)  # 复制基础文档信息
        # 生成唯一 ID
        d["id"] = xxhash.xxh64((content + str(d["doc_id"])).encode("utf-8")).hexdigest()
        # 记录时间戳
        d["create_time"] = str(datetime.now()).replace("T", " ")[:19]
        d["create_timestamp_flt"] = datetime.now().timestamp()
        # 添加向量字段
        d[vctr_nm] = vctr.tolist()
        # 添加文本字段
        d["content_with_weight"] = content
        d["content_ltks"] = rag_tokenizer.tokenize(content)  # 粗粒度分词
        d["content_sm_ltks"] = rag_tokenizer.fine_grained_tokenize(d["content_ltks"])  # 细粒度分词
        res.append(d)
        # 累加 token 数
        tk_count += num_tokens_from_string(content)

    # 7️⃣ 返回最终 chunk 列表和 token 总数
    return res, tk_count

```


## 2. RAPTOR 召回增强

1. 使用 **UMAP 降维 + GaussianMixture 聚类** 对文档 chunk 进行层级聚类。
2. 每个聚类生成 **抽象摘要**（LLM），再编码为向量作为新的 chunk。
3. 对少量 chunk 特殊处理（仅 2 个直接生成摘要）。
4. 支持缓存机制，减少重复计算 LLM 输出和向量编码。
5. 支持回调，实时反馈聚类进度。

```python
class RecursiveAbstractiveProcessing4TreeOrganizedRetrieval:
    """
    递归式摘要聚类处理类，用于对树形组织的文档检索结果进行聚类与抽象生成。
    主要功能：
      1. 将原始文档 chunk 转化为向量表示；
      2. 使用 UMAP 降维 + 高斯混合聚类进行多层聚类；
      3. 对每个聚类生成摘要（abstractive summary）并加入 chunks；
      4. 返回增强后的 chunk 列表。
    """

    def __init__(
        self, max_cluster, llm_model, embd_model, prompt, max_token=512, threshold=0.1
    ):
        """
        初始化处理器

        参数：
        - max_cluster: int，单层聚类最大簇数
        - llm_model: LLM 模型，用于生成摘要文本
        - embd_model: 向量化模型，将文本转成向量
        - prompt: str，用于 LLM 的生成模板
        - max_token: int，LLM 最大输出 token
        - threshold: float，GaussianMixture 聚类概率阈值
        """
        self._max_cluster = max_cluster
        self._llm_model = llm_model
        self._embd_model = embd_model
        self._threshold = threshold
        self._prompt = prompt
        self._max_token = max_token

    @timeout(60)
    async def _chat(self, system, history, gen_conf):
        """
        调用 LLM 生成摘要或文本
        1. 尝试从缓存读取结果
        2. 如果缓存不存在，通过 LLM 生成
        3. 对生成文本做简单清理
        4. 将结果缓存
        """
        response = get_llm_cache(self._llm_model.llm_name, system, history, gen_conf)
        if response:
            return response
        response = await trio.to_thread.run_sync(
            lambda: self._llm_model.chat(system, history, gen_conf)
        )
        response = re.sub(r"^.*</think>", "", response, flags=re.DOTALL)
        if response.find("**ERROR**") >= 0:
            raise Exception(response)
        set_llm_cache(self._llm_model.llm_name, system, response, history, gen_conf)
        return response

    @timeout(2)
    async def _embedding_encode(self, txt):
        """
        将文本编码为向量
        1. 尝试从缓存读取
        2. 调用 embd_model.encode 生成向量
        3. 将向量缓存
        """
        response = get_embed_cache(self._embd_model.llm_name, txt)
        if response is not None:
            return response
        embds, _ = await trio.to_thread.run_sync(lambda: self._embd_model.encode([txt]))
        if len(embds) < 1 or len(embds[0]) < 1:
            raise Exception("Embedding error: ")
        embds = embds[0]
        set_embed_cache(self._embd_model.llm_name, txt, embds)
        return embds

    def _get_optimal_clusters(self, embeddings: np.ndarray, random_state: int):
        """
        使用 BIC（贝叶斯信息准则）寻找最佳聚类数
        1. 尝试从 1 到 max_clusters 的聚类数
        2. 对每个聚类数使用 GaussianMixture 拟合
        3. 返回 BIC 最小的聚类数
        """
        max_clusters = min(self._max_cluster, len(embeddings))
        n_clusters = np.arange(1, max_clusters)
        bics = []
        for n in n_clusters:
            gm = GaussianMixture(n_components=n, random_state=random_state)
            gm.fit(embeddings)
            bics.append(gm.bic(embeddings))
        optimal_clusters = n_clusters[np.argmin(bics)]
        return optimal_clusters

    async def __call__(self, chunks, random_state, callback=None):
        """
        核心调用函数，递归执行聚类与抽象生成

        参数：
        - chunks: list[(文本, 向量)], 原始 chunk 列表
        - random_state: int，用于聚类随机数
        - callback: 可选回调，用于进度更新

        返回：
        - 增强后的 chunks 列表，包括原始和生成的摘要 chunk
        """
        if len(chunks) <= 1:
            return []

        # 过滤掉无文本或无向量的 chunk
        chunks = [(s, a) for s, a in chunks if s and len(a) > 0]
        layers = [(0, len(chunks))]
        start, end = 0, len(chunks)

        @timeout(60)
        async def summarize(ck_idx: list[int]):
            """
            对一个聚类的 chunk 列表生成摘要
            1. 将聚类中的文本拼接并截断
            2. 调用 _chat 生成摘要
            3. 对摘要生成向量
            4. 将摘要作为新 chunk 添加到 chunks
            """
            nonlocal chunks
            texts = [chunks[i][0] for i in ck_idx]
            len_per_chunk = int(
                (self._llm_model.max_length - self._max_token) / len(texts)
            )
            cluster_content = "\n".join(
                [truncate(t, max(1, len_per_chunk)) for t in texts]
            )
            async with chat_limiter:
                cnt = await self._chat(
                    "You're a helpful assistant.",
                    [
                        {
                            "role": "user",
                            "content": self._prompt.format(
                                cluster_content=cluster_content
                            ),
                        }
                    ],
                    {"max_tokens": self._max_token},
                )
                cnt = re.sub(
                    "(······\n由于长度的原因，回答被截断了，要继续吗？|For the content length reason, it stopped, continue?)",
                    "",
                    cnt,
                )
                logging.debug(f"SUM: {cnt}")
                embds = await self._embedding_encode(cnt)
                chunks.append((cnt, embds))

        labels = []
        while end - start > 1:
            embeddings = [embd for _, embd in chunks[start:end]]

            # 特殊情况：仅 2 个 chunk 时直接生成摘要
            if len(embeddings) == 2:
                await summarize([start, start + 1])
                if callback:
                    callback(
                        msg="Cluster one layer: {} -> {}".format(
                            end - start, len(chunks) - end
                        )
                    )
                labels.extend([0, 0])
                layers.append((end, len(chunks)))
                start = end
                end = len(chunks)
                continue

            # 1️⃣ 使用 UMAP 降维向量
            n_neighbors = int((len(embeddings) - 1) ** 0.8)
            reduced_embeddings = umap.UMAP(
                n_neighbors=max(2, n_neighbors),
                n_components=min(12, len(embeddings) - 2),
                metric="cosine",
            ).fit_transform(embeddings)

            # 2️⃣ 自动选择最佳聚类数
            n_clusters = self._get_optimal_clusters(reduced_embeddings, random_state)

            # 3️⃣ 高斯混合聚类，获取每个 chunk 的簇标签
            if n_clusters == 1:
                lbls = [0 for _ in range(len(reduced_embeddings))]
            else:
                gm = GaussianMixture(n_components=n_clusters, random_state=random_state)
                gm.fit(reduced_embeddings)
                probs = gm.predict_proba(reduced_embeddings)
                lbls = [np.where(prob > self._threshold)[0] for prob in probs]
                lbls = [lbl[0] if isinstance(lbl, np.ndarray) else lbl for lbl in lbls]

            # 4️⃣ 对每个簇生成摘要（并发执行）
            async with trio.open_nursery() as nursery:
                for c in range(n_clusters):
                    ck_idx = [i + start for i in range(len(lbls)) if lbls[i] == c]
                    assert len(ck_idx) > 0
                    nursery.start_soon(summarize, ck_idx)

            labels.extend(lbls)
            layers.append((end, len(chunks)))
            if callback:
                callback(
                    msg="Cluster one layer: {} -> {}".format(
                        end - start, len(chunks) - end
                    )
                )
            start = end
            end = len(chunks)

        return chunks

```