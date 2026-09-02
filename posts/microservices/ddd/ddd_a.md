1. Repository UpdateFn 统一事务处理
2. 跨服务接口：定义在 app，实现在 adapters
3. CQRS 真正的核心是读写分离

hertz 的读写分离在 service 层(不是 handler 层)

The user is asking a good question about CQRS: why make such an explicit distinction between Command and Query when normal interface design already has both query and mutation methods?

This is a conceptual question. The user is an intermediate Go/Python developer and they're questioning the value of CQRS's explicit separation. Let me think about this carefully.

The user's point is valid: in normal interface design, you already have methods like `GetUser()` (query) and `UpdateUser()` (command). Why make such a big deal about separating them into different handler types?

Let me think about what CQRS actually adds beyond just "having query and mutation methods":

1. **Different return types**: Command returns only `error`, Query returns `(R, error)`. This is a type-level constraint, not just naming convention.

2. **Different data sources**: In full CQRS (like go-food-delivery), Command writes to EventStoreDB, Query reads from MongoDB. They don't share storage at all. This is the real point - not just method naming, but physically separate read/write models.

3. **Different optimization paths**: Query can be cached, denormalized, use read models. Command needs transactions, validation, invariants.

4. **Cross-cutting concerns handled differently**: wild-workouts uses generic decorators - `ApplyCommandDecorators` vs `ApplyQueryDecorators`. They share the pattern but are type-separate.

5. **Scaling independently**: Read-heavy systems can scale read replicas separately from write.

But the key insight the user is missing is: **wild-workouts is "lightweight CQRS"** - it separates Command/Query at the handler level but still shares the same data store. The real value there is:

- Type safety: Command handler signature `Handle(ctx, C) error` vs Query handler `Handle(ctx, Q) (R, error)` - you can't accidentally return data from a Command or mutate state in a Query (enforced by types, not convention)
- Generic decorators: because all Commands share the same signature, you can write one `commandLoggingDecorator[C any]` that works for ALL commands. Without the uniform interface, you'd have to write logging for each method individually.

The user's question is essentially "what's the point?" - they see CQRS as just naming convention when it's actually about:

1. Type-level enforcement (not just convention)
2. Enabling generic cross-cutting concerns
3. Enabling separate read/write models (in full CQRS)

Let me answer this concisely and directly, since the user asked a focused conceptual question. I should reference the code they're looking at (006_CQRS基础.md).

I don't need to use new_context here - this is a focused conceptual question that depends on the context I already have about the CQRS chapter. The user just wants an explanation.

Let me give a focused answer. The key points:

1. **Type enforcement vs convention**: Normal interfaces mix `GetUser()` returning data and `UpdateUser()` returning error - it's convention that you don't mutate in Get. CQRS makes it a type constraint: CommandHandler interface ONLY returns error, QueryHandler ONLY returns (R, error). The compiler enforces it.

2. **Generic decorators**: This is the real payoff in wild-workouts. Because ALL commands share `Handle(ctx, C) error`, you write ONE `commandLoggingDecorator[C any]` and it wraps every command. Without uniform interface, each method has different signature, you can't generically wrap them.

3. **Full CQRS (go-food-delivery)**: Query reads from MongoDB (denormalized read model), Command writes to EventStoreDB. Physically different stores. Normal "interface with Get/Update" assumes one store.

Let me be concise and direct.
你问到了关键点。表面上 CQRS 就是把 Get/Set 拆开,但这层拆分的真正价值不在"命名",而在三件事:

## 3. 全 CQRS:读写物理分离(go-food-delivery)

wild-workouts 是"轻量级 CQRS",读写还共享 Firestore。但 go-food-delivery 是真的分库:

|          | Command              | Query               |
| -------- | -------------------- | ------------------- |
| 数据源   | EventStoreDB(事件流) | MongoDB(读模型投影) |
| 数据形态 | 规范化、强一致       | 反规范化、最终一致  |

普通接口 `GetOrder/UpdateOrder` 假设**同一个库**。一旦读写量级失衡(读 1000 QPS、写 10 QPS),你想给读加缓存、加从库、反规范化——所有这些优化都卡在"读写共用一个 Repository"上。CQRS 在接口层就切断了这个耦合,让读写各自优化互不干扰。
