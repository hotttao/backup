---
weight: 1
title: "Go 常用工具"
date: 2023-01-12T22:00:00+08:00
lastmod: 2023-01-12T22:00:00+08:00
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
go 原生提供的工具，在 gopath 和 module-ware 两种模式上存在一些行为差异。接下来我们会分别介绍 go 原生工具在这两种模式下的使用。

## 1. go get
go get 用于获取 Go 包及其依赖包

常用命令如下:

```go
// 1. 仅下载源码
go get -d A
// 下载 A的特定版本，仅在 module-ware 模式下可用
go get -d A@version

// 2. 下载源码并编译安装
go get A

// 3. 更新依赖版本
go get -u A

// 4. 获取测试代码依赖的包
go get -t A
```

### 1.1 go get -d
go get的标准行为是将Go包及依赖包下载到本地，并编译和安装目标Go包。传入-d 选项，go get仅会将源码下载到本地，不会对目标包进行编译和安装。

|区别|gopath|module-ware|
|:---|:---|:---|
|下载位置|`$GOPATH/src`|`GOPATH[0]/pkg/mod`|
|依赖判定|只下载目标包及其依赖包的当前最新版本|分析目标module的依赖以决定下载依赖的版本|
|指定版本|不支持|`go get -d A@version`|


### 1.2 go get
标准go get（无命令行标志选项）不仅要下载项目及其依赖的源码，还要对下载的源码进行编译和安装。

|区别|gopath|module-ware|
|:---|:---|:---|
|二进制文件|安装到 `$GOBIN`或`$GOPATH/bin` |安装到 `$GOBIN`或`$GOPATH/bin`|
|库文件|以.a文件的形式被安装到`$GOPATH/pkg/$GOOS_$GOARCH`下|只编译并将编译结果缓存下来（Linux系统下缓存默认在`~/.cache/go-build`下），而不安装|


### 1.3 go get -u
默认情况下 go get 会检查目标包及其依赖包在本地是否存在
1. 不存在才会从远程获取。
2. 如果存在，那么即便远程仓库中的目标包及其依赖包的版本发生了更新，go get 也会直接跳过

如果想要go get更新目标包及其依赖包的版本，需要给它传入-u命令行标志选项。

|区别|gopath|module-ware|
|:---|:---|:---|
|依赖判定|只是单纯地下载包的最新版本，如果包存在不兼容，将导致编译问题|根据 go.mod 的依赖关系，获取满足要求的、依赖module的minor版本或patch版本进行更新|


module-aware模式下，存在一个特殊情况:


![module s、t、u和w之间的依赖关系](/images/go/expert/go_get_u.png)

module s的直接依赖 module t中的包t1 并未直接参与module s的构建(即 s 没有 import t/t1)，这时如果采用go get -u更新module s的依赖版本，go get -u仅会将t更新到最新的兼容版本（v1.1.0），而module t中未直接参与构建s包的t1包所依赖的module w并不会被更新。

### 1.4 go get -t
-t命令行标志选项是一个辅助选项，它通常与-d或-u组合使用，用来指示go get在仅下载源码或构建安装时要考虑测试代码的依赖，将测试代码的依赖包一并获取。

### 1.5 行为对比
gopath模式和module-aware模式下的go get行为对比:

![go get命令在gopath模式和module-aware模式下的对比](/images/go/expert/go_get.png)

## 2. go install
go install 会对包进行编译，并将构建出的可执行文件安装到 `$GOBIN` 或 `$GOPATH/bin`下。注意 go get 会拉取代码，然后在执行 go install。

go install 常用的命令如下

```go
// -x -v选项，go install会输出大量日志
$go install -x -v bitbucket.org/bigwhite/p
```

|go module之前的gopath模式|go module之后的gopath模式|module-ware|
|:---|:---|:---|
|二进制文件被安装到 `$GOBIN` 或 `$GOPATH/bin`下|同|同|
|目标文件（.a）被安装到$GOPATH/pkg/linux_amd64下|不会安装，会复制一份放到$GOCACHE下，需要单独安装，添加 -i 选项|仅会被缓存到$GOCACHE下|
|go clean可以清理掉当前目录下编译构建得到的 p|同|同|
|go clean -i会清理掉$GOBIN下的可执行文件 p|同|同|
|go clean -i bitbucket.org/bigwhite/q 会清理掉目标文件|无|无|

![go install命令在GOPATH模式和module-aware模式下的对比](/images/go/expert/go_install.png)


## 3. go list
go list 用于列出(检视)关于包/module的各类信息。go list 命令行选项如下:

```bash
go list  --help
usage: go list [-f format] [-json] [-m] [list flags] [build flags] [packages]
Run 'go help list' for details.

```

