---
weight: 1
title: "ABcoder Parse"
date: 2025-08-14T16:00:00+08:00
lastmod: 2025-08-14T16:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "ABcoder Parse 解析任意语言的代码到统一抽象语法树（UniAST）"
featuredImage: 

tags: ["mcp"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

## 1. Abcoder 介绍

下面是我在trae 结合 abcoder 提问获取的有关 abcoder 代码结构的回复。

提问: 请你以表格的方式列举出 abcoder 包含哪些模块，这些模块的作用，提供了哪些接口和对象。并以简化代码的方式给出abcoder 核心代码的实现框架，展示这些接口和对象的关系。


### 1.1 📊 abcoder 模块结构表

| 模块路径 | 模块名称 | 主要作用 | 核心接口/对象 | 功能描述 |
|---------|----------|----------|---------------|----------|
| `lang/uniast` | 统一AST层 | 定义跨语言的统一代码结构 | `Repository`, `Node`, `Module`, `Package`, `Function`, `Type`, `Var` | 提供语言无关的AST表示，支持代码分析和转换 |
| `lang` | 语言解析入口 | 统一的代码解析入口 | `Parse`, `Write` | 协调不同语言的解析和写入操作 |
| `lang/golang/parser` | Go解析器 | 解析Go代码为统一AST | `GoParser`, `ParseRepo`, `ParsePackage`, `ParseNode` | 将Go代码解析为统一AST格式 |
| `lang/golang/writer` | Go写入器 | 将统一AST写回Go代码 | `Writer`, `WriteRepo`, `WriteModule` | 将统一AST转换回Go源代码 |
| `lang/rust` | Rust支持 | Rust语言的解析和规格化 | `RustParser`, `getDefaultLSP` | Rust语言的LSP集成和解析支持 |
| `lang/python` | Python支持 | Python语言的解析和规格化 | `PythonParser`, `getDefaultLSP` | Python语言的LSP集成和解析支持 |
| `lang/cxx` | C++支持 | C++语言的解析和规格化 | `CxxParser`, `getDefaultLSP` | C++语言的LSP集成和解析支持 |
| `lang/collect` | 符号收集 | 通过LSP收集代码符号 | `Collector`, `Collect`, `Export` | 通过LSP协议收集代码中的符号信息 |
| `lang/lsp` | LSP客户端 | 语言服务器协议实现 | `LSPClient`, `Handler`, `ClientOptions` | 与各种语言的LSP服务器通信 |
| `llm/tool` | LLM工具 | 为LLM提供AST操作工具 | `ASTReadTools`, `ASTWriteTools`, `MCPClient` | 为AI助手提供代码结构读取和修改能力 |
| `llm` | LLM集成 | 大语言模型集成层 | `Generator`, `ChatModel`, `MakeAgent` | 集成各种大语言模型，提供代码智能分析 |
| `llm/agent` | AI代理 | 代码分析AI代理 | `Analyzer`, `MakeCodeAnalyzer` | 基于LLM的代码分析和重构代理 |

### 1.2 🔧 核心接口和对象关系


#### 统一AST层 (uniast) - 核心数据结构

```go
// 简化版核心结构
type Repository struct {
    Name    string              // 仓库ID
    Path    string              // 仓库路径
    Modules map[string]*Module // 模块映射
    Graph   map[string]*Node    // 节点图
}

type Node struct {
    Identity                    // 唯一标识
    Type     NodeType           // 节点类型: FUNC, TYPE, VAR
    FileLine                    // 文件位置信息
    Content  string             // 代码内容
    
    // 关系定义
    Dependencies []Relation    // 依赖关系
    References   []Relation    // 引用关系
    Implements   []Relation    // 实现关系
    Inherits     []Relation    // 继承关系
}

type Identity struct {
    ModPath string // 模块路径
    PkgPath string // 包路径
    Name    string // 名称
}
```

#### 语言解析器接口

```go
// 统一解析接口
type Parser interface {
    ParseRepo(ctx context.Context, path string) (*Repository, error)
    ParsePackage(pkgPath string) (*Package, error)
    ParseNode(nodeID string) (*Node, error)
}

// 具体语言实现
type GoParser struct { /* Go特定实现 */ }
type RustParser struct { /* Rust特定实现 */ }
type PythonParser struct { /* Python特定实现 */ }
```

#### LLM工具层接口

```go
// AST读取工具
type ASTReadTools struct {
    GetRepoStructure(repoName string) (*RepoStructure, error)
    GetPackageStructure(modPath, pkgPath string) (*PackageStructure, error)
    GetFileStructure(filePath string) (*FileStructure, error)
    GetASTNode(nodeID string) (*NodeDetail, error)
}

// AST写入工具
type ASTWriteTools struct {
    WriteASTNode(nodeID string, newContent string) error
    PatchImports(filePath string, imports []Import) error
}

// LLM集成接口
type Generator interface {
    Call(ctx context.Context, input string) (string, error)
}
```

### 1.3 🏗️ 核心代码框架实现

#### 主解析流程 (lang/parse.go)

```go
func Parse(ctx context.Context, uri string, opts ParseOptions) ([]byte, error) {
    // 1. 检查LSP服务器配置
    language, lspPath := checkLSP(opts.Language, opts.LSP)
    
    // 2. 初始化LSP客户端
    client := lsp.NewLSPClient(uri, openfile, lsp.ClientOptions{
        Server: lspPath,
        Language: language,
    })
    
    // 3. 收集符号信息
    repo := collectSymbol(ctx, client, uri, opts.CollectOption)
    
    // 4. 构建依赖图
    repo.BuildGraph()
    
    // 5. 序列化为JSON
    return json.Marshal(repo)
}
```

#### 统一AST构建流程 (uniast/repository.go)

```go
func (r *Repository) BuildGraph() error {
    // 1. 遍历所有模块
    for _, module := range r.Modules {
        // 2. 遍历包和文件
        for _, pkg := range module.Packages {
            for _, file := range pkg.Files {
                // 3. 收集所有节点
                for _, node := range file.Nodes {
                    // 4. 建立节点间关系
                    r.AddRelation(node, RelationDependency, depNode)
                    r.AddRelation(node, RelationReference, refNode)
                }
            }
        }
    }
    return nil
}
```

#### LLM工具调用流程 (llm/tool/ast_read.go)

```go
func (t *ASTReadTools) GetASTNode(nodeID string) (*NodeDetail, error) {
    // 1. 解析节点ID
    identity := ParseNodeID(nodeID)
    
    // 2. 获取仓库
    repo := t.getRepo(identity.ModPath)
    
    // 3. 查找节点
    node := repo.GetNode(identity)
    
    // 4. 获取相关节点信息
    deps := t.getRelatedNodes(node.Dependencies)
    refs := t.getRelatedNodes(node.References)
    
    // 5. 返回完整信息
    return &NodeDetail{
        Node:         node,
        Dependencies: deps,
        References:   refs,
    }, nil
}
```

#### 语言特定解析器实现 (golang/parser/parser.go)

```go
func (p *GoParser) ParseRepo(ctx context.Context) (*Repository, error) {
    // 1. 加载Go模块
    module := p.loadModule()
    
    // 2. 解析所有包
    packages := p.parsePackages()
    
    // 3. 构建统一AST
    repo := NewRepository(p.modulePath)
    
    for _, pkg := range packages {
        for _, file := range pkg.Files {
            // 4. 转换Go AST到统一AST
            nodes := p.convertGoAST(file.AST)
            repo.AddNodes(nodes)
        }
    }
    
    return repo, nil
}
```

### 1.4 🔄 模块间协作关系图

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   LLM Agent     │    │   AST Tools     │    │   Language      │
│   (Analyzer)    │◄──►│   (Read/Write)  │◄──►│   Parser        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Unified AST   │    │   LSP Client    │
                       │   (uniast)      │    │   (lsp)         │
                       └─────────────────┘    └─────────────────┘
                                ▲                        ▲
                                │                        │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Code          │    │   Language      │
                       │   Collection    │    │   Servers       │
                       │   (collect)     │    │   (rust-analyzer│
                       └─────────────────┘    │   pylsp, etc)   │
                                                └─────────────────┘
```

### 1.5 📋 使用示例

#### 解析代码仓库
```bash
# 解析Go项目
abcoder parse /path/to/go/project --language go

# 解析Rust项目
abcoder parse /path/to/rust/project --language rust --lsp rust-analyzer
```

#### 通过LLM工具查询代码结构
```go
// 获取仓库结构
tools := NewASTReadTools()
repoInfo := tools.GetRepoStructure("github.com/my/project")

// 获取特定节点信息
nodeInfo := tools.GetASTNode("github.com/my/project/pkg/mypackage/MyStruct")
```

我们先来看 parser 过程。

## 2. Parse 过程
### 2.1 入口
main 函数 Parse 的入口如下，核心调用的是 lang.Parse 函数: 

```go
func main() {
	switch action {
	case "parse":

		language, uri := parseArgsAndFlags(flags, true, flagHelp, flagVerbose)

		if flagVerbose != nil && *flagVerbose {
			log.SetLogLevel(log.DebugLevel)
			opts.Verbose = true
		}

		opts.Language = language
		if flagLsp != nil {
			opts.LSP = *flagLsp
		}

		out, err := lang.Parse(context.Background(), uri, opts)
		if err != nil {
			log.Error("Failed to parse: %v\n", err)
			os.Exit(1)
		}

		if flagOutput != nil && *flagOutput != "" {
			if err := utils.MustWriteFile(*flagOutput, out); err != nil {
				log.Error("Failed to write output: %v\n", err)
			}
		} else {
			fmt.Fprintf(os.Stdout, "%s\n", out)
		}
    }
}
```

### 2.2 解析过程

```go
// Parse 解析指定文件或目录，收集符号信息并返回 JSON 格式的结果。
// ctx        - 上下文，用于控制超时/取消
// uri        - 要解析的文件或目录路径
// args       - 解析选项（包含语言、LSP 配置、收集选项等）
func Parse(ctx context.Context, uri string, args ParseOptions) ([]byte, error) {
    // 如果传入的 uri 不是绝对路径，则转成绝对路径
    if !filepath.IsAbs(uri) {
        uri, _ = filepath.Abs(uri)
    }

    // 检查语言和 LSP 服务端路径是否可用
    // 返回 l（语言标识），lspPath（LSP 服务器路径），err（错误信息）
    // 以 python 为例，l="python"，lspPath="pylsp" 如果自定 args.LSP 并且存在，lspPath=args.LSP
    l, lspPath, err := checkLSP(args.Language, args.LSP)
    if err != nil {
        return nil, err
    }

    // 检查 repo 路径是否有效，并返回：
    // 以 python 为例，openfile="", opentime 是以统计的文件大小综合计算出来最大等待时间
    openfile, opentime, err := checkRepoPath(uri, l)
    if err != nil {
        return nil, err
    }

    // 定义一个 LSPClient 指针，初始为 nil
    var client *lsp.LSPClient

    // 如果配置了 LSP 服务器路径，则初始化 LSP 客户端
    if lspPath != "" {
        log.Info("start initialize LSP server %s...\n", lspPath)

        var err error
        // 创建 LSP 客户端，传入 uri、openfile、opentime 以及客户端选项
        // 1. LSP 客户端的初始化
        client, err = lsp.NewLSPClient(uri, openfile, opentime, lsp.ClientOptions{
            Server:   lspPath, // LSP 服务器可执行文件路径
            Language: l,       // 编程语言类型
            Verbose:  args.Verbose, // 是否启用详细日志
        })
        if err != nil {
            log.Error("failed to initialize LSP server: %v\n", err)
            return nil, err
        }
        log.Info("end initialize LSP server")
    }

    // 调用 collectSymbol 收集符号信息
    // client 可能为 nil（如果未配置 LSP 服务端）
    // 2. 如何借助 LSP 收集符号信息，包括 repo.BuildGraph()
    repo, err := collectSymbol(ctx, client, uri, args.CollectOption)
    if err != nil {
        log.Error("Failed to collect symbols: %v\n", err)
        return nil, err
    }
    log.Info("all symbols collected, start writing to stdout...\n")

    // 如果指定了 RepoID，则覆盖 repo.Name
    if args.RepoID != "" {
        repo.Name = args.RepoID
    }

    // 设置 AST 版本（统一抽象语法树版本号）
    repo.ASTVersion = uniast.Version

    // 将 repo 对象序列化为 JSON
    out, err := json.Marshal(repo)
    if err != nil {
        log.Error("Failed to marshal repository: %v\n", err)
        return nil, err
    }

    // 返回 JSON 数据
    return out, nil
}

```

如果对比之前大模型结合 Abcoder 给我们总结的解析过程，我们可以发现，总结的过程还是非常准确的。这里我们重点需要关注:
1. `lsp.NewLSPClient`: LSP 如何初始化
2. `collectSymbol`: 如何与 LSP 交互获取符号信息


```go
func Parse(ctx context.Context, uri string, opts ParseOptions) ([]byte, error) {
    // 1. 检查LSP服务器配置
    language, lspPath := checkLSP(opts.Language, opts.LSP)
    
    // 2. 初始化LSP客户端
    client := lsp.NewLSPClient(uri, openfile, lsp.ClientOptions{
        Server: lspPath,
        Language: language,
    })
    
    // 3. 收集符号信息
    repo := collectSymbol(ctx, client, uri, opts.CollectOption)
    
    // 4. 构建依赖图
    repo.BuildGraph()
    
    // 5. 序列化为JSON
    return json.Marshal(repo)
}
```

### 2.3 LSP 客户端初始化

```go
func NewLSPClient(repo string, openfile string, wait time.Duration, opts ClientOptions) (*LSPClient, error) {
	// launch golang LSP server
    // 1. 启动 LSP 服务器，内部通过 `exec.Command(lspPath)` 启动 LSP server
    // 返回:
    // stdin, err := cmd.StdinPipe()
    // stdout, err := cmd.StdoutPipe()
    // type rwc struct {
    //     io.ReadCloser
    //     io.WriteCloser
    //     cmd *exec.Cmd
    // } 
    // 
	svr, err := startLSPSever(opts.Server)
	if err != nil {
		return nil, err
	}

	cli, err := initLSPClient(context.Background(), svr, NewURI(repo), opts.Verbose)
	if err != nil {
		return nil, err
	}

	cli.ClientOptions = opts
	cli.files = make(map[DocumentURI]*TextDocumentItem)

	if openfile != "" {
		_, err := cli.DidOpen(context.Background(), NewURI(openfile))
		if err != nil {
			return nil, err
		}
	}

	time.Sleep(wait)

	return cli, nil
}
```

LSP 客户端初始化包括:
1. 通过 `exec.Command(lspPath)` 启动 LSP server
2. 初始化与 LSP server 交互的客户端

#### 启动 LSP 服务
startLSPServer 返回的 rw 实现了 io.ReadWriteCloser 接口，用于 jsonrpc2 库的连接。


```go
// start a LSP process and return its io
func startLSPSever(path string) (io.ReadWriteCloser, error) {
	// Launch rust-analyzer
	cmd := exec.Command(path)

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("Failed to get stdin pipe: %v", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("Failed to get stdout pipe: %v", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("Failed to get stderr pipe: %v", err)
	}
	// Read stderr in a separate goroutine
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			log.Error("LSP server stderr: %s\n", scanner.Text())
			// os.Exit(2)
		}
	}()

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("Failed to start LSP server: %v", err)
	}

	return rwc{stdout, stdin, cmd}, nil
}


