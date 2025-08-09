---
weight: 1
title: "pregel algo - 2"
date: 2025-08-01T16:00:00+08:00
lastmod: 2025-08-01T16:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "pregel algo - 2"
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
3. `local_read`
3. `apply_writes`

## 1. prepare_next_tasks
### 1.1 prepare_next_tasks 入参
prepare_next_tasks 函数的定义如下:

```python
def prepare_next_tasks(
    checkpoint: Checkpoint,
    pending_writes: list[PendingWrite],
    processes: Mapping[str, PregelNode],
    channels: Mapping[str, BaseChannel],
    managed: ManagedValueMapping,
    config: RunnableConfig,
    step: int,
    stop: int,
    *,
    for_execution: bool,
    store: BaseStore | None = None,
    checkpointer: BaseCheckpointSaver | None = None,
    manager: None | ParentRunManager | AsyncParentRunManager = None,
    trigger_to_nodes: Mapping[str, Sequence[str]] | None = None,
    updated_channels: set[str] | None = None,
    retry_policy: Sequence[RetryPolicy] = (),
    cache_policy: CachePolicy | None = None,
) -> dict[str, PregelTask] | dict[str, PregelExecutableTask]:
    """Prepare the set of tasks that will make up the next Pregel step.

    Args:
        checkpoint: The current checkpoint.
        pending_writes: The list of pending writes.
        processes: The mapping of process names to PregelNode instances.
        channels: The mapping of channel names to BaseChannel instances.
        managed: The mapping of managed value names to functions.
        config: The runnable configuration.
        step: The current step.
        for_execution: Whether the tasks are being prepared for execution.
        store: An instance of BaseStore to make it available for usage within tasks.
        checkpointer: Checkpointer instance used for saving checkpoints.
        manager: The parent run manager to use for the tasks.
        trigger_to_nodes: Optional: Mapping of channel names to the set of nodes
            that are can be triggered by that channel.
        updated_channels: Optional. Set of channel names that have been updated during
            the previous step. Using in conjunction with trigger_to_nodes to speed
            up the process of determining which nodes should be triggered in the next
            step.

    Returns:
        A dictionary of tasks to be executed. The keys are the task ids and the values
        are the tasks themselves. This is the union of all PUSH tasks (Sends)
        and PULL tasks (nodes triggered by edges).
    """
```

下面是入参说明列表:

| 参数名                | 类型                                                  | 说明                                             |
| ------------------ | --------------------------------------------------- | ---------------------------------------------- |
| `checkpoint`       | `Checkpoint`                                        | 当前步骤的系统快照，包含图状态、消息、管理值等                        |
| `pending_writes`   | `list[PendingWrite]`                                | 等待写入状态的数据，用于节点状态更新、触发 channel 等                |
| `processes`        | `Mapping[str, PregelNode]`                          | 当前图中所有节点的映射，每个节点一个 `PregelNode` 实例             |
| `channels`         | `Mapping[str, BaseChannel]`                         | 所有通道（channel）的映射，例如边、消息队列、流数据                  |
| `managed`          | `ManagedValueMapping`                               | 管理变量的定义（类似于全局状态变量），如 counters、RAG 存储等          |
| `config`           | `RunnableConfig`                                    | 运行时配置，如 stream 模式、 tracing、stream\_writer 等    |
| `step`             | `int`                                               | 当前执行步数，表示 pregel loop 的当前 tick                 |
| `stop`             | `int`                                               | 最多允许的步数（pregel loop 的终止条件之一）                   |
| `for_execution`    | `bool`                                              | 是否为真正执行任务（`True`）还是仅用于 dry-run、准备              |
| `store`            | `BaseStore \| None`                                 | 可选的状态存储系统，用于 task 执行时读取全局数据                    |
| `checkpointer`     | `BaseCheckpointSaver \| None`                       | 检查点保存器，用于在任务中触发 checkpoint                     |
| `manager`          | `ParentRunManager \| AsyncParentRunManager \| None` | LangChain 的 tracing 上下文管理器，用于日志与可视化            |
| `trigger_to_nodes` | `Mapping[str, Sequence[str]] \| None`               | 可选：哪些通道触发哪些节点，用于优化计算路径                         |
| `updated_channels` | `set[str] \| None`                                  | 可选：上一步被更新的通道集合，与 `trigger_to_nodes` 配合用于优化触发范围 |
| `retry_policy`     | `Sequence[RetryPolicy]`                             | 可选：任务失败时的重试策略配置                                |
| `cache_policy`     | `CachePolicy \| None`                               | 可选：是否启用缓存，比如对某些节点结果复用缓存结果                      |

