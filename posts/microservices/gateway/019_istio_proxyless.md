---
weight: 14
title: "Istio Proxyless：xDS 如何进入微服务框架"
date: 2026-09-07T10:00:00+08:00
lastmod: 2026-09-07T14:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "从 xDS 资源依赖、gRPC-Go 与 Kitex 源码实现理解 Proxyless，以及它与 Sidecar、Ambient、Waypoint 的边界。"
tags: ["gateway", "istio", "xds", "grpc", "kitex", "proxyless"]
categories: ["microservice"]
toc:
  auto: false
---

## 问题

1. xDS 协议具体传递什么，IDL 是什么样的？
2. gRPC-Go、Kitex 如何在没有 Envoy Sidecar 时执行 xDS 配置？
3. Kitex 不支持动态负载均衡配置，具体缺少什么？
4. Proxyless 是否只能治理客户端 Outbound？
5. Proxyless 与 Ambient 是替代关系，还是可以组合？

## 1. 核心理论：xDS 下发资源，数据面负责解释和执行

xDS 不是代理，也不是负载均衡器。它是一组控制面协议，只负责传递配置：

```text
控制面配置
VirtualService / DestinationRule / AuthorizationPolicy
                         │
                         ▼
                    istiod / xDS Server
                         │ xDS
                         ▼
                数据面解释器与执行器
       ┌─────────────────┼─────────────────┐
       ▼                 ▼                 ▼
  Envoy Sidecar      gRPC/Kitex SDK    ztunnel/Waypoint
```

Proxyless 的本质不是“没有数据面”，而是：

> 将服务发现、路由、负载均衡、超时和重试等执行逻辑，从 Envoy 进程移动到 RPC 框架进程。

因此，判断一个 Proxyless 框架能做什么，要检查两个问题：

1. 它订阅哪些 xDS Resource？
2. 它把这些 Resource 翻译成了框架中的什么执行逻辑？

<!-- more -->

## 2. 理解 Outbound 和 Inbound

假设服务 A 调用服务 B：

```proto
service Greeter {
  rpc SayHello(HelloRequest) returns (HelloReply);
}
```

服务 B 在启动时已经注册业务实现：

```go
pb.RegisterGreeterServer(server, greeter)
```

因此，`/helloworld.Greeter/SayHello` 是否存在只由服务 B 的代码决定，xDS 不会注册这个方法。

### 2.1 Proxyless：治理逻辑在框架内部执行

```text
服务 A                                                        服务 B

SayHello()
    │
    ▼
框架内的 xDS Outbound
    ├── LDS：找到该目标使用的 RDS
    ├── RDS：SayHello -> cluster-b，读取超时和重试
    ├── CDS：读取 cluster-b 的负载均衡等配置
    ├── EDS：获得 B1、B2 的 Pod IP
    └── Balancer：选择 B1
    │
    └──────────────── HTTP/2 RPC ─────────────────────────────►
                                                               │
                                                               ▼
                                                    框架内的 xDS Inbound
                                                        ├── LDS：连接和 TLS 配置
                                                        ├── RDS：匹配 SayHello
                                                        └── Filter：执行 RBAC 等策略
                                                               │
                                                               ▼
                                                    已注册的 SayHello Handler
```

### 2.2 Outbound 和 Inbound 分别解决什么问题

判断策略应该在哪一侧执行，只需要看它解决谁的问题：

```text
Outbound：请求离开 A 之前，决定“怎样调用 B”
Inbound： 请求到达 B 之后，决定“怎样接收这次调用”
```

| 策略 | 执行位置 | `SayHello` 场景 |
| --- | --- | --- |
| 服务发现 | Outbound | A 找到 B1、B2 的地址 |
| 负载均衡 | Outbound | A 在 B1、B2 中选择一个实例 |
| 灰度、流量拆分 | Outbound | A 将 10% 请求发送给 `b-v2` |
| 超时 | Outbound | A 最多等待 B 500 ms |
| 重试 | Outbound | A 调用 B1 失败后改调 B2 |
| 熔断、异常实例摘除 | Outbound | A 暂时不再选择连续失败的 B1 |
| 故障注入 | 通常是 Outbound | A 在调用 B 时主动模拟延迟或错误 |
| 服务端 TLS 身份 | Inbound | B 向 A 出示自己的服务端证书 |
| 客户端身份验证 | Inbound | B 验证 A 的 mTLS 身份 |
| 授权 | Inbound | B 判断 A 能否调用 `SayHello` |
| 服务端限流 | Inbound | B 每秒最多接收 100 次 `SayHello` |
| 请求审计 | Inbound | B 记录谁调用了 `SayHello` 以及处理结果 |

