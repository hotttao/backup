---
weight: 1
title: "go 网络库 net/http 的请求处理过程"
date: 2021-06-06T22:00:00+08:00
lastmod: 2021-06-06T22:00:00+08:00
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

## 1. net/http 库结构
我们先来看一个最简单的 http server:

```go
package web

import (
	"fmt"
	"log"
	"net/http"
)

func StartWebServer() {
	http.HandleFunc("/hello", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "hello, %q", "tsong")
	})
	http.ListenAndServe(":8080", nil)
}

// net/http 库
func ListenAndServe(addr string, handler Handler) error {
	server := &Server{Addr: addr, Handler: handler}
	return server.ListenAndServe()
}
```

显然启动一个 http server，我们需要:
1. 设置路由，即定义请求处理函数，这个请求处理函数接受 http.ResponseWriter 和 *http.Request 作为参数，并执行业务逻辑
2. 初始化一个 http server，并启动这个服务

如果你有一些 web server 的开发经验，我想你也因该能大致的猜出 net/http 包含哪些结构:

```go
$ go doc net/http|grep ^type |grep interface
type CloseNotifier interface{ ... }
type CookieJar interface{ ... }
type File interface{ ... }
type FileSystem interface{ ... }
type Flusher interface{ ... }
type Handler interface {
        ServeHTTP(ResponseWriter, *Request)
}
type Hijacker interface{ ... }
type Pusher interface{ ... }
type ResponseWriter interface {
        Header() Header
        Write([]byte) (int, error)
        WriteHeader(statusCode int)
}
type RoundTripper interface{ ... }

$ go doc net/http|grep ^type |grep struct
type Client struct{ ... }
type Cookie struct{ ... }
type ProtocolError struct{ ... }
type PushOptions struct{ ... }
type Request struct{ ... }
type Response struct{ ... }
type ServeMux struct{ ... } // HTTP 服务端路由
type Server struct{ ... }
type Transport struct{ ... }  // 传输层控制
```
我们想弄清楚整个 net/http 的请求处理过程，就是理清这些对象的包含和生成关系，下面我们一一来看。

## 2. net/http Server
Server 是整个服务的核心，所以我们先来看 Server。

```go
$ go doc net/http.Server
package http // import "net/http"

type Server struct {
        Addr string   // 监听地址

        Handler Handler // 请求处理函数，默认是 http.DefaultServeMux 
        TLSConfig *tls.Config // 加密请求配置


        ReadTimeout time.Duration
        ReadHeaderTimeout time.Duration
        WriteTimeout time.Duration
        IdleTimeout time.Duration
        MaxHeaderBytes int


        TLSNextProto map[string]func(*Server, *tls.Conn, Handler)
        ConnState func(net.Conn, ConnState) // 当客户端连接状态发生变化时，回掉的函数
        ErrorLog *log.Logger

        
        // the base context for incoming requests on this server.
        BaseContext func(net.Listener) context.Context // 为每一个接受的请求，返回一个 Context
        // ConnContext可选地指定一个函数，用于修改用于新连接的上下文c
        // 派生自 BaseContext
        ConnContext func(ctx context.Context, c net.Conn) context.Context
}

func (srv *Server) Close() error
func (srv *Server) ListenAndServe() error
func (srv *Server) ListenAndServeTLS(certFile, keyFile string) error
func (srv *Server) RegisterOnShutdown(f func())
func (srv *Server) Serve(l net.Listener) error
func (srv *Server) ServeTLS(l net.Listener, certFile, keyFile string) error
func (srv *Server) SetKeepAlivesEnabled(v bool)
func (srv *Server) Shutdown(ctx context.Context) error
```

Server Struct 中主要包括三个部分:
1. 传输层相关的配置
2. 路由，即 Handler
3. Context，请求的上下文管理器，包含一些与业务无关的请求控制逻辑，比如超时控制

### 2.1 服务启动
Server.ListenAndServe() 启动服务的源码如下:

