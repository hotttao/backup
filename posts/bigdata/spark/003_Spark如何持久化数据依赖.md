# Spark 是如何持久化数据依赖的

## 1. 先给结论

Spark 的容错核心不是把每一步完整数据都复制一份，而是保存：

1. RDD 的 lineage：数据如何从输入一步步计算出来；
2. RDD 的 Dependency：当前 RDD 的 partition 依赖哪些 parent partition；
3. 输入、缓存和 Shuffle 的定位信息；
4. Task 和 Stage 的执行元数据；
5. 必要时写入可靠存储的 checkpoint。

节点故障后，Spark 根据这些信息定位丢失的 partition，只重新计算受影响的部分，而不是默认重跑整个 Job。

```text
RDD 元数据 + Dependency
        ↓
      lineage
        ↓
Stage / Task 划分
        ↓
缓存、Shuffle、Checkpoint 定位
        ↓
故障后只恢复丢失的 partition
```

## 2. Spark 持久化的对象是什么

| 对象 | 保存的内容 | 主要作用 |
|---|---|---|
| RDD lineage | 计算关系和依赖描述 | 丢失数据后重新计算 |
| Cache / Persist | 某个 RDD partition 的计算结果 | 加速重复使用 |
| Checkpoint | 可靠存储中的 RDD 数据 | 截断过长 lineage |
| Shuffle 文件 | 按下游 partition 切分的中间结果 | 让下游 Stage 读取 |

Spark 通常不会持久化每个 RDD 的全部中间结果。没有 cache/persist 的 RDD，主要靠 lineage 按需计算；设置缓存后，具体 partition 才会交给 BlockManager 管理。

## 3. RDD 如何记录数据依赖

可以把 RDD 简化为：

```python
class RDD:
    id: int
    partitions: list[Partition]
    dependencies: list[Dependency]
    compute: callable
    preferred_locations: callable
    partitioner: Partitioner | None
    storage_level: StorageLevel | None
```

字段含义：

- id：RDD 唯一标识；
- partitions：当前 RDD 有哪些逻辑 partition；
- dependencies：如何依赖 parent RDD；
- compute：给定一个 partition 时如何计算；
- preferred_locations：哪些节点更适合执行；
- partitioner：键值数据使用什么分区规则；
- storage_level：是否缓存以及缓存方式。

RDD 通常不保存所有 record，而是保存“如何得到 record”的信息。这是 lineage 的基础。

## 4. Dependency 中记录了什么

### 4.1 窄依赖 NarrowDependency

窄依赖表示一个下游 partition 只依赖少量上游 partition，常见于 map、filter、flatMap。

```text
parent partition 0 ─────→ child partition 0
parent partition 1 ─────→ child partition 1
parent partition 2 ─────→ child partition 2
```

窄依赖的特点：

- 可以在同一个 Task 内连续执行多个算子；
- 不需要等待所有上游数据；
- 上游 partition 丢失时，只需重算对应的依赖链；
- 通常不产生 Shuffle 文件。

### 4.2 宽依赖 ShuffleDependency

宽依赖表示一个下游 partition 依赖多个上游 partition 的部分输出，常见于 reduceByKey、groupByKey、join 和 repartition。

```text
上游 partition 0 ─┐
上游 partition 1 ─┼─→ 下游 reduce partition 0
上游 partition 2 ─┘
```

概念上需要记录：

```python
class ShuffleDependency:
    parent_rdd
    shuffle_id
    partitioner
    serializer
    aggregator
    map_side_combine
```

关键字段说明：

- parent_rdd：Shuffle 的上游 RDD；
- shuffle_id：标识一次 Shuffle；
- partitioner：决定 key 映射到哪个下游 partition；
- serializer：记录如何编码 Shuffle 数据；
- aggregator：可选的聚合逻辑；
- map_side_combine：是否先在上游做局部聚合。

宽依赖是 Stage 的边界，因为下游 Task 要从多个上游 Task 拉取 Shuffle 分片。

## 5. Lineage 如何组织

```python
rdd0 = sc.textFile("hdfs:///input")
rdd1 = rdd0.map(parse)
rdd2 = rdd1.filter(is_valid)
rdd3 = rdd2.map(lambda x: (x.key, x.value))
rdd4 = rdd3.reduceByKey(add)
rdd4.count()
```

逻辑依赖关系：

