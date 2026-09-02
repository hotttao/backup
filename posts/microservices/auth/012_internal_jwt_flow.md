---
weight: 12
title: "12 Internal JWT：Traefik、Oathkeeper、Kratos 与业务服务的完整请求"
date: 2026-09-01T14:00:00+08:00
lastmod: 2026-09-01T14:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "以当前 002_internal_jwt 部署为准，对照真实 URL 理解一次业务请求如何经过 Traefik、Oathkeeper、Kratos 和 xhs_service"
tags: ["auth", "ory", "kratos", "oathkeeper", "jwt", "traefik"]
categories: ["microservice"]
toc:
  auto: false
---

本文只描述当前仓库 `deployments/002_internal_jwt` 的实际链路。它采用
Traefik ForwardAuth + Oathkeeper Decision API：浏览器携带 Kratos Session Cookie
访问业务 API，Oathkeeper 验证 Cookie 后签发短期 Internal JWT，Traefik 再把 JWT
传给 `xhs_service`。

## 1. 当前部署中的地址

| 组件 | 地址 | 用途 |
| --- | --- | --- |
| Account UI / Vite | `http://192.168.2.41:5173` | 浏览器打开页面；开发代理 `/kratos` 和 `/v1` |
| Traefik | `http://192.168.2.41:8080` | 浏览器和 API Client 的统一入口 |
| Kratos Public API | `http://kratos:4433` | Session、Login Flow、Recovery Flow |
| Kratos Admin API | `http://kratos:4434` | seed 初始化 Identity；不经过 Traefik |
| Oathkeeper Decision API | `http://oathkeeper:4456` | Traefik 调用 `/decisions`；业务服务获取 JWKS |
| Oathkeeper Reverse Proxy | `http://oathkeeper:4455` | 本模块不使用 |
| `xhs_service` | `http://xhs_service:8082` | 内部业务上游；只接受可信 Internal JWT |
| Mailpit | `http://192.168.2.41:8025` | 查看 Recovery/Verification 邮件 |

浏览器经过 Vite 访问业务接口时，`/v1` 只做转发，不删除服务前缀：

```text
http://192.168.2.41:5173/v1/xhs/...
        │ Vite proxy，changeOrigin=true
        ▼
http://192.168.2.41:8080/v1/xhs/...
        │ Traefik PathPrefix(`/v1/xhs`)
        ▼
xhs_service 收到同样的 /v1/xhs/...
```

`changeOrigin=true` 很重要：Oathkeeper 的 Rule 用
`http://192.168.2.41:8080/v1/<.*>` 匹配请求。Vite 如果把 `:5173` 作为原始 Host
传给网关，Oathkeeper 就无法匹配这条 Rule。

## 2. 先获得 Kratos Session

登录页面的 Browser Flow 细节见
[006_ory_kratos_flow.md](./006_ory_kratos_flow.md)。与本模块业务链路有关的实际请求是：

```text
GET  http://192.168.2.41:5173/kratos/self-service/login/browser
  -> Traefik /kratos/self-service/login/browser
  -> Kratos GET /self-service/login/browser
  -> 303 http://192.168.2.41:5173/login?flow=<login-flow-id>

GET  http://192.168.2.41:5173/kratos/self-service/login/flows?id=<login-flow-id>
POST http://192.168.2.41:5173/kratos/self-service/login?flow=<login-flow-id>
  -> Traefik 删除 /kratos
  -> Kratos Public API :4433
  -> 成功响应 Set-Cookie: ory_kratos_session=...
```

前端首页随后会调用：

```http
GET http://192.168.2.41:5173/kratos/sessions/whoami
Cookie: ory_kratos_session=<session-cookie>
```

这个请求用于 Account UI 显示当前登录状态。它和 Oathkeeper 后续为业务请求
发起的内部 `whoami` 是两次不同的 HTTP 请求。

## 3. 查看抓取内容：一次完整成功请求

以 Alice 已登录后查看组织 G 的内容为例，浏览器发起：

```http
GET http://192.168.2.41:8080/v1/xhs/organizations/G/crawl/contents
Cookie: ory_kratos_session=<session-cookie>
```

实际过程按 URL 展开如下。

### 3.1 Traefik 匹配业务 Router

Traefik 根据：

```yaml
rule: PathPrefix(`/v1/xhs`)
```

