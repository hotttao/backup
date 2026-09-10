# 第三章：Spark 逻辑处理流程

> 本章核心：Spark 如何把用户写的算子链转换成 RDD、Partition 和 Dependency 组成的逻辑 DAG。

## 1. 逻辑流程的四个组成部分

1. 数据源：本地文件、HDFS、HBase 或内存集合等。
2. 数据模型：Spark 用 RDD 统一表示输入、输出和中间数据。
3. 数据操作：Transformation 构造新的 RDD，Action 触发 Job 并产生结果。
4. 结果处理：结果可以写回分布式存储，也可以汇总到 Driver。

RDD 是逻辑抽象，未缓存时并不代表常驻内存中的完整数据；真正的数据在 task 计算时产生。RDD 的数据被划分为多个 partition，由不同 task 并行处理。

## 2. RDD 的关键特征

- 不可变：操作不会修改原 RDD，而是生成新 RDD。
- 分区：RDD 可以拆成多个 partition，实现数据并行。
- 依赖：RDD 记录如何从 parent RDD 得到当前数据。
- 可计算：RDD 保存生成数据所需的计算逻辑。
- 可持久化：通过 `cache()`/`persist()` 保存可复用结果。

RDD 不等于数据本身，更像是“分布式数据及其生成方法”的描述。

## 3. Transformation 与 Action

Transformation 如 `map`、`filter`、`flatMap`、`join`、`groupByKey` 返回新的 RDD，主要用于构造逻辑流程。

Action 如 `count`、`collect`、`reduce`、`saveAsTextFile` 对结果做后处理，并触发 Job 执行。

这种设计形成惰性计算，使 Spark 能在执行前看到完整算子链，进行流水线合并、Stage 切分和缓存复用。

## 4. Dependency：RDD 之间如何连接

Spark 根据算子语义和分区方式，把依赖分为两大类。

### 窄依赖 Narrow Dependency

child RDD 的一个 partition 只依赖 parent RDD 的少量 partition，通常可以在同一个 Stage 中流水线执行，不需要 Shuffle。

常见形式：

- 一对一：`map`、`filter` 等前后分区一一对应；
- 区域依赖：`union` 等按分区范围映射；
- 多对一：某个 child 分区依赖多个 parent 分区的全部数据；
- 多对多：如 `cartesian` 的特殊依赖关系。

### 宽依赖 Shuffle Dependency

child RDD 的 partition 需要 parent RDD 各分区的一部分数据，数据必须按 Key 重新分区、写出和读取，因此产生 Shuffle，并成为 Stage 边界。

判断重点不是“算子名字”，而是数据是否需要跨分区重新分配。

## 5. Partition 与 Partitioner

Partition 决定数据并行度和 task 数量。常见分区方式：

- 水平分区：按数据位置或输入 block 切分；
- HashPartitioner：按 Key 的 hash 值分区，常用于聚合和 Shuffle；
- RangePartitioner：按值域范围分区，常用于全局排序。

分区数量会影响并行度、任务调度、Shuffle 数据量和单 task 的内存压力。

## 6. RDD 的计算方式

普通 `map` 是逐 record 处理；`mapPartitions` 以整个 partition 为单位处理。后者适合复用连接、批量初始化资源或进行分区级操作，但需要注意单个 partition 的内存和资源消耗。

## 7. 常用 Transformation 的理解

- `map`：一条输入产生一条输出，通常保持分区结构。
- `flatMap`：一条输入产生零条或多条输出。
- `filter`：过滤 record，通常是窄依赖。
- `mapValues`：只改变 Value，通常保留原有 partitioner。
- `reduceByKey`：按 Key 局部聚合后再 Shuffle，通常比 `groupByKey` 更节省网络和内存。
- `groupByKey`：按 Key 汇集全部 Value，表达直接但可能产生较大 Shuffle 数据。
- `join`/`cogroup`：对多个 Key-Value RDD 按 Key 关联，通常需要 Shuffle。
- `sortByKey`/`sortBy`：通过 Range 分区和分区内排序实现全局有序。
- `union`：合并多个 RDD，通常不需要 Shuffle，但分区数会累加。
- `intersection`/`subtract`：通常需要按 Key 进行重新组织。
- `coalesce`：减少分区，可选择是否 Shuffle；直接缩减可能导致分区不均衡。
- `repartition`：通过 Shuffle 重新调整分区数量。

## 8. 常用 Action 的理解

- `count`：各 partition 局部计数，再汇总到 Driver。
- `collect`：将全部数据拉回 Driver，数据大时容易 OOM。
- `countByKey`/`countByValue`：结果通常在 Driver 端 Map 中聚合，不适合大结果集。
- `reduce`/`fold`/`aggregate`：先局部聚合，再做全局聚合。
- `treeReduce`/`treeAggregate`：用树形聚合降低 Driver 的单点压力。
- `take`/`first`/`top`：只取部分数据，但仍需谨慎处理 Driver 端结果规模。
- `foreach`/`foreachPartition`：执行副作用，不生成新 RDD。
- `saveAsTextFile` 等：直接将分区结果写到分布式文件系统。

## 9. Spark 相比 MapReduce 的取舍

Spark 更通用，因为它用 RDD、丰富算子和 DAG 表达复杂流程；也更易用，因为用户不必手动拆 Job、设计 map/reduce 和管理中间文件。

但 Spark 不是普通内存程序：RDD 操作仍然是粗粒度、不可变的。粗粒度限制换来了更好的并行化、流水线执行和容错能力；不可变性使框架可以依赖血缘关系重算丢失分区。

## 10. 本章必须掌握

```text
RDD = 分区数据 + 计算逻辑 + 依赖关系
窄依赖 → 可流水线 → 通常不切 Stage
宽依赖 → 需要 Shuffle → 通常切 Stage
Transformation → 构造逻辑图
Action → 触发 Job
Partition 数量 → 通常决定 Task 数量
```

下一章将继续回答：逻辑 DAG 如何被转换成可执行的 Stage、Task 和 Shuffle 过程。

