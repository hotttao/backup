---
weight: 4
title: "Ory Kratos（一）：核心架构与数据模型"
date: 2026-08-29T10:00:00+08:00
lastmod: 2026-09-02T11:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "理解 Ory Kratos 的核心抽象、数据模型、存储、API 边界和部署架构"
featuredImage:

tags: ["auth", "ory", "kratos"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

Ory Kratos 是无头身份认证服务，负责管理人类用户、登录凭证、自助认证流程和 Session。它提供 API 和流程状态，不直接提供业务系统的登录页面。

本篇只讨论稳定的架构知识：Kratos 有哪些核心抽象、数据如何关联、哪些内容持久化到哪里，以及生产环境由哪些运行单元组成。具体 Workflow 留到下一篇。

<!-- more -->

## 1. Kratos 在认证架构中的位置

认证系统中的三个问题由不同组件回答：

| 问题 | 负责组件 |
| --- | --- |
| 用户是谁，凭证是否有效，是否已经登录 | Kratos |
| 用户能否操作某个业务资源 | Keto、OPA 或业务服务 |
| 第三方 Client 如何获得 OAuth2/OIDC Token | Hydra |

Kratos 的主要输出是 Session：

```text
Browser    → Session Cookie
App / CLI  → Session Token
```

两种凭证都指向 Kratos 服务端保存的 Session。Session Token 是不透明字符串，不是 JWT。需要标准 OAuth2/OIDC Token 时使用 Hydra；需要把身份传给内部微服务时，可以由 Oathkeeper 转换为短期 Internal JWT。

整体位置如下：

```mermaid
flowchart LR
    UI[Account UI / Ory Elements]
    Public[Kratos Public API :4433]
    Admin[Kratos Admin API :4434]
    DB[(SQL Database)]
    Courier[Courier Worker]
    SMTP[SMTP / SMS Provider]
    Gateway[Gateway / Oathkeeper]
    Backend[Trusted Admin Service]

    UI -->|Self-service Flow| Public
    Gateway -->|sessions/whoami| Public
    Backend -->|管理 Identity / Session| Admin
    Public --> DB
    Admin --> DB
    Courier --> DB
    Courier --> SMTP
```

## 2. 六个核心抽象

### 2.1 Identity：稳定的用户主体

Identity 表示一个用户。其他系统长期引用的是不可变的 `identity.id`：

```text
Identity
├── id
├── schema_id
├── traits
├── state
├── metadata_public
└── metadata_admin
```

`traits` 保存姓名、邮箱等资料，由 Identity Schema 校验。邮箱和用户名可能改变，不能代替稳定的 Identity ID 作为关系权限或审计日志中的主体 ID。

`metadata_public` 可以暴露给用户本人；`metadata_admin` 只允许可信 Admin API 使用。业务资料不应无限堆入 Identity，频繁变化或属于业务领域的数据仍由业务服务保存。

### 2.2 Identity Schema：用户资料契约

Identity Schema 是 JSON Schema，定义 Traits 的字段、格式和认证用途。例如：

```json
{
  "$id": "https://example.com/schemas/customer.json",
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
              "code": { "identifier": true, "via": "email" }
            },
            "verification": { "via": "email" },
            "recovery": { "via": "email" }
          }
        },
        "name": { "type": "string" }
      },
      "required": ["email"]
    }
  }
}
```

Schema 同时决定：

```text
email 是 Traits 字段
email 可以定位 password / code Credential
email 可以接收 Verification 消息
email 可以接收 Recovery 消息
```

修改 Schema 等于修改用户数据契约。新增必填字段前必须考虑已有 Identity 是否仍然满足约束。

### 2.3 Credential：证明身份的材料

Credential 回答“用户如何证明自己是这个 Identity”。常见类型包括：

```text
password
code
oidc
passkey
webauthn
totp
lookup_secret
```

Credential Identifier 用来定位账号，Credential Config 保存密码哈希、公钥或认证方式所需的配置。Traits 与 Credential 必须分开：邮箱是用户资料和登录标识，密码哈希才是认证材料。

### 2.4 Address：验证和恢复地址

Kratos 从 Identity Schema 中提取地址并分别管理：

| 对象 | 作用 |
| --- | --- |
| Verifiable Address | 记录邮箱或手机号是否完成验证 |
| Recovery Address | 记录哪个地址可以用于找回账号 |

邮箱存在于 Traits，不表示它已经验证。Verification 修改的是地址验证状态；Recovery 使用恢复地址建立一次受限的账号恢复授权。

### 2.5 Session：已经完成的认证状态

认证成功后，Kratos 创建 Session：

```text
Session
├── identity_id
├── active / expires_at
├── authenticated_at
├── authenticator_assurance_level
├── authentication_methods
└── devices
```

Session 的关键属性：

- `identity_id` 表示当前用户；
- `active` 和 `expires_at` 决定 Session 是否有效；
- `authenticated_at` 表示最近完成认证的时间；
- AAL 表示认证强度；
- Authentication Methods 记录 password、totp 等本次会话使用的方法。

浏览器 Cookie 和 App Session Token 只是找到 Session 的凭证。管理员撤销 Session 或禁用 Identity 后，服务端状态会使凭证失效。

### 2.6 Self-service Flow：一次有限期的交互状态机

Flow 表示一次注册、登录或账号设置过程：

```text
Self-service Flow
├── id
├── type
├── state
├── expires_at
├── ui.action
├── ui.method
├── ui.nodes
└── ui.messages
```

Kratos 根据服务端配置生成 `ui.nodes`，UI 负责渲染，不应自己猜测表单字段。启用验证码、Passkey 或 TOTP 后，节点会随 Flow 状态变化。

常见 Flow：

| Flow | 作用 |
| --- | --- |
| Registration | 创建 Identity 和 Credential |
| Login | 验证 Credential 并创建或提升 Session |
| Settings | 修改 Profile、密码、MFA 等账号设置 |
| Recovery | 证明用户控制恢复地址，并进入 Settings |
| Verification | 验证邮箱或手机号 |
| Logout | 撤销当前 Session |

Flow 是临时状态，不是 Identity，也不是 Session。它有过期时间、CSRF 上下文和浏览器 Cookie，不能长期保存或跨浏览器随意复用。

## 3. 数据模型

```mermaid
erDiagram
    IDENTITY ||--o{ CREDENTIAL : owns
    CREDENTIAL ||--o{ CREDENTIAL_IDENTIFIER : has
    IDENTITY ||--o{ VERIFIABLE_ADDRESS : has
    IDENTITY ||--o{ RECOVERY_ADDRESS : has
    IDENTITY ||--o{ SESSION : authenticates
    SESSION ||--o{ SESSION_DEVICE : records
    IDENTITY ||--o{ SELF_SERVICE_FLOW : participates
    SELF_SERVICE_FLOW ||--o{ COURIER_MESSAGE : creates
```

核心数据可以归为四组：

| 数据组 | 主要表或对象 | 生命周期 |
| --- | --- | --- |
| 身份 | `identities`、地址表 | 长期 |
| 凭证 | `identity_credentials`、Credential Identifier | 长期，可轮换或删除 |
| 会话 | `sessions`、`session_devices` | 中期，可过期或撤销 |
| 流程与消息 | `selfservice_*_flows`、`courier_messages` | 短期或处理完成后归档 |

### 3.1 Identity 与 Credential

| 表 | 关键字段 | 含义 |
| --- | --- | --- |
| `identities` | `id`、`schema_id`、`traits`、`state` | 用户主体与资料 |
| `identity_credentials` | `identity_id`、`config`、`version` | Identity 的认证材料 |
| `identity_credential_identifiers` | `identifier`、`identity_credential_id` | 邮箱、用户名等登录标识 |
| `identity_verifiable_addresses` | `value`、`verified` | 地址验证状态 |
| `identity_recovery_addresses` | `value` | 可用的恢复地址 |

Credential Identifier 单独存储，是因为“用什么字符串定位账号”和“如何验证凭证”是两个问题。同一邮箱可以同时关联 password 和 code 等 Credential。

### 3.2 Session、Flow 与 Courier Message

| 表组 | 保存内容 |
| --- | --- |
| `sessions` | Identity、有效期、AAL、认证方法和 Session Token |
| `session_devices` | IP、User-Agent 等设备信息 |
| `selfservice_*_flows` | 各类 Flow 的状态、有效期和 UI 数据 |
| `courier_messages` | 等待 Courier Worker 投递的邮件或短信 |

应用不应直接读写这些表。数据库结构属于 Kratos 的内部实现；业务集成使用 Public/Admin API，升级使用对应版本的迁移命令。

## 4. 数据存在哪里

Kratos 的数据不全部位于同一个位置：

| 内容 | 存储位置 |
| --- | --- |
| Identity、Credential、Session、Flow、Courier Message | SQL 数据库 |
| Identity Schema | 文件、HTTP(S) 地址或部署配置引用的位置 |
| Kratos 配置 | YAML/JSON 文件与环境变量 |
| Cookie/Cipher Secret、DSN、SMTP 密码 | Secret Manager 或 Kubernetes Secret |
| 浏览器 Session 凭证和 CSRF Cookie | 浏览器 Cookie Jar |
| App Session Token | 操作系统安全凭证存储 |

生产数据库支持 PostgreSQL、MySQL 和 CockroachDB；SQLite 适合本地开发和测试。多副本必须共享外部数据库，不能使用各容器自己的 SQLite 文件。

生产环境通常优先选择团队已经能够稳定运维的 PostgreSQL。数据库需要备份、加密连接和独立账号，DSN 不应写进镜像或公开配置。

## 5. 运行时接口与进程

### 5.1 Public API：用户交互面

Public API 默认监听 `4433`，提供：

```text
Self-service Flow 创建、读取和提交
Session /sessions/whoami
当前用户的 Session 管理
Logout
Identity Schema 查询
健康检查
```

它允许 Account UI、浏览器、App、CLI、Gateway 和 Oathkeeper 使用。Public 不等于可以绕过 Gateway 任意暴露；CORS、Cookie Domain、TLS 和限流仍需正确配置。

### 5.2 Admin API：可信管理面

Admin API 默认监听 `4434`，用于：

```text
创建、查询、修改和删除 Identity
删除 Credential
查询和撤销任意用户 Session
创建 Recovery Code / Link
查询 Courier Message
```

Admin API 能直接管理所有用户，必须放在私有网络，并由 NetworkPolicy、mTLS 或管理认证代理保护，不能暴露给浏览器。

### 5.3 Courier Worker：通知投递面

Kratos 在注册、验证和恢复流程中把消息写入 `courier_messages`。Courier Worker 使用：

```bash
kratos courier watch -c /etc/config/kratos/kratos.yml
```

读取消息并投递到 SMTP 或短信服务。Courier 是 Kratos 的通知投递进程，不是通用 MQ，也不处理业务系统的营销或业务消息。

### 5.4 Migration Job：数据库结构管理

版本发布前执行：

```bash
kratos migrate sql -e --yes \
  -c /etc/config/kratos/kratos.yml
```

迁移只修改 Kratos 自己的数据库 Schema，不创建业务用户，也不读取 Identity Schema 自动生成 Identity。生产环境应由独立 Job 执行一次，成功后再滚动发布 Kratos。

## 6. 配置结构

配置围绕六个问题组织：

| 配置组 | 解决的问题 |
| --- | --- |
| `dsn` | 数据库连接 |
| `serve.public/admin` | API 地址、CORS 和 Cookie 边界 |
| `identity.schemas` | Traits 数据契约 |
| `selfservice.methods/flows` | 启用哪些认证方法以及 UI 地址 |
| `session` | Session 时长和行为 |
| `courier` | SMTP、短信和模板 |
| `secrets`、`hashers` | Cookie 签名、数据加密和密码哈希 |

最小结构示例：

```yaml
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
  flows:
    login:
      ui_url: https://app.example.com/login
    registration:
      ui_url: https://app.example.com/registration
    settings:
      ui_url: https://app.example.com/settings
    recovery:
      enabled: true
      ui_url: https://app.example.com/recovery
    verification:
      enabled: true
      ui_url: https://app.example.com/verification

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
```

最常见的问题不是配置项缺失，而是 `base_url`、UI URL、回跳 URL、反向代理域名和 Cookie Domain 不一致。这些地址必须作为一个整体设计。

## 7. 生产部署架构

```mermaid
flowchart TD
    Browser[Browser / App]
    Gateway[Gateway / Ingress]
    Public[Kratos Public Replicas]
    AdminService[Trusted Admin Service]
    Admin[Kratos Admin Replicas]
    Migration[Migration Job]
    Courier[Courier Workers]
    DB[(PostgreSQL / MySQL / CockroachDB)]
    SMTP[SMTP / SMS]
    Secret[Secret Manager]

    Browser --> Gateway
    Gateway --> Public
    AdminService --> Admin
    Public --> DB
    Admin --> DB
    Migration --> DB
    Courier --> DB
    Courier --> SMTP
    Secret --> Public
    Secret --> Admin
    Secret --> Migration
    Secret --> Courier
```

生产环境需要满足：

- 固定镜像版本，不使用 `latest`；
- Public API 经 Gateway 暴露，Admin API 只允许可信服务访问；
- 多个 Kratos 副本共享外部 SQL 数据库；
- Migration Job 在服务升级前只执行一次；
- Courier 可以独立扩容，并使用同一数据库和消息配置；
- Identity Schema 和配置只读挂载；
- DSN、Cookie/Cipher Secret 和 SMTP 密码由 Secret 注入；
- 使用 `/health/alive` 和 `/health/ready` 配置探针。

官方 Helm Chart 可以创建 Kratos 工作负载、Service 和迁移容器，但不会自动提供生产级数据库、SMTP、Account UI 或 Gateway，这些依赖需要独立部署。

## 8. 总结

Kratos 的核心模型可以概括为：

```text
Identity Schema
  ↓ 约束
Identity
  ├── Traits
  ├── Credential
  ├── Verification / Recovery Address
  └── Session

Self-service Flow
  ↓ 安全地创建或修改上述对象

Courier Message
  ↓ Courier Worker 投递验证码和链接
```

需要牢牢记住四个边界：

```text
Identity 是用户主体
Credential 是认证材料
Flow 是临时交互状态
Session 是已经完成的认证状态
```

下一篇将使用浏览器 Network 请求，完整执行 Registration、Verification、Login、Logout、Recovery 和 Settings Workflow。

## 参考资料

- [Ory Kratos Documentation](https://www.ory.com/docs/kratos)
- [Ory Kratos Identity Model](https://www.ory.com/docs/kratos/manage-identities/overview)
- [Ory Kratos Session Management](https://www.ory.com/docs/kratos/session-management/overview)
- [Ory Kratos API](https://www.ory.com/docs/kratos/reference/api)
- [Ory Helm Charts](https://k8s.ory.com/helm/kratos.html)
