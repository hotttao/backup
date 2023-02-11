---
weight: 1
title: "Go 网络编程"
date: 2023-01-06T22:00:00+08:00
lastmod: 2023-01-06T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "这个系列我们开始学习 go 语言的第二部分-go语言进阶"
featuredImage: 

tags: ["go 进阶"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

Go是自带运行时的跨平台编程语言，Go中暴露给语言使用者的TCP Socket接口是建立在操作系统原生TCP Socket接口之上的。由于Go运行时调度的需要，Go设计了一套适合自己的TCP Socket网络编程模型。在本条中我们就来理解一下这个模型，并了解在该模型下Go TCP Socket在各个场景下的使用方法、行为特点及注意事项。
<!-- more -->

## 1. TCP Socket网络编程模型
### 1.1 常见的网络 I/O 模型
网络I/O模型定义的是应用线程与操作系统内核之间的交互行为模式。我们通常用阻塞（Blocking）和非阻塞（Non-Blocking）来描述网络I/O模型。不同标准对于网络I/O模型的说法有所不同，比如POSIX.1标准还定义了同步（Sync）和异步（Async）这两个术语来描述模型。

阻塞和非阻塞是以内核是否等数据全部就绪才返回（给发起系统调用的应用线程）来区分的。常用的网络I/O模型包括如下几种。
1. 阻塞I/O模型: 
  - 在这样的模型下，所有Socket默认都是阻塞的。一个线程仅能处理一个网络连接上的数据通信
2. 非阻塞I/O模型: 
  - 在非阻塞模型下，在用户空间线程向操作系统内核发起I/O请求后，如果此刻数据尚未就绪，则会立即将“未就绪”的状态以错误码形式（如EAGAIN/EWOULDBLOCK）返回给此次I/O系统调用的发起者
  - 用户会通过轮询的方式一次次发起I/O请求，直到读到所需的数据
  - 阻塞的Socket默认可以通过fcntl调用转变为非阻塞Socket
3. I/O多路复用模型: 
  - 在该模型下，应用线程首先将需要进行I/O操作的Socket都添加到多路复用函数中（这里以select为例），接着阻塞，等待select系统调用返回
  - 当内核发现有数据到达时，对应的Socket具备通信条件，select函数返回。然后用户线程针对该Socket再次发起网络I/O请求（如read）。由于数据已就绪，因此即便Socket是阻塞的，第二次网络I/O操作也非常快。
  - 塞模型一个线程仅能处理一个Socket，而在I/O多路复用模型中，应用线程可以同时处理多个Socket；虽然可同时处理多个Socket，但I/O多路复用模型由内核实现可读/可写事件的通知，避免了非阻塞模型中轮询带来的CPU计算资源的浪费。
4. 异步I/O模型
  - ，用户应用线程发起异步I/O调用后，内核将启动等待数据的操作并马上返回。之后，用户应用线程可以继续执行其他操作，既无须阻塞，也无须轮询并再次发起I/O调用。
  - 在内核空间数据就绪并被从内核空间复制到用户空间后，内核会主动生成信号以驱动执行用户线程在异步I/O调用时注册的信号处理函数，或主动执行用户线程注册的回调函数，让用户线程完成对数据的处理。

![阻塞I/O模型](/images/go/expert/network_model_blcok.png)
![非阻塞I/O模型](/images/go/expert/network_model_nonblcok.png)
![I/O多路复用模型](/images/go/expert/network_model_poll.png)
![异步I/O模型](/images/go/expert/network_model_aio.png)

有些标准使用同步和异步来描述网络I/O操作模型。所谓同步I/O指的是能**引起请求线程阻塞**，直到I/O操作完成；而异步I/O则不引起请求线程的阻塞。按照这个说法，前面提到的阻塞I/O、非阻塞I/O、I/O多路复用均可看成同步I/O模型，而只有异步I/O才是名副其实的“异步I/O”模型。

相较于上述几个模型，异步I/O模型受各个平台的支持程度不一，且使用起来复杂度较高，在如何进行内存管理、信号处理/回调函数等逻辑设计上会给开发人员带来不小的心智负担。

目前主流网络服务器采用的多是I/O多路复用模型，有的也结合了多线程。不过I/O多路复用模型在支持更多连接、提升I/O操作效率的同时，也给使用者带来了不低的复杂性，以至于出现了许多高性能的I/O多路复用框架（如libevent、libev、libuv等）以降低开发复杂性，减轻开发者的心智负担。

### 1.2 Go 的网络I/O模型
Go语言的设计者认为I/O多路复用的这种通过**回调割裂控制流的模型**依旧复杂，且有悖于一般顺序的逻辑设计，为此他们结合Go语言的自身特点，将该“复杂性”隐藏在了Go运行时中。这样，在大多数情况下，Go开发者无须关心Socket是不是阻塞的，也无须亲自将Socket文件描述符的回调函数注册到类似select这样的系统调用中，而只需在每个连接对应的goroutine中以最简单、最易用的阻塞I/O模型的方式进行Socket操作即可，这种设计大大减轻了网络应用开发人员的心智负担。

一个典型的Go网络服务端程序大致如下：

```go
func handleConn(c net.Conn) {
    defer c.Close()
    for {
        // 从连接上读取数据
        // ...
        // 向连接上写入数据
        // ...
    }
}

func main() {
    l, err := net.Listen("tcp", ":8888")
    if err != nil {
        fmt.Println("listen error:", err)
        return
    }

    for {
        c, err := l.Accept()
        if err != nil {
            fmt.Println("accept error:", err)
            break
        }
        // 启动一个新的goroutine处理这个新连接
        go handleConn(c)
    }
}
```

在**Go程序的用户层**（相对于Go运行时层）看来，goroutine采用了“阻塞I/O模型”进行网络I/O操作，Socket都是“阻塞”的。但实际上，这样的假象是Go运行时中的**netpoller（网络轮询器）**通过I/O多路复用机制模拟出来的，对应的底层操作系统Socket实际上是非阻塞的：

```go
// $GOROOT/src/net/sock_cloexec.go
func sysSocket(family, sotype, proto int) (int, error) {
    ...
    if err = syscall.SetNonblock(s, true); err != nil {
        poll.CloseFunc(s)
        return -1, os.NewSyscallError("setnonblock", err)
    }
    ...
}
```

**运行时拦截了针对底层Socket的系统调用返回的错误码，并通过netpoller和goroutine调度让goroutine“阻塞”在用户层所看到的Socket描述符上。比如：当用户层针对某个Socket描述符发起read操作时，如果该Socket对应的连接上尚无数据，那么Go运行时会将该Socket描述符加入netpoller中监听，直到Go运行时收到该Socket数据可读的通知，Go运行时才会重新唤醒等待在该Socket上准备读数据的那个goroutine。而这个过程从goroutine的视角来看，就像是read操作一直阻塞在那个Socket描述符上似的。**

Go语言在netpoller中采用了I/O多路复用模型。Go运行时会选择在不同操作系统上使用操作系统各自实现的高性能多路复用函数，比如Linux上的epoll、Windows上的iocp、FreeBSD/macOS上的kqueue、Solaris上的event port等，这样可以最大限度地提高netpoller的调度和执行性能。

## 2. Go Tcp Socket 使用
### 2.1 TCP连接的建立
在连接的建立过程中，服务端是一个标准的Listen+Accept的结构（可参考上面的代码），而在客户端Go语言使用Dial或DialTimeout函数发起连接建立请求。

```go
// Dial在调用后将一直阻塞，直到连接建立成功或失败。
conn, err := net.Dial("tcp", "taobao.com:80")
if err != nil {
    // 处理错误
}


// DialTimeout是带有超时机制的Dial：
conn, err := net.DialTimeout("tcp", "localhost:8080", 2 * time.Second)
if err != nil {
    // 处理错误
}

// 连接建立成功，可以进行读写操作
```
对于客户端而言，建立连接时可能会遇到如下几种情形:
1. 络不可达或对方服务未启动:
  - Dial几乎会立即返回错误，报 "getsockopt: connection refused" 错误
2. 对方服务的listen backlog队列满了
  - Dial调用阻塞
  - 通常，即便服务端不调用accept接收客户端连接，在backlog数量范围之内，客户端的连接操作也都是会成功的，因为新的连接已经加入服务端的内核listen队列中了，accept操作只是从这个队列中取出一个连接而已。
  - 也就是说在服务端 backlog 满时（未及时执行accept操作），客户端将阻塞在Dial调用上，直到服务端执行一次accept操作（从backlog队列中腾出一个槽位）。
  - backlog 队列的长度与系统设置有关，linux 上这个参数是 `net.ipv4.tcp_max_syn_backlog`
3. 若网络延迟较大
  - Dial将阻塞并超时，报“getsockopt: operation timed out”的错误

DialTimeout函数可以设置 Dail 最长阻塞时间: `net.DialTimeout("tcp", "105.236.176.96:80", 2*time.Second)`

### 2.2 Socket读写
Dial连接成功后会返回一个net.Conn接口类型的变量值，TCPConn内嵌了一个非导出类型conn。TCPConn.Read/TCPConn.Write 调用的都是 conn 的Read/Write 方法。

```go
//$GOROOT/src/net/tcpsock_posix.go
type TCPConn struct {
    conn
}

//$GOROOT/src/net/net.go
type conn struct {
    fd *netFD
}

func (c *conn) ok() bool { return c != nil && c.fd != nil }

func (c *conn) Read(b []byte) (int, error) {
    if !c.ok() {
        return 0, syscall.EINVAL
    }
    n, err := c.fd.Read(b)
    if err != nil && err != io.EOF {
        err = &OpError{Op: "read", Net: c.fd.net, Source: c.fd.laddr,
            Addr: c.fd.raddr, Err: err}
    }
    return n, err
}

func (c *conn) Write(b []byte) (int, error) {
    if !c.ok() {
        return 0, syscall.EINVAL   
    }
    n, err := c.fd.Write(b)
    if err != nil {
        err = &OpError{Op: "write", Net: c.fd.net, Source: c.fd.laddr,
            Addr: c.fd.raddr, Err: err}
    }
    return n, err
}
```

conn.Read
1. Socket中无数据: 接建立后，如果客户端未发送数据，服务端会阻塞在Socket的读操作上，Go运行时会监视该Socket，直到其有数据读事件才会重新调度该Socket对应的goroutine完成读操作
2. Socket中有部分数据: 如果Socket中有部分数据就绪，且数据数量小于一次读操作所期望读出的数据长度，那么读操作将会成功读出这部分数据并返回，而不是等待期望长度数据全部读取后再返回
3. Socket中有足够多的数据: 如果连接上有数据，且数据长度大于或等于一次Read操作所期望读出的数据长度，那么Read将会成功读出这部分数据并返回
4. Socket关闭: 如果 Socket中还有服务端尚未读取的数据，Read 会正常读取数据，第二次 Read 操作时返回错误EOF（代表连接断开）
5. 读操作超时: 在返回超时错误时，是否也同时读出了一部分数据
6. 成功写: Write调用返回的n与预期要写入的数据长度相等，且error = nil
7. 写阻塞: TCP通信连接两端的操作系统内核都会为该连接保留数据缓冲区，一端调用Write后，实际上数据是写入操作系统协议栈的数据缓冲区中的。TCP是全双工通信，因此每个方向都有独立的数据缓冲区。当发送方将对方的接收缓冲区及自身的发送缓冲区都写满后，Write调用就会阻塞。 
8. 写入部分数据: 写入的部分数据对端可能未接受，需要特殊处理
9. 写入超时: `conn.SetWriteDeadline(time.Now().Add(time.Microsecond * 10))` 可以设置写入超时，超时会出现数据部分写入，在调用Read和Write时依旧要结合这两个方法返回的n和err的结果来做出正确处理


#### conn的读写并发安全性
conn的读写是不是goroutine并发安全的呢？这个问题需要深入研究一下运行时代码。

net.conn只是*netFD的外层包裹结构，最终Write和Read都会落在其中的fd字段上：

```go
//$GOROOT/src/net/net.go
type conn struct {
    fd *netFD
}
```
netFD在不同平台上有着不同的实现，这里以net/fd_unix.go中的netFD为例：

```go
// $GOROOT/src/net/fd_unix.go
// 网络文件描述符
type netFD struct {
    // sysfd的锁，保证读写顺序进行
    fdmu fdMutex
    ...
}
```
netFD类型中包含一个运行时实现的fdMutex类型字段，所有对conn的Read和Write操作都是由fdMutex来同步的:

```go
// $GOROOT/src/net/fd_unix.go

func (fd *netFD) Read(p []byte) (n int, err error) {
    if err := fd.readLock(); err != nil {
        return 0, err
    }
    defer fd.readUnlock()
    if err := fd.pd.PrepareRead(); err != nil {
        return 0, err
    }
    for {
        n, err = syscall.Read(fd.sysfd, p)
        if err != nil {
            n = 0
            if err == syscall.EAGAIN {
                if err = fd.pd.WaitRead(); err == nil {
                    continue
                }
            }
        }
        err = fd.eofError(n, err)
        break
    }
    if _, ok := err.(syscall.Errno); ok {
        err = os.NewSyscallError("read", err)
    }
    return
}

func (fd *netFD) Write(p []byte) (nn int, err error) {
    if err := fd.writeLock(); err != nil {
        return 0, err
    }
    defer fd.writeUnlock()
    if err := fd.pd.PrepareWrite(); err != nil {
        return 0, err
    }
    for {
        var n int
        n, err = syscall.Write(fd.sysfd, p[nn:])
        if n > 0 {
            nn += n
        }
        if nn == len(p) {
            break
        }
        if err == syscall.EAGAIN {
            if err = fd.pd.WaitWrite(); err == nil {
                continue
            }
        }
        if err != nil {
            break
        }
        if n == 0 {
            err = io.ErrUnexpectedEOF
            break
        }
    }
    if _, ok := err.(syscall.Errno); ok {
        err = os.NewSyscallError("write", err)
    }
    return nn, err
}
```

**每次Write操作都是受锁保护的，直到此次数据全部写完。因此在应用层面，要想保证多个goroutine在一个conn上的Write操作是安全的，需要让每一次Write操作完整地写入一个业务包。**Read操作，也是有锁保护的。多个goroutine对同一conn的并发读不会出现读出内容重叠的情况，但内容断点是依运行时调度来随机确定的。存在一个业务包数据三分之一的内容被goroutine-1读走，而另三分之二被goroutine-2读走的情况。

### 2.3 Socket属性
原生Socket API提供了丰富的sockopt设置接口，Go提供的socket options接口也是基于上述模型的必要的属性设置，包括SetKeepAlive、SetKeep-AlivePeriod、SetLinger、SetNoDelay （默认为no delay）、SetWriteBuffer、SetReadBuffer。不过这些方法是TCPConn类型的，而不是Conn类型的。要使用上面的方法，需要进行类型断言（type assertion）操作：

```go
tcpConn, ok := c.(*TCPConn)
if !ok {
    // 错误处理
}

tcpConn.SetNoDelay(true)
```

对于listener的监听Socket，Go默认设置了SO_REUSEADDR，这样当你重启服务程序时，不会因为address in use的错误而重启失败。
