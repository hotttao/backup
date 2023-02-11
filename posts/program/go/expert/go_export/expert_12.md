---
weight: 1
title: "Delve 调试Go代码"
date: 2023-01-04T22:00:00+08:00
lastmod: 2023-01-04T22:00:00+08:00
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

## 1. 专业调试工具
bug是表象，要发现内部原因需要利用更多的表象数据去推理，需要收集足够多的“现场数据”。我们可以通过编程语言内置的输出语句（如Go的print、fmt.Printf等）输出我们需要的信息，而更为专业的方法是通过编程语言提供的专业调试工具（如GDB）设置断点来采集现场数据或重现bug。

尽管使用 print 输出调试信息更加简单快捷、灵活直观且无须对外部有任何依赖。但专业调试器可以运用在“print辅助调试”无法胜任的场景下，比如：
1. 与IDE集成，通过图形化操作可大幅简化专业调试器的调试循环，提供更佳的体验；
2. 事后调查（postmortem）
3. 调试core dump文件；
4. 在生产环境通过挂接（attach）应用进程，深入应用进程内部进行调试。

语言内置的print语句辅助调试与采用专门的调试器调试代码是相辅相成的，并非对立关系。

### 1.1 gccgo
Go发行版中，除了标准的Go编译器之外，还有一个名为gccgo的编译器。和标准Go编译器相比，gccgo具有如下特点：
1. gccgo是GCC编译器的新前端；
2. Go语言由[Go语言规范](https://tip.golang.org/ref/spec)定义和驱动演进，gccgo是另一个实现了该语言规范的编译器，但与标准Go编译器实现的侧重点有所不同；
3. gccgo编译速度较慢，但具有更为强大的优化能力；
4. gccgo复用了GCC后端，因此支持的处理器架构更多；
5. gccgo的演进速度与标准Go编译器的速度并不一致，按照最新[官方文档](https://tip.golang.org/doc/install/gccgo)，gcc8等价于go 1.10.1的实现，而gcc9等价于Go 1.12.2的实现。

通过gccgo编译而成的Go程序可以得到GCC成熟工具链集合的原生支持，包括使用强大的GDB进行调试。但由于gccgo不是主流，因此我们这里考虑的是基于标准Go编译器编译的代码的调试。

那么GDB调试器是否可以调试通过标准Go编译器编译生成的Go程序呢？答案是肯定的。但GDB对标准Go编译器输出的程序的支持是不完善的，主要体现在GDB并不十分了解Go程序：
1. Go的栈管理、线程模型、运行时等与GDB所了解的执行模型有很大不同，这会导致GDB在调试过程中输出错误的结果，尤其是针对拥有大量并发的Go程序时，GDB并不是一个可靠的调试器；
2. 使用复杂，需加载插件（$GOROOT/src/runtime/runtime-gdb.py）才能更好地理解Go符号；
3. GDB无法理解一些Go类型信息、名称限定等，导致输出的栈信息和打印的变量类型信息难于识别、查看和分析；
4. Go 1.11后，编译后的可执行文件中调试信息默认是压缩的，低版本的GDB无法加载这些压缩的调试信息，除非显式使用`go build -ldflags=-compressdwarf=false` 设置不执行调试信息压缩。

综上，GDB显然也不是Go调试工具的最佳选择，虽然其适用于调试带有cgo代码的Go程序或事后调查调试。

### 1.2 Delve

[Delve](https://github.com/go-delve/delve)是另一个Go语言调试器，旨在为Go提供一个简单、功能齐全、易用使用和调用的调试工具。它紧跟Go语言版本演进，是目前Go调试器的事实标准。和GDB相比，Delve的优势在于
1. 它可以更好地理解Go的一切，对并发程序有着很好的支持
2. 支持跨平台（支持Windows、macOS、Linux三大主流平台）
3. 前后端分离的设计使得它可以非常容易地被集成到各种IDE（如GoLand）、编译器插件（vscode go、vim-go等）、图形化调试器前端（如gdlv）中

接下来，我们就来看看如何使用Delve调试Go程序。

## 2. Delve 
### 2.1 Delve 使用
下面是一个使用  Delve 调试本地程序的示例:

```go
// 1. 安装
$go get github.com/go-delve/delve/cmd/dlv
$dlv version
Delve Debugger
Version: 1.4.1
Build: $Id: bda606147ff48b58bde39e20b9e11378eaa4db4

// 2. 示例代码结构
// delve-demo1/
$tree .
.
├── cmd
│   └── delve-demo1
│       └── main.go
├── go.mod
└── pkg
    └── foo
        └── foo.go

// 3. 开始调试
$cd delve-demo1

// 执行dlv后，dlv会对被调试Go包进行编译并在当前工作目录下生成一个临时的二进制文件用于调试
$dlv debug github.com/bigwhite/delve-demo1/cmd/delve-demo1

// 3.1 查看代码
(dlv) list main.go:12
(dlv) list foo.Foo

// 3.2 设置/查看断点
(dlv) b main.go:12       // 设置匿名断点
(dlv) b b1 main.go:13    // 设置具名断点
(dlv) bp                 // breakpoints命令（简写为bp）可以查看已设置的断点列表
(dlv) clear b1           // 删除具名断点
(dlv) clear 2            // 删除匿名断点

(dlv) b b1 main.go:12
Breakpoint b1 set at 0x4967aa for main.main() ./main.go:12
(dlv) bp
Breakpoint runtime-fatal-throw (enabled) at 0x434cc0 for runtime.throw() /usr/local/go/src/runtime/panic.go:982 (0)
Breakpoint unrecovered-panic (enabled) at 0x435080 for runtime.fatalpanic() /usr/local/go/src/runtime/panic.go:1065 (0)
	print runtime.curg._panic.arg
Breakpoint b1 (enabled) at 0x4967aa for main.main() ./main.go:12 (0)  // b1 设置的名称
(dlv) clear b1
Breakpoint b1 cleared at 0x4967aa for main.main() ./main.go:12
(dlv) b main.go:12
Breakpoint 2 set at 0x4967aa for main.main() ./main.go:12
(dlv) bp
Breakpoint runtime-fatal-throw (enabled) at 0x434cc0 for runtime.throw() /usr/local/go/src/runtime/panic.go:982 (0)
Breakpoint unrecovered-panic (enabled) at 0x435080 for runtime.fatalpanic() /usr/local/go/src/runtime/panic.go:1065 (0)
	print runtime.curg._panic.arg
Breakpoint 2 (enabled) at 0x4967aa for main.main() ./main.go:12 (0)   // 2 是匿名的断点序号
(dlv) clear 2
Breakpoint 2 cleared at 0x4967aa for main.main() ./main.go:12

// 3.3 条件断点
// 条件断点，指的就是当满足某个条件时，被调试的目标程序才会在该断点处暂停
(dlv) b b2 foo.go:6
(dlv) cond b2 sum > 10

// 3.4 执行和调试
(dlv) bp
Breakpoint runtime-fatal-throw (enabled) at 0x434cc0 for runtime.throw() /usr/local/go/src/runtime/panic.go:982 (0)
Breakpoint unrecovered-panic (enabled) at 0x435080 for runtime.fatalpanic() /usr/local/go/src/runtime/panic.go:1065 (0)
	print runtime.curg._panic.arg
Breakpoint 1 (enabled) at 0x4967aa for main.main() ./main.go:12 (0)
Breakpoint b2 (enabled) at 0x496749 for github.com/bigwhite/delve-demo1/pkg/foo.Foo() /home/tao/code/github/GoProgrammingFromBeginnerToMaster/chapter8/sources/delve-demo1/pkg/foo/foo.go:6 (0)
	cond sum > 10

(dlv) c                // continue命令（简写 c）执行程序，程序会在下一个断点处停下来，没有断点，程序运行到结束
> main.main() ./main.go:12 (hits goroutine(1):1 total:1) (PC: 0x4967aa)
     7:	)
     8:	
     9:	func main() {
    10:		a := 3
    11:		b := 10
=>  12:		c := foo.Foo(a, b)
    13:		fmt.Println(c)
    14:	}
(dlv) s               // step 命令（简写 s）单步调试，如果断点处有函数调用，step命令会进入断点所在行调用的函数
> github.com/bigwhite/delve-demo1/pkg/foo.Foo() /home/tao/code/github/GoProgrammingFromBeginnerToMaster/chapter8/sources/delve-demo1/pkg/foo/foo.go:3 (PC: 0x496700)
     1:	package foo
     2:	
=>   3:	func Foo(step, count int) int {
     4:		sum := 0
     5:		for i := 0; i < count; i++ {
     6:			sum += step
     7:		}
     8:		return sum
(dlv) n               // next 命令（简写 n）单步调试，让程序执行到下一行代码              
> github.com/bigwhite/delve-demo1/pkg/foo.Foo() /home/tao/code/github/GoProgrammingFromBeginnerToMaster/chapter8/sources/delve-demo1/pkg/foo/foo.go:4 (PC: 0x496720)
     1:	package foo
     2:	
     3:	func Foo(step, count int) int {
=>   4:		sum := 0
     5:		for i := 0; i < count; i++ {
     6:			sum += step
     7:		}
     8:		return sum
     9:	}
(dlv) r              // restart 命令（简写 r），重启程序
Process restarted with PID 43945

// 3.5 查看变量值
(dlv) c
> [b2] github.com/bigwhite/delve-demo1/pkg/foo.Foo() /home/tao/code/github/GoProgrammingFromBeginnerToMaster/chapter8/sources/delve-demo1/pkg/foo/foo.go:6 (hits goroutine(1):1 total:1) (PC: 0x496749)
     1:	package foo
     2:	
     3:	func Foo(step, count int) int {
     4:		sum := 0
     5:		for i := 0; i < count; i++ {
=>   6:			sum += step
     7:		}
     8:		return sum
     9:	}
(dlv) args                       // 当前函数栈参数和返回值列表（包括参数和返回值的值）
step = 3
count = 10
~r0 = 0
(dlv) locals                     // 当前函数栈本地变量列表（包括变量的值）
sum = 12
i = 4
(dlv) regs                       // 当前寄存器中的值
    Rip = 0x0000000000496749
    Rsp = 0x000000c000051ee0
    Rax = 0x0000000000000003
    Rbx = 0x000000000000000a
    Rcx = 0x0000000000000004
    Rdx = 0x00000000004b4f68
    Rsi = 0x0000000000000000
    Rdi = 0x00000000ffffffff
    Rbp = 0x000000c000051ef8
     R8 = 0x0000000000000010
     R9 = 0x0000000000000000
    R10 = 0x0000000000000008
    R11 = 0x0000000000000000
    R12 = 0x000000c000051b30
    R13 = 0x0000000000000000
    R14 = 0x000000c0000021a0
    R15 = 0x0000000000000058
 Rflags = 0x0000000000000206	[PF IF IOPL=0]
     Es = 0x0000000000000000
     Cs = 0x0000000000000033
     Ss = 0x000000000000002b
     Ds = 0x0000000000000000
     Fs = 0x0000000000000000
     Gs = 0x0000000000000000
Fs_base = 0x0000000000529a70
Gs_base = 0x0000000000000000

(dlv) whatis i                    // 输出后面的表达式的类型。
int
(dlv) p i                         // print（简写为p）：输出源码中变量的值
4

(dlv) x 0x10c2431                 // examinemem（简写为x）：查看某一内存地址上的值
Command failed: input/output error

// 3.6 查看函数调用栈
(dlv) bt                          // stack命令（简写为bt）输出函数调用栈信息
0  0x0000000000496749 in github.com/bigwhite/delve-demo1/pkg/foo.Foo
   at /home/tao/code/github/GoProgrammingFromBeginnerToMaster/chapter8/sources/delve-demo1/pkg/foo/foo.go:6
1  0x00000000004967b9 in main.main
   at ./main.go:12
2  0x00000000004373b8 in runtime.main
   at /usr/local/go/src/runtime/proc.go:250
3  0x0000000000461501 in runtime.goexit
   at /usr/local/go/src/runtime/asm_amd64.s:1571

(dlv) up                          // up和down命令，可以在函数调用栈的栈帧间进行跳转

> [b2] github.com/bigwhite/delve-demo1/pkg/foo.Foo() /home/tao/code/github/GoProgrammingFromBeginnerToMaster/chapter8/sources/delve-demo1/pkg/foo/foo.go:6 (hits goroutine(1):1 total:1) (PC: 0x496749)
Frame 1: ./main.go:12 (PC: 4967b9)
     7:	)
     8:	
     9:	func main() {
    10:		a := 3
    11:		b := 10
=>  12:		c := foo.Foo(a, b)
    13:		fmt.Println(c)
    14:	}
(dlv) up
> [b2] github.com/bigwhite/delve-demo1/pkg/foo.Foo() /home/tao/code/github/GoProgrammingFromBeginnerToMaster/chapter8/sources/delve-demo1/pkg/foo/foo.go:6 (hits goroutine(1):1 total:1) (PC: 0x496749)
Frame 2: /usr/local/go/src/runtime/proc.go:250 (PC: 4373b8)
   245:			// A program compiled with -buildmode=c-archive or c-shared
   246:			// has a main, but it is not executed.
   247:			return
   248:		}
   249:		fn := main_main // make an indirect call, as the linker doesn't know the address of the main package when laying down the runtime
=> 250:		fn()
   251:		if raceenabled {
   252:			racefini()
   253:		}
   254:	
   255:		// Make racy client program work: if panicking on
(dlv) up
> [b2] github.com/bigwhite/delve-demo1/pkg/foo.Foo() /home/tao/code/github/GoProgrammingFromBeginnerToMaster/chapter8/sources/delve-demo1/pkg/foo/foo.go:6 (hits goroutine(1):1 total:1) (PC: 0x496749)
Frame 3: /usr/local/go/src/runtime/asm_amd64.s:1571 (PC: 461501)
  1566:		RET
  1567:	
  1568:	// The top-most function running on a goroutine
  1569:	// returns to goexit+PCQuantum.
  1570:	TEXT runtime·goexit(SB),NOSPLIT|TOPFRAME,$0-0
=>1571:		BYTE	$0x90	// NOP
  1572:		CALL	runtime·goexit1(SB)	// does not return
  1573:		// traceback from goexit1 must hit code range of goexit
  1574:		BYTE	$0x90	// NOP
  1575:	
  1576:	// This is called from .init_array and follows the platform, not Go, ABI.
(dlv) down
> [b2] github.com/bigwhite/delve-demo1/pkg/foo.Foo() /home/tao/code/github/GoProgrammingFromBeginnerToMaster/chapter8/sources/delve-demo1/pkg/foo/foo.go:6 (hits goroutine(1):1 total:1) (PC: 0x496749)
Frame 2: /usr/local/go/src/runtime/proc.go:250 (PC: 4373b8)
   245:			// A program compiled with -buildmode=c-archive or c-shared
   246:			// has a main, but it is not executed.
   247:			return
   248:		}
   249:		fn := main_main // make an indirect call, as the linker doesn't know the address of the main package when laying down the runtime
=> 250:		fn()
   251:		if raceenabled {
   252:			racefini()
   253:		}
   254:	
   255:		// Make racy client program work: if panicking on
(dlv) down
> [b2] github.com/bigwhite/delve-demo1/pkg/foo.Foo() /home/tao/code/github/GoProgrammingFromBeginnerToMaster/chapter8/sources/delve-demo1/pkg/foo/foo.go:6 (hits goroutine(1):1 total:1) (PC: 0x496749)
Frame 1: ./main.go:12 (PC: 4967b9)
     7:	)
     8:	
     9:	func main() {
    10:		a := 3
    11:		b := 10
=>  12:		c := foo.Foo(a, b)
    13:		fmt.Println(c)
    14:	}

// 3.7 修改变量的值，并手工调用函数（试验功能）
(dlv) clearall
Breakpoint 1 cleared at 0x4967aa for main.main() ./main.go:12
Breakpoint b2 cleared at 0x496749 for github.com/bigwhite/delve-demo1/pkg/foo.Foo() /home/tao/code/github/GoProgrammingFromBeginnerToMaster/chapter8/sources/delve-demo1/pkg/foo/foo.go:6
(dlv) b b1 main.go:12
Breakpoint b1 set at 0x4967aa for main.main() ./main.go:12
(dlv) r
Process restarted with PID 44312

(dlv) c
> [b1] main.main() ./main.go:12 (hits goroutine(1):1 total:1) (PC: 0x4967aa)
     7:	)
     8:	
     9:	func main() {
    10:		a := 3
    11:		b := 10
=>  12:		c := foo.Foo(a, b)
    13:		fmt.Println(c)
    14:	}
(dlv) set a = 4
(dlv) p a
4
(dlv) call foo.Foo(a,b)
> main.main() ./main.go:12 (PC: 0x4967aa)
// 在手工重新设置a = 40后，再手工调用call命令执行foo.Foo(a, b)后的结果为40。
Values returned:
	~r0: 40

     7:	)
     8:	
     9:	func main() {
    10:		a := 3
    11:		b := 10
=>  12:		c := foo.Foo(a, b)
    13:		fmt.Println(c)
    14:	}

```
### 2.2 Delve 启动方式
Delve 启动方式有多种:

```bash
# 第一种: 就是上面使用的，调试包
$cd delve-demo1
$dlv debug github.com/bigwhite/delve-demo1/cmd/delve-demo1

# 第二种: 直接调试源码文件的方式启动调试流程，这样的方式与调试包是等价的：
$dlv debug cmd/delve-demo1/main.go

# 第三种: 通过exec子命令直接调试已经构建完的Go二进制程序文件，比如：
$go build github.com/bigwhite/delve-demo1/cmd/delve-demo1
$dlv exec ./delve-demo1
```

#### 直接调试二进制文件的潜在问题
在直接调试二进制文件时，Delve会根据二进制文件中保存的源文件位置到对应的路径下寻找对应的源文件并展示对应源码。如果把那个路径下的源文件挪走，那么再通过list命令展示源码就会出现错误：

```go
$go build github.com/bigwhite/delve-demo1/cmd/delve-demo1
$dlv exec ./delve-demo1
(dlv) list main.go:12
Showing chapter8/sources/delve-demo1/cmd/delve-demo1/main.go:12 (PC: 0x109ced1)
Command failed: open chapter8/sources/delve-demo1/cmd/delve-demo1/main.go: no such file or directory
```

某些时候，通过 Delve 直接调试构建后的二进制文件可能会出现如下错误（下面仅是模拟示例）：
```go
(dlv) break main.go:12
Command failed: could not find statement at chapter8/sources/delve-demo1/cmd/delve-demo1/main.go:12, please use a line with a statement
```

main.go的第12行明明是一个函数调用，但Delve就是提示这行没有Go语句。出现这个问题的原因很可能是Go编译器对目标代码做了优化，比如将foo.Foo内联掉了。为了避免这样的问题，我们可以在编译的时候加入关闭优化的标志位，这样Delve就不会因目标代码优化而报出错误的信息了。

```go
$go build -gcflags=all="-N -l" github.com/bigwhite/delve-demo1/cmd/delve-demo1
```

### 2.3 Delve 架构和原理
为了便于各种调试器前端（命令行、IDE、编辑器插件、图形化前端）与Delve集成，Delve采用了一个前后分离的架构:

![delve 架构](/images/go/expert/delve_frame.png)

UI Layer对应的就是我们使用的dlv命令行或Goland/vim-go中的调试器前端，而Service Layer显然用于前后端通信。Delve真正施展的“魔法”是由Symbolic Layer和Target Layer两层合作实现的。

Target Layer通过各个操作系统提供的系统API来控制被调试目标进程，它对被调试目标的源码没有任何了解，实现的功能包括：
1. 挂接（attach）/分离（detach）目标进程；
2. 枚举目标进程中的线程；
3. 启动/停止单个线程（或整个进程）；
4. 接收和处理“调试事件”（线程创建/退出以及线程在断点处暂停）；
5. 读写目标进程的内存；
6. 读写停止线程的CPU寄存器；
7. 读取core dump文件。

真正了解被调试目标源码文件的是Symbolic Layer，这一层通过读取Go编译器（包括链接器）以DWARF格式（一种标准的调试信息格式）写入目标二进制文件中的**调试符号信息**来了解被调试目标源码，并实现了被调试目标进程中的**地址**、二进制文件中的**调试符号**及**源码**相关信息三者之间的关系映射，如下图所示。

![Delve Symbolic层原理](/images/go/expert/delve_link.png)

## 3. 并发、Coredump文件与挂接进程调试
### 3.1 Delve 调试并发程序
下面是一个调试并发程序的例子:

```go
// delve-demo2的目录结构
$tree .
.
├── cmd
│    └── delve-demo2
│        └── main.go
├── go.mod
└── pkg
    ├── bar
    │    └── bar.go
    └── foo
        └── foo.go
// 1. 调试并发程序
$ dlv debug cmd/delve-demo2/main.go
(dlv) list main.go:19
Showing /home/tao/code/github/GoProgrammingFromBeginnerToMaster/chapter8/sources/delve-demo2/cmd/delve-demo2/main.go:19 (PC: 0x4970b7)
    14:		wg.Add(1)
    15:		go func() {
    16:			for {
    17:				d := 2
    18:				e := 20
    19:				f := bar.Bar(d, e)
    20:				fmt.Println(f)
    21:				time.Sleep(2 * time.Second)
    22:			}
    23:			wg.Done()
    24:		}()

(dlv) b b1 main.go:19
Breakpoint b1 set at 0x4970b7 for main.main.func1() ./cmd/delve-demo2/main.go:19
(dlv) c
// main goroutine输出了foo.Foo调用的返回结果30，然后调试程序在main.go的第19行停了下来
30
> [b1] main.main.func1() ./cmd/delve-demo2/main.go:19 (hits goroutine(34):1 total:1) (PC: 0x4970b7)
    14:		wg.Add(1)
    15:		go func() {
    16:			for {
    17:				d := 2
    18:				e := 20
=>  19:				f := bar.Bar(d, e)
    20:				fmt.Println(f)
    21:				time.Sleep(2 * time.Second)
    22:			}
    23:			wg.Done()
    24:		}()

// 2. 查看 goroutine
(dlv) goroutine                                // 打印当前 goroutine 信息
Thread 45702 at ./cmd/delve-demo2/main.go:19
Goroutine 34:
	Runtime: ./cmd/delve-demo2/main.go:19 main.main.func1 (0x4970b7)
	User: ./cmd/delve-demo2/main.go:19 main.main.func1 (0x4970b7)
	Go: ./cmd/delve-demo2/main.go:15 main.main (0x496f46)
	Start: ./cmd/delve-demo2/main.go:15 main.main.func1 (0x497080)

(dlv) goroutines                              // 查看当前程序内的goroutine列表
  Goroutine 1 - User: /usr/local/go/src/runtime/sema.go:56 sync.runtime_Semacquire (0x45e225) [semacquire]
  Goroutine 2 - User: /usr/local/go/src/runtime/proc.go:362 runtime.gopark (0x4377d2) [force gc (idle)]
  Goroutine 17 - User: /usr/local/go/src/runtime/proc.go:362 runtime.gopark (0x4377d2) [GC sweep wait]
  Goroutine 18 - User: /usr/local/go/src/runtime/proc.go:362 runtime.gopark (0x4377d2) [GC scavenge wait]
  Goroutine 33 - User: /usr/local/go/src/runtime/proc.go:362 runtime.gopark (0x4377d2) [finalizer wait]
// 星号 表示当前终端所在的 goroutine
* Goroutine 34 - User: ./cmd/delve-demo2/main.go:19 main.main.func1 (0x4970b7) (thread 45702)
[6 goroutines]
(dlv) list
> [b1] main.main.func1() ./cmd/delve-demo2/main.go:19 (hits goroutine(34):1 total:1) (PC: 0x4970b7)
    14:		wg.Add(1)
    15:		go func() {
    16:			for {
    17:				d := 2
    18:				e := 20
=>  19:				f := bar.Bar(d, e)
    20:				fmt.Println(f)
    21:				time.Sleep(2 * time.Second)
    22:			}
    23:			wg.Done()
    24:		}()
(dlv) n
> main.main.func1() ./cmd/delve-demo2/main.go:20 (PC: 0x4970cb)
    15:		go func() {
    16:			for {
    17:				d := 2
    18:				e := 20
    19:				f := bar.Bar(d, e)
=>  20:				fmt.Println(f)
    21:				time.Sleep(2 * time.Second)
    22:			}
    23:			wg.Done()
    24:		}()
    25:		a := 3
(dlv) p f
1048576
(dlv) goroutine 1                         // 切换到其他goroutine中
Switched from 34 to 1 (thread 45702)
(dlv) bt
0  0x00000000004377d2 in runtime.gopark
   at /usr/local/go/src/runtime/proc.go:362
1  0x000000000043786a in runtime.goparkunlock
   at /usr/local/go/src/runtime/proc.go:367
2  0x0000000000446392 in runtime.semacquire1
   at /usr/local/go/src/runtime/sema.go:144
3  0x000000000045e225 in sync.runtime_Semacquire
   at /usr/local/go/src/runtime/sema.go:56
4  0x00000000004754fc in sync.(*WaitGroup).Wait
   at /usr/local/go/src/sync/waitgroup.go:136
5  0x0000000000496ff9 in main.main
   at ./cmd/delve-demo2/main.go:29
6  0x00000000004373b8 in runtime.main
   at /usr/local/go/src/runtime/proc.go:250
7  0x00000000004617a1 in runtime.goexit
   at /usr/local/go/src/runtime/asm_amd64.s:1571
(dlv) threads                             // thread和threads命令，查看当前启动的线程列表并在各个线程间切换
* Thread 45702 at 0x4970cb ./cmd/delve-demo2/main.go:20 main.main.func1
  Thread 45708 at 0x46305d /usr/local/go/src/runtime/sys_linux_amd64.s:149 runtime.usleep
  Thread 45709 at 0x463643 /usr/local/go/src/runtime/sys_linux_amd64.s:553 runtime.futex
  Thread 45710 at 0x463643 /usr/local/go/src/runtime/sys_linux_amd64.s:553 runtime.futex
  Thread 45711 at 0x463643 /usr/local/go/src/runtime/sys_linux_amd64.s:553 runtime.futex
  Thread 45712 at 0x463643 /usr/local/go/src/runtime/sys_linux_amd64.s:553 runtime.futex
```

### 3.2 Delve调试core dump文件
core dump文件是在程序异常终止或崩溃时操作系统对程序当时的内存状态进行记录并保存而生成的一个数据文件，该文件以core命名，也被称为核心转储文件。通过对操作系统记录的core文件中的数据的分析诊断，开发人员可以快速定位程序中存在的bug，这尤其适用于生产环境中的调试。

根据Delve官方文档的描述，Delve目前支持对linux/amd64、linux/arm64架构下产生的core文件的调试，以及Windows/amd64架构下产生的minidump小转储文件的调试。在这里我们以linux/amd64架构为例，看看如何使用Delve调试core dump文件。

测试的程序如下:

```go
// chapter8/sources/delve-demo3/main.go

func main() {
    var p *int
    *p = 1 // 空指针解引用而崩溃
    fmt.Println("program exit")
}
```

在Linux/amd64下（Ubuntu 18.04，Go 1.14，Delve 1.4.1）进行这次调试。要想在Linux下让Go程序崩溃时产生core文件，我们需要进行一些设置（因为默认情况下Go程序崩溃并不会产生core文件）：

```bash
$ulimit -c unlimited // 不限制core文件大小
$go build main.go
$GOTRACEBACK=crash ./main
panic: runtime error: invalid memory address or nil pointer dereference
[signal SIGSEGV: segmentation violation code=0x1 addr=0x0 pc=0x49142f]
...
 /root/.bin/go1.14/src/runtime/asm_amd64.s:1373 +0x1 fp=0xc0000307e8 sp=0xc0000307e0 pc=0x45b911
created by runtime.createfing
    /root/.bin/go1.14/src/runtime/mfinal.go:156 +0x61
Aborted (core dumped)

$ls -lh
total 103M
-rw------- 1 root root 101M May 28 14:55 core
-rwxr-xr-x 1 root root 2.0M May 28 14:55 main
-rw-r--r-- 1 root root  102 May 28 14:54 main.g0

# 按照上述步骤执行完，发现当前目录下没有核心转储文件，还需要执行下面这一步，设置操作将核心转储文件保存到当前目录下
echo core > /proc/sys/kernel/core_pattern
```

使用dlv core命令对产生的core文件进行调试：

```go
$dlv core ./main ./core
Type 'help' for list of commands.
(dlv) bt
 0  0x000000000045d4a1 in runtime.raise
    at /root/.bin/go1.14/src/runtime/sys_linux_amd64.s:165
 1  0x0000000000442acb in runtime.dieFromSignal
    at /root/.bin/go1.14/src/runtime/signal_unix.go:721
 2  0x0000000000442f5e in runtime.sigfwdgo
    at /root/.bin/go1.14/src/runtime/signal_unix.go:935
 3  0x00000000004419d4 in runtime.sigtrampgo
    at /root/.bin/go1.14/src/runtime/signal_unix.go:404
 4  0x000000000045d803 in runtime.sigtramp
    at /root/.bin/go1.14/src/runtime/sys_linux_amd64.s:389
 5  0x000000000045d8f0 in runtime.sigreturn
    at /root/.bin/go1.14/src/runtime/sys_linux_amd64.s:481
 6  0x0000000000442c5a in runtime.crash
    at /root/.bin/go1.14/src/runtime/signal_unix.go:813
 7  0x000000000042ee54 in runtime.fatalpanic
    at /root/.bin/go1.14/src/runtime/panic.go:1212
 8  0x000000000042e7f0 in runtime.gopanic
    at /root/.bin/go1.14/src/runtime/panic.go:1060
 9  0x00000000004429ea in runtime.panicmem
    at /root/.bin/go1.14/src/runtime/panic.go:212
10  0x00000000004429ea in runtime.sigpanic
    at /root/.bin/go1.14/src/runtime/signal_unix.go:687
11  0x000000000049142f in main.main
    at ./main.go:8
12  0x0000000000431222 in runtime.main
    at /root/.bin/go1.14/src/runtime/proc.go:203
13  0x000000000045b911 in runtime.goexit
    at /root/.bin/go1.14/src/runtime/asm_amd64.s:1373
(dlv)

// 通过stack（简写为bt）命令输出的函数调用栈多为Go运行时的函数，我们唯一熟悉的就是main.main，于是，通过frame命令跳到main.main这个函数栈帧中：
// 如果代码复杂且涉及函数调用较多，我们还可以继续通过up和down在各层函数栈帧中搜寻问题的原因。
(dlv) frame 11
> runtime.raise() /root/.bin/go1.14/src/runtime/sys_linux_amd64.s:165 (PC: 0x45d4a1)
Warning: debugging optimized function
Frame 11: ./main.go:8 (PC: 49142f)
     3:    import "fmt"
     4:
     5:    func main() {
     6:           var p *int
     7:           p = nil
=>   8:           *p = 1
     9:           fmt.Println("program exit")
    10:    }

```

### 3.3 使用Delve挂接到正在运行的进程进行调试
在一些特定的情况下，我们可能需要对正在运行的Go应用进程进行调试。不过这类调试是有较大风险的：**调试器一旦成功挂接到正在运行的进程中，调试器就掌握了进程执行的指挥权，并且正在运行的goroutine都会暂停**，等待调试器的进一步指令。因此，不到万不得已，请不要在生产环境中使用这种调试方法。

使用 **dlv attach** 挂接到进程进行调试的方法如下:

```bash
# 1. 找到正在运行的进程
$ps -ef|grep delve-demo2
  501 75863 63197   0  3:33下午 ttys011    0:00.02 ./delve-demo2
# 2. 挂载到运行中的进程
$dlv attach 75863 ./delve-demo2
# Delve一旦成功切入delve-demo2进程，delve-demo2进程内的所有goroutine都将暂停运行，等待Delve的进一步指令。
(dlv) goroutines
  Goroutine 1 - User: $GOROOT/src/runtime/sema.go:56 sync.runtime_Semacquire (0x103f472)
  Goroutine 2 - User: $GOROOT/src/runtime/proc.go:305 runtime.gopark (0x1030f60)
  Goroutine 3 - User: $GOROOT/src/runtime/proc.go:305 runtime.gopark (0x1030f60)
  Goroutine 4 - User: $GOROOT/src/runtime/proc.go:305 runtime.gopark (0x1030f60)
  Goroutine 17 - User: $GOROOT/src/runtime/proc.go:305 runtime.gopark (0x1030f60)
  Goroutine 18 - User: $GOROOT/src/runtime/time.go:198 time.Sleep (0x104ba7a)
[6 goroutines]
(dlv) b b1 main.go:19
```

## 4. Delve 调试单元测试
