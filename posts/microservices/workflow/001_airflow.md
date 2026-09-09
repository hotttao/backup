# Apache Airflow 深入调研：数据编排、任务恢复与人工参与

调研日期：2026-09-09。调研问题见 [question.md](./question.md)。本文以 Airflow 3.3.x 架构为基线；Airflow 2.x 的 Webserver、DAG Processor、Worker 数据库访问和 Human-in-the-Loop 行为存在明显差异，不能直接套用本文结论。

## 1. 结论先行

Apache Airflow 是一个以 **DAG、批次、数据区间和任务实例** 为中心的代码式工作流编排平台。它最擅长回答：某个数据周期应该创建哪次运行、哪些依赖已经满足、哪些任务可以并发执行、失败任务如何重试、历史区间如何补跑。

Airflow 适合：

- 定时 ETL/ELT、报表、数据同步和数仓分层；
- 数据清洗、训练、评估、批量推理等 ML/AI Pipeline；
- 每日或每小时批量采集选题、生成内容、统计运营指标；
- 任务主要是 Python、Shell、SQL、Spark、Kubernetes Pod 或云服务 Job；
- 需要按逻辑日期重跑、补数、查看历史批次和上下游依赖。

Airflow 3.1 起提供 Human-in-the-Loop Operator，3.3 又增加专门的 `awaiting_input` 状态。因此它现在可以原生等待人工输入、审核或分支选择。不过它的主模型仍然是数据 DAG。对于单个订单或 Agent 会话持续数天、频繁接收外部消息、要求从函数状态精确恢复的流程，Temporal 更自然；对于 BPMN、候选组、转办、会签和复杂表单，Flowable 更完整。

| 维度 | 结论 |
|---|---|
| 项目类型 | 数据工作流编排、批处理调度平台 |
| 基金会 | Apache Software Foundation 顶级项目 |
| CNCF | 不是 CNCF 托管项目；`cncf-kubernetes` Provider 只是集成包名称 |
| 许可证 | Apache-2.0 |
| 受欢迎程度 | 调研时 GitHub 主仓库约 46.8k Star、17.8k Fork |
| 主要语言 | Python；任务可调用其他语言和外部计算系统 |
| 当前项目匹配度 | 适合 `media_agent` 的批量采集、批量生成、统计和周期性运营；不建议独自承担全部在线 Agent 会话状态 |

## 2. 示例：每日内容生产与人工发布审核

用一条按天运行的数据流水线贯穿本文：

```text
每天 01:00 为前一天创建 DagRun
   -> 抽取热点和历史运营数据
   -> 清洗、去重、生成选题候选
   -> 并行生成文案/封面/视频草稿
   -> 质量检查与汇总
   -> 等待运营人员审核
      ├─ 通过 -> 发布候选内容
      └─ 拒绝 -> 保存原因、不发布
   -> 汇总本批次指标
```

这个例子符合 Airflow 的主模型：每个 DagRun 对应明确的数据区间，任务之间有稳定依赖，失败步骤可按 TaskInstance 重试，并且可以补跑过去某一天。人工审核是批次中的一个检查点，而不是一个长期存在、不断收发消息的业务实体。

### 2.1 核心抽象

| 抽象 | 含义 | 示例中的对应物 |
|---|---|---|
| Dag | 有向无环的任务定义 | `daily_media_pipeline` |
| DagRun | Dag 的一次运行 | 处理 2026-09-08 数据的运行 |
| logical date / data interval | 运行所代表的业务时间和数据窗口 | `[09-08 00:00, 09-09 00:00)` |
| Task | Operator 或 TaskFlow 函数定义 | `generate_candidates` |
| TaskInstance | 某 Task 在某 DagRun 中的执行实例 | 09-08 批次的一次生成任务 |
| Operator | 可复用任务模板 | Python、Bash、SQL、KubernetesPod、HITL |
| Sensor | 等待某个外部条件 | 等待对象存储文件到达 |
| XCom | TaskInstance 间的小型元数据 | 产物 URI、计数、质量分数 |
| Asset | 由 URI 标识的数据逻辑对象 | `s3://media/topics/2026-09-08.json` |
| Pool | 限制一类任务的全局并发资源 | LLM API 并发额度 |
| Executor | Scheduler 把 TaskInstance 放到哪里执行的插件 | CeleryExecutor、KubernetesExecutor |
| Dag Bundle | DAG 文件及相关资源的部署和版本单元 | Git 仓库中的工作流目录 |

