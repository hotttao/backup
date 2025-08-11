---
weight: 1
title: "pregel runtime"
date: 2025-08-01T15:00:00+08:00
lastmod: 2025-08-01T15:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "pregel runtime"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

## 1. Runtime
```bash
# 提问
上面是 Langgraph Runtime 的定义，请给我解释一下 Runtime 的语义，并以表格的形式列举 Runtime 的属性，并以另一个表格列举 Runtime 的方法
```
### 1.1 Runtime 语义

LangGraph 中的 `Runtime` 类是一个用于封装运行时上下文与工具的便利类，通常会在每个图执行期间作为第二个参数注入节点函数中（第一个是 `state`，第二个是 `runtime`），以提供更强大的能力，比如：

* **访问上下文信息（如用户 ID）**
* **读写 store（用于 memory / checkpoint /缓存）**
* **写入流输出**
* **访问上一个线程的结果（functional API 下）**

---

| 方面          | 含义                                                          |
| ----------- | ----------------------------------------------------------- |
| 🎯 **作用**   | 提供给每个节点函数的运行时环境，封装与当前运行相关的上下文、存储系统、输出流、上一次运行结果等             |
| 🧩 **位置**   | 自动注入在每个节点函数的第二个参数中，例如：`def my_node(state, runtime): ...`    |
| 💡 **类比**   | 类似于 web 框架中的 `request.context` 或任务执行框架中的 `ExecutionContext` |
| 🔧 **适用场景** | 多用户图、上下文依赖节点（如需要 user\_id、DB conn）、需要 store 持久化、需要流式写入输出等   |

下面是 Runtime 的使用示例:

```python
from typing import TypedDict
from langgraph.graph import StateGraph
from dataclasses import dataclass
from langgraph.runtime import Runtime
from langgraph.store.memory import InMemoryStore


@dataclass
class Context:  # (1)!
    user_id: str


class State(TypedDict, total=False):
    response: str


store = InMemoryStore()  # (2)!
store.put(("users",), "user_123", {"name": "Alice"})


def personalized_greeting(state: State, runtime: Runtime[Context]) -> State:
    '''Generate personalized greeting using runtime context and store.'''
    user_id = runtime.context.user_id  # (3)!
    name = "unknown_user"
    if runtime.store:
        if memory := runtime.store.get(("users",), user_id):
            name = memory.value["name"]

    response = f"Hello {name}! Nice to see you again."
    return {"response": response}


graph = (
    StateGraph(state_schema=State, context_schema=Context)
    .add_node("personalized_greeting", personalized_greeting)
    .set_entry_point("personalized_greeting")
    .set_finish_point("personalized_greeting")
    .compile(store=store)
)

result = graph.invoke({}, context=Context(user_id="user_123"))
print(result)
# > {'response': 'Hello Alice! Nice to see you again.'}
```

### 1.2 Runtime 属性
下面是 Runtime 属性的说明:

| 属性名             | 类型                  | 说明                                                        |
| --------------- | ------------------- | --------------------------------------------------------- |
| `context`       | `ContextT`          | 与当前运行绑定的上下文对象，通常是一个 `@dataclass`，用于传入如 `user_id`、数据库连接等依赖 |
| `store`         | `BaseStore \| None` | 可选的运行时存储接口，用于访问 `memory` / `checkpoint` 等状态数据             |
| `stream_writer` | `StreamWriter`      | 自定义的输出流写入函数，通常用于增量/中间输出                                   |
| `previous`      | `Any`               | 上一个线程的返回值，仅在启用 functional API + checkpointer 时可用          |


```python

@dataclass(**_DC_KWARGS)
class Runtime(Generic[ContextT]):
    context: ContextT = field(default=None)  # type: ignore[assignment]
    """Static context for the graph run, like user_id, db_conn, etc.
    
    Can also be thought of as 'run dependencies'."""

    store: BaseStore | None = field(default=None)
    """Store for the graph run, enabling persistence and memory."""

    stream_writer: StreamWriter = field(default=_no_op_stream_writer)
    """Function that writes to the custom stream."""

    previous: Any = field(default=None)
    """The previous return value for the given thread.
    
    Only available with the functional API when a checkpointer is provided.
    """
```

