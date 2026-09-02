---
weight: 5
title: "5 Ory Keto：关系权限服务"
date: 2026-08-29T16:00:00+08:00
lastmod: 2026-08-30T16:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "从关系元组、OPL、API、存储和部署理解 Ory Keto"
tags: ["auth", "ory", "keto", "rebac"]
categories: ["microservice"]
toc:
  auto: false
---

Kratos 回答“调用者是谁”，Keto 回答“这个调用者能否对这个资源执行某个动作”。Keto 不保存密码、不验证 Session，也不签发登录 Token；它是基于 Zanzibar 模型的权限数据存储与决策服务。

```text
Kratos / Gateway ──> subject = user:alice
                              │
Business Service ── Check(Document:doc-1, edit, user:alice)
                              │
                              ▼
                         Ory Keto
                    OPL + Relation Tuples
                              │
                              ▼
                         allow / deny
```

<!-- more -->

## 1. 第一性原理：权限由关系计算出来

Keto 的最小数据不是 Role，而是 Relation Tuple：

```text
Namespace:Object#Relation@Subject
```

例如：

```text
Organization:acme#admins@User:alice
Organization:acme#members@User:bob
Document:doc-1#parent@Organization:acme
```

Tuple 表达事实，OPL 表达如何从事实计算权限：

```typescript
import { Namespace, Context } from "@ory/keto-namespace-types"

class User implements Namespace {}

class Organization implements Namespace {
  related: {
    admins: User[]
    members: User[]
  }
}

class Document implements Namespace {
  related: {
    parent: Organization[]
  }

  permits = {
    view: (ctx: Context) =>
      this.related.parent.traverse(org =>
        org.related.members.includes(ctx.subject) ||
        org.related.admins.includes(ctx.subject)
      ),
    edit: (ctx: Context) =>
      this.related.parent.traverse(org =>
        org.related.admins.includes(ctx.subject)
      ),
  }
}
```

因此 RBAC 只是 ReBAC 的一种表达：把 Role 建模成 Group/Organization 的关系，而不是依赖 Keto 内置一张角色表。

## 2. 程序结构与技术栈

Keto 使用 Go 编写，同时提供 REST 和 gRPC/Connect 接口。

| 目录 | 职责 |
| --- | --- |
| `cmd` | `serve`、`migrate`、`check`、`expand`、Tuple CLI |
| `internal/check` | 权限检查与关系遍历 |
| `internal/expand` | 展开权限树，解释访问来自哪里 |
| `internal/relationtuple` | Tuple 的读写与转换 |
| `internal/namespace` | OPL Namespace 加载和解析 |
| `internal/persistence` | SQL 持久化和迁移 |
| `proto/ory/keto` | gRPC 服务定义 |
| `spec/api.json` | REST OpenAPI 定义 |

源码使用 Cobra、Connect/gRPC、Ory Pop/SQLX、OpenAPI 和 OpenTelemetry。业务服务应依赖 REST/gRPC 契约，不应导入 `internal/*` 实现。

## 3. 数据模型与核心表

```text
Permission Model（OPL）
 └── Namespace
      ├── Relation
      └── Permission

Relation Tuple
 ├── Object: Namespace + Object ID
 ├── Relation
 └── Subject
      ├── Subject ID
      └── Subject Set: Namespace + Object + Relation
```

Subject Set 用来表达“某个集合中的所有成员”，例如：

```text
Document:doc-1#viewers@Group:engineering#members
```

这不是把 `Group:engineering` 当成一个用户，而是把它的 `members` 集合作为 viewers。

Keto 的主要业务数据集中在 `keto_relation_tuples`：

| 字段 | 含义 |
| --- | --- |
| `namespace_id`、`object` | 被访问对象类型和 ID |
| `relation` | 对象上的关系 |
| `subject_id` | 直接主体 ID |
| `subject_set_namespace_id`、`subject_set_object`、`subject_set_relation` | 间接主体集合 |
| `commit_time` | Tuple 提交时间 |

假设 `keto_namespace` 中的编号是：`1 = User`、`2 = Group`、`3 = Document`。下面用三条 Tuple 对照表字段。

