---
weight: 14
title: "Redis Streams（二）：存储、主从复制与故障恢复"
date: 2026-09-06T14:00:00+08:00
lastmod: 2026-09-07T14:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "理解 Redis Streams 集群分片、Consumer Group 顺序、主从复制和故障恢复"
featuredImage:

tags: ["message-queue", "redis", "redis-streams"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---



## 3. 多副本一致性

Redis Open Source 主从复制默认异步：Master 执行写入并响应客户端，同时把命令流发送给 Replica。Replica 可能落后，故障切换时最近的已确认写入仍可能丢失。

`WAIT` 可以等待指定数量 Replica 确认接收，显著降低丢失概率，但官方明确说明它不会把 Redis 变成强一致 CP 系统。`WAITAOF` 还能等待本地/副本 AOF 刷盘，但可用性、延迟和客户端超时需要单独设计。

Redis Cluster 使用 Gossip、故障投票和 Config Epoch 决定 Slot 所属 Master；它不对每条 Stream Entry 执行多数派共识。若业务要求“已确认消息在任意单节点故障后绝不丢”，应慎重选择 Redis Streams。

## 4. 故障修复与 Resharding

### 4.1 临界故障时间线

Redis 正是问题中“主节点已响应，但消息尚未同步到从节点”的典型案例：

1. Client 对 Master A 执行 `XADD`。
2. A 在内存中修改 Stream，并立即返回 Entry ID；默认不会等待 Replica B。
3. A 还没把该命令传播给 B 就故障；Sentinel/Cluster 把 B 提升为新 Master。
4. Client 已经收到成功，但 B 没有这条 Entry，因此消息永久丢失。
5. A 恢复后不能把自己的 Entry 合并进 B。它会被配置为 B 的 Replica，通过 PSYNC 或全量同步接受 B 的历史；A 独有的消息被覆盖，不会自动“补回”新 Master。

`min-replicas-to-write` 只检查最近有多少 Replica 的延迟没有超过阈值，不会等待每一次 `XADD` 到达 Replica，因此仍有丢失窗口。客户端可在同一连接上执行 `XADD` 后调用 `WAIT 1 timeout`，等待一个 Replica 确认收到此前写入；Redis 7.2+ 的 `WAITAOF` 还可等待 AOF 持久化。它们显著降低风险，但官方明确说明 Redis 仍不是强一致 CP 系统，复杂 Failover 中已确认写入仍可能丢失。

另一个窗口是 `XADD` 已复制但响应丢失：Client 不知道消息是否存在。自动生成的 Stream ID 使盲目重试容易产生第二条 Entry；关键消息应携带业务事件 ID，并由消费者用唯一键幂等。若必须从生产端去重，可使用固定、单调 Stream ID 或额外去重键/Lua，但要处理 ID 约束、原子性和过期策略。

复制链路短暂中断后优先执行 PSYNC：Replica 根据 Replication ID 和 Offset 请求缺失命令。若 Backlog 已覆盖不到缺口，则执行全量同步：Master 生成 RDB、传给 Replica，再发送期间积累的命令。

Master 故障时，Sentinel 或 Cluster 选一个 Replica 提升为新 Master，其他 Replica 改为跟随它，客户端刷新拓扑。旧 Master 恢复后作为 Replica 全量或部分同步，不能直接恢复为 Master 接受旧数据上的写入。

Cluster 扩缩容是迁移 Hash Slot 中的 Key。迁移一个 Stream Key 时整个 Key 迁走，不会把其内部 Entry 拆开。在线 Resharding 期间客户端必须正确处理 `MOVED/ASK`，并避免把高流量大 Stream 当成容易迁移的小 Key。

Cluster 的 Replica Migration 可把富余 Replica 自动迁给没有副本的 Master，提高后续故障容忍度，但它不复制新的数据分片，也不代替备份。

## 6. 参考资料

- [Redis Streams](https://redis.io/docs/latest/develop/data-types/streams/)
- [Redis Replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/)
- [Redis WAIT](https://redis.io/docs/latest/commands/wait/)
- [Redis WAITAOF](https://redis.io/docs/latest/commands/waitaof/)
- [Scale with Redis Cluster](https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/)
- [Redis Cluster Specification](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/)
- [Redis Sentinel](https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/)
