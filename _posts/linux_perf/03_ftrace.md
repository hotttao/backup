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
3. ftrace 的 trace 信息保存在 ring buffer(内存缓冲区) 中，由 framework 负责管理
4. Framework 利用 debugfs 系统在 /debugfs 下建立 tracing 目录，对用户空间输出 trace 信息，并提供了一系列的控制文件
5. ftrace的目录设置和sysfs类似，都是把目录当作对象，把里面的文件当作这个对象的属性。debugfs/tracing 目录可以理解成一个独立的监控实例 instance，在 tracing 目录或者子目录创建任何目录相当于创建了一个新的 ftrace 实例，ftrace 会为这个 ftrace 实例自动内存缓冲区，并在这个目录下创建 ftrace 实例所需与 tracing 目录完全相同的文件。  

debugfs在大部分发行版中都mount在/sys/kernel/debug目录下，而ftrace就在这个目录下的tracing目录中。如果系统没有mount这个文件系统，可以手动 mount。

```bash

# 1. 重新挂在 debugfs  
mount -t debugfs none /debugs

# 2. debugfs/tracing 目录
ll /debugs/tracing

# 3. 创建新的 ftrace trace 实例
mkdir /debugs/tracing/instance/python

# ftrace 会创建新的内存缓冲区并生成 ftrace 相关文件
ll tracing/instances/python/
总用量 0
-r--r--r--   1 root root 0 5月  29 04:04 available_tracers
-rw-r--r--   1 root root 0 5月  29 04:04 buffer_size_kb
-r--r--r--   1 root root 0 5月  29 04:04 buffer_total_size_kb
-rw-r--r--   1 root root 0 5月  29 04:04 current_tracer
drwxr-xr-x  58 root root 0 5月  29 04:04 events
-rw-r--r--   1 root root 0 5月  29 04:04 free_buffer
drwxr-xr-x 130 root root 0 5月  29 04:04 per_cpu
-rw-r--r--   1 root root 0 5月  29 04:04 set_event
-rw-r--r--   1 root root 0 5月  29 04:04 snapshot
-rw-r--r--   1 root root 0 5月  29 04:04 trace
-rw-r--r--   1 root root 0 5月  29 04:04 trace_clock
--w--w----   1 root root 0 5月  29 04:04 trace_marker
-rw-r--r--   1 root root 0 5月  29 04:04 trace_options
-r--r--r--   1 root root 0 5月  29 04:04 trace_pipe
-rw-r--r--   1 root root 0 5月  29 04:04 tracing_cpumask
-rw-r--r--   1 root root 0 5月  29 04:04 tracing_max_latency
-rw-r--r--   1 root root 0 5月  29 04:04 tracing_on

```

## 3. ftrace 控制机制

在讲解 ftrace 的 tracer 之前，我们先来看看 tracing 目录下的文件，它们提供了对 ftrace trace 过程的控制。

```bash
ll /debugs/tracing/ -s
总用量 0
0 -r--r--r--   1 root root 0 5月  28 18:51 available_events
0 -r--r--r--   1 root root 0 5月  28 18:51 available_filter_functions
0 -r--r--r--   1 root root 0 5月  28 18:51 available_tracers
0 -rw-r--r--   1 root root 0 5月  28 18:51 buffer_size_kb
0 -r--r--r--   1 root root 0 5月  28 18:51 buffer_total_size_kb
0 -rw-r--r--   1 root root 0 5月  28 18:51 current_tracer
0 -r--r--r--   1 root root 0 5月  28 18:51 dyn_ftrace_total_info
0 -r--r--r--   1 root root 0 5月  28 18:51 enabled_functions
0 drwxr-xr-x  58 root root 0 5月  28 18:51 events
0 -rw-r--r--   1 root root 0 5月  28 18:51 free_buffer
0 -rw-r--r--   1 root root 0 5月  28 18:51 function_profile_enabled
0 drwxr-xr-x   2 root root 0 5月  28 18:51 hwlat_detector
0 drwxr-xr-x   3 root root 0 5月  28 18:51 instances
0 -rw-r--r--   1 root root 0 5月  28 18:51 kprobe_events
0 -r--r--r--   1 root root 0 5月  28 18:51 kprobe_profile
0 -rw-r--r--   1 root root 0 5月  28 18:51 max_graph_depth
0 drwxr-xr-x   2 root root 0 5月  28 18:51 options
0 drwxr-xr-x 130 root root 0 5月  28 18:51 per_cpu
0 -r--r--r--   1 root root 0 5月  28 18:51 printk_formats
0 -r--r--r--   1 root root 0 5月  28 18:51 README
0 -r--r--r--   1 root root 0 5月  28 18:51 saved_cmdlines
0 -rw-r--r--   1 root root 0 5月  28 18:51 saved_cmdlines_size
0 -rw-r--r--   1 root root 0 5月  28 18:51 set_event
0 -rw-r--r--   1 root root 0 5月  28 18:51 set_ftrace_filter
0 -rw-r--r--   1 root root 0 5月  28 18:51 set_ftrace_notrace
0 -rw-r--r--   1 root root 0 5月  28 18:51 set_ftrace_pid
0 -r--r--r--   1 root root 0 5月  28 18:51 set_graph_function
0 -rw-r--r--   1 root root 0 5月  28 18:51 snapshot
0 -rw-r--r--   1 root root 0 5月  28 18:51 stack_max_size
0 -r--r--r--   1 root root 0 5月  28 18:51 stack_trace
0 -r--r--r--   1 root root 0 5月  28 18:51 stack_trace_filter
0 -rw-r--r--   1 root root 0 5月  28 18:51 trace
0 -rw-r--r--   1 root root 0 5月  28 18:51 trace_clock
0 --w--w----   1 root root 0 5月  28 18:51 trace_marker
0 -rw-r--r--   1 root root 0 5月  28 18:51 trace_options
0 -r--r--r--   1 root root 0 5月  28 18:51 trace_pipe
0 drwxr-xr-x   2 root root 0 5月  28 18:51 trace_stat
0 -rw-r--r--   1 root root 0 5月  28 18:51 tracing_cpumask
0 -rw-r--r--   1 root root 0 5月  28 18:51 tracing_max_latency
0 -rw-r--r--   1 root root 0 5月  28 18:51 tracing_on
0 -rw-r--r--   1 root root 0 5月  28 18:51 tracing_thresh
0 -rw-r--r--   1 root root 0 5月  28 18:51 uprobe_events
0 -r--r--r--   1 root root 0 5月  28 18:51 uprobe_profile

```

### 4. ftrace tracer

## 参考

- [ftrace 简介](https://www.ibm.com/developerworks/cn/linux/l-cn-ftrace/index.html)