### 1.2 prepare_next_tasks 执行逻辑

prepare_next_tasks 中把任务分为了两种类型:
1. Push 表示边（channel）的行为：把数据推入边中
2. Pull 表示节点（node）的行为：处理输入并产出输出

| 任务类型        | task_path 形式     | 含义                                     |
| ----------- | ----------------- | -------------------------------------- |
| **PUSH 任务** | `(PUSH, index)`   | index 是 `TASKS` channel 中某个 `Send` 的索引 |
| **PULL 任务** | `(PULL, node_id)` | node_id 是被触发的节点名称                     |

下面是整个函数执行的概览:

```python
prepare_next_tasks
│
├── 构造 input_cache, checkpoint_id 等基础信息
│
├── 消费 PUSH 类型任务（TASKS channel）
│   └── prepare_single_task((PUSH, idx), ...)
│
├── 判断哪些节点应被触发（PULL）
│   ├── 使用 updated_channels + trigger_to_nodes 优化
│   ├── 或 fallback 到全体节点
│
├── 为每个候选节点构建 PULL 任务
│   └── prepare_single_task((PULL, node_name), ...)
│
└── 返回所有任务 {task_id: task}
```

```python
def prepare_next_tasks():
    input_cache: dict[INPUT_CACHE_KEY_TYPE, Any] = {}
    checkpoint_id_bytes = binascii.unhexlify(checkpoint["id"].replace("-", ""))
    null_version = checkpoint_null_version(checkpoint)
    tasks: list[PregelTask | PregelExecutableTask] = []
    # 1. PUSH 任务
    # Consume pending tasks
    # TASKS = sys.intern("__pregel_tasks")
    # 读取待发送数据的 channel
    tasks_channel = cast(Optional[Topic[Send]], channels.get(TASKS))
    if tasks_channel and tasks_channel.is_available():
        for idx, _ in enumerate(tasks_channel.get()):
            if task := prepare_single_task(
                (PUSH, idx),
                None,
                checkpoint=checkpoint,
                checkpoint_id_bytes=checkpoint_id_bytes,
                checkpoint_null_version=null_version,
                pending_writes=pending_writes,
                processes=processes,
                channels=channels,
                managed=managed,
                config=config,
                step=step,
                stop=stop,
                for_execution=for_execution,
                store=store,
                checkpointer=checkpointer,
                manager=manager,
                input_cache=input_cache,
                cache_policy=cache_policy,
                retry_policy=retry_policy,
            ):
                tasks.append(task)
    # PUSH 任务
    if updated_channels and trigger_to_nodes:
        triggered_nodes: set[str] = set()
        # Get all nodes that have triggers associated with an updated channel
        for channel in updated_channels:
            if node_ids := trigger_to_nodes.get(channel):
                triggered_nodes.update(node_ids)
        # Sort the nodes to ensure deterministic order
        candidate_nodes: Iterable[str] = sorted(triggered_nodes)
    elif not checkpoint["channel_versions"]:
        candidate_nodes = ()
    else:
        candidate_nodes = processes.keys()

    # Check if any processes should be run in next step
    # If so, prepare the values to be passed to them
    for name in candidate_nodes:
        if task := prepare_single_task(
            (PULL, name),
            None,
            checkpoint=checkpoint,
            checkpoint_id_bytes=checkpoint_id_bytes,
            checkpoint_null_version=null_version,
            pending_writes=pending_writes,
            processes=processes,
            channels=channels,
            managed=managed,
            config=config,
            step=step,
            stop=stop,
            for_execution=for_execution,
            store=store,
            checkpointer=checkpointer,
            manager=manager,
            input_cache=input_cache,
            cache_policy=cache_policy,
            retry_policy=retry_policy,
        ):
            tasks.append(task)
    return {t.id: t for t in tasks}
```

## 2. prepare_single_task
构造 task 主要在 prepare_single_task 内。


### 2.1 prepare_single_task 入参

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

### 2.2 prepare_single_task 处理流程
prepare_single_task 有三个生成 task 的流程，分别对应代码中的三个 if。

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


#### PUSH + Call 
这个分支在 prepare_next_tasks 内没有调用。

