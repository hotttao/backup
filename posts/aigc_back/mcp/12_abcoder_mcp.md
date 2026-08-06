---
weight: 1
title: "ABcoder MCP"
date: 2025-08-14T16:00:00+08:00
lastmod: 2025-08-14T16:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "ABcoder MCP 实现"
featuredImage: 

tags: ["mcp"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

前面我们了解了 ABcoder Parse 解析过程，并了解到 Parse 会将解析的结果保存为 Repository 结构体，并使用 Json 序列化保存到文件中。这一节我们来学习 ABcoder MCP 的实现。

## 1 MCP
### 1.1 入口
main 函数 MCP 启动的入口如下，核心是 mcp.NewServer 函数，该函数会创建一个 MCP 服务器，然后调用 ServeStdio 函数启动服务器。

```go
import (
	"github.com/cloudwego/abcoder/llm/mcp"
)

func main() {
	case "mcp":
    // uri 是 parse 输出的目录
		_, uri := parseArgsAndFlags(flags, false, flagHelp, flagVerbose)
		if uri == "" {
			log.Error("Arguement Path is required\n")
			os.Exit(1)
		}

		svr := mcp.NewServer(mcp.ServerOptions{
			ServerName:    "abcoder",
			ServerVersion: Version,
			Verbose:       *flagVerbose,
			ASTReadToolsOptions: tool.ASTReadToolsOptions{
				RepoASTsDir: uri,
			},
		})
		if err := svr.ServeStdio(); err != nil {
			log.Error("Failed to run MCP server: %v\n", err)
			os.Exit(1)
		}
}
```

### 1.2 mcp.NewServer

mcp Server 的实现，就是借助我们前面所说的 mcp-go。

```go
import (
	"context"
	"log"

	alog "github.com/cloudwego/abcoder/llm/log"
	"github.com/cloudwego/abcoder/llm/tool"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

type Server struct {
	Server *server.MCPServer
}

type Tool struct {
	mcp.Tool
	Handler func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error)
}

type ServerOptions struct {
	ServerName    string
	ServerVersion string
	Verbose       bool
	tool.ASTReadToolsOptions
}

func NewServer(options ServerOptions) *Server {
	opts := []server.ServerOption{
		server.WithPromptCapabilities(false),
		server.WithToolCapabilities(false),
	}
	if options.Verbose {
		opts = append(opts, server.WithLogging())
	}
	// Create a new MCP server
	mcpServer := server.NewMCPServer(options.ServerName, options.ServerVersion, opts...)

	// Enable sampling capability
	// mcpServer.EnableSampling()
  // 获取 tools
	tools := getASTTools(options.ASTReadToolsOptions)
	for _, tool := range tools {
		mcpServer.AddTool(tool.Tool, tool.Handler)
	}

	mcpServer.AddPrompt(mcp.NewPrompt("prompt_analyze_repo", mcp.WithPromptDescription("A prompt for analyzing code repository")), handleAnalyzeRepoPrompt)

	mcpServer.AddNotificationHandler("notification", handleNotification)

	// // Start the stdio server
	// log.Println("Starting sampling example server...")
	// if err := server.ServeStdio(mcpServer); err != nil {
	// 	log.Fatalf("Server error: %v", err)
	// }
	return &Server{
		Server: mcpServer,
	}
}

func handleNotification(
	ctx context.Context,
	notification mcp.JSONRPCNotification,
) {
	log.Printf("Received notification: %s", notification.Method)
}

func (s *Server) ServeStdio() error {
	return server.ServeStdio(s.Server, server.WithErrorLogger(log.Default()))
}

func (s *Server) ServeHTTP(addr string) error {
	httpServer := server.NewStreamableHTTPServer(s.Server, server.WithLogger(alog.NewStdLogger()))
	return httpServer.Start(addr)
}
```

大多数都比较好理解，获取 tools 的地方比较复杂。我们来看看:

```go
func getASTTools(opts tool.ASTReadToolsOptions) []Tool {
  // 创建 ASTReadTools 实例，加载所有保存的 Repo
	ast := tool.NewASTReadTools(opts)
	return []Tool{
		// 新增 Tool 实例，参数: tool 名称、tool 描述、tool 的 json schema，tool 的处理函数
		// 处理函数，都是 ast 实例的方法，用于从 repo 中获取相应的数据
		NewTool(tool.ToolListRepos, tool.DescListRepos, tool.SchemaListRepos, ast.ListRepos),
		NewTool(tool.ToolGetRepoStructure, tool.DescGetRepoStructure, tool.SchemaGetRepoStructure, ast.GetRepoStructure),
		NewTool(tool.ToolGetPackageStructure, tool.DescGetPackageStructure, tool.SchemaGetPackageStructure, ast.GetPackageStructure),
		NewTool(tool.ToolGetFileStructure, tool.DescGetFileStructure, tool.SchemaGetFileStructure, ast.GetFileStructure),
		NewTool(tool.ToolGetASTNode, tool.DescGetASTNode, tool.SchemaGetASTNode, ast.GetASTNode),
	}
}

type ASTReadTools struct {
	opts  ASTReadToolsOptions
	repos sync.Map                            // repo name -> Repository 的映射 
	tools map[string]tool.InvokableTool       // tool name -> tool 的映射
}

func NewASTReadTools(opts ASTReadToolsOptions) *ASTReadTools {
	// 创建 ASTReadTools 实例，并初始化 opts 和 tools 字典
	ret := &ASTReadTools{
		opts: opts,
		tools: map[string]tool.InvokableTool{}, // 用来存储各种可调用的工具
	}

	// 读取 opts.RepoASTsDir 目录下所有 .json 文件路径
	files, err := filepath.Glob(filepath.Join(opts.RepoASTsDir, "*.json"))
	if err != nil {
		panic(err) // 如果扫描目录出错，直接终止程序
	}

	// 遍历这些 JSON 文件
	for _, f := range files {
		// 使用 uniast.LoadRepo 解析 JSON 文件为 Repo 对象
		if repo, err := uniast.LoadRepo(f); err != nil {
			panic("Load Uniast JSON file failed: " + err.Error())
		} else {
			// 把解析到的 Repo 存储到 ret.repos（线程安全的存储）
			ret.repos.Store(repo.Name, repo)
		}
	}

	// 监听 RepoASTsDir 目录下文件变化（使用 fsnotify）
	abutil.WatchDir(opts.RepoASTsDir, func(op fsnotify.Op, file string) {
		// 只处理以 .json 结尾的文件
		if !strings.HasSuffix(file, ".json") {
			return
		}

		// 文件新增或修改
		if op&fsnotify.Write != 0 || op&fsnotify.Create != 0 {
			if repo, err := uniast.LoadRepo(file); err != nil {
				log.Error("Load Uniast JSON file failed: %v", err)
			} else {
				ret.repos.Store(repo.Name, repo) // 更新到内存
			}
		} else if op&fsnotify.Remove != 0 {
			// 文件被删除时，从内存删除对应数据
			ret.repos.Delete(filepath.Base(file))
		}
	})

	// 注册工具：列出所有 Repos
	tt, err := utils.InferTool(string(ToolListRepos),
		DescListRepos,
		ret.ListRepos,
		utils.WithMarshalOutput(func(ctx context.Context, output interface{}) (string, error) {
			return abutil.MarshalJSONIndent(output) // 美化 JSON 输出
		}))
	if err != nil {
		panic(err)
	}
	ret.tools[ToolListRepos] = tt

	// 注册工具：获取某个 Repo 的结构
	tt, err = utils.InferTool(ToolGetRepoStructure,
		DescGetRepoStructure,
		ret.GetRepoStructure,
		utils.WithMarshalOutput(func(ctx context.Context, output interface{}) (string, error) {
			return abutil.MarshalJSONIndent(output)
		}))
	if err != nil {
		panic(err)
	}
	ret.tools[ToolGetRepoStructure] = tt

	// 注册工具：获取某个包的结构
	tt, err = utils.InferTool(string(ToolGetPackageStructure),
		string(DescGetPackageStructure),
		ret.GetPackageStructure,
		utils.WithMarshalOutput(func(ctx context.Context, output interface{}) (string, error) {
			return abutil.MarshalJSONIndent(output)
		}))
	if err != nil {
		panic(err)
	}
	ret.tools[ToolGetPackageStructure] = tt

	// 注册工具：获取某个文件的结构
	tt, err = utils.InferTool(string(ToolGetFileStructure),
		string(DescGetFileStructure),
		ret.GetFileStructure,
		utils.WithMarshalOutput(func(ctx context.Context, output interface{}) (string, error) {
			return abutil.MarshalJSONIndent(output)
		}))
	if err != nil {
		panic(err)
	}
	ret.tools[ToolGetFileStructure] = tt

	// 注册工具：获取 AST 节点
	tt, err = utils.InferTool(ToolGetASTNode,
		string(DescGetASTNode),
		ret.GetASTNode,
		utils.WithMarshalOutput(func(ctx context.Context, output interface{}) (string, error) {
			return abutil.MarshalJSONIndent(output)
		}))
	if err != nil {
		panic(err)
	}
	ret.tools[ToolGetASTNode] = tt

	return ret
}

```