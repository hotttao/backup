---
weight: 6
title: "6 Ory Talos：API Key 与机器身份凭证"
date: 2026-08-29T16:30:00+08:00
lastmod: 2026-08-29T16:30:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "理解 Ory Talos 的 API Key、派生 Token、数据模型、接口和部署边界"
tags: ["auth", "ory", "talos", "api-key"]
categories: ["microservice"]
toc:
  auto: false
---

Talos 管理的是非人类调用者的长期 API Key，以及由长期 Key 派生的短期 JWT/Macaroon。它解决密钥签发、导入、校验、轮换和撤销问题，不负责用户登录，也不负责资源关系权限。

```text
管理员 / Secret Provisioner
          │ issue / import / rotate / revoke
          ▼
       Talos Admin API ─────> API Key Store
          │
          ├── verify API Key
          ├── derive short-lived JWT / Macaroon
          └── publish JWKS

Agent / CLI / Service ── API Key 或派生 Token ──> Gateway
```

本文依据本地 `ddd-learn/third_party/talos` 源码提交 `8d8d26f`、Proto、配置 Schema、迁移和项目自带文档整理。当前接口版本仍是 `v2alpha1`，升级前必须核对兼容性。

<!-- more -->

## 1. Talos 与其他认证组件的边界

| 组件 | 管理的主体或凭证 |
| --- | --- |
| Kratos | 人类用户、登录凭证与 Session |
| Hydra | OAuth2 Client、Access Token 与 OIDC Token |
| Talos | API Key 和由它派生的短期 Token |
| Keto/OPA | 调用者对业务资源的权限 |
| Oathkeeper/Gateway | 在请求入口验证凭证、执行策略并传递身份 |

Talos 适用于 Agent、CLI、Webhook 调用者、CI/CD 和内部服务需要 API Key 的场景。如果已经有标准 OAuth2 Client Credentials，并且调用方能安全执行 OAuth2 流程，不必为了“统一”再增加 Talos。

## 2. 为什么要区分长期 Key 和短期 Token

长期 API Key 便于初始化，但长期暴露在每次请求中会扩大泄漏风险。Talos 支持把它转换成短期、缩小权限范围的凭证：

```text
长期 API Key
   │ 认证并请求 derive
   ▼
短期 JWT / Macaroon
   ├── 更短有效期
   ├── 权限不超过父 Key
   └── 可在边缘离线验签
```

代价是派生 Token 通常是无状态的：父 Key 被撤销后，已经签发的短期 Token 不一定立即失效，只能等待其过期。因此派生 Token 必须短命，不能把一年有效期的 API Key 变成另一个一年有效期的 JWT。

## 3. 程序结构与技术栈

Talos 使用 Go 编写，Proto 是接口事实来源，通过 gRPC-Gateway 暴露 JSON/HTTP API。

| 目录 | 职责 |
| --- | --- |
| `cmd` | `serve`、`migrate`、`keys`、`jwk` 和 `proxy` CLI |
| `api/talos/v2alpha1` | Proto、HTTP 映射和 API 模型 |
| `internal/service` | Key 生命周期与验证用例 |
| `internal/verifier` | API Key、JWT、Macaroon 验证 |
| `internal/persistence` | SQLC、迁移和数据库实现 |
| `internal/cache` | 验证结果缓存抽象 |
| `internal/crypto` | HMAC、签名与 Token 处理 |
| `spec/config.schema.json` | 完整配置 Schema |
| `docs` | 项目内自带的使用与运维文档 |

主要依赖包括 Cobra、gRPC-Gateway、Protocol Buffers、SQLX/PGX、`golang-migrate`、JWX 与 OpenTelemetry。业务服务应使用生成 Client 或 HTTP API，而不是导入 `internal/*`。

## 4. Credential 模型

```text
API Credential
 ├── Issued API Key            Talos 生成，Secret 只返回一次
 ├── Imported API Key          从旧系统导入，只保存哈希
 ├── Derived JWT              公钥验证的短期 Token
 └── Derived Macaroon         可附加限制条件的短期 Token

API Key
 ├── key_id
 ├── actor_id
 ├── scopes / metadata
 ├── status / expires_at
 ├── allowed_cidrs
 └── rate-limit policy
```

Talos 生成的 Key 格式为：

```text
{prefix}_v1_{identifier}_{HMAC-SHA256 checksum}
```

`key_id` 可从 identifier 定位，checksum 使用 HMAC 校验完整性。HMAC 配置允许 `current + retired`，用于零停机轮换。

### 核心表

