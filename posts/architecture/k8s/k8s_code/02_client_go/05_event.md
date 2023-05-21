---
weight: 1
title: "client-go Event"
date: 2023-03-01T22:00:00+08:00
lastmod: 2023-03-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "client-go 事件"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---

## 1. Event
kubectl describe OBJ 查看一个对象的详情时，输出的 Event 事件信息就是 client-go Event 产生。Event 包含两个核心部分:
1. Event 广播: 事件的读取方可能不止一个，需要有一个从事件源到多个事件接受方的流
2. Event 聚合和限流

### 1.1 Event 广播
Event 广播的实现涉及到如下几个对象:

![index](/images/k8s/k8s_code/event-broadcast.svg)

其中:
1. Broadcaster: 实现了广播功能
2. EventRecorder: 事件源的抽象，负责产生 event
2. EventBroadcaster: Event 广播的抽象，从 EventRecorder 接受数据源，并广播给下游
3. EventSink: 一种 Event 接受方的抽象，这种接受方会把接受到的 Event 保存到 apiserver 中

在实现逻辑上，EventBroadcaster 是中转站
1. 一方面负责产生一个 EventRecorder 供事件源使用
2. 另一方面接受事件接受方，向它们发送事件

### 1.2 Event 聚合和限流
Event 聚合和限流涉及到如下几个对象:

![index](/images/k8s/k8s_code/event-aggregator.svg)

Event 聚合和限流的核心是 EventCorrelator，它有三个成员函数:
1. EventAggregator: 完成 Event 聚合
2. eventLogger: 缓存 Event 并把新产生的 Event 和缓存的 Event 做对比，生成增量
2. EventFilterFunc: 限流，实现在 EventSourceObjectSpamFilter

下面我们一一介绍这些对象的实现。

## 2. Event 广播
### 2.1 EventBroadcaster

```go
// EventBroadcaster knows how to receive events and send them to any EventSink, watcher, or log.
type EventBroadcaster interface {
	// StartEventWatcher starts sending events received from this EventBroadcaster to the given
	// event handler function. The return value can be ignored or used to stop recording, if
	// desired.
	StartEventWatcher(eventHandler func(*v1.Event)) watch.Interface

	// StartRecordingToSink starts sending events received from this EventBroadcaster to the given
	// sink. The return value can be ignored or used to stop recording, if desired.
	StartRecordingToSink(sink EventSink) watch.Interface

	// StartLogging starts sending events received from this EventBroadcaster to the given logging
	// function. The return value can be ignored or used to stop recording, if desired.
	StartLogging(logf func(format string, args ...interface{})) watch.Interface

	// StartStructuredLogging starts sending events received from this EventBroadcaster to the structured
	// logging function. The return value can be ignored or used to stop recording, if desired.
	StartStructuredLogging(verbosity klog.Level) watch.Interface

	// NewRecorder returns an EventRecorder that can be used to send events to this EventBroadcaster
	// with the event source set to the given event source.
	NewRecorder(scheme *runtime.Scheme, source v1.EventSource) EventRecorder

	// Shutdown shuts down the broadcaster. Once the broadcaster is shut
	// down, it will only try to record an event in a sink once before
	// giving up on it with an error message.
	Shutdown()
}
```

|方法|作用|
|:---|:---|
|StartEventWatcher|开始将从此 EventBroadcaster 接收到的事件发送到给定的事件处理程序函数|
|StartRecordingToSink|开始将从此 EventBroadcaster 接收到的事件发送到给定的 sink|
|StartLogging|开始将从此 EventBroadcaster 接收到的事件发送到给定的日志函数|
|StartStructuredLogging|开始将从此 EventBroadcaster 接收到的事件发送到结构化日志函数|
|NewRecorder|返回一个 EventRecorder，可以用来将事件发送到此 EventBroadcaster，并将事件源设置为给定的事件源|

从 NewRecorder 方法可以看出来，EventRecorder 可以将 Event 通过 EventBroadcaster 广播给下游的处理程序。

### 2.2 EventRecorder

