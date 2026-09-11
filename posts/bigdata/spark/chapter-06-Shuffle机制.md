# 第六章：把 Spark Shuffle 的完整过程讲清楚

> 本章要回答三个具体问题：
>
> 1. 不需要 combine 时，Shuffle Writer 怎样确定一条 record 属于哪个下游分区？
> 2. combine 到底合并什么、在哪里合并、为什么能减少网络传输？
> 3. spill 是什么，它发生后 Task、Stage 和分区是否会变化？

## 一、先建立完整认识

Shuffle 的本质是：**上游数据原来按照输入文件或旧分区存放，现在需要按照新的分区规则重新组织，使具有某种关系的数据进入同一个下游分区。**

以 `reduceByKey` 为例：

```python
result = pairs.reduceByKey(lambda x, y: x + y, numPartitions=2)
```

如果相同 key 分散在多个上游分区，任何一个上游 Task 都不可能独立算出最终结果。Spark 必须把相同 key 的数据重新发送到同一个下游分区：

```text
上游分区 0：a、b、c ─┐
上游分区 1：a、c、d ─┼─ 按 key 重新分区 ─> 下游分区 0、1
上游分区 2：b、c、e ─┘
```

这次跨分区重组会形成一个 ShuffleDependency，也是一个 Stage 边界。

完整 Shuffle 分成两半：

```text
上游 Stage：Shuffle Write

读取上游 partition
    → 计算每条 record 的目标 partitionId
    → 可选 map-side combine
    → 可选 key 排序
    → 内存不足时 spill
    → 写本地 Shuffle 数据文件和索引
    → 向 Driver 报告 MapStatus

                         Stage 边界

下游 Stage：Shuffle Read

创建一个对应目标分区的下游 Task
    → 找到所有上游 Map 输出的位置
    → 拉取自己负责的 Shuffle block
    → 反序列化
    → 可选 reduce-side 聚合和排序
    → 内存不足时 spill
    → 把结果作为 iterator 交给下游算子
```

理解 Shuffle 时必须把四件事分开：

| 概念 | 解决的问题 | 是否必然发生 |
|---|---|---|
| partition | 一条 record 应该交给哪个下游 Task | 是 |
| combine | 是否能在 Map 端先合并相同 key | 否 |
| sort | 是否要求分区内的 key 具有顺序 | 否；但 Writer 可能为组织文件而按 partitionId 排列 |
| spill | Task 的内存结构放不下时如何继续处理 | 内存不足时才发生 |

下面分别展开。

---

## 二、Shuffle 为什么会切分 Stage

### 2.1 窄依赖可以流水线执行

例如：

```python
rdd.map(parse).filter(valid).map(transform)
```

一个下游分区只依赖一个上游分区。Spark 可以把这些算子放进同一个 Task，以 iterator 流水线执行：

```text
读取一条 → parse → filter → transform → 继续下一条
```

中间不需要把整个数据集写到磁盘，也不需要等待其他上游 Task。

### 2.2 Shuffle 依赖必须重新组织数据

`reduceByKey`、`groupByKey`、`repartition`、`sortByKey` 以及大表 Join，都可能使一个下游分区同时依赖多个上游分区：

```text
下游 partition 0
    ├─ 读取 Map Task 0 写出的 partition 0 block
    ├─ 读取 Map Task 1 写出的 partition 0 block
    └─ 读取 Map Task 2 写出的 partition 0 block
```

下游 Task 开始计算最终结果前，必须知道这些 Map 输出在哪里，并能够获得自己需要的 block。因此 Shuffle Write 位于上游 Stage，Shuffle Read 位于下游 Stage。

### 2.3 下游分区数不是上游执行完之后才知道

下游分区数在构建 ShuffleDependency 时就已经确定，一般来自：

- 用户显式传入的 `numPartitions`；
- `spark.default.parallelism`；
- Spark SQL 的 `spark.sql.shuffle.partitions`；
- RangePartitioner 根据采样结果确定的分区边界；
- AQE 对原有 Shuffle 分区的运行时合并或倾斜分区拆分。

例如：

```python
rdd.reduceByKey(add, numPartitions=4)
```

