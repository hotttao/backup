---
weight: 1
title: "kratos 简单使用示例"
date: 2021-06-23T22:00:00+08:00
lastmod: 2021-06-23T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "kratos 源码解析之 helloworld 使用示例"
featuredImage: 

tags: ["go 框架"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

这个系列我们来学习 go 微服务里面的一个框架 kratos 由 bilibili 开源。go 现在如火如荼，微服务的框架有很多，能被大家所熟知的基本上都不会差到哪去。学哪个不重要，重要的是学会学懂。深入学习一个框架不仅可以帮助我们理解框架本身，更重要的是能从框架中学习如何写好一个 go 程序。

## 1. 创建一个 kratos 应用
### 1.1 初始化项目
我们先来看看，如何用 kratos 初始化项目，整个过程如下。详细过程可以参考 [kratos 文档](https://go-kratos.dev/docs/getting-started/start/)

```bash
# 1. 安装 kratos 命令行工具
go install github.com/go-kratos/kratos/cmd/kratos/v2@latest

# 2. 安装 go/protoc/protoc-gen-go
sudo yum install protobuf-compiler
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest

# 3. 使用 kratos 初始化一个项目
kratos new helloworld -r https://gitee.com/go-kratos/kratos-layout.git

# 4. go mod 初始化
cd helloworld
go mod download

# 5. 启动示例代码中的 grpc 和 http 服务
kratos run
```

经过上述初始化之后，你就可以得到一个具有如下目录结构的 kratos 项目:

```bash
  .
├── Dockerfile  
├── LICENSE
├── Makefile  
├── README.md
├── api // 下面维护了微服务使用的proto文件以及根据它们所生成的go文件
│   └── helloworld
│       └── v1
│           ├── error_reason.pb.go
│           ├── error_reason.proto
│           ├── error_reason.swagger.json
│           ├── greeter.pb.go
│           ├── greeter.proto
│           ├── greeter.swagger.json
│           ├── greeter_grpc.pb.go
│           └── greeter_http.pb.go
├── cmd  // 整个项目启动的入口文件
│   └── server
│       ├── main.go
│       ├── wire.go  // 我们使用wire来维护依赖注入
│       └── wire_gen.go
├── configs  // 这里通常维护一些本地调试用的样例配置文件
│   └── config.yaml
├── generate.go
├── go.mod
├── go.sum
├── internal  // 该服务所有不对外暴露的代码，通常的业务逻辑都在这下面，使用internal避免错误引用
│   ├── biz   // 业务逻辑的组装层，类似 DDD 的 domain 层，data 类似 DDD 的 repo，而 repo 接口在这里定义，使用依赖倒置的原则。
│   │   ├── README.md
│   │   ├── biz.go
│   │   └── greeter.go
│   ├── conf  // 内部使用的config的结构定义，使用proto格式生成
│   │   ├── conf.pb.go
│   │   └── conf.proto
│   ├── data  // 业务数据访问，包含 cache、db 等封装，实现了 biz 的 repo 接口。我们可能会把 data 与 dao 混淆在一起，data 偏重业务的含义，它所要做的是将领域对象重新拿出来，我们去掉了 DDD 的 infra层。
│   │   ├── README.md
│   │   ├── data.go
│   │   └── greeter.go
│   ├── server  // http和grpc实例的创建和配置
│   │   ├── grpc.go
│   │   ├── http.go
│   │   └── server.go
│   └── service  // 实现了 api 定义的服务层，类似 DDD 的 application 层，处理 DTO 到 biz 领域实体的转换(DTO -> DO)，同时协同各类 biz 交互，但是不应处理复杂逻辑
│       ├── README.md
│       ├── greeter.go
│       └── service.go
└── third_party  // api 依赖的第三方proto
    ├── README.md
    ├── google
    │   └── api
    │       ├── annotations.proto
    │       ├── http.proto
    │       └── httpbody.proto
    └── validate
        ├── README.md
        └── validate.proto
```
注: 上述目录结构摘录自 kratos 文档。

kratos 使用 DDD 领域驱动的理念来规划项目的目录结构。所以在学习 kratos 之前，你可能还需要了解一点领域驱动设计相关的知识。

### 1.2 添加新的 ENTITY 
初始化项目之后，我们继续往里面添加一个 ENTITY(ENTITY 是 DDD 重点概念，代表一个领域)，这样我们我们就能弄清楚如何在 kratos 的项目里编写业务代码。kratos 也提供了一些辅助工具。

#### 定义 pb 文件
首先我们需要定义 ENTITY 接口定义的 pb 文件。`kratos proto add api/evaluate/v1/income.proto` 会按照预制的模板为我们创建一个 pb 文件，内容如下:

```yaml
syntax = "proto3";

# 1. 差别一: package api.evaluate.v1;
package evaluate.v1;

import "google/api/annotations.proto";

option go_package = "gostock/api/evaluate/v1;v1";
option java_multiple_files = true;
option java_package = "api.evaluate.v1";

service Income {
	rpc CreateIncome (CreateIncomeRequest) returns (CreateIncomeReply);
	rpc UpdateIncome (UpdateIncomeRequest) returns (UpdateIncomeReply);
	rpc DeleteIncome (DeleteIncomeRequest) returns (DeleteIncomeReply);
	rpc GetIncome (GetIncomeRequest) returns (GetIncomeReply) {
    # 2. 差别二: 添加的 http 接口定义
		option (google.api.http) = {
			get: "/evaluate/{stock_id}"
		};
	};
	rpc ListIncome (ListIncomeRequest) returns (ListIncomeReply);
}

message CreateIncomeRequest {}
message CreateIncomeReply {}

message UpdateIncomeRequest {}
message UpdateIncomeReply {}

message DeleteIncomeRequest {}
message DeleteIncomeReply {}

message GetIncomeRequest {
	int32 stock_id  = 1;
}
message GetIncomeReply {
	int32 stock_id  = 1;
}

message ListIncomeRequest {}
message ListIncomeReply {}
```

上面的 pb 文件是我修改之后的，修改的地方在上面也标注出来了。

#### 生成 go 代码
有了这个 pb 文件之后，我们就可以用 protoc 生成对应的 go 代码。项目的 Makefile 已经我们准备了编译 pb 文件的命令了，执行 `make api` 就会自动在下面三个文件:

```bash
$ ll api/evaluate/v1/
总用量 44
-rw-rw-r--. 1 tao tao  9171 5月  24 10:38 income_grpc.pb.go
-rw-rw-r--. 1 tao tao  2173 5月  24 10:38 income_http.pb.go
-rw-rw-r--. 1 tao tao 22482 5月  24 10:38 income.pb.go
-rw-r--r--. 1 tao tao   970 5月  24 10:38 income.proto
```

make api 执行的是下面这个命令:

```Makefile
API_PROTO_FILES=$(shell find api -name *.proto)
api:
	protoc --proto_path=./api \
	       --proto_path=./third_party \
 	       --go_out=paths=source_relative:./api \
 	       --go-http_out=paths=source_relative:./api \
 	       --go-grpc_out=paths=source_relative:./api \
 	       --openapi_out==paths=source_relative:. \
	       $(API_PROTO_FILES)
```
income_http.pb.go 是 [kratos 自定义的 grpc 插件](https://github.com/go-kratos/kratos/tree/main/cmd/protoc-gen-go-http) 生成的 http 服务注册的代码。这个我们后面在细说。

#### 编写服务的业务代码
有了 pb 文件，相当于定义好了 ENTITY 对应的服务接口，接着我们就要实现具体的业务逻辑。使用 `kratos proto server api/evaluate/v1/income.proto -t internal/service` 可以直接生成对应的 Service 实现代码。生成的代码如下:

```go
package service

import (
	"context"

	pb "gostock/api/evaluate/v1"
	"gostock/internal/biz"
)

type IncomeService struct {
	pb.UnimplementedIncomeServer
	uc *biz.IncomeUsecase
}

func NewIncomeService() *IncomeService {
	return &IncomeService{}
}

func (s *IncomeService) CreateIncome(ctx context.Context, req *pb.CreateIncomeRequest) (*pb.CreateIncomeReply, error) {
	return &pb.CreateIncomeReply{}, nil
}
func (s *IncomeService) UpdateIncome(ctx context.Context, req *pb.UpdateIncomeRequest) (*pb.UpdateIncomeReply, error) {
	return &pb.UpdateIncomeReply{}, nil
}
func (s *IncomeService) DeleteIncome(ctx context.Context, req *pb.DeleteIncomeRequest) (*pb.DeleteIncomeReply, error) {
	return &pb.DeleteIncomeReply{}, nil
}
func (s *IncomeService) GetIncome(ctx context.Context, req *pb.GetIncomeRequest) (*pb.GetIncomeReply, error) {
	return &pb.GetIncomeReply{}, nil
}
func (s *IncomeService) ListIncome(ctx context.Context, req *pb.ListIncomeRequest) (*pb.ListIncomeReply, error) {
	return &pb.ListIncomeReply{}, nil
}
```

生成的 IncomeService 实现了 protoc-gen-go-grpc 根据 pb 文件生成的 IncomeServer 接口(api/evaluate/v1/income_grpc.pb.go)。

```go
type IncomeServer interface {
	CreateIncome(context.Context, *CreateIncomeRequest) (*CreateIncomeReply, error)
	UpdateIncome(context.Context, *UpdateIncomeRequest) (*UpdateIncomeReply, error)
	DeleteIncome(context.Context, *DeleteIncomeRequest) (*DeleteIncomeReply, error)
	GetIncome(context.Context, *GetIncomeRequest) (*GetIncomeReply, error)
	ListIncome(context.Context, *ListIncomeRequest) (*ListIncomeReply, error)
	mustEmbedUnimplementedIncomeServer()
}
```

#### 完善 ENTITY 的定义
实现了服务接口，要想把服务注册到 grpc 和 http 服务，目前来说还不够。我们还需要执行以下步骤:

首先定义 ENTITY: 按照 DDD 的设计理念，service 是不包含具体的业务逻辑的，所以我们要为 income 创建单独的 ENTITY，位于 internal/biz/income.go。参考示例的 greeter.go 我们有如下代码:

```go
package biz

import (
	"context"

	"github.com/go-kratos/kratos/v2/log"
)

// 1. 定义 income 对应的数据模型
// Income is a Income model.
type Income struct {
	stock_id int
}

// 2. 定义 income 的数据获取接口
// IncomeRepo is a income repo.
type IncomeRepo interface {
	Save(context.Context, *Income) (*Income, error)
	Update(context.Context, *Income) (*Income, error)
	FindByID(context.Context, int64) (*Income, error)
	ListByHello(context.Context, string) ([]*Income, error)
	ListAll(context.Context) ([]*Income, error)
}

// 3. 实现 income 的业务逻辑
// IncomeUsecase is a IncomeUsecase usecase.
type IncomeUsecase struct {
	repo IncomeRepo
	log  *log.Helper
}

// 4. IncomeUsecase 的工厂函数
// NewIncomeUsecase new a Income usecase.
func NewIncomeUsecase(repo IncomeRepo, logger log.Logger) *IncomeUsecase {
	return &IncomeUsecase{repo: repo, log: log.NewHelper(logger)}
}

// 5. 实现 Income 的具体业务逻辑，依据业务逻辑定义
// CreateGreeter creates a Greeter, and returns the new Greeter.
func (uc *IncomeUsecase) CreateIncome(ctx context.Context, g *Income) (*Income, error) {
	uc.log.WithContext(ctx).Infof("CreateGreeter: %v", g.stock_id)
	return uc.repo.Save(ctx, g)
}
```

有了 IncomeRepo 的接口定义，我们需要在 internal/data/income.go 实现 Income 数据获取逻辑

```go
package data

import (
	"context"
	"gostock/internal/biz"

	"github.com/go-kratos/kratos/v2/log"
)

type incomRepo struct {
	data *Data
	log  *log.Helper
}

func (r *incomRepo) Save(ctx context.Context, g *biz.Income) (*biz.Income, error) {
	return g, nil
}

func (r *incomRepo) Update(ctx context.Context, g *biz.Income) (*biz.Income, error) {
	return g, nil
}

func (r *incomRepo) FindByID(context.Context, int64) (*biz.Income, error) {
	return nil, nil
}

func (r *incomRepo) ListByHello(context.Context, string) ([]*biz.Income, error) {
	return nil, nil
}

func (r *incomRepo) ListAll(context.Context) ([]*biz.Income, error) {
	return nil, nil
}

// NewIncomeRepo .
func NewIncomeRepo(data *Data, logger log.Logger) biz.IncomeRepo {
	return &incomRepo{
		data: data,
		log:  log.NewHelper(logger),
	}
}

```

并修改 internal/service/income.go 内 IncomeService 的实现。

```go
func NewIncomeService(uc *biz.IncomeUsecase) *IncomeService {
	return &IncomeService{uc: uc}
}
```

最后我们需要把 IncomeService 注册到 grpc 和 http 的服务中，并完善 wire 的依赖定义，可以自动完成整个过程的依赖管理。

修改 wire 的依赖定义:
1. 修改 `internal/data/data.go`: `var ProviderSet = wire.NewSet(NewData, NewGreeterRepo, NewIncomeRepo)`
2. 修改 `internal/service/service.go`: `var ProviderSet = wire.NewSet(NewGreeterService, NewIncomeService)`
3. 修改 `internal/biz/biz.go`: `var ProviderSet = wire.NewSet(NewGreeterUsecase, NewIncomeUsecase)`


注册 http 服务: `internal/server/http.go`
```go
package server

import (
	evaluate_v2 "gostock/api/evaluate/v1"
	v1 "gostock/api/helloworld/v1"
	"gostock/internal/conf"
	"gostock/internal/service"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"github.com/go-kratos/kratos/v2/transport/http"
)

// NewHTTPServer new a HTTP server.
func NewHTTPServer(c *conf.Server, greeter *service.GreeterService, income *service.IncomeService, logger log.Logger) *http.Server {
	var opts = []http.ServerOption{
		http.Middleware(
			recovery.Recovery(),
		),
	}
	if c.Http.Network != "" {
		opts = append(opts, http.Network(c.Http.Network))
	}
	if c.Http.Addr != "" {
		opts = append(opts, http.Address(c.Http.Addr))
	}
	if c.Http.Timeout != nil {
		opts = append(opts, http.Timeout(c.Http.Timeout.AsDuration()))
	}
	srv := http.NewServer(opts...)
	v1.RegisterGreeterHTTPServer(srv, greeter)
  // 注册 income 服务
	evaluate_v2.RegisterIncomeHTTPServer(srv, income)
	return srv
}
```


注册 grpc 服务: `internal/server/grpc.go`

```go
package server

import (
	evaluate_v2 "gostock/api/evaluate/v1"
	v1 "gostock/api/helloworld/v1"
	"gostock/internal/conf"
	"gostock/internal/service"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"github.com/go-kratos/kratos/v2/transport/grpc"
)

// NewGRPCServer new a gRPC server.
func NewGRPCServer(c *conf.Server, greeter *service.GreeterService, income *service.IncomeService, logger log.Logger) *grpc.Server {
	var opts = []grpc.ServerOption{
		grpc.Middleware(
			recovery.Recovery(),
		),
	}
	if c.Grpc.Network != "" {
		opts = append(opts, grpc.Network(c.Grpc.Network))
	}
	if c.Grpc.Addr != "" {
		opts = append(opts, grpc.Address(c.Grpc.Addr))
	}
	if c.Grpc.Timeout != nil {
		opts = append(opts, grpc.Timeout(c.Grpc.Timeout.AsDuration()))
	}
	srv := grpc.NewServer(opts...)
	v1.RegisterGreeterServer(srv, greeter)
  // 注册 income 服务
	evaluate_v2.RegisterIncomeServer(srv, income)
	return srv
}
```

总结一下，在 kratos 的应用中添加接口需要以下几个步骤:
1. 在 pb 文件中定义接口，并使用 protoc 及其扩展生成相应的 go 代码，生成的代码中包括服务需要实现的接口，以及把服务注册到  grpc/http 的函数
2. 定义服务的具体实现，并根据业务领域的划分，创建业务需要的 ENTITY 
3. 在 NewGRPCServer、NewHTTPServer 中调用 pb 文件生成的注册函数，把服务的具体实现注册到 grpc 和 http 的服务中。

