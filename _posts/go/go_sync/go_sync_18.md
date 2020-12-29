---
title: 18 CyclicBarrier 循环栅栏
date: 2019-02-18
categories:
    - Go
tags:
    - go并发编程
---
CyclicBarrier  
<!-- more -->

## 1. CyclicBarrier 概述
[CyclicBarrier](https://github.com/marusama/cyclicbarrier) 是一个可重用的栅栏并发原语，常常应用于重复进行一组 goroutine 同时执行的场景中。

CyclicBarrier允许一组 goroutine 彼此等待，到达一个共同的执行点。同时，因为它可以被重复使用，所以叫循环栅栏。具体的机制是，大家都在栅栏前等待，等全部都到齐了，就抬起栅栏放行。


### 1.1 CyclicBarrier 与 WaitGroup
你可能会觉得，CyclicBarrier 和 WaitGroup 的功能有点类似，确实是这样。不过，CyclicBarrier 更适合用在“固定数量的 goroutine 等待同一个执行点”的场景中，而且在放行 goroutine 之后，CyclicBarrier 可以重复利用，不像 WaitGroup 重用的时候，必须小心翼翼避免 panic。

处理可重用的多 goroutine 等待同一个执行点的场景的时候，CyclicBarrier 和 WaitGroup 方法调用的对应关系如下：

![Mutex实现原理](/images/go/sync/CyclicBarrier.jpg)

如果使用 WaitGroup 实现的话，调用比较复杂，不像 CyclicBarrier 那么清爽。更重要的是，如果想重用 WaitGroup，你还要保证，将 WaitGroup 的计数值重置到 n 的时候不会出现并发问题。WaitGroup 更适合用在“一个 goroutine 等待一组 goroutine 到达同一个执行点”的场景中，或者是不需要重用的场景中。

### 1.2 CyclicBarrier 使用

CyclicBarrier 有两个初始化方法：
1. 第一个是 New 方法，它只需要一个参数，来指定循环栅栏参与者的数量；
2. 第二个方法是 NewWithAction
    - 它额外提供一个函数，可以在每一次到达执行点的时候执行一次
    - 执行具体的时间点是在最后一个参与者到达之后，但是其它的参与者还未被放行之前。我们可以利用它，做放行之前的一些共享状态的更新等操作。

```go

func New(parties int) CyclicBarrier
func NewWithAction(parties int, barrierAction func() error) CyclicBarrier
```

CyclicBarrier 是一个接口，定义的方法如下：

```go

type CyclicBarrier interface {
    // 等待所有的参与者到达，如果被ctx.Done()中断，会返回ErrBrokenBarrier
    Await(ctx context.Context) error

    // 重置循环栅栏到初始化状态。如果当前有等待者，那么它们会返回ErrBrokenBarrier
    Reset()

    // 返回当前等待者的数量
    GetNumberWaiting() int

    // 参与者的数量
    GetParties() int

    // 循环栅栏是否处于中断状态
    IsBroken() bool
}
```

循环栅栏的使用也很简单。循环栅栏的参与者只需调用 Await 等待，等所有的参与者都到达后，再执行下一步。当执行下一步的时候，循环栅栏的状态又恢复到初始的状态了，可以迎接下一轮同样多的参与者。下面是一个使用示例: 生产水原子，每生产一个水分子，就会打印出 HHO、HOH、OHH 三种形式的其中一种。

```go

package water
import (
  "context"
  "github.com/marusama/cyclicbarrier"
  "golang.org/x/sync/semaphore"
)
// 定义水分子合成的辅助数据结构
type H2O struct {
  semaH *semaphore.Weighted // 氢原子的信号量
  semaO *semaphore.Weighted // 氧原子的信号量
  b     cyclicbarrier.CyclicBarrier // 循环栅栏，用来控制合成
}
func New() *H2O {
  return &H2O{
    semaH: semaphore.NewWeighted(2), //氢原子需要两个
    semaO: semaphore.NewWeighted(1), // 氧原子需要一个
    b:     cyclicbarrier.New(3),  // 需要三个原子才能合成
  }
}


func (h2o *H2O) hydrogen(releaseHydrogen func()) {
  h2o.semaH.Acquire(context.Background(), 1)

  releaseHydrogen() // 输出H
  h2o.b.Await(context.Background()) //等待栅栏放行
  h2o.semaH.Release(1) // 释放氢原子空槽
}


func (h2o *H2O) oxygen(releaseOxygen func()) {
  h2o.semaO.Acquire(context.Background(), 1)

  releaseOxygen() // 输出O
  h2o.b.Await(context.Background()) //等待栅栏放行
  h2o.semaO.Release(1) // 释放氢原子空槽
}
```

下面是对应的单元测试

```go

package water


import (
    "math/rand"
    "sort"
    "sync"
    "testing"
    "time"
)


func TestWaterFactory(t *testing.T) {
    //用来存放水分子结果的channel
    var ch chan string
    releaseHydrogen := func() {
        ch <- "H"
    }
    releaseOxygen := func() {
        ch <- "O"
    }

    // 300个原子，300个goroutine,每个goroutine并发的产生一个原子
    var N = 100
    ch = make(chan string, N*3)


    h2o := New()

    // 用来等待所有的goroutine完成
    var wg sync.WaitGroup
    wg.Add(N * 3)
   
    // 200个氢原子goroutine
    for i := 0; i < 2*N; i++ {
        go func() {
            time.Sleep(time.Duration(rand.Intn(100)) * time.Millisecond)
            h2o.hydrogen(releaseHydrogen)
            wg.Done()
        }()
    }
    // 100个氧原子goroutine
    for i := 0; i < N; i++ {
        go func() {
            time.Sleep(time.Duration(rand.Intn(100)) * time.Millisecond)
            h2o.oxygen(releaseOxygen)
            wg.Done()
        }()
    }
    
    //等待所有的goroutine执行完
    wg.Wait()

    // 结果中肯定是300个原子
    if len(ch) != N*3 {
        t.Fatalf("expect %d atom but got %d", N*3, len(ch))
    }

    // 每三个原子一组，分别进行检查。要求这一组原子中必须包含两个氢原子和一个氧原子，这样才能正确组成一个水分子。
    var s = make([]string, 3)
    for i := 0; i < N; i++ {
        s[0] = <-ch
        s[1] = <-ch
        s[2] = <-ch
        sort.Strings(s)


        water := s[0] + s[1] + s[2]
        if water != "HHO" {
            t.Fatalf("expect a water molecule but got %s", water)
        }
    }
}
```

如果你没有学习 CyclicBarrier，你可能只会想到，用 WaitGroup 来实现这个水分子制造工厂的例子。

```go

type H2O struct {
    semaH *semaphore.Weighted
    semaO *semaphore.Weighted
    wg    sync.WaitGroup //将循环栅栏替换成WaitGroup
}

func New() *H2O {
    var wg sync.WaitGroup
    wg.Add(3)

    return &H2O{
        semaH: semaphore.NewWeighted(2),
        semaO: semaphore.NewWeighted(1),
        wg:    wg,
    }
}


func (h2o *H2O) hydrogen(releaseHydrogen func()) {
    h2o.semaH.Acquire(context.Background(), 1)
    releaseHydrogen()

    // 标记自己已达到，等待其它goroutine到达
    h2o.wg.Done()
    h2o.wg.Wait()

    h2o.semaH.Release(1)
}

func (h2o *H2O) oxygen(releaseOxygen func()) {
    h2o.semaO.Acquire(context.Background(), 1)
    releaseOxygen()

    // 标记自己已达到，等待其它goroutine到达
    h2o.wg.Done()
    h2o.wg.Wait()
    //都到达后重置wg 
    h2o.wg.Add(3)

    h2o.semaO.Release(1)
}
```

使用 WaitGroup 非常复杂，而且，重用和 Done 方法的调用有并发的问题，程序可能 panic，远远没有使用循环栅栏更加简单直接。
