---
weight: 1
title: "client-go Reflector"
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

Reflector 的任务就是向 apiserver watch 特定类型的资源，拿到变更通知后将其丢到 DeltaFIFO 队列中。

## 1. Reflector

### 1.1 定义
```go
// Reflector可以监视指定的资源，使所有更改在给定的存储中得到反映。
type Reflector struct {
	// name标识此reflector。如果可能，默认情况下将是一个file:line。
	name string

	//我们期望放置在存储中的类型的名称。如果提供了expectedGVK，则名称将是expectedGVK的字符串表示形式，否则将是expectedType的字符串表示形式。这仅用于显示，不应用于解析或比较。
	typeDescription string
	//我们期望放置在存储中的类型的示例对象。只需要正确的类型，除非是unstructured.Unstructured，那么对象的“apiVersion”和“kind”也必须正确。
	expectedType reflect.Type
	//如果是unstructured，则是我们期望放置在存储中的对象的GVK。
	expectedGVK *schema.GroupVersionKind
	//要与观察源同步的目标
	store Store
	//listerWatcher用于执行列表和观察。
	listerWatcher ListerWatcher

	// backoff管理ListWatch的退避。
	backoffManager wait.BackoffManager
	// initConnBackoffManager管理与ListAndWatch的Watch调用的初始连接的退避。
	initConnBackoffManager wait.BackoffManager
	//MaxInternalErrorRetryDuration定义我们应该重试由watch返回的内部错误的时间长度。
	MaxInternalErrorRetryDuration time.Duration

	resyncPeriod time.Duration
	//ShouldResync定期调用，每当它返回true时，将调用Store的Resync操作。
	ShouldResync func() bool
	//clock允许测试操作时间。
	clock clock.Clock
	//paginatedResult定义是否应强制对列表调用进行分页。它根据初始列表调用的结果设置。
	paginatedResult bool
	//lastSyncResourceVersion是在与底层存储进行同步时最后观察到的资源版本令牌
	//它是线程安全的，但与底层存储未同步。
	lastSyncResourceVersion string
	//如果先前的列表或观察请求使用lastSyncResourceVersion失败并出现“过期”或“资源版本过大”的错误，则isLastSyncResourceVersionUnavailable为true。
	isLastSyncResourceVersionUnavailable bool
	//lastSyncResourceVersionMutex保护对lastSyncResourceVersion的读/写访问
	lastSyncResourceVersionMutex sync.RWMutex
	//WatchListPageSize是初始和重新同步观察列表的请求块大小。如果未设置，则对于一致性读取（RV =“”）或选择任意旧数据的读取（RV =“0”），它将默认为pager.PageSize，对于其余读取（RV！=“”&& RV！=“0”），将关闭分页以允许从观察缓存中提供它们。
    //注意：应谨慎使用它，因为分页列表始终直接从etcd提供，这显着不太高效，可能会导致严重的性能和可扩展性问题。
    WatchListPageSize int64
	//每当ListAndWatch因错误而断开连接时调用。
	watchErrorHandler WatchErrorHandler
}
```

### 1.2 初始化

NewReflector() 的参数里
1. lw 是一个 ListWatch
1. expectedType 指定期望关注的类型
2. store 是一个 DeltaFIFO

Reflector 通过 ListWatcher 提供的能力去 list-watch apiserver，然后将 Event 加到 DeltaFIFO 中。

```go
func NewReflector(lw ListerWatcher, expectedType interface{}, store Store, resyncPeriod time.Duration) *Reflector {
	return NewReflectorWithOptions(lw, expectedType, store, ReflectorOptions{ResyncPeriod: resyncPeriod})
}

func NewReflectorWithOptions(lw ListerWatcher, expectedType interface{}, store Store, options ReflectorOptions) *Reflector {
	reflectorClock := options.Clock
	if reflectorClock == nil {
		reflectorClock = clock.RealClock{}
	}
	r := &Reflector{
		name:            options.Name,
		resyncPeriod:    options.ResyncPeriod,
		typeDescription: options.TypeDescription,
		listerWatcher:   lw,
		store:           store,
		// We used to make the call every 1sec (1 QPS), the goal here is to achieve ~98% traffic reduction when
		// API server is not healthy. With these parameters, backoff will stop at [30,60) sec interval which is
		// 0.22 QPS. If we don't backoff for 2min, assume API server is healthy and we reset the backoff.
		backoffManager:         wait.NewExponentialBackoffManager(800*time.Millisecond, 30*time.Second, 2*time.Minute, 2.0, 1.0, reflectorClock),
		initConnBackoffManager: wait.NewExponentialBackoffManager(800*time.Millisecond, 30*time.Second, 2*time.Minute, 2.0, 1.0, reflectorClock),
		clock:                  reflectorClock,
		watchErrorHandler:      WatchErrorHandler(DefaultWatchErrorHandler),
		expectedType:           reflect.TypeOf(expectedType),
	}

	if r.name == "" {
		r.name = naming.GetNameFromCallsite(internalPackages...)
	}

	if r.typeDescription == "" {
		r.typeDescription = getTypeDescriptionFromObject(expectedType)
	}

	if r.expectedGVK == nil {
		r.expectedGVK = getExpectedGVKFromObject(expectedType)
	}

	return r
}
```

### 1.2 启动
Reflector 的启动入口是 Run() 方法：

```go
func (r *Reflector) Run(stopCh <-chan struct{}) {
	klog.V(3).Infof("Starting reflector %s (%s) from %s", r.typeDescription, r.resyncPeriod, r.name)
	wait.BackoffUntil(func() {
		if err := r.ListAndWatch(stopCh); err != nil {
			r.watchErrorHandler(r, err)
		}
	}, r.backoffManager, true, stopCh)
	klog.V(3).Infof("Stopping reflector %s (%s) from %s", r.typeDescription, r.resyncPeriod, r.name)
}
```

wait.BackoffUntil 内是一个循环，周期性执行传入的函数，并提供容错处理。ListAndWatch 方法则是关键的逻辑处理函数。

#### ListAndWatch

```go

```