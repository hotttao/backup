---
weight: 1
title: "Base Agent - API 形态实现"
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

至此我们对 API 形态的 Base Agent 实现做一个总结。最后我们会讨论 Agent 的 Serverless 改造。

<!-- more -->

## 1. Agent 执行流程
API 形态:
1. UI: 实现 doNext，负责驱动 AgentLoop 的执行，实现多步执行的语义，每一次 AgentLoop 发起一次对 API 的 Post 请求，并更新 UI 侧状态。
2. API Server: 使用请求的 SessionID 重建 AgentLoop，执行一轮循环，并根据 AgentLoop 执行结果更新 Session

对比 TUI: TUI 初始化 AgentLoop，提供 doNext 方法驱动 AgentLoop 执行。

## 2. UI 

```js
export const useAgent = (initialSessionId?: string) => {
  const messages = useAgentStore((s) => s.messages);
  const addMessages = useAgentStore((s) => s.addMessages);
  const setMessages = useAgentStore((s) => s.setMessages);

  const unprocessedToolCalls = useAgentStore((s) => s.unprocessedToolCalls);
  const setUnprocessedToolCalls = useAgentStore(
    (s) => s.setUnprocessedToolCalls,
  );

  const currentActor = useAgentStore((s) => s.currentActor);
  const setCurrentActor = useAgentStore((s) => s.setCurrentActor);

  const copilotRequests = useAgentStore((s) => s.copilotRequests);
  const setCopilotRequests = useAgentStore((s) => s.setCopilotRequests);

  const doNext = async (
    params:
      | { type: "userInput"; input: string }
      | { type: "copilot"; responses: CopilotResponse[] },
  ) => {
    setCurrentActor("agent");

    let round = 1;

    while (runningRef.current) {
      try {
        const body = {
          sessionId: sessionIdRef.current,
        };
        if (round === 1) {
          Object.assign(body, {
            userInput: params.type === "userInput" ? params.input : undefined,
            copilotResponses:
              params.type === "copilot" ? params.responses : undefined,
          });
        }

        const { sessionId, agentResponse } = await fetch("/api/next", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: abortController.current?.signal,
        }).then(
          (res) =>
            res.json() as Promise<{
              sessionId: string;
              agentResponse: AgentResponse;
            }>,
        );

        round++;

        sessionIdRef.current = sessionId;
        // 根据响应维护 UI 状态

        if (
          agentResponse.copilotRequests &&
          agentResponse.copilotRequests.length > 0
        ) {
          setCopilotRequests(agentResponse.copilotRequests);
          break;
        } else {
          setCurrentActor(agentResponse.actor);

          addMessages(agentResponse.messages);

          setUnprocessedToolCalls(agentResponse.unprocessedToolCalls);

          if (agentResponse.actor === "user") {
            break;
          }
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
  };
```

### 2.1 Web UI 的 doNext 逻辑
同样维护 while 循环，循环会持续执行：只要当前 actor 仍然是 agent，就继续执行处理。
- TUI 的 `doNext`：本地持有 agentLoop 对象，直接调用对象的 `next()` 函数。
- Web UI 的 `doNext`：核心逻辑是发起一次 fetch 网络请求。

### 2.2 请求参数构造
1. **sessionId**：Web UI 特有参数。后端接口会返回 sessionId，客户端保存该引用，每次请求都携带。
2. 判断是否为**本轮循环的第一轮**（不等于对话的第一轮，每次触发对话都会开启一轮新循环）：
    - 如果是本轮循环第一轮：把用户输入 `userInput`，或者用户的 `copilotResponse` 放进请求参数，对应三类请求里的 user input、copilot response 两种场景。
    - 如果不是本轮循环第一轮（客户端驱动多次调用，例如连续工具调用）：**不再携带 userInput / copilotResponse**，避免服务端收到重复消息；请求只携带 sessionId，对应第三种 none 的场景。


### 2.3 处理接口返回结果
1. 如果返回类型为 `copilot`（接口返回的是 copilot request）：保存这份 copilot request，交由 useAgent hook 维护 UI 状态。
2. 如果是普通正常响应：维护当前 actor 消息、待处理 tool call。