mTLS 是一个跨越两端的例外：A 的 Outbound 负责发送客户端证书并验证 B，B 的 Inbound 负责
发送服务端证书并验证 A。

RDS 也会出现在两端，但用途不同：

```text
A 的 Outbound RDS：SayHello -> 选择 cluster-b-v1 或 cluster-b-v2
B 的 Inbound RDS： SayHello -> 选择该请求需要执行的 RBAC 配置
```

gRPC xDS Server 的 Inbound Route 使用 `NonForwardingAction`，因此 B 不会再次选择 Cluster；
它只匹配请求、执行入站 Filter，然后进入已经注册的 `SayHello` Handler。

### 2.3 当前 gRPC-Go Server 实际支持的 Inbound 子集

不能把 Envoy 的全部能力等同于 gRPC-Go Server 的能力。当前项目检查的 gRPC-Go 版本中：

| 配置来源 | gRPC-Go Server 实际处理的内容 |
| --- | --- |
| LDS Listener | 监听地址对应的配置和 Serving Mode |
| LDS FilterChain | 按连接.destination/source IP、source port 等连接属性选择 FilterChain |
| LDS `DownstreamTlsContext` | 服务端 TLS、客户端证书校验和证书 Provider |
| LDS Network Filter | 只支持 HTTP Connection Manager |
| RDS VirtualHost | 按 `:authority` 选择 VirtualHost |
| RDS RouteMatch | 按 RPC 完整方法名、Metadata/Header、流量比例匹配 Route |
| HTTP RBAC Filter | 执行服务端授权；支持 Route 级 `RBACPerRoute` 覆盖 |
| HTTP Router Filter | 作为必需的终止 Filter；服务端不执行上游转发 |

`HTTP Fault` 在该版本只有 Client Filter 实现，不能把它当作 gRPC-Go Server 的 Inbound
故障注入。其他 Envoy Filter 只有在 gRPC-Go 实现并注册了对应 Server Filter 后才能使用。

### 2.4 Envoy Sidecar：治理逻辑在进程外执行

业务代码不集成 xDS Client，A 和 B 都使用普通 gRPC Server/Client：

```text
服务 A            A 的 Envoy Sidecar                     B 的 Envoy Sidecar          服务 B

SayHello()
   │
   └────────────► Outbound
                   ├── LDS/RDS：选择 cluster-b
                   ├── CDS/EDS：选择 B1
                   └── 执行超时、重试等策略
                              │
                              └──────── HTTP/2 RPC ───────► Inbound
                                                            ├── LDS：连接和 TLS
                                                            ├── RDS：匹配 SayHello
                                                            └── 执行 RBAC 等 Filter
                                                                       │
                                                                       └────────────►
                                                                            SayHello Handler
```

两种模式使用的 xDS 资源基本相同，区别是执行者的位置：

| 能力 | Proxyless | Envoy Sidecar |
| --- | --- | --- |
| A 的 Outbound | A 的 RPC 框架 | A 旁边的 Envoy |
| B 的 Inbound | B 的 RPC 框架 | B 旁边的 Envoy |
| B 的业务 Handler | B 的应用代码 | B 的应用代码 |
| xDS 会不会创建 Handler | 不会 | 不会 |
| Filter 范围 | 仅框架已经实现的 Filter | Envoy 已实现的 Filter |

所以 Proxyless 不是“通过 RDS 动态注册服务路由”，而是把原本由 Sidecar 执行的路由匹配、
负载均衡和治理策略搬进 RPC 框架。服务 B 能提供哪些方法始终由它的 IDL 和代码决定。

## 3. xDS 的传输协议与 IDL

xDS v3 使用 Protocol Buffers 定义资源，并通常通过双向 gRPC Stream 传输。ADS 将多种 Resource
复用在同一条连接上。

