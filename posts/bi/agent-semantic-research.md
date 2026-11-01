# BI Agent、语义层与配置编译层调研

调研日期：2026-10-15。用途：内部团队的自然语言分析、可编辑仪表盘、异构数据库关联查询和部门隔离。

本文是官方资料与部分源码核实后的架构评估，没有部署候选项目，没有测得准确率、延迟或并发容量。“建议”“拟设计”是工程判断；“待验证”不能当成产品承诺。

## 1. 先区分五类能力

| 能力 | 负责的问题 | 是否能替代其他层 |
| --- | --- | --- |
| 查询引擎 | 如何读取多个数据库并执行关联、聚合 | 不能决定业务口径和图表布局 |
| 业务语义层 | 销售额是什么、按哪个时间统计、表之间如何关联 | 不能自动提供仪表盘编辑器 |
| Agent 编排 | 如何理解目标、发现数据、选择工具、修复失败 | 不能替代数据权限检查 |
| 展示配置 | 图表字段、布局、筛选、联动、明细跳转 | 不能让数据库自动具备跨源 JOIN |
| BI 资产与权限 | 保存、编辑、共享、版本以及谁可以查看 | 不等于严格的物理多租户隔离 |

你的需求在五类上都有要求。只列“支持 MySQL、支持 Agent、支持图表”会漏掉关键集成问题。

## 2. 现成 BI / 数据 Agent 的筛选结果

| 项目或工具 | 可以复用的部分 | 缺口或边界 | 建议 |
| --- | --- | --- | --- |
| SQLBot | 聊天出图、问数结果加入仪表板、术语与 SQL 示例、工作空间 | 官方列表无 Trino；单次问数选一个数据源；看板自动编排需另验 | 现成产品路线重点候选 |
| Superset 官方 MCP | 把 BI 资产和查询作为 Agent 工具，生成图表与看板 | MCP 是工具服务，仍需客户端与业务编排；稳定版与 Next 范围不同 | 组合路线优先复用 |
| DB-GPT | 数据分析 Agent、SQL/Python、RAG、工作流 | 生成报告/看板不等于已有成熟 BI 的可编辑资产与部门权限闭环 | 评估 Agent 能力，不默认替代成熟 BI |
| Lightdash | 指标定义、BI 资产、代码化管理 | 自托管文档将 AI agents、MCP 列入企业功能 | 当前条件下降级候选 |
| Rill | 指标视图与上下文驱动分析 | AI Chat 文档描述的是 Rill Cloud，不能认定免费自托管同等支持 | 参考体验 |
| WrenAI | MDL 业务定义、上下文、查询规划 | 当前 main 与旧 Docker ChatBI 是不同形态，旧版属历史分支，持续维护承诺有限 | 不沿用旧版部署 |
| Vanna | Text-to-SQL、聊天图表实现参考 | 官方主仓库已归档；完整仪表盘另需核实/建设 | 不作为新项目核心依赖首选 |
| superset-ai 第三方项目 | 作者提供 LangGraph + REST 工具，覆盖看板、筛选和图表操作 | 小型第三方实现；用户会话、版本兼容与身份隔离未经本次实测 | 阅读适配代码，不直接承诺生产可用 |

