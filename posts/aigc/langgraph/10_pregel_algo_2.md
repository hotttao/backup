---
weight: 1
title: "langgraph pregel algo"
date: 2025-08-01T16:00:00+08:00
lastmod: 2025-08-01T16:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langgraph pregel algo"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

前面我们介绍了 `_algo.py` 中关联的对象，这一节我们来介绍 `_algo.py` 的这几个核心函数:
1. `prepare_single_task`
2. `prepare_next_tasks`
3. `apply_writes`

## 1. prepare_next_tasks


## 2. prepare_single_task
prepare_single_task 代码非常长，我们先用 ChatGpt 给我们讲解一下它的代码。

这段函数做了三类任务的准备逻辑：**PUSH**、**PUSH + Call**、和 **PULL**。我会为你分模块讲清楚，并标注重点。

---

### 4.1 🔧 函数功能简述

```python
def prepare_single_task(task_path, ..., for_execution, ...) -> PregelTask | PregelExecutableTask | None:
```

这个函数会根据当前的任务路径 `task_path`：

* 构造一个任务 ID 和 checkpoint 命名空间
* 创建运行所需的环境配置和上下文（configurable, scratchpad, runtime, etc.）
* 判断是否要**立即执行（for_execution=True）**，若是则构造 `PregelExecutableTask`，否则只返回轻量级的 `PregelTask`

---

#### 📦 参数说明（选主要的讲）
```python
def prepare_single_task(
    task_path: tuple[Any, ...],
    task_id_checksum: str | None,
    *,
    checkpoint: Checkpoint,
    checkpoint_id_bytes: bytes,
    checkpoint_null_version: V | None,
    pending_writes: list[PendingWrite],
    processes: Mapping[str, PregelNode],
    channels: Mapping[str, BaseChannel],
    managed: ManagedValueMapping,
    config: RunnableConfig,
    step: int,
    stop: int,
    for_execution: bool,
    store: BaseStore | None = None,
    checkpointer: BaseCheckpointSaver | None = None,
    manager: None | ParentRunManager | AsyncParentRunManager = None,
    input_cache: dict[INPUT_CACHE_KEY_TYPE, Any] | None = None,
    cache_policy: CachePolicy | None = None,
    retry_policy: Sequence[RetryPolicy] = (),
) -> None | PregelTask | PregelExecutableTask:
    pass
```

下面是 `prepare_single_task` 函数的参数列表，按照功能归类

任务标识相关参数

| 参数名                | 类型                | 说明                            |
| ------------------ | ----------------- | ----------------------------- |
| `task_path`        | `tuple[Any, ...]` | 当前任务路径（决定任务类型，如 PUSH / PULL）  |
| `task_id_checksum` | `str \| None`     | 任务 ID 的校验用 checksum，用于构造唯一 ID |
| `step`             | `int`             | 当前执行步数                        |
| `stop`             | `int`             | 最大允许执行步数                      |

图状态 & Checkpoint 相关

| 参数名                       | 类型           | 说明                      |
| ------------------------- | ------------ | ----------------------- |
| `checkpoint`              | `Checkpoint` | 当前图的检查点，包含状态和快照信息       |
| `checkpoint_id_bytes`     | `bytes`      | 当前检查点 ID 的二进制形式（用于唯一标识） |
| `checkpoint_null_version` | `V \| None`  | 当前检查点的初始版本，通常用于判定是否为新状态 |

节点、通道、输入输出相关

| 参数名              | 类型                          | 说明                           |
| ---------------- | --------------------------- | ---------------------------- |
| `processes`      | `Mapping[str, PregelNode]`  | 图中所有节点定义（name -> PregelNode） |
| `channels`       | `Mapping[str, BaseChannel]` | 通道名称与通道实例映射                  |
| `managed`        | `ManagedValueMapping`       | 由调度器托管的中间值/变量映射              |
| `pending_writes` | `list[PendingWrite]`        | 上一步产生的、尚未提交的写入数据             |

运行配置 & 控制器

