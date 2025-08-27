---
weight: 1
title: "RagFlow Retriever"
date: 2025-08-20T11:00:00+08:00
lastmod: 2025-08-20T11:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "RagFlow Retriever"
featuredImage: 

tags: ["RAG", "RagFlow"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

上面我们介绍了 ragflow 检索的 query 模块，这一节我们来介绍 search 的具体实现。


## 6. search
search 代码比较长，我们分成几个部分讲解:
1. 初始化和工具方法
2. search
3. insert_citations
4. rerank
5. retrieval
6. tag 接口

下面是每个方法的作用和入参说明:

`get_vector`

**作用**：将输入文本转成向量，构造并返回向量检索表达式。

* **txt**：查询文本。
* **emb_mdl**：embedding 模型，用于生成向量。
* **topk**：返回的候选数量。
* **similarity**：相似度阈值。

---

`get_filters`

**作用**：从请求字典中提取过滤条件（如知识库 ID、文档 ID 等）。

* **req**：查询请求字典。

---

`trans2floats`

**作用**：将字符串（`\t` 分隔的数值）转换为 float 数组。

* **txt**：用 `\t` 分隔的数值字符串。
---

`hybrid_similarity`

**作用**：计算 token 相似度 + 向量相似度的混合得分。

* **ans_embd**：答案向量。
* **ins_embd**：候选向量。
* **ans**：答案文本。
* **inst**：候选文本。

---

`search`

**作用**：执行搜索（支持关键字 + 向量混合检索），返回 `SearchResult`。

* **req**：请求字典，描述查询需求。
* **idx_names**：索引名或索引名列表。
* **kb_ids**：知识库 ID 列表。
* **emb_mdl**：embedding 模型（可选，用于向量检索）。
* **highlight**：是否对匹配部分高亮。
* **rank_feature**：排序特征（如 PageRank、标签权重）。

---

`insert_citations`

**作用**：在回答中插入文档引用标记（如 `[ID:x]`），生成带引用的回答。

* **answer**：模型生成的回答文本。
* **chunks**：候选文档块。
* **chunk_v**：候选文档块向量。
* **embd_mdl**：embedding 模型。
* **tkweight**：token 相似度权重。
* **vtweight**：向量相似度权重。

---

`_rank_feature_scores`

**作用**：计算搜索结果的 rank 特征得分（如 PageRank、标签分数）。

* **query_rfea**：查询的 rank 特征。
* **search_res**：搜索结果。

---

`rerank`

**作用**：使用混合相似度（向量 + token + rank feature）对搜索结果进行重排。

* **sres**：搜索结果。
* **query**：查询文本。
* **tkweight**：token 相似度权重。
* **vtweight**：向量相似度权重。
* **cfield**：文档内容字段。
* **rank_feature**：排序特征。

---

`rerank_by_model`

**作用**：调用外部重排模型（如 CrossEncoder）对搜索结果重新排序。

* **rerank_mdl**：重排模型。
* **sres**：搜索结果。
* **query**：查询文本。
* **cfield**：文档内容字段。

`retrieval`

**作用**：核心检索接口，执行文档召回 + （可选）重排，返回分页后的文档 chunks。

* **question**：用户查询问题。
* **embd_mdl**：embedding 模型。
* **tenant_ids**：租户 ID 列表。
* **kb_ids**：知识库 ID 列表。
* **page**：页码。
* **page_size**：分页大小。
* **similarity_threshold**：相似度阈值。
* **vector_similarity_weight**：向量相似度权重。
* **top**：召回数量。
* **doc_ids**：指定过滤的文档 ID。
* **aggs**：是否进行聚合。
* **rerank_mdl**：重排模型（可选）。
* **highlight**：是否高亮。
* **rank_feature**：排序特征。

---

`sql_retrieval`

**作用**：通过 SQL 接口直接查询底层数据存储。

* **sql**：SQL 语句。
* **fetch_size**：批量返回大小。
* **format**：结果格式。

---

`chunk_list`

**作用**：获取某个文档的所有切分块（支持分页）。

* **doc_id**：文档 ID。
* **tenant_id**：租户 ID。
* **kb_ids**：知识库 ID 列表。
* **max_count**：最大返回数量。
* **offset**：偏移量。
* **fields**：返回字段。

---

`all_tags`

**作用**：获取所有标签（tag_kwd）的聚合。

* **tenant_id**：租户 ID。
* **kb_ids**：知识库列表。
* **S**：平滑参数。

---

`all_tags_in_portion`

**作用**：获取标签的概率分布（带平滑因子）。

* **tenant_id**：租户 ID。
* **kb_ids**：知识库列表。
* **S**：平滑参数。

---

`tag_content`

**作用**：根据文档内容自动打标签，并写入 `TAG_FLD`。

* **tenant_id**：租户 ID。
* **kb_ids**：知识库列表。
* **doc**：文档对象。
* **all_tags**：全局标签分布。
* **topn_tags**：取多少标签。
* **keywords_topn**：关键词数量。
* **S**：平滑参数。

---

`tag_query`

**作用**：给查询打标签，返回 query 的标签特征。

* **question**：用户查询。
* **tenant_ids**：租户 ID 列表。
* **kb_ids**：知识库 ID 列表。
* **all_tags**：全局标签分布。
* **topn_tags**：取多少标签。
* **S**：平滑参数。


### 6.1 工具函数
```python

import logging  
import re       
import math     
from collections import OrderedDict  
from dataclasses import dataclass     

from rag.settings import TAG_FLD, PAGERANK_FLD  
from rag.utils import rmSpace, get_float         
from rag.nlp import rag_tokenizer, query        # NLP 组件：分词器与查询构造器
import numpy as np                               
from rag.utils.doc_store_conn import DocStoreConnection, MatchDenseExpr, FusionExpr, OrderByExpr 


def index_name(uid): return f"ragflow_{uid}"  # 索引名生成：不同租户/空间映射到各自的索引


class Dealer:
    def __init__(self, dataStore: DocStoreConnection):
        self.qryr = query.FulltextQueryer()  # 构造全文检索查询器（match、question、paragraph等）
        self.dataStore = dataStore           # 注入的文档存储连接（如 ES/OpenSearch 抽象）

    @dataclass
    class SearchResult:
        total: int                         # 命中总数
        ids: list[str]                     # 命中文档块（chunk）的 ID 序列
        query_vector: list[float] | None = None  # 查询向量（如问题的 embedding）
        field: dict | None = None                # 每个 chunk ID 对应的字段字典
        highlight: dict | None = None            # 高亮片段（按 ID 映射）
        aggregation: list | dict | None = None   # 聚合结果（如 docnm_kwd 计数）
        keywords: list[str] | None = None        # 解析问题得到的关键词列表
        group_docs: list[list] | None = None     # 可选：分组后的文档

    def get_vector(self, txt, emb_mdl, topk=10, similarity=0.1):
        qv, _ = emb_mdl.encode_queries(txt)  # 使用向量模型对查询文本编码；返回向量与额外信息
        shape = np.array(qv).shape           # 获取向量形状
        if len(shape) > 1:                   # 期望是一维向量（单条查询）
            raise Exception(
                f"Dealer.get_vector returned array's shape {shape} doesn't match expectation(exact one dimension).")
        embedding_data = [get_float(v) for v in qv]  # 向量元素统一转为 float
        vector_column_name = f"q_{len(embedding_data)}_vec"  # 约定：向量维度写进字段名，便于检索
        # 组装稠密向量匹配表达式：指定字段名、向量、数据类型、相似度度量、返回 topk、额外参数（相似度阈值）
        return MatchDenseExpr(vector_column_name, embedding_data, 'float', 'cosine', topk, {"similarity": similarity})

    def get_filters(self, req):
        condition = dict()  # 生成查询过滤条件（term/filter）
        for key, field in {"kb_ids": "kb_id", "doc_ids": "doc_id"}.items():  # 将外部键映射为索引字段
            if key in req and req[key] is not None:
                condition[field] = req[key]
        # TODO(yzc): `available_int` 可为空，但底层 infinity 不支持 nullable 列；因此直接按存在与否过滤
        for key in ["knowledge_graph_kwd", "available_int", "entity_kwd", "from_entity_kwd", "to_entity_kwd", "removed_kwd"]:
            if key in req and req[key] is not None:
                condition[key] = req[key]
        return condition

    @staticmethod
    def trans2floats(txt):
        return [get_float(t) for t in txt.split("\t")]  # 将制表符分隔的字符串转为浮点数组


    def hybrid_similarity(self, ans_embd, ins_embd, ans, inst):
        return self.qryr.hybrid_similarity(ans_embd,
                                           ins_embd,
                                           rag_tokenizer.tokenize(ans).split(),
                                           rag_tokenizer.tokenize(inst).split())  # 对外暴露的混合相似度计算（便捷封装）

class MatchDenseExpr(ABC):
    def __init__(
        self,
        vector_column_name: str,
        embedding_data: VEC,
        embedding_data_type: str,
        distance_type: str,
        topn: int = DEFAULT_MATCH_VECTOR_TOPN,
        extra_options: dict = dict(),
    ):
        self.vector_column_name = vector_column_name
        self.embedding_data = embedding_data
        self.embedding_data_type = embedding_data_type
        self.distance_type = distance_type
        self.topn = topn
        self.extra_options = extra_options


def get_float(v):
    if v is None:
        return float('-inf')
    try:
        return float(v)
    except Exception:
        return float('-inf')
```

### 6.2 search

**作用**：执行搜索（支持关键字 + 向量混合检索），返回 `SearchResult`。

* **req**：请求字典，描述查询需求。
* **idx_names**：索引名或索引名列表。
* **kb_ids**：知识库 ID 列表。
* **emb_mdl**：embedding 模型（可选，用于向量检索）。
* **highlight**：是否对匹配部分高亮。
* **rank_feature**：排序特征（如 PageRank、标签权重）。

在 search 的查询实现中，最终会生成三个查询表达式: `matchExprs = [matchText, matchDense, fusionExpr]`
1. `matchText, keywords = self.qryr.question(qst, min_match=0.3)` 全文索引实现关键词匹配
2. `matchDense = self.get_vector(qst, emb_mdl, topk, req.get("similarity", 0.1))` 向量查询
3. `fusionExpr = self.get_fusion_expr(matchText, matchDense, rank_feature)` 设定融合策略


```python
class Dealer:
    def search(self, req, idx_names: str | list[str],
               kb_ids: list[str],
               emb_mdl=None,
               highlight=False,
               rank_feature: dict | None = None
               ):
        filters = self.get_filters(req)        # 解析过滤条件
        orderBy = OrderByExpr()                # 排序表达式容器

        pg = int(req.get("page", 1)) - 1      # 页码从1开始，内部从0计
        topk = int(req.get("topk", 1024))     # 稠密召回返回上限
        ps = int(req.get("size", topk))       # 每页大小（默认与 topk 相同）
        offset, limit = pg * ps, ps            # 计算偏移与限制

        # 指定需要返回的字段集合；默认收集较全的元数据与加权内容
        src = req.get("fields",
                      ["docnm_kwd", "content_ltks", "kb_id", "img_id", "title_tks", "important_kwd", "position_int",
                       "doc_id", "page_num_int", "top_int", "create_timestamp_flt", "knowledge_graph_kwd",
                       "question_kwd", "question_tks", "doc_type_kwd",
                       "available_int", "content_with_weight", PAGERANK_FLD, TAG_FLD])
        kwds = set([])  # 用于收集问题解析出的关键词（去重）

        qst = req.get("question", "")  # 用户查询文本
        q_vec = []                        # 查询向量（仅在使用向量模型时填充）
        if not qst:  # 无查询文本：纯条件过滤/排序
            if req.get("sort"):
                orderBy.asc("page_num_int")        # 按页码升序
                orderBy.asc("top_int")             # 按区块顶端位置升序
                orderBy.desc("create_timestamp_flt")  # 按创建时间降序
            res = self.dataStore.search(src, [], filters, [], orderBy, offset, limit, idx_names, kb_ids)
            total = self.dataStore.getTotal(res)  # 取总数
            logging.debug("Dealer.search TOTAL: {}".format(total))
        else:
            highlightFields = ["content_ltks", "title_tks"] if highlight else []  # 指定需要高亮的字段
            matchText, keywords = self.qryr.question(qst, min_match=0.3)  # 构造全文检索 query（含最低匹配度）并得到关键词
            if emb_mdl is None:  # 仅文本检索
                matchExprs = [matchText]
                res = self.dataStore.search(src, highlightFields, filters, matchExprs, orderBy, offset, limit,
                                            idx_names, kb_ids, rank_feature=rank_feature)
                total = self.dataStore.getTotal(res)
                logging.debug("Dealer.search TOTAL: {}".format(total))
            else:  # 融合召回（文本 + 向量）
                matchDense = self.get_vector(qst, emb_mdl, topk, req.get("similarity", 0.1))  # 构造向量检索表达式
                q_vec = matchDense.embedding_data  # 保存查询向量以便后续重排
                src.append(f"q_{len(q_vec)}_vec")  # 将向量字段名加入返回列表，便于后续读取 chunk 向量

                fusionExpr = FusionExpr("weighted_sum", topk, {"weights": "0.05,0.95"})  # 设定融合策略：文本:向量 = 5%:95%
                matchExprs = [matchText, matchDense, fusionExpr]  # 按顺序传入融合组件

                res = self.dataStore.search(src, highlightFields, filters, matchExprs, orderBy, offset, limit,
                                            idx_names, kb_ids, rank_feature=rank_feature)
                total = self.dataStore.getTotal(res)
                logging.debug("Dealer.search TOTAL: {}".format(total))

                # 若结果为空，回退策略：降低文本 min_match 或仅过滤
                if total == 0:
                    if filters.get("doc_id"):  # 如果指定 doc_id，则退化为仅按过滤条件检索
                        res = self.dataStore.search(src, [], filters, [], orderBy, offset, limit, idx_names, kb_ids)
                        total = self.dataStore.getTotal(res)
                    else:
                        matchText, _ = self.qryr.question(qst, min_match=0.1)  # 降低匹配阈值
                        matchDense.extra_options["similarity"] = 0.17        # 放宽向量相似度阈值
                        res = self.dataStore.search(src, highlightFields, filters, [matchText, matchDense, fusionExpr],
                                                    orderBy, offset, limit, idx_names, kb_ids, rank_feature=rank_feature)
                        total = self.dataStore.getTotal(res)
                    logging.debug("Dealer.search 2 TOTAL: {}".format(total))

            for k in keywords:  # 关键词细粒度扩展（分词并去重、过滤短 token）
                kwds.add(k)
                for kk in rag_tokenizer.fine_grained_tokenize(k).split():
                    if len(kk) < 2:
                        continue
                    if kk in kwds:
                        continue
                    kwds.add(kk)

        logging.debug(f"TOTAL: {total}")  # 记录最终总数
        ids = self.dataStore.getChunkIds(res)  # 取出命中的 chunk ID 列表
        keywords = list(kwds)                  # 将关键词集合转为列表
        highlight = self.dataStore.getHighlight(res, keywords, "content_with_weight")  # 基于关键词生成高亮
        aggs = self.dataStore.getAggregation(res, "docnm_kwd")  # 对文档名维度做聚合统计
        return self.SearchResult(
            total=total,
            ids=ids,
            query_vector=q_vec,
            aggregation=aggs,
            highlight=highlight,
            field=self.dataStore.getFields(res, src),  # 拉取所有返回字段映射（id -> 字段字典）
            keywords=keywords
        )
```

search 总共调用了 self.dataStore 的六个方法:

1. **`search()`**: 核心检索方法，用于执行过滤条件 + 匹配表达式 + 排序 + 分页的查询。
2. **`getTotal()`**: 用于获取检索结果的总条数（总命中数）。
3. **`getChunkIds()`**: 从检索结果中提取文档或数据块的唯一 ID 列表。
4. **`getHighlight()`**: 根据关键词和文本字段生成高亮信息，用于前端展示。
5. **`getAggregation()`**: 对指定字段（如 `docnm_kwd`）做聚合统计，返回分面信息。
6. **`getFields()`**: 获取最终结果中实际返回的字段数据。


### 6.3 insert_citations

insert_citations 在回答中插入文档引用标记（如 `[ID:x]`），生成带引用的回答。

* **answer**：模型生成的回答文本。
* **chunks**：候选文档块。
* **chunk_v**：候选文档块向量。
* **embd_mdl**：embedding 模型。
* **tkweight**：token 相似度权重。
* **vtweight**：向量相似度权重。

```python
class Dealer:
    def insert_citations(self, answer, chunks, chunk_v,
                         embd_mdl, tkweight=0.1, vtweight=0.9):
        assert len(chunks) == len(chunk_v)  # 文本块与其向量数量需一致
        if not chunks:
            return answer, set([])  # 无可引用源时直接返回
        pieces = re.split(r"(```)", answer)  # 先按代码块分段，避免在代码内插入引用标记
        if len(pieces) >= 3:  # 存在代码块
            i = 0
            pieces_ = []
            while i < len(pieces):
                if pieces[i] == "```":  # 遇到代码围栏
                    st = i
                    i += 1
                    while i < len(pieces) and pieces[i] != "```":  # 跳过代码体
                        i += 1
                    if i < len(pieces):
                        i += 1  # 连同结束围栏一并加入
                    pieces_.append("".join(pieces[st: i]) + "\n")  # 保持原样并在末尾加换行
                else:
                    pieces_.extend(
                        re.split(
                            r"([^\|][；。？!！\n]|[a-z][.?;!][ \n])",
                            pieces[i]))  # 非代码片段再细分为句子（中文标点+英文句末）
                    i += 1
            pieces = pieces_
        else:  # 没有代码块，直接按句子切分
            pieces = re.split(r"([^\|][；。？!！\n]|[a-z][.?;!][ \n])", answer)
        for i in range(1, len(pieces)):
            if re.match(r"([^\|][；。？!！\n]|[a-z][.?;!][ \n])", pieces[i]):  # 将标点附着回前一段
                pieces[i - 1] += pieces[i][0]
                pieces[i] = pieces[i][1:]
        idx = []      # 记录实际文本片段在原数组中的索引（用于回填引用）
        pieces_ = []  # 非空且长度>=5的片段（用于计算相似度）
        for i, t in enumerate(pieces):
            if len(t) < 5:  # 过短片段跳过，避免噪声
                continue
            idx.append(i)
            pieces_.append(t)
        logging.debug("{} => {}".format(answer, pieces_))
        if not pieces_:
            return answer, set([])  # 若没有有效片段则直接返回

        ans_v, _ = embd_mdl.encode(pieces_)  # 对每个答案片段做向量化
        for i in range(len(chunk_v)):
            if len(ans_v[0]) != len(chunk_v[i]):  # 若维度不匹配，兜底为零向量并告警
                chunk_v[i] = [0.0]*len(ans_v[0])
                logging.warning("The dimension of query and chunk do not match: {} vs. {}".format(len(ans_v[0]), len(chunk_v[i])))

        assert len(ans_v[0]) == len(chunk_v[0]), "The dimension of query and chunk do not match: {} vs. {}".format(
            len(ans_v[0]), len(chunk_v[0]))  # 再次保证维度一致

        chunks_tks = [rag_tokenizer.tokenize(self.qryr.rmWWW(ck)).split()
                      for ck in chunks]  # 将参考文本去除URL/空白后分词
        cites = {}  # 片段索引 -> 引用的 chunk 序号列表
        thr = 0.63  # 初始相似度阈值
        while thr > 0.3 and len(cites.keys()) == 0 and pieces_ and chunks_tks:
            for i, a in enumerate(pieces_):
                sim, tksim, vtsim = self.qryr.hybrid_similarity(ans_v[i],
                                                                chunk_v,
                                                                rag_tokenizer.tokenize(
                                                                    self.qryr.rmWWW(pieces_[i])).split(),
                                                                chunks_tks,
                                                                tkweight, vtweight)  # 计算混合相似度（向量+词项）
                mx = np.max(sim) * 0.99  # 取最大相似度并略微收缩，避免过多 ties
                logging.debug("{} SIM: {}".format(pieces_[i], mx))
                if mx < thr:
                    continue
                cites[idx[i]] = list(
                    set([str(ii) for ii in range(len(chunk_v)) if sim[ii] > mx]))[:4]  # 选取超过阈值的前4个引用
            thr *= 0.8  # 逐步放宽阈值，直到找到引用或触底

        res = ""   # 构建带引用标记的答案
        seted = set([])  # 已插入的引用去重（避免重复 ID）
        for i, p in enumerate(pieces):
            res += p
            if i not in idx:
                continue
            if i not in cites:
                continue
            for c in cites[i]:
                assert int(c) < len(chunk_v)  # 防御性检查：引用 index 合法
            for c in cites[i]:
                if c in seted:
                    continue
                res += f" [ID:{c}]"  # 在句子后插入引用标记
                seted.add(c)

        return res, seted  # 返回带引用答案与引用集合