下面是 Runtime 在 Pregel 初始化的相关代码，初始化示例有助于我们理解 Runtime 每个参数的含义:

```python
runtime = Runtime(
    # 对 context 做类型转换，对应示例传入的 context_schema
    context=_coerce_context(self.context_schema, context),
    # BaseStore
    store=store,
    # def stream_writer(c: Any) -> None:
    # 内部会调用 SyncQueue.put 方法，往消息队列提交自定义消息
    # pregel.stream 可以向 SyncQueue 发送消息
    stream_writer=stream_writer,
    previous=None,
)
parent_runtime = config[CONF].get(CONFIG_KEY_RUNTIME, DEFAULT_RUNTIME)
# 从 configurable 获取 __pregel_runtime 并合并
runtime = parent_runtime.merge(runtime)
# 更新 runtime
config[CONF][CONFIG_KEY_RUNTIME] = runtime
```

### 1.3 泛型变量 ContextT
下面是 ContextT 的声明，它是一个泛型变量，用于表示上下文对象的类型。之前对 Python 泛型关注的比较少，这里对此做个详细解释。


```python
# 是 Python 3.11+ 中 带 default 参数的 TypeVar 泛型变量定义，用于类型系统中的泛型约束。
ContextT = TypeVar("ContextT", bound=Union[StateLike, None], default=None)
```

| 部分                             | 含义说明                                             |
| ------------------------------ | ------------------------------------------------ |
| `TypeVar("ContextT", ...)`     | 创建一个类型变量 `ContextT`，可用于泛型函数、类、方法中                |
| `bound=Union[StateLike, None]` | 表示 `ContextT` 必须是 `StateLike` 或 `None` 的子类（上界约束） |
| `default=None`                 | 如果使用者不提供具体类型参数时，默认 `ContextT = None`|       


#### StateLike

```python
# 是 Python 中的 类型别名 定义，用来为复杂类型起一个更简洁、更语义化的名字。
StateLike: TypeAlias = Union[TypedDictLikeV1, TypedDictLikeV2, DataclassLike, BaseModel]
```

| 部分           | 含义说明                                   |
| ------------ | -------------------------------------- |
| `StateLike`  | 新定义的类型别名名，用于表示“状态类”的泛型类型               |
| `TypeAlias`  | Python 3.10+ 引入的关键字，用来显式声明这是一个**类型别名** |
| `Union[...]` | 表示联合类型，即多个类型中的任意一个                     |


```python
class TypedDictLikeV1(Protocol):
    """Protocol to represent types that behave like TypedDicts

    Version 1: using `ClassVar` for keys."""

    __required_keys__: ClassVar[frozenset[str]]
    __optional_keys__: ClassVar[frozenset[str]]


class TypedDictLikeV2(Protocol):
    """Protocol to represent types that behave like TypedDicts

    Version 2: not using `ClassVar` for keys."""

    __required_keys__: frozenset[str]
    __optional_keys__: frozenset[str]


class DataclassLike(Protocol):
    """Protocol to represent types that behave like dataclasses.

    Inspired by the private _DataclassT from dataclasses that uses a similar protocol as a bound."""

    __dataclass_fields__: ClassVar[dict[str, Field[Any]]]
```

这三个类：

* `TypedDictLikeV1`
* `TypedDictLikeV2`
* `DataclassLike`

都是使用 `Protocol` 定义的**结构类型协议**，用于在类型系统中判断某个对象\*\*“长得像”某种结构（鸭子类型）\*\*，而不要求实际继承某个类。


#### ✅ 基本概念回顾：`Protocol`

* `Protocol` 是 Python 的 **结构子类型系统**（Structural Subtyping）的一部分（PEP 544）。
* 它允许你定义一种类型接口（签名/属性结构），只要一个类满足这些结构，就被视为是该协议的子类——**即使它没显式继承**。

---

#### 📘 1. `TypedDictLikeV1`

```python
class TypedDictLikeV1(Protocol):
    """Version 1: using `ClassVar` for keys."""
    __required_keys__: ClassVar[frozenset[str]]
    __optional_keys__: ClassVar[frozenset[str]]
```

🧠 说明：

