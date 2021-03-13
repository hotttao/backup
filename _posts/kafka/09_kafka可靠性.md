---
title: 9 Kafka 可靠性
date: 2020-04-09
categories:
    - 存储
tags:
    - Kafka
---

Kafka 如何保证数据一致性

<!-- more -->


## 1. Kafka 可靠性概述
Kafka 采用主从复制的复制方案，这就引出一系列问题：Kafka 多副本之间如何进行数据同步，尤其是在发生异常时候的处理机制又是什么？多副本间的数据一致性如何解决，基于的一致性协议又是什么？如何确保 Kafka 的可靠性？Kafka 中的可靠性和可用性之间的关系又如何？

接下来我们就从副本的角度切入来深挖Kafka中的数据一致性、数据可靠性等问题，主要包括:
1. 副本剖析
2. 日志同步机制
3. 可靠性分析

## 2. 副本剖析

### 2.1 失效副本
在ISR集合之外，也就是处于 **同步失效** 或 **功能失效** （比如副本处于非存活状态）的副本统称为失效副本，失效副本对应的分区也就称为同步失效分区，即under-replicated分区。

通过kafka-topics.sh脚本的`under-replicated-partitions`参数我们可以查看主题中的失效副本:

```bash
bin/kafka-topics.sh \
    --zookeeper localhost:2181/kafka \
    --describe \
    --topic topic_partition \
    --under-replicated-partitions
```

#### 同步失效
失效副本不仅是指处于功能失效状态的副本，处于同步失效状态的副本也可以看作失效副本。

怎么判定一个分区是否有副本处于同步失效的状态呢？:
1. 唯一的broker端参数`replica.lag.time.max.ms`可以配置一个最大的同步超时时间
2. 当ISR集合中的一个 follower 副本滞后leader副本的时间超过此参数指定的值时则判定为同步失败，需要将此follower副本剔除出ISR集合
3. replica.lag.time.max.ms参数的默认值为10000

![副本失效判断](/images/kafka/lose_replicate.png)

具体的实现原理如下:
1. 当follower副本将leader副本LEO（LogEndOffset）之前的日志全部同步时，则认为该 follower 副本已经追赶上 leader 副本，此时更新该副本的lastCaughtUpTimeMs 标识
2. Kafka 的副本管理器会启动一个副本过期检测的定时任务，而这个定时任务会定时检查当前时间与副本的 lastCaughtUpTimeMs 差值是否大于参数replica.lag.time.max.ms 指定的值。
3. 千万不要错误地认为 follower 副本只要拉取 leader副本的数据就会更新 lastCaughtUpTimeMs。试想一下，当 leader 副本中消息的流入速度大于follower 副本中拉取的速度时，就算 follower 副本一直不断地拉取 leader 副本的消息也不能与leader副本同步。此时副本也会从 ISR 集合中剔除。

一般有一下情况会导致副本失效：
1. follower副本进程卡住，在一段时间内根本没有向leader副本发起同步请求，比如频繁的Full GC。
2. follower副本进程同步过慢，在一段时间内都无法追赶上leader副本，比如I/O开销过大
3. 如果通过工具增加了副本因子，那么新增加的副本在赶上leader副本之前也都是处于失效状态的。
4. 如果一个follower副本由于某些原因（比如宕机）而下线，之后又上线，在追赶上leader副本之前也处于失效状态。

同步失效分区是kafka 健康监测的一个重要指标。

### 2.2 ISR 伸缩
Kafka 在启动的时候会开启两个与 ISR 相关的定时任务：
1. isr-expiration: 周期性地检测每个分区是否需要缩减其ISR集合
2. isr-change-propagation: 广播 ISR 的变更


#### isr-expiration
- 周期和`replica.lag.time.max.ms`参数有关，大小是这个参数值的一半
- 当检测到ISR集合中有失效副本时，就会收缩ISR集合
- 如果某个分区的ISR集合发生变更，则会将变更后的数据记录到 ZooKeeper 对应的`/brokers/topics/＜topic＞/partition/＜parititon＞/state`节点中，内容为 `{"controller_epoch": 26, "leader": 0, "version": 1, "leader_epoch": 2,"isr": [0,1]}`
    - controller_epoch表示当前Kafka控制器的epoch
    - leader表示当前分区的leader副本所在的broker的id编号
    - version表示版本号（当前版本固定为1）
    - leader_epoch表示当前分区的leader纪元
    - isr表示变更后的ISR列表

