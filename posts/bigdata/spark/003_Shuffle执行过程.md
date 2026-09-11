# Spark Shuffle 的完整执行过程

> 本文从一条 record 进入 Shuffle Writer 开始，解释目标分区、map-side combine、spill、Shuffle 文件、MapStatus 和下游拉取过程。
>
> 用户代码如何形成 RDD DAG、Stage、Task，以及 Executor 如何执行普通 RDD partition，见 002 文档。

## 一、先看完整流程

Shuffle 的本质是：

> 上游数据原来按照输入分区存放，现在需要按照新的 Partitioner 重新组织，使相关 records 进入同一个下游 partition。

~~~text
Driver 创建 ShuffleDependency
        │
        ▼
上游 ShuffleMapStage
  每个 Map Task：
    → 执行 Shuffle 前的窄依赖流水线
    → 为每条 record 计算目标 partitionId
    → 可选 map-side combine
    → 可选 key 排序
    → 内存不足时 spill
    → 写 data/index 文件
    → 报告 MapStatus
        │
        ▼
下游 Stage
  每个 Task：
    → 查询所有 Map 输出位置
    → 拉取属于自己 reduce partition 的 blocks
    → 反序列化
    → 最终聚合或排序
    → 内存不足时 spill
    → 把 iterator 交给后续算子
~~~

需要分清四个独立问题：

| 概念 | 解决的问题 | 是否必然发生 |
|---|---|---|
| partition | record 应交给哪个下游 Task | 所有 Shuffle 都需要 |
| combine | Map 端能否先聚合相同 key | 可选 |
| key ordering | 分区内 key 是否要求有序 | 可选 |
| spill | 内存结构放不下时怎样继续 | 需要时发生 |

---

## 二、Shuffle 为什么形成 Stage 边界

普通窄依赖中，一个 child partition 可以从少量确定的 parent partitions 获得数据，并在一个 Task 内以 iterator 流水线执行。

Shuffle 后，一个下游 partition 通常依赖所有上游 Map Task 的一部分输出：

~~~text
Map Task 0 的 reduce-0 block ─┐
Map Task 1 的 reduce-0 block ─┼─> 下游 Task 0
Map Task 2 的 reduce-0 block ─┘
~~~

上游必须先产生可以定位的 Shuffle blocks，下游才能拉取，因此形成：

~~~text
ShuffleMapStage
    → Shuffle Write
    → 物化 Stage 边界
    → Shuffle Read
    → 下游 Stage
~~~

只有 Stage 末端的 ShuffleMapTask 执行 Shuffle Write。Shuffle 前的 map、filter 等窄依赖算子仍在这个 Task 中流水线执行。下游 Task 完成 Shuffle Read 后，也可以继续执行 reduce、map、filter 等算子。

---

## 三、ShuffleDependency 规定了什么

Driver 构建逻辑 DAG 时，ShuffleDependency 已经描述这次交换：

~~~python
class ShuffleDependency:
    parent_rdd
    shuffle_id
    partitioner
    serializer
    aggregator
    map_side_combine
    key_ordering
~~~

主要字段：

- parent_rdd：Shuffle 前的 RDD；
- shuffleId：标识这次 Shuffle；
- partitioner：怎样计算目标 partitionId；
- serializer：records 怎样编码；
- aggregator：怎样创建和合并聚合状态；
- mapSideCombine：是否允许 Map 端预聚合；
- keyOrdering：是否要求分区内 key 有序。

不同算子的需求：

| 算子 | 重新分区 | map-side combine | key 排序 |
|---|---:|---:|---:|
| repartition | 是 | 否 | 无业务排序要求 |
| groupByKey | 是 | 没有压缩式 combine | 无业务排序要求 |
| reduceByKey | 是 | 是 | 无业务排序要求 |
| sortByKey | 是 | 通常不是聚合 | 是 |
| 大表 SortMergeJoin | 是 | 不是普通 key 聚合 | Join key 需要排序 |

Writer 根据这些规则和运行配置选择执行路径，不会在 Executor 中猜测用户想做什么。

---

## 四、下游 partition 数量何时确定

初始目标分区数在创建 ShuffleDependency 时已经确定，可能来自：

- 用户显式传入的 numPartitions；
- spark.default.parallelism；
- spark.sql.shuffle.partitions；
- Partitioner 的 numPartitions；
- SQL 物理计划的分布要求。

~~~python
rdd.reduceByKey(add, numPartitions=4)
~~~

执行前已知：

