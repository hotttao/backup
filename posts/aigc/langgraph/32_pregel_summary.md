---
weight: 1
title: "pregel 重要流程总结"
date: 2025-08-06T12:00:00+08:00
lastmod: 2025-08-06T12:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "pregel 重要流程总结"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---



总结回顾一下问题:
1. checkpoint 何时生成
2. 函数参数如何传递


## 1. PregelLoop 的更新循环
### 1.1 任务生成
prepare_next_tasks 会生成两种类型的 task:
- PUSH: 是直接触发 Node 执行，并传入自定义参数
- PULL: 是让 Node 发起检查，自己是否被触发，参数从 Node 监听的 channel 中读入

最终生成的任务包含如下信息:

```python
return PregelExecutableTask(
    packet.node, # 节点名称
    packet.arg,  # 传递给节点执行器的参数
    proc_node,   # 节点执行器
    writes,      # dequeue
    ...
    writers=proc.flat_writers, # 节点的写入通道
    subgraphs=proc.subgraphs,  # 节点包含的子图

)
```

节点在初始化时会定义 writers 属性，类型为 `List[ChannelWrite]`，用于存储节点的写入通道。


```python
node2 = (
    NodeBuilder().subscribe_to("b")
    .do(lambda x: x["b"] + x["b"])
    .write_to("c")
)
# write_to 用户设置节点要写入的通道，flat_writers 用于合并 ChannelWrite
class NodeBuilder:
    def write_to(
        self,
        *channels: str | ChannelWriteEntry,
        **kwargs: _WriteValue,
    ) -> Self:

        self._writes.extend(
            ChannelWriteEntry(c) if isinstance(c, str) else c for c in channels
        )
        self._writes.extend(
            ChannelWriteEntry(k, mapper=v)
            if callable(v)
            else ChannelWriteEntry(k, value=v)
            for k, v in kwargs.items()
        )

        return self

    def build(self) -> PregelNode:
        """Builds the node."""
        return PregelNode(
            channels=self._channels,
            triggers=self._triggers,
            tags=self._tags,
            metadata=self._metadata,
            writers=[ChannelWrite(self._writes)],
            bound=self._bound,
            retry_policy=self._retry_policy,
            cache_policy=self._cache_policy,
        )
    
```

### 1.2 任务执行


### 1.3 写入更新
apply_writes 执行任务时，会执行:

```python
    # 1. 遍历 task.writes(deque) 获取要写入的 (channel. value)，合并
    pending_writes_by_channel: dict[str, list[Any]] = defaultdict(list)
    for task in tasks:
        for chan, val in task.writes:
            if chan in (NO_WRITES, PUSH, RESUME, INTERRUPT, RETURN, ERROR):
                pass
            elif chan in channels:
                pending_writes_by_channel[chan].append(val)
```
