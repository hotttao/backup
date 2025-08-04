---
weight: 1
title: "langgraph channel"
date: 2025-08-01T9:00:00+08:00
lastmod: 2025-08-01T9:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langgraph channel"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

## 1. BaseChannel

channel 表示节点之间的数据传输管道，有点类似 golang 中的 channel。BaseChannel 是一个抽象基类。下面是 channel 的 UML 类图:

![channel 类图](/images/langgraph/channel.svg)

但是与 golang 中的 channel 不同，channel 本身只定义数据如何存储，不定义如何读写。channel 的读写由 ChannelRead、ChannelWrite 定义。

### 1.1 BaseChannel 的定义

BaseChannel 定义了两个属性:
1. key: 通道的唯一标识，用于在图中定位通道。
2. typ: 通道的数据类型，用于类型检查和序列化。

```python
Value = TypeVar("Value")
Update = TypeVar("Update")
Checkpoint = TypeVar("Checkpoint")

class BaseChannel(Generic[Value, Update, Checkpoint], ABC):
    """Base class for all channels."""

    __slots__ = ("key", "typ")

    # 完整代码省略
```

泛型定义中，给channel 定义了三种类型的输入:
1. Value: 通道中存储的值的类型。
2. Update: 可以写入通道的更新类型。
3. Checkpoint: 通道当前状态的可序列化快照类型。

### 1.2 BaseChannel 抽象方法

| 方法名                           | 返回类型                | 作用描述                                                   |
| ----------------------------- | ------------------- | ------------------------------------------------------ |
| `ValueType`                   | `Any`               | 声明通道中存储的值的类型（抽象属性）                                     |
| `UpdateType`                  | `Any`               | 声明可以写入通道的更新类型（抽象属性）                                    |
| `copy()`                      | `Self`              | 返回当前通道的副本，默认基于 `checkpoint()` 和 `from_checkpoint()` 实现 |
| `checkpoint()`                | `Checkpoint \| Any` | 返回通道当前状态的可序列化快照；如通道为空则返回 `MISSING`                     |
| `from_checkpoint(checkpoint)` | `Self`              | 基于 checkpoint 创建一个新的相同通道实例（抽象方法）                       |
| `get()`                       | `Value`             | 读取当前通道的值，若尚未写入则抛出 `EmptyChannelError`（抽象方法）            |
| `is_available()`              | `bool`              | 判断当前通道是否已有值，默认通过调用 `get()` 实现                          |
| `update(values)`              | `bool`              | 使用给定的一组更新更新通道状态，返回是否发生变化（抽象方法）                         |
| `consume()`                   | `bool`              | 表示某个任务已经使用了此通道的值，默认无操作；用于控制消费行为                        |
| `finish()`                    | `bool`              | 表示整个图执行即将结束，通道可据此清理或更改状态，默认无操作                         |


### 1.3 ✅ `BaseChannel` 子类
BaseChannel 有如下子类:

| 子类名                            | 核心语义                        | 特点 / 使用场景                  |
| ------------------------------ | --------------------------- | -------------------------- |
| `AnyValue`                     | 存储任意值，无聚合、无验证               | 最通用的通道，适用于默认存储单值场景         |
| `BinaryOperatorAggregate`      | 使用二元操作聚合多个更新为单个值            | 适用于数值求和、列表合并等场景（如 `x + y`） |
| `EphemeralValue`               | 值仅在一次任务中可见，用后即焚             | 适用于临时中间变量，不参与状态快照          |
| `LastValue`                    | 始终保留最近一次写入的值（覆盖写）           | 常用于最新状态存储，如最终响应、变量覆盖       |
| `LastValueAfterFinish`         | 与 `LastValue` 类似，但仅在图结束时才可见 | 用于隐藏中间状态，只暴露最终结果           |
| `NamedBarrierValue`            | 所有指定 writers 写入后，才可读取       | 多个节点同步的“屏障”，用于协调依赖         |
| `NamedBarrierValueAfterFinish` | 与上类似，但只在图执行完后暴露             | 延迟暴露聚合值（如日志、结果统计）          |
| `Topic`                        | 发布/订阅消息通道，支持消息广播            | 多节点触发、多输出场景（如事件流）          |
| `UntrackedValue`               | 值可读写，但不会被记录进状态快照            | 适用于只用于推理、不希望持久化的中间值        |


按照行为，channel 的子类可以分为如下几类:

