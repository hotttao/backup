# Spark Executor 执行 RDD 与 Shuffle 的完整过程

> 本文只讲两件事：
>
> 1. Executor 收到 Task 后，如何根据 RDD、partition 和 dependency 执行一段计算；
> 2. 遇到 ShuffleDependency 后，上游如何写、下游如何拉取并继续执行。
>
> RDD 的缓存、血缘和故障恢复不是独立流程，而是 Executor 获取 partition 数据时的不同分支，因此统一放在第一节。Shuffle 是一种特殊的宽依赖执行过程，统一放在第二节。

## 第一节：Executor 如何执行 RDD

### 1.1 总体过程

一次 Spark Task 的执行可以概括为：

~~~text
Driver
  → 根据 RDD DAG 和 ShuffleDependency 划分 Stage
  → 根据 Stage 的 partition 创建 Task
  → 序列化 Task、用户函数和闭包
  → 把 Task 发送给选定的 Executor

Executor
  → 反序列化 Task
  → TaskRunner 在线程中运行 Task
  → 根据 partitionId 请求最终 RDD 的 iterator
  → 递归读取 parent RDD、缓存、输入文件或 Shuffle
  → 沿窄依赖以 iterator 流水线执行
  → 返回 TaskResult、写 Shuffle 文件或写外部存储
~~~

Task 不是完整 Spark 应用，也不是一份训练数据。它是：

> 某个 Stage 对某个 partition 的一次执行尝试。

同一个 Stage 中的 Task 通常执行相同的算子链，只是 partitionId 不同。

### 1.2 Driver 和 Executor 分别负责什么

Driver 负责控制面：

- 执行用户程序；
- 构建 RDD DAG 或 SQL 物理计划；
- 在 Action 触发后创建 Job；
- 根据 Shuffle 边界切分 Stage；
- 为 Stage 的 partition 创建 Task；
- 调度 Task、跟踪 Map 输出并处理失败。

Executor 负责数据面：

- 接收并反序列化 Task；
- 运行用户函数和 Spark 算子；
- 读取输入、缓存和 Shuffle block；
- 管理执行内存与存储内存；
- 写出 Shuffle 数据或最终结果；
- 向 Driver 汇报状态和指标。

一个 Executor 是 Worker 节点上的 JVM 进程，可以并发运行多个 Task。一个 Task 通常由一个 TaskRunner 线程执行；同一 Executor 中的 Task 共享 JVM、BlockManager 和 Executor 内存，但各自拥有 TaskContext 和执行状态。

### 1.3 Task 中携带什么

概念上可以表示为：

~~~python
Task(
    stage_id=2,
    partition_id=5,
    attempt_number=0,
    execution_chain=...,
    serialized_function=...,
    dependency_info=...,
    broadcast_refs=...,
    task_context=...,
    output_mode="result | shuffle | external",
)
~~~

关键内容是：

- 执行哪个 Stage；
- 处理哪个 partition；
- 从哪里找到输入；
- 应该执行哪些函数和算子；
- 使用哪些广播变量、累加器和运行参数；
- 本次是该 partition 的第几次执行尝试。

Task 不携带整个数据集。输入数据通常由 Executor 根据 partition 描述在运行时读取。

### 1.4 Executor 如何获得用户代码

用户函数及其闭包在 Driver 端被序列化：

~~~python
offset = 10
mapped = rdd.map(lambda x: x + offset)
~~~

Executor 要获得的不只是 lambda 的函数逻辑，还包括它引用的 offset。JAR、Python 文件和其他依赖通常通过 Spark 的依赖分发、集群环境或容器镜像提供，不会随每条 record 重发完整源代码。

Executor 也不会重新运行整个 Driver 程序。Driver 已经确定当前 Task 的执行链，Executor 只执行该 Stage、该 partition 所需的部分。

### 1.5 PySpark 多了一层 Python Worker

PySpark 中，调度和 RDD 核心仍在 JVM Executor 内。遇到 Python 函数时，JVM Executor 会启动或复用 Python Worker：

