---
weight: 1
title: "pregel 的可配置项"
date: 2025-08-06T11:00:00+08:00
lastmod: 2025-08-06T11:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "pregel 的可配置项"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

## 1. configurable 配置
pregel 的实现在 RunnableConfig configurable 配置段中预定义了很多配置项。这些配置项对应我们理解 pregel 有很重要的作用。


以下是 LangGraph 中预定义的 `configurable` 配置键（`CONFIG_KEY_*`）的详细说明表格，按如下维度整理：

| 配置键（常量名）                                                 | 值类型                                            | 作用                                    | 典型使用场景                          |
| -------------------------------------------------------- | ---------------------------------------------- | ------------------------------------- | ------------------------------- |
| `CONFIG_KEY_SEND`<br>`"__pregel_send"`                   | `Callable[[list[PendingWrite]], None]`         | 向状态（state）、边（edges）或保留键写入更新           | 子图或节点通过它向父图写数据                  |
| `CONFIG_KEY_READ`<br>`"__pregel_read"`                   | `Callable[[], dict]`                           | 返回当前状态（包括边、通道、值等）的快照副本                | 子图或节点读取图状态                      |
| `CONFIG_KEY_CALL`<br>`"__pregel_call"`                   | `Callable[[Runnable, tuple, dict], Awaitable]` | 调用图内某个 node 或函数并获得 Future 结果          | 实现子图或远程调用；如 LCEL 调度             |
| `CONFIG_KEY_CHECKPOINTER`<br>`"__pregel_checkpointer"`   | `BaseCheckpointSaver`                          | 用于持久化图状态的 checkpoint saver 实例         | 子图继承使用父图的 checkpoint 机制         |
| `CONFIG_KEY_STREAM`<br>`"__pregel_stream"`               | `StreamProtocol`                               | 推送流式输出的协议接口                           | 节点推送流式 chunk（如 tokens）到外部       |
| `CONFIG_KEY_CACHE`<br>`"__pregel_cache"`                 | `BaseCache`                                    | 缓存写入记录（用于重复跳过计算）                      | 多次运行之间共享缓存或跳过已计算任务              |
| `CONFIG_KEY_RESUMING`<br>`"__pregel_resuming"`           | `bool`                                         | 当前是否处于恢复（resuming）状态                  | 子图检查是否需要从 checkpoint 恢复         |
| `CONFIG_KEY_TASK_ID`<br>`"__pregel_task_id"`             | `str`                                          | 当前任务的唯一 ID（含 checksum）                | 用于任务日志追踪、异常追踪等                  |
| `CONFIG_KEY_THREAD_ID`<br>`"thread_id"`                  | `str`                                          | 当前执行线程/上下文的 ID                        | 用于跨任务线程/流管理                     |
| `CONFIG_KEY_CHECKPOINT_MAP`<br>`"checkpoint_map"`        | `dict[str, str]`                               | 父图提供的 `namespace -> checkpoint_id` 映射 | 子图中 resume 时知道从哪个 checkpoint 恢复 |
| `CONFIG_KEY_CHECKPOINT_ID`<br>`"checkpoint_id"`          | `str`                                          | 当前任务的 checkpoint ID                   | 当前任务写入持久层时的标识                   |
| `CONFIG_KEY_CHECKPOINT_NS`<br>`"checkpoint_ns"`          | `str`                                          | 当前任务所在的 checkpoint namespace          | 子图中用于构造层级路径                     |
| `CONFIG_KEY_NODE_FINISHED`<br>`"__pregel_node_finished"` | `Callable[[Any], None]`                        | 节点完成后执行的回调（可用于采集、监控）                  | 如上报状态到监控系统或驱动外部进程               |
| `CONFIG_KEY_SCRATCHPAD`<br>`"__pregel_scratchpad"`       | `dict[str, Any]`                               | 当前任务执行期内临时存储（不可持久化）                   | 存放中间变量或调试信息                     |
| `CONFIG_KEY_RUNNER_SUBMIT`<br>`"__pregel_runner_submit"` | `Callable[[Runnable, tuple, dict], Awaitable]` | 任务运行器用于调度任务执行的函数                      | 子图内部 submit 任务使用此回调             |
| `CONFIG_KEY_DURABILITY`<br>`"__pregel_durability"`       | `Literal["sync", "async", "exit"]`             | 当前任务的持久化模式                            | 控制 checkpoint 的写入时机             |
| `CONFIG_KEY_RUNTIME`<br>`"__pregel_runtime"`             | `Runtime` 实例                                   | 封装当前图的上下文、持久化、stream\_writer 等        | 子图共享父图运行期环境                     |
| `CONFIG_KEY_RESUME_MAP`<br>`"__pregel_resume_map"`       | `dict[str, Any]`                               | `namespace -> resume_input` 映射        | 子图 resume 时通过它恢复输入              |

这里面大多数都比较容易理解。比较复杂的有如下几个:
1. CONFIG_KEY_SEND
2. CONFIG_KEY_READ
3. CONFIG_KEY_CALL
4. CONFIG_KEY_STREAM
5. CONFIG_KEY_NODE_FINISHED
6. CONFIG_KEY_SCRATCHPAD
7. CONFIG_KEY_RUNNER_SUBMIT
8. CONFIG_KEY_RESUME_MAP


## 2. ManagedValue
ManagedValueMapping
`ManagedValueMapping` 是一个 `dict[str, ManagedValue]` 类型，代表当前图中注册的所有托管变量的集合。

在 LangGraph 中，有两类“状态”：

| 类型               | 说明                       | 例子               |
| ---------------- | ------------------------ | ---------------- |
| **Channel**      | 节点间传递的数据（边上传播）           | 用户输入、模型输出        |
| **ManagedValue** | 全局托管状态，只能节点显式读写（不会通过边传递） | 记忆、缓存、计数器、上下文变量等 |



在 LangGraph 的调度/执行过程中，每个节点执行时都会接收到：

* 当前通道内容 `channels`
* 当前托管状态 `managed`
* 当前执行上下文 `scratchpad`

---

#### ManagedValueMapping 的生成

方法一：使用 `add_managed` 显式注册

```python
from langgraph.graph import StateGraph
from langgraph.managed import MemoryValue

graph = StateGraph(...)

graph.add_managed("memory", MemoryValue())
graph.add_managed("counter", MemoryValue(default=0))
```

这样你在图中注册了两个托管变量：

```python
managed: ManagedValueMapping = {
    "memory": MemoryValue(...),
    "counter": MemoryValue(...)
}
```


方法二：使用 LCEL 链或 Router 自动生成

如果你使用 LangChain Expression Language（LCEL）链条作为节点，或者是用 create_graph() 构建的结构体路由图，那么：
1. 内部会自动收集链中所有的 Memory、Tool, Callback, MemoryValue, RunnableWithMessageHistory 等
2. 它们也会自动被纳入 managed