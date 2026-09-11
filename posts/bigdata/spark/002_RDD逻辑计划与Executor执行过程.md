# RDD 逻辑计划与 Executor 执行过程

> 本文沿一条主线说明：用户代码如何形成 RDD DAG，DAGScheduler 如何把 DAG 转成 Stage 和 Task，Executor 又如何执行一个 partition。
>
> Shuffle 的 Write、Read、combine 和 spill 单独放在 003 文档中。

## 一、从用户代码到 Executor 的总流程

```text
用户代码调用 Transformation
    ↓
Driver 创建 RDD、Partition 和 Dependency
    ↓
RDD 与 Dependency 组成逻辑 DAG
    ↓
Action 触发 Job
    ↓
DAGScheduler 遇到 ShuffleDependency 切分 Stage
    ↓
Stage 按最终 RDD 的 partition 创建 Task
    ↓
TaskScheduler 选择 Executor
    ↓
Executor 反序列化 Task
    ↓
TaskRunner 请求当前 RDD partition 的 iterator
    ↓
沿窄依赖执行算子流水线
    ↓
输出 TaskResult、Shuffle 数据或外部存储文件
```

Task 不是一整个 Spark 应用，也不是一个算子。它是：

> 某个 Stage 对某个 partition 的一次执行尝试。

同一 Stage 的 Task 通常运行相同的算子链，只是 partitionId 和输入位置不同。

---

## 二、RDD 逻辑计划是怎样形成的

### 2.1 Transformation 创建描述，不立即处理数据

```python
source = sc.textFile("hdfs:///input")
parsed = source.map(parse)
valid = parsed.filter(is_valid)
pairs = valid.map(lambda x: (x.key, x.value))
result = pairs.reduceByKey(add)
```

这段代码首先在 Driver 中创建一组 RDD 对象和依赖关系：

```text
HadoopRDD
   ↓ NarrowDependency
MapPartitionsRDD(parse)
   ↓ NarrowDependency
MapPartitionsRDD(filter)
   ↓ NarrowDependency
MapPartitionsRDD(to_pair)
   ↓ ShuffleDependency
ShuffledRDD(reduceByKey)
```

在 Action 出现前，Spark 通常只是在构造“以后如何计算”的逻辑描述。

### 2.2 Action 触发 Job

```python
result.count()
```

count 提出了一个实际结果需求，Driver 才从最终 RDD 反向查找依赖、创建 Job、Stage 和 Task。

一个 Application 可以有多个 Action，因此也可以有多个 Job。这个 Application/Job 层级已经在 001 文档展开；本文从一个 Job 内部的 RDD DAG 开始讨论。

### 2.3 RDD 到底保存什么

RDD 不是已经装满 records 的分布式数组，可以概念化为：

```python
class RDD:
    id
    partitions
    dependencies
    partitioner
    storage_level

    def compute(partition, context):
        ...

    def iterator(partition, context):
        ...
```

它主要描述：

1. 有多少个逻辑 partition；
2. 当前 partition 如何依赖 parent RDD；
3. 给定 partition 时怎样计算；
4. key-value 数据是否已有 Partitioner；
5. 是否要求缓存；
6. 哪些节点是 preferred locations。

Partition 也主要是逻辑描述：

```python
class Partition:
    rdd_id
    index
    input_split_or_parent_mapping
```

Partition(index=0) 不表示 Driver 已经保存了一份数组。它的数据可以在 Task 执行时来自：

- HDFS 或对象存储 input split；
- parent RDD iterator；
- Executor 缓存；
- Shuffle Read；
- checkpoint；
- lineage 重算。

---

## 三、Dependency 决定 partition 怎样找到上游数据

### 3.1 窄依赖

窄依赖的判断标准是：一个 parent partition 的数据只会被少量确定的 child partition 使用，因此不需要把同一个 parent partition 拆散后发送给任意多个下游分区。

最常见的一对一关系：

```text
parent partition 0 → child partition 0
parent partition 1 → child partition 1
parent partition 2 → child partition 2
```

map、filter 和 flatMap 通常属于这种情况。

窄依赖还可能表现为：

- union 中按分区范围映射；
- 一个 child partition 读取多个 parent RDD 中的确定分区；
- cartesian 中一个结果分区对应两个确定的 parent partitions。

