---
weight: 1
title: "client-go 基础抽象"
date: 2023-03-01T22:00:00+08:00
lastmod: 2023-03-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "client-go 基础抽象"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---

## 1. client-go 基础抽象
![client-go UML 类图](/images/k8s/k8s_code/client-go.svg)

从 UML 类图可以看到 client-go 包含了如下基础的抽象:
1. client-go.rest.Interface: 定义的 GVK 增删改查的接口
2. client-go.rest.ClientContentConfig: 指定对某个组下的某个版本中的资源访问
3. client-go.rest.RESTClient: 生成 Request 对象，实现了上面的 Interface 接口
4. client-go.rest.Request: 包含了 RESTClient，以及发送给 apiserver 的各种参数
5. client-go.rest.Result: 封装了请求对象和 API server 交互的结果，并提供反序列化得到相应资源对象的功能

下面我们来一一介绍这些对象。

## 2. client-go.rest.Interface