### 3.1 搜索范围
package 用于确定搜索的范围:
1. 默认: 在当前路径下寻找 go.mod，如果当前路径下没有go.mod文件，go list会报错
2. ./...: 
  - 列出当前路径及其子路径（递归）下的所有包
  - 在module-aware模式下，如果当前目录不是module根目录，使用module根路径+...的方式列举包会导致go list无法匹配到包
3. main：表示独立可执行程序的顶层包
4. all：
  - 在gopath模式下，它可以展开为标准库和GOPATH路径下的所有包；
  - 在module-aware模式下，它展开为主module（当前路径下的module）下的所有包及其所有依赖包，包括测试代码的依赖包。
5. std：代表标准库所有包的集合
6. cmd：代码Go语言自身项目仓库下的src/cmd下的所有包及internal包。

```bash
# 1. 搜索路径
$go list
$go list ./...
$go list bitbucket.org/bigwhite/...
#  Go原生保留了几个代表特定包或包集合的路径关键字：main、all、cmd和std
#  这些保留的路径关键字不要用于Go包的构建中
$go list all
$go list std
$go list cmd
```

### 3.2 输出内容
#### go list -m
默认情况下，go list输出的都是包的导入路径信息，如果要列出module信息，可以为list命令传入-m命令行标志选项。

#### go list -f
go list提供了一个 -f 的命令行标志选项，用于定制其输出内容的格式。-f标志选项的值是一个格式字符串，采用的是Go template包的语法。go list的默认输出等价于：

```bash
$go list -f '{{.ImportPath}}'
```

go list 可以输出内容来自`$GOROOT/src/cmd/go/internal/pkg.go`文件中的结构体类型PackagePublic，其结构如下：

```go
type PackagePublic struct {
    Dir           string `json:",omitempty"`  // 包含包源码的目录
    ImportPath    string `json:",omitempty"`  // dir下包的导入路径
    ImportComment string `json:",omitempty"`  // 包声明语句后面的注释中的路径
    Name          string `json:",omitempty"`  // 包名
    Doc           string `json:",omitempty"`  // 包文档字符串
    Target        string `json:",omitempty"`  // 该软件包的安装目标（可以是可执行的）
    ...

    TestGoFiles  []string `json:",omitempty"` // 包中的_test.go文件
    TestImports  []string `json:",omitempty"` // TestGoFiles导入的包
    XTestGoFiles []string `json:",omitempty"` // 包外的_test.go
    XTestImports []string `json:",omitempty"` // XTestGoFiles导入的包
}
```

|字段|含义|
|:---|:---|
|ImportPath| ImportPath表示当前路径下的包的导入路径，该字段唯一标识一个包|
|Target| Target表示包的安装路径，该字段采用绝对路径形式|
|Root| Root表示包所在的GOROOT或GOPATH顶层路径，或者包含该包的module根路径|
|GoFiles| GoFiles表示当前包包含的Go源文件列表，不包含导入“C”的cgo文件、测试代码源文件
|CgoFiles|CgoFiles表示当前包下导入了“C”的cgo文件|
|IgnoredGoFiles|IgnoredGoFiles表示当前包中在当前构建上下文约束条件下被忽略的Go源文件|
|Imports|Imports表示当前包导入的依赖包的导入路径集合|
|Deps|Deps表示当前包的所有依赖包导入路径集合。和Imports不同的是，Deps是递归查询当前包的所有依赖包|
|TestGoFiles|TestGoFiles表示当前包的包内测试代码的文件集合|
|XTestGoFiles|XTestGoFiles表示当前包的包外测试代码的文件集合|

#### go list -json
-f 外，传入 -json 选项，可以将包的全部信息以JSON格式输出。

#### go list -m -u
通过 -m 标志选项，可以让go list列出module信息，-m就像是一个从包到module的转换开关。基于该开关，我们还可以通过传入其他标志选项来获得更多有关module的信息。比如：通过传入-u标志选项，我们可以获取到可用的module升级版本。

#### go list 常用命令
```bash
# 2. 输出详细信息
$go list -m    # 输出导出包的详细信息      
$go list -f '{{.ImportPath}}'
$ go list -json

# 3. 有关module的可用升级版本信息
$ go list -m -u all
```

## 4. go build
go build命令用于Go源码构建。go build 还提供了很多命令行标志选项，这些标志选项可用于
1. 对构建过程出现的问题进行辅助诊断
2. 定制构建
3. 向编译器/链接器传递参数

### 4.1 go build -x -v
-v 用于输出当前正在编译的包，-x 用于输出go build执行的每一个命令。

go build执行命令的顺序大致如下：
1. 创建用于构建的临时目录；
2. 下载构建module s依赖的module t和u；
3. 分别编译module t和u，将编译后的结果存储到临时目录及GOCACHE目录下；
4. 编译module s；
5. 定位和汇总module s的各个依赖包构建后的目标文件（.a文件）的位置，形成importcfg.link文件，供后续链接器使用；
6. 链接成可执行文件；
7. 清理临时构建环境。

