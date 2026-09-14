---
weight: 32
title: "Flowable 任务归属原理：数据库 Job、锁与并发控制"
date: 2024-10-11T08:00:00+08:00
lastmod: 2026-09-14T08:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "解释数据库 Job 领取和并发控制"
featuredImage:

tags: ["workflow"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

# Flowable 任务归属原理：数据库 Job、锁与并发控制

Flowable 内容分成四篇：

1. [第 1 篇](./031_flowable.md)；

2. **本文**；

3. [第 3 篇](./033_flowable_execution_recovery.md)；

4. [第 4 篇](./034_flowable_task_delivery_data_model.md)。

## 1. Queue 基于什么实现

Flowable 核心 Job Queue **基于关系数据库表实现**，不要求 Redis、Kafka、RabbitMQ 或 ZooKeeper。

主要运行态队列可以理解为：

| 状态/表 | 含义 |
|---|---|
| Timer Job | 未到期的定时器，带 due date |
| Executable Job | 已可执行的异步工作 |
| Dead Letter Job | 重试耗尽，停止自动执行 |
| Suspended Job | 因定义/实例挂起而暂停 |
| External Worker Job | 等待外部 Worker 按 topic 获取 |

Async Executor 的获取线程查询可运行且未锁定的 Job，通过数据库更新写入 lock owner 和 lock expiration time，成功抢占后交给节点本地线程池。节点内还有一个有界内存队列，但它只是执行缓冲层，不是持久化真相。如果本地队列已满，Job 会被解锁/退回，以便以后重新获取。

因此 Queue 分成两层：

```text
关系数据库 Job 表（持久、集群共享、可恢复）
        -> 节点 acquisition thread 抢锁
        -> 节点本地 executor queue（短暂内存缓冲）
        -> worker thread 执行
```

Event Registry 可以连接 Kafka、RabbitMQ、JMS 或 HTTP，用于收发业务事件。它们不是核心异步 Job Queue 的必选依赖，也不替代数据库里的流程状态。

## 2. Distributed Lock 是否只支持 Redis 或 ZooKeeper

Flowable 的普通流程推进和 Job 获取都不以 Redis/ZooKeeper 为前提。三节点共享关系数据库，通过行更新、乐观锁、lock owner 和 lock expiration 等机制协调任务归属。

一个 Job 被节点 1 获取后会带租约。若节点 1 宕机，没有清理锁，租约到期后清理/重置线程会让它重新可获取，节点 2 或 3 可以继续执行。官方高级文档给出的典型默认值是 Job lock 约 5 分钟、过期锁重置扫描约 60 秒；实际值应以部署配置为准。这也意味着恢复不是瞬时的，最坏延迟受锁时长与扫描周期影响。

对核心调度来说，更准确的问题不是“支持哪一种外部分布式锁”，而是：

- 共享数据库能否承受获取 Job 的查询和更新；
- 锁租约是否覆盖正常任务耗时；
- 节点 GC 暂停、网络分区或任务超时后会不会重复执行；
- 业务副作用是否幂等；
- 数据库故障转移时连接和事务行为是否正确。

Redis、ZooKeeper 或 Consul 可以用于应用的其他协调需求，但不是 Flowable 三节点 Job Executor 的标准必需组件。

## 3. 工作流状态如何持久化

Flowable 使用关系数据库表保存定义、运行态、任务、变量、Job 和历史。表名前缀通常为 `ACT_`：

| 表类别 | 用途 | 常见内容 |
|---|---|---|
| `ACT_RE_*` | Repository | Deployment、Process Definition、BPMN 资源 |
| `ACT_RU_*` | Runtime | Execution、User Task、Variable、Job、Event Subscription |
| `ACT_HI_*` | History | 已启动/结束的实例、活动、任务、变量更新 |
| `ACT_GE_*` | General | 通用属性和二进制资源 |

运行中的 Process Instance 不是一份整体 JSON 快照。引擎把 Execution 树、变量、Task、Job、事件订阅等规范化地存到多张表。实例结束后，运行态记录会被删除；是否保留以及保留多少历史取决于 history level。

常用历史级别包括：

- `none`：不保存历史；
- `activity`：保存实例和活动；
- `audit`：默认常用级别，进一步保存任务、当前变量和表单属性；
- `full`：保留更细的变量更新等详情，数据量最大。

不要把视频、图片、长文本和大模型完整上下文直接堆进流程变量。推荐把大对象存入 S3/MinIO/数据库业务表，流程变量只保存 URI、业务 ID、摘要、版本和校验值。

### 3.1 乐观锁和并发

当两个请求同时修改同一个流程实例，Flowable 通过数据库版本字段和乐观锁检测冲突，可能抛出 `FlowableOptimisticLockingException`。调用端应判断操作是否可安全重试。对并行异步任务可使用 exclusive job，避免同一流程实例的多个 Job 同时推进产生冲突；这会降低单实例内部并发，需要按流程选择。
