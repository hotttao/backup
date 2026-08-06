---
weight: 1
title: "deerflow 整体架构"
date: 2025-08-14T8:00:00+08:00
lastmod: 2025-08-14T8:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "deerflow 整体架构"
featuredImage: 

tags: ["mcp"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

前面我们已经学习了 langchain、langgraph、mcp，现在我们通过 [deerflow](https://github.com/bytedance/deer-flow/blob/main/README_zh.md) 这个开源项目，来系统的学习如何开发一个 AI Agent。

## 1. 项目结构

下面是 deerflow 的项目结构
1. web: react 实现的前端
2. src: agent 后端代码
3. server.py: 后端服务启动的入口

这一节我们核心关注以下几点:
1. 前端代码的结构: 有哪些模块，每个模块的作用
1. 后端代码的结构: 有哪些模块，每个模块的作用
2. 前后端交互接口: 从功能角度了解，接口之间的调用关系

```bash
ls -l --group-directories-first
总用量 636
drwxr-xr-x  2 tao tao   4096  8月 17 21:45 assets
drwxr-xr-x  2 tao tao   4096  8月 17 21:45 docs
drwxr-xr-x  2 tao tao   4096  8月 17 21:45 examples
drwxr-xr-x 16 tao tao   4096  8月 17 21:45 src
drwxr-xr-x  4 tao tao   4096  8月 17 21:45 tests
drwxr-xr-x  6 tao tao   4096  8月 17 21:45 web
-rw-r--r--  1 tao tao    497  8月 17 21:45 bootstrap.bat
-rwxr-xr-x  1 tao tao    589  8月 17 21:45 bootstrap.sh
-rw-r--r--  1 tao tao   1406  8月 17 21:45 conf.yaml.example
-rw-r--r--  1 tao tao   3130  8月 17 21:45 CONTRIBUTING
-rw-r--r--  1 tao tao    700  8月 17 21:45 docker-compose.yml
-rw-r--r--  1 tao tao    665  8月 17 21:45 Dockerfile
-rw-r--r--  1 tao tao    297  8月 17 21:45 langgraph.json
-rw-r--r--  1 tao tao   1092  8月 17 21:45 LICENSE
-rw-r--r--  1 tao tao   4879  8月 17 21:45 main.py
-rw-r--r--  1 tao tao    486  8月 17 21:45 Makefile
-rwxr-xr-x  1 tao tao    563  8月 17 21:45 pre-commit
-rw-r--r--  1 tao tao   1714  8月 17 21:45 pyproject.toml
-rw-r--r--  1 tao tao  25948  8月 17 21:45 README_de.md
-rw-r--r--  1 tao tao  24610  8月 17 21:45 README_es.md
-rw-r--r--  1 tao tao  25354  8月 17 21:45 README_ja.md
-rw-r--r--  1 tao tao  24810  8月 17 21:45 README.md
-rw-r--r--  1 tao tao  23387  8月 17 21:45 README_pt.md
-rw-r--r--  1 tao tao  36743  8月 17 21:45 README_ru.md
-rw-r--r--  1 tao tao  20367  8月 17 21:45 README_zh.md
-rw-r--r--  1 tao tao   2707  8月 17 21:45 server.py
-rw-r--r--  1 tao tao    725  8月 17 21:45 test_fix.py
-rw-r--r--  1 tao tao 367953  8月 17 21:45 uv.lock

```

## 2. 前端代码结构

```bash
# 一开始我以为页面的流式输出是通过 websocket 实现的，所以我在这个问题之前问了
#   找到 web 目录下前端代码，实现 websocket 的代码在哪
# 所以下面的回答明确指出了：项目使用 Server-Sent Events (SSE) 而非 WebSocket 实现实时通信：
提问:
1. 请分析 web 下面这个前端项目，包括项目分成哪些模块，每个模块的作用
```

通过对 deer-flow 项目 web 目录下前端代码的分析，我发现这是一个基于 Next.js 框架开发的现代化 Web 应用，主要用于提供多智能体协作的聊天和研究功能。下面是对项目模块结构和各模块功能的详细分析：

项目技术栈:

- **框架**：Next.js（React框架）
- **状态管理**：Zustand
- **UI组件库**：基于 Radix UI 的自定义组件
- **样式**：Tailwind CSS
- **通信**：Server-Sent Events (SSE) 而非 WebSocket
- **国际化**：next-intl
- **编辑器**：TipTap

### 2.1 核心模块
#### app 模块

这是 Next.js 应用的主要页面组件所在地，采用了 App Router 架构：

- **chat/**：聊天界面相关组件
  - **components/**：聊天界面的各个组件（消息列表、输入框、研究活动块等）
  - **main.tsx**：聊天主界面布局
  - **page.tsx**：聊天页面入口

- **landing/**：落地页相关组件
  - **components/**：落地页的各个组件（大标题、多智能体可视化等）
  - **sections/**：落地页的各个区块（案例研究、核心功能等）
  - **store/**：落地页状态管理

- **settings/**：设置相关组件
  - **dialogs/**：设置对话框组件
  - **tabs/**：设置页的各个标签页（通用、MCP、关于等）

#### components 模块

包含可复用的 UI 组件：

- **deer-flow/**：项目特定的组件
  - **icons/**：自定义图标
  - **markdown.tsx**：Markdown 渲染组件
  - **message-input.tsx**：消息输入组件
  - **theme-toggle.tsx**：主题切换组件
  - 其他项目特定组件

- **editor/**：富文本编辑器相关组件
  - **extensions.tsx**：编辑器扩展
  - **generative/**：AI 生成相关功能
  - **selectors/**：编辑器选择器组件

- **magicui/**：特效 UI 组件（如光晕文本、闪烁网格等）

- **ui/**：基础 UI 组件（基于 Radix UI 构建）
  - 按钮、卡片、对话框、下拉菜单等基础组件

#### core 模块

应用的核心逻辑和功能：

- **api/**：API 调用相关
  - **chat.ts**：聊天 API
  - **mcp.ts**：MCP（可能是 Model Control Panel）API
  - **rag.ts**：检索增强生成 API
  - **types.ts**：API 类型定义

- **config/**：配置相关

- **mcp/**：MCP 相关功能
  - **schema.ts**：MCP 模式定义
  - **types.ts**：MCP 类型定义
  - **utils.ts**：MCP 工具函数

- **messages/**：消息处理
  - **merge-message.ts**：消息合并逻辑
  - **types.ts**：消息类型定义

- **rehype/**：Markdown 处理相关

- **replay/**：回放功能

- **sse/**：Server-Sent Events 实现
  - **fetch-stream.ts**：流式数据获取
  - **StreamEvent.ts**：流事件定义

- **store/**：状态管理
  - **settings-store.ts**：设置状态
  - **store.ts**：主要应用状态

- **utils/**：工具函数

#### hooks 模块

自定义 React Hooks：

- **use-intersection-observer.ts**：交叉观察器 Hook
- **use-mobile.ts**：移动设备检测 Hook

#### styles 模块

全局样式和特定组件样式：

- **globals.css**：全局样式
- **prosemirror.css**：编辑器样式

### 2.2 核心功能实现

#### 聊天流实现

项目使用 Server-Sent Events (SSE) 而非 WebSocket 实现实时通信：

- **core/api/chat.ts** 中的 `chatStream` 函数：处理与后端 `/chat/stream` 接口的流式通信
- **core/sse/fetch-stream.ts** 中的 `fetchStream` 函数：实现 SSE 流式数据获取
- **core/sse/StreamEvent.ts**：定义流事件接口

#### 状态管理

使用 Zustand 进行状态管理：

- **core/store/store.ts**：定义主要应用状态和操作
- **core/store/settings-store.ts**：管理应用设置

#### 消息处理

- **core/messages/types.ts**：定义消息、工具调用等类型
- **core/messages/merge-message.ts**：处理消息合并逻辑

### 2.3 UI 组件

- **app/chat/components/message-list-view.tsx**：消息列表视图，处理消息展示和交互
- **app/chat/components/messages-block.tsx**：消息块组件
- **app/chat/components/research-block.tsx**：研究块组件

### 2.4 特色功能

1. **多智能体协作**：支持多个智能体（coordinator、planner、researcher、coder、reporter等）协同工作

2. **研究功能**：支持研究计划、研究活动和研究报告

3. **资源引用**：支持引用外部资源

4. **流式响应**：使用 SSE 实现流式响应，提供更好的用户体验

5. **主题切换**：支持明暗主题切换

6. **国际化**：支持多语言（使用 next-intl）

7. **回放功能**：支持会话回放


## 3. 后端代码结构

deer-flow 是一个基于 LangGraph 构建的通用 agent 框架，项目分为以下主要模块：

- **graph**: 负责构建和管理工作流图，定义了各个节点（如 planner、researcher、coder 等）及其之间的连接关系。
  - `builder.py`: 定义了图的构建方法
  - `nodes.py`: 实现了各个节点的具体功能
  - `types.py`: 定义了状态类型

- **agents**: 提供 agent 的创建和管理功能。
  - `agents.py`: 定义了创建 agent 的工厂函数

- **llms**: 负责语言模型的封装和调用。
  - `llm.py`: 提供获取不同类型 LLM 的接口

- **prompts**: 存储各种提示模板。
  - 包含 coordinator、planner、researcher、reporter 等角色的提示模板
  - `template.py`: 提供应用提示模板的功能
  - `planner_model.py`: 定义计划模型

- **rag**: 实现检索增强生成功能。
  - `ragflow.py`: RAGFlow 提供者的实现
  - `retriever.py`: 检索器接口和实现
  - `builder.py`: 构建检索器

- **tools**: 提供各种工具函数。
  - `search.py`: 搜索工具
  - `crawl.py`: 网页爬取工具
  - `python_repl.py`: Python REPL 工具
  - `retriever.py`: 检索工具

- **server**: 提供 API 服务。
  - `app.py`: FastAPI 应用定义和路由
  - `chat_request.py`: 聊天请求数据模型
  - `rag_request.py`: RAG 请求数据模型

### 1.2 扩展模块

- **crawler**: 网页爬取和内容提取。
  - `crawler.py`: 爬虫实现
  - `article.py`: 文章处理
  - `readability_extractor.py`: 可读性提取器

- **podcast**: 播客生成功能。

- **ppt**: PPT 生成功能。

- **prompt_enhancer**: 提示增强功能。

- **prose**: 散文生成功能。

- **config**: 配置管理。
  - `configuration.py`: 配置类
  - `loader.py`: 配置加载器

- **utils**: 工具函数。
  - `json_utils.py`: JSON 处理工具


## 4. 前后端交互接口
要了解 deerflow 首先需要再本地部署一个环境。部署方法在官方文档由详细介绍，比较简单，这里不在赘述。

通过在浏览器内捕获网络请求，并结合前面的分析，我们可以发现前后端交互的核心接口: chat/stream。

### 4.1 前端请求
如前所述，项目使用 Server-Sent Events (SSE) 而非 WebSocket 实现实时通信：
- **core/api/chat.ts** 中的 `chatStream` 函数：处理与后端 `/chat/stream` 接口的流式通信
- **core/sse/fetch-stream.ts** 中的 `fetchStream` 函数：实现 SSE 流式数据获取
- **core/sse/StreamEvent.ts**：定义流事件接口

react 我不是很熟悉，所以我们直接让 ChatGpt 帮我们解释前端代码的实现。

#### chat.ts
chat.ts:
1. 主入口是 chatStream 函数
2. 其他定义的函数都在实现 reply，用于“回放模式”下模拟对话流。
3. 正常请求会通过 fetchStream 函数，发起 SSE 请求
4. chatStream 的入参都是直接传递给后端请求，所以这些参数的具体含义，我们在看后端代码时在详细介绍。

```ts
// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { env } from "~/env";

import type { MCPServerMetadata } from "../mcp";
import type { Resource } from "../messages";
import { extractReplayIdFromSearchParams } from "../replay/get-replay-id";
import { fetchStream } from "../sse";
import { sleep } from "../utils";

import { resolveServiceURL } from "./resolve-service-url";
import type { ChatEvent } from "./types";

/**
 * chatStream 函数：
 * - 这是一个异步生成器 (async generator)，用于处理聊天流式输出。
 * - 逻辑：
 *   1. 如果处于“静态网站 / mock / replay”模式，就会使用 `chatReplayStream` 返回本地预设的流。
 *   2. 否则，调用 `fetchStream` 从服务端请求真实的聊天流。
 *   3. 循环读取 SSE 流事件，转化为 `ChatEvent`，逐步 yield 给调用方。
 */
export async function* chatStream(
  userMessage: string,
  params: {
    thread_id: string;
    resources?: Array<Resource>;
    auto_accepted_plan: boolean;
    max_plan_iterations: number;
    max_step_num: number;
    max_search_results?: number;
    interrupt_feedback?: string;
    enable_deep_thinking?: boolean;
    enable_background_investigation: boolean;
    report_style?: "academic" | "popular_science" | "news" | "social_media";
    mcp_settings?: {
      servers: Record<
        string,
        MCPServerMetadata & {
          enabled_tools: string[];
          add_to_agents: string[];
        }
      >;
    };
  },
  options: { abortSignal?: AbortSignal } = {},
) {
  if (
    env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY || // 如果是静态网站模式
    location.search.includes("mock") ||    // URL 包含 mock 参数
    location.search.includes("replay=")    // URL 包含 replay 参数
  ) 
    // 切换到回放模式
    return yield* chatReplayStream(userMessage, params, options);
  
  try{
    // 正常情况下，发起 SSE 请求
    const stream = fetchStream(resolveServiceURL("chat/stream"), {
      body: JSON.stringify({
        messages: [{ role: "user", content: userMessage }],
        ...params,
      }),
      signal: options.abortSignal,
    });
    
    // 遍历流事件，逐个输出
    for await (const event of stream) {
      yield {
        type: event.event,
        data: JSON.parse(event.data),
      } as ChatEvent;
    }
  }catch(e){
    console.error(e);
  }
}

/**
 * chatReplayStream 函数：
 * - 用于“回放模式”下模拟对话流。
 * - 逻辑：
 *   1. 根据 URL 参数决定回放文件路径（mock 或 replay）。
 *   2. 从本地文件加载 replay 内容。
 *   3. 将文本分块解析成类似 SSE 的事件格式。
 *   4. 按照不同事件类型插入延时（sleepInReplay），模拟真实流式响应。
 */
async function* chatReplayStream(
  userMessage: string,
  params: {
    thread_id: string;
    auto_accepted_plan: boolean;
    max_plan_iterations: number;
    max_step_num: number;
    max_search_results?: number;
    interrupt_feedback?: string;
  } = {
    thread_id: "__mock__",
    auto_accepted_plan: false,
    max_plan_iterations: 3,
    max_step_num: 1,
    max_search_results: 3,
    interrupt_feedback: undefined,
  },
  options: { abortSignal?: AbortSignal } = {},
): 
```

#### fetch-stream.ts

```ts
// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { type StreamEvent } from "./StreamEvent";

/**
 * fetchStream:
 * - 这是一个异步生成器 (async generator)，用于从服务器获取 **流式 SSE 响应**。
 * - 内部使用 fetch 请求指定 url，并逐步解析 response.body 中的流数据。
 * - 返回的迭代对象每次 yield 一个 `StreamEvent`。
 */
export async function* fetchStream(
  url: string,
  init: RequestInit,
): AsyncIterable<StreamEvent> {
  // 使用 fetch 请求接口，默认 method=POST，附带 JSON header
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    ...init,
  });

  // 如果返回状态码不是 200，则报错
  if (response.status !== 200) {
    throw new Error(`Failed to fetch from ${url}: ${response.status}`);
  }

  /**
   * 从响应体中获取 ReadableStream，并通过 TextDecoderStream 解码成文本流
   * - response.body 是一个 ReadableStream<Uint8Array>
   * - pipeThrough(new TextDecoderStream()) 把字节流转成字符串流
   * - getReader() 返回一个 reader，可以逐块读取数据
   */
  const reader = response.body
    ?.pipeThrough(new TextDecoderStream())
    .getReader();

  if (!reader) {
    throw new Error("Response body is not readable");
  }

  // 缓冲区，用于拼接读取到的内容
  let buffer = "";

  // 不断从 reader 中读取数据块
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      // 没有更多数据，结束循环
      break;
    }

    // 将本次读取的数据拼接到 buffer 中
    buffer += value;

    // 内层循环：检查 buffer 是否包含完整事件（以 "\n\n" 作为分隔符）
    while (true) {
      const index = buffer.indexOf("\n\n"); // 找到事件结束位置
      if (index === -1) {
        // 如果没有完整事件，跳出等待下一次数据
        break;
      }

      // 截取一个完整事件 chunk
      const chunk = buffer.slice(0, index);
      // 更新 buffer，丢弃已解析的部分
      buffer = buffer.slice(index + 2);

      // 解析事件
      const event = parseEvent(chunk);
      if (event) {
        // 如果解析成功，yield 给外部使用
        yield event;
      }
    }
  }
}

