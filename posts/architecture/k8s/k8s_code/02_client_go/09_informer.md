---
weight: 1
title: "client-go Informer"
date: 2023-03-01T22:00:00+08:00
lastmod: 2023-03-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "client-go Informer"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---

## 1. Informer 概述

在 client-go Informer 的核心是 sharedIndexInformer 对象，从 UML 类图中我们可以看到:
1. sharedIndexInformer 实现了以下接口:
    - SharedIndexInformer: 定义 Informer 
    - ResourceEventHandler: 定义 Event 事件处理函数
    - Controller: 定义 Informer 的执行
2. sharedIndexInformer 包含如下成员对象:
    - indexer: 缓存，缓存 API 对象
    - listerWatcher: ListerWatcher，list 和 watch apiserver 
    - controller: Controller 接口的实现
    - processor: 辅助实现 ResourceEventHandler 接口

![informer puml](/images/k8s/k8s_code/informer.svg)

我们 sharedIndexInformer 的定义和初始化开始，逐一介绍这些对象。

## 2. sharedIndexInformer
### 2.1 定义

```go
type sharedIndexInformer struct {
	indexer    Indexer
	controller Controller

	processor             *sharedProcessor

    // defaultCacheMutationDetector提供了一种检测缓存对象是否被修改的方法。
    // 它有一个缓存对象及其副本列表。我还没有想到一种方法来查看是谁在修改它，只知道它被修改了。
	cacheMutationDetector MutationDetector 

	listerWatcher ListerWatcher

	// objectType 是该informer预期处理的类型的示例对象。如果设置了，具有不匹配类型的对象的事件会被丢弃，而不是被传递给监听器。
	objectType runtime.Object

	// objectDescription 是该informer对象的描述。
	objectDescription string

	// resyncCheckPeriod 是我们希望reflector的重新同步定时器触发的频率，以便它可以调用shouldResync检查我们的任何监听器是否需要重新同步。
	resyncCheckPeriod time.Duration
	// defaultEventHandlerResyncPeriod是通过AddEventHandler添加的任何处理程序的默认重新同步周期（即，它们没有指定一个并且只想使用共享informer的默认值）。
	defaultEventHandlerResyncPeriod time.Duration
	// clock允许进行可测试性
	clock clock.Clock

	started, stopped bool
	startedLock      sync.Mutex

	// blockDeltas提供了一种停止所有事件分发的方式，以便后加入共享informer的事件处理程序可以安全地加入sharedIndexInformer。
    blockDeltas sync.Mutex
	// 当ListAndWatch由于错误而断开连接时调用。
	watchErrorHandler WatchErrorHandler

	transform TransformFunc
}
```

### 2.2 初始化

```go
func NewSharedIndexInformerWithOptions(lw ListerWatcher, exampleObject runtime.Object, options SharedIndexInformerOptions) SharedIndexInformer {
	realClock := &clock.RealClock{}

	return &sharedIndexInformer{
		indexer:                         NewIndexer(DeletionHandlingMetaNamespaceKeyFunc, options.Indexers),
		processor:                       &sharedProcessor{clock: realClock},
		listerWatcher:                   lw,
		objectType:                      exampleObject,
		objectDescription:               options.ObjectDescription,
		resyncCheckPeriod:               options.ResyncPeriod,
		defaultEventHandlerResyncPeriod: options.ResyncPeriod,
		clock:                           realClock,
		cacheMutationDetector:           NewCacheMutationDetector(fmt.Sprintf("%T", exampleObject)),
	}
}

// SharedIndexInformerOptions configures a sharedIndexInformer.
type SharedIndexInformerOptions struct {
	// ResyncPeriod is the default event handler resync period and resync check
	// period. If unset/unspecified, these are defaulted to 0 (do not resync).
	ResyncPeriod time.Duration

	// Indexers is the sharedIndexInformer's indexers. If unset/unspecified, no indexers are configured.
	Indexers Indexers

	// ObjectDescription is the sharedIndexInformer's object description. This is passed through to the
	// underlying Reflector's type description.
	ObjectDescription string
}
```

### 2.3 Run 方法
![自定义控制器工作流程](/images/k8s/k8s_code/client-go-process.png)

从 sharedIndexInformer Run 方法的实现中，我们可以看到 sharedIndexInformer 本质上是一个大的容器对象，他把:
1. 自定义控制器中执行的 1-4 交给了 controller 对象
2. 自定义控制器中执行的 5 交给了 sharedProcessor 对象

