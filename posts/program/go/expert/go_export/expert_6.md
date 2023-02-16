---
weight: 1
title: "Go 包"
date: 2022-12-29T22:00:00+08:00
lastmod: 2022-12-29T22:00:00+08:00
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
init 目的是保证其所在包在被正式使用之前的初始状态是有效的。一旦init函数在检查包数据初始状态时遇到失败或错误的情况快速失败是最佳选择。一般建议直接调用panic或者通过log.Fatal等函数记录异常日志，然后让程序快速退出。但是 go get 至少存在以下问题:
1. 依赖包持续演进，导致不同Gopher在不同时间获取和编译包时得到的结果可能是不同的，即不能保证可重现的构建（reproduceable build）；
2. 如果依赖包引入了不兼容代码，你的包/程序将无法通过编译；

Gopher希望自己项目所依赖的第三方包能受自己的控制，而不是随意变化，于是godep、gb、glide等一批第三方包管理工具便出现了。

## 4. 使用 module 管理包依赖
#### gopath 模式
Go编译器在传统的GOPATH和vendor目录下搜索目标程序依赖的Go包。

#### go module 模式
go module 引入了一种新的依赖管理工作模式：module-aware模式
1. 一个仓库的顶层目录下会放置一个go.mod文件，每个go.mod文件唯一定义了一个module。
2. 一个module就是由一组相关包组成的一个独立的版本单元。module是有版本的，module下的包也就有了版本属性。
2. 放置go.mod文件的目录被称为module root目录。module root目录及其子目录下的所有Go包均归属于该module，除了那些自身包含go.mod文件的子目录。
3. 虽然Go支持在一个仓库中定义多个module，但通常Go惯用法是一个仓库只定义一个module。
4. 在module-aware模式下，Go编译器将下载的依赖包缓存在 **$GOPATH/pkg/mod** 下，Go编译器将不会在GOPATH及vendor下搜索目标程序依赖的第三方Go包。

### 4.1 go.mod 文件
下面是一个 go.mod 文件的示例:

```
module hello

require (
    bitbucket.org/bigwhite/c v0.0.0-20180714063616-861b08fcd24b
    bitbucket.org/bigwhite/d v0.0.0-20180714005150-3e3f9af80a02 // indirect
)
```

Go编译器分析出了hello module的依赖包，将其写入go.mod的require区域。由于c、d两个包均没有发布版本（建立其他分支或打标签），因此Go编译器使用了包c和d的当前最新版，并以伪版本（pseudo-version）的形式作为这两个包的当前版本号。此外，hello module并没有直接依赖包d，并且bitbucket.org/bigwhite/c下没有建立go.mod、记录包c的依赖，因此在d包的记录后面用注释标记了indirect，即间接依赖。

### 4.1 go 依赖管理的选择
go module机制在Go 1.11版本中是试验特性。GO111MODULE这个临时的环境变量就是go module特性的试验开关。 GO111MODULE 有三个值——auto、on和off，默认值为auto。GO111MODULE的值会直接影响Go编译器的包依赖管理工作模式的选择：是gopath模式还是module-aware模式。不同版本下，GO111MODULE 值的行为模式是不同的。

Go 1.11版本:
1. GO111MODULE=off: go module关闭，Go编译器会始终使用gopath模式，
2. GO111MODULE=on:  go module始终开启，Go编译器会始终使用module-aware模式
3. GO111MODULE=auto: 默认值，如果构建的源码目录不在以GOPATH/src为根的目录体系下且包含go.mod文件（两个条件缺一不可），将使用module-aware模式；否则使用传统的gopath模式

Go 1.13版本:
1. GO111MODULE=off: 同上
2. GO111MODULE=on: 同上
3. GO111MODULE=auto 默认值，只要目录下有go.mod，Go编译器就会使用module-aware模式

