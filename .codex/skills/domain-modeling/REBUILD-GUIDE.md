# Rebuild：从当前实现恢复领域模型

仅当用户要求从实现重建领域文档，或显式使用 `rebuild` 时读取本文件。Rebuild 只恢复 as-is，不把新需求或理想设计混入当前模型。

## 输入

```text
rebuild --service <service_name> [--domain <domain_name>] [--workflow <workflow_name>] [--dry-run]
```

`--service` 必填，并且必须映射到实际服务目录和 `docs/ddd/<service>/`。局部重建仍需扫描该服务所有入口，以发现关联调用和 Workflow，但不得删除、重编号或顺带重写未选中文档。

## 允许的输出

- `docs/ddd/<service>/CONTEXT.md`；
- 选中范围内的 Domain 文档；
- 确实存在的 Workflow 文档；
- 响应中的事实来源、能力矩阵、候选边界、冲突和未决项报告。

Rebuild 不创建或修改 `change.md`、ADR、spec 和 plan，不伪造历史决策理由。`--dry-run` 只报告拟变更，不修改文件。

## 事实与证据

交叉检查：

1. 数据库约束、事务、状态转换和持久化行为；
2. IDL/路由、命令、事件消费者、定时任务和管理入口；
3. application/domain service、仓储、外部客户端、消息和任务代码；
4. 测试、fixture 和运行配置；
5. 现有 DDD、ADR、spec 与 Harness 文档。

类型名、目录名、注释和旧文档只能作为线索。重要能力、规则和失败语义必须能定位到实现证据；无法证实的内容标为未确认，不写入正式模型。

## 执行过程

### 1. 建立架构映射

定位服务、IDL、migration、测试、Harness 和现有文档，建立：

```text
入口 -> application/workflow -> domain -> repository/adapter
```

缺少 Harness 不阻止分析，但要说明采用的代码分层依据。

### 2. 枚举能力

扫描 HTTP/RPC、公开方法、CLI、定时任务、事件/队列消费者、后台 worker、管理入口和 migration：

```text
入口 -> 用例 -> 写入事实/读模型 -> Context/Domain -> 聚合 -> Workflow -> 证据 -> 状态
```

状态使用 `covered`、`external-owner`、`deprecated-with-reason`、`missing`。

### 3. 恢复 Domain

沿每条写路径识别事实所有者、实体、值对象、关系、聚合、不变量、状态、命令校验、授权、唯一约束、并发控制、错误和领域事件；沿读路径识别独立查询与读模型。

数据库表不是 Domain，repository 目录不是聚合，纯 CRUD 不单独建立 Domain。

### 4. 恢复 Workflow

对每个写能力、后台任务和领域事件执行 Workflow 判定，明确参与者、每次本地事务、外部调用时机、状态所有者、幂等键、重试、超时、补偿、取消、晚到消息、身份和凭证。

### 5. 反向校验与命名

从表、事件、任务、测试和外部客户端反查遗漏入口；核对现有统一语言；使用业务名称，不直接照搬 handler、表或技术组件名。新增编号取同类目录下下一个可用值，已有编号不重排。

### 6. 先报告后写入

修改前报告扫描范围、识别结果、覆盖状态、文档冲突、未确认项和拟变更文件。涉及术语含义、Domain 归属、不可逆数据语义或安全边界的冲突，需要用户裁决；其他无冲突部分可以继续。

写入顺序为 `CONTEXT.md -> Workflow -> Domain`，更新时保留仍被实现证实的人工说明。找不到证据的旧文档只标为疑似失效并请求确认，不自动删除或加 `-del`。

## 完成门禁

- 全部入口已进入能力矩阵且没有 `missing`；
- 每个 Domain 可映射到能力、聚合/读模型和实现证据；
- 每个写能力、后台任务和领域事件已完成 Workflow 判定；
- Context、Domain、Workflow 和 Harness 可互相映射；
- 未确认推断没有写成事实；
- 未修改 change、ADR、spec 和 plan。

不满足时只能报告“部分完成”，并列出需要的证据或决策。
