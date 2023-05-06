---
weight: 1
title: "client-go 索引和缓存"
date: 2023-03-01T22:00:00+08:00
lastmod: 2023-03-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "client-go 索引和缓存"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---

## 1. Index 索引
clinet-go 使用的索引结构由如下几个对象构成:

```go
// IndexFunc knows how to compute the set of indexed values for an object.
type IndexFunc func(obj interface{}) ([]string, error)

// Indexers maps a name to an IndexFunc
type Indexers map[string]IndexFunc

// Index maps the indexed value to a set of keys in the store that match on that value
type Index map[string]sets.String

// Indices maps a name to an Index
type Indices map[string]Index
```
其中:
1. IndexFunc: 一个函数，输入是一个 kubernetes 资源对象，输出是一个字符串数组代表输入对象的索引值
2. Indexers: map，key 代表维度，value 是这个维度的索引计算函数
3. Index: 
	- map，key 代表某一维度下的索引值，value 是对象 id 的 set 集合
	- 对于以 namespace 维度建立的索引，Index={"default": {id1, id2}, "namespace1": {id3,id4}}
4. Indices: 
	- Index 的 map，key 是维度的标识
	- eg: {"namespace": Index, "user": Index}

对于 kubernetes 资源对象 obj 来说，其建立索引并存储的过程如下：
1. 确定建立索引的维度，比如 namespace，user
2. 在 Indices 查找维度对应的索引项 Index
3. 在 Indexers 查找索引计算函数 IndexFunc
4. 使用 IndexFunc 计算 obj 的索引值 I
4. 将 obj 添加到 Index[I] 的 set 中

```go
dimension = "namespace"
index = Indices[dimension]
indexFunc = Indexers[dimension]

indexValue = indexFunc(obj)
index[indexValue].set.add(obj)
```

## 2. 对象存储 Store
client-go 将对象实际保存在 Store 接口中。这个 Store 接口有多种实现，所有的 Store 的实现又依赖一个 ThreadSafeStore 接口。可以这么理解这两个接口的关系:
1. ThreadSafeStore:
	- 定义了对于资源增删改查的方法，例如 Add/Update/Delete/Get/List 等操作
	- 定义了对于资源进行索引相关的方法，例如 Index/IndexKeys/ByIndex 等系列操作
	- 接口的操作针对对象的 key 和对象本身
2. Store:
	- 只定义了对于资源增删改查的方法，例如 Add/Update/Delete/Get/List 
	- 接口的操作只是针对象本身
	- Store 是对 ThreadSafeStore 的更高一层的抽象，Store 的实现中包含 ThreadSafeStore 也包含如何获取对象的 key，这样就能用 key 通过 ThreadSafeStore 操作对象的 key
	- ThreadSafeStore 接口的操作需要针对资源对象以及对象的 key， 而 Store 接口有能力获取资源对象的 key

除了 Store client-go 还定义了一个 Indexer，这个 Indexer 继承了 Store 接口并提供了操作索引的方法。所以也可以把 ThreadSafeStore 看成对内实现，Store/ndexer 则是对外暴露的接口。

这三个接口与实现的 UML 类图如下:

![store](/images/k8s/k8s_code/store.png)

### 2.1 threadSafeMap
threadSafeMap 是 ThreadSafeStore 的实现，从 UML 类图可以看出，他同时也实现了 Store/ndexer 两个接口。

```go
type storeIndex struct {
	// indexers maps a name to an IndexFunc
	indexers Indexers
	// indices maps a name to an Index
	indices Indices
}

type threadSafeMap struct {
	lock  sync.RWMutex
	items map[string]interface{}

	// index implements the indexing functionality
	index *storeIndex
}
```

threadSafeMap:
1. items: 存储了资源对象的 key 和资源对象本身，这个 key 就是 obj 的 id
2. index: storeIndex 包含了前面介绍的 Indexers/Indices，用于实现索引操作

### 2.2 cache
cache 实现了 Store/ndexer 接口，从其定义可以看出，cache 在 ThreadSafeStore 的基础上添加了获取 kubernetes 资源对象 key 的函数。

```go
// KeyFunc knows how to make a key from an object. Implementations should be deterministic.
type KeyFunc func(obj interface{}) (string, error)

type cache struct {
	// cacheStorage bears the burden of thread safety for the cache
	cacheStorage ThreadSafeStore
	// keyFunc is used to make the key for objects stored in and retrieved from items, and
	// should be deterministic.
	keyFunc KeyFunc
}
```

