---
title: 4 Mutex 扩展
date: 2019-02-03
categories:
    - Go
tags:
    - go并发编程
---

如何基于 Mutex 实现一个可重入锁
<!-- more -->

## 1. Mutex 的扩展
上一节我们介绍了 Mutex 的实现原理，这一节我们来看看如何基于标准库的 Mutex 来扩展 Mutex 提供的并发原语，包括:
1. 实现一个可重入锁

## 2. 可重入锁
实现可重入锁的关键是要锁能记住当前哪个 goroutine 持有锁，这里有两个方案:
1. 通过 hacker 的方式获取到 goroutine id，记录下获取锁的 goroutine id，它可以实现 Locker 接口
2. 调用 Lock/Unlock 方法时，由 goroutine 提供一个 token，用来标识它自己，而不是我们通过 hacker 的方式获取到 goroutine id，但是，这样一来，就不满足 Locker 接口了

可重入锁（递归锁）解决了代码重入或者递归调用带来的死锁问题，同时它也带来了另一个好处: 只有持有锁的 goroutine 才能 unlock 这个锁。接下来我们来看看这两个方案具体如何实现。

### 2.1 goroutine id
这个方案的关键第一步是获取 goroutine id，方式有两种，分别是
1. 简单方式：通过 runtime.Stack 方法获取栈帧信息，栈帧信息里包含 goroutine id
2. hacker 方式: 
    - 原理: 我们获取运行时的 g 指针，反解出对应的 g 的结构。每个运行的 goroutine 结构的 g 指针保存在当前 goroutine 的一个叫做 TLS 对象中
    - 第一步：我们先获取到 TLS 对象
    - 第二步：再从 TLS 中获取 goroutine 结构的 g 指针
    - 第三步：再从 g 指针中取出 goroutine id。
    - 需要注意的是，不同 Go 版本的 goroutine 的结构可能不同，所以需要根据 Go 的不同版本进行调整。没必要重复造轮子，直接使用第三方库就可以: [petermattis/goid](https://github.com/petermattis/goid) 

```go
import (
	"fmt"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/petermattis/goid" // 使用第三方包通过 hacker 方式获取 goroutine id 
)

// 简单方式
func GoID() int {
	var buffer [64]byte
	n := runtime.Stack(buffer[:], false)
	idField := strings.Fields(strings.TrimPrefix(string(buffer[:n]), "goroutine "))[0]
	d, err := strconv.Atoi(idField)
	if err != nil {
		panic(fmt.Sprintf("can not get goroutine id %v", err))
	}
	return d
}


// RecursiveMutex 包装一个Mutex,实现可重入
type RecursiveMutex struct {
    sync.Mutex
    owner     int64 // 当前持有锁的goroutine id
    recursion int32 // 这个goroutine 重入的次数
}

func (m *RecursiveMutex) Lock() {
    gid := goid.Get()
    // 如果当前持有锁的goroutine就是这次调用的goroutine,说明是重入
    if atomic.LoadInt64(&m.owner) == gid {
        m.recursion++
        return
    }
    m.Mutex.Lock()
    // 获得锁的goroutine第一次调用，记录下它的goroutine id,调用次数加1
    atomic.StoreInt64(&m.owner, gid)
    m.recursion = 1
}

func (m *RecursiveMutex) Unlock() {
    gid := goid.Get()
    // 非持有锁的goroutine尝试释放锁，错误的使用
    if atomic.LoadInt64(&m.owner) != gid {
        panic(fmt.Sprintf("wrong the owner(%d): %d!", m.owner, gid))
    }
    // 调用次数减1
    m.recursion--
    if m.recursion != 0 { // 如果这个goroutine还没有完全释放，则直接返回
        return
    }
    // 此goroutine最后一次调用，需要释放锁
    atomic.StoreInt64(&m.owner, -1)
    m.Mutex.Unlock()
}
```

### 2.2 token
通过 token 的实现方式需要调用者自己提供一个 token，获取锁的时候把这个 token 传入，释放锁的时候也需要把这个 token 传入。通过用户传入的 token 替换方案一中 goroutine id，其它逻辑和方案一一致。

```go

// Token方式的递归锁
type TokenRecursiveMutex struct {
    sync.Mutex
    token     int64
    recursion int32
}

// 请求锁，需要传入token
func (m *TokenRecursiveMutex) Lock(token int64) {
    if atomic.LoadInt64(&m.token) == token { //如果传入的token和持有锁的token一致，说明是递归调用
        m.recursion++
        return
    }
    m.Mutex.Lock() // 传入的token不一致，说明不是递归调用
    // 抢到锁之后记录这个token
    atomic.StoreInt64(&m.token, token)
    m.recursion = 1
}

// 释放锁
func (m *TokenRecursiveMutex) Unlock(token int64) {
    if atomic.LoadInt64(&m.token) != token { // 释放其它token持有的锁
        panic(fmt.Sprintf("wrong the owner(%d): %d!", m.token, token))
    }
    m.recursion-- // 当前持有这个锁的token释放锁
    if m.recursion != 0 { // 还没有回退到最初的递归调用
        return
    }
    atomic.StoreInt64(&m.token, 0) // 没有递归调用了，释放锁
    m.Mutex.Unlock()
}

```