type rwc struct {
	io.ReadCloser
	io.WriteCloser
	cmd *exec.Cmd
}
```

#### 初始化 LSP 客户端
初始化分为如下几步:
1. LSP 客户端使用 jsonrpc2 库通过 标准输入/输出与 LSP 服务端交互
2. `jsonrpc2.NewConn(ctx, stream, h)`，conn 会启动一个 goroutine 循环去从 stream 读消息，解析成 Request 或 Response 对象，然后调用 h.Handle(...)
2. 通过 `conn.Call` 向 LSP 服务端发送 initialize 请求，解析服务端返回的 capabilities，并对 LSP 支持的功能做检查
3. 通过 `conn.Notify` 向服务端发送 "initialized" 通知，表明客户端初始化完成


```go
func initLSPClient(ctx context.Context, svr io.ReadWriteCloser, dir DocumentURI, verbose bool) (*LSPClient, error) {
	// 创建 LSP 请求处理器（自定义的 handler，用于接收和处理 LSP 服务端发来的消息）
	h := newLSPHandler()

	// 将 LSP 服务端的连接封装成 JSON-RPC2 流，指定 VSCode 兼容的对象编解码器
	stream := jsonrpc2.NewBufferedStream(svr, jsonrpc2.VSCodeObjectCodec{})

	// 创建 JSON-RPC2 连接对象，绑定上下文、数据流和消息处理器
	conn := jsonrpc2.NewConn(ctx, stream, h)

	// 封装为自定义的 LSPClient 结构体（包含连接和消息处理器）
	cli := &LSPClient{Conn: conn, lspHandler: h}

	// 根据 verbose 参数决定 trace 日志等级
	trace := "off"
	if verbose {
		trace = "verbose"
	}

	// 客户端声明支持的能力（Capabilities）
	// 这里显式开启 documentSymbol 的分层符号支持（hierarchicalDocumentSymbolSupport）
	cs := map[string]interface{}{
		"documentSymbol": map[string]interface{}{
			"hierarchicalDocumentSymbolSupport": true,
		},
	}

	// 构造 LSP 初始化请求参数
	initParams := initializeParams{
		ProcessID:    os.Getpid(),              // 当前客户端进程 ID
		RootURI:      lsp.DocumentURI(dir),     // 项目的根目录 URI
		Capabilities: cs,                       // 客户端支持的功能
		Trace:        lsp.Trace(trace),         // Trace 日志等级
		ClientInfo:   lsp.ClientInfo{Name: "vscode"}, // 模拟 VSCode 客户端
	}

	// 保存初始化结果
	var initResult initializeResult

	// 发送 "initialize" 请求给 LSP 服务端，并等待响应
	if err := conn.Call(ctx, "initialize", initParams, &initResult); err != nil {
		return nil, err
	}

	// 解析服务端返回的 capabilities（能力声明）
	vs, ok := initResult.Capabilities.(map[string]interface{})
	if !ok || vs == nil {
		return nil, fmt.Errorf("invalid server capabilities: %v", initResult.Capabilities)
	}

	// 检查服务端是否支持 definitionProvider（跳转到定义）
	definitionProvider, ok := vs["definitionProvider"].(bool)
	if !ok || !definitionProvider {
		return nil, fmt.Errorf("server did not provide Definition")
	}

	// 检查是否支持 typeDefinitionProvider（跳转到类型定义）
	typeDefinitionProvider, ok := vs["typeDefinitionProvider"].(bool)
	if !ok || !typeDefinitionProvider {
		return nil, fmt.Errorf("server did not provide TypeDefinition")
	}

	// 检查是否支持 documentSymbolProvider（文档符号）
	documentSymbolProvider, ok := vs["documentSymbolProvider"].(bool)
	if !ok || !documentSymbolProvider {
		return nil, fmt.Errorf("server did not provide DocumentSymbol")
	}

	// 检查是否支持 referencesProvider（查找引用）
	referencesProvider, ok := vs["referencesProvider"].(bool)
	if !ok || !referencesProvider {
		return nil, fmt.Errorf("server did not provide References")
	}

	// 检查是否支持 semanticTokensProvider（语义高亮）
	semanticTokensProvider, ok := vs["semanticTokensProvider"].(map[string]interface{})
	if !ok || semanticTokensProvider == nil {
		return nil, fmt.Errorf("server did not provide SemanticTokensProvider")
	}

	// 检查是否支持按范围返回语义 token（range 模式）
	semanticTokensRange, ok := semanticTokensProvider["range"].(bool)
	cli.hasSemanticTokensRange = ok && semanticTokensRange

	// 获取 semanticTokensProvider 的 legend（语义 token 类型和修饰符）
	legend, ok := semanticTokensProvider["legend"].(map[string]interface{})
	if !ok || legend == nil {
		return nil, fmt.Errorf("server did not provide SemanticTokensProvider.legend")
	}

	// 获取 tokenTypes（token 类型列表）
	tokenTypes, ok := legend["tokenTypes"].([]interface{})
	if !ok || tokenTypes == nil {
		return nil, fmt.Errorf("server did not provide SemanticTokensProvider.legend.tokenTypes")
	}

	// 获取 tokenModifiers（token 修饰符列表）
	tokenModifiers, ok := legend["tokenModifiers"].([]interface{})
	if !ok || tokenModifiers == nil {
		return nil, fmt.Errorf("server did not provide SemanticTokensProvider.legend.tokenModifiers")
	}

	// 将 tokenTypes 保存到客户端
	for _, t := range tokenTypes {
		cli.tokenTypes = append(cli.tokenTypes, t.(string))
	}

	// 将 tokenModifiers 保存到客户端
	for _, m := range tokenModifiers {
		cli.tokenModifiers = append(cli.tokenModifiers, m.(string))
	}

	// 向服务端发送 "initialized" 通知，表明客户端初始化完成
	if err := conn.Notify(ctx, "initialized", lsp.InitializeParams{}); err != nil {
		return nil, err
	}

	return cli, nil
}