~~~text
目标逻辑分区数 = 4
初始下游 Task 数 = 4
分区规则 = HashPartitioner(4)
~~~

上游执行完成后才知道：

- Map 输出位于哪个 Executor；
- 每个 Shuffle block 的真实大小；
- 哪些分区为空；
- 是否存在倾斜；
- AQE 是否应调整后续物理分区。

因此不是上游执行完后根据 record 数量重新决定分区。经典 RDD 的分区数通常预先确定；Spark SQL AQE 可以使用运行时统计合并小分区、拆分倾斜分区或修改后续 Join 策略。

---

## 五、Shuffle Write：怎样确定 record 的目标分区

### 5.1 没有 combine 也必须计算 partitionId

每条进入 Shuffle 的 key-value record 都要经过 Partitioner：

~~~python
partition_id = partitioner.getPartition(key)
~~~

HashPartitioner 可以近似理解为：

~~~python
def get_partition(key, num_partitions):
    return non_negative_mod(hash(key), num_partitions)
~~~

例如目标有四个分区：

~~~text
record             hash(key) % 4       目标
------------------------------------------------
(apple, 10)               2            partition 2
(banana, 20)              0            partition 0
(apple, 30)               2            partition 2
~~~

相同 key 使用同一个 Partitioner，因此进入相同下游 partition。

这个过程与 combine 无关：

~~~text
没有 combine：
  每条原始 record 计算 partitionId 并写出

有 combine：
  每条原始 record 仍要确定 partitionId
  再按照 (partitionId, key) 更新聚合状态
~~~

### 5.2 Partitioner 不一定使用 Hash

- HashPartitioner：聚合和普通 key-value Shuffle 常用；
- RangePartitioner：根据采样得到的 key 范围分区，常用于全局排序；
- 自定义 Partitioner：按照租户或地区等规则分区；
- SQL Exchange：可以要求 HashPartitioning、RangePartitioning 等分布。

它们都在回答：这条 record 最终由哪个下游 Task 处理？

### 5.3 无 combine、无业务排序时怎样写

概念过程：

~~~python
for key, value in upstream_iterator:
    pid = partitioner.getPartition(key)
    partition_output[pid].write(key, value)
~~~

一种 bypass 路径会为每个目标分区写临时输出，Task 结束后拼接：

~~~text
临时 partition-0 输出 ─┐
临时 partition-1 输出 ─┼─ 顺序拼接 ─> data 文件
临时 partition-2 输出 ─┘                index 文件
~~~

最终文件：

~~~text
data:
[partition 0 bytes][partition 1 bytes][partition 2 bytes]

index:
partition 0：offset 0 ～ A
partition 1：offset A ～ B
partition 2：offset B ～ C
~~~

下游 Task 1 根据索引只读取 A 到 B。

目标分区很多时，为每个分区维护临时输出会变得昂贵，所以 Spark 只在分区数和其他条件满足时选择 BypassMergeSortShuffleWriter 一类路径。

### 5.4 不要求 key 排序，不等于底层完全不整理顺序

需要区分：

1. 业务排序：sortByKey 要求分区范围和分区内 key 有序；
2. 物理组织：Writer 为使同一 partitionId 的数据连续，可能按 partitionId 排列 records。

reduceByKey 不承诺输出 key 顺序，但 Sort-based Shuffle 仍需要按照目标分区组织数据文件。

---

## 六、Combine：Map Task 内部的局部聚合

### 6.1 Combine 的准确语义

Map-side combine 是：

> 在网络发送前，一个 Map Task 先合并自己内部相同 key 的 values。

它只能处理当前 Map Task 看见的数据，不能产生跨所有 Map Tasks 的最终结果。

输入：

~~~text
Map Task 0：                   Map Task 1：
(a,1)                         (a,4)
(a,2)                         (b,5)
(b,3)                         (a,6)
~~~

reduceByKey 在 Map 端先聚合：

~~~text
Map 0：(a,3)、(b,3)
Map 1：(a,10)、(b,5)
~~~

网络传输从六条原始 records 减少成四条局部结果。Reduce 端仍要合并：

~~~text
a：3 + 10 = 13
b：3 + 5  = 8
~~~

完整语义：

~~~text
Map 端 combine
  = 当前 Map Task 内相同 key 的局部聚合
            ↓
Shuffle
            ↓
Reduce 端 combine
  = 所有 Map Tasks 局部状态的最终聚合
~~~

### 6.2 Aggregator 的三个函数

~~~python
def create_combiner(value):
    return value

def merge_value(combiner, value):
    return combiner + value

