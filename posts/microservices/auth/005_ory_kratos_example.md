---
weight: 5
title: "5 Ory Kratos 实战：从 Flow 到用户会话"
date: 2026-08-30T10:00:00+08:00
lastmod: 2026-08-30T10:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "以一个 Web 应用为例，讲清 Kratos Flow、前后端交互、认证方式、数据存储、迁移和生产配置"
featuredImage:

tags: ["auth", "ory", "kratos"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

上一篇介绍了 Kratos 的结构、数据模型和 API。本篇换一个角度：从用户第一次注册开始，完整执行注册、验证、登录、二次认证、修改资料和找回账号，观察浏览器、登录 UI、Kratos 和业务服务分别做了什么。

先给出最重要的结论：**Flow 是 Kratos 创建的一次短期身份操作，前端负责渲染它，Kratos 负责校验并推进状态；登录成功的结果是服务端 Session，而不是 JWT。**

```text
用户要完成的任务                 用户用什么证明身份
Registration 注册 Flow    ×      password / code / OIDC / passkey
Login 登录 Flow           ×      password / code / OIDC / passkey / MFA
Settings 设置 Flow        ×      profile / password / TOTP / passkey ...
Recovery 恢复 Flow        ×      code / link
Verification 验证 Flow    ×      code / link

                    ↓ Kratos 校验并推进状态

Identity + Credential + Session
```

因此，不要把 `code` 统一理解为“验证码登录”。它可能出现在三种不同业务中：登录 code 用于证明身份，verification code 用于确认邮箱或手机号属于该用户，recovery code 用于夺回账号。它们的 Flow、有效期和成功结果都不同。

<!-- more -->

## 1. 示例系统和职责边界

本文使用一个文档 SaaS：

- Alice 使用 `alice@example.com` 注册；
- 她可以使用密码、邮箱验证码、Google 或 Passkey 登录；
- 管理员要求她修改敏感设置前完成 TOTP 二次认证；
- 登录后，文档服务通过 Alice 的 Kratos Identity ID 识别用户。

生产域名和组件如下：

```text
Browser
  │
  │ https://app.example.com/login
  ▼
Gateway / Ingress
  ├── /login、/register、/settings ──> Login UI
  ├── /self-service/*、/sessions/* ──> Kratos Public :4433
  └── /api/documents/* ──────────────> Gateway AuthN ──> document-api
                                               │
                                               └── GET /sessions/whoami

Private network
  ├── Kratos Admin :4434       只允许管理后台和受信服务访问
  ├── PostgreSQL               Identity、Credential、Flow、Session
  └── Courier Worker ─────────> SMTP / SMS Provider
```

这里有三个边界：

1. Login UI 是普通前端，只展示页面，不自己判断密码是否正确；
2. Kratos Public API 接收用户凭据、管理 Flow 和 Session；
3. 文档权限不存进 Kratos，由 Keto、OPA 或业务数据库处理。

### 1.1 Courier 是服务还是 Kratos 的一部分

Courier 是 **Kratos 源码和二进制内置的异步消息投递模块**，不是另一个需要下载的 Ory 服务。是否把它称为“服务”，取决于讨论的层次：

| 层次 | 结论 |
| --- | --- |
| 代码 | Courier 是 Kratos 内部模块 |
| 可执行文件/镜像 | 使用同一个 `kratos` 命令和 `oryd/kratos` 镜像 |
| 运行进程 | 可以随 Kratos Server 运行，也可以启动成独立 Worker 进程 |
| Kubernetes | 生产环境通常单独建立 `kratos-courier` Deployment |

它解决的是“认证请求不应该同步等待邮件或短信供应商”：

```text
Browser 提交 Verification/Recovery/Code Flow
  -> Kratos Server 生成验证码和待发送消息
  -> 写入 PostgreSQL courier_messages
  -> HTTP Flow 请求结束

Kratos Courier Worker
  -> 从 courier_messages 领取待发送消息
  -> Email: 调用 SMTP
  -> SMS: 调用 courier.channels 中配置的 HTTP 短信接口
  -> 更新发送状态；失败时按照配置重试
```

Kratos Server 和 Courier Worker 通过同一个数据库队列协作，不要求再部署 Kafka 或 RabbitMQ。Courier 也不提供给浏览器调用的业务 API，通常不经过 Gateway；只有显式开启时才额外暴露 Metrics 端口。

本地单实例可以让 Courier 作为 Kratos Server 的后台任务运行：

```bash
kratos serve -c /etc/config/kratos.yml --dev --watch-courier
```

生产环境则使用同一个镜像启动两类容器：

```text
kratos-server
  command: kratos serve -c /etc/config/kratos.yml

kratos-courier
  command: kratos courier watch -c /etc/config/kratos.yml
```

两者必须读取兼容的 Kratos 配置并连接同一个数据库。拆开部署后，认证 API 和消息投递可以独立扩容、重启和监控；SMTP 或短信供应商才是 Courier 最终调用的外部服务。

`kratos-courier` 只是 Deployment 名称，不是镜像名称。两个 Deployment 都使用：

```text
oryd/kratos:<固定版本>
```

仓库中的镜像构建文件位于 `.docker/Dockerfile-alpine` 和 `.docker/Dockerfile-distroless-static`。它们都只复制同一个 `kratos` 二进制，设置 `ENTRYPOINT ["kratos"]`，默认执行 `serve`；Courier Deployment 通过容器 `args` 将默认命令覆盖为 `courier watch`。

源码调用关系如下：

```text
main.go
  -> cmd/root.go                         注册 courier 子命令
  -> cmd/courier/root.go                 注册 watch
  -> cmd/courier/watch.go                启动 Courier Worker
  -> courier/courier.go                  轮询和调度消息
       ├── courier/smtp_channel.go       SMTP 邮件通道
       ├── courier/http_channel.go       HTTP/SMS 通道
       └── courier/message*.go           消息模型与发送逻辑
  -> persistence/sql/persister_courier.go
                                          数据库消息队列持久化
```

### 1.2 添加邮箱验证需要增加什么

自托管 Kratos 添加邮箱验证不需要新的 Ory 产品。生产环境需要补齐三项能力：

```text
Verification UI                 已有前端新增页面，可使用 Elements
Kratos Courier Worker           使用同一个 oryd/kratos 镜像
SMTP Provider                   外部托管服务或自建邮件服务器
```

完整链路为：

```text
Browser -> Verification UI -> Kratos Public
                                 │
                                 └── courier_messages (PostgreSQL)
                                              │
                                      Kratos Courier Worker
                                              │ SMTP
                                              ▼
                                      邮件服务 -> 用户邮箱
```

如果使用 SES、SendGrid、Mailgun 等外部 SMTP 服务，不需要在 Kubernetes 内再部署邮件服务器；只需部署 Courier Worker 并配置 SMTP。只有决定自建 SMTP 时，才需要额外维护 Postfix 等邮件服务。本地开发可以使用 MailSlurper 或 MailHog 接收测试邮件。

功能配置还必须同时包含：Identity Schema 的 `verification.via=email`、启用 Verification Flow、提供 Verification UI，以及可选的注册后 `show_verification_ui` Hook。仅配置 SMTP 不会自动把邮箱字段变成待验证地址。

## 2. 先理解 Flow：它是一张由服务端生成的临时表单

假设启用了密码和 Google 登录。用户打开登录页时，前端并不应该写死“邮箱框、密码框、Google 按钮”。正确过程是：

```text
1. Browser -> Kratos: 创建 Login Flow
2. Kratos  -> Browser: 设置 CSRF Cookie，返回/重定向 flow=<uuid>
3. Login UI -> Kratos: 按 flow ID 读取 Flow
4. Kratos -> Login UI: 返回 ui.action、ui.nodes、错误消息和过期时间
5. Login UI: 根据 ui.nodes 渲染当前可用的认证方式
6. Browser -> ui.action: 提交用户选择的方法和字段
7. Kratos: 校验、更新 Flow；成功时创建 Session，失败时把错误写回 Flow
```

一个精简后的 Login Flow 如下：

```jsonc
{
  "id": "8cf0...",                         // 本次登录操作的 ID
  "type": "browser",                     // Browser Flow，使用 Cookie 和 CSRF 防护
  "expires_at": "2026-08-30T10:10:00Z",  // 过期后必须重新创建 Flow
  "ui": {
    "action": "https://auth.example.com/self-service/login?flow=8cf0...",
    "method": "POST",
    "nodes": [
      {
        "group": "default",
        "attributes": {
          "name": "csrf_token",
          "type": "hidden",
          "value": "..."
        }
      },
      {
        "group": "password",
        "attributes": { "name": "identifier", "type": "text" }
      },
      {
        "group": "password",
        "attributes": { "name": "password", "type": "password" }
      },
      {
        "group": "password",
        "attributes": { "name": "method", "type": "submit", "value": "password" }
      },
      {
        "group": "oidc",
        "attributes": { "name": "provider", "type": "submit", "value": "google" }
      }
    ]
  }
}
```

这里连续出现三个 `"group": "password"`，是因为 `ui.nodes` 是一个扁平数组，没有外层的 `password` 分组对象，所以每个节点都必须声明自己属于哪个组。这并不是说三个节点都是密码字段；`group` 表示节点属于哪一种**认证方式**，类似一个表单分区：

```text
password 认证方式
  ├── identifier：账号输入框
  ├── password：密码输入框
  └── method=password：提交按钮，告诉 Kratos 本次选择密码登录

oidc 认证方式
  └── provider=google：Google 登录按钮

default 公共分区
  └── csrf_token：所有认证方式都必须携带的 CSRF 字段
```

因此，前端判断一个节点“是什么”时要同时看两层信息：

- `group`：它属于密码、OIDC、验证码还是 Passkey 等哪种认证方式；
- `attributes.name` 和 `attributes.type`：它具体是账号框、密码框、隐藏字段还是提交按钮。

用户选择密码登录时，浏览器提交 `csrf_token + identifier + password + method=password`。`group` 主要帮助 Kratos 和 Flow renderer 把同一种认证方式所需的多个节点组织在一起，它本身不是提交给 Kratos的用户数据。

`ui.nodes` 才是前端应该展示的字段。启用 TOTP、增加手机号、Flow 校验失败后，Kratos 都可能返回不同的节点和消息。前端是 **Flow renderer**，而不是身份流程的第二份实现。

SPA 中最关键的代码并不多。所有 Browser Flow 请求都必须携带 Cookie，并始终使用服务端返回的 action：

```typescript
const flow = await fetch(
  `https://auth.example.com/self-service/login/flows?id=${flowId}`,
  { credentials: "include" },
).then(r => r.json())