```text
HadoopRDD
   ↓ narrow
MapPartitionsRDD(parse)
   ↓ narrow
MapPartitionsRDD(filter)
   ↓ narrow
MapPartitionsRDD(to_pair)
   ↓ shuffle
ShuffledRDD(reduceByKey)
   ↓ narrow
ResultTask(count)
```

Driver 保存这些 RDD 对象和依赖关系，形成计算图。如果 RDD4 的某个 partition 丢失，Spark 会沿图向上寻找可用的输入、缓存块或 Shuffle 输出，从最近的可用位置重新计算。

## 6. Stage、Task 如何使用 Dependency

Action 触发后，DAGScheduler 从最终 RDD 反向遍历依赖：

```text
遇到 NarrowDependency
    → 继续放入当前 Stage

遇到 ShuffleDependency
    → 切断当前 Stage
    → 创建上游 ShuffleMapStage
```

例如：

```text
Stage 0：读取输入 → parse → filter → map → Shuffle Write
Stage 1：Shuffle Read → reduceByKey → count
```

每个 Task 至少需要知道：

```python
Task(
    stage_id,
    partition_id,
    attempt_number,
    rdd_or_plan,
    dependency_info,
    task_context,
)
```

partition_id 决定本次 Task 处理哪个逻辑分区；RDD 的 compute 和 Dependency 决定如何找到这个分区的数据。

## 7. Shuffle 元数据如何支持恢复

上游 ShuffleMapTask 完成后，会写本地 Shuffle 文件，并向 Driver 汇报输出元数据。概念上类似：

```python
MapStatus(
    shuffle_id=7,
    map_task_id=12,
    host="worker-2",
    blocks={
        0: {"offset": 0, "length": 1024},
        1: {"offset": 1024, "length": 4096},
        2: {"offset": 5120, "length": 800},
    },
)
```

实际实现更复杂，但恢复所需的信息可以理解为：

- 哪个 Shuffle；
- 哪个上游 Map Task；
- Map Task 是否成功；
- 每个下游 partition 对应的 Shuffle block 在哪里；
- block 的大小、位置和读取状态；
- block 不可用时，应该重新运行哪个上游 Task。

下游 Task 不从 Driver 获取完整 Shuffle 数据，而是先通过 MapOutputTracker 查询 block 位置，再从对应 Executor 或外部 Shuffle 服务拉取。

## 8. 不同故障如何恢复

### 8.1 Task 执行失败

```text
Task 失败
  → TaskScheduler 重试同一个 partition
  → 可更换 Executor 或执行位置
  → 成功后继续 Stage
```

因为 Task 带有相同的 stage_id 和 partition_id，所以可以只针对丢失的分区重新创建执行尝试。

### 8.2 Executor 节点丢失

Executor 丢失后，可能同时丢失：

- 该 Executor 上缓存的 RDD block；
- 尚未被可靠保存的 Shuffle 文件；
- 正在运行的 Task；
- Python Worker 和 JVM 内部运行状态。

恢复方式：

```text
缓存 RDD 丢失
    → 沿 lineage 重算该 RDD 的丢失 partition

Shuffle 输出丢失
    → 重新运行产生这些 block 的上游 Task

ResultTask 失败
    → 重新执行对应的结果 partition
```

如果 Shuffle 文件由外部 Shuffle 服务或可靠远程存储管理，Executor 进程消失后，Shuffle 数据可能仍可读，从而减少重算。

### 8.3 缓存数据丢失

Cache/Persist 是性能优化，不是默认的可靠副本。缓存 block 被驱逐或所在 Executor 失效时：

```text
BlockManager 找不到 block
    → 根据 RDD lineage 找 parent
    → 重新执行计算链
    → 重新生成该 partition
```

如果配置了副本级别，也可能直接从其他节点读取副本。

### 8.4 Driver 故障

普通 RDD lineage 主要保存在 Driver 的内存对象中。Driver 进程彻底丢失后，仅依赖内存中的 RDD DAG 通常无法自动恢复整个应用。

长期运行的 Structured Streaming 作业需要额外 checkpoint，保存 source 位点、查询进度、算子状态以及恢复所需的元数据。RDD 的 checkpoint 主要解决 RDD lineage 过长和中间结果可靠保存问题，不能替代流式查询的完整状态 checkpoint。

## 9. Cache、Checkpoint 和 Shuffle 的区别

### Cache / Persist

```python
rdd.persist(StorageLevel.MEMORY_AND_DISK)
```

- 在 Task 正常计算 partition 时写入 BlockManager；
- 主要目标是加速后续 Job 或迭代；
- 缓存 block 丢失后通常沿 lineage 重算；
- 可以选择内存、磁盘、序列化和副本策略；
- 不一定截断 lineage。