/**
 * parseEvent:
 * - 将一个 SSE 格式的 chunk 转换成 { event, data } 结构。
 * - SSE 协议里，一条消息通常形如：
 *   event: message
 *   data: {"key":"value"}
 */
function parseEvent(chunk: string) {
  // 默认 event 类型是 "message"
  let resultEvent = "message";
  let resultData: string | null = null;

  // 按行解析
  for (const line of chunk.split("\n")) {
    const pos = line.indexOf(": ");
    if (pos === -1) {
      // 不符合 "key: value" 格式，跳过
      continue;
    }
    const key = line.slice(0, pos);
    const value = line.slice(pos + 2);

    // 根据 key 识别是 event 还是 data
    if (key === "event") {
      resultEvent = value;
    } else if (key === "data") {
      resultData = value;
    }
  }

  // 如果既没有 event 也没有 data，就返回 undefined
  if (resultEvent === "message" && resultData === null) {
    return undefined;
  }

  // 返回一个标准化的 StreamEvent 对象
  return {
    event: resultEvent,
    data: resultData,
  } as StreamEvent;
}

```

#### 发送请求
现在我们请求 deerflow 让他给我们做一个"介绍langchain的 ppt"，分三次发送。我们会在后面介绍 agent 实现时，详细介绍这三个请求的处理过程。


```json
// 1. 发送任务，生成 plan
{
  "messages": [
    {
      "role": "user",
      "content": "请帮我制作一个 ppt 介绍 langchain"
    }
  ],
  "thread_id": "FDt1ypgn7CYmOTWwiHYXf",
  "resources": [],
  "auto_accepted_plan": false,
  "enable_deep_thinking": false,
  "enable_background_investigation": false,
  "max_plan_iterations": 1,
  "max_step_num": 3,
  "max_search_results": 3,
  "report_style": "academic"
}