判断重点不是“一个 child 是否只读取一个 parent partition”，而是发生故障时，一个 parent partition 是否只需被少量 child 计算使用。窄依赖可以流水线执行和局部恢复。

### 3.2 ShuffleDependency

宽依赖需要把一个上游 partition 的 records 拆给多个下游 partitions：

```text
parent partition 0 ─┬─> child partition 0
                    ├─> child partition 1
                    └─> child partition 2
```

下游一个 partition 又需要读取多个上游 Map Task 的部分输出。因此必须先物化 Shuffle 数据，形成 Stage 边界。

ShuffleDependency 概念上记录：

```python
class ShuffleDependency:
    parent_rdd
    shuffle_id
    partitioner
    serializer
    aggregator
    map_side_combine
    key_ordering
```

具体 Write 和 Read 过程见 003 文档。

### 3.3 Partition 和 Partitioner 不是一回事

- Partition：RDD 的一个逻辑数据分片；
- Partitioner：key-value records 应如何映射到目标 partitions 的规则。

常见 Partitioner：

- HashPartitioner：按照 key 的 hash 分区，常用于聚合和 Join；
- RangePartitioner：按照 key 的范围分区，常用于全局排序；
- 自定义 Partitioner：按照租户、地域等业务规则分区。

Partition 数量影响：

- Stage 的 Task 数量；
- 集群并行度；
- 单 Task 数据量和内存压力；
- Shuffle block 数量；
- 调度开销和数据倾斜表现。

### 3.4 Join 不一定发生 Shuffle

如果两个 Pair RDD 已经使用相同或兼容的 Partitioner，同一个 key 的数据已经位于对应分区，Join 可能复用已有分布：

```text
左 RDD partition 0 + 右 RDD partition 0 → Task 0 本地 Join
左 RDD partition 1 + 右 RDD partition 1 → Task 1 本地 Join
```

如果分区器不兼容，则至少一侧需要重新分区；两侧都没有所需分布时，通常都要 Shuffle。

---

## 四、DAGScheduler 怎样把逻辑 DAG 切成 Stage

### 4.1 从最终 RDD 反向遍历

Action 触发后，DAGScheduler 从最终 RDD 向上查找：

```text
遇到 NarrowDependency
    → parent 继续放入当前 Stage

遇到 ShuffleDependency
    → 当前 Stage 在此结束
    → 为 Shuffle 上游创建 ShuffleMapStage
```

例如：

```text
读取 → parse → filter → map → Shuffle Write
                            │
                         Stage 0

Shuffle Read → reduce → format → count
                            │
                         Stage 1
```

Stage 不是一个算子，而是一组可以在每个 partition 上连续执行的算子。

### 4.2 为什么不是每个算子创建一个 Task

如果每个 map、filter 都单独创建 Task：

- 调度和启动次数会急剧增加；
- 算子之间必须物化或传输中间数据；
- iterator 流水线失效；
- 故障和中间文件管理更加复杂。

Spark 将窄依赖算子合并到一个 Task 中：

```text
一个 Task：
read partition
  → parse
  → filter
  → map
  → Stage 末端
```

只有 Shuffle 这类必须重新分区的位置，才要求上游结果物化并切分 Stage。

### 4.3 Stage 的两种典型末端

ShuffleMapStage：

- 末端是 Shuffle Write；
- 每个 Task 产生供下游读取的 Shuffle blocks；
- Task 返回 MapStatus，而不是把完整数据返回 Driver。

ResultStage：

- 末端执行最终 Action；
- Task 可能向 Driver 返回局部结果；
- 也可能把结果写入 HDFS、对象存储或数据库。

Spark 不像 Hadoop MapReduce 那样把每个 Stage 简单称为 Map 或 Reduce 阶段。一个 Stage 内可以包含 read、map、filter、聚合前处理等多个算子。

### 4.4 Stage 和 Task 何时运行

Stage 之间仍是 DAG：

- 没有未完成父 Stage 的 Stage 才能提交；
- Shuffle 下游 Stage 通常等待上游 ShuffleMapStage 输出可用；
- 互不依赖的 Stage 有机会并行；
- 同一 Stage 的 Task 处理不同 partitions，通常可以并行运行。

一个 Stage 通常按照末端 RDD 的 partitions 创建 Task：

```text
Stage 最终 RDD 有 100 个 partitions
    → 通常创建 100 个 Tasks
    → 每个 Task 负责一个 partition
```