最容易误解的是 `logical_date`。每日 DagRun 通常在数据区间结束后才被 Scheduler 创建和执行，因此 UI 看上去像“晚一天”。业务 SQL 应使用 `data_interval_start` 和 `data_interval_end`，不能用任务真正启动的机器时间推断处理区间。

### 2.2 Airflow 3 DAG 示例

```python
from datetime import timedelta

import pendulum
from airflow.sdk import dag, task
from airflow.providers.standard.operators.hitl import ApprovalOperator


@dag(
    dag_id="daily_media_pipeline",
    schedule="0 1 * * *",
    start_date=pendulum.datetime(2026, 9, 1, tz="Asia/Shanghai"),
    catchup=True,
    max_active_runs=2,
    tags=["media", "agent"],
)
def daily_media_pipeline():
    @task(retries=3, retry_delay=timedelta(minutes=2))
    def collect_and_generate(**context) -> dict:
        # 大文件放对象存储；这里只返回小型元数据和 URI。
        interval = {
            "start": context["data_interval_start"].isoformat(),
            "end": context["data_interval_end"].isoformat(),
        }
        return run_generation_job(interval, idempotency_key=context["run_id"])

    @task
    def publish(result: dict):
        publish_batch(
            manifest_uri=result["manifest_uri"],
            idempotency_key=result["batch_id"],
        )

    generated = collect_and_generate()

    approve = ApprovalOperator(
        task_id="human_review",
        subject="是否发布本批次候选内容？",
        body="候选清单：{{ ti.xcom_pull(task_ids='collect_and_generate')['manifest_uri'] }}",
        defaults="Reject",
        response_timeout=timedelta(hours=24),
        fail_on_reject=True,
    )

    generated >> approve >> publish(generated)


daily_media_pipeline()
```

示例只传 `manifest_uri` 等元数据。视频、图片和批量文本应放对象存储或数据仓库，不能把 XCom 当作数据总线。

## 3. 三节点集群架构

### 3.1 Airflow 3 的组件

| 组件 | 是否必需 | 职责 |
|---|---|---|
| Scheduler | 必需 | 创建 DagRun、检查依赖、把可运行 TaskInstance 提交给 Executor |
| Executor | 必需配置 | Scheduler 内的执行策略，不是独立守护进程 |
| DAG Processor | 必需 | 从 Dag Bundle 解析用户 DAG 代码，并序列化到 Metadata DB |
| API Server | 必需 | REST API、Web UI，以及 Airflow 3 Worker 的 Task Execution API |
| Metadata Database | 必需 | DAG/版本、DagRun、TaskInstance、XCom、变量、连接等控制状态 |
| Worker | 视 Executor 而定 | 执行 Task；Celery 是常驻 Worker，Kubernetes 是逐任务 Pod |
| Triggerer | 可选 | 在 asyncio 事件循环中运行 Trigger，承接可延迟任务的等待 |
| Dag Bundle | 必需 | DAG 代码和相关资源的来源，可以是本地、Git 或 Provider 实现 |

Airflow 3 中 DAG Processor 必须独立存在。Scheduler 使用数据库里的 Serialized DAG 做调度，不需要执行 DAG 作者的代码；API Server 也从数据库展示 DAG。Worker 运行任务时通过 Task Execution API 汇报心跳、状态、XCom，以及读取 Connection/Variable，而不是让任务代码直接操作 Metadata DB。

### 3.2 三台机器的 CeleryExecutor 布局

如果是三台普通虚拟机，CeleryExecutor 比 KubernetesExecutor 更便于说明：