```


### 2.4 collectSymbol

Repository 的生成通过 `Collector` 完成，下面是其每个方法的说明:

| 方法名                  | 作用                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------- |
| `fileLine`           | 根据 `Location` 生成 `uniast.FileLine` 信息，包含文件相对路径、行号、字符偏移量等，用于标记代码元素在源文件中的具体位置。           |
| `newModule`          | 创建一个新的 `uniast.Module` 模块实例，并返回它。                                                      |
| `Export`             | 将当前收集的符号、文件、模块等信息导出为 `uniast.Repository` 结构，完成模块、包、文件、符号之间的关联和整理。                      |
| `filterLocalSymbols` | 过滤掉位于其他符号内部的本地符号，确保只保留顶层可导出的符号。                                                        |
| `exportSymbol`       | 将单个 `DocumentSymbol` 导出为 `uniast.Identity` 及其对应的 AST 元素（函数、类型、变量等），并递归处理依赖、方法、类型参数等关系。 |
| `mapKind`            | 将 LSP 的 `SymbolKind` 映射为 `uniast.TypeKind`（如 struct、enum、interface 等）。                 |
| `switchSpec`                | 根据语言类型返回对应的语言规范对象（LanguageSpec）。                |
| `NewCollector`              | 创建并初始化一个 Collector 实例，设置仓库路径、LSP 客户端和语言规范。      |
| `configureLSP`              | 配置 LSP 客户端，针对 Python 可关闭标准库符号的收集。               |
| `Collect`                   | 核心收集方法：扫描仓库文件，收集符号、导入语句、依赖关系和函数信息。              |
| `internal`                  | 判断给定位置的符号是否属于当前仓库（内部符号）。                        |
| `getSymbolByToken`          | 根据 Token 查找对应的符号。                               |
| `getSymbolByTokenWithLimit` | 带深度限制的 Token 查找符号，处理外部符号加载。                     |
| `findMatchingSymbolIn`      | 在符号列表中找到包含指定位置的最具体实体符号。                         |
| `getSymbolByLocation`       | 根据符号位置获取 DocumentSymbol，支持外部符号加载及 Unknown 符号处理。 |
| `getDepsWithLimit`          | 根据索引列表获取符号依赖，同时返回排序好的依赖列表。                      |
| `collectImpl`               | 收集对象/类的实现信息，包括 receiver、实现接口以及 impl 头信息。        |
| `needProcessExternal`       | 判断外部符号是否需要处理（如对象或方法符号）。                         |
| `processSymbol`             | 根据符号类型处理方法、函数和变量的信息，收集依赖和类型信息。                  |
| `updateFunctionInfo`        | 更新函数信息，包括类型参数、输入输出、接收者和函数签名。                    |


```go
func collectSymbol(ctx context.Context, cli *lsp.LSPClient, repoPath string, opts collect.CollectOption) (repo *uniast.Repository, err error) {
    // go 语言直接调用goParser
	if opts.Language == uniast.Golang {
		repo, err = callGoParser(ctx, repoPath, opts)
		if err != nil {
			return nil, err
		}
	} else {
        // 其他语言，创建 Collector
		collector := collect.NewCollector(repoPath, cli)
		collector.CollectOption = opts
		log.Info("start collecting symbols...\n")
        // 通过 client 调用 LSP 方法，获取文件符号
        // 主收集方法，扫描所有文件并收集符号信息
        // 将解析的 AST 放到 collector 的容器属性中

		err = collector.Collect(ctx)
		if err != nil {
			return nil, err
		}
		log.Info("all symbols collected.\n")
		log.Info("start exporting symbols...\n")
        // 从容器属性生成 repo
		repo, err = collector.Export(ctx)
		if err != nil {
			return nil, err
		}
	}
    // 生成 repo 的 Graph
	if err := repo.BuildGraph(); err != nil {
		return nil, err
	}
	return repo, nil
}


