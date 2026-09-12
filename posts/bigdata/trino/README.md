# Trino 学习路线

这组文章沿用 `spark` 目录的叙述逻辑：先观察一次查询运行时有哪些组件，再沿着 SQL 向下追踪逻辑计划、Stage、Task、Driver 和数据交换，随后理解 Connector、联邦查询、内存、容错和性能诊断。

1. [Trino 查询运行架构图](./001_Trino查询运行架构图.md)：Client、Coordinator、Worker 怎样协作，一次 Query 包含哪些运行对象。
2. [SQL 逻辑计划与 Worker 执行过程](./002_SQL逻辑计划与Worker执行过程.md)：SQL 怎样变成 Stage、Task、Driver 和 Operator，Split 又是什么。
3. [Exchange、聚合与 Join 执行过程](./003_Exchange聚合与Join执行过程.md)：数据为什么需要重分布，广播 Join、分区 Join、动态过滤怎样工作。
4. [Connector、Catalog 与联邦查询](./004_ConnectorCatalog与联邦查询.md)：Trino 怎样访问不同数据源，下推为什么取决于 Connector。
5. [内存、容错与性能诊断](./005_内存容错与性能诊断.md)：Hash Table、聚合、排序怎样消耗内存，默认执行与 Fault-tolerant Execution 有何不同。

阅读时始终抓住四条主线：

```text
计划主线：SQL → AST → Logical Plan → Distributed Plan → Stage
执行主线：Stage → Task → Driver → Operator
数据主线：Connector → Split → Page → Exchange → 下游 Operator
优化主线：统计信息 → CBO → 下推 / Join 顺序 / Join 分布 / Dynamic Filter
```

与 Spark 对照时先记住：

```text
Spark：围绕 Application、Job、Stage、Task 组织通用分布式计算
Trino：围绕一次 SQL Query、Stage、Task、Driver 组织交互式查询
```

两者都使用 Stage 和 Task 这些词，但它们不是可以直接一一对应的相同对象。

## 版本说明

本文以 Trino 483 官方文档中的核心概念为基线。Trino 发布频繁，Connector 能力、配置项和默认值会变化，落地时应核对实际部署版本。

## 官方资料

- [Trino concepts](https://trino.io/docs/current/overview/concepts.html)
- [Query optimizer](https://trino.io/docs/current/optimizer.html)
- [Connectors](https://trino.io/docs/current/connector.html)
- [Administration](https://trino.io/docs/current/admin.html)

