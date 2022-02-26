---
weight: 1
title: "Channel 使用与实现"
date: 2021-05-11T22:00:00+08:00
lastmod: 2021-05-11T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Channel 是 Go 语言内建的 first-class 类型，也是 Go 语言与众不同的特性之一"
featuredImage: 

tags: ["go 并发"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---


## 1. Channel 概述
### 1.1 CSP 模型
要想了解 Channel，我们要先追溯到 CSP 模型。CSP 是 Communicating Sequential Process 的简称，中文直译为通信顺序进程，或者叫做交换信息的循序进程，是用来描述并发系统中进行交互的一种模式。CSP 允许使用进程组件来描述系统，它们独立运行，并且只通过消息传递的方式通信。有关Go 中如何通过 Channel 实现 CSP 参见这边文章[CSP 的发展](https://swtch.com/~rsc/thread/)。

Channel 类型是 Go 语言内置的类型，Channel 和 Go 的另一个独特的特性 goroutine 一起为并发编程提供了优雅的、便利的、与传统并发控制不同的方案，并演化出很多并发模式。

Go 语言的 Channel 设计精巧简单，以至于也有人用其它语言编写了类似 Go 风格的 Channel 库，比如[docker/libchan](https://github.com/docker/libchan)、[tylertreat/chan](https://github.com/tylertreat/chan)

### 1.2 Channel 的应用场景
Go 语言的哲学: Don’t communicate by sharing memory, share memory by communicating -- 执行业务处理的 goroutine 不要通过共享内存的方式通信，而是要通过 Channel 通信的方式分享数据。

“communicate by sharing memory”和“share memory by communicating”是两种不同的并发处理模式:
1. **communicate by sharing memory** 是传统的并发编程处理方式，就是指，共享的数据需要用锁进行保护，goroutine 需要获取到锁，才能并发访问数据。
2. **share memory by communicating** 则是类似于 CSP 模型的方式，通过通信的方式，一个 goroutine 可以把**数据的“所有权”**交给另外一个 goroutine

综合起来，Channel 的应用场景分为五种类型:
1. 数据交流：当作并发的 buffer 或者 queue，解决生产者 - 消费者问题。多个 goroutine 可以并发当作生产者（Producer）和消费者（Consumer）
2. 数据传递：一个 goroutine 将数据交给另一个 goroutine，相当于把数据的拥有权 (引用) 托付出去。
3. 信号通知：一个 goroutine 可以将信号 (closing、closed、data ready 等) 传递给另一个或者另一组 goroutine
4. 任务编排：可以让一组 goroutine 按照一定的顺序并发或者串行的执行，这就是编排的功能
5. 锁：利用 Channel 也可以实现互斥锁的机制

### 1.3 Channel 使用
#### Channel 类型和声明
Channel 分为只能接收、只能发送、既可以接收又可以发送三种类型:

```go
// 1. 语法定义
ChannelType = ( "chan" | "chan" "<-" | "<-" "chan" ) ElementType .
// 2. 类型声明

chan string          // 可以发送接收string
chan<- struct{}      // 只能发送struct{}
<-chan int           // 只能从chan接收int
```
类型声明中 “<-”表示单向的 chan，这个**箭头总是射向左边的**，元素类型总在最右边。如果**箭头指向 chan**，就表示可以往 chan 中塞数据；如果**箭头远离 chan**，就表示 chan 会往外吐数据。

chan 中的元素是任意的类型，所以也可能是 chan 类型，下面的 chan 类型都是合法的:

```go
chan<- chan int   
chan<- <-chan int  
<-chan <-chan int
chan (<-chan int)
```

怎么判定箭头符号属于哪个 chan 呢？其实，**“<-”有个规则，总是尽量和左边的 chan 结合**.因此，上面的定义和下面的使用括号的划分是一样的：

```go

chan<- （chan int） // <- 和第一个chan结合
chan<- （<-chan int） // 第一个<-和最左边的chan结合，第二个<-和左边第二个chan结合
<-chan （<-chan int） // 第一个<-和最左边的chan结合，第二个<-和左边第二个chan结合 
chan (<-chan int) // 因为括号的原因，<-和括号内第一个chan结合
```

#### Channel 初始化
通过 make，我们可以初始化一个 chan，未初始化的 chan 的零值是 nil。可以设置它的容量，设置容量的 chan 叫做 buffered chan；如果没有设置，它的容量是 0，这样的 chan 叫做 unbuffered chan。

```go

make(chan int, 9527)
```

#### Channel 阻塞与 panic
向 chan 读写数据时:
1. 如果 chan 中还有数据，那么，从这个 chan 接收数据的时候就不会阻塞
2. 如果 chan 还未满（“满”指达到其容量），给它发送数据也不会阻塞，否则就会阻塞
3. unbuffered chan 只有读写都准备好之后才不会阻塞
4. nil 是 chan 的零值，是一种特殊的 chan，对值是 nil 的 chan 的发送接收调用者总是会阻塞。

close channel 时:
1. 如果 chan 为 nil，close 会 panic；
2. 如果 chan 已经 closed，再次 close 也会 panic
3. 如果 chan 不为 nil，chan 也没有 closed，就**把等待队列中的 sender（writer）和 receiver（reader）从队列中全部移除并唤醒**。

值得注意的点是，只要一个 chan 还有未读的数据，即使把它 close 掉，你还是可以继续把这些未读的数据消费完，之后才是读取零值数据。

![Channel Status](/images/go/sync/chan_status.jpg)

#### Channel 常见操作
chan 常见操作分为: 
1. 发送数据: `ch <- value`
2. 接受数据: `<-ch`，可以返回两个值
    - 第一个值是返回的 chan 中的元素
    - 第二个值是 bool 类型，代表是否成功地从 chan 中读取到一个值
    - 如果第二个参数是 false，chan 已经被 close 而且 chan 中没有缓存的数据，这个时候，第一个值是零值
    - 所以，如果从 chan 读取到一个零值，可能是 sender 真正发送的零值，也可能是 closed 的并且没有缓存元素产生的零值
3. 关闭: `close(ch)`
4. 其他: cap 返回 chan 的容量，len 返回 chan 中缓存的还未被取走的元素数量

```go
// 往 chan 中发送一个数据使用“ch<-”，发送数据是一条语句
ch <- 200

// 从 chan 中接收一条数据使用“<-ch”，接收数据也是一条语句：
x := <-ch  // 把接收的一条数据赋值给变量x
foo(<-ch)  // 把接收的一个的数据作为参数传给函数
<-ch       // 丢弃接收的一条数据

// ch 可以作为 select 语句的 case clause

func main() {
    var ch = make(chan int, 10)
    for i := 0; i < 10; i++ {
        select {
        case ch <- i:
        case v := <-ch:
            fmt.Println(v)
        }
    }
}

// chan 还可以用在 for-range 语句中:
for v:= range ch {
    fmt.Println(v)
}

// 清空 chan
for range ch {

}
```

## 2. Channel 的实现

### 2.1 Channel 数据结构
chan 类型的数据结构如下图所示，它的数据类型是[runtime.hchan](https://github.com/golang/go/blob/master/src/runtime/chan.go#L32)

![Channel](/images/go/sync/channel.jpg)

1. qcount：代表 chan 中已经接收但还没被取走的元素的个数。内建函数 len 可以返回这个字段的值。
2. dataqsiz：队列的大小。chan 使用一个循环队列来存放元素，循环队列很适合这种生产者 - 消费者的场景
3. buf：存放元素的循环队列的 buffer
4. elemtype 和 elemsize：chan 中元素的类型和 size， chan 一旦声明，它的元素类型是固定的
5. sendx：处理发送数据的指针在 buf 中的位置。一旦接收了新的数据，指针就会加上 elemsize，移向下一个位置。buf 的总大小是 elemsize 的整数倍，而且 buf 是一个循环列表。
6. ecvx：处理接收请求时的指针在 buf 中的位置。一旦取出数据，此指针会移动到下一个位置。
7. recvq：chan 是多生产者多消费者的模式，如果消费者因为没有数据可读而被阻塞了，就会被加入到 recvq 队列中。
8. sendq：如果生产者因为 buf 满了而阻塞，会被加入到 sendq 队列中。

### 2.1 初始化
Go 在编译的时候，会根据容量的大小选择调用 makechan64，还是 makechan。 makechan64 只是做了 size 检查，底层还是调用 makechan 实现的。makechan 的目标就是生成 hchan 对象。

![Channel Init](/images/go/sync/chan_init.png)

 makechan 会根据 chan 的容量的大小和元素的类型不同，初始化不同的存储空间:

```go

func makechan(t *chantype, size int) *hchan {
    elem := t.elem
  
        // 略去检查代码
        mem, overflow := math.MulUintptr(elem.size, uintptr(size))
        
    //
    var c *hchan
    switch {
    case mem == 0:
      // chan的size或者元素的size是0，不必创建buf
      c = (*hchan)(mallocgc(hchanSize, nil, true))
      c.buf = c.raceaddr()
    case elem.ptrdata == 0:
      // 元素不是指针，分配一块连续的内存给hchan数据结构和buf
      c = (*hchan)(mallocgc(hchanSize+mem, nil, true))
            // hchan数据结构后面紧接着就是buf
      c.buf = add(unsafe.Pointer(c), hchanSize)
    default:
      // 元素包含指针，那么单独分配buf
      c = new(hchan)
      c.buf = mallocgc(mem, elem, true)
    }
  
        // 元素大小、类型、容量都记录下来
    c.elemsize = uint16(elem.size)
    c.elemtype = elem
    c.dataqsiz = uint(size)
    lockInit(&c.lock, lockRankHchan)

    return c
  }
```

### 2.2 send
Go 在编译发送数据给 chan 的时候，会把 send 语句转换成 chansend1 函数，chansend1 函数会调用 chansend，我们分段学习它的逻辑：


最开始，第一部分是进行判断：如果 chan 是 nil 的话，就把调用者 goroutine park（阻塞休眠）， 调用者就永远被阻塞住了，所以，第 11 行是不可能执行到的代码。

```go

func chansend1(c *hchan, elem unsafe.Pointer) {
    chansend(c, elem, true, getcallerpc())
}
func chansend(c *hchan, ep unsafe.Pointer, block bool, callerpc uintptr) bool {
        // 第一部分
    if c == nil {
      if !block {
        return false
      }
      gopark(nil, nil, waitReasonChanSendNilChan, traceEvGoStop, 2)
      throw("unreachable")
    }
      ......
  }
```

第二部分的逻辑是当你往一个已经满了的 chan 实例发送数据时，并且想不阻塞当前调用，那么这里的逻辑是直接返回。chansend1 方法在调用 chansend 的时候设置了阻塞参数，所以不会执行到第二部分的分支里。

```go

  // 第二部分，如果chan没有被close,并且chan满了，直接返回
    if !block && c.closed == 0 && full(c) {
      return false
  }
```

第三部分显示的是，如果 chan 已经被 close 了，再往里面发送数据的话会 panic。

```go

  // 第三部分，chan已经被close的情景
    lock(&c.lock) // 开始加锁
    if c.closed != 0 {
      unlock(&c.lock)
      panic(plainError("send on closed channel"))
  }
```

第四部分，如果等待队列中有等待的 receiver，那么这段代码就把它从队列中弹出，然后直接把数据交给它（通过 memmove(dst, src, t.size)），而不需要放入到 buf 中。(注: 队列中有等待的 receiver 说明buf 中没有数据，所以不会影响消息的顺序性)

```go

      // 第四部分，从接收队列中出队一个等待的receiver
        if sg := c.recvq.dequeue(); sg != nil {
      // 
      send(c, sg, ep, func() { unlock(&c.lock) }, 3)
      return true
    }
```

第五部分说明当前没有 receiver，需要把数据放入到 buf 中，放入之后，就成功返回了。

```go

    // 第五部分，buf还没满
      if c.qcount < c.dataqsiz {
      qp := chanbuf(c, c.sendx)
      if raceenabled {
        raceacquire(qp)
        racerelease(qp)
      }
      typedmemmove(c.elemtype, qp, ep)
      c.sendx++
      if c.sendx == c.dataqsiz {
        c.sendx = 0
      }
      c.qcount++
      unlock(&c.lock)
      return true
    }
```

第六部分是处理 buf 满的情况。如果 buf 满了，发送者的 goroutine 就会加入到发送者的等待队列中，直到被唤醒。这个时候，数据或者被取走了，或者 chan 被 close 了。

```go

      // 第六部分，buf满。
        // chansend1不会进入if块里，因为chansend1的block=true
        if !block {
      unlock(&c.lock)
      return false
    }
        ......
```

### 2.3 recv
在处理从 chan 中接收数据时，Go 会把代码转换成 chanrecv1 函数，如果要返回两个返回值，会转换成 chanrecv2，chanrecv1 函数和 chanrecv2 会调用 chanrecv。

chanrecv1 和 chanrecv2 传入的 block 参数的值是 true，都是阻塞方式，所以我们分析 chanrecv 的实现的时候，不考虑 block=false 的情况。第一部分是 chan 为 nil 的情况。和 send 一样，从 nil chan 中接收（读取、获取）数据时，调用者会被永远阻塞。
```go

  func chanrecv1(c *hchan, elem unsafe.Pointer) {
    chanrecv(c, elem, true)
  }
  func chanrecv2(c *hchan, elem unsafe.Pointer) (received bool) {
    _, received = chanrecv(c, elem, true)
    return
  }

    func chanrecv(c *hchan, ep unsafe.Pointer, block bool) (selected, received bool) {
        // 第一部分，chan为nil
    if c == nil {
      if !block {
        return
      }
      gopark(nil, nil, waitReasonChanReceiveNilChan, traceEvGoStop, 2)
      throw("unreachable")
    }
```

第二部分你可以直接忽略，因为chanrecv1 和 chanrecv2 传入的 block 参数的值是 true
```go

  // 第二部分, block=false且c为空
    if !block && empty(c) {
      ......
    }
```

第三部分是 chan 已经被 close 的情况。如果 chan 已经被 close 了，并且队列中没有缓存的元素，那么返回 true、false。

```go

        // 加锁，返回时释放锁
      lock(&c.lock)
      // 第三部分，c已经被close,且chan为空empty
    if c.closed != 0 && c.qcount == 0 {
      unlock(&c.lock)
      if ep != nil {
        typedmemclr(c.elemtype, ep)
      }
      return true, false
    }
```

第四部分是处理 **buf 满的情况**。这个时候，如果是 **unbuffer 的 chan，就直接将 sender 的数据复制给 receiver**，否则就从队列头部读取一个值，并把这个 sender 的值加入到队列尾部。

```go

      // 第四部分，如果sendq队列中有等待发送的sender
        if sg := c.sendq.dequeue(); sg != nil {
      recv(c, sg, ep, func() { unlock(&c.lock) }, 3)
      return true, true
    }
```

第五部分是处理没有等待的 sender 的情况。这个是和 chansend 共用一把大锁，所以不会有并发的问题。如果 buf 有元素，就取出一个元素给 receiver。

```go

      // 第五部分, 没有等待的sender, buf中有数据
    if c.qcount > 0 {
      qp := chanbuf(c, c.recvx)
      if ep != nil {
        typedmemmove(c.elemtype, ep, qp)
      }
      typedmemclr(c.elemtype, qp)
      c.recvx++
      if c.recvx == c.dataqsiz {
        c.recvx = 0
      }
      c.qcount--
      unlock(&c.lock)
      return true, true
    }

    if !block {
      unlock(&c.lock)
      return false, false
    }

        // 第六部分， buf中没有元素，阻塞
        ......
```

第六部分是处理 buf 中没有元素的情况。如果没有元素，那么当前的 receiver 就会被阻塞，直到它从 sender 中接收了数据，或者是 chan 被 close，才返回。

### 2.3 close
通过 close 函数，可以把 chan 关闭，编译器会替换成 closechan 方法的调用。 close chan 的主要逻辑是:
1. 如果 chan 为 nil，close 会 panic；
2. 如果 chan 已经 closed，再次 close 也会 panic
3. 如果 chan 不为 nil，chan 也没有 closed，就把等待队列中的 sender（writer）和 receiver（reader）从队列中全部移除并唤醒。

```go

    func closechan(c *hchan) {
    if c == nil { // chan为nil, panic
      panic(plainError("close of nil channel"))
    }
  
    lock(&c.lock)
    if c.closed != 0 {// chan已经closed, panic
      unlock(&c.lock)
      panic(plainError("close of closed channel"))
    }

    c.closed = 1  

    var glist gList

    // 释放所有的reader
    for {
      sg := c.recvq.dequeue()
      ......
      gp := sg.g
      ......
      glist.push(gp)
    }
  
    // 释放所有的writer (它们会panic)
    for {
      sg := c.sendq.dequeue()
      ......
      gp := sg.g
      ......
      glist.push(gp)
    }
    unlock(&c.lock)
  
    for !glist.empty() {
      gp := glist.pop()
      gp.schedlink = 0
      goready(gp, 3)
    }
  }
```

## 3. Channel 采坑点
使用 Channel 最常见的错误是 panic 和 goroutine 泄漏。panic 的情况，总共有 3 种：
1. close 为 nil 的 chan；
2. send 已经 close 的 chan；
3. close 已经 close 的 chan。

goroutine 泄漏的问题也很常见，下面的代码也是一个实际项目中的例子：

```go

func process(timeout time.Duration) bool {
    ch := make(chan bool)

    go func() {
        // 模拟处理耗时的业务
        time.Sleep((timeout + time.Second))
        ch <- true // block
        fmt.Println("exit goroutine")
    }()
    select {
    case result := <-ch:
        return result
    case <-time.After(timeout):
        return false
    }
}
```

在上面的代码中如果发生超时，process 函数就返回了，这就会**导致 unbuffered 的 chan 从来就没有被读取**。unbuffered chan 必须等 reader 和 writer 都准备好了才能交流，否则就会阻塞。超时导致未读，结果就是子 goroutine 就阻塞在第 7 行永远结束不了，进而导致 goroutine 泄漏。解决这个 Bug 的办法很简单，就是将 unbuffered chan 改成容量为 1 的 chan。

## 4. 如何选择
Channel 并不是处理并发问题的“银弹”，有时候使用并发原语更简单，下面是一套如何选择的简化方法:
1. 共享资源的并发访问使用传统并发原语
2. 复杂的任务编排和消息传递使用 Channel；
3. 消息通知机制使用 Channel，除非只想 signal 一个 goroutine，才使用 Cond；
4. 简单等待所有任务的完成用 WaitGroup
5. 需要和 Select 语句结合，使用 Channel；
6. 需要和超时配合时，使用 Channel 和 Context。

## 参考
本文内容摘录自:
1. [极客专栏-鸟叔的 Go 并发编程实战](https://time.geekbang.org/column/intro/100061801?tab=catalog)