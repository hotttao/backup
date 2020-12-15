---
title: 14 Channel 应用
date: 2019-02-12
categories:
    - Go
tags:
    - go并发编程
---
应用
<!-- more -->

## 1. 使用反射操作 Channel
在学习如何使用 Channel 之前，我们来看看如何通过反射的方式执行 select 语句，这在处理很多的 case clause，尤其是不定长的 case clause 的时候，非常有用。

为了便于操作 Select，reflect 提供了如下几个函数:
1. `func Select(cases []SelectCase) (chosen int, recv Value, recvOK bool)`:
    - 参数: SelectCase 表示 Select 语句的一个分支
    - 返回值:
        - chosen:  select 是伪随机的，它在执行的 case 中随机选择一个 case，并把选择的这个 case 的索引（chosen）返回
        - recv: 如果 select 选中的 recv case，recvValue 表示接收的元素
        - recvOK: 表示是否有 case 成功被选择，false 表示没有可用的 case 返回
2. `SelectCase`: struct 表示一个 select case 分支

```go
const (
    SelectSend    // case Chan <- Send
    SelectRecv    // case <-Chan:
    SelectDefault // default
)


type SelectCase struct {
    Dir  SelectDir // case的方向
    Chan Value     // 使用的通道（收/发）
    Send Value     // 用于发送的值
}

type SelectDir int

func Select(cases []SelectCase) (chosen int, recv Value, recvOK bool)
```

下面是动态创建 Select 的一个示例:

```go

func main() {
    var ch1 = make(chan int, 10)
    var ch2 = make(chan int, 10)

    // 创建SelectCase
    var cases = createCases(ch1, ch2)

    // 执行10次select
    for i := 0; i < 10; i++ {
        chosen, recv, ok := reflect.Select(cases)
        if recv.IsValid() { // recv case
            fmt.Println("recv:", cases[chosen].Dir, recv, ok)
        } else { // send case
            fmt.Println("send:", cases[chosen].Dir, ok)
        }
    }
}

func createCases(chs ...chan int) []reflect.SelectCase {
    var cases []reflect.SelectCase


    // 创建recv case
    for _, ch := range chs {
        cases = append(cases, reflect.SelectCase{
            Dir:  reflect.SelectRecv,
            Chan: reflect.ValueOf(ch),
        })
    }

    // 创建send case
    for i, ch := range chs {
        v := reflect.ValueOf(i)
        cases = append(cases, reflect.SelectCase{
            Dir:  reflect.SelectSend,
            Chan: reflect.ValueOf(ch),
            Send: v,
        })
    }

    return cases
}
```

上一节我们说了 Channel 的五种使用场景:
1. 数据交流：当作并发的 buffer 或者 queue，解决生产者 - 消费者问题。多个 goroutine 可以并发当作生产者（Producer）和消费者（Consumer）
2. 数据传递：一个 goroutine 将数据交给另一个 goroutine，相当于把数据的拥有权 (引用) 托付出去。
3. 信号通知：一个 goroutine 可以将信号 (closing、closed、data ready 等) 传递给另一个或者另一组 goroutine
4. 任务编排：可以让一组 goroutine 按照一定的顺序并发或者串行的执行，这就是编排的功能
5. 锁：利用 Channel 也可以实现互斥锁的机制

接下来我们一一举例说明。

## 2.消息交流
从 chan 的内部实现看，它是以一个循环队列的方式存放数据，所以，它有时候也会被当成线程安全的队列和 buffer 使用。我们来看几个例子。

