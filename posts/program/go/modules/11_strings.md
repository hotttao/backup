---
weight: 1
title: "go 文本操作"
date: 2021-06-02T22:00:00+08:00
lastmod: 2021-06-02T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go 字符操作"
featuredImage: 

tags: ["go 库"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

## 1. 字符操作
strings 和 bytes 提供了 go 语言中的字符操作，因为还不不支持泛型，所以这两个包提供了几乎一样的函数和类型，区别仅仅在于一个操作 string，一个操作 []byte。
