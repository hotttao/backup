---
weight: 1
title: "Once 实现单例"
date: 2021-05-07T22:00:00+08:00
lastmod: 2021-05-07T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go Once 实现单例"
featuredImage: 

tags: ["go 并发"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

Once 有且仅有一次执行
<!-- more -->

## 1. Once 概述
Once 可以用来执行且仅仅执行一次动作：Once 常常用来初始化单例资源，或者并发访问只需初始化一次的共享资源，或者在测试的时候初始化一次测试资源。

### 1.1 单例对象初始化
初始化单例资源有很多方法，比如定义 package 级别的变量:

```go
package abc

import time

var startTime = time.Now()
```

或者在 init 函数中

```go

package abc

var startTime time.Time

func init() {
  startTime = time.Now()
}

```

又或者在 main 函数开始执行的时候:

```go

package abc

var startTime time.Time

func initApp() {
    startTime = time.Now()
}
func main() {
  initApp()
}
```

这三种方法都是线程安全的，并且后两种方法还可以根据传入的参数实现定制化的初始化操作。

### 1.2 延迟初始化
但是很多时候我们是要延迟进行初始化，比如下面初始化网络连接的示例:

```go
package main

import (
	"net"
	"sync"
	"time"
)

var connMu sync.Mutex
var conn net.Conn

func getConn() net.Conn {
	connMu.Lock()
	defer connMu.Unlock()

	if conn != nil {
		return conn
	}

	conn, _ = net.DialTimeout("tcp", "baidu.com:80", 10*time.Second)
	return conn
}

func main(){
	conn:=getConn()
	if conn == nil{
		panic("conn is nil")
	}
}

```

这种方式虽然实现起来简单，但是有性能问题。一旦连接创建好，每次请求的时候还是得竞争锁才能读取到这个连接。这时候我们就需要 Once 并发原语了。

### 1.3 Once 的使用
sync.Once 只暴露了一个方法 Do:
1. 你可以多次调用 Do 方法，但是只有第一次调用 Do 方法时 f 参数才会执行，这里的 f 是一个无参数无返回值的函数
2. 因为当且仅当第一次调用 Do 方法的时候参数 f 才会执行，即使第二次、第三次、第 n 次调用时 f 参数的值不一样，也不会被执行
3. 因为这里的 f 参数是一个无参数无返回的函数，所以你可能会通过闭包的方式引用外面的参数

```go
func (o *Once) Do(f func())
```

```go
package main

import (
    "net"	
    "sync"
)


var addr = "baidu.com"

var conn net.Conn
var err error
var once sync.Once

once.Do(func(){
	conn, err = net.Dial("tcp", addr)
})
```

有很多标准库中都有 Once 的身影，典型的 math/big/sqrt.go 中实现的一个数据结构，它通过 Once 封装了一个只初始化一次的值：

```go

   // 值是3.0或者0.0的一个数据结构
   var threeOnce struct {
    sync.Once
    v *Float
  }
  
    // 返回此数据结构的值，如果还没有初始化为3.0，则初始化
  func three() *Float {
    threeOnce.Do(func() { // 使用Once初始化
      threeOnce.v = NewFloat(3.0)
    })
    return threeOnce.v
  }
```

当你使用 Once 的时候，你也可以尝试采用这种结构，将值和 Once 封装成一个新的数据结构，提供只初始化一次的值。

## 2. Once 实现

很多人觉得 Once 只需要使用一个 flag 标记是否初始化即可，最多使用 atomic 原子操作这个 flag 比如下面这个实现:

```go

type Once struct {
    done uint32
}

func (o *Once) Do(f func()) {
    if !atomic.CompareAndSwapUint32(&o.done, 0, 1) {
        return
    }
    f()
}
```

但是，这个实现有一个很大的问题，就是**如果参数 f 执行很慢的话，后续调用 Do 方法的 goroutine 虽然看到 done 已经设置为执行过了，但是获取某些初始化资源的时候可能会得到空的资源，因为 f 还没有执行完**。

所以一个正确的 Once 实现同事需要互斥锁和  flag 的双重检测机制:
1. 互斥锁的机制保证只有一个 goroutine 进行初始化，并在 f() 未执行完成时，其他 goroutine 等待
2. flag 用于 f() 执行之后快速成功，以及保证只有一次初始化

```go
type Once struct {
    done uint32
    m    Mutex
}

func (o *Once) Do(f func()) {
    // 1. flag 用于快速成功，不用在 f() 完成后，仍去竞争锁
    if atomic.LoadUint32(&o.done) == 0 {
        o.doSlow(f)
    }
}


func (o *Once) doSlow(f func()) {
    // 2. f() 未执行完时，多个 goroutine 都会争抢锁，从而等待 f() 执行完成
    o.m.Lock()
    defer o.m.Unlock()
    // 3. 双检查机制保证只有 f() 只执行一次
    if o.done == 0 {
        defer atomic.StoreUint32(&o.done, 1)
        f()
    }
}
```

所谓的双检查就是，即便进入 doSlow 后获取到锁，也要判断初始化是否已经完成。

## 3.Once 采坑点
使用 Once 有两个常见错误:
1. 死锁:  Do 方法会执行一次 f，但是如果 f 中再次调用这个 Once 的 Do 方法的话，就会导致死锁的情况出现
2. 初始化未完成: 如果 f 方法执行的时候 panic，或者 f 执行初始化资源的时候失败了，这个时候，Once 还是会认为初次执行已经成功了，即使再次调用 Do 方法，也不会再次执行 f。

Once 有一个比较典型的采坑案例，场景是这样的: Once Do 方法只能初始化一次，有时候我们需要能够重新初始化，即为 Once 增加一个 Reset 方法，Reset 之后再调用 once.Do 就又可以初始化了。Go 的核心开发者 Ian Lance Taylor 给了一个简单的解决方案，即 Reset 的时候将 原有的 Once 变量(例如变量ponce)赋值一个新的 Once 实例即可 (ponce = new(sync.Once))。这样在新的 ponce 就可以再次执行初始化。但是我们不能像这样: `ponce.Do(ponce.Reset())` 在 Do 方法中，重新给 ponce 赋值。原因在于
1. 在执行 ponce.Reset 的时候 Once 内部的 Mutex 首先会加锁，
2. 在 Reset 中更改了 Once 指针的值之后，结果在执行完 Reset 释放锁的时候，释放的是一个刚初始化未加锁的 Mutex，所以就 panic 了

下面的 doSlow 方法就演示了这个错误:

```go
package main


import (
    "sync"
)

type Once struct {
    m sync.Mutex
}

func (o *Once) doSlow() {
    o.m.Lock()
    defer o.m.Unlock()

    // 这里更新的o指针的值!!!!!!!, 会导致上一行Unlock出错
    *o = Once{}
}

func main() {
    var once Once
    once.doSlow()
}
```

Ian Lance Taylor 介绍的 Reset 方法没有错误，但是你在使用的时候千万**别再初始化函数中 Reset 这个 Once，否则势必会导致 Unlock 一个未加锁的 Mutex 的错误**。这里再多补充一下这个 panic 的触发逻辑:
1. Once doSlow 实现中有 `o.m.Lock; defer o.m.Unlock()`
2. 如果调用 Do(Reset()) 就会导致这样的调用顺序: 初始 o.m.Lock() -> Reset 设置新的 o.m -> 调用新的 o.m.Unlock()，释放未加锁的锁，导致 panic。 

使用 Once 真的不容易犯错，想犯错都很困难，因为很少有人会傻傻地在初始化函数 f 中递归调用 f，这种死锁的现象几乎不会发生。另外如果函数初始化不成功，我们一般会 panic，或者在使用的时候做检查，会及早发现这个问题，在初始化函数中加强代码。

## 4. Once 的扩展
### 4.1 可多次初始化的 Once
针对初始化未完成的情况，我们可以自己实现一个类似 Once 的并发原语，既可以返回当前调用 Do 方法是否正确完成，还可以在初始化失败后调用 Do 方法再次尝试初始化，直到初始化成功才不再初始化了。

```go

// 一个功能更加强大的Once
type Once struct {
    m    sync.Mutex
    done uint32
}
// 传入的函数f有返回值error，如果初始化失败，需要返回失败的error
// Do方法会把这个error返回给调用者
func (o *Once) Do(f func() error) error {
    if atomic.LoadUint32(&o.done) == 1 { //fast path
        return nil
    }
    return o.slowDo(f)
}
// 如果还没有初始化
func (o *Once) slowDo(f func() error) error {
    o.m.Lock()
    defer o.m.Unlock()
    var err error
    if o.done == 0 { // 双检查，还没有初始化
        err = f()
        if err == nil { // 初始化成功才将标记置为已初始化
            atomic.StoreUint32(&o.done, 1)
        }
    }
    return err
}
```

### 4.2 可获取是否初始化的 Once
目前的 Once 实现可以保证你调用任意次数的 once.Do 方法，它只会执行这个方法一次。但是，有时候我们需要一个是否初始化的标记。标准库的 Once 并不会告诉你是否初始化完成了。所以通常我们需要一个辅助变量，自己去检查是否初始化完成:

```go

type AnimalStore struct {once   sync.Once;inited uint32}
func (a *AnimalStore) Init() // 可以被并发调用
  a.once.Do(func() {
    longOperationSetupDbOpenFilesQueuesEtc()
    atomic.StoreUint32(&a.inited, 1)
  })
}
func (a *AnimalStore) CountOfCats() (int, error) { // 另外一个goroutine
  if atomic.LoadUint32(&a.inited) == 0 { // 初始化后才会执行真正的业务逻辑
    return 0, NotYetInitedError
  }
        //Real operation
}
```

另一个解决方案是，我们可以自己去扩展 Once 的并发原语，为其提供一个返回是否已初始化的 Done 方法:

```go

// Once 是一个扩展的sync.Once类型，提供了一个Done方法
type Once struct {
    sync.Once
}

// Done 返回此Once是否执行过
// 如果执行过则返回true
// 如果没有执行过或者正在执行，返回false
func (o *Once) Done() bool {
    return atomic.LoadUint32((*uint32)(unsafe.Pointer(&o.Once))) == 1
}

func main() {
    var flag Once
    fmt.Println(flag.Done()) //false

    flag.Do(func() {
        time.Sleep(time.Second)
    })

    fmt.Println(flag.Done()) //true
}
```

注: 相信有人跟我一样看到 `atomic.LoadUint32((*uint32)(unsafe.Pointer(&o.Once))) == 1` 时怀疑人生路，这个怎么能判断 Once是否执行过了呢。这是因为你看的是鸟哥扩展的 Once 实现，done 字段在后:

```go
type Once struct {
    m    sync.Mutex
    done uint32
}
```

go Once 源码里面，done 字段是在前的:

```go
type Once struct { 
    done uint32 
    m Mutex
}
```

## 参考
本文内容摘录自:
1. [极客专栏-鸟叔的 Go 并发编程实战](https://time.geekbang.org/column/intro/100061801?tab=catalog)