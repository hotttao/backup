---
title: 1.1 Linux 性能调优入门指南
date: 2020-01-01
categories:
    - 运维
tags:
    - Linux性能调优
    - 入门指南
---
![linux_perf](/images/linux_pf/linux_perf.jpg)
这个系列文章，目的是学习一下 Linux 的性能优化，希望下一次服务器出问题时，不是只会一个 top。Linux 性能优化与 Linux 操作系统密切相关，所以想要学好非常不容易。
<!-- more -->

## 1. 系列大纲
下面是 Linux 性能优化系列文章的大纲:
1. 动态追踪: 将介绍常见的静态和动态追踪技术的原理和使用，包括 ftrace，perf，DTrace，Systemtap 等
2. 操作系统：将介绍 CPU，内存，文件系统，磁盘，网络的基本原理以及可监测它们的工具(命令)
3. 高级工具: 将介绍基于动态追踪技术的一些高级工具，包括:
    - [perf-tool](https://github.com/brendangregg/perf-tools)
    - [systemtap-lwtools](https://github.com/brendangregg/systemtap-lwtools)
    - [DTraceToolkit](https://github.com/opendtrace/toolkit)
    - [bpf-perf-tools](https://github.com/brendangregg/bpf-perf-tools-book.git)
    - [bpf-bcc](https://github.com/iovisor/bcc)
    - [openresty-systemtap](https://github.com/openresty/openresty-systemtap-toolkit)
    - [openresty_stapxx](https://github.com/openresty/stapxx)
4. 高级语言性能优化: 将介绍如何利用上面介绍的工具，对 Python，Go，Java 进行性能调优，使用这些工具的好处是语言无关，更加具有普适性。

## 2. 学习资源
下面是我在学习过程中发现的学习资源，推荐大家阅读。本系列的文章也参考了很多他们的内容，在此特别说明。
1. [《性能之巅》](https://book.douban.com/subject/26586598/)
2. [极客时间专栏-Linux性能优化实战](https://time.geekbang.org/column/intro/140)
3. [动态追踪技术漫谈](https://blog.openresty.com.cn/cn/dynamic-tracing/)
3. Systemtap:
    - [优秀的systemtap学习资源](https://github.com/lichuang/awesome-systemtap-cn)
    - [SystemTap新手指南中文](https://spacewander.gitbooks.io/systemtapbeginnersguide_zh/content/index.html)
    - [SystemTap Tapset Reference Manual](https://sourceware.org/systemtap/tapsets/)
5. Python:
    - [使用 DTrace 和 SystemTap 检测 CPython](https://www.docs4dev.com/docs/zh/python/3.7.2rc1/all/howto-instrumentation.html)