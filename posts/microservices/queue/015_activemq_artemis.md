---
weight: 15
title: "ActiveMQ Artemis（一）：架构、流程、核心抽象与语义"
date: 2026-09-06T15:00:00+08:00
lastmod: 2026-09-07T15:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "理解 ActiveMQ Artemis 生产集群、消息顺序、HA 复制与故障恢复"
featuredImage:

tags: ["message-queue", "activemq", "artemis"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

ActiveMQ Artemis 是面向 JMS 与多协议企业集成的消息 Broker。它需要把“Cluster 横向路由”和“HA 数据备份”分开理解：Cluster Connection 不会自动让每条消息拥有副本，高可用来自每个 Live Server 对应的 Backup Server。

<!-- more -->

## 1. 完整架构

```mermaid
flowchart LR
    P[AMQP / JMS / MQTT / STOMP Client] -->|发现拓扑 / Failover URL| L1
    C[Consumer] --> L2

    subgraph D[数据面：Active Brokers]
        L1[Primary Broker A\nAddress / Routing / Queue]
        L2[Primary Broker B\nAddress / Routing / Queue]
        L1 <-->|Cluster Connection\n负载均衡与转发| L2
        L1 --- J1[Journal / Paging / Large Messages]
        L2 --- J2[Journal / Paging / Large Messages]
    end

    subgraph H[HA：每个 Primary 的 Backup]
        B1[Backup A]
        B2[Backup B]
        L1 -->|Replication| B1
        L2 -->|Replication| B2
    end

    Q[Quorum Coordination\n防止双端同时激活] -. 激活权 .-> L1
    Q -. 激活权 .-> B1
    Q -. 激活权 .-> L2
    Q -. 激活权 .-> B2
    SS[Shared Store\nReplication 的替代 HA 方案] -. Primary 与 Backup 共用 .-> H
```

下面以订单事件从 Address **orders** 路由到 Queue **inventory.q** 为例。

### 生产消息的过程

1. Producer 通过 AMQP 或 JMS 连接一个 Active Broker。
2. Broker 根据 Address 和 Routing Type 把消息路由到 inventory.q。
3. Broker 把消息写入 Journal；消息过多时可能进入 Paging，大消息使用独立存储。
4. 使用 Replication HA 时，Primary 按配置同步给 Backup 后向 Producer 确认。

Cluster Connection 负责 Broker 之间的路由与负载分布；Backup 负责某个 Primary 故障后的接管，两者不是同一件事。

### 消费消息的过程

1. inventory.q 把消息投递给一个 Consumer。
2. Consumer 完成库存事务后发送 ACK。
3. Broker 记录确认并结束这条 Queue 消息的待处理状态。
4. Consumer 故障或未 ACK 时，消息可以重新投递；超过策略限制后可以进入死信地址。

Producer 确认和 Consumer ACK 是两次独立的责任转移，后文再解释持久化与 HA 边界。

生产部署通常由多个 Primary-Backup 对组成集群。Cluster Connection 负责横向路由，Backup 负责单个 Broker 的状态接管，Quorum Coordination 负责防止脑裂；部署了 Cluster 并不等于消息已经拥有 HA 副本。

## 2. 分区与顺序

Artemis 没有 Kafka 式 Partition。横向分片通常通过多个 Queue、地址路由、集群负载均衡或 Federation 完成。消息在一个 Queue 内按入队顺序投递，但优先级、多个 Consumer、事务回滚和重新投递会改变完成顺序。

需要按业务 Key 保序时使用 Message Group：JMS 设置 `JMSXGroupID`，Core API 设置 `_AMQ_GROUP_ID`。同组消息固定给同一个 Consumer，Consumer 故障后再转交其他 Consumer。

Message Group 的顺序与横向扩展天然冲突。Clustered Grouping 需要集群级 Grouping Handler 协调，而且官方不推荐把它作为大规模扩展方案。更稳妥的方式是预先按业务 Key 路由到固定 Queue，再在单 Queue 内分组或串行消费。

## 5. 适用边界

Artemis 适合依赖 JMS、AMQP、MQTT、STOMP、事务与传统企业集成的系统。若核心需求是海量分区日志、长期回放和流计算生态，应优先比较 Kafka 或 Pulsar。

## 6. 参考资料

- [ActiveMQ Artemis Documentation](https://activemq.apache.org/components/artemis/documentation/latest/)
- [ActiveMQ Artemis High Availability and Failover](https://activemq.apache.org/components/artemis/documentation/latest/ha.html)
- [ActiveMQ Artemis Guarantees of Sends and Commits](https://activemq.apache.org/components/artemis/documentation/latest/send-guarantees.html)
- [ActiveMQ Artemis Duplicate Detection](https://activemq.apache.org/components/artemis/documentation/latest/duplicate-detection.html)
- [ActiveMQ Artemis Message Grouping](https://activemq.apache.org/components/artemis/documentation/latest/message-grouping.html)
- [ActiveMQ Artemis Clusters](https://activemq.apache.org/components/artemis/documentation/latest/clusters.html)
- [Artemis ReplicationManager Source](https://github.com/apache/artemis/blob/main/artemis-server/src/main/java/org/apache/activemq/artemis/core/replication/ReplicationManager.java)