匹配 `xhs-api` Router，不执行 `/kratos` 的 `stripPrefix`，原始路径仍然是：

```text
/v1/xhs/organizations/G/crawl/contents
```

然后执行 `oathkeeper-forward-auth` Middleware，向 Oathkeeper 发起鉴权子请求：

```http
GET http://oathkeeper:4456/decisions
X-Forwarded-Method: GET
X-Forwarded-Proto: http
X-Forwarded-Host: 192.168.2.41:8080
X-Forwarded-Port: 8080
X-Forwarded-Uri: /v1/xhs/organizations/G/crawl/contents
Cookie: ory_kratos_session=<session-cookie>
```

这是 Docker Compose 网络内的请求，客户端不能直接看到它。Traefik 的
`authResponseHeaders` 只复制 Oathkeeper 响应中的 `Authorization` Header。

### 3.2 Oathkeeper 匹配 Rule

Oathkeeper 使用 ForwardAuth 提供的原始请求信息，重建本次请求 URL：

```text
http://192.168.2.41:8080/v1/xhs/organizations/G/crawl/contents
```

它匹配：

```yaml
- id: internal-api-authentication
  match:
    url: http://192.168.2.41:8080/v1/<.*>
    methods: [GET, POST, PUT, PATCH, DELETE]
```

这个 Rule 只规定统一认证链路，不判断 Alice 是否属于组织 G，也不区分
`contents` 和 `keywords` 的业务权限。

### 3.3 Oathkeeper 调用 Kratos 验证 Cookie

`cookie_session` Authenticator 使用内部地址请求 Kratos：

```http
GET http://kratos:4433/sessions/whoami
Cookie: ory_kratos_session=<session-cookie>
```

Kratos 返回有效 Session，例如：

```json
{
  "active": true,
  "identity": {
    "id": "<kratos-identity-id>",
    "traits": {
      "email": "alice@example.com"
    }
  }
}
```

Oathkeeper 根据 `subject_from: identity.id` 得到：

```text
Subject = <kratos-identity-id>
```

这里的 `Subject` 来自 Kratos 返回值，不来自客户端提交的
`X-User-ID`、`X-Subject` 或 `X-Role`。

### 3.4 Authorizer 和 Token Mutator

当前 Authorizer 是：

```yaml
authorizer:
  handler: allow
```

Session 验证成功后，`allow` 直接允许请求进入下一阶段。随后 `id_token` Mutator
使用 Oathkeeper 私钥签发短期 JWT：

```json
{
  "iss": "http://oathkeeper:4456/",
  "sub": "<kratos-identity-id>",
  "aud": ["internal-api"],
  "iat": 1787904000,
  "nbf": 1787904000,
  "exp": 1787904300,
  "jti": "<generated-token-id>",
  "principal_type": "user"
}
```

Oathkeeper 给 Traefik 的 Decision 响应是：

```http
HTTP/1.1 200 OK
Authorization: Bearer <internal-jwt>
```

这个 JWT 由 Oathkeeper 生成，浏览器不会直接拿到它。

### 3.5 Traefik 转发到 xhs_service

ForwardAuth 返回 200 后，Traefik 才把原始业务请求转发给上游：

```http
GET http://xhs_service:8082/v1/xhs/organizations/G/crawl/contents
Authorization: Bearer <internal-jwt>
```

请求路径、方法和业务请求体保持原样。客户端提交的旧 `Authorization` 不应被
信任；当前链路使用 Oathkeeper 返回的可信 Header。

### 3.6 xhs_service 验证 JWT 并执行业务代码

`xhs_service` 的 `serverhertz/jwt` 中间件按以下顺序处理：

```text
读取 Authorization: Bearer <internal-jwt>
  -> 检查签名算法 RS256
  -> GET http://oathkeeper:4456/.well-known/jwks.json（首次或缓存刷新）
  -> 使用 JWKS 公钥验证签名
  -> 校验 iss、aud、exp、nbf、sub
  -> 写入 Principal{Subject: <kratos-identity-id>} 到请求上下文
  -> 进入 xhs_service Handler
```

JWKS 公钥只在 Oathkeeper 的 Docker 网络中获取，业务服务不读取包含私钥的
`id_token.jwks.json`。

最后，Handler 从 URL 中读取：

```text
organization_id = G
```

