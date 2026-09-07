---
weight: 3
title: "Kafka（二）：存储、多副本一致性与故障恢复"
date: 2026-09-06T09:00:00+08:00
lastmod: 2026-09-07T18:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "从核心抽象理解 Kafka 的顺序、回放、消费组、Share Group、多副本、事务和适用边界"
featuredImage:

tags: ["message-queue", "kafka"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---



## 5. 生产者如何确认消息成功

Producer 先选择 Partition，再由 Partition Leader 排序和追加消息。`acks` 定义 Producer 在什么时点把一次写入视为成功：

| 确认方式 | 成功边界 | 核心风险 |
|---|---|---|
| 不等待 | 消息发出后立即继续 | 网络或 Broker 故障时应用甚至不知道消息是否到达 |
| 只等 Leader | Leader 本地接受写入 | 副本尚未同步就切主时，已确认消息可能丢失 |
| 等同步副本 | 当前 ISR 完成确认且满足最低同步副本要求 | 延迟更高；同步副本不足时拒绝写入 |

关键业务通常采用复制因子 3、至少两个同步副本、等待全部当前 ISR，并禁止落后副本直接成为 Leader。这里表达的不是固定参数答案，而是一个原则：只有未来有资格接管的副本已经拥有消息，Leader 才能向客户端确认。

### 5.1 幂等 Producer 解决什么

消息已经提交但响应丢失时，Producer 只能重试。幂等 Producer 使用 Producer ID、Epoch 和序列号识别同一批次的重试，避免因为客户端重试在同一 Partition 写入两份。

它的边界是：

- 主要解决 Producer 到 Kafka 的重复写入；
- 不代表 Consumer 的业务副作用只执行一次；
- 业务跨进程重建、外部系统写入和超出去重作用域时，仍需要稳定事件 ID。

### 5.2 批处理、压缩和背压

Producer 会把同一 Partition 的 Record 合成 Batch，并可以压缩后发送。更大的 Batch 通常提高网络和磁盘效率，但需要等待更多消息，增加低流量下的延迟。

当 Broker 变慢时，Record 会积累在 Producer 内存缓冲区。应用必须限制等待时间和缓冲上限，不能在 Kafka 不可用时无限堆积内存。发送成功的定义还应受总投递超时约束，而不是无限重试。

## 6. 多副本一致性与临界故障

### 6.1 Partition 的唯一历史

每个 Partition 有一个 Leader 和若干 Followers。Leader 决定写入顺序，Follower 按这个顺序复制。理解切主必须先区分四个状态：

| 状态 | 含义 | 解决的问题 |
|---|---|---|
| LEO（Log End Offset） | 某个副本下一条消息将写入的位置 | 这个副本实际复制到了哪里 |
| HW（High Watermark） | 已提交区域的右边界；Offset 小于 HW 的 Record 才是已提交 | Consumer 最多可以安全看到哪里 |
| Leader Epoch | 该 Partition 每一任 Leader 的单调递增任期 | 隔离旧 Leader，并识别切主后的日志分叉 |
| ISR / ELR | Controller 记录的安全 Leader 候选集合 | 哪些副本有资格在故障后接管 |

例如消息 M 的 Offset 是 100：

```text
HW = 100：Offset 100 尚未 Commit
HW = 101：Offset 100 已经 Commit
```

Kafka 不会给每条消息写一个独立的 `committed=true` 标志。是否 Commit 由 HW 这条边界统一表达。

传统模型中，足够接近 Leader 的副本进入 ISR，并参与安全提交和后续选主。Kafka 4.x 还提供 Eligible Leader Replicas（ELR）：在严格 `min.insync.replicas` 规则下，Controller 可以记录部分已经离开 ISR、但仍被证明不会丢失已提交数据的安全候选。ELR 不是允许任意落后副本上位的 Unclean Election。

Kafka 数据复制不是“每个 Partition 一个 Raft 组”。ISR 可以随着副本延迟动态变化；最低同步副本数决定 ISR 缩小时还能不能继续确认写入。

KRaft Controller 保存 Leader、Leader Epoch、ISR/ELR 等元数据，但不保存业务 Record，也不替数据 Partition 计算 HW。业务消息仍由 Partition Leader 与 Followers 复制。

核心取舍是：

- 剩余副本不足时继续写，获得可用性，但增加已确认数据丢失风险；
- 剩余副本不足时停止写，保护已确认历史，但业务暂时不可用。

### 6.2 临界故障场景

假设 P0 有 A、B、C 三个副本：

```text
Leader = A
Leader Epoch = 7
ISR = {A, B, C}
min.insync.replicas = 2
Producer acks = all
写入前 HW = 100
```

Producer 要写入消息 M。M 被分配 Offset 100，写入完成后的 LEO 是 101。

#### 6.2.1 从接收到返回的完整过程

```mermaid
sequenceDiagram
    participant P as Producer
    participant A as A：Leader
    participant B as B：ISR Follower
    participant C as C：ISR Follower
    participant R as Consumer

    Note over A,C: Leader Epoch=7，ISR={A,B,C}，初始 HW=100
    P->>A: Produce(M, acks=all, Leader Epoch=7)
    A->>A: 追加 M@100，A.LEO=101
    Note over A: M 还不能被 Consumer 看到

    Note over A,C: 第一轮 Fetch：Follower 拉取消息
    B->>A: Fetch(offset=100, epoch=7)
    A-->>B: 返回 M@100 + Leader HW=100
    B->>B: 先追加 M，B.LEO=101<br/>再令 B.HW=min(100, 101)=100

    C->>A: Fetch(offset=100, epoch=7)
    A-->>C: 返回 M@100 + Leader HW=100
    C->>C: 先追加 M，C.LEO=101<br/>再令 C.HW=min(100, 101)=100

    Note over A,C: 第二轮 Fetch：Follower 用 fetchOffset 上报复制进度
    B->>A: 下一次 Fetch(offset=101)
    A->>A: 记录 B 的复制位置=101<br/>C 仍是 100，因此 A.HW 仍为 100
    A-->>B: FetchResponse(HW=100)
    B->>B: B.HW 仍为 100

    C->>A: 下一次 Fetch(offset=101)
    A->>A: 记录 C 的复制位置=101<br/>全部 ISR 已复制到 101
    A->>A: A.HW 从 100 推进到 101，M Commit
    A-->>C: FetchResponse(HW=101)
    C->>C: C.HW=min(101, C.LEO 101)=101
    A-->>P: ProduceResponse 成功，返回 Offset=100

    R->>A: Fetch
    A-->>R: 只返回 Offset < HW 的数据，M 现在可见

    Note over A,B: B 尚未从响应中学到新 HW，本地 HW 仍可能是 100
    B->>A: 再下一次 Fetch(offset=101)
    A-->>B: FetchResponse(HW=101)
    B->>B: B.HW=min(101, B.LEO 101)=101
```

完整过程实际包含三种信息流：

1. **消息向 Follower 传播**：Follower 用 `Fetch(offset=100)` 拉到 M，追加后把自己的 LEO 推进到 101；
2. **复制进度向 Leader 传播**：Follower 下一次发送 `Fetch(offset=101)`，这个请求同时告诉 Leader：“我的日志已经写到 101”；
3. **提交边界向 Follower 传播**：Leader 汇总 ISR 的复制位置并把自己的 HW 推进到 101，再通过当前或后续 `FetchResponse(HW=101)` 把提交边界传回 Follower。

因此，每个副本上都有一个本地 HW，但职责不同：

| 位置 | HW 如何产生 | 作用 |
|---|---|---|
| Leader | 根据当前 ISR 中各副本已知的复制位置推进 | 权威的提交边界，决定何时响应 Producer、向 Consumer 暴露到哪里 |
| Follower | 从 Leader 的 FetchResponse 学到，并限制为不超过自己的 LEO | 保存对提交边界的本地认知，可能暂时落后于 Leader |

Follower 更新本地 HW 的原则可以简化为：

```text
Follower.HW = min(FetchResponse 中的 Leader.HW, Follower 自己的 LEO)
```

取 `min` 是因为 Follower 不能把尚未复制到本地的 Offset 标记为已提交。Follower 也不参与“投票计算 HW”；它只是上报自己的复制位置，并接受 Leader 算出的提交边界。

这里还有两个容易误解的地方。

第一，Follower 不是等待 Leader 主动推送再单独发送 ACK。Follower 主动发 Fetch 请求复制数据；它下一次请求携带的 Fetch Offset，告诉 Leader 自己已经复制到哪里。Leader 据此维护各副本 LEO，并计算 HW。

第二，`acks=all` 的 “all” 是当前全部 ISR，而不是 `min.insync.replicas` 个副本。上例 ISR 有三个成员，即使 `min.insync.replicas=2`，正常情况下也要 A、B、C 都拥有 M 才返回成功。`min.insync.replicas=2` 的作用是：ISR 若缩到一个成员，则拒绝这次 `acks=all` 写入。

从第一性原理看，M 的提交条件是：

```text
当前安全复制集合满足最小副本要求
                    ＋
M 已复制到当前全部 ISR
                    ↓
              HW 推进越过 M
                    ↓
       Producer 可以成功，Consumer 可以看到 M
```

事务消息还多一条可见性边界：`read_committed` Consumer 最多读取到 LSO（Last Stable Offset）。HW 表示复制已提交，LSO 还会挡住尚未结束的事务；这里讨论的 M 是非事务消息。

#### 6.2.2 Leader 切换时如何知道哪条消息已 Commit

答案不是“新 Leader 枚举每条消息的状态”，而是四步：

1. **Controller 选择安全候选**：优先从 ISR 中选择；启用 ELR 时，ISR 为空后还可以按 ELR 规则选择。Unclean Election 关闭时，不会随意选择普通落后副本；
2. **Controller 增加 Leader Epoch**：新 Leader 获得更高任期，旧 Leader 即使暂时存活，也会因 Epoch 过旧而被拒绝写入和复制；
3. **新 Leader 以本地 HW 限制可见性**：刚接管时，不会把 HW 之后的尾部立即暴露给 Consumer；
4. **副本按 Leader Epoch 对齐日志**：Followers 使用 `OffsetsForLeaderEpoch` 找到与新 Leader 的共同历史，截断真正分叉的尾部，再继续复制。新 Leader 收集当前安全副本的 Fetch 进度后，才继续推进 HW。

四个概念各负其责：

| 机制 | 它回答的问题 |
|---|---|
| ISR / ELR | 谁可以安全成为新 Leader |
| Leader Epoch | 哪一任 Leader 的日志历史有效，如何隔离旧主 |
| HW | 哪个 Offset 之前已提交并可见 |
| `acks` + `min.insync.replicas` | 什么时候可以向 Producer 返回成功 |

Follower 本地的 HW 可能暂时落后，因为 Leader 要在后续 FetchResponse 中把新 HW 传播给它。现代 Kafka 不会简单地让恢复副本“把 HW 之后全部删除”，而是用 Leader Epoch 判断真正的分叉点。这避免了一个已经复制并提交的 M，仅因新 Leader 尚未收到最新 HW 就被错误截断。

#### 6.2.3 M 尚未 Commit，A 就故障

假设此时状态是：

```text
              Log End     HW
A Leader       101        100    含 M
B Follower     101        100    含 M
C Follower     100        100    不含 M
```

M 位于 HW 之后，所以还没有对 Consumer 可见，Producer 也没有得到 `acks=all` 成功。A 故障后会出现两个安全分支：

```mermaid
flowchart TD
    F[A 故障，M 尚未 Commit] --> E[Controller 从安全候选中选新 Leader\nLeader Epoch 7 → 8]
    E --> H{新 Leader 是否含 M}
    H -->|例如 B| K[先保持 HW=100\nM 暂不可见]
    K --> Q{能否再次满足复制条件}
    Q -->|可以| CM[把 M 复制给安全副本\nHW 推进到 101，M 后来 Commit]
    Q -->|不可以| W[M 保持不可见\n写入等待或失败]
    H -->|例如 C| D[C 的有效日志不含 M]
    D --> T[B 按 Leader Epoch 对齐\n截断本地孤立的 M]
```

这说明“未收到 ACK”不等于 M 一定被删除。如果含 M 的 B 成为新 Leader，M 可能稍后完成复制并提交；如果不含 M 的 C 成为新 Leader，B 上的 M 会作为分叉尾部被截断。

Producer 无法从超时判断走了哪条分支，只能重试。启用幂等 Producer 后，相同 Producer ID、Epoch 和序列号的重试可以避免在同一 Partition 形成重复 Record；业务跨进程恢复和 Consumer 副作用仍应使用事件 ID 幂等。

#### 6.2.4 M 已 Commit，但成功响应丢失

状态已经变成：

```text
              Log End     Leader 已知的 HW
A Leader       101        101
B Follower     101        100 或 101
C Follower     101        100 或 101
```

A 已确认 B、C 都复制了 M，并把自己的 HW 推进到 101，但 ProduceResponse 在网络中丢失。即使 B、C 本地记录的 HW 还停在 100，它们的日志都已经含有 M。

此时 A 故障：

1. 任一正常的 ISR 安全候选都包含 M；
2. 新 Leader 用新 Leader Epoch 接管，不会仅因本地 HW 传播稍慢就删除 M；
3. 它根据副本 Fetch 进度恢复并推进 HW，M 继续属于有效历史；
4. Producer 仍只看到超时，重试可能重复。

因此 Kafka 能保证的是：在 `acks=all`、满足 `min.insync.replicas`、使用安全 Leader Election，且仍有合格数据副本存活的条件下，已经成功确认的 Record 不会因一次正常 Leader 切换丢失。它不能让 Producer 在响应丢失时知道服务端结果，也不能替业务实现端到端恰好一次。

#### 6.2.5 Unclean Election 为什么会破坏结论

如果 ISR/ELR 都没有可用副本，却允许不安全选主，Controller 可能选择一个缺少最新已提交 Record 的落后副本。系统更快恢复可用，但 HW 可能回退，Consumer 曾经看到的数据也可能从新历史中消失。

所以生产可靠性结论必须同时写出：

- Producer 是否使用 `acks=all`；
- `min.insync.replicas` 是多少；
- 复制因子是多少；
- 是否启用 ELR，以及集群升级后的实际状态；
- 是否禁止 Unclean Leader Election；
- 副本是否跨独立故障域。

只说“Kafka 三副本”仍然无法回答一次成功写入究竟受到了什么保护。

### 6.3 故障范围决定保证范围

三个副本跨三个 Broker，可以容忍部分 Broker 故障；副本全部位于同一机架，则不能抵抗整个机架断电。应使用 Rack Awareness 将同一 Partition 副本分散到不同故障域。

单集群副本仍不能抵抗整个地域损坏。可靠性结论必须写明它针对的是进程、磁盘、节点、可用区还是地域故障。

## 11. 保留、回放、压缩和分层存储

### 11.1 Delete Retention

日志按时间或容量删除旧 Segment。消费速度不会决定数据是否删除：Consumer 如果落后超过保留期，其尚未读取的数据仍会被清理。

因此 Retention 实际上是一条业务 SLA：系统承诺消费者和故障恢复必须在这段时间内追上。

容量可粗略估算为：

```text
总存储 ≈ 每秒写入字节 × 保留秒数 × 副本数 × 安全余量
```

压缩率、Segment 清理延迟、索引和副本迁移还会增加实际空间。

### 11.2 Log Compaction

Compaction 按 Key 清理旧值，让日志最终保留每个 Key 较新的状态。例如 `customer_id=42` 多次更新地址，压缩后可以用较新的记录重建客户状态。

它不是立即执行的普通去重：

- 相同 Key 的旧记录可能暂时仍存在；
- Key 为空的消息无法按业务 Key 压缩；
- 删除通常通过墓碑记录表达；
- 它适合保存最新状态，不适合要求完整审计历史的 Topic。

### 11.3 Tiered Storage

分层存储把较旧的封闭 Segment 放到对象存储等远端介质，本地磁盘主要保留热数据。它可以降低长保留成本，但历史回放会受到远端存储延迟和实现能力限制。

Kafka 只定义分层存储接口和元数据机制，部署时还要选择并验证具体远端存储实现。当前能力对某些 Topic 策略也存在限制，不能把“支持分层存储”直接等同于低成本无限保留。

## 12. 积压、背压与容量

Kafka 擅长积压，是因为消息本来就在日志中，不需要为每个 Consumer 复制一份正文。但积压仍会消耗磁盘，并增加恢复读取、缓存污染和跨层存储访问。

### 12.1 Consumer Lag

Lag 是日志末尾与 Consumer Group 已提交 Offset 的差值，表示还有多少 Record 未被该 Group 确认推进。但只看条数不够：消息大小不同、处理耗时不同，同样的 Lag 可能对应完全不同的恢复时间。

更实用的指标是：

- 最老未处理事件的时间；
- Lag 增长速度；
- 当前消费速度与生产速度；
- 按当前净消化速度预计多久清空。

### 12.2 Partition 是容量单位

单 Partition 由一个 Leader 排序写入，热点 Key 仍可能打满单 Partition。Partition 太少限制吞吐，太多则增加文件、内存、选主、Rebalance、迁移和恢复成本。

新增 Broker 后，已有 Partition 不会自动均匀搬过去，需要执行 Reassignment。迁移同时消耗源磁盘读、目标磁盘写和网络带宽，必须限速并监控线上延迟。

副本用于容错，Partition 用于分片。把复制因子从 3 增加到 5 不会让单 Partition 写得更快，反而会增加复制成本。

### 12.3 Producer 和 Broker 的过载行为

Broker 变慢时，Producer 的本地缓冲会逐渐填满，最终阻塞或超时。Broker 还可以通过客户端配额限制生产和消费速率，避免单个租户占满网络或磁盘。

容量设计需要同时验证正常峰值、单 Broker 故障、一个可用区故障、消费者停止和副本重建期间的吞吐。只在全员健康时跑 Benchmark，不能证明生产容量安全。

## 15. 安全与多租户

Kafka 可以使用 TLS 加密，使用 SSL 或 SASL 认证，并用 ACL 控制 Topic、Group、Cluster 和 Transactional ID 等资源权限。

生产环境至少需要：

- 区分客户端、Broker 和 Controller 网络入口；
- 每个应用使用独立身份，按 Topic 和 Group 授予最小权限；
- 内外部流量都考虑加密与认证；
- 使用生产、消费和请求配额限制噪声租户；
- 保护 Controller 和内部 Topic，因为它们包含元数据、位点和事务状态；
- 审计 Topic 创建、权限和关键配置变更。

Kafka 的配额主要限制速率，不等于存储的物理隔离。高风险租户、数据主权不同或故障影响范围要求不同的业务，可能需要独立集群。

## 16. 运维、监控和升级

监控至少分成五层：

| 层次 | 关键指标或现象 | 回答的问题 |
|---|---|---|
| 业务 | 最老未处理事件、端到端延迟、处理成功率 | 业务是否按时完成 |
| Producer | 错误率、重试、超时、缓冲等待、Throttle | 消息是否稳定进入 Kafka |
| Consumer | Lag、消费速率、Rebalance、提交失败 | 下游是否跟得上 |
| Partition | 无 Leader、ISR 缩减、欠复制副本、Leader 分布 | 数据副本是否健康 |
| 节点与控制面 | 磁盘、网络、请求延迟、Controller Quorum Lag | 集群是否接近故障边界 |

只看 Broker 进程存活和集群总吞吐不够。ISR 缩减意味着系统正在失去故障余量；磁盘增长速度决定还能积压多久；频繁 Rebalance 会造成重复和延迟。

升级时要同时考虑 Broker 软件版本、KRaft/Metadata Feature Version 和客户端协议兼容。滚动升级不是“所有节点已换二进制”就结束，还要验证 ISR、Controller Quorum、Consumer Groups、事务和性能，再决定是否提升不可逆的特性版本。

扩容、迁盘和副本修复都与线上流量争用磁盘和网络，需要限速、分批并保留足够故障余量。

## 17. 跨地域灾备

Kafka 单集群通常部署在低延迟网络内，并让 Partition 副本跨机架或可用区。跨地域一般使用独立 Kafka 集群和异步镜像工具：

```text
地域 A Kafka ── 异步复制 ──> 地域 B Kafka
```

这不是一个跨地域同步提交的 Partition，因此需要明确：

- 复制延迟决定的 RPO；
- 客户端和 DNS 切换时间决定的 RTO；
- Topic 配置、ACL 和 Schema 是否一并同步；
- Consumer Group Offset 如何迁移；
- 切换后可能出现的重复和顺序变化；
- 原地域恢复后是回切还是继续以新地域为主。

异步复制通常优先保证可用性和延迟，无法承诺地域灾难时零数据损失。若业务要求跨地域零 RPO，就必须接受跨地域同步延迟，或重新设计业务写入与冲突模型。

## 19. 参考资料

- [Apache Kafka 4.3 Documentation](https://kafka.apache.org/43/)
- [Kafka Design](https://kafka.apache.org/43/design/design/)
- [Kafka KRaft](https://kafka.apache.org/43/operations/kraft/)
- [Kafka APIs](https://kafka.apache.org/43/apis/)
- [Kafka Producer Configs](https://kafka.apache.org/43/configuration/producer-configs/)
- [Kafka Consumer and Share Consumer Configs](https://kafka.apache.org/43/configuration/consumer-configs/)
- [Kafka Topic Configs](https://kafka.apache.org/43/configuration/topic-configs/)
- [Kafka Eligible Leader Replicas](https://kafka.apache.org/43/operations/eligible-leader-replicas/)
- [KIP-101：Use Leader Epoch for Replica Log Truncation](https://cwiki.apache.org/confluence/pages/viewpage.action?pageId=177052956)
- [Kafka Consumer Rebalance Protocol](https://kafka.apache.org/43/operations/consumer-rebalance-protocol/)
- [Kafka Transaction Protocol](https://kafka.apache.org/43/operations/transaction-protocol/)
- [Kafka Tiered Storage](https://kafka.apache.org/43/operations/tiered-storage/)
- [Kafka Monitoring](https://kafka.apache.org/43/operations/monitoring/)
- [Kafka Security Overview](https://kafka.apache.org/43/security/security-overview/)
- [Kafka Basic Operations](https://kafka.apache.org/43/operations/basic-kafka-operations/)
- [Kafka Upgrade Guide](https://kafka.apache.org/43/getting-started/upgrade/)
