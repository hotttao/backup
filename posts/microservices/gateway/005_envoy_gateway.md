---
weight: 5
title: "5 Envoy Gateway 架构与请求流程"
date: 2026-08-29T08:00:00+08:00
draft: false
description: "从资源所有权、配置编译和请求路径理解 Envoy Gateway"
tags: ["gateway", "envoy-gateway"]
categories: ["microservice"]
---

## 1. Envoy Gateway 的定位

Envoy Gateway 是 **Envoy 的 Kubernetes 控制面**，不是处理业务请求的代理。

```text
Envoy Gateway Controller = 读取声明、管理数据面、生成 xDS
Envoy Proxy              = 执行 Listener、Route、Filter 和负载均衡
```

原生 Envoy 只提供数据面。使用者需要自行创建 Envoy 进程、组织 Listener/Route/Cluster/Endpoint 配置，并维护 xDS Server。Envoy Gateway 在此之上提供三项能力：

1. 使用 Kubernetes Gateway API 表达入口需求。
2. 创建和维护 Envoy 数据面的 Kubernetes 资源。
3. 将 Gateway API 编译成 Envoy xDS 配置并动态下发。

## 2. 示例和整体架构

假设集群中有两个业务服务：

```text
GET api.example.com/users/*  → user-service
GET api.example.com/orders/* → order-service
```

系统中实际存在三组工作负载：

```text
┌─────────────────────────────────────────────────────────────┐
│ 控制面                                                      │
│                                                             │
│ Envoy Gateway Deployment                                    │
│ └── Envoy Gateway Controller Pod                            │
│     ├── Watch Gateway API、Service、EndpointSlice           │
│     ├── Reconcile Envoy Deployment / Service                │
│     └── Gateway API → xDS                                   │
└───────────────────────────┬─────────────────────────────────┘
                            │ 创建、配置
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Gateway 数据面                                              │
│                                                             │
│ Envoy Service                                              │
│          │                                                  │
│ Envoy Deployment                                           │
│ ├── Envoy Pod 1 ─┐                                         │
│ └── Envoy Pod 2 ─┴── 同一组 Listener、Route 和 Cluster     │
└───────────────────────────┬─────────────────────────────────┘
                            │ 代理请求
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 业务服务                                                    │
│                                                             │
│ user-service  → user Pod 1 / user Pod 2                     │
│ order-service → order Pod 1 / order Pod 2                   │
└─────────────────────────────────────────────────────────────┘
```

Envoy Pod 不是为某个后端服务创建的。它是 Gateway 的代理副本，一个 Envoy 数据面可以同时包含 `user-service`、`order-service` 等多个 Cluster。

### 2.1 Gateway 与 Envoy 数据面的对应关系

默认情况下，Controller 为每个 `Gateway` 创建一套独立的数据面：

```text
GatewayClass: envoy
├── Gateway: public-api
│   ├── Envoy Deployment A
│   └── Envoy Service A
│
└── Gateway: internal-api
    ├── Envoy Deployment B
    └── Envoy Service B
```

同一个 `Gateway` 可以包含多个 Listener，也可以绑定多个 HTTPRoute。这些 Listener 和 Route 共用该 Gateway 对应的 Envoy Deployment 与 Service，不会为每条 HTTPRoute 创建新的 Envoy。

```text
Gateway: public-api
├── Listener :80
├── Listener :443
├── HTTPRoute: user-route
└── HTTPRoute: order-route
        ↓
共用 Envoy Deployment A + Envoy Service A
```

如果在 `EnvoyProxy` 中显式启用 `mergeGateways`，同一个 GatewayClass 下的多个 Gateway 可以合并到一套 Envoy 数据面：

```text
Gateway: public-api  ──┐
Gateway: partner-api ──┼──→ 一套 Envoy Deployment + Service
Gateway: admin-api   ──┘
```

因此，回答“是否共用”时必须带上部署模式：**默认每个 Gateway 独立；启用合并模式后多个 Gateway 共用。**

## 3. 谁创建什么

整个生命周期分为安装阶段和业务配置阶段。

### 3.1 安装 Envoy Gateway

Helm 或安装清单创建控制面：

```text
Helm
└── Envoy Gateway Deployment
    └── Envoy Gateway Controller Pod
```

