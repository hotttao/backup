---
weight: 22
title: "RabbitMQ（二）：Queue 存储、多副本一致性与故障恢复"
date: 2026-09-06T10:00:00+08:00
lastmod: 2026-09-08T10:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "沿 fulfill.q 的入队、投递和 Ack 状态，理解 Quorum Queue 的 rabbit_fifo、Raft 提交与故障恢复"
featuredImage:
tags: ["message-queue", "rabbitmq", "quorum-queue"]
categories: ["microservice"]
lightgallery: true
toc:
  auto: false
---

[第一篇](021_rabbitmq.md)已经说明 Exchange、Binding、Quorum Queue、Connection、Channel 与 Consumer 的完整路径。本文从 `fulfill.q` Leader 收到 `order-1001` 的位置继续：Queue 状态如何落入 Raft Log、何时返回 Publisher Confirm、Leader 切换如何区分已提交与未提交消息，以及 Unacked/Ack 状态如何恢复。

<!-- more -->

## 1. 从 Queue 命令到底层存储

每条 Quorum Queue 都是一个独立 Raft Group，但 Raft 只负责复制有序命令；Queue 语义由 `rabbit_fifo` 状态机解释。

```text
客户端与 Channel
    → enqueue / checkout / settle / return 等 Queue 命令
    → Raft Log
    → rabbit_fifo 按提交顺序应用
    → Ready、Consumer、Credit、Checked-out 状态
```

需要区分两类数据：

- **Raft Log 与 Snapshot**保存如何重建状态机的已提交历史；
- **rabbit_fifo 状态**表示当前哪些消息 Ready、交给了哪个 Consumer、是否 Ack/Reject、还有多少 Credit。

Quorum Queue 不是“消息正文一个文件、Unacked 一张表”。消息和状态变化作为 Raft 命令持久化，Snapshot 压缩已经应用的历史；节点恢复时加载 Snapshot，再重放后续 Log。

### 1.1 一条 Queue 一个 Raft Group意味着什么

`fulfill.q` 的 Leader 在 `rmq-1`、Followers 在 `rmq-2/3`。另一条 `audit.q` 可以拥有不同成员和 Leader。

因此：

- 一条 Queue 的写入只影响自己的 Raft Group；
- 增加 Queue 可以把 Leader 分散到更多节点；
- 增加某条 Queue 的副本数会增加写放大，不会增加该 Queue 的单 Leader 写吞吐；
- 五节点集群不表示每条 Queue 都有五副本。

## 2. 从 Publish 到 Publisher Confirm

假设 `fulfill.q` 有 A、B、C 三个成员，A 是 Leader。Producer 已经经过 Exchange 路由，接入 Channel 把 Enqueue 交给 A。

```mermaid
sequenceDiagram
    autonumber
    participant P as Publisher
    participant CH as 接入 Channel
    participant A as Leader A
    participant B as Follower B
    participant C as Follower C

    P->>CH: basic.publish M
    CH->>A: enqueue M
    A->>A: 追加本地 Raft Log
    par AppendEntries
        A->>B: 复制 Log Entry
        A->>C: 复制 Log Entry
    end
    B->>B: 持久化
    B-->>A: Match Index 前进
    Note over A,C: A+B 构成多数派
    A->>A: 推进 Commit Index
    A->>A: rabbit_fifo 应用 enqueue
    A-->>CH: Queue 接受成功
    CH-->>P: Publisher Confirm
```

这里有三个不同时间点：

1. Leader 收到 M；
2. 多数成员持久化对应 Raft Entry；
3. Leader 判断该 Entry 已提交、状态机应用并返回 Confirm。

Publisher Confirm 的边界是第 3 个，不是第 1 个。Follower C 可以稍后追赶，不需要等待全部成员。

Quorum Queue 的持久 Publisher Confirm 会等待消息被复制并写入多数成员磁盘。副本网络延迟和磁盘延迟因此直接进入 Confirm 延迟。

## 3. Leader 如何判断消息已经提交

每个成员维护自己的 Raft Log Index。Leader 根据 Follower 返回的复制进度计算：某个 Index 是否已经存在于多数成员。

```text
A Leader:   ... 40 41 42
B Follower: ... 40 41 42
C Follower: ... 40 41

Index 42 已在 A+B
→ 三成员中的多数派
→ Leader 可推进 Commit Index 到 42
```

新 Leader 不是查看“最后一个本地文件”猜测提交点，而是依赖 Raft 选举约束：