| 表 | 关键字段 | 含义 |
| --- | --- | --- |
| `issued_api_keys` | `key_id`、`token_prefix`、`version` | Talos 签发 Key 的标识与格式 |
|  | `actor_id`、`scopes`、`metadata` | 调用主体与授权上下文 |
|  | `status`、`expires_at`、`last_used_at` | 生命周期与审计状态 |
|  | `allowed_cidrs` | 使用来源限制 |
| `imported_api_keys` | `key_id` | 外部 Key 的 SHA-512/256 摘要；该摘要同时作为 Key 标识，不另设 `key_hash` |
|  | `actor_id`、`scopes`、`metadata` | 统一后的主体与上下文 |
|  | `status`、`expires_at` | 生命周期 |

数据库不保存 Talos 已签发 Key 的可恢复明文；签发响应中的 Secret 必须当场写入 Secret Manager，之后无法再次查询。

## 5. API Surface

Talos 是一个二进制，但有两个安全级别完全不同的接口面：

```text
talos serve admin   -> /v2alpha1/admin/*
talos serve public  -> /v2alpha1/apiKeys:selfRevoke
talos serve         -> 两者同时提供，适合开发
```

Admin API **没有内置认证**。任何能够到达它的请求都被视为可信，所以必须放在 mTLS、认证代理、API Gateway Authorizer 或严格的内部网络之后。

### Admin API

| 接口 | 作用 |
| --- | --- |
| `POST /v2alpha1/admin/issuedApiKeys` | 签发 API Key，Secret 只返回一次 |
| `GET/PATCH /v2alpha1/admin/issuedApiKeys/{key_id}` | 查询或修改签发 Key |
| `GET /v2alpha1/admin/issuedApiKeys` | 分页查询签发 Key |
| `POST .../{key_id}:rotate` | 生成新 Key 并撤销旧 Key |
| `POST .../{key_id}:revoke` | 撤销签发 Key |
| `POST /v2alpha1/admin/importedApiKeys` | 导入外部 API Key |
| `POST /v2alpha1/admin/importedApiKeys:batchCreate` | 批量导入 |
| `GET/PATCH/DELETE /v2alpha1/admin/importedApiKeys/{key_id}` | 管理导入 Key |
| `POST .../{key_id}:revoke` | 软撤销导入 Key |
| `POST /v2alpha1/admin/apiKeys:verify` | 校验任意受支持 Credential |
| `POST /v2alpha1/admin/apiKeys:batchVerify` | 批量校验 |
| `POST /v2alpha1/admin/apiKeys:derive` | 派生 JWT 或 Macaroon |

### Public API

| 接口 | 作用 |
| --- | --- |
| `POST /v2alpha1/apiKeys:selfRevoke` | 持有者用完整 Credential 证明所有权并自行撤销 |
| `GET /v2alpha1/derivedKeys/jwks.json` | 发布派生 JWT 的验证公钥，各模式均可提供 |

这里必须区分三种 Credential：

| Credential | 是否携带身份信息 | Gateway 从哪里得到身份 |
| --- | --- | --- |
| Talos API Key | 不携带可供 Gateway 直接读取的 `actor_id`、`scopes` | 调用 Talos `apiKeys:verify`，从验证响应取得 |
| Talos 派生 JWT | 携带 Talos 签名的 `act`、`scp` 等 Claim | 使用 Talos JWKS 验签后读取 Claim |
| Internal JWT | 由 Gateway 根据可信验证结果重新签发 | 内部服务使用 Gateway JWKS 验签后读取 Claim |

因此，“Gateway 写入 Internal JWT”并不是从不透明 API Key 中解码出了身份。它必须先完成一次可信验证，再把验证结果转换成内部统一身份格式。

## 6. 一次完整执行

在执行流程之前，先确定请求主体是谁：

| 请求主体 | 外部 Credential | 身份来源 | 是否需要 Kratos |
| --- | --- | --- | --- |
| 登录用户 | Kratos Session Cookie | Kratos Session 中的 `identity.id`、AAL 和 Traits | 需要 |
| 系统 CLI、系统 Agent、定时任务、内部服务 | Talos API Key 或派生 JWT | Talos 返回或签名的 `actor_id`、scopes、metadata | 不需要 |
| 用户创建的 Agent | Talos API Key 或派生 JWT | Talos 证明 Agent 身份；Agent Registry/Keto 证明它属于哪个 Kratos 用户 | 两者都需要，但作用不同 |

Talos 不负责登录用户，也不应该为了验证机器 API Key 而临时查询 Kratos。签发机器 Key 时写入的 `actor_id` 应当使用明确的机器主体，例如 `agent:agent-17`，避免与 Kratos 的用户 Identity ID 混淆。

