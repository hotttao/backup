---
weight: 42
title: "DolphinScheduler 任务分配原理：Master、Worker Group、注册中心与锁"
date: 2024-10-11T08:00:00+08:00
lastmod: 2026-09-14T08:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "解释 Master、Worker Group 和任务归属"
featuredImage:

tags: ["workflow"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

# DolphinScheduler 任务分配原理：Master、Worker Group、注册中心与锁

DolphinScheduler 内容分成四篇：

1. [第 1 篇](./041_dolphinscheduler.md)；

2. **本文**；

3. [第 3 篇](./043_dolphinscheduler_execution_recovery.md)；

4. [第 4 篇](./044_dolphinscheduler_task_delivery_data_model.md)。

## 1. Queue 基于什么实现

DolphinScheduler 没有一个可以简单等同于 RabbitMQ/Celery 的单一队列。它由三层组成：

```text
Metadata DB
  t_ds_command / workflow instance / task instance（持久状态）
       -> Master 的按 Worker Group 待分发队列（内存调度结构）
       -> Master 通过 RPC dispatch
       -> Worker 的执行线程/任务执行器
       -> 状态事件回传 Master 并写数据库
```

- **Command 表**是工作流启动意图的持久入口。Quartz、手工运行、补数、恢复等操作最终让 Master 有可消费的命令。
- **Workflow/Task Instance 表**是运行状态权威记录。Master 重启后可以据此做 failover 和恢复判断。
- **Master 待分发队列**按 Worker Group 组织等待发送的任务，属于节点内存结构；最新版本还对不存在的 Worker Group 或无可用 Worker 增加了 dispatch timeout 检查。
- **RPC**承担 Master 到 Worker 的实时分发及确认，不要求部署 Celery、RabbitMQ 或 Kafka。
- **Registry**承担服务发现、协调和锁，不保存全部任务执行历史。

因此，“队列是否可靠”要分别看 Command 是否持久化、Task Instance 状态是否正确、Master failover 能否接管，以及 Worker 执行副作用是否幂等。不能因为使用了数据库和注册中心，就假设每个外部任务天然 exactly-once。

## 2. 注册中心与 Distributed Lock

当前代码和配置支持的 Registry 实现包括：

- ZooKeeper：默认、部署资料最丰富；
- etcd：可选 Registry Plugin；
- JDBC：以数据库实现注册与协调，减少一个独立中间件，但要评估轮询、故障检测延迟和数据库压力。

注册中心用于服务注册、节点变化监听、选主/协调和分布式锁。例如 Master failover 需要防止多个节点同时处理同一个失效节点。它不是只支持 Redis 或 ZooKeeper，也不以 Redis 为默认选项。

选择建议：已有稳定 ZooKeeper/etcd 集群时优先复用团队熟悉的实现；小规模希望减少组件时可验证 JDBC Registry。无论选择哪一个，都要测试 session/lease 过期、网络分区、注册中心切换和重复 failover。Metadata DB 仍然不可省略。