```proto
service AggregatedDiscoveryService {
  rpc StreamAggregatedResources(stream DiscoveryRequest)
      returns (stream DiscoveryResponse);

  rpc DeltaAggregatedResources(stream DeltaDiscoveryRequest)
      returns (stream DeltaDiscoveryResponse);
}

message DiscoveryRequest {
  string version_info = 1;
  envoy.config.core.v3.Node node = 2;
  repeated string resource_names = 3;
  string type_url = 4;
  string response_nonce = 5;
  google.rpc.Status error_detail = 6;
}

message DiscoveryResponse {
  string version_info = 1;
  repeated google.protobuf.Any resources = 2;
  bool canary = 3;
  string type_url = 4;
  string nonce = 5;
  envoy.config.core.v3.ControlPlane control_plane = 6;
}
```

`resources` 是 `google.protobuf.Any`，具体类型由 `type_url` 指定：

| Resource | `type_url` |
| --- | --- |
| Listener | `type.googleapis.com/envoy.config.listener.v3.Listener` |
| Route | `type.googleapis.com/envoy.config.route.v3.RouteConfiguration` |
| Cluster | `type.googleapis.com/envoy.config.cluster.v3.Cluster` |
| Endpoint | `type.googleapis.com/envoy.config.endpoint.v3.ClusterLoadAssignment` |

### 3.1 更新状态机

```text
Client                                  xDS Server
  │ DiscoveryRequest(node, type_url)         │
  ├─────────────────────────────────────────>│
  │ DiscoveryResponse(version=v2, nonce=n2)  │
  │<─────────────────────────────────────────┤
  │                                          │
  ├─ 能解析：保存 v2，返回 ACK ──────────────>│
  │  version_info=v2, response_nonce=n2      │
  │                                          │
  └─ 不能解析：保留旧配置，返回 NACK ────────>│
     error_detail=具体错误                   │
```

重要原则：收到配置不等于配置已经生效。客户端必须验证资源；NACK 时继续使用最后一次有效配置。

| 模式 | 更新内容 |
| --- | --- |
| SotW | 返回当前订阅类型的完整状态 |
| Delta xDS | 只返回新增、修改和删除的 Resource |

## 4. gRPC-Go Proxyless 的实现

以下实现细节以本机已有的 gRPC-Go `v1.81.1` 源码为准。

### 4.1 客户端入口

应用使用 xDS URI，而不是普通 DNS URI：

```go
conn, err := grpc.NewClient("xds:///xhs-service.ddd-learn.svc.cluster.local")
```

启动前通过环境变量提供 bootstrap：

```text
GRPC_XDS_BOOTSTRAP=/etc/grpc/bootstrap.json
```

bootstrap 只回答三个基础问题：

```text
xDS Server 在哪里？
当前 Node 身份是什么？
证书由哪个 provider 提供？
```

它不包含完整路由和 Endpoint；这些内容由 xDS 动态下发。

### 4.2 客户端内部链路

```text
grpc.NewClient("xds:///...")
        │
        ▼
xDS Resolver
        │
        ▼
xdsclient + DependencyManager
        │
        ├── WatchListener
        ├── WatchRouteConfig
        ├── WatchCluster
        └── WatchEndpoints
        │
        ▼
生成 gRPC ServiceConfig
        │
        ▼
xds_cluster_manager
        │
        ▼
cluster_impl / endpoint picker
```

源码中的对应位置：

| 组件 | gRPC-Go 代码位置 | 责任 |
| --- | --- | --- |
| bootstrap | `internal/xds/bootstrap` | 读取控制面和 Node 配置 |
| xDS Client | `internal/xds/xdsclient` | ADS、Resource Cache、ACK/NACK |
| Dependency Manager | `internal/xds/xdsdepmgr` | 维护 LDS→RDS→CDS→EDS 依赖 |
| Resolver | `internal/xds/resolver` | 将路由生成 gRPC ServiceConfig |
| Cluster Manager | `internal/xds/balancer/clustermanager` | 根据路由选择 Cluster |
| Cluster Balancer | `internal/xds/balancer` | 根据 CDS/EDS 选择 Endpoint |

这就是 Proxyless 的关键：原来由 Envoy 完成的资源解释和 Endpoint Pick，现在由 gRPC-Go 内部的
Resolver 和 Balancer 完成。

### 4.3 服务端实现

gRPC-Go 不只是客户端支持 xDS，它还提供 xDS Server：

