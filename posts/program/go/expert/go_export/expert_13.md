---
weight: 1
title: "Go 汇编反汇编"
date: 2023-01-05T22:00:00+08:00
lastmod: 2023-01-05T22:00:00+08:00
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

## 1. 查看Go程序的汇编代码
查看Go程序的汇编代码有多种方法：
1. 使用objdump工具：`objdump -S go二进制文件`
2. 使用gdb disassemble
3. 使用go tool工具生成汇编代码文件：`go build -gcflags '-S' xx.go > xx.s 2>&1`
4. 将Go代码编译成汇编代码：`go tool compile -S xx.go > xx.s`
5. 使用go tool工具反编译Go程序：`go tool objdump -S go-binary > xx.s`

```go
// 编译
GOARCH=386 go tool compile -N -l test.go
// 反编译
GOARCH=386 go tool objdump -gnu test.o
```

## 交叉编译
```go
GOOS=linux GOARCH=amd64 go build

// 交叉编译支持的所有架构
$GOROOT/src/go/build/syslist.go
```

## 参考资料
1. [Debugging Performance Issues in Go Programs](https://software.intel.com/en-us/blogs/2014/05/10/debugging-performance-issues-in-go-programs)
2. [go.dev/doc/diagnostics](https://go.dev/doc/diagnostics)
3. [go-perfbook](https://github.com/dgryski/go-perfbook/blob/master/performance-zh.md)
4. [talk-yapc-asia-2015](https://github.com/bradfitz/talk-yapc-asia-2015/blob/master/talk.md)