即使某个 partition 最终没有 record，对应逻辑 Task 仍可能存在。Spark SQL 的 AQE 可以在运行时根据 Shuffle 大小调整后续物理分区，这是经典 RDD 调度之外的自适应优化。

---

## 五、Task 如何发送到 Executor

### 5.1 Task 中携带什么

```python
Task(
    stage_id=2,
    partition_id=5,
    attempt_number=0,
    execution_chain=...,
    serialized_function=...,
    dependency_info=...,
    broadcast_refs=...,
    task_context=...,
    output_mode="result | shuffle | external",
)
```

它需要描述：

- 执行哪个 Stage；
- 处理哪个 partition；
- 当前是第几次尝试；
- 应执行的 RDD/算子链；
- 用户函数及闭包；
- 广播变量和累加器引用；
- 如何定位输入；
- 最终输出方式。

Task 不会携带整个输入 partition 的数据。Executor 在执行时才读取输入。

### 5.2 用户代码怎样到达 Executor

```python
offset = 10
mapped = rdd.map(lambda x: x + offset)
```

Driver 会序列化函数及其闭包，因此 Executor 可以获得 lambda 和 offset=10。JAR、Python 文件等依赖通常由 Spark 的依赖分发机制、集群环境或容器镜像提供。

Executor 不会重新执行 Driver 的完整 main 函数，也不会自己重新划分 Stage。它只运行当前 Task 已确定的执行链。

### 5.3 Executor 内怎样运行 Task

```text
Executor JVM
    ├─ TaskRunner 线程：Task 0
    ├─ TaskRunner 线程：Task 1
    ├─ TaskRunner 线程：Task 2
    ├─ BlockManager
    └─ Execution/Storage Memory
```

一个 Executor 可以并发运行多个 Task，并发度主要受可用 core 和资源调度约束。Task 共享 Executor 进程、缓存和部分内存资源，因此一个 Task 的大对象或长时间 GC 可能影响同一 Executor 上的其他 Task。

### 5.4 PySpark 的 Python Worker

遇到 Python 函数时：

```text
JVM Executor
    → 启动或复用 Python Worker
    → 发送函数、闭包和 records
    → Python Worker 执行用户代码
    → 结果序列化回 JVM
```

PySpark 因而增加进程通信和序列化成本。mapPartitions 可以减少重复初始化；Arrow/Pandas UDF 可以把逐行交换改为批量列式交换，但 Catalyst 仍无法理解 Python 黑盒内部逻辑。

---

## 六、Executor 如何计算一个 RDD partition

### 6.1 iterator 是执行入口

Task 不断请求最终 RDD 的 iterator：

```python
def rdd_iterator(rdd, partition, context):
    if rdd.is_cached:
        cached = block_manager.get(rdd.id, partition.index)
        if cached is not None:
            return cached

    records = rdd.compute(partition, context)

    if rdd.is_cached:
        return block_manager.put_and_return_iterator(
            rdd.id,
            partition.index,
            records
        )

    return records
```

compute 的实现由 RDD 类型决定：

```python
class InputRDD(RDD):
    def compute(partition, context):
        return read_input_split(partition.input_split)


class MapPartitionsRDD(RDD):
    def compute(partition, context):
        parent_partition = dependency.get_parent(partition)
        parent_iter = parent.iterator(parent_partition, context)
        return function(parent_iter)


class ShuffledRDD(RDD):
    def compute(partition, context):
        return shuffle_reader.read(
            shuffle_id,
            reduce_partition_id=partition.index
        )
```

### 6.2 窄依赖形成 iterator 流水线

```python
result = source.map(parse).filter(valid).flatMap(expand)
```

一个 Task 内部近似：

```python
def execute_partition(partition_id):
    records = read_input_split(partition_id)

    for raw in records:
        parsed = parse(raw)

        if valid(parsed):
            for item in expand(parsed):
                yield item
```

一条 record 可以立即流过多个算子，中间 RDD 不需要全部进入内存或磁盘。

### 6.3 map 和 mapPartitions 的区别

map 对每条 record 调用一次函数：

```python
rdd.map(lambda record: transform(record))
```

mapPartitions 对一个 partition 的 iterator 调用一次：

```python
def process_partition(records):
    client = create_client()

    try:
        for record in records:
            yield client.transform(record)
    finally:
        client.close()

rdd.mapPartitions(process_partition)
```

