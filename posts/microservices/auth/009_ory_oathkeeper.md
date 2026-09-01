---
weight: 7
title: "7 Ory Oathkeeper：身份感知代理与 Gateway 鉴权"
date: 2026-08-29T17:00:00+08:00
lastmod: 2026-08-29T17:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "理解 Ory Oathkeeper 的规则流水线、Decision API、SDK 边界与 Gateway 集成"
tags: ["auth", "ory", "oathkeeper", "gateway"]
categories: ["microservice"]
toc:
  auto: false
---

Oathkeeper 不是完整 API Gateway。它不负责服务发现、负载均衡、限流和 API 生命周期管理；它专注于请求入口的认证、授权和身份上下文转换。

```text
Client -> Gateway -> Oathkeeper Decision API
                         │
                         ├── Match Rule
                         ├── Authenticate
                         ├── Authorize
                         └── Mutate identity context
                                │
               200 + headers / 401 / 403
                         │
Gateway ----------------+----> Upstream Service
```

最重要的结论是：**推荐把 Oathkeeper 作为独立 Decision API 服务接到 Gateway，而不是把它作为 SDK 嵌入 Gateway。**

<!-- more -->

## 1. 两种运行模式

Oathkeeper 一个进程同时启动两个监听面：

| 模式 | 默认端口 | 谁转发业务请求 |
| --- | --- | --- |
| Reverse Proxy | 4455 | Oathkeeper |
| Access Control Decision API | 4456 | 现有 Gateway |

### Reverse Proxy

```text
Client -> Oathkeeper :4455 -> Upstream
```

Oathkeeper 匹配规则、执行安全流水线并直接代理请求，适合没有其他 Gateway 的简单系统。

### Decision API

```text
Client -> Traefik/APISIX/Envoy/Nginx
                    │ auth subrequest
                    ▼
             Oathkeeper :4456/decisions
```

Gateway 把原始 URL、Method、Header 和 Credential 交给 `/decisions`。Oathkeeper 返回：

- `200`：允许，并可能返回要写入上游请求的 Header；
- `401`：没有有效身份；
- `403`：身份有效但权限不足；
- `404`：没有匹配规则，默认拒绝。

现有架构已经选择 Traefik/APISIX 时，应使用 Decision API，避免再串联一层业务反向代理。

## 2. 能否只作为 SDK 使用

### 2.1 “SDK”实际是什么

Oathkeeper 的 Go、Java、TypeScript 等 SDK 是根据 OpenAPI 生成的 **HTTP Client**，用途是调用正在运行的 Oathkeeper：

```text
Gateway Plugin -> Oathkeeper SDK -> HTTP /decisions -> Oathkeeper Service
```

SDK 不包含本地 Rule Matcher、Authenticator、Authorizer 和 Mutator，因此“使用 SDK”不能省掉 Oathkeeper 服务进程。

### 2.2 能否把源码作为 Go Library 嵌入

源码确实暴露了部分 Go 构造器：

```text
driver.NewRegistry(...)
api.NewJudgeHandler(...)
proxy.New...
```

所以从编译层面可以导入 `github.com/ory/oathkeeper` 的公开包，自行装配 Registry 和 HTTP Handler。但这不是官方提供的稳定嵌入模式：

- 没有一个面向 Gateway 的稳定 `Authorize(request) result` SDK；
- Registry 同时装配配置、Rule Repository、所有 Handler、日志和追踪；
- 部分客户端和实现放在 `internal/*`，外部无法依赖；
- Oathkeeper 的发布兼容性针对配置和 HTTP API，不承诺内部 Go 包稳定；
- 只能嵌入 Go Gateway，Traefik、APISIX、Envoy 等都无法直接使用这条路径。

结论：

| 方案 | 是否可行 | 建议 |
| --- | --- | --- |
| 用 SDK 调用独立 Oathkeeper | 可行 | SDK 只是可选 HTTP Client，Gateway 原生 Forward Auth 通常更简单 |
| 把 Oathkeeper Go 包嵌入自研 Go Gateway | 技术上可行 | 不推荐，相当于维护自定义集成/fork |
| 只部署 Decision API，不让它代理业务流量 | 可行 | **推荐** |

如果一定要作为单个 Kubernetes 工作负载交付，更稳妥的办法是把官方 Oathkeeper 容器作为同 Pod sidecar，而不是链接内部 Go 包。

## 3. 请求流水线

```text
Request
  │
  ├── 1. Rule Matcher
  │      method + scheme + host + path
  │
  ├── 2. Authenticators（按顺序尝试）
  │      credential -> subject + extra
  │
  ├── 3. Authorizer（一个）
  │      subject 是否允许访问资源
  │
  ├── 4. Mutators（可串联）
  │      subject/extra -> Header、Cookie 或签名 JWT
  │
  └── 5. Error Handler
         JSON、WWW-Authenticate 或跳转登录
```

