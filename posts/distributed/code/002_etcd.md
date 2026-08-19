---
weight: 1
title: "ETCD 选主流程"
date: 2025-01-14T9:00:00+08:00
lastmod: 2025-01-14T9:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "ETCD 选主流程"
featuredImage: 

tags: ["分布式并发原语"]
categories: ["分布式"]

lightgallery: true

toc:
  auto: false
---

# 核心：只看 etcd 存储的 Key / Value、租约绑定关系
先统一前提：
etcd concurrency 包（Mutex分布式锁、Election选主）竞争节点写入的 Key 格式完全一致：
```
{前缀}/{leaseID}-{随机串}
```
- Key：字符串路径
- Value：**节点标识字符串**（自己填，比如实例ID、hostname）
- 元数据：Key 绑定 `LeaseID`（租约，TTL控制自动删除）

> LeaseID 是 uint64 数字，**不在 key、value 字符串内存储**，属于 etcd key 的元信息（metadata），执行 `get -w json` 才能看到绑定的租约。

---

## 1、单独演示 Lease 基础（无锁，纯粹租约绑定key）
执行命令（etcdctl）
```bash
# 创建租约，TTL=10，返回 lease=7588763225986112345
etcdctl lease grant 10

# 写入key，绑定租约
etcdctl put --lease=7588763225986112345 /demo/msg "node-a"
```
### etcd 内部存储记录
```
Key:   /demo/msg
Value: node-a
Metadata:
    Lease = 7588763225986112345
    CreateRevision = 120
    ModRevision = 120
```
现象：10s租约到期，etcd 自动删除这条 KV。

> 重点：Lease 不属于 Key/Value 文本内容，是元数据！

---

## 2、etcd 分布式锁 concurrency.Mutex 场景 KV 视图
锁前缀：`/lock/job1`
假设启动两个竞争节点：nodeA、nodeB

### 步骤1：nodeA 先发起 Lock()
1. nodeA 创建租约 LeaseID=10001
2. 内部执行 Put，写入KV
```
Key:   /lock/job1/10001-3fa9bc
Value: nodeA
Meta: Lease=10001
```
3. 查询 `/lock/job1/` 下所有key，按 CreateRevision 排序
当前只有自己这条 key → **获取锁成功**

此时 etcd 全部KV：
```
/lock/job1/10001-3fa9bc  → nodeA (Lease=10001)
```

### 步骤2：nodeB 紧接着执行 Lock()
1. nodeB 创建租约 LeaseID=10002
2. 写入竞争key
```
Key:   /lock/job1/10002-8dc21f
Value: nodeB
Meta: Lease=10002
```
现在etcd两条key：
```
/lock/job1/10001-3fa9bc → nodeA  rev=50
/lock/job1/10002-8dc21f → nodeB  rev=51
```
3. 排序后最小revision是 nodeA 的key
👉 nodeB **抢锁失败**，Watch 监听前驱key `/lock/job1/10001-3fa9bc`，阻塞等待

### 分支A：nodeA 正常 Unlock()
底层执行 `DELETE /lock/job1/10001-3fa9bc`
etcd 删除该key，触发watch事件唤醒nodeB
nodeB再次查询列表，自己变成最小revision → 获取锁

最终KV只剩：
```
/lock/job1/10002-8dc21f → nodeB
```

### 分支B：nodeA 进程崩溃，不调用Unlock
后台KeepAlive流断开，租约10s到期
etcd 根据元数据 Lease=10001，自动删除 `/lock/job1/10001-3fa9bc`
效果和主动删除完全一致。

> 重要规则：
> Mutex **不会共用租约**，每个竞争者 = 独立Lease + 独立KV

---

## 3、etcd 选主 concurrency.Election KV视图
选举前缀：`/election/scheduler`
同样两个候选节点 nodeA、nodeB

### nodeA 先执行 Campaign()
创建 Lease=20001，写入KV：
```
Key:   /election/scheduler/20001-77ce44
Value: nodeA
Meta: Lease=20001
rev=100
```
查询所有key，revision最小 → **当选Leader**

nodeB执行Campaign：
Lease=20002，写入
```
Key:   /election/scheduler/20002-aa5123
Value: nodeB
rev=101
```
etcd KV集合：
```
/election/scheduler/20001-77ce44 → nodeA
/election/scheduler/20002-aa5123 → nodeB
```
nodeB监听前驱key，作为Follower待命。

# ✅【分布式锁 vs 选主：KV层面唯一差别，不是格式！】
> **KV结构一模一样！Key命名规则完全相同！**
区别只是上层业务行为：
1. Mutex（分布式锁）
业务完成主动 Delete Key（Unlock），释放资源
2. Election（选主）
当选Leader之后**正常情况下不会主动Delete Key**
持续续租Lease，永久保留这条KV；
只有调用 `Resign()` 或者进程宕机租约过期才删除key。

如果你在etcdctl watch前缀：
- 锁场景：频繁出现key新增、删除（任务跑完释放）
- 选主场景：key长期稳定存在，只有节点故障才会删除重建

---

# 4、实操命令，你可以本地直接查看真实KV
```bash
# 列出锁目录下所有key
etcdctl get /lock/job1/ --prefix

# 查看详细元数据（能看到绑定的LeaseID）
etcdctl get -w json /lock/job1/10001-3fa9bc
```
json返回样例（精简）
```json
{
  "kvs": [
    {
      "key": "L2xvY2svam9iMS8xMDAwMS0zZmE5YmM=",
      "value": "bm9kZUE=",
      "create_revision": 50,
      "lease": 10001
    }
  ]
}
```

---

# 5、高频误区澄清
1. ❌ LeaseID 写在key字符串里，用来解析归属？
key里的lease字符串只是**命名约定**！**不生效！**
真正控制自动删除的是kv元数据里的lease字段。
你随便修改key里的数字，租约绑定关系不会变化。

例子：
```
Key: /lock/job1/10001-xxx
```
字符串中的 `10001` 只是concurrency包方便调试标记，etcd**不会解析这个文本**。

2. ❌ 能不能多个竞争节点共用同一个Lease？
绝对不要！
如果nodeA、nodeB共用一条租约，租约过期时**所有人的key一起被删掉**，竞争机制直接失效。
concurrency包实现强制每个参与者新建独立租约。

3. ❌ 最小revision的key=胜利者
不管锁还是选主，判断规则统一：
`前缀下所有key按create_revision升序，第一条即为成功竞争的节点`

需要我模拟一段：Leader宕机后，etcd中KV变化全过程时序吗？