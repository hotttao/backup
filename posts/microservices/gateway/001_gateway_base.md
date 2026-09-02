---
weight: 1
title: "1 Gateway 能力和选型"
date: 2026-08-29T08:00:00+08:00
lastmod: 2026-08-29T0:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "先理解 Gateway 的职责，再根据部署环境和业务需求选型"
tags: ["gateway"]
categories: ["microservice"]
toc:
  auto: false
---

Gateway 选型应按以下顺序进行：

```text
需要哪些能力
    ↓
哪些组件能提供这些能力
    ↓
组件处理南北流量还是东西流量
    ↓
结合部署环境做选择
```

<!-- more -->

## 1. Gateway 的能力边界

Gateway 接收请求、执行入口策略，再把请求转发到后端服务。可以把能力归纳为六类：

```text
Gateway
├── Traffic Management：路由、负载均衡、超时、重试、灰度、限流
├── Security：TLS/mTLS、JWT/OIDC、API Key、AuthN/AuthZ、WAF
├── API Management：Consumer、版本、配额、订阅、Portal、Analytics
├── Service Integration：Docker、Kubernetes、Consul、DNS、静态地址
├── Observability：Access Log、Metrics、Trace、Audit
└── Platform：Gateway API、插件、动态配置、HA、GitOps
```

| 能力域 | 解决的问题 | 什么时候是重点 |
| --- | --- | --- |
| Traffic Management | 请求如何匹配、转发和容错 | 所有 Gateway |
| Security | 谁可以进入系统、如何保护连接 | 所有生产入口 |
| Service Integration | 如何发现后端实例 | 后端会扩缩容或跨主机时 |
| Observability | 如何定位延迟、错误和流量 | 所有生产环境 |
| Platform | 如何部署、升级和扩展 Gateway | 多团队或长期运营时 |
| API Management | 如何管理 API 调用方和生命周期 | 对外开放 API 时 |

最容易混淆的是：

```text
Traffic Management = 管理请求怎么走
API Management     = 管理谁在调用哪个 API，以及配额和生命周期
```

## 2. 组件定位

这些组件不在同一层次，应先按职责理解：

| 组件 | 核心定位 | 配置/发现方式 | 东西流量能力 |
| --- | --- | --- | --- |
| Traefik | 易用的应用入口 | Docker、Kubernetes、Consul、文件 Provider | 通常由服务网络直连 |
| Envoy Gateway | Kubernetes 标准 Gateway | Gateway API，控制托管 Envoy | 不负责完整 Mesh |
| APISIX / Kong / Higress | API Gateway 与 API Management | Route、Service、Consumer、Plugin | 默认不是透明 Mesh |
| Cilium Gateway API | CNI 集成的 Gateway | Kubernetes Gateway API + eBPF/Envoy | Cilium 网络策略 |
| Istio | Service Mesh 与 Mesh Gateway | Istio CRD、Gateway API、xDS | 身份、mTLS、L7 治理 |

组件能力的关系可以这样理解：

```text
                         Traffic Management
                                 ↑
                           Istio / Envoy
                                 │
                    Traefik ────┼──── APISIX / Kong
                                 │
                              Cilium
                                 ↓
                         Network Integration
```

不要以“功能最多”为选型标准，而要先确定 Gateway 的主要职责：基础入口、微服务流量治理，还是 API 平台。

## 3. Docker 场景

### 3.1 单机 Docker：Traefik

Traefik 的 Docker Provider 读取容器 Label，生成 Router、Middleware 和 Service：

```text
南北流量：Client → Traefik → Docker Container
东西流量：Container A → Docker Network/DNS → Container B
```

它适合单机或少量主机：自动发现容器、配置简单、支持 TLS 和基础流量治理。内部服务调用不必绕行 Traefik。

### 3.2 多机 Docker：增加 Consul

一个 Docker Engine 看不到其他主机的容器。让服务注册到 Consul，再由 Gateway 消费统一的服务目录：