本地源码内置的主要 Handler：

| 阶段 | Handler |
| --- | --- |
| Authenticator | `cookie_session`、`jwt`、`oauth2_introspection`、`oauth2_client_credentials`、`bearer_token`、`anonymous`、`noop` |
| Authorizer | `allow`、`deny`、`keto_engine_acp_ory`、`remote`、`remote_json` |
| Mutator | `header`、`id_token`、`hydrator`、`cookie`、`noop` |
| Error | `json`、`redirect`、`www_authenticate` |

一个请求只应匹配一条 Rule；没有匹配就是拒绝。Authenticator 列表用于表达可接受的多种凭证，不是要求调用者同时满足所有认证方式。

## 4. Access Rule 示例

下面的规则完成：校验 Kratos Session、调用 Keto 检查文档权限、把身份转换成内部 JWT。

```yaml
- id: document-read
  match:
    url: https://api.example.com/documents/<[a-zA-Z0-9-]+>
    methods: [GET]

  upstream:
    url: http://document-service:8080

  authenticators:
    - handler: cookie_session
      config:
        check_session_url: http://kratos:4433/sessions/whoami
        preserve_path: true
        extra_from: "@this"
        subject_from: identity.id

  authorizer:
    handler: remote_json
    config:
      remote: http://permission-adapter:8080/check
      payload: |
        {
          "subject": "{{ print .Subject }}",
          "action": "view",
          "document_id": "{{ printIndex .MatchContext.RegexpCaptureGroups 0 }}",
          "method": "{{ print .MatchContext.Method }}"
        }

  mutators:
    - handler: id_token
      config:
        claims: |
          {
            "sub": "{{ print .Subject }}"
          }
```

Keto 的接口模型与 HTTP 路径参数之间通常需要一个小型 Permission Adapter：它从匹配结果提取资源 ID，再构造 Keto Check。不要为了省掉这个适配层而把业务资源语义硬编码进通用 Gateway。

## 5. 数据与配置

Oathkeeper 不需要数据库，也没有数据库迁移。它的状态主要是 Access Rules、JWT/JWKS 和运行配置：

```text
Oathkeeper
 ├── Access Rules
 │    └── file:// / http(s):// / S3 / GCS / Azure Blob
 ├── Authenticator config
 ├── Authorizer config
 ├── Mutator config + JWKS
 └── Error handler config
```

最小配置：

```yaml
serve:
  proxy:
    host: 0.0.0.0
    port: 4455
  api:
    host: 0.0.0.0
    port: 4456

access_rules:
  repositories:
    - file:///etc/oathkeeper/rules.yaml

authenticators:
  cookie_session:
    enabled: true
  jwt:
    enabled: true

authorizers:
  allow:
    enabled: true
  remote_json:
    enabled: true

mutators:
  header:
    enabled: true
  id_token:
    enabled: true
    config:
      issuer_url: https://api.example.com
      jwks_url: file:///etc/oathkeeper/jwks.json

errors:
  fallback: [json]
  handlers:
    json:
      enabled: true

log:
  level: info
  format: json
```

只启用规则实际使用的 Handler。`noop + allow` 会跳过认证和授权，只能用于明确的公共路径。

## 6. 可以接入哪些 Gateway

Decision API 使用普通 HTTP subrequest，因此兼容性的判断标准只有两个：Gateway 能否把原始请求信息传给鉴权服务，以及能否把鉴权响应 Header 写入上游请求。

| Gateway | 接入能力 | 典型方式 | 说明 |
| --- | --- | --- | --- |
| Traefik | 原生 | ForwardAuth Middleware | 配置 `/decisions` 和 `authResponseHeaders` |
| APISIX | 原生插件 | `forward-auth` | 配置 `uri`、请求 Header 和 `upstream_headers` |
| Nginx / ingress-nginx | 原生 | `auth_request` / `auth-url` | 用 `auth_request_set` 复制身份 Header |
| Envoy / Envoy Gateway | 原生 | HTTP `ext_authz` | 将鉴权路径前缀设置为 `/decisions` |
| Istio | 可接入 | Envoy ext_authz provider | 本质上仍是 HTTP External Authorization |
| Ambassador / Emissary | 原生 | AuthService | 官方列出的集成方式 |
| Kong | 需要插件 | Auth Request / External Auth 插件 | 确认所用插件版本能透传响应 Header |
| Caddy | 可接入 | `forward_auth` | 标准 Forward Auth，非 Ory 专用集成 |
| AWS API Gateway | 需要适配器 | Lambda/Custom Authorizer | Authorizer 调用 Decision API并转换响应 |