// 页面组件遍历 flow.ui.nodes，保留 hidden csrf_token，展示 input/button/messages。
// 提交失败时 Kratos 会返回更新后的 Flow，继续渲染其中的字段错误。
await fetch(flow.ui.action, {
  method: flow.ui.method,
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    csrf_token: form.csrf_token,
    method: "password",
    identifier: form.identifier,
    password: form.password,
  }),
})
```

若前端通过 Gateway 访问 Kratos，Gateway 必须透传 `Set-Cookie`、`Cookie`、`Location` 和正确的 Origin/CORS 信息，不能缓存 Flow 响应，也不能改写 `ui.action` 到浏览器不可访问的容器内地址。

## 3. 完整执行一次邮箱密码注册

### 3.1 Identity Schema 先定义“邮箱能做什么”

下面的 Schema 同时声明：`email` 是密码和 code 的登录标识，也是验证地址和恢复地址；`name` 只是普通资料。

```json
{
  "$id": "https://example.com/schemas/customer.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "traits": {
      "type": "object",
      "properties": {
        "email": {
          "type": "string",
          "format": "email",
          "ory.sh/kratos": {
            "credentials": {
              "password": { "identifier": true },
              "code": { "identifier": true, "via": "email" },
              "totp": { "account_name": true },
              "passkey": { "display_name": true }
            },
            "verification": { "via": "email" },
            "recovery": { "via": "email" }
          }
        },
        "name": { "type": "string", "minLength": 1 }
      },
      "required": ["email", "name"],
      "additionalProperties": false
    }
  }
}
```

同一个邮箱会在多个内部模型中出现，不是无意义的重复：

- Trait 表示 Alice 的资料是 `alice@example.com`；
- Credential Identifier 表示可以用它定位 Alice 的密码或 code 凭据；
- Verifiable Address 记录该邮箱是否已验证；
- Recovery Address 表示允许用该邮箱恢复账号。

### 3.2 浏览器创建 Registration Flow

浏览器访问：

```http
GET https://auth.example.com/self-service/registration/browser
Accept: text/html
```

Kratos 创建 Flow、设置 CSRF Cookie，然后返回 `303`：

```http
Location: https://app.example.com/register?flow=4f95...
Set-Cookie: ..._csrf_token=...; HttpOnly; Secure; SameSite=Lax
```

注册页读取 Flow：

```http
GET https://auth.example.com/self-service/registration/flows?id=4f95...
Cookie: ..._csrf_token=...
```

前端根据 `ui.nodes` 渲染邮箱、姓名、密码和提交按钮。提交地址必须使用 Kratos 返回的 `ui.action`：

```http
POST https://auth.example.com/self-service/registration?flow=4f95...
Content-Type: application/x-www-form-urlencoded
Cookie: ..._csrf_token=...