- 候选者必须获得多数派选票；
- 投票者会比较候选者日志是否足够新；
- 已提交 Entry 至少存在于旧多数派；
- 新 Leader 也需要新多数派；
- 两个多数派必然相交，因此已提交历史不能被缺少它的候选者合法覆盖。

这就是 Leader 切换时判断“最新消息是否属于有效历史”的根本，不依赖客户端 Confirm 是否已经送达。

## 4. 三个临界故障场景

### 4.1 只写到旧 Leader，尚未提交

```mermaid
sequenceDiagram
    participant P as Publisher
    participant A as 旧 Leader A
    participant B as Follower B
    participant C as Follower C

    P->>A: Publish M
    A->>A: 仅本地追加 M
    Note over A,C: M 未形成多数派
    A--xA: A 故障
    B->>C: B、C 选出新 Leader
    Note over B,C: 有效历史不包含 M
    P->>B: 用相同 event_id 重试
```

客户端没有收到 Confirm，应把结果视为未知。此例中新 Leader 的已提交历史没有 M，重试是必要的。

旧 A 恢复后不能把自己的孤立 M 注入新 Leader。它作为 Follower 比较日志，截断冲突尾部并追赶当前历史。

### 4.2 已复制多数派，但 Confirm 丢失

A、B 已经持久化并提交 M，Confirm 在返回途中丢失：

- 新 Leader 仍会保留 M；
- Publisher 只看到超时；
- Publisher 重试会再次发布同一业务消息；
- RabbitMQ 不会根据任意业务字段自动替 Producer 去重。

因此 Producer 使用稳定 `event_id`，Consumer 使用业务唯一键或状态机幂等。Raft 保证 Broker 内部只有一条已提交历史，不保证跨网络请求“只执行一次”。

### 4.3 失去多数派

A、B 同时不可用，只剩 C。C 可能落后，也无法证明另外两个节点没有形成更新历史，所以必须停止这条 Queue 的安全写入和接管。

这不是可用性缺陷，而是多数派一致性的选择：在无法同时保证一致性和可用性时，不允许两个分区各自产生一条 `fulfill.q` 历史。

## 5. Consumer 投递和 Ack 如何进入一致状态

第一篇说明了 Channel 本地 Delivery Tag 与 Queue 内部消息状态的区别。实现层继续追踪 `M1001`：

```text
Queue Raft 状态：
M1001 → checked-out to worker-2, delivery-count=1

rmq-5 Channel 本地：
Delivery Tag 1 → fulfill.q / M1001
```

投递需要两类状态配合：

- Queue 把 Checkout/Consumer/Credit 状态通过 Raft 复制，因此新 Leader 能知道 M1001 尚未完成；
- Channel 的 Delivery Tag 映射不复制，因为它只属于当前 AMQP Channel。

### 5.1 Ack 的完整路径

```mermaid
sequenceDiagram
    participant W as worker-2
    participant CH as rmq-5 Channel
    participant A as Queue Leader A
    participant B as Follower B
    participant C as Follower C

    W->>CH: basic.ack delivery-tag=1
    CH->>CH: Tag 1 映射为 M1001
    CH->>A: settle M1001
    A->>B: 复制 settle
    A->>C: 复制 settle
    Note over A,C: settle 成为已提交状态
    A->>A: 移除 checked-out 并恢复 Credit
```

Ack 是 Queue 状态变化，也需要按 Raft 顺序提交。Ack 响应或连接丢失时，Consumer不能判断最终结果；消息可能已完成，也可能重新投递。

### 5.2 Consumer 或接入节点故障

- Channel 关闭后本地 Delivery Tag 映射消失；
- Queue 收到或检测到 Consumer Down，把其 Checked-out 消息重新变为可投递；
- 接入节点不是 Queue 成员时，其故障不会删除 Queue Raft 数据；
- 新 Channel 会重新从 Delivery Tag 1 开始，旧 Tag 不能跨 Channel Ack。

业务事务已经成功但 Ack 未提交时，重新投递是正确的至少一次语义。Consumer 必须在业务事务提交后 Ack，并能安全重复执行。

### 5.3 Queue Leader 故障

新 Leader从 Raft 状态恢复：

- Ready 消息；
- Consumer 与 Credit；
- 已 Checkout 但未 Ack 的消息；
- 已提交的 Ack/Reject；
- Delivery Count。

