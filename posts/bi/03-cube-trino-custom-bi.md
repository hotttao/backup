# 方案三：Cube Core＋Trino＋自建 Agent 与仪表盘 UI

调研日期：2026-10-15。路线：独立业务语义层。结论：技术上适配“统一指标＋跨源查询＋自定义体验”，但不是最快交付内部 BI 的选择。

本文核实组件能力，组合系统是拟设计，未部署验证。完整聊天、看板编辑和用户管理需自行实现，不能把 Cube 商业平台的 UI 当作 Cube Core 自带功能。

## 1. 架构

~~~mermaid
flowchart LR
  U[内部用户] --> UI[自建聊天与仪表盘]
  UI --> B[应用后端与部门权限]
  B --> A[LangGraph Agent]
  A --> S[分析与展示配置校验]
  S --> C[Cube Core 语义查询]
  UI --> B
  B --> C
  C --> T[Trino]
  T --> M[MySQL 实例 A]
  T --> P[PostgreSQL 或 MySQL 实例 B]
  B --> D[应用元数据与会话存储]
~~~

- Cube Core 负责指标、维度、模型、查询与缓存。
- Trino 负责异构数据源访问和同次 SQL 的跨 catalog JOIN。
- 应用后端负责用户、部门、图表/看板资产、访问检查及签发受限身份。
- Agent 选择已发布的语义成员，生成结构化图表和布局，不能获得源库管理员凭据。
- UI 将结构化配置渲染成图表，并提供“加入看板”、拖拽、筛选、修改和保存。

