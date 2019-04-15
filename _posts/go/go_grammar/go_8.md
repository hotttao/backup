---
title: 8 go 并发编程一
date: 2019-01-08
categories:
    - Go
tags:
    - go语言入门
---

Go 并发编程原语，Goroutines和Channels
<!-- more -->

![Hello World](/images/go/grammar/go_func.jpg)


## 1. GO 并发编程简介
上一篇我们讲解了 Go 语言中的接口，至此对于 Go 语言的类型系统我们基本上讲的差不都了。接下来我们将深入了解 Go 最为人推广的特性并发编程。对于那些完全独立的子问题，并发是简单的，但是真正复杂的是处理那些存在资源共享的多进程多线程并发问题。我们需要有效的通信机制来处理程序中的竞争条件，同时避免可能出现的死锁问题。


Go 之所以在并发编程中被人推广，是因为它提供的 goroutine 和 channel 支持“顺序通信进程”(communicating sequential processes)简称为CSP，这是一种现代的并发编程模型。CSP的具体原理我也不是很懂，但是通过 Go 语言的 goroutine 和 channel 可以感觉到它可以明显降低我们并发编程难度。

但是没有一招鲜吃遍天的技术，每个模型都是特定的假设条件和使用情景，CSP 也不例外。所以要想写出正确的并发程序，对操作系统提供的锁，信号量等进程间通信的底层机制的了解必不可少。我们会在下一节介绍传统的并发模型：多线程共享内存。


## 2. Goroutine
在Go语言中，每一个并发的执行单元叫作一个goroutine。当一个程序启动时，其主函数即在一个单独的goroutine中运行，我们叫它main goroutine 。

### 2.1 goroutine 创建
新的goroutine会用go语句来创建。在语法上，go语句是一个普通的函数或方法调用前加上关键字go。go语句会使其语句中的函数在一个新创建的goroutine中运行。而go语句本身会迅速地完成。

```Go
f() // call f(); wait for it to return
go f() // create a new goroutine that calls f(); don't wait
```

### 2.2 goroutine 退出与回收
主函数返回时，所有的goroutine都会被直接打断，程序退出。如果 goroutine 因为 阻塞永远被卡住，我们称发生了goroutine泄漏，和垃圾变量不同，泄漏的goroutines并不会被自动回收，因此确保每个不再需要的goroutine能正常退出是重要的。

### 2.3 goroutine 中断
除了从主函数退出或者直接终止程序之外，没有其它的编程方法能够让一个goroutine来打断另一个的执行，之所以这样是因为，这样可能会导致goroutine之间的共享变量落在未定义的状态上。但是通过 goroutine 之间的通信机制，可以实现让一个goroutine 在收到其它的 goroutine 特定信号时终止退出。这个必须得等到我们讲完 channel 时才能继续说明。

## 3. channels
如果说goroutine是Go语言程序的并发体的话，那么channels则是它们之间的通信机制。一个 channels 可以让一个 goroutine 通过它给另一个 goroutine 发送值信息。

每个channel都有一个特殊的类型，也就是channels可发送数据的类型。和其它的引用类型一样，channel的零值也是nil，因此channel 可以与 nil 值比较。两个相同类型的channel可以使用`==`运算符比较。如果两个channel引用的是相通的对象，那么比较的结果为真。

### 3.1 channel 创建
创建 channel 最简单的方式是使用 `make` 函数，第二个可选参数，用于指定 channel 的容量。

```Go
ch = make(chan int)    // 无缓存 channel 
ch = make(chan int, 0) // 无缓存 channel 
ch = make(chan int, 3) // 待缓存的 channel

cap(ch)    // 获取 channel 容量
len(ch)    // 返回 channel 中有效元素个数
```

channel 与并发的先进先出队列极其相似:
1. 发送在队尾部插入元素，接收从队首删除元素
1. 当 channel 空时，从 channel 接收值的 goroutine 将被阻塞，直至另一个 goroutine 向 channel 发送值
2. 当 channel 满时，向 channel 发送值的 goroutine 将被阻塞，直至另一个 goroutine 从 channel 接收值
3. 特别的对于无缓存 channels 的发送和接收操作将导致两个goroutine做一次同步操作，当通过一个无缓存 channels 发送数据时，接收者收到数据发生在唤醒发送者 goroutine 之前。

