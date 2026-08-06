---
weight: 1
title: "pregel loop - 2"
date: 2025-08-01T17:00:00+08:00
lastmod: 2025-08-01T17:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "pregel loop - 2"

featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

上一节我们介绍了 pregel loop 的初始化、tick 函数。tick 函数其实也没有介绍完，并标记了我们要理解的其他方法，包括:
1. `_emit`
2. `_put_checkpoint`
3. `put_writes`

这一节我们来学习这些函数的实现。

## 1. _emit
### 1.1 _emit 执行逻辑
`_emit` 函数的作用是外部传递事件。

```python
    def _emit(
        self,
        mode: StreamMode,
        values: Callable[P, Iterator[Any]],
        *args: P.args,
        **kwargs: P.kwargs,
    ) -> None:
        # stream 是 loop 初始化是传入的 `stream=StreamProtocol(stream.put, stream_modes),`
        # stream = SyncQueue()
        if self.stream is None:
            return
        debug_remap = mode in ("checkpoints", "tasks") and "debug" in self.stream.modes
        if mode not in self.stream.modes and not debug_remap:
            return
        for v in values(*args, **kwargs):
            if mode in self.stream.modes:
                # 向 queue 发送事件
                self.stream((self.checkpoint_ns, mode, v))
            # "debug" mode is "checkpoints" or "tasks" with a wrapper dict
            if debug_remap:
                self.stream(
                    (
                        self.checkpoint_ns,
                        "debug",
                        {
                            "step": self.step - 1
                            if mode == "checkpoints"
                            else self.step,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "type": "checkpoint"
                            if mode == "checkpoints"
                            else "task_result"
                            if "result" in v
                            else "task",
                            "payload": v,
                        },
                    )
                )
```

### 1.2 tick 中调用的 _emit
tick 调用 `_emit` 时传入了一个 map_debug_checkpoint 函数。

```python
        if self._checkpointer_put_after_previous is not None:
            self._emit(
                "checkpoints",
                map_debug_checkpoint,
                ...
            )
```

map_debug_checkpoint(...) 是 LangGraph 中用于构建调试用 checkpoint 数据结构 的函数，输出格式为 CheckpointPayload。

## 2. _put_checkpoint
`_put_checkpoint(...)` 是 LangGraph 中用于 **保存执行中间状态（checkpoint）** 的关键函数之一。它负责将当前图的执行状态、通道状态等通过后端存储器（checkpointer）保存下来。

_put_checkpoint 代码的注释一下，重点关注 `self._put_checkpoint_fut = self.submit(`。

```python
    def _put_checkpoint(self, metadata: CheckpointMetadata) -> None:
        # assign step and parents
        # 判断是否为当前退出点的 checkpoint
        # `exiting == True` 表示这是图执行准备结束时（`exit`）要保存的 checkpoint。
        exiting = metadata is self.checkpoint_metadata
        # 如果已经保存，直接退出
        if exiting and self.checkpoint["id"] == self.checkpoint_id_saved:
            # checkpoint already saved
            return
        # 如果是新 checkpoint，补充元数据（step、parents）
        if not exiting:
            metadata["step"] = self.step
            metadata["parents"] = self.config[CONF].get(CONFIG_KEY_CHECKPOINT_MAP, {})
            self.checkpoint_metadata = metadata
        # do checkpoint?
        # 是否要真正执行保存？
        do_checkpoint = self._checkpointer_put_after_previous is not None and (
            exiting or self.durability != "exit"
        )
        # create new checkpoint
        # 构造新的 checkpoint 数据结构
        self.checkpoint = create_checkpoint(
            self.checkpoint,
            self.channels if do_checkpoint else None,
            self.step,
            id=self.checkpoint["id"] if exiting else None,
        )
        # bail if no checkpointer
        if do_checkpoint and self._checkpointer_put_after_previous is not None:
            self.prev_checkpoint_config = (
                self.checkpoint_config
                if CONFIG_KEY_CHECKPOINT_ID in self.checkpoint_config[CONF]
                and self.checkpoint_config[CONF][CONFIG_KEY_CHECKPOINT_ID]
                else None
            )
            self.checkpoint_config = {
                **self.checkpoint_config,
                CONF: {
                    **self.checkpoint_config[CONF],
                    CONFIG_KEY_CHECKPOINT_NS: self.config[CONF].get(
                        CONFIG_KEY_CHECKPOINT_NS, ""
                    ),
                },
            }

            channel_versions = self.checkpoint["channel_versions"].copy()
            new_versions = get_new_channel_versions(
                self.checkpoint_previous_versions, channel_versions
            )
            self.checkpoint_previous_versions = channel_versions

            # save it, without blocking
            # if there's a previous checkpoint save in progress, wait for it
            # ensuring checkpointers receive checkpoints in order
            # 异步保存
            self._put_checkpoint_fut = self.submit(
                self._checkpointer_put_after_previous,
                # 如果是第一次执行，这个属性为 None
                # 第二次执行，这个属性是第一次 submit 返回的 Future
                # checkpoint 的保存会延时一个提交？
                getattr(self, "_put_checkpoint_fut", None),
                self.checkpoint_config,
                copy_checkpoint(self.checkpoint),
                self.checkpoint_metadata,
                new_versions,
            )
            # 更新 `checkpoint_config` 中的 checkpoint id
            self.checkpoint_config = {
                **self.checkpoint_config,
                CONF: {
                    **self.checkpoint_config[CONF],
                    CONFIG_KEY_CHECKPOINT_ID: self.checkpoint["id"],
                },
            }
        if not exiting:
            # increment step
            self.step += 1
```

