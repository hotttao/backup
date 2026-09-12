# Spark 历代重大性能优化：算法与执行流程演进

> 整理范围：从 Spark 早期版本到 Spark 4.2。只记录改变通用执行模型、核心算法或数据流转方式的优化。单个算子的小幅提速、依赖库升级、零散参数优化没有列入。
>
> 阅读建议：不要把本文当成版本更新清单。Spark 的性能演进主要沿着 Shuffle、查询优化、内存与代码生成、列式处理、Python 数据交换、流处理六条主线发生。

## 一、先看结论：Spark 到底优化了什么

| 优化主线 | 主要版本 | 原来的核心瓶颈 | 新的算法或流程 |
|---|---:|---|---|
| Sort-based Shuffle | 1.1～1.2 | Hash Shuffle 产生大量文件和缓冲区 | 先按分区排序，再溢写、归并为少量大文件 |
| Push-based Shuffle | 3.2 起 | Reduce 端拉取 M × R 个细碎块，随机 I/O 严重 | Map 端主动推送并按 Reduce 分区预合并 |
| Catalyst、CBO、运行时过滤 | 1.0～4.2 | 查询计划主要依赖固定规则，难以利用数据规模 | 规则优化、统计信息估算、连接重排、动态分区裁剪、子计划复用 |
| AQE | 1.6 萌芽，3.0 重构，3.2 默认启用，之后持续增强 | 执行前只能根据不准确的静态统计生成完整计划 | 在 Stage 边界读取真实统计，重新决定分区数、Join 和倾斜处理 |
| Tungsten 与 Whole-stage Codegen | 1.4～2.0，4.2 继续扩展 | JVM 对象、虚函数调用和 GC 占用大量 CPU | 二进制行、堆外内存、算子融合、生成紧凑 JVM 代码 |
| 列式与向量化执行 | 2.0～4.2 | 逐行解析、逐值函数调用导致 CPU 利用率低 | 批量解码列数据，减少分支、对象和方法调用 |
| Arrow 加速 Python 边界 | 2.3～4.2 | JVM 与 Python 逐行 Pickle 序列化 | 共享列式批次，减少复制与格式转换 |
| 流状态与低延迟执行 | 2.0～4.2 | 微批次调度开销和 JVM 内大状态限制吞吐、延迟 | RocksDB 状态存储、增量 checkpoint、异步进度、Real-Time Mode |

这些优化可以归纳为三个方向：

1. **少搬数据**：分区裁剪、运行时过滤、本地 Shuffle 读取、子计划复用。
2. **把小操作合并成大操作**：Shuffle 块预合并、算子代码融合、列式批处理。
3. **晚一点做决定**：AQE 使用运行时真实数据，而不是在 Job 开始前猜完整个计划。

---

## 二、Shuffle：从大量小文件，到排序归并，再到 Map 端预合并

Shuffle 是 Spark 最重要的性能主线之一。它连接两个 Stage，也是磁盘、网络、内存和序列化成本集中出现的位置。

### 2.1 Hash Shuffle 的问题

早期 Hash Shuffle 可以抽象成：每个 Map Task 为每个下游 Reduce 分区维护一个写出通道。

假设有 M 个 Map Task、R 个 Reduce 分区，最坏会产生接近：

```text
M × R 个逻辑 Shuffle 块
```

当 M 和 R 都很大时，会出现：

- 文件或文件段数量巨大；
- 同时维护许多序列化缓冲区，内存压力高；
- 磁盘写入细碎；
- Reduce 端需要建立大量网络请求，进行随机读取。

### 2.2 Sort-based Shuffle：先分区排序，再溢写归并

Spark 1.1 引入面向大规模 Shuffle 的 Sort-based Shuffle；Spark 1.2 将它与基于 Netty 的块传输设为默认实现。

核心流程如下：

```text
Map 输出记录
    │
    ├─ 计算目标 Reduce 分区 partitionId
    │
    ├─ 在内存中按 partitionId 排序
    │
    ├─ 内存不足时生成 spill 文件
    │
    └─ Task 结束时归并 spill
            │
            ├─ 一个数据文件
            └─ 一个索引文件，记录每个 Reduce 分区的数据范围
```

