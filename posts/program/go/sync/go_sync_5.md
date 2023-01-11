---
weight: 4
title: "RWMutex"
date: 2021-05-04T22:00:00+08:00
lastmod: 2021-05-04T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go 读写锁 RWMutex"
featuredImage: 

tags: ["go 并发"]
categories: ["Go"]

lightgallery: true

---

读写锁 RWMutex
<!-- more -->

## 1. RWMutex 使用
标准库中的 RWMutex 是一个 reader/writer 互斥锁，用来解决并发读写问题，特别适用于读多写少的场景。RWMutex 在某一时刻只能由任意数量的 reader 持有，或者是只被单个的 writer 持有。

### 1.1 RWMutex
RWMutex 的方法也很少，总共有 5 个:
1. Lock/Unlock：
    - 写操作时调用的方法
    - 如果锁已经被 reader 或者 writer 持有，那么，Lock 方法会一直阻塞，直到能获取到锁；
    - Unlock 则是配对的释放锁的方法
2. RLock/RUnlock：
    - 读操作时调用的方法
    - 如果锁已经被 writer 持有的话，RLock 方法会一直阻塞，直到能获取到锁，否则就直接返回
    - RUnlock 是 reader 释放锁的方法
3. RLocker：这个方法的作用是为读操作返回一个 Locker 接口的对象。它的 Lock 方法会调用 RWMutex 的 RLock 方法，它的 Unlock 方法会调用 RWMutex 的 RUnlock 方法

下面是使用 RWMutex 的简单示例:

```go

func main() {
    var counter Counter
    for i := 0; i < 10; i++ { // 10个reader
        go func() {
            for {
                counter.Count() // 计数器读操作
                time.Sleep(time.Millisecond)
            }
        }()
    }

    for { // 一个writer
        counter.Incr() // 计数器写操作
        time.Sleep(time.Second)
    }
}
// 一个线程安全的计数器
type Counter struct {
    mu    sync.RWMutex
    count uint64
}

// 使用写锁保护
func (c *Counter) Incr() {
    c.mu.Lock()
    c.count++
    c.mu.Unlock()
}

// 使用读锁保护
func (c *Counter) Count() uint64 {
    c.mu.RLock()
    defer c.mu.RUnlock()
    return c.count
}
```

在实际使用 RWMutex 的时候，如果我们在 struct 中使用 RWMutex 保护某个字段，一般会把它和这个字段放在一起，用来指示两个字段是一组字段。除此之外，我们还可以采用匿名字段的方式嵌入 struct，这样，在使用这个 struct 时，我们就可以直接调用 Lock/Unlock、RLock/RUnlock 方法了。

同样的，RWMutex 的零值是未加锁的状态，使用时不必显式地初始化。

## 2. RWMutex 实现
RWMutex 一般都是基于互斥锁、条件变量（condition variables）或者信号量（semaphores）等并发原语来实现。Go 标准库中的 RWMutex 是基于 Mutex 实现的。

readers-writers 问题一般有三类，基于对读和写操作的优先级，读写锁的设计和实现也分成三类:
1. Read-preferring：
    - 读优先的设计可以提供很高的并发性，但是，在竞争激烈的情况下可能会导致写饥饿
    - 这是因为，如果有大量的读，这种设计会导致只有所有的读都释放了锁之后，写才可能获取到锁
2. Write-preferring：
    - 写优先的设计意味着，如果已经有一个 writer 在等待请求锁的话，它会阻止新来的请求锁的 reader 获取到锁，所以优先保障 writer。
    - 当然，如果有一些 reader 已经请求了锁的话，新请求的 writer 也会等待已经存在的 reader 都释放锁之后才能获取。
    - 所以，写优先级设计中的优先权是针对新来的请求而言的。这种设计主要避免了 writer 的饥饿问题。
3. 不指定优先级：
    - 这种设计比较简单，不区分 reader 和 writer 优先级
    - 某些场景下这种不指定优先级的设计反而更有效，因为第一类优先级会导致写饥饿，第二类优先级可能会导致读饥饿，这种不指定优先级的访问不再区分读写，大家都是同一个优先级，解决了饥饿的问题
    
Go 标准库中的 RWMutex 设计是 Write-preferring 方案。**一个正在阻塞的 Lock 调用会排除新的 reader 请求到锁**。

### 2.1 RWMutex 的定义

```go

type RWMutex struct {
  w           Mutex   // 互斥锁解决多个writer的竞争
  writerSem   uint32  // writer信号量
  readerSem   uint32  // reader信号量
  readerCount int32   // reader的数量
  readerWait  int32   // writer等待完成的reader的数量
}

const rwmutexMaxReaders = 1 << 30
```

RWMutex 包含如下几个字段:
1. 字段 w：为 writer 的竞争锁而设计；
2. 字段 readerCount：记录当前 reader 的数量（以及是**否有 writer 竞争锁**）；
3. readerWait：记录 writer 请求锁时需要等待 read 完成的 reader 的数量；
4. writerSem 和 readerSem：都是为了阻塞设计的信号量。

常量 rwmutexMaxReaders，定义了最大的 reader 数量。

