---
weight: 1
title: "pregel runner"
date: 2025-08-01T16:00:00+08:00
lastmod: 2025-08-01T16:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "pregel runner"
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

在 Pregel stream 方法中，PregelRunner 初始化如下:

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
            # Loop __enter__ 方法初始化了 submit
            # self.submit = self.stack.enter_context(BackgroundExecutor(self.config))
            CONFIG_KEY_RUNNER_SUBMIT, weakref.WeakMethod(loop.submit)
        ),
        # 向 loop 提交写入，put_writes 会将 writes 保存在 loop.checkpoint_pending_writes
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
在 Pregel stream 方法中，Runner.tick 被调用的代码如下，通过这段代码，我们可以了解 runner.tick方法每个参数的含义。

### 2.1 tick 调用
```python
                while loop.tick():
                    for task in loop.match_cached_writes():
                        loop.output_writes(task.id, task.writes, cached=True)
                    for _ in runner.tick(
                        # 没有 writes 说明 task 还没执行
                        [t for t in loop.tasks.values() if not t.writes],
                        timeout=self.step_timeout,
                        # get_waiter 是一个函数，阻塞等待一个信号量
                        # loop 在退出时会向信号量释放一个资源
                        # get_waiter 用于等待这个信号量
                        get_waiter=get_waiter,
                        # 向 loop 提交新的 task
                        schedule_task=loop.accept_push,
                    ):
                        # emit output
                        yield from _output(
                            stream_mode, print_mode, subgraphs, stream.get, queue.Empty
                        )
```

`tick()` **异步调度并执行一组任务（`PregelExecutableTask`）**，允许并发执行、失败重试、延迟调度、任务间独立、并支持 yield 回调、异常传播、限时等待等高级控制。


### 2.2 tick 代码

```python
def tick(
    self,
    tasks: Iterable[PregelExecutableTask],       # 要执行的任务集合
    *,
    reraise: bool = True,                        # 是否抛出异常
    timeout: float | None = None,                # 最大执行时间
    retry_policy: Sequence[RetryPolicy] | None = None,  # 重试策略
    get_waiter: Callable[[], Future[None]] | None = None,# 外部控制的等待器
    schedule_task: Callable[..., PregelExecutableTask | None], # PUSH 任务调度器
) -> Iterator[None]:
```

这是一个 **协程生成器（generator）函数**，用于逐步调度任务，期间通过 `yield` 暴露控制权给调用方（`loop.run(...)` 等调度循环）。在 tick 内会按照如下顺序执行:
1. run_with_retry(task): 执行
    - `task.writes.clear()`
    - `return task.proc.invoke(task.input, config)`
    - `task.proc` 保存的是 pregelnode.node 属性的返回值，`RunnableSeq(self.bound, *writers)`, writers 对应为 ChannelWrite
    - task.proc.invoke 执行时，会先调用 bound 的 invoke 方法，然后调用 ChannelWrite.invoke 方法
    - ChannelWrite.invoke 调用时会从 `config[CONF][CONFIG_KEY_SEND]` 获取 write 函数，并调用 `write(Sequence[tuple[str, Any]]])`
    - `config[CONF][CONFIG_KEY_SEND]` 是在 `PregelExecutableTask` 初始化时配置的，并在 `run_with_retry` 中对 config 做了合并，最终 `write=task.writes.extend`
    - 所以最终的结果是 `task.proc.invoke(task.input, config)` 将 `[(channel, value)]` 写入到 task.writes 的队列中
2. `self.commit(task, None)`
    - 会调用 `self.put_writes()(task.id, task.writes)`, `self.put_writes()=loop.put_writes`
    - `loop.put_writes` 会将 `task.writes` 写入到 `loop.checkpoint_pending_writes` 中，并把 task.writes 保存到 checkpoint db 中。