csrf_token=...&method=password&traits.email=alice%40example.com&traits.name=Alice&password=Correct-Horse-...
```

Kratos 随后执行四件事：

1. 用 Identity Schema 校验 traits；
2. 检查邮箱标识是否已占用，并使用配置的哈希算法处理密码；
3. 创建 Identity、Password Credential、Verifiable Address 和 Recovery Address；
4. 执行 registration after hooks，例如创建 Session、跳转到 Verification Flow。

前端永远不应该把密码发给自己的文档 API，也不需要知道密码哈希格式。

### 3.3 注册成功后的数据库结果

以下是逻辑示意，不是完整 SQL 列表：

```text
identities
  id         = 7b4c...                 <- 稳定主体 ID
  schema_id  = customer
  traits     = {"email":"alice@example.com","name":"Alice"}

identity_credentials
  identity_id = 7b4c...
  type        = password
  config      = {"hashed_password":"$2a$..."}

identity_credential_identifiers
  identity_credential_id = <password credential id>
  identifier             = alice@example.com

identity_verifiable_addresses
  identity_id = 7b4c...
  value       = alice@example.com
  verified    = false

identity_recovery_addresses
  identity_id = 7b4c...
  value       = alice@example.com
```

如果配置了 verification code，Kratos 还会创建 Verification Flow，把待发送邮件写入 Courier 消息表。Courier Worker 再异步调用 SMTP；HTTP 请求本身不需要等待邮件服务器完成投递。

### 3.4 邮箱验证不是再次登录

Alice 在验证页提交邮件中的 code 后，Kratos 将 Verifiable Address 标记为已验证。它证明的是“Alice 能控制这个邮箱”，不等价于重新验证密码，也不会把邮箱验证码当成永久凭据保存。

## 4. 完整执行一次密码登录与 Session 校验

登录的前三步与注册相同，只是换成 Login Flow。用户提交：

```http
POST /self-service/login?flow=8cf0...
Content-Type: application/x-www-form-urlencoded

csrf_token=...&method=password&identifier=alice%40example.com&password=Correct-Horse-...
```

Kratos 用 identifier 找到 Password Credential，校验哈希。成功后创建服务端 Session，并通过响应设置 Cookie：

```http
Set-Cookie: ory_kratos_session=opaque-value; Path=/; HttpOnly; Secure; SameSite=Lax
Location: https://app.example.com/
```

这里的 Cookie 值是不可自行解析的会话凭据。下一次访问文档 API 时：

```text
Browser
  │ Cookie: ory_kratos_session=...
  ▼
Gateway / Oathkeeper
  │ GET http://kratos:4433/sessions/whoami
  │ Cookie: ory_kratos_session=...
  ▼
Kratos
  │ 200 Session { active, aal, identity.id, identity.traits, ... }
  ▼
Gateway
  │ 移除客户端伪造的身份头，再注入可信身份上下文
  ▼
document-api
```

`GET /sessions/whoami` 的精简响应为：

```jsonc
{
  "id": "session-2a61...",             // Session ID，不是用户 ID
  "active": true,                       // 是否仍然有效
  "expires_at": "2026-09-01T10:00:00Z",
  "authenticated_at": "2026-08-30T10:00:00Z",
  "authenticator_assurance_level": "aal1", // 当前认证强度
  "authentication_methods": [
    { "method": "password", "aal": "aal1" }
  ],
  "identity": {
    "id": "7b4c...",                  // 业务系统应使用的稳定 subject
    "schema_id": "customer",
    "traits": {
      "email": "alice@example.com",
      "name": "Alice"
    }
  }
}
```

业务服务使用 `identity.id` 关联本地数据，不要使用可修改的邮箱作为主键。若使用 Oathkeeper，应由它调用 `whoami` 并注入内部 JWT 或受保护的请求头；不要让每个业务服务重复解析 Cookie，也不要把 Kratos Admin API 暴露给 Gateway 外部。

## 5. Kratos 支持的认证方式及其流程

从使用角度，应把认证方式分为首要认证、二次认证和账号恢复，而不是放在一张没有语义的清单中。

### 5.1 首要认证：登录成功后可以获得 AAL1 Session

| 方法 | 用户操作 | Kratos 校验什么 | 额外依赖 |
| --- | --- | --- | --- |
| Password | 输入标识和密码 | 服务端保存的密码哈希 | 无外部服务；生产建议 Argon2id |
| Code | 输入邮箱/手机号，再输入一次性 code | 短期 code、地址和 Flow | SMTP 或短信服务、Courier |
| OIDC | 点击 Google 等按钮，在上游登录 | 上游回调、ID Token/claims、账号关联 | 外部 OIDC Provider、client secret、Jsonnet mapper |
| Passkey | 使用设备生物识别或 PIN | WebAuthn 挑战和公钥签名 | HTTPS、稳定域名、浏览器 WebAuthn API |

#### Code 登录

Code 登录通常是两次提交：

```text
POST Login Flow: method=code, identifier=alice@example.com
  -> Kratos 生成短期 code
  -> Courier 发送邮件
  -> Flow 返回 code 输入节点

POST 同一个 Login Flow: method=code, code=123456
  -> code 正确且未过期
  -> 创建 AAL1 Session
```

它与 Password 的差别不是“前端多一个输入框”，而是第一步需要可靠的邮件/短信投递，第二步需要在同一个短期 Flow 中验证挑战。

#### OIDC 登录

```text
Browser -> Login Flow: method=oidc, provider=google
Kratos  -> Google: Authorization Request
Google  -> Kratos callback: authorization response
Kratos  -> Google: 用 authorization code 换取 Token，并校验 ID Token
Kratos  -> Jsonnet Mapper: 把已验证的 claims 转成 traits/metadata
Kratos  -> 用 (provider ID, claims.sub) 查找对应的 OIDC Credential
Kratos  -> 首次登录时创建 Identity；再次登录时读取已有 Identity
Kratos  -> Browser: 创建自己的 Kratos Session
```

下面用 Alice 第一次使用 Google 登录说明每一步。

##### 第一步：校验 Google 返回的身份

Google 回调给 Kratos 的主要内容是短期 `authorization code`。Kratos 在服务端使用 `client_id`、`client_secret` 和这个 code 向 Google 换取 Token，然后至少校验 ID Token 的：

- 签名和签名密钥；
- `iss` 是否是预期的 Google issuer；
- `aud` 是否包含当前应用的 client ID；
- `exp` 是否过期；
- `nonce` 是否与本次 Flow 发出的一致。

通过校验后，Kratos 才信任其中的 claims。例如：

```jsonc
{
  "iss": "https://accounts.google.com",
  "aud": "our-google-client-id",
  "sub": "109876543210987654321",  // Google 为该账号提供的稳定主体标识
  "email": "alice@example.com",
  "email_verified": true,
  "name": "Alice",
  "picture": "https://..."
}
```

这里最重要的是 `sub`。邮箱、姓名和头像都可能变化，只适合作为用户资料；Kratos 使用 `sub` 识别这个上游账号。

##### 第二步：Jsonnet Mapper 把 claims 转成 Identity 数据

Google 的字段结构不一定符合本地 Identity Schema。Jsonnet Mapper 是一层数据转换规则，例如：

```jsonnet
local claims = std.extVar('claims');

