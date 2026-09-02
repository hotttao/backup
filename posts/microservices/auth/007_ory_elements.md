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

本教学项目的 `ui_example` 当前以已安装版本为准：

```text
@ory/elements-react  1.2.1
@ory/client-fetch    1.22.22
```

后文关于默认主题的 CSS Variable、组件 Props 和运行行为，均以这两个版本实际发布到 `node_modules` 的代码为准。升级依赖后，应重新检查 `dist/theme/default/index.css` 和类型定义，不要只根据旧示例推断变量名称。

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
    Card: { Header: CustomCardHeader },
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

## 9. 如何接入项目自己的 UI 样式

### 9.1 先理解样式由谁控制

Kratos 不定义页面样式，Kratos 配置文件里也没有“按钮颜色”或“输入框圆角”。它只产生 `ui.nodes`。样式全部发生在运行 Elements 的前端项目中：

```text
项目 Design Token
  │
  ├── 映射为 Elements CSS Variables   -> 改颜色、字体、边框、圆角
  │
  ├── components Renderer Overrides   -> 改 Card、Button、Input 的结构
  │
  └── 页面 Layout                     -> 改背景、导航、左右分栏和响应式布局
```

因此，接入项目样式时应按下面的顺序进行：

1. 保留 Elements 默认主题和 Flow renderer；
2. 将项目 Design Token 映射成 Elements CSS Variables；
3. 默认组件结构无法满足设计稿时，只替换相应组件；
4. 只有整体交互完全不同时，才自行实现完整 Flow renderer。

这种顺序能保留 Elements 对 Code、Passkey、OIDC、AAL2 和新增 UI Node 的兼容能力。

### 9.2 第一层：品牌名称和 Logo

默认 `Card.Logo` 会读取 `project.logo_light_url`；没有 Logo 时显示 `project.name`：

```typescript
const config: OryClientConfiguration = {
  project: {
    name: "Example Docs",
    logo_light_url: "/brand/logo.svg",
    hide_ory_branding: true,
    // 其他 Flow URL 省略
  },
}
```

Logo 应放入本项目的静态资源并走相同 CDN。如果使用外部域名，还要把域名加入 CSP 的 `img-src`。`hide_ory_branding` 是否可用以及是否受套餐限制，应以实际使用的 Ory 部署形态为准。

### 9.3 第二层：把项目 Design Token 映射为 CSS Variables

先在应用入口导入 Elements 默认样式，再导入项目覆盖样式。以 Next.js App Router 为例：

```tsx
// app/layout.tsx
import "@ory/elements-react/theme/styles.css"
import "@/styles/globals.css"
import "@/styles/ory-theme.css" // 放在默认主题之后
```

源码的 PostCSS 构建使用 `postcss-scope(".ory-elements")`，默认 `Card.Root` 也会添加 `ory-elements` class，因此发布包中的 Tailwind Preflight 和组件规则被限制在 Elements 根节点内，不应扩散成整个项目的全局 Reset。自己的组件如果完全替换了 `Card.Root`，应继续保留 `ory-elements` class，否则默认主题规则可能失效。

不要复制并修改 Elements 发布包中的 `styles.css`。升级依赖后那份副本不会自动更新。应在自己的 `ory-theme.css` 中覆盖公开的 CSS Variables：

```css
/* 项目已有的 Design Token */
:root {
  --app-color-primary: #2563eb;
  --app-color-primary-hover: #1d4ed8;
  --app-color-surface: #ffffff;
  --app-color-surface-muted: #f8fafc;
  --app-color-border: #cbd5e1;
  --app-color-text: #0f172a;
  --app-color-text-muted: #475569;
  --app-font-sans: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
}

/* 只影响认证页面，不污染业务页面 */
.auth-theme {
  --font-sans: var(--app-font-sans);

  --interface-background-brand-primary: var(--app-color-primary);
  --interface-background-brand-primary-hover: var(--app-color-primary-hover);
  --interface-background-default-primary: var(--app-color-surface);
  --interface-background-default-secondary: var(--app-color-surface-muted);

  --interface-border-brand-brand: var(--app-color-primary);
  --interface-border-default-primary: var(--app-color-border);

  --interface-foreground-brand-primary: var(--app-color-primary);
  --interface-foreground-default-primary: var(--app-color-text);
  --interface-foreground-default-secondary: var(--app-color-text-muted);

  --radius-buttons: 0.5rem;
  --radius-forms: 0.5rem;
  --radius-cards: 1rem;
}
```

