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
```

这段代码，首先 ktratos 把所有的 server 抽象成了 transport.Server 接口:

```go
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