```text
                        ┌──────────────────────────┐
Browser / REST Client ->│ Load Balancer            │
                        └────────────┬─────────────┘
                                     │
             ┌───────────────────────┼────────────────────────┐
             │                       │                        │
┌────────────▼────────────┐ ┌────────▼────────────┐ ┌─────────▼───────────┐
│ Node A                  │ │ Node B              │ │ Node C              │
│ API Server A            │ │ API Server B        │ │ API Server C        │
│ Scheduler A             │ │ Scheduler B         │ │ Scheduler C         │
│ DAG Processor A         │ │ DAG Processor B     │ │ Triggerer           │
│ Celery Worker A         │ │ Celery Worker B     │ │ Celery Worker C     │
└────────────┬────────────┘ └────────┬────────────┘ └─────────┬───────────┘
             └───────────────────────┼────────────────────────┘
                                     │
            ┌────────────────────────▼─────────────────────────┐
            │ HA PostgreSQL / MySQL Metadata DB                │
            │ HA RabbitMQ or Redis Celery Broker               │
            │ DB-backed Celery Result Backend                  │
            │ GitDagBundle + S3/OSS remote logs and artifacts  │
            └──────────────────────────────────────────────────┘
```

生产布局应注意：

- Scheduler 可运行多个副本，并通过 Metadata DB 的行锁协调关键调度区；不需要 ZooKeeper、Consul、Raft 或 Scheduler 间直连共识；
- API Server 至少两个副本，经负载均衡对外；
- DAG Processor 和 Triggerer 也应避免单点。上图受三台机器限制做了简化，实际可在每台机器运行多个独立进程或使用 Kubernetes Deployment；
- 三台 Airflow 机器不等于完整高可用：Metadata DB、Broker、日志和 DAG 来源都必须独立高可用；
- Celery Worker 可根据 `queue` 拆成 `default`、`llm`、`video` 等资源池；同类 Worker 至少跨两台机器；
- 使用 GitDagBundle 等带版本的来源，让同一 DagRun 使用固定代码版本；本地目录 Bundle 没有版本能力；
- 日志和业务产物放 S3、GCS、OSS/MinIO 等远端存储，不能依赖临时 Worker 本地盘。

### 3.3 KubernetesExecutor 变体

已有 Kubernetes 时，可以不用 Celery Broker。KubernetesExecutor 运行在 Scheduler 进程中，通过 Kubernetes API 为每个 TaskInstance 创建独立 Pod；Pod 运行任务、汇报结果后退出。它提供更强的任务级资源和依赖隔离，代价是 Pod 启动延迟和 Kubernetes 运维成本。

因此 Airflow 的 Queue 依赖取决于 Executor：

- LocalExecutor：Scheduler 本机进程执行，无外部任务 Broker；
- CeleryExecutor：使用 Celery Broker，常见为 RabbitMQ、Redis 或 Redis Sentinel；
- KubernetesExecutor：Kubernetes API 和待创建/运行 Pod 承担任务交付，无 Celery Broker；
- 其他 Batch/Edge/自定义 Executor：由具体实现决定队列或计算后端。

## 4. 调度主流程

以每日 DagRun 为例：

1. DAG Processor 从 Dag Bundle 加载 Python 文件，执行顶层定义代码，生成 DAG 对象；
2. DAG 被序列化成 JSON 结构写入 Metadata DB；
3. Scheduler 根据 Timetable、`start_date` 和已有运行，为结束的数据区间创建 DagRun；
4. Scheduler 检查 TaskInstance 的上游状态、Trigger Rule、Pool、并发限制等条件；
5. 多 Scheduler 通过数据库行锁保护“从 scheduled 转成 queued”的关键区；
6. Scheduler 中的 Executor 把 TaskInstance 交给本地进程、Celery Broker 或 Kubernetes API；
7. Worker 取得对应 Dag Bundle 版本，实例化并执行任务；
8. Worker 通过 API Server 汇报心跳、状态和 XCom；
9. 下游依赖满足后，Scheduler 继续排队；叶子任务状态决定 DagRun 结果。

