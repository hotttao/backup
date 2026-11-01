# 从 anything.md 项目清单得到的 BI 架构启发

调研日期：2026-10-16。范围为官方文档、公开仓库、接口与部分源码核验；未部署这些组件，未完成性能或部门隔离实测。清单是发现入口，能力判断以本次读取的一手资料为准。

新增组合方案单独保存：

- [方案五：Trino＋json-render＋Flint，自建可编辑 BI](05-trino-json-render-flint.md)。
- [方案六：DuckDB＋受限查询服务＋生成式看板](06-duckdb-generative-bi.md)。

## 1. 最影响决策的结论

这份清单带来了两个实质变化：**自建展示层有了更多可复用构件；跨库计算也可以评估 DuckDB 这一较轻的选项。** 但没有一个被核查的项目直接补齐“跨库查询＋部门隔离＋聊天生成＋持久化可编辑看板”全链路。

| 项目 | 核查后的定位 | 本次建议 |
| --- | --- | --- |
| Flint | 图表语义描述、布局决策与多后端编译 | 自建展示层的重点候选；接 Superset 时优先借鉴设计 |
| json-render | 受约束的 UI 描述、数据绑定、动作和流式渲染 | 自建看板的重点候选；不是 BI 查询/权限服务 |
| Marmot | 数据目录、术语、血缘和 Agent 上下文 | 元数据规模增长时采用；开源版细粒度可见性有明确缺口 |
| Tambo | 生成式与可交互 React 组件，带 Agent 后端 | 借鉴双向编辑；托管关停后不作为新项目默认核心 |
| DuckDB | 支持真实跨数据库 JOIN 的嵌入式分析引擎 | 新增低并发候选，应用须承担服务化与隔离 |
| Perses | 开放看板模型、编辑与资源管理，主要面向可观测性 | 参考模型或专项试验；本次未验证可直接连接 Trino |
| Semiotic | React 可视化、推荐、数值诊断、渲染证据 | 与 Flint 做渲染层二选一验证，不能仅当装饰图表库 |
| Swapy | 布局元素拖拽互换 | 局部交互构件；不能据此认定已有完整网格编辑器 |

这些是针对本项目的取舍判断，不是项目方宣称的组合兼容性。

## 2. Flint：把展示语义与渲染细节分开

### 核实的能力

