---
weight: 1
title: "Rust 模块"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Rust 模块"
featuredImage: 

tags: ["rust 语法"]
categories: ["Rust"]

lightgallery: true

toc:
  auto: false
---

## 1. 模块
### 1.1 :: 和 .
问: 对比 rust 中 :: 和 . 各自适用的场景

在 Rust 中，`::` 和 `.` 运算符分别用于不同的场景，具体如下：

- `::` 运算符：
  - 用于访问模块中的函数、常量、类型等。
  - 用于访问枚举类型的成员。
  - 用于访问静态变量。
  - 用于在不同的命名空间中访问项，如引用其他模块中的项。
  - 在 trait 中，用于访问相关函数。
  - 在关联类型中，用于引用关联项。

- `.` 运算符：
  - 用于访问结构体、枚举、联合体的字段和方法。
  - 用于调用结构体实例的方法。
  - 用于调用实现了 trait 的类型的方法。
  - 用于调用迭代器和其他类型的方法。
  - 用于访问关联类型和关联常量。

## 1.2 crate
Rust 中把包称为 crate。包分为两类:
1. binary crate: 用于生成可执行程序的二进制包
2. library crate: 用于复用功能的库包（，代码包）。