Airflow 的恢复单位主要是 TaskInstance。它不会像 Temporal 一样重放 Python 函数中的每个持久事件，也不会从普通 Python 函数的某一行继续。失败任务通常从任务入口重新执行。

## 5. DAG、状态与持久化

### 5.1 DAG 定义和运行状态分离

Python 文件定义 Dag 和 Task，DAG Processor 解析后把 Serialized DAG、版本信息和调度所需结构写入 Metadata DB。DagRun 和 TaskInstance 是运行时实体，分别记录批次及各任务的状态。

TaskInstance 的主要状态包括 `none`、`scheduled`、`queued`、`running`、`success`、`failed`、`up_for_retry`、`deferred`、`awaiting_input`、`skipped`、`upstream_failed` 等。不同版本可能增加状态，排障时应以部署版本为准。

### 5.2 哪些状态能够恢复

- Scheduler 重启：DagRun、TaskInstance、调度时间、Pool 等仍在 Metadata DB，新 Scheduler 继续扫描和推进；
- Scheduler 节点故障：其他 Scheduler 副本继续工作，数据库锁防止关键调度区重复处理；
- Worker 在任务开始前故障：Executor/Broker 可重新交付或由 Scheduler 调和，具体确认语义取决于 Executor；
- Worker 在任务运行时故障：心跳超时后 Airflow 清理卡在 `running` 的 TaskInstance，并根据剩余重试次数 retry 或 fail；
- Deferred Task：Operator 被移出 Worker，Triggerer 等待条件；触发后从指定方法恢复，但自定义进程内局部状态不会自动保存；
- HITL Task：3.3 使用 Metadata DB 中的 `awaiting_input` 状态，由 Scheduler 管理，等待期间不占 Worker、Triggerer 或 Pool slot；
- 已成功 Task：不会因 Scheduler 重启自动重跑，除非用户 clear、创建新 DagRun 或触发相应重处理。

“自动恢复”不代表任务从中间指令继续。一个处理 1000 个文件的普通 Python Task 在第 900 个文件崩溃后，会从 Task 函数开头重试。要实现断点续作，需要把每个分片建成独立 mapped task，或把检查点存在业务系统，并确保重试幂等。

### 5.3 XCom、业务数据与日志

XCom 默认存 Metadata DB，适合 URI、行数、分区名、模型版本、质量分数等小值。默认 XCom Backend 对大对象和高频数据会造成数据库压力，可使用 Object Storage XCom Backend 或自定义 Backend。

需要注意：一次 Task 重试前，Airflow 会清除该 TaskInstance 在前次尝试写入的 XCom，以支持幂等执行。因此 XCom 不能当作跨重试检查点。批量数据、视频和模型文件应保存到对象存储、湖仓或数据库，XCom 只传引用。

任务日志也不属于核心状态表。多节点或临时 Pod 部署应启用 Remote Logging，例如 S3/GCS、Elasticsearch 或云日志服务，否则节点销毁后日志可能不可用。

## 6. 异常恢复、重试和幂等

### 6.1 Task 重试

每个 Task 可配置：

- `retries`：最大重试次数；
- `retry_delay`：重试间隔；
- `retry_exponential_backoff` 和 `max_retry_delay`：指数退避及上限；
- `execution_timeout`：单次执行允许的时间；
- 回调、告警和 SLA/Deadline 类策略；
- Airflow 3.3 的 `ExceptionRetryPolicy`：按异常类型选择 RETRY、FAIL 或默认行为。

HTTP 429、短暂网络错误和临时算力不足可以重试；输入 Schema 错误、凭据失效或内容永久违规应快速失败。具体默认重试次数受 DAG/task 默认参数和环境配置影响，生产任务应显式配置，不依赖隐含默认值。

### 6.2 外部副作用不是 exactly-once

如果 `publish()` 已经调用平台成功，但 Worker 在汇报 `success` 前崩溃，Scheduler 看到的是超时或失败，并可能再次执行该 Task。因此 Airflow Task 应尽量幂等：

