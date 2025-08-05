---
weight: 1
title: "langgraph cache"
date: 2025-08-01T14:00:00+08:00
lastmod: 2025-08-01T14:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langgraph cache"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

前面我们了解到 langgraph cache 类似于 `@functools.lru_cache`，可以缓存函数的返回值，避免重复计算。这一节我们来看 Cache 的具体实现细节。

## 1. BaseCache
cache 如实现由 BaseCache 抽象基类约定。

### 1.1 BaseCache 属性

```python
class BaseCache(ABC, Generic[ValueT]):
    """Base class for a cache."""

    # 序列化器
    serde: SerializerProtocol = JsonPlusSerializer(pickle_fallback=True)

    def __init__(self, *, serde: SerializerProtocol | None = None) -> None:
        """Initialize the cache with a serializer."""
        self.serde = serde or self.serde
```

### 1.2 BaseCache 方法

BaseCache 定义的方法都是抽象方法。

| 方法名      | 作用描述                                                 | 输出值类型                   |
| -------- | ---------------------------------------------------- | ----------------------- |
| `get`    | 同步获取多个缓存项的值（根据多个 `FullKey`）                          | `dict[FullKey, ValueT]` |
| `aget`   | 异步获取多个缓存项的值                                          | `dict[FullKey, ValueT]` |
| `set`    | 同步设置多个缓存项的值及其 TTL（以 `FullKey` 为键，值为 `(ValueT, TTL)`） | `None`                  |
| `aset`   | 异步设置多个缓存项的值及其 TTL                                    | `None`                  |
| `clear`  | 同步清除指定命名空间（`Namespace`）下的缓存项，若未提供则清空所有               | `None`                  |
| `aclear` | 异步清除指定命名空间（`Namespace`）下的缓存项，若未提供则清空所有               | `None`                  |

## 2. InMemoryCache

Langgraph 提供了一个 BaseCache 基于内存的实现 InMemoryCache。我们简单看一下它的实现: 

```python
Namespace = tuple[str, ...]
FullKey = tuple[Namespace, str]

class InMemoryCache(BaseCache[ValueT]):
    def __init__(self, *, serde: SerializerProtocol | None = None):
        super().__init__(serde=serde)
        self._cache: dict[Namespace, dict[str, tuple[str, bytes, float | None]]] = {}
        self._lock = threading.RLock()

    def get(self, keys: Sequence[FullKey]) -> dict[FullKey, ValueT]:
        """Get the cached values for the given keys."""
        with self._lock:
            if not keys:
                return {}
            now = datetime.datetime.now(datetime.timezone.utc).timestamp()
            values: dict[FullKey, ValueT] = {}
            for ns_tuple, key in keys:
                ns = Namespace(ns_tuple)
                if ns in self._cache and key in self._cache[ns]:
                    enc, val, expiry = self._cache[ns][key]
                    if expiry is None or now < expiry:
                        values[(ns, key)] = self.serde.loads_typed((enc, val))
                    else:
                        del self._cache[ns][key]
            return values
    
    def set(self, keys: Mapping[FullKey, tuple[ValueT, int | None]]) -> None:
        """Set the cached values for the given keys."""
        with self._lock:
            now = datetime.datetime.now(datetime.timezone.utc)
            for (ns, key), (value, ttl) in keys.items():
                if ttl is not None:
                    delta = datetime.timedelta(seconds=ttl)
                    expiry: float | None = (now + delta).timestamp()
                else:
                    expiry = None
                if ns not in self._cache:
                    self._cache[ns] = {}
                self._cache[ns][key] = (
                    *self.serde.dumps_typed(value),
                    expiry,
                )

```

InMemoryCache 的实现很简单，就是一个线程安全的字典，键为 `FullKey`，值为 `(enc, val, expiry)`。