```go
import "google.golang.org/grpc/xds"

server, err := xds.NewGRPCServer()
pb.RegisterGreeterServer(server, greeter)
server.Serve(listener)
```

`RegisterGreeterServer` 仍由 IDL 生成的代码调用，最终将业务实现注册到底层普通
`grpc.Server`。`xds.NewGRPCServer()` 没有替代这一步。

`xds.NewGRPCServer()` 的内部实现会：

```text
创建 xDS Client
    │
    ├── 根据监听地址 WatchListener
    ├── 根据 LDS WatchRouteConfig
    ├── 创建 Unary/Stream Interceptor
    └── 根据 xDS 配置改变 Serving Mode
```

每个 RPC 到达后，xDS Interceptor 先使用 `:authority`、RPC Method 和 Metadata
匹配 RDS Route，再执行该 Route 上的 Server Filter。只有通过这一层，才会调用已注册的
gRPC Handler：

```text
请求 -> LDS/FilterChain -> RDS/Filter -> grpc.Server -> 业务 Handler
```

服务端 TLS 使用 xDS Credentials：

```go
creds, err := xdscreds.NewServerCredentials(
    xdscreds.ServerOptions{
        FallbackCreds: insecure.NewCredentials(),
    },
)
```

`FallbackCreds` 表明 gRPC-Go 可以定义“没有 xDS Security Config 时使用什么凭证”。但这不等于
自动实现 Istio Sidecar 的全部 `PERMISSIVE` 行为。

### 4.4 gRPC-Go 的边界

```text
Envoy Listener       = 通用网络监听器 + 任意受支持 Filter
gRPC-Go xDS Server   = gRPC Server 能映射的 Listener/RDS/Filter 子集
```

原始 TCP Proxy、任意 Envoy HTTP Filter、Wasm、非 gRPC 协议，不会因为使用
`xds.NewGRPCServer()` 自动进入应用。

## 5. Kitex Proxyless 的真实实现

以下结论基于 `kitex-contrib/xds` 当前官方仓库源码和 README，而不是根据“支持 xDS”推测。

### 5.1 初始化过程

```go
import (
    "github.com/kitex-contrib/xds"
    "github.com/kitex-contrib/xds/xdssuite"
)

func main() {
    if err := xds.Init(); err != nil {
        panic(err)
    }

    client, err := greetservice.NewClient(
        "kitex-server.default.svc.cluster.local:80",
        xdssuite.NewClientOption(),
    )
}
```

内部结构：

```text
xds.Init()
    │
    ▼
manager.NewXDSResourceManager()
    │
    ├── 创建 ADS Client
    ├── 建立 Resource Cache
    ├── 按需 Watch Resource
    └── Resource 更新时通知 Handler

xdssuite.NewClientOption()
    ├── XDSRouterMiddleware
    ├── XDSResolver
    ├── CircuitBreaker
    └── RetryPolicy
```

### 5.2 Resource 如何变成 Kitex 行为

| xDS Resource | Kitex 组件 | 实际执行动作 |
| --- | --- | --- |
| LDS/RDS | `XDSRouterMiddleware` | 匹配 Method/Metadata，选择 Weighted Cluster，设置 RPC Timeout |
| CDS/EDS | `XDSResolver` | 读取 Cluster 和 Endpoint，生成 `discovery.Instance` |
| CDS OutlierDetection | `CircuitBreaker` | 调用 Kitex CBSuite 更新错误率熔断配置 |
| RDS RetryPolicy | `RetryPolicy` | 调用 Kitex RetryContainer 更新重试次数和 Backoff |
| LDS LocalRateLimit | `NewLimiter` | 调用 Kitex Server Limit Updater 更新 MaxQPS |

以一次调用为例：

```text
Kitex RPCInfo(method + metainfo)
        │
        ▼ XDSRouterMiddleware
从 LDS/RDS 匹配 Route
        │
        ├── 按权重选择 Cluster
        ├── 写入 XDS_Route_Picked_Cluster Tag
        └── 写入 RPCTimeout
        │
        ▼ XDSResolver
根据 Tag 读取 CDS/EDS
        │
        ▼
返回 []discovery.Instance
        │
        ▼
Kitex 原生 Balancer 选择实例
```