- 使用 `dag_id + run_id + task_id` 或稳定业务 ID 作为下游幂等键；
- 目标表按业务分区覆盖写或 `MERGE`，不要无条件追加；
- 发布、扣费等接口先按业务键查单，再决定是否提交；
- 无法幂等的操作保存外部 operation ID，并设计补偿/人工核对；
- 避免用 `datetime.now()` 决定待处理分区，使用 data interval。

Airflow 的 `success` 表示某次 TaskInstance 已成功记录，并不证明第三方世界只发生了一次副作用。

### 6.3 Scheduler 高可用如何加锁

Airflow 的 HA Scheduler 利用 Metadata DB，不额外要求 Redis/ZooKeeper 分布式锁。多个 Scheduler 在调度关键区对 Pool 表行执行类似 `SELECT ... FOR UPDATE NOWAIT/SKIP LOCKED` 的行级锁，确保并发和 Pool 限制一致。官方支持 PostgreSQL 12+、MySQL 8.0+ 的这类 HA 使用。

如果选择 CeleryExecutor，Redis/RabbitMQ 是任务 Broker，而不是 Scheduler 选主锁。把这两类职责分开，才能正确分析故障域。

## 7. Queue 基于什么实现

Airflow 没有一个对所有部署都相同的任务队列。队列分成三层理解：

1. **Metadata DB 状态队列**：TaskInstance 从 `scheduled` 变为 `queued`，数据库保存权威编排状态；
2. **Executor 提交层**：Scheduler 内的 Executor 决定怎样启动任务；
3. **执行后端队列**：Celery 使用 Broker，Kubernetes 使用 Pod/API，LocalExecutor 使用本机进程。

CeleryExecutor 中：

- Broker 保存待执行命令、确认等临时 Celery 状态，可用 RabbitMQ、Redis、Redis Sentinel 等；
- Result Backend 保存 Celery 命令执行结果，官方建议生产使用数据库后端；
- Airflow 的 DagRun、TaskInstance、Connection、Variable、XCom 历史仍在 Metadata DB；
- 清理 Metadata DB 不会清理 Redis，清理 Redis 也不会清理 Airflow 历史；
- 在 Scheduler/Worker 运行时直接 flush Broker 可能丢掉排队任务或造成状态暂时不一致。

这与 Temporal 的内建 Task Queue、Conductor 的 QueueDAO 都不同。评估“Airflow 是否依赖 Redis”时，答案是：核心状态不依赖 Redis；选择 Celery + Redis 才依赖，选择 KubernetesExecutor 或 LocalExecutor 则不依赖。

## 8. 定时、补跑与事件触发

### 8.1 时间调度

Dag 可使用 cron、`timedelta`、预设值或自定义 Timetable。Scheduler 根据 Timetable 为数据区间创建 DagRun。常见误区是把 cron 当成普通 Linux cron：Airflow 的定时运行通常表达“处理刚结束的数据区间”。

`catchup=True` 时，Scheduler 可以为 `start_date` 到当前之间尚未创建的历史区间建立 DagRun；`catchup=False` 通常只从最近区间开始。Backfill 则由用户明确指定起止日期、重处理策略和最大并发，适合受控补数。

Scheduler 停机后：

- Metadata DB 中已存在的运行和任务仍保留；
- 恢复后继续推进未完成 DagRun；
- 是否为停机期间的时间区间创建新 DagRun取决于 `catchup`、Timetable、运行限制和手动 Backfill 策略；
- 不能把“服务重启”直接理解成无条件补跑全部错过周期。

### 8.2 Asset 和事件驱动

Airflow 3 把旧的 Dataset 概念称为 Asset。上游 Task 成功更新某个 Asset 后，可触发依赖该 Asset 的 Dag；Asset 条件支持 AND/OR。AssetWatcher/Trigger 还可以观察外部队列或存储事件。