```python
if task_path[0] == PUSH and isinstance(task_path[-1], Call):
    # (PUSH, parent task path, idx of PUSH write, id of parent task, Call)
    # (PUSH, parent_task_path, index, parent_task_id, Call)
    task_path_t = cast(tuple[str, tuple, int, str, Call], task_path)
    call = task_path_t[-1]
    # 1. 关注1
    proc_ = get_runnable_for_task(call.func)
    name = proc_.name
    if name is None:
        raise ValueError("`call` functions must have a `__name__` attribute")
    # create task id
    triggers: Sequence[str] = PUSH_TRIGGER
    checkpoint_ns = f"{parent_ns}{NS_SEP}{name}" if parent_ns else name
    task_id = task_id_func(
        checkpoint_id_bytes,
        checkpoint_ns,
        str(step),
        name,
        PUSH,
        task_path_str(task_path[1]),
        str(task_path[2]),
    )
    task_checkpoint_ns = f"{checkpoint_ns}:{task_id}"
    # we append True to the task path to indicate that a call is being
    # made, so we should not return interrupts from this task (responsibility lies with the parent)
    task_path = (*task_path[:3], True)
    metadata = {
        "langgraph_step": step,
        "langgraph_node": name,
        "langgraph_triggers": triggers,
        "langgraph_path": task_path,
        "langgraph_checkpoint_ns": task_checkpoint_ns,
    }
    if task_id_checksum is not None:
        assert task_id == task_id_checksum, f"{task_id} != {task_id_checksum}"
    if for_execution:
        writes: deque[tuple[str, Any]] = deque()
        cache_policy = call.cache_policy or cache_policy
        if cache_policy:
            args_key = cache_policy.key_func(*call.input[0], **call.input[1])
            cache_key: CacheKey | None = CacheKey(
                (
                    CACHE_NS_WRITES,
                    (identifier(call.func) or "__dynamic__"),
                ),
                xxh3_128_hexdigest(
                    args_key.encode() if isinstance(args_key, str) else args_key,
                ),
                cache_policy.ttl,
            )
        else:
            cache_key = None
        scratchpad = _scratchpad(
            config[CONF].get(CONFIG_KEY_SCRATCHPAD),
            pending_writes,
            task_id,
            xxh3_128_hexdigest(task_checkpoint_ns.encode()),
            config[CONF].get(CONFIG_KEY_RESUME_MAP),
            step,
            stop,
        )
        runtime = cast(
            Runtime, configurable.get(CONFIG_KEY_RUNTIME, DEFAULT_RUNTIME)
        )
        runtime = runtime.override(store=store)
        return PregelExecutableTask(
            name,
            call.input,
            proc_,
            writes,
            patch_config(
                merge_configs(config, {"metadata": metadata}),
                run_name=name,
                callbacks=call.callbacks
                or (manager.get_child(f"graph:step:{step}") if manager else None),
                configurable={
                    CONFIG_KEY_TASK_ID: task_id,
                    # deque.extend is thread-safe
                    CONFIG_KEY_SEND: writes.extend,
                    CONFIG_KEY_READ: partial(
                        local_read,
                        scratchpad,
                        channels,
                        managed,
                        PregelTaskWrites(task_path, name, writes, triggers),
                    ),
                    CONFIG_KEY_CHECKPOINTER: (
                        checkpointer or configurable.get(CONFIG_KEY_CHECKPOINTER)
                    ),
                    CONFIG_KEY_CHECKPOINT_MAP: {
                        **configurable.get(CONFIG_KEY_CHECKPOINT_MAP, {}),
                        parent_ns: checkpoint["id"],
                    },
                    CONFIG_KEY_CHECKPOINT_ID: None,
                    CONFIG_KEY_CHECKPOINT_NS: task_checkpoint_ns,
                    CONFIG_KEY_SCRATCHPAD: scratchpad,
                    CONFIG_KEY_RUNTIME: runtime,
                },
            ),
            triggers,
            call.retry_policy or retry_policy,
            cache_key,
            task_id,
            task_path,
        )
    else:
        return PregelTask(task_id, name, task_path)
```


#### PUSH 任务
PUSH 是直接触发 Node 执行，并向其出入值。