证据：[SQLBot 产品](https://dataease.cn/sqlbot/)、[数据源列表](https://dataease.cn/sqlbot/v1/user_manual/datasource_description.html)、[问数流程](https://dataease.cn/sqlbot/v1/user_manual/smart_question_description.html)、[Superset 6.1.0 MCP](https://github.com/apache/superset/blob/6.1.0/superset/mcp_service/README.md)、[DB-GPT](https://github.com/eosphoros-ai/DB-GPT)、[Lightdash 企业功能](https://docs.lightdash.com/self-host/enterprise-features)、[Rill AI Chat](https://docs.rilldata.com/guide/ai/ai-chat)、[WrenAI FAQ](https://github.com/Canner/WrenAI)、[Vanna 归档状态](https://github.com/vanna-ai/vanna)、[superset-ai 作者仓库](https://github.com/braislchao/superset-ai)。表内评级是本次评估。

WrenAI FAQ 将早期聊天式 BI 放在 legacy/v1（v1-final），主方向改为 Agent 可使用的上下文、语义与执行组件。2026-10-16 下载源码后发现 legacy/v1 仍有后续安全依赖修复，因此纠正先前“完全没有安全修复”的绝对表述。旧版重量和单项目限制不能直接套用当前 main；新版开源 MCP、MDL 行列控制原语也需与完整团队商业产品区分，详见 [07-WrenAI 独立分析](07-wrenai-analysis.md)。[官方仓库](https://github.com/Canner/WrenAI)

Lightdash 技术栈与你的 Node.js 背景贴近，但开源核心和企业目录适用不同许可证；AI agents、MCP 需要按自托管企业文档配置许可证。若需重新实现聊天与权限适配，它的现成 Agent 优势会缩小。[许可证](https://github.com/lightdash/lightdash/blob/main/LICENSE)、[自托管边界](https://docs.lightdash.com/self-host/enterprise-features)

SQLBot 的行列权限实现依赖 xpack，文档说明不等于免费发行包已验证可用；官方仓库将 xpack 描述为商业扩展。也不能据此反推每一项 xpack 能力都收费。本次保留为授权与运行验证项。[权限实现](https://raw.githubusercontent.com/dataease/SQLBot/refs/heads/main/backend/apps/datasource/crud/permission.py)、[开发说明](https://github.com/dataease/SQLBot/blob/main/AGENTS.md)

DB-GPT 的官方讨论中，维护者说明目前使用 schema linking、业务知识及示例，并开放外部语义层扩展，而不计划直接自建原生语义层。因此它可作 Agent 平台候选，不能默认代替指标治理。[维护者讨论](https://github.com/orgs/eosphoros-ai/discussions/3024)

## 3. BI 是否有类似 workflow 的明确语义层

有，但业务语义层通常表达指标、维度、实体和关联，不直接表达交互页面的全部行为。MetricFlow 将语义模型和指标转换成查询；Cube 将指标、维度、关联及访问控制以模型方式暴露给消费端。[MetricFlow](https://docs.getdbt.com/docs/build/build-metrics-intro)、[Cube 模型](https://docs.cube.dev/reference/data-modeling/cube)

因此应分别定义：

- **业务定义**：收入是否扣退款、使用订单还是支付流水、币种、时区、关联基数、可用维度。
- **分析请求**：使用哪些已批准指标、分组维度、时间粒度和筛选。
- **展示配置**：图表、字段映射、位置、筛选作用范围及点击跳转。

业务定义应稳定、可版本化，Agent 优先复用；分析请求和展示配置才是每次对话主要生成的内容。新业务定义可由 Agent 提案，但需要数据负责人校验，不能悄悄重定义已有指标。

## 4. 是否值得增加独立“语义＋编译”服务

### 推荐起点：轻量配置与确定性适配

一个内部团队、一个主要 BI 前端，先用经过建模的查询视图与 BI 指标定义，再增加小型适配模块。不首先同时部署 Cube、dbt Semantic Layer 和另一套指标引擎。

拟设计的流向：

~~~text
自然语言
  -> 选择已有指标与数据集
  -> 结构化分析请求和 DashboardSpec
  -> 类型、权限、图表兼容性与布局校验
  -> 确定性适配器
  -> BI 原生图表、仪表盘、筛选资产
~~~

“编译”主要是校验与转换：把已解析的字段引用、图表类型、布局和筛选映射成 BI API 参数。针对一个 BI，只需一个应用模块，不必独立微服务或创造通用 BI 编程语言。

图表不一定要串行查询。只有读取前一步结果的模块才有执行依赖；共享筛选、并列展示、点击联动与数据依赖应分别建模。

### 升级独立业务语义层的条件

多个 BI/应用同时消费相同指标；同一口径被多部门反复复制；复杂关联和指标组合超出视图管理能力；需要独立指标 API、缓存和预聚合时，Cube 等组件更有意义。

代价是增加模型维护、身份映射、缓存隔离、预聚合刷新和部署运维。Cube 的多个 data_source 不意味着任意实时跨源 JOIN：其官方跨源关联示例依赖 rollup_join 和预聚合。对本次异构在线数据，优先考虑统一查询引擎，让 Cube 连接一个逻辑入口。[跨源关联示例](https://docs.cube.dev/recipes/pre-aggregations/joining-multiple-data-sources)

MetricFlow 可作建模对照，但 dbt 文档区分开源组件与平台 Semantic Layer 的消费能力，不应把平台套餐权益当免费自托管能力。[官方边界](https://docs.getdbt.com/docs/build/build-metrics-intro)

## 5. 自建 Agent 应选什么

| 选择 | 适合场景 | 本项目判断 |
| --- | --- | --- |
| SQLBot 自带 Agent | 尽快聊天问数和人工组装看板 | 核心体验够用就先用 |
| Superset 官方 MCP + 自有对话应用 | BI 工具已有，需任务规划与交互 | 优先复用工具，再补流程 |
| LangGraph | 规划、并行分析、验证、受控重试、暂停和恢复 | 自建编排首选 |
| Pydantic AI | 强调类型化工具和结构化输出 | 轻量备选，不与 LangGraph 同时引入 |
| DB-GPT / AWEL | 完整 SQL/Python/RAG 分析平台 | 技术储备；少量 BI 工具可能用不满 |
| Dify 工作流 | 团队希望通过 UI 管理模型与工具流程 | 原型备选，仍需 BI 适配和身份传递 |

这些是工程选型判断，不是性能排名。LangGraph 提供持久化状态和 checkpoint，适合多轮修改及故障恢复；但创建图表等外部副作用仍需业务幂等，checkpoint 不是分布式事务。[概览](https://docs.langchain.com/oss/python/langgraph/overview)、[持久化](https://docs.langchain.com/oss/python/langgraph/persistence)

Pydantic AI 提供类型化工具、校验后的结构化输出及持久执行集成，并非只能做简单聊天。这里偏向 LangGraph，是因为本需求的显式状态分支与恢复更自然。[Pydantic AI](https://pydantic.dev/docs/ai/overview/)

Dify 工具节点能调用工具，但不会自动补齐看板资产和部门隔离。[工具节点](https://docs.dify.ai/en/cloud/use-dify/nodes/tools)

## 6. Agent 工具边界（拟设计）

初期只开放数据发现、指标查询、预览、保存图表、加入看板和更新布局等窄工具。请求中的用户、部门、可见数据集来自后端会话，不接受模型指定身份。

状态包括：意图、授权目录、指标引用、查询计划、验证结果、图表配置、看板配置、资产 ID、修订号及追踪 ID。查询错误可进入修复，权限错误不能通过换数据集或扩大凭据“修复”。

确定性规则负责字段存在性、聚合与维度兼容、只读查询范围、图表支持、时间单位、布局边界和资产写入权限。Agent 负责语义拆解、解释和候选选择。

“一键加入”应保存可重新查询的图表定义和来源引用，不只保存图片；刷新、编辑、跨部门打开和字段变更都有明确行为。

## 7. 部门隔离

内部多部门不要求计费，也不自动要求每部门独立部署。建议逻辑隔离起步：部门角色控制目录、数据集和资产访问；行级策略控制共享表记录；受控视图或语义成员权限限制敏感列。

缓存、聊天、导出、异步任务和检索示例也包含数据，它们的隔离范围要与查询身份一致。共享 SQL 模板可以复用，但某部门的查询结果不可直接成为另一部门的上下文。

跨部门分析必须有公共数据产品或管理角色授权。跨库 JOIN 不意味着自动获得跨部门数据权限。

## 8. 结论

先复用完整 BI 和数据 Agent 工具，补轻量、可校验的展示配置与适配器。独立语义层保留为备选，其必要性由重复口径和多消费端需求决定。方案对比见 [question.md](question.md)，工作流见 [workflow.md](workflow.md)。