~~~text
Driver 中的 Python 函数
    → 序列化并随 Task 下发
    → JVM Executor 启动或复用 Python Worker
    → 把函数、闭包和输入记录发送给 Python Worker
    → Python 执行 map/filter/mapPartitions
    → 结果序列化回 JVM
~~~

因此 PySpark 额外承担：

- JVM 与 Python 进程通信；
- Python 函数和对象序列化；
- Python Worker 启动或复用；
- 行式或 Arrow 批式数据转换。

Arrow、Pandas UDF 等可以降低批量数据交换成本，但不会改变“JVM Executor 调度 Task，Python Worker 执行 Python 代码”的基本关系。

### 1.6 RDD 不是数据容器，而是计算 partition 的描述

RDD 可以简化为：

~~~python
class RDD:
    id
    partitions
    dependencies
    partitioner
    storage_level

    def compute(partition, context):
        ...

    def iterator(partition, context):
        ...
~~~

RDD 主要记录：

1. 有哪些逻辑 partition；
2. 当前 partition 依赖哪些 parent partition；
3. 如何计算当前 partition；
4. 使用什么 Partitioner；
5. 是否要求缓存；
6. 哪些执行位置具有数据本地性。

Partition 也主要是描述：

~~~python
class Partition:
    rdd_id
    index
    input_split_or_parent_mapping
~~~

Partition(index=0) 的含义是“RDD 的第 0 个逻辑分区”，不表示 Driver 中已经保存了一份数组。它的实际 records 可能来自：

- HDFS 或对象存储的一个 input split；
- parent RDD 的 iterator；
- Executor 的缓存 block；
- Shuffle Read；
- checkpoint 文件；
- lineage 重算。

### 1.7 iterator 是 Task 执行 RDD 的核心入口

Executor 执行最终 RDD 的某个 partition 时，会请求它的 iterator。概念过程如下：

~~~python
def rdd_iterator(rdd, partition, context):
    if rdd.is_cached:
        cached = block_manager.get(rdd.id, partition.index)
        if cached is not None:
            return cached

    records = rdd.compute(partition, context)

    if rdd.is_cached:
        return block_manager.put_and_return_iterator(
            rdd.id,
            partition.index,
            records
        )

    return records
~~~

不同 RDD 的 compute 方法知道怎样得到自己的数据：

~~~python
class InputRDD(RDD):
    def compute(partition, context):
        return read_input_split(partition.input_split)


class MapPartitionsRDD(RDD):
    def compute(partition, context):
        parent_partition = dependency.get_parent(partition)
        parent_iter = parent.iterator(parent_partition, context)
        return function(parent_iter)


class ShuffledRDD(RDD):
    def compute(partition, context):
        return shuffle_manager.reader(
            shuffle_id,
            reduce_partition_id=partition.index
        ).read()
~~~

因此 Task 并不是一次性创建所有中间 RDD 数据，而是从最终 RDD 反向请求 iterator。

### 1.8 窄依赖为什么能在一个 Task 中流水线执行

以下 transformations 通常形成窄依赖：

~~~python
result = source.map(parse).filter(valid).flatMap(expand)
~~~

假设 source 有三个 partition，没有 Shuffle，那么一个 Stage 可以创建三个 Task：

~~~text
Task 0：读取 source partition 0 → parse → filter → expand
Task 1：读取 source partition 1 → parse → filter → expand
Task 2：读取 source partition 2 → parse → filter → expand
~~~

每个 Task 内部大致是：

~~~python
def execute_partition(partition_id):
    records = read_input_split(partition_id)

    for raw in records:
        parsed = parse(raw)

        if valid(parsed):
            for item in expand(parsed):
                yield item
~~~

一条 record 经过 map 后可以立即进入 filter，再进入 flatMap。中间 RDD 不必完整落盘，也不必把所有 records 同时放进内存。

这就是窄依赖流水线：

