---
weight: 1
title: "Go Work Pool"
date: 2021-06-23T22:00:00+08:00
lastmod: 2021-06-23T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go 协程池"
featuredImage: 

tags: ["go 库"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

我们在 Go 第四部分 Go 并发系列的 [sync.Pool]({{< ref "posts/program/go/sync/go_sync_10.md" >}}) 和 [channel]({{< ref "posts/program/go/sync/go_sync_14.md" >}}) 提到了很多用于 Go 协程池的第三方库，今天我们就来详细介绍它们的使用和实现。

### 1. worker 池
我们的第一个示例来自Marcio Castilho 在 [使用 Go 每分钟处理百万请求](http://marcio.io/2015/07/handling-1-million-requests-per-minute-with-golang/)  这篇文章中，就介绍了他们应对大并发请求的设计。这不是一个库，但是 worker pool 的实现很具有代表性:
1. 他们将用户的请求放在一个 chan Job 中，这个 chan Job 就相当于一个待处理任务队列
2. 除此之外，还有一个 chan chan Job 队列，用来存放可以处理任务的 worker 的缓存队列
3. 每个 goroutine 都监听 chan chan Job 中的一个 chan Job

下面核心代码实现。

### 1.1 核心对象

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
    // 这个每个 worker 监听的任务队列
		JobChannel: make(chan Job),
		quit:       make(chan bool)}
}

// 4. 创建 Worker Pool
type Dispatcher struct {
  // 这是 worker 池，也是任务传递的中介
	WorkerPool chan chan Job
}

func NewDispatcher(maxWorkers int) *Dispatcher {
	pool := make(chan chan Job, maxWorkers)
	return &Dispatcher{WorkerPool: pool}
}
```

### 1.2 任务启动，创建 worker pool
```go
func (d *Dispatcher) Run() {
    // starting n number of workers
	for i := 0; i < d.maxWorkers; i++ {
		worker := NewWorker(d.pool)
		worker.Start()
	}

	go d.dispatch()
}
// 4.1 将任务从 JobQueue 放入到 Worker Pool 中某一个 Workder 的 JobChannel 中，来调用 Worker
func (d *Dispatcher) dispatch() {
	for {
		select {
    // JobQueue 就是一个待处理任务队列
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

// 3.1 启动任务
func (w Worker) Start() {
	go func() {
		for {
			// 重要: 把当前 worker 注册到  worker 池中
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

```
### 1.3 使用 worker pool
```go
// 5. 使用 Worker Pool
func payloadHandler(w http.ResponseWriter, r *http.Request) {

    if r.Method != "POST" {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

    // Read the body into a string for json decoding
	var content = &PayloadCollection{}
	err := json.NewDecoder(io.LimitReader(r.Body, MaxLength)).Decode(&content)
    if err != nil {
		w.Header().Set("Content-Type", "application/json; charset=UTF-8")
		w.WriteHeader(http.StatusBadRequest)
		return
	}

    // Go through each payload and queue items individually to be posted to S3
    for _, payload := range content.Payloads {

        // let's create a job with the payload
        work := Job{Payload: payload}

        // Push the work onto the queue.
        JobQueue <- work
    }

    w.WriteHeader(http.StatusOK)
}
}
```

### 1.4 个人理解
这个 worker pool 第一看优点迷惑，有很多 channel，但是如果厘清里面的实现逻辑就感觉非常清晰，重点理解 Worker 这个 struct:
1. 首先每个 worker 有各自监听的任务队列，而且一个 worker 就是一个 goroutine
2. 然后他包含的 WorkerPool，就是 worker 挂载的 worker pool，worker 在启动时，需要把自己注册到 worker pool 中: `w.WorkerPool <- w.JobChannel`
3. Job 的流转过程是:
  - 调用方把 Job 发送到全局的 JobQueue 中
  - dispatch 从 JobQueue 拿到一个 Job，然后从 worker pool 拿到一个 worker 的 chan Job，即一个 goroutine
  - 把 job 发送到worker 的 chan Job 中，让 worker 开始执行

这个实现中我有点不理解的地方是，为什么 Worker 的方法传递的是 Worker 的值，而不是指针。因为 Worker 的成员都是 chan，chan 在内部实现上就是指向 hchan 的指针，所以不会有内部状态复制的问题。