关键变化不是“排序比哈希快”，而是改变了资源管理方式：

- 不再为每个 Reduce 分区长期维护独立文件和大缓冲区；
- 内存不足时可以 spill，峰值内存更可控；
- 小块被组织在连续文件中，通过索引定位；
- 大规模 Shuffle 下文件句柄和磁盘寻道显著减少。

这是一项以额外排序 CPU 成本，换取更稳定的内存、磁盘和文件管理成本的优化。

官方记录：[Spark 1.1.0](https://spark.apache.org/releases/spark-release-1-1-0.html)、[Spark 1.2.0](https://spark.apache.org/releases/spark-release-1-2-0.html)

### 2.3 Push-based Shuffle：把 Reduce 端的细碎拉取提前合并

Sort-based Shuffle 减少了 Map 侧的文件问题，但 Reduce Task 仍可能从每个 Map Task 拉取属于自己的一个块。

```text
传统拉取式 Shuffle

Map 1 ── block r0 ─┐
Map 2 ── block r0 ─┼──> Reduce 0
Map 3 ── block r0 ─┘

总块数仍约为 M × R
```

Spark 3.2 引入 Push-based Shuffle。Map Task 完成部分 Shuffle 输出后，主动把块推送到合并服务；服务按照目标 Reduce 分区进行预合并。Reduce Task 随后读取的是较少、较大的 merged blocks。

```text
Map 输出块
   │ push
   ▼
Shuffle Merge Service
   │ 按 reduceId 预合并
   ▼
较少的连续大块
   │ fetch
   ▼
Reduce Task
```

基本可以理解为：

> 把 Reduce 阶段大量分散的网络请求和随机磁盘读取，提前转换为“Map 端网络推送 + Merger 顺序追加写”，从而让 Reduce 端进行少量大块、连续读取。

```text
传统 Shuffle：

Reduce
  → 发起大量小网络请求
  → 多个 Shuffle Service
  → 从不同 Map 文件的不同区间读取
  → 返回大量小 block
```

```text
Push-based Shuffle：

Map
  → 通过网络推送小 block
  → Shuffle Merger 按 reduceId 顺序追加
  → 形成较大的 merged chunks

Reduce
  → 发起少量大请求
  → 连续读取 merged chunks
```

但需要注意两个细节：

1. **不是单纯将磁盘随机 I/O 转换成网络 I/O**：传统 Shuffle 本来也需要通过网络把数据发送给 Reduce。Push-based Shuffle 额外增加了 `Map → Merger` 这一段网络传输，并用它换取 Reduce 阶段更高效的读取。
2. **不一定合并成一个大文件**：更准确地说是若干较大的连续 merged chunks。数据还可能分散在多个 Merger 节点上，避免形成单点和超大文件。

它的成本和收益可以概括为：

```text
额外成本：
Map → Merger 的网络传输
+ Merger 的顺序写

换来的收益：
更少的 Reduce fetch 请求
+ 更少的数据来源
+ 更连续的磁盘读取
+ 更低的 Reduce 长尾
```

所以，逻辑上仍然存在 M × R 个 Map 输出块，Shuffle 数据总量也没有减少。Push-based Shuffle 是通过增加一次预传输和顺序合并写，减少 Reduce 阶段的细碎 fetch、随机读取和并发请求。它是一种“增加部分总工作量，但缩短关键路径”的优化，在 Map 数量巨大、单块很小、Reduce 长尾明显时收益尤其明显。

它依赖集群侧 Shuffle 合并服务和相应部署条件，并不是所有部署模式都会自动受益。

官方记录：[Spark 3.2.0](https://spark.apache.org/releases/spark-release-3-2-0.html)、[SPARK-30602](https://issues.apache.org/jira/browse/SPARK-30602)

### 2.4 Shuffle 数据保留：减少弹性伸缩和节点下线导致的重算

Spark 3.x 又持续改进 Executor 下线时的 Shuffle 保留：动态资源分配可通过 Shuffle tracking 判断 Executor 是否仍保存有效数据；节点 decommission 时可以迁移 RDD 和 Shuffle block；后续版本进一步避免在数据已成功迁移后重新运行 Map Task。

这不是新的 Shuffle 算法，但它改变了故障和弹性伸缩流程：

```text
过去：Executor 下线 → Shuffle 输出丢失 → 重算上游 Map Stage

改进：Executor 准备下线 → 迁移有效块 → 下游继续拉取 → 避免重算
```

它优化的是长作业、动态资源分配和云环境中的重复计算成本。

官方记录：[Spark 3.4.0](https://spark.apache.org/releases/spark-release-3-4-0.html)、[Spark 3.5.0](https://spark.apache.org/releases/spark-release-3-5-0.html)

---

## 三、查询优化：从固定规则，到代价估算，再到运行中改计划

### 3.1 Catalyst：把“如何执行”从业务代码中分离出来

Spark 1.0 引入 Spark SQL 和 Catalyst Optimizer。DataFrame、Dataset 和 SQL 先被表示为逻辑计划，再经过规则变换、物理计划选择，最后执行。

```text
SQL / DataFrame
      │
      ▼
未解析逻辑计划
      │ 解析字段和类型
      ▼
已解析逻辑计划
      │ 规则优化
      ▼
优化后的逻辑计划
      │ 选择 Join、Exchange、Scan 等物理算子
      ▼
物理执行计划
```

有了中间计划表示，Spark 才能统一实施：

- 谓词下推：尽量在读取数据时过滤；
- 列裁剪：只读取需要的列；
- 常量折叠和表达式简化；
- Join 策略选择；
- 子查询和子计划复用；
- 后来的 CBO、动态分区裁剪和 AQE。

官方记录：[Spark 1.0.0](https://spark.apache.org/releases/spark-release-1-0-0.html)

### 3.2 CBO：根据数据规模决定 Join 顺序

只使用固定规则时，优化器知道“过滤应该尽量下推”，却不知道某次过滤后到底剩多少数据。

Spark 2.2 引入较完整的 Cost-Based Optimizer：利用表和列统计信息估算过滤、Join、聚合等算子的输出基数，并进行基于代价的 Join reorder。Spark 2.3 又补充了直方图统计。

例如：

```text
A：10 亿行
B：100 万行
C：过滤前 1 亿行，过滤后只有 100 行

不理解选择率：可能先执行 A JOIN B，再 JOIN C
CBO：优先计算过滤后的 C JOIN B，再与 A 连接
```

Join 的数学结合律允许改顺序，但中间结果规模可能相差几个数量级。CBO 的价值是用统计信息选择更小的中间结果。

它的限制也很明确：统计信息缺失或过期时，执行前估算仍可能错误，这正是 AQE 要解决的问题。

官方记录：[Spark 2.2.0](https://spark.apache.org/releases/spark-release-2-2-0.html)、[Spark 2.3.0](https://spark.apache.org/releases/spark-release-2-3-0.html)

### 3.3 Dynamic Partition Pruning：用 Join 一侧的结果裁剪另一侧扫描

Spark 3.0 引入 Dynamic Partition Pruning（DPP）。它典型用于星型模型中的事实表与维度表连接。

```sql
SELECT sum(f.amount)
FROM fact_sales f
JOIN dim_date d ON f.date_id = d.date_id
WHERE d.year = 2025
```

fact_sales 可能按 date_id 分区，但真正需要哪些 date_id，要等 dim_date 的过滤结果产生后才知道。DPP 会把维度表产生的连接键变成运行时过滤条件，用它跳过事实表中无关的分区。

```text
dim_date 过滤 year = 2025
          │
          ▼
得到有效 date_id 集合
          │
          ▼
裁剪 fact_sales 分区
          │
          ▼
只扫描可能参与 Join 的数据
```

本质是把 Join 条件反向传播到扫描阶段，减少最昂贵的数据读取。后续版本继续增强多过滤键、运行时过滤和 Bloom Filter 等能力，应当视为同一条“尽早排除无关数据”的优化主线。

官方记录：[Spark 3.0.0](https://spark.apache.org/releases/spark-release-3-0-0.html)

### 3.4 AQE：利用已完成 Stage 的真实结果重新规划后续 Stage

Spark 1.6 已经出现自动选择 reducer 数量的早期自适应能力。Spark 3.0 重构出新的 Adaptive Query Execution 框架；Spark 3.2 将 AQE 默认启用；3.3 又扩大倾斜 Join 的适用范围；4.1 开始把 AQE 用于无状态流式工作负载。

普通静态计划的问题是：Driver 在执行前只能根据文件大小和统计信息估算 Shuffle 输出。一旦过滤率、键分布或压缩率估错，后面的分区数和 Join 算法都会不合适。

AQE 把 Exchange 后的 Shuffle 输出视为 Query Stage。在一个 Query Stage 完成后，Driver 已经得到实际字节数、各分区大小等统计，再生成或调整后续 Stage。

```text
初始物理计划
     │
     ▼
执行 Query Stage 0
     │
     ▼
获得真实 Shuffle 统计
     │
     ├─ 总数据比预计小？合并分区
     ├─ 某些分区异常大？拆分倾斜分区
     ├─ 一侧足够小？改成 Broadcast Hash Join
     └─ 不再需要重新分区？使用 Local Shuffle Reader
     │
     ▼
生成并执行后续 Query Stage
```

AQE 的几项核心优化如下。

#### 合并 Shuffle 分区

静态设置 spark.sql.shuffle.partitions 很难同时适合所有查询。设置过小会让 Task 太重，设置过大又会产生大量几乎为空的小 Task。

AQE 可以先使用较多的初始分区保证并行度，再根据真实 Shuffle 大小把相邻小分区合并，减少调度开销和小任务。

#### 动态切换 Join 算法

计划阶段认为两侧都很大时，可能选择 SortMergeJoin。执行完前置 Stage 后，如果发现一侧实际很小，AQE 可以改为 BroadcastHashJoin，从而省掉排序和一侧或两侧的重新分区。

#### 倾斜 Join 拆分

普通 Shuffle Join 中，一个 Reduce 分区对应一个 Task。热点 key 让某个分区远大于其他分区时，整个 Stage 会被最后一个 Task 拖住。

AQE 会识别异常大的 Shuffle 分区，将其拆成多个片段；另一侧相应数据可能被复制，让多个 Task 并行处理原本的热点分区。

```text
普通：一个 20 GB 倾斜分区 → 一个超慢 Task

AQE：20 GB → 4 个约 5 GB 片段 → 4 个 Task 并行处理
```

#### Local Shuffle Reader

如果 AQE 改变 Join 策略后不再需要原定的分区方式，可以让 Task 优先读取本地 Shuffle 数据，避免多余网络传输和重新分区。

AQE 是 Spark SQL 3.x 最重要的流程级优化：它把“在执行前一次性决定全部计划”改为“在 Stage 边界根据真实数据逐段决策”。但它不能随意修改正在运行的 Task，调整点通常位于已经物化统计信息的 Query Stage 边界。

官方记录：[Spark 1.6.0](https://spark.apache.org/releases/spark-release-1-6-0.html)、[Spark 3.0.0](https://spark.apache.org/releases/spark-release-3-0-0.html)、[SPARK-31412](https://issues.apache.org/jira/browse/SPARK-31412)、[Spark 3.2.0](https://spark.apache.org/releases/spark-release-3-2-0.html)、[Spark 3.3.0](https://spark.apache.org/releases/spark-release-3-3-0.html)、[Spark 4.1.0](https://spark.apache.org/releases/spark-release-4-1-0.html)

---

## 四、Tungsten：从 JVM 对象计算，转向二进制数据与生成代码

### 4.1 为什么 JVM 对象会成为瓶颈

一个整数在业务上只有 4 字节，但包装成 Java 对象后，还会带来对象头、引用、对齐空间。处理数亿行数据时，真正参与计算的数据可能只占内存的一小部分，其余成本来自：

- 对象分配；
- 指针跳转和较差的 CPU Cache locality；
- 垃圾回收；
- 通用 Iterator、虚函数和类型判断。

Spark 1.4 启动 Project Tungsten，目标是让执行引擎更接近硬件。

### 4.2 二进制内部格式与堆外内存

Tungsten 使用紧凑的二进制行表示，例如后来的 UnsafeRow。字段通过固定偏移访问，变长内容放在连续区域中。

```text
Java 对象模型：
Row → Object[] → String 对象 → char/byte 数组

二进制行：
[null bits][fixed-width fields][offset/length][variable data]
```

连续内存布局减少对象数量、指针追踪和 GC 压力，也更适合直接比较、复制、排序和序列化。Spark 1.6 又增强了 SQL 的 off-heap execution，使部分执行内存不再由 JVM GC 逐对象管理。

### 4.3 Unified Memory Management：缓存和执行共享可借用的内存池

Spark 1.6 引入统一内存管理。此前缓存内存与 Shuffle、排序、聚合所需的执行内存使用相对固定的区域，可能出现一边空闲、另一边溢写磁盘的情况。

统一内存管理让两者共享一个区域，并允许执行和存储在规则约束下相互借用：

```text
旧模型：
[固定 execution 区][固定 storage 区]
一侧空闲时，另一侧不一定能充分使用

统一模型：
[       execution + storage 共享区域       ]
根据当前工作负载动态占用和回收
```

执行内存通常可以驱逐可重算的缓存块，以保障正在运行的 Shuffle、Join 和聚合；缓存则只能使用当前可获得的空间。它提高了内存利用率，但 persist 的数据仍可能因执行压力被淘汰。

官方记录：[Spark 1.6.0](https://spark.apache.org/releases/spark-release-1-6-0.html)

### 4.4 Whole-stage Code Generation：把多个算子融合成一个循环

Spark 早期的 Volcano/Iterator 风格执行可以近似理解为：上层算子不断调用 child.next()，一行数据会穿过多层虚函数和通用 Row 接口。

```text
Project.next()
  └─ Filter.next()
       └─ Scan.next()
```

Spark 2.0 的 Whole-stage Codegen 把一段支持代码生成的物理算子融合起来，生成一个针对字段类型和表达式定制的 JVM 函数。

```java
while (scan.hasNext()) {
    BinaryRow row = scan.next();
    int age = row.getInt(1);
    if (age > 18) {
        long result = row.getLong(2) * 2;
        output(result);
    }
}
```

它同时减少：

- 算子间的虚函数调用；
- 中间 Row 对象和 Iterator；
- 通用类型判断；
- 不必要的字段读取和写回。

代码生成不是单独让 Filter 或 Project 变快，而是把一串算子变成一个紧凑 CPU 循环。Spark 2.0 的发布记录称常见 SQL/DataFrame 操作可获得约 2～10 倍提升。Spark 4.2 继续把 Whole-stage Codegen 扩展到 Union 等更多执行路径。

它只覆盖支持代码生成的算子；Python UDF、某些复杂表达式或不支持 codegen 的算子会形成边界，导致流水线被切开。

官方记录：[Spark 1.4.0](https://spark.apache.org/releases/spark-release-1-4-0.html)、[Spark 2.0.0](https://spark.apache.org/releases/spark-release-2-0-0.html)、[Spark 4.2.0](https://spark.apache.org/releases/spark-release-4-2-0.html)

---

## 五、列式与向量化：不再逐行、逐值调用

Spark 2.0 引入向量化 Parquet Reader；Spark 2.3 加入向量化 ORC Reader；之后多个版本继续扩大类型覆盖、批量解码和直接数组访问，Spark 4.2 又增强了 Parquet 批量读取路径。

### 5.1 逐行读取的成本

```text
for 每一行:
    解析字段 A
    调用转换函数
    检查 null
    创建或更新对象
```

即使磁盘读取并不慢，每个值上的方法调用、边界检查、分支和对象构造仍会消耗大量 CPU。

### 5.2 向量化读取

```text
一次读取一批，例如 4096 行
    │
    ├─ 批量解码 A 列
    ├─ 批量解码 B 列
    └─ 放入 ColumnarBatch
```

它的主要收益来自：

- 一个函数调用处理一批数据；
- 相同类型连续存放，提高 CPU Cache 命中率；
- null、字典编码和压缩可以批量处理；
- 减少 JVM 对象创建；
- 后续列式算子可以直接消费 ColumnarBatch，避免行列转换。

这里要区分两件事：

- **列式存储**：Parquet、ORC 在文件中按列组织数据，便于列裁剪和压缩；
- **向量化执行**：运行时一次对一批同类型值进行解码或计算。

只有列式文件但仍逐值解码，不能获得完整收益。反过来，如果中间频繁发生 ColumnarToRow 和 RowToColumnar，列式流水线也会被转换成本抵消。因此后续版本的重要方向，是扩大端到端列式执行的覆盖范围，而不只是增加一个 Reader。

官方记录：[Spark 2.0.0](https://spark.apache.org/releases/spark-release-2-0-0.html)、[Spark 2.3.0](https://spark.apache.org/releases/spark-release-2-3-0.html)、[Spark 4.2.0](https://spark.apache.org/releases/spark-release-4-2-0.html)

---

## 六、PySpark：用 Arrow 改造 JVM 与 Python 的数据交换

### 6.1 逐行 Pickle 为什么慢

PySpark 的计划和大部分 SQL 算子运行在 JVM 侧；Python UDF、Pandas API 等需要把数据送入 Python Worker。传统路径通常按行编码为 Python 可识别的数据，再使用 Pickle 等格式序列化。

```text
JVM InternalRow
    │ 逐行转换、序列化
    ▼
字节流
    │ 逐行反序列化
    ▼
Python 对象
```

当 UDF 本身很简单时，边界转换甚至比业务计算更贵。

### 6.2 Arrow：交换列式批次

Spark 2.3 开始系统性引入 Apache Arrow，加速 Spark DataFrame 与 Pandas/Python 之间的数据交换；后续加入 Pandas UDF、Arrow Python UDF 和 UDTF，并减少多余行列转换。Spark 4.1 支持无需先转 Pandas 的 Arrow-native UDF/UDTF；Spark 4.2 默认启用 Arrow 优化的 Python UDF 和 Arrow-based PySpark IPC。

```text
JVM ColumnarBatch
       │ Arrow 列式内存格式
       ▼
Python / Arrow 数组
       │ 批量执行
       ▼
Arrow 列式结果
       │
       ▼
JVM
```

关键变化是：

- 从一行一次，变成一批一次；
- 列数据保持连续内存布局；
- JVM 和 Python 对类型的映射更直接；
- 减少 Pickle、Python 对象创建和中间复制；
- 后续版本尽量跳过不必要的 ColumnarToRow 转换。

Arrow 优化的是跨语言边界，并不会自动让低效的 Python 算法变快；批次过大时也会增加 Worker 峰值内存。

官方记录：[Spark 2.3.0](https://spark.apache.org/releases/spark-release-2-3-0.html)、[SPARK-22216](https://issues.apache.org/jira/browse/SPARK-22216)、[SPARK-40307](https://issues.apache.org/jira/browse/SPARK-40307)、[Spark 4.1.0](https://spark.apache.org/releases/spark-release-4-1-0.html)、[Spark 4.2.0](https://spark.apache.org/releases/spark-release-4-2-0.html)

---

## 七、Structured Streaming：从微批处理，到大状态，再到实时模式

### 7.1 Structured Streaming：复用 Spark SQL 的增量执行

Spark 2.0 引入 Structured Streaming。流不再主要表示成一组需要用户直接管理的离散 RDD，而被表示成持续增长的无界表；查询由 Catalyst 分析和优化，执行引擎增量处理新增数据。

```text
无界输入表
    │ 每次新增一段数据
    ▼
同一个 DataFrame / SQL 逻辑计划
    │ 增量执行
    ▼
结果表持续更新
```

它让批处理和流处理共享 SQL 优化、表达式、数据源和物理算子。这是架构级性能基础，后续状态存储和低延迟优化都建立在这一模型上。

官方记录：[Spark 2.0.0](https://spark.apache.org/releases/spark-release-2-0-0.html)

### 7.2 RocksDB State Store：把大状态移出 JVM 堆

聚合、流式 Join、去重等有状态查询，需要跨批次保存 key 对应的状态。早期默认 HDFS-backed State Store 的工作集主要维护在 JVM 内存映射中；状态量很大时，堆内存和 GC 会成为限制。

Spark 3.2 加入 RocksDB State Store：状态保存在 Executor 本地 RocksDB 中，主要由本地磁盘和 native memory 承载，再通过 checkpoint 提供故障恢复能力。

```text
过去：大量状态 → JVM Map → 对象多、GC 压力大

RocksDB：状态 → LSM Tree / 本地磁盘 + native memory
                  │
                  └─ checkpoint 到可靠存储
```

其最大价值不是保证每次 get/put 都更快，而是让状态规模突破 JVM 堆限制，并降低大堆 GC 导致的长暂停。代价是更多本地 I/O、序列化和 RocksDB 调优需求。

官方记录：[Spark 3.2.0](https://spark.apache.org/releases/spark-release-3-2-0.html)、[SPARK-34198](https://issues.apache.org/jira/browse/SPARK-34198)

### 7.3 Changelog Checkpointing：提交增量日志，快照后台完成

如果每个微批次都上传完整 RocksDB 快照，状态越大，checkpoint 暂停越长，批次延迟也越不稳定。

Spark 3.5 引入 RocksDB changelog checkpointing：批次提交时同步持久化本批发生的状态变化，而完整快照可以低频、异步上传。

```text
完整快照模式：
每批结束 → 暂停并上传大量状态文件 → 提交完成

Changelog 模式：
每批结束 → 持久化较小的变更日志 → 提交完成
                       │
                       └─ 后台定期上传完整快照
```

恢复时可以使用最近快照加后续 changelog 重建状态。它把与状态总量相关的同步开销，尽量改造成与本批变更量相关的开销，使延迟更低、更可预测。

官方记录：[Spark 3.5.0](https://spark.apache.org/releases/spark-release-3-5-0.html)、[SPARK-43421](https://issues.apache.org/jira/browse/SPARK-43421)

### 7.4 Continuous Processing 与 Real-Time Mode：降低微批调度下限

Spark 2.3 曾加入实验性的 Continuous Processing，在有限的查询语义下追求毫秒级延迟。它没有取代通用微批模式，但说明了一个问题：当每批数据很少时，Job/Stage/Task 调度、offset 和 commit 等固定成本会成为延迟下限。

Spark 4.1 又引入 Structured Streaming Real-Time Mode，为无状态流处理提供新的低延迟执行路径。官方发布说明给出的目标是亚秒级延迟，无状态 Task 可达到个位数毫秒级处理延迟；Spark 4.2 继续补充 PySpark 触发方式等能力。

可以把两种执行思路理解为：

```text
微批模式：
收集一批 → 创建并调度任务 → 处理 → 提交 → 下一批

实时模式：
长时间运行的流式任务持续获取并处理记录
减少频繁创建微批任务的固定调度成本
```

Real-Time Mode 初期重点是无状态工作负载，不能把它理解为对所有有状态、端到端 exactly-once 微批查询的直接替代。它代表的是 Spark 在吞吐优先之外，开始为亚秒级延迟采用不同执行流程。

官方记录：[Spark 2.3.0](https://spark.apache.org/releases/spark-release-2-3-0.html)、[Spark 4.1.0](https://spark.apache.org/releases/spark-release-4-1-0.html)、[SPARK-53736](https://issues.apache.org/jira/browse/SPARK-53736)、[Spark 4.2.0](https://spark.apache.org/releases/spark-release-4-2-0.html)

---

## 八、广播数据分发：从 Driver 单点发送到 TorrentBroadcast

Spark 1.1 将 TorrentBroadcast 设为默认广播实现。Driver 不必成为唯一的数据发送热点：广播变量被切成块，Executor 获取块后可以参与向其他 Executor 分发，思路类似 BitTorrent。

```text
单点广播：
Driver ──> Executor 1
       ├─> Executor 2
       ├─> Executor 3
       └─> Executor N

TorrentBroadcast：
Driver ──> E1 ──> E3
       └─> E2 ──> E4
多个节点共同分发不同数据块
```

这样可以降低 Driver 的出口带宽和连接压力，提高大广播变量在集群中的分发速度。Broadcast Hash Join 的小表广播也建立在该广播机制之上。

官方记录：[Spark 1.1.0](https://spark.apache.org/releases/spark-release-1-1-0.html)

---

## 九、这些优化如何共同作用

以一个事实表和维度表的聚合查询为例：

```sql
SELECT d.region, SUM(f.amount)
FROM fact_sales f
JOIN dim_shop d ON f.shop_id = d.shop_id
WHERE d.level = 'A'
GROUP BY d.region
```

一次现代 Spark SQL 执行可能同时经历：

1. Catalyst 做列裁剪和谓词下推，只读取需要的列。
2. CBO 根据统计信息决定初始 Join 顺序和 Join 算法。
3. Dynamic Partition Pruning 用过滤后的 dim_shop 键裁剪 fact_sales 的扫描分区。
4. Parquet Vectorized Reader 按列批量读取数据。
5. Whole-stage Codegen 把扫描、过滤、表达式和局部聚合融合成生成代码。
6. Sort-based Shuffle 对聚合键分区并通过 spill/merge 管理输出。
7. 第一个 Query Stage 结束后，AQE 根据真实 Shuffle 大小：
   - 合并过小分区；
   - 拆分倾斜分区；
   - 必要时改变 Join 算法；
   - 尽量使用本地 Shuffle 读取。
8. 如果是 PySpark UDF，Arrow 尽量以列式批次跨越 JVM/Python 边界。

因此 Spark 现代性能不是来自某一个“更快的算子”，而是从读取、计划、内存表示、CPU 执行、Shuffle、跨语言交换到容错恢复的整条路径共同优化。

---

## 十、哪些发布内容没有收录

本文刻意排除了以下项目：

- 单个函数、表达式或数据类型的小幅提速；
- 某个特定数据源的一次性优化；
- 单纯升级 Netty、Jackson、压缩库或 JVM 版本；
- 只改善稳定性但不改变主要执行成本的修复；
- 新增 API，但没有改变执行算法或数据流程；
- 只在非常狭窄条件下生效的特殊算子改写。

Spark 4.0 和 4.2 仍包含大量性能改进，但许多是对 Catalyst、向量化、代码生成、Arrow 和 Structured Streaming 这些既有主线的扩展，所以没有拆成几十个零散条目。

---

## 十一、版本主线速记

```text
1.0  Catalyst：查询先变成可优化的计划
 │
1.1～1.2  Sort-based Shuffle + Netty：控制文件、内存和大 Shuffle
 │
1.4～1.6  Tungsten + Unified Memory + Off-heap：改变内存和数据表示
 │
2.0  Whole-stage Codegen + Vectorized Parquet + Structured Streaming
 │
2.2～2.3  CBO + ORC 向量化 + Arrow + Continuous Processing
 │
3.0  AQE 新框架 + Dynamic Partition Pruning
 │
3.2  AQE 默认开启 + Push-based Shuffle + RocksDB State Store
 │
3.5  RocksDB Changelog Checkpointing + Arrow Python UDF
 │
4.1  Real-Time Mode + Arrow-native UDF + 流式 AQE
 │
4.2  Arrow IPC 默认化，并继续扩展代码生成、列式读取与子计划合并
```

如果只记住三项最具代表性的流程变化，可以记：

- **Sort-based / Push-based Shuffle**：把大量细碎 I/O 组织成可控的排序、归并和预合并过程。
- **Tungsten / Whole-stage Codegen / Vectorization**：从“操作 JVM 对象”转向“在连续二进制数据上执行生成的批量代码”。
- **AQE**：从“执行前猜完整计划”转向“每完成一段，就用真实统计决定下一段”。
