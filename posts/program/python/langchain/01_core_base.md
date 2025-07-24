---
weight: 1
title: "langchain-core 核心对象"
date: 2025-07-20T22:00:00+08:00
lastmod: 2025-07-20T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langchain 的核心抽象"
featuredImage: 

tags: ["langchain 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

本周开始学习 langchain，大约经历了如下的过程:
1. 简单阅读了 langchain 文档，学习了 LCEL，LCEL 的基本接口是 Runnable 
2. 读到 astream_log 方法时候，感觉模棱两可，看 langchain-core 的代码
3. 看到 RunnableSequence invoke 方法时，里面涉及的对象逐渐变多，开始有点迷失在代码细节，无法掌握整体的调用流程
4. 使用 pycharm Diagrams 查看了不通模块核心类的继承关系

下面是 langchain-core 核心结构记录。查看类继承关系时，用过 pyreverse、pyan3 都不太好用，pyreverse 无法解析泛型，pyan3 一直报错，这里做一下记录。


## 1. langchain 代码结构
langchain-core 包含如下几个模块。

```bash
tree -L 1 -d  langchain_core/
langchain_core/
├── _api
├── beta
├── callbacks
├── document_loaders
├── documents
├── embeddings
├── example_selectors
├── indexing
├── language_models
├── load
├── messages
├── output_parsers
├── outputs
├── prompts
├── pydantic_v1
├── runnables
├── tools
├── tracers
├── utils
└── vectorstores
```

### 1.1 runnables
Runnable 定义在 runnables 模块，是 langchain 核心的抽象类。

![runnables 类图](/images/langchain/runnable-all.svg)

可以看到:
1. Runnable 是最基础的抽象类，但是大多数对象都是继承自 RunnableSerializable
2. 除此之外还有一个 RunnableConfig 类。虽然类图中没有显示，但是这个对象也很重要，RunnableConfig 用于在整个 LCEL 中传递配置和参数。

具体每个类是干什么的，我们先放一放，后面再详细介绍。

### 1.2 callbacks
callbacks 类图如下，类非常多，看起来也比较混乱。
![callback 类图](/images/langchain/callbacks-all.svg)

简单浏览一下代码，callbacks 的实现用有许多 Mixin 混合类，这些类的目的是提供一些方法的默认实现。把这些类删除之后，得到如下的类图:
![callback 简化类图](/images/langchain/callbacks.svg)

可以看到 callbacks 提供了三个核心的基础抽象:
1. BaseCallbackHandler 
2. BaseCallbackManager
3. BaseRunManager

### 1.3 tracer 
![tracer 类图](/images/langchain/tracer.svg)

tracer 模块中的类也很多。但是可以看到:
1. 所有的 tracer 类都继承自 callbacks 的 BaseCallbackHandler
2. _TracerCore 和 BaseModelV1 应该是为监控所做的基本抽象，这个对我们理解真个 LCEL 来说暂时不重要，我们也可以忽略。

### 1.4 messages
![messages 类图](/images/langchain/messages.svg)

messages 模块提供了一个 BaseMessage 的抽象。


### 1.5 prompts
![prompts 类图](/images/langchain/prompts.svg)

prompts 模块提供的抽象继承自 runnables.RunnableSerializable


### 1.6 vectorstores
![vectorstores 类图](/images/langchain/vectorstores.svg)

vectorstores 模块提供的BaseRetriever 抽象也继承自 runnables.RunnableSerializable。

### 1.7 总结
到这里虽然我们还不知道上面这些类是做什么的，但是我们已经可以理解 langchain 文档所说的 "Runnable 协议已为大多数组件实现"。而且我们也知道在 langchain-core 的抽象中，有以下核心的对象:
1. Runnable
2. RunnableConfig
3. BaseCallbackHandler 
4. BaseCallbackManager
5. BaseRunManager

## 2. LCEL 的简化实现
现在我们可以借助大模型的能力，来实现一个简单的 LCEL 应用，来帮助我们理解 LCEL 的实现原理。

```bash
提问:

我是一个后端开发工程师，我正在阅读langchain 的源码，我不太清楚 langchain LCEL 实现的原理。请你实现一个简化版本的  LCEL 的 python 实现。讲清楚如下对象:
1. Runnable
2. RunnableConfig
3. BaseCallbackHandler
4. BaseCallbackManager
5. BaseRunManager
```

下面是 ChatGpt 给我的回答:


### 2.1🧩 简化版 LCEL 核心组件

#### `Runnable`: 可运行对象的抽象

这是 LCEL 的核心接口，定义了调用模型的行为：

```python
from abc import ABC, abstractmethod
from typing import Any, Dict

class Runnable(ABC):
    @abstractmethod
    def invoke(self, input: Any, config: "RunnableConfig" = None) -> Any:
        pass
```

---

#### `RunnableConfig`: 控制运行的配置对象

它在 LCEL 中作为“调用上下文”，控制 callback、tags、metadata 等。

```python
class RunnableConfig:
    def __init__(self, tags=None, metadata=None, callbacks=None):
        self.tags = tags or []
        self.metadata = metadata or {}
        self.callbacks = callbacks or []
```

---

#### `BaseCallbackHandler`: 回调钩子定义

用于在每个调用过程中插入自定义逻辑（如日志、链路追踪等）：

```python
class BaseCallbackHandler(ABC):
    def on_start(self, run_id: str, input: Any):
        pass

    def on_end(self, run_id: str, output: Any):
        pass

    def on_error(self, run_id: str, error: Exception):
        pass
```

---

#### `BaseCallbackManager`: 管理多个 CallbackHandler

用于聚合和调用所有的回调处理器：

```python
class BaseCallbackManager:
    def __init__(self, handlers=None):
        self.handlers = handlers or []

    def add_handler(self, handler: BaseCallbackHandler):
        self.handlers.append(handler)

    def on_start(self, run_id, input):
        for h in self.handlers:
            h.on_start(run_id, input)

    def on_end(self, run_id, output):
        for h in self.handlers:
            h.on_end(run_id, output)

    def on_error(self, run_id, error):
        for h in self.handlers:
            h.on_error(run_id, error)
```

---

#### `BaseRunManager`: 一个生命周期管理器

它在 `Runnable.invoke()` 执行中生成、跟踪并管理回调生命周期：

```python
import uuid

class BaseRunManager:
    def __init__(self, callback_manager: BaseCallbackManager):
        self.callback_manager = callback_manager

    def run(self, func, input):
        run_id = str(uuid.uuid4())
        try:
            self.callback_manager.on_start(run_id, input)
            output = func(input)
            self.callback_manager.on_end(run_id, output)
            return output
        except Exception as e:
            self.callback_manager.on_error(run_id, e)
            raise
```

---

### 2.2 ✅ 示例：实现一个简单的 EchoRunnable

```python
class EchoRunnable(Runnable):
    def invoke(self, input: Any, config: RunnableConfig = None) -> Any:
        config = config or RunnableConfig()
        manager = BaseRunManager(BaseCallbackManager(config.callbacks))
        return manager.run(lambda x: f"Echo: {x}", input)


## ✅ 示例：自定义 CallbackHandler
class PrintCallbackHandler(BaseCallbackHandler):
    def on_start(self, run_id, input):
        print(f"[{run_id}] Start with input: {input}")

    def on_end(self, run_id, output):
        print(f"[{run_id}] End with output: {output}")

    def on_error(self, run_id, error):
        print(f"[{run_id}] Error: {error}")


## ✅ 运行示例
handler = PrintCallbackHandler()
config = RunnableConfig(callbacks=[handler])
runnable = EchoRunnable()
result = runnable.invoke("Hello LCEL", config=config)

# 输出：
# [<uuid>] Start with input: Hello LCEL
# [<uuid>] End with output: Echo: Hello LCEL
```

如果你想我继续实现 `RunnableSequence`、`RunnableLambda` 等组合式结构（更接近 LCEL），也可以告诉我，我来帮你扩展。是否继续？

### 2.3 追问
现在的 AI 真是太强大了，回答结束还给了我们进一步的提示。我们可以继续追问。因为我之前已经简单看过 Runnable 的源码，知道 Runnable 有一个 astream_events 方法，用于异步流式返回链中发生的事件。我想了解 LCEL 中事件的触发流程，所以这一次我们在提问中加上有关 event 的内容。

```bash
提问: 
继续，请在扩展中包含 LCEL event 的内容，我想了解到 event 是如何被定义，触发捕获的。
```


#### ✅ 1. 定义 LCEL Event 对象

LCEL 中的事件是通过 callback handler 机制发出的。我们模拟一个简单的事件系统：

```python
class Event:
    def __init__(self, name: str, payload: dict):
        self.name = name
        self.payload = payload
```

---

#### ✅ 2. 改造 `BaseCallbackHandler` 支持事件钩子

```python
class BaseCallbackHandler(ABC):
    def on_start(self, run_id: str, input: Any): pass
    def on_end(self, run_id: str, output: Any): pass
    def on_error(self, run_id: str, error: Exception): pass

    def on_event(self, run_id: str, event: Event): pass  # 新增
```

---

#### ✅ 3. 改造 `BaseRunManager` 触发事件机制

```python
class BaseRunManager:
    def __init__(self, callback_manager: BaseCallbackManager):
        self.callback_manager = callback_manager

    def run(self, func, input):
        run_id = str(uuid.uuid4())
        try:
            self.callback_manager.on_start(run_id, input)

            # 👉 中间自定义事件
            self.callback_manager.on_event(run_id, Event("custom_event_before", {"input": input}))

            output = func(input)

            self.callback_manager.on_event(run_id, Event("custom_event_after", {"output": output}))

            self.callback_manager.on_end(run_id, output)
            return output
        except Exception as e:
            self.callback_manager.on_error(run_id, e)
            raise
```

---

#### ✅ 4. 支持组合结构：`RunnableSequence`

允许组合多个 `Runnable` 顺序执行。

```python
class RunnableSequence(Runnable):
    def __init__(self, steps):
        self.steps = steps  # List[Runnable]

    def invoke(self, input: Any, config: RunnableConfig = None) -> Any:
        # RunnableConfig 在 Runnable 之间进行传递
        config = config or RunnableConfig()
        current = input
        for step in self.steps:
            current = step.invoke(current, config=config)
        return current
```

---

#### ✅ 5. 支持动态表达式：`RunnableLambda`

用于包装一个任意函数：

```python
class RunnableLambda(Runnable):
    def __init__(self, func):
        self.func = func

    def invoke(self, input: Any, config: RunnableConfig = None) -> Any:
        config = config or RunnableConfig()
        manager = BaseRunManager(BaseCallbackManager(config.callbacks))
        return manager.run(self.func, input)
```

---

#### ✅ 6. 示例 CallbackHandler：监听事件

```python
class PrintCallbackHandler(BaseCallbackHandler):
    def on_start(self, run_id, input):
        print(f"[{run_id}] Start with input: {input}")

    def on_end(self, run_id, output):
        print(f"[{run_id}] End with output: {output}")

    def on_error(self, run_id, error):
        print(f"[{run_id}] Error: {error}")

    def on_event(self, run_id, event: Event):
        print(f"[{run_id}] Event `{event.name}` triggered with: {event.payload}")
```

---

#### ✅ 7. 组合调用示例（完整链）

```python
# Step1: lowercase input
lowercase = RunnableLambda(lambda x: x.lower())

# Step2: add prefix
add_prefix = RunnableLambda(lambda x: f"Echo: {x}")

# Step3: sequence
pipeline = RunnableSequence([lowercase, add_prefix])

# Run with callback
handler = PrintCallbackHandler()
config = RunnableConfig(callbacks=[handler])
output = pipeline.invoke("HELLO LangChain", config=config)
```


### 2.4 补充提问
这一次提问回答的其实不是很好，所以我追加了一次提问:

```bash
提问:
event 都是在 BaseRunManager 中触发的么？我理解中好像不是，另外请删除 RunnableLambda，使用自定义的 Runnable，这样我更容易理解整个流程
```


#### 🔍 正确理解 LCEL 中事件触发机制

你提到的非常准确：
**LCEL 中的事件并不都是在 `BaseRunManager` 中触发的。**

在 LangChain 的设计中：

* **事件的触发主要依赖于每个 `Runnable` 的实现者**，比如 `RunnableMap`, `RunnableSequence`, `RunnableLambda`, `RunnablePassthrough` 等。
* `BaseRunManager` 的职责是提供通用的 callback 调用，比如 `on_start`, `on_end`, `on_error`，有时也提供 `on_event` 的快捷方法。
* **但真正触发某个业务相关的 event，比如 `on_chat_model_start`, `on_tool_start`, `on_chain_end`，通常是在每个 Runnable 的实现内部显式触发的**。

你可以把 `BaseRunManager` 理解为提供了“事件转发的管道”，但 **具体“什么时候发出哪个事件”是在 Runnable 逻辑内部决定的。**

#### 🧩 `CustomRunnable`

```python
class CustomRunnable(Runnable):
    def __init__(self, name: str, func):
        self.name = name
        self.func = func

    def invoke(self, input: Any, config: RunnableConfig = None) -> Any:
        config = config or RunnableConfig()
        callback_manager = BaseCallbackManager(config.callbacks)
        run_id = str(uuid.uuid4())

        try:
            callback_manager.on_start(run_id, input)

            # ⛳️ 明确在这里触发一个“业务含义”事件
            callback_manager.on_event(run_id, Event(f"{self.name}_before", {"input": input}))

            output = self.func(input)

            callback_manager.on_event(run_id, Event(f"{self.name}_after", {"output": output}))

            callback_manager.on_end(run_id, output)
            return output

        except Exception as e:
            callback_manager.on_error(run_id, e)
            raise
```

#### ✅ 简单的链组合类：`RunnableSequence`

```python
class RunnableSequence(Runnable):
    def __init__(self, steps):
        self.steps = steps

    def invoke(self, input: Any, config: RunnableConfig = None) -> Any:
        config = config or RunnableConfig()
        current = input
        for step in self.steps:
            current = step.invoke(current, config=config)
        return current
```

---

#### ✅ 完整运行示例（不再使用 RunnableLambda）

```python
# 定义两个业务步骤 runnable
step1 = CustomRunnable("lowercase", lambda x: x.lower())
step2 = CustomRunnable("add_prefix", lambda x: f"Echo: {x}")

# 组合为 pipeline
pipeline = RunnableSequence([step1, step2])

# 使用打印回调
handler = PrintCallbackHandler()
config = RunnableConfig(callbacks=[handler])

# 运行
output = pipeline.invoke("HELLO LCEL", config=config)
```

### 2.5 总结
最新的示例没有用到 BaseRunManager，所以 BaseRunManager 的作用需要进一步查看源码。但是这个不妨碍我们对 LCEL 有个感性的理解，现在我们来看 Runnable 的源码。

## 3. runnable 源码框架
### 3.1 Runnable 类
Runnable 类的核心方法就是 invoke，这个是一个抽象方法，基于这个方法，Runnable 提供异步、批次调用的 invoke 的其他方法。

```python
class Runnable(ABC, Generic[Input, Output]):
    name: Optional[str]
    """The name of the Runnable. Used for debugging and tracing."""

    @property
    def config_specs(self) -> list[ConfigurableFieldSpec]:
        """List configurable fields for this Runnable."""
        return []

    def get_graph(self, config: Optional[RunnableConfig] = None) -> Graph:
        """Return a graph representation of this Runnable."""
        graph = Graph()
        try:
            input_node = graph.add_node(self.get_input_schema(config))
        except TypeError:
            input_node = graph.add_node(create_model_v2(self.get_name("Input")))
        runnable_node = graph.add_node(
            self, metadata=config.get("metadata") if config else None
        )
        try:
            output_node = graph.add_node(self.get_output_schema(config))
        except TypeError:
            output_node = graph.add_node(create_model_v2(self.get_name("Output")))
        graph.add_edge(input_node, runnable_node)
        graph.add_edge(runnable_node, output_node)
        return graph

        def __or__(
        self,
        other: Union[
            Runnable[Any, Other],
            Callable[[Iterator[Any]], Iterator[Other]],
            Callable[[AsyncIterator[Any]], AsyncIterator[Other]],
            Callable[[Any], Other],
            Mapping[str, Union[Runnable[Any, Other], Callable[[Any], Other], Any]],
        ],
    ) -> RunnableSerializable[Input, Other]:
        """Compose this Runnable with another object to create a RunnableSequence."""
        return RunnableSequence(self, coerce_to_runnable(other))

    @abstractmethod
    def invoke(
        self,
        input: Input,  # noqa: A002
        config: Optional[RunnableConfig] = None,
        **kwargs: Any,
    ) -> Output:
        """Transform a single input into an output.

        Args:
            input: The input to the Runnable.
            config: A config to use when invoking the Runnable.
               The config supports standard keys like 'tags', 'metadata' for tracing
               purposes, 'max_concurrency' for controlling how much work to do
               in parallel, and other keys. Please refer to the RunnableConfig
               for more details.

        Returns:
            The output of the Runnable.
        """

    async def ainvoke(
        self,
        input: Input,  # noqa: A002
        config: Optional[RunnableConfig] = None,
        **kwargs: Any,
    ) -> Output:
        """Default implementation of ainvoke, calls invoke from a thread.

        The default implementation allows usage of async code even if
        the Runnable did not implement a native async version of invoke.

        Subclasses should override this method if they can run asynchronously.
        """
        return await run_in_executor(config, self.invoke, input, config, **kwargs)

    async def astream_log(
        self,
        input: Any,  # noqa: A002
        config: Optional[RunnableConfig] = None,
        *,
        diff: bool = True,
        with_streamed_output_list: bool = True,
        include_names: Optional[Sequence[str]] = None,
        include_types: Optional[Sequence[str]] = None,
        include_tags: Optional[Sequence[str]] = None,
        exclude_names: Optional[Sequence[str]] = None,
        exclude_types: Optional[Sequence[str]] = None,
        exclude_tags: Optional[Sequence[str]] = None,
        **kwargs: Any,
    ) -> Union[AsyncIterator[RunLogPatch], AsyncIterator[RunLog]]:
        pass

    async def astream_events(
        self,
        input: Any,  # noqa: A002
        config: Optional[RunnableConfig] = None,
        *,
        version: Literal["v1", "v2"] = "v2",
        include_names: Optional[Sequence[str]] = None,
        include_types: Optional[Sequence[str]] = None,
        include_tags: Optional[Sequence[str]] = None,
        exclude_names: Optional[Sequence[str]] = None,
        exclude_types: Optional[Sequence[str]] = None,
        exclude_tags: Optional[Sequence[str]] = None,
        **kwargs: Any,
    ) -> AsyncIterator[StreamEvent]:
        pass
    
    def transform(
        self,
        input: Iterator[Input],  # noqa: A002
        config: Optional[RunnableConfig] = None,
        **kwargs: Optional[Any],
    ) -> Iterator[Output]:
        pass

    def with_config(
        self,
        config: Optional[RunnableConfig] = None,
        # Sadly Unpack is not well-supported by mypy so this will have to be untyped
        **kwargs: Any,
    ) -> Runnable[Input, Output]:
        """Bind config to a Runnable, returning a new Runnable.

        Args:
            config: The config to bind to the Runnable.
            kwargs: Additional keyword arguments to pass to the Runnable.

        Returns:
            A new Runnable with the config bound.
        """
        return RunnableBinding(
            bound=self,
            config=cast(
                "RunnableConfig",
                {**(config or {}), **kwargs},
            ),
            kwargs={},
        )
```

我列举了 Runnable 的一些方法:
1. `__or__`: `|` 管道符语法的实现，内部调用 RunnableSequence
1. config_specs: 与程序自定义配置有关
2. astream_log: 异步流式日志，需要重点理解
3. astream_events: 异步流式事件，需要重点理解
4. with_ 的方法，都是一些便携方法，比如 with_config、with_retry 等

接下来我们来看 RunnableSequence 的 invoke 方法，这是我们理解 LCEL 的关键方法。

### 3.2 RunnableSequence

```python
class RunnableSequence(RunnableSerializable[Input, Output]):
    first: Runnable[Input, Any]
    """The first Runnable in the sequence."""
    middle: list[Runnable[Any, Any]] = Field(default_factory=list)
    """The middle Runnables in the sequence."""
    last: Runnable[Any, Output]
    """The last Runnable in the sequence."""

        def __init__(
        self,
        *steps: RunnableLike,
        name: Optional[str] = None,
        first: Optional[Runnable[Any, Any]] = None,
        middle: Optional[list[Runnable[Any, Any]]] = None,
        last: Optional[Runnable[Any, Any]] = None,
    ) -> None:
        """Create a new RunnableSequence.

        Args:
            steps: The steps to include in the sequence.
            name: The name of the Runnable. Defaults to None.
            first: The first Runnable in the sequence. Defaults to None.
            middle: The middle Runnables in the sequence. Defaults to None.
            last: The last Runnable in the sequence. Defaults to None.

        Raises:
            ValueError: If the sequence has less than 2 steps.
        """
        steps_flat: list[Runnable] = []
        if not steps and first is not None and last is not None:
            steps_flat = [first] + (middle or []) + [last]
        for step in steps:
            if isinstance(step, RunnableSequence):
                steps_flat.extend(step.steps)
            else:
                steps_flat.append(coerce_to_runnable(step))
        if len(steps_flat) < 2:
            msg = f"RunnableSequence must have at least 2 steps, got {len(steps_flat)}"
            raise ValueError(msg)
        super().__init__(  # type: ignore[call-arg]
            first=steps_flat[0],
            middle=list(steps_flat[1:-1]),
            last=steps_flat[-1],
            name=name,
        )

    @property
    def steps(self) -> list[Runnable[Any, Any]]:
        """All the Runnables that make up the sequence in order.

        Returns:
            A list of Runnables.
        """
        return [self.first, *self.middle, self.last]

    @override
    def invoke(
        self, input: Input, config: Optional[RunnableConfig] = None, **kwargs: Any
    ) -> Output:
        # 1. langchain 引入的 context
        from langchain_core.beta.runnables.context import config_with_context

        # setup callbacks and context
        config = config_with_context(ensure_config(config), self.steps)
        # 2. 获取 BaseCallBackManager
        callback_manager = get_callback_manager_for_config(config)
        # start the root run
        run_manager = callback_manager.on_chain_start(
            None,
            input,
            name=config.get("run_name") or self.get_name(),
            run_id=config.pop("run_id", None),
        )
        input_ = input

        # invoke all steps in sequence
        try:
            for i, step in enumerate(self.steps):
                # mark each step as a child run
                # 3. 为每个 step 配置 callback
                config = patch_config(
                    config, callbacks=run_manager.get_child(f"seq:step:{i + 1}")
                )
                # 4. 管理协程上下文
                with set_config_context(config) as context:
                    if i == 0:
                        input_ = context.run(step.invoke, input_, config, **kwargs)
                    else:
                        input_ = context.run(step.invoke, input_, config)
        # finish the root run
        except BaseException as e:
            run_manager.on_chain_error(e)
            raise
        else:
            run_manager.on_chain_end(input_)
            return cast("Output", input_)


def get_callback_manager_for_config(config: RunnableConfig) -> CallbackManager:
    """Get a callback manager for a config.

    Args:
        config (RunnableConfig): The config.

    Returns:
        CallbackManager: The callback manager.
    """
    from langchain_core.callbacks.manager import CallbackManager
    # 从 config 中提取 callback
    return CallbackManager.configure(
        inheritable_callbacks=config.get("callbacks"),
        inheritable_tags=config.get("tags"),
        inheritable_metadata=config.get("metadata"),
    )
```

下面是一个 LCEL 的简单使用示例:

```python
from langchain_core.runnables import Runnable, RunnableLambda
from langchain_core.callbacks import (
    BaseCallbackHandler,
)
from langchain_core.runnables import RunnableConfig

from typing import Any
import uuid


# 自定义 CallbackHandler
class PrintCallbackHandler(BaseCallbackHandler):

    def on_chain_end(
        self,
        outputs: dict[str, Any],
        *,
        run_id,
        parent_run_id=None,
        **kwargs: Any,
    ) -> Any:
        print(f"[{run_id}] 🟢 End with output: {outputs}")


# 定义两个 RunnableLambda 节点
lowercase = RunnableLambda(lambda x: x.lower())

add_prefix = RunnableLambda(lambda x: f"Echo: {x}")

# 用 RunnableSequence 组合成 pipeline
pipeline: Runnable = lowercase | add_prefix

# 定义配置，包括 callback handler
config = RunnableConfig(callbacks=[PrintCallbackHandler()])

# 调用链
output = pipeline.invoke("HELLO LangChain", config=config)

print("\nFinal Result:", output)

```

可以看到基本上与 ChatGpt 给我们的 demo 实现一致。下一节我们将详细介绍 RunnableSequence invoke 方法的实现。