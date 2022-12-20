---
weight: 1
title: "Go 包"
date: 2022-12-17T22:00:00+08:00
lastmod: 2022-12-17T22:00:00+08:00
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

今天我们开始深入学习，Go 语言的包，包括包的构建和导入过程。
<!-- more -->

## 1. Go程序构建过程
在介绍 Go 包相关的知识之前，我们先来简单了解一下Go程序的构建过程。

首先我们先简单总结一下，Go 包组织上的特点，这也是 Go 编译速度快的原因:
1. Go要求每个源文件在开头处显式地列出所有依赖的包导入，这样Go编译器不必读取和处理整个文件就可以确定其依赖的包列表。
2. Go要求包之间不能存在循环依赖，这样一个包的依赖关系便形成了一张有向无环图。由于无环，包可以被单独编译，也可以并行编译。
3. 已编译的Go包对应的目标文件（file_name.o或package_name.a）中不仅记录了该包本身的导出符号信息，还记录了其所依赖包的导出符号信息。这样，Go编译器在编译某包P时，针对P依赖的每个包导入（比如导入包Q），只需读取一个目标文件即可（比如：Q包编译成的目标文件中已经包含Q包的依赖包的导出信息），而无须再读取其他文件中的信息。


## 2. 包导入
```go
package main

import (
    "fmt"    // 标准库包导入
    "a/b/c"  // 第三方包导入
)

func main() {
    c.Func1()
    fmt.Println("Hello, Go!")
}
```
go 语言中包定义和导入都很简单。但是我相信不止我一个一开始不理解 import 后面路径中的最后一个分段到底代表的是什么？是包名还是一个路径？今天我们就来学习包导入和构建的知识。

### 2.1 包的搜索路径空间
编译器要找到依赖包的源码文件，就需要知道依赖包的源码路径。这个路径由两部分组成：基础搜索路径和包导入路径。

基础搜索路径是一个全局的设置，下面是其规则描述。
1. 所有包（无论是标准库包还是第三方包）的源码基础搜索路径都包括$GOROOT/src。
2. 在上述基础搜索路径的基础上，不同版本的Go包含的其他基础搜索路径有不同。
  - Go 1.11版本之前，包的源码基础搜索路径还包括$GOPATH/src。
  - Go 1.11～Go 1.12版本，包的源码基础搜索路径有三种模式： 
    - 经典gopath模式下（GO111MODULE=off）：$GOPATH/src。
    - module-aware模式下（GO111MODULE=on）：$GOPATH/pkg/mod。
    - auto模式下（GO111MODULE=auto）：在$GOPATH/src路径下，与gopath模式相同；在$GOPATH/src路径外且包含go.mod，与module-aware模式相同。
  - Go 1.13版本，包的源码基础搜索路径有两种模式： 
    - 经典gopath模式下（GO111MODULE=off）：$GOPATH/src。
    - module-aware模式下（GO111MODULE=on/auto）：$GOPATH/pkg/mod。
  - 未来的Go版本将只有module-aware模式，即只在module缓存的目录下搜索包的源码。

搜索路径的第二部分就是位于每个包源码文件头部的包导入路径。基础搜索路径与包导入路径结合在一起，Go编译器便可确定一个包的所有依赖包的源码路径的集合，这个集合构成了Go编译器的源码搜索路径空间。

Go 的包导入支持相对路径，比如下面的包导入路径`./e/f/g`是一个本地相对路径，它的基础搜索路径是$CWD，即执行编译命令时的当前工作目录。Go编译器在编译源码时会使用-D选项设置当前工作目录，该工作目录与“./e/f/g”的本地相对路径结合，便构成了一个源码搜索路径。

```go
import (
    "./e/f/g"
)

```

到这里，我们可以确定：源文件头部的包导入语句import后面的部分就是一个路径，路径的最后一个分段也不是包名。不过Go语言有一个惯用法，那就是包导入路径的最后一段目录名最好与包名一致，当包名与包导入路径中的最后一个目录名不同时，最好用下面的语法将包名显式放入包导入语句。

```go
package main

// pkg2 路径处的包名就是 mypkg2，这里的 mypkg2 可以省略，但是最好显式指定包名
import (
    mypkg2 "github.com/bigwhite/effective-go-book/chapter3-demo1/pkg/pkg2"
)

func main() {
    mypkg2.Func1()
}
```