注意：在当前 `@ory/elements-react@1.2.1` 发布包的运行时 CSS 中，圆角变量名称是 `--radius-*`，不是源码生成文件中可能出现的 `--border-radius-*`。当前版本实际使用的公开圆角变量包括 `--radius-buttons`、`--radius-forms`、`--radius-general`、`--radius-branding`、`--radius-cards` 和 `--radius-identifier`。如果升级 Elements，应以最终导入的 `theme/styles.css` 实际引用名称为准。

然后在认证 Layout 上设置作用域：

```tsx
// app/auth/layout.tsx
export default function AuthLayout({ children }: React.PropsWithChildren) {
  return (
    <main className="auth-theme auth-page">
      <section className="auth-brand-panel">Example Docs</section>
      <section className="auth-form-panel">{children}</section>
    </main>
  )
}
```

页面背景、双栏布局和导航属于项目 Layout，不应塞进 Flow 组件：

```css
.auth-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(20rem, 1fr) minmax(30rem, 1fr);
  background: var(--app-color-surface-muted);
}

.auth-brand-panel,
.auth-form-panel {
  display: grid;
  place-items: center;
  padding: 2rem;
}

@media (max-width: 768px) {
  .auth-page { grid-template-columns: 1fr; }
  .auth-brand-panel { display: none; }
}
```

Elements 的变量大致分为三层：

| 层级 | 示例 | 适用场景 |
| --- | --- | --- |
| 基础色 | `--ui-500`、`--brand-500` | 整体换一套色板，会影响大量下游变量 |
| 语义色 | `--interface-background-brand-primary`、`--interface-border-default-primary` | 推荐与项目 Design Token 对接 |
| 具体组件 | `--button-primary-background-default`、`--input-border-focus` | 只调整某一类控件 |
| 形状 | `--radius-buttons`、`--radius-forms`、`--radius-cards` | 统一项目圆角体系 |

一般优先覆盖语义层。只有“登录按钮必须与其他主按钮不同”时，才覆盖具体组件变量。不要依赖 `bg-form-background-default`、`sm:w-[480px]` 这类内部 Tailwind class 名称作为长期扩展 API，它们可能随 Elements 升级变化。

### 9.4 第三层：替换成项目组件库

当项目的 Button、Input 或 Card 不只是颜色不同，而是 DOM 结构、Loading、图标或无障碍行为都不同，就通过 `components` 注入项目组件。

Elements 当前开放的主要替换点是：

```text
Card    -> Root / Header / Content / Footer / Logo / Divider
Node    -> Button / SsoButton / Input / Select / CodeInput / Checkbox / Label ...
Form    -> Root / Group / SsoRoot / 各 Settings renderer
Message -> Root / Content / Toast
Page    -> Header
```

建议集中定义一份适配器，让 Login、Registration、Recovery、Verification 和 Settings 共用：

```tsx
// auth/ory-components.tsx
"use client"

import { getNodeLabel } from "@ory/client-fetch"
import type {
  OryFlowComponentOverrides,
  OryNodeButtonProps,
} from "@ory/elements-react"
import { uiTextToFormattedMessage } from "@ory/elements-react"
import { useIntl } from "react-intl"

function AppButton({ node, buttonProps, isSubmitting }: OryNodeButtonProps) {
  const label = getNodeLabel(node)
  const intl = useIntl()

  return (
    <button
      {...buttonProps} // 保留 type、name、value、disabled 等 Flow 语义
      disabled={isSubmitting || buttonProps.disabled}
      className="app-button app-button--primary"
    >
      {isSubmitting
        ? "提交中…"
        : label
          ? uiTextToFormattedMessage(label, intl)
          : node.attributes.name}
    </button>
  )
}

function AppCardHeader() {
  return (
    <header className="app-auth-header">
      <img src="/brand/logo.svg" alt="Example Docs" />
      <h1>登录 Example Docs</h1>
    </header>
  )
}

export const oryComponents: OryFlowComponentOverrides = {
  Card: { Header: AppCardHeader },
  Node: { Button: AppButton },
}
```

