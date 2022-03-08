---
weight: 4
title: "线程安全的 map"
date: 2021-05-08T22:00:00+08:00
lastmod: 2021-05-08T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "线程安全的 map"
featuredImage: 

tags: ["go 并发"]
categories: ["Go"]

lightgallery: true

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

如何选择线程安全的 map，建议通过性能测试来决定。sync.Map 甚至其他并发 map 的实现存在的原因是在某些特殊场景下，**通过特殊的优化来降低锁的粒度，从而调高并发度**。

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
虽然使用读写锁可以提供线程安全的 map，但是在大量并发读写的情况下，锁的竞争会非常激烈。在并发编程中，我们的一条原则就是尽量减少锁的使用。即**尽量减少锁的粒度和锁的持有时间**。你可以优化业务处理的代码，以此来减少锁的持有时间，比如将串行的操作变成并行的子任务执行。这是业务相关的优化，在线程安全 map 的实现上，重点是**如何减少锁的粒度**

**减少锁的粒度常用的方法就是分片（Shard），将一把锁分成几把锁，每个锁控制一个分片**。Go 比较知名的分片并发 map 的实现是[orcaman/concurrent-map](https://github.com/orcaman/concurrent-map)。其中 GetShard 是一个关键的方法，能够根据 key 计算出分片索引。

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
4. double-checking。加锁之后先还要再检查 read 字段，确定真的不存在才操作 dirty 字段。
5. 延迟删除。删除一个键值只是打标记，只有在提升 dirty 字段为 read 字段的时候才清理删除的数据。

#### 个人理解
锁的性能优化，核心就如下几个点:
1. 降低加锁的粒度
2. 通过 lock-free(核心就是原子操作)，降低加锁的频率和次数
3. 合并需要锁的操作，本质上也是降低加锁的次数

对应到 sync.Map 就是:
1. 通过分离 read 和 dirty，read 字段上面的读取操作大多数都是原子操作降低了加锁的频率
2. 延迟删除，合并需要锁的操作

下面我们就来看看 sync.Map 的设计与实现

#### sync.Map 数据结构
```go

type Map struct {
    mu Mutex
    // 基本上你可以把它看成一个安全的只读的map
    // 它包含的元素其实也是通过原子操作更新的，但是已删除的entry就需要加锁操作了
    read atomic.Value // readOnly

    // 包含需要加锁才能访问的元素
    // 包括所有在read字段中但未被expunged（删除）的元素以及新加的元素
    dirty map[interface{}]*entry

    // 记录从read中读取miss的次数，一旦miss数和dirty长度一样了，就会把dirty提升为read，并把dirty置空
    misses int
}

type readOnly struct {
    m       map[interface{}]*entry
    amended bool // 当dirty中包含read没有的数据时为true，比如新增一条数据
}

// expunged是用来标识此项已经删掉的指针
// 当map中的一个项目被删除了，只是把它的值标记为expunged，以后才有机会真正删除此项
var expunged = unsafe.Pointer(new(interface{}))

// entry代表一个值
type entry struct {
    p unsafe.Pointer // *interface{}
}

func (e *entry) load() (value interface{}, ok bool) {
	p := atomic.LoadPointer(&e.p)
	if p == nil || p == expunged {
		return nil, false
	}
	return *(*interface{})(p), true
}
```

通过 [go doc](https://pkg.go.dev/sync) 可以轻松看到 sync.Map 具有如下方法:

```go
type Map
    func (m *Map) Delete(key interface{})
    func (m *Map) Load(key interface{}) (value interface{}, ok bool)
    func (m *Map) LoadAndDelete(key interface{}) (value interface{}, loaded bool)
    func (m *Map) LoadOrStore(key, value interface{}) (actual interface{}, loaded bool)
    func (m *Map) Range(f func(key, value interface{}) bool)
    func (m *Map) Store(key, value interface{})
```

Store、Load 和 Delete 这三个核心函数的操作都是先从 read 字段中处理的，因为读取 read 字段的时候不用加锁。

#### Store 方法
```go

func (m *Map) Store(key, value interface{}) {
    read, _ := m.read.Load().(readOnly)
    // 如果read字段包含这个项，说明是更新，cas更新项目的值即可
    if e, ok := read.m[key]; ok && e.tryStore(&value) {
        return
    }

    // read中不存在，或者cas更新失败，就需要加锁访问dirty了
    m.mu.Lock()
    read, _ = m.read.Load().(readOnly)
    if e, ok := read.m[key]; ok { // 双检查，看看read是否已经存在了
        if e.unexpungeLocked() {
            // 此项目先前已经被删除了，通过将它的值设置为nil，标记为unexpunged
            // e.unexpungeLocked 执行后，read 和 dirty 中 e.p 的指向就不一样了，
            // read 中 e.p 已经被置为 nil，所以这里需要设置 dirty
            m.dirty[key] = e 
        }
        e.storeLocked(&value) // 更新
    } else if e, ok := m.dirty[key]; ok { // 如果dirty中有此项
        e.storeLocked(&value) // 直接更新
    } else { // 否则就是一个新的key
        if !read.amended { //如果dirty为nil
            // 需要创建dirty对象，并且标记read的amended为true,
            // 说明有元素它不包含而dirty包含
            m.dirtyLocked()
            m.read.Store(readOnly{m: read.m, amended: true})
        }
        m.dirty[key] = newEntry(value) //将新值增加到dirty对象中
    }
    m.mu.Unlock()
}

// 新加的元素需要放入到 dirty 中，如果 dirty 为 nil，那么需要从 read 字段中复制出来一个 dirty 对象：
func (m *Map) dirtyLocked() {
	if m.dirty != nil {
		return
	}

	read, _ := m.read.Load().(readOnly)
	m.dirty = make(map[interface{}]*entry, len(read.m))
	for k, e := range read.m {
		if !e.tryExpungeLocked() {
			m.dirty[k] = e
		}
	}
}
// unexpungeLocked ensures that the entry is not marked as expunged.
//
// If the entry was previously expunged, it must be added to the dirty map
// before m.mu is unlocked.
func (e *entry) unexpungeLocked() (wasExpunged bool) {
	return atomic.CompareAndSwapPointer(&e.p, expunged, nil)
}

// The entry must be known not to be expunged.
func (e *entry) storeLocked(i *interface{}) {
	atomic.StorePointer(&e.p, unsafe.Pointer(i))
}

func (e *entry) tryStore(i *interface{}) bool {
	for {
		p := atomic.LoadPointer(&e.p)
		if p == expunged {
			return false
		}
		if atomic.CompareAndSwapPointer(&e.p, p, unsafe.Pointer(i)) {
			return true
		}
	}
}
```
在 Store 方法的实现中:
1. 如果 dirty 字段非 nil 的话，map 的 read 字段和 dirty 字段会包含相同的非 expunged 的项，所以如果通过 read 字段更改了这个项的值，从 dirty 字段中也会读取到这个项的新值，因为本来它们指向的就是同一个地址。
2. sync.Map 可能是更新也可能是保存，只有在更新的是已存在的未被删除的元素，不会用到锁。其他的，需要更新（重用）删除的对象、更新还未提升的 dirty 中的对象，或者新增加元素的时候就会使用到了锁。从这一点来看，sync.Map 适合那些只会增长的缓存系统，可以进行更新，但是不要删除，并且不要频繁地增加新元素。

#### Load 方法
```go

func (m *Map) Load(key interface{}) (value interface{}, ok bool) {
    // 首先从read处理
    read, _ := m.read.Load().(readOnly)
    e, ok := read.m[key]
    if !ok && read.amended { // 如果不存在并且dirty不为nil(有新的元素)
        m.mu.Lock()
        // 双检查，看看read中现在是否存在此key
        read, _ = m.read.Load().(readOnly)
        e, ok = read.m[key]
        if !ok && read.amended {//依然不存在，并且dirty不为nil
            e, ok = m.dirty[key]// 从dirty中读取
            // 不管dirty中存不存在，miss数都加1
            m.missLocked()
        }
        m.mu.Unlock()
    }
    if !ok {
        return nil, false
    }
    return e.load() //返回读取的对象，e既可能是从read中获得的，也可能是从dirty中获得的
}


func (m *Map) missLocked() {
    m.misses++ // misses计数加一
    if m.misses < len(m.dirty) { // 如果没达到阈值(dirty字段的长度),返回
        return
    }
    m.read.Store(readOnly{m: m.dirty}) //把dirty字段的内存提升为read字段
    m.dirty = nil // 清空dirty
    m.misses = 0  // misses数重置为0
}
```

在 Load 方法的实现中:
1. 只有在读取已经存在的键时，才有可能不加锁
2. missLocked 增加 miss 的时候，如果 miss 数等于 dirty 长度，会将 dirty 提升为 read，并将 dirty 置空。

#### Delete 方法
```go

func (m *Map) LoadAndDelete(key interface{}) (value interface{}, loaded bool) {
    read, _ := m.read.Load().(readOnly)
    e, ok := read.m[key]
    if !ok && read.amended {
        m.mu.Lock()
        // 双检查
        read, _ = m.read.Load().(readOnly)
        e, ok = read.m[key]
        if !ok && read.amended {
            e, ok = m.dirty[key]
            // 这一行长坤在1.15中实现的时候忘记加上了，导致在特殊的场景下有些key总是没有被回收
            delete(m.dirty, key)
            // miss数加1
            m.missLocked()
        }
        m.mu.Unlock()
    }
    if ok {
        return e.delete()
    }
    return nil, false
}

func (m *Map) Delete(key interface{}) {
    m.LoadAndDelete(key)
}
func (e *entry) delete() (value interface{}, ok bool) {
    for {
        p := atomic.LoadPointer(&e.p)
        if p == nil || p == expunged {
            return nil, false
        }
        if atomic.CompareAndSwapPointer(&e.p, p, nil) {
            return *(*interface{})(p), true
        }
    }
}
```
在 LoadDelete 方法的实现中:
1. 如果项目存在就删除（将它的值标记为 nil）

#### 其他方法
最后，sync.map 还有一些 LoadAndDelete、LoadOrStore、Range 等辅助方法，但是没有 Len 这样查询 sync.Map 的包含项目数量的方法，并且官方也不准备提供。如果你想得到 sync.Map 的项目数量的话，你可能不得不通过 Range 逐个计数。

## 3. map 的扩展
还有一些扩展其它功能的 map 实现，比如
1. 带有过期功能的[timedmap](https://github.com/zekroTJA/timedmap)
2. 使用红黑树实现的 key 有序的[treemap](https://godoc.org/github.com/emirpasic/gods/maps/treemap)等。

## 参考
本文内容摘录自:
1. [极客专栏-鸟叔的 Go 并发编程实战](https://time.geekbang.org/column/intro/100061801?tab=catalog)