### 2.4 消息存入 store
- TUI：每次调用 `getMessage` 获取全量消息，使用 `setMessage` 整体覆盖更新 store。
- Web UI：接口返回增量消息，调用 `addMessage` 追加写入 store。

### 2.5 循环退出条件
- actor 变为 user，跳出循环。
- 收到 copilot 请求，跳出循环。

### 2.6 核心差异总结
- TUI 的 `doNext`：本地函数调用完成业务逻辑。
- Web UI 的 `doNext`：通过网络API请求完成业务逻辑，配套做了参数、消息更新逻辑改造。

 
## 3. API Server 

```js

export async function POST(req: Request) {
  try {
    const {
      copilotResponses,
      sessionId,
      userInput,
    }: {
      sessionId?: string;
      userInput?: string;
      copilotResponses?: CopilotResponse[];
    } = await req.json();

    const { env } = getCloudflareContext();
    const storage = new D1SessionStorage(env.DB);
    const sessionManager = new SessionManager(storage);

    // 1. 从请求的 sessionId 查询上一次的对话消息
    const session = sessionId
      ? await sessionManager.getSession(sessionId)
      : await sessionManager.createSession();

    if (!session) {
      return new Response(`Session "${sessionId}" not found`, { status: 404 });
    }
    // 2. 重建 AgentLoop 状态
    const agentLoop = new AgentLoop(
      {
        abortSignal: req.signal,
      },
      session.messages,
    );

    if (userInput) {
      const userMessages: UserModelMessage[] = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userInput,
            },
          ],
        },
      ];
    //   维护 Session 状态
      // 1. 数据库的持久化操作
      await sessionManager.addMessages(session.id, userMessages);
      // 2. 内存里的状态更新。
      // 所以虽然有两个 message 的存储过程，但是因为不是两个持久化的需求，所以就不要处理事务的一致性的问题了
      await agentLoop.userInput(userMessages);
    }

    if (copilotResponses) {
      await sessionManager.addCopilotResponses(session.id, copilotResponses);
      await agentLoop.addCopilotResponses(copilotResponses);
    }

    const res = await agentLoop.next();

    await sessionManager.addMessages(session.id, res.messages);

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        agentResponse: res,
      }),
      { status: 200 },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 },
    );
  }
}

```

## 4. Agent Serverless 改造

我们通过架构调整，让 **Web UI + API Server 形态的 Agent** 支持完整的 Serverless 部署。总体来看，Agent 类应用非常适配 Serverless 基础设施，核心就是利用 Serverless 的核心特性：**无流量缩容到 0、有流量自动弹性扩容**，以此实现更低成本、更高弹性的运行模式。

通过将 Agent 依赖的能力进行拆分，可以让 Agent 本体做到**纯无状态计算**。

### 4.1 模型能力解耦
模型服务天然就是独立部署的，Agent 通过 API 远程调用模型。
模型算力、推理扩容、资源开销完全与 Agent 运行时解耦，不占用 Agent 实例生命周期。

### 4.2 会话存储解耦
Web/API 形态的 Agent 需要持久化多轮对话、会话状态。
我们将 Session 存储能力从 Agent 业务逻辑中完全抽离，独立部署、独立适配存储后端。

为配合无状态 Agent 计算层，需要对 Session 层做了可插拔存储改造。目标是让 Session **存储后端可灵活替换、多场景适配**。

实现也并不复杂，我们只要定义好 Session 的接口，提供不同的具体实现即可。

最终实现：**计算层完全无状态，状态层可插拔、可扩展、多环境自适应**。

### 4.3 核心计算无状态化
剥离模型调用、持久化存储之后，Agent 仅剩纯计算逻辑：
- Agent Loop 单次步骤执行逻辑
- 消息处理、解析、流转

这部分**完全无状态**，天然支持横向扩容，满足 Serverless 运行要求。

### 4.4 核心难点：执行时长限制
所有主流 Serverless 平台（AWS Lambda、Cloudflare Workers 等）都有**单次执行时长上限**，原因是：
Serverless 的低成本、缩容到 0 的能力，依赖「每一次请求都是短生命周期」。因为如果服务长期存在，就会变成一个常驻副本。对于云平台就没有成本优势了。