~~~text
parent iterator
    → map iterator
    → filter iterator
    → flatMap iterator
    → Stage 末端
~~~

### 1.9 数据是怎样进入 Task 的

#### 输入文件

HDFS、对象存储等输入通常先被切成 input split，再映射为输入 RDD partition：

~~~text
文件
  → input split
  → 输入 RDD partition
  → Task 根据 partition 描述读取对应范围
~~~

调度器会根据 preferred locations 尽量实现数据本地性，但能否本地读取取决于存储系统和集群部署。

#### 广播变量

较小的只读数据，例如模型参数或维度表，可以由 Driver 广播。Task 中通常携带广播引用，Executor 通过 BlockManager 获取并缓存广播块，而不是每条 TaskResult 都携带一份完整对象。

#### 累加器

Task 可以向 Driver 提交累加器更新，但 Task 可能重试，因此不能把累加器当作 exactly-once 的业务数据库。

#### Shuffle 数据

当当前 RDD 是 ShuffledRDD，iterator 不再直接读取一个 parent partition，而是从多个上游 Map Task 的 Shuffle 输出中拉取属于当前 reduce partition 的 blocks。完整过程在第二节展开。

### 1.10 Task 的输出是什么

Task 输出取决于 Stage 类型和末端算子。

#### 同一 Task 内的中间输出

窄依赖中间结果通常是 iterator 中的 record，直接传给下一个算子：

~~~python
def map_iterator(records, function):
    for record in records:
        yield function(record)
~~~

#### ShuffleMapTask 的输出

主要输出是 Executor 本地的 Shuffle data/index 文件，以及向 Driver 报告的 MapStatus。完整 Shuffle 数据不会发送给 Driver。

#### ResultTask 的输出

可能是：

- count 的局部计数；
- collect 的一部分 records；
- save 写入的 HDFS 文件；
- foreach 产生的外部副作用。

例如 count：

~~~text
Task 0 → 局部 count 120
Task 1 → 局部 count 95
Task 2 → 局部 count 130
Driver → 120 + 95 + 130
~~~

collect 会把 records 返回 Driver，数据过大可能造成 Driver OOM。

### 1.11 Lineage 和 Dependency 如何支持重算

RDD lineage 是由 RDD 对象及其 Dependency 连接形成的计算路径：

~~~text
HadoopRDD
   ↓ NarrowDependency
MapPartitionsRDD(parse)
   ↓ NarrowDependency
MapPartitionsRDD(filter)
   ↓ ShuffleDependency
ShuffledRDD(reduceByKey)
   ↓ NarrowDependency
MapPartitionsRDD(format)
~~~

Dependency 回答的是：

> 要计算当前 RDD 的这个 partition，需要哪些 parent 数据？

窄依赖通常能够把 child partition 映射到少量 parent partition。ShuffleDependency 则记录：

- parent RDD；
- shuffleId；
- Partitioner；
- Serializer；
- Aggregator；
- mapSideCombine；
- keyOrdering。

Driver 根据 Dependency 切分 Stage；Executor 根据 RDD 的 compute 和 Dependency 找到当前 partition 的输入。

### 1.12 Cache、Persist、Checkpoint 和 Lineage 的关系

#### Cache/Persist

~~~python
rdd.persist(StorageLevel.MEMORY_AND_DISK)
~~~

Persist 保存的是 RDD 的物理 partition block，目的主要是复用：

~~~text
第一次请求 partition
    → 按 lineage 计算
    → 放入 BlockManager
    → 返回 iterator

以后再次请求
    → 缓存命中
    → 直接读取 block
~~~

MEMORY_AND_DISK 的 disk 是 Executor 本地缓存存储。它仍属于可丢失的性能优化：

- Executor 退出，缓存可能丢失；
- block 被驱逐，也可能丢失；
- 丢失后通常沿 lineage 重算；
- persist 不会自动截断 lineage。

#### Checkpoint

