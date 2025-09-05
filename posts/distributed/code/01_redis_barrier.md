---
weight: 1
title: "Redis Barrier"
date: 2025-01-14T9:00:00+08:00
lastmod: 2025-01-14T9:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "设计实现一个基于 Redis 的屏障（Barrier）"
featuredImage: 

tags: ["分布式并发原语"]
categories: ["分布式"]

lightgallery: true

toc:
  auto: false
---

## 1. 背景
### 2.1 背景
项目上需要周期性完成一些计算任务，这些任务具有如下特点:
1. 任务相似但是独立
2. 任务执行需要读取过去 7 天的历史数据，但是只有当天数据会更新
3. 任务计算的性能要求很高，需要充分利用计算资源，尽快完成计算

为了快速完成这些任务的计算，设计了如下的分布式计算系统:
1. 因为任务集合比较固定，所以事先将任务均匀的分布到多个节点，每个节点都通过定时任务启动
2. 使用 python 多进程 + local cache，local cache 使用 sharememory 的方式缓存 6 天的历史数据
3. 之所以使用 sharememory 主要是因为 python 多进程的数据交换存在序列化和反序列化过程，在大量数据下效率很低

这样的系统简单，但是存在一个明显的缺点，就是无法容忍节点故障。因为有下游统计分析任务依赖这些计算结果，所以希望达到以下优化目标:
1. 假如系统总共有 n 个节点，可以容忍 m 个节点临时下线。m 的值由计算的时效性评估得到
2. 系统中所有可用节点，在同一计算周期内，要么全部执行、如果不满足计算要求全部不执行

这个优化需求，让我想到了 Barrier，因为我们项目上没有 etcd 组件，所以希望给予 redis 实现一个带容错的 Barrier。