func NewCollector(repo string, cli *LSPClient) *Collector {
	ret := &Collector{
		repo:  repo,
		cli:   cli,
		spec:  switchSpec(cli.ClientOptions.Language),
		syms:  map[Location]*DocumentSymbol{},
		funcs: map[*DocumentSymbol]functionInfo{},
		deps:  map[*DocumentSymbol][]dependency{},
		vars:  map[*DocumentSymbol]dependency{},
		files: map[string]*uniast.File{},
	}
	// if cli.Language == uniast.Rust {
	// 	ret.modPatcher = &rust.RustModulePatcher{Root: repo}
	// }
	return ret
}


type Repository struct {
	ASTVersion string
	Name       string             `json:"id"` // module name
	Path       string             // repo path
	Modules    map[string]*Module // module name => module
	Graph      NodeGraph          // node id => node
}
```

### 2.5 输出结果

parse 的输出结果是一个 `uniast.Repository` 结构体。Repository 被 Json 序列化之后保存到命令行指定的路径中。所有项目的解析结果都保存在这个路径下。作为后续 mcp 读取的数据源。

```go
type Repository struct {
	ASTVersion string
	Name       string             `json:"id"` // module name
	Path       string             // repo path
	Modules    map[string]*Module // module name => module
	Graph      NodeGraph          // node id => node
}