#### isr-change-propagation
- 当 ISR 集合发生变更时还会将变更后的记录缓存到 isrChangeSet 中
- isr-change-propagation任务会周期性（固定值为 2500ms）地检查 isrChangeSet，如果发现isrChangeSet中有ISR集合的变更记录，那么它会在ZooKeeper的`/isr_change_notification`路径下创建一个以 isr_change_开头的持久顺序节点（比如`/isr_change_notification/isr_change_0000000000`），并将isrChangeSet中的信息保存到这个节点中
- Kafka控制器为/isr_change_notification添加了一个Watcher，当这个节点中有子节点发生变化时会触发Watcher的动作，以此通知控制器更新相关元数据信息并向它管理的broker节点发送更新元数据的请求，最后删除/isr_change_notification路径下已经处理过的节点
- 频繁地触发Watcher会影响Kafka控制器、ZooKeeper甚至其他broker节点的性能。为了避免这种情况，Kafka添加了限定条件，当检测到分区的ISR集合发生变化时，还需要检查以下两个条件：
    1. 上一次ISR集合发生变化距离现在已经超过5s
    2. 上一次写入ZooKeeper的时间距离现在已经超过60s
- 只有满足以上两个条件之一才可以将ISR集合的变化写入目标节点

#### isr 扩大
follower 副本追赶上leader副本的判定准则是`此副本的LEO是否不小于leader副本的HW`，注意这里并不是和leader副本的LEO相比。

ISR扩充之后同样会更新ZooKeeper中的`/brokers/topics/＜topic＞/partition/＜parititon＞/state`节点和isrChangeSet，之后的步骤就和ISR收缩时的相同。

#### HW 更新
当ISR集合发生增减时，或者ISR集合中任一副本的LEO发生变化时，都可能会影响整个分区的HW。

### 2.2 LEO 与 HW
#### 消息同步过程

![本地副本](/images/kafka/local_replicate.png)

如上图所示某个分区有3个副本分别位于broker0、broker1和broker2节点中，其中带阴影的方框表示本地副本(指代 broker 实际保存的副本)。假设broker0上的副本1为当前分区的leader副本，那么副本2和副本3就是follower副本，整个消息追加的过程可以概括如下：
1. 生产者客户端发送消息至leader副本（副本1）中
2. 消息被追加到leader副本的本地日志，并且会更新日志的偏移量
3. follower副本（副本2和副本3）向leader副本请求同步数据
4. leader副本所在的服务器读取本地日志，并更新对应拉取的follower副本的信息
5. leader副本所在的服务器将拉取结果返回给follower副本
6. follower副本收到leader副本返回的拉取结果，将消息追加到本地日志中，并更新日志的偏移量信息

#### follower 拉取消息
follower副本向leader副本拉取消息，在拉取的请求中会带有自身的LEO信息，这个LEO信息对应的是FetchRequest请求中的fetch_offset。leader副本返回给follower副本相应的消息，并且还带有自身的HW信息。这个HW信息对应的是FetchResponse中的high_watermark。

follower副本拉取到了消息后，更新各自的LEO。与此同时，还会更新自己的HW，更新HW的算法是比较**当前LEO**和leader副本中传送过来的HW的值，取较小值作为自己的HW值。

#### leader 收到 follower 拉取消息请求
leader副本收到来自follower副本的FetchRequest请求，其中带有LEO的相关信息，选取其中的最小值作为新的HW。

在一个分区中:
1. leader副本所在的节点会记录所有副本的LEO，
2. follower副本所在的节点只会记录自身的LEO
3. 对HW而言，各个副本所在的节点都只记录它自身的HW

leader 副本收到 follower副本的FetchRequest请求之后，它首先会从自己的日志文件中读取数据，然后在返回给follower副本数据前先更新follower副本的LEO。

![LEO 和 HW 的保存](/images/kafka/leo_save.png)

### 2.3 LEO 和 HW 持久化
Kafka 的根目录下有 cleaner-offset-checkpoint、log-start-offset-checkpoint、recovery-point-offset-checkpoint和replication-offset-checkpoint四个检查点文件。

