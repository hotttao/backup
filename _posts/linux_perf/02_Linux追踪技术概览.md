---
title: 1.1 Linux 追踪技术概览
date: 2020-01-01
categories:
    - 运维
tags:
    - Linux性能调优
---

为了调试和追踪程序的运行过程，Linux 提供了众多的分析工具，本节我们就来看看有哪些追踪技术以及它们的基本原理。
<!-- more -->

## 1. 我们到底在追踪什么

在我们了解接下来的各种工具之前，我们首先应该问自己，我们要追踪或者说我们要优化什么。我们都知道程序的运行会占用包括 CPU，内存，文件描述符，锁，磁盘，网络等等在内的各种操作系统资源。根据2/8定律，当其中的某一个或多个资源出现瓶颈的时候，我们需要找到程序中耗费资源最大的地方，并对其优化。

那么我们可能需要做如下这些事情:
1. 对系统资源持续进行观测以及时发现哪些资源出现了瓶颈
2. 统计各个程序(进程)，确定哪个或哪些进程占用了过多的资源
3. 分析问题进程，找出其占用过量资源的原因。

所谓追踪技术本质上就是获取**操作系统记录**中程序运行的各种信息，所以尽管工具多种多样，但本质上都是查询操作系统"数据"的工具。每一个工具都要解决如下几个问题:
1. 以什么方式: 即如何获取当前资源占用情况
1. 以多大的频率去统计操作系统信息，显然我们不能在每个 CPU 指令之后都发起一次统计
2. 在什么位置，是在系统级别还是进程级别去分析问题产生的原因

这三面也是接下来我们讲解各个追踪技术的切入点。在了解这些工具之前，我们非常有必要先去看看操作系统都提供了哪些数据查询接口，即操作系统提供给我们的观测来源。

## 2. 观测来源
### 1.1 /proc 和 /sys 虚拟文件系统
/proc 是一个提供内核统计信息的文件系统接口。将内核和进程的统计数据用目录树的形式暴露给用户空间。很多系统级别的工具都是基于 /proc 提供的信息工作的。

/sys 最初设计用于提供设备驱动的统计信息，不过现在已经扩展到了提供所有信息的统计。/sys 同时也是调整内核参数的入口。

### 1.2 PMU(CPU 性能计数器)
CPU的PMU计数器是大部分CPU都有的功能。它们可以用来统计比如L1 Cache失效的次数，分支预测失败的次数等。PMU可以在这些计数器的计数超过一个特定的值的时候产生一个中断，这个中断，我们可以用和时钟一样的方法，来抽样判断系统中哪个函数发生了最多的Cache失效，分支预测失效等。(我们把诸如 Cache 失效等硬件相关的信息称为 Hardware event)

除了 PMU 外，内核也维护了各种统计数据，包括 CPU migrations(处理器迁移次数), minor faults(soft page faults), major faults(hard page faults)，我们把这些数据也称为计数器。(注: 我们把诸如 minor faults 软件相关的信息称为 Software Events)

PMU 和内核维护的计数器，都是通过 /proc 和 /sys 对外提供的。

### 1.3 静态探针
静态探针 tracepoints 又称为事件是散落在内核源代码中的一些 hook，开启后，它们便可以在特定的代码被运行到时被触发。

如果你看过内核源码，经常会看到下面这种 trace_开头的函数调用：
```c
if (likely(prev != next)) {
                rq->nr_switches++;
                rq->curr = next;
                ++*switch_count;

                trace_sched_switch(preempt, prev, next);  # trace_ 开头的函数调用
                rq = context_switch(rq, prev, next, cookie); /* unlocks the rq */
        } else {
                lockdep_unpin_lock(&rq->lock, cookie);
                raw_spin_unlock_irq(&rq->lock);
        }
```

trace_sched_switch 就是一个事件，程序执行到这个地方就会把这个点（就是一个整数，而不是函数名），加上后面的三个参数（preempt, prev, next)都写到缓冲区中。ftrace 可以读取并保存这些信息，perf 可以在事件被触发时收到通知，dtrace 和 systemtap 可以在事件触发时执行指定的 "action"。

静态探针是在编译之前就已经存在代码中的。

### 1.4 动态探针
![probes](/images/linux_pf/linux-probes.png)

kprobes 和 uprobes 机制就是我们所说的动态探针。它们可以在指定的探测点(比如函数的某行, 函数的入口地址和出口地址, 或者内核的指定地址处)插入一组处理程序。动态探针是在编译之后软件运行时才加入的，本质上是**内核地址空间的现场修改(live patching)**，所采用的的技术会因处理器类型的不同而有所不同。这也是静态探针和动态探针的区别所在。

kprobes 主要用于调试内核，uprobes 类似 kprobes, 不过主要用户空间的追踪调试。


## 2.追踪原理
基于上面的讨论，我们就可以对追踪技术做一个简单的分类。下面是一个追踪技术的不完全列表，接下来我们会一一简单介绍它们的基本原理。
|工具|类别|适用范围|
|:---|:---|:---|
|ftrace|||
|strace|||
|perf|||
|Dtrace|Solaris 的动态追踪技术||
|Systemtap|Linux 的动态追踪技术||
|eBPF|||
|LTTng|||
|ktap|||

### 2.1 ftrace

### 2.2 strace

### 2.3 strace

### 2.4 Dtrace

### 2.5 Systemtap
![systemtap-works](/images/linux_pf/how-systemtap-works.webp)

### 2.6 eBPF




## 参考
- [Linux 系统动态追踪技术介绍](https://blog.arstercz.com/introduction_to_linux_dynamic_tracing/)