| 分类         | 子类名                                                    | 特征                   |
| ---------- | ------------------------------------------------------ | -------------------- |
| **单值通道**   | `AnyValue`, `LastValue`                                | 存储最近一次写入             |
| **聚合通道**   | `BinaryOperatorAggregate`, `NamedBarrierValue`         | 多值合并或协调              |
| **只读一次**   | `EphemeralValue`, `UntrackedValue`                     | 用完即失，不记录状态           |
| **最终值通道**  | `LastValueAfterFinish`, `NamedBarrierValueAfterFinish` | 仅在流程结束后暴露            |
| **事件广播通道** | `Topic`                                                | 多订阅者触发，适合多节点 fan-out |

现在我们来看这些子类的实现。


## 2. AnyValue
AnyValue 存储任意值，无聚合、无验证，单值通道。AnyValue 比较好理解，源码如下。

```python
class AnyValue(Generic[Value], BaseChannel[Value, Value, Value]):
    """Stores the last value received, assumes that if multiple values are
    received, they are all equal."""

    __slots__ = ("typ", "value")

    value: Value | Any

    def __init__(self, typ: Any, key: str = "") -> None:
        super().__init__(typ, key)
        self.value = MISSING
    
    def copy(self) -> Self:
        """Return a copy of the channel."""
        empty = self.__class__(self.typ, self.key)
        empty.value = self.value
        return empty

    def from_checkpoint(self, checkpoint: Value) -> Self:
        empty = self.__class__(self.typ, self.key)
        if checkpoint is not MISSING:
            empty.value = checkpoint
        return empty

    def update(self, values: Sequence[Value]) -> bool:
        if len(values) == 0:
            if self.value is MISSING:
                return False
            else:
                self.value = MISSING
                return True

        self.value = values[-1]
        return True

    def get(self) -> Value:
        if self.value is MISSING:
            raise EmptyChannelError()
        return self.value

    def checkpoint(self) -> Value:
        return self.value

```

## 3. LastValue
LastValue 始终保留最近一次写入的值（覆盖写）。与 AnyValue 不同的是 update 方法，每次限制只能接受一个值。

```python
class LastValue(Generic[Value], BaseChannel[Value, Value, Value]):
    """Stores the last value received, can receive at most one value per step."""

    __slots__ = ("value",)

    value: Value | Any

    def __init__(self, typ: Any, key: str = "") -> None:
        super().__init__(typ, key)
        self.value = MISSING

    def update(self, values: Sequence[Value]) -> bool:
        if len(values) == 0:
            return False
        if len(values) != 1:
            msg = create_error_message(
                message=f"At key '{self.key}': Can receive only one value per step. Use an Annotated key to handle multiple values.",
                error_code=ErrorCode.INVALID_CONCURRENT_GRAPH_UPDATE,
            )
            raise InvalidUpdateError(msg)

        self.value = values[-1]
        return True
```

## 3. LastValueAfterFinish

LastValueAfterFinish 与 `LastValue` 类似，但仅在图结束时才可见。图是否结束是通过 finished 属性控制的。只有调用 finish() 方法之后，值才可见。

```python
class LastValueAfterFinish(
    Generic[Value], BaseChannel[Value, Value, tuple[Value, bool]]
):
    """Stores the last value received, but only made available after finish().
    Once made available, clears the value."""

    __slots__ = ("value", "finished")

    value: Value | Any
    finished: bool

    def __init__(self, typ: Any, key: str = "") -> None:
        super().__init__(typ, key)
        self.value = MISSING
        self.finished = False

    def checkpoint(self) -> tuple[Value | Any, bool] | Any:
        if self.value is MISSING:
            return MISSING
        return (self.value, self.finished)

    def from_checkpoint(self, checkpoint: tuple[Value | Any, bool] | Any) -> Self:
        empty = self.__class__(self.typ)
        empty.key = self.key
        if checkpoint is not MISSING:
            empty.value, empty.finished = checkpoint
        return empty

    def update(self, values: Sequence[Value | Any]) -> bool:
        if len(values) == 0:
            return False

        self.finished = False
        self.value = values[-1]
        return True

    def consume(self) -> bool:
        if self.finished:
            self.finished = False
            self.value = MISSING
            return True

        return False

    def finish(self) -> bool:
        if not self.finished and self.value is not MISSING:
            self.finished = True
            return True
        else:
            return False

```


## 4. BinaryOperatorAggregate
BinaryOperatorAggregate 使用二元操作聚合多个更新为单个值。BinaryOperatorAggregate 的核心是接受一个二元操作符（operator），以聚合值。

