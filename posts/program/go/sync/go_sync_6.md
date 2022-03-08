---
weight: 4
title: "WaitGroup"
date: 2021-05-05T22:00:00+08:00
lastmod: 2021-05-05T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go WaitGroup 任务编排"
featuredImage: 

tags: ["go 并发"]
categories: ["Go"]

lightgallery: true

---

WaitGroup 任务编排
<!-- more -->

## 1. WaitGroup 使用
WaitGroup 很简单，就是 package sync 用来做任务编排的一个并发原语。它要解决的就是并发 - 等待的问题: goroutine A 等待一组 goroutine 全部完成。

很多操作系统和编程语言都提供了类似的并发原语。比如，Linux 中的 barrier、Pthread（POSIX 线程）中的 barrier、C++ 中的 std::barrier、Java 中的 CyclicBarrier 和 CountDownLatch 等。

WaitGroup 非常适用于此类场景: 需要启动多个 goroutine 执行任务，主 goroutine 需要等待子 goroutine 都完成后才继续执行。

### 1.1 WaitGroup 使用
Go 标准库中的 WaitGroup 提供了三个方法:
```go
func (wg *WaitGroup) Add(delta int)
func (wg *WaitGroup) Done()
func (wg *WaitGroup) Wait()
```

1. Add，用来设置 WaitGroup 的计数值；
2. Done，用来将 WaitGroup 的计数值减 1，其实就是调用了 Add(-1)；
3. Wait，调用这个方法的 goroutine 会一直阻塞，直到 WaitGroup 的计数值变为 0

下面是 WaitGroup 的使用示例:

```go

// 线程安全的计数器
type Counter struct {
    mu    sync.Mutex
    count uint64
}
// 对计数值加一
func (c *Counter) Incr() {
    c.mu.Lock()
    c.count++
    c.mu.Unlock()
}
// 获取当前的计数值
func (c *Counter) Count() uint64 {
    c.mu.Lock()
    defer c.mu.Unlock()
    return c.count
}
// sleep 1秒，然后计数值加1
func worker(c *Counter, wg *sync.WaitGroup) {
    defer wg.Done()
    time.Sleep(time.Second)
    c.Incr()
}

func main() {
    var counter Counter
    
    var wg sync.WaitGroup
    wg.Add(10) // WaitGroup的值设置为10

    for i := 0; i < 10; i++ { // 启动10个goroutine执行加1任务
        go worker(&counter, &wg)
    }
    // 检查点，等待goroutine都完成任务
    wg.Wait()
    // 输出当前计数器的值
    fmt.Println(counter.Count())
}
```

## 2. WaitGroup 实现

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
    // %8 表示 8 个字节，注意不是位
    // 32位还是64位计算机不是关键点，关键点是 state1 有没有按照 64 位对齐，32位计算机上 state1 也可能刚好对齐到 64 位上
    if uintptr(unsafe.Pointer(&wg.state1))%8 == 0 {
        // 如果地址是64bit对齐的，数组前两个元素做state，后一个元素做信号量
        return (*uint64)(unsafe.Pointer(&wg.state1)), &wg.state1[2]
    } else {
        // 如果地址是32bit对齐的，数组后两个元素用来做state，它可以用来做64bit的原子操作，第一个元素32bit用来做信号量
        return (*uint64)(unsafe.Pointer(&wg.state1[1])), &wg.state1[0]
    }
}
```

WaitGroup 的数据结构包括两个字段:
1. `noCopy noCopy`: 辅助字段，主要就是辅助 vet 工具检查是否通过 copy 赋值这个 WaitGroup 实例
2. `state1 [3]uint32`:
    - 一个具有复合意义的字段，包含 WaitGroup 的计数、阻塞在检查点的 waiter 数和信号量。
    - 因为64bit值的原子操作需要64bit对齐，但是32bit编译器不支持，所以数组中的元素在不同的架构中不一样，处理方法在 state() 方法中
    - 在 64 位环境下，state1 的第一个元素是 waiter 数，第二个元素是 WaitGroup 的计数值，第三个元素是信号量
    - 在 32 位环境下，如果 state1 不是 64 位对齐的地址，那么 state1 的第一个元素是信号量，后两个元素分别是 waiter 数和计数值

![WaitGroup State1字段含义](/images/go/sync/waitgroup_state1.jpg)

接下来我们来看 Add、Done 和 Wait 这三个方法的实现。在查看这部分源码实现时，除了这些方法本身的实现外，还会有一些额外的代码，主要是 race 检查和异常检查的代码。其中，有几个检查非常关键，如果检查不通过，会出现 panic。我们在介绍完这三个方法的实现之后再来统一介绍。

### 2.1 Add 方法实现
Add 方法主要操作的是 state 的计数部分，可以为计数值增加一个 delta 值，内部通过原子操作把这个值加到计数值上，delta 也可以是个负数，相当于为计数值减去一个值，Done 方法内部其实就是通过 Add(-1) 实现的。

```go