关键点是：Kitex xDS 扩展不是在应用里嵌入 Envoy，而是将 xDS Resource 转换成 Kitex 已有的
Router、Resolver、Retry、CircuitBreaker 和 Limiter 配置。

### 5.3 Kitex 的 Inbound 到底支持什么

官方 README 写着“目前仅在 Kitex 客户端提供 xDS 支持”，但当前源码同时包含：

```go
xdssuite.NewServerOption()
    └── NewLimiter()
```

`NewLimiter()` 监听 LDS 更新，并动态修改 Kitex Server 的 `MaxQPS`。这说明当前源码已经有一个
有限的 Server 侧能力，但它不是通用 xDS Server：

| Inbound 能力 | 当前实现 |
| --- | --- |
| Local Rate Limit | 有有限实现，映射到 Kitex `server.WithLimit` |
| 通用 LDS Listener | 没有完整实现 |
| xDS mTLS | 官方 README 明确写为不支持 |
| Istio RBAC/AuthorizationPolicy | 没有对应的通用 Server 执行器 |
| 任意 Envoy Filter | 不支持 |

所以对 Kitex 更准确的结论是：**以 Outbound 为主，附带少量显式映射的 Inbound 能力。**

### 5.4 当前版本约束

官方仓库 README 当前记录：

- mTLS 暂不支持，需要使用 `PeerAuthentication DISABLE`；
- 主要支持服务发现、流量路由、限流、重试、超时和熔断；
- 动态负载均衡等能力仍未补齐；
- 兼容性说明仅记录在 Istio `1.13.3` 下测试。

因此，在当前 Istio `1.31` 环境中不能只根据文档示例认定其生产兼容，需要重新做协议、资源和安全测试。

## 6. 动态负载均衡配置到底是什么

最容易混淆的是“路由权重”和“负载均衡策略”：

```text
RDS 路由权重：先选择哪个 Cluster
CDS/EDS LB：在 Cluster 内选择哪个 Endpoint
```

例如：

```text
RDS：90% -> xhs-v1 Cluster
     10% -> xhs-v2 Cluster

CDS/EDS：xhs-v1 Cluster 内有 Pod A、B、C
         使用 ROUND_ROBIN 或 LEAST_REQUEST 选择一个 Pod
```

Kitex 已实现 `WeightedClusters`，所以能够完成前一层的 v1/v2 路由选择。它所说的“负载均衡配置
尚未支持”，主要是后一层由控制面动态指定 Balancer。

### 6.1 动态配置示例

原配置：

```yaml
cluster: xhs-v1
lb_policy: ROUND_ROBIN
```

```text
A -> B -> C -> A
```

当 Pod B 变慢时，控制面希望动态改成：

```yaml
cluster: xhs-v1
lb_policy: LEAST_REQUEST
least_request_lb_config:
  choice_count: 2
```

完整支持 CDS LB Policy 的客户端收到更新后，不需要重启即可切换算法。Kitex 当前仍主要由自身
Balancer 决定 Cluster 内如何选实例；改变算法通常需要修改 Kitex 配置或代码并重新发布客户端。

### 6.2 动态 LB 的作用

| 配置 | 作用 |
| --- | --- |
| `ROUND_ROBIN` | 均匀轮询健康实例 |
| `LEAST_REQUEST` | 优先选择当前并发请求较少的实例 |
| `RING_HASH` | 同一个 Key 尽量落到同一实例 |
| locality weight | 优先同机房/可用区，控制跨区流量 |
| endpoint weight | 给不同实例分配不同流量比例 |

EDS 更新“实例新增、删除、地址变化”与 CDS 动态修改“采用什么选择算法”是两个独立能力。

## 7. 对几个结论的直接判定

| 原结论 | 判定 | 正确边界 |
| --- | --- | --- |
| Proxyless 都只支持 Outbound | 错误 | gRPC-Go 有 xDS Server；Kitex 目前仍以 Outbound 为主 |
| 被调用服务完全不受任何治理 | 错误 | 调用方仍执行 Outbound；Ambient/Waypoint 也可以执行 Inbound |
| Inbound 功能全部要写拦截器 | 有条件正确 | 仅在没有 xDS Server、ztunnel、Waypoint、Gateway 时成立 |
| AuthorizationPolicy 对 Proxyless 无效 | 错误 | 只要流量经过 ztunnel/Waypoint/Gateway，就仍有策略执行者 |
| Proxyless 只能使用 STRICT mTLS | 错误 | 取决于框架；当前 Kitex xDS README 反而明确不支持 mTLS |
| 必须使用 `istio-agent` | 有条件正确 | Istio 集成常用 agent；xDS 协议本身只要求可用 bootstrap 和凭证 |
| Proxyless 没有 LDS | 错误 | xDS 有 LDS；具体框架可能不实现或只实现其子集 |

