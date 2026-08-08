---
weight: 1
title: "Agent Tools 设计"
date: 2026-06-03T22:00:00+08:00
lastmod: 2026-06-03T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Agent Tools 设计"
featuredImage:

tags: ["agent 设计"]
categories: ["Agent"]

lightgallery: true
---

本节我们来介绍如何为 Agent 设计准确且省钱的工具。

<!-- more -->

## 1. Tools 设计

Tools 设计遵循一些基本原则:
1. 效率和准确性:
    - 什么时候选择开发一个专用工具，还是选择使用已有的通用工具。
    - 当 agent 需要处理一些深度复杂的业务逻辑的时候，可以考虑开发一个专用 tools，而不是使用通用 tools
2. 功能独立:
    - Tools定义需要做到 **意图清晰，工具功能之间没有重叠**
    - 工具本质上就是一个可调用的函数，可以通过扩展工具的参数来增强工具的功能
3. 成本效益:
    - 提供批量化工具
    - 提供 save 工具，其他工具内部使用 save 的数据集进行过滤，避免重复
 

## 2. 通用 thinking tools
### 2.1 为什么需要 thinking tools
大多数时候，我们会提供一个通用的 thinking tools，会有如下好处:
1. thinking 工具对一些 LLM 的性能提升是非常明显的:
    - 可以防止模型误判结束，稳定多轮工具执行流程；
    - 记录推理过程，区分流程阶段标记，特别是对于那些不具备思考能力的模型。
2. 可以简化 agent loop 的实现逻辑，loop 只需要判断是否还有工具调用来决定 loop 是否终止。

下面是两个具体模型的对比:

#### Gemini 2.5 Flash
该模型无原生穿插文本思考的能力，一旦进入工具调用流程就只会连续发起tool call，全程不输出自然语言：
1. 对话上下文只堆积工具入参、返回数据，缺少推理、任务进度记录；
2. 多轮长流程后容易遗忘前期逻辑、迷失任务目标；
3. 必须额外提供`thinking`专用工具，让模型通过调用该工具写入思考内容，否则流程极易跑偏、提前终止。

#### Kimi K2
K2是专为Agent场景优化的模型，自带文本输出思考能力，不依赖thinking工具：
1. 执行模式为**先输出一段自然思路，再调用工具**，文本说明与工具调用交替出现；
2. 推理、任务进度直接存入上下文，完整保留思考链路；
3. 有无`thinking`工具都能稳定运行，不会出现思路丢失、任务迷失。


### 2.1 工具定义
```js
// 通用 thinking 工具
thinking: tool({
    description:
    "Express your reasoning, analysis, and thought process. Use this to explain what you're thinking, planning, or discovering.",
    parameters: z.object({
    thought: z
        .string()
        .describe("Your current thoughts, reasoning, or analysis"),
    }),

    execute: async ({ thought }) => {
    console.log(`[THINKING] ${thought}`);
    return {
        acknowledged: true,
        message: "Thinking recorded.",
    };
    },
}),
```

### 2.2 thinking 如何使用提示词
通用工具使用提示词:
 
```md
<AvailableTools>
7. **thinking(thought)** - Express your reasoning, analysis, and thought process
</AvailableTools>

<IntelligentAnalysisProcess>
**USE THINKING TOOL THROUGHOUT ANALYSIS**:
- Call thinking() to express your reasoning and strategy
- Use thinking() to analyze findings and plan next steps
- Call thinking() before major decisions or phase transitions
- Example: thinking("I need to search for X because Y, planning to start with...")
</IntelligentAnalysisProcess>

```