# 方案五：Trino＋json-render＋Flint，自建可编辑 AI BI

日期：2026-10-16。状态：根据官方组件能力提出的组合设计，未部署、未完成端到端验证。本文中的应用接口、组件名与 JSON 均为设计示意，不是现成产品 API。

## 1. 方案解决什么问题

用户通过聊天提出分析目标，系统执行真实跨库查询，生成可编辑的图表与看板；用户既能手动调整，也能继续聊天修改。正式看板由自己的应用保存，不依赖 Superset 的图表和布局模型。

适用前提：愿意建设自己的 BI 产品层，希望控制聊天、编辑器与业务应用的体验。若目标主要是尽快供内部团队使用，[方案二](02-superset-trino-agent.md)仍有更多成熟功能可复用。

与 [方案三](03-cube-trino-custom-bi.md) 的区别：首版不建设独立 Cube 指标服务，先发布受控业务视图、指标定义和查询模型；后续出现多应用指标复用需求时再加语义服务。业务口径仍然需要建模。

## 2. 组件分工与已核实依据

| 层 | 建议实现 | 核实情况与边界 |
| --- | --- | --- |
| 跨源计算 | Trino | MySQL connector 官方明确支持多实例和不同系统间查询；性能需按真实源测试 |
| 业务模型 | 少量受控视图＋指标/维度目录 | 本项目建设；配置应能表达粒度与关联约束 |
| Agent 与查询服务 | Python，沿用现有 LangGraph 或类型化工具编排 | 本项目建设；不由 UI 框架承担安全决策 |
| 看板生成与渲染 | React＋json-render | catalog/registry、数据绑定、动作与流式 spec 可复用 |
| 图表编译 | Flint JS，优先固定一个渲染后端 | 生成原生图表配置；不是跨库计算器 |
| 可编辑布局与配置面板 | 自建或复用专门编辑组件 | json-render 不自动提供完整 BI 编辑器 |
| 看板、修订与权限 | PostgreSQL＋应用 API | 自建；保存、发布、冲突检测、ACL 都在这里 |
| 数据上下文 | 首版小目录；Marmot 可选 | 全局目录可见性要与部门需求匹配，不作为硬依赖 |