对于浏览器用户，请求流程是：

```text
Browser -> Gateway: Cookie: ory_kratos_session=...
Gateway -> Kratos /sessions/whoami: 携带原始 Session Cookie
Kratos -> Gateway: active=true、identity.id=user-123、aal=aal1/aal2、traits
Gateway -> Keto/OPA: user-123 是否允许执行目标操作
Gateway -> 业务服务: Gateway 签发的短期 Internal JWT
```

因此，Gateway 确实要从 Kratos 获得用户身份，但不必再用 Talos 验证同一个用户请求。Gateway 应把不同认证源的结果规范成相同的内部 Claim，例如都使用 `sub` 表示业务主体 ID，同时增加 `subject_type=user|service` 和 `auth_source=kratos|talos`，让业务服务能够区分用户与机器。

还有一种情况是“用户创建个人 API Key”。创建 Key 时，用户先通过 Kratos Session 证明自己是 `user-123`，Key 管理服务再向 Talos 写入 `actor_id=user:user-123`。此后使用 Key 时，Talos 验证响应就能返回这条直接绑定关系，不需要 Gateway 每次再查询 Kratos：

```text
创建时：Kratos Session -> identity.id=user-123 -> Talos actor_id=user:user-123
使用时：Talos API Key -> apiKeys:verify -> actor_id=user:user-123
```

Kratos 仍是用户身份的事实来源，Talos 只是保存“这把 Key 代表哪个主体”的引用。用户被禁用或删除时，身份管理流程必须同步撤销该用户的 Talos Key；如果业务要求禁用立即生效，也可以增加实时状态检查，但这不是解析 API Key 所必需的步骤。

### 用户 Agent 必须同时保存机器身份和用户关系

假设 Alice 在系统中创建了一个专属抓取 Agent。这里存在两个不同事实：

```text
谁正在调用？          agent:agent-17        <- Talos 负责证明
Agent 属于哪个用户？  user:<alice-identity> <- Agent Registry/Keto 负责证明
```

不能只保存第二个事实。如果把 Agent 直接冒充成 Alice，审计日志将无法判断操作来自 Alice 的浏览器还是她创建的自动化 Agent；Agent 泄露时也无法单独撤销。Talos Token 的直接作用，就是证明当前调用方确实是 `agent:agent-17`，并限制这台 Agent 最多可以申请哪些操作。

两者在创建 Agent 时建立关联：

```text
1. Alice -> Gateway: 携带 Kratos Session，创建 Agent
2. Gateway -> Kratos /sessions/whoami
3. Kratos -> Gateway: identity.id=<alice-identity>
4. Agent Service 创建业务记录：
   Agent{id=agent-17, owner_identity_id=<alice-identity>}
5. Agent Service 写入 Keto Relation Tuple：
   namespace=Agent
   object=agent-17
   relation=owner
   subject_id=<alice-identity>
6. Agent Service -> Talos: 签发 actor_id=agent:agent-17 的 API Key
7. Secret 只交给 agent-17
```

因此关联链不是 `Token -> User`，而是：

```text
Talos Token -> Agent Identity -> owner Relation -> Kratos Identity
```

这种间接关联更准确：Talos 管凭证，Kratos 管用户，Agent Service 管 Agent，Keto 管 Agent 与用户的关系。`owner_identity_id` 也可以复制进 Talos metadata 方便审计，但授权时应以 Agent Registry/Keto 中当前关系为准，避免 Agent 转移所有者后仍使用旧信息。

下面完整执行一次 Alice 的 Agent 请求。为 Agent 签发 Key 时向 Talos 提交：

```jsonc
{
  "actor_id": "agent:agent-17",    // 这把 Key 属于哪个 Agent
  "scopes": ["crawl:start"],       // 这把 Key 被授予的能力
  "metadata": {"tenant_id": "G"}   // 随 Key 保存的辅助信息
}
```

Talos 把这些信息和 Key 记录保存在数据库中，只把 Secret 返回给 Agent。Agent 后续提交的 `<api-key>` 是一段不透明凭证，其中没有可供 Gateway 直接信任的 `actor_id` 和 `scopes`。

一次请求按下面的顺序执行：

```text
Agent                    Gateway                    Talos                   业务服务
  | Authorization:         |                         |                        |
  | Bearer <api-key> ----> |                         |                        |
  |                        | credential=<api-key> -> |                        |
  |                        |                         | 校验 Key 并查询数据库   |
  |                        | <- is_valid=true,       |                        |
  |                        |    actor_id=agent:agent-17,                      |
  |                        |    scopes=[crawl:start],|                        |
  |                        |    metadata={tenant:G}  |                        |
  |                        |                         |                        |
  |                        | 查询 Agent Registry/Keto，得到 owner=Alice       |
  |                        | 调用 Keto/OPA 检查 Agent 能否代表 Alice 执行动作  |
  |                        | 签发短期 Internal JWT -------------------------> |
```