~~~python
sc.setCheckpointDir("hdfs:///spark-checkpoints")
rdd.checkpoint()
rdd.count()
~~~

Checkpoint 把 RDD 的数据写入可靠存储。成功后，后续恢复可以从 checkpoint 数据开始，而不必回溯完整旧 lineage。

适合：

- 迭代次数很多，lineage 持续增长；
- 上游重算非常昂贵；
- 希望建立可靠恢复起点。

常见组合是先 persist 再 checkpoint，使 checkpoint Job 和后续使用能够复用已经算出的 partition：

~~~python
rdd.persist(StorageLevel.MEMORY_AND_DISK)
rdd.checkpoint()
rdd.count()
~~~

#### 两者的本质差别

~~~text
persist：
为了下次读取更快
数据可以丢
丢失后按 lineage 重算
不截断 lineage

checkpoint：
为了建立可靠恢复起点
写可靠分布式存储
成功后截断旧 lineage
写入成本通常更高
~~~

### 1.13 节点故障后怎样恢复

#### Task 失败

~~~text
Task attempt 失败
    → TaskScheduler 为同一 Stage、同一 partition 创建新 attempt
    → 可以换到另一个 Executor
~~~

#### 缓存 partition 丢失

~~~text
BlockManager 找不到缓存
    → 根据 RDD Dependency 找 parent
    → 沿 lineage 重算缺失 partition
    → 必要时重新缓存
~~~

#### Shuffle block 丢失

~~~text
下游 fetch 失败
    → Driver 将对应 Map 输出标记为不可用
    → 找到产生该 block 的上游 ShuffleMapStage
    → 重新运行相应 Map Task
    → 更新 MapStatus
    → 重试受影响的下游 Task
~~~

如果使用外部 Shuffle Service、Shuffle 数据迁移或可靠远程 Shuffle 存储，Executor 进程消失后，部分 Shuffle 文件仍可能可用。

#### Driver 故障

RDD DAG 和调度状态主要在 Driver 内存中。Driver 完全丢失时，普通 RDD lineage 本身通常不足以自动恢复整个应用。Structured Streaming 使用的查询 checkpoint 还会保存 source offset、batch/epoch 进度和状态存储元数据，这与普通 RDD checkpoint 不是同一层机制。

### 1.14 Lineage 容错的边界

能够按 lineage 正确重算，通常要求：

- 输入数据仍可读取；
- 用户函数和依赖仍存在；
- 计算逻辑具有确定性；
- 聚合函数满足所需的结合性和交换性；
- 外部副作用能够处理 Task 重试。

例如：

~~~python
rdd.foreach(lambda record: call_external_api(record))
~~~

Task 可能在调用一部分 API 后失联，然后被重新执行。Spark 可以恢复内部计算，但不能撤销已经发生的外部调用。外部写入需要幂等键、事务或两阶段提交等机制。

### 1.15 第一节总结

~~~text
RDD
= partitions + dependencies + compute/iterator 逻辑

Task
= 某个 Stage 对某个 partition 的一次执行尝试

Executor 执行 Task
= 请求最终 RDD partition 的 iterator
  + 沿窄依赖递归获得 parent iterator
  + 读取输入、缓存、checkpoint 或 Shuffle
  + 流水线执行用户函数

persist
= 可丢失的 partition 物理副本，用于加速复用

checkpoint
= 可靠存储中的恢复起点，用于截断 lineage

故障恢复
= 优先读取仍存在的数据，否则只重算受影响的 partition
~~~

---

## 第二节：Shuffle 的完整执行过程

### 2.1 总体过程

Shuffle 的本质是：

> 上游数据原来按照输入分区存放，现在要按新的 Partitioner 重新组织，使相关 records 进入同一个下游 partition。

完整过程分成 Shuffle Write 和 Shuffle Read：

~~~text
Driver 创建 ShuffleDependency
        │
        ▼
上游 ShuffleMapStage
  每个 Map Task：
    → 执行 Shuffle 前的窄依赖流水线
    → 为 record 计算目标 partitionId
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
    → 把 iterator 交给后续窄依赖算子