在任务执行前，Spark 已经知道目标 Shuffle 有 4 个逻辑分区，所以初始计划通常会有 4 个下游 Reduce Task。上游完成后才知道的是：

- 每个 Map Task 的 Shuffle 文件位于哪个 Executor；
- 文件中每个目标分区的 block 有多大；
- 是否存在空分区或倾斜分区；
- AQE 是否应该调整后续物理分区。

所以顺序不是“上游执行完，再凭数据条数决定创建多少 Task”，而是：

```text
先确定逻辑分区规则和初始分区数
        ↓
创建并运行上游 Map Task
        ↓
得到每个 Shuffle block 的位置和大小
        ↓
必要时由 AQE 调整后续物理分区
        ↓
运行下游 Task
```

---

## 三、ShuffleDependency 已经记录了哪些规则

在 Shuffle 真正执行前，Spark 已经通过 ShuffleDependency 描述了这次数据交换。可以把它概念化成：

```python
class ShuffleDependency:
    rdd                 # 上游 RDD
    partitioner         # 如何计算目标 partitionId
    serializer          # record 如何序列化
    keyOrdering         # 是否要求分区内按 key 排序
    aggregator          # 如何创建、更新和合并聚合状态
    mapSideCombine      # 是否允许 Map 端预聚合
```

不同算子会生成不同组合：

| 算子 | 重新分区 | map-side combine | key 排序 |
|---|---:|---:|---:|
| `repartition` | 是 | 否 | 无业务排序要求 |
| `groupByKey` | 是 | 不进行压缩式 combine | 无业务排序要求 |
| `reduceByKey` | 是 | 是 | 无业务排序要求 |
| `sortByKey` | 是 | 通常不是聚合 | 是 |
| 大表 SortMergeJoin | 是 | 不是普通 key 聚合 | Join key 需要满足排序要求 |

Shuffle Writer 不会猜测业务意图。它根据 ShuffleDependency 选择写出路径并执行其中记录的规则。

---

## 四、Shuffle Write 第一步：确定 record 的目标分区

### 4.1 所有 Shuffle 都必须计算 partitionId

假设上游 Task 读到：

```text
("apple", 10)
```

Writer 会把 key 交给 Partitioner：

```python
partition_id = partitioner.getPartition("apple")
```

常见 HashPartitioner 可以近似理解为：

```python
def get_partition(key, num_partitions):
    return non_negative_mod(hash(key), num_partitions)
```

如果目标分区数是 4：

```text
record             hash(key) % 4       目标分区
------------------------------------------------
(apple, 10)               2            partition 2
(banana, 20)              0            partition 0
(apple, 30)               2            partition 2
```

相同 key 在同一次 Shuffle 中使用相同 Partitioner，因此会进入相同目标分区。

这个过程与 combine 没有关系：

```text
没有 combine：每条原始 record 分别计算 partitionId
有 combine：每条原始 record 仍然计算 partitionId，然后在 Map 端更新 combiner
```

### 4.2 不一定使用 HashPartitioner

其他常见分区方法包括：

- RangePartitioner：根据采样得到的 key 范围划分分区，常用于全局排序；
- Round-robin：尽量均匀地轮流分配；
- 自定义 Partitioner：根据租户、地区等业务规则分区；
- Spark SQL Exchange 中的 HashPartitioning、RangePartitioning 等物理分布要求。

无论使用哪一种，目标都是回答同一个问题：**这条 record 最终应该由哪个下游 Task 处理？**

### 4.3 没有 combine、没有业务排序时怎样写

可以使用概念伪代码表示：

```python
for key, value in upstream_partition:
    partition_id = partitioner.getPartition(key)
    writers[partition_id].write(key, value)
```

一种典型的 bypass 写法会为每个目标分区维护临时输出，Map Task 结束后再拼成一个最终数据文件：

```text
临时 partition-0 文件 ─┐
临时 partition-1 文件 ─┼─ 顺序拼接 ─> 一个 data 文件
临时 partition-2 文件 ─┘                一个 index 文件
```

最终文件大致是：