Gateway 调用的验证请求只有原始凭证：

```jsonc
{
  "credential": "<api-key>"
}
```

Talos 根据凭证定位 Key 记录，校验密码学完整性、状态、过期时间和 CIDR，成功后返回：

```jsonc
{
  "is_valid": true,
  "key_id": "key-8f3...",
  "actor_id": "agent:agent-17",
  "scopes": ["crawl:start"],
  "metadata": {"tenant_id": "G"},
  "status": "KEY_STATUS_ACTIVE"
}
```

这份响应只能证明 Agent 身份。Gateway 还要根据 `agent-17` 查询可信的 Agent 记录，并用 Keto 确认 `Alice owner Agent:agent-17` 关系仍然成立，然后才能构造“Agent 代表 Alice”的内部身份。Internal JWT 可以采用下面的约定：

```jsonc
{
  "iss": "https://gateway.internal", // Internal JWT 的签发者
  "sub": "user:<alice-identity>",    // 当前操作代表的业务主体
  "subject_type": "user",           // sub 是用户
  "act": {
    "sub": "agent:agent-17"          // 实际发起请求的 Agent
  },
  "auth_source": "talos",           // Agent 凭证由 Talos 验证
  "aud": ["crawler-service"],        // 只允许目标服务使用
  "scope": ["crawl:start"],          // Talos 验证后返回的能力
  "tenant_id": "G",                  // 经白名单选取的业务上下文
  "credential_id": "key-8f3...",     // 本次认证所用 Key，便于审计
  "iat": 1788062400,
  "exp": 1788062700                   // 短期有效，例如 5 分钟
}
```

这里的 `sub` 与 `act.sub` 不能互换：

- `sub` 是当前业务操作代表的用户，Keto 用它检查 Alice 对目标资源的权限；
- `act.sub` 是实际持有 Credential 并发起请求的 Agent，用于限制委托和审计；
- 如果是完全自主的系统 Agent，没有代表任何用户，则 `sub` 直接写 Agent ID，不写 `act`。

最终允许条件是多项约束的交集：

```text
allow = Talos Credential 有效
     && agent-17 当前属于 Alice
     && Token scope 包含 crawl:start
     && Alice 对目标资源拥有相应权限
     && OPA 动态策略允许本次环境和操作
```

这也正是 Agent Token 的价值：用户权限回答“Alice 能不能做”，Agent Token 回答“现在是不是 Alice 授权的那台 Agent 在做，以及这台 Agent 最多能做什么”。

所谓“删除客户端伪造的身份 Header”，指的是 Gateway 在认证前无条件删除外部请求中的 `X-Actor-ID`、`X-Scopes`、`X-Tenant-ID` 以及内部认证 Header。否则客户端完全可以自己发送 `X-Actor-ID: admin`。Gateway 完成认证后，不再信任或透传这些原值，而是把自己签名的 Internal JWT 放入约定的内部 Header。业务服务只信任 Gateway 的签名、`iss`、`aud` 和有效期，不信任普通身份 Header。

### 请求量大时：先派生 JWT，再本地验证

也可以先用长期 API Key 调用 `apiKeys:derive`，换取短期 Talos JWT。这个 JWT **不是不透明的**；结合代码，其主要 Claim 是：

```jsonc
{
  "iss": "https://talos.example.com",
  "sub": "key-8f3...",       // 父 API Key 的 ID，不是 actor_id
  "act": "agent:agent-17",   // Talos 自定义字段：actor_id
  "scp": ["crawl:start"],    // scopes
  "akid": "key-8f3...",      // API Key ID
  "pid": "key-8f3...",       // 父 Key ID
  "meta": {"tenant_id": "G"},
  "iat": 1788062400,
  "nbf": 1788062400,
  "exp": 1788063300
}
```

此时 Gateway 从 Talos JWKS 获取公钥，本地验证签名、`iss`、`nbf`、`exp` 后，直接从已验签的 Claim 得到 `act` 和 `scp`，无须每次调用 Talos。Gateway 可以继续把它规范化为统一的 Internal JWT，使业务服务不必理解 Talos 专用字段。代价是父 Key 被撤销后，已经签发的派生 JWT 仍会有效到自身过期，因此必须使用较短 TTL。