go build 过程会调用
1. `go tool compile`: `$GOROOT/pkg/tool/linux_amd64/compile`) 包编译
2. `go tool link`: `$GOROOT/pkg/tool/linux_amd64/link` 最终的链接

编译及链接命令中的每个标志选项都会对最终结果产生影响，比如：-goversion的值会影响Go编译器的行为，而这个值可能来自go.mod中的Go版本指示标记。

#### 4.2 go build -a
-a 强制重新构建所有包。传入-a选项后，go build就会忽略掉所有缓存机制，忽略掉已经安装到$GOPATH/pkg下的依赖包库文件（.a）从头构建。

go build 在 gopath 模式下比较常用，在module-aware模式下，go module 支持可重建，并且缓存由 go 工具自动管理，很少有人去改动，所以 go build -a变得很少用。

### 4.3 go build -race
-race命令行选项会在构建的结果中加入竞态检测的代码。在程序运行过程中，如果发现对数据的并发竞态访问，这些代码会给出警告，这些警告信息可以用来辅助后续查找和解决竞态问题。不过由于插入竞态检测的代码这个动作，带有-race的构建过程会比标准构建略慢一些。

Go社区的一个最佳实践是在正式发布到生产环境之前的调试、测试环节使用带有-race构建选项构建出的程序，以便于在正式发布到生产环境之前尽可能多地发现程序中潜在的并发竞态问题并快速将其解决。

### 4.4 go build -gcflags
go build 实质上是通过调用Go自带的compile工具（以Linux系统为例，该工具对应的是`$GOROOT/pkg/tool/linux_amd64/compile`）对Go代码进行编译的。

go build可以经由`-gcflags`向compile工具传递编译所需的命令行标志选项集合。

```bash
go build -gcflags[=标志应用的包范围]='空格分隔的标志选项列表'

go build -gcflags='-N -l'      # 仅将传递的编译选项应用于当前包
go build -gcflags=all='-N -l'  # 将传递的编译选项应用于当前包及其所有依赖包
go build -gcflags=std='-N -l'  # 仅将传递的编译选项应用于标准库包

# 一些选项还具有级别属性，即支持设定选项的作用级别或输出信息内容的详尽级别
go build -gcflags='-m'
go build -gcflags='-m -m'      // 输出比上一条命令更为详尽的逃逸分析过程信息
go build -gcflags='-m=2'       // 与上一条命令等价
go build -gcflags='-m -m -m'   // 输出最为详尽的逃逸分析过程信息
go build -gcflags='-m=3'       // 与上一条命令等价
```

“标志应用的包范围”是可选项
1. 如果不显式填写，那么Go编译器仅将通过gcflags传递的编译选项应用在当前包；
2. 如果显式指定了包范围，则通过gcflags传递的编译选项不仅会应用在当前包的编译上，还会应用于包范围指定的包上。

命令行标志选项是传递给Go编译器的，比较重要的是
1. -l：关闭内联。
2. -N：关闭代码优化。
3. -m：输出逃逸分析（决定哪些对象在栈上分配，哪些对象在堆上分配）的分析决策过程。
4. -S：输出汇编代码。

#### 编译选项参数集合
执行 `go tool compile -help` 可以查看所有能传递给编译器的选项集合:

