---
title: 2 Kafka 入门
date: 2020-04-02
categories:
    - 存储
tags:
    - Kafka
---
在深入学习 Kafka 之前，本节我们先对 Kafka 里面的基础概念、安装使用做一个基本介绍。
<!-- more -->



## 1. 基本概念
### 1.1 Kafka 体系架构
![Kafka体系架构](/images/kafka/kafka_structure.jpg)

Kafka 体系结构中有下面这些基础概念:
1. Producer: 生产者，负责将消息发送到特定的主题
2. Consumer: 消费者，负责订阅主题并进行消费
3. Broker: 服务代理点
4. Topic: 主题，Kafka中的消息以主题为单位进行归类
5. Partition: 
    - 主题是一个逻辑上的概念，其可以划分成多个分区
    - 区在存储层面可以看作一个可追加的日志（Log）文件
6. offset: 
    - 消息偏移量，消息在被追加到分区日志文件的时候都会分配一个特定的偏移量
    - offset是消息在分区中的唯一标识，Kafka通过它来保证消息在分区内的顺序性
    - offset并不跨越分区，也就是说，Kafka保证的是分区有序而不是主题有序

Kafka 是多分区的，并采用**一主多从**的复制方案，leader 副本负责处理读写请求，follower 副本**主负责与 leader副本保持同步**，并通过 Zookeeper 进行 leader 选举和元数据的保存。

消息消费使用 Pull 模式，服务器端会保存消费的具体位置，当消费者宕机后恢复上线时可以根据之前保存的消费位置重新拉取需要的消息进行消费。

### 1.2 分区、偏移量
分区中的所有副本统称为 AR(Assigned Replicas)，所有与leader副本保持一定程度同步的副本（包括leader副本在内）组成ISR（In-Sync Replicas)。复制存在延迟，所以**一定程度的同步**是指可忍受的复制滞后范围，这个范围可以通过参数进行配置。与leader副本同步滞后过多的副本（不包括leader副本）组成OSR（Out-of-Sync Replicas）。leader 副本负责跟踪所有副本的滞后状态，从而根据它们状态更新它们的 ISR 和 OSR 归属。默认情况下，当leader副本发生故障时，只有在ISR集合中的副本才有资格被选举为新的leader。

ISR与HW和LEO也有紧密的关系:
1. HW(High Watermark)，俗称高水位，它标识了一个特定的消息偏移量（offset），消费者只能拉取到**这个offset之前**的消息。
2. LEO(Log End Offset)，它标识当前日志文件中下一条待写入消息的offset，等于最后一条消息的 offset 加一

![分区各种偏移量说明](/images/kafka/hw_leo.jpg)

分区ISR集合中的每个副本都会维护自身的LEO，而**ISR集合中最小的LEO即为分区的HW**。消费者而言只能消费HW之前的消息。

由此可见，Kafka 的复制机制既不是完全的同步复制，也不是单纯的异步复制。而是类似于半同步，即在 ISR 集合执行同步复制，OSR 集合执行异步复制。Kafka使用这种ISR的方式有效地权衡了数据可靠性和性能之间的关系。

## 2. Kafka 安装配置

## 3. 生产与消费

## 4. 服务器端参数配置
我们挑选一些重要的服务端参数来做细致的说明，这些参数都配置在`$KAFKA_HOME/config/server.properties`文件中。
1. zookeeper.connect
    - 作用: 指明broker要连接的ZooKeeper集群的服务地址（包含端口号）
    - 默认: 没有默认值，必填
    - 格式: `localhost1:2181，localhost2:2181，localhost3:2181/kafka` 进行多节点配置，`/kafka` 指定了 chroot 路径
    - 说明:最佳的实践方式是增加chroot路径，可以明确指明该chroot路径下的节点是为Kafka所用的，也可以实现多个Kafka集群复用一套ZooKeeper集群
2. listeners:
    - 作用: 指明broker监听客户端连接的地址列表
    - 默认: 默认值为 null
    - 格式: 
        - `protocol1://hostname1:port1, protocol2://hostname2:port2`
        - protocol代表协议类型，当前支持 PLAINTEXT、SSL、SASL_SSL等
        - 未开启安全认证，则使用简单的PLAINTEXT即可
3. advertised.listeners
    - 作用: 
        - listeners 的关联配置主要用于 IaaS（Infrastructure as a Service）环境
        - advertised.listeners参数绑定公网IP供外部客户端使用
        - listeners参数来绑定私网IP地址供broker间通信使用
4. broker.id
    - 作用: 指定Kafka集群中broker的唯一标识
    - 默认: 默认值为 -1，如果没有设置，那么Kafka会自动生成一个
5. log.dir和log.dirs
    - 作用: 
        - 来配置 Kafka 日志文件存放的根目录
        - 都可以用来配置单个或多个根目录
        - log.dirs 的优先级比 log.dir 高
    - 默认: 只配置了 log.dir 参数，其默认值为/tmp/kafka-logs
6. message.max.bytes
    - 作用: 指定broker所能接收消息的最大值
    - 默认: 默认值为1000012（B），约等于976.6KB
    - 说明:
        - 如果 Producer 发送的消息大于这个参数所设置的值，那么（Producer）就会报出RecordTooLargeException的异常
        - 如果需要修改这个参数，那么还要考虑`max.request.size` （客户端参数）、`max.message.bytes`（topic端参数）等参数的影响
        - 为了避免修改此参数而引起级联的影响，建议在修改此参数之前考虑分拆消息的可行性

其他配置参数需要结合 Kafka 的原理进行解释，后续会慢慢介绍。