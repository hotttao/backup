# WrenAI 单独分析：旧版限制、新版能力与源码核查

调研日期：2026-10-16。需求基准：一次查询跨 MySQL 等不同物理数据库 JOIN、内部多部门隔离、聊天出图、一键加入可继续编辑的看板。

本文已下载并阅读 WrenAI 当前版和 Classic 源码；没有安装运行依赖，没有连接业务数据库或执行部署。文中的跨源组合、性能和权限闭环仍需 PoC。[同轮 BI 源码比较](07-bi-source-comparison.md)另行比较 Metabase、Lightdash、SQLBot 和自建方案。

## 1. 先回答你的判断是否准确

| 原有判断 | 核查结果 |
| --- | --- |
| 旧版每个数据源都很重 | **有实际架构原因。** 原版以一个当前 project/连接组织系统；保留多个独立直连源时，复制实例会重复部署多个应用服务。但不能说每个后端物理数据库必然需要一套，Trino 可汇聚多个源 |
| 免费版不支持多个数据源 | **对 Classic OSS 的多独立连接/project 管理基本准确；不能概括当前新版。** 当前 main 可管理多个 profile，核心代码未见按连接数收费的门控 |
| 新版已经解决全部需求 | **没有。** 新版重心变为可嵌入的语义、上下文与执行组件，完整团队 UI、账号权限和运营能力需购买商业产品或自行建设 |
| 支持许多数据库就能跨库 JOIN | **不能这样推导。** 新版常规 WrenEngine 查询选择一个 connector；跨物理系统可采用 Wren→Trino，由 Trino 联邦执行 |
| 开源引擎完全没有行列权限 | **不准确。** Rust 核心有 RLAC/CLAC 规则与实现；身份可信注入、多用户管理、资产授权等产品链路仍需另做 |

结论：你的旧版体验有源码依据。当前更值得评估的是把 Wren 新版作为自建方案的语义/查询模块，不能按旧 UI 的升级版直接替换安装。

## 2. 本次下载的源码版本

临时目录：`C:/Users/tao/AppData/Local/Temp/bi-source-research-20261016/`。

| 源码 | 目录 | 实际版本 |
| --- | --- | --- |
| 当前 main | `wrenai` | `9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308`，2026-10-16；Python wrenai 包声明 0.15.0 |
| Classic legacy/v1 | `wrenai-classic` | `ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc`，2026-08-18 |
| Classic 标记点 | 同一 Classic 仓库中 fetch | `v1-final`=`e42b8d057c611016d781c7bbe74ba4e5aeb9712d`，2026-05-04 |

这些是源码快照，不表示所有分支都是稳定发行包，也不表示本次验证过它们的运行兼容性。后文 GitHub 源码链接固定至上述提交，避免 main 后续变化使结论无法复查。[新版包定义](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/pyproject.toml)

## 3. Classic：一个 project、一个逻辑数据源和一个看板

### 3.1 单数据源不是只看界面得出的印象