type Language string

type PkgPath = string

type Module struct {
	Language     Language
	Version      string
	Name         string               // go module name
	Dir          string               // relative path to repo
	Packages     map[PkgPath]*Package // pkage import path => Package
	Dependencies map[string]string    `json:",omitempty"`              // module name => module_path@version
	Files        map[string]*File     `json:",omitempty"`              // relative path => file info
	CompressData *string              `json:"compress_data,omitempty"` // module compress info
}

type Package struct {
	IsMain bool
	IsTest bool
	PkgPath
	Functions    map[string]*Function // Function name (may be {{func}} or {{struct.method}}) => Function
	Types        map[string]*Type     // type name => type define
	Vars         map[string]*Var      // var name => var define
	CompressData *string              `json:"compress_data,omitempty"` // package compress info
}
```

以 ABcoder 自己的解析结果为例输出如下:

```json
{
    "ASTVersion": "v0.1.3",
    "id": "D:\\Code\\github\\abcoder",
    "Path": "D:\\Code\\github\\abcoder",
    "Modules": {
		"github.com/cloudwego/abcoder": {
            "Language": "go",
            "Version": "",
            "Name": "github.com/cloudwego/abcoder",
            "Dir": ".",
            "Packages": {
                "github.com/cloudwego/abcoder": {
                    "IsMain": true,
                    "IsTest": false,
                    "PkgPath": "github.com/cloudwego/abcoder",
                    "Functions": {},
				}
			}
		},
                "github.com/cloudwego/abcoder/internal/utils": {
                    "IsMain": false,
                    "IsTest": false,
                    "PkgPath": "github.com/cloudwego/abcoder/internal/utils",
                    "Functions": {
                        "Append": {
                            "Exported": true,
                            "IsMethod": false,
                            "IsInterfaceMethod": false,
                            "ModPath": "github.com/cloudwego/abcoder",
                            "PkgPath": "github.com/cloudwego/abcoder/internal/utils",
                            "Name": "Append",
                            "File": "internal\\utils\\slice.go",
                            "Line": 33,
                            "StartOffset": 864,
                            "EndOffset": 1054,
                            "Content": "func Append[T comparable](s []T, vs ...T) []T {\r\nnext:\r\n\tfor _, v := range vs {\r\n\t\tfor _, vv := range s {\r\n\t\t\tif v == vv {\r\n\t\t\t\tcontinue next\r\n\t\t\t}\r\n\t\t}\r\n\t\ts = append(s, v)\r\n\t}\r\n\treturn s\r\n}",
                            "Signature": "func Append[T comparable](s []T, vs ...T) []T"
                        },                        
					}
				}
	}
}
```