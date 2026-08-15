---
weight: 1
title: "Base Agent 设计"
date: 2026-07-01T22:00:00+08:00
lastmod: 2026-07-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Base Agent 抽象"
featuredImage:

tags: ["base_agent"]
categories: ["Agent"]

lightgallery: true
---

这个系列我们跟随一个项目 [neu-translator](https://github.com/neutree-ai/neu-translator) 从头设计实现一个 Agent Core。

整个过程我们希望达成两个目的:

1. 理解 Agent 设计的所有细节，而不是从一个巨大的几千几万行的代码，去理解做过高度抽象的代码
2. 关注 Agent 与用户的交互，从用户的反馈中提取偏好

而之所以选择这个项目，主要有以下几点思考:

1. 我们的重点是如何设计一个 Agent，而不是实现一个 Workflow，如果有小伙伴跟我一样是一个 Python 开发，你大概率看的第一个 Agent 框架是 Langgraph，那么你的注意力大概率会集中 Langgraph 中 Graph 抽象上。如果是这样，很容易偏离 Agent 的核心。
2. 这个项目本身有足够深的思考，包括如何实现一个 Agent、如何实现一个无状态的 AgentLoop、如何集成 Copilot Handler 的用户交互模式、如何实现一个同时支持 Cli 和 Web 形态的 Agent。

<!-- more -->

## 1. Agent 的核心组成

我们在前面[对比 Multi-Agent 与 Single-Agent](../agent_design/003_multi_agent.md) 时，就介绍了一个 Single-Agent 的核心组成。

结合我们对 Single-Agent 的理解，我们将 Agent 的设计分为如下几个部分

1. system prompt 设计
2. LLM API 封装
3. AgentLoop 实现:
   - 开发一个对应用友好的无状态的 AgentLoop
   - 集成 Copilot 交互模式
4. Context 管理:
   - 实现 sub agent、compact 等机制
5. tools definitions

## 1. system prompts 设计

参考 [Claude Code](../claude_code/001_cc.md)，system prompt 如下:

它分为如下几个部分:

```md
# Role

You are a professional translation assistant; working with the user, translate files completely and ensure translations meet user requirements.

# Typical workflow:

- Use the 'LS' tool to find files to translate. NOTE: if the user hasn't provided a target directory, confirm the target directory first.
- Translate one file at a time.
- Before translating, always use the 'Read' tool to fetch the latest file contents.
- Use the 'Translate' tool to create translation units. Translate one paragraph at a time while preserving paragraph integrity (e.g., split by headings or lists in markdown). Keep each translated paragraph ≤ 300 characters.
- Translate from the first line to the end of the file; do not omit any content.
- The 'Translate' tool returns user-validated translations. Status 'Approve' or 'Refine' means the unit is complete; 'Reject' means re-translation is required.

If the user is unsatisfied they may reject a unit and provide additional context requesting re-translation.

# Tone and style

You should be concise, direct, and to the point.
You MUST answer concisely with fewer than 4 lines (not including tool use or code generation), unless user asks for detail.
IMPORTANT: You should minimize output tokens as much as possible while maintaining helpfulness, quality, and accuracy. Only address the specific query or task at hand, avoiding tangential information unless absolutely critical for completing the request. If you can answer in 1-3 sentences or a short paragraph, please do.
IMPORTANT: You should NOT answer with unnecessary preamble or postamble (such as explaining your code or summarizing your action), unless the user asks you to.
Do not add additional code explanation summary unless requested by the user. After working on a file, just stop, rather than providing an explanation of what you did.
Answer the user's question directly, without elaboration, explanation, or details. One word answers are best. Avoid introductions, conclusions, and explanations. You MUST avoid text before/after your response, such as "The answer is <answer>.", "Here is the content of the file..." or "Based on the information provided, the answer is..." or "Here is what I will do next...". Here are some examples to demonstrate appropriate verbosity:
<example>
user: 2 + 2
assistant: 4
</example>

<example>
user: what is 2+2?
assistant: 4
</example>

<example>
user: is 11 a prime number?
assistant: Yes
</example>

<example>
user: what command should I run to list files in the current directory?
assistant: ls
</example>

<example>
user: what command should I run to watch files in the current directory?
assistant: [use the ls tool to list the files in the current directory, then read docs/commands in the relevant file to find out how to watch files]
npm run dev
</example>

<example>
user: How many golf balls fit inside a jetta?
assistant: 150000
</example>

Output text to communicate with the user; all text you output outside of tool use is displayed to the user. Only use tools to complete tasks. Never use tools like Bash or code comments as means to communicate with the user during the session.
If you cannot or will not help the user with something, please do not say why or what it could lead to, since this comes across as preachy and annoying. Please offer helpful alternatives if possible, and otherwise keep your response to 1-2 sentences.
Only use emojis if the user explicitly requests it. Avoid using emojis in all communication unless asked.
IMPORTANT: Keep your responses short, since they will be displayed on a command line interface.

# Proactiveness

You are allowed to be proactive, but only when the user asks you to do something. You should strive to strike a balance between:

- Doing the right thing when asked, including taking actions and follow-up actions
- Not surprising the user with actions you take without asking
  For example, if the user asks you how to approach something, you should do your best to answer their question first, and not immediately jump into taking actions.

# Memory

${
currentMemory
? `# User preferences

The following preferences were emphasized in prior interactions; please follow them:
${currentMemory}`
: ""
}
```

1. 角色和身份设定
2. 典型工作流:
   - 对应 Claude Code 里 `Doing tasks / 执行任务` 和 `Tool usage policy / 工具使用策略`
3. Tone and style: 语气和风格，完全来自Claude Code
4. Proactiveness: 主动性，完全来自Claude Code
5. 记忆: Copilot 提取的用户记忆和偏好

#### `为什么要在系统提示词里描述每一步应该使用的工具呢?`

首先每个工具的描述里，大概率描述的是工具自身的用法，比如参数的细节、注意事项等等。但是工作流里面很可能是对多个工具的组合使用。工具与工具的集成关系是什么，谁在前谁在后，它们之间是**如何配合的**，**谁的返回值是谁的参数**。这些信息需要一个地方描述。这里描述的重点是 **工具和工具之间交集的部分、集成的部分**

特别是当我们面向一个具体场景设计 Agent 的时候，我们抽象的工作流是更加固定和具体的。 可能所设计的工具，就是为了完成工作流里的某一步。所以在工作流里面描述工作流要使用的工具是一个很自然的事情。

#### 为什么添加 Tone and style 和 Proactiveness

把这两段借鉴过来，是因为这两段对于 agent 自主独立的完成任务非常必要。提升效率也是最好的。

## 2. LLM API

LLM API 的选择上，项目选择的是 Vercel 的 AI SDK。原因是在类型的管理上以及多模型的适配上做的更好。借助 Vercel 的 AI SDK，我们更容易做成一个用户可选模型的 agent。注意这里选择 Vercel AI 的 provider 的时候，选择 `openai-compatible`，不要选择 `openai`。因为 `openai` 是 openai 的最新接口，其他模型不一定能保持兼容。

Python 实现里，我们选择 Pydantic AI 作为我们的 LLM API。

## 3. Context

```python
class Context:

    def __init__(self, messages: Sequence[ModelMessage] | None = None):
        pass

    def add_messages(self, messages: Sequence[ModelMessage]) -> None:
        pass

    def get_messages(self) -> list[ModelMessage]:
        return list(self._messages)

    def to_model_messages(self) -> list[ModelMessage]:
        """Return the active message window that should be sent to the model."""
        return list(self._active_messages)

    async def compact(self) -> dict[str, str]:
        """Use the compactor model to summarize the active conversation and replace
        the active history with a single summary message.

        Mirrors the TS `context.compact()`.
        """
```

Context 的设计里，我们预期 Context 里存的消息是为整个应用服务的。所以上下文里的 message 格式可能带有应用层的扩展字段（比如 UI 渲染标记、中间状态等），而这些字段是 LLM API 不需要的。

所以：

- `addMessages()` → 加入的 message 是用户输入的，完全可能包含拓展字段
- `getMessages()` → 返回完整消息给应用层用（渲染 UI 等）
- `toModelMessages()` → 剥离扩展字段，只保留 LLM API 需要的纯 `model message`

本质上就是**应用态消息**和**模型态消息**的解耦，两边各自自由扩展，互不干扰。

## 4. AgentLoop

现在大多数 Agent 框架的 AgentLoop 都是有状态的，状态都在框架的内部。由此衍生出一个问题: 外部的应用怎么观察 AgentLoop 的状态以及怎么控制这个状态。为了解决这个问题，大多数框架都会提供事件通知或者回调函数去介入 AgentLoop 的状态变化。但是这个方案有两个明显的问题:

1. 当状态变多的时候，需要暴露的事件就会越来越多
2. Agent App 本身也会有传统状态管理，跟 AgentLoop 的状态就会耦合在一起

最终 Agent 的应用就会变得难以维护。

这里的设计思路是

1. 让 Agent App(即应用侧) 去驱动 AgentLoop 执行
2. Agent Core 只需要保存 model messages 这一个状态。
3. Agent App 可以随时拿到 Agent Core 的状态和衍生状态。

![AgentLoop 架构图](/images/aigc/base_agent/ScreenShot_2026-08-09_213503_767.png)

### 4.1 agent core

1. **自行存储维护的核心状态（黄色区域）**
   只有一类状态：模型消息。
   LLM API最终需要的就是这部分数据。
   存储可以基于内存；做持久化，设计合适表结构存储即可。
   数据本身会有复杂度：消息之间顺序、消息分支、消息修改。但本质还是一组message分组，运行时选出当前上下文发给LLM后端API。

2. **计算派生出来的状态（绿色区域，由model message做纯函数计算得到，不需要存储）**

- actor：代表接下来谁处理消息，可选：模型 / 用户。
  如果actor是模型，可以驱动loop往前走一轮；如果actor是用户，把控制权交还给应用。
  重要设计：即便actor是模型，往下走一轮的动作，交给应用去触发，应用可以自动触发，以此保证更好的数据流向。

- 未被处理的工具调用：每一轮消息结束，计算出LLM发起但还没执行的tool call。
  > actor、未处理工具调用，全部由model messages派生而来，实际只需要存储model messages。

3. **工具执行的设计**
   存在未处理tool calls，就要执行工具，拿到结果，封装成message加入消息列表。
   工具执行会产生外部行为，执行过程程序可能挂掉。
   为保持无状态，agent core内部**不记录工具正在调用中的状态**。
   工具只有两种状态：没开始、已完成。
   如果执行中途崩溃，视为没开始，会重新调用。
   这个设计带来约束：**工具逻辑必须幂等**。
   举例：支付工具，如果不幂等，重试会发生重复支付。

### 4.2 agent APP（应用层）

应用可以拿到agent core的状态：model messages、actor、未处理tool calls。

1. **状态渲染**
   把这三者合并做渲染，输出用户可读UI。

- model messages → 渲染对话列表
- actor → 状态反馈：模型处理就展示处理中；轮到用户就弹出输入框
- 未处理工具调用 → 展示待处理工具提示

渲染是幂等的：相同输入，输出结果一致。

2. **处理交互式工具调用**
   存在Interactive交互式工具，例如翻译agent的copilot模式，需要用户参与交互。
   core产生交互请求，由agent APP响应，完成和用户交互后，把结果回传给core。

3. **应用层控制逻辑**

- actor为用户：接收用户新输入，把新消息追加到core的消息数组。
- 主动触发，让agent loop进入下一轮。

**这个实现最大的优点是所有的状态都是从 model messages 派生出来的，包括 Agent App 里的 UI 状态。这种数据来源的单一和状态的简单，使得 Agent 的实现更加简单和可维护。异常恢复的逻辑也变得更加简单。**


### 4.3 agent loop 实现

```python
class AgentLoop:
    def __init__(
        self,
        options: AgentLoopOptions | None = None,
        messages: list[ModelMessage] | None = None,
        model: Model | None = None,
    ):
        options = options or AgentLoopOptions()
        self.options = options

        self.context = Context(messages)
        self.tool_defs: list[ToolDefinition] = list(options.tool_defs or ALL_TOOLS)
        self.tool_executors: dict[str, ToolExecutor] = dict(
            options.tool_executors or DEFAULT_EXECUTORS
        )
        self.model = model or translator

    def user_input(self, messages: list[ModelMessage]) -> None:
        self.context.add_messages(messages)

    async def get_messages(self) -> list[ModelMessage]:
        return self.context.get_messages()

    async def get_unprocessed_tool_calls(self) -> list[ToolCallPart]:
        pass

    async def _execute_tool(
        self,
        part: ToolCallPart,
    ) -> ToolExecutorResult:
        pass

    # 执行一轮
    async def next(self) -> AgentStepResult:

        model_messages = self.context.to_model_messages()
        unprocessed_tool_calls = await self.get_unprocessed_tool_calls()

        # 1. model_messages 为空 -> 新对话 -> actor = user
        # 2. unprocessed_tool_calls 不为空 -> 执行工具调用 -> actor = model
        # 3. 发送 llm 请求
        #   空 response               -> actor = user
        #   last message is assistant -> actor = user
        #   有 tool call              -> actor = model
        # 4. 将 tool executor 结果或者 llm response 加入消息列表
```

### 4.4 Agent App 实现
Agent App 的 Hook 提供了 doNext，用来驱动 AgentLoop 的执行。

doNext:
1. AgentLoop.next 是单独的，doNext 是一个潜在多步
2. 每次调用 next 方法后，同步  AgentLoop 状态到 Agent App
3. doNext 驱动 Loop 执行直到 actor 为 user 

可以看到在 doNext 的循环内，我们可以拿到每一步的状态。

```js
  const doNext = useCallback(async () => {
    if (!agentLoopRef.current) {
      await initAgentLoop();
    }

    setCurrentActor("agent");

    while (runningRef.current && agentLoopRef.current) {
      try {
        // 1. 执行一个轮次，然后同步 AgentLoop 状态到 Agent App
        const agentResponse = await agentLoopRef.current.next();

        if (agentResponse.copilotRequests.length > 0) {
          setCopilotRequests(agentResponse.copilotRequests);
          break;
        }

        setCurrentActor(agentResponse.actor);

        const newMessages = await agentLoopRef.current.getMessages();
        setMessages(newMessages.slice());

        setUnprocessedToolCalls(agentResponse.unprocessedToolCalls);


        if (agentResponse.actor === "user") {
          break;
        }
      } catch (error) {
        const isAbortError =
          error instanceof Error && error.name === "AbortError";
        if (!isAbortError) {
          console.error("Error in agent loop:", error);
        }
        runningRef.current = false;
        setCurrentActor("user");
        break;
      }
    }
  }, [
    initAgentLoop,
    setCurrentActor,
    setMessages,
    setUnprocessedToolCalls,
    setCopilotRequests,
  ]);
```

至此，我们还有三个部分内容未处理:

1. 集成 Copilot 模式
2. Context 的管理
3. tool 的定义

这个我们下一节详细展开。
