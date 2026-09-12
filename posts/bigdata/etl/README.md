---
title: "ETL 调研：流程、开源组件与事实上的协议标准"
date: 2026-09-11
lastmod: 2026-09-11
draft: false
tags: ["ETL", "ELT", "数据集成", "数据工程", "开源"]
categories: ["大数据"]
---

# ETL 调研：流程、开源组件与事实上的协议标准

> 范围：只列开源项目或有明确开源核心的项目；不把闭源 SaaS（例如 Fivetran、Matillion）当作组件。版本和连接器能力会变化，落地前仍应检查项目仓库的许可证、维护状态和目标版本。

## 1. ETL 到底是什么

ETL 是 **Extract（抽取）→ Transform（转换）→ Load（加载）**。实际项目通常不是一条直线，而是一个可重跑、可观测、可恢复的有向图：

```text
需求/数据契约
    ↓
源端抽取（全量、增量、CDC）
    ↓
落地区（raw/bronze，保留原始记录和批次）
    ↓
解析与校验（schema、类型、去重、脏数据隔离）
    ↓
转换（清洗、映射、Join、聚合、脱敏、业务规则）
    ↓
质量门禁（完整性、唯一性、及时性、分布漂移）
    ↓
加载/发布（仓库、湖表、OLTP、搜索、向量库、消息队列）
    ↓
编排、监控、血缘、审计、告警、重试与回放
```

### 1.1 运行模式

| 模式 | 特征 | 适用场景 |
| --- | --- | --- |
| 批处理 ETL | 按时间或事件触发，处理有限数据集 | 日/小时报表、历史回灌 |
| ELT | 先 Extract+Load 到仓库/湖，再用 SQL 转换 | 云数仓、希望保留原始数据 |
| EtLT | 抽取后做轻量类型/格式转换，再加载，重转换下沉到仓库 | SeaTunnel 等数据搬运工具的常见定位 |
| 流式 ETL | 持续消费无界事件，按窗口和状态计算 | 实时指标、风控、推荐 |
| CDC | 读取数据库 WAL/binlog/redo log，只传递变更 | 低延迟同步、缓存/湖仓复制 |

无论采用哪种模式，都应明确：水位（bookmark）、幂等键、删除语义、迟到数据、重试边界、schema 演进和回放策略。ETL 工具不会自动替业务决定这些语义。

## 2. 各阶段的开源组件

### 2.1 抽取、连接器和 CDC

