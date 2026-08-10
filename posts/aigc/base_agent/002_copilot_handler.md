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

Copilot Handler 表达的是一种 Agent 与 人交互的流程:
1. Copilot Request 不是 http 的请求，指代模型生成的，需要用户确认的内容
2. Copilot Response 是用户确认后的内容

为什么我们一直在强调 Copilot Handler 的重要性？是因为 Copilot 实现交互的同时，提供了一个时间点，执行记忆的提取。

这个项目的背景是做一个翻译 Agent，所以其核心工具是一个叫 Translate 的工具。通过这个工具我们将学习:

1. 如何定义一个支持 Copilot Handler 的工具
2. 如何实现 Copilot Handler
<!-- more -->

## 1. Translate 工具

Translate 工具需要完成的需求是这样: 从要翻译的整篇内容内，逐段进行翻译。

逐段的要求是实现精准翻译:

1. 顺序翻译
2. 不能重复翻译
3. 不能遗漏翻译

对应 Translate 工具:

1. Copilot Request: 模型创建的翻译单元和翻译结果
2. Copilot Response: 用户确认的翻译结果

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
2. Tool 不阻塞等待，Tool 的执行分为两个阶段**在两次 Agent Loop** 中完成。下称多轮实现

第一种方式更加符合直觉，第二种不好理解，但是实现更优，其实现方式就是在 AgentLoop 内将 Tool 的执行从两阶段变成三阶段:

1. tool call
2. tool exec 返回 Copilot Request。第一次 Loop 结束，此时 actor="user"。
3. 第二次 Loop，Copilot Response 作为参数传给 tool exec。 tool 执行完成返回 result。

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

## 3. API 形态的 Agent
在继续介绍 Tool 的多轮实现之前。我们先来对比一下 TUI 和 API 两种形态下 Agent 通信的差异。在这里去讲解这个这个问题，可以让我们更好的理解这个差异，以及 Tool 多轮调用的实现。
### 3.1 TUI VS API

|TUI|API| 
|:---|:---|
|![TUI](/images/aigc/base_agent/cli.png) | ![API](/images/aigc/base_agent/api.png)|

### 3.2 TUI 的通信过程

TUI终端界面与Agent核心控制逻辑运行在**同一个进程**，二者通过普通函数调用交互，数据直接在内存交换。

1. **执行流程**
 - 每一轮循环由TUI调用agent‑core的`next`函数；`next`返回当前角色actor、待处理工具调用给TUI，用于界面渲染或触发下一轮逻辑；
 - 调用完成后TUI再调用`get message`，获取完整消息用于UI展示。

2. **消息存储**
  - agent‑core内部维护context管理器，保存两套消息：完整对话消息、经过压缩后实际传给大模型的消息；
  - TUI通过`get message`拿到context内的全量消息，渲染消息列表，按消息类型做样式展示，这是CLI形态的实现逻辑。

3. **两大关键特点**
  - 同进程内存交互，无需序列化，每轮取回全量消息成本低、效率高；
  - **agent‑core生命周期与进程绑定**，进程不销毁实例就持续存活，可反复调用`next`推进Agent循环。

### 3.3 API 的通信过程

#### Web UI + API 前后端分离架构:
1. AgentLoop 和 Agent App 之间要**使用网络来传输**。走网络传输，意味着不能每次循环全量获取消息
2. Agent Core 的生命周期不在和进程绑定，可以有两种处理方式:
  - **AgentCore生命周期绑定单次HTTP请求**，请求结束实例就销毁；
  - 维护一个有状态的 Agent Core。因为不确定 Web UI 是否存储，就需要处理客户端存活检测、状态管理。

更加生产可用的方式是让 AgentCore 跟随请求生命周期，通过架构设计去解决由此带来的各类问题。

#### **Copilot实时交互适配难点**

- CLI模式下，所有的交互都在一个进程内，我们可以让 Tool 无限阻塞等待用户反馈。
- Web模式下:
  - 无法在单个API请求内无限等待客户端返回。
  - Copilot 的交互过程是，`server —> copilot request -> ui -> copilot response -> server`，所以 sse 不行
  - 即便用 WebSocket 双向通道模拟 await Promise 的写法，也会显著提升复杂度，需要维护请求内有状态Promise与额外双向链路。

这里需要特殊的技巧(`Promise.race`)融合Agent主逻辑与Copilot交互逻辑，后续会展开讲解。下面我们就会讲解 `Promise.race` 的实现，作为对比就能体现多轮实现的优势。

#### **Session会话管理**
- CLI：客户端与AgentCore一一对应，全局仅有一个实例。
- Web+API：服务端对接多个Web客户端，一对多关系；多个用户同时访问，后端同时存在多个session，每个session保存独立的AgentCore与上下文context。


### 3.4 技术选型
#### Agent Core 放在前端还是后端

1. **与大模型交互的安全性**
agent core 是实际和大模型进行交互的模块，部署在后端更加合理、安全。

也可以由后端做路由转发API，前端间接调用大模型。
但该方案依旧会暴露所使用的模型、原始调用信息。
转发接口会变成通用推理API，后端接口需要增加多层防护，防止被滥用。

2. **商用场景，保护核心业务逻辑**
面向商用级别的 Agent 产品，希望 agent core 核心业务逻辑对用户不可见。
用户只看到最终结果，不希望暴露每一步内部调用过程。
一旦逻辑暴露，agent core 的实现细节容易被逆向分析。

agent core 部署后端，仅向UI输出运行结果，可以更好保护内部逻辑。

3. **上下文 context 状态管理与持久化**
agent core 内部持有完整 context，包含两部分数据：
- 当前 session 对话全部 message
- 经过压缩处理、实际发给AI的消息

