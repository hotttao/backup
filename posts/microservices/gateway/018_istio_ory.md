---
weight: 13
title: "Istio 与 Ory 的认证链路"
date: 2026-09-06T21:00:00+08:00
lastmod: 2026-09-06T21:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "理解 Istio Gateway、istiod、Oathkeeper Decision API 与 Internal JWT 之间的关系。"
tags: ["gateway", "istio", "ory", "oathkeeper", "jwt"]
categories: ["microservice"]
toc:
  auto: false
---

Istio 和 Ory 组合时，最容易混淆的是三个不同层次的对象：Kubernetes 的 Gateway 资源、Gateway
对应的 Envoy 数据面，以及 Oathkeeper 的鉴权服务。它们不是同一个对象，也不是通过把配置文件
直接复制到业务 Pod 中完成协作。

当前方案的核心链路是：

```text
浏览器
  │ Kratos Session Cookie
  ▼
Istio Ingress Gateway Envoy
  │ ext_authz HTTP 子请求
  ▼
Oathkeeper Decision API :4456
  │ cookie_session
  ▼
Kratos Public /sessions/whoami
  │
  └── id_token Mutator 签发 Internal JWT
          │ Authorization: Bearer <JWT>
          ▼
Istio Gateway 转发到 xhs_service
          │
          └── serverhertz/jwt 从 JWKS 校验 JWT
```

Oathkeeper Proxy `4455` 在当前方案中关闭。Oathkeeper 只处理鉴权子请求，不代理每一个业务请求。

<!-- more -->

## 1. `istio-ingress-istio` 是什么

下面这个 SPIFFE principal：

```text
cluster.local/ns/ddd-learn/sa/istio-ingress-istio
```

不是 `Gateway/istio-ingress` 对象本身，而是该 Gateway 对应的 Envoy 数据面 Pod 的身份。

资源关系如下：

```text
Gateway/istio-ingress
        │ Istio Gateway Controller 观察
        ▼
Deployment/istio-ingress-istio
        │ serviceAccountName
        ▼
ServiceAccount/istio-ingress-istio
        │ Istio 生成 workload identity
        ▼
spiffe://cluster.local/ns/ddd-learn/sa/istio-ingress-istio
```

SPIFFE 身份的组成规则是：

```text
spiffe://<trustDomain>/ns/<namespace>/sa/<serviceAccount>
```

因此，`istio-ingress-istio` 表示 `ddd-learn` namespace 中 Ingress Gateway Pod 使用的
ServiceAccount。`AuthorizationPolicy` 可以用它表达“允许入口 Gateway 访问 xhs Service”，
而不是依赖 Pod IP。

## 2. `ConfigMap/istio` 传给谁

文件 `deployments/gateway/006_istio_ambient/security/istio-mesh-config.yaml` 创建的是：

```yaml
kind: ConfigMap
metadata:
  name: istio
  namespace: istio-system
```

它传给的是 Istio 控制面 `istiod`，不是直接传给 Oathkeeper、xhs_service 或 Gateway Pod。

```text
kubectl apply
    ▼
Kubernetes API Server
    ▼
ConfigMap/istio
    │ istiod 通过 Kubernetes API 读取和监听
    ▼
istiod 解析 data.mesh
    │ 生成 Envoy 配置
    ▼ xDS gRPC :15012
Ingress Gateway / Waypoint Envoy
```

当前 `istiod` Deployment 没有把 `ConfigMap/istio` 挂载成容器文件，说明这里使用的是控制面通过
Kubernetes API 读取的方式。`istiod` 解析配置后，通过 xDS 将相关配置下发给需要它的 Envoy。

当 `AuthorizationPolicy` 引用了：

```yaml
action: CUSTOM
provider:
  name: oathkeeper
```

`istiod` 会查找 `MeshConfig.extensionProviders` 中同名的 `oathkeeper`，为目标 Envoy 生成
HTTP ext_authz 配置。之后由 Envoy 直接访问 Oathkeeper Service。

## 3. MeshConfig 文件逐项说明

### 3.1 默认数据面配置

```yaml
defaultConfig:
  discoveryAddress: istiod.istio-system.svc:15012
```

指定 Envoy 获取 xDS 配置的控制面地址。

```yaml
image:
  imageType: distroless
```

指定 Istio 代理相关镜像使用 distroless 类型，减少镜像中不必要的工具和攻击面。

```yaml
proxyMetadata:
  ISTIO_META_ENABLE_HBONE: "true"
```

