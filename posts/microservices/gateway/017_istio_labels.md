---
weight: 12
title: "12 Kubernetes 与 Istio 标签约定"
date: 2026-09-06T19:00:00+08:00
lastmod: 2026-09-06T19:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "区分 Kubernetes 应用标签、Istio 流量配置标签与 ServiceAccount workload identity，理解它们在 AuthorizationPolicy 中的作用。"
featuredImage:
tags: ["gateway", "istio", "kubernetes"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

Kubernetes 标签经常同时承担应用编排、运维查询和服务治理的筛选作用。需要先区分一个容易混淆的事实：
`app.kubernetes.io/*` 不是 Istio 专用标签，而是 Kubernetes 推荐的通用应用标签；Istio 也可以使用
这些标签选择 workload，但不会因此自动启用 Istio 或自动授权。

<!-- more -->

## 1. 三类不同的标识

当前项目中的标识可以分成三类：

| 类别 | 示例 | 谁使用 | 主要作用 |
| --- | --- | --- | --- |
| Kubernetes 推荐应用标签 | `app.kubernetes.io/name: xhs` | Kubernetes、Helm、运维工具、Istio selector | 标识应用、实例和组件 |
| Istio 配置标签 | `istio.io/dataplane-mode: ambient` | Istio 控制面和 ztunnel | 加入 Ambient、选择 Waypoint 或控制注入 |
| Workload identity | `spiffe://cluster.local/ns/ddd-learn/sa/frontend` | ztunnel、AuthorizationPolicy | 认证工作负载并执行身份授权 |

标签只是一组键值对；不同控制器只会解释自己认识的键。`ServiceAccount` 不是 label，但它是 Istio
生成 workload identity 的输入。

## 2. Kubernetes 推荐的 `app.kubernetes.io/*` 标签

Kubernetes 推荐使用以下通用标签：

| 标签 | 作用 | 示例 |
| --- | --- | --- |
| `app.kubernetes.io/name` | 应用名称 | `xhs` |
| `app.kubernetes.io/instance` | 应用的唯一实例，通常对应 Helm release | `xhs` |
| `app.kubernetes.io/version` | 应用版本 | `1.16.0` |
| `app.kubernetes.io/component` | 应用中的组件类型 | `backend`、`database` |
| `app.kubernetes.io/part-of` | 所属系统或产品 | `ddd-learn` |
| `app.kubernetes.io/managed-by` | 管理该资源的工具 | `Helm` |

这些标签主要用于查询、分组、选择器和工具集成。例如当前 xhs Helm Chart 的 Pod 标签是：

```yaml
app.kubernetes.io/name: xhs
app.kubernetes.io/instance: xhs
app.kubernetes.io/version: "1.16.0"
app.kubernetes.io/managed-by: Helm
```

`fullnameOverride: xhs-service` 只改变 Deployment 和 Service 的名称，不会把
`app.kubernetes.io/name` 改成 `xhs-service`。因此当前策略选择的是：

```yaml
selector:
  matchLabels:
    app.kubernetes.io/name: xhs
    app.kubernetes.io/instance: xhs
```

另外，`helm.sh/chart: xhs-0.1.0` 是 Helm 常用标签，不属于 Istio 标签，也不是
`app.kubernetes.io/*` 推荐标签中的一项。

## 3. Istio 常用标签

Istio 使用带有 `istio.io/` 或 `sidecar.istio.io/` 前缀的标签控制数据面行为。

### 3.1 Ambient 和 Waypoint

```yaml
istio.io/dataplane-mode: ambient
```

给 namespace 添加该标签后，namespace 中新建或重新创建的 Pod 会由 Istio Ambient 接管。当前实验的
配置是：

```yaml
metadata:
  name: ddd-learn
  labels:
    istio.io/dataplane-mode: ambient
```

Waypoint 相关标签用于选择或声明 Waypoint 的作用范围：

| 标签 | 作用 |
| --- | --- |
| `istio.io/use-waypoint: <waypoint-name>` | 指定 namespace、Service 或 workload 使用的 Waypoint |
| `istio.io/waypoint-for: service` | 声明 Waypoint 主要为 Service 流量提供七层处理 |

没有 Waypoint 时，Ambient 主要由 ztunnel 提供 L4 转发、mTLS 和 L4 授权；需要 HTTP 路由、重试、
超时或 L7 授权时，才引入 Waypoint。

### 3.2 Sidecar 注入与控制面版本

```yaml
sidecar.istio.io/inject: "true"
```

用于 namespace 或 Pod 级别控制 Sidecar Envoy 自动注入。在 Ambient 模式下通常不需要给业务 Pod
注入 Sidecar；不要把 Sidecar 注入标签和 `istio.io/dataplane-mode: ambient` 混为一谈。

```yaml
istio.io/rev: <revision>
```

用于选择指定 revision 的 Istio 控制面，常用于多版本控制面升级或灰度。它控制的是连接哪个
Istiod，不是业务授权规则。

## 4. 标签与 AuthorizationPolicy 的关系

AuthorizationPolicy 中有两个不同层次的匹配：

```yaml
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: xhs
      app.kubernetes.io/instance: xhs
  rules:
    - from:
        - source:
            principals:
              - cluster.local/ns/ddd-learn/sa/frontend
```

它们的职责不同：

```text
selector.matchLabels
→ 找到被保护的目标 workload：xhs Pod

source.principals
→ 判断请求来源 workload：frontend ServiceAccount
```

`selector` 可以匹配任意 Pod 标签，并不要求使用 Istio 标签。当前策略使用 Kubernetes 推荐标签
选择 xhs，使用 ServiceAccount 对应的 SPIFFE principal 识别 frontend。

## 5. ServiceAccount 不是普通标签

frontend Pod 的定义是：

```yaml
spec:
  serviceAccountName: frontend
```

Ambient ztunnel 根据 namespace 和 ServiceAccount 得到工作负载身份：

```text
spiffe://cluster.local/ns/ddd-learn/sa/frontend
```

因此：

- Pod IP 是流量定位地址，Pod 重建后可能变化；
- `app.kubernetes.io/name` 是应用分类标签，可以被 selector 使用；
- ServiceAccount 是 workload 的身份来源；
- SPIFFE principal 是 mTLS 和 AuthorizationPolicy 使用的认证身份。

`automountServiceAccountToken: false` 只是不把 Kubernetes API 访问令牌挂载进业务容器，不能删除或
改变 ServiceAccount，也不会阻止 ztunnel 使用该 ServiceAccount 建立 Istio workload identity。

## 6. 当前项目的组合关系

```text
Namespace/ddd-learn
└── istio.io/dataplane-mode=ambient
    ├── Pod/xhs-service
    │   ├── app.kubernetes.io/name=xhs
    │   ├── app.kubernetes.io/instance=xhs
    │   └── ServiceAccount=xhs-service
    │       └── spiffe://cluster.local/ns/ddd-learn/sa/xhs-service
    ├── Pod/ambient-frontend
    │   └── ServiceAccount=frontend
    │       └── spiffe://cluster.local/ns/ddd-learn/sa/frontend
    └── AuthorizationPolicy/xhs-allow-frontend
        ├── selector → Pod/xhs-service
        └── principals → frontend workload identity
```

这个组合体现了三种配置的边界：namespace 标签决定是否接入 Ambient，应用标签决定策略选择哪个
workload，ServiceAccount principal 决定哪个调用方可以访问该 workload。

## 补充：如何选择策略执行组件

前面的标签和绑定方式解决的是“策略绑定到什么对象”，还需要根据策略需求选择实际的执行组件。可以按以下顺序判断：

```text
1. 是外部客户端进入集群的流量吗？
   ├─ 是 → Gateway Envoy
   └─ 否

2. 是否需要 HTTP path、method、Header 或 JWT claims？
   ├─ 是 → Waypoint 或 Sidecar Envoy
   └─ 否

3. 是否需要覆盖 TCP、未绑定 Waypoint 或所有 Ambient workload？
   ├─ 是 → ztunnel
   └─ 否 → 优先使用 ztunnel
```

| 需求 | 推荐组件 | 推荐绑定方式 |
| --- | --- | --- |
| 按 ServiceAccount、namespace、IP 或端口授权 | ztunnel | AuthorizationPolicy.selector |
| 按 HTTP 路径、方法或 Header 授权 | Waypoint | AuthorizationPolicy.targetRefs: Service |
| 校验 JWT 并判断 claims | Waypoint、Sidecar 或 Gateway Envoy | RequestAuthentication |
| HTTP 重试、超时、路由和流量拆分 | Waypoint、Sidecar 或 Gateway Envoy | VirtualService、DestinationRule 或 Gateway API |
| TCP 等非 HTTP 流量 | ztunnel 或 Sidecar | L4 策略或 Sidecar 配置 |
| 外部域名、入口认证和入口限流 | Gateway Envoy | Gateway、HTTPRoute |
| 未绑定 Waypoint 的 Service | ztunnel | workload 或 namespace 范围策略 |
| 需要基础 L4 防护和 HTTP 细化 | ztunnel + Waypoint | 两层分别绑定策略 |

### L7 能看到 L4 信息，但不能完全替代 L4 数据面

L7 请求建立在 L4 连接之上，因此 Waypoint 在处理已经到达的 HTTP 请求时，通常可以获得部分 L4 上下文：

```text
对端 workload identity
mTLS 认证结果
源/目标地址和端口
连接建立、关闭和错误状态
```

但是 Waypoint 的作用范围取决于流量是否经过它。它不能替代 ztunnel 完成以下工作：

- 接管节点上所有 Pod 的流量；
- 处理没有绑定 Waypoint 的 Service；
- 处理非 HTTP 流量；
- 建立 Ambient 的 HBONE/mTLS；
- 为绕过 Waypoint 的路径提供基础防护。

因此：

```text
L7 可以使用部分 L4 上下文
≠
L7 可以替代 ztunnel
```

### 什么时候只使用 ztunnel

如果策略只判断“哪个 workload 可以访问目标服务”，例如：

```text
frontend ServiceAccount 可以访问 backend
other ServiceAccount 不可以访问 backend
```

并且不判断 URL、HTTP 方法或 Header，那么使用 workload selector 让 ztunnel 执行即可：

```yaml
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: backend
  rules:
    - from:
        - source:
            principals:
              - cluster.local/ns/prod/sa/frontend
```

### 什么时候使用 Waypoint

如果策略依赖 HTTP 请求内容，或者需要 Service 级的 HTTP 流量治理，就使用 Waypoint：

```yaml
spec:
  targetRefs:
    - group: ""
      kind: Service
      name: backend
  rules:
    - to:
        - operation:
            paths: ["/v1/orders"]
            methods: ["GET"]
```

Waypoint 只处理绑定到它的 Service 流量；ztunnel 仍然负责 Ambient 的流量接管、HBONE 和 mTLS。

### 什么时候两者同时使用

两者同时使用不是强制要求，而是分层安全模型：

```text
ztunnel
→ 先检查 workload identity 和 L4 边界

Waypoint
→ 再检查 HTTP path、method、Header 或 JWT claims
```

两层策略不是简单复制。请求必须通过实际经过的每一层，任意一层拒绝都会导致请求失败。配置时应确认：

1. 两条策略是否分别绑定到了正确的执行组件；
2. 每个组件是否支持所使用的字段；
3. Waypoint 到目标 ztunnel 的身份和策略表现；
4. 是否存在绕过 Waypoint 的其他流量路径。

最终原则：

```text
标签决定对象和数据面范围
selector/targetRefs/parentRefs 决定策略绑定对象
L4/L7 需求决定执行组件
ServiceAccount/SPIFFE identity 决定调用方身份
```

## 10. `parentRefs`、`targetRefs` 和 `selector` 的区别

这几个字段都表示“关联关系”，但属于不同 API 体系，不能互换：

| 字段 | 所属 API | 被哪些常见 CRD 使用 | 引用或选择什么 | 解决什么问题 |
| --- | --- | --- | --- | --- |
| `parentRefs` | Gateway API | `HTTPRoute`、`GRPCRoute`、`TLSRoute`、`TCPRoute`、`UDPRoute` | `Gateway` | Route 想挂载到哪个 Gateway listener |
| `targetRefs` | Istio API | `AuthorizationPolicy`、`RequestAuthentication`；部分版本的 `Telemetry` | `Service`、`Gateway`、`GatewayClass`、`ServiceEntry` 等支持的目标对象 | Istio 策略作用于哪个服务或网关 |
| `selector` | Kubernetes/Istio | `AuthorizationPolicy`、`PeerAuthentication`、`RequestAuthentication`、`Telemetry`、`EnvoyFilter`、`Sidecar` | 匹配 label 的 workload/Pod | Istio 配置作用于哪组 workload |
| `hosts` | Istio API | `VirtualService`、`ServiceEntry` | 服务主机名 | 根据服务名配置路由或注册服务 |
| `host` | Istio API | `DestinationRule` | 一个目标服务主机名 | 配置目标服务的子集、连接和 TLS |
| `backendRefs` | Gateway API | 各类 Route 的规则对象 | 后端 `Service` 或其他后端对象 | Route 匹配后请求转发到哪里 |
| `gatewayClassName` | Gateway API | `Gateway` | `GatewayClass` | 选择哪个 Gateway controller 管理该 Gateway |

### 10.1 `parentRefs`：Route 绑定 Gateway

`parentRefs` 只解决一个问题：

```text
这个 HTTP/TCP/TLS Route 要挂载到哪个 Gateway？
```

典型对象关系是：

```text
HTTPRoute
└── spec.parentRefs
    └── Gateway
        └── listener
```

示例：

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: backend-route
  namespace: prod
spec:
  parentRefs:
    - name: public-gateway
      sectionName: https
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /api
      backendRefs:
        - name: backend
          port: 8080
```

这里有两个不同的引用：

```text
parentRefs
→ Route 挂到哪个 Gateway

backendRefs
→ 请求匹配后转发到哪个 Service
```

`Gateway.spec.listeners[].allowedRoutes` 再决定这个 Route 是否有资格绑定 listener：

```yaml
listeners:
  - name: https
    allowedRoutes:
      namespaces:
        from: Same
```

所以 `parentRefs` 是“Route → Gateway”的父级绑定，不是服务访问授权，也不是 workload identity。
真正执行路由的是管理该 Gateway 的 controller 和 Gateway Envoy，例如 Envoy Gateway 或 Istio Gateway。

### 10.2 `targetRefs`：Istio 策略绑定对象

`targetRefs` 解决的是：

```text
这条 Istio 策略应该作用于哪个 Service 或 Gateway？
```

例如 `AuthorizationPolicy`：

```yaml
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: backend-http-policy
  namespace: prod
spec:
  targetRefs:
    - group: ""
      kind: Service
      name: backend
  rules:
    - to:
        - operation:
            paths: ["/v1/orders"]
            methods: ["GET"]
```

在 Ambient 中，Service 级 `targetRefs` 通常意味着把这类 L7 策略交给该 Service 关联的 Waypoint。
它不是让 Route 挂载到 Gateway，也不是通过 label 找 Pod。

不同 Istio CRD 的 `targetRefs` 语义要分别理解：

| CRD | `targetRefs` 的用途 | 常见执行组件 |
| --- | --- | --- |
| `AuthorizationPolicy` | 将授权策略绑定到 Service、Gateway 等目标 | Waypoint、Gateway 或对应数据面 |
| `RequestAuthentication` | 将 JWT 校验配置绑定到 Service、Gateway 等目标 | Waypoint、Sidecar 或 Gateway |
| `Telemetry` | 将遥测配置绑定到目标服务或 workload | 目标 Waypoint、Sidecar、Gateway 等 |

具体 CRD 支持哪些 `kind`，以当前 Istio 版本安装的 CRD schema 为准；不能因为某个 CRD 支持
`targetRefs`，就推断所有 Istio CRD 都支持相同的目标类型。

### 10.3 `selector`：按 label 选择 workload

`selector` 解决的是：

```text
这条配置应该作用于哪些 Pod/workload？
```

示例：

```yaml
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: backend
```

它匹配的是 Pod 的 label，而不是 Service 名称。被选中的 workload 可以是：

```text
Ambient workload → 通常由 ztunnel 执行支持的 L4 策略
Sidecar workload → 由 Pod 内的 Envoy 执行
Gateway workload → 由匹配到的 Gateway Envoy 执行
```

常见 CRD 的 `selector` 作用如下：

| CRD | `selector` 选择什么 | 典型用途 |
| --- | --- | --- |
| `AuthorizationPolicy` | 目标 workload | Ambient L4 身份授权或 Sidecar 授权 |
| `PeerAuthentication` | 目标 workload | 为特定 workload 设置 mTLS 模式 |
| `RequestAuthentication` | 目标 workload | 为特定 Sidecar/Gateway 配置 JWT 校验 |
| `Telemetry` | 目标 workload | 修改特定 workload 的遥测行为 |
| `EnvoyFilter` | 目标 Envoy workload | 修改匹配 Envoy 的配置 |
| `Sidecar` | 目标 workload | 限制或定制 Sidecar 的配置范围 |

### 10.4 `hosts`/`host`：按服务名关联流量配置

`hosts` 或 `host` 不是 workload selector，也不直接创建代理绑定关系：

| CRD | 字段 | 含义 |
| --- | --- | --- |
| `VirtualService` | `spec.hosts` | 哪些服务主机名使用这套路由规则 |
| `DestinationRule` | `spec.host` | 哪个目标服务使用这套连接、子集和 TLS 配置 |
| `ServiceEntry` | `spec.hosts` | 把哪个外部服务加入 Istio 服务目录 |

例如：

```yaml
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: backend
spec:
  host: backend.prod.svc.cluster.local
  subsets:
    - name: v1
      labels:
        version: v1
```

控制面根据 host 找到服务，再把相关配置下发给实际处理该流量的 Sidecar、Waypoint 或 Gateway。
ztunnel 主要负责 Ambient L4 数据面，不能因为 `DestinationRule` 写了 host 就推断它会执行完整的
HTTP 路由或重试逻辑。

### 10.5 `gatewayClassName`：选择 Gateway controller

`gatewayClassName` 出现在 `Gateway`，解决的是：

```text
哪个 Gateway controller 负责管理这个 Gateway？
```

例如：

```yaml
spec:
  gatewayClassName: istio
```

或者：

```yaml
spec:
  gatewayClassName: istio-waypoint
```

它不是 Route 绑定字段，也不是授权策略。Route 仍然通过 `parentRefs` 找到 Gateway；Gateway 再由
`gatewayClassName` 对应的 controller 生成或管理数据面。

### 10.6 一张关系图

```text
GatewayClass
   ▲
   │ gatewayClassName
Gateway ───────────────┐
   ▲                   │
   │ parentRefs        │ targetRefs
HTTPRoute              │
   │ backendRefs       │
   ▼                   ▼
Service ◄────────── Istio Policy
   ▲
   │ selector / labels
Workload/Pod
```

其中：

```text
parentRefs   → Route 挂到哪个 Gateway
backendRefs  → Route 最终转发到哪个后端
targetRefs   → Istio 策略绑定哪个服务或网关
selector     → Istio 配置选择哪些 workload
host/hosts   → 流量配置匹配哪个服务主机名
```

不要把这些字段当成同一种“引用”。它们分别描述路由父级、路由后端、策略目标、workload 选择和
服务主机匹配。
