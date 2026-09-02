---
weight: 2
title: "2 Traefik 的核心抽象与请求流程"
date: 2026-08-29T08:00:00+08:00
draft: false
description: "从 Provider、Router 到请求转发，理解 Traefik 的工作原理"
tags: ["gateway", "traefik"]
categories: ["microservice"]
---

## 1. Traefik 解决什么问题

Traefik 是反向代理和应用 Gateway。它从 Docker、Kubernetes、Consul 或文件等 Provider 读取服务信息，自动生成路由配置，并把请求转发到后端实例。

```text
基础设施变化 → Provider 发现服务 → Traefik 生成动态配置
                                  ↓
EntryPoint 接收 → Router 匹配 → Middleware 处理 → Service 转发
```

### 1.1 Traefik 服务本身是什么形态

Traefik 首先是一个可执行程序。它既读取配置，又处理业务请求，这两项能力通常运行在同一个 Traefik 进程中，并不像 Envoy Gateway 那样拆成独立 Controller 和 Proxy。

在 Docker 中，它通常是一个容器：

```text
Traefik Container
└── Traefik 进程
    ├── Docker Provider：监听容器和 Label
    └── Proxy：接收并转发请求
```

在 Kubernetes 中，常见运行形态是：

```text
Traefik Deployment
├── Traefik Pod 1
└── Traefik Pod 2
        ↑
LoadBalancer Service：对外暴露这些 Pod
```

Deployment 管理 Traefik Pod，LoadBalancer Service 为这些 Pod 提供稳定入口。每个 Traefik Pod 中的进程既通过 Kubernetes Provider 监听资源，也实际代理请求。

### 1.2 用两个业务服务理解代理过程

假设集群中有 `user-service` 和 `order-service`：

```text
Client
  ↓
Traefik LoadBalancer Service
  ↓
Traefik Pod（Provider + Proxy）
  ├── /users  → user-service  → user Pod
  └── /orders → order-service → order Pod
```

配置流程和请求流程分别是：

```text
配置：Ingress/IngressRoute → Kubernetes API → Traefik Provider → 内存路由
请求：Client → Traefik Service → Traefik Pod → 业务 Service/Pod
```

Traefik Pod 不会为每个业务服务创建一套代理。一个 Traefik 实例可以保存多条 Router，并代理多个后端 Service。

## 2. 核心抽象

配置分为安装配置和路由配置。安装配置在启动时指定监听端口、Provider、日志和 API；路由配置定义 Router、Middleware、Service、TLS，可随 Provider 变化热更新。

| 抽象 | 作用 | 示例 |
| --- | --- | --- |
| EntryPoint | Gateway 的监听入口 | `:80`、`:443` |
| Router | 根据 Host、Path、Header 匹配请求 | `Host(api.example.com)` |
| Middleware | 在转发前后处理请求 | 认证、限流、重写、压缩 |
| Service | 描述后端及负载均衡 | 多个容器地址 |

Provider 是配置来源，不是后端服务本身。Docker Provider 读取容器 Label，Kubernetes Provider 读取 Ingress/CRD/Gateway API，File Provider 读取 YAML/TOML，Consul Catalog Provider 读取服务注册信息。

## 3. 整体架构与存储

```text
Docker / Kubernetes / Consul / File
                ↓
        Traefik Provider 层
                ↓ 动态配置事件
       Router / Middleware / Service
                ↓
          Traefik Proxy 数据面
```

Traefik 没有强制要求一个中心数据库，配置存储取决于 Provider。可以使用 Docker API、Kubernetes API Server、Consul Catalog、文件，或 Consul/etcd/Redis 等 KV Provider。Traefik 监听变化并重建动态配置，不中断已有连接。

## 4. 代理层级

```text
EntryPoint → Router → Middleware → Service → Server
```

一个 Router 可以绑定多个 Middleware 和一个 Service；一个 Service 可以包含多个 Server，并使用负载均衡方式选择实例。不同 Provider 的对象属于各自命名空间，跨 Provider 引用时使用 `object@provider`。

## 5. 请求处理流程

以 Docker 中的 `api` 容器为例：

```text
1. 客户端请求 https://api.example.com/v1/users
2. :443 EntryPoint 接收 TLS 请求
3. Router 匹配 Host 和 Path
4. Middleware 校验认证并添加请求头
5. Service 从 api 容器地址中选择一个 Server
6. Traefik 转发到容器
7. 响应经过响应类 Middleware 后返回客户端
```

容器 Label 描述路由意图，Traefik 将其转换为内部对象。容器扩缩容时，Provider 重新发现地址，Service 的后端列表随之更新。

## 6. 适合的场景与边界

Traefik 适合 Docker、Kubernetes 和小型多环境中需要自动发现、配置简单的入口。它的优势是 Provider 多、动态更新和运维门槛低；如果需求重点是完整 API 生命周期、Developer Portal 或复杂 Consumer 管理，应考虑 APISIX、Kong 等 API Management 产品。

官方文档：[Configuration](https://doc.traefik.io/traefik/getting-started/configuration-overview/)、[Providers](https://doc.traefik.io/traefik/reference/install-configuration/providers/overview/)。