日志存储部门我们介绍了，`cleaner-offset-checkpoint` 就是清理检查点文件，用来记录每个主题的**每个分区中已清理的偏移量**。

而其他几个检查点文件与 LEO 和 HW 有关:
1. recovery-point-offset-checkpoint
    - 对应 LEO
    - Kafka 中会有一个定时任务负责将所有分区的 LEO 刷写到恢复点文件 `recovery-point-offset-checkpoint` 中
    - 定时周期由 broker 端参数 `log.flush.offset.checkpoint.interval.ms`来配置，默认值为60000
2. replication-offset-checkpoint:
    - 对应 HW
    - 另一个定时任务负责将所有分区的HW刷写到复制点文件replication-offset-checkpoint中
    - 定时周期由broker端参数`replica.high.watermark.checkpoint.interval.ms`来配置，默认值为5000
3. log-start-offset-checkpoint
    - 对应logStartOffset，用来标识日志的起始偏移量
    - 各个副本在变动 LEO 和 HW 的过程中，logStartOffset 也有可能随之而动
    - Kafka 也有一个定时任务来负责将所有分区的 logStartOffset书写到起始点文件log-start-offset-checkpoint中
    - 定时周期由broker端参数log.flush.start.offset.checkpoint.interval.ms来配置，默认值为60000

### 2.4 Leader Epoch(非常重要)
前面是正常情况下的leader副本与follower副本之间的同步过程，如果leader副本发生切换，那么同步过程又该如何处理呢？如果处理不当会出现数据丢失和数据不一致问题。

#### 数据丢失
首先我们来看数据丢失问题。

#### 数据不一致问题

#### Leader Epoch
为了解决上述两种问题，Kafka引入了leader epoch的概念，在需要截断数据的时候使用leader epoch作为参考依据而不是原本的HW。

leader epoch代表leader的纪元信息（epoch），初始值为0。每当leader变更一次，leader epoch的值就会加1，相当于为leader增设了一个版本号。

与此同时，每个副本中还会增设一个矢量`＜LeaderEpoch=＞StartOffset＞`，其中StartOffset表示当前LeaderEpoch下写入的第一条消息的偏移量。每个副本的Log下都有一个`leader-epoch-checkpoint`文件，在发生leader epoch变更时，会将对应的矢量对追加到这个文件中。

我们再来看一下引入 leader epoch 之后如何应付前面所说的数据丢失和数据不一致的场景。

**我的理解是，这里的 Leader Epoch 相当于 Lamport 时间戳，用于确保全序关系**

### 2.5 Kafka 为什么不支持读写分离(非常重要)
在Kafka中，生产者写入消息、消费者读取消息的操作都是与leader副本进行交互的，从而实现的是一种主写主读的生产消费模型。

Kafka并不支持主写从读，这是为什么呢？对于这个问题，我们可以从“收益点”这个角度来做具体分析。

主写从读可以让从节点去分担主节点的负载压力，预防主节点负载过重而从节点却空闲的情况发生。但是主写从读需要解决主从复制延迟带来的问题: 
1. 如何解决主从同步过程中，从节点读取到旧消息的问题。
2. 并且在Kafka中，主从同步会比 Redis 更加耗时，它需要经历**网络→主节点内存→主节点磁盘→网络→从节点内存→从节点磁盘**这几个阶段

另一方面，读写分离要实现的负载均衡，通过分区和kafka 生产消费模型同样可以达到。所以没有必要去实现额外的读写分离。

当然前面的结论成立的前提是，不存在巨大的扇出(分区数据不均衡)。

有以下几种情况（包含但不仅限于）会造成一定程度上的负载不均衡：
1. broker端的分区分配不均。当创建主题的时候可能会出现某些broker分配到的分区数多而其他broker分配到的分区数少，那么自然而然地分配到的leader副本也就不均
2. 生产者写入消息不均。生产者可能只对某些broker中的leader副本进行大量的写入操作，而对其他broker中的leader副本不闻不问
3. 消费者消费消息不均。消费者可能只对某些broker中的leader副本进行大量的拉取操作，而对其他broker中的leader副本不闻不问。
4. leader副本的切换不均。在实际应用中可能会由于broker宕机而造成主从副本的切换，或者分区副本的重分配等，这些动作都有可能造成各个broker中leader副本的分配不均

