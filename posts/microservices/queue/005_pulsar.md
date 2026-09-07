---
weight: 5
title: "Apache Pulsar：存算分离、BookKeeper Quorum 与订阅语义"
date: 2026-09-06T12:00:00+08:00
lastmod: 2026-09-07T18:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "从核心抽象出发，理解 Pulsar 的分区、订阅、BookKeeper 多副本、确认时点、故障恢复与长积压能力"
featuredImage:

tags: ["message-queue", "pulsar"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

Pulsar 最鲜明的特点是 **服务层和存储层分离**：Broker 负责连接、Topic 所有权和消息投递，BookKeeper 负责持久化消息。Broker 扩容或切换时不需要搬迁历史数据，但代价是系统多了一套独立存储集群和元数据控制面。

<!-- more -->

本文以当前生产稳定的 Pulsar 4.2.x 架构为基线。选型时最重要的不是记住组件名称，而是理解三条边界：谁是 Topic 的唯一写入者、消息达到几个持久副本才返回成功、每个 Subscription 的 Cursor 如何决定积压和回放。

## 1. Pulsar 解决什么问题

Pulsar 同时提供消息队列和事件流能力，典型优势是：

- Broker 与存储分别扩缩容；
- 一个集群承载大量 Tenant、Namespace 和 Topic；
- 每个 Topic 可以建立多份相互独立的 Subscription；
- 未确认消息形成持久积压，已确认消息也可以按策略继续保留；
- 旧 Ledger 可以下沉到对象存储，支持较长历史；
- 支持跨集群复制和多租户治理。

它不是“没有状态的简单 Broker”。Broker 不保存消息本体，但仍持有 Topic 会话、缓存、分发器和临时所有权；BookKeeper、元数据存储、AutoRecovery 中任何一层设计错误，都会影响整体可靠性。

## 2. 从一条消息看完整生产架构

先看订单事件 `order-42 created` 从生产到消费完成的过程：

```mermaid
flowchart LR
    P["1. Producer Lookup"] --> B["2. Owner Broker 接收"]
    B --> K["3. BookKeeper Client 写多个 Bookie"]
    K --> C["4. Broker 返回成功"]
    C --> D["5. Subscription 投递"]
    D --> A["6. 业务完成后 ACK"]
    A --> O["7. Cursor 推进"]
```

| 步骤 | 涉及组件 | 作用 |
|---|---|---|
| 1. 找到入口 | Producer、DNS/LB、可选 Proxy、Broker Lookup | 找到目标 Topic Partition 当前的 Owner Broker |
| 2. 接收消息 | Owner Broker、Topic Partition | Owner 是该分区此刻的服务入口和唯一写入协调者，但不保存最终消息副本 |
| 3. 持久化 | Broker 内的 BookKeeper Client、Managed Ledger、Bookies | Client 把消息封装成 Entry，按 Ledger Metadata 选择多个 Bookie 并统计 Ack Quorum |
| 4. 返回成功 | Bookie Journal、Ack Quorum、Broker | 足够 Bookie 完成持久化确认后，Broker 才向 Producer 返回成功 |
| 5. 投递消息 | Dispatcher、Subscription、Consumer | 每份 Subscription 拥有独立消费视图，Dispatcher 按订阅类型选择 Consumer |
| 6. 执行业务 | Consumer、业务数据库 | 真正完成库存扣减等业务副作用 |
| 7. 保存进度 | ACK、Managed Cursor | Broker 持久化该 Subscription 的确认位置，形成积压和恢复边界 |

假设 `orders-partition-1` 当前属于 Broker 2：

```text
Producer
  → Lookup 得到 Broker 2
  → Broker 2 的 BookKeeper Client
  → Bookie 1、2、3 写入 Entry
  → 达到 Ack Quorum
  → Producer 收到成功
  → inventory-subscription 的 Consumer 读取
  → 库存事务提交
  → ACK 推进 Managed Cursor
```

Broker ACK 只证明消息达到 BookKeeper 的确认条件，不表示库存业务完成。Consumer 的 ACK 才推进该 Subscription 的 Cursor；业务提交后、ACK 前崩溃会导致重复投递，因此仍需幂等。

Load Manager、Metadata Store 和 AutoRecovery 通常不逐条处理消息：Load Manager 决定 Namespace Bundle 由哪个 Broker 服务；Metadata Store 保存所有权和 Ledger 等元数据；AutoRecovery 在 Bookie 故障后修复欠副本 Fragment。

下面再展开完整组件图：

```mermaid
flowchart TB
    subgraph Client[客户端层]
        P[Producer]
        C[Consumer / Reader]
    end

    subgraph Access[接入与发现]
        LB[DNS / Load Balancer]
        PX[可选 Proxy 集群]
    end

    subgraph Serving[服务层：Broker 集群]
        B1[Broker 1\nTopic Owner / Cache / Dispatcher]
        B2[Broker 2\nTopic Owner / Cache / Dispatcher]
        B3[Broker 3\nTopic Owner / Cache / Dispatcher]
        BKC[BookKeeper Clients\n每个 Broker 进程内都有一个]
        BL[Load Manager\nNamespace Bundle 分配]
        TC[可选 Transaction Coordinator]
    end

    subgraph Storage[BookKeeper 的数据节点：Bookie 集群]
        K1[Bookie 1\n物理 Journal + Entry Log + Index]
        K2[Bookie 2\n物理 Journal + Entry Log + Index]
        K3[Bookie 3\n物理 Journal + Entry Log + Index]
        K4[Bookie 4\n物理 Journal + Entry Log + Index]
        ML[Managed Ledger\n逻辑对象：有序 Ledger ID 列表]
        CUR[Managed Cursor\nSubscription Ack / Position]
        ML --- K1
        ML --- K2
        ML --- K3
        ML --- K4
        CUR --- K1
        CUR --- K2
        CUR --- K3
    end

    subgraph Metadata[一致元数据存储]
        M1[Metadata Store 1]
        M2[Metadata Store 2]
        M3[Metadata Store 3]
        M1 <-->|Quorum| M2
        M1 <-->|Quorum| M3
    end

    subgraph Recovery[存储修复]
        AU[Auditor]
        RW[Replication Workers]
    end

    TS[可选 Tiered Storage\nS3 / GCS / OSS / Filesystem]
    RC[可选远端 Pulsar Cluster\nGeo-replication]

    P --> LB --> PX
    C --> LB
    PX --> B1
    PX --> B2
    LB --> B3
    B1 --> BKC
    B2 --> BKC
    B3 --> BKC
    BKC -->|计算 Write Set，向多个 Bookie 写 Entry| ML
    BKC -->|读写消费游标| CUR
    BL -.Bundle 所有权.-> M1
    B1 -.Topic / Ledger Metadata.-> M1
    B2 -.Topic / Ledger Metadata.-> M2
    K1 -.Bookie 注册.-> M2
    AU -->|发现欠副本 Ledger| M3
    RW -->|复制 Ledger Fragment| Storage
    ML -->|封闭 Segment 异步下沉| TS
    B3 -->|异步跨集群复制| RC
```

图中实线主要表示数据流，虚线表示控制或元数据流。首先要区分两个名字：

```text
BookKeeper = 完整的分布式日志存储系统
Bookie      = BookKeeper 系统中的一个存储节点进程
```

BookKeeper 不是一台名叫 “BookKeeper” 的服务器。对 Pulsar 来说，这套存储系统由几个部分共同组成：

```text
BookKeeper
  ├─ BookKeeper Client：嵌入每个 Pulsar Broker，执行 Ledger 协议
  ├─ Bookie 1..N：保存 Entry 的物理副本
  ├─ Ledger Metadata：保存在一致元数据存储中
  └─ AutoRecovery：检测并修复欠副本 Ledger Fragment
```

正常写入时，并不存在下面这条链路：

```text
Broker → 某个叫 BookKeeper 的中心服务 → Bookie
```

真实链路是：Owner Broker 内部的 BookKeeper Client 根据 Ledger Metadata 算出本条 Entry 应写到哪些 Bookie，然后直接并行请求这些 Bookie，最后统计是否达到 Ack Quorum。

各组件的职责边界如下：

| 组件 | 核心职责 | 不负责什么 |
|---|---|---|
| Proxy / Broker Lookup | 让客户端找到 Topic 当前所属 Broker | 不决定消息是否持久化成功 |
| Broker | Topic 单写者、协议接入、缓存和订阅投递 | 不保存最终消息副本，不是消息数据的主从节点 |
| BookKeeper | Ledger、Quorum 写入、读取与恢复组成的完整存储系统 | 不是一个节点名称，也不理解 Pulsar 的业务 Topic 路由 |
| BookKeeper Client | 嵌入 Broker，选择 Write Set、发送 Entry、统计 Ack Quorum | 本身不是持久副本 |
| Bookie | 保存 Ledger Entry 并提供持久化确认 | 不理解 Topic、ConsumerGroup 等业务概念 |
| Metadata Store | 保存所有权、Ledger、配置等一致元数据 | 不保存消息正文 |
| AutoRecovery | 检测并修复欠副本 Ledger Fragment | 不在 Producer 正常写入路径上决定 ACK |
| Tiered Storage | 保存封闭的冷 Ledger，降低长保留成本 | 不承接当前活跃 Ledger 的实时写入 |

生产部署通常需要多个 Broker、足够多且跨故障域放置的 Bookie，以及奇数节点的元数据存储。只部署多个 Broker 并不能形成消息副本；具体副本存在 BookKeeper 系统的多个 Bookie 上。

### 2.1 架构图里的 Ledger 是什么：它不是文件

最准确的一句话是：

```text
Ledger ≠ 物理文件

Ledger = Ledger ID
       + 从 0 递增的 Entry ID 空间
       + E / Qw / Qa
       + 每段 Entry 使用哪些 Bookie 的 Ensemble 元数据
       + OPEN / IN_RECOVERY / CLOSED 状态
```

Ledger 是 BookKeeper API 暴露的**逻辑追加日志对象**。应用看到它像一段连续日志，但 Bookie 不会为它创建一个同名、独占的 `ledger-100.log` 文件。

Fragment 也不是物理文件。它只是 Ledger Metadata 中的一条范围规则：从某个 Entry ID 开始，改用哪一组 Bookie。

Bookie 物理磁盘上主要是 Journal、Entry Log 和索引。各个 Ledger 的 Entry 会混合写入这些物理文件。

从业务抽象到物理文件的关系是：

```text
Pulsar Topic Partition
  ↓ 对应
Managed Ledger：该分区的完整逻辑历史
  ↓ 由多个组成
BookKeeper Ledger：有 Ledger ID 的一段逻辑追加日志
  ↓ 包含
Entry：带 Ledger ID + Entry ID 的实际记录
  ↓ 在每个目标 Bookie 上写入
Journal File：预写日志，先保证持久 ACK
Entry Log File：长期保存 Entry 内容
Index：从 Ledger ID + Entry ID 定位到 Entry Log 中的位置
```

一个 Bookie 的同一个 Entry Log 文件通常会混合保存许多 Ledger 的 Entry：

```text
Bookie 1 / entryLog-38.log
  ├─ Ledger 100 / Entry 598
  ├─ Ledger 203 / Entry 20
  ├─ Ledger 100 / Entry 599
  ├─ Ledger 102 / Entry 88
  └─ Ledger 200 / Entry 301
```

因此下面两种理解都是错误的：

```text
一个 Ledger = Bookie 上的一个 ledger 文件       ×
一个 Fragment = Bookie 上的一个 fragment 文件   ×
```

更准确的定义是：

- **Ledger**：由 `Ledger ID` 标识的一段逻辑追加日志，Entry ID 从 0 递增；
- **Fragment**：同一个 Ledger 内，连续使用同一组 Bookie 的 Entry 范围；
- **Journal File**：Bookie 的物理预写日志，可包含多个 Ledger 的写入；
- **Entry Log File**：Bookie 的物理数据文件，也可混合多个 Ledger 的 Entry；
- **Index**：解决混合保存后如何按 `(Ledger ID, Entry ID)` 找回数据。

例如 Ledger 100 的 Bookie 在 Entry 600 处发生替换：

```text
Ledger 100                         ← 一个逻辑 Ledger
  Fragment 1: Entry 0～599         ← Ensemble [B1, B2, B3]
  Fragment 2: Entry 600～999       ← Ensemble [B1, B2, B4]
```

这两个 Fragment 只是 Ledger Metadata 中的两个 Entry 范围。它们的实际 Entry 会散落在 B1、B2、B3、B4 各自的 Journal/Entry Log 文件里。

### 2.1.1 什么时候发生 Ledger 切换

这里的“Ledger 切换”是指 Pulsar Managed Ledger 不再向当前 Ledger 追加，而是关闭它并创建一个新 Ledger：

```text
Managed Ledger
  Ledger 100：CLOSED
  Ledger 102：OPEN，当前写入
```

主要触发场景是：

1. **正常滚动**：当前 Ledger 达到配置的 Entry 数、大小或滚动时间边界；
2. **Broker Owner 切换**：新 Owner 对旧 Ledger 执行 fencing 和 recovery，关闭旧 Ledger，再创建新 Ledger；
3. **Ledger 无法继续安全写入**：发生不可恢复写入错误、无法完成必要的元数据变更，Managed Ledger 关闭当前段并尝试建立新段；如果连新 Ledger 的 Quorum 也无法满足，则写入失败；
4. **管理操作或 Topic unload**：当前 Owner 释放 Topic，重新加载时需要恢复最后一个 Ledger，并根据状态继续或创建新 Ledger。

普通的单个 Bookie 故障并不必然触发 Ledger 切换。若 Writer 能把故障 Bookie 替换掉并成功更新 Ensemble，Ledger ID 可以保持不变，只从某个 Entry 开始形成新 Fragment：

```text
Bookie 成员变化：Ledger 100 / Fragment 1 → Fragment 2
Ledger 正常滚动：Ledger 100 → Ledger 102
```

### 2.1.2 物理文件什么时候切换

Bookie 的 Journal File 和 Entry Log File 也会因文件大小等条件自行滚动，但它与 Pulsar 的 Ledger 切换无关：

```text
Ledger 没变，物理 Entry Log 可能从 entryLog-38 滚到 entryLog-39
Ledger 从 100 切到 102，新 Entry 也可能仍写在当前 entryLog-39
```

所以必须分别观察三种变化：

| 发生了什么 | 改变的对象 | 是否产生新 Ledger |
|---|---|---|
| 只新增一个健康 Bookie 4 | 可供后续分配的 Bookie 集合 | 否，也不会产生新 Fragment |
| Bookie 3 故障并被 Bookie 4 替换 | Ensemble，形成新 Fragment | 不一定 |
| Managed Ledger 正常滚动或 Broker 接管 | 当前逻辑 Ledger | 是 |
| Bookie 本地 Journal/Entry Log 滚动 | 物理文件 | 否 |

只增加 Bookie 4 时，它先向 Metadata Store 注册为可用存储节点。已有 Ledger 的 Ensemble 不会为了“平均一点”自动改变，当前 Ledger 也不会因此生成 Fragment。Bookie 4 通常会在以下时机被使用：创建新 Ledger、替换故障 Bookie、修复欠副本数据，或者执行显式的数据迁移/下线流程。

Metadata Store 保存 Ledger ID、状态、Quorum 参数和各 Fragment 的 Ensemble；Bookie 磁盘保存 Entry 内容。Broker 读取这张逻辑目录后，才能定位物理副本。

### 2.2 示例：Order Topic 的 Metadata Store 中有什么

假设 `Order Topic` 有两个分区，每个分区的 Managed Ledger 都由两个 Ledger 组成，并且写入期间发生过 Bookie 切换：

```text
Order Topic
  ├─ partition-0 → Managed Ledger 0
  │    ├─ Ledger 100：已封闭
  │    └─ Ledger 102：当前写入
  └─ partition-1 → Managed Ledger 1
       ├─ Ledger 200：已封闭
       └─ Ledger 203：当前写入
```

下面使用便于理解的伪 YAML 展示 Metadata Store 中的逻辑信息。它不是实际存储路径或序列化格式，但字段之间的关系与真实架构一致。

#### 2.2.1 Topic 和 Broker 所有权

```yaml
topic: persistent://sales/order/order-events
partitioned-topic-metadata:
  partitions: 2

namespace-bundles:
  bundle-0x00000000_0x7fffffff:
    owner: broker-1
    contains:
      - order-events-partition-0
  bundle-0x80000000_0xffffffff:
    owner: broker-2
    contains:
      - order-events-partition-1
```

Pulsar 实际按 Namespace Bundle 分配 Broker 所有权，而不是为每个 Topic 保存一个永久 Broker。这里表示当前：

- `partition-0` 由 `broker-1` 服务；
- `partition-1` 由 `broker-2` 服务；
- Broker 故障或负载迁移后，`owner` 可以改变；
- 所有权改变不会搬迁下面的 Ledger 数据。

#### 2.2.2 两个 Managed Ledger 的 Ledger 列表

```yaml
managed-ledgers:
  order-events-partition-0:
    ledgers:
      - ledgerId: 100
        entries: 1000
        state: CLOSED
      - ledgerId: 102
        state: OPEN

  order-events-partition-1:
    ledgers:
      - ledgerId: 200
        entries: 800
        state: CLOSED
      - ledgerId: 203
        state: OPEN
```

这部分回答：“一个分区的完整历史由哪些 Ledger 按什么顺序组成？”

- `partition-0` 先读 Ledger 100，再读 Ledger 102；
- `partition-1` 先读 Ledger 200，再读 Ledger 203；
- `OPEN` Ledger 是当前追加段，还没有最终结尾；
- `CLOSED` Ledger 已有确定结尾，只能读取，不能继续追加。

#### 2.2.3 Ledger 100 的 Bookie 发生切换

假设 Ledger 100 使用 `E=3、Qw=3、Qa=2`。它仍处于 `OPEN` 状态、写到 Entry 600 时，`bookie-3` 不可用，BookKeeper Client 选择 `bookie-4` 替换它。Ledger 100 后来写到 Entry 999 才被关闭，所以最终元数据如下：

```yaml
ledger-metadata:
  ledgerId: 100
  state: CLOSED
  lastEntryId: 999
  ensembleSize: 3
  writeQuorum: 3
  ackQuorum: 2
  ensembles:
    0:   [bookie-1, bookie-2, bookie-3]
    600: [bookie-1, bookie-2, bookie-4]
```

`ensembles` 的 Key 表示“从哪个 Entry 开始使用这组 Bookie”：

```text
Entry 0   ～ 599 → [bookie-1, bookie-2, bookie-3]
Entry 600 ～ 999 → [bookie-1, bookie-2, bookie-4]
```

这里的 **Fragment 不是一个新 Bookie，也不是新建的一份完整 Ledger 文件**。它的定义是：同一个 Ledger 中，连续使用同一组 Ensemble 的一段 Entry 范围。

```text
Fragment 1 = Ledger 100 的 Entry 0～599
             Ensemble [bookie-1, bookie-2, bookie-3]

Fragment 2 = Ledger 100 的 Entry 600～999
             Ensemble [bookie-1, bookie-2, bookie-4]
```

正因为 `bookie-3` 被 `bookie-4` 替换，从 Entry 600 开始使用的 Ensemble 发生变化，Ledger Metadata 才增加 `600 → [bookie-1, bookie-2, bookie-4]` 这条记录，并由此划出新的 Fragment。Ledger ID 仍然是 100，Writer 仍在这条 Ledger 上顺序追加，因此不必仅为一次可恢复的成员替换创建新 Ledger。

读取时，BookKeeper Client 根据 Entry ID 找对应 Fragment：读取 Entry 500 使用起始位置 `0` 的 Ensemble；读取 Entry 800 使用起始位置 `600` 的 Ensemble。

需要区分两件事：

1. **为后续写入切换 Ensemble**：新 Fragment 从 Entry 600 开始使用 Bookie 4，不会自动搬迁 Entry 0～599；
2. **修复旧 Fragment**：若 Bookie 3 永久故障，AutoRecovery 从 Bookie 1/2 读取 Entry 0～599，复制到替代 Bookie，成功后再更新旧 Fragment 的副本元数据。

“不一定创建新 Ledger”也有前提：当前 Ledger 仍可维持合法单 Writer、能够满足 Ack Quorum，并且 Ensemble Metadata 的 CAS 更新成功。若整个旧 Ensemble 都不可用、没有足够副本读取，或者 Ledger 已进入 fencing/recovery，系统不能只增加一个 Bookie 4 就凭空恢复历史；写入会失败或先关闭/恢复旧 Ledger，再由 Managed Ledger 创建新 Ledger。新 Ledger 只能承接后续写入，不能找回已经丢失的数据。

#### 2.2.4 其余三个 Ledger 的元数据

```yaml
ledger-metadata:
  102:
    state: OPEN
    ensembleSize: 3
    writeQuorum: 3
    ackQuorum: 2
    ensembles:
      0: [bookie-2, bookie-3, bookie-4]

  200:
    state: CLOSED
    lastEntryId: 799
    ensembleSize: 3
    writeQuorum: 3
    ackQuorum: 2
    ensembles:
      0:   [bookie-1, bookie-3, bookie-4]
      300: [bookie-2, bookie-3, bookie-4]

  203:
    state: OPEN
    ensembleSize: 3
    writeQuorum: 3
    ackQuorum: 2
    ensembles:
      0: [bookie-1, bookie-2, bookie-4]
```

Ledger 200 也发生过一次切换：Entry 0～299 使用第一组 Bookie，Entry 300 起使用第二组。Ledger 102 和 203 当前只有一个 Fragment，以后发生 Bookie 替换时可以继续增加新的起始 Entry 和 Ensemble。

#### 2.2.5 Subscription、Bookie 注册和 Namespace 策略

除上面的核心存储目录外，Metadata Store 还会保存或索引其他控制状态，例如：

```yaml
subscriptions:
  inventory-service:
    topic: order-events-partition-0
    managedCursor: inventory-service-cursor
    cursorMetadata: 指向持久 Cursor 状态

available-bookies:
  bookie-1: bookie-1.example:3181
  bookie-2: bookie-2.example:3181
  bookie-3: bookie-3.example:3181
  bookie-4: bookie-4.example:3181

namespace-policies:
  namespace: sales/order
  retention: 72h
  backlogQuota: 2TiB
  schemaCompatibilityStrategy: BACKWARD
```

Cursor 的高频确认状态可以通过 Managed Cursor 的持久结构写入 BookKeeper，Metadata Store 保存其入口和必要元数据。这里不应把 Cursor 简化成 Metadata Store 中一个不断覆盖的 Offset 数字。Schema 兼容策略属于配置元数据；具体 Schema 版本内容由 Pulsar Schema Registry 使用现有持久存储层保存。

把这些信息合起来，新 Broker 接管 `partition-0` 时才能完成下面的定位：

```text
Topic 分区元数据
  → 找到 partition-0
Bundle 所有权
  → 确认自己是当前 Owner
Managed Ledger 元数据
  → 找到 Ledger 100、102
Ledger 102 元数据
  → 找到当前写入 Bookie [2,3,4] 和 E/Qw/Qa
Managed Cursor 元数据
  → 恢复各 Subscription 的消费位置
```

Metadata Store 保存的是这张“目录、所有权和状态地图”，而不是订单消息正文。真正的 `OrderCreated`、`OrderPaid` 等 Entry 数据仍保存在对应 Bookie 上。

### 2.3 一个 Topic 到底属于几个 Broker

要区分“Partitioned Topic”与“它内部的单个 Partition”：

- 非分区 Topic：同一时刻只有一个 Owner Broker；
- Partitioned Topic：它是一个逻辑名称，每个内部 Partition 分别只有一个 Owner Broker；
- 不同 Partition 可以属于不同 Broker，因此整个 Partitioned Topic 可以同时使用多个 Broker；
- Broker 所有权的实际调度单位是 Namespace Bundle，一个 Bundle 内会包含多个 Topic 或 Partition。

仍以两个分区的 Order Topic 为例：

```mermaid
flowchart LR
    P[Producer] --> L[任一 Broker / Proxy\n执行 Topic Lookup]
    L -.查询所有权.-> MS[Metadata Store]

    T[Order Topic] --> P0[partition-0]
    T --> P1[partition-1]

    P0 --> B1[Owner Broker 1\n唯一 Managed Ledger Writer]
    P1 --> B2[Owner Broker 2\n唯一 Managed Ledger Writer]

    L -->|partition-0 请求转到 B1| B1
    L -->|partition-1 请求转到 B2| B2
    B1 -->|AddEntry| BK[BookKeeper]
    B2 -->|AddEntry| BK
```

“客户端可以连接任意 Broker”只适用于发现入口，不能理解成所有 Broker 都能同时写同一个 Partition：

1. Producer 根据路由策略先选中 `partition-0`；
2. 客户端向任一 Broker 查询它的当前 Owner；
3. 直连模式下，客户端被引导并连接到 `broker-1`；使用 Proxy 时，由 Proxy 把请求转给 `broker-1`；
4. 只有 `broker-1` 持有该 Partition 的活动 Managed Ledger Writer；
5. `broker-1` 才能为消息分配下一个 Entry ID，并向 Ledger 当前 Ensemble 中的 Bookie 发起 `AddEntry`。

这条“单 Owner、单 Writer”规则很重要。如果 Broker 1 和 Broker 3 同时给同一个 Ledger 分配 Entry ID，就可能产生两个冲突的日志尾部。

#### 2.3.1 Broker 故障时转移什么

Broker 1 故障后，转移的是 `partition-0` 所在 Bundle 的服务所有权，不是把消息数据从 Broker 1 复制给 Broker 3：

```mermaid
sequenceDiagram
    participant P as Producer
    participant B1 as Broker 1：旧 Owner
    participant MS as Metadata Store
    participant B3 as Broker 3：新 Owner
    participant BK as BookKeeper

    B1--xMS: 会话失效 / 所有权释放
    B3->>MS: 获取 Bundle 所有权
    B3->>BK: 打开 Managed Ledger
    B3->>BK: Fence 并 Recover 最后一个 Ledger
    B3->>BK: 创建新的可写 Ledger
    P->>MS: 重新 Lookup partition-0
    MS-->>P: 当前 Owner 是 Broker 3
    P->>B3: 继续发送
```

接管时，新 Broker 先恢复并封闭旧 Ledger，再创建新 Ledger 继续写。旧 Broker 即使稍后恢复，也不能继续成为同一个 Ledger 的合法 Writer：

- Metadata Store 的当前所有权已经属于新 Broker；
- Ledger 元数据更新使用 CAS，两个 Writer 不能各自成功提交不同的 Ledger 列表；
- BookKeeper fencing 会阻止旧 Writer 再获得 Ack Quorum。

因此，控制面的目标是同一时刻只有一个有效 Owner；即使故障切换期间旧 Broker 暂时保留过期认知，存储协议也只允许一条日志历史最终成立。

## 3. 核心抽象与它们提供的语义

### 3.1 Tenant 与 Namespace：多租户治理边界

Pulsar Topic 的完整名称通常是：

```text
persistent://tenant/namespace/topic
```

- **Tenant** 是组织或租户边界，可关联权限和允许使用的集群；
- **Namespace** 是一组 Topic 的策略边界，保留、TTL、配额、复制、持久化参数常在这里配置；
- **Topic** 是消息流和订阅的逻辑边界。

这套层次适合平台化治理，但也意味着错误的 Namespace 规划会扩大配置变更和资源竞争的影响面。

### 3.2 Topic 与 Partition：顺序和并行度边界

非分区 Topic 对应一条 Managed Ledger，由一个 Broker 负责服务。经典 Partitioned Topic 则由多个内部 Topic 分区组成，每个分区各有自己的 Broker Owner 和 Managed Ledger。

```mermaid
flowchart LR
    T[Partitioned Topic] --> P0[Partition 0\nOwner Broker A\nManaged Ledger 0]
    T --> P1[Partition 1\nOwner Broker B\nManaged Ledger 1]
    T --> P2[Partition 2\nOwner Broker C\nManaged Ledger 2]
    P0 --> BK[共享 BookKeeper 集群]
    P1 --> BK
    P2 --> BK
```

因此：

- 分区增加写入和消费并行度；
- 每个分区内有存储顺序，跨分区没有全局顺序；
- Broker Owner 可以改变，但分区历史仍在 BookKeeper；
- 增加 Bookie 提高存储容量和副本承载力，不直接增加 Topic 的服务并行度。

### 3.3 Message、Entry 与 Message ID

Producer 发送的是 Message。Broker 经过批处理后写入 BookKeeper 的单位是 Entry，一个 Entry 可以包含一条消息或一个批次。

Message ID 通常包含 Ledger、Entry、Partition 和批次内位置等信息。它适合定位和恢复读取位置，但业务系统仍应提供稳定的 `event_id`；物理 Message ID 不等于跨重试、跨 Topic 的业务幂等键。

### 3.4 Managed Ledger：Topic 的逻辑日志

一个 Topic 分区对应一条 Managed Ledger，而一条 Managed Ledger 又由多个 BookKeeper Ledger 组成：

```text
Managed Ledger
  ├── Ledger 10：已封闭，只读
  ├── Ledger 11：已封闭，可下沉
  └── Ledger 12：当前写入 Segment
```

BookKeeper Ledger 是单写者、只追加的 Segment。达到大小、时间或故障切换条件后会封闭，Broker 创建新 Ledger 继续写。Segment 不可变，使副本修复、删除和冷数据下沉更容易。

### 3.5 Subscription 与 Cursor：一份独立消费状态

Subscription 表示一份独立订阅。每个持久 Subscription 有自己的 Managed Cursor，用于记录：

- 已确认到哪里；
- 哪些单条消息已确认；
- 哪些消息仍在 backlog；
- 故障后从哪里恢复投递。

不同 Subscription 各自看到完整消息流，并独立推进。例如风控订阅变慢不会改变报表订阅的 Cursor，但会让风控订阅的 backlog 阻止相关 Ledger 被删除。

### 3.6 Consumer 与 Reader

- **Consumer** 绑定 Subscription，通过 ACK 推进 Cursor；
- **Reader** 从指定 Message ID 读取，不创建普通消费 ACK 语义，应用自己管理位置。

Reader 不会替数据建立持久 backlog。若仅使用 Reader 又希望历史长期存在，必须显式配置 retention，不能假设 Topic 会自动永久保留消息。

## 4. 存储模型：Ledger、Entry 和 Cursor

```mermaid
flowchart LR
    P[Producer Messages] --> B[Broker 批处理]
    B --> E[BookKeeper Entry]
    E --> L1[当前 Ledger]
    L1 -->|rollover| L2[下一个 Ledger]
    L1 --> C1[Subscription A Cursor]
    L1 --> C2[Subscription B Cursor]
    L1 -->|封闭后| O[可选对象存储]
```

这里有三个容易混淆的关系：

1. 消息属于 Topic/Partition，但物理副本属于 Ledger Entry；
2. Ledger 的副本集合可以在故障后更换，因此一个 Topic 的不同历史段可分布在不同 Bookie；
3. Cursor 也是持久状态，Broker 切换后新 Owner 会从存储恢复，而不是从客户端猜测消费进度。

Broker 缓存用于降低读延迟，但不构成持久化保证。真正的确认边界在 BookKeeper Journal 和 Ack Quorum。

## 5. BookKeeper 多副本的三个参数

每个 Ledger 由三个参数定义副本写入范围：

| 参数 | 含义 | 第一性原理 |
|---|---|---|
| Ensemble `E` | 该 Ledger Fragment 可使用的 Bookie 集合大小 | 副本放置范围 |
| Write Quorum `Qw` | 每条 Entry 实际写入多少个 Bookie | 单条消息的目标副本数 |
| Ack Quorum `Qa` | 至少收到多少个持久化确认才算成功 | Producer 成功时已经保证的副本数 |

必须满足：

```text
E >= Qw >= Qa
```

例如 `E=3, Qw=3, Qa=2` 表示每条 Entry 发往 3 个 Bookie，收到其中 2 个持久确认后即可完成写入。它不是“一个主节点同步到两个从节点”，而是单写者向一组对等存储节点执行 Quorum 写入。

`Qa=2` 可以安全承受一个已确认副本丢失；若要抵抗机架或可用区故障，还必须使用 rack-aware 或 region-aware 放置策略。三个副本若都在同一故障域，仍然只能抵抗单机故障。

## 6. 消息何时可以返回成功

以下都假设当前 Ledger 的参数是：

```text
Ensemble = [Bookie 1, Bookie 2, Bookie 3]
E = 3，Qw = 3，Qa = 2
初始 Writer.LAC = -1，表示还没有确认任何 Entry
```

每条 Entry 会发给三个 Bookie，但得到任意两个持久化 ACK 就满足 `Qa=2`。不同 Entry 不要求由完全相同的两个 Bookie 确认。

### 6.1 两次连续写入：第二次 Bookie 2 掉线

假设 Producer 连续发送 `M0`、`M1`，Broker 分别把它们写成 `Entry 0`、`Entry 1`。

#### 6.1.1 Entry 0 由 Bookie 1、2 确认

```mermaid
sequenceDiagram
    autonumber
    participant P as Producer
    participant W as Owner Broker / Ledger Writer
    participant B1 as Bookie 1
    participant B2 as Bookie 2
    participant B3 as Bookie 3

    Note over W: Writer.LAC=-1
    P->>W: Send(M0)
    W->>W: 分配 EntryId=0<br/>Entry 0 携带 priorLAC=-1
    par 写入 Qw=3
        W->>B1: AddEntry(0, priorLAC=-1, M0)
        W->>B2: AddEntry(0, priorLAC=-1, M0)
        W->>B3: AddEntry(0, priorLAC=-1, M0)
    end
    B1->>B1: Journal 持久化 Entry 0
    B1-->>W: durable ACK 1/2
    B2->>B2: Journal 持久化 Entry 0
    B2-->>W: durable ACK 2/2
    W->>W: Entry 0 达到 Qa<br/>Writer.LAC -1 → 0
    W-->>P: M0 成功，返回 MessageId(Entry 0)
    B3->>B3: 稍后持久化 Entry 0
    B3-->>W: late ACK
```

第一次返回成功时，已经确定至少 Bookie 1、2 持久保存了 Entry 0。Bookie 3 可以稍后追上；`Qa=2` 不要求为了这次响应等待全部三个 Bookie。

#### 6.1.2 Entry 1 写入时 Bookie 2 掉线

为便于观察连续历史，假设 Bookie 3 的迟到写入已经完成 Entry 0。Entry 0 成功后，Writer 的 LAC 是 0，因此 Entry 1 会把 `priorLAC=0` 一起写给 Bookie：

```mermaid
sequenceDiagram
    autonumber
    participant P as Producer
    participant W as Owner Broker / Ledger Writer
    participant B1 as Bookie 1
    participant B2 as Bookie 2
    participant B3 as Bookie 3

    Note over W: Entry 0 已成功，Writer.LAC=0
    P->>W: Send(M1)
    W->>W: 分配 EntryId=1<br/>Entry 1 携带 priorLAC=0
    par 写入 Qw=3
        W->>B1: AddEntry(1, priorLAC=0, M1)
        W->>B2: AddEntry(1, priorLAC=0, M1)
        W->>B3: AddEntry(1, priorLAC=0, M1)
    end
    B2--xW: Bookie 2 掉线，没有 ACK
    B1->>B1: Journal 持久化 Entry 1
    B1-->>W: durable ACK 1/2
    B3->>B3: Journal 持久化 Entry 1
    B3-->>W: durable ACK 2/2
    W->>W: Entry 1 达到 Qa，且 Entry 0 已连续确认<br/>Writer.LAC 0 → 1
    W-->>P: M1 成功，返回 MessageId(Entry 1)
```

所以答案是：**第二次写入可以由 Bookie 1、3 确认，不要求仍然是第一次的 Bookie 1、2。** 在同一个三节点 Write Quorum 中，任意两个 `Qa=2` 集合至少相交一个 Bookie；上例的交点是 Bookie 1。

Bookie 2 掉线后是否立刻换成 Bookie 4，还受客户端的 Ensemble Change 策略和故障到达顺序影响：

- 如果 Bookie 1、3 已经先满足 `Qa=2`，Entry 1 可以成功；不需要仅为了本次 ACK 等待第三个副本恢复；
- 若 Writer 在 Entry 1 仍处于 Pending 状态时发起 Ensemble Change，就会通过元数据 CAS 将 Bookie 2 替换为 Bookie 4，并把受影响的 Pending Entry 重新发给新 Bookie；
- 开启延迟 Ensemble Change 时，只要剩余响应仍能满足 Ack Quorum，可以暂缓昂贵的元数据切换；无法满足 `Qa` 时才必须替换或让写入失败。

这解释了 `Qw=3、Qa=2` 的取舍：目标是最终有三个写入副本，但 Producer 的成功条件是两个持久副本；第三份副本可以通过迟到写入、Ensemble Change 或后续修复补齐。

### 6.2 第二次写入必须等待第一次吗

要区分“能否开始写”和“能否返回成功”：

- **不必等待才能开始**：BookKeeper 支持流水线，Entry 1 可以在 Entry 0 的回调完成前就发往 Bookie；
- **必须等待才能成功返回**：Entry 1 不能越过 Entry 0 向 Broker/Producer 返回成功，LAC 只能连续推进。

假设 Entry 1 比 Entry 0 更早凑齐自己的两个 ACK：

```mermaid
sequenceDiagram
    participant P as Producer
    participant W as Ledger Writer
    participant B1 as Bookie 1
    participant B2 as Bookie 2
    participant B3 as Bookie 3

    W->>B1: Entry 0
    W->>B2: Entry 0
    W->>B3: Entry 0
    W->>B1: Entry 1（流水线，无需等 Entry 0 回调）
    W->>B2: Entry 1
    W->>B3: Entry 1

    B1-->>W: Entry 1 ACK
    B3-->>W: Entry 1 ACK，Entry 1 已达到 Qa
    Note over W: Entry 0 尚未达到 Qa<br/>Entry 1 留在 Pending Queue，不能回调

    B1-->>W: Entry 0 ACK
    B2-->>W: Entry 0 ACK，Entry 0 达到 Qa
    W->>W: 先确认 Entry 0，LAC -1 → 0
    W-->>P: Entry 0 成功
    W->>W: 再确认已完成的 Entry 1，LAC 0 → 1
    W-->>P: Entry 1 成功
```

如果 Entry 0 始终无法达到 `Qa`，即使 Entry 1 已经写到两个 Bookie，也不能单独向上层宣布成功。Writer 必须通过重试或 Ensemble Change 先修复 Entry 0；若无法形成连续前缀，这个 Ledger 写入会失败。

这样做是为了防止出现：

```text
Entry 0：未知或缺失
Entry 1：已经向 Producer 返回成功
```

BookKeeper 对外承诺的是一段没有空洞的连续日志，而不是若干彼此独立的成功 Entry。

### 6.3 LastAddConfirmed 到底保存在哪里

LastAddConfirmed（LAC）表示 Writer 已经按顺序完成 Ack Quorum 的最后一个 Entry ID。它分为三种形态，不能混成“所有 Bookie 上的同一个变量”。

#### 6.3.1 Writer 内存中的权威 LAC

Ledger 正常写入时，当前 LedgerHandle/Owner Broker 在内存中维护权威的 `Writer.LAC`：

```text
Entry 0 连续达到 Qa → Writer.LAC = 0
Entry 1 连续达到 Qa → Writer.LAC = 1
```

它决定当前 Writer 已经成功确认到哪里。LAC 不会在每次写入后都更新到 Metadata Store；Metadata Store 中的 Ledger `lastEntryId` 通常是在 Ledger 被 CLOSED 后才成为最终结尾。

#### 6.3.2 普通 Entry 中携带的 priorLAC

每次写 Entry 时，协议会把“发送这一条时已经确认到哪里”放进 Entry 头部。Bookie 把整个 Entry 写入 Journal，因此这个 priorLAC 会随 Entry 一起持久保存：

```text
Entry 0 携带 priorLAC=-1
Entry 1 携带 priorLAC=0
Entry 2 携带 priorLAC=1
```

注意，Entry 1 达到 Qa 后 Writer 才能把 LAC 推进到 1，所以 Entry 1 通常只能携带此前的 LAC=0；要让 Bookie 从普通写入中知道 LAC=1，需要后续 Entry 2 把它带过去。

#### 6.3.3 可选的 Explicit LAC

如果一段时间没有下一条 Entry，Writer 可以按配置发送 Explicit LAC，把最新 LAC 单独传播给 Bookie。现代 Bookie 存储格式可以把 Explicit LAC 写入 Journal，并保存在 Ledger 的 FileInfo 中。

Explicit LAC 解决的是“最后一条已确认 Entry 后面没有新 Entry，Bookie 如何尽快知道最新 LAC”。它不会改变 Entry 是否曾达到 Ack Quorum，也不是三个 Bookie 之间的共识投票。

### 6.4 三个 Bookie 如何对齐 LAC

答案是：**正常写入期间不要求三个 Bookie 的本地 LAC 时刻完全一致。** 它们不会互相同步 LAC，也不会共同选举一个 LAC。

连续两次写入结束后，可能出现：

| 位置 | 保存的 Entry | 已知的最高 LAC | 原因 |
|---|---|---|---|
| Writer | Entry 0、1 已连续完成 | 1 | 已收到两条 Entry 的有序 Qa |
| Bookie 1 | Entry 0、1 | 0 | Entry 1 中携带 priorLAC=0 |
| Bookie 2 | Entry 0，随后掉线 | -1 | Entry 0 写入时携带 priorLAC=-1 |
| Bookie 3 | Entry 0、1 | 0 | Entry 1 中携带 priorLAC=0 |

若随后写入 Entry 2，它会携带 `priorLAC=1`，收到它的 Bookie 就会学到 LAC=1；若没有 Entry 2，可以由 Explicit LAC 传播。Bookie 2 掉线期间继续保留旧认知并不破坏正确性。

读者或恢复者不会相信单个落后 Bookie。它会向足够多的 Bookie 查询 LAC，取最高的有效结果作为安全起点；Broker 故障恢复还会 fencing 旧 Writer，并从该起点向后逐条读取和补齐，最终把 Ledger 以确定的 `lastEntryId` 关闭。此时所有读者依据 CLOSED Ledger 元数据得到相同结尾。

所以“对齐”分为两层：

1. 平时通过后续 Entry 或 Explicit LAC 让各 Bookie 逐步学到更新位置；
2. 故障时通过 Quorum 查询、fencing、向后扫描和 CAS Close 确定唯一最终结尾。

### 6.5 未确认 Entry 如何处理

假设 Writer 已经确认到 Entry 1，即 `Writer.LAC=1`，随后 Entry 2 只写入 Bookie 3，尚未达到 `Qa=2`，Broker 就故障：

```text
Bookie 1：Entry 0、1
Bookie 2：Entry 0，已掉线
Bookie 3：Entry 0、1、2
Writer：LAC=1，Entry 2 未向 Producer 返回成功
```

Entry 2 位于已确认连续前缀之后，普通读者不能把它直接当成已提交消息。Recovery 会：

1. Fence 旧 Ledger，阻止旧 Writer 再凑够 Ack Quorum；
2. 查询各 Bookie 的最高已知 LAC；
3. 从安全起点之后逐条探测 Entry；
4. 如果 Entry 2 仍能从某个 Bookie 读出，就把它以 Recovery Add 补到完整 Write Quorum，并把它纳入最终 Ledger；
5. 如果 Entry 2 已无法读出，就在 Entry 1 结束并关闭 Ledger；残留的孤立字节不属于有效日志，之后由存储清理。

因此，Producer 没收到 Entry 2 的成功响应时，结果仍然未知：它可能在 Recovery 中被保留，也可能被舍弃。Producer 要用相同业务事件 ID 重试，Consumer 仍需幂等。

### 6.6 Journal 持久化与 DEFERRED_SYNC

正常耐久写入的过程可以简化为：

```text
Bookie 收到 Entry
  → 写入 Journal
  → Journal 刷到持久介质
  → 返回 durable ACK
```

Bookie 可以把多条 Journal 写入合并刷盘，不等于每条消息单独执行一次物理 `fsync`；但 ACK 的耐久边界仍在 Journal 刷盘之后。Ledger Storage 可以随后从内存结构刷新，Bookie 崩溃重启时用 Journal 重放恢复。

BookKeeper 底层还提供特殊的 `DEFERRED_SYNC` 写标志。使用它时，Bookie 可以在数据只进入操作系统缓冲区、尚未刷到持久介质时返回；这种写入不会像普通耐久 Add 那样推进 LAC。若此时整机掉电，已经返回的数据仍可能消失。

原文那句话实际想表达的是：

```text
普通 Durable Add 成功
  = 至少 Qa 个 Bookie 已把 Entry 写入持久 Journal

DEFERRED_SYNC 成功
  = Bookie 已暂时接收数据，但掉电后仍可能丢失
```

本文讨论 Pulsar 持久 Topic 的成功语义时，默认指普通 Durable Add。除非应用明确选择了放松持久性的底层模式，并接受最近一段已响应数据在掉电时丢失，否则不能把 `DEFERRED_SYNC` 的成功称为“持久化成功”。这里所谓重新定义 RPO，就是明确承认：故障时允许丢掉多少条或多长时间内已经返回的消息。

## 7. Pulsar 是否采用主从复制或半同步

对持久 Topic 的消息数据来说，答案是：**不是 Broker 主从复制**。

- Broker 是某个 Topic 分区的临时单写者；
- Bookie 是对等存储节点，没有为每个 Topic 选一个 Bookie Master；
- `Qa` 决定一次成功等待几个持久副本；
- Broker 故障后转移的是 Topic 所有权，并恢复/封闭最后一个 Ledger；
- Bookie 故障后修复的是 Ledger Fragment 副本，不是提升“从 Broker”为“主 Broker”。

如果一定要与半同步主从类比，`Qa < Qw` 看起来像“等待部分副本后返回”，但 BookKeeper 更准确的术语是 Ack Quorum。使用正确术语能避免误以为某个 Slave 会带着本地日志直接接管 Topic。

## 8. Broker 故障的临界场景

### 8.1 M 未达到 Qa，Broker 就故障

```mermaid
sequenceDiagram
    participant P as Producer
    participant A as Broker A：旧 Owner
    participant K1 as Bookie 1
    participant K2 as Bookie 2
    participant K3 as Bookie 3
    participant B as Broker B：新 Owner
    participant MS as Metadata Store

    P->>A: Send(M)
    A->>K1: AddEntry(M)
    K1-->>A: durable ACK 1/2
    A--xA: 达到 Qa 前故障
    Note over P: 没有成功响应，结果未知
    B->>MS: 获取 Topic 所有权
    B->>K1: Fence 最后一个 Ledger
    B->>K2: Fence 最后一个 Ledger
    B->>K3: Fence 最后一个 Ledger
    B->>B: Ledger Recovery，确定最终尾部
    B->>MS: CAS 封闭旧 Ledger 元数据
    B->>B: 创建新 Ledger 继续写
```

恢复过程不是简单地“只保留 LAC 之前的数据”。新 Broker 会：

1. 把旧 Ledger 标记为恢复中并执行 fencing；
2. 从 Bookie 获得最高的已知 LAC；
3. 从该位置向后逐条探测；
4. 若尾部 Entry 仍可读，则把它补齐到相应 Write Quorum；
5. 遇到不可继续读取的位置后，以 CAS 封闭 Ledger，所有恢复者收敛到同一结尾。

因此 M 虽未达到 Qa，也可能在 Recovery 中被保留；也可能因无法读取而被舍弃。Producer 没收到成功时不能推断 M 一定不存在，应使用同一业务事件 ID 重试并接受可能重复。

### 8.2 M 已达到 Qa，但响应丢失

```mermaid
sequenceDiagram
    participant P as Producer
    participant A as Broker A
    participant BK as Qa 个 Bookie
    participant B as 新 Owner Broker B

    P->>A: Send(M, event_id=E1)
    A->>BK: AddEntry(M)
    BK-->>A: 达到 durable Qa
    A--xP: 成功响应在网络中丢失
    A--xA: A 故障
    B->>BK: Fence + Recover，M 属于有效历史
    P->>B: 用 E1 重试
    Note over B: 若未启用去重，可能再次持久化 M
```

这是所有分布式写入都绕不开的不确定窗口：服务端已经成功，客户端却不知道。解决方法不是“不重试”，而是：

- Producer 使用稳定名称和 Sequence ID，并在需要时启用 Broker 去重；
- 消息携带稳定业务 `event_id`；
- Consumer 仍按业务 ID 幂等，因为消费重投也会制造重复。

### 8.3 Producer 已收到成功，Broker 随后故障

只要仍有足够的已确认 Bookie 副本可读，新 Broker 的 Recovery 就能保留 M。Broker 本身无需拥有 M 的本地完整副本。

但保证范围由 `Qa` 和故障域放置共同决定。如果 `Qa=2` 的两个确认副本所在整机架同时损坏，Producer 收到成功也不能创造不存在的第三份持久数据。

## 9. 旧 Broker 恢复后如何避免双写

Pulsar 用两个层次保持单一历史：

1. 元数据存储中的 Bundle/Topic 所有权决定当前谁可以服务 Topic；
2. BookKeeper fencing 和 Ledger 元数据 CAS 阻止旧 Writer 在旧 Ledger 上重新达到 Ack Quorum。

旧 Broker 可能还来得及把某个 Entry 写到个别 Bookie，因为 fencing 消息不保证同时到达所有节点；但只要 fencing 覆盖集合与任意 Ack Quorum 相交，旧 Writer 就无法再凑够 `Qa` 并向客户端返回成功。

新 Owner 会封闭旧 Ledger、创建新 Ledger。旧 Broker 恢复后重新参与 Broker 集群，可以接管别的 Bundle，但不能把旧 Ledger 的孤立尾部自行重新发布。

## 10. Bookie 故障和副本修复

### 10.1 正在写入时的 Ensemble 变化

一个 Ledger 可以包含多个 Fragment，每个 Fragment 有自己的 Ensemble。Bookie 故障后，BookKeeper 客户端可以选择新 Bookie 替换它，并从新的 Entry 起形成新 Fragment：

```text
Ledger 12
  Entry 0   开始：Ensemble = [B1, B2, B3]
  Entry 900 开始：Ensemble = [B1, B2, B4]
```

这说明“一个 Ledger 固定复制在三台机器上”并不准确，更不能据此做静态磁盘归属判断。

若当前健康 Bookie 数量或放置条件无法满足 `E/Qw/Qa`，写入会阻塞或失败。继续有响应和继续满足承诺的副本安全，是两个不同指标。

### 10.2 AutoRecovery

AutoRecovery 分为两个逻辑角色：

- **Auditor** 根据 Bookie 失联和 Ledger 元数据找出欠副本 Fragment；
- **Replication Worker** 从仍可用副本读取 Entry，复制到新 Bookie，再更新 Ensemble 元数据。

AutoRecovery 修复的是“已存在但副本数不足”的历史数据。它不能恢复所有副本都已经丢失的数据，也不能替代正常写入路径上的 Ack Quorum。

### 10.3 下线 Bookie

不能因为 Bookie 上没有“完整 Topic”就直接关机。一个 Bookie 通常包含大量 Topic 的部分 Ledger Fragment。安全下线流程应先禁止新分配，再执行 decommission/re-replication，确认欠副本清零后才移除节点。

## 11. 如何分区并保证顺序

### 11.1 Producer 路由

经典 Partitioned Topic 的消息可以轮询到各分区，也可以依据 Message Key/Ordering Key 稳定路由。若要求同一订单有序，应让相同 `order_id` 始终进入同一分区。

增加经典 Topic 的分区数会改变类似 `hash(key) % partitionCount` 的映射，同一个 Key 可能从旧分区转到新分区。旧分区中尚未处理完的消息与新分区消息并行时，业务顺序就会破坏。

因此严格顺序场景需要：预留分区、受控切流、等待旧路由排空，或用业务版本号拒绝倒序状态变更。

### 11.2 四种 Subscription 的语义

| 类型 | 消费者关系 | 顺序范围 | 主要局限 |
|---|---|---|---|
| Exclusive | 一个 Subscription 只允许一个 Consumer | 单分区按存储顺序 | 单活限制消费并行度 |
| Failover | 每个分区一个活动 Consumer，其他待命 | 每个分区有序 | 切换时可能重投；跨分区无全局顺序 |
| Shared | 多 Consumer 轮流分担消息 | 不保证顺序 | 完成顺序和重投顺序均可能变化 |
| Key_Shared | 同一 Key 在同一时刻交给一个 Consumer | 单 Key 有序 | 需要正确 Key 和批处理策略；热点 Key 仍是瓶颈 |

Key_Shared 要求 Producer 禁用普通批处理，或使用 key-based batching。否则不同 Key 被装入同一 Entry 批次，Broker 可能按批次第一个 Key 把整批发给同一 Consumer，破坏预期的 Key 分发语义。

### 11.3 存储有序不等于业务完成有序

完整顺序至少需要：

1. 同一业务实体使用稳定 Key，并始终路由到同一分区；
2. 多 Producer 并发时，用事件版本或单一写入源定义因果顺序；
3. Consumer 对同 Key 串行执行，不把任务交给无序线程池；
4. 处理成功后再 ACK；
5. 明确失败消息是阻塞后续、重投，还是跳过进入死信。

Negative ACK、ACK Timeout 和消费者切换都可能触发重投；在有序 Subscription 上，单条重投也可能改变观察顺序。关键状态机不能只依赖 Broker 投递顺序，还要校验业务版本。

## 12. ACK、Cursor 与至少一次消费

可靠消费的基本顺序是：

```text
Receive → 执行业务事务 → 业务提交 → ACK
```

若业务提交后、ACK 前进程崩溃，消息会被重新投递。因此默认语义应按“至少一次 + 业务幂等”设计。

Pulsar 支持：

- **Individual ACK**：确认一条具体消息，适合 Shared/Key_Shared 等并行处理；
- **Cumulative ACK**：确认当前位置以及之前的连续消息，适合 Exclusive/Failover 的顺序处理；Shared/Key_Shared 不适合累计确认；
- **Negative ACK / Redelivery**：显式请求稍后重投；
- **ACK Timeout**：消费者超过时间未确认后重投。

Receiver Queue 和应用内部并发决定一次有多少未完成消息。预取过大可提高吞吐，也会在 Consumer 故障时扩大重投范围，并让慢任务长时间占用内存。

消费幂等仍建议采用事件 ID 唯一键、Inbox 表或业务状态机。Pulsar 的 Producer 去重不能阻止 Consumer 在业务成功后因 ACK 丢失而再次执行。

## 13. 保留、TTL、积压与回放

Pulsar 必须区分三个概念：

| 概念 | 控制什么 | 到达边界后的结果 |
|---|---|---|
| Backlog | 某 Subscription 尚未确认的消息 | Cursor 推进前应继续保留 |
| Retention | 已被所有 Subscription 确认或没有订阅的消息还保留多久/多大 | 超出后可以删除 |
| TTL | 未确认消息最多允许存活多久 | 到期后自动视为已确认，可能被删除 |

默认情况下，未确认消息因为 Subscription backlog 被保留；当所有 Subscription 都确认后，如果没有 retention，数据就可以被删除。一个从未创建 Subscription、只依赖未来 Reader 回放的 Topic，也不能默认获得长期历史。

回放通常通过重置 Subscription Cursor 或 Reader 从旧 Message ID 读取，但前提是目标 Ledger 仍在 BookKeeper 或 Tiered Storage。Cursor 能指向过去，不代表过去的数据一定存在。

Backlog Quota 达到上限后，策略可能阻塞/拒绝 Producer，或淘汰旧 backlog。选型时必须明确采用哪种策略，因为“容量满了仍返回成功”和“消息绝不丢”无法同时成立。

## 14. Tiered Storage 与长历史

封闭 Ledger 已经不可变，可以异步复制到 S3、GCS、OSS 或文件系统等低成本存储。完成下沉并经过安全等待后，本地 BookKeeper 副本可以删除，Consumer 读取旧历史时由 Broker 透明访问冷存储。

它解决的是长期存储成本，不代表冷热读取性能相同：

- 第一次读取冷数据延迟更高；
- 回放会消耗对象存储请求、网络和 Broker 资源；
- Offload 失败、凭证、生命周期规则和不完整上传都需要监控；
- 对象存储自身的耐久性和跨地域策略必须纳入 RPO。

Topic Compaction 则是另一种能力：按 Key 保留最新值的紧凑视图，适合重建最新状态，不等于保存完整审计历史。Retention、TTL、Compaction 和 Tiered Storage 不能互相替代。

## 15. Producer 去重与“精确一次”的边界

启用消息去重后，Broker 根据 Producer Name 和单调 Sequence ID 识别重试，使同一 Producer 会话针对单分区的重复发送只持久化一次。

它有明确边界：

- 必须启用 Broker/Namespace 去重并保持稳定 Producer Name；
- Sequence ID 的范围与 Producer、Topic 分区相关；
- 不能自动去重两个独立 Producer 产生的同一业务事件；
- 不能阻止 Consumer 重复执行业务数据库操作；
- 跨多个 Topic/Partition 的原子写入需要 Transaction，而不是普通去重。

因此文章中更稳妥的表达是：“Producer Deduplication 减少持久化重复；端到端仍需要业务幂等”，而不是笼统宣称 exactly-once。

## 16. Pulsar Transaction 的边界

Pulsar Transaction 可以把多个 Pulsar Topic/Partition 的 Produce 与 Subscription ACK 放进同一事务：全部提交后可见，或全部回滚。

```mermaid
flowchart LR
    I[消费 Input 消息 A] --> TX[Transaction]
    TX --> O1[向 Output Topic 1 写 B]
    TX --> O2[向 Output Topic 2 写 C]
    TX --> ACK[确认 Input Subscription 中的 A]
    O1 --> COMMIT{Commit / Abort}
    O2 --> COMMIT
    ACK --> COMMIT
```

它适合 Pulsar 内部的 consume-process-produce 流程，但不自动包含 MySQL、Redis 或外部 HTTP 服务。若业务逻辑还修改数据库，仍需 Outbox、Inbox、幂等状态机或业务补偿。

Transaction Coordinator、事务日志、Transaction Buffer 和 Pending Ack 状态也会增加额外组件与运维成本。生产使用前要确认客户端语言支持、功能开关、超时和监控，而不能因为产品“支持事务”就默认所有链路已经原子化。

## 17. 延时、重试与死信

Delayed Delivery 表示消息已经持久化，但到指定时间之后才允许投递。当前经典消费模型中主要由 Shared 和 Key_Shared Subscription 支持；在其他 Subscription 上不能假设仍具有相同延时语义。

长延时消息可能阻止前部 Ledger 清理、放大 backlog，并与 TTL 冲突：若 TTL 先到期，消息可能在计划投递时间之前就被视为过期。因此它适合“稍后检查”，不应被当作绝对精确且无限期的定时任务系统。

重试和死信需要明确：

- Negative ACK、ACK Timeout 和 Retry Letter Topic 分别何时使用；
- 最大次数、退避、告警和人工修复负责人；
- 顺序消息失败后是否允许后续消息越过；
- 重新驱动是否沿用原始业务事件 ID。

无限重试会形成热循环；死信只是在主链路旁边保存失败，不代表问题已经解决。

## 18. Schema、安全与多租户

Pulsar 内置 Schema Registry，Schema 按 Topic 管理并存入现有存储层。Producer 连接时可以注册 Schema，Broker 按兼容策略决定接受或拒绝；Message 携带 Schema Version，Consumer 按相应版本解析。

Schema Registry 能执行格式兼容检查，但不能判断字段的业务含义是否被错误修改。事件所有者仍需定义向前/向后兼容、废弃周期和无法解析消息的隔离流程。

安全与隔离至少包括：

- TLS、认证、Tenant/Namespace/Topic 授权；
- Broker 与 Bookie 的网络隔离；
- 管理 API、Proxy 和 Metrics 端口访问控制；
- Namespace 级发布、分发、存储和 backlog 配额；
- Broker isolation、Bookie isolation 和跨机架副本放置；
- 端到端加密时的密钥轮换和丢失恢复策略。

权限隔离不等于资源隔离。一个租户创建海量 Topic、产生长积压或高频冷读，仍可能影响共享 Broker、Bookie 和元数据存储。

## 19. 扩缩容和热点

Pulsar 的存算分离使两类扩容相对独立：

- 增加 Broker：Load Manager 转移 Namespace Bundle 所有权，不复制历史消息；
- 增加 Bookie：新 Ledger/Fragment 可以使用新节点，扩大容量和 I/O；旧数据不会瞬间自动均匀迁移；
- 增加 Topic Partition：提高该 Topic 并行度，但可能改变 Key 路由；
- 拆分 Namespace Bundle：增加 Topic 所有权调度粒度，不等于拆分某个热点 Topic 的日志。

存算分离消除了“Broker 扩容必须搬整个分区历史”的耦合，但没有消除热点：

- 单个非分区 Topic 仍由一个 Broker Owner 服务；
- 单分区或单 Key 仍受串行路径限制；
- 所有 Broker 共享 BookKeeper 时，存储热点可能影响多个租户；
- 元数据操作和百万 Topic 会给 Metadata Store、Bundle 调度和客户端连接带来压力。

## 20. 跨地域复制

Pulsar 的异步 Geo-replication 在消息本地持久化后，由 Broker 复制到远端集群。远端中断时本地仍可写，代价是存在复制积压和非零 RPO。

Pulsar 也可以通过 BookKeeper region-aware placement 把 Ack Quorum 跨地域放置，形成同步地域级持久化；这样 Producer 成功需要等待远端持久确认，跨地域延迟和故障会进入每次写入路径。

两者的区别是：

| 模式 | Producer 成功是否等待远端 | 核心取舍 |
|---|---|---|
| 异步 Geo-replication | 否 | 低延迟、地域隔离，但可能丢尚未复制的数据 |
| BookKeeper 同步跨地域 Quorum | 是 | 更低 RPO，但延迟更高，远端故障可能阻塞写入 |

Active-active 还需要处理多地域同时写入的业务冲突、重复和顺序。跨集群复制能搬运消息，不能自动建立跨地域全局业务顺序。

## 21. 运维时真正要观察什么

至少需要覆盖四层指标：

### 21.1 Producer 与 Broker

- 发布成功率、超时、重试、吞吐和 P99 延迟；
- Topic/Partition/Bundle 的 Owner 变更和重连次数；
- Broker CPU、堆外内存、Direct Memory、缓存命中和连接数；
- 单 Topic/Partition 热点，而不只是集群平均值。

### 21.2 Subscription

- 每个 Subscription 的 backlog 数量和字节；
- 最老未确认消息年龄；
- ACK、Negative ACK、Redelivery 和死信增长；
- Consumer 可用数、处理延迟和未确认消息数量。

### 21.3 BookKeeper

- Journal 写入和 fsync 延迟；
- Ledger/Entry 读写错误；
- Bookie 磁盘水位、只读状态和可用数量；
- 欠副本 Ledger 数、AutoRecovery 队列和修复速度；
- Ensemble 是否满足机架/地域放置策略。

### 21.4 元数据与冷存储

- Metadata Store quorum、会话延迟和连接异常；
- Ledger 元数据 CAS、Topic 加载和 Bundle 分配失败；
- Offload 成功率、冷读延迟、对象存储错误和费用；
- Geo-replication backlog、复制速率和最老待复制消息。

Broker 全部存活不代表系统健康：若 `Qa` 无法满足，持久写入仍会失败；Bookie 都存活也不代表可用：Metadata Store 失去多数派后，所有权和 Ledger 元数据变更会受阻。

## 22. 版本与演进边界

截至本文更新时，生产稳定版本线是 Pulsar 4.2.x。Pulsar 5.0 milestone 展示了 Scalable Topics：用可拆分/合并的 Key Range Segment 替代固定分区，并试图在伸缩时保留单 Key 顺序。

这个方向解决了经典 `hash(key) % partitionCount` 扩分区导致 Key 漂移的问题，但 milestone 不是生产稳定版，且需要 V5 客户端和相应元数据能力。当前选型不能把它当作 4.2.x 已有保证；应单独验证 GA 状态、客户端语言和迁移路径。

## 23. 适用边界

Pulsar 适合：

- 大量 Tenant、Namespace、Topic 和独立 Subscription；
- Broker 与存储需要分别扩缩容；
- 长积压、历史回放和对象存储下沉；
- 同时需要队列式 Shared 消费和事件流式独立订阅；
- 有跨集群复制、多租户配额和隔离需求。

需要谨慎评估：

- 团队只希望维护一个简单 Broker 集群；
- Topic 数和积压都很小，存算分离收益不足以覆盖 BookKeeper/Metadata Store 成本；
- 要求全局顺序或热点 Key 无限横向扩展；
- 把 Producer 去重误认为端到端 exactly-once；
- 缺少 BookKeeper、AutoRecovery、Tiered Storage 和跨层故障演练能力。

## 24. 最小选型检查表

1. 需要队列、可回放事件流，还是两者都需要？
2. Tenant、Namespace、Topic 和 Subscription 如何划分？
3. 顺序边界是单分区还是单 Key？使用哪种 Subscription？
4. `E/Qw/Qa` 分别是多少，Producer 何时获得成功？
5. 副本是否跨机架/可用区，能容忍哪些 Bookie 同时损坏？
6. Broker 在达到 Qa 前后故障，Producer 如何处理未知结果？
7. 是否启用 Producer 去重？Consumer 如何保证业务幂等？
8. ACK、Negative ACK、ACK Timeout、重试和死信如何配合？
9. 未确认 backlog、已确认 retention 和 TTL 分别是多少？
10. 经典 Topic 扩分区后如何避免 Key 漂移造成乱序？
11. Broker、Bookie、Metadata Store 和 AutoRecovery 是否分别监控和演练？
12. 长历史是否下沉，冷读性能和对象存储成本是否测算？
13. 跨地域采用异步复制还是同步 BookKeeper Quorum，RPO/RTO 是多少？
14. Schema、安全、配额和租户资源隔离由谁治理？

## 25. 参考资料

- [Apache Pulsar 4.2 Architecture Overview](https://pulsar.apache.org/docs/4.2.x/concepts-architecture-overview/)
- [Apache Pulsar 4.2 Messaging Concepts](https://pulsar.apache.org/docs/4.2.x/concepts-messaging/)
- [Pulsar Broker Load Balancing](https://pulsar.apache.org/docs/4.2.x/concepts-broker-load-balancing-overview/)
- [Pulsar Metadata Store Administration](https://pulsar.apache.org/docs/4.2.x/administration-metadata-store/)
- [Pulsar BookKeeper Persistence Policies](https://pulsar.apache.org/docs/4.2.x/administration-zk-bk/)
- [Apache BookKeeper Protocol](https://bookkeeper.apache.org/docs/development/protocol/)
- [BookKeeper Ledger API：LAC 与 Durable Add](https://bookkeeper.apache.org/docs/latest/api/ledger-api/)
- [BookKeeper Client Configuration：Explicit LAC](https://bookkeeper.apache.org/docs/latest/api/javadoc/org/apache/bookkeeper/conf/ClientConfiguration.html)
- [Pulsar Consumer API and Key_Shared Batching](https://pulsar.apache.org/docs/4.2.x/client-libraries-consumers/)
- [Pulsar Retention and Expiry](https://pulsar.apache.org/docs/4.2.x/cookbooks-retention-expiry/)
- [Pulsar Tiered Storage](https://pulsar.apache.org/docs/4.2.x/tiered-storage-overview/)
- [Pulsar Topic Compaction](https://pulsar.apache.org/docs/4.2.x/concepts-topic-compaction/)
- [Pulsar Transactions](https://pulsar.apache.org/docs/4.2.x/txn-why/)
- [Pulsar Schema Overview](https://pulsar.apache.org/docs/4.2.x/schema-overview/)
- [Pulsar Geo-replication](https://pulsar.apache.org/docs/4.2.x/concepts-replication/)
- [Pulsar Release Notes and Supported Versions](https://pulsar.apache.org/download/)
- [Pulsar 5.0 Milestone：Scalable Topics Preview](https://pulsar.apache.org/release-notes/versioned/pulsar-5.0.0-M1/)
