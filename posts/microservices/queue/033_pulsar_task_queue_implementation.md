---
weight: 33
title: "Apache Pulsar（三）：任务队列、Ack 与故障恢复"
date: 2026-09-08T15:00:00+08:00
lastmod: 2026-09-08T15:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "沿 Shared Subscription、Managed Cursor 与 Ack 状态，理解 Pulsar 任务队列的投递和故障恢复"
featuredImage:

tags: ["message-queue", "pulsar"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

[第一篇](031_pulsar.md)已经说明订单履约任务的生产和消费路径，[消息队列实现篇](032_pulsar_message_queue_implementation.md)说明了 Managed Ledger 与 BookKeeper 的存储和复制。本文只讨论任务如何交给 Worker、Ack 如何推进 Cursor，以及故障后为什么可能重复投递。

<!-- more -->

## 1. Subscription Cursor、Ack 与故障恢复

第一篇的 `fulfill-workers` 并不是 Owner Broker 内存中的一个简单 Offset。Managed Cursor 至少需要表达：

- Mark-delete Position：此前连续确认完成的位置；
- Individual Deleted Ranges：Mark-delete 之后已经单独 Ack 的洞；
- Subscription Properties 和持久标识；
- 当前 Dispatcher、Consumer、Permit 和 Unacked 运行状态。

持久 Cursor 由 Managed Ledger 子系统管理。Cursor 名称和元数据通过 Metadata Store 发现，频繁变化的 Cursor 状态可以写入 BookKeeper 的 Cursor Ledger；在失败或特定配置路径下也可能回写 Metadata Store。关键结论是：Owner Broker 故障后，Cursor 能从持久存储恢复，不依赖客户端上报一个猜测位置。

### 1.1 连续 Ack 与乱序 Ack

假设 Entry 0～10 已投递：

```text
0..7 已连续 Ack
8 尚未 Ack
9、10 已 Ack

Mark-delete = 7
Individual Ack Holes = {9, 10}
```

因为 8 仍未完成，Mark-delete 不能直接推进到 10。Shared/Key_Shared 允许多个 Consumer 并行处理，Cursor 必须同时保存连续前缀与后面的 Ack 洞。

乱序未确认范围过多会增加 Cursor 元数据、恢复和重投成本。不能只监控 Backlog 总数，还要观察 Unacked、Redelivery 和 Ack Hole。

### 1.2 Owner Broker 在 Ack 前故障

1. Consumer 已收到消息，业务可能正在处理；
2. Ack 尚未成为持久 Cursor 状态，Owner Broker 故障；
3. 新 Broker 获得 Topic 所有权；
4. 新 Owner 加载 Managed Ledger 与 Cursor；
5. 未被持久确认的消息重新投递。

如果业务数据库已经提交，这次重投会产生重复。因此 Subscription 恢复提供的是至少一次，而不是跨数据库精确一次。

### 1.3 Ack 已持久化，但响应丢失

消息可能已经从 Cursor 的未确认范围中移除，但 Consumer 没收到 Ack 结果。客户端不能靠超时判断服务端最终状态。若消息再次出现，业务幂等处理；若没有再次出现，也不能由 Consumer 主动跳过一个更大的未知区间。

### 1.4 不同 Subscription 互不推进

`warehouse`、`risk`、`analytics` 各有自己的 Managed Cursor。最慢 Subscription 决定其 Backlog 保留压力；一个 Subscription Ack 不会修改另一个 Cursor。

Retention 与 Backlog Quota 仍可能删除或限制积压。Cursor 表示消费位置，不等于永远钉住所有历史数据。

## 2. 实现结论

- Managed Cursor 会持久化 Mark-delete 与 Ack 洞，但不能把外部业务事务变成精确一次。

## 3. 参考资料

- [Apache Pulsar 4.2 Architecture Overview](https://pulsar.apache.org/docs/4.2.x/concepts-architecture-overview/)
- [Apache Pulsar 4.2 Messaging Concepts](https://pulsar.apache.org/docs/4.2.x/concepts-messaging/)
- [Pulsar Consumer API and Key_Shared Batching](https://pulsar.apache.org/docs/4.2.x/client-libraries-consumers/)
