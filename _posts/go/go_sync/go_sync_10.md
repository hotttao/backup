---
title: 10 Pool
date: 2019-02-10
categories:
    - Go
tags:
    - go并发编程
---
Pool
<!-- more -->

## 1. Pool 概述
Go 是一个自动垃圾回收的编程语言，采用[三色并发标记算法](https://blog.golang.org/ismmkeynote)标记对象并回收。但是，如果你想使用 Go 开发一个高性能的应用程序的话，就必须考虑垃圾回收给性能带来的影响。对象池化， 可以有效地减少新对象的创建次数，是性能优化的重要方式。

Go 标准库中提供了一个通用的 Pool 数据结构，也就是 sync.Pool，我们使用它可以创建池化的对象。sync.Pool 有一个缺陷，就是它池化的对象可能会被垃圾回收掉，这对于数据库长连接等场景是不合适的。因此接下来我们将介绍:
1. sync.Pool 的使用、实现和采坑点
2. 其他 Pool 包括 TCP 连接池、数据库连接池
3. Worker Pool: goroutine pool，使用有限的 goroutine 资源去处理大量的业务数据

如果你发现程序中有一种 GC 耗时特别高，有大量的相同类型的临时对象，不断地被创建销毁，这时，你就可以考虑看看，是不是可以通过池化的手段重用这些对象。

### 1.1 sync.Pool 使用
sync.Pool 用来保存一组可独立访问的**临时**对象，临时两个字表明"它池化的对象会在未来的某个时候被毫无预兆地移除掉"。如果没有别的对象引用这个被移除的对象的话，这个被移除的对象就会被垃圾回收掉。

sync.Pool 有两个知识点需要记住:
1. sync.Pool 本身就是线程安全的，多个 goroutine 可以并发地调用它的方法存取对象；
2. sync.Pool 使用之后不可再复制使用

sync.Pool 只提供了三个对外方法:
1. New 字段: 
    - 类型为`func() interface{}`
    - 当 Get 方法从池中获取元素，没有更多空闲元素可返回时，就会调用 New 方法来创建新的元素。
    - 如果你没有设置 New 字段，没有更多的空闲元素可返回时，Get 方法将返回 nil，表明当前没有可用的元素
	- New 是可变的字段，这意味着可以在程序运行的时候改变创建元素的方法，但是没必要这么做
2.  Get 方法:
	- 调用这个方法，就会从 Pool取走一个元素(从 Pool 中移除)，并返回给调用者
	- 除了正常实例化的元素，Get 方法的返回值还可能会是一个 nil（Pool.New 字段没有设置，又没有空闲元素可以返回），使用时需要判断
3. Put 方法:
	- 用于将一个元素返还给 Pool，Pool 会把这个元素保存到池中，并且可以复用
	- 如果 Put 一个 nil 值，Pool 就会忽略这个值


```go
type Pool struct {
	noCopy noCopy

	local     unsafe.Pointer // local fixed-size per-P pool, actual type is [P]poolLocal
	localSize uintptr        // size of the local array

	victim     unsafe.Pointer // local from previous cycle
	victimSize uintptr        // size of victims array

	// New optionally specifies a function to generate
	// a value when Get would otherwise return nil.
	// It may not be changed concurrently with calls to Get.
	New func() interface{}
}

func (p *Pool) Put(x interface{}) {}
func (p *Pool) Get() interface{} {}
```

下面是 sync.Pool 实现的 buffer 池(缓冲池)。注意下面这段代码是有问题的，你一定不要将这段代码应用到实际的产品中，它可能会有内存泄漏的问题。

```go
import bytes

var buffers = sync.Pool{
	New: func() interface{} {
		return new(bytes.Buffer)
	}
}

func GetBuffer() *bytes.Buffer {
	return buffers.Get().(*bytes.Buffer)
}

func PutBuffer(* bytes.Buffer){
	buf.Reset()
	buffer.Put(buf)
}
```

## 2. Pool 实现
Go 1.13 之前的 sync.Pool 的实现有 2 大问题：
1. 每次 GC 都会回收创建的对象: 如果缓存元素数量太多，就会导致 STW 耗时变长；缓存元素都被回收后，会导致 Get 命中率下降，Get 方法不得不新创建很多对象。
2. 底层实现使用了 Mutex，对这个锁并发请求竞争激烈的时候，会导致性能的下降

在 Go 1.13 中，sync.Pool 做了大量的优化。优化的方式就是避免使用锁，同时将加锁的 queue 改成 lock-free 的 queue 的实现，给即将移除的元素再多一次“复活”的机会。sync.Pool 的数据结构如下图所示：

![Pool](/images/go/sync/Pool.jpg)

Pool 实现中:
1. 每次垃圾回收的时候，Pool 会把 victim 中的对象移除，然后把 local 的数据给 victim
2. victim 就像一个垃圾分拣站，里面的东西可能会被当做垃圾丢弃了，但是里面有用的东西也可能被捡回来重新使用
3. victim 中的元素如果被 Get 取走，他就会被重用；没有被 Get 取走，那么就会被移除掉，因为没有别人引用它的话，就会被垃圾回收掉

### 2.1 Pool 的垃圾回收
下面的代码是垃圾回收时 sync.Pool 的处理逻辑：

```go

func poolCleanup() {
    // 丢弃当前victim, STW所以不用加锁
    for _, p := range oldPools {
        p.victim = nil
        p.victimSize = 0
    }

    // 将local复制给victim, 并将原local置为nil
    for _, p := range allPools {
        p.victim = p.local
        p.victimSize = p.localSize
        p.local = nil
        p.localSize = 0
    }

    oldPools, allPools = allPools, nil
}
```

### 2.2 local
local 字段包含一个 poolLocalInternal 字段，并提供 CPU 缓存对齐，从而避免 false sharing。而 poolLocalInternal 也包含两个字段：private 和 shared。
1. private，代表一个缓存的元素，而且只能由相应的一个 P 存取。因为一个 P 同时只能执行一个 goroutine，所以不会有并发的问题。
2. shared，可以由任意的 P 访问，但是只有本地的 P 才能 pushHead/popHead，其它 P 可以 popTail，相当于只有一个本地的 P 作为生产者（Producer），多个 P 作为消费者（Consumer），它是使用一个 local-free 的 queue 列表实现的。

### 2.3 Get 方法
```go

func (p *Pool) Get() interface{} {
    // 把当前goroutine固定在当前的P上
    l, pid := p.pin()
    x := l.private // 1. 优先从local的private字段取，快速
    l.private = nil
    if x == nil {
        // 2. 从当前的local.shared弹出一个，注意是从head读取并移除
        x, _ = l.shared.popHead()
        if x == nil { // 3. 如果没有，则去偷一个
            x = p.getSlow(pid) 
        }
    }
    runtime_procUnpin()
    // 如果没有获取到，尝试使用New函数生成一个新的
    if x == nil && p.New != nil {
        x = p.New()
    }
    return x
}
```

这里的重点是 getSlow 方法，它首先要遍历所有的 local，尝试从它们的 shared 弹出一个元素。如果还没找到一个，那么，就开始对 victim 下手了。在 vintim 中查询可用元素的逻辑还是一样的，先从对应的 victim 的 private 查找，如果查不到，就再从其它 victim 的 shared 中查找。

```go

func (p *Pool) getSlow(pid int) interface{} {

    size := atomic.LoadUintptr(&p.localSize)
    locals := p.local                       
    // 从其它proc中尝试偷取一个元素
    for i := 0; i < int(size); i++ {
        l := indexLocal(locals, (pid+i+1)%int(size))
        if x, _ := l.shared.popTail(); x != nil {
            return x
        }
    }

    // 如果其它proc也没有可用元素，那么尝试从vintim中获取
    size = atomic.LoadUintptr(&p.victimSize)
    if uintptr(pid) >= size {
        return nil
    }
    locals = p.victim
    l := indexLocal(locals, pid)
    if x := l.private; x != nil { // 同样的逻辑，先从vintim中的local private获取
        l.private = nil
        return x
    }
    for i := 0; i < int(size); i++ { // 从vintim其它proc尝试偷取
        l := indexLocal(locals, (pid+i)%int(size))
        if x, _ := l.shared.popTail(); x != nil {
            return x
        }
    }

    // 如果victim中都没有，则把这个victim标记为空，以后的查找可以快速跳过了
    atomic.StoreUintptr(&p.victimSize, 0)

    return nil
}
```

这里没列出 pin 代码的实现，你只需要知道，pin 方法会将此 goroutine 固定在当前的 P 上，避免查找元素期间被其它的 P 执行。固定的好处就是查找元素期间直接得到跟这个 P 相关的 local。有一点需要注意的是，pin 方法在执行的时候，如果跟这个 P 相关的 local 还没有创建，或者运行时 P 的数量被修改了的话，就会新创建 local。

### 2.4 Put 方法

```go

func (p *Pool) Put(x interface{}) {
    if x == nil { // nil值直接丢弃
        return
    }
    l, _ := p.pin()
    if l.private == nil { // 如果本地private没有值，直接设置这个值即可
        l.private = x
        x = nil
    }
    if x != nil { // 否则加入到本地队列中
        l.shared.pushHead(x)
    }
    runtime_procUnpin()
}
```

Put 的逻辑相对简单，优先设置本地 private，如果 private 字段已经有值了，那么就把此元素 push 到本地队列中。

## 3. Pool 采坑点
使用 Once 有两个常见错误:分别是内存泄漏和内存浪费。

#### 3.1 内存泄漏
文章开始，我们用 sync.Pool 实现了一个 buffer pool，这个实现可能存在内存泄漏。取出来的 bytes.Buffer 在使用的时候，我们可以往这个元素中增加大量的 byte 数据，这会导致底层的 byte slice 的容量可能会变得很大。这个时候，即使 Reset 再放回到池子中，这些 byte slice 的容量不会改变，所占的空间依然很大。而且，因为 Pool 回收的机制，这些大的 Buffer 可能不被回收(被重复使用，但只使用了很小一部分)，而是会一直占用很大的空间，这属于内存泄漏的问题。

在使用 sync.Pool 回收 buffer 的时候，一定要检查回收的对象的大小。如果 buffer 太大，就不要回收了，否则就太浪费了。

### 3.2 内存浪费
除了内存泄漏以外，还有一种浪费的情况，就是池子中的 buffer 都比较大，但在实际使用的时候，很多时候只需要一个小的 buffer，这也是一种浪费现象。

要做到物尽其用，尽可能不浪费的话，我们可以将 buffer 池分成几层，比如分成 512byte，1k，2k，4k 的多层 buffer 池。获取 buffer 时根据需要，到所需大小的池子中获取 buffer 即可。在标准库 net/http/server.go中的代码中，就提供了 2K 和 4K 两个 writer 的池子。

YouTube 开源的知名项目 vitess 中提供了[bucketpool](https://github.com/vitessio/vitess/blob/master/go/bucketpool/bucketpool.go)的实现，它提供了更加通用的多层 buffer 池。你在使用的时候，只需要指定池子的最大和最小尺寸，vitess 就会自动计算出合适的池子数。而且，当你调用 Get 方法的时候，只需要传入你要获取的 buffer 的大小，就可以了。

```go
type Pool
    func New(minSize, maxSize int) *Pool
    func (p *Pool) Get(size int) *[]bytes
    func (p *Pool) Put(b *[]bytes)
```

## 4. buffer 的其他第三方库
除了这种分层的为了节省空间的 buffer 设计外，还有其它的一些第三方的库也会提供 buffer 池的功能:
1. [bytebufferpool](https://github.com/oxtoacart/bpool)
    - 基本功能和 sync.Pool 相同，它的底层也是使用 sync.Pool 实现的
    - 包括会检测最大的 buffer，超过最大尺寸的 buffer，就会被丢弃
    - 提供了校准（calibrate，用来动态调整创建元素的权重）的机制，可以“智能”地调整 Pool 的 defaultSize 和 maxSize
    - 一般来说，我们使用 buffer size 的场景比较固定，所用 buffer 的大小会集中在某个范围里。有了校准的特性，bytebufferpool 就能够偏重于创建这个范围大小的 buffer，从而节省空间。
2. [oxtoacart/bpool](https://github.com/valyala/bytebufferpool) 提供了以下几种类型的 buffer:
    - bpool.BufferPool： 
        - 提供一个固定元素数量的 buffer 池，元素类型是 bytes.Buffer
        - 如果超过这个数量，Put 的时候就丢弃
        - 如果池中的元素都被取光了，会新建一个返回
        - Put 回去的时候，不会检测 buffer 的大小
    - bpool.BytesPool：
        - 提供一个固定元素数量的 byte slice 池，元素类型是 byte slice
        - Put 回去的时候不检测 slice 的大小
    - bpool.SizedBufferPool： 
        - 提供一个固定元素数量的 buffer 池
        - 如果超过这个数量，Put 的时候就丢弃
        - 如果池中的元素都被取光了，会新建一个返回
        - Put 回去的时候，会检测 buffer 的大小，超过指定的大小的话，就会创建一个新的满足条件的 buffer 放回去

bpool 最大的特色就是能够保持池子中元素的数量，一旦 Put 的数量多于它的阈值，就会自动丢弃，而 sync.Pool 是一个没有限制的池子，只要 Put 就会收进去。bpool 是基于 Channel 实现的，不像 sync.Pool 为了提高性能而做了很多优化，所以，在性能上比不过 sync.Pool。

## 5. 连接池
Pool 的另一个很常用的一个场景就是保持 TCP 的连接。我们很少会使用 sync.Pool 去池化连接对象，原因就在于，sync.Pool 会无通知地在某个时候就把连接移除垃圾回收掉了，而我们的场景是需要长久保持这个连接，所以，我们一般会使用其它方法来池化连接，包括:
1. 标准库中的 http client 池
2. TCP 连接池
3. 数据库连接池
4. Memcached Client 连接池
5. Worker Pool

### 5.1 标准库中的 http client 池
标准库的 http.Client 是一个 http client 的库，可以用它来访问 web 服务器。http.Client 实现连接池的代码是在 Transport 类型中，它使用 idleConn 保存持久化的可重用的长连接：


![http.Client](/images/go/sync/http_client.png)

### 5.2 TCP 连接池

最常用的一个 TCP 连接池是 fatih 开发的[fatih/pool](https://github.com/fatih/pool)。

```go

// 工厂模式，提供创建连接的工厂方法
factory    := func() (net.Conn, error) { return net.Dial("tcp", "127.0.0.1:4000") }

// 创建一个tcp池，提供初始容量和最大容量以及工厂方法
p, err := pool.NewChannelPool(5, 30, factory)

// 获取一个连接
conn, err := p.Get()

// Close并不会真正关闭这个连接，而是把它放回池子，所以你不必显式地Put这个对象到池子中
conn.Close()

// 通过调用MarkUnusable, Close的时候就会真正关闭底层的tcp的连接了
if pc, ok := conn.(*pool.PoolConn); ok {
  pc.MarkUnusable()
  pc.Close()
}

// 关闭池子就会关闭=池子中的所有的tcp连接
p.Close()

// 当前池子中的连接的数量
current := p.Len()
```

虽说是 TCP，但是它管理的是更通用的 net.Conn，不局限于 TCP 连接。它通过把 net.Conn 包装成 PoolConn，实现了拦截 net.Conn 的 Close 方法，避免了真正地关闭底层连接，而是把这个连接放回到池中。

```go

    type PoolConn struct {
    net.Conn
    mu       sync.RWMutex
    c        *channelPool
    unusable bool
  }
  
    //拦截Close
  func (p *PoolConn) Close() error {
    p.mu.RLock()
    defer p.mu.RUnlock()
  
    if p.unusable {
      if p.Conn != nil {
        return p.Conn.Close()
      }
      return nil
    }
    return p.c.put(p.Conn)
  }
```

它的 Pool 是通过 Channel 实现的，空闲的连接放入到 Channel 中，这也是 Channel 的一个应用场景：

```go

type channelPool struct {
    // 存储连接池的channel
    mu    sync.RWMutex
    conns chan net.Conn
  

    // net.Conn 的产生器
    factory Factory
  }
```

### 5.3 数据库连接池
标准库 sql.DB 还提供了一个通用的数据库的连接池，通过 MaxOpenConns 和 MaxIdleConns 控制最大的连接数和最大的 idle 的连接数。默认的 MaxIdleConns 是 2，这个数对于数据库相关的应用来说太小了，我们一般都会调整它。

```go
type DB
    func Open(driverName, dataSourceName string) (*DB, error)
    func OpenDB(c driver.Connector) *DB
    func (db *DB) Begin() (*Tx, error)
    func (db *DB) BeginTx(ctx context.Context, opts *TxOptions) (*Tx, error)
    func (db *DB) Close() error
    func (db *DB) Conn(ctx context.Context) (*Conn, error)
    func (db *DB) Driver() driver.Driver
    func (db *DB) Exec(query string, args ...interface{}) (Result, error)
    func (db *DB) ExecContext(ctx context.Context, query string, args ...interface{}) (Result, error)
    func (db *DB) Ping() error
    func (db *DB) PingContext(ctx context.Context) error
    func (db *DB) Prepare(query string) (*Stmt, error)
    func (db *DB) PrepareContext(ctx context.Context, query string) (*Stmt, error)
    func (db *DB) Query(query string, args ...interface{}) (*Rows, error)
    func (db *DB) QueryContext(ctx context.Context, query string, args ...interface{}) (*Rows, error)
    func (db *DB) QueryRow(query string, args ...interface{}) *Row
    func (db *DB) QueryRowContext(ctx context.Context, query string, args ...interface{}) *Row
    func (db *DB) SetConnMaxIdleTime(d time.Duration)
    func (db *DB) SetConnMaxLifetime(d time.Duration)
    func (db *DB) SetMaxIdleConns(n int)
    func (db *DB) SetMaxOpenConns(n int)
    func (db *DB) Stats() DBStats
```

DB 的 [freeConn](https://github.com/golang/go/blob/4fc3896e7933e31822caa50e024d4e139befc75f/src/database/sql/sql.go#L1196) 保存了 idle 的连接，这样，当我们获取数据库连接的时候，它就会优先尝试从 freeConn 获取已有的连接（conn）。

![sql.DB](/images/go/sync/sql_db.png)

### 5.4 Memcached Client 连接池
Brad Fitzpatrick 是知名缓存库 Memcached 的原作者，[gomemcache](https://github.com/bradfitz/gomemcache)是他使用 Go 开发的 Memchaced 的客户端，其中也用了连接池。


gomemcache Client 有一个 freeconn 的字段，用来保存空闲的连接。当一个请求使用完之后，它会调用 putFreeConn 放回到池子中，请求的时候，调用 getFreeConn 优先查询 freeConn 中是否有可用的连接。它采用 Mutex+Slice 实现 Pool：

```go

   // 放回一个待重用的连接
   func (c *Client) putFreeConn(addr net.Addr, cn *conn) {
    c.lk.Lock()
    defer c.lk.Unlock()
    if c.freeconn == nil { // 如果对象为空，创建一个map对象
      c.freeconn = make(map[string][]*conn)
    }
    freelist := c.freeconn[addr.String()] //得到此地址的连接列表
    if len(freelist) >= c.maxIdleConns() {//如果连接已满,关闭，不再放入
      cn.nc.Close()
      return
    }
    c.freeconn[addr.String()] = append(freelist, cn) // 加入到空闲列表中
  }
  
    // 得到一个空闲连接
  func (c *Client) getFreeConn(addr net.Addr) (cn *conn, ok bool) {
    c.lk.Lock()
    defer c.lk.Unlock()
    if c.freeconn == nil { 
      return nil, false
    }
    freelist, ok := c.freeconn[addr.String()]
    if !ok || len(freelist) == 0 { // 没有此地址的空闲列表，或者列表为空
      return nil, false
    }
    cn = freelist[len(freelist)-1] // 取出尾部的空闲连接
    c.freeconn[addr.String()] = freelist[:len(freelist)-1]
    return cn, true
  }

```

### 5.4 Worker Pool
goroutine 是一个很轻量级的“纤程”，一个 goroutine 初始的栈大小是 2048 个字节，并且在需要的时候可以扩展到 1GB([不同架构的配置](https://github.com/golang/go/blob/f296b7a6f045325a230f77e9bda1470b1270f817/src/runtime/proc.go#L120))。

所以，大量的 goroutine 还是很耗资源的。同时，大量的 goroutine 对于调度和垃圾回收的耗时还是会有影响的，因此，goroutine 并不是越多越好。特别是在网络请求处理中，我们需要一个 Worker pool，即 goroutine 的池。由这一组 Worker 去处理连接，比如 [fasthttp](https://github.com/valyala/fasthttp/blob/9f11af296864153ee45341d3f2fe0f5178fd6210/workerpool.go#L16) 中的Worker Pool。

大部分的 Worker Pool 都是通过 Channel 来缓存任务的，因为 Channel 能够比较方便地实现并发的保护，有的是多个 Worker 共享同一个任务 Channel，有些是每个 Worker 都有一个独立的 Channel。

下面三款比较常用的 Worker Pool 库:
1. [gammazero/workerpool](https://godoc.org/github.com/gammazero/workerpool)：gammazero/workerpool 可以无限制地提交任务，提供了更便利的 Submit 和 SubmitWait 方法提交任务，还可以提供当前的 worker 数和任务数以及关闭 Pool 的功能。
2. [ivpusic/grpool](https://godoc.org/github.com/ivpusic/grpool)：grpool 创建 Pool 的时候需要提供 Worker 的数量和等待执行的任务的最大数量，任务的提交是直接往 Channel 放入任务。
3. [dpaks/goworkers](https://godoc.org/github.com/dpaks/goworkers)：dpaks/goworkers 提供了更便利的 Submi 方法提交任务以及 Worker 数、任务数等查询方法、关闭 Pool 的方法。它的任务的执行结果需要在 ResultChan 和 ErrChan 中去获取，没有提供阻塞的方法，但是它可以在初始化的时候设置 Worker 的数量和任务数。

类似的 Worker Pool 的实现非常多，比如还有[panjf2000/ants](https://github.com/panjf2000/ants)、[Jeffail/tunny](https://github.com/Jeffail/tunny) 、[benmanns/goworker](https://github.com/benmanns/goworker)、[go-playground/pool](https://github.com/go-playground/pool)、[Sherifabdlnaby/gpool](https://github.com/Sherifabdlnaby/gpool)等第三方库。[pond](https://github.com/alitto/pond)也是一个非常不错的 Worker Pool，关注度目前不是很高，但是功能非常齐全。

