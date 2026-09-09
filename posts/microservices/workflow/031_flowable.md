# Flowable 深入调研：BPMN、人工任务与数据库任务队列

调研日期：2026-09-09。调研问题见 [question.md](./question.md)。本文以 Flowable OSS 8.0.0 为版本基线，讨论 BPMN/CMMN/DMN 引擎和 REST API；旧版 6.x 曾经附带的 Modeler、Task、Admin、IDM UI，不作为当前 OSS 8.x 的能力。

## 1. 结论先行

Flowable 是一个以 **BPMN 2.0 业务流程、CMMN 1.1 动态案件和 DMN 决策表** 为核心的 Java 工作流/BPM 平台。与 Airflow 的数据批次 DAG、Temporal 的代码式持久执行、Conductor 的 JSON 任务编排相比，Flowable 最突出的价值是：用标准流程模型表达用户任务、候选人/候选组、认领、转办、会签、超时升级、业务错误和补偿。

它最适合：

- 审批、工单、开户、合同、理赔等以人工任务为主的业务流程；
- 机器步骤和人工审核交替，流程可能等待数小时或数天；
- 业务人员需要阅读 BPMN 图，研发人员希望以 BPMN XML 版本化流程；
- Java/Spring Boot 系统希望嵌入流程引擎，或通过 REST 把引擎作为独立服务；
- Go/Python 服务希望以 External Worker 的方式拉取并完成任务；
- 需要 BPMN、CMMN 和 DMN 配合，而不是只编排一条固定 DAG。

项目基本情况：

| 维度 | 结论 |
|---|---|
| 项目类型 | BPMN/CMMN/DMN 工作流与 BPM 引擎 |
| 开源协议 | Apache-2.0 |
| CNCF | 不是 CNCF 托管项目 |
| 主要实现 | Java，深度集成 Spring/Spring Boot |
| 当前版本基线 | Flowable 8.0.0，2026-02-27 发布；基于 Spring Framework 7、Spring Boot 4，默认 Jackson 3 |
| 受欢迎程度 | 调研时 GitHub 主仓库约 9.3k Star、2.8k Fork |
| 当前项目匹配度 | 若重点学习人工审批、工单和 BPMN，匹配度高；若只解决 Agent 的可靠执行，Temporal 更直接 |

Flowable 不是开箱即用的“低代码审批产品”。当前 OSS 的重点是引擎与 API。要投入生产，通常还要提供身份集成、任务列表、表单页面、权限模型和流程发布治理。

## 2. 最适合的示例：带人工会审的内容发布流程

下面的流程比纯定时 ETL 更能体现 Flowable：

```text
运营提交选题
   -> Go/Python Agent 生成文案和素材
   -> 机器质量检查
   -> 编辑审核（候选组 editorial，可认领/退回）
      ├─ 超过 24 小时 -> 提醒并升级给主编
      ├─ 退回修改 -> Agent 根据意见重新生成 -> 再次审核
      └─ 通过 -> 风险会签（法务、品牌，可并行）
                    ├─ 满足通过条件 -> 发布
                    └─ 任一否决 -> 终止并记录原因
   -> 等待平台发布回执
   -> 结束
```

这条流程包含 Flowable 的主要抽象：

| 抽象 | 含义 | 示例 |
|---|---|---|
| Deployment | 一次流程资源部署 | 发布一组 BPMN/DMN/XML 资源 |
| Process Definition | 带 key 和 version 的流程定义 | `mediaContentApproval:4` |
| Process Instance | 定义的一次业务运行 | 一条候选内容的审批实例 |
| Execution | 沿 Sequence Flow 移动的执行令牌 | 并行会签时产生多条执行路径 |
| Activity | BPMN 流程节点 | User Task、Service Task、Gateway |
| User Task | 需要人处理的持久等待点 | 编辑审核、法务会签 |
| Task | 某个可被查询、认领和完成的待办实例 | 内容 785 的编辑审核待办 |
| Variable | 流程/局部作用域的数据 | `contentId`、`riskScore`、`decision` |
| Job | 定时器、异步延续等后台工作 | 24 小时 SLA 定时器、异步发布 |
| External Worker Job | 由外部进程获取的工作 | Python 生成视频、Go 发布平台 |
| Event Subscription | 等待消息、信号等事件的订阅 | 等待第三方发布回执 |
| Historic Data | 已发生的实例、任务和变量记录 | 审批轨迹和审计查询 |

