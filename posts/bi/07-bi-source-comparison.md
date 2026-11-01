# BI 开源项目源码对照：WrenAI、Metabase、Lightdash、SQLBot 与自建方案

调研日期：2026-10-16。目标：理解实际实现，选择可复用能力，而非再增加一组项目宣传列表。

范围：下载五份源码快照，沿数据源、语义编译、查询执行、图表/看板持久化和权限路径做定向阅读。未安装依赖、未运行服务、未连接数据库；这不是完整代码审计或性能测试。WrenAI 的旧版限制、免费边界与新版架构详见 [独立分析](07-wrenai-analysis.md)。

## 1. 下载位置与可复查版本

源码保留在系统临时目录 `C:/Users/tao/AppData/Local/Temp/bi-source-research-20261016/`，未放进博客仓库。使用浅克隆；Metabase 按关注目录检出，并额外核查稳定版关键文件。

| 项目/分支 | 子目录 | 固定提交 |
| --- | --- | --- |
| WrenAI main | `wrenai` | `9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308` |
| WrenAI Classic legacy/v1 | `wrenai-classic` | `ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc` |
| Metabase master | `metabase` | `06a0739e4bbb12c1a7c9b9b6bc8b0e3cd8b96528` |
| Lightdash main，包版本 2.589.3 | `lightdash` | `87c74eeeda04800c2111e0f2900c972d04ee242b` |
| SQLBot main | `sqlbot` | `fc378c370f200840b3ac5ae23699c42b335bee05` |

后文将源码事实、组合推断与待运行验证分开。开发分支中存在代码，不代表当前稳定镜像、免费发行包和你现有安装都已有相同功能。

## 2. 总体判断

| 项目 | 实现重心 | 对本需求最有价值的部分 | 主要缺口/边界 |
| --- | --- | --- | --- |
| WrenAI 新版 | 语义与上下文引擎＋CLI/SDK | MDL、SQL 规划、策略、检索、错误契约 | 团队 UI 与资产权限需另建；常规查询绑定一个 connector |
| WrenAI Classic | 从建模到聊天、图表、单看板的纵向产品 | 短闭环、图表与真实值分离、模型发布快照 | 单 project/单 dashboard，全局状态多，部门权限链路不足 |
| Metabase | 查询/图表/看板资产平台＋原生 Agent | 成熟编辑器、查询中间表示、统一写服务与权限 | 需要区分版本和授权；原生 JOIN 不能自动跨独立连接 |
| Lightdash | 业务指标模型→结构化查询→图表/看板 | fanout 防护、版本化资产、受限结果组合 | AI/MCP 和额外连接存在商业门控 |
| SQLBot | Python 问数→图表→画布 | 容易阅读的分阶段流水线、聊天图表入看板 | 单数据源会话、xpack 权限边界、刷新授权待验 |
| 自建方案五/六 | 按需求拼小范围产品 | 体验和边界可控，适配自己的 Agent | 资产、编辑、身份、刷新和错误恢复都要维护 |

这次最重要的变化：**不能因为 Metabase 在 JVM 上运行就先排除它；也不能只凭图表生成库就低估自建 BI 产品层的工作量。**

## 3. WrenAI：重点复用新版组件，谨慎分叉旧产品

Classic 实际限制一个当前 project/连接和一个 dashboard，默认部署有多项常驻服务。新版则可保存多个 profile、进程内运行语义引擎，并有 Python/Agent SDK；这修正了把旧版限制概括成所有免费 Wren 的说法。

