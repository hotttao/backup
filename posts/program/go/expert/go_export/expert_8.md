---
weight: 1
title: "并发编程"
date: 2022-12-31T22:00:00+08:00
lastmod: 2022-12-31T22:00:00+08:00
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

今天我们开始深入学习，Go 语言的并发编程，将详细介绍Go基本执行单元——goroutine的调度原理、Go并发模型以及常见并发模式、Go支持并发的原生类型——channel的惯用使用模式等内容。
<!-- more -->

## 1. goroutine的调度原理
### 1.1 goroutine调度模型和演进历史
#### G-M模型
Go 1.0正式发布。在这个版本中，Go开发团队实现了一个简单的goroutine调度器。在这个调度器中:
1. 每个goroutine对应于运行时中的一个抽象结构——G（goroutine）
2. 被视作“物理CPU”的操作系统线程则被抽象为另一个结构——M（machine）

G-M模型存在严重不足：限制了Go并发程序的伸缩性。

#### G-P-M模型
Go 1.1版本中实现了 G-P-M调度模型和work stealing算法，这个模型一直沿用至今:

![G-P-M调度模型](/images/go/expert/g_m_p.png)

P是一个“逻辑处理器”，每个G要想真正运行起来，首先需要被分配一个P，即进入P的本地运行队列（local runq）中，这里暂忽略全局运行队列（global runq）那个环节。对于G来说，P就是运行它的“CPU”，可以说在G的眼里只有P。但从goroutine调度器的视角来看，真正的“CPU”是M，只有将P和M绑定才能让P的本地运行队列中的G真正运行起来。这样的P与M的关系就好比Linux操作系统调度层面用户线程（user thread）与内核线程（kernel thread）的对应关系：多对多（N:M）。

#### 抢占式调度
G-P-M模型的实现是goroutine调度器的一大进步，但调度器仍然有一个头疼的问题，那就是不支持抢占式调度，这导致一旦某个G中出现死循环的代码逻辑，那么G将永久占用分配给它的P和M，而位于同一个P中的其他G将得不到调度，出现“饿死”的情况。更为严重的是，当只有一个P（GOMAXPROCS=1）时，整个Go程序中的其他G都将“饿死”。于是Dmitry Vyukov又提出了“Go抢占式调度器设计”（Go Preemptive Scheduler Design），并在Go 1.2版本中实现了抢占式调度。

这个抢占式调度的原理是**在每个函数或方法的入口加上一段额外的代码**，让运行时有机会检查是否需要执行抢占调度。这种协作式抢占调度的解决方案只是局部解决了“饿死”问题，对于没有函数调用而是纯算法循环计算的G，goroutine调度器依然无法抢占。

#### 其他优化
Go运行时已经实现了**netpoller**，这使得即便G发起网络I/O操作也不会导致M被阻塞（仅阻塞G），因而不会导致大量线程（M）被创建出来。

但是对于常规文件的I/O操作一旦阻塞，那么线程（M）将进入挂起状态，等待I/O返回后被唤醒。这种情况下P将与挂起的M分离，再选择一个处于空闲状态（idle）的M。如果此时没有空闲的M，则会新创建一个M（线程），这就是大量文件I/O操作会导致大量线程被创建的原因。

Go开发团队的Ian Lance Taylor在Go 1.9版本中增加了一个**针对文件I/O的Poller**，它可以像netpoller那样，在G操作那些支持监听的（pollable）文件描述符时，仅阻塞G，而不会阻塞M。不过该功能依然对常规文件无效，常规文件是不支持监听的。但对于goroutine调度器而言，这也算是一个不小的进步了。

### 1.2 G-P-M模型
关于G、P、M的定义，可以参见$GOROOT/src/runtime/runtime2.go这个源文件:
1. G：代表goroutine，存储了goroutine的执行栈信息、goroutine状态及goroutine的任务函数等。另外G对象是可以重用的。
2. P：代表逻辑processor，P的数量决定了系统内最大可并行的G的数量（前提：系统的物理CPU核数>=P的数量）。P中最有用的是其拥有的各种G对象队列、链表、一些缓存和状态。
3. M：M代表着真正的执行计算资源。在绑定有效的P后，进入一个调度循环；而调度循环的机制大致是从各种队列、P的本地运行队列中获取G，切换到G的执行栈上并执行G的函数，调用goexit做清理工作并回到M。如此反复。M并不保留G状态，这是G可以跨M调度的基础。

