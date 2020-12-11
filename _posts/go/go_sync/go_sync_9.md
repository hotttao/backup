---
title: 9 线程安全的 map
date: 2019-02-09
categories:
    - Go
tags:
    - go并发编程
---
线程安全的 map
<!-- more -->

## 1. 线程安全的 map 概述
### 1.1 map 的基本使用

#### 键类型
Go 内建的 map 类型如下：

```go
map[K]V
```

其中，key 类型的 K 必须是可比较的（comparable），在 Go 语言中，bool、整数、浮点数、复数、字符串、指针、Channel、接口都是可比较的，包含可比较元素的 struct 和数组，这俩也是可比较的，而 slice、map、函数值都是不可比较的。通常情况下，我们会选择内建的基本类型，比如整数、字符串做 key 的类型，因为这样最方便。


这里有一点需要注意，如果使用 struct 类型做 key 其实是有坑的，因为如果 struct 的某个字段值修改了，查询 map 时无法获取它 add 进去的值，如下面的例子。如果要使用 struct 作为 key，我们要保证 struct 对象在逻辑上是不可变的，这样才会保证 map 的逻辑没有问题。

```go

type mapKey struct {
    key int
}

func main() {
    var m = make(map[mapKey]string)
    var key = mapKey{10}


    m[key] = "hello"
    fmt.Printf("m[key]=%s\n", m[key])


    // 修改key的字段的值后再次查询map，无法获取刚才add进去的值
    key.key = 100
    fmt.Printf("再次查询m[key]=%s\n", m[key])
}
```

#### 索引返回值

在 Go 中，`map[key]`函数返回结果可以是一个值，也可以是两个值。原因在于，如果获取一个不存在的 key 对应的值时，会返回零值。为了区分真正的零值和 key 不存在这两种情况，可以根据第二个返回值来区分

```go

func main() {
    var m = make(map[string]int)
    m["a"] = 0
    fmt.Printf("a=%d; b=%d\n", m["a"], m["b"])

    av, aexisted := m["a"]
    bv, bexisted := m["b"]
    fmt.Printf("a=%d, existed: %t; b=%d, existed: %t\n", av, aexisted, bv, bexisted)
}
```

#### 遍历无序

