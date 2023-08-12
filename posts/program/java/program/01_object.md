---
weight: 1
title: "Java 核心类"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 核心类"
featuredImage: 

tags: ["java 语法"]
categories: ["Java"]

lightgallery: true

toc:
  auto: false
---

## 1. Object
问: 以表格形式，输出 java Object 上定义的默认方法

| 方法签名                                | 描述  |
| --------------------------------------- | -------------------------- |
| `boolean equals(Object obj)`            | 比较对象是否相等。默认实现比较对象引用。          |
| `int hashCode()`                        | 返回对象的哈希码值。默认实现返回对象的内存地址的哈希码。       |
| `String toString()`                     | 返回对象的字符串表示。默认实现返回对象的类名，后跟 "@"，然后是对象的哈希码十六进制表示。|
| `Class<?> getClass()`                   | 返回对象的运行时类。                 |
| `void notify()`                         | 唤醒正在等待该对象的单个线程。                                                     |
| `void notifyAll()`                      | 唤醒正在等待该对象的所有线程。                              |
| `void wait()`                           | 导致当前线程等待，直到另一个线程调用 `notify()` 或 `notifyAll()` 方法。   |
| `void wait(long timeout)`                | 导致当前线程等待，最多等待 `timeout` 毫秒，直到另一个线程调用 `notify()` 或 `notifyAll()` 方法，或超时。   |
| `void wait(long timeout, int nanos)`     | 导致当前线程等待，最多等待 `timeout` 毫秒加上 `nanos` 纳秒，直到另一个线程调用 `notify()` 或 `notifyAll()` 方法，或超时。 |