~~~

必须区分四件事：

| 概念 | 解决的问题 | 是否必然发生 |
|---|---|---|
| partition | record 交给哪个下游 Task | 所有 Shuffle 都需要 |
| combine | Map 端是否能先聚合相同 key | 可选 |
| key ordering | 分区内 key 是否必须有序 | 可选 |
| spill | 内存不足时怎样继续当前 Task | 需要时发生 |

### 2.2 为什么 Shuffle 会切分 Stage

窄依赖中，一个 child partition 只需读取少量确定的 parent partition，因此可以在同一个 Task 中流水线执行。

Shuffle 后，一个下游 partition 通常依赖所有上游 Map Task 写出的一个片段：

~~~text
Map Task 0 的 reduce-0 block ─┐
Map Task 1 的 reduce-0 block ─┼─> 下游 Task 0
Map Task 2 的 reduce-0 block ─┘
~~~

上游必须物化可定位的 Shuffle 输出，下游才能拉取。因此 ShuffleDependency 成为 Stage 边界。

### 2.3 下游 partition 和 Task 何时确定

初始目标分区数在 ShuffleDependency 创建时已经确定，一般来自：

- 用户传入的 numPartitions；
- spark.default.parallelism；
- spark.sql.shuffle.partitions；
- Partitioner 自身的 numPartitions；
- SQL 物理计划要求。

例如：

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

- 每个 Map 输出的位置；
- 每个 Shuffle block 的真实字节数；
- 空分区和数据倾斜；
- 是否需要 AQE 合并小分区、拆分倾斜分区或修改后续 Join。

所以不是先看上游产生多少 records，再决定下游分区数。经典 RDD API 的分区数通常预先确定；Spark SQL 的 AQE 可以利用运行时统计调整后续物理执行。

### 2.4 Partitioner 如何判断一条 record 属于哪个分区

是否 combine 与是否分区无关。每条进入 Shuffle 的 key-value record 都需要计算 partitionId：

~~~python
partition_id = partitioner.getPartition(key)
~~~

HashPartitioner 可近似理解为：

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

相同 key 使用同一个 Partitioner，会进入相同下游 partition。

也可以使用：

- RangePartitioner：按照采样得到的 key 范围分区；
- Round-robin：按轮转方式分布；
- 自定义 Partitioner；
- SQL Exchange 的 HashPartitioning 或 RangePartitioning。

它们都在回答：这条 record 最终由哪个下游 Task 处理？

### 2.5 没有 combine 时怎样写

没有 combine、没有业务 key 排序要求时，概念过程是：

~~~python
for key, value in upstream_iterator:
    partition_id = partitioner.getPartition(key)
    partition_output[partition_id].write(key, value)
~~~

一种 bypass 路径会为目标分区维护临时输出，Map Task 结束后再拼接：

~~~text
临时 partition-0 输出 ─┐
临时 partition-1 输出 ─┼─ 顺序拼接 ─> data 文件
临时 partition-2 输出 ─┘                index 文件
~~~

最终形式：

~~~text
data:
[partition 0 bytes][partition 1 bytes][partition 2 bytes]

index:
partition 0：offset 0 ～ A
partition 1：offset A ～ B
partition 2：offset B ～ C
~~~

下游 Task 1 根据索引只读取 A 到 B 的区间。

目标分区很多时，为每个分区管理临时写出通道很昂贵，因此 Spark 只在分区数和其他条件满足时选择 BypassMergeSortShuffleWriter 一类路径。

“不要求 key 排序”也不等于底层完全不整理顺序：

- sortByKey 的 key 排序是业务语义；
- Writer 按 partitionId 排列 records，是为了让各分区在文件中连续。

普通 reduceByKey 不承诺输出 key 有序，但 Sort-based Shuffle 仍可能按 partitionId 组织记录。

### 2.6 Combine 是 Map Task 内部的局部聚合