def merge_combiners(left, right):
    return left + right
~~~

Map 端聚合结构可以概念化为：

~~~python
for key, value in records:
    pid = partitioner.getPartition(key)

    if map.contains(pid, key):
        old = map.get(pid, key)
        map.put(pid, key, merge_value(old, value))
    else:
        map.put(pid, key, create_combiner(value))
~~~

逻辑键中包含 partitionId，是因为 Writer 既要聚合相同 key，也要按目标分区输出。

### 6.3 什么操作适合 combine

适合把局部状态继续合并的操作：

- sum、count、min、max；
- Top K；
- 集合去重；
- 可合并的统计摘要；
- 使用 (sum, count) 计算平均值。

平均值不能直接平均各分区平均值：

~~~text
错误：avg(local_avg_1, local_avg_2)

正确：
Map 0 → (sum=30, count=2)
Map 1 → (sum=90, count=3)
合并 → (120, 5)
最终平均值 → 24
~~~

reduceByKey 的函数通常应满足结合律和交换律，否则不同分区和执行顺序可能产生不同结果。

### 6.4 groupByKey 为什么没有相同收益

groupByKey 的结果要求保留全部 values：

~~~text
a → [1,2,4,6]
~~~

即使 Map 端先构造 [1,2]，其中每个元素仍要通过网络。它不像求和那样把多个 values 压缩成一个数字，还可能增加 Map 端集合内存。

~~~python
# 发送全部 values
rdd.groupByKey().mapValues(sum)

# Map 端先发送局部和
rdd.reduceByKey(lambda x, y: x + y)
~~~

如果只需要 sum、count、max 等结果，应选择可以 combine 的聚合。

---

## 七、Spill：内存不足时继续完成同一个 Task

### 7.1 为什么发生 Spill

Shuffle Writer 可能在内存中保存：

- 等待按 partitionId 组织的 records；
- 等待 key 排序的 records；
- Map-side combine 的聚合状态。

当 Task 无法继续获得足够 execution memory 时，会把当前中间结果临时写入 Executor 本地磁盘：

~~~text
读取一部分输入
    → 内存结构增长
    → 内存不足
    → 写 spill-1
    → 释放内存
    → 继续读取
    → 写 spill-2
    → 输入结束
    → 归并 spills 和最后的内存结果
~~~

Spark 会结合内存结构大小估计和 Task 从执行内存池获得的空间决定是否 spill，不只是检查一个简单的 record 数量阈值。

### 7.2 Spill 文件里保存什么

无 combine 时，保存一批待组织的 records；有 combine 时，通常保存当前已局部聚合的 (key, combiner)。

~~~text
spill-1：(a,3)、(b,8)
spill-2：(a,4)、(c,6)
内存中：(a,5)、(b,2)

最终 merge：
a = 3 + 4 + 5
b = 8 + 2
c = 6
~~~

相同 key 可能出现在多个 spill 文件中，所以最终归并还要继续合并局部状态。

### 7.3 Spill 不改变执行拓扑

Spill 是一个 Task 内部的临时过程，不会：

- 创建新 Stage；
- 创建新 partition；
- 把一个 Task 自动拆成多个 Task；
- 修改 RDD lineage；
- 像 checkpoint 一样形成可靠恢复点；
- 像 persist 一样供后续 Job 复用。

它使一个 Task 能处理超过可用内存的数据，代价是序列化、磁盘写读和多路归并。少量 spill 不一定异常；大量重复 spill 通常说明分区过大、数据倾斜、聚合状态过大或 execution memory 紧张。

Shuffle Read 端进行大规模聚合或排序时，同样可能 spill。

---

## 八、Shuffle Writer 怎样选择实现

选择会受到以下因素影响：

- mapSideCombine；
- keyOrdering；
- 目标分区数；
- Serializer 能力；
- Spark 版本和配置。

概念路径：

| 场景 | 结构或路径 | 主要动作 |
|---|---|---|
| 无 combine、满足 bypass 条件 | Bypass 类 Writer | 按分区写临时输出并拼接 |
| 无 combine、Sort-based Shuffle | Buffer 或序列化 Buffer | 按 partitionId 组织，可 spill |
| 有 combine | AppendOnlyMap 类结构 | 按 (partitionId, key) 更新状态，可 spill |
| 要求 key 有序 | ExternalSorter 类结构 | 按 partitionId 和 key 排序、spill、merge |

AppendOnlyMap 是为 Spark 内部聚合设计的只增不删结构；ExternalSorter 等结构则增加 spill 和归并能力。