```text
data file:
[partition 0 bytes][partition 1 bytes][partition 2 bytes]

index file:
partition 0：offset 0 ～ A
partition 1：offset A ～ B
partition 2：offset B ～ C
```

下游 Task 1 只需要根据索引读取 A 到 B 这一段。

这种方式不需要通用的全局排序结构，适合没有 combine、目标分区较少并满足其他条件的 Shuffle。目标分区很多时，为每个分区管理临时写出通道会变得昂贵，因此 Spark 不会无限制使用这种路径。

### 4.4 “不需要排序”不代表底层完全不排序

这里有两种不同的排序：

1. **业务语义排序**：例如 `sortByKey` 要求同一分区内的 key 有序；
2. **物理组织排序**：Writer 为了把同一 partitionId 的数据连续写入文件，可能按照 partitionId 整理记录。

`reduceByKey` 不承诺最终 key 的业务顺序，但 Sort-based Shuffle Writer 仍可能按照 partitionId 排列内存中的记录。这样做是为了写文件和索引，不是为了向用户提供排序语义。

---

## 五、Combine：Map Task 内部的局部聚合

### 5.1 combine 的准确语义

Combine 通常指 map-side combine：**在 Shuffle 数据跨网络发送之前，一个 Map Task 先把自己内部相同 key 的 values 合并成较小的局部结果。**

它有三个限制：

- 只能处理当前 Map Task 看见的数据；
- 不能直接产生跨所有 Map Task 的最终结果；
- 只有聚合操作支持局部合并时才能启用。

### 5.2 用 reduceByKey 看完整过程

输入分布在两个上游分区：

```text
Map Task 0：                   Map Task 1：
(a, 1)                        (a, 4)
(a, 2)                        (b, 5)
(b, 3)                        (a, 6)
```

如果执行：

```python
rdd.reduceByKey(lambda x, y: x + y)
```

Map 端先局部求和：

```text
Map Task 0：                   Map Task 1：
(a, 1 + 2) → (a, 3)           (a, 4 + 6) → (a, 10)
(b, 3)     → (b, 3)           (b, 5)     → (b, 5)
```

网络中传输的 record 从 6 条减少成 4 条：

```text
Map 0 写出：(a,3)、(b,3)
Map 1 写出：(a,10)、(b,5)
```

下游再合并不同 Map Task 的局部结果：

```text
a：3 + 10 = 13
b：3 + 5  = 8
```

因此最终聚合分为两级：

```text
Map 端：合并当前上游 partition 内的相同 key
                         ↓ Shuffle
Reduce 端：合并来自所有 Map Task 的相同 key
```

Map-side combine 减少的是 Shuffle Write 字节、网络传输量和 Reduce 端需要处理的 record 数量。

### 5.3 combine 内部的三个函数

Spark 的 Aggregator 可以概念化为：

```python
def create_combiner(value):
    # 第一次看到某个 key
    return value

def merge_value(combiner, value):
    # 当前 Map Task 又看到一个相同 key 的原始 value
    return combiner + value

def merge_combiners(left, right):
    # 合并不同 Map Task 或不同 spill 文件中的局部状态
    return left + right
```

Writer 可以使用以 `(partitionId, key)` 为逻辑键的聚合结构：

```python
for key, value in upstream_records:
    partition_id = partitioner.getPartition(key)

    if map.contains(partition_id, key):
        old = map.get(partition_id, key)
        map.put(partition_id, key, merge_value(old, value))
    else:
        map.put(partition_id, key, create_combiner(value))
```

为什么聚合结构里还需要 partitionId？因为 Writer 不仅要合并相同 key，还要按照目标分区写出结果。

### 5.4 为什么 groupByKey 不能获得相同收益

假设目标只是求和：

```python
# 先把所有原始 values 发送到下游，再求和
rdd.groupByKey().mapValues(sum)

# Map 端先局部求和，只发送局部结果
rdd.reduceByKey(lambda x, y: x + y)
```

`groupByKey` 的语义是保留一个 key 对应的全部 values：

```text
a → [1, 2, 4, 6]
```