* 表示一个**行为像 TypedDict** 的类，**版本1**。
* 要求这个类具有两个**类变量**（`ClassVar`）：

  * `__required_keys__`: 所有必须字段名
  * `__optional_keys__`: 所有可选字段名
* 这些字段是 **静态定义在类上的常量**。

✅ 用途示例：

```python
class MyTD:
    __required_keys__ = frozenset({"a", "b"})
    __optional_keys__ = frozenset({"c"})
```

虽然它不是 `TypedDict`，但它行为符合 `TypedDictLikeV1` 协议。

---

#### 📘 2. `TypedDictLikeV2`

```python
class TypedDictLikeV2(Protocol):
    """Version 2: not using `ClassVar` for keys."""
    __required_keys__: frozenset[str]
    __optional_keys__: frozenset[str]
```

🧠 说明：

* 表示**行为像 TypedDict** 的类，**版本2**。
* 与 V1 不同，它要求这两个字段是**实例属性**（不是 `ClassVar`）。

✅ 用途区别：

| 属性声明方式     | V1 要求    | V2 要求     |
| ---------- | -------- | --------- |
| `ClassVar` | ✅ 必须是类属性 | ❌ 不能是类属性  |
| 实例属性       | ❌ 非预期    | ✅ 必须是实例属性 |

> ⚠️ 一般真实 `TypedDict` 更接近 V1，因为其元信息是定义在类上的。

---

#### 📘 3. `DataclassLike`

```python
class DataclassLike(Protocol):
    """行为类似 dataclass 的类型"""
    __dataclass_fields__: ClassVar[dict[str, Field[Any]]]
```

🧠 说明：

* 表示一个行为类似 `@dataclass` 的类。
* 要求该类拥有一个类属性 `__dataclass_fields__`，是字段名到 `Field` 的映射（`Field` 是 dataclasses 内部表示字段的类型）。

✅ 满足条件的示例：

```python
from dataclasses import dataclass

@dataclass
class User:
    name: str
    age: int

# User 类自动有 __dataclass_fields__ 属性
```

---

#### ✅ 总结对比

| 协议名               | 检查属性                                     | 属性类型          | 目标结构             |
| ----------------- | ---------------------------------------- | ------------- | ---------------- |
| `TypedDictLikeV1` | `__required_keys__`, `__optional_keys__` | 类属性（ClassVar） | 模拟 TypedDict v1  |
| `TypedDictLikeV2` | 同上                                       | 实例属性          | 模拟 TypedDict v2  |
| `DataclassLike`   | `__dataclass_fields__`                   | 类属性           | Python dataclass |

这些协议可以用于泛型约束（如 `StateLike`）、静态类型检查、LangGraph 状态推导等场景。

### 1.4 Runtime 方法

```python
@dataclass(**_DC_KWARGS)
class Runtime(Generic[ContextT]):
    def merge(self, other: Runtime[ContextT]) -> Runtime[ContextT]:
        """Merge two runtimes together.

        If a value is not provided in the other runtime, the value from the current runtime is used.
        """
        return Runtime(
            context=other.context or self.context,
            store=other.store or self.store,
            stream_writer=other.stream_writer
            if other.stream_writer is not _no_op_stream_writer
            else self.stream_writer,
            previous=other.previous or self.previous,
        )

    def override(
        self, **overrides: Unpack[_RuntimeOverrides[ContextT]]
    ) -> Runtime[ContextT]:
        """Replace the runtime with a new runtime with the given overrides."""
        return replace(self, **overrides)
```

| 方法名        | 输入参数                       | 返回值                 | 说明                                                    |
| ---------- | -------------------------- | ------------------- | ----------------------------------------------------- |
| `merge`    | `other: Runtime[ContextT]` | `Runtime[ContextT]` | 合并两个 Runtime：优先使用 `other` 中非空值，否则用当前实例的值（类似配置叠加）      |
| `override` | `**overrides`              | `Runtime[ContextT]` | 使用 `dataclasses.replace` 创建一个带 override 的新 Runtime 实例 |

### 1.5 DEFAULT_RUNTIME

```python
DEFAULT_RUNTIME = Runtime(
    context=None,
    store=None,
    stream_writer=_no_op_stream_writer,
    previous=None,
)

def _no_op_stream_writer(_: Any) -> None: ...
```