```python
elif task_path[0] == PUSH:
    if len(task_path) == 2:
        # SEND tasks, executed in superstep n+1
        # (PUSH, idx of pending send)
        idx = cast(int, task_path[1])
        if not channels[TASKS].is_available():
            return
        sends: Sequence[Send] = channels[TASKS].get()
        if idx < 0 or idx >= len(sends):
            return
        packet = sends[idx]
        if not isinstance(packet, Send):
            logger.warning(
                f"Ignoring invalid packet type {type(packet)} in pending sends"
            )
            return
        if packet.node not in processes:
            logger.warning(
                f"Ignoring unknown node name {packet.node} in pending sends"
            )
            return
        # find process
        proc = processes[packet.node]
        # 调用的 PregelNode.node
        proc_node = proc.node
        if proc_node is None:
            return
        # create task id
        triggers = PUSH_TRIGGER
        checkpoint_ns = (
            f"{parent_ns}{NS_SEP}{packet.node}" if parent_ns else packet.node
        )
        task_id = task_id_func(
            checkpoint_id_bytes,
            checkpoint_ns,
            str(step),
            packet.node,
            PUSH,
            str(idx),
        )
    else:
        logger.warning(f"Ignoring invalid PUSH task path {task_path}")
        return
    task_checkpoint_ns = f"{checkpoint_ns}:{task_id}"
    # we append False to the task path to indicate that a call is not being made
    # so we should return interrupts from this task
    task_path = (*task_path[:3], False)
    metadata = {
        "langgraph_step": step,
        "langgraph_node": packet.node,
        "langgraph_triggers": triggers,
        "langgraph_path": task_path,
        "langgraph_checkpoint_ns": task_checkpoint_ns,
    }
    if task_id_checksum is not None:
        assert task_id == task_id_checksum, f"{task_id} != {task_id_checksum}"
    if for_execution:
        if proc.metadata:
            metadata.update(proc.metadata)
        writes = deque()
        cache_policy = proc.cache_policy or cache_policy
        if cache_policy:
            args_key = cache_policy.key_func(packet.arg)
            cache_key = CacheKey(
                (
                    CACHE_NS_WRITES,
                    (identifier(proc) or "__dynamic__"),
                    packet.node,
                ),
                xxh3_128_hexdigest(
                    args_key.encode() if isinstance(args_key, str) else args_key,
                ),
                cache_policy.ttl,
            )
        else:
            cache_key = None
        scratchpad = _scratchpad(
            config[CONF].get(CONFIG_KEY_SCRATCHPAD),
            pending_writes,
            task_id,
            xxh3_128_hexdigest(task_checkpoint_ns.encode()),
            config[CONF].get(CONFIG_KEY_RESUME_MAP),
            step,
            stop,
        )
        runtime = cast(
            Runtime, configurable.get(CONFIG_KEY_RUNTIME, DEFAULT_RUNTIME)
        )
        runtime = runtime.override(
            store=store, previous=checkpoint["channel_values"].get(PREVIOUS, None)
        )
        return PregelExecutableTask(
            packet.node,
            packet.arg,
            proc_node,
            writes,
            patch_config(
                merge_configs(config, {"metadata": metadata, "tags": proc.tags}),
                run_name=packet.node,
                callbacks=(
                    manager.get_child(f"graph:step:{step}") if manager else None
                ),
                configurable={
                    CONFIG_KEY_TASK_ID: task_id,
                    # deque.extend is thread-safe
                    CONFIG_KEY_SEND: writes.extend,
                    CONFIG_KEY_READ: partial(
                        local_read,
                        scratchpad,
                        channels,
                        managed,
                        PregelTaskWrites(task_path, packet.node, writes, triggers),
                    ),
                    CONFIG_KEY_CHECKPOINTER: (
                        checkpointer or configurable.get(CONFIG_KEY_CHECKPOINTER)
                    ),
                    CONFIG_KEY_CHECKPOINT_MAP: {
                        **configurable.get(CONFIG_KEY_CHECKPOINT_MAP, {}),
                        parent_ns: checkpoint["id"],
                    },
                    CONFIG_KEY_CHECKPOINT_ID: None,
                    CONFIG_KEY_CHECKPOINT_NS: task_checkpoint_ns,
                    CONFIG_KEY_SCRATCHPAD: scratchpad,
                    CONFIG_KEY_RUNTIME: runtime,
                },
            ),
            triggers,
            proc.retry_policy or retry_policy,
            cache_key,
            task_id,
            task_path,
            # 输出 ChannelWrite 表示像 channel 写入值
            writers=proc.flat_writers,
            subgraphs=proc.subgraphs,
        )
    else:
        return PregelTask(task_id, packet.node, task_path)
```


#### PULL 任务
PULL 是让 Node 发起检查，是否需要执行，从 Node 监听的 channel 获取值。

