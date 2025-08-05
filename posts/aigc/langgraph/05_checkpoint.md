---
weight: 1
title: "langgraph checkpointer"
date: 2025-08-01T12:00:00+08:00
lastmod: 2025-08-01T12:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langgraph checkpointer"
featuredImage: 

tags: ["langgraph 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

langgraph 中的 Checkpointer 用于在流程中持久化执行进度，使得可以恢复中断或支持长时间运行。

## 1. Checkpointer
Langgraph 中定义了三个类用于实现对 Checkpointer 的定义:
2. Checkpoint
1. CheckpointTuple
3. CheckpointMetadata

| 序号  | 名称                   | 角色            | 说明                               |
| --- | -------------------- | ------------- | -------------------------------- |
| 1️⃣ | `CheckpointTuple`    | 📦 顶层容器       | 封装了 checkpoint 本体、其元数据、相关配置等     |
| 2️⃣ | `Checkpoint`         | 🧠 核心数据（状态快照） | 图执行中保存的值、状态、调度上下文等               |
| 3️⃣ | `CheckpointMetadata` | 🏷️ 元数据标签     | checkpoint 的非功能信息（时间戳、ID、tags 等） |


### 1.1 Checkpoint

```python
ChannelVersions = dict[str, Union[str, int, float]]

class Checkpoint(TypedDict):
    """State snapshot at a given point in time."""

    v: int
    """The version of the checkpoint format. Currently 1."""
    id: str
    """The ID of the checkpoint. This is both unique and monotonically
    increasing, so can be used for sorting checkpoints from first to last."""
    ts: str
    """The timestamp of the checkpoint in ISO 8601 format."""
    channel_values: dict[str, Any]
    """The values of the channels at the time of the checkpoint.
    Mapping from channel name to deserialized channel snapshot value.
    """
    channel_versions: ChannelVersions
    """The versions of the channels at the time of the checkpoint.
    The keys are channel names and the values are monotonically increasing
    version strings for each channel.
    """
    versions_seen: dict[str, ChannelVersions]
    """Map from node ID to map from channel name to version seen.
    This keeps track of the versions of the channels that each node has seen.
    Used to determine which nodes to execute next.
    """
```

| 属性名                | 含义                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `v`                | 检查点格式的版本号，目前为 `1`。用于向前兼容。                                                                        |
| `id`               | 检查点的唯一标识符，单调递增（可用于排序）。                                                                           |
| `ts`               | 检查点的时间戳，ISO 8601 格式字符串，例如 `"2025-08-04T10:32:00.000Z"`。                                          |
| `channel_values`   | 当前检查点时所有 channel 的值，键为 channel 名，值为反序列化后的数据。                                                     |
| `channel_versions` | 每个 channel 当前的版本号，键为 channel 名，值为字符串、整数或浮点数等单调递增值。                                               |
| `versions_seen`    | 用于追踪每个 node 最近“看见”的 channel 版本。键为 node 名，值为该 node 最近读到的 `{channel: version}` 映射。可用于判断哪些节点需要重新执行。 |

下面是一个示例:

```python
{
    "v": 1,
    "id": "00023",
    "ts": "2025-08-04T10:32:00.000Z",
    "channel_values": {
        "input": "What is LangGraph?",
        "output": "LangGraph is a..."
    },
    "channel_versions": {
        "input": 1,
        "output": 1
    },
    "versions_seen": {
        "node_1": {"input": 1},
        "node_2": {"output": 1}
    }
}

```

### 1.2 CheckpointMetadata

```python
class CheckpointMetadata(TypedDict, total=False):
    """Metadata associated with a checkpoint."""

    source: Literal["input", "loop", "update", "fork"]
    """The source of the checkpoint.

    - "input": The checkpoint was created from an input to invoke/stream/batch.
    - "loop": The checkpoint was created from inside the pregel loop.
    - "update": The checkpoint was created from a manual state update.
    - "fork": The checkpoint was created as a copy of another checkpoint.
    """
    step: int
    """The step number of the checkpoint.

    -1 for the first "input" checkpoint.
    0 for the first "loop" checkpoint.
    ... for the nth checkpoint afterwards.
    """
    parents: dict[str, str]
    """The IDs of the parent checkpoints.

    Mapping from checkpoint namespace to checkpoint ID.
    """
```


| 属性名       | 说明                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source`  | 检查点的来源类型。可选值为：<br>• `"input"`：由 `.invoke()` / `.stream()` / `.batch()` 触发时创建的初始检查点。<br>• `"loop"`：由 Pregel 主循环中自动创建的检查点。<br>• `"update"`：由手动更新状态触发的检查点。<br>• `"fork"`：复制自其他检查点。 |
| `step`    | 当前检查点所在的步骤编号。<br>• `-1` 表示最初的 `"input"` 检查点。<br>• `0` 表示 `"loop"` 开始的第一步。<br>• 正整数表示之后的每一步。                                                                                     |
| `parents` | 记录当前检查点的直接“父”检查点 ID。<br>键为检查点命名空间（namespace），值为父检查点的 ID。用于构建检查点的“血缘关系图”或分支管理。                                                                                                   |


下面是一个值示例:

```python
{
    "source": "loop",
    "step": 2,
    "parents": {
        "default": "chkpt_0001"
    }
}

```

### 1.3 CheckpointTuple
```python
V = TypeVar("V", int, float, str)
PendingWrite = tuple[str, str, Any]

class CheckpointTuple(NamedTuple):
    """A tuple containing a checkpoint and its associated data."""

    config: RunnableConfig
    checkpoint: Checkpoint
    metadata: CheckpointMetadata
    parent_config: RunnableConfig | None = None
    pending_writes: list[PendingWrite] | None = None

```

| 属性名              | 说明                                                            |
| ---------------- | ------------------------------------------------------------- |
| `config`         | 当前执行上下文的配置（`RunnableConfig` 类型），包含调用参数、Tracing、Callbacks 等信息。 |
| `checkpoint`     | 当前检查点的核心内容（类型为 `Checkpoint`），记录了状态快照、channel 值和版本等。           |
| `metadata`       | 与该检查点相关的元信息（`CheckpointMetadata`），例如来源、step 序号、父检查点等。         |
| `parent_config`  | （可选）父检查点的配置。如果当前检查点是从另一个分支或复制而来的，记录其原始配置。                     |
| `pending_writes` | （可选）尚未执行但计划写入的 `PendingWrite` 列表，通常用于延迟写入或静态分析。               |


## 2. BaseCheckpointSaver
Checkpointer 如何保存由 BaseCheckpointSaver 抽象基类约定。

### 2.1 BaseCheckpointSaver 属性

BaseCheckpointSaver 属性只有一个序列化器。

```python
class BaseCheckpointSaver(Generic[V]):
    """Base class for creating a graph checkpointer.

    Checkpointers allow LangGraph agents to persist their state
    within and across multiple interactions.

    Attributes:
        serde (SerializerProtocol): Serializer for encoding/decoding checkpoints.

    Note:
        When creating a custom checkpoint saver, consider implementing async
        versions to avoid blocking the main thread.
    """

    serde: SerializerProtocol = JsonPlusSerializer()
```

### 2.2 BaseCheckpointSaver 方法

BaseCheckpointSaver 定义了如下方法，我们意义来看具体实现。

| 方法名                                                | 作用                                           | 返回值类型                            |         |
| -------------------------------------------------- | -------------------------------------------- | -------------------------------- | ------- |
| `config_specs`                                     | 定义检查点存储器支持的配置字段（用于参数展示或 UI）                  | `list`                           |         |
| `get(config)`                                      | 获取指定配置的检查点（简化形式，仅取 `checkpoint` 部分）          | \`Checkpoint                     | None\`  |
| `get_tuple(config)`                                | 获取指定配置的检查点元组（包含 checkpoint、metadata、version） | \`CheckpointTuple                | None\`  |
| `list(config, ...)`                                | 列出符合条件的检查点（可加过滤器、上限）                         | `Iterator[CheckpointTuple]`      |         |
| `put(config, checkpoint, metadata, new_versions)`  | 存储一个检查点及其元数据                                 | `RunnableConfig`                 |         |
| `put_writes(config, writes, task_id, task_path)`   | 存储与任务关联的中间产出（write events）                   | `None`                           |         |
| `delete_thread(thread_id)`                         | 删除与特定 thread\_id 相关的所有 checkpoint 和 write 数据 | `None`                           |         |
| `aget(config)`                                     | 异步获取检查点（简化）                                  | \`Awaitable\[Checkpoint          | None]\` |
| `aget_tuple(config)`                               | 异步获取检查点元组                                    | \`Awaitable\[CheckpointTuple     | None]\` |
| `alist(config, ...)`                               | 异步列出检查点列表                                    | `AsyncIterator[CheckpointTuple]` |         |
| `aput(config, checkpoint, metadata, new_versions)` | 异步存储检查点及其版本信息                                | `Awaitable[RunnableConfig]`      |         |
| `aput_writes(config, writes, task_id, task_path)`  | 异步存储中间写入产物                                   | `Awaitable[None]`                |         |
| `adelete_thread(thread_id)`                        | 异步删除与某 thread 相关的所有 checkpoint 和 write       | `Awaitable[None]`                |         |
| `get_next_version(current, channel)`               | 生成下一版本号（默认：数字自增）                             | `V`（泛型，可为 `int/float/str`）       |         |

## 3. InMemorySaver
我们来看 Langgraph 提供的 BaseCheckpointSaver 的一个具体实现：InMemorySaver。位于 `langgraph\checkpoint\memory\__init__.py`

下面是 InMemorySaver 的使用示例:

```python
import asyncio

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import StateGraph

builder = StateGraph(int)
builder.add_node("add_one", lambda x: x + 1)
builder.set_entry_point("add_one")
builder.set_finish_point("add_one")

memory = InMemorySaver()
graph = builder.compile(checkpointer=memory)
coro = graph.ainvoke(1, {"configurable": {"thread_id": "thread-1"}})
asyncio.run(coro)  # Output: 2
```

### 3.1 InMemorySaver 属性

```python
class InMemorySaver(
    BaseCheckpointSaver[str], AbstractContextManager, AbstractAsyncContextManager
):
    # thread ID ->  checkpoint NS -> checkpoint ID -> checkpoint mapping
    storage: defaultdict[
        str,
        dict[str, dict[str, tuple[tuple[str, bytes], tuple[str, bytes], str | None]]],
    ]
    # (thread ID, checkpoint NS, checkpoint ID) -> (task ID, write idx)
    writes: defaultdict[
        tuple[str, str, str],
        dict[tuple[str, int], tuple[str, str, tuple[str, bytes], str]],
    ]
    # 每个channel 不同版本 verison 对应的值
    blobs: dict[
        tuple[
            str, str, str, str | int | float
        ],  # thread id, checkpoint ns, channel, version
        tuple[str, bytes],
    ]

    def __init__(
        self,
        *,
        serde: SerializerProtocol | None = None,
        factory: type[defaultdict] = defaultdict,
    ) -> None:
        super().__init__(serde=serde)
        self.storage = factory(lambda: defaultdict(dict))
        self.writes = factory(dict)
        self.blobs = factory()
        self.stack = ExitStack()
        if factory is not defaultdict:
            self.stack.enter_context(self.storage)  # type: ignore[arg-type]
            self.stack.enter_context(self.writes)  # type: ignore[arg-type]
            self.stack.enter_context(self.blobs)  # type: ignore[arg-type]
```

### 3.2 InMemorySaver 方法
#### put 相关方法

```python
class InMemorySaver(
    BaseCheckpointSaver[str], AbstractContextManager, AbstractAsyncContextManager
):
    def put(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint, 
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions, 
    ) -> RunnableConfig:
        c = checkpoint.copy()
        thread_id = config["configurable"]["thread_id"]
        checkpoint_ns = config["configurable"]["checkpoint_ns"]
        # 1. 每个 channel 输出的值
        values: dict[str, Any] = c.pop("channel_values")  # type: ignore[misc]
        # 2. 迭代每个 channel 新的版本号 {"c1": "v10"}
        for k, v in new_versions.items():
            self.blobs[(thread_id, checkpoint_ns, k, v)] = (
                # 3. 如果 channel 有新值
                self.serde.dumps_typed(values[k]) if k in values else ("empty", b"")
            )
        self.storage[thread_id][checkpoint_ns].update(
            {
                # 保存的 checkpoint_id
                checkpoint["id"]: (
                    self.serde.dumps_typed(c), # type, value
                    self.serde.dumps_typed(get_checkpoint_metadata(config, metadata)), metadata
                    config["configurable"].get("checkpoint_id"),  # config 保存的是 parent_checkpoint_id
                )
            }
        )
        return {
            "configurable": {
                "thread_id": thread_id,
                "checkpoint_ns": checkpoint_ns,
                "checkpoint_id": checkpoint["id"],
            }
        }

    def put_writes(
        self,
        config: RunnableConfig,
        # writes 对应 _assemble_writes 函数输出的要写入channel 的值 (channel, value) 的元组
        writes: Sequence[tuple[str, Any]],
        task_id: str,
        task_path: str = "",
    ) -> None:

        thread_id = config["configurable"]["thread_id"]
        checkpoint_ns = config["configurable"].get("checkpoint_ns", "")
        checkpoint_id = config["configurable"]["checkpoint_id"]
        outer_key = (thread_id, checkpoint_ns, checkpoint_id)
        outer_writes_ = self.writes.get(outer_key)
        for idx, (c, v) in enumerate(writes):
            # 
            inner_key = (task_id, WRITES_IDX_MAP.get(c, idx))
            if inner_key[1] >= 0 and outer_writes_ and inner_key in outer_writes_:
                continue

            self.writes[outer_key][inner_key] = (
                task_id,
                c,
                self.serde.dumps_typed(v),
                task_path,
            )
```

#### get 相关方法

```python
    def get_tuple(self, config: RunnableConfig) -> CheckpointTuple | None:
        """Get a checkpoint tuple from the in-memory storage.

        This method retrieves a checkpoint tuple from the in-memory storage based on the
        provided config. If the config contains a "checkpoint_id" key, the checkpoint with
        the matching thread ID and timestamp is retrieved. Otherwise, the latest checkpoint
        for the given thread ID is retrieved.

        Args:
            config: The config to use for retrieving the checkpoint.

        Returns:
            Optional[CheckpointTuple]: The retrieved checkpoint tuple, or None if no matching checkpoint was found.
        """
        thread_id: str = config["configurable"]["thread_id"]
        checkpoint_ns: str = config["configurable"].get("checkpoint_ns", "")
        if checkpoint_id := get_checkpoint_id(config):
            if saved := self.storage[thread_id][checkpoint_ns].get(checkpoint_id):
                checkpoint, metadata, parent_checkpoint_id = saved
                writes = self.writes[(thread_id, checkpoint_ns, checkpoint_id)].values()
                checkpoint_: Checkpoint = self.serde.loads_typed(checkpoint)
                return CheckpointTuple(
                    config=config,
                    checkpoint={
                        **checkpoint_,
                        # 加载channel 对应的值
                        "channel_values": self._load_blobs(
                            thread_id, checkpoint_ns, checkpoint_["channel_versions"]
                        ),
                    },
                    metadata=self.serde.loads_typed(metadata),
                    pending_writes=[
                        # task, channel, value
                        (id, c, self.serde.loads_typed(v)) for id, c, v, _ in writes
                    ],
                    parent_config=(
                        {
                            "configurable": {
                                "thread_id": thread_id,
                                "checkpoint_ns": checkpoint_ns,
                                "checkpoint_id": parent_checkpoint_id,
                            }
                        }
                        if parent_checkpoint_id
                        else None
                    ),
                )
        else:
            if checkpoints := self.storage[thread_id][checkpoint_ns]:
                checkpoint_id = max(checkpoints.keys())
                checkpoint, metadata, parent_checkpoint_id = checkpoints[checkpoint_id]
                writes = self.writes[(thread_id, checkpoint_ns, checkpoint_id)].values()
                checkpoint_ = self.serde.loads_typed(checkpoint)
                return CheckpointTuple(
                    config={
                        "configurable": {
                            "thread_id": thread_id,
                            "checkpoint_ns": checkpoint_ns,
                            "checkpoint_id": checkpoint_id,
                        }
                    },
                    checkpoint={
                        **checkpoint_,
                        "channel_values": self._load_blobs(
                            thread_id, checkpoint_ns, checkpoint_["channel_versions"]
                        ),
                    },
                    metadata=self.serde.loads_typed(metadata),
                    pending_writes=[
                        (id, c, self.serde.loads_typed(v)) for id, c, v, _ in writes
                    ],
                    parent_config=(
                        {
                            "configurable": {
                                "thread_id": thread_id,
                                "checkpoint_ns": checkpoint_ns,
                                "checkpoint_id": parent_checkpoint_id,
                            }
                        }
                        if parent_checkpoint_id
                        else None
                    ),
                )

```

## 4. BaseCheckpointSaver 数据库实现