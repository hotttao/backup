---
weight: 1
title: "pregel store"
date: 2025-08-01T13:00:00+08:00
lastmod: 2025-08-01T13:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "pregel store"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

前面我们了解到 Store 是一种 **通用的 key-value 存储系统**，可以将 `store` 看作 **LangGraph 中的共享缓存 / 状态仓库**。这一节我们来看 Store 的具体实现细节。

## 1. BaseStore
Store 如实现由 BaseStore 抽象基类约定。

### 1.1 BaseStore 属性

```python
class BaseStore(ABC):
    supports_ttl: bool = False
    ttl_config: TTLConfig | None = None

    __slots__ = ("__weakref__",)

class TTLConfig(TypedDict, total=False):
    """Configuration for TTL (time-to-live) behavior in the store."""

    refresh_on_read: bool
    """Default behavior for refreshing TTLs on read operations (GET and SEARCH).
    
    If True, TTLs will be refreshed on read operations (get/search) by default.
    This can be overridden per-operation by explicitly setting refresh_ttl.
    Defaults to True if not configured.
    """
    default_ttl: float | None
    """Default TTL (time-to-live) in minutes for new items.
    
    If provided, new items will expire after this many minutes after their last access.
    The expiration timer refreshes on both read and write operations.
    Defaults to None (no expiration).
    """
    sweep_interval_minutes: int | None
    """Interval in minutes between TTL sweep operations.
    
    If provided, the store will periodically delete expired items based on TTL.
    Defaults to None (no sweeping).
    """
```

下面是 TTLConfig 几个配置项的含义:

| 属性名                      | 类型              | 默认值    | 含义                                                                                     |
| ------------------------ | --------------- | ------ | -------------------------------------------------------------------------------------- |
| `refresh_on_read`        | `bool`          | `True` | 控制是否在读取操作（如 `get` 和 `search`）时刷新 TTL（过期时间）。如果设为 `True`，则每次读取会重置过期倒计时。可以在每次操作中显式覆盖该设置。  |
| `default_ttl`            | `float \| None` | `None` | 默认的 TTL（以分钟为单位），用于新插入的项目。如果设定，新项目将在最后访问后的指定分钟数后过期。访问（读或写）会刷新 TTL 倒计时。如果为 `None`，则不会过期。 |
| `sweep_interval_minutes` | `int \| None`   | `None` | 设置自动清理过期项目的间隔时间（分钟）。如果指定，系统将周期性执行清理操作以删除已过期项目。为 `None` 时则不启用清理机制。                      |


### 1.2 BaseStore 方法
BaseStore 提供了一下方法，抽象接口只有:
1. batch
2. abatch



| 方法名                | 作用描述                                   | 输出值类型                   |        |
| ------------------ | -------------------------------------- | ----------------------- | ------ |
| `batch`            | 同步批量执行多个操作（如 put、get、delete、search）    | `list[Result]`          |        |
| `abatch`           | 异步批量执行多个操作                             | `list[Result]`          |        |
| `get`              | 同步获取指定 namespace + key 的项              | \`Item                  | None\` |
| `aget`             | 异步获取指定 namespace + key 的项              | \`Item                  | None\` |
| `search`           | 同步在指定 namespace 前缀下进行搜索，可选支持自然语言查询、过滤等 | `list[SearchItem]`      |        |
| `asearch`          | 异步版本的 `search`                         | `list[SearchItem]`      |        |
| `put`              | 同步写入或更新一项数据，支持 TTL 和可选索引字段             | `None`                  |        |
| `aput`             | 异步版本的 `put`                            | `None`                  |        |
| `delete`           | 同步删除一项数据                               | `None`                  |        |
| `adelete`          | 异步版本的 `delete`                         | `None`                  |        |
| `list_namespaces`  | 同步列出命名空间（支持前缀/后缀匹配、层级过滤、分页）            | `list[tuple[str, ...]]` |        |
| `alist_namespaces` | 异步版本的 `list_namespaces`                | `list[tuple[str, ...]]` |        |

```python
Op = Union[GetOp, SearchOp, PutOp, ListNamespacesOp]

class BaseStore(ABC):
    @abstractmethod
    def batch(self, ops: Iterable[Op]) -> list[Result]:
        pass

    @abstractmethod
    async def abatch(self, ops: Iterable[Op]) -> list[Result]:
```

batch 接收 Op 对象的迭代器，Op 表示要执行的操作，所以我们先来看 Op 的实现。

## 2. Op
Op 定义在 `langgraph\store\base\__init__.py` 有如下相关的类:
1. Item
2. SearchItem
3. GetOp
4. SearchOp
5. PutOp
6. ListNamespacesOp
7. MatchCondition

我们先看一下这些对象的语义。

```bash
# 提问
我在Langgraph store 的源码中，看到了如下对象定义，请以表格的形式给我讲解它们的语义:
1. Item
2. SearchItem
3. GetOp
4. SearchOp
5. PutOp
6. ListNamespacesOp
7. MatchCondition
```

| 对象名                | 类型/角色   | 含义简述                                  |
| ------------------ | ------- | ------------------------------------- |
| `Item`             | 数据结构    | 表示存储系统中的一个条目，包含键、值、命名空间、时间戳和元数据。      |
| `SearchItem`       | 数据结构    | 表示搜索操作返回的简化条目，不包含具体值，仅用于索引展示。         |
| `GetOp`            | 操作类（请求） | 表示一次 `get` 请求操作，支持按键获取数据并可选择是否刷新 TTL。 |
| `SearchOp`         | 操作类（请求） | 表示一次 `search` 请求操作，根据命名空间和元数据条件匹配条目。  |
| `PutOp`            | 操作类（请求） | 表示一次写入操作，可指定键、值、命名空间、元数据和过期时间。        |
| `ListNamespacesOp` | 操作类（请求） | 表示列出当前存储中所有命名空间的操作。                   |
| `MatchCondition`   | 条件定义    | 表示搜索时的元数据匹配条件，如等于、不等于、包含、不包含等。        |

我们一一来看一下这些对象的实现。

### 1.1 Item
Item 表示存储系统中的一个条目。其定义如下:

```python
class Item:
    """Represents a stored item with metadata.

    Args:
        value: The stored data as a dictionary. Keys are filterable.
        key: Unique identifier within the namespace.
        namespace: Hierarchical path defining the collection in which this document resides.
            Represented as a tuple of strings, allowing for nested categorization.
            For example: ("documents", 'user123')
        created_at: Timestamp of item creation.
        updated_at: Timestamp of last update.
    """

    __slots__ = ("value", "key", "namespace", "created_at", "updated_at")

    def __init__(
        self,
        *,
        value: dict[str, Any],
        key: str,
        namespace: tuple[str, ...],
        created_at: datetime,
        updated_at: datetime,
    ):
        self.value = value
        self.key = key
        # The casting from json-like types is for if this object is
        # deserialized.
        self.namespace = tuple(namespace)
        self.created_at = (
            datetime.fromisoformat(cast(str, created_at))
            if isinstance(created_at, str)
            else created_at
        )
        self.updated_at = (
            datetime.fromisoformat(cast(str, updated_at))
            if isinstance(updated_at, str)
            else updated_at
        )
```

| 属性名          | 类型                | 含义                                             |
| ------------ | ----------------- | ---------------------------------------------- |
| `value`      | `dict[str, Any]`  | 存储的数据内容，支持用于筛选的键值对结构。                          |
| `key`        | `str`             | 当前命名空间下的唯一标识符。                                 |
| `namespace`  | `tuple[str, ...]` | 分层命名空间路径，用于组织分类，例如 `("documents", "user123")`。 |
| `created_at` | `datetime`        | 项目创建时间。支持从字符串反序列化。                             |
| `updated_at` | `datetime`        | 项目最近一次更新时间。支持从字符串反序列化。                         |

### 1.2 SearchItem
score 字段用于表示该条目与搜索条件的匹配程度，常用于相似度搜索（如 embedding 检索）或排序逻辑中。具体作用如下：

```python
class SearchItem(Item):
    """Represents an item returned from a search operation with additional metadata."""

    __slots__ = ("score",)

    def __init__(
        self,
        namespace: tuple[str, ...],
        key: str,
        value: dict[str, Any],
        created_at: datetime,
        updated_at: datetime,
        score: float | None = None,
    ) -> None:
        """Initialize a result item.

        Args:
            namespace: Hierarchical path to the item.
            key: Unique identifier within the namespace.
            value: The stored value.
            created_at: When the item was first created.
            updated_at: When the item was last updated.
            score: Relevance/similarity score if from a ranked operation.
        """
        super().__init__(
            value=value,
            key=key,
            namespace=namespace,
            created_at=created_at,
            updated_at=updated_at,
        )
        self.score = score