```python
elif task_path[0] == PULL:
    # (PULL, node name)
    name = cast(str, task_path[1])
    if name not in processes:
        return
    proc = processes[name]
    if checkpoint_null_version is None:
        return
    # If any of the channels read by this process were updated
    # 检查 pregelnode 监听的channel 是否有更新
    if _triggers(
        channels,
        checkpoint["channel_versions"],
        checkpoint["versions_seen"].get(name),
        checkpoint_null_version,
        proc,
    ):
        triggers = tuple(sorted(proc.triggers))
        # create task id
        checkpoint_ns = f"{parent_ns}{NS_SEP}{name}" if parent_ns else name
        task_id = task_id_func(
            checkpoint_id_bytes,
            checkpoint_ns,
            str(step),
            name,
            PULL,
            *triggers,
        )
        task_checkpoint_ns = f"{checkpoint_ns}{NS_END}{task_id}"
        # create scratchpad
        scratchpad = _scratchpad(
            config[CONF].get(CONFIG_KEY_SCRATCHPAD),
            pending_writes,
            task_id,
            xxh3_128_hexdigest(task_checkpoint_ns.encode()),
            config[CONF].get(CONFIG_KEY_RESUME_MAP),
            step,
            stop,
        )
        # create task input
        try:
            # 为 pregelNode bound 执行器，获取 input 输入
            val = _proc_input(
                proc,
                managed,
                channels,
                for_execution=for_execution,
                input_cache=input_cache,
                scratchpad=scratchpad,
            )
            if val is MISSING:
                return
        except Exception as exc:
            if SUPPORTS_EXC_NOTES:
                exc.add_note(
                    f"Before task with name '{name}' and path '{task_path[:3]}'"
                )
            raise

        metadata = {
            "langgraph_step": step,
            "langgraph_node": name,
            "langgraph_triggers": triggers,
            "langgraph_path": task_path[:3],
            "langgraph_checkpoint_ns": task_checkpoint_ns,
        }
        if task_id_checksum is not None:
            assert task_id == task_id_checksum, f"{task_id} != {task_id_checksum}"
        if for_execution:
            if node := proc.node:
                if proc.metadata:
                    metadata.update(proc.metadata)
                writes = deque()
                cache_policy = proc.cache_policy or cache_policy
                if cache_policy:
                    args_key = cache_policy.key_func(val)
                    cache_key = CacheKey(
                        (
                            CACHE_NS_WRITES,
                            (identifier(proc) or "__dynamic__"),
                            name,
                        ),
                        xxh3_128_hexdigest(
                            (
                                args_key.encode()
                                if isinstance(args_key, str)
                                else args_key
                            ),
                        ),
                        cache_policy.ttl,
                    )
                else:
                    cache_key = None
                runtime = cast(
                    Runtime, configurable.get(CONFIG_KEY_RUNTIME, DEFAULT_RUNTIME)
                )
                runtime = runtime.override(
                    previous=checkpoint["channel_values"].get(PREVIOUS, None),
                    store=store,
                )
                return PregelExecutableTask(
                    name,
                    val,
                    node,
                    writes,
                    patch_config(
                        merge_configs(
                            config, {"metadata": metadata, "tags": proc.tags}
                        ),
                        run_name=name,
                        callbacks=(
                            manager.get_child(f"graph:step:{step}")
                            if manager
                            else None
                        ),
                        configurable={
                            CONFIG_KEY_TASK_ID: task_id,
                            # deque.extend is thread-safe
                            CONFIG_KEY_SEND: writes.extend,
                            CONFIG_KEY_READ: partial(
                                local_read,
                                scratchpad,
                                channels,
                                managed,
                                PregelTaskWrites(
                                    task_path[:3],
                                    name,
                                    writes,
                                    triggers,
                                ),
                            ),
                            CONFIG_KEY_CHECKPOINTER: (
                                checkpointer
                                or configurable.get(CONFIG_KEY_CHECKPOINTER)
                            ),
                            CONFIG_KEY_CHECKPOINT_MAP: {
                                **configurable.get(CONFIG_KEY_CHECKPOINT_MAP, {}),
                                parent_ns: checkpoint["id"],
                            },
                            CONFIG_KEY_CHECKPOINT_ID: None,
                            CONFIG_KEY_CHECKPOINT_NS: task_checkpoint_ns,
                            CONFIG_KEY_SCRATCHPAD: scratchpad,
                            CONFIG_KEY_RUNTIME: runtime,
                        },
                    ),
                    triggers,
                    proc.retry_policy or retry_policy,
                    cache_key,
                    task_id,
                    task_path[:3],
                    writers=proc.flat_writers,
                    subgraphs=proc.subgraphs,
                )
        else:
            return PregelTask(task_id, name, task_path[:3])
```