mapPartitions 适合：

- 每个 partition 复用数据库或 HTTP 连接；
- 批量调用 NumPy、Arrow 或第三方库；
- 分区内局部聚合；
- 避免为每条 record 重复初始化资源。

它不表示 Spark 会把整个 partition 自动放进内存。只要函数按 iterator 流式处理，仍然可以保持有限内存。把 records 转成 list 则可能造成 OOM。

### 6.4 输入数据如何进入 Task

输入文件通常经历：

```text
HDFS/对象存储文件
    → input split
    → InputRDD partition
    → Task 根据 partition 描述读取对应字节范围
```

调度器会参考 preferred locations 尽量安排数据本地执行。广播变量则通过广播块获取；缓存数据通过 BlockManager 获取；ShuffledRDD 通过 Shuffle Reader 获取。

---

## 七、Task 最终输出什么

### 7.1 Task 内部的中间输出

通常是 iterator 中的 records，直接交给同一 Task 的下一个算子。

### 7.2 ShuffleMapTask

输出：

- Shuffle data/index 文件；
- MapStatus；
- Task 指标和状态。

完整 Shuffle 数据不会发给 Driver。详细格式和拉取流程见 003。

### 7.3 ResultTask

可能：

- 返回 count 的局部数量；
- 返回 take/collect 的一部分 records；
- 写 HDFS、对象存储或数据库；
- 执行 foreach 外部副作用。

```text
Task 0 → local count 120
Task 1 → local count 95
Task 2 → local count 130
Driver → 345
```

collect 会把全部 records 汇聚到 Driver，结果过大可能导致 Driver OOM。

---

## 八、缓存、Checkpoint 和故障恢复

缓存和容错都发生在“Executor 如何获得当前 partition”这一步，但目标不同：缓存为了避免重复计算，lineage 和 checkpoint 为了在数据丢失后恢复。

```text
Task 请求 RDD partition
    │
    ├─ 缓存存在：直接读取
    │
    ├─ checkpoint 存在：读取可靠存储
    │
    └─ 都不存在：根据 Dependency 沿 lineage 计算
```

### 8.1 什么数据值得缓存

缓存是空间换时间，适合：

- 被多个 Action/Job 重复使用的 RDD；
- 机器学习每轮都要扫描的固定训练数据；
- 图计算中多轮复用的图结构；
- 上游包含昂贵解析、Join 或 Shuffle 的中间结果；
- 交互式分析中会被反复查询的数据。

不适合盲目缓存：

- 只使用一次的 RDD；
- 重算非常便宜的数据；
- 规模过大并会严重挤压 execution memory 的数据；
- 同一条 lineage 中没有必要同时保留的 parent 和 child。

判断标准不是“这个 RDD 很重要”，而是：

```text
未来复用次数 × 单次重算成本
    是否大于
缓存写入、存储、反序列化和内存竞争成本
```

### 8.2 cache 和 persist 都是惰性的

对于 RDD，cache 是默认存储级别的 persist 简写；persist 可以显式选择 StorageLevel：

```python
rdd.persist(StorageLevel.MEMORY_AND_DISK)
```

调用 persist 只登记存储级别，不会立即遍历数据。第一次 Action 执行到这个 RDD 时，各 Task 才分别计算并缓存自己的 partition：

```text
第一次请求 partition 3
    → BlockManager 未命中
    → 沿 lineage 计算 partition 3
    → 按 StorageLevel 写入 BlockManager
    → 同一批 records 继续交给下游 iterator

以后请求 partition 3
    → BlockManager 命中
    → 跳过缓存点之前的计算链
```

可以显式物化缓存：

```python
training = build_features().persist(StorageLevel.MEMORY_AND_DISK)
training.count()
```

count 不是缓存 API 的组成部分，它只是用 Action 让所有 partitions 真正被计算。

### 8.3 StorageLevel 控制什么

一个 StorageLevel 主要包含三个维度：

| 维度 | 选择 | 影响 |
|---|---|---|
| 位置 | 内存、磁盘或二者 | 读取速度、容量和丢失概率 |
| 格式 | 反序列化对象或序列化字节 | 内存占用、GC 和 CPU 开销 |
| 副本 | 一份或多份 | 可用性、网络和存储成本 |

常见权衡：

