---
weight: 7
title: "Ory Elements：Kratos Flow 的 React 组件与样式定制"
date: 2026-08-30T18:00:00+08:00
lastmod: 2026-09-02T13:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "理解 Ory Elements 提供的组件抽象，以及如何通过配置、CSS Variables 和组件覆盖定制认证页面"
featuredImage:

tags: ["auth", "ory", "elements", "kratos", "react"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

Kratos 负责创建 Login、Registration、Settings 等 Flow，并返回 `ui.nodes`；Ory Elements 将这些节点转换成可以直接使用和定制的 React 页面。

Elements 不是独立身份服务，也不保存用户、校验密码或创建 Session。它是一套安装到 React/Next.js 应用中的 Flow UI 组件。

```text
Kratos
→ 决定 Flow 当前包含哪些 Nodes
→ 校验提交并更新身份状态

Elements
→ 渲染 Nodes
→ 收集输入并提交 Flow
→ 展示错误并执行跳转
```

<!-- more -->

## 1. Elements 在架构中的位置

| 组件 | 职责 |
| --- | --- |
| Kratos | Identity、Credential、Session 和 Self-service Flow |
| `@ory/client-fetch` | 调用 Kratos/Ory HTTP API，提供类型和 SDK |
| `@ory/elements-react` | 把 Flow 渲染为 React 表单并处理提交 |
| `@ory/nextjs` | 为 Next.js 获取 Flow、转发 Cookie、处理代理和跳转 |
| Gateway/Oathkeeper | 在业务 API 入口验证 Session，并向后端传递可信身份 |

```mermaid
flowchart LR
    Browser[Browser]
    UI[React / Next.js UI]
    Elements[@ory/elements-react]
    Next[@ory/nextjs 可选]
    SDK[@ory/client-fetch]
    Kratos[Kratos Public API]

    Browser --> UI
    UI --> Elements
    UI --> Next
    Elements --> SDK
    Next --> SDK
    SDK --> Kratos
```

Elements 的前端 Session 只能用于页面展示。业务 API 仍然必须由 Gateway 或后端验证，不能因为 React Context 中存在用户信息就信任请求身份。

## 2. Elements 提供的组件抽象

Elements 不是一组互不相关的输入框，而是一套从完整页面到单个 UI Node 的分层组件。

```text
Flow Page
└── Provider / Context
    └── Card
        └── Form
            ├── Flow Message
            ├── Form Group
            └── Node Renderer
                ├── Input
                ├── Button
                ├── SSO Button
                ├── Code Input
                ├── Checkbox / Select
                └── Passkey / QR / Image / Hidden Node
```

### 2.1 Flow 页面组件

默认主题提供下面的成品组件：

| 组件 | 输入 | 用途 |
| --- | --- | --- |
| `<Login>` | `LoginFlow` | 密码、Code、OIDC、Passkey 登录和 AAL2 |
| `<Registration>` | `RegistrationFlow` | 注册 Identity 和 Credential |
| `<Recovery>` | `RecoveryFlow` | 账号恢复 |
| `<Verification>` | `VerificationFlow` | 验证邮箱或手机号 |
| `<Settings>` | `SettingsFlow` | 修改 Profile、密码和认证器 |
| `<Error>` | Flow Error | 展示无法附着在普通 Flow 上的错误 |
| `<Consent>` | Consent Request 等数据 | OAuth2 授权同意页面 |

最基本的使用方式是：

```tsx
import { Login } from "@ory/elements-react/theme"

export function LoginPage({ flow, config }: Props) {
  return <Login flow={flow} config={config} />
}
```

`Consent` 不是 Kratos Self-service Flow。接入自托管 Hydra 时，仍然需要 Login/Consent App 后端处理 Hydra Challenge，不能因为存在这个 UI 组件就省略协议适配。

### 2.2 Provider 与 Context

页面组件内部通过 Provider 向下传递：

```text
当前 Flow 及 Flow Type
项目和 SDK 配置
国际化资源
组件覆盖配置
表单提交状态
```

自定义组件可以使用 `useOryFlow()` 等 Hook 读取当前上下文，而不必从页面层逐级传递全部 Props：

```tsx
import { useOryFlow } from "@ory/elements-react"

function AuthTitle() {
  const { flowType } = useOryFlow()
  return <h1>Example Docs · {flowType}</h1>
}
```

### 2.3 Form 抽象

Form 层负责：

```text
根据 ui.action 和 ui.method 提交
管理字段状态和 Loading
显示 Flow 级与字段级错误
携带 transientPayload
处理成功、校验失败和跳转响应
```

Elements 使用 React Hook Form 管理字段，但最终字段定义仍来自 Kratos。前端不能丢弃 `csrf_token`、Method Button 或未知 Node。

### 2.4 Node Renderer

Kratos 的一个 `ui.nodes` 元素可能是普通输入框，也可能是隐藏 CSRF 字段、OIDC 按钮、验证码、WebAuthn Challenge 或二维码。Node Renderer 根据 Node 类型和 Group 选择对应 React 组件。

常见渲染抽象：

| Node 组件 | 处理内容 |
| --- | --- |
| `Input` | identifier、password、profile 等输入 |
| `Button` | password、code、totp 等提交方法 |
| `SsoButton` | OIDC/SAML Provider |
| `CodeInput` | 一次性验证码 |
| `Checkbox`、`Select` | 布尔值和枚举字段 |
| `Label`、`Message` | 标签及 Kratos 返回的错误 |
| Passkey/WebAuthn Renderer | 调用浏览器 Credential API |
| Hidden Renderer | `csrf_token` 等隐藏字段 |

这层抽象使同一个 `<Login>` 能根据 Flow 自动展示不同认证方式：

```text
Kratos 启用认证方法
+ Identity Schema 声明对应字段
+ Flow 返回对应 Nodes
+ Elements 版本能够识别 Nodes
= 页面展示并提交该认证方法
```

### 2.5 Settings Renderer

`<Settings>` 不只是普通表单。它根据 Node Group 分别处理：

```text
Profile
Password
TOTP
Passkey / WebAuthn
Lookup Secret
OIDC 账号关联
```

这些 Group 可能包含二维码、恢复码、浏览器 API 或不同提交方法，因此不应把整个 Settings Flow 简化成几个固定文本框。

### 2.6 Component Overrides

Elements 允许替换不同层级的组件：

```text
Card
→ Root / Header / Content / Footer / Logo / Divider

Node
→ Input / Button / SsoButton / CodeInput / Checkbox / Select / Label

Form
→ Root / Group / SsoRoot / Settings Renderer

Message
→ Root / Content / Toast

Page
→ Header
```

视觉差异小时使用 CSS Variables；只有 DOM 结构、交互或项目组件库不同，才使用 Overrides。

### 2.7 SessionProvider

客户端包提供 `SessionProvider` 和 `useSession()`：

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

它调用 `/sessions/whoami`，为页面提供 `session`、`isLoading`、`error` 和 `refetch()`。它不替代 Gateway 的服务端认证。

## 3. Flow-driven UI 如何运行

```text
Kratos Flow
├── id / type / expires_at
└── ui
    ├── action / method
    ├── messages
    └── nodes[]
          ↓
Elements Provider
          ↓
Node Sorter + Renderer
          ↓
React Hook Form
          ↓
@ory/client-fetch
          ↓
Kratos
```

页面会随服务端状态变化：

- Identity Schema 新增姓名，Registration 增加输入节点；
- 启用 Google OIDC，Login 增加 Provider Button；
- AAL2 Login 只返回 TOTP、WebAuthn 或 Lookup Secret；
- 字段校验失败，错误回到 Flow 或具体 Node；
- Recovery 完成后，Kratos 要求浏览器进入新的 Settings Flow。

Elements 只是 Flow 的解释器。Kratos 仍然负责状态机、CSRF、Credential 校验和 Session。

## 4. 如何接入 Elements

### 4.1 React 应用

```bash
npm install @ory/elements-react @ory/client-fetch react react-dom
```

应用需要负责：

```text
创建 Browser Flow
从 URL 读取 Flow ID
查询 Flow
把 Flow 交给对应页面组件
正确转发 Cookie、Set-Cookie 和 Location
```

### 4.2 Next.js 应用

```bash
npm install @ory/elements-react @ory/nextjs
```

`@ory/nextjs` 提供 App Router、Pages Router 和 Middleware 适配，用于获取 Flow、Session、Logout 和 Error。

```tsx
import { Login } from "@ory/elements-react/theme"
import { getLoginFlow, OryPageParams } from "@ory/nextjs/app"
import config from "@/auth/ory-config"

export default async function LoginPage(props: OryPageParams) {
  const flow = await getLoginFlow(config, props.searchParams)
  if (!flow) return null
  return <Login flow={flow} config={config} />
}
```

`@ory/nextjs` 的现成 Middleware 主要面向 Ory Network。接入自托管 Kratos 时，仍需验证代理路径、Cookie、外部 URL 和 Location Rewrite，不能直接假设配置完全通用。

### 4.3 自托管 Kratos 的域名设计

推荐让 UI 和 Kratos Browser API 位于同一 Origin：

```text
https://accounts.example.com/auth/*
→ Next.js Elements UI

https://accounts.example.com/self-service/*
https://accounts.example.com/sessions/*
https://accounts.example.com/.well-known/ory/*
→ Kratos Public API
```

配置中的 SDK 地址必须是浏览器可访问的外部地址：

```typescript
const config = {
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
  },
  intl: { locale: "zh" },
}
```

服务端组件查询 Flow 时必须转发浏览器 Cookie；浏览器提交时必须使用 `credentials: "include"`。同时验证 Gateway 是否正确处理 `Set-Cookie`、`Cookie`、`Location` 和 `ui.action`。

## 5. 样式定制的四个层次

Elements 的样式全部由前端控制，Kratos 配置中不存在按钮颜色、字体或页面布局。

```text
品牌配置
→ 名称、Logo、语言

CSS Variables
→ 色彩、字体、边框和圆角

页面 Layout
→ 背景、导航、分栏和响应式

Component Overrides
→ DOM 结构和项目组件库
```

应从改动最小的一层开始，不要为了修改颜色而重写 Node Renderer。

### 5.1 品牌名称、Logo 和语言

```typescript
const config = {
  project: {
    name: "Example Docs",
    logo_light_url: "/brand/logo.svg",
    hide_ory_branding: true,
    // Flow URL 省略
  },
  intl: {
    locale: "zh",
    customTranslations: {
      zh: {
        "identities.messages.1040006": "使用项目自己的业务文案",
      },
    },
  },
}
```

Logo 放在项目静态资源或受信 CDN 中，并配置 CSP。隐藏 Ory Branding 是否受部署形态或套餐限制，应以实际环境为准。

### 5.2 使用 CSS Variables 对接 Design Token

先导入默认样式，再导入项目覆盖：

```tsx
import "@ory/elements-react/theme/styles.css"
import "@/styles/tokens.css"
import "@/styles/ory-theme.css"
```

不要复制后直接修改 Elements 发布包的 `styles.css`。升级依赖后，复制文件无法自动获得修复。项目只覆盖公开变量：

```css
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

变量可以分成三类：

| 层级 | 示例 | 建议 |
| --- | --- | --- |
| 基础色板 | `--brand-500` | 整体更换色板时使用 |
| 语义变量 | `--interface-background-brand-primary` | 优先与项目 Token 对接 |
| 具体组件 | `--button-primary-background-default` | 只调整特定控件时使用 |

变量名称以当前安装版本最终导入的 `theme/styles.css` 为准，升级 Elements 后需要重新核对。

### 5.3 页面 Layout

认证页背景、双栏布局和导航属于项目页面，不属于 Flow：

```tsx
export default function AuthLayout({ children }: React.PropsWithChildren) {
  return (
    <main className="auth-theme auth-page">
      <section className="auth-brand-panel">Example Docs</section>
      <section className="auth-form-panel">{children}</section>
    </main>
  )
}
```

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

这样 Flow 组件只负责认证表单，页面结构仍由产品前端掌控。

### 5.4 使用 Component Overrides 接入组件库

如果项目 Button、Input 或 Card 的 DOM、Loading 和无障碍行为与默认主题不同，再使用 Overrides：

```tsx
import { getNodeLabel } from "@ory/client-fetch"
import type {
  OryFlowComponentOverrides,
  OryNodeButtonProps,
} from "@ory/elements-react"

function AppButton({ node, buttonProps, isSubmitting }: OryNodeButtonProps) {
  const label = getNodeLabel(node)

  return (
    <button
      {...buttonProps}
      disabled={isSubmitting || buttonProps.disabled}
      className="app-button app-button--primary"
    >
      {isSubmitting ? "提交中…" : label?.text ?? node.attributes.name}
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

所有 Flow 复用同一份适配器：

```tsx
<Login flow={flow} config={config} components={oryComponents} />
```

替换 Renderer 时必须保留 Node 协议：

- Hidden Node 和 `csrf_token` 必须提交；
- Button 的 `name`、`value` 用于区分 password、code、oidc 等方法；
- Input 的 `name`、`type`、`required`、`disabled`、`autocomplete` 不能丢失；
- React Hook Form 提供的 `ref` 必须连接真实输入元素；
- Flow Messages 和 Node Messages 必须显示；
- Passkey、WebAuthn、OIDC、AAL2、Recovery 和 Settings 都要回归测试。

不要只用邮箱输入框实现所有 Node，否则 Password、Hidden CSRF 和 WebAuthn Flow 都会被破坏。

### 5.5 深色模式和多品牌

CSS Variables 可以按主题或租户作用域覆盖：

```css
.dark .auth-theme {
  --interface-background-default-primary: #111827;
  --interface-background-default-secondary: #1f2937;
  --interface-border-default-primary: #374151;
  --interface-foreground-default-primary: #f9fafb;
}

.auth-theme[data-brand="acme"] {
  --interface-background-brand-primary: #7c3aed;
  --interface-background-brand-primary-hover: #6d28d9;
  --interface-border-brand-brand: #7c3aed;
}
```

租户主题必须来自服务端可信配置，不能允许 URL 参数直接注入任意 CSS 或 Logo URL。服务端渲染时应在首次输出前确定主题，避免 Hydration Mismatch 和页面闪烁。

## 6. 配置、临时数据和事件

Elements 配置主要分为：

| 配置 | 作用 |
| --- | --- |
| `sdk` | API 地址和 Fetch 选项 |
| `project` | 产品名、Flow UI URL、Logo 和显示开关 |
| `intl` | Locale 和自定义翻译 |
| `components` | 组件覆盖 |

这些配置只影响 UI 和 SDK 调用，不能代替 Kratos 服务端配置。例如 Elements 隐藏注册链接，不表示 Kratos Registration API 已被禁用。

页面组件还支持临时数据和事件：

```tsx
<Registration
  flow={flow}
  config={config}
  transientPayload={{ source: "campaign-a" }}
  onSuccess={(event) => analytics.track("auth_success", event)}
  onValidationError={() => analytics.track("auth_validation_error")}
  onError={() => analytics.track("auth_flow_error")}
/>
```

`transientPayload` 可以进入 Webhook 或模板，但不是长期 Identity Traits。事件回调适合埋点，不能改变 Kratos 对认证结果的判断。

## 7. 部署方式

Elements 是 npm 包，没有数据库、Migration 或独立 API。

### 7.1 集成进现有前端

```text
frontend image
├── 业务页面
├── /auth/login
├── /auth/registration
└── @ory/elements-react
```

它随已有 React/Next.js 应用一起构建，不增加服务。

### 7.2 独立 Account UI

大型系统可以单独部署认证前端：

```text
Gateway
├── /auth/*、/settings
│   → elements-ui :3000
└── /self-service/*、/sessions/*
    → kratos-public :4433
```

Elements UI 是无状态前端，可以使用普通 Deployment 和 Service 水平扩容，不需要专用 Helm Chart。需要数据库、迁移和备份的是 Kratos。

部署重点是：

```text
环境变量和外部 API URL
Cookie、CORS 与反向代理
静态资源缓存和 CSP
健康检查
Kratos / SDK / Elements 版本组合的 E2E 测试
```

## 8. 什么时候使用 Elements

适合：

- 前端使用 React 或 Next.js；
- 需要自托管并定制认证页面；
- 使用多种 Kratos Flow，不想重复实现 Node Renderer；
- 希望复用 Flow 逻辑，同时替换主题或局部组件。

不一定适合：

- 使用 Vue、Angular、Flutter 等非 React 技术栈；
- 页面结构与 Elements 差异极大，覆盖成本接近重写；
- 使用 Ory Network 默认 Account Experience，不需要自定义 UI。

不用 Elements 时也不能只写死邮箱和密码表单。仍然需要基于 `ui.nodes` 实现通用 Flow Renderer，才能支持 Code、OIDC、Passkey、MFA 和未来新增节点。

## 9. 推荐项目结构

```text
src/
├── app/auth/layout.tsx       # 认证页布局
├── auth/ory-config.ts        # API、Flow URL、品牌和语言
├── auth/ory-components.tsx   # Elements 到项目组件库的适配
├── styles/tokens.css         # 项目 Design Token
└── styles/ory-theme.css      # Design Token 到 Elements Variables
```

对应原则：

```text
CSS Variables
→ 视觉一致性

Component Overrides
→ 组件结构一致性

Page Layout
→ 产品页面结构

Kratos Flow
→ 认证状态和安全协议
```

## 10. 总结

Ory Elements 的价值不是提供一张固定登录页，而是提供一套 Kratos Flow 的 React 解释器。

使用时按下面的顺序定制：

```text
先使用完整 Flow 页面组件
→ 配置名称、Logo 和语言
→ 用 CSS Variables 对接 Design Token
→ 用项目 Layout 控制页面结构
→ 必要时通过 Overrides 替换局部组件
```

只要自定义组件仍然保留 Kratos Node 的字段、CSRF、错误和提交语义，就可以同时获得项目自己的视觉体系与 Elements 对各种认证方法的兼容能力。

## 参考资料

- [Ory Elements](https://www.ory.com/elements)
- [Ory Elements GitHub](https://github.com/ory/elements)
- [上一篇：Ory Kratos Workflow 执行细节](./005_ory_kratos_example.md)