cache 结构体创建的源码如下：

```go
// NewStore returns a Store implemented simply with a map and a lock.
func NewStore(keyFunc KeyFunc) Store {
	return &cache{
		cacheStorage: NewThreadSafeStore(Indexers{}, Indices{}),
		keyFunc:      keyFunc,
	}
}

// NewIndexer returns an Indexer implemented simply with a map and a lock.
func NewIndexer(keyFunc KeyFunc, indexers Indexers) Indexer {
	return &cache{
		cacheStorage: NewThreadSafeStore(indexers, Indices{}),
		keyFunc:      keyFunc,
	}
}
```
NewStore 方法和 NewIndexer 方法虽然实现上都是去创建上面介绍的 cache 类型对象，但本质上 NewStore 是返回 Store 类型来提供存储能力，而 NewIndexer 是返回 Indexer 类型来提供索引能力。

## 3. Queue
Queue 可以看做是 Store 的扩展，提供了按队列获取对象的方式。

![queue](/images/k8s/k8s_code/queue.png)

从 UML 类图可以看到:
1. Queue 接口继承了 Store 接口
2. DeltaFIFO 和 FIFO 是 Queue 的实现

### 3.1 Queue 接口
从 Queue 的接口定义可以看到，Queue 在 Store 的基础上添加了队列操作的 Pop 和 Add 方法。
```go
type Queue interface {
	Store
	Pop(PopProcessFunc) (interface{}, error)
	AddIfNotPresent(interface{}) error

	// HasSynced returns true if the first batch of keys have all been
	// popped.  The first batch of keys are those of the first Replace
	// operation if that happened before any Add, AddIfNotPresent,
	// Update, or Delete; otherwise the first batch is empty.
	HasSynced() bool

	// Close the queue
	Close()
}
```

### 3.2 FIFO
FIFO 是基于 kubernetes 资源对象的优先队列。

### 3.2 DeltaFIFO
DeltaFIFO 是基于 kubernetes 资源对象**增量操作**的优先队列。在介绍 DeltaFIFO 之前，我们首先要看看 client-go 是如何定义增量操作的。

#### Delta 
client-go 将增量操作定义在 Delta 结构体内:
1. DelteType: 代表针对资源对象的操作类型
2. Object: 资源对象本身

```go

//src/k8s.io/client-go/tools/cache/delta_fifo.go
type DeltaType string

type Delta struct {
  Type   DeltaType
  Object interface{}
}

type Deltas []Delta

const (
  Added   DeltaType = "Added"
  Updated DeltaType = "Updated"
  Deleted DeltaType = "Deleted"
  Replaced DeltaType = "Replaced"
  Sync DeltaType = "Sync"
)
```

#### DeltaFIFO 
DeltaFIFO 的定义如下:
1. items: 保存的是资源对象 key 到，针对改资源对象增量操作的 Deltas
2. queue: 按照接收到的资源对象，维护的先进先出队列

```go
type DeltaFIFO struct {
	// lock/cond protects access to 'items' and 'queue'.
	lock sync.RWMutex
	cond sync.Cond

	// `items` maps a key to a Deltas.
	// Each such Deltas has at least one Delta.
	items map[string]Deltas

	// `queue` maintains FIFO order of keys for consumption in Pop().
	// There are no duplicates in `queue`.
	// A key is in `queue` if and only if it is in `items`.
	queue []string

	// populated is true if the first batch of items inserted by Replace() has been populated
	// or Delete/Add/Update/AddIfNotPresent was called first.
	populated bool
	// initialPopulationCount is the number of items inserted by the first call of Replace()
	initialPopulationCount int

	// keyFunc is used to make the key used for queued item
	// insertion and retrieval, and should be deterministic.
	keyFunc KeyFunc

	// knownObjects list keys that are "known" --- affecting Delete(),
	// Replace(), and Resync()
	knownObjects KeyListerGetter

	// Used to indicate a queue is closed so a control loop can exit when a queue is empty.
	// Currently, not used to gate any of CRUD operations.
	closed bool

	// emitDeltaTypeReplaced is whether to emit the Replaced or Sync
	// DeltaType when Replace() is called (to preserve backwards compat).
	emitDeltaTypeReplaced bool
}
```