Flint 接受数据、字段语义类型与 chart spec，编译为 Vega-Lite、ECharts、Chart.js、Plotly 或 Excel 图表产物。仓库中 JS 包版本为 0.5.1、MIT；Python 端仍标为源码预览，不能按成熟 PyPI 包规划集成。[仓库](https://github.com/microsoft/flint-chart)、[包定义](https://github.com/microsoft/flint-chart/blob/main/packages/flint-js/package.json)

MCP 不只有静态绘图：有图表类型发现、校验、编译、渲染与交互视图工具。交互视图通过支持 MCP Apps 的宿主展示 Vega-Lite SVG 与定制面板。自行开发的聊天网页仍需接入宿主能力或直接使用 JS 库，添加 MCP 服务并不会自动得到前端。[MCP 说明](https://github.com/microsoft/flint-chart/blob/main/packages/flint-mcp/README.md)

### 最有价值的启发

1. 让 Agent 选择“比较行业净收入，用柱状图”，由代码决定轴、标签密度与布局。
2. 保留可编辑的高层 spec；同一份定义可重新编译，无须把最终图片当资产。
3. 将图表能力清单暴露为发现接口，按当前后端核查支持项。

### 三个实际集成问题

**第一，ECharts option 不等于 Superset 原生 chart。** Superset 6.1.0 的生成入口需要 dataset、指标、维度、查询配置，再保存原生资产。Flint 编译的是渲染层结果，缺少这些 BI 资产语义；两边都使用 ECharts 不能证明直接互通。若要求继续在 Superset Explore 编辑，优先生成 Superset 配置；若接 Flint，需要显式映射或自定义插件。[Superset 请求模型](https://github.com/apache/superset/blob/6.1.0/superset/mcp_service/chart/schemas.py)、[生成实现](https://github.com/apache/superset/blob/6.1.0/superset/mcp_service/chart/tool/generate_chart.py)

**第二，多后端并非功能完全相同。** ECharts 有自己的模板集合；交互文档明确当前交互表面面向 Vega-Lite，assemble 调用本身忽略 interaction spec。README 与 API 注释对主题支持范围还存在更新不一致，因此需要固定版本逐项验收，不能承诺所有后端同样支持主题、刷选与编辑。[ECharts 参考](https://github.com/microsoft/flint-chart/blob/main/docs/reference-echarts.md)、[交互说明](https://github.com/microsoft/flint-chart/blob/main/docs/interaction-spec.md)

**第三，自动美化可能改变可见数据。** API 说明包含溢出处理：按模板排序、聚合或截断类别，并给出 warnings。BI 场景需要在界面显示“仅展示 Top N”，记录被省略项，核对统计总量；不能因为图已渲染就认定结果完整。图表端对比例、去重人数、已聚合结果的二次计算也必须受控。[API 的 overflow、validation 与 semantic_types](https://github.com/microsoft/flint-chart/blob/main/docs/api-reference.md)

结论：对自建前端很有价值；对 Superset 主线，先吸收“高层规范＋能力发现＋确定性编译”的做法，避免强行引入第二套渲染和保存体系。

## 3. json-render：看板生成可以做成受限组件编排

### 核实的能力

它通过 catalog 定义允许的组件和动作，用 registry 绑定实际组件；模型输出 spec，由前端渲染。当前 core 源码包版本为 0.21.1、Apache-2.0，属于快速演进的接口，不能把 latest 文档直接视为任意已安装版本能力。[介绍](https://json-render.dev/docs)、[包定义](https://github.com/vercel-labs/json-render/blob/main/packages/core/package.json)

数据绑定支持运行时状态与输入双向绑定；watchers 能在状态变化后触发动作。因此日期、行业筛选与图表刷新可以通过已有构件连接，但查询、权限和请求取消逻辑要由自己的 action handler 实现。[Data Binding](https://json-render.dev/docs/data-binding)、[Watchers](https://json-render.dev/docs/watchers)

### 对本项目的具体用法

只发布少量组件，例如 DashboardGrid、MetricCard、ChartPanel、DataTable、DateFilter、CategoryFilter、Provenance。允许动作只包括设置筛选、刷新授权查询、保存草稿和打开受控明细。组件和动作是本项目拟设计，项目不会自动提供这些 BI 能力。

模型只引用 query_ref，不允许在 KPI 的 props 中自由编造金额。服务器将真实查询结果注入运行时 state，再由组件绑定展示。业务口径保留在已发布指标中，UI catalog 不再复制一份计算公式。

### 必须补上的工程边界

- UI Schema 校验只能证明结构，不能证明业务正确或有权查询。
- 隐藏组件仅影响显示；每次 action、查询、保存和导出仍要检查当前身份。
- 不注册任意 SQL 执行、任意 URL 请求、任意代码运行之类通用动作。
- spec 本身不提供完整的看板版本、资产 ACL、网格拖拽、发布回滚或多人编辑冲突处理。

SpecStream 用 JSONL patch 渐进构建 UI，适合先出现布局、再填结果；流式半成品不直接发布，执行动作需经过应用门控。可复用其解析与渲染，无需把 Agent 编排器也整体更换。[Catalog](https://json-render.dev/docs/catalog)、[Streaming](https://json-render.dev/docs/streaming)、[Custom Schema](https://json-render.dev/docs/custom-schema)

结论：它让自建展示层更可行，但省下的主要是生成与渲染协议工作，完整 BI 产品能力仍要逐项建设。

## 4. Marmot：先建设可信上下文，再考虑复杂语义编译

Marmot 使用 Go 与 PostgreSQL，组织资产、术语、所有者和血缘。默认目录定位是元数据；另有实验性的实时表样本预览功能，因此不能笼统承诺任何配置下都不访问业务行。[介绍](https://marmotdata.io/docs/introduction/)、[Table Preview](https://marmotdata.io/docs/Configure/table-preview/)

MCP 文档列出 discover_data、find_ownership、lookup_term。它们适合先定位数据资产和业务词汇，再让查询工具执行。工具使用调用者或服务账号身份，但身份权限的粒度仍取决于具体版本与授权。[MCP](https://marmotdata.io/docs/MCP/)

### 对部门隔离的关键发现

官方权限文档明确：开源版角色作用于整个实例，assets:view 可读取全目录；Team 表达所有权，不自动限制可见资产。单资源授权与继承属于 Cloud/Enterprise。**不能用“有 RBAC、有 Team”推导“开源版能按部门隐藏表”。**[访问控制](https://marmotdata.io/docs/Configure/access-control/)

因此首版选择可以是：

1. 将 Marmot 仅用于管理员维护的、允许全员发现的公共元数据目录；敏感部门元数据不进入该实例。
2. 需要严格分区时使用独立实例并在采集源头限制内容，或评估其具备资源级授权的版本。
3. 暂不引入 Marmot，先在自己的服务维护少量经授权的数据集目录。后续接入时再统一资产标识。

若自建服务代理全局目录，必须在返回给模型前限制全部读取通路，不能只依赖搜索条件；直接 ID、血缘邻居和术语关联都可能泄露。代理正确性本身也成为需要承担的工程工作。

### 它与语义层的关系

数据目录回答“净销售额是什么、来源在哪、谁维护”；指标编译器回答“给定时间和维度，生成哪条正确 SQL”。Marmot 能保存相关定义，但本次没有找到它负责完整指标代数、关联基数和查询生成的证据。

启发是把上下文做成可治理资产：指标 ID、可信定义引用、粒度、主键/基数、时间语义、来源、维护人、校验状态与更新时间。少量资产先用本地配置或表维护，避免启动时引入大目录平台。

## 5. Tambo：双向编辑思路有用，生命周期改变选型

官方在 2026-10-01 公告：Cloud 停止新注册，2026-10-31 结束托管 API，2026-11-30 删除用户数据；开源自部署可继续，使用者需要自行维护。不能把它描述成仓库已关闭，也不应再把托管服务作为新项目依赖。[关停公告](https://tambo.co/blog/posts/tambo-is-shutting-down)

它最值得借鉴的设计是：预先放在界面的组件也可向 Agent 提供当前 props，并允许自然语言更新。同一个图表既能手动修改，也能被聊天调整。[Interactable Components](https://docs.tambo.co/concepts/generative-interfaces/interactable-components)

本项目应让手动编辑器与 Agent 共享同一份版本化看板状态：先读最新版本，再提交受限 patch，并检测冲突。组件 props 的双向同步不能自动替代数据库持久化、部门授权与协作控制。

自托管本身包含 Next.js Web、NestJS API 和 PostgreSQL 等服务。若已有 Python Agent 编排，再引入其完整 Agent 后端会增加身份、会话和工具执行责任的重叠。[自托管说明](https://github.com/tambo-ai/tambo/blob/main/SELF-HOSTING.md)

结论：借鉴产品交互；新方案采用更薄的 UI 层，保留 Agent 执行与权限控制的单一入口。

## 6. DuckDB：确实能跨库，值得独立验证

此前只从清单中的 Local UI 无法判断跨库能力；本次官方文档给出了同时 ATTACH MySQL、Postgres、SQLite 并直接 JOIN 的 SQL 和执行计划。它符合“同一条查询跨不同数据库”这一技术条件。[官方跨库示例](https://duckdb.org/2024/01/26/multi-database-support-in-duckdb)

MySQL 扩展支持查询时读取与 READ_ONLY attach，也提醒大表反复扫描时可以复制到本地分析。它还支持写操作与远端执行函数，因此给 Agent 一条 SQL 入口不天然只读。[MySQL 扩展](https://duckdb.org/docs/current/core_extensions/mysql)

新增方案六适用于小范围、有限并发、数据量可测的内部使用；查询 Worker 负责限额与隔离，源账号/受限视图负责限制数据范围。不把“嵌入式”解读成“所有查询都很省内存”，也不把部署组件少理解为权限建设更少。

本次读取 current 的嵌入式文档，并看到 preview 另有 CONNECT/server 方向；方案六不依赖开发预览接口，不作“DuckDB 永远不能做服务端”的断言。[嵌入安全](https://duckdb.org/docs/current/operations_manual/securing_duckdb/overview)

## 7. Perses 与 Semiotic：两种不同的复用方向

### Perses：资产模型和可视化编辑

Perses 有开放看板规范、静态校验、API、项目级资源和 RBAC，且可以把 React 面板或看板组件嵌进自己的 UI。这比仅用一个图表库更接近完整展示底座。[项目主页](https://perses.dev/)、[Authorization](https://perses.dev/perses/docs/concepts/authorization/)

但这次官方插件清单主要是可观测性数据源，未验证可直接使用的 Trino 查询链路。改造需要数据源/查询插件、业务表格与筛选语义映射、查询网关身份；项目 ACL 也不自动转成数据行策略。嵌入说明还提示 React 19 未支持，实际包版本兼容必须单独核对。[插件](https://perses.dev/perses/docs/concepts/plugin/)、[嵌入文档](https://perses.dev/perses/docs/embedding-panels/)

值得直接借鉴的是临时看板：它是带 TTL 的真实看板，可分享后自动清理。可以把 Agent 草稿做成有生命周期的资产，再由用户发布正式版本；TTL 只清理资产，访问仍要鉴权。[Ephemeral Dashboard](https://perses.dev/perses/docs/concepts/ephemeral-dashboard/)

### Semiotic：生成之后还要检查是否画对

本次 main README 已描述图表/看板推荐、配置诊断、auditData 数值检查和渲染证据（如实际数据标记数、坐标域、空图状态）。这比原清单中“流式 React 图表库”的定位更丰富，但这些是当前源码文档所述，未验证指定 npm 包与运行效果。[官方仓库](https://github.com/nteract/semiotic)

启发是增加三个独立检查：Schema 合法、数值合理、渲染后确实有数据标记。它们都不能取代业务 SQL 对账。若选择 Semiotic，就以其 React 组件作为渲染层；若选择 Flint，就使用编译后端。首版不叠加两套图表协议。

Swapy 适合位置互换；可变宽高、网格碰撞、响应式布局与持久化要另行实现或另选组件。[官方仓库](https://github.com/TahaSh/swapy)

## 8. 对原有工作流的改进

建议把之前的 ChartSpec/DashboardSpec 进一步拆开，避免出现一个无边界的大 JSON：

| 对象 | 核心内容 | 权威来源 |
| --- | --- | --- |
| BusinessContext | 指标定义引用、关联、粒度、时间语义 | 已发布模型/视图与受控目录 |
| QuerySpec | 指标/维度引用、筛选、结果粒度 | 查询服务校验后的计划 |
| ChartSpec | 视觉字段、图表类型、单位、格式 | 当前展示资产 |
| DashboardSpec | 面板、布局、筛选作用域、交互 | 看板资产 |
| ExecutionEvidence | 查询时间、来源版本、行数、警告、渲染证据 | 实际执行产生 |

这些是本项目设计建议，不是五个新服务。可先全部放在一个后端中，json-render/Flint 是其中的可选实现。

改进后的闭环：

1. 当前身份发现获授权的业务定义与数据。
2. 生成受控 QuerySpec，检查关联粒度后执行跨库查询。
3. 保存受权限约束的 result_ref，记录字段、单位、时间与总量。
4. 模型生成 ChartSpec 与 DashboardSpec，展示值来自实际结果绑定。
5. 编译、数值检查与渲染检查，显式展示截断及不支持项。
6. 形成可手动编辑的草稿；用户保存后发布版本。
7. 后续手动和聊天修改同一资产，通过 patch 与版本检查维护。

其中 result_ref 是服务端授权句柄，不是公开 URL；用户切换部门、权限撤销和缓存命中时都要重新判断访问。

## 9. 本轮建议如何影响最终选择

**近期交付内部 BI**：仍优先方案二 Superset＋Trino，复用其看板编辑与资产能力。将本轮得到的上下文目录、图表校验和双向修改设计应用进去；不为了使用新库而换掉原生看板。

**希望积累自己可控的 AI BI 产品能力**：方案五值得进入正式候选。它与方案三的差别是首版不引入 Cube，以受控查询模型和视图起步，把开发投入集中到聊天与可编辑看板。

**希望进一步降低查询基础设施规模，且能接受限定场景**：方案六值得先做引擎对比。跨库 JOIN 已有官方依据，性能、并发和部门隔离必须实测后再替代 Trino。

建议先比较两个独立选择：展示层“Superset vs 自建”，计算层“Trino vs DuckDB”。先固定其中一层测试另一层，避免同时改两层导致结果难以归因。

本次没有证据可以给出固定开发天数、最小内存或生产吞吐承诺。是否选择新方案，以独立方案文件中的最小验收闭环为准。
