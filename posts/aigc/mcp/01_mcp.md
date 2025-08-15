---
weight: 1
title: "MCP 基础"
date: 2025-08-14T8:00:00+08:00
lastmod: 2025-08-14T8:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "MCP 基础"
featuredImage: 

tags: ["mcp"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

**MCP（Model Context Protocol）** 是 **一种基于 JSON-RPC 2.0 的通信协议**，它的目标是让 LLM（或 LLM 代理）与外部数据源、工具、API、文件系统等通过 **统一接口** 对接。

与之前类似，我们直接直接问 ChatGpt。`提问: 给我解释一下 mcp 的原理和通信过程` 下面是 ChatGpt 的回答：

## 1. MCP

MCP 你可以把它想成：

> “一个标准化的插件接口，让 AI 能安全、可控地访问外部能力。”

在 MCP 里：

* **客户端（Client）**：通常是 AI 运行环境，比如 Claude Desktop、IDE 插件、LangGraph 中的 MCP 客户端。
* **服务器（Server）**：暴露功能（tools）、数据（resources）、配置（prompts）等的服务端进程，可以是本地进程、容器、远程 API 封装。

---

### 1. 核心原理

MCP 基于 **双向 JSON-RPC 2.0**，两边都可以发送请求和响应。

**关键特性**：

1. **双向调用**

   * 客户端可以调用服务器的功能（比如执行一个工具、获取文件内容）。
   * 服务器也可以请求客户端做事（比如请求身份认证、展示 UI 消息）。
2. **会话式连接**

   * 通过 WebSocket、stdin/stdout、或本地 socket 建立持久连接。
3. **能力声明（Capabilities）**

   * 连接建立时，双方会先交换各自支持的能力（tools、resources、prompts 等）。
4. **可组合、可扩展**

   * 每个 Server 可以暴露多个 tool/resource，客户端只需一次集成即可使用全部能力。

---

### 2. 通信过程（典型流程）

假设 Claude Desktop（客户端）调用一个本地 GitHub MCP Server（服务器）来读取 PR 列表：

```
[1] 建立连接
--------------------
Client -> Server: 初始化连接（Initialize）
Server -> Client: 返回支持的 capabilities（比如 tools、resources）

[2] 列出可用功能
--------------------
Client -> Server: tools/list
Server -> Client: 返回工具列表（如 "list_pull_requests", "create_issue"）

[3] 执行工具
--------------------
Client -> Server: tools/call
   { "name": "list_pull_requests", "arguments": { "repo": "owner/repo" } }
Server -> Client: 返回执行结果（PR 列表的 JSON）

[4] 可选的反向调用
--------------------
Server -> Client: request_input / authenticate（例如需要 GitHub token）
Client -> Server: 返回输入结果或认证信息
```

---

### 3. 消息结构示例（JSON-RPC 2.0）

**客户端调用服务器的工具：**

```json
{
  "jsonrpc": "2.0",
  "id": "42",
  "method": "tools/call",
  "params": {
    "name": "list_pull_requests",
    "arguments": { "repo": "octocat/Hello-World" }
  }
}
```

**服务器返回结果：**

```json
{
  "jsonrpc": "2.0",
  "id": "42",
  "result": {
    "pull_requests": [
      { "id": 1, "title": "Fix bug" },
      { "id": 2, "title": "Add feature" }
    ]
  }
}
```

---

### 4. MCP 的几个核心概念

| 概念               | 含义                                |
| ---------------- | --------------------------------- |
| **Tools**        | 可调用的操作，比如搜索文档、查询数据库、调用外部 API。     |
| **Resources**    | 可访问的数据资源（只读或可写），如文件系统、数据库表、云存储路径。 |
| **Prompts**      | 预定义的 prompt 模板，供客户端快速构建 LLM 请求。   |
| **Capabilities** | 连接时声明的功能集合，告诉对方你能做什么。             |
| **Session**      | 一次客户端与服务器的长连接，会保留上下文和状态。          |

---

### 5. 总结原理图

```
     ┌─────────────────┐        JSON-RPC 2.0         ┌──────────────────┐
     │ MCP Client       │ <------------------------> │ MCP Server        │
     │ (Claude, IDE)    │  双向调用 + 持久连接         │ (Tools/Resources) │
     └─────────────────┘                            └──────────────────┘
             ↑  调用工具 (tools/call)                         ↓
             ↓  获取资源 (resources/read)                     ↑
             ↑  双向事件 (如认证请求、消息推送)                ↓
```


## 2. MCP 的实现
不同语言都提供了实现 MCP Server 的框架:
1. python: [modelcontextprotocol/python-sdk](https://github.com/modelcontextprotocol/python-sdk)
2. golang: [mcp-go](https://github.com/mark3labs/mcp-go)

接下来我们将以 mcp-go 为例介绍 MCP Server 的实现，并以 [Abcoder](https://github.com/cloudwego/abcoder)。

为什么以 Abcoder 为例，主要是我想了解 Abcoder 的实现，以提高 AI 编程的效率。如果时间允许，我也会详细介绍 [deepwiki-open](https://github.com/AsyncFuncAI/deepwiki-open)。这些工具可以辅助我们快速从源码层面学习各种框架。


## 3. Abcoder 配置
Abcoder 的配置直接参考 github 仓库里的文档，唯一需要注意的是截止 2025-08-14，golang 1.24 以上版本存在一些兼容问题。要安装 Abcoder 需要退回到 1.23 版本。


## 4. JSON-RPC 2.0 实现
`github.com/sourcegraph/jsonrpc2` 是 Sourcegraph 团队维护的一个 **Go 语言实现的 JSON-RPC 2.0 协议库**，主要用于构建基于 JSON-RPC 的客户端和服务端通信。
它的设计目标是支持 **全双工（双向）异步调用**，适合像 **LSP（Language Server Protocol）** 这种需要持续收发请求与通知的场景。

---

### 4.1 jsonrpc2


1. **实现 JSON-RPC 2.0 协议**

   * 支持标准 JSON-RPC 方法调用 (`request/response`) 和通知 (`notification`)。
   * 自动处理请求 ID、错误格式、参数序列化与反序列化。

2. **支持全双工通信**

   * 允许客户端和服务端同时发送请求和通知。
   * 不区分严格的“客户端/服务端”，双方都是 `Conn`（连接）。

3. **可插拔的流（Stream）层**

   * 通过 `jsonrpc2.Stream` 接口支持多种传输方式：

     * TCP
     * Unix Socket
     * 标准输入/输出（适合 LSP）
     * WebSocket
   * 你可以用 `jsonrpc2.NewBufferedStream()` 结合自定义的 `io.ReadWriteCloser`。

4. **适合 LSP 等协议**

   * LSP 本质上就是运行在 `stdio` 上的 JSON-RPC 2.0，
     `jsonrpc2` 可以直接处理这种场景。

5. `jsonrpc2` 允许在同一个 `conn` 上：

    * 接收远端请求并处理
    * 主动发送请求到远端
    * 主动发送通知到远端
    * 这就是 LSP 双向调用的基础。

---

### 4.2 核心用法

#### **Handler**

核心是实现 `jsonrpc2.Handler` 接口：

```go
type Handler interface {
    Handle(ctx context.Context, conn *Conn, req *Request)
}
```

* `req.Method` 是方法名（如 `"initialize"`）
* `req.Params` 是参数
* 用 `conn.Reply()` 回复结果，用 `conn.Notify()` 发送通知

---


#### **创建连接**

```go
rwc := some_io_readwritecloser // 比如 net.Conn 或 os.Stdin/os.Stdout
stream := jsonrpc2.NewBufferedStream(rwc, jsonrpc2.VSCodeObjectCodec{})
conn := jsonrpc2.NewConn(context.Background(), stream, handler)
```

* `VSCodeObjectCodec{}` 是一种 JSON 编码方式，兼容 LSP 传输格式。

`NewConn(context.Background(), stream, handler)`
- stream 负责网络读写和 JSON 编解码（io.ReadWriteCloser + 编码器）。
- conn 会启动一个 goroutine 循环去从 stream 读消息，解析成 Request 或 Response 对象，然后调用 h.Handle(...)。

```go
func NewConn(ctx context.Context, stream ObjectStream, h Handler, opts ...ConnOpt) *Conn {
	c := &Conn{
		stream:     stream,
		h:          h,
		pending:    map[ID]*call{},
		disconnect: make(chan struct{}),
		logger:     log.New(os.Stderr, "", log.LstdFlags),
	}
	for _, opt := range opts {
		if opt == nil {
			continue
		}
		opt(c)
	}
	go c.readMessages(ctx)
	return c
}

func (c *Conn) readMessages(ctx context.Context) {
	var err error
	for err == nil {
		var m anyMessage
		err = c.stream.ReadObject(&m)
		if err != nil {
			break
		}

		switch {
		case m.request != nil:
			for _, onRecv := range c.onRecv {
				onRecv(m.request, nil)
			}
			c.h.Handle(ctx, c, m.request)

		case m.response != nil:
			resp := m.response
			if resp != nil {
				id := resp.ID
				c.mu.Lock()
				call := c.pending[id]
				delete(c.pending, id)
				c.mu.Unlock()

				if call != nil {
					call.response = resp
				}

				if len(c.onRecv) > 0 {
					var req *Request
					if call != nil {
						req = call.request
					}
					for _, onRecv := range c.onRecv {
						onRecv(req, resp)
					}
				}

				switch {
				case call == nil:
					c.logger.Printf("jsonrpc2: ignoring response #%s with no corresponding request\n", id)

				case resp.Error != nil:
					call.done <- resp.Error
					close(call.done)

				default:
					call.done <- nil
					close(call.done)
				}
			}
		}
	}
	c.close(err)
}

```
---

#### **发送请求**

```go
var result MyResponse
err := conn.Call(ctx, "someMethod", MyParams{...}, &result)
```

* `Call()` 会等待远端响应并解析到 `result`。

---

#### **发送通知**

```go
err := conn.Notify(ctx, "didOpen", params)
```

* `Notify()` 不会等待对方返回。


