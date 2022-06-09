---
weight: 4
title: "Builder模式与Function Options"
date: 2021-03-03T22:00:00+08:00
lastmod: 2021-03-03T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Builder模式与Function Options"
featuredImage: 

tags: ["go 惯例"]
categories: ["Go"]

lightgallery: true
---

Go 语言中的可选参数与创建型模式。这篇文章摘录自[耗子哥博客-Go编程模式](https://coolshell.cn/articles/21146.html)
<!-- more -->

## 1. Function Options
Functional Options 编程模式是一个函数式编程的应用案例，与传统的 Builder 模式有关，编程技巧也很好，是目前在Go语言中最流行的一种编程模式。不多在讨论这个模式之前，我们先来看看要解决什么样的问题。

### 1.1 配置选项问题
编程中，我们经常需要对一个对象进行相关配置，比如:

```go
type Server struct {
    Addr     string
    Port     int
    Protocol string
    Timeout  time.Duration
    MaxConns int
    TLS      *tls.Config
}
```

在这个 Server 对象中
1. IP地址 Addr 和端口号 Port 是必填的(假设)
2. 协议 Protocol 、 Timeout 和MaxConns 字段，不能为空，但是有默认值
3. TLS 需要配置证书和密钥，可以为空

所以，针对于上述这样的配置，我们需要有多种不同的创建不同配置 Server 的函数签名，如下所示

```go
func NewDefaultServer(addr string, port int) (*Server, error) {
  return &Server{addr, port, "tcp", 30 * time.Second, 100, nil}, nil
}

func NewTLSServer(addr string, port int, tls *tls.Config) (*Server, error) {
  return &Server{addr, port, "tcp", 30 * time.Second, 100, tls}, nil
}

func NewServerWithTimeout(addr string, port int, timeout time.Duration) (*Server, error) {
  return &Server{addr, port, "tcp", timeout, 100, nil}, nil
}

func NewTLSServerWithMaxConnAndTimeout(addr string, port int, maxconns int, timeout time.Duration, tls *tls.Config) (*Server, error) {
  return &Server{addr, port, "tcp", 30 * time.Second, maxconns, tls}, nil
}
```

因为Go语言不支持重载函数，所以，你得用不同的函数名来应对不同的配置选项。

这个问题按照简介程度有不同的解决方案:
1. 使用一个单独的配置对象
2. Builder 构建者模式
3. Functional Options

下面我们一一来介绍。

### 1.2 配置对象方案
配置对象方案是将**所有的非必须选项**移动到一个**独立的配置对象**中:

```go
type Config struct {
    Protocol string
    Timeout  time.Duration
    Maxconns int
    TLS      *tls.Config
}

type Server struct {
    Addr string
    Port int
    Conf *Config
}
```

于是我们只需要一个 `NewServer()` 构造函数，但在使用前需要构建 Config 对象。

```go
func NewServer(addr string, port int, conf *Config) (*Server, error) {
    //...
}

//Using the default configuratrion
srv1, _ := NewServer("localhost", 9000, nil) 

conf := ServerConfig{Protocol:"tcp", Timeout: 60*time.Duration}
srv2, _ := NewServer("locahost", 9000, &conf)
```

但是这个方案有这么一些缺点:
1. Config 并不是必需的
2. 代码内需要判断 conf 是否为 nil 或者 Empty-Config{}，代码不是非常简洁

### 1.3 Builder 模式
如果熟悉设计模式，我们很容易想到 Builder 模式:

```java
User user = new User.Builder()
  .name("Hao Chen")
  .email("haoel@hotmail.com")
  .nickname("左耳朵")
  .build();
```

仿照上面，我们可以把 Server 的创建改写成这样(这里面忽略了异常处理的部分):

```go
//使用一个builder类来做包装
type ServerBuilder struct {
  Server
}

func (sb *ServerBuilder) Create(addr string, port int) *ServerBuilder {
  sb.Server.Addr = addr
  sb.Server.Port = port
  //其它代码设置其它成员的默认值
  return sb
}

func (sb *ServerBuilder) WithProtocol(protocol string) *ServerBuilder {
  sb.Server.Protocol = protocol 
  return sb
}

func (sb *ServerBuilder) WithMaxConn( maxconn int) *ServerBuilder {
  sb.Server.MaxConns = maxconn
  return sb
}

func (sb *ServerBuilder) WithTimeOut( timeout time.Duration) *ServerBuilder {
  sb.Server.Timeout = timeout
  return sb
}

func (sb *ServerBuilder) WithTLS( tls *tls.Config) *ServerBuilder {
  sb.Server.TLS = tls
  return sb
}

func (sb *ServerBuilder) Build() (Server) {
  return  sb.Server
}
```

于是我们就可以按照如下方式来使用了:

```go
sb := ServerBuilder{}
server, err := sb.Create("127.0.0.1", 8080).
  WithProtocol("udp").
  WithMaxConn(1024).
  WithTimeOut(30*time.Second).
  Build()
```

上面这个代码结构优点是:
1. 上面这样的方式也很清楚，不需要额外的Config类
2. 使用链式的函数调用的方式来构造一个对象，只需要多加一个Builder类

但是似乎:
1. 这个Builder类似乎有点多余，我们似乎可以直接在Server 上进行这样的 Builder 构造
2. 在处理错误的时候可能就有点麻烦（需要为Server结构增加一个error 成员，破坏了Server结构体的“纯洁”），不如一个包装类更好一些

如果我们想省掉这个包装的结构体，那么就轮到我们的Functional Options上场了，函数式编程。

### 1.3 Functional Options
首先，我们先定义一个函数类型：`type Option func(*Server)`

然后，我们可以使用函数式的方式定义一组如下的函数：

```go
func Protocol(p string) Option {
    return func(s *Server) {
        s.Protocol = p
    }
}
func Timeout(timeout time.Duration) Option {
    return func(s *Server) {
        s.Timeout = timeout
    }
}
func MaxConns(maxconns int) Option {
    return func(s *Server) {
        s.MaxConns = maxconns
    }
}
func TLS(tls *tls.Config) Option {
    return func(s *Server) {
        s.TLS = tls
    }
}
```

上面这些函数接收一个参数，返回一个可以配置 Server 的另一个函数。例如:
1. 当我们调用其中的一个函数用 `MaxConns(30)` 时
2. 其返回值是一个 `func(s* Server) { s.MaxConns = 30 }` 的函数。

好了，现在我们再定一个 NewServer()的函数，其中，有一个可变参数 options 其可以传入多个上面的返回值函数，然后使用一个for-loop来设置我们的 Server 对象。

```go
func NewServer(addr string, port int, options ...func(*Server)) (*Server, error) {

  srv := Server{
    Addr:     addr,
    Port:     port,
    Protocol: "tcp",
    Timeout:  30 * time.Second,
    MaxConns: 1000,
    TLS:      nil,
  }
  for _, option := range options {
    option(&srv)
  }
  //...
  return &srv, nil
}
```

于是，我们在创建 Server 对象的时候，我们就可以这样来了。

```go
s1, _ := NewServer("localhost", 1024)
s2, _ := NewServer("localhost", 2048, Protocol("udp"))
s3, _ := NewServer("0.0.0.0", 8080, Timeout(300*time.Second), MaxConns(1000))
```

高度舒适:
1. 不但解决了使用 Config 对象方式 的需要有一个config参数，但在不需要的时候，是放 nil 还是放 Config{}的选择困难
2. 也不需要引用一个Builder的控制对象
3. 直接使用函数式编程，在代码阅读上也很优雅

### 1.4 个人体会
不同的编程语言，因为语法上的差异，在设计模式或者说特定功能的实现上还是存在着一些明显的差异。所以要想写出特定语言的专业代码，去研究特定语言的23种设计模式实现还是很有必要的。随着软件编程的不断进步，更新的更优雅的编程模式也在不断出现，需要我们与时俱进。

但是想保持与时俱进并不容易，就拿 23 中设计模式来说，网上有关 Go 语言的实现，很多都是简单的复刻，而不是基于 Go 的最佳实践。作为互联网人，有效的获取我们需要的知识其实一个非常重要的能力。

## 2. grpc 中的配置处理
Functional Options 在众多的 go package 中都被使用。我们就以 grpc 中的 ServerOption 作为示例，简单介绍一下他的使用:

```go
type ServerOption interface {
	apply(*serverOptions)
}

// 1. 服务端所有的配置选项
type serverOptions struct {
	creds                 credentials.TransportCredentials
	codec                 baseCodec
	cp                    Compressor
	dc                    Decompressor
	unaryInt              UnaryServerInterceptor
	streamInt             StreamServerInterceptor
	chainUnaryInts        []UnaryServerInterceptor
	chainStreamInts       []StreamServerInterceptor
  ...
}

// 2. 默认的参数配置
var defaultServerOptions = serverOptions{
	maxReceiveMessageSize: defaultServerMaxReceiveMessageSize,
	maxSendMessageSize:    defaultServerMaxSendMessageSize,
	connectionTimeout:     120 * time.Second,
	writeBufferSize:       defaultWriteBufSize,
	readBufferSize:        defaultReadBufSize,
}

// 3. Functional Options，不过这里多了一层包装
// funcServerOption wraps a function that modifies serverOptions into an
// implementation of the ServerOption interface.
type funcServerOption struct {
	f func(*serverOptions)
}

func (fdo *funcServerOption) apply(do *serverOptions) {
	fdo.f(do)
}

// f func(*serverOptions) 就是 Functional Options，不过 grpc 多了一层包装
func newFuncServerOption(f func(*serverOptions)) *funcServerOption {
	return &funcServerOption{
		f: f,
	}
}

// 4. Function Options 配置
func WriteBufferSize(s int) ServerOption {
	return newFuncServerOption(func(o *serverOptions) {
		o.writeBufferSize = s
	})
}

// 5. 服务初始化
func NewServer(opt ...ServerOption) *Server {
	// 默认参数
  opts := defaultServerOptions
	// funcServerOption.apply(&opts)
  // f(&opts)
  for _, o := range opt {
		o.apply(&opts)
	}
	s := &Server{
		lis:      make(map[net.Listener]bool),
		opts:     opts,
		conns:    make(map[string]map[transport.ServerTransport]bool),
		services: make(map[string]*serviceInfo),
		quit:     grpcsync.NewEvent(),
		done:     grpcsync.NewEvent(),
		czData:   new(channelzData),
	}

  // 处理拦截器的链式调用
  // chainUnaryServerInterceptors chains all unary server interceptors into one.
	chainUnaryServerInterceptors(s)
	chainStreamServerInterceptors(s)
	s.cv = sync.NewCond(&s.mu)
	if EnableTracing {
		_, file, line, _ := runtime.Caller(1)
		s.events = trace.NewEventLog("grpc.Server", fmt.Sprintf("%s:%d", file, line))
	}

	if s.opts.numServerWorkers > 0 {
		s.initServerWorkers()
	}

	s.channelzID = channelz.RegisterServer(&channelzServer{s}, "")
	channelz.Info(logger, s.channelzID, "Server created")
	return s
}
```
