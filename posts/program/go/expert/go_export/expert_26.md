---
weight: 1
title: "Go generate"
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

## 1. go generate 
### 1.1 简介
项目构建，通常我们会依赖一些构建管理工具，比如shell脚本、make等。通过 make 我们可以在编译和构建 Go 代码之前，完成诸如 protobuf 文件生成等等编译代码所需要的前置动作。不过，Go 1.4 版本的Go工具链中增加了在构建之前驱动执行前置动作的能力，这就是go generate命令。我们看下面这个示例:

```go
package main

import (
    "fmt"
    msg "github.com/bigwhite/protobuf-demo/msg"
)

// 预先“埋”在代码中的可以被go generate命令识别的指示符（directive），指示符中的命令将被go generate识别并被驱动执行
//go:generate protoc -I ./IDL msg.proto --gofast_out=./msg
func main() {
    var m = msg.Request{
        MsgID:  "xxxx",
        Field1: "field1",
        Field2: []string{"field2-1", "field2-2"},
    }
    fmt.Println(m)
}
```

执行 go generate 时:

```bash
$go generate -x -v
main.go
protoc -I ./IDL msg.proto --gofast_out=./msg
```

### 1.2 原理
go generate命令比较独立，不能指望go build、go run或go test等命令可以在后台调用go generate驱动前置指令的执行，go generate命令需要在go build这类命令之前单独执行以生成后续命令需要的Go源文件等。

go generate并不会按Go语法格式规范去解析Go源码文件，它只是将Go源码文件当成普通文本读取并识别其中可以与下面字符串模式匹配的内容（go generate指示符）：
1. `//go:generate command arg...`
2. **注意，注释符号//前面没有空格，与go:generate之间亦无任何空格**。

上面的go generate指示符可以放在Go源文件中的任意位置，并且一个Go源文件中可以有多个go generate指示符，go generate命令会按其出现的顺序逐个识别和执行：

```go
//go:generate echo "top"
package main

import "fmt"

//go:generate echo "middle"
func main() {
    fmt.Println("hello, go generate")
}

//go:generate echo "tail"

$go generate multi_go_generate_directive.go
top
middle
tail
```

go generate在处理子路径下的包时，其执行命令时的**当前工作路径已经切换到该包的路径**，因此在go generate指示符中使用相对路径时首先要明确当前的工作路径。

### 1.3 执行范围控制
go generate可接受的不同参数形式，用于限定 go generate 执行范围:

```go
// 传入某个文件
$go generate -x -v main.go

// 传入当前module，匹配到module的main package且仅处理该main package的源文件
$go generate -x -v

// 传入本地路径，匹配该路径下的包的所有源文件
$go generate -x -v ./subpkg1

// 传入包，由于是module的根路径，因此只处理该module下的main包
$go generate -x -v github.com/bigwhite/generate-args-demo

// 传入包，处理subpkg1包下的所有源文件
$go generate -x -v github.com/bigwhite/generate-args-demo/subpkg1

// 传入./...模式，匹配当前路径及其子路径下的所有包
$go generate -x -v ./...
```

go generate还可以通过-run使用正则式去匹配各源文件中go generate指示符中的命令，并仅执行匹配成功的命令：

```go
$go generate -x -v -run "protoc" ./...
```

### 1.4 应用场景
go generate目前主要用在目标构建之前驱动代码生成动作的执行，比如:
1. 基于protobuf定义文件（*.proto）生成Go源码文件
2. 利用stringer工具（go get golang.org/x/tools/cmd/stringer）自动生成枚举类型的String方法
3. 利用go-bindata工具（go get -u github.com/go-bindata/go-bindata/...）将数据文件嵌入Go源码中

#### 自动生成枚举类型的String方法

```go
type Weekday int

const (
    Sunday Weekday = iota
    Monday
    Tuesday
    Wednesday
    Thursday
    Friday
    Saturday
)

//go:generate stringer -type=Weekday
func main() {
    var d Weekday
    fmt.Println(d)
    fmt.Println(Weekday(1))
}


// 接下来利用go generate驱动生成代码：
$go generate main.go
$cat weekday_string.go

```

#### 将从静态资源文件数据到Go源码的转换
在Web开发领域，Gopher希望将一些静态资源文件（比如CSS文件等）嵌入最终的二进制文件中一起发布和部署。而go generate结合go-bindata工具（https://github.com/go-bindata/go-bindata）常被用于实现这一功能。Go 1.16版本内置了静态文件嵌入（embedding）功能，我们可以直接在Go源码中通过跑[go:embed指示符](https://pkg.go.dev/embed)将静态资源文件嵌入，无须再使用本方法。

```go
//go:generate go-bindata -o static.go static/img/go-mascot.jpg

func main() {
    // 注意路径 
    data, err := Asset("static/img/go-mascot.jpg")
    if err != nil {
        fmt.Println("Asset invoke error:", err)
        return
    }

    http.HandleFunc("/", func(w http.ResponseWriter, req *http.Request) {
        w.Write(data)
    })

    http.ListenAndServe(":8080", nil)
}
```
