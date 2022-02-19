---
weight: 1
title: "go 并发编程"
date: 2021-01-08T22:00:00+08:00
lastmod: 2021-01-08T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "goroutines 和 channel"
featuredImage: 

tags: ["go 语法"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

Go 并发编程原语，Goroutines和Channels

<!-- more -->


## 1. GO 并发编程简介
上一篇我们讲解了 Go 语言中的接口，至此对于 Go 语言的类型系统我们基本上讲的差不都了。接下来我们将深入了解 Go 最为人推广的特性并发编程。对于那些完全独立的子问题，并发是简单的，但是真正复杂的是处理那些存在资源共享的多进程多线程并发问题。我们需要有效的通信机制来处理程序中的竞争条件，同时避免可能出现的死锁问题。


Go 之所以在并发编程中被人推广，是因为它提供的 goroutine 和 channel 支持“顺序通信进程”(communicating sequential processes)简称为CSP，这是一种现代的并发编程模型。CSP的具体原理我也不是很懂，但是 Go 有一句口头禅“不要使用共享数据来通信；使用通信来共享数据” 。学完这部分内容，你就能理解这句话的含义了。


没有一招鲜吃遍天的技术，每个模型都是特定的假设条件和使用情景，CSP 也不例外。相比于 GSP 传统的并发模型：多线程共享内存，可能更容易出错(竞争条件和死锁)，但是也更加灵活。所以要想写出正确的并发程序，对操作系统提供的锁，信号量等进程间通信的底层机制的了解必不可少。我们将分为三节来介绍这些并发编程的技巧，本节我们先来学习 goroutine 和 channel。


## 2. Goroutine
在Go语言中，每一个并发的执行单元叫作一个goroutine。当一个程序启动时，其主函数即在一个单独的goroutine中运行，我们叫它main goroutine 。

### 2.1 goroutine 创建
新的goroutine会用go语句来创建。在语法上，go语句是一个普通的函数或方法调用前加上关键字go。go语句会使其语句中的函数在一个新创建的goroutine中运行。而go语句本身会迅速地完成。

```Go
f() // call f(); wait for it to return
go f() // create a new goroutine that calls f(); don't wait
```

### 2.2 goroutine 退出与回收
通常goroutine在执行完毕时会自动回收，当主函数返回时，所有未执行完毕的 goroutine 会被直接打断，程序退出。如果 goroutine 因为阻塞永远被卡住，我们称发生了goroutine泄漏，和垃圾变量不同，泄漏的goroutines并不会被自动回收，因此确保每个不再需要的goroutine能正常退出是重要的。

### 2.3 goroutine 中断
除了从主函数退出或者直接终止程序之外，没有其它的编程方法能够让一个goroutine来打断另一个的执行。但是通过 goroutine 之间的通信机制，可以实现让一个 goroutine 在收到其它的 goroutine 特定信号时终止退出。这个必须得等到我们讲完 channel 时才能继续说明。

## 3. channels
如果说goroutine是Go语言程序的并发体的话，那么 channels 则是它们之间的通信机制。一个 channels 可以让一个 goroutine 通过它给另一个 goroutine 发送值信息。

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
1. 发送在队尾插入元素，接收从队首删除元素
1. 当 channel 空时，从 channel 接收值的 goroutine 将被阻塞，直至另一个 goroutine 向 channel 发送值
2. 当 channel 满时，向 channel 发送值的 goroutine 将被阻塞，直至另一个 goroutine 从 channel 接收值
3. 特别的对于无缓存 channels 的发送和接收操作将导致两个goroutine做一次同步操作，需要注意的是当通过一个无缓存 channels 发送数据时，接收者收到数据发生在唤醒发送者 goroutine 之前。

### 3.2 发送与接收
channel有发送和接受两种操作:

```Go
ch <‐ x   // 向 channel 发送一个值
x = <‐ch  // 从 channel 接收值
<‐ch      // 从 channel 接收值，但丢弃

close(ch) // 关闭 channel
```

为了防止 channel 被乱用，Go语言还提供了单方向的 channel 类型，即只发送或只接收的channel。

```Go
// 只发送和只接受的 channel 类型
chan<‐ int   // 只发送int的channel，不能接收
<‐chan int   // 只接收int的channel，不能发送

func squarer(out chan<‐ int, in <‐chan int) {}
```

任何双向channel向单向channel变量的赋值操作都将导致该隐式转换。但是没有反向转换的语法，即不能将类似 chan<‐ int类型的单向型的channel转换为 chan int类型的双向型的channel。

因为关闭操作只用于断言不再向channel发送新的数据，所以只有在发送者所在的 goroutine 才会调用close函数，因此对一个只接收的channel调用 close 将是一个编译错误。

### 3.3 关闭
channel还支持close操作，用于关闭channel，对于接收方和发送方，关闭channel之后的操作是不同的:
1. 发送方: 对一个关闭的 channel 的任何发送操作都将导致panic异常，因此关闭操作只能由发送方执行
2. 接收方: 在 channel 关闭之后依然可以接受到之前已经成功发送的数据；如果channel中已经没有数据，后续的接收操作也不会再阻塞，而是立即返回一个零值。稍后我们就会利用这个特性，通过关闭 channel实现一种广播机制。

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

没有办法直接测试一个channel是否被关闭，但是接收操作有一个变体形式：它多接收一个结果，多接收的第二个结果是一个布尔值ok，ture表示成功从channels接收到值，false表示channels已经被关闭并且里面没有值可接收。range 可以简化对 channels 的读取和关闭测试，下面是一些代码示例:

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


最后，试图关闭一个nil值的channel也将导致panic异常。

## 4. select 多路复用
有些时候，我们需要同时监听多个 channel 的接收和发送操作，并选择第一个可执行 channel 进行操作。此时我们就需要 select 多路复用。select 与 和 switch 语句稍微有点相似，select 也会有几个 case和最后的default选择分支。每一个case代表一个通信操作(在某个channel上进行发送或者接收)并且会包含一些语句组成的一个语句块。

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
有了上面的铺垫，我们回头来看如何中断一个 goroutine 的执行。现在我们知道，当一个被关闭的 channel 被消费掉了所有已发送的值之后，对channel 的任何操作会立即被执行，并且产生零值。我们将代表取消操作的 channel 作为 select 的一个分支，一个立刻返回的分支；通过关闭 channel 让所有操作该 channel 的代码都可以立马执行，从而 select 会选择退出分支，让 goroutine 立刻终止。通过 channel 的取消操作，我们实现了一种广播机制。下面是一个简单的代码示例:


```Go
# 广播机制
var done = make(chan struct{})
func cancelled() bool {
	select {
		case <‐done:          // channel 被关闭后，立马就会执行
			return true
		default:
			return false
	}
}

# 监听用户的取消操作
go func() {
	os.Stdin.Read(make([]byte, 1)) // read a single byte
	close(done)                    // 通过关闭 channel，进行消息广播
}()


func walkDir(dir string, n *sync.WaitGroup, fileSizes chan<‐ int64) {
	defer n.Done()
	if cancelled() {              // 发现用户取消，立刻终止
		return
	}
	for _, entry := range dirents(dir) {
	// ...
	}
}
```

## 6. 使用示例
接下来，我们将探究一个生成缩略图的问题来作为 goroutine 和 channel 的使用示例。下面是一个顺序执行的版本。

```Go
// makeThumbnails makes thumbnails of the specified files.
func makeThumbnails(filenames []string) {
	for _, f := range filenames {
		# 缩略图执行的函数，具体代码省略
		if _, err := thumbnail.ImageFile(f); err != nil {
			log.Println(err)
		}
	}
}
```

显然，我们可以使用并发来加快程序的执行速度。

```Go
// NOTE: incorrect!
func makeThumbnails2(filenames []string) {
	for _, f := range filenames {
		go thumbnail.ImageFile(f) // NOTE: ignoring errors
	}
}
```

然而上面面的程序是有问题的，makeThumbnails(下称主函数)在 go 创建的 goroutine(下称 work goroutine) 还没有完成工作之前就已经返回了。我们需要主函数等待 work goroutine 完成。我们可以使用 channel 进行同步。

```Go
func makeThumbnails4(filenames []string) error {
	errors := make(chan error)
	for _, f := range filenames {
		go func(f string) {
			_, err := thumbnail.ImageFile(f)
			errors <‐ err
		}(f)
	} 
	for range filenames {
		if err := <‐errors; err != nil {
		return err // NOTE: incorrect: goroutine leak!
		}
	} 
	return nil
}
```

这个程序有一个微秒的bug。当它遇到第一个非nil的error时会直接将error返回到调用方，使得没有一个goroutine去排空errors channel。这样剩下的worker goroutine在向这个channel中发送值时，都会永远地阻塞下去，并且永远都不会退出。即出现goroutine泄露，可能会导致整个程序卡住或者跑出out of memory的错误。

最简单的解决办法就是用一个具有合适大小的buffered channel(`c
h := make(chan item, len(filenames))`)，这样这些worker goroutine向channel中发送错误时就不会被阻塞。另一个可选的解决办法是创建一个另外的goroutine，当maingoroutine返回第一个错误的同时去排空channel。

此外，如果文件过多，程序可能会创建成百上千的 goroutine，我们需要用计数信号量来限制并发的数量。

```Go
// 限制并发数的信号量
var sema = make(chan struct{}, 20)

go func(f string) {
	sema <‐ struct{}{}        // 执行前获取 token
	defer func() { <‐sema }() // 执行结束后释放 token
	
	_, err := thumbnail.ImageFile(f)
	errors <‐ err
}(f)
```


## 7. 使用局限
至此，我们已经掌握了goroutine 和 channel的基本使用，但是还远远不够。我们无法解决像下面这些问题:
1. 
