# 运行中的 Spark 程序架构图

下面以 Standalone 模式为例，展示一个 Spark Application 正在运行时，各组件之间的关系。

## 一、Spark 集群架构

```mermaid
flowchart TB
    U[用户 / 提交端]
    D[Driver\n运行 main 函数\n创建 SparkContext\n生成 Job、Stage、Task]
    CM[Cluster Manager\nStandalone Master / YARN / Kubernetes]

    subgraph C[Worker 节点集群]
        W1[Worker 1\nWorker 进程]
        W2[Worker 2\nWorker 进程]
        W3[Worker 3\nWorker 进程]

        E1[Executor 1\nJVM 进程\nTask 线程池\nRDD Cache]
        E2[Executor 2\nJVM 进程\nTask 线程池\nRDD Cache]
        E3[Executor 3\nJVM 进程\nTask 线程池\nRDD Cache]

        W1 --> E1
        W2 --> E2
        W3 --> E3
    end

    S[(分布式存储\nHDFS / S3 / Hive / Kafka)]
    O[(输出结果\nHDFS / S3 / DB / 消息队列)]

    U -->|spark-submit| D
    D -->|申请资源 / 注册应用| CM
    CM -->|启动并管理 Executor| W1
    CM -->|启动并管理 Executor| W2
    CM -->|启动并管理 Executor| W3
    D -->|提交 Task / 协调执行| E1
    D -->|提交 Task / 协调执行| E2
    D -->|提交 Task / 协调执行| E3
    S -->|输入数据分区| E1
    S -->|输入数据分区| E2
    S -->|输入数据分区| E3
    E1 <-->|Shuffle Read / Write| E2
    E2 <-->|Shuffle Read / Write| E3
    E1 -->|结果或状态| D
    E2 -->|结果或状态| D
    E3 -->|结果或状态| D
    E1 --> O
    E2 --> O
    E3 --> O
```

## 二、一个正在运行的 Spark Application

```mermaid
flowchart LR
    A[Application\nWordCount / ETL / ML]
    B[Driver\n解析用户代码]
    C[SparkContext / Scheduler]
    J1[Job 0\n由 action 触发]
    J2[Job 1\n由另一个 action 触发]
    ST1[Stage 0\n窄依赖流水线]
    ST2[Stage 1\nShuffleMapStage]
    ST3[Stage 2\nResultStage]
    T1[Task 0\n处理 partition 0]
    T2[Task 1\n处理 partition 1]
    T3[Task 2\n处理 partition 2]
    E[Executor JVM\n多个 Task 线程]
    R[(RDD Cache)]
    O[结果输出]

    A --> B --> C
    C --> J1
    C --> J2
    J2 --> ST1
    ST1 --> ST2
    ST2 -->|Shuffle| ST3
    ST3 --> T1
    ST3 --> T2
    ST3 --> T3
    T1 --> E
    T2 --> E
    T3 --> E
    E --> R
    E --> O
```

## 三、运行时序

```mermaid
sequenceDiagram
    participant User as 用户
    participant Driver as Driver
    participant CM as Cluster Manager
    participant Ex as Executor
    participant Store as 分布式存储

    User->>Driver: spark-submit 提交应用
    Driver->>CM: 申请 Executor 资源
    CM->>Ex: 启动 Executor JVM
    Ex-->>Driver: 注册 Executor
    Driver->>Driver: 执行用户代码，构建 RDD DAG
    User->>Driver: 调用 action
    Driver->>Driver: 根据依赖切分 Job / Stage
    Driver->>Ex: 提交 Task
    Ex->>Store: 读取输入分区
    Ex->>Ex: 执行窄依赖算子流水线
    Ex->>Ex: Shuffle Write
    Ex->>Ex: Shuffle Read
    Ex->>Ex: 执行下游 Task
    Ex-->>Driver: 汇报状态 / 返回部分结果
    Ex->>Store: 写入最终结果
    Driver-->>User: 返回应用结果或完成状态
```

## 四、架构中最容易混淆的关系

| 概念 | 作用 |
|---|---|
| Application | 用户提交的完整 Spark 程序 |
| Driver | 运行 `main`、创建 SparkContext、生成和协调任务 |
| Cluster Manager | 管理集群资源并启动 Executor |
| Worker | 集群节点上的管理进程，负责启停 Executor |
| Executor | 运行在 Worker 上的 JVM 进程，执行 Task、保存缓存 |
| Job | 一个 action 触发的一次计算作业 |
| Stage | 由依赖关系切分出的执行阶段 |
| Task | 处理一个数据分区的最小执行单元 |
| RDD | 分区数据、计算逻辑和依赖关系的抽象 |

## 五、观察一个运行中的程序时应该看什么

```text
Application
 ├─ Driver 是否正常运行
 ├─ Job 数量：通常对应 action 数量
 ├─ Stage 数量：重点看 Shuffle 边界
 ├─ Task 数量：通常对应 Stage 最终 RDD 的 partition 数
 ├─ Executor 数量与 CPU/内存
 ├─ Shuffle Read / Write
 ├─ Cache 命中和存储空间
 ├─ GC 时间与 OOM
 └─ 是否存在数据倾斜或长尾 Task
```

一句话总结：Driver 负责“想清楚要做什么并协调执行”，Executor 负责“真正处理分区数据”，Cluster Manager 负责“分配集群资源”，而 RDD、Stage、Task 和 Shuffle 共同构成 Spark 的实际执行链路。