{
  identity: {
    traits: {
      email: claims.email,
      name: claims.name,
    },
    metadata_public: {
      avatar_url: claims.picture,
    },
    verified_addresses:
      if claims.email_verified then
        [{ via: 'email', value: claims.email }]
      else [],
  },
}
```

输出结果的职责是：

```text
Google claims                         Kratos Identity
email             -----------------> traits.email
name              -----------------> traits.name
picture           -----------------> metadata_public.avatar_url
email_verified    -----------------> verified_addresses
```

Mapper 不创建 Session，也不决定用户主键。更重要的是，**账号关联使用原始、已验证的 `claims.sub`，不依赖 Mapper 映射出来的邮箱。** Mapper 的输出还必须通过本地 Identity Schema 校验。

##### 第三步：首次登录时创建本地 Identity 和 OIDC Credential

Kratos 用下面的组合标识查询数据库：

```text
provider ID = google                 # Kratos 配置中 providers[].id
subject     = 109876543210987654321  # Google ID Token 的 sub
lookup key  = google:109876543210987654321
```

如果不存在该 Credential，并且允许注册，Kratos 会把这次登录转入注册处理，创建本地数据。概念上相当于：

```text
identities
  id        = 7b4c...                # Kratos 生成的本地稳定用户 ID
  traits    = {email, name}
  metadata  = {avatar_url}

identity_credentials
  identity_id = 7b4c...
  type        = oidc
  config      = {provider: google, subject: 109876...}

identity_credential_identifiers
  identifier = google:109876543210987654321

sessions
  identity_id = 7b4c...
  aal         = aal1
  method      = oidc
```

当前 Kratos 源码还会在建立 OIDC Credential 前加密上游返回的初始 Token，再放入 Credential 配置。但真正用于以后定位账号的是 `provider + sub`，不能把 Google Access Token 或 ID Token 当成本地用户 ID。这些 Token 也不能传给普通业务服务；业务应用最终使用的是 Kratos Session。

如果关闭了注册，并且数据库中没有对应 Credential，这次登录应失败，而不是凭空得到一个本地用户。

##### 第四步：需要让用户再设置密码吗

**不需要。** Google OIDC Credential 本身就是一种首要认证凭据。只使用 Google 登录的用户可以只有 `oidc` Credential，没有 `password` Credential：

```text
Identity 7b4c...
  └── OIDC Credential
        └── google:109876...
```

只有产品要求同时支持“邮箱加密码登录”时，才让已经登录的用户通过 Settings Flow 主动添加密码。添加之后是一条 Identity 同时拥有两种凭据，而不是为同一个人再创建一个账号：

```text
Identity 7b4c...
  ├── OIDC Credential: google:109876...
  └── Password Credential: alice@example.com + Argon2id hash
```

不要在 Google 登录后强制用户设置密码，否则既增加操作成本，也扩大密码凭据的攻击面。

##### 第五步：Alice 下次使用 Google 登录时如何验证

下次登录不会复用上一次的 ID Token，过程仍然是：

```text
1. Kratos 创建新的 Login Flow，并生成新的 state/nonce
2. Browser 跳转 Google；Google 验证 Alice，或者利用自己的登录 Session 快速完成
3. Kratos 用新的 authorization code 换取并校验新的 ID Token
4. 从已验证 Token 取得 sub=109876...
5. 查询 OIDC Credential identifier=google:109876...
6. 找到 Identity 7b4c...
7. 创建新的 Kratos Session
```

因此信任链是：Google 每次证明“当前操作者仍控制这个 Google 账号”，Kratos 再用稳定的 `google:sub` 找到自己的用户。Google 页面有时看起来没有再次输入密码，是因为 Google 自己的 Session 仍然有效，不是 Kratos 跳过了 Token 校验。

如果配置允许登录时更新 Identity，Kratos 还会重新执行 Mapper，把 Google 最新的姓名或头像合并进现有 Identity；否则保留首次注册或用户后来修改的资料。

##### “查找”和“关联”不是同一件事

正常再次登录只是按 `google:sub` 查找。关联是把一个新的外部凭据挂到已有 Identity 上，例如已经用密码登录的 Alice，再到 Settings Flow 中绑定 Google：

```text
已有 Identity 7b4c... + Password Credential
  + Alice 在已认证 Session 中完成 Google 回调
  -> 增加 OIDC Credential google:109876...
```

不要仅因为 Google 返回的邮箱与某个账号相同就静默合并。安全做法是要求用户先用已有 Credential 证明自己，或者在已登录的 Settings Flow 中显式绑定；否则攻击者可能利用上游邮箱和本地账号冲突实施账号接管。

这里不需要 Hydra。Hydra 解决的是“让你的系统成为 OAuth2/OIDC Provider”，不是让用户使用 Google 登录。

#### Passkey 登录

```text
1. Login Flow 返回 passkey_login 节点和 WebAuthn challenge
2. 前端调用 navigator.credentials.get(...)
3. 操作系统让 Alice 使用指纹、面容或设备 PIN
4. 前端把签名后的 WebAuthn assertion 提交给同一个 Flow
5. Kratos 用 Identity 中保存的 Passkey 公钥校验，创建 Session
```

Passkey 不会把指纹上传给 Kratos。生物信息留在设备上，Kratos 保存的是公钥凭据、credential ID 和计数等 WebAuthn 数据。

### 5.2 二次认证：把已有 Session 从 AAL1 提升到 AAL2

| 方法 | 用户持有什么 | 常见用途 |
| --- | --- | --- |
| TOTP | Authenticator App 中的共享密钥 | 稳定、通用的第二因素 |
| WebAuthn | 安全密钥或平台认证器 | 抗钓鱼的第二因素 |
| Lookup Secret | 预先生成的一次性恢复码 | 用户丢失第二因素时应急 |

AAL 不是用户角色，而是**当前 Session 已经完成了多强的认证**：

```text
Alice 的 Identity
  ├── Password Credential       第一因素
  └── TOTP Credential           第二因素

Session 只验证了密码
  └── authenticator_assurance_level = aal1

同一个 Session 又验证了 TOTP
  └── authenticator_assurance_level = aal2