## 3. put_writes
 `put_writes`，主要功能是 **将某个 task 的写入信息 `writes` 存储到 `checkpoint_pending_writes` 中，供下一个 tick（调度轮次）使用，同时调用 checkpointer 实现持久化。**


```python
class PregelLoop:
    def put_writes(self, task_id: str, writes: WritesT) -> None:
        """Put writes for a task, to be read by the next tick."""
        # WritesT = Sequence[tuple[str, Any]]
        if not writes:
            return
        # deduplicate writes to special channels, last write wins
        # channel 都是 `WRITES_IDX_MAP` 中的特殊通道（常用于状态同步或调度控制）
        # 去重（以 channel 为键，保留最后一次写入
        if all(w[0] in WRITES_IDX_MAP for w in writes):
            writes = list({w[0]: w for w in writes}.values())
        if task_id == NULL_TASK_ID:
            # writes for the null task are accumulated
            # 过滤出非 special channel 写入
            self.checkpoint_pending_writes = [
                w
                # w 保存的是 (task_id, channel, value)
                for w in self.checkpoint_pending_writes
                if w[0] != task_id or w[1] not in WRITES_IDX_MAP
            ]
            writes_to_save: WritesT = [
                w[1:] for w in self.checkpoint_pending_writes if w[0] == task_id
            ] + list(writes)
        else:
            # remove existing writes for this task
            self.checkpoint_pending_writes = [
                w for w in self.checkpoint_pending_writes if w[0] != task_id
            ]
            writes_to_save = writes
        # save writes
        self.checkpoint_pending_writes.extend((task_id, c, v) for c, v in writes)
        # checkpointer_put_writes = BaseCheckpointSaver.put_writes 方法
        if self.durability != "exit" and self.checkpointer_put_writes is not None:
            config = patch_configurable(
                self.checkpoint_config,
                {
                    CONFIG_KEY_CHECKPOINT_NS: self.config[CONF].get(
                        CONFIG_KEY_CHECKPOINT_NS, ""
                    ),
                    CONFIG_KEY_CHECKPOINT_ID: self.checkpoint["id"],
                },
            )
            if self.checkpointer_put_writes_accepts_task_path:
                if hasattr(self, "tasks"):
                    task = self.tasks.get(task_id)
                else:
                    task = None
                self.submit(
                    self.checkpointer_put_writes,
                    config,
                    writes_to_save,
                    task_id,
                    task_path_str(task.path) if task else "",
                )
            else:
                self.submit(
                    self.checkpointer_put_writes,
                    config,
                    writes_to_save,
                    task_id,
                )
        # output writes
        if hasattr(self, "tasks"):
            self.output_writes(task_id, writes)
```

## 4. output_writes 

`output_writes` 用于 **对外发出任务写入结果的机制**，作用是：

> **根据 task 的写入结果 `writes`，向外部系统或调试工具发送 update（更新）、interrupt（中断）或 task 结果信息。**

```python
    def output_writes(
        self, task_id: str, writes: WritesT, *, cached: bool = False
    ) -> None:
        if task := self.tasks.get(task_id):
            # 过滤隐藏任务
            if task.config is not None and TAG_HIDDEN in task.config.get(
                "tags", EMPTY_SEQ
            ):
                return
            # 处理终端
            if writes[0][0] == INTERRUPT:
                # in loop.py we append a bool to the PUSH task paths to indicate
                # whether or not a call was present. If so,
                # we don't emit the interrupt as it'll be emitted by the parent
                # 说明父图已经处理了中断，当前图不需要再处理
                if task.path[0] == PUSH and task.path[-1] is True:
                    return
                interrupts = [
                    {
                        INTERRUPT: tuple(
                            v
                            for w in writes
                            if w[0] == INTERRUPT
                            for v in (w[1] if isinstance(w[1], Sequence) else (w[1],))
                        )
                    }
                ]
                # 生成中断事件并发送
                self._emit("updates", lambda: iter(interrupts))
            elif writes[0][0] != ERROR:
                # 普通写入
                self._emit(
                    "updates",
                    # 通过 `map_output_updates` 映射成 update 格式
                    map_output_updates,
                    self.output_keys,
                    [(task, writes)],
                    cached,
                )
            if not cached:
                # 如果不是来自缓存（即是新执行产生的 writes）
                self._emit(
                    "tasks",
                    # 使用 `map_debug_task_results` 转换为调试格式
                    map_debug_task_results,
                    (task, writes),
                    self.stream_keys,
                )
```