向代理传递 Ambient/HBONE 相关元数据。Ambient 中业务容器仍然使用普通 HTTP，节点上的 ztunnel
负责通过 HBONE 和 mTLS 传输流量。

### 3.2 Metrics

```yaml
defaultProviders:
  metrics:
  - prometheus
enablePrometheusMerge: true
```

指定 Prometheus 为默认指标提供者，并启用 Istio 指标与应用指标的合并能力。它与 Oathkeeper
鉴权没有直接关系，属于网格的默认可观测性配置。

### 3.3 注册 Oathkeeper

```yaml
extensionProviders:
- name: oathkeeper
  envoyExtAuthzHttp:
    service: oathkeeper-api.ddd-learn.svc.cluster.local
    port: 4456
```

`name` 是 AuthorizationPolicy 使用的逻辑名称；`service` 和 `port` 是 Envoy 实际调用的
Oathkeeper Decision API 地址。

这里使用 `4456`，因为：

| 端口 | 作用 | 当前是否使用 |
| --- | --- | --- |
| `4455` | Oathkeeper Reverse Proxy，匹配规则后代理业务请求 | 否，已关闭 |
| `4456` | Oathkeeper Decision API，只返回鉴权决策和身份 Header | 是 |

```yaml
pathPrefix: /decisions
```

Envoy 访问业务请求 `/v1/xhs/me/organizations` 时，会向 Oathkeeper 发起类似请求：

```text
/decisions/v1/xhs/me/organizations
```

Oathkeeper 仍然能够看到原始的 Method、Host 和 Path，并据此匹配 Access Rule。

```yaml
timeout: 2s
failOpen: false
statusOnError: "503"
```

含义如下：

| 配置 | 含义 |
| --- | --- |
| `timeout` | Oathkeeper 最多处理 2 秒 |
| `failOpen: false` | Oathkeeper 不可用时不放行请求 |
| `statusOnError: 503` | Oathkeeper 超时或网络错误时返回 503 |

认证失败返回 401，授权失败返回 403，鉴权服务自身不可用返回 503。

```yaml
includeRequestHeadersInCheck:
- authorization
- cookie
- x-forwarded-proto
```

这些 Header 会从原始请求复制到 Oathkeeper 的 Decision API 请求中：

- `cookie`：传递浏览器中的 Kratos Session Cookie；
- `authorization`：支持已经携带 Internal JWT 的调用；
- `x-forwarded-proto`：让 Oathkeeper 正确判断原始请求使用 HTTP 还是 HTTPS。

```yaml
headersToUpstreamOnAllow:
- authorization
```

鉴权成功后，Oathkeeper 的 `id_token` Mutator 返回：

```http
Authorization: Bearer <internal-jwt>
```

Envoy 将这个 Header 复制到发送给 xhs_service 的业务请求中。

```yaml
headersToDownstreamOnDeny:
- content-type
- www-authenticate
- location
- set-cookie
```

鉴权失败时，将 JSON 类型、认证提示、登录跳转和 Cookie 等响应头传回浏览器，保证 Kratos
浏览器流程能够正常工作。

### 3.4 其他 MeshConfig

```yaml
rootNamespace: istio-system
```

指定 Istio 全局配置的根 namespace。

```yaml
trustDomain: cluster.local
```

指定 Istio workload identity 的信任域。它参与生成：

```text
spiffe://cluster.local/ns/ddd-learn/sa/frontend
```

```yaml
serviceScopeConfigs:
- scope: GLOBAL
  servicesSelector:
    matchExpressions:
    - key: istio.io/global
      operator: In
      values:
      - "true"
```

表示带有 `istio.io/global: "true"` 标签的 Service 可以被视为全局服务。当前实验没有依赖它，
它是保留的网格默认配置。

```yaml
meshNetworks: 'networks: {}'
```

表示当前没有声明多网络拓扑。当前使用单节点 k3s，不需要配置跨网络网关和网络地址范围。

## 4. Internal JWT 是如何传递的

浏览器和业务服务之间不直接共享同一种凭证：

| 位置 | 凭证 | 作用 |
| --- | --- | --- |
| 浏览器 → Istio Gateway | Kratos Session Cookie | 表示浏览器登录状态 |
| Istio Gateway → Oathkeeper | Cookie、原始请求信息 | 请求鉴权决策 |
| Oathkeeper → Istio Gateway | `Authorization: Bearer <JWT>` | 返回签发的内部身份 |
| Istio Gateway → xhs_service | Internal JWT | 让业务服务验证调用者身份 |

