# 第五章：迭代型 Spark 应用

> 本章核心：机器学习和图计算如何在 Spark 上进行多轮数据并行，并处理模型状态、同步、缓存和聚合问题。

## 1. 迭代型应用的特点

迭代型应用通常包括机器学习和图计算。它们会反复读取训练数据或图结构，更新模型参数或节点状态，直到达到最大轮数或收敛条件。

这类应用同时具有数据密集和计算密集特征，通常会重复使用输入数据，因此缓存非常重要。每一轮迭代可能产生新的 Job/Stage，但许多计算模式会重复出现。

## 2. SparkLR：Logistic Regression

Logistic Regression 用 Sigmoid 函数输出样本属于某一类别的概率，通过最大似然或等价的损失函数优化参数向量 `w`。

梯度下降的基本过程：

1. 初始化 `w`；
2. 每个样本根据当前 `w` 计算梯度；
3. 对所有样本的梯度求和；
4. 按学习率更新 `w`；
5. 重复直到收敛或达到迭代次数。

## 3. Logistic Regression 的 Spark 并行化

样本之间的梯度计算相互独立，适合数据并行：

```text
训练数据 RDD
→ 每个 Task 计算局部梯度
→ Task 内局部聚合
→ Driver 汇总梯度
→ Driver 更新 w
→ 广播新的 w
→ 下一轮迭代
```

`w` 通常是 Driver 端的普通变量，每一轮通过广播发送到各个 Task；训练数据是 RDD，适合缓存。

如果每轮使用 `map` + `reduce`，每轮会形成一个 Job，但 `reduce` 是 action，通常不会额外形成独立的 reduce stage。训练数据缓存后，第一轮较慢，后续轮次可直接从缓存读取。

## 4. 迭代机器学习的瓶颈

- Driver 聚合瓶颈：所有 Task 的梯度最终汇聚到 Driver。
- 模型参数瓶颈：特征维度非常大时，Driver 存储和更新 `w` 会成为单点瓶颈。
- 同步等待：慢 Task 或失败重试会拖慢整个迭代轮次。
- Task 反复启停：迭代轮数很多时，调度开销明显。

常见改进方向包括 `treeAggregate`、参数服务器、异步/半异步更新协议和 Task 重用。

## 5. Spark 做机器学习，性能优化到底来自哪里

答案不是“专门算子”与“缓存”二选一，而是三个层次共同作用：

```text
第一层：Spark 执行引擎
分区并行、Shuffle、广播、缓存、代码生成、AQE

第二层：MLlib 的算法实现
分布式梯度聚合、树形聚合、分块 ALS、直方图决策树、稀疏向量

第三层：用户构建训练数据的方式
Join 策略、分区数、数据倾斜、特征向量化、缓存位置
```

### 5.1 Spark 并没有通用的“机器学习算子”

Spark Core 只提供 `mapPartitions`、`reduceByKey`、`treeAggregate`、`broadcast`、`persist` 等通用分布式能力。它不知道当前计算是在训练 Logistic Regression，还是在统计普通业务指标。

MLlib 在这些能力之上实现了专门算法。专门优化通常体现在：

- 使用 `DenseVector`、`SparseVector` 表示特征，避免把一条样本存成大量普通对象；
- 在线性模型中使用 BLAS 和分区内批量计算，而不是每个特征都执行一个 RDD 操作；
- 每个分区先计算局部梯度，再用 `treeAggregate` 分层合并；
- ALS 把用户和物品因子分块，只交换需要的因子块；
- 决策树先对连续特征分桶，再累计直方图寻找切分点，避免为每个候选切分反复扫描全部原始值。

因此，调用 `spark.ml` 中的算法，不只是替用户写了几次 `map` 和 `reduce`。算法本身通常已经按照分布式计算特点改写过。但是 MLlib 无法自动解决输入表 Join 不合理、严重数据倾斜、分区过多或训练数据无法放入集群等问题。

### 5.2 缓存优化的是“每一轮都不变的数据”

以梯度下降为例，每轮变化的是模型参数 `w`，训练样本通常不变：

```text
固定数据：label、features                 → 缓存在 Executor
变化数据：模型参数 w                     → 每轮由 Driver 更新并广播
变化结果：各分区计算出的局部梯度          → 每轮重新计算并聚合
```

假设训练数据由多份 HDFS 文件经过解析和 Join 得到：

```text
HDFS 数据
  → 解析
  → 清洗
  → 多表 Join
  → 特征向量化
  → persist
  → 第 1～N 轮训练反复读取缓存
```

缓存不会让单次梯度公式变快。它避免的是每一轮重新读取 HDFS、重新解析文件、重新 Shuffle Join 和重新组装特征。

`persist` 是惰性的，调用后不会立即产生数据。应当用一次 action 将缓存真正物化：

```python
training = build_features(events, users, items) \
    .select("label", "features") \
    .persist(StorageLevel.MEMORY_AND_DISK)

training.count()       # 物化缓存，也能提前发现数据问题
model = estimator.fit(training)
training.unpersist()
```

选择缓存位置时应遵循：

