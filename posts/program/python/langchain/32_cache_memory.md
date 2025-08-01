---
weight: 1
title: "LangChain Cache And Memory"
date: 2025-07-23T15:00:00+08:00
lastmod: 2025-07-23T15:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langchain Cache And Memory"
featuredImage: 

tags: ["langchain 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

## 1. Cache 和 Memory

| 概念       | 作用                   | 举例                              |
| -------- | -------------------- | ------------------------------- |
| `Cache`  | **避免重复计算，提升性能**      | 用户输入完全相同时，直接返回之前的模型输出           |
| `Memory` | **保留对话上下文，实现多轮对话记忆** | 用户说“他是谁？”时，Memory 提供前面提到的“他”的信息 |


## 2. Cache
cache 是用于缓存相同输入的 LLM 或 chain 调用结果，避免重复请求、降低成本、提升速度。位于 langchain_core.caches 内。
1. BaseCache: Cache 的抽象类
2. InMemoryCache: 基于内存的 Cache 实现

### 2.1 BaseCache
就是定义了查找、更新、删除三个接口。

```python
class BaseCache(ABC):
    """Interface for a caching layer for LLMs and Chat models.

    The cache interface consists of the following methods:

    - lookup: Look up a value based on a prompt and llm_string.
    - update: Update the cache based on a prompt and llm_string.
    - clear: Clear the cache.

    In addition, the cache interface provides an async version of each method.

    The default implementation of the async methods is to run the synchronous
    method in an executor. It's recommended to override the async methods
    and provide async implementations to avoid unnecessary overhead.
    """

    @abstractmethod
    def lookup(self, prompt: str, llm_string: str) -> Optional[RETURN_VAL_TYPE]:
        pass

    @abstractmethod
    def update(self, prompt: str, llm_string: str, return_val: RETURN_VAL_TYPE) -> None:
        pass

    @abstractmethod
    def clear(self, **kwargs: Any) -> None:
        """Clear cache that can take additional keyword arguments."""
```

### 2.2 InMemoryCache
基于字典的实现

```python
class InMemoryCache(BaseCache):
    """Cache that stores things in memory."""

    def __init__(self, *, maxsize: Optional[int] = None) -> None:
        """Initialize with empty cache.

        Args:
            maxsize: The maximum number of items to store in the cache.
                If None, the cache has no maximum size.
                If the cache exceeds the maximum size, the oldest items are removed.
                Default is None.

        Raises:
            ValueError: If maxsize is less than or equal to 0.
        """
        self._cache: dict[tuple[str, str], RETURN_VAL_TYPE] = {}
        if maxsize is not None and maxsize <= 0:
            msg = "maxsize must be greater than 0"
            raise ValueError(msg)
        self._maxsize = maxsize

    def lookup(self, prompt: str, llm_string: str) -> Optional[RETURN_VAL_TYPE]:
        """Look up based on prompt and llm_string.

        Args:
            prompt: a string representation of the prompt.
                In the case of a Chat model, the prompt is a non-trivial
                serialization of the prompt into the language model.
            llm_string: A string representation of the LLM configuration.

        Returns:
            On a cache miss, return None. On a cache hit, return the cached value.
        """
        return self._cache.get((prompt, llm_string), None)

    def update(self, prompt: str, llm_string: str, return_val: RETURN_VAL_TYPE) -> None:
        """Update cache based on prompt and llm_string.

        Args:
            prompt: a string representation of the prompt.
                In the case of a Chat model, the prompt is a non-trivial
                serialization of the prompt into the language model.
            llm_string: A string representation of the LLM configuration.
            return_val: The value to be cached. The value is a list of Generations
                (or subclasses).
        """
        if self._maxsize is not None and len(self._cache) == self._maxsize:
            del self._cache[next(iter(self._cache))]
        self._cache[prompt, llm_string] = return_val

    @override
    def clear(self, **kwargs: Any) -> None:
        """Clear cache."""
        self._cache = {}
```

## 3. Memory
memory 是 LangChain 中用于保留用户-助手之间多轮对话记录的机制。它模拟一个“记忆系统”，使语言模型在每轮对话时能参考之前的消息。基本抽象位于 langchain_core.memory 内。

### 3.1 BaseMemory
BaseMemory 已经是过期的，推荐使用 langGraph 中的 memory。不过不急，langGraph 后面我们具体在学习。

```python

@deprecated(
    since="0.3.3",
    removal="1.0.0",
    message=(
        "Please see the migration guide at: "
        "https://python.langchain.com/docs/versions/migrating_memory/"
    ),
)
class BaseMemory(Serializable, ABC):
    

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

    @property
    @abstractmethod
    def memory_variables(self) -> list[str]:
        """The string keys this memory class will add to chain inputs."""

    @abstractmethod
    def load_memory_variables(self, inputs: dict[str, Any]) -> dict[str, Any]:
        """Return key-value pairs given the text input to the chain.

        Args:
            inputs: The inputs to the chain.

        Returns:
            A dictionary of key-value pairs.
        """

    @abstractmethod
    def save_context(self, inputs: dict[str, Any], outputs: dict[str, str]) -> None:
        """Save the context of this chain run to memory.

        Args:
            inputs: The inputs to the chain.
            outputs: The outputs of the chain.
        """

    @abstractmethod
    def clear(self) -> None:
        """Clear memory contents."""
```

### 3.2 Memory 的具体实现
Memory 的具体实现位于 langchain.memory 包内。下面是这个包的 UML 类图: ![Memory 类图](/images/langchain/memory.svg)。

与 Memory 类似，这些类都已经 deprecated 了，所以这里我们暂时跳过源码的解析。下面是一些常见类的说明:

| 类名                               | 说明                    |
| -------------------------------- | --------------------- |
| `ConversationBufferMemory`       | 简单地按顺序记录所有消息（串接成一段历史） |
| `ConversationSummaryMemory`      | 用 LLM 生成摘要作为历史        |
| `ConversationBufferWindowMemory` | 只保留最近 N 轮对话           |
| `ChatMessageHistory`             | 封装了底层消息列表的增删操作        |
