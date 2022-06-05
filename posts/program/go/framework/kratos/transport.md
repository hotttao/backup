## 2. kratos 中请求处理流程
有了前面的铺垫，接下来我们就可以学习 kratos 请求处理的流程，也就是这一节的核心 kratos 的 transport 库。我们先来看一下 kratos 项目的启动代码:

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
```

app.Run() 最终会调用 http.Server 和 grpc.Server 的 Start 方法，我们依次来看 grpc 和 http 服务的启动流程。

### 2.1 grpc 服务的请求流程
```go
package server

import (
	evaluate_v2 "gostock/api/evaluate/v1"
	v1 "gostock/api/helloworld/v1"
	"gostock/internal/conf"
	"gostock/internal/service"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"github.com/go-kratos/kratos/v2/transport/grpc"
)

// NewGRPCServer new a gRPC server.
func NewGRPCServer(c *conf.Server, greeter *service.GreeterService, income *service.IncomeService, logger log.Logger) *grpc.Server {
	var opts = []grpc.ServerOption{
		grpc.Middleware(
			recovery.Recovery(),
		),
	}
	if c.Grpc.Network != "" {
		opts = append(opts, grpc.Network(c.Grpc.Network))
	}
	if c.Grpc.Addr != "" {
		opts = append(opts, grpc.Address(c.Grpc.Addr))
	}
	if c.Grpc.Timeout != nil {
		opts = append(opts, grpc.Timeout(c.Grpc.Timeout.AsDuration()))
	}
	// 1. 初始化 grpc server
	srv := grpc.NewServer(opts...)
	// 2. 注册接口
	v1.RegisterGreeterServer(srv, greeter)
	evaluate_v2.RegisterIncomeServer(srv, income)
	return srv
}
```

### 2.1 grpc server 初始化
我们先来看 grpc.NewServer:

```go
// Server is a gRPC server wrapper.
type Server struct {
	*grpc.Server
	
	baseCtx    context.Context
	tlsConf    *tls.Config
	lis        net.Listener
	err        error
	network    string
	address    string
	endpoint   *url.URL
	timeout    time.Duration
	log        *log.Helper
	// grpc 服务本身的选项
	middleware []middleware.Middleware
	unaryInts  []grpc.UnaryServerInterceptor
	streamInts []grpc.StreamServerInterceptor
	grpcOpts   []grpc.ServerOption
	// 
	health     *health.Server
	metadata   *apimd.Server
}
```



