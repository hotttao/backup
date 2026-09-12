# Trino Exchange、聚合与 Join 执行过程

Trino Worker 可以并行扫描数据，但下面这些操作不能只在本地完成：

- `GROUP BY user_id` 要把相同用户的数据聚到一起；
- 大表 Join 要让相同 Join Key 的两侧数据到达同一 Task；
- 广播 Join 要把小表复制给处理大表的 Worker；
- 最终查询结果要汇聚到输出 Stage。

这些数据分布变化由 Exchange 完成。本文使用订单与用户表的 Join 贯穿整个过程。

## 一、先看完整查询

```sql
SELECT c.region, sum(o.amount) AS total_amount
FROM iceberg.sales.orders o
JOIN iceberg.sales.customers c
  ON o.user_id = c.user_id
WHERE o.order_date = DATE '2026-09-12'
GROUP BY c.region;
```

假设：

- `orders` 是 10 TB 订单事实表；
- 日期过滤后还有 200 GB；
- `customers` 是 50 MB 用户维度表；
- 两张表都分布在多个文件和 Split 中。

一种可能的计划是广播用户表：

```text
Orders Scan ───────────────────────────────┐
                                          ├─ Broadcast Hash Join
Customers Scan → Remote Exchange(REPLICATE)┘
        ↓
Partial Aggregation by region
        ↓
Remote Exchange(REPARTITION by region)
        ↓
Final Aggregation
        ↓
Remote Exchange(GATHER)
        ↓
Client
```

## 二、Exchange 到底是什么

Exchange 是 Trino 执行计划中改变数据位置或分布方式的节点。

### 2.1 Local Exchange

Local Exchange 在一个 Worker/Task 内部重新组织 Page，例如把多个 Source Driver 的输出按 hash 分给本地聚合 Driver。

```text
同一个 Task
Driver 0 ─┐
Driver 1 ─┼─ Local Exchange ─→ Driver A / Driver B
Driver 2 ─┘
```

它主要协调本地 Pipeline 的并行度和数据分布，不需要把数据发送到其他 Worker，也通常不会单独形成远程 Stage。

### 2.2 Remote Exchange

Remote Exchange 在不同 Stage、不同 Worker 的 Task 之间传递数据：

```text
Stage 2 / Worker A / Task 2.0 ─┐
Stage 2 / Worker B / Task 2.1 ─┼─ 网络 Exchange ─→ Stage 1 Tasks
Stage 2 / Worker C / Task 2.2 ─┘
```

上游 Task 把 Page 写入输出 Buffer，下游 Task 的 Exchange Client 持续拉取数据。Remote Exchange 是分布式计划切分 Stage 的主要边界。

## 三、三种常见数据分布

### 3.1 GATHER：汇聚

把多个上游分区的数据送到较少的下游位置，最终结果输出是典型场景：

```text
Task A ─┐
Task B ─┼─ GATHER → Root Task → Client
Task C ─┘
```

如果中间过程过早汇聚到单个 Task，可能失去并行度，形成瓶颈。

### 3.2 REPARTITION：按 key 重分区

每条数据根据 key 计算目标分区：

```text
partition_id = hash(user_id) % partition_count
```

```text
user_id=U01 ──→ Partition 0
user_id=U02 ──→ Partition 2
user_id=U01 ──→ Partition 0
```

这样，相同 key 会到达同一分区，Join 或最终聚合才能得到完整结果。

### 3.3 REPLICATE：广播

把一侧的全部数据复制给所有参与 Join 的下游 Task：

```text
Customers 50 MB
├── 完整副本 → Worker A
├── 完整副本 → Worker B
└── 完整副本 → Worker C
```

广播避免了大表重分区，但每个参与 Worker 都需要保存一份 build-side Hash Table，所以只适合过滤后足够小的数据。

## 四、Partial 与 Final Aggregation

假设订单分布在三个 Worker：

```text
Worker A: 华东 100 + 华北 20
Worker B: 华东 80  + 华南 50
Worker C: 华东 40  + 华北 30
```

如果把所有原始订单都通过网络发送给最终聚合，网络量很大。Trino 可以先做 Partial Aggregation：

```text
Worker A: 华东 100, 华北 20
Worker B: 华东 80,  华南 50
Worker C: 华东 40,  华北 30
               ↓ REPARTITION(region)
Final: 华东 220, 华北 50, 华南 50
```

Partial Aggregation 的作用与 Spark 中的 Map 端预聚合相似：先在数据本地合并，再发送更少的中间记录。但是否能有效减少数据取决于聚合基数：

- `GROUP BY region` 的 key 很少，预聚合收益通常很高；
- `GROUP BY order_id` 几乎每行一个 key，预聚合可能很难减少数据量。

聚合需要维护 Hash Table 或其他状态，分组基数越高，内存压力通常越大。

