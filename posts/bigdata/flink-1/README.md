# Flink 学习笔记

这组笔记沿用 `posts/bigdata/spark` 的学习逻辑：先观察一个程序运行时有哪些组件，再沿着用户代码向下追踪执行计划、并行任务和数据交换，最后理解流处理独有的状态、容错和事件时间。

## 学习路线

| 顺序 | 文章 | 核心问题 |
|---|---|---|
| 1 | [001_Flink程序运行架构图.md](./001_Flink程序运行架构图.md) | Client、JobManager、TaskManager、Slot 怎样协作？ |
| 2 | [002_DataStream逻辑计划与Task执行过程.md](./002_DataStream逻辑计划与Task执行过程.md) | 一段 DataStream 代码怎样变成并行 Subtask？ |
| 3 | [003_分区数据交换与反压.md](./003_分区数据交换与反压.md) | `keyBy` 为什么会重分区，慢算子为什么能拖慢 Source？ |
| 4 | [004_状态Checkpoint与Exactly-Once.md](./004_状态Checkpoint与Exactly-Once.md) | 无限流怎样保存中间结果并在故障后恢复？ |
| 5 | [005_事件时间Watermark与窗口.md](./005_事件时间Watermark与窗口.md) | 乱序、迟到和永不结束的数据怎样按时间计算？ |

## 阅读时始终抓住四条主线

```text
代码主线：DataStream API -> StreamGraph -> JobGraph -> ExecutionGraph
执行主线：Operator -> Operator Subtask -> Task -> TaskManager Thread
数据主线：Record -> Partition -> Channel -> Buffer -> 下游 Subtask
正确性主线：Source Offset + Operator State + Sink Commit -> Checkpoint
```

## 与 Spark 对照时先避免两个误区

1. Flink 的 `Task` 不是 Spark Task 的简单改名。Flink Task 往往长期运行，而且一个 Task 可以包含一条 Operator Chain。
2. Flink 不用 Spark 的 `Job -> Stage -> Task` 边界解释流式执行。`keyBy` 等数据交换会断开算子链，但上下游 Task 通常可以同时运行，通过网络缓冲区持续传递数据。

## 版本说明

本文以 Apache Flink 当前 stable 文档中的 DataStream Runtime 概念为主。具体 API、配置项和默认值可能随版本变化，使用时应结合目标版本的官方文档核对。

## 官方资料

- [Flink Architecture](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/flink-architecture/)
- [DataStream API](https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/overview/)
- [Fault Tolerance](https://nightlies.apache.org/flink/flink-docs-stable/docs/learn-flink/fault_tolerance/)
- [Streaming Analytics](https://nightlies.apache.org/flink/flink-docs-stable/docs/learn-flink/streaming_analytics/)