1. Alice 是 `doc-1` 的直接 owner

   ```text
   Document:doc-1#owner@User:alice
   ```

   - `namespace_id = 3`：被访问对象属于 `Document`；
   - `object = doc-1`：具体对象是文档 `doc-1`；
   - `relation = owner`：描述的是文档的 owner 关系；
   - `subject_id = User:alice`：Alice 是直接主体；
   - 三个 `subject_set_*` 字段为空：这条关系没有引用其他主体集合；
   - 整句话读作：**Alice 是 doc-1 的 owner**。

2. Bob 是 engineering 组的直接 member

   ```text
   Group:engineering#members@User:bob
   ```

   - `namespace_id = 2`：被描述的对象属于 `Group`；
   - `object = engineering`：具体对象是 engineering 组；
   - `relation = members`：描述的是该组的成员关系；
   - `subject_id = User:bob`：Bob 是直接主体；
   - 三个 `subject_set_*` 字段为空；
   - 整句话读作：**Bob 是 engineering 组的 member**。

3. engineering 组的所有成员都是 `doc-1` 的 viewer

   ```text
   Document:doc-1#viewers@Group:engineering#members
   ```

   - `namespace_id = 3`、`object = doc-1`：被访问对象是文档 `doc-1`；
   - `relation = viewers`：要给这个文档建立 viewer 关系；
   - `subject_id` 为空：授权对象不是某个直接用户；
   - `subject_set_namespace_id = 2`：引用 `Group` 类型的主体集合；
   - `subject_set_object = engineering`：引用 engineering 组；
   - `subject_set_relation = members`：引用该组的所有 members；
   - 整句话读作：**engineering.members 这个用户集合，是 doc-1 的 viewers**。

因此，当 Keto 检查 Bob 能否查看 `doc-1` 时，会先命中第 3 条 Tuple，再沿 Subject Set 查找 `Group:engineering#members`，最后通过第 2 条 Tuple 找到 `User:bob`。这就是“间接主体集合”解决的问题：文档只关联一次用户组，不需要为组内每个用户分别写一条 viewer Tuple。

数据库约束保证 `subject_id` 与 Subject Set 必须二选一。`keto_namespace` 保存 Namespace 映射；其他 UUID/shard 字段主要服务内部索引和隔离，不应成为业务接口。

生产支持 PostgreSQL、MySQL、CockroachDB；SQLite/Memory 用于本地开发。

## 4. 以组织权限为例，完整使用一次 Keto

假设业务需求是：

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

使用 Keto 的顺序不是“先调用 Check API”，而是：

```text
1. 把业务语言翻译成 Namespace、Relation 和 Permission
2. 编写并验证 OPL 文件
3. 部署时把 OPL 文件提供给 Keto
4. 业务事件发生时写入 Relation Tuple
5. 收到业务请求时调用 Check API
```

其中，OPL 是随服务部署的**静态权限规则**；Tuple 是随用户加入组织、角色变更而更新的**动态业务事实**。

### 4.1 第一步：从业务需求得到权限模型

这个场景只需要两个 Namespace：

- `User`：主体，ID 来自 Kratos `identity.id`；
- `Organization`：被操作的业务对象，例如组织 `G`。

Organization 的 Relation 分为三组：

- 用户角色：`members`、`admins`；
- 组织权限上限：`entitled_start_crawl`、`entitled_view_content`、`entitled_modify_keywords`；
- 角色授权：`granted_start_crawl`、`granted_view_content`、`granted_modify_keywords`。

业务动作则定义成三个 Permission：

- `start_crawl`：组织启用且用户角色获准时允许；
- `view_content`：组织启用且用户角色获准时允许；
- `modify_keywords`：组织启用且用户角色获准时允许。

最终权限统一按照下面的交集计算：

```text
最终权限 = 组织 entitled ∩ 角色 granted
```

这使组织权限成为上限。例如组织 W 只有 `view_content`，即使管理员角色配置了
`granted_start_crawl`，最终仍然不能启动抓取。

### 4.2 第二步：编写 `namespaces.ts`

