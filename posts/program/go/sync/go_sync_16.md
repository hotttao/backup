---
weight: 1
title: "go 信号量"
date: 2021-05-15T22:00:00+08:00
lastmod: 2021-05-15T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go 信号量"
featuredImage: 

tags: ["go 并发"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

## 1. 信号量概述
信号量（Semaphore）是用来控制多个 goroutine 同时访问多个资源的并发原语。最简单的信号量就是**一个变量加一些并发控制的能力**，更复杂的信号量类型，就是使用**抽象数据类型代替变量，用来代表复杂的资源类型**。实际上，大部分的信号量都使用一个整型变量来表示一组资源，并没有实现太复杂的抽象数据类型。

信号量这个并发原语在多资源共享的并发控制的场景中被广泛使用，有时候也会被 Channel 类型所取代，因为一个 buffered chan 也可以代表 n 个资源。

### 1.1 P/V 操作
信号量包含两个操作 P 和 V:
1. P 操作（descrease、wait、acquire）是减少信号量的计数值
2. V 操作（increase、signal、release）是增加信号量的计数值

初始化信号量 S 有一个指定数量（n）的资源，它就像是一个有 n 个资源的池子。P 操作相当于请求资源，如果资源可用，就立即返回；如果没有资源或者不够，那么，它可以不断尝试或者阻塞等待。V 操作会释放自己持有的资源，把资源返还给信号量。信号量的值除了初始化的操作以外，只能由 P/V 操作改变。

所以信号量的实现包括：
1. 初始化信号量：设定初始的资源的数量。
2. P 操作：将信号量的计数值减去 1，如果新值已经为负，那么调用者会被阻塞并加入到等待队列中，否则获取一个资源继续执行
3. V 操作：将信号量的计数值加 1，如果先前的计数值为负，就说明有等待的 P 操作的调用者。它会从等待队列中取出一个等待的调用者，唤醒它，让它继续执行。

### 1.2 信号量和互斥锁
信号量可以分为计数信号量（counting semaphre）和二进位信号量（binary semaphore）。在特殊的情况下，如果计数值只能是 0 或者 1，那么，这个信号量就是二进位信号量，提供了互斥的功能（要么是 0，要么是 1），所以，有时候互斥锁也会使用二进位信号量来实现。我们一般用信号量保护一组资源，如果信号量蜕变成二进位信号量，那么，它的 P/V 就和互斥锁的 Lock/Unlock 一样了。


### 1.3 Go 运行时实现
在运行时，Go 内部使用信号量来控制 goroutine 的阻塞和唤醒，在 Mutex 的实现上就使用了信号量

```go

type Mutex struct {
    state int32
    sema  uint32
}

// 信号量的 P/V 操作
func runtime_Semacquire(s *uint32)
func runtime_SemacquireMutex(s *uint32, lifo bool, skipframes int)
func runtime_Semrelease(s *uint32, handoff bool, skipframes int)
```

遗憾的是，它是 Go 运行时内部使用的，并没有封装暴露成一个对外的信号量并发原语，原则上我们没有办法使用。Go 在它的扩展包中提供了信号量semaphore，不过这个信号量的类型名并不叫 Semaphore，而是叫 [Weighted](https://godoc.org/golang.org/x/sync/semaphore)。

### 1.4 Weighted

```go
type Weighted
    func NewWeighted(n int64) *Weighted
    func (s *Weighted) Acquire(ctx context.Context, n int64) error
    func (s *Weighted) Release(n int64)
    func (s *Weighted) TryAcquire(n int64) bool
```

1. Acquire 方法：
    - 相当于 P 操作，你可以一次获取多个资源，如果没有足够多的资源，调用者就会被阻塞
    - 第一个参数是 Context，可以通过 Context 增加超时或者 cancel 的机制。如果是正常获取了资源，就返回 nil；否则，就返回 ctx.Err()，信号量不改变。
2. Release 方法：相当于 V 操作，可以将 n 个资源释放，返还给信号量。
3. TryAcquire 方法：尝试获取 n 个资源，但是它不会阻塞，要么成功获取 n 个资源，返回 true，要么一个也不获取，返回 false

下面是 Weighted 使用示例，我们创建和 CPU 核数一样多的 Worker，让它们去处理一个 4 倍数量的整数 slice。每个 Worker 一次只能处理一个整数，处理完之后，才能处理下一个。当然，这个问题的解决方案有很多种，这一次我们使用信号量，代码如下：

```go
import "golang.org/x/sync/semaphore"
var (
    maxWorkers = runtime.GOMAXPROCS(0)                    // worker数量
    sema       = semaphore.NewWeighted(int64(maxWorkers)) //信号量
    task       = make([]int, maxWorkers*4)                // 任务数，是worker的四倍
)

func main() {
    ctx := context.Background()

    for i := range task {
        // 如果没有worker可用，会阻塞在这里，直到某个worker被释放
        if err := sema.Acquire(ctx, 1); err != nil {
            break
        }

        // 启动worker goroutine
        go func(i int) {
            defer sema.Release(1)
            time.Sleep(100 * time.Millisecond) // 模拟一个耗时操作
            task[i] = i + 1
        }(i)
    }

    // 请求所有的worker,这样能确保前面的worker都执行完
    if err := sema.Acquire(ctx, int64(maxWorkers)); err != nil {
        log.Printf("获取所有的worker失败: %v", err)
    }

    fmt.Println(task)
}
```

在这个例子中，还有一个值得我们学习的知识点，就是最后的那一段处理（第 25 行）。如果在实际应用中，你想等所有的 Worker 都执行完，就可以获取最大计数值的信号量。


### 1.5 常见错误
在使用信号量时，最常见的几个错误如下：
1. 请求了资源，但是忘记释放它；
2. 释放了从未请求的资源；
3. 长时间持有一个资源，即使不需要它；
4. 不持有一个资源，却直接使用它。

不过，即使你规避了这些坑，在同时使用多种资源，不同的信号量控制不同的资源的时候，也可能会出现死锁现象，比如哲学家就餐问题。

就 Go 扩展库实现的信号量来说，在调用 Release 方法的时候，你可以传递任意的整数。但是，如果你传递一个比请求到的数量大的错误的数值，程序就会 panic。如果传递一个负数，会导致资源永久被持有。如果你请求的资源数比最大的资源数还大，那么，调用者可能永远被阻塞。

所以，使用信号量遵循的原则就是请求多少资源，就释放多少资源。

## 2. semaphore/Weighted 实现

Go 扩展库中的信号量是使用互斥锁 +List 实现的。互斥锁实现其它字段的保护，而 List 实现了一个等待队列，等待者的通知是通过 Channel 的通知机制实现的。

### 2.1 Weighted 数据结构
我们来看一下信号量 Weighted 的数据结构：

```go
type Weighted struct {
    size    int64         // 最大资源数
    cur     int64         // 当前已被使用的资源
    mu      sync.Mutex    // 互斥锁，对字段的保护
    waiters list.List     // 等待队列
}
```

### 2.2 Acquire 方法

在信号量的几个实现方法里，Acquire 是代码最复杂的一个方法，它不仅仅要监控资源是否可用，而且还要检测 Context 的 Done 是否已关闭。

```go

func (s *Weighted) Acquire(ctx context.Context, n int64) error {
    s.mu.Lock()
        // fast path, 如果有足够的资源，都不考虑ctx.Done的状态，将cur加上n就返回
    if s.size-s.cur >= n && s.waiters.Len() == 0 {
      s.cur += n
      s.mu.Unlock()
      return nil
    }
  
        // 如果是不可能完成的任务，请求的资源数大于能提供的最大的资源数
    if n > s.size {
      s.mu.Unlock()
            // 依赖ctx的状态返回，否则一直等待
      <-ctx.Done()
      return ctx.Err()
    }
  
        // 否则就需要把调用者加入到等待队列中
        // 创建了一个ready chan,以便被通知唤醒
    ready := make(chan struct{})
    w := waiter{n: n, ready: ready}
    elem := s.waiters.PushBack(w)
    s.mu.Unlock()
  

        // 等待
    select {
    case <-ctx.Done(): // context的Done被关闭
      err := ctx.Err()
      s.mu.Lock()
      select {
      case <-ready: // 如果被唤醒了，忽略ctx的状态
        err = nil
      default: 通知waiter
        isFront := s.waiters.Front() == elem
        s.waiters.Remove(elem)
        // 通知其它的waiters,检查是否有足够的资源
        if isFront && s.size > s.cur {
          s.notifyWaiters()
        }
      }
      s.mu.Unlock()
      return err
    case <-ready: // 被唤醒了
      return nil
    }
  }
```


### 2.3 Release
Release 方法将当前计数值减去释放的资源数 n，并唤醒等待队列中的调用者，看是否有足够的资源被获取。

```go

func (s *Weighted) Release(n int64) {
    s.mu.Lock()
    s.cur -= n
    if s.cur < 0 {
      s.mu.Unlock()
      panic("semaphore: released more than held")
    }
    s.notifyWaiters()
    s.mu.Unlock()
}
```

notifyWaiters 方法就是逐个检查等待的调用者，如果资源不够，或者是没有等待者了，就返回：

```go

func (s *Weighted) notifyWaiters() {
    for {
      next := s.waiters.Front()
      if next == nil {
        break // No more waiters blocked.
      }
  

      w := next.Value.(waiter)
      if s.size-s.cur < w.n {
        //避免饥饿，这里还是按照先入先出的方式处理
        break
      }

      s.cur += w.n
      s.waiters.Remove(next)
      close(w.ready)
    }
  }
```

notifyWaiters 方法是按照先入先出的方式唤醒调用者。这样做的目的是避免饥饿，否则的话，资源可能总是被那些请求资源数小的调用者获取，这样一来，请求资源数巨大的调用者，就没有机会获得资源了。

#### 2.4 总结

**官方扩展的信号量最大的优势是可以一次获取多个资源**。在批量获取资源的场景中，建议使用此官方扩展的信号量。

## 3. Channel 实现的信号量
除了官方扩展库的实现，还有很多方法实现信号量，比较典型的就是使用 Channel 来实现。使用一个 buffer 为 n 的 Channel 很容易实现信号量:

```go

// Semaphore 数据结构，并且还实现了Locker接口
type semaphore struct {
sync.Locker
ch chan struct{}
}

// 创建一个新的信号量
func NewSemaphore(capacity int) sync.Locker {
if capacity <= 0 {
    capacity = 1 // 容量为1就变成了一个互斥锁
}
return &semaphore{ch: make(chan struct{}, capacity)}
}

// 请求一个资源
func (s *semaphore) Lock() {
  s.ch <- struct{}{}
}

// 释放资源
func (s *semaphore) Unlock() {
  <-s.ch
}
```

官方的实现方式有这样一个功能：它可以一次请求多个资源，这是通过 Channel 实现的信号量所不具备的。

## 4. 其他实现
除了 Channel，[marusama/semaphore](https://github.com/marusama/semaphore)也实现了一个可以动态更改资源容量的信号量，也是一个非常有特色的实现。如果你的资源数量并不是固定的，而是动态变化的，可以考虑使用这个库。

## 5. 信号量

## 参考
本文内容摘录自:
1. [极客专栏-鸟叔的 Go 并发编程实战](https://time.geekbang.org/column/intro/100061801?tab=catalog)