```

因此，“Alice 已经绑定 TOTP”和“这次 Session 已经验证 TOTP”是两件事。前者说明她**能够**完成 AAL2，后者才说明当前请求可以访问要求 AAL2 的接口。

#### 5.2.1 前置步骤：先绑定第二因素

Alice 必须先在已登录的 Settings Flow 中绑定 TOTP：

```text
1. Browser -> GET /self-service/settings/browser
2. Kratos -> Settings UI: 返回 TOTP 设置节点和二维码信息
3. Alice 用 Authenticator App 扫描二维码
4. Browser -> POST Settings Flow: 提交 App 生成的 TOTP code
5. Kratos 校验成功，把 TOTP secret 保存为 Alice 的 Credential
6. Kratos 生成 Lookup Secrets，Alice 离线保存
```

TOTP secret 属于 Credential 数据，由 Kratos 保存，不能放在 `traits`。绑定第二因素本身是敏感设置，通常还要求一个足够新鲜的 privileged Session。

#### 5.2.2 业务接口如何触发 AAL2

假设普通页面只要求 AAL1，修改支付方式要求 AAL2。Alice 已经通过密码登录，浏览器携带 Session Cookie 请求：

```http
PUT /api/billing/payment-method
Cookie: ory_kratos_session=...
```

Gateway 认证该 Session 后得到：

```jsonc
{
  "id": "session-123",
  "active": true,
  "authenticator_assurance_level": "aal1",
  "identity": { "id": "alice-id" },
  "authentication_methods": [
    { "method": "password", "aal": "aal1" }
  ]
}
```

支付接口策略要求 `aal2`，因此 Gateway/OPA 拒绝业务请求，并告诉前端需要 Step-up Authentication：

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "code": "aal2_required",
  "step_up_url": "/self-service/login/browser?aal=aal2&return_to=https%3A%2F%2Fapp.example.com%2Fbilling"
}
```

这里返回 `403` 是因为用户身份已经确认，但当前认证强度不足。前端不能自行把 `aal1` 改成 `aal2`，只能引导用户完成 Kratos 的二次认证。`return_to` 必须位于 Kratos 的允许列表中，不能直接信任任意客户端参数。

#### 5.2.3 Browser、前端与 Kratos 的完整升级流程

前端收到 `aal2_required` 后，让浏览器进入 AAL2 Login Flow：

```http
GET /self-service/login/browser?aal=aal2&return_to=https://app.example.com/billing
Cookie: ory_kratos_session=...
```

这个请求必须携带现有 Session Cookie。Kratos 先确认 Session 至少是 AAL1、属于 Alice，并读取 Alice 已登记的第二因素。未登录用户不能直接请求 AAL2，因为 Kratos 还不知道要验证哪个 Identity 的第二因素。

Kratos 创建 `requested_aal=aal2` 的 Login Flow，并重定向到登录 UI：

```http
HTTP/1.1 303 See Other
Location: https://accounts.example.com/auth/login?flow=flow-aal2-456
```

登录 UI 携带 Cookie 查询 Flow：

```http
GET /self-service/login/flows?id=flow-aal2-456
Cookie: ory_kratos_session=...
```

精简后的响应为：

```jsonc
{
  "id": "flow-aal2-456",
  "requested_aal": "aal2",
  "ui": {
    "action": "https://accounts.example.com/self-service/login?flow=flow-aal2-456",
    "method": "POST",
    "nodes": [
      { "group": "default", "attributes": { "name": "csrf_token", "type": "hidden" } },
      { "group": "totp", "attributes": { "name": "totp_code", "type": "text" } },
      { "group": "totp", "attributes": { "name": "method", "type": "submit", "value": "totp" } },
      { "group": "lookup_secret", "attributes": { "name": "lookup_secret", "type": "text" } }
    ]
  }
}
```

Kratos 只返回 Alice 已经登记的第二因素。使用 Elements 时把这个 Flow 交给 `<Login>` 渲染；自定义前端则根据 `ui.nodes` 展示 TOTP、WebAuthn 或 Lookup Secret。

Alice 输入 Authenticator App 当前显示的动态码，前端提交服务端给出的 `ui.action`：

```http
POST /self-service/login?flow=<id>
Cookie: ory_kratos_session=...
Content-Type: application/json

{
  "method": "totp",
  "totp_code": "492031",
  "csrf_token": "..."
}
```

Kratos 会同时校验：

```text
Flow 未过期且 requested_aal=aal2
  + CSRF Cookie 与 csrf_token 匹配
  + 当前 Cookie 对应 Flow 创建时的 AAL1 Session
  + Alice 存在 TOTP Credential
  + totp_code 与共享密钥在允许的时间窗口内计算结果一致
```

成功后，Kratos 在原 Session 中加入一次 AAL2 Authentication Method，更新认证时间和 Session AAL：

```jsonc
{
  "id": "session-123",
  "active": true,
  "authenticator_assurance_level": "aal2",
  "authenticated_at": "2026-08-30T12:00:00Z",
  "authentication_methods": [
    { "method": "password", "aal": "aal1" },
    { "method": "totp", "aal": "aal2" }
  ]
}
```

随后 Kratos 重定向到经过校验的 `return_to`。前端回到支付页面，重新发送原来的业务请求：

```text
Browser                 Gateway/OPA              Kratos
   │ PUT payment             │                      │
   │────────────────────────>│                      │
   │                         │ 校验 Session ───────>│
   │                         │<──── aal1 ───────────│
   │<── 403 aal2_required ───│                      │
   │                                                │
   │ GET login/browser?aal=aal2 + Cookie ──────────>│
   │<────────────── 303 Login UI?flow=... ──────────│
   │ POST TOTP + CSRF + Cookie ────────────────────>│
   │<────────────── Session 升级 + redirect ────────│
   │                                                │
   │ PUT payment             │                      │
   │────────────────────────>│                      │
   │                         │ 校验 Session ───────>│
   │                         │<──── aal2 ───────────│
   │                         │ OPA 允许              │
   │<──────────── 200 ───────│                      │
```

#### 5.2.4 `aal2` 到底由谁校验

这里有三层责任：

| 责任 | 负责组件 | 具体工作 |
| --- | --- | --- |
| 验证第二因素 | Kratos | 校验 TOTP、WebAuthn 签名或 Lookup Secret，成功后把 Session 标记为 AAL2 |
| 证明 Session 的 AAL | Kratos `/sessions/whoami` | 根据可信的 Session Cookie/Token 返回 `authenticator_assurance_level` 和 `authentication_methods` |
| 决定业务操作是否必须 AAL2 | Gateway + OPA，或业务服务 | 将“修改支付方式要求 AAL2”作为访问策略，不满足时拒绝请求 |

所以，Kratos 回答“这次 Session 是否真的完成了第二因素”，OPA 回答“这个操作是否要求第二因素”。前端只负责交互，不能成为 AAL 的可信来源；Keto 负责用户和资源之间的关系，也不负责验证 TOTP 或 Session AAL。

