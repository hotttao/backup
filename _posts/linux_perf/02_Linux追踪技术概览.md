---
title: 1.2 Linux 性能调优概览
date: 2020-01-02
categories:
    - 运维
tags:
    - Linux性能调优
---

为了调试和追踪程序的运行过程，Linux 提供了众多的分析工具，本节我们先对它们做一个宏观概览。
<!-- more -->

![linux-tracing-1.png](/images/linux_pf/linux-tracing-1.png)

## 1. 我们到底要优化什么

在我们了解接下来的各种工具之前，我们首先应该问自己，我们要追踪或者说我们要优化什么。我们都知道程序的运行会占用包括 CPU，内存，文件描述符，锁，磁盘，网络等等在内的各种操作系统资源。根据2/8定律，当其中的某一个或多个资源出现瓶颈的时候，我们需要找到程序中耗费资源最大的地方，并对其优化。

那么我们可能需要做如下这些事情:
1. 对系统资源持续进行观测以及时发现哪些资源出现了瓶颈
2. 统计各个程序(进程)，确定哪个或哪些进程占用了过多的资源
3. 分析问题进程，找出其占用过量资源的原因。

所谓追踪技术本质上就是获取**操作系统记录**中程序运行的各种信息，所以尽管工具多种多样，但本质上都是查询操作系统"数据"的工具。在了解这些工具之前，我们非常有必要先去看看操作系统都提供了哪些数据查询接口，即操作系统提供给我们的观测来源。

## 2. 观测源
![perf_events_map](/images/linux_pf/perf_events_map.png)
Linux 中的观测源被称为 event ，它是不同内核工具框架的统一接口，上面的图片说明了 event 来源:
1. Hardware Events: CPU性能监视计数器 PMCs
2. Software Events: 这些是基于内核计数器的低级事件。例如，CPU迁移、主次缺页异常等等。
3. Kernel Tracepoint Events: 硬编码在内核中的静态内核级的检测点，即静态探针
4. User Statically-Defined Tracing (USDT): 这些是用户级程序和应用程序的静态跟踪点。
5. Dynamic Tracing: 可以被放置在任何地方的动态探针。对于内核软件，它使用kprobes框架。对于用户级软件，uprobes。
6. Timed Profiling: 以指定频率收集的快照。这通常用于CPU使用情况分析，其工作原理是周期性的产生时钟中断事件。

内核维护了部分事件的计数器，通过 /proc 和 /sys 文件系统对外输出。
- /proc 是一个提供内核统计信息的文件系统接口，将内核和进程的统计数据用目录树的形式暴露给用户空间。
- /sys 最初设计用于提供设备驱动的统计信息，不过现在已经扩展到了提供所有信息的统计，/sys 同时也是调整内核参数的入口。

我们也可以各种分析工具，使用抽样的方式收集这些事件发生时内核的上下文信息。

### 2.1 PMCs
PMCs 又称 PMU 全称为硬件计数器，也叫做性能监视计数器(pmmc)或性能仪表计数器(PICs)。它监测低层次的处理器活动，例如，CPU周期，指令退役，内存失速周期，二级缓存丢失，等等。其中一些将作为硬件缓存事件列出。

PMU计数器大部分CPU都有的功能。它可以在这些计数器的计数超过一个特定的值的时候产生一个中断，这个中断，我们可以用和时钟一样的方法，来抽样判断系统中哪个函数发生了最多的Cache失效，分支预测失效等。

典型的处理器将以以下方式实现pmc:在可用的数千个pmc中，只能同时记录几个pmc。这是因为它们是处理器上的固定硬件资源(寄存器的有限数量)，并且被编程为开始计算所选事件。

### 2.2 Software Events
除了 PMU 外，内核也维护了各种统计数据，称为计数器，包括 CPU migrations(处理器迁移次数), minor faults(soft page faults), major faults(hard page faults) 等等。这些数据一般都通过 /proc 文件系统对外输出。

如果开启了Linux 的CONFIG_TASK_DELAY_ACCT 选项，Linux 会跟踪每个任务的延时包括:
1. 调度器延时: 等待 CPU 的延时
2. 块 I/O: 等待块 I/O 的延时
3. 交换: 等待换页的延时
4. 内存回收: 等待内存回收的延时

用户空间的工具通过 taskstats 可以读取这些统计数据，部分统计数据也会通过 /proc 对外提供。

### 2.3 Kernel Tracepoints
静态探针 tracepoints ，是散落在内核源代码中的一些 hook，开启后，它们便可以在特定的代码被运行到时被触发。可以用来跟踪特定的事件。

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

这些跟踪点被硬编码在内核的有用的位置上，以便更高层次的行为可以很容易地被跟踪。例如，系统调用、TCP事件、文件系统I/O、磁盘I/O等等。它们被分组到跟踪点库中;例如，“sock:”表示套接字事件，“sched:”表示CPU调度器事件。跟踪点的一个关键价值是它们应该有一个稳定的API，因此如果您编写的工具在一个内核版本上使用它们，那么它们也应该适用于以后的版本。

