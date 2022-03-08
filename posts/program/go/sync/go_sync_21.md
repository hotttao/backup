---
weight: 4
title: "go 分布式并发原语二"
date: 2021-05-20T22:00:00+08:00
lastmod: 2021-05-20T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "基于 etcd 的分布式队列、栅栏和 STM"
featuredImage: 

tags: ["go 并发"]
categories: ["Go"]

lightgallery: true

---


## 1. 分布式队列
### 1.1 基础使用
etcd 通过 github.com/coreos/etcd/contrib/recipes 包提供了分布式队列这种数据结构。其类型和方法的签名如下:

```go
// 创建队列
func NewQueue(client *v3.Client, keyPrefix string) *Queue


// 入队
func (q *Queue) Enqueue(val string) error
//出队
func (q *Queue) Dequeue() (string, error)
```

需要注意的是，如果这个分布式队列当前为空，调用 Dequeue 方法的话，会被阻塞，直到有元素可以出队才返回。

### 1.2 使用示例
我们可以启动多个下面的程序来模拟分布式的环境，进行测试:

```go

package main


import (
    "bufio"
    "flag"
    "fmt"
    "log"
    "os"
    "strings"

    "github.com/coreos/etcd/clientv3"
    recipe "github.com/coreos/etcd/contrib/recipes"
)


var (
    addr      = flag.String("addr", "http://127.0.0.1:2379", "etcd addresses")
    queueName = flag.String("name", "my-test-queue", "queue name")
)


func main() {
    flag.Parse()


    // 解析etcd地址
    endpoints := strings.Split(*addr, ",")


    // 创建etcd的client
    cli, err := clientv3.New(clientv3.Config{Endpoints: endpoints})
    if err != nil {
        log.Fatal(err)
    }
    defer cli.Close()


    // 创建/获取队列
    q := recipe.NewQueue(cli, *queueName)


    // 从命令行读取命令
    consolescanner := bufio.NewScanner(os.Stdin)
    for consolescanner.Scan() {
        action := consolescanner.Text()
        items := strings.Split(action, " ")
        switch items[0] {
        case "push": // 加入队列
            if len(items) != 2 {
                fmt.Println("must set value to push")
                continue
            }
            q.Enqueue(items[1]) // 入队
        case "pop": // 从队列弹出
            v, err := q.Dequeue() // 出队
            if err != nil {
                log.Fatal(err)
            }
            fmt.Println(v) // 输出出队的元素
        case "quit", "exit": //退出
            return
        default:
            fmt.Println("unknown action")
        }
    }
}
```

### 1.3 优先级队列
etcd 还提供了优先级队列（PriorityQueue）,用法和队列类似，只不过，在入队的时候，我们还需要提供 uint16 类型的一个整数，作为值的优先级，优先级高的元素会优先出队。

```go
type PriorityQueue struct {
    // contains filtered or unexported fields
}

func NewPriorityQueue(client *v3.Client, key string) *PriorityQueue

func (q *PriorityQueue) Dequeue() (string, error)
func (q *PriorityQueue) Enqueue(val string, pr uint16) error
```

## 2. 分布式栅栏
循环栅栏 CyclicBarrie 和 WaitGroup 本质上是同一类并发原语，都是等待同一组 goroutine 同时执行或者等待同一组 goroutine 都完成。分布式环境中，我们也会遇到这样的场景：一组节点协同工作，共同等待一个信号，在信号未出现前，这些节点会被阻塞住，而一旦信号出现，这些阻塞的节点就会同时开始继续执行下一步的任务。

etcd 也提供了相应的分布式并发原语:
1. Barrier：分布式栅栏。如果持有 Barrier 的节点释放了它，所有等待这个 Barrier 的节点就不会被阻塞，而是会继续执行。
2. DoubleBarrier：计数型栅栏。在初始化计数型栅栏的时候，我们就必须提供参与节点的数量，当这些数量的节点都 Enter 或者 Leave 的时候，这个栅栏就会放开。所以，我们把它称为计数型栅栏。

### 2.1 Barrier

```go
type Barrier
    func NewBarrier(client *v3.Client, key string) *Barrier
    func (b *Barrier) Hold() error
    func (b *Barrier) Release() error
    func (b *Barrier) Wait() error
```

