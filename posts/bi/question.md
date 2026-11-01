
# BI 调研

我现在希望做一个开源 BI 项目的调研。支持自然语言形式生成图表,可以把聊天结果中的生成的图表一键添加到自定义的仪表盘, 有简单的语言配置层,支持mysql等常见数据源，支持多个数据源/多用户

WrenAI旧版试过每个数据源太重,免费变不支持多个数据源 metabase 勉强可用,java不太熟

## 方向
以我自己的背景，我认为有两个调研的方向，你可以补充:
1. 完整的 BI 项目，BI 自带 Agent 或者 支持自定义 Agent，支持自然语言生成图表、仪表盘
2. 组合多个项目搭建 BI。底层是传统 BI，中间是语义+编译层，顶层是 Agent 层。BI 定义好支持的能力。Agent 根据用语用途，先生成语义层，语义层做一层编译，在转换成 BI 支持的底层功能。

请你就这两个方向，进行调研。并给我可选的方案。我对 BI 不是非常了解，不太清楚BI是否也存在类似 workflow 这样，明显的语义层，这个需要你评估，语义+编译中间层存在的必要性。

针对 BI 设计的 Agent，市面上应该有很多，这个是你调研的一个重点。如果没有合适的，你需要结合我下面设计的典型工作流，调研选择什么样的 Agent 框架去实现一个。

你进入具体方案的调研之前，需要先根据搜索到的信息，跟我对其调研的方向。我两对其后，再进行具体方案的调研。

## 典型工作流
在最终 BI 系统统，为了更好的完成用户需求，我个人认为需要包含的如下典型的工作流:
1. 先定义 BI 系统支持哪些图表，这些图表适合表达什么样的信息
2. Agent 首先需要分析用户意图，根据用户意图拆分各自独立的展示模块，并明确各个展示模块之间的数据关系、跳转关系
3. 为每个展示模块，选择合适的图表类型
4. 根绝模块之间的数据和依赖关系，每个模块的图表，组织成完整的仪表盘。

这个工作流是我目前根据个人经验整理的，你可以补充。

## 目标
调研过程你需要完成以下目标:
1. 按照我的需求，给我几个可选的方案
2. 每个方案，一个独立的 markdown 文件，保存在当前目录下，详细说明每个方案的架构、支持的数据源、使用复杂度、是否具有现成的 UI、是否支持多租户。
3. 在当前文件中对比每个方案的优缺点，并选择一个最优方案
4. 基于最优方案，优化典型工作流，并输出一个优化后的典型工作流


---

# 调研结果与方案对比（2026-10-15）

## 一、已对齐的需求

1. 保留三条调研路线：现成 ChatBI、成熟 BI＋轻量 Agent 适配、独立业务语义层＋展示端。
2. 多数据源明确包括**一次查询跨不同数据库实例/类型关联**，例如 MySQL 订单与 PostgreSQL CRM；不仅是切换连接或同屏摆放不同源图表。
3. 首先供内部团队使用，需要部门间的数据和资产隔离；不要求客户级计费。
4. 核心体验是自然语言生成图表，聊天图表一键加入自定义且可继续编辑的仪表盘。
5. 将“简单的语言配置层”落实为轻量业务定义和结构化展示配置，优先复用产品原生模型；不先创造复杂 DSL。
6. 开源自托管优先，明确区分商业插件；“不需要费用计费”不等于软件采购预算已被规定为零，本文不作该假设。

研究基于官方文档、发布记录及部分源码。**本次没有安装候选系统，没有完成端到端 PoC 或性能测试；推荐是架构与功能适配判断，不是实测性能排名。** 未知与组合待验能力单列。

## 二、结论

**优先采用方案二：Superset 6.1.0＋Trino＋官方 MCP＋Python Agent＋轻量布局/联动适配。首版不额外部署 Cube/dbt Semantic Layer。**

原因是它同时有明确的跨源查询底座、可复用的完整 BI UI、稳定版官方 Agent 工具，以及开源权限构件。需要开发的聊天入口、配置校验、布局/筛选适配和身份传递均可以明确界定，而不是从零建设 BI。