func (wg *WaitGroup) Add(delta int) {
    statep, semap := wg.state()
    // 高32bit是计数值v，所以把delta左移32，增加到计数上
    state := atomic.AddUint64(statep, uint64(delta)<<32)
    v := int32(state >> 32) // 当前计数值
    w := uint32(state) // waiter count

    if v > 0 || w == 0 {
        return
    }

    // 如果计数值v为0并且waiter的数量w不为0，那么state的值就是waiter的数量
    // 将waiter的数量设置为0，因为计数值v也是0,所以它们俩的组合*statep直接设置为0即可。此时需要并唤醒所有的waiter
    // Add(-n) 的处理逻辑
    *statep = 0
    for ; w != 0; w-- {
        runtime_Semrelease(semap, false, 0)
    }
}


// Done方法实际就是计数器减1
func (wg *WaitGroup) Done() {
    wg.Add(-1)
}
```

### 2.2 Wait 方法实现
Wait 方法的实现逻辑是：
1. 不断检查 state 的值。如果其中的计数值变为了 0，那么说明所有的任务已完成，调用者不必再等待，直接返回
2. 如果计数值大于 0，说明此时还有任务没完成，那么调用者就变成了等待者，需要加入 waiter 队列，并且阻塞住自己。

```go

func (wg *WaitGroup) Wait() {
    statep, semap := wg.state()
    
    for {
        state := atomic.LoadUint64(statep)
        v := int32(state >> 32) // 当前计数值
        w := uint32(state) // waiter的数量
        if v == 0 {
            // 如果计数值为0, 调用这个方法的goroutine不必再等待，继续执行它后面的逻辑即可
            return
        }
        // 否则把waiter数量加1。期间可能有并发调用Wait的情况，所以最外层使用了一个for循环
        if atomic.CompareAndSwapUint64(statep, state, state+1) {
            // 阻塞休眠等待
            runtime_Semacquire(semap)
            // 被唤醒，不再阻塞，返回
            return
        }
    }
}
```

### 2.3 异常检测
前面我们分析 Add 和 Wait 实现的时候删除了异常检测的代码，这些异常检测的逻辑就是我们使用 WaitGroup 的避坑指南。通常使用 WaitGroup 时会出现以下三个问题:
1. 计数器设置为负值: 
    - 检查点: WaitGroup 的计数器的值必须大于等于 0。我们在更改这个计数值的时候，WaitGroup 会先做检查，如果计数值被设置为负数，就会导致 panic。
    - 错误点: 一般情况下，有两种方法会导致计数器设置为负数
        - 调用 Add 的时候传递一个负数，导致计数器加上这个负值后小于 0 
        - 调用 Done 方法的次数过多，超过了 WaitGroup 的计数值
    - 建议: 使用 WaitGroup 的正确姿势是，预先确定好 WaitGroup 的计数值，然后调用相同次数的 Done 完成相应的任务
2. 不期望的 Add 时机: 在使用 WaitGroup 的时候，你一定要遵循的原则就是，等所有的 Add 方法调用之后再调用 Wait，否则就可能导致 panic 或者不期望的结果
3. 前一个 Wait 还没结束就重用 WaitGroup
    - WaitGroup 是可以重用的。只要 WaitGroup 的计数值恢复到零值的状态，那么它就可以被看作是新创建的 WaitGroup，被重复使用。
    - 但是，如果我们在 WaitGroup 的计数值还没有恢复到零值的时候就重用，就会导致程序 panic
    - 这个并发的 Data Race 在于: **Add() 方法在将计数器归零时，需要唤醒所有被 Wait 住的协程，在这个过程中间是不能有并发的 Add 和 Wait 方法调用的**

### 2.4 错误示例
在这个例子中，我们原本设想的是，等四个 goroutine 都执行完毕后输出 Done 的信息，但是它的错误之处在于，将 WaitGroup.Add 方法的调用放在了子 gorotuine 中。等主 goorutine 调用 Wait 的时候，因为四个任务 goroutine 一开始都休眠，所以可能 WaitGroup 的 Add 方法还没有被调用，WaitGroup 的计数还是 0，所以它并没有等待四个子 goroutine 执行完毕才继续执行，而是立刻执行了下一步。

```go
// 不期望的 Add 时机


