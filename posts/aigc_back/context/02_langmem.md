---
weight: 1
title: "LangMem 源码解析"
date: 2025-08-20T09:00:00+08:00
lastmod: 2025-08-20T09:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "LangMem 源码解析"
featuredImage: 

tags: ["Context Engineering"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

上一节我们介绍了 Langgraph 的上下文工程，并介绍了 Langmem。从上一节我们了解到，Langmem 有如下核心对象:
1. `MemoryManager`
2. `ReflectionExecutor`
3. `NamespaceTemplate`

这一节我们来介绍他们的实现。

## 1. MemoryManager

```python

_MEMORY_INSTRUCTIONS = """You are a long-term memory manager maintaining a core store of semantic, procedural, and episodic memory. These memories power a life-long learning agent's core predictive model.

What should the agent learn from this interaction about the user, itself, or how it should act? Reflect on the input trajectory and current memories (if any).

1. **Extract & Contextualize**  
   - Identify essential facts, relationships, preferences, reasoning procedures, and context
   - Caveat uncertain or suppositional information with confidence levels (p(x)) and reasoning
   - Quote supporting information when necessary

2. **Compare & Update**  
   - Attend to novel information that deviates from existing memories and expectations.
   - Consolidate and compress redundant memories to maintain information-density; strengthen based on reliability and recency; maximize SNR by avoiding idle words.
   - Remove incorrect or redundant memories while maintaining internal consistency

3. **Synthesize & Reason**  
   - What can you conclude about the user, agent ("I"), or environment using deduction, induction, and abduction?
   - What patterns, relationships, and principles emerge about optimal responses?
   - What generalizations can you make?
   - Qualify conclusions with probabilistic confidence and justification

As the agent, record memory content exactly as you'd want to recall it when predicting how to act or respond. 
Prioritize retention of surprising (pattern deviation) and persistent (frequently reinforced) information, ensuring nothing worth remembering is forgotten and nothing false is remembered. Prefer dense, complete memories over overlapping ones."""



class MemoryManager(Runnable[MemoryState, list[ExtractedMemory]]):
    def __init__(
        self,
        model: str | BaseChatModel,
        *,
        schemas: typing.Sequence[typing.Union[BaseModel, type]] = (Memory,),
        instructions: str = _MEMORY_INSTRUCTIONS,
        enable_inserts: bool = True,
        enable_updates: bool = True,
        enable_deletes: bool = False,
    ):
        self.model = (
            model if isinstance(model, BaseChatModel) else init_chat_model(model)
        )
        self.schemas = schemas or (Memory,)
        self.instructions = instructions
        self.enable_inserts = enable_inserts
        self.enable_updates = enable_updates
        self.enable_deletes = enable_deletes


def invoke(
    self,
    input: MemoryState,
    config: typing.Optional[RunnableConfig] = None,
    **kwargs: typing.Any,
) -> list[ExtractedMemory]:
    # 从输入中取最大迭代步数（默认为 1）
    max_steps = input.get("max_steps")
    if max_steps is None:
        max_steps = 1

    # 取输入的消息和已有记忆
    messages = input["messages"]
    existing = input.get("existing")

    # 预处理输入消息和已有记忆，转为统一格式
    prepared_messages = self._prepare_messages(messages, max_steps)
    prepared_existing = self._prepare_existing(existing)

    # 记录外部传入的 memory id（和内部生成的区分开）
    external_ids = {mem_id for mem_id, _, _ in prepared_existing}

    # 构造一个 extractor：负责让模型从消息中抽取插入/更新/删除操作
    extractor = create_extractor(
        self.model,
        tools=list(self.schemas),
        enable_inserts=self.enable_inserts,
        enable_updates=self.enable_updates,
        enable_deletes=self.enable_deletes,
        existing_schema_policy=False,
    )

    # 初始 payload：包括消息和现有记忆
    payload = {"messages": prepared_messages, "existing": prepared_existing}

    # 用字典记录最终结果（id -> 记忆对象）
    results: dict[str, BaseModel] = {}

    # 主循环：最多跑 max_steps 步
    for i in range(max_steps):
        # 从第二步开始，允许 extractor 使用 Done 工具，显式表示完成
        if i == 1:
            extractor = create_extractor(
                self.model,
                tools=list(self.schemas) + [Done],
                enable_inserts=self.enable_inserts,
                enable_updates=self.enable_updates,
                enable_deletes=self.enable_deletes,
                existing_schema_policy=False,
            )

        # 调用 extractor，得到本轮抽取结果
        response = extractor.invoke(payload, config=config)

        # 本轮结果解析
        is_done = False
        step_results: dict[str, BaseModel] = {}
        for r, rmeta in zip(response["responses"], response["response_metadata"]):
            # 如果模型调用了 Done，标记结束
            if hasattr(r, "__repr_name__") and r.__repr_name__() == "Done":
                is_done = True
                continue
            # 如果是删除操作，用已有 id，否则生成/复用一个 id
            mem_id = (
                r.json_doc_id
                if (
                    hasattr(r, "__repr_name__") and r.__repr_name__() == "RemoveDoc"
                )
                else rmeta.get("json_doc_id", str(uuid.uuid4()))
            )
            # 本轮的结果加入 step_results
            step_results[mem_id] = r

        # 更新总结果
        results.update(step_results)

        # 确保外部传入的记忆（未更新/未删除）能保留下来
        for mem_id, _, mem in prepared_existing:
            if mem_id not in results:
                results[mem_id] = mem

        # 取最后一条 AI 消息，检查是否继续迭代
        ai_msg = response["messages"][-1]
        if is_done or not ai_msg.tool_calls:
            break  # 完成 or 没有工具调用 -> 退出循环

        # 如果还有下一步：把本轮结果作为反馈追加到消息中
        if i < max_steps - 1:
            # 标注每个操作是 updated/inserted/deleted
            actions = [
                (
                    "updated"
                    if rmeta.get("json_doc_id")
                    else (
                        "deleted"
                        if (
                            hasattr(r, "__repr_name__")
                            and r.__repr_name__() == "RemoveDoc"
                        )
                        else "inserted"
                    )
                )
                for r, rmeta in zip(
                    response["responses"], response["response_metadata"]
                )
            ]

            # 拼接新的对话消息：
            # - AI 最新回复
            # - tool role 消息，告诉模型“某条记忆已被插入/更新/删除”
            prepared_messages = (
                prepared_messages
                + [response["messages"][-1]]
                + [
                    {
                        "role": "tool",
                        "content": f"Memory {rid} {action}.",
                        "tool_call_id": tc["id"],
                    }
                    for tc, ((rid, _), action) in zip(
                        ai_msg.tool_calls, zip(list(step_results.items()), actions)
                    )
                ]
            )

            # 更新 payload：新的消息 + 过滤后的记忆（排除被删除的）
            payload = {
                "messages": prepared_messages,
                "existing": self._filter_response(
                    list(results.items()), external_ids, exclude_removals=True
                ),
            }

    # 返回最终结果（不过滤删除项）
    return self._filter_response(
        list(results.items()), external_ids, exclude_removals=False
    )

```
