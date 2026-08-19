---
weight: 1
title: "Agent Platform 架构设计"
date: 2026-08-01T22:00:00+08:00
lastmod: 2026-08-17T18:20:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Agent Platform 架构设计"
featuredImage:

tags: ["Agent Platform"]
categories: ["Agent"]

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
