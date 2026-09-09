# Apache DolphinScheduler 深入调研及与 Airflow 的对比

调研日期：2026-09-09。调研问题见 [question.md](./question.md)。本文以 Apache DolphinScheduler 3.4.1 为服务端版本基线；Python SDK 独立发布，使用 PyDolphinScheduler/YAML 前应另外核对版本兼容矩阵。

## 1. 结论先行

Apache DolphinScheduler 是一个面向数据处理的 **分布式、可视化、低代码 DAG 工作流调度平台**。它把 API/UI、Master 调度、Worker 执行、Alert 告警拆成独立服务，通过注册中心进行服务发现、选主、分布式锁和故障感知，通过关系数据库保存定义、调度、命令和实例状态。

它适合：

- 希望数据开发在 Web UI 中拖拽 DAG，而不是全部编写 Python DAG；
- Shell、SQL、Python、Spark、Flink、MapReduce、DataX、SeaTunnel 等大数据任务混合编排；
- 需要 Worker Group，把任务路由到不同租户、CPU/GPU 或大数据环境；
- 需要定时调度、依赖检查、失败重试、补数、工作流实例运维和告警；
- 国内大数据技术栈，需要较丰富的开箱任务插件和中文社区资料。

它不适合直接承担：

- BPMN 审批、候选组认领、转办、会签、表单等人工任务；
- 单个业务实体持续数天、不断接收外部消息的复杂业务状态机；
- 依靠函数事件历史重放实现精细恢复的 Agent/微服务长流程。

项目情况：

| 维度 | 结论 |
|---|---|
| 项目类型 | 数据工作流编排与分布式任务调度平台 |
| 基金会 | Apache Software Foundation 顶级项目 |
| CNCF | 进入 CNCF Landscape，但不是 CNCF Sandbox/Incubating/Graduated 托管项目 |
| 协议 | Apache-2.0 |
| 当前版本 | 3.4.1，2026-03-01 发布 |
| 受欢迎程度 | 调研时 GitHub 主仓库约 14.5k Star、5.1k Fork |
| 主要实现 | Java 后端、Vue 3 前端；Python SDK 独立发布 |
| 与当前项目匹配度 | 适合 `media_agent` 的批量内容生产、定时运行和异构媒体任务；人工审批和在线 Agent 状态不是其长项 |

与 Airflow 相比，DolphinScheduler 的主要优势是内置可视化设计器、独立 Master/Worker 和面向大数据的任务插件；Airflow 的优势是 Python 原生 DAG、庞大的 Provider 生态、数据集/Asset 语义和更高的全球普及度。两者都是数据编排器，选型应围绕团队定义工作流的方式和已有计算平台，而不是只看 Star。

## 2. 示例：每日多平台内容生产流水线

下面的批处理流程能体现 DolphinScheduler：

```text
每天 01:00 生成一个 Workflow Instance
   -> SQL 查询前一天运营数据
   -> Python/Shell 抓取热点并清洗
   -> Switch 按内容类型分流
      ├─ 图文 -> Python 生成文案和图片
      └─ 视频 -> Kubernetes/Remote Shell 调用媒体流水线
   -> 汇总质量指标
   -> HTTP 调用业务系统创建“待审核内容”
   -> Dependent 等待上游数据或外部工作流
   -> 发布已由业务系统批准的内容
   -> 告警和指标汇总
```

这里应把“人工审核”放在独立业务系统或 Flowable 中。DolphinScheduler 可以用 HTTP Task 创建审核单，再以定时任务、Dependent Task 或自定义插件检查结果，但它本身没有 Flowable User Task 那样的候选组、认领、委派、表单和会签模型。

### 2.1 核心抽象

