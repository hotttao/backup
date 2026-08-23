---
weight: 1
title: "向量搜索引擎：从第一性原理到系统选型"
date: 2026-08-21T20:00:00+08:00
lastmod: 2026-08-21T20:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "对比 Faiss、TurboVec、Milvus、Qdrant、Weaviate、Vespa、Elasticsearch、pgvector 与 LanceDB 的语言、索引、存储、过滤、分布式实现和适用场景"
featuredImage:

tags: ["向量搜索", "向量数据库", "ANN", "HNSW"]
categories: ["Vector"]

lightgallery: true
---

向量搜索引擎看起来都提供同一个接口：输入查询向量，返回距离最近的 Top-K 结果。但相同的 API 背后，可以是内存中的近邻图、磁盘上的聚类分区、Lucene 的不可变 segment、PostgreSQL 的索引访问方法，或者对象存储上的列式文件。

这篇文章不按功能清单比较产品，而是从问题本身出发，分析不同系统为什么会做出不同选择，以及这些选择怎样决定它们的性能边界。

<!-- more -->

> 调研时间：2026-08-21。本文以官方文档、官方源码仓库和原始论文为依据。版本变化较快的默认参数只在必要处说明；选型时应以自己的数据、过滤分布、更新比例和延迟目标重新压测。

## 1. 调研对象

这次选择 9 个对象，不追求穷举，而是让每个对象代表一种有辨识度的实现路线。

