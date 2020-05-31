---
title: 2.4 perf Python
date: 2020-01-06
categories:
    - 运维
tags:
    - Linux性能调优
---

perf 提供了优化 Python 的脚本。类似于 Python，Java 这些采用虚拟机的语言，通过 perf 只能看到虚拟机的调用栈，但是对于调试来说极其难以阅读。perf 为调试高级语言提供了额外的工具，今天我们就来看看如何用 perf python script 来调试 Python。

<!-- more -->

![dtrace_arch](/images/linux_pf/dtrace_arch.png)

## 1. perf python script




## 参考
- [manpage-perf-python](https://www.man7.org/linux/man-pages/man1/perf-script-python.1.html)