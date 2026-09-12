# Trino Connector、Catalog 与联邦查询

Trino 自己不保存业务表。它能够查询数据，是因为 Connector 把各种外部系统适配成 Trino 可以理解的 Schema、Table、Column、Split 和 Page。

本文重点解释：

- `catalog.schema.table` 三段名称分别是什么；
- Connector 在 Coordinator 和 Worker 上各做什么；
- Predicate、Projection、Aggregation 和 Join 下推意味着什么；
- 跨 Iceberg、MySQL 等数据源 Join 时，数据在哪里计算；
- Trino Catalog、Hive Metastore 和 Iceberg Catalog 为什么容易混淆。

## 一、先看一条联邦查询

```sql
SELECT c.region, sum(o.amount) AS total_amount
FROM iceberg.sales.orders o
JOIN mysql.crm.customers c
  ON o.user_id = c.user_id
WHERE o.order_date = DATE '2026-09-12'
  AND c.level = 'VIP'
GROUP BY c.region;
```

用户看见的是一条 SQL，底层实际涉及两套数据系统：

```text
Iceberg 表 / 对象存储：orders
MySQL 数据库：customers
        ↓
两个 Connector 分别读取
        ↓
Page 进入 Trino Worker
        ↓
Trino 执行跨源 Join 和聚合
```

这种由一个查询引擎统一访问多个异构数据源的能力，通常称为联邦查询。

## 二、Catalog、Schema、Table 三段名称

Trino 表的完整名称通常是：

```text
catalog.schema.table
```

例如：

```text
iceberg.sales.orders
│       │     └── 表名
│       └──────── Schema / 数据库命名空间
└──────────────── Trino Catalog 名
```

Catalog 名称来自 Coordinator 和 Worker 上的配置文件名：

```text
etc/catalog/iceberg.properties
            └──────┬──────┘
               Catalog 名
```

配置文件内部指定 Connector：

```properties
connector.name=iceberg
iceberg.catalog.type=rest
iceberg.rest-catalog.uri=http://iceberg-rest:8181
```

同一种 Connector 可以配置多个 Trino Catalog：

```text
iceberg_prod.sales.orders
iceberg_test.sales.orders
```

二者都使用 Iceberg Connector，但连接不同环境、不同 Catalog 服务或不同 Warehouse。

## 三、Connector 不是简单 JDBC Driver

Connector 是 Trino 与外部数据源之间的一组完整接口。读取一张表至少涉及三类职责：

```text
ConnectorMetadata
    → 列出 Schema/Table、解析列、返回统计信息、协商下推

ConnectorSplitManager
    → 把一次表扫描拆成可调度的 Splits

ConnectorPageSourceProvider
    → Worker 根据 Split 读取数据并产生 Page
```

写入还需要类似 `ConnectorPageSinkProvider` 的能力，把 Worker 产生的 Page 写到外部系统，并配合 Connector 的提交语义完成写操作。

Connector 是否支持建表、更新、删除、事务、下推、统计信息、物化视图等能力，取决于具体实现和版本。Trino 提供统一 SQL，不表示所有数据源能力完全相同。

## 四、Coordinator 与 Worker 怎样使用 Connector

### 4.1 Coordinator 侧

Coordinator 使用 Connector 完成控制面工作：

```text
解析 iceberg.sales.orders
        ↓
获取表和列元数据
        ↓
检查表能力与访问权限
        ↓
获取表统计信息供 CBO 使用
        ↓
协商谓词、列、聚合等下推
        ↓
请求可扫描 Splits
        ↓
把 Splits 调度给 Worker Tasks
```

Coordinator 获取的是元数据、句柄和 Split 描述，不应该把整张表数据先拉到自己内存中。

### 4.2 Worker 侧

Worker 使用 Connector 完成数据面工作：

```text
收到 Split + Table Handle + Column Handles
        ↓
Connector 创建 PageSource
        ↓
直接连接对象存储、数据库或消息系统
        ↓
读取并解码数据
        ↓
产生 Trino Page
        ↓
交给 Filter / Join / Aggregation 等 Operator
```

所以外部数据通常是“数据源 → Worker”，不是“数据源 → Coordinator → Worker”。

## 五、不同数据源怎样产生 Split

Split 是 Connector 自己定义的输入工作片段，不同数据源的含义不同。

### 5.1 Iceberg/Hive 一类数据湖 Connector

