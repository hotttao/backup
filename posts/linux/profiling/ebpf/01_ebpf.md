---
weight: 1
title: "eBPF 简介"
date: 2022-03-01T22:00:00+08:00
lastmod: 2022-03-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Linux profiling - eBPF"
featuredImage: 

tags: ["profiling"]
categories: ["Linux"]

lightgallery: true

toc:
  auto: false
---

这个系列我们来学习 Linux profiling 的另一款大杀器 - eBPF，学习资源来自于[极客时间倪朋飞老师专栏-eBPF 核心技术与实战](https://time.geekbang.org/column/intro/100104501?tab=catalog)。

## 1. eBPF 简介
eBPF 是什么呢？ 从它的全称“扩展的伯克利数据包过滤器 (Extended Berkeley Packet Filter)” 来看，它是一种数据包过滤技术，是从 BPF (Berkeley Packet Filter) 技术扩展而来的。不同于内核模块直接注入到内核的运行方式，eBPF 借助即时编译器（JIT），在内核中运行了一个虚拟机，保证了只有被验证安全的 eBPF 指令才会被内核执行。同时，因为 eBPF 指令依然运行在内核中，无需向用户态复制数据，这就大大提高了事件处理的效率。

eBPF 现如今已经有了大量的实战应用:
1. Facebook 开源的高性能网络负载均衡器 [Katran](https://github.com/facebookincubator/katran)
2. Isovalent 开源的容器网络方案 [Cilium](https://cilium.io/) 
3. 著名的内核跟踪排错工具 [BCC](https://github.com/iovisor/bcc) 和 [bpftrace](https://github.com/iovisor/bpftrace) 等
4. 最流行的网络解决方案之一 Calico，就在最近的版本中引入了 [eBPF 数据面网络](https://www.tigera.io/blog/introducing-the-calico-ebpf-dataplane/)，大大提升了网络的性能。

下图（来自 [ebpf.io](https://ebpf.io/)）是对 eBPF 技术及其应用的一个概览：

![ebpf 应用](/images/ebpf/ebpf_apply.webp)

## 2. eBPF 发展历程
eBPF 有 BPF 发展而来，时至今日 eBPF 经历如下重大的时间节点:
1. 1992 年的 USENIX 会议上，Steven McCanne 和 Van Jacobson 发布的论文[“The BSD Packet Filter: A New Architecture for User-level Packet Capture”](https://www.tcpdump.org/papers/bpf-usenix93.pdf) 为 BSD 操作系统带来了革命性的包过滤机制 BSD Packet Filter（简称为 BPF）
2. 1997 年，在 BPF 诞生五年后，Linux 2.1.75 首次引入了 BPF 技术
3. 2011 年，Linux 3.0 中增加的 BPF 即时编译器，替换掉了原本性能更差的解释器，进一步优化了 BPF 指令运行的效率。
4. 2014 年，为了研究新的软件定义网络方案，Alexei Starovoitov 为 BPF 带来了第一次革命性的更新，将 BPF 扩展为一个通用的虚拟机，也就是 eBPF。eBPF 不仅扩展了寄存器的数量，引入了全新的 BPF 映射存储，还在 4.x 内核中将原本单一的**数据包过滤事件**逐步扩展到了**内核态函数、用户态函数、跟踪点、性能事件（perf_events）**以及安全控制等。
5.  2015 年，iovisor 带来的 BCC、bpftrace 等工具，成为 eBPF 在跟踪和排错领域的最佳实践
6.  2016 年 Linux 4.7-4.10 带来了**跟踪点、perf 事件、XDP 以及 cgroups 的支持**，丰富了 **eBPF 的事件源**
7.  2017 年，BPF 成为内核独立子模块，并支持了 KTLS、bpftool、libbpf 等
8.  2018 年，BPF 新增了轻量级调试信息格式 BTF 以及新的 AF_XDP 类型，bpftrace 和 bpffilter 项目也正是发布
9.  2019 年，BPF 新增了尾调用和热更新支持，GCC 也开始支持 BPF 编译，童年 Cilium1.6 发布基于 BPF的服务发现代理，完全替代基于 iptables 的 kube-proxy
10. 2020 Google 和 Facebook 为 BPF 新增 LSM 和 TCP 拥塞控制的支持，主流云厂商开始通过 SRIOV 支持 XDP
11. 2021 EPBFacebook 软件基金会成立，BPF 开始支持内核函数调用，Cilium 发布基于 eBPF 的 Service Mesh 取代代理。


## 3. eBPF 工作过程
### 3.1 eBPF 执行过程
eBPF 程序并不像常规的线程那样，启动后就一直运行在那里，它需要事件触发后才会执行。这些事件包括系统调用、内核跟踪点、内核函数和用户态函数的调用退出、网络事件，等等。借助于强大的内核态插桩（kprobe）和用户态插桩（uprobe），eBPF 程序几乎可以在内核和应用的任意位置进行插桩。

那 eBPF 到底是如何工作的呢？如下图（图片来自[brendangregg.com](https://www.brendangregg.com/ebpf.html)）所示，通常我们借助 [LLVM](https://llvm.org/) 把编写的 eBPF 程序转换为 BPF 字节码，然后再通过 bpf 系统调用提交给内核执行。内核在接受 BPF 字节码之前，会首先通过验证器对字节码进行校验，只有校验通过的 BPF 字节码才会提交到即时编译器执行。

![ebpf 执行过程](/images/ebpf/ebpf_run.webp)

确保安全和稳定一直都是 eBPF 的首要任务，如果 BPF 字节码中包含了不安全的操作，验证器会直接拒绝 BPF 程序的执行。比如，下面就是一些典型的验证过程：
- 只有特权进程才可以执行 bpf 系统调用；
- BPF 程序不能包含无限循环；
- BPF 程序不能导致内核崩溃；
- BPF 程序必须在有限时间内完成

### 3.2 eBPF 交互
BPF 程序可以利用 **BPF 映射（map）**进行存储，而用户程序通常也需要通过 BPF 映射同运行在内核中的 BPF 程序进行交互。如下图（图片来自[ebpf.io](https://ebpf.io/)）所示，在性能观测中，BPF 程序收集内核运行状态存储在映射中，用户程序再从映射中读出这些状态。

![ebpf 执行过程](/images/ebpf/ebpf_storage.webp)

可以看到，eBPF 程序的运行需要历经编译、加载、验证和内核态执行等过程，而用户态程序则需要借助 BPF 映射来获取内核态 eBPF 程序的运行状态。

### 3.3 eBPF 局限
eBPF 不是万能的:
1. eBPF 程序必须被验证器校验通过后才能执行，且不能包含无法到达的指令；
2. eBPF 程序不能随意调用内核函数，只能调用在 API 中定义的辅助函数；
3. eBPF 程序栈空间最多只有 512 字节，想要更大的存储，就必须要借助映射存储；
4. 在内核 5.2 之前，eBPF 字节码最多只支持 4096 条指令，而 5.2 内核把这个限制提高到了 100 万条；
5. 由于内核的快速变化，在不同版本内核中运行时，需要访问内核数据结构的 eBPF 程序很可能需要调整源码，并重新编译。

## 4. eBPF 学习路线
最后附上 eBPF 的学习路径思维导图:

![ebpf 思维导图](/images/ebpf/ebpf_learn.webp)

## 参考
本文内容摘录自:
1. [极客时间倪朋飞老师专栏-eBPF 核心技术与实战](https://time.geekbang.org/column/intro/100104501?tab=catalog)
