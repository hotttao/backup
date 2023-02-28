---
weight: 1
title: "k8s 架构简述"
date: 2020-08-02T22:00:00+08:00
lastmod: 2020-08-02T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "这个系列我们开始学习 k8s"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---
k8s 内容庞大，今天我们希望能从 k8s 的架构和源码出发，构建一个学习 k8s 架构图。这样我们才能在后面深入的学习过程中，不至于忘记所有知识之间的联系，从而达到深入浅出学习 k8s 的目的。


## 1. kubernetes 架构
### 1.1 kubernetes 核心设计
Kubernetes 从 Google Borg 系统演化而来。因此从一开始就把关注点放到了**如何编排、管理、调度用户提交的作业上**。这个出发点来自于 Borg 的研究人员在论文中提到的一个非常重要的观点：**运行在大规模集群中的各种任务之间，实际上存在着各种各样的关系。这些关系的处理，才是作业编排和管理系统最困难的地方。**

Kubernetes 最主要的设计思想是，从更宏观的角度，**以统一的方式来定义任务之间的各种关系**，并且为将来支持更多种类的关系留有余地。

除了应用与应用之间的关系外，**应用运行的形态**是影响“如何容器化这个应用”的第二个重要因素。正是基于**容器间关系和形态**两个维度，Kubernetes 演化出了下面的核心功能:

![k8s 核心功能](/images/k8s/k8s_use/k8s_function.webp)

当我们在使用这些核心功能时 Kubernetes 所推崇的使用方法是：
1. 首先，通过一个“编排对象”，比如 Pod、Job、CronJob 等，来描述你试图管理的应用；
2. 然后，再为它定义一些“服务对象”，比如 Service、Secret、Horizontal Pod Autoscaler（自动水平扩展器）等。这些对象，会负责具体的平台级功能。

这种使用方法，就是所谓的**声明式 API**。这种 API 对应的**编排对象和服务对象**，都是 Kubernetes 项目中的 API 对象（API Object）。

过去很多的集群管理项目（比如 Yarn、Mesos，以及 Swarm）所擅长的，都是把一个容器，按照某种规则，放置在某个最佳节点上运行起来。这种功能，我们称为“调度”。而 Kubernetes 项目所擅长的，是按照用户的意愿和整个系统的规则，完全自动化地处理好容器之间的各种关系。这种功能，就是我们经常听到的一个概念：编排。所以说，Kubernetes 项目的本质，是为用户提供一个具有普遍意义的容器编排工具。

### 1.2 k8s 架构图
![k8s 架构](/images/k8s/k8s_use/k8s_architecture.webp)

Kubernetes 的架构由 Master 和 Node 两种节点组成，而这两种角色分别对应着控制节点和计算节点。
1. 控制节点，即 Master 节点，由三个紧密协作的独立组件组合而成，它们分别是:
  - 负责 API 服务的 kube-apiserver
  - 负责调度的 kube-scheduler
  - 负责容器编排的 kube-controller-manager
  - 整个集群的持久化数据，则由 kube-apiserver 处理后保存在 Etcd 中
2. 计算节点上最核心的部分，则是一个叫作 kubelet 的组件
  - kubelet 主要负责同容器运行时（比如 Docker 项目）打交道。这个交互所依赖的，是一个称作 **CRI（Container Runtime Interface）** 的远程调用接口，这个接口定义了容器运行时的各项核心操作
  - 具体的容器运行时，比如 Docker 项目，则一般通过 **OCI 这个容器运行时规范**同底层的 Linux 操作系统进行交互，即：把 CRI 请求翻译成对 Linux 操作系统的调用（操作 Linux Namespace 和 Cgroups 等）
  - kubelet 还通过 gRPC 协议同一个叫作 **Device Plugin 的插件**进行交互。这个插件，是 Kubernetes 项目用来管理 GPU 等宿主机物理设备的主要组件，也是基于 Kubernetes 项目进行机器学习训练、高性能作业支持等工作必须关注的功能
  - kubelet 的另一个重要功能，则是调用网络插件和存储插件为容器配置网络和持久化存储。这两个插件与 kubelet 进行交互的接口，分别是 **CNI（Container Networking Interface）** 和 **CSI（Container Storage Interface）** 。

![Deployment 创建流程](/images/k8s/k8s_use/control_plane_workflow.png)

## 2. k8s 源码结构
有了架构图，我们再来看看源码结构，看看架构与源码是如何对应起来。个人觉得结合代码的方式来学习 k8s 可以让我们更加结构化的理解 k8s 中的抽象概念，这样理解和记忆会更加深刻。

|目录 |作用|
|:---|:---|
|api/ |	存放 OpenAPI/ |Swagger 的 spec 文件，包括 JSON、Protocol 的定义等|
|build/ |	存放构建相关的脚本|
|cmd/ |	存放可执行文件的入口代码，每一个可执行文件都会对应有一个 main 函数|
|docs/ |	存放设计或者用户使用文档|
|hack/ |	存放与构建、测试相关的脚本|
|pkg/ |	存放核心库代码，可被项目内部或外部，直接引用|
|plugin/ |	存放 kubernetes 的插件，例如认证插件、授权插件等|
|staging/ |	存放部分核心库的暂存代码，也就是还没有集成到 pkg 目录的代码，包括一些与云服务厂商集成的 provider|
|test/ |	存放测试工具，以及测试数据|
|third_party/ |	存放第三方工具、代码或其他组件|
|translations/ |	存放 i18n(国际化)语言包的相关文件，可以在不修改内部代码的情况下支持不同语言及地区|
|vendor/ |	存放项目依赖的库代码，一般为第三方库代码|

cmd 是可执行文件入口，与 kubernetes 提供的各个组件一一对应。cmd 中实际调用的就是 pkg 中的代码。在 pkg 中下面几个目录与我们后面学习 k8s 密切相关:

|目录|作用|
|:---|:---|
|apis|kubernetes 核心对象的定义，后面我们将学习的 Pod，Deployment 等等核心对象的可定义字段都在这个目录下 go 代码中定义|