```text
表元数据
  ↓ 分区、Manifest、文件统计剪枝
Data Files
  ↓ 按文件和可切分范围规划
Splits
```

一个 Split 可能读取一个文件，也可能只读取文件的一部分。文件格式、压缩方式、大小和表格式元数据都会影响 Split 规划。

### 5.2 JDBC 一类数据库 Connector

Connector 会把 Trino 的表、列、约束翻译成远端数据库可以执行的 SQL 或读取操作。能否拆成多个并行 Split 以及怎样拆分，取决于 Connector 和查询形态。

并行度不是越高越好。过多并发连接和大范围扫描可能压垮业务数据库，因此联邦查询必须考虑数据源承载能力。

### 5.3 Kafka 等非传统表数据源

Connector 需要把 Topic、Partition、Offset 和消息字段映射成 Trino 的表与列。对 Trino 来说仍然表现为 Table、Split 和 Page，但底层语义并不因此变成关系数据库。

## 六、Pushdown 到底是什么

Pushdown 表示把原本可能由 Trino Worker 执行的一部分操作交给数据源或 Connector 更早完成。

```text
没有下推：数据源读取大量数据 → 传给 Trino → Trino 过滤/聚合

成功下推：数据源先过滤/聚合 → 只把较少结果传给 Trino
```

常见下推包括：

| 下推类型 | 目标 |
|---|---|
| Predicate Pushdown | 在数据源侧应用 `WHERE`，减少行数 |
| Projection Pushdown | 只读取需要的列 |
| Dereference Pushdown | 对嵌套 `ROW` 只读取需要的字段 |
| Aggregation Pushdown | 在数据源侧先完成部分或全部聚合 |
| Limit Pushdown | 限制数据源返回的行数 |
| Top-N Pushdown | 让数据源完成排序并取前 N 条 |
| Join Pushdown | 让同一数据源完成 Join |

“Connector 支持某种下推”也不代表每一条相关 SQL 都能下推。表达式、数据类型、函数语义、排序规则、NULL 语义和数据源能力都会影响结果。

## 七、Predicate Pushdown 与分区剪枝

查询 Iceberg 表：

```sql
SELECT order_id, amount
FROM iceberg.sales.orders
WHERE order_date = DATE '2026-09-12'
  AND amount > 100;
```

可能依次发生：

```text
Iceberg Partition/Manifest/File 统计剪枝
        ↓ 少读无关文件
Parquet Row Group 统计过滤
        ↓ 少解码无关数据块
Connector 返回 Page
        ↓
Trino 对不能完全下推的剩余条件再次过滤
```

下推不只是把 SQL 字符串原样发给数据源。Connector 会把 Trino 表达式转换成数据源能够正确执行的约束，并告诉 Optimizer 哪部分已经保证生效、哪部分仍需保留。

## 八、联邦 Join 到底在哪里执行

再次看跨源 Join：

```sql
FROM iceberg.sales.orders o
JOIN mysql.crm.customers c
  ON o.user_id = c.user_id
```

因为两张表来自不同 Catalog，通常无法把整个 Join 下推给某一个数据源。典型过程是：

```text
Iceberg Connector → orders Pages ───┐
                                    ├─ Trino Workers 执行 Join
MySQL Connector   → customers Pages ┘
```

如果两张表属于同一个支持 Join Pushdown 的 Connector 和远端系统，Connector 可能把 Join 交给远端数据库执行。但这是一项 Connector 能力和成本决策，不是联邦查询的默认保证。

跨源 Join 的成本可能很高，因为：

- 一侧或两侧的大量数据要从数据源读取到 Trino；
- 需要通过 Exchange 广播或重分区；
- 远端数据库连接数和扫描压力会上升；
- 不同数据源的统计信息质量可能不同；
- 网络带宽和跨区域延迟会成为瓶颈。

因此，“能写出跨源 SQL”不等于“它天然高效”。

## 九、Catalog 这个词为什么容易混淆

### 9.1 Trino Catalog

Trino 查询名称空间的第一段，对应一个 Connector 配置实例：

```text
iceberg.sales.orders
mysql.crm.customers
```

### 9.2 Hive Metastore

Hive Connector 或某些 Iceberg 部署可以使用 Hive Metastore 保存表名、Schema、位置等元数据。它是外部元数据服务，不等于 Trino Catalog 配置文件。

### 9.3 Iceberg Catalog

