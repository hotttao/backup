---
title: 11 Context
date: 2019-02-11
categories:
    - Go
tags:
    - go并发编程
---
Context 上下文管理器
<!-- more -->

## 1. Context 概述
所谓上下文指的是在 API 之间或者方法调用之间，所传递的除了业务参数之外的额外信息，比如服务追踪。Go 标准库中的 Context 不仅仅传递上下文信息还提供了超时（Timeout）和取消（Cancel）的机制。

### 1.1 Context 来历
最初提供了 golang.org/x/net/context 库用来提供上下文信息，Go 在 1.7 的版本中才正式把 Context 加入到标准库中。

Go 1.7 发布之后，出现了标准库 Context 和 golang.org/x/net/context 并存的状况。新的代码使用标准库 Context 的时候，没有办法使用这个标准库的 Context 去调用旧有的使用 x/net/context 实现的方法。

所以，在 Go1.9 中，还专门实现了一个叫做 type alias 的新特性，然后把 x/net/context 中的 Context 定义成标准库 Context 的别名，以解决新旧 Context 类型冲突问题

```go

// +build go1.9
package context

import "context"

type Context = context.Context
type CancelFunc = context.CancelFunc

```

### 1.2 Context 的问题
Context 包含了太多了功能，导致它也出现了一些争议:
1. Go 布道师 Dave Cheney 还专门写了一篇文章讲述这个问题：[Context isn’t for cancellation](https://dave.cheney.net/2017/08/20/context-isnt-for-cancellation)
2. 有批评者专门写了一篇文章 [Context should go away for Go 2](https://faiface.github.io/post/context-should-go-away-go2/)
3. Go 核心开发者 Ian Lance Taylor 专门开了一个[issue 28342](https://github.com/golang/go/issues/28342)，用来记录当前的 Context 的问题：
    1. Context 包名导致使用的时候重复 ctx context.Context；
    2. Context.WithValue 可以接受任何类型的值，非类型安全；
    3. Context 包名容易误导人，实际上，Context 最主要的功能是取消 goroutine 的执行；
    4. Context 漫天飞，函数污染。

### 1.3 Context 适用场景
尽管有很多的争议，但是，在很多场景下，使用 Context 其实会很方便，比如下面这些场景:
1. 上下文信息传递 （request-scoped），比如处理 http 请求、在请求处理链路上传递信息；
2. 控制子 goroutine 的运行；
3. 超时控制的方法调用；
4. 可以取消的方法调用。

## 2. Context 使用
### 2.1 接口定义
包 context 定义了 Context 接口，Context 的具体实现包括 4 个方法，分别是 Deadline、Done、Err 和 Value，如下所示：

```go
type Context interface {
    Deadline() (deadline time.Time, ok bool)
    Done() <-chan struct{}
    Err() error
    Value(key interface{}) interface{}
}
```

1. Deadline 方法
    - 返回这个 Context 被取消的截止日期。如果没有设置截止日期，ok 的值是 false
    - 后续每次调用这个对象的 Deadline 方法时，都会返回和第一次调用相同的结果
2. Done 方法
    - 返回一个 Channel 对象
    - 在 Context 被取消时，此 Channel 会被 close，如果没被取消，可能会返回 nil
    - 后续的 Done 调用总是返回相同的结果。当 Done 被 close 的时候，你可以通过 ctx.Err 获取错误信息。
    - 即: 如果 Done 没有被 close，Err 方法返回 nil；如果 Done 被 close，Err 方法会返回 Done 被 close 的原因。
3. Value 返回此 ctx 中和指定的 key 相关联的 value

### 2.2 生成函数
Context 中实现了 2 个常用的生成顶层 Context 的方法。
1. context.Background()：
    - 返回一个非 nil 的、空的 Context，没有任何值，不会被 cancel，不会超时，没有截止日期
    - 一般用在主函数、初始化、测试以及创建根 Context 的时候
2. context.TODO()：
    - 返回一个非 nil 的、空的 Context，没有任何值，不会被 cancel，不会超时，没有截止日期
    - 当你不清楚是否该用 Context，或者目前还不知道要传递一些什么上下文信息的时候，就可以使用这个方法

其实，你根本不用费脑子去考虑，可以直接使用 context.Background。事实上，它们两个底层的实现是一模一样的：

```go

var (
    background = new(emptyCtx)
    todo       = new(emptyCtx)
)

func Background() Context {
    return background
}

func TODO() Context {
    return todo
}
```
### 2.3 使用约定
在使用 Context 的时候，有一些约定俗成的规则:
1. 一般函数使用 Context 的时候，会把这个参数放在第一个参数的位置。
2. 从来不把 nil 当做 Context 类型的参数值，可以使用 context.Background() 创建一个空的上下文对象，也不要使用 nil。
3. Context 只用来临时做函数之间的上下文透传，不能持久化 Context 或者把 Context 长久保存。把 Context 持久化到数据库、本地文件或者全局变量、缓存中都是错误的用法。
4. key 的类型不应该是字符串类型或者其它内建类型，否则容易在包之间使用 Context 时候产生冲突。使用 WithValue 时，key 的类型应该是自己定义的类型。
5. 常常使用 struct{}作为底层类型定义 key 的类型。对于 exported key 的静态类型，常常是接口或者指针。这样可以尽量减少内存分配。
6. 如果你能保证别人使用你的 Context 时不会和你定义的 key 冲突，那么 key 的类型就比较随意，因为你自己保证了不同包的 key 不会冲突，否则建议你尽量采用保守的 unexported 的类型。

Context 包中有几种创建特殊用途 Context 的方法：WithValue、WithCancel、WithTimeout 和 WithDeadline，包括它们的功能以及实现方式。

### 2.4 WithValue
WithValue 基于 parent Context 生成一个新的 Context，保存了一个 key-value 键值对。它常常用来传递上下文。WithValue 方法其实是创建了一个类型为 valueCtx 的 Context，它的类型定义如下：

```go
type valueCtx struct {
    Context
    key, val interface{}
}
```

它覆盖了 Value 方法，优先从自己的存储中检查这个 key，不存在的话会从 parent 中继续检查。Go 标准库实现的 Context 还实现了链式查找。如果不存在，还会向 parent Context 去查找，如果 parent 还是 valueCtx 的话，还是遵循相同的原则：valueCtx 会嵌入 parent，所以还是会查找 parent 的 Value 方法的。

```go

ctx = context.TODO()
ctx = context.WithValue(ctx, "key1", "0001")
ctx = context.WithValue(ctx, "key2", "0001")
ctx = context.WithValue(ctx, "key3", "0001")
ctx = context.WithValue(ctx, "key4", "0004")

fmt.Println(ctx.Value("key1"))
```

![WithValue](/images/go/sync/value_ctx.jpg)

### 2.5 WithCancel
WithCancel 方法返回 parent 的副本，只是副本中的 Done Channel 是新建的对象，它的类型是 cancelCtx。返回值中的第二个值是一个 cancel 函数。

我们常常在一些需要主动取消长时间的任务时，创建这种类型的 Context，然后把这个 Context 传给长时间执行任务的 goroutine。当需要中止任务时，我们就可以 cancel 这个 Context，长时间执行任务的 goroutine，就可以通过检查这个 Context，知道 Context 已经被取消了。

记住，不是只有你想中途放弃，才去调用 cancel，只要你的任务正常完成了，就需要调用 cancel，这样，这个 Context 才能释放它的资源（通知它的 children 处理 cancel，从它的 parent 中把自己移除，甚至释放相关的 goroutine）。很多同学在使用这个方法的时候，都会忘记调用 cancel，切记切记，而且一定尽早释放。

```go

func WithCancel(parent Context) (ctx Context, cancel CancelFunc) {
    c := newCancelCtx(parent)
    propagateCancel(parent, &c)// 把c朝上传播
    return &c, func() { c.cancel(true, Canceled) }
}

// newCancelCtx returns an initialized cancelCtx.
func newCancelCtx(parent Context) cancelCtx {
    return cancelCtx{Context: parent}
}
```

propagateCancel 方法会顺着 parent 路径往上找，直到找到一个 cancelCtx，或者为 nil。如果不为空，就把自己加入到这个 cancelCtx 的 child，以便这个 cancelCtx 被取消的时候通知自己。如果为空，会新起一个 goroutine，由它来监听 parent 的 Done 是否已关闭。


当这个 cancelCtx 的 cancel 函数被调用的时候，或者 parent 的 Done 被 close 的时候，这个 cancelCtx 的 Done 才会被 close。

cancel 是向下传递的，如果一个 WithCancel 生成的 Context 被 cancel 时，如果它的子 Context（也有可能是孙，或者更低，依赖子的类型）也是 cancelCtx 类型的，就会被 cancel，但是不会向上传递。parent Context 不会因为子 Context 被 cancel 而 cancel。cancelCtx 被取消时，它的 Err 字段就是下面这个 Canceled 错误：

```go

var Canceled = errors.New("context canceled")
```

### 2.6 WithTimeout/WithDeadline
WithTimeout 其实是和 WithDeadline 一样，只不过一个参数是超时时间，一个参数是截止时间。

```go
func WithTimeout(parent Context, timeout time.Duration) (Context, CancelFunc) {
    // 当前时间+timeout就是deadline
    return WithDeadline(parent, time.Now().Add(timeout))
}
```

WithDeadline 会返回一个 parent 的副本，并且设置了一个不晚于参数 d 的截止时间，类型为 timerCtx（或者是 cancelCtx）。

如果它的截止时间晚于 parent 的截止时间，那么就以 parent 的截止时间为准，并返回一个类型为 cancelCtx 的 Context，因为 parent 的截止时间到了，就会取消这个 cancelCtx。

如果当前时间已经超过了截止时间，就直接返回一个已经被 cancel 的 timerCtx。否则就会启动一个定时器，到截止时间取消这个 timerCtx。

综合起来，timerCtx 的 Done 被 Close 掉，主要是由下面的某个事件触发的：
1. 截止时间到了；
2. cancel 函数被调用；
3. parent 的 Done 被 close。

```go

func WithDeadline(parent Context, d time.Time) (Context, CancelFunc) {
    // 如果parent的截止时间更早，直接返回一个cancelCtx即可
    if cur, ok := parent.Deadline(); ok && cur.Before(d) {
        return WithCancel(parent)
    }
    c := &timerCtx{
        cancelCtx: newCancelCtx(parent),
        deadline:  d,
    }
    propagateCancel(parent, c) // 同cancelCtx的处理逻辑
    dur := time.Until(d)
    if dur <= 0 { //当前时间已经超过了截止时间，直接cancel
        c.cancel(true, DeadlineExceeded)
        return c, func() { c.cancel(false, Canceled) }
    }
    c.mu.Lock()
    defer c.mu.Unlock()
    if c.err == nil {
        // 设置一个定时器，到截止时间后取消
        c.timer = time.AfterFunc(dur, func() {
            c.cancel(true, DeadlineExceeded)
        })
    }
    return c, func() { c.cancel(true, Canceled) }
}
```
和 cancelCtx 一样，WithDeadline（WithTimeout）返回的 cancel 一定要调用，并且要尽可能早地被调用，这样才能尽早释放资源。，不要单纯地依赖截止时间被动取消。

```go

func slowOperationWithTimeout(ctx context.Context) (Result, error) {
  ctx, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
  defer cancel() // 一旦慢操作完成就立马调用cancel
  return slowOperation(ctx)
}
```

如果你要为 Context 实现一个带超时功能的调用，比如访问远程的一个微服务，超时并不意味着你会通知远程微服务已经取消了这次调用，大概率的实现只是避免客户端的长时间等待，远程的服务器依然还执行着你的请求。

所以，有时候，Context 并不会减少对服务器的请求负担。如果在 Context 被 cancel 的时候，你能关闭和服务器的连接，中断和数据库服务器的通讯、停止对本地文件的读写，那么，这样的超时处理，同时能减少对服务调用的压力，但是这依赖于你对超时的底层处理机制。

## 3. Context 采坑点


## 4. Context 的扩展

## 参考
本文内容摘录自:
1. [极客专栏-鸟叔的 Go 并发编程实战](https://time.geekbang.org/column/intro/100061801?tab=catalog)