这扩展了 Airflow 的事件驱动能力，但官方仍把 Airflow 定位为批处理编排，而不是持续处理每条消息的流处理引擎。Kafka/Flink 负责连续流计算时，Airflow更适合触发、部署、监控或按批处理结果。

## 9. 人工参与

### 9.1 Airflow 3.3 的 HITL 模型

Standard Provider 提供：

| Operator | 作用 |
|---|---|
| `HITLEntryOperator` | 收集字符串、数字等参数输入 |
| `HITLOperator` | 让用户选择一个或多个选项 |
| `ApprovalOperator` | 审批或拒绝 |
| `HITLBranchOperator` | 人工选择下游分支 |

HITL 可设置 subject、body、options、默认值、参数、通知器、响应超时和 `assigned_users`。用户可在 Airflow UI 的 Required Actions 页面响应，也可通过 REST API 查询未响应项目并提交决定。结果可通过 XCom 供后续 Task 使用。

Airflow 3.3 的等待机制比 3.1/3.2 有重要变化：Task 进入由 Scheduler 管理的 `awaiting_input`，等待时不占 Worker、Triggerer 和 Pool slot；人工响应或 Scheduler 的 response-timeout sweep 使其继续。升级或面试讨论时要指出版本差异。

### 9.2 适合与不适合的人工任务

适合：

- 数据发布前批准；
- 模型训练/评估完成后决定是否部署；
- AI 生成内容的批次质检；
- 数据异常时让值班人员选择继续、跳过或终止。

能力边界：

- Airflow UI 的核心用户仍是数据/运维人员；
- `assigned_users` 可以限制响应者，但它不等价于成熟 BPM 的候选组、认领、转办、会签、委托和组织规则；
- 表单、业务待办、复杂权限和面向大量运营人员的门户仍可能需要自建；
- 每一个客户订单都启动一个长期 DagRun 并等待频繁交互，通常不是 Airflow 最合适的负载模型。

## 10. UI、Python 与 YAML/JSON

Web UI 可以：

- 查看 DAG、Grid、Graph、TaskInstance、日志和 XCom；
- 搜索和筛选运行，手工 Trigger、Retry/Clear、Pause；
- 创建 Backfill、查看 Asset 关系；
- 查看 DAG 源、源代码和文档；
- 响应 HITL Required Action。

Airflow 的官方工作流定义方式是 Python DAG 或 Task SDK，不是 YAML/JSON DSL。DAG Processor 会把 DAG 序列化为 JSON 存入数据库，但该 JSON 是内部/SDK 协议，不应手工编辑为工作流定义。`dag_run.conf` 可以是 JSON，Task 文档可以渲染 YAML/JSON，这也不代表支持声明式 YAML DAG。

可以自己读取 YAML/JSON 动态生成 DAG，或安装第三方 DAG Factory，但要自行承担：

- Schema 校验和错误提示；
- 动态任务 ID 的稳定性；
- DAG 解析性能和导入副作用；
- 配置版本和旧 DagRun 可重现性；
- 第三方库的兼容与维护。

Airflow 3 的 versioned Dag Bundle 可以让一个 DagRun 固定到特定 Git Bundle 版本。LocalDagBundle、S3DagBundle 和 GCS Bundle 当前并非都支持版本化，不能因为“放在对象存储”就假定可以重现旧代码。

## 11. Worker 能运行哪些任务

Airflow 的任务类型主要由 Core/Standard Provider、第三方 Provider 和自定义 Operator 决定：

| 类型 | 示例 | 适用情况 |
|---|---|---|
| Python / TaskFlow | `@task`、PythonOperator | Python 业务和轻量编排逻辑 |
| Shell | BashOperator | CLI、脚本、系统工具 |
| SQL / 数据库 | SQLExecuteQueryOperator 等 | 查询、DDL/DML、存储过程 |
| Sensor | 文件、时间、外部任务、对象存在性 | 等待依赖；优先 reschedule/deferrable 版本 |
| 云服务 | AWS/GCP/Azure Provider Operators | 提交云端 Job、读取对象存储 |
| 大数据 | Spark、Databricks、EMR 等 Provider | 把计算提交给外部引擎 |
| 容器 | DockerOperator、KubernetesPodOperator | 隔离依赖、执行非 Python 程序 |
| 控制流 | Branch、ShortCircuit、TaskGroup、Dynamic Mapping | 分支、跳过、分组、按输入展开任务 |
| 人工参与 | HITL、Approval、HITLBranch | 输入、审核和人工分支 |