Go 1.14版本:
1. GO111MODULE=off: 同上
2. GO111MODULE=on: go module 开启，但是行为模式有所变化
    - 在module-aware模式下，如果go.mod中go version是Go 1.14及以上，且当前仓库顶层目录下有vendor目录，那么Go工具链将默认使用vendor（`-mod=vendor`）中的包，而不是module cache中的（`$GOPATH/pkg/mod`下）。同时在这种模式下，Go工具会校验`vendor/modules.txt`与`go.mod`文件以确保它们保持同步；如果一定要使用module cache中的包进行构建，则需要为Go工具链显式传入-mod=mod ，比如`go build -mod=mod ./...`。
    - 在module-aware模式下，如果没有建立go.mod或Go工具链，无法找到go.mod，那么你必须显式传入要处理的Go源文件列表，否则Go工具链将需要你明确建立go.mod。比如：在一个没有go.mod的目录下，要编译hello.go，我们需要使用go build hello.go，即hello.go需要显式放在命令后面。如果你执行`go build .`，就会得到类似下面的错误信息：

```bash
$go build .
go: cannot find main module, but found .git/config in /Users/tonybai
    to create a module there, run:
    cd .. && go mod init
```
也就是说，在没有go.mod的情况下，Go工具链的功能是受限的。

![Go module模式下的行为特性对比](/images/go/expert/go_module_version.png)

### 4.2 go module的依赖包版本的选择
#### build list和main module
go.mod文件一旦创建，它的内容就会被Go工具链全面掌控。Go工具链会在各类命令（比如go get、go build、go mod等）执行时维护go.mod文件。

go list -m输出的信息被称为build list，也就是构建当前module所需的所有相关包信息的列表。

```go
$go list -m -json all
{
    "Path": "hello",
    "Main": true,
    "Dir": "chapter10/sources/go-module/hello",
    "GoMod": "chapters/chapter10/sources/go-module/hello/go.mod",
    "GoVersion": "1.14"
}
...
```
在输出信息中我们看到"Main"：true这一行信息，它标识当前的module为main module。main module 即 go build 命令执行时所在当前目录所归属的那个module。**go命令会在当前目录、当前目录的父目录、父目录的父目录等下面寻找go.mod文件，所找到的第一个go.mod文件对应的module即为main module**。如果没有找到go.mod，go命令会提示下面的错误信息：

```bash
$go build test/hello/hello.go
go: cannot find main module root; see 'go help modules'
```
也可以使用下面的命令来简略输出build list：

```bash
$go list -m all
hello
bitbucket.org/bigwhite/c v0.0.0-20180714063616-861b08fcd24b
```

#### go.mod中的 require
`go clean -modcache` 命令可以清除掉$GOPATH/pkg/mod目录下的内容，并将go.mod重新置为初始状态，即只包含module字段。这样就可以重新拉取依赖进行包构建。

如果对使用的c和d版本有特殊的约束，比如使用包c的v1.0.0版本和包d的v1.1.0版本，我们可以通过`go mod -require`来显式更新go.mod文件中的require段的信息：

```bash
# c 和 d 的包版本信息
# // 包c

v1.0.0
v1.1.0
v1.2.0

# // 包d

v1.0.0
v1.1.0
v1.2.0
v1.3.0

$go mod -require=bitbucket.org/bigwhite/c@v1.0.0
$go mod -require=bitbucket.org/bigwhite/d@v1.1.0

$cat go.mod
module hello

require (
    bitbucket.org/bigwhite/c v1.0.0
    bitbucket.org/bigwhite/d v1.1.0 // indirect
)

```

go mod还支持query表达式，比如：

```bash
$go mod -require='bitbucket.org/bigwhite/c@>=v1.1.0'

$cat go.mod
module hello

require (
    bitbucket.org/bigwhite/c v1.1.0
    bitbucket.org/bigwhite/d v1.1.0 // indirect
)

```
go mod命令会对query表达式进行求值，得出build list使用的包c的版本。go mod命令对query表达式进行求值的算法是，选择最接近于比较目标的版本（tagged version）。以上面的例子为例：
1. query text: `>=v1.1.0`，满足这一query表达式的最接近于比较目标的版本就是v1.1.0。
2. query text: `<v1.3.0`，满足这一query表达式的最接近于比较目标的版本就是v1.2.0。

