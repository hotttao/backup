---
weight: 1
title: "Go 语言的复合数据类型"
date: 2021-02-01T22:00:00+08:00
lastmod: 2021-02-01T22:00:00+08:00
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

## 1. Go 语言进阶
前面 Go语言入门中我们学习了 Go 语言的基础语法和使用。这个系列我们来到了 Go 语言学习的第二部分-go语言进阶，来看看 Go 的设计与实现。在 go 语言进阶我选择了三个学习资源:
1. [《Go专家编程》](https://book.douban.com/subject/35144587/): 包括 Go 语言内置对象以及一些标准库的设计实现
2. [《Go 语言设计与实现》](https://draveness.me/golang/)：包括 Go 编译原理、运行时
3. [《Go 语言原本》](https://golang.design/under-the-hood/): 包括 Go 运行时以及工具链

从难度上依次由简入深。今天这篇文章我们就从《Go专家编程》开始，介绍 Go 语言内置的复合数据类型: channel、slice、map、struct、iota、string。这些数据结构都在 runtime package 中定义，可以在 Go 代码中直接使用，无须导入。

## 2. channel
channel 的定义和使用，在 go 语言的第四部分-go 并发中有详细的介绍，内容如下:
1. [Channel 使用与实现]({{< ref "posts/program/go/sync/go_sync_13.md" >}})
2. [Channel 应用]({{< ref "posts/program/go/sync/go_sync_14.md" >}})

虽然后面有更详细的介绍，但这里不妨我们对它有个基本的认识。

### 2.1 hchan 数据结构
channel 定义在源码包 src/runtime/chan.go 中，对应类型为 *hchan，由 makechan 函数创建。hchan 结构如下，其中比较难理解的是 `elementype *_type`，这个跟 Go 类型系统的实现有关，我们暂时放一放。

```go
type hchan struct {
	qcount   uint           // total data in the queue
	dataqsiz uint           // size of the circular queue
	buf      unsafe.Pointer // points to an array of dataqsiz elements
	elemsize uint16
	closed   uint32
	elemtype *_type // element type
	sendx    uint   // send index
	recvx    uint   // receive index
	recvq    waitq  // list of recv waiters
	sendq    waitq  // list of send waiters

	// lock protects all fields in hchan, as well as several
	// fields in sudogs blocked on this channel.
	//
	// Do not change another G's status while holding this lock
	// (in particular, do not ready a G), as this can deadlock
	// with stack shrinking.
	lock mutex
}

type _type struct {
	size       uintptr
	ptrdata    uintptr // size of memory prefix holding all pointers
	hash       uint32
	tflag      tflag
	align      uint8
	fieldAlign uint8
	kind       uint8
	// function for comparing objects of this type
	// (ptr to object A, ptr to object B) -> ==?
	equal func(unsafe.Pointer, unsafe.Pointer) bool
	// gcdata stores the GC type data for the garbage collector.
	// If the KindGCProg bit is set in kind, gcdata is a GC program.
	// Otherwise it is a ptrmask bitmap. See mbitmap.go for details.
	gcdata    *byte
	str       nameOff
	ptrToThis typeOff
}

type nameOff int32
type typeOff int32
type tflag uint8
```

hchan 的结构成员分成了如下几类
1. 环形队列:
	- dataqsiz: 队列的长度
	- buf: 队列的内存
	- qcount: 队列中元素个数
	- sendx: 插入数据的位置索引
	- recvx: 读取数据的位置索引
2. 等待队列:
	- recvq: 读取等待队列
	- sendq: 发送等待队列
3. 类型信息: 一个管道只能发送一种类型的值
	- elemtype: 元素类型
	- elemsize: 元素类型大小
4. 互斥锁: lock

### 2.2 channel 创建
hchan 由 makechan 函数创建，函数如下:

```go
type chantype struct {
	typ  _type
	elem *_type
	dir  uintptr
}

func makechan(t *chantype, size int) *hchan {
	elem := t.elem

	// compiler checks this but be safe.
	if elem.size >= 1<<16 {
		throw("makechan: invalid channel element type")
	}
	if hchanSize%maxAlign != 0 || elem.align > maxAlign {
		throw("makechan: bad alignment")
	}

	mem, overflow := math.MulUintptr(elem.size, uintptr(size))
	if overflow || mem > maxAlloc-hchanSize || size < 0 {
		panic(plainError("makechan: size out of range"))
	}

	// Hchan does not contain pointers interesting for GC when elements stored in buf do not contain pointers.
	// buf points into the same allocation, elemtype is persistent.
	// SudoG's are referenced from their owning thread so they can't be collected.
	// TODO(dvyukov,rlh): Rethink when collector can move allocated objects.
	var c *hchan
	switch {
	case mem == 0:
		// Queue or element size is zero.
		c = (*hchan)(mallocgc(hchanSize, nil, true))
		// Race detector uses this location for synchronization.
		c.buf = c.raceaddr()
	case elem.ptrdata == 0:
		// Elements do not contain pointers.
		// Allocate hchan and buf in one call.
		c = (*hchan)(mallocgc(hchanSize+mem, nil, true))
		c.buf = add(unsafe.Pointer(c), hchanSize)
	default:
		// Elements contain pointers.
		c = new(hchan)
		c.buf = mallocgc(mem, elem, true)
	}

	c.elemsize = uint16(elem.size)
	c.elemtype = elem
	c.dataqsiz = uint(size)
	lockInit(&c.lock, lockRankHchan)

	if debugChan {
		print("makechan: chan=", c, "; elemsize=", elem.size, "; dataqsiz=", size, "\n")
	}
	return c
}
```

### 2.3 channel 的使用
向 channel 收发数据是否会阻塞，与我们理解的环形队列的使用基本无异，只不过里面包含了一些小技巧:
1. 首先环形队列没有空间时，发送数据会阻塞
2. 同样环形队列中没有数据时，读取数据会阻塞
3. 技巧一，当接收队列 recvq 不为空时，说明缓冲区肯定没有数据但有协程在等待，所以会把写入的数据直接传递给 recvq 中的第一个协程，而不必写入 buf
4. 于技巧一类似，当 sendq 不为空时，会直接将 sendq 中第一个协程的数据发送给读取的协程

### 2.4 channel的关闭
关闭管道时，recvq/sendq 中的协程会全部唤醒，但是行为不同:
1. recvq 中的协程会获取对应类型的零值
2. sendq 中的协程会触发异常，所以 **channel 只能发送方关闭**，发送方可以确保没有协程阻塞在 sendq

除此之外下面的 channel 操作也会触发 panic:
1. 关闭值为 nil 的管道
2. 关闭已经被关闭的管道
3. 向已经关闭的管道写入数据 

## 3. slice
slice 动态数组，可以自动对数组进行扩缩容。