### 1.3 抢占调度
与操作系统按时间片调度线程不同，Go中并没有时间片的概念。如果某个G没有进行系统调用（syscall）、没有进行I/O操作、没有阻塞在一个channel操作上，那么M是如何让G停下来并调度下一个可运行的G的呢？答案是：G是被抢占调度的。前面说过，除非极端的无限循环或死循环，否则只要G调用函数，Go运行时就有了抢占G的机会。

在Go程序启动时，运行时会启动一个名为sysmon的M（一般称为监控线程），该M的特殊之处在于它无须绑定P即可运行（以g0这个G的形式）。该M在整个Go程序的运行过程中至关重要，参见下面代码：

```go
//$GOROOT/src/runtime/proc.go

// The main goroutine.
func main() {
     ...
    systemstack(func() {
        newm(sysmon, nil)
    })
    ...
}

// 运行无须P参与
//
//go:nowritebarrierrec
func sysmon() {
    // 如果一个heap span在垃圾回收后5分钟内没有被使用
    // 就把它归还给操作系统
    scavengelimit := int64(5 * 60 * 1e9)
    ...

    if  ... {
        ...
        // 夺回被阻塞在系统调用中的P
        // 抢占长期运行的G
        if retake(now) != 0 {
            idle = 0
        } else {
            idle++
        }
       ...
    }
}
```

sysmon每20us~10ms启动一次，主要完成如下工作：
1. 释放闲置超过5分钟的span物理内存；
2. 如果超过2分钟没有垃圾回收，强制执行；
3. 将长时间未处理的netpoll结果添加到任务队列；
4. 向长时间运行的G任务发出抢占调度；
5. 收回因syscall长时间阻塞的P。

sysmon将向长时间运行的G任务发出抢占调度，这由函数retake实施：

```go
// $GOROOT/src/runtime/proc.go

// forcePreemptNS是在一个G被抢占之前给它的时间片
const forcePreemptNS = 10 * 1000 * 1000 // 10ms

func retake(now int64) uint32 {
    ...
    // 抢占运行时间过长的G
    t := int64(_p_.schedtick)
    if int64(pd.schedtick) != t {
        pd.schedtick = uint32(t)
        pd.schedwhen = now
        continue
    }
    if pd.schedwhen+forcePreemptNS > now {
        continue
    }
    preemptone(_p_)
    ...
}
```

可以看出，如果一个G任务运行超过10ms，sysmon就会认为其运行时间太久而发出抢占式调度的请求。一旦G的抢占标志位被设为true，那么在这个G下一次调用函数或方法时，运行时便可以将G抢占并移出运行状态，放入P的本地运行队列中（如果P的本地运行队列已满，那么将放在全局运行队列中），等待下一次被调度。

### 1.4 channel阻塞或网络I/O情况下的调度
如果G被阻塞在某个channel操作或网络I/O操作上，那么G会被放置到某个等待队列中，而M会尝试运行P的下一个可运行的G。如果此时P没有可运行的G供M运行，那么M将解绑P，并进入挂起状态。当I/O操作完成或channel操作完成，在等待队列中的G会被唤醒，标记为runnable（可运行），并被放入某个P的队列中，绑定一个M后继续执行。

### 1.5 系统调用阻塞情况下的调度
如果G被阻塞在某个系统调用上，那么不仅G会阻塞，执行该G的M也会解绑P（实质是被sysmon抢走了），与G一起进入阻塞状态。如果此时有空闲的M，则P会与其绑定并继续执行其他G；如果没有空闲的M，但仍然有其他G要执行，那么就会创建一个新M（线程）。

当系统调用返回后，阻塞在该系统调用上的G会尝试获取一个可用的P，如果有可用P，之前运行该G的M将绑定P继续运行G；如果没有可用的P，那么G与M之间的关联将解除，同时G会被标记为runnable，放入全局的运行队列中，等待调度器的再次调度。