## 8. Sidecar、Ambient、Proxyless 如何选择

### 8.1 能力和执行位置

| 能力 | Sidecar | Ambient | 纯 Proxyless |
| --- | --- | --- | --- |
| 执行位置 | Pod 内 Envoy | 节点 ztunnel、可选 Waypoint | RPC SDK |
| 接入方式 | 流量透明劫持 | 流量透明劫持 | 修改应用和 Client/Server 初始化 |
| L4 mTLS/身份 | Envoy | ztunnel | 框架必须实现 |
| L7 路由/Retry | Envoy | Waypoint | 客户端框架 |
| Inbound 授权 | Envoy | ztunnel/Waypoint | Server 框架必须实现 |
| 协议覆盖 | HTTP/gRPC/TCP | L4 全覆盖，Waypoint 处理 L7 | 仅框架 RPC |

`AuthorizationPolicy` 是否生效只取决于有没有执行者：

```text
Sidecar -> Envoy
Ambient L4 -> ztunnel
Ambient L7 -> Waypoint
纯 Proxyless -> 框架的 Server RBAC；未实现就不生效
```

### 8.2 Ambient 中通常不需要 Proxyless

Ambient 已经通过 ztunnel 消除了 Sidecar。需要 L7 时再增加 Waypoint，通常比把治理能力分散到每个
RPC SDK 更一致。

同时启用时有两个风险：

| 风险 | 原因 |
| --- | --- |
| 重复治理 | Client 和 Waypoint 同时 Retry 3 次，最坏可放大为 9 次尝试 |
| 绕过 Waypoint | EDS 直接选择 Pod IP，可能不经过绑定在 Service 上的 Waypoint |

仍值得组合的窄场景：

```text
纯 gRPC/Kitex
  + Proxyless 只负责客户端发现和 LB
  + ztunnel 只负责 mTLS、身份和 L4 授权
  + 不使用重复的 Waypoint Route/Retry
```

### 8.3 最终决策

| 场景 | 选择 |
| --- | --- |
| 异构 HTTP/gRPC/TCP、第三方组件多 | Ambient + 按需 Waypoint |
| 标准 gRPC、跨语言、需要成熟 xDS | 官方 gRPC xDS，逐项核对功能矩阵 |
| Go/Kitex，只需要已实现的治理能力 | Kitex xDS，接受 mTLS、动态 LB 和版本兼容限制 |
| 要统一 Inbound 授权、限流和审计 | Sidecar 或 Ambient Waypoint |
| 只想去掉 Sidecar并保持透明接入 | Ambient |
| 少量高性能 RPC 需要客户端直连 | 局部 Proxyless + Ambient L4 |

当前项目是 Hertz、Ory、PostgreSQL 等组成的异构系统，应继续使用 Ambient。Proxyless 只适合未来
新增的纯 gRPC/Kitex 内部调用，不能替代当前 ztunnel、Waypoint 和 Gateway。

## 9. 阅读框架源码的固定顺序

```text
Bootstrap -> Watch -> Cache/ACK -> Translate -> Execute -> Inbound
```

| 步骤 | 要确认的问题 |
| --- | --- |
| Bootstrap | 如何找到 xDS Server、Node ID 和证书？ |
| Watch | 订阅 LDS/RDS/CDS/EDS 中的哪些资源？ |
| Cache/ACK | NACK 和最后有效配置怎么处理？ |
| Translate | Resource 被翻译成哪个框架对象？ |
| Execute | Resolver、Balancer、Middleware 如何执行？ |
| Inbound | Server 是否实现 Listener、TLS 和 RBAC？ |

只接收 Proto 而没有 Translate/Execute，对应配置就不会产生治理效果。

## 10. 限流、熔断和故障注入应该在哪一端执行

执行位置不由策略名称决定，而由它要保护的对象决定：