### 2.1 worker 池
Marcio Castilho 在 [使用 Go 每分钟处理百万请求](http://marcio.io/2015/07/handling-1-million-requests-per-minute-with-golang/)  这篇文章中，就介绍了他们应对大并发请求的设计。他们将用户的请求放在一个 chan Job 中，这个 chan Job 就相当于一个待处理任务队列。除此之外，还有一个 chan chan Job 队列，用来存放可以处理任务的 worker 的缓存队列。下面核心代码实现:

```go
// 1. 定义Worker 池和消息队列的长度
var (
	MaxWorker = os.Getenv("MAX_WORKERS")
	MaxQueue  = os.Getenv("MAX_QUEUE")
)

// 2. 定义任务队列 
type Job struct {
	Payload Payload
}

var JobQueue chan Job

// 3. 定义 Worker
type Worker struct {
	WorkerPool  chan chan Job 
	JobChannel  chan Job  // 接收任务
	quit    	chan bool // Worker 退出
}

func NewWorker(workerPool chan chan Job) Worker {
	return Worker{
		WorkerPool: workerPool,
		JobChannel: make(chan Job),
		quit:       make(chan bool)}
}
// 3.1 启动任务
func (w Worker) Start() {
	go func() {
		for {
			// 重要: register the current worker into the worker queue.
			w.WorkerPool <- w.JobChannel

			select {
			case job := <-w.JobChannel:
				// we have received a work request.
				if err := job.Payload.UploadToS3(); err != nil {
					log.Errorf("Error uploading to S3: %s", err.Error())
				}

			case <-w.quit:
				// we have received a signal to stop
				return
			}
		}
	}()
}

// 3.2 停止任务
func (w Worker) Stop() {
	go func() {
		w.quit <- true
	}()
}

// 4. 创建 Worker Pool
type Dispatcher struct {
	WorkerPool chan chan Job
}

func NewDispatcher(maxWorkers int) *Dispatcher {
	pool := make(chan chan Job, maxWorkers)
	return &Dispatcher{WorkerPool: pool}
}

func (d *Dispatcher) Run() {
    // starting n number of workers
	for i := 0; i < d.maxWorkers; i++ {
		worker := NewWorker(d.pool)
		worker.Start()
	}

	go d.dispatch()
}
// 4.1 将任务从 JobQueue 放入到 Woker Pool 中某一个 Workder 的 JobChannel 中，来调用 Worker
func (d *Dispatcher) dispatch() {
	for {
		select {
		case job := <-JobQueue:
			// a job request has been received
			go func(job Job) {
				// try to obtain a worker job channel that is available.
				// this will block until a worker is idle
				jobChannel := <-d.WorkerPool

				// dispatch the job to the worker job channel
				jobChannel <- job
			}(job)
		}
	}
}
// 5. 使用 Worker Pool
func payloadHandler(w http.ResponseWriter, r *http.Request) {
    for _, payload := range content.Payloads {

        // let's create a job with the payload
        work := Job{Payload: payload}

        // Push the work onto the queue.
        JobQueue <- work
    }
}
```

## 3. 数据传递
下面是一个数据传递(任务编排)的例子，让四个 goroutine 顺序打印 1,2,3,4

```go

type Token struct{}

func newWorker(id int, ch chan Token, nextCh chan Token) {
    for {
        token := <-ch         // 取得令牌
        fmt.Println((id + 1)) // id从1开始
        time.Sleep(time.Second)
        nextCh <- token
    }
}
func main() {
    chs := []chan Token{make(chan Token), make(chan Token), make(chan Token), make(chan Token)}

    // 创建4个worker
    for i := 0; i < 4; i++ {
        go newWorker(i, chs[i], chs[(i+1)%4])
    }

    //首先把令牌交给第一个worker
    chs[0] <- struct{}{}
  
    select {}
}
```

这类场景有一个特点，就是当前持有数据的 goroutine 都有一个信箱，信箱使用 chan 实现，goroutine 只需要关注自己的信箱中的数据，处理完毕后，就把结果发送到下一家的信箱中。

## 4. 信号通知
chan 类型有这样一个特点：chan 如果为空，那么，receiver 接收数据的时候就会阻塞等待，直到 chan 被关闭或者有新的数据到来。利用这个机制，我们可以实现 wait/notify 的设计模式。

除了正常的业务处理时的 wait/notify，我们经常碰到的一个场景，就是程序关闭的时候，我们需要在退出之前做一些清理（doCleanup 方法）的动作。这个时候，我们经常要使用 chan。

比如，使用 chan 实现程序的 graceful shutdown，在退出之前执行一些连接关闭、文件 close、缓存落盘等一些动作。

```go
func main() {
  go func() {
      ...... // 执行业务处理
    }()

  // 处理CTRL+C等中断信号
  termChan := make(chan os.Signal)
  signal.Notify(termChan, syscall.SIGINT, syscall.SIGTERM)
  <-termChan 

  // 执行退出之前的清理动作
    doCleanup()
  
  fmt.Println("优雅退出")
}
```

有时候，doCleanup 可能是一个很耗时的操作，我们需要设置一个最长的等待时间。只要超过了这个时间，程序就不再等待，可以直接退出。所以，退出的时候分为两个阶段：
1. closing，代表程序退出，但是清理工作还没做；
2. closed，代表清理工作已经做完。

```go

func main() {
    var closing = make(chan struct{})
    var closed = make(chan struct{})

    go func() {
        // 模拟业务处理
        for {
            select {
            case <-closing:
                return
            default:
                // ....... 业务计算
                time.Sleep(100 * time.Millisecond)
            }
        }
    }()

    // 处理CTRL+C等中断信号
    termChan := make(chan os.Signal)
    signal.Notify(termChan, syscall.SIGINT, syscall.SIGTERM)
    <-termChan

    close(closing)
    // 执行退出之前的清理动作
    go doCleanup(closed)

    select {
    case <-closed:
    case <-time.After(time.Second):
        fmt.Println("清理超时，不等了")
    }
    fmt.Println("优雅退出")
}

func doCleanup(closed chan struct{}) {
    time.Sleep((time.Minute))
    close(closed)
}
```

## 5. 锁
使用 chan 也可以实现互斥锁。在 chan 的内部实现中，就有一把互斥锁保护着它的所有字段。从外在表现上，chan 的发送和接收之间也存在着 happens-before 的关系，保证元素放进去之后，receiver 才能读取到。

要想使用 chan 实现互斥锁，至少有两种方式。一种方式是先初始化一个 capacity 等于 1 的 Channel，然后再放入一个元素。这个元素就代表锁，谁取得了这个元素，就相当于获取了这把锁。另一种方式是，先初始化一个 capacity 等于 1 的 Channel，它的“空槽”代表锁，谁能成功地把元素发送到这个 Channel，谁就获取了这把锁。

我们以第一种为例实现一个锁:

```go

```