- 对象形式读取快，但对象头和引用可能占用较多 JVM 堆并增加 GC；
- 序列化形式更紧凑，但读取时要反序列化；
- MEMORY_AND_DISK 在内存放不下时把相应 partition 存到 Executor 本地磁盘；
- 副本可以在节点故障后从其他 Executor 读取，但会增加网络和空间成本。

MEMORY_AND_DISK 的 disk 不等于可靠 checkpoint。Executor 节点和本地磁盘丢失后，block 仍可能消失。

### 8.4 BlockManager 怎样读写缓存

缓存 block 通常以 RDD ID 和 partition ID 标识：

```text
rdd_17_0 → RDD 17 的 partition 0
rdd_17_1 → RDD 17 的 partition 1
```

BlockManager 管理内存和磁盘中的 blocks，并向 Driver 侧的 BlockManagerMaster 汇报位置。Task 请求缓存时，通常按以下顺序处理：

```text
本地缓存
    ↓ 未命中
其他 Executor 的可用副本
    ↓ 未命中
根据 lineage 或 checkpoint 重算
```

远程缓存读取会产生网络传输和序列化成本，因此“已经缓存”不表示读取一定和本地内存一样快。调度器会尽量利用缓存位置安排 Task。

### 8.5 缓存如何影响后续执行计划

缓存没有改变 RDD 的逻辑 Dependency，lineage 仍然存在；但后续 Job 发现所需 partitions 已经缓存时，可以从缓存点开始：

```text
原逻辑：HDFS → parse → filter → join → features → model

features 已缓存后的后续 Job：
Cached features → model
```

这样可能跳过缓存点之前的计算和父 Stage。只有实际存在的缓存 partitions 才能被跳过；某些 partitions 未缓存或已经丢失时，Spark 仍会计算缺失部分。

### 8.6 缓存驱逐与 unpersist

Storage Memory 不足时，Spark 会根据缓存访问和存储规则驱逐 blocks，或者按照 StorageLevel 将数据写入磁盘。Spark 很难提前知道未来哪个 Job 还会使用某个 RDD，所以自动驱逐不一定符合业务上的“重要程度”。

不再使用时应主动释放：

```python
rdd.unpersist(blocking=False)
```

blocking=False 通常异步删除；需要等待各 Executor 删除完成时可以选择阻塞模式。及时 unpersist 可以避免过期缓存持续与 Shuffle、Join 和其他缓存竞争内存。

### 8.7 Checkpoint 建立可靠恢复起点

当 lineage 很长、迭代轮数很多或上游重算非常昂贵时，可以 checkpoint：

```python
sc.setCheckpointDir("hdfs:///spark-checkpoints")

rdd.persist(StorageLevel.MEMORY_AND_DISK)
rdd.checkpoint()
rdd.count()
```

Checkpoint 把 RDD records 写入 HDFS 等可靠存储。完成后会使用 checkpoint RDD 作为新的数据来源，并截断更早的 lineage。

先 persist 再 checkpoint，可以让 checkpoint 写入和后续使用尽量复用同一次计算结果；代价是同时消耗缓存和 checkpoint 空间。

| 维度 | Cache/Persist | Checkpoint |
|---|---|---|
| 主要目的 | 加速重复计算 | 建立可靠恢复点、截断长 lineage |
| 存储位置 | Executor 内存或本地磁盘，也可带副本 | HDFS 等可靠分布式存储 |
| 写入方式 | 随正常 Task 计算写入 | 需要额外计算/写入过程 |
| 是否截断 lineage | 否 | 成功后是 |
| 数据丢失后 | 沿 lineage 重算 | 从 checkpoint 读取 |

Checkpoint 不是越多越好。简单、可快速重算的数据不值得承担额外 Job 和可靠存储 I/O。

### 8.8 Spark 容错的两条主线

Spark 主要通过两种方式恢复：

1. **重新计算**：利用 RDD lineage，只重算丢失的 partition 或 Shuffle 输出；
2. **从可靠状态恢复**：从 checkpoint 开始，避免回溯很长的依赖链。

缓存处于两者之间：如果缓存仍存在，它是更近的计算起点；如果缓存丢失，它本身不提供可靠保证。

### 8.9 不同故障如何处理

#### Task attempt 失败

```text
Task attempt 失败
    → 为同一 Stage、同一 partition 创建新 attempt
    → 可以调度到另一个 Executor
```

