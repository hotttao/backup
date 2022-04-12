---
weight: 4
title: "Go 并发调试工具"
date: 2021-07-01T22:00:00+08:00
lastmod: 2021-07-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Go 提供的并发冲突以及死循环检测"
featuredImage: 

tags: ["go 工具集"]
categories: ["Go"]

lightgallery: true

---

 Go 语言提供了一些并发调试工具，这些工具可以帮我们有效的发现并发编程中的 bug
<!-- more -->

## 1. Go race detector
[Go race detector](https://blog.golang.org/race-detector)可以帮助我们自动发现程序有没有数据竞争(data race)，它是基于 Google 的 C/C++ sanitizers 技术实现的，编译器通过探测所有的内存访问，加入代码能监视对这些内存地址的访问（读还是写）。在代码运行的时候，race detector 就能监控到对共享变量的非同步访问，出现 race 时，就会打印出警告信息。

### 1.1 使用
在编译（compile）、测试（test）或者运行（run）Go 代码的时候，加上 race 参数，就有可能发现并发问题。

```go
// -race 启动 data race 检测
go run -race counter.go
```

虽然这个工具使用起来很方便，但是，因为它的实现方式，只能通过真正对实际地址进行读写访问的时候才能探测，所以它不能再编译的时候发现 data race 问题，而且只有在运行时出现 data race 才能检测到。如果碰巧没有出现 data race 是检测不出来的。而且，把开启了 race 的程序部署在线上，还是比较影响性能的。

### 1.2 race 编译后代码
运行 `go tool compile -race -S counter.go`，可以查看计数器例子的代码，下面是一个编译后代码示例:

```bash
// 显示添加 -race 后编译的 go 代码
go tool compile -race -S counter.go


0x002a 00042 (counter.go:13)    CALL    runtime.racefuncenter(SB)
       ......
        0x0061 00097 (counter.go:14)    JMP     173
        0x0063 00099 (counter.go:15)    MOVQ    AX, "".j+8(SP)
        0x0068 00104 (counter.go:16)    PCDATA  $0, $1
        0x0068 00104 (counter.go:16)    MOVQ    "".&count+128(SP), AX
        0x0070 00112 (counter.go:16)    PCDATA  $0, $0
        0x0070 00112 (counter.go:16)    MOVQ    AX, (SP)
        0x0074 00116 (counter.go:16)    CALL    runtime.raceread(SB)
        0x0079 00121 (counter.go:16)    PCDATA  $0, $1
        0x0079 00121 (counter.go:16)    MOVQ    "".&count+128(SP), AX
        0x0081 00129 (counter.go:16)    MOVQ    (AX), CX
        0x0084 00132 (counter.go:16)    MOVQ    CX, ""..autotmp_8+16(SP)
        0x0089 00137 (counter.go:16)    PCDATA  $0, $0
        0x0089 00137 (counter.go:16)    MOVQ    AX, (SP)
        0x008d 00141 (counter.go:16)    CALL    runtime.racewrite(SB)
        0x0092 00146 (counter.go:16)    MOVQ    ""..autotmp_8+16(SP), AX
       ......
        0x00b6 00182 (counter.go:18)    CALL    runtime.deferreturn(SB)
        0x00bb 00187 (counter.go:18)    CALL    runtime.racefuncexit(SB)
        0x00c0 00192 (counter.go:18)    MOVQ    104(SP), BP
        0x00c5 00197 (counter.go:18)    ADDQ    $112, SP
```

在编译的代码中，增加了 runtime.racefuncenter、runtime.raceread、runtime.racewrite、runtime.racefuncexit 等检测 data race 的方法。通过这些插入的指令，Go race detector 工具就能够成功地检测出 data race 问题了。

总结一下，通过在编译的时候插入一些指令，在运行时通过这些插入的指令检测并发读写从而发现 data race 问题，就是这个工具的实现机制。

## 2. go vet 复制检测
Package sync 的同步原语在使用后是不能复制的。原因在于，Mutex 是一个有状态的对象，它的 state 字段记录这个锁的状态。如果你要复制一个已经加锁的 Mutex 给一个新的变量，那么新的刚初始化的变量居然被加锁了，这显然不符合你的期望，因为你期望的是一个零值的 Mutex。关键是在并发环境下，你根本不知道要复制的 Mutex 状态是什么，因为要复制的 Mutex 是由其它 goroutine 并发访问的，状态可能总是在变化。

### 2.1 go vet 使用
Go 在运行时，有死锁的检查机制（[checkdead](https://golang.org/src/runtime/proc.go?h=checkdead#L4345) 方法），它能够发现死锁的 goroutine。但是显然我们不想运行的时候才发现这个因为复制 Mutex 导致的死锁问题。我们可以使用 vet 工具: `go vet counter.go`，把检查写在 Makefile 文件中，在持续集成的时候跑一跑，这样可以及时发现问题，及时修复。

```go
go vet counter.go
```

![go vet](/images/go/sync/go_vet_check.png)

报错信息清楚提示了发生了 lock value 复制的情况，并且显示出了出问题的代码行数以及 copy lock 导致的错误。

### 2.2 检测原理
vet 检查是通过[copylock](https://github.com/golang/tools/blob/master/go/analysis/passes/copylock/copylock.go)分析器静态分析实现的。这个分析器会分析函数调用、range 遍历、复制、声明、函数返回值等位置，有没有锁的值 copy 的情景，以此来判断有没有问题。可以说，只要是实现了 Locker 接口，就会被分析。

我们看到，下面的代码就是确定什么类型会被分析，其实就是实现了 Lock/Unlock 两个方法的 Locker 接口：

```go

var lockerType *types.Interface
  
  // Construct a sync.Locker interface type.
  func init() {
    nullary := types.NewSignature(nil, nil, nil, false) // func()
    methods := []*types.Func{
      types.NewFunc(token.NoPos, nil, "Lock", nullary),
      types.NewFunc(token.NoPos, nil, "Unlock", nullary),
    }
    lockerType = types.NewInterface(methods, nil).Complete()
  }
```

### 2.3 noCopy 辅助 vet 检查

其实，有些没有实现 Locker 接口的同步原语，也能被分析，比如 WaitGroup。WaitGroup 的结构如下所示:

```go
type WaitGroup struct {
    // 避免复制使用的一个技巧，可以告诉vet工具违反了复制使用的规则
    noCopy noCopy
    // 64bit(8bytes)的值分成两段，高32bit是计数值，低32bit是waiter的计数
    // 另外32bit是用作信号量的
    // 因为64bit值的原子操作需要64bit对齐，但是32bit编译器不支持，所以数组中的元素在不同的架构中不一样，具体处理看下面的方法
    // 总之，会找到对齐的那64bit作为state，其余的32bit做信号量
    state1 [3]uint32
}

 
// 得到state的地址和信号量的地址
func (wg *WaitGroup) state() (statep *uint64, semap *uint32) {
    if uintptr(unsafe.Pointer(&wg.state1))%8 == 0 {
        // 如果地址是64bit对齐的，数组前两个元素做state，后一个元素做信号量
        return (*uint64)(unsafe.Pointer(&wg.state1)), &wg.state1[2]
    } else {
        // 如果地址是32bit对齐的，数组后两个元素用来做state，它可以用来做64bit的原子操作，第一个元素32bit用来做信号量
        return (*uint64)(unsafe.Pointer(&wg.state1[1])), &wg.state1[0]
    }
}
```

它有一个 noCopy 的辅助字段，它的作用就是指示 vet 工具在做检查的时候，这个数据结构不能做值复制使用。更严谨地说，是不能在第一次使用之后复制使用 ( must not be copied after first use)。

通过给 WaitGroup 添加一个 noCopy 字段，我们就可以为 WaitGroup 实现 Locker 接口，这样 vet 工具就可以做复制检查了。而且因为 noCopy 字段是未输出类型，所以 WaitGroup 不会暴露 Lock/Unlock 方法。

noCopy 字段的类型是 noCopy，它只是一个辅助的、用来帮助 vet 检查用的类型:

```go
type noCopy struct{}

// Lock is a no-op used by -copylocks checker from `go vet`.
func (*noCopy) Lock()   {}
func (*noCopy) Unlock() {}
```

noCopy 是一个通用的计数技术，其他并发原语中也会用到。同样的，如果你想要自己定义的数据结构不被复制使用，或者说，不能通过 vet 工具检查出复制使用的报警，就可以通过嵌入 noCopy 这个数据类型来实现。

## 3. 死锁检测
前面我们提到Go 在运行时，有死锁的检查机制（[checkdead](https://golang.org/src/runtime/proc.go?h=checkdead#L4345) 方法），能够检查出是否出现了死锁的情况。

Go 死锁探测工具只能探测整个程序是否因为死锁而冻结了，**不能检测出一组 goroutine 死锁导致的某一块业务冻结的情况**。你还可以通过 Go 运行时自带的死锁检测工具，或者是第三方的工具（比如[go-deadlock](https://github.com/sasha-s/go-deadlock)、[go-tools](https://github.com/dominikh/go-tools)）进行检查，这样可以尽早发现一些死锁的问题。不过，有些时候，死锁在某些特定情况下才会被触发，所以，如果你的测试或者短时间的运行没问题，不代表程序一定不会有死锁问题。

并发程序最难跟踪调试的就是很难重现，死锁的 Bug 可能会在极端的情况下出现。通过搜索日志、查看日志，我们能够知道程序有异常了，比如某个流程一直没有结束。这个时候，可以通过 Go pprof 工具分析，它提供了一个 block profiler 监控阻塞的 goroutine。除此之外，我们还可以查看全部的 goroutine 的堆栈信息，通过它，你可以查看阻塞的 groutine 究竟阻塞在哪一行哪一个对象上了。

## 参考
上面这些调试工具的使用，参考自:
1. [极客专栏-鸟叔的 Go 并发编程实战01](https://time.geekbang.org/column/article/294905)
2. [极客专栏-鸟叔的 Go 并发编程实战03](https://time.geekbang.org/column/article/295850)