// 倒数 2-3 条message
{"thread_id": "I3IzhErqxzkcBHxTw55qk", "agent": "planner", "id": "run--78c1322e-655e-4077-9195-7f49e48207cc", "role": "assistant", "checkpoint_ns": "planner:e38550ac-5ae7-daa7-93f1-42ae5050401d", "langgraph_node": "planner", "langgraph_path": ["__pregel_pull", "planner"], "langgraph_step": 2}
{"thread_id": "I3IzhErqxzkcBHxTw55qk", "agent": "planner", "id": "run--78c1322e-655e-4077-9195-7f49e48207cc", "role": "assistant", "checkpoint_ns": "planner:e38550ac-5ae7-daa7-93f1-42ae5050401d", "langgraph_node": "planner", "langgraph_path": ["__pregel_pull", "planner"], "langgraph_step": 2}
// 最后一条消息，进入人工干预
{"thread_id": "I3IzhErqxzkcBHxTw55qk", "id": "human_feedback:a5b12843-a57a-0b74-f1e3-4cd6d6cc1152", "role": "assistant", "content": "Please Review the Plan.", "finish_reason": "interrupt", "options": [{"text": "Edit plan", "value": "edit_plan"}, {"text": "Start research", "value": "accepted"}]}

// 2. edit plan
{
  "messages": [
    {
      "role": "user",
      "content": "添加介绍 LCEL 内容介绍 "
    }
  ],
  "thread_id": "I3IzhErqxzkcBHxTw55qk",
  "interrupt_feedback": "edit_plan",
  "resources": [],
  "auto_accepted_plan": false,
  "enable_deep_thinking": false,
  "enable_background_investigation": false,
  "max_plan_iterations": 1,
  "max_step_num": 3,
  "max_search_results": 3,
  "report_style": "academic"
}