```

### 6.4 rerank

**作用**：使用混合相似度（向量 + token + rank feature）对搜索结果进行重排。

* **sres**：搜索结果。
* **query**：查询文本。
* **tkweight**：token 相似度权重。
* **vtweight**：向量相似度权重。
* **cfield**：文档内容字段。
* **rank_feature**：排序特征。


```python
class Dealer:
    def _rank_feature_scores(self, query_rfea, search_res):
        ## 计算排序特征（标签得分 + PageRank）
        rank_fea = []
        pageranks = []
        for chunk_id in search_res.ids:
            pageranks.append(search_res.field[chunk_id].get(PAGERANK_FLD, 0))  # 取每个 chunk 的 PageRank
        pageranks = np.array(pageranks, dtype=float)

        if not query_rfea:  # 若查询侧无标签特征，直接返回 PageRank（作为基线）
            return np.array([0 for _ in range(len(search_res.ids))]) + pageranks

        q_denor = np.sqrt(np.sum([s*s for t,s in query_rfea.items() if t != PAGERANK_FLD]))  # 查询侧特征范数（排除 PageRank 键）
        for i in search_res.ids:
            nor, denor = 0, 0
            if not search_res.field[i].get(TAG_FLD):
                rank_fea.append(0)
                continue
            for t, sc in eval(search_res.field[i].get(TAG_FLD, "{}")).items():  # 将存储的 JSON 字符串转回字典（注意：eval 有风险）
                if t in query_rfea:
                    nor += query_rfea[t] * sc  # 点积的分子
                denor += sc * sc              # 文档侧特征范数的平方累加
            if denor == 0:
                rank_fea.append(0)
            else:
                rank_fea.append(nor/np.sqrt(denor)/q_denor)  # 余弦相似度：nor / (||q|| * ||d||)
        return np.array(rank_fea)*10. + pageranks  # 标签得分放大权重后与 PageRank 相加

    def rerank(self, sres, query, tkweight=0.3,
               vtweight=0.7, cfield="content_ltks",
               rank_feature: dict | None = None
               ):
        _, keywords = self.qryr.question(query)  # 从查询中抽取关键词（不关心文本查询表达式）
        vector_size = len(sres.query_vector)      # 查询向量维度
        vector_column = f"q_{vector_size}_vec"    # 对应 chunk 中的向量字段名
        zero_vector = [0.0] * vector_size         # 维度兜底零向量
        ins_embd = []
        for chunk_id in sres.ids:
            vector = sres.field[chunk_id].get(vector_column, zero_vector)  # 读取每个 chunk 的向量
            if isinstance(vector, str):
                vector = [get_float(v) for v in vector.split("\t")]       # 若为字符串（\t 分隔），转为浮点列表
            ins_embd.append(vector)
        if not ins_embd:
            return [], [], []  # 无向量可重排时返回空

        for i in sres.ids:
            if isinstance(sres.field[i].get("important_kwd", []), str):
                sres.field[i]["important_kwd"] = [sres.field[i]["important_kwd"]]  # 兼容：将单值转为列表
        ins_tw = []
        for i in sres.ids:
            content_ltks = list(OrderedDict.fromkeys(sres.field[i][cfield].split()))  # 内容分词 + 去重保序
            title_tks = [t for t in sres.field[i].get("title_tks", "").split() if t]  # 标题词
            question_tks = [t for t in sres.field[i].get("question_tks", "").split() if t]  # 原问题词
            important_kwd = sres.field[i].get("important_kwd", [])  # 标注的重要关键词
            tks = content_ltks + title_tks * 2 + important_kwd * 5 + question_tks * 6 #  词项加权拼接
            ins_tw.append(tks)

        ## 结合标签排序特征
        rank_fea = self._rank_feature_scores(rank_feature, sres)

        sim, tksim, vtsim = self.qryr.hybrid_similarity(sres.query_vector,
                                                        ins_embd,
                                                        keywords,
                                                        ins_tw, tkweight, vtweight)  # 计算混合相似度

        return sim + rank_fea, tksim, vtsim  # 将标签/PageRank 融入最终相似度

    def rerank_by_model(self, rerank_mdl, sres, query, tkweight=0.3,
                        vtweight=0.7, cfield="content_ltks",
                        rank_feature: dict | None = None):
        _, keywords = self.qryr.question(query)  # 同上，抽取关键词

        for i in sres.ids:
            if isinstance(sres.field[i].get("important_kwd", []), str):
                sres.field[i]["important_kwd"] = [sres.field[i]["important_kwd"]]
        ins_tw = []
        for i in sres.ids:
            content_ltks = sres.field[i][cfield].split()  # 这里不去重，保留原频次
            title_tks = [t for t in sres.field[i].get("title_tks", "").split() if t]
            important_kwd = sres.field[i].get("important_kwd", [])
            tks = content_ltks + title_tks + important_kwd  # 简化的词项集合
            ins_tw.append(tks)

        tksim = self.qryr.token_similarity(keywords, ins_tw)  # 仅词项相似度
        vtsim, _ = rerank_mdl.similarity(query, [rmSpace(" ".join(tks)) for tks in ins_tw])  # 调用外部重排模型算语义相似度
        ## 标签/PageRank 特征
        rank_fea = self._rank_feature_scores(rank_feature, sres)

        return tkweight * (np.array(tksim)+rank_fea) + vtweight * vtsim, tksim, vtsim  # 融合加权

