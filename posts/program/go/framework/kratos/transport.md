---
weight: 1
title: "kratos transport"
date: 2021-06-24T22:00:00+08:00
lastmod: 2021-06-24T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "kratos 源码解析之服务启动以及请求处理流程"
featuredImage: 

tags: ["go 框架"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

## 1. kratos 服务启动流程
### 1.1 服务对应的接口
有了上一节的铺垫，接下来我们就可以学习 kratos 服务启动以及请求处理的流程，也就是 kratos 的 transport 库完成的功能。我们先来看一下 kratos 项目服务启动的代码:

```go
// 1. 初始化 app 的代码，最终会调用 App.run()
func newApp(logger log.Logger, hs *http.Server, gs *grpc.Server) *kratos.App {
	return kratos.New(
		kratos.ID(id),
		kratos.Name(Name),
		kratos.Version(Version),
		kratos.Metadata(map[string]string{}),
		kratos.Logger(logger),
		kratos.Server(
			hs,
			gs,
		),
	)
}

app := newApp(logger, httpServer, grpcServer)
app.Run()

// kratos.Server
func Server(srv ...transport.Server) Option {
	return func(o *options) { o.servers = srv }
}

// Server is transport server.
type Server interface {
	Start(context.Context) error
	Stop(context.Context) error
}
```

这段代码，首先 ktratos 把所有的 server 抽象成了 transport.Server 接口:

kratos.New 负责创建一个 App，这个 App 内包含了所有配置的集合:

```go
type App struct {
	opts     options
	ctx      context.Context
	cancel   func()
	lk       sync.Mutex
	instance *registry.ServiceInstance
}

type options struct {
	id        string
	name      string
	version   string
	metadata  map[string]string
	endpoints []*url.URL

	ctx  context.Context
	sigs []os.Signal                   // 监听的信号量

	logger           *log.Helper
	registrar        registry.Registrar // 服务注册
	registrarTimeout time.Duration
	stopTimeout      time.Duration
	servers          []transport.Server  // 要启动的服务
}

```

后面我们会看到，每个一个实现的功能，包括服务启动、服务发现与注册，都对应着其中一个属性，以及这个属性所对应的抽象接口。

其实到这里就简单了，所有注册到 ktratos 中的服务只要实现了 transport.Server 的接口，就可以被 ktratos 启动。启动的过程在 App.run() 方法中。

### 1.2 服务的启动流程
App.run() 的代码如下:

```go
// Run executes all OnStart hooks registered with the application's Lifecycle.
func (a *App) Run() error {
	// 1. instance 与服务注册于发现有关，我们后面在详述
	instance, err := a.buildInstance()
	if err != nil {
		return err
	}
	
	eg, ctx := errgroup.WithContext(NewContext(a.ctx, a))
	wg := sync.WaitGroup{}
	for _, srv := range a.opts.servers {
		srv := srv
		eg.Go(func() error {
			<-ctx.Done() // wait for stop signal
			stopCtx, cancel := context.WithTimeout(NewContext(a.opts.ctx, a), a.opts.stopTimeout)
			defer cancel()
			return srv.Stop(stopCtx)
		})
		wg.Add(1)
		eg.Go(func() error {
			wg.Done()
			return srv.Start(NewContext(a.opts.ctx, a))
		})
	}
	wg.Wait()
	if a.opts.registrar != nil {
		rctx, rcancel := context.WithTimeout(ctx, a.opts.registrarTimeout)
		defer rcancel()
		if err := a.opts.registrar.Register(rctx, instance); err != nil {
			return err
		}
		a.lk.Lock()
		a.instance = instance
		a.lk.Unlock()
	}
	c := make(chan os.Signal, 1)
	signal.Notify(c, a.opts.sigs...)
	eg.Go(func() error {
		for {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-c:
				if err := a.Stop(); err != nil {
					a.opts.logger.Errorf("failed to stop app: %v", err)
					return err
				}
			}
		}
	})
	if err := eg.Wait(); err != nil && !errors.Is(err, context.Canceled) {
		return err
	}
	return nil
}
```

这是一个非常标准的服务启动流程，这里面由如下几个注意的点:


接下来，我们来看 http.Server, grpc.Server 如何实现 Server 接口。

### 1.3 grpc.Server 初始化过程
首先跟 App struct 一样，grpc Server 被定义为一个包含了很多启动参数的 struct，这个 struct 内的大多数参数与 grpc 有关:

```go
// Server is a gRPC server wrapper.
type Server struct {
	*grpc.Server                          // 内嵌了 grpc.Server
	baseCtx    context.Context
	tlsConf    *tls.Config
	lis        net.Listener
	err        error
	network    string
	address    string
	endpoint   *url.URL
	timeout    time.Duration
	log        *log.Helper
	middleware []middleware.Middleware       // 框架定义的中间件
	unaryInts  []grpc.UnaryServerInterceptor // 一元拦截器
	streamInts []grpc.StreamServerInterceptor // 流拦截器
	grpcOpts   []grpc.ServerOption           // grpc 的配置参数
	health     *health.Server
	metadata   *apimd.Server
}

// 同样通过 Funciton Option 去配置 grpc.Server 中的参数
type ServerOption func(o *Server)

// Network with server network.
func Network(network string) ServerOption {
	return func(s *Server) {
		s.network = network
	}
}
```

grpc.Server 初始化的过程，就是处理 grpc 各种启动参数的过程。

```go
// NewServer creates a gRPC server by options.
func NewServer(opts ...ServerOption) *Server {
	srv := &Server{
		baseCtx: context.Background(),
		network: "tcp",
		address: ":0",
		timeout: 1 * time.Second,
		// 1. 健康监测
		health:  health.NewServer(),
		log:     log.NewHelper(log.GetLogger()),
	}
	for _, o := range opts {
		o(srv)
	}
	// 将 kratos 定义的 middleware 转换成 grp 的拦截器
	unaryInts := []grpc.UnaryServerInterceptor{
		srv.unaryServerInterceptor(),
	}
	streamInts := []grpc.StreamServerInterceptor{
		srv.streamServerInterceptor(),
	}

	// 合并传入的拦截器
	if len(srv.unaryInts) > 0 {
		unaryInts = append(unaryInts, srv.unaryInts...)
	}
	if len(srv.streamInts) > 0 {
		streamInts = append(streamInts, srv.streamInts...)
	}
	grpcOpts := []grpc.ServerOption{
		grpc.ChainUnaryInterceptor(unaryInts...),
		grpc.ChainStreamInterceptor(streamInts...),
	}
	// 加密传输
	if srv.tlsConf != nil {
		grpcOpts = append(grpcOpts, grpc.Creds(credentials.NewTLS(srv.tlsConf)))
	}
	// 合并 grpc 参数
	if len(srv.grpcOpts) > 0 {
		grpcOpts = append(grpcOpts, srv.grpcOpts...)
	}

	// 初始化 grpc server
	srv.Server = grpc.NewServer(grpcOpts...)
	srv.metadata = apimd.NewServer(srv.Server)
	// listen and endpoint
	srv.err = srv.listenAndEndpoint()
	// internal register
	// grpc 的健康状态监测
	grpc_health_v1.RegisterHealthServer(srv.Server, srv.health)
	// 添加接口，获取当前 grpc 都提供了哪些服务和接口
	apimd.RegisterMetadataServer(srv.Server, srv.metadata)
	reflection.Register(srv.Server)
	return srv
}
```

这里面比较重要点在于，kratos 如何将自己定义的中间件转换成 grpc 的拦截器。我们来看 srv.unaryServerInterceptor 方法

```go
// unaryServerInterceptor is a gRPC unary server interceptor
func (s *Server) unaryServerInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		// context 的合并
		ctx, cancel := ic.Merge(ctx, s.baseCtx)
		defer cancel()
		// 获取在 grpc 过程中传递的元数据
		md, _ := grpcmd.FromIncomingContext(ctx)
		replyHeader := grpcmd.MD{}
		// 通过 context 把一些传输层的信息，传递下去 
		ctx = transport.NewServerContext(ctx, &Transport{
			endpoint:    s.endpoint.String(),
			operation:   info.FullMethod,
			reqHeader:   headerCarrier(md),
			replyHeader: headerCarrier(replyHeader),
		})
		if s.timeout > 0 {
			ctx, cancel = context.WithTimeout(ctx, s.timeout)
			defer cancel()
		}
		// 这是 kratos middleware 约定的请求处理函数
		h := func(ctx context.Context, req interface{}) (interface{}, error) {
			// 调用 grpc 的 handler
			return handler(ctx, req)
		}
		if len(s.middleware) > 0 {
			// 合并 middleware
			h = middleware.Chain(s.middleware...)(h)
		}
		// 调用 grpc 的 handler
		reply, err := h(ctx, req)
		if len(replyHeader) > 0 {
			_ = grpc.SetHeader(ctx, replyHeader)
		}
		// 返回响应
		return reply, err
	}
}
```

middleware 是一个装饰器模式，Chain 把所有的 middleware 链式组合起来

```go
func Chain(m ...Middleware) Middleware {
	// 接收一个 handler，返回一个被包装的 handler
	return func(next Handler) Handler {
		// 逆序，这样最外层的 middleware 第一个被执行
		for i := len(m) - 1; i >= 0; i-- {
			next = m[i](next)
		}
		return next
	}
}

// Handler defines the handler invoked by Middleware.
type Handler func(ctx context.Context, req interface{}) (interface{}, error)

// Middleware is HTTP/gRPC transport middleware.
type Middleware func(Handler) Handler
```

### 1.4 http.Server 初始化过程
http.Server 与 grpc.Server 类似，首先是服务定义的 struct:

```go
// Server is an HTTP server wrapper.
type Server struct {
	*http.Server                  // 内嵌了 net http.Server
	lis         net.Listener
	tlsConf     *tls.Config
	endpoint    *url.URL
	err         error
	network     string
	address     string
	timeout     time.Duration
	filters     []FilterFunc            //       
	ms          []middleware.Middleware  // 中间件
	dec         DecodeRequestFunc        // 请求的解析函数
	enc         EncodeResponseFunc       // 响应的序列化函数
	ene         EncodeErrorFunc
	strictSlash bool
	router      *mux.Router      // 路由实现
	log         *log.Helper
}

// ServerOption is an HTTP server option.
type ServerOption func(*Server)

// Network with server network.
func Network(network string) ServerOption {
	return func(s *Server) {
		s.network = network
	}
}
```

服务的初始化就是 http 服务的启动过程:

```go
// NewServer creates an HTTP server by options.
func NewServer(opts ...ServerOption) *Server {
	srv := &Server{
		network:     "tcp",
		address:     ":0",
		timeout:     1 * time.Second,
		dec:         DefaultRequestDecoder,
		enc:         DefaultResponseEncoder,
		ene:         DefaultErrorEncoder,
		strictSlash: true,
		log:         log.NewHelper(log.GetLogger()),
	}
	for _, o := range opts {
		o(srv)
	}
	// kratos http 使用的是 "github.com/gorilla/mux" 这个库的路由实现
	srv.router = mux.NewRouter().StrictSlash(srv.strictSlash)
	srv.router.NotFoundHandler = http.DefaultServeMux
	srv.router.MethodNotAllowedHandler = http.DefaultServeMux
	// 传递控制参数
	srv.router.Use(srv.filter())
	// 启动 http server
	srv.Server = &http.Server{
		Handler:   FilterChain(srv.filters...)(srv.router),
		TLSConfig: srv.tlsConf,
	}
	srv.err = srv.listenAndEndpoint()
	return srv
}
```
这里面比较重要的点是 kratos 定义的 filter 逻辑。`srv.router.Use(srv.filter())` 通过 context 向下传递了 Transport 以便在 middleware 中可以获取到这个 tranposrt 进行一些特殊处理。

```go
// srv.filter()
func (s *Server) filter() mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			var (
				ctx    context.Context
				cancel context.CancelFunc
			)
			if s.timeout > 0 {
				ctx, cancel = context.WithTimeout(req.Context(), s.timeout)
			} else {
				ctx, cancel = context.WithCancel(req.Context())
			}
			defer cancel()

			pathTemplate := req.URL.Path
			if route := mux.CurrentRoute(req); route != nil {
				// /path/123 -> /path/{id}
				pathTemplate, _ = route.GetPathTemplate()
			}

			tr := &Transport{
				endpoint:     s.endpoint.String(),
				operation:    pathTemplate,
				reqHeader:    headerCarrier(req.Header),
				replyHeader:  headerCarrier(w.Header()),
				request:      req,
				pathTemplate: pathTemplate,
			}

			tr.request = req.WithContext(transport.NewServerContext(ctx, tr))
			next.ServeHTTP(w, tr.request)
		})
	}
}
```

`FilterChain(srv.filters...)(srv.router)` 与 middleware 的实现逻辑类似，但是需要注意的是，这里的 FilterChain 并不是 middleware。FilterChanin 处理的是原始的 http.Handler，而 kratos 定义的 middleware 处理的是框架层定义的 middleware.Handler。FilterChanin 的执行顺序在 middleware 之前，kratos 定义 FilterChanin 的目的应该是为了方便集成其他为 net/http 编写的 middleware。

```go
// FilterFunc is a function which receives an http.Handler and returns another http.Handler.
type FilterFunc func(http.Handler) http.Handler

// FilterChain returns a FilterFunc that specifies the chained handler for HTTP Router.
func FilterChain(filters ...FilterFunc) FilterFunc {
	return func(next http.Handler) http.Handler {
		for i := len(filters) - 1; i >= 0; i-- {
			next = filters[i](next)
		}
		return next
	}
}
```

kratos http middleware 的生效逻辑在路由的添加和请求的处理过程中。当我们通过 kratos 自定义的 protoc-gen-go-http 插件，生成 http sever 代码时，会生成如下的路由注册函数:

```go
func RegisterIncomeHTTPServer(s *http.Server, srv IncomeHTTPServer) {
	r := s.Route("/")
	r.GET("/evaluate/{stock_id}", _Income_GetIncome0_HTTP_Handler(srv))
}
```

s.Route("/") 生成逻辑如下:

```go
// Route registers an HTTP router.
func (s *Server) Route(prefix string, filters ...FilterFunc) *Router {
	return newRouter(prefix, s, filters...)
}

// Router is an HTTP router.
type Router struct {
	prefix  string
	pool    sync.Pool
	srv     *Server
	filters []FilterFunc
}

func newRouter(prefix string, srv *Server, filters ...FilterFunc) *Router {
	r := &Router{
		prefix:  prefix,
		srv:     srv,        // http Server 对象
		filters: filters,
	}
	r.pool.New = func() interface{} {
		return &wrapper{router: r}
	}
	return r
}
```

在生成 Router 中，包含了 kratos http Server 对象。当 r.GET 注册 handler 时:

```go
// Handle registers a new route with a matcher for the URL path and method.
func (r *Router) Handle(method, relativePath string, h HandlerFunc, filters ...FilterFunc) {
	next := http.Handler(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		// 经过包装的 context 对象，类似于 gin 中的 Context 封装了对请求响应的处理
		ctx := r.pool.Get().(Context)
		ctx.Reset(res, req)
		// h(ctx) 调用的是注册的 handler，就是上面的 _Income_GetIncome0_HTTP_Handler 返回的 Handler
		if err := h(ctx); err != nil {
			r.srv.ene(res, req, err)
		}
		ctx.Reset(nil, nil)
		r.pool.Put(ctx)
	}))
	// 注册 r.filters
	next = FilterChain(filters...)(next)
	next = FilterChain(r.filters...)(next)
	// github.com/gorilla/mux 的路由注册
	r.srv.router.Handle(path.Join(r.prefix, relativePath), next).Methods(method)
}

// GET registers a new GET route for a path with matching handler in the router.
func (r *Router) GET(path string, h HandlerFunc, m ...FilterFunc) {
	r.Handle(http.MethodGet, path, h, m...)
}
```

这里面有如下注意的点: kratos 定义的 HandlerFunc 与 标准的 net/http 定义的 HandlerFunc 是不是一样的。kratos 定义的 HandlerFunc 类似于 gin 的 HandlerFunc 接收的是一个经过包装的 Context，这个 Context 包含了很多请求处理的方法。

经过包装的 Context 生成逻辑如下，这个 wrapper 的 Context，通过 router 可以获取到 kratos http.Server。 最终在注册 http 的handler 时，handler 通过 context 可以获取到 http.Server 的 middleware 并调用。

```go
// &wrapper{router: r}
type wrapper struct {
	router *Router
	req    *http.Request
	res    http.ResponseWriter
	w      responseWriter
}

func (c *wrapper) Middleware(h middleware.Handler) middleware.Handler {
	return middleware.Chain(c.router.srv.ms...)(h)
}

// 注册 htt Handler
func _Income_GetIncome0_HTTP_Handler(srv IncomeHTTPServer) func(ctx http.Context) error {
	return func(ctx http.Context) error {
		var in GetIncomeRequest
		if err := ctx.BindQuery(&in); err != nil {
			return err
		}
		if err := ctx.BindVars(&in); err != nil {
			return err
		}
		http.SetOperation(ctx, "/evaluate.v1.Income/GetIncome")
		// 这里调用 c.router.srv.ms 中间件
		h := ctx.Middleware(func(ctx context.Context, req interface{}) (interface{}, error) {
			return srv.GetIncome(ctx, req.(*GetIncomeRequest))
		})
		out, err := h(ctx, &in)
		if err != nil {
			return err
		}
		reply := out.(*GetIncomeReply)
		return ctx.Result(200, reply)
	}
}
```
所以 kratos http server 中间件的调用链是:
1. Server 初始化时传入 middleware
2. 在调用 protoc 插件生成的 http 代码中，会调用如下两个函数:
   - `r := s.Route("/")`
   - `r.GET("/evaluate/{stock_id}", _Income_GetIncome0_HTTP_Handler(srv))`
3. s.Route() 返回 transport.Router，这个 Router 通过 srv 属性持有 http.Server
4. r.GET 会调用 transport.Router.Handle 进行路由注册，这个过程会做一个转换，把 net/http HandlerFunc 转换成 kratos 定义的 HandlerFunc 其接受一个包装的 context(`&wrapper{router: r}`)
5. 这个经过包装的 Context 包含有之前生成的 transport.Router
6. 最后在调用注册的 handler 时，通过 ctx.Middleware(内部通过 context.router.srv.ms) 获取到保存在 http.Server 中的 middleware 并执行

### 1.5 handler 转换过程
上面一连串 middleware 的调用过程，还是比较绕的。同时存在 Filter 和 Middleware，它们作用的 handler 也是不一样。从上面我们可以看到handler 的转换过程:

1. _Income_GetIncome0_HTTP_Handler: 会把 proto 中定义的 Service 转换成 kratos transport 的 htt.HandlerFunc: `type HandlerFunc func(Context) error`，kratos 定义的 middleware 作用在此 http.HandlerFunc 上
2. 真正的路由注册在 RegisterIncomeHTTPServer，内部调用了 kratos transport http.Router 的 Handler 方法，讲 http.HandlerFunc 转换成了 net/http 的 HandlerFunc。ktratos 定义的 Filter 作用在 net/http 的 HandlerFunc 上。

```go
func (r *Router) Handle(method, relativePath string, h HandlerFunc, filters ...FilterFunc) {
	next := http.Handler(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		ctx := r.pool.Get().(Context)
		ctx.Reset(res, req)
		if err := h(ctx); err != nil {
			r.srv.ene(res, req, err)
		}
		ctx.Reset(nil, nil)
		r.pool.Put(ctx)
	}))
	next = FilterChain(filters...)(next)
	next = FilterChain(r.filters...)(next)
	r.srv.router.Handle(path.Join(r.prefix, relativePath), next).Methods(method)
}
```