---
weight: 1
title: "Gin"
date: 2021-06-07T22:00:00+08:00
lastmod: 2021-06-07T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go 网络库 net"
featuredImage: 

tags: ["go 库"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

在 [go 网络库 net/http 的请求处理过程]({{< ref "posts/program/go/modules/net/http.md" >}}) 中我们解析了 net/http 的请求处理流程。并说到所有基于 net/http 的 web 框架定制的其实就是 Server 中的下面几个部分:
1. Handler: 实现更丰富的路由
2. Context: 实现更丰富的请求控制逻辑(即: 中间件)
3. Request/ResponseWriter: 在 net/http 已有的 RnseWriter 和 Request 基础上包装更易用的 Request 和 Response 对象。

我们就以 Gin 为示例，看看如何实现一个简单的 Web 框架。

## 1. Gin 使用示例
我们先来看看 Gin 的一个使用示例:

```go
package web

import (
	"github.com/gin-gonic/gin"
)

// type HandlerFunc func(*Context)

func AuthHandler(word string) func(c *gin.Context) {
	return func(c *gin.Context) {
		c.JSON(200, gin.H{"visit": word})
	}
}

func StartWebServer() {
	// Creates a router without any middleware by default
	r := gin.New()

	// Global middleware
	// Logger middleware will write the logs to gin.DefaultWriter even if you set with GIN_MODE=release.
	// By default gin.DefaultWriter = os.Stdout
	r.Use(gin.Logger())

	// Recovery middleware recovers from any panics and writes a 500 if there was one.
	r.Use(gin.Recovery())

	r.GET("/test", func(c *gin.Context) {
		c.Request.URL.Path = "/test2"
		r.HandleContext(c)
	})
	r.GET("/test2", func(c *gin.Context) {
		c.JSON(200, gin.H{"hello": "world"})
	})

	// Authorization group
	// authorized := r.Group("/", AuthRequired())
	// exactly the same as:
	authorized := r.Group("/")
	// per group middleware! in this case we use the custom created
	// AuthRequired() middleware just in the "authorized" group.
	// authorized.Use(gin.AuthRequired())
	{
		authorized.GET("/login", AuthHandler("logini"))
		authorized.GET("/submit", AuthHandler("submit"))
		authorized.GET("/read", AuthHandler("read"))

		// nested group
		testing := authorized.Group("testing")
		// visit 0.0.0.0:8080/testing/analytics
		testing.GET("/analytics", AuthHandler("testing/analytics"))
	}

	// Listen and serve on 0.0.0.0:8080
	r.Run(":8080")
}

```

在这个简单的示例中:
1. `gin.New()`: 返回的 Engine struct 是框架的核心承载了框架的所有功能
2. `r.Use(gin.Logger())`: 用于向 gin 中添加中间件，来为所有 Handler 添加非业务的控制逻辑
3. `type HandlerFunc func(*Context)`: 请求处理函数被重新定义，只接受 gin 自定的 Context，自定的 Context 封装了 ResponseWriter 和 Request 提供了更加语义化的接口
4. Engine: 本身是想 net/http Handler 接口，提供了添加路由的能力，支持 Group 定义接口组，也支持基于 Group 创建中间件

我们先从 gin.Context 看起，因为这个部分相对独立和简单。

## 2. gin.Context
### 2.1 gin.Context 的定义
gin.Context 的定义如下:

```go
type HandlersChain []HandlerFunc

type Context struct {
	writermem responseWriter
	// 1. 封装了 net/http 的请求和相应
	Request   *http.Request
	Writer    ResponseWriter

	Params   Params
	// 
	handlers HandlersChain
	index    int8
	fullPath string

	engine       *Engine
	params       *Params
	skippedNodes *[]skippedNode

	// This mutex protect Keys map
	mu sync.RWMutex

	// Keys is a key/value pair exclusively for the context of each request.
	Keys map[string]interface{}

	// Errors is a list of errors attached to all the handlers/middlewares who used this context.
	Errors errorMsgs

	// Accepted defines a list of manually accepted formats for content negotiation.
	Accepted []string

	....
}

// Error represents a error's specification.
type Error struct {
	Err  error
	Type ErrorType
	Meta interface{}
}

type errorMsgs []*Error

type Param struct {
	Key   string
	Value string
}

// Params is a Param-slice, as returned by the router.
// The slice is ordered, the first URL parameter is also the first slice value.
// It is therefore safe to read values by the index.
type Params []Param
```

在 gin.Context 定义中:
1. Request/Writer: 封装了 net/http 的请求和相应
2. handlers: []HandlerFunc，这个与 middleware 中间件的实现有关

### 2.2 gin.Context 的方法
gin.Context 实现了很多方法，这些方法可以分成三类:
1. 获取请求参数、返回响应的更加语义化的接口
2. 实现了 context.Context 的接口，为了让 gin.Context 更加通用

```go
type Context
// context.Context 接口
func (c *Context) Deadline() (deadline time.Time, ok bool)
func (c *Context) Done() <-chan struct{}
func (c *Context) Err() error
func (c *Context) Value(key interface{}) interface{}

func (c *Context) Next()

// 请求和响应的语义化接口
func (c *Context) Param(key string) string
func (c *Context) PostForm(key string) string
func (c *Context) PostFormArray(key string) []string
func (c *Context) PostFormMap(key string) map[string]string
func (c *Context) ProtoBuf(code int, obj interface{})
func (c *Context) PureJSON(code int, obj interface{})
func (c *Context) Query(key string) string
....
```
这 gin.Context 的众多方法中，有一个 Next 方法是比较特殊，这个方法与中间件的实现逻辑有关。

```go
func (c *Context) Next() {
	c.index++
	for c.index < int8(len(c.handlers)) {
		c.handlers[c.index](c)
		c.index++
	}
}
```

gin.Context 会顺序执行 HandlersChain 内所有的 HandlerFunc。gin 只需要把中间件生成的 HandlerFunc 放到 context.handlers 内即可。后面讲解 Middleware 时我们会详细介绍这一部分逻辑。

## 3. 中间件
首先中间件就是一个返回 HandlerFunc 的装饰器:

```go
func Logger() HandlerFunc {
	return LoggerWithConfig(LoggerConfig{})
}

// LoggerWithFormatter instance a Logger middleware with the specified log format function.
func LoggerWithFormatter(f LogFormatter) HandlerFunc {
	return LoggerWithConfig(LoggerConfig{
		Formatter: f,
	})
}

func LoggerWithConfig(conf LoggerConfig) HandlerFunc
```

而 `Engine.Use(gin.Logger())` 则是将 Logger() 返回的 HandlerFunc 添加到自身维护的数组中:

```go
// Use attaches a global middleware to the router. ie. the middleware attached though Use() will be
// included in the handlers chain for every single request. Even 404, 405, static files...
// For example, this is the right place for a logger or error management middleware.
func (engine *Engine) Use(middleware ...HandlerFunc) IRoutes {
	engine.RouterGroup.Use(middleware...)
	engine.rebuild404Handlers()
	engine.rebuild405Handlers()
	return engine
}

// Use adds middleware to the group, see example code in GitHub.
func (group *RouterGroup) Use(middleware ...HandlerFunc) IRoutes {
	group.Handlers = append(group.Handlers, middleware...)
	return group.returnObj()
}
```
这个 RouterGroup 是什么，我们来看看 gin.Engine 的路由部分。

## 4. gin.Engine
### 4.1 gin.Engine 的结构
首先我们来看看 gin.Engine 的结构定义:

```go
// Engine is the framework's instance, it contains the muxer, middleware and configuration settings.
// Create an instance of Engine, by using New() or Default()
type Engine struct {
	// 中间件以及 
	RouterGroup

	// 下面是一些控制开关
	RedirectTrailingSlash bool
	RedirectFixedPath bool
	HandleMethodNotAllowed bool
	ForwardedByClientIP bool
	AppEngine bool
	UseRawPath bool
	UnescapePathValues bool
	RemoveExtraSlash bool
	RemoteIPHeaders []string
	TrustedPlatform string
	MaxMultipartMemory int64

	delims           render.Delims
	secureJSONPrefix string
	HTMLRender       render.HTMLRender
	FuncMap          template.FuncMap
	// 这里我们看到了 gin.Context 中一样的 HandlersChain
	allNoRoute       HandlersChain
	allNoMethod      HandlersChain
	noRoute          HandlersChain
	noMethod         HandlersChain
	
	pool             sync.Pool
	// 路由查找，就是在 httprouter 代码上做的优化
	trees            methodTrees
	maxParams        uint16
	maxSections      uint16
	trustedProxies   []string
	trustedCIDRs     []*net.IPNet
}
```

在 gin.Engine 的定义中我们需要重点关注就是下面几个字段:
1. RouterGroup: 实现接口组与中间件功能
2. allNoRoute/allNoMethod/noRoute/noMethod 这几个 HandlersChain
3. trees: 路由查找功能，复用的 httprouter 代码

### 4.2 RouterGroup
我们先来看 RouterGroup 中间件的处理逻辑。Engine.Use 最终调用的是 RouterGroup.Use，RouterGroup.Use 则将中间件返回的 Handler 维护在自己的 Handlers 内。

```go
type RouterGroup struct {
	Handlers HandlersChain
	basePath string
	engine   *Engine
	root     bool
}

// Use adds middleware to the group, see example code in GitHub.
func (group *RouterGroup) Use(middleware ...HandlerFunc) IRoutes {
	group.Handlers = append(group.Handlers, middleware...)
	return group.returnObj()
}

func (engine *Engine) Use(middleware ...HandlerFunc) IRoutes {
	engine.RouterGroup.Use(middleware...)
	engine.rebuild404Handlers()
	engine.rebuild405Handlers()
	return engine
}
```

然后我们来看 RouterGroup 接口组的定义:

```go
func (group *RouterGroup) POST(relativePath string, handlers ...HandlerFunc) IRoutes {
	return group.handle(http.MethodPost, relativePath, handlers)
}

// GET is a shortcut for router.Handle("GET", path, handle).
func (group *RouterGroup) GET(relativePath string, handlers ...HandlerFunc) IRoutes {
	return group.handle(http.MethodGet, relativePath, handlers)
}

func (group *RouterGroup) handle(httpMethod, relativePath string, handlers HandlersChain) IRoutes {
	// 获取添加的 url 的完整路径
	absolutePath := group.calculateAbsolutePath(relativePath)
	// 合并 HandlerFunc
	handlers = group.combineHandlers(handlers)
	// 添加路由
	group.engine.addRoute(httpMethod, absolutePath, handlers)
	return group.returnObj()
}

func (group *RouterGroup) combineHandlers(handlers HandlersChain) HandlersChain {
	finalSize := len(group.Handlers) + len(handlers)
	if finalSize >= int(abortIndex) {
		panic("too many handlers")
	}
	mergedHandlers := make(HandlersChain, finalSize)
	copy(mergedHandlers, group.Handlers)
	copy(mergedHandlers[len(group.Handlers):], handlers)
	return mergedHandlers
}

func (group *RouterGroup) calculateAbsolutePath(relativePath string) string {
	return joinPaths(group.basePath, relativePath)
}
```

可以看到在最终调用的 handle 方法中，RouterGroup 将 Use 进来的 HandlerFunc 以及通过参数传递进来的 HandlerFunc 做一次合并，并调用了 engine.addRoute 方法。所以我们接着看 gin.Engine 里面的路由管理。

### 4.3 trees
engine.addRoute 方法与 trees 属性相关。我们先来看这个 addRoute 方法的实现:

```go
func (engine *Engine) addRoute(method, path string, handlers HandlersChain) {
	assert1(path[0] == '/', "path must begin with '/'")
	assert1(method != "", "HTTP method can not be empty")
	assert1(len(handlers) > 0, "there must be at least one handler")

	debugPrintRoute(method, path, handlers)
	// 这一部分就是 httprouter 路由管理部分的代码了
	root := engine.trees.get(method)
	if root == nil {
		root = new(node)
		root.fullPath = "/"
		engine.trees = append(engine.trees, methodTree{method: method, root: root})
	}
	// node.addRoute
	root.addRoute(path, handlers)

	// Update maxParams
	if paramsCount := countParams(path); paramsCount > engine.maxParams {
		engine.maxParams = paramsCount
	}

	if sectionsCount := countSections(path); sectionsCount > engine.maxSections {
		engine.maxSections = sectionsCount
	}
}


```

如果你熟悉 httprouter 的代码，这里的 trees、node 就是 httprouter 的实现了。

```go
type node struct {
	path      string
	indices   string
	wildChild bool
	nType     nodeType
	priority  uint32
	children  []*node // child nodes, at most 1 :param style node at the end of the array
	// 合并后的 HandlerFunc
	handlers  HandlersChain
	fullPath  string
}

type methodTree struct {
	method string
	root   *node
}

type methodTrees []methodTree

func (trees methodTrees) get(method string) *node {
	for _, tree := range trees {
		if tree.method == method {
			return tree.root
		}
	}
	return nil
}

// addRoute adds a node with the given handle to the path.
// Not concurrency-safe!
func (n *node) addRoute(path string, handlers HandlersChain){
	// 省略 Radix Tree 的插入逻辑
	child := node{
				path:      n.path[i:],
				wildChild: n.wildChild,
				indices:   n.indices,
				children:  n.children,
				handlers:  n.handlers,
				priority:  n.priority - 1,
				fullPath:  n.fullPath,
			}
}
```

至此我们就可以看到了，中间件返回的 HandlerFunc 以及作为参数传入的 HandlerFunc 在合并都保存在了 Radix Tree 的 node 节点中。

## 5. gin 的请求处理过程
有了前面的铺垫，最后我们来看看 gin 的请求处理过程:

```go
// ServeHTTP conforms to the http.Handler interface.
func (engine *Engine) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	c := engine.pool.Get().(*Context)
	c.writermem.reset(w)
	c.Request = req
	c.reset()

	engine.handleHTTPRequest(c)

	engine.pool.Put(c)
}

func (engine *Engine) handleHTTPRequest(c *Context) {
	httpMethod := c.Request.Method
	rPath := c.Request.URL.Path
	unescape := false
	if engine.UseRawPath && len(c.Request.URL.RawPath) > 0 {
		rPath = c.Request.URL.RawPath
		unescape = engine.UnescapePathValues
	}

	if engine.RemoveExtraSlash {
		rPath = cleanPath(rPath)
	}

	// Find root of the tree for the given HTTP method
	t := engine.trees
	for i, tl := 0, len(t); i < tl; i++ {
		if t[i].method != httpMethod {
			continue
		}
		root := t[i].root
		// Find route in tree
		// 1. 路由匹配，返回匹配到的 Radix node
		value := root.getValue(rPath, c.params, c.skippedNodes, unescape)
		if value.params != nil {
			c.Params = *value.params
		}
		if value.handlers != nil {
			// 2. handlers 赋值 
			c.handlers = value.handlers
			c.fullPath = value.fullPath
			// 3. 循环执行 handlers 内的 HandlerFunc
			c.Next()
			c.writermem.WriteHeaderNow()
			return
		}
		
	}

	......
}

func (n *node) getValue(path string, params *Params, skippedNodes *[]skippedNode, unescape bool) (value nodeValue) 

type nodeValue struct {
	handlers HandlersChain
	params   *Params
	tsr      bool
	fullPath string
}
```

至此，我们总结一下 gin 中请求的执行顺序和 Middleware 的生效过程:
1. gin.Engine.Use/RouterGroup.Use 方法会把生成的中间件保存在 RouterGroup 的 Handlers 字段中
2. 在使用 gin.Engine.Get/RouterGroup.Get 等方法添加路由时，RouterGroup 会把 Handlers 字段中的 HandlerFunc以及参数传入的 HandlerFunc 合并，存放在 Radix Tree 的 node 节点的 handlers 字段中
3. 在请求处理的过程中，gin 根据 method 和 url 进行路由匹配，把匹配到的 node 节点的 handlers 字段赋值给 gin.Context handlers 字段
4. 调用 gin.Context.Next() 方法驱动 HandlerFunc 的执行

### 5.1 gin Middleware 的执行技巧
gin Middleware 在编写时有一个小技巧，如果你像下面这样自定义一个 Middleware:

```go
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		t := time.Now()

		// Set example variable
		c.Set("example", "12345")

		// before request

		c.Next()

		// after request
		latency := time.Since(t)
		log.Print(latency)

		// access the status we are sending
		status := c.Writer.Status()
		log.Println(status)
	}
}
```
c.Next() 会把执行过程分成 before request/after request 两个部分，在这个 HandlerFunc 之后的 HandlerFunc 会在这中间执行。如果你不写 c.Next() 这个 HandlerFunc 就会立马执行完，再去执行下一个 HandlerFunc。