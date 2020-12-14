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
