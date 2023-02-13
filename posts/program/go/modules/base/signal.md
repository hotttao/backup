---
weight: 1
title: "go 信号处理"
date: 2021-06-01T22:00:00+08:00
lastmod: 2021-06-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go 的文件 I/O"
featuredImage: 

tags: ["go 库"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

在Go中，通过系统信号是实现优雅退出的一种常见手段。

## 1. 信号处理
应用程序收到系统信号后，一般有三种处理方式。
1. 执行系统默认处理动作，对于中断键触发的SIGINT信号，系统的默认处理动作是终止该应用进程
2. 忽略信号
3. 捕捉信号并执行自定义处理动作，需要应用程序提前为信号注册一个自定义处理动作的函数。系统中有两个系统信号是不能被捕捉的：终止程序信号SIGKILL和挂起程序信号SIGSTOP

服务端程序一般都是以守护进程的形式运行在后台的，并且我们一般都是通过系统信号通知这些守护程序执行退出操作的。如果执行默认处理动作直接退出，守护进程将没有任何机会执行清理和收尾工作。因此，对于运行在生产环境下的程序，不能忽略对系统信号的处理，而应采用捕捉退出信号的方式执行自定义的收尾处理函数。

## 2. Go语言对系统信号处理的支持
Go语言将信号处理的复杂性留给了运行时层，为用户层提供了体验相当友好接口——os/signal包。os/signal 提供了5个函数，其中最主要的函数是 Notify 函数：

```go
func Ignore(sig ...os.Signal)
func Ignored(sig os.Signal) bool
func Notify(c chan<- os.Signal, sig ...os.Signal)
func NotifyContext(parent context.Context, signals ...os.Signal) (ctx context.Context, stop context.CancelFunc)
func Reset(sig ...os.Signal)
func Stop(c chan<- os.Signal)
```

Notify 用来设置捕捉那些应用关注的系统信号，并在Go运行时层与Go用户层之间用一个channel相连。Go运行时捕捉到应用关注的信号后，会将信号写入channel，这样监听该channel的用户层代码便可收到该信号通知。

```go
import (
	"fmt"
	"os"
	"os/signal"
)

func main() {
	// Set up channel on which to send signal notifications.
	// We must use a buffered channel or risk missing the signal
	// if we're not ready to receive when the signal is sent.
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)

	// Block until a signal is received.
	s := <-c
	fmt.Println("Got signal:", s)
}
```

Go运行时进行系统信号处理以及与用户层交互的原理如下图所示:

![Go运行时处理信号的原理](/images/go/expert/signal_notify.png)

Go将信号分为两大类：一类是同步信号，另一类是异步信号。
1. 同步信号
    - 同步信号是指那些由程序执行错误引发的信号，包括
        - SIGBUS（总线错误/硬件异常）
        - SIGFPE（算术异常）
        - SIGSEGV（段错误/无效内存引用）
    - 一旦应用进程中的Go运行时收到这三个信号中的一个，意味着应用极大可能出现了严重bug，无法继续执行下去，这时Go运行时不会简单地将信号通过channel发送到用户层并等待用户层的异步处理，而是直接将信号转换成一个运行时panic并抛出
    - 如果用户层没有专门的panic恢复代码，那么Go应用将默认异常退出
2. 异步信号
    - 同步信号之外的信号都被Go划归为异步信号
    - 异步信号不是由程序执行错误引起的，而是由其他程序或操作系统内核发出的。
    - 异步信号的默认处理行为因信号而异
        - SIGHUP、SIGINT 和 SIGTERM 这三个信号将导致程序直接退出；
        - SIGQUIT、SIGILL、SIGTRAP、SIGABRT、SIGSTKFLT、SIGEMT和SIGSYS在导致程序退出的同时，还会将程序退出时的栈状态打印出来；
        - SIGPROF信号则是被Go运行时用于实现运行时CPU性能剖析指标采集
        - 其他信号不常用，均采用操作系统的默认处理动作
    - 对于用户层通过Notify函数捕获的信号，Go运行时则通过channel将信号发给用户层

这里，我们知道了Notify无法捕捉SIGKILL和SIGSTOP（操作系统机制决定的），也无法捕捉同步信号（Go运行时决定的），只有捕捉异步信号才是有意义的。此外使用 Notify 有如下注意事项: 
1. 如果多次调用Notify拦截某信号，但每次调用使用的channel不同，那么当应用进程收到异步信号时，Go运行时会给每个channel发送一份异步信号副本。
2. 但是如果在同一个channel上两次调用Notify函数（拦截同一异步信号）channel仅收到一个信号。
3. 如果在用户层尚未来得及接收信号的时间段内，运行时连续多次收到触发信号，用户层能收到的信号数量取决于 channel 的缓冲区大小。因此在使用Notify函数时，要根据业务场景的要求，适当选择channel缓冲区的大小。

## 3. 使用系统信号实现程序的优雅退出
所谓优雅退出（gracefully exit），指的就是程序在退出前有机会等待尚未完成的事务处理、清理资源（比如关闭文件描述符、关闭socket）、保存必要中间状态、持久化内存数据（比如将内存中的数据落盘到文件中）等。于此相对应的就是使用 kill -9 强制杀死进程。

下面是一个结合系统信号的使用来实现HTTP服务的优雅退出的示例:

```go
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

func main() {
	var wg sync.WaitGroup

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Hello, Signal!\n")
	})
	var srv = http.Server{
		Addr: "localhost:8080",
	}
    // http.Server 提供了 RegisterOnShutdown 方法以允许开发者注册shutdown时的回调函数。
    // 这是个在服务关闭前清理其他资源、做收尾工作的好场所
    // 注册的函数将在一个单独的goroutine中执行，但Shutdown不会等待这些回调函数执行完毕。所以需要 WaitGroup 进行同步。
	srv.RegisterOnShutdown(func() {
		// 在一个单独的goroutine中执行
		fmt.Println("clean resources on shutdown...")
		time.Sleep(2 * time.Second)
		fmt.Println("clean resources ok")
		wg.Done()
	})

	wg.Add(2)
	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT,
			syscall.SIGTERM,
			syscall.SIGQUIT,
			syscall.SIGHUP)

		<-quit

		timeoutCtx, cf := context.WithTimeout(context.Background(), time.Second*5)
		defer cf()
		var done = make(chan struct{}, 1)
		go func() {
            // 使用http包提供的Shutdown来实现HTTP服务内部的退出清理工作
            // 包括立即关闭所有listener、关闭所有空闲的连接、等待处于活动状态的连接处理完毕（变成空闲连接）等。
			if err := srv.Shutdown(timeoutCtx); err != nil {
				fmt.Printf("web server shutdown error: %v", err)
			} else {
				fmt.Println("web server shutdown ok")
			}
			done <- struct{}{}
			wg.Done()
		}()

		select {
		case <-timeoutCtx.Done():
			fmt.Println("web server shutdown timeout")
		case <-done:
		}
	}()

	err := srv.ListenAndServe()
	if err != nil {
		if err != http.ErrServerClosed {
			fmt.Printf("web server start failed: %v\n", err)
			return
		}
	}
	wg.Wait()
	fmt.Println("program exit ok")
}
```