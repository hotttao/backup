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

至此我们对 API 形态的 Base Agent 实现做一个总结。

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