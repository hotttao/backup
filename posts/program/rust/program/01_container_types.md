---
weight: 1
title: "Rust 复合数据类型"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Rust 所有权"
featuredImage: 

tags: ["rust 语法"]
categories: ["Rust"]

lightgallery: true

toc:
  auto: false
---

## 1. String 实现
问: 以简化代码的形式，描述 rust String 的数据结构

Rust 中的 `String` 数据结构可以简化为以下代码：

```rust
pub struct String {
    ptr: *mut u8,  // 指向字符串数据的指针
    len: usize,    // 字符串长度
    capacity: usize,  // 字符串当前分配的容量
}
```

在这个简化的表示中，`String` 结构体包含了三个字段：

- `ptr`：一个指向堆上存储字符串数据的指针，类型为 `*mut u8`。通过这个指针，可以访问字符串的字节数据。
- `len`：一个表示字符串的实际长度的字段，类型为 `usize`。它表示字符串的有效字符数，不包括结尾的空字符。
- `capacity`：一个表示当前分配的堆内存容量的字段，类型为 `usize`。它表示字符串目前可以容纳的最大字符数，超过这个容量时，需要重新分配更大的内存。
