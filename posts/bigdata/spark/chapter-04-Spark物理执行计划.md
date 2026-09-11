# 第四章：Spark 物理执行计划

> 本章核心：Spark 如何依据 RDD 依赖把逻辑 DAG 切成 Stage，并进一步生成 Task。



### 第三步：按分区生成 Task

一个 Stage 通常根据最后一个 RDD 的 partition 数量生成对应数量的 Task。每个 Task 负责该 Stage 最终 RDD 的一个 partition。


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
