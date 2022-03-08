---
weight: 4
title: "Atomic 原子操作"
date: 2021-05-11T22:00:00+08:00
lastmod: 2021-05-11T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go 的原子操作"
featuredImage: 

tags: ["go 并发"]
categories: ["Go"]

lightgallery: true

---


## 1. Atomic 概述
### 1.1 原子操作
Package sync/atomic 实现了同步算法底层的**原子的内存操作**原语。之所以叫原子操作，是因为一个原子在执行的时候，其它线程不会看到执行一半的操作结果。在其它线程看来，原子操作要么执行完了，要么还没有执行，就像一个最小的粒子 - 原子一样，不可分割。

CPU 提供了基础的原子操作，不过，不同架构的系统的原子操作是不一样的:
1. 对于单处理器单核系统:
    - 如果一个操作是由一个 CPU 指令来实现的，那么它就是原子操作
    - 如果操作是基于多条指令来实现的，那么，执行的过程中可能会被中断，并执行上下文切换，这样的话，原子性的保证就会被打破
2. 在多处理器多核系统中:
    - 由于 cache 的存在，单个核上的单个指令进行原子操作的时候，要确保其它处理器或者核不访问此原子操作的地址，或者是确保其它处理器或者核总是访问原子操作之后的最新的值
    - 不同的 CPU 架构提供了不同的 CPU 指令来完成原子操作
    - 因为不同的 CPU 架构甚至不同的版本提供的原子操作的指令是不同的，所以，要用一种编程语言实现支持不同架构的原子操作是相当有难度的，Go 语言为我们做好了这一切

Go 提供了一个通用的原子操作的 API，将更底层的不同的架构下的实现封装成 atomic 包，提供了**修改类型的原子操作**（atomic **read-modify-write**，RMW）和**加载存储类型的原子操作**（**Load 和 Store**）的 API

### 1.2 原子操作应用场景
原子操作适用以下场景:
1. 首先 atomic 原子操作适用于"不涉及到对资源复杂的竞争逻辑"，比如
  - 并发地读写某个标志变量 - 对应 read-modify-write API
  - 配置对象的更新和加载 - 对应 Load and Store API