```go
// EventRecorder knows how to record events on behalf of an EventSource.
type EventRecorder interface {
	// Event constructs an event from the given information and puts it in the queue for sending.
	// 'object' is the object this event is about. Event will make a reference-- or you may also
	// pass a reference to the object directly.
	// 'eventtype' of this event, and can be one of Normal, Warning. New types could be added in future
	// 'reason' is the reason this event is generated. 'reason' should be short and unique; it
	// should be in UpperCamelCase format (starting with a capital letter). "reason" will be used
	// to automate handling of events, so imagine people writing switch statements to handle them.
	// You want to make that easy.
	// 'message' is intended to be human readable.
	//
	// The resulting event will be created in the same namespace as the reference object.
	Event(object runtime.Object, eventtype, reason, message string)

	// Eventf is just like Event, but with Sprintf for the message field.
	Eventf(object runtime.Object, eventtype, reason, messageFmt string, args ...interface{})

	// AnnotatedEventf is just like eventf, but with annotations attached
	AnnotatedEventf(object runtime.Object, annotations map[string]string, eventtype, reason, messageFmt string, args ...interface{})
}
```

EventRecorder 从给定的信息构造一个事件，并将其放入队列中以发送:
1. object: 是此事件所涉及的对象
2. eventtype: 是此事件的类型，可以是 Normal、Warning 中的一种。未来可能会添加新类型3. reason: 是生成此事件的原因，应该是短而独特的，采用 UpperCamelCase 格式
4. message: 旨在供人类阅读

### 2.3 watch.Broadcaster
Broadcaster 是 apimachinery/pkg/watch/mux.go 实现的一个广播实现类，EventBroadcaster 接口的实现上大都都继承了这个类。

```go
func NewLongQueueBroadcaster(queueLength int, fullChannelBehavior FullChannelBehavior) *Broadcaster {
	m := &Broadcaster{
		watchers:            map[int64]*broadcasterWatcher{},
		incoming:            make(chan Event, queueLength),
		stopped:             make(chan struct{}),
		watchQueueLength:    queueLength,
		fullChannelBehavior: fullChannelBehavior,
	}
	m.distributing.Add(1)
	go m.loop()
	return m
}

// broadcasterWatcher handles a single watcher of a broadcaster
type broadcasterWatcher struct {
	result  chan Event
	stopped chan struct{}
	stop    sync.Once
	id      int64
	m       *Broadcaster
}

// ResultChan returns a channel to use for waiting on events.
func (mw *broadcasterWatcher) ResultChan() <-chan Event {
	return mw.result
}

// Stop stops watching and removes mw from its list.
// It will block until the watcher stop request is actually executed
func (mw *broadcasterWatcher) Stop() {
	mw.stop.Do(func() {
		close(mw.stopped)
		mw.m.stopWatching(mw.id)
	})
}
```

Broadcaster 在实例化时会执行其 loop 方法，loop() 方法的逻辑是从 m.incoming 接受消息，然后分发给所有的 watchers。

```go
// loop receives from m.incoming and distributes to all watchers.
func (m *Broadcaster) loop() {
	// Deliberately not catching crashes here. Yes, bring down the process if there's a
	// bug in watch.Broadcaster.
	for event := range m.incoming {
		if event.Type == internalRunFunctionMarker {
			event.Object.(functionFakeRuntimeObject)()
			continue
		}
		m.distribute(event)
	}
	m.closeAll()
	m.distributing.Done()
}

// distribute sends event to all watchers. Blocking.
func (m *Broadcaster) distribute(event Event) {
	if m.fullChannelBehavior == DropIfChannelFull {
		for _, w := range m.watchers {
			select {
			case w.result <- event:
			case <-w.stopped:
			default: // Don't block if the event can't be queued.
			}
		}
	} else {
		for _, w := range m.watchers {
			select {
			case w.result <- event:
			case <-w.stopped:
			}
		}
	}
}
```

通过 Watch 方法可以添加一个接受者从 Broadcaster 接受信息。

```go
// Watch adds a new watcher to the list and returns an Interface for it.
// Note: new watchers will only receive new events. They won't get an entire history
// of previous events. It will block until the watcher is actually added to the
// broadcaster.
func (m *Broadcaster) Watch() (Interface, error) {
	var w *broadcasterWatcher
	m.blockQueue(func() {
		id := m.nextWatcher
		m.nextWatcher++
		w = &broadcasterWatcher{
			result:  make(chan Event, m.watchQueueLength),
			stopped: make(chan struct{}),
			id:      id,
			m:       m,
		}
		m.watchers[id] = w
	})
	if w == nil {
		return nil, fmt.Errorf("broadcaster already stopped")
	}
	return w, nil
}
```

Broadcaster 中所有的更新操作都通过一个 blockQueue 方法实现，之所以需要这个 blockQueue 方法是为了明确接受的消息与变更操作的顺序，保证 Watch 总是能看到自从他添加之后的所有消息。

