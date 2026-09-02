---
weight: 4
title: "4 Envoy 的核心抽象、xDS 与请求流程"
date: 2026-08-29T08:00:00+08:00
draft: false
description: "从 Listener、Route、Cluster、Endpoint 和 xDS 理解 Envoy"
tags: ["gateway", "envoy"]
categories: ["microservice"]
---

## 1. Envoy 是什么

Envoy 是独立的数据面代理，可以作为边缘 Gateway，也可以作为服务间代理。它不规定服务如何注册，控制面通过静态配置或 xDS 动态下发网络配置。

### 1.1 Envoy 服务本身是什么形态

Envoy Proxy 是一个独立的可执行程序，与 Nginx 类似。在 Kubernetes 中通常把它放进容器，由 Pod 运行：

```text
Envoy 软件 → Envoy Container → Envoy Pod
```

作为集群入口时，常见部署形态是：

```text
Envoy Deployment
├── Envoy Pod 1：运行 Envoy Proxy 进程
└── Envoy Pod 2：运行 Envoy Proxy 进程
          ↑
LoadBalancer Service：对外暴露 Envoy Pod
```

原生 Envoy 只是代理进程，不会自动创建 Deployment、Pod 或 Service，也不会直接把 Kubernetes `HTTPRoute` 转换成配置。这些资源需要人工创建，或者由 Envoy Gateway、Istio 等控制面管理。

### 1.2 用两个业务服务理解代理过程

假设一个 Envoy 入口同时代理用户服务和订单服务：

```text
Client
  ↓
Envoy LoadBalancer Service
  ↓
Envoy Pod（Envoy Proxy 进程）
  ├── /users  → Cluster: user-service  → user Pod
  └── /orders → Cluster: order-service → order Pod
```

一个 Envoy Pod 可以配置多个 Cluster，因此可以代理多个不同的业务服务。每个 Cluster 通常表示一个逻辑服务，Cluster 中的 Endpoint 表示该服务的多个实例。

```text
配置：静态文件或外部控制面 → xDS → Envoy 内存
请求：Client → Envoy Service → Envoy Pod → Cluster → Endpoint
```

## 2. 核心抽象

```text
Listener → Filter Chain → Route → Cluster → Endpoint
```

| 抽象 | 作用 |
| --- | --- |
| Listener | 在 IP/端口上接收连接 |
| Filter Chain | 根据协议、TLS、SNI 选择过滤器链 |
| HTTP Connection Manager | 把连接解析为 HTTP 请求并执行 HTTP Filter |
| Route | 根据 Host、Path、Header 选择 Cluster |
| Cluster | 一组具有相同策略的后端服务 |
| Endpoint | Cluster 中的实际 IP/端口实例 |
| Filter | 在网络、HTTP 或响应阶段执行扩展 |

### 2.1 Cluster 到底表示什么

`Cluster` 不是一个 Pod，也不是“一个 Envoy 只能代理的一组服务”。它是 Envoy 对一类后端服务的逻辑分组，通常表示同一个服务的多个实例；`Endpoint` 才是这个服务的具体实例地址。

例如，用户服务有三个实例：

```text
Cluster: user-service
├── Endpoint: 10.0.1.10:8080
├── Endpoint: 10.0.2.15:8080
└── Endpoint: 10.0.3.21:8080
```

同一个 Envoy 可以同时配置多个 Cluster，并根据不同 Route 把请求发送到不同服务：

```text
/users  → Cluster user-service  → 多个 user Endpoint
/orders → Cluster order-service → 多个 order Endpoint
```

因此，Envoy 的代理范围取决于部署方式：

| 部署方式 | 一个 Envoy 通常代理什么 |
| --- | --- |
| 边缘 Gateway | 一个入口下的多个后端服务，也就是多个 Cluster |
| Sidecar | 所在 Pod 的进出流量，但可以访问多个 Cluster |
| 独立服务代理 | 某个服务的流量，Cluster 通常对应该服务的多个实例 |

Sidecar 不是“代理 Pod 内的所有不同服务”。一个 Pod 通常只运行一个业务服务和一个 Sidecar；Sidecar 代理的是这个 Pod 发出和接收的网络流量，并可能把请求转发到很多不同的 Cluster。

## 3. 整体架构与配置存储

```text
控制面（服务发现、策略、证书） → xDS → Envoy 数据面 → 后端 Endpoint
```

Envoy 启动时从 bootstrap 文件获得 Listener、管理服务器地址和静态资源。运行中可通过 xDS 更新：LDS（Listener）、RDS（HTTP Route）、CDS（Cluster）、EDS（Endpoint）、SDS（证书和密钥）。ADS 可在一条 gRPC 流上承载多类 xDS。

配置加载到 Envoy 本地内存，请求路径不需要每次访问控制面；控制面暂时不可用时，已生效配置仍可继续服务。

## 4. 代理层级与协议

Envoy 可在 L4 处理 TCP/UDP，也可在 L7 解析 HTTP/1.1、HTTP/2、HTTP/3、gRPC 和 WebSocket。

```text
Listener → Filter Chain → HTTP Connection Manager
                              ├─ HTTP Filters
                              └─ Route → Cluster → Endpoint
```

常见 HTTP Filter 包括 Router、重试、超时、限流、JWT、CORS、故障注入、请求镜像和外部授权。

## 5. 请求处理流程

```text
1. 客户端连接 Listener
2. Listener 按端口和 TLS/SNI 选择 Filter Chain
3. HTTP Connection Manager 解析请求
4. HTTP Filters 执行认证、改写、限流等策略
5. Route 根据 Host/Path/Header 选择 Cluster
6. Cluster 按健康状态和负载均衡策略选择 Endpoint
7. Router 转发请求并处理重试、超时和响应
8. 日志、指标和 Trace Filter 记录结果
```

Envoy 把监听、路由、后端池、实例发现和过滤器拆成可动态组合的资源。原生配置较复杂，通常由 Envoy Gateway、Istio 或其他控制面生成。

官方文档：[Architecture overview](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/)、[Dynamic configuration](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/operations/dynamic_configuration)、[xDS protocol](https://www.envoyproxy.io/docs/envoy/latest/api-docs/xds_protocol)。