#### 最小版本选择
每个依赖管理解决方案都必须解决选择依赖项版本的问题。目前有两种选择方案:
1. 最新最大(latest greatest)版本: 其他语言的方案，在语义版本控制（sematic versioning）被正确应用并且得到遵守的情况下，这是有道理的，因为高版本能正确实现向前兼容
2. 最小版本选择(Minimal Version Selection，MVS): go module 模式的方案，Go 核心团队认为如果无法一直做到保持高版本向低版本兼容，MVS 是为Go程序实现持久的和可重现的构建提供了最佳方案

下面是 MVS 算法的解释:

![复杂包依赖最小版本选择的场景](/images/go/expert/mvs.png)

![复杂包依赖最小版本选择的场景](/images/go/expert/mvs_1.png)

#### 依赖一个包的不同版本
按照语义化版本规范，当代码出现与之前版本的不兼容性变化时，需要升级版本中的major版本号。而Go module允许在包导入路径中带有major版本号，比如：`import github.com/user/repo/v2`表示所用的包为v2版本下的实现。甚至可以在一个项目中同时依赖同一个包的不同版本。

首先需要为包d建立module文件Go.mod，并标识出当前的module为`bitbucket.org/bigwhite/d/v2`。（为了保持与v0/v1各自独立演进，可通过建立分支的方式来实现，然后基于该版本打v2.0.0标签。）

```
// bitbucket.org/bigwhite/d
$cat go.mod
module bitbucket.org/bigwhite/d/v2
```

改造一下hello module，导入包d的v2版本：

```go
// sources/go-module/hello/hello.go
package main

// 注 c 依赖 d v1.2.0
import "bitbucket.org/bigwhite/c"
import "bitbucket.org/bigwhite/d/v2"
```

重新拉取依赖包:

```go
$go build hello.go
go: finding bitbucket.org/bigwhite/c v1.3.0
go: finding bitbucket.org/bigwhite/d v1.2.0     
go: downloading bitbucket.org/bigwhite/c v1.3.0
go: downloading bitbucket.org/bigwhite/d v1.2.0    // c 依赖的 d v1.2.0
go: finding bitbucket.org/bigwhite/d/v2 v2.0.0
go: downloading bitbucket.org/bigwhite/d/v2 v2.0.0 // hello 依赖的 d/v2 v2.0.0
```

### 4.3 go mod 命令使用
#### Go module与vendor
go module支持通过下面的命令将某个module的所有依赖复制一份到module根路径下的vendor目录下：

```go
$ go mod -vendor
$ ls
go.mod    go.sum  hello.go  vendor/
$ cd vendor
$ ls
bitbucket.org/    modules.txt

$ cat modules.txt
# bitbucket.org/bigwhite/c v1.3.0
bitbucket.org/bigwhite/c
# bitbucket.org/bigwhite/d v1.2.0
bitbucket.org/bigwhite/d
# bitbucket.org/bigwhite/d/v2 v2.0.0
bitbucket.org/bigwhite/d/v2
```

这样即便在module-aware模式下，我们也依然可以只用vendor下的包来构建hello module: `go build -mode=vendor hello.go`。当然生成的vendor目录还可以兼容Go 1.11之前版本的Go编译器。不过由于Go 1.11之前版本的Go编译器不支持在GOPATH之外使用vendor机制，我们需要将hello目录复制到$GOPATH/src下才能成功编译它。

#### go.sum
执行go build后，hello module的当前目录下多了一个go.sum文件：

```bash
$cat go.sum
bitbucket.org/bigwhite/c v1.3.0 h1:crNI04Bw6lm1yyRjJ+8lJX+3amsxeU72mVQ41kjnESA=
bitbucket.org/bigwhite/c v1.3.0/go.mod h1:6p3lkm60SJ7QP5a4oJyLUxbDJeT+w5x5CShTrekjc7o=
bitbucket.org/bigwhite/d v1.2.0 h1:QQawlmsVZWwIsr0ockPCSJjN1QoKd4W0KEJrINdIzY0=
bitbucket.org/bigwhite/d v1.2.0/go.mod h1:6XJNbysZ+/91fhY6/3TKkMNdV/c0pgaubTQWMigKnlY=
```

