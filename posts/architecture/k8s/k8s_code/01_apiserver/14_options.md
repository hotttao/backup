---
weight: 1
title: "API Server 配置项"
date: 2023-03-06T22:00:00+08:00
lastmod: 2023-03-06T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "kube-apiserver schema api 对象元数据管理"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---

## 1. SecureServingOptions 

```go
// k8s.io/apiserver/pkg/server/options/serving.go
type SecureServingOptions struct {
    BindAddress net.IP // 监听地址，如果不指定，则默认为 0.0.0.0
    BindPort int // 监听端口，如果 Listener 被设置，则忽略 BindPort，即使为 0 也会提供 https 服务。
    BindNetwork string // 监听网络类型，默认为 "tcp"，接受 "tcp", "tcp4" 和 "tcp6"
    Required bool // 设置为 true 意味着 BindPort 不能为 0。
    ExternalAddress net.IP // 广告地址，即使 BindAddress 是回环地址，也会进行广告。默认情况下，如果 BindAddress 不是回环地址，则设置为 BindAddress，否则设置为第一个主机接口地址。
    // Listener 是安全服务器网络监听器。
    // Listener 或 BindAddress/BindPort/BindNetwork 之一已设置，
    // 如果设置了 Listener，则使用它并省略 BindAddress/BindPort/BindNetwork。
    Listener net.Listener

    // ServerCert 是用于服务安全流量的 TLS 证书信息。
    ServerCert GeneratableKeyCert
    // SNICertKeys 是具有 SNI 支持的命名 CertKeys 用于服务安全流量。
    SNICertKeys []cliflag.NamedCertKey
    // CipherSuites 是服务器允许的密码套件列表。
    // 值来自 tls 包常量 (https://golang.org/pkg/crypto/tls/#pkg-constants)。
    CipherSuites []string
    // MinTLSVersion 是支持的最小 TLS 版本。
    // 值来自 tls 包常量 (https://golang.org/pkg/crypto/tls/#pkg-constants)。
    MinTLSVersion string

    // HTTP2MaxStreamsPerConnection 是 api 服务器对每个客户端强制执行的限制。
    // 0 表示使用 golang 的 HTTP/2 支持提供的默认值。
    HTTP2MaxStreamsPerConnection int

    // PermitPortSharing 控制在绑定端口时是否使用 SO_REUSEPORT，这允许多个实例绑定在相同的地址和端口上。
    PermitPortSharing bool

    // PermitAddressSharing 控制在绑定端口时是否使用 SO_REUSEADDR。
    PermitAddressSharing bool
}
```