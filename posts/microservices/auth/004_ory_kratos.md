---
weight: 4
title: "4 Ory Kratos：身份、登录与会话服务"
date: 2026-08-29T10:00:00+08:00
lastmod: 2026-08-29T10:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "从使用者视角理解 Ory Kratos 的结构、数据模型、配置、API 与部署"
featuredImage:

tags: ["auth", "ory", "kratos"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

Kratos 解决的是一组高度相关的问题：用户是谁、用户用什么凭证证明身份、登录成功后如何维持会话，以及注册、找回密码和修改资料如何安全地完成。

它不负责业务权限，不是 OAuth2/OIDC 授权服务器，也不是带登录页面的一体化 IAM。理解这一边界之后，Kratos 的结构就很简单：

```text
用户界面
   │  发起并渲染登录、注册、找回等 Flow
   ▼
Kratos Public API :4433
   ├── Self-service Flow
   ├── Identity / Credential
   └── Session
          │
          ├── SQL 数据库
          └── Courier ──> SMTP / 短信服务

运维后台 / 可信服务
   │
   └── Kratos Admin API :4434
```

不同版本的配置和 API 可能变化，升级时应重新核对当前版本的 `spec/api.json` 与 `.schemastore/config.schema.json`。

<!-- more -->

## 1. Kratos 在认证架构中的位置

认证系统首先需要回答三个不同的问题：

| 问题 | 负责组件 |
| --- | --- |
| 用户是谁，是否完成了登录 | Kratos |
| 某个用户能否操作某个业务资源 | Keto、OPA 或业务服务 |
| 第三方客户端如何获得 OAuth2 Access Token / OIDC ID Token | Hydra |

Oathkeeper 位于请求入口，可以校验 Kratos Session，并把可信身份上下文传给内部服务。它并不会代替 Kratos 保存用户和凭证。

因此 Kratos 的输出首先是 **Session**，而不是 Access Token：

- 浏览器使用 Session Cookie；
- 原生 App、CLI 等非浏览器客户端使用 Session Token；
- 二者都指向 Kratos 中同一类服务端 Session，都可立即撤销；
- Session Token 是不透明凭证，不应按 JWT 解码；
- Kratos 支持按模板把 Session 转成 JWT，但这是可选的互操作能力，不是默认登录结果。

如果系统需要标准 OAuth2/OIDC Token，应引入 Hydra；如果只需让 Gateway 把已认证身份传给内部服务，也可以由 Oathkeeper 或专门的 Token Service 签发短期 Internal JWT。

## 2. 程序由什么组成

Kratos 是一个用 Go 编写的无头 HTTP 服务。它没有采用类似 Spring Boot 的单一全栈框架，而是组合 Gorilla HTTP Router、Negroni 中间件、Cobra CLI、Ory Pop/SQLX 等 Go 库。这里的“无头”表示它提供流程和表单数据，但不提供业务使用的登录页面。页面由应用自己实现，或者使用 Ory Elements。

从使用者视角，只需要理解下面几个模块：

| 源码目录 | 运行时职责 |
| --- | --- |
| `cmd` | `serve`、`migrate sql`、`courier watch` 等 CLI 入口，基于 Cobra |
| `identity` | Identity、Credential、验证地址和恢复地址 |
| `selfservice` | 登录、注册、设置、验证、恢复流程 |
| `session` | Session 创建、查询、续期和撤销 |
| `courier` | 邮件、短信等消息投递 |
| `persistence/sql` | SQL 持久化和数据库迁移 |
| `driver/config`、`.schemastore` | 配置装配与配置 Schema |
| `spec/api.json` | Public API 与 Admin API 的 OpenAPI 定义 |
| `pkg/client-go` | 根据 OpenAPI 生成的 Go Client |

核心技术选择也能从 `go.mod` 中直接看到：HTTP 路由使用 `gorilla/mux`，CLI 使用 Cobra，SQL 层使用 Ory Pop 与 `sqlx`，接口使用 OpenAPI 描述，链路追踪使用 OpenTelemetry，Identity Traits 使用 JSON Schema 约束。

这些库的实现方式不是使用 Kratos 的前置知识。真正稳定的集成边界是配置文件、HTTP API、数据库迁移命令和 OpenAPI SDK。

## 3. 核心运行模型

### 3.1 数据模型

```text
Identity
 ├── Traits                         用户资料，受 JSON Schema 约束
 ├── Credential
 │    └── Credential Identifier    可用于定位账号的邮箱、用户名等
 ├── Verifiable Address            待验证/已验证的邮箱或手机号
 ├── Recovery Address              可用于找回账号的地址
 └── Session
      ├── Authentication Method     本次会话使用的认证方法
      └── Session Device            IP、User-Agent 等设备记录

Self-service Flow
 ├── Login / Registration
 ├── Settings
 ├── Recovery / Verification
 └── UI Nodes                       前端应该渲染和提交的字段

Courier Message                     验证码、恢复邮件等待投递消息
```

最重要的区分是：

- **Identity** 是用户主体，`id` 是其他系统应长期引用的稳定 `sub`；
- **Traits** 是姓名、邮箱等资料，并不是认证凭证；
- **Credential** 是密码哈希、Passkey、TOTP 等证明身份的材料；
- **Flow** 是一次有期限的交互过程，不是用户也不是 Session；
- **Session** 表示一次已经完成的认证状态。

例如用户修改邮箱时，不应该让前端直接更新数据库。前端创建 Settings Flow，Kratos 返回需要填写的 UI Nodes，用户提交后由 Kratos 完成 CSRF、重新认证、Schema 校验和地址验证等步骤。

### 3.2 核心表如何存储

Kratos 支持 PostgreSQL、MySQL 和 CockroachDB 作为生产数据库；SQLite 适合本地开发和测试。生产环境优先使用团队已经能够稳定运维的 PostgreSQL。

下面不是完整表结构，只保留理解模型所需的字段。最终结构以当前版本迁移文件为准。

#### Identity 与 Credential

| 表 | 关键字段 | 含义 |
| --- | --- | --- |
| `identities` | `id UUID` | 稳定的用户主体 ID |
|  | `schema_id VARCHAR` | Traits 使用的 Identity Schema |
|  | `traits JSON` | 姓名、邮箱等用户资料 |
|  | `state` | Identity 状态 |
|  | `metadata_public JSON` | 用户可见的扩展数据 |
|  | `metadata_admin JSON` | 仅 Admin API 可见的扩展数据 |
| `identity_credentials` | `id UUID`、`identity_id UUID` | Credential 及其所属 Identity |
|  | `config JSON` | 密码哈希、Passkey 等具体凭证数据 |
|  | `version INT` | Credential 数据格式版本 |
| `identity_credential_identifiers` | `identifier VARCHAR` | 登录标识，例如邮箱或用户名 |
|  | `identity_credential_id UUID` | 对应的 Credential |

Credential Identifier 被单独保存，是因为“用什么字符串查找账号”和“用什么方式验证账号”是两件事。邮箱可以定位密码 Credential，也可以关联一次性验证码 Credential。

#### Session

| 表 | 关键字段 | 含义 |
| --- | --- | --- |
| `sessions` | `id UUID`、`identity_id UUID` | Session 及其用户 |
|  | `active BOOL`、`expires_at TIMESTAMP` | 是否有效以及过期时间 |
|  | `authenticated_at TIMESTAMP` | 最近完成认证的时间 |
|  | `aal` | 认证保证级别，例如 `aal1`、`aal2` |
|  | `authentication_methods JSON` | 本次认证使用的方法，例如 password、totp |
|  | `token` | 原生客户端使用的不透明 Session Token |
| `session_devices` | `session_id UUID` | 所属 Session |
|  | `ip_address`、`user_agent` | 会话使用设备的信息 |

浏览器 Cookie 和 Session Token 都只是访问 Session 的凭证。真正的有效性由 `active`、`expires_at`、Identity 状态等服务端数据决定，因此管理员撤销 Session 可以立即生效。

#### Flow、地址与消息

| 表组 | 作用 |
| --- | --- |
| `selfservice_*_flows` | 保存 login、registration、settings、recovery、verification 等短期流程状态 |
| `identity_verifiable_addresses` | 邮箱、手机号等验证状态 |
| `identity_recovery_addresses` | 可用于账号恢复的地址 |
| `courier_messages` | 等待发送或已经处理的邮件、短信消息 |

应用不应直接读写这些表。表结构属于 Kratos 的内部持久化契约；应用使用 Public/Admin API，版本升级使用官方迁移命令。

## 4. 配置什么

配置的第一性问题不是“有哪些键”，而是确定五件事：数据放哪里、对外地址是什么、页面在哪里、用户模型是什么、消息怎么发送。

```yaml
version: v0.13.0
dsn: postgres://kratos:${DB_PASSWORD}@postgres:5432/kratos?sslmode=require

serve:
  public:
    base_url: https://auth.example.com/
    cors:
      enabled: true
      allowed_origins: [https://app.example.com]
  admin:
    base_url: http://kratos-admin.auth.svc.cluster.local:4434/

selfservice:
  default_browser_return_url: https://app.example.com/
  allowed_return_urls: [https://app.example.com]
  methods:
    password:
      enabled: true
    totp:
      enabled: true
      config:
        issuer: example
  flows:
    login:
      ui_url: https://app.example.com/login
      lifespan: 10m
    registration:
      ui_url: https://app.example.com/registration
      lifespan: 10m
    settings:
      ui_url: https://app.example.com/settings
    recovery:
      enabled: true
      ui_url: https://app.example.com/recovery
      use: code
    verification:
      enabled: true
      ui_url: https://app.example.com/verification
      use: code

identity:
  default_schema_id: default
  schemas:
    - id: default
      url: file:///etc/config/kratos/identity.schema.json

session:
  lifespan: 24h

secrets:
  cookie: ["${KRATOS_COOKIE_SECRET}"]
  cipher: ["${KRATOS_CIPHER_SECRET}"]

courier:
  smtp:
    connection_uri: smtps://user:${SMTP_PASSWORD}@smtp.example.com:465/

log:
  level: info
  format: json
```

| 配置组 | 解决的问题 |
| --- | --- |
| `dsn` | SQL 数据库连接 |
| `serve.public/admin` | 两组 API 的监听与对外 URL |
| `selfservice.methods` | 启用 password、code、passkey、totp 等方法 |
| `selfservice.flows` | UI 地址、有效期和完成后动作 |
| `identity.schemas` | Identity Traits 的字段、格式和认证属性 |
| `session` | 会话时长、Cookie 和 whoami tokenization |
| `courier` | SMTP、短信及模板 |
| `secrets`、`hashers`、`ciphers` | Cookie 签名、数据加密和密码哈希 |
| `log`、`tracing` | 日志和链路追踪 |

生产配置的三个关键约束：

1. `base_url`、UI URL、回跳 URL 和反向代理域名必须一致，否则容易出现 Cookie、CSRF 或错误跳转问题；
2. Secret 必须由 Secret Manager 或 Kubernetes Secret 注入，不能提交到仓库；轮换时先保留旧值，再将新值放到首位；
3. Identity Schema 是用户数据契约，修改必填字段前必须考虑存量 Identity。

完整配置键以本地 `.schemastore/config.schema.json` 为准，示例以 `contrib/quickstart/kratos/*/kratos.yml` 为准。

## 5. 客户端如何使用 Kratos

### 5.1 浏览器：Cookie Session

```text
1. Browser -> GET /self-service/login/browser
2. Kratos 设置 CSRF Cookie，并 303 跳转到 /login?flow=<flow-id>
3. Login UI -> GET /self-service/login/flows?id=<flow-id>
4. UI 根据 ui.nodes 渲染表单
5. Browser -> POST /self-service/login?flow=<flow-id>
6. Kratos 校验成功，设置 ory_kratos_session Cookie
7. Browser -> GET /sessions/whoami，携带 Cookie
```

浏览器流程必须通过浏览器导航开始，不能简单改成后端 AJAX 请求。Kratos 返回 UI Nodes 而不是 HTML；前端不应自己猜测字段，否则启用 TOTP、Passkey 或验证码后页面会与服务端配置脱节。

### 5.2 App 或 CLI：Session Token

```text
1. Client -> GET /self-service/login/api
2. Client 根据 ui.nodes 收集输入
3. Client -> POST /self-service/login?flow=<flow-id>
4. Kratos -> { "session": {...}, "session_token": "ory_st_..." }
5. Client -> GET /sessions/whoami
             Authorization: Bearer ory_st_...
```

也可以使用 `X-Session-Token`，但新代码优先使用标准的 `Authorization: Bearer`。Session Token 只能安全存储在客户端凭证存储中，不能写入日志或 URL。

### 5.3 Gateway 如何认证请求

Gateway 或 Oathkeeper 收到 Cookie/Session Token 后，调用 Public API：

```http
GET /sessions/whoami HTTP/1.1
Host: kratos:4433
Cookie: ory_kratos_session=...
```

或者：

```http
GET /sessions/whoami HTTP/1.1
Host: kratos:4433
Authorization: Bearer ory_st_...
```

成功响应中的核心信息是：

```json
{
  "id": "session-id",
  "active": true,
  "expires_at": "2026-08-30T10:00:00Z",
  "authenticated_at": "2026-08-29T10:00:00Z",
  "authenticator_assurance_level": "aal2",
  "authentication_methods": [
    { "method": "password" },
    { "method": "totp" }
  ],
  "identity": {
    "id": "identity-id",
    "schema_id": "default",
    "traits": { "email": "alice@example.com" }
  }
}
```

Gateway 至少检查请求成功、`active=true`、会话未过期以及接口要求的 AAL，然后使用 `identity.id` 作为稳定 `sub`。邮箱等 Traits 可以变化，不能代替主体 ID。

在微服务中，不建议每个内部服务都反复调用 `/sessions/whoami`。通常由 Gateway/Oathkeeper 调用一次，再向内部签发短期 Internal JWT；内部服务使用共享 JWKS 本地验签。Kratos 负责外部 Session，内部 JWT 负责跨服务传递身份，这是两个不同生命周期的凭证。

## 6. API 的职责与列表

Kratos 把接口分成两类：

- **Public API（默认 4433）**：允许浏览器、App、登录 UI 和 Gateway 使用；
- **Admin API（默认 4434）**：允许后台管理 Identity、Session 和 Courier Message，必须位于可信网络。

### 6.1 Public API

`{flow}` 表示 login、registration、settings、recovery 或 verification。

| 方法与路径 | 作用 |
| --- | --- |
| `GET /self-service/{flow}/browser` | 创建浏览器 Flow，并跳转到配置的 UI |
| `GET /self-service/{flow}/api` | 为 App/CLI 创建 API Flow |
| `GET /self-service/{flow}/flows?id=...` | 查询 Flow 与 UI Nodes |
| `POST /self-service/{flow}?flow=...` | 提交 Flow |
| `GET /self-service/errors?id=...` | 查询流程错误 |
| `GET /self-service/logout/browser` | 创建浏览器 Logout URL |
| `GET /self-service/logout?token=...` | 完成浏览器退出 |
| `DELETE /self-service/logout/api` | 使用 Session Token 退出 |
| `GET /sessions/whoami` | 校验 Cookie/Session Token 并返回 Session |
| `GET /sessions` | 查询当前 Identity 的 Session |
| `DELETE /sessions/{id}` | 撤销当前 Identity 的指定 Session |
| `DELETE /sessions` | 撤销当前 Session 以外的其他 Session |
| `GET /schemas`、`GET /schemas/{id}` | 查询 Identity Schema |
| `GET /health/alive` | 进程存活检查 |
| `GET /health/ready` | 服务及数据库就绪检查 |
| `GET /version` | 查询运行版本 |

当前版本还有几组专项接口：

| 方法与路径 | 作用 |
| --- | --- |
| `GET /sessions/token-exchange` | 用一次性交换码换取 Session Token，服务跨设备/应用返回流程 |
| `GET /.well-known/change-password` | 暴露标准的修改密码入口 |
| `GET /.well-known/ory/webauthn.js` | 提供 WebAuthn 辅助脚本 |
| `GET /self-service/fed-cm/parameters` | 创建 FedCM 所需参数 |
| `POST /self-service/fed-cm/token` | 提交 FedCM Token |

### 6.2 Admin API

| 方法与路径 | 作用 |
| --- | --- |
| `GET/POST /admin/identities` | 列出或创建 Identity |
| `GET/PUT/PATCH/DELETE /admin/identities/{id}` | 查询、修改或删除 Identity |
| `PATCH /admin/identities` | 批量 Patch Identity |
| `GET /admin/identities/by/external/{externalID}` | 按外部系统 ID 查询 Identity |
| `DELETE /admin/identities/{id}/credentials/{type}` | 删除某类 Credential |
| `GET/DELETE /admin/identities/{id}/sessions` | 查询或撤销某个 Identity 的全部 Session |
| `GET /admin/sessions` | 列出全部 Session |
| `GET/DELETE /admin/sessions/{id}` | 查询或撤销指定 Session |
| `PATCH /admin/sessions/{id}/extend` | 延长 Session |
| `POST /admin/recovery/code` | 为 Identity 创建恢复码 |
| `POST /admin/recovery/link` | 为 Identity 创建恢复链接 |
| `GET /admin/courier/messages` | 查询 Courier Message |
| `GET /admin/courier/messages/{id}` | 查询指定 Message |
| `POST /admin/test-login-flows` | 创建仅用于检查 OIDC Provider 配置的测试 Flow |

OpenAPI 中还包含删除测试 Flow 等测试配套接口。它们不属于常规业务接入路径，只有调试对应能力时才使用。完整而且可生成 SDK 的清单以当前源码 `spec/api.json` 为准。

业务代码优先使用 OpenAPI 生成的 SDK，而不是手写路径和响应结构。Admin API 本身是管理平面，不应因为“放在内网”就默认安全；它前面仍需网络策略、mTLS 或独立的管理认证代理。

## 7. Docker 部署

### 7.1 本地学习

仓库自带的 quickstart 已包含 Kratos、SQLite、演示 UI 和测试邮件服务：

```bash
cd ddd-learn/third_party/ory/kratos
docker compose -f quickstart.yml -f quickstart-standalone.yml up
```

如果要验证 PostgreSQL：

```bash
docker compose -f quickstart.yml -f quickstart-postgres.yml up
```

quickstart 使用 `--dev`、弱 Secret 和测试 SMTP，只用于学习，不能直接作为生产配置。

### 7.2 生产容器的组成

```text
Migration Job ── kratos migrate sql -e --yes
                         │
                         ▼
PostgreSQL <──── Kratos serve ────> SMTP / SMS
                    │   │
              Public   Admin
              Gateway  私有管理网络
```

部署顺序是先迁移、再启动服务：

```bash
kratos -c /etc/config/kratos/kratos.yml migrate sql -e --yes
kratos serve -c /etc/config/kratos/kratos.yml
```

容器部署需要满足：

- 使用固定镜像版本，不使用 `latest`；
- 配置和 Identity Schema 只读挂载；
- DSN、Cookie/Cipher Secret、SMTP 密码通过 Secret 注入；
- 只把 4433 暴露给 Gateway，4434 只允许管理服务访问；
- 使用 `/health/alive` 和 `/health/ready` 配置探针；
- Courier 可以随 Kratos 运行，也可以用 `kratos courier watch` 拆成独立 Worker；
- 多副本共享同一个外部数据库，不使用容器本地 SQLite。

## 8. Kubernetes 部署

官方提供 Helm Chart：

```bash
helm repo add ory https://k8s.ory.com/helm/charts
helm repo update
helm upgrade --install kratos ory/kratos \
  --namespace auth --create-namespace \
  -f values.yaml
```

`ory/kratos` 只部署 Kratos 本身及相关配置、Secret 和迁移容器，不会替你部署 PostgreSQL、SMTP、登录 UI 或 API Gateway。这些依赖需要单独准备。

Chart 至少需要提供 DSN、Secret、默认回跳地址、SMTP 和 Identity Schema。核心结构如下：

```yaml
kratos:
  development: false
  automigration:
    enabled: true
  config:
    dsn: postgres://kratos:${DB_PASSWORD}@postgres.example:5432/kratos?sslmode=require
    serve:
      public:
        base_url: https://auth.example.com/
      admin:
        base_url: http://kratos-admin.auth.svc.cluster.local:4434/
    selfservice:
      default_browser_return_url: https://app.example.com/
    identity:
      default_schema_id: default
      schemas:
        - id: default
          url: file:///etc/config/identity.default.schema.json
    courier:
      smtp:
        connection_uri: smtps://user:${SMTP_PASSWORD}@smtp.example.com:465/
```

`kratos.automigration.enabled: true` 会创建执行迁移的 initContainer，适合开发和简单部署。对多副本生产环境，更推荐在发布流水线中使用独立 Migration Job：只运行一次，迁移成功后才滚动发布 Kratos，失败时阻止新版本上线。

敏感字段不要以明文提交到 `values.yaml`。Chart 支持关闭自动创建 Secret，并通过 `secret.nameOverride` 引用已有 Secret；也可以通过 `deployment.extraEnv`、Migration Job 和 Courier 的对应 `extraEnv` 从 External Secrets/Vault 注入 DSN。无论采用哪种方式，迁移容器与主进程必须拿到同一个 DSN。

Kubernetes 中应明确划分网络边界：

```text
Internet -> Ingress/Gateway -> kratos-public Service :4433

Admin Backend -> NetworkPolicy/mTLS -> kratos-admin Service :4434

Kratos Pods -> External PostgreSQL / SMTP
```

不要为 Admin API 创建公网 Ingress。生产环境还要补齐多副本与 PDB、外部 Secret 管理、数据库备份、NetworkPolicy、登录/Flow/Courier 监控，以及升级前的迁移与回归测试。

## 9. 推荐学习顺序

1. 先读 [Kratos 产品与能力边界](https://www.ory.com/kratos)，明确它是 Identity 与 Session 服务；
2. 运行仓库 `quickstart.yml`，完整走一次注册、验证、登录和退出；
3. 对照 `contrib/quickstart/kratos/email-password/kratos.yml` 修改配置；
4. 对照 `spec/api.json` 或[官方 API 文档](https://www.ory.com/docs/reference/api)理解 Browser Flow 与 API Flow；
5. 最后使用[官方 Kratos Helm Chart](https://k8s.ory.com/helm/kratos.html)部署到测试集群。

遇到问题时按下面的顺序定位：

```text
浏览器跳转 / Cookie / CSRF
        ↓
selfservice URL 与 base_url 是否一致
        ↓
Flow 是否过期，UI 是否按 ui.nodes 提交
        ↓
Identity Schema 是否校验失败
        ↓
数据库、Courier 和外部 IdP 是否正常
```

## 10. 总结

Kratos 的核心不是“提供一个登录接口”，而是把 Identity、Credential、Self-service Flow 和 Session 作为一套完整的安全状态机集中管理。

使用 Kratos 时应守住三条边界：

1. 用户界面消费 Flow，不能绕过 Flow 直接操作身份数据；
2. Public API 服务用户认证，Admin API 属于必须隔离的管理平面；
3. Kratos Session 证明用户身份，业务权限交给 Keto/OPA，OAuth2/OIDC Token 交给 Hydra。

只要先确定这三条边界，配置、API、Docker 和 Kubernetes 部署就都是围绕同一个模型展开，而不是互不相关的功能清单。
