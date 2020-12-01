---
title: 6 WaitGroup
date: 2019-02-06
categories:
    - Go
tags:
    - go并发编程
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
