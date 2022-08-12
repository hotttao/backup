---
weight: 1
title: "Protobuf 定义与使用"
date: 2021-06-23T22:00:00+08:00
lastmod: 2021-06-23T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Protobuf 入门"
featuredImage: 

tags: ["go 框架"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

前面我们已经使用了 protobuf，protobuf 的基础语法相信大多数人看一下官方文档都能看懂，这里推荐:
1. [鸟叔的 Protobuf 终极教程](https://colobu.com/2019/10/03/protobuf-ultimate-tutorial-in-go/)
2. [alovn 的 Protobuf 教程](https://alovn.cn/docs/protobuf/)
3. [protobuf 官方文档](https://developers.google.com/protocol-buffers/docs/reference/python-generated)

基础语法这里就不在赘述了，这里会记录一些较为复杂的特殊用法。

## 1. proto3 中的零值判定
Protobuf v3 中，建议使用[wrappers.proto](https://github.com/protocolbuffers/protobuf/blob/master/src/google/protobuf/wrappers.proto)包装一个 message，使用时将其变为指针。通过判定是否为 nil 进行零值还是没填值得判定。

```go
syntax = "proto3";

package example;

// 引入 wrappers.proto 
import "google/protobuf/wrappers.proto";

service HelloServiceAo {
    rpc SendHelloMessage (HelloMessageRequest) returns (HelloMessageResponse) {
    }
}

message HelloMessageRequest {
    string number = 1;
    // 修改为 google.protobuf.BoolValue 字段
    google.protobuf.BoolValue international = 2;
}
```

## 2. FieldMask