组件依据：[Trino MySQL](https://trino.io/docs/current/connector/mysql.html)、[json-render](https://json-render.dev/docs)、[Flint](https://github.com/microsoft/flint-chart)。这些链接证明单个组件能力，不能证明组合已经打通。

首版最少新增应用进程可由 Python 后端和 React 静态前端构成；Flint 在前端或已有 Node 构建环境使用，不一定单独运行 MCP。Trino 与资产数据库仍需部署。部署组件数和总资源占用应分别评估。

## 3. 拟议架构

~~~mermaid
flowchart TD
  U[用户：聊天与手动编辑] --> UI[React 看板界面]
  UI --> API[登录身份与资产 API]
  API --> P[分析规划与受控查询服务]
  C[获授权业务目录] --> P
  P --> V[粒度 关联 权限 成本校验]
  V --> T[Trino]
  T --> M[MySQL 订单源]
  T --> R[CRM 数据源]
  T --> E[查询结果与执行证据]
  E --> B[运行时数据绑定]
  P --> S[看板与图表规范]
  S --> J[json-render]
  B --> J
  J --> F[Flint 图表适配器]
  F --> UI
  API --> D[(看板 修订 ACL)]
~~~

所有数据请求经过后端。前端不持有源库密码，模型不能通过 spec 切换执行身份。图中是逻辑责任，不要求每个框独立部署。

## 4. 先定义一个小而完整的 BI 能力集

首版只发布：指标卡、时间趋势、类别比较、分页明细、日期筛选和类别筛选。图表类型多不等于 BI 能力完整；先把刷新、单位、空态、筛选与保存做好。

拟定义组件：

- DashboardGrid：布局和面板引用，处理拖动、尺寸与响应式。
- MetricCard：绑定服务端结果中的单值。
- ChartPanel：持有 chart_ref，负责加载、校验、编译和图表事件。
- DataTable：服务端分页，控制可见列和导出。
- DateFilter / CategoryFilter：更新受控筛选状态。
- Provenance：展示口径、统计时间、新鲜度与数据截断警告。

json-render 的 catalog 用来约束组件与动作；真实实现通过 registry 提供。应用应在服务器再次校验生成内容，不能把模型输出自动视为符合 catalog。[Catalog](https://json-render.dev/docs/catalog)

## 5. 配置分四层，执行结果单独存放

| 对象 | 保存什么 | 避免什么 |
| --- | --- | --- |
| Dataset/Metric 定义 | 可信视图、度量、维度、粒度、时间与关联限制 | 在提示词里再维护一套计算公式 |
| QuerySpec | 指标引用、维度、时间、排序和允许的过滤 | 把任意 SQL/表函数交给前端 |
| ChartSpec | 图表类型、字段绑定、单位、格式、视觉选项 | 把收入数值作为模型随意生成的 props |
| DashboardSpec | 面板引用、布局、筛选目标、联动与修订 | 把用户权限当可修改的页面配置 |

执行后另产生 result_ref 和 ExecutionEvidence，包括结果粒度、字段类型、行数、源延迟、查询时间和已知警告。结果句柄受身份与有效期约束。

示意内部保存格式：

~~~json
{
  "schema_version": 1,
  "base_revision": 4,
  "title": "行业净销售额",
  "queries": {
    "industry_revenue": {
      "dataset_ref": "orders_with_industry_v1",
      "metric_refs": ["net_revenue_v1"],
      "dimensions": ["industry"],
      "filter_refs": ["date_range"]
    }
  },
  "charts": {
    "revenue_by_industry": {
      "query_ref": "industry_revenue",
      "kind": "bar",
      "encoding": {"x": "industry", "y": "net_revenue"}
    }
  },
  "panels": [
    {
      "id": "industry_panel",
      "chart_ref": "revenue_by_industry",
      "layout": {"x": 0, "y": 0, "w": 12, "h": 4}
    }
  ],
  "filters": [
    {"id": "date_range", "type": "date_range", "targets": ["industry_panel"]}
  ]
}
~~~

这不是 json-render 或 Flint 的原生输入。应用适配器将其投影为 UI spec，并在运行时取数据、构造 Flint ChartAssemblyInput。业务资产格式与第三方渲染协议隔开，便于升级库或更换后端。

## 6. 一次分析怎样完成

1. 服务端绑定登录用户和部门，返回可访问业务定义与能力清单。
2. Agent 明确指标、时间与统计粒度，产生 QuerySpec。
3. 查询服务解析白名单定义；检查关联基数、敏感字段、强制部门范围与扫描成本。
4. Trino 执行跨库 SQL；取得结果并与已知总量/约束核对。
5. Agent 按真实字段与有限统计信息选择图表，产生 ChartSpec 和布局。
6. json-render 渐进呈现结构；组件绑定实际结果，Flint 编译图表。
7. 用户手动修改或继续聊天调整，形成同一草稿。
8. 保存/发布时校验完整配置、ACL 与修订，重新打开后按当前用户权限刷新。

数据绑定与 watcher 可用于筛选联动，但应用必须控制请求并发、取消过期请求、防止旧响应覆盖新筛选结果，以及避免状态变化触发循环请求。[Data Binding](https://json-render.dev/docs/data-binding)、[Watchers](https://json-render.dev/docs/watchers)

## 7. Flint 适配要做的事

建议首轮固定 Vega-Lite，以减少交互支持差异；ECharts 可作为第二个对比候选。最终选择需测试中文字体、时区、货币、负值、百分数、长分类名称、空结果与卡片缩放。MCP 适合外部 Agent 调用；自己的网页可直接集成库。

适配器负责：

- 将已授权结果和字段描述转为 ChartAssemblyInput。
- 按当前模板发现支持的图表、编码与交互；不支持就拒绝或明确降级。
- 收集校验和溢出警告；图表截断要显示，不能静默丢类别。
- 检查对已聚合值是否再次聚合；占比、均价、去重人数尤其需要验证。
- 将图表选中事件转为受控的筛选参数，再由后端查询。

Flint API 的 validateChart、模板发现、warnings 与 backend 差异可用于实现这些检查；当前 interaction spec 文档只覆盖其 Vega-Lite 交互表面，跨面板业务联动仍是应用责任。[API](https://github.com/microsoft/flint-chart/blob/main/docs/api-reference.md)、[交互](https://github.com/microsoft/flint-chart/blob/main/docs/interaction-spec.md)

替代候选是 Semiotic：若更看重 React 原生组件、协调视图与渲染诊断，可用它替换 Flint 适配层。不能把 Semiotic 作为 Flint 的已支持编译后端；本次未验证这种集成。[Semiotic](https://github.com/nteract/semiotic)

## 8. 部门隔离必须同时覆盖四个位置

| 位置 | 必须执行的控制 |
| --- | --- |
| 数据发现 | 返回给 Agent 的指标、字段、样例和目录经过授权 |
| 查询执行 | 由后端确定身份，使用 Trino 策略或部门受限数据入口 |
| 资产操作 | 用户只能查看、修改、发布获授权看板；猜测 ID 也不能绕过 |
| 派生结果 | 缓存、会话、预览、下载、异步任务与 result_ref 全部鉴权 |

Trino 支持行过滤、列掩码和访问规则，但身份认证及 impersonation 规则需要配置。可选实现为按部门使用受限凭据或在可信服务中映射登录身份，具体方案要端到端验证。模型不能提交 user/group 字段来决定权限。[Trino 访问控制](https://trino.io/docs/current/security/file-system-access-control.html)

保存看板不保存创建者的永久查询权限。B 部门访问共享看板时应以 B 的权限重新执行；若口径在 B 部门不可用，显示不可访问，不回退复用 A 的缓存。

## 9. 保存与聊天/手动编辑共存

本方案的权威资产是应用数据库中的 DashboardSpec 及其引用定义，区别于方案二以 Superset 原生资产为准。编译后的图表配置是可再生成产物；查询结果是有期限的派生数据。

拟使用 dashboard_id、revision、草稿/发布状态和稳定 panel_id。人工编辑与 Agent 操作经过同一更新 API，提交 base_revision；冲突时返回最新状态并重新合并，避免整页覆盖。

建议 API 提供有领域含义的操作，如移动面板、替换图表字段、添加筛选、更新筛选目标，而不是直接放开全部 JSON 路径。保存需 operation_key 幂等，新增图表失败可恢复。删除面板、修改查询与修改文字的权限分别判断。

流式 UI patch 只是展示过程，不等于已提交业务事务；只有完整、通过校验的草稿才能发布。[SpecStream](https://json-render.dev/docs/streaming)

## 10. 与现有方案的投入比较

| 能力 | Superset＋Trino | 本方案 |
| --- | --- | --- |
| 跨库计算 | Trino | Trino，沿用 |
| 看板编辑和资产管理 | 大部分复用 | 自建 |
| Agent 到图表配置 | 映射 Superset | 映射小型内部规范及 Flint |
| 聊天和产品体验 | 需嵌入/链接和适配 | 自己控制 |
| 指标口径 | 原生 dataset/metric＋目录 | 受控模型＋查询服务 |
| 部门隔离 | Superset 和 Trino 联合验证 | 应用和 Trino 联合验证 |
| 探索式 BI 功能广度 | 已有产品能力较多 | 首版主动限制范围 |
| 库升级责任 | BI API 和工具适配 | UI 协议、编译器、编辑器适配 |

主要节省的是复杂 UI 生成协议和部分图表细节；新增的是一整套可持续维护的 BI 应用层。因此不能仅用代码行数少来判定本方案总成本低。

## 11. 最小 PoC 与决策条件

以下均为待执行计划：

1. 两个独立源、两个部门；人工基准包含一对多退款、重复维度、空客户和比例指标。
2. 一条跨源指标生成 KPI、趋势、行业比较与明细。
3. 日期和行业筛选后数值一致；请求乱序不显示旧结果。
4. 长中文标签和高基数数据产生可见的截断提示；图表数据合计可核对。
5. 保存、重新打开、源更新后刷新；手动编辑后聊天修改保持其余布局。
6. A/B 部门交叉访问目录、猜测资产 ID、结果句柄、缓存与导出均不越权。
7. 断线重试、草稿过期和修订冲突可恢复。

若这些闭环的实现仍比 Superset 适配复杂，而自定义体验没有明确收益，就继续方案二。若内部规范和编辑器形成稳定小范围能力，且产品体验明显更好，本方案可作为长期产品路线。

版本观察：本次 main 包文件中 Flint 为 0.5.1、json-render core 为 0.21.1；它们不是本项目已经锁定或验证兼容的依赖版本。实施时记录 package lock、运行时、后端与浏览器版本。