我们接下来就来重点研究 controller 和 sharedProcessor

```go
func (s *sharedIndexInformer) Run(stopCh <-chan struct{}) {
	defer utilruntime.HandleCrash()

	if s.HasStarted() {
		klog.Warningf("The sharedIndexInformer has started, run more than once is not allowed")
		return
	}
    // 1. 创建 DeltaFIFO
	fifo := NewDeltaFIFOWithOptions(DeltaFIFOOptions{
		KnownObjects:          s.indexer,
		EmitDeltaTypeReplaced: true,
	})

    // 2. 创建 Config
	cfg := &Config{
		Queue:             fifo,
		ListerWatcher:     s.listerWatcher,
		ObjectType:        s.objectType,
		ObjectDescription: s.objectDescription,
		FullResyncPeriod:  s.resyncCheckPeriod,
		RetryOnError:      false,
		ShouldResync:      s.processor.shouldResync,
        // HandleDeltas 很重要，后面我们可以看到他的调用过程
		Process:           s.HandleDeltas,
		WatchErrorHandler: s.watchErrorHandler,
	}

	func() {
		s.startedLock.Lock()
		defer s.startedLock.Unlock()
        // 3. 创建 controller 对象
		s.controller = New(cfg)
		s.controller.(*controller).clock = s.clock
		s.started = true
	}()

	// Separate stop channel because Processor should be stopped strictly after controller
	processorStopCh := make(chan struct{})
	var wg wait.Group
	defer wg.Wait()              // Wait for Processor to stop
	defer close(processorStopCh) // Tell Processor to stop

    // 4. 启动 cacheMutationDetector
	wg.StartWithChannel(processorStopCh, s.cacheMutationDetector.Run)
    // 5. 启动 sharedProcessor
	wg.StartWithChannel(processorStopCh, s.processor.run)

	defer func() {
		s.startedLock.Lock()
		defer s.startedLock.Unlock()
		s.stopped = true // Don't want any new listeners
	}()
    // 启动 controller
	s.controller.Run(stopCh)
}
```
### 2.3 HandleDeltas 方法
sharedIndexInformer 的 HandleDeltas 很重要，后面我们就能看到它的调用过程。

```go
func (s *sharedIndexInformer) HandleDeltas(obj interface{}, isInInitialList bool) error {
	s.blockDeltas.Lock()
	defer s.blockDeltas.Unlock()

	if deltas, ok := obj.(Deltas); ok {
		return processDeltas(s, s.indexer, s.transform, deltas, isInInitialList)
	}
	return errors.New("object given as Process argument is not Deltas")
}

// 将Delta列表形式的更新复用到Store中，并通知给定处理程序的事件 OnUpdate、OnAdd、OnDelete。
func processDeltas(
	// Object which receives event notifications from the given deltas
	handler ResourceEventHandler,
	clientState Store,
	transformer TransformFunc,
	deltas Deltas,
	isInInitialList bool,
) error {
	// from oldest to newest
	for _, d := range deltas {
		obj := d.Object
		if transformer != nil {
			var err error
			obj, err = transformer(obj)
			if err != nil {
				return err
			}
		}

		switch d.Type {
		case Sync, Replaced, Added, Updated:
			if old, exists, err := clientState.Get(obj); err == nil && exists {
				if err := clientState.Update(obj); err != nil {
					return err
				}
				handler.OnUpdate(old, obj)
			} else {
				if err := clientState.Add(obj); err != nil {
					return err
				}
				handler.OnAdd(obj, isInInitialList)
			}
		case Deleted:
			if err := clientState.Delete(obj); err != nil {
				return err
			}
			handler.OnDelete(obj)
		}
	}
	return nil
}
```
HandleDeltas 的核心逻辑实现在 processDeltas，其主要逻辑是 是遍历一个 Deltas 里的所有 Delta，然后根据 Delta 的类型来决定如何操作 Indexer，也就是更新本地 cache，同时分发相应的通知。 

从传参上也能看出，sharedIndexInformer 需要实现 ResourceEventHandler 接口，完成事件的分发，这一部分与 sharedProcessor 有关，我们等到后面介绍 sharedProcessor 时，在详细介绍这几个函数的实现。


## 3. controller