{"thread_id": "I3IzhErqxzkcBHxTw55qk", "agent": "planner", "id": "run--af5b26e8-5608-45cc-9a87-3ba5910bf8b4", "role": "assistant", "checkpoint_ns": "planner:3662372b-3f2f-32ea-fece-516debf779c6", "langgraph_node": "planner", "langgraph_path": ["__pregel_pull", "planner"], "langgraph_step": 4}
{"thread_id": "I3IzhErqxzkcBHxTw55qk", "agent": "planner", "id": "run--af5b26e8-5608-45cc-9a87-3ba5910bf8b4", "role": "assistant", "checkpoint_ns": "planner:3662372b-3f2f-32ea-fece-516debf779c6", "langgraph_node": "planner", "langgraph_path": ["__pregel_pull", "planner"], "langgraph_step": 4}
{"thread_id": "I3IzhErqxzkcBHxTw55qk", "id": "human_feedback:81c4ac66-da8d-a237-85e5-c14987a086b7", "role": "assistant", "content": "Please Review the Plan.", "finish_reason": "interrupt", "options": [{"text": "Edit plan", "value": "edit_plan"}, {"text": "Start research", "value": "accepted"}]}

// start search
{
  "messages": [
    {
      "role": "user",
      "content": "Sounds great! Let's start."
    }
  ],
  "thread_id": "I3IzhErqxzkcBHxTw55qk",
  "interrupt_feedback": "accepted",
  "auto_accepted_plan": false,
  "enable_deep_thinking": false,
  "enable_background_investigation": false,
  "max_plan_iterations": 1,
  "max_step_num": 3,
  "max_search_results": 3,
  "report_style": "academic"
}
```

### 4.2 后端接口
后端接口定义在 `src/server/app.py`:
1. ChatRequest 请求参数与前端一致
2. 核心逻辑在 `_astream_workflow_generator` 

```python
@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    # Check if MCP server configuration is enabled
    mcp_enabled = get_bool_env("ENABLE_MCP_SERVER_CONFIGURATION", False)

    # Validate MCP settings if provided
    if request.mcp_settings and not mcp_enabled:
        raise HTTPException(
            status_code=403,
            detail="MCP server configuration is disabled. Set ENABLE_MCP_SERVER_CONFIGURATION=true to enable MCP features.",
        )

    thread_id = request.thread_id
    if thread_id == "__default__":
        thread_id = str(uuid4())

    return StreamingResponse(
        _astream_workflow_generator(
            request.model_dump()["messages"],
            thread_id,
            request.resources,
            request.max_plan_iterations,
            request.max_step_num,
            request.max_search_results,
            request.auto_accepted_plan,
            request.interrupt_feedback,
            request.mcp_settings if mcp_enabled else {},
            request.enable_background_investigation,
            request.report_style,
            request.enable_deep_thinking,
        ),
        media_type="text/event-stream",
    )
