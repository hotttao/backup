---
title: 16 Golang 内存模型
date: 2019-02-16
categories:
    - Go
tags:
    - go并发编程
---
内存模型
<!-- more -->

## 1. Go 内存模型概述
[Go 内存模型](https://golang.org/ref/mem) 描述的是并发环境中多 goroutine 读相同变量的时候，变量的可见性条件。具体点说，就是指，在什么条件下，goroutine 在读取一个变量的值的时候，能够看到其它 goroutine 对这个变量进行的写的结果。

由于 CPU 指令重排和多级 Cache 的存在，保证多核访问同一个变量这件事儿变得非常复杂。编程语言需要一个规范，来明确多线程同时访问同一个变量的可见性和顺序（ Russ Cox 在麻省理工学院 [6.824 分布式系统 Distributed Systems 课程](https://pdos.csail.mit.edu/6.824/) 的一课，专门介绍了相关的[知识](http://nil.csail.mit.edu/6.824/2016/notes/gomem.pdf)）。在编程语言中，这个规范被叫做内存模型。

为什么这些编程语言都要定义内存模型呢？在我看来，主要是两个目的。
1. 向广大的程序员提供一种保证，以便他们在做设计和开发程序时，面对同一个数据同时被多个 goroutine 访问的情况，可以做一些串行化访问的控制，比如使用 Channel 或者 sync 包和 sync/atomic 包中的并发原语。
2. 允许编译器和硬件对程序做一些优化。这一点其实主要是为编译器开发者提供的保证，这样可以方便他们对 Go 的编译器做优化。

### 1.1 重排和可见性的问题
首先，我们要先弄明白**重排和可见性**的问题，因为它们影响着程序**实际执行的顺序关系**。

由于指令重排，代码并不一定会按照你写的顺序执行。举个例子:
1. 当两个 goroutine 同时对一个数据进行读写时
2. 假设 goroutine g1 对这个变量进行写操作 w，goroutine g2 同时对这个变量进行读操作 r，
3. 如果 g2 在执行读操作 r 的时候，已经看到了 g1 写操作 w 的结果，那么，也不意味着 g2 能看到在 w 之前的其它的写操作

```go
// 排以及多核 CPU 并发执行导致程序的运行和代码的书写顺序不一样的情况

var a, b int

func f() {
  a = 1 // w之前的写操作
  b = 2 // 写操作w
}

func g() {
  // 即使这里打印出的值是 2，但是依然可能在打印 a 的值时，打印出初始值 0，而不是 1
  // 因为，程序运行的时候，不能保证 g2 看到的 a 和 b 的赋值有先后关系。
  print(b) // 读操作r
  print(a) // ???
}

func main() {
  go f() //g1
  g() //g2
}
```

g() 函数内要打印 b 的值。需要注意的是，即使这里打印出的值是 2，但是依然可能在打印 a 的值时，打印出初始值 0，而不是 1。这是因为，程序运行的时候，不能保证 g2 看到的 a 和 b 的赋值有先后关系。

```go

var a string
var done bool

func setup() {
  a = "hello, world"
  done = true
}

func main() {
  go setup()
  for !done {
  }
  print(a)
}
```

在这段代码中，主 goroutine main 即使观察到 done 变成 true 了，最后读取到的 a 的值仍然可能为空。

更糟糕的情况是，main 根本就观察不到另一个 goroutine 对 done 的写操作，这就会导致 main 程序一直被 hang 住。甚至可能还会出现半初始化的情况，比如：

```go

type T struct {
  msg string
}

var g *T

func setup() {
  t := new(T)
  t.msg = "hello, world"
  g = t
}

func main() {
  go setup()
  for g == nil {
  }
  print(g.msg)
}
```

即使 main goroutine 观察到 g 不为 nil，也可能打印出空的 msg（第 17 行）。

## 2. hanppen-before
刚刚说了，程序在运行的时候，两个操作的顺序可能不会得到保证，怎么办呢？接下来，我们要了解一下 Go 内存模型中很重要的一个概念：happens-before，这是用来描述两个时间的顺序关系的。如果某些操作能提供 happens-before 关系，那么，我们就可以 100% 保证它们之间的顺序。

**在一个 goroutine 内部**，程序的执行顺序和它们的代码指定的顺序是一样的，即使编译器或者 CPU 重排了读写顺序，从行为上来看，也和代码指定的顺序一样。

在下面的代码中，即使编译器或者 CPU 对 a、b、c 的初始化进行了重排，但是打印结果依然能保证是 1、2、3，而不会出现 1、0、0 或 1、0、1 等情况。

```go

func foo() {
    var a = 1
    var b = 2
    var c = 3

    println(a)
    println(b)
    println(c)
}
```

但是，对于另一个 goroutine 来说，重排却会产生非常大的影响。因为 Go 只保证 goroutine 内部重排对读写的顺序没有影响。

如果两个 action（read 或者 write）有明确的 happens-before 关系，你就可以确定它们之间的执行顺序（或者是行为表现上的顺序）。Go 内存模型通过 happens-before 定义两个事件（读、写 action）的顺序：
1. 如果事件 e1  happens before 事件 e2，那么，我们就可以说事件 e2 在事件 e1 之后发生（happens after）。
2. 如果 e1 不是 happens before e2， 同时也不 happens after e2，那么，我们就可以说事件 e1 和 e2 是同时发生的。

如果要保证对“变量 v 的读操作 r”能够观察到一个对“变量 v 的写操作 w”，并且 r 只能观察到 w 对变量 v 的写，没有其它对 v 的写操作，也就是说，我们要保证 r 绝对能观察到 w 操作的结果，那么就需要同时满足两个条件：
1. w happens before r；
2. 其它对 v 的写操作（w2、w3、w4, …） 要么 happens before w，要么 happens after r，绝对不会和 w、r 同时发生，或者是在它们之间发生。

对于单个的 goroutine 来说，它有一个特殊的 happens-before 关系: **在单个的 goroutine 内部， happens-before 的关系和代码编写的顺序是一致的**。即在 goroutine 内部对一个局部变量 v 的读，一定能观察到最近一次对这个局部变量 v 的写。如果要保证多个 goroutine 之间对一个共享变量的读写顺序，在 Go 语言中，可以使用并发原语为读写操作建立 happens-before 关系，这样就可以保证顺序了。

说到这儿，先补充三个 Go 语言中和内存模型有关的小知识:
1. 在 Go 语言中对变量进行零值的初始化就是一个写操作。
2. 如果对超过机器 word（64bit、32bit 或者其它）大小的值进行读写，那么，就可以看作是对拆成 word 大小的几个读写无序进行。
3. Go 并不提供直接的 CPU 屏障（CPU fence）来提示编译器或者 CPU 保证顺序性，而是使用不同架构的内存屏障指令来实现统一的并发原语。

接下来，我们就来学习 Go 语言中提供的 happens-before 关系保证，包括:
1. init 函数
2. goroutine
3. Channel
4. Mutex/RWMutex
5. WaitGroup
6. Once

## 2. init 函数
应用程序的初始化是在单一的 goroutine 执行的。如果包 p 导入了包 q，那么，q 的 init 函数的执行一定 happens before  p 的任何初始化代码。而**main 函数一定在导入的包的 init 函数之后执行**。

Go 采用依赖分析技术，确定包的初始化顺序:
1. 包级别的变量在同一个文件中是按照声明顺序逐个初始化的，除非初始化它的时候依赖其它的变量
2. 同一个包下的多个文件，会按照文件名的排列顺序进行初始化。这个顺序被定义在Go 语言规范中，而不是 Go 的内存模型规范中。

依赖分析技术保证的顺序只是针对同一包下的变量，而且，只有引用关系是本包变量、函数和非接口的方法，才能保证它们的顺序性。

## 3. goroutine
首先，我们需要明确一个规则：启动 goroutine 的 go 语句的执行，一定 happens before 此 goroutine 内的代码执行。根据这个规则，我们就可以知道，如果 go 语句传入的参数是一个函数执行的结果，那么，这个函数一定先于 goroutine 内部的代码被执行。

我们看下面这个例子:
1. 第 8 行 a 的赋值和第 9 行的 go 语句是在同一个 goroutine 中执行的，所以，在主 goroutine 看来，第 8 行肯定 happens before 第 9 行
2. 又由于刚才的保证，第 9 行子 goroutine 的启动 happens before 第 4 行的变量输出
3. 我们就可以推断出，第 8 行 happens before 第 4 行。也就是说，在第 4 行打印 a 的值的时候，肯定会打印出“hello world”

```go
var a string

func f() {
  print(a)           // 4
}

func hello() {
  a = "hello, world"  // 8
  go f()
}
```

刚刚说的是启动 goroutine 的情况，goroutine 退出的时候，是没有任何 happens-before 保证的。所以，如果你想观察某个 goroutine 的执行效果，你需要使用同步机制建立 happens-before 关系，比如 Mutex 或者 Channel。

## 4. channel
通用的 Channel happens-before 关系保证有 4 条规则，我分别来介绍下:
1. 往 Channel 中的发送操作，happens before 从该 Channel 接收相应数据的动作完成之前，即第 n 个 send 一定 happens before 第 n 个 receive 的完成
2. close 一个 Channel 的调用，肯定 happens before 从关闭的 Channel 中读取出一个零值
3. 对于 unbuffered 的 Channel，也就是容量是 0 的 Channel，从此 Channel 中读取数据的调用一定 happens before 往此 Channel 发送数据的调用完成
4. 如果 Channel 的容量是 m（m>0），那么，第 n 个 receive 一定 happens before 第 n+m 个 send 的完成

```go
var ch = make(chan struct{}, 10) // buffered或者unbuffered
var s string

func f() {
  s = "hello, world" // 5
  ch <- struct{}{}   // 6
}

func main() {
  go f()
  <-ch               // 11
  print(s)
}
```

在这个例子中：
1. s 的初始化（第 5 行）happens before 往 ch 中发送数据
2. 往 ch 发送数据 happens before 从 ch 中读取出一条数据（第 11 行），
3. 第 12 行打印 s 的值 happens after 第 11 行
4. 所以，打印的结果肯定是初始化后的 s 的值“hello world”

如果你把第 6 行替换成 close(ch)，也能保证同样的执行顺序。因为第 11 行从关闭的 ch 中读取出零值后，第 6 行肯定被调用了。

```go
var ch = make(chan int)
var s string

func f() {
  s = "hello, world"
  <-ch              // 6
}

func main() {
  go f()
  ch <- struct{}{}  // 11 
  print(s)
}
```
这个例子中:
1. 如果第 11 行发送语句执行成功（完毕），那么根据规则 3，第 6 行（接收）的调用肯定发生了（执行完成不完成不重要，重要的是这一句“肯定执行了”），那么 s 也肯定初始化了，所以一定会打印出“hello world”。

## 5. Mutex/RWMutex
对于互斥锁 Mutex m 或者读写锁 RWMutex m，有 3 条 happens-before 关系的保证:
1. 第 n 次的 m.Unlock 一定 happens before 第 n+1 m.Lock 方法的返回；
2. 对于读写锁 RWMutex m，如果它的第 n 个 m.Lock 方法的调用已返回，那么它的第 n 个 m.Unlock 的方法调用一定 happens before 任何一个 m.RLock 方法调用的返回，只要这些 m.RLock 方法调用 happens after 第 n 次 m.Lock 的调用的返回。这就可以保证，只有释放了持有的写锁，那些等待的读请求才能请求到读锁。
3. 对于读写锁 RWMutex m，如果它的第 n 个 m.RLock 方法的调用已返回，那么它的第 k （k<=n）个成功的 m.RUnlock 方法的返回一定 happens before 任意的 m.Lock 方法调用，只要这些 m.Lock 方法调用 happens after 第 n 次 m.RLock。这样就可以保证，只有 m.Lock 调用前，所有的读锁释放了，写锁才能请求到锁。

## 6. WaitGroup
对于一个 WaitGroup 实例 wg，在某个时刻 t0 时，它的计数值已经不是零了，假如 t0 时刻之后调用了一系列的 wg.Add(n) 或者 wg.Done()，并且只有最后一次调用 wg 的计数值变为了 0，那么，可以保证这些 wg.Add 或者 wg.Done() 一定 happens before t0 时刻之后调用的 wg.Wait 方法的返回。

这个保证的通俗说法，就是 Wait 方法等到计数值归零之后才返回。

## 7. Once
Once 提供的保证是：对于 once.Do(f) 调用，f 函数的那个单次调用一定 happens before 任何 once.Do(f) 调用的返回。换句话说，就是函数 f 一定会在 Do 方法返回之前执行。

## 8. atomic

其实，Go 内存模型的官方文档并没有明确给出 atomic 的保证，有一个相关的 issue [go# 5045](https://github.com/golang/go/issues/5045)记录了相关的讨论。Russ Cox 想让 atomic 有一个弱保证，这样可以为以后留下充足的可扩展空间，所以，Go 内存模型规范上并没有严格的定义。

对于 Go 1.15 的官方实现来说，可以保证使用 atomic 的 Load/Store 的变量之间的顺序性。在下面的例子中，打印出的 a 的结果总是 1，但是官方并没有做任何文档上的说明和保证。

```go
func main() {
  var a, b int32 = 0, 0

  go func() {
    atomic.StoreInt32(&a, 1)
    atomic.StoreInt32(&b, 1)
  }()

  for atomic.LoadInt32(&b) == 0{
    runtime.Gosched()
  }
    fmt.Println(atomic.LoadInt32(&a))
}
```

依照 Ian Lance Taylor 的说法，Go 核心开发组的成员几乎没有关注这个方向上的研究，因为这个问题太复杂，有很多问题需要去研究，所以，现阶段还是不要使用 atomic 来保证顺序性。