| 抽象 | 含义 | 示例 |
|---|---|---|
| Project | 工作流、资源和权限的组织边界 | `media-production` |
| Workflow Definition | DAG 定义及版本 | `daily-content-pipeline` |
| Task Definition | 可复用/版本化的任务节点定义 | `generate-video` |
| Task Relation | Task 间的上游/下游边 | `clean -> generate` |
| Schedule | 绑定 Workflow Definition 的 cron 计划 | 每天 01:00 |
| Command | 启动、补数、恢复等待 Master 消费的持久命令 | 定时触发一批运行 |
| Workflow Instance | 工作流的一次运行 | 2026-09-08 数据批次 |
| Task Instance | 某节点在某次运行中的执行记录 | 本批次的 `generate-video` |
| Master | 解析 DAG、推进状态、生成和分发 Task Instance | 决定下一批可运行任务 |
| Worker | 执行任务插件 | 运行 Python/Spark/K8s Task |
| Worker Group | Worker 的逻辑资源池和路由标签 | `gpu`、`hadoop-prod` |
| Tenant/Environment | 任务运行用户与环境配置 | Linux 租户、Hadoop 环境 |
| Alert Group/Plugin | 工作流结果和超时告警 | 邮件、钉钉、飞书、Webhook |

## 3. 三节点集群架构

在只有三台机器的学习或中小规模环境中，可在每台机器上部署 API、Master、Worker，Alert 至少两副本；生产环境通常进一步把 Master 与重负载 Worker 分离：

```text
                          ┌─────────────┐
用户 / CI / Python SDK -->│ LB / Ingress│
                          └──────┬──────┘
                 ┌───────────────┼───────────────┐
                 v               v               v
            ┌─────────┐     ┌─────────┐     ┌─────────┐
Node 1      │ API 1   │     │ API 2   │     │ API 3   │
            │Master 1 │     │Master 2 │     │Master 3 │
            │Worker 1 │     │Worker 2 │     │Worker 3 │
            └────┬────┘     └────┬────┘     └────┬────┘
                 └───────────────┼───────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              v                  v                  v
      ┌────────────────┐ ┌──────────────┐  ┌─────────────────┐
      │ Registry cluster│ │ Metadata DB  │  │ Resource storage│
      │ ZK/etcd/JDBC    │ │ PostgreSQL / │  │ HDFS/S3/OSS/... │
      │ discovery/lock  │ │ MySQL        │  └─────────────────┘
      └────────────────┘ └──────────────┘
                                 │
                          ┌──────v──────┐
                          │ Alert Server│
                          └─────────────┘
```

组件职责：

- **API Server**：提供 UI 静态入口和 REST API，管理项目、数据源、定义、调度和实例操作；可在负载均衡后水平扩展。
- **Master Server**：扫描/消费 Command，创建 Workflow Instance，执行 DAG 状态机，判断可运行节点，选择 Worker Group 和 Worker，并通过 RPC 分发任务。
- **Worker Server**：承载 Task Plugin，创建执行上下文，运行本地进程或提交 Spark/Flink/Kubernetes 等外部作业，把状态和日志信息回传 Master。
- **Alert Server**：读取/接收告警事件，通过邮件、飞书、钉钉、Webhook、Alertmanager 等插件发送。
- **Registry**：Master/Worker/API 注册、心跳、服务发现、Master 协调、故障监听和分布式锁。
- **Metadata DB**：定义、版本、schedule、command、workflow/task instance、告警和权限等权威数据。
- **Resource Storage**：脚本、JAR、SQL、Python 文件等资源，可用 HDFS、S3/兼容对象存储等插件；不是工作流状态库。

三台物理机同时运行 Master 和 Worker 虽然节省机器，但大型 Spark 提交、Python 计算或媒体处理可能抢占 Master 的 CPU、内存和磁盘。生产环境应通过独立 Worker Group 或独立节点隔离调度控制面与执行负载。

## 4. 从 Schedule 到 Worker 的完整流程

以每天 01:00 的流水线为例：

1. Quartz 调度触发计划，产生一条持久化 Command；手工运行、API 触发、补数和失败恢复也会产生相应 Command。
2. Master 集群协调谁负责处理 Command，创建 Workflow Instance 并加载对应版本的 DAG。
3. Master 找出没有未满足上游依赖的 Task，创建/更新 Task Instance。
4. Task 根据 Worker Group、优先级和负载均衡策略进入待分发队列。
5. Master 选择目标 Worker，通过内部 RPC 发送任务。
6. Worker 接收、确认并执行相应 Task Plugin。
7. Worker 将运行、成功、失败、取消等事件回传 Master；Master 持久化实例状态并推进后续节点。
8. Workflow 达到终态后，根据告警策略通知 Alert Server。

