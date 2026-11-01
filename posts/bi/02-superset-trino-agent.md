# 方案二：Superset＋Trino＋官方 MCP＋轻量 Agent 适配（推荐）

调研日期：2026-10-15。适用目标：内部多部门使用，自然语言出图，聊天结果加入可编辑仪表盘，同次查询跨两个 MySQL 或 MySQL＋PostgreSQL 关联。

结论：这是本次需求下的优先方案。它复用成熟 BI 的 UI、图表与资产管理，把跨源计算交给查询引擎，新增开发集中在聊天入口、业务规划以及布局/联动适配。它仍是一套需要集成的方案，不是安装后所有需求自动满足的成品。

研究方式：官方文档、发布记录及 6.1.0 稳定 tag 源码核实；未部署、未压测、未验证部门身份的端到端传递。

## 1. 固定版本与能力基线

截至调研日，Superset 稳定发布为 6.1.0；7.0.0rc1 是预发布，不作为本次基线。Next 文档可以帮助发现方向，但不能把其中新增工具归到稳定版。[稳定发布](https://github.com/apache/superset/releases/tag/6.1.0)、[发布列表](https://github.com/apache/superset/releases)

6.1.0 的变更记录已包含官方 MCP、图表生成与虚拟数据集等能力，因此无需先依赖第三方 MCP 实现。[稳定版变更记录](https://github.com/apache/superset/blob/6.1.0/CHANGELOG/6.1.0.md)

| 需求 | 6.1.0 基线 | 我们需要补的部分 |
| --- | --- | --- |
| 图表、看板和可视化编辑器 | 原生 BI 具备 | 限定并验证 Agent 支持的图表子集 |
| Agent 保存图表 | 官方 MCP generate_chart 支持 | 显式保存、重试幂等、用户身份 |
| 创建看板/将图表加入已有看板 | 官方 MCP 支持 | 聊天 UI 中的保存按钮和选择目标看板 |
| 按需求自动布局 | MCP 默认自动布局较简单 | 受控 REST 适配器 |
| 原生筛选与跨图联动 | BI 及 REST 有相应配置 | 按稳定版 schema 生成并验证 |
| 聊天 UI | MCP 本身不提供完整业务聊天产品 | 自建轻量聊天页或集成既有应用 |
| 中文意图拆解及模块规划 | 由外部 Agent 承担 | 业务提示、结构化输出、验证流程 |
| 跨源 JOIN | 由 Trino 承担 | catalogs、业务建模与性能验证 |
| 部门隔离 | RBAC/RLS 等基础能力 | 策略配置、身份映射和完整通路验收 |

## 2. 架构与部署部件

~~~mermaid
flowchart LR
  U[用户与部门身份] --> C[聊天入口]
  C --> A[Python Agent 服务]
  A --> V[语义与配置校验]
  V --> M[Superset 官方 MCP]
  V --> R[受控 REST 适配]
  M --> S[Superset]
  R --> S
  U --> S
  S --> D[PostgreSQL 元数据库]
  S --> T[Trino]
  T --> O[MySQL 订单库]
  T --> P[CRM 库或另一个 MySQL]
~~~

Agent 服务可以采用 Python/FastAPI＋LangGraph，校验器和 REST 适配器作为同一服务中的模块，不必拆独立微服务。聊天页可由已有前端应用承载，避免为了首版引入庞大门户。

核心运行部件是 Superset Web、持久元数据库、独立 MCP 进程、Trino、Agent 服务。缓存、Celery、异步任务及报表服务根据需要增加；首次跨源验证不必立刻部署完整高可用集群。[Superset 架构](https://superset.apache.org/admin-docs/installation/architecture/)、[MCP 6.1.0 配置](https://superset.apache.org/admin-docs/6.1.0/configuration/mcp-server/)

Superset 后端是 Python，前端是 React。Trino 运行于 JVM，但使用与运维不要求先写 Java 业务代码。Windows 本机以 Linux 容器/WSL 或独立 Linux 环境验证；官方 Compose 示例面向尝试和开发，不原样当生产部署。[Compose 边界](https://superset.apache.org/admin-docs/installation/docker-compose/)

## 3. 数据源与真正的跨源查询

Superset 可直接连接常见 SQL 数据库；本方案把需要跨源关联的数据通过 Trino 暴露成一个查询入口。Trino MySQL connector 明确支持跨 MySQL 实例以及与其他系统关联。[MySQL connector](https://trino.io/docs/current/connector/mysql.html)

建议每个源实例配置 catalog。例如：

| 来源 | Trino catalog | 可查询对象示意 |
| --- | --- | --- |
| MySQL 订单实例 | mysql_sales | mysql_sales.shop.orders |
| PostgreSQL CRM 实例 | pg_crm | pg_crm.crm.customers |
| 另一 MySQL 实例 | mysql_crm | mysql_crm.crm.customers |

同一 MySQL 实例的多个 database 通常映射为不同 schema，不必每张表部署一套服务。新增源通常增加 catalog 配置和权限，不是为每个数据源复制完整 BI/Agent 栈。

示意 SQL（表名、字段均为虚构，非可直接部署脚本）：

~~~sql
SELECT
    c.industry,
    SUM(o.paid_amount) AS paid_amount
FROM mysql_sales.shop.orders AS o
LEFT JOIN pg_crm.crm.customers AS c
    ON o.customer_id = c.customer_id
   AND o.dept_id = c.dept_id
WHERE o.paid_at >= TIMESTAMP '2026-07-01 00:00:00'
GROUP BY c.industry
~~~

这是同一次 SQL 查询访问两个数据源，不是 Agent 分别执行两次查询后在回答中“拼结果”。是否必须使用复合关联键，取决于真实主键和部门域。

首版可以将受控跨源 SQL 保存为 Superset 虚拟 dataset。若要在 Trino 层持久化业务视图，需选择支持相应视图能力的 catalog，不能假设所有 connector 都能 CREATE VIEW。

不推荐用 Superset 实验性 meta database 作为生产跨源底座。它在执行进程内存中合并数据，并有每来源表默认取行上限，可能导致大表 JOIN 不完整。[官方跨库说明](https://superset.apache.org/user-docs/6.0.0/configuration/databases/#querying-across-databases)

## 4. 性能与一致性的边界

跨 catalog JOIN 无法整体下推给某一个 MySQL，剩余关联在 Trino 执行。应尽量提前筛选、只取必要字段、核实关联基数，并检查源库扫描和网络传输。[下推说明](https://trino.io/docs/current/optimizer/pushdown.html)

“接线上数据”不等于适合每次对生产主库做大范围关联。根据实测，可以改用只读副本，或将热点大表同步至分析仓库；这会增加数据时延与同步运维，是后续扩容选项，不是首版强制前提。

本次没有找到“所有异构源在同一时刻全局一致快照”的保证。对跨系统指标，要说明统计时间与源延迟；对账类分析可能需要统一快照/水位。不能因为 Trino 支持事务语法，就宣称整个异构查询具备全局一致性。

## 5. 官方 MCP 能做到哪里

稳定版 generate_chart 默认预览，保存需要 save_chart=True。应通过工具返回的原生资产引用，把可继续编辑的 chart 加入看板，而不是截一张图保存。[生成图表实现](https://raw.githubusercontent.com/apache/superset/6.1.0/superset/mcp_service/chart/tool/generate_chart.py)

稳定版已有 generate_dashboard 和 add_chart_to_existing_dashboard，但 generate_dashboard 使用固定的两列自动布局，初始化时没有原生筛选且关闭 cross filters。它的请求结构也没有自定义完整布局参数。[工具清单](https://raw.githubusercontent.com/apache/superset/6.1.0/superset/mcp_service/dashboard/tool/__init__.py)、[看板生成实现](https://raw.githubusercontent.com/apache/superset/6.1.0/superset/mcp_service/dashboard/tool/generate_dashboard.py)、[请求结构](https://raw.githubusercontent.com/apache/superset/6.1.0/superset/mcp_service/dashboard/schemas.py)

因此，不能写成“稳定版官方 MCP 已自动完成任意布局和联动”。本方案只补以下业务工具（拟设计，名称非现有原生工具名）：

- apply_dashboard_layout：接受受限布局，转成 position_json。
- configure_dashboard_filters：接受字段、类型和作用范围，转成 native_filter_configuration。
- configure_chart_interactions：按已验证图表能力设置联动范围或明细跳转。

底层复用 PUT /api/v1/dashboard/{pk} 等原生 API；6.1.0 schema 提供 position_json、json_metadata、roles/owners 等字段。[稳定版 schema](https://raw.githubusercontent.com/apache/superset/6.1.0/superset/dashboards/schemas.py)、[API](https://raw.githubusercontent.com/apache/superset/6.1.0/superset/dashboards/api.py)

这些适配工具只暴露经过校验的字段，不让模型任意覆写整份看板 JSON。

## 6. 业务语义与“编译层”

首版不额外部署 Cube 或 dbt Semantic Layer。业务视图/虚拟 dataset 固化表关系与粒度，Superset 指标、字段说明及一份小型业务目录保存口径、同义词、单位和例子。

增加分析请求与 DashboardSpec，表达指标引用、图表字段、网格布局、筛选和跳转。确定性适配器把它们转换成稳定版本的 MCP/REST 调用。该配置是内部 DTO，不是声称 Superset 已有同名标准。

必须避免同一个“净销售额”在 YAML、提示词和 Superset 中分别存三份可独立修改的表达式。指定一个权威定义，其他位置只放 ID、版本和描述。

当多个应用都要消费同一套复杂指标时，再考虑升级 [方案三](03-cube-trino-custom-bi.md)。语义定义和图表配置的详细区分见 [专项调研](agent-semantic-research.md)。

## 7. 多用户、部门隔离与多租户判断

支持内部团队的逻辑隔离，但本方案不宣称是默认已配置好的严格物理多租户 SaaS。无需建设计费模块。

建议以 Superset 角色、数据集和看板权限控制资产访问，在 Trino/底层数据服务强制执行部门数据规则。行级过滤限制共享表，受控视图或列策略限制敏感信息。图表可编辑的筛选不是权限规则。

### 不同查询路径分别验证

| 路径 | 实际边界 | 实施要求 |
| --- | --- | --- |
| 官方 MCP | 可按 JWT 解析实际 Superset 用户并执行 RBAC | 禁止生产共用开发 admin 身份 |
| MCP execute_sql | 稳定执行器会尝试 AST RLS 注入 | RLS 依赖匹配已注册物理 dataset 的数据库、catalog、schema、table |
| 传统 SQL Lab UI | 与 MCP 执行路径不同 | 按稳定版文档核实 RLS_IN_SQLLAB 等配置 |
| Agent 直接连接 Trino | 不经过 Superset RLS | 需要 Trino 自身策略；首版尽量不新增该旁路 |

依据：[MCP 身份](https://raw.githubusercontent.com/apache/superset/6.1.0/superset/mcp_service/auth.py)、[MCP SQL 工具](https://raw.githubusercontent.com/apache/superset/6.1.0/superset/mcp_service/sql_lab/tool/execute_sql.py)、[统一执行器](https://raw.githubusercontent.com/apache/superset/6.1.0/superset/sql/execution/executor.py)、[RLS 匹配](https://raw.githubusercontent.com/apache/superset/6.1.0/superset/utils/rls.py)、[6.1.0 安全文档](https://superset.apache.org/admin-docs/6.1.0/security/)。

特别注意：在直连 MySQL 的 Superset connection 上配置 RLS，不会自动变成 Trino connection 下同名表的 RLS。一个共享 Trino 用户也无法天然识别前端部门。

### 推荐身份方案

优先验证实际用户透传或受控 impersonation。Superset Trino engine 有相应能力，但需要认证、允许的 impersonation 范围和映射共同正确，不能只接受任意客户端用户名。[稳定版实现](https://raw.githubusercontent.com/apache/superset/6.1.0/superset/db_engine_specs/trino.py)

若端到端透传复杂，初期可每部门使用独立受限 Trino 凭据和 BI connection，仍共享同一 Trino 计算服务；授权连接只暴露该部门可查询数据。该设计比“所有人同一管理员凭据＋Agent 自觉加 WHERE”更容易验证，但会增加连接和模型维护。

Trino file ACL 支持按用户/组、catalog/schema/table 约束，以及行过滤与列控制；需要显式配置并测试，不把默认配置当部门隔离。[file ACL](https://trino.io/docs/current/security/file-system-access-control.html)

跨源 JOIN 的每个参与表、元数据发现、查询结果、缓存、聊天、导出和异步任务，都需要遵循同一身份范围。

## 8. 使用复杂度、资源与许可证

使用复杂度：中高。BI 本身已有 UI，但跨源建模、查询权限与 Agent 适配需要开发。相较全自建，节省图表编辑器、看板与大量资产管理工作；相较纯 SQLBot，集成工作更多。

资源不能按数据源个数简单乘固定服务配置。查询量、JOIN 中间结果、并发和源库延迟才是主要变量。Superset FAQ 的社区中等实例经验约 8 GB RAM、2 vCPU，不包含 Trino 和 Agent；Trino 官方 JVM 示例也不是全套系统的最低内存承诺。[Superset FAQ](https://superset.apache.org/docs/frequently-asked-questions/)、[Trino 部署](https://trino.io/docs/current/installation/deployment.html)

因此本文不给出“整套 4 GB 一定可用”或固定 QPS。先单节点做功能 PoC，再按实测拆查询计算、异步任务和缓存。

Superset 与 Trino 为 Apache-2.0 项目；额外依赖、模型接口和部署镜像分别核查。模型调用、服务器和运维成本仍存在。[Superset LICENSE](https://github.com/apache/superset/blob/6.1.0/LICENSE.txt)、[Trino LICENSE](https://github.com/trinodb/trino/blob/master/LICENSE)

## 9. 优缺点

优点：

- 跨源计算、BI 资产和 Agent 编排职责清楚，符合两类语言背景的二次开发需求。
- 核心 BI 与查询引擎不依赖购买商业 AI 插件。
- 已有稳定版官方 MCP；无需从零封装全部资产操作。
- 图表和看板原生保存，可继续在 UI 中编辑。
- 不为每个源复制完整 BI 栈，新增源主要是 catalog、模型和权限配置。

缺点：

- Trino 不是零运维的小组件；在线大表跨源 JOIN 需要认真验证。
- 聊天 UI、完整规划、布局和联动仍有开发量。
- 身份从聊天到 BI 再到 Trino 的传递是关键集成工作。
- 稳定版与主线文档差异明显，需要固定版本的适配和回归。

## 10. 最短落地顺序

1. 不接 Agent，先人工跑通两个独立源的一条 SQL 和一个 Superset 图表。
2. 配两个部门账号，验证所有查询、导出和共享入口的数据边界。
3. 连接官方 MCP，完成图表预览、保存、加入指定看板的闭环。
4. 增加聊天入口和业务目录，实现四种基础图表。
5. 补布局和筛选 REST 适配，支持用户提出的多模块看板。
6. 验证幂等、多轮修改、源更新、缓存和查询成本。
7. 再决定是否引入独立语义层或同步分析仓库。

完整工作流和待执行验收项见 [workflow.md](workflow.md)。若两个源跨库查询的成本不可接受，应先调整数据底座，不用更复杂的 Agent 掩盖查询问题。
