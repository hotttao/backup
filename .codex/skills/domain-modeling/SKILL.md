---
name: domain-modeling
description: 发现、搭建、保存和审查项目领域模型。适用于事件风暴后的知识提炼、统一语言、限界上下文、领域对象、聚合、业务规则、领域事件和工作流建模，以及从代码重建或核对领域文档；不用于只读取术语或只做数据库设计。
---

# 领域建模

将零散业务知识转化为业务人员可验证、程序员可实现、可持续维护的领域文档。必须区分原始输入、当前模型、目标设计、变更历史和决策理由。

## 参考文件路由

- 新建或完善模型：读 [MODELING-GUIDE.md](MODELING-GUIDE.md)，再读本次需要写入的格式文件。
- 保存头脑风暴或事件风暴：读 [DISCOVERY-FORMAT.md](DISCOVERY-FORMAT.md)。
- Context Map：读 [CONTEXT-MAP-FORMAT.md](CONTEXT-MAP-FORMAT.md)。
- 统一语言：读 [CONTEXT-FORMAT.md](CONTEXT-FORMAT.md)。
- Domain：读 [DOMAIN-FORMAT.md](DOMAIN-FORMAT.md)。
- Domain 包含多个对象或关系：同时读 [UML-CLASS-DIAGRAM-GUIDE.md](UML-CLASS-DIAGRAM-GUIDE.md)。
- 跨边界流程：读 [WORKFLOW-FORMAT.md](WORKFLOW-FORMAT.md)。
- 决策和变更：读 [ADR-FORMAT.md](ADR-FORMAT.md)、[CHANGE-FORMAT.md](CHANGE-FORMAT.md)。
- `review`：读 [REVIEW-GUIDE.md](REVIEW-GUIDE.md)。
- `rebuild`：读 [REBUILD-GUIDE.md](REBUILD-GUIDE.md)。

不要读取或创建与当前任务无关的文档。

## 工作模式

| 模式 | 事实基线 | 结果 |
|:---|:---|:---|
| Discovery | 访谈、事件风暴、需求和场景 | 原始输入、假设、冲突、开放问题 |
| Target Design | 已确认的目标业务规则 | 目标 Context、Domain、Workflow、ADR |
| Incremental Update | 现有模型与已确认变化 | 更新模型并记录语义变化 |
| Rebuild | 当前实现的可观察行为 | 恢复 as-is，不推断理想设计 |
| Review | 文档与当前实现 | 差异报告，不擅自修改任一方 |

开始时确定范围、as-is/to-be、权威事实来源和预期产物。模式不能混写；代码证明当前行为，不自动成为目标设计。

## 建模对象与知识归属

| 对象 | 回答的问题 | 保存位置 |
|:---|:---|:---|
| Discovery | 讨论得到哪些输入，哪些仍未确认 | `docs/ddd/discovery/` |
| 限界上下文 | 哪套语言、模型和事实在何处有效 | `CONTEXT-MAP.md`、`<context>/CONTEXT.md` |
| Domain | 哪组能力和规则因同一业务原因变化 | `<context>/domain/<nnnn-domain>/` |
| 聚合 | 哪些对象和不变量必须原子一致 | Domain 的聚合与不变量 |
| 实体/值对象/关系 | 什么有身份、什么由值定义、对象如何关联 | Domain 的概念模型 |
| 规则/状态机 | 什么必须成立、生命周期如何变化 | Domain 的规则与状态 |
| Domain Event | 聚合已经发生什么 | Domain 的领域事件 |
| 读模型 | 用户和命令决策需要读取什么 | Domain 的查询与读模型 |
| Workflow | 如何跨聚合、事务、服务或外部系统协作 | service/global workflow |
| ADR | 为什么作出难回退的重要决策 | `docs/ddd/adr/` |

数据库表是持久化设计，不是 Domain 或聚合的起点。微服务、目录、模块和限界上下文也不天然一一对应。

## 核心流程

