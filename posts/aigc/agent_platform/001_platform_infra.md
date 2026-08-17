---
weight: 1
title: "Base Agent 设计"
date: 2026-08-01T22:00:00+08:00
lastmod: 2026-08-17T18:20:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Base Agent 抽象"
featuredImage:

tags: [""]
categories: ["agent_core"]

lightgallery: true
---

今天我们将基于![neutree-ai/agent-platform](https://github.com/neutree-ai/agent-platform)这个项目，学习如何设计实现一个生产级 Agent 平台。

<!-- more -->

## 1. Agent Platform 有哪些功能

在 [Agent 的分类](../agent_design/001_agent_kind.md) 里，我们聊到按照是否具备通用能力，Agent 分为两类:
1. 具备通用能力的 Agent Core
2. 不具备通用能力的 Agent Framework

Agent Core 通过三大件(system prompt、skills、mcp) 来定义业务行为。

Agent Platform 是基于 Agent Core 实现的。并且作为用户，我们希望是能跟模型厂商解耦。所以即便我们依赖Agent Core 去开发 agent，我们也希望做到灵活切换。

所以我们需要在业务和依赖的 Agent Core 之间做一层抽象:

1. 将通用能力在平台和 Agent Core 之间做一个切分，只依赖 Agent Core 最基础最核心的能力
2. 对依赖的最基础和最核心的能力做一层抽象，让 Agent Core 以插件的形式接入，实现对 Agent Core 的解耦。

所以 Agent Platform 划分为如下三层:

![Agent Platform](/images/aigc/agent_platform/platform.png)


架构上我们将采用控制面和数据分离的实现:
1. Control Plan: 管理 System Prompt、Skills、MCP，并提供平台通用能力包括记忆、Agent 编排、SubAgent 等能力
2. Data Plan: 基于 Agent Core 提供具体业务 Agent 的实现。

从基于到进阶，我们将按照如下顺序实现 Agent Platform:
1. 基于 ACP 和 Universal Event 抽象对 Agent Core 的依赖，进而实现多 Agent Core 支持
2. Control Agent Proxy 提供从 Data Plan 到 UI 的 SSE 代理。实现 LLM Message 先落库再广播，从而实现消息的持久化可恢复
3. UI 基于 Universal Event 实现消息渲染。UI 实现一套 Slot 和 Plugin 机制，通过将 Message 与 Plugin 关联渲染，实现更友好的人机交互
4. 基于 Sidecar Fuse 和文件系统实现记忆库，支持记忆跨 Agent 共享
5. 基于已有的 Chat 和 Session 管理实现 SubAgent 和 Teamwork 的 Multi-Agent 编排

业务上:
6. 通过 **MCP 和 Plugin** 集成 `media_crawler`，为 Agent 添加小红书的数据采集与内容查询能力
7. 实现视频素材管理平台，支持定义视频素材分类，并实现一套基于提示词链接的视频生成 Workflow，实现视频生成的自动化


## 用户交互过程
platform 内我们通过设计 tool 完成用户交互时，用户反馈后的提交过程是直接在 UI 中完成的。还是提交给 agent 调用 tool 完成。

这里面核心考虑的点是直接提交是否可行。有可能你的这次提交时一个多人编辑，可能会冲突或者校验不通过。这个时候你就要把所有提交的参数提供给 agent，让他调用 tool 完成提交。因为 agent 可以根据 tool 执行失败的结果做处理，比如冲突的合并。

但是如何结果不会冲突或者校验不通过，那你就可以直接提交。让 agent 通过 tool 去获取提交结果。因为通常你需要设计一个工具，让 agent 去提交他生成的结果这个时候会返回 ID。chat 对话框会用这个 ID 做展示 UI 界面供人去review。用户提交之后，可以在 CHAT 对话框中提交一个信息，说你完成了。这个时候 agent 通过之前返回的 ID 就能拿到你review 的结果。

agent 提交，中间链路比较长，如果 agent 重启了，提交就会失败。所以正常情况下，应该是在 UI 里直接提交。

## SSE Event 传输
1. 数据是先落库再广播的。
2. 客户端链接是先订阅，再查数据库。

### Event num 如何维护

`num`（在 `media_agent_gateway` 中叫 `sequence`）不是 Runtime 传入的编号，而是 Gateway 在事件成功落库时分配的、Session 内严格递增的恢复游标。

分配过程如下：

1. 开启数据库事务并锁定所属 `agent_sessions` 行（`SELECT ... FOR UPDATE`）。同一个 Session 的写入即使落到多个 Gateway 实例，也只能串行进入编号分配区。
2. 查询这个 Session 已落库事件的 `MAX(sequence) + 1`；没有历史事件时从 `1` 开始。
3. 使用该 sequence 插入 `universal_events`，然后提交事务。
4. 数据库通过 `(session_id, sequence)` 唯一索引兜底，禁止同一个 Session 出现重复编号。
5. 只有事务提交后才向内存广播器发布事件，SSE 的 `id` 就是已提交的 sequence。因此客户端保存到的游标一定能从数据库恢复。

并不是所有 Runtime 帧都消耗 sequence。`item.started`、`item.delta` 只用于实时渲染，广播时 `Sequence=0`，SSE 不写 `id`，UI 也不推进恢复游标。message/tool_call 的 `item.completed` 和聚合后的 tool_result 快照才落库并取得新 sequence。tool_result 首次立即写，后续更新在 300ms 窗口内只保留最新值；Turn 结束前强制 flush。每次 flush 都追加一个新 sequence，而不是覆盖旧 sequence，否则已经越过旧游标的客户端无法发现内容发生了更新。

例如数据库已有 sequence `1..10`，UI 的最后游标是 `8`。新的 delta 会立即显示，但没有 SSE id，游标仍是 `8`；完整 message 落库后得到 `11`，再以 `id: 11` 广播。UI 重连时请求 `after_sequence=8`，数据库会回放 `9、10、11`，UI 收到后把游标推进到 `11`。

### 事件广播中的 SSE 链接如何维护

广播器按 `session_id` 维护订阅组，每条 SSE HTTP 连接对应组内一个独立的带缓冲 channel：

1. `/events?after_sequence=N` 进入后，服务端先把当前连接注册进 Session 的订阅组，再查询数据库中 `sequence > N` 的事件。
2. 数据库查询期间产生的新事件已经可以进入该连接的实时 channel，所以不会落在“查完数据库、尚未订阅”的空窗里。
3. 服务端先按 sequence 发送数据库回放，再消费实时 channel。若某事件既被数据库查询到，又在查询期间进入 channel，连接内的 `cursor` 会丢弃 `sequence <= cursor` 的副本。
4. 持久事件写成 `id: <sequence>`；临时帧写空 id。heartbeat 和 ready 也是无 id 控制帧，UI 不把它们当业务事件。
5. 浏览器刷新或网络断开时，HTTP context 结束，defer 会从订阅组移除并关闭这个订阅；重连会创建新的 channel，并携带最后一个持久 sequence 继续回放。
6. 慢客户端把 channel 缓冲区塞满时，广播器主动关闭该订阅，避免拖住整个 Session。客户端随后用最后确认的 sequence 重连，持久事件从数据库补齐；可能丢掉的只有不承诺回放的 delta，最终的 `item.completed` 仍会恢复完整内容。

举例：UI 以 `after_sequence=10` 建立连接。服务端先注册 channel，然后开始查数据库；此时事件 `11` 提交并同时进入数据库和 channel。查询返回 `11`，服务端先回放它并把连接 cursor 更新为 `11`；随后读到 channel 中的同一个 `11`，因为 `11 <= cursor` 而跳过。之后事件 `12` 到达 channel，正常发送。这样既没有丢 `11`，也没有重复渲染 `11`。

`chat_status` 与连接生命周期是两个概念：`human/agent` 表示当前轮到谁行动，创建 Turn 时与 User Message 同事务切到 `agent`，终态事件、Turn 状态与 pending tool result 全部提交后切回 `human`。刷新页面后，即使旧 SSE 连接已经消失，UI 仍能从 Session 的 `chat_status=agent` 恢复“正在运行”状态，再通过数据库回放和新 SSE 连接追上进度。
