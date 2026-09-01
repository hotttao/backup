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

## 1. 选型和技术路线

在 [Agent 的分类](../agent_design/001_agent_kind.md) 里，我们聊到按照是否具备通用能力，Agent 分为两类:
1. 具备通用能力的 Agent Core
2. 不具备通用能力的 Agent Framework

**我们选择基于 Agent Core 实现 Agent Platform。**，实现上我们希望能做到跟某一个具体的 Agent Core 实现解耦做到灵活切换。

所以我们需要在业务和依赖的 Agent Core 之间做一层抽象:

1. 将通用能力在平台和 Agent Core 之间做一个切分，只依赖 Agent Core 最基础最核心的能力
2. 对依赖的最基础和最核心的能力做一层抽象，让 Agent Core 以插件的形式接入，实现对 Agent Core 的解耦。

Agent Core 通过三大件(system prompt、skills、mcp) 来定义业务行为。

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

## 2. 记忆的实现
记忆的实现，通常包括:
1. 记忆系统本身，包括存储和对外的提供的 API 接口
2. 配套的 MCP 工具，让 Agent 可以使用记忆系统的 API 接口完成记忆的读取和更新
3. 系统提示词，提示 Agent 何时何处应该去做记忆的召回和更新

实现的难点在于:
1. MCP 工具可能需要多个、并且如何让 Agent 可以理解和使用这套工具，需要一套完整的提示词
2. 我们很有可能是需要实现记忆的版本管理，从 Anthropic 提供的记忆工具里面是有这个功能的

当前实现:
1. 以文件系统的形式提供记忆，通用 Agent 天然具备文件系统的操作能力。
2. 采用类似 SKILLS 的文件索引的机制，让 Agent 按需加载记忆
3. 底层使用 FUSE 机制，拦截 Agent 对文件系统的更新
4. 将记忆保存在关系型数据库中，借助数据库的事务机制，实现记忆的版本管理


## 3. 用户交互过程
platform 内我们通过设计 tool 完成用户交互时，整个流程:
1. Agent 提议: Agent 生成内容，调用 Tool 将内容持久化到系统中，并返回唯一ID
2. 用户反馈: 用户在 UI 中通过唯一 ID 获取内容，review
3. 用户提交: 用户将反馈内容提交给 agent

这里面有两个难点:
1. 用户反馈后的提交过程是直接在 UI 中完成的，然后只给 agent 一个提示 xxxx 提议已经完成了。还是把反馈的内容提交给 agent，让 agent 调用另一个 tool 完成。
2. 反馈过程的中断恢复

### 3.1 如何提交反馈

这里面核心考虑的点是直接提交是否可行。有可能你的这次提交是一个多人编辑，可能会冲突或者校验不通过。这个时候你就要把所有提交的参数提供给 agent，让他调用 tool 完成提交。因为 agent 可以根据 tool 执行失败的结果做处理，比如冲突的合并。

但是如何结果不会冲突或者校验不通过，那你就可以直接提交。如果 agent 需要 review 的结果，agent 可以通过唯一 ID 自己调用 tool 拿到。

### 3.2 中断恢复

agent 提交，中间链路比较长，如果 agent 重启了，提交就会失败。所以正常情况下，应该是在 UI 里直接提交。但是无论是哪种方式都需要中断恢复的机制。即便是 UI 提交用户也有可能隔了几天才来 review。

Agent Loop 不在我们的控制范围，所以无法从 Agent 本身实现中断恢复。需要通过 UI 提供其他反馈机制，比如通知。但是里面的要点是，用户反馈后需要把反馈内容提交给 Agent。

## 4. Workflow 的实现
Workflow 当前是自己实现的，没有借助任何框架。比如一个 Workflow 是 ABC 三个节点，C 依赖 A 和 B。

整个依赖关系是确定的，所以在 Workflow 执行的初始化过程中，就可以生成 A/B/C 这三个节点的任务。并定义好每个任务的依赖的未决任务。每次 Workflow 的执行，都会检查 job 的依赖是否满足。满足就执行对应 job。

## 5. 其他内容
虽然是参考的 ![neutree-ai/agent-platform](https://github.com/neutree-ai/agent-platform)，但在这个 Agent 项目里，我希望能基于自己熟悉的 Go 和 Python 自己实现。

所以这个系列不仅仅是 Agent，还会包含从前端到后端再到 k8s 部署完整过程。包括:
1. 认证和鉴权:
    - RBAC/ABAC 认证的基础理论 
    - Keycloak、OPA、OpenFGA、Ory kratos、Ory Hydra 的实现以及如何选型
    - 认证和鉴权的整个流程，包括认证信息如何传递、服务内部如何认证和鉴权、长周期任务如何鉴权
2. Gateway:
    - Gateway 应该具备的能力、K8s 对 Gateway 的 API 抽象
    - Gateway 的实现，以及不同规模性和场景下应该如何选型
    - 不同 Gateway 与认证鉴权的集成方式
3. DDD 领域驱动设计
4. 分布式事务的实现
5. 前端(主要是 React)的知识