Map-side combine 指：

> 在跨网络发送前，一个 Map Task 先合并自己内部相同 key 的 values。

输入：

~~~text
Map Task 0：                   Map Task 1：
(a,1)                         (a,4)
(a,2)                         (b,5)
(b,3)                         (a,6)
~~~

reduceByKey 可以在 Map 端先聚合：

~~~text
Map 0：(a,3)、(b,3)
Map 1：(a,10)、(b,5)
~~~

网络传输由六条原始 record 减少为四条局部结果。下游仍要完成最终聚合：

~~~text
a：3 + 10 = 13
b：3 + 5  = 8
~~~

所以 combine 不是最终 reduce：

~~~text
Map 端 combine：只合并当前 Map Task 的相同 key
                         ↓
Shuffle Read
                         ↓
Reduce 端 combine：合并所有 Map Task 的局部结果
~~~

### 2.7 Aggregator 怎样执行 combine

Aggregator 可以抽象为三个函数：

~~~python
def create_combiner(value):
    return value

def merge_value(combiner, value):
    return combiner + value

def merge_combiners(left, right):
    return left + right
~~~

Map 端可使用以 (partitionId, key) 为逻辑键的聚合结构：

~~~python
for key, value in records:
    pid = partitioner.getPartition(key)

    if map.contains(pid, key):
        old = map.get(pid, key)
        map.put(pid, key, merge_value(old, value))
    else:
        map.put(pid, key, create_combiner(value))
~~~

带 partitionId 是因为 Writer 既要合并相同 key，也要按目标分区写出。

sum、count、min、max、Top K、集合去重和可合并统计摘要都适合 combine。平均值应将局部状态设计成 (sum, count)，而不是直接平均多个局部平均值。

聚合函数应满足算法需要的结合律，通常也应满足交换律。否则不同分区、执行顺序或重试可能产生不同结果。

### 2.8 groupByKey 为什么没有相同的压缩收益

groupByKey 要保留全部原始 values：

~~~text
a → [1,2,4,6]
~~~

即使 Map 端先构造 [1,2]，元素 1 和 2 最终仍要通过网络传输，并没有像 sum 那样压缩成一个局部数值。提前构造大集合还会增加 Map 端内存压力。

如果目标只是求和：

~~~python
# 传输全部 values
rdd.groupByKey().mapValues(sum)

# Map 端先传局部和
rdd.reduceByKey(lambda x, y: x + y)
~~~

后者通常更合适。

### 2.9 Spill 是什么

Shuffle 的排序 Buffer 或聚合 Map 可能持续增长。当 Task 不能再获得足够 execution memory 时，Spark 会把当前内存结果临时写到 Executor 本地磁盘：

~~~text
读取一部分输入
    → 内存排序/聚合结构增长
    → 内存不足
    → 写 spill-1
    → 释放内存
    → 继续读取
    → 写 spill-2
    → 输入结束
    → 归并 spills 和最后的内存结果
~~~

没有 combine 时，spill 文件保存一批待组织的 records；有 combine 时，通常保存当前已经局部聚合的 (key, combiner)。

例如：

~~~text
spill-1：(a,3)、(b,8)
spill-2：(a,4)、(c,6)
内存中：(a,5)、(b,2)

最终 merge：
a = 3 + 4 + 5
b = 8 + 2
c = 6
~~~

Spill 不会：

- 创建新 Stage；
- 创建新 partition；
- 把一个 Task 自动拆成多个 Task；
- 修改 lineage；
- 成为供未来 Job 复用的持久化数据。

它只是同一个 Task 内部的临时存储。代价是序列化、磁盘 I/O、排序和多路归并。少量 spill 是正常的兜底机制；大量重复 spill 常见于分区过大、数据倾斜、聚合状态过大或 execution memory 紧张。

### 2.10 Writer 为什么有不同实现

Writer 选择受以下因素影响：

- 是否 map-side combine；
- 是否有 keyOrdering；
- 目标分区数；
- Serializer 能力；
- Spark 版本和配置。

