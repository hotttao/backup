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
