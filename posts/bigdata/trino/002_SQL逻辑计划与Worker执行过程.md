# Trino SQL 逻辑计划与 Worker 执行过程

本文沿着一条 SQL，从 Coordinator 的解析与优化一直追踪到 Worker 中的 Driver 和 Operator，重点解释：

- SQL 为什么不是直接发送给每个 Worker；
- Remote Exchange 为什么形成 Stage 边界；
- Task、Driver 和 Split 怎样配合；
- 数据在 Trino 内为什么以 Page 和 Block 传递。

## 一、先看完整链路

```text
SQL Statement
    ↓ Parser
AST（语法树）
    ↓ Analyzer
带类型和表含义的分析结果
    ↓ Logical Planner
Logical Plan
    ↓ Rule Optimizer + CBO
优化后的 Plan
    ↓ Fragmenter
Plan Fragment / Stage
    ↓ Scheduler
Task 部署到 Worker
    ↓
Driver 执行 Operator 流水线
    ↓
Page 在 Operator 与 Exchange 之间流动
```

SQL 文本只表达“想要什么结果”，Coordinator 必须结合 Catalog、Connector 能力和统计信息决定“怎样得到结果”。

## 二、用一条 SQL 贯穿全文

```sql
SELECT c.region, sum(o.amount) AS total_amount
FROM iceberg.sales.orders o
JOIN mysql.crm.customers c
  ON o.user_id = c.user_id
WHERE o.order_date = DATE '2026-09-12'
  AND c.level = 'VIP'
GROUP BY c.region;
```

这条 SQL 同时访问：

- Iceberg Catalog 中的订单表；
- MySQL Catalog 中的客户表；
- 两边的过滤；
- 按 `user_id` 连接；
- 按 `region` 聚合。

它很适合观察 Trino 怎样把声明式 SQL 转换成跨数据源的分布式执行。

## 三、Parser：先判断 SQL 写了什么

Parser 把字符串转换成抽象语法树 AST：

```text
Query
├── Select
│   ├── c.region
│   └── sum(o.amount)
├── Join
│   ├── iceberg.sales.orders o
│   ├── mysql.crm.customers c
│   └── o.user_id = c.user_id
├── Where
└── Group By c.region
```

此时主要知道语法结构，还没有完全确定：

- `orders` 对应哪个 Connector Table Handle；
- `amount` 的具体类型；
- 用户是否有权限读取；
- 哪些条件可以下推；
- Join 应该广播还是重分区。

语法错误会在这一阶段或分析早期直接失败，不会产生 Worker Task。

## 四、Analyzer：给名字和表达式赋予含义

Analyzer 会解析 Session 中的 Catalog、Schema、用户身份和函数，完成：

1. 把三段式表名解析到具体 Catalog 和 Connector；
2. 向 Connector 获取表、列和类型信息；
3. 解析列引用属于哪张表；
4. 检查函数参数、隐式类型转换和聚合规则；
5. 执行访问控制检查；
6. 建立字段与表达式之间的语义关系。

例如 `sum(o.amount)` 是否合法取决于 `amount` 的类型；`c.level` 是否存在取决于 MySQL Connector 返回的元数据。

因此，Connector 不只是 Worker 读数据时才参与。Coordinator 在分析和优化阶段就已经通过 Connector 获取元数据和统计信息。

## 五、Logical Plan：把 SQL 变成关系算子树

简化后的初始逻辑计划可能是：

```text
Aggregation [region, sum(amount)]
└── Join [orders.user_id = customers.user_id]
    ├── Filter [order_date = 2026-09-12]
    │   └── TableScan [iceberg.sales.orders]
    └── Filter [level = 'VIP']
        └── TableScan [mysql.crm.customers]
```

Logical Plan 描述算子之间的数据关系，还不是 Worker 上最终运行的线程或 Task。

与 Spark 的 Transformation DAG 类似，这个阶段首先建立“数据从哪里来、经过哪些操作”的描述；但 Trino 的入口是 SQL 关系计划，不是用户创建的一系列 RDD 对象。

## 六、Optimizer：改写成成本更低的计划

优化器会进行规则优化和基于成本的优化。常见动作包括：

- 把过滤条件尽量推向 TableScan；
- 只读取查询需要的列；
- 合并或简化表达式；
- 根据统计信息调整 Join 顺序；
- 选择 Join 的 build side 和 probe side；
- 在 broadcast 与 partitioned Join 之间选择；
- 把部分聚合放到数据源附近；
- 请求 Connector 执行 predicate、projection、aggregation、join、limit 或 Top-N 下推；
- 在合适场景生成 Dynamic Filter。

