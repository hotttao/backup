# Review：设计与实现一致性审查

仅当用户要求检查代码是否符合领域文档，或显式使用 `review` 时读取本文件。

## 输入

```text
review --domain <domain_name>
review --workflow <workflow_name>
```

两者都未指定时，审查作用域内全部 Domain 和 Workflow；无法确定服务或仓库范围时先解析目录，仍有歧义再询问。

## 输出

在 `docs/review/` 下保持 `docs/ddd/<service>/` 的相对层级，按 Domain/Workflow 分别生成审查文档。Review 是审查产物，不迁入 `docs/ddd/`，不得借审查擅自改写目标设计。

每个问题必须包含：严重度、文档声明、实现行为、证据路径、影响和建议。区分：

- implementation-missing：设计存在，实现缺失；
- undocumented-behavior：实现存在，设计未记录；
- semantic-conflict：两者语义冲突；
- unverifiable：事实来源不足；
- stale-document：文档疑似过期。

## 执行过程

1. 读取 Context Map、词汇表、Domain、Workflow、ADR、Harness 规范和相关 change；
2. 按依赖顺序审查，先审查被依赖方；
3. 从 HTTP/RPC、公开方法、CLI、定时任务、事件消费者和管理入口建立能力覆盖矩阵；
4. 沿写路径检查聚合、不变量、状态转换、事务、持久化、事件和错误语义；
5. 沿读路径检查读模型、过滤、权限和一致性预期；
6. 检查 Workflow 的参与者、事务边界、外部副作用、幂等、重试、补偿、取消、晚到消息和身份传递；
7. 从表、索引、事件、任务和外部客户端反查遗漏能力；
8. 输出问题和能力覆盖矩阵，不把推测写成缺陷。

能力状态只能是 `covered`、`external-owner`、`deprecated-with-reason`、`missing`。存在 `missing` 时不得宣称审查通过。