```python
    def tick(
        self,
        tasks: Iterable[PregelExecutableTask],
        *,
        reraise: bool = True,
        timeout: float | None = None,
        retry_policy: Sequence[RetryPolicy] | None = None,
        get_waiter: Callable[[], concurrent.futures.Future[None]] | None = None,
        schedule_task: Callable[
            [PregelExecutableTask, int, Call | None],
            PregelExecutableTask | None,
        ],
    ) -> Iterator[None]:
        tasks = tuple(tasks)
        # * `futures`: 跟踪所有并发任务对应的 `Future`
        # * `callback`: 所有任务完成后触发 `self.commit()` 提交结果
        # * `event`: 等待所有任务完成的信号量
        futures = FuturesDict(
            callback=weakref.WeakMethod(self.commit),
            event=threading.Event(),
            future_type=concurrent.futures.Future,
        )
        # give control back to the caller
        yield
        # fast path if single task with no timeout and no waiter
        if len(tasks) == 0:
            return
        elif len(tasks) == 1 and timeout is None and get_waiter is None:
            # 担任务直接运行，不用线程池
            t = tasks[0]
            try:
                run_with_retry(
                    t,
                    retry_policy,
                    configurable={
                        CONFIG_KEY_CALL: partial(
                            _call,
                            weakref.ref(t),
                            retry_policy=retry_policy,
                            futures=weakref.ref(futures),
                            schedule_task=schedule_task,
                            submit=self.submit,
                        ),
                    },
                )
                self.commit(t, None)
            except Exception as exc:
                self.commit(t, exc)
                if reraise and futures:
                    # will be re-raised after futures are done
                    fut: concurrent.futures.Future = concurrent.futures.Future()
                    fut.set_exception(exc)
                    futures.done.add(fut)
                elif reraise:
                    if tb := exc.__traceback__:
                        while tb.tb_next is not None and any(
                            tb.tb_frame.f_code.co_filename.endswith(name)
                            for name in EXCLUDED_FRAME_FNAMES
                        ):
                            tb = tb.tb_next
                        exc.__traceback__ = tb
                    raise
            if not futures:  # maybe `t` scheduled another task
                return
            else:
                tasks = ()  # don't reschedule this task
        # add waiter task if requested
        if get_waiter is not None:
            futures[get_waiter()] = None
        # schedule tasks
        for t in tasks:
            fut = self.submit()(  # type: ignore[misc]
                run_with_retry,
                t,
                retry_policy,
                configurable={
                    CONFIG_KEY_CALL: partial(
                        _call,
                        weakref.ref(t),
                        retry_policy=retry_policy,
                        futures=weakref.ref(futures),
                        schedule_task=schedule_task,
                        submit=self.submit,
                    ),
                },
                __reraise_on_exit__=reraise,
            )
            futures[fut] = t
        # execute tasks, and wait for one to fail or all to finish.
        # each task is independent from all other concurrent tasks
        # yield updates/debug output as each task finishes
        end_time = timeout + time.monotonic() if timeout else None
        while len(futures) > (1 if get_waiter is not None else 0):
            done, inflight = concurrent.futures.wait(
                futures,
                return_when=concurrent.futures.FIRST_COMPLETED,
                timeout=(max(0, end_time - time.monotonic()) if end_time else None),
            )
            if not done:
                break  # timed out
            for fut in done:
                task = futures.pop(fut)
                if task is None:
                    # waiter task finished, schedule another
                    if inflight and get_waiter is not None:
                        futures[get_waiter()] = None
            else:
                # remove references to loop vars
                del fut, task
            # maybe stop other tasks
            if _should_stop_others(done):
                break
            # give control back to the caller
            yield
        # wait for done callbacks
        futures.event.wait(
            timeout=(max(0, end_time - time.monotonic()) if end_time else None)
        )
        # give control back to the caller
        yield
        # panic on failure or timeout
        try:
            _panic_or_proceed(
                futures.done.union(f for f, t in futures.items() if t is not None),
                panic=reraise,
            )
        except Exception as exc:
            if tb := exc.__traceback__:
                while tb.tb_next is not None and any(
                    tb.tb_frame.f_code.co_filename.endswith(name)
                    for name in EXCLUDED_FRAME_FNAMES
                ):
                    tb = tb.tb_next
                exc.__traceback__ = tb
            raise
```

### 2.3 commit


## 3. _output
在 Pregel.stream 的代码中，调用 runner.tick 的过程中会调用一个 _output 向外输出结果。因为这部分内容是和 runner 密切相关的，所以我们放在这里讲解。下面是调用的代码，
_output 各个入参的类型如下:
1. stream_mode: `tuple[str]`
2. print_mode: `tuple[str]`
3. subgraphs: bool
4. stream: SyncQueue

```python
                while loop.tick():
                    for task in loop.match_cached_writes():
                        loop.output_writes(task.id, task.writes, cached=True)
                    for _ in runner.tick(
                        # 没有 writes 说明 task 还没执行
                        [t for t in loop.tasks.values() if not t.writes],
                        timeout=self.step_timeout,
                        get_waiter=get_waiter,
                        schedule_task=loop.accept_push,
                    ):
                        # emit output
                        yield from _output(
                            stream_mode, print_mode, subgraphs, stream.get, queue.Empty
                        )
```

### 3.1 _output 源码

```python
def _output(
    stream_mode: StreamMode | Sequence[StreamMode],
    print_mode: StreamMode | Sequence[StreamMode],
    stream_subgraphs: bool,
    getter: Callable[[], tuple[tuple[str, ...], str, Any]],
    empty_exc: type[Exception],
) -> Iterator:
    while True:
        try:
            # 调用 stream.get 从队列中获取数据
            ns, mode, payload = getter()
        except empty_exc:
            break
        # 调试 print
        if mode in print_mode:
            if stream_subgraphs and ns:
                print(
                    " ".join(
                        (
                            get_bolded_text(f"[{mode}]"),
                            get_colored_text(f"[graph={ns}]", color="yellow"),
                            repr(payload),
                        )
                    )
                )
            else:
                print(
                    " ".join(
                        (
                            get_bolded_text(f"[{mode}]"),
                            repr(payload),
                        )
                    )
                )
        # 不同的输出模式 yield 不同格式的数据。
        if mode in stream_mode:
            if stream_subgraphs and isinstance(stream_mode, list):
                yield (ns, mode, payload)
            elif isinstance(stream_mode, list):
                yield (mode, payload)
            elif stream_subgraphs:
                yield (ns, payload)
            else:
                yield payload
```

### 3.2 SyncQueue 的数据传递流程
我们现在来看数据是如何在 SyncQueue 中传递的:
1. 前面我们提到过 runner.tick 在执行时会调用 commit 方法
2. commit 方法会调用 loop.put_writes，将 `writes=[(channel, value)]` 传递过去
3. 在 loop.put_writes 方法内存在如下调用链:
    - `loop.output_writes`
    - `loop._emit`
    - `self.stream`
4. `self.stream` 是在 Loop 初始化时传入的 `StreamProtocol(stream.put, stream_modes)`
5. 最终 runner.tick 会把数据放到 SyncQueue 中，_output 会从 SyncQueue 获取数据返回