func main() {
    var wg sync.WaitGroup
    // 解决方法一: 
    // wg.Add(4) // 预先设定WaitGroup的计数值

    go dosomething(100, &wg) // 启动第一个goroutine
    go dosomething(110, &wg) // 启动第二个goroutine
    go dosomething(120, &wg) // 启动第三个goroutine
    go dosomething(130, &wg) // 启动第四个goroutine

    wg.Wait() // 主goroutine等待完成
    fmt.Println("Done")
}

func dosomething(millisecs time.Duration, wg *sync.WaitGroup) {
    duration := millisecs * time.Millisecond
    time.Sleep(duration) // 故意sleep一段时间

    wg.Add(1)
    fmt.Println("后台执行, duration:", duration)
    wg.Done()
}

```

在下面的例子中，第 6 行虽然让 WaitGroup 的计数恢复到 0，但是因为第 9 行有个 waiter 在等待，如果等待 Wait 的 goroutine，刚被唤醒就和 Add 调用（第 7 行）有并发执行的冲突，所以就会出现 panic。

```go
// 前一个 Wait 还没结束就重用 WaitGroup
func main() {
    var wg sync.WaitGroup
    wg.Add(1)
    go func() {
        time.Sleep(time.Millisecond)
        wg.Done() // 计数器减1
        wg.Add(1) // 计数值加1
    }()
    wg.Wait() // 主goroutine等待，有可能和第7行并发执行
}
```

总结一下：WaitGroup 虽然可以重用，但是是有一个前提的，那就是必须等到上一轮的 Wait 完成之后，才能重用 WaitGroup 执行下一轮的 Add/Wait，如果你在 Wait 还没执行完的时候就调用下一轮 Add 方法，就有可能出现 panic。

### 2.4 WaitGroup 的 Race Check
WaitGroup 的异常检查，我看几遍，都没能彻底理解 WaitGroup 重用导致 panic 的根本原因。其实 WaitGroup 代码很少，直接看代码可能更容易帮助理解 panic 发生确切时机。

#### Add 的 Race Check

```go
// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sync

import (
	"internal/race"
	"sync/atomic"
	"unsafe"
)

func (wg *WaitGroup) Add(delta int) {
	statep, semap := wg.state()
	if race.Enabled {
		_ = *statep // trigger nil deref early
		if delta < 0 {
			// Synchronize decrements with Wait.
			race.ReleaseMerge(unsafe.Pointer(wg))
		}
		race.Disable()
		defer race.Enable()
	}
	state := atomic.AddUint64(statep, uint64(delta)<<32)
	v := int32(state >> 32)
	w := uint32(state)
	if race.Enabled && delta > 0 && v == int32(delta) {
		// The first increment must be synchronized with Wait.
		// Need to model this as a read, because there can be
		// several concurrent wg.counter transitions from 0.
		race.Read(unsafe.Pointer(semap))
	}
	if v < 0 {
		panic("sync: negative WaitGroup counter")
	}
	if w != 0 && delta > 0 && v == int32(delta) {
		panic("sync: WaitGroup misuse: Add called concurrently with Wait")
	}
	if v > 0 || w == 0 {
		return
	}
	// This goroutine has set counter to 0 when waiters > 0.
	// Now there can't be concurrent mutations of state:
	// - Adds must not happen concurrently with Wait,
	// - Wait does not increment waiters if it sees counter == 0.
	// Still do a cheap sanity check to detect WaitGroup misuse.
	if *statep != state {
		panic("sync: WaitGroup misuse: Add called concurrently with Wait")
	}
	// Reset waiters count to 0.
	*statep = 0
	for ; w != 0; w-- {
		runtime_Semrelease(semap, false, 0)
	}
}
```

从代码可以看到 Add 是触发 panic 有三个地方:
1. `v < 0`: 即计数器设置为负值
2. `w != 0 && delta > 0 && v == int32(delta)`:
    - waiter 数不为 0, 此时添加了 Add，并且 **state 字段记录的计数器等于此次 Add 的值**，说明上一次 Wait() 还没有结束就 Add 了新值。这是并发修改的场景一
3. `*statep != state`:
    - 执行到此处，经过前面的判断条件过滤，此处 **v 只能等于 0，此时需要做的只有唤醒所有 Wait 住的协程，不能有并发的 Add() 和 Wait() 方法调用**，这是并发修改的场景二。
    - 同时正如注释里面所说的这是一个"连接的检查"，如果并发是发生在 这个检查和下面触发 Wait 住的协程之间是不会异常的，但是程序已经出现了意料之外的结果。

#### Wait 的 Race Check
```go
// Done decrements the WaitGroup counter by one.
func (wg *WaitGroup) Done() {
	wg.Add(-1)
}

