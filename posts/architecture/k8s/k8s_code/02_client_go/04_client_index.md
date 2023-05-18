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
index[indexValue].set.add(obj_key)
```

![index](/images/k8s/k8s_code/index.png)

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

除了 Store client-go 还定义了一个 Indexer，这个 Indexer 继承了 Store 接口并提供了操作索引的方法。所以也可以把 ThreadSafeStore 看成对内实现，Store/indexer 则是对外暴露的接口。

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
1. items: 存储了资源对象的 id 和资源对象本身的映射
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

#### DeltaFIFO 定义
DeltaFIFO 的定义如下:

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

DeltaFIFO 中，最核心的是 items 和 queue
1. items: 保存的是资源对象 id 到资源对象增量操作 Deltas 的映射
2. queue: 按照接收到的资源对象，维护的先进先出队列

![delta_fifo](/images/k8s/k8s_code/delta_fifo.png)

#### DeltaFIFO 初始化
从代码实现可以看到: 
1. 结构体 DeltaFIFOOptions 封装定义了创建 DeltaFIFO 对象所需要的一些关键参数，例如 KeyFunc 等。
2. 对于没有指定 KeyFunc 的时候，默认会使用 MetaNamespaceKeyFunc 来作为资源对象的 key 生成函数。
3. 在 MetaNamespaceKeyFunc 的定义中，如果资源是基于 namespace 的，那么 key 为 `${namespace}/${resource-name}` 。如果资源对象不是基于 namespace 的，那么 key 的值为 `${resource-name}`。

```go
//src/k8s.io/client-go/tools/cache/delta_fifo.go
type DeltaFIFOOptions struct {

  KeyFunction KeyFunc

  KnownObjects KeyListerGetter

  EmitDeltaTypeReplaced bool
}

func NewDeltaFIFO(keyFunc KeyFunc, knownObjects KeyListerGetter) *DeltaFIFO {
  return NewDeltaFIFOWithOptions(DeltaFIFOOptions{
    KeyFunction:  keyFunc,
    KnownObjects: knownObjects,
  })
}

func NewDeltaFIFOWithOptions(opts DeltaFIFOOptions) *DeltaFIFO {
  if opts.KeyFunction == nil {
    opts.KeyFunction = MetaNamespaceKeyFunc
  }

  f := &DeltaFIFO{
    items:        map[string]Deltas{},
    queue:        []string{},
    keyFunc:      opts.KeyFunction,
    knownObjects: opts.KnownObjects,

    emitDeltaTypeReplaced: opts.EmitDeltaTypeReplaced,
  }
  f.cond.L = &f.lock
  return f
}

// k8s.io/client-go/tools/cache/store.go
func MetaNamespaceKeyFunc(obj interface{}) (string, error) {
  if key, ok := obj.(ExplicitKey); ok {
    return string(key), nil
  }
  meta, err := meta.Accessor(obj)
  if err != nil {
    return "", fmt.Errorf("object has no meta: %v", err)
  }
  if len(meta.GetNamespace()) > 0 {
    return meta.GetNamespace() + "/" + meta.GetName(), nil
  }
  return meta.GetName(), nil
}
```

#### DeltaFIFO 增删改
DeltaFIFO 增删改，最终调用的是 queueActionLocked 方法，所以我们直接看这个方法的实现:

```go
// queueActionLocked appends to the delta list for the object.
// Caller must lock first.
func (f *DeltaFIFO) queueActionLocked(actionType DeltaType, obj interface{}) error {
   id, err := f.KeyOf(obj) // 计算这个对象的 key
   if err != nil {
      return KeyError{obj, err}
   }
   oldDeltas := f.items[id] // 从 items map 里获取当前的 Deltas
   newDeltas := append(oldDeltas, Delta{actionType, obj}) // 构造一个 Delta，添加到 Deltas 中，也就是 []Delta 里
   newDeltas = dedupDeltas(newDeltas) // 如果最近个 Delta 是重复的，则保留后一个；目前版本只处理的 Deleted 重复场景

   if len(newDeltas) > 0 { // 理论上 newDeltas 长度一定大于0
      if _, exists := f.items[id]; !exists {
         f.queue = append(f.queue, id) // 如果 id 不存在，则在队列里添加
      }
      f.items[id] = newDeltas // 如果 id 已经存在，则只更新 items map 里对应这个 key 的 Deltas
      f.cond.Broadcast()
   } else { // 理论上这里执行不到
      if oldDeltas == nil {
         klog.Errorf("Impossible dedupDeltas for id=%q: oldDeltas=%#+v, obj=%#+v; ignoring", id, oldDeltas, obj)
         return nil
      }
      klog.Errorf("Impossible dedupDeltas for id=%q: oldDeltas=%#+v, obj=%#+v; breaking invariant by storing empty Deltas", id, oldDeltas, obj)
      f.items[id] = newDeltas
      return fmt.Errorf("Impossible dedupDeltas for id=%q: oldDeltas=%#+v, obj=%#+v; broke DeltaFIFO invariant by storing empty Deltas", id, oldDeltas, obj)
   }
   return nil
}
```

#### DeltaFIFO 优先级队列实现
DeltaFIFO 优先级队列的核心是 Pop 方法:

```go
type PopProcessFunc func(obj interface{}, isInInitialList bool) error