go.sum记录每个依赖库的版本和对应内容的校验和。每当增加一个依赖项时，如果go.sum中没有，则会将该依赖项的版本和内容校验和添加到go.sum中。go命令会使用这些校验和与缓存在本地的依赖包副本元信息进行比对校验。如果修改了`$GOPATH/pkg/mod/cache/` 中缓存的包的内容，那么当执行verify子命令时，我们会得到报错信息：

```go
go mod verify
golang.org/x/text v0.3.0: zip has been modified (/root/go/pkg/mod/cache/download/golang.org/x/text/@v/v0.3.0.zip)
golang.org/x/text v0.3.0: dir has been modified (/root/go/pkg/mod/golang.org/x/text@v0.3.0)

// 如果没有“恶意”修改，则verify会报成功：
# go mod verify
all modules verified
```

在将代码提交/推回存储库之前，请运行go mod tidy以确保module文件（go.mod）是最新且准确的。在本地构建、运行或测试代码将随时影响Go对module文件中内容的更新。运行go mod tidy可以确保项目具有所需内容的准确且完整的快照，这对团队中的其他人或持续集成/交付环境大有裨益。

#### 升降级依赖关系
在module-aware模式下，由于go.mod和go.sum都是由Go工具链维护和管理的，不建议手动修改go.mod中require中的包版本号。我们可以通过go get命令来实现升降级依赖:

```bash
# 我们可以先用go list命令查看一下某个module有哪些版本可用:
$go list -m -versions golang.org/x/text
golang.org/x/text v0.1.0 v0.2.0 v0.3.0 v0.3.1 v0.3.2 v0.3.3

# 将 golang.org/x/text 从v0.3.0 降级到 v0.1.0
# go get 会自动更新 go.mod 和 go.sum
$go get golang.org/x/text@v0.1.0
go: finding golang.org/x/text v0.1.0
go: downloading golang.org/x/text v0.1.0

# go get-u会将当前module的所有依赖的包版本（无论直接依赖还是间接依赖）都升级到最新的兼容版本。
# 后接具体的 module 则只更新对应的 module，省略则更新所有
$ go get -u golang.org/x/text

# 如果仅升级patch号，而不升级minor号，可以使用go get -u=patch A。
# 如果 golang.org/x/text 当前版本是 v0.1.0 如果其有 v0.1.1，最新版本是 v0.3.3，加上 -u=patch，升级到的版本则是 v0.1.1
go get -u=patch golang.org/x/text
```

处于module-aware模式下的go get在更新某个依赖（无论是升版本还是降版本）时，会自动计算并更新其间接依赖的包的版本。

### 4.4 Go module代理
#### GOPROXY环境变量
无论是在gopath模式还是module-aware模式下，go get命令默认都是直接从代码托管服务器（如GitHub、GitLab等）下载Go module的。但是在Go 1.11中，我们可以通过设置GOPROXY环境变量让Go命令从其他module代理服务器下载module。比如：`export GOPROXY=https://goproxy.cn`

通过代码托管站点拉取代码总是比从代理拉取代码慢，所以在Go 1.13中将https://proxy.golang.org设为GOPROXY环境变量的默认值之一，这也是Go提供的官方module代理服务。同样是从Go 1.13版本开始，GOPROXY环境变量支持设置多个代理的列表（多个代理之间采用逗号分隔）。Go编译器会按顺序尝试从列表中的代理服务获取依赖包数据，当有代理服务不可达或者返回的HTTP状态码既不是404也不是410时，Go会终止数据获取，否则会尝试向列表中的下一个代理服务获取数据。在Go 1.13中，GOPROXY的默认值为https://proxy.golang.org,direct。

