# 开源 Workflow 选型调研：分类、架构、任务模型与存储

调研日期：2026-09-08。对应问题：[question.md](./question.md)。

这份调研覆盖 13 个仍有维护活动的代表性开源项目，以及 4 个容易被混入开源清单的源码可用产品。它是跨类别选型地图，不声称穷尽 GitHub 上全部 Workflow。范围以通用业务编排、数据调度、容器工作流、业务审批、事件集成和 Agent 编排为主，不展开专门的 CI/CD、科学计算和纯任务队列。

## 1. 先按任务性质分类

**Temporal 和 Airflow 不是直接替代品。** 前者围绕“业务执行如何在故障后继续”，后者围绕“数据任务何时运行、依赖是否满足”。即使二者都能按顺序调用几个 API，核心模型和运维方式也不同。

| 类别 | 首要问题 | 本文候选 | 典型场景 |
|---|---|---|---|
| 持久化业务执行 | 服务宕机、等待回调后，业务如何可靠继续？ | Temporal、Cadence、DBOS | 订单、异步生成、跨服务流程、持续数天的等待 |
| 声明式服务编排 | 如何用流程定义组织分布式任务？ | Conductor OSS | 多语言微服务、动态配置流程、平台内置工作流 |
| 数据编排 | 哪批数据需要在什么依赖和时间条件下处理？ | Airflow、DolphinScheduler、Dagster、Prefect | ETL、数据仓库、数据资产、Python 数据流水线 |
| 通用声明式自动化 | 如何统一调度脚本、API、数据系统？ | Kestra | 数据与运维自动化、多语言脚本集成 |
| Kubernetes 工作流 | 如何组织一组容器和集群资源？ | Argo Workflows | 批计算、模型训练、媒体处理、容器流水线 |
| BPM / 人工业务流程 | 谁来审批，流程如何分支、超时和留痕？ | Flowable | 审批、工单、人工与系统混合流程 |
| 事件与系统集成 | 消息怎样在连接器之间流转？ | Node-RED | IoT、MQTT、Webhook、系统集成 |
| Agent 状态图 | 模型、工具、人工介入如何循环协作？ | LangGraph | 多轮 Agent、工具调用、检索、人工审核 |

分类依据是主导模型，并不表示项目只能用于这一类。Kestra 能做数据流水线，Temporal 能编排 Agent，Argo 也能做 ETL；“可以完成”不意味着同样适合。

## 2. 维护状态与开源范围

纳入条件：主仓库未归档，且观察到近期发布和/或开发活动。`pushed_at` 仅表示仓库收到推送，不等于默认分支有实质功能更新；因此尽量同时列出正式 Release。日期按来源 UTC 日期记录，是本次观察证据，不保证阅读时仍为最新版。