概念上的主要路径：

| 场景 | 结构或路径 | 主要动作 |
|---|---|---|
| 无 combine、满足 bypass 条件 | Bypass 类 Writer | 按分区写临时输出并拼接 |
| 无 combine、Sort-based Shuffle | Buffer 或序列化 Buffer | 按 partitionId 组织，可 spill |
| 有 combine | AppendOnlyMap 类结构 | 按 (partitionId, key) 更新状态，可 spill |
| 要求 key 有序 | ExternalSorter 类结构 | 按 partitionId 和 key 排序、spill、merge |

无论使用哪种实现，最终都必须生成可供下游按 partitionId 读取的 Shuffle blocks。

### 2.11 Shuffle Write 完成后保存什么

每个 ShuffleMapTask 通常留下：

~~~text
data 文件
    = 各目标分区的数据连续排列

index 文件
    = 每个目标分区在 data 文件中的偏移

MapStatus
    = Map 输出位置和各 block 的大小摘要
~~~

MapStatus 报告给 Driver 侧 MapOutputTracker。Shuffle 数据本身不会完整传给 Driver，仍保存在 Executor 本地磁盘、外部 Shuffle Service 或配置的远程 Shuffle 存储中。

假设三个 Map Task、两个目标分区：

~~~text
Map 0 data：[reduce-0 block][reduce-1 block]
Map 1 data：[reduce-0 block][reduce-1 block]
Map 2 data：[reduce-0 block][reduce-1 block]
~~~

逻辑上有 3 × 2 个 block，但 Sort-based Shuffle 通常让一个 Map Task 使用一个 data 文件加一个 index 文件，而不是永久保留两个独立数据文件。

### 2.12 Shuffle Read 怎样拉取数据

下游 Task i 只读取所有 Map 输出中的 reduce partition i：

~~~text
Map 0 的 reduce-0 block ─┐
Map 1 的 reduce-0 block ─┼─> 下游 Task 0
Map 2 的 reduce-0 block ─┘
~~~

执行步骤：

1. 向 MapOutputTracker 查询 MapStatus；
2. 区分本地、同主机和远程 blocks；
3. 本地直接读取，远程通过 BlockTransferService 拉取；
4. 解压和反序列化；
5. 根据 ShuffleDependency 做最终聚合或排序；
6. 内存不足时在 Read 端 spill；
7. 把结果 iterator 交给当前 Stage 后续窄依赖算子。

Map-side combine 后，Reduce 端仍要合并不同 Map Task 的局部状态。groupByKey 则需要在下游组织全部 values。

### 2.13 用 reduceByKey 贯穿完整 Shuffle

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

假设输入分区：

~~~text
上游 partition 0：              上游 partition 1：
(a,1)、(b,2)、(a,3)             (c,4)、(b,5)、(a,6)
~~~

Driver 创建：

~~~text
Stage 0：两个 ShuffleMapTask
Stage 1：两个 ResultTask
HashPartitioner(2)
mapSideCombine = true
Aggregator = 加法
~~~

Map Task 0 局部 combine：

~~~text
(a,1) → a=1
(b,2) → b=2
(a,3) → a=4

结果：(a,4)、(b,2)
~~~

Map Task 1 局部 combine：

~~~text
(c,4) → c=4
(b,5) → b=5
(a,6) → a=6

结果：(c,4)、(b,5)、(a,6)
~~~

假设 a、c 进入 partition 0，b 进入 partition 1：

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
最终聚合：(a,10)、(c,4)
~~~

下游 Task 1：

~~~text
拉取 Map 0 reduce-1：(b,2)
拉取 Map 1 reduce-1：(b,5)
最终聚合：(b,7)
~~~

最终 RDD：

~~~text
partition 0：(a,10)、(c,4)
partition 1：(b,7)
~~~

collect 再把最终 records 返回 Driver。这是 ResultTask 的结果返回，不是前面按 key 重新分区的 Shuffle。