总的来说，Kafka 只支持主写主读有几个优点：**可以简化代码的实现逻辑，减少出错的可能；将负载粒度细化均摊，与主写从读相比，不仅负载效能更好，而且对用户可控;没有延时的影响；在副本稳定的情况下，不会出现数据不一致的情况**。

## 3. 日志同步机制
在分布式系统中，日志同步机制既要保证数据的一致性，也要保证数据的顺序性。虽然有许多方式可以实现这些功能，但最简单高效的方式还是从集群中**选出一个leader来负责处理数据写入的顺序性**。于此同时需要解决的是 leader 选举问题，必须确保选择具有最新日志消息的follower作为新的leader。

日志同步机制的一个基本原则就是：如果告知客户端已经成功提交了某条消息，那么即使 leader宕机，也要保证新选举出来的leader中能够包含这条消息。这里就有一个需要权衡（tradeoff）的地方，如果leader在消息被提交前需要等待更多的follower确认，那么在它宕机之后就可以有更多的follower替代它，不过这也会造成性能的下降。

在Kafka中动态维护着一个ISR集合，处于ISR集合内的节点保持与leader相同的高水位（HW），只有位列其中的副本（unclean.leader.election.enable配置为false）才有资格被选为新的 leader。写入消息时只有等到所有 ISR 集合中的副本都确认收到之后才能被认为已经提交。位于 ISR 中的任何副本节点都有资格成为 leader，选举过程简单、开销低。Kafka中包含大量的分区，leader副本的均衡保障了整体负载的均衡，所以这一因素也极大地影响Kafka的性能指标。

另外，一般的同步策略依赖于稳定的存储系统来做数据恢复，也就是说，在数据恢复时日志文件不可丢失且不能有数据上的冲突。不过它们忽视了两个问题：首先，磁盘故障是会经常发生的，在持久化数据的过程中并不能完全保证数据的完整性；其次，即使不存在硬件级别的故障，我们也不希望在每次写入数据时执行同步刷盘（fsync）的动作来保证数据的完整性，这样会极大地影响性能。而 Kafka 不需要宕机节点必须从本地数据日志中进行恢复，Kafka 的同步方式允许宕机副本重新加入ISR集合，但在进入ISR之前必须保证自己能够重新同步完leader中的所有数据。

## 4. 可靠性分析(非常重要)
前提: 只考虑Kafka本身使用方式的前提下如何最大程度地提高可靠性。

就Kafka而言，越多的副本数越能够保证数据的可靠性，一般而言，设置副本数为3即可满足绝大多数场景对可靠性的要求，更高的可靠性要求可以将副本数设置为 5。与此同时，如果能够在分配分区副本的时候引入基架信息（broker.rack 参数），那么还要应对机架整体宕机的风险。

仅依靠副本数来支撑可靠性是远远不够的，大多数人还会想到生产者客户端参数 acks。

### 4.1 ack参数配置
#### ack=1
对于acks=1的配置，生产者将消息发送到leader副本，leader副本在成功写入本地日志之后会告知生产者已经成功提交。如果此时ISR集合的follower副本还没来得及拉取到leader中新写入的消息，leader就宕机了，那么此次发送的消息就会丢失。

![ack=1数据丢失的情况](/images/kafka/ack_1.png)

#### ack=-1
对于ack=-1的配置，生产者将消息发送到leader副本，leader副本在成功写入本地日志之后还要等待 ISR 中的 follower 副本全部同步完成才能够告知生产者已经成功提交，即使此时leader副本宕机，消息也不会丢失

![ack=-1可避免数据丢失](/images/kafka/ack_-1.png)

同样对于acks=-1的配置，如果在消息成功写入leader副本之后，并且在被ISR中的所有副本同步之前leader副本宕机了，那么生产者会收到异常以此告知此次发送失败。

### 4.2 可靠性
#### min.insync.replicas
但是 ack=-1 并不代表数据一定不会丢失。试想一下这样的情形，leader 副本的消息流入速度很快，而follower副本的同步速度很慢，在某个临界点时所有的follower副本都被剔除出了ISR集合，那么ISR中只有一个leader副本，最终acks=-1演变为acks=1的情形，如此也就加大了消息丢失的风险。

