---
title: 7. Go PIPELINE
date: 2021-01-07
categories:
    - Go
tags:
    - Go设计模式
---
Go 流处理编程模式，这篇文章摘录自[耗子哥博客-Go编程模式](https://coolshell.cn/articles/21228.html)

<!-- more -->


## 1. Pipeline 模式
对于Pipeline用过Unix/Linux命令行的人都不会陌生，他是一种把各种命令拼接起来完成一个更强功能的技术方法。在今天，流式处理，函数式编程，以及应用网关对微服务进行简单的API编排，其实都是受pipeline这种技术方式的影响。

Pipeline 可以很容易的把代码按单一职责的原则拆分成多个高内聚低耦合的小模块，然后方便地拼装起来去完成比较复杂的功能。

接下来我们就来介绍 Go Pipeline 的实现。Rob Pike在 [Go Concurrency Patterns: Pipelines and cancellation](https://blog.golang.org/pipelines) 这篇blog中介绍了如下的一种编程模式。

### 1.1 Channel 管理
首先，我们需一个 echo()函数，其会把一个整型数组放到一个Channel中，并返回这个Channel

```go
func echo(nums []int) <-chan int {
  out := make(chan int)
  go func() {
    for _, n := range nums {
      out <- n
    }
    close(out)
  }()
  return out
}
```

然后，我们依照这个模式，我们可以写出下面这些函数:

#### 平方函数

```go
func sq(in <-chan int) <-chan int {
  out := make(chan int)
  go func() {
    for n := range in {
      out <- n * n
    }
    close(out)
  }()
  return out
}
```

#### 过滤奇数函数

```go
func odd(in <-chan int) <-chan int {
  out := make(chan int)
  go func() {
    for n := range in {
      if n%2 != 0 {
        out <- n
      }
    }
    close(out)
  }()
  return out
}
```

#### 求和函数

```go
func sum(in <-chan int) <-chan int {
  out := make(chan int)
  go func() {
    var sum = 0
    for n := range in {
      sum += n
    }
    out <- sum
    close(out)
  }()
  return out
}
```

#### 客户端代码
我们的用户端的代码如下所示：

```go
var nums = []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
for n := range sum(sq(odd(echo(nums)))) {
  fmt.Println(n)
}
```

上面的代码类似于我们执行了Unix/Linux命令： `echo $nums | sq | sum`。

同样，如果你不想有那么多的函数嵌套，你可以使用一个代理函数来完成。

```go
type EchoFunc func ([]int) (<- chan int) 
type PipeFunc func (<- chan int) (<- chan int) 

func pipeline(nums []int, echo EchoFunc, pipeFns ... PipeFunc) <- chan int {
  ch  := echo(nums)
  for i := range pipeFns {
    ch = pipeFns[i](ch)
  }
  return ch
}

var nums = []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}    
for n := range pipeline(nums, gen, odd, sq, sum) {
    fmt.Println(n)
  }
```

### 1.2 Fan in/Out
Go语言的 Go Routine和 Channel还有一个好处，就是可以写出1对多，或多对1的pipeline，也就是Fan In/ Fan Out。下面，我们来看一个Fan in的示例：

我们想通过并发的方式来对一个很长的数组中的质数进行求和运算，我们想先把数组分段求和，然后再把其集中起来。

```go
// 1. 数组生成
func makeRange(min, max int) []int {
  a := make([]int, max-min+1)
  for i := range a {
    a[i] = min + i
  }
  return a
}

// 2. 主函数
func main() {
  nums := makeRange(1, 10000)
  in := echo(nums)

  const nProcess = 5
  var chans [nProcess]<-chan int
  // 生成 5 个 Channel，然后都调用 sum(prime(in)) ，于是每个Sum的Go Routine都会开始计算和
  for i := range chans {
    chans[i] = sum(prime(in))
  }

  for n := range sum(merge(chans[:])) {
    fmt.Println(n)
  }
}

// 3. 判断是否为质数
func is_prime(value int) bool {
  for i := 2; i <= int(math.Floor(float64(value) / 2)); i++ {
    if value%i == 0 {
      return false
    }
  }
  return value > 1
}

// 4. 质数筛选 Pipeline
func prime(in <-chan int) <-chan int {
  out := make(chan int)
  go func ()  {
    for n := range in {
      if is_prime(n) {
        out <- n
      }
    }
    close(out)
  }()
  return out
}
```

最后再把所有的结果再求和拼起来，得到最终的结果。其中的merge代码如下：

```go
func merge(cs [] <-chan int) <-chan int {
    var wg sync.WaitGroup
    out := chan int

    wg.Add(len(cs))
    for _, c := range cs{
        go func(c <-chan int) {
            for n := range c {
                out <- n
            }
            wg.Done()
        }(c)
    }
    go func(){
        wg.Wait()
        close(out)
    }
    return out
}
```

用图片表示一下，整个程序的结构如下所示：

![linkedlist](/images/go/go_design/pipeline.png)