```python
class BinaryOperatorAggregate(Generic[Value], BaseChannel[Value, Value, Value]):
    """Stores the result of applying a binary operator to the current value and each new value.

    import operator

    total = Channels.BinaryOperatorAggregate(int, operator.add)
    """

    __slots__ = ("value", "operator")

    def __init__(self, typ: type[Value], operator: Callable[[Value, Value], Value]):
        super().__init__(typ)
        self.operator = operator
        # special forms from typing or collections.abc are not instantiable
        # so we need to replace them with their concrete counterparts
        # 还原基础类型
        typ = _strip_extras(typ)
        if typ in (collections.abc.Sequence, collections.abc.MutableSequence):
            typ = list
        if typ in (collections.abc.Set, collections.abc.MutableSet):
            typ = set
        if typ in (collections.abc.Mapping, collections.abc.MutableMapping):
            typ = dict
        try:
            self.value = typ()
        except Exception:
            self.value = MISSING

    def checkpoint(self) -> Value:
        return self.value

    def update(self, values: Sequence[Value]) -> bool:
        if not values:
            return False
        if self.value is MISSING:
            self.value = values[0]
            values = values[1:]
        for value in values:
            self.value = self.operator(self.value, value)
        return True
```

### 4.1 _strip_extras

_strip_extras(t) 的作用是：递归地去除类型注解中的 Annotated、Required、NotRequired 等“包装类型”，还原出“基础类型”。

在 Python 的 typing 类型系统中，类型注解可能被多层“包装”：

* `Annotated[int, "some metadata"]` → 包裹了 `int`
* `Required[str]` / `NotRequired[float]` → 特别用于 `TypedDict` 的字段，表示是否必须

这些包装类型的本质是类型工厂，构建出来的是 `__origin__` 指向基础类型的对象。

```python
from typing import Annotated, Required, NotRequired

Annotated[int, "meta"].__origin__     # <class 'int'>
Required[str].__origin__              # <class 'str'>
```

下面是其源码:

```python
# Adapted from typing_extensions
def _strip_extras(t):  # type: ignore[no-untyped-def]
    """Strips Annotated, Required and NotRequired from a given type."""
    # 如果 `t` 是一个被包装的类型（如 `Annotated[int, ...]`），则提取它的 `__origin__`（即原始类型）继续递归。
    if hasattr(t, "__origin__"):
        return _strip_extras(t.__origin__)
    # 不执行这个条件
    if hasattr(t, "__origin__") and t.__origin__ in (Required, NotRequired):
        return _strip_extras(t.__args__[0])

    return t
```

## 5. NamedBarrierValue
NamedBarrierValue 在所有指定 writers 写入后，才可读取。NamedBarrierValue 不保存具体的值，只用于屏障，其 get 方法返回 None。只有 self.names == self.seen 时才可读。

```python
class NamedBarrierValue(Generic[Value], BaseChannel[Value, Value, set[Value]]):
    """A channel that waits until all named values are received before making the value available."""

    __slots__ = ("names", "seen")

    names: set[Value]
    seen: set[Value]

    def __init__(self, typ: type[Value], names: set[Value]) -> None:
        super().__init__(typ)
        self.names = names
        self.seen: set[str] = set()

    def checkpoint(self) -> set[Value]:
        return self.seen

    def from_checkpoint(self, checkpoint: set[Value]) -> Self:
        empty = self.__class__(self.typ, self.names)
        empty.key = self.key
        if checkpoint is not MISSING:
            empty.seen = checkpoint
        return empty

    def update(self, values: Sequence[Value]) -> bool:
        updated = False
        for value in values:
            if value in self.names:
                if value not in self.seen:
                    self.seen.add(value)
                    updated = True
            else:
                raise InvalidUpdateError(
                    f"At key '{self.key}': Value {value} not in {self.names}"
                )
        return updated

    # get 方法不返回具体值
    def get(self) -> Value:
        if self.seen != self.names:
            raise EmptyChannelError()
        return None

    def consume(self) -> bool:
        if self.seen == self.names:
            self.seen = set()
            return True
        return False
```

## 6. NamedBarrierValueAfterFinish
NamedBarrierValueAfterFinish 在 NamedBarrierValue 的基础上增加了 finish() 方法，只有在 finish() 方法被调用后，才能读取到具体的值。

```python
class NamedBarrierValueAfterFinish(
    Generic[Value], BaseChannel[Value, Value, set[Value]]
):
    """A channel that waits until all named values are received before making the value ready to be made available. It is only made available after finish() is called."""

    __slots__ = ("names", "seen", "finished")

    names: set[Value]
    seen: set[Value]

    def __init__(self, typ: type[Value], names: set[Value]) -> None:
        super().__init__(typ)
        self.names = names
        self.seen: set[str] = set()
        self.finished = False


    def get(self) -> Value:
        if not self.finished or self.seen != self.names:
            raise EmptyChannelError()
        return None

    def checkpoint(self) -> tuple[set[Value], bool]:
        return (self.seen, self.finished)
```

