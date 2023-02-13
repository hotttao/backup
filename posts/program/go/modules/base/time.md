---
weight: 1
title: "go time"
date: 2021-06-01T22:00:00+08:00
lastmod: 2021-06-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go 的文件 I/O"
featuredImage: 

tags: ["go 库"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

## 1. 时间基础操作
### 1.1 时间的表示
获取当前时间可以使用 `time.Now()`，Now 返回的是 Time 结构的结构，Time 是对即时时间的抽象。time.Time的结构如下：

```go
// $GOROOT/src/time.go(go1.14)

type Time struct {
    wall uint64
    ext  int64
    loc *Location
}
```
Time 由三个字段组成:
1. walle: 
    - 挂钟时间（wall time）
    - 连续两次通过Now函数获取的挂钟时间之间的差值不一定都是正值
2. ext: 
    - 单调时间（monotonic time），精度级为纳秒
    - 单调时间表示的是程序进程启动之后流逝的时间，两次采集的单调时间之差永远不可能为负数
    - 单调时间常被用于两个即时时间之间的比较和间隔计算
3. loc: 
    - 时区信息，Now函数获取的即时时间是时区相关的
    - 未显式指定时区，则默认使用系统时区。在Linux/macOS上，默认使用的是/etc/localtime指向的时区数据

wall的最高比特位是一个名为 hasMonotonic 的标志比特位。hasMonotonic 是否为 1，Time 的结构有所区别

#### hasMonotonic 为 1 时 Time 结构
当hasMonotonic被置为1时，time.Time表示的即时时间中既包含挂钟时间，也包含单调时间。此时 Time 的结构如下:
1. walle 是一个64位无符号整型，内部又被分成三段，分别表示
    - hasMonotonic（1bit）
    - 秒数（33bit，挂钟时间的整秒数，距1885年1月1日的秒数）
    - 纳秒数（30bit，挂钟时间的非整秒数）
2. ext字段表示程序进程启动后的单调流逝时间，以纳秒为单位

![当hasMonotonic为1时，time.Time表示时间的原理](/images/go/expert/time_struct.png)

#### hasMonotonic 为 0 时 Time 结构
当hasMonotonic为0时，time.Time结构体仅表示挂钟时间:
1. wall字段:
    - hasMonotonic（1bit）和秒数（33bit）两部分均被置为0
    - 纳秒数（30bit）依旧用于表示挂钟时间的非整数秒部分
2. ext字段整个用于表示挂钟时间的整秒部分，其含义为距公元元年1月1日的秒数

![当hasMonotonic为0时，time.Time表示时间的原理](/images/go/expert/time_struct1.png)

通过time.Parse、time.Date或time.Unix构建的time.Time结构体，其中的hasMonotonic均为 0。

#### Now 函数调用流程
time.Now函数调用now函数，但在time包中now函数仅有一个原型声明，并没有函数体：

```go
// $GOROOT/src/time/time.go
func now() (sec int64, nsec int32, mono int64)
```

now 函数的真正实现是 runtime 包的 time_now 函数，Go 链接器会将 time_now 链接为 time.now：

```go
// $GOROOT/src/runtime/timestub.go
...
//go:linkname time_now time.now
func time_now() (sec int64, nsec int32, mono int64) {
    sec, nsec = walltime()
    return sec, nsec, nanotime()
}
// walltime和nanotime函数也都是“过渡”函数：
// $GOROOT/src/runtime/time_nofake.go
//go:nosplit
func nanotime() int64 {
    return nanotime1()
}

func walltime() (sec int64, nsec int32) {
    return walltime1()
}
```

真正获取系统时间的操作是在下面的汇编代码中通过系统调用（system call）实现的（以Linux为例）：

```go
/ $GOROOT/src/runtime/sys_linux_amd64.s
TEXT runtime·walltime1(SB),NOSPLIT,$8-12
...

noswitch:
    SUBQ    $16, SP         // 为结果预留空间
    ANDQ    $~15, SP        // 为C代码进行对齐

    MOVQ    runtime·vdsoClockgettimeSym(SB), AX
    CMPQ    AX, $0
    JEQ     fallback
    MOVL    $0, DI // CLOCK_REALTIME
    LEAQ    0(SP), SI
    CALL    AX
...

TEXT runtime·nanotime1(SB),NOSPLIT,$8-8
...
noswitch:
    SUBQ    $16, SP         // 为结果预留空间
    ANDQ    $~15, SP        // 为C代码进行对齐

    MOVQ    runtime·vdsoClockgettimeSym(SB), AX
    CMPQ    AX, $0
    JEQ     fallback
...
```

### 1.2 获取特定时区的当前时间
如果要获取特定时区（而不是本地时区）的当前时间，可以使用下面几种方法。
1. 设置TZ环境变量
    - 方法: `$TZ=America/New_York go run get_current_time.go`
    - 如果TZ环境变量提供的时区信息有误或显式设置为""，time.Now根据其值在时区数据库中找不到对应的时区信息，那么它将使用UTC时间（Coordinated Universal Time，国际协调时间）：
2. 显式加载时区信息

```go
// 显式加载时区信息
package main

import (
	"fmt"
	"time"
)

func main() {
	t := time.Now()
	fmt.Println(t) //北京时间

	loc, err := time.LoadLocation("America/New_York")
	if err != nil {
		fmt.Println("load time location failed:", err)
		return
	}

	t1 := t.In(loc) // 转换成美国东部纽约时间表示
	fmt.Println(t1)

    // 通过 Date 构建带时区时间
    t2 := time.Date(2020, 6, 18, 06, 0, 0, 0, loc)
	fmt.Println(t2) 
}
```

### 1.3 时间的比较与运算
由 time.Time 类型表示即时时间的原理可知，如果直接用==和!=来比较两个Time类型示例，那么参与比较的不仅有挂钟时间，还有单调时间和时区信息，这样就会出现在不同时区表示地球上同一时刻的两个Time实例是不相等的情况，这违背了人的一贯认知。因此直接用==和!=来做比较是不适宜的，这也是time.Time类型不应被用作map类型的key值的原因。

time.Time提供了Equal方法，该方法专用于对两个Time实例的比较：

```go
// $GOROOT/src/time/time.go (go 1.14)
func (t Time) Equal(u Time) bool {
    if t.wall&u.wall&hasMonotonic != 0 {
        return t.ext == u.ext
    }
    return t.sec() == u.sec() && t.nsec() == u.nsec()
}
```

Time类型还提供了Before和After方法，用于判断两个即时时间的先后关系:

```go
/ $GOROOT/src/time/time.go (go 1.14)

func (t Time) After(u Time) bool {
    if t.wall&u.wall&hasMonotonic != 0 {
        return t.ext > u.ext
    }
    ts := t.sec()
    us := u.sec()
    return ts > us || ts == us && t.nsec() > u.nsec()
}

func (t Time) Before(u Time) bool {
    if t.wall&u.wall&hasMonotonic != 0 {
        return t.ext < u.ext
    }
    return t.sec() < u.sec() || t.sec() == u.sec() && t.nsec() < u.nsec()
}
```

time包还可以用来对两个即时时间进行时间运算，其中最主要的运算就是由Sub方法提供的差值运算:

```go
t1 := time.Now()
time.Sleep(time.Second * 5)
t2 := time.Now()
diff := t2.Sub(t1)
```

Sub方法的返回值是time.Duration类型，这是一个纳秒值。和上面Equal的逻辑相似，Sub方法对两个Time实例的差值处理也分为两种情况：如果两个实例都含有单调时间信息（hasMonotonic=1），那么Sub方法直接返回两个实例的ext字段的差；否则，分别算出整秒部分的差与非整秒部分的差，然后加和后返回。


### 1.4 时间的格式化输出
Go 采用了不同于strftime的时间格式化输出方案，采用了更为直观的参考时间（reference time）替代strftime的各种标准占位符:

```go
time.Now().Format("2006年01月02日 15时04分05秒")
```

Go文档中给出的标准的参考时间如下：`2006-01-02 15:04:05 PM -07:00 Jan Mon MST`。下图形象地展示了参考时间、格式串与最终格式化的输出结果之间的关系:

![参考时间、格式串与最终格式化的输出结果之间的关系](/images/go/expert/time_format.png)

下面是一个格式化字符串与实际输出结果的速查表，速查表的第一列为含义，第二列为格式串写法，第三列为对应格式串写法下的输出结果（取当前时间）：

```
2020-06-19 14:44:58 PM +08:00 Jun Fri CST

Year            | 2006         | 2020
Year            | 06           | 20
Month           | 01           | 06
Month           | 1            | 6
Month           | Jan          | Jun
Month           | January      | June
Day             | 02           | 19
Day             | 2            | 19
Week day        | Mon          | Fri
Week day        | Monday       | Friday
Hours           | 03           | 02
Hours           | 3            | 2
Hours           | 15           | 14
Minutes         | 04           | 44
Minutes         | 4            | 44
Seconds         | 05           | 58
Seconds         | 5            | 58
AM or PM        | PM           | PM
Miliseconds     | .000         | .906
Microseconds    | .000000      | .906783
Nanoseconds     | .000000000   | .906783000
Timezone offset | -0700        | +0800
Timezone offset | -07:00       | +08:00
Timezone offset | Z0700        | +0800
Timezone offset | Z07:00       | +08:00
Timezone        | MST          | CST
--------------- + ------------ + ------------
```

## 2. 定时器
time包提供了两类定时器：一次性定时器Timer和重复定时器Ticker。
### 2.1 Timer的创建

```go
func create_timer_by_afterfunc() {
    // time.AfterFunc 创建一次性定时器
    _ = time.AfterFunc(1*time.Second, func() {
        fmt.Println("timer created by afterfunc fired!")
    })
}

func create_timer_by_newtimer() {
    // time.NewTimer 创建一次性定时器
    timer := time.NewTimer(2 * time.Second)
    select {
    case <-timer.C:
        fmt.Println("timer created by newtimer fired!")
    }
}

func create_timer_by_after() {
    // time.After 创建一次性定时器
    select {
    case <-time.After(2 * time.Second):
        fmt.Println("timer created by after fired!")
    }
}

func create_ticker_by_after() {
    // 创建重复定时器
	c := time.Tick(5 * time.Second)
	for next := range c {
		fmt.Printf("%v %s\n", next, statusUpdate())
	}
}
```
### 2.2 Timer 触发流程
Timer的四种创建方式：NewTimer、AfterFunc和After、Tick，本质上都是在用户层实例化一个time.Timer结构体：

```go
// $GOROOT/src/time/sleep.go (go 1.14)
type Timer struct {
    C <-chan Time   // C是用户层用户接收定时器触发事件的channel
    r runtimeTimer  // r则是一个与runtime.timer（runtime/time.go）对应且要保持一致的结构
}

func NewTimer(d Duration) *Timer {
    c := make(chan Time, 1)   // C 是一个带缓冲的 channel
    t := &Timer{
        C: c,
        r: runtimeTimer{
            when: when(d),
            f:    sendTime,
            arg:  c,
        },
    }
    startTimer(&t.r)
    return t
}
```

Timer创建及触发原理的过程如下图所示:
1. 被实例化后的Timer将交给运行时层的 startTimer 函数 `startTimer(&t.r)`
2. Timer.r 是一个与runtime.timer（runtime/time.go）对应且要保持一致的结构，startTimer 使用 Timer.r 初始化一个运行时层面的runtime.timer结构，并将runtime.timer加入为每个P分配的定时器最小堆中进行管理

![Timer创建与触发](/images/go/expert/timer.png)

老版本的Go中（Go 1.9版本之前），运行时维护一个由互斥锁保护的全局最小堆（minheap），定时器最小堆的维护操作都要对其互斥锁进行加解锁操作，导致其性能和伸缩性很差。最新的定时器管理调度方案（Go 1.14）抛弃了全局唯一最小堆方案，而是为每个P（goroutine调度器中的那个P）创建一个定时器最小堆，并通过网络轮询器（net poller）在运行时调度的协助下对各个定时器最小堆进行统一管理和调度

```go
// $GOROOT/src/runtime/runtime2.go (go 1.14)

type p struct {
    ...
    timersLock mutex
    timers []*timer
    ...
```

运行时调度时发现某个定时器的时间已到，就会将该定时器从其所在最小堆中移除，并在runtime.runOneTimer中调用相应runtime.timer的触发函数f，即上面的 time.sendTime

```go
// $GOROOT/src/time/sleep.go (go 1.14)

func sendTime(c interface{}, seq uintptr) {
    select {
    case c.(chan Time) <- Now():
    default:
    }
}
```

time.Timer.C是一个带缓冲的channel，目的就是防止运行时在执行sendTime时被阻塞在该channel上。我们看到sendTime还加了双保险：通过一个select判断channel c的缓冲区是否已满，一旦满了，则会执行default分支而直接退出。

### 2.3 停止Timer
Timer提供了Stop方法来将尚未触发的定时器从P中的最小堆中移除，使之失效，这样可以减小最小堆管理和垃圾回收的压力。因此，使用定时器时及时调用Stop方法是一个很好的Go语言实践。

```go
func consume(c <-chan bool) bool {
    timer := time.NewTimer(time.Second * 5)
    defer timer.Stop()
}
```
 
### 2.4 重用Timer
Go官方文档建议只对如下两种定时器调用Reset方法：
1. 已经停止了的定时器（Stopped）；
2. 已经触发过且Timer.C中的数据已经被读空。

重用 Timer 推荐使用下面的模式：

```go
if !t.Stop() {
    select {
        case <-timer.C:
        default:
    }

}
t.Reset(d)
```

#### 重用Timer时存在的竞态条件
当一个定时器触发时，运行时会调用runtime.runOneTimer调用定时器关联的触发函数：

```go
// $GOROOT/src/runtime/time.go (Go 1.14)

func runOneTimer(pp *p, t *timer, now int64) {
    ...
    unlock(&pp.timersLock)

    f(arg, seq)

    lock(&pp.timersLock)
    ...
}
```

我们看到在runOneTimer**执行f(arg, seq)函数前，runOneTimer对p的timersLock进行了解锁操作**，也就是说f的执行并不在锁内。f执行的是什么呢？
1. 对于通过AfterFunc创建的定时器来说，就是启动一个新goroutine，并在这个新goroutine中执行用户传入的函数；
2. 对于通过After或NewTimer创建的定时器而言，f的执行就是time.sendTime函数，也就是将当前时间写入定时器的通知channel中。

这个时候会有一个竞态条件出现：定时器触发的过程中，**f函数的执行与用户层重置定时器前抽干channel的操作是分别在两个goroutine中执行的，谁先谁后，完全依靠运行时调度**。于是重用模式中的看似没有问题的代码，也可能存在问题（当然需要时间粒度足够小，比如毫秒级的定时器）。以通过After或NewTimer创建的定时器为例（即f函数为time.sendTime）。
1. 如果sendTime的执行发生在抽干channel动作之前，那么就是重用模式中的执行结果：Stop方法返回false（因为定时器已经触发了），显式抽干channel的动作是可以读出数据的。后续定时器重置后，定时器将继续正常运行。
2. 如果**sendTime 的执行发生在抽干channel动作之后，那么就有问题了**。虽然Stop方法返回false（因为定时器已经触发了），但抽干channel的动作并没有读出任何数据。之后，sendTime将数据写到channel中。这样定时器重置后的定时器channel中实际上已经有了数据，于是当消费者进入下面的select语句中时，case <-timer.C这一分支因有数据而被直接选中，没有起到超时等待的作用。也就是说定时器被重置之后居然又立即触发了。

目前这个竞态问题尚无理想解决方案，详细请见这个 [issue](http://github.com/golang/go/issues/11513)

### 2.5 Timer的资源释放
作为Timer的使用者，我们要做的就是尽量减少在使用 Timer 时对最小堆管理和垃圾回收的压力，即及时调用定时器的 Stop 方法从最小堆删除定时器或重用（Reset）处于活跃状态的定时器。