```go
// Execute f, blocking the incoming queue (and waiting for it to drain first).
// The purpose of this terrible hack is so that watchers added after an event
// won't ever see that event, and will always see any event after they are
// added.
func (m *Broadcaster) blockQueue(f func()) {
	m.incomingBlock.Lock()
	defer m.incomingBlock.Unlock()
	select {
	case <-m.stopped:
		return
	default:
	}
	var wg sync.WaitGroup
	wg.Add(1)
	m.incoming <- Event{
		Type: internalRunFunctionMarker,
		Object: functionFakeRuntimeObject(func() {
			defer wg.Done()
			f()
		}),
	}
	wg.Wait()
}
```

### 2.4 eventBroadcaster

eventBroadcasterImpl 是 EventBroadcaster 实现

#### eventBroadcasterImpl 定义

```go
type eventBroadcasterImpl struct {
	*watch.Broadcaster
	sleepDuration  time.Duration
	options        CorrelatorOptions
	cancelationCtx context.Context
	cancel         func()
}
```

#### eventBroadcasterImpl 创建
```go
func NewBroadcaster() EventBroadcaster {
	return newEventBroadcaster(watch.NewLongQueueBroadcaster(maxQueuedEvents, watch.DropIfChannelFull), defaultSleepDuration)
}

func newEventBroadcaster(broadcaster *watch.Broadcaster, sleepDuration time.Duration) *eventBroadcasterImpl {
	eventBroadcaster := &eventBroadcasterImpl{
		Broadcaster:   broadcaster,
		sleepDuration: sleepDuration,
	}
	eventBroadcaster.cancelationCtx, eventBroadcaster.cancel = context.WithCancel(context.Background())
	return eventBroadcaster
}
```

#### eventBroadcasterImpl 执行
以 Deployment 控制器使用 Event 的代码为例:

```go
func NewDeploymentController(dInformer appsinformers.DeploymentInformer, rsInformer appsinformers.ReplicaSetInformer, podInformer coreinformers.PodInformer, client clientset.Interface) (*DeploymentController, error) {

	// 1. 创建 eventBroadcasterImpl
	eventBroadcaster := record.NewBroadcaster()

	dc := &DeploymentController{
		client:           client,
		eventBroadcaster: eventBroadcaster,
		// 2. 创建与 eventBroadcasterImpl 关联的 Recorder
		eventRecorder:    eventBroadcaster.NewRecorder(scheme.Scheme, v1.EventSource{Component: "deployment-controller"}),
		queue:            workqueue.NewNamedRateLimitingQueue(workqueue.DefaultControllerRateLimiter(), "deployment"),
	}
}

// Run begins watching and syncing.
func (dc *DeploymentController) Run(ctx context.Context, workers int) {
	defer utilruntime.HandleCrash()

	// 3. Start events processing pipeline.
	dc.eventBroadcaster.StartStructuredLogging(0)
	dc.eventBroadcaster.StartRecordingToSink(&v1core.EventSinkImpl{Interface: dc.client.CoreV1().Events("")})
	defer dc.eventBroadcaster.Shutdown()
}
```

eventBroadcasterImpl 向下广播是通过 StartStructuredLogging，StartRecordingToSink 进行的。

```go
// StartStructuredLogging starts sending events received from this EventBroadcaster to the structured logging function.
// The return value can be ignored or used to stop recording, if desired.
func (e *eventBroadcasterImpl) StartStructuredLogging(verbosity klog.Level) watch.Interface {
	return e.StartEventWatcher(
		func(e *v1.Event) {
			klog.V(verbosity).InfoS("Event occurred", "object", klog.KRef(e.InvolvedObject.Namespace, e.InvolvedObject.Name), "fieldPath", e.InvolvedObject.FieldPath, "kind", e.InvolvedObject.Kind, "apiVersion", e.InvolvedObject.APIVersion, "type", e.Type, "reason", e.Reason, "message", e.Message)
		})
}

// StartRecordingToSink starts sending events received from the specified eventBroadcaster to the given sink.
// The return value can be ignored or used to stop recording, if desired.
// TODO: make me an object with parameterizable queue length and retry interval
func (e *eventBroadcasterImpl) StartRecordingToSink(sink EventSink) watch.Interface {
	eventCorrelator := NewEventCorrelatorWithOptions(e.options)
	return e.StartEventWatcher(
		func(event *v1.Event) {
			// 4. 处理消息的是 recordToSink 方法
			e.recordToSink(sink, event, eventCorrelator)
		})
}

```

这两个方法最终调用的都是 StartEventWatcher 方法。StartEventWatcher 方法也很简单，Broadcaster 添加一个 Watcher，然后接受广播过来的 Event 进行处理。

