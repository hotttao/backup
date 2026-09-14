---
weight: 43
title: "DolphinScheduler 执行与故障恢复"
date: 2024-10-11T08:00:00+08:00
lastmod: 2026-09-14T08:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "解释流程推进和故障恢复"
featuredImage:

tags: ["workflow"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

# DolphinScheduler 执行与故障恢复

DolphinScheduler 内容分成四篇：

1. [基础与架构](./041_dolphinscheduler.md);

2. [任务分配与并发控制](./042_dolphinscheduler_assignment.md);

3. **执行与故障恢复（本文）**;

4. [任务投递与状态变化](./044_dolphinscheduler_task_delivery_data_model.md);

## 1. 先明确执行状态机的边界

```text
Schedule/API 创建 Command
  → Master 创建 Workflow Instance 并决定可运行 TaskInstance
  → Worker 执行一个 TaskInstance 并上报
  → Master 根据数据库终态推进下游
```

Master 是 DAG 状态机推进者，Worker 是单任务执行者，Metadata Database 是权威进度存储。本篇讨论实例持久化、Failover、重试和补数；Master 选 Worker、RPC 分发及每一步字段变化见 [044](./044_dolphinscheduler_task_delivery_data_model.md)。

## 2. 状态持久化与异常恢复

### 2.1 持久化内容

关系数据库保存：

- Workflow/Task Definition 及版本、节点关系和 JSON 参数；
- Schedule 与调度发布状态；
- Command、错误 Command、串行执行 Command；
- Workflow Instance、Task Instance、上下文与参数；
- Task Group Queue、告警、数据源、用户、租户、项目和权限；
- 工作流运行历史和操作所需元数据。

运行中的 Shell 进程、Python 进程或外部 Spark/Flink/YARN/Kubernetes 应用不等于数据库状态。故障恢复时必须把“平台认为在运行”与“外部进程是否仍在运行”对齐。

### 2.2 Master 故障

Registry 检测 Master 节点失效后，其余 Master 竞争 failover 协调权，读取数据库中的 Workflow/Task Instance，并接管相应工作流状态机。较新版本支持 Master 接管仍在 Worker 上运行的任务事件，避免简单地把所有任务重跑。

但恢复边界取决于故障时刻：dispatch 已发送而确认丢失、Worker 已启动外部任务但状态未持久化、Master 收到成功事件但事务未提交，都可能产生不确定性。任务应有业务幂等键，并能查询外部作业状态。

### 2.3 Worker 故障

Registry 检测 Worker 下线后，Master 对分配给该 Worker 的未完成任务执行容错处理。对本地 Shell/Python 进程，Worker 宕机通常意味着进程也消失，可以按重试策略重新运行；对 YARN、Spark、Flink 或 Kubernetes，提交端 Worker 消失时外部应用可能仍在运行，盲目重提会重复。插件能否取得 application ID 并接管/查询，是实际可靠性的关键。

### 2.4 全集群重启

Definition、Schedule、Command 和 Instance 都在数据库，因此服务恢复后可以继续处理未完成的工作流。不过“中断任务自动恢复”不是同一种行为：

- 尚未分发的持久任务可以重新调度；
- Master 状态机可从实例记录恢复；
- Worker 本地进程已消失时通常按失败/重试处理；
- 外部计算作业可能继续，需要插件查询或人工处理；
- 已经对外产生副作用的 HTTP/Shell 任务可能再次执行，必须幂等。

## 3. 重试、超时与失败处理

Task 可配置失败重试次数和重试间隔，也可以配置超时策略；3.4.1 增加了 Workflow/Task Instance 最大运行时间配置。工作流还可以设置节点失败后的流程策略，例如结束流程或继续允许不受依赖影响的分支执行。

常见运维操作包括：

- 恢复失败任务/从失败节点继续；
- 重跑整个 Workflow Instance；
- 停止、暂停或恢复实例；
- 对 Task Instance 强制成功；
- 从某个节点执行、只运行前置/后置范围；
- 查看日志和实例 DAG；
- 补数生成多个调度日期实例。

重试时必须明确 Task Plugin 的语义：SQL `INSERT`、HTTP 发布、Shell 上传文件可能已成功但状态回报失败。推荐把 `${workflowInstanceId}`、业务日期和任务 code 组合成幂等键，外部服务记录处理结果；对 Spark/Flink/YARN/K8s 保存 application/job ID，并在重试前查询。

## 4. 定时调度、补数和依赖

DolphinScheduler 使用 Scheduler Plugin，默认以 Quartz 执行 cron 调度。Schedule 与 Workflow Definition 绑定并需要上线；触发后创建 Command，再由 Master 创建实例。

调度相关能力包括：

- cron 周期运行；
- 手工运行和 API 触发；
- 补数（Complement Data）：按日期范围或指定日期批量生成实例；
- 补数实例串行或并行策略；
- 工作流串行执行策略，控制多个实例重叠；
- Dependent Task：检查其他项目/工作流/任务在指定周期的状态；
- Sub Workflow：复用另一个工作流；
- 内置日期参数和自定义参数；
- 任务优先级、工作流优先级和 Worker Group 路由。

补数时业务日期是核心。SQL 和脚本应使用调度/补数基准日期，不要直接读取机器当前时间，否则重跑历史日期会处理错误分区。上线前要验证时区、cron 边界、夏令时、补数顺序和跨工作流依赖。

## 5. 存储支持

需要区分三类存储：

### 5.1 Metadata Database

生产部署常见为 PostgreSQL 或 MySQL。官方 Helm 默认部署 PostgreSQL；由于 MySQL Connector 的分发许可证限制，官方镜像可能不直接附带 MySQL 驱动，需要自行加入。更换元数据库时，API、Master、Worker、Alert、Tools 等相关服务必须保持一致配置和驱动。

### 5.2 Resource Center

资源中心保存脚本、JAR 和任务文件，可通过 Storage Plugin 使用本地/共享文件系统、HDFS、S3 兼容对象存储及部分云厂商存储。集群模式不能把仅存在某个 API 节点本地磁盘的文件当成所有 Worker 都可见。

### 5.3 Registry

Registry 可用 ZooKeeper、etcd 或 JDBC。它保存临时注册/协调信息，不替代 Metadata DB；也不应拿来保存大型任务产物。

## 6. 最小 PoC 与验证清单

使用 3 个 Master、3 个 Worker、3 节点 Registry 和高可用数据库，完成：

1. 在 UI 拖拽 Shell → Python → Switch → K8s/HTTP → 汇总 DAG；
2. 使用 PyDolphinScheduler Python 和 YAML 各提交同类工作流；
3. 配置 `cpu`、`gpu` 两个 Worker Group，验证路由和无 Worker 超时；
4. 配置 cron 和历史日期补数，核对每个实例的业务日期；
5. 分别在 Command 消费、Task dispatch、Worker 执行、状态回报阶段杀 Master；
6. 杀 Worker，分别观察本地 Shell 和外部 Spark/K8s 作业的恢复；
7. 模拟 RPC ACK 丢失，验证幂等键是否阻止重复发布；
8. 配置失败重试、任务超时、工作流最大时间和告警；
9. 将 Registry 从 ZooKeeper 切换到 JDBC 或 etcd，对比故障发现延迟；
10. 运行 10 万 Task Instance，观察数据库、Master 队列和日志查询；
11. 数据库与 Registry 分别故障转移，验证恢复和重复执行；
12. 与 Airflow 实现同一 DAG，对比定义代码量、UI 操作、补数、恢复和运维成本。

关键指标包括：调度延迟、dispatch 延迟、Master/Worker failover 时间、补数吞吐、重复副作用次数、数据库 QPS、Registry 请求量、Task 日志可见时间和 UI 查询延迟。