1. Hold 方法是创建一个 Barrier。如果 Barrier 已经创建好了，有节点调用它的 Wait 方法，就会被阻塞。
2. Release 方法是释放这个 Barrier，也就是打开栅栏。如果使用了这个方法，所有被阻塞的节点都会被放行，继续执行。
3. Wait 方法会阻塞当前的调用者，直到这个 Barrier 被 release。如果这个栅栏不存在，调用者不会被阻塞，而是会继续执行。

```go

package main


import (
    "bufio"
    "flag"
    "fmt"
    "log"
    "os"
    "strings"


    "github.com/coreos/etcd/clientv3"
    recipe "github.com/coreos/etcd/contrib/recipes"
)


var (
    addr        = flag.String("addr", "http://127.0.0.1:2379", "etcd addresses")
    barrierName = flag.String("name", "my-test-queue", "barrier name")
)


func main() {
    flag.Parse()


    // 解析etcd地址
    endpoints := strings.Split(*addr, ",")


    // 创建etcd的client
    cli, err := clientv3.New(clientv3.Config{Endpoints: endpoints})
    if err != nil {
        log.Fatal(err)
    }
    defer cli.Close()


    // 创建/获取栅栏
    b := recipe.NewBarrier(cli, *barrierName)


    // 从命令行读取命令
    consolescanner := bufio.NewScanner(os.Stdin)
    for consolescanner.Scan() {
        action := consolescanner.Text()
        items := strings.Split(action, " ")
        switch items[0] {
        case "hold": // 持有这个barrier
            b.Hold()
            fmt.Println("hold")
        case "release": // 释放这个barrier
            b.Release()
            fmt.Println("released")
        case "wait": // 等待barrier被释放
            b.Wait()
            fmt.Println("after wait")
        case "quit", "exit": //退出
            return
        default:
            fmt.Println("unknown action")
        }
    }
}
```

### 2.2 DoubleBarrier
DoubleBarrier 在初始化时提供了一个计数的 count

```go
type DoubleBarrier
    func NewDoubleBarrier(s *concurrency.Session, key string, count int) *DoubleBarrier
    func (b *DoubleBarrier) Enter() error
    func (b *DoubleBarrier) Leave() error
```

1. Enter: 当调用者调用 Enter 时，会被阻塞住，直到一共有 count（初始化这个栅栏的时候设定的值）个节点调用了 Enter，这 count 个被阻塞的节点才能继续执行。所以，你可以利用它编排一组节点，让这些节点在同一个时刻开始执行任务。
2. Leave: 节点调用 Leave 方法的时候，会被阻塞，直到有 count 个节点，都调用了 Leave 方法，这些节点才能继续执行。

## 3. STM
### 3.1 etcd 事务
etcd 提供了在一个事务中对多个 key 的更新功能，这一组 key 的操作要么全部成功，要么全部失败。etcd 的事务实现方式是基于 CAS 方式实现的，融合了 Get、Put 和 Delete 操作。

etcd 的事务操作如下，分为条件块、成功块和失败块，条件块用来检测事务是否成功，如果成功，就执行 Then(...)，如果失败，就执行 Else(...)：

```go
Txn().If(cond1, cond2, ...).Then(op1, op2, ...,).Else(op1’, op2’, …)
```

下面是利用 etcd 实现转账的例子:

```go

func doTxnXfer(etcd *v3.Client, from, to string, amount uint) (bool, error) {
    // 一个查询事务
    getresp, err := etcd.Txn(ctx.TODO()).Then(OpGet(from), OpGet(to)).Commit()
    if err != nil {
         return false, err
    }
    // 获取转账账户的值
    fromKV := getresp.Responses[0].GetRangeResponse().Kvs[0]
    toKV := getresp.Responses[1].GetRangeResponse().Kvs[1]
    fromV, toV := toUInt64(fromKV.Value), toUint64(toKV.Value)
    if fromV < amount {
        return false, fmt.Errorf(“insufficient value”)
    }
    // 转账事务
    // 条件块
    txn := etcd.Txn(ctx.TODO()).If(
        v3.Compare(v3.ModRevision(from), “=”, fromKV.ModRevision),
        v3.Compare(v3.ModRevision(to), “=”, toKV.ModRevision))
    // 成功块
    txn = txn.Then(
        OpPut(from, fromUint64(fromV - amount)),
        OpPut(to, fromUint64(toV + amount))
    //提交事务 
    putresp, err := txn.Commit()
    // 检查事务的执行结果
    if err != nil {
        return false, err
    }
    return putresp.Succeeded, nil
}
```

