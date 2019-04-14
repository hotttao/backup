---
title: 8 go 并发编程一
date: 2019-01-08
categories:
    - Go
tags:
    - go语言入门
---

Go 并发编程原语，Goroutines和Channels
<!-- more -->

![Hello World](/images/go/grammar/go_func.jpg)


## 1. Go 并发编程的实现方式
Go对并发的支持是众多强力特性之一，在 Go语言中的并发程序可以用两种手段来实现:
1. goroutine 和 channel: 其支持“顺序通信进程”(communicating sequential processes)或被简称为CSP。CSP是一种现代的并发编程模型，在这种编程模型中值会在不同的运行实例(goroutine)中传递
2. 传统的并发模型：多线程共享内存

在Go语言中，每一个并发的执行单元叫作一个goroutine。当一个程序启动时，其主函数即在一个单独的goroutine中运行，我们叫它main goroutine。新的goroutine会用go语句来创建。在语法上，go语句是一个普通的函数或方法调用前加上关键字go。go语句会使其语句中的函数在一个新创建的goroutine中运行。而go语句本身会迅速地完成。

```Go
f() // call f(); wait for it to return
go f() // create a new goroutine that calls f(); don't wait
```

主函数返回时，所有的goroutine都会被直接打断，程序退出。除了从主函数退出或者直接终止程序之外，没有其它的编程方法能够让一个goroutine来打断另一个的执行，但是之后可以看到一种方式来实现这个目的，通过goroutine之间的通信来让一个goroutine请求其它的goroutine，并让被请求的goroutine自行结束执行。


如果说goroutine是Go语言程序的并发体的话，那么channels则是它们之间的通信机制。一个
channels是一个通信机制，它可以让一个goroutine通过它给另一个goroutine发送值信息。每个
channel都有一个特殊的类型，也就是channels可发送数据的类型。


和其它的引用类型一样，channel的零值也是nil