Operator 往往只是提交和观察外部系统的适配层。不要让 Airflow Worker 自己处理大量视频字节；更合适的方式是提交 Kubernetes/云端转码 Job，并传递任务 ID 和产物 URI。

## 12. 存储层

### 12.1 Metadata Database

| 数据库 | 定位 |
|---|---|
| PostgreSQL | 生产支持，适合 HA Scheduler，优先推荐 |
| MySQL | 生产支持，适合 HA Scheduler |
| SQLite | 本地开发/测试，不能用于生产多节点 |
| MariaDB | 官方不支持、不测试 |
| Microsoft SQL Server | 已不再作为受支持 Backend 维护 |

Airflow 使用 SQLAlchemy 操作 Metadata DB。数据库保存调度和执行元数据，不保存你的整个数据湖。数据库升级使用 `airflow db migrate`；生产必须规划备份、PITR、连接池、清理历史和故障切换。

### 12.2 其他存储

| 层 | 可选实现 | 内容 |
|---|---|---|
| Celery Broker | RabbitMQ、Redis、Redis Sentinel 等 | 待执行命令和 Broker 临时状态 |
| Celery Result Backend | 推荐数据库后端 | Celery 命令结果，供 Scheduler 收集 |
| XCom | Metadata DB、Object Storage、自定义 Backend | 小型跨 Task 元数据 |
| Remote Log | S3/GCS/Elasticsearch/CloudWatch 等 | Task 日志 |
| Dag Bundle | 本地、Git、S3、GCS、扩展 Backend | DAG 代码和相关文件 |
| 业务数据 | 数仓、对象存储、湖仓、业务 DB | CSV、Parquet、视频、模型、报表 |

## 13. 与 Temporal、Conductor 的关键差别

| 问题 | Airflow | Temporal | Conductor |
|---|---|---|---|
| 核心单位 | 数据区间的一次 DagRun / TaskInstance | 一个持久化函数执行 | JSON Workflow/Task 实例 |
| 流程表达 | Python DAG | 确定性 SDK 代码 | JSON 定义和系统任务 |
| 故障恢复 | TaskInstance 级重跑/调和 | Event History 重放 Workflow 状态 | 数据库状态 + Queue 重新调度 |
| 任务中途恢复 | 普通 Task 从入口重试，检查点自建 | Workflow 重放；Activity 仍需幂等/心跳 | Worker Task 通常重试，检查点自建 |
| 时间模型 | data interval、catchup、backfill | 持久 Timer、Schedule | Schedule、WAIT 等任务 |
| 人工参与 | 3.1+ HITL，3.3 `awaiting_input` | Signal/Update + 业务 UI | HUMAN Task + 业务 UI |
| 最强场景 | 周期性数据/ML 批次 | 长生命周期可靠业务执行 | 动态声明式微服务编排 |

## 14. 对 `media_agent` 的建议

Airflow 可以负责外围批处理层：

```text
每日选题采集 -> 数据清洗 -> 批量生成候选 -> 批量质量评估
每小时平台指标采集 -> 汇总 -> 报表
每周模型效果回测 -> 人工确认 -> 更新提示词/模型版本
```

单条内容的交互式生命周期可以交给 Temporal 或 Conductor：

```text
创建内容 -> 多轮 Agent -> 等待第三方生成 -> 人工审核 -> 发布/返工
```

若首期只允许部署一个系统，按主要负载选择：大量按天/小时的批次和补数优先 Airflow；大量独立、长时间等待的业务实例优先 Temporal；运营人员需要配置 JSON 流程则偏 Conductor。

## 15. 建议 PoC 和故障实验