### 3.1 定义和初始化
```go
type controller struct {
	config         Config
	reflector      *Reflector
	reflectorMutex sync.RWMutex
	clock          clock.Clock
}

func New(c *Config) Controller {
	ctlr := &controller{
		config: *c,
		clock:  &clock.RealClock{},
	}
	return ctlr
}
```

可以看到，controller 的定义中包括 Reflector，证明我们前面所说的"自定义控制器中执行的 1-4 交给了 controller 对象"。controller 的核心逻辑都在 Run 方法中，我们继续往下看。

### 3.2 Run 方法

```go
func (c *controller) Run(stopCh <-chan struct{}) {
	defer utilruntime.HandleCrash()
	go func() {
		<-stopCh
        // config.Queue 即 DeltaFIFO
		c.config.Queue.Close()
	}()
    // 1. 创建 Reflector
	r := NewReflectorWithOptions(
		c.config.ListerWatcher,
		c.config.ObjectType,
		c.config.Queue,
		ReflectorOptions{
			ResyncPeriod:    c.config.FullResyncPeriod,
			TypeDescription: c.config.ObjectDescription,
			Clock:           c.clock,
		},
	)
	r.ShouldResync = c.config.ShouldResync
	r.WatchListPageSize = c.config.WatchListPageSize
	if c.config.WatchErrorHandler != nil {
		r.watchErrorHandler = c.config.WatchErrorHandler
	}

	c.reflectorMutex.Lock()
	c.reflector = r
	c.reflectorMutex.Unlock()

	var wg wait.Group

    // 2. 启动 Reflector
	wg.StartWithChannel(stopCh, r.Run)
    // 3. 执行 Controller 的 processLoop
	wait.Until(c.processLoop, time.Second, stopCh)
	wg.Wait()
}

```

controller.Run 方法中主要是实例化一个 Reflector，controller 的逻辑则隐藏在 processLoop 方法里。

### 3.2 processLoop 方法
c.config.Process 是 sharedIndexInformer.HandleDeltas  方法，完成本地缓存的更新和事件分发。

```go
func (c *controller) processLoop() {
	for {
		obj, err := c.config.Queue.Pop(PopProcessFunc(c.config.Process))
		if err != nil {
			if err == ErrFIFOClosed {
				return
			}
			if c.config.RetryOnError {
				// This is the safe way to re-enqueue.
				c.config.Queue.AddIfNotPresent(obj)
			}
		}
	}
}
```

到这里 controller 的实现就差不多了，我们继续看 sharedProcessor 的实现。