在本文架构下，推荐把 Kratos Session 转成短期内部 JWT：

```text
Kratos whoami Session
  └── Gateway 生成短期 Internal JWT
        ├── sub       = alice-id
        ├── sid       = session-123
        ├── aal       = aal2
        ├── amr       = [password, totp]
        ├── auth_time = 最近认证时间
        ├── aud       = 目标内部服务
        └── exp       = 很短的过期时间
              │
              ▼
        OPA/业务服务验证签名、aud、exp，并检查 aal
```

`aal` Claim 只能由直接信任 Kratos 的 Gateway 写入，不能接受客户端自报值。内部 JWT 应短期有效，否则 Kratos Session 被撤销后，旧 JWT 仍可能继续访问敏感接口。

OPA 的策略可以概括为：

```text
启动普通任务：关系权限满足 + aal >= aal1
修改支付方式：关系权限满足 + aal >= aal2
```

如果不使用内部 JWT，业务服务也可以直接调用 Kratos `whoami`，读取可信响应中的 AAL；代价是每个服务都要处理 Cookie、Kratos 故障和缓存一致性，因此更适合在 Gateway 统一完成。

Kratos 还支持全局配置：

```yaml
session:
  whoami:
    required_aal: highest_available
```

拥有第二因素的用户在 AAL1 状态调用 `whoami` 时，会得到 `403 session_aal2_required`。它适合“整个系统始终要求最高 AAL”。如果只有支付、密钥管理等少数接口要求 AAL2，应让 `whoami` 返回 Session 的实际 AAL，再由 Gateway/OPA 按路由执行 Step-up 策略。

#### 5.2.5 AAL2 还可能要求新鲜度

达到 AAL2 不代表它永远足够新。转账、删除账号等操作还可能要求“最近 5 分钟完成过二次认证”。此时除了检查 `aal == aal2`，还要检查可信 Session 中的 `authenticated_at` 或内部 JWT 的 `auth_time`。过旧时重新发起：

```http
GET /self-service/login/browser?aal=aal2&refresh=true&return_to=...
```

因此完整策略是“身份有效 + 业务权限满足 + AAL 足够 + 认证时间足够新”，不能把永久的 `mfa_enabled=true` 用户属性当作 AAL2。

### 5.3 辅助流程：它们不会自动等同于登录

| Flow | 方法 | 成功结果 |
| --- | --- | --- |
| Verification | `code` 或 `link` | 地址变为已验证 |
| Recovery | `code` 或 `link` | 获得修改凭据的恢复能力，随后重设密码等 |
| Settings | `profile/password/totp/passkey/...` | 修改资料或增删凭据，敏感修改要求 privileged session |
| Logout | 安全生成的 logout URL 或 Native logout | 撤销当前 Session |

Lookup Secret 名称中虽然有“恢复”含义，但在 Kratos 中它属于 AAL2 登录方法；Recovery Flow 则是账号无法正常登录时的独立业务流程，两者不要混用。

### 5.4 源码中还能看到哪些策略

本地版本源码还包含 `identifier_first`、`deviceauthn` 和 `saml` 等策略。`identifier_first` 用于先收集账号标识，再决定下一步方法；设备认证属于更专门的设备场景。SAML 凭据在开源代码的数据类型中有占位，但注释明确指向企业版本，不应仅凭 OpenAPI 中出现模型就认定当前 OSS 部署可直接使用；企业 SSO 应结合 Ory Polis 和实际许可证确认。

## 6. 几组“专项接口”到底解决什么问题

接口应按调用者和业务目的理解。

### 6.1 Self-service Flow API：给用户本人操作

每类 Flow 都有三种基本接口：

```text
GET  /self-service/<flow>/browser   创建 Browser Flow
GET  /self-service/<flow>/flows     按 id 读取并渲染 Flow
POST /self-service/<flow>           提交表单、推进 Flow
```

`<flow>` 可以是 `login`、`registration`、`settings`、`recovery` 或 `verification`。

`GET /self-service/<flow>/api` 是 Native/API Flow 初始化接口，适合原生 App、CLI 等非浏览器客户端。**浏览器和 SPA 必须使用 `/browser`，不能为了省 Cookie/CSRF 处理而改用 `/api`。**

Native Login Flow 成功时，JSON 响应会包含 `session` 和不透明的 `session_token`。App 安全保存 token，之后以 `Authorization: Bearer <session_token>` 调用 `/sessions/whoami` 或自己的 Gateway。它和 Browser Cookie 指向同一种服务端 Session，只是客户端携带方式不同；两者都不是可离线验证的 JWT。

### 6.2 Session API：回答“当前凭据对应谁”

| 接口 | 作用 |
| --- | --- |
| `GET /sessions/whoami` | 用 Cookie 或 Session Token 解析当前 Session |
| `GET /sessions` | 用户查看自己的所有 Session |
| `DELETE /sessions/{id}` | 用户撤销自己的指定 Session |
| `DELETE /sessions` | 用户撤销其他 Session |
| `GET /self-service/logout/browser` | 生成与当前 Session 绑定的安全退出 URL |
| `DELETE /self-service/logout/api` | Native 客户端使用 Session Token 退出 |
| `GET /sessions/token-exchange` | 按配置模板把 Session 换成 JWT；这是互操作能力，不是默认登录结果 |

### 6.3 Admin API：给可信后台管理身份

`/admin/identities` 用于创建、读取、修补和删除 Identity；`/admin/identities/{id}/sessions` 与 `/admin/sessions` 用于审计、延期或撤销 Session；`/admin/recovery/code|link` 用于客服或后台为指定 Identity 发起恢复。

Admin API 能越过用户自助流程，因此必须只在私网开放，并在前面增加管理员认证、授权和审计。前端绝不能直接调用它。

### 6.4 Courier API：排查通知投递

`GET /admin/courier/messages` 和 `GET /admin/courier/messages/{id}` 用于后台查看验证、恢复等消息的状态和内容。生产中仍应限制敏感信息可见范围，不能把它当成普通用户的“收件箱接口”。

### 6.5 浏览器和协议辅助接口

| 接口 | 为什么存在 |
| --- | --- |
| `GET /.well-known/ory/webauthn.js` | 提供 Kratos 配套的 WebAuthn 浏览器辅助代码 |
| `GET /.well-known/change-password` | 向密码管理器声明修改密码入口 |
| `/self-service/fed-cm/*` | 浏览器 FedCM 集成，不是普通登录页的必调接口 |
| `GET /schemas`、`GET /schemas/{id}` | 获取 Identity Schema，供 UI 或工具理解 traits |
| `GET /self-service/errors?id=...` | 展示不能附着在普通 Flow 上的用户可见错误 |
| `/health/alive`、`/health/ready`、`/version` | 容器探针和版本诊断 |