| 参数名             | 类型                                                  | 说明                                         |
| --------------- | --------------------------------------------------- | ------------------------------------------ |
| `config`        | `RunnableConfig`                                    | 当前任务的执行配置（可传递 tracing / tags / handlers 等） |
| `for_execution` | `bool`                                              | 是否立即执行任务（返回 ExecutableTask），否则仅调度（Task）    |
| `manager`       | `ParentRunManager \| AsyncParentRunManager \| None` | 上层运行管理器（用于 tracing / callbacks）            |

缓存、存储、持久化策略

| 参数名            | 类型                                        | 说明                 |
| -------------- | ----------------------------------------- | ------------------ |
| `store`        | `BaseStore \| None`                       | 可选的数据存储器，用于通道状态保存  |
| `checkpointer` | `BaseCheckpointSaver \| None`             | 持久化 checkpoint 的组件 |
| `input_cache`  | `dict[INPUT_CACHE_KEY_TYPE, Any] \| None` | 输入缓存，用于避免重复执行      |
| `cache_policy` | `CachePolicy \| None`                     | 缓存策略定义             |
| `retry_policy` | `Sequence[RetryPolicy]`                   | 失败任务的重试策略          |



#### 📌 一、PUSH + Call 类型任务（触发子调用的节点）

```python
if task_path[0] == PUSH and isinstance(task_path[-1], Call):
```

这一分支处理的任务格式是：

```python
(PUSH, parent_path, write_index, parent_id, Call)
```

* 从 `Call` 对象中提取执行函数 `call.func` 和输入 `call.input`
* 生成任务 ID（依赖 `step`, `name`, `parent_path`, `index` 等）
* 构造 `task_checkpoint_ns` 表示命名空间
* 若 `for_execution=True`：

  * 创建 `writes` 队列用于记录写入
  * 创建 `scratchpad`（运行时中间缓存）
  * 构造 `PregelExecutableTask`，注入读取通道、发送、checkpointer 等能力
* 否则返回轻量版 `PregelTask`

📎 **重点概念：**

* PUSH 表示主动写入
* Call 是 graph 中的函数调用型节点
* scratchpad 是该任务的“局部内存”，用于跨读写传递数据

---

#### 📌 二、普通 PUSH 类型任务（Send）

```python
elif task_path[0] == PUSH:
```

这一分支处理的是 `Send` 类型任务，来源于通道的 `pending sends`。

* 从 `channels[TASKS]` 中取出 `Send` 对象（packet）
* 根据 packet 构造目标节点 `proc`、任务 ID、checkpoint 命名空间
* 若 `for_execution=True`：

  * 构造 `writes`, `scratchpad`, `cache_key`
  * 包装为 `PregelExecutableTask`
* 否则返回 `PregelTask`

📎 **重点：**

* `Send` 是其他节点写入 TASKS 通道的指令
* 这个处理类似“中转调度”行为

---

#### 📌 三、PULL 类型任务（被动响应触发）

```python
elif task_path[0] == PULL:
```

这一类任务是**由通道变更自动触发的节点**

* 触发逻辑：检测自己监听的通道是否变化（\_triggers）
* 构造任务 ID 和 checkpoint 命名空间
* 构建输入（`val`）和上下文
* 若 for\_execution 为 True：

  * 构建写入、读取能力、scratchpad 等，注入 `PregelExecutableTask`
* 否则返回 `PregelTask`

📎 **重点概念：**

* PULL 表示节点等待输入变化触发
* 与数据依赖绑定，常用于数据流反应式执行

---

#### ✅ 总结关键逻辑流程图（简化）

```
          task_path
              ↓
    ┌───────────────┬───────────────┬───────────────┐
    │   PUSH + Call │     PUSH      │     PULL      │
    └──────┬────────┴──────┬────────┴──────┬────────┘
           │               │               │
     创建task_id       从Send中取值       检查channel变化
           │               │               │
       构造Call         找到目标proc       构建输入值
           │               │               │
       构建Metadata     构建Metadata     构建Metadata
           │               │               │
      PregelTask或     PregelTask或     PregelTask或
   PregelExecutableTask PregelExecutableTask PregelExecutableTask
```