签发过程是：

```text
Kratos Session Cookie
        ▼
Oathkeeper cookie_session
        ▼
Kratos /sessions/whoami
        ▼
得到 identity.id
        ▼
Oathkeeper id_token Mutator
        ▼
使用 JWKS 私钥签发 RS256 JWT
```

xhs_service 使用 `INTERNAL_JWKS_URL` 获取 Oathkeeper 的公开 JWKS，并校验：

- JWT 签名算法是否为 `RS256`；
- 签名是否对应 JWKS 中的公钥；
- `iss` 是否为 Oathkeeper 配置的 issuer；
- `aud` 是否包含 `internal-api`；
- `exp`、`iat` 是否在有效时间范围内。

校验成功后，`hertz_infra/serverhertz/jwt` 将 JWT claims 转换成 `Principal`，业务代码可以读取
`Subject`、`SessionID`、`ClientID`、`TokenID` 和时间信息。

## 5. 为什么不让 Oathkeeper Proxy 代理所有请求

如果使用 Oathkeeper Proxy，链路会变成：

```text
浏览器 → Gateway → Oathkeeper :4455 → xhs_service
```

Gateway 还需要把业务请求转发给 Oathkeeper，再由 Oathkeeper 转发给后端。这会引入额外的业务
代理层，并让 Oathkeeper 规则中的 upstream 与 Gateway 路由重复维护。

当前使用 Decision API：

```text
浏览器 → Istio Gateway ───────────────→ xhs_service
                 │
                 └──鉴权子请求→ Oathkeeper :4456
```

因此：

- Gateway 负责路由、TLS、负载均衡和实际业务转发；
- Oathkeeper 负责认证、授权和 Internal JWT 签发；
- xhs_service 负责验证 JWT，并执行自己的业务权限逻辑；
- 只有被 `CUSTOM` 策略选中的请求才调用 Oathkeeper。

这仍然会为受保护请求增加一次鉴权子请求，但不会让 Oathkeeper 代理完整业务响应。对于多个
Gateway，也可以复用同一个 Oathkeeper Decision API。

## 6. 为什么 `CUSTOM` 策略绑定 Gateway

当前策略使用：

```yaml
targetRefs:
- group: gateway.networking.k8s.io
  kind: Gateway
  name: istio-ingress
action: CUSTOM
provider:
  name: oathkeeper
```

`CUSTOM` 需要 HTTP 层能力，而 Ambient ztunnel 只负责 L4 流量和 mTLS，不支持执行外部 HTTP
授权服务调用。因此不能把 `CUSTOM` 策略用普通 workload selector 绑定给 ztunnel。

绑定关系是：

```text
AuthorizationPolicy/istio-ingress-oathkeeper
        ↓ targetRefs
Gateway/istio-ingress
        ↓
Istio Ingress Envoy 执行 ext_authz
```

而 xhs 的 Service 级策略：

```yaml
targetRefs:
- kind: Service
  name: xhs-service
```

会绑定到 `xhs-waypoint`，因为 Service 已通过 `istio.io/use-waypoint` 选择 Waypoint。Waypoint
负责 L7 HTTP 策略；ztunnel 仍负责底层 HBONE/mTLS 和 L4 转发。

## 7. 当前问题如何定位

当 UI 无法查询 Organization ID 时，应按顺序检查：

```text
1. 浏览器是否携带 Kratos Session Cookie
2. Istio Gateway 是否调用 /decisions
3. Oathkeeper 是否成功调用 Kratos /sessions/whoami
4. Oathkeeper 是否返回 Authorization Header
5. Istio 是否把 Authorization 转发给 xhs_service
6. xhs_service 是否能从 JWKS 校验 JWT
7. xhs_service 是否根据 Subject 查询组织
```

对应检查命令：

```shell
kubectl -n ddd-learn get authorizationpolicy \
  istio-ingress-oathkeeper xhs-allow-frontend -o yaml
kubectl -n istio-system get configmap istio \
  -o jsonpath='{.data.mesh}'
curl -i http://192.168.2.41:30425/v1/xhs/me/organizations
kubectl -n ddd-learn logs deploy/oathkeeper --since=5m
```

没有 Cookie 时返回 401 是正常结果；使用 Alice 登录后的浏览器 Cookie 请求同一接口，应该由
Oathkeeper 签发 Internal JWT，并返回 Alice 所属组织，例如组织 `G`。