新版的常规链路是 MDL SQL→AST/策略→Rust 语义展开→CTE/方言→一个 connector。它适合作为 [方案五](05-trino-json-render-flint.md) 的语义增强，配合 Trino 执行物理跨库查询；其自身不是所有连接之间的任意联邦调度器。[当前 engine](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/engine.py#L177-L265)

值得参考：发布模型 hash、按查询提取上下文、检索已确认 SQL、dry-plan/dry-run/执行分离、错误分类、有界修复。Classic 将看板 item 的 SQL、图表 Schema、布局独立持久化，后续刷新无需每次再调用 LLM。[Classic 发布](https://github.com/Canner/WrenAI/blob/ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc/wren-ui/src/apollo/server/services/deployService.ts#L76-L115)、[看板 item](https://github.com/Canner/WrenAI/blob/ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc/wren-ui/src/apollo/server/repositories/dashboardItemRepository.ts#L28-L47)

不要直接继承 Classic 的全局 current project/current dashboard 和缺少部门主体的上下文。新版 MDL 有行列控制原语，但身份注入、目录可见性、资产 ACL 和缓存隔离仍由产品层建设。详细源码与文档矛盾记录见 [WrenAI 独立分析](07-wrenai-analysis.md)。

## 4. Metabase：已有产品层值得优先验证

本节将稳定版和 master 的差异单独标注；底层主要是 Clojure/JVM，前端是 React/TypeScript。外部 Python/Node 服务通过 API 操作原生资产，可以不修改后端源码。

当前官方文档说明，使用自己的模型凭据的 Metabot 和 MCP 面向所有套餐；商业能力另包括部分高级管控、团队运营与内容同步工作流。不能沿用“Metabot 全部收费”的旧印象，也不能把模型 API 用量费用理解为没有成本。[AI 概览](https://www.metabase.com/docs/latest/ai/overview)、[AI 配置](https://www.metabase.com/docs/latest/ai/settings)

### 4.0 版本核查范围

本轮发布信息查询得到 v0.64.1（2026-10-07）。稳定版 `metabot/api.clj` 已定向读取，可看到原生 Clojure Agent 流水线；但稳定 tag 的完整下载没有完成，新 MCP v2 写工具未完成稳定版复核。下面的 MCP 写操作结论严格限定于 master 提交，不据此建议直接将开发分支用于生产。[发行记录](https://github.com/metabase/metabase/releases/tag/v0.64.1)、[稳定版 Metabot 入口](https://github.com/metabase/metabase/blob/v0.64.1/src/metabase/metabot/api.clj)

### 4.1 查询与图表资产是自建方案需要学习的重点

Metabase 用结构化查询表示支持可视化编辑，再由 query processor 转成目标数据库查询；原生 SQL 也可以保存。查询语义、图表配置和摆放在某个看板中的实例应分别理解，不应揉成一份无法定位引用的大 JSON。

源码中可以沿 preprocess→compile→driver `mbql->native`→execute 阅读。编译后仍保留原 MBQL，源码说明它还用于后续权限检查。这提示我们的编译结果应保留业务请求、模型和字段来源，不能只留下最终 SQL。[preprocess](https://github.com/metabase/metabase/blob/06a0739e4bbb12c1a7c9b9b6bc8b0e3cd8b96528/src/metabase/query_processor/preprocess.clj#L55-L111)、[compile](https://github.com/metabase/metabase/blob/06a0739e4bbb12c1a7c9b9b6bc8b0e3cd8b96528/src/metabase/query_processor/compile.clj#L46-L83)

当前源码的普通 REST 保存链是：

1. `POST /api/card`：保存 dataset_query、display 和 visualization_settings。
2. `POST /api/dashboard`：创建看板。
3. `PUT /api/dashboard/:id`：提交 dashcards、布局、参数映射等；旧的 `/cards` 更新路径已标记 deprecated。

接口形状以目标安装的版本文档为准。这条链说明无需先 fork 核心，也能在 Python/Node 中完成原生资产适配。[card API](https://github.com/metabase/metabase/blob/06a0739e4bbb12c1a7c9b9b6bc8b0e3cd8b96528/src/metabase/queries_rest/api/card.clj#L480-L499)、[dashboard API](https://github.com/metabase/metabase/blob/06a0739e4bbb12c1a7c9b9b6bc8b0e3cd8b96528/src/metabase/dashboards_rest/api.clj#L1142-L1160)

Card 是保存的查询和默认图表，Dashcard 是它在某个看板上的实例，拥有位置、尺寸、parameter_mappings、局部 visualization_settings 和 tab 引用。同一个 Card 可以被不同面板引用；这直接支持自建的 ChartDefinition 与 DashboardPanel 分离。[DashboardCard 模型](https://github.com/metabase/metabase/blob/06a0739e4bbb12c1a7c9b9b6bc8b0e3cd8b96528/src/metabase/dashboards/models/dashboard_card.clj#L210-L218)

master 的 MCP `question_write` 可以从 query_handle、结构化 query 或 native SQL 建立持久问题；`dashboard_write` 接收增量 ops，读取当前状态后交给纯编译逻辑，再调用 REST 共用的 domain write 函数。它会检查被引用卡片的读取权限，保存 native SQL 还需要对应 scope 与执行 SQL 权限。[question 工具](https://github.com/metabase/metabase/blob/06a0739e4bbb12c1a7c9b9b6bc8b0e3cd8b96528/src/metabase/mcp/v2/tools/question.clj#L1-L28)、[dashboard 工具](https://github.com/metabase/metabase/blob/06a0739e4bbb12c1a7c9b9b6bc8b0e3cd8b96528/src/metabase/mcp/v2/tools/dashboard.clj#L1-L74)

这支持一个设计判断：Agent 与手动编辑器共用同一套写服务和权限判断；Agent 发送“添加卡片/移动面板/修改筛选目标”等操作，比把整个看板往返塞进模型更容易控制修改范围。事务、冲突和失败恢复仍需逐个接口核查，不能假定所有组合调用都是一个事务。

一个源码核验细节：dashboard 工具头部注释仍说 create＋ops 不是一个保存，但实际分支已有事务包裹。本文按具体实现判断，未沿用该过时注释，也不外推为跨服务整体事务。[实际 create＋ops 分支](https://github.com/metabase/metabase/blob/06a0739e4bbb12c1a7c9b9b6bc8b0e3cd8b96528/src/metabase/mcp/v2/tools/dashboard.clj#L497-L506)

### 4.2 多数据库连接与跨库 JOIN

Metabase 查询构建器的 JOIN 要求来源在同一数据库连接中。多个连接可以共存，也可以在同一看板显示各自的结果；这不能完成 MySQL 订单与另一个 PostgreSQL 连接的单次关联查询。[官方 JOIN 范围](https://www.metabase.com/docs/latest/questions/query-builder/join)

符合本需求的路径是 `Metabase → Trino/Starburst 连接 → 多个物理 catalogs`，并对实际驱动、catalog 发现、模型和查询方言做验证。跨物理源能力由底层统一查询面提供。[Starburst 连接文档](https://www.metabase.com/docs/latest/databases/connections/starburst)

本次源码中的驱动文档明确支持 Trino，并列有版本及 model features 限制；不能由“连上 Trino”推断所有建模与编辑功能完全可用。测试范围至少包括 catalog 发现、SQL 保存图表、筛选参数及需要的模型功能。[固定版本驱动文档](https://github.com/metabase/metabase/blob/06a0739e4bbb12c1a7c9b9b6bc8b0e3cd8b96528/docs/databases/connections/starburst.md#L8)

### 4.3 对你“Java 不太熟”的具体影响

需要区分三种工作：

1. 部署和配置 Metabase：主要处理 JAR/容器、应用数据库、源连接与权限。
2. 外部 Agent 集成：写 Python/TypeScript，调用 MCP 或 REST，保留原生编辑器。
3. 深改查询引擎、权限或驱动：需要理解 Clojure/JVM、MBQL 和 Metabase 内部架构，维护成本较高。

你的顾虑对第三种工作很重要；前两种可以先避开核心源码改造。若现有 Metabase 的 UI 已基本可接受，先验证原生 AI 和外部集成，比因为语言偏好立即重做整个看板层更有依据。

### 4.4 部门隔离需要单独验收

数据读取、原生 SQL、collection/chart/dashboard 的读写分别配置。共享同一底层数据库账号时，应用分组不自动变成按部门的数据库行策略；使用商业行列安全、底层引擎策略或部门受限连接等哪一种方式，要根据版本与授权确定。

社区 enterprise middleware 中的 sandbox 注入是原样返回 query 的占位路径，实际 sandbox/impersonation 实现在企业模块。因此开源部署不能直接承诺具备按用户属性的完整行列隔离。可考虑一个 Trino 服务配多个部门受限账号/Metabase 连接，再限制连接与 collection 的可见性，而非让各部门共用全域查询账号。[社区 middleware](https://github.com/metabase/metabase/blob/06a0739e4bbb12c1a7c9b9b6bc8b0e3cd8b96528/src/metabase/query_processor/middleware/enterprise.clj#L26-L37)

MCP 社区工具策略中的 unrestricted 表示没有收费的细粒度工具分组限制，不表示绕过数据、内容资产与 SQL 权限。[MCP policy](https://github.com/metabase/metabase/blob/06a0739e4bbb12c1a7c9b9b6bc8b0e3cd8b96528/src/metabase/mcp/permissions.clj#L38-L47)

尤其不能把“有内容写权限”当作“有权保存任意 SQL”。master MCP 的 native source 检查正好说明这两类授权应分开。[native source gates](https://github.com/metabase/metabase/blob/06a0739e4bbb12c1a7c9b9b6bc8b0e3cd8b96528/src/metabase/mcp/v2/tools/question.clj#L133-L150)

## 5. Lightdash：最有价值的语义编译与结果组合参考

### 5.1 从模型到 SQL，不是简单字段拼接

当前独立 Lightdash 模型经过统一转换与 ExploreCompiler，再由 MetricQueryBuilder 构造查询。因此不应笼统声称任何场景都必须先搭完整 dbt 工程。[独立模型编译](https://github.com/lightdash/lightdash/blob/87c74eeeda04800c2111e0f2900c972d04ee242b/packages/common/src/compiler/compileLightdashModels.ts#L7-L28)

编译阶段处理关联表、别名、模型 sqlWhere、用户属性和 required filters；指标计算还结合主键和关系类型处理 fanout，并在无法确定时警告。[过滤编译](https://github.com/lightdash/lightdash/blob/87c74eeeda04800c2111e0f2900c972d04ee242b/packages/backend/src/utils/QueryBuilder/MetricQueryBuilder.ts#L1349-L1383)、[fanout 处理](https://github.com/lightdash/lightdash/blob/87c74eeeda04800c2111e0f2900c972d04ee242b/packages/backend/src/utils/QueryBuilder/MetricQueryBuilder.ts#L2947-L3071)

对自建的启发：QuerySpec 可以先只允许发布过的 metrics/dimensions/filters/timezone，编译器负责确定性规则。关联基数、聚合粒度、均值/比例计算不应只作为提示词约定。

### 5.2 真正存在 DuckDB 结果 JOIN，但连接入口仍有门控

已读代码显示实际执行 DAG：各源查询→物化结果→将结果表命名为 merge_source_N→DuckDB JOIN、计算和排序。它确实关联结果集，超出了同一看板摆放多张图。[composeMergeSql.ts](https://github.com/lightdash/lightdash/blob/87c74eeeda04800c2111e0f2900c972d04ee242b/packages/backend/src/utils/QueryBuilder/composeMergeSql.ts#L24-L74)、[执行 DAG](https://github.com/lightdash/lightdash/blob/87c74eeeda04800c2111e0f2900c972d04ee242b/packages/backend/src/services/AsyncQueryService/AsyncQueryService.ts#L13305-L13310)

但不能据此承诺免费异构联邦查询：

- 额外 warehouse connection 要求企业 multi-connection add-on 和 rollout 条件；社区 LicenseService 返回不允许。
- 已读入口只允许部分 warehouse 类型，extra connection 还要求与原连接同类型。
- warehouse 类型有 Trino，但没有原生 MySQL。
- 社区 compose 执行器仍要求结果 S3 存储等配置。

证据：[连接门控](https://github.com/lightdash/lightdash/blob/87c74eeeda04800c2111e0f2900c972d04ee242b/packages/backend/src/services/WarehouseConnectionService/multipleConnectionsGate.ts#L10-L45)、[社区许可服务](https://github.com/lightdash/lightdash/blob/87c74eeeda04800c2111e0f2900c972d04ee242b/packages/backend/src/services/LicenseService/LicenseService.ts#L25-L29)、[类型与执行器](https://github.com/lightdash/lightdash/blob/87c74eeeda04800c2111e0f2900c972d04ee242b/packages/backend/src/services/AsyncQueryService/ComposeEngineClient.ts#L25-L79)

所以这是值得学习的实现模式，不是已经验证的免费 MySQL＋PostgreSQL 查询成品，也不能直接替代 Trino 的任意原始大表 JOIN。

### 5.3 结果引用本身是一种需要重新授权的数据访问

Lightdash 会对引用的 query UUID 逐一检查读权限；阻止用户直接通过 read_parquet/read_json 等读取任意文件，再把允许结果注入受限会话。[引用授权](https://github.com/lightdash/lightdash/blob/87c74eeeda04800c2111e0f2900c972d04ee242b/packages/backend/src/services/AsyncQueryService/AsyncQueryService.ts#L10403-L10514)、[文件访问检查](https://github.com/lightdash/lightdash/blob/87c74eeeda04800c2111e0f2900c972d04ee242b/packages/backend/src/services/AsyncQueryService/AsyncQueryService.ts#L11340-L11360)

某源返回行数达到上限时，merge 会拒绝并要求缩小范围，避免静默截断后错误关联；未知行数不会触发同样的拒绝。自建时可以进一步要求每个结果显式证明 complete，未知完整性不能当成准确对账结果。[row cap 检查](https://github.com/lightdash/lightdash/blob/87c74eeeda04800c2111e0f2900c972d04ee242b/packages/backend/src/services/AsyncQueryService/mergeQueryExecution.ts#L173-L195)

### 5.4 稳定 ID、版本与引用应进入自建资产模型

SavedChartModel 在事务中保存版本，将语义查询、图表配置、参数、时区与创建主体分别记录。DashboardModel 则管理看板版本、tabs、tile UUID、位置、尺寸、chart 引用和筛选引用清理。[SavedChartModel](https://github.com/lightdash/lightdash/blob/87c74eeeda04800c2111e0f2900c972d04ee242b/packages/backend/src/models/SavedChartModel.ts#L316-L377)、[DashboardModel](https://github.com/lightdash/lightdash/blob/87c74eeeda04800c2111e0f2900c972d04ee242b/packages/backend/src/models/DashboardModel/DashboardModel.ts#L205-L350)

这说明 DashboardSpec 可作为交换格式，但不能让每轮 Agent 修改都重建 panel_id，否则筛选目标、人工编辑和引用会失效。

## 6. SQLBot：可读的 Python 产品流水线与权限生命周期问题

### 6.1 实际链路

~~~text
一个 datasource 的会话
  → schema/样例
  → SQL 生成
  → AST 表名校验与权限处理
  → SQL 执行
  → 独立生成 chart JSON
  → 保存 ChatRecord
  → 转为画布组件并保存
~~~

Chat/ChatRecord 保存一个 datasource，执行使用当前 self.ds；注册多个源不等于单条 SQL 跨多个连接。[chat_model.py](https://github.com/dataease/SQLBot/blob/fc378c370f200840b3ac5ae23699c42b335bee05/backend/apps/chat/models/chat_model.py#L93-L113)、[执行入口](https://github.com/dataease/SQLBot/blob/fc378c370f200840b3ac5ae23699c42b335bee05/backend/apps/chat/task/llm.py#L1315-L1317)

SQL 表集合来自真实 AST，而非直接相信模型返回的 tables 字段；执行后再生成和归一化图表配置。图表解析路径仍有待补的 type check，不能把可解析 JSON 当作完整 Schema 验证。[SQL 校验](https://github.com/dataease/SQLBot/blob/fc378c370f200840b3ac5ae23699c42b335bee05/backend/apps/chat/task/llm.py#L1467-L1507)、[图表解析](https://github.com/dataease/SQLBot/blob/fc378c370f200840b3ac5ae23699c42b335bee05/backend/apps/chat/task/llm.py#L1207-L1264)

### 6.2 聊天结果成为画布组件

前端把 SQL、datasource、chart 与结果作为添加看板的数据，序列化组件结构、样式和 view 信息后调用 create/update canvas，后端保存画布。[ChartBlock.vue](https://github.com/dataease/SQLBot/blob/fc378c370f200840b3ac5ae23699c42b335bee05/frontend/src/views/chat/chat-block/ChartBlock.vue#L235-L246)、[canvasUtils.ts](https://github.com/dataease/SQLBot/blob/fc378c370f200840b3ac5ae23699c42b335bee05/frontend/src/views/dashboard/utils/canvasUtils.ts#L73-L119)

可借鉴其短链路实现，但自建应明确图表定义、执行结果和布局资产的版本关系，避免保存的数据副本与刷新结果长期漂移。

### 6.3 权限不能只在第一次问数时判断

行列权限逻辑依赖 sqlbot_xpack；本次主体仓库没有该扩展的完整源码，不能仅据 imports 判定每项功能收费或可免费使用。[permission.py](https://github.com/dataease/SQLBot/blob/fc378c370f200840b3ac5ae23699c42b335bee05/backend/apps/datasource/crud/permission.py#L5-L7)

已读看板路径按 workspace 和创建者筛选、读取与更新，更接近工作区中的个人资产，不能据此证明部门多人共同编辑。加载看板时还会重新执行保存的 datasource＋SQL；所用 helper 没有接收当前用户。[dashboard_service.py](https://github.com/dataease/SQLBot/blob/fc378c370f200840b3ac5ae23699c42b335bee05/backend/apps/dashboard/crud/dashboard_service.py#L15-L118)、[查询 helper](https://github.com/dataease/SQLBot/blob/fc378c370f200840b3ac5ae23699c42b335bee05/backend/apps/chat/curd/chat.py#L271-L280)

这是需要验证的授权生命周期问题，不是本次已证实漏洞：可能还有其他拦截层或生成时过滤。我们的设计应明确在每次刷新、导出与结果读取时绑定当前身份，撤销权限后旧看板也要收敛。

## 7. 新启发：先在各源受控聚合，再做结果组合

Lightdash 提供了一种值得加入 [方案六](06-duckdb-generative-bi.md) 研究的变体：

~~~mermaid
flowchart LR
  Q[分析请求与登录身份] --> A[订单源：授权查询与聚合]
  Q --> B[预算源：授权查询与聚合]
  A --> RA[完整结果 A 与执行证据]
  B --> RB[完整结果 B 与执行证据]
  RA --> C[受限 DuckDB 组合]
  RB --> C
  C --> V[真实结果绑定图表与看板]
~~~

例如先分别得到“月份＋部门”的净销售额与预算，再按共同粒度关联计算完成率。这样可以复用已有连接、权限和查询结果，无需让第二阶段引擎持有全部原库凭据。

成立条件必须显式定义：

- 组合键、粒度、时区、币种和空值语义一致。
- 每个输入有完整性标记、源时间、身份范围、模型版本与有效期。
- 不把截断结果、未知完整结果用于声称完整的 JOIN。
- DISTINCT 人数、平均值、比例和不同粒度的过滤不能任意先聚合再关联。
- 结果文件不能公开暴露；引用句柄与历史结果每次重新鉴权。
- 数据量超出预算或需要原始大表复杂关联时转交 Trino/分析仓库。

它是一个架构候选，不能把结果集 JOIN 当成所有原始表 JOIN 的等价替换。若首版指标依赖精细关联，仍先用统一查询底座。

## 8. 对原有自建方案的具体修改建议

| 原设计位置 | 本轮源码启发 | 建议落实 |
| --- | --- | --- |
| 小目录/语义层 | Wren 的可执行 MDL、Lightdash 的 MetricQuery | 首版发布少量指标/关系；需要复杂编译时评估现成模块 |
| QuerySpec | MBQL 与 Lightdash 结构化语义查询 | 显式指标、维度、时间、筛选和稳定字段 ID；不开放无限 SQL 表面 |
| SQL 验证 | Wren 输入与展开输出两阶段策略 | 模型展开后仍校验；只读、范围、身份、成本分别检查 |
| 查询结果 | N+1 截断标记、结果 UUID 授权 | result_ref＋complete＋scope＋freshness＋model_revision |
| 图表 | Wren/SQLBot 查询与图表分阶段 | 真实结果后选图，规格与数值分离；Flint 是可选适配器 |
| 看板资产 | Metabase card/placement、Lightdash 版本/tile | 图表定义与面板放置分离，稳定 panel_id，保留修订 |
| Agent 修改 | Metabase 增量 ops 与共用写服务 | 人工和聊天走相同操作 API；冲突时读新版本后重放 |
| 部门隔离 | SQLBot 刷新链路的待验证点 | 每次查询、刷新、缓存、导出和引用都重做权限判断 |
| Agent 记忆 | Wren 已确认案例与派生索引 | 只收录验证过的案例，按数据域与权限隔离，不自动推广私人历史 |

这些对象可以在同一个应用后端实现，不要求拆成多个微服务。首版也不需要同时上 Wren、Cube、Marmot、向量数据库和两套图表库。

### 推荐的最小资产关系

~~~text
业务模型 revision
  └─ QueryDefinition（业务请求与模型引用）
       ├─ QueryExecution（当前身份、时间、状态、结果句柄）
       └─ ChartDefinition（视觉编码与格式）
            └─ DashboardPanel（稳定 ID、位置、局部覆盖）

Dashboard revision
  ├─ Panels
  ├─ Filters → 稳定字段与 panel 引用
  └─ Interactions → 受控筛选或明细操作
~~~

这比只保存一段 HTML、一个 ECharts option 或某次查询的完整结果更适合后续编辑和刷新。交换时仍可以用 JSON，持久化关系与更新语义必须明确。

## 9. 复用代码与参考设计分开

| 仓库/路径 | 本次看到的许可边界 | 对复用的影响 |
| --- | --- | --- |
| Wren 新版 core/sdk 等 | Apache-2.0；docs 另为 CC BY 4.0 | 可评估嵌入模块，按路径与发行包核对 |
| Wren Classic | AGPL-3.0 | 设计参考与直接复制代码分开评估 |
| Metabase | 社区默认 AGPL；enterprise 默认商业许可 | 不把公开可读的企业代码当社区授权 |
| Lightdash | 社区 MIT，ee 另有企业许可 | 社区模块与 EE Agent/MCP 不混为一体 |
| SQLBot | GPLv3 加附加条件，xpack 单独分发 | 不能按 MIT/Apache 组件直接处理 |

本轮优先建议复用运行中的标准接口或完整库模块；对大型产品中的内部类，阅读价值往往大于直接复制价值。内部模块的依赖、数据库结构、错误模型和升级责任也会一起带入。

许可原文：[Metabase](https://github.com/metabase/metabase/blob/06a0739e4bbb12c1a7c9b9b6bc8b0e3cd8b96528/LICENSE.txt)、[Lightdash](https://github.com/lightdash/lightdash/blob/87c74eeeda04800c2111e0f2900c972d04ee242b/LICENSE)、[SQLBot](https://github.com/dataease/SQLBot/blob/fc378c370f200840b3ac5ae23699c42b335bee05/LICENSE)；Wren 详见独立报告的路径许可映射。

## 10. 选型建议与下一步验证

**近期内部交付**：继续比较成熟 BI＋统一查询底座。此前推荐的 Superset＋Trino 保留；Metabase＋Trino 应重新进入直接对照，尤其当现有 UI 可接受、原生 AI 与 API 能覆盖需求时。语言熟悉度只应影响需要实际修改的部分。

本轮新增的直接候选是 **Metabase＋Trino＋BYO Metabot／外部 Agent＋必要的 REST 适配**。先测试自带聊天是否覆盖“生成→保存→加入指定看板→继续编辑”；不足时在外部补业务规划和操作工具，优先保留成熟编辑器。master 的 MCP 写工具可作为后续版本能力观察点，当前稳定部署不足时使用目标版本支持的 REST API，不以开发分支功能作交付承诺。

**自有 AI BI 产品**：方案五保留，吸收稳定资产、操作式编辑和当前身份执行的设计；Wren 新版可作为可选语义编译模块。不要从零重新实现完整指标引擎，除非实际范围非常小且有清晰验证。

**部署简化**：方案六和本文件的“各源聚合＋结果组合”变体可以评估；先证实语义等价、输入完整、身份隔离和源端压力，再决定替换 Trino。

用同一个业务案例对照：两个独立数据库、两个部门、订单/退款一对多、客户维度重复、净收入与完成率；生成四个面板，保存、重开、刷新、手改后聊天改、权限撤销和重试恢复。分别记录新增代码责任和剩余限制，避免把“demo 能出图”作为终点。

本次源码阅读不能给出开发天数或生产性能保证；它已足够说明，优先要验证的是数据与资产模型、权限生命周期和现成编辑器复用价值，而不是继续收集更多图表库。