APISIX 虽然不在旧版 Oathkeeper README 的点名列表中，但其 `forward-auth` 插件满足 Decision API 契约，可以直接接入。这里的“可以”表示协议兼容，不表示 Ory 为每个 APISIX 版本维护官方示例。

### 6.1 Traefik：ForwardAuth Middleware

调用链如下：

```text
Client
  │ Cookie / Authorization
  ▼
Traefik Router
  │ 先删除客户端伪造的内部身份 Header
  │ ForwardAuth 子请求：GET /decisions
  │ X-Forwarded-Method: GET
  │ X-Forwarded-Proto: https
  │ X-Forwarded-Host: api.example.com
  │ X-Forwarded-Uri: /documents/doc-1
  ▼
Oathkeeper :4456
  │ Rule -> Authenticator -> Authorizer -> Mutator
  ├── 200 + Authorization / X-User-ID
  ├── 401
  └── 403
  │
  ▼ 仅在 200 时继续
Traefik 将允许的响应 Header 写入原请求 -> document-service
```

下面以 Traefik Kubernetes CRD 为例。先删除不能由客户端决定的内部身份 Header：

```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: strip-untrusted-identity
  namespace: application
spec:
  headers:
    customRequestHeaders:
      X-User-ID: ""
      X-User-Email: ""
---
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: oathkeeper
  namespace: application
spec:
  forwardAuth:
    address: http://oathkeeper-api.auth.svc.cluster.local:4456/decisions
    trustForwardHeader: false
    authResponseHeaders:
      - Authorization
      - X-User-ID
      - X-User-Email
```

`authResponseHeaders` 是白名单：只有列出的 Oathkeeper 响应 Header 才会覆盖到原始请求。`Cookie` 或客户端 `Authorization` 不需要写在这里；Traefik 会把原始请求 Header 交给 ForwardAuth，Oathkeeper 的 Authenticator 用它完成认证。

把两个 Middleware 挂到业务 Router，并保证清理身份 Header 的 Middleware 在前：

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: document-api
  namespace: application
spec:
  entryPoints: [websecure]
  routes:
    - match: Host(`api.example.com`) && PathPrefix(`/documents`)
      kind: Rule
      middlewares:
        - name: strip-untrusted-identity
        - name: oathkeeper
      services:
        - name: document-service
          port: 8080
  tls: {}
```

这里将 `trustForwardHeader` 设为 `false`，表示 Traefik 不信任客户端或未知前置代理传来的 `X-Forwarded-*`。如果 Traefik 前面还有受控的云负载均衡器，应在 EntryPoint 上配置 `forwardedHeaders.trustedIPs`，不要简单地信任任意来源。

### 6.2 Istio：CUSTOM AuthorizationPolicy + HTTP ext_authz

Istio 的入口 Envoy 会暂停原始请求，调用外部鉴权服务，拿到允许结果后才继续转发：

```text
Client -> Istio Ingress Gateway (Envoy)
              │ AuthorizationPolicy action=CUSTOM
              │ HTTP ext_authz
              │ /decisions + 原始路径
              ▼
         Oathkeeper :4456
              │
              ├── 200 + 身份 Header -> Envoy 写入原请求 -> Service
              └── 401/403             -> Envoy 返回 Client
```

Oathkeeper 提供 HTTP Decision API，没有实现 Envoy gRPC Check API。因此这里必须配置 `envoyExtAuthzHttp`，不能配置 `envoyExtAuthzGrpc`。

#### 6.2.1 Istio“原生支持 Check API”到底是什么意思

Istio 本身没有运行一个中心化的 Check API 服务。职责分成三层：

```text
Istiod
  └── 把 MeshConfig extensionProvider 和 AuthorizationPolicy
      转换成 Envoy 配置

Ingress Gateway / Sidecar 中的 Envoy
  └── 运行 ext_authz Filter，暂停业务请求并发起 Check

External Authorization Service
  └── 由用户部署，读取请求上下文并返回 Allow/Deny
```

因此，Istio“原生支持”的是 **Envoy `ext_authz` 客户端和策略编排**，不是 Kratos Session、RBAC、Keto 或 OPA 的具体服务端实现。

Istio 当前支持两种 External Authorization Provider：

| Istio 配置 | 外部服务需要实现什么 |
| --- | --- |
| `envoyExtAuthzGrpc` | Envoy `envoy.service.auth.v3.Authorization/Check` gRPC API |
| `envoyExtAuthzHttp` | Envoy HTTP ext_authz 约定：HTTP `200` 允许，其他响应拒绝，并按白名单复制 Header |

gRPC Check API 由 Envoy 的 Proto 定义，核心接口只有一个：

```protobuf
package envoy.service.auth.v3;