但它不属于零开发产品：6.1.0 官方 MCP 生成看板是简单自动布局，完整筛选和联动需补 REST 适配，部门身份传递也必须实测。不能把 Next 文档新增工具当作稳定版能力。[稳定版本](https://github.com/apache/superset/releases/tag/6.1.0)、[6.1.0 看板生成源码](https://raw.githubusercontent.com/apache/superset/6.1.0/superset/mcp_service/dashboard/tool/generate_dashboard.py)

## 三、四个独立方案

| 方案 | 对应路线 | 最有价值的部分 | 主要代价与缺口 | 本次建议 |
| --- | --- | --- | --- | --- |
| [一：SQLBot＋Doris](01-sqlbot-doris.md) | 现成 ChatBI＋统一查询底座 | 聊天出图、加入看板及编辑有现成产品体验 | 跨源视图组合待验；免费行列权限边界未核实；Doris 不轻 | 已有分析仓库或先验证交互时考虑 |
| [二：Superset＋Trino＋Agent](02-superset-trino-agent.md) | 成熟 BI＋轻量适配 | 原生可编辑资产、官方 MCP、明确的跨源执行分工 | 聊天入口、布局/联动和身份映射需开发 | **推荐** |
| [三：Cube Core＋Trino＋自建 UI](03-cube-trino-custom-bi.md) | 独立业务语义层 | 指标 API 独立，适合多消费端和高度定制体验 | 聊天、看板编辑器、资产权限等大量自建 | 后续产品化或多端统一指标时考虑 |
| [四：Lightdash＋Trino](04-lightdash-trino.md) | 现成平台，有商业条件 | Node.js 技术栈、指标模型与 BI UI | 自托管内置 AI/MCP 属企业功能，需明确授权 | 接受企业授权时重新比较 |

### 按硬需求比较

“需开发/配置”不等于已完成验证；“有条件”不能算完整满足。

| 维度 | SQLBot＋Doris | Superset＋Trino＋Agent | Cube Core＋Trino＋自建 UI | Lightdash＋Trino |
| --- | --- | --- | --- | --- |
| MySQL 与常见数据源 | SQLBot 直接支持多种源；本方案以 Doris 统一 | 通过 Trino catalogs，也可保留 BI 直连 | Cube 支持多种源，本方案以 Trino 统一 | MySQL 走 Trino，不认定有原生适配器 |
| 单 SQL 跨异构源 JOIN | Doris 支持，SQLBot 视图链路待验 | Trino 支持，部署与建模待验 | Trino 支持，再由 Cube 建模 | Trino 支持，模型发现链路待验 |
| 自然语言图表 | 自带 | 由 Agent＋官方工具提供 | 自建 Agent 与展示 | 内置 AI 属商业授权范围 |
| 聊天图表加入看板 | 官方有交互说明 | 工具可保存/追加，需聊天按钮 | 自行建设保存动作 | 对应套餐和版本实测 |
| 可编辑仪表盘 UI | 有 | 有 | Core 不带完整产品 UI | 有 |
| 简单业务配置 | 术语、SQL 示例、业务视图 | 业务目录、数据集指标、轻量 DTO | Cube 原生模型＋展示 DTO | Lightdash YAML/dbt 模型 |
| 部门行/列隔离 | 有文档，xpack 授权边界待核实；需底层受限账号兜底 | RBAC/RLS＋Trino 策略；需身份配置 | Core 有隔离构件；账号、资产 ACL 自建 | 用户属性和权限规则；套餐及原始 SQL 通路另验 |
| 严格物理多租户 | 不作承诺 | 默认不是 | 可设计，非开箱即用 | 不作免费版承诺 |
| 自动规划完整看板 | 需验证/扩展 | 业务规划＋布局适配 | 自建 | 套餐与能力另验 |
| 使用/开发复杂度 | 基础交互低，完整跨源与隔离中高 | 中高 | 高 | 有授权时中等，免费补齐时中高 |
| 计费模块 | 不建设 | 不建设 | 不建设 | 不建设；产品授权费用是另一问题 |

依据：各独立方案包含能力对应的官方原文和源码链接。此表不把“安装多个连接器”视为跨源 JOIN，也不把“导出报告”视为可维护 BI 看板。

### 最影响取舍的事实

- SQLBot 官方有聊天图表入仪表板能力，但数据源列表没有 Trino/Presto，单次问数选择一个数据源。其行列权限源码依赖 xpack，因此免费版是否满足部门隔离仍需验证。[数据源](https://dataease.cn/sqlbot/v1/user_manual/datasource_description.html)、[问数](https://dataease.cn/sqlbot/v1/user_manual/smart_question_description.html)、[权限源码](https://raw.githubusercontent.com/dataease/SQLBot/refs/heads/main/backend/apps/datasource/crud/permission.py)
- Trino MySQL connector 明确支持不同实例及不同系统之间 JOIN；跨 catalog 关联的性能仍受源库扫描、网络和中间结果影响。[MySQL connector](https://trino.io/docs/current/connector/mysql.html)、[下推边界](https://trino.io/docs/current/optimizer/pushdown.html)
- Cube Core 是开源语义基础，完整商业 Cube 的 Agent 与产品 UI 不能自动算作 Core 自带。[产品区分](https://cube.dev/blog/cube-core-and-cube)
- Lightdash 自托管文档将 AI agents 与 MCP 列为企业功能，不能只看公开仓库标题就推断全部免费。[企业功能](https://docs.lightdash.com/self-host/enterprise-features)

## 四、为何推荐方案二

**相对方案一**：SQLBot 的现成交互更好，但异构关联底座、免费权限和自动看板编排都需要额外核验。若最终仍要新增大量适配，不如先复用 Superset 的稳定 MCP 和资产 API。

**相对方案三**：独立语义层很有价值，但当前首先服务内部团队，尚未出现多个前端统一消费指标的强需求。先建设整套看板编辑、资产权限和用户系统，投入与当前目标不匹配。

**相对方案四**：Lightdash 的 Node.js 技术栈贴近你的背景，但不必为了语言熟悉度忽视商业 Agent 边界。若接受企业授权并验证其完整链路，值得重新按总成本比较；本次开源优先选择 Superset。

该推荐不是认为 Trino 最轻，也不是承诺 Superset 权限默认安全。它是在完整需求下，对复用程度、功能边界与新增工作量的综合判断。

## 五、语义＋编译中间层是否必要

**需要结构化契约与校验，不一定需要独立语义服务。**

三种对象分别管理：

| 对象 | 内容 | 首版实现 |
| --- | --- | --- |
| 业务定义 | 指标口径、维度、主键、关系和时间 | 业务视图/受控 dataset＋原生指标与目录 |
| 分析请求 | 选哪些指标、维度、筛选和粒度 | 类型化请求，引用已发布定义 |
| 展示配置 | 图表、布局、筛选作用域、交互和跳转 | 小型 DashboardSpec＋适配器 |

业务语义层确实存在，MetricFlow/Cube 都是代表；但其语义模型不等于页面工作流或仪表盘布局。[MetricFlow](https://docs.getdbt.com/docs/build/build-metrics-intro)、[Cube 模型](https://docs.cube.dev/reference/data-modeling/cube)

Agent 优先使用已经批准的业务定义，不每次重新“创造销售额”。适配器负责把合法的分析/展示配置转成 BI 支持的原生功能。首版作为 Agent 服务中的模块即可。

当多个应用复用指标、口径重复维护、复杂指标组合和独立缓存需求明确时，再升级独立语义层。专项说明及 Agent 框架对比见 [agent-semantic-research.md](agent-semantic-research.md)。

## 六、BI Agent 的调研结论

优先复用现成数据工具，不从零实现所有 BI 操作。SQLBot 适合快速提供现成问数；Superset 官方 MCP 适合作为本次推荐方案的工具底座。

自建规划器优先评估 LangGraph，因任务包含模块拆解、并行查询、校验、受控修复与多轮修改；Pydantic AI 是偏类型化工具的备选。DB-GPT 适合作为完整数据 Agent 平台参考，不能仅凭能生成图表/报告，就认定满足可编辑共享看板和部门隔离。[LangGraph](https://docs.langchain.com/oss/python/langgraph/overview)、[Pydantic AI](https://pydantic.dev/docs/ai/overview/)、[DB-GPT](https://github.com/eosphoros-ai/DB-GPT)

另外，WrenAI Classic 已转为历史产品分支，当前 main 是不同的组件形态。2026-10-16 源码复核发现 Classic 后续仍有安全依赖补丁，因此不再笼统表述为完全没有安全修复；新版应作为语义/查询组件重新评估，详见 [WrenAI 独立分析](07-wrenai-analysis.md)。Vanna 主仓库已归档。[WrenAI](https://github.com/Canner/WrenAI)、[Vanna](https://github.com/vanna-ai/vanna)

## 七、优化后的典型工作流

1. **管理员准备能力与权限**：接入数据源，定义图表能力，发布业务指标和部门范围。
2. **绑定身份并发现数据**：只提供当前用户可访问的目录、数据集、字段和业务定义。
3. **明确分析目标与口径**：确定时间、单位、粒度；只澄清影响结果的歧义。
4. **拆分独立分析模块**：明确每个模块回答的问题，并区分计算依赖、筛选联动和页面跳转。
5. **生成并校验跨源查询计划**：检查关联基数、聚合粒度、权限、源延迟及查询成本。
6. **执行并核对真实结果**：独立模块受限并行；验证重复放大、空值和合计。
7. **选择图表并组织看板**：基于数据类型、行数和用户目标生成图表、布局、筛选与交互。
8. **预览并一键保存**：保存可重新查询、可编辑的原生资产，加入指定看板。
9. **读回并验证完整链路**：核对布局、筛选、刷新及部门访问；保存失败可恢复且重试不重复。
10. **支持持续修改**：读取最新原生状态，按差异更新，保留手工编辑及口径版本。

图表支持范围、状态流程图、内部配置示例和详细验收计划见 [workflow.md](workflow.md)。

## 八、建议首先验证的最小闭环

两个独立数据库＋两个部门账号，先人工跨源查询，再接 Agent：

**一个正确的跨源指标 → 聊天出图 → 加入可编辑看板 → 重新打开与刷新 → 两部门访问隔离 → 聊天再次修改。**

重点未决项是身份从聊天到 Superset 再到 Trino 的传递、RLS 在不同查询路径上的覆盖、布局/筛选适配以及大表关联成本。它们是实施 PoC 的首要验收项，不是本次已经通过的测试。

如果跨源性能不足，先评估副本、汇总或同步仓库，而不是堆更复杂的 Agent；如果 SQLBot 在实际版本中很快验证通过跨源视图和部门边界，也可优先使用现成产品缩短交付。

## 九、阅读顺序

当前准备动手时，先看 [08：从哪里开始与最小原型](08-first-bi-prototype.md)。它把下面的架构调研收敛为“手工 BI→跨库→部门隔离→Agent”的单条验证路径。

1. 本文件：需求、比较与推荐。
2. [方案二](02-superset-trino-agent.md)：推荐架构与版本/权限细节。
3. [优化工作流](workflow.md)：产品流程与 PoC 验收。
4. [Agent 与语义层专项调研](agent-semantic-research.md)：选型依据。
5. 其他方案：[SQLBot＋Doris](01-sqlbot-doris.md)、[Cube Core＋Trino](03-cube-trino-custom-bi.md)、[Lightdash＋Trino](04-lightdash-trino.md)。

## 十、项目清单补充调研（2026-10-16）

根据 `../tool/anything.md` 中的项目进一步核查，新增两个候选组合，独立保存，不替换前述方案：

- [项目清单专项调研与架构启发](anything-projects-bi-research.md)：Flint、json-render、Marmot、Tambo、DuckDB、Perses 与 Semiotic 的能力及边界。
- [方案五：Trino＋json-render＋Flint](05-trino-json-render-flint.md)：自建可编辑 BI 前端，首版不依赖独立 Cube 服务。
- [方案六：DuckDB＋受限查询服务＋生成式看板](06-duckdb-generative-bi.md)：真实跨库 JOIN 的较轻计算候选，应用承担服务化与隔离。

本轮使自建展示层更值得评估，但没有发现可直接替代完整 BI 产品的单个组件。近期内部交付仍优先方案二；重视自有产品体验时比较方案五；数据规模和并发有限时测试方案六。两个新方案均为研究设计，尚未部署验收。

影响选择的新事实：Marmot 开源版资产权限覆盖整个实例，不能直接按部门隐藏部分目录；Tambo Cloud 已公告在 2026-10-31 结束托管服务，开源自部署仍可继续。[Marmot 权限](https://marmotdata.io/docs/Configure/access-control/)、[Tambo 公告](https://tambo.co/blog/posts/tambo-is-shutting-down)

## 十一、源码对照复核（2026-10-16）

已将 WrenAI 新旧版、Metabase、Lightdash、SQLBot 的源码快照下载到系统 tmp 并定向阅读：

- [07：WrenAI 独立分析](07-wrenai-analysis.md)：直接核实旧版单 project/单 dashboard、默认部署部件、新版多 profile、MDL/MCP/权限原语，以及官网与源码的表述差异。
- [07：BI 源码实现比较](07-bi-source-comparison.md)：比较查询中间表示、资产持久化、增量编辑、结果组合与权限生命周期，列出对自建方案的修改建议。

新的取舍：Metabase 不应只因 JVM/Java 不熟而排除，可优先评估原生 AI 或外部 Python/TypeScript API 集成；Lightdash 的结果 JOIN 有可借鉴实现，但额外连接仍有商业门控；Wren 新版可作为方案五的可选语义模块。完整部署与业务验收仍未执行，不据源码存在就承诺组合可用。