无论使用哪种 Writer，最终都要产生可供下游按 reduce partition 读取的 Shuffle blocks。

---

## 九、Shuffle Write 完成后保存什么

每个 ShuffleMapTask 通常留下：

~~~text
data 文件
    = 各目标分区的序列化数据

index 文件
    = 各目标分区在 data 文件中的偏移

MapStatus
    = Map 输出的位置和各 block 大小摘要
~~~

MapStatus 报告给 Driver 侧 MapOutputTracker。Shuffle 数据不会完整发送给 Driver，仍存放在 Executor 本地磁盘、外部 Shuffle Service 或配置的远程 Shuffle 存储。

假设三个 Map Tasks、两个目标分区：

~~~text
Map 0 data：[reduce-0 block][reduce-1 block]
Map 1 data：[reduce-0 block][reduce-1 block]
Map 2 data：[reduce-0 block][reduce-1 block]
~~~

逻辑上有 3 × 2 个 blocks。Sort-based Shuffle 通常让一个 Map Task 使用一个 data 文件加 index 文件，而不是永久创建两个独立数据文件。

---

## 十、Shuffle Read：下游怎样获得数据

### 10.1 一个 Task 只读取自己的 reduce partition

~~~text
Map 0 的 reduce-0 block ─┐
Map 1 的 reduce-0 block ─┼─> 下游 Task 0
Map 2 的 reduce-0 block ─┘
~~~

步骤：

1. 下游 Task 向 MapOutputTracker 查询 MapStatus；
2. 根据位置区分本地、同主机和远程 blocks；
3. 本地直接读取，远程通过 BlockTransferService 拉取；
4. 解压、校验和反序列化；
5. 根据 Aggregator 或 keyOrdering 最终聚合、排序；
6. 内存不足时 spill；
7. 输出 iterator 给当前 Stage 的后续算子。

### 10.2 Reduce 端为什么仍要聚合

Map-side combine 只能产生局部状态：

~~~text
Map 0：(a,3)
Map 1：(a,10)
Map 2：(a,7)
~~~

Reduce Task 必须得到：

~~~text
a = 3 + 10 + 7 = 20
~~~

groupByKey 没有压缩式 combine 时，下游则组织全部原始 values。

---

## 十一、用 reduceByKey 贯穿完整过程

~~~python
rdd = sc.parallelize(
    [("a", 1), ("b", 2), ("a", 3),
     ("c", 4), ("b", 5), ("a", 6)],
    2
)

result = rdd.reduceByKey(
    lambda x, y: x + y,
    numPartitions=2
)

result.collect()
~~~

输入：

~~~text
上游 partition 0：              上游 partition 1：
(a,1)、(b,2)、(a,3)             (c,4)、(b,5)、(a,6)
~~~

Driver 创建：

~~~text
Stage 0：两个 ShuffleMapTasks
Stage 1：两个 ResultTasks
HashPartitioner(2)
mapSideCombine = true
Aggregator = 加法
~~~

Map 端局部聚合：

~~~text
Map 0：
(a,1)、(a,3) → (a,4)
(b,2)        → (b,2)

Map 1：
(c,4)        → (c,4)
(b,5)        → (b,5)
(a,6)        → (a,6)
~~~

假设 a、c 进入 reduce partition 0，b 进入 reduce partition 1：

~~~text
Map 0 data：[(a,4)]       [(b,2)]
             reduce-0      reduce-1

Map 1 data：[(c,4),(a,6)] [(b,5)]
             reduce-0      reduce-1
~~~

下游 Task 0：

~~~text
拉取 Map 0 reduce-0：(a,4)
拉取 Map 1 reduce-0：(c,4)、(a,6)
聚合：(a,10)、(c,4)
~~~

下游 Task 1：

~~~text
拉取 Map 0 reduce-1：(b,2)
拉取 Map 1 reduce-1：(b,5)
聚合：(b,7)
~~~

最终 RDD：

~~~text
partition 0：(a,10)、(c,4)
partition 1：(b,7)
~~~

collect 把最终 records 返回 Driver。这是 ResultTask 的输出，不是按 key 重新分区的 Shuffle Write。

---

## 十二、不同算子的 Shuffle 行为

### 12.1 repartition

只重新分布数据，没有相同 key 的聚合语义：

~~~text
计算目标 partitionId → Write → Read
~~~

### 12.2 groupByKey

保留全部原始 values：

~~~text
Map 端发送原始 values → 下游按 key 构造 values 集合
~~~

### 12.3 reduceByKey