```typescript
import { Namespace, Context, SubjectSet } from "@ory/keto-namespace-types"

class User implements Namespace {}

class Organization implements Namespace {
  related: {
    members: User[]
    admins: User[]

    entitled_start_crawl: (SubjectSet<Organization, "members"> | SubjectSet<Organization, "admins">)[]
    entitled_view_content: (SubjectSet<Organization, "members"> | SubjectSet<Organization, "admins">)[]
    entitled_modify_keywords: (SubjectSet<Organization, "members"> | SubjectSet<Organization, "admins">)[]

    granted_start_crawl: (SubjectSet<Organization, "members"> | SubjectSet<Organization, "admins">)[]
    granted_view_content: (SubjectSet<Organization, "members"> | SubjectSet<Organization, "admins">)[]
    granted_modify_keywords: (SubjectSet<Organization, "members"> | SubjectSet<Organization, "admins">)[]
  }

  permits = {
    start_crawl: (ctx: Context): boolean =>
      this.related.entitled_start_crawl.includes(ctx.subject) &&
      this.related.granted_start_crawl.includes(ctx.subject),

    view_content: (ctx: Context): boolean =>
      this.related.entitled_view_content.includes(ctx.subject) &&
      this.related.granted_view_content.includes(ctx.subject),

    modify_keywords: (ctx: Context): boolean =>
      this.related.entitled_modify_keywords.includes(ctx.subject) &&
      this.related.granted_modify_keywords.includes(ctx.subject),
  }
}
```

逐段理解：

1. `class User` 和 `class Organization` 定义 Keto 能识别的对象类型；
2. `members`、`admins` 保存用户角色；
3. `entitled_*` 保存组织拥有的操作上限；
4. `granted_*` 保存组织内角色获得的操作；
5. `SubjectSet<Organization, "members">` 表示把整个角色集合作为 Relation 主体；
6. `ctx.subject` 是本次权限检查的用户；
7. `&&` 要求组织权限和角色权限同时命中；
8. `permits` 中的函数名就是 Check API 使用的 Permission 名称。

OPL 看起来像 TypeScript，但 Keto 不会启动 Node.js 执行这段代码。它只解析受限制的 TypeScript 子集，将其编译成关系遍历规则。因此不能在里面调用数据库、HTTP 服务、读取时间或执行任意 JavaScript。

可以先使用 Read API 的 `POST /opl/syntax/check` 检查语法，但语法通过只表示“能够解析”，不能代替下面的权限用例测试。

### 4.3 第三步：把 OPL 文件提供给自托管 Keto

推荐目录如下：

```text
keto/
├── keto.yml
└── namespaces.ts
```

在 `keto.yml` 中指定 OPL 文件：

```yaml
namespaces:
  location: file:///etc/config/keto/namespaces.ts
```

然后把两个文件以只读方式挂载进容器：

```yaml
services:
  keto:
    image: ghcr.io/hotttao/ory-keto:v26.2.0
    command: serve -c /etc/config/keto/keto.yml
    volumes:
      - ./keto.yml:/etc/config/keto/keto.yml:ro
      - ./namespaces.ts:/etc/config/keto/namespaces.ts:ro
    ports:
      - "4466:4466" # Read API
      - "4467:4467" # Write API
```

Keto 启动时读取 `namespaces.location`，解析 OPL 并建立 Namespace、Relation 和 Permission 模型。启动后可以调用 `GET /namespaces`，确认 `User` 和 `Organization` 已经加载。

因此，提供 OPL 的正确含义是：

```text
namespaces.ts
   │ 容器挂载
   ▼
/etc/config/keto/namespaces.ts
   │ namespaces.location
   ▼
Keto 启动时解析为权限计算模型
```

OPL 不会写进 `keto_relation_tuples`，也不能通过 `PUT /admin/relation-tuples` 上传。生产中应把 OPL 与应用代码一起版本管理，通过 ConfigMap、只读 Volume 或直接打进配置镜像；修改模型后先做回归测试，再滚动重启 Keto。`namespaces.location` 也可以指向目录或受支持的 URI，但不可变的本地文件更容易审计和回滚。

