---
title: Openstack Nova 入门开篇
date: 2021-03-02
categories:
    - 运维
tags:
	- Openstack
	- 入门指南
---

Openstack Nova
<!-- more -->

## 1. 学习思路
从今天开始，我们就要正式开始进入 Nova 的学习进程中了，我们将按照如下思路进行学习:
1. 首先我们将从 Nova 的功能模块出发，从整体上了解 Nova 源码的组成，并规划接下来的学习路线。这部分就是接下来要介绍的内容
2. 其次我们将按照我们规划的学习路线，深入到 Nova 源码的各个部分进行学习
3. 最后，我将挑选虚机管理的中几个经典流程，比如虚拟的创建、删除、热迁移，将我们之前学习的内容全部串联起来

这也是我们之后学习 Openstack 其他组件的思路。个人觉得这种总分总的方式比较适合来学习像 Openstack 这样的开源软件，我们需要快速对其功能全貌有个大概的认识，然后在深入到细节中，最后在串联所有。就像盖楼房一样，先建骨架，在填充细节，最后验收质检。所以如果你对 Openstack 一点不熟悉，推荐从[每天五分钟玩转Openstack](https://mp.weixin.qq.com/s/QtdMkt9giEEnvFTQzO9u7g)学起。

### 2. Nova 的功能和模块划分
Openstack 整体架构如下图2.1所示:

![图2.1 OpenStack 架构示意图(未找到出处)](/images/openstack/architecture_openstack.png)

它的设计与实现遵循了这样一个原则: 跨组件之间的通信使用的是 RESTful API，而组件内的通信使用的是基于消息队列的 rpc 通信。

Nova 是 Openstack 中的核心计算组件，管理着虚拟机的整个生命中周期。如下图2.2所示:
![图2.2 Nova组件示意图，摘录自《每天五分钟玩转Openstack》](/images/openstack/architecture_nova.png)

它由如下几个部分组成:
1. API: Nova 的API 接口服务，用于接收来自外部的功能请求
2. Scheduler: 资源调度服务，用于决定在哪个物理机上进行虚机的创建
3. nova-compute: 管理虚机的核心服务，通过调用 Hypervisor API 实现虚机生命周期管理
4. nova-conductor: 提供数据库更新、复杂流程的管控
5. 这些组件基于消息队列进行 RPC 通信

注: Nova 完整的组件不止上述几个，这几个是核心组件，后面我们会在重要流程中介绍剩余的其他组件，这里现有一个大概的映像。

所以我们看 Nova 的源码结构基本上也是与上面的功能模块一一对应:

```bash
$ tree -d -L 2 nova/
nova/
├── accelerator
├── api              # 1. Nova API 接口
│   ├── metadata     # 1.1 元数据服务接口
│   ├── openstack    # 1.2 核心服务接口
│   └── validation
├── cmd              # 2. 服务启动的命令行入口
├── compute          # 3.1 nova-compute 组件
│   └── monitors    
├── conductor        # 3.2 nova-conductor 组件
│   └── tasks
├── conf             # 所有服务的命令行参数
├── console          # 3.3 nova-console 组件
│   ├── rfb
│   └── securityproxy
├── db                # T-数据库操作
│   └── sqlalchemy
├── hacking
├── image             # 4.1 Glance 服务调用入口
├── keymgr            
├── locale            # T-本地化
├── network           # 4.2 Netron 服务调用入口
├── notifications     
│   └── objects
├── objects           # 4.3 
├── pci
├── policies
├── privsep
├── scheduler         # 3.4 nova-scheduler 组件
│   ├── client
│   ├── filters
│   └── weights
├── servicegroup
│   └── drivers
├── storage
├── tests
│   ├── fixtures
│   ├── functional
│   └── unit
├── virt             # 5. 不同虚拟化技术的底层抽象和实现
│   ├── disk
│   ├── hyperv
│   ├── image
│   ├── ironic
│   ├── libvirt
│   ├── powervm
│   ├── vmwareapi
│   └── zvm
└── volume          # 6. Cinder 块存储调用服务入口
```

## 3. Nova 学习路线规划
有了前面的铺垫，接下来我们就可以规划我们的学习路线了。个人觉得有三条需要掌握的主干线:
1. API 接口服务
2. 基于消息队列的 RPC 服务
3. 跨组件的 RESTful API 接口调用

### 3.1 API 接口服务
API 接口服务我们需要了解:
1. WSGI 是什么: 这是一个通用 Python Web 开发框架接口协议，Openstack 的 API 接口正式基于此开发的
2. WSGI 的服务管理: Nova 会启动多个 API 接口服务，这些服务是怎么启动和管理的
3. API 服务的路由管理: http 请求被接收后，是如何找到相应的处理函数进行处理的？

通过这一部分，我们就可以根据发送过来的 URL 快速定位到相应的处理函数。

### 3.2 RPC 服务
Openstack 采用了基于消息队列的 RPC 通信方式，底层支持 RabbitMQ，Kafka 等多种消息队列。这一步我们需要了解:
1. RPC 服务是如何启动和管理的
2. Nova 如何同时支持多个消息队列
3. RPC 请求到处理的调用过程

通过这一部分，我们就可以了解到，虚机在 Nova 内部的管理流程。

### 3.3 跨组件的接口调用
这一部分内容不多，目的是了解 Openstack 组件是符合发起 HTTP 请求进行调用的，包括:
1. 如何获取服务监听的地址
2. 如何处理网络的超时

### 3.3 其他知识
通过前面的三条主线，我们基本就能对 Nova 的源码有个较为深入的认识了。但是在学习这些内容之前和之后还有一些知识需要我们关注。

#### 学习之前的内容
Openstack 抽象了一组公共库 Oslo，这组公共库抽象了很多所有组件都会用到的公共代码，包括:
1. oslo_conf: 配置文件管理
2. oslo_log: 日志管理
3. oslo_message: RPC 通信的抽象层，与 RPC 通信密切相关
4. oslo_service: RPC Server 和 API Server 的服务管理
5. .....

这些众多的公共库中有一些，比如 oslo_conf、oslo_log 是学习主干内容之前必须了解的，会先介绍；有些内容是跟 Nova 内部组件密切相关我们会放到具体的相关内容中。

#### 学习之后的内容
Openstack 作为一个分布式的大型应用，有很多更高阶的知识是需要我们在学习的过程中和学习之后去思考的:
1. Openstack 使用 Python 编写的，里面用到了哪些 Python 编程的技巧
2. Openstack 如何保证高可用，当出现网络分区时会有什么现象和结果
3. Openstack 有事务机制或者幂等机制么，如何处理失败的中间结果
4. Openstack 在面对流量激增时，如何进行横向跨站
5. .....

这些问题，我们会在单独章节详细讲解。当然 Openstack 的源码我也一直处于学习之中，后面可能有新的问题加入，老的问题也可能有新的见解。希望大家能跟我一样在阅读源码之前，先想想有哪些点是值的关注的。带着问题去看，收获会更大。

## 4. 课程目录
综上，Nova 源码解析系列的课程目录如下:
1. oslo 通用公共库
2. WSGI 服务管理