| 对象 | 定位 | 主要实现语言 | 选择它的原因 |
|---|---|---|---|
| [Faiss](https://github.com/facebookresearch/faiss) | ANN 算法库 | C++、CUDA，Python 绑定 | Flat、IVF、PQ、HNSW、GPU 的算法基线 |
| [TurboVec](https://github.com/RyanCodrai/turbovec) | 压缩向量索引库 | Rust，Python 绑定 | 代表无训练 TurboQuant + SIMD 全量压缩扫描的新路线 |
| [Milvus](https://github.com/milvus-io/milvus) | 分布式向量数据库 | Go 控制/服务层，C++ 计算核心，另有 Rust 组件 | 代表 segment 化、存算分离和多种 ANN 后端 |
| [Qdrant](https://github.com/qdrant/qdrant) | 专用向量数据库 | Rust | 代表把元数据过滤直接融入 HNSW 遍历 |
| [Weaviate](https://github.com/weaviate/weaviate) | 对象与向量数据库 | Go | 代表 LSM 对象存储与每分片大 HNSW 的组合 |
| [Vespa](https://github.com/vespa-engine/vespa) | 在线搜索与排序平台 | C++ 搜索核心、Java 容器/控制层 | 代表召回、过滤、张量计算和多阶段排序一体化 |
| [Elasticsearch](https://github.com/elastic/elasticsearch) | 分布式文档搜索引擎 | Java，底层基于 Lucene | 代表不可变 Lucene segment 上的 HNSW 与混合检索 |
| [pgvector](https://github.com/pgvector/pgvector) | PostgreSQL 扩展 | C | 代表把向量类型和 ANN 索引接入关系数据库执行器 |
| [LanceDB](https://github.com/lancedb/lancedb) | 嵌入式/云原生检索库 | Rust 核心，Python/TypeScript/Rust SDK | 代表列式文件、对象存储和磁盘优先的 IVF 路线 |

没有单列 OpenSearch，是因为它与 Elasticsearch 同属 Lucene segment 路线；没有列 Pinecone、Zilliz Cloud 等闭源托管服务，是因为本文重点是可以从文档和源码验证的底层实现，而不是商业功能比较。

## 2. 第一性原理：向量搜索到底在优化什么

### 2.1 精确搜索的成本

给定查询向量 $q \in \mathbb{R}^d$ 和 $N$ 个候选向量，精确 Top-K 的朴素过程是：

1. 对每个向量计算一次距离，成本约为 $O(Nd)$；
2. 从 $N$ 个距离中选出最小的 K 个；
3. 如果有过滤条件，只对满足谓词的记录参与排序。

距离通常是 L2、内积或余弦。若向量已做 L2 归一化，最大内积、最小余弦距离和最小 L2 距离可以相互转换。工程上最贵的往往不是公式，而是从内存或磁盘搬运 $N \times d$ 个数，以及维护 Top-K 的开销。

精确扫描没有召回率损失，数据量小、过滤后候选很少或 GPU 批量吞吐很高时，它可能比复杂索引更合适。Faiss 的 [索引选择指南](https://github.com/facebookresearch/faiss/wiki/Guidelines-to-choose-an-index) 也明确把 `Flat` 作为唯一保证精确结果的索引。

### 2.2 ANN 的三种基本减法

近似最近邻（ANN）本质上通过少做三类工作来加速：

1. **少看候选**：IVF 用聚类中心把空间切成分区，查询时只扫描最近的若干分区。
2. **少存、少算每个候选**：PQ/SQ/BQ 把原始浮点向量压缩成短码，用查表、低精度 SIMD 或位运算估算距离。
3. **沿“近路”找候选**：HNSW 将向量组织成多层近邻图，从稀疏高层做长距离跳转，在稠密底层局部扩展。

TurboVec 代表一个值得单独观察的设计点：它不一定“少看候选”，而是把每个候选压得足够小、把距离估算做成连续的 SIMD 内核，使全量扫描重新变得有竞争力。它仍是近似搜索，因为距离来自量化码而非原始 float32 向量；但近似误差来自表示压缩，而不是 IVF 漏掉分区或 HNSW 漏掉图节点。

[HNSW 原始论文](https://arxiv.org/abs/1603.09320) 的核心是概率分层的近邻图：高层节点少、适合快速定位区域；第 0 层包含全部节点、负责精细搜索。参数 `M` 决定图的连接度，`efConstruction` 决定建图时探索宽度，`efSearch` 决定查询时的候选宽度。提高它们通常提升召回率，同时增加内存、构建或查询成本。

IVF 则先做 K-means：每个向量只挂到一个或多个中心对应的倒排列表；查询只探测 `nprobe` 个列表。PQ 再把 $d$ 维向量切成多个子空间，每个子空间用一个小码本量化，以少量字节表示整条向量。它牺牲距离精度换容量和带宽，[PQ 原始论文](https://ieeexplore.ieee.org/document/5432202) 以及 [Faiss 文档](https://faiss.ai/) 是这条路线的基础。

### 2.3 真正困难的是过滤、更新和分布式 Top-K

只做静态、无过滤 ANN，很多库都能很快。数据库的差距出现在三个约束叠加以后：

- **过滤**：先做向量 Top-K 再过滤，可能返回不足 K 条；先过滤再扫描，过滤集合较大时又退化成暴力搜索。图遍历中跳过不满足条件的节点，还可能让图失去连通性。
- **更新和删除**：HNSW 容易增量插入，但原地删除、图重连和压缩并不便宜；IVF/PQ 需要训练，数据分布变化后索引可能过时。
- **分布式归并**：每个 shard 只能返回局部候选。为了得到全局 Top-K，各 shard 通常要返回 K 或更多候选，再由上层归并；过度采样提高召回，也增加网络和 CPU 成本。

因此，选型首先应该问“系统怎样组织数据生命周期”，然后才问“支持哪种 ANN 算法”。

## 3. 总览：九种实现路线

| 对象 | 主索引路线 | 索引/数据放置 | 更新模型 | 过滤路径 | 分布式方式 |
|---|---|---|---|---|---|
| Faiss | Flat、IVF、PQ、HNSW 等 | 主要是进程内内存；支持序列化、mmap 相关组件和 GPU | 取决于索引；偏算法库，不负责数据库生命周期 | 主要依赖 ID selector 或上层处理 | 无内建分布式数据库 |
| TurboVec | TurboQuant 2/3/4-bit 压缩码 + SIMD 扫描 | 进程内紧凑码，可序列化到本地文件 | 在线编码追加；stable-ID 包装支持 O(1) swap-remove | 调用方给 allowlist/bitmask，SIMD 内核按 32-vector block 跳过 | 无内建分布式数据库 |
| Milvus | Faiss/HNSW/DiskANN/ScaNN 等后端 | sealed segment 索引在对象存储，查询节点按需加载；WAL/元数据独立 | growing segment 实时查，sealed 后异步建索引、compaction | 标量索引、位图与 segment 级查询计划 | Proxy + Coordinator + Streaming/Query/Data Node，分层归并 Top-K |
| Qdrant | HNSW、稀疏倒排、量化 | segment 内向量、payload、索引；可配置 RAM/mmap/on-disk | mutable segment + 后台 optimizer 合并重建 | payload index 扩展 HNSW 边；必要时 ACORN 式二跳遍历/全扫 | collection → shard → replica，shard 内含多个 segment |
| Weaviate | 自研 HNSW，另有 Flat/Dynamic/HFresh | 每 shard 一个对象 LSM、倒排索引和独立大 HNSW | WAL + LSM flush/compaction；HNSW WAL/快照恢复 | 倒排结果与 HNSW 结合，支持 sweep/ACORN 策略 | class/collection 分 shard，复制与多租户 |
| Vespa | 修改版 HNSW + 精确扫描 | tensor attribute 与 HNSW 主要驻内存，文档分布在 content node | 实时增删，在线维护图 | 根据命中率在精确、pre-filter、post-filter、filter-first/ACORN 间选择 | content node 分片并行召回，上层归并，多阶段排序 |
| Elasticsearch | Lucene HNSW、量化 HNSW/Flat、磁盘型 BBQ | 每个不可变 Lucene segment 一张图，依赖文件系统 page cache | refresh 产生新 segment，merge 时合并/重建图，删除用 live docs | Lucene 可在过滤扫描和受过滤约束的图遍历间切换 | shard/replica；每 segment、每 shard、再跨 shard 归并 |
| pgvector | exact、HNSW、IVFFlat | PostgreSQL heap + index relation，走 shared buffers/OS cache | PostgreSQL WAL/MVCC/VACUUM；普通 SQL 事务内更新 | 通常 ANN 后过滤；iterative scan 扩大扫描，或用 B-tree/分区先缩小集合 | 依赖 PostgreSQL 分区、只读副本或外部分布式方案 |
| LanceDB | IVF-PQ/SQ/RQ、IVF-HNSW、Flat | Lance 列式文件与对象存储，磁盘优先；索引为数据集旁路结构 | 版本化 manifest；OSS 索引通常手动创建/更新 | scalar index/列式过滤与向量候选结合 | OSS 以嵌入式/单库为主，云版负责分布式服务 |

## 4. 逐项分析

### 4.1 Faiss：把搜索问题还原成算法和硬件问题

Faiss 不是数据库。它没有事务、鉴权、复制、元数据模型或分布式调度，核心抽象是 `Index`：训练、添加向量、搜索。它的价值在于把不同 ANN 组件做成可组合积木，例如 `OPQ -> IVF -> PQ`，也提供 HNSW、NSG、Flat、二进制索引以及 CPU/GPU 实现。

底层思路是：明确在“召回率、查询延迟、训练时间、索引内存、原始向量内存”之间交换什么。Faiss 的 GPU 路线不只是把 CPU 代码搬到 CUDA，而是针对批量距离计算和 Top-K selection 设计 GPU kernel；[GPU 论文](https://arxiv.org/abs/1702.08734) 解释了内存层次和 k-selection 为什么是关键。

优势：

- 算法种类最丰富，适合作为实验基线或自研系统的计算内核；
- C++/CUDA 对 SIMD、缓存布局、批量查询和 GPU 利用控制细；
- IVF/PQ 在十亿级静态数据、内存受限场景仍有很高价值。

劣势：

- 应用必须自己解决 ID/元数据、过滤、持久化、并发、删除、复制和分片；
- 不同索引支持的增删能力并不一致，组合错误很容易得到“快但召回差”的系统；
- 其首要假设仍是高性能进程内检索，不能直接等价于生产数据库。

适合：算法研究、离线检索、推荐召回、自研向量服务，以及 GPU 批量搜索。若需求是“一个带 SQL/过滤/高可用的数据库”，Faiss 应被视为内核而不是成品。

### 4.2 TurboVec：用无训练量化把全量扫描重新做小

TurboVec 是一个较新的社区项目，而不是 Google 官方产品。它用 Rust 编写并提供 Python 绑定，核心算法来自 Google Research 的 [TurboQuant 论文](https://proceedings.iclr.cc/paper_files/paper/2026/hash/5c802ef38ab6e366c2ea06eee554c088-Abstract-Conference.html)。论文发表于 ICLR 2026；TurboVec 则是将其工程化为本地向量索引的独立开源实现。

它的第一性原理与 HNSW 不同。HNSW 用额外的图内存换“少访问向量”，TurboVec 则尝试把每条向量压缩到 2、3 或 4 bit/维，让处理器可以高速扫描大量紧凑码：

1. 先对归一化向量做随机正交旋转，使能量较均匀地分散到各坐标；
2. 利用高维旋转后坐标分布集中的性质，对每个坐标做低比特标量量化；
3. 保存量化码以及恢复内积尺度所需的少量标量；
4. 查询时同样旋转查询向量，预计算查找表，再用 AVX2、AVX-512BW 或 ARM NEON 内核成块扫描量化码并维护 Top-K。

与 PQ 的关键差别是，传统 PQ 通常要从语料训练子空间码本；TurboQuant 是 data-oblivious 的理论方案，不需要依赖语料的 K-means 码本。TurboVec 当前还提供可选的 TQ+ 按坐标校准，但这不改变“新增向量不需要重新训练全局 PQ 码本”的主要生命周期优势。

过滤由调用方先生成外部 ID allowlist 或 slot bitmask。内核以 32 条向量为 block：整个 block 都不允许时直接跳过；block 内个别不允许的项在进入 Top-K heap 时丢弃。这种方式能保证从允许集合中返回最多 K 条，但 TurboVec 自己不负责生成过滤集合——SQL、BM25、ACL 或时间范围索引仍需另一个系统承担。其[官方仓库](https://github.com/RyanCodrai/turbovec)和 [API 文档](https://github.com/RyanCodrai/turbovec/blob/main/docs/api.md)给出了这一执行路径。

优势：

- 不需要 PQ 训练阶段，适合在线追加和数据分布持续变化；
- 紧凑码显著降低内存带宽与容量需求，连续扫描对 SIMD 和 CPU cache 友好；
- 近似误差主要来自量化，不再叠加 HNSW/IVF 候选遗漏；allowlist 过滤也不会因为图断连损失召回；
- 纯本地、库式集成，部署面很小。

劣势：

- 本质仍可能扫描全部或大量压缩码；当 N 极大、过滤不够严格且 QPS 高时，复杂度接近 $O(Nd)$，HNSW/IVF 的候选剪枝更有上限优势；
- 目前主要面向归一化向量和余弦/内积式检索，索引家族、距离类型和 GPU 能力远少于 Faiss；
- 没有数据库级 payload、倒排索引、事务、复制、分片和服务协议，stable-ID 层也不是关系存储；
- 项目在 2026 年仍很年轻，文件格式曾发生不兼容升级；仓库给出的“快于 Faiss”等结果是项目方基准，必须在目标 CPU、维度、bit width 和召回率下独立复现。

适合：单机/边缘/隐私 RAG，内存受限但数据仍能被 CPU 顺序扫描，或已有 SQL/BM25 系统产生候选集合、只需要一个压缩 dense reranker 的场景。它应该与 Faiss 一样被看成索引内核，而不是与 Milvus/Qdrant 等数据库做功能对等比较。

### 4.3 Milvus：segment 是连接实时写入与离线索引的边界

Milvus 的第一性原理选择是：向量索引构建非常吃 CPU/内存，而持久数据便宜地放在对象存储，因此把流式写入、离线建索引和在线查询拆开扩缩容。其[架构文档](https://milvus.io/docs/architecture_overview.md) 将系统分为无状态 Proxy、Coordinator、Streaming/Query/Data worker 和存储层；元数据放在 etcd，WAL 可由 Woodpecker、Pulsar 或 Kafka 等承载，segment 数据和索引文件放对象存储。

新数据先进入 **growing segment**，此时还没有完整 ANN 索引，需要实时路径搜索；segment 封存后成为 **sealed segment**，Data Node 异步构建索引并写回对象存储，Query Node 加载后替换旧的无索引查询路径。[数据处理文档](https://milvus.io/docs/data_processing.md) 说明了“每 segment 一份索引”如何避免每次小更新都重建全局索引。

优势：

- 计算、WAL、元数据和对象存储解耦，适合大规模集群和独立扩缩查询/索引资源；
- 可选择多种索引家族和硬件后端，而不是把产品锁死在一种 HNSW 实现上；
- growing/sealed 双路径兼顾新鲜度与批量索引效率。

劣势：

- 组件多、状态机复杂，故障恢复、版本兼容、缓存预热和容量规划的运维成本最高；
- 多 segment、多 shard 的局部候选归并和数据加载会放大尾延迟；
- 小数据量或单机 RAG 通常无法摊薄分布式架构成本。

适合：向量规模大、数据持续写入、需要独立扩缩容，且团队能运营 Kubernetes、对象存储和分布式状态组件的场景。

### 4.4 Qdrant：让过滤条件成为近邻图的一部分

Qdrant 用 Rust 实现，数据组织为 collection → shard → segment。每个 point 包含一个或多个 dense/sparse vector 和 JSON payload。密集向量索引的核心是 HNSW，segment 负责封装向量、payload 和索引，后台 optimizer 再合并小 segment、清理删除数据或重建索引。

它最有辨识度的设计是 **filterable HNSW**。单独的 payload 倒排索引只能告诉我们哪些 ID 合法，普通 HNSW 只能告诉我们朝哪个邻居走；严格过滤会把大部分邻居剪掉，使图遍历“断路”。Qdrant 的[索引文档](https://qdrant.tech/documentation/manage-data/indexing/)说明，它会基于已索引 payload 值为 HNSW 增加额外边，使过滤与图遍历在同一轮完成。对于组合过滤或大量软删除造成的断连，还可在搜索阶段探索“邻居的邻居”，即 ACORN 思路；代价是更多图访问。

优势：

- 元数据过滤不是外挂功能，而是索引设计的核心，适合过滤组合多、需要稳定返回 K 条的在线检索；
- segment + optimizer 让写入路径与优化后的读路径解耦，单机部署也相对直接；
- Rust 服务、HTTP/gRPC、量化、dense/sparse/hybrid 能力形成较完整的专用向量数据库。

劣势：

- 以 HNSW 为中心意味着图内存和随机访问成本仍是主要约束；on-disk HNSW 能省 RAM，但随机 I/O 会提高尾延迟；
- 新增 payload index 可能触发 segment/HNSW 重建，索引设计需要提前规划；
- 事务与跨集合关系查询不等同于关系数据库。

适合：过滤密集的 RAG、推荐、多租户检索，以及希望用较少组件获得专用向量数据库能力的团队。

### 4.5 Weaviate：LSM 管对象，一张大图管向量

Weaviate 的 shard 是自包含单元，内部有对象 key-value store、倒排索引和向量索引。[存储文档](https://docs.weaviate.io/weaviate/concepts/storage)显示，对象和倒排部分采用 LSM Tree：先写 memtable 和 WAL，再落成不可变有序 segment，后台 compaction；向量部分则有独立的自研 HNSW，并通过 WAL 和快照恢复。

这里最重要的选择是：**不让 HNSW 跟着 LSM 切成很多小图**。LSM segment 容易顺序写和归并，但 HNSW 图不能廉价合并；如果每个 LSM segment 一张小图，查询必须搜索许多图再归并，写放大也会延伸到图重建。因此 Weaviate 尽量在每个 shard 维护一张大的、可变 HNSW，结构化数据和向量索引各用适合自己的生命周期。

过滤时，倒排索引先得到允许集合，再与 HNSW 遍历结合。当前产品也提供 Flat、Dynamic 和 HFresh 等索引选择，详见[向量索引配置](https://docs.weaviate.io/weaviate/config-refs/indexing/vector-index)，因此“HNSW 是默认”不再等于“只有 HNSW”。

优势：

- 对象、倒排和向量是同一 shard 的一等数据，混合搜索和返回完整对象自然；
- 大 HNSW 避免 Lucene 式多 segment 图归并开销；
- 集成向量化、混合检索和多租户，应用层工作量小。

劣势：

- 大图利于查询，却让恢复、内存容量、删除清理和 shard 重平衡更重；快照缓解启动恢复，但增加生命周期管理；
- LSM 与 HNSW 是两套不同结构，需要维护对象、倒排和图之间的一致性；
- 内置模型模块方便，但也扩大部署面和版本耦合。

适合：以对象为中心、需要向量化与 BM25/过滤一体化、希望快速形成 RAG 服务的应用。

### 4.6 Vespa：向量搜索只是召回和排序流水线的一环

Vespa 并不把“向量 Top-K”当作终点，而把它视为 matching/retrieval 阶段。文档向量存为 tensor attribute，HNSW 负责产生候选，然后 rank profile 可以组合向量 closeness、BM25、业务特征和机器学习模型，执行 first-phase、second-phase 或 global-phase 排序。[排序文档](https://docs.vespa.ai/en/basics/ranking.html)体现了它与普通向量库最根本的产品差异。

Vespa 实现了修改版 HNSW，支持单文档多向量、多字段张量和多种低精度 cell。过滤方面不是只固定一种策略：[ANN 文档](https://docs.vespa.ai/en/querying/approximate-nn-hnsw.html)描述了 exact、pre-filter、post-filter、filter-first/ACORN 等路径，系统可依据过滤命中率阈值选择。极严格过滤时，直接对过滤后集合精确扫描可能比在残缺图上漫游更合理。

优势：

- 召回、过滤、混合检索、特征计算和多阶段排序在同一个执行引擎中，减少跨服务搬运候选；
- 对实时更新、复杂 rank expression、多向量文档和在线学习排序支持深；
- 可根据过滤选择性切换算法，而不是一味强制 HNSW。

劣势：

- 学习和配置成本高，schema、query language、tensor type、rank profile 都需要搜索工程经验；
- HNSW 和低延迟 tensor attribute 主要依赖内存，成本模型更像在线搜索服务；
- 如果需求仅是简单向量 CRUD + Top-K，能力显得过重。

适合：搜索、广告、推荐等需要复杂特征与多阶段排序的在线系统，而不仅是简单 RAG 向量库。

### 4.7 Elasticsearch：接受 segment 代价，换取成熟的文档检索语义

Elasticsearch 的向量能力建立在 Lucene 上。Lucene 索引由多个不可变 segment 组成，每个含向量字段的 segment 有自己的 HNSW 图；查询需要在每个 segment 找局部候选、在 shard 内归并，再跨 shard 归并。refresh 生成新 segment，merge 时向量图也必须合并或重建。[Elastic 的设计分析](https://www.elastic.co/search-labs/blog/vector-search-elasticsearch-rationale)明确列出了多图查询和 merge 成本。

这个看似不理想的约束也带来收益：向量与倒排字段共享 doc ID、live docs 和 segment 可见性，因此删除、refresh、过滤与混合搜索能复用 Lucene 的成熟语义。Lucene 可以根据过滤选择性，在“扫描过滤命中文档”和“遍历 HNSW、只收集合法节点”之间选择。

当前 `dense_vector` 不只是原始 HNSW。[官方映射文档](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/dense-vector)列出 int8/int4/binary quantized HNSW、Flat 和磁盘型 `bbq_disk` 等路线；量化索引仍保留原始浮点向量，用于重排和未来重建。这意味着节省的是搜索工作集，不一定同比节省全部磁盘。

优势：

- 全文、结构化过滤、聚合、权限生态、运维工具和向量检索统一；
- segment 不可变带来成熟的近实时可见性、复制、快照和故障恢复模型；
- 量化、预过滤、混合检索和分布式查询持续受益于 Lucene 优化。

劣势：

- 每 segment 一张图导致查询归并和 merge 开销，写入密集时尤其明显；
- Java/Lucene/Elasticsearch 的层次多，向量调优还要同时理解 shard、segment、merge 和 page cache；
- 只做向量搜索时，文档搜索平台的资源与运维开销可能不划算。

适合：已经使用 Elastic、关键词检索占重要地位、需要统一 Query DSL 和成熟搜索运维体系的场景。

### 4.8 pgvector：让向量服从关系数据库的事务和执行器

pgvector 是 PostgreSQL 的 C 扩展，增加 vector/halfvec/bit/sparsevec 类型、距离运算符，以及 HNSW 和 IVFFlat 索引访问方法。它的最大优势并不是发明了新 ANN，而是让向量与关系数据共享 SQL、JOIN、MVCC、WAL、备份、权限和事务。

默认无索引查询是精确扫描。HNSW 无需训练、查询性能通常更好，但建图慢、占用更多内存；IVFFlat 要先有代表性数据训练 K-means，构建快、内存少，但 `lists` 和 `probes` 对召回敏感。项目 [README](https://github.com/pgvector/pgvector) 对两者的权衡和参数有直接说明。

过滤是它与 Qdrant 的关键差别。PostgreSQL 执行 ANN index scan 后，再由执行器检查普通 `WHERE` 条件，可能得不到足够结果。pgvector 的 iterative scan 会自动继续扩大 HNSW 或 IVF 扫描，直到收集足够合法 tuple 或到达上限；也可以通过部分索引、表分区或普通 B-tree 先缩小数据域。

优势：

- 业务数据和向量在同一事务里，避免双写、CDC 和跨系统一致性问题；
- SQL、JOIN、约束、备份、监控和大量托管 PostgreSQL 服务可直接复用；
- 中小规模或强过滤后候选较少时，精确扫描本身就可能足够好。

劣势：

- ANN 过滤不是图原生融合，过滤分布不稳定时，查询延迟和召回更难预测；
- HNSW 的构建、VACUUM 和内存压力与 OLTP 竞争资源；
- 水平分片和跨节点 Top-K 不是扩展自身解决的问题，需要 Citus、应用分片等外部方案。

适合：数据首先是关系数据、要求事务一致性、规模尚可控，希望避免新增数据库的团队。很多 RAG 项目的正确起点是 pgvector，而不是先部署分布式向量库。

### 4.9 LanceDB：把向量索引带到列式文件和对象存储旁边

LanceDB 建立在 Lance 格式上。Lance 是 Arrow-native 列式格式，以 manifest 管理版本，支持快速随机访问和只写新增列的数据演进；数据可以直接放本地文件系统或对象存储。[Lance 格式说明](https://docs.lancedb.com/lance)体现了它的目标：让向量、结构化列和多模态大对象停留在同一个 lakehouse，而不是复制到独立服务。

它传统上以磁盘型 IVF-PQ 为核心：先用 IVF 减少要读的分区，再读取 PQ 短码估算距离，需要时取原始列重排。当前[索引文档](https://docs.lancedb.com/indexing/vector-index)还提供 IVF-HNSW-FLAT/PQ/SQ，即先以 IVF 切分全局空间，再在被选分区内部走 HNSW。这个组合降低单张全局图的内存压力，也意味着查询质量同时受 `nprobes` 和图搜索参数影响。

优势：

- 磁盘/对象存储优先，单位容量成本低，适合大规模冷数据和多模态数据；
- 嵌入式使用，无需先运营一个远程数据库服务；
- 列式扫描、版本化、Arrow/DataFusion 生态适合分析、训练和检索共享数据。

劣势：

- OSS 的索引创建和新数据索引更新通常需要显式管理，实时可见性与后台维护不如服务型数据库自动；
- IVF/PQ 需要训练，数据分布漂移、分区数、probe 数和量化参数都会影响召回；
- 对象存储延迟高且有请求成本，低延迟在线服务仍需要缓存、局部盘或托管层配合。

适合：本地应用、数据科学工作流、多模态数据湖、低成本大容量检索，以及不想维护独立数据库服务的场景。

## 5. 最关键的差异

### 5.1 HNSW 相同，不代表性能模型相同

Qdrant、Weaviate、Vespa、Elasticsearch 和 pgvector 都支持 HNSW，但图的生命周期完全不同：

- Qdrant：segment 内图，optimizer 重建/合并，payload index 还能改变图边；
- Weaviate：每 shard 尽量维持一张大图，与 LSM segment 分离；
- Vespa：图与实时 tensor attribute、过滤决策和排名流水线耦合；
- Elasticsearch：每 Lucene segment 一张不可变图，查询和 merge 都必须处理多图；
- pgvector：图是 PostgreSQL index relation，要遵守 MVCC、WAL、VACUUM 和执行器约束。

因此，只拿 `M=16, efSearch=100` 横向比较没有意义。索引是否分段、页面如何缓存、删除如何处理、过滤在哪里执行，都可能比 HNSW 参数影响更大。

### 5.2 内存优先与磁盘优先

HNSW 每访问一个节点，下一跳地址取决于当前结果，访问模式天然随机。若图和向量在 RAM 中，随机访问很快，但容量贵；全部放磁盘，即使 mmap 简化编程模型，cache miss 仍会转化成随机 I/O。

IVF-PQ 更适合磁盘的原因是访问更可预测：先读少量中心，再顺序读取若干分区中的紧凑编码。代价是训练、量化误差和分区遗漏。因此：

- 热数据、低延迟、高召回：通常偏 HNSW + RAM/大 page cache；
- 十亿级、成本敏感、批量或冷数据：通常偏 IVF + 量化 + SSD/对象存储；
- 单机内存紧张、数据量仍允许顺序扫描：可以测试 TurboVec 这类低比特码 + SIMD 扫描；它省掉图内存，但没有省掉与候选数近似线性的扫描工作；
- 两者都要：IVF-HNSW、量化 HNSW、磁盘图 + 内存压缩向量，或冷热分层。

### 5.3 五种过滤策略

| 策略 | 代表实现 | 优点 | 失败模式 |
|---|---|---|---|
| ANN 后过滤 | pgvector 的基本路径、通用上层方案 | 实现简单 | 合法结果不足 K；选择性越高浪费越大 |
| 先过滤再精确扫描 | Vespa/Lucene 的高选择性分支 | 过滤结果小时精确且快 | 中等候选集会做过多距离计算 |
| allowlist 驱动的压缩扫描 | TurboVec | 对允许集合返回足量结果，无图断连；整块可跳过 | 需要外部系统先生成位图，低选择性时仍扫描大量码 |
| 图遍历时检查允许集合 | Lucene、Weaviate、Vespa | 单次查询融合过滤 | 过滤后图可能断连，召回下降 |
| 为谓词增强图或扩展邻域 | Qdrant filterable HNSW、ACORN 式遍历 | 中等/复杂过滤下更稳 | 索引更大、构建更慢或查询访问更多节点 |

过滤选择性不是常数。同一字段在不同租户、时间段和查询组合下可能从 0.01% 变成 80%，所以能动态切换执行策略的系统通常比“永远先过滤”或“永远后过滤”更稳。

### 5.4 更新模型决定尾延迟

- **原地可变大图**：查询图少，但插入、删除清理、快照和重平衡更重；Weaviate 接近此路线。
- **segment + 后台优化**：前台写入便宜，后台持续 compaction/reindex；Qdrant、Milvus 属于此类。
- **不可变 segment**：一致性和快照语义清晰，但 refresh/merge 带来写放大和多图查询；Elasticsearch 最典型。
- **数据库索引关系**：更新与事务统一，却要接受 MVCC 死元组和 VACUUM；pgvector 属于此类。
- **版本化列式文件**：批量追加、时间旅行和对象存储友好，实时索引维护需要额外机制；LanceDB 属于此类。

平均 QPS 无法暴露这些差异。压测必须持续写入、删除和索引维护，同时观察 P95/P99，而不是先把静态索引建好再只测读取。

## 6. 优势、劣势与选型建议

| 如果最重要的是 | 优先考察 | 原因 | 主要风险 |
|---|---|---|---|
| 自研算法、GPU、极限单机吞吐 | Faiss | 算法组件和硬件优化最完整 | 数据库能力全部自建 |
| 本地隐私、低内存、无需训练的压缩扫描 | TurboVec | TurboQuant 紧凑码、在线追加、CPU SIMD | 新项目；线性扫描上限；不是数据库 |
| 超大规模、存算分离、独立扩缩 | Milvus | 对象存储 + 专职 worker + 多索引后端 | 架构和运维复杂 |
| payload 过滤、多租户在线向量服务 | Qdrant | 过滤与 HNSW 深度融合 | 图内存和后台重建成本 |
| 快速构建带向量化的对象/RAG 数据库 | Weaviate | 对象、倒排、向量、模型模块一体 | 大图生命周期和内存成本 |
| 复杂混合召回、业务特征、多阶段排序 | Vespa | 检索到排序的一体化执行引擎 | 学习与配置成本高 |
| 已有全文检索/日志搜索平台 | Elasticsearch | Lucene/Elastic 生态和统一查询 | segment 图 merge 与资源开销 |
| 事务、JOIN、少运维、中等规模 | pgvector | 与业务关系数据保持一个真相源 | 分片和复杂过滤 ANN 上限 |
| 嵌入式、本地/对象存储、数据湖工作流 | LanceDB | 列式磁盘格式、版本化、低容量成本 | OSS 实时索引维护较手动 |

一个实用的决策顺序是：

1. **能否精确扫**：先测过滤后的候选量。如果单机 SIMD/多核/GPU 精确扫描已满足目标，不要过早引入 ANN。
2. **是否必须与事务数据同库**：是则先测 pgvector；一致性和运维收益往往大于专用引擎的理论 QPS。
3. **单机是否受内存而非 CPU 限制**：若 float32/HNSW 放不下，但压缩后的全量扫描仍能达到延迟目标，测试 TurboVec；若 CPU 扫描已成为瓶颈，再转向 HNSW/IVF 候选剪枝。
4. **主导查询是纯向量还是混合检索**：纯向量且过滤重，优先 Qdrant；全文和向量同等重要，考察 Elasticsearch/Weaviate；复杂排序，考察 Vespa。
5. **容量是否必须下沉到磁盘/对象存储**：是则重点测试 LanceDB 的 IVF 系列、Milvus 的对象存储架构以及支持磁盘索引的产品路径。
6. **是否真的需要分布式**：只有数据、吞吐或可用性跨过单机边界时，Milvus/Elasticsearch 等集群复杂度才有回报。

## 7. 应该怎样做公平基准测试

不要直接引用厂商 QPS 排名。至少固定以下变量：

1. 数据集：向量数量、维度、距离度量、分布、重复率；
2. 质量：以 exact Flat 为真值，报告 Recall@K 或 NDCG，而不是只报延迟；
3. 查询：并发、批大小、Top-K、过滤选择性和过滤组合；
4. 更新：插入/更新/删除比例，是否在后台 merge、compact、build index；
5. 资源：CPU 型号、SIMD 指令集、RAM、SSD、GPU、网络、对象存储缓存；
6. 稳态：包含预热与冷启动，报告 P50/P95/P99、索引构建时间、磁盘和内存；
7. 分布式：报告每 shard 候选数和归并策略，确认扩容后召回率没有因局部 Top-K 改变。

最容易误导的测试是：所有数据已进 RAM、没有过滤和更新、只报告平均延迟。这样的测试衡量的是某段 ANN kernel，而不是数据库在真实数据生命周期中的表现。

## 8. 结论

从第一性原理看，向量搜索引擎没有单一赢家：

- Faiss 优化的是算法和硬件利用；
- TurboVec 优化的是无训练低比特表示与 CPU SIMD 扫描；
- Milvus 优化的是大规模资源解耦和 segment 生命周期；
- Qdrant 优化的是带 payload 过滤的图搜索；
- Weaviate 优化的是对象/倒排 LSM 与大 HNSW 的协作；
- Vespa 优化的是从候选召回到复杂排序的完整在线流水线；
- Elasticsearch 优化的是向量与成熟 Lucene 文档搜索语义的统一；
- pgvector 优化的是向量与关系数据的事务一致性；
- LanceDB 优化的是向量与多模态列式数据在本地磁盘/对象存储上的共存。

选型时最重要的不是问“谁的 HNSW 更快”，而是明确自己的主要成本来自距离计算、内存、过滤、持续更新、分布式归并还是系统运维。不同引擎只是对这些成本做了不同排序。

## 参考资料

- [HNSW 原始论文](https://arxiv.org/abs/1603.09320)
- [Product Quantization for Nearest Neighbor Search](https://ieeexplore.ieee.org/document/5432202)
- [ACORN: Performant and Predicate-Agnostic Search](https://arxiv.org/abs/2403.04871)
- [Faiss 官方文档](https://faiss.ai/)与[索引选择指南](https://github.com/facebookresearch/faiss/wiki/Guidelines-to-choose-an-index)
- [TurboQuant: Online Vector Quantization with Near-optimal Distortion Rate](https://proceedings.iclr.cc/paper_files/paper/2026/hash/5c802ef38ab6e366c2ea06eee554c088-Abstract-Conference.html)
- [TurboVec 官方仓库](https://github.com/RyanCodrai/turbovec)与 [API 文档](https://github.com/RyanCodrai/turbovec/blob/main/docs/api.md)
- [Milvus 架构](https://milvus.io/docs/architecture_overview.md)与[数据处理](https://milvus.io/docs/data_processing.md)
- [Qdrant Indexing](https://qdrant.tech/documentation/manage-data/indexing/) 与 [Storage](https://qdrant.tech/documentation/concepts/storage/)
- [Weaviate Storage](https://docs.weaviate.io/weaviate/concepts/storage) 与 [Vector Index](https://docs.weaviate.io/weaviate/concepts/vector-index)
- [Vespa HNSW](https://docs.vespa.ai/en/querying/approximate-nn-hnsw.html) 与 [Ranking](https://docs.vespa.ai/en/basics/ranking.html)
- [Elasticsearch dense_vector](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/dense-vector) 与 [Lucene 集成设计](https://www.elastic.co/search-labs/blog/vector-search-elasticsearch-rationale)
- [pgvector 官方仓库与文档](https://github.com/pgvector/pgvector)
- [LanceDB Vector Indexes](https://docs.lancedb.com/indexing/vector-index) 与 [Lance Format](https://docs.lancedb.com/lance)