这与 Airflow “Scheduler 解析 DAG、把 TaskInstance 交给 Executor”相似，但 DolphinScheduler 把 Master/Worker RPC、Worker Group 和大量大数据 Task Plugin 作为平台核心，不需要用 CeleryExecutor 才获得分布式 Worker。

## 5. Queue 基于什么实现

DolphinScheduler 没有一个可以简单等同于 RabbitMQ/Celery 的单一队列。它由三层组成：

```text
Metadata DB
  t_ds_command / workflow instance / task instance（持久状态）
       -> Master 的按 Worker Group 待分发队列（内存调度结构）
       -> Master 通过 RPC dispatch
       -> Worker 的执行线程/任务执行器
       -> 状态事件回传 Master 并写数据库
```

- **Command 表**是工作流启动意图的持久入口。Quartz、手工运行、补数、恢复等操作最终让 Master 有可消费的命令。
- **Workflow/Task Instance 表**是运行状态权威记录。Master 重启后可以据此做 failover 和恢复判断。
- **Master 待分发队列**按 Worker Group 组织等待发送的任务，属于节点内存结构；最新版本还对不存在的 Worker Group 或无可用 Worker 增加了 dispatch timeout 检查。
- **RPC**承担 Master 到 Worker 的实时分发及确认，不要求部署 Celery、RabbitMQ 或 Kafka。
- **Registry**承担服务发现、协调和锁，不保存全部任务执行历史。

因此，“队列是否可靠”要分别看 Command 是否持久化、Task Instance 状态是否正确、Master failover 能否接管，以及 Worker 执行副作用是否幂等。不能因为使用了数据库和注册中心，就假设每个外部任务天然 exactly-once。

## 6. 注册中心与 Distributed Lock

当前代码和配置支持的 Registry 实现包括：

- ZooKeeper：默认、部署资料最丰富；
- etcd：可选 Registry Plugin；
- JDBC：以数据库实现注册与协调，减少一个独立中间件，但要评估轮询、故障检测延迟和数据库压力。

注册中心用于服务注册、节点变化监听、选主/协调和分布式锁。例如 Master failover 需要防止多个节点同时处理同一个失效节点。它不是只支持 Redis 或 ZooKeeper，也不以 Redis 为默认选项。

选择建议：已有稳定 ZooKeeper/etcd 集群时优先复用团队熟悉的实现；小规模希望减少组件时可验证 JDBC Registry。无论选择哪一个，都要测试 session/lease 过期、网络分区、注册中心切换和重复 failover。Metadata DB 仍然不可省略。

## 7. 状态持久化与异常恢复

### 7.1 持久化内容

关系数据库保存：

- Workflow/Task Definition 及版本、节点关系和 JSON 参数；
- Schedule 与调度发布状态；
- Command、错误 Command、串行执行 Command；
- Workflow Instance、Task Instance、上下文与参数；
- Task Group Queue、告警、数据源、用户、租户、项目和权限；
- 工作流运行历史和操作所需元数据。

运行中的 Shell 进程、Python 进程或外部 Spark/Flink/YARN/Kubernetes 应用不等于数据库状态。故障恢复时必须把“平台认为在运行”与“外部进程是否仍在运行”对齐。

### 7.2 Master 故障

Registry 检测 Master 节点失效后，其余 Master 竞争 failover 协调权，读取数据库中的 Workflow/Task Instance，并接管相应工作流状态机。较新版本支持 Master 接管仍在 Worker 上运行的任务事件，避免简单地把所有任务重跑。

但恢复边界取决于故障时刻：dispatch 已发送而确认丢失、Worker 已启动外部任务但状态未持久化、Master 收到成功事件但事务未提交，都可能产生不确定性。任务应有业务幂等键，并能查询外部作业状态。

### 7.3 Worker 故障