```go
// StartEventWatcher starts sending events received from this EventBroadcaster to the given event handler function.
// The return value can be ignored or used to stop recording, if desired.
func (e *eventBroadcasterImpl) StartEventWatcher(eventHandler func(*v1.Event)) watch.Interface {
	watcher, err := e.Watch()
	if err != nil {
		klog.Errorf("Unable start event watcher: '%v' (will not retry!)", err)
	}
	go func() {
		defer utilruntime.HandleCrash()
		for watchEvent := range watcher.ResultChan() {
			event, ok := watchEvent.Object.(*v1.Event)
			if !ok {
				// This is all local, so there's no reason this should
				// ever happen.
				continue
			}
			eventHandler(event)
		}
	}()
	return watcher
}
```

### 2.5 StartRecordingToSink
StartRecordingToSink 中实际处理 event 的是 recordToSink 方法。recordToSink 里面包含了一系列与 Event 处理相关的对象

```go
dc.eventBroadcaster.StartRecordingToSink(&v1core.EventSinkImpl{Interface: dc.client.CoreV1().Events("")})
func (e *eventBroadcasterImpl) StartRecordingToSink(sink EventSink) watch.Interface {
	eventCorrelator := NewEventCorrelatorWithOptions(e.options)
	return e.StartEventWatcher(
		func(event *v1.Event) {
			// 4. 处理消息的是 recordToSink 方法
			e.recordToSink(sink, event, eventCorrelator)
		})
}
```

StartRecordingToSink 目的是将消息传递给 sink，这个 sink 是什么呢？EventSinkImpl 是实现了 EventSink 接口的对象，我们先来看看 EventSink 接口:

```go
// EventSink knows how to store events (client.Client implements it.)
// EventSink must respect the namespace that will be embedded in 'event'.
// It is assumed that EventSink will return the same sorts of errors as
// pkg/client's REST client.
type EventSink interface {
	Create(event *v1.Event) (*v1.Event, error)
	Update(event *v1.Event) (*v1.Event, error)
	Patch(oldEvent *v1.Event, data []byte) (*v1.Event, error)
}
```

EventSink 接口定义了如何保存 event 的操作。`dc.client.CoreV1()` 指向的是 client-go 中的 reset Client 对象，`dc.client.CoreV1().Events("")` 返回的是 client-go/kubernetes/typed/core/v1/event.go 中的 event struct，这个 event 实现了同文件的 EventInterface 接口也就实现了 EventSink 接口。

```go
type EventInterface interface {
	Create(ctx context.Context, event *v1.Event, opts metav1.CreateOptions) (*v1.Event, error)
	Update(ctx context.Context, event *v1.Event, opts metav1.UpdateOptions) (*v1.Event, error)
	Delete(ctx context.Context, name string, opts metav1.DeleteOptions) error
	DeleteCollection(ctx context.Context, opts metav1.DeleteOptions, listOpts metav1.ListOptions) error
	Get(ctx context.Context, name string, opts metav1.GetOptions) (*v1.Event, error)
	List(ctx context.Context, opts metav1.ListOptions) (*v1.EventList, error)
	Watch(ctx context.Context, opts metav1.ListOptions) (watch.Interface, error)
	Patch(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions, subresources ...string) (result *v1.Event, err error)
	Apply(ctx context.Context, event *corev1.EventApplyConfiguration, opts metav1.ApplyOptions) (result *v1.Event, err error)
	EventExpansion
}

type events struct {
	client rest.Interface
	ns     string
}
```

#### recordToSink
代码如下，在 recordToSink 的代码中:
1. eventCorrelator: 用于处理消息的聚合、限流
2. recordEvent: 具体执行将 event 写到 sink 的过程

```go
func (e *eventBroadcasterImpl) recordToSink(sink EventSink, event *v1.Event, eventCorrelator *EventCorrelator) {
	// Make a copy before modification, because there could be multiple listeners.
	// Events are safe to copy like this.
	eventCopy := *event
	event = &eventCopy
	result, err := eventCorrelator.EventCorrelate(event)
	if err != nil {
		utilruntime.HandleError(err)
	}
	if result.Skip {
		return
	}
	tries := 0
	for {
		// 具体执行将 event 写到 sink 的过程，这里是在 if 的条件里，所以直到成功了才会 break
		if recordEvent(sink, result.Event, result.Patch, result.Event.Count > 1, eventCorrelator) {
			break
		}
		tries++
		if tries >= maxTriesPerEvent {
			klog.Errorf("Unable to write event '%#v' (retry limit exceeded!)", event)
			break
		}

		// Randomize the first sleep so that various clients won't all be
		// synced up if the master goes down.
		// 第一次 sleep 随机一点，避免 apiserver 失联的时候所有 client 一起失败
		delay := e.sleepDuration
		if tries == 1 {
			delay = time.Duration(float64(delay) * rand.Float64())
		}
		select {
		case <-e.cancelationCtx.Done():
			klog.Errorf("Unable to write event '%#v' (broadcaster is shut down)", event)
			return
		case <-time.After(delay):
		}
	}
}
```