```

#### ChatRequest
这里我们先来看 ChatRequest:

```python

class ContentItem(BaseModel):
    type: str = Field(..., description="The type of content (text, image, etc.)")
    text: Optional[str] = Field(None, description="The text content if type is 'text'")
    image_url: Optional[str] = Field(
        None, description="The image URL if type is 'image'"
    )


class ChatMessage(BaseModel):
    role: str = Field(
        ..., description="The role of the message sender (user or assistant)"
    )
    content: Union[str, List[ContentItem]] = Field(
        ...,
        description="The content of the message, either a string or a list of content items",
    )


class ChatRequest(BaseModel):
    messages: Optional[List[ChatMessage]] = Field(
        [], description="History of messages between the user and the assistant"
    )
    resources: Optional[List[Resource]] = Field(
        [], description="Resources to be used for the research"
    )
    debug: Optional[bool] = Field(False, description="Whether to enable debug logging")
    thread_id: Optional[str] = Field(
        "__default__", description="A specific conversation identifier"
    )
    max_plan_iterations: Optional[int] = Field(
        1, description="The maximum number of plan iterations"
    )
    max_step_num: Optional[int] = Field(
        3, description="The maximum number of steps in a plan"
    )
    max_search_results: Optional[int] = Field(
        3, description="The maximum number of search results"
    )
    auto_accepted_plan: Optional[bool] = Field(
        False, description="Whether to automatically accept the plan"
    )
    interrupt_feedback: Optional[str] = Field(
        None, description="Interrupt feedback from the user on the plan"
    )
    mcp_settings: Optional[dict] = Field(
        None, description="MCP settings for the chat request"
    )
    enable_background_investigation: Optional[bool] = Field(
        True, description="Whether to get background investigation before plan"
    )
    report_style: Optional[ReportStyle] = Field(
        ReportStyle.ACADEMIC, description="The style of the report"
    )
    enable_deep_thinking: Optional[bool] = Field(
        False, description="Whether to enable deep thinking"
    )
