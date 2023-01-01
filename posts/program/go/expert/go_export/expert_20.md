---
weight: 1
title: "Go 程序调试"
date: 2022-12-19T22:00:00+08:00
lastmod: 2022-12-19T22:00:00+08:00
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
今天我们来学习一些 Go 程序的调试技巧。
<!-- more -->

## 1. 调度器状态的查看方法
Go提供了调度器当前状态的查看方法：使用Go运行时环境变量GODEBUG。

```shell
$ GODEBUG=schedtrace=1000 godoc -http=:6060
SCHED 0ms: gomaxprocs=4 idleprocs=3 threads=3 spinningthreads=0 idlethreads=0 runqueue=0 [0 0 0 0]
SCHED 1001ms: gomaxprocs=4 idleprocs=0 threads=9 spinningthreads=0 idlethreads=3 runqueue=2 [8 14 5 2]
SCHED 2006ms: gomaxprocs=4 idleprocs=0 threads=25 spinningthreads=0 idlethreads=19 runqueue=12 [0 0 4 0]
SCHED 3006ms: gomaxprocs=4 idleprocs=0 threads=26 spinningthreads=0 idlethreads=8 runqueue=2 [0 1 1 0]
SCHED 4010ms: gomaxprocs=4 idleprocs=0 threads=26 spinningthreads=0 idlethreads=20 runqueue=12 [6 3 1 0]
```

GODEBUG 通过给其传入不同的key1=value1, key2=value2, …组合，Go的运行时会输出不同的调试信息，比如在这里我们给GODEBUG传入了"schedtrace=1000"，其含义就是每1000ms打印输出一次goroutine调度器的状态，每次一行。以上面例子中最后一行为例，每一行各字段含义如下：
1. SCHED：调试信息输出标志字符串，代表本行是goroutine调度器相关信息的输出。
2. 6016ms：从程序启动到输出这行日志经过的时间。
3. gomaxprocs：P的数量。
4. idleprocs：处于空闲状态的P的数量。通过gomaxprocs和idleprocs的差值，我们就可以知道当前正在执行Go代码的P的数量。
5. threads：操作系统线程的数量，包含调度器使用的M数量，加上运行时自用的类似sysmon这样的线程的数量。
6. spinningthreads：处于自旋（spin）状态的操作系统数量。
7. idlethread：处于空闲状态的操作系统线程的数量。
8. runqueue=1：Go调度器全局运行队列中G的数量。
9. [3 4 0 10]：分别为4个P的本地运行队列中的G的数量。


还可以输出每个goroutine、M和P的详细调度信息（对于Gopher来说，在大多数情况下这是不必要的）：

```bash
$ GODEBUG=schedtrace=1000,scheddetail=1 godoc -http=:6060
```

## 2. 查看Go程序的汇编代码
查看Go程序的汇编代码有多种方法：
1. 使用objdump工具：`objdump -S go二进制文件`
2. 使用gdb disassemble
3. 使用go tool工具生成汇编代码文件：`go build -gcflags '-S' xx.go > xx.s 2>&1`
4. 将Go代码编译成汇编代码：`go tool compile -S xx.go > xx.s`
5. 使用go tool工具反编译Go程序：`go tool objdump -S go-binary > xx.s`


## 参考资料
1. [Debugging Performance Issues in Go Programs](https://software.intel.com/en-us/blogs/2014/05/10/debugging-performance-issues-in-go-programs)
2. [go.dev/doc/diagnostics](https://go.dev/doc/diagnostics)
3. [go-perfbook](https://github.com/dgryski/go-perfbook/blob/master/performance-zh.md)
4. [talk-yapc-asia-2015](https://github.com/bradfitz/talk-yapc-asia-2015/blob/master/talk.md)