- 缓存原始表：后面仍会反复执行 Join，收益有限；
- 缓存 Join 后、训练前的数据：通常最合适；
- 缓存每轮产生的梯度：下一轮参数变了，旧梯度已经无效；
- 特征数据放不进内存：使用 `MEMORY_AND_DISK`，或者先写成 Parquet/Delta 特征表；
- 迭代不断增长 lineage：需要时使用 checkpoint 截断依赖，缓存本身不会截断 lineage。

MLlib 的具体算法可能在内部持久化部分中间数据，但不应假设所有 `fit` 都会替用户缓存整个特征构建链路。用户明确缓存训练输入，更容易控制缓存位置和生命周期。

### 5.3 一个迭代轮次内部发生什么

下面用伪代码表示线性模型的一轮训练：

```python
training.persist(MEMORY_AND_DISK)

weights = initialize_weights()

for iteration in range(max_iterations):
    bc_weights = spark_context.broadcast(weights)

    # 每个 partition 只初始化一次局部累加器
    local_gradients = training.mapPartitions(
        lambda rows: compute_partition_gradient(rows, bc_weights.value)
    )

    # 分层合并，而不是把所有分区结果直接压给 Driver
    gradient = local_gradients.treeReduce(add_vectors)

    weights = optimizer_update(weights, gradient)
    bc_weights.destroy()
```

性能来源包括：训练数据复用缓存、模型参数广播、分区内批量计算、局部聚合以及树形全局聚合。缓存只是其中一环。

## 6. 多份 HDFS 数据如何 Join 成训练集

机器学习中的“多个维度”需要区分两种含义：

- **特征维度**：年龄、价格、点击次数等多个特征最终组成一条向量；
- **维度表**：用户表、商品表、地域表等不同 HDFS 数据集，需要先按 key 连接。

Spark ML 算法最终希望看到的通常不是多张表，而是一份类似下面的训练集：

```text
label | features
------+---------------------------------
1     | [age, city, price, click_count]
0     | [age, city, price, click_count]
```

所以完整流程通常分成两个阶段：

```text
特征工程阶段：多份 HDFS 数据 → 过滤、聚合、Join → label + features

训练阶段：固定训练集 → 多轮扫描 → 更新模型参数
```

### 6.1 小维度表：Broadcast Hash Join

如果用户属性表或字典表经过过滤后足够小，可以广播到每个 Executor：

```python
from pyspark.sql.functions import broadcast

samples = events.join(
    broadcast(user_dimension),
    on="user_id",
    how="left"
)
```

执行过程是：

```text
小表收集并广播到各 Executor
             │
大表各分区本地扫描并查哈希表
             │
不需要按 Join key Shuffle 大表
```

广播表必须能安全地放入 Driver 和每个 Executor 的内存。原始维度表很大但过滤后很小时，可以先过滤、投影，只广播真正需要的行和列。Spark SQL 可以根据统计信息自动选择广播，也可以使用 `broadcast` hint，但错误强制广播会导致 Driver 或 Executor 内存不足。

### 6.2 两边都是大表：Shuffle Join

如果两张表都很大，通常需要让相同 key 的记录进入同一个下游分区：

```text
左表按 user_id Shuffle ─┐
                         ├─ 同分区内执行 SortMergeJoin
右表按 user_id Shuffle ─┘
```

这类 Join 的主要成本不是比较两行数据，而是两边的网络传输、排序、溢写和磁盘读取。优化重点包括：

1. **先过滤再 Join**：尽早缩小参与 Shuffle 的数据量。
2. **先投影再 Join**：只保留 key 和真正需要的特征列。
3. **避免重复 Join**：将 Join 后的训练集缓存或落盘，训练迭代只读取结果。
4. **控制分区大小**：分区太少会产生超大 Task，太多会产生大量小 Task。
5. **利用 AQE**：根据运行时数据合并小分区、拆分倾斜分区，并动态调整 Join 策略。
6. **复用数据布局**：反复按同一 key Join 时，可以预先重分区、排序、分桶或生成统一特征表，减少后续重复 Shuffle。

### 6.3 数据倾斜

如果某个 user_id、商品类别或默认值出现次数特别多，该 key 的数据会集中到一个 Shuffle 分区：

```text
普通 key → 每个 Task 处理约 500 MB
热点 key → 某个 Task 处理 30 GB
```

即使绝大多数 Task 很快完成，Stage 也必须等待这个热点 Task。常用处理方法：

- 开启并正确配置 AQE skew join；
- 过滤无业务意义的异常 key 或 null key；
- 热点 key 加随机盐拆成多个 key，Join 后再去盐聚合；
- 如果另一侧较小，优先广播，避免按热点 key Shuffle；
- 将普通 key 与热点 key 分开处理，再合并结果。

随机加盐不是默认首选，因为它会增加实现复杂度和数据复制。应先确认 Spark UI 中确实存在少数异常大的 Shuffle 分区。

### 6.4 推荐的训练数据构建方式