## 五、Hash Join 的 build 与 probe

Trino 常用 Hash Join。它包含两个角色：

```text
Build side：读取一侧数据，按 Join Key 构建 Hash Table
Probe side：逐批读取另一侧数据，到 Hash Table 中查找匹配项
```

假设用户表作为 build side：

```text
customers
    ↓
Hash Table
U01 → 华东
U02 → 华北
U03 → 华南
    ↑
orders 的 user_id 逐条 probe
```

通常希望过滤后较小的一侧成为 build side，因为 Hash Table 需要保留在内存中。CBO 会依据 Connector 提供的行数、数据大小和列统计选择 Join 顺序与两侧角色。

## 六、Broadcast Join 的完整过程

当 `customers` 过滤后足够小时，可以使用广播：

```text
Stage Customers Scan
        ↓
REPLICATE Exchange
        ↓
每个 Join Task 获得完整 customers
        ↓
每个 Join Task 构建相同的 customers Hash Table
        ↓
各自 probe 本地收到的 orders
```

优点：

- 不需要对巨大的 orders 重新按 `user_id` 分区；
- 大表扫描结果可以直接进入本地 Join；
- 小表很小时通常延迟低。

代价：

- 小表被复制多份，网络量约随下游并行度增加；
- 每个参与 Worker 都要为完整 build side 分配内存；
- 统计估算错误时，原以为很小的表可能撑爆 Worker 内存。

因此，判断广播是否安全要看**过滤后的 build side 大小**和参与节点数，而不是只看原表名称是不是“维度表”。

## 七、Partitioned Join 的完整过程

当两侧都很大时，通常采用 Partitioned Join：

```text
orders    → hash(user_id) ─┐
                           ├─ 相同分区进入同一 Join Task
customers → hash(user_id) ─┘
```

每个 Join Task 只构建 customers 的一个分区 Hash Table，再 probe orders 的对应分区：

```text
Join Task 0：build customers partition 0 + probe orders partition 0
Join Task 1：build customers partition 1 + probe orders partition 1
Join Task 2：build customers partition 2 + probe orders partition 2
```

优点：

- build side 总体可以大于单个 Worker 的可用内存；
- Hash Table 分散到多个 Worker。

代价：

- 两侧通常都要经过网络重分区；
- 更依赖网络吞吐；
- Join Key 倾斜会让少数分区异常大。

## 八、Dynamic Filtering 为什么能少读大表

考虑查询：

```sql
SELECT count(*)
FROM iceberg.sales.orders o
JOIN mysql.crm.customers c
  ON o.user_id = c.user_id
WHERE c.region = '华东';
```

静态优化阶段并不知道华东用户具体有哪些 `user_id`。运行时先处理 build side 后，可以收集候选值：

```text
customers 过滤结果：U01、U07、U09
        ↓ 生成 Dynamic Filter
orders.user_id IN (U01, U07, U09)
        ↓ 传给 orders 的扫描侧
尽量跳过不可能匹配的分区、文件、行组或记录
```

Dynamic Filter 的关键作用不是让 Join 匹配更正确，而是让 probe-side Scan 提前少读数据。

实际能减少多少 I/O 取决于：

- build side 是否足够快地产生过滤值；
- 候选值是否足够少、选择性是否高；
- probe-side Connector 是否支持并有效利用动态过滤；
- 数据源是否有分区、文件统计、索引等可供剪枝；
- 扫描是否已经在 Dynamic Filter 到达前完成很多工作。

Dynamic Filtering 与静态 Predicate Pushdown 不同：静态谓词来自 SQL 本身，动态过滤值来自 Join build side 的运行结果。

## 九、Exchange 为什么会产生反压和 Blocked Time

Remote Exchange 是有界 Buffer，不可能无限接收数据。如果下游处理速度跟不上：

```text
下游 Join / Aggregation 变慢
        ↓
下游拉取 Exchange 数据变慢
        ↓
上游输出 Buffer 逐渐占满
        ↓
上游 Driver 被阻塞
        ↓
扫描速度也随之下降
```

这是一种流量控制，不一定是故障。Web UI 中较高的 Blocked Time 需要结合阻塞原因判断：

- 等待上游数据可能是输入慢；
- 等待下游消费可能是 Exchange 背压；
- 等待内存可能是 Hash Table 或聚合状态过大；
- 等待 Dynamic Filter 可能是在等待 build side。

不能仅凭 Blocked Time 高就断定 CPU 性能差。

## 十、数据倾斜怎样影响 Exchange

如果 40% 的订单都使用同一个特殊 `user_id`：

```text
hash(UNKNOWN) → Partition 2
```

那么 Partition 2 会远大于其他分区：

```text
Task 0：20 GB
Task 1：18 GB
Task 2：160 GB  ← 长尾、内存风险
Task 3：22 GB
```

