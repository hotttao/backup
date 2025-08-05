---
weight: 1
title: "langgraph PregelNode"
date: 2025-08-01T9:00:00+08:00
lastmod: 2025-08-01T9:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langgraph PregelNode"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

## 1. PregelNode
### 1.1 PregelNode 属性

前面我们已经了解到，PregelNode 没有抽象方法，且有如下属性:

| 属性名            | 类型                              | 语义作用                                  | 使用场景 / 示例                                                 |
| -------------- | ------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| `channels`     | `str \| list[str]`              | 输入通道名称（单个或多个）。决定从哪些通道读取输入并传给 `bound`。 | `channels="user_input"` 或 `channels=["query", "history"]` |
| `triggers`     | `list[str]`                     | 当这些通道被写入时，当前节点在下一轮中被激活执行。             | 通常用来响应其他节点的输出或外部信号                                        |
| `mapper`       | `Callable[[Any], Any] \| None`  | 在传给 `bound` 之前对输入值进行转换或预处理。           | 如将多个输入组合成特定格式                                             |
| `writers`      | `list[Runnable]`                | 在节点计算完成后，接管输出结果并写入对应通道。可自定义写入行为。      | 比如将 `bound` 的输出写入到多个通道                                    |
| `bound`        | `Runnable[Any, Any]`            | 节点的核心执行逻辑，会接收来自 `channels` 的输入并返回输出。  | 可以是函数、链、LLM 调用等                                           |
| `retry_policy` | `Sequence[RetryPolicy] \| None` | 节点执行失败时的重试策略。支持如指数退避、最大次数等。           | 提高健壮性，处理临时失败                                              |
| `cache_policy` | `CachePolicy \| None`           | 节点的缓存策略。用于跳过相同输入的重复执行。                | 性能优化，节省 LLM token 或 API 请求                                |
| `tags`         | `Sequence[str] \| None`         | 附加在节点上的标记，用于 tracing、debug、日志等用途。     | 如 `["llm", "retriever"]`                                  |
| `metadata`     | `Mapping[str, Any] \| None`     | 附加在节点上的任意键值对信息，用于 tracing 或运行时识别。     | 比如记录节点版本、模型 ID                                            |
| `subgraphs`    | `Sequence[PregelProtocol]`      | 嵌套图，表示该节点内部可递归执行子图。                   | 实现复杂控制流或组件级封装                                             |

### 1.2 PregelNode 方法

PregelNode 实现了 Runnable 协议，具体的实现方法是向下面这样，委托给 bound 属性:

```python
    def invoke(
        self,
        input: Any,
        config: RunnableConfig | None = None,
        **kwargs: Any | None,
    ) -> Any:
        return self.bound.invoke(
            input,
            merge_configs({"metadata": self.metadata, "tags": self.tags}, config),
            **kwargs,
        )
```

除了 Runnable 的接口方法，还有如下几个方法需要我们关注:

| 方法名               | 作用描述                                                         | 输出值类型                                                            |        |
| ----------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- | ------ |
| `flat_writers`    | 返回合并优化后的 `writers` 列表（合并连续的 `ChannelWrite` 操作，避免冗余写操作）       | `list[Runnable]`                                                 |        |
| `node`            | 构建一个复合 `Runnable`，将 `bound` 和 `writers` 合并为一个节点运行体，作为该节点的主逻辑 | `Runnable[Any, Any]                                            | None` |
| `input_cache_key` | 返回该节点输入的缓存键（由 mapper 和 channels 决定），用于避免重复计算输入               | `INPUT_CACHE_KEY_TYPE`（即 `tuple[Callable, tuple[Channel, ...]]`） |        |


#### __init__

```python
    def __init__(
        self,
        *,
        channels: str | list[str],
        triggers: Sequence[str],
        mapper: Callable[[Any], Any] | None = None,
        writers: list[Runnable] | None = None,
        tags: list[str] | None = None,
        metadata: Mapping[str, Any] | None = None,
        bound: Runnable[Any, Any] | None = None,
        retry_policy: RetryPolicy | Sequence[RetryPolicy] | None = None,
        cache_policy: CachePolicy | None = None,
        subgraphs: Sequence[PregelProtocol] | None = None,
    ) -> None:
        self.channels = channels
        self.triggers = list(triggers)
        self.mapper = mapper
        self.writers = writers or []
        self.bound = bound if bound is not None else DEFAULT_BOUND
        self.cache_policy = cache_policy
        if isinstance(retry_policy, RetryPolicy):
            self.retry_policy = (retry_policy,)
        else:
            self.retry_policy = retry_policy
        self.tags = tags
        self.metadata = metadata
        if subgraphs is not None:
            self.subgraphs = subgraphs
        elif self.bound is not DEFAULT_BOUND:
            try:
                subgraph = find_subgraph_pregel(self.bound)
            except Exception:
                subgraph = None
            if subgraph:
                self.subgraphs = [subgraph]
            else:
                self.subgraphs = []
        else:
            self.subgraphs = []

```

PregelNode 初始化代码中比较难理解的是 subgraphs 的处理。未传入 subgraphs 时，会调用 `find_subgraph_pregel(self.bound)`

find_subgraph_pregel 的作用是在一个复杂的 Runnable 链（可能嵌套、封装）中递归查找第一个合格的 PregelProtocol 实例（即符合要求的子图 Pregel 实例）。