| 项目 / GitHub 仓库 | 核心仓库许可证 | 本次维护证据 |
|---|---|---|
| [Temporal](https://github.com/temporalio/temporal) | MIT | [v1.31.2，2026-07-08](https://github.com/temporalio/temporal/releases/tag/v1.31.2)；09-07 有推送 |
| [Cadence](https://github.com/cadence-workflow/cadence) | Apache-2.0 | [v1.4.1，2026-06-30](https://github.com/cadence-workflow/cadence/releases/tag/v1.4.1)；09-07 有推送 |
| [DBOS Python](https://github.com/dbos-inc/dbos-transact-py) | MIT | [2.31.0，2026-08-25](https://github.com/dbos-inc/dbos-transact-py/releases/tag/2.31.0)；09-04 有推送 |
| [Conductor OSS](https://github.com/conductor-oss/conductor) | Apache-2.0 | [v3.32.1，2026-08-12](https://github.com/conductor-oss/conductor/releases/tag/v3.32.1)；09-07 有推送 |
| [Airflow](https://github.com/apache/airflow) | Apache-2.0 | [3.3.1，2026-08-12](https://github.com/apache/airflow/releases/tag/3.3.1) |
| [Dagster](https://github.com/dagster-io/dagster) | Apache-2.0 | [1.13.21，2026-09-03](https://github.com/dagster-io/dagster/releases/tag/1.13.21) |
| [Prefect](https://github.com/PrefectHQ/prefect) | Apache-2.0 | [3.8.5，2026-09-03](https://github.com/PrefectHQ/prefect/releases/tag/3.8.5) |
| [Argo Workflows](https://github.com/argoproj/argo-workflows) | Apache-2.0 | [v4.1.2，2026-08-21](https://github.com/argoproj/argo-workflows/releases/tag/v4.1.2) |
| [Kestra](https://github.com/kestra-io/kestra) | Apache-2.0 | [v2.0.0，2026-09-07](https://github.com/kestra-io/kestra/releases/tag/v2.0.0) |
| [DolphinScheduler](https://github.com/apache/dolphinscheduler) | Apache-2.0 | [3.4.3，2026-09-06](https://github.com/apache/dolphinscheduler/releases/tag/3.4.3) |
| [Flowable](https://github.com/flowable/flowable-engine) | Apache-2.0 | [8.0.0，2026-02-27](https://github.com/flowable/flowable-engine/releases/tag/flowable-8.0.0)；09-04 有推送 |
| [Node-RED](https://github.com/node-red/node-red) | Apache-2.0 | [5.0.6，2026-09-01](https://github.com/node-red/node-red/releases/tag/5.0.6) |
| [LangGraph](https://github.com/langchain-ai/langgraph) | MIT | 仓库 2026-09-06 有推送；[发布页](https://github.com/langchain-ai/langgraph/releases)持续发布多个包，不能把 SDK 包版本当作核心引擎版本 |

许可证列针对所列开源仓库，不自动覆盖同品牌商业控制台、托管服务、企业插件。维护状态通过 GitHub API 的 `archived`、`pushed_at`、`license.spdx_id` 与官方发布记录核对；上述 13 个仓库均未归档。

已排除 [Netflix/conductor](https://github.com/Netflix/conductor)：原仓库归档，最后推送为 2023-12-22。选型应看仍维护的 `conductor-oss/conductor`，不能因此判断整个 Conductor 生态停止更新。

## 3. 读存储对照前，先拆开五类数据

| 数据 | 示例 | 选型时要问的问题 |
|---|---|---|
| 流程定义 | DAG、BPMN、YAML、代码版本 | 存在代码仓库还是运行数据库？运行实例绑定哪个版本？ |
| 执行状态 | 当前节点、事件历史、检查点、重试次数 | 宕机后恢复的依据是什么？ |
| 队列与协调 | 待执行任务、租约、锁、调度事件 | 是否额外依赖 Redis、消息队列或注册中心？ |
| 日志与查询索引 | 执行日志、搜索属性、审计历史 | 与核心状态能否独立保留和清理？ |
| 业务产物 | 视频、文档、数据集、模型文件 | 放对象存储、共享文件系统还是数仓？节点传内容还是 URI？ |

下面的“支持存储”描述的是官方提供的后端或机制。某个 SQL/HTTP 节点能访问一个数据库，不代表这个数据库可以作为引擎状态库。

## 4. 持久化执行与服务编排

### 4.1 Temporal

**场景：**跨服务业务流程、长时间异步任务、等待外部事件、需要故障恢复的 Agent 外层任务。

架构是 Temporal Service 与业务 Worker 分离：Frontend 接入请求，History 管理执行历史和状态推进，Matching 匹配任务与 Worker，服务端 Worker 处理内部后台工作。业务 Workflow 和 Activity 代码在应用 Worker 中运行。核心抽象是 Namespace、Workflow、Workflow Execution、Activity、Task Queue、Event History。

它没有必须遵循的可视化节点目录：业务工作单元主要是自定义 Activity；子 Workflow、Timer、Signal/Update 等表达组合、等待与交互。HTTP、SQL、LLM 调用一般封装成 Activity。Workflow 逻辑要求确定性，恢复时重放历史；已完成 Activity 的历史结果参与恢复。来源：[服务架构](https://docs.temporal.io/temporal-service/temporal-server)、[执行与重放](https://docs.temporal.io/workflow-execution)。

**存储：**核心执行状态可选 PostgreSQL、MySQL、Cassandra；Visibility 查询存储单独配置，可用 SQL 或 Elasticsearch 等受支持后端。不能把 Elasticsearch 当成核心历史库，也不要求每种部署都安装它。媒体大文件应存外部存储，在流程中传引用。来源：[官方 Helm 持久化配置](https://github.com/temporalio/helm-charts)。

**主要代价：**独立服务集群、数据库运维，以及确定性代码和版本演进约束。Activity 可能重试；流程可恢复不等于外部发布、扣款等副作用天然只发生一次，需要幂等设计。来源：[Activity execution](https://docs.temporal.io/activity-execution)。

### 4.2 Cadence

**场景：**与 Temporal 相近的长生命周期分布式业务执行。核心是 Workflow、Activity、Task List、Domain、事件历史；服务端与应用 Worker 分离，支持事件、持久化 Timer 和 Query。业务节点主要是自定义 Activity，而不是现成 SaaS 连接器目录。来源：[概念](https://cadenceworkflow.io/docs/concepts)。

**存储：**Cassandra、MySQL、PostgreSQL 等持久化后端；发布文档还包含 SQLite schema，选生产环境时应按目标版本验证。高级查询与执行历史存储需要分开理解，Elasticsearch/OpenSearch 属于查询相关后端。来源：[服务发布及 schema 说明](https://cadenceworkflow.io/docs/releases/cadence)、[集群维护](https://cadenceworkflow.io/docs/operation-guide/maintain)。

**替代关系：**与 Temporal 最接近，但不意味着 SDK、运行历史或 API 可直接互换。现有 Cadence 团队可以继续评估其生态；不能以“Temporal 出现了”推断 Cadence 停更。

### 4.3 DBOS

**场景：**希望在普通应用里增加可恢复流程，同时降低独立编排服务的部署负担。

核心抽象是 Workflow、Step、持久化 Queue 和 Schedule。SDK 嵌入应用，流程输入与步骤结果保存到 PostgreSQL；恢复时重新进入 Workflow，跳过已经持久化的 Step。任意外部操作放进 Step，控制流须满足确定性要求。分布式运行通过共享系统数据库协调；故障 Worker 的恢复还需配置控制面或手动协调方案。

**存储：**本文按当前架构文档以 PostgreSQL 为基线，保存检查点、步骤输出、队列和调度状态；大文件另存对象存储，Step 返回引用。节点不是固定的 HTTP/SQL 类型集合，而是用户函数。来源：[DBOS 架构与恢复机制](https://docs.dbos.dev/architecture)。

**替代关系：**是 Temporal/Cadence 在部分应用里的轻量候选，不应推断两者在治理、多语言协作和恢复管理上完全等价。官方称为 DBOS Conductor 的控制面与 Conductor OSS 是不同产品。

### 4.4 Conductor OSS

**场景：**用声明式流程定义组织多个独立服务，尤其适合平台需要动态装配任务的情况。

Java 服务端解释流程定义、推进状态、管理任务队列；多语言 Worker 领取任务并回报结果。核心是 Workflow Definition、Task Definition、Workflow Instance、Task Instance。业务 Worker 执行 SIMPLE 类任务；系统任务覆盖 HTTP、子流程、等待，以及 Switch、Fork/Join、循环等控制能力。来源：[系统任务](https://conductor-oss.github.io/conductor/documentation/configuration/workflowdef/systemtasks/index.html)。

**存储：**官方部署文档列 PostgreSQL、MySQL、Redis、Cassandra、SQLite 等后端，SQLite 定位本地开发；数据库、队列、索引和外置 Payload 后端分别配置。MySQL 方案还需要独立队列后端；不要把任意组合都当作已验证生产组合。官方 README 与部署页对默认配置存在差异，落地时以固定 Release 的配置样例为准。来源：[部署配置](https://github.com/conductor-oss/conductor/blob/main/docs/devguide/running/deploy.md)、[README](https://github.com/conductor-oss/conductor/blob/main/README.md)。

**替代关系：**在微服务编排层与 Temporal 重叠，但一个主要解释流程定义，一个主要恢复代码执行；迁移需要重写编排表达。

## 5. 数据编排与通用自动化

| 项目 | 适合的任务与场景 | 整体架构和核心抽象 | 工作节点类型 |
|---|---|---|---|
| Airflow | 定时 ETL、依赖调度、历史数据补跑 | Airflow 3：DAG processor、Scheduler/Executor、API Server、Worker、可选 Triggerer；DAG、DagRun、Task、TaskInstance | Operator、Sensor、TaskFlow 函数；Python、Shell、SQL、外部计算系统等由 Provider 提供 |
| DolphinScheduler | 可视化数据 DAG、大数据平台集中调度 | Master 调度与容错，Worker 执行，API/UI、Alert Server；流程定义/实例、任务定义/实例；注册中心协调 | Shell、SQL、Spark 等业务任务，以及依赖、条件、子流程等逻辑节点 |
| Dagster | 按数据资产组织生产、分区与血缘 | Webserver、Daemon、Code Location Server；Run Launcher 与 Executor；Asset、Op、Graph、Job、Run、Partition | Asset 物化函数、Op；通过集成与 Pipes 接入外部计算 |
| Prefect | 希望保留原生 Python 控制流的数据/后台任务 | API/Server 保存状态，Deployment、Work Pool、Worker 组织运行环境；Flow、Task、Flow Run、Task Run | `@flow` / `@task` 函数，Python 条件、循环与子 Flow；Process/Docker/K8s 是执行环境，不是业务节点类型 |
| Kestra | 用 YAML 统一编排脚本、API 和数据系统 | Webserver、Scheduler、Executor、Worker；Flow、Namespace、Execution、TaskRun | Runnable 任务执行脚本/API/SQL；Flowable 任务表达顺序、并行、条件、循环、子流；Java 插件扩展任务类型 |

架构与模型来源：[Airflow](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/overview.html)、[DolphinScheduler](https://raw.githubusercontent.com/apache/dolphinscheduler/dev/docs/docs/en/architecture/design.md)、[Dagster](https://docs.dagster.io/deployment/oss/oss-deployment-architecture)、[Prefect Flow](https://docs.prefect.io/v3/concepts/flows) 与 [Worker](https://docs.prefect.io/v3/concepts/workers)、[Kestra 架构](https://kestra.io/docs/architecture) 与 [任务类型](https://kestra.io/docs/workflow-components/tasks/runnable-tasks)。

| 项目 | 引擎状态 / 元数据 | 文件、返回值与其他存储 |
|---|---|---|
| Airflow | PostgreSQL / MySQL 为生产选择；保存任务状态等元数据 | XCom 默认数据库，适合小数据，可换对象存储 backend；日志单独配置；实际数据集在外部存储/数仓 |
| DolphinScheduler | 关系数据库保存定义与执行状态；当前官方配置示例为 PostgreSQL，其他后端按固定版本核对 | 资源中心支持 HDFS、S3、OSS、GCS、Azure Blob 等；注册中心、任务日志和 Worker 临时目录分别考虑 |
| Dagster | 默认 SQLite；可配 PostgreSQL / MySQL，保存 Run、Event Log、Schedule 等 | IO Manager 管理产物读写，可对接文件、对象存储、数仓；计算日志独立配置 |
| Prefect | SQLite / PostgreSQL；生产多服务部署以 PostgreSQL 为基线 | Result 默认不持久化；开启后默认本地，可配 S3/GCS/Azure 等；业务上传文件不自动成为受管理 Result |
| Kestra OSS | PostgreSQL / MySQL / H2，承担定义、执行、队列、日志等 | Internal Storage 存输入输出文件，默认本地，可配对象存储；Kafka + Elasticsearch 架构属于 Enterprise 能力 |

存储来源：[Airflow XCom](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/xcoms.html)、[DolphinScheduler 配置](https://raw.githubusercontent.com/apache/dolphinscheduler/dev/docs/docs/en/architecture/configuration.md)、[Dagster 实例配置](https://docs.dagster.io/deployment/oss/oss-instance-configuration) 与 [IO Manager](https://docs.dagster.io/guides/build/io-managers)、[Prefect Server](https://docs.prefect.io/v3/concepts/server) 与 [Results](https://docs.prefect.io/v3/advanced/results)、[Kestra 数据组件](https://kestra.io/docs/architecture/data-components)。

选择判断：现有任务 DAG 多，可优先比较 Airflow 与 DolphinScheduler；更关心“哪些资产及分区需要更新”，重点看 Dagster；希望接近普通 Python 编程，看 Prefect；需要多语言插件与 YAML 平台，看 Kestra。这是基于模型的适配判断，不是性能排名。

## 6. Kubernetes、BPM、事件集成与 Agent

### 6.1 Argo Workflows

**场景：**任务天然是容器，已有 Kubernetes，运行批处理、训练或转码任务。

使用 Kubernetes CRD 描述 Workflow，Controller 调谐并创建 Pod，由 Executor 配合执行；Argo Server 提供 UI/API。核心包括 Workflow、WorkflowTemplate、Template、Step/DAG Task。模板支持 Container、Script、Resource、Suspend、HTTP、ContainerSet、Plugin；Steps 和 DAG 描述编排关系。来源：[架构](https://argo-workflows.readthedocs.io/en/latest/architecture/)、[模板类型](https://argo-workflows.readthedocs.io/en/latest/workflow-concepts/)。

**存储：**在线状态在 Kubernetes Workflow 对象中，底层由 Kubernetes 持久化；SQL 可用于节点状态 offload 和执行归档，归档支持 PostgreSQL/MySQL。Artifact Repository 单独支持对象存储。工作流归档不会自动保留 Pod 日志。来源：[归档](https://argo-workflows.readthedocs.io/en/latest/workflow-archive/)、[Artifact Repository](https://argo-workflows.readthedocs.io/en/latest/configure-artifact-repository/)。

替代数据调度器时，重点看是否需要其数据建模、补数与资产语义；Argo 的核心优势是 Kubernetes 执行模型，而不是数据资产模型。

### 6.2 Flowable

**场景：**审批、工单、规则决策、人工与服务任务混合的业务流程。

Java 引擎可嵌入应用或作为独立服务；通过数据库事务推进流程，异步执行器处理异步 Job 和 Timer。核心是 BPMN Process Definition、Process Instance、Execution、Task、Variable、Job；项目还提供 CMMN、DMN 引擎。来源：[开源项目](https://github.com/flowable/flowable-engine)、[引擎配置](https://www.flowable.com/open-source/docs/bpmn/ch03-Configuration/)。

节点包括 User Task、Service Task、Script Task、Receive Task、Call Activity、网关、定时器和消息事件。User Task 明确表达待办与处理人，是它与一般函数任务框架的重要区别。来源：[BPMN 构件](https://www.flowable.com/open-source/docs/bpmn/ch07b-BPMN-Constructs/)。

**存储：**通过关系数据库保存部署、运行变量、任务、Job 和历史记录；官方配置列 H2、MySQL、PostgreSQL、Oracle、DB2、SQL Server。具体数据库版本和驱动须匹配目标 Flowable 版本。业务附件可以外置，不能把引擎变量表当作文件平台。来源：[数据库配置](https://www.flowable.com/open-source/docs/bpmn/ch03-Configuration/)。

### 6.3 Node-RED

**场景：**IoT、消息接入、轻量事件自动化、连接不同系统。

浏览器编辑器定义 Flow，Node.js Runtime 在节点间传递 `msg`。主要抽象是 Flow、Node、Wire、Subflow、Context。节点包括 Inject、Function、Change、Switch、Template、Delay 等，配合 HTTP/MQTT 与社区扩展完成集成。来源：[核心节点](https://nodered.org/docs/user-guide/nodes)。

**存储：**Context 默认只在内存；可改本地文件或扩展存储插件。持久化 Context 不等于持久化每一条在途消息，也不自动提供类似 Temporal 的历史重放。它更适合作为接入与集成层；要求跨宕机可靠继续的业务，应另外设计消息可靠性和执行状态。来源：[Context 与存储](https://nodered.org/docs/user-guide/context)。

### 6.4 LangGraph

**场景：**LLM 与工具反复调用、条件路由、人工介入和有状态 Agent。

本质是嵌入应用的图执行库，使用 State、Node、Edge、Reducer、Subgraph 表达流程；Pregel 风格的 super-step 组织执行。节点是普通同步/异步函数，可封装 LLM、工具、检索或任意业务逻辑；不是所有节点都必须调用模型。来源：[Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api)。

**存储：**Checkpointer 保存按 Thread 组织的执行检查点；Store 保存跨 Thread 的应用记忆。内存用于试验，SQLite/PostgreSQL 有核心仓库维护的适配包；MongoDB、Redis 等另有集成，维护方和功能需分别核对。大文件仍宜外置。来源：[Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)、[后端与维护仓库](https://docs.langchain.com/oss/python/integrations/checkpointers)。

MIT 的 LangGraph 库与商业 Agent Server/LangSmith 部署产品需要分别评估。检查点能支撑恢复，但生产环境的任务领取、服务重启后由谁恢复、并发控制和调度仍需设计，不能仅安装一个 Checkpointer 就视为完整分布式编排平台。来源：[独立 Server 部署要求](https://docs.langchain.com/langsmith/deploy-standalone-server)。

## 7. GitHub 有源码，但不纳入同等开源候选的产品

这几项仍有维护活动；下表排除的是“按宽松开源引擎同等比较”的资格，并非认为它们不能使用。因此不展开其全套架构和存储选型。

| 产品 | 主要类别 / 功能比较对象 | 许可边界与本次处理 |
|---|---|---|
| [Restate](https://github.com/restatedev/restate) | 持久化执行；与 Temporal、DBOS 部分重叠 | Server 使用 BSL 1.1，许可证明确说明当前不是 Open Source License；有附加使用授权与未来转换条款。不要把 SDK 的开源许可泛化到 Server。[许可证](https://github.com/restatedev/restate/blob/main/LICENSE) |
| [n8n](https://github.com/n8n-io/n8n) | 可视化应用集成；与 Node-RED、Kestra 部分重叠 | 使用 Sustainable Use License，并有企业许可部分，不应写成 MIT/Apache 开源平台。[许可证](https://github.com/n8n-io/n8n/blob/master/LICENSE.md) |
| [Dify](https://github.com/langgenius/dify) | 可视化 LLM 应用与工作流；与 LangGraph 部分重叠 | 修改版 Apache 2.0，增加多租户及前端标识等条件，不能按原版 Apache-2.0 理解。[许可证](https://github.com/langgenius/dify/blob/main/LICENSE) |
| [Camunda 8](https://github.com/camunda/camunda) | BPMN、人工与服务编排；与 Flowable 功能重叠 | 当前核心组件采用 Camunda License，官方二进制生产使用要求企业许可；部分组件独立开源不等于全平台开源。[官方许可说明](https://docs.camunda.io/docs/reference/licenses/) |

以上四项的主仓库在本次 GitHub API 核查中均未归档，且 2026-09-07 或 09-08 有推送。许可摘要仅说明本次筛选口径，实际落地以所选版本的 LICENSE 为准。

## 8. 哪些属于替代关系？

“直接替代”在这里指可以进入同一场景的采购/技术候选清单，不代表配置兼容或无成本迁移。

| 比较组 | 替代程度 | 关键差别 |
|---|---|---|
| Temporal ↔ Cadence | 高 | 都以持久化代码执行为中心；SDK、服务能力、生态和迁移工具分别评估 |
| Temporal / Cadence ↔ DBOS | 中到高，取决于规模与治理需求 | 独立编排服务 vs 应用 SDK + PostgreSQL；重点验证故障接管、语言边界、版本管理 |
| Conductor ↔ Temporal | 中 | 声明式任务图 vs 确定性代码工作流；动态流程配置和代码开发体验不同 |
| Airflow ↔ DolphinScheduler | 高 | 都适合数据任务 DAG；代码生态 vs 可视化数据调度体验 |
| Airflow ↔ Prefect ↔ Dagster | 中到高 | 共同覆盖数据编排；任务 DAG、原生 Python Flow、数据资产分别主导模型 |
| Kestra ↔ Airflow / Prefect / DolphinScheduler | 中 | 数据和脚本调度重叠；YAML、多语言插件与 Python/数据平台生态不同 |
| Argo ↔ 上述数据编排器 | 条件性替代 | 所有任务均容器化且已有 K8s 时更接近；也可以让上层数据平台调用 Argo |
| Flowable ↔ Temporal / Conductor | 部分 | 服务流程重叠；审批待办、BPMN 与业务人员协作更偏 Flowable |
| Node-RED ↔ Kestra | 部分 | 事件消息流与批次执行模型不同；系统连接重叠，故障恢复语义不等价 |
| LangGraph ↔ Temporal / DBOS | 部分，常可组合 | Agent 内部状态与路由 vs 外层可靠任务执行；不要建立两套互相争夺状态所有权的恢复逻辑 |

跨类别组合示例：数据平台负责每天决定处理哪批内容，Argo 执行重计算容器；业务编排引擎负责生成任务、回调、审核和发布；LangGraph 可负责其中的内容规划与工具循环。并非每个系统都需要这三层，组合会增加运维和状态同步成本。

## 9. 针对 Go + Python 自媒体 Agent 的初步 shortlist

以下是基于项目背景和上述架构的推断，尚未审查项目代码，也没有做性能测试。

| 主要需求 | 优先验证 |
|---|---|
| 文案/素材生成、等待异步视频回调、人工审核、延时发布；宕机后继续 | Temporal；若部署成本敏感，同时用 DBOS 做对照 PoC |
| 需要用户在平台中动态配置多语言任务流程 | Conductor OSS；偏脚本与运维自动化时比较 Kestra |
| 模型需要多轮思考、调用工具、按状态改变路线 | LangGraph；先判断是否已有可靠外层调度，避免重复建设 |
| 每天抓取数据、批量整理内容、生成报表 | Prefect / Airflow；核心是数据资产和分区时加入 Dagster |
| 大量隔离的转码、渲染容器，已有 Kubernetes | Argo Workflows |
| 多角色审批、转交、待办与复杂业务流程定义 | Flowable |

第一轮不建议同时试装全部项目。可以用同一个流程比较 Temporal 与 DBOS，再依据是否需要可配置 DSL 加入 Conductor：

`创建任务 → 生成文案 → 提交视频任务 → 等待回调 → 人工确认 → 发布 → 记录结果`

PoC 验收应覆盖下面这些行为，而不只验证正常路径：

1. 提交外部任务成功、保存结果前杀死 Worker，恢复后是否会重复提交？如何通过业务幂等键避免重复？
2. 回调重复到达、乱序到达或先于等待发生，能否正确关联同一业务任务？
3. 审核等待期间全部进程重启，任务是否保留，谁负责恢复？
4. 流程运行中升级代码，旧实例如何继续，新实例如何使用新版本？
5. 单步持续失败时，能否观察、取消和人工修复？取消后已发出的第三方任务是否仍在运行？
6. 视频只在节点间传 URI，执行历史、日志与文件分别清理后，是否仍能解释任务结果？

这些测试决定的是实际可靠性和维护成本。本文没有给出未经实测的吞吐量、延迟排名或“任意外部副作用 exactly-once”的承诺。