#### recordEvent
```go
func recordEvent(sink EventSink, event *v1.Event, patch []byte, updateExistingEvent bool, eventCorrelator *EventCorrelator) bool {
   var newEvent *v1.Event
   var err error
   if updateExistingEvent { // 如果是更新已有的 event，则调用 Patch 方法
      newEvent, err = sink.Patch(event, patch)
   }
   // 更新可能失败，因为这个 event 可能已经被删除了
   if !updateExistingEvent || (updateExistingEvent && util.IsKeyNotFoundError(err)) {
      // 如果是新建，则需要确保 ResourceVersion 为空
      event.ResourceVersion = ""
      newEvent, err = sink.Create(event)
   }
   if err == nil {
      // 更新 eventCorrelator 状态
      eventCorrelator.UpdateState(newEvent)
      return true
   }

   // 连不上 apiserver 等原因引起的失败
   switch err.(type) {
   case *restclient.RequestConstructionError:
      // 这种情况重试也会失败，所以直接返回 true
      klog.Errorf("Unable to construct event '%#v': '%v' (will not retry!)", event, err)
      return true
   case *errors.StatusError: // 服务器端拒绝更新，放弃
      if errors.IsAlreadyExists(err) {
         klog.V(5).Infof("Server rejected event '%#v': '%v' (will not retry!)", event, err)
      } else {
         klog.Errorf("Server rejected event '%#v': '%v' (will not retry!)", event, err)
      }
      return true
   case *errors.UnexpectedObjectError:
   default: // http 传输问题，比如失联，需要重试

   }
   klog.Errorf("Unable to write event: '%#v': '%v'(may retry after sleeping)", event, err)
   return false
}
```

## 3. Event 聚合和限流
EventCorrelator 的作用是预处理所有 events，聚合频繁产生的相似的 events，将多次接受到的 events 聚合成一个等，从而降低系统压力。

### 3.1 EventCorrelator
#### EventCorrelator 定义

```go
// EventCorrelator processes all incoming events and performs analysis to avoid overwhelming the system.  It can filter all
// incoming events to see if the event should be filtered from further processing.  It can aggregate similar events that occur
// frequently to protect the system from spamming events that are difficult for users to distinguish.  It performs de-duplication
// to ensure events that are observed multiple times are compacted into a single event with increasing counts.
type EventCorrelator struct {
	// the function to filter the event
	filterFunc EventFilterFunc
	// the object that performs event aggregation
	aggregator *EventAggregator
	// the object that observes events as they come through
	logger *eventLogger
}
```

EventCorrelator是一个处理所有传入事件并执行分析以避免过载系统的程序
1. 它可以过滤所有传入事件以查看是否应从进一步处理中过滤事件
2. 它可以聚合频繁发生的类似事件，以保护系统免受难以区分的垃圾邮件事件
3. 它执行去重以确保多次观察到的事件被压缩成具有增加计数的单个事件。

EventCorrelator包含三个成员变量：
1. filterFunc: 用于过滤事件的函数，实现在 EventSourceObjectSpamFilter
2. aggregator: 执行事件聚合的对象，实现在 EventAggregator
3. logger: logger是观察事件的对象，实现在 eventLogger

#### EventCorrelator 创建

```go
eventCorrelator := NewEventCorrelatorWithOptions(e.options)

func NewEventCorrelatorWithOptions(options CorrelatorOptions) *EventCorrelator {
	optionsWithDefaults := populateDefaults(options)
	spamFilter := NewEventSourceObjectSpamFilter(
		optionsWithDefaults.LRUCacheSize,
		optionsWithDefaults.BurstSize,
		optionsWithDefaults.QPS,
		optionsWithDefaults.Clock,
		optionsWithDefaults.SpamKeyFunc)
	return &EventCorrelator{
		
		// EventSourceObjectSpamFilter
		filterFunc: spamFilter.Filter,

		// EventAggregator
		aggregator: NewEventAggregator(
			optionsWithDefaults.LRUCacheSize,
			optionsWithDefaults.KeyFunc,
			optionsWithDefaults.MessageFunc,
			optionsWithDefaults.MaxEvents,
			optionsWithDefaults.MaxIntervalInSeconds,
			optionsWithDefaults.Clock),

		// eventLogger
		logger: newEventLogger(optionsWithDefaults.LRUCacheSize, optionsWithDefaults.Clock),
	}
}
```