### 2.14 不同算子的 Shuffle 语义

#### repartition

只改变数据分布，没有相同 key 的聚合语义：

~~~text
计算新 partitionId → Shuffle Write → Shuffle Read
~~~

#### groupByKey

必须保留全部原始 values：

~~~text
Map 端发送原始 values → 下游按 key 组成 values 集合
~~~

#### reduceByKey

可以压缩局部状态：

~~~text
Map 端 combine → 发送局部结果 → Reduce 端最终 combine
~~~

#### sortByKey

通常先采样生成 RangePartitioner，再保证分区范围有序和分区内 key 有序：

~~~text
partition 0 key 范围
    < partition 1 key 范围
    < partition 2 key 范围
~~~

#### join

两个大 Pair RDD 没有兼容 Partitioner 时，通常都要按 Join key Shuffle。Spark SQL 中，如果一侧足够小，可以使用 Broadcast Hash Join 绕开大表 Shuffle；SortMergeJoin 则通常要求两侧按 Join key 重新分布并排序。

### 2.15 Shuffle 丢失怎样恢复

如果保存 Map 输出的 Executor 故障：

~~~text
下游 Task FetchFailed
    → Driver 将对应 MapStatus 标记为不可用
    → 根据 ShuffleDependency 找到上游 ShuffleMapStage
    → 重跑产生丢失输出的 Map Task
    → 在新位置生成 Shuffle 文件
    → 更新 MapStatus
    → 重新运行受影响的下游 Task
~~~

恢复依赖的是 ShuffleDependency、Stage DAG、shuffleId、mapId、reduceId 和 MapStatus，而不是下游 Task保存了一份上游完整数据。

### 2.16 如何诊断 Shuffle 性能

Spark UI 中重点观察：

- Shuffle Write/Read Size；
- Shuffle Records；
- Remote Bytes Read；
- Fetch Wait Time；
- Spill (Memory/Disk)；
- Peak Execution Memory；
- 各 Task Duration 和输入大小分布；
- 是否只有少数 Task 特别大。

判断路径：

~~~text
Shuffle 总量大
    → 提前 filter、列裁剪、使用可 combine 的聚合

所有分区都很大并频繁 spill
    → 增加合理分区数，降低单 Task 数据量

大量极小 Task
    → 减少分区数或使用 AQE 合并

只有少数 Task 巨大
    → 数据倾斜；检查热点 key、AQE skew join、广播或热点拆分

Fetch Wait 很高
    → 检查网络、磁盘、block 数量、Executor 丢失和数据本地性
~~~

不能看到 spill 就只增加 Executor 总内存。热点 key 仍可能集中到一个 Task，应该先判断是整体分区过大还是数据倾斜。

### 2.17 第二节总结

~~~text
ShuffleDependency
    = Partitioner
    + Aggregator
    + mapSideCombine
    + keyOrdering
    + Serializer

Shuffle Write
    = 执行上游 partition
    + 计算每条 record 的 partitionId
    + 可选 Map 端 combine
    + 可选排序
    + 必要时 spill
    + 写 data/index
    + 报告 MapStatus

Shuffle Read
    = 下游 Task 查询所有 Map 输出
    + 拉取自己的 reduce partition blocks
    + 最终聚合或排序
    + 必要时 spill
    + 输出下游 RDD partition iterator
~~~

三个关键问题的最终答案：

1. **没有 combine 时怎样确定分区**：仍然通过 Partitioner.getPartition(key) 计算 partitionId；combine 与分区判定是两件事。
2. **combine 是什么**：一个 Map Task 在发送前，对自己内部相同 key 的 values 做局部聚合；不同 Map Task 的局部结果仍由下游合并。
3. **spill 是什么**：当前 Task 的排序或聚合结构放不进执行内存时，将中间结果临时写入 Executor 本地磁盘，释放内存后继续处理，最后归并；它不会改变 Stage、Task 数量或 partition 数。

