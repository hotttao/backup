# 第四章：Spark 物理执行计划

> 本章核心：Spark 如何依据 RDD 依赖把逻辑 DAG 切成 Stage，并进一步生成 Task。

## 1. 为什么需要物理执行计划

逻辑处理流程只描述 RDD、操作和依赖关系，并没有说明“哪个分区由哪个 task 处理”。Spark 需要把逻辑流程转换为实际可调度的 Job、Stage 和 Task。

如果每个算子都单独成为 task，会产生大量 task 和中间数据；如果把所有操作塞进一个 task，又会导致 task 过大、重复计算和并行度不足。因此 Spark 以 ShuffleDependency 为边界进行阶段划分。

## 2. 生成物理计划的三步

### 第一步：Action 产生 Job

每遇到一个 action，Spark 就以该 action 的结果为终点，从输入数据回溯形成一个 Job。一个 Application 可以因为多个 action 产生多个 Job，Job 按 action 调用顺序提交。

### 第二步：按宽依赖切 Stage

从 Job 最终 RDD 向前回溯：

- 遇到窄依赖：继续向前纳入同一个 Stage；
- 遇到宽依赖：停止当前回溯，在 Shuffle 边界切开，形成新的 Stage。

因此，Stage 内部主要由窄依赖连接，可以流水线执行；Stage 之间通过 Shuffle Write 和 Shuffle Read 交换数据。

### 第三步：按分区生成 Task

一个 Stage 通常根据最后一个 RDD 的 partition 数量生成对应数量的 Task。每个 Task 负责该 Stage 最终 RDD 的一个 partition。

## 3. Stage 内的流水线计算

窄依赖允许多个算子在同一个 Task 中串联执行。例如：

```text
读取 record
→ map
→ filter
→ flatMap
→ 输出结果
```

中间结果可以直接从一个算子传给下一个算子，不必完整保存整个中间 RDD。这减少了内存和磁盘占用，也降低了中间数据管理成本。

但 `mapPartitions` 等分区级操作可能需要一次性读取或保留较多分区数据，因此流水线并不意味着所有中间数据都只占一个 record 的空间。

## 4. Stage 之间的 Shuffle

宽依赖要求上游数据重新划分：

1. 上游 Task 根据 Hash 或 Range 等规则把输出写入不同分区，这一步是 Shuffle Write。
2. 下游 Task 从上游多个 Task 的输出中读取属于自己的分区，这一步是 Shuffle Read。
3. 下游 Task 将来自多个上游分区的数据聚合或排序后继续执行。

Shuffle 是网络、磁盘和内存协同的边界，也是 Spark 性能优化的重点。

## 5. Task 的两种典型类型

- ShuffleMapTask：输出需要被重新分区并供下游 Stage 读取。
- ResultTask：直接产生最终结果，汇总到 Driver 或写入外部存储。

Spark 不像 MapReduce 那样简单区分 map stage 和 reduce stage，因为一个 Stage 内可以同时包含多种 RDD 操作。

## 6. Stage 执行顺序

Stage 之间仍然是 DAG 关系：没有上游依赖的 Stage 可以并行启动；只有当所有上游 Stage 完成后，下游 Stage 才能运行。同一 Stage 内各 Task 通常相互独立，可以并行执行。

## 7. 典型依赖对应的执行方式

- OneToOneDependency：一个 Stage，Task 对应处理一个上游分区。
- RangeDependency：通常一个 Stage，按分区范围合并处理。
- ManyToOneDependency：一个 Stage，一个 Task 可能读取多个上游分区。
- ManyToManyDependency：仍可属于窄依赖，一个 Task 可能读取多个 parent 分区。
- 单一 ShuffleDependency：通常切成上游、下游两个 Stage。
- 多个 ShuffleDependency：每个 Shuffle 边界都可能形成新的 Stage。

`join` 是否产生 Shuffle，取决于参与 join 的 RDD 是否已有兼容的 partitioner。若分区器一致，可能只需窄依赖；若不一致，则需要重新分区。

## 8. 如何用 Spark UI 分析物理计划

建议按以下顺序查看：

1. Job 页面：确认 action 产生的 Job 数量。
2. Job Details：查看 Job 包含的 Stage。
3. DAG Visualization：观察 Stage 之间的依赖和 Shuffle 边界。
4. Stage Details：查看每个 Stage 的 RDD、Task 数量和 Shuffle 指标。
5. Task 指标：关注 Shuffle Read/Write、Input Size、GC Time、执行时间和数据本地性。

## 9. 本章必须掌握

```text
Action → Job
ShuffleDependency → Stage 边界
Stage 最后一个 RDD 的分区数 → 通常决定 Task 数
窄依赖 → Stage 内流水线
宽依赖 → Shuffle Write + Shuffle Read
ShuffleMapTask → 产生 Shuffle 输出
ResultTask → 产生最终结果
```

本章之后，理解 Spark 性能问题的入口就很明确：先看 Job/Stage 划分，再看分区数量，最后看 Shuffle 和 Task 指标。

