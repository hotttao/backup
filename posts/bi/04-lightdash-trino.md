# 方案四：Lightdash＋Trino（商业 Agent 有条件的对照方案）

调研日期：2026-10-15。定位：语义与 UI 较完整、技术栈贴近 Node.js，但不能当成“原生 AI 能力全部免费开源”的方案。

你说“不需要费用计费”，这里理解为不建设计费模块；这不等于已明确禁止购买软件授权。由于项目目标是开源 BI，本方案单独标清开源核心和商业功能，不擅自假设已有采购预算。

## 1. 架构

~~~text
内部用户
  -> Lightdash UI / 具备授权的 AI Agent
  -> Lightdash YAML 或 dbt 项目中的模型、指标和权限
  -> Trino
  -> MySQL A + MySQL B / PostgreSQL

旁路：自建 Agent 也可评估使用公开支持的接口，
但不能默认企业 MCP 或其内部服务属于免费核心。
~~~

Lightdash 是 TypeScript/React/Node.js 技术栈，有 PostgreSQL 元数据库，支持 Trino 等查询底座。当前仓库还描述了独立 Lightdash YAML 建模，因此不应只根据旧资料认定任何用法都必须建立完整 dbt 转换链路。[官方仓库](https://github.com/lightdash/lightdash)

## 2. 数据源与跨源查询

官方当前列出 Trino、PostgreSQL、ClickHouse、DuckDB、BigQuery、Snowflake 等仓库/引擎；本次不认定其有原生 MySQL 分析适配器。MySQL 的路径是通过 Trino 接入。

多个 Lightdash 项目或连接不自动合并查询。跨 MySQL、PostgreSQL 的关联应由 Trino catalog 和经过建模的查询完成，Lightdash 消费统一的业务模型。[支持范围](https://www.lightdash.com/pricing)、[Trino 概念](https://trino.io/docs/current/overview/concepts.html)

多 catalog 元数据发现、Lightdash 模型指向跨源视图和生成 SQL 的完整链路仍需 PoC，不能由“支持 Trino”直接推断零配置成功。

## 3. UI、Agent 与免费边界

| 能力 | 判断 |
| --- | --- |
| BI 浏览、图表、仪表盘 UI | 有开源核心 |
| 模型、指标与维度配置 | 有，以对应版本格式为准 |
| 自托管 | 有 Docker/Helm 路线 |
| 自托管内置 AI agents | 企业功能，需要许可证及功能配置 |
| 自托管原生 MCP | 企业功能，需要许可证及功能配置 |
| 用第三方 Agent 完全补齐聊天、出图、入看板 | 是二次开发方向，本次未验证 |
| Chat 图表一键加入指定看板、保留可编辑状态 | 必须按实际套餐和版本验收，不能只依据产品宣传判定 |

官方自托管企业文档明确列出 AI agents、MCP 和各自启用条件；仅配置模型密钥或打开环境开关不等于拥有合法可用的企业授权。[企业功能](https://docs.lightdash.com/self-host/enterprise-features)

核心许可证为 MIT，企业目录另有许可证；不能因为代码仓库公开就把该目录算成相同授权范围。[LICENSE](https://github.com/lightdash/lightdash/blob/main/LICENSE)

## 4. 部门隔离与多租户

Lightdash 有组织、项目、空间、角色及用户属性等概念。它们能够构成内部部门隔离方案，但需要按套餐核实用户组、自定义角色和嵌入等能力。[角色](https://docs.lightdash.com/workspace-admin/roles)、[套餐边界](https://www.lightdash.com/pricing)

用户属性可以参与模型级 sql_filter、成员访问规则等。特别需要注意：官方明确说明可编辑图表/看板中的筛选本身不是安全边界；原始 SQL 路径也不自动继承语义层限制。因此给 Agent 开放原始 SQL、MCP Run SQL 或 SQL Runner 时，仍需底层凭据与权限保护。[用户属性及限制](https://docs.lightdash.com/workspace-admin/user-attributes)

多租户判断：适合内部逻辑隔离的评估，不据此承诺开源版免费提供完整客户级多租户产品；不需要建设计费。

## 5. 部署、使用复杂度

自托管最少包括 Lightdash 应用、元数据库和数据查询底座；生产文档还要求配置对象存储。使用企业 Agent、调度或其他功能时，按文档增加相应服务。官方推荐 Helm，也提供 Docker Compose 路线，不强制首次验证就上 Kubernetes。[部署文档](https://docs.lightdash.com/self-host/self-host-lightdash)

开发语言与你的背景接近，但还需学习数据建模、项目编译、仓库权限和版本管理。它不会因使用 Node.js 就天然比 Python BI 更轻。

前一轮引用了 2.574.0；2026-10-16 源码复核下载的 main 已声明 2.589.3，因此 2.574.0 不再作为当前 latest 判断。复核还发现社区结果组合执行器和受商业门控的额外连接，详见 [07 源码比较](07-bi-source-comparison.md)。在线文档、源码、镜像及套餐边界仍需逐项固定和验证。[本次源码快照](https://github.com/lightdash/lightdash/tree/87c74eeeda04800c2111e0f2900c972d04ee242b)

## 6. 优缺点与选用条件

优点：完整 BI UI；业务模型与代码工作流清楚；Node.js/TypeScript 技术栈贴近；如果接受商业授权，可减少部分 Agent 平台开发。

缺点：核心 AI、MCP 有商业边界；MySQL 需要额外查询底座；部门权限要审查语义与原始 SQL 两条路径；重新开发外部 Agent 可能抵消现成平台收益。

本次不把它列为首选。若后续明确接受企业授权，并且实测聊天图表入看板与部门隔离满足要求，应与 [方案二](02-superset-trino-agent.md) 重新比较总成本，而不是仅比较许可证费用。

## 7. 验证项目

先在对应授权和固定版本中验证：Trino 跨源模型发现；中文提问；图表入指定仪表盘；后续手工编辑；无权限部门通过 Agent、SQL Runner、导出和共享链接均无法读取数据。未完成这些验证前，本方案标为“有条件候选”。