即使 Map 端先把 `[1, 2]` 装进集合，这两个元素最终仍然要通过网络传输，数据量没有像求和那样从两条压缩成一个数。提前构造集合还会占用更多 Map 端内存。因此 `groupByKey` 不进行 `reduceByKey` 那种压缩式 map-side combine。

### 5.5 什么操作适合 combine

适合的计算能够把局部状态继续合并，例如：

- sum、count、min、max；
- 同时保存 sum 和 count，最后计算平均值；
- 集合去重；
- Top K；
- 可合并的统计摘要。

平均值不能简单地“平均局部平均值”，但可以把聚合状态设计成 `(sum, count)`：

```text
Map 0：sum=30, count=2
Map 1：sum=90, count=3

合并：(120, 5)
平均值：120 / 5 = 24
```

依赖严格输入顺序、局部结果无法再次合并的计算，不能随意使用 combine。对于 `reduceByKey`，聚合函数通常应满足结合律和交换律，否则分区方式、Task 顺序或重试可能影响结果。

---

## 六、Spill：内存不够时怎样继续完成同一个 Task

### 6.1 为什么会 spill

Shuffle Write 可能需要在内存中保存：

- 等待按照 partitionId 组织的 records；
- 等待按 key 排序的 records；
- map-side combine 产生的聚合状态。

当这些结构持续增长，Task 无法继续获得足够的 execution memory 时，Spark 会把当前内存中的一部分中间结果写入 Executor 本地磁盘，然后释放内存继续处理剩余输入。

```text
输入不断到达
    ↓
内存集合增长
    ↓
无法继续安全增长
    ↓
排序/组织当前结果并写 spill-1
    ↓
释放内存
    ↓
继续读取输入
    ↓
再次不足时写 spill-2
```

Spark 判断是否 spill 并不只是检查一个简单的固定条数阈值。它会结合数据结构估算大小以及 Task 从执行内存池申请到的内存作出决定。

### 6.2 Spill 文件中保存什么

没有 combine 时，spill 中保存当前已经接收的一批 records；有 combine 时，保存当前内存中已经局部聚合的 `(key, combiner)`。

例如：

```text
spill-1：(a,3)、(b,8)
spill-2：(a,4)、(c,6)
内存中：(a,5)、(b,2)
```

Task 输入读完后，Spark 归并 spill 文件和最后的内存结果。对于需要 combine 的情况，相同 key 仍要继续合并：

```text
a：3 + 4 + 5 = 12
b：8 + 2     = 10
c：6         = 6
```

### 6.3 Spill 没有改变执行拓扑

Spill 是一个 Task 内部的临时过程：

```text
一个 Task
  ├─ 内存处理第一段
  ├─ spill
  ├─ 内存处理第二段
  ├─ spill
  └─ merge 后完成
```

它不会：

- 创建新 Stage；
- 创建新的 Shuffle 分区；
- 把一个 Task 自动拆成多个 Task；
- 修改 RDD 血缘；
- 像 checkpoint 那样保存可供未来 Job 使用的数据。

Spill 临时文件属于 Executor 本地中间数据。Task 完成、文件合并且不再需要后，可以被清理。

### 6.4 Spill 的代价

Spill 使处理规模不再受单个 Task 可用内存的硬限制，但会增加：

- 序列化和反序列化；
- 本地磁盘写入和读取；
- spill 文件归并；
- CPU 排序和聚合；
- Executor 本地磁盘空间压力。

所以 spill 是保证任务能继续执行的机制，不是主动追求的加速手段。少量 spill 不一定是故障；大量、反复 spill 通常意味着分区过大、数据倾斜、聚合状态过大或 Executor execution memory 紧张。

---

## 七、Shuffle Writer 如何选择写出策略

Spark 不会让所有 Shuffle 强制执行完全相同的流程。Writer 的具体选择与 Spark 版本有关，也会受到以下信息影响：

- 是否允许 map-side combine；
- 是否要求 key ordering；
- 目标分区数量；
- 序列化器是否支持相应优化；
- record 是否能够以序列化二进制形式排序；
- 相关 Shuffle 配置。

可以把主要路径理解成：