#### PregelExecutableTask 创建
创建 PregelExecutableTask 的三个分支代码都比较长，但是代码结构完全一样。PregelExecutableTask 创建用到的参数如下:

```python
processes: Mapping[str, PregelNode]
proc = processes[packet.node]
proc_node = proc.node

return PregelExecutableTask(
    packet.node, # 节点名称
    packet.arg,  # 传递给节点执行器的参数
    proc_node,   # PregelNode.node 
    writes,      # dequeue
    ...
    patch_config(
        configurable={
            CONFIG_KEY_SEND: writes.extend,
            CONFIG_KEY_READ: partial(
                local_read,
                scratchpad,
                channels,
                managed,
                PregelTaskWrites(
                    task_path[:3],
                    name,
                    writes,
                    triggers,
                ),
            ),
        }
    )
    # proc 是 pregelNode
    writers=proc.flat_writers, # 节点的写入通道，[ChannelWrite(self._writes)]
    subgraphs=proc.subgraphs,  # 节点包含的子图

)
```

PregelExecutableTask 初始化是用到了很多 PregelNode 的属性。可以看到

1. `proc_node=Pregel.node`
2. `Pregel.node 是属性方法，最终会返回 RunnableSeq(self.bound, *writers)`
3. self.bound 是传入的节点执行器
4. `writers=self.flat_writers`
4. self.flat_writers 是对初始化传入 `writers=[ChannelWrite(self._writes)]` 里的 ChannelWrite 进行了合并
5. 所以最终 `proc_node=RunnableSeq(self.bound, ChannelWrite(self._writes))`
6. `self._writes 是 List[ChannelWriteEntry]` 包装了要写入的 channel
7. `RunnableSeq.invoke` 会分别调用 `self.bound` 和 `ChannelWrite` 的 `invoke` 方法
8. ChannelWrite.invoke 的调用过程前面的章节我们分析过，其写入最终调用的是从 RunnableConfig 中配置的写入函数: `write: TYPE_SEND = config[CONF][CONFIG_KEY_SEND]`
9. `config[CONF][CONFIG_KEY_SEND]` 正是 PregelExecutableTask 初始化时配置的 `writes.extend`。
10. 所以 PregelExecutableTask 执行的最终结果会把节点的执行结果写入到 PregelExecutableTask.writes 的 dequeue 中。


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

    def subscribe_to(
        self,
        *channels: str,
        read: bool = True,
    ) -> Self:
        if isinstance(self._channels, str):
            raise ValueError(
                "Cannot subscribe to channels when subscribed to a single channel"
            )
        if read:
            if not self._channels:
                self._channels = list(channels)
            else:
                # 从哪些 channel 读
                self._channels.extend(channels)

        # 被哪些 channel 触发
        if isinstance(channels, str):
            self._triggers.append(channels)
        else:
            self._triggers.extend(channels)

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

class PregelNode:
    @cached_property
    def node(self) -> Runnable[Any, Any] | None:
        """Get a runnable that combines `bound` and `writers`."""
        writers = self.flat_writers
        if self.bound is DEFAULT_BOUND and not writers:
            return None
        elif self.bound is DEFAULT_BOUND and len(writers) == 1:
            return writers[0]
        elif self.bound is DEFAULT_BOUND:
            return RunnableSeq(*writers)
        # 初始化时有 bound，也有 writers 所以走的是这个分支
        elif writers:
            return RunnableSeq(self.bound, *writers)
        else:
            return self.bound