```bash
$ go tool compile -help
usage: compile [options] file.go...
  -% int
    	debug non-static initializers
  -+	compiling runtime
  -B	disable bounds checking
  -C	disable printing of columns in error messages
  -D path
    	set relative path for local imports
  -E	debug symbol export
  -G	accept generic code (default 3)
  -I directory
    	add directory to import search path
  -K	debug missing line numbers
  -L	show full file names in error messages
  -N	disable optimizations
  -S	print assembly listing
  -V	print version and exit
  -W	debug parse tree after type checking
  -asan
    	build code compatible with C/C++ address sanitizer
  -asmhdr file
    	write assembly header to file
  -bench file
    	append benchmark times to file
  -blockprofile file
    	write block profile to file
  -buildid id
    	record id as the build id in the export metadata
  -c int
    	concurrency during compilation (1 means no concurrency) (default 1)
  -clobberdead
    	clobber dead stack slots (for debugging)
  -clobberdeadreg
    	clobber dead registers (for debugging)
  -complete
    	compiling complete package (no C or assembly)
  -cpuprofile file
    	write cpu profile to file
  -d value
    	enable debugging settings; try -d help
  -dwarf
    	generate DWARF symbols (default true)
  -dwarfbasentries
    	use base address selection entries in DWARF (default true)
  -dwarflocationlists
    	add location lists to DWARF in optimized mode (default true)
  -dynlink
    	support references to Go symbols defined in other shared libraries
  -e	no limit on number of errors reported
  -embedcfg file
    	read go:embed configuration from file
  -gendwarfinl int
    	generate DWARF inline info records (default 2)
  -goversion string
    	required version of the runtime
  -h	halt on error
  -importcfg file
    	read import configuration from file
  -importmap definition
    	add definition of the form source=actual to import map
  -installsuffix suffix
    	set pkg directory suffix
  -j	debug runtime-initialized variables
  -json string
    	version,file for JSON compiler/optimizer detail output
  -l	disable inlining
  -lang string
    	Go language version source code expects
  -linkobj file
    	write linker-specific object to file
  -linkshared
    	generate code that will be linked against Go shared libraries
  -live
    	debug liveness analysis
  -m	print optimization decisions
  -memprofile file
    	write memory profile to file
  -memprofilerate rate
    	set runtime.MemProfileRate to rate
  -msan
    	build code compatible with C/C++ memory sanitizer
  -mutexprofile file
    	write mutex profile to file
  -nolocalimports
    	reject local (relative) imports
  -o file
    	write output to file
  -p path
    	set expected package import path
  -pack
    	write to file.a instead of file.o
  -r	debug generated wrappers
  -race
    	enable race detector
  -shared
    	generate code that can be linked into a shared library
  -smallframes
    	reduce the size limit for stack allocated objects
  -spectre list
    	enable spectre mitigations in list (all, index, ret)
  -std
    	compiling standard library
  -symabis file
    	read symbol ABIs from file
  -t	enable tracing for debugging the compiler
  -traceprofile file
    	write an execution trace to file
  -trimpath prefix
    	remove prefix from recorded source file paths
  -v	increase debug verbosity
  -w	debug type checking
  -wb
    	enable write barrier (default true)
```

### 4.5 go build -ldflags
go build 也支持通过-ldflags 为链接器（以Linux系统为例，该工具对应的是`$GOROOT/pkg/tool/linux_amd64/link`）传递链接选项集合。

```bash
go build -ldflags='空格分隔的标志选项列表'
go build -ldflags "-X main.version=v0.7.0 -s -w" -o linker_x_flag_without_symboltable_and_dwarf linker_x_flag.go
```

其中比较常用的有:
1. -X: 设定包中string类型变量的值（仅支持string类型变量）
2. -s：不生成符号表（symbol table）
3. -w：不生成DWARF（Debugging With Attributed Record Formats）调试信息

默认情况下，go build构建出的可执行二进制文件中都是包含符号表和DWARF格式的调试信息的，这虽然让最终二进制文件的体积增加了，但是符号表和调试信息对于生产环境下程序异常时的现场保存和在线调试都有着重要意义。但如果你不在意这些信息或者对应用的大小十分敏感，那么可以通过-s和-w选项将符号表和调试信息从最终的二进制文件中剔除。

#### -X
通过-X选项，我们可以在编译链接期间动态地为程序中的字符串变量进行赋值，这个选项的一个典型应用就是在构建脚本中设定程序的版本值。

我们通常会为应用程序添加version命令行标志选项，用来输出当前程序的版本信息，就像Go自身那样：

```bash
$go version
go version go1.14 darwin/amd64
```

如果将版本信息写死到程序代码中，显然不够灵活，耦合太紧。而将版本信息在程序构建时注入则是一个不错的方案。-X选项就可以用来实现这个方案：

```go
var (
    version string
)

func main() {
    if os.Args[1] == "version" {
        fmt.Println("version:", version)
        return
    }
}

// 构建这个程序，在构建时为version这个string类型变量动态地注入新值：
$go build -ldflags "-X main.version=v0.7.0" linker_x_flag.go
$./linker_x_flag version
version: v0.7.0
```

#### 链接选项参数集合
执行 `go tool link -help` 可以查看所有能传递给链接的选项集合:

```bash
$ go tool link -help
usage: link [options] main.o
  -B note
    	add an ELF NT_GNU_BUILD_ID note when using ELF
  -E entry
    	set entry symbol name
  -H type
    	set header type
  -I linker
    	use linker as ELF dynamic linker
  -L directory
    	add specified directory to library path
  -R quantum
    	set address rounding quantum (default -1)
  -T address
    	set text segment address (default -1)
  -V	print version and exit
  -X definition
    	add string value definition of the form importpath.name=value
  -a	no-op (deprecated)
  -asan
    	enable ASan interface
  -aslr
    	enable ASLR for buildmode=c-shared on windows (default true)
  -benchmark string
    	set to 'mem' or 'cpu' to enable phase benchmarking
  -benchmarkprofile base
    	emit phase profiles to base_phase.{cpu,mem}prof
  -buildid id
    	record id as Go toolchain build id
  -buildmode mode
    	set build mode
  -c	dump call graph
  -compressdwarf
    	compress DWARF if possible (default true)
  -cpuprofile file
    	write cpu profile to file
  -d	disable dynamic executable
  -debugtextsize int
    	debug text section max size
  -debugtramp int
    	debug trampolines
  -dumpdep
    	dump symbol dependency graph
  -extar string
    	archive program for buildmode=c-archive
  -extld linker
    	use linker when linking in external mode
  -extldflags flags
    	pass flags to external linker
  -f	ignore version mismatch
  -g	disable go package data checks
  -h	halt on error
  -importcfg file
    	read import configuration from file
  -installsuffix suffix
    	set package directory suffix
  -k symbol
    	set field tracking symbol
  -libgcc string
    	compiler support lib for internal linking; use "none" to disable
  -linkmode mode
    	set link mode
  -linkshared
    	link against installed Go shared libraries
  -memprofile file
    	write memory profile to file
  -memprofilerate rate
    	set runtime.MemProfileRate to rate
  -msan
    	enable MSan interface
  -n	dump symbol table
  -o file
    	write output to file
  -pluginpath string
    	full path name for plugin
  -r path
    	set the ELF dynamic linker search path to dir1:dir2:...
  -race
    	enable race detector
  -s	disable symbol table
  -strictdups int
    	sanity check duplicate symbol contents during object file reading (1=warn 2=err).
  -tmpdir directory
    	use directory for temporary files
  -v	print link trace
  -w	disable DWARF generation

```

### 4.5 go build -tags
go build 可以通过 -tags 指定构建的约束条件，以决定哪些源文件被包含在包内进行构建。tags的值为一组逗号分隔（老版本为空格分隔）的值：

```bash
$go build -tags="tag1,tag2,..." ...
```
与tags值列表中的tag1、tag2等呼应的则是 **Go源文件中的build tag（亦称为build constraint）**，下面是标准库os包的file_unix.go源文件中build tag的格式：

```go
// +build aix darwin dragonfly freebsd js,wasm linux netbsd openbsd solaris

package os
```
可以看到Go源文件中的build tag实际上就是某种特殊形式的注释:
1. 它通常放在Go源文件的顶部区域，以一行注释或连续的（中间无空行）多行注释形式存在。
2. build tag与前后的包注释或包声明语句的中间要有一行空行。
3. build tag 以+build作为起始标记，与前面的注释符号//中间有一个空格
4. +build后面就是约束标记字符串，比如上面例子中的aix、darwin等。每一行的build tag实质上会被求值为一个布尔表达式。

下图是 Go 源文件中 build tag 布尔表达式的求值规则

![Go 源文件中 build tag 布尔表达式的求值规则](/images/go/expert/go_build_tag.png)

当一个Go源文件带有build tag时()，只有当该组tag被求值为true时，该源文件才会被包含入对应的包中参与构建。如果文件没有带 build tag 不会走这个判断逻辑，默认即包含。

## 5. 运行与诊断
Go 原生提供了一些环境变量，这些环境变量可以影响Go程序运行时的行为并输出Go运行时的一些信息以辅助在线诊断Go程序的问题。这也可以算作性能剖析（profiling）、调试（debug）手段之外的程序诊断辅助手段。我们来看看其中几个重要的环境变量:

### 5.1 GOMAXPROCS
- 作用: 可用于设置Go程序启动后的逻辑处理器P的数量，如果每个P都绑定一个操作内核线程，那么该值将决定有多少个内核线程一起并行承载该Go程序的业务运行
- 默认: Go 1.5版本将GOMAXPROCS默认值调整为CPU核数，通常无需调整

### 5.2 GOGC
除了显式调用 `runtime.GC` 强制运行GC，Go还提供了一个可以调节GC触发时机的环境变量：GOGC。

GOGC是一个整数值
1. 默认为100。这个值代表一个比例值，100表示100%。
2. 这个比例值的分子是**上一次GC结束后到当前时刻新分配的堆内存大小（设为M）**
3. 分母则是**上一次GC结束后堆内存上的活动对象内存数据（live data，可达内存）的大小（设为N）**。
4. Go运行时实时监控当前堆内存状态，如果当前堆内存的N/M的值等于GOGC/100，则会再次触发运行GC

![GC触发条件之一](/images/go/expert/gc.png)

#### STW垃圾回收器
在早期版本中，Go使用的是STW垃圾回收器，即每次触发GC后，都要先停止程序（Stop The World），然后GC进行标记（mark）和清除（sweep）操作，GC完成后再恢复程序的运行。每次GC完成后堆上的内存都是标记的活动对象，Go 运行可以准确的计算出 N/M 的比值。

