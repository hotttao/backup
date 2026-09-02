---
weight: 1
title: "1 gateway 能力和选型"
date: 2026-08-29T08:00:00+08:00
lastmod: 2026-08-29T0:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "先理解 Gateway 应该包含哪些能力，再根据业务规模和部署环境进行选型"
featuredImage: 

tags: ["gateway"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---



Gateway 选型不能直接从产品名称开始，而应该按照下面的顺序推导：

```text
系统需要哪些 Gateway 能力
          ↓
哪些组件能够提供这些能力
          ↓
组件负责南北流量还是东西流量
          ↓
根据部署环境和业务需求做选择
```

本文依次回答这四个问题，并最终给出单机 Docker、多机 Docker 和 Kubernetes 下的选型结论。

<!-- more -->

## 1. Gateway 应该具备哪些能力

Gateway 的基本职责是接收请求、执行入口策略，再把请求转发到正确的服务。从选型角度，可以把能力归纳成六类：

```text
Gateway
├── Traffic Management
│   ├── Routing / Rewrite / Load Balancing
│   ├── Timeout / Retry / Circuit Breaker
│   ├── Rate Limit / Connection Limit
│   └── Canary / Traffic Mirror / Failover
├── Security
│   ├── TLS / mTLS
│   ├── JWT / OAuth2 / OIDC / API Key
│   └── External Auth / IP ACL / WAF
├── API Management
│   ├── Consumer / Application
│   ├── API Version / Subscription / Quota
│   └── Developer Portal / Analytics / Audit
├── Service Integration
│   └── Docker / Consul / DNS / Kubernetes
├── Observability
│   └── Access Log / Metrics / Trace
└── Platform Capability
    └── Dynamic Config / HA / Plugin / GitOps
```

| 能力 | 解决的问题 | 是否为基础能力 |
| --- | --- | --- |
| Traffic Management | 请求怎么走，后端异常怎么办 | 是 |
| Security | 请求能否进入系统 | 是 |
| Service Integration | 后端实例在哪里 | 是 |
| Observability | 请求发生了什么 | 是 |
| Platform Capability | Gateway 如何部署、扩展和升级 | 是 |
| API Management | 哪个 Consumer 以什么配额调用哪个 API | 只在 API 产品化时需要 |

最重要的区别是：

```text
Traffic Management = 管理请求
API Management     = 管理 API 及其 Consumer
```

如果系统只有自己的 Web 前端，通常不需要完整的 Consumer、Subscription 和 Developer Portal。向第三方开放 API，并且需要给不同客户配置 API Key、Quota 和插件策略时，API Management 才成为核心需求。

## 2. 有哪些组件可供选择

这些组件并不处于同一个层次，可以先按定位分组：

```text
基础流量入口
└── Traefik / Envoy Gateway

API Gateway / API Management
└── APISIX / Kong / Higress

Kubernetes 网络与 Gateway
└── Cilium Gateway API

Service Mesh 与 Mesh Gateway
└── Istio
```

### 2.1 能力对比

| 组件 | 核心定位 | Traffic Management | API Management | 服务发现与部署 | 东西流量 |
| --- | --- | --- | --- | --- | --- |
| Traefik | 易用的应用入口 | 路由、负载均衡、Middleware、基础灰度 | 较弱，不以 Consumer 为核心 | Docker、Consul、Kubernetes Provider | 不透明接管，服务通常直连 |
| Envoy Gateway | 标准化应用 Gateway | Envoy 的路由、流量策略和扩展能力 | 不是完整 API 管理平台 | 重点支持 Kubernetes Gateway API | 不负责 Mesh，需要其他组件 |
| APISIX | 插件化 API Gateway | 路由、Upstream、限流、灰度、熔断 | 强，提供 Consumer 和插件模型 | Docker 可部署，支持 Consul 和 Kubernetes | 可代理指定内部 API，但不是透明 Mesh |
| Kong | API Gateway / API Management | Route、Service、Upstream、Plugin | 强，提供 Consumer、Credential 和插件 | Docker、VM、Kubernetes | Kong Gateway 不负责透明 Mesh |
| Higress | 云原生 API/流量/AI Gateway | 路由、灰度、流量策略 | 强，提供 API 生命周期和插件 | 重点面向 Kubernetes | 不替代完整 Service Mesh |
| Cilium Gateway API | CNI 集成的 Kubernetes Gateway | Gateway API、L7 路由和策略 | 不以 Consumer/Portal 为核心 | 与 Cilium 网络栈集成 | Cilium 负责 L3/L4 网络和策略 |
| Istio | Service Mesh + Ingress/Egress Gateway | 强，统一入口和服务间流量策略 | 不以 API Consumer 运营为核心 | Kubernetes、VM、Gateway API | 强，提供身份、mTLS 和流量治理 |

下面分别解释这些组件为什么会出现在候选列表中。


**能力地图**，重点不是罗列功能，而是按架构层次组织。

```text
                              Gateway 选型能力地图

┌──────────────────────────────────────────────────────────────────────┐
│                              Gateway                                 │
└──────────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐        ┌────────────────┐        ┌────────────────┐
│ Traffic       │        │ Security       │        │ API Management │
│ Management    │        │                │        │                │
└───────────────┘        └────────────────┘        └────────────────┘
        │                         │                         │
        │                         │                         │
        ├─ Routing               ├─ TLS / HTTPS            ├─ API 发布
        ├─ Load Balancing        ├─ mTLS                   ├─ API 版本
        ├─ Traffic Split         ├─ JWT                    ├─ Consumer
        ├─ Canary                ├─ OAuth2 / OIDC          ├─ Application
        ├─ Retry                 ├─ API Key                ├─ Subscription
        ├─ Timeout               ├─ AuthN                  ├─ Quota
        ├─ Circuit Breaker       ├─ AuthZ                  ├─ Developer Portal
        ├─ Outlier Detection     ├─ RBAC / ABAC            ├─ API Analytics
        ├─ Rate Limit            ├─ IP ACL                 └─ API Lifecycle
        ├─ Failover              └─ WAF
        ├─ Traffic Mirror
        ├─ Fault Injection
        ├─ Connection Pool
        ├─ Backpressure
        └─ Locality Routing


        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌────────────────┐       ┌────────────────┐        ┌────────────────┐
│ Protocol       │       │ Service        │        │ Observability  │
│ Capability     │       │ Integration    │        │                │
└────────────────┘       └────────────────┘        └────────────────┘
        │                         │                         │
        ├─ HTTP/1.1              ├─ Kubernetes             ├─ Access Log
        ├─ HTTP/2                ├─ Docker                 ├─ Metrics
        ├─ HTTP/3                ├─ Consul                 ├─ Tracing
        ├─ gRPC                  ├─ DNS                    ├─ OpenTelemetry
        ├─ WebSocket             ├─ Static Endpoint        ├─ Prometheus
        ├─ SSE                   ├─ VM / Physical Server   ├─ Dashboard
        ├─ TCP                   ├─ Multi-cluster          └─ Audit Log
        ├─ UDP                   └─ Multi-region
        └─ TLS Passthrough


        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌────────────────┐       ┌────────────────┐        ┌────────────────┐
│ Platform       │       │ Extensibility  │        │ Operations     │
│ Architecture   │       │                │        │                │
└────────────────┘       └────────────────┘        └────────────────┘
        │                         │                         │
        ├─ Gateway API           ├─ Plugin                 ├─ HA
        ├─ Ingress               ├─ WASM                   ├─ Rolling Upgrade
        ├─ CRD                   ├─ Lua                    ├─ Graceful Shutdown
        ├─ Declarative Config    ├─ External Processing    ├─ Connection Draining
        ├─ GitOps                ├─ Middleware             ├─ Config Hot Reload
        ├─ Control/Data Plane    └─ Custom Policy          ├─ Backup / Restore
        └─ Multi-tenancy                                  ├─ Upgrade Complexity
                                                           └─ Resource Cost


                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Performance      │
                         └──────────────────┘
                                  │
                                  ├─ QPS
                                  ├─ p50 / p95 / p99
                                  ├─ CPU / Request
                                  ├─ Memory
                                  ├─ TLS Performance
                                  ├─ Long Connections
                                  ├─ Large Payload
                                  ├─ Streaming
                                  └─ Config Scale
```

如果作为**架构师选型**，我会进一步把这些能力分成三个优先级。

| 优先级    | 能力域                  | 为什么重要                |
| ------ | -------------------- | -------------------- |
| **P0** | Traffic Management   | Gateway 最核心能力        |
| **P0** | Protocol             | 决定业务能不能跑             |
| **P0** | Security             | 入口层基本要求              |
| **P0** | HA / Performance     | 决定生产可用性              |
| **P1** | Service Discovery    | 决定如何和基础设施集成          |
| **P1** | Observability        | 决定问题能不能定位            |
| **P1** | Gateway API / GitOps | 决定长期维护成本             |
| **P1** | Extensibility        | 决定以后能不能扩展            |
| **P2** | API Management       | 对开放 API/平台型业务非常重要    |
| **P2** | Admin UI             | 运维体验，不是 Gateway 核心能力 |
| **P2** | Developer Portal     | 主要面向 API 平台          |
| **P2** | AI Gateway           | AI 场景才需要重点考虑         |

再进一步，我建议把 Gateway 产品按照**能力中心**来理解：

```text
                       Gateway 产品能力定位

                   Traffic Management
                          ↑
                          │
                    Istio │
                          │
             Envoy Gateway
                          │
                    Higress
                          │
 Traefik ─────────────────┼────────────────→ API Management
                          │                  Kong
                          │
                          │                  APISIX
                          │
                          │
                        Cilium
                          │
                          ↓
                  Network Integration
```

可以粗略理解为：

| 产品                | 最核心能力                               |
| ----------------- | ----------------------------------- |
| **Istio**         | Traffic Management / Resilience     |
| **Envoy Gateway** | Gateway API + Traffic Management    |
| **Traefik**       | 易用性 + Traffic Management            |
| **Higress**       | Traffic Management + API Management |
| **Kong**          | API Management                      |
| **APISIX**        | API Management + Plugin             |
| **Cilium**        | Network + Gateway                   |
| **NGINX**         | 高性能反向代理 / 基础 Traffic                |
| **HAProxy**       | 高性能 L4/L7 Load Balancing            |


### 2.2 Traefik

Traefik 的优势是 Provider 模型。它可以观察 Docker、Consul Catalog 和 Kubernetes，并把 labels、tags 或 Gateway API 资源转换成动态路由。[Traefik Provider](https://doc.traefik.io/traefik/reference/install-configuration/providers/overview/)

```text
Provider
   ↓
Router → Middleware → Service
```

它适合做微服务流量入口，但 Consumer、Subscription 和 API 生命周期不是它的核心模型。

### 2.3 Envoy Gateway

直接配置 Envoy 的 Listener、Route、Cluster 和 xDS 成本较高。Envoy Gateway 在它之上提供控制面，主要通过 Kubernetes Gateway API 管理 Envoy 数据面。[Envoy Gateway](https://gateway.envoyproxy.io/docs/concepts/gateway-api/)

它适合需要标准 Gateway API 和较强 Traffic Management，但不需要完整 API Management 的 Kubernetes 集群。

### 2.4 APISIX、Kong 与 Higress

这三者更偏向 API Gateway：除了转发流量，还把 Route、Service、Consumer 和 Plugin 作为核心对象。

```text
APISIX：Route → Plugin → Upstream
Kong：  Route → Service → Upstream
Higress：Route / Gateway API → Plugin → Backend
```

- APISIX 的插件可以绑定 Route、Service 或 Consumer，并支持 Consul 服务发现。[APISIX Plugin](https://apisix.apache.org/docs/apisix/terminology/plugin/)
- Kong 通过 Service、Route、Consumer 和 Plugin 组织 API Gateway 配置。[Kong Gateway](https://docs.konghq.com/gateway/latest/)
- Higress 同时强调流量网关、API 生命周期和插件扩展。[Higress API Gateway](https://higress.cn/en/api-gateway)

三者的具体差异需要单独实验；在本篇选型中，只需要先把它们归为“API Management 需求明显时的候选组件”。

### 2.5 Cilium Gateway API

Cilium 首先是 CNI，负责 Pod 网络、网络策略和可观测，同时可以通过 Envoy 实现 Gateway API。[Cilium Gateway API](https://docs.cilium.io/en/stable/network/servicemesh/gateway-api/gateway-api/)

它的价值不只是 Gateway 功能，而是入口流量与现有 Cilium 网络数据面共用一套基础设施。

### 2.6 Istio

Istio 同时包含两类能力：Ingress/Egress Gateway 处理 Mesh 边界，Service Mesh 数据面处理东西流量。[Istio Traffic Management](https://istio.io/latest/docs/concepts/traffic-management/)

Ambient 模式下，`ztunnel` 提供 L4 身份、mTLS 和授权；需要 HTTP 路由、Retry、Circuit Breaker 或 L7 授权时，再引入 waypoint。[Istio Ambient](https://istio.io/latest/docs/ambient/overview/)

因此 Istio 的选型原因应该是“需要治理东西流量”，而不只是“需要一个入口 Gateway”。

## 3. Docker 场景如何选择

### 3.1 单机 Docker：Traefik

单机中，Traefik 通过 Docker Provider 读取容器 labels，自动生成 Router、Middleware 和 Service。[Traefik Docker Provider](https://doc.traefik.io/traefik/providers/docker/)

```text
南北流量
Client → Traefik → Docker Container

东西流量
Container A → Docker DNS / Network → Container B
```

Gateway 只处理外部进入系统的流量。内部服务调用不应该绕到 Traefik，否则会增加一次无意义的网络跳转。

选择 Traefik 的原因：

1. 与 Docker Compose labels 直接集成。
2. 容器扩缩容时不需要维护 IP。
3. 已覆盖单机需要的路由、TLS、负载均衡和 Middleware。
4. 不需要额外部署注册中心和 API 管理控制面。

### 3.2 多机 Docker：为什么需要 Consul

一个 Docker Engine 看不到其他主机上的容器。不建议让 Gateway 连接每台主机的 Docker Socket，而应该让服务统一注册到 Consul：

```text
Host A: Service A ──register──┐
Host B: Service B ──register──┼──► Consul Catalog
Host C: Service C ──register──┘
```

Consul 维护服务实例和健康状态，Gateway 消费这些信息。接下来根据是否需要 API Management，在两种方案之间选择。

### 3.3 多机 Docker：Traefik + Consul

```text
南北流量
Client
  → Traefik
  → 从 Consul Catalog 取得健康实例
  → Service

东西流量
Service A
  → Consul DNS / Catalog 查询 Service B
  → Service B
```

Traefik 使用 Consul Catalog Provider，根据服务 tags 生成路由。[Traefik Consul Catalog](https://doc.traefik.io/traefik/providers/consul-catalog/)

适合：以 Traffic Management 为主，不需要 Consumer、API Key 和 API 生命周期管理。这是多机 Docker 的默认方案。

### 3.4 多机 Docker：APISIX + Consul

```text
南北流量
Client
  → APISIX Route
  → Authentication / Rate Limit Plugin
  → Consul Upstream
  → Service

东西流量
Service A
  → Consul DNS / Catalog
  → Service B
```

APISIX 通过 `service_name + discovery_type=consul` 动态解析 Upstream。[APISIX Consul Discovery](https://apisix.apache.org/docs/apisix/discovery/consul/)

默认情况下，东西流量仍然通过 Consul 直连。只有某些内部 API 也必须执行统一 Consumer、认证或限流策略时，才让这些调用经过 APISIX；不应强制所有服务调用都绕行 API Gateway。

适合：需要 Consumer、API Key、调用方级限额和插件化 API 策略。

| 判断问题 | Traefik + Consul | APISIX + Consul |
| --- | --- | --- |
| 主要需求 | Traffic Management | API Management |
| 服务发现 | Consul Catalog | Consul Upstream |
| Consumer / API Key | 不是核心模型 | 核心模型 |
| 运维复杂度 | 较低 | 较高 |
| 东西流量 | 服务通过 Consul 直连 | 默认仍通过 Consul 直连 |

## 4. Kubernetes 场景如何选择

Kubernetes 已经提供 Service 和 EndpointSlice，因此不需要为了 Gateway 再部署 Consul。这里需要分别选择南北流量入口和东西流量治理方式。

### 4.1 Envoy Gateway + 普通 CNI

```text
南北流量
External Load Balancer
  → Envoy Gateway
  → Kubernetes Service
  → Pod

东西流量
Pod A
  → Kubernetes Service / CNI
  → Pod B
```

Envoy Gateway 只处理入口流量，东西流量仍由 Kubernetes Service 和 CNI 完成。适合需要标准 Gateway API、较强 Traffic Management，但暂时不需要 Service Mesh 的集群。

### 4.2 Cilium Gateway API

```text
南北流量
External Traffic
  → Cilium eBPF
  → Cilium Envoy Gateway
  → Service / Pod

东西流量
Pod A
  → Cilium eBPF / NetworkPolicy
  → Pod B
```

如果已经使用 Cilium，应先判断 Cilium Gateway API 是否满足入口需求。满足时不必再增加 Envoy Gateway；缺少所需的高级入口策略时，再部署独立 Gateway。

### 4.3 Cilium + Istio Ambient

当系统需要服务身份、mTLS 和东西流量治理时，可以让 Cilium 管网络，Istio Ambient 管 Mesh：

```text
南北流量
Client
  → Istio Ingress Gateway（或独立 Gateway）
  → destination waypoint（按需）
  → Service

东西流量
Service A
  → source ztunnel
  → destination waypoint（需要 L7 时）
  → destination ztunnel
  → Service B
```

这里必须明确：Cilium 解决 Pod 网络和 NetworkPolicy，Istio 解决 workload identity、mTLS 和 L7 Mesh Policy。Istio 是因为东西流量需求而加入，不是因为 Envoy Gateway“不够强”。

### 4.4 Kubernetes API Management

如果目标是对外 API 平台，可以把 APISIX、Kong 或 Higress 部署为南北流量入口：

```text
南北流量
Client
  → APISIX / Kong / Higress
  → Consumer / Plugin / Quota
  → Kubernetes Service

东西流量
Pod A
  → Kubernetes Service / Cilium / Istio
  → Pod B
```

API Gateway 管理对外 API，东西流量继续由 CNI 或 Service Mesh 管理。不要因为选择了 Kong、APISIX 或 Higress，就默认所有服务间调用也必须经过它。

## 5. 场景化选型结论

现在可以从能力和流量边界推导出结论：

| 场景 | 南北流量 | 东西流量 | 推荐方案 |
| --- | --- | --- | --- |
| 单机 Docker | 自动发现容器并路由 | Docker Network 直连 | Traefik |
| 多机 Docker，流量入口 | Gateway + Consul 服务发现 | Consul 发现后直连 | Traefik + Consul |
| 多机 Docker，API 管理 | Consumer/Plugin + Consul Upstream | Consul 发现后直连 | APISIX + Consul |
| Kubernetes，普通微服务 | 标准 Gateway API | Kubernetes Service + CNI | Envoy Gateway |
| Kubernetes，已有 Cilium | Cilium Gateway API | Cilium eBPF / NetworkPolicy | Cilium Gateway API |
| Kubernetes，需要 Mesh | Istio 或独立 Ingress Gateway | ztunnel + waypoint | Cilium + Istio Ambient |
| Kubernetes，API 平台 | API Gateway 管理 Consumer | CNI 或 Istio | APISIX / Kong / Higress |

最后形成一条完整的判断链：

```text
只需要 Docker 自动发现
  → Traefik

跨多台 Docker 主机
  → 增加 Consul
  → 只管理流量选 Traefik
  → 管理 API Consumer 选 APISIX

进入 Kubernetes
  → 普通入口选 Envoy Gateway
  → 已有 Cilium 先复用 Cilium Gateway API
  → 需要 API Management 选 APISIX / Kong / Higress
  → 需要治理东西流量再增加 Istio Ambient
```

选型的关键不是哪个组件功能最多，而是每个组件是否有明确职责，以及南北流量和东西流量是否各自由正确的组件处理。