允许局部状态压缩：

~~~text
Map combine → 发送局部结果 → Reduce 最终 combine
~~~

### 12.4 sortByKey

先通过采样建立 RangePartitioner，再保证：

~~~text
partition 0 的 key 范围
    < partition 1 的 key 范围
    < partition 2 的 key 范围
~~~

分区内部也要按 key 排序。

### 12.5 join

两个大 Pair RDD 没有兼容 Partitioner 时，通常要按照 Join key Shuffle。若已经使用兼容 Partitioner，可能复用既有数据分布。Spark SQL 中，小表可以通过 Broadcast Hash Join 避免大表 Shuffle；SortMergeJoin 则通常需要两侧按 Join key 分布和排序。

---

## 十三、Shuffle 输出丢失怎样恢复

保存 Map 输出的 Executor 故障时：

~~~text
下游 Task 发生 FetchFailed
    → Driver 将相应 MapStatus 标记为不可用
    → 根据 ShuffleDependency 找到上游 ShuffleMapStage
    → 重跑产生丢失输出的 Map Task
    → 在新位置写出 data/index
    → 更新 MapStatus
    → 重试受影响的下游 Task
~~~

如果使用外部 Shuffle Service、decommission block 迁移或远程 Shuffle 存储，Executor 退出后部分数据仍可能可读，从而避免重算。

恢复依赖的是 shuffleId、mapId、reduceId、Stage DAG 和 MapStatus，不是 Driver 保存了完整 Shuffle 数据。

---

## 十四、常见误解

### 没有 combine 就不知道 record 属于哪个分区

错误。所有 Shuffle 都由 Partitioner 计算 partitionId。Combine 只决定 Map 端是否预聚合。

### Combine 已经算出最终结果

错误。Map-side combine 只有局部结果，下游还要合并所有 Map Tasks 的局部状态。

### Spill 就是磁盘缓存

错误。Spill 是当前 Task 的临时中间文件；persist 是为了后续复用；checkpoint 是可靠恢复起点。

### Spill 会产生新 Stage 或 Task

错误。同一个 Task 可以 spill 多次，归并后继续完成，DAG 和 partition 数没有改变。

### 上游完成后才确定下游 Task 数

经典 RDD 中通常错误。初始分区数在 ShuffleDependency 中已知；上游完成后得到实际 block 位置和大小。AQE 是运行时调整物理计划的例外。

### Sort-based Shuffle 会让所有 key 有序

错误。它需要把 records 按 partitionId 组织；只有存在 keyOrdering 时，才提供相应的分区内 key 排序语义。

---

## 十五、性能诊断

Spark UI 中重点查看：

- Shuffle Write/Read Size；
- Shuffle Records；
- Remote Bytes Read；
- Fetch Wait Time；
- Spill (Memory/Disk)；
- Peak Execution Memory；
- Task Duration 和输入大小分布；
- 是否有少量异常大 Task。

~~~text
Shuffle 总量过大
    → 提前 filter、列裁剪、使用可 combine 聚合

所有 partitions 都大并频繁 spill
    → 合理增加分区数

大量很小的 Tasks
    → 减少分区数或使用 AQE 合并

少数 Tasks 特别大
    → 排查热点 key 和倾斜
    → AQE skew join、广播或拆分热点

Fetch Wait 很高
    → 检查网络、磁盘、block 数量、Executor 丢失和本地性
~~~

不能看到 spill 就只增加 Executor 总内存。数据倾斜时，热点 partition 仍集中在一个 Task，应先修正数据分布。

---

## 十六、最终心智模型

~~~text
Shuffle Write：

上游 Task 执行窄依赖链
    → Partitioner 计算 partitionId
    → 可选 Map 端 combine
    → 可选 key 排序
    → 必要时 spill
    → 写 data/index
    → 报告 MapStatus

Shuffle Read：

下游 Task 查询所有 MapStatus
    → 拉取自己的 reduce partition blocks
    → 反序列化
    → 最终聚合或排序
    → 必要时 spill
    → 输出下游 RDD partition iterator
~~~

三个关键问题：

1. **没有 combine 时怎样确定分区**：仍由 Partitioner.getPartition(key) 计算 partitionId。
2. **combine 是什么**：一个 Map Task 在发送前合并自身相同 key 的 values；下游再合并各 Map Task 的局部结果。
3. **spill 是什么**：当前 Task 的内存结构放不下时，把中间结果临时写入 Executor 本地磁盘，释放内存后继续处理，最后归并；它不会改变 Stage、Task 或 partition 数。

