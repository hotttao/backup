---
weight: 1
title: "控制器模型"
date: 2020-08-04T22:00:00+08:00
lastmod: 2020-08-04T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Pod 使用进阶"
featuredImage: 

tags: ["k8s", "k8s 实现"]
categories: ["architecture"]

lightgallery: true

---
在 kubernetes 中操作各种  API 对象的逻辑都是由控制器完成的。本节我们来学习控制器的实现原理。

## 1. 控制器模式
在前面介绍 Kubernetes 架构的时候，曾经提到过一个叫作 kube-controller-manager 的组件。实际上，这个组件，就是一系列控制器的集合，它们位于源码的 pkg/controller 目录下: 

```shell

$ cd kubernetes/pkg/controller/
$ ll
总用量 156
drwxrwxr-x.  3 tao tao    20 2月  28 20:32 apis
drwxrwxr-x.  2 tao tao   185 2月  28 20:32 bootstrap
drwxrwxr-x.  7 tao tao   263 2月  28 20:32 certificates
drwxrwxr-x.  2 tao tao    99 2月  28 20:32 clusterroleaggregation
drwxrwxr-x.  4 tao tao   187 2月  28 20:32 cronjob
drwxrwxr-x.  4 tao tao   180 2月  28 20:32 daemon
drwxrwxr-x.  4 tao tao  4096 2月  28 20:32 deployment
drwxrwxr-x.  2 tao tao    67 2月  28 20:32 disruption
-rw-rw-r--.  1 tao tao   725 2月  28 20:32 doc.go
drwxrwxr-x.  3 tao tao   115 2月  28 20:32 endpoint
drwxrwxr-x.  5 tao tao   229 2月  28 20:32 endpointslice
drwxrwxr-x.  4 tao tao  4096 2月  28 20:32 endpointslicemirroring
drwxrwxr-x.  6 tao tao  4096 2月  28 20:32 garbagecollector
drwxrwxr-x.  2 tao tao    83 2月  28 20:32 history
drwxrwxr-x.  4 tao tao  4096 2月  28 20:32 job
-rw-rw-r--.  1 tao tao  2913 2月  28 20:32 lookup_cache.go
drwxrwxr-x.  4 tao tao    95 2月  28 20:32 namespace
drwxrwxr-x.  4 tao tao   179 2月  28 20:32 nodeipam
drwxrwxr-x.  4 tao tao   146 2月  28 20:32 nodelifecycle
-rw-rw-r--.  1 tao tao   269 2月  28 20:32 OWNERS
drwxrwxr-x.  4 tao tao   197 2月  28 20:32 podautoscaler
drwxrwxr-x.  3 tao tao   119 2月  28 20:32 podgc
drwxrwxr-x.  4 tao tao   193 2月  28 20:32 replicaset
drwxrwxr-x.  3 tao tao   185 2月  28 20:32 replication
drwxrwxr-x.  3 tao tao   116 2月  28 20:32 resourceclaim
drwxrwxr-x.  3 tao tao   158 2月  28 20:32 resourcequota
drwxrwxr-x.  3 tao tao   210 2月  28 20:32 serviceaccount
drwxrwxr-x.  3 tao tao  4096 2月  28 20:32 statefulset
drwxrwxr-x.  2 tao tao    59 2月  28 20:32 storageversiongc
drwxrwxr-x.  2 tao tao    27 2月  28 20:32 testutil
drwxrwxr-x.  2 tao tao    61 2月  28 20:32 ttl
drwxrwxr-x.  4 tao tao   116 2月  28 20:32 ttlafterfinished
drwxrwxr-x.  6 tao tao    72 2月  28 20:32 util
drwxrwxr-x. 11 tao tao   186 2月  28 20:32 volume
```

### 1.1 控制循环
这些控制器之所以被统一放在 pkg/controller 目录下，就是因为它们都遵循 Kubernetes 项目中的一个通用编排模式，即：控制循环（control loop）。比如，现在有一种待编排的对象 X，它有一个对应的控制器。那么，我就可以用一段 Go 语言风格的伪代码，为你描述这个控制循环：

```

for {
  实际状态 := 获取集群中对象X的实际状态（Actual State）
  期望状态 := 获取集群中对象X的期望状态（Desired State）
  if 实际状态 == 期望状态{
    什么都不做
  } else {
    执行编排动作，将实际状态调整为期望状态
  }
}
```

在具体实现中
1. 实际状态: 自于 Kubernetes 集群本身。比如，
  1. kubelet 通过心跳汇报的容器状态和节点状态
  2. 监控系统中保存的应用监控数据
  3. 控制器主动收集的它自己感兴趣的信息
2. 期望状态: 一般来自于用户提交的 YAML 文件。

### 1.2 控制循环执行示例
```yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  selector:
    matchLabels:
      app: nginx
  replicas: 2
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.7.9
        ports:
        - containerPort: 80
```

以 Deployment 为例，控制循环的执行过程如下:
1. Deployment 控制器从 Etcd 中获取到所有携带了“app: nginx”标签的 Pod，然后统计它们的数量，这就是实际状态；
2. Deployment 对象的 Replicas 字段的值就是期望状态；
3. Deployment 控制器将两个状态做比较，然后根据比较结果，确定是创建 Pod，还是删除已有的 Pod

这个操作，通常被叫作调谐（Reconcile）。这个调谐的过程，则被称作“Reconcile Loop”（调谐循环）或者“Sync Loop”（同步循环）。调谐的最终结果，往往都是对被控制对象的某种写操作。比如，增加 Pod，删除已有的 Pod，或者更新 Pod 的某个字段。这也是 Kubernetes 项目“面向 API 对象编程”的一个直观体现。

像 Deployment 这种控制器的设计原理，就是我们前面提到过的，“用一种对象管理另一种对象”的“艺术”。
1. 这个控制器对象本身，负责定义被管理对象的期望状态。比如，Deployment 里的 replicas=2 这个字段。
2. 被控制对象的定义，则来自于一个“模板”。比如，Deployment 里的 template 字段。

Deployment 这个 template 字段里的内容，跟一个标准的 Pod 对象的 API 定义，丝毫不差。而所有被这个 Deployment 管理的 Pod 实例，其实都是根据这个 template 字段的内容创建出来的。像 Deployment 定义的 template 字段，在 Kubernetes 项目中有一个专有的名字，叫作 PodTemplate（Pod 模板）。

![控制器模式](/images/k8s/k8s_use/ped_templates.webp)

如上图所示，类似 Deployment 这样的一个控制器，实际上都是由上半部分的控制器定义（包括期望状态），加上下半部分的被控制对象的模板组成的。这就是为什么，在所有 API 对象的 Metadata 里，都有一个字段叫作 ownerReference，用于保存当前这个 API 对象的拥有者（Owner）的信息。