Registry 检测 Worker 下线后，Master 对分配给该 Worker 的未完成任务执行容错处理。对本地 Shell/Python 进程，Worker 宕机通常意味着进程也消失，可以按重试策略重新运行；对 YARN、Spark、Flink 或 Kubernetes，提交端 Worker 消失时外部应用可能仍在运行，盲目重提会重复。插件能否取得 application ID 并接管/查询，是实际可靠性的关键。

### 7.4 全集群重启

Definition、Schedule、Command 和 Instance 都在数据库，因此服务恢复后可以继续处理未完成的工作流。不过“中断任务自动恢复”不是同一种行为：

- 尚未分发的持久任务可以重新调度；
- Master 状态机可从实例记录恢复；
- Worker 本地进程已消失时通常按失败/重试处理；
- 外部计算作业可能继续，需要插件查询或人工处理；
- 已经对外产生副作用的 HTTP/Shell 任务可能再次执行，必须幂等。

## 8. 重试、超时与失败处理

Task 可配置失败重试次数和重试间隔，也可以配置超时策略；3.4.1 增加了 Workflow/Task Instance 最大运行时间配置。工作流还可以设置节点失败后的流程策略，例如结束流程或继续允许不受依赖影响的分支执行。

常见运维操作包括：

- 恢复失败任务/从失败节点继续；
- 重跑整个 Workflow Instance；
- 停止、暂停或恢复实例；
- 对 Task Instance 强制成功；
- 从某个节点执行、只运行前置/后置范围；
- 查看日志和实例 DAG；
- 补数生成多个调度日期实例。

重试时必须明确 Task Plugin 的语义：SQL `INSERT`、HTTP 发布、Shell 上传文件可能已成功但状态回报失败。推荐把 `${workflowInstanceId}`、业务日期和任务 code 组合成幂等键，外部服务记录处理结果；对 Spark/Flink/YARN/K8s 保存 application/job ID，并在重试前查询。

## 9. 定时调度、补数和依赖

DolphinScheduler 使用 Scheduler Plugin，默认以 Quartz 执行 cron 调度。Schedule 与 Workflow Definition 绑定并需要上线；触发后创建 Command，再由 Master 创建实例。

调度相关能力包括：

- cron 周期运行；
- 手工运行和 API 触发；
- 补数（Complement Data）：按日期范围或指定日期批量生成实例；
- 补数实例串行或并行策略；
- 工作流串行执行策略，控制多个实例重叠；
- Dependent Task：检查其他项目/工作流/任务在指定周期的状态；
- Sub Workflow：复用另一个工作流；
- 内置日期参数和自定义参数；
- 任务优先级、工作流优先级和 Worker Group 路由。

补数时业务日期是核心。SQL 和脚本应使用调度/补数基准日期，不要直接读取机器当前时间，否则重跑历史日期会处理错误分区。上线前要验证时区、cron 边界、夏令时、补数顺序和跨工作流依赖。

## 10. UI、Python、YAML 和 JSON

### 10.1 Web UI

DolphinScheduler OSS 自带 Web UI，可用于：

- 拖拽 Task 节点和依赖边；
- 配置数据源、资源、环境、Worker Group 和告警；
- 定义、上线和调度 Workflow；
- 查看 Workflow/Task Instance、Gantt/DAG、日志和状态；
- 执行重跑、恢复、停止、补数等运维操作；
- 管理用户、租户、项目及资源权限。

这是它相对 Airflow 的明显差异：Airflow UI 主要观察和操作已经由 Python 定义的 DAG；DolphinScheduler UI 本身就是主要建模入口。

### 10.2 Python SDK

PyDolphinScheduler 提供 workflow-as-code。它把 Python 对象转换成 Task Definition/Relation JSON，再通过 Java Gateway/API 提交到服务端，而不是让 Scheduler 周期扫描 Python 文件并在解析进程中执行任意 DAG 代码。

简化示例：