Cube 官方将开源 Core 定位为语义层，把完整 Agent、前端和平台能力放在商业 Cube 产品中；该边界是本方案开发量大的原因。[官方产品区分](https://cube.dev/blog/cube-core-and-cube)

## 2. 数据源和跨源 JOIN

Cube 直接支持 MySQL、PostgreSQL 等，并有 Trino 配置说明。本方案用 Trino 作为 Cube 的主要逻辑数据源，跨库关联集中在受控查询视图或模型 SQL 中。[Cube Trino 连接](https://docs.cube.dev/admin/connect-to-data/data-sources/trino)、[Cube 模型](https://docs.cube.dev/reference/data-modeling/cube)

例如订单在 mysql_orders、客户在 pg_crm，Trino 处理三段式 catalog.schema.table 引用；Cube 的模型只面对经过整理的业务关系。该分工的收益是语义层无需自行实现异构联邦计算。[Trino 概念](https://trino.io/docs/current/overview/concepts.html)

Cube 自身也有多数据源和跨源 rollup_join 方案，但依赖预聚合匹配，并非任意跨两个连接直接实时 JOIN。本方案不将“data_source 可配置多个”当作跨源查询证明。[官方跨源示例](https://docs.cube.dev/recipes/pre-aggregations/joining-multiple-data-sources)

支持哪些底层数据库取决于 Trino 连接器，不是所有 JDBC 数据库都自动可用。MySQL、PostgreSQL 是首批验证对象，Oracle/SQL Server 等在需要时按连接器逐一核验。

## 3. 语义与配置层

业务模型使用 Cube 原生模型，避免另外发明一套指标定义。模型应包含业务描述、指标表达式、时间维度、粒度、主键和关系基数。

对话层再定义轻量的分析请求与 DashboardSpec：

~~~text
已发布模型版本
  -> 指标/维度/筛选引用
  -> 语义查询
  -> 表格结果与字段类型
  -> ChartSpec
  -> DashboardSpec
  -> 自建前端渲染和保存
~~~

Cube 有 SQL API 及 JSON REST API。官方目前推荐新项目优先评估 SQL API；本项目也可用受限的 JSON 分析结构降低首版适配复杂度，但不能为此重复实现完整指标表达式系统。[API 方向](https://cube.dev/blog/cube-core-and-cube)、[JSON REST API](https://docs.cube.dev/reference/core-data-apis/rest-api)

## 4. UI 与 Agent

| 能力 | 本方案由谁提供 | 现成程度 |
| --- | --- | --- |
| 业务指标和查询 API | Cube Core | 原生组件 |
| 跨源 JOIN | Trino | 原生组件，需建模配置 |
| 聊天规划与解释 | LangGraph + 模型 | 自建业务逻辑 |
| 聊天结果图表 | 自建前端 | 自建 |
| 加入可编辑仪表盘 | 应用后端 + 自建前端 | 自建 |
| 拖拽与调整大小 | React-Grid-Layout 等 | 可复用组件，非完整 BI |
| 部门账号与资产访问 | 应用后端 | 自建 |
| 数据范围与语义成员控制 | Cube + 后端身份映射 | 配置与开发 |

可选 ECharts 渲染图表、React-Grid-Layout 提供可拖拽布局。两者分别是可视化库和布局库，不提供完整 BI 产品的用户管理、查询编排或资产权限。[ECharts](https://echarts.apache.org/en/index.html)、[React-Grid-Layout](https://github.com/react-grid-layout/react-grid-layout)

首版应限定指标卡、折线、柱状和明细表；不要把“图表库类型多”变成 Agent 可任意生成所有配置的承诺。

## 5. 多用户、部门与多租户

Cube 支持由 securityContext 驱动的多租户配置。它可以控制数据模型、连接、查询编排和预聚合隔离，但不自动替我们建设面向业务人员的部门管理和看板权限 UI。[多租户](https://docs.cube.dev/embedding/multitenancy)

建议：

1. 后端从登录会话解析用户和部门，拒绝前端或 LLM 直接覆盖身份。
2. 数据访问规则在 Cube/查询底座强制执行；模型元数据发现也按权限裁剪。
3. 资产数据库中每个 chart、dashboard、conversation 都有所属部门及授权关系。
4. 不同部门的缓存上下文和预聚合策略按实际数据范围隔离，不能只改 UI 目录。
5. 对需要不同数据模型/凭据的部门，配置相应编译与编排上下文；若只在共享表按部门过滤，仍需可靠的服务端行级约束。
6. 如开放 SQL API，另验它的身份映射和权限，不能假设 HTTP JWT 配置自动覆盖所有访问协议。[SQL API 鉴权](https://docs.cube.dev/reference/core-data-apis/sql-api/security)

Cube 文档的 access_policy 展示了行级与成员级规则；当前在线文档会随主线更新，落地时需对固定 Core 版本验证对应语法，不能把 Cloud 用户组管理 UI 当免费 Core 能力。[访问策略](https://docs.cube.dev/docs/data-modeling/data-access-policies)

## 6. 技术栈、部署和成本

Cube 包含 Node.js 与 Rust 组件，Trino 是 JVM 查询引擎，Agent 用 Python，自建前端用 React；无需为了运维 Trino 先做 Java 二次开发。

需要应用后端、Cube 服务、Trino、元数据数据库和持久会话；启用预聚合/刷新时还需相应 Cube Store、刷新进程和存储。初期可减少可选部件，但不能把开发环境示例称为生产高可用部署。

软件自托管不代表没有成本：模型调用、服务器、数据建模和 UI 维护仍需投入。由于没有数据量、并发和实测，不给出声称能支持某规模的 CPU/内存数字。

截至调研日，Cube 最新发布页指向 v1.8.6（2026-10-13）。这只是版本观察，不代表本文已验证该版本的整个组合；PoC 必须固定镜像和依赖。[发布记录](https://github.com/cube-js/cube/releases/tag/v1.8.6)

Core 仓库默认 Apache-2.0，部分文件或包为 MIT，具体以相应许可证为准。商业 Cube 平台权益不纳入本方案免费能力。[LICENSE](https://github.com/cube-js/cube/blob/master/LICENSE)

## 7. 优缺点和适用条件

优点：业务语义独立；可供多个应用复用；能完全控制聊天与看板体验；适合把 Agent BI 本身作为长期产品。

缺点：需要建设大量成熟 BI 已有的编辑器、资产权限和交互；部署组件较多；缓存和预聚合引入额外正确性验证；不符合“尽快给内部团队可用”的最短路径。

只有当统一指标 API、多消费端或高度定制 UI 变成明确需求时，才建议优先此方案。

## 8. 最小验证与退出条件

用两个独立数据库完成一项跨源指标；验证相同指标在聊天和看板结果一致；实现一个图表从聊天加入看板并再次打开；两个部门的相同自然语言不能读到对方数据；变更指标版本后能追溯旧看板。

若主要时间耗在编辑器、权限和资产 CRUD，而语义模型的复用收益仍不明确，应退出此路线，采用 [方案二](02-superset-trino-agent.md)。