1. 读取已有 Context Map、CONTEXT、Domain、Workflow、ADR、需求、代码和 Harness 规范，明确范围与事实来源。
2. 收集业务事件、命令、执行者、查询、候选名词、规则、异常场景、外部系统、证据和开放问题。
3. 统一同义词，拆分同名异义词，确定中英文标准名、禁用替代词和所属上下文。
4. 将候选名词分类为实体、值对象、属性、角色、类别、关联实体、操作、读模型或 Workflow；使用 UML 类图表达对象、关键属性、业务操作，以及带角色和双端多重性的关系。
5. 沿命令识别业务操作、规则、状态变化和事件，再根据必须原子维护的不变量确定聚合。
6. 根据语言、规则、事实所有权和变化原因划分模块及限界上下文，建立 Context Map。
7. 对每个写能力、后台任务和领域事件执行 Workflow 判定。
8. 用正常、零个/多个、重复、并发、越权、取消、超时、部分成功和晚到结果走查模型。
9. 将已确认知识写入权威文档，将假设、冲突和开放问题留在 Discovery 或响应中。

信息状态使用 `confirmed`、`assumption`、`conflict`、`open`。正式领域文档只写 `confirmed` 或明确采纳的目标设计。

## 关键约束

### 业务规则

每条重要规则使用稳定编号，并记录场景/条件、规则正文、所有者、执行时机、违反结果和证据。图上的约束必须同步进入规则表；不能只靠 UML 或口头描述保存业务语义。

### UML 类图

Domain 存在两个或以上核心对象、任意对象关联、关联实体、自关联或多角色关系时，必须绘制 UML 类图。类图只表达领域对象、必要的关键属性、业务操作、关联语义、两端角色、多重性和规则编号；不得退化为数据库 ER 图或 Controller/Repository/DTO 技术结构图。

复杂模型先用包图展示模块依赖，再按模块拆分类图。类图后解释容易误读的关系，并保证对象名称与 CONTEXT、规则表一致。

### 聚合

同一聚合的依据是原子不变量、只能经聚合根修改或生命周期依附。外键、同页展示、一次返回和方便联表都不是依据。跨聚合只引用 ID；跨服务不建立数据库外键；优先小聚合。

### Workflow

跨两个或以上聚合/Domain、多个事务或服务、外部副作用，或者涉及异步、幂等、重试、超时、补偿和恢复时，通常创建 Workflow。单聚合状态机、普通 CRUD、纯查询和 DTO 转换不创建。

Workflow 必须写明参与者、命令/事件、每次本地事务、外部调用时机、状态所有者、幂等键、失败分类、重试、补偿、取消、晚到消息以及身份和凭证传递。Workflow 只协调，不拥有业务事实表。

### ADR 和 change

ADR 仅用于同时满足“难回退、脱离上下文难理解、存在真实方案取舍”的决策。首次建模不创建 change；已有 Domain 或 Workflow 的接口、规则、状态、事件、一致性或失败语义发生变化时才记录。

## 保存顺序

随着结论确认实时更新，不积压到最后：

```text
Discovery（可选）
  -> CONTEXT-MAP / CONTEXT
  -> ADR（仅合格决策）
  -> Domain 与 Workflow（相互迭代校验）
  -> change（已有模型发生语义变化时）
  -> spec
  -> plan
```

Domain 拥有业务事实和状态转换，Workflow 负责协调。Workflow 发现新的领域能力时必须回写 Domain。

## 文档目录

```text
docs/
├── ddd/
│   ├── CONTEXT-MAP.md
│   ├── discovery/<yyyy-mm-dd>-<topic>.md
│   ├── adr/0001-<decision>.md
│   ├── workflow/0001-<workflow>/<workflow>.md
│   └── <service-or-context>/
│       ├── CONTEXT.md
│       ├── domain/0001-<domain>/<domain>.md
│       └── workflow/0001-<workflow>/<workflow>.md
├── spec/
├── plan/
└── review/
```

文件懒创建。编号只在各自目录内递增；已有编号不重排。当前模型文档不写讨论流水账、备选方案和历史原因。图表达结构，表表达规则和契约，文字解释边界与易误解语义。

## 完成门禁

- 术语唯一且归属明确；
- 输入有正式归属、明确排除或待确认状态；
- 实体身份、值对象相等性、关系角色和多重性完整；
- 需要 UML 类图的 Domain 已画图，且能用真实命令走查；
- 规则有编号、所有者、执行时机和违反结果；
- 聚合根和原子不变量明确；
- 生命周期和并发语义明确；
- 每个写能力和领域事件完成 Workflow 判定；
- Context、Domain、Workflow、Context Map 和 Harness 相互一致；
- 未确认推断没有进入正式领域文档；
- 重构或迁移的能力覆盖矩阵没有 `missing`。

不满足时只能报告部分完成，并说明需要的证据或用户决策。

