---
weight: 12
title: "12 Kubernetes 与 Istio 标签约定"
date: 2026-09-06T19:00:00+08:00
lastmod: 2026-09-06T19:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "区分 Kubernetes 应用标签、Istio 流量配置标签与 ServiceAccount workload identity，理解它们在 AuthorizationPolicy 中的作用。"
featuredImage:
tags: ["gateway", "istio", "kubernetes"]
categories: ["microservice"]

lightgallery: true

toc:
  auto: false
---

Kubernetes 标签经常同时承担应用编排、运维查询和服务治理的筛选作用。需要先区分一个容易混淆的事实：
`app.kubernetes.io/*` 不是 Istio 专用标签，而是 Kubernetes 推荐的通用应用标签；Istio 也可以使用
这些标签选择 workload，但不会因此自动启用 Istio 或自动授权。

<!-- more -->

## 1. 三类不同的标识

当前项目中的标识可以分成三类：

| 类别 | 示例 | 谁使用 | 主要作用 |
| --- | --- | --- | --- |
| Kubernetes 推荐应用标签 | `app.kubernetes.io/name: xhs` | Kubernetes、Helm、运维工具、Istio selector | 标识应用、实例和组件 |
| Istio 配置标签 | `istio.io/dataplane-mode: ambient` | Istio 控制面和 ztunnel | 加入 Ambient、选择 Waypoint 或控制注入 |
| Workload identity | `spiffe://cluster.local/ns/ddd-learn/sa/frontend` | ztunnel、AuthorizationPolicy | 认证工作负载并执行身份授权 |

标签只是一组键值对；不同控制器只会解释自己认识的键。`ServiceAccount` 不是 label，但它是 Istio
生成 workload identity 的输入。

## 2. Kubernetes 推荐的 `app.kubernetes.io/*` 标签

Kubernetes 推荐使用以下通用标签：

| 标签 | 作用 | 示例 |
| --- | --- | --- |
| `app.kubernetes.io/name` | 应用名称 | `xhs` |
| `app.kubernetes.io/instance` | 应用的唯一实例，通常对应 Helm release | `xhs` |
| `app.kubernetes.io/version` | 应用版本 | `1.16.0` |
| `app.kubernetes.io/component` | 应用中的组件类型 | `backend`、`database` |
| `app.kubernetes.io/part-of` | 所属系统或产品 | `ddd-learn` |
| `app.kubernetes.io/managed-by` | 管理该资源的工具 | `Helm` |

这些标签主要用于查询、分组、选择器和工具集成。例如当前 xhs Helm Chart 的 Pod 标签是：

```yaml
app.kubernetes.io/name: xhs
app.kubernetes.io/instance: xhs
app.kubernetes.io/version: "1.16.0"
app.kubernetes.io/managed-by: Helm
```

`fullnameOverride: xhs-service` 只改变 Deployment 和 Service 的名称，不会把
`app.kubernetes.io/name` 改成 `xhs-service`。因此当前策略选择的是：

```yaml
selector:
  matchLabels:
    app.kubernetes.io/name: xhs
    app.kubernetes.io/instance: xhs
```

另外，`helm.sh/chart: xhs-0.1.0` 是 Helm 常用标签，不属于 Istio 标签，也不是
`app.kubernetes.io/*` 推荐标签中的一项。

## 3. Istio 常用标签

Istio 使用带有 `istio.io/` 或 `sidecar.istio.io/` 前缀的标签控制数据面行为。

### 3.1 Ambient 和 Waypoint

```yaml
istio.io/dataplane-mode: ambient
```

给 namespace 添加该标签后，namespace 中新建或重新创建的 Pod 会由 Istio Ambient 接管。当前实验的
配置是：

```yaml
metadata:
  name: ddd-learn
  labels:
    istio.io/dataplane-mode: ambient
```

Waypoint 相关标签用于选择或声明 Waypoint 的作用范围：

| 标签 | 作用 |
| --- | --- |
| `istio.io/use-waypoint: <waypoint-name>` | 指定 namespace、Service 或 workload 使用的 Waypoint |
| `istio.io/waypoint-for: service` | 声明 Waypoint 主要为 Service 流量提供七层处理 |

没有 Waypoint 时，Ambient 主要由 ztunnel 提供 L4 转发、mTLS 和 L4 授权；需要 HTTP 路由、重试、
超时或 L7 授权时，才引入 Waypoint。

### 3.2 Sidecar 注入与控制面版本

```yaml
sidecar.istio.io/inject: "true"
```

用于 namespace 或 Pod 级别控制 Sidecar Envoy 自动注入。在 Ambient 模式下通常不需要给业务 Pod
注入 Sidecar；不要把 Sidecar 注入标签和 `istio.io/dataplane-mode: ambient` 混为一谈。

```yaml
istio.io/rev: <revision>
```

用于选择指定 revision 的 Istio 控制面，常用于多版本控制面升级或灰度。它控制的是连接哪个
Istiod，不是业务授权规则。

## 4. 标签与 AuthorizationPolicy 的关系

AuthorizationPolicy 中有两个不同层次的匹配：

```yaml
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: xhs
      app.kubernetes.io/instance: xhs
  rules:
    - from:
        - source:
            principals:
              - cluster.local/ns/ddd-learn/sa/frontend
```

它们的职责不同：

```text
selector.matchLabels
→ 找到被保护的目标 workload：xhs Pod

source.principals
→ 判断请求来源 workload：frontend ServiceAccount
```

`selector` 可以匹配任意 Pod 标签，并不要求使用 Istio 标签。当前策略使用 Kubernetes 推荐标签
选择 xhs，使用 ServiceAccount 对应的 SPIFFE principal 识别 frontend。

## 5. ServiceAccount 不是普通标签

frontend Pod 的定义是：

```yaml
spec:
  serviceAccountName: frontend
```

Ambient ztunnel 根据 namespace 和 ServiceAccount 得到工作负载身份：

```text
spiffe://cluster.local/ns/ddd-learn/sa/frontend
```

因此：

- Pod IP 是流量定位地址，Pod 重建后可能变化；
- `app.kubernetes.io/name` 是应用分类标签，可以被 selector 使用；
- ServiceAccount 是 workload 的身份来源；
- SPIFFE principal 是 mTLS 和 AuthorizationPolicy 使用的认证身份。

`automountServiceAccountToken: false` 只是不把 Kubernetes API 访问令牌挂载进业务容器，不能删除或
改变 ServiceAccount，也不会阻止 ztunnel 使用该 ServiceAccount 建立 Istio workload identity。

## 6. 当前项目的组合关系

```text
Namespace/ddd-learn
└── istio.io/dataplane-mode=ambient
    ├── Pod/xhs-service
    │   ├── app.kubernetes.io/name=xhs
    │   ├── app.kubernetes.io/instance=xhs
    │   └── ServiceAccount=xhs-service
    │       └── spiffe://cluster.local/ns/ddd-learn/sa/xhs-service
    ├── Pod/ambient-frontend
    │   └── ServiceAccount=frontend
    │       └── spiffe://cluster.local/ns/ddd-learn/sa/frontend
    └── AuthorizationPolicy/xhs-allow-frontend
        ├── selector → Pod/xhs-service
        └── principals → frontend workload identity
```

这个组合体现了三种配置的边界：namespace 标签决定是否接入 Ambient，应用标签决定策略选择哪个
workload，ServiceAccount principal 决定哪个调用方可以访问该 workload。