### 2.2 RLock/RUnlock 的实现
```go

func (rw *RWMutex) RLock() {
    if atomic.AddInt32(&rw.readerCount, 1) < 0 {
            // rw.readerCount是负值的时候，意味着此时有writer等待请求锁，因为writer优先级高，所以把后来的reader阻塞休眠
        runtime_SemacquireMutex(&rw.readerSem, false, 0)
    }
}
func (rw *RWMutex) RUnlock() {
    if r := atomic.AddInt32(&rw.readerCount, -1); r < 0 {
        rw.rUnlockSlow(r) // 有等待的writer
    }
}
func (rw *RWMutex) rUnlockSlow(r int32) {
    if atomic.AddInt32(&rw.readerWait, -1) == 0 {
        // 最后一个reader了，writer终于有机会获得锁了
        runtime_Semrelease(&rw.writerSem, false, 1)
    }
}
```
在上面的实现，要注意 readerCount 可能为负数，这是因为 readerCount 这个字段有双重含义：
1. 没有 writer 竞争或持有锁时，readerCount 和我们正常理解的 reader 的计数是一样的；
2. **有 writer 竞争锁或者持有锁**时，那么，readerCount 不仅仅承担着 reader 的计数功能，还能够标识当前是否有 writer 竞争或持有锁

当 writer 请求锁的时候，是无法改变既有的 reader 持有锁的现实的，也不会强制这些 reader 释放锁，它的优先权只是限定后来的 reader 不要和它抢。

所以，rUnlockSlow 将持有锁的 reader 计数减少 1 的时候，会检查既有的 reader 是不是都已经释放了锁，如果都释放了锁，就会唤醒 writer，让 writer 持有锁。

### 2.3 Lock
为了避免 writer 之间的竞争，RWMutex 就会使用一个 Mutex 来保证 writer 的互斥。一旦一个 writer 获得了内部的互斥锁，就会反转 readerCount 字段，把它从原来的正整数 readerCount(>=0) 修改为负数（readerCount-rwmutexMaxReaders），让这个字段保持两个含义（既保存了 reader 的数量，又表示当前有 writer）。

这样做的目的是为了将减少 reader 数量和判断是否有 writer 实现在一个原子操作内。

```go

func (rw *RWMutex) Lock() {
    // 首先解决其他writer竞争问题
    rw.w.Lock()
    // 反转readerCount，告诉reader有writer竞争锁
    // 还会记录当前活跃的 reader 数量，所谓活跃的 reader，就是指持有读锁还没有释放的那些 reader
    r := atomic.AddInt32(&rw.readerCount, -rwmutexMaxReaders) + rwmutexMaxReaders
    // 如果当前有reader持有锁，那么需要等待
    // 并把当前 readerCount 赋值给 readerWait 字段
    if r != 0 && atomic.AddInt32(&rw.readerWait, r) != 0 {
        // 这里应该加一个 readerWait == 0 的判断，毕竟在 mutex 的实现中都有这种异常的判断
        runtime_SemacquireMutex(&rw.writerSem, false, 0)
    }
}
```

在 RWMutex Lock 方法实现中:
1. `rw.w.Lock()`: 保证了同时只有一个 writer 在竞争锁，并可能修改 RWMutex 的状态字段
2. 一旦有 writer 获取了这个锁，就会反转 readerCount 字段，表示当前已经有 writer 在竞争锁了

### 2.4 Unlock

```go
func (rw *RWMutex) Unlock() {
    // 告诉reader没有活跃的writer了
    r := atomic.AddInt32(&rw.readerCount, rwmutexMaxReaders)
    
    // 唤醒阻塞的reader们
    for i := 0; i < int(r); i++ {
        runtime_Semrelease(&rw.readerSem, false, 0)
    }
    // 释放内部的互斥锁
    rw.w.Unlock()
}
```
在 RWMutex Unlock 方法实现中:
1. 是先释放读锁，后释放写锁，我的理解调过来也是可以，但是调过来会导致读饥饿。

最后，在 Lock 方法中，是先获取内部互斥锁，才会修改的其他字段；而在 Unlock 方法中，是先修改的其他字段，才会释放内部互斥锁，这样才能保证字段的修改也受到互斥锁的保护。

## 3. RWMutex 采坑点
RWMutex有三个采坑点:
1. 不可复制: 
    - 原因: 互斥锁是不可复制的，再加上四个有状态的字段，RWMutex 就更加不能复制使用了
    - 解决方案也和互斥锁一样。你可以借助 vet 工具检查是否有读写锁隐式复制的情景
2. 重入导致死锁
    - writer 重入调用 Lock 的时候，就会出现死锁的现象
    - 有活跃 reader 的时候，writer 会等待，如果我们在 reader 的读操作时调用 writer 的写操，此时Reader 想等待 writer 完成后再释放锁，而 writer 需要这个 reader 释放锁之后，才能不阻塞地继续执行，导致死锁
    - writer 依赖活跃的 reader -> 活跃的 reader 依赖新来的 reader -> 新来的 reader 依赖 writer
3. 释放未加锁的 RWMutex: Lock 和 Unlock 的调用总是成对出现的，RLock 和 RUnlock 的调用也必须成对出现

**使用读写锁最需要注意的一点就是尽量避免重入，重入带来的死锁非常隐蔽，而且难以诊断。**

另外我们也可以扩展 RWMutex，不过实现方法和互斥锁 Mutex 差不多，在技术上是一样的，都是通过 unsafe 来实现。大体的技巧如下:

```go
// 获取 readerCount
readerCount := atomic.LoadInt32((*int32)(unsafe.Pointer(uintptr(unsafe.Pointer(&m)) + unsafe.Sizeof(sync.Mutex{}) + 2*unsafe.Sizeof(uint32(0)))))
```

## 参考
本文内容摘录自:
1. [极客专栏-鸟叔的 Go 并发编程实战](https://time.geekbang.org/column/intro/100061801?tab=catalog)