Controller 此时开始监听 Kubernetes API。它本身不接收 `api.example.com` 的请求。

### 3.2 创建 Gateway

用户提交 `GatewayClass` 和 `Gateway` 后，Controller Reconcile 出一套数据面资源：

```text
GatewayClass + Gateway
          ↓
Envoy Gateway Controller
├── Envoy Deployment
├── Envoy Service
├── ServiceAccount 等配套资源
└── Envoy xDS 配置
```

Envoy Service 为这一组 Envoy Pod 提供稳定入口。Service 的类型属于数据面暴露策略，可以通过 `EnvoyProxy` 调整；默认值是 `LoadBalancer`，但这只是部署默认值，不影响 Envoy Gateway 的控制面模型。

所以要区分两个责任主体：

| 资源 | 负责创建或维护的组件 |
| --- | --- |
| Envoy Gateway Controller Deployment | Helm/安装清单 |
| GatewayClass、Gateway、HTTPRoute | 平台或应用团队 |
| Envoy Deployment、Pod、Service | Envoy Gateway Controller |
| Service 的外部负载均衡地址 | 云控制器、MetalLB、Cilium 等 |
| user/order Deployment、Service | 业务团队 |

## 4. Gateway API 如何表达示例

### 4.1 GatewayClass：选择控制器

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: envoy
spec:
  controllerName: gateway.envoyproxy.io/gatewayclass-controller
```

`GatewayClass` 把一类 Gateway 交给 Envoy Gateway Controller 管理。

### 4.2 Gateway：声明监听入口

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: public-api
spec:
  gatewayClassName: envoy
  listeners:
    - name: http
      protocol: HTTP
      port: 80
```

`Gateway` 表达期望的 Listener，同时触发 Controller 创建 Envoy 数据面。它自身不是代理进程。

### 4.3 HTTPRoute：声明路由关系

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: shop-api
spec:
  parentRefs:
    - name: public-api
  hostnames:
    - api.example.com
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /users
      backendRefs:
        - name: user-service
          port: 8080
    - matches:
        - path:
            type: PathPrefix
            value: /orders
      backendRefs:
        - name: order-service
          port: 8080
```

`parentRefs` 将 Route 绑定到入口，`backendRefs` 将 Route 绑定到后端 Service。

## 5. 配置编译流程

Controller 同时观察 Gateway API 和后端发现信息，并将它们组合成 Envoy 配置：

```text
GatewayClass / Gateway / HTTPRoute
Service / EndpointSlice / Secret
                  │
                  ▼
       Envoy Gateway Controller
       1. 校验引用关系和权限
       2. 构建统一路由模型
       3. 生成 Envoy xDS 资源
                  │
                  ▼
          Envoy Proxy 本地内存
```

核心映射是：

| Kubernetes 模型 | Envoy 数据面模型 |
| --- | --- |
| Gateway Listener | Listener、Filter Chain |
| HTTPRoute 的 Host/Path | VirtualHost、Route |
| backendRefs 中的 Service | Cluster |
| EndpointSlice 中的 Pod 地址 | Endpoint |
| Secret 中的证书 | TLS/SDS 相关配置 |

示例最终会在 Envoy 中形成近似结构：

```text
Listener :80
└── VirtualHost api.example.com
    ├── Route /users
    │   └── Cluster user-service
    │       ├── 10.0.1.11:8080
    │       └── 10.0.2.12:8080
    └── Route /orders
        └── Cluster order-service
            ├── 10.0.1.21:8080
            └── 10.0.2.22:8080
```

xDS 将配置推送给所有 Envoy 副本。Envoy 把配置保存在本地内存，请求处理期间不查询 Kubernetes API，也不经过 Controller。

## 6. 请求执行流程

请求 `GET http://api.example.com/users/1` 的路径如下：

```text
Client
  ↓ DNS 解析到外部地址
集群外部入口
  ↓
Envoy Service
  ↓ 选择一个健康的 Envoy Pod
Envoy Proxy
  ↓ Listener :80
  ↓ VirtualHost: api.example.com
  ↓ Route: PathPrefix /users
  ↓ Cluster: user-service
  ↓ 负载均衡选择 Endpoint
user Pod: 10.0.1.11:8080
```