map 是无序的，如果我们想要保证遍历 map 时元素有序，可以使用辅助的数据结构，比如[orderedmap](https://github.com/elliotchance/orderedmap)。

#### 常见错误
map 最常犯的两个错误，就是未初始化和并发读写。

map 对象必须在使用之前初始化。如果不初始化就直接赋值的话，会出现 panic 异常。但是从一个 nil 的 map 对象中获取值不会 panic，而是会得到零值。map 作为一个 struct 字段的时候，就很容易忘记初始化了，这个要特别注意。

```go

func main() {
    var m map[int]int
    fmt.Println(m[100]) // 返回 0
    m[100] = 100 // panic
}
```

Go 内建的 map 对象不是线程（goroutine）安全的，并发读写的时候运行时会有检查，遇到并发问题就会导致 panic。解决方法就是实现一个线程安全的 map。


## 2. 线程安全 map 实现
线程安全 map 有多种实现方式:
1. 利用读写锁：map 对象的操作，分为读和写两类，其中，查询和遍历可以看做读操作，增加、修改和删除可以看做写操作。
2. 分片加锁：降低加锁的粒度，具有更高的并发性
3. sync.Map: 适用于特殊场景

如何选择线程安全的 map，建议通过性能测试来决定。

### 2.1 加读写锁的 map
```go

type RWMap struct { // 一个读写锁保护的线程安全的map
    sync.RWMutex // 读写锁保护下面的map字段
    m map[int]int
}
// 新建一个RWMap
func NewRWMap(n int) *RWMap {
    return &RWMap{
        m: make(map[int]int, n),
    }
}
func (m *RWMap) Get(k int) (int, bool) { //从map中读取一个值
    m.RLock()
    defer m.RUnlock()
    v, existed := m.m[k] // 在锁的保护下从map中读取
    return v, existed
}

func (m *RWMap) Set(k int, v int) { // 设置一个键值对
    m.Lock()              // 锁保护
    defer m.Unlock()
    m.m[k] = v
}

func (m *RWMap) Delete(k int) { //删除一个键
    m.Lock()                   // 锁保护
    defer m.Unlock()
    delete(m.m, k)
}

func (m *RWMap) Len() int { // map的长度
    m.RLock()   // 锁保护
    defer m.RUnlock()
    return len(m.m)
}

func (m *RWMap) Each(f func(k, v int) bool) { // 遍历map
    m.RLock()             //遍历期间一直持有读锁
    defer m.RUnlock()

    for k, v := range m.m {
        if !f(k, v) {
            return
        }
    }
}

```

## 2.2 分片加锁
虽然使用读写锁可以提供线程安全的 map，但是在大量并发读写的情况下，锁的竞争会非常激烈。在并发编程中，我们的一条原则就是尽量减少锁的使用。即尽量减少锁的粒度和锁的持有时间。你可以优化业务处理的代码，以此来减少锁的持有时间，比如将串行的操作变成并行的子任务执行。这是业务相关的优化，在线程安全 map 的实现上，重点是**如何减少锁的粒度**

减少锁的粒度常用的方法就是分片（Shard），将一把锁分成几把锁，每个锁控制一个分片。Go 比较知名的分片并发 map 的实现是[orcaman/concurrent-map](https://github.com/orcaman/concurrent-map)。其中 GetShard 是一个关键的方法，能够根据 key 计算出分片索引。

```go
var SHARD_COUNT = 32

// 分成SHARD_COUNT个分片的map
type ConcurrentMap []*ConcurrentMapShared

// 通过RWMutex保护的线程安全的分片，包含一个map
type ConcurrentMapShared struct {
items        map[string]interface{}
sync.RWMutex // Read Write mutex, guards access to internal map.
}

// 创建并发map
func New() ConcurrentMap {
m := make(ConcurrentMap, SHARD_COUNT)
for i := 0; i < SHARD_COUNT; i++ {
    m[i] = &ConcurrentMapShared{items: make(map[string]interface{})}
}
return m
}


// 根据key计算分片索引
func (m ConcurrentMap) GetShard(key string) *ConcurrentMapShared {
return m[uint(fnv32(key))%uint(SHARD_COUNT)]
}



func (m ConcurrentMap) Set(key string, value interface{}) {
    // 根据key计算出对应的分片
    shard := m.GetShard(key)
    shard.Lock() //对这个分片加锁，执行业务操作
    shard.items[key] = value
    shard.Unlock()
}

func (m ConcurrentMap) Get(key string) (interface{}, bool) {
    // 根据key计算出对应的分片
    shard := m.GetShard(key)
    shard.RLock()
    // 从这个分片读取key的值
    val, ok := shard.items[key]
    shard.RUnlock()
    return val, ok
}
```

### 2.3 sync.Map
Go 内建的 map 类型不是线程安全的，所以 Go 1.9 中增加了一个线程安全的 map，也就是 sync.Map。但是，这个 sync.Map 并不是用来替换内建的 map 类型的，它只能被应用在一些特殊的场景里。

官方的文档中指出，在以下两个场景中使用 sync.Map，会比使用 map+RWMutex 的方式，性能要好得多：
1. 只会增长的缓存系统中，一个 key 只写入一次而被读很多次；
2. 多个 goroutine 为不相交的键集读、写和重写键值对。

官方建议针对自己的场景做性能评测，如果确实能够显著提高性能，再使用 sync.Map。我们能用到 sync.Map 的场景确实不多。即便使用不多，也不妨碍我们去研究 sync.Map 的实现。

sync.Map 的实现有几个优化点，我们先列出来:
1. 空间换时间。通过冗余的两个数据结构（只读的 read 字段、可写的 dirty），来减少加锁对性能的影响。对只读字段（read）的操作不需要加锁。
2. 优先从 read 字段读取、更新、删除，因为对 read 字段的读取不需要锁。
3. 动态调整。miss 次数多了之后，将 dirty 数据提升为 read，避免总是从 dirty 中加锁读取。
4. double-checking。加锁之后先还要再检查 read 字段，确定真的不存在才操作 dirty 字段。延迟删除。删除一个键值只是打标记，只有在提升 dirty 字段为 read 字段的时候才清理删除的数据。




## 3. map 的扩展
还有一些扩展其它功能的 map 实现，比如带有过期功能的[timedmap](https://github.com/zekroTJA/timedmap)、使用红黑树实现的 key 有序的[treemap](https://godoc.org/github.com/emirpasic/gods/maps/treemap)等。