```go
var (
	// ServerContextKey is a context key. It can be used in HTTP
	// handlers with Context.Value to access the server that
	// started the handler. The associated value will be of
	// type *Server.
	ServerContextKey = &contextKey{"http-server"}

	// LocalAddrContextKey is a context key. It can be used in
	// HTTP handlers with Context.Value to access the local
	// address the connection arrived on.
	// The associated value will be of type net.Addr.
	LocalAddrContextKey = &contextKey{"local-addr"}
)

func (srv *Server) ListenAndServe() error {
	if srv.shuttingDown() {
		return ErrServerClosed
	}
	addr := srv.Addr
	if addr == "" {
		addr = ":http"
	}
  // 创建 TCP 连接
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	return srv.Serve(ln)
}


func (srv *Server) Serve(l net.Listener) error {
	if fn := testHookServerServe; fn != nil {
		fn(srv, l) // call hook with unwrapped listener
	}

	origListener := l
	l = &onceCloseListener{Listener: l}
	defer l.Close()

	if err := srv.setupHTTP2_Serve(); err != nil {
		return err
	}

	if !srv.trackListener(&l, true) {
		return ErrServerClosed
	}
	defer srv.trackListener(&l, false)

  // 1. 调用 BaseContext 
	baseCtx := context.Background()
	if srv.BaseContext != nil {
		baseCtx = srv.BaseContext(origListener)
		if baseCtx == nil {
			panic("BaseContext returned a nil context")
		}
	}

	var tempDelay time.Duration // how long to sleep on accept failure

	ctx := context.WithValue(baseCtx, ServerContextKey, srv)
	for {
    // 2. 接收到一个新的请求
		rw, err := l.Accept()
		if err != nil {
			select {
			case <-srv.getDoneChan():
				return ErrServerClosed
			default:
			}
			if ne, ok := err.(net.Error); ok && ne.Temporary() {
				if tempDelay == 0 {
					tempDelay = 5 * time.Millisecond
				} else {
					tempDelay *= 2
				}
				if max := 1 * time.Second; tempDelay > max {
					tempDelay = max
				}
				srv.logf("http: Accept error: %v; retrying in %v", err, tempDelay)
				time.Sleep(tempDelay)
				continue
			}
			return err
		}
		connCtx := ctx
    // 3. 调用 ConnContext
		if cc := srv.ConnContext; cc != nil {
			connCtx = cc(connCtx, rw)
			if connCtx == nil {
				panic("ConnContext returned nil")
			}
		}
		tempDelay = 0
    // 4. 连接对象，处理整个过程的 http 请求和响应
		c := srv.newConn(rw)
		c.setState(c.rwc, StateNew, runHooks) // before Serve can return
		go c.serve(connCtx)
	}
}
```
我们把调试、重试的逻辑删除后，简化的过程就变成了下面这样:

```go
l, err := net.Listen("tcp", addr)
// 1. 调用 BaseContext 
baseCtx := context.Background()
if srv.BaseContext != nil {
  baseCtx = srv.BaseContext(origListener)
  if baseCtx == nil {
    panic("BaseContext returned a nil context")
  }
}
ctx := context.WithValue(baseCtx, ServerContextKey, srv)
for {
    // 2. 接收到一个新的请求
		rw, err := l.Accept()
    connCtx := ctx
    // 3. 调用 ConnContext
		if cc := srv.ConnContext; cc != nil {
			connCtx = cc(connCtx, rw)
			if connCtx == nil {
				panic("ConnContext returned nil")
			}
		}
    // 4. 连接对象，处理整个过程的 http 请求和响应
		c := srv.newConn(rw)
		c.setState(c.rwc, StateNew, runHooks) // before Serve can return
		go c.serve(connCtx)
```

这个过程有两个重要的组成部分:
1. context 的处理， Server 对外暴露了 BaseContext 和 ConnContext 两个函数，可以让我们定制请求处理过程中用到的 Context
2. 单个请求的处理: srv.newConn(rw)，返回连接处理对象，这个方法里面会完成当前的请求处理

## 3. 单个请求的处理
srv.newConn(rw) 处理过程比较负责，我们先来看看里面涉及的数据结构。首先 l.Accept() 返回的是 Conn 的 interface.

```go
// l.Accept()
type Listener interface {
	Accept() (Conn, error)
	Close() error
	Addr() Addr
}

// Multiple goroutines may invoke methods on a Conn simultaneously.
type Conn interface {
	Read(b []byte) (n int, err error)

	Write(b []byte) (n int, err error)

	Close() error

	LocalAddr() Addr

	RemoteAddr() Addr
	SetDeadline(t time.Time) error
	SetReadDeadline(t time.Time) error
	SetWriteDeadline(t time.Time) error
}

// Create new connection from rwc.
func (srv *Server) newConn(rwc net.Conn) *conn {
	c := &conn{
		server: srv,
		rwc:    rwc,
	}
	if debugServerConnections {
		c.rwc = newLoggingConn("server", c.rwc)
	}
	return c
}
```

