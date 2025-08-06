---
weight: 1
title: "langgraph pregel runner"
date: 2025-08-01T16:00:00+08:00
lastmod: 2025-08-01T16:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langgraph pregel runner"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

## 1. PregelRunner

这个 PregelRunner 类是 LangGraph 中 Pregel 模式的一部分，用于并发执行节点任务、提交写入数据、处理中断与输出流。

它不是图的核心结构（如 PregelLoop、PregelNode），但作为执行调度器，用于运行单个“超级步（superstep）”中的节点任务并控制其生命周期。

### 1.1 PregelRunner 属性
| 属性名             | 类型                                                              | 说明                                           |
| --------------- | --------------------------------------------------------------- | -------------------------------------------- |
| `submit`        | `weakref.ref[Submit]`                                           | 指向任务提交函数的弱引用，用于提交某个节点的可运行任务（如调用 `.invoke()`） |
| `put_writes`    | `weakref.ref[Callable[[str, Sequence[tuple[str, Any]]], None]]` | 指向写入结果处理函数的弱引用，负责提交节点的写操作（如向 channel 写）      |
| `use_astream`   | `bool`                                                          | 是否启用异步流输出模式（`astream`），用于实时响应中间结果（比如流式输出到用户） |
| `node_finished` | `Callable[[str], None]` 或 `None`                                | 可选回调，当某个节点执行完成后调用，用于记录、清理或调试                 |

```python
class PregelRunner:
    """Responsible for executing a set of Pregel tasks concurrently, committing
    their writes, yielding control to caller when there is output to emit, and
    interrupting other tasks if appropriate."""

    def __init__(
        self,
        *,
        submit: weakref.ref[Submit],
        put_writes: weakref.ref[Callable[[str, Sequence[tuple[str, Any]]], None]],
        use_astream: bool = False,
        node_finished: Callable[[str], None] | None = None,
    ) -> None:
        self.submit = submit
        self.put_writes = put_writes
        self.use_astream = use_astream
        self.node_finished = node_finished
```

在 Pregel invoke 方法中，PregelRunner 初始化如下:

```python
CONFIG_KEY_RUNNER_SUBMIT = sys.intern("__pregel_runner_submit")
# holds a function that receives tasks from runner, executes them and returns results

CONFIG_KEY_NODE_FINISHED = sys.intern("__pregel_node_finished")
# holds a callback to be called when a node is finished

with SyncPregelLoop(
    input,
    stream=StreamProtocol(stream.put, stream_modes),
    config=config,
    store=store,
    cache=cache,
    checkpointer=checkpointer,
    nodes=self.nodes,
    specs=self.channels,
    output_keys=output_keys,
    input_keys=self.input_channels,
    stream_keys=self.stream_channels_asis,
    interrupt_before=interrupt_before_,
    interrupt_after=interrupt_after_,
    manager=run_manager,
    durability=durability_,
    trigger_to_nodes=self.trigger_to_nodes,
    migrate_checkpoint=self._migrate_checkpoint,
    retry_policy=self.retry_policy,
    cache_policy=self.cache_policy,
) as loop:
    # create runner
    runner = PregelRunner(
        submit=config[CONF].get(
            # 优先从 __pregel_runner_submit 配置中获取 submit 函数
            CONFIG_KEY_RUNNER_SUBMIT, weakref.WeakMethod(loop.submit)
        ),
        put_writes=weakref.WeakMethod(loop.put_writes),
        # 从 __pregel_node_finished 配置获取
        node_finished=config[CONF].get(CONFIG_KEY_NODE_FINISHED),
    )
```

### 1.2 PregelRunner 方法
PregelRunner 只有三个方法，分别是 `tick`、`atick`、`commit`。

| 方法名      | 类型   | 作用说明                                                                          |
| -------- | ---- | ----------------------------------------------------------------------------- |
| `tick`   | 同步函数 | 同步执行一批节点任务（一个超级步），并收集每个节点的写入结果（channel/store），返回写入内容。                         |
| `atick`  | 异步函数 | 异步执行一批节点任务，功能与 `tick` 相同，但使用 `await` 实现并发执行，适合异步上下文。                          |
| `commit` | 同步函数 | 将 `tick` / `atick` 收集到的写入结果，提交到 channel、store 或 managed value 中，推进 Pregel 状态。 |


## 2. tick 
