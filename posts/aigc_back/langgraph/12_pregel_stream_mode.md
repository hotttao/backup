---
weight: 1
title: "pregel stream mode"
date: 2025-08-01T16:00:00+08:00
lastmod: 2025-08-01T16:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "pregel stream mode"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---



## 6. 消息流模式

### 6.1 `stream_mode="messages"`

当图中某个节点调用了 LLM（如 OpenAI Chat API），你可能希望 **逐 token** 地将 LLM 回复 stream 给前端。LangGraph 提供 `messages` 模式实现这一点：

#### stream 中相关代码详解

```python
if "messages" in stream_modes:
    run_manager.inheritable_handlers.append(
        StreamMessagesHandler(stream.put, subgraphs)
    )
```

* 给 callback handler 列表添加一个 `StreamMessagesHandler`；
* 它会自动挂载到所有 LLM 调用上（只要用的是 langchain LLM）；
* 它将每个 token 连同其 metadata（包括哪一个节点）写入 `stream.put()`；
* 如果是子图节点，还会加上完整 namespace 路径。


#### 消息流的输出格式

```python
("messages", ("Hello", {"name": "llm_node", "type": "llm"}))
```

或者如果启用了子图：

```python
(("parent_node:xyz", "llm_node:abc"), "messages", ("Hello", {"name": "llm_node"}))
```

这对于 **实时展示 token 输出的前端 UI 非常有用**。


### 6.2 stream_mode="custom"

```python
            if "custom" in stream_modes:

                def stream_writer(c: Any) -> None:
                    stream.put(
                        (
                            # get_config 用于 Runnable Context 中获取 child_runnable_config
                            # [:-1] 表示去掉，去掉当前 node id，仅保留子图路径，防止误分类？
                            tuple(
                                get_config()[CONF][CONFIG_KEY_CHECKPOINT_NS].split(
                                    NS_SEP
                                )[:-1]
                            ),
                            "custom",
                            c,
                        )
                    )
            elif CONFIG_KEY_STREAM in config[CONF]:
                # 从 config 中获取 stream_writer 函数
                # CONFIG_KEY_RUNTIME = sys.intern("__pregel_runtime")
                stream_writer = config[CONF][CONFIG_KEY_RUNTIME].stream_writer
            else:

                def stream_writer(c: Any) -> None:
                    pass


def get_config() -> RunnableConfig:
    if sys.version_info < (3, 11):
        try:
            if asyncio.current_task():
                raise RuntimeError(
                    "Python 3.11 or later required to use this in an async context"
                )
        except RuntimeError:
            pass
    if var_config := var_child_runnable_config.get():
        return var_config
    else:
        raise RuntimeError("Called get_config outside of a runnable context")

var_child_runnable_config: ContextVar[RunnableConfig | None] = ContextVar(
    "child_runnable_config", default=None
)
```

stream_writer 是一个在 节点执行期间可调用的函数，用于将自定义数据（c）写入 stream 队列，从而实现 自定义流式事件输出（stream_mode="custom"）。
