---
weight: 1
title: "数据访问层抽象"
date: 2023-03-05T22:00:00+08:00
lastmod: 2023-03-05T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "kube-apiserver schema api 对象元数据管理"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---
## 1. API Server 的数据访问层
前面我们介绍了 API 对象的各种元数据如何注册到 Schema，API Server 提供了各种 API 对象的 RESTful 接口，API 对象数据最终需要保存至 etcd 中。为了完成整个步骤，k8s 抽象出了如下接口:
1. 后端存储的抽象
2. 操作 API 对象的抽象

![storage 抽象](/images/k8s/k8s_use/storage.png)

### 1.1 后端存储的抽象
后端存储的抽象:
1. Interface:
    - 位置: apiserver/pkg/storage/interfaces.go
    - 作用: 将所有需要对后端存储执行的操作抽象成了一个 Interface 接口，要想为 k8s 接入新的存储系统，需要实现这个接口
2. etcd3 struct store:
    - 位置: apiserver/pkg/storage/etcd3/store.go
    - 作用: Interface 的 etcd3 实现，etcd3 是 k8s 默认唯一支持的存储系统
3. struct DryRunnableStorage:
    - 位置: apiserver/pkg/registry/generic/registry/dryrun.go
    - 作用: 在 Interface 上包装了一层，如果传入 dryrun 参数，会跳过实际的存储过程

```go

// 3. DryRunnableStorage
type DryRunnableStorage struct {
	Storage storage.Interface
	Codec   runtime.Codec
}

func (s *DryRunnableStorage) Versioner() storage.Versioner {
	return s.Storage.Versioner()
}

func (s *DryRunnableStorage) Create(ctx context.Context, key string, obj, out runtime.Object, ttl uint64, dryRun bool) error {
	if dryRun {
		if err := s.Storage.Get(ctx, key, storage.GetOptions{}, out); err == nil {
			return storage.NewKeyExistsError(key, 0)
		}
		return s.copyInto(obj, out)
	}
	return s.Storage.Create(ctx, key, obj, out, ttl)
}
```