当前 Mock PermissionChecker 允许普通请求，Repository 返回固定 mock 内容，响应
沿原路返回客户端：

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "contents": [
    {"id": "note-001", "title": "Ory Kratos browser login flow", "source_keyword": "Ory"},
    {"id": "note-002", "title": "Hertz internal JWT middleware", "source_keyword": "Hertz"}
  ]
}
```

## 4. 三个业务接口的差异

三个接口共享同一条认证链路，只在 Traefik 转发给 `xhs_service` 后由 Handler
区分方法、路径和请求体：

| 浏览器请求 | 业务请求体 | xhs_service 动作 |
| --- | --- | --- |
| `GET /v1/xhs/organizations/G/crawl/contents` | 无 | 验证 JWT，读取组织 G 的 mock 内容 |
| `POST /v1/xhs/organizations/G/crawl/tasks` | `{"keywords":["Ory","Hertz"]}` | 验证 JWT，创建 `pending` mock task |
| `PUT /v1/xhs/organizations/G/crawl/keywords` | `{"values":["Kratos","Oathkeeper"]}` | 验证 JWT，返回更新后的 mock 关键词 |

当前接口的完整公网 URL 都以 `/v1/xhs` 开头。`/xhs` 是服务自己规划的前缀，
不是 Traefik 转发时临时截取出来的字符串。

## 5. 失败请求在哪里结束

### 没有 Kratos Session：401，业务服务不被调用

```text
Client
  -> Traefik /v1/xhs/...
  -> Oathkeeper /decisions
  -> Kratos /sessions/whoami
  -> 401 Unauthorized
  -> Traefik 返回 401
```

此时不会签发 JWT，也不会请求 `xhs_service`。

### Oathkeeper 签发了无效 JWT：xhs_service 返回 401

客户端不能通过公网请求把一个“无效 Internal JWT”强行传给 xhs_service，因为
Traefik ForwardAuth 成功后会使用 Oathkeeper 返回的身份 Header。要单独测试
业务服务的 JWT 验证器，需要在内部网络直接请求：

```http
GET http://xhs_service:8082/v1/xhs/organizations/G/crawl/contents
Authorization: Bearer invalid.jwt.token
```

验证器会因为签名、格式或 claims 校验失败返回 `401 Unauthorized`。

### Session 有效但业务权限失败：403，结束在 xhs_service

当前用组织 ID `forbidden` 模拟：

```text
Client
  -> Oathkeeper 验证 Session，返回 200 + Internal JWT
  -> Traefik 转发到 xhs_service
  -> xhs_service JWT 验证成功
  -> Mock PermissionChecker 返回 false
  -> 403 Forbidden
```

这说明 `401` 和 `403` 的责任不同：前者是认证凭证无效，后者是业务权限拒绝。
接入 Keto 后，Mock PermissionChecker 会替换成 Keto Check。

## 6. 两个端口在本请求中的位置

本模块只使用 Oathkeeper 的 4456：

```text
Traefik :8080
  -> Oathkeeper :4456/decisions
  -> 200 + Authorization Header
  -> xhs_service :8082
```

4455 是 Oathkeeper Reverse Proxy：

```text
Client
  -> Oathkeeper :4455
  -> Oathkeeper 自己完成 Rule、认证、JWT 注入和上游代理
  -> xhs_service
```

两种模式都可以完成认证，但当前部署选择 4456，让 Traefik 保留路由、TLS、负载
均衡和其他 Gateway 能力；Oathkeeper 只提供 Decision API。

## 7. 排查请求时记录什么

在浏览器 Network 面板和容器日志中，至少记录：

| 位置 | 应确认的内容 |
| --- | --- |
| 浏览器 | URL 是否为 `/v1/xhs/...`，是否携带 Session Cookie，响应状态 |
| Traefik | 是否匹配 `xhs-api`，是否调用 `/decisions`，上游是否为 `xhs_service:8082` |
| Oathkeeper | Rule 是否匹配，`cookie_session` 是否成功，Decision 是否返回 200 |
| Kratos | 内部 `/sessions/whoami` 是否返回有效 Session |
| xhs_service | JWT 是否通过签名和 claims 验证，业务权限是否返回 403 |

不要记录密码、Recovery Code、CSRF Token、Session Cookie、完整 JWT 或 JWKS 私钥。
