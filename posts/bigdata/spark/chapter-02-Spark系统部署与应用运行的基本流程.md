# 第二章：Spark 系统部署与应用运行的基本流程

> 本章定位：把第一章的系统地图落到 Spark 的真实运行过程，重点理解 Driver、Executor、Task、RDD、Job、Stage 之间的关系。

## 1. Spark 的部署方式

Spark 可以运行在 Standalone、YARN、Mesos、Kubernetes 等环境中。Standalone 由 Spark 自己负责资源管理和调度，YARN/Mesos 等模式则依赖外部集群管理器。

本章使用 Standalone 便于观察 Spark 自身结构。没有集群时，也可以使用 local 模式在 IDE 中运行，但此时 Driver 和 task 基本都在本机运行，无法体现真实的网络通信和资源调度过程。

## 2. Spark 集群中的核心角色

```text
Master
  └─ 管理 Worker、接收应用、分配资源
Worker
  └─ 启停并监控 Executor
Driver
  └─ 运行应用 main 函数、生成 Job、协调执行
Executor
  └─ JVM 进程，持有线程池并运行 task
Task
  └─ 处理一个数据分区的最小执行单元
```

一个 Spark Application 通常包含一个 Driver 和多个 Executor；一个 Executor 可以运行多个 task，但这些 task 都属于同一个 Application。

Driver 不等同于 Master。Master 是集群级别的资源管理进程，Driver 是某个具体应用的驱动进程。在 YARN 模式下 Driver 可能运行在集群容器中，在 client 模式下也可能运行在提交应用的机器上。

## 3. 为什么 Spark 的 task 使用线程

Hadoop MapReduce 往往为每个 task 启动独立 JVM，隔离性好，但进程启动成本高，task 之间共享数据困难。

Spark 通常在 Executor JVM 内以线程运行多个 task，优点是：

- 减少进程启动和初始化开销；
- 方便同一 Executor 内的 task 共享数据和缓存；
- 提高资源利用率。

代价是线程之间会竞争 Executor 资源，日志也更容易混杂；一个 task 的内存问题还可能影响同一 Executor 中的其他 task。

## 4. GroupByTest 示例的执行过程

示例应用先生成若干 `<Key, Value>` 记录，再通过 `groupByKey()` 聚合相同 Key 的记录。

关键流程：

1. `SparkSession` 初始化运行环境并创建 Driver。
2. `parallelize()` 将普通 Scala 集合转换为 Spark 可处理的 `ParallelCollectionRDD`。
3. `flatMap()` 在每个分区生成记录，形成新的 RDD。
4. 调用 `cache()` 声明中间 RDD 可以被复用。
5. 第一次 `count()` 触发计算，并把该 RDD 缓存起来。
6. `groupByKey()` 触发按 Key 的重新分区和 Shuffle。
7. 第二次 `count()` 统计聚合结果。

示例中有两个 action：第一次 `pairs1.count()` 和第二次 `results.count()`，因此产生两个 Job。

## 5. 惰性计算：Transformation 与 Action

Spark 中的 `flatMap()`、`groupByKey()` 等操作主要是在描述计算流程，并不会立即执行；`count()` 等 action 才会真正触发作业提交和数据处理。

这称为惰性计算。它带来的好处是 Spark 可以在真正执行前看到更完整的计算链路，从而：

- 合并多个连续操作，形成流水线；
- 根据依赖关系划分 stage；
- 避免执行最终结果不需要的中间计算；
- 决定哪些数据需要缓存或重新计算。

如果程序只定义 transformation 而没有 action，通常不会真正处理数据。

## 6. 从代码到 RDD 逻辑流程

示例中的 RDD 链路可以抽象为：

```text
Scala 集合
→ parallelize()
→ ParallelCollectionRDD
→ flatMap()
→ MapPartitionsRDD
→ groupByKey()
→ ShuffledRDD
```

