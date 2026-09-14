---
weight: 33
title: "Flowable 执行与故障恢复"
date: 2024-10-11T08:00:00+08:00
lastmod: 2026-09-14T08:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "解释事务推进、等待点和恢复"
featuredImage:

tags: ["workflow"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

# Flowable 执行与故障恢复

Flowable 内容分成四篇：

1. [基础与架构](./031_flowable.md);

2. [任务分配与并发控制](./032_flowable_job_assignment.md);

3. **执行与故障恢复（本文）**;

4. [任务投递与状态变化](./034_flowable_task_delivery_data_model.md);

## 1. 执行语义：事务一直推进到等待点

理解 Flowable 的核心不是“每个节点都是队列任务”，而是 **命令上下文中的同步推进 + wait state 持久化 + 异步 Job**。

例如，完成 `editorReview` 后：

1. `TaskService.complete()` 开启数据库事务；
2. 删除/结束当前运行时 Task，记录变量 `decision`；
3. 经过网关选择路径；
4. 如果下一步是普通同步 Java Service Task，当前线程直接执行它；
5. 继续前进，直到新的 User Task、Receive Task、Timer、External Worker Task、异步边界或结束；
6. 一次提交该事务中的流程状态变化。

如果同步 Service Task 抛出未处理异常，事务回滚。调用前的等待状态仍然存在；本次 `complete()` 失败，并不会自动变成三次异步重试。需要自动重试的技术步骤应建模成 `flowable:async="true"` 的 Service Task、External Worker Task，或由调用方显式安全重试。

### 1.1 业务错误和技术异常要分开

- **BPMN Error** 表达已知业务结果，例如“内容侵权风险过高”，由 Boundary Error Event 或 Event Subprocess 捕获并走明确分支。
- **Java Exception/技术失败** 表达数据库不可用、网络超时等执行问题。同步时回滚事务；异步时进入 Job 重试。
- **补偿** 表达已经产生外部效果后的业务撤销，例如删除已创建的草稿或释放资源。数据库回滚不能撤销第三方平台动作。

任何远程调用都可能出现“远端成功，本地提交失败”。External Worker、HTTP Task 和 Java Delegate 都应使用业务幂等键，如 `processInstanceId + activityId + attempt/businessVersion`，并在必要时使用 outbox、状态查询或补偿。

## 2. 异常恢复和重试

### 2.1 节点重启

流程在 wait state 时，所需状态已经提交数据库。三个 Flowable 节点全部重启后，只要数据库和流程实现可用：

- User Task 仍能查询和完成；
- Timer Job 根据 due date 重新进入执行；
- 未锁 Job 可以被重新获取；
- 锁在已宕机节点名下的 Job 等租约到期后重新获取；
- External Worker Job 未完成时仍可在锁过期后被 Worker 再次获取；
- Receive Task/消息订阅继续等待相关事件。

如果进程在远程调用后、数据库提交前宕机，任务可能再次执行。这是典型的至少一次效果，必须靠幂等实现处理。

### 2.2 异步 Job 重试

异步 Job 默认常见重试次数为 3。执行失败后可转成带下一次到期时间的 Timer Job；重试耗尽后进入 Dead Letter Job，不再自动执行，需要运维人员修复根因后重新移动/激活。可以用 `flowable:failedJobRetryTimeCycle` 为任务配置重试节奏，例如等待 10 秒重试 3 次。

重试范围取决于事务边界。把很长的一串同步 Service Task 放在同一事务中，末尾失败会回滚整段。对有远程副作用或耗时较长的步骤，应在模型中加入异步边界，把失败和重试隔离到合理粒度。

### 2.3 External Worker 失败

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

## 3. 定时任务和自动恢复

Flowable 支持：

- Timer Start Event：按时间启动流程；
- Intermediate Catching Timer Event：流程中等待到某个时间；
- Boundary Timer Event：任务 SLA、提醒、升级；
- `timeDate`：某个绝对时间；
- `timeDuration`：等待一段时间；
- `timeCycle`：重复执行，可使用 ISO-8601 重复表达式，也支持 cron 形式。

Timer 会持久化为数据库 Job。引擎重启不会丢失它；到期后由任一 Async Executor 节点获取并执行。停机期间已经到期的 Timer，在恢复后会成为可执行 Job，但具体追赶速度受到 Worker 数量、获取批次、本地队列和数据库吞吐影响。

Timer Start Event 通常随流程定义部署而创建。部署同 key 的新版本后，新启动一般使用新版本，旧实例仍按旧定义运行。对“每天 1 点生成内容”这类简单调度 Flowable 能完成；如果核心诉求是上千数据 DAG 的补数、数据区间、分区依赖和批量回填，Airflow 的调度抽象更合适。

## 4. 定义版本与运行中实例迁移

相同 process key 的新部署会产生递增版本。新启动实例默认使用最新定义，已运行实例继续引用启动时的旧版本。这是安全默认值，因为运行令牌可能停在新模型中已经不存在的 Activity 上。

如果必须让运行中实例升级，可使用 `ProcessMigrationService` 指定源/目标定义并映射 Activity。迁移前需要回答：

- 旧实例当前可能停在哪些 User Task、Timer、Receive Task；
- 新旧 Activity ID 如何对应；
- 已存在的 Job、事件订阅和局部变量如何处理；
- 删除或新增并行路径后 Execution 树是否合法；
- 是否要批量迁移，如何失败回滚和审计。

流程定义中的 Activity ID 应当视为长期接口，避免每次画图时随机重建 ID。

## 5. 存储支持

Flowable OSS 使用 JDBC 关系数据库。官方 OSS 配置文档列出的数据库包括 H2、MySQL、Oracle、PostgreSQL、DB2 和 Microsoft SQL Server。文档里的具体数据库版本可能滞后，落地 Flowable 8 前要以目标版本依赖、建表脚本和驱动矩阵做兼容性验证。

建议：

- 本地开发和测试可用 H2；
- 生产优先选团队熟悉的 PostgreSQL/MySQL/Oracle/SQL Server；
- 三节点必须连接同一个逻辑数据库；
- 不要使用每节点独立数据库后再做异步复制；
- schema 升级要配合 Flowable 版本发布执行，并在副本验证；
- 历史表增长、变量大小、索引、Dead Letter 积压和 Job 获取查询要纳入监控。

Flowable 的核心状态不能只换成 Redis、MongoDB 或 Elasticsearch。可把业务数据、检索索引、文件和事件放在其他存储中，但引擎仍需要受支持的关系数据库。

## 6. 建议的最小 PoC

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