Classic 的 project 保存一个 `type` 和 `connectionInfo`。`getCurrentProject()` 只取一条当前项目；保存新数据源之前会调用 reset，代码直接注明当前只能创建一个 project。[projectRepository.ts](https://github.com/Canner/WrenAI/blob/ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc/wren-ui/src/apollo/server/repositories/projectRepository.ts#L166-L208)、[projectResolver.ts](https://github.com/Canner/WrenAI/blob/ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc/wren-ui/src/apollo/server/resolvers/projectResolver.ts#L258-L279)

reset 路径涉及删除模型、对话、部署记录和 AI 索引。因此在原版流程中“换数据源”不是向同一工作空间追加一个并存连接。[重置实现](https://github.com/Canner/WrenAI/blob/ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc/wren-ui/src/apollo/server/resolvers/projectResolver.ts#L116-L134)

这一限制影响多个独立业务数据库的长期共存；它不同于支持 MySQL/PostgreSQL 等多种连接器类型。

### 3.2 “重”来自什么

默认 Compose 定义 bootstrap、wren-engine、ibis-server、wren-ai-service、qdrant、wren-ui 六个服务，其中 bootstrap 是初始化任务，另外五个承担运行服务；UI 元数据库默认 SQLite。[docker-compose.yaml](https://github.com/Canner/WrenAI/blob/ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc/docker/docker-compose.yaml#L10-L123)

为保留多个直连数据库而复制完整实例，会重复承担 UI、AI 服务、引擎及索引基础设施成本。这支持你“每个源一套很重”的体验；本次未测内存、启动耗时和并发，不给每源资源数字。单表数量或连接器类型数量本身也不等于容器数量。

把多个实例的 AI 服务或索引服务共用，是需要处理路由、状态和隔离的改造，不能当成原版已有多租户方案。

### 3.3 一个重要例外：Classic 已有 Trino 路径

源码的 Trino 配置接受多个 `catalog.schema`；Ibis adaptor 分别读取它们的表元数据后合并；MDL 保留每张表的 catalog/schema/table。[dataSource.ts](https://github.com/Canner/WrenAI/blob/ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc/wren-ui/src/apollo/server/dataSource.ts#L277-L337)、[ibisAdaptor.ts](https://github.com/Canner/WrenAI/blob/ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc/wren-ui/src/apollo/server/adaptors/ibisAdaptor.ts#L357-L398)、[mdlBuilder.ts](https://github.com/Canner/WrenAI/blob/ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc/wren-ui/src/apollo/server/mdl/mdlBuilder.ts#L436-L448)

由此可提出 `Classic → 一个 Trino 连接 → 多个物理源`。这可能减少 Wren 实例数，真正跨库 JOIN 由 Trino 完成。**这是有源码支撑的组合方向，尚未验证跨 catalog 建模、编译和执行成功。** 它也不会自动补齐多看板和部门权限。

### 3.4 原版看板是持久化资产，但 OSS 只有一个

dashboard service 直接注明 OSS 只支持一个 dashboard。看板 item 保存 SQL、chartSchema 和 x/y/w/h；添加流程从聊天 response 取得 SQL 与图表配置，另建看板 item，布局用 react-grid-layout 并回写后端。[单看板限制](https://github.com/Canner/WrenAI/blob/ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc/wren-ui/src/apollo/server/services/dashboardService.ts#L128-L147)、[添加流程](https://github.com/Canner/WrenAI/blob/ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc/wren-ui/src/apollo/server/resolvers/dashboardResolver.ts#L86-L132)、[item 模型](https://github.com/Canner/WrenAI/blob/ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc/wren-ui/src/apollo/server/repositories/dashboardItemRepository.ts#L28-L47)

因此它确实实现过你需要的“聊天出图→入看板”基本链路；问题在产品规模和隔离边界，不能把它简化为只能输出临时图片。

### 3.5 部门隔离需要实质改造

Classic GraphQL context 主要持有全局服务和 repository，没有建立按请求 user/role/department 的产品身份上下文；dashboard/item 表也未形成 owner/部门 ACL 模型。[GraphQL 入口](https://github.com/Canner/WrenAI/blob/ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc/wren-ui/src/pages/api/graphql.ts#L128-L165)、[dashboard 表](https://github.com/Canner/WrenAI/blob/ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc/wren-ui/migrations/20250102074255_create_dashboard_table.js#L6-L15)

在前面加一个登录代理，只能限制谁能进页面，不能自动实现部门看板 ACL、源可见性和查询行列隔离。大量 current project/current dashboard 的调用方式也说明，补多项目不能只删除一个数量判断。

## 4. 当前 main：适合当组件，连接数不再等于完整实例数

### 4.1 多 profile 与单次查询的区别

`profile.py` 用字典保存命名连接，提供 add/list/switch；本次检查的添加与切换路径没有单连接配额判断。`WrenEngine` 则持有一个 data_source、connection_info，并延迟创建一个 connector。[profile.py](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/profile.py#L226-L345)、[engine.py](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/engine.py#L49-L127)

所以新版可以保存与切换多个独立连接，也可以由自己的 Python 应用管理多份 engine/profile；不能把“有多个 profile”当作单条查询自动 JOIN 多个连接。

原生 Trino connector 已存在，调用 Trino Python 客户端执行计划后的 SQL。它为 `Agent → Wren MDL → Trino → 多物理源` 提供了适配基础；跨 catalog SQL 与 MDL 组合仍需实跑验证。[Trino connector](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/connector/trino.py)

DuckDB connector 的现有实现重点是本地/对象文件及 DuckDB 文件附加；不能直接把 DuckDB 自身支持外部 MySQL attach 的能力，算成 Wren 已有自动多数据库连接配置。[DuckDB connector](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/connector/duckdb.py#L55-L158)

### 4.2 实际查询链路

~~~text
Agent 写针对已发布模型的 SQL，或调用结构化 cube 查询
  → 读取 MDL 与连接 profile
  → sqlglot 解析 SQL、检查策略、提取相关模型子集
  → wren-core Rust 语义展开
  → CTE 重写与目标方言输出
  → 再检查最终 SQL
  → 单个 connector 执行
  → PyArrow 结果与错误信息
~~~

Python engine 中可以直接读到这条流程；CTE rewriter 对模型和 view 的处理不同，不能将它视为单纯替换表名的模板。[engine.py](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/engine.py#L177-L265)、[cte_rewriter.py](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/mdl/cte_rewriter.py#L1-L95)

MDL 可以表达模型、关系、计算字段、view 与 cube 指标。示例 cube 将收入、订单数与客户维度放在明确的定义中；它是可执行的业务语义层，不只是元数据说明或图表 Schema。[cube 示例](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/examples/v5-jaffle/cubes/order_metrics/metadata.yml)

### 4.3 部署比旧版薄，但不是零依赖

新版支持进程内 engine 和 MCP，不要求复刻旧 Compose。连接器依赖按 extras 安装，memory 向量检索也是可选项；基础包仍依赖 Rust/Python binding、DuckDB、PyArrow、Pandas 等。可选 memory 会增加本地索引、模型和相关库成本，不能把最小安装与 all/memory 安装混在一起比较。[pyproject.toml](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/pyproject.toml#L24-L85)、[serve_cli.py](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/serve_cli.py#L122-L182)

没有证据说明一个 profile 必须启动一套旧版 UI、Qdrant 和服务。实际常驻连接、模型上下文和缓存仍会随规模增长，需要分别测量。

## 5. 开源与商业：必须分功能层级判断

### 5.1 官方表述存在不一致

官网 Open Core 页把完整 UI、团队账号、行列安全管理、嵌入和平台 API 列为商业能力；README 同时说明开源 engine/CLI/MCP。[官网边界](https://www.getwren.ai/en/open-core)、[当前 README](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/README.md)

但仓库 `oss_vs_commercial.md` 的表格把 MCP server 列为商业，把 GenBI dashboards 与 MDL RLAC/CLAC 列为开源。实际源码确实存在 MCP、GenBI 辅助工具和底层权限规则。因此不能只照抄某一张营销/文档表格。[该比较文档](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/docs/core/concepts/oss_vs_commercial.md)

应使用下面的精确区分：

| 能力 | 本次源码判断 |
| --- | --- |
| 连接器、命名 profiles、MDL 编译、SDK | 开源组件可见；未见按连接数量锁定 |
| 本地/自运行 MCP server | 开源源码可见，支持 stdio/HTTP；不是完整托管多用户 MCP 产品 |
| MDL 行/列访问控制表达与执行 | Rust 实现可见；需要可信 session properties |
| 团队登录、用户组、权限管理 UI、审计和完整平台 | 官网列为商业能力；不把引擎构件等同于现成团队产品 |
| Agent 编写并部署静态 GenBI app | 有开源辅助工具；不同于固定产品中的共享可视化看板编辑器 |

MCP server 当前在启动时绑定 project/engine，查询工具没有自行建立每位访问者的部门身份。把 HTTP 端口提供给整个团队不等于已实现权限隔离。[mcp_server.py](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/mcp_server.py#L23-L35)、[服务构造](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/mcp_server.py#L687-L721)

### 5.2 权限原语确实开源，但不能直接当部门产品

Rust `WrenAccessControlProvider` 会合并模型行过滤，并判断列访问。规则校验会对缺少 required session property 返回错误；optional 属性的行为不同，不能漏配后假定全部 fail-closed。[provider](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren-core/core/src/logical_plan/analyze/access_control/wren_provider.rs#L15-L69)、[规则校验](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren-core/core/src/logical_plan/analyze/access_control/mod.rs#L513-L584)

Python `query` 与 LangChain SDK 直接方法支持传入 properties。这为应用根据登录身份注入部门条件提供基础，但不能让模型或浏览器自由指定身份属性。[SDK query](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/sdk/wren-langchain/src/wren_langchain/_toolkit.py#L61-L96)

另一个需要明确配置的默认值：`WrenConfig.strict_mode=False`。它控制是否强制只引用 MDL 中的对象，不能把“使用 MDL”自动当成“已禁止原始表”。Engine 有只读语句及最终 SQL 检查，但只读、模型范围和部门行列权限是三件独立的事。[config.py](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/config.py#L12-L34)、[policy.py](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/policy.py#L1-L12)

CLI 与 SDK 的配置传递也有差异：CLI 显式加载并传入 WrenConfig，当前 LangChain toolkit 的 `_build_engine()` 只传模型和连接，未传 config，engine 会使用默认配置。因此不能假定 CLI 中启用 strict 后，SDK 自动继承；接入时应显式配置自己的 engine 封装，并对所有入口做一致性验证。[CLI 配置](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/cli.py#L255-L286)、[SDK 构造](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/sdk/wren-langchain/src/wren_langchain/_toolkit.py#L156-L171)

### 5.3 “免费”还要与云服务套餐分开

当前公开定价页描述商业 Cloud/自托管方案与试用，没有证据支持“现在所有免费 Wren 都只允许一个连接”的笼统结论。旧版 OSS 的单 project 限制、云套餐权益、新版开源组件应分别判断。[当前定价页](https://www.getwren.ai/pricing)

源码许可按路径区分：当前 core/sdk/skills/examples 等为 Apache-2.0，docs 为 CC BY 4.0；根许可预留未来 AGPL 模块，但本次映射未把现有核心列为 AGPL。Classic 根许可为 AGPL-3.0。直接复用代码应按对应快照/路径判断，不能只看仓库名称。[新版 LICENSE](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/LICENSE)、[Classic LICENSE](https://github.com/Canner/WrenAI/blob/ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc/LICENSE)

## 6. 新版“生成看板”实际做了什么

`wren genbi build` 的核心是向外部 coding agent 输出一份结合当前模型的构建指令，由 agent 编写 app 文件；composer 不是完整的确定性看板布局编译器。[composer.py](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/genbi/composer.py#L1-L6)、[CLI build](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/genbi/cli.py#L64-L146)

默认 snapshot 模式把数据文件与 app 一起发布，浏览器查询；live 模式则需要自己的数据 API/代理与鉴权。它能产出可筛选、可迭代修改的页面，但不等于提供一个统一的、带部门 ACL 的看板资产管理和拖拽编辑产品。[数据模式指令](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/genbi/composer.py#L19-L42)

`verify_app` 主要检查入口文件、MDL JSON、snapshot 数据文件及常见内联秘密；源码注明是结构检查，没有浏览器内真实 wasm 查询测试。verify 通过不能证明数值、刷新、联动和部门隔离正确。[verify.py](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/genbi/verify.py#L1-L6)、[检查实现](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/genbi/verify.py#L111-L161)

对本需求，更适合复用语义与执行组件，继续由成熟 BI 或我们自建的版本化看板应用提供展示资产。部门私有数据不能仅靠静态页面筛选隐藏，下载到浏览器的数据本身就要符合当前用户权限。

## 7. 关于 Classic 维护状态的纠正

当前 README 称 Classic 分支不再获得新功能或安全修复；但实际 `legacy/v1` 的 2026-08-18 提交修复安全依赖，晚于 v1-final。两者业务核心路径一致，差异主要涉及依赖、工作流及配置。

所以准确表述是：**Classic 是历史产品分支，官方主方向已转移，README 没有持续维护承诺；分支仍出现过后续安全依赖修复。** 不应宣称已经完全没有任何修复，也不能因此反推持续安全支持有保证。[分支提交](https://github.com/Canner/WrenAI/commit/ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc)、[官方架构转移说明](https://github.com/Canner/WrenAI/discussions/2205)

这一结论修正了前面调研中仅根据 README 写出的“旧版停止全部安全修复”的绝对表述。

## 8. 对我们的方案有什么价值

### 值得复用或借鉴

1. **已有语义编译器。** 如果开始需要模型关系、复用指标和计算字段，可评估 Wren 新版，避免自行实现完整 SQL AST/方言语义。
2. **模型发布版本。** Classic deploy service 用 MDL hash 识别变化；自建可让 query、chart 和 execution 都记录 model_revision。[发布实现](https://github.com/Canner/WrenAI/blob/ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc/wren-ui/src/apollo/server/services/deployService.ts#L76-L115)
3. **规划、验证、执行分别暴露。** dry-plan、dry-run、execute 的责任分开；可执行性仍不能替代业务对账。
4. **图表配置与数值分离。** Classic 渲染时再向 Vega-Lite 注入真实 values，对应我们的 ChartSpec＋query_ref。[渲染实现](https://github.com/Canner/WrenAI/blob/ce9ed54c86acb8a0b6ff5d5fea23ed60f057acfc/wren-ui/src/components/chart/index.tsx#L41-L82)
5. **查询结果契约。** MCP 用 N+1 探测截断，SDK 把错误分 code/phase；这些比“成功/失败一个字符串”更利于有界修复。[截断处理](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/mcp_server.py#L78-L113)、[错误 envelope](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/sdk/wren-langchain/src/wren_langchain/_envelope.py#L77-L119)

细节也要审：当前 MCP 将 Decimal 转 float，而 LangChain SDK 将其转 string。财务金额应统一精度与前端显示契约，不能假定不同入口的数值序列化完全一致。[MCP 转换](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/core/wren/src/wren/mcp_server.py#L42-L60)、[SDK 转换](https://github.com/Canner/WrenAI/blob/9c2fea9d72760a8ee1eaefcfd0d9ed302a94b308/sdk/wren-langchain/src/wren_langchain/_envelope.py#L20-L38)

### 新的组合候选

~~~text
内部用户
  → 我们的聊天/身份/看板应用
  → 获授权 QuerySpec 或 cube query
  → Wren 新版语义模块（可信模型、strict 配置、身份属性）
  → Trino（物理跨库 JOIN 与底层策略）
  → 真实结果
  → 我们的 ChartSpec、json-render/图表适配器和版本化资产
~~~

这是 [方案五](05-trino-json-render-flint.md) 的可选增强，不需要同时再引入 Cube。Wren 和 Trino 的策略责任要明确，视图、MDL 和提示词之间也应避免重复维护计算口径。

暂不推荐：从 Classic 分叉补多项目、多看板和完整部门权限以追求快速交付；直接把新版 GenBI 静态 app 当现成内部 BI 门户。

## 9. 采用前的最小验证

- 两个真实源经一个 Trino 连接进入 MDL，跨 catalog JOIN 与人工基准相符。
- 一个订单/退款一对多模型，确认聚合不放大，比例与去重指标正确。
- 服务端注入部门属性；缺少必需属性、访问非 MDL 表、篡改属性、缓存复用均按预期拒绝。
- dry-plan/dry-run/query 使用同一模型与权限配置，错误可分类，重试有上限。
- 三种图表保存、重开、刷新、手工改后再聊天修改，保留稳定资产 ID 与修订。
- 测最小 extras 与 memory 模式的启动、内存、查询时延和索引更新成本。

如果当前只有少量固定业务指标，先保持视图＋小目录；如果语义计算开始重复或模型规模增长，再用这组验证决定是否引入 Wren。源码证明它值得作为组件候选，尚不能替代完整需求验收。
