---
weight: 1
title: "Go 性能优化"
date: 2023-01-02T22:00:00+08:00
lastmod: 2023-01-02T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "这个系列我们开始学习 go 语言的第二部分-go语言进阶"
featuredImage: 

tags: ["go 进阶"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

## 1. 性能基准测试
性能基准测试在Go语言中是和普通的单元测试一样被原生支持的。我们可以像对普通单元测试那样在*_test.go文件中创建性能基准测试，每个以Benchmark前缀开头的函数都会被当作一个独立的性能基准测试：

```go
func BenchmarkXxx(b *testing.B) {
    for n := 0; n < b.N; n++ {
        //...
    }
    
}
```

可以像下面这样执行性能基准测试:
```bash
$go test -bench . benchmark_intro_test.go

# 通过正则表达式选择要执行的性能测试
$go test -bench=ByJoin ./benchmark_intro_test.go

# 通过传入-benchmem命令行参数，可以输出内存分配信息
# （与基准测试代码中显式调用b.ReportAllocs的效果是等价的）
$go test -bench=Join ./benchmark_intro_test.go -benchmem
goos: darwin
goarch: amd64
#                                 执行次数    平均执行时间  每次分配的内存大小    每次循环内存分配的次数
BenchmarkConcatStringByJoin-8     23004709   48.8 ns/op          48 B/op        1 allocs/op
PASS
ok         command-line-arguments 1.183s
```

### 1.1 顺序/并发执行的基准测试
根据是否并行执行，Go的性能基准测试可以分为两类：顺序执行的性能基准测试和并行执行的性能基准测试。

#### 顺序执行的性能基准测试
```go
// .顺序执行的性能基准测试
func BenchmarkXxx(b *testing.B) {
    // ...
    for i := 0; i < b.N; i++ {
        // 被测对象的执行代码
    }
}
```

顺序执行的性能基准测试的执行过程原理，可以通过下面的例子来说明：

```go
package bench

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"

	tls "github.com/huandu/go-tls"
)

var (
	m     map[int64]struct{} = make(map[int64]struct{}, 10)
	mu    sync.Mutex
	round int64 = 1
)

func BenchmarkSequential(b *testing.B) {
	fmt.Printf("\ngoroutine[%d] enter BenchmarkSequential: round[%d], b.N[%d]\n",
		tls.ID(), atomic.LoadInt64(&round), b.N)
	defer func() {
		atomic.AddInt64(&round, 1)
	}()

	for i := 0; i < b.N; i++ {
		mu.Lock()
		_, ok := m[round]
		if !ok {
			m[round] = struct{}{}
			fmt.Printf("goroutine[%d] enter loop in BenchmarkSequential: round[%d], b.N[%d]\n",
				tls.ID(), atomic.LoadInt64(&round), b.N)
		}
		mu.Unlock()
	}
	fmt.Printf("goroutine[%d] exit BenchmarkSequential: round[%d], b.N[%d]\n",
		tls.ID(), atomic.LoadInt64(&round), b.N)
}
```

执行测试，通过日志就能看到:
1. BenchmarkSequential被执行了多轮（见输出结果中的round值）
2. 每一轮执行，for循环的b.N值均不相同
3. 除b.N为1的首轮，其余各轮均在一个goroutine（goroutine[2]）中顺序执行

默认情况下，每个性能基准测试函数（如BenchmarkSequential）的执行时间为1秒。如果不足 1s，go test会有序的增加 b.N 的值。基准测试有几个控制测试次数的参数:
1. 要增加迭代次数，可以使用-benchtime命令行选项来增加基准测试执行的时间。
2. 也可以通过-benchtime手动指定b.N的值，go test 会以指定的N值作为最终轮的循环次数。
3. 还可以显式要求go test多次执行以收集多次数据，并将这些数据经过统计学方法处理后的结果作为最终结果。

```bash
# 增加基准测试执行的时间
$go test -bench . sequential_test.go -benchtime 2s

# 执行 b.N 的次数
$go test -v -benchtime 5x -bench . sequential_test.go

# 设置 go test 执行多次
$go test -v -count 2 -bench . benchmark_intro_test.go
```

#### 并行执行的性能基准测试

并行执行的基准测试主要用于为包含多goroutine同步设施（如互斥锁、读写锁、原子操作等）的被测代码建立性能基准。这样可以反映出被测试代码在同步上性能损耗。

```go
// 并行执行的性能基准测试
func BenchmarkXxx(b *testing.B) {
    // ...
    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            // 被测对象的执行代码
        }
    }
}
```

```bash
$go test -v -bench . benchmark_paralell_demo_test.go -cpu 2,4,8
```

通过-cpu 2,4,8命令行选项告知go test将每个性能基准测试函数分别在GOMAXPROCS等于2、4、8的情况下各运行一次。这样，可以更加明显的观察到随着并发度的增加，发生在同步上的性能损耗。

和顺序执行的性能基准测试不同，并行执行的性能基准测试会启动多个goroutine并行执行基准测试函数中的循环。针对BenchmarkParalell基准测试的每一轮执行，go test都会启动GOMAXPROCS数量的新goroutine，这些goroutine共同执行b.N次循环，每个goroutine会尽量相对均衡地分担循环次数。

### 1.2 使用性能基准比较工具
Go核心团队先后开发了两款性能基准比较工具：[benchcmp](https://github.com/golang/tools/tree/master/cmd/benchcmp) 和 [benchstat](https://github.com/golang/perf/tree/master/benchstat)。

#### benchcmp
```go
$go test -run=NONE -bench . strcat_test.go > old.txt
$go test -run=NONE -bench . strcat_test.go > new.txt
$benchcmp old.txt new.txt
benchmark             old ns/op     new ns/op     delta
BenchmarkStrcat-8     92.4          49.6          -46.32%

// 如果使用 -count 对BenchmarkStrcat执行多次，那么benchcmp给出的结果如下：
$go test -run=NONE -count 5 -bench . strcat_test.go > old.txt
$go test -run=NONE -count 5 -bench . strcat_test.go > new.txt

$benchcmp old.txt new.txt
benchmark             old ns/op     new ns/op     delta
BenchmarkStrcat-8     92.8          51.4          -44.61%
BenchmarkStrcat-8     91.9          55.3          -39.83%
BenchmarkStrcat-8     96.1          52.6          -45.27%
BenchmarkStrcat-8     89.4          50.2          -43.85%
BenchmarkStrcat-8     91.2          51.5          -43.53%

// -best命令行选项，benchcmp 将挑选性能最好的一条数据，然后进行比较：
$benchcmp -best old.txt new.txt
benchmark             old ns/op     new ns/op     delta
BenchmarkStrcat-8     89.4          50.2          -43.85%
```

benchcmp 的实现比较简单，它不关心这些结果数据在统计学层面是否有效，只对结果做简单比较。


#### benchstat
benchstat 提高对性能基准数据比较的科学性。

```go
$go test -run=NONE -count 5 -bench . strcat_test.go -benchmem > old_with_mem.txt
$go test -run=NONE -count 5 -bench . strcat_test.go -benchmem > new_with_mem.txt

$benchstat old_with_mem.txt new_with_mem.txt
// 每次的执行时间
name      old time/op    new time/op    delta
Strcat-8    90.5ns ± 1%    50.6ns ± 2%  -44.14%  (p=0.008 n=5+5)
// 每次的内存分配大小
name      old alloc/op   new alloc/op   delta
Strcat-8     80.0B ± 0%     48.0B ± 0%  -40.00%  (p=0.008 n=5+5)
// 每次的内存分配次数
name      old allocs/op  new allocs/op  delta
Strcat-8      2.00 ± 0%      1.00 ± 0%  -50.00%  (p=0.008 n=5+5)
```

其中 ±1% 是样本数据中最大值和最小值距样本平均值的最大偏差百分比。如果这个偏差百分比大于5%，则说明样本数据质量不佳，有些样本数据是不可信的。最后一列（delta）为两次基准测试对比的变化量，这个指标后面括号中的 `p=0.008` 是一个用于衡量两个样本集合的均值是否有显著差异的指标。一般p值小于0.05的结果是可接受的。

### 1.3 控制基准测试的计时器
testing.B 中提供了多种灵活操控基准测试计时器的方法:

```go
func BenchmarkResetTimer(b *testing.B) {
    expensiveTestContextSetup()
    b.ResetTimer()
    for n := 0; n < b.N; n++ {
        // ....
    }
}

func BenchmarkStop(b *testing.B) {
    b.StopTimer()
    expensiveTestContextSetup()
    b.StartTimer()
    for n := 0; n < b.N; n++ {
        // ....
    }
}
```

ResetTimer并不停掉计时器（无论计时器是否在工作），而是将已消耗的时间、内存分配计数器等全部清零，这样即便计数器依然在工作，它仍然需要从零开始重新记；而StopTimer只是停掉一次基准测试运行的计时器，在调用StartTimer后，计时器即恢复正常工作。

将ResetTimer或StopTimer用在每个基准测试的For循环中是有副作用的:
1. 在For循环中使用StopTimer，因为会暂停计时，想要真正运行1秒就要等待很长时间；
2. 如果在For循环中使用了ResetTimer，由于其每次执行都会将计数器数据清零，因此这轮基准测试将一直执行下去，无法退出。

因此尽量不要在基准测试的For循环中使用ResetTimer！但可以在限定条件下在For循环中使用StopTimer/StartTimer。就像下面的Go标准库中这样：

```go
// $GOROOT/src/runtime/map_test.go
func benchmarkMapDeleteInt32(b *testing.B, n int) {
    a := make(map[int32]int, n)
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        if len(a) == 0 {
            b.StopTimer()
            for j := i; j < i+n; j++ {
                a[int32(j)] = j
            }
            b.StartTimer()
        }
        delete(a, int32(i))
    }
}
```

## 2. pprof 
Go 内置了对代码进行性能剖析的工具：pprof。pprof源自Google Perf Tools工具套件，在Go发布早期就被集成到Go工具链中了，并且Go运行时原生支持输出满足pprof需要的性能采样数据。

pprof 的执行分成数据采集和数据剖析两个阶段:

![pprof 执行流程](/images/go/expert/pprof.png)



### 2.1 采样数据类型
数据采集阶段，支持的采样数据类型有如下几种:
1. CPU数据(cpu.prof)
    - 作用: 能帮助我们识别出代码关键路径上消耗CPU最多的函数。
    - 频率: 一旦启用CPU数据采样，Go运行时会每隔一段短暂的时间（10ms）就中断一次（由SIGPROF信号引发）并记录当前所有goroutine的函数栈信息（存入cpu.prof）
2. 堆内存分配数据(mem.prof)
    - 作用: 它能帮助我们了解Go程序的当前和历史内存使用情况
    - 频率: 堆内存分配的采样频率可配置，默认每1000次堆内存分配会做一次采样（存入mem.prof）
3. 锁竞争数据(mutex.prof)
    - 作用: 锁竞争采样数据记录了当前Go程序中互斥锁争用导致延迟的操作。如果你认为很大可能是互斥锁争用导致CPU利用率不高，可以尝试此类型的性能剖析
    - 启用: 该类型采样数据在默认情况下是不启用的，启用方式如下:
        - `runtime.SetMutexProfileFraction`
        - `go test -bench . xxx_test.go -mutexprofile mutex.out`
4. 阻塞时间数据(block.prof)
    - 作用: 该类型采样数据记录的是goroutine在某共享资源（一般是由同步原语保护）上的阻塞时间，包括从无缓冲channel收发数据、阻塞在一个已经被其他goroutine锁住的互斥锁、向一个满了的channel发送数据或从一个空的channel接收数据等。
    - 启用: 该类型采样数据在默认情况下也是不启用的，启用方式如下:
        - `runtime.SetBlockProfileRate`
        - `go test -bench . xxx_test.go -blockprofile block.out`

采样不是免费的，因此一次采样尽量仅采集一种类型的数据，不要同时采样多种类型的数据，避免相互干扰采样结果。

### 2.2 数据采集方式
Go目前主要支持两种性能数据采集方式：性能基准测试和独立程序的性能数据采集。

#### 通过性能基准测试进行数据采集
通过性能基准测试进行数据采集，尤其适用于对应用中关键路径上关键函数/方法性能的剖析。我们仅需为go test增加一些命令行选项即可在执行性能基准测试的同时进行性能数据采集:

```go
$go test -bench . xxx_test.go -cpuprofile=cpu.prof
$ls
cpu.prof xxx.test* xxx_test.go

$go test -bench . xxx_test.go -memprofile=mem.prof
$go test -bench . xxx_test.go -blockprofile=block.prof
$go test -bench . xxx_test.go -mutexprofile=mutex.prof
```
一旦开启性能数据采集（比如传入-cpuprofile），go test的-c命令选项便会自动开启，go test命令执行后会自动编译出一个与该测试对应的可执行文件（这里是xxx.test）。该可执行文件可以在性能数据剖析过程中提供剖析所需的符号信息（如果没有该可执行文件，go tool pprof的disasm命令将无法给出对应符号的汇编代码）。

#### 独立程序的性能数据采集
可以通过标准库runtime/pprof和runtime包提供的低级API对独立程序进行性能数据采集:

```go
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"runtime"
	"runtime/pprof"
	"sync"
	"syscall"
	"time"
)

var cpuprofile = flag.String("cpuprofile", "", "write cpu profile to `file`")
var memprofile = flag.String("memprofile", "", "write memory profile to `file`")
var mutexprofile = flag.String("mutexprofile", "", "write mutex profile to `file`")
var blockprofile = flag.String("blockprofile", "", "write block profile to `file`")

func main() {
	flag.Parse()
	if *cpuprofile != "" {
		f, err := os.Create(*cpuprofile)
		if err != nil {
			log.Fatal("could not create CPU profile: ", err)
		}
		defer f.Close() // 该例子中暂忽略错误处理
		if err := pprof.StartCPUProfile(f); err != nil {
			log.Fatal("could not start CPU profile: ", err)
		}
		defer pprof.StopCPUProfile()
	}

	if *memprofile != "" {
		f, err := os.Create(*memprofile)
		if err != nil {
			log.Fatal("could not create memory profile: ", err)
		}
		defer f.Close()
		if err := pprof.WriteHeapProfile(f); err != nil {
			log.Fatal("could not write memory profile: ", err)
		}
	}

	if *mutexprofile != "" {
		runtime.SetMutexProfileFraction(1)
		defer runtime.SetMutexProfileFraction(0)
		f, err := os.Create(*mutexprofile)
		if err != nil {
			log.Fatal("could not create mutex profile: ", err)
		}
		defer f.Close()

		if mp := pprof.Lookup("mutex"); mp != nil {
			mp.WriteTo(f, 0)
		}
	}

	if *blockprofile != "" {
		runtime.SetBlockProfileRate(1)
		defer runtime.SetBlockProfileRate(0)
		f, err := os.Create(*blockprofile)
		if err != nil {
			log.Fatal("could not create block profile: ", err)
		}
		defer f.Close()

		if mp := pprof.Lookup("block"); mp != nil {
			mp.WriteTo(f, 0)
		}
	}

	var wg sync.WaitGroup
	c := make(chan os.Signal, 1)
	signal.Notify(c, syscall.SIGINT, syscall.SIGTERM)
	wg.Add(1)
	go func() {
		for {
			select {
			case <-c:
				wg.Done()
				return
			default:
				s1 := "hello,"
				s2 := "gopher"
				s3 := "!"
				_ = s1 + s2 + s3
			}

			time.Sleep(10 * time.Millisecond)
		}
	}()
	wg.Wait()
	fmt.Println("program exit")
}
```

独立程序的性能数据采集方式对业务代码侵入较多，还要自己编写一些采集逻辑：定义flag变量、创建输出文件、关闭输出文件等。每次采集都要停止程序才能获取结果。（当然可以重新定义更复杂的控制采集时间窗口的逻辑，实现不停止程序也能获取采集数据结果。）

#### http 服务性能数据采集
Go在net/http/pprof包中还提供了一种更为高级的针对独立程序的性能数据采集方式，这种方式尤其适合那些内置了HTTP服务的独立程序。net/http/pprof包可以直接利用已有的HTTP服务对外提供用于性能数据采集的服务端点（endpoint）。

```go
package main

import (
	"context"
	"fmt"
	"net/http"
	_ "net/http/pprof"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	http.Handle("/hello", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Println(*r)
		w.Write([]byte("hello"))
	}))
	s := http.Server{
		Addr: "localhost:8080",
	}
	c := make(chan os.Signal, 1)
	signal.Notify(c, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-c
		s.Shutdown(context.Background())
	}()
	fmt.Println(s.ListenAndServe())
}
```

下面是net/http/pprof包的init函数，init 函数中向 http 的默认路由添加了很多服务端点和处理函数，通过这些服务端点，我们可以在该独立程序运行期间获取各种类型的性能采集数据。

```go
//$GOROOT/src/net/http/pprof/pprof.go

func init() {
    http.HandleFunc("/debug/pprof/", Index)
    http.HandleFunc("/debug/pprof/cmdline", Cmdline)
    http.HandleFunc("/debug/pprof/profile", Profile)
    http.HandleFunc("/debug/pprof/symbol", Symbol)
    http.HandleFunc("/debug/pprof/trace", Trace)
}
```

访问http://localhost:8080/debug/pprof/，可以看到以下页面:


![http 服务性能数据采集](/images/go/expert/http_pprof.png)

页面里列出了多种类型的性能采集数据，**点击其中任何一个即可完成该种类型性能数据的一次采集**。profile是CPU类型数据的服务端点，点击该端点后，该服务默认会发起一次持续30秒的性能采集，得到的数据文件会由浏览器自动下载到本地。如果想自定义采集时长，可以通过为服务端点传递时长参数实现: http://localhost:8080/debug/pprof/profile?seconds=60

如果未使用 http 默认路由，只需要自行注册对应的服务端点即可:

```go
func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/debug/pprof/", pprof.Index)
	mux.HandleFunc("/debug/pprof/profile", pprof.Profile)
    // ....
}
```

如果是非HTTP服务程序，则在导入包的同时还需单独启动一个用于性能数据采集的goroutine:

```go
package main

import (
	"fmt"
	"net/http"
	_ "net/http/pprof"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

func main() {
	go func() {
		fmt.Println(http.ListenAndServe("localhost:8080", nil))
	}()

	var wg sync.WaitGroup
	c := make(chan os.Signal, 1)
	signal.Notify(c, syscall.SIGINT, syscall.SIGTERM)
	wg.Add(1)
    // ...
	wg.Wait()
	fmt.Println("program exit")
}
```

相比第一种方式，导入net/http/pprof包进行独立程序性能数据采集的方式侵入性更小，代码也更为独立，并且无须停止程序，通过预置好的各类性能数据采集服务端点即可随时进行性能数据采集。

### 2.3 性能数据的剖析
Go工具链通过pprof子命令提供了两种性能数据剖析方法：命令行交互式和 Web 图形化。

#### 命令行交互式
对应于三种不同的采样方式，有三种进入命令行交互模式的方式:
```go
$go tool pprof xxx.test cpu.prof // 剖析通过性能基准测试采集的数据
$go tool pprof standalone_app cpu.prof // 剖析独立程序输出的性能采集数据
// 通过net/http/pprof注册的性能采集数据服务端点获取数据并剖析
$go tool pprof http://localhost:8080/debug/pprof/p
```

这里以 standalone_app 为例进行说明:

##### CPU 性能剖析
```bash
$ go build -o pprof_standalone1 pprof_standalone1.go
$ ./pprof_standalone1 -cpuprofile pprof_standalone1_cpu.prof
^Cprogram exit

# 通过go tool pprof命令进入命令行交互模式：
$ go tool pprof pprof_standalone1 pprof_standalone1_cpu.prof
File: pprof_standalone1
Type: cpu
Time: ...
# 从pprof子命令的输出中我们看到：程序运行16.14s，采样总时间为240ms，占总时间的1.49%。
Duration: 16.14s, Total samples = 240ms ( 1.49%)
Entering interactive mode (type "help" for commands, "o" for options)
(pprof)

# 命令行交互方式下最常用的命令是topN
(pprof) top
Showing nodes accounting for 240ms, 100% of 240ms total
Showing top 10 nodes out of 29
      flat  flat%   sum%        cum   cum%
      90ms 37.50% 37.50%       90ms 37.50%  runtime.nanotime1
      50ms 20.83% 58.33%       50ms 20.83%  runtime.pthread_cond_wait
      40ms 16.67% 75.00%       40ms 16.67%  runtime.usleep
      20ms  8.33% 83.33%       20ms  8.33%  runtime.asmcgocall
      20ms  8.33% 91.67%       20ms  8.33%  runtime.kevent
      10ms  4.17% 95.83%       10ms  4.17%  runtime.pthread_cond_signal
      10ms  4.17%   100%       10ms  4.17%  runtime.pthread_cond_timedwait_
                                                relative_np
         0     0%   100%       10ms  4.17%  main.main.func1
         0     0%   100%       30ms 12.50%  runtime.checkTimers
         0     0%   100%      130ms 54.17%  runtime.findrunnable

```

命令行交互方式下最常用的命令是topN，N 默认为 10，topN命令的输出结果默认按flat(flat%)从大到小的顺序输出。
1. flat列的值表示函数自身代码在数据采样过程中的执行时长。
2. flat%列的值表示函数自身代码在数据采样过程中的执行时长占总采样执行时长的百分比。
3. sum%列的值是当前行flat%值与排在该值前面所有行的flat%值的累加和。以第三行的sum%值75.00%为例，该值由前三行flat%累加而得，即16.67% + 20.83% + 37.50% = 75.00%。
4. cum列的值表示函数自身在数据采样过程中出现的时长，这个时长是**其自身代码执行时长**及其**等待其调用的函数返回所用时长的总和**。越是接近函数调用栈底层的代码，其cum列的值越大。
5. cum%列的值表示该函数cum值占总采样时长的百分比。比如：runtime.findrunnable函数的cum值为130ms，总采样时长为240ms，则其cum%值为两者的比值百分化后的值。

```bash
(pprof) list main.main
Total: 240ms
ROUTINE ======================== main.main.func1 in chapter8/sources/pprof_standalone1.go
         0       10ms (flat, cum)  4.17% of Total
         .          .     86:                       s2 := "gopher"
         .          .     87:                       s3 := "!"
         .          .     88:                       _ = s1 + s2 + s3
         .          .     89:                   }
         .          .     90:
         .       10ms     91:                   time.Sleep(10 * time.Millisecond)
         .          .     92:           }
         .          .     93:    }()
         .          .     94:    wg.Wait()
         .          .     95:    fmt.Println("program exit")
         .          .     96:}
(pprof)
```

通过list命令列出函数对应的源码，在展开源码的同时，pprof还列出了代码中对应行的消耗时长（基于采样数据）。可以选择耗时较长的函数，进一步向下展开，直到找到令我们满意的结果（某个导致性能瓶颈的函数中的某段代码）。

```bash
(pprof) png
Generating report in profile001.png
```
在命令行交互模式下，还可以生成CPU采样数据的函数调用图，且可以导出为多种格式，如PDF、PNG、JPG、GIF、SVG等。不过要做到这一点，前提是本地已安装图片生成所依赖的插件graphviz。

![CPU采样数据的函数调用图](/images/go/expert/pprof_png.png)

我们可以清晰地看到cum%较大的叶子节点（用黑色粗体标出，叶子节点的cum%值与flat%值相等），它们就是我们需要重点关注的优化点。

##### 内存性能剖析
我们在来看看内存性能剖析的常见选项:

```go
$go test -v -run=^$ -bench=^BenchmarkHi$ -benchtime=2s -memprofile=mem.prof
$go tool pprof step2.test mem.prof
File: step2.test
Type: alloc_space
Entering interactive mode (type "help" for commands, "o" for options)
(pprof)
```

在go tool pprof的输出中有一行为Type: alloc_space。Type 表示的是采样类型:
1. alloc_space: 表示当前pprof将呈现程序运行期间所有内存分配的采样数据（即使该分配的内存在最后一次采样时已经被释放）
2. inuse_space: 表示内存数据采样结束时依然在用的内存。

可以在启动pprof工具时指定所使用的内存数据呈现类型：

```go
$go tool pprof --alloc_space step2.test mem.prof // 遗留方式
$go tool pprof -sample_index=alloc_space step2.test mem.prof //最新方式
```

亦可在进入pprof交互模式后，通过sample_index命令实现切换：

```go
(pprof) sample_index = inuse_space
```

现在以alloc_space类型进入pprof命令交互界面并执行top命令：

```bash
$go tool pprof -sample_index=alloc_space step2.test mem.prof
File: step2.test
Type: alloc_space
Entering interactive mode (type "help" for commands, "o" for options)
(pprof) top -cum
Showing nodes accounting for 2084.53MB, 99.45% of 2096.03MB total
Showing top 10 nodes out of 11
     flat  flat%   sum%        cum   cum%
        0     0%     0%  2096.03MB   100%  chapter8/sources/go-pprof-optimization-
                                           demo/step2.BenchmarkHi
 840.55MB 40.10% 40.10%  2096.03MB   100%  chapter8/sources/go-pprof-optimization-
                                           demo/step2.handleHi
        0     0% 40.10%  2096.03MB   100%  testing.(*B).launch
        0     0% 40.10%  2096.03MB   100%  testing.(*B).runN
        0     0% 40.10%  1148.98MB 54.82%  bytes.(*Buffer).Write
        0     0% 40.10%  1148.98MB 54.82%  bytes.(*Buffer).grow
1148.98MB 54.82% 94.92%  1148.98MB 54.82%  bytes.makeSlice
        0     0% 94.92%  1148.98MB 54.82%  net/http/httptest.(*ResponseRecorder).
                                           Write
        0     0% 94.92%       95MB  4.53%  net/http.Header.Set (inline)
     95MB  4.53% 99.45%       95MB  4.53%  net/textproto.MIMEHeader.Set (inline)
(pprof)
(pprof) list handleHi
Total: 2.05GB
ROUTINE ======================== chapter8/sources/go-pprof-optimization-demo/step2.handleHi in chapter8/sources/go-pprof-optimization-demo/step2/demo.go
  840.55MB     2.05GB (flat, cum)   100% of Total
         .          .     17:    http.Error(w, "Optional color is invalid",
                                            http.StatusBadRequest)
         .          .     18:    return
         .          .     19: }
         .          .     20:
         .          .     21:  visitNum := atomic.AddInt64(&visitors, 1)
         .       95MB     22:  w.Header().Set("Content-Type", "text/html;
                                             charset= utf-8")
  365.52MB     1.48GB     23:  w.Write([]byte("<h1 style='color: " +
                                             r.FormValue ("color") +
  475.02MB   486.53MB     24:    "'>Welcome!</h1>You are visitor number " +
                                      fmt.Sprint(visitNum) + "!"))
         .          .     25:}
         .          .     26:
         .          .     27:func main() {
         .          .     28:  log.Printf("Starting on port 8080")
         .          .     29:  http.HandleFunc("/hi", handleHi)

```

##### 并发阻塞性能剖析
我们在来看看并发阻塞性能剖析的常见选项:

```bash
$go test -bench=Parallel -blockprofile=block.prof
goos: darwin
goarch: amd64
pkg: chapter8/sources/go-pprof-optimization-demo/step5
BenchmarkHiParallel-8     15029988              118 ns/op
PASS
ok         chapter8/sources/go-pprof-optimization-demo/step5   2.092s

$go tool pprof step5.test block.prof
File: step5.test
Type: delay
Entering interactive mode (type "help" for commands, "o" for options)
(pprof) top
Showing nodes accounting for 3.70s, 100% of 3.70s total
Dropped 18 nodes (cum <= 0.02s)
Showing top 10 nodes out of 15
      flat  flat%   sum%        cum   cum%
     1.85s 50.02% 50.02%      1.85s 50.02%  runtime.chanrecv1
     1.85s 49.98%   100%      1.85s 49.98%  sync.(*WaitGroup).Wait
         0     0%   100%      1.85s 49.98%  chapter8/sources/go-pprof-optimization-
                                            demo/step5.BenchmarkHiParallel
         0     0%   100%      1.85s 50.02%  main.main
         0     0%   100%      1.85s 50.02%  runtime.main
         0     0%   100%      1.85s 50.02%  testing.(*B).Run
         0     0%   100%      1.85s 49.98%  testing.(*B).RunParallel
         0     0%   100%      1.85s 50.01%  testing.(*B).doBench
         0     0%   100%      1.85s 49.98%  testing.(*B).launch
         0     0%   100%      1.85s 50.01%  testing.(*B).run
(pprof) list handleHi
Total: 3.70s
ROUTINE ======================== chapter8/sources/go-pprof-optimization-demo/step5.handleHi in chapter8/sources/go-pprof-optimization-demo/step5/demo.go
         0    18.78us (flat, cum) 0.00051% of Total
         .          .     19:    return bytes.NewBuffer(make([]byte, 128))
         .          .     20:  },
         .          .     21:}
         .          .     22:
         .          .     23:func handleHi(w http.ResponseWriter, r *http.Request) {
         .    18.78us     24:  if !rxOptionalID.MatchString(r.FormValue("color")) {
         .          .     25:    http.Error(w, "Optional color is invalid",
                                    http. StatusBadRequest)
         .          .     26:    return
         .          .     27:  }
         .          .     28:
         .          .     29:  visitNum := atomic.AddInt64(&visitors, 1)
(pprof)
```

#### Web 图形化
go tool pprof提供了基于Web的图形化呈现所采集性能数据的方式。

```bash
$go tool pprof -http=:9090 pprof_standalone1_cpu.prof
Serving web UI on http://localhost:9090

# 针对通过net/http/pprof暴露性能数据采样端点的独立程序
# 执行go tool pprof时，会进行默认30秒的CPU类型性能数据采样，
# 然后将采集的数据下载到本地，存为pprof.samples.cpu.001.pb.gz，
# 之后go tool pprof加载pprof.samples.cpu.001.pb.gz并自动启动浏览器进入性能剖析默认页面（函数调用图）
$go tool pprof -http=:9090 http://localhost:8080/debug/pprof/profile
Fetching profile over HTTP from http://localhost:8080/debug/pprof/profile
Saved profile in /Users/tonybai/pprof/pprof.samples.cpu.001.pb.gz
Serving web UI on http://localhost:9090
```

图形化剖析页面的 VIEW 下拉菜单支持 Graph、 Top、Source、Flame Graph:
1. Graph 就是函数调用图(对应于 png 命令生成的)
2. Top 对应 topN 命令
3. Source 对应于 List 命令
4. Flame Graph 对应火焰图

Flame Graph视图即火焰图，Go 1.10版本在go工具链中添加了对火焰图的支持。

![火焰图](/images/go/expert/pprof_flame.png)

go tool pprof在浏览器中呈现出的火焰图与标准火焰图有些差异：它是倒置的，即调用栈最顶端的函数在最下方。y轴表示函数调用栈，每一层都是一个函数。调用栈越深，火焰越高。火焰图的x轴表示抽样数量，如果一个函数在x轴上占据的宽度越宽，就表示它被抽样到的次数越多，即执行的时间越长。**倒置火焰图就是看最下面的哪个函数占据的宽度最大，这样的函数可能存在性能问题**。