当官方代理返回404或410时，Go编译器会尝试直接连接依赖module的代码托管站点以获取数据。但是当列表中的代理服务返回其他错误时，Go命令不会向GOPROXY列表中的下一个值所代表的代理服务发起请求。这种行为模式没能让所有Gopher满意，很多Gopher认为Go工具链应该向后面的代理服务请求，直到所有代理服务都返回失败。Go 1.15版本满足了Go社区的需求，新增以管道符“|”为分隔符的代理列表值。如果GOPROXY配置的代理服务列表值以管道符分隔，则无论某个代理服务返回什么错误码，Go命令都会向列表中的下一个代理服务发起新的尝试请求。（Go 1.15版本中GOPROXY环境变量的默认值依旧为https://proxy.golang.org,direct。）

目前世界各地的一些知名module代理服务。
1. proxy.golang.org：Go官方提供的module代理服务。
2. mirrors.tencent.com/go：腾讯公司提供的module代理服务。
3. mirrors.aliyun.com/goproxy：阿里云提供的module代理服务。
4. goproxy.cn：开源module代理，由七牛云提供主机，是目前中国最为稳定的module代理服务。
5. goproxy.io：开源module代理，由中国Go社区提供的module代理服务。
6. Athens：开源module代理，可基于该代理自行搭建module代理服务。

#### GOSUMDB
每次运行或构建时，Go命令都会通过本地的go.sum检查其本地缓存副本的校验和是否一致。如果校验和不匹配，则Go命令将报告安全错误，并拒绝运行构建或运行。在这种情况下，重要的是找出正确的校验和，确定是go.sum错误还是下载的代码有误。如果go.sum中尚未包含已下载的module，并且该模块是公共module，则go命令将查询Go校验和数据库以获取正确的校验和数据并存入go.sum。

Go 1.13提供了GOSUMDB环境变量来配置Go校验和数据库的服务地址（和公钥），其默认值为 `sum.golang.org`，这也是Go官方提供的校验和数据库服务（也可以使用 `sum.golang.google.cn`）。出于安全考虑，建议保持 GOSUMDB 开启。但如果因为某些因素无法访问GOSUMDB，也可以通过下面的命令将其关闭：`$go env -w GOSUMDB=off` 在GOSUMDB关闭后，Go编译器就仅能使用本地的go.sum进行包的校验和校验了。

#### 获取私有module
如果依赖的 module 是企业内部代码服务器或公共代码托管站点上的私有module，通过公共的 module 显然是无法获取私有的 module 的。对于 github 上私有的 module 需要配置访问 github 的凭证。配置好后，还存在另一个问题: 由于是私有仓库，默认的sum.golang.org站点自然不会有该仓库的校验信息，在使用默认的GOSUMDB（sum.golang.org）校验privatemodule时报了404错误。

Go 1.13提供了GOPRIVATE环境变量用于指示哪些仓库下的module是私有的，不需要通过GOPROXY下载，也不需要通过GOSUMDB验证其校验和。不过要注意的是，GONOPROXY和GONOSUMDB可以覆盖GOPRIVATE变量中的设置，因此设置时要谨慎，比如下面的例子：

```bash
GOPRIVATE=pkg.tonybai.com/private
GONOPROXY=none
GONOSUMDB=none
```

GOPRIVATE指示 pkg.tonybai.com/private 下的包无须经过GOPROXY代理下载，不经过GOSUMDB验证。但GONOPROXY和GONOSUMDB均为none，意味着所有module，不管是公共的还是私有的，都要经过GOPROXY下载，经过GOSUMDB验证，这样GOPRIVATE的设置就因被覆盖而不会生效。可以单独设置GOPRIVATE来实现go get不使用GOPROXY下载privatemodule并且无须GOSUMDB校验：

```bash
$export GOPRIVATE=github.com/bigwhite/privatemodule
$go get github.com/bigwhite/privatemodule
```

