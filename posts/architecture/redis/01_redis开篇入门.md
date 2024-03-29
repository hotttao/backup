---
title: 1. redis 开篇入门
date: 2020-05-01
categories:
    - 存储
tags:
    - Kafka
---

《Redis深度历险：核心原理与应用实践》 读书笔记

<!-- more -->

## 1. 写在开始
Redis 不言而喻，必知必会系列，现在太多的应用都要依赖 Redis。市面上 Redis 书很多，图文并茂又不啰嗦的就是这本 [《Redis深度历险：核心原理与应用实践》](https://book.douban.com/subject/30386804/)了。

## 2. 本书结构
本书将 Redis 的内容分成了如下几个模块:
1. 基础和应用篇: Redis 提供的数据结构和基于此实现的功能，包括:
    - Redis 基础数据结构
    - 分布式锁的实现
    - 延时队列的实现
    - 位图
    - HyperLogLog: 做不精确统计用的
    - 布隆过滤器
    - 限流
    - GeoHash: 找附近的人
    - scan: 字典扫描
2. 原理篇: IO模型、网络协议、持久化和事务、消息的发布和订阅
3. 集群篇: Redis 的三种集群模式
    - Sentinel
    - Codis
    - Cluster
4. 拓展篇: 基于 Redis 的扩展应用，或者叫高级应用
    - Stream 消息流
    - Info 指令，Redis 的监测
    - 分布式锁的实现
    - Redis 的惰性删除
    - Redis 的加密
5. 源码篇: Redis 各种数据结构的实现
    - 字符串
    - dict
    - 压缩列表
    - 快速列表
    - 跳表
    - 基数树
    - LFU 和 LRU
    - 惰性删除
    - 字段遍历


## 3. 资源收录
除了本书，目前还没找到其他好的 Kafka 学习资源，跟自己没有深度使用过有关。不过建议在看本书之前看看 [《数据密集型应用系统设计》](https://book.douban.com/subject/30329536/)。相信你会对本书所说的内容有更加深刻的理解。