### 2.1 为什么 User Task 是“人工参与”，Manual Task 不是

`User Task` 到达后会在数据库中创建 Task。它可以有 assignee、owner、candidate users/groups、due date、priority 和 form key；应用通过 `TaskService` 或 REST 查询、认领、委派、完成任务。流程在任务完成前保持等待。

`Manual Task` 在 BPMN 中表示引擎无需跟踪的线下动作。Flowable 对它采用直通语义，到达后立即继续。因此，“电话联系客户并等待结果”如果需要系统真正等待，应建模为 User Task 或 Receive Task，而不是 Manual Task。

### 2.2 一个最小 BPMN XML

Flowable 的可部署流程定义是 BPMN 2.0 XML。下面省略图形坐标，只保留执行语义：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:flowable="http://flowable.org/bpmn"
             targetNamespace="media-agent">
  <process id="mediaContentApproval" name="内容生产与审核" isExecutable="true">
    <startEvent id="start" />

    <serviceTask id="generate"
                 name="Agent 生成内容"
                 flowable:type="external-worker"
                 flowable:topic="generate-content" />

    <userTask id="editorReview"
              name="编辑审核"
              flowable:candidateGroups="editorial"
              flowable:dueDate="${reviewDueDate}" />

    <boundaryEvent id="reviewTimeout" attachedToRef="editorReview" cancelActivity="false">
      <timerEventDefinition>
        <timeDuration>PT24H</timeDuration>
      </timerEventDefinition>
    </boundaryEvent>

    <exclusiveGateway id="decision" default="reviseFlow" />

    <serviceTask id="publish"
                 name="发布内容"
                 flowable:type="external-worker"
                 flowable:topic="publish-content" />
    <endEvent id="published" />

    <serviceTask id="revise"
                 name="根据意见重新生成"
                 flowable:type="external-worker"
                 flowable:topic="revise-content" />

    <serviceTask id="notifyChiefEditor"
                 name="通知主编"
                 flowable:delegateExpression="${notifyChiefEditor}" />

    <sequenceFlow id="f1" sourceRef="start" targetRef="generate" />
    <sequenceFlow id="f2" sourceRef="generate" targetRef="editorReview" />
    <sequenceFlow id="f3" sourceRef="editorReview" targetRef="decision" />
    <sequenceFlow id="approvedFlow" sourceRef="decision" targetRef="publish">
      <conditionExpression xsi:type="tFormalExpression"><![CDATA[${decision == 'approved'}]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="reviseFlow" sourceRef="decision" targetRef="revise" />
    <sequenceFlow id="f4" sourceRef="revise" targetRef="editorReview" />
    <sequenceFlow id="f5" sourceRef="publish" targetRef="published" />
    <sequenceFlow id="timeoutFlow" sourceRef="reviewTimeout" targetRef="notifyChiefEditor" />
  </process>
</definitions>
```

示例中的 External Worker Task 本身也是持久等待点。Worker 按 topic 获取任务并加租约，完成后流程才继续，非常适合当前 `media_agent` 的 Go/Python 服务。

## 3. 三节点集群架构

推荐把三个 Flowable 节点部署为相同版本、相同流程代码和相同配置的无状态 Spring Boot 服务：

```text
                         ┌──────────────┐
用户/业务系统 ──────────>│ Load Balancer│
                         └──────┬───────┘
                 ┌──────────────┼──────────────┐
                 v              v              v
          ┌────────────┐ ┌────────────┐ ┌────────────┐
          │ Flowable 1 │ │ Flowable 2 │ │ Flowable 3 │
          │ REST/Engine│ │ REST/Engine│ │ REST/Engine│
          │ Async Exec │ │ Async Exec │ │ Async Exec │
          └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
                └───────────────┼───────────────┘
                                v
                   ┌────────────────────────┐
                   │ HA relational database │
                   │ definition/runtime/job │
                   │ task/variable/history  │
                   └───────────┬────────────┘
                               │
              ┌────────────────┴────────────────┐
              v                                 v
    Go/Python External Workers          Identity/Task Portal
    generate / publish topics           LDAP/OIDC + custom UI

    Optional: Event Registry -> Kafka / RabbitMQ / JMS / HTTP
```

每个节点可以处理 REST 请求、推进同步流程，也可以启用 Async Executor 获取后台 Job。所有节点共享同一个逻辑数据库，数据库是流程状态、任务队列和集群协调的权威来源。节点本地不需要保存 Process Instance 的内存副本。

三个节点必须做到：

- 使用相同 Flowable 版本和数据库 schema；
- 使用相同的 BPMN Delegate/表达式 Bean 代码，避免任务落到不同节点后行为不同；
- 为 Job Executor 配置不同的节点/锁 owner 标识；
- 统一时区、时钟同步和定时器配置；
- 数据库本身做高可用、备份和连接池容量规划；
- 部署、迁移流程定义时走统一发布流程，避免节点各自启动时无序部署。

### 3.1 请求究竟在哪个节点执行

启动流程、完成 User Task 或发送消息的 API 请求，会在接收请求的节点同步推进流程，直到所有当前执行路径都到达 wait state 或流程结束。到达 User Task、Receive Task、Timer、External Worker Task 或显式异步边界时，状态提交到共享数据库。之后可以由任意节点或外部 Worker 继续。

这意味着负载均衡器不需要会话粘滞。真正需要保证的是共享数据库、相同流程实现和幂等外部操作。

## 4. 执行语义：事务一直推进到等待点

理解 Flowable 的核心不是“每个节点都是队列任务”，而是 **命令上下文中的同步推进 + wait state 持久化 + 异步 Job**。

例如，完成 `editorReview` 后：

1. `TaskService.complete()` 开启数据库事务；
2. 删除/结束当前运行时 Task，记录变量 `decision`；
3. 经过网关选择路径；
4. 如果下一步是普通同步 Java Service Task，当前线程直接执行它；
5. 继续前进，直到新的 User Task、Receive Task、Timer、External Worker Task、异步边界或结束；
6. 一次提交该事务中的流程状态变化。

如果同步 Service Task 抛出未处理异常，事务回滚。调用前的等待状态仍然存在；本次 `complete()` 失败，并不会自动变成三次异步重试。需要自动重试的技术步骤应建模成 `flowable:async="true"` 的 Service Task、External Worker Task，或由调用方显式安全重试。

### 4.1 业务错误和技术异常要分开

- **BPMN Error** 表达已知业务结果，例如“内容侵权风险过高”，由 Boundary Error Event 或 Event Subprocess 捕获并走明确分支。
- **Java Exception/技术失败** 表达数据库不可用、网络超时等执行问题。同步时回滚事务；异步时进入 Job 重试。
- **补偿** 表达已经产生外部效果后的业务撤销，例如删除已创建的草稿或释放资源。数据库回滚不能撤销第三方平台动作。

任何远程调用都可能出现“远端成功，本地提交失败”。External Worker、HTTP Task 和 Java Delegate 都应使用业务幂等键，如 `processInstanceId + activityId + attempt/businessVersion`，并在必要时使用 outbox、状态查询或补偿。

## 5. 工作流状态如何持久化

Flowable 使用关系数据库表保存定义、运行态、任务、变量、Job 和历史。表名前缀通常为 `ACT_`：

| 表类别 | 用途 | 常见内容 |
|---|---|---|
| `ACT_RE_*` | Repository | Deployment、Process Definition、BPMN 资源 |
| `ACT_RU_*` | Runtime | Execution、User Task、Variable、Job、Event Subscription |
| `ACT_HI_*` | History | 已启动/结束的实例、活动、任务、变量更新 |
| `ACT_GE_*` | General | 通用属性和二进制资源 |

运行中的 Process Instance 不是一份整体 JSON 快照。引擎把 Execution 树、变量、Task、Job、事件订阅等规范化地存到多张表。实例结束后，运行态记录会被删除；是否保留以及保留多少历史取决于 history level。

常用历史级别包括：

- `none`：不保存历史；
- `activity`：保存实例和活动；
- `audit`：默认常用级别，进一步保存任务、当前变量和表单属性；
- `full`：保留更细的变量更新等详情，数据量最大。

不要把视频、图片、长文本和大模型完整上下文直接堆进流程变量。推荐把大对象存入 S3/MinIO/数据库业务表，流程变量只保存 URI、业务 ID、摘要、版本和校验值。

### 5.1 乐观锁和并发

当两个请求同时修改同一个流程实例，Flowable 通过数据库版本字段和乐观锁检测冲突，可能抛出 `FlowableOptimisticLockingException`。调用端应判断操作是否可安全重试。对并行异步任务可使用 exclusive job，避免同一流程实例的多个 Job 同时推进产生冲突；这会降低单实例内部并发，需要按流程选择。

## 6. Queue 基于什么实现

Flowable 核心 Job Queue **基于关系数据库表实现**，不要求 Redis、Kafka、RabbitMQ 或 ZooKeeper。

主要运行态队列可以理解为：

| 状态/表 | 含义 |
|---|---|
| Timer Job | 未到期的定时器，带 due date |
| Executable Job | 已可执行的异步工作 |
| Dead Letter Job | 重试耗尽，停止自动执行 |
| Suspended Job | 因定义/实例挂起而暂停 |
| External Worker Job | 等待外部 Worker 按 topic 获取 |

Async Executor 的获取线程查询可运行且未锁定的 Job，通过数据库更新写入 lock owner 和 lock expiration time，成功抢占后交给节点本地线程池。节点内还有一个有界内存队列，但它只是执行缓冲层，不是持久化真相。如果本地队列已满，Job 会被解锁/退回，以便以后重新获取。

因此 Queue 分成两层：

```text
关系数据库 Job 表（持久、集群共享、可恢复）
        -> 节点 acquisition thread 抢锁
        -> 节点本地 executor queue（短暂内存缓冲）
        -> worker thread 执行
```

Event Registry 可以连接 Kafka、RabbitMQ、JMS 或 HTTP，用于收发业务事件。它们不是核心异步 Job Queue 的必选依赖，也不替代数据库里的流程状态。

## 7. Distributed Lock 是否只支持 Redis 或 ZooKeeper

Flowable 的普通流程推进和 Job 获取都不以 Redis/ZooKeeper 为前提。三节点共享关系数据库，通过行更新、乐观锁、lock owner 和 lock expiration 等机制协调任务归属。

一个 Job 被节点 1 获取后会带租约。若节点 1 宕机，没有清理锁，租约到期后清理/重置线程会让它重新可获取，节点 2 或 3 可以继续执行。官方高级文档给出的典型默认值是 Job lock 约 5 分钟、过期锁重置扫描约 60 秒；实际值应以部署配置为准。这也意味着恢复不是瞬时的，最坏延迟受锁时长与扫描周期影响。

对核心调度来说，更准确的问题不是“支持哪一种外部分布式锁”，而是：

- 共享数据库能否承受获取 Job 的查询和更新；
- 锁租约是否覆盖正常任务耗时；
- 节点 GC 暂停、网络分区或任务超时后会不会重复执行；
- 业务副作用是否幂等；
- 数据库故障转移时连接和事务行为是否正确。

Redis、ZooKeeper 或 Consul 可以用于应用的其他协调需求，但不是 Flowable 三节点 Job Executor 的标准必需组件。

## 8. 异常恢复和重试

### 8.1 节点重启

流程在 wait state 时，所需状态已经提交数据库。三个 Flowable 节点全部重启后，只要数据库和流程实现可用：

- User Task 仍能查询和完成；
- Timer Job 根据 due date 重新进入执行；
- 未锁 Job 可以被重新获取；
- 锁在已宕机节点名下的 Job 等租约到期后重新获取；
- External Worker Job 未完成时仍可在锁过期后被 Worker 再次获取；
- Receive Task/消息订阅继续等待相关事件。

如果进程在远程调用后、数据库提交前宕机，任务可能再次执行。这是典型的至少一次效果，必须靠幂等实现处理。

### 8.2 异步 Job 重试

异步 Job 默认常见重试次数为 3。执行失败后可转成带下一次到期时间的 Timer Job；重试耗尽后进入 Dead Letter Job，不再自动执行，需要运维人员修复根因后重新移动/激活。可以用 `flowable:failedJobRetryTimeCycle` 为任务配置重试节奏，例如等待 10 秒重试 3 次。

重试范围取决于事务边界。把很长的一串同步 Service Task 放在同一事务中，末尾失败会回滚整段。对有远程副作用或耗时较长的步骤，应在模型中加入异步边界，把失败和重试隔离到合理粒度。

### 8.3 External Worker 失败

External Worker 获取任务时提供 topic、锁时长、最大数量和 worker ID：

```java
List<AcquiredExternalWorkerJob> jobs = managementService
    .createExternalWorkerJobAcquireBuilder()
    .topic("generate-content", Duration.ofMinutes(30))
    .acquireAndLock(5, "python-worker-01");
```

只有持有该锁的 Worker 能完成任务。技术失败时，Worker 可以上报错误、剩余重试次数和 retry timeout：

```java
managementService
    .createExternalWorkerJobFailureBuilder(jobId, "python-worker-01")
    .errorMessage("LLM provider timeout")
    .retries(4)
    .retryTimeout(Duration.ofMinutes(10))
    .fail();
```

已知业务结果可以完成为 BPMN Error，让流程走模型里的业务分支。技术失败重试耗尽则进入 Dead Letter。锁时长要覆盖任务的最大正常耗时；若任务可能更长，应拆分任务或实现可靠的锁延期/重新获取策略，并始终保证幂等。

## 9. 人工任务能力

### 9.1 分配、候选与认领

- `assignee`：任务直接分配给某个用户；
- `candidateUsers`：一组候选用户都能看到，某人 claim 后成为 assignee；
- `candidateGroups`：编辑、法务等候选组；
- `owner`：委派场景中的原负责人；
- claim/unclaim：认领或释放待办；
- delegate/resolve：委派给他人并在完成后回到 owner；
- due date/priority/category：用于任务排序、SLA 和门户展示。

Flowable 引擎不会替业务应用验证 BPMN 中写的用户 ID 是否真实存在。这样便于集成 LDAP、Active Directory、OIDC 或企业权限中心，但也意味着身份映射、租户隔离和授权校验需要认真设计。

### 9.2 会签

User Task 可以配置 multi-instance：

- parallel：同时为多个审核人创建任务；
- sequential：逐个处理；
- collection/elementVariable：审核人集合及当前成员；
- completionCondition：决定何时提前结束，例如全员通过、三人中两人通过、任一否决立即结束。

会签结果不应只依赖一个被多人覆盖的流程变量。推荐把每个意见写入业务审计表，或使用局部变量/变量聚合器，再在 completion condition 中根据结构化结果判断。

### 9.3 超时、提醒和升级

在 User Task 上挂非中断 Boundary Timer，可以在不取消原任务的情况下提醒；挂中断 Boundary Timer，可以在超时后取消原任务并转给主管。Timer 依赖 Async Executor 执行。还可以使用循环 Timer 实现重复提醒，但要控制通知幂等和频率。

### 9.4 表单与任务门户

BPMN User Task 可以带 `formKey`，引擎能保存任务元数据和表单属性，但当前 OSS 8.x 不等于附送完整可用的审批门户。实际项目通常需要：

1. 用 `TaskService`/REST 查询当前用户和候选组的任务；
2. 自己实现认领、打开表单、校验、完成、退回和审批记录页面；
3. 用 form key 映射前端表单 schema 或业务页面路由；
4. 把业务数据权限与“能否完成这个 Task”同时校验；
5. 把附件和长表单数据保存在业务存储，只向 Flowable 写关键变量。

## 10. 定时任务和自动恢复

Flowable 支持：

- Timer Start Event：按时间启动流程；
- Intermediate Catching Timer Event：流程中等待到某个时间；
- Boundary Timer Event：任务 SLA、提醒、升级；
- `timeDate`：某个绝对时间；
- `timeDuration`：等待一段时间；
- `timeCycle`：重复执行，可使用 ISO-8601 重复表达式，也支持 cron 形式。

Timer 会持久化为数据库 Job。引擎重启不会丢失它；到期后由任一 Async Executor 节点获取并执行。停机期间已经到期的 Timer，在恢复后会成为可执行 Job，但具体追赶速度受到 Worker 数量、获取批次、本地队列和数据库吞吐影响。

Timer Start Event 通常随流程定义部署而创建。部署同 key 的新版本后，新启动一般使用新版本，旧实例仍按旧定义运行。对“每天 1 点生成内容”这类简单调度 Flowable 能完成；如果核心诉求是上千数据 DAG 的补数、数据区间、分区依赖和批量回填，Airflow 的调度抽象更合适。

## 11. UI 与工作流定义方式

### 11.1 当前 OSS UI 边界

Flowable 6.x 的资料经常展示 Modeler、Task、Admin 和 IDM 应用。Flowable 7.0 官方发布说明明确：7 系列聚焦 BPMN、CMMN、DMN、Event Registry 引擎与 REST API，不包含 UI applications；Flowable 8.0 延续新的引擎技术栈。因而评估当前 OSS 时，不应把旧版 UI 当成开箱即用能力。

官方提供可免费使用的 Flowable Cloud Design 来建模，也有商业 Flowable Platform。它们的托管方式、许可证和功能边界与 `flowable-engine` OSS 仓库不同。采用 OSS 可以使用支持 BPMN 2.0 的外部建模器，或自行建设建模发布和任务门户。

### 11.2 YAML、JSON 和 XML

| 格式 | 能否作为核心流程定义 | 说明 |
|---|---|---|
| BPMN 2.0 XML | 是 | BPMN 流程的标准部署格式，适合 Git 版本控制和模型器互通 |
| CMMN XML | 是 | 动态 Case 定义 |
| DMN XML | 是 | 决策表/决策模型 |
| JSON | 否（对 BPMN） | REST 请求和响应可用 JSON；Event Registry 的事件/通道定义可用 JSON，但不等于 BPMN JSON DSL |
| YAML | 否 | 当前 OSS 没有官方 YAML 工作流 DSL |

如果团队希望像 Conductor 一样让平台通过 JSON 直接创建/修改工作流，Flowable 会多一层 BPMN XML 生成和校验。如果希望模型符合 BPMN 标准、能表达复杂人工协作，XML 是合理代价。

## 12. Worker 节点和任务类型

Flowable 没有把所有执行者统一叫 Worker。执行位置取决于任务类型：

| 类型 | 谁执行 | 适用场景 |
|---|---|---|
| Java Service Task | 处理 API 的 Flowable 节点或 Async Executor 线程 | 同 JVM 业务逻辑、短事务逻辑 |
| Delegate Expression/Spring Bean | Flowable 节点 | 与 Spring 服务集成 |
| External Worker Task | Go/Python/Java/TS/.NET 等外部进程 | 异构微服务、LLM、媒体处理、独立扩缩容 |
| HTTP Task | Flowable 节点发起 HTTP | 简单 REST 调用；要处理幂等和凭证 |
| Script Task | Flowable 节点中的脚本引擎 | 小段可控逻辑，不宜承载大型业务代码 |
| User Task | 人通过任务门户处理 | 审批、录入、复核、会签 |
| Receive Task | 外部消息/API 唤醒 | 等待回执或业务事件 |
| Business Rule Task | DMN/规则实现 | 风险分级、路由决策 |
| Call Activity/Subprocess | Flowable 引擎 | 复用另一个 BPMN 流程 |
| Mail/Camel/Web Service/Shell 等扩展 | 对应模块 | 特定集成；使用前核对 8.x 模块和安全边界 |
| Timer/Event/Gateway | 引擎控制结构 | 等待、超时、消息、分支、并行、汇合 |

对 `media_agent`，建议让 Flowable 只负责状态机、审批和 SLA；Go/Python 进程以 External Worker 处理 LLM、浏览器、图片和视频任务。这样 Flowable 节点无需安装媒体工具和 Python 依赖，Worker 可按 topic 独立限流和扩容。

## 13. 存储支持

Flowable OSS 使用 JDBC 关系数据库。官方 OSS 配置文档列出的数据库包括 H2、MySQL、Oracle、PostgreSQL、DB2 和 Microsoft SQL Server。文档里的具体数据库版本可能滞后，落地 Flowable 8 前要以目标版本依赖、建表脚本和驱动矩阵做兼容性验证。

建议：

- 本地开发和测试可用 H2；
- 生产优先选团队熟悉的 PostgreSQL/MySQL/Oracle/SQL Server；
- 三节点必须连接同一个逻辑数据库；
- 不要使用每节点独立数据库后再做异步复制；
- schema 升级要配合 Flowable 版本发布执行，并在副本验证；
- 历史表增长、变量大小、索引、Dead Letter 积压和 Job 获取查询要纳入监控。

Flowable 的核心状态不能只换成 Redis、MongoDB 或 Elasticsearch。可把业务数据、检索索引、文件和事件放在其他存储中，但引擎仍需要受支持的关系数据库。

## 14. 定义版本与运行中实例迁移

相同 process key 的新部署会产生递增版本。新启动实例默认使用最新定义，已运行实例继续引用启动时的旧版本。这是安全默认值，因为运行令牌可能停在新模型中已经不存在的 Activity 上。

如果必须让运行中实例升级，可使用 `ProcessMigrationService` 指定源/目标定义并映射 Activity。迁移前需要回答：

- 旧实例当前可能停在哪些 User Task、Timer、Receive Task；
- 新旧 Activity ID 如何对应；
- 已存在的 Job、事件订阅和局部变量如何处理；
- 删除或新增并行路径后 Execution 树是否合法；
- 是否要批量迁移，如何失败回滚和审计。

流程定义中的 Activity ID 应当视为长期接口，避免每次画图时随机重建 ID。

## 15. 与 Airflow、Temporal、Conductor 的定位对比

| 维度 | Flowable | Airflow | Temporal | Conductor OSS |
|---|---|---|---|---|
| 核心模型 | BPMN/CMMN/DMN | DAG + DagRun + TaskInstance | Workflow 代码 + Event History + Activity | JSON Workflow + Task + Queue |
| 人工任务 | 强：候选组、认领、委派、会签、Timer | 有 HITL Operator，但不是主要模型 | 用 Signal/Update 自建任务与权限层 | Human Task/外部系统配合，平台模型较轻 |
| 定义方式 | 标准 XML/建模器 | Python | SDK 代码 | JSON |
| 主要持久化 | 关系数据库中的运行态/任务/Job/历史 | Metadata DB；执行器可另用 broker/K8s | Event History + Visibility persistence | DB + Queue/索引实现 |
| 非 Java Worker | External Worker 拉取 | Operator/容器/远程作业 | 官方多语言 SDK Worker | 多语言 Worker 拉取任务 |
| 失败恢复 | wait state + DB Job lease/retry/dead letter | TaskInstance 状态和 Executor 重派 | History 重放 + Activity retry | Queue lease/ack + task retry |
| 最擅长 | 审批、工单、业务流程、人机协作 | 数据批处理、定时 DAG、回填 | 可靠长流程、微服务/Agent 编排 | 动态 JSON 编排和多语言 Worker |

针对“我希望了解有人工参与的工作”，Flowable 是四者中最值得专门学习的一个。它能迫使学习者明确任务归属、角色、认领、委派、会签、SLA、业务错误、补偿和流程版本，这些概念在纯技术编排器中通常需要自行搭建。

针对 `media_agent` 的工程选型：

- 若核心目标是让 Go/Python Agent 在崩溃后从代码状态可靠恢复，优先 Temporal；
- 若核心目标是建设可配置的内容审批、运营工单和多角色协作，优先 Flowable；
- 若核心目标是运营用 JSON 拼装多语言任务，评估 Conductor；
- 若核心目标是每日批量采集、生成、统计和补跑，使用 Airflow。

Flowable 与 Temporal 也可以组合，但早期项目不建议同时引入两个状态权威。先按最主要的失败模型选一个，否则跨引擎一致性、观测和运维成本会超过收益。

## 16. 建议的最小 PoC

用三台逻辑节点或三个容器完成以下验证：

1. 部署包含 External Worker、User Task、Boundary Timer、网关和发布任务的 BPMN；
2. 启动 100 个内容实例，Python Worker 获取 `generate-content`；
3. 在 Worker 已调用模拟 LLM 后强制杀进程，验证锁过期后的再次获取和幂等；
4. 在一个 Flowable 节点执行 Job 时杀节点，记录恢复延迟；
5. 三节点同时运行，确认同一 Job 不被正常并发执行；
6. 用候选组查询、claim、complete 实现一个最小任务页面；
7. 验证非中断提醒和中断升级两种 Boundary Timer；
8. 让异步任务重试耗尽进入 Dead Letter，再修复并恢复；
9. 部署流程 v2，验证新实例使用 v2、旧实例继续 v1；
10. 对一批旧实例执行受控迁移；
11. 测量 10 万历史 Task、Variable 和 Job 下的查询、获取与清理；
12. 数据库主备切换后，验证连接恢复、重复执行和 Timer 积压追赶。

验收指标至少包括：任务恢复时间、重复副作用数量、Dead Letter 可发现时间、User Task 查询延迟、Timer 延迟、数据库 QPS/锁等待、Worker 吞吐和流程迁移失败率。

## 17. 最终评价

Flowable 的学习价值主要不在“怎么把函数串起来”，而在业务流程建模：什么是持久等待点，哪些错误是业务分支，任务归谁、谁能认领、什么时候超时、并行会签如何结束、流程升级时旧实例怎么办。

它通过关系数据库同时实现流程状态存储、User Task 持久化、Timer/Async Job 队列和三节点协调。节点重启后可以从数据库继续，但外部副作用仍然必须按至少一次执行设计。当前 OSS 8.x 提供的是强大的引擎和 REST 基础设施，身份、表单和审批 UI 需要自行集成或选择另一个产品层。

如果目标是为求职深入理解“人工参与的工作流”，建议按以下顺序实践：User Task 与候选组 → Boundary Timer → multi-instance 会签 → External Worker → BPMN Error/技术异常 → Job lease 与 Dead Letter → 版本迁移。完成这条路径后，再与 Temporal 的 Signal/Update 和 Airflow HITL 对比，会清楚看到产品级 BPM 与持久执行框架的边界。

## 参考资料

- [Flowable GitHub 主仓库](https://github.com/flowable/flowable-engine)
- [Flowable Releases：8.0.0 与 7.0 OSS 边界](https://github.com/flowable/flowable-engine/releases)
- [Getting Started：引擎、服务与流程实例](https://www.flowable.com/open-source/docs/bpmn/ch02-GettingStarted/)
- [Configuration：数据库与引擎配置](https://www.flowable.com/open-source/docs/bpmn/ch03-Configuration/)
- [Flowable API](https://www.flowable.com/open-source/docs/bpmn/ch04-API/)
- [Deployment 与流程定义版本](https://www.flowable.com/open-source/docs/bpmn/ch06-Deployment)
- [BPMN 2.0 Introduction：事务与等待状态](https://www.flowable.com/open-source/docs/bpmn/ch07a-BPMN-Introduction)
- [BPMN 2.0 Constructs：User Task、Timer、External Worker 等](https://www.flowable.com/open-source/docs/bpmn/ch07b-BPMN-Constructs/)
- [Process Instance Migration](https://www.flowable.com/open-source/docs/bpmn/ch08-ProcessInstanceMigration)
- [History](https://www.flowable.com/open-source/docs/bpmn/ch10-History)
- [Identity Management](https://www.flowable.com/open-source/docs/bpmn/ch11-IDM)
- [Advanced：Async Executor、Job lock、retry、dead letter](https://www.flowable.com/open-source/docs/bpmn/ch18-Advanced/)
- [Event Registry Introduction](https://www.flowable.com/open-source/docs/eventregistry/ch06-EventRegistry-Introduction/)
- [Flowable 8.0.0 Javadocs](https://www.flowable.com/open-source/docs/all-javadocs/)