service Authorization {
  rpc Check(CheckRequest) returns (CheckResponse);
}
```

Envoy 发送的 `CheckRequest` 不是原始业务 DTO，而是统一的请求属性：

```jsonc
{
  "attributes": {
    "source": {
      "principal": "spiffe://cluster.local/ns/app/sa/frontend"
    },
    "destination": {
      "principal": "spiffe://cluster.local/ns/app/sa/document-api"
    },
    "request": {
      "http": {
        "method": "GET",
        "host": "api.example.com",
        "path": "/documents/doc-1",
        "headers": {
          "cookie": "ory_kratos_session=...",
          "authorization": "Bearer ..."
        }
      }
    }
  }
}
```

外部服务返回 `CheckResponse`：

```jsonc
// 允许
{
  "status": { "code": 0 },
  "okResponse": {
    "headers": [
      { "header": { "key": "x-user-id", "value": "alice-id" } }
    ]
  }
}

// 拒绝
{
  "status": { "code": 7 },
  "deniedResponse": {
    "status": { "code": "Forbidden" },
    "body": "permission denied"
  }
}
```

`status=OK` 表示允许；其他 gRPC Status 表示拒绝。`ok_response.headers` 可以给上游业务请求增加可信身份 Header，`denied_response` 可以决定返回客户端的 HTTP 状态、Header 和 Body。

HTTP 模式没有上述 gRPC 方法。Envoy 把原始请求的 Method、Path 和配置允许的 Header 发送到普通 HTTP 服务：

```text
200         -> 允许请求
401 / 403   -> 拒绝请求
服务异常     -> 根据 failOpen/statusOnError 处理
```

Oathkeeper `/decisions` 实现的是这套 HTTP 契约；OPA-Envoy Plugin 实现的是 gRPC `Authorization/Check`。Istio 官方示例中的 `ext-authz` 程序同时实现了 HTTP 和 gRPC，但它只按测试 Header 返回 Allow/Deny，是演示程序，不是可以直接投入生产的认证服务。

第一步，在 Istio MeshConfig 中注册 Oathkeeper。生产环境通常通过安装时使用的 `IstioOperator` 或 Helm values 管理，不要长期手工修改生成的 ConfigMap：

```yaml
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
metadata:
  name: istio-control-plane
  namespace: istio-system
spec:
  meshConfig:
    extensionProviders:
      - name: oathkeeper
        envoyExtAuthzHttp:
          service: oathkeeper-api.auth.svc.cluster.local
          port: 4456
          pathPrefix: /decisions
          timeout: 2s
          failOpen: false
          statusOnError: "503"
          includeRequestHeadersInCheck:
            - authorization
            - cookie
            - x-forwarded-proto
          headersToUpstreamOnAllow:
            - authorization
          headersToDownstreamOnDeny:
            - content-type
            - www-authenticate
            - location
            - set-cookie
```

将该文件作为 Istio 安装/升级输入，例如 `istioctl install -f istio-operator.yaml`。如果集群使用 Helm 管理 Istio，就把同一段 `meshConfig.extensionProviders` 放入对应 Helm values，避免产生两个控制面配置来源。

Istio 会自动把原始 `Host`、Method 和 Path 发送给 HTTP Authorizer；显式传递 `x-forwarded-proto` 是为了保留入口处的 HTTPS Scheme。`pathPrefix: /decisions` 会把原请求 `/documents/doc-1` 转换为鉴权请求 `/decisions/documents/doc-1`；Oathkeeper 删除 `/decisions` 前缀后，再用原始 URL 匹配 Access Rule。

此处只把 Oathkeeper `id_token` Mutator 生成的内部 `Authorization: Bearer <JWT>` 传给业务服务，避免业务服务信任可伪造的明文用户 Header。如果确实需要 `X-User-ID`，必须保证所有受保护 Rule 都通过 `header` Mutator 写入该字段，并在进入网格时删除客户端同名 Header。

`failOpen: false` 表示 Oathkeeper 超时或不可达时拒绝请求。`statusOnError: "503"` 用于区分“鉴权基础设施故障”和真正的 403 权限拒绝。

第二步，只在需要保护的入口路径触发这个 Provider：

```yaml
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: document-api-oathkeeper
  namespace: istio-system
spec:
  selector:
    matchLabels:
      app: istio-ingressgateway
  action: CUSTOM
  provider:
    name: oathkeeper
  rules:
    - to:
        - operation:
            hosts: ["api.example.com"]
            paths: ["/documents/*"]