#### 三色标记圾回收器
在1.5版本中，Go抛弃了GC延迟过大且无法扩展的STW垃圾回收器，引入了基于三色标记清除的并发垃圾回收器。并发垃圾回收器与用户程序一起执行带来了GC延迟的大幅下降，但也导致了Go运行时无法精确控制堆内存大小，因为在并发标记过程中，只要没有停止程序，用户程序就可以继续分配内存。

计算新分配内存时不仅要考虑**两次GC之间用户程序请求分配的内存**，还要考虑新一轮GC开始后的**并发标记过程中**用户新分配的内存:

![并发垃圾回收器触发新一轮GC的条件](/images/go/expert/gc_tree.png)

于是新一轮GC被提前启动了，而启动的新一轮GC的目标值（goal）为：

goal = 上一轮GC后的堆活动内存大小×(GOGC/100+1)

显然一轮GC结束时的堆大小与该轮GC的目标期望值goal越接近说明GC启动的时机越好，对并发标记过程内存分配的估计越准确。那么究竟该提前多久启动新一轮GC呢？这是由Go并发垃圾回收的Pacing算法决定的。

### 5.2 GODEBUG=gctrace=1
设置环境变量 GODEBUG='gctrace=1' 可以让 GO 运行时在每次GC执行时输出此次GC相关的跟踪信息。

```bash
$go build -o gctrace gctrace.go
$GODEBUG='gctrace=1' GOGC=100 ./gctrace
gc 1 @0.008s 3%: 0.005+2.7+0.017 ms clock, 0.042+0.056/3.6/3.7+0.14 ms cpu, 5->5->4 MB, 6 MB goal, 8 P
gc 2 @0.028s 5%: 0.007+8.4+0.024 ms clock, 0.057+0.074/11/11+0.19 ms cpu, 9->9->8 MB, 10 MB goal, 8 P
gc 3 @0.067s 5%: 0.005+14+0.023 ms clock, 0.040+0.38/19/18+0.18 ms cpu, 19->19->16 MB, 20 MB goal, 8 P
gc 4 @0.141s 6%: 0.011+25+0.021 ms clock, 0.093+0.26/46/82+0.17 ms cpu, 38->38->33 MB, 39 MB goal, 8 P
gc 5 @0.256s 6%: 0.003+34+0.016 ms clock, 0.031+0.40/67/61+0.13 ms cpu, 77->77->66 MB, 78 MB goal, 8 P
gc 6 @0.448s 6%: 0.004+58+0.017 ms clock, 0.033+0.49/113/185+0.14 ms cpu, 154->154->133 MB, 155 MB goal, 8 P
gc 7 @0.868s 6%: 0.004+116+0.017 ms clock, 0.032+0.64/231/574+0.13 ms cpu, 307->308->266 MB, 308 MB goal, 8 P
gc 8 @1.793s 7%: 0.003+368+0.016 ms clock, 0.025+0.95/734/1812+0.13 ms cpu, 615->616->533 MB, 616 MB goal, 8 P
gc 9 @3.715s 7%: 0.003+692+0.021 ms clock, 0.028+34/1384/3436+0.17 ms cpu, 1231->1232->1066 MB, 1232 MB goal, 8 P
```

### 5.3 GODEBUG=schedtrace=1000
Go提供了调度器当前状态的查看方法：使用Go运行时环境变量GODEBUG。

```shell
$ GODEBUG=schedtrace=1000 godoc -http=:6060
SCHED 0ms: gomaxprocs=4 idleprocs=3 threads=3 spinningthreads=0 idlethreads=0 runqueue=0 [0 0 0 0]
SCHED 1001ms: gomaxprocs=4 idleprocs=0 threads=9 spinningthreads=0 idlethreads=3 runqueue=2 [8 14 5 2]
SCHED 2006ms: gomaxprocs=4 idleprocs=0 threads=25 spinningthreads=0 idlethreads=19 runqueue=12 [0 0 4 0]
SCHED 3006ms: gomaxprocs=4 idleprocs=0 threads=26 spinningthreads=0 idlethreads=8 runqueue=2 [0 1 1 0]
SCHED 4010ms: gomaxprocs=4 idleprocs=0 threads=26 spinningthreads=0 idlethreads=20 runqueue=12 [6 3 1 0]
```

GODEBUG 通过给其传入不同的key1=value1, key2=value2, …组合，Go的运行时会输出不同的调试信息，比如在这里我们给GODEBUG传入了"schedtrace=1000"，其含义就是每1000ms打印输出一次goroutine调度器的状态，每次一行。以上面例子中最后一行为例，每一行各字段含义如下：
1. SCHED：调试信息输出标志字符串，代表本行是goroutine调度器相关信息的输出。
2. 6016ms：从程序启动到输出这行日志经过的时间。
3. gomaxprocs：P的数量。
4. idleprocs：处于空闲状态的P的数量。通过gomaxprocs和idleprocs的差值，我们就可以知道当前正在执行Go代码的P的数量。
5. threads：操作系统线程的数量，包含调度器使用的M数量，加上运行时自用的类似sysmon这样的线程的数量。
6. spinningthreads：处于自旋（spin）状态的操作系统数量。
7. idlethread：处于空闲状态的操作系统线程的数量。
8. runqueue=1：Go调度器全局运行队列中G的数量。
9. [3 4 0 10]：分别为4个P的本地运行队列中的G的数量。


