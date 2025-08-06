---
weight: 1
title: "langgraph pregel executor"
date: 2025-08-01T16:00:00+08:00
lastmod: 2025-08-01T16:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langgraph pregel executor"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

executor 是 langgraph 中对任务池的抽象。分为同步和异步两个实现。

## 1. BackgroundExecutor 
BackgroundExecutor 是一个基于线程池的上下文管理器，用于在后台并行运行多个同步任务（函数），并在退出上下文时安全地清理、等待和处理异常。

### 1.1 BackgroundExecutor 初始化
下面是 BackgroundExecutor 的初始化代码:

get_executor_for_config 用于获取 ContextThreadPoolExecutor。ContextThreadPoolExecutor 继承自 concurrent.futures.ThreadPoolExecutor，重载了 submit、map 方法，保证任务在 copy_context().run 中运行，从而可以继承当前上下文的变量。

```python
class ContextThreadPoolExecutor(ThreadPoolExecutor):
    """ThreadPoolExecutor that copies the context to the child thread."""

    def submit(  # type: ignore[override]
        self,
        func: Callable[P, T],
        *args: P.args,
        **kwargs: P.kwargs,
    ) -> Future[T]:
        """Submit a function to the executor.

        Args:
            func (Callable[..., T]): The function to submit.
            *args (Any): The positional arguments to the function.
            **kwargs (Any): The keyword arguments to the function.

        Returns:
            Future[T]: The future for the function.
        """
        return super().submit(
            cast("Callable[..., T]", partial(copy_context().run, func, *args, **kwargs))
        )

    def map(
        self,
        fn: Callable[..., T],
        *iterables: Iterable[Any],
        timeout: float | None = None,
        chunksize: int = 1,
    ) -> Iterator[T]:
        """Map a function to multiple iterables.

        Args:
            fn (Callable[..., T]): The function to map.
            *iterables (Iterable[Any]): The iterables to map over.
            timeout (float | None, optional): The timeout for the map.
                Defaults to None.
            chunksize (int, optional): The chunksize for the map. Defaults to 1.

        Returns:
            Iterator[T]: The iterator for the mapped function.
        """
        contexts = [copy_context() for _ in range(len(iterables[0]))]  # type: ignore[arg-type]

        def _wrapped_fn(*args: Any) -> T:
            return contexts.pop().run(fn, *args)

        return super().map(
            _wrapped_fn,
            *iterables,
            timeout=timeout,
            chunksize=chunksize,
        )

@contextmanager
def get_executor_for_config(
    config: Optional[RunnableConfig],
) -> Generator[Executor, None, None]:
    """Get an executor for a config.

    Args:
        config (RunnableConfig): The config.

    Yields:
        Generator[Executor, None, None]: The executor.
    """
    config = config or {}
    with ContextThreadPoolExecutor(
        max_workers=config.get("max_concurrency")
    ) as executor:
        yield executor


class BackgroundExecutor(AbstractContextManager):
    """A context manager that runs sync tasks in the background.
    Uses a thread pool executor to delegate tasks to separate threads.
    On exit,
    - cancels any (not yet started) tasks with `__cancel_on_exit__=True`
    - waits for all tasks to finish
    - re-raises the first exception from tasks with `__reraise_on_exit__=True`"""

    def __init__(self, config: RunnableConfig) -> None:
        self.stack = ExitStack()
        self.executor = self.stack.enter_context(get_executor_for_config(config))
        # mapping of Future to (__cancel_on_exit__, __reraise_on_exit__) flags
        self.tasks: dict[concurrent.futures.Future, tuple[bool, bool]] = {}
```

BackgroundExecutor 有 submit/done 两个方法，并实现了上下文管理器协议。我们一一来看。

### 1.2 BackgroundExecutor submit 方法
submit 方法的参数含义如下:

| 参数名                   | 类型               | 说明                                             |                                        |
| --------------------- | ---------------- | ---------------------------------------------- | -------------------------------------- |
| `fn`                  | `Callable[P, T]` | 要执行的同步函数，参数类型为 `P`（参数签名），返回类型为 `T`。泛型绑定方便类型推导。 |                                        |
| `*args`               | `P.args`         | `fn` 的位置参数。                                    |                                        |
| `**kwargs`            | `P.kwargs`       | `fn` 的关键字参数。                                   |                                        |
| `__name__`            | \`str            | None\`                                         | **任务名称（暂未使用）**。当前在同步版中没有使用，可能为日志或调试保留。 |
| `__cancel_on_exit__`  | `bool`           | 控制：如果任务还没执行，在退出上下文时是否取消它（仅适用于未启动的任务）。          |                                        |
| `__reraise_on_exit__` | `bool`           | 控制：如果任务抛出了异常，是否在退出上下文时重新抛出该异常。默认开启。            |                                        |
| `__next_tick__`       | `bool`           | 控制：是否使用 `next_tick` 包装任务（延迟执行到事件循环的“下一 tick”）。 |                                        |


```python
    def submit(  # type: ignore[valid-type]
        self,
        fn: Callable[P, T],
        *args: P.args,
        __name__: str | None = None,  # currently not used in sync version
        __cancel_on_exit__: bool = False,  # for sync, can cancel only if not started
        __reraise_on_exit__: bool = True,
        __next_tick__: bool = False,
        **kwargs: P.kwargs,
    ) -> concurrent.futures.Future[T]:
        ctx = copy_context()
        if __next_tick__:
            task = cast(
                concurrent.futures.Future[T],
                # time.sleep(0) 让出当前线程，给其他线程执行机会
                self.executor.submit(next_tick, ctx.run, fn, *args, **kwargs),  # type: ignore[arg-type]
            )
        else:
            task = self.executor.submit(ctx.run, fn, *args, **kwargs)
        self.tasks[task] = (__cancel_on_exit__, __reraise_on_exit__)
        # add a callback to remove the task from the tasks dict when it's done
        task.add_done_callback(self.done)
        return task

def next_tick(fn: Callable[P, T], *args: P.args, **kwargs: P.kwargs) -> T:
    """A function that yields control to other threads before running another function."""
    time.sleep(0)
    return fn(*args, **kwargs)
```

### 1.3 BackgroundExecutor done 方法
BackgroundExecutor 的 done 方法在任务完成时被调用。它的主要作用是从 `self.tasks` 字典中移除已完成的任务。

```python
    def done(self, task: concurrent.futures.Future) -> None:
        """Remove the task from the tasks dict when it's done."""
        try:
            task.result()
        except GraphBubbleUp:
            # This exception is an interruption signal, not an error
            # so we don't want to re-raise it on exit
            self.tasks.pop(task)
        except BaseException:
            pass
        else:
            self.tasks.pop(task)
```


### 1.4 BackgroundExecutor 上下文管理器协议
代码注释的比较清楚，直接对照的注释看即可。

```python
    # with 返回的是 submit 方法，用于提交任务
    def __enter__(self) -> Submit:
        return self.submit

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> bool | None:
        # copy the tasks as done() callback may modify the dict
        tasks = self.tasks.copy()
        # cancel all tasks that should be cancelled
        for task, (cancel, _) in tasks.items():
            if cancel:
                task.cancel()
        # wait for all tasks to finish
        if pending := {t for t in tasks if not t.done()}:
            concurrent.futures.wait(pending)
        # shutdown the executor
        self.stack.__exit__(exc_type, exc_value, traceback)
        # if there's already an exception being raised, don't raise another one
        if exc_type is None:
            # re-raise the first exception that occurred in a task
            for task, (_, reraise) in tasks.items():
                if not reraise:
                    continue
                try:
                    task.result()
                except concurrent.futures.CancelledError:
                    pass
```

## 2. AsyncBackgroundExecutor