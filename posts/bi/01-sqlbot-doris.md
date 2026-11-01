# 方案一：SQLBot＋Doris 统一查询入口

调研日期：2026-10-15。路线：尽量采用现成 ChatBI 产品，外加明确的数据查询底座。

结论：SQLBot 最贴近“聊天出图—加入仪表板—手动编辑”的交互，但原生跨异构库 JOIN 和部门权限的免费授权边界不能直接打勾。Doris 可以补跨源查询能力，组合链路仍需验证，且会增加明显的运维与资源成本。

本文未安装运行候选系统。已核实组件能力，未核实的组合能力会明确标出。

## 1. 架构

~~~mermaid
flowchart LR
  U[内部部门用户] --> S[SQLBot 聊天与仪表板 UI]
  S --> D[Doris 业务数据库和视图]
  D --> M[MySQL 订单 Catalog]
  D --> P[PostgreSQL 或 MySQL CRM Catalog]
  S --> B[SQLBot PostgreSQL 元数据]
  S --> L[外部模型服务]
~~~

SQLBot 只看到一个经过整理的 Doris 数据库和业务视图；Doris 在视图内部完成不同 catalog 的关联。每新增一个业务源，不必重复部署一套 SQLBot；增加 catalog、建模和访问策略即可。

业务视图能否被 SQLBot 正确发现、解释并查询，必须作为最先完成的 PoC，不能仅根据两个产品都支持 SQL 就视为验证通过。

## 2. SQLBot 自带什么