### 3.2 EventFilterFunc
EventFilterFunc 的实现包含在 EventSourceObjectSpamFilter 中。EventSourceObjectSpamFilter 实现的是一个桶排序算法，负责限制源和对象可以产生的事件数量。

```go
// EventFilterFunc is a function that returns true if the event should be skipped
type EventFilterFunc func(event *v1.Event) bool

// NewEventSourceObjectSpamFilter allows burst events from a source about an object with the specified qps refill.
func NewEventSourceObjectSpamFilter(lruCacheSize, burst int, qps float32, clock clock.PassiveClock, spamKeyFunc EventSpamKeyFunc) *EventSourceObjectSpamFilter {
	return &EventSourceObjectSpamFilter{
		cache:       lru.New(lruCacheSize),
		burst:       burst,
		qps:         qps,
		clock:       clock,
		spamKeyFunc: spamKeyFunc,
	}
}

// EventSourceObjectSpamFilter is responsible for throttling
// the amount of events a source and object can produce.
type EventSourceObjectSpamFilter struct {
	sync.RWMutex

	// the cache that manages last synced state
	cache *lru.Cache

	// burst is the amount of events we allow per source + object
	burst int

	// qps is the refill rate of the token bucket in queries per second
	qps float32

	// clock is used to allow for testing over a time interval
	clock clock.PassiveClock

	// spamKeyFunc is a func used to create a key based on an event, which is later used to filter spam events.
	spamKeyFunc EventSpamKeyFunc
}

// Filter controls that a given source+object are not exceeding the allowed rate.
func (f *EventSourceObjectSpamFilter) Filter(event *v1.Event) bool {
	var record spamRecord

	// controls our cached information about this event
	eventKey := f.spamKeyFunc(event)

	// do we have a record of similar events in our cache?
	f.Lock()
	defer f.Unlock()
	value, found := f.cache.Get(eventKey)
	if found {
		record = value.(spamRecord)
	}

	// verify we have a rate limiter for this record
	if record.rateLimiter == nil {
		// 默认一个 source+object 的 burst 是 25 ，qps 是 1/300（5分钟一个），也就是令牌桶初始容量是 25，然后 5 分钟才会多一个令牌进来
		record.rateLimiter = flowcontrol.NewTokenBucketPassiveRateLimiterWithClock(f.qps, f.burst, f.clock)
	}

	// ensure we have available rate
	filter := !record.rateLimiter.TryAccept()

	// update the cache
	f.cache.Add(eventKey, record)

	return filter
}
```

### 3.3 EventAggregator
EventAggregator 的作用是将相似的 events 聚合成一个 event。

```go
type EventAggregator struct {
   sync.RWMutex
   cache *lru.Cache
   keyFunc EventAggregatorKeyFunc  // 将事件分组以进行聚合的函数
   messageFunc EventAggregatorMessageFunc // 为聚合的 event 生成一个 聚合 message
   maxEvents uint            // 当相似 event 数量超过这个最大值时就触发聚合操作，默认是 10
   maxIntervalInSeconds uint // 过了这个间隔的两个相似 event 被认为是一个新的 event，默认 10min
   clock clock.PassiveClock
}
```

#### EventAggregatorByReasonFunc
EventAggregatorByReasonFunc 是 EventAggregatorKeyFunc 的实现

```go
func EventAggregatorByReasonFunc(event *v1.Event) (string, string) {
	return strings.Join([]string{
		event.Source.Component,
		event.Source.Host,
		event.InvolvedObject.Kind,
		event.InvolvedObject.Namespace,
		event.InvolvedObject.Name,
		string(event.InvolvedObject.UID),
		event.InvolvedObject.APIVersion,
		event.Type,
		event.Reason,
		event.ReportingController,
		event.ReportingInstance,
	},
		""), event.Message
}
```

#### EventAggregatorByReasonMessageFunc
EventAggregatorByReasonMessageFunc 是 EventAggregatorMessageFunc 的实现

```go
func EventAggregatorByReasonMessageFunc(event *v1.Event) string {
	return "(combined from similar events): " + event.Message
}
```

### 3.4 EventAggregate
聚合过程在 EventAggregate() 方法中实现，EventAggregate 检查是否根据聚合配置（最大事件，最大间隔等）看到了类似的事件，并返回:

