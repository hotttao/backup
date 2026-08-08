---
weight: 1
title: "Pocket Flow"
date: 2026-05-01T08:00:00+08:00
lastmod: 2026-05-01T08:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Pocket Flow 流的抽象"
featuredImage:

tags: ["workflow"]
categories: ["Agent"]

lightgallery: true
---

今天我们来介绍第一个 Agent Framework [Pocket Flow](https://github.com/The-Pocket/PocketFlow/blob/main/cookbook/pocketflow-batch/translations/README_CHINESE.md)

<!-- more -->

## 1. Workflow 的抽象: Graph

个人认为，大多数 AI Framework 最大的价值就是提供了对 Workflow 的抽象，这个抽象基本上就是 Grap。因为 Grap 表达能力最强，能够支持很多流行的 [Agent 设计模式](https://the-pocket.github.io/PocketFlow/)。

无论是今天要讲的 Pocket Flow，还是后面我们会介绍的 Langgraph。我们要弄清楚这些框架，无非就是搞清楚 Grap 所要实现的以下内容:

1. 如何表示 Graph 中节点以及节点的触发关系
2. 如何在节点传递共享数据
3. Grap 被驱动执行的过程
4. 状态存储和异常恢复

那为什么要先介绍 Pocket Flow 呢？因为 Pocket Flow 足够简单。在 Pocket Flow 上面 Grap 对应为以下三个概念:

1. Node + Action
2. Shared Store
3. Flow

Pocket Flow 本身并没有提供状态存储和异常恢复的机制。这里我们暂时不做介绍。但是通常如果你理解了 Grap 前三个问题，你就能理解如何对 Workflow 做状态存储和异常。这一个问题反过来也可以更好的帮助我们理解前三个问题。

## 2. Node

[Node](https://the-pocket.github.io/PocketFlow/core_abstraction/node.html) 包含三个步骤: **prep -> exec -> post**

1. prep: 从 shared store 中读取数据，传递给 exec
2. exec: 执行节点的计算逻辑
3. post: 更新 shared store，并返回 action 决定下一步触发的节点。

![Node Steps](/images/aigc/workflow/pocket_flow_node.png)

### 节点依赖关系

节点依赖关系通过 `src_node -> action -> tgt_node` 来表示。代码里定义了 `__sub__` 和 `__rshift__` 方法，可以像下面这样，直接表达节点之间的触发关系:

```python
review - "approved" >> payment        # If approved, process payment
review - "needs_revision" >> revise   # If needs changes, go to revision
review - "rejected" >> finish         # If rejected, finish the process
```

这种映射关系保存在 src_node 的 successors 属性中:

```python
class BaseNode:
    def __init__(self): self.params,self.successors={},{}
    def next(self,node,action="default"):
        if action in self.successors: warnings.warn(f"Overwriting successor for action '{action}'")
        self.successors[action]=node; return node
```

## 3. Shared Store

Share Store 是一个自定义的全局对象，完全由用户定义。在 Flow.run 中传入，由 Flow 负责在所有节点之间共享传递。

## 4. Flow

Flow 驱动 Graph 执行。

```python
# 定义节点
load_data = LoadData()
summarize = Summarize()

# 描述节点依赖关系
load_data >> summarize

# 定义启动节点
flow = Flow(start=load_data)

# 运行流
shared = {}
flow.run(shared)
```

Flow 驱动 Graph 执行的核心是 run 方法:

```python
class BaseNode:
    def _run(self,shared): p=self.prep(shared); e=self._exec(p); return self.post(shared,p,e)
    def run(self,shared):
        if self.successors: warnings.warn("Node won't run successors. Use Flow.")
        return self._run(shared)

class Flow(BaseNode):
    def __init__(self,start=None): super().__init__(); self.start_node=start
    def start(self,start): self.start_node=start; return start
    def get_next_node(self,curr,action):
        nxt=curr.successors.get(action or "default")
        if not nxt and curr.successors: warnings.warn(f"Flow ends: '{action}' not found in {list(curr.successors)}")
        return nxt
    def _orch(self,shared,params=None):
        curr,p,last_action =copy.copy(self.start_node),(params or {**self.params}),None
        # start_node 是启动节点，shared 会在所有节点之间共享传递
        # curr._run 执行 BaseNode._run 方法，
            # 内部调用 Node 定义的钩子函数 prep, exec, post
            # post 返回 action 决定下一步触发的节点
        # get_next_node 从 src_node 获取下一个执行的 node
        while curr: curr.set_params(p); last_action=curr._run(shared); curr=copy.copy(self.get_next_node(curr,last_action))
        return last_action
    def _run(self,shared): p=self.prep(shared); o=self._orch(shared); return self.post(shared,p,o)
    def post(self,shared,prep_res,exec_res): return exec_res
```

Flow 继承自 BaseNode，所以 Flow 也可以作为节点。作为节点执行 Flow 的执行顺序:

1. Flow.prep(): 继承自 BaseNode 的空函数
2. Flow.\_run(): 执行子 Flow，返回最终的 last_action
3. Flow.post(): exec_res 接收的是 \_run 返回的 last_action，所以直接 return exec_res，作为触发下一个节点的 action。

## 5. 使用示例

官网提供了很多基于 Pocket Flow 实现的 Agent 设计模式:

1. [Agent](https://the-pocket.github.io/PocketFlow/design_pattern/agent.html)
2. [Multi-Agents](https://the-pocket.github.io/PocketFlow/design_pattern/multi_agent.html)

也有一些具体的使用示例:

1. [通用 Deep Coder](https://github.com/Yuyz0112/cloudtower-api-ai-coder/tree/main)
2. [强化 Copilot 模式，打造更灵活的 DeepWiki 开源替代](https://github.com/Yuyz0112/koala-code-reader)

我们会介绍这几个具体示例里 workflow 设计。目的有两个:

1. 更好的展示，什么时候我们应该使用 Agent Framework
2. 如何思考和设计 workflow

## 6. Pocket Flow 的设计理念

总结一下，Pocket Flow 本身设计非常简洁，基于 Pocket Flow 构建的项目也非常清晰:

```shell
my_project/
├── main.py
├── nodes.py
├── flow.py
├── utils/
│   ├── __init__.py
│   ├── call_llm.py
│   └── search_web.py
├── requirements.txt
└── docs/
    └── design.md
```

这种代码组织方式，职责清晰，和原始需求及设计完全对齐。通过把复杂的具体的业务逻辑以工具函数的方式抽象到具体的位置上，让节点的实现变得只跟数据交互相关。

虽然当时项目创建的时候， Harness 相关概念还未被提出，但是项目就已经体现了 [Harness 的设计思想](https://the-pocket.github.io/PocketFlow/guide.html)。结构清晰、依赖清晰、功能内聚。人做设计、AI 负责 Code。

在这种架构的引导下，我们思考如何实现一个 Workflow 也会有迹可循:

1. 参考人类思考流程，规划 Workflow
2. 逐个节点，定义节点的输入和输出
3. 考虑 Workflow 中的需要累加和压缩的内容
4. 综合 2和3 定义 Storage
5. 参考目录结构和设计一对一的实现代码

## 7. 参考阅读

1. [OpenAPI × Pocket Flow：做一个通用 Deep Coder](https://app.koala-oss.club/videos/e20db357-4c08-4f8d-8e23-34046fb299de)
2. [最精简的 LLM 应用框架是怎样练成的](https://app.koala-oss.club/videos/fe043734-d5ea-48f3-9e3c-8b0167eb3558)
