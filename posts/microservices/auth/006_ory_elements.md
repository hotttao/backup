---
weight: 9
title: "9 Ory Elements：Kratos Flow 的 React 用户界面"
date: 2026-08-30T18:00:00+08:00
lastmod: 2026-08-30T18:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "从使用者视角理解 Ory Elements 的边界、组件结构、Flow 渲染、自托管 Kratos 接入与部署"
featuredImage:

tags: ["auth", "ory", "elements", "kratos", "react"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

Kratos 是无头身份服务：它负责创建和推进 Login、Registration、Settings 等 Flow，却只返回 `ui.nodes`，不返回完整登录页面。Ory Elements 正好补上这一层：**把 Kratos Flow 转换成可以直接使用和定制的 React 用户界面。**

```text
Kratos                               Ory Elements
  ├── 创建 Flow                       ├── 获取 Flow
  ├── 决定有哪些 ui.nodes             ├── 把 ui.nodes 渲染成表单
  ├── 校验密码、验证码和 CSRF          ├── 收集输入并提交 Flow
  ├── 返回字段错误、跳转或 Session      └── 展示错误、执行跳转
  └── 保存 Identity / Credential
```

Elements 不保存用户、不校验密码、不创建 Session，也不是一个必须独立运行的 Ory 服务。它本质上是安装进 React/Next.js 应用的组件库；只有把它做成独立登录站点时，才需要单独部署前端容器。

<!-- more -->

## 1. Elements 在认证架构中的位置

先区分五个经常混在一起的组件：

| 组件 | 回答的问题 |
| --- | --- |
| Kratos | 用户如何注册、登录、修改资料，以及当前 Session 属于谁 |
| `@ory/client-fetch` | 如何以类型安全方式调用 Kratos/Ory HTTP API |
| `@ory/elements-react` | 如何把 Flow 和 `ui.nodes` 渲染、收集并提交 |
| `@ory/nextjs` | Next.js 如何获取 Flow、转发 Cookie、处理跳转和代理 Ory 请求 |
| Gateway/Oathkeeper | 业务请求进入系统时如何认证，并把可信身份传给后端服务 |

完整位置如下：

```text
Browser
  │
  ▼
React / Next.js Login UI
  ├── @ory/elements-react     页面、表单、组件、主题、i18n
  ├── @ory/nextjs             Next.js Flow/Cookie/Proxy 适配（可选）
  └── @ory/client-fetch       HTTP SDK
              │
              ▼
       Kratos Public API
       ├── Self-service Flow
       ├── Session
       └── Identity Schema
```

因此，Elements 不替代 Kratos，也不替代 SDK。它消费 SDK 返回的 Flow 对象，并在用户提交后继续调用 Kratos。

## 2. 程序由什么组成

当前仓库是基于 pnpm 和 Nx 的 TypeScript Monorepo，核心发布包只有两个：

| 包 | 作用 |
| --- | --- |
| `@ory/elements-react` | React Flow 组件、表单状态、UI Node renderer、默认主题和多语言 |
| `@ory/nextjs` | Next.js App Router/Pages Router 的 Flow、Session、Logout 和 Middleware 辅助函数 |

仓库还提供四类示例：App Router、Pages Router、自定义组件和 Matomo 埋点。这些示例是学习入口，不是需要和业务应用并行部署的基础设施。

`@ory/elements-react` 的核心源码结构是：

| 目录 | 运行时职责 |
| --- | --- |
| `components/form` | 表单状态、字段校验、Flow 提交和消息展示 |
| `components/form/nodes/renderer` | 将 input、checkbox、button、image、text、SSO 等 UI Node 转成 React 组件 |
| `components/settings` | TOTP、Passkey、WebAuthn、恢复码、OIDC 等设置页面 |
| `context` | Flow、配置、组件替换和国际化 Context |
| `theme/default` | 默认主题、CSS 和 Login/Registration/Settings 等成品组件 |
| `client` | Browser SDK Client、`SessionProvider` 和 `useSession` |
| `locales` | 默认翻译资源，包含中文等多种语言 |
| `util` | 各 Flow 的提交、错误、跳转和 transient payload 处理 |

主要技术依赖也能直接从 `package.json` 看出：React、TypeScript、React Hook Form、React Intl、Radix UI、Tailwind CSS、`@ory/client-fetch`，测试和构建使用 Jest、Storybook、Vite、tsup 与 Nx。

旧的 `@ory/elements`、`@ory/elements-markup` 和 `@ory/elements-preact` 已经迁到 `elements-legacy` 仓库。新项目应使用 `@ory/elements-react`，不要再按旧教程安装这些包。

## 3. 核心运行模型

Elements 的核心不是一组写死的登录输入框，而是 **Flow-driven UI**：

```text
Kratos Flow
  ├── id / type / expires_at
  └── ui
       ├── action / method
       ├── messages
       └── nodes[]
             │
             ▼
        OryProvider
        ├── Flow Context
        ├── Configuration Context
        ├── Intl Context
        └── Component Context
             │
             ▼
        Node Sorter + Renderer
        ├── hidden csrf_token
        ├── identifier / password / code
        ├── OIDC / SAML / Passkey 按钮
        ├── checkbox / select / captcha / QR code
        └── 字段消息与 Flow 消息
             │
             ▼
        React Hook Form
             │ submit
             ▼
        @ory/client-fetch -> Kratos
```

这意味着页面随着服务端配置变化：

- Identity Schema 新增 `name`，Registration Flow 增加对应节点；
- 启用 Google OIDC，Login Flow 增加 provider 按钮；
- 登录进入 AAL2，Flow 只返回 TOTP、WebAuthn 或恢复码节点；
- 字段校验失败，Kratos 把错误放回节点，Elements 重新渲染；
- Flow 过期或要求跳转，Elements/适配层重新创建 Flow 或导航。

Elements 负责“忠实呈现状态机”，但真正的状态机仍在 Kratos。前端不能因为用了 Elements 就绕过 Browser Flow、CSRF Cookie 或 Kratos 的回跳校验。

## 4. 支持哪些页面和认证方式

### 4.1 成品 Flow 组件

默认主题导出了：

| 组件 | 输入数据 | 页面作用 |
| --- | --- | --- |
| `<Login>` | `LoginFlow` | 登录和 AAL2 提升 |
| `<Registration>` | `RegistrationFlow` | 注册账号 |
| `<Recovery>` | `RecoveryFlow` | 恢复账号、重设凭据 |
| `<Verification>` | `VerificationFlow` | 验证邮箱或手机号 |
| `<Settings>` | `SettingsFlow` | 修改资料、密码和认证器 |
| `<Error>` | Flow Error | 展示用户可见流程错误 |
| `<Consent>` | OAuth2 Consent Request、Session 等 | 展示 OAuth2 授权同意页面 |

`Consent` 不是 Kratos Self-service Flow。它要求调用方提供 consent request、Session、CSRF token 和提交地址；自托管 Hydra 的 Login/Consent 协议仍需要自己的后端适配，不能把组件存在理解成“已经自动接好了 Hydra”。

### 4.2 认证方式如何被支持

Elements 不重新实现密码或 Passkey 算法，而是识别 Flow 中的节点分组。当前源码覆盖：

- password、code；
- OIDC、SAML；
- passkey、WebAuthn；
- TOTP、lookup secret；
- profile；
- identifier-first 和 two-step 交互；
- device authentication 设置；
- CAPTCHA、隐藏字段、图片和选择框。

是否真正显示某种方法取决于四层同时兼容：

```text
Kratos 配置启用方法
  + Identity Schema 声明对应凭据字段
  + Kratos Flow 返回对应 ui.nodes
  + Elements 与 @ory/client-fetch 版本识别这些节点
```

Elements 版本太旧时，新版 Kratos 即使返回了新节点，页面也可能只能按通用字段渲染，或者完全无法处理相应交互。因此应把 Kratos、SDK 和 Elements 的组合纳入认证回归测试。

## 5. 两个包应该怎么选

### 5.1 普通 React 或自定义框架

安装：

```bash
npm install @ory/elements-react @ory/client-fetch react react-dom
```

应用自己负责：

1. 初始化 Browser Flow；
2. 根据 URL 中的 `flow` 查询 Flow；
3. 把 Flow 交给 Elements；
4. 配置 Kratos/Ory 的浏览器可访问地址；
5. 处理 Cookie、CORS、反向代理和服务端渲染时的 Cookie 转发。

### 5.2 Next.js

安装：

```bash
npm install @ory/elements-react @ory/nextjs
```

`@ory/nextjs` 提供两套路由适配：

- `@ory/nextjs/app`：App Router；
- `@ory/nextjs/pages`：Pages Router；
- `@ory/nextjs/middleware`：代理相关路径、改写 Location 和 Cookie；
- Flow、Session、Logout、Error 等辅助函数。

当前仓库的 `@ory/nextjs` README 和示例主要围绕 **Ory Network**：使用 `NEXT_PUBLIC_ORY_SDK_URL`，Middleware 还会发送 Ory Network 的 Base URL Rewrite 相关请求头。自托管 Kratos 可以复用 `@ory/elements-react`，但不能默认认为整套 `@ory/nextjs` Middleware 无需修改就能成为 Kratos 反向代理。

## 6. Ory Network：最短的 Next.js 接入

先安装两个包，然后配置：

```typescript
// ory.config.ts
import type { OryClientConfiguration } from "@ory/elements-react"

const config: OryClientConfiguration = {
  project: {
    name: "Example Docs",
    default_redirect_url: "/",
    error_ui_url: "/auth/error",
    login_ui_url: "/auth/login",
    registration_ui_url: "/auth/registration",
    recovery_ui_url: "/auth/recovery",
    verification_ui_url: "/auth/verification",
    settings_ui_url: "/settings",
    registration_enabled: true,
    recovery_enabled: true,
    verification_enabled: true,
  },
  intl: {
    locale: "zh",
  },
}

export default config
```

环境变量：

```dotenv
NEXT_PUBLIC_ORY_SDK_URL=https://<project>.projects.oryapis.com
ORY_PROJECT_API_TOKEN=<供服务端 Middleware 使用的项目 API Token；不得暴露给浏览器>
```

Middleware：

```typescript
// middleware.ts
import { createOryMiddleware } from "@ory/nextjs/middleware"
import config from "@/ory.config"

export const middleware = createOryMiddleware(config)
```

登录页：

```tsx
import { Login } from "@ory/elements-react/theme"
import { getLoginFlow, OryPageParams } from "@ory/nextjs/app"
import config from "@/ory.config"

export default async function LoginPage(props: OryPageParams) {
  const flow = await getLoginFlow(config, props.searchParams)
  if (!flow) return null

  return <Login flow={flow} config={config} />
}
```

不要忘记导入默认样式：

```typescript
import "@ory/elements-react/theme/styles.css"
```

Registration、Recovery、Verification 和 Settings 的写法相同：服务器函数取得对应 Flow，再传给同名组件。

## 7. 自托管 Kratos：推荐的接入方式

自托管时最难的不是 React 组件，而是 Browser Flow 的域名和 Cookie。推荐让浏览器看到同一个 Origin：

```text
https://accounts.example.com/auth/*
  -> Next.js Elements UI

https://accounts.example.com/self-service/*
https://accounts.example.com/sessions/*
https://accounts.example.com/.well-known/ory/*
  -> Kratos Public :4433
```

Kratos 配置对应 UI URL：

```yaml
serve:
  public:
    base_url: https://accounts.example.com/

selfservice:
  default_browser_return_url: https://app.example.com/
  flows:
    login:
      ui_url: https://accounts.example.com/auth/login
    registration:
      ui_url: https://accounts.example.com/auth/registration
    recovery:
      ui_url: https://accounts.example.com/auth/recovery
    verification:
      ui_url: https://accounts.example.com/auth/verification
    settings:
      ui_url: https://accounts.example.com/settings
    error:
      ui_url: https://accounts.example.com/auth/error
```

Elements 使用的 SDK 地址必须是浏览器能访问、并能携带 Kratos Cookie 的地址：

```typescript
const config: OryClientConfiguration = {
  sdk: {
    url: "https://accounts.example.com",
    options: { credentials: "include" },
  },
  project: {
    name: "Example Docs",
    default_redirect_url: "https://app.example.com/",
    error_ui_url: "/auth/error",
    login_ui_url: "/auth/login",
    registration_ui_url: "/auth/registration",
    recovery_ui_url: "/auth/recovery",
    verification_ui_url: "/auth/verification",
    settings_ui_url: "/settings",
    registration_enabled: true,
    recovery_enabled: true,
    verification_enabled: true,
  },
}
```

### 7.1 Elements 实际调用哪些接口

Elements 不提供自己的业务 API。它通过 `@ory/client-fetch` 消费 Kratos Public API，核心调用可以归纳成下面四类：

| 阶段 | Kratos Public API | Elements/Next.js 的用途 |
| --- | --- | --- |
| 创建 Flow | `GET /self-service/{login|registration|recovery|verification|settings}/browser` | 创建浏览器流程，取得 Flow ID，并建立 CSRF/Cookie 上下文 |
| 查询 Flow | `GET /self-service/{flow}/flows?id=<flow-id>` | 获得 `ui.nodes`、`ui.messages`、提交地址和当前流程状态 |
| 提交 Flow | `POST /self-service/{flow}?flow=<flow-id>` | 提交密码、验证码、Passkey、Profile 或认证方法按钮等节点值 |
| 查询 Session | `GET /sessions/whoami` | 让 `SessionProvider` 或服务端页面取得当前登录用户 |
| 注销 | `GET /self-service/logout/browser`，再访问返回的 `logout_url` | 创建并执行浏览器注销流程 |
| 展示错误 | `GET /self-service/errors?id=<error-id>` | 获取无法继续留在原 Flow 页面展示的错误 |

其中 `{flow}` 是 `login`、`registration` 等流程名，不是任意业务资源。Elements 最重要的输入仍是“查询 Flow”返回的 JSON；其他接口用于创建、推进或结束这个 Flow。

完整登录过程为：

```text
1. Browser -> GET /self-service/login/browser
2. Gateway -> Kratos；Kratos 创建 Flow、设置 CSRF Cookie
3. Kratos -> 303 /auth/login?flow=<id>
4. Next.js 页面读取 flow 参数和浏览器 Cookie
5. Next.js -> GET Kratos /self-service/login/flows?id=<id>
6. 页面 -> <Login flow={flow} config={config}>
7. Elements 根据 ui.nodes 渲染表单
8. Browser -> Elements -> POST /self-service/login?flow=<id>
9. Kratos 校验成功、设置 Session Cookie，并返回 continue_with/redirect
10. Elements 执行跳转；业务请求再由 Gateway 校验 Session
```

如果第 5 步在 Next.js Server Component 中执行，必须把浏览器的 `Cookie` 请求头转发给 Kratos；否则 Kratos 无法把 Flow 与创建它的 Browser/CSRF 上下文对应起来。浏览器提交阶段则必须设置 `credentials: "include"`。

自托管接入至少需要验证：

- `Set-Cookie`、`Cookie`、`Location` 是否被 Gateway 正确透传；
- `ui.action` 是否是浏览器可访问的外部地址，而不是容器地址；
- Flow 响应是否禁用缓存；
- OIDC 回调和 Passkey Origin/RP ID 是否与最终域名一致；
- Kratos 与 Elements 使用的 Flow/OpenAPI 模型是否兼容。

## 8. 配置和定制什么

Elements 配置的核心只有三组：

| 配置 | 作用 |
| --- | --- |
| `sdk.url/options` | 浏览器提交 Flow 和查询 Session 时访问的 API 地址与 fetch 选项 |
| `project` | 产品名、各 Flow UI URL、功能开关、Logo 和默认回跳地址 |
| `intl` | 当前语言和自定义翻译 |

这些配置主要影响 UI 和 SDK 调用，不能代替 Kratos 配置。例如 `registration_enabled: false` 只会影响 Elements 是否显示注册链接；真正禁止注册仍要在 Kratos 或入口策略中完成。

### 8.1 三层定制

Elements 提供从轻到重的三种定制方式：

1. 使用默认 Flow 组件，不做修改；
2. 用 CSS Variables 修改颜色、圆角、背景和按钮；
3. 通过 `components` 替换 Card、Form 或单个 Node renderer。

例如替换标题区域：

```tsx
import { Login } from "@ory/elements-react/theme"
import { useOryFlow } from "@ory/elements-react"

function CustomCardHeader() {
  const { flowType } = useOryFlow()
  return <header>Example Docs · {flowType}</header>
}

<Login
  flow={flow}
  config={config}
  components={{
    Card: { CardHeader: CustomCardHeader },
  }}
/>
```

替换组件时仍应使用 Elements 提供的 props 和 Context，不要丢掉 hidden CSRF node、disabled 状态、字段错误或 submit button 的 `name/value`。

### 8.2 国际化、事件和临时数据

```tsx
<Registration
  flow={flow}
  config={{
    ...config,
    intl: {
      locale: "zh",
      customTranslations: {
        zh: {
          "identities.messages.1040006": "使用我们的业务文案",
        },
      },
    },
  }}
  transientPayload={{ source: "campaign-a" }}
  onSuccess={(event) => analytics.track("auth_success", event)}
  onValidationError={() => analytics.track("auth_validation_error")}
  onError={() => analytics.track("auth_flow_error")}
/>
```

`transientPayload` 会随 Flow 提交给 Kratos，再进入 webhook 或邮件模板；它不是 Identity Traits，不能用于保存长期用户资料。事件回调适合埋点，但不能改变 Kratos 对认证成功与否的判断。

## 9. SessionProvider 的作用

`SessionProvider` 在客户端调用 `GET /sessions/whoami`，并向子组件提供：

- `session`；
- `isLoading`、`initialized`；
- `error`；
- `refetch()`。

```tsx
import { SessionProvider, useSession } from "@ory/elements-react/client"

function UserMenu() {
  const { session, isLoading } = useSession()
  if (isLoading) return null
  return <span>{session?.identity.traits.email}</span>
}

<SessionProvider baseUrl="https://accounts.example.com">
  <UserMenu />
</SessionProvider>
```

它解决的是前端页面显示当前用户，不是 Gateway 认证。业务 API 仍应由 Gateway/Oathkeeper 校验 Cookie 或内部 JWT，不能因为 React Context 中存在 Session 就信任客户端身份。

## 10. Docker 与 Kubernetes 部署

Elements 自身是 npm 包，没有数据库、Migration、Public/Admin API，也没有必须运行的 `ory/elements` 服务进程。

有两种部署形态：

### 10.1 集成进现有前端

如果 Elements 页面就在现有 React/Next.js 应用中，它随应用一起构建和部署，不新增容器：

```text
frontend image
  ├── 业务页面
  ├── /auth/login
  ├── /auth/registration
  └── @ory/elements-react
```

### 10.2 独立 Account UI

大型系统可以把登录界面做成独立 Next.js 应用：

```text
elements-ui Deployment
  └── Next.js :3000

Gateway
  ├── /auth/*、/settings -> elements-ui:3000
  └── /self-service/*、/sessions/* -> kratos-public:4433
```

本地仓库的 `examples/nextjs-app-router/Dockerfile` 使用多阶段构建：Node/pnpm 构建 Next.js standalone 产物，再用非 root 的 distroless Node 运行 `server.js`。生产项目可以复用这种思路，但应从自己的应用目录构建，而不是直接发布示例镜像。

Kubernetes 不需要 Elements 专用 Helm Chart，普通 Deployment 和 Service 即可：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: elements-ui
spec:
  replicas: 2
  selector:
    matchLabels: { app: elements-ui }
  template:
    metadata:
      labels: { app: elements-ui }
    spec:
      containers:
        - name: ui
          image: registry.example.com/elements-ui:1.0.0
          ports:
            - containerPort: 3000
          env:
            - name: NEXT_PUBLIC_ORY_SDK_URL
              value: https://accounts.example.com
```

Elements UI 是无状态前端，可以水平扩容。真正需要数据库迁移、持久化和备份的是 Kratos；Elements 需要关注的是静态资源缓存、Node 运行时、健康检查、环境变量、CSP、Gateway 路由和端到端 Flow 测试。官方 `ory/kratos` Chart 不会替你部署 Elements UI。

## 11. 什么时候应该使用 Elements

适合使用：

- 前端使用 React 或 Next.js；
- 需要自己托管和定制登录页面；
- 启用了多种 Kratos Flow/认证方式，不想重复实现 UI Node renderer；
- 希望保留替换单个组件、主题和翻译的能力。

不一定适合：

- Vue、Angular、Flutter 等非 React 技术栈；
- UI 与现成组件结构差异极大，替换成本接近重新实现 renderer；
- 只需要 Ory Network 的默认 Account Experience，并不准备定制页面；
- 团队无法为 Kratos、SDK、Elements 的版本组合维护认证 E2E 测试。

如果不用 Elements，也不能写死一张只包含邮箱和密码的表单。仍应基于 `ui.nodes` 实现自己的通用 Flow renderer，否则启用 Code、OIDC、Passkey 或 MFA 后会迅速出现两套不一致的认证逻辑。

## 12. 推荐学习顺序

1. 先阅读上一篇 Kratos Flow，理解 Elements 的输入为什么是 Flow；
2. 运行 `examples/nextjs-app-router`，依次打开 Login、Registration、Recovery、Verification 和 Settings；
3. 查看 `packages/elements-react/src/components/form/nodes/renderer`，理解 UI Node 到组件的映射；
4. 查看 `useOryFormSubmit.ts`，理解不同 Flow 如何提交；
5. 用 CSS Variables 改主题，再替换一个 Card 组件；
6. 最后设计 Gateway 路由，把同一套 UI 接到自托管 Kratos。

定位问题时按这条链路检查：

```text
Kratos 是否创建 Flow
  -> URL 是否带 flow ID
  -> Server/UI 获取 Flow 时是否带 CSRF Cookie
  -> Elements 是否识别并渲染 ui.nodes
  -> 浏览器提交是否 credentials=include
  -> Gateway 是否透传 Cookie、Set-Cookie、Location
  -> Kratos 返回的是字段错误、重启 Flow 还是成功跳转
```

## 13. 总结

Ory Elements 的价值不是“提供一张漂亮登录页”，而是为 Kratos Flow 提供一套可复用的 React 解释器：Flow 决定当前允许用户做什么，Elements 决定如何把这些节点变成可操作界面。

使用时应守住四条边界：

1. Kratos 管理身份状态机，Elements 只负责页面和交互；
2. `@ory/client-fetch` 负责 API 契约，Elements 不替代 SDK；
3. `@ory/nextjs` 主要简化 Next.js/Ory Network 接入，自托管仍要明确 Gateway 和 Cookie 设计；
4. Elements 的前端 Session 只用于 UI，业务 API 的身份信任仍由 Gateway 和后端建立。

只要先确定这四条边界，包选择、Flow 接入、主题定制、Docker 和 Kubernetes 部署就会围绕同一个模型展开。

## 参考资料

- [Ory Elements 产品介绍](https://www.ory.com/elements)
- [Ory Elements GitHub 仓库](https://github.com/ory/elements)
- [Ory Elements v26.2.4 变更说明](https://changelog.ory.com/announcements/ory-network-ory-hydra-ory-kratos-ory-keto-ory-oathkeeper-ory-elements-v26-2-4-released)
- 本地源码：`packages/elements-react`、`packages/nextjs` 与 `examples/nextjs-app-router`