```go
// EventAggregate checks if a similar event has been seen according to the
// aggregation configuration (max events, max interval, etc) and returns:
//
//   - The (potentially modified) event that should be created
//   - The cache key for the event, for correlation purposes. This will be set to
//     the full key for normal events, and to the result of
//     EventAggregatorMessageFunc for aggregate events.
func (e *EventAggregator) EventAggregate(newEvent *v1.Event) (*v1.Event, string) {
	now := metav1.NewTime(e.clock.Now())
	var record aggregateRecord
	// eventKey is the full cache key for this event
	eventKey := getEventKey(newEvent)
	// aggregateKey is for the aggregate event, if one is needed.
	aggregateKey, localKey := e.keyFunc(newEvent)

	// Do we have a record of similar events in our cache?
	e.Lock()
	defer e.Unlock()
	value, found := e.cache.Get(aggregateKey)
	if found {
		record = value.(aggregateRecord)
	}

	// Is the previous record too old? If so, make a fresh one. Note: if we didn't
	// find a similar record, its lastTimestamp will be the zero value, so we
	// create a new one in that case.
	maxInterval := time.Duration(e.maxIntervalInSeconds) * time.Second
	interval := now.Time.Sub(record.lastTimestamp.Time)
	if interval > maxInterval {
		record = aggregateRecord{localKeys: sets.NewString()}
	}

	// Write the new event into the aggregation record and put it on the cache
	record.localKeys.Insert(localKey)
	record.lastTimestamp = now
	e.cache.Add(aggregateKey, record)

	// If we are not yet over the threshold for unique events, don't correlate them
	if uint(record.localKeys.Len()) < e.maxEvents {
		return newEvent, eventKey
	}

	// do not grow our local key set any larger than max
	record.localKeys.PopAny()

	// create a new aggregate event, and return the aggregateKey as the cache key
	// (so that it can be overwritten.)
	eventCopy := &v1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("%v.%x", newEvent.InvolvedObject.Name, now.UnixNano()),
			Namespace: newEvent.Namespace,
		},
		Count:          1,
		FirstTimestamp: now,
		InvolvedObject: newEvent.InvolvedObject,
		LastTimestamp:  now,
		Message:        e.messageFunc(newEvent),
		Type:           newEvent.Type,
		Reason:         newEvent.Reason,
		Source:         newEvent.Source,
	}
	return eventCopy, aggregateKey
}

```

### 3.5 eventLogger
eventLogger 是将一个新产生的 Event 和 LRU 缓存里的做对比，如果 key 一致，也就是两个 Event 表示的信息一样，则更新缓存；如果不一样，就加到缓存里。

```go
// eventLogger logs occurrences of an event
type eventLogger struct {
	sync.RWMutex
	cache *lru.Cache
	clock clock.PassiveClock
}

// newEventLogger observes events and counts their frequencies
func newEventLogger(lruCacheEntries int, clock clock.PassiveClock) *eventLogger {
	return &eventLogger{cache: lru.New(lruCacheEntries), clock: clock}
}
```

eventLogger 有一个 eventObserve() 方法，如果 key 是相同的，这个方法会直接更新已经存在的 event，反之增加一个新的 event

```go
func (e *eventLogger) eventObserve(newEvent *v1.Event, key string) (*v1.Event, []byte, error) {
   var (
      patch []byte
      err   error
   )
   eventCopy := *newEvent // 复制一份
   event := &eventCopy

   e.Lock()
   defer e.Unlock()

   // 检查缓存里是否有需要更新的 event，这里的 key 就是前面提到的 EventAggregatorByReasonFunc() 计算出来的 key
   lastObservation := e.lastEventObservationFromCache(key)

   // 如果发现了需要更新的 event，也就是新的 event 已经存在已经老的和其各个属性都一样，Reason、Message 等都一样，而且属于同一个对象
   if lastObservation.count > 0 {
      // update the event based on the last observation so patch will work as desired
      event.Name = lastObservation.name
      event.ResourceVersion = lastObservation.resourceVersion
      event.FirstTimestamp = lastObservation.firstTimestamp // Event 构造的时候会设置 firstTimestamp 和 lastTimestamp，这里更新了 firstTimestamp
      event.Count = int32(lastObservation.count) + 1 // 计数器加1

      eventCopy2 := *event
      eventCopy2.Count = 0
      eventCopy2.LastTimestamp = metav1.NewTime(time.Unix(0, 0))
      eventCopy2.Message = ""

      newData, _ := json.Marshal(event)
      oldData, _ := json.Marshal(eventCopy2)
      patch, err = strategicpatch.CreateTwoWayMergePatch(oldData, newData, event)
   }

   // 记录新观察到的 Event
   e.cache.Add(
      key,
      eventLog{
         count:           uint(event.Count),
         firstTimestamp:  event.FirstTimestamp,
         name:            event.Name,
         resourceVersion: event.ResourceVersion,
      },
   )
   return event, patch, err
}
```

