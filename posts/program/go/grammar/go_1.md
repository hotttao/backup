---
weight: 1
title: "go 入门开篇"
date: 2021-01-01T22:00:00+08:00
lastmod: 2021-01-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "这个系列我们开始学习 go 语言的第一部分-语法"
featuredImage: /images/go/grammar/go_brand.jpg

tags: ["go 语法"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

如果编程的世界是海贼王里的"大航海时代", go 语言可能就是"草帽海贼团"

<!-- more -->


## 1. 要去学 Go 了
学习和使用 Python 有三四年,好想学一门新语言,打算学 Go。为什么是 Go，其实更想学 Rust。但是 Go 有谷歌这个大佬，背靠k8s，显然学 Go 好处大大的。其实也无所谓，哪天想学 Rust，就拿来看看对比着学可能更快。当然学 Go 还有另一个重要原因，想转运维开发。

## 2. 怎么学 Go
因为已经不是第一次学编程了，之前也看过一段时间 C，想看看在学习了编程这么长时间之后，在编程领域的学习能力相比于一开始有没有提升。所以这次打算从语言特性的角度出发，有目的性的对比学习，看看能不能以更快的速度学好 Go。下面是我能想到知识面:
1. 基础语法，包括变量，循环，判断以及运算符
2. Go 语言提供的基本数据结构
3. 异常处理
4. 函数，类与泛型
4. 并发编程

## 3. 学习资料
书选的[《Go程序设计语言》](https://book.douban.com/subject/27044219/)，在写博客之前已经翻过一遍，的确是一本可以拿来入门的好书。

## 4. 环境搭建
在学习 Go 语言之前，最重要的是搭建一个 Go 的开发环境。为了对 Go 有一个更好的整体把握，对于这个开发环境我们至少完成下面这些任务。下面涉及的 Go 专业术语，后面会详细解释，为了便于理解，我简单的跟 Python作了一个对比
1. 安装 Go，搭建基本的go开发环境                   -- python 安装
2. Go 语言工具箱，特别是 go 程序包的查询，下载和管理  -- pip 的使用
3. Go 语言的工作目录                             -- 模块的搜索路径
4. IDE 编程环境

我们主要讲解 Linux 下的环境搭建，Windows 的搭建类似。我们使用 VScode 作为我们的IDE，没其他原因，因为大佬们都推荐。

### 4.1 Go 安装
Go 语言官方文档有完整的[安装文档](http://docs.studygolang.com/doc/install),Linux 下可直接运行下面的 bash 脚本，而唯一需要修改的是最后三个环境变量的配置。其中
1. PATH: 用于将 go 命令添加到环境变量的命令搜索路径中，便于直接使用 go 命令
2. GOPATH: 用于指定 go 的工作区，可以是单个目录路径，也可以是冒号分割的多个路径
3. GOBIN: 用于指定 GO 程序生成的可执行文件（executable file）的存放路径

先让你的 Go 可以运行起来，别的不用着急，马上我们就会讲解环境变量的作用，在你理解这些环境变量的含义之后就可以按需修改。

```bash
go_vsersion=go1.12.4.linux-amd64.tar.gz
# 1. 下载安装包
wget https://studygolang.com/dl/golang/${go_vsersion}.tar.gz

# 2. 解压到指定目录
tar -C /usr/local -xzf ${go_version}.tar.gz

# 3. 配置相关环境变量
# 将 go 命令添加到 PATH 环境变量中，以便直接使用，PATH 环境变量与 GO 本身无关
echo 'export PATH=/usr/local/go/bin:$PATH' > /etc/profile.d/go.sh

# 添加 Go的工作区，下面默认为 $HOME/go
echo 'export GOPATH=$(go env GOPATH)' >> /etc/profile.d/go.sh
echo 'export GOBIN=$GOPATH/bin' >> /etc/profile.d/go.

# 4. 并通过在命令行中输入go version来验证是否安装成功。
go version
```

### 4.2 Go语言工具箱
在 go 安装完毕之后，在 go 安装目录的 bin 子目录下会有一个 go 命令(默认为`/usr/local/go/bin`)，这就是 go 语言提供给我们的管理工具箱，它是一系列功能的集合:
1. 首先它是一个构建系统，计算文件的依赖关系，然后调用编译器、汇编器和连接器构建程序
2. 其次它是一个包管理器（类似于python pip），用于包的查询、下载、依赖关系解决。
3. 最后它是一个单元测试和基准测试的驱动程序

go 命令的执行依赖很多环境变量，使用 `go env` 可以查看所有的环境变量，大多数环境变量在 go 语言正确安装之后(主要是选择与操作系统匹配的安装包)会自动配置，唯一需要用户配置是GOPATH，用于指定go 语言的工作区，工作区是 go 语言中的一个核心概念，Go 语言项目在其生命周期内的所有操作（编码、依赖管理、构建、测试、安装等）基本上都是围绕着 GOPATH 和工作区进行的。

### 4.3 Go 工作区
GOPATH对应的工作区目录有三个子目录:
- src 子目录用于存储源代码，使用 `go get` 下载的 go 包和自定义的 go 程序源代码都存在此目录中，同时也是代码包搜索和导入的启始根目录
- pkg子目录用于保存编译后的包的目标文件
- bin子目录用于保存编译后的可执行程序

go build命令编译命令行参数指定的每个包。如果
#### src
使用命令 go get可以下载一个单一的包或者用 ...下载整个子目录里面的每个包。`go get` 会自动下载所依赖的每个包

### 4.3 GOROOT
环境变量GOROOT用来指定Go的安装目录，还有它自带的标准库包的位置。GOROOT的目录结构和GOPATH类似，因此存放fmt包的源代码对应目录应该为`$GOROOT/src/fmt`。用户一般不需要设置GOROOT，默认情况下Go语言安装工具会将其设置为安装的目录路径。


下面是我当前工作区目录的示例:
```bash
$ tree -L 2 /home/tao/go
/home/tao/go
├── bin
│   ├── a
│   ├── dlv
│   ├── gocode
│   ├── godef
│   ├── go-outline
│   ├── gopkgs
│   ├── goreturns
│   └── helloworld
├── pkg
│   └── linux_amd64
└── src
    ├── algo
    ├── blog
    ├── github.com
    ├── golang.org
    ├── gopl.io
    ├── sourcegraph.com
    └── test
```


你可以运行go或go help命令查看内置的帮助文档，为了查询方便，我们列出了最常用的命令

```Go
$ go
Go is a tool for managing Go source code.

Usage:

	go <command> [arguments]

The commands are:

	bug         start a bug report
	build       compile packages and dependencies
	clean       remove object files and cached files
	doc         show documentation for package or symbol
	env         print Go environment information
	fix         update packages to use new APIs
	fmt         gofmt (reformat) package sources
	generate    generate Go files by processing source
	get         download and install packages and dependencies
	install     compile and install packages and dependencies
	list        list packages or modules
	mod         module maintenance
	run         compile and run Go program
	test        test packages
	tool        run specified go tool
	version     print Go version
	vet         report likely mistakes in packages

Use "go help <command>" for more information about a command.
```


### 4.3 Go 环境变量

GOPATH对应的工作区目录有三个子目录。

与 Python 不同的是，Go 的包不是通过镜像的方式，而是直接从远程版本控制系统(eg: githup)直接下载的，因此当我们使用标准的 `go get` 下载Go包时，可能会由于不可描述的原因失败。因此我们必须手动解决一些包的安装问题。

### 4.2 Vscode 安装
在[Vscode官网](https://code.visualstudio.com/Download) 下载与你系统时配的安装包，安装即可。安装完成后在 VScode Extension 安装与 go 相关的扩展，如下图所示:

![Hello World](/images/go/grammar/go_install.jpg)
