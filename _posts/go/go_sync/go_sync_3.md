---
title: 3 Mutex 锁
date: 2019-02-03
categories:
    - Go
tags:
    - go并发编程
---

Go 第一个并发原语 Mutex 互斥锁
<!-- more -->

## 1. Mutex 的使用
互斥锁是最基本的并发原语，基本上所有编程语言都会提供，Go 中互斥锁为 Mutex，Mutex 位于标准库 sync 中，其实现了 sync 中的 Locker 接口:

```go
type Locker interface{
    Lock()
    Unlock()
}
```

简单来说，互斥锁 Mutex 就提供了这两个方法 Lock 和 Unlock：进入临界区之前调用 Lock 方法，退出临界区的时候调用 Unlock 方法。很多时候 Mutex 会嵌入到其他 struct 中，比如:

```go
type Counter struct{
    Mutex
    Count uint64
}

var c Counter
c.Lock()
c.Unlock()

// 将锁封装不暴露锁
type Counter struct {
	CounterType int
	Name        string
	mu          sync.Mutex
	count       uint64
}

func (c *Counter) Incr() {
	c.mu.Lock()
	c.count++
	c.mu.Unlock()
}
```

如果嵌入的 struct 有多个字段，我们一般会把 Mutex 放在要控制的字段上面，然后使用空格把字段分隔开来。以便于代码更容易理解和维护。甚至，你还可以把获取锁、释放锁、计数加一的逻辑封装成一个方法，对外不需要暴露锁等。