---
title: 2 Go 并发调试工具
date: 2019-02-02
categories:
    - Go
tags:
    - go并发编程
---

在我们正式介绍 Go 并发编程之前，我们先来介绍 Go 语言提供的一些并发调试工具，这些工具可以帮我们有效的发现并发编程中的 bug
<!-- more -->

## 1. Go race detector
[Go race detector](https://blog.golang.org/race-detector)可以帮助我们自动发现程序有没有数据竞争(data race)，它是基于 Google 的 C/C++ sanitizers 技术实现的，编译器通过探测所有的内存访问，加入代码能监视对这些内存地址的访问（读还是写）。在代码运行的时候，race detector 就能监控到对共享变量的非同步访问，出现 race 时，就会打印出警告信息。

### 1.1 使用
在编译（compile）、测试（test）或者运行（run）Go 代码的时候，加上 race 参数，就有可能发现并发问题。

```go
// -race 启动 data race 检测
go run -race counter.go

// 显示添加 -race 后编译的 go 代码
go tool compile -race -S counter.go
```

虽然这个工具使用起来很方便，但是，因为它的实现方式，只能通过真正对实际地址进行读写访问的时候才能探测，所以它不能再编译的时候发现 data race 问题，而且只有在运行时出现 data race 才能检测到。如果碰巧没有出现 data race 是检测不出来的。

## 2. 复制检测
Package sync 的同步原语在使用后是不能复制的。原因在于，Mutex 是一个有状态的对象，它的 state 字段记录这个锁的状态。如果你要复制一个已经加锁的 Mutex 给一个新的变量，那么新的刚初始化的变量居然被加锁了，这显然不符合你的期望，因为你期望的是一个零值的 Mutex。关键是在并发环境下，你根本不知道要复制的 Mutex 状态是什么，因为要复制的 Mutex 是由其它 goroutine 并发访问的，状态可能总是在变化。

Go 在运行时，有死锁的检查机制（checkdead()  方法），它能够发现死锁的 goroutine。但是显然我们不想运行的时候才发现这个因为复制 Mutex 导致的死锁问题。我们可以使用 vet 工具: `go vet counter.go`，把检查写在 Makefile 文件中，在持续集成的时候跑一跑，这样可以及时发现问题，及时修复。

vet 检查是通过[copylock](https://github.com/golang/tools/blob/master/go/analysis/passes/copylock/copylock.go)分析器静态分析实现的。这个分析器会分析函数调用、range 遍历、复制、声明、函数返回值等位置，有没有锁的值 copy 的情景，以此来判断有没有问题。可以说，只要是实现了 Locker 接口，就会被分析。

```go
go vet counter.go
```

## 3. 死锁检测
go-deadlock、go-tools

## 4. Go pprof
