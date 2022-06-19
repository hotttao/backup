---
weight: 4
title: "go API 设计"
date: 2021-04-03T22:00:00+08:00
lastmod: 2021-04-03T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Go 工程化实践-API设计"
featuredImage: 

tags: ["go 惯例"]
categories: ["Go"]

lightgallery: true

---
前面我们介绍 Go 项目工程化提到了 /api 目录。这目录是协议定义目录，用于存放约定项目接口的 IDL 文件。按照现在的主流基本都是 Protobuf 文件。Protobuf 的管理和共享就是今天的话题。

## 1. Api 仓库
参考:
1. (googleapis)[https://github.com/googleapis/googleapis]
2. (envoyproxy data-plane-api)[https://github.com/envoyproxy/data-plane-api]
3. (istio api)[https://github.com/istio/api]

为了统一检索和规范 API，建议在公司内部建立一个统一的 bapis 仓库，整合所有对内对外 API。这种方式由如下好处:
1. API 仓库，方便跨部门协作。
2. 版本管理，基于 git 控制。
3. 规范化检查，API lint。
4. API design review，变更 diff。
5. 权限管理，目录 OWNERS。

## 2. Api Project Layout
这个 Api 仓库按照不同的组织方式由不同结构。

### 2.1 项目中定义的 API
单独项目中定义 proto，以 api 为包名根目录:
```go
application_name
    api 
        helloworld
            v1
                demo.proto
    annotation // 注解定义 options
    third_part // 第三方引用
    
      
```
### 2.2 统一 Api 仓库
在统一仓库中管理 proto ，以仓库为包名根目录:

```go
api   // api 定义
    application_name 
        helloworld
          v1
              demo.proto
annotation // 注解定义 options
third_part // 第三方引用
```

## 3. Api 命名
对于一个 gRPC 接口，比较好的接口命名规范是 `// RequestURL: /<package_name>.<version>.<service_name>/{method}` 其中:
1. package_name 为应用的标识(APP_ID)，用于生成 gRPC 请求路径，或者 proto 之间进行引用 Message。
2. 带有版本的 API 的软件包名称必须以此版本结尾。

protobuf 文件中声明的包名称应该与产品和服务名称保持一致: `package <package_name>.<version>;` 命名

我们以 `google/bigtable/v2/bigtable.proto` 定义为例:

```proto
syntax = "proto3";

package google.bigtable.v2;

service Bigtable {
  option (google.api.default_host) = "bigtable.googleapis.com";
}
```
其中:
1. google.bigtable 就是 package_name，这个 package_name 与服务名一致
2. v2 就是 api 的版本信息

最后推荐阅读[谷歌API设计指南](https://cloud.google.com/apis/design?hl=zh-cn)

## 4. Api 错误处理
### 4.1 错误定义
首先我们需要统一错误得定义得标准和入口。使用一小组标准错误配合大量资源。例如，服务器没有定义不同类型的“找不到”错误，而是使用一个标准 google.rpc.Code.NOT_FOUND 错误代码并告诉客户端找不到哪个特定资源。状态空间变小降低了文档的复杂性，在客户端库中提供了更好的惯用映射，并降低了客户端的逻辑复杂性，同时不限制是否包含可操作信息(/google/rpc/error_details)。

### 4.1 错误传播
如果您的 API 服务依赖于其他服务，则不应盲目地将这些服务的错误传播到您的客户端。在翻译错误时，我们建议执行以下操作：
1. 隐藏实现详细信息和机密信息。
2. 调整负责该错误的一方。例如，从另一个服务接收 INVALID_ARGUMENT 错误的服务器应该将 INTERNAL 传播给它自己的调用者。

全局错误码，是松散、易被破坏契约的，基于我们上述讨论的，在每个服务传播错误的时候，做一次翻译，这样保证每个服务 + 错误枚举，应该是唯一的，而且在 proto 定义中是可以写出来文档的。

## 5. Api Design

## 6. Proto 管理
[]() Proto 管理方式有如下几种:
1. 代码仓库
2. 独立仓库
3. 集中仓库
4. 镜像仓库

## 参考
1. [极客时间-毛剑老师的 Go 工程化实践](https://u.geekbang.org/subject/intro/100107201)
2. [Go项目标准布局](https://github.com/golang-standards/project-layout/blob/master/README_zh-CN.md)