| 场景 | 核心数据结构或路径 | 主要工作 |
|---|---|---|
| 无 combine、分区较少、满足 bypass 条件 | Bypass 类 Writer | 直接路由到分区临时输出，最后拼接 |
| 无 combine、采用 Sort-based Shuffle | 可扩容 Buffer 或序列化 Buffer | 按 partitionId 组织，可 spill |
| 有 combine | AppendOnlyMap 类结构 | 按 `(partitionId, key)` 更新 combiner，可 spill |
| 要求 key 有序 | ExternalSorter 类结构 | 按 partitionId 和 key ordering 排序、spill、merge |

这里的 AppendOnlyMap 不是普通业务 Map，它针对 Spark 内部聚合减少了对象开销；ExternalAppendOnlyMap、ExternalSorter 等结构增加了 spill 和归并能力。

无论使用哪种 Writer，最终都必须产生可供下游按目标分区读取的 Shuffle block。

---

## 八、Shuffle Write 完成后保存了什么

每个上游 Map Task 完成后，通常留下：

```text
Map Task 输出
    ├─ data 文件：各目标分区的实际字节
    ├─ index 文件：各分区在 data 文件中的偏移
    └─ MapStatus：输出位置以及各 block 的大小信息
```

MapStatus 会报告给 Driver 侧的 MapOutputTracker。它不是把 Shuffle 数据传给 Driver；真正的数据仍然保存在 Executor 本地磁盘或 Shuffle 服务管理的位置。Driver 主要记录“数据在哪里、每块大约多大”。

假设有 3 个 Map Task、2 个目标分区：

```text
Map 0 data：[reduce-0 block][reduce-1 block]
Map 1 data：[reduce-0 block][reduce-1 block]
Map 2 data：[reduce-0 block][reduce-1 block]
```

逻辑上存在 3 × 2 个 Shuffle block，但现代 Sort-based Shuffle 通常不会永久创建 6 个独立数据文件，而是让每个 Map Task 使用数据文件加索引描述其中的多个 block。

---

## 九、Shuffle Read：下游 Task 怎样获得自己的数据

### 9.1 一个下游 Task 只负责一个目标分区

Reduce Task 0 会读取每个上游 Map 输出中的 partition 0 block：

```text
Map 0 的 partition 0 block ─┐
Map 1 的 partition 0 block ─┼─> Reduce Task 0
Map 2 的 partition 0 block ─┘
```

Reduce Task 1 同理只读取 partition 1 blocks。

执行过程是：

1. 下游 Task 向 MapOutputTracker 查询相关 MapStatus；
2. 根据位置把 block 分成本地、同主机或远程 block；
3. 本地数据直接读取，远程数据通过 BlockTransferService 拉取；
4. 对获取的字节流解压、反序列化；
5. 根据依赖要求执行聚合或排序；
6. 将结果 iterator 交给下游 RDD 算子。

### 9.2 Reduce 端为什么还要聚合

Map-side combine 只能得到每个 Map Task 的局部结果：

```text
Map 0：(a,3)
Map 1：(a,10)
Map 2：(a,7)
```

Reduce Task 必须把它们继续合并：

```text
(a,3)、(a,10)、(a,7) → (a,20)
```

如果没有 map-side combine，例如 `groupByKey`，Reduce 端则需要收集原始 values：

```text
(a,1)、(a,2)、(a,4)、(a,6) → a -> [1,2,4,6]
```

### 9.3 Shuffle Read 也可能 spill

如果 Reduce Task 需要对大量 key 聚合或排序，它的内存结构同样可能放不下，因此 Shuffle Read 端也会 spill：

```text
Fetch blocks
    → 反序列化
    → 内存聚合/排序
    → spill
    → 继续 fetch 和处理
    → merge
    → 输出 iterator
```

因此 Spark UI 中的 spill 不能仅凭名称判断发生在 Write 还是 Read，需要结合 Stage、Task 指标和物理计划分析。

---

## 十、用一个 reduceByKey 贯穿完整 Shuffle

执行：

```python
rdd = sc.parallelize(
    [("a", 1), ("b", 2), ("a", 3), ("c", 4), ("b", 5), ("a", 6)],
    2
)

result = rdd.reduceByKey(lambda x, y: x + y, numPartitions=2)
result.collect()
```