```python
from pyspark import StorageLevel
from pyspark.sql.functions import broadcast, col
from pyspark.ml.feature import VectorAssembler

# 1. 读取时只取需要的日期、行和列
events = (
    spark.read.parquet("hdfs:///warehouse/events")
    .where(col("dt").between("2025-01-01", "2025-03-31"))
    .select("user_id", "item_id", "label", "click_count")
)

users = (
    spark.read.parquet("hdfs:///warehouse/users")
    .select("user_id", "age", "city_index")
)

items = (
    spark.read.parquet("hdfs:///warehouse/items")
    .select("item_id", "price", "category_index")
)

# 2. 小表广播；大表让 Spark 根据统计信息和 AQE 选择计划
joined = (
    events
    .join(broadcast(users), "user_id")
    .join(items, "item_id")
)

# 3. 把多列特征组装为 MLlib 能消费的向量
assembler = VectorAssembler(
    inputCols=["age", "city_index", "price", "category_index", "click_count"],
    outputCol="features"
)

training = (
    assembler.transform(joined)
    .select("label", "features")
    .persist(StorageLevel.MEMORY_AND_DISK)
)

# 4. 只执行一次特征构建与 Join，之后算法多轮复用 training
training.count()
model = logistic_regression.fit(training)
training.unpersist()
```

如果同一训练集会被多个实验、多个模型或多次任务复用，Executor 缓存的生命周期通常太短，更合理的方式是把特征工程结果写成分区良好的 Parquet/Delta 特征表：

```text
多份原始 HDFS 表
       │ 一次昂贵的 Join 和清洗
       ▼
版本化训练特征表
       │
       ├─ Logistic Regression 实验
       ├─ GBT 实验
       └─ 模型重训
```

此时需要保证特征时间一致性：训练某个事件时，只能使用该事件发生时已经产生的特征，不能把未来数据 Join 进历史样本，否则会造成数据泄漏。Spark 能高效执行 Join，但不会自动判断这种机器学习语义错误。

## 7. 广义线性模型

Logistic Regression、Linear Regression、Linear SVM、Lasso 和 Ridge 等可以统一为凸优化问题：

```text
目标函数 = 损失函数 + λ × 正则化项
```

不同模型的主要差异在损失函数和正则化项；Spark 可以把梯度计算、参数更新等公共流程抽象出来，再替换具体计算函数。

正则化的作用是控制模型复杂度、降低过拟合：

- L2：让参数更平滑，抑制过大的权重；
- L1：产生稀疏权重，有利于特征选择；
- Elastic Net：结合 L1 与 L2 的特点。

## 8. treeAggregate 的意义

普通 `reduce`/`aggregate` 最终把局部结果集中到 Driver，Task 数量和梯度维度增大时会产生网络和内存压力。

`treeAggregate` 将局部结果分层合并，形成树状聚合，减少 Driver 一次性接收的数据量和聚合压力。代价是会引入更多 Stage/Task，并可能降低后续阶段的并行度，因此树深通常需要权衡。

## 9. PageRank 图计算

PageRank 通过节点之间的链接传播 rank 值：

1. 初始化每个节点的 rank；
2. 将 rank 按出边分发给邻居；
3. 汇总每个节点收到的消息；
4. 更新节点 rank；
5. 重复直到收敛。

实际实现通常使用邻接表 `<source, neighbors>`，而不是 `O(n²)` 的邻接矩阵，以节省稀疏图的存储空间。

在 Spark 中，`join` 将邻接表与 rank 关联，`flatMap` 发送消息，`reduceByKey` 汇总同一目标节点收到的消息。边的聚合结果一般会被缓存，因为每轮都要使用图结构。

## 10. 图划分方式

- Edge Cut：切分边，把节点和边分到不同分区；保留邻居信息，但可能出现高阶节点导致的负载不均。
- Vertex Cut：切分顶点关联的边，边通常更均衡，但节点可能复制到多个分区。

Pregel 风格通常偏向边划分；GraphX/PowerGraph 等系统会使用更复杂的点划分策略。

## 11. GAS、BSP 与迭代边界

图计算常抽象为 GAS：

- Gather：收集邻居消息；
- Apply：根据消息更新节点状态；
- Scatter：把新状态发送给邻居。

如果每轮都等待所有节点完成再进入下一轮，就是 Bulk Synchronous Parallel（BSP）模型。Spark 的 Shuffle 边界天然充当同步屏障：上游 Stage 全部完成后，下游 Stage 才能开始。

## 12. 本章必须掌握

```text
迭代应用 = 固定计算流程 + 不断更新状态
训练数据/图结构 → 应缓存
模型参数 → 广播或由参数服务器管理
局部计算 → 聚合 → 状态更新 → 下一轮
Shuffle/Stage 边界 → 迭代同步屏障
```

对于机器学习训练，还要补充下面这条主线：

```text
多份 HDFS 数据
→ 先过滤、投影和选择正确的 Join 策略
→ 生成固定的 label + features 训练集
→ 缓存或落盘
→ MLlib 用专门的分布式算法多轮扫描
→ 每轮只更新和传递必要的模型状态
```

不要把“每轮迭代”理解成“每轮重新生成训练数据”。特征表 Join 属于训练前的数据准备；模型迭代复用的是已经构建好的训练样本。