注意，Talos 派生 JWT 中的 `act` 是字符串形式的 Talos 自定义 `actor_id`；上面的 Internal JWT 则把 `act` 规范成包含 `sub` 的委托 Actor 对象。Gateway 转换时必须明确处理，不能直接原样复制。

## 7. 配置

```yaml
serve:
  http:
    host: 0.0.0.0
    port: 4420

credentials:
  issuer: https://talos.example.com
  api_keys:
    default_ttl: 720h
    max_ttl: 8760h
    prefix:
      current: prod
      retired: []
  derived_tokens:
    default_ttl: 15m
    jwt:
      signing_keys:
        urls:
          - file:///etc/talos/jwks.json

db:
  dsn: sqlite3:///var/lib/talos/talos.db?_journal_mode=WAL

secrets:
  hmac:
    current: "${TALOS_HMAC_SECRET}"
    retired: []

cache:
  type: noop
  ttl: 5m

log:
  level: info
  format: json
```

必须保护 HMAC Secret 和包含私钥的 JWKS。所有实例必须使用相同的 HMAC/JWKS，否则一个实例签发的 Key 或 Token 无法被另一个实例验证。

## 8. OSS 与商业版边界

源码自带文档明确区分：

| 能力 | OSS | 商业版 |
| --- | --- | --- |
| Key 生命周期、验证、派生 | 支持 | 支持 |
| Admin/Public 分进程 | 支持 | 支持 |
| 数据库 | SQLite | SQLite、PostgreSQL、MySQL、CockroachDB |
| Cache | `noop` | memory、Redis |
| 多租户、强制限流、Edge Proxy | 不支持 | 支持 |
| Helm Chart | 未提供 | 提供 |

这意味着 OSS 更适合本地学习、单机或低流量场景。不要根据 `go.mod` 中存在 PGX 就推断 OSS 可以直接使用 PostgreSQL；Edition 的运行时能力以源码文档和构建标签为准。

## 9. Docker 与 Kubernetes

本地启动：

```bash
cd ddd-learn/third_party/talos
docker compose -f docker-compose.oss.yaml up --build
```

当前 Compose 实际暴露 API `4420`、健康端口 `4422`。本地 `docs/operate/install.md` 中仍有一处写成 `8080`，与 Compose 和配置不一致，应以当前配置文件为准。

生产启动前执行迁移：

```bash
talos migrate up --database "sqlite:///var/lib/talos/talos.db"
talos serve admin --config /etc/talos/config.yaml
```

当前源码同时接受 `sqlite://` 和 `sqlite3://`，本文统一使用 `sqlite:///var/lib/talos/talos.db`。Kubernetes 必须先用一个 Job 执行 `talos migrate up`，成功后再启动应用；迁移 Job 与应用镜像必须固定为同一版本，不能使用 `latest`。

Talos 的 Helm 边界与其他 Ory 服务不同：

| 版本 | 官方 Helm | Kubernetes 建议 |
| --- | --- | --- |
| OSS | **没有** | 自建 Job、PVC、ConfigMap/Secret、Deployment 和 Service |
| Commercial | 有 | 使用 Ory 提供的商业 Chart 和外部 PostgreSQL/MySQL/CockroachDB |

OSS 只有 SQLite，适合单副本验证或小规模部署：

```text
Migration Job ──> PVC(talos.db)
                       │
                 Talos Deployment x1
                       ├── ClusterIP :4420
                       └── probes /health/alive、/health/ready
```

SQLite PVC 通常是 `ReadWriteOnce`，不应据此设计多副本 Talos。若目标是生产多副本 Kubernetes，应选择支持外部数据库的商业版，或者改用已经具备成熟 API Key 管理能力的平台。

商业版生产拓扑应把 Admin 与 Public 分成不同 Deployment/Service；只为 Public 创建 Ingress，并只公开 self-revoke 和按需公开的 JWKS。Admin Service 必须通过 Gateway/mTLS/Service Mesh Policy 保护。OSS 在 Kubernetes 上主要用于单副本验证，直接运行 `talos serve` 更符合 SQLite 的限制。商业 Chart 的仓库地址、镜像凭证和具体 values 属于商业交付内容，不在公开的 Ory Helm 仓库中。

## 10. 总结

Talos 的核心价值不是“生成一段随机字符串”，而是集中管理机器凭证的生命周期，并允许把长期 Key 降权成短期 Token。架构选择前必须先确认两个约束：Admin API 没有内置认证；当前 OSS 只支持 SQLite 单节点能力。

参考：[Talos 官方文档](https://www.ory.com/docs/talos)、本地 `docs/concepts`、`docs/operate`、`api/talos/v2alpha1/talos.proto` 与 `spec/config.schema.json`。