优化后的概念计划可能变成：

```text
FinalAggregation [region, sum]
└── RepartitionExchange [hash(region)]
    └── PartialAggregation [region, sum(amount)]
        └── Join [user_id]
            ├── IcebergScan [日期过滤、列裁剪]
            └── MySQLScan [level='VIP' 已下推]
```

能否完成下推不是 Trino Optimizer 单方面决定的。Optimizer 会提出约束，Connector 根据数据源能力返回“已经接受哪些、还剩哪些必须由 Trino 执行”。

统计信息缺失或严重不准确时，CBO 可能无法正确估算行数，进而选错 Join 顺序或广播侧。

## 七、Plan Fragment 与 Stage

单机 Operator 可以在本地流水执行，但某些操作必须改变数据分布：

- 按 Join Key 把相同 key 发送到同一位置；
- 按 Group By Key 重分区；
- 把小表复制到所有 Join Worker；
- 把最终结果汇聚到一个输出位置。

这些跨节点边界由 **Remote Exchange** 表达。Coordinator 会在 Remote Exchange 处把计划切成 Plan Fragment，并在运行时形成 Stage。

```text
Stage 0：Final Output
└── Remote Exchange [GATHER]
    │
    └── Stage 1：Final Aggregation
        └── Remote Exchange [REPARTITION BY region]
            │
            └── Stage 2：Join + Partial Aggregation
                ├── Remote Exchange [REPARTITION/BROADCAST customers]
                │   └── Stage 3：MySQL Scan
                └── Iceberg Scan
```

需要注意：

- Stage 是 Coordinator 侧的分布式计划片段，本身不在 Worker 上执行；
- 一个 Stage 会创建多个 Task 分布到 Worker；
- Local Exchange 只调整同一 Task/节点内部的并行数据流，通常不会形成新的远程 Stage；
- Stage 有依赖关系，但默认流水线执行时不一定要等整个上游 Stage 全部结束，数据可以边产生边传输。

## 八、Task：一个 Stage 在 Worker 上的执行实例

假设 Stage 2 在三个 Worker 上执行：

```text
Stage 2
├── Task 2.0 → Worker A
├── Task 2.1 → Worker B
└── Task 2.2 → Worker C
```

每个 Task 具有：

- 该 Stage 的 Plan Fragment；
- 分配给它的 Source Split；
- 来自上游 Stage 的 Exchange 输入；
- 一个或多个 Driver/Pipeline；
- 输入、输出和 Exchange Buffer；
- 内存、CPU、Blocked Time 等运行统计；
- Task 状态与失败信息。

同一 Worker 可以同时运行多个 Stage、多个 Query 的 Task，Task 不是独占 Worker 的进程。

## 九、Split：Connector 提供的扫描工作片段

Coordinator 向 Connector 请求可扫描的 Splits。Split 是 Connector 对“一份可以独立调度的输入工作”的描述：

```text
Iceberg Split 可能对应：某个 Parquet 文件的一段扫描范围
Hive Split    可能对应：某个文件或文件片段
Kafka Split   可能对应：某个 Topic Partition 的范围
JDBC Split    可能对应：数据源实现提供的一段查询工作
```

Split 不等于固定大小的文件，也不等于 Trino Task：

```text
一个 Task 可以先后处理多个 Split
一个 Split 通常只由一个 Source Driver 处理
不同 Connector 自己决定怎样产生 Split
```

Split 主要携带定位和读取输入所需的信息，而不是把全部业务数据封装后从 Coordinator 发送给 Worker。Worker 拿到 Split 后，使用 Connector 直接读取数据源。

## 十、Driver：运行 Operator 的本地流水线

Task 根据计划创建 Driver。一个 Source Driver 可以表示：

```text
Split
  ↓
TableScan Operator
  ↓
FilterAndProject Operator
  ↓
PartialAggregation Operator
  ↓
ExchangeSink Operator
```

Driver 中的 Operator 在同一个本地流水线上协作：上游产生一批数据，下游立即消费，不需要把每个算子的完整结果都写成临时文件。

一个复杂 Task 可能包含多种 Pipeline。例如 Hash Join 至少要区分：

```text
Build Pipeline：读取小表 → 构建 Hash Table
Probe Pipeline：读取大表 → 查询 Hash Table → 输出匹配结果
```

因此，“一个 Task 只有一条 Driver 链”也是过度简化。更准确地说，Task 根据 Fragment 创建若干 Pipeline，每种 Pipeline 可以有一个或多个 Driver 实例。

## 十一、Page 与 Block：数据怎样在 Operator 间传递