假设输入被分为：

```text
上游 partition 0：                   上游 partition 1：
(a,1)、(b,2)、(a,3)                  (c,4)、(b,5)、(a,6)
```

### 10.1 Driver 构建依赖

在 action 触发后，DAGScheduler 发现 `reduceByKey` 产生 ShuffleDependency：

```text
上游分区数：2 → 两个 Map Task
下游分区数：2 → 两个 Reduce Task
Partitioner：HashPartitioner(2)
Aggregator：加法
mapSideCombine：true
```

### 10.2 Map Task 读取和局部 combine

Map Task 0：

```text
(a,1) → 创建 a 的 combiner：1
(b,2) → 创建 b 的 combiner：2
(a,3) → 更新 a 的 combiner：1 + 3 = 4
```

Map Task 1：

```text
(c,4) → 创建 c 的 combiner：4
(b,5) → 创建 b 的 combiner：5
(a,6) → 创建 a 的 combiner：6
```

Map 端结果：

```text
Map 0：(a,4)、(b,2)
Map 1：(c,4)、(b,5)、(a,6)
```

### 10.3 计算目标 partitionId 并写出

假设 `a` 和 `c` 进入 partition 0，`b` 进入 partition 1：

```text
Map 0 data：[(a,4)] [(b,2)]
             p0       p1

Map 1 data：[(c,4),(a,6)] [(b,5)]
                 p0       p1
```

如果内存结构中途放不下，Map Task 会写出 spill 文件，最后再归并成正式 Shuffle 输出。Task 完成后向 Driver 报告 MapStatus。

### 10.4 Reduce Task 拉取并最终聚合

Reduce Task 0：

```text
从 Map 0 拉取：(a,4)
从 Map 1 拉取：(c,4)、(a,6)

聚合结果：(a,10)、(c,4)
```

Reduce Task 1：

```text
从 Map 0 拉取：(b,2)
从 Map 1 拉取：(b,5)

聚合结果：(b,7)
```

最终 RDD 仍有两个分区：

```text
partition 0：(a,10)、(c,4)
partition 1：(b,7)
```

`collect()` 再把这两个下游分区的结果发送给 Driver。这个发送结果的过程属于 action 输出，不是前面那次 key 重新分区的 Shuffle Write。

---

## 十一、不同算子为什么会产生不同 Shuffle 行为

### 11.1 repartition

```python
rdd.repartition(100)
```

只要求把数据重新分布到 100 个分区，没有相同 key 聚合语义：

```text
计算目标 partitionId → 写出 → 下游读取
```

### 11.2 groupByKey

```python
pairs.groupByKey()
```

需要把相同 key 的所有原始 values 放进同一个下游分区：

```text
Map 端保留原始 values → Shuffle → Reduce 端组成 values 集合
```

它适合确实需要遍历全部 values 的场景。如果只是 sum、count、max，不应该先 groupByKey。

### 11.3 reduceByKey

```python
pairs.reduceByKey(add)
```

允许先在 Map 端合并：

```text
Map 局部 combine → Shuffle 局部结果 → Reduce 最终 combine
```

### 11.4 sortByKey

```python
pairs.sortByKey()
```

除了重新分区，还要求 key 的全局范围顺序。典型做法是采样 key、生成 RangePartitioner，再保证：

```text
partition 0 的 key 范围 < partition 1 的 key 范围 < partition 2 的 key 范围
```

每个分区内部也要按 key 排序，所以 Write/Read 的排序要求比普通 `reduceByKey` 更强。

### 11.5 join

两个 Pair RDD 如果没有兼容的 Partitioner，通常都要按照 Join key Shuffle：

```text
左 RDD 按 key 分区 ─┐
                      ├─ 相同 key 到同一分区 → Join
右 RDD 按 key 分区 ─┘
```

如果一侧足够小，Spark SQL 可以使用 Broadcast Hash Join，把小表广播到每个 Executor，避免大表 Shuffle。这不是优化现有 Shuffle，而是选择另一种 Join 流程绕开 Shuffle。