做具备持久化能力的正式应用，无论 agent core 放前端还是后端，后端都必须保存一份 context。

如果 agent core 放在前端：
需要由前端主动完成消息上报。
把核心有状态逻辑交给UI控制并不稳定：
- UI上报过程中断，后端无法补齐消息，造成消息残缺
- 前端消息非幂等上报，会造成后端记录错乱

因此将有状态的核心 context 管理放在后端。

#### Agent 使用短生命周期设计
第二个决策，将 agent core 设置为短生命周期。

agent core 的整个生命周期运行在单次 API 请求内部：
- 请求开始：新建一个 agent core 对象
- 请求结束：agent core 对象随之销毁

因此每次重建 agent core 对象时，都需要传入本次对话历史消息，以此重建状态，执行后续逻辑，最后返回结果。

这就是无状态 agent core 的优势：**所有状态全部外置**，仅需要在一次 API 请求内短暂存活即可。

agent core 自身保持无状态，那么多次 API 请求之间（第1次、第2次、第3次调用），需要专门组件维护多轮调用之间共享的对话消息。

```js
// 1. 从请求的 sessionId 查询上一次的对话消息
const session = sessionId
  ? sessionManager.getSession(sessionId)
  : sessionManager.createSession();

if (!session) {
  return new Response(`Session "${sessionId}" not found`, { status: 404 });
}

// 2. 重建状态
const agentLoop = new AgentLoop({
  abortSignal: req.signal,
  copilotHandler: async (copilotReq) => { /* ... */ },
},
  session.messages
);
```

#### API 设计
相比 CLI 模式，Web 前后端分离架构对 `next` 接口返回做了两处关键增强：
1. 返回本轮增量新消息 new message，**不再每次请求拉取全量消息**。
2. 每条对话对应唯一 sessionId，随 `next` 接口返回

即使 `next` 请求意外中断、响应丢失，前端也可通过 **sessionId 重新拉取全量消息**，恢复对话状态，保证会话稳定。


## 4. Promise.race 实现 Copilot Handler
### 4.1 实现原理
Promise.race 是把一次 AgentLoop 的执行拆成了两段去执行:

1. 第一步 Copilot Handler 被调用，返回 Copilot Request，此时AgentLoop 就被丢弃了。丢弃的方法就是 Promise.race 里协程自动销毁。
2. 第二步 用户带着 Copilot Response 再次请求，这个时候 Copilot 工具正常返回，AgentLoop 正常执行。

### 4.2 执行过程解读
逻辑比较绕，我们对着代码来看:

```js
export async function POST(req: Request) {
  const {
    copilotResponse,
    sessionId,
    userInput,
  }: {
    sessionId?: string;
    userInput?: string;
    copilotResponse?: CopilotResponse;
  } = await req.json();

  const session = sessionId
    ? sessionManager.getSession(sessionId)
    : sessionManager.createSession();

  if (!session) {
    return new Response(`Session "${sessionId}" not found`, { status: 404 });
  }

  const { resolve: copilotResolver, promise: copilotPromise } =
    Promise.withResolvers<AgentResponse>();

  const agentLoop = new AgentLoop(
    {
      abortSignal: req.signal,
      copilotHandler: async (copilotReq) => {
        if (copilotResponse) {
          return copilotResponse;
        }

        copilotResolver({
          type: "copilot",
          result: copilotReq,
        });

        throw new Error("abort");
      },
    },
    session.messages
  );
    //  
    const res = await Promise.race([
    copilotPromise,
    agentLoop.next().then<AgentResponse>((result) => ({
      type: "normal",
      result,
    })),
  ]);

  if (res.type === "normal") {
    sessionManager.addMessages(session.id, res.result.messages);
  }

  return new Response(
    JSON.stringify({
      sessionId: session.id,
      agentResponse: res,
    }),
    { status: 200 }
  );
}
```

Promise.race([p1, p2])：传入多个 Promise，返回一个新 Promise。哪个 Promise 最先完成（resolve /reject），就采用它的结果，其余 Promise 会继续在后台执行，但结果会被忽略。

所以这个 Post 请求会返回两种 Response:
1. copilotPromise 被 resolve 时，返回 Copilot Request
2. agentLoop.next() 被 resolve 时，返回正常 Response

一次完整的 Copilot Handler 执行流程如下:


**第一次 Post，没有 Copilot Response**
1. AgentLoop.next() 执行工具调用，工具内部 `await copilotHandler(copilotReq)`。
2. 此时 copilotResolver 被调用，copilotPromise 被 resolve，res 返回 Copilot Request。
3. copilotResolver 被调用之后，执行 `throw new Error("abort");` AgentLoop.next() 直接异常退出
4. Promise.race 中 copilotPromise "胜出"，AgentLoop 异常退出。
5. post 请求返回 Copilot Request。

**第二次 Post，有 Copilot Response**
1. AgentLoop.next() 执行工具调用，工具内部 `await copilotHandler(copilotReq)`
2. copilotHandler 返回 Copilot Response，工具正常执行返回
3. Promise.race 中 agentLoop.next() "胜出"，copilotPromise 会一直阻塞，AgentLoop 正常执行。
4. post 请求返回正常 Response。

### 4.3 Promise.race 问题
1. 打破了 AgentLoop 每次执行一轮的语义。这是 Promise.race 和多轮调用的核心区别，在多轮调用里，AgentLoop 是正常返回的。
2. 每次只能处理一个 Copilot Handler
3. 代码复杂

## 5. 多轮调用
多轮调用里，AgentLoop 内将 Tool 的执行从两阶段变成三阶段:

1. tool call
2. tool exec 返回 Copilot Request。第一次 Loop 结束，此时 actor="user"。
3. 第二次 Loop，Copilot Response 作为参数传给 tool exec。 tool 执行完成返回 result。

