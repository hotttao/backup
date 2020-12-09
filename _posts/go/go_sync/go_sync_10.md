---
title: 10 Pool
date: 2019-02-10
categories:
    - Go
tags:
    - go并发编程
---
Pool
<!-- more -->

## 1. Pool 概述
Go 是一个自动垃圾回收的编程语言，采用[三色并发标记算法](https://blog.golang.org/ismmkeynote)标记对象并回收。但是，如果你想使用 Go 开发一个高性能的应用程序的话，就必须考虑垃圾回收给性能带来的影响。对象池化， 可以有效地减少新对象的创建次数，是性能优化的重要方式。

Go 标准库中提供了一个通用的 Pool 数据结构，也就是 sync.Pool，我们使用它可以创建池化的对象。sync.Pool 有一个缺陷，就是它池化的对象可能会被垃圾回收掉，这对于数据库长连接等场景是不合适的。因此接下来我们将介绍:
1. sync.Pool 的使用、实现和采坑点
2. 其他 Pool 包括 TCP 连接池、数据库连接池
3. Worker Pool: goroutine pool，使用有限的 goroutine 资源去处理大量的业务数据

### 1.1 sync.Pool 使用
sync.Pool 用来保存一组可独立访问的**临时**对象，临时两个字表明"它池化的对象会在未来的某个时候被毫无预兆地移除掉"。如果没有别的对象引用这个被移除的对象的话，这个被移除的对象就会被垃圾回收掉。

sync.Pool 有两个知识点需要记住:
1. sync.Pool 本身就是线程安全的，多个 goroutine 可以并发地调用它的方法存取对象；
2. sync.Pool 使用之后不可再复制使用

sync.Pool 只提供了三个对外方法:
1. New 字段: 
    - 类型为`func() interface{}`
    - 当 Get 方法从池中获取元素，没有更多空闲元素可返回时，就会调用 New 方法来创建新的元素。
    - 如果你没有设置 New 字段，没有更多的空闲元素可返回时，Get 方法将返回 nil，表明当前没有可用的元素
	- New 是可变的字段，这意味着可以在程序运行的时候改变创建元素的方法，但是没必要这么做
2.  Get 方法:
	- 调用这个方法，就会从 Pool取走一个元素(从 Pool 中移除)，并返回给调用者
	- 除了正常实例化的元素，Get 方法的返回值还可能会是一个 nil（Pool.New 字段没有设置，又没有空闲元素可以返回），使用时需要判断
3. Put 方法:
	- 用于将一个元素返还给 Pool，Pool 会把这个元素保存到池中，并且可以复用
	- 如果 Put 一个 nil 值，Pool 就会忽略这个值


```go
type Pool struct {
	noCopy noCopy

	local     unsafe.Pointer // local fixed-size per-P pool, actual type is [P]poolLocal
	localSize uintptr        // size of the local array

	victim     unsafe.Pointer // local from previous cycle
	victimSize uintptr        // size of victims array

	// New optionally specifies a function to generate
	// a value when Get would otherwise return nil.
	// It may not be changed concurrently with calls to Get.
	New func() interface{}
}

func (p *Pool) Put(x interface{}) {}
func (p *Pool) Get() interface{} {}
```

下面是 sync.Pool 实现的 buffer 池(缓冲池)。注意下面这段代码是有问题的，你一定不要将这段代码应用到实际的产品中，它可能会有内存泄漏的问题。

```go
import bytes

var buffers = sync.Pool{
	New: func() interface{} {
		return new(bytes.Buffer)
	}
}

func GetBuffer() *bytes.Buffer {
	return buffers.Get().(*bytes.Buffer)
}

func PutBuffer(* bytes.Buffer){
	buf.Reset()
	buffer.Put(buf)
}
```

## 2. Pool 实现
Go 1.13 之前的 sync.Pool 的实现有 2 大问题：
1. 每次 GC 都会回收创建的对象: 如果缓存元素数量太多，就会导致 STW 耗时变长；缓存元素都被回收后，会导致 Get 命中率下降，Get 方法不得不新创建很多对象。
2. 底层实现使用了 Mutex，对这个锁并发请求竞争激烈的时候，会导致性能的下降

在 Go 1.13 中，sync.Pool 做了大量的优化。优化的方式就是避免使用锁，同时将加锁的 queue 改成 lock-free 的 queue 的实现，给即将移除的元素再多一次“复活”的机会。sync.Pool 的数据结构如下图所示：

![Pool](/images/go/sync/Pool.jpg)

Pool 实现中:
1. 每次垃圾回收的时候，Pool 会把 victim 中的对象移除，然后把 local 的数据给 victim
2. victim 就像一个垃圾分拣站，里面的东西可能会被当做垃圾丢弃了，但是里面有用的东西也可能被捡回来重新使用
3. victim 中的元素如果被 Get 取走，他就会被重用；没有被 Get 取走，那么就会被移除掉，因为没有别人引用它的话，就会被垃圾回收掉

### 2.1 Pool 的垃圾回收
下面的代码是垃圾回收时 sync.Pool 的处理逻辑：

```go

func poolCleanup() {
    // 丢弃当前victim, STW所以不用加锁
    for _, p := range oldPools {
        p.victim = nil
        p.victimSize = 0
    }

    // 将local复制给victim, 并将原local置为nil
    for _, p := range allPools {
        p.victim = p.local
        p.victimSize = p.localSize
        p.local = nil
        p.localSize = 0
    }

    oldPools, allPools = allPools, nil
}
```

### 2.2 local
local 字段包含一个 poolLocalInternal 字段，并提供 CPU 缓存对齐，从而避免 false sharing。而 poolLocalInternal 也包含两个字段：private 和 shared。
1. private，代表一个缓存的元素，而且只能由相应的一个 P 存取。因为一个 P 同时只能执行一个 goroutine，所以不会有并发的问题。
2. shared，可以由任意的 P 访问，但是只有本地的 P 才能 pushHead/popHead，其它 P 可以 popTail，相当于只有一个本地的 P 作为生产者（Producer），多个 P 作为消费者（Consumer），它是使用一个 local-free 的 queue 列表实现的。

### 2.3 Get 方法
```go

func (p *Pool) Get() interface{} {
    // 把当前goroutine固定在当前的P上
    l, pid := p.pin()
    x := l.private // 1. 优先从local的private字段取，快速
    l.private = nil
    if x == nil {
        // 2. 从当前的local.shared弹出一个，注意是从head读取并移除
        x, _ = l.shared.popHead()
        if x == nil { // 3. 如果没有，则去偷一个
            x = p.getSlow(pid) 
        }
    }
    runtime_procUnpin()
    // 如果没有获取到，尝试使用New函数生成一个新的
    if x == nil && p.New != nil {
        x = p.New()
    }
    return x
}
```

这里的重点是 getSlow 方法，它首先要遍历所有的 local，尝试从它们的 shared 弹出一个元素。如果还没找到一个，那么，就开始对 victim 下手了。在 vintim 中查询可用元素的逻辑还是一样的，先从对应的 victim 的 private 查找，如果查不到，就再从其它 victim 的 shared 中查找。

```go

func (p *Pool) getSlow(pid int) interface{} {

    size := atomic.LoadUintptr(&p.localSize)
    locals := p.local                       
    // 从其它proc中尝试偷取一个元素
    for i := 0; i < int(size); i++ {
        l := indexLocal(locals, (pid+i+1)%int(size))
        if x, _ := l.shared.popTail(); x != nil {
            return x
        }
    }

    // 如果其它proc也没有可用元素，那么尝试从vintim中获取
    size = atomic.LoadUintptr(&p.victimSize)
    if uintptr(pid) >= size {
        return nil
    }
    locals = p.victim
    l := indexLocal(locals, pid)
    if x := l.private; x != nil { // 同样的逻辑，先从vintim中的local private获取
        l.private = nil
        return x
    }
    for i := 0; i < int(size); i++ { // 从vintim其它proc尝试偷取
        l := indexLocal(locals, (pid+i)%int(size))
        if x, _ := l.shared.popTail(); x != nil {
            return x
        }
    }

    // 如果victim中都没有，则把这个victim标记为空，以后的查找可以快速跳过了
    atomic.StoreUintptr(&p.victimSize, 0)

    return nil
}
```

这里没列出 pin 代码的实现，你只需要知道，pin 方法会将此 goroutine 固定在当前的 P 上，避免查找元素期间被其它的 P 执行。固定的好处就是查找元素期间直接得到跟这个 P 相关的 local。有一点需要注意的是，pin 方法在执行的时候，如果跟这个 P 相关的 local 还没有创建，或者运行时 P 的数量被修改了的话，就会新创建 local。

### 2.4 Put 方法

```go

func (p *Pool) Put(x interface{}) {
    if x == nil { // nil值直接丢弃
        return
    }
    l, _ := p.pin()
    if l.private == nil { // 如果本地private没有值，直接设置这个值即可
        l.private = x
        x = nil
    }
    if x != nil { // 否则加入到本地队列中
        l.shared.pushHead(x)
    }
    runtime_procUnpin()
}
```

Put 的逻辑相对简单，优先设置本地 private，如果 private 字段已经有值了，那么就把此元素 push 到本地队列中。

## 3. Pool 采坑点
使用 Once 有两个常见错误:分别是内存泄漏和内存浪费。

#### 3.1 内存泄漏
文章开始，我们用 sync.Pool 实现了一个 buffer pool，这个实现可能存在内存泄漏。取出来的 bytes.Buffer 在使用的时候，我们可以往这个元素中增加大量的 byte 数据，这会导致底层的 byte slice 的容量可能会变得很大。这个时候，即使 Reset 再放回到池子中，这些 byte slice 的容量不会改变，所占的空间依然很大。而且，因为 Pool 回收的机制，这些大的 Buffer 可能不被回收(被重复使用，但只使用了很小一部分)，而是会一直占用很大的空间，这属于内存泄漏的问题。

在使用 sync.Pool 回收 buffer 的时候，一定要检查回收的对象的大小。如果 buffer 太大，就不要回收了，否则就太浪费了。

### 3.2 内存浪费
除了内存泄漏以外，还有一种浪费的情况，就是池子中的 buffer 都比较大，但在实际使用的时候，很多时候只需要一个小的 buffer，这也是一种浪费现象。

要做到物尽其用，尽可能不浪费的话，我们可以将 buffer 池分成几层，比如分成 512byte，1k，2k，4k 的多层 buffer 池。获取 buffer 时根据需要，到所需大小的池子中获取 buffer 即可。在标准库 net/http/server.go中的代码中，就提供了 2K 和 4K 两个 writer 的池子。

YouTube 开源的知名项目 vitess 中提供了[bucketpool](https://github.com/vitessio/vitess/blob/master/go/bucketpool/bucketpool.go)的实现，它提供了更加通用的多层 buffer 池。你在使用的时候，只需要指定池子的最大和最小尺寸，vitess 就会自动计算出合适的池子数。而且，当你调用 Get 方法的时候，只需要传入你要获取的 buffer 的大小，就可以了。

## 4. 第三方库