```python
from pydolphinscheduler.core.workflow import Workflow
from pydolphinscheduler.tasks.shell import Shell
from pydolphinscheduler.tasks.python import Python

with Workflow(
    name="daily_media_pipeline",
    schedule="0 1 * * *",
    worker_group="media",
) as workflow:
    extract = Shell(name="extract", command="python scripts/extract.py")
    generate = Python(name="generate", definition="run_generation()")
    extract >> generate

workflow.submit()
```

具体构造器参数以安装的 SDK 版本为准。服务端 3.4.1 与 Python SDK 4.1.0 是不同发布线，PoC 必须验证 Gateway/API 兼容性。

### 10.3 YAML

PyDolphinScheduler CLI 支持 `pydolphinscheduler yaml -f workflow.yaml`，将 YAML 编译并提交为平台定义。例如：

```yaml
workflow:
  name: daily_media_pipeline
  worker_group: media

tasks:
  - name: extract
    task_type: Shell
    command: python scripts/extract.py

  - name: generate
    task_type: Python
    deps: [extract]
    definition: |
      run_generation()
```

YAML 能力属于 Python SDK 工具链，覆盖的 Task 类型和字段可能晚于 Web UI/Java 服务端。应把它作为编译输入并固定 SDK 版本，不要假设任意 UI 导出的 JSON 都能无损回写为 YAML。

### 10.4 JSON

服务端 API 和数据库内部使用 JSON 表达 Task 参数及关系，UI 的导入导出也可能包含 JSON。内部 JSON 结构会随版本演进，不如 OpenAPI、Python SDK 或 YAML CLI 适合作为手工维护契约。若要 GitOps，优先固定 PyDolphinScheduler 版本并在 CI 中提交/校验定义。

## 11. 支持的 Worker Task 类型

DolphinScheduler 的主要特色是 Task Plugin。版本之间会增加、重构或移除插件，以下按能力分类：

| 分类 | 代表任务 | 说明 |
|---|---|---|
| 脚本/通用计算 | Shell、Python、Java、Remote Shell | 在 Worker 或远程主机运行程序 |
| SQL/数据库 | SQL、Stored Procedure | 通过数据源执行查询、DDL/DML、存储过程 |
| 数据同步 | DataX、SeaTunnel、DataFactory 等 | 批量数据搬运和同步 |
| 大数据计算 | Spark、Flink、MapReduce、Hive/Trino 相关 SQL | 提交外部集群作业并跟踪状态 |
| 容器/云 | Kubernetes、SageMaker、EMR Serverless | 提交容器或云服务任务 |
| ML/MLOps | MLflow、Kubeflow、OpenMLDB、DVC 等 | 训练、部署或流水线集成；具体版本需核对 |
| 服务调用 | HTTP、gRPC（3.4.0 起新增插件） | 调用远程服务 |
| 流程控制 | Switch、Conditions、Dependent、Sub Workflow | 分支、状态条件、跨工作流依赖和复用 |
| 资源控制 | Task Group | 限制一类任务的并发并排队 |

Task Group Queue 是对稀缺资源并发配额的排队机制，不等于 Master 到 Worker 的全局任务消息队列。

没有原生 Human/User Task。可以用 HTTP、Dependent 或自定义 Task Plugin 接入审批系统，但这会把任务归属、表单、认领、权限、超时和审计留给外部系统。

## 12. 存储支持

需要区分三类存储：

### 12.1 Metadata Database

生产部署常见为 PostgreSQL 或 MySQL。官方 Helm 默认部署 PostgreSQL；由于 MySQL Connector 的分发许可证限制，官方镜像可能不直接附带 MySQL 驱动，需要自行加入。更换元数据库时，API、Master、Worker、Alert、Tools 等相关服务必须保持一致配置和驱动。

### 12.2 Resource Center

资源中心保存脚本、JAR 和任务文件，可通过 Storage Plugin 使用本地/共享文件系统、HDFS、S3 兼容对象存储及部分云厂商存储。集群模式不能把仅存在某个 API 节点本地磁盘的文件当成所有 Worker 都可见。

### 12.3 Registry

Registry 可用 ZooKeeper、etcd 或 JDBC。它保存临时注册/协调信息，不替代 Metadata DB；也不应拿来保存大型任务产物。