如果使用 Ory Network，则不是给自托管容器挂载文件，而是通过控制面 CLI 应用：

```bash
ory patch opl -f file://./namespaces.ts
```

这是另一种部署模式，不要与自托管 Keto 的 `namespaces.location` 混用。

### 4.4 第四步：写入 Alice 和 Bob 的关系

初始化脚本先通过 Kratos Admin API 按邮箱查询真实的 `identity.id`：

```http
GET http://kratos:4434/admin/identities?credentials_identifier=alice%40example.com
GET http://kratos:4434/admin/identities?credentials_identifier=bob%40example.com
```

然后通过 Keto Write API 写入用户角色：

```text
PUT http://keto:4467/admin/relation-tuples
Organization:G#admins@User:<alice-identity-id>

PUT http://keto:4467/admin/relation-tuples
Organization:G#members@User:<bob-identity-id>
```

组织 G 启用全部三个操作，因此把 `entitled_*` 关联到两个角色集合：

```text
Organization:G#entitled_start_crawl@Organization:G#members
Organization:G#entitled_start_crawl@Organization:G#admins
Organization:G#entitled_view_content@Organization:G#members
Organization:G#entitled_view_content@Organization:G#admins
Organization:G#entitled_modify_keywords@Organization:G#members
Organization:G#entitled_modify_keywords@Organization:G#admins
```

普通成员和管理员都能启动、查看，只有管理员能修改关键词：

```text
Organization:G#granted_start_crawl@Organization:G#members
Organization:G#granted_start_crawl@Organization:G#admins
Organization:G#granted_view_content@Organization:G#members
Organization:G#granted_view_content@Organization:G#admins
Organization:G#granted_modify_keywords@Organization:G#admins
```

`start_crawl` 等 Permission 不作为 Tuple 写入。它们由 OPL 对 `entitled_*` 和
`granted_*` 求交集得到。Write API 只能由初始化 Job 或可信管理服务调用，不能
暴露给浏览器。

### 4.5 第五步：UI 查询当前用户所属组织

以 Alice 打开 XHS 页面为例，各层实际请求如下：

| 顺序 | 调用方 | 请求 URL | 返回/下一步 |
| ---: | --- | --- | --- |
| 1 | Browser | `GET http://192.168.2.41:5173/v1/xhs/me/organizations` | Vite 代理同一路径到 Traefik `:8080` |
| 2 | Traefik | `GET http://oathkeeper:4456/decisions` | ForwardAuth 携带原始 URL 和 Session Cookie |
| 3 | Oathkeeper | `GET http://kratos:4433/sessions/whoami` | 得到 Alice 的 `identity.id` |
| 4 | Traefik | `GET http://xhs_service:8082/v1/xhs/me/organizations` | 携带 Oathkeeper 签发的 Internal JWT |
| 5 | xhs_service | `GET http://keto:4466/relation-tuples?namespace=Organization&subject_id=User%3A<alice-identity-id>&page_size=250` | 查询 Alice 的直接组织角色 |
| 6 | xhs_service | 返回浏览器 | `{"organizations":[{"id":"G","roles":["admins"]}]}` |

Bob 使用同一条流程，最后返回：

```json
{"organizations":[{"id":"G","roles":["members"]}]}
```

Internal JWT 只携带稳定的 `sub=<identity.id>`，不携带组织、角色和 Permission。
UI 自动选择接口返回的组织，不能再使用写死的 `demo`。

### 4.6 第六步：业务接口映射到 Permission

浏览器请求都先经过 Vite `:5173` 和 Traefik `:8080`，最终由 `xhs_service` 根据
请求路径选择 Permission：

| 浏览器请求 | xhs_service 检查 |
| --- | --- |
| `POST /v1/xhs/organizations/G/crawl/tasks` | `Organization:G#start_crawl@User:<identity-id>` |
| `GET /v1/xhs/organizations/G/crawl/contents` | `Organization:G#view_content@User:<identity-id>` |
| `GET /v1/xhs/organizations/G/crawl/keywords` | `Organization:G#view_content@User:<identity-id>` |
| `PUT /v1/xhs/organizations/G/crawl/keywords` | `Organization:G#modify_keywords@User:<identity-id>` |