```

### 6.5 retrieval

```python
class Dealer:

    def retrieval(self, question, embd_mdl, tenant_ids, kb_ids, page, page_size, similarity_threshold=0.2,
                  vector_similarity_weight=0.3, top=1024, doc_ids=None, aggs=True,
                  rerank_mdl=None, highlight=False,
                  rank_feature: dict | None = {PAGERANK_FLD: 10}):
        ranks = {"total": 0, "chunks": [], "doc_aggs": {}}  # 输出骨架：总数/块列表/文档聚合
        if not question:
            return ranks  # 无查询文本直接返回空结果

        RERANK_LIMIT = 64  # 初始规定：最多参与重排的候选数
        # 将 RERANK_LIMIT 对齐到 page_size 的整数倍，确保分页对齐（至少为1）
        RERANK_LIMIT = int(RERANK_LIMIT//page_size + ((RERANK_LIMIT%page_size)/(page_size*1.) + 0.5)) * page_size if page_size>1 else 1
        if RERANK_LIMIT < 1: ## 当 page_size 特别大时，保护下限
            RERANK_LIMIT = 1
        req = {"kb_ids": kb_ids, "doc_ids": doc_ids, "page": math.ceil(page_size*page/RERANK_LIMIT), "size": RERANK_LIMIT,
               "question": question, "vector": True, "topk": top,
               "similarity": similarity_threshold,
               "available_int": 1}  # 构造检索请求（以较大窗口召回，再在内存中重排分页）


        if isinstance(tenant_ids, str):
            tenant_ids = tenant_ids.split(",")  # 兼容字符串传参：用逗号拆成列表

        sres = self.search(req, [index_name(tid) for tid in tenant_ids],
                           kb_ids, embd_mdl, highlight, rank_feature=rank_feature)  # 先进行一次融合召回

        if rerank_mdl and sres.total > 0:
            # 如果给了外部重排模型，则用其生成向量相似度；tkweight 与 vtweight 由 vector_similarity_weight 控制
            sim, tsim, vsim = self.rerank_by_model(rerank_mdl,
                                                   sres, question, 1 - vector_similarity_weight,
                                                   vector_similarity_weight,
                                                   rank_feature=rank_feature)
        else:
            # 否则用本地的混合相似度（基于召回时返回的 chunk 向量）
            sim, tsim, vsim = self.rerank(
                sres, question, 1 - vector_similarity_weight, vector_similarity_weight,
                rank_feature=rank_feature)
        # 召回结果已经是按页 window 的，现对 sim 做全局排序并切片为当前页
        idx = np.argsort(sim * -1)[(page - 1) * page_size:page * page_size]
        dim = len(sres.query_vector)                 # 查询向量维度
        vector_column = f"q_{dim}_vec"               # chunk 中的向量字段名
        zero_vector = [0.0] * dim                    # 兜底零向量
        sim_np = np.array(sim)
        filtered_count = (sim_np >= similarity_threshold).sum()    # 统计达到阈值的候选数量
        ranks["total"] = int(filtered_count) # 转为 Python int，避免后续 JSON 序列化错误
        for i in idx:
            if sim[i] < similarity_threshold:
                break  # 当前页内若分数低于阈值则停止（后续更低）

            id = sres.ids[i]          # chunk ID
            chunk = sres.field[id]    # chunk 字段字典
            dnm = chunk.get("docnm_kwd", "")  # 文档名
            did = chunk.get("doc_id", "")     # 文档 ID

            if len(ranks["chunks"]) >= page_size:  # 超出当前页容量
                if aggs:
                    if dnm not in ranks["doc_aggs"]:
                        ranks["doc_aggs"][dnm] = {"doc_id": did, "count": 0}
                    ranks["doc_aggs"][dnm]["count"] += 1  # 统计其余落在当前页 window 的文档分布
                    continue
                break

            position_int = chunk.get("position_int", [])  # 文档内位置（如起止行/偏移）
            d = {
                "chunk_id": id,
                "content_ltks": chunk["content_ltks"],
                "content_with_weight": chunk["content_with_weight"],
                "doc_id": did,
                "docnm_kwd": dnm,
                "kb_id": chunk["kb_id"],
                "important_kwd": chunk.get("important_kwd", []),
                "image_id": chunk.get("img_id", ""),
                "similarity": sim[i],
                "vector_similarity": vsim[i],
                "term_similarity": tsim[i],
                "vector": chunk.get(vector_column, zero_vector),
                "positions": position_int,
                "doc_type_kwd": chunk.get("doc_type_kwd", "")
            }
            if highlight and sres.highlight:
                if id in sres.highlight:
                    d["highlight"] = rmSpace(sres.highlight[id])  # 高亮存在则用之
                else:
                    d["highlight"] = d["content_with_weight"]     # 否则退化为原内容
            ranks["chunks"].append(d)
            if dnm not in ranks["doc_aggs"]:
                ranks["doc_aggs"][dnm] = {"doc_id": did, "count": 0}
            ranks["doc_aggs"][dnm]["count"] += 1
        ranks["doc_aggs"] = [{"doc_name": k,
                              "doc_id": v["doc_id"],
                              "count": v["count"]} for k,
                                                       v in sorted(ranks["doc_aggs"].items(),
                                                                   key=lambda x: x[1]["count"] * -1)]  # 文档聚合转列表并按出现次数降序
        ranks["chunks"] = ranks["chunks"][:page_size]  # 再次裁剪以防越界

        return ranks  # 返回最终检索结构

    def sql_retrieval(self, sql, fetch_size=128, format="json"):
        tbl = self.dataStore.sql(sql, fetch_size, format)  # 透传 SQL 到底层存储（如提供 BI/表格检索）
        return tbl

```
### 6.6 tag 接口

```python

class Dealer:
    def chunk_list(self, doc_id: str, tenant_id: str,
                   kb_ids: list[str], max_count=1024,
                   offset=0,
                   fields=["docnm_kwd", "content_with_weight", "img_id"]):
        condition = {"doc_id": doc_id}  # 仅拉取指定文档的所有 chunk（分页）
        res = []
        bs = 128  # 批量大小
        for p in range(offset, max_count, bs):
            es_res = self.dataStore.search(fields, [], condition, [], OrderByExpr(), p, bs, index_name(tenant_id),
                                           kb_ids)  # 每批查询固定字段
            dict_chunks = self.dataStore.getFields(es_res, fields)  # id -> 字段字典
            for id, doc in dict_chunks.items():
                doc["id"] = id  # 将 id 写回字段，便于前端使用
            if dict_chunks:
                res.extend(dict_chunks.values())
            if len(dict_chunks.values()) < bs:  # 如果返回不足一批，说明已到末尾
                break
        return res

    def all_tags(self, tenant_id: str, kb_ids: list[str], S=1000):
        if not self.dataStore.indexExist(index_name(tenant_id), kb_ids[0]):  # 索引不存在直接返回空
            return []
        res = self.dataStore.search([], [], {}, [], OrderByExpr(), 0, 0, index_name(tenant_id), kb_ids, ["tag_kwd"])  # 只做聚合不取文档
        return self.dataStore.getAggregation(res, "tag_kwd")  # 返回(tag, count) 列表

    def all_tags_in_portion(self, tenant_id: str, kb_ids: list[str], S=1000):
        res = self.dataStore.search([], [], {}, [], OrderByExpr(), 0, 0, index_name(tenant_id), kb_ids, ["tag_kwd"])  # 同上
        res = self.dataStore.getAggregation(res, "tag_kwd")
        total = np.sum([c for _, c in res])  # 计算总频次
        return {t: (c + 1) / (total + S) for t, c in res}  # 拉普拉斯平滑：返回每个 tag 的先验概率

    def tag_content(self, tenant_id: str, kb_ids: list[str], doc, all_tags, topn_tags=3, keywords_topn=30, S=1000):
        idx_nm = index_name(tenant_id)  # 索引名
        match_txt = self.qryr.paragraph(doc["title_tks"] + " " + doc["content_ltks"], doc.get("important_kwd", []), keywords_topn)  # 构造段落匹配查询
        res = self.dataStore.search([], [], {}, [match_txt], OrderByExpr(), 0, 0, idx_nm, kb_ids, ["tag_kwd"])  # 仅聚合 tag
        aggs = self.dataStore.getAggregation(res, "tag_kwd")
        if not aggs:
            return False  # 无聚合结果，无法标注
        cnt = np.sum([c for _, c in aggs])  # 该文档上下文的 tag 总频次
        tag_fea = sorted([(a, round(0.1*(c + 1) / (cnt + S) / max(1e-6, all_tags.get(a, 0.0001)))) for a, c in aggs],
                         key=lambda x: x[1] * -1)[:topn_tags]  # 计算相对权重并取前 topn_tags
        doc[TAG_FLD] = {a.replace(".", "_"): c for a, c in tag_fea if c > 0}  # 写回文档的标签特征字段
        return True

    def tag_query(self, question: str, tenant_ids: str | list[str], kb_ids: list[str], all_tags, topn_tags=3, S=1000):
        if isinstance(tenant_ids, str):
            idx_nms = index_name(tenant_ids)  # 单租户：一个索引名
        else:
            idx_nms = [index_name(tid) for tid in tenant_ids]  # 多租户：索引名列表
        match_txt, _ = self.qryr.question(question, min_match=0.0)  # 以极低门槛构造查询，尽量覆盖更多 tag
        res = self.dataStore.search([], [], {}, [match_txt], OrderByExpr(), 0, 0, idx_nms, kb_ids, ["tag_kwd"])  # 仅做聚合
        aggs = self.dataStore.getAggregation(res, "tag_kwd")
        if not aggs:
            return {}
        cnt = np.sum([c for _, c in aggs])
        tag_fea = sorted([(a, round(0.1*(c + 1) / (cnt + S) / max(1e-6, all_tags.get(a, 0.0001)))) for a, c in aggs],
                         key=lambda x: x[1] * -1)[:topn_tags]  # 相同权重计算逻辑
        return {a.replace(".", "_"): max(1, c) for a, c in tag_fea}  # 返回查询侧的标签特征，最小值设为1

```