## 13. 人工参与能力评价

DolphinScheduler 的“人工操作”主要是运维人员在 UI 中触发、暂停、停止、恢复、重跑、补数或强制成功，不是业务流程中的 User Task。

如果内容发布必须经过编辑审批，可采用：

```text
DolphinScheduler 批量生成候选内容
   -> HTTP Task 在业务系统/Flowable 创建审批单
   -> 本次数据流水线结束或进入短周期状态检查
   -> 审批通过事件写业务表/触发新的发布 Workflow
```

不建议让一个 Worker 线程通过 `while true + sleep` 等待人工审批，这会占用执行资源，重启恢复也差。若审批简单，可以把“生成”和“发布”拆成两个工作流，以业务表状态或事件触发衔接；若审批复杂，Flowable 更合适。

Airflow 3.3 已有原生 HITL Operator 和 `awaiting_input` 状态，单个数据批次中的简单批准/拒绝比 DolphinScheduler 更直接。但候选组、转办、会签和表单仍然是 Flowable 的优势。

## 14. 与 Apache Airflow 逐项对比

### 14.1 总表

| 维度 | DolphinScheduler 3.4.1 | Airflow 3.3.x |
|---|---|---|
| 基金会/CNCF | Apache 顶级项目；非 CNCF 托管 | Apache 顶级项目；非 CNCF 托管 |
| GitHub 热度 | 约 14.5k Star / 5.1k Fork | 约 46.8k Star / 17.8k Fork |
| 核心定位 | 可视化、低代码数据 DAG 调度 | Python 代码式数据 DAG 编排 |
| 主要定义方式 | Web UI；Open API；Python SDK；SDK YAML | Python DAG/TaskFlow；无官方通用 YAML/JSON DSL |
| 控制面 | API + 多 Master | API Server + Scheduler + DAG Processor |
| 执行面 | 原生多 Worker + Task Plugin + RPC | Executor 抽象；Celery Worker、K8s Pod、Local 等 |
| 持久启动入口 | DB Command | Metadata DB 中 DagRun/TaskInstance 与调度状态 |
| 外部 Broker | 核心分发不要求 Broker | CeleryExecutor 需要 Redis/RabbitMQ；KubernetesExecutor 不需要 |
| 注册/协调 | ZK/etcd/JDBC Registry | 多 Scheduler 主要依赖 Metadata DB 行锁；无需 ZK |
| 调度 | Quartz cron + Command | Timetable/Scheduler + data interval/catchup |
| 补数 | UI/API Complement Data，日期范围/列表 | CLI/API Backfill、catchup、logical date/data interval |
| UI 建模 | 强，拖拽是核心入口 | 弱，UI 主要用于观察和操作代码 DAG |
| 任务生态 | 大数据任务插件开箱丰富 | Provider/Operator 生态规模更大、云服务覆盖广 |
| Python 开发体验 | SDK 把定义提交到服务端 | Python 是原生 DAG 定义和扩展语言 |
| Worker Group | 原生资源组/环境路由 | Queue、Pool、Executor/K8s 标签等组合实现 |
| 人工输入 | 无原生业务 User Task | 3.3 有 HITL Operator，适合简单人工检查点 |
| 数据感知依赖 | Dependent Task、工作流/任务状态依赖 | Asset-aware scheduling、Dataset/Asset event 更系统 |
| 运维动作 | UI 中恢复、补数、强制成功等较集中 | 清理/重试/重跑/Backfill 功能成熟 |
| 全球生态/招聘认知 | 中国及大数据场景影响力较强 | 全球数据工程事实标准之一，岗位认知更高 |

### 14.2 架构差异

DolphinScheduler 的 Master 是完整 DAG 状态机和任务分发中心，Worker 是产品内建服务；Registry 感知节点并协调 failover。Airflow Scheduler 决定 TaskInstance 是否可运行，Executor 决定如何执行：CeleryExecutor 使用外部 Broker 和 Celery Worker，KubernetesExecutor 为任务创建 Pod，LocalExecutor 在 Scheduler 主机执行。

