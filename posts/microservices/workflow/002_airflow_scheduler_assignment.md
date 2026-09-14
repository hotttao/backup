---
weight: 2
title: "Airflow 任务分配与并发控制"
date: 2024-10-11T08:00:00+08:00
lastmod: 2026-09-14T08:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "解释 Scheduler、Executor、Pool 与 Queue"
featuredImage:

tags: ["workflow"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

# Airflow 任务分配与并发控制

Airflow 内容分成四篇：

1. [基础与架构](./001_airflow.md);

2. **任务分配与并发控制（本文）**;

3. [执行与故障恢复](./003_airflow_execution_recovery.md);

4. [任务投递与状态变化](./004_airflow_task_delivery_data_model.md);

## 1. Queue 与 Executor：Task 到底排在哪里

“Airflow Queue”需要分三层理解：

1. **Metadata DB 状态队列**：TaskInstance 被标记为 `scheduled`、`queued`；
2. **Executor 提交层**：Scheduler 内的 Executor 选择启动方式；
3. **执行后端**：Celery Broker、本地进程或 Kubernetes Pod。

### 1.1 CeleryExecutor

```text
TaskInstance(queued)
  → CeleryExecutor
  → RabbitMQ / Redis Broker
  → 符合 queue 的 Celery Worker
  → Task Execution API
```

Celery 的 `queue` 是任务路由标签。例如视频任务发到 `video`，只有监听 `video` 的 Worker 消费；它不是 Temporal 那种由服务端持久化和分区的内建 Task Queue。

- Broker 保存待执行命令和 Celery 投递状态；
- Result Backend 保存 Celery 命令执行结果，生产环境通常使用数据库后端；
- DagRun、TaskInstance、XCom 等权威编排状态仍在 Airflow Metadata DB；
- 清理 Metadata DB 不会清理 Redis，清理 Redis 也不会删除 Airflow 历史；
- 运行中直接清空 Broker 可能丢失已排队命令，之后需要 Scheduler 调和。

### 1.2 KubernetesExecutor

KubernetesExecutor 运行在 Scheduler 中，通过 Kubernetes API 为每个 TaskInstance 创建独立 Pod：

```text
Scheduler / KubernetesExecutor
  → Kubernetes API
  → 创建一个 Task Pod
  → Pod 加载 DAG 版本并执行
  → 通过 API Server 汇报结果
  → Pod 退出
```

它不需要 Celery Broker，任务级资源和依赖隔离更强，代价是 Pod 启动延迟、镜像和 Kubernetes 运维成本。

### 1.3 Pool 与 Celery queue 不同

| 机制 | 控制什么 |
|---|---|
| Pool | Scheduler 允许一类 TaskInstance 同时占用多少个 slot |
| Celery queue | Task 命令交给哪一类 Worker |
| Kubernetes 资源配置 | 单个 Task Pod 请求多少 CPU、内存或 GPU |
| DAG/Task 并发参数 | 一个 DAG、DagRun 或 Task 可并发多少实例 |

例如 LLM 调用可以放入 `llm_api` Pool 控制第三方 API 并发，同时发送到 `llm` Celery queue，让装有对应依赖的 Worker 执行。

## 2. 多 Scheduler 冲突控制


HA Scheduler 使用 Metadata DB 行锁协调调度关键区，不额外要求 ZooKeeper、Consul 或 Raft。多个 Scheduler 对 Pool 等记录执行 `SELECT ... FOR UPDATE NOWAIT/SKIP LOCKED` 一类操作，确保全局 Pool 和并发限制。

Celery 使用的 Redis/RabbitMQ 是执行命令 Broker，不是 Scheduler 选主或分布式锁。