## 7. 用户信息究竟应该存在哪里

原则是：**Kratos 只保存建立和维护身份所需的数据；业务属性和权限留在业务系统。**

以 Alice 为例：

| 信息 | 保存位置 | 原因 |
| --- | --- | --- |
| `identity.id = 7b4c...` | Kratos `identities` | 稳定主体 ID，由 Kratos 生成 |
| email、姓名、手机号 | `identities.traits` | 登录和身份资料需要，受 Schema 约束 |
| locale、avatar URL | 可选 `metadata_public` | 可以随 Identity/Session 对本人可见，不能敏感 |
| 迁移来源、客服备注 | 可选 `metadata_admin` | 只通过 Admin API 可见；仍不应替代业务库 |
| 密码哈希、TOTP secret、Passkey 公钥、OIDC 凭据 | Credential 相关表 | 只能由 Kratos 管理，不能放 traits |
| 邮箱是否验证、恢复邮箱 | Verifiable/Recovery Address 表 | 各自有状态和生命周期 |
| 登录时间、AAL、设备信息、过期时间 | Session 相关表 | 会话安全和撤销需要 |
| `tenant_id`、套餐、文档所有权、订单 | document/account 业务库 | 这些是业务事实，不是身份凭据 |
| “Alice 是组织管理员” | Keto/授权系统 | 权限会变化，不能塞入用户资料后信任 |
| SMTP 密码、OIDC client secret | Secret Manager / Kubernetes Secret | 它们是部署密钥，不属于用户数据 |

业务库可以建立这样的关联：

```sql
CREATE TABLE app_users (
    identity_id UUID PRIMARY KEY,  -- 对应 Kratos identities.id
    tenant_id   UUID NOT NULL,
    plan        VARCHAR(32) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL
);
```

不要在业务库复制密码哈希、TOTP secret 或 Session Token。邮箱可以作为展示字段做缓存，但业务关系必须指向不可变的 `identity_id`。

## 8. 每种认证方式需要配置什么

认证方式没有各自的启动命令。所有方法由同一个 `kratos serve -c /etc/config/kratos.yml` 进程加载；区别在配置、Identity Schema、UI 能力和外部依赖。

### 8.1 基础配置

```yaml
version: v26.2.0 # 示例与本地 quickstart 镜像一致，实际部署必须与镜像版本一致

dsn: postgres://kratos:${DB_PASSWORD}@postgres:5432/kratos?sslmode=require

serve:
  public:
    base_url: https://auth.example.com/
  admin:
    base_url: http://kratos-admin.identity.svc.cluster.local:4434/

selfservice:
  default_browser_return_url: https://app.example.com/
  allowed_return_urls:
    - https://app.example.com
  flows:
    login:
      ui_url: https://app.example.com/login
      lifespan: 10m
    registration:
      ui_url: https://app.example.com/register
      lifespan: 10m
    settings:
      ui_url: https://app.example.com/settings
      privileged_session_max_age: 15m
    recovery:
      enabled: true
      ui_url: https://app.example.com/recovery
      use: code
    verification:
      enabled: true
      ui_url: https://app.example.com/verification
      use: code

identity:
  default_schema_id: customer
  schemas:
    - id: customer
      url: file:///etc/config/identity.customer.schema.json

secrets:
  cookie:
    - ${KRATOS_COOKIE_SECRET}
  cipher:
    - ${KRATOS_CIPHER_SECRET}
```

版本字段应以部署镜像自带的 Schema 为准，不要从本文复制后长期不升级。Cookie、cipher、数据库和第三方 client secret 应由 Secret Manager 注入。

#### `use: code` 如何确定发送邮件还是短信

`use: code` 只决定 Recovery/Verification 使用“填写验证码”而不是“点击链接”，不负责选择发送渠道：

```text
use: code
  └── 挑战形式：发送并填写 code

Identity Schema 中的 via
  └── 投递渠道：email 或 sms
```

渠道声明在 Identity Schema 的具体 trait 上。例如同时支持邮箱和手机号：

```jsonc
{
  "properties": {
    "traits": {
      "type": "object",
      "properties": {
        "email": {
          "type": "string",
          "format": "email",
          "ory.sh/kratos": {
            "credentials": {
              "code": {
                "identifier": true,
                "via": "email"       // 使用邮箱验证码登录
              }
            },
            "verification": {
              "via": "email"         // 验证邮箱时发送邮件
            },
            "recovery": {
              "via": "email"         // 用邮箱恢复账号时发送邮件
            }
          }
        },
        "phone": {
          "type": "string",
          "format": "tel",
          "ory.sh/kratos": {
            "credentials": {
              "code": {
                "identifier": true,
                "via": "sms"         // 使用短信验证码登录
              }
            },
            "verification": {
              "via": "sms"           // 验证手机号时发送短信
            },
            "recovery": {
              "via": "sms"           // 用手机号恢复账号时发送短信
            }
          }
        }
      }
    }
  }
}
```

这三处 `via` 分别服务于不同 Flow：

| Schema 标记 | 使用场景 |
| --- | --- |
| `credentials.code.via` | Passwordless Code Login 或 Code MFA |
| `verification.via` | Verification Flow 验证邮箱或手机号 |
| `recovery.via` | Recovery Flow 找回账号、重设凭据 |

如果 Schema 只把邮箱标记为 `recovery.via=email`，Recovery Code 就只会发送邮件；只标记手机号为 `sms`，就只发送短信。两者都声明时，Flow 根据用户提交的已登记地址选择对应的 `via`。当前源码中的新版 Recovery Flow 还可以启用：

```yaml
feature_flags:
  choose_recovery_address: true
```

这样存在多个恢复地址时，Flow 会让用户在经过掩码处理的地址中选择，再通过 `recovery_select_address` 推进流程。客户端选择的只是 Kratos 返回的候选项，不能任意指定一个未登记的手机号作为恢复地址。

确定 `via` 后，Courier 才选择具体发送器：

```text
via=email
  -> Courier SMTP
  -> 邮件服务

via=sms
  -> Courier HTTP channel(id=sms)
  -> Twilio、阿里云短信或自建短信适配服务
```

对应部署配置例如：

```yaml
courier:
  smtp:
    connection_uri: ${SMTP_CONNECTION_URI}

  channels:
    - id: sms
      type: http
      request_config:
        url: https://sms-adapter.internal/messages
        method: POST
        # body、headers 和 auth 按短信服务接口配置
```

因此只写 `use: code` 和 `via: sms` 仍然不能发送短信，还必须提供 `courier.channels[id=sms]` 的 HTTP 实现。邮件同理需要配置 SMTP。

### 8.2 Password、Code、TOTP 和恢复码