## 4. sharedProcessor
结合前面的信息以及[sample-controller](https://github.com/kubernetes/sample-controller/blob/master/controller.go)，sharedProcessor 完成事件分发需要如下几步:
2. 接收方:
    - sharedProcessor 的定义中包含一个 processorListener 对象的集合，每一个 processorListener 都是一个事件接收方
    - sharedIndexInformer.AddEventHandler 方法会调用 sharedProcessor.addListener 方法添加一个 processorListener
1. 事件源: 
    - sharedIndexInformer 实现了 ResourceEventHandler 接口，HandleDeltas 会调用这些方法，而这些方法向 sharedProcessor 传递事件的入口
3. 事件传递:
    - 在 sharedIndexInformer.Run 中会调用 sharedProcessor 的 Run 方法，Run 方法会调用 processorListener 的 run 和 pop 方法
    - sharedIndexInformer 实现的 ResourceEventHandler 接口方法会调用 sharedProcessor 的 distribute 方法，distribute 会调用 processorListener 的 add 方法
    - processorListener 通过 add/run/pop 三个方法完成事件的接收和处理

sharedProcessor 的定义如下:

```go
type sharedProcessor struct {
	listenersStarted bool
	listenersLock    sync.RWMutex
	// Map from listeners to whether or not they are currently syncing
	listeners map[*processorListener]bool
	clock     clock.Clock
	wg        wait.Group
}
```

### 4.1 接收方
下面是 [sample-controller](https://github.com/kubernetes/sample-controller/blob/master/controller.go) 中的示例。调用 AddEventHandler，我们会把接收到的对象放到了 workqueue 中。

```go
fooInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: controller.enqueueFoo,
		UpdateFunc: func(old, new interface{}) {
			controller.enqueueFoo(new)
		},
	})
```

#### sharedIndexInformer.AddEventHandler

```go
func (s *sharedIndexInformer) AddEventHandler(handler ResourceEventHandler) (ResourceEventHandlerRegistration, error) {
	return s.AddEventHandlerWithResyncPeriod(handler, s.defaultEventHandlerResyncPeriod)
}

func (s *sharedIndexInformer) AddEventHandlerWithResyncPeriod(handler ResourceEventHandler, resyncPeriod time.Duration) (ResourceEventHandlerRegistration, error) {
	s.startedLock.Lock()
	defer s.startedLock.Unlock()

	if s.stopped {
		return nil, fmt.Errorf("handler %v was not added to shared informer because it has stopped already", handler)
	}

	if resyncPeriod > 0 {
		if resyncPeriod < minimumResyncPeriod {
			klog.Warningf("resyncPeriod %v is too small. Changing it to the minimum allowed value of %v", resyncPeriod, minimumResyncPeriod)
			resyncPeriod = minimumResyncPeriod
		}

		if resyncPeriod < s.resyncCheckPeriod {
			if s.started {
				klog.Warningf("resyncPeriod %v is smaller than resyncCheckPeriod %v and the informer has already started. Changing it to %v", resyncPeriod, s.resyncCheckPeriod, s.resyncCheckPeriod)
				resyncPeriod = s.resyncCheckPeriod
			} else {
				// if the event handler's resyncPeriod is smaller than the current resyncCheckPeriod, update
				// resyncCheckPeriod to match resyncPeriod and adjust the resync periods of all the listeners
				// accordingly
				s.resyncCheckPeriod = resyncPeriod
				s.processor.resyncCheckPeriodChanged(resyncPeriod)
			}
		}
	}

	listener := newProcessListener(handler, resyncPeriod, determineResyncPeriod(resyncPeriod, s.resyncCheckPeriod), s.clock.Now(), initialBufferSize, s.HasSynced)

	if !s.started {
		return s.processor.addListener(listener), nil
	}

	// in order to safely join, we have to
	// 1. stop sending add/update/delete notifications
	// 2. do a list against the store
	// 3. send synthetic "Add" events to the new handler
	// 4. unblock
	s.blockDeltas.Lock()
	defer s.blockDeltas.Unlock()

	handle := s.processor.addListener(listener)
	for _, item := range s.indexer.List() {
		// Note that we enqueue these notifications with the lock held
		// and before returning the handle. That means there is never a
		// chance for anyone to call the handle's HasSynced method in a
		// state when it would falsely return true (i.e., when the
		// shared informer is synced but it has not observed an Add
		// with isInitialList being true, nor when the thread
		// processing notifications somehow goes faster than this
		// thread adding them and the counter is temporarily zero).
		listener.add(addNotification{newObj: item, isInInitialList: true})
	}
	return handle, nil
}
```

#### sharedProcessor.addListener

```go
func (p *sharedProcessor) addListener(listener *processorListener) ResourceEventHandlerRegistration {
	p.listenersLock.Lock()
	defer p.listenersLock.Unlock()

	if p.listeners == nil {
		p.listeners = make(map[*processorListener]bool)
	}

	p.listeners[listener] = true

	if p.listenersStarted {
		p.wg.Start(listener.run)
		p.wg.Start(listener.pop)
	}

	return listener
}
```

### 4.2 事件源 
#### sharedIndexInformer 实现的 ResourceEventHandler 方法
sharedIndexInformer 实现了 ResourceEventHandler 接口:

```go
// Conforms to ResourceEventHandler
func (s *sharedIndexInformer) OnAdd(obj interface{}, isInInitialList bool) {
	// Invocation of this function is locked under s.blockDeltas, so it is
	// save to distribute the notification
	s.cacheMutationDetector.AddObject(obj)
	s.processor.distribute(addNotification{newObj: obj, isInInitialList: isInInitialList}, false)
}

// Conforms to ResourceEventHandler
func (s *sharedIndexInformer) OnUpdate(old, new interface{}) {
	isSync := false

	// If is a Sync event, isSync should be true
	// If is a Replaced event, isSync is true if resource version is unchanged.
	// If RV is unchanged: this is a Sync/Replaced event, so isSync is true

	if accessor, err := meta.Accessor(new); err == nil {
		if oldAccessor, err := meta.Accessor(old); err == nil {
			// Events that didn't change resourceVersion are treated as resync events
			// and only propagated to listeners that requested resync
			isSync = accessor.GetResourceVersion() == oldAccessor.GetResourceVersion()
		}
	}

	// Invocation of this function is locked under s.blockDeltas, so it is
	// save to distribute the notification
	s.cacheMutationDetector.AddObject(new)
	s.processor.distribute(updateNotification{oldObj: old, newObj: new}, isSync)
}

// Conforms to ResourceEventHandler
func (s *sharedIndexInformer) OnDelete(old interface{}) {
	// Invocation of this function is locked under s.blockDeltas, so it is
	// save to distribute the notification
	s.processor.distribute(deleteNotification{oldObj: old}, false)
}
```
OnAdd/OnUpdate/OnDelete 这些方法最终都会调用 sharedProcessor 的 distribute 方法。

### 4.3 事件传递

#### sharedProcessor.distribute
```go
func (p *sharedProcessor) distribute(obj interface{}, sync bool) {
	p.listenersLock.RLock()
	defer p.listenersLock.RUnlock()

	for listener, isSyncing := range p.listeners {
		switch {
		case !sync:
			// non-sync messages are delivered to every listener
			listener.add(obj)
		case isSyncing:
			// sync messages are delivered to every syncing listener
			listener.add(obj)
		default:
			// skipping a sync obj for a non-syncing listener
		}
	}
}
```

#### sharedProcessor.Run 
sharedProcessor run 方法会调用 processorListener 的 run/pop 方法。

```go
func (p *sharedProcessor) run(stopCh <-chan struct{}) {
	func() {
		p.listenersLock.RLock()
		defer p.listenersLock.RUnlock()
		for listener := range p.listeners {
			p.wg.Start(listener.run)
			p.wg.Start(listener.pop)
		}
		p.listenersStarted = true
	}()
	<-stopCh

	p.listenersLock.Lock()
	defer p.listenersLock.Unlock()
	for listener := range p.listeners {
		close(listener.addCh) // Tell .pop() to stop. .pop() will tell .run() to stop
	}

	// Wipe out list of listeners since they are now closed
	// (processorListener cannot be re-used)
	p.listeners = nil

	// Reset to false since no listeners are running
	p.listenersStarted = false

	p.wg.Wait() // Wait for all .pop() and .run() to stop
}
```


## 5. processorListener
### 5.1 定义
```go
// processorListener 将来自sharedProcessor的通知转发给一个ResourceEventHandler
// processorListener使用两个goroutine、两个无缓冲通道和一个无界环形缓冲区。
//   函数`add(notification)`将给定的通知发送到`addCh`。
//   一个 goroutine 运行`pop()`，将通知从 `addCh`传递到 `nextCh`
//   另一个goroutine运行`run()`，从`nextCh`接收通知并同步调用适当的处理程序方法。
//
// processorListener 还跟踪监听器的调整后的请求重新同步周期。
type processorListener struct {
	nextCh chan interface{}
	addCh  chan interface{}

	handler ResourceEventHandler

	syncTracker *synctrack.SingleFileTracker

	// pendingNotifications是一个无界环形缓冲区，保存尚未分发的所有通知。
	// 每个监听器都有一个，但是失败/停滞的监听器将无限制地添加pendingNotifications，直到我们OOM。
	// TODO: 这不比以前更糟，因为反射器由无界DeltaFIFO支持，但我们应该继续努力改进。
	pendingNotifications buffer.RingGrowing

	// requestedResyncPeriod 是监听器想要从共享informer获得完整重新同步的频率，但是经过两次调整。一个是强制实施下限`minimumResyncPeriod`。
	// 另一个是共享informer的`resyncCheckPeriod`，这是另一个下限，只有在共享informer启动后进行AddEventHandlerWithResyncPeriod调用时，并且只有informer不进行重新同步时才强制实施。
	requestedResyncPeriod time.Duration
	// resyncPeriod是用于该监听器逻辑的阈值。该值仅在共享informer不执行重新同步时与requestedResyncPeriod不同，在这种情况下，该值为零。
	// 重新同步之间的实际时间取决于sharedProcessor的`shouldResync`函数何时被调用以及sharedIndexInformer处理`Sync`类型Delta对象的时间。
	resyncPeriod time.Duration
	// nextResync是监听器应该获得完整重新同步的最早时间。
	nextResync time.Time
	// resyncLock保护对resyncPeriod// 和nextResync的访问
	resyncLock sync.Mutex
}
```

### 5.2 初始化
```go
func newProcessListener(handler ResourceEventHandler, requestedResyncPeriod, resyncPeriod time.Duration, now time.Time, bufferSize int, hasSynced func() bool) *processorListener {
	ret := &processorListener{
		nextCh:                make(chan interface{}),
		addCh:                 make(chan interface{}),
		handler:               handler,
		syncTracker:           &synctrack.SingleFileTracker{UpstreamHasSynced: hasSynced},
		pendingNotifications:  *buffer.NewRingGrowing(bufferSize),
		requestedResyncPeriod: requestedResyncPeriod,
		resyncPeriod:          resyncPeriod,
	}

	ret.determineNextResync(now)

	return ret
}

```

### 5.3 事件处理
前面我们分析 sharedProcessor 时，已经发现 sharedProcessor 事件处理最终会调用 processorListener 的 add/run/pop 三个方法。

#### add
```go
func (p *processorListener) add(notification interface{}) {
	if a, ok := notification.(addNotification); ok && a.isInInitialList {
		p.syncTracker.Start()
	}
	p.addCh <- notification
}
```

### run
```go
func (p *processorListener) run() {
	//此调用会阻塞直到通道关闭。当通知期间发生 panic 时，我们将捕获它，跳过有问题的项！
    // 并在短暂延迟（一秒钟）后尝试下一个通知。这通常比永远不再传递更好。
	stopCh := make(chan struct{})
	wait.Until(func() {
		for next := range p.nextCh {
			switch notification := next.(type) {
			case updateNotification:
				p.handler.OnUpdate(notification.oldObj, notification.newObj)
			case addNotification:
				p.handler.OnAdd(notification.newObj, notification.isInInitialList)
				if notification.isInInitialList {
					p.syncTracker.Finished()
				}
			case deleteNotification:
				p.handler.OnDelete(notification.oldObj)
			default:
				utilruntime.HandleError(fmt.Errorf("unrecognized notification: %T", next))
			}
		}
		// the only way to get here is if the p.nextCh is empty and closed
		close(stopCh)
	}, 1*time.Second, stopCh)
}
```

### pop
```go
func (p *processorListener) pop() {
	defer utilruntime.HandleCrash()
	defer close(p.nextCh) // Tell .run() to stop

	var nextCh chan<- interface{}
	var notification interface{}
	for {
		select {
		case nextCh <- notification:
			// Notification dispatched
			var ok bool
			notification, ok = p.pendingNotifications.ReadOne()
			if !ok { // Nothing to pop
				nextCh = nil // Disable this select case
			}
        // 第一循环，肯定执行这个 case，执行之后 notification 就不可能是 nil
        // 第一次循环之后，所有的 notificationToAdd 都会先 p.pendingNotifications.WriteOne
        // 然后按照被读取顺序从 p.pendingNotifications.ReadOne 读取
		case notificationToAdd, ok := <-p.addCh:
			if !ok {
				return
			}
			if notification == nil { // No notification to pop (and pendingNotifications is empty)
				// Optimize the case - skip adding to pendingNotifications
				notification = notificationToAdd
				nextCh = p.nextCh
			} else { // There is already a notification waiting to be dispatched
				p.pendingNotifications.WriteOne(notificationToAdd)
			}
		}
	}
}
```

## 6. SharedInformerFactory
SharedInformerFactory 提供了所有 API group-version 的资源对应的 SharedIndexInformer

```go
import (
	"flag"
	"time"

	kubeinformers "k8s.io/client-go/informers"
	kubeInformerFactory := kubeinformers.NewSharedInformerFactory(kubeClient, time.Second*30)
    kubeInformerFactory.Apps().V1().Deployments().Informer()
)

```
与其他 Factory 类似，SharedInformerFactory 也是典型的三层结构:
- 'client-go/informers/factory.go'
- 'client-go/informers/apps/interface.go'
- 'client-go/informers/apps/v1/interface.go'
- 'client-go/informers/apps/v1/deployment.go'

### 6.1 定义

```go
type sharedInformerFactory struct {
	client           kubernetes.Interface
	namespace        string
	tweakListOptions internalinterfaces.TweakListOptionsFunc
	lock             sync.Mutex
	defaultResync    time.Duration
	customResync     map[reflect.Type]time.Duration

	informers map[reflect.Type]cache.SharedIndexInformer
	// startedInformers is used for tracking which informers have been started.
	// This allows Start() to be called multiple times safely.
	startedInformers map[reflect.Type]bool
	// wg tracks how many goroutines were started.
	wg sync.WaitGroup
	// shuttingDown is true when Shutdown has been called. It may still be running
	// because it needs to wait for goroutines.
	shuttingDown bool
}

```

### 6.2 初始化
```go
func NewSharedInformerFactory(client kubernetes.Interface, defaultResync time.Duration) SharedInformerFactory {
	return NewSharedInformerFactoryWithOptions(client, defaultResync)
}

func NewSharedInformerFactoryWithOptions(client kubernetes.Interface, defaultResync time.Duration, options ...SharedInformerOption) SharedInformerFactory {
	factory := &sharedInformerFactory{
		client:           client,
		namespace:        v1.NamespaceAll,
		defaultResync:    defaultResync,
		informers:        make(map[reflect.Type]cache.SharedIndexInformer),
		startedInformers: make(map[reflect.Type]bool),
		customResync:     make(map[reflect.Type]time.Duration),
	}

	// Apply all options
	for _, opt := range options {
		factory = opt(factory)
	}

	return factory
}
```

### 6.3 Deployment Informer 创建

```go
func (f *sharedInformerFactory) Apps() apps.Interface {
	return apps.New(f, f.namespace, f.tweakListOptions)
}

// apps.New
type group struct {
	factory          internalinterfaces.SharedInformerFactory
	namespace        string
	tweakListOptions internalinterfaces.TweakListOptionsFunc
}

func (g *group) V1() v1.Interface {
	return v1.New(g.factory, g.namespace, g.tweakListOptions)
}

// v1.New
type version struct {
	factory          internalinterfaces.SharedInformerFactory
	namespace        string
	tweakListOptions internalinterfaces.TweakListOptionsFunc
}

func (v *version) Deployments() DeploymentInformer {
	return &deploymentInformer{factory: v.factory, namespace: v.namespace, tweakListOptions: v.tweakListOptions}
}

// deploymentInformer
type deploymentInformer struct {
	factory          internalinterfaces.SharedInformerFactory
	tweakListOptions internalinterfaces.TweakListOptionsFunc
	namespace        string
}

func (f *deploymentInformer) Informer() cache.SharedIndexInformer {
	return f.factory.InformerFor(&appsv1.Deployment{}, f.defaultInformer)
}
```

所以 kubeInformerFactory.Apps().V1().Deployments().Informer() 最终调用的是 sharedInformerFactory 的 InformerFor 方法:

### 6.4 sharedInformerFactory.InformerFor

```go
func (f *sharedInformerFactory) InformerFor(obj runtime.Object, newFunc internalinterfaces.NewInformerFunc) cache.SharedIndexInformer {
	f.lock.Lock()
	defer f.lock.Unlock()

	informerType := reflect.TypeOf(obj)
	informer, exists := f.informers[informerType]
	if exists {
		return informer
	}

	resyncPeriod, exists := f.customResync[informerType]
	if !exists {
		resyncPeriod = f.defaultResync
	}

	informer = newFunc(f.client, resyncPeriod)
	f.informers[informerType] = informer

	return informer
}
```

InformerFor 会调用传入的 deploymentInformer.defaultInformer:

### 6.5 deploymentInformer.defaultInformer

```go
func NewFilteredDeploymentInformer(client kubernetes.Interface, namespace string, resyncPeriod time.Duration, indexers cache.Indexers, tweakListOptions internalinterfaces.TweakListOptionsFunc) cache.SharedIndexInformer {
	return cache.NewSharedIndexInformer(
		&cache.ListWatch{
			ListFunc: func(options metav1.ListOptions) (runtime.Object, error) {
				if tweakListOptions != nil {
					tweakListOptions(&options)
				}
				return client.AppsV1().Deployments(namespace).List(context.TODO(), options)
			},
			WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
				if tweakListOptions != nil {
					tweakListOptions(&options)
				}
				return client.AppsV1().Deployments(namespace).Watch(context.TODO(), options)
			},
		},
		&appsv1.Deployment{},
		resyncPeriod,
		indexers,
	)
}

func (f *deploymentInformer) defaultInformer(client kubernetes.Interface, resyncPeriod time.Duration) cache.SharedIndexInformer {
	return NewFilteredDeploymentInformer(client, f.namespace, resyncPeriod, cache.Indexers{cache.NamespaceIndex: cache.MetaNamespaceIndexFunc}, f.tweakListOptions)
}
```