因此：

- 已有 ZooKeeper/etcd、大数据集群和固定 Worker 机器时，DolphinScheduler 的模型直观；
- 已有 Kubernetes、云服务和 Python 数据平台时，Airflow 的 Executor/Provider 模型更自然；
- DolphinScheduler 多一个 Registry 运维面；
- Airflow 使用 CeleryExecutor 时多一个 Broker，使用 K8s Executor 时改为依赖 Kubernetes API。

### 14.3 定义与协作方式

DolphinScheduler UI 降低了 SQL/大数据开发创建 DAG 的门槛，也便于在线修改；代价是生产定义可能主要存在平台数据库中，需要额外建立导出、审查、发布和回滚流程。PyDolphinScheduler 能改善 GitOps，但 SDK 覆盖与服务端版本必须管理。

Airflow DAG 天然是 Python 文件，代码审查、测试、抽象复用和 Git 发布更直接；代价是业务人员不能只靠拖拽完成复杂流程，DAG 解析期副作用和依赖管理也需要工程规范。

### 14.4 调度与数据语义

两者都支持 cron、重试、补数和跨任务依赖。Airflow 的 logical date、data interval、catchup、Backfill 和 Asset 是统一核心概念，更适合按数据分区推理。DolphinScheduler 的补数和 Dependent Task 对传统离线数仓很实用，UI 操作友好，但脚本仍必须正确使用调度日期参数。

### 14.5 高可用与恢复

DolphinScheduler 通过 Registry 发现 Master/Worker 故障，由 Master failover 接管数据库中的实例状态。Airflow Scheduler HA 主要通过共享 Metadata DB 和行级锁协调；任务恢复交给 Scheduler/Executor，Celery Worker 丢失、K8s Pod 丢失的检测方式不同。

两者都不能保证外部副作用 exactly-once。SQL、HTTP、文件上传、Spark 提交都要幂等，并保存可查询的外部 job ID。

### 14.6 UI 和日常运维

DolphinScheduler 把工作流设计、数据源、租户、Worker Group、资源中心和实例运维集中在 UI 中，对平台运营更友好。Airflow 3 的 UI 在 DAG/TaskInstance/Asset 观察、日志和运维上成熟，但工作流设计仍回到代码仓库。

### 14.7 人工参与

Airflow 3.3 的 HITL Operator 可以让一次 DagRun 进入 `awaiting_input`，由指定用户在 UI 中批准、拒绝或选择。DolphinScheduler 3.4.1 没有对应的原生 User Task。若需求只是“批次发布前点一下批准”，Airflow 当前能力更直接；若需要完整审批，应选 Flowable，而不是根据数据调度器 UI 是否漂亮来判断。

## 15. 对当前 `media_agent` 的选择建议

可把需求分为三类：

| 需求 | 更合适的组件 |
|---|---|
| 每天批量抓取热点、生成 N 条内容、统计指标、失败补跑 | Airflow 或 DolphinScheduler |
| Go/Python Agent 调用链可靠执行、等待回调、崩溃后恢复 | Temporal |
| 编辑/法务审批、候选组、认领、会签、超时升级 | Flowable |
| 运营从 UI 拖拽 Shell/SQL/Spark/Flink 流水线 | DolphinScheduler |
| 工程团队以 Python 代码管理数据 DAG、依赖云 Provider | Airflow |

若 `media_agent` 团队规模小、主语言是 Go/Python、没有 Hadoop/Spark/Flink 平台，Airflow 通常更容易借助 Python 生态快速落地；若团队已有大数据基础设施、希望大量工作流由 UI 配置，并需要 Worker Group 隔离，DolphinScheduler 更有吸引力。

求职学习价值方面，Airflow 的岗位覆盖更广；DolphinScheduler 能补充“分布式 Master/Worker、注册中心容错、低代码 DAG、大数据任务插件”的对比视角。建议先掌握 Airflow 的调度与数据区间，再用 DolphinScheduler 实际验证同一个 DAG，这样更容易回答架构选型题。

## 16. 最小 PoC 与验证清单