### 1.2 API 对象操作
k8s 将所有对 API 对象的操作都封装在 [Store](https://github.com/kubernetes/apiserver/blob/master/pkg/registry/generic/registry/store.go#L96) 结构体中:
1. Store 对外实现了很多接口，包括 GET、WATCH... 这些接口是对 API 对象对外暴露的操作接口
2. Store 对内接受了多个 Strategy 接口对象，包括 RESTCreateStrategy、RESTUpdateStrategy.. 这些 Strategy 就是如何操作一个 API 对象的抽象
3. 所有API对象支持的操作接口，以及操作它们的接口都定义在 [apiserver/pkg/registry/rest/](https://github.com/kubernetes/apiserver/blob/master/pkg/registry/rest/)

```go
type Store struct {
	Decorator func(runtime.Object)
	CreateStrategy rest.RESTCreateStrategy
	UpdateStrategy rest.RESTUpdateStrategy
	DeleteStrategy rest.RESTDeleteStrategy
	ResetFieldsStrategy rest.ResetFieldsStrategy
	Storage DryRunnableStorage
	StorageVersioner runtime.GroupVersioner
}
```

每一个 API 对象都会通过嵌入 Store 的方式自定义一个 Rest 结构体，并实现自己的 Strategy，以 daemonset 为例 Store、Rest、Strategy 的关系如下:

![daemonset 抽象](/images/k8s/k8s_use/daemonset_rest.png)

```go
type REST struct {
    // 1. 嵌入 Store 对象
	*genericregistry.Store
}

// NewREST 返回的就是可以操作 DaemonSets 的后端存储抽象
// NewREST returns a RESTStorage object that will work against DaemonSets.
func NewREST(optsGetter generic.RESTOptionsGetter) (*REST, *StatusREST, error) {
	store := &genericregistry.Store{
		NewFunc:                   func() runtime.Object { return &apps.DaemonSet{} },
		NewListFunc:               func() runtime.Object { return &apps.DaemonSetList{} },
		DefaultQualifiedResource:  apps.Resource("daemonsets"),
		SingularQualifiedResource: apps.Resource("daemonset"),
        // 2. daemonset 自己的 Strategy 实现
		CreateStrategy:      daemonset.Strategy,
		UpdateStrategy:      daemonset.Strategy,
		DeleteStrategy:      daemonset.Strategy,
		ResetFieldsStrategy: daemonset.Strategy,

		TableConvertor: printerstorage.TableConvertor{TableGenerator: printers.NewTableGenerator().With(printersinternal.AddHandlers)},
	}
```

### 1.3 kubernetes 数据访问层总结
kubernetes 整个数据访问层组成总结如下:

|模块|文件|作用|
|:---|:---|:---|
|apiserver/pkg/storage/|interfaces.go|后端存储的 Interface 接口|
||etcd3/store.go|etcd3 的 Interface 实现|
|apiserver/pkg/registry/generic/|registry/dryrun.go|Interface 装饰器，可以跳过实际的存储过程|
||registry/store.go|数据访问层的实现，Store + Strategy|
|apiserver/pkg/registry/rest/|rest.go|定义 API 对象对外暴露操作|
||update.go|定义操作 API 对象的接口，各种 Strategy 接口定义|
||create.go||
||delete.go||
|kubernetes/pkg/registry/apps/|daemonset/strategy.go|daemonset Strategy 实现|
|kubernetes/pkg/registry/apps/|daemonset/storage/storage.go|daemonset Rest 实现|

## 2. 后端存储
kubernetes 为后端存储抽象出了三个接口:
1. Versioner
2. Interface
3. Preconditions

### 2.1 Versioner
从 etcd 中读取到的数据是带有版本的，通过这个版本我们执行类似 CAS 的操作，避免多个客户端的并发请求产生冲突。Versioner 接口抽象了，如何将 etcd 中的 Version 信息更新到 API 对象中。

```go
	// 将存储元数据，保存到一个 API 对象中，如果不能正确更新对象，则返回错误。
	// 如果请求的对象不需要来自数据库的元数据，可能返回nil
	UpdateObject(obj runtime.Object, resourceVersion uint64) error
	UpdateList(obj runtime.Object, resourceVersion uint64, continueValue string, remainingItemCount *int64) error
	PrepareObjectForStorage(obj runtime.Object) error
	ObjectResourceVersion(obj runtime.Object) (uint64, error)
	ParseResourceVersion(resourceVersion string) (uint64, error)
```

apiserver/pkg/storage/api_object_versioner.go 中的 APIObjectVersioner 实现了 Versioner 接口。

```go
// UpdateObject implements Versioner
func (a APIObjectVersioner) UpdateObject(obj runtime.Object, resourceVersion uint64) error {
	// 判断 obj 是否有 SetResourceVersion 方法
	accessor, err := meta.Accessor(obj)
	if err != nil {
		return err
	}
	versionString := ""
	if resourceVersion != 0 {
		versionString = strconv.FormatUint(resourceVersion, 10)
	}
	accessor.SetResourceVersion(versionString)
	return nil
}

// UpdateList implements Versioner
func (a APIObjectVersioner) UpdateList(obj runtime.Object, resourceVersion uint64, nextKey string, count *int64) error {
	if resourceVersion == 0 {
		return fmt.Errorf("illegal resource version from storage: %d", resourceVersion)
	}
	// 
	listAccessor, err := meta.ListAccessor(obj)
	if err != nil || listAccessor == nil {
		return err
	}
	versionString := strconv.FormatUint(resourceVersion, 10)
	listAccessor.SetResourceVersion(versionString)
	listAccessor.SetContinue(nextKey)
	listAccessor.SetRemainingItemCount(count)
	return nil
}
```

### 2.2 Interface
Interface 为对象序列化和反序列化提供了一个通用接口并隐藏所有与存储相关的操作。

```go
type Interface interface {
	Versioner() Versioner
	Create(ctx context.Context, key string, obj, out runtime.Object, ttl uint64) error
	Delete(
		ctx context.Context, key string, out runtime.Object, preconditions *Preconditions,
		validateDeletion ValidateObjectFunc, cachedExistingObject runtime.Object) error
	Watch(ctx context.Context, key string, opts ListOptions) (watch.Interface, error)
	Get(ctx context.Context, key string, opts GetOptions, objPtr runtime.Object) error
	GetList(ctx context.Context, key string, opts ListOptions, listObj runtime.Object) error
	GuaranteedUpdate(
		ctx context.Context, key string, destination runtime.Object, ignoreNotFound bool,
		preconditions *Preconditions, tryUpdate UpdateFunc, cachedExistingObject runtime.Object) error

	// Count returns number of different entries under the key (generally being path prefix).
	Count(key string) (int64, error)
}
```

Interface 提供的接口还是比较明了的，接下我们直接来看  etcd3 的实现

## 3. etcd3 的存储实现
#### 3.1 etcd3 store 定义
etcd3 的存储实现核心是 [store 结构体](https://github.com/kubernetes/apiserver/blob/master/pkg/storage/etcd3/store.go#L75)，store 的定义中:
1. client: etcd3 的客户端
2. codec: 前面的 Codec 用于完成数据的编解码
3. versioner: etcd3 就是 APIObjectVersioner
4. transformer: 数据保存和数据读取前后的加解密
5. pathPrefix: 保存到 etc 中 key 的根路径
6. groupResource: 数据的 group 和 resource
7. watcher: 实现了 watch.Interface 接口，与 Watch 方法相关
8. pagingEnabled: 是否开启分页
9. leaseManager: leaseManager 用于管理从etcd请求的租约
	- 如果一个新的写操作所需要的租约的到期时间与前一个租约的到期时间相似，那么旧的租约将被重用，以减少etcd的开销，因为租约操作是昂贵的
	- 在实现中，我们只存储一个以前的租约，因为所有事件都有相同的ttl

```go
type store struct {
	client              *clientv3.Client
	codec               runtime.Codec
	versioner           storage.Versioner
	transformer         value.Transformer
	pathPrefix          string
	groupResource       schema.GroupResource
	groupResourceString string
	watcher             *watcher
	pagingEnabled       bool
	leaseManager        *leaseManager
}
```

在介绍 store 实现的方法之前，我们先来看看 watcher 和 leaseManager 的实现。

### 3.2 leaseManager
leaseManager 的定义如下:

```go
type leaseManager struct {
	client                  *clientv3.Client // etcd client used to grant leases
	leaseMu                 sync.Mutex
	prevLeaseID             clientv3.LeaseID
	prevLeaseExpirationTime time.Time       // 上一个租约的过期时间
	// 每个租期被重用的时间(以秒为单位)和TTL的百分比。它们中的最小值被用来避免不合理的大数字。
	leaseReuseDurationSeconds   int64
	leaseReuseDurationPercent   float64
	leaseMaxAttachedObjectCount int64
	leaseAttachedObjectCount    int64
}

// LeaseManagerConfig is 定义了创建 leaseManager 的配置
type LeaseManagerConfig struct {
	// 租约有效时长
	ReuseDurationSeconds int64
	// 租约可以被附加的最大 key 数量
	MaxObjectCount int64
}
```

leaseManager 的核心是 GetLease 方法:

```go
// GetLease 基于请求的 ttl 返回一个租约，如果缓存的上一个租约能够满足要求，则重用，否则重新向 etcd 请求一个租约
// GetLease returns a lease based on requested ttl: if the cached previous
// lease can be reused, reuse it; otherwise request a new one from etcd.
func (l *leaseManager) GetLease(ctx context.Context, ttl int64) (clientv3.LeaseID, error) {
	now := time.Now()
	l.leaseMu.Lock()
	defer l.leaseMu.Unlock()
	// 检查缓存的上一个租约是否可被重用
	reuseDurationSeconds := l.getReuseDurationSecondsLocked(ttl)
	// ttl 是否在租约失效前到达
	valid := now.Add(time.Duration(ttl) * time.Second).Before(l.prevLeaseExpirationTime)
	sufficient := now.Add(time.Duration(ttl+reuseDurationSeconds) * time.Second).After(l.prevLeaseExpirationTime)

	// 无论成功还是失败，leaseAttachedObjectCount 都会加一
	// 当前一次 GetLease 调用只会让 leaseAttachedObjectCount 加 1
	l.leaseAttachedObjectCount++

	// 如果 ttl 在 prevLeaseExpirationTime 之后，说明当前租约的时间不够用，必须重新创建，对应 valid
	// ttl 在 prevLeaseExpirationTime 之前，但是又没有在之前很多，可以重用，对应 sufficient
	// leaseReuseDurationPercent、leaseReuseDurationSeconds 都是定义租约可以被重用的时间
	if valid && sufficient && l.leaseAttachedObjectCount <= l.leaseMaxAttachedObjectCount {
		return l.prevLeaseID, nil
	}

	// request a lease with a little extra ttl from etcd
	ttl += reuseDurationSeconds
	lcr, err := l.client.Lease.Grant(ctx, ttl)
	if err != nil {
		return clientv3.LeaseID(0), err
	}
	// cache the new lease id
	l.prevLeaseID = lcr.ID
	l.prevLeaseExpirationTime = now.Add(time.Duration(ttl) * time.Second)
	// refresh count
	metrics.UpdateLeaseObjectCount(l.leaseAttachedObjectCount)
	l.leaseAttachedObjectCount = 1
	return lcr.ID, nil
}

// getReuseDurationSecondsLocked 返回租约可重用时间
// 这个方法调用前必须加锁
func (l *leaseManager) getReuseDurationSecondsLocked(ttl int64) int64 {
	reuseDurationSeconds := int64(l.leaseReuseDurationPercent * float64(ttl))
	if reuseDurationSeconds > l.leaseReuseDurationSeconds {
		reuseDurationSeconds = l.leaseReuseDurationSeconds
	}
	return reuseDurationSeconds
}
```

关于租约的重用，最难理解的就是租约的可重用时间。以一条时间轴来看:

```go
                                          prevLeaseExpirationTime
------|---------------|---------------------------|----
     now              | 中间这段就是租约可重用时间  | 
	                  A                           B
```

新的请求 ttl 只要落在 A 和 B 之间说明，ttl 在租约过期之前到达但同时与过期时间比较接近，可以认为复用当前租约影响较小，可以复用。租约的可重用时间在 getReuseDurationSecondsLocked 方法中计算。

### 3.3 watcher
watcher 定义如下:

```go
type watcher struct {
	client        *clientv3.Client
	codec         runtime.Codec
	newFunc       func() runtime.Object // 创建新对象的函数
	objectType    string
	groupResource schema.GroupResource
	versioner     storage.Versioner
}
```

watcher 最重要的就是 Watch 方法，返回一个 watchChan 对象，watchChan 实现了 watch.Interface。

```go
// 如果 rev==0，返回已经存在的对象，并从当前版本的下一版本开始 watch
// 如果 rev != 0，就从指定的 rev 版本开始 watch
// recursive == true watch key 下的所有子key和目录
// recursive == false 只 watch 给定的 key
// pred 不能为空，当 pred 与更改匹配时才会返回
func (w *watcher) Watch(ctx context.Context, key string, rev int64, recursive, progressNotify bool, transformer value.Transformer, pred storage.SelectionPredicate) (watch.Interface, error) {
	if recursive && !strings.HasSuffix(key, "/") {
		key += "/"
	}
	wc := w.createWatchChan(ctx, key, rev, recursive, progressNotify, transformer, pred)
	go wc.run()

	// For etcd watch we don't have an easy way to answer whether the watch
	// has already caught up. So in the initial version (given that watchcache
	// is by default enabled for all resources but Events), we just deliver
	// the initialization signal immediately. Improving this will be explored
	// in the future.
	utilflowcontrol.WatchInitialized(ctx)

	return wc, nil
}

// watchininitialized向优先级和公平调度程序发送一个信号，表明给定的手表请求已经初始化。
func WatchInitialized(ctx context.Context) {
	if signal, ok := initializationSignalFrom(ctx); ok {
		signal.Signal()
	}
}

// initializationSignalFrom返回一个初始化信号函数，当调用该函数时，会向优先级和公平调度程序发送监视初始化已经完成的信号。
func initializationSignalFrom(ctx context.Context) (InitializationSignal, bool) {
	signal, ok := ctx.Value(priorityAndFairnessInitializationSignalKey).(InitializationSignal)
	return signal, ok && signal != nil
}
```

createWatchChan 返回 watchChan 对象:

```go
type watchChan struct {
	watcher           *watcher
	transformer       value.Transformer
	key               string
	initialRev        int64
	recursive         bool
	progressNotify    bool
	internalPred      storage.SelectionPredicate
	ctx               context.Context
	cancel            context.CancelFunc
	incomingEventChan chan *event
	resultChan        chan watch.Event
	errChan           chan error
}

func (w *watcher) createWatchChan(ctx context.Context, key string, rev int64, recursive, progressNotify bool, transformer value.Transformer, pred storage.SelectionPredicate) *watchChan {
	wc := &watchChan{
		watcher:           w,
		transformer:       transformer,
		key:               key,
		initialRev:        rev,
		recursive:         recursive,
		progressNotify:    progressNotify,
		internalPred:      pred,
		incomingEventChan: make(chan *event, incomingBufSize),
		resultChan:        make(chan watch.Event, outgoingBufSize),
		errChan:           make(chan error, 1),
	}
	if pred.Empty() {
		// The filter doesn't filter out any object.
		wc.internalPred = storage.Everything
	}

	// etcd服务器等待，直到它在3个选举超时时间内找不到领导者，以取消现有的流
	wc.ctx, wc.cancel = context.WithCancel(clientv3.WithRequireLeader(ctx))
	return wc
}
```

watchChan 最核心的就是 run 方法:

```go
func (wc *watchChan) run() {
	watchClosedCh := make(chan struct{})
	// 1. startWatching 分析见下，核心 watch etcd 把 watch 到的结果发送到 incomingEventChan
	go wc.startWatching(watchClosedCh)

	var resultChanWG sync.WaitGroup
	resultChanWG.Add(1)
	// 从 incomingEventChan 读取时间数据，做 transformer 转换，并发送到 resultChan
	// processEvent 会调用 wc.transformer 方法，完成事件过滤，并将 event 转换用户需要的 watch.Event
	go wc.processEvent(&resultChanWG)

	select {
	case err := <-wc.errChan:
		if err == context.Canceled {
			break
		}
		errResult := transformErrorToEvent(err)
		if errResult != nil {
			// 保证用户在关闭ResultChan前收到错误结果。
			select {
			case wc.resultChan <- *errResult:
			case <-wc.ctx.Done(): // user has given up all results
			}
		}
	case <-watchClosedCh:
	case <-wc.ctx.Done(): // user cancel
	}

	// We use wc.ctx to reap all goroutines. Under whatever condition, we should stop them all.
	// It's fine to double cancel.
	wc.cancel()

	// we need to wait until resultChan wouldn't be used anymore
	resultChanWG.Wait()
	close(wc.resultChan)
}

func (wc *watchChan) Stop() {
	wc.cancel()
}

func (wc *watchChan) ResultChan() <-chan watch.Event {
	return wc.resultChan
}
```
startWatching 会做两件事:
1. 如果 initialRev=0 将 initialRev=0 设置为当前版本
2. watch 给定的 key，将 watch 到的事件发给主程序

```go
// startWatching does:
// - get current objects if initialRev=0; set initialRev to current rev
// - watch on given key and send events to process.
func (wc *watchChan) startWatching(watchClosedCh chan struct{}) {
	if wc.initialRev == 0 {
		// Sync 尝试检索现有数据并将它们发送给进程。initialRev 设置为当前版本。所有发送的事件将具有 isCreated=true
		if err := wc.sync(); err != nil {
			klog.Errorf("failed to sync with latest state: %v", err)
			wc.sendError(err)
			return
		}
	}
	opts := []clientv3.OpOption{clientv3.WithRev(wc.initialRev + 1), clientv3.WithPrevKV()}
	if wc.recursive {
		opts = append(opts, clientv3.WithPrefix())
	}
	if wc.progressNotify {
		opts = append(opts, clientv3.WithProgressNotify())
	}
	wch := wc.watcher.client.Watch(wc.ctx, wc.key, opts...)
	// watch etcd 的返回结果
	for wres := range wch {
		if wres.Err() != nil {
			err := wres.Err()
			// If there is an error on server (e.g. compaction), the channel will return it before closed.
			logWatchChannelErr(err)
			wc.sendError(err)
			return
		}
		// etcd 的 notify 处理
		if wres.IsProgressNotify() {
			wc.sendEvent(progressNotifyEvent(wres.Header.GetRevision()))
			metrics.RecordEtcdBookmark(wc.watcher.groupResource.String())
			continue
		}
		for _, e := range wres.Events {
			// 解析 etcd 返回的时间
			parsedEvent, err := parseEvent(e)
			if err != nil {
				logWatchChannelErr(err)
				wc.sendError(err)
				return
			}
			// 发送到 incomingEventChan
			wc.sendEvent(parsedEvent)
		}
	}
	// When we come to this point, it's only possible that client side ends the watch.
	// e.g. cancel the context, close the client.
	// If this watch chan is broken and context isn't cancelled, other goroutines will still hang.
	// We should notify the main thread that this goroutine has exited.
	close(watchClosedCh)
}
```

### 3.3 etcd3 实现
有了上面的基础，我们就可以阅读 etcd3 的实现了。这里我们重点关注 etcd3 实现的 Get、Watch、GuaranteedUpdate 三个方法。

#### Get

```go
// Get implements storage.Interface.Get.
func (s *store) Get(ctx context.Context, key string, opts storage.GetOptions, out runtime.Object) error {
	// 1. key 标准化
	preparedKey, err := s.prepareKey(key)
	if err != nil {
		return err
	}
	startTime := time.Now()
	getResp, err := s.client.KV.Get(ctx, preparedKey)
	metrics.RecordEtcdRequestLatency("get", s.groupResourceString, startTime)
	if err != nil {
		return err
	}
	// 2. 当提供的 minimumResourceVersion 大于存储中可用的最近的actualRevision时，validateminumresourceversion返回“too large resource”版本错误。
	if err = s.validateMinimumResourceVersion(opts.ResourceVersion, uint64(getResp.Header.Revision)); err != nil {
		return err
	}

	if len(getResp.Kvs) == 0 {
		if opts.IgnoreNotFound {
			return runtime.SetZeroValue(out)
		}
		return storage.NewKeyNotFoundError(preparedKey, 0)
	}
	kv := getResp.Kvs[0]

	data, _, err := s.transformer.TransformFromStorage(ctx, kv.Value, authenticatedDataString(preparedKey))
	if err != nil {
		return storage.NewInternalError(err.Error())
	}
	// 3. 解码数据
	err = decode(s.codec, s.versioner, data, out, kv.ModRevision)
	if err != nil {
		recordDecodeError(s.groupResourceString, preparedKey)
		return err
	}
	return nil
}
```

#### GuaranteedUpdate

```go
// GuaranteedUpdate implements storage.Interface.GuaranteedUpdate.
func (s *store) GuaranteedUpdate(
	ctx context.Context, key string, destination runtime.Object, ignoreNotFound bool,
	preconditions *storage.Preconditions, tryUpdate storage.UpdateFunc, cachedExistingObject runtime.Object) error {
	// 1. key 标准化
	preparedKey, err := s.prepareKey(key)
	if err != nil {
		return err
	}
	ctx, span := tracing.Start(ctx, "GuaranteedUpdate etcd3",
		attribute.String("audit-id", audit.GetAuditIDTruncated(ctx)),
		attribute.String("key", key),
		attribute.String("type", getTypeName(destination)),
		attribute.String("resource", s.groupResourceString))
	defer span.End(500 * time.Millisecond)

	v, err := conversion.EnforcePtr(destination)
	if err != nil {
		return fmt.Errorf("unable to convert output object to pointer: %v", err)
	}
	// 2. 解析 key 当前的数据，返回的是 objState 对象
	// objState 包含了 decode 后的结果数据，解析前的原始数据，etcd 返回的 metadata 数据
	getCurrentState := func() (*objState, error) {
		startTime := time.Now()
		getResp, err := s.client.KV.Get(ctx, preparedKey)
		metrics.RecordEtcdRequestLatency("get", s.groupResourceString, startTime)
		if err != nil {
			return nil, err
		}
		return s.getState(ctx, getResp, preparedKey, v, ignoreNotFound)
	}

	var origState *objState
	var origStateIsCurrent bool
	// 从传入的缓存对象中，解析出 objState
	if cachedExistingObject != nil {
		origState, err = s.getStateFromObject(cachedExistingObject)
	} else {
		origState, err = getCurrentState()
		origStateIsCurrent = true
	}
	if err != nil {
		return err
	}
	span.AddEvent("initial value restored")

	transformContext := authenticatedDataString(preparedKey)
	for {
		if err := preconditions.Check(preparedKey, origState.obj); err != nil {
			// If our data is already up to date, return the error
			if origStateIsCurrent {
				return err
			}

			// It's possible we were working with stale data
			// Actually fetch
			origState, err = getCurrentState()
			if err != nil {
				return err
			}
			origStateIsCurrent = true
			// Retry
			continue
		}

		ret, ttl, err := s.updateState(origState, tryUpdate)
		if err != nil {
			// If our data is already up to date, return the error
			if origStateIsCurrent {
				return err
			}

			// It's possible we were working with stale data
			// Remember the revision of the potentially stale data and the resulting update error
			cachedRev := origState.rev
			cachedUpdateErr := err

			// Actually fetch
			origState, err = getCurrentState()
			if err != nil {
				return err
			}
			origStateIsCurrent = true

			// it turns out our cached data was not stale, return the error
			if cachedRev == origState.rev {
				return cachedUpdateErr
			}

			// Retry
			continue
		}

		span.AddEvent("About to Encode")
		data, err := runtime.Encode(s.codec, ret)
		if err != nil {
			span.AddEvent("Encode failed", attribute.Int("len", len(data)), attribute.String("err", err.Error()))
			return err
		}
		span.AddEvent("Encode succeeded", attribute.Int("len", len(data)))
		if !origState.stale && bytes.Equal(data, origState.data) {
			// if we skipped the original Get in this loop, we must refresh from
			// etcd in order to be sure the data in the store is equivalent to
			// our desired serialization
			if !origStateIsCurrent {
				origState, err = getCurrentState()
				if err != nil {
					return err
				}
				origStateIsCurrent = true
				if !bytes.Equal(data, origState.data) {
					// original data changed, restart loop
					continue
				}
			}
			// recheck that the data from etcd is not stale before short-circuiting a write
			if !origState.stale {
				err = decode(s.codec, s.versioner, origState.data, destination, origState.rev)
				if err != nil {
					recordDecodeError(s.groupResourceString, preparedKey)
					return err
				}
				return nil
			}
		}

		newData, err := s.transformer.TransformToStorage(ctx, data, transformContext)
		if err != nil {
			span.AddEvent("TransformToStorage failed", attribute.String("err", err.Error()))
			return storage.NewInternalError(err.Error())
		}
		span.AddEvent("TransformToStorage succeeded")

		opts, err := s.ttlOpts(ctx, int64(ttl))
		if err != nil {
			return err
		}
		span.AddEvent("Transaction prepared")

		startTime := time.Now()
		txnResp, err := s.client.KV.Txn(ctx).If(
			clientv3.Compare(clientv3.ModRevision(preparedKey), "=", origState.rev),
		).Then(
			clientv3.OpPut(preparedKey, string(newData), opts...),
		).Else(
			clientv3.OpGet(preparedKey),
		).Commit()
		metrics.RecordEtcdRequestLatency("update", s.groupResourceString, startTime)
		if err != nil {
			span.AddEvent("Txn call failed", attribute.String("err", err.Error()))
			return err
		}
		span.AddEvent("Txn call completed")
		span.AddEvent("Transaction committed")
		if !txnResp.Succeeded {
			getResp := (*clientv3.GetResponse)(txnResp.Responses[0].GetResponseRange())
			klog.V(4).Infof("GuaranteedUpdate of %s failed because of a conflict, going to retry", preparedKey)
			origState, err = s.getState(ctx, getResp, preparedKey, v, ignoreNotFound)
			if err != nil {
				return err
			}
			span.AddEvent("Retry value restored")
			origStateIsCurrent = true
			continue
		}
		putResp := txnResp.Responses[0].GetResponsePut()

		err = decode(s.codec, s.versioner, data, destination, putResp.Header.Revision)
		if err != nil {
			span.AddEvent("decode failed", attribute.Int("len", len(data)), attribute.String("err", err.Error()))
			recordDecodeError(s.groupResourceString, preparedKey)
			return err
		}
		span.AddEvent("decode succeeded", attribute.Int("len", len(data)))
		return nil
	}
}
```