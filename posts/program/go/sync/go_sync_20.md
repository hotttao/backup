---
weight: 1
title: "go 分布式并发原语一"
date: 2021-05-19T22:00:00+08:00
lastmod: 2021-05-19T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Leader 选举、互斥锁、读写锁"
featuredImage: 

tags: ["go 并发"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---


## 1. 分布式并发原语概述
在前面的课程里，我们学习的并发原语都是在进程内使用的，即一个运行程序为了**控制共享资源、实现任务编排和进行消息传递**而提供的控制类型。布式的并发原语实现更加复杂，因为在分布式环境中，网络不可靠、时钟不一致、以及不可预测的程序暂停，使得节点之间的通信相对于内存具有非常的不确定性。不过还好有相应的软件系统去做这些事情。这些软件系统会专门去处理这些节点之间的协调和异常情况，并且保证数据的一致性。我们要做的就是在它们的基础上实现我们的业务。etcd 就提供了非常好的分布式并发原语，比如分布式互斥锁、分布式读写锁、Leader 选举，等等。所以，今天，我就以 etcd 为基础，给你介绍几种分布式并发原语。

## 2. etcd 单节点集群安装
etcd 集群的安装配置参考其[官方文档](https://www.bookstack.cn/read/etcd/documentation-dev-guide-local_cluster.md)。本地独立集群的安装如下:

```bash
yum install etcd

etcd -listen-client-urls=http://192.168.108.55:2379 --advertise-client-urls=http://192.168.108.55:2379
```

### 2.1 etcd go 模块安装

```bash
# 1. 安装 gRPC
go get -u google.golang.org/grpc
go get github.com/grpc-ecosystem/go-grpc-middleware
```

## 3. Leader 选举
Leader 选举常常用在主从架构的系统中。主从架构中的服务节点分为主（Leader、Master）和从（Follower、Slave）两种角色，实际节点包括 1 主 n 从，一共是 n+1 个节点。主节点常常执行写操作，从节点常常执行读操作，如果读写都在主节点，从节点只是提供一个备份功能的话，那么，主从架构就会退化成主备模式架构。

主从架构中最重要的是如何确定节点的角色，在同一时刻，系统中不能有两个主节点，否则，如果两个节点都是主，都执行写操作的话，就有可能出现数据不一致的情况，所以，我们需要一个选主机制，选择一个节点作为主节点，这个过程就是 Leader 选举。当主节点宕机或者是不可用时，就需要新一轮的选举，从其它的从节点中选择出一个节点，让它作为新主节点，宕机的原主节点恢复后，可以变为从节点，或者被摘掉。

接下来，我们将介绍业务开发中跟 Leader 选举相关的选举、查询、Leader 变动监控等功能。

### 3.1 选举
如果业务集群还没有主节点，或者主节点宕机了，就需要发起新一轮的选主操作，主要会用到 Campaign 和 Proclaim。如果你需要主节点放弃主的角色，让其它从节点有机会成为主节点，就可以调用 Resign 方法。
1. Campaign:
    - 作用：把一个节点选举为主节点，并且会设置一个值
    - 签名: `func (e *Election) Campaign(ctx context.Context, val string) error`
    - 说明: 这是一个阻塞方法，在调用它的时候会被阻塞，直到满足下面的三个条件之一，才会取消阻塞
        - 成功当选为主；
        - 此方法返回错误；
        - ctx 被取消
2. Proclaim:
    - 作用: 重新设置 Leader 的值，但是不会重新选主
    - 返回: 新值设置成功或者失败的信息
    - 签名: `func (e *Election) Proclaim(ctx context.Context, val string) error`
3. Resign:
    - 作用: 开始新一次选举
    - 返回: 新的选举成功或者失败的信息
    - 签名: `func (e *Election) Resign(ctx context.Context) (err error)`

### 3.2 查询
程序在启动的过程中，或者在运行的时候，还有可能需要查询当前的主节点是哪一个节点？主节点的值是什么？此外查询主节点以便把读写请求发往相应的主从节点上。etcd 提供了查询当前主几点的 Leader 的方法
1. Leader:
    - 作用：查询当前的主节点
    - 返回: 如果当前还没有 Leader，就返回一个错误
    - 签名: `func (e *Election) Leader(ctx context.Context) (*v3.GetResponse, error)`
2. Rev: 
    - 作用: 查询版本号信息
    - 说明: 每次主节点的变动都会生成一个新的版本号
    - 签名: `func (e *Election) Rev() int64`


### 3.3 监控
有了选举和查询方法，我们还需要一个监控方法。毕竟，如果主节点变化了，我们需要得到最新的主节点信息。我们可以通过 Observe 来监控主的变化：
- Observe
    - 作用: 监控主节点的变化
    - 签名: `func (e *Election) Observe(ctx context.Context) <-chan v3.GetResponse`
    - 返回: 一个 chan，显示主节点的变动信息，它不会返回主节点的全部历史变动信息，而是只返回最近的一条变动信息以及之后的变动信息。

### 3.4 使用示例

```go
package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"go.etcd.io/etcd/client/v3/concurrency"
	"go.etcd.io/etcd/clientv3"
)

var (
	nodeID    = flag.Int("id", 0, "node ID")
	addr      = flag.String("addr", "http://192.168.108.55:2379", "etcd address")
	electName = flag.String("name", "my-test-elect", "election name")
	count     int
)

func main() {
	endpoints := strings.Split(*addr, ",")
	cli, err := clientv3.New(clientv3.Config{Endpoints: endpoints})
	if err != nil {
		log.Fatal(err)
	}
	defer cli.Close()
	session, err := concurrency.NewSession(cli)
	defer session.Close()

	el := concurrency.NewElection(session, *electName)
	consolescanner := bufio.NewScanner(os.Stdin)
	for consolescanner.Scan() {
		action := consolescanner.Text()
		switch action {
		case "elect":
			go elect(el, *electName)
		case "proclaim":
			proclaim(el, *electName)
		case "resign":
			resign(el, *electName)
		case "watch":
			go watch(el, *electName)
		case "query":
			query(el, *electName)
		case "rev":
			rev(el, *electName)
		default:
			fmt.Println("unkonw error")
		}

	}
}

// 选主
func elect(e1 *concurrency.Election, electName string) {
	log.Println("acampaigning for ID:", *nodeID)
	// 调用Campaign方法选主,主的值为value-<主节点ID>-<count>
	if err := e1.Campaign(context.Background(), fmt.Sprintf("value-%d-%d", *nodeID, count)); err != nil {
		log.Println(err)
	}
	log.Println("campaigned for ID:", *nodeID)
	count++
}

// 为主设置新值
func proclaim(e1 *concurrency.Election, electName string) {
	log.Println("proclaiming for ID:", *nodeID)
	// 调用Proclaim方法设置新值,新值为value-<主节点ID>-<count>
	if err := e1.Proclaim(context.Background(), fmt.Sprintf("value-%d-%d", *nodeID, count)); err != nil {
		log.Println(err)
	}
	log.Println("proclaimed for ID:", *nodeID)
	count++
}

// 重新选主，有可能另外一个节点被选为了主
func resign(e1 *concurrency.Election, electName string) {
	log.Println("resigning for ID:", *nodeID)
	// 调用Resign重新选主
	if err := e1.Resign(context.TODO()); err != nil {
		log.Println(err)
	}
	log.Println("resigned for ID:", *nodeID)
}

// 查询主的信息
func query(e1 *concurrency.Election, electName string) {
	// 调用Leader返回主的信息，包括key和value等信息
	resp, err := e1.Leader(context.Background())
	if err != nil {
		log.Printf("failed to get the current leader: %v", err)
	}
	log.Println("current leader:", string(resp.Kvs[0].Key), string(resp.Kvs[0].Value))
}

// 可以直接查询主的rev信息
func rev(e1 *concurrency.Election, electName string) {
	rev := e1.Rev()
	log.Println("current rev:", rev)
}

// 监控主节点的变化
func watch(e1 *concurrency.Election, electName string) {
	ch := e1.Observe(context.TODO())

	log.Println("start to watch for ID:", *nodeID)
	for i := 0; i < 10; i++ {
		resp := <-ch
		log.Println("leader changed to", string(resp.Kvs[0].Key), string(resp.Kvs[0].Value))
	}
}

```

## 4. 互斥锁
前面说的互斥锁都是用来保护同一进程内的共享资源的，今天我们要重点学习下分布在不同机器中的不同进程内的 goroutine，如何利用分布式互斥锁来保护共享资源。

互斥锁的应用场景和主从架构的应用场景不太一样。使用互斥锁的不同节点是没有主从这样的角色的，所有的节点都是一样的，只不过在同一时刻，只允许其中的一个节点持有锁。

### 4.1 Locker
etcd 提供了一个简单的 Locker 原语，它类似于 Go 标准库中的 sync.Locker 接口，也提供了 Lock/UnLock 的机制：

```go
func NewLocker(s *Session, pfx string) sync.Locker
```

下面的代码是一个使用 Locker 并发原语的例子：

```go

package main

import (
    "flag"
    "log"
    "math/rand"
    "strings"
    "time"

    "github.com/coreos/etcd/clientv3"
    "github.com/coreos/etcd/clientv3/concurrency"
)

var (
    addr     = flag.String("addr", "http://127.0.0.1:2379", "etcd addresses")
    lockName = flag.String("name", "my-test-lock", "lock name")
)

func main() {
    flag.Parse()
    
    rand.Seed(time.Now().UnixNano())
    // etcd地址
    endpoints := strings.Split(*addr, ",")
    // 生成一个etcd client
    cli, err := clientv3.New(clientv3.Config{Endpoints: endpoints})
    if err != nil {
        log.Fatal(err)
    }
    defer cli.Close()
    useLock(cli) // 测试锁
}

func useLock(cli *clientv3.Client) {
    // 为锁生成session
    s1, err := concurrency.NewSession(cli)
    if err != nil {
        log.Fatal(err)
    }
    defer s1.Close()
    //得到一个分布式锁
    locker := concurrency.NewLocker(s1, *lockName)

    // 请求锁
    log.Println("acquiring lock")
    locker.Lock()
    log.Println("acquired lock")

    // 等待一段时间
    time.Sleep(time.Duration(rand.Intn(30)) * time.Second)
    locker.Unlock() // 释放锁

    log.Println("released lock")
}
```

### 4.2 Mutex
Locker 是基于 Mutex 实现的，只不过，Mutex 提供了查询 Mutex 的 key 的信息的功能

```go

func useMutex(cli *clientv3.Client) {
    // 为锁生成session
    s1, err := concurrency.NewSession(cli)
    if err != nil {
        log.Fatal(err)
    }
    defer s1.Close()
    m1 := concurrency.NewMutex(s1, *lockName)

    //在请求锁之前查询key
    log.Printf("before acquiring. key: %s", m1.Key())
    // 请求锁
    log.Println("acquiring lock")
    if err := m1.Lock(context.TODO()); err != nil {
        log.Fatal(err)
    }
    log.Printf("acquired lock. key: %s", m1.Key())

    //等待一段时间
    time.Sleep(time.Duration(rand.Intn(30)) * time.Second)

    // 释放锁
    if err := m1.Unlock(context.TODO()); err != nil {
        log.Fatal(err)
    }
    log.Println("released lock")
}
```

可以看到，Mutex 并没有实现 sync.Locker 接口，它的 Lock/Unlock 方法需要提供一个 context.Context 实例做参数，这也就意味着，在请求锁的时候，你可以设置超时时间，或者主动取消请求。

## 5. 读写锁
etcd 也提供了分布式的读写锁。不过，互斥锁 Mutex 是在 github.com/coreos/etcd/clientv3/concurrency 包中提供的，读写锁 RWMutex 却是在 github.com/coreos/etcd/contrib/recipes 包中提供的。

etcd 提供的分布式读写锁的功能和标准库的读写锁的功能是一样的。只不过，etcd 提供的读写锁，可以在分布式环境中的不同的节点使用。它提供的方法也和标准库中的读写锁的方法一致，分别提供了 RLock/RUnlock、Lock/Unlock 方法。

```go

package main


import (
    "bufio"
    "flag"
    "fmt"
    "log"
    "math/rand"
    "os"
    "strings"
    "time"

    "github.com/coreos/etcd/clientv3"
    "github.com/coreos/etcd/clientv3/concurrency"
    recipe "github.com/coreos/etcd/contrib/recipes"
)

var (
    addr     = flag.String("addr", "http://127.0.0.1:2379", "etcd addresses")
    lockName = flag.String("name", "my-test-lock", "lock name")
    action   = flag.String("rw", "w", "r means acquiring read lock, w means acquiring write lock")
)


func main() {
    flag.Parse()
    rand.Seed(time.Now().UnixNano())

    // 解析etcd地址
    endpoints := strings.Split(*addr, ",")

    // 创建etcd的client
    cli, err := clientv3.New(clientv3.Config{Endpoints: endpoints})
    if err != nil {
        log.Fatal(err)
    }
    defer cli.Close()
    // 创建session
    s1, err := concurrency.NewSession(cli)
    if err != nil {
        log.Fatal(err)
    }
    defer s1.Close()
    m1 := recipe.NewRWMutex(s1, *lockName)

    // 从命令行读取命令
    consolescanner := bufio.NewScanner(os.Stdin)
    for consolescanner.Scan() {
        action := consolescanner.Text()
        switch action {
        case "w": // 请求写锁
            testWriteLocker(m1)
        case "r": // 请求读锁
            testReadLocker(m1)
        default:
            fmt.Println("unknown action")
        }
    }
}

func testWriteLocker(m1 *recipe.RWMutex) {
    // 请求写锁
    log.Println("acquiring write lock")
    if err := m1.Lock(); err != nil {
        log.Fatal(err)
    }
    log.Println("acquired write lock")

    // 等待一段时间
    time.Sleep(time.Duration(rand.Intn(10)) * time.Second)

    // 释放写锁
    if err := m1.Unlock(); err != nil {
        log.Fatal(err)
    }
    log.Println("released write lock")
}

func testReadLocker(m1 *recipe.RWMutex) {
    // 请求读锁
    log.Println("acquiring read lock")
    if err := m1.RLock(); err != nil {
        log.Fatal(err)
    }
    log.Println("acquired read lock")

    // 等待一段时间
    time.Sleep(time.Duration(rand.Intn(10)) * time.Second)

    // 释放写锁
    if err := m1.RUnlock(); err != nil {
        log.Fatal(err)
    }
    log.Println("released read lock")
}
```

## 参考
本文内容摘录自:
1. [极客专栏-鸟叔的 Go 并发编程实战](https://time.geekbang.org/column/intro/100061801?tab=catalog)