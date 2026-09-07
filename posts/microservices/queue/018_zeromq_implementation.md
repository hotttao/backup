---
weight: 18
title: "ZeroMQ（二）：传输边界、可靠性与故障处理"
date: 2026-09-07T16:00:00+08:00
lastmod: 2026-09-07T16:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "从第一性原理理解 ZeroMQ 的通信架构、顺序、缓冲和可靠性边界"
featuredImage:

tags: ["message-queue", "zeromq"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---



## 3. 多副本与提交语义

ZeroMQ 没有内置消息副本、一致性协议和“消息已提交”的统一概念。一次 `send` 成功通常只说明消息已被本地通信栈接受，不说明对端已经收到、持久化或完成业务处理，也不说明另一个节点拥有可接管副本。

若需要这些保证，应用必须自行增加消息 ID、确认、超时、重试、幂等、持久日志和主备协议。做到这一步时，团队实际上正在构建自己的消息系统。

## 4. 临界故障

假设进程 A 向进程 B 发送消息 M：

1. A 的 `send` 把 M 放入本地 ZeroMQ 队列；
2. A 随即崩溃，而 M 尚未到达 B；
3. 内存队列随进程消失，M 丢失；
4. 即使 B 已经收到 M，A 在没有业务确认协议时也无法区分成功与失败；
5. A 重试可能让 B 再次处理 M。

自动重连只能恢复连接，不能恢复已经消失的消息和业务状态。要可靠处理，必须在应用层定义请求 ID、响应、超时、重试、幂等和状态恢复；需要离线积压时还要引入磁盘日志或外部持久队列。

旧节点恢复后也不存在内置的“追主日志”过程。主备选举、状态同步和脑裂防护完全取决于应用采用的协议。

## 6. 参考资料

- [ZeroMQ Guide：Sockets and Patterns](https://zguide.zeromq.org/docs/chapter2/)
- [ZeroMQ Guide：Reliable Request-Reply Patterns](https://zguide.zeromq.org/docs/chapter4/)
- [ZeroMQ Guide：Advanced Pub-Sub Patterns](https://zguide.zeromq.org/docs/chapter5/)
- [ZeroMQ RFC 18：Majordomo Protocol](https://rfc.zeromq.org/spec/18/)
