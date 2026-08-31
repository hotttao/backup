---
weight: 1
title: "6 Ory Kratos 典型 Workflow：对照浏览器理解每一次请求"
date: 2026-08-31T18:10:00+08:00
lastmod: 2026-08-31T18:10:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "逐步记录注册、登录、会话、注销、邮件投递和密码找回 Workflow 中的浏览器 URL 与 Kratos 请求"
featuredImage:

tags: ["auth", "ory", "kratos", "workflow"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

Kratos 的 Browser Flow 同时包含浏览器导航、Account UI 渲染、Public API 请求和 Cookie 状态变化。只记录“创建 Flow、提交表单”很难和浏览器 Network 面板一一对应，因此本文以当前仓库的真实地址为准，逐步列出每个 Workflow 的请求 URL、响应和地址栏变化。

本文聚焦已经落地的注册、登录、Session、注销和密码找回；Kratos 的组件边界和数据模型见上一篇，Ory Elements 的组件定制见后续文章。

<!-- more -->

## 本仓库当前实现：对照浏览器 Network 面板

这一节不使用抽象的 `app.example.com`，而是使用当前教学环境的真实地址。阅读时建议打开浏览器开发者工具的 Network 面板，勾选 **Preserve log**，然后从首页重新执行一次对应流程。

### 请求经过哪些地址

当前环境有四类浏览器可见地址：

| 地址 | 作用 | 是否出现在地址栏 |
| --- | --- | --- |
| `http://192.168.2.41:5173` | Vite Account UI，也是 Browser Flow 配置的 UI 地址 | 是 |
| `http://192.168.2.41:5173/kratos/*` | 开发环境同源 Kratos API；Vite 代理到 Traefik | 通常只出现在 Network 面板 |
| `http://192.168.2.41:8080/kratos/*` | Traefik 直接入口；Kratos 生成 Logout URL 等绝对地址时可能使用 | 可能 |
| `http://192.168.2.41:8025` | Mailpit 开发邮件箱 | 手动打开时出现 |

浏览器请求 Kratos 时经过以下路径转换：

```text
Browser
  GET http://192.168.2.41:5173/kratos/self-service/login/browser
    ↓ Vite proxy，保留 /kratos
Traefik :8080
  GET /kratos/self-service/login/browser
    ↓ kratos-strip-prefix 删除 /kratos
Kratos Public API :4433
  GET /self-service/login/browser
```

因此，下面表格中的“浏览器请求 URL”保留 `/kratos`；Kratos 日志里的 `path` 通常不包含这个前缀。所有 Flow 的读取和提交都必须携带同一浏览器上下文中的 Cookie，Ory SDK 配置使用 `credentials: "include"`。

### 当前 Workflow 完成度

| Workflow | 当前状态 | UI 路由 |
| --- | --- | --- |
| Registration | 已完成 | `/registration` |
| Login | 已完成 | `/login` |
| Session 查询 | 已完成 | `/` |
| Logout | 已完成 | 导航栏或首页按钮 |
| Recovery Code | 已完成 | `/recovery` |
| Recovery 授权的 Settings | 已完成 | `/settings?flow=...` |
| 已登录用户主动进入 Settings | 已完成 | `/settings` |
| Verification | Kratos 已配置，Account UI 尚未实现 | 暂无可用页面 |
| Error UI | Kratos 已配置，Account UI 尚未实现专用页面 | 暂无专用页面 |

下面只把已经完成的 Workflow 记为可执行流程。尚未实现的 Verification 不提前写成“已经可用”。

### Registration：邮箱和密码注册

用户首先访问：

```text
http://192.168.2.41:5173/registration
```

此时 URL 中没有 `flow`，页面不会自己创建表单字段，而是启动 Kratos Browser Flow：

| 步骤 | 地址栏 | 浏览器 Network 请求 | 关键结果 |
| --- | --- | --- | --- |
| 1 | `/registration` | `GET http://192.168.2.41:5173/kratos/self-service/registration/browser` | 创建 Registration Flow 和 CSRF Cookie |
| 2 | 即将变化 | 上一步响应 `303 Location: http://192.168.2.41:5173/registration?flow=<registration-flow-id>` | 浏览器进入带 Flow ID 的 UI URL |
| 3 | `/registration?flow=<id>` | `GET http://192.168.2.41:5173/kratos/self-service/registration/flows?id=<id>` | 返回 `ui.action`、`ui.nodes`、过期时间和错误消息 |
| 4 | 不变 | Ory Elements 根据 `ui.nodes` 渲染邮箱、可选手机号、姓名、密码和提交按钮 | 前端不写死 Kratos 表单协议 |
| 5 | 不变 | `POST http://192.168.2.41:5173/kratos/self-service/registration?flow=<id>` | JSON 中提交 `csrf_token`、`method=password`、`traits.*` 和 `password` |
| 6 | `/` | 成功响应设置 `ory_kratos_session` Cookie，随后页面跳回 `http://192.168.2.41:5173/` | 当前配置的 registration session hook 自动创建 Session |
| 7 | `/` | `GET http://192.168.2.41:5173/kratos/sessions/whoami` | 首页读取新 Session 和 Identity |

第 5 步失败时，Kratos 返回更新后的 Registration Flow，错误位于 `ui.messages` 或具体 Node 的 `messages` 中；地址栏仍然保留同一个 Flow ID。邮箱重复、Schema 校验失败或密码不符合策略都属于这个分支。

### Login：密码登录

用户首先访问：

```text
http://192.168.2.41:5173/login
```

| 步骤 | 地址栏 | 浏览器 Network 请求 | 关键结果 |
| --- | --- | --- | --- |
| 1 | `/login` | `GET http://192.168.2.41:5173/kratos/self-service/login/browser` | 创建 Login Flow 和 CSRF Cookie |
| 2 | 即将变化 | 响应 `303 Location: http://192.168.2.41:5173/login?flow=<login-flow-id>` | 进入 Login UI |
| 3 | `/login?flow=<id>` | `GET http://192.168.2.41:5173/kratos/self-service/login/flows?id=<id>` | 获取 Login Flow 的 UI Nodes |
| 4 | 不变 | `POST http://192.168.2.41:5173/kratos/self-service/login?flow=<id>` | 提交 `csrf_token`、`method=password`、`identifier` 和 `password` |
| 5 | `/` | 成功响应设置 `ory_kratos_session`，Ory Elements 按完成动作跳回首页 | 浏览器获得 Session Cookie |
| 6 | `/` | `GET http://192.168.2.41:5173/kratos/sessions/whoami` | Account UI 展示当前 Identity 和 Session |

密码错误时不会创建 Session。Kratos 返回带错误消息的 Login Flow，Ory Elements 继续渲染同一个 Flow，而不是由前端自行判断“邮箱或密码错误”。

### Session：页面如何判断当前是否登录

Session 查询不是 Login Flow 的必选步骤；登录成功的标志是 Kratos 已经创建 Session 并设置 Cookie。这个项目是 SPA，需要在刷新页面后恢复 UI 状态，所以 Session Provider 会请求：

```http
GET http://192.168.2.41:5173/kratos/sessions/whoami
Cookie: ory_kratos_session=...
```

| 响应 | Account UI 行为 |
| --- | --- |
| `200 OK` | 读取 `session.identity`，显示用户、Session ID、AAL 和过期时间 |
| `401 Unauthorized` | 视为匿名访问，显示登录、注册和找回入口 |
| 其他错误 | 显示 Session 查询失败，并允许重试 |

地址栏始终可以是 `http://192.168.2.41:5173/`；`/sessions/whoami` 只会出现在 Network 面板。后续接入 Gateway 时，也可以由 Gateway 使用同一接口验证 Cookie，但不要求每个内部微服务重复请求它。

### Logout：注销当前 Session

浏览器注销分为“创建 Logout Flow”和“执行 Logout URL”两步：

| 步骤 | 地址栏 | 浏览器 Network 请求 | 关键结果 |
| --- | --- | --- | --- |
| 1 | 当前页面 | `GET http://192.168.2.41:5173/kratos/self-service/logout/browser` | Kratos 返回一次性 `logout_url` 和 `logout_token` |
| 2 | 即将变化 | `GET http://192.168.2.41:8080/kratos/self-service/logout?token=<logout-token>` | 浏览器导航到 Kratos 生成的 Logout URL |
| 3 | `/login` | Kratos 删除/失效当前 Session Cookie，并 `303` 到 `http://192.168.2.41:5173/login` | 当前 Session 已注销 |
| 4 | `/login` | Login 页面初始化时仍会触发 Session Provider 的 `GET /kratos/sessions/whoami` | 预期得到 `401`，UI 进入匿名状态 |

第二步必须使用 Kratos 返回的完整 `logout_url`，不能只删除前端内存中的用户信息。否则服务端 Session 仍然有效。

### Courier：Recovery 邮件如何从 HTTP 请求进入 Mailpit

Courier 不是浏览器直接调用的 API。它发生在用户提交 Recovery 邮箱之后：

```text
Browser
  POST /kratos/self-service/recovery?flow=<id>
    ↓
Kratos Server
  生成 Recovery Code
  INSERT courier_messages
    ↓ PostgreSQL 队列
kratos courier watch
  读取待发送消息
    ↓ SMTP smtp://mailpit:1025
Mailpit
  http://192.168.2.41:8025
```

浏览器 Network 面板只会看到 Recovery Flow 的 `POST`，看不到 Courier Worker 到 SMTP 的通信。要观察后半段，需要查看 Courier 日志，或者打开 Mailpit UI。Mailpit 只是本地邮件接收器，不会把邮件继续发送到 QQ 邮箱。

### Recovery：申请并提交邮箱验证码

找回密码不是一个单独表单，而是连续的 **Recovery Flow + Recovery 授权的 Settings Flow**。

用户首先访问：

```text
http://192.168.2.41:5173/recovery
```

Recovery 阶段的请求如下：

| 步骤 | 地址栏 | 浏览器 Network 请求 | 关键结果 |
| --- | --- | --- | --- |
| 1 | `/recovery` | `GET http://192.168.2.41:5173/kratos/self-service/recovery/browser` | 创建 Recovery Flow 和 CSRF Cookie |
| 2 | 即将变化 | 响应 `303 Location: http://192.168.2.41:5173/recovery?flow=<recovery-flow-id>` | 进入 Recovery UI |
| 3 | `/recovery?flow=<id>` | `GET http://192.168.2.41:5173/kratos/self-service/recovery/flows?id=<id>` | 状态通常是 `choose_method`，UI Nodes 包含邮箱字段 |
| 4 | 不变 | `POST http://192.168.2.41:5173/kratos/self-service/recovery?flow=<id>` | 提交 `csrf_token`、`method=code` 和注册邮箱 |
| 5 | 不变 | 第 4 步返回更新后的 Recovery Flow | 状态变为 `sent_email`，UI Nodes 改为验证码输入字段 |
| 6 | 不变 | 用户在 `http://192.168.2.41:8025` 读取邮件中的 Recovery Code | Mailpit 操作不属于 Kratos Flow 请求 |
| 7 | 不变 | `POST http://192.168.2.41:5173/kratos/self-service/recovery?flow=<id>` | 提交 `csrf_token`、`method=code` 和 `code` |
| 8 | 即将变化 | AJAX/SDK 模式收到 `422 browser_location_change_required` | `redirect_browser_to` 指向 `/settings?flow=<settings-flow-id>` |
| 9 | `/settings?flow=<settings-flow-id>` | Ory Elements 执行浏览器跳转 | Recovery 验证阶段完成 |

第 8 步的 `422` 不是验证码错误。它表示当前 Recovery Flow 已完成，浏览器必须进入 Kratos 刚签发的 Settings Flow。普通 HTML 表单模式下，同一语义也可能表现为 `303` 跳转。

Recovery Flow 只证明用户控制注册邮箱，不接收新密码，也不依赖用户事先登录或调用 `/sessions/whoami`。

### Recovery Settings：设置新密码

验证码成功后，地址栏已经是：

```text
http://192.168.2.41:5173/settings?flow=<settings-flow-id>
```

| 步骤 | 地址栏 | 浏览器 Network 请求 | 关键结果 |
| --- | --- | --- | --- |
| 1 | `/settings?flow=<id>` | `GET http://192.168.2.41:5173/kratos/self-service/settings/flows?id=<id>` | 读取 Recovery 授权的 Settings Flow |
| 2 | 不变 | Ory Elements 从 `ui.nodes` 的 `password` 组渲染新密码字段 | Flow 还可能包含 profile 等其他 Settings 组 |
| 3 | 不变 | `POST http://192.168.2.41:5173/kratos/self-service/settings?flow=<id>` | 提交 `csrf_token`、`method=password` 和新密码 |
| 4 | 即将变化 | 成功响应更新 Password Credential，并返回 `continue_with: redirect_browser_to` | 跳转地址来自 Kratos 的 Settings 成功配置 |
| 5 | `/` | `GET http://192.168.2.41:5173/kratos/sessions/whoami` | Recovery 后由 Kratos 建立/刷新 Session，首页显示当前账号 |

Settings Flow ID 不是独立的“重置密码 Token”。读取和提交它时，浏览器还必须携带 Recovery 过程建立的 Cookie；把 URL 复制到另一个没有对应 Cookie 的浏览器，不能获得同样的恢复权限。

密码 Settings 成功后的返回地址由 Kratos 配置，而不是由 React 页面自行决定：

```yaml
selfservice:
  flows:
    settings:
      ui_url: http://192.168.2.41:5173/settings
      after:
        password:
          default_browser_return_url: http://192.168.2.41:5173/
```

当前 Ory Elements 使用 JSON 提交 Settings Flow。Kratos 成功更新密码后返回的 Flow 中包含：

```json
{
  "continue_with": [
    {
      "action": "redirect_browser_to",
      "redirect_browser_to": "http://192.168.2.41:5173/"
    }
  ]
}
```

Ory Elements 读取这个 `continue_with` 并执行浏览器跳转。如果没有配置 `settings.after.password.default_browser_return_url`，Kratos 默认可能把当前 Settings UI 作为返回地址，于是保存成功后又回到 `/settings?flow=...`。只在 React 的 `onSuccess` 中调用 `window.location.replace("/")` 也不可靠，因为 Ory Elements 随后仍会处理 Kratos 返回的 `continue_with`，服务端跳转可能覆盖前端跳转。

如果第 3 步返回字段错误，页面继续渲染更新后的 Settings Flow；只有成功响应才跳回首页。Flow 过期后不能重复使用，必须重新从 `/recovery` 开始。

### Authenticated Settings：已登录用户主动修改密码

Recovery 和已登录 Settings 最终使用同一种 Settings Flow 数据结构，区别在于授权来源：Recovery 通过邮箱验证码建立恢复授权；主动修改密码使用现有 Session，并受 `privileged_session_max_age: 15m` 约束。

已登录用户点击导航栏的 **Account settings**，首先进入：

```text
http://192.168.2.41:5173/settings
```

| 步骤 | 地址栏 | 浏览器 Network 请求 | 关键结果 |
| --- | --- | --- | --- |
| 1 | `/settings` | `GET http://192.168.2.41:5173/kratos/self-service/settings/browser` | 携带 Session Cookie 创建 Settings Flow |
| 2 | 即将变化 | 响应 `303 Location: http://192.168.2.41:5173/settings?flow=<settings-flow-id>` | 浏览器进入 Settings UI |
| 3 | `/settings?flow=<id>` | `GET http://192.168.2.41:5173/kratos/self-service/settings/flows?id=<id>` | 返回 profile、password 等已启用方法的 UI Nodes |
| 4 | 不变 | `POST http://192.168.2.41:5173/kratos/self-service/settings?flow=<id>` | 修改密码时提交 `csrf_token`、`method=password` 和新密码 |
| 5 | 即将变化 | 成功响应返回 `continue_with.redirect_browser_to` | Ory Elements 按 Kratos 配置跳转首页 |
| 6 | `/` | `GET http://192.168.2.41:5173/kratos/sessions/whoami` | 首页读取更新后的 Session 和 Identity |

如果没有有效 Session，步骤 1 不会创建可用的 Settings Flow，而是要求用户登录。若 Session 存在但最近认证时间超过 15 分钟，敏感提交可能返回 `403 session_refresh_required`；响应中的 `redirect_browser_to` 会启动带 `refresh=true` 的 Login Flow，用户重新证明身份后再返回 Settings。这里的“重新登录”用于提升当前 Session 的新鲜度，不是创建另一个 Identity。

### 在 Network 面板中如何识别一次 Flow

可以按以下顺序过滤请求：

```text
self-service/<flow>/browser       创建 Flow，通常返回 303
self-service/<flow>/flows?id=...  读取 Flow，通常返回 200
self-service/<flow>?flow=...      提交 Flow，成功或返回更新后的 Flow
sessions/whoami                   读取登录状态，不负责提交认证凭据
```

同一个 Flow 的创建、读取和提交共享同一个 Flow ID。排查问题时至少同时记录：

- 地址栏中的 UI URL 和 `flow`；
- Network 请求的 Method、完整 URL、Status 和 Initiator；
- Request Cookie 与响应的 `Set-Cookie` 是否存在，但不要复制 Cookie 值；
- 响应中的 `ui.action`、`ui.nodes`、`ui.messages` 和 `redirect_browser_to`；
- Kratos 日志中的 `path`、`status_code` 和 Flow ID。

不要把密码、验证码、CSRF Token、Session Cookie 或完整 Logout Token 写入文档和日志。

## 第 9 步：端到端验证清单

下面的顺序适合在浏览器中从一个干净的匿名状态开始验证。Network 面板建议开启 **Preserve log**，并在每个流程开始前记下当前是否存在 `ory_kratos_session` Cookie。

### 验收顺序

| 顺序 | 验证项 | 起始页面 | 必须观察的请求 | 验收结果 |
| --- | --- | --- | --- | --- |
| 1 | 注册 | `/registration` | `GET /kratos/self-service/registration/browser`、`GET /flows?id=...`、`POST /kratos/self-service/registration?flow=...` | 注册成功后收到 `ory_kratos_session`，跳转 `/`，`GET /kratos/sessions/whoami` 返回 `200` |
| 2 | 当前 Session | `/` | `GET /kratos/sessions/whoami` | 页面显示当前 Identity；刷新页面后仍保持登录 |
| 3 | 主动修改密码 | `/settings` | `GET /kratos/self-service/settings/browser`、`GET /settings/flows?id=...`、`POST /kratos/self-service/settings?flow=...` | 密码更新成功，按 `continue_with.redirect_browser_to` 跳转 `/` |
| 4 | 注销 | `/` | `GET /kratos/self-service/logout/browser`、随后访问返回的 `logout_url` | Session 失效，跳转 `/login`，后续 `GET /kratos/sessions/whoami` 返回 `401` |
| 5 | 使用新密码登录 | `/login` | `GET /kratos/self-service/login/browser`、`GET /login/flows?id=...`、`POST /kratos/self-service/login?flow=...` | 登录成功后重新获得 `ory_kratos_session`，跳转 `/` |
| 6 | Recovery 申请验证码 | `/recovery` | `GET /kratos/self-service/recovery/browser`、`GET /recovery/flows?id=...`、`POST /kratos/self-service/recovery?flow=...` | Recovery Flow 进入 `sent_email`，Courier 日志出现投递记录，Mailpit 收到邮件 |
| 7 | Recovery 验证码 | `/recovery?flow=...` | 再次 `POST /kratos/self-service/recovery?flow=...` | 验证成功，返回 `browser_location_change_required` 或 `303`，跳转 `/settings?flow=...` |
| 8 | Recovery 设置密码 | `/settings?flow=...` | `GET /kratos/self-service/settings/flows?id=...`、`POST /kratos/self-service/settings?flow=...` | 密码更新成功，跳转 `/`，之后可以使用新密码登录 |

### 各流程的失败分支

验证失败时，不应只看页面最终显示的文字，还要根据 HTTP 响应判断失败发生在哪一层：

| 现象 | 预期请求结果 | 含义 |
| --- | --- | --- |
| 注册邮箱已存在 | Registration `POST` 返回 `400`，Flow 中有 `ui.messages` 或 Node 错误 | Identity 已存在，Flow 仍可继续显示错误 |
| 登录密码错误 | Login `POST` 返回 `400`，返回更新后的 Login Flow | 没有创建新的 Session |
| Recovery 邮箱没有账号 | Recovery `POST` 通常仍返回通用结果 | 防止通过响应区分邮箱是否注册 |
| 验证码错误或过期 | Recovery `POST` 返回错误 Flow | 仍停留在 Recovery Flow，不能直接进入 Settings |
| Flow 已过期 | 读取 Flow 返回 `404` 或 `410` | 必须重新访问对应的 `/browser` 创建入口 |
| Settings Session 不新鲜 | Settings 提交返回 `403 session_refresh_required` 或浏览器跳转 Login Refresh Flow | 需要重新证明当前身份，不是重新注册账号 |
| 注销后访问受保护页面 | `GET /kratos/sessions/whoami` 返回 `401` | 前端应进入匿名状态 |

### 验证完成标准

本模块的端到端验证在同时满足以下条件后才算完成：

- 注册、登录和注销都能改变服务端 Session，而不只是改变前端显示状态；
- 刷新首页后，页面通过 `/kratos/sessions/whoami` 恢复或清除登录状态；
- 主动 Settings 和 Recovery Settings 都能成功修改密码，并回到首页；
- Recovery 邮件能在 Mailpit 中看到，且验证码错误、过期和成功分支都能区分；
- 每一个 Browser Flow 都能在 Network 面板中对应到创建、读取、提交三个阶段；
- 所有失败分支都保留 Kratos 返回的 Flow 错误，不由前端自行替换成无法定位原因的通用成功状态。