---

## 十二、Shuffle 常见误解

### 误解一：没有 combine 就不知道 record 属于哪个分区

错误。partitionId 永远由 Partitioner 计算；combine 只决定 Map 端是否提前合并相同 key。

### 误解二：combine 已经算出了最终结果

错误。Map-side combine 只有局部结果，不同 Map Task 的 combiner 还需要在下游合并。

### 误解三：spill 是把数据缓存到磁盘

错误。spill 是当前 Task 为释放执行内存而写出的临时中间文件；缓存是为了未来重复读取，checkpoint 是为了截断血缘和可靠恢复。

### 误解四：spill 会产生新的 Stage 和 Task

错误。同一个 Task 可以 spill 多次，最后归并后完成，DAG 结构没有因此改变。

### 误解五：上游 Stage 完成后才知道下游要几个 Task

通常错误。初始目标分区数在 ShuffleDependency 建立时已知；上游完成后得到的是 block 位置和真实大小。AQE 可以利用这些统计调整后续物理执行。

### 误解六：Sort-based Shuffle 意味着所有结果都按 key 排序

错误。它至少需要把记录按 partitionId 组织成连续区域，但只有 keyOrdering 有要求时，才提供相应的分区内 key 排序。

---

## 十三、如何判断 Shuffle 是否有问题

在 Spark UI 中重点观察：

- Shuffle Write Size：上游实际写出了多少数据；
- Shuffle Read Size：下游通过本地和远程读取了多少数据；
- Records Read/Written：是否本可 combine 却传输了大量原始记录；
- Fetch Wait Time：下游等待远程 Shuffle block 的时间；
- Spill (Memory/Disk)：是否频繁溢写；
- Task Duration 分布：是否只有少数 Task 特别慢；
- 单个分区大小：是否存在 key 倾斜；
- Peak Execution Memory：聚合和排序结构的内存压力。

对应的优化逻辑是：

```text
Shuffle 数据总量大
    → 提前 filter、只保留必要列、使用 map-side combine

分区普遍过大并大量 spill
    → 增加合理的 Shuffle 分区数，降低单 Task 数据量

大量极小 Task
    → 减少分区数或使用 AQE 合并小分区

只有少数 Task 巨大
    → 排查热点 key，使用 AQE skew join、广播或拆分热点

Fetch Wait 很高
    → 检查网络、磁盘、block 数量、Executor 丢失和数据本地性
```

不能看到 spill 就直接增加 Executor 内存。数据倾斜时，无论集群总内存多大，热点分区仍可能集中在一个 Task；这时应该先修正分区和数据分布。

---

## 十四、全章总结

Shuffle 的完整逻辑可以压缩成下面这张图：

```text
Driver 构建 ShuffleDependency
    ├─ Partitioner：目标分区怎么算
    ├─ Aggregator：相同 key 怎么合并
    ├─ mapSideCombine：Map 端能否先合并
    └─ keyOrdering：是否要求 key 顺序
                    │
                    ▼
上游每个 Map Task
    → 读取自己的上游 partition
    → 为每条 record 计算 partitionId
    → 可选 map-side combine
    → 可选排序
    → 内存不足时 spill
    → 归并并写 data/index 文件
    → 报告 MapStatus
                    │
                    ▼
下游每个 Reduce Task
    → 查询所有 Map 输出位置
    → 只拉取属于自己 partitionId 的 blocks
    → 反序列化
    → 最终聚合或排序
    → 内存不足时 spill
    → 输出下游 RDD partition 的 iterator
```

三个问题的直接答案是：

1. **没有 combine 时如何确定分区**：始终通过 `partitioner.getPartition(key)` 计算 partitionId，然后将 record 写入该目标分区对应的文件区域。
2. **combine 是什么**：一个 Map Task 在网络发送前，对自己内部相同 key 的 values 做局部聚合；下游仍要合并不同 Map Task 的局部结果。
3. **spill 是什么**：同一个 Task 的排序或聚合结构内存不足时，把当前中间结果临时写入本地磁盘，释放内存后继续处理，最后再归并；它不改变 Stage、Task 数量和分区数。

