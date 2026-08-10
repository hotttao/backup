---
weight: 1
title: "Base Agent Copilot Handler"
date: 2026-07-02T22:00:00+08:00
lastmod: 2026-07-02T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Base Agent 如何集成 Copilot Handler"
featuredImage:

tags: ["base_agent"]
categories: ["agent_core"]

lightgallery: true
---

为什么我们一直在强调 Copilot Handler 的重要性？因为 Copilot Handler 帮我实现:

1. 用户交互
2. 用户交互同时提供了一个时间点，让我们做记忆的提取

这个项目的背景是做一个翻译 Agent，所以其核心工具是一个叫 Translate 的工具。通过这个工具我们将学习:

1. 如何定义一个支持 Copilot Handler 的工具
2. 如何实现 Tool 工具等待用户反馈

<!-- more -->

## 1. Translate 工具

Translate 工具需要完成的需求是这样: 从要翻译的整篇内容内，逐段进行翻译。

逐段的要求是实现精准翻译:

1. 顺序翻译
2. 不能重复翻译
3. 不能遗漏翻译

### 1.1 Translate 的定义

Tool Description:

```md
# 翻译工具使用规则

为待翻译的文档创建翻译单元。根据当前上下文的要求，每次选择适量文本进行翻译。

翻译时，请遵循用户的要求，包括目标语言、语气和术语。

- 翻译某个文件之前，请确保在当前上下文中已使用 `Read` 工具读取了对应 ID 的文件，以便你掌握最新的文件内容。
- `src_string` 在原文中必须唯一；如果不唯一，翻译将失败。你可以通过扩大 `src_string` 的范围来保证唯一性。
- `src_string` 只应包含当前单元的内容，不得包含之前已翻译单元的内容，不能包含已经翻译过的内容。
- `translate_string` 是 `src_string` 的初步译文，应尽可能准确，以减少后续人工校对的工作量。
- 返回的 `translated_string` 是经过人工审核后的最终译文。
- `status` 表示人工审核状态，可为 `approve`（通过）、`reject`（拒绝）或 `refined`（用户手动调整）。
- 如果 `reject` 是因为 `src_string` 在原文中不存在，请核对所选单元，确保空格和换行符匹配。
- 如果 `reject` 是因为 `src_string` 不唯一，请逐步扩大范围，直到找到唯一匹配。
```

注意: src_string 必须唯一，是为了定位翻译已经翻译的位置。

### 1.2 System Prompt 约束

但是约束翻译行为不仅仅是在 Translate 的定义上，system prompt 也需要约束翻译行为。

```md
- 翻译前，务必使用“Read”工具获取文件的最新内容。
- 使用“Translate”工具创建翻译单元。每次翻译一个段落，并保持段落完整性（例如在Markdown中按标题或列表进行分割），每个翻译后的段落长度不超过300个字符。
- 从第一行开始翻译至文件末尾，不得遗漏任何内容。
- “Translate”工具返回经用户验证的翻译结果。“Approve”或“Refine”状态表示该单元已完成；“Reject”状态表示需要重新翻译。
```

### 1.3 工具校验 src_string 结果

Translate 工具里会校验 src_string 是否在原文中，以及出现的次数。校验的结果对应工具提示词 reject 的两个原因。

但是代码里面并没有对 src_string 是否包含翻译过的内容，是否跳过内容没有翻译没有校验。这两部分完全交给了 Translate 定义的提示词和 system prompt 来约束。我感觉这一部分其实也应该放在 Translate 工具的校验里。(这一部分其实做了校验，对应源代码里的 getContextualDisplay。但是没有作为错误返回，让模型重新生成。)

### 1.4 总结

至此我们对**支持 Copilot Handler 的工具**的实现做一个总结:

1. 模型输入什么，包括对模型输入的限定规则
2. 用户反馈什么
3. 模型对用户反馈的处理
4. 系统如何使用工具
5. 工具的实现要校验模型输入是否合法，输入校验是否合法可以在工具内，也可以在应用侧，因为应用侧也能拿到 Copilot Request。无论在哪里实现，最终校验失败的反馈都是 Copilot Response 提交给模型

## 2. 如何实现 Copilot

Copilot 的实现有多重方法，并且依赖 Agent App 的形态。我们 Copilot 的实现分成两种:

1. Tool 阻塞等待
2. Tool 不阻塞等待，Tool 的执行分为两个阶段在两次 Agent Loop 中完成。

第一种方式更加符合直觉，第二种不好理解，但是实现更优，其实现方式就是在 AgentLoop 内将 Tool 的执行从两阶段变成三阶段:

1. tool call
2. tool exec 返回 Copilot Request。Copilot Request 就是用户需要确认的内容。第一次 Loop 结束。
3. 第二次 Loop，Agent App 在用户交互完成后发起，拿到 user input 传给 tool exec。 tool 返回 result 即 Copilot Response。

对应 Translate 工具:

1. Copilot Request: 模型创建的翻译单元和翻译结果
2. Copilot Response: 用户确认的翻译结果

### 2.1 Tool 阻塞等待

Tool 阻塞等待的实现难点，如何分离 Tool 阻塞和用户确认的逻辑。

```js
export const useAgent = () => {

  const [copilotRequest, setCopilotRequest] = useState<CopilotRequest | null>(null);
  const copilotResolverRef = useRef<
    (value: CopilotResponse | PromiseLike<CopilotResponse>) => void | null
  >(null);

  const agentLoopRef = useRef<AgentLoop | null>(null);

  const initAgentLoop = useCallback(async () => {

      agentLoopRef.current = new AgentLoop({
        abortSignal: abortController.current.signal,
        copilotHandler: (req) => {
          setCopilotRequest(req);

          return new Promise((resolve) => {
            copilotResolverRef.current = resolve;
          });
        },
      });

    }
  };
```

工具的实现里面 `await copilotHandler(CopilotRequest)`

1. Agent App 可以拿到 Copilot Request
2. Tool 会阻塞等待，直到用户交互完成，copilotResolverRef 被 resolve
3. resolve 返回 Copilot Response
4. Tool 拿到 Copilot Response 后，继续执行，然后返回，Loop 继续。
