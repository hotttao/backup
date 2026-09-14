---
weight: 31
title: "Flowable 基础与架构：从人工会审 BPMN 到三节点集群"
date: 2024-10-11T08:00:00+08:00
lastmod: 2026-09-14T08:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "通过示例认识 Flowable 与三节点架构"
featuredImage:

tags: ["workflow"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

# Flowable 基础与架构：从人工会审 BPMN 到三节点集群

Flowable 内容分成四篇：

1. **本文**；

2. [第 2 篇](./032_flowable_job_assignment.md)；

3. [第 3 篇](./033_flowable_execution_recovery.md)；

4. [第 4 篇](./034_flowable_task_delivery_data_model.md)。

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

### 3.2 回到示例：内容会审 BPMN 怎样经过这张架构图

前面的内容发布流程会这样运行：

```text
1. Client 向负载均衡后的任一 Flowable 应用节点启动 Process Instance
2. 该节点的 Engine 在一个 CommandContext 中执行 BPMN Token
3. Token 到达 editorialReview User Task，Engine 把 Execution、Task 和 Variable 提交到共享数据库
4. 编辑从任一节点查询并 claim User Task，完成请求再次推进 Token
5. Token 到达异步 Service Task 时，Engine 创建数据库 Job 后结束当前事务
6. 某个节点的 Async Executor 获取并锁定 Job，执行服务调用
7. Job 完成后 Engine 继续推进到会签、定时器或结束事件
8. 流程结束时运行时记录转为历史审计记录
```

| 问题 | 结论 | 详细原理 |
|---|---|---|
| Process Instance 状态归谁 | 共享 Flowable Database 中的 Runtime Execution、Task、Variable 是当前权威状态 | [033](./033_flowable_execution_recovery.md) |
| 同步步骤归哪个节点 | 哪台应用节点收到 API 请求，就由哪台节点在当前事务中推进到下一个等待点，不需要长期归属 | [033](./033_flowable_execution_recovery.md) |
| 异步 Job 归哪个节点 | 多个 Async Executor 竞争到期 Job，只有成功写入 lock owner/expiration 的节点获得本次执行权 | [032](./032_flowable_job_assignment.md) |
| User Task 归谁 | 候选人都能看到；claim 后记录 assignee。这里是业务人员归属，不是 Server 节点归属 | 本文第 4 节 |
| 怎样并发 | 不同实例可并发；同一实例的并行 Token 依靠数据库事务、乐观锁和 Job 锁防止覆盖 | [032](./032_flowable_job_assignment.md) |
| 谁推进流程 | API 请求线程或 Async Executor 调用 Engine 推进 BPMN Token，直到新的 wait state | [033](./033_flowable_execution_recovery.md) |

完整 Job 获取、External Worker 拉取和运行时表变化见 [034](./034_flowable_task_delivery_data_model.md)。

## 4. 人工任务能力

### 4.1 分配、候选与认领

- `assignee`：任务直接分配给某个用户；
- `candidateUsers`：一组候选用户都能看到，某人 claim 后成为 assignee；
- `candidateGroups`：编辑、法务等候选组；
- `owner`：委派场景中的原负责人；
- claim/unclaim：认领或释放待办；
- delegate/resolve：委派给他人并在完成后回到 owner；
- due date/priority/category：用于任务排序、SLA 和门户展示。

Flowable 引擎不会替业务应用验证 BPMN 中写的用户 ID 是否真实存在。这样便于集成 LDAP、Active Directory、OIDC 或企业权限中心，但也意味着身份映射、租户隔离和授权校验需要认真设计。

### 4.2 会签

User Task 可以配置 multi-instance：

- parallel：同时为多个审核人创建任务；
- sequential：逐个处理；
- collection/elementVariable：审核人集合及当前成员；
- completionCondition：决定何时提前结束，例如全员通过、三人中两人通过、任一否决立即结束。

会签结果不应只依赖一个被多人覆盖的流程变量。推荐把每个意见写入业务审计表，或使用局部变量/变量聚合器，再在 completion condition 中根据结构化结果判断。

### 4.3 超时、提醒和升级

在 User Task 上挂非中断 Boundary Timer，可以在不取消原任务的情况下提醒；挂中断 Boundary Timer，可以在超时后取消原任务并转给主管。Timer 依赖 Async Executor 执行。还可以使用循环 Timer 实现重复提醒，但要控制通知幂等和频率。

### 4.4 表单与任务门户

BPMN User Task 可以带 `formKey`，引擎能保存任务元数据和表单属性，但当前 OSS 8.x 不等于附送完整可用的审批门户。实际项目通常需要：

1. 用 `TaskService`/REST 查询当前用户和候选组的任务；
2. 自己实现认领、打开表单、校验、完成、退回和审批记录页面；
3. 用 form key 映射前端表单 schema 或业务页面路由；
4. 把业务数据权限与“能否完成这个 Task”同时校验；
5. 把附件和长表单数据保存在业务存储，只向 Flowable 写关键变量。

## 5. UI 与工作流定义方式

### 5.1 当前 OSS UI 边界

Flowable 6.x 的资料经常展示 Modeler、Task、Admin 和 IDM 应用。Flowable 7.0 官方发布说明明确：7 系列聚焦 BPMN、CMMN、DMN、Event Registry 引擎与 REST API，不包含 UI applications；Flowable 8.0 延续新的引擎技术栈。因而评估当前 OSS 时，不应把旧版 UI 当成开箱即用能力。

官方提供可免费使用的 Flowable Cloud Design 来建模，也有商业 Flowable Platform。它们的托管方式、许可证和功能边界与 `flowable-engine` OSS 仓库不同。采用 OSS 可以使用支持 BPMN 2.0 的外部建模器，或自行建设建模发布和任务门户。

### 5.2 YAML、JSON 和 XML

| 格式 | 能否作为核心流程定义 | 说明 |
|---|---|---|
| BPMN 2.0 XML | 是 | BPMN 流程的标准部署格式，适合 Git 版本控制和模型器互通 |
| CMMN XML | 是 | 动态 Case 定义 |
| DMN XML | 是 | 决策表/决策模型 |
| JSON | 否（对 BPMN） | REST 请求和响应可用 JSON；Event Registry 的事件/通道定义可用 JSON，但不等于 BPMN JSON DSL |
| YAML | 否 | 当前 OSS 没有官方 YAML 工作流 DSL |

如果团队希望像 Conductor 一样让平台通过 JSON 直接创建/修改工作流，Flowable 会多一层 BPMN XML 生成和校验。如果希望模型符合 BPMN 标准、能表达复杂人工协作，XML 是合理代价。

## 6. Worker 节点和任务类型

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

## 7. 与 Airflow、Temporal、Conductor 的定位对比

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

## 8. 最终评价

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
