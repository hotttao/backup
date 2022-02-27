---
weight: 1
title: "go SingleFlight 请求合并"
date: 2021-05-16T22:00:00+08:00
lastmod: 2021-05-16T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go SingleFlight 请求合并"
featuredImage: 

tags: ["go 并发"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---


## 1. SingleFlight 栅栏概述
SingleFlight 的作用是将并发请求合并成一个请求，以减少对下层服务的压力。当多个 goroutine 同时调用同一个函数的时候，只让一个 goroutine 去调用这个函数，等到这个 goroutine 返回结果的时候，再把结果返回给这几个同时调用的 goroutine，这样可以减少并发调用的数量。

如果你学会了 SingleFlight，**在面对秒杀等大并发请求的场景，而且这些请求都是读请求时，你就可以把这些请求合并为一个请求，这样，你就可以将后端服务的压力从 n 降到 1**。**尤其是在面对后端是数据库这样的服务的时候，采用 SingleFlight 可以极大地提高性能。**

Go 标准库的代码中就有一个 [SingleFlight](https://github.com/golang/go/blob/50bd1c4d4eb4fac8ddeb5f063c099daccfb71b26/src/internal/singleflight/singleflight.go) 的实现，而扩展库中的 SingleFlight(golang.org/x/sync/singleflight) 就是在标准库的代码基础上改的，逻辑几乎一模一样。

### 1.1 SingleFlight 与 Sync.Once

标准库中的 sync.Once 也可以保证并发的 goroutine 只会执行一次函数 f，那么，SingleFlight 和 sync.Once 有什么区别呢？
1. sync.Once 不是只在并发的时候保证只有一个 goroutine 执行函数 f，而是会保证永远只执行一次
2. SingleFlight 是每次调用都重新执行，并且在多个请求同时调用的时候只有一个执行。
3. 它们两个面对的场景是不同的，sync.Once 主要是用在单次初始化场景中，而 SingleFlight 主要用在合并并发请求的场景中，尤其是缓存场景。

## 2. 实现原理
SingleFlight 使用互斥锁 Mutex 和 Map 来实现。Mutex 提供并发时的读写保护，Map 用来保存同一个 key 的正在处理（in flight）的请求。SingleFlight 的数据结构是 Group，它提供了三个方法：

```go
import "golang.org/x/sync/singleflight"
type Group
    func (g *Group) Do(key string, fn func() (interface{}, error)) (v interface{}, err error, shared bool)
    func (g *Group) DoChan(key string, fn func() (interface{}, error)) <-chan Result
    func (g *Group) Forget(key string)
```

1. Do：
    - 这个方法执行一个函数，并返回函数执行的结果
    - 需要提供一个 key，对于同一个 key，在同一时间只有一个在执行，同一个 key 并发的请求会等待。第一个执行的请求返回的结果，就是它的返回结果
    - 函数 fn 是一个无参的函数，返回一个结果或者 error，而 Do 方法会返回函数执行的结果或者是 error
    - shared 会指示 v 是否返回给多个请求。
2. DoChan：
    - 类似 Do 方法，只不过是返回一个 chan，等 fn 函数执行完，产生了结果以后，就能从这个 chan 中接收这个结果
3. Forget：
    - 告诉 Group 忘记这个 key
    - 这样一来，之后这个 key 请求会执行 f，而不是等待前一个未完成的 fn 函数的结果


### 2.1 辅助 call 对象
SingleFlight 定义一个辅助对象 call，这个 call 就代表正在执行 fn 函数的请求或者是已经执行完的请求。Group 代表 SingleFlight。

```go

// 代表一个正在处理的请求，或者已经处理完的请求
type call struct {
    wg sync.WaitGroup


    // 这个字段代表处理完的值，在waitgroup完成之前只会写一次
        // waitgroup完成之后就读取这个值
    val interface{}
    err error

        // 指示当call在处理时是否要忘掉这个key
    forgotten bool
    dups  int
    chans []chan<- Result
}

// group代表一个singleflight对象
type Group struct {
  mu sync.Mutex       // protects m
  m  map[string]*call // lazily initialized
}
```

### 2.2 Do 方法
我们只需要查看一个 Do 方法，DoChan 的处理方法是类似的。

```go

func (g *Group) Do(key string, fn func() (interface{}, error)) (v interface{}, err error, shared bool) {
    g.mu.Lock()
    if g.m == nil {
      g.m = make(map[string]*call)
    }
    if c, ok := g.m[key]; ok {//如果已经存在相同的key
      c.dups++
      g.mu.Unlock()
      c.wg.Wait() //等待这个key的第一个请求完成
      return c.val, c.err, true //使用第一个key的请求结果
    }
    c := new(call) // 第一个请求，创建一个call
    c.wg.Add(1)
    g.m[key] = c //加入到key map中
    g.mu.Unlock()
  

    g.doCall(c, key, fn) // 调用方法
    return c.val, c.err, c.dups > 0
  }

  
func (g *Group) doCall(c *call, key string, fn func() (interface{}, error)) {
    c.val, c.err = fn()
    c.wg.Done()
  

    g.mu.Lock()
    // 在默认情况下，forgotten==false，所以第 8 行默认会被调用
    // 也就是说，第一个请求完成后，后续的同一个 key 的请求又重新开始新一次的 fn 函数的调用
    if !c.forgotten { // 已调用完，删除这个key
      delete(g.m, key)
    }
    for _, ch := range c.chans {
      ch <- Result{c.val, c.err, c.dups > 0}
    }
    g.mu.Unlock()
  }
```

## 3. 应用场景
Go 代码库中有两个地方用到了 SingleFlight:
1. 第一个是在[net/lookup.go](https://github.com/golang/go/blob/b1b67841d1e229b483b0c9dd50ddcd1795b0f90f/src/net/lookup.go)中，如果同时有查询同一个 host 的请求，lookupGroup 会把这些请求 merge 到一起，只需要一个请求就可以了
2. 第二个是 Go 在查询仓库版本信息时，将并发的请求合并成 1 个请求：

```go

func metaImportsForPrefix(importPrefix string, mod ModuleMode, security web.SecurityMode) (*urlpkg.URL, []metaImport, error) {
        // 使用缓存保存请求结果
    setCache := func(res fetchResult) (fetchResult, error) {
      fetchCacheMu.Lock()
      defer fetchCacheMu.Unlock()
      fetchCache[importPrefix] = res
      return res, nil
    
        // 使用 SingleFlight请求
    resi, _, _ := fetchGroup.Do(importPrefix, func() (resi interface{}, err error) {
      fetchCacheMu.Lock()
            // 如果缓存中有数据，那么直接从缓存中取
      if res, ok := fetchCache[importPrefix]; ok {
        fetchCacheMu.Unlock()
        return res, nil
      }
      fetchCacheMu.Unlock()
            ......
```

设计缓存问题时，我们常常需要解决缓存穿透、缓存雪崩和缓存击穿问题。缓存击穿问题是指，在平常高并发的系统中，大量的请求同时查询一个 key 时，如果这个 key 正好过期失效了，就会导致大量的请求都打到数据库上。这就是缓存击穿。用 SingleFlight 来解决缓存击穿问题再合适不过了。因为，这个时候，只要这些对同一个 key 的并发请求的其中一个到数据库中查询，就可以了，这些并发的请求可以共享同一个结果。因为是缓存查询，不用考虑幂等性问题。在 Go 生态圈知名的缓存框架 groupcache 中，就使用了较早的 Go 标准库的 SingleFlight 实现。

## 参考
本文内容摘录自:
1. [极客专栏-鸟叔的 Go 并发编程实战](https://time.geekbang.org/column/intro/100061801?tab=catalog)