```python
def find_subgraph_pregel(candidate: Runnable) -> PregelProtocol | None:
    from langgraph.pregel import Pregel

    candidates: list[Runnable] = [candidate]

    for c in candidates:
        # 第一个合格 Pregel
        if (
            isinstance(c, PregelProtocol)
            # subgraphs that disabled checkpointing are not considered
            and (not isinstance(c, Pregel) or c.checkpointer is not False)
        ):
            return c
        elif isinstance(c, RunnableSequence) or isinstance(c, RunnableSeq):
            candidates.extend(c.steps)
        # 获取 RunnableLambda 或 RunnableCallable 中的依赖
        elif isinstance(c, RunnableLambda):
            candidates.extend(c.deps)
        elif isinstance(c, RunnableCallable):
            if c.func is not None:
                candidates.extend(
                    # 如果非局部变量有 __self__，说明是绑定方法，取出其实例。
                    nl.__self__ if hasattr(nl, "__self__") else nl
                    for nl in get_function_nonlocals(c.func)
                )
            elif c.afunc is not None:
                candidates.extend(
                    nl.__self__ if hasattr(nl, "__self__") else nl
                    for nl in get_function_nonlocals(c.afunc)
                )

    return None
```


get_function_nonlocals 用于获取函数依赖(依赖的全局变量、闭包变量)。我先看下面这个例子:


```python
from langgraph.pregel._utils import get_function_nonlocals


class A:
    def __init__(self):
        self.a = 1


db_config = {"host": "localhost", "port": 3306}
A_CONFIG = A()


def outer():
    factor = 10

    def inner(x):
        return x * factor + db_config["port"] + A_CONFIG.a

    return inner


inner_fn = outer()
print(get_function_nonlocals(inner_fn))
# [1, {'host': 'localhost', 'port': 3306}, 10]
```

具体的我们看看 get_function_nonlocals 的实现:

```python
def get_function_nonlocals(func: Callable) -> list[Any]:
    """Get the nonlocal variables accessed by a function.

    Args:
        func: The function to check.

    Returns:
        List[Any]: The nonlocal variables accessed by the function.
    获取某个函数中访问到的非局部变量（nonlocal variables）的实际值列表。
    """
    try:
        # 获取函数源码并解析 AST
        code = inspect.getsource(func)
        tree = ast.parse(textwrap.dedent(code))
        # 使用 AST visitor 收集非局部变量名
        visitor = FunctionNonLocals()
        visitor.visit(tree)
        # visitor.nonlocals 示例返回:  {'A_CONFIG.a', 'factor', 'db_config', 'x'}
        closure = (
            # inspect.getclosurevars 会返回一个包含闭包变量的命名空间：包括 globals, nonlocals, builtins, unbound
            inspect.getclosurevars(func.__wrapped__)
            # 函数是被装饰器包装的（即 __wrapped__ 存在），则获取原始函数
            if hasattr(func, "__wrapped__") and callable(func.__wrapped__)
            else inspect.getclosurevars(func)
        )
        # 获取函数依赖的变量
        # 示例返回: {'A_CONFIG': <__main__.A object at 0x00000191C6C70E30>, 'db_config': {'host': 'localhost', 'port': 3306}, 'factor': 10}
        candidates = {**closure.globals, **closure.nonlocals}

        for k, v in candidates.items():
            if k in visitor.nonlocals:
                values.append(v)
            for kk in visitor.nonlocals:
                # 支持嵌套属性访问 eg: A_CONFIG.a
                if "." in kk and kk.startswith(k):
                    vv = v
                    for part in kk.split(".")[1:]:
                        if vv is None:
                            break
                        else:
                            try:
                                vv = getattr(vv, part)
                            except AttributeError:
                                break
                    else:
                        values.append(vv)
    except (SyntaxError, TypeError, OSError, SystemError):
        return []

    return values
```

#### flat_writers

writers 在节点计算完成后，接管输出结果并写入对应通道。flat_writers 返回合并优化后的 `writers` 列表（合并连续的 `ChannelWrite` 操作，避免冗余写操作）。关于 ChannelWrite 我们学习完 Channel 之后再看。

```python
    @cached_property
    def flat_writers(self) -> list[Runnable]:
        """Get writers with optimizations applied. Dedupes consecutive ChannelWrites."""
        writers = self.writers.copy()
        while (
            len(writers) > 1
            and isinstance(writers[-1], ChannelWrite)
            and isinstance(writers[-2], ChannelWrite)
        ):
            # we can combine writes if they are consecutive
            # careful to not modify the original writers list or ChannelWrite
            writers[-2] = ChannelWrite(
                writes=writers[-2].writes + writers[-1].writes,
            )
            writers.pop()
        return writers
```

#### node
node 方法用于将 `bound` 和 `writers` 合并为一个 `Runnable`。代码中使用到的 RunnableSeq 是 langgraph 实现的类似 RunnableSequence 的对象。目前不太清楚，为什么 langgraph 要定义 RunnableSeq。

```python
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
        elif writers:
            return RunnableSeq(self.bound, *writers)
        else:
            return self.bound
```


#### input_cache_key

mapper 用于在传给 `bound` 之前对输入值进行转换或预处理，input_cache_key 用于获取缓存 key，避免重复计算。

```python
    @cached_property
    def input_cache_key(self) -> INPUT_CACHE_KEY_TYPE:
        """Get a cache key for the input to the node.
        This is used to avoid calculating the same input multiple times."""
        return (
            self.mapper,
            (
                tuple(self.channels)
                if isinstance(self.channels, list)
                else (self.channels,)
            ),
        )

```