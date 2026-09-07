---
weight: 4
title: "RocketMQ：业务消息、顺序语义与主从切换"
date: 2026-09-06T11:00:00+08:00
lastmod: 2026-09-07T16:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "从核心抽象出发，理解 RocketMQ 5 的分区、顺序、复制确认、消费重试、事务消息与故障恢复"
featuredImage:

tags: ["message-queue", "rocketmq"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

RocketMQ 的核心不是“一个支持很多高级功能的队列”，而是围绕业务事件提供 **MessageQueue 分片、MessageGroup 顺序、消费重试、事务消息和延时消息**。选型时最容易忽略的是：这些能力不共享同一个可靠性边界；消息何时返回成功，取决于刷盘、主从复制和同步副本集合的具体配置。

<!-- more -->

## 1. RocketMQ 解决什么问题

RocketMQ 更接近“面向业务事件的分布式消息系统”，典型场景包括：

- 订单创建后异步驱动库存、积分和通知；
- 同一订单或账户内的事件必须按顺序处理；
- 本地数据库事务成功后，消息最终必须可见；
- 消息在指定时间之后再投递；
- 消费失败后自动重试，超过上限进入死信队列。

它既不是复杂 AMQP 路由器，也不是以超长历史回放和流计算生态为第一目标的事件日志。选型的核心问题不是“RocketMQ 有没有这个功能”，而是它提供的抽象是否正好对应业务边界。

## 2. 完整生产架构

```mermaid
flowchart TB
    subgraph Client[客户端层]
        P[Producer]
        CG[Consumer Group\nPush / Simple / Pull Consumer]
    end

    subgraph Access[接入层]
        PX[Proxy 集群\n协议接入、路由、流量治理]
    end

    subgraph Route[路由发现]
        NS1[NameServer 1\n完整路由副本]
        NS2[NameServer 2\n完整路由副本]
        NS3[NameServer 3\n完整路由副本]
    end

    subgraph Data[数据面：多个 Broker Group]
        subgraph G1[Broker Group A]
            A[Master A\nCommitLog / ConsumeQueue / IndexFile]
            AS[Slave A\nCommitLog / ConsumeQueue / IndexFile]
            A -->|消息复制| AS
        end
        subgraph G2[Broker Group B]
            B[Master B\nCommitLog / ConsumeQueue / IndexFile]
            BS[Slave B\nCommitLog / ConsumeQueue / IndexFile]
            B -->|消息复制| BS
        end
        Q[Topic\nMessageQueue 0..N]
        CS[消费状态\n位点 / 重试 / 死信]
        Q --- A
        Q --- B
        CS --- A
        CS --- B
    end

    subgraph Control[控制面：Controller Quorum]
        C1[Active Controller]
        C2[Controller]
        C3[Controller]
        C1 <-->|DLedger / Raft| C2
        C1 <-->|DLedger / Raft| C3
    end

    P --> PX
    CG --> PX
    PX -->|Send / Receive / Ack| A
    PX -->|Send / Receive / Ack| B
    PX -.查询 Topic 路由.-> NS1
    PX -.查询 Topic 路由.-> NS2
    A -.注册路由.-> NS1
    A -.注册路由.-> NS2
    B -.注册路由.-> NS2
    B -.注册路由.-> NS3
    C1 -.Master / Epoch / SyncStateSet.-> A
    C1 -.Master / Epoch / SyncStateSet.-> B
```

图中先展示完整部署关系。下面以顺序消息 **order-42 created** 为例，只说明一次生产和消费分别经过哪些组件。

### 生产消息的过程

1. Producer 通过 Proxy 接入，并从 NameServer 获得 **order-events** Topic 的 Broker 路由。
2. MessageGroup **order-42** 使同一订单稳定进入同一 MessageQueue。
3. Broker Master 把消息追加到 CommitLog，并按配置刷盘、复制给 Slave。
4. 达到当前刷盘和复制条件后，Broker 向 Producer 返回发送成功。

NameServer 只负责找路由，Controller 只在选主等控制过程参与，它们都不保存这条业务消息。

### 消费消息的过程

1. **inventory-group** 的一个 Consumer 从目标 MessageQueue 获取消息。
2. Broker 通过 ConsumeQueue 找到 CommitLog 中的消息正文并投递。
3. Consumer 完成库存事务后返回 ACK。
4. 成功则推进消费进度；失败或超时则进入重试，超过限制后进入死信队列。

发送成功与消费成功是两个时间点；具体刷盘、复制和 ACK 语义在后文解释。

各组件只解决自己的问题：

| 组件 | 核心职责 | 不负责什么 |
|---|---|---|
| Proxy | 承接 RocketMQ 5 客户端访问，可与 Broker 同进程或独立部署 | 不保存最终消息历史 |
| NameServer | 保存 Topic 到 Broker 的路由，使客户端找到数据 | 不复制业务消息，也不决定哪条消息已提交 |
| Broker | 接收、保存、复制和投递消息，维护消费相关状态 | 单个 Broker 不能独自解决自动选主 |
| Controller | 通过多数派维护 Master、Epoch、SyncStateSet 等选主元数据 | Raft 日志不包含业务消息 |
| MessageQueue | Topic 内的逻辑分片，是存储顺序和并行消费的基本边界 | 不等于一个 Broker 进程 |

NameServer 节点彼此独立，每个节点接受 Broker 注册并保存完整路由；Controller 则需要多数派维护一致的选主状态。这是两种完全不同的高可用机制。

## 3. 核心抽象与它们提供的语义

### 3.1 Topic：消息类型和治理边界

Topic 是消息的逻辑分类，例如 `order-events`。RocketMQ 5 的 Topic 会指定一种消息类型：普通、顺序、延时或事务消息。这个约束意味着消息类型应当在建模阶段确定，不应把所有不同语义的消息塞进同一个 Topic。

Topic 还承载权限、保留、队列数量等治理配置，但它本身不是顺序边界。

### 3.2 MessageQueue：分片、顺序和并行度边界

一个 Topic 由多个 MessageQueue 组成。MessageQueue 类似分片：

- 每条消息最终只追加到其中一个 MessageQueue；
- 同一个 MessageQueue 内有明确的存储顺序；
- 多个 MessageQueue 可以分布在不同 Broker Group 上并行读写；
- 队列数量限制了可并行处理的上限之一。

因此，**副本用于容错，MessageQueue 用于横向扩展**。增加 Slave 不会提高分片并行度，增加 MessageQueue 也不会自动提高单条消息的副本安全性。

RocketMQ 5 将逻辑队列名与物理 Broker 解耦。应用应使用 Topic、MessageGroup 等业务抽象，不要依赖或拼装具体物理队列名。

### 3.3 MessageGroup：业务顺序边界

顺序消息用 MessageGroup 表示哪些消息必须有序。例如以 `order_id` 为 MessageGroup，同一订单的创建、支付、发货事件会进入同一顺序通道。

它提供的是“同组有序”，不是整个 Topic 全局有序。全局有序等价于把所有流量压到一个顺序通道，会牺牲吞吐和故障隔离。

### 3.4 ConsumerGroup：一份独立消费进度

ConsumerGroup 表示一类业务订阅者：

- 不同消费组各自消费 Topic 的完整消息；
- 同组实例共同分担消息；
- 每组有独立位点、重试和死信状态；
- 同组实例应保持订阅表达式和消费语义一致。

例如库存组和通知组可以各自看到全部订单事件；库存组内部的多个实例只共同处理其中一份。

### 3.5 ACK：推进消费进度，不是删除消息文件

ACK 表示某个消费组已经成功处理消息，Broker 可以推进该组的消费进度。它不等于立即从 CommitLog 中物理删除该消息；消息文件仍按保留和磁盘清理策略删除。

由此得到两个语义：

- 消费成功与物理保留是两件事；
- 能否回放取决于历史是否仍在，而不只是是否 ACK 过。

## 4. 消息如何存储

```mermaid
flowchart LR
    M1[Topic A / Queue 0 的消息] --> CL[CommitLog\n不同 Topic、Queue 混合顺序追加]
    M2[Topic B / Queue 3 的消息] --> CL
    CL --> CQ[ConsumeQueue\n按 Topic + Queue 建立逻辑索引]
    CL --> IF[IndexFile\n按 Key 查询索引]
    CQ --> C[Consumer 按队列位点读取]
```

- **CommitLog** 保存消息正文，顺序追加以提高写入效率；
- **ConsumeQueue** 保存某个 Topic/MessageQueue 到 CommitLog 的轻量索引；
- **IndexFile** 支持按消息 Key 查询，不能替代业务数据库索引。

消息是按本地文件和磁盘水位清理的。声明“保留七天”不代表磁盘压力下绝对可以读取七天；容量设计要同时考虑写入速率、消息大小、积压时间和安全余量。

大消息会同时放大网络、复制、刷盘、重试和积压成本。通常应把大对象放入对象存储，消息只携带地址、摘要和业务元数据。

## 5. Producer 何时可以认为消息成功

一次发送至少经过两条彼此独立的可靠性链：

1. **刷盘**：消息只到内存/页缓存，还是已经同步写入 Master 的持久介质；
2. **复制**：消息只在 Master，还是已到达足够多的 Slave。

这两个维度不能混为一谈：同步刷盘只保护 Master 本机，不能抵抗整台机器永久损坏；同步复制增加其他节点上的副本，但不天然表示每个 Slave 都完成了物理刷盘。

| 选择 | 返回成功的核心条件 | 主要风险 |
|---|---|---|
| 异步刷盘 + 异步复制 | Master 接受消息后即可较早返回 | 掉电和主机永久故障都可能丢已确认消息 |
| 同步刷盘 + 异步复制 | Master 本地持久化后返回 | Master 永久损坏且 Slave 未追上时仍可能丢失 |
| 异步刷盘 + 同步复制 | 消息到达规定数量同步副本后返回 | 多节点同时掉电仍有页缓存风险 |
| 同步刷盘 + 同步复制 | Master 持久化且规定数量副本收到后返回 | 延迟更高，副本不足时可能拒写 |

所以 `SEND_OK` 的准确含义只能是：**Broker 已满足当前配置定义的成功条件**，不能脱离配置解释成“所有副本都已落盘”。

## 6. 多副本如何保持一致

### 6.1 三种容易混淆的高可用模型

1. **传统 Master-Slave**：Master 写入 CommitLog，Slave 追随复制；同步或异步决定发送确认点，但固定角色本身不提供完整自动选主。
2. **Controller 自动切换**：仍使用 Broker 原生 CommitLog 主从复制；Controller 只通过共识确定合法 Master、任期和同步副本集合。
3. **DLedger CommitLog**：较早的另一种方案，用 Raft 替代原生 CommitLog 复制并选主；不要与 Controller 的“仅元数据 Raft”混成一种机制。

本文重点讨论 RocketMQ 5 的 Controller 模式。

### 6.2 Controller 到底保证了什么

Controller 通过 DLedger/Raft 维护：

- 当前哪个 Broker 是 Master；
- 当前 Master 的 Epoch（任期）；
- 哪些副本属于 SyncStateSet，可作为安全切换候选；
- SyncStateSet 的增减历史。

Epoch 用于隔离旧 Master。即使旧 Master 恢复并认为自己还能写，也不能绕过新任期继续形成另一条合法历史。

但是，Controller 的多数派只证明“选主元数据达成一致”，不证明某条业务消息已复制到多数 Broker。数据安全仍取决于 Broker 复制和发送确认配置。

### 6.3 SyncStateSet 和写入门槛

SyncStateSet 是当前被认为跟得上 Master 的副本集合。落后超过阈值的 Slave 会被移出，追平后才能重新加入。

关键配置表达的是一致性与可用性的取舍：

- `allAckInSyncStateSet=true`：消息到达当前 SyncStateSet 的所有成员后才返回成功；
- 否则由 `inSyncReplicas` 决定一次成功需要多少个同步副本确认；
- `minInSyncReplicas` 约束 SyncStateSet 至少保留多少成员才继续安全写入；
- `enableElectUncleanMaster=false`：不从 SyncStateSet 外选择落后副本，以避免让已确认历史倒退。

“所有同步副本”是一个动态集合，不等于最初部署的全部副本。如果 SyncStateSet 缩到 1 且最小门槛也允许 1，系统仍可能单副本返回成功。配置副本数、当前同步副本数和本次 ACK 数必须分别监控。

## 7. 一条消息从发送到返回的完整过程

假设 Broker A 是 Master，B、C 是 Slave，当前 `SyncStateSet={A,B,C}`，要求所有同步成员确认：

```mermaid
sequenceDiagram
    autonumber
    participant P as Producer
    participant A as Master A
    participant D as A 的磁盘
    participant B as Slave B
    participant C as Slave C
    participant CT as Controller

    Note over CT,A: Controller 已确定 A 的 Epoch 和 SyncStateSet={A,B,C}
    P->>A: Send(M, business_event_id)
    A->>A: 校验当前 Master / Epoch，追加 CommitLog
    A->>D: 按 flushDiskType 刷盘
    A->>B: 复制 M
    A->>C: 复制 M
    B-->>A: 已复制到目标位点
    C-->>A: 已复制到目标位点
    A->>A: 刷盘条件 + 副本 ACK 条件均满足
    A-->>P: SEND_OK
```

这条时间线给出最重要的判断：

- 消息仅被 A 接收，不等于成功；
- 消息追加到 A，也不等于已经具备故障切换安全性；
- 是否需要等 B、C，以及需要等几个，由复制配置决定；
- 是否需要等本地磁盘，由刷盘配置决定；
- Producer 收到成功，只证明这些配置条件在当时已经满足。

## 8. 临界故障场景

仍假设 A 是 Master，B 是 Slave，消息为 M。

### 8.1 M 尚未复制，A 就故障

```mermaid
sequenceDiagram
    participant P as Producer
    participant A as Master A
    participant B as Slave B
    participant CT as Controller

    P->>A: Send(M)
    A->>A: 本地追加 M
    Note over A,B: M 尚未到达 B
    alt 异步复制
        A-->>P: 可能已经 SEND_OK
    else 同步复制
        A--xP: 尚未返回成功
    end
    A--xA: A 故障
    CT->>B: 提升 B，增加 Epoch
    Note over B: B 没有 M
```

- **异步复制**：A 可能已返回成功；如果 A 永久损坏，B 成为 Master 后没有 M，出现“已确认但丢失”。
- **同步复制**：A 不应在满足副本条件前返回普通成功。Producer 收到超时或失败，但无法仅凭超时判断 M 一定不存在。

Producer 对未知结果应使用同一个业务事件 ID 重试；Consumer 必须幂等。网络协议无法同时消除“响应可能丢失”和“绝不重复”。

### 8.2 B 已复制 M，但成功响应在路上丢失

```mermaid
sequenceDiagram
    participant P as Producer
    participant A as Master A
    participant B as Slave B
    participant CT as Controller

    P->>A: Send(M, event_id=E1)
    A->>B: 复制 M
    B-->>A: ACK
    A--xP: SEND_OK 在返回途中丢失
    A--xA: A 故障
    CT->>B: B 成为新 Master
    P->>B: 用 E1 重试 M
    Note over B: M 可能被再次写入
```

此时服务端可能已经安全保存 M，但 Producer 只能看到超时。重试可能制造重复，因此：

- Producer 使用稳定业务事件 ID，而不是每次重试生成新 ID；
- Consumer 以事件 ID、订单号和状态迁移规则做幂等；
- `msgId` 用于追踪，不应被当成端到端业务幂等保证。

### 8.3 同步副本落后并被移出

Master 不能仅凭本地判断悄悄缩小同步集合。它应请求 Controller 更新 SyncStateSet，只有新集合经 Controller 多数派提交后，Master 才能按新集合判断后续写入。

```mermaid
sequenceDiagram
    participant A as Master A
    participant B as Slave B
    participant CT as Controller Quorum
    participant P as Producer

    Note over A,B: SyncStateSet={A,B}，B 持续落后
    A->>CT: 请求移除 B
    CT->>CT: 多数派提交 SyncStateSet={A}
    CT-->>A: 新集合与新状态生效
    P->>A: 发送下一条消息
    alt minInSyncReplicas 允许 1
        A-->>P: 可按单同步副本条件成功
    else 最小同步副本要求 2
        A-->>P: 拒绝安全写入
    end
```

这就是一致性与可用性的核心选择：副本不足时继续服务，会扩大数据丢失窗口；停止写入，则牺牲可用性来保护已承诺的可靠性。

### 8.4 旧 Master 恢复后，独有消息如何处理

假设 A 故障前有一段只存在于本机、没有进入新 Master 有效历史的尾部消息。A 恢复时不能把这些消息自行重新发布，否则客户端可能在新历史运行一段时间后突然看到旧消息“复活”。

正确原则是：

1. A 读取 Controller 的当前角色和 Epoch，以 Slave 身份加入；
2. 以当前 Master 的有效 CommitLog 为准定位共同点；
3. 截断冲突或无效尾部；
4. 从当前 Master 补齐缺失数据；
5. 达到同步标准后，才重新进入 SyncStateSet。

这不是在判断旧消息“业务上还有没有价值”，而是在维护单一合法历史。若需要挽救未确认消息，应走审计和业务补偿流程，不能让旧节点私自合并日志。

## 9. 如何分区并保证顺序

### 9.1 普通消息的分区

普通消息可以由客户端在多个 MessageQueue 间负载均衡，也可以按业务 Key 选择稳定队列。更多 MessageQueue 提高并行度，但会增加路由、调度和运维成本。

简单的 `hash(key) % queue_count` 在队列数变化后会大规模重新映射。严格顺序业务应优先使用 MessageGroup，并在扩缩容时控制旧流量排空和新路由启用的边界。

### 9.2 FIFO 消息的完整顺序条件

Broker 只能保证它实际观察到的顺序。完整业务顺序必须同时满足：

1. 同一业务实体始终使用同一个 MessageGroup，如 `order_id`；
2. 同一 MessageGroup 的发送调用本身有确定先后，通常由单一生产者或串行发送建立；
3. 消费端对同组消息执行 `receive → process → ack`，不把同组任务异步并行化；
4. 前一条失败时不让后一条越过，或明确接受跳过后的乱序；
5. 业务事件携带版本号，防御多生产者和外部系统造成的因果倒序。

```mermaid
flowchart LR
    O1[订单 A：创建] -->|MessageGroup=A| QA[顺序通道 A]
    O2[订单 A：支付] -->|MessageGroup=A| QA
    O3[订单 A：发货] -->|MessageGroup=A| QA
    B1[订单 B：创建] -->|MessageGroup=B| QB[顺序通道 B]
    QA --> CA[同组串行消费]
    QB --> CB[可与 A 并行消费]
```

顺序的代价是阻塞：一条毒消息若必须保持严格顺序，会阻塞同组后续消息。团队必须在“等待修复”和“进入死信后继续”之间明确选择；不能同时承诺无限重试、绝不乱序和持续可用。

## 10. 消费、位点与至少一次

RocketMQ 5 常见消费方式：

| 类型 | 核心方式 | 主要注意点 |
|---|---|---|
| PushConsumer | SDK 控制拉取并调用监听器 | 监听器应在业务真正完成后同步返回结果，不要先异步转交再假装成功 |
| SimpleConsumer | 应用显式 Receive、处理和 Ack | `InvisibleDuration` 太短会并发重复，太长会拖慢故障重投 |
| PullConsumer | 应用按队列和位点主动拉取 | 控制力强，但位点、负载均衡和并发治理责任更多 |

PushConsumer 和 SimpleConsumer 默认更偏向服务端按消息负载均衡；PullConsumer 更适合需要按队列掌控位点的框架或高级场景。

可靠消费的基本时间线是：

```text
收到消息 → 执行业务事务 → 业务事务提交 → ACK
```

若业务提交后、ACK 前进程崩溃，消息会再次投递，因此默认思维应是“至少一次 + 业务幂等”。若先 ACK 再执行业务，进程崩溃则可能永久丢失业务处理机会。

常见幂等方式：

- 事件 ID 唯一键；
- Inbox/消费记录表与业务修改放入同一本地事务；
- 用订单状态机拒绝非法重复迁移；
- 调用下游时继续传递同一个幂等键。

## 11. 重试与死信

重试和死信以 ConsumerGroup 为边界。同一条业务消息可以在库存组成功、在通知组重试，二者互不代表。

重试策略需要回答：

- 哪些异常可重试，哪些是永久业务错误；
- 退避间隔和最大次数是多少；
- 进入死信后由谁告警、修复和重新驱动；
- 顺序消息进入死信后，是否允许后续消息继续；
- 重放是否仍使用原业务事件 ID。

无限重试不是更可靠，它可能把下游故障放大成重试风暴，并长期阻塞顺序通道。

## 12. 事务消息的边界

事务消息解决的是“本地事务已经提交，但普通发送失败”这一类原子性缺口：

```mermaid
sequenceDiagram
    participant P as Producer
    participant B as Broker
    participant DB as Business DB

    P->>B: 发送半消息
    B-->>P: 半消息已保存但消费者不可见
    P->>DB: 执行本地事务
    alt 本地事务成功
        P->>B: Commit
        B->>B: 消息变为可见
    else 本地事务失败
        P->>B: Rollback
        B->>B: 删除或终止半消息
    else 二阶段结果丢失
        B->>P: 回查本地事务状态
        P-->>B: 根据持久化事实返回 Commit / Rollback / Unknown
    end
```

回查必须依据数据库中的持久化事实，不能依赖 Producer 进程内存。事务消息只保证本地事务与消息可见性的最终一致，不保证 Consumer 的数据库修改与消息消费形成跨系统 ACID，也不能免除消费幂等。

若团队更熟悉数据库模式，也可以使用 Transactional Outbox：业务数据和 Outbox 记录在同一本地事务提交，再由后台任务可靠发布。

## 13. 延时消息与过滤

### 13.1 延时消息

延时消息表示“到某个时间之后才有资格投递”，适合订单超时检查、延迟通知等场景。它不是精确定时器：Broker 重启、负载、积压和同一时刻的大量消息都可能使实际投递晚于目标时间。

因此延时消费者必须重新检查业务状态。例如“30 分钟未支付则关单”的消息到达时，仍要查询订单是否已支付，而不能无条件关单。

### 13.2 消息过滤

RocketMQ 可以用 Tag 或基于属性的 SQL 表达式过滤。过滤用于减少无关消息传输，不应承载过度复杂且频繁变化的业务规则。同一 ConsumerGroup 的订阅和过滤表达式必须一致，否则同组实例对“应消费哪些消息”的理解不同。

## 14. 积压、扩容与热点

容量至少要按下面的关系估算：

```text
积压容量 ≈ 峰值写入字节/秒 × 最长不可消费时间 × 安全系数
恢复条件：恢复期消费速度 > 恢复期生产速度
```

扩容时增加 Broker Group 并让 Topic 使用更多 MessageQueue，但需要注意：

- 新 Broker 不会自动消除已有热点 Key；
- 增加队列后，客户端路由变化可能使业务 Key 漂移；
- 单个热点 MessageGroup 仍受单顺序通道处理能力限制；
- 缩容前要停止向目标队列写入，并处理剩余积压和消费进度；
- 扩容副本提高可用性，扩容分片提高吞吐，两者目标不同。

真正的限流位置也必须明确：Producer、Proxy、Broker 磁盘或 Consumer 任一环节过载，都可能表现成发送延迟。只看集群平均吞吐会掩盖单队列和单磁盘热点。

## 15. Schema、安全与多租户

RocketMQ 不会替业务自动解决消息契约演进。每条消息应有：

- 明确的事件名和版本；
- 稳定业务事件 ID；
- 发生时间和必要的因果版本；
- 向前、向后兼容规则；
- 无法反序列化时的隔离与补偿路径。

安全上至少要覆盖 TLS、身份认证、Topic/ConsumerGroup 授权、凭证轮换和审计。Dashboard、NameServer、Broker、Proxy 和 Controller 的管理端口不应直接暴露到公网。

共享集群还要限制单租户的 Topic 数、队列数、带宽、存储和重试流量。逻辑权限隔离不等于资源隔离，一个租户的热点和重试风暴仍可能影响其他租户。

## 16. 运维时真正要观察什么

仅观察进程存活和集群总 TPS 不够。至少需要监控：

- Producer 成功率、状态码、超时、重试和 P99 延迟；
- 每个 Topic/MessageQueue 的写入、读取、积压和最老消息年龄；
- ConsumerGroup 位点、处理耗时、重试和死信增长；
- Broker 磁盘水位、CommitLog 写入和刷盘延迟；
- Master-Slave 复制差距和 Slave 追赶时间；
- SyncStateSet 当前成员、实际 ACK 数和缩容事件；
- Controller 多数派、Master Epoch 和选主次数；
- NameServer 路由注册、Proxy 路由刷新和访问错误。

Controller 故障不一定立即中断已有 Master 的发送和消费，但会削弱故障后的自动选主能力。因此“当前业务还能发”不等于集群仍具备高可用。

升级和迁移前应验证 Broker 角色、CommitLog 对齐、Epoch 文件和 Controller 状态。旧主从模式迁移到 Controller 模式时，若日志未对齐或错误启动节点，可能触发截断并造成数据损失。

## 17. 跨地域容灾

把一个同步副本组直接跨远距离地域部署，会让每次同步发送承受跨地域网络延迟和抖动。更常见的方案是：

- 每个地域建立独立集群；
- 通过异步复制或业务桥接传递事件；
- 明确 RPO（最多允许丢多久的数据）和 RTO（多久恢复）；
- 设计消费位点迁移、重复范围和流量入口切换；
- 预先定义双边都曾写入时如何处理分叉历史。

跨地域异步复制不能承诺零 RPO；同步跨地域则会把远端可用性和网络延迟放进每次发送路径。这里没有免费的高可用。

## 18. 适用边界

RocketMQ 适合：

- 订单、支付、库存等以业务 Key 为顺序边界的事件；
- 需要事务消息、延时消息、消费重试和死信的业务系统；
- 团队愿意明确管理 MessageQueue、Broker Group、Controller 和幂等语义；
- 需要较高吞吐，但不以复杂 AMQP 路由或无限历史流处理为中心。

需要谨慎评估：

- 大量动态短生命周期队列和复杂路由规则；
- 把超长历史、多次任意回放和流处理生态作为第一目标；
- 无法承担 Controller、Broker 复制和客户端版本治理的团队；
- 要求同步跨地域且同时追求极低延迟和持续可写的系统。

## 19. 最小选型检查表

1. Topic 中承载普通、顺序、延时还是事务消息？
2. 业务顺序边界是订单、账户还是全局？MessageGroup 如何生成？
3. MessageQueue 数量如何覆盖峰值并行度？热点 Key 怎么处理？
4. `SEND_OK` 要求本地刷盘、几个副本确认？
5. SyncStateSet 缩小时最低允许几个副本，副本不足要停写还是降级？
6. 是否禁止从同步集合外选主？旧 Master 恢复如何截断和追赶？
7. Producer 超时如何使用稳定事件 ID 重试？Consumer 如何幂等？
8. 顺序消息失败时，是阻塞、死信还是跳过？
9. 最大积压量、最老消息年龄和磁盘清理边界是多少？
10. 单机、可用区、地域故障下的 RPO/RTO 分别是多少？
11. 谁负责死信修复、消息重放、Schema 演进和故障演练？
12. 监控能否区分路由、控制面、数据复制和消费端故障？

## 20. 参考资料

- [RocketMQ Domain Model](https://rocketmq.apache.org/docs/domainModel/01main/)
- [RocketMQ Topic](https://rocketmq.apache.org/docs/domainModel/02topic/)
- [RocketMQ MessageQueue](https://rocketmq.apache.org/docs/domainModel/04messagequeue/)
- [RocketMQ Message](https://rocketmq.apache.org/docs/domainModel/05message/)
- [RocketMQ ConsumerGroup](https://rocketmq.apache.org/docs/domainModel/08consumergroup/)
- [RocketMQ Master-Slave Automatic Failover](https://rocketmq.apache.org/docs/deploymentOperations/03autofailover/)
- [RocketMQ Controller Deployment and Design](https://github.com/apache/rocketmq/blob/develop/docs/en/controller/deploy.md)
- [RocketMQ FIFO Message](https://rocketmq.apache.org/docs/featureBehavior/03fifomessage/)
- [RocketMQ Transaction Message](https://rocketmq.apache.org/docs/featureBehavior/04transactionmessage/)
- [RocketMQ Consumer Type](https://rocketmq.apache.org/docs/featureBehavior/06consumertype/)
- [RocketMQ Consumer Load Balancing](https://rocketmq.apache.org/docs/featureBehavior/08consumerloadbalance/)
- [RocketMQ Consumer Progress](https://rocketmq.apache.org/docs/featureBehavior/09consumerprogress/)
- [RocketMQ Consumer Retry Policy](https://rocketmq.apache.org/docs/featureBehavior/10consumerretrypolicy/)
- [RocketMQ Message Storage and Cleanup](https://rocketmq.apache.org/docs/featureBehavior/11messagestorepolicy/)
- [RocketMQ Metrics](https://rocketmq.apache.org/docs/observability/01metrics/)
- [RocketMQ Security](https://rocketmq.apache.org/docs/security/01security/)