### Checkpoint

```python
rdd.checkpoint()
```

- 把 RDD 数据写入可靠的分布式存储；
- 通常需要额外的 Job；
- 成功后可以从 checkpoint RDD 作为新的恢复起点；
- 会截断原有 lineage，避免长期沿很长依赖链恢复；
- 适合迭代很多轮、lineage 很长或重算代价很高的 RDD。

常见实践：

```python
rdd.persist(StorageLevel.MEMORY_AND_DISK)
rdd.checkpoint()
rdd.count()  # 触发计算，确保 checkpoint 生成
```

先缓存可以避免 checkpoint 过程和后续使用重复计算，但会额外消耗存储空间。

### Shuffle

Shuffle 是计算过程中的中间持久化结果：

- 上游 Task 按分区器写出多个 Shuffle block；
- 下游 Task 根据 block 元数据拉取所需数据；
- 主要目的不是缓存复用，而是跨 Stage 重新分区；
- Shuffle 文件丢失时，需要重新执行生成这些文件的上游 Task。

## 10. 依赖信息能否保证正确恢复

RDD lineage 能恢复的前提是：

1. 输入数据仍可重新读取；
2. 用户函数和依赖包仍可获得；
3. 计算逻辑具有确定性；
4. 聚合函数满足业务需要的结合性、交换性或幂等性；
5. 外部副作用不会因 Task 重试而产生错误重复。

例如：

```python
rdd.foreach(lambda x: call_external_api(x))
```

如果 Task 执行到一半后失联，Spark 可能重试该 Task，外部 API 可能被调用两次。Spark 可以恢复内部 RDD 计算，但不能自动撤销外部系统已经发生的副作用。

写外部系统时应使用幂等写入、业务唯一键、事务或两阶段提交，并明确至少一次或精确一次语义。

## 11. 一次节点故障的完整流程

假设 Stage 0 已经产生 Shuffle，Stage 1 正在读取时，保存某些 Shuffle 文件的 Executor 宕机：

```text
1. Driver 发现 Executor 失联。
2. 相关 block 被标记为不可用。
3. Stage 1 中读取这些 block 的 Task 失败。
4. DAGScheduler 根据 ShuffleDependency 找到 Stage 0。
5. 重新提交 Stage 0 中能产生丢失 block 的 Map Task。
6. 新 Executor 写出新的 Shuffle block。
7. 更新 block 的位置元数据。
8. 重试 Stage 1 中失败的下游 Task。
9. 下游 Task 重新拉取 Shuffle 数据并继续计算。
```

如果丢失的是普通缓存 RDD，则只需沿 lineage 重算缺失 partition；如果丢失的是 checkpoint，则需要从更早的可靠输入或其他可用 checkpoint 恢复。

## 12. 最后建立一个准确的心智模型

```text
RDD
= partition 集合 + 依赖关系 + compute 逻辑

Dependency
= 当前 partition 如何找到 parent partition

Lineage
= 从当前 RDD 回溯到输入的完整计算路径

Stage
= 由 Shuffle 边界切分出的执行阶段

Task
= 某个 Stage 对某个 partition 的一次执行尝试

Cache
= 可丢失的性能优化结果

Shuffle
= 为下游 partition 准备的中间数据

Checkpoint
= 可靠存储中的恢复起点
```

Spark 的容错本质是：

```text
优先读取仍然存在的 partition / cache / shuffle
        ↓ 读取不到
根据 Dependency 沿 lineage 回溯
        ↓
只重算丢失的 partition 或丢失的 Shuffle 输出
        ↓
必要时从 checkpoint 截断点继续
```

面试时可以这样回答：

> Spark 不是通过持久化每一步完整数据来容错，而是由 RDD 保存 partition、Dependency、compute 逻辑和 lineage。Driver 根据这些依赖划分 Stage，并记录 Shuffle 输出的位置信息。Executor 故障后，如果丢失的是缓存 partition，Spark 会沿 lineage 重算；如果丢失的是 Shuffle block，则重新执行生成该 block 的上游 Map Task；如果设置了 checkpoint，则可以从可靠存储中的 checkpoint RDD 继续，避免沿很长的 lineage 重算。Task 的重试由 stage、partition 和 attempt 信息控制。需要注意，RDD lineage 只能恢复 Spark 内部计算，外部副作用必须通过幂等写入或事务机制自行保证正确性。
