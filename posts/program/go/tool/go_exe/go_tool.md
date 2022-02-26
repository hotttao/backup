---
weight: 1
title: "go tool"
date: 2021-07-01T22:00:00+08:00
lastmod: 2021-07-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go tool 工具集"
featuredImage: 

tags: ["go 工具集"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

```bash
// 编译
GOARCH=386 go tool compile -N -l test.go
// 反编译
GOARCH=386 go tool objdump -gnu test.o
```