所有 Flow 使用同一份覆盖：

```tsx
<Login
  flow={flow}
  config={config}
  components={oryComponents}
/>
```

替换 Node renderer 时，外观是次要问题，首要要求是完整保留 Kratos 节点协议：

- `<input type="hidden">` 和 `csrf_token` 必须继续提交；
- Button 的 `name`、`value` 用于区分 `password`、`code`、`oidc` 等 method，不能丢；
- Input 的 `name`、`type`、`required`、`disabled`、`autocomplete` 不能随意重写；
- 必须展示 `node.messages` 和 Flow 级错误；
- Loading 时防止重复提交，但不能永久禁用其他认证 method；
- Passkey、WebAuthn、TOTP、OIDC、Recovery 和 Settings 页面都要回归测试。

当前版本中，`OryNodeInputProps` 同时提供两类信息：`attributes` 描述 Kratos 节点约束，`inputProps` 描述 React Hook Form 运行时字段。完全替换 `Input` 时至少要从两者读取：

```tsx
function AppInput({ attributes, inputProps }: OryNodeInputProps) {
  return (
    <input
      {...inputProps}
      required={attributes.required}
      name={attributes.name}
      type={inputProps.type}
      disabled={inputProps.disabled}
      autoComplete={inputProps.autoComplete}
      ref={inputProps.ref}
    />
  )
}
```

`inputProps.ref` 必须连接到最终的真实输入元素；如果组件还接收外部 ref，需要用 `forwardRef` 合并两个 ref。密码输入、验证码输入和隐藏的 `csrf_token` 不能简单地按邮箱文本框处理。

如果只替换 `Input`，还要处理普通输入框、密码框和隐藏字段；如果只按邮箱输入框实现，CSRF 或密码节点会被破坏。本地源码中的 `examples/nextjs-app-router-custom-components` 展示了完整的组件覆盖入口，可以作为适配项目组件库的起点。

### 9.5 深色模式和多品牌

CSS Variables 可以放在主题作用域中，所以不需要维护两份 Elements CSS：

```css
.dark .auth-theme {
  --interface-background-default-primary: #111827;
  --interface-background-default-secondary: #1f2937;
  --interface-border-default-primary: #374151;
  --interface-foreground-default-primary: #f9fafb;
  --interface-foreground-default-secondary: #d1d5db;
}

.auth-theme[data-brand="acme"] {
  --interface-background-brand-primary: #7c3aed;
  --interface-background-brand-primary-hover: #6d28d9;
  --interface-border-brand-brand: #7c3aed;
}
```

多租户场景应由服务端根据可信租户配置选择 `data-brand` 和 Logo，不能允许 URL 参数直接注入任意 CSS 或资源地址。认证页也应在首次渲染前确定主题，避免服务端与客户端主题不同造成闪烁或 Hydration mismatch。

### 9.6 推荐落地方式

对于已有 React/Next.js 项目，推荐目录如下：

```text
src/
├── app/auth/layout.tsx          # 项目认证页布局
├── auth/ory-components.tsx      # Elements -> 项目组件库适配
├── auth/ory-config.ts           # Flow URL、名称、Logo、语言
├── styles/tokens.css            # 项目 Design Token
└── styles/ory-theme.css         # Design Token -> Elements Variables
```

最终原则是：**CSS Variables 解决视觉一致性，Component Overrides 解决组件结构一致性，页面 Layout 解决产品页面结构；不要为了改颜色重写 Flow renderer。**

## 10. SessionProvider 的作用

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

## 11. Docker 与 Kubernetes 部署

Elements 自身是 npm 包，没有数据库、Migration、Public/Admin API，也没有必须运行的 `ory/elements` 服务进程。

有两种部署形态：

### 11.1 集成进现有前端

如果 Elements 页面就在现有 React/Next.js 应用中，它随应用一起构建和部署，不新增容器：

```text
frontend image
  ├── 业务页面
  ├── /auth/login
  ├── /auth/registration
  └── @ory/elements-react
```

### 11.2 独立 Account UI

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

## 12. 什么时候应该使用 Elements

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

## 13. 推荐学习顺序

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

## 14. 总结

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
