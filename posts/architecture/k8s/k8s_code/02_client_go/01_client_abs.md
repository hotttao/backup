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
## 1. 自定义控制执行流程
client-go 主要用于与 ApiServer 交互，对于应用开发来说，其最典型的作用是用于自定义控制器 Operator 的开发。下面两张图是自定义控制器的执行流程，从这两张图基本上就能看到 clinet-go 提供的核心对象:
|核心对象|作用|
|:---|:---|
|Reflector|Reflector 使用 ListWatcher 向 apiserver watch 特定类型的资源，拿到变更通知后将其丢到 DeltaFIFO 队列中|
|Informer|Informer 从 DeltaFIFO 中 pop 相应对象，然后通过 Indexer 将对象和索引丢到本地 cache 中，再触发响应的事件处理函数（Resource Event Handlers）运行|
|Indexer|Indexer 主要提供一个对象根据一定条件的检索能力，典型的实现是通过 namespace/name 来构造 key ，通过 Thread Safe Store 来存储对象|
|Workqueue|Workqueue 一般使用的是延时队列实现，在 Resource Event Handlers 中会完成将对象的 key 放入 workqueue 的过程，然后我们在自己的逻辑代码里从 workqueue 中消费这些 key|
|ClientSet|Clientset 提供的是资源的 CURD 能力，和 apiserver 交互|
|Resource Event Handlers|我们在 Resource Event Handlers 中一般是添加一些简单的过滤功能，判断哪些对象需要加到 workqueue 中进一步处理；对于需要加到 workqueue 中的对象，就提取其 key，然后入队|
|Worker|Worker 指的是我们自己的业务代码处理过程，在这里可以直接接收到 workqueue 里的任务，可以通过 Indexer 从本地缓存检索对象，通过 Clientset 实现对象的增删改查逻辑|

![自定义控制器工作流程](/images/k8s/k8s_code/custom_control.webp)

![自定义控制器工作流程](/images/k8s/k8s_code/client-go-process.png)