net/http 对底层返回的 Conn 做了一层封装，生成了 conn 的内部结构:

```go
// A conn represents the server side of an HTTP connection.
type conn struct {
	server *Server

	// cancelCtx cancels the connection-level context.
	cancelCtx context.CancelFunc

	rwc net.Conn


	remoteAddr string
	tlsState *tls.ConnectionState
	werr error
	r *connReader

	bufr *bufio.Reader
	bufw *bufio.Writer

	lastMethod string

	curReq atomic.Value // of *response (which has a Request in it)

	curState struct{ atomic uint64 } // packed (unixtime<<8|uint8(ConnState))

	// mu guards hijackedv
	mu sync.Mutex
	hijackedv bool
}

func (c *conn) readRequest(ctx context.Context) (w *response, err error) 
func (c *conn) finalFlush()
func (c *conn) close()
func (c *conn) closeWriteAndWait()
func (c *conn) setState(nc net.Conn, state ConnState, runHook bool)
func (c *conn) getState() (state ConnState, unixSec int64)
func (s *Server) trackConn(c *conn, add bool)
func (c *conn) serve(ctx context.Context)
```

这个 conn 结构会维护很多请求处理过程中的中间数据，我们来看 c.serve(ctx context.Context) 的处理过程。代码很多，这里我只列出跟核心对象生成有关的逻辑:

```go
// Serve a new connection.
func (c *conn) serve(ctx context.Context) {
	c.remoteAddr = c.rwc.RemoteAddr().String()
	ctx = context.WithValue(ctx, LocalAddrContextKey, c.rwc.LocalAddr())
  var inFlightResponse *response
  // 1. 异常处理
  defer func() {}
  // 2. https 处理
  if tlsConn, ok := c.rwc.(*tls.Conn); ok {
    c.tlsState = new(tls.ConnectionState)
		*c.tlsState = tlsConn.ConnectionState()
		if proto := c.tlsState.NegotiatedProtocol; validNextProto(proto) {
      // 
			if fn := c.server.TLSNextProto[proto]; fn != nil {
				h := initALPNRequest{ctx, tlsConn, serverHandler{c.server}}
				// Mark freshly created HTTP/2 as active and prevent any server state hooks
				// from being run on these connections. This prevents closeIdleConns from
				// closing such connections. See issue https://golang.org/issue/39776.
				c.setState(c.rwc, StateActive, skipHooks)
				fn(c.server, tlsConn, h)
			}
			return
		}
  }
  // 3. http 的请求处理过程
  ctx, cancelCtx := context.WithCancel(ctx)
	c.cancelCtx = cancelCtx
  c.r = &connReader{conn: c}
  c.bufr = newBufioReader(c.r)
	c.bufw = newBufioWriterSize(checkConnErrorWriter{c}, 4<<10)
  
  for {
    // 3.1 Request 的生成
    // func (c *conn) readRequest(ctx context.Context) (w *response, err error) 
    // c.readRequest 会生成 Handler 所需要的 Request 对象以后一个内部的 response 对象，这个 response 实现了 http.ResponseWriter 接口
    // 所以 w 就是 http.ResponseWriter
		w, err := c.readRequest(ctx)
    req := w.req
    // conn 的 curReq 保存了内部生成的 response 对象
    c.curReq.Store(w)
    inFlightResponse = w
    // 3.2 调用 Handler 
		serverHandler{c.server}.ServeHTTP(w, w.req)
    w.finishRequest()
    c.setState(c.rwc, StateIdle, runHooks)
		c.curReq.Store((*response)(nil))
  }
}
```

在 conn.serve 的处理过程中:
1. `w, err := c.readRequest(ctx)` 会生成 http.Request 对象以及内部使用的 response 对象，这个 response 就是 http.ResponseWriter 的实现
2. `serverHandler{c.server}.ServeHTTP(w, w.req)` 会调用 Handler

