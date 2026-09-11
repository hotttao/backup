# 第三章：Spark 逻辑处理流程

> 本章核心：Spark 如何把用户写的算子链转换成 RDD、Partition 和 Dependency 组成的逻辑 DAG。





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

