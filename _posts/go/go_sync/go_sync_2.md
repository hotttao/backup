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