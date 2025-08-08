---
weight: 1
title: "pregel 带子图的执行流程"
date: 2025-08-06T12:00:00+08:00
lastmod: 2025-08-06T12:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "pregel 带子图的执行流程"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---


## 5. Subgraph 处理
学习这段代码之前，我们需要先了解 Langgraph 中关于子图的概念。这一部分我也不了解，直接问的 ChatGpt。

### 5.1 Subgraph
LangGraph 支持在图中调用**嵌套子图（subgraph）**，比如：

```python
parent_node -> child_node(subgraph) -> ...
```

为了让主图和子图的 stream 输出可以区分并追踪，LangGraph 引入了 `namespace` 机制：每个子图的事件都带上其命名路径，如：

```
("parent_node:<task_id>", "child_node:<task_id>")
```

### 5.2 Subgraph 的处理

代码中关于子图的处理有两个部分:

```python
CONFIG_KEY_CHECKPOINT_NS = sys.intern("checkpoint_ns")
CONFIG_KEY_STREAM = sys.intern("__pregel_stream")

# 子图的 namespace 配置
if self.checkpointer is True:
    ns = cast(str, config[CONF][CONFIG_KEY_CHECKPOINT_NS])
    config[CONF][CONFIG_KEY_CHECKPOINT_NS] = recast_checkpoint_ns(ns)

# subgraph 流式输出支持
if subgraphs:
    loop.config[CONF][CONFIG_KEY_STREAM] = loop.stream
```

namespace:
* `self.checkpointer is True`：代表这是一个启用了持久化的子图；
* `recast_checkpoint_ns`：去掉命名空间中的 `<task_id>` 部分，只保留路径部分；

流式输出支持:
* 如果调用 `stream(subgraphs=True)`，则将当前 `loop.stream` 对象写入子图 config；
* 这样子图执行期间产生的事件也会通过主图的 stream 发出；
* 子图发出的事件格式如下：

  * 单一 `stream_mode`: `(namespace: tuple, data)`
  * 多重 `stream_mode`: `(namespace: tuple, mode, data)`

示例输出：

```python
(
  ("parent_node:abc123", "child_node:def456"),
  "values",
  {"foo": "bar"}
)
```

你可以通过解析这个 `namespace` 路径，知道数据是在哪个子图中哪个节点产出的。

---

### 5.3 namespace
这里补充一下 Langgraph 中有关 namespace 的知识。

假设你有一个 LangGraph 工作流，用于问答系统（QA system），主图如下：

```
MainGraph（graph_name="qa_graph"）
│
├── Node: retrieve_documents
├── Node: select_subgraph
├── Node: SubGraphRouter → routes to:
│       ├── SubGraph A: summarize_graph
│       └── SubGraph B: qa_graph
└── Node: final_answer
```

你想要为每个用户的每次请求做持久化记录，并为主图和子图都创建独立的 namespace，以便更好地控制 checkpoint 和缓存数据的范围。

---

#### 主图的 namespace 示例

设定参数如下：

| 参数          | 值            |
| ----------- | ------------ |
| graph\_name | `qa_graph`   |
| user\_id    | `user_123`   |
| run\_id     | `run_abc456` |

主图的 namespace 可以设为：

```
namespace = ("qa_graph", "user_123", "run_abc456")
```

或等效的字符串形式：

```
"qa_graph/user_123/run_abc456"
```

这就是该用户本次请求的主图持久化空间。子图应派生在主图的 namespace 下，追加子图名称，以实现**命名空间继承 + 局部隔离**。


#### 子图 namespace

子图名：`summarize_graph` 子图 namespace 派生自主图：

```python

subgraph_namespace = namespace + ("summarize_graph",)
# 子图 A：summarize
("qa_graph", "user_123", "run_abc456", "summarize_graph")
# 子图 B：qa
("qa_graph", "user_123", "run_abc456", "qa_graph")
```


#### 图与子图的 namespace 层级关系

```
namespace hierarchy (tuple form):

└── ("qa_graph", "user_123", "run_abc456")                     # MainGraph
    ├── ("qa_graph", "user_123", "run_abc456", "summarize_graph")  # SubGraph A
    └── ("qa_graph", "user_123", "run_abc456", "qa_graph")         # SubGraph B
```