还可以输出每个goroutine、M和P的详细调度信息（对于Gopher来说，在大多数情况下这是不必要的）：

```bash
$ GODEBUG=schedtrace=1000,scheddetail=1 godoc -http=:6060
```

### 5.4 GODEBUG=asyncpreemptoff=1 
Go长期以来不支持真正的抢占式调度，下面的代码是一个典型例子：

```go
func deadloop() {
    for {
    }
}

func main() {
    runtime.GOMAXPROCS(1)
    go deadloop()
    for {
        time.Sleep(time.Second * 1)
        fmt.Println("I got scheduled!")
    }
}
```

在只有一个P（GOMAXPROCS=1）的情况下，上面代码中deadloop函数所在的goroutine将持续占据该P，使得main goroutine中的代码得不到调度，我们无法看到“I got scheduled!”字样输出。这是因为**Go 1.13及以前版本的抢占是协作式的，只在有函数调用的地方才能插入抢占代码（埋点）**，而deadloop没有给编译器插入抢占代码的机会。Go 1.14版本增加了基于系统信号的异步抢占调度，这样上面的deadloop所在的goroutine也可以被抢占了。

由于系统信号可能在代码执行到任意地方发生，在Go运行时能顾及的地方，Go运行时自然会处理好这些系统信号。**但如果你是通过syscall包或golang.org/x/sys/unix在Unix/Linux/macOS上直接进行系统调用，那么一旦在系统调用执行过程中进程收到系统中断信号，这些系统调用就会失败，并以EINTR错误返回，尤其是低速系统调用，包括读写特定类型文件（管道、终端设备、网络设备）、进程间通信等。在这样的情况下，我们就需要自己处理EINTR错误。最常见的错误处理方式是重试。对于可重入的系统调用来说，在收到EINTR信号后的重试是安全的。如果你没有自己调用syscall包，那么异步抢占调度对你已有的代码几乎无影响**。

相反，当异步抢占调度对你的代码有影响，并且你还没法及时修正时，可以通过GODEBUG= asyncpreemptoff=1关闭这一新增的特性。

```go
$GODEBUG=asyncpreemptoff=1 go run preemption_scheduler.go // 这里不会输出I got scheduled!
```