使用 3 个 Master、3 个 Worker、3 节点 Registry 和高可用数据库，完成：

1. 在 UI 拖拽 Shell → Python → Switch → K8s/HTTP → 汇总 DAG；
2. 使用 PyDolphinScheduler Python 和 YAML 各提交同类工作流；
3. 配置 `cpu`、`gpu` 两个 Worker Group，验证路由和无 Worker 超时；
4. 配置 cron 和历史日期补数，核对每个实例的业务日期；
5. 分别在 Command 消费、Task dispatch、Worker 执行、状态回报阶段杀 Master；
6. 杀 Worker，分别观察本地 Shell 和外部 Spark/K8s 作业的恢复；
7. 模拟 RPC ACK 丢失，验证幂等键是否阻止重复发布；
8. 配置失败重试、任务超时、工作流最大时间和告警；
9. 将 Registry 从 ZooKeeper 切换到 JDBC 或 etcd，对比故障发现延迟；
10. 运行 10 万 Task Instance，观察数据库、Master 队列和日志查询；
11. 数据库与 Registry 分别故障转移，验证恢复和重复执行；
12. 与 Airflow 实现同一 DAG，对比定义代码量、UI 操作、补数、恢复和运维成本。

关键指标包括：调度延迟、dispatch 延迟、Master/Worker failover 时间、补数吞吐、重复副作用次数、数据库 QPS、Registry 请求量、Task 日志可见时间和 UI 查询延迟。

## 17. 最终评价

DolphinScheduler 是成熟度和受欢迎程度都较高的 Apache 数据调度项目。它不是 CNCF 托管项目，进入 CNCF Landscape 只表示被云原生生态目录收录。它的核心优势是可视化低代码、原生多 Master/Worker、Worker Group 以及面向大数据平台的大量任务插件。

它的可靠性来自数据库中的 Command/Instance 状态、Registry 协调、Master failover 和 Worker 状态回报。Master 的内存待分发队列与 RPC 提高实时性，但不能替代持久状态，也不能消除重复执行。设计生产 Task 时仍要遵循幂等、外部作业 ID、超时、可查询结果和补偿原则。

在 Airflow 与 DolphinScheduler 之间：偏 Python/Git/云 Provider/Asset 选 Airflow；偏 UI/大数据插件/Worker Group/国内数据平台选 DolphinScheduler。对于人工审批，两者都不应替代完整 BPM；Airflow 适合简单 HITL 检查点，复杂人工流程应学习 Flowable。

## 参考资料

- [Apache DolphinScheduler GitHub](https://github.com/apache/dolphinscheduler)
- [Apache DolphinScheduler Releases](https://github.com/apache/dolphinscheduler/releases)
- [项目架构索引：服务、Command、Registry 和 Quartz](https://github.com/apache/dolphinscheduler/blob/dev/AGENT.md)
- [架构配置：ZooKeeper、etcd、JDBC Registry](https://github.com/apache/dolphinscheduler/blob/dev/docs/docs/en/architecture/configuration.md)
- [Kubernetes 部署与组件扩缩容](https://github.com/apache/dolphinscheduler/blob/dev/docs/docs/en/guide/installation/kubernetes.md)
- [安全模型与 Worker Group](https://github.com/apache/dolphinscheduler/blob/dev/docs/docs/en/guide/security/security.md)
- [PyDolphinScheduler 文档](https://dolphinscheduler.apache.org/python/index)
- [PyDolphinScheduler CLI 与 YAML](https://dolphinscheduler.apache.org/python/cli.html)
- [PyDolphinScheduler Releases](https://github.com/apache/dolphinscheduler-sdk-python/releases)
- [Airflow Architecture Overview](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/overview.html)
- [Airflow Scheduler](https://airflow.apache.org/docs/apache-airflow/stable/administration-and-deployment/scheduler.html)
- [Airflow Executors](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/executor/index.html)
- [Airflow Human-in-the-Loop](https://airflow.apache.org/docs/apache-airflow/stable/tutorial/hitl.html)
- [Airflow Backfill](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/backfill.html)