仍存活的 Channel 会重新与 Queue Leader 建立运行关系；短暂停顿不意味着 Consumer 要直连新 Leader。尚未确认消息根据恢复状态继续等待或重新投递。

## 6. Classic Queue 与 Quorum Queue 的实现边界

Classic Queue 与 Quorum Queue 共享 Queue API，但底层保证不同：

- Classic Queue 消息主要属于承载它的单个节点；
- Quorum Queue 使用 rabbit_fifo + Ra/Raft 复制状态；
- RabbitMQ 4.x 已移除旧式 Classic Mirrored Queue；
- “RabbitMQ 部署了三节点”不能推出某条 Classic Queue 有三副本。

选择 Classic Queue 通常是明确接受单节点数据故障边界，以换取较低复制成本或特定功能。关键任务不能只看集群节点数，必须检查 Queue Type 和实际成员。

## 7. Snapshot、成员修复与扩容

Raft Log 不会无限增长。RabbitMQ 周期性创建 Snapshot，把已应用状态压缩成恢复基线，并删除不再需要的旧日志段。

Follower 落后时：

- 缺口仍在日志范围内：复制缺失 Entries；
- 缺口已被压缩：安装 Snapshot 后继续追赶。

调整成员应采用：

```text
添加新成员
→ 等待同步完成
→ 验证多数派和 Leader
→ 再移除旧成员
```

新增 RabbitMQ 节点不会自动让所有已有 Queue 重新分布。必须显式检查并调整 Queue 成员和 Leader 布局。

## 8. 积压、背压与容量

容量至少估算：

```text
最大积压 ≈ 峰值生产速率 × 最长不可消费时间
磁盘需求 ≈ 积压消息字节 × 副本数 + Raft/Snapshot 开销
恢复能力必须长期高于恢复期生产速率
```

需要区分：

- Ready 增长：总体消费能力不足；
- Unacked 增长：处理慢、阻塞或 Prefetch 过大；
- Redelivered 增长：Consumer 故障、超时或业务失败；
- Confirm 延迟增长：副本网络、磁盘或流控压力。

Prefetch 过小增加往返，过大让单 Consumer 占住大量任务并扩大故障重投范围。大消息会同时放大内存、磁盘、复制和重投成本，通常应把大对象放在对象存储，只在 Queue 传引用与校验信息。

## 9. 跨地域与备份

Quorum Queue Raft 更适合低延迟局域网。跨地域同步部署会把地域 RTT带入每次多数派提交，并扩大网络分区影响。

跨地域通常使用独立 RabbitMQ 集群加 Federation/Shovel 异步传输。必须另外定义：

- 可接受的 RPO/RTO；
- 切换入口和回切流程；
- 重复与乱序范围；
- Queue 消费状态是否迁移；
- 两地同时写入时如何处理冲突。

导出 Definitions 只能恢复 Exchange、Queue 和 Binding 等拓扑，不能恢复未消费消息。在线副本也不能替代离线备份和恢复演练。

## 10. 实现结论

- Quorum Queue 是 rabbit_fifo 状态机与 Ra/Raft 的组合，不是普通异步主从。
- Enqueue、Checkout、Ack 和 Consumer/Credit 都属于 Queue 的有序状态。
- Publisher Confirm 在多数派持久化并提交后返回，不等待所有副本。
- 新 Leader 通过 Raft 的多数派相交和日志新旧约束继承已提交历史。
- 未提交尾部被截断；已提交但响应丢失会造成客户端重试和业务重复。
- Queue Raft 状态会恢复 Unacked，Channel Delivery Tag 不复制。
- 增加副本提高容错，不提高单 Queue 的分片吞吐。

## 11. 参考资料

- [RabbitMQ Quorum Queues](https://www.rabbitmq.com/docs/quorum-queues)
- [RabbitMQ Raft](https://www.rabbitmq.com/docs/raft)
- [RabbitMQ Ra Library](https://github.com/rabbitmq/ra)
- [Consumer Acknowledgements and Publisher Confirms](https://www.rabbitmq.com/docs/confirms)
- [RabbitMQ Quorum Queue Local Delivery](https://www.rabbitmq.com/blog/2020/06/23/quorum-queues-local-delivery)
- [RabbitMQ Reliability Guide](https://www.rabbitmq.com/docs/reliability)
- [RabbitMQ Monitoring](https://www.rabbitmq.com/docs/monitoring)
- [RabbitMQ Federation](https://www.rabbitmq.com/docs/federation)