多数开源 Agent 框架采用**一次请求跑完完整任务**：`用户输入 → 多轮循环、工具调用、推理 → 最终出结果`。

问题非常明显：简单 RAG 任务尚可，但复杂任务（Deep Research、多步骤复杂工作流）可能**运行数十分钟**，完全无法适配 Serverless 超时限制。

### 4.5 Agent Loop 单步执行模式
我们改造了 Agent 的运行模型：**Agent 的每一步 Loop 执行，对应一次独立的 Serverless 请求。**

特点：
1. **单次执行粒度极小**，不会触发平台超时限制
2. **执行完即销毁**，无需常驻进程等待处理、或者维护内存里的状态
3. **所有状态外置 Session 存储**，永不丢失
4. 客户端可基于上一步状态，**随时发起，让计算的负载继续运行**

通过这种分步执行的设计，长耗时 Agent 任务可以被拆分为大量短耗时请求，完美适配 Serverless 运行模型。

### 4.6 Session 的抽象设计
不希望框架强绑定某一种存储实现（文件、Postgres、Cloudflare D1/R2/KV等），要同时兼容 API‑Server、本地 CLI 等多种客户端形态，因此做存储层抽象改造。

#### 核心目标
1. **存储后端可插拔替换**：同一套上层 Agent 业务逻辑，可以切换不同存储实现（D1、R2、KV、文件、Postgres）。
2. **多客户端适配**：API Server 使用数据库，本地 CLI 可以直接使用文件存储。
3. 把 **Agent 业务语义** 和 **底层存储实现** 解耦，上层业务不感知底层是数据库/对象存储/文件。

将存储分为三层分层:

```
SessionManager (Agent业务语义层：addMessage/addCopilotMessage)
        ↓ 调用
SessionStorageInterface (中立CRUD：create/get/update/list/delete)
        ↓ 实现
D1SessionStorage / FileSessionStorage / KVSessionStorage …
        ↓ 使用 Drizzle ORM（数据库场景）
底层存储：Cloudflare D1 / 文件 / KV / R2 / Postgres
```

两个抽象的分工:
1. **`SessionStorageInterface`**：解决「Agent业务 ↔ 存储」的语义鸿沟，面向所有存储类型（数据库、对象存储、文件）。
2. **Drizzle ORM**：只解决「不同数据库之间」的语法、驱动差异。

#### 1. Session 数据模型
扩展 Session 类型，除 id、messages、copilot messages 之外，新增创建时间、最后更新时间等元数据。

```js
export type Session = {
  id: string;
  messages: Context["messages"];
  copilotResponses: Context["copilotResponses"];
  createdAt: Date;
  updatedAt: Date;
};

export type SessionListItem = {
  id: string;
  messageCount: number;
  copilotResponseCount: number;
  createdAt: Date;
  updatedAt: Date;
};
```

#### 2. SessionStorage Interface
> 隔离 Agent 业务语义与底层存储能力，定义一套与业务无关的通用 CRUD 接口：`create / get / update / list / delete`。

- 上层 `SessionManager`：承载 Agent 业务语义，对外提供 `createSession`、`getSession`、`addMessage`、`addCopilotMessage` 这类面向 Agent 的业务方法。
  - 内部并不直接操作数据库/文件，而是调用下层 `SessionStorageInterface` 的通用 CRUD。
  - 完成业务校验、消息拼接、元数据更新等逻辑。
- 下层各类存储驱动实现：实现 `SessionStorageInterface`，把通用 CRUD 翻译成对应存储的原生操作（SQL、文件读写、对象存储API）。

> 关键点：数据库/文件本身没有 `addCopilotMessage` 这种 Agent 业务接口；通过中间这层接口做语义转译，上层业务不需要感知底层存储差异。

#### 3. 数据库差异化抹平：Drizzle ORM
即使同为数据库，SQLite(D1)、Postgres、MySQL 之间依然存在语法、驱动差异，引入 Drizzle ORM 进一步屏蔽数据库差异：
1. 定义统一 Table Schema，D1 基于 SQLite，切换到 Postgres 时代码改动很小。
2. Schema 变更可通过 Drizzle CLI 自动生成 migration 迁移 SQL 文件，管理表结构迭代。