// Wait blocks until the WaitGroup counter is zero.
func (wg *WaitGroup) Wait() {
	statep, semap := wg.state()
	if race.Enabled {
		_ = *statep // trigger nil deref early
		race.Disable()
	}
	for {
		state := atomic.LoadUint64(statep)
		v := int32(state >> 32)
		w := uint32(state)
		if v == 0 {
			// Counter is 0, no need to wait.
			if race.Enabled {
				race.Enable()
				race.Acquire(unsafe.Pointer(wg))
			}
			return
		}
		// Increment waiters count.
		if atomic.CompareAndSwapUint64(statep, state, state+1) {
			if race.Enabled && w == 0 {
				// Wait must be synchronized with the first Add.
				// Need to model this is as a write to race with the read in Add.
				// As a consequence, can do the write only for the first waiter,
				// otherwise concurrent Waits will race with each other.
				race.Write(unsafe.Pointer(semap))
			}
			runtime_Semacquire(semap)
			if *statep != 0 {
				panic("sync: WaitGroup is reused before previous Wait has returned")
			}
			if race.Enabled {
				race.Enable()
				race.Acquire(unsafe.Pointer(wg))
			}
			return
		}
	}
}

```
从代码可以看到 Wait() 触发的异常只有一个地方: `*statep != 0`:
- 因为在 Add 唤醒阻塞的 Wait 协程前，已经将 `*statep = 0`，而如果此时 `*statep != 0` 说明在 Add() 触发被 Wait 住协程之后，有其他 Add() 和 Wait() 方法调用，是并发修改的场景。

### 2.5 noCopy 辅助 vet 检查
noCopy 就是指示 vet 工具在做检查的时候，这个数据结构不能做值复制使用。更严谨地说，是不能在第一次使用之后复制使用 ( must not be copied after first use)。noCopy 是一个通用的计数技术，其他并发原语中也会用到。

我们在前面学习 Mutex 的时候用到了 vet 工具。vet 会对实现 Locker 接口的数据类型做静态检查，一旦代码中有复制使用这种数据类型的情况，就会发出警告。WaitGroup 同步原语不就是 Add、Done 和 Wait 方法吗？vet 能检查出来吗？其实是可以的。通过给 WaitGroup 添加一个 noCopy 字段，我们就可以为 WaitGroup 实现 Locker 接口，这样 vet 工具就可以做复制检查了。而且因为 noCopy 字段是未输出类型，所以 WaitGroup 不会暴露 Lock/Unlock 方法。

noCopy 字段的类型是 noCopy，它只是一个辅助的、用来帮助 vet 检查用的类型:

```go
type noCopy struct{}

// Lock is a no-op used by -copylocks checker from `go vet`.
func (*noCopy) Lock()   {}
func (*noCopy) Unlock() {}

```
如果你想要自己定义的数据结构不被复制使用，或者说，不能通过 vet 工具检查出复制使用的报警，就可以通过嵌入 noCopy 这个数据类型来实现。


### 2.6 总结
关于如何避免错误使用 WaitGroup 的情况，我们只需要尽量保证下面 5 点就可以了：
1. 不重用 WaitGroup。新建一个 WaitGroup 不会带来多大的资源开销，重用反而更容易出错
2. 保证所有的 Add 方法调用都在 Wait 之前
3. 不传递负数给 Add 方法，只通过 Done 来给计数值减 1
4. 不做多余的 Done 方法调用，保证 Add 的计数值和 Done 方法调用的数量是一样的
5. 不遗漏 Done 方法的调用，否则会导致 Wait hang 住无法返回

## 参考
本文内容摘录自:
1. [极客专栏-鸟叔的 Go 并发编程实战](https://time.geekbang.org/column/intro/100061801?tab=catalog)