```


## 3. local_read
这个函数 local_read 是 LangGraph 中用于从当前节点的 局部上下文状态 中读取数据的工具函数之一。它的作用是为**条件边（conditional edges）**提供一个“视图”——这个视图能看到当前节点写入的值（task.writes），但不会影响全局状态（即不会真正写入通道和托管状态）。

下面是 local_read 的代码:

```python
def local_read(
    scratchpad: PregelScratchpad,
    channels: Mapping[str, BaseChannel],
    managed: ManagedValueMapping,
    # PregelTaskWrites(task_path, name, writes, triggers)
    task: WritesProtocol,
    select: list[str] | str, # 要读取的字段
    fresh: bool = False,
) -> dict[str, Any] | Any:
    """Function injected under CONFIG_KEY_READ in task config, to read current state.
    Used by conditional edges to read a copy of the state with reflecting the writes
    from that node only."""
    updated: dict[str, list[Any]] = defaultdict(list)
    if isinstance(select, str):
        managed_keys = []
        for c, v in task.writes:
            if c == select:
                updated[c].append(v)
    else:
        # 从 ManagedValue 中要读的 key
        managed_keys = [k for k in select if k in managed]
        select = [k for k in select if k not in managed]
        for c, v in task.writes:
            if c in select:
                updated[c].append(v)
    if fresh and updated:
        # apply writes
        local_channels: dict[str, BaseChannel] = {}
        for k in channels:
            if k in updated:
                # 获取 channel 的复制，并更新
                cc = channels[k].copy()
                cc.update(updated[k])
            else:
                cc = channels[k]
            local_channels[k] = cc
        # read fresh values
        # 从 channel 读取最新值
        values = read_channels(local_channels, select)
    else:
        values = read_channels(channels, select)
    if managed_keys:
        values.update({k: managed[k].get(scratchpad) for k in managed_keys})
    return values

```

| 参数名          | 含义                                        |
| ------------ | ----------------------------------------- |
| `scratchpad` | 当前 Pregel 节点执行上下文状态缓存（传给托管值）              |
| `channels`   | 当前所有普通通道（channel）的只读视图，key 是通道名           |
| `managed`    | 当前所有托管变量（ManagedValue），key 是托管名           |
| `task`       | 当前节点的写操作对象，里面包含 `.writes` 字段：写入哪些变量以及它们的值 |
| `select`     | 想要读取的变量名（可以是字符串或字符串列表）                    |
| `fresh`      | 如果为 True，则需要将当前节点写入的值“临时应用”后再读取           |

task 传入的是 `PregelTaskWrites(task_path, name, writes, triggers)`，`writes = deque()`。

```python
class PregelTaskWrites(NamedTuple):
    """Simplest implementation of WritesProtocol, for usage with writes that
    don't originate from a runnable task, eg. graph input, update_state, etc."""

    path: tuple[str | int | tuple, ...]
    name: str
    writes: Sequence[tuple[str, Any]]
    triggers: Sequence[str] 