## 7. EphemeralValue
EphemeralValue 值仅在一次任务中可见，用后即焚。用后即焚并没有类本身中体现。相比于 LastValue 多了一个 guard 参数，控制 update 接收的 values 数量是否允许多个。

```python
class EphemeralValue(Generic[Value], BaseChannel[Value, Value, Value]):
    """Stores the value received in the step immediately preceding, clears after."""

    __slots__ = ("value", "guard")

    value: Value | Any
    guard: bool

    def __init__(self, typ: Any, guard: bool = True) -> None:
        super().__init__(typ)
        self.guard = guard
        self.value = MISSING
  
    def checkpoint(self) -> Value:
        return self.value

    def update(self, values: Sequence[Value]) -> bool:
        if len(values) == 0:
            if self.value is not MISSING:
                self.value = MISSING
                return True
            else:
                return False
        if len(values) != 1 and self.guard:
            raise InvalidUpdateError(
                f"At key '{self.key}': EphemeralValue(guard=True) can receive only one value per step. Use guard=False if you want to store any one of multiple values."
            )

        self.value = values[-1]
        return True

    def get(self) -> Value:
        if self.value is MISSING:
            raise EmptyChannelError()
        return self.value
```

## 8. UntrackedValue
UntrackedValue 值可读写，但不会被记录进状态快照。体现在 checkpoint 方法上。

```python

class UntrackedValue(Generic[Value], BaseChannel[Value, Value, Value]):
    """Stores the last value received, never checkpointed."""

    __slots__ = ("value", "guard")

    guard: bool
    value: Value | Any

    def __init__(self, typ: type[Value], guard: bool = True) -> None:
        super().__init__(typ)
        self.guard = guard
        self.value = MISSING

    def checkpoint(self) -> Value | Any:
        return MISSING

    def from_checkpoint(self, checkpoint: Value) -> Self:
        empty = self.__class__(self.typ, self.guard)
        empty.key = self.key
        return empty

    def update(self, values: Sequence[Value]) -> bool:
        if len(values) == 0:
            return False
        if len(values) != 1 and self.guard:
            raise InvalidUpdateError(
                f"At key '{self.key}': UntrackedValue(guard=True) can receive only one value per step. Use guard=False if you want to store any one of multiple values."
            )

        self.value = values[-1]
        return True

    def get(self) -> Value:
        if self.value is MISSING:
            raise EmptyChannelError()
        return self.value
```

## 9. Topic
Topic 发布/订阅消息通道，支持消息广播。消息的广播也没有体现在自身的实现上。accumulate 累加体现在 update 方法上。如果非累加，先清空 self.values

```python
class Topic(
    Generic[Value],
    BaseChannel[Sequence[Value], Union[Value, list[Value]], list[Value]],
):
    """A configurable PubSub Topic.

    Args:
        typ: The type of the value stored in the channel.
        accumulate: Whether to accumulate values across steps. If False, the channel will be emptied after each step.
    """

    __slots__ = ("values", "accumulate")

    def __init__(self, typ: type[Value], accumulate: bool = False) -> None:
        super().__init__(typ)
        # attrs
        self.accumulate = accumulate
        # state
        self.values = list[Value]()

    @property
    def ValueType(self) -> Any:
        """The type of the value stored in the channel."""
        return Sequence[self.typ]  # type: ignore[name-defined]

    @property
    def UpdateType(self) -> Any:
        """The type of the update received by the channel."""
        return Union[self.typ, list[self.typ]]  # type: ignore[name-defined]

    def checkpoint(self) -> list[Value]:
        return self.values

    def from_checkpoint(self, checkpoint: list[Value]) -> Self:
        empty = self.__class__(self.typ, self.accumulate)
        empty.key = self.key
        if checkpoint is not MISSING:
            if isinstance(checkpoint, tuple):
                # backwards compatibility
                empty.values = checkpoint[1]
            else:
                empty.values = checkpoint
        return empty

    def update(self, values: Sequence[Value | list[Value]]) -> bool:
        updated = False
        if not self.accumulate:
            updated = bool(self.values)
            # 非累加状态，先清空旧值
            self.values = list[Value]()
        if flat_values := tuple(_flatten(values)):
            updated = True
            self.values.extend(flat_values)
        return updated

    def get(self) -> Sequence[Value]:
        if self.values:
            return list(self.values)
        else:
            raise EmptyChannelError
```