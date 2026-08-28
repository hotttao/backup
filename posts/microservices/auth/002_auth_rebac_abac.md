---
weight: 2
title: "2 ReBAC 与 ABAC：使用 OpenFGA 和 OPA 实现细粒度授权"
date: 2026-08-28T09:00:00+08:00
lastmod: 2026-08-28T09:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "通过企业文档 SaaS，理解 Ory Kratos、OpenFGA 和 OPA 的职责边界"
featuredImage:

tags: ["auth", "rebac", "abac", "ory-kratos", "openfga", "opa"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

上一篇使用 Keycloak RBAC 回答了“组织管理员能否修改抓取配置”。但企业文档系统还会遇到两类 RBAC 难以表达的问题：

```text
Alice 能否编辑 document:doc-001？

即使有编辑权限，文档锁定、用户高风险或当前不在工作时间时，这一次请求是否仍然允许？
```

第一类问题依赖主体与具体资源之间的关系，适合 ReBAC；第二类问题依赖主体、资源和环境属性，适合 ABAC。

本文使用一个企业文档 SaaS 场景，说明 Kratos、OpenFGA 和 OPA 如何协作：

> Kratos 确认主体；OpenFGA 计算主体与资源的关系；OPA 根据本次请求的上下文执行最终策略；业务服务负责收集可信数据并落实决策。

<!-- more -->

## 1. Keycloak 与 Ory 怎么选

Keycloak 把身份、OAuth2/OIDC 和 RBAC 放在一个系统中；Ory 将身份与协议服务拆开：

```text
Keycloak = 身份与 Session + OAuth2/OIDC + Group/Role

Ory Kratos = 身份与 Session
Ory Hydra  = OAuth2/OIDC Client 与 Token
```

| 能力 | Keycloak | Kratos | Hydra |
| --- | --- | --- | --- |
| 用户、凭证、MFA、Session | 支持 | 支持 | 不负责 |
| OAuth2/OIDC Client 与 Token | 支持 | 不支持 | 支持 |
| Group、Realm Role、Client Role | 支持 | 不支持 | 不支持 |
| 稳定主体 | Token 的 `sub` | Session 的 `identity.id` | 接收登录系统提供的 Subject |

文档系统不需要依靠 RBAC 表达权限，也不需要向第三方 Client 签发 Token。它真正需要的是：

```text
Kratos：用户是谁
OpenFGA：用户和文档有什么关系
OPA：当前条件是否允许操作
```

因此本文只使用 Kratos，不引入 Hydra；文档的 owner、editor、viewer 全部由 OpenFGA 表达。

## 2. Ory + OpenFGA 如何表达组织级权限

先补上上一篇文章中的组织场景：

```text
组织 G 有两名用户：

Alice：管理员
Bob：普通成员

普通成员可以：
- 启动抓取任务
- 查看抓取内容

管理员还可以：
- 修改抓取关键词
```

在 Keycloak 中，可以把 `admin`、`member` 建模为 Role。在本文架构中，Kratos 不负责 Role；它只提供 Alice 和 Bob 的稳定 `identity.id`，组织职责和权限推导全部由 OpenFGA 完成。

### 2.1 Kratos 只提供主体

```text
Alice identity.id = 1cf8a6f2-8c2a-4ac7-9e52-d40e91b45f31
Bob   identity.id = 9f425a8d-7efc-4768-8f23-7647a74fdf13
```

认证成功后，业务服务把它们转换成 OpenFGA User：

```text
user:1cf8a6f2-8c2a-4ac7-9e52-d40e91b45f31
user:9f425a8d-7efc-4768-8f23-7647a74fdf13
```

Kratos Identity 中不需要保存 `admin` 或 `member`。否则角色会同时存在于 Kratos 和 OpenFGA，后续很难判断哪一份数据才是授权依据。

### 2.2 OpenFGA Model

```fga
model
  schema 1.1

type user

type organization
  relations
    define admin: [user]
    define member: [user] or admin

    define can_start_crawl: member
    define can_view_crawl_content: member
    define can_modify_crawl_keywords: admin
```

这个模型表达了两层含义：

```text
职责关系：
Alice --admin--> organization:g
Bob   --member--> organization:g

权限推导：
member → can_start_crawl、can_view_crawl_content
admin  → member → 普通成员权限
admin  → can_modify_crawl_keywords
```

`can_start_crawl` 等名称可以理解为权限；在 OpenFGA Model 中，它们仍然是根据其他 Relation 计算出来的 Relation。

### 2.3 Relationship Tuple

实际只需要写入两个职责事实：

```jsonc
[
  {
    "user": "user:1cf8a6f2-8c2a-4ac7-9e52-d40e91b45f31", // Alice
    "relation": "admin", // 组织管理员
    "object": "organization:g" // 组织 G
  },
  {
    "user": "user:9f425a8d-7efc-4768-8f23-7647a74fdf13", // Bob
    "relation": "member", // 普通成员
    "object": "organization:g" // 组织 G
  }
]
```

不需要为每一项权限再给 Alice、Bob 写 Tuple。`can_*` 由 Authorization Model 根据 `admin`、`member` 自动推导。

### 2.4 API 如何映射到 OpenFGA Check

Crawl Service 负责把 API 映射成 OpenFGA Relation：

| API | OpenFGA Relation | Object |
| --- | --- | --- |
| `POST /organizations/g/crawl-tasks` | `can_start_crawl` | `organization:g` |
| `GET /organizations/g/crawl-contents` | `can_view_crawl_content` | `organization:g` |
| `PUT /organizations/g/crawl-keywords` | `can_modify_crawl_keywords` | `organization:g` |

三次检查的结果是：

```text
Check(Bob, can_start_crawl, organization:g)
→ true：Bob 是 member

Check(Bob, can_modify_crawl_keywords, organization:g)
→ false：Bob 不是 admin

Check(Alice, can_modify_crawl_keywords, organization:g)
→ true：Alice 是 admin
```

以 Alice 修改抓取关键词为例，完整链路是：

```text
1. Alice 携带 Kratos Session 请求 Crawl Service
2. Gateway / Oathkeeper 验证 Session，得到 Alice 的 identity.id
3. Crawl Service 根据 PUT API 映射出 can_modify_crawl_keywords
4. OpenFGA Check(user:1cf8a6f2-8c2a-4ac7-9e52-d40e91b45f31, can_modify_crawl_keywords, organization:g)
5. allowed=true，Crawl Service 执行修改
```

如果 Bob 调用相同 API，第 4 步返回 `false`，Crawl Service 返回 `403 Forbidden`。

这个场景只有稳定的职责关系，OpenFGA 已经足够。只有增加“高风险管理员不能修改”“仅工作时间允许修改”等动态条件时，才需要把 OpenFGA 结果与请求上下文交给 OPA。

## 3. 为什么文档权限不是 RBAC

RBAC 根据角色授权，适合表达“平台管理员可以进入管理后台”。文档权限针对具体资源：

```text
Bob 是 Team A 的成员
Team A 可以编辑 Project A 文件夹
doc-001 位于 Project A 文件夹中
```

要判断 Bob 能否编辑 `doc-001`，系统需要沿“成员—团队—文件夹—文档”关系计算。这是 ReBAC，而不是给 Bob 创建一个 `doc-001-editor` Role。

获得 editor 关系也不代表本次请求一定允许。文档可能已锁定，用户可能处于高风险状态，请求也可能发生在禁止编辑的时间。这些随请求变化的条件由 ABAC 判断。

```text
ReBAC：主体与资源之间是否存在权限关系
ABAC：当前主体、资源和环境是否满足策略
```

## 4. 文档示例与三个组件的边界

系统中的资源关系为：

```text
Organization acme
├── Team A
│   └── member: Bob
└── Folder Project A
    ├── editor: Team A
    └── Document doc-001
```

现在 Bob 在 14:00 请求编辑未锁定的 `doc-001`，并且风控等级为 low。完整判断分成三步：

```text
1. Kratos
   Session 是否有效？主体是不是 Bob？
   → identity.id = 9f425a8d-7efc-4768-8f23-7647a74fdf13

2. OpenFGA
   Bob 是 Team A 成员，Team A 是 Project A 的 editor，
   doc-001 继承 Project A 的权限。
   → Bob 是 doc-001 的 editor

3. OPA
   editor=true、locked=false、risk=low、hour=14。
   → allow=true
```

三个组件只保存自己负责的事实：

| 组件 | 保存或接收的数据 | 不负责 |
| --- | --- | --- |
| Kratos | Identity、Credential、Session | 文档 owner/editor/viewer |
| OpenFGA | 团队成员、分享、资源继承关系 | 密码、Session、文档锁定和风险状态 |
| OPA | Rego Policy 和本次请求的可信 Input | 长期保存用户、文档和关系主数据 |

Document Service 是决策执行点：它验证 Session，读取文档状态，调用 OpenFGA 和 OPA，最后执行编辑或返回拒绝。客户端提交的 `locked=false`、`risk=low` 等字段不能作为授权事实。

## 5. Kratos：提供稳定主体

Kratos 的核心对象是 Identity 和 Session。Identity 的 `id` 在创建时生成且不可修改；浏览器登录后携带 Session Cookie，服务端通过 `/sessions/whoami` 检查会话并取得 Identity。

下面只保留授权链路关心的字段：

```jsonc
{
  "active": true, // Session 当前有效
  "expires_at": "2026-08-28T18:00:00+08:00", // Session 过期时间
  "identity": {
    "id": "9f425a8d-7efc-4768-8f23-7647a74fdf13", // 不可变的 Kratos Identity ID
    "state": "active", // Identity 可用于登录
    "traits": {
      "email": "bob@example.com" // 可修改的业务资料，不作为授权主体 ID
    }
  }
}
```

`identity.id` 是 Kratos 原生的稳定身份标识。Kratos 没有内置 Role；本文也不需要把文档权限转换成 Role。

OpenFGA 直接复用 Identity ID，并增加对象类型前缀：

```text
Kratos identity.id = 9f425a8d-7efc-4768-8f23-7647a74fdf13
                   ↓ 加类型前缀
OpenFGA user = user:9f425a8d-7efc-4768-8f23-7647a74fdf13
```

Kratos Session 中没有 OAuth/OIDC Access Token 的 `sub` Claim。本文使用的授权主体就是 `identity.id`。如果系统必须对外签发 Access Token，才需要额外引入 Hydra 或 Session-to-JWT，并明确把 `identity.id` 映射为 `sub`；这不属于 Kratos 本身的能力。

不要使用 email 或 username 作为 Tuple 中的 User，它们可能变化，也会泄露个人信息。

Kratos 在本文中不保存：

```text
Bob 是 doc-001 的 owner
Team A 可以编辑 Folder Project A
doc-001 当前被锁定
Bob 当前被风控标记为高风险
```

这些分别属于关系授权、业务数据和风控数据。

## 6. OpenFGA：保存关系并沿图计算

OpenFGA 的核心只有两类数据：

```text
Authorization Model
= 定义有哪些对象类型、关系以及关系如何继承

Relationship Tuple
= 记录当前真实存在的关系
```

Tuple 结构是：

```text
(user, relation, object)
```

例如：

```text
(user:9f425a8d-7efc-4768-8f23-7647a74fdf13, member, group:team-a)
(group:team-a#member, editor, folder:project-a)
(folder:project-a, parent, document:doc-001)
```

Tuple 中的 `user` 不一定是自然人，也可以是团队成员集合或父对象。

### 6.1 Authorization Model

下面的模型只聚焦团队、文件夹和文档继承；生产模型还应把 Organization 边界显式建模并测试，不能仅依赖对象 ID 的命名约定。

```fga
model
  schema 1.1

type user

type group
  relations
    define member: [user]

type folder
  relations
    define owner: [user]
    define editor: [user, group#member] or owner
    define viewer: [user, group#member] or editor

type document
  relations
    define parent: [folder]
    define owner: [user]
    define editor: [user, group#member] or owner or editor from parent
    define viewer: [user, group#member] or editor or viewer from parent
```

模型表达了三种计算规则：

```text
owner -> editor -> viewer

group#member
表示整个团队成员集合可以成为 editor / viewer

editor from parent
表示文档继承父文件夹的 editor
```

### 6.2 Relationship Tuple

本文写入：

```jsonc
[
  {
    "user": "user:9f425a8d-7efc-4768-8f23-7647a74fdf13", // Bob 的 Kratos Identity ID
    "relation": "member",      // 是成员
    "object": "group:team-a"   // Team A
  },
  {
    "user": "group:team-a#member", // Team A 的全部成员
    "relation": "editor",           // 可以编辑
    "object": "folder:project-a"    // Project A 文件夹
  },
  {
    "user": "folder:project-a",   // 父文件夹
    "relation": "parent",         // 是父级
    "object": "document:doc-001"  // doc-001
  }
]
```

OpenFGA 执行：

```text
Check(
  user     = user:9f425a8d-7efc-4768-8f23-7647a74fdf13,
  relation = editor,
  object   = document:doc-001
)
```

计算路径：

```text
user:9f425a8d-7efc-4768-8f23-7647a74fdf13
  ↓ member
group:team-a#member
  ↓ editor
folder:project-a
  ↓ editor from parent
document:doc-001

allowed = true
```

### 6.3 查询能力

OpenFGA 围绕同一关系模型提供不同查询：

| API | 问题 |
| --- | --- |
| `Check` | Bob 能否编辑 `doc-001`？ |
| `ListObjects` | Bob 能编辑哪些文档？ |
| `ListUsers` | 哪些用户能查看 `doc-001`？ |

OPA 在拥有相同关系数据时也可以计算规则，但 OpenFGA 专门保存和遍历关系图，并为这些查询提供标准 API。

## 7. OPA：根据请求上下文执行 ABAC

OPA 的计算模型是：

```text
decision = policy(input, data)
```

- `input` 是当前请求的结构化数据；
- `data` 是 OPA 已加载的只读数据；
- `policy` 是 Rego 规则；
- 输出可以是布尔值，也可以是包含原因的结构化决策。

OPA 不应成为文档或用户的主数据库。变化频繁的资源状态通常由业务服务在请求时作为 `input` 提供；变化较慢的数据可以通过 Bundle 等方式复制为 `data`。

### 7.1 本次请求的 Input

文档服务从可信来源收集数据：

```jsonc
{
  "subject": {
    "id": "9f425a8d-7efc-4768-8f23-7647a74fdf13", // 来自有效 Session 的 identity.id
    "risk_level": "low" // 来自风控服务，不信任客户端输入
  },
  "action": "edit",     // 根据当前 API 映射得到
  "resource": {
    "type": "document",
    "id": "doc-001",
    "locked": false      // 来自 Document DB
  },
  "environment": {
    "hour": 14           // 服务端按统一业务时区计算
  },
  "relation_allowed": true // OpenFGA Check 的结果
}
```

动态风险状态不应写入 Identity 元数据。它会频繁变化，应在请求时从风控服务读取。

### 7.2 Rego Policy

```rego
package document.authz

import rego.v1

default allow := false

# 查看只要求关系鉴权通过，锁定状态不影响读取。
allow if {
    input.action == "view"
    input.relation_allowed
    input.subject.risk_level != "high"
}

# 编辑需要同时满足关系、资源、风险和时间约束。
allow if {
    input.action == "edit"
    input.relation_allowed
    not input.resource.locked
    input.subject.risk_level != "high"
    input.environment.hour >= 9
    input.environment.hour < 19
}
```

`default allow := false` 表示未明确允许的请求一律拒绝。缺少字段、Action 未覆盖或规则未命中时，不会意外放行。

## 8. 一次编辑请求的完整链路

Bob 请求编辑 `doc-001`：

```text
Client
  ↓ Kratos Session Cookie + PUT /documents/doc-001
Gateway / Document Service
  ↓ 调用 /sessions/whoami，确认 active=true
  ↓ 取得 identity.id=9f425a8d-7efc-4768-8f23-7647a74fdf13
Document DB
  ↓ 读取 organization_id、locked 等可信资源属性
Risk Service
  ↓ 获取当前风险等级
OpenFGA
  ↓ Check(user:9f425a8d-7efc-4768-8f23-7647a74fdf13, editor, document:doc-001)
  ↓ relation_allowed=true / false
OPA
  ↓ 评估 subject + action + resource + environment + relation_allowed
  ↓ allow=true / false
Document Service
  ↓ 执行编辑或拒绝
```

按步骤拆解：

1. Session 缺失、过期或无效时返回 `401 Unauthorized`，不继续授权；
2. 文档服务加载资源，先确认文档属于当前租户；
3. OpenFGA 判断关系上是否具有 `editor`；
4. 文档服务将 OpenFGA 结果与实时上下文一起发送给 OPA；
5. OPA 返回最终决策；
6. `allow=false` 返回 `403 Forbidden`；授权依赖不可用时应失败关闭，并以 `503` 区分系统故障。

对象级授权放在 Document Service 更合适，因为 Gateway 通常不知道文档所属组织、锁定状态和业务 Action。

## 9. 数据写入与一致性

读取权限之前，必须先明确谁负责写入关系。

| 业务事件 | 业务数据 | OpenFGA Tuple |
| --- | --- | --- |
| Bob 加入 Team A | Team Membership | `user:9f425a8d-7efc-4768-8f23-7647a74fdf13 member group:team-a` |
| Team A 获得文件夹编辑权 | Share Record | `group:team-a#member editor folder:project-a` |
| doc-001 放入文件夹 | Document Parent | `folder:project-a parent document:doc-001` |
| Bob 取消分享 | Share Record 删除 | 删除对应 Tuple |

业务数据库和 OpenFGA 不能加入同一个本地事务。常用做法是：

```text
业务事务
  ├── 更新业务表
  └── 写 Outbox Event
          ↓
异步消费者幂等写入 / 删除 OpenFGA Tuple
```

需要“分享后立即可见”或“撤权后立即生效”时，要为同步窗口设计明确语义。OpenFGA 查询支持一致性选项；刚写入 Tuple 后的关键检查可以选择更高一致性，但会牺牲延迟和吞吐。

调用 `Check`、`ListObjects`、`ListUsers` 和写 Tuple 时，应显式指定 Authorization Model ID，避免模型升级期间行为漂移。

## 10. 用测试矩阵验证职责边界

| 场景 | OpenFGA | OPA | 最终结果 |
| --- | --- | --- | --- |
| Bob 不是 editor | `false` | 默认拒绝 | `403` |
| Bob 是 editor，14:00，文档未锁定 | `true` | 允许 | 编辑成功 |
| Bob 是 editor，21:00 | `true` | 时间规则拒绝 | `403` |
| Bob 是 editor，文档已锁定 | `true` | 资源状态拒绝 | `403` |
| Bob 是 editor，但风险为 high | `true` | 风险规则拒绝 | `403` |
| Session 无效或过期 | 不调用 | 不调用 | `401` |

OpenFGA Model 和 Rego Policy 都应作为代码进行版本管理和自动化测试。至少覆盖每一种 Relation、继承路径、拒绝条件和缺失字段。

## 11. 总结

企业文档场景的最终模型是：

```text
Ory Kratos
回答：会话是否有效？对应哪个稳定 Identity？

OpenFGA
回答：主体与目标资源之间是否存在 editor / viewer 等关系？

OPA
回答：结合关系结果、资源状态、风险和环境，这次请求是否允许？

Document Service
负责：收集可信事实并执行最终决策。
```

用一个公式表示：

```text
Final Allow
= Identity Valid
 ∧ Relationship Allowed
 ∧ Context Policy Allowed
```

身份、关系、策略和执行点各自有清晰的数据所有权，才是这套组合真正的价值。

## 参考资料

- [Keycloak Server Administration Guide](https://www.keycloak.org/docs/latest/server_admin/)
- [Ory Kratos Identity Model](https://www.ory.com/docs/kratos/manage-identities/overview)
- [Ory Kratos Session Management](https://www.ory.com/docs/kratos/session-management/overview)
- [Ory Hydra](https://www.ory.com/hydra)
- [OpenFGA Concepts](https://openfga.dev/docs/concepts)
- [OpenFGA Modeling Guide](https://openfga.dev/docs/modeling/getting-started)
- [OpenFGA Relationship Queries](https://openfga.dev/docs/interacting/relationship-queries)
- [OpenFGA Consistency](https://openfga.dev/docs/interacting/consistency)
- [OPA Documentation](https://www.openpolicyagent.org/docs)
- [OPA External Data](https://www.openpolicyagent.org/docs/external-data)
- [OPA Policy Language](https://www.openpolicyagent.org/docs/policy-language)
