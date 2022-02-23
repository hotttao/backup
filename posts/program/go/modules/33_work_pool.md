---
weight: 1
title: "go Work Pool"
date: 2021-06-23T22:00:00+08:00
lastmod: 2021-06-23T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go 协程池"
featuredImage: 

tags: ["go 库"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

我们在 Go 第四部分 Go 并发系列的 [sync.Pool]({{< ref "posts/program/go/sync/go_sync_10.md" >}}) 和 [channel]({{< ref "posts/program/go/sync/go_sync_14.md" >}}) 提到了很多用于 Go 协程池的第三方库，今天我们就来详细介绍它们的使用和实现。
