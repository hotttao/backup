---
weight: 1
title: "1 RBAC：Keycloak 数据模型与角色计算"
date: 2026-08-28T08:00:00+08:00
lastmod: 2026-08-28T08:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "从数据库存储、角色计算到 Access Token，理解 Keycloak 如何实现 RBAC"
featuredImage:

tags: ["auth", "rbac", "keycloak"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

这一节我们将通过 Keycloak 这个组件去理解认证鉴权里的 RBAC。

下面是一个典型的业务场景，这个业务场景会贯穿我们整个系列：

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

先给出结论：

> Keycloak 保存 User、Group、Role 和 Client 之间的关系。生成 Access Token 时，先计算用户真正拥有的角色，再根据当前应用可见的角色范围进行裁剪，最后把结果写入 Token。Gateway 和业务服务负责执行 Allow/Deny。

<!-- more -->

## 1. 先明确 Web 系统中的对象

```text
Alice
  ↓ 操作
Browser
  ↓ 访问
运营控制台 operations-console
  ↓
Gateway
  ├── crawler-service：创建抓取任务、修改关键词
  └── content-service：查询抓取内容
```

它们与 Keycloak 对象的对应关系是：

| 系统对象 | Keycloak 对象 | 含义 |
| --- | --- | --- |
| Alice | User | 被认证和授权的人 |
| Browser | 无 | Browser 是 User Agent，不是 Keycloak Client |
| `operations-console` | Client | 代表运营控制台应用 |
| `crawler-service` | Client | 代表抓取服务及其角色命名空间 |
| `content-service` | Client | 代表内容服务及其角色命名空间 |

> Keycloak Client 不是“浏览器客户端”。它是 Keycloak 对一个应用或服务的逻辑登记，用来承载该应用的角色命名空间和 Token 输出规则。

本文只讨论 RBAC，不展开登录流程。

### 1.1 Client 有两个不同的 ID

创建 Client 时，管理员填写一个可读的 `client_id`；Keycloak 入库时再生成内部主键：

```text
CLIENT
ID          REALM_ID   CLIENT_ID
----------  ---------  ------------------
client-web  realm-001  operations-console
client-cr   realm-001  crawler-service
client-ct   realm-001  content-service
```

两者用途不同：

| 标识 | 谁定义 | 用在哪里 |
| --- | --- | --- |
| `CLIENT.CLIENT_ID` | 管理员定义，例如 `operations-console` | 应用配置、请求参数、Token Claim 等外部语义 |
| `CLIENT.ID` | Keycloak 生成，例如 `client-web` | Keycloak 数据库表之间的内部关联 |

`CLIENT_ID` 在同一个 Realm 内唯一，因此完整查找条件是：

```text
REALM_ID = realm-001
CLIENT_ID = operations-console
```

### 1.2 当前 Client 是怎么传到角色计算中的

每次 Keycloak 生成 Token 时，请求上下文必须标识“正在为哪个 Client 生成 Token”。常见形式是传入逻辑 `client_id`，具体登录方式不影响后面的 RBAC 计算：

```text
Token 生成请求上下文
realm     = media-platform
client_id = operations-console
```

Keycloak 的处理过程是：

```text
收到 client_id = operations-console
        ↓
在 media-platform Realm 查询 CLIENT
        ↓
找到 CLIENT.CLIENT_ID = operations-console
        ↓
得到内部 CLIENT.ID = client-web
        ↓
将 client-web 对应的 ClientModel 传给角色计算逻辑
        ↓
查询 client-web 的 FULL_SCOPE_ALLOWED 和 SCOPE_MAPPING
```

所以后文的“当前 Client”指 `operations-console`，而查询 `SCOPE_MAPPING` 时使用的是它的内部主键 `client-web`。

## 2. Keycloak 的整体数据模型

```text
Realm
│
├── User
│   ├── Credential
│   ├── Group Membership
│   ├── Direct Role Mapping
│   └── Session
│
├── Group
│   ├── Subgroup
│   └── Role Mapping
│
├── Role
│   ├── Realm Role
│   ├── Client Role
│   └── Composite Role
│
└── Client
    ├── Client Role
    ├── Role Scope Mapping
    └── Protocol Mapper
```

核心关系只有四条：

```text
User --属于--> Group
User / Group --分配--> Role
Role --组合--> Role
Client --定义--> Client Role 和 Token 输出规则
```


## 3. Realm、User 与 Credential

### 3.1 Realm：所属边界

`REALM`：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `ID` | `VARCHAR(36)` | Realm 主键 |
| `NAME` | `VARCHAR` | Realm 名称 |
| `ENABLED` | `BOOLEAN` | Realm 是否启用 |

用户、组、角色和 Client 都通过 `REALM_ID` 归属于某个 Realm。Realm 是身份和角色的隔离边界，不应机械地等同于业务租户。

### 3.2 User：RBAC 主体

`USER_ENTITY`：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `ID` | `VARCHAR(36)` | User 主键，对应 Token 中稳定的 `sub` |
| `REALM_ID` | `VARCHAR(36)` | 所属 Realm |
| `USERNAME` | `VARCHAR` | 用户名 |
| `ENABLED` | `BOOLEAN` | 用户是否可用 |

授权关系应关联 User ID，而不是可能修改的 username 或 email。

### 3.3 Credential：如何证明身份

`CREDENTIAL` 通过 `USER_ID` 关联 User，保存凭证类型及密钥数据。它决定“当前操作者是不是 Alice”，不决定“Alice 能做什么”，因此本文不继续展开其字段。

## 4. Group：批量给用户分配角色

`KEYCLOAK_GROUP`：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `ID` | `VARCHAR(36)` | Group 主键 |
| `REALM_ID` | `VARCHAR(36)` | 所属 Realm |
| `NAME` | `VARCHAR` | Group 名称 |
| `PARENT_GROUP` | `VARCHAR(36)` | 父 Group；顶层组为空 |

User 和 Group 是多对多关系，存放在 `USER_GROUP_MEMBERSHIP`：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `USER_ID` | `VARCHAR(36)` | User ID，联合主键之一 |
| `GROUP_ID` | `VARCHAR(36)` | Group ID，联合主键之一 |

用户属于子组时，会继承该子组及父组的 Role Mapping。

## 5. Realm Role 与 Client Role

两种 Role 都存放在 `KEYCLOAK_ROLE`：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `ID` | `VARCHAR(36)` | Role 主键 |
| `NAME` | `VARCHAR` | Role 名称 |
| `REALM_ID` | `VARCHAR(36)` | 所属 Realm |
| `CLIENT_ROLE` | `BOOLEAN` | `false` 为 Realm Role，`true` 为 Client Role |
| `CLIENT` | `VARCHAR` | Client Role 所属的 `CLIENT.ID`；Realm Role 为空 |

底层区别就是：

```text
Realm Role:
CLIENT_ROLE = false
CLIENT      = NULL

Client Role:
CLIENT_ROLE = true
CLIENT      = 某个 CLIENT.ID
```

### 5.1 Realm Role

假设 `media-platform` Realm 中有三个系统：

```text
运营控制台 operations-console
抓取服务   crawler-service
内容服务   content-service
```

Alice 在整个自媒体平台中都是组织 G 的成员，同时还是组织管理员。这两个身份不属于某一个具体服务：以后新增报表服务，它们仍然成立。

因此可以定义为 Realm Role：

```text
organization-operator
organization-admin
```

数据记录类似：

```text
KEYCLOAK_ROLE
ID           NAME                 CLIENT_ROLE  CLIENT
-----------  -------------------  -----------  ------
role-operator organization-operator false        NULL
role-admin   organization-admin   false        NULL
```

Realm Role 的关键不是“权限更大”，而是：

> 它属于 Realm 的全局角色命名空间，不归任何一个 Client 所有。

所以 Realm 中不能再创建第二个同名的 `organization-admin`。默认情况下，它们写入 Token 的公共角色区域：

```text
realm_access.roles = [
  "organization-operator",
  "organization-admin"
]
```

抓取服务、内容服务或以后新增的服务，都可以在业务需要时判断这些 Realm Role。但 Realm Role 出现在 Token 中，并不代表所有服务必须接受它，也不代表它会自动放行任何 API；最终语义仍由服务的授权规则决定。

### 5.2 Client Role

现在看具体操作权限：

```text
启动抓取任务 只对 crawler-service 有意义
修改抓取关键词 只对 crawler-service 有意义
查看抓取内容 只对 content-service 有意义
```

因此分别创建 Client Role：

```text
crawler-service
├── task.start
└── keyword.update

content-service
└── content.read
```

底层记录通过 `CLIENT` 列指向所属 Client：

```text
KEYCLOAK_ROLE
ID            NAME            CLIENT_ROLE  CLIENT
------------  --------------  -----------  -----------
role-start    task.start      true         client-cr
role-keyword  keyword.update  true         client-cr
role-read     content.read    true         client-ct
```

Client Role 的关键是：

> 它的完整身份是“所属 Client + Role 名称”，而不只是 Role 名称。

例如抓取服务和内容服务都可以定义 `viewer`：

```text
crawler-service:viewer
content-service:viewer
```

这两个 Role 不冲突，也不是同一个权限。前者只能由抓取服务解释，后者只能由内容服务解释。

默认情况下，Client Role 按所属 Client 分组写入 Token：

```text
resource_access = {
  "crawler-service": {
    "roles": ["task.start", "keyword.update"]
  },
  "content-service": {
    "roles": ["content.read"]
  }
}
```

请求到达抓取服务时，它只读取：

```text
resource_access.crawler-service.roles
```

即使 Alice 拥有 `content-service:content.read`，这个角色对抓取服务也没有授权意义。

将两者放在同一个场景中对比：

| 问题 | 使用的 Role | 原因 |
| --- | --- | --- |
| Alice 是否是组织 G 的运营成员？ | Realm Role `organization-operator` | 这个身份跨多个服务成立 |
| Alice 是否是组织 G 的管理员？ | Realm Role `organization-admin` | 多个服务都可能使用这个业务身份 |
| Alice 能否启动抓取任务？ | Client Role `crawler-service:task.start` | 只属于抓取服务 |
| Alice 能否查看抓取内容？ | Client Role `content-service:content.read` | 只属于内容服务 |

可以用一个判断题决定选择：

```text
如果删除这个 Client，Role 是否仍然有业务意义？

有  → 更接近 Realm Role
没有 → 更接近该 Client 的 Client Role
```

### 5.3 如何选择

| 角色语义 | 选择 |
| --- | --- |
| 跨多个应用都表示同一种身份或职责 | Realm Role |
| 只对某个应用或服务有意义 | Client Role |
| 一个业务角色需要聚合多个服务权限 | Composite Realm Role 可以包含多个 Client Role |

本文用 Realm Role 表达跨服务业务角色，用 Client Role 表达各服务的权限原子。这是业务建模选择，不是 Keycloak 的强制规则。

## 6. Role Mapping 与 Composite Role

直接给 User 分配 Role：

```text
USER_ROLE_MAPPING(USER_ID, ROLE_ID)
```

给 Group 分配 Role：

```text
GROUP_ROLE_MAPPING(GROUP_ID, ROLE_ID)
```

本文通过 Group 分配业务角色：

```text
GROUP_ID  ROLE_ID
--------  -----------------
group-m   role-operator
group-a   role-admin
```

角色包含关系存放在：

```text
COMPOSITE_ROLE(COMPOSITE, CHILD_ROLE)
```

本文的组合关系：

```text
organization-operator（Realm Role）
├── platform-user（Realm Role）
├── crawler-service:task.start（Client Role）
└── content-service:content.read（Client Role）

organization-admin（Realm Role）
├── organization-operator（Realm Role）
└── crawler-service:keyword.update（Client Role）
```

Composite Role 可以同时包含 Realm Role 和 Client Role，Keycloak 会递归展开。

## 7. Client 与 Role Scope Mapping

`CLIENT` 只保留与本文相关的字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `ID` | `VARCHAR` | 数据库内部主键 |
| `REALM_ID` | `VARCHAR(36)` | 所属 Realm |
| `CLIENT_ID` | `VARCHAR` | 可读的逻辑名称，如 `crawler-service` |
| `FULL_SCOPE_ALLOWED` | `BOOLEAN` | 是否允许该 Client 看见用户的全部有效角色 |

`KEYCLOAK_ROLE.CLIENT` 保存内部 `CLIENT.ID`；Token 中 `resource_access` 使用可读的 `CLIENT.CLIENT_ID`。

这里要区分两个 Client：

```text
当前 Client
= 正在请求生成 Token 的应用
= operations-console / client-web

Role 所属 Client
= 定义某个 Client Role 的服务
= crawler-service / client-cr
```

`operations-console` 决定自己的 Token 能看见哪些角色；`crawler-service` 则是 `task.start` 这个 Client Role 的所有者。它们不是同一个 Client。

### 7.1 两个角色集合

用户是否拥有角色，与当前应用能否在 Token 中看到该角色，是两个问题：

```text
Effective Roles
= 用户通过直接分配、Group 和 Composite 真正拥有的全部角色

Scope-Permitted Roles
= 当前 Client 允许投射到 Token 的角色范围
```

最终：

```text
Token Roles = Effective Roles ∩ Scope-Permitted Roles
```

`Scope-Permitted Roles` 是本文为了讲解使用的集合名称，不是 Keycloak 中名为 Allowed Roles 的对象。

### 7.2 Role Scope Mapping 如何存储

直接配置在 Client 上的 Role Scope Mapping 存放在：

```text
SCOPE_MAPPING(CLIENT_ID, ROLE_ID)
```

虽然列名叫 `CLIENT_ID`，这里保存的是内部 `CLIENT.ID`，不是可读的 `CLIENT.CLIENT_ID`。

例如运营控制台只需要组织运营相关角色：

```text
CLIENT_ID  ROLE_ID
---------  ----------------
client-web role-admin
```

`role-admin` 是 Composite Role，所以它的子角色也进入允许范围。

如果 `FULL_SCOPE_ALLOWED=true`，Keycloak 不做角色范围裁剪，用户的全部有效角色都有资格进入 Token。关闭它并显式配置 Role Scope，更符合最小权限原则。

## 8. Session：当前认证状态

Session 不定义权限，只记录当前认证状态。在线 Session 主要存在于 Infinispan；需要持久化时，当前源码使用 `OFFLINE_USER_SESSION`，理解 RBAC 只需关注：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `USER_SESSION_ID` | `VARCHAR(36)` | Session ID |
| `REALM_ID` | `VARCHAR(36)` | 所属 Realm |
| `USER_ID` | `VARCHAR` | 所属 User |
| `DATA` | `TEXT` | Session 生命周期和状态等序列化数据 |

具体是缓存、持久化还是二者结合，取决于 Keycloak 版本和 Session 配置。

## 9. Protocol Mapper：决定写到哪个 Claim

Protocol Mapper 不分配角色，也不裁剪角色。它只把已经筛选完成的 Token Roles 写到指定 Claim。

`PROTOCOL_MAPPER` 的核心字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `ID` | `VARCHAR(36)` | Mapper 主键 |
| `PROTOCOL_MAPPER_NAME` | `VARCHAR` | Mapper 类型 |
| `CLIENT_ID` / `CLIENT_SCOPE_ID` | `VARCHAR` | Mapper 属于哪个 Client 或 Client Scope |

具体输出位置保存在 `PROTOCOL_MAPPER_CONFIG` 中。内置角色 Mapper 可以抽象为：

```text
Realm Role Mapper
claim.name = realm_access.roles

Client Role Mapper
claim.name = resource_access.${client_id}.roles
```

`${client_id}` 是每个 Client Role 所属的 `CLIENT.CLIENT_ID`。

### 9.1 用一组数据走完整个映射过程

假设前面的角色计算已经结束，得到以下 Token Roles：

| Role | `CLIENT_ROLE` | 所属 Client |
| --- | --- | --- |
| `organization-admin` | `false` | `NULL` |
| `organization-operator` | `false` | `NULL` |
| `task.start` | `true` | `crawler-service` |
| `keyword.update` | `true` | `crawler-service` |
| `content.read` | `true` | `content-service` |

注意：这一步已经决定了 Token 中可以出现哪些角色。Protocol Mapper 接收到的就是这组结果。

现在配置两个 Mapper：

```text
PROTOCOL_MAPPER
ID             PROTOCOL_MAPPER_NAME
-------------  ---------------------------------
mapper-realm   oidc-usermodel-realm-role-mapper
mapper-client  oidc-usermodel-client-role-mapper

PROTOCOL_MAPPER_CONFIG
PROTOCOL_MAPPER_ID  NAME        VALUE
------------------  ----------  ------------------------------------
mapper-realm        claim.name  realm_access.roles
mapper-client       claim.name  resource_access.${client_id}.roles
```

Realm Role Mapper 只处理 `CLIENT_ROLE=false` 的角色：

```text
输入：
organization-admin
organization-operator

输出位置：
realm_access.roles
```

Client Role Mapper 处理 `CLIENT_ROLE=true` 的角色，并根据所属 Client 分组：

```text
输入：
crawler-service:task.start
crawler-service:keyword.update
content-service:content.read

输出位置：
resource_access.crawler-service.roles
resource_access.content-service.roles
```

最终生成：

```jsonc
{
  "realm_access": { // 由 Realm Role Mapper 创建
    "roles": [
      "organization-admin",
      "organization-operator"
    ]
  },
  "resource_access": { // 由 Client Role Mapper 创建
    "crawler-service": { // ${client_id} 被替换为 crawler-service
      "roles": ["task.start", "keyword.update"]
    },
    "content-service": { // ${client_id} 被替换为 content-service
      "roles": ["content.read"]
    }
  }
}
```

所以 Protocol Mapper 做的是数据格式转换：

```text
Role 对象集合
    ↓ 按 Realm Role / Client Role 分类
    ↓ 按 claim.name 组装 JSON 路径
Token Claim
```

即使把 `claim.name` 改成其他路径，Alice 拥有的角色也不会变化；改变的只是角色在 Token 中的存放位置，读取 Token 的服务也必须同步修改取值路径。

三步必须分开理解：

```text
Role Mapping
回答：用户拥有什么角色？

Role Scope Mapping
回答：当前应用的 Token 可以看见哪些角色？

Protocol Mapper
回答：筛选后的角色写入哪个 Claim？
```

## 10. 完整计算一次 Alice 的角色

假设 Alice 除了组织管理员，还拥有与运营控制台无关的财务权限：

```text
Alice
├── Group: /organizations/G/admins
│   └── Realm Role: organization-admin
└── Direct Role: finance-admin
    └── Client Role: billing-service:invoice.refund
```

### 10.1 先确定当前 Client

这次是运营控制台请求生成 Token，请求上下文携带：

```text
client_id = operations-console
```

Keycloak 在当前 Realm 中找到：

```text
CLIENT.CLIENT_ID = operations-console
CLIENT.ID        = client-web
```

后续 Scope 计算因此读取：

```text
CLIENT.ID = client-web 的 FULL_SCOPE_ALLOWED
SCOPE_MAPPING.CLIENT_ID = client-web 的所有记录
```

### 10.2 Effective Roles

Keycloak 合并直接 Role、Group Role，再递归展开 Composite Role：

```text
Effective Roles =

Realm Roles:
- organization-admin
- organization-operator
- platform-user
- finance-admin

Client Roles:
- crawler-service:task.start
- crawler-service:keyword.update
- content-service:content.read
- billing-service:invoice.refund
```

### 10.3 Scope-Permitted Roles

`operations-console` 设置：

```text
FULL_SCOPE_ALLOWED = false
SCOPE_MAPPING      = organization-admin
```

展开 `organization-admin` 后，允许范围是：

```text
- organization-admin
- organization-operator
- platform-user
- crawler-service:task.start
- crawler-service:keyword.update
- content-service:content.read
```

### 10.4 Token Roles

```text
Token Roles
= Effective Roles
 ∩ Scope-Permitted Roles
```

财务角色被排除，因为它与运营控制台无关。剩余角色交给 Protocol Mapper 输出。

## 11. Access Token

JWT 由 Header、Payload 和 Signature 三部分组成：

```text
base64url(header).base64url(payload).signature
```

下面用 `jsonc` 添加教学注释，真实 Token 中不包含这些注释。

### 11.1 Header

```jsonc
{
  "alg": "RS256",  // 签名算法；服务端只能接受预先允许的算法
  "typ": "JWT",    // JWT 封装类型
  "kid": "KcX..." // 密钥 ID；用它从 Realm JWKS 中选择公钥
}
```

### 11.2 Payload

```jsonc
{
  "exp": 1787880000, // 过期时间；达到该时间后必须拒绝
  "iat": 1787879700, // 签发时间
  "jti": "c35c...", // 当前 JWT 的唯一 ID

  "iss": "https://auth.example.com/realms/media-platform", // 签发 Token 的 Realm
  "aud": ["crawler-service", "content-service"],           // 允许接收 Token 的服务
  "sub": "user-alice",                                     // Token 代表的 User ID
  "typ": "Bearer",                                         // Payload 中的 Token 类型
  "sid": "session-a71e",                                   // 关联的 User Session ID

  "realm_access": { // Realm Role Mapper 创建的容器
    "roles": [      // 筛选后写入 Token 的 Realm Role
      "organization-admin",    // 组织管理员
      "organization-operator", // 继承的组织运营角色
      "platform-user"           // 继承的平台基础角色
    ]
  },

  "resource_access": { // Client Role Mapper 创建的容器
    "crawler-service": { // Client Role 所属的 Client ID
      "roles": [          // 对抓取服务的权限
        "task.start",     // 启动抓取任务
        "keyword.update"  // 修改抓取关键词
      ]
    },
    "content-service": { // Client Role 所属的 Client ID
      "roles": [         // 对内容服务的权限
        "content.read"   // 查看抓取内容
      ]
    }
  }
}
```

资源服务验证签名后，必须校验：

```text
iss：是否由可信 Realm 签发
aud：当前服务是否是 Token 的受众
exp / nbf：Token 当前是否有效
sub：当前用户的稳定 ID
resource_access.<当前服务>.roles：是否包含接口所需权限
```

## 12. Gateway 与服务如何执行授权

```text
1. 读取 Authorization: Bearer <access-token>
2. 根据 kid 从缓存的 JWKS 中选择公钥
3. 验证签名和允许的 alg
4. 校验 iss、aud、exp，存在时校验 nbf
5. 读取当前服务在 resource_access 下的 roles
6. 判断是否包含接口要求的权限
```

| 服务 | API | 所需权限 |
| --- | --- | --- |
| `crawler-service` | `POST /crawler/tasks` | `task.start` |
| `crawler-service` | `PUT /crawler/keywords` | `keyword.update` |
| `content-service` | `GET /crawler/contents` | `content.read` |

- Token 缺失、无效或过期：`401 Unauthorized`；
- Token 有效但缺少权限：`403 Forbidden`。

Access Token 是角色快照。用户被移出 Group 后，已经签发的 Token 通常仍可使用到过期，因此 Access Token 应保持较短生命周期。

## 13. RBAC 的边界

RBAC 适合回答“管理员能否修改抓取配置”，不适合回答：

```text
Alice 能否修改组织 G 的 task-123？
Alice 能否查看 Bob 单独分享给她的内容？
当前时间、IP、设备风险是否允许这次操作？
```

前两类问题适合 ReBAC，最后一类适合 ABAC。不要为每个组织、项目或资源创建 Keycloak Role，否则会产生 Role Explosion。

## 14. 总结

从存储到执行，完整链路是：

```text
USER_ENTITY
  ↓ USER_GROUP_MEMBERSHIP
KEYCLOAK_GROUP
  ↓ GROUP_ROLE_MAPPING
KEYCLOAK_ROLE
  ↓ COMPOSITE_ROLE 递归展开
Effective Roles
  ↓ 与 SCOPE_MAPPING 求交集
Token Roles
  ↓ PROTOCOL_MAPPER
realm_access / resource_access
  ↓ Gateway / Service
Allow / Deny
```

最重要的区别是：

```text
Realm Role：Realm 全局角色命名空间
Client Role：某个应用或服务自己的角色命名空间
Effective Roles：用户真正拥有的全部角色
Scope-Permitted Roles：当前应用允许投射到 Token 的角色范围
Protocol Mapper：决定筛选后的角色写入哪个 Claim
```

这五个概念区分清楚以后，Keycloak 的数据库关系、角色配置和 Token 内容就能一一对应起来。

## 参考资料

- [Keycloak Server Administration Guide](https://www.keycloak.org/docs/latest/server_admin/)
- [Keycloak Admin REST API](https://www.keycloak.org/docs-api/latest/rest-api/index.html)