1. 建立三节点 CeleryExecutor 环境，使用 PostgreSQL 和 RabbitMQ/Redis；
2. 实现上面的每日媒体 DAG，引入 `ApprovalOperator`；
3. 使用 GitDagBundle 固定 DagRun 的代码版本；
4. 把生成结果写 MinIO/S3，只通过 XCom 传 URI；
5. 同时启动两个以上 Scheduler，验证数据库行锁下不会超额使用 Pool；
6. 杀死一个 Scheduler，确认其他 Scheduler 继续推进；
7. 在任务执行中杀死 Worker，确认心跳超时后重试，并验证下游没有重复发布；
8. 在 `awaiting_input` 期间重启 Scheduler/API Server，恢复后从 UI 或 REST API 提交审批；
9. 停机跨过两个调度周期，分别验证 `catchup=True/False`；
10. 对一天数据运行 Backfill，确认 data interval、业务分区和幂等键一致；
11. 清理一个 Task 并重跑，验证 XCom 和对象存储产物的行为；
12. 模拟 Broker 故障，观察 Metadata DB 的 `queued` 状态和恢复后的调和过程。

## 16. 最终评价

Airflow 是四个深挖组件中最成熟、社区规模最大的数据编排代表，也是 Apache 项目，但不是 CNCF 项目。它的学习重点应放在 DagRun/Data Interval、Scheduler/Executor 分层、Metadata DB 状态、TaskInstance 重试、幂等、Backfill、Asset 和远程执行，而不只是会写 `task1 >> task2`。

Airflow 3.3 的 HITL 已经能较低成本完成批次审批，而且等待时不占执行资源。这让它可以覆盖 `media_agent` 的“批量生成后人工确认”场景。不过，HITL 的出现没有改变 Airflow 的数据编排本质。把它用于每个用户会话或每条业务订单的长期状态机之前，仍应与 Temporal、Conductor、Flowable 的模型做对照。

## 参考资料

- [Airflow GitHub repository](https://github.com/apache/airflow)
- [Airflow 3 architecture overview](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/overview.html)
- [Scheduler and HA database locking](https://airflow.apache.org/docs/apache-airflow/stable/concepts/scheduler.html)
- [Executor](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/executor/index.html)
- [CeleryExecutor](https://airflow.apache.org/docs/apache-airflow-providers-celery/stable/celery_executor.html)
- [KubernetesExecutor](https://airflow.apache.org/docs/apache-airflow-providers-cncf-kubernetes/stable/kubernetes_executor.html)
- [DAGs](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html)
- [Dag Runs and catchup](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dag-run.html)
- [Backfill](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/backfill.html)
- [Dag Bundles](https://airflow.apache.org/docs/apache-airflow/stable/administration-and-deployment/dag-bundles.html)
- [Dag Serialization](https://airflow.apache.org/docs/apache-airflow/stable/dag-serialization.html)
- [Tasks and heartbeat timeout](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/tasks.html)
- [Deferrable Operators and Triggers](https://airflow.apache.org/docs/apache-airflow/stable/authoring-and-scheduling/deferring.html)
- [Human-in-the-Loop tutorial](https://airflow.apache.org/docs/apache-airflow/stable/tutorial/hitl.html)
- [HITL Operator API](https://airflow.apache.org/docs/apache-airflow-providers-standard/stable/_api/airflow/providers/standard/operators/hitl/index.html)
- [Assets](https://airflow.apache.org/docs/apache-airflow/stable/authoring-and-scheduling/assets.html)
- [Asset-aware scheduling](https://airflow.apache.org/docs/apache-airflow/stable/authoring-and-scheduling/asset-scheduling.html)
- [Metadata database backend](https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html)
- [XComs](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/xcoms.html)
- [Task logging](https://airflow.apache.org/docs/apache-airflow/stable/administration-and-deployment/logging-monitoring/logging-tasks.html)
- [Production deployment](https://airflow.apache.org/docs/apache-airflow/stable/administration-and-deployment/production-deployment.html)