| 组件 | 定位 | 适合与注意点 |
| --- | --- | --- |
| [Airbyte Open Source](https://github.com/airbytehq/airbyte) | API、数据库、文件到仓库/湖/数据库的连接器平台；官方文档称有 600+ 连接器，连接器大多开源 | 连接器覆盖广，适合 ELT；需逐个核对连接器许可证、增量方式和维护质量 |
| [Meltano](https://docs.meltano.com/) + [Singer](https://hub.meltano.com/singer/spec/) | CLI 优先的 EL(T) 组合器；tap 负责抽取、target 负责加载，以 JSONL 消息流连接 | 小而可组合，适合自建连接器；不同 tap/target 的质量差异较大 |
| [dlt](https://github.com/dlt-hub/dlt) | Python 库，自动处理 schema、规范化、增量状态和加载 | 适合代码优先的小型/中型管道及 notebook；复杂调度仍需外部编排器 |
| [Apache SeaTunnel](https://seatunnel.apache.org/) | Source–Transform–Sink 统一 API，可运行在 SeaTunnel Zeta、Flink 或 Spark | 批、流、CDC 和多模态搬运；同一连接器跨引擎复用，需确认版本、驱动和 exactly-once 能力 |
| [Apache NiFi](https://nifi.apache.org/) | FlowFile/Processor 图形化数据流和系统间介 | 强项是路由、背压、协议适配与细粒度 provenance；大规模复杂计算应交给 Spark/Flink |
| [Kafka Connect](https://kafka.apache.org/documentation/#connect) | Kafka 的 source/sink connector runtime | 适合作为消息总线边界；连接器负责外部系统读写，转换和业务逻辑不应堆在 Connect 中 |
| [Debezium](https://debezium.io/) / [Flink CDC](https://github.com/apache/flink-cdc) | 基于数据库日志的开源 CDC | 延迟低且避免轮询；需要配置权限、快照、DDL、事务顺序和 delete/tombstone 语义 |

Airbyte、Meltano/Singer、SeaTunnel 是“连接器平台”；NiFi、Kafka Connect 更偏“运行时/数据流骨架”；Debezium/Flink CDC 是“变化捕获”。不要把它们与调度器混为一类。

### 2.2 转换和计算

| 组件 | 主要抽象 | 典型用途 |
| --- | --- | --- |
| [dbt Core](https://github.com/dbt-labs/dbt-core) | SQL 模型、依赖 DAG、测试、文档和增量模型 | ELT 中仓库内的业务转换；它本身不是抽取器或加载器 |
| [Apache Spark](https://spark.apache.org/sql/) | 分布式 DataFrame/Spark SQL | 大规模批处理、湖表写入、复杂 Join |
| [Apache Flink](https://flink.apache.org/what-is-flink/flink-applications/) | 有状态的无界/有界流处理，统一批流语义 | 实时 ETL、窗口、事件时间、复杂状态 |
| [DuckDB](https://duckdb.org/) | 进程内 OLAP SQL | 本地文件、对象存储上的 Parquet 分析和轻量 ELT |
| [Polars](https://github.com/pola-rs/polars) | Rust 引擎 + Python/R 等 API 的 DataFrame | 单机高性能转换、嵌入式数据处理 |
| [Trino](https://trino.io/) | 分布式联邦 SQL | 跨湖、仓库和数据库查询/转换 |

### 2.3 存储、表格式和数据交换

- **文件格式**：[Apache Parquet](https://parquet.apache.org/) 是分析场景的列式文件事实标准之一；CSV/JSON 兼容性最好但类型、压缩和 schema 约束较弱。
- **流式序列化**：[Apache Avro](https://avro.apache.org/docs/) 将 schema 与数据绑定，常与 Kafka/Schema Registry 配合；Protobuf 适合服务接口和事件，但需要团队统一 schema 演进规则。
- **内存/跨语言交换**：[Apache Arrow](https://arrow.apache.org/docs/format/Columnar.html) 定义语言无关的列式内存布局、IPC 和 Flight 生态，适合作为计算引擎之间的中间层。
- **湖表事务层**：[Apache Iceberg](https://iceberg.apache.org/spec/)、[Apache Hudi](https://hudi.apache.org/) 和 [Delta Lake](https://github.com/delta-io/delta) 都是开源表格式。Iceberg 以开放规范、多引擎读写和 schema/partition evolution 见长；Hudi 偏增量摄取和近实时更新；Delta 生态与 Spark 结合紧密。三者不是“文件格式”，底层通常仍是 Parquet/Avro/ORC。
- **对象存储**：[MinIO](https://github.com/minio/minio)（S3 API）可用于自建落地区；生产使用需关注其许可证和版本策略。

### 2.4 编排、质量、血缘和目录

| 能力 | 开源组件 | 说明 |
| --- | --- | --- |
| 调度/编排 | [Apache Airflow](https://airflow.apache.org/)、[Dagster](https://docs.dagster.io/)、[Prefect](https://docs.prefect.io/)、[Kestra](https://kestra.io/docs)、[Apache DolphinScheduler](https://dolphinscheduler.apache.org/)、[Argo Workflows](https://argo-workflows.readthedocs.io/) | Airflow 以 DAG 和批工作流最成熟；Dagster 以 data asset/血缘为中心；Prefect 以 Python flow/task 和动态运行见长；Kestra 以声明式 YAML、多语言任务和事件驱动为卖点 |
| 数据质量 | [Great Expectations](https://github.com/great-expectations/great_expectations)、[Deequ](https://github.com/awslabs/deequ)、[Soda Core](https://github.com/sodadata/soda-core) | 将质量检查作为发布前门禁；检查结果应和批次、数据版本、血缘关联 |
| 元数据/目录 | [OpenMetadata](https://github.com/open-metadata/OpenMetadata)、[DataHub](https://github.com/datahub-project/datahub)、[Amundsen](https://github.com/amundsen-io/amundsen) | 资产搜索、schema、所有者、质量和血缘；目录本身不是 ETL 执行器 |
| 血缘标准 | [OpenLineage](https://openlineage.io/) + [Marquez](https://marquezproject.ai/) | 用 Job、Run、Dataset 和 Facet 描述运行级血缘，能跨 Airflow、Spark、dbt 等系统汇聚 |

## 3. ETL 之间到底通过什么协议通信

没有一个覆盖所有 ETL 产品的“ETL 协议”。工程上通常按边界选择协议：

| 边界 | 常见协议/格式 | 事实上的标准程度 | 建议 |
| --- | --- | --- | --- |
| API/SaaS → 抽取器 | HTTPS、REST、JSON、OAuth2、Webhook、分页/限流约定 | **很高，但语义不统一** | 连接器必须记录游标、速率限制、重试和幂等行为 |
| 数据库 → ETL | SQL、JDBC、ODBC；CDC 使用 WAL/binlog/redo log | **JDBC/ODBC/SQL 很高；CDC 无统一线协议** | OLTP 读写优先 JDBC/ODBC；实时复制优先 Debezium/Flink CDC 事件契约 |
| 文件/对象存储 → ETL | S3 API、SFTP、POSIX、CSV/JSON/Parquet/Avro | **S3 + Parquet 很高** | 原始区保留不可变文件、校验和、schema 版本和摄取时间 |
| 连接器 → 连接器 | Singer JSONL（SCHEMA/RECORD/STATE）、Airbyte Protocol、SeaTunnel Source/Transform/Sink API | **Singer 在其生态内成熟；Airbyte/SeaTunnel 是各自平台标准** | 需要跨平台复用时优先 Singer 或自定义稳定 JSON/Avro 契约 |
| 事件总线 → 流处理 | Kafka 协议、Kafka Connect、Avro/Protobuf/JSON Schema、Schema Registry | **Kafka 生态事实标准** | 用 schema compatibility（backward/forward）约束演进，不要只靠示例 JSON |
| 计算引擎 → 计算引擎 | Arrow C Data/IPC、Arrow Flight、Parquet、JDBC/ODBC | **Arrow（内存）+ Parquet（文件）最通用** | 大表避免 CSV 往返；跨语言优先 Arrow/Parquet |
| ETL → 湖仓表 | Iceberg/Hudi/Delta 的 table/commit protocol | **Iceberg 正在成为多引擎开放表协议的首选之一，但不是唯一标准** | 选定一个表格式和 catalog，验证 Spark/Flink/Trino/DuckDB 的读写矩阵 |
| ETL → 血缘/观测 | OpenLineage JSON/HTTP；OpenTelemetry traces/metrics/logs | **OpenLineage 是数据血缘事实标准候选；OTel 是通用可观测性标准** | 把 run、dataset、schema、质量结果关联起来 |

### 3.1 Singer 消息为何重要

Singer 把 tap 和 target 解耦为标准输入输出：tap 向 stdout 输出 JSONL，target 从 stdin 读取；三类核心消息是 `SCHEMA`、`RECORD`、`STATE`。`STATE` 保存每个 stream 的 bookmark，使增量同步可以从上次位置继续。这个协议简单、可用 Unix pipe 组合，是开源 ELT 中最接近“连接器 ABI”的协议，但它不是全行业标准。

### 3.2 CDC 事件不能假定跨厂商一致

Debezium 事件通常包含 `before`、`after`、`op`、source 位点和事务信息；不同数据库、连接器和配置对快照、DDL、tombstone、主键更新的表达会不同。要跨工具传递 CDC，应在平台边界定义自己的 canonical envelope，并明确：

```json
{
  "event_id": "稳定且可去重的事件 ID",
  "source": "库/表/分区",
  "op": "c|u|d|r",
  "occurred_at": "源端事件时间",
  "transaction": {"id": "可选", "order": 0},
  "schema_version": "版本",
  "key": {},
  "before": {},
  "after": {}
}
```

## 4. 哪些可以称为“事实上的标准”

这里的“事实标准”是生态采用和互操作性形成的惯例，不等于 ISO/IEC 正式标准：

1. **SQL + JDBC/ODBC**：关系数据库和 BI/ETL 工具之间最稳定的共同语言。
2. **HTTPS/REST/JSON + OAuth2**：SaaS/API 抽取的默认组合；认证和分页语义仍由供应商定义。
3. **Kafka 协议 + Kafka Connect**：事件流和 source/sink connector 的主流生态接口。
4. **Parquet**：湖仓分析文件的主流列式格式；Arrow 是跨语言内存交换的主流格式。
5. **Avro/Protobuf/JSON Schema + Registry**：带 schema 的事件序列化组合；没有唯一赢家，关键是兼容性策略。
6. **Iceberg/Hudi/Delta**：开放表格式的三大阵营；若目标是跨厂商/跨引擎，Iceberg 的开放规范和 REST Catalog 通常更容易作为中立边界。
7. **OpenLineage**：跨编排器、计算引擎和转换工具传递运行血缘的开放规范；它比各工具私有 lineage API 更适合平台集成。
8. **Singer**：开源 tap/target 连接器之间的轻量协议；应称为“开源 ELT 生态事实标准”，不要夸大为行业统一标准。

## 5. `posts/tool/anything.md` 中与 Agent 相关的 ETL 调研

下列项目在 `anything.md` 的“数据工程与存储”栏目出现，和 Agent 的上下文、知识库或自然语言集成有关：

| 项目 | Agent 相关能力 | 判断 |
| --- | --- | --- |
| [CocoIndex](https://cocoindex.io/docs/) | 面向 AI 的增量数据转换/索引；声明 `target = f(source)`，只重算变化部分，提供端到端 lineage，可输出关系库、向量库、图数据库等 | 最像“Agent ETL”：解决知识库/上下文持续新鲜和大模型调用成本问题；仍需评估连接器和目标库生态成熟度 |
| [Airbyte Agents](https://docs.airbyte.com/) | Airbyte 文档已将其定位为 AI Agent 的 data/context layer，提供开源类型安全连接器、MCP、Python SDK、HTTP API 和 Connect–Ask–Act 模型 | 适合让 Agent 查询/操作企业数据；权限、凭据、提示注入和数据泄露防护必须由平台治理 |
| [Superglue](https://github.com/superglue-ai/superglue) | 用自然语言描述集成，自动处理鉴权、分页、字段映射，并尝试自修复连接器；可连接 ERP、CRM、数据库和 AI 平台 | 更接近“Agent 驱动的连接器生成/维护”，不是传统批处理引擎；生产使用应保留人工审批、契约测试和回滚 |
| [dlt](https://github.com/dlt-hub/dlt) | Python 代码优先，仓库明确强调 LLM-friendly workflow，可从大量来源抽取并自动完成 schema/加载 | 适合作为 Agent 生成和运行的轻量 ingestion SDK；调度、权限和质量仍需补齐 |
| [Marmot](https://github.com/marmotdata/marmot) | 数据目录、搜索、血缘图，并提供 CLI/API/MCP 插件 | 它是 Agent 的“数据发现/元数据工具”，不是 ETL 执行器；可作为规划阶段的工具调用对象 |
| [QMD](https://github.com/tobi/qmd) | 本地 BM25 + 向量 + LLM 重排，支持 MCP | 属于索引/检索层，不负责通用抽取和加载；适合把 ETL 产物变成 Agent 可检索上下文 |
| [Kestra](https://kestra.io/docs) / [Prefect](https://docs.prefect.io/) | 编排器可调度数据、ML 和 Agent 任务；支持事件触发、重试、状态和人工介入 | 它们解决“何时、以什么依赖运行”，不替代连接器、转换引擎和数据契约 |
| [Apache Iceberg](https://iceberg.apache.org/) / Supabase Analytics Buckets | 以开放湖表承载可被多个引擎和 Agent 查询的历史数据 | 是 Agent 数据底座，不是 Agent 专用 ETL；应配合权限、目录和质量治理 |

### Agent 场景的额外设计要求

- **工具契约**：给 Agent 暴露的是受限的查询/同步工具，而不是任意 SQL、任意 shell 或全库凭据。
- **可追溯**：保存 prompt、工具调用、输入数据版本、输出 dataset 和 OpenLineage run-id，做到回答可回放。
- **增量优先**：知识库和向量索引应按文件/记录指纹、CDC 位点或时间水位更新，避免每次全量调用模型。
- **人审与回滚**：字段映射、删除操作、schema 变更和跨系统写入应支持 dry-run、审批、幂等和补偿。
- **数据安全**：脱敏、租户隔离、最小权限、出站域名白名单、提示注入防护和审计不能交给模型自行决定。

## 6. 一套可落地的开源组合

### 方案 A：批量仓库（中小团队）

`Airbyte 或 Meltano/Singer → 对象存储/仓库 → dbt Core + DuckDB/Trino → Airflow/Dagster → Great Expectations + OpenLineage`

### 方案 B：实时 CDC 湖仓

`Debezium/Flink CDC → Kafka → Flink 或 SeaTunnel → Iceberg + Parquet → Trino/Spark/DuckDB`

### 方案 C：Agent 知识库

`CocoIndex 或 dlt → 文档解析/切分/embedding → Postgres/向量库/图数据库 → QMD 或自建 MCP → Agent`

三种方案都应把原始数据、状态（水位）、schema、质量结果和 lineage 持久化；否则“能跑”不等于可运营。

## 7. 选型检查清单

1. 数据量、延迟和一致性：批、流还是 CDC？是否需要 exactly-once？
2. 连接器：是否支持全量/增量/删除/限流/断点续传？许可证和维护者是否可信？
3. 契约：schema 是否版本化？字段删除、类型放宽、主键变更如何处理？
4. 运行：是否有重试、幂等、死信、回放、背压、告警和审计？
5. 目标：使用 Parquet/Arrow/Avro 还是湖表格式？需要哪些引擎互读？
6. 治理：数据质量、PII 脱敏、血缘、访问控制和租户隔离是否可验证？
7. Agent：是否提供最小权限工具、人工审批和可回放记录？不要因为有 MCP 就默认安全。

## 参考资料（官方）

- [Apache NiFi User Guide](https://nifi.apache.org/nifi-docs/user-guide.html)
- [Airbyte documentation](https://docs.airbyte.com/)
- [Meltano Singer Specification](https://hub.meltano.com/singer/spec/)
- [Apache SeaTunnel documentation](https://seatunnel.apache.org/docs/)
- [Apache Airflow documentation](https://airflow.apache.org/docs/)
- [OpenLineage specification](https://github.com/OpenLineage/OpenLineage/blob/main/spec/OpenLineage.md)
- [Apache Arrow format](https://arrow.apache.org/docs/format/Columnar.html)
- [Apache Parquet](https://parquet.apache.org/docs/)
- [Apache Avro specification](https://avro.apache.org/docs/)
- [Apache Iceberg table specification](https://iceberg.apache.org/spec/)
- [CocoIndex documentation](https://cocoindex.io/docs/)
- [Superglue GitHub](https://github.com/superglue-ai/superglue)
- [Prefect documentation](https://docs.prefect.io/)
- [Dagster documentation](https://docs.dagster.io/)
- [Kestra documentation](https://kestra.io/docs)