```

### 1.3 GetOp
``````python
class GetOp(NamedTuple):
    namespace: tuple[str, ...] # 分层命名空间路径
    key: str # 查询的键
    refresh_ttl: bool = True # 是否刷新返回项的 TTL

GetOp(namespace=("users", "profiles"), key="user123")
GetOp(namespace=("cache", "embeddings"), key="doc456")
``````

### 1.4 SearchOp
```python
class SearchOp(NamedTuple):
    namespace_prefix: tuple[str, ...]
    """
        Supported Operators:
        - $eq: Equal to (same as direct value comparison)
        - $ne: Not equal to
        - $gt: Greater than
        - $gte: Greater than or equal to
        - $lt: Less than
        - $lte: Less than or equal to
        {"score": {"$gt": 4.99}}
        {
            "score": {"$gte": 3.0},
            "color": "red"
        }
    """
    filter: dict[str, Any] | None = None
    limit: int = 10
    offset: int = 0
    # 自然语言的搜索查询
    query: str | None = None
    # 是否刷新返回项的 TTL
    refresh_ttl: bool = True

SearchOp(
    namespace_prefix=("documents",),
    filter={"type": "report", "status": "active"},
    limit=5,
    offset=10
)
```
### 1.5 PutOp
```python
class PutOp(NamedTuple):
    namespace: tuple[str, ...]
    key: str
    value: dict[str, Any] | None
    index: Literal[False] | list[str] | None = None
    ttl: float | None = None
```

稍微复杂的这个 index 字段。`index` 字段用于**控制当前条目中哪些字段将被用于搜索索引**，影响搜索操作（如向量相似度检索或元数据匹配）中该条目的可发现性。它不会影响 `get()` 的精确查找功能，只影响 `search()` 能否命中该条目。* `index` 是 LangGraph Store 提供的**可选搜索优化配置**。
* 它让你可以更细粒度地指定**哪些字段应被用于检索**；
* 适用于构建更高效、目标明确的搜索（如只搜标题或标签，而非全文）。

如果你正在使用向量索引或全文索引，合理配置 `index` 可以显著提升检索性能和精度。

index 有三种取值:

| 取值          | 含义说明                                              |
| ----------- | ------------------------------------------------- |
| `None`      | 使用 store 实现提供的默认索引配置（通常意味着索引整个条目或默认字段）。           |
| `False`     | 完全不为该条目建立索引，无法通过 `search()` 找到。仅能通过 `get()` 精确查找。 |
| `list[str]` | 指定要用于索引的字段路径列表，仅这些字段将用于搜索匹配。                      |


字段路径使用类 JSONPath 的语法，支持：

| 写法                  | 含义                   |
| ------------------- | -------------------- |
| `"field"`           | 一级字段                 |
| `"parent.child"`    | 多级嵌套字段               |
| `"array[0]"`        | 数组的第一个元素             |
| `"array[-1]"`       | 数组的最后一个元素            |
| `"array[*]"`        | 数组的所有元素，分别作为独立向量进行索引 |
| `"parent[*].child"` | 嵌套数组中每个元素的子字段        |


### 1.7 MatchCondition
```python
class MatchCondition(NamedTuple):
    match_type: NamespaceMatchType # 匹配前缀，还是后缀
    path: NamespacePath # 命名空间路径，支持通配符 *

NamespaceMatchType = Literal["prefix", "suffix"]

NamespacePath = tuple[Union[str, Literal["*"]], ...]
"""
example:
    ("users",)  # Exact users namespace
    ("documents", "*")  # Any sub-namespace under documents
    ("cache", "*", "v1")  # Any cache category with v1 version
"""
```

### 1.6 ListNamespacesOp
```python
class ListNamespacesOp(NamedTuple):
    match_conditions: tuple[MatchCondition, ...] | None = None
    max_depth: int | None = None
    limit: int = 100
    offset: int = 0