func (f *DeltaFIFO) Pop(process PopProcessFunc) (interface{}, error) {
   f.lock.Lock()
   defer f.lock.Unlock()
   for {
      for len(f.queue) == 0 { // 如果为空则进入这个循环
         if f.closed { // 队列关闭则直接返回
            return nil, ErrFIFOClosed
         }
         f.cond.Wait() // 等待
      }
	  isInInitialList := !f.hasSynced_locked()
      id := f.queue[0] // queue 里放的是 key
      f.queue = f.queue[1:] // queue 中删除这个 key
      depth := len(f.queue)
      if f.initialPopulationCount > 0 { // 第一次调用 Replace() 插入到元素数量
         f.initialPopulationCount--
      }
      item, ok := f.items[id] // 从 items map[string]Deltas 中获取一个 Deltas
      if !ok {
         klog.Errorf("Inconceivable! %q was in f.queue but not f.items; ignoring.", id)
         continue
      }
      delete(f.items, id) // items map 中也删除这个元素
      // 当队列长度超过 10 并且处理一个元素时间超过 0.1 s 时打印日志
      if depth > 10 {
         trace := utiltrace.New("DeltaFIFO Pop Process",
            utiltrace.Field{Key: "ID", Value: id},
            utiltrace.Field{Key: "Depth", Value: depth},
            utiltrace.Field{Key: "Reason", Value: "slow event handlers blocking the queue"})
         defer trace.LogIfLong(100 * time.Millisecond)
      }
      err := process(item, isInInitialList) // 丢给 PopProcessFunc 处理
      if e, ok := err.(ErrRequeue); ok { // 如果需要 requeue 则加回到队列里
         f.addIfNotPresent(id, item)
         err = e.Err
      }
      // 返回这个 Deltas 和错误信息
      return item, err
   }
}
```

从 Pop 的实现中可以看到:
1. Pop 在队列为空时会阻塞
2. Pop 过程会先从队列中删除一个元素，所以如果处理失败了需要通过 addIfNotPresent() 方法将这个元素加回到队列中。
3. Pop 方法会从 items 中删除元素，这意味着 DeltaFIFO 只会保存增强元素，不会保存所有元素，要想检索所有缓存对象，需要通过 knownObjects 属性。这个后面降到 informer 会详述。

#### DeltaFIFO Replace 方法
Replace() 方法可以简单理解成传递一个新的 []Deltas 过来，如果当前 DeltaFIFO 里已经有这些元素，则追加一个 Sync/Replace 动作，反之 DeltaFIFO 里多出来的 Deltas 则可能是与 apiserver 失联导致实际已经删除，但是删除动作没有 watch 到的那些对象，所以直接追加一个 Deleted 的 Delta；

```go
func (f *DeltaFIFO) Replace(list []interface{}, _ string) error {
	f.lock.Lock()
	defer f.lock.Unlock()
	keys := make(sets.String, len(list))

	// keep backwards compat for old clients
	action := Sync
	if f.emitDeltaTypeReplaced {
		action = Replaced
	}

	// Add Sync/Replaced action for each new item.
	for _, item := range list {
		key, err := f.KeyOf(item)
		if err != nil {
			return KeyError{item, err}
		}
		keys.Insert(key)
		if err := f.queueActionLocked(action, item); err != nil {
			return fmt.Errorf("couldn't enqueue object: %v", err)
		}
	}

	// Do deletion detection against objects in the queue
	queuedDeletions := 0
	for k, oldItem := range f.items {
		if keys.Has(k) {
			continue
		}
		// Delete pre-existing items not in the new list.
		// This could happen if watch deletion event was missed while
		// disconnected from apiserver.
		var deletedObj interface{}
		if n := oldItem.Newest(); n != nil {
			deletedObj = n.Object

			// if the previous object is a DeletedFinalStateUnknown, we have to extract the actual Object
			if d, ok := deletedObj.(DeletedFinalStateUnknown); ok {
				deletedObj = d.Obj
			}
		}
		queuedDeletions++
		if err := f.queueActionLocked(Deleted, DeletedFinalStateUnknown{k, deletedObj}); err != nil {
			return err
		}
	}

	if f.knownObjects != nil {
		// Detect deletions for objects not present in the queue, but present in KnownObjects
		knownKeys := f.knownObjects.ListKeys()
		for _, k := range knownKeys {
			if keys.Has(k) {
				continue
			}
			if len(f.items[k]) > 0 {
				continue
			}

			deletedObj, exists, err := f.knownObjects.GetByKey(k)
			if err != nil {
				deletedObj = nil
				klog.Errorf("Unexpected error %v during lookup of key %v, placing DeleteFinalStateUnknown marker without object", err, k)
			} else if !exists {
				deletedObj = nil
				klog.Infof("Key %v does not exist in known objects store, placing DeleteFinalStateUnknown marker without object", k)
			}
			queuedDeletions++
			if err := f.queueActionLocked(Deleted, DeletedFinalStateUnknown{k, deletedObj}); err != nil {
				return err
			}
		}
	}

	if !f.populated {
		f.populated = true
		f.initialPopulationCount = keys.Len() + queuedDeletions
	}

	return nil
}

```