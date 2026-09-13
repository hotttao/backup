---
weight: 23
title: "Temporal 执行流程与故障恢复：从任务推进到重放恢复"
date: 2024-10-11T08:00:00+08:00
lastmod: 2026-09-14T08:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "沿用 Greeting Workflow 示例，详细解释 Temporal 的任务推进、事件持久化、确定性重放、重试与故障恢复"
featuredImage:

tags: ["workflow"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

# Temporal 执行流程与故障恢复：从任务推进到重放恢复

这是 Temporal 系列的第三篇：

1. [021：基础与架构](./021_temporal.md)通过 Greeting 示例建立整体认识；
2. [022：成员发现、状态分片与任务分配](./022_temporal_membership_partition.md)解释 Shard、Partition 和 owner；
3. **本文**沿用同一个示例，展开执行推进、持久化、重放、重试和故障恢复；
4. [024：任务投递与数据变化](./024_temporal_task_delivery_data_model.md)对着完整时序图解释 Worker 长轮询、Matching 配对、请求参数和状态记录。

本文不再重复 Membership 和一致性哈希算法。只要先记住：一次 Workflow Execution 的状态属于固定的 History Shard，而 Workflow Task 和 Activity Task 通过 Matching 匹配给应用 Worker。

## 1. 先分清三种责任

Temporal 的执行不是由某一个组件从头跑到尾：

| 角色 | 负责什么 | 不负责什么 |
|---|---|---|
| History | 保存 Event History 和 Mutable State，验证 Command，创建后续 Task 和 Timer | 不执行用户的 Workflow/Activity 函数 |
| Workflow Worker | 运行确定性的 Workflow 代码，根据历史和新事件计算 Command | 不直接把 Workflow 状态写进数据库 |
| Activity Worker | 调用 HTTP、数据库、脚本或第三方系统，返回结果或失败 | 不决定整个 Workflow 下一步走向 |
| Matching | 在 Task Queue Partition 中把 Task 与 Worker 的长轮询请求匹配起来 | 不保存 Workflow 的权威业务状态 |

因此，“谁负责推进 Workflow”要拆成两句话：

- Workflow Worker **计算下一步决定**；
- History **持久化决定并推进权威状态**。

## 2. Greeting Workflow 的完整正常链路

第一篇中的 Workflow 会安排一个 `BuildGreeting` Activity：

```go
func GreetingWorkflow(ctx workflow.Context, name string) (string, error) {
    ctx = workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
        StartToCloseTimeout: time.Minute,
    })

    var result string
    err := workflow.ExecuteActivity(ctx, BuildGreeting, name).Get(ctx, &result)
    return result, err
}
```

### 2.1 启动 Workflow Execution

```text
Client
  → Frontend
  → 根据 Namespace ID + Workflow ID 算出 History Shard
  → 路由到该 Shard 当前的 History owner
```

History 在持久化层创建 Workflow Execution，追加 `WorkflowExecutionStarted` 等事件，更新 Mutable State，并产生第一个 Workflow Task。

Workflow ID 是业务稳定标识，Run ID 标识某一次具体运行。重试、Continue-As-New 或显式重新运行可能产生新的 Run，但仍可沿用同一个 Workflow ID。

### 2.2 Workflow Task 被 Worker 领取

History 不直接选择某个 Worker 进程，而是把 Workflow Task 路由到 `greeting-tasks` 对应的 Workflow Task Queue Partition：

```text
History
  → Matching Partition owner
  ↔ 长轮询 greeting-tasks 的 Workflow Worker
```

Matching 将 Task 与某个可用 Poll 匹配。Worker 得到任务后运行 `GreetingWorkflow`，走到 `ExecuteActivity`，本次计算产生“安排 `BuildGreeting`”的 Command。

Worker 返回的不是整个 Workflow 内存快照，也不是直接写数据库的 SQL，而是一组 Command。History 验证 Command 与当前状态是否一致，再把它转成新的 Event、Mutable State 变化和待投递任务。

### 2.3 Activity Task 被 Worker 执行

History 持久化安排 Activity 的决定后，Activity Task 经对应的 Task Queue Partition 匹配给某个 Activity Worker：

```text
Activity Worker
  → 执行 BuildGreeting("Tao")
  → 返回 "Hello, Tao"
  → Frontend 根据 Task Token 路由回原 History Shard
```

Task Token 携带 Server 定位并校验这次任务所需的信息。应用不应解析它，只需在完成、失败或心跳 RPC 中原样交还 SDK。

### 2.4 Activity 结果再次唤醒 Workflow

History 保存 Activity 完成事件，使原来等待的 Future 变为可用，并创建新的 Workflow Task。Workflow Worker 再次运行后，`Get` 得到 `Hello, Tao`，于是返回完成 Workflow 的 Command。

History 最终持久化 `WorkflowExecutionCompleted`。到这里，一次执行才成为已完成状态。

本节关注 History、Workflow Worker 和 Activity Worker 如何形成执行闭环。包含 Frontend、长轮询、Matching 配对、请求参数和每一步数据变化的完整时序图，单独放在 [024](./024_temporal_task_delivery_data_model.md)；Shard owner 路由过程见 [022](./022_temporal_membership_partition.md)。

## 3. Workflow Task 与 Activity Task 为什么要分开

| 对比 | Workflow Task | Activity Task |
|---|---|---|
| 执行内容 | 确定性的 Workflow 代码 | 允许产生外部副作用的 Activity 代码 |
| 输入依据 | Event History、新事件和缓存状态 | Activity 参数及本次 Attempt 信息 |
| 输出 | Command 或 Workflow Task 失败 | Result、Failure、Cancellation 或 Heartbeat |
| 失败后的核心处理 | 重新安排 Workflow Task，必要时重放历史 | 按 Retry Policy 创建下一次 Attempt |
| 并发方式 | 多个 Workflow Execution 可并发；单个执行的状态变更由 History 串行提交 | 多个 Activity Task 可由多个 Worker 和执行槽位并发处理 |

一个 Worker 进程可以同时包含两类 Poller，也可以把两类 Worker 拆开部署。生产中通常根据 CPU、I/O、语言运行时和限流需求分别配置并发度。

## 4. Worker 重启后为何还能从原位置继续

### 4.1 有 Sticky Cache：从缓存状态继续

Worker 完成一次 Workflow Task 后，SDK 可以暂存该 Workflow 的内存执行状态。后续 Workflow Task 优先回到相同 Worker，SDK 只需应用新增事件，再从上次等待位置继续。

Sticky 是性能优化，不是正确性的基础。Worker 重启、缓存淘汰或 Sticky 超时后，执行仍必须能够恢复。

### 4.2 没有缓存：根据 Event History 重放

新 Worker 得到历史后，会从 Workflow 函数入口重新运行代码：

```text
重新执行到 ExecuteActivity
  → SDK 在历史中找到已记录的 ActivityScheduled
  → 不再真正安排一遍同一决定
  → ActivityCompleted 使对应 Future 恢复为已完成
  → Workflow 从 Get 之后继续计算
```

重放不是重新执行 Activity。Activity 的结果已经作为 Event 保存，Workflow 代码在重放时读取这些历史事实。

同名 Activity 可以在一个 Workflow 中调用多次。SDK 依据历史事件顺序、事件 ID 和 Command 匹配关系区分每一次调用，而不是只靠 Activity 名称。

### 4.3 为什么 Workflow 代码必须确定

相同 Event History 必须产生相同 Command 序列，否则 Server 无法确认当前代码是在恢复旧执行，还是试图改变已经发生的历史。

因此 Workflow 代码中不要直接调用：

- 当前系统时间和普通随机数；
- 数据库、HTTP、文件或进程接口；
- 依赖遍历顺序不稳定且会影响分支的容器；
- 未做兼容控制就改变旧 Workflow 决策路径的新代码。

这些行为应放入 Activity，或使用 SDK 提供的确定性时间、随机、Side Effect 和版本控制能力。

## 5. 状态与待投递任务怎样保持一致

以 Activity 完成为例，History 处理上报时需要同时完成：

1. 追加 `ActivityTaskCompleted` Event；
2. 更新 Mutable State；
3. 创建用于安排下一个 Workflow Task 的内部持久任务。

这些变化在 Persistence 的同一状态更新路径中提交。之后即使 History 在把任务送到 Matching 之前崩溃，持久任务仍然存在；新的 Shard owner 可以继续扫描和投递。

它的作用类似 Transactional Outbox：**权威状态和“还要做什么”一起落盘**，避免只写了状态却永久丢失后续推进信号。

Matching 暂时不可用时，Workflow 状态不会因此回滚。内部任务会继续重试投递，待 Matching 和 Worker 恢复后再执行。

## 6. 常见故障怎样恢复

| 故障位置 | 已经持久化的事实 | 恢复方式 |
|---|---|---|
| Workflow Worker 取得 Task 后崩溃，未返回 Command | Workflow Task 仍未成功完成 | Task 超时后重新安排；其他 Worker 可取得任务并重放 |
| History 已提交状态，但尚未投递到 Matching 就崩溃 | Event、Mutable State 和内部持久任务已保存 | 新 Shard owner 从 Persistence 恢复并继续投递 |
| 当前 History owner 崩溃 | Workflow History、Mutable State 和 Shard Task 在外部 Persistence | 新 owner 取得合法写入权后加载状态继续处理；归属与 fencing 见 [022](./022_temporal_membership_partition.md) |
| Matching owner 崩溃 | Workflow 权威状态仍在 History/Persistence | 新 Matching owner 接管 Partition；未完成投递由 Server 继续处理 |
| Activity Worker 执行前崩溃 | 没有 Activity 完成事件 | 本次 Attempt 超时后按 Retry Policy 重试 |
| Activity 已产生外部副作用，但上报前崩溃 | 外部系统已变化，Temporal 未记录完成 | Activity 可能再次执行，业务必须幂等或去重 |
| 所有应用 Worker 暂时不可用 | Workflow 状态和待处理任务仍在 Server/Persistence | Worker 恢复并重新长轮询后继续处理 |

Temporal 保证的是持久编排状态不会因为普通进程故障而消失，不是让所有外部系统自动获得 exactly-once 副作用。

## 7. Activity 超时、重试与心跳

Activity 的一次调用可以经历多个 Attempt。常见超时含义如下：

| 超时 | 限制什么 |
|---|---|
| Schedule-To-Start | Task 在队列里等待 Worker 的时间 |
| Start-To-Close | 单次 Attempt 从开始到结束的时间 |
| Schedule-To-Close | 包含排队与所有重试在内的总时间 |
| Heartbeat | 长 Activity 两次心跳之间允许的最大间隔 |

Activity 失败或超时时，History 根据 Retry Policy 计算下一次 Attempt。退避计时由 Server 维护，不依赖原 Worker 进程存活。

长 Activity 应定期 Heartbeat：

- Server 可以更快发现 Worker 已经失去进展；
- Worker 可以记录可恢复的进度；
- 取消请求可以通过心跳更快传到 Activity。

不可重试的业务错误应标记为 non-retryable，或从 Retry Policy 中排除。否则“参数非法”一类永久错误只会被无意义地反复执行。

Workflow Execution 也可以配置 Retry Policy，但业务长流程更常见的是在 Workflow 内明确处理 Activity 失败、补偿和人工介入，而不是把整个 Workflow 从头再开一个 Run。

## 8. 外部副作用：至少一次与业务幂等

最危险的故障窗口是：

```text
Activity 已成功调用支付/部署/发信接口
              ↓
Worker 在向 Temporal 上报成功前崩溃
              ↓
Temporal 只能认为本次 Attempt 未完成并重试
```

因此 Activity 应使用稳定的业务幂等键，例如：

```text
Workflow ID + 业务步骤名
change-20260909-42 + deploy-canary
```

外部服务保存该键与执行结果，收到重复请求时返回第一次结果。不能幂等的操作则应设计查询确认、去重表或补偿 Activity。

不要把“Event History 不重复记录成功”误解成“外部 HTTP 调用绝不重复”。两者边界不同。

## 9. Timer、Signal 与 Schedule

| 能力 | 归属 | 用途 | 故障恢复 |
|---|---|---|---|
| Workflow Timer | 某个 Workflow Execution 的历史与 Mutable State | 流程内部等待，例如等待 24 小时审批 | Server 持久化 Timer；重启后继续等待或触发 |
| Signal | 写入某个运行中的 Workflow Execution | 审批结果、回调、人工输入 | Signal 成为 Event，Worker 重放时仍能看到 |
| Schedule | 独立的调度资源 | 按时间创建新的 Workflow Execution | 调度状态由 Server 持久化，不依赖应用常驻定时器 |

例如审批流程可以同时等待 Signal 和 Timer：先收到审批则继续，Timer 先触发则走超时分支。等待期间不占用一个业务线程或 Worker 执行槽位。

## 10. 生产变更审批示例

把 Greeting 换成更接近生产的流程：

```text
Precheck Activity
   ↓
等待 approval-decision Signal 或 24 小时 Timer
   ├─ 拒绝/超时 → 结束
   └─ 通过
        ↓
   DeployCanary Activity
        ↓
   ObserveMetrics Activity
        ├─ 异常 → Rollback Activity
        └─ 正常 → DeployAll Activity
```

这个例子中：

- `change-20260909-42` 可以作为 Workflow ID，阻止业务方误启动两份相同变更；
- 审批 Signal、Timer 触发和每个 Activity 结果都进入 Event History；
- Worker 全部重启后，Workflow 可通过重放恢复到等待审批、观察指标或回滚的位置；
- 部署 Activity 仍需以变更 ID 和阶段名做幂等，避免外部部署接口被重复调用；
- Workflow 决定通过、回滚还是继续，History 保存决定并安排下一项工作。

## 11. 长历史与代码升级

Event History 会随 Signal、Timer、Activity 和 Workflow Task 增长。无限循环或极长流程应监控 History 大小，并在合适边界使用 Continue-As-New 开启新 Run、缩短新 Run 的历史。

已经运行数月的 Workflow 可能由新版本 Worker 重放。会改变 Command 序列的代码修改需要使用 SDK 的版本兼容机制，或者保持旧 Worker Build 可继续处理旧执行。发布前应对真实或代表性的历史做 Replay Test。

## 12. 把整套机制压缩成一句话

```text
History 持久化已经发生的事实和下一步任务
  → Matching 把任务匹配给 Worker
  → Workflow Worker 根据历史计算 Command
  → Activity Worker 执行外部副作用
  → 结果回到 History，开始下一轮
```

任务归属和路由解决“这次请求应该由哪台 Server 接手”，Event History、持久任务和确定性重放解决“接手后如何从原进度继续”。

## 参考资料

- [Temporal Docs：Workflow Execution](https://docs.temporal.io/workflow-execution)
- [Temporal Docs：Workers](https://docs.temporal.io/workers)
- [Temporal Docs：Event History](https://docs.temporal.io/workflow-execution/event)
- [Temporal Docs：Activity Execution](https://docs.temporal.io/activity-execution)
- [Temporal Docs：Failure detection](https://docs.temporal.io/encyclopedia/detecting-activity-failures)
- [Temporal Docs：Activity retry policy](https://docs.temporal.io/encyclopedia/retry-policies)
- [Temporal Docs：Durable Timers](https://docs.temporal.io/workflow-execution/timers-delays)
- [Temporal Docs：Worker Versioning](https://docs.temporal.io/production-deployment/worker-deployments/worker-versioning)