## 3. ResponseWriter 和 Request 对象的生成
ResponseWriter 和 Request 对象的生成在 conn.readRequest 方法中:

```go
// Read next request from connection.
func (c *conn) readRequest(ctx context.Context) (w *response, err error) {
	if c.lastMethod == "POST" {
		// RFC 7230 section 3 tolerance for old buggy clients.
		peek, _ := c.bufr.Peek(4) // ReadRequest will get err below
		c.bufr.Discard(numLeadingCRorLF(peek))
	}
  // 1. readRequest 生成了 Request 对象
	req, err := readRequest(c.bufr)

	c.lastMethod = req.Method
	ctx, cancelCtx := context.WithCancel(ctx)
	req.ctx = ctx
	req.RemoteAddr = c.remoteAddr
	req.TLS = c.tlsState
	if body, ok := req.Body.(*body); ok {
		body.doEarlyClose = true
	}
  // 2. 初始化 response 对象
	w = &response{
		conn:          c,
		cancelCtx:     cancelCtx,
		req:           req,
		reqBody:       req.Body,
		handlerHeader: make(Header),
		contentLength: -1,
		closeNotifyCh: make(chan bool, 1),

		// We populate these ahead of time so we're not
		// reading from req.Header after their Handler starts
		// and maybe mutates it (Issue 14940)
		wants10KeepAlive: req.wantsHttp10KeepAlive(),
		wantsClose:       req.wantsClose(),
	}
	if isH2Upgrade {
		w.closeAfterReply = true
	}
	w.cw.res = w
	w.w = newBufioWriterSize(&w.cw, bufferBeforeChunkingSize)
	return w, nil
}
```

Request 的生成在 `req, err := readRequest(c.bufr)`，readRequest 内都是 http 协议解析的逻辑。

```go
func readRequest(b *bufio.Reader) (req *Request, err error) {
	tp := newTextprotoReader(b)
	req = new(Request)

	// First line: GET /index.html HTTP/1.0
	var s string
	if s, err = tp.ReadLine(); err != nil {
		return nil, err
	}
	
	req.Method, req.RequestURI, req.Proto, ok = parseRequestLine(s)
	rawurl := req.RequestURI

	justAuthority := req.Method == "CONNECT" && !strings.HasPrefix(rawurl, "/")
	if justAuthority {
		rawurl = "http://" + rawurl
	}

	if req.URL, err = url.ParseRequestURI(rawurl); err != nil {
		return nil, err
	}

	// Subsequent lines: Key: value.
	mimeHeader, err := tp.ReadMIMEHeader()
	if err != nil {
		return nil, err
	}
	req.Header = Header(mimeHeader)
	
	// RFC 7230, section 5.3: Must treat
	//	GET /index.html HTTP/1.1
	//	Host: www.google.com
	// and
	//	GET http://www.google.com/index.html HTTP/1.1
	//	Host: doesntmatter
	// the same. In the second case, any Host line is ignored.
	req.Host = req.URL.Host
	if req.Host == "" {
		req.Host = req.Header.get("Host")
	}
	return req, nil
}
```

## 4. Handler 调用过程

```go
// serverHandler delegates to either the server's Handler or
// DefaultServeMux and also handles "OPTIONS *" requests.
type serverHandler struct {
	srv *Server
}

func (sh serverHandler) ServeHTTP(rw ResponseWriter, req *Request) {
	handler := sh.srv.Handler
  // 1. 默认路由
	if handler == nil {
		handler = DefaultServeMux
	}
	if req.RequestURI == "*" && req.Method == "OPTIONS" {
		handler = globalOptionsHandler{}
	}

	if req.URL != nil && strings.Contains(req.URL.RawQuery, ";") {
		var allowQuerySemicolonsInUse int32
		req = req.WithContext(context.WithValue(req.Context(), silenceSemWarnContextKey, func() {
			atomic.StoreInt32(&allowQuerySemicolonsInUse, 1)
		}))
		defer func() {
			if atomic.LoadInt32(&allowQuerySemicolonsInUse) == 0 {
				sh.srv.logf("http: URL query contains semicolon, which is no longer a supported separator; parts of the query may be stripped when parsed; see golang.org/issue/25192")
			}
		}()
	}
  // 调用 Handler.ServeHTTP 方法
	handler.ServeHTTP(rw, req)
}
```