节点、网络和临时 I/O 故障可能通过重试恢复。用户代码错误、错误配置或确定性的 OOM 通常会在每次重试时再次失败，重试不是通用修复。

#### 缓存 partition 丢失

```text
BlockManager 找不到 block
    → 查找其他副本
    → 仍不存在则根据 Dependency 找 parent
    → 沿 lineage 重算缺失 partition
```

#### Shuffle block 丢失

```text
下游 FetchFailed
    → 对应 MapStatus 失效
    → 找到产生该 block 的 ShuffleMapStage
    → 重跑相应上游 Map Task
    → 更新 Shuffle 输出位置
    → 重试受影响的下游 Task
```

Shuffle 完整恢复过程见 003 文档。

#### Executor 丢失

一个 Executor 退出可能同时导致：

- 正在运行的 Tasks 失败；
- 本地缓存 blocks 丢失；
- 本地 Shuffle 输出丢失；
- Python Worker 和进程内状态消失。

Spark 会分别重试 Tasks、重算缓存 partitions 或重新生成 Shuffle blocks。外部 Shuffle Service、远程 Shuffle 存储和 block 副本可能减少重算。

#### Driver 丢失

RDD DAG、Stage 和调度状态主要存在 Driver 内存中。Driver 完全故障时，普通 RDD lineage 不能自动等同于整个 Application 的可靠恢复。

Structured Streaming 的查询 checkpoint 还会保存 source offset、批次进度和状态存储元数据，它与普通 RDD checkpoint 不属于同一层机制。

### 8.10 重算正确性的条件和边界

Lineage 重算通常要求：

1. 输入数据仍然可读，并且内容满足所需的一致性；
2. 用户函数和依赖包仍然存在；
3. 计算逻辑具有确定性；
4. 聚合函数满足算法所需的结合律，通常也需要交换律；
5. 外部副作用能够容忍 Task 重试。

随机数、当前时间、不断变化的外部服务和顺序敏感函数，都可能使重算结果发生变化。

Spark 不能自动撤销外部副作用：

```python
rdd.foreach(lambda record: call_external_api(record))
```

Task 在调用部分 API 后失败并重试，可能再次发送相同请求。外部写入应使用业务唯一键、幂等操作、事务或两阶段提交。

### 8.11 缓存和容错的使用原则

- 反复使用且重算昂贵的数据才值得缓存；
- 迭代训练应缓存固定训练数据，而不是每轮产生的临时梯度；
- 用完及时 unpersist；
- 缓存命中率低时检查存储级别、容量和数据本地性；
- lineage 很长或重算代价极高时才设置 checkpoint；
- persist 解决性能问题，checkpoint 解决可靠恢复起点和长 lineage 问题；
- Task 重试只能处理暂时性执行故障，不能修复代码和配置错误；
- 外部写入必须单独设计幂等和事务语义。

---

## 九、完整的无 Shuffle 示例

```python
result = (
    sc.textFile("hdfs:///input")
      .map(parse)
      .filter(is_valid)
      .map(to_value)
      .count()
)
```

假设输入有三个 partitions：

```text
Driver：
  构建 RDD DAG
  → 发现全是窄依赖
  → 创建一个 ResultStage
  → 创建三个 ResultTasks

Executor：
  Task 0：读取 partition 0 → parse → filter → to_value → local count
  Task 1：读取 partition 1 → parse → filter → to_value → local count
  Task 2：读取 partition 2 → parse → filter → to_value → local count

Driver：
  汇总三个 local count
```

Spark 不需要为每个算子创建 Task，也不需要为三个 partitions 生成三份不同代码。三个 Task 使用相同执行链，通过不同 partitionId 读取不同输入。

---

## 十、最终心智模型

```text
逻辑层：

Transformation
    → RDD
    → Partition
    → Dependency
    → RDD DAG

调度层：

Action
    → Job
    → 按 ShuffleDependency 切 Stage
    → 按 partition 创建 Task

执行层：

Executor 接收 Task
    → 请求最终 RDD partition 的 iterator
    → 查缓存或执行 compute
    → 沿窄依赖递归获取 parent iterator
    → 流水线执行
    → 输出结果

恢复层：

缓存存在
    → 直接读取

缓存丢失
    → 沿 lineage 重算受影响 partition

有 checkpoint
    → 从可靠恢复起点开始

Shuffle 输出丢失
    → 重跑相应上游 ShuffleMapTask
```
