---
title: 2.1 ftrace 的原理与使用
date: 2020-01-03
categories:
    - 运维
tags:
    - Linux性能调优
---

最早 ftrace 是一个 function tracer，仅能够记录内核的函数调用流程。如今 ftrace 已经成为一个 framework，采用 plugin 的方式支持开发人员添加更多种类的 trace 功能。

<!-- more -->

## 1. ftrace 简介
Ftrace 最初是在 2.6.27 中出现，那时 systemTap 已经开始崭露头角，其他的 trace 工具包括 LTTng 等也已经发展多年。那为什么人们还要再开发一个 trace 工具呢？

SystemTap 目标是达到甚至超越 Dtrace 。因此 SystemTap 设计比较复杂，在真正的产品环境，人们依然无法放心的使用她。不当的使用和 SystemTap 自身的不完善都有可能导致系统崩溃。

Ftrace 的设计目标简单，本质上是一种静态代码插装技术，不需要支持某种编程接口让用户自定义 trace 行为。静态代码插装技术更加可靠，不会因为用户的不当使用而导致内核崩溃。 ftrace 代码量很小，稳定可靠。实际上，即使是 Dtrace，大多数用户也只使用其静态 trace 功能。因此 ftrace 的设计非常务实。

## 2. ftrace 原理
![ftrace_arch](/images/linux_pf/ftrace_arch.png)
Ftrace 有两大组成部分:
1. 一是 framework
2. 二是一系列的 tracer， 每个 tracer 完成不同的功能，它们统一由 framework 管理
3. ftrace 的 trace 信息保存在 ring buffer 中，由 framework 负责管理
4. Framework 利用 debugfs 系统在 /debugfs 下建立 tracing 目录，并提供了一系列的控制文件

## 3. ftrace 使用

## 参考
- [ftrace 简介](https://www.ibm.com/developerworks/cn/linux/l-cn-ftrace/index.html)