Iceberg Catalog 负责把 Iceberg 表名定位到当前 Table Metadata，并参与原子提交。实现可以是 REST、Hive Metastore、JDBC、Nessie 等。

完整关系可以是：

```text
Trino Catalog：iceberg_prod
        ↓ 加载
Trino Iceberg Connector
        ↓ 访问
Iceberg REST Catalog
        ↓ 定位
metadata.json
        ↓ 引用
Manifest / Data Files
```

所以“在 Trino 中建一个 Catalog”和“部署一个 Iceberg Catalog 服务”不是同一个动作。

## 十、写入怎样经过 Connector

执行：

```sql
INSERT INTO iceberg.sales.orders
SELECT * FROM mysql.staging.new_orders;
```

简化流程是：

```text
MySQL Connector 读取 new_orders
        ↓ Page
Trino Worker 执行转换和重新分布
        ↓ Page
Iceberg Connector 的 PageSink 写 Data Files
        ↓
各 Writer Task 返回写入片段信息
        ↓
Coordinator 驱动 Connector 提交 Iceberg Snapshot
```

注意两件事：

1. Trino 负责执行 SQL 和传输数据，目标 Connector 负责把结果按目标系统语义提交；
2. 跨数据源写入通常不等于一个覆盖源端和目标端的全局分布式事务。

查询失败后是否留下临时文件、远端事务如何回滚、是否支持 Retry，必须根据具体 Connector 核对。

## 十一、权限控制发生在哪些层

一次查询可能同时经过多层权限：

```text
Client 身份认证
        ↓
Trino System / Catalog Access Control
        ↓
Connector 使用的服务账号或用户委托
        ↓
Hive Metastore / Iceberg Catalog / 数据库权限
        ↓
对象存储或文件系统权限
```

Trino 允许查询某张表，不代表 Worker 使用的对象存储凭证一定能读取文件；反过来，底层服务账号能读文件，也不代表用户应当绕过 Trino 授权读取表。

联邦查询还要关注不同数据源的敏感字段、行列权限和审计是否保持一致。

## 十二、怎样判断下推是否成功

优先使用：

```sql
EXPLAIN
SELECT ...;

EXPLAIN ANALYZE
SELECT ...;
```

判断思路：

- TableScan 中是否只出现需要的列；
- SQL 条件是否进入 Scan 的约束或 Connector 查询；
- 计划中是否仍有独立 Filter、Aggregation、Join、TopN；
- 实际物理输入行数/字节与原表规模相比是否明显减少；
- 数据源监控中实际执行了什么查询；
- Connector 文档是否明确支持当前数据类型和操作的下推。

不能只看最终返回行数。返回 10 行的查询也可能先扫描和传输了数十亿行。

## 十三、常见误解

### Trino Catalog 保存了所有表数据

不是。它是 Connector 配置实例和查询名称空间入口；数据仍在外部系统。

### Connector 只负责建立网络连接

不是。Connector 还负责元数据、统计、Split、PageSource/PageSink、下推和数据源语义适配。

### Trino 支持一种 SQL，所以所有 Connector 都支持

不是。SQL 引擎有这项语法，不代表目标 Connector 和外部系统支持相应读取、写入或下推能力。

### 联邦查询不会移动数据

不是。不能下推的跨源计算通常需要把数据读入 Trino Worker，并通过 Exchange 重新分布。

### Join Pushdown 总是更快

不是。远端系统负载、索引、统计、网络和结果大小都会影响成本，Connector 也必须确保语义正确。

## 十四、最终心智模型

```text
Trino Catalog 选择 Connector 实例
        ↓
Coordinator 通过 Connector 获取元数据、统计和 Splits
        ↓
Worker 通过 ConnectorPageSource 直接读取数据源
        ↓
能下推的操作尽量在数据源侧完成
        ↓
不能下推的操作由 Trino Operator 执行
        ↓
跨源数据通过 Exchange 在 Worker 间重新分布
        ↓
写入由目标 Connector 按目标系统的提交语义完成
```

## 参考资料

- [Trino connectors](https://trino.io/docs/current/connector.html)
- [Connector development](https://trino.io/docs/current/develop/connectors.html)
- [Pushdown](https://trino.io/docs/current/optimizer/pushdown.html)
- [Cost-based optimizations](https://trino.io/docs/current/optimizer/cost-based-optimizations.html)