RDD 是 Spark 对分布式数据及其计算依赖的抽象。它可以看成一个分布式数组：数据具有统一类型，被划分为多个 partition，并可以分布在不同机器上。

`toDebugString()` 可以帮助观察 RDD 的生成关系、类型、分区数量和缓存状态，但它展示的是逻辑处理流程，不是最终的 task 执行图。

## 7. 从逻辑流程到物理执行计划

Spark 生成物理执行计划大致经历三步：

1. 根据 action 确定 Job 数量。
2. 根据 RDD 之间的数据依赖切分 Stage。
3. 根据每个 Stage 的分区生成 Task。

对于窄依赖，前后 RDD 分区通常是一对一关系，多个操作可以放在同一个 stage 中流水线执行。

对于宽依赖，前后 RDD 分区存在多对多关系，需要 Shuffle，因此通常要在 Shuffle 边界切分 stage。

在示例中：

- `pairs1.count()` 主要对应一个 stage，3 个分区生成 3 个 task；
- `results.count()` 包含 Shuffle，因此拆成上游 stage 和下游 stage；
- 下游 `ShuffledRDD` 有 2 个分区，因此生成 2 个 task。

同一 stage 中的 task 通常可以并行执行；上游 stage 完成后，下游 stage 才能继续。

## 8. 为什么不能把每个算子都做成一个 task

如果每个 `map()`、`flatMap()`、`groupByKey()` 都单独生成 task，会产生很多问题：

- task 启动和调度开销过大；
- 中间数据需要频繁落盘或传输；
- 内存和网络开销增加；
- 故障恢复粒度过细，管理复杂。

Stage 的意义是把可以连续处理的操作合并起来，让 task 在一个执行流水线中完成多个算子，同时在 Shuffle 等必要位置切断流程。Stage 也提供了较合适的容错边界：某个 stage 失败时，可以重算该 stage，而不是重跑整个 job。

## 9. Spark UI 的阅读方法

Spark UI 可以验证应用的逻辑和物理执行过程：

- Job 页面：查看 action 触发的 Job；
- Job Details：查看一个 Job 包含哪些 Stage；
- Stage Details：查看 RDD、Task 数量、分区和 Shuffle 指标；
- 常用指标：Input Size、Shuffle Read、Shuffle Write、Write Time、GC Time、Locality Level。

如果某个 stage 有 3 个 task，通常可以推断其最终处理 RDD 有 3 个分区。出现 Shuffle Write 表示上游正在为下游重新分区，出现 Shuffle Read 表示下游 task 正在读取上游 Shuffle 输出。

## 10. 本章最重要的运行链路

```text
用户代码
→ Transformation 构建 RDD 逻辑链
→ Action 产生 Job
→ RDD 依赖划分 Stage
→ Partition 数量决定 Task 数量
→ Task 提交到 Executor
→ Executor 在线程中执行算子
→ Shuffle 在 Stage 边界重新分区
→ Driver 汇总结果
```

## 11. 面试重点

### Spark Application、Job、Stage、Task 的关系

Application 是用户提交的完整程序；一个 Application 可以因为多个 action 产生多个 Job；一个 Job 会依据依赖关系切成多个 Stage；一个 Stage 通常会为每个 partition 生成一个 Task。

### Driver 和 Executor 的区别

Driver 运行应用逻辑、构建执行计划、协调任务并接收结果；Executor 是集群中的执行进程，负责运行 task 和保存应用需要的缓存数据。

### 为什么 `cache()` 不会立即缓存

因为 Spark 是惰性计算。`cache()` 只是标记 RDD 的持久化意图，必须等后续 action 真正计算该 RDD 时，分区才会被物化并缓存。

### 普通变量和 RDD 的区别

普通 Scala/Java/Python 变量只存在于 Driver 的本地进程；RDD 是 Spark 可识别、可分区、可并行处理的分布式数据抽象。