```

## 4. apply_write
函数 `apply_writes` 根据一组任务的写入操作：

* 将数据写入到通道（channels）；
* 更新版本信息（checkpoint）；
* 判断哪些通道被修改；
* **返回被更新的通道集合**，以供调度器用来触发后续节点。


### 4.1 函数签名

```python
def apply_writes(
    checkpoint: Checkpoint,
    channels: Mapping[str, BaseChannel],
    tasks: Iterable[WritesProtocol],
    get_next_version: GetNextVersion | None,
    trigger_to_nodes: Mapping[str, Sequence[str]],
) -> set[str]:
```

| 参数名                | 类型                          | 含义                               |
| ------------------ | --------------------------- | -------------------------------- |
| `checkpoint`       | `dict`                      | 保存每个通道的版本号、任务见过的版本等，属于全局运行状态的一部分 |
| `channels`         | `Mapping[str, BaseChannel]` | 所有当前通道对象（数据传递容器）                 |
| `tasks`            | `Iterable[WritesProtocol]`  | 当前要应用的任务集合（通常是一个 Pregel 步骤中活跃节点） |
| `get_next_version` | 可选的版本生成函数                   | 用于在写入后分配新版本号                     |
| `trigger_to_nodes` | 映射                          | 记录每个通道更新后可能触发的节点（用于图调度）          |

---

### 4.2 代码逻辑
apply_writes 正常流程下，有两类 channel 会被打上新的版本号：

* task.triggers 中的 channel；及触发当前task 的channel
* updated_channels，即被更新的 channel


```python
def apply_writes(
    checkpoint: Checkpoint,
    channels: Mapping[str, BaseChannel],
    tasks: Iterable[WritesProtocol],
    get_next_version: GetNextVersion | None,
    trigger_to_nodes: Mapping[str, Sequence[str]],
) -> set[str]:
    """Apply writes from a set of tasks (usually the tasks from a Pregel step)
    to the checkpoint and channels, and return managed values writes to be applied
    externally.

    Args:
        checkpoint: The checkpoint to update.
        channels: The channels to update.
        tasks: The tasks to apply writes from.
        get_next_version: Optional function to determine the next version of a channel.
        trigger_to_nodes: Mapping of channel names to the set of nodes that can be triggered by updates to that channel.

    Returns:
        Set of channels that were updated in this step.
    """
    # sort tasks on path, to ensure deterministic order for update application
    # any path parts after the 3rd are ignored for sorting
    # (we use them for eg. task ids which aren't good for sorting)
    # 保证同一超级步内写入操作应用顺序是**确定的**
    # 只比较 `path[:3]` 是为了排除不可排序的 task ID（可能是 UUID）
    tasks = sorted(tasks, key=lambda t: task_path_str(t.path[:3]))
    # if no task has triggers this is applying writes from the null task only
    # so we don't do anything other than update the channels written to
    # 所有 task 是否有触发器
    bump_step = any(t.triggers for t in tasks)

    # update seen versions
    # chan1 触发了 node1, node1 就能看到 chan1 当前的最新值
    for task in tasks:
        checkpoint["versions_seen"].setdefault(task.name, {}).update(
            {
                chan: checkpoint["channel_versions"][chan]
                # task.triggers 表示哪些 channel 触发了当前 task
                for chan in task.triggers
                if chan in checkpoint["channel_versions"]
            }
        )

    # Find the highest version of all channels
    # 获取当前最大版本 → 调用 `get_next_version()` 从 BaseCheckpointSaver 中获取下一个版本号
    if get_next_version is None:
        next_version = None
    else:
        next_version = get_next_version(
            (
                max(checkpoint["channel_versions"].values())
                if checkpoint["channel_versions"]
                else None
            ),
            None,
        )

    # Consume all channels that were read
    # 将触发 task 的 channel 设置为已消费，并将其 channe_version 设置成新版本
    for chan in {
        chan
        for task in tasks
        for chan in task.triggers
        # chan 不是 Langgraph 内置 channel
        if chan not in RESERVED and chan in channels
    }:
        # 将 channel 设置为 已消费状态
        if channels[chan].consume() and next_version is not None:
            # 如果成功 `consume()`，给 channel 设置新的版本
            # 表示该通道在这一 step 被读取了一次。
            checkpoint["channel_versions"][chan] = next_version

    # Group writes by channel
    # 将所有任务的写入内容按通道归类
    pending_writes_by_channel: dict[str, list[Any]] = defaultdict(list)
    for task in tasks:
        for chan, val in task.writes:
            if chan in (NO_WRITES, PUSH, RESUME, INTERRUPT, RETURN, ERROR):
                pass
            elif chan in channels:
                pending_writes_by_channel[chan].append(val)
            else:
                logger.warning(
                    f"Task {task.name} with path {task.path} wrote to unknown channel {chan}, ignoring it."
                )

    # Apply writes to channels
    # 应用写入，更新通道内容，并将这些被更新的 channel 的版本号更新为 next_version
    updated_channels: set[str] = set()
    for chan, vals in pending_writes_by_channel.items():
        if chan in channels:
            if channels[chan].update(vals) and next_version is not None:
                checkpoint["channel_versions"][chan] = next_version
                # unavailable channels can't trigger tasks, so don't add them
                # 如果 channel 可读取,加入 updated_channels
                if channels[chan].is_available():
                    updated_channels.add(chan)

    # Channels that weren't updated in this step are notified of a new step
    # 对其他通道执行 empty 更新（用于触发 step 推进）
    if bump_step:
        for chan in channels:
            # 目前还不清楚，为什么会出现这种情况
            if channels[chan].is_available() and chan not in updated_channels:
                # 写入空值会触发一些 `Channel` 的内部状态清理或触发机制。
                if channels[chan].update(EMPTY_SEQ) and next_version is not None:
                    checkpoint["channel_versions"][chan] = next_version
                    # unavailable channels can't trigger tasks, so don't add them
                    # 如果 channel 可读取,加入 updated_channels
                    if channels[chan].is_available():
                        updated_channels.add(chan)

    # If this is (tentatively) the last superstep, notify all channels of finish
    # 如果已经更新的 channel 和 trigger_to_nodes 没有交集说明已经没有下一步了，这是最后一步
    if bump_step and updated_channels.isdisjoint(trigger_to_nodes):
        for chan in channels:
            # 对所有通道调用 `finish()`，告知它们没有后续步骤了
            if channels[chan].finish() and next_version is not None:
                checkpoint["channel_versions"][chan] = next_version
                # unavailable channels can't trigger tasks, so don't add them
                if channels[chan].is_available():
                    updated_channels.add(chan)

    # Return managed values writes to be applied externally
    return updated_channels
```