```

| 参数名                               | 类型                            | 默认值                    | 含义                                                                        |
| --------------------------------- | ----------------------------- | ---------------------- | ------------------------------------------------------------------------- |
| `messages`                        | `Optional[List[ChatMessage]]` | `[]`                   | 用户与助手之间的消息历史，用于保持上下文。                                                     |
| `resources`                       | `Optional[List[Resource]]`    | `[]`                   | 研究中需要用到的外部资源，例如文档、数据库、知识库等。                                               |
| `debug`                           | `Optional[bool]`              | `False`                | 是否启用调试日志，方便问题定位。                                                          |
| `thread_id`                       | `Optional[str]`               | `"__default__"`        | 会话标识符，用于区分不同的对话线程。                                                        |
| `max_plan_iterations`             | `Optional[int]`               | `1`                    | 生成研究/推理计划的最大迭代次数。限制规划过程不会无限循环。                                            |
| `max_step_num`                    | `Optional[int]`               | `3`                    | 每个计划中允许的最大执行步骤数。                                                          |
| `max_search_results`              | `Optional[int]`               | `3`                    | 搜索操作时返回的最大结果数量。                                                           |
| `auto_accepted_plan`              | `Optional[bool]`              | `False`                | 是否自动接受生成的计划（不需要用户确认）。                                                     |
| `interrupt_feedback`              | `Optional[str]`               | `None`                 | 用户对计划的中断反馈，例如 `"accepted"`、`"edit_plan"` 等。                               |
| `mcp_settings`                    | `Optional[dict]`              | `None`                 | MCP（多智能体控制协议）的配置，用于指定服务、工具启用情况等。                                          |
| `enable_background_investigation` | `Optional[bool]`              | `True`                 | 在执行计划前，是否先进行背景调查（信息收集）。                                                   |
| `report_style`                    | `Optional[ReportStyle]`       | `ReportStyle.ACADEMIC` | 输出报告的风格，可以是 `"academic"`、`"popular_science"`、`"news"`、`"social_media"` 等。 |
| `enable_deep_thinking`            | `Optional[bool]`              | `False`                | 是否启用“深度思考”模式，让模型进行更复杂的推理。                                                 |


#### _astream_workflow_generator
_astream_workflow_generator 的核心是调用 _stream_graph_events，这个函数内会使用 Langgraph 实现的 agent，执行 graph.astream 异步返回事件流。

```python