Trino 不以一个个普通 Java Row 对象作为主要内部交换单位，而使用列式批次：

```text
Page
├── Block 0：order_id 列的一批值
├── Block 1：user_id 列的一批值
└── Block 2：amount 列的一批值
```

- Page 表示一批行；
- 每个 Block 保存 Page 中某一列的数据；
- Operator 消费 Page，再产生新的 Page；
- ConnectorPageSource 把外部数据转换成 Page；
- ConnectorPageSink 接收 Page 并写入外部系统。

批量、列式处理可以减少逐行对象分配，并为字典编码、惰性读取和向量化处理提供基础。但 Page 仍会占用 Worker 内存，大量 Buffer、Hash Table 和聚合状态仍可能导致内存压力。

## 十二、一条 Split 在 Worker 中怎样完成

```text
1. Coordinator 把 Iceberg Split 分配给 Worker A 的 Task 2.0
2. Task 把 Split 交给 Source Driver
3. Iceberg Connector 创建 PageSource
4. PageSource 读取 Parquet 的必要列和行组
5. 产生 Page
6. Filter/Project 继续过滤和计算表达式
7. PartialAggregation 做本地预聚合
8. ExchangeSink 按 region 计算目标分区
9. Page 发送给下游 Stage 的 Task
```

如果 Connector 已完成日期过滤或列裁剪，Worker 就不需要读入无关数据。如果下推失败，更多数据会进入 Trino，增加数据源 I/O、网络、CPU 和内存消耗。

## 十三、怎样查看计划

### 13.1 EXPLAIN

```sql
EXPLAIN
SELECT region, sum(amount)
FROM iceberg.sales.orders
GROUP BY region;
```

`EXPLAIN` 查看计划而不真正执行查询。常见类型包括：

```sql
EXPLAIN (TYPE LOGICAL) ...;
EXPLAIN (TYPE DISTRIBUTED) ...;
EXPLAIN (TYPE IO) ...;
EXPLAIN (TYPE VALIDATE) ...;
```

重点观察：

- TableScan 实际读取哪些列和约束；
- Filter 是否仍在 Trino 中；
- Fragment/Stage 在哪里被 Remote Exchange 切开；
- Exchange 是 GATHER、REPARTITION 还是 REPLICATE；
- Join 哪边是 build、哪边是 probe；
- 聚合是否有 partial/final 两层。

### 13.2 EXPLAIN ANALYZE

```sql
EXPLAIN ANALYZE
SELECT region, sum(amount)
FROM iceberg.sales.orders
GROUP BY region;
```

`EXPLAIN ANALYZE` 会真实执行查询，并给出各 Fragment/Operator 的输入行数、输出行数、CPU、Scheduled、Blocked 等统计。生产环境使用时要记住：它不是只看计划，昂贵查询仍然会真实消耗资源。

## 十四、常见误解

### SQL 会被广播到所有 Worker 各自执行

不是。SQL 由 Coordinator 统一分析和优化，再把 Plan Fragment 对应的 Task 部署到 Worker。

### Stage 就是一个运行线程

不是。Stage 是分布式计划片段；它通过多个 Task 执行，每个 Task 中还有多个 Driver。

### 一个 Split 就是一个 Task

不是。Split 是输入工作片段，Task 是 Stage 在 Worker 上的执行实例，一个 Task 可以处理多个 Split。

### Driver 是 Coordinator 或 JDBC Driver

不是。这里的 Driver 是 Task 内的 Operator 执行流水线。

### 每个 SQL 算子都会形成一个 Stage

不是。Filter、Project、部分聚合等可以在同一 Pipeline 中。通常 Remote Exchange 才是分布式 Fragment/Stage 的主要边界。

## 十五、最终心智模型

```text
Coordinator 把 SQL 变成关系计划
        ↓
Optimizer 结合统计信息和 Connector 能力优化
        ↓
Remote Exchange 把计划切成多个 Fragment / Stage
        ↓
每个 Stage 在 Worker 上创建多个 Task
        ↓
Task 内创建 Driver/Pipeline
        ↓
Source Driver 消费 Connector Split
        ↓
Operator 以 Page/Block 形式流水处理数据
        ↓
Exchange 把 Page 发送给下游 Stage
```

## 参考资料

- [Trino concepts](https://trino.io/docs/current/overview/concepts.html)
- [EXPLAIN](https://trino.io/docs/current/sql/explain.html)
- [Query optimizer](https://trino.io/docs/current/optimizer.html)
- [Connector development](https://trino.io/docs/current/develop/connectors.html)