随着Go的演进，GODEBUG的取值还在增加和变化中，其最新更新可参见[GODEBUG 取值](https://tip.golang.org/pkg/runtime/#hdr-Environment_Variables)。

## 6. go vet
go vet是官方Go工具链提供的静态代码检查工具，相比于编译器关注语法层面的正确性，go vet 在语义层面尝试发现潜在问题。

go vet 内置了多条静态代码检查规则:
1. assign规则：检查代码中是否有无用的赋值操作m，比如 x = x
2. atomic规则：检查代码中是否有对sync.atomic包中函数的误用情况
3. bools规则：检查代码中是否存在对布尔操作符的误用情况
4. buildtag规则：检查源文件中+build tag是否正确定义
5. composites规则：检查源文件中是否有未使用“field:value”格式的复合字面值形式对struct类型变量进行值构造的问题
6. copylocks规则：检查源文件中是否存在lock类型变量的按值传递问题
7. loopclosure规则：检查源文件中是否存在循环内的匿名函数引用循环变量的问题。
8. unmarshal规则：检查源码中是否有将非指针或非接口类型值传给unmarshal的问题
9. unsafeptr规则：检查源码中是否有非法将uintptr转换为unsafe.Pointer的问题

可以通过`go tool vet help`查看更多检查规则。默认情况下，go vet内置的所有检查规则均开启：
```bash
# go tool vet help
vet is a tool for static analysis of Go programs.

vet examines Go source code and reports suspicious constructs,
such as Printf calls whose arguments do not align with the format
string. It uses heuristics that do not guarantee all reports are
genuine problems, but it can find errors not caught by the compilers.

Registered analyzers:

    asmdecl      report mismatches between assembly files and Go declarations
    assign       check for useless assignments
    atomic       check for common mistakes using the sync/atomic package
    bools        check for common mistakes involving boolean operators
    buildtag     check that +build tags are well-formed and correctly located
    cgocall      detect some violations of the cgo pointer passing rules
    composites   check for unkeyed composite literals
    copylocks    check for locks erroneously passed by value
    errorsas     report passing non-pointer or non-error values to errors.As
    framepointer report assembly that clobbers the frame pointer before saving it
    httpresponse check for mistakes using HTTP responses
    ifaceassert  detect impossible interface-to-interface type assertions
    loopclosure  check references to loop variables from within nested functions
    lostcancel   check cancel func returned by context.WithCancel is called
    nilfunc      check for useless comparisons between functions and nil
    printf       check consistency of Printf format strings and arguments
    shift        check for shifts that equal or exceed the width of the integer
    sigchanyzer  check for unbuffered channel of os.Signal
    stdmethods   check signature of methods of well-known interfaces
    stringintconv check for string(int) conversions
    structtag    check that struct field tags conform to reflect.StructTag.Get
    testinggoroutine report calls to (*testing.T).Fatal from goroutines started by a test.
    tests        check for common mistaken usages of tests and examples
    unmarshal    report passing non-pointer or non-interface values to unmarshal
    unreachable  check for unreachable code
    unsafeptr    check for invalid conversions of uintptr to unsafe.Pointer
    unusedresult check for unused results of calls to some functions

# 手动关闭其中一个或几个规则
$go vet -printf=false -buildtag=false vet_printf.go

# 如果显式开启某些检查，则其他检查规则将不生效
# 仅开启 buildtag 检查，其他检查均不开启
$go vet -buildtag=true vet_printf.go
```

### 6.1 第三方linter聚合：golangci-lint
第三方lint工具是对官方go vet工具的一个很好的补充。golangci-lint聚合了几十种Go lint工具，但默认仅开启如下几种。
1. deadcode：查找代码中的未用代码。
2. errcheck：检查代码中是否存在未处理的错误。
3. gosimple：专注于发现可以进一步简化的代码的lint工具。
4. govet：go官方工具链中的vet工具。
5. ineffassign：检查源码中是否存在无效赋值的情况（赋值了，但没有使用）。
6. staticcheck：通用型lint工具，增强的“go vet”，对代码进行很多go vet尚未进行的静态检查。
7. structcheck：查找未使用的结构体字段。
8. typecheck：像Go编译器前端那样去解析Go代码并进行类型检查。
9. unused：检查源码中是否存在未使用的常量、变量、函数和类型。
10. varcheck：检查源码中是否存在未使用的全局变量和常量。

除了上述默认开启的lint工具，我们还可以通过golangci-lint linters命令查看所有内置lint工具列表，包括默认不开启的。

```bash
# 1. 安装
go install  github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# 2. 开启或关闭特定检查
# 仅开启staticcheck
$golangci-lint linters --disable-all -E staticcheck

# 在默认开启的lint工具集合的基础上，再额外开启bodyclose和dupl
$golangci-lint linters -E bodyclose,dupl 

# 关闭unused和varcheck
$golangci-lint linters -D unused,varcheck

# 3. 执行检查
# 仅对当前目录下的vet_assign.go源文件进行staticcheck检查
$golangci-lint run --disable-all -E staticcheck vet_assign.go

# 对当前路径下的Go包进行默认lint工具集合的检查
$golangci-lint run

# 对当前路径及其子路径（递归）下的所有Go包进行默认开启的lint工具集合检查以及额外的dupl工具检查
$golangci-lint run -E dupl ./...
```

## 7. 重构

## 8. go doc
### 8.1 go doc 命令
go doc在命令行上接受的参数使用了Go语法的格式:

```go
go doc <pkg>
go doc <sym>[.<methodOrField>]
go doc [<pkg>.]<sym>[.<methodOrField>]
go doc [<pkg>.][<sym>.]<methodOrField>

// 查看标准库文档
go doc net/http
go doc net/http.Request.Form

// 查看当前路径下的包的文档：
$go doc
// 查看当前路径下包的导出元素的文档：
$go doc CmppActiveTestReqPktLen
// 通过-u选项，我们也可以查看当前路径下包的非导出元素的文档：
$go doc -u newPacketWriter

// 查看源码
go doc -src fmt.Printf
```

### 6.1 godoc 的Web化的文档中心

```go
// 查看当前版本文档
$godoc -http=localhost:6060

// 查看旧版本 go 文档
$godoc -goroot /Users/tonybai/.bin/go1.9 -http=localhost:6060
```

### 8.3 查看 go 官方博客
```go
$go get golang.org/x/blog

// Go官方博客单独存放在github.com/golang/blog仓库下，需要先将该仓库下载到本地，再切换到该路径下来启动blog服务程序
$git clone https://github.com/golang/blog.git
$cd blog
$blog

2020/10/31 05:14:47 Listening on addr localhost:8080
```

### 8.4 查看present格式文档
```go
go get golang.org/x/tools/cmd/present
$git clone https://github.com/golang/talks.git
$cd talks
$present
```