### 4.5 升级module的主版本号
#### go module的语义导入版本
在“Semantic Import Versioning”一文中，Russ Cox说明了Go import包兼容性的总原则：
1. 如果新旧版本的包使用相同的导入路径，那么新包与旧包是兼容的。
2. 如果新旧两个包不兼容，那么应该采用不同的导入路径

因此，Russ Cox采用了将主版本作为导入路径一部分的设计。这种设计支持在
1. 同一个项目的Go源文件中导入同一个包的不同版本：同一个包虽然包名相同，但是导入路径不同。
2. vN作为导入路径的一部分将用于区分包的不同版本。同时在同一个源文件中，我们可以使用包别名来区分同一个包的不同版本，

比如：

```go
import (
    "github.com/bigwhite/foo/bar"
    barV2 "github.com/bigwhite/foo/v2/bar"
)
```

go module的这种设计虽然没有给Go包的使用者带来多少额外工作，但却给Go包的维护者带来了一定的复杂性，他们需要考虑在go module机制下如何升级自己的go module的主版本号（major version）。稍有不慎，很可能就会导致自身代码库的混乱或者包使用者侧无法通过编译或执行行为混乱。

总体上有两种方案:
1. major branch 方案
2. major subdirectory方案

#### major branch 方案
major branch 方案是一个过渡比较自然的方案，它通过建立 vN 分支并基于vN分支打vN.x.y标签的方式进行主版本号的升级。示例中假设，我们的项目 A 依赖一个 bitbucket.org/bigwhite/modules-major-branch。

```go
// 1. modules-major-branch 发布版本 v1.0.0
// 假设 modules-major-branch 已经发布了版本 pre，现在发布正式的 v1.0.0 版本
git tag v1.0.0
git push --tag origin master

// 2. A 升级依赖
// 升级是不会自动进行的，需要开发手动进行
go mod edit -require=bitbucket.org/bigwhite/modules-major-branch@v1.0.0
```

从pre-v1到v1还算不上主版本升级，接下来看看foo包的作者应该如何对modules-major-branch module进行不兼容的升级：v1→v2。

```bash
# 1. v1 分支，进行 v1 版本开发和升级
$ git checkout -b v1

# 2. 在master分支上进行不兼容的修改
$ git checkout master

# 进行不兼容开发 ....

# 3. modules-major-branch module要有不同的导入路径，因此需要修改modules-major-branch module的module路径
$ cat go.mod
module bitbucket.org/bigwhite/modules-major-branch/v2

# 4. v2 发版
$ git tag v2.0.0
$ git push --tag origin master
```

假设 A 项目需要使用 v2 版本:

```go
package main

import (
    "bitbucket.org/bigwhite/modules-major-branch/v2/foo"
)
```

后续modules-major-branch可以在master分支上持续演进，直到又有不兼容改动时，可以基于master建立v2维护分支，同时master分支将升级为v3版本。

在该方案中，对包的作者而言，升级主版本号需要：
1. 在go.mod中升级module的根路径，增加vN；
2. 建立vN.x.x形式的标签（可选，如果不打标签，Go会在消费者的go.mod中使用伪版本号，比如bitbucket.org/bigwhite/modules-major-branch/v2 v2.0.0-20190603050009-28a5b8da279e）。