### 4.1 HandleFunc
到这里我们就能讲清楚前面 HandleFunc 是什么了:

```go
// 1. Handler 是一个接口
type Handler interface {
	ServeHTTP(ResponseWriter, *Request)
}

// 2. ServeMux 实现了 Handler 接口
type ServeMux struct {
	mu    sync.RWMutex
	m     map[string]muxEntry
	es    []muxEntry // slice of entries sorted from longest to shortest.
	hosts bool       // whether any patterns contain hostnames
}

func (mux *ServeMux) ServeHTTP(w ResponseWriter, r *Request) {
	if r.RequestURI == "*" {
		if r.ProtoAtLeast(1, 1) {
			w.Header().Set("Connection", "close")
		}
		w.WriteHeader(StatusBadRequest)
		return
	}
	h, _ := mux.Handler(r)
	h.ServeHTTP(w, r)
}

// 添加 handler
func (mux *ServeMux) HandleFunc(pattern string, handler func(ResponseWriter, *Request)) {
	if handler == nil {
		panic("http: nil handler")
	}
	mux.Handle(pattern, HandlerFunc(handler))
}

func (mux *ServeMux) Handle(pattern string, handler Handler) {
	mux.mu.Lock()
	defer mux.mu.Unlock()

	e := muxEntry{h: handler, pattern: pattern}
	mux.m[pattern] = e
	if pattern[len(pattern)-1] == '/' {
		mux.es = appendSorted(mux.es, e)
	}
}

type muxEntry struct {
	h       Handler
	pattern string
}

// 3. DefaultServeMux 是默认的 ServeMux
var DefaultServeMux = &defaultServeMux

var defaultServeMux ServeMux

func HandleFunc(pattern string, handler func(ResponseWriter, *Request)) {
	DefaultServeMux.HandleFunc(pattern, handler)
}
```

所以到这里我们就搞清楚了标准的 net/http 请求处理过程了:

```go
func (srv *Server) Serve(l net.Listener) error {
  ln, err := net.Listen("tcp", addr)
  l := ln
  // 1. 调用 BaseContext 
  baseCtx := context.Background()
  if srv.BaseContext != nil {
    baseCtx = srv.BaseContext(origListener)
    if baseCtx == nil {
      panic("BaseContext returned a nil context")
    }
  }
  ctx := context.WithValue(baseCtx, ServerContextKey, srv)
  for {
      // 2. 接收到一个新的请求
      rw, err := l.Accept()
      connCtx := ctx
      // 3. 调用 ConnContext
      if cc := srv.ConnContext; cc != nil {
        connCtx = cc(connCtx, rw)
        if connCtx == nil {
          panic("ConnContext returned nil")
        }
      }
      // 4. 连接对象，处理整个过程的 http 请求和响应
      c := srv.newConn(rw)
      c.setState(c.rwc, StateNew, runHooks) // before Serve can return
      go c.serve(connCtx)

func (c *conn) serve(ctx context.Context) {
	c.remoteAddr = c.rwc.RemoteAddr().String()
	ctx = context.WithValue(ctx, LocalAddrContextKey, c.rwc.LocalAddr())
  for {
      // 3.1 ResponseWrite 和 Request 的生成
      // func (c *conn) readRequest(ctx context.Context) (w *response, err error) 
      // c.readRequest 会生成 Handler 所需要的 Request 对象以后一个内部的 response 对象，这个 response 实现了 http.ResponseWriter 接口
      // 所以 w 就是 http.ResponseWriter
      w, err := c.readRequest(ctx)
      req := w.req
      // conn 的 curReq 保存了内部生成的 response 对象
      c.curReq.Store(w)
      inFlightResponse = w
      // 3.2 调用 Handler 
      serverHandler{c.server}.ServeHTTP(w, w.req)
      w.finishRequest()
      c.setState(c.rwc, StateIdle, runHooks)
      c.curReq.Store((*response)(nil))
    }
```

Server 就是 net/http 的核心，所有基于 net/http 的 web 框架定制的其实就是 Server 中的下面几个部分:
1. Handler: 实现更丰富的路由
2. Context: 实现更丰富的请求控制逻辑(即: 中间件)
3. Request/ResponseWriter: 在 net/http 已有的 ResponseWriter 和 Request 基础上包装更易用的 Request 和 Response 对象。