```text
控制“我怎样调用下游” -> 客户端 Outbound
控制“我怎样接收请求” -> 服务端 Inbound
需要所有实例共享一个计数器 -> 集中式治理服务
```

### 10.1 限流：服务端是最终防线，客户端是提前约束

假设 B 最多承受 1000 QPS，A 和 C 同时调用 B：

```text
A -- 800 QPS --\
                 +--> B：总请求 1400 QPS
C -- 600 QPS --/
```

| 限流位置 | 能保证什么 | 不能保证什么 |
| --- | --- | --- |
| A 的 Outbound | A 自己最多向 B 发送多少请求 | A 不知道 C 的流量，无法保护 B 的总容量 |
| B 的 Inbound | 限制进入 B 的总量，或按调用方身份限流 | 多个 B Pod 的本地计数器不自动共享 |
| 集中式限流 | 跨 Pod 实现服务级、租户级全局配额 | 需要 Rate Limit Service 和共享存储 |

因此，B 的 Inbound 限流负责容量保护；A 的 Outbound 限流用于调用预算、
减少突发和防止重试风暴，不能代替服务端限流。

### 10.2 熔断：主要在客户端 Outbound

熔断回答的是“A 现在是否还应继续调用 B”，所以它位于 A 的 Outbound：

```text
A 连续调用 B 失败
  -> 熔断器打开
  -> A 暂时不再发送请求
  -> 本地快速失败或执行降级
  -> 等待后进入半开状态试探 B
```

B 无法替 A “熔断对 B 的调用”。B 一侧对应的保护机制是限流、最大并发、
过载拒绝和负载舍弃，它们保护 B，但不是调用方熔断器。

### 10.3 故障注入：根据要模拟的故障边界选位置

故障注入是测试手段，不是保护机制：

| 要验证的场景 | 注入位置 | 结果 |
| --- | --- | --- |
| A 遇到 B 延迟或报错时能否正确重试、熔断和降级 | A 的 Outbound | 只影响 A -> B 这条调用关系 |
| 所有调用方看到 B 都在延迟或报错 | B 之前的 Inbound Proxy/Waypoint | 模拟 B 整体故障 |
| B 内部真实组件故障 | B 的测试环境或故障测试代码 | 检验 B 自身的容错逻辑 |

如果只是验证 A 的容错能力，优先在 A 的 Outbound 注入，避免影响 B 的其他调用方。
故障注入应由 Proxy、Waypoint 或框架 Filter 执行，不应混入正常业务 Handler。

### 10.4 常见策略的推荐位置

| 策略 | 主要位置 | 原因 |
| --- | --- | --- |
| 服务发现、负载均衡、灰度路由 | Outbound | 调用方需要选择目标 Cluster 和 Endpoint |
| 超时 | Outbound 为主，Inbound 可设处理上限 | 调用方决定等多久；服务端避免无限执行 |
| 重试 | Outbound | 只有调用方能重新发起一次调用 |
| 熔断、异常实例摘除 | Outbound | 调用方根据下游失败情况停止调用或避开实例 |
| 调用方请求预算 | Outbound 限流 | 限制某一个客户端的发送速率 |
| 服务容量保护 | Inbound 限流 | 汇总所有调用方的实际入站流量 |
| 跨实例配额 | 集中式限流 | 多个 Pod 需要共享计数和配额 |
| 身份验证、授权 | Inbound | 被调用服务必须自己守住信任边界 |
| 故障注入 | 根据测试边界决定 | 通常在 Outbound 模拟某条依赖失败，在 Inbound 模拟服务整体失败 |

不论是 Proxyless、Sidecar 还是 Ambient，上述位置语义都不变；变化的只是策略由
RPC 框架、Envoy 还是 Waypoint 执行。

## 参考资料

- [CloudWeGo Kitex xDS](https://www.cloudwego.io/zh/docs/kitex/tutorials/advanced-feature/xds/)
- [kitex-contrib/xds](https://github.com/kitex-contrib/xds)
- [gRPC xDS features](https://github.com/grpc/grpc/blob/master/doc/grpc_xds_features.md)
- [Envoy xDS protocol](https://www.envoyproxy.io/docs/envoy/latest/api-docs/xds_protocol)
- [Envoy discovery.proto](https://github.com/envoyproxy/data-plane-api/blob/main/envoy/service/discovery/v3/discovery.proto)