**如果 modules-major-branch 内部有相互的包引用，那么在升级主版本号的时候，这些包的导入路径也要增加vN，否则就会出现在高版本号的代码中引用低版本号包代码的情况，这也是包作者极容易忽略的事情。** `github.com/marwan-at-work/mod` 是一个为module作者提供的升降级主版本号的工具，它可以帮助包作者方便地自动修改项目内所有源文件中的导入路径。有Gopher已经提出希望Go官方提供升降级的支持: [issue](https://github.com/golang/go/issues/32014)，但目前Go核心团队尚未明确是否增加。

对于包的消费者而言，升级依赖包的主版本号，只需要在导入包时在导入路径中增加vN即可

#### major subdirectory方案
Go module还提供了一种用起来不那么自然的方案，那就是利用子目录分割不同主版本。在这种方案下，如果某个module目前已经演进到v3版本，那么这个module所在仓库的目录结构应该是这样的：

```bash
$ tree modules-major-subdir
modules-major-subdir
├── bar
│   └── bar.go
├── go.mod
├── v2                  # v2 就是对应的版本目录
│   ├── bar
│   │   └── bar.go
│   └── go.mod
└── v3
    ├── bar
    │   └── bar.go
    └── go.mod

$ cat v2/go.mod
module bitbucket.org/bigwhite/modules-major-subdir/v2
```

接下来，创建一个新的消费者，让它来分别调用不同版本的modules-major-subdir/bar包

```go
package main

import (
    "bitbucket.org/bigwhite/modules-major-subdir/bar"
    "bitbucket.org/bigwhite/modules-major-subdir/v2/bar"
)
Go编译器会自动找到了位于modules-major-subdir仓库下v2子目录下的v2版本bar包。
```

从上面的示例来看，这种通过子目录方式来实现主版本升级的方式似乎更简单一些，但感觉有点“怪”，尤其是在与分支和标签交叉使用时可能会带来一些困惑，其他主流语言也鲜有使用这种方式进行主版本升级的。一旦使用这种方式，利用Git等工具在各个不同主版本之间自动同步代码变更将变得很困难。另外和major branch方案一样，如果module内部有相互的包引用，那么在升级module的主版本号的时候，这些包的导入路径也要增加vN，否则也会出现在高版本号的代码中引用低版本号包代码的情况。

## 5. 自定义包导入
在日常开发中，我们使用最多的Go包的go get导入路径主要是基于一些代码托管站点的域名。以 Go Web 框架beego包为例，它的go get导入路径就是`github.com/astaxie/beego`。我们还经常看到一些包，它们的导入路径很特殊，比如`go get golang.org/x/net`，这些包使用了自定义的包导入路径。这种自定义包go get导入路径的实践有诸多好处。
1. 可以作为Go包的权威导入路径，这样可以避免 github 倒闭 go 包迁移之后，Go包导入路径发生变化的情况
2. 便于组织和个人对Go包的管理。组织和个人可以将其分散托管在不同代码管理站点上的Go包统一聚合到组织的官网名下或个人的域名下
3. Go包的导入路径可以更短、更简洁

下面介绍一个自定义Go包导入路径的方法: govanityurls。

### 5.1 govanityurls
[govanityurls](https://github.com/GoogleCloudPlatform/govanityurls)，可以帮助Gopher快速实现自定义Go包的go get导入路径。govanityurls仅能运行于Google的App Engine上。白名老师(《Go 语言精进之路》作用)修改了一个可以在裸机上运行的版本: [bigwhite/govanityurls](https://github.com/bigwhite/govanityurls)。

#### govanityurls原理
govanityurls的原理十分简单:

![govanityurls工作原理](/images/go/expert/govanityurls.png)

#### govanityurls 使用

```bash
# 1. 安装
$go get github.com/bigwhite/govanityurls

$govanityurls
# // govanityurls需要外部传入一个代表自定义包路径基本域名的host参数
govanityurls is a service that allows you to set custom import paths for your go packages

Usage:
    govanityurls -host [HOST_NAME]

    -host string
        custom domain name, e.g. tonybai.com

# 2. 配置vanity.yaml
# // govanityurls 从vanity.yaml配置文件中读取请求包的真实地址返回给go get
/gowechat:                                      # 请求包
    repo: https://github.com/bigwhite/gowechat  # 请求包真实路径

/x/experiments:
    repo: https://github.com/bigwhite/experiments

# 3. nginx 代理配置
cat /etc/nginx/conf.d/govanityurls.conf
server {
    listen 80;
    listen 443 ssl;
    server_name tonybai.com;

    ssl_certificate           /etc/nginx/cert.crt;
    ssl_certificate_key       /etc/nginx/cert.key;
    ssl on;

    # 之所以加一个 /x 是为了简化 nginx 代理规则的编写
    location /x {
        proxy_pass http://192.168.16.4:8080;
        proxy_redirect off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```