`xhs_service` 实际使用 Keto OpenAPI Check：

```http
POST http://keto:4466/relation-tuples/check/openapi
Content-Type: application/json

{
  "namespace": "Organization",
  "object": "G",
  "relation": "modify_keywords",
  "subject_id": "User:<identity-id>"
}
```

Keto 返回：

```json
{"allowed":true}
```

或：

```json
{"allowed":false}
```

### 4.7 第七步：完整执行一次 Bob 修改关键词

1. 浏览器发送：

   ```http
   PUT http://192.168.2.41:5173/v1/xhs/organizations/G/crawl/keywords
   Cookie: ory_kratos_session=<session-cookie>
   Content-Type: application/json

   {"values":["Keto"]}
   ```

2. Vite 把请求代理到：

   ```http
   PUT http://192.168.2.41:8080/v1/xhs/organizations/G/crawl/keywords
   ```

3. Traefik 调用：

   ```http
   GET http://oathkeeper:4456/decisions
   X-Forwarded-Method: PUT
   X-Forwarded-Uri: /v1/xhs/organizations/G/crawl/keywords
   Cookie: ory_kratos_session=<session-cookie>
   ```

4. Oathkeeper 调用：

   ```http
   GET http://kratos:4433/sessions/whoami
   Cookie: ory_kratos_session=<session-cookie>
   ```

5. Kratos 返回 Bob 的 `identity.id`；Oathkeeper 签发 Internal JWT，Traefik 将请求
   转发到：

   ```http
   PUT http://xhs_service:8082/v1/xhs/organizations/G/crawl/keywords
   Authorization: Bearer <internal-jwt>
   ```

6. `xhs_service` 验证 JWT。首次验签、缓存超过 300 秒或 JWT 使用未知 `kid`
   时，它会读取 Oathkeeper 发布的公钥：

   ```http
   GET http://oathkeeper:4456/.well-known/jwks.json
   ```

   验签成功后调用 Keto：

   ```http
   POST http://keto:4466/relation-tuples/check/openapi
   Content-Type: application/json

   {
     "namespace": "Organization",
     "object": "G",
     "relation": "modify_keywords",
     "subject_id": "User:<bob-identity-id>"
   }
   ```

7. Keto 执行：

   ```text
   entitled_modify_keywords 包含 Organization:G#members -> true
   granted_modify_keywords 不包含 Organization:G#members -> false
   true && false -> allowed=false
   ```

8. `xhs_service` 不执行修改，向浏览器返回：

   ```http
   HTTP/1.1 403 Forbidden
   Content-Type: application/json

   {"error":"permission denied"}
   ```

Alice 的前六步相同，但她属于 `admins`，两个 Relation 都命中，因此最终返回
`200 OK`。

### 4.8 权限矩阵和错误边界

真实登录验证结果如下：

| 操作 | Permission | Alice | Bob |
| --- | --- | ---: | ---: |
| 启动抓取 | `start_crawl` | `200` | `200` |
| 查看内容 | `view_content` | `200` | `200` |
| 修改关键词 | `modify_keywords` | `200` | `403` |

不同状态码表示失败发生在不同层：

| 状态码 | 失败位置 | 含义 |
| ---: | --- | --- |
| `401` | Oathkeeper / Internal JWT Middleware | 未登录、Session 或 JWT 无效 |
| `403` | xhs_service + Keto | 已认证，但 Permission 为 `allowed=false` |
| `503` | xhs_service | Keto 不可用，采用 fail-closed，不执行业务操作 |

## 5. 配置

```yaml
version: v0.8.0-alpha.2
dsn: postgres://keto:keto@postgres:5432/keto?sslmode=disable

serve:
  read:
    host: 0.0.0.0
    port: 4466
  write:
    host: 0.0.0.0
    port: 4467

namespaces:
  location: file:///etc/config/keto/namespaces.ts

log:
  level: info
```

