---
weight: 1
title: "gRPC 插件"
date: 2021-06-23T22:00:00+08:00
lastmod: 2021-06-23T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Protobuf 入门"
featuredImage: 

tags: ["go grpc", "python grpc"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

前面我们以一个示例，简单介绍了，go/python gRPC 生成的代码。今天我们来聊聊 gRPC 的插件机制。毕竟所有语言的 gRPC 代码都是通过 gRPC 插件生成的。

## 1. gRPC 插件执行过程
代码生成的命令如下:

```Makefile
API_PROTO_FILES=$(shell find api -name *.proto)

.PHONY: api
# generate api proto
golang:
	protoc --proto_path=./protobuf \
	       --proto_path=../third_party \
 	       --go_out=paths=source_relative:./golang/api \
 	       --go-http_out=paths=source_relative:./golang/api \
 	       --go-grpc_out=paths=source_relative:./golang/api \
 	       --openapi_out==paths=source_relative:./golang \
	       $(API_PROTO_FILES)
```
--go_out，--go-http_out 等等调用的都是 grpc 的插件，protoc 在编译 Protobuf 文件时会分别调用 protoc-gen-go，protoc-gen-go-http 命令。

不同的插件会生成的不同的结果文件，这里:
1. --go_out 调用 protoc-gen-go 生成一个 helloword.pb.go 文件，里面会包含所有由 message 关键字定义而生成的 go struct 结构代码
2. --go-grpc_out 调用 protoc-gen-go-grpc 生成一个 helloword_grpc.pb.go 文件，里面则包含所有由 service 关键字定义而生成的 grpc 服务相关代码
3. --go-http_out 调用 protoc-gen-go-http 生成一个 helloword_http.pb.go，里面包含所有由 `option (google.api.http)` 定义而生成 http 服务相关代码。

当protoc 执行命令的时候，插件解析步骤如下

1. protoc 解析 proto 文件，类似于AST树的解析，将整个proto文件有用的语法内容提取出来
2. 将解析的结果转为成二进制流，然后传入到protoc-gen-xx标准输入。也就是说protoc 会去程序执行路径去找 protoc-gen-go 这个二进制，将解析结果写入到这个程序的标准输入。如果命令是--go_out，那么找到是protoc-gen-go，如果自己定义一个插件叫xxoo，那么--xxoo_out找到就是protoc-gen-xxoo了
3. protoc-gen-xx 必须实现从标准输入读取上面解析完的二进制流，然后将得到的 proto 信息按照自己的语言生成代码，最后将输出的代码写回到标准输出
4. protoc 接收 protoc-gen-xx的标准输出，然后写入文件

理解 Porotobuf 代码生成的过程，最好的方式就是自己写一个插件，我们就以 [kratos error 代码生成插件](https://github.com/go-kratos/kratos/tree/main/cmd/protoc-gen-go-errors)为例看看如何写一个 go protoc 插件。

## 2. kratos protoc-gen-go-errors
我们先看 main 函数:

```go
package main

import (
	"flag"
	"fmt"

	"google.golang.org/protobuf/compiler/protogen"
	"google.golang.org/protobuf/types/pluginpb"
)

var (
	showVersion = flag.Bool("version", false, "print the version and exit")
	omitempty   = flag.Bool("omitempty", true, "omit if google.api is empty")
)

func main() {
	flag.Parse()
	if *showVersion {
		fmt.Printf("protoc-gen-go-http %v\n", release)
		return
	}
	protogen.Options{
		ParamFunc: flag.CommandLine.Set,
	}.Run(func(gen *protogen.Plugin) error {
		gen.SupportedFeatures = uint64(pluginpb.CodeGeneratorResponse_FEATURE_PROTO3_OPTIONAL)
		for _, f := range gen.Files {
			if !f.Generate {
				continue
			}
			generateFile(gen, f, *omitempty)
		}
		return nil
	})
}
```
protogen.Plugin 包含了 Protobuf 解析完成后的所有信息:

```go
// A Plugin is a protoc plugin invocation.
type Plugin struct {
	// Request is the CodeGeneratorRequest provided by protoc.
	Request *pluginpb.CodeGeneratorRequest

	// Files is the set of files to generate and everything they import.
	// Files appear in topological order, so each file appears before any
	// file that imports it.
	Files       []*File
	FilesByPath map[string]*File

	// SupportedFeatures is the set of protobuf language features supported by
	// this generator plugin. See the documentation for
	// google.protobuf.CodeGeneratorResponse.supported_features for details.
	SupportedFeatures uint64

	fileReg        *protoregistry.Files
	enumsByName    map[protoreflect.FullName]*Enum
	messagesByName map[protoreflect.FullName]*Message
	annotateCode   bool
	pathType       pathType
	module         string
	genFiles       []*GeneratedFile
	opts           Options
	err            error
}
```
gen.Files 中的 File struct 则包含了单个 protoc buf 文件被解析完成后的结果。

```go
// A File describes a .proto source file.
type File struct {
	Desc  protoreflect.FileDescriptor
	Proto *descriptorpb.FileDescriptorProto

	GoDescriptorIdent GoIdent       // name of Go variable for the file descriptor
	GoPackageName     GoPackageName // name of this file's Go package
	GoImportPath      GoImportPath  // import path of this file's Go package

	Enums      []*Enum      // top-level enum declarations
	Messages   []*Message   // top-level message declarations
	Extensions []*Extension // top-level extension declarations
	Services   []*Service   // top-level service declarations

	Generate bool // true if we should generate code for this file

	// GeneratedFilenamePrefix is used to construct filenames for generated
	// files associated with this source file.
	//
	// For example, the source file "dir/foo.proto" might have a filename prefix
	// of "dir/foo". Appending ".pb.go" produces an output file of "dir/foo.pb.go".
	GeneratedFilenamePrefix string

	location Location
}
```

grpc 支持的所有语言为了便于开发者，开发出特定语言的插件，都会把整个解析过程封装成一个库，上面介绍的就是 Go 语言所作的封装。而大多数情况下，业务的开发者所需要的就是拿到上面解析后的对象，按照业务规则生成自己所需要的代码即可。就像示例中 generateFile 所作的工作一样。

```go
// generateFile generates a _errors.pb.go file containing kratos errors definitions.
func generateFile(gen *protogen.Plugin, file *protogen.File) *protogen.GeneratedFile {
	if len(file.Enums) == 0 {
		return nil
	}
	filename := file.GeneratedFilenamePrefix + "_errors.pb.go"
	g := gen.NewGeneratedFile(filename, file.GoImportPath)
	g.P("// Code generated by protoc-gen-go-errors. DO NOT EDIT.")
	g.P()
	g.P("package ", file.GoPackageName)
	g.P()
	g.QualifiedGoIdent(fmtPackage.Ident(""))
	generateFileContent(gen, file, g)
	return g
}
```

g.P() 会把参数输出到标准输出，这些标准输出会被  protoc 捕获并写入到生成 pb 文件中。生成得核心代码则通常使用 template 完成。

