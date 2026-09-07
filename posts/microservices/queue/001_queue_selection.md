---
weight: 1
title: "主流消息队列选型：不要只比较吞吐量"
date: 2026-09-06T08:00:00+08:00
lastmod: 2026-09-06T08:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "从架构、顺序性、复制一致性和故障恢复四个维度比较主流消息队列"
featuredImage:

tags: ["message-queue", "microservices"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

消息队列选型首先要区分两类产品：RabbitMQ、ActiveMQ Artemis 擅长任务队列和复杂路由；Kafka、Pulsar、RocketMQ 更接近可回放的分布式日志。NATS JetStream 追求简单和低延迟，Redis Streams 则适合已经使用 Redis、规模可控的轻量场景。

本文只讨论可自建、具备生产级集群能力的主流组件。Amazon SQS、Google Pub/Sub、Azure Service Bus 等云服务很重要，但其复制和修复过程由云厂商隐藏，不适合回答本文的底层架构问题。

<!-- more -->

## 1. 本系列如何理解 reparation

问题清单中的 `reparation` 不是消息队列领域的通用术语。本文把它解释为两部分：

1. 节点或磁盘故障后，如何选主、追赶数据、补齐副本并重新提供服务；
2. 扩缩容时，如何迁移分区、队列或副本，也就是 repartition、reassignment 或 rebalance。

## 2. 主流组件总览

| 组件 | 核心模型 | 生产高可用基线 | 顺序范围 | 复制模型 | 更适合 |
|---|---|---|---|---|---|
| Kafka | 分区日志 | 3+ KRaft Controller、多个 Broker、分区 3 副本 | 单分区 | Leader + ISR | 事件流、日志、CDC、大吞吐 |
| RabbitMQ | Exchange + Queue / Stream | 3 节点、Quorum Queue 或 Stream | 单队列；Super Stream 单分区 | 每队列一个 Raft 组 | 任务队列、复杂路由、低延迟业务消息 |
| RocketMQ | Topic + MessageQueue | 3 NameServer、3 Controller、多个 Broker 副本组 | MessageGroup / 单队列 | Master + SyncStateSet | 交易消息、定时消息、顺序和事务消息 |
| Pulsar | 分区 Topic + Managed Ledger | 3+ Broker、3 元数据节点、3+ Bookie、AutoRecovery | 单分区或 Key_Shared 的单 Key | BookKeeper E/Qw/Qa | 多租户、海量 Topic、长积压、跨地域 |
| NATS JetStream | Subject + Stream + Consumer | 3 节点集群、重要 Stream 使用 R=3 | 单 Stream；业务拆流后单流 | 每个 Stream/Consumer 一个 Raft 组 | 云原生控制面、低延迟、轻量事件流 |
| Redis Streams | Stream Key + Consumer Group | Redis Cluster 至少 3 主 3 从，或 Sentinel 主从 | 单 Stream ID 顺序 | 异步主从复制 | 轻量队列、已有 Redis 的中小规模系统 |
| ActiveMQ Artemis | Address + Queue | 多个 live-backup 对组成集群 | 单队列或 Message Group | 共享存储或 live-backup 复制 | JMS/AMQP、传统企业集成、协议兼容 |

这里的“单分区顺序”只表示 Broker 的存储和投递顺序，不自动等于业务完成顺序。并发消费者、批处理、超时重投和失败重试都可能让完成顺序变化。

## 3. 选型结论

### 3.1 优先 Kafka 的情况

需要高吞吐、长时间保留、回放、CDC 或流处理生态时，Kafka 通常是默认答案。代价是分区规划、消费者 Rebalance、容量迁移和 JVM 运维复杂度。

### 3.2 优先 RabbitMQ 的情况

需要 AMQP 路由、请求削峰、工作队列、按消息确认和低延迟投递时，RabbitMQ 更自然。新系统的高可用队列应优先使用 Quorum Queue；需要回放和分区吞吐时考虑 Stream/Super Stream。

### 3.3 优先 RocketMQ 的情况

业务非常依赖事务消息、延时/定时消息、按订单号严格有序，并且团队有 Java 与 RocketMQ 运维经验时，RocketMQ 很有竞争力。生产环境应使用支持自动切换的 Controller 模式，不要把旧式无自动选主的主从部署当成完整高可用。

### 3.4 优先 Pulsar 的情况

多租户、Topic 数量多、积压大、需要存算分离或跨地域复制时选择 Pulsar。它的 Broker 扩容不搬数据，但 BookKeeper、元数据服务和 AutoRecovery 带来了更多组件和更高运维门槛。

### 3.5 优先 NATS JetStream 的情况

追求部署简单、低延迟、Subject 路由，并需要比 Core NATS 更可靠的持久化时选择 JetStream。它没有 Kafka 式分区；超出单 Stream Leader 的写入能力后，要主动按 Subject 拆分多个 Stream。

### 3.6 Redis Streams 的边界

Redis Streams 适合轻量任务流，但不应仅因为“已经有 Redis”就承担关键事件总线。Redis Open Source 的复制默认异步，Cluster 中单个 Stream Key 也只属于一个主节点；高可靠、大吞吐和长积压场景通常应选择专用消息系统。

### 3.7 ActiveMQ Artemis 的位置

需要 JMS、AMQP、MQTT、STOMP 等多协议兼容，或已有 Java EE/传统企业集成资产时，Artemis 仍然合适。绿地的大规模事件流项目通常优先比较 Kafka、Pulsar 和 RocketMQ。

## 4. 提交边界与临界故障

在做最终选型前，先把一次最危险的故障按时间展开：

```text
T1  Client 把消息 M 发给 Leader
T2  Leader 在本地接收或写盘
T3  M 被复制到其他副本
T4  系统把 M 标记为 committed
T5  Leader 向 Client 返回 ACK
T6  Client 收到 ACK
```

真正的关键不是“有几个副本”，而是系统把 T4 定义在哪里，以及是否可能在 T2 后、T3 前就执行 T5。

| 组件 | 复制模型 | 正常的成功响应边界 | Leader 在复制完成前故障 | 旧 Leader 恢复后的尾消息 |
|---|---|---|---|---|
| Kafka | Leader + ISR，不是固定多数派 Raft | `acks=all` 时当前 ISR 全部确认，且 ISR 数不低于 `min.insync.replicas` | 客户端无 ACK；新 Leader 不应暴露未提交记录 | 按新 Leader 截断冲突尾部并追赶 |
| RabbitMQ Quorum Queue | 每条队列一个 Raft 组 | Publisher Confirm 在多数副本写盘并 fsync 后返回 | 未提交操作不会生效；客户端无 Confirm | 回滚未提交 Log，按新 Leader Catch-up |
| RocketMQ Controller 模式 | Master-Slave + SyncStateSet；Controller 用 Raft | 取决于 `allAckInSyncStateSet` / `inSyncReplicas`；异步模式可在从节点收到前成功 | 异步模式可能丢失已经返回成功的消息；同步模式返回超时/失败 | 旧 Master 按 Epoch 降为副本并与新 Master 对齐，孤立尾部不能自行恢复为已提交消息 |
| Pulsar | Broker 单写者 + BookKeeper `E/Qw/Qa` | `Qa` 个 Bookie 持久化后 Producer 才成功 | 未收到 ACK 的 Entry 可能丢失，也可能在 Ledger Recovery 中被补成 Quorum | Ledger 被 Fence；Recovery 决定最终尾部并收敛到同一 LastAddConfirmed |
| NATS JetStream | 每个 Stream 一个 Raft 组 | R=3 时多数副本接收后返回 PubAck | 未形成多数派的写入不提交，客户端无 PubAck | 丢弃未提交尾部，按新 Leader Catch-up |
| Redis Streams | 异步 Master-Replica | 默认 Master 本地执行完就返回，不等 Replica | 可能丢失已经向客户端返回成功的消息 | 旧 Master 变 Replica，以新 Master 为准；独有写入被覆盖/丢弃 |
| ActiveMQ Artemis Replication | Active-Passive 的 Primary-Backup | 默认阻塞 Durable Send；本地 Journal 持久化且已同步 Backup 时，操作完成上下文才允许响应 | 未收到响应时结果未知；只有已写入持久存储并完成有效备份的数据才能安全接管 | 旧 Primary 先从当前 Active 全量同步，再 Failback，不能带着旧尾部直接激活 |

还要区分 T5 与 T6：消息可能已经提交，但 ACK 在返回途中丢失。此时客户端看到的仍是超时，无法判断消息到底有没有提交。通用处理原则是：

1. 每条消息携带稳定的业务消息 ID；
2. 超时后使用同一个 ID 重试，不生成新的业务 ID；
3. 启用 Kafka 幂等 Producer、NATS `Nats-Msg-Id`、Artemis `_AMQ_DUPL_ID` 等 Broker 去重能力；
4. 消费者仍必须实现 Inbox/唯一键等业务幂等，因为 Broker 去重窗口有限，至少一次投递也会产生重复；
5. 需要数据库更新与发消息原子一致时使用 Transactional Outbox，不把一次网络 ACK 当成端到端 exactly-once。

## 5. 最终决策问题

在压测之前先回答这些问题：

1. 消息是消费后删除，还是必须保留并可回放？
2. 顺序范围是全局、租户、用户、订单，还是完全不需要？
3. 可接受至少一次带来的重复吗？消费者是否幂等？
4. 一次机架或可用区故障时，允许丢失已确认消息还是暂停写入？
5. 峰值吞吐、平均消息大小、最长积压时间和 Topic/Queue 数量是多少？
6. 是否需要事务、延时、优先级、死信、协议兼容或跨地域复制？
7. 团队能否运维控制面、磁盘容量、滚动升级和副本迁移？

没有这些数据，“每秒百万消息”一类 benchmark 对真实选型帮助很小。

## 6. 系列文章

- [Kafka](002_kafka.md)
- [RabbitMQ](003_rabbitmq.md)
- [RocketMQ](004_rocketmq.md)
- [Apache Pulsar](005_pulsar.md)
- [NATS JetStream](006_nats_jetstream.md)
- [Redis Streams](007_redis_streams.md)
- [ActiveMQ Artemis](008_activemq_artemis.md)

## 7. 参考资料

- [Apache Kafka 4.2 Design](https://kafka.apache.org/42/design/design/)
- [RabbitMQ Quorum Queues](https://www.rabbitmq.com/docs/quorum-queues)
- [RocketMQ 5.0 Ordered Message](https://rocketmq.apache.org/docs/featureBehavior/03fifomessage/)
- [Apache Pulsar Architecture Overview](https://pulsar.apache.org/docs/4.1.x/concepts-architecture-overview/)
- [NATS JetStream](https://docs.nats.io/concepts/jetstream)
- [Redis Streams](https://redis.io/docs/latest/develop/data-types/streams/)
- [ActiveMQ Artemis Documentation](https://activemq.apache.org/components/artemis/documentation/latest/)
