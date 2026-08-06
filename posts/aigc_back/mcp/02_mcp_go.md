---
weight: 1
title: "mcp-go"
date: 2025-08-14T8:00:00+08:00
lastmod: 2025-08-14T8:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "mcp-go"
featuredImage: 

tags: ["mcp"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

这一节我们来学习 mcp go 语言实现的框架 [mcp-go](https://github.com/mark3labs/mcp-go)

## 1. 说明
为了快速对 mcp 有个整体的了解，我结合 ABcoder 向 mcp 提了几个问题，后面的内容基于这些问题回答的整理。

```bash
提问:
# 问题一
请你给我介绍一下 mcp-go 中的核心对象

# 问题二
mcp-go 底层是 http server 么，借助什么框架实现的

# 问题三
我现在不清楚
- AddTool/AddTools : 添加工具
- AddResource/AddResources : 添加资源
- AddPrompt/AddPrompts : 添加提示
- AddResourceTemplate/AddResourceTemplates : 添加资源模板
这些方法执行之后，是如何形成 http 接口的。能不能举例说明一下，执行这些函数之后，mcp server 会提供哪些接口，与这些方法之间的对应关系

# 问题四
我想知道  mcp-go 接收到  tool_call 后

1. 生成 json rpc call 的位置
2. 路由找到对应的 tool handle 的位置
```


## 1. 核心包结构
根据对代码库的分析，MCP-Go 是一个实现了 Model Context Protocol (MCP) 的 Go 语言库，它提供了客户端和服务端之间进行通信的框架。以下是 MCP-Go 中的核心对象：

MCP-Go 主要由三个核心包组成：

- **mcp**: 定义了协议的基本类型和接口
- **client**: 实现了 MCP 客户端
- **server**: 实现了 MCP 服务端

### 1.1 MCP 包中的核心对象

#### 基础类型

- **Content**: 表示内容的接口，有多种实现如 TextContent、ImageContent、AudioContent 等
- **Resource**: 表示资源，包含 URI、名称、描述等信息
- **ResourceTemplate**: 资源模板，用于构造资源 URI
- **Tool**: 表示可以被调用的工具，包含名称、描述、输入模式等
- **Meta**: 元数据对象，用于存储额外信息
- **RequestId**: 请求 ID，用于标识请求

#### 请求求和响应类型

- **Request**: 基础请求类型
- **Result**: 基础结果类型
- **JSONRPCMessage**: 表示 JSON-RPC 消息，可以是请求、通知、响应或错误
- **CallToolRequest/CallToolResult**: 工具调用请求和结果
- **InitializeRequest/InitializeResult**: 初始化请求和结果

#### 工具相关

- **ToolInputSchema**: 工具输入模式
- **ToolAnnotation**: 工具注解，包含工具的各种提示信息
- **PropertyOption**: 用于配置属性的函数选项
- **ToolOption**: 用于配置工具的函数选项

### 1.2 客户端核心对象

#### Client

`Client` 是 MCP 客户端的主要实现，它提供了与服务端通信的方法：

```go
type Client struct {
    transport transport.Interface
    initialized        bool
    notifications      []func(mcp.JSONRPCNotification)
    notifyMu           sync.RWMutex
    requestID          atomic.Int64
    clientCapabilities mcp.ClientCapabilities
    serverCapabilities mcp.ServerCapabilities
    protocolVersion    string
    samplingHandler    SamplingHandler
}
```

主要方法包括：
- **Initialize**: 初始化客户端与服务端的连接
- **ListTools/ListPrompts/ListResources**: 列出可用的工具、提示和资源
- **CallTool**: 调用服务端提供的工具
- **ReadResource**: 读取资源内容
- **Subscribe/Unsubscribe**: 订阅/取消订阅资源变更通知

#### Transport

`transport.Interface` 是客户端与服务端通信的传输层接口，有多种实现：
- **HTTP 传输**
- **SSE (Server-Sent Events) 传输**
- **标准输入/输出传输**
- **进程内传输**

### 1.3 服务端核心对象

#### MCPServer

`MCPServer` 是 MCP 服务端的主要实现，它处理来自客户端的请求：

```go
type MCPServer struct {
    // 服务器名称和版本
    name    string
    version string
    
    // 资源、工具和提示的注册表
    resources         map[string]resourceEntry
    resourceTemplates map[string]resourceTemplateEntry
    tools             map[string]toolEntry
    prompts           map[string]promptEntry
    
    // 通知处理器
    notificationHandlers map[string]NotificationHandlerFunc
    
    // 服务器能力
    capabilities serverCapabilities
    
    // 其他配置和状态
    hooks              *Hooks
    paginationLimit    int
    toolHandlerMiddleware ToolHandlerMiddleware
    toolFilter         ToolFilterFunc
    instructions       string
}
```

主要方法包括：
- **AddTool/AddTools**: 添加工具
- **AddResource/AddResources**: 添加资源
- **AddPrompt/AddPrompts**: 添加提示
- **AddResourceTemplate/AddResourceTemplates**: 添加资源模板

#### 处理函数类型

- **ToolHandlerFunc**: 处理工具调用的函数
- **ResourceHandlerFunc**: 处理资源请求的函数
- **PromptHandlerFunc**: 处理提示请求的函数
- **NotificationHandlerFunc**: 处理通知的函数

### 1.4 通信流程

1. 客户端通过 `Initialize` 方法与服务端建立连接
2. 客户端可以列出服务端提供的工具、资源和提示
3. 客户端可以调用服务端的工具，读取资源，或获取提示
4. 服务端处理请求并返回结果
5. 客户端可以订阅资源变更通知

          
## 2. mcp-go 底层实现机制分析

### 2.1 底层传输协议

mcp-go 底层确实使用了 HTTP 作为主要的传输协议，但它并不是一个传统意义上的 HTTP 服务器，而是实现了基于 HTTP 的 JSON-RPC 通信机制。具体来说：

1. **传输层实现**：在 `client/transport` 包中，有多种传输实现：
   - `StreamableHTTP`：基于 HTTP 的传输实现，支持 JSON-RPC 消息通过单独的 HTTP 请求传输
   - `SSE`：基于 Server-Sent Events 的实现
   - `Stdio`：基于标准输入输出的实现
   - `InProcessTransport`：进程内通信实现

2. **HTTP 传输细节**：
   - `StreamableHTTP` 结构体实现了 `Interface` 和 `BidirectionalInterface` 接口
   - 它通过单独的 HTTP 请求传输 JSON-RPC 消息，每个请求一条消息
   - HTTP 响应体可以是单个 JSON-RPC 响应，也可以是升级为 SSE 流的响应
   - 支持 OAuth 认证
   - 支持持续监听（通过 `WithContinuousListening` 选项）

3. **框架使用**：
   - mcp-go 并没有使用任何第三方 HTTP 框架（如 Gin、Echo 等）
   - 它直接使用了 Go 标准库中的 `net/http` 包来实现 HTTP 客户端和服务端功能
   - 在 `NewStreamableHTTP` 函数中可以看到，它创建了标准的 `http.Client` 实例

### 2.2 通信模式

mcp-go 实现了 Model Context Protocol (MCP)，这是一个用于 AI 模型与外部工具通信的协议：

1. **JSON-RPC 通信**：
   - 使用 JSON-RPC 2.0 协议格式进行通信
   - 支持请求-响应模式和通知模式
   - 支持双向通信（客户端到服务端和服务端到客户端）

2. **流式通信**：
   - 支持通过 SSE（Server-Sent Events）实现服务端到客户端的流式通信
   - 支持长连接和断线重连
          
## 3. MCP-Go 中添加工具/资源与 HTTP 接口的关系

MCP (Model Context Protocol) 是一个用于 AI 模型与外部工具通信的协议。当你调用 `AddTool`、`AddResource` 等方法时，你是在向 MCP 服务器注册这些功能，然后 MCP 服务器会通过 JSON-RPC 协议将这些功能暴露为 API 接口。

### 3.1 添加工具 (AddTool/AddTools)

当你调用 `s.AddTool(tool, helloHandler)` 时：

- 你向 MCP 服务器注册了一个名为 `tool` 的工具及其处理函数 `helloHandler`
- MCP 服务器会创建一个 JSON-RPC 方法 `mcp/tool/call`
- 客户端可以通过发送 POST 请求到服务器的 `/` 路径，请求体为 JSON-RPC 格式的消息来调用这个工具

```json
// 客户端请求示例
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "mcp/tool/call",
  "params": {
    "name": "tool",  // 你注册的工具名称
    "parameters": {   // 工具参数
      // 根据工具的输入模式定义的参数
    }
  }
}
```

### 3.2 添加资源 (AddResource/AddResources)

当你调用 `s.AddResource(resource)` 时：

- 你向 MCP 服务器注册了一个资源
- MCP 服务器会创建以下 JSON-RPC 方法：
  - `mcp/resource/read`：读取资源内容
  - `mcp/resource/list`：列出所有可用资源

```json
// 读取资源的客户端请求示例
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "mcp/resource/read",
  "params": {
    "name": "resource-name"  // 你注册的资源名称
  }
}
```

### 3.3 添加提示 (AddPrompt/AddPrompts)

当你调用 `s.AddPrompt(prompt)` 时：

- 你向 MCP 服务器注册了一个提示
- MCP 服务器会创建以下 JSON-RPC 方法：
  - `mcp/prompt/get`：获取特定提示
  - `mcp/prompt/list`：列出所有可用提示

```json
// 获取提示的客户端请求示例
{
  "jsonrpc": "2.0",
  "id": "3",
  "method": "mcp/prompt/get",
  "params": {
    "name": "prompt-name"  // 你注册的提示名称
  }
}
```

### 3.4 添加资源模板 (AddResourceTemplate/AddResourceTemplates)

当你调用 `s.AddResourceTemplate(template)` 时：

- 你向 MCP 服务器注册了一个资源模板
- MCP 服务器会创建 JSON-RPC 方法 `mcp/resource_template/list`

```json
// 列出资源模板的客户端请求示例
{
  "jsonrpc": "2.0",
  "id": "4",
  "method": "mcp/resource_template/list",
  "params": {}
}
```

### 3.5 HTTP 传输机制

MCP 服务器使用 HTTP 作为传输层，但它不是传统的 REST API：

1. **所有请求都发送到同一个端点**（通常是根路径 `/`）
2. **使用 JSON-RPC 协议**：所有请求和响应都遵循 JSON-RPC 2.0 格式
3. **支持双向通信**：
   - 客户端到服务器：通过 HTTP POST 请求
   - 服务器到客户端：通过 SSE（Server-Sent Events）或 WebSocket

### 3.6 实际例子

假设你有以下代码：

```go
// 创建一个工具
tool := mcp.NewTool(
    "hello",
    "A greeting tool",
    mcp.WithString("name", "The name to greet", mcp.Required()),
)

// 添加工具到服务器
s.AddTool(tool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
    name, _ := req.GetString("name")
    return mcp.NewCallToolResult(fmt.Sprintf("Hello, %s!", name)), nil
})
```

客户端可以通过以下 HTTP 请求调用这个工具：

```http
POST / HTTP/1.1
Host: your-mcp-server.com
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": "request-123",
  "method": "mcp/tool/call",
  "params": {
    "name": "hello",
    "parameters": {
      "name": "世界"
    }
  }
}
```

服务器会响应：

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": "request-123",
  "result": {
    "content": "Hello, 世界!"
  }
}
```


## 4. 请求路由
以 tool call 为例说明请求的路由过程。

### 4.1 生成 JSON RPC call 的位置

在 `server/request_handler.go` 文件中的 `HandleMessage` 方法（第 17-339 行）负责处理接收到的 JSON-RPC 消息。当接收到 `MethodToolsCall` 类型的请求时（第 306-327 行），系统会：

1. 解析接收到的 JSON 消息到 `mcp.CallToolRequest` 结构体
2. 调用 `s.handleToolCall(ctx, baseMessage.ID, request)` 方法处理工具调用
3. 生成 JSON-RPC 响应并返回

相关代码片段（第 306-327 行）：
```go
case mcp.MethodToolsCall:
    var request mcp.CallToolRequest
    var result *mcp.CallToolResult
    if s.capabilities.tools == nil {
        err = &requestError{
            id:   baseMessage.ID,
            code: mcp.METHOD_NOT_FOUND,
            err:  fmt.Errorf("tools %w", ErrUnsupported),
        }
    } else if unmarshalErr := json.Unmarshal(message, &request); unmarshalErr != nil {
        err = &requestError{
            id:   baseMessage.ID,
            code: mcp.INVALID_REQUEST,
            err:  &UnparsableMessageError{message: message, err: unmarshalErr, method: baseMessage.Method},
        }
    } else {
        request.Header = headers
        s.hooks.beforeCallTool(ctx, baseMessage.ID, &request)
        result, err = s.handleToolCall(ctx, baseMessage.ID, request)
    }
```

### 4.2 路由找到对应的 tool handle 的位置

在 `server/server.go` 文件中的 `handleToolCall` 方法（第 1056-1114 行）负责查找并执行对应的工具处理函数：

1. 首先检查会话特定的工具（session-specific tools）
2. 如果在会话中未找到，则检查全局工具（global tools）
3. 应用中间件（middlewares）
4. 执行工具处理函数并返回结果

```go
func (s *MCPServer) handleToolCall(
    ctx context.Context,
    id any,
    request mcp.CallToolRequest,
) (*mcp.CallToolResult, *requestError) {
    // 首先检查会话特定的工具
    var tool ServerTool
    var ok bool

    session := ClientSessionFromContext(ctx)
    if session != nil {
        if sessionWithTools, typeAssertOk := session.(SessionWithTools); typeAssertOk {
            if sessionTools := sessionWithTools.GetSessionTools(); sessionTools != nil {
                var sessionOk bool
                tool, sessionOk = sessionTools[request.Params.Name]
                if sessionOk {
                    ok = true
                }
            }
        }
    }

    // 如果在会话工具中未找到，则检查全局工具
    if !ok {
        s.toolsMu.RLock()
        tool, ok = s.tools[request.Params.Name]
        s.toolsMu.RUnlock()
    }

    if !ok {
        return nil, &requestError{
            id:   id,
            code: mcp.INVALID_PARAMS,
            err:  fmt.Errorf("tool '%s' not found: %w", request.Params.Name, ErrToolNotFound),
        }
    }

    finalHandler := tool.Handler

    // 应用中间件
    s.middlewareMu.RLock()
    mw := s.toolHandlerMiddlewares
    for i := len(mw) - 1; i >= 0; i-- {
        finalHandler = mw[i](finalHandler)
    }
    s.middlewareMu.RUnlock()

    // 执行工具处理函数
    result, err := finalHandler(ctx, request)
    if err != nil {
        return nil, &requestError{
            id:   id,
            code: mcp.INTERNAL_ERROR,
            err:  err,
        }
    }

    return result, nil
}
```

可以看到 mcp-go 请求路由处理的核心是 HandleMessage 方法。

## 5. HandleMessage


```go
// HandleMessage 处理从客户端接收到的 JSON-RPC 消息
func (s *MCPServer) HandleMessage(
	ctx context.Context,
	message json.RawMessage, // 原始 JSON 消息
) mcp.JSONRPCMessage {
	// 将当前 MCPServer 实例存入 context，方便后续调用时获取
	ctx = context.WithValue(ctx, serverKey{}, s)
	var err *requestError

	// 定义一个结构体，用于解析消息的基本字段
	var baseMessage struct {
		JSONRPC string        `json:"jsonrpc"` // JSON-RPC 协议版本
		Method  mcp.MCPMethod `json:"method"`  // 请求的方法名
		ID      any           `json:"id,omitempty"`     // 请求 ID（通知时可以没有）
		Result  any           `json:"result,omitempty"` // 响应结果（如果是响应消息）
	}

	// 反序列化消息到 baseMessage
	if err := json.Unmarshal(message, &baseMessage); err != nil {
		// 如果解析失败，返回 JSON-RPC 格式的解析错误
		return createErrorResponse(
			nil,
			mcp.PARSE_ERROR,
			"Failed to parse message",
		)
	}

	// 检查 JSON-RPC 协议版本是否正确
	if baseMessage.JSONRPC != mcp.JSONRPC_VERSION {
		return createErrorResponse(
			baseMessage.ID,
			mcp.INVALID_REQUEST,
			"Invalid JSON-RPC version",
		)
	}

	// 如果 ID 为空，说明这是一个 Notification（通知），不需要响应
	if baseMessage.ID == nil {
		var notification mcp.JSONRPCNotification
		if err := json.Unmarshal(message, &notification); err != nil {
			return createErrorResponse(
				nil,
				mcp.PARSE_ERROR,
				"Failed to parse notification",
			)
		}
		s.handleNotification(ctx, notification) // 处理通知
		return nil // 通知不返回结果
	}

	// 如果 Result 字段不为空，说明这是服务端之前发出的请求的响应，这里直接忽略
	if baseMessage.Result != nil {
		return nil
	}

	// 调用请求初始化钩子（Hook）
	handleErr := s.hooks.onRequestInitialization(ctx, baseMessage.ID, message)
	if handleErr != nil {
		return createErrorResponse(
			baseMessage.ID,
			mcp.INVALID_REQUEST,
			handleErr.Error(),
		)
	}

	// 从 Context 中获取请求头
	h := ctx.Value(requestHeader)
	headers, ok := h.(http.Header)
	if headers == nil || !ok {
		headers = make(http.Header)
	}

	// 根据不同的 Method 执行对应的处理逻辑
	switch baseMessage.Method {

	// 初始化
	case mcp.MethodInitialize:
		var request mcp.InitializeRequest
		var result *mcp.InitializeResult
		if unmarshalErr := json.Unmarshal(message, &request); unmarshalErr != nil {
			err = &requestError{ // 反序列化失败
				id:   baseMessage.ID,
				code: mcp.INVALID_REQUEST,
				err:  &UnparsableMessageError{message: message, err: unmarshalErr, method: baseMessage.Method},
			}
		} else {
			request.Header = headers
			s.hooks.beforeInitialize(ctx, baseMessage.ID, &request)   // 调用前置 Hook
			result, err = s.handleInitialize(ctx, baseMessage.ID, request) // 实际业务处理
		}
		if err != nil {
			s.hooks.onError(ctx, baseMessage.ID, baseMessage.Method, &request, err) // 错误 Hook
			return err.ToJSONRPCError()
		}
		s.hooks.afterInitialize(ctx, baseMessage.ID, &request, result) // 后置 Hook
		return createResponse(baseMessage.ID, *result)                 // 返回响应

	// Ping 心跳
	case mcp.MethodPing:
		var request mcp.PingRequest
		var result *mcp.EmptyResult
		if unmarshalErr := json.Unmarshal(message, &request); unmarshalErr != nil {
			err = &requestError{
				id:   baseMessage.ID,
				code: mcp.INVALID_REQUEST,
				err:  &UnparsableMessageError{message: message, err: unmarshalErr, method: baseMessage.Method},
			}
		} else {
			request.Header = headers
			s.hooks.beforePing(ctx, baseMessage.ID, &request)
			result, err = s.handlePing(ctx, baseMessage.ID, request)
		}
		if err != nil {
			s.hooks.onError(ctx, baseMessage.ID, baseMessage.Method, &request, err)
			return err.ToJSONRPCError()
		}
		s.hooks.afterPing(ctx, baseMessage.ID, &request, result)
		return createResponse(baseMessage.ID, *result)

	// 修改日志等级
	case mcp.MethodSetLogLevel:
		var request mcp.SetLevelRequest
		var result *mcp.EmptyResult
		if s.capabilities.logging == nil { // 如果不支持 logging
			err = &requestError{
				id:   baseMessage.ID,
				code: mcp.METHOD_NOT_FOUND,
				err:  fmt.Errorf("logging %w", ErrUnsupported),
			}
		} else if unmarshalErr := json.Unmarshal(message, &request); unmarshalErr != nil {
			err = &requestError{
				id:   baseMessage.ID,
				code: mcp.INVALID_REQUEST,
				err:  &UnparsableMessageError{message: message, err: unmarshalErr, method: baseMessage.Method},
			}
		} else {
			request.Header = headers
			s.hooks.beforeSetLevel(ctx, baseMessage.ID, &request)
			result, err = s.handleSetLevel(ctx, baseMessage.ID, request)
		}
		if err != nil {
			s.hooks.onError(ctx, baseMessage.ID, baseMessage.Method, &request, err)
			return err.ToJSONRPCError()
		}
		s.hooks.afterSetLevel(ctx, baseMessage.ID, &request, result)
		return createResponse(baseMessage.ID, *result)

	// 列出资源
	case mcp.MethodResourcesList:
		var request mcp.ListResourcesRequest
		var result *mcp.ListResourcesResult
		if s.capabilities.resources == nil {
			err = &requestError{
				id:   baseMessage.ID,
				code: mcp.METHOD_NOT_FOUND,
				err:  fmt.Errorf("resources %w", ErrUnsupported),
			}
		} else if unmarshalErr := json.Unmarshal(message, &request); unmarshalErr != nil {
			err = &requestError{
				id:   baseMessage.ID,
				code: mcp.INVALID_REQUEST,
				err:  &UnparsableMessageError{message: message, err: unmarshalErr, method: baseMessage.Method},
			}
		} else {
			request.Header = headers
			s.hooks.beforeListResources(ctx, baseMessage.ID, &request)
			result, err = s.handleListResources(ctx, baseMessage.ID, request)
		}
		if err != nil {
			s.hooks.onError(ctx, baseMessage.ID, baseMessage.Method, &request, err)
			return err.ToJSONRPCError()
		}
		s.hooks.afterListResources(ctx, baseMessage.ID, &request, result)
		return createResponse(baseMessage.ID, *result)

	// ...（省略其它 Method 的处理逻辑，它们结构基本相同）

	default:
		// 如果方法不存在，返回 METHOD_NOT_FOUND 错误
		return createErrorResponse(
			baseMessage.ID,
			mcp.METHOD_NOT_FOUND,
			fmt.Sprintf("Method %s not found", baseMessage.Method),
		)
	}
}

```