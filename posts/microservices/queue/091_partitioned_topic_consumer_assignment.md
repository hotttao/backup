---
weight: 1
title: "RabbitMQ、Kafka、Pulsar：多分区下的消费者分配对比"
date: 2026-09-09T18:00:00+08:00
lastmod: 2026-09-09T18:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "用同一个 4 分区 3 消费者场景，对比 RabbitMQ、Kafka、Pulsar 在消息流与任务队列模式下的分区分配、逐条派发和 Rebalance"
featuredImage:

tags: ["message-queue", "rabbitmq", "kafka", "pulsar"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

单分区时，RabbitMQ、Kafka、Pulsar 的消费者行为比较直观；变成四分区后，容易把“Producer 选择分区”“系统把分区分给 Consumer”和“系统把分区中的消息分给 Worker”混成一件事。本文固定使用四分区、三个 Consumer，只比较消费者分配层级。

<!-- more -->

## 1. 先统一两个消费目标

“消息队列”和“任务队列”在不同产品文档中的含义并不完全一致。为了能够横向比较，本文把你说的“消息队列消费者”具体定义为事件流/发布订阅消费者，再与逐条竞争的任务队列比较。

### 1.1 消息流模式：每个下游服务获得完整消息流

仓储服务和风控服务都需要读取全部订单事件：

```text
orders：P0、P1、P2、P3

warehouse-v1：需要完整读取 P0～P3
risk-v1：      也需要完整读取 P0～P3
```

一个服务可以部署多个实例。服务内部通常希望一个 Partition 同一时刻只有一个实例负责，以便维护分区顺序和连续 Offset；不同服务使用不同 Group、Subscription 或 Consumer Name，各自读取一份完整数据。

本文用以下机制对比这种模式：

- RabbitMQ：Super Stream + 同名 Consumer + Single Active Consumer（SAC）；
- Kafka：普通 Consumer Group；
- Pulsar：Failover Subscription。

### 1.2 任务队列模式：多个 Worker 竞争同一批任务

履约服务有三个 Worker，每条任务只需要其中一个 Worker 完成：

```text
fulfill-workers：worker-A、worker-B、worker-C

order-1001 的某条任务 → 只交给其中一个 Worker
处理成功               → Ack/Accept，不再向同组重复投递
处理失败或 Worker 消失  → 可以交给另一个 Worker 重试
```

这里更关心逐条任务竞争、独立确认和故障重投，而不是让一个 Worker 长期独占整个 Partition。本文用以下机制比较：

- RabbitMQ：4 个 Queue 分片上的 Competing Consumers；
- Kafka：Share Group；
- Pulsar：Shared 或 Key_Shared Subscription。

## 2. 永远先分清三次选择

无论使用哪种产品，多分区消费都可以按三问拆开：

```text
第一问：消息进入哪个分区？
Producer / Exchange Router → P0、P1、P2、P3 之一

第二问：哪些 Consumer 有资格读取这个分区？
Group Assignor / SAC / Subscription / 应用配置 → Consumer 集合

第三问：分区中的下一条消息具体交给谁？
独占读取、Queue 派发、Share Fetch 或 Dispatcher → 某个 Consumer
```

最容易混淆的是第二问和第三问：

- Kafka 普通 Consumer Group 主要在第二问分配 Partition，分区内不再选择第二个 Consumer；
- RabbitMQ Queue、Kafka Share Group、Pulsar Shared 允许同一个分区或 Queue 在第三问继续把不同消息交给不同 Worker；
- Producer 的 Key 路由只回答第一问，不直接指定最终 Worker。

## 3. 四分区消息流如何分配

先假设 `warehouse-v1` 有三个实例 A、B、C。为了便于观察，下面都使用同一份示意分配：

```text
P0 → Consumer A
P1 → Consumer B
P2 → Consumer C
P3 → Consumer A
```

这只是一个可能结果。重点不是 P3 必须属于 A，而是一个 Partition 同一时刻只有一个 Active Consumer；因为 Partition 比 Consumer 多，所以某个 Consumer 必须负责两个 Partition。

### 3.1 RabbitMQ Super Stream + SAC

RabbitMQ 的 AMQP Topic Exchange 不是 Kafka/Pulsar 意义上的 Topic，也没有 Partition。与四分区 Topic 对应的是一个由四条普通 Stream 组成的 Super Stream：

```text
orders Super Stream
├─ orders-0
├─ orders-1
├─ orders-2
└─ orders-3
```

A、B、C 都以相同 Consumer Name `warehouse-v1` 订阅 Super Stream。客户端在每个分区 Stream 上建立 Subscription，SAC 再为每个分区选一个 Active，其余实例在该分区上 Standby：

```text
orders-0：A Active，B/C Standby
orders-1：B Active，A/C Standby
orders-2：C Active，A/B Standby
orders-3：A Active，B/C Standby
```

另一个下游 `risk-v1` 使用不同 Consumer Name，会形成另一组 P0～P3 Active 分配并独立保存 Offset。`warehouse-v1` 的进度不会替 `risk-v1` 推进。

成员变化时，Stream Coordinator 调整各分区的 Active Subscription。A 故障后，P0 和 P3 分别选择新的 Active，从 `warehouse-v1 + 分区 Stream` 最后保存的 Stored Offset 恢复。B、C 分别接手哪个分区是协调结果，不应写死在业务代码中。

### 3.2 Kafka 普通 Consumer Group

Kafka Topic 原生由四个 Partition 组成。A、B、C 加入同一个 `warehouse-v1` Consumer Group 后，Group Coordinator 和 Group Assignor 保证同一个 Group 内一个 Partition 同一时刻只分配给一个 Consumer：

```text
warehouse-v1 Group
├─ P0 → A
├─ P1 → B
├─ P2 → C
└─ P3 → A
```

Consumer 直接从自己被分配的 Partition Leader 拉取数据，并为 `Group + Partition` 提交 Offset。另一个 `risk-v1` Group 会独立获得 P0～P3，并维护另一组 Offset。

消费者数量与有效并行度关系是：

```text
4 Partition + 3 Consumer → 3 个 Consumer 都工作，其中 1 个负责两个 Partition
4 Partition + 4 Consumer → 通常每人一个 Partition
4 Partition + 6 Consumer → 同一 Group 最多 4 个 Consumer 有 Partition，另外 2 个空闲
```

A 加入、离开或订阅集合变化时会触发 Group Rebalance。分配器可能把 Partition 从一个 Consumer 转移给另一个 Consumer；新 Owner 从已提交 Offset 继续。Rebalance 转移的是读取责任，不会搬迁 Partition 日志。

### 3.3 Pulsar Failover Subscription

Pulsar 的 Partitioned Topic 也是四个内部 Topic：

```text
persistent://shop/order/orders
├─ orders-partition-0
├─ orders-partition-1
├─ orders-partition-2
└─ orders-partition-3
```

A、B、C 使用相同 Subscription Name `warehouse-v1` 和 Failover 类型。标准客户端会连接各 Partition，Broker 在每个 Partition 上选一个 Active Consumer，并让其他 Consumer Standby。对于 Partitioned Topic，Pulsar 会根据优先级和 Consumer Name 排序，再按 Partition Index 分散 Active：

```text
P0 → A Active，B/C Standby
P1 → B Active，A/C Standby
P2 → C Active，A/B Standby
P3 → A Active，B/C Standby
```

每个 Partition 有独立的 `warehouse-v1` Managed Cursor。A 断开时，P0、P3 分别切换到各自下一名 Consumer，从对应 Cursor 继续；不存在一个覆盖 P0～P3 的全局 Cursor。

Pulsar Exclusive 不适合用三个实例分摊这四个 Partition：同一 Exclusive Subscription 只允许一个 Consumer，该 Consumer 会读取全部 Partition。需要分区级 Active/Standby 分摊时应使用 Failover。

### 3.4 消息流模式的共同点与差异

| 产品与模式 | 分区级 Active 数 | 4P/3C 的有效 Consumer | 进度单位 | 成员变化 |
|---|---:|---:|---|---|
| RabbitMQ Super Stream + SAC | 每分区 1 个 | 3 | Consumer Name + Stream 分区 | Coordinator 切换各分区 Active |
| Kafka Consumer Group | 每分区 1 个 | 3 | Group + Partition Offset | Group Rebalance 重新分配 Partition |
| Pulsar Failover | 每分区 1 个 | 3 | Subscription + Partition Cursor | 每分区切换 Active Consumer |

这一组可以记成：

```text
消息流扩容的基本单位 = Partition
同一服务内，一个 Partition 同时只有一个 Active Reader
Consumer 数超过 Partition 数，额外实例只会空闲或 Standby
```

## 4. 四分区任务队列如何分配

现在改成履约任务，A、B、C 属于同一组。目标是让同一 Partition 内的不同消息也能并行交给不同 Worker。

### 4.1 RabbitMQ：四个 Queue，每个 Queue 内竞争

RabbitMQ Classic/Quorum Queue 本身不是 Partitioned Topic。一条 Queue 可以有副本，但副本不等于消费分区；Quorum Queue 的多个 Replica 也不会各自向不同 Worker 派发一部分消息。

要得到四个可并行的 Queue 分片，需要显式创建四条 Queue，再通过 Exchange、Binding 和 Routing Key 将消息路由到其中一条：

```text
orders.tasks Exchange
├─ key/hash → tasks.q0
├─ key/hash → tasks.q1
├─ key/hash → tasks.q2
└─ key/hash → tasks.q3
```

如果希望任意 Worker 都能处理任意分片，A、B、C 必须分别消费四条 Queue：

```text
tasks.q0 → {A, B, C}
tasks.q1 → {A, B, C}
tasks.q2 → {A, B, C}
tasks.q3 → {A, B, C}

总计：4 Queue × 3 Worker = 12 个 Queue Consumer 注册
```

每条 Queue 独立在自己的可用 Consumer 之间派发消息。默认活跃 Consumer 通常以 Round-robin 为基础，实际在途分布还会受到 Prefetch、Consumer Priority、连接状态和处理速度影响。

RabbitMQ 没有一个 Coordinator 把 q0～q3 自动均衡为 `A={q0,q3}、B={q1}、C={q2}`。Worker 加入时，它只是成为四条 Queue 的新候选 Consumer；Worker 连接断开时，它的未 Ack Delivery 被重新入队，并由相应 Queue 的其他 Consumer 重投。若只让每个 Worker 连接部分 Queue，分片归属和故障接管就是应用或框架自己的职责。

RabbitMQ 单 Queue 已经允许多个 Competing Consumer，所以任务并行度不受 Queue 数限制。增加到四条 Queue 通常是为了突破单 Queue Leader 的吞吐上限或隔离热点，而不是为了让三个 Worker 能并行。

### 4.2 Kafka Share Group：Partition 可以由多个 Share Consumer 共同处理

Producer 仍先把任务写入 P0～P3。A、B、C 加入同一个 Share Group 后，Partition 不再像普通 Consumer Group 那样只能属于一个 Consumer：一个 Partition 可以分配给多个 Share Consumer，Consumer 数也可以超过 Partition 数。

```text
普通 Consumer Group：P0 → A，P0 的记录只能由 A 顺序拉取

Share Group：
P0/Offset 40 → A 获取
P0/Offset 41 → B 获取
P0/Offset 42 → C 获取
```

Share Group 的 Assignor 决定哪些成员可以从哪些 Partition Fetch，具体分配不必是所有 Consumer 连接所有 Partition，因此不应把一个固定的 4×3 连接矩阵写进应用假设。只需要依赖两条语义：

1. 同一 Partition 可以由多个 Share Consumer 协作消费；
2. 同一条 Record 在有效 Acquisition Lock 锁期间只交给一个 Share Consumer。

Worker 成功后逐条 Accept；主动放弃时 Release；无法处理时 Reject；Worker 消失或锁超时后，Record 可以再次被其他 Worker 获取。Share Group 保存逐条/范围化任务状态，不再只用一个连续提交 Offset 表达完成情况。

Share Group 适合任务乱序并行，但不应再依赖 Partition 内严格处理顺序。Key 仍然只决定任务进入哪个 Partition，不保证同 Key 的任务长期交给同一个 Share Consumer。

### 4.3 Pulsar Shared：每个 Partition 都有一组竞争 Consumer

Pulsar 客户端订阅四分区 Topic 时，应用看到一个 Consumer，内部会为每个 Partition 创建 Consumer。三个 Worker 通常形成：

```text
P0 Shared Dispatcher → {A/P0, B/P0, C/P0}
P1 Shared Dispatcher → {A/P1, B/P1, C/P1}
P2 Shared Dispatcher → {A/P2, B/P2, C/P2}
P3 Shared Dispatcher → {A/P3, B/P3, C/P3}

总计：4 Partition × 3 Worker = 12 个内部 Consumer
```

Producer 先决定 Partition；该 Partition Owner Broker 上的 Shared Dispatcher 再根据 Consumer 是否在线、是否有 Permit 等状态，把不同消息交给不同 Worker。四个 Dispatcher 互不共享轮询指针、Permit、Unacked 和 Cursor。

Worker 加入时，它分别加入四个 Dispatcher 的候选集合；Worker 断开时，四个 Dispatcher 分别移除其内部 Consumer，并重投各自尚未 Ack 的消息。这不是 Partition Rebalance，因为任何 Partition 从一开始都没有独占分配给某个 Worker。

### 4.4 Pulsar Key_Shared：每个 Partition 内再按 Key Hash Range 分配

Key_Shared 与 Shared 的分区连接结构相同，但第三步不再随意选择有 Permit 的 Worker，而是由每个 Partition 的 Dispatcher 按 Key Hash Range 选择内部 Consumer：

```text
第一次 Hash：Producer
order-1001 → P2

第二次 Hash：P2 Key_Shared Dispatcher
order-1001 → worker-B/P2 管理的 Hash Range

结果：order-1001 在 P2 中的后续消息仍交给 worker-B
```

默认 AUTO_SPLIT 在 Worker 增减时重新切分每个 Partition 的 Hash Range。要迁移的 Hash 若仍有 Unacked，会先进入 draining，等旧任务完成后再切给新 Worker，从而避免同一 Key 同时交给两个 Consumer。不同 Partition 各自维护 Range，没有跨分区的全局 Key 分配器。

Key_Shared 能保持正常投递路径中的同 Key 归属和顺序，但 Negative Ack、显式重投、故障恢复和分区扩容仍可能产生重复或顺序边界。业务处理必须幂等。

### 4.5 任务队列模式的共同点与差异

| 产品与模式 | 同一分片能否同时服务多个 Worker | 4P/3C 是否能形成分片内并行 | 谁选择具体消息的 Worker | Worker 增减 |
|---|---|---|---|---|
| RabbitMQ 4 Queue + Competing Consumers | 能 | 能 | 每条 Queue 的派发器 | 更新每条 Queue 的 Consumer 集合，无全局 Rebalance |
| Kafka Share Group | 能 | 能 | Share Assignment + Partition Leader/Share 状态 | Group 更新成员与可共同消费的 Partition |
| Pulsar Shared | 能 | 能 | 每个 Partition 的 Shared Dispatcher | 更新四个 Dispatcher 的候选集合 |
| Pulsar Key_Shared | 能，但同 Key 单 Consumer | 能 | 每个 Partition 的 Key Hash Range | 每个 Partition 独立调整并 drain Range |

这一组可以记成：

```text
任务并行的基本单位 = Record / Message，而不只是 Partition
同一个 Partition 中的不同任务可以同时交给不同 Worker
Worker 数可以超过 Partition 数并继续产生有效并行
代价是不能再把一个连续 Offset 当作所有任务都已顺序完成
```

## 5. 三个产品放在同一张分配图里

### 5.1 消息流：分区独占给 Active Consumer

```text
RabbitMQ Super Stream + SAC      Kafka Consumer Group       Pulsar Failover

P0 → A Active                   P0 → A                     P0 → A Active
P1 → B Active                   P1 → B                     P1 → B Active
P2 → C Active                   P2 → C                     P2 → C Active
P3 → A Active                   P3 → A                     P3 → A Active

B/C 是 P0 的 Standby            其他 Consumer 不读 P0      B/C 是 P0 的 Standby
```

从结果看三者很像：4P/3C 时是 `2 + 1 + 1`。区别在于 RabbitMQ/Pulsar 还显式存在分区级 Standby Subscription，而 Kafka Consumer Group 的其他成员没有该 Partition 的当前读取权。

### 5.2 任务队列：分区或 Queue 内继续分消息

```text
RabbitMQ 4 Queue                Kafka Share Group           Pulsar Shared

q0 → {A,B,C}                   P0 → 多个 Share Consumer    P0 → {A,B,C}
q1 → {A,B,C}                   P1 → 多个 Share Consumer    P1 → {A,B,C}
q2 → {A,B,C}                   P2 → 多个 Share Consumer    P2 → {A,B,C}
q3 → {A,B,C}                   P3 → 多个 Share Consumer    P3 → {A,B,C}

Queue Push + Ack                Fetch + Acquisition Lock    Dispatcher Push + Permit/Ack
```

Kafka Share Group 的具体 Partition 到成员关系由 Share Assignor 决定，未必像两侧一样形成固定 4×3 内部连接；但它允许一个 Partition 同时被多个成员协作消费，所以三者都能实现“分区内部的逐条任务竞争”。

## 6. Consumer 加减时到底 Rebalance 什么

| 场景 | 新 Consumer 加入 | Consumer 故障 | 是否重新分配整个 Partition |
|---|---|---|---|
| RabbitMQ Super Stream + SAC | 作为各分区 Active/Standby 候选 | 受影响分区选择新 Active | 是，切换分区 Active |
| Kafka Consumer Group | 触发 Group Rebalance | 触发 Group Rebalance | 是，Partition 在成员间转移 |
| Pulsar Failover | 加入每个分区的排序与 Standby 集合 | 受影响分区切换 Active | 是，切换分区 Active |
| RabbitMQ Queue | 加入所订阅 Queue 的竞争集合 | 未 Ack 消息重新入队 | 否，只更新候选 Consumer |
| Kafka Share Group | 更新成员和共享 Partition Assignment | Acquisition 超时或恢复后可重投 | Partition 可由多人共享，不是独占转移 |
| Pulsar Shared | 加入各 Partition Dispatcher | 各 Partition 重投 Unacked | 否，只更新候选 Consumer |
| Pulsar Key_Shared | 各 Partition 切分 Hash Range | Range 改派并重投 Unacked | 否，调整的是 Key Range |

所以听到“Rebalance”时不要立刻想到同一种行为，而要继续问：

```text
重新分配的是 Partition Active Owner？
还是允许读取 Partition 的成员集合？
还是 Partition 内的 Key Hash Range？
还是只把未 Ack 的单条任务重新投递？
```

## 7. 从单分区迁移到四分区时怎样理解

### 7.1 消息流模式

| 产品 | 1 Partition + 3 Consumer | 4 Partition + 3 Consumer |
|---|---|---|
| RabbitMQ Stream + SAC | 1 Active + 2 Standby | 4 个分区 Active 分散为 2+1+1 |
| Kafka Consumer Group | 1 工作 + 2 空闲 | 3 个都工作，分配为 2+1+1 |
| Pulsar Failover | 1 Active + 2 Standby | 4 个分区 Active 分散为 2+1+1 |

增加 Partition 的直接效果是增加分区级读取并行度。Consumer 数超过 Partition 数时，不会让同一分区继续并行处理。

### 7.2 任务队列模式

| 产品 | 1 分片 + 3 Worker | 4 分片 + 3 Worker |
|---|---|---|
| RabbitMQ Queue | 3 人已能竞争同一 Queue | 3 人再分别竞争 4 条 Queue |
| Kafka Share Group | 3 人可共同处理同一 Partition | 3 人可共同处理 4 个 Partition |
| Pulsar Shared | 1 个 Dispatcher 向 3 人派发 | 4 个 Dispatcher 分别向 3 人派发 |
| Pulsar Key_Shared | 1 个 Partition 内按 Key Range 分 3 人 | 4 个 Partition 各自按 Key Range 分 3 人 |

增加 Partition 的主要效果是分散 Broker/Leader/Dispatcher 的存储和派发压力，而不是解除 Worker 并行限制；这些任务模型在单 Partition 时已经允许多个 Worker 并行。

## 8. 最短记忆法

```text
RabbitMQ
  Exchange 先选 Queue；Queue 再选 Worker
  普通 Queue 没有原生 Partition，四分片要建四条 Queue
  Super Stream + SAC 才接近“分区分给 Consumer”

Kafka
  普通 Consumer Group：Partition 分给一个 Consumer
  Share Group：Partition 可以给多个 Consumer，Record 再逐条获取

Pulsar
  Failover：每个 Partition 选一个 Active Consumer
  Shared：每个 Partition 的 Dispatcher 把消息分给多个 Consumer
  Key_Shared：每个 Partition 再按 Key Hash Range 选择 Consumer
```

最后只保留一句判断标准：**先看 Partition 是否独占给 Consumer；独占就是分区级并行，不独占才是分区内的任务级并行。**

## 9. 关联文章

- [Kafka（一）：架构、分区与 Consumer Group](011_kafka.md)
- [Kafka（三）：Share Group 任务队列模型](013_kafka_task_queue.md)
- [RabbitMQ（一）：Queue、Stream 与客户端路径](021_rabbitmq.md)
- [RabbitMQ（三）：Stream 分区、复制、Offset 与故障恢复](023_rabbitmq_stream_implementation.md)
- [Pulsar（一）：架构、Partition 与 Subscription](031_pulsar.md)
- [Pulsar（三）：任务队列、Ack 与故障恢复](033_pulsar_task_queue_implementation.md)

## 10. 参考资料

- [RabbitMQ Consumers](https://www.rabbitmq.com/docs/consumers)
- [RabbitMQ Streams and Super Streams](https://www.rabbitmq.com/docs/streams)
- [RabbitMQ Stream Single Active Consumer](https://www.rabbitmq.com/blog/2022/07/05/rabbitmq-3-11-feature-preview-single-active-consumer-for-streams)
- [Apache Kafka 4.3 Design：Consumer 与 Share Consumer](https://kafka.apache.org/43/design/design/)
- [KIP-932：Queues for Kafka](https://cwiki.apache.org/confluence/display/KAFKA/KIP-932%3A+Queues+for+Kafka)
- [Apache Pulsar 4.2 Messaging：Subscription Types 与 Partitioned Topics](https://pulsar.apache.org/docs/4.2.x/concepts-messaging/)
- [Pulsar Java Client：MultiTopicsConsumerImpl](https://github.com/apache/pulsar/blob/branch-4.2/pulsar-client/src/main/java/org/apache/pulsar/client/impl/MultiTopicsConsumerImpl.java)
