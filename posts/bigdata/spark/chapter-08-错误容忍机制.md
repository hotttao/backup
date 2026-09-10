# 第八章：错误容忍机制

## 1. 分布式执行中的故障

Spark 需要面对节点宕机、网络异常、磁盘损坏、内存溢出、数据丢失以及用户代码错误。错误容忍的目标是在失败后自动恢复，并尽量得到与正常执行一致的结果。

## 2. 两条核心路线

- 重新计算：适合节点、网络、I/O 等执行环境变化导致的 Task 失败。
- Checkpoint：把重要 RDD 持久化到可靠存储，降低数据丢失后的重算成本。

## 3. 重新计算的正确性条件

重新计算必须满足：

1. 输入数据可再次获得且内容一致；
2. 计算逻辑是确定性的；
3. 聚合逻辑具备幂等性，通常要求满足交换律和结合律。

如果计算依赖随机数、外部变化状态或顺序敏感的非结合操作，重算可能得到不同结果。

## 4. Lineage

每个 RDD 记录 parent RDD、依赖关系和计算函数，形成 lineage（计算链）。任务失败时，Spark 沿 lineage 回溯，找到最近可用的输入、Shuffle 输出或缓存分区，从那里重新计算丢失分区。

Stage 划分本身也帮助容错：Shuffle 输出在 Job 完成前保留，使下游 Task 失败时可以重新读取，而不必重跑所有上游 Task。

## 5. Checkpoint

当 lineage 很长、依赖复杂、迭代轮数很多或重算代价很高时，应将重要 RDD checkpoint 到 HDFS 等可靠存储。

Checkpoint 完成后会产生 ReliableCheckpointRDD，并切断原 RDD 的 lineage；后续读取从持久化数据开始，不再追溯更早的计算链。

Checkpoint 通常需要额外 Job 完成，因此会增加计算和 I/O。实践中常将 RDD 先缓存，再进行 checkpoint，减少额外 Job 的重复计算。

## 6. Cache 与 Checkpoint 的区别

| 维度 | Cache/Persist | Checkpoint |
|---|---|---|
| 目的 | 加速后续计算 | 加速失败恢复、避免长链重算 |
| 存储 | 主要是 Executor 内存，也可磁盘 | 可靠的分布式存储 |
| 写入时机 | 随正常 Task 计算写入 | 通常额外启动 Job 写入 |
| 是否截断 lineage | 否 | 是 |
| 丢失后的处理 | 沿 lineage 重算 | 从 checkpoint 读取 |

## 7. 使用原则

- 简单、可快速重算的数据不必 checkpoint；
- 迭代多轮后产生、重算代价高的数据适合 checkpoint；
- 缓存解决性能问题，checkpoint 解决可靠性和长 lineage 问题；
- 注意 checkpoint 语句的位置和额外 Job 成本；
- 对聚合函数优先使用满足交换律、结合律的实现。

## 8. 必须掌握

```text
Task 失败 → 根据 lineage 找到重算起点
缓存丢失 → 重新计算
Checkpoint 丢失 → 从更早的依赖重新计算
Checkpoint 成功 → 读取持久化 RDD，lineage 被截断
```

