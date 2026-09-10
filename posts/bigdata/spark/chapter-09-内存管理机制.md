# 第九章：内存管理机制

## 1. Spark 内存问题的来源

Executor 内存主要被三类对象消耗：

1. 用户代码产生的中间对象；
2. Shuffle 的 buffer、HashMap、排序结构等；
3. RDD 缓存、广播数据和 TaskResult。

这些消耗会动态变化，且多个 Task 以线程方式共享 Executor，因此 Spark 既要管理总量，也要处理 Task 间竞争。

## 2. 静态内存管理

早期 Spark 将内存粗略划分为 Storage、Execution 和 User 三部分。优点是简单、边界清晰；缺点是某一部分空闲时，另一部分仍不能灵活使用，容易造成浪费或 OOM。

## 3. 统一内存管理

Spark 1.6 之后采用 UnifiedMemoryManager：

- Reserved Memory：保存 Spark 内部对象；
- User Memory：保存用户代码对象，边界相对固定；
- Framework Memory：由 Execution Memory 和 Storage Memory 共享。

Execution Memory 用于 Shuffle 等计算过程；Storage Memory 用于缓存 RDD、广播变量和 TaskResult。两者在一定规则下可以互相借用：计算压力增大时可以挤压缓存，缓存空间不足时也可使用空闲执行空间。

当空间仍不足时：

- Execution Memory：spill 到磁盘；
- Storage Memory：驱逐旧缓存、降级到磁盘或放弃缓存；
- 用户代码：可能直接触发 OOM，因为框架难以准确控制其真实对象大小。

## 4. Task 内存竞争

一个 Executor 可同时运行多个 Task。Execution Memory 会在活跃 Task 之间按规则分配，保证不同 Task 不会无限侵占共享空间。Executor CPU 数量越多，可并发 Task 越多，单 Task 可使用的执行内存通常越小。

## 5. Shuffle 内存

Shuffle Write 可能需要分区、combine 和排序；Shuffle Read 可能需要拉取、聚合和排序。主要内存结构包括 buffer、数组和 HashMap。

影响内存的因素：

- Shuffle 数据量；
- 分区数量；
- 是否 map 端 combine；
- 是否需要排序；
- Key 的基数；
- 用户聚合函数的空间复杂度。

Spark 会动态估计数据结构大小，必要时扩容、借用空间或 spill。

## 6. Serialized Shuffle

序列化 Shuffle 将 record 序列化后放入 Page，并用指针数组记录 partitionId、Page 位置和偏移量。这样可以减少 Java 对象开销，并支持堆外内存，降低 GC 压力。

代价是序列化/反序列化成本、实现约束以及堆内和堆外空间不能完全混用；不适合所有需要聚合或排序的场景。

## 7. Storage Memory 中的数据

Storage Memory 可能保存：

- RDD 分区；
- 广播变量；
- TaskResult；
- 网络传输和反序列化的临时数据。

RDD 可以按对象或序列化形式存储。序列化通常节省空间，但读取计算时需要反序列化。广播变量会被切成多个 block 分发到 Executor，较大的 TaskResult 也可能先在 Executor 中序列化缓存，再发送到 Driver。

## 8. 内存调优思路

- 减少单个 partition 的数据量，避免单 Task 过大；
- 合理设置 Executor 数量、Core 和 Memory；
- 优先使用能在 map 端聚合的算子；
- 避免把大数据 `collect()` 到 Driver；
- 控制缓存级别和缓存对象规模；
- 对大 Shuffle 观察 spill、GC、Shuffle Read/Write 和数据倾斜；
- 必要时使用序列化和堆外内存，但要评估 CPU 与内存泄漏风险。

## 9. 本章必须掌握

```text
用户对象 + Shuffle 中间数据 + Storage 数据 = 主要内存来源
Execution Memory 与 Storage Memory 共享框架空间
Execution 不足 → spill
Storage 不足 → 驱逐/降级/放弃缓存
多个 Task 共享 Executor → 存在内存竞争
Serialized Shuffle → 减少对象开销并降低 GC，但增加序列化成本
```