Kafka也考虑到了这种情况，并为此提供了`min.insync.replicas`参数（默认值为1）来作为辅助（配合acks=-1来使用），这个参数指定了ISR集合中最小的副本数，如果不满足条件就会抛出NotEnoughReplicasException或NotEnoughReplicasAfterAppendException。在正常的配置下，需要满足`副本数 > min.insync.replicas`参数的值。一个典型的配置方案为：副本数配置为 3，min.insync.replicas 参数值配置为 2。

注意 **min.insync.replicas参数在提升可靠性的时候会从侧面影响可用性**。试想如果ISR中只有一个leader副本，那么最起码还可以使用，而此时如果配置 min.insync.replicas＞1，则会使消息无法写入。

#### unclean.leader.election.enable
与可靠性和ISR集合有关的还有一个参数—unclean.leader.election.enable。这个参数的默认值为false，如果设置为true就意味着当leader下线时候可以从非ISR集合中选举出新的 leader，这样有可能造成数据的丢失。如果这个参数设置为 false，那么也会影响可用性，非ISR集合中的副本虽然没能及时同步所有的消息，但最起码还是存活的可用副本。

### 4.3 消息发送模式
我们讨论了消息发送的3种模式，即发后即忘、同步和异步。发后即忘的模式，生产者对消息是否写入成功一无所知，不适合高可靠性要求的场景。采用同步或异步的模式，在出现异常情况时可以及时获得通知，以便可以做相应的补救措施，比如选择重试发送（可能会引起消息重复）

#### 重试配置
对于可重试异常，客户端内部本身提供了重试机制来应对这种类型的异常，通过 `retries` 参数即可配置。默认情况下，retries参数设置为0，即不进行重试，对于高可靠性要求的场景，需要将这个值设置为大于 0 的值。

与 retries 参数相关的还有一个`retry.backoff.ms参数`，它用来设定两次重试之间的时间间隔，以此避免无效的频繁重试。在配置retries和retry.backoff.ms之前，最好先估算一下可能的异常恢复时间，这样可以设定总的重试时间大于这个异常恢复时间，以此来避免生产者过早地放弃重试。如果不知道 retries 参数应该配置为多少，则可以参考 KafkaAdminClient，在 KafkaAdminClient 中retries参数的默认值为5。

retries参数值大于0，则可能引起一些负面的影响:
1. 由于默认的max.in.flight.requests.per.connection参数值为5，这样可能会影响消息的顺序性，对此要么放弃客户端内部的重试功 能，要么将max.in.flight.requests.per.connection参数设置为1，这样也就放弃了吞吐
2. 其次，有些应用对于时延的要求很高，很多时候都是需要快速失败的，设置retries>0会增加客户端对于异常的反馈时延，如此可能会对应用造成不良的影响

### 4.4 磁盘同步
在broker端还有两个参数log.flush.interval.messages和log.flush.interval.ms，用来调整同步刷盘的策略，默认是不做控制而交由操作系统本身来进行处理。

同步刷盘是增强一个组件可靠性的有效方式，但也极其损耗性能。更好的方式是多副本机制，所以这两个参数通常不用修改。

### 4.5 消息的可靠性
对于消息的可靠性，很多人都会忽视消费端的重要性，如果一条消息成功地写入 Kafka，并且也被Kafka完好地保存，而在消费时由于某些疏忽造成没有消费到这条消息，那么对于应用来说，这条消息也是丢失的。

enable.auto.commit 参数的默认值为 true，即开启自动位移提交的功能，虽然这种方式非常简便，但它会带来重复消费和消息丢失的问题，对于高可靠性要求的应用来说显然不可取，所以需要将 enable.auto.commit 参数设置为 false 来执行手动位移提交。

在执行手动位移提交的时候也要遵循一个原则：如果消息没有被成功消费，那么就不能提交所对应的消费位移。对于高可靠要求的应用来说，宁愿重复消费也不应该因为消费异常而导致消息丢失。

有时候，由于应用解析消息的异常，可能导致部分消息一直不能够成功被消费，那么这个时候为了不影响整体消费的进度，可以将这类消息暂存到死信队列中，以便后续的故障排除。