### 3.6 EventCorrelate 方法
recordToSink 中调用的是 eventCorrelator.EventCorrelate(event) 方法:

```go
// EventCorrelate filters, aggregates, counts, and de-duplicates all incoming events
func (c *EventCorrelator) EventCorrelate(newEvent *v1.Event) (*EventCorrelateResult, error) {
	if newEvent == nil {
		return nil, fmt.Errorf("event is nil")
	}
	// 聚合 event
	aggregateEvent, ckey := c.aggregator.EventAggregate(newEvent)
	// 
	observedEvent, patch, err := c.logger.eventObserve(aggregateEvent, ckey)
	// 过滤
	if c.filterFunc(observedEvent) {
		return &EventCorrelateResult{Skip: true}, nil
	}
	return &EventCorrelateResult{Event: observedEvent, Patch: patch}, err
}
```

## 4. EventRecorder
EventRecorder 是与 EventBroadcaster 关联的事件源，从 EventBroadcaster 产生，代码如下:

```go
recorder := eventBroadcaster.NewRecorder(scheme.Scheme, v1.EventSource{Component: "job-controller"})
recorder.Eventf(object, v1.EventTypeWarning, FailedCreatePodReason, "Error creating: %v", err)
```

EventSource 结构很简单：

```go
type EventSource struct {
   // Event 从哪个组件来的，比如：job-controller
   Component string `json:"component,omitempty" protobuf:"bytes,1,opt,name=component"`
   // Event 从哪个节点来的
   Host string `json:"host,omitempty" protobuf:"bytes,2,opt,name=host"`
}

```

### 4.1 recorderImpl
EventRecorder 接口有两个实现:
1. recorderImpl
2. FakeRecorder

```go
// NewRecorder returns an EventRecorder that records events with the given event source.
func (e *eventBroadcasterImpl) NewRecorder(scheme *runtime.Scheme, source v1.EventSource) EventRecorder {
	return &recorderImpl{scheme, source, e.Broadcaster, clock.RealClock{}}
}

type recorderImpl struct {
	scheme *runtime.Scheme
	source v1.EventSource
	*watch.Broadcaster
	clock clock.PassiveClock
}
```

#### Eventf
Eventf() 方法只是简单地通过 fmt.Sprintf() 格式化字符串后调用 Event()

```go
func (recorder *recorderImpl) Event(object runtime.Object, eventtype, reason, message string) {
    recorder.generateEvent(object, nil, eventtype, reason, message)
}

func (recorder *recorderImpl) Eventf(object runtime.Object, eventtype, reason, messageFmt string, args ...interface{}) {
   recorder.Event(object, eventtype, reason, fmt.Sprintf(messageFmt, args...))
}

func (recorder *recorderImpl) generateEvent(object runtime.Object, annotations map[string]string, eventtype, reason, message string) {
   ref, err := ref.GetReference(recorder.scheme, object) // 获取 object 的 ObjectReference
   if err != nil {
      klog.Errorf("Could not construct reference to: '%#v' due to: '%v'. Will not report event: '%v' '%v' '%v'", object, err, eventtype, reason, message)
      return
   }

   if !util.ValidateEventType(eventtype) { // 校验 eventtype 是 "Normal"/"Warning"
      klog.Errorf("Unsupported event type: '%v'", eventtype)
      return
   }

   event := recorder.makeEvent(ref, annotations, eventtype, reason, message) // 构建 event
   event.Source = recorder.source
   // events 操作不应该阻塞，如果 event 太多的时候直接丢弃，然后打印一个日志
   if sent := recorder.ActionOrDrop(watch.Added, event); !sent {
      klog.Errorf("unable to record event: too many queued events, dropped event %#v", event)
   }
}
```

这里有两个函数调用：
1. makeEvent(): 构造一个 Event 对象
2. ActionOrDrop(): 往 Broadcaster.incoming channel 中写入 Event，如果失败了就直接 Drop 掉

```go
func (m *Broadcaster) ActionOrDrop(action EventType, obj runtime.Object) bool {
   select {
   case m.incoming <- Event{action, obj}:
      return true
   default:
      return false
   }
}
```