## 2. Barrier
[ETCD](https://pkg.go.dev/go.etcd.io/etcd/client/v3/experimental/recipes) 提供了两种分布式屏障同步原语:
1. Barrier 用于实现一组节点协同工作，共同等待一个信号，在信号出现前节点阻塞，信号出现被阻塞的节点同时启动。
2. DoubleBarrier 计数器屏障，当参与者达到指定数量时，放行所有参与者

下面是 Golang ETCD 为这两个同步原语设计的接口:

```go
// Barrier 接口
type Barrier struct {
	// contains filtered or unexported fields
}
func (b *Barrier) Hold() error
func (b *Barrier) Release() error
func (b *Barrier) Wait() error


type DoubleBarrier struct {
	// contains filtered or unexported fields
}
func (b *DoubleBarrier) Enter() error
func (b *DoubleBarrier) Leave() error
```

## 3. RedisBarrier 设计
带节点容错的 RedisBarrier 需要满足以下要求:
1. 如果所有节点同时到达，屏障放行。
2. 如果超时后，未达到的节点数小于预定数量，屏障放行，已达到节点可运行
3. 如果超时后，未达到的节点数大于等于预定数量，屏障放行，所有节点均不可执行

设计思路如下:
1. 使用 redis stream 提供的消息队列实现节点到达通知
2. 每个节点调用 wait() 方法等待所有放行，wait 执行逻辑如下:
    - 初始化所有节点的集合
    - 将节点自己的发送到 stream 中
    - 订阅 stream，循环等待所有节点到达，每次订阅时，使用剩余的超时时间作为订阅操作的超时时间
    - 如果节点到达，从集合中移除，如果集合为空说明所有节点均已到达，放行
    - 如果超时，判断集合中失效节点数量是不是小于预设的数量，如果是，放行
    - 节点发送的消息包括自己的启动时间，每个节点会判断收到的节点在不在超时的允许范围内。这个主要是为了处理落后或者意外启动的节点往消息队列发送了自己启动的消息，对下一个周期的判断造成的影响。
    - wait 会返回哪些节点超时

代码实现如下:

```python

import redis
import json
import time
import argparse
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)

class NodeMessage:
    def __init__(self, msg_id, node, stamp):
        self.msg_id = msg_id
        self.node = node
        self.stamp = stamp


class RedisBarrier:
    def __init__(self, name, nodes, timeout=10):
        """
        :param name: barrier 名字
        :param nodes: 所有需要参与的节点名列表
        :param timeout: 每一轮 barrier 超时时间（秒）
        """
        self.REDIS = None
        self.name = name
        self.chan = f"barrier:{name}:chan"
        self.nodes = nodes
        self.timeout = timeout
        self.__open__()

    def __open__(self):
        self.REDIS = redis.StrictRedis(
                host="192.168.2.41",
                port=6379,
                db=1,
                password="infini_rag_flow",
                decode_responses=True,
            )


    def send_message(self, queue_name, node_name, timestamp=None):
        """
        向Redis Stream发送节点到达消息
        
        :param queue_name: stream名称
        :param node_name: 节点名称
        :param timestamp: 时间戳，不提供则使用当前时间
        :return: 消息ID
        """
        if timestamp is None:
            timestamp = int(time.time())
        
        try:
            # 使用XADD命令向stream添加消息
            msg_id = self.REDIS.xadd(
                name=queue_name,
                fields={
                    "node": node_name,
                    "stamp": timestamp
                }
            )
            print(f"发送消息: {node_name} -> {queue_name}, 消息ID: {msg_id}")
            return msg_id
        except Exception as e:
            print(f"发送消息失败: {e}")
            return None
    def ack_message(self, queue_name, group_name, msg_id):
        """
        确认处理完成的消息
        
        :param queue_name: stream名称
        :param group_name: 消费者组名
        :param msg_id: 消息ID
        :return: 成功确认的消息数量
        """
        try:
            count = self.REDIS.xack(queue_name, group_name, msg_id)
            print(f"ACK消息: {msg_id} -> {queue_name}:{group_name}")
            return count
        except Exception as e:
            print(f"ACK消息失败: {e}")
            return 0

    def queue_consumer(self, queue_name, group_name, consumer_name, timeout, msg_id=b">"):
        """https://redis.io/docs/latest/commands/xreadgroup/"""
        try:
            try:
                group_info = self.REDIS.xinfo_groups(queue_name)
                if not any(gi["name"] == group_name for gi in group_info):
                    self.REDIS.xgroup_create(queue_name, group_name, id="0", mkstream=True)
            except redis.exceptions.ResponseError as e:
                if "no such key" in str(e).lower():
                    self.REDIS.xgroup_create(queue_name, group_name, id="0", mkstream=True)
                elif "busygroup" in str(e).lower():
                    logging.warning("Group already exists, continue.")
                    pass
                else:
                    raise

            args = {
                "groupname": group_name,
                "consumername": consumer_name,
                "count": 1,
                "block": int(timeout * 1000) ,
                "streams": {queue_name: msg_id},
            }
            messages = self.REDIS.xreadgroup(**args)
            if not messages:
                return None
            stream, element_list = messages[0]
            if not element_list:
                return None
            msg_id, payload = element_list[0]
            res: NodeMessage = NodeMessage(msg_id, payload["node"], payload["stamp"])
            
            return res
        except Exception as e:
            if str(e) == 'no such key':
                pass
            else:
                print(
                    "RedisDB.queue_consumer "
                    + str(queue_name)
                    + " got exception: "
                    + str(e)
                )
                self.__open__()
        return None

    def cleanup_stream(self, queue_name, max_len=1000):
        """
        清理stream，保持最大长度
        
        :param queue_name: stream名称
        :param max_len: 最大保留消息数
        """
        try:
            # 使用XTRIM命令修剪stream
            trimmed = self.REDIS.xtrim(queue_name, maxlen=max_len, approximate=True)
            if trimmed > 0:
                print(f"清理stream {queue_name}: 删除了 {trimmed} 条消息")
            return trimmed
        except Exception as e:
            print(f"清理stream失败: {e}")
            return 0

    def get_stream_info(self, queue_name):
        """
        获取stream信息
        
        :param queue_name: stream名称
        :return: stream信息字典
        """
        try:
            info = self.REDIS.xinfo_stream(queue_name)
            print(f"Stream {queue_name} 信息:")
            print(f"  长度: {info.get('length', 0)}")
            print(f"  第一条消息: {info.get('first-entry', 'N/A')}")
            print(f"  最后一条消息: {info.get('last-entry', 'N/A')}")
            return info
        except Exception as e:
            print(f"获取stream信息失败: {e}")
            return {}

    def wait(self, node_name):
        """节点等待 barrier"""

        # 生成本节点到达消息
        stamp = int(time.time())
        expert = set(self.nodes)
        
        # 向stream发送节点到达消息
        self.send_message(self.chan, node_name, stamp)
        
        # 立即处理自己的消息
        expert.discard(node_name)
        print(f"节点 {node_name} 已到达 (自己)")
        
        end = time.time() + self.timeout
        start = time.time() - self.timeout

        while True:
            remain = end - time.time()
            if remain <= 0:
                break

            # 等待剩余时间，直到消息或超时
            m = self.queue_consumer(queue_name=self.chan, group_name=node_name, consumer_name=node_name,timeout=remain)
            if m:
                try:
                    recv_node_name = m.node
                    node_stamp = int(m.stamp)  # 确保转换为整数
                    print(f"收到消息: {recv_node_name} {node_stamp}")
                    
                    # 检查时间戳是否在有效范围内
                    if start <= node_stamp <= end:
                        expert.discard(recv_node_name)
                        print(f"节点 {recv_node_name} 已到达")
                        self.ack_message(self.chan, node_name, m.msg_id)
                        
                        # 如果所有节点都到齐
                        if len(expert) == 0:
                            return {"status": "OK", "lose": []}
                    else:
                        print(f"节点 {recv_node_name} 时间戳过期: {node_stamp} (范围: {start}-{end})")
                except (ValueError, KeyError) as e:
                    print(f"解析消息失败: {e}")

        # 超时：返回未到达的节点
        lose = list(expert)
        return {"status": "FAIL", "lose": lose}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--node", required=True, help="当前节点名称")
    parser.add_argument("--nodes", nargs="+", default=["nodeA", "nodeB", "nodeC"],
                        help="所有参与的节点列表")
    parser.add_argument("--timeout", type=int, default=10, help="barrier 超时时间（秒）")
    parser.add_argument("--info", action="store_true", help="显示stream信息")
    parser.add_argument("--cleanup", action="store_true", help="清理stream")
    args = parser.parse_args()

    barrier = RedisBarrier("test", args.nodes, args.timeout)

    # 如果请求显示信息
    if args.info:
        barrier.get_stream_info(barrier.chan)
        return
    
    # 如果请求清理
    if args.cleanup:
        barrier.cleanup_stream(barrier.chan)
        return

    print(f"[{args.node}] 等待 barrier...")
    print(f"[{args.node}] 参与节点: {args.nodes}")
    print(f"[{args.node}] 超时时间: {args.timeout}秒")
    
    start_time = time.time()
    result = barrier.wait(args.node)
    end_time = time.time()
    
    print(f"[{args.node}] 结果: {result}")
    print(f"[{args.node}] 耗时: {end_time - start_time:.2f}秒")


if __name__ == "__main__":
    main()

```

## 4. 业务系统完善
业务系统需要添加以下逻辑:
1. wait 会返回失效节点列表，计算程序需要重新分配未能正常启动的任务
2. RedisBarrier 只能保证所有节点都正常启动，不能保证所有节点都正常执行任务，所以计算任务需要结合历史计算形成反馈循环，如果最近计算任务失败，自动执行下线。