表现通常包括：

- 一个或少数 Task 的输入行数远高于平均值；
- 大部分 Task 已结束，少数 Task 长时间运行；
- Join build 或聚合内存集中；
- 某个 Worker 的 CPU、GC、网络或 Spill 异常高。

处理前应先确认倾斜来自业务 key、`NULL`、默认值，还是 Connector Split 分布不均。可选手段包括预过滤异常 key、业务允许时拆分热点、提前聚合、改善表布局或调整 Join 策略；不能仅靠增加 Worker 保证解决单个热点分区。

## 十一、Exchange 与 Spark Shuffle 的区别

| 维度 | Spark Shuffle | Trino 默认 Remote Exchange |
|---|---|---|
| 主要边界 | 切分 Spark Stage | 切分 Trino Plan Fragment/Stage |
| 默认中间结果 | Shuffle 文件可供下游拉取 | Worker 内存 Buffer + HTTP 网络传输 |
| 上下游关系 | 下游 Stage 通常等待上游 Map 输出可用 | 多个 Stage 可以流水并发传输 |
| Worker 失败 | 可以重算丢失的 Shuffle 分区/Task | 默认通常导致整个 Query 失败 |
| 主要优化目标 | 通用批处理吞吐和重算 | 低延迟 SQL 流水线 |

二者都需要按 key 分区，也都会遇到网络、序列化、倾斜和内存问题，但不能把 Trino Exchange 简单理解为“换了名字的 Spark Shuffle”。

## 十二、Fault-tolerant Execution 怎样改变 Exchange

启用 Fault-tolerant Execution（FTE）并配置 Exchange Manager 后，中间 Exchange 数据可以写入外部存储：

```text
上游 Stage
    ↓
外部 Exchange Storage（S3 / HDFS 等）
    ↓
下游 Stage
```

这样 Worker 故障后，已完成 Stage/Task 的输出可以被重新使用，并按配置重试 Query 或 Task。代价是：

- 多一次外部存储读写；
- 更高的查询延迟和存储成本；
- 需要 Connector 支持相应的查询重试语义；
- 调度和 Task 粒度与默认低延迟模式不同。

`retry-policy=TASK` 更适合大型批查询，并要求配置 Exchange Manager；大量短小交互式查询通常更关心低延迟，未必适合使用相同集群配置。

## 十三、怎样诊断 Join 与 Exchange

建议按下面顺序检查：

1. `EXPLAIN`：Join 是 broadcast 还是 partitioned，哪边是 build；
2. `EXPLAIN ANALYZE`：各 Operator 的实际输入输出行数是否符合估算；
3. Connector 统计信息是否存在、是否过期；
4. Dynamic Filter 是否生成并被 Scan 使用；
5. Exchange 输入输出字节是否异常大；
6. Task 数据量是否均匀，是否存在长尾；
7. build-side Hash Table 是否超过内存预期；
8. Filter 和 Partial Aggregation 是否尽量发生在 Exchange 之前；
9. 大量 Blocked Time 是等待网络、输入、内存还是 build side；
10. FTE 的外部 Exchange 存储是否出现吞吐或延迟瓶颈。

## 十四、常见误解

### Broadcast Join 不会发生网络传输

不是。它避免了大表重分区，但需要把 build side 复制到所有参与 Join 的位置。

### Partitioned Join 不需要 Hash Table

不是。每个 Task 仍会为自己收到的 build 分区构建 Hash Table，只是完整 build side 被分散了。

### Dynamic Filter 等于普通 WHERE 条件

不是。它在 Join 运行期间根据 build side 的实际值生成，并尝试反馈给 probe-side Scan。

### Partial Aggregation 已经得到最终结果

不是。相同 key 可能存在于多个 Worker，必须经过 Exchange 后由 Final Aggregation 合并。

### Exchange 一定会完整落盘

不是。Trino 默认执行以网络和内存 Buffer 流水传输；FTE 或旧式 Spill 场景才会引入相应的磁盘/外部存储数据。

## 十五、最终心智模型

```text
本地能完成的 Filter / Project / Partial Aggregation
        ↓
Exchange 改变数据分布
        ↓
GATHER：汇聚结果
REPARTITION：相同 key 到同一分区
REPLICATE：复制小表
        ↓
下游完成 Final Aggregation 或 Hash Join
```

## 参考资料

- [Trino concepts: Exchange](https://trino.io/docs/current/overview/concepts.html)
- [Cost-based optimizations](https://trino.io/docs/current/optimizer/cost-based-optimizations.html)
- [Dynamic filtering](https://trino.io/docs/current/admin/dynamic-filtering.html)
- [Exchange properties](https://trino.io/docs/current/admin/properties-exchange.html)
- [Fault-tolerant execution](https://trino.io/docs/current/admin/fault-tolerant-execution.html)