这是当前 `deployments/003_keto/keto/keto.yml` 使用的配置。关键配置是数据库、
Read/Write 监听地址和 OPL 文件。Read API 可以按检查流量水平扩容；Write API
仅允许可信业务后台调用。生产环境应从 Secret 注入数据库口令并启用 TLS，不能
直接复用这里的教学环境 DSN。

本文示例使用 `subject_id = User:<identity-id>`，因此没有直接启用 `feature_flags.strict_mode`。新版本的 strict mode 要求创建关系和检查权限时使用 Subject Set，普通 `subject_id` 会被拒绝。启用前必须根据目标版本的迁移指南改造历史 Tuple 和 Check 请求，并完成权限回归测试，不能只改一个配置开关。

## 6. API

### Read API：默认 4466

| 接口 | 作用 |
| --- | --- |
| `POST /relation-tuples/check/openapi` | 检查单个权限，返回 `{"allowed":true/false}` |
| `POST /relation-tuples/batch/check` | 批量检查 |
| `GET /relation-tuples/expand` | 展开 Subject Tree，解释权限来源 |
| `GET /relation-tuples` | 按部分 Tuple 查询关系 |
| `GET /namespaces` | 查询 Namespace |
| `POST /opl/syntax/check` | 检查 OPL 语法 |
| `GET /health/alive`、`/health/ready` | 存活和就绪探针 |

### Write API：默认 4467

| 接口 | 作用 |
| --- | --- |
| `PUT /admin/relation-tuples` | 创建关系 |
| `PATCH /admin/relation-tuples` | 在一个请求中插入/删除多条关系 |
| `DELETE /admin/relation-tuples` | 按过滤条件删除关系 |

Proto 还定义了 `CheckService`、`ExpandService`、`ReadService`、`WriteService`、`NamespacesService`。Go 服务之间优先使用生成的 gRPC/Connect Client；需要通用兼容时使用 REST SDK。

## 7. Docker 与 Kubernetes

本地启动：

```bash
docker compose -f deployments/003_keto/docker-compose.yml up -d
```

仓库 Compose 使用 `ghcr.io/hotttao/ory-keto:v26.2.0`，暴露 4466/4467。生产环境先迁移再启动：

```bash
keto migrate up -c /etc/config/keto/keto.yml
keto serve -c /etc/config/keto/keto.yml
```

Kubernetes 使用官方 Chart：

```bash
helm repo add ory https://k8s.ory.com/helm/charts
helm upgrade --install keto ory/keto -n auth --create-namespace -f values.yaml
```

Chart 只部署 Keto，不内置 PostgreSQL、MySQL 或 CockroachDB。官方建议生产环境使用托管 SQL 数据库；`memory` 只适合测试。

```yaml
keto:
  config:
    dsn: postgres://keto:<password>@postgres:5432/keto?sslmode=require
    namespaces:
      location: file:///etc/config/keto/namespaces.ts
    serve:
      read:
        port: 4466
      write:
        port: 4467
autoMigrate: true
```

`autoMigrate: true` 会为 Pod 增加执行迁移的 initContainer。开发环境可以这样使用；生产多副本应改成独立 Migration Job，确保一次迁移成功后再滚动 Deployment。

Chart 会分别创建 Read 与 Write Service。不要为 Write Service 创建公网 Ingress，并通过 NetworkPolicy 保证：业务服务只能访问 Read API，只有权限管理服务可以访问 Write API。Keto 本身不替 Write API 做调用者认证。DSN 应从 Kubernetes Secret 或外部 Secret Manager 注入，而不是提交到 Git。

## 8. 总结

Keto 的使用顺序应始终是：先定义资源关系，再写 OPL，最后写 Tuple 和调用 Check。不要从“系统有哪些角色”开始建模，而要从“谁通过什么关系获得哪个资源权限”开始建模。

参考：[Keto 官方介绍](https://www.ory.com/keto)、[官方 Helm Chart](https://k8s.ory.com/helm/keto.html)、本地 `docs/ory_permission_language_spec.md`、`proto/ory/keto` 和 `spec/api.json`。
