---
weight: 1
title: "Go Mutex 设计与实现"
date: 2021-05-02T22:00:00+08:00
lastmod: 2021-05-02T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go Mutex 使用与实现原理"
featuredImage: 

tags: ["go 并发"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

Go 第一个并发原语 Mutex 互斥锁
<!-- more -->

## 1. Mutex 的使用
互斥锁是最基本的并发原语，使用互斥锁，限定临界区只能同时由一个线程持有。基本上所有编程语言都会提供，Go 中互斥锁为 Mutex，Mutex 位于标准库 sync 中，其实现了 sync 中的 Locker 接口:

```go
type Locker interface{
    Lock()
    Unlock()
}
```

简单来说，互斥锁 Mutex 就提供了这两个方法 Lock 和 Unlock：进入临界区之前调用 Lock 方法，退出临界区的时候调用 Unlock 方法。很多时候 Mutex 会嵌入到其他 struct 中，比如:

```go
type Counter struct{
    Mutex
    Count uint64
}

var c Counter
c.Lock()
c.Unlock()
```

如果嵌入的 struct 有多个字段，我们一般会把 Mutex 放在要控制的字段上面，然后使用空格把字段分隔开来。以便于代码更容易理解和维护。甚至，你还可以把获取锁、释放锁、计数加一的逻辑封装成一个方法，对外不需要暴露锁等。

```Go
// 将锁封装不暴露锁
type Counter struct {
	CounterType int
	Name        string
	mu          sync.Mutex
	count       uint64
}

func (c *Counter) Incr() {
	c.mu.Lock()
	c.count++
	c.mu.Unlock()
}
```
Mutex 的零值是还没有 goroutine 等待的未加锁的状态，所以你不需要额外的初始化，直接声明变量（如 var mu sync.Mutex）即可

### 1.1 并发冲突检测
对共享资源不加保护的并发会导致 data race 数据竞争。很多时候，并发问题隐藏得非常深不太容易发现。Go 提供了一个检测并发访问共享资源是否有问题的工具： [race detector](https://blog.golang.org/race-detector)，它可以帮助我们自动发现程序有没有 data race 的问题。它的实现和使用我放到了 [Go 并发调试工具](../tool/go_exe/race_check)。

## 2. Mutex 实现
Mutex 的实现经过了一个由简单到考虑公平，性能，复杂度复杂实现过程，整个实现过程大体分成了如下四个阶段:

![Mutex实现原理](/images/go/sync/mutex_principle.jpg)

接下来我们会一一介绍 Mutex 各个版本的实现，我觉得下面几点对理解 Mutex 的实现会有所帮助:
1. 调用 Mutext.Lock 和 Mutex.Unlock 是独立的 Goroutine，他们内部会维护一些变量来记录当前的 Goroutine 的状态，比如是被唤醒的，或者已处于饥饿状态，不要把这些协程内部的变量与 Mutex 的状态字段搞混。
2. Mutex 中的字段类似于共享内存，每个 Goroutine 都会根据自身的状态更新 Mutex 的值，因此对 Mutex 的修改都需要借助原子操作，来避免数据竞争
3. 协程的调度时通过 go 内部的信号量调度的，信号量实现的是一个先进先出队列，位于队列头部的 Goroutine 如果排除"插队"一定是第一个优先获取到锁的。

## 3. 初版 Mutex 
![初版Mutex](/images/go/sync/mutex_v1.jpg)

初版 Mutex 实现如下:

```go
// CAS操作，当时还没有抽象出atomic包
func cas(val *int32, old, new int32) bool
func semacquire(*int32)
func semrelease(*int32)
// 互斥锁的结构，包含两个字段
type Mutex struct {
	key  int32 // 锁是否被持有的标识
	sema int32 // 信号量专用，用以阻塞/唤醒goroutine
}

// 保证成功在val上增加delta的值
// xadd 方法通过循环执行 CAS 操作直到成功，保证对 key 加 1 的操作成功完成。
func xadd(val *int32, delta int32) (new int32) {
	for {
		v := *val
		if cas(val, v, v+delta) {
			return v + delta
		}
	}
	panic("unreached")
}

// 请求锁
func (m *Mutex) Lock() {
	if xadd(&m.key, 1) == 1 { //标识加1，如果等于1，成功获取到锁
		return
	}
	semacquire(&m.sema) // 否则阻塞等待
}

func (m *Mutex) Unlock() {
	if xadd(&m.key, -1) == 0 { // 将标识减去1，如果等于0，则没有其它等待者
		return
	}
	// 如果还有等待此锁的其它 goroutine，那么，它会调用 semrelease 方法
	semrelease(&m.sema) // 唤醒其它阻塞的goroutine
}    
```

Mutex 结构体包含两个字段：
1. key：
	- 是一个 flag，用来标识这个排外锁是否被某个 goroutine 所持有
	- 如果 key 大于等于 1，说明这个排外锁已经被持有；
	- key 不仅仅标识了锁是否被 goroutine 所持有，还记录了当前持有和等待获取锁的 goroutine 的数量
2. sema：是个信号量变量，用来控制等待 goroutine 的阻塞休眠和唤醒。

在这个实现的版本里，协程只会执行一次"抢锁"操作，抢锁失败就会休眠。当协成再被唤醒后，默认就获取锁。锁由谁获取完全有信号量决定，信号量内部是排队的，所以新加入的协成是无法获取到锁的。

### 3.1 如何释放锁

初版Mutex 的整体设计非常简洁，但是 Unlock 方法可以被任意的 goroutine 调用释放锁，即使是没持有这个互斥锁的 goroutine，也可以进行这个操作。这是因为，**Mutex 本身并没有包含持有这把锁的 goroutine 的信息**，所以，**Unlock 也不会对此进行检查**。Mutex 的这个设计一直保持至今。

所以，我们在使用 Mutex 的时候，必须要保证 goroutine 尽可能不去释放自己未持有的锁，一定要遵循“**谁申请，谁释放**”的原则。从 1.14 版本起，Go 对 defer 做了优化，采用更有效的内联方式，取代之前的生成 defer 对象到 defer chain 中，defer 对耗时的影响微乎其微，基本上都可以将锁的释放放在 defer 中，像下面这样:

```go
func (f *Foo) Bar() {
    f.mu.Lock()
    defer f.mu.Unlock()


    if f.count < 1000 {
        f.count += 3
        return
    }


    f.count++
    return
}
```

但是，如果临界区只是方法中的一部分，为了尽快释放锁，还是应该第一时间调用 Unlock，而不是一直等到方法返回时才释放。

### 3.3 缺陷
初版的 Mutex 实现有一个问题：**请求锁的 goroutine 会排队等待获取互斥锁**。虽然这貌似很公平，但是从性能上来看，却不是最优的。因为**如果我们能够把锁交给正在占用 CPU 时间片的 goroutine 的话，那就不需要做上下文的切换**，在高并发的情况下，可能会有更好的性能。

## 4. 给新人机会
### 4.1 state 字段
![初版Mutex](/images/go/sync/mutex_v2.jpg)

第一次大调整之后，Mutex 实现如下:

```go

type Mutex struct {
	state int32
	sema  uint32
}


const (
	mutexLocked = 1 << iota // mutex is locked
	mutexWoken
	mutexWaiterShift = iota
)
```

新的 Mutex 中 state 是一个复合型字段: 
- 第一位（最小的一位）来表示这个锁是否被持有
- 第二位代表是否有唤醒的 goroutine
- 剩余的位数代表的是等待此锁的 goroutine 数


### 4.2 Lock
state 变得复杂，请求锁的方法 Lock 也变得复杂。

```go

func (m *Mutex) Lock() {
	// Fast path: 幸运case，能够直接获取到锁
	// 1. state 为 0，表示 如果没有 goroutine 持有锁，也没有等待持有锁的 gorutine
	if atomic.CompareAndSwapInt32(&m.state, 0, mutexLocked) {
		return
	}
	// 2. for 循环是不断尝试获取锁，如果获取不到，就通过 runtime.Semacquire(&m.sema) 休眠，
	//    休眠醒来之后 awoke 置为 true，尝试争抢锁。

	// 个人理解: 调用 Mutex.Lock() 是每个 goroutine，这个 awoke 是 goroutine 的局部变量
	awoke := false
	for {
		old := m.state
		new := old | mutexLocked // 新状态加锁
		// 3. 如果旧锁已经被持有，增加 waiter
		if old&mutexLocked != 0 {
			new = old + 1<<mutexWaiterShift //等待者数量加一
		}
		
		if awoke {
			// goroutine是被唤醒的，
			// 4. 新状态清除唤醒标志
			// 个人理解: go 一次只会唤醒一个协程，当前协程在运行说明就是那个被唤醒的，
			// 接下来无论他是获取到锁，还是被阻塞，都代表了没有协程处于唤醒中，所以要清楚唤醒状态
			new &^= mutexWoken
		}
		// 5. 过 CAS 把这个新值赋予 state，尝试抢锁
		if atomic.CompareAndSwapInt32(&m.state, old, new) {//设置新状态
			if old&mutexLocked == 0 { // 锁原状态未加锁
				break
			}
			// 锁原状态已经加锁，休眠
			runtime.Semacquire(&m.sema) // 请求信号量
			// 唤醒后标识 goroutine 是被唤醒的
			awoke = true
		}
	}
}
```

在上面的实现中:
1. "抢锁"是在一个循环中不断进行的，已睡眠的 goroutine 被唤醒后并不能像先前一样直接获取到锁，还是要和正在请求锁的 goroutine 进行竞争，这就给 CPU 中正在执行的 goroutine 更多的机会获取锁
3. 请求锁的 goroutine 有两类，一类是新来请求锁的 goroutine，另一类是被唤醒的等待请求锁的 goroutine。锁的状态也有两种：加锁和未加锁，下面是 goroutine 不同来源不同状态下的处理逻辑

![第二版Mutex](/images/go/sync/mutex_v2_state.jpg)

### 4.3 Unlock
释放锁的逻辑如下:

```go
func (m *Mutex) Unlock() {
	// Fast path: drop lock bit.
	new := atomic.AddInt32(&m.state, -mutexLocked) //去掉锁标志
	if (new+mutexLocked)&mutexLocked == 0 { //本来就没有加锁
		panic("sync: unlock of unlocked mutex")
	}
	// 个人理解: m.state 去掉锁标识后，其他 goroutine 就已经可以尝试获取锁和释放锁了
	old := new
	for {
		// 没有等待者，或者有唤醒的waiter，或者锁原来已加锁
		// 第一次进入循环时，old 的 mutexLocked 位肯定是 0，但是之后的循环就不一定了
		if old>>mutexWaiterShift == 0 || old&(mutexLocked|mutexWoken) != 0 { 
			return
		}
		new = (old - 1<<mutexWaiterShift) | mutexWoken // 新状态，准备唤醒goroutine，并设置唤醒标志
		// 对 state 状态的更新始终通过原子操作，保证不会数据竞争
		// 如果没有设置成功，说明有新的 goroutine 已经获取到锁了，需要重新获取锁的状态继续执行
		if atomic.CompareAndSwapInt32(&m.state, old, new) {
			runtime.Semrelease(&m.sema)
			return
		}
		// for 循环重试必须更新 old 变量
		old = m.state
	}
}
```
将加锁置为未加锁的状态，这个方法也不能直接返回，因为还可能有一些等待这个锁的 goroutine(成为 waiter) 需要通过信号量唤醒，所以接下来的逻辑有4种种情况：
1. 如果没有其它的 waiter
2. 如果有其他 waiter 并且有被唤醒的 waiter 直接返回
3. 如果有其他 waiter 但此时锁已经被其他 goroutine 加锁直接返回
4. 如果有等待者，并且没有唤醒的 waiter，锁仍然处于未加锁状态，需要唤醒一个等待的 waiter；在唤醒之前，需要将 waiter 数量减 1，并且将 mutexWoken 标志设置上

前三种情况就对应条件
```go
// // 没有等待者，或者有唤醒的 waiter，或者锁原来已加锁
if old>>mutexWaiterShift == 0 || old&(mutexLocked|mutexWoken) != 0 { 
	return
}
```

所有对 state 的操作都通过原子操作完成，保证了不会发生数据竞争，其余通过快速失败逻辑，快速结束。需要注意的是 for 循环重试必须更新 old 变量。

### 4.4 改进
相对于初版的设计，这次的改动主要就是，新来的 goroutine 也有机会先获取到锁，甚至一个 goroutine 可能连续获取到锁，打破了先来先得的逻辑。但是，代码复杂度也显而易见。

这一版的 Mutex 已经给新来请求锁的 goroutine 一些机会，让它参与竞争，没有空闲的锁或者竞争失败才加入到等待队列中。但是其实还可以进一步优化。


## 5. 多给些机会
在 2015 年 2 月的改动中，如果新来的 goroutine 或者是被唤醒的 goroutine 首次获取不到锁，它们就会通过自旋（spin，通过循环不断尝试，spin 的逻辑是在runtime 实现的）的方式，尝试检查锁是否被释放。在尝试一定的自旋次数后，再执行原来的逻辑。

```go
func (m *Mutex) Lock() {
	// Fast path: 幸运之路，正好获取到锁
	if atomic.CompareAndSwapInt32(&m.state, 0, mutexLocked) {
		return
	}

	awoke := false
	iter := 0
	for { // 不管是新来的请求锁的goroutine, 还是被唤醒的goroutine，都不断尝试请求锁
		old := m.state // 先保存当前锁的状态
		new := old | mutexLocked // 新状态设置加锁标志
		// ################## 新增的自旋逻辑  #######################
		if old&mutexLocked != 0 { // 锁还没被释放
			if runtime_canSpin(iter) { // 还可以自旋
				if !awoke && old&mutexWoken == 0 && old>>mutexWaiterShift != 0 &&
					atomic.CompareAndSwapInt32(&m.state, old, old|mutexWoken) {
					awoke = true
				}
				runtime_doSpin()
				iter++
				continue // 自旋，再次尝试请求锁
			}
		// ################## 新增的自旋逻辑  #######################
			new = old + 1<<mutexWaiterShift
		}
		if awoke { // 唤醒状态
			// new&mutexWoken == 0 成立只可能发生在，未发生自旋，但是 old&mutexLocked == 1 的情况
			// 但是此时肯定发生了自旋
			if new&mutexWoken == 0 {
				panic("sync: inconsistent mutex state")
			}
			new &^= mutexWoken // 新状态清除唤醒标记
		}
		if atomic.CompareAndSwapInt32(&m.state, old, new) {
			if old&mutexLocked == 0 { // 旧状态锁已释放，新状态成功持有了锁，直接返回
				break
			}
			runtime_Semacquire(&m.sema) // 阻塞等待
			awoke = true // 被唤醒
			iter = 0
		}
	}
}
```

对于临界区代码执行非常短的场景来说，新增的自旋逻辑是一个非常好的优化，因为临界区的代码耗时很短，锁很快就能释放，而抢夺锁的 goroutine 不用通过休眠唤醒方式等待调度，直接 spin 几次，可能就获得了锁。

这里我们来详细介绍一下自旋里面的判断逻辑:

```go
if old&mutexLocked != 0 { // 锁还没被释放
	if runtime_canSpin(iter) { // 还可以自旋
		if !awoke && old&mutexWoken == 0 && old>>mutexWaiterShift != 0 &&
			atomic.CompareAndSwapInt32(&m.state, old, old|mutexWoken) {
			awoke = true
		}
		runtime_doSpin()
		iter++
		continue // 自旋，再次尝试请求锁
	}
	// ################## 新增的自旋逻辑  #######################
	new = old + 1<<mutexWaiterShift
```

1. ` runtime_canSpin(iter)`: 表示 goroutine 可以继续执行持续抢锁
2. `!awoke && old&mutexWoken == 0 && old>>mutexWaiterShift != 0`:
	- 当前协程是第一次尝试抢锁，并且旧锁并没有设置唤醒状态，等待锁的 goroutine 大于 0
	- 此时将锁的 mutexWoken 和 awoke 设为 1，表示有 goroutine 处于唤醒状态
3. `continue`: 自旋，再次尝试请求锁，如果此时锁被释放，可以执行下面的抢锁逻辑
2. `new = old + 1<<mutexWaiterShift`: 如果 goroutine 已经不能自旋，将等待的 waiter 加一，符合 mutexWaiterShift 表示的当前等待锁的 goroutine 数的含义

因为新来的 goroutine 也参与竞争，有可能每次都会被新来的 goroutine 抢到获取锁的机会，在极端情况下，等待中的 goroutine 可能会一直获取不到锁，这就是饥饿问题。

## 6. 解决饥饿
2016 年 Go 1.9 中 Mutex 增加了饥饿模式，让锁变得更公平，不公平的等待时间限制在 1 毫秒，并且**修复了一个大 Bug：总是把唤醒的 goroutine 放在等待队列的尾部，会导致更加不公平的等待时间**。之后 2018 年，Go 开发者将 fast path 和 slow path 拆成独立的方法，以便内联，提高性能。2019 年也有一个 Mutex 的优化，虽然没有对 Mutex 做修改，但是，对于 Mutex 唤醒后持有锁的那个 waiter，调度器可以有更高的优先级去执行，这已经是很细致的性能优化了。

当前 Mutex 代码已经复杂得接近不可读的状态了，而且代码也非常长，我们慢慢来看。整个实现的逻辑大概是: 
1. 正常模式下，waiter 都是进入先入先出队列，因此阻塞在信号量中的第一个 goroutine 就是等待最久的那个。
2. 所以在饥饿模式下，Mutex 的拥有者将直接把锁交给队列最前面的 waiter。新来的 goroutine 不会尝试获取锁，即使看起来锁没有被持有，它也不会去抢，也不会 spin，它会乖乖地加入到等待队列的尾部。
3. 因为等待最久的 goroutine 总是处于信号量队列中的第一个，所以他总是被第一个唤醒，所以饥饿模式下，处于运行中的 goroutine 只能是新的 goroutine 和当前饥饿的 goroutine，只有处于饥饿的 goroutine 才能将锁的饥饿位设置为 1

### 6.1 state 字段
state 在原有的基础上增加了饥饿模式:

![当前版本Mutex](/images/go/sync/mutex_v3.jpg)

```go
type Mutex struct {
	state int32
	sema  uint32
}

const (
	mutexLocked = 1 << iota // mutex is locked
	mutexWoken
	mutexStarving // 从state字段中分出一个饥饿标记
	mutexWaiterShift = iota

	starvationThresholdNs = 1e6
)
```

### 6.2 Lock
添加饥饿模式后，Lock 增加了如下逻辑:
1. 自旋部分: `old&(mutexLocked|mutexStarving) == mutexLocked` 锁是非饥饿状态，锁还没被释放，才尝试自旋
2. 是否去抢锁: 如果存在饥饿 goroutine ，即便当前未加锁，goroutine 也直接等待，不抢锁
	- `if old&(mutexLocked|mutexStarving) != 0 {new += 1 << mutexWaiterShift}`
3. 只有在未加锁并且非饥饿条件下，协程才能正常获取锁
	- `if old&(mutexLocked|mutexStarving) == 0 {break}` 
3. 保持等待最久的 goroutine 始终处于信号量队列的队首: `runtime_SemacquireMutex(&m.sema, queueLifo, 1)`
4. 在饥饿模式下，Mutex 的拥有者将直接把锁交给队列最前面的 waiter
5. 饥饿状态设置: 协程在发生饥饿时，是不会立马就获取到锁的，而是进入到下一次for循环先设置锁的饥饿状态，以此来告诉所有其他协程我当前是饥饿状态，此时如果有锁释放，你们都不要抢锁，所以才有了后面的判断逻辑 `if old&mutexStarving != 0`
6. 饥饿状态的清楚: 锁只要有饥饿状态就会一直让队列首部的协程获取，饥饿状态的清除是在队首协程非饥饿进行的 `if !starving || old>>mutexWaiterShift == 1`

```go
func (m *Mutex) Lock() {
	// Fast path: 幸运之路，一下就获取到了锁
	// 1. 1. state 为 0，表示 如果没有 goroutine 持有锁，也没有等待持有锁的 gorutine，直接加锁
	if atomic.CompareAndSwapInt32(&m.state, 0, mutexLocked) {
		return
	}
	// Slow path：缓慢之路，尝试自旋竞争或饥饿状态下饥饿goroutine竞争
	m.lockSlow()
}

func (m *Mutex) lockSlow() {
	var waitStartTime int64
	starving := false // 此goroutine的饥饿标记
	awoke := false // 唤醒标记
	iter := 0 // 自旋次数
	old := m.state // 当前的锁的状态
	for {
		// 锁是非饥饿状态，锁还没被释放，尝试自旋
		if old&(mutexLocked|mutexStarving) == mutexLocked && runtime_canSpin(iter) {
			if !awoke && old&mutexWoken == 0 && old>>mutexWaiterShift != 0 &&
				atomic.CompareAndSwapInt32(&m.state, old, old|mutexWoken) {
				awoke = true
			}
			runtime_doSpin()
			iter++
			old = m.state // 再次获取锁的状态，之后会检查是否锁被释放了
			continue
		}
		new := old
		if old&mutexStarving == 0 {
			new |= mutexLocked // 非饥饿状态，加锁
		}
		// 如果存在饥饿 goroutine ，当前 goroutine 直接等待，不抢锁
		if old&(mutexLocked|mutexStarving) != 0 {
			new += 1 << mutexWaiterShift // waiter数量加1
		}
		// 对于 Mutex 唤醒后持有锁的那个 waiter，调度器可以有更高的优先级去执行
		if starving && old&mutexLocked != 0 {
			new |= mutexStarving // 设置饥饿状态
		}
		if awoke {
			if new&mutexWoken == 0 {
				throw("sync: inconsistent mutex state")
			}
			new &^= mutexWoken // 新状态清除唤醒标记
		}
		// 成功设置新状态
		if atomic.CompareAndSwapInt32(&m.state, old, new) {
			// 原来锁的状态已释放，并且不是饥饿状态，正常请求到了锁，返回
			if old&(mutexLocked|mutexStarving) == 0 {
				break // locked the mutex with CAS
			}
			// 处理饥饿状态

			// 如果以前就在队列里面，加入到队列头
			queueLifo := waitStartTime != 0
			if waitStartTime == 0 {
				waitStartTime = runtime_nanotime()
			}
			// 阻塞等待，queueLifo == True 表示非首次，加入到队首
			runtime_SemacquireMutex(&m.sema, queueLifo, 1)
			// 唤醒之后检查锁是否应该处于饥饿状态
			starving = starving || runtime_nanotime()-waitStartTime > starvationThresholdNs
			old = m.state
			// 如果锁已经处于饥饿状态，直接抢到锁，返回
			if old&mutexStarving != 0 {
				// 运行到这里不可能再有协程占有锁
				if old&(mutexLocked|mutexWoken) != 0 || old>>mutexWaiterShift == 0 {
					throw("sync: inconsistent mutex state")
				}
				// 有点绕，加锁并且将waiter数减1
				// - 1<<mutexWaiterShift 表示 waiter 减去 1
				// mutexLocked 表示加锁
				delta := int32(mutexLocked - 1<<mutexWaiterShift)
				if !starving || old>>mutexWaiterShift == 1 {
					delta -= mutexStarving // 最后一个waiter或者已经不饥饿了，清除饥饿标记
				}
				atomic.AddInt32(&m.state, delta)
				break
			}
			awoke = true
			iter = 0
		} else {
			old = m.state
		}
	}
}
```

### 6.3 Unlock

```go
func (m *Mutex) Unlock() {
	// Fast path: drop lock bit.
	new := atomic.AddInt32(&m.state, -mutexLocked)
	if new != 0 {
		m.unlockSlow(new)
	}
}

func (m *Mutex) unlockSlow(new int32) {
	if (new+mutexLocked)&mutexLocked == 0 {
		throw("sync: unlock of unlocked mutex")
	}
	if new&mutexStarving == 0 {
		old := new
		for {
			if old>>mutexWaiterShift == 0 || old&(mutexLocked|mutexWoken|mutexStarving) != 0 {
				return
			}
			new = (old - 1<<mutexWaiterShift) | mutexWoken
			if atomic.CompareAndSwapInt32(&m.state, old, new) {
				// false 时，好像也总是唤醒队首 waiter 
				runtime_Semrelease(&m.sema, false, 1)
				return
			}
			old = m.state
		}
	} else {
		// 如果 Mutex 处于饥饿状态，直接唤醒等待队列中的 waiter
		runtime_Semrelease(&m.sema, true, 1)
	}
}
```

## 7. Mutex 采坑记录
使用 Mutex 常见的错误场景有 4 类，分别是 
1. Lock/Unlock 不是成对出现
2. Copy 已使用的 Mutex
3. 重入
4. 死锁
手误和重入导致的死锁，是最常见的使用 Mutex 的 Bug。

### 7.1 Lock/Unlock 不是成对出现
Lock/Unlock 不是成对出现Lock/Unlock 没有成对出现，就意味着会出现死锁，或者是因为 Unlock 一个未加锁的 Mutex 而导致 panic。证 Lock/Unlock 成对出现，尽可能采用 defer mutex.Unlock 的方式，把它们成对、紧凑地写在一起。

### 7.2 Copy 已使用的 Mutex
Package sync 的同步原语在使用后是不能复制的。原因在于，Mutex 是一个有状态的对象，它的 state 字段记录这个锁的状态。如果你要复制一个已经加锁的 Mutex 给一个新的变量，那么新的刚初始化的变量居然被加锁了，这显然不符合你的期望，因为你期望的是一个零值的 Mutex。关键是在并发环境下，你根本不知道要复制的 Mutex 状态是什么，因为要复制的 Mutex 是由其它 goroutine 并发访问的，状态可能总是在变化。

Go 在运行时，有死锁的检查机制（[checkdead](https://golang.org/src/runtime/proc.go?h=checkdead#L4345) 方法），它能够发现死锁的 goroutine。但是显然我们不想运行的时候才发现这个因为复制 Mutex 导致的死锁问题。我们可以使用 vet 工具: `go vet counter.go`，把检查写在 Makefile 文件中，在持续集成的时候跑一跑，这样可以及时发现问题，及时修复。

#### vet 检查原理
vet 检查是通过[copylock](https://github.com/golang/tools/blob/master/go/analysis/passes/copylock/copylock.go)分析器静态分析实现的。这个分析器会分析函数调用、range 遍历、复制、声明、函数返回值等位置，有没有锁的值 copy 的情景，以此来判断有没有问题。可以说，只要是实现了 Locker 接口，就会被分析。

### 7.3 重入
Mutex 不是可重入的锁，因为 Mutex 的实现中没有记录哪个 goroutine 拥有这把锁。理论上，任何 goroutine 都可以随意地 Unlock 这把锁，所以没办法计算重入条件。所以，一旦误用 Mutex 的重入，就会导致报错。下一节我们将介绍如何基于 Mutex 实现一个可重入锁。

### 7.4 死锁
要产生死锁必须具备以下几个条件：
1. 互斥： 至少一个资源是被排他性独享的，其他线程必须处于等待状态，直到资源被释放
2. 持有和等待：goroutine 持有一个资源，并且还在请求其它 goroutine 持有的资源
3. 不可剥夺：资源只能由持有它的 goroutine 来释放
4. 环路等待：一般来说，存在一组等待进程，P={P1，P2，…，PN}，P1 等待 P2 持有的资源，P2 等待 P3 持有的资源，依此类推，最后是 PN 等待 P1 持有的资源，这就形成了一个环路等待的死结

Go 死锁探测工具只能探测整个程序是否因为死锁而冻结了，不能检测出一组 goroutine 死锁导致的某一块业务冻结的情况。你还可以通过 Go 运行时自带的死锁检测工具，或者是第三方的工具（比如go-deadlock、go-tools）进行检查，这样可以尽早发现一些死锁的问题。不过，有些时候，死锁在某些特定情况下才会被触发，所以，如果你的测试或者短时间的运行没问题，不代表程序一定不会有死锁问题。

如果发现线上可能出现了死锁，我们可以通过 Go pprof 工具进行分析，它提供了一个 block profiler 监控阻塞的 goroutine。除此之外，我们还可以查看全部的 goroutine 的堆栈信息，通过它，你可以查看阻塞的 groutine 究竟阻塞在哪一行哪一个对象上了。

最后，Mutex 知识图谱如下:

![Mutex 知识图谱](/images/go/sync/mutex_notes.jpg)