```text
Host A: Service A ──┐
Host B: Service B ──┼──→ Consul Catalog
Host C: Service C ──┘          ↓
                         Gateway 发现健康实例
```

| 方案 | Gateway 主要职责 | 适用情况 |
| --- | --- | --- |
| Traefik + Consul | 路由、TLS、限流、负载均衡 | 只需要 Traffic Management |
| APISIX + Consul | API Consumer、认证、配额、插件 | 需要 API Management |
| Envoy + Consul/xDS | 高级重试、熔断、故障摘除 | 追求流量治理上限且能接受复杂度 |

东西流量默认通过 Consul DNS/Catalog 直连；只有确实需要统一 API 策略的内部 API，才让调用经过 APISIX 等 Gateway。

## 4. Kubernetes 场景

Kubernetes 已通过 Service 和 EndpointSlice 提供服务发现，通常不需要为了 Gateway 再部署 Consul。

### 4.1 普通入口：Envoy Gateway

```text
南北流量：External LB → Envoy Gateway → Kubernetes Service → Pod
东西流量：Pod A → Kubernetes Service/CNI → Pod B
```

Envoy Gateway 用 Gateway API 管理入口，适合需要标准资源和较强流量治理、但暂时不需要 Service Mesh 的集群。

### 4.2 已使用 Cilium：Cilium Gateway API

```text
外部请求 → eBPF → Cilium Envoy → Service/Pod
Pod A   → eBPF / NetworkPolicy → Pod B
```

Cilium 将 Gateway 与 CNI、NetworkPolicy 和 Hubble 集成。已有 Cilium 时，应先判断其 Gateway API 是否满足入口需求，再决定是否增加独立 Envoy Gateway。

### 4.3 需要东西流量治理：Cilium + Istio Ambient

```text
南北：Client → Ingress Gateway → Service
东西：Service A → ztunnel → waypoint（需要 L7 时）→ ztunnel → Service B
```

Cilium 负责 Pod 网络和网络策略，Istio Ambient 负责工作负载身份、mTLS 和 Mesh 策略。加入 Istio 的原因是东西流量需求，而不是单纯为了获得一个入口 Gateway。

### 4.4 对外 API 平台

```text
Client → APISIX/Kong/Higress → Consumer/Plugin/Quota → Kubernetes Service
```

API Gateway 管理对外 API；服务间流量仍由 Kubernetes Service、CNI 或 Service Mesh 处理。

## 5. 选型结论

| 场景 | 南北流量 | 东西流量 | 推荐方案 |
| --- | --- | --- | --- |
| 单机 Docker | 自动发现容器并路由 | Docker Network 直连 | Traefik |
| 多机 Docker，普通入口 | Gateway + Consul 发现 | Consul 直连 | Traefik + Consul |
| 多机 Docker，API 平台 | Consumer/Plugin + Consul | Consul 直连 | APISIX + Consul |
| 多机 Docker，流量治理上限 | Envoy + xDS | Consul/服务网络 | Envoy + Consul/xDS |
| Kubernetes，普通微服务 | Gateway API | Service + CNI | Envoy Gateway |
| Kubernetes，已有 Cilium | Cilium Gateway API | Cilium eBPF | Cilium Gateway API |
| Kubernetes，需要 Service Mesh | Ingress Gateway | ztunnel + waypoint | Cilium + Istio Ambient |
| Kubernetes，对外 API 平台 | API Gateway + Consumer | CNI 或 Istio | APISIX / Kong / Higress |

最终判断链：

```text
Docker 自动发现       → Traefik
跨多台 Docker 主机     → 增加 Consul
多机且需要 API 管理    → APISIX + Consul
进入 Kubernetes        → Envoy Gateway
已有 Cilium            → 先复用 Cilium Gateway API
需要 mTLS/东西流量治理 → 增加 Istio Ambient
```

选型的关键是划分职责：Gateway 处理南北流量，服务网络或 Mesh 处理东西流量，API Management 只在确有 API 产品化需求时引入。