```

`selector` 必须匹配实际 Ingress Gateway Pod 的 Label。以上策略只保护 `/documents/*`；不匹配的路径不会调用 Oathkeeper。若要保护东西向请求，可把同类 `AuthorizationPolicy` 放到业务 Namespace 并选择具体 Workload，但此时 Oathkeeper Rule 应按内部服务的 Host 和 URL 建模。

Istio 的 `CUSTOM` 结果不会绕过原生 `DENY`/`ALLOW` Policy：一个请求必须同时满足外部鉴权和其他适用的 Istio 授权策略。

### 6.3 不使用 Oathkeeper，可以选择什么

先明确 Oathkeeper 在本文架构中同时做了三件事：

```text
Authenticator：Cookie/JWT -> 可信 Subject
Authorizer：Subject + Resource + Action -> Allow/Deny
Mutator：可信 Subject -> Header/Internal JWT
```

替换它时不一定要找另一个完全相同的产品，也可以把三项职责交给 Gateway、Istio、OPA 和一个很小的认证适配服务。

| 方案 | 适用前提 | 能替代什么 | 不能直接解决什么 |
| --- | --- | --- | --- |
| Istio `RequestAuthentication` + `AuthorizationPolicy` | 客户端已经携带可验证 JWT | 本地校验 JWT 签名、issuer、audience、claims 和路径策略 | 不认识 Kratos Session Cookie，不会调用 `whoami`，不擅长文档级 ReBAC |
| 自研 Envoy Check Service | 使用 Kratos Cookie，并希望完全控制认证上下文 | 调用 Kratos/Keto/OPA，返回 Header 或内部 JWT，可完整替代 Oathkeeper | 需要自己维护协议、安全、缓存和可观测性 |
| OPA-Envoy Plugin | 身份已经由 JWT/mTLS 等方式可信建立 | 原生实现 gRPC Check API，用 Rego做细粒度授权 | 它不是 Kratos Session Adapter；仍要解决 Cookie -> Identity |
| oauth2-proxy | 系统使用标准 OAuth2/OIDC Provider 做浏览器 SSO | 登录、Session Cookie、HTTP External Auth；Istio 官方给出了接入示例 | Kratos 单独部署时不是 OIDC Provider；还需要 Hydra 等 Provider，也不负责 Keto 权限 |
| Envoy Gateway `SecurityPolicy` | 愿意用 Envoy Gateway 取代现有入口 | 内置 JWT、OIDC、API Key、基础授权，也支持 HTTP/gRPC External Auth | 切换 Gateway；Kratos Cookie 仍需要 External Auth Adapter |

#### 6.3.1 只有 JWT 和简单权限：直接使用 Istio 原生能力

如果入口请求已经携带由可信 Token Service/Hydra 签发的 JWT，可以完全不部署 Oathkeeper：

```text
Client -- JWT --> Istio Gateway
                  ├── RequestAuthentication：获取 JWKS，校验签名/iss/aud/exp
                  └── AuthorizationPolicy：检查 sub、roles、scope、path
                              │
                              ▼
                         Backend Service
```

```yaml
apiVersion: security.istio.io/v1
kind: RequestAuthentication
metadata:
  name: internal-jwt
  namespace: istio-system
spec:
  selector:
    matchLabels:
      app: istio-ingressgateway
  jwtRules:
    - issuer: https://token.example.com
      audiences: [document-api]
      jwksUri: https://token.example.com/.well-known/jwks.json
---
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: require-jwt
  namespace: istio-system
spec:
  selector:
    matchLabels:
      app: istio-ingressgateway
  rules:
    - from:
        - source:
            requestPrincipals: ["https://token.example.com/*"]
```

`RequestAuthentication` 只规定如何验证存在的 JWT；必须配合 `AuthorizationPolicy` 才能要求请求一定携带有效身份。

这条路径最简单，但前提是客户端已经获得 JWT。Kratos 默认提供的是不透明 Session Cookie/Token，不是可由 Istio 通过 JWKS 离线验证的 JWT，因此不能把 `RequestAuthentication` 直接指向 Kratos `whoami`。

#### 6.3.2 Kratos Session + Keto + OPA：自研一个 Auth Context Service

如果保留当前选型，又不使用 Oathkeeper，最匹配的替代方案是实现一个很小的 External Authorization 服务：

```text
Browser -- Kratos Cookie --> Istio Gateway / Envoy
                                  │ gRPC CheckRequest
                                  ▼
                         Auth Context Service
                           1. 调 Kratos whoami
                           2. 取得 sub/session/aal/amr
                           3. 调 Keto 检查对象关系
                           4. 调 OPA 检查上下文策略
                           5. 返回 CheckResponse
                                  │
                                  ├── OK + Internal JWT/Header
                                  └── 401 / 403
```

建议让它实现 Envoy v3 gRPC Check API：

```text
envoy.service.auth.v3.Authorization/Check
```

这样 Istio、Envoy Gateway 和独立 Envoy 都可以复用。如果还要支持 Traefik、APISIX，可以在同一服务旁边提供一个语义相同的 HTTP `/check`：

```text
gRPC Check     -> Istio / Envoy
HTTP /check    -> Traefik / APISIX / Nginx
```

这个服务必须完成：

1. 只信任 Envoy/Gateway 传入的请求上下文，拒绝客户端伪造身份 Header；
2. 区分 Kratos `401`、AAL不足、Keto/OPA拒绝和依赖故障；
3. 对 `whoami` 结果做有界缓存，并处理 Session 撤销与短 TTL；
4. 为内部 JWT 写入 `sub`、`sid`、`aal`、`amr`、`aud`、`iat`、`exp`；
5. 默认 fail-close，并提供超时、熔断、指标、追踪和决策日志。

这实际上就是把 Oathkeeper 的通用 Rule/Handler 体系，缩减成完全符合本系统语义的认证适配器。服务代码更少，但维护责任转移到了自己团队。

#### 6.3.3 已经使用 OPA：OPA-Envoy Plugin

OPA 官方的 Envoy Plugin 直接实现 gRPC Check API，Envoy 可以把请求上下文交给 Rego：

```text
Envoy -> Authorization/Check -> OPA-Envoy -> data.envoy.authz.allow
```

它适合身份已经由 Istio JWT、mTLS 或前置 Auth Context Service 建立之后，执行路径、方法、AAL、租户等 ABAC 规则。它不会自动理解 Kratos Cookie，也不负责把 Kratos Session 转成 Subject；不要把调用 `whoami`、解析 Session 和签发内部 JWT 全塞进 Rego。

#### 6.3.4 本文的选择建议

```text
单纯 JWT + 路径/角色策略
  -> Istio RequestAuthentication + AuthorizationPolicy

标准 OIDC 浏览器登录
  -> oauth2-proxy，或 Envoy Gateway OIDC

Kratos Cookie + Keto + OPA，追求开箱即用
  -> Oathkeeper HTTP Decision API

Kratos Cookie + Keto + OPA，愿意维护自有基础设施
  -> 自研 Auth Context Service，实现 Envoy gRPC Check API
```

对于本文已经确定的 `Kratos + Keto + OPA + Istio`，如果不使用 Oathkeeper，推荐 **Auth Context Service + Envoy gRPC Check API**。原因不是 gRPC 本身更“高级”，而是它把完整请求属性、Allow/Deny、上游 Header 和拒绝响应定义成稳定协议，同时保留未来切换 Envoy Gateway 的可能性。

### APISIX 示例

```yaml
plugins:
  forward-auth:
    uri: http://oathkeeper:4456/decisions
    request_headers:
      - Authorization
      - Cookie
      - X-Forwarded-Method
      - X-Forwarded-Proto
      - X-Forwarded-Host
      - X-Forwarded-Uri
    upstream_headers:
      - Authorization
      - X-User-ID
```

实际字段名需以所部署的 APISIX 版本为准。无论哪种 Gateway，都必须完成三件事：

1. Gateway 删除客户端传入的 `X-Forwarded-*` 和内部身份 Header，再生成可信值；
2. Oathkeeper API 端口只允许 Gateway 访问；
3. 只把明确允许的 Oathkeeper 响应 Header 复制给上游。

当前本地源码提交 `ab46001` 的 `/decisions` 会直接信任 `X-Forwarded-Method/Proto/Host/Uri` 并据此重建原请求。因此必须使用 NetworkPolicy，只允许 Traefik 或 Istio Gateway 访问 4456。

Ory 后续安全版本开始默认不再信任这些 Header。使用包含该安全变更的 OEL/后续 OSS 版本时，ForwardAuth/ext_authz 部署还需要在 Oathkeeper 中显式配置 `security.decision.x_forwarded_headers: trust`。这表示“Oathkeeper 信任来自受控 Gateway 的 Header”，与 Traefik 的 `trustForwardHeader` 是否信任客户端上送 Header 是两个不同的信任边界。

## 7. API

Oathkeeper 的管理/决策 API 很小：

| 接口 | 作用 |
| --- | --- |
| `GET /decisions` | 对原始请求执行 Rule 与安全流水线 |
| `GET /rules` | 列出当前 Access Rules |
| `GET /rules/{id}` | 查询指定 Rule |
| `GET /.well-known/jwks.json` | 发布 `id_token` Mutator 的公钥 |
| `GET /health/alive` | 存活检查 |
| `GET /health/ready` | Rule Repository 等依赖就绪检查 |
| `GET /version` | 查询版本 |

`/decisions` 在 OpenAPI 中显示为 GET，但 Handler 接受所有 HTTP Method；Gateway 应通过当前请求方法或 `X-Forwarded-Method` 告诉 Oathkeeper 原始 Method。

### 7.1 两个监听端口的实际请求流程

4455 和 4456 是同一个 Oathkeeper 进程的两种入口：

```text
4455：Reverse Proxy

Client
  │ 业务请求 + 外部凭证
  ▼
Oathkeeper :4455
  │ 认证、授权、签发 Internal JWT
  │ 直接代理业务请求
  ▼
Upstream Service
```

```text
4456：Decision API

Client -> Traefik
           │ 业务请求
           ├──> Oathkeeper :4456/decisions
           │      认证、授权、签发 Internal JWT
           │      返回 200 + Authorization Header
           └──> Upstream Service
                  原始请求 + Internal JWT
```

Decision API 模式下，下游服务从 Oathkeeper API 获取验签公钥：

```text
GET http://oathkeeper:4456/.well-known/jwks.json
```

该接口只返回公钥；签名私钥由 `id_token` Mutator 通过本地 JWKS 文件读取。
4455 是直接代理业务的入口，4456 是只返回鉴权决策的入口。Gateway 架构应
使用 4456，并限制该 API 只能由 Gateway 和内部服务访问。

## 8. Docker 与 Kubernetes

本地源码提供 Compose：

```bash
cd ddd-learn/third_party/ory/oathkeeper
docker compose up
```

生产容器只需挂载配置、Rules 和 JWKS，没有数据库迁移。Rule 可以放在 Git 管理的 ConfigMap/对象存储中，但更新必须经过语法验证和回归测试。

### 8.1 整套架构的 Helm 可用性

| 组件 | 官方 Chart | Helm 仓库 | 说明 |
| --- | --- | --- | --- |
| Traefik | `traefik/traefik` | `https://traefik.github.io/charts` | Traefik 入口方案使用 |
| Istio | `istio/base`、`istio/istiod`、`istio/gateway` | `https://istio-release.storage.googleapis.com/charts` | Istio 入口方案使用，按顺序安装 |
| Kratos | `ory/kratos` | `https://k8s.ory.com/helm/charts` | 需要外部数据库、SMTP 和登录 UI |
| Keto | `ory/keto` | 同上 | 需要外部数据库 |
| OPA | 没有面向所有运行模式的统一 Chart | 按官方 Manifest 部署 | 业务授权通常使用 Sidecar/Deployment + Bundle |
| Oathkeeper | `ory/oathkeeper` | `https://k8s.ory.com/helm/charts` | 无数据库，挂载 Rules/JWKS |
| Talos OSS | 无 | 无 | 需要自建 Manifest/Chart，且只有 SQLite |
| Talos Commercial | 有 | 商业交付 | 支持外部数据库和多副本 |

Traefik 与 Istio Gateway 是两种入口方案，通常二选一：

```text
方案 A：Traefik + Oathkeeper + Kratos + Keto
方案 B：Istio Gateway/Envoy + Oathkeeper + Kratos + Keto
```

如果还需要 ABAC 策略，在两种方案中增加 OPA 即可。不要把 `gatekeeper/gatekeeper` 当作业务授权 OPA：Gatekeeper 主要检查 Kubernetes 资源准入。`opa-kube-mgmt` 虽然提供 Chart，但它侧重把 Kubernetes ConfigMap/资源加载到 OPA；普通业务授权更适合按照 OPA 官方部署文档使用 Sidecar 或独立 Deployment，并从 Bundle Server 加载版本化策略。

先添加需要的仓库：

```bash
helm repo add ory https://k8s.ory.com/helm/charts
helm repo add traefik https://traefik.github.io/charts
helm repo add istio https://istio-release.storage.googleapis.com/charts
helm repo update
```

Ory 业务组件分别安装，数据库迁移规则见各自章节：

```bash
helm upgrade --install kratos ory/kratos \
  -n auth --create-namespace -f kratos-values.yaml

helm upgrade --install keto ory/keto \
  -n auth -f keto-values.yaml
```

Traefik 方案只需要安装一个入口 Chart：

```bash
helm upgrade --install traefik traefik/traefik \
  -n gateway --create-namespace -f traefik-values.yaml
```

Istio 方案需要按依赖顺序安装 CRD/集群资源、控制面和入口 Gateway。使用 Helm 时，上一节 IstioOperator 示例应去掉 `apiVersion/kind/metadata/spec` 外层，把其中的 `meshConfig.extensionProviders` 直接放在 `istiod-values.yaml` 根节点：

```bash
helm upgrade --install istio-base istio/base \
  -n istio-system --create-namespace --wait

helm upgrade --install istiod istio/istiod \
  -n istio-system --wait -f istiod-values.yaml

helm upgrade --install istio-ingress istio/gateway \
  -n istio-ingress --create-namespace --wait -f istio-gateway-values.yaml
```

不要同时使用 `istioctl install` 和 Helm 管理同一套 Istio 控制面，否则会出现配置来源和升级所有权不清的问题。

生产环境还应给每个 `helm upgrade --install` 固定 Chart 版本，并固定组件镜像版本。推荐的发布顺序是：外部数据库与 Secret → Kratos/Keto Migration Job → Kratos/Keto/OPA → Oathkeeper 配置与 Rules → Traefik Route 或 Istio AuthorizationPolicy。这样 Gateway 不会在依赖尚未就绪时把真实流量送入认证链路。

### 8.2 部署 Oathkeeper

Kubernetes 使用官方 Helm Chart：

```bash
helm repo add ory https://k8s.ory.com/helm/charts
helm upgrade --install oathkeeper ory/oathkeeper \
  -n auth --create-namespace -f values.yaml
```

Chart 支持 `oathkeeper.config`、Access Rules 和 Mutator JWKS。可以直接从文件安装：

```bash
helm upgrade --install oathkeeper ory/oathkeeper \
  -n auth --create-namespace \
  -f oathkeeper-values.yaml \
  --set-file oathkeeper.accessRules=access-rules.json \
  --set-file oathkeeper.mutatorIdTokenJWKs=jwks.json
```

`jwks.json` 是私钥材料，不应提交到 Git；生产环境优先使用 External Secrets/Vault 生成 Kubernetes Secret。Chart 的 `demo=true` 包含公开测试密钥，只能用于演示。

可选的 Oathkeeper Maester 会把 `rules.oathkeeper.ory.sh/v1alpha1` CR 汇总成 Rules ConfigMap。规则很多且由不同服务团队维护时再启用 `maester.enabled=true`；简单系统直接维护一个 Rules 文件更清晰。

Decision API 部署推荐：

```text
Gateway Namespace
  Gateway Pods
       │ NetworkPolicy
       ▼
  Oathkeeper Pods :4456
       ├── Kratos :4433
       ├── Keto / OPA / Remote Authorizer
       └── Rules ConfigMap / Object Storage
```

不使用 Oathkeeper Reverse Proxy 时，不要为 4455 创建 Service/Ingress。4456 也不应暴露公网。

## 9. 总结

Oathkeeper 最合适的定位是 Gateway 旁边的 Policy Enforcement Adapter：它把 Kratos Session、JWT、Keto/OPA 决策统一成 200/401/403 和可信身份 Header。

它可以作为 HTTP SDK 的目标服务使用，但没有官方稳定的“本地鉴权 SDK”。对于 Traefik、APISIX、Envoy、Nginx 等 Gateway，Decision API/Forward Auth 比源码嵌入更独立、更容易扩缩容，也更容易跟随 Oathkeeper 安全升级。

使用 Istio 时还应先判断能否直接使用原生 JWT 和 AuthorizationPolicy。只有需要校验 Kratos Cookie、查询动态关系或生成内部身份上下文时，才需要 Oathkeeper 或自研 External Authorization Service。

参考：[Oathkeeper 官方介绍](https://www.ory.com/oathkeeper)、[Ory Helm Charts](https://k8s.ory.com/helm/)、[Oathkeeper Helm Chart](https://k8s.ory.com/helm/oathkeeper.html)、[Traefik Kubernetes Helm 部署](https://doc.traefik.io/traefik/setup/kubernetes/)、[Traefik ForwardAuth](https://doc.traefik.io/traefik/middlewares/http/forwardauth/)、[Istio Helm 部署](https://istio.io/latest/docs/setup/install/helm/)、[Istio External Authorization](https://istio.io/latest/docs/tasks/security/authorization/authz-custom/)、[Istio ext_authz 示例源码](https://github.com/istio/istio/tree/release-1.30/samples/extauthz)、[Istio RequestAuthentication](https://istio.io/latest/docs/reference/config/security/request_authentication/)、[Istio AuthorizationPolicy](https://istio.io/latest/docs/reference/config/security/authorization-policy/)、[Envoy v3 External Authorization Proto](https://github.com/envoyproxy/envoy/blob/main/api/envoy/service/auth/v3/external_auth.proto)、[OPA-Envoy Plugin](https://www.openpolicyagent.org/docs/envoy)、[Envoy Gateway External Authorization](https://gateway.envoyproxy.io/v1.8/tasks/security/ext-auth/)、[OPA Kubernetes 部署](https://www.openpolicyagent.org/docs/deploy/k8s)、[APISIX forward-auth](https://apisix.apache.org/docs/apisix/plugins/forward-auth/)、本地 `api/decision.go`、`driver/registry.go`、`pipeline/*` 与 `spec/api.json`。