ListNamespacesOp(
    match_conditions=(MatchCondition(match_type="suffix", path=("v1",)),),
    limit=50
)
```

## 3. BaseStore 方法
有了 Op 对象的基础，我们现在可以学习 BaseStore 提供的方法了。BaseStore 基本上所有的方法都基于 batch/abatch 两个抽象方法。

### 3.1 查询
```python
    def get(
        self,
        namespace: tuple[str, ...],
        key: str,
        *,
        refresh_ttl: bool | None = None,
    ) -> Item | None:
        return self.batch(
            [GetOp(namespace, str(key), _ensure_refresh(self.ttl_config, refresh_ttl))]
        )[0]

    def search(
        self,
        namespace_prefix: tuple[str, ...],
        /,
        *,
        query: str | None = None,
        filter: dict[str, Any] | None = None,
        limit: int = 10,
        offset: int = 0,
        refresh_ttl: bool | None = None,
    ) -> list[SearchItem]:
        
        return self.batch(
            [
                SearchOp(
                    namespace_prefix,
                    filter,
                    limit,
                    offset,
                    query,
                    _ensure_refresh(self.ttl_config, refresh_ttl),
                )
            ]
        )[0]
```

### 更新

```python 
    def put(
        self,
        namespace: tuple[str, ...],
        key: str,
        value: dict[str, Any],
        index: Literal[False] | list[str] | None = None,
        *,
        ttl: float | None | NotProvided = NOT_PROVIDED,
    ) -> None:
        
        _validate_namespace(namespace)
        if ttl not in (NOT_PROVIDED, None) and not self.supports_ttl:
            raise NotImplementedError(
                f"TTL is not supported by {self.__class__.__name__}. "
                f"Use a store implementation that supports TTL or set ttl=None."
            )
        self.batch(
            [
                PutOp(
                    namespace,
                    str(key),
                    value,
                    index=index,
                    ttl=_ensure_ttl(self.ttl_config, ttl),
                )
            ]
        )

    def delete(self, namespace: tuple[str, ...], key: str) -> None:
        """Delete an item.

        Args:
            namespace: Hierarchical path for the item.
            key: Unique identifier within the namespace.
        """
        self.batch([PutOp(namespace, str(key), None, ttl=None)])
```

## 4. InMemoryStore

Langgraph 提供了一个 BaseStore 基于内存的实现 InMemoryStore。我们简单看一下它的实现:

### 4.1 InMemoryStore 属性

```python

class IndexConfig(TypedDict, total=False):
    dims: int # embedding 的维度
    embed: Embeddings | EmbeddingsFunc | AEmbeddingsFunc | str
    """Optional function to generate embeddings from text.
    
    Can be specified in three ways:
        1. A LangChain Embeddings instance
        2. A synchronous embedding function (EmbeddingsFunc)
        3. An asynchronous embedding function (AEmbeddingsFunc)
        4. A provider string (e.g., "openai:text-embedding-3-small")
    """
    fields: list[str] | None
    """Fields to extract text from for embedding generation.
    
    Controls which parts of stored items are embedded for semantic search. Follows JSON path syntax:

        - ["$"]: Embeds the entire JSON object as one vector  (default)
        - ["field1", "field2"]: Embeds specific top-level fields
        - ["parent.child"]: Embeds nested fields using dot notation
        - ["array[*].field"]: Embeds field from each array element separately
    """

class InMemoryStore(BaseStore):
    __slots__ = (
        "_data",
        "_vectors",
        "index_config",
        "embeddings",
    )

    def __init__(self, *, index: IndexConfig | None = None) -> None:
        # Both _data and _vectors are wrapped in the In-memory API
        # Do not change their names
        self._data: dict[tuple[str, ...], dict[str, Item]] = defaultdict(dict)
        # [ns][key][path]
        self._vectors: dict[tuple[str, ...], dict[str, dict[str, list[float]]]] = (
            defaultdict(lambda: defaultdict(dict))
        )
        self.index_config = index
        if self.index_config:
            self.index_config = self.index_config.copy()
            self.embeddings: Embeddings | None = ensure_embeddings(
                self.index_config.get("embed"),
            )
            self.index_config["__tokenized_fields"] = [
                (p, tokenize_path(p)) if p != "$" else (p, p)
                for p in (self.index_config.get("fields") or ["$"])
            ]

        else:
            self.index_config = None
            self.embeddings = None
```


### 4.1 InMemoryStore 方法