默认情况下，Envoy **直接请求 Pod IP**，不经过后端 Service ClusterIP。

`HTTPRoute.backendRefs` 虽然填写的是 `user-service`，但 Controller 会继续读取该 Service 对应的 EndpointSlice，将 Pod IP 编译成 Envoy Cluster 的 Endpoint：

```text
HTTPRoute.backendRefs: user-service
              ↓ Controller 解析
Service: user-service
              ↓ 查询 EndpointSlice
10.0.1.11:8080、10.0.2.12:8080
              ↓ EDS/xDS
Envoy Cluster: user-service
              ↓ Envoy 自己负载均衡
直接连接某个 Pod IP
```

因此默认请求路径是：

```text
Envoy Proxy → Pod IP
```

而不是：

```text
Envoy Proxy → Service ClusterIP → Pod IP
```

Envoy Gateway 也支持将 `routingType` 设置为 `Service`。这时 Cluster 中保存的是 Service ClusterIP，请求路径才会变成：

```text
Envoy Proxy → Service ClusterIP → kube-proxy/eBPF → Pod IP
```

| routingType | Envoy 的上游地址 | 谁选择 Pod |
| --- | --- | --- |
| `Endpoint`（默认） | EndpointSlice 中的 Pod IP | Envoy |
| `Service` | Kubernetes Service ClusterIP | kube-proxy、Cilium 等 Kubernetes 数据面 |

所以，`Service` 同时有两种可能的作用：默认 Endpoint 模式下，它是后端声明和 Endpoint 发现入口；Service 模式下，它还是 Envoy 实际连接的网络地址。

控制面和数据面路径必须分开理解：

```text
配置路径：Kubernetes API → Envoy Gateway → xDS → Envoy
请求路径：Client → Envoy → Backend Endpoint
```

## 7. 系统变化时会发生什么

| 变化 | 处理过程 |
| --- | --- |
| user-service 扩容 | EndpointSlice 更新，Controller 生成新的 EDS，Envoy 更新 Endpoint |
| 修改 HTTPRoute | Controller 重新生成路由配置并通过 xDS 下发 |
| Envoy Pod 故障 | Deployment 创建新 Pod，Service 移除不健康副本 |
| Controller 暂时故障 | Envoy 使用已有配置继续代理，但新配置不能同步 |
| 删除 Gateway | Controller 回收其管理的 Envoy 数据面资源 |

这也是控制面和数据面分离的价值：配置管理故障不应立即中断现有流量。

## 8. EnvoyProxy 和策略资源

`EnvoyProxy` 是可选的基础设施配置，不是实际运行的 Envoy Pod。它用于定制 Controller 创建的数据面，例如 Deployment 副本、容器镜像、资源限制和 Service 类型。

策略资源则扩展 Gateway API：

| 资源 | 作用 |
| --- | --- |
| SecurityPolicy | 认证与安全策略 |
| BackendTrafficPolicy | 超时、重试、限流、负载均衡等后端策略 |
| ClientTrafficPolicy | 客户端连接和入口 TLS 策略 |
| BackendTLSPolicy | Envoy 到后端的 TLS 配置 |
| EnvoyExtensionPolicy | 外部处理和 Envoy 扩展能力 |

这些资源仍然走同一条编译链路：CRD → Controller → xDS → Envoy Filter。它们不进入请求路径。

## 9. 总结

Envoy Gateway 的完整心智模型是：

```text
用户用 Gateway API 描述期望
              ↓
Controller 创建 Envoy 数据面并编译配置
              ↓
Envoy Proxy 使用本地 xDS 配置处理请求
              ↓
一个 Envoy 数据面代理多个后端 Cluster
```

Envoy Gateway 管理 Kubernetes 南北流量入口，但不会自动接管所有 Pod 之间的东西流量。需要透明的服务间身份、mTLS 和流量治理时，应引入 Istio 等 Service Mesh。

官方文档：[Concepts](https://gateway.envoyproxy.io/docs/concepts/)、[Deployment Mode](https://gateway.envoyproxy.io/latest/tasks/operations/deployment-mode/)、[Gateway API Support](https://gateway.envoyproxy.io/docs/tasks/traffic/gatewayapi-support/)。