```yaml
selfservice:
  methods:
    password:
      enabled: true
    code:
      enabled: true
      passwordless_enabled: true
      mfa_enabled: false
    totp:
      enabled: true
      config:
        issuer: Example Docs
    lookup_secret:
      enabled: true

hashers:
  algorithm: argon2

courier:
  smtp:
    connection_uri: ${SMTP_CONNECTION_URI}
```

| 方法 | Schema 必须声明 | UI 额外工作 | 外部服务 |
| --- | --- | --- | --- |
| Password | 某 trait 是 password identifier | 密码输入、修改密码 | 无 |
| Code | email/phone 是 code identifier，并声明 `via` | 发送和填写 code 的两阶段页面 | Email 需要 SMTP；SMS 需要短信渠道 |
| TOTP | 某 trait 是 TOTP account name | Settings 展示 QR/secret，AAL2 输入动态码 | Authenticator App，不需要服务端网络调用 |
| Lookup Secret | 启用方法即可 | Settings 生成并提示用户离线保存；AAL2 输入恢复码 | 无 |

Recovery/Verification 使用 code 或 link 时也需要 Courier。不要因为未启用“code 登录”就误以为找回密码不需要邮件或短信服务。

### 8.3 OIDC

```yaml
selfservice:
  methods:
    oidc:
      enabled: true
      config:
        providers:
          - id: google
            label: Google
            provider: generic
            client_id: ${GOOGLE_CLIENT_ID}
            client_secret: ${GOOGLE_CLIENT_SECRET}
            issuer_url: https://accounts.google.com
            mapper_url: file:///etc/config/oidc.google.jsonnet
            scope:
              - openid
              - email
              - profile
```

还需要在 Google 控制台注册 Kratos 的回调地址，并编写 Jsonnet Mapper，把上游 claims 映射成符合 Identity Schema 的 traits。`client_secret` 放在 Secret 中；Mapper 和 Schema 作为只读 ConfigMap/镜像文件挂载。

### 8.4 Passkey 与 WebAuthn

```yaml
selfservice:
  methods:
    passkey:
      enabled: true
      config:
        rp:
          id: example.com
          display_name: Example Docs
          origins:
            - https://app.example.com
    webauthn:
      enabled: true
      config:
        passwordless: false
        rp:
          id: example.com
          display_name: Example Docs
          origin: https://app.example.com
```

Passkey 适合作为无密码首要认证；WebAuthn 可以作为安全密钥式第二因素。两者都要求：

- 生产使用 HTTPS；
- `rp.id` 与实际域名关系正确；
- `origin(s)` 必须是实际执行 `navigator.credentials` 的前端 Origin；
- 前端能处理 Kratos 返回的 WebAuthn 节点并调用浏览器 API。

它们不依赖 SMTP，但生产系统通常仍应配置可用的验证和恢复渠道，避免用户更换或丢失设备后永久失去账号。

## 9. `kratos migrate sql` 到底做什么

推荐的当前命令形式是：

```bash
kratos -c /etc/config/kratos.yml migrate sql up -e --yes
```

本地源码中旧形式 `kratos migrate sql -e --yes` 仍可执行，但已经标记为 deprecated，建议明确写 `up`。

参数含义：

- `sql up`：按顺序执行镜像内嵌的、尚未应用的 SQL migration；
- `-e`：从环境变量 `DSN` 或配置项 `dsn` 读取数据库连接串；
- `--yes`：非交互确认，适合容器 Job。

它在空的 **已有数据库** 中会创建 Kratos 所需的表、索引、约束和迁移版本记录；升级时则只执行新版本尚未执行的迁移。所以“它会创建表”是对的，但不完整。

它不会：

- 创建 PostgreSQL 实例、数据库或数据库账号；
- 创建 Alice 等用户数据；
- 创建 Identity Schema 文件；
- 创建文档、订单等业务表；
- 代替升级前备份和迁移兼容性检查。

生产中把它当成一次性部署步骤，而不是每个 Kratos Pod 的常驻工作：

```text
1. 备份数据库
2. 运行一个与目标 Kratos 相同镜像版本的 migrate Job
3. Job 成功
4. 再滚动发布 Kratos Server 和 Courier Worker
```

不要让多个 Pod 无控制地并发执行迁移。Kubernetes 使用 Helm hook Job、普通 Job 或发布流水线均可，关键是“每次版本发布只受控执行一次，失败就停止发布”。

## 10. 生产容器应如何组成

最小可用生产部署不是一个 `kratos --dev` 容器，而是以下组合：

```text
kratos-migrate Job
  └── kratos migrate sql up -e --yes

kratos Server Deployment (多副本)
  ├── kratos serve -c /etc/config/kratos.yml
  ├── Public :4433 <- Gateway
  └── Admin  :4434 <- 私网管理服务

kratos-courier Deployment
  └── kratos -c /etc/config/kratos.yml courier watch

Login UI Deployment
PostgreSQL
SMTP / SMS Provider
Gateway / Ingress
Secret Manager + ConfigMap
```

本地 quickstart 使用：

```bash
kratos serve -c /etc/config/kratos.yml --dev --watch-courier
```

`--dev` 会关闭关键安全能力，只能本地开发；`--watch-courier` 把 Courier 作为后台任务塞进同一进程，适合单实例简化环境。生产中拆出 `courier watch`，才能独立扩缩容、重启和观察投递积压。

## 11. 最终心智模型

把整套流程压缩成五句话：

1. Identity Schema 决定有什么资料，以及哪些资料可以作为哪类凭据的标识；
2. Kratos 为注册、登录、设置、验证和恢复创建短期 Flow；
3. 前端按 `ui.nodes` 渲染并把表单提交给 `ui.action`，不复制认证状态机；
4. Kratos 管理凭据并在登录成功后创建可撤销的服务端 Session；
5. 业务系统只信任经 Gateway 校验后的 `identity.id`，再去 Keto/OPA 和业务库判断权限。

当遇到一个新需求时，按这个顺序判断即可：这是哪一种业务 Flow？用户用什么方法证明身份？需要什么 Identity Schema 标注？需要哪种 UI 节点、外部服务和数据存储？这样就不会再把验证码登录、邮箱验证、账号恢复和二次认证混成同一件事。

## 参考资料

- [Ory：Self-service flows](https://www.ory.com/docs/kratos/self-service)
- [Ory：Login Flow](https://www.ory.com/docs/kratos/self-service/flows/user-login)
- [Ory：Passkeys](https://www.ory.com/docs/network/kratos/passwordless/passkeys)
- [Ory：Customize Identity Schema](https://www.ory.com/docs/kratos/manage-identities/customize-identity-schema)
- 本地 Kratos 源码：`spec/api.json`、`identity`、`session`、`selfservice/strategy`、`cmd/migrate` 与 `contrib/quickstart`