2. 基于 atomic 可以实现自定义的基本并发原语，原子操作是解决并发问题的根本
2. atomic 原子操作还是实现 lock-free 数据结构的基石，lock-freeze 数据结构的实现可以参考这篇文章[Lockless Programming Considerations for Xbox 360 and Microsoft Windows](https://docs.microsoft.com/zh-cn/windows/win32/dxtecharts/lockless-programming)

### 1.3 atomic 的使用
目前的 Go 的泛型的特性还没有发布，多个类型会实现很多类似的方法，尤其是 atomic 包。

atomic 为了支持 int32、int64、uint32、uint64、uintptr、Pointer（Add 方法不支持）类型，分别提供了 AddXXX、CompareAndSwapXXX、SwapXXX、LoadXXX、StoreXXX 等方法。

atomic 操作的对象是一个地址，你需要把**可寻址的变量的地址**作为参数传递给方法，而不是把变量的值传递给方法。下面我们就来看看 atomic 提供的方法。

#### Add

```go
func AddInt32(addr *int32, delta int32) (new int32)
func AddInt64(addr *int64, delta int64) (new int64)
func AddUint32(addr *uint32, delta uint32) (new uint32)
func AddUint64(addr *uint64, delta uint64) (new uint64)
func AddUintptr(addr *uintptr, delta uintptr) (new uintptr)
```

Add 方法:
1. Add 方法就是给第一个参数地址中的值增加一个 delta 值
2. 对于有符号的整数来说，delta 可以是一个负数，相当于减去一个值
3. 对于无符号的整数和 uinptr 类型来，减去一个值需要利用计算机补码规则，吧减法编程加法

```go
// 以 uint32/unit64 类型为例，实现减 c 操作
AddUint32(&x, ^uint32(c-1))
AddUint32(&x, ^uint32(c-1))
```

#### CSA(CompareAndSwap)
```go
func CompareAndSwapInt32(addr *int32, old, new int32) (swapped bool)
func CompareAndSwapInt64(addr *int64, old, new int64) (swapped bool)
func CompareAndSwapPointer(addr *unsafe.Pointer, old, new unsafe.Pointer) (swapped bool)
func CompareAndSwapUint32(addr *uint32, old, new uint32) (swapped bool)
func CompareAndSwapUint64(addr *uint64, old, new uint64) (swapped bool)
func CompareAndSwapUintptr(addr *uintptr, old, new uintptr) (swapped bool)
```
CSA 方法:
1. 这个方法会比较当前 addr 地址里的值是不是 old，如果不等于 old，就返回 false；如果等于 old，就把此地址的值替换成 new 值，返回 true

#### Swap
```go
func SwapInt32(addr *int32, new int32) (old int32)
func SwapInt64(addr *int64, new int64) (old int64)
func SwapPointer(addr *unsafe.Pointer, new unsafe.Pointer) (old unsafe.Pointer)
func SwapUint32(addr *uint32, new uint32) (old uint32)
func SwapUint64(addr *uint64, new uint64) (old uint64)
func SwapUintptr(addr *uintptr, new uintptr) (old uintptr)
```
Swap 方法:
1. 不需要比较旧值，直接将 addr 地址内的值替换为 new，并返回旧值

#### Load
```go
func LoadInt32(addr *int32) (val int32)
func LoadInt64(addr *int64) (val int64)
func LoadPointer(addr *unsafe.Pointer) (val unsafe.Pointer)
func LoadUint32(addr *uint32) (val uint32)
func LoadUint64(addr *uint64) (val uint64)
func LoadUintptr(addr *uintptr) (val uintptr)
```

Load 方法:
1. 取出 addr 地址中的值，即使在多处理器、多核、有 CPU cache 的情况下，这个操作也能保证 Load 是一个原子操作
2. LoadPointer 保证的是原子的读取 Pointer 指针的值，而不是保证原子的读取 Pointer 指向的对象

#### Store
```go
func StoreInt32(addr *int32, val int32)
func StoreInt64(addr *int64, val int64)
func StorePointer(addr *unsafe.Pointer, val unsafe.Pointer)
func StoreUint32(addr *uint32, val uint32)
func StoreUint64(addr *uint64, val uint64)
func StoreUintptr(addr *uintptr, val uintptr)
```

Store 方法:
1. 把一个值存入到指定的 addr 地址中，即使在多处理器、多核、有 CPU cache 的情况下，这个操作也能保证 Store 是一个原子操作。
2. 别的 goroutine 通过 Load 读取出来，不会看到存取了一半的值。

#### Value 类型
```go
type Value
    func (v *Value) Load() (x interface{})
    func (v *Value) Store(x interface{})
```

Value 类型:
1. 可以**原子地存取对象类型**，但也只能存取，不能 CAS 和 Swap，**常常用在配置变更等场景中**

接下来，我们以一个配置变更的例子，来演示 Value 类型的使用。

```go

type Config struct {
    NodeName string
    Addr     string
    Count    int32
}

func loadNewConfig() Config {
    return Config{
        NodeName: "北京",
        Addr:     "10.77.95.27",
        Count:    rand.Int31(),
    }
}
func main() {
    var config atomic.Value
    config.Store(loadNewConfig())
    var cond = sync.NewCond(&sync.Mutex{})

    // 设置新的config
    go func() {
        for {
            time.Sleep(time.Duration(5+rand.Int63n(5)) * time.Second)
            config.Store(loadNewConfig())
            cond.Broadcast() // 通知等待着配置已变更
        }
    }()

    go func() {
        for {
            cond.L.Lock()
            cond.Wait()                 // 等待变更信号
            c := config.Load().(Config) // 读取新的配置
            fmt.Printf("new config: %+v\n", c)
            cond.L.Unlock()
        }
    }()

    select {}
}
```

## 2. Atomic 的扩展
atomic 的 API 已经算是很简单的了，它提供了包一级的函数，可以对几种类型的数据执行原子操作。有些人就对这些函数做了进一步的包装，跟 atomic 中的 Value 类型类似，这些类型也提供了面向对象的使用方式，比如关注度比较高的[uber-go/atomic](https://github.com/uber-go/atomic)。

uber-go/atomic 定义和封装了几种与常见类型相对应的原子操作类型，这些类型提供了原子操作的方法。这些类型包括 Bool、Duration、Error、Float64、Int32、Int64、String、Uint32、Uint64 等。s

```go
var running atomic.Bool
running.Store(true)
running.Toggle()
fmt.Println(running.Load()) // false
```

atomic.Value 只有 Load/Store 方法，可以参考[这篇文章](https://github.com/golang/go/issues/39351)为其增加 Swap 和 CompareAndSwap 方法。

### 3. 使用 atomic 实现 Lock-Free queue
atomic 常常用来实现 Lock-Free 的数据结构，这里我们实现一个  Lock-Free queue。(sync.Pool 的实现中就包含了一个 lock-free queue 的实现 poolDequeue)

```go

package queue
import (
  "sync/atomic"
  "unsafe"
)
// lock-free的queue
type LKQueue struct {
  head unsafe.Pointer
  tail unsafe.Pointer
}
// 通过链表实现，这个数据结构代表链表中的节点
type node struct {
  value interface{}
  next  unsafe.Pointer
}
func NewLKQueue() *LKQueue {
  n := unsafe.Pointer(&node{})
  return &LKQueue{head: n, tail: n}
}
// 入队
func (q *LKQueue) Enqueue(v interface{}) {
  n := &node{value: v}
  for {
    tail := load(&q.tail)
    next := load(&tail.next)
    if tail == load(&q.tail) { // 尾还是尾
      if next == nil { // 还没有新数据入队
        if cas(&tail.next, next, n) { //增加到队尾
          cas(&q.tail, tail, n) //入队成功，移动尾巴指针
          return
        }
      } else { // 已有新数据加到队列后面，需要移动尾指针
        cas(&q.tail, tail, next)
      }
    }
  }
}
// 出队，没有元素则返回nil
func (q *LKQueue) Dequeue() interface{} {
  for {
    head := load(&q.head)
    tail := load(&q.tail)
    next := load(&head.next)
    if head == load(&q.head) { // head还是那个head
      if head == tail { // head和tail一样
        if next == nil { // 说明是空队列
          return nil
        }
        // 只是尾指针还没有调整，尝试调整它指向下一个
        cas(&q.tail, tail, next)
      } else {
        // 读取出队的数据
        v := next.value
                // 既然要出队了，头指针移动到下一个
        if cas(&q.head, head, next) {
          return v // Dequeue is done.  return
        }
      }
    }
  }
}

// 将unsafe.Pointer原子加载转换成node
func load(p *unsafe.Pointer) (n *node) {
  return (*node)(atomic.LoadPointer(p))
}

// 封装CAS,避免直接将*node转换成unsafe.Pointer
func cas(p *unsafe.Pointer, old, new *node) (ok bool) {
  return atomic.CompareAndSwapPointer(
    p, unsafe.Pointer(old), unsafe.Pointer(new))
}
```


## 4. 对一个地址的赋值是原子操作吗？
对一个地址的赋值是原子操作吗？这是一个很有趣的问题，如果是原子操作，还要 atomic 包干什么(Value 类型的 Store Load 方法)？如何理解 atomic 和直接内存操作的区别？(参见[Dave Cheney](https://dave.cheney.net/2018/01/06/if-aligned-memory-writes-are-atomic-why-do-we-need-the-sync-atomic-package))
1. 在现在的系统中，write 的地址基本上都是对齐的（aligned），对齐地址的写，不会导致其他人看到只写了一半的数据，因为它通过一个指令就可以实现对地址的操作
2. 如果地址不是对齐的话，那么，处理器就需要分成两个指令去处理，如果执行了一个指令，其它人就会看到更新了一半的错误的数据，这被称做撕裂写（torn write）
3. 所以，你可以认为赋值操作是一个原子操作，这个“原子操作”可以认为是保证数据的完整性。
4. 对于现代的多处理多核的系统来说，由于 cache、指令重排，可见性等问题，我们对原子操作的意义有了更多的追求。在多核系统中，一个核对地址的值的更改，在更新到主内存中之前，是在多级缓存中存放的。这时，多个核看到的数据可能是不一样的，其它的核可能还没有看到更新的数据，还在使用旧的数据。
5. 多处理器多核心系统为了处理这类问题，使用了一种叫做**内存屏障（memory fence 或 memory barrier）**的方式。一个写内存屏障会告诉处理器，必须要等到它管道中的未完成的操作（特别是写操作）都被刷新到内存中，再进行操作。此操作还会让相关的处理器的 CPU 缓存失效，以便让它们从主存中拉取最新的值。
6. atomic 包提供的方法会提供内存屏障的功能，所以，**atomic 不仅仅可以保证赋值的数据完整性，还能保证数据的可见性**，一旦一个核更新了该地址的值，其它处理器总是能读取到它的最新值。但是，需要注意的是，因为需要处理器之间保证数据的一致性，atomic 的操作也是会降低性能的。

## 参考
本文内容摘录自:
1. [极客专栏-鸟叔的 Go 并发编程实战](https://time.geekbang.org/column/intro/100061801?tab=catalog)