### 3.2 发送与接收
channel有发送和接受两种操作:

```Go
ch <‐ x   // 向 channel 发送一个值
x = <‐ch  // 从 channel 接收值
<‐ch      // 从 channel 接收值，但丢弃

close(ch) // 关闭 channel
```

为了防止 channel 被乱用，Go语言的类型还提供了单方向的channel类型，即只发送或只接收的channel。

```Go
// 只发送和只接受的 channel 类型
chan<‐ int   // 只发送int的channel，不能接收
<‐chan int   // 只接收int的channel，不能发送

func squarer(out chan<‐ int, in <‐chan int) {}
```

任何双向channel向单向channel变量的赋值操作都将导致该隐式转换。但是没有反向转换的语法，即不能将类似 chan<‐ int类型的单向型的channel转换为 chan int类型的双向型的channel。

因为关闭操作只用于断言不再向channel发送新的数据，所以只有在发送者所在的goroutine才会调用close函数，因此对一个只接收的channel调用close将是一个编译错误。

### 3.3 关闭
channel还支持close操作，用于关闭channel,对于接收方和发送方，关闭channel之后的操作是不同的:
1. 发送方: 对一个关闭的 channel 的任何发送操作都将导致panic异常，因此关闭操作只能由发送方执行
2. 接收方: 在 channel 关闭之后依然可以接受到之前已经成功发送的数据；如果channel中已经没有数据，后续的接收操作也不会再阻塞，而是立即返回一个零值

所以对于下面这个例子，即使 naturals变量对应的channel 被关闭，循环也不会终止，它依然会收到一个永无休止的零值序列。

```Go
// Squarer
go func() {
	for {
		x := <‐naturals
		squares <‐ x * x
	}
}()
```

没有办法直接测试一个channel是否被关闭，但是接收操作有一个变体形式：它多接收一个结果，多接收的第二个结果是一个布尔值ok，ture表示成功从channels接收到值，false表示channels已经被关闭并且里面没有值可接收。

```Go
// 通过可选的第二个参数，在接收方判断 channel 是否关闭
go func() {
	for {
		x, ok := <‐naturals
		if !ok {
			break // channel was closed and drained
		}
		squares <‐ x * x
	}
	close(squares)
}()

// range循环可直接在channels上迭代，当channel被关闭并且没有值可接收时跳出循环
go func() {
	for x := range naturals {
		squares <‐ x * x
	}
	close(squares)
}()
```


最后，试图重复关闭一个channel将导致panic异常，试图关闭一个nil值的channel也将导致panic异常。关闭一个channels还会触发一个广播机制。

## 4. select 多路复用
select 多路复用用来同时监听多个 channel 的接收和发送操作，与 和 switch 语句稍微有点相似，select 也会有几个case和最后的default选择分支。每一个case代表一个通信操作(在某个channel上进行发送或者接收)并且会包含一些语句组成的一个语句块。

```Go
select {
case <‐ch1:
	// ...
case x := <‐ch2:
	// ...use x...
case ch3 <‐ y:
	// ...
default:
	// ...
}
```

select会等待case中的 channel 操作，直至出现一个可通信的 channel 时，执行通信并选择对应的 case 执行；这时候其它通信是不会执行的。一个没有任何case的select语句写作select{}，会永远地等待下去。如果多个case同时就绪时，select会随机地选择一个执行，这样来保证每一个channel都有平等的被select的机会。

对一个nil的channel发送和接收操作会永远阻塞，在select语句中操作nil的channel永远都不会被select到。这使得我们可以用nil来激活或者禁用case，来达成处理其它输入或输出事件时超时和取消的逻辑。

## 5. goroutine 的中断
关闭了一个channel并且被消费掉了所有已发送的值，操作channel之后的代码可以立即被执行，并且会产生零值。我们可以将这个机制扩展一下，来作为我们的广播机制：不要向channel发送值，而是用关闭一个channel来进行广播。


```Go
var done = make(chan struct{})
func cancelled() bool {
	select {
		case <‐done:          // channel 被关闭后，立马就会执行
			return true
		default:
			return false
	}
}

go func() {
	os.Stdin.Read(make([]byte, 1)) // read a single byte
	close(done)                    // 通过关闭 channel，进行消息广播
}()
```
