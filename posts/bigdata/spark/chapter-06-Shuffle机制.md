# 第六章：Shuffle 机制

> 本章核心：Shuffle 如何完成跨 Stage 的重新分区、聚合、排序，并在内存不足时借助磁盘继续运行。

## 1. Shuffle 要解决什么问题

Shuffle 连接上游和下游 Stage。它不仅传输数据，还可能同时完成：

- 数据分区；
- map 端 combine；
- reduce 端聚合；
- 排序；
- 中间数据的内存/磁盘管理。

因此 Shuffle 是 Spark 中网络、磁盘、CPU 和内存交汇最密集的环节。

## 2. Shuffle Write 与 Shuffle Read

```text
上游 Task
→ 计算 partitionId
→ 可选 combine/sort
→ Shuffle Write
→ 本地 Shuffle 文件
→ Shuffle Read
→ 下游 Task 聚合/排序
```

下游 Task 的数量等于 Shuffle 分区数。常见 Hash 分区规则是根据 Key 的 hash 值确定 partitionId。

## 3. 聚合策略

两步聚合先把 record 放入 HashMap，再对相同 Key 的 Value 统一计算，逻辑简单但占用内存较大。

在线聚合在 record 到来时立即更新已有结果，例如：

```text
old = map.get(key)
new = func(old, value)
map.put(key, new)
```

在线聚合可以减少中间数据规模，适合 `reduceByKey`、`aggregateByKey` 等操作；`groupByKey` 没有聚合函数，无法获得同样的压缩收益。

## 4. 排序策略

Shuffle Read 端必须保证最终需要的排序。可选思路包括：

- 先排序再聚合；
- 使用 TreeMap 边插入边排序；
- 先聚合再排序。

Spark 更偏向先聚合再排序：先用 HashMap 降低数据规模，再把结果放入可排序结构，减少需要排序的数据量。

## 5. 内存不足与 Spill

当用于聚合或排序的数据结构放不下时，Spark 会把内存中的部分结果排序后 spill 到磁盘，清空内存后继续处理。由于 spill 文件中只是局部结果，最终还需要通过归并和再次聚合得到完整结果。

这是 Spark 能处理超过单机内存规模数据的重要原因，但会引入额外磁盘 I/O。

## 6. Shuffle Write 的典型策略

- 不需要 combine 和排序时，可按分区直接写出，速度快，但分区很多时 buffer 和文件数量会很大。
- 需要排序时，可将 `(partitionId, key)` 作为排序键，使用一个可扩容、可 spill 的结构。
- 需要 combine 时，使用带 partitionId 的 AppendOnlyMap，在写出前完成局部聚合。

Spark 会根据算子需要选择不同的 Shuffle Writer，而不是强制所有操作都执行完整排序。

## 7. Shuffle Read 的典型策略

下游 Task 从多个上游输出中读取属于自己的分区：

- 不需要聚合或排序：读取后直接输出；
- 需要排序：使用数组等结构按 Key 排序；
- 需要聚合：使用 HashMap 在线聚合；
- 内存不足：spill，最后进行全局 merge。

## 8. 核心数据结构

### AppendOnlyMap

只支持插入和更新、不支持删除的 HashMap。底层使用数组和开放地址/二次探测处理冲突，减少普通 HashMap 的对象开销。

### ExternalAppendOnlyMap

在 AppendOnlyMap 基础上增加磁盘 spill 能力，用于大规模聚合。内存不足时将排序后的局部结果写入多个 spill 文件，最后通过多路归并完成全局聚合。

### PartitionedAppendOnlyMap

为 Shuffle Write 服务，将 partitionId 与 Key 结合，使结构既能完成聚合，也能按分区输出。

### PartitionedPairBuffer

用于不需要聚合但需要排序的场景，类似可 spill 的数组结构。

## 9. Spark 与 Hadoop MapReduce Shuffle 的差异

Hadoop MapReduce 流程固定，通常严格按 Key 排序，阶段明确，内存行为比较容易预测；但它会对不需要排序的操作也执行排序，且不能充分利用在线聚合。

Spark 采用更灵活的 hash + sort 思路：根据操作需求决定是否聚合、是否按 Key 排序，并通过单文件加索引等方式减少临时文件数量。

Spark 的聚合函数通常是逐 record 处理，要求函数能在线更新状态；MapReduce 的 reduce 函数则可以拿到一组 Value 后再处理，表达更自由。

## 10. 性能诊断重点

出现 Shuffle 性能问题时，优先检查：

- Shuffle 分区数是否合理；
- 是否存在数据倾斜；
- 是否错误使用 `groupByKey`；
- map 端是否可以 combine；
- spill 文件和磁盘 I/O 是否过多；
- Task 的 Shuffle Read/Write 是否极不均衡。

## 11. 必须掌握

```text
Shuffle Write：分区、可选聚合/排序、写本地文件
Shuffle Read：拉取分区、聚合/排序、输出给下游算子
在线聚合：边读边合并，减少内存
spill：内存不足时落盘
最终 merge：合并内存结果与 spill 文件
```

