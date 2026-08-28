---
weight: 1
title: "3 认证和鉴权过程"
date: 2026-08-28T10:00:00+08:00
lastmod: 2026-08-28T10:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "通过 OpenFGA + OPA 理解 ReBAC 和 ABAC"
featuredImage: 

tags: ["auth"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

我们理解了认证和鉴权的基础理论之后，现在可以规划认证和鉴权的具体过程，需要解决以下问题:
1. 客户端应该如何跟 gateway 交互
2. gateway 如何与 认证鉴权的服务交互
3. gateway 之后的微服服务需要认证和鉴权么
4. 微服务之间需要认证和鉴权么
5. 用户的认证和鉴权信息应该怎么传递，传递哪些信息，传递的信息不满足服务需求，如何拿到扩展信息。
6. 定时任务和 MQ 这种长时间的任务如何做认证和鉴权

<!-- more -->

## 1. 先确定最重要的问题

认证架构中最重要的决策不是“用 Kratos 还是 JWT”，而是：

> Gateway 完成外部认证之后，可信的身份信息如何传递给内部服务？

这个问题决定了内部服务是否依赖 Kratos、能否本地验证身份、Token 是否可以复用，以及 Session 撤销何时生效。

一次请求还可能同时存在两种身份：

```text
Subject：这次操作代表谁
例如 user:9f425a8d...、service:document-importer

Actor：当前这一跳实际是谁发起的
例如 gateway、document-service、scheduler
```

JWT 或 Session 主要证明 Subject，mTLS 或 Workload Identity 证明 Actor。二者不能相互替代：知道“这次操作代表 Alice”，不等于知道“当前请求确实来自 document-service”。

后续采用以下职责边界：

| 组件 | 职责 |
| --- | --- |
| Kratos | 用户、凭证、登录流程和 Session |
| Hydra | OAuth2/OIDC、第三方 Client 和 Service Token；有这些需求时再引入 |
| Oathkeeper | Gateway 旁的身份代理：验证外部凭证并生成内部身份上下文 |
| OpenFGA | 用户、组织和资源之间的 ReBAC 关系授权 |
| OPA | 时间、风险、租户状态、调用服务等 ABAC 动态策略 |
| Business Service | 拥有业务数据并执行最终授权结果 |

本文已经选择 OpenFGA，因此不再同时部署功能重叠的 Ory Keto。

## 2. Gateway 到内部服务的四种方案

从 Gateway 向内部服务传递 Subject，常见方案有四种：

| 方案 | Gateway 向内部传什么 | 内部服务如何验证 |
| --- | --- | --- |
| 透传 Kratos Session | Session Cookie / Session Token | 调用 Kratos `/sessions/whoami` |
| 注入可信 Header | `X-Internal-Subject` 等 Header | 依赖 mTLS 和网络边界 |
| 签发 Internal JWT | 短期、带签名的 JWT | 使用 JWKS 公钥本地验证 |
| 逐跳 Token Exchange | 面向目标服务的新 JWT | 使用 JWKS 公钥本地验证 |

无论选择哪一种 Subject 传递方案，服务之间都应使用 mTLS 或 Workload Identity 验证 Actor。下面对每种方案都回答同样四个问题：

```text
1. Client 如何访问 Gateway？
2. Gateway 如何与认证服务交互？
3. Gateway 向内部服务传递什么？
4. 内部服务如何认证和鉴权？
```

## 3. 方案一：透传 Kratos Session

### 3.1 Client 如何访问 Gateway

浏览器登录 Kratos 后获得 Session Cookie：

```http
GET /api/documents/doc-001 HTTP/1.1
Host: api.example.com
Cookie: ory_kratos_session=...
```

Native App 或代表用户操作的 CLI 可以使用 Kratos Session Token：

```http
GET /api/documents/doc-001 HTTP/1.1
X-Session-Token: ory_st_...
```

Cookie 和 Session Token 都是不透明凭证，不是 JWT。它们只用于让 Kratos 找到服务端保存的 Session。

### 3.2 Gateway 如何与 Kratos 交互

Gateway 或 Oathkeeper 把客户端凭证交给 `/sessions/whoami`：

```text
Client ── Session Cookie/Token ──> Gateway
                                      │
                                      └── /sessions/whoami ──> Kratos
```

Kratos 返回 Session 对象：

```jsonc
{
  "id": "session-7d21", // Session ID
  "active": true, // Session 当前是否有效
  "expires_at": "2026-08-29T10:00:00Z", // Session 过期时间
  "authenticated_at": "2026-08-28T10:00:00Z", // 最近完成认证的时间
  "authenticator_assurance_level": "aal1", // 当前认证强度
  "identity": {
    "id": "9f425a8d-7efc-4768-8f23-7647a74fdf13", // 稳定的用户 ID
    "state": "active" // Identity 是否可用
  }
}
```

Session 无效时返回 `401 Unauthorized`。Session 有效只能证明用户是谁，不能证明用户可以编辑 `doc-001`。

### 3.3 Gateway 向内部服务传递什么

Gateway 原样转发 Session：

```text
Gateway ── Session Cookie/Token ──> Document Service
```

Gateway 必须删除客户端伪造的内部身份 Header，但不能把 Session 内容直接当成已经经过密码学保护的内部上下文。

### 3.4 内部服务如何认证和鉴权

Document Service 收到 Session 后，再调用 Kratos：

```text
Document Service ── Session ──> Kratos /sessions/whoami
```

得到 `identity.id` 后，服务再执行：

```text
OpenFGA：user:Alice 是否是 document:doc-001 的 editor？
OPA：文档是否锁定、请求风险是否允许、当前 Actor 是否可信？
```

如果 Gateway 和内部服务都要确认身份，同一个请求会重复调用 Kratos。也可以让 Gateway 不验证，只由内部服务验证，但这意味着 Gateway 无法进行统一的登录检查。

### 3.5 取舍

优点是实现直接，Session 注销和用户封禁能较快生效。问题是：

- 每个内部服务都依赖 Kratos；
- 浏览器凭证进入内部网络；
- 同一请求可能多次查询 Kratos；
- 服务数量增加后，认证逻辑分散。

它适合服务很少的系统，不作为本文最终方案。

## 4. 方案二：Gateway 注入可信 Header

### 4.1 Client 如何访问 Gateway

Client 可以使用多种外部凭证：

| 调用者 | 凭证 |
| --- | --- |
| Browser / SPA | Kratos Session Cookie |
| Native App / 用户型 CLI | Kratos Session Token 或用户 Access Token |
| CI、部署脚本、自动化 CLI | Service Token |
| 第三方 OAuth2 Client | Hydra Access Token |

客户端不能提交身份结论：

```http
X-Internal-Subject: user:admin
X-Internal-Tenant: tenant-other
```

Gateway 必须先删除所有外部同名 Header。

### 4.2 Gateway 如何与认证服务交互

Gateway 根据凭证类型选择验证方式：

| 外部凭证 | 验证方式 |
| --- | --- |
| Kratos Session | 在线调用 `/sessions/whoami` |
| JWT Access Token | 使用 Issuer 的 JWKS 本地验签 |
| 不透明 Access Token | 调用 Hydra Introspection |
| API Key | 调用对应的 API Key 服务验证 |

因此，“Gateway 是否每次都请求 Kratos”的答案取决于客户端带什么：Session 需要查询 Kratos，JWT 不需要，不透明 OAuth Token 查询的是 Hydra 而不是 Kratos。

### 4.3 Gateway 向内部服务传递什么

Gateway 将认证结果转换成 Header：

```http
X-Internal-Subject: user:9f425a8d-7efc-4768-8f23-7647a74fdf13
X-Internal-Principal-Type: user
X-Internal-Session-ID: session-7d21
X-Internal-Tenant-ID: tenant-a
X-Internal-AAL: aal1
```

Header 本身没有签名。它之所以可信，完全依赖以下条件：

- 业务服务不能被外部直接访问；
- Gateway 清理客户端同名 Header；
- Gateway 到服务之间使用 mTLS；
- 服务只接受受信 Gateway 注入的身份 Header。

### 4.4 内部服务如何认证和鉴权

服务先通过 mTLS 确认 `actor=gateway`，再读取 Header 得到 Subject。最终仍由业务服务调用 OpenFGA 和 OPA，不能因为 Header 来自 Gateway 就跳过资源授权。

### 4.5 取舍

优点是实现简单、没有 JWT 密钥管理。缺点是 Header 没有独立的密码学证明，一旦服务被绕过 Gateway 访问，或者某个内部服务能伪装 Gateway，身份就可能被伪造。

它适合严格单入口、小规模且网络边界可靠的系统，不作为本文最终方案。

## 5. 方案三：Gateway 签发 Internal JWT

这是本文推荐的方案。外部凭证只负责进入 Gateway，Internal JWT 负责在内部传递已经验证的 Subject。

### 5.1 Client 如何访问 Gateway

CLI 只是一种程序形态，必须先判断它代表用户还是机器：

| 调用者 | 代表谁 | 推荐凭证 |
| --- | --- | --- |
| Browser / SPA | 登录用户 | Kratos Session Cookie |
| Native App / 交互式 CLI | 登录用户 | Kratos Session Token，或 Hydra 用户 Access Token |
| CI、部署脚本、自动化 CLI | 机器主体 | Hydra Client Credentials 签发的 Service Token |
| 第三方应用 | 用户或第三方 Client | Hydra OAuth2 Access Token |

例如开发者用 CLI 查看自己的文档时，主体是用户；CI 定时导入文档时，主体是 `service:document-importer`，不能伪装成某个用户。

### 5.2 Gateway 如何完成外部认证

Gateway 的验证方式只有两类：

```text
在线验证：把不透明凭证交给保存状态的认证服务
本地验证：使用签发方 JWKS 验证自包含 JWT
```

#### Kratos Session：在线验证

```text
Browser ── Session Cookie ──> Gateway / Oathkeeper
                                  │
                                  └── /sessions/whoami ──> Kratos
```

浏览器每次只携带 Session Cookie 时，基线实现确实需要在每个外部请求中调用一次 Kratos。可以设置秒级短缓存，但要接受缓存期间撤销不能立即生效：

- Cache Key 使用 Session 凭证摘要或 Session ID，不能只用用户 ID；
- TTL 不得超过 Session 的 `expires_at`；
- 同一次请求内直接复用认证结果；
- 高风险操作不依赖长时间缓存。

#### JWT：本地验证

```text
Client ── Authorization: Bearer <JWT> ──> Gateway
                                                 │
                                                 └── 使用缓存的 JWKS 验证
```

Gateway 验证：

```text
1. alg 是否在允许列表
2. kid 是否能找到公钥
3. 签名是否正确
4. iss 是否是受信 Issuer
5. aud 是否包含 public-api
6. exp、nbf、iat 是否有效
7. sub 是否存在，Token Profile 是否符合预期
```

JWKS 只在启动、缓存到期或出现未知 `kid` 时刷新，不需要每个请求获取。JWT 的代价是撤销通常要等到 `exp`；因此 Access Token 应短期有效。

不透明的 Hydra Access Token 不能本地验签，必须调用 Introspection。不能仅根据 Token 字符串的外观判断其有效性。

### 5.3 Gateway 如何生成 Internal JWT

在 Gateway 旁部署 Oathkeeper：

```text
外部 Session / Access Token
          ↓
Oathkeeper authenticator
  ├── cookie_session → Kratos /sessions/whoami
  ├── jwt            → JWKS 本地验签
  └── oauth2_introspection → Hydra
          ↓
统一的 Subject Context
          ↓
Oathkeeper id_token mutator
          ↓
5 分钟 Internal JWT
```

这里必须区分两个动作：

```text
当前请求中 Session → Internal JWT
  下游服务不再查询 Kratos
  浏览器下次仍带 Cookie，Gateway 仍需查询 Kratos

客户端事先取得 JWT → Gateway 本地验签
  Gateway 不查询 Kratos
  但撤销最迟在 JWT 过期时生效
```

### 5.4 Internal JWT 携带什么

JWT Header：

```jsonc
{
  "alg": "RS256", // 签名算法；接收服务使用固定允许列表
  "kid": "identity-key-2026-08", // 公钥编号，用于从 JWKS 选择公钥
  "typ": "JWT" // Token 类型
}
```

代表用户的 Payload：

```jsonc
{
  "iss": "https://identity.internal", // 内部签发方
  "sub": "9f425a8d-7efc-4768-8f23-7647a74fdf13", // Kratos identity.id
  "principal_type": "user", // 明确这是用户主体
  "aud": ["internal-api"], // 允许接受 Token 的内部信任域
  "sid": "session-7d21", // 原始 Session ID，用于审计和撤销关联
  "tenant_id": "tenant-a", // Gateway 已验证的当前租户上下文
  "client_id": "web-app", // 最初发起请求的客户端
  "aal": "aal1", // 用户认证强度
  "auth_time": 1787903900, // 最近完成用户认证的时间
  "iat": 1787904000, // Internal JWT 签发时间
  "nbf": 1787904000, // 在此时间之前不可使用
  "exp": 1787904300, // 过期时间；本文为 5 分钟
  "jti": "token-01J67Y8E" // Token 唯一 ID
}
```

代表机器的 Payload：

```jsonc
{
  "iss": "https://identity.internal", // 内部签发方
  "sub": "document-importer", // 机器主体
  "principal_type": "service", // 明确这是服务主体
  "aud": ["internal-api"], // 内部信任域
  "client_id": "document-importer", // 原始 OAuth2 Client
  "scope": "document:import", // 可选的粗粒度接口能力
  "iat": 1787904000, // 签发时间
  "nbf": 1787904000, // 生效时间
  "exp": 1787904300, // 过期时间
  "jti": "service-token-01J67Y8E" // Token 唯一 ID
}
```

Service Token 没有用户 Session，因此没有 `sid`、`aal` 和 `auth_time`。

Internal JWT 不包含以下内容：

- owner、editor、viewer 等资源关系：由 OpenFGA 实时计算；
- 文档锁定、风险等级：由业务服务和 OPA 计算；
- 完整 Profile：授权不需要，而且可能变化；
- 当前调用服务 Actor：每一跳都不同，由 mTLS 身份确定；
- 完整权限列表：体积大、容易过期，并会复制 OpenFGA 的职责。

`tenant_id` 也不能直接复制客户端 Header。用户切换租户时，Gateway 必须先验证用户属于该租户，再写入 Token。

### 5.5 内部服务如何验证 JWT

内部平台发布只包含公钥的 JWKS：

```text
https://identity.internal/.well-known/jwks.json
```

```jsonc
{
  "keys": [
    {
      "kty": "RSA", // 密钥类型
      "use": "sig", // 用于签名验证
      "alg": "RS256", // 对应 JWT Header.alg
      "kid": "identity-key-2026-08", // 对应 JWT Header.kid
      "n": "...", // RSA 公钥模数
      "e": "AQAB" // RSA 公钥指数
    }
  ]
}
```

密钥分为两份：

```text
Private JWKS：只挂载给 Oathkeeper，用于签名
Public JWKS：提供给内部服务，用于验证
```

服务不会每个请求访问 JWKS，而是本地缓存。遇到未知 `kid` 时只刷新一次；无法取得未知公钥时失败关闭。

所有内部服务配置相同的 JWT 信任参数：

```yaml
internal_identity:
  issuer: https://identity.internal
  audience: internal-api
  jwks_url: https://identity.internal/.well-known/jwks.json
  allowed_algorithms: [RS256]
  clock_skew: 30s
```

每个服务执行相同验证：

```text
签名 → iss → aud → exp/nbf/iat → sub → principal_type → tenant_id
```

同一次同步调用链可以复用同一个 `aud=internal-api` 的 JWT：

```text
Gateway ── JWT ──> Document ── 同一个 JWT ──> Audit
```

所有服务共享的是 Issuer 和公钥信任，不共享私钥。Document 和 Audit 仍然拥有不同的 mTLS 身份。

密钥轮换顺序不能颠倒：

```text
1. 生成新密钥 key-B
2. Public JWKS 同时发布 key-A、key-B
3. 等待内部服务刷新 JWKS Cache
4. Oathkeeper 开始使用 key-B 签名
5. 等待 key-A 签发的 JWT 全部过期
6. 从 Public JWKS 移除 key-A
```

### 5.6 内部服务如何授权

每个服务拥有独立的 mTLS 身份，例如：

```text
Gateway          = spiffe://example.com/ns/prod/sa/gateway
Document Service = spiffe://example.com/ns/prod/sa/document-service
Audit Service    = spiffe://example.com/ns/prod/sa/audit-service
```

使用 SPIRE 时，服务通过本机 Workload API 取得短期 X.509-SVID 和 Trust Bundle，不把长期证书私钥写入镜像。JWT 证明 Subject，客户端证书证明当前这一跳的 Actor。

以 Document 调用 Audit 为例：

```text
mTLS → actor   = document-service
JWT  → subject = user:9f425a8d...

OPA     → document-service 是否允许调用 audit.write
OpenFGA → Alice 是否拥有目标文档的必要关系
```

Gateway 只做接口级粗粒度检查；业务服务拥有资源数据，是最终授权执行点。

### 5.7 取舍

优点：

- 下游服务不依赖 Kratos；
- 身份上下文有签名，可以独立验证；
- JWKS 可缓存，适合水平扩展；
- 外部凭证被统一转换，内部服务不需要理解 Cookie、Hydra Token 等差异。

代价：

- 需要管理签名密钥和轮换；
- Bearer JWT 被窃取后可以重放；
- Kratos Session 撤销后，Internal JWT 最长仍可使用到 `exp`。

本文把 Internal JWT 有效期设为 5 分钟。高风险接口可以额外检查 `sid`、`jti` 撤销列表，或重新确认 Session。

## 6. 方案四：逐跳 Token Exchange

### 6.1 Client 如何访问 Gateway

外部 Client 的凭证与方案三相同：浏览器使用 Session，用户型 CLI 使用用户凭证，自动化 CLI 使用 Service Token。

### 6.2 Gateway 如何与认证服务交互

Gateway 先完成外部认证，再从 Token Service 取得面向第一个业务服务的 Token：

```text
Gateway + 已验证 Subject
          ↓
Token Service
          ↓
aud=document-service 的短期 Token
```

### 6.3 服务之间如何传递身份

Document Service 不能把自己的 Token 直接交给 Audit，而是执行 Token Exchange：

```text
Document Service
  │ 当前用户 Token + document-service 的 mTLS 身份
  ▼
Token Service
  │ 检查是否允许委托
  ▼
aud=audit-service 的新 Token
  ▼
Audit Service
```

新 Token 可以进一步限制：

```jsonc
{
  "sub": "9f425a8d-7efc-4768-8f23-7647a74fdf13", // 代表的用户
  "aud": ["audit-service"], // 只能交给 Audit Service
  "scope": "audit:write", // 只允许写审计事件
  "exp": 1787904120 // 更短的有效期
}
```

### 6.4 内部服务如何认证和鉴权

被调用方仍然通过 JWKS 本地验证 JWT，并通过 mTLS 验证当前调用服务。OpenFGA 和 OPA 仍然执行资源关系和动态策略。

Token Service 还必须判断：

```text
document-service 是否允许代表当前 Subject
换取 aud=audit-service、scope=audit.write 的 Token？
```

### 6.5 取舍

它提供最严格的 audience 和最小权限边界，即使 Audit Token 泄露，也不能拿去调用其他服务。但它增加了：

- Token Service 同步调用；
- 委托链和交换策略；
- Token Cache；
- 调试和审计复杂度。

它适合支付、密钥管理等高敏感服务。当前系统先使用统一 `aud=internal-api`，以后可以只对高敏感服务迁移为 Token Exchange。

## 7. 四种方案如何选择

| 维度 | Session 透传 | 可信 Header | Internal JWT | Token Exchange |
| --- | --- | --- | --- | --- |
| 内部服务是否访问认证服务 | 是，访问 Kratos | 否 | 否 | 换票时访问 Token Service |
| 是否有密码学保护 | Session 本身不透明 | Header 没有签名 | 有 | 有 |
| Session 撤销速度 | 快 | 取决于 Gateway | 最迟到 JWT 过期 | 最迟到 JWT 过期 |
| 服务隔离 | 低 | 依赖网络 | 中，按 `aud` 控制 | 高，每个服务独立 `aud` |
| 实现复杂度 | 低 | 低 | 中 | 高 |
| 适用场景 | 少量服务 | 严格单入口内网 | 一般微服务系统 | 高敏感、强隔离系统 |

本文选择：

> 短期 Internal JWT + 每个服务独立的 mTLS 身份。

它比可信 Header 的边界清晰，又比逐跳 Token Exchange 更容易落地。

## 8. 所有方案都必须处理的问题

### 8.1 认证信息不足怎么办

Token 只携带稳定、小体积、跨服务通用的信息。其他事实按数据所有权查询：

| 需要的信息 | 可信来源 |
| --- | --- |
| 姓名、邮箱等 Profile | Kratos / Profile Service |
| 用户与文档的关系 | OpenFGA |
| 文档所属租户、锁定状态 | Document DB |
| 当前风险等级 | Risk Service |
| 动态授权结果 | OPA |

不要把完整 Profile、权限列表和动态风险全部塞入 Token，否则 Token 会快速过期并形成多个事实来源。

### 8.2 失败语义

| 情况 | 结果 |
| --- | --- |
| 没有凭证或凭证无效 | `401 Unauthorized` |
| 身份有效但没有权限 | `403 Forbidden` |
| Kratos、OpenFGA、OPA 等关键依赖不可用 | 失败关闭，通常返回 `503 Service Unavailable` |
| mTLS 客户端证书无效 | 在连接层拒绝 |

### 8.3 定时任务

系统定时任务没有用户，不应伪造 `sub=user:admin`：

```text
actor   = scheduler
subject = service:cleanup-worker
```

它使用自己的 Workload Identity 和 Service Token，由 OPA 判断该服务是否允许执行目标动作。

用户触发但稍后执行的任务，不应长期保存用户 JWT：

```jsonc
{
  "job_id": "job-001", // 任务 ID
  "requested_by": "9f425a8d-7efc-4768-8f23-7647a74fdf13", // 发起用户稳定 ID
  "tenant_id": "tenant-a", // 租户
  "action": "document.export", // 请求动作
  "resource": "document:doc-001", // 目标资源
  "requested_at": "2026-08-28T10:00:00Z" // 请求时间
}
```

Worker 执行时使用自己的服务身份，并重新调用 OpenFGA 和 OPA。这样用户权限被撤销后，旧任务不会依靠过期快照继续执行。

### 8.4 MQ

消息分为两类身份：

```text
Producer / Consumer 身份：由 MQ 的 mTLS、SASL 或 Workload Identity 验证
业务 Subject：消息体只保存稳定主体 ID 和必要审计上下文
```

不要把短期 Bearer JWT 当作长时间消息凭证。Consumer 执行敏感动作时必须重新授权。

## 9. 推荐总架构

最终采用以下架构：

```text
                         ┌──────────────────────┐
Browser ── Session ─────>│                      │
                         │ API Gateway          │
CLI ── Access Token ────>│ 路由、限流、TLS      │
                         └──────────┬───────────┘
                                    │ auth_request / decision
                                    ▼
                         ┌──────────────────────┐
                         │ Oathkeeper           │
                         │                      │
                         │ Session → Kratos     │
                         │ OAuth Token → Hydra  │
                         │ JWT → JWKS           │
                         └──────────┬───────────┘
                                    │
                          5 分钟 Internal JWT
                          + Gateway mTLS 身份
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Business Service     │
                         │                      │
                         │ JWT → Subject        │
                         │ mTLS → Actor          │
                         └───────┬────────┬─────┘
                                 │        │
                                 ▼        ▼
                             OpenFGA     OPA
                             资源关系    动态策略
```

组件选择为：

```text
核心组件：Kratos + Oathkeeper + OpenFGA + OPA
按需组件：Hydra
  ├── 自动化 CLI / CI 的 Service Token
  ├── 第三方 OAuth2 Client
  └── 用户型 CLI 的 OAuth2 Token

不使用 Keto：已经选择 OpenFGA
不默认使用 Talos：只有开放客户 API Key、Agent Key 时再引入
```

Oathkeeper 是身份代理，不替代完整 API Gateway。Gateway 继续负责路由、限流和 TLS；Oathkeeper负责验证凭证并生成统一身份上下文。

## 10. 完整执行同步、定时任务与 MQ 流程

### 10.1 同步执行一次文档编辑

```text
1. Browser → Gateway
   Cookie: ory_kratos_session=...

2. Gateway / Oathkeeper → Kratos
   GET /sessions/whoami
   得到 identity.id、session.id、aal

3. Oathkeeper
   签发 aud=internal-api、exp=5 分钟的 Internal JWT

4. Gateway → Document Service
   mTLS actor=gateway
   JWT subject=user:9f425a8d...

5. Document Service 验证
   mTLS：当前调用方是否为 gateway
   JWT：签名、iss、aud、exp、sub、tenant_id

6. Document Service → OpenFGA
   user:9f425a8d... 是否是 document:doc-001 的 editor

7. Document Service → OPA
   actor=gateway
   relation_allowed=true
   document.locked=false
   risk_level=low

8. 执行结果
   allow=true：更新文档
   allow=false：返回 403

9. Document Service → Audit Service
   使用 document-service 的 mTLS 身份
   继续传递同一个 Internal JWT

10. Audit Service
    mTLS 得到 actor=document-service
    JWT 得到 subject=user:9f425a8d...
    OPA 检查 document-service 是否允许 audit.write
```

同步请求可以继续传递原来的 Internal JWT，因为整个调用链会在 5 分钟有效期内完成。Document Service 调用 Audit Service 时，JWT 中的 Subject 仍是 Alice，但 mTLS Actor 已经从 Gateway 变成 Document Service。

### 10.2 执行用户触发的异步任务

假设 Alice 请求导出 `doc-001`，任务可能排队一小时后才执行。此时不能把 5 分钟 Internal JWT 保存到任务表中，因为执行时它已经过期；也不能签发一个有效期一小时的 JWT，否则权限撤销要等待一小时才生效。

任务创建过程：

```text
1. Browser → Gateway
   携带 Kratos Session Cookie

2. Gateway / Oathkeeper → Kratos
   验证 Session，得到 subject=Alice

3. Gateway → Document Service
   mTLS actor=gateway
   Internal JWT subject=Alice

4. Document Service → OpenFGA + OPA
   检查 Alice 当前是否允许 document.export

5. Document Service
   在同一个数据库事务中写入 Job 和 Outbox
   只保存稳定身份和业务上下文，不保存 JWT
```

任务记录如下：

```jsonc
{
  "job_id": "export-job-001", // 任务 ID
  "requested_by": "9f425a8d-7efc-4768-8f23-7647a74fdf13", // 发起用户的稳定 ID
  "tenant_id": "tenant-a", // 任务所属租户
  "action": "document.export", // 延迟执行的动作
  "resource": "document:doc-001", // 目标资源
  "requested_at": "2026-08-28T10:00:00Z" // 用户发起任务的时间
}
```

Worker 执行过程：

```text
1. Export Worker 使用自己的 Workload Identity 领取任务
   actor=export-worker

2. Worker 从任务记录恢复业务 Subject
   subject=user:9f425a8d...

3. Worker → OpenFGA
   重新检查 Alice 当前是否仍能读取 doc-001

4. Worker → OPA
   输入 actor=export-worker、tenant、文档状态和风险上下文
   检查该 Worker 是否允许代表用户执行 document.export

5. allow=true
   读取文档并生成导出文件

6. allow=false
   将任务标记为 permission_revoked，不继续执行

7. 写入审计日志
   actor=export-worker
   subject=Alice
   requested_at=原始请求时间
   executed_at=实际执行时间
```

这里的 `requested_by` 只是重新授权和审计需要的事实，不是认证凭证。Worker 的真实身份由 Workload Identity 证明，Alice 的当前权限由 OpenFGA 和 OPA 重新计算。

### 10.3 执行无用户参与的系统定时任务

假设 Scheduler 每天清理已经过期的临时文档。这项操作不是代表某个用户，因此不应伪造用户 `sub`，也不需要保存用户 JWT。

内部 Scheduler 直接调用服务时：

```text
1. Scheduler 从 SPIRE Workload API 取得短期 X.509-SVID
   spiffe://example.com/ns/prod/sa/scheduler

2. Scheduler → Document Service
   使用 mTLS 建立连接
   action=temporary-document.cleanup
   不携带用户 Internal JWT

3. Document Service 验证客户端证书
   actor=subject=service:scheduler

4. Document Service → OPA
   检查 scheduler 是否允许执行 cleanup
   检查目标租户、保留期限和删除范围

5. OPA allow=true
   Document Service 只删除满足过期条件的临时文档

6. 写入审计日志
   actor=service:scheduler
   subject=service:scheduler
   action=temporary-document.cleanup
   affected_resources=[...]
```

这种系统操作通常没有“用户与文档的关系”，因此不需要用 OpenFGA 伪造一个管理员用户。OPA 判断 Scheduler 是否具有系统级动作权限，Document Service 用自己的数据判断哪些文档符合清理条件。

如果 Scheduler 必须通过外部 Gateway 调用，则流程变为：

```text
Scheduler → Hydra client_credentials → Service Token
Scheduler → Gateway → Oathkeeper 验证 Service Token
Oathkeeper → principal_type=service 的 Internal JWT
Gateway → Document Service：Internal JWT + mTLS
```

### 10.4 发布和消费 MQ 消息

文档编辑成功后，需要发布 `document.updated`。不能采用“数据库更新完成后直接发送消息”的方式，否则进程可能在两步之间崩溃。Document Service 使用 Transactional Outbox：

```text
1. Document Service 开启数据库事务

2. 更新 document:doc-001

3. 在 Outbox 表写入 document.updated 事件

4. 提交数据库事务
   文档更新和事件记录同时成功或同时失败

5. Outbox Publisher 使用自己的 MQ 凭证连接 Broker
   actor=document-service

6. Broker 验证 Producer 身份和 Topic ACL
   只允许 document-service 写入 document.events

7. Publisher 发布事件并把 Outbox 标记为已发送
```

消息保存业务事实和审计上下文，不保存 Session Cookie、Session Token 或 Internal JWT：

```jsonc
{
  "event_id": "event-01J67Y8E", // 全局唯一事件 ID，用于消费幂等
  "event_type": "document.updated", // 事件类型
  "occurred_at": "2026-08-28T10:00:03Z", // 业务变更发生时间
  "producer": "document-service", // 产生事件的服务
  "tenant_id": "tenant-a", // 资源所属租户
  "subject": {
    "type": "user", // 原操作代表用户
    "id": "9f425a8d-7efc-4768-8f23-7647a74fdf13" // 用户稳定 ID
  },
  "resource": {
    "type": "document", // 资源类型
    "id": "doc-001", // 资源 ID
    "revision": 18 // 更新后的版本，用于乱序判断
  },
  "traceparent": "00-..." // 链路追踪上下文，不是身份凭证
}
```

Audit Consumer 的执行过程：

```text
1. Audit Consumer 使用自己的 MQ Workload Identity 连接 Broker
   actor=audit-consumer

2. Broker 验证 Consumer 身份和 Topic ACL
   只允许授权 Consumer 读取 document.events

3. Consumer 校验消息 Schema、event_id 和 revision
   已处理的 event_id 直接确认，保证幂等

4. Consumer 信任“消息来自 document.events 的授权 Producer”
   但不把消息中的 subject 当作新的登录凭证

5. 如果只是记录审计日志
   记录 actor=audit-consumer、producer=document-service、subject=Alice

6. 如果消费会触发新的敏感副作用
   使用稳定 subject、action、resource 重新调用 OpenFGA 和 OPA
   不能依据原请求中已经过期的权限结果直接执行

7. 处理成功后 ACK
   失败进入重试，超过次数后进入 Dead Letter Queue
```

因此，MQ 中的身份字段用于描述“谁触发了原业务事件”，MQ 的 mTLS/SASL 身份用于证明“现在是谁在生产或消费消息”。前者是业务事实，后者才是当前连接的认证凭证。

这些链路中各组件只回答一个问题：

```text
Kratos     → 用户是否完成认证，Session 是否有效
Hydra      → OAuth2 Client 能否取得 Access Token
Oathkeeper → 外部凭证是否有效，以及如何转换为内部身份
mTLS       → 当前这一跳由哪个服务发起
OpenFGA    → Subject 与目标资源是什么关系
OPA        → 当前上下文是否满足动态策略
Service    → 汇总事实并执行最终授权结果
```

## 11. 总结

最终结论如下：

| 问题 | 结论 |
| --- | --- |
| 浏览器如何访问 Gateway | Kratos Session Cookie |
| 自动化 CLI 如何访问 Gateway | Hydra Client Credentials 签发的 Service Token |
| Gateway 是否每次查询 Kratos | 浏览器携带 Session 时需要；JWT 不需要 |
| Gateway 向内部传什么 | 5 分钟 Internal JWT |
| 内部服务是否查询 Kratos | 不查询，使用缓存的 JWKS 本地验签 |
| 服务身份如何证明 | 每个服务独立的 mTLS / Workload Identity |
| 同一个 JWT 是否可以复用 | `aud=internal-api` 时，同一同步调用链可以复用 |
| 资源权限在哪里判断 | 业务服务调用 OpenFGA |
| 动态条件在哪里判断 | 业务服务调用 OPA |
| Token 信息不足怎么办 | 按数据所有权查询，不扩张 Token |
| 定时任务和 MQ 怎么做 | 使用服务身份，保存稳定 Subject ID，执行时重新授权 |

最重要的一句话是：

> 外部凭证只负责进入 Gateway；Gateway 将其转换成短期 Internal JWT；内部服务同时验证 JWT 中的 Subject 和 mTLS 中的 Actor，再通过 OpenFGA 与 OPA 完成最终授权。

## 参考资料

- [Ory Kratos Session Management](https://www.ory.com/docs/kratos/session-management/overview)
- [Ory Kratos v1.1.0：Session to JWT](https://changelog.ory.com/announcements/ory-kratos-v1-1-0)
- [Ory Hydra](https://www.ory.com/hydra)
- [Ory Oathkeeper](https://www.ory.com/oathkeeper)
- [OpenFGA Concepts](https://openfga.dev/docs/concepts)
- [OPA Documentation](https://www.openpolicyagent.org/docs)
- [RFC 7517: JSON Web Key](https://www.rfc-editor.org/rfc/rfc7517)
- [RFC 7519: JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519)
- [RFC 8693: OAuth 2.0 Token Exchange](https://www.rfc-editor.org/rfc/rfc8693)
- [SPIFFE Concepts](https://spiffe.io/docs/latest/spiffe-about/spiffe-concepts/)