async def _stream_graph_events(
    graph_instance, workflow_input, workflow_config, thread_id
):
    """Stream events from the graph and process them."""
    async for agent, _, event_data in graph_instance.astream(
        workflow_input,
        config=workflow_config,
        stream_mode=["messages", "updates"],
        subgraphs=True,
    ):
        # 转换事件
        if isinstance(event_data, dict):
            if "__interrupt__" in event_data:
                yield _create_interrupt_event(thread_id, event_data)
            continue

        message_chunk, message_metadata = cast(
            tuple[BaseMessage, dict[str, any]], event_data
        )

        async for event in _process_message_chunk(
            message_chunk, message_metadata, thread_id, agent
        ):
            yield event


async def _astream_workflow_generator(
    messages: List[dict],
    thread_id: str,
    resources: List[Resource],
    max_plan_iterations: int,
    max_step_num: int,
    max_search_results: int,
    auto_accepted_plan: bool,
    interrupt_feedback: str,
    mcp_settings: dict,
    enable_background_investigation: bool,
    report_style: ReportStyle,
    enable_deep_thinking: bool,
):
    """
    异步生成 workflow 事件流。

    - 输入：初始消息、配置参数、资源限制
    - 输出：异步 yield workflow 事件（streaming）
    - 功能：负责准备 workflow 输入、配置，并根据 checkpoint 配置决定是否启用数据库持久化
    """

    # 处理初始消息（例如存储对话上下文到内存或数据库）
    for message in messages:
        if isinstance(message, dict) and "content" in message:
            _process_initial_messages(message, thread_id)

    # 准备 workflow 的初始输入数据（状态字典）
    workflow_input = {
        "messages": messages,                          # 用户输入的消息列表
        "plan_iterations": 0,                          # 当前 plan 循环次数（初始化为 0）
        "final_report": "",                            # 最终生成的报告（初始化为空）
        "current_plan": None,                          # 当前执行的计划（初始化为空）
        "observations": [],                            # 观测结果/中间步骤
        "auto_accepted_plan": auto_accepted_plan,      # 是否自动接受计划
        "enable_background_investigation": enable_background_investigation,
        "research_topic": messages[-1]["content"] if messages else "",  # 研究主题 = 最后一条消息
    }

    # 如果不是自动接受 plan 并且有中断反馈，则构造一个 resume 命令
    if not auto_accepted_plan and interrupt_feedback:
        resume_msg = f"[{interrupt_feedback}]"
        if messages:
            resume_msg += f" {messages[-1]['content']}"
        # 替换 workflow_input 为一个 resume Command（特殊输入）
        workflow_input = Command(resume=resume_msg)

    # 准备 workflow 的配置参数
    workflow_config = {
        "thread_id": thread_id,                       # 当前会话 ID
        "resources": resources,                       # 可用资源（API、工具等）
        "max_plan_iterations": max_plan_iterations,   # 计划最大迭代次数
        "max_step_num": max_step_num,                 # 最大步骤数
        "max_search_results": max_search_results,     # 最大搜索结果数
        "mcp_settings": mcp_settings,                 # MCP 相关配置
        "report_style": report_style.value,           # 报告输出样式
        "enable_deep_thinking": enable_deep_thinking, # 是否启用深度思考
        "recursion_limit": get_recursion_limit(),     # Python 递归限制
    }

    # 读取 checkpoint 相关的环境变量配置
    checkpoint_saver = get_bool_env("LANGGRAPH_CHECKPOINT_SAVER", False)  # 是否启用 checkpoint
    checkpoint_url = get_str_env("LANGGRAPH_CHECKPOINT_DB_URL", "")       # checkpoint 数据库连接

    # PostgreSQL 的连接配置参数
    connection_kwargs = {
        "autocommit": True,
        "row_factory": "dict_row",   # 查询结果以字典形式返回
        "prepare_threshold": 0,
    }

    # 如果启用了 checkpoint 且配置了数据库 URL
    if checkpoint_saver and checkpoint_url != "":
        # 使用 PostgreSQL 持久化
        if checkpoint_url.startswith("postgresql://"):
            logger.info("start async postgres checkpointer.")
            async with AsyncConnectionPool(
                checkpoint_url, kwargs=connection_kwargs
            ) as conn:
                checkpointer = AsyncPostgresSaver(conn)
                await checkpointer.setup()           # 初始化表/数据结构
                graph.checkpointer = checkpointer    # 给 graph 配置 checkpoint
                graph.store = in_memory_store        # 使用内存作为临时存储
                # 开始流式执行 graph，逐个 yield 事件
                async for event in _stream_graph_events(
                    graph, workflow_input, workflow_config, thread_id
                ):
                    yield event

        # 使用 MongoDB 持久化
        if checkpoint_url.startswith("mongodb://"):
            logger.info("start async mongodb checkpointer.")
            async with AsyncMongoDBSaver.from_conn_string(
                checkpoint_url
            ) as checkpointer:
                graph.checkpointer = checkpointer    # 给 graph 配置 checkpoint
                graph.store = in_memory_store        # 使用内存作为临时存储
                # 开始流式执行 graph，逐个 yield 事件
                async for event in _stream_graph_events(
                    graph, workflow_input, workflow_config, thread_id
                ):
                    yield event
    else:
        # 如果没有启用 checkpoint，直接运行 graph（不会保存中间状态）
        async for event in _stream_graph_events(
            graph, workflow_input, workflow_config, thread_id
        ):
            yield event

```