官方问数文档说明支持自动选图、切换图表、查看 SQL、继续追问及将图表加入仪表板。仪表板具有保存编辑、拖拽布局、图表、富文本和标签页等能力。因此它提供真正的产品内看板体验，不仅是一次性报告。[问数流程](https://dataease.cn/sqlbot/v1/user_manual/smart_question_description.html)、[仪表板](https://dataease.cn/sqlbot/v1/user_manual/dashboard_description.html)

| 需求 | 判断 |
| --- | --- |
| 中文聊天与自然语言出图 | 原生目标能力，效果需用实际业务问题验证 |
| 聊天图表加入可编辑看板 | 官方有说明 |
| 多源连接管理 | 有多个连接器 |
| 单次问数跨独立源关联 | 未核实原生支持，不能由多源连接推导 |
| 自动规划整份看板及联动 | 未核实完整闭环；人工编辑已有 UI |
| 部门工作空间、行列数据权限 | 有功能文档；免费边界另见第 6 节 |
| 计费 | 本次不需要建设 |

## 3. 数据源与跨源 JOIN 的真实边界

SQLBot 官方列出 MySQL、PostgreSQL、Oracle、SQL Server、达梦、Kingbase、ClickHouse、Doris、Elasticsearch、StarRocks、Redshift、Hive 及 Excel/CSV。未列出 Trino/Presto。创建对话时选择一个数据源，多表关系也在该源内配置。[数据源清单](https://dataease.cn/sqlbot/v1/user_manual/datasource_description.html)、[问数说明](https://dataease.cn/sqlbot/v1/user_manual/smart_question_description.html)

因此不推荐把“SQLBot＋Trino”写成现成方案；要走该路线需新增连接器和元数据适配，其工作量与版本维护成本本次未验证。

SQLBot 有官方 Doris 数据源说明：连接指定数据库，并拉取其中表和视图。[Doris 接入](https://dataease.cn/sqlbot/v1/user_manual/datasource_apachedoris/)

Doris 的 JDBC Catalog 支持 MySQL、PostgreSQL，Multi Catalog 支持单 SQL 跨 catalog 关联。它可以承担用户要求的数据库间 JOIN。[JDBC Catalog](https://doris.apache.org/docs/4.x/lakehouse/catalogs/jdbc-catalog-overview/)、[Multi Catalog](https://doris.apache.org/docs/4.x/key-features/multi-catalog/)

### 建模思路（待验证）

在 Doris 的 internal catalog 下建立 bi 数据库，以视图封装外部 catalog 的业务关系：

~~~sql
-- 架构示意，表字段虚构，未执行。
CREATE VIEW bi.v_sales_customer AS
SELECT
    o.order_id,
    o.dept_id,
    o.paid_at,
    o.paid_amount,
    c.industry
FROM mysql_orders.sales.orders AS o
LEFT JOIN pg_crm.public.customers AS c
    ON o.customer_id = c.customer_id
   AND o.dept_id = c.dept_id;
~~~

然后让 SQLBot 连接 bi 并选用该视图。这样可以避免要求模型每次自行发现所有外部 catalog 的命名规则。但 SQLBot 元数据读取、跨 catalog 视图执行权限和生成查询的全过程仍需实测。[Doris CREATE VIEW](https://doris.apache.org/docs/dev/sql-manual/sql-statements/table-and-view/view/CREATE-VIEW)

## 4. JDBC 联邦查询与同步汇聚是两个子方案

| 子方案 | 实现 | 优点 | 代价 |
| --- | --- | --- | --- |
| A：就地查询 | Doris JDBC Catalog 访问业务源并关联 | 不必先复制完整数据 | 源库扫描与传输；大表可能不合适 |
| B：分析汇聚 | 将需要的数据同步到 Doris 内表后关联 | 更适合重复大范围分析和可控性能 | 存储、同步、刷新延迟与运维 |

Doris 官方将 JDBC 集成定位于少量数据和小表 JOIN；普通读取路径不能替源库加速，大量数据可能需传到 Doris 再关联。不能将它描述为任意线上大表的通用零 ETL 方案。[JDBC 使用边界](https://doris.apache.org/docs/4.x/lakehouse/catalogs/jdbc-catalog-overview/)

异步物化视图也是可评估路径，但 JDBC 来源的刷新能力有限，不能假设自动感知源表变化并增量刷新。PoC 后按固定版本的支持矩阵决定是否适用。[物化视图支持矩阵](https://doris.apache.org/docs/4.x/query-acceleration/materialized-view/async-materialized-view/overview/)

## 5. 语义配置、Agent 和二次开发

SQLBot 的轻量业务配置包括术语/同义词、问题与 SQL 示例、表字段说明及关系；SQL 示例按当前数据源匹配。它不等同于 Cube/MetricFlow 的独立指标查询编译契约。[术语](https://dataease.cn/sqlbot/v1/user_manual/professional.html)、[SQL 示例](https://dataease.cn/sqlbot/v1/user_manual/data_training.html)

建议把稳定业务关联放 Doris 视图，把问法、同义词和验证过的 SQL 作为上下文。不要仅靠术语提示来保证财务口径或部门权限。

SQLBot 官方 MCP 说明包含问数、会话、空间及数据源发现等，没有文档化的看板创建/修改工具。其看板 API 源码有创建及更新画布接口，因此可以开发适配器，但不是“自带 Agent 已能完整规划并生成可联动看板”的证据。[MCP](https://dataease.cn/sqlbot/v1/mcp_server.html)、[看板 API 源码](https://github.com/dataease/SQLBot/blob/main/backend/apps/dashboard/api/dashboard_api.py)

若用户接受“Agent 出图＋人工选入与布局”，二次开发较少；若要求一句话完成整套模块拆解、布局、联动和后续修改，仍需要规划器与看板适配。在此情况下，与方案二的开发量差距会缩小。

## 6. 多用户、部门隔离和多租户

官方文档描述工作空间和行列权限，可以表达按部门限制数据。但是行列权限源码从 sqlbot_xpack.permissions 导入实现，仓库的开发说明将 sqlbot-xpack 描述为商业扩展。[权限文档](https://dataease.cn/sqlbot/v1/user_manual/permission.html)、[权限源码](https://raw.githubusercontent.com/dataease/SQLBot/refs/heads/main/backend/apps/datasource/crud/permission.py)、[官方仓库开发说明](https://github.com/dataease/SQLBot/blob/main/AGENTS.md)

可靠结论是：**有文档化能力，但免费发行包的授权和限制未经运行核实。** 存在 xpack 依赖，也不能反过来断言其中每一项都收费。自定义提示词等也要按对应版本权益逐项核对。[商业版本说明](https://dataease.cn/sqlbot/v1/buy.html)

Doris 自身有行策略与列级授权；如果 SQLBot 各部门共用同一个 Doris 数据库账号，Doris 就只看到同一身份，无法自动继承 SQLBot 登录用户部门。root/admin 也不能作为部门受限身份。[Doris 数据授权](https://doris.apache.org/docs/4.x/admin-manual/auth/authorization/data/)

建议初期验证每部门独立受限 Doris 账号、独立 SQLBot 数据源及工作空间可见性。必要时用部门专属业务表/视图收窄范围；验证视图执行身份、基础表权限、行策略作用范围后才能采用。跨部门公共看板还需要明确资产共享 ACL，不能把创建者可用推导成所有部门可安全共享。

多租户判断：具备逻辑隔离构件，尚不能认定免费版默认提供完整团队隔离闭环；更不能承诺物理多租户。计费模块不在范围内。

## 7. 技术栈、部署与重量

SQLBot 官方架构为 Python 后端、Vue 前端、PostgreSQL 和 Docker；仓库开发说明列出 FastAPI/SQLModel 等组件及图表渲染服务。[系统架构](https://dataease.cn/sqlbot/v1/system_arch.html)、[开发说明](https://github.com/dataease/SQLBot/blob/main/AGENTS.md)

官方 SQLBot 离线部署建议 4 核、8 GB、100 GB 磁盘，这是 SQLBot 应用参考，不包含 Doris。[安装要求](https://dataease.cn/sqlbot/v1/installation/offline_installtion.html)

Doris 还需要 FE/BE。官方开发测试参考是 1 FE（8 核、8 GB）和 1 BE（8 核、16 GB），允许同机；生产建议分离。这是参考配置，非宣称硬性启动门槛，也不宜称为轻量连接适配器。[Doris 环境参考](https://doris.apache.org/docs/4.x/install/preparation/env-checking/)

本方案虽然减少聊天 UI 开发，但部署不一定比 Superset＋Trino 更轻。若已经有 Doris/StarRocks 等分析底座，其吸引力会明显增加。

## 8. 版本与许可证

截至调研日 SQLBot Latest 为 v1.10.2（2026-09-23）；具体功能和权限需在该版本或后续维护版复核，不能只看 main。[发布记录](https://github.com/dataease/SQLBot/releases)

官方描述为 FIT2CLOUD Open Source License，即在 GPLv3 基础上附加限制，并说明标识/版权要求。本文只记录项目声明，不将其写为纯 GPLv3 或 Apache-2.0；X-Pack 权益另行核实。[许可证说明](https://github.com/dataease/SQLBot)

Doris 是 Apache 项目；本方案模型调用、服务器和同步运维仍有成本。

## 9. 优缺点与采用门槛

优点：现成中文问数及可编辑看板；简单业务配置；已有分析仓库时可快速验证交互。

缺点：跨源查询增加底座；SQLBot 自动看板 Agent 能力不足以直接覆盖全部工作流；免费权限边界及部门共享需验证；Doris JDBC 对大表有限制，FE/BE 有运维成本。

满足以下条件时优先考虑：已有 Doris 或愿意维护统一分析库；多数分析可通过受控业务视图表达；接受先人工组装看板；实际发行版权限和许可证符合团队要求。

## 10. 首轮 PoC 与失败后的选择

先完成：两个独立数据库的跨源视图 → SQLBot 正确识别 → 中文出图 → 加入并编辑看板 → A/B 部门权限与导出检查。

若卡在跨源元数据或权限边界，不先投入复杂 Agent 自动编排。如果必须新增连接器、重做看板写入和大量权限适配，优先转 [方案二](02-superset-trino-agent.md)。

SQLBot 嵌入 DataEase 是另一条集成路径，但官方嵌入说明本身不能证明它自动复用 DataEase 跨源查询，或自动把聊天图表保存为 DataEase 原生看板，因此本次不将两者组合算作已验证捷径。[集成文档](https://dataease.cn/sqlbot/v1/dataease_integration.html)