Tracepoints 通常通过放置在 include/trace/events/*.XXX 中的宏添加到内核代码中来实现。

下面是 Linux4.10 系统上对 tracepoint 库和数量的统计。

```bash
> perf list | awk -F: '/Tracepoint event/ { lib[$1]++ } END {
    for (l in lib) { printf "  %-16.16s %d\n", l, lib[l] } }' | sort | column
    alarmtimer     4	    i2c            8	    page_isolation 1	    swiotlb        1
    block          19	    iommu          7	    pagemap        2	    syscalls       614
    btrfs          51	    irq            5	    power          22	    task           2
    cgroup         9	    irq_vectors    22	    printk         1	    thermal        7
    clk            14	    jbd2           16	    random         15	    thermal_power_ 2
    cma            2	    kmem           12	    ras            4	    timer          13
    compaction     14	    libata         6	    raw_syscalls   2	    tlb            1
    cpuhp          3	    mce            1	    rcu            1	    udp            1
    dma_fence      8	    mdio           1	    regmap         15	    vmscan         15
    exceptions     2	    migrate        2	    regulator      7	    vsyscall       1
    ext4           95	    mmc            2	    rpm            4	    workqueue      4
    fib            3	    module         5	    sched          24	    writeback      30
    fib6           1	    mpx            5	    scsi           5	    x86_fpu        14
    filelock       10	    msr            3	    sdt_node       1	    xen            35
    filemap        2	    napi           1	    signal         2	    xfs            495
    ftrace         1	    net            10	    skb            3	    xhci-hcd       9
    gpio           2	    nmi            1	    sock           2
    huge_memory    4	    oom            1	    spi            7
```

这些包括:
1. block: 块设备I/O
2. ext4: 文件系统操作
3. kmem: 内核内存分配事件
4. random: 内核随机数生成器事件
5. sched: CPU调度器事件
6. random: 系统调用的进入和返回
7. task: 任务事件

在每次内核升级之后，都有必要检查跟踪点列表，看看是否有新的跟踪点。添加它们是经过充分考虑的，包括评估有多少人会使用它们。需要实现一个平衡:我将包括尽可能少的探测，以充分满足常见需求，任何不寻常或不常见的情况都可以留给动态跟踪。

有关使用跟踪点的示例，请参见[静态内核跟踪](http://www.brendangregg.com/perf.html#StaticKernelTracing)。


### 2.4 User-Level Statically Defined Tracing (USDT)
与内核跟踪点类似，这些跟踪点是硬编码的(通常通过将宏放置在应用程序源代码中)，并作为稳定的API呈现(事件名称和参数)。许多应用程序已经包括跟踪点，这些跟踪点是为了支持DTrace而添加的。然而，许多这些应用程序在Linux上默认情况下并不编译它们。通常需要使用—with-dtrace标志自己编译应用程序。

例如，用这个版本的Node.js编译USDT事件:

```bash
$ sudo apt-get install systemtap-sdt-dev       # adds "dtrace", used by node build
$ wget https://nodejs.org/dist/v4.4.1/node-v4.4.1.tar.gz
$ tar xvf node-v4.4.1.tar.gz 
$ cd node-v4.4.1
$ ./configure --with-dtrace
$ make -j 8
```

检查产生的二进制程序是否包含了 USDT 探测点:

```bash
$ readelf -n node
```
有关使用USDT事件的示例，请参见[静态用户跟踪](http://www.brendangregg.com/perf.html#StaticUserTracing)。

### 2.5 Dynamic Tracing

静态探针跟动态探针之间的区别在于: 静态探针是在编译之前就已经存在代码中的。动态探针是在编译之后软件运行时才加入的，本质上是**内核地址空间的现场修改(live patching)**，所采用的的技术会因处理器类型的不同而有所不同。它们覆盖的范围如下图所示:

![perf_tracepoints_1700](/images/linux_pf/perf_tracepoints_1700.png)


虽然动态跟踪可以看到所有东西，但它也是一个不稳定的接口，因为它检测的是原始代码。这意味着您开发的任何动态跟踪工具在内核补丁或更新之后可能会中断。首先尝试使用静态跟踪点，因为它们的接口应该更加稳定。它们也更容易使用和理解，因为它们是为跟踪最终用户而设计的。

动态跟踪的一个好处是，它可以在活动的系统上启用，而不需要重新启动任何东西。您可以使用一个已经运行的内核或应用程序，然后开始动态检测，它(安全地)在内存中修补指令以添加检测。这意味着在您开始使用此功能之前，此功能的开销或税收为零。这一刻，您的二进制文件还在以全速运行，而下一刻，它又在运行一些您动态添加的额外的检测指令。当您使用完动态跟踪会话后，这些指令最终应该被删除。

在使用动态跟踪和执行额外指令时的开销，与插装事件的频率乘以在每个插装上所做的工作有关。

#### kprobes 和 uprobes
kprobes 和 uprobes 机制就是我们所说的动态探针。它们可以在指定的探测点(比如函数的某行, 函数的入口地址和出口地址, 或者内核的指定地址处)插入一组处理程序。kprobes 主要用于调试内核，uprobes 类似 kprobes, 不过主要用于用户空间的追踪调试。它们作用的位置如下图所示:

![probes](/images/linux_pf/linux-probes.png)

#### 内核参数
使用动态追踪需要启用如下的内核参数:
1. 内核动态跟踪需要启用CONFIG_KPROBES=y和CONFIG_KPROBE_EVENTS=y
3. 用户级动态跟踪需要启用 CONFIG_UPROBES=y和CONFIG_UPROBE_EVENTS=y
2. 为避免内核栈指针优化，需要启用 CONFIG_FRAME_POINTER=y

## 3. 观测工具
按照使用的观测源的不同，我们可以将调优工具分为以下三种:
1. 计数器类
2. 跟踪
3. 剖析

### 3.1 计数器类
计数器类工具读取并展示内核和进程各种统计信息，包括 top，vmstat，mpstat，iostat 等绝大多数我们常用的系统命令。它们的使用可以认为是无成本，因为计数器由内核维护的。

### 3.2 跟踪
跟踪指的是跟踪每一个事件的详细数据，相关的工具包括: 
1. tcpdump: 网络报跟踪
2. blktrace: 块 I/O 跟踪
3. execsnoop: 跟踪新进程(位于后面要讲的高级工具中)

跟踪捕获数据会有 CPU 开销，还需要存储空间存放数据，会拖慢跟踪对象，因此在使用时需要注意工具自身对观测对象的影响。

### 3.3 剖析
剖析通过对目标收集采样或快照来归纳目标特征。跟踪是查看事件的详细数据，剖析可以理解为对事件的统计，以了解系统和程序当前运行的全貌。各种静态和动态追踪技术是完成跟踪和剖析的主要工具。也是我们接下来要介绍的难点内容。

## 4. 动态追踪技术
下面是一个追踪技术的不完全列表。

|工具|使用的 event|特点|
|:---|:---|:---|
|ftrace|静态探针<br>内核的动态探针|1.总体跟踪法，统计了一个事件到下一个事件所有的时间长度<br>2.可以知道整个系统运行在时间轴上的分布<br>3.方法很准确，但跟踪成本很高，只能跟踪内核程序|
|perf|全部的 event|1.抽样跟踪，需要注意抽样导致的结果是否准确<br>2.直接跟踪到整个系统的所有程序<br>perf通常是我们分析系统性能的第一步|
|Dtrace|Solaris 的动态追踪技术||
|Systemtap|Linux 的动态追踪技术||
|eBPF|Linux 4.x 以上版本的动态追踪技术||

在介绍这些工具之前，需要强调的是，无论什么动态追踪技术依赖的都是上面所说的**内核工具框架的统一接口-events**。它们都需要通过 event 去采集内核或者应用程序的运行信息。

### 4.1 ftrace
ftrace 最早用于函数跟踪，后来又扩展支持了各种事件跟踪功能。ftrace 的使用接口跟我们之前提到的 procfs 类似，它通过 debugfs（4.1 以后也支持 tracefs），以普通文件的形式，向用户空间提供访问接口。

### 4.2 perf
perf 主要功能是事件记录和分析，这实际上只是一种最简单的静态跟踪机制。你也可以通过 perf ，来自定义动态事件（perf probe），只关注真正感兴趣的事件。

### 4.3 Dtrace
Solaris 系统的 DTrace 是动态追踪技术的鼻祖，它提供了一个通用的观测框架，并可以使用 D 语言进行自由扩展。

### 4.4 Systemtap
DTrace 本身依然无法在 Linux 中运行。很多工程师都尝试过把 DTrace 移植到 Linux 中，这其中，最著名的就是 RedHat 主推的 SystemTap。

同 DTrace 一样，SystemTap 也定义了一种类似的脚本语言，方便用户根据需要自由扩展。不过，不同于 DTrace，SystemTap 并没有常驻内核的运行时，它需要先把脚本编译为内核模块，然后再插入到内核中执行。这也导致 SystemTap 启动比较缓慢，并且依赖于完整的调试符号表。

为了追踪内核或用户空间的事件，Dtrace 和 SystemTap 都会把用户传入的追踪处理函数（一般称为 Action），关联到被称为探针的检测点上。这些探针的检测点就是各种 events。

### 4.3 eBPF
eBPF 则在 BPF（Berkeley Packet Filter）的基础上扩展而来，不仅支持事件跟踪机制，还可以通过自定义的 BPF 代码（使用 C 语言）来自由扩展。所以，eBPF 实际上就是常驻于内核的运行时，可以说就是 Linux 版的 DTrace。

## 参考
- [Linux 系统动态追踪技术介绍](https://blog.arstercz.com/introduction_to_linux_dynamic_tracing/)
- [在Linux下做性能分析2：ftrace](https://zhuanlan.zhihu.com/p/22130013)