虽然可以利用 etcd 实现事务操作，但是逻辑还是比较复杂的。所以 etcd 又在这些基础 API 上进行了封装，新增了一种叫做 STM 的操作，提供了更加便利的方法。要使用 STM，你需要先编写一个 apply 函数，这个函数的执行是在一个事务之中的：`apply func(STM) error`。这个方法包含一个 STM 类型的参数，它提供了对 key 值的读写操作。

STM 提供了 4 个方法，分别是 Get、Put、Receive 和 Delete，代码如下：

```go
type STM interface {
  Get(key ...string) string
  Put(key, val string, opts ...v3.OpOption)
  Rev(key string) int64
  Del(key string)
}
```

我们通过下面这个例子来看看如何使用 STM

```go

package main


import (
    "context"
    "flag"
    "fmt"
    "log"
    "math/rand"
    "strings"
    "sync"


    "github.com/coreos/etcd/clientv3"
    "github.com/coreos/etcd/clientv3/concurrency"
)


var (
    addr = flag.String("addr", "http://127.0.0.1:2379", "etcd addresses")
)


func main() {
    flag.Parse()


    // 解析etcd地址
    endpoints := strings.Split(*addr, ",")


    cli, err := clientv3.New(clientv3.Config{Endpoints: endpoints})
    if err != nil {
        log.Fatal(err)
    }
    defer cli.Close()


    // 设置5个账户，每个账号都有100元，总共500元
    totalAccounts := 5
    for i := 0; i < totalAccounts; i++ {
        k := fmt.Sprintf("accts/%d", i)
        if _, err = cli.Put(context.TODO(), k, "100"); err != nil {
            log.Fatal(err)
        }
    }


    // STM的应用函数，主要的事务逻辑
    exchange := func(stm concurrency.STM) error {
        // 随机得到两个转账账号
        from, to := rand.Intn(totalAccounts), rand.Intn(totalAccounts)
        if from == to {
            // 自己不和自己转账
            return nil
        }
        // 读取账号的值
        fromK, toK := fmt.Sprintf("accts/%d", from), fmt.Sprintf("accts/%d", to)
        fromV, toV := stm.Get(fromK), stm.Get(toK)
        fromInt, toInt := 0, 0
        fmt.Sscanf(fromV, "%d", &fromInt)
        fmt.Sscanf(toV, "%d", &toInt)


        // 把源账号一半的钱转账给目标账号
        xfer := fromInt / 2
        fromInt, toInt = fromInt-xfer, toInt+xfer


        // 把转账后的值写回
        stm.Put(fromK, fmt.Sprintf("%d", fromInt))
        stm.Put(toK, fmt.Sprintf("%d", toInt))
        return nil
    }


    // 启动10个goroutine进行转账操作
    var wg sync.WaitGroup
    wg.Add(10)
    for i := 0; i < 10; i++ {
        go func() {
            defer wg.Done()
            for j := 0; j < 100; j++ {
                if _, serr := concurrency.NewSTM(cli, exchange); serr != nil {
                    log.Fatal(serr)
                }
            }
        }()
    }
    wg.Wait()


    // 检查账号最后的数目
    sum := 0
    accts, err := cli.Get(context.TODO(), "accts/", clientv3.WithPrefix()) // 得到所有账号
    if err != nil {
        log.Fatal(err)
    }
    for _, kv := range accts.Kvs { // 遍历账号的值
        v := 0
        fmt.Sscanf(string(kv.Value), "%d", &v)
        sum += v
        log.Printf("account %s: %d", kv.Key, v)
    }


    log.Println("account sum is", sum) // 总数
}
```

使用 etcd STM 的时候，我们只需要定义一个 apply 方法(上面的 exchange函数)，然后通过 concurrency.NewSTM(cli, exchange)，就可以完成转账事务的执行了。总结一下，当你利用 etcd 做存储时，是可以利用 STM 实现事务操作的，一个事务可以包含多个账号的数据更改操作，事务能够保证这些更改要么全成功，要么全失败。

## 参考
本文内容摘录自:
1. [极客专栏-鸟叔的 Go 并发编程实战](https://time.geekbang.org/column/intro/100061801?tab=catalog)