## 3. 包初始化顺序
### 3.1 init 函数
Go语言中有两个特殊的函数：一个是main包中的main函数，它是所有Go可执行程序的入口函数；另一个就是包的init函数:
1. init函数是一个无参数、无返回值的函数
2. 如果一个包定义了init函数，Go运行时会负责在该包初始化时调用它的init函数
3. 在Go程序中我们不能显式调用init，否则会在编译期间报错
4. 一个Go包可以拥有多个init函数，每个组成Go包的Go源文件中可以定义多个init函数。在初始化Go包时，Go运行时会按照一定的次序逐一调用该包的init函数。
5. Go运行时不会并发调用init函数，它会等待一个init函数执行完毕并返回后再执行下一个init函数，且每个init函数在整个Go程序生命周期内仅会被执行一次

init函数极其适合做一些包级数据的初始化及初始状态的检查工作。一般来说，先被传递给Go编译器的源文件中的init函数先被执行，同一个源文件中的多个init函数按声明顺序依次执行。但Go语言的惯例告诉我们：不要依赖init函数的执行次序。

### 3.2 程序初始化顺序
Go程序由一组包组合而成，程序的初始化就是这些包的初始化。每个Go包都会有自己的依赖包，每个包还包含有常量、变量、init函数等（其中main包有main函数），这些元素在程序初始化过程中的初始化顺序是什么样的呢？我们用图20-1来说明一下。

![程序初始化](/images/go/expert/package_init.png)

在程序初始化的过程中:
1. Go运行时遵循“深度优先”原则查看到pkg1依赖pkg2，于是Go运行时去初始化pkg2；
2. 没有依赖包，于是Go运行时在pkg3包中按照常量→变量→init函数的顺序进行初始化；

到这里，我们知道了init函数适合做包级数据的初始化及初始状态检查工作的前提条件是，init函数的执行顺位排在其所在包的包级变量之后。

### 3.3 使用init函数检查包级变量的初始状态
init函数就好比Go包真正投入使用之前的唯一“质检员”，负责对包内部以及暴露到外部的包级数据（主要是包级变量）的初始状态进行检查。init 函数有如下几种用法

#### 重置包级变量值
```go
/ $GOROOT/src/flag/flag.go

func init() {
    CommandLine.Usage = commandLineUsage
}
```
CommandLine的Usage字段在NewFlagSet函数中被初始化为FlagSet实例（也就是CommandLine）的方法值defaultUsage。如果一直保持这样，那么使用Flag默认CommandLine的外部用户就无法自定义usage输出了。于是flag包在init函数中，将ComandLine的Usage字段设置为一个包内未导出函数commandLineUsage，后者则直接使用了flag包的另一个导出包变量Usage。这样就通过init函数将CommandLine与包变量Usage关联在一起了。在用户将自定义usage赋值给Usage后，就相当于改变了CommandLine变量的Usage。

#### 对包级变量进行初始化，保证其后续可用
有些包级变量的初始化过程较为复杂，简单的初始化表达式不能满足要求，而init函数则非常适合完成此项工作。比如标准库http包则在init函数中根据环境变量GODEBUG的值对一些包级开关变量进行赋值:

```go
func init() {
    e := os.Getenv("GODEBUG")
    if strings.Contains(e, "http2debug=1") {
        http2VerboseLogs = true
    }
    if strings.Contains(e, "http2debug=2") {
        http2VerboseLogs = true
        http2logFrameWrites = true
        http2logFrameReads = true
    }
}
```

#### init函数中的注册模式

```go
import (
    "database/sql"
    _ "github.com/lib/pq"
)

func main() {
    db, err := sql.Open("postgres", "user=pqgotest dbname=pqgotest sslmode=verify-full")
    if err != nil {
        log.Fatal(err)
    }
}
```

空别名方式导入lib/pq的副作用就是Go运行时会将lib/pq作为main包的依赖包并会初始化pq包，于是pq包的init函数得以执行

```go
// github.com/lib/pq/conn.go
...

func init() {
    sql.Register("postgres", &Driver{})
}

```

pq包的init函数中，pq包将自己实现的SQL驱动（driver）注册到sql包中。从database/sql的角度来看，这种注册模式实质是一种工厂设计模式的实现。原理也很简单，database/sql 只要维护一个全局的**数据库名称 -> Driver**的映射。每个具体的数据链接，通过调用sql.Register 将自己的实现添加到这个映射中，后续就可以根据数据库名称完成初始化。

### 3.4 init函数中检查失败的处理方法
init 目的是保证其所在包在被正式使用之前的初始状态是有效的。一旦init函数在检查包数据初始状态时遇到失败或错误的情况快速失败是最佳选择。一般建议直接调用panic或者通过log.Fatal等函数记录异常日志，然后让程序快速退出。