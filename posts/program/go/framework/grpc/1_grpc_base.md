---
weight: 1
title: "gRPC 使用基础"
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

## 1. 简介
这个系列我们来学习 gRPC。gRPC是Google公司基于Protobuf开发的跨语言的开源RPC框架。支持跨语言。每个语言都有自己的私有 rpc 实现。比如 Go net/rpc 标准库提供了 rpc 的 go 实现，采用的是 Go语言特有的gob编码。这些私有协议无法实现跨语言，所以并不是很常用。

RPC 大体上包括两个组成部分:
1. 序列化协议
2. 底层的传输协议

gRPC 使用的是 Protobuf + http2。所以接下来我们会按照下面的学习路线学习 gRPC 的使用:
1. 首先我们会准备一个示例，介绍 gRPC python 和 go 的基本使用
2. 然后我们介绍 protobuf 的使用，包括他的基础语法与高阶用法
3. gRPC 的高阶用法，包括认证、元数据传递等等。这一部分我们也会分成 Python 和 Go 语言两个部分，两个部分内容相同，但是各自介绍两个语言不同的实现
4. 最后我们介绍 go gRPC Server 的启动流程。

整个系列参考的资料如下:
grpc 和 protobuf 的官方文档:
1. [grpc 官方文档](https://grpc.io/docs/languages/go/)
2. [grpc 中文文档](https://doc.oschina.net/grpc?t=58008)

python 实现:
3. [grpc examples python](https://github.com/grpc/grpc/tree/master/examples/python)
5. [python interceptors](https://github.com/grpc/proposal/blob/master/L13-python-interceptors.md)

golang 实现:
4. [grpc examples golang](https://github.com/grpc/grpc-go/tree/master/examples)
5. [grpc 超时传递](https://xiaomi-info.github.io/2019/12/30/grpc-deadline/)

整个系列目录:
1. [gRPC 使用基础](./1_grpc_base.md)
2. [protobuf 基础语法](./2_protobuf.md)
3. [python gRPC 用法进阶](./3_advance_usage_python.md)
4. [golang gRPC 用法进阶](./4_advance_usage_go.md)
5. [grpc 插件实现](./5_grpc_plugins.md)
5. [go grpc server](./6_go_grpc_server.md)

## 2. 代码示例
我们先来看看 gRPC/Protobuf 的一个简单示例，代码位于 [grpc/Protobuf示例](https://github.com/hotttao/goalgo/tree/master/grpc)。

### 2.1 代码结构
整个代码的目录结构如下:
1. golang: golang gRPC 的实现目录
2. python: python gRPC 的实现目录
3. protobuf: pb 文件的定义目录
4. Makefile: 包含了，pb 文件编译的脚本，执行 make all 即可生成 golang 和 python 的 grpc 代码

```bash
# 目录结构
$ tree .
├── golang
│   ├── api
│   │   └── helloworld
│   │       ├── helloword_grpc.pb.go
│   │       ├── helloword.pb.go
│   │       ├── stock_grpc.pb.go
│   │       ├── stock_http.pb.go
│   │       └── stock.pb.go
│   ├── client.go
│   ├── openapi.yaml
│   └── server.go
├── Makefile
├── openapi.yaml
├── protobuf
│   └── helloworld
│       ├── helloword.proto
│       └── stock.proto
├── python
│   ├── client.py
│   ├── helloworld
│   │   ├── helloword_pb2_grpc.py
│   │   ├── helloword_pb2.py
│   │   ├── __init__.py
│   │   │   ├── helloword_pb2.cpython-38.pyc
│   │   │   ├── helloword_pb2_grpc.cpython-38.pyc
│   │   │   └── __init__.cpython-38.pyc
│   │   ├── stock_pb2_grpc.py
│   │   └── stock_pb2.py
│   ├── noxfile.py
│   │   └── noxfile.cpython-38.pyc
│   ├── requirements.txt
│   └── server.py
└── README.md
```

### 2.2 环境准备
要想使用 protobuf 和 grpc 首先要安装 protocol compiler，即 protoc，其次需要安装特定语言的代码生成工具。安装的命令如下:

```bash
# 1. 安装 protocol compiler
sudo yum install protobuf-compiler

# 2. 安装 go 语言代码生成插件
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# 3. 安装其他 go grpc 插件
go install github.com/go-kratos/kratos/cmd/kratos/v2@latest
go install github.com/go-kratos/kratos/cmd/protoc-gen-go-http/v2@latest

go get -u github.com/grpc-ecosystem/grpc-gateway/protoc-gen-grpc-gateway
go get -u github.com/grpc-ecosystem/grpc-gateway/protoc-gen-swagger
go install github.com/google/gnostic/cmd/protoc-gen-openapi@latest
go get github.com/mwitkow/go-proto-validators/protoc-gen-govalidators

# 4. 安装 python 语言代码生成插件
pip install -r requirement.txt
# requirement.txt
protobuf==3.18.1
google-api-python-client==2.52.0
grpcio-tools==1.47.0
grpcio==1.47.0
grpcio-health-checking==1.47.0
grpcio-reflection==1.47.0
grpc-interceptor==0.14.2
```

安装脚本中有一些 grpc 插件，先装上后面我们在介绍他们的用法。

## 3. proto 文件
示例中所使用的 helloword.proto 文件，定义如下:

```Proto
syntax = "proto3";

option go_package = "google.golang.org/grpc/examples/helloworld/helloworld";
option java_package = "ex.grpc";
option objc_class_prefix = "HSW";

package hellostreamingworld;

// The greeting service definition.
service Greeter {
  // Sends multiple greetings
  rpc SayHello (HelloRequest) returns (HelloReply) {}
  rpc SayHelloReplyStream (HelloRequest) returns (stream HelloReply) {}
  rpc SayHelloRequestStream (stream HelloRequest) returns (HelloReply) {};
  rpc SayHelloStream (stream HelloRequest) returns (stream HelloReply) {};
}


// The request message containing the user's name and how many greetings
// they want.
message HelloRequest {
  string name = 1;
  string num_greetings = 2;
}

// A response message containing a greeting
message HelloReply {
  string message = 1;
}
```

`service Greeter` 的定义中包含了，gRPC 能使用到的 4 中方法:
1. simple RPC 
2. response-streaming
3. request-streaming RPC
4. bidirectionally-streaming

接下来我们来看看 golang/python 为 gRPC 生成的模板代码。

## 4. gRPC golang 代码解析
golang 生成的模板代码包括:
1. helloword.pb.go: 包含了 pb 文件内，通过 message 字段定义的结构体
2. helloword_grpc.pb.go: 包含了 pb 文件内，通过 service 定义的 gRPC 服务接口、gRPC 服务注册代码以及对应的 client 代码

### 4.1 message 结构体
message 结构代码大体上包括两个部分:
1. struct 结构体定义
2. gRPC 的元数据

#### 结构体定义
以 HelloRequest 为例，生成的结构体定义如下:

```go
type HelloRequest struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	Name         string `protobuf:"bytes,1,opt,name=name,proto3" json:"name,omitempty"`
	NumGreetings string `protobuf:"bytes,2,opt,name=num_greetings,json=numGreetings,proto3" json:"num_greetings,omitempty"`
}

func (x *HelloRequest) Reset() {
	*x = HelloRequest{}
	if protoimpl.UnsafeEnabled {
		mi := &file_helloworld_helloword_proto_msgTypes[0]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *HelloRequest) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*HelloRequest) ProtoMessage() {}

func (x *HelloRequest) ProtoReflect() protoreflect.Message {
	mi := &file_helloworld_helloword_proto_msgTypes[0]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use HelloRequest.ProtoReflect.Descriptor instead.
func (*HelloRequest) Descriptor() ([]byte, []int) {
	return file_helloworld_helloword_proto_rawDescGZIP(), []int{0}
}

func (x *HelloRequest) GetName() string {
	if x != nil {
		return x.Name
	}
	return ""
}

func (x *HelloRequest) GetNumGreetings() string {
	if x != nil {
		return x.NumGreetings
	}
	return ""
}
```
#### 元数据定义
结构体定义容易理解，比较难得是有关 gRPC 的元数据定义，后面我们在解析 gRPC 源码时在详细讲解

### 4.2 service 定义
#### service 定义
```go
// 服务的接口定义
type GreeterServer interface {
	// Sends multiple greetings
	SayHello(context.Context, *HelloRequest) (*HelloReply, error)
	SayHelloReplyStream(*HelloRequest, Greeter_SayHelloReplyStreamServer) error
	SayHelloRequestStream(Greeter_SayHelloRequestStreamServer) error
	SayHelloStream(Greeter_SayHelloStreamServer) error
	mustEmbedUnimplementedGreeterServer()
}
// 服务元数据描述
var Greeter_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "hellostreamingworld.Greeter",
	HandlerType: (*GreeterServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "SayHello",
			Handler:    _Greeter_SayHello_Handler,
		},
	},
	Streams: []grpc.StreamDesc{
		{
			StreamName:    "SayHelloReplyStream",
			Handler:       _Greeter_SayHelloReplyStream_Handler,
			ServerStreams: true,
		},
		{
			StreamName:    "SayHelloRequestStream",
			Handler:       _Greeter_SayHelloRequestStream_Handler,
			ClientStreams: true,
		},
		{
			StreamName:    "SayHelloStream",
			Handler:       _Greeter_SayHelloStream_Handler,
			ServerStreams: true,
			ClientStreams: true,
		},
	},
	Metadata: "helloworld/helloword.proto",
}
// 服务注册
func RegisterGreeterServer(s grpc.ServiceRegistrar, srv GreeterServer) {
	s.RegisterService(&Greeter_ServiceDesc, srv)
}
```

我们需要做的就是实现 GreeterServer 定义的接口实现 protobuf 定义的服务，然后调用 RegisterGreeterServer 把实现的 GreeterServer 服务注册到 gRPC server 中。

让 gRPC server 接收到请求时，这里以 SayHelloStream 的请求为例，就会调用 _Greeter_SayHelloStream_Handler 方法。

```go
func _Greeter_SayHelloStream_Handler(srv interface{}, stream grpc.ServerStream) error {
	return srv.(GreeterServer).SayHelloStream(&greeterSayHelloStreamServer{stream})
}

type Greeter_SayHelloStreamServer interface {
	Send(*HelloReply) error
	Recv() (*HelloRequest, error)
	grpc.ServerStream
}

type greeterSayHelloStreamServer struct {
	grpc.ServerStream
}

func (x *greeterSayHelloStreamServer) Send(m *HelloReply) error {
	return x.ServerStream.SendMsg(m)
}

func (x *greeterSayHelloStreamServer) Recv() (*HelloRequest, error) {
	m := new(HelloRequest)
	if err := x.ServerStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}
```

_Greeter_SayHelloStream_Handler 运行时会调用 GreeterServer.SayHelloStream 并向其传入 Greeter_SayHelloStreamServer，Greeter_SayHelloStreamServer 实现了 request-response 的双向流接口。其他服务的实现类似。

Request Stream 实现的流接口如下:

```go
type Greeter_SayHelloRequestStreamServer interface {
	// 只响应一次
	SendAndClose(*HelloReply) error
	Recv() (*HelloRequest, error)
	grpc.ServerStream
}
```

Response Stream 实现的接口如下:

```go
type Greeter_SayHelloReplyStreamServer interface {
	Send(*HelloReply) error
	grpc.ServerStream
}
```

Simple gRPC 没有 stream 处理逻辑:

```go
func _Greeter_SayHello_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(HelloRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(GreeterServer).SayHello(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/hellostreamingworld.Greeter/SayHello",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(GreeterServer).SayHello(ctx, req.(*HelloRequest))
	}
	return interceptor(ctx, in, info, handler)
}

```

#### client 定义
client 与 server 的定义类似

```go
type GreeterClient interface {
	// Sends multiple greetings
	SayHello(ctx context.Context, in *HelloRequest, opts ...grpc.CallOption) (*HelloReply, error)
	SayHelloReplyStream(ctx context.Context, in *HelloRequest, opts ...grpc.CallOption) (Greeter_SayHelloReplyStreamClient, error)
	SayHelloRequestStream(ctx context.Context, opts ...grpc.CallOption) (Greeter_SayHelloRequestStreamClient, error)
	SayHelloStream(ctx context.Context, opts ...grpc.CallOption) (Greeter_SayHelloStreamClient, error)
}

// greeterClient 就是 GreeterClient 的实现
type greeterClient struct {
	cc grpc.ClientConnInterface
}

func NewGreeterClient(cc grpc.ClientConnInterface) GreeterClient {
	return &greeterClient{cc}
}
```

当请求 SayHelloStream 时，需要调用 greeterClient 的 SayHelloStream 方法:

```go
func (c *greeterClient) SayHelloStream(ctx context.Context, opts ...grpc.CallOption) (Greeter_SayHelloStreamClient, error) {
	stream, err := c.cc.NewStream(ctx, &Greeter_ServiceDesc.Streams[2], "/hellostreamingworld.Greeter/SayHelloStream", opts...)
	if err != nil {
		return nil, err
	}
	x := &greeterSayHelloStreamClient{stream}
	return x, nil
}
```

SayHelloStream 返回的 Greeter_SayHelloStreamClient 是 stream 处理的客户端接口:

```go
type Greeter_SayHelloStreamClient interface {
	Send(*HelloRequest) error
	Recv() (*HelloReply, error)
	grpc.ClientStream
}

type greeterSayHelloStreamClient struct {
	grpc.ClientStream
}

func (x *greeterSayHelloStreamClient) Send(m *HelloRequest) error {
	return x.ClientStream.SendMsg(m)
}

func (x *greeterSayHelloStreamClient) Recv() (*HelloReply, error) {
	m := new(HelloReply)
	if err := x.ClientStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}

```

## 5. gRPC python 代码解析
相比于 go，python 生成的 gRPC 代码就比较简单了，很多代码都是 C/C++ 完成。而且整个 stream 的处理过程也比较简单，这里就不在阐述。