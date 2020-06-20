---
title: 2.2 perf 的原理
date: 2020-01-04
categories:
    - 运维
tags:
    - Linux性能调优
---

perf 感觉像是一个完全版的 top，可以帮助我们看到操作系统运行的全貌。perf 的使用非常复杂，本文只是一个入门，推荐大家去阅读大神 Brendangregg 的文章[perf Examples](http://www.brendangregg.com/perf.html)。

<!-- more -->

## 1. perf 简介
### 1.1 perf event
![perf_events_map](/images/linux_pf/perf_events_map.png)

perf 的使用依赖我们前面所说的 **event(事件)**。event 是不同内核工具框架的统一接口，上面的图片说明了 event 来源:
1. Hardware Events: CPU性能监视计数器 PMCs
2. Software Events: 这些是基于内核计数器的低级事件。例如，CPU迁移、主次缺页异常等等。
3. Kernel Tracepoint Events: 硬编码在内核中的静态内核级的检测点，即静态探针
4. User Statically-Defined Tracing (USDT): 这些是用户级程序和应用程序的静态跟踪点。
5. Dynamic Tracing: 可以被放置在任何地方的动态探针。对于内核软件，它使用kprobes框架。对于用户级软件，uprobes。
6. Timed Profiling: 使用`perf -FHz`选项以指定频率收集的快照。这通常用于CPU使用情况分析，其工作原理是周期性的产生时钟中断事件。

list子命令列出当前可用的事件，使用动态跟踪时，就是在扩展下面这个列表。这个列表中的 probe:tcp_sendmsg 探针就是动态插入 tcp_sendmsg() 的示例。

```bash
# perf list
List of pre-defined events (to be used in -e):
  cpu-cycles OR cycles                               [Hardware event]
  instructions                                       [Hardware event]
  cache-references                                   [Hardware event]
  cache-misses                                       [Hardware event]
  branch-instructions OR branches                    [Hardware event]
  branch-misses                                      [Hardware event]
  bus-cycles                                         [Hardware event]
  stalled-cycles-frontend OR idle-cycles-frontend    [Hardware event]
  stalled-cycles-backend OR idle-cycles-backend      [Hardware event]
  ref-cycles                                         [Hardware event]
  cpu-clock                                          [Software event]
  task-clock                                         [Software event]
  page-faults OR faults                              [Software event]
  L1-dcache-loads                                    [Hardware cache event]
  L1-dcache-load-misses                              [Hardware cache event]
  L1-dcache-stores                                   [Hardware cache event]
[...]
  rNNN                                               [Raw hardware event descriptor]
  cpu/t1=v1[,t2=v2,t3 ...]/modifier                  [Raw hardware event descriptor]
   (see 'man perf-list' on how to encode it)
  mem:<addr>[:access]                                [Hardware breakpoint]
  probe:tcp_sendmsg                                  [Tracepoint event]
[...]
  sched:sched_process_exec                           [Tracepoint event]
  sched:sched_process_fork                           [Tracepoint event]
  sched:sched_process_wait                           [Tracepoint event]
  sched:sched_wait_task                              [Tracepoint event]
  sched:sched_process_exit                           [Tracepoint event]
[...]
# perf list | wc -l
     657
```

#### 采样事件
`perf -FHz` 是这样的：perf 每隔一个固定的时间，就在CPU上（每个核上都有）产生一个中断，在中断上看看，当前是哪个pid，哪个函数，然后给对应的pid和函数加一个统计值，这样，我们就知道CPU有百分几的时间在某个pid，或者某个函数上了。

这种方式可以推广到各种事件，此时使用的不再是 `-FHz` 指定的频率，而是 `-e` 参数指定的各种 event。当指定的事件发生的时候，perf 就会上来冒个头，看看击中了谁，然后算出分布，我们就知道谁会引发特别多的那个事件了。

所以本质上 perf 属于一种抽样统计。既然是抽样统计我们就要警惕抽样带来的抽样误差。每次看perf report的报告，首先要去注意一下总共收集了多少个点，如果你只有几十个点，你这个报告就可能很不可信了。

### 1.2 perf 事件说明
#### 软件事件
perf提供了少量固定的软件事件，这些也记录在手册页perf_event_open(2) 中。软件事件可能有一个默认的周期。这意味着当使用它们进行抽样时，是在对事件的子集进行抽样，而不是跟踪每个事件。你可以通过 perf record -vv 查看:

```bash
# perf record -vv -e context-switches /bin/true
Using CPUID GenuineIntel-6-55
------------------------------------------------------------
perf_event_attr:
  type                             1
  size                             112
  config                           0x3
  { sample_period, sample_freq }   4000
  sample_type                      IP|TID|TIME|PERIOD
  disabled                         1
  inherit                          1
  mmap                             1
  comm                             1
  freq                             1
  enable_on_exec                   1
[...]
```

有关这些字段的描述，请参见perf_event_open(2)手册页。这个默认的意思是内核调整采样率，以便它每秒捕获大约4000个上下文切换事件。如果你真的想把它们全部记录下来，请使用-c1:

```bash
# perf record -vv -e context-switches -c 1 /bin/true
Using CPUID GenuineIntel-6-55
------------------------------------------------------------
perf_event_attr:
  type                             1
  size                             112
  config                           0x3
  { sample_period, sample_freq }   1
  sample_type                      IP|TID|TIME
  disabled                         1
  inherit                          1
  mmap                             1
  comm                             1
  enable_on_exec                   1
```

首先使用perf stat检查事件的速率，这样您就可以估计将要捕获的数据量。在默认情况下对子集进行采样可能是一件好事，特别是对于上下文切换这样的高频率事件。许多其他事件(比如跟踪点)的默认值都是1。对于许多软件和硬件事件，您将遇到非1的缺省值。

其他事件参见前文"Linux 性能调优概览"中的说明

### 1.3 perf 使用注意事项
#### idle 进程
现代CPU基本上已经不用忙等的方式进入等待了，所以，如果CPU在idle，击中任务也会停止，所以，在Idle上是没有点的。看到Idle函数本身的点并非CPU Idle的点，而是准备进入Idle前后花的时间。所以，perf的统计不能用来让你分析CPU占用率的。ftrace和top等工具才能看CPU占用率，perf是不行的。

#### 中断
perf还有一个问题是对中断的要求，perf很多事件都依赖中断，但Linux内核是可以关中断的，关中断以后，你就无法击中关中断的点了，你的中断会被延迟到开中断的时候，所以，在这样的平台上，你会看到很多开中断之后的函数被密集击中。但它们是无辜的。但更糟糕的是，如果在关中断的时候，发生了多个事件，由于中断控制器会合并相同的中断，你就会失去多次事件，让你的统计发生错误。

现代的Intel平台，基本上已经把PMU中断都切换为NMI中断了（不可屏蔽），所以前面这个问题不存在。但在大部分ARM/ARM64平台上，这个问题都没有解决，所以看这种平台的报告，都要特别小心，特别是你看到_raw_spin_unlock()一类的函数击中极高，你就要怀疑一下你的测试结果了（注意，这个结果也是能用的，只是看你怎么用）。

## 2.perf 使用
### 2.1 安装

perf的源代码就是Linux的源代码目录中，因为它在相当程度上和内核是关联的。一般Linux 的各种发行版本都会安装好与内核相对应的 perf 命令。perf 有两种安装方式

1. 通过包管理进行安装，perf工具在 linux-tools-common工具包里，通过包管理软件安装的时候还需要依赖linux-tools-kernelversion包
2. 源码编译：找到对应内核版本的源码包，在tools/perf目录下进行编译

### 2.2 使用前提
#### 符号表
与其他调试工具一样，perf_events需要符号信息(符号)。它们被用来将内存地址转换成函数和变量名，以便我们人类能够读取它们。如果没有符号，您将看到十六进制数字表示所分析的内存地址。

类似于 Java Node 这些使用虚拟机编写的程序，使用虚拟机自行管理执行函数和管理堆栈，perf 只能查看到虚拟机级别堆栈，是无法解析语言本身的上下文的。使用 perf 分析java，node 等语言需要需要语言的JIT 提供支持。下面是一些常见语言如何支持 perf 的参考链接:
1. java
  - [perf-map-agent](https://github.com/jvm-profiling-tools/perf-map-agent)
  - [Java in flame](http://techblog.netflix.com/2015/07/java-in-flames.html)
  - [Java火焰图部分](http://www.brendangregg.com/FlameGraphs/cpuflamegraphs.html#Java)
  - [Java Performance Analysis on Linux with Flame Graphs.](http://www.slideshare.net/brendangregg/java-performance-analysis-on-linux-with-flame-graphs)
2. node:
  - [Node.js火焰图在Linux上的步骤](http://www.brendangregg.com/blog/2014-09-17/node-flame-graphs-on-linux.html)

通常软件包的符号表通过类似 `-dbgsym` 命令符号的调试包提供。libc6-dbgsym和coreutils-dbgsym 可以提供用户级 OS 代码页的一些符号表。实在不行只能自己编译软件，保留符号表。

```bash
# 安装内核符号表
yum search debuginfo|grep kernel
yum install kernel-debuginfo
```

#### 省略帧指针优化问题
省略帧指针是编译器默认的优化选项，使得 perf 无法看到完整的堆栈。

有下面几种方法可以解决这个问题:
1. 使用**dwarf**数据展开堆栈:
  - 从3.9内核开始，perf_events 支持用户级栈中缺少帧指针的解决方案:libunwind，叫做 dwarf
  - 使用"--call-graph dwarf"(或“-g dwarf”)启用此功能
  - perf 可以在没有 dwarf 支持的情况下构建。因此是否支持 dwarf 要查阅安装信息
2. 使用可用的最后一个分支记录(**LBR**)(如果处理器特性支持)
  - LBR，全称是 Last Branch Record，需要处理器支持，通常在云环境中都是禁用的
  - LBR通常限制了堆栈深度(8、16或32帧)，所以它可能不适合深度堆栈或火焰图生成
3. **返回帧指针**
4. 还有其他堆栈遍历技术，比如BTS(分支跟踪存储)和新的ORC解卷器


内核也有类似省略帧指针的问题。启动 `CONFIG_FRAME_POINTER=y` 内核选项可以避免此问题。

#### 堆栈追踪深度问题
使用堆栈跟踪要注意的是:
1. 堆栈跟踪受扫描深度的限制，太深的堆栈可能回溯不过去，这是有可能影响结果的。
2. 有些我们从源代码看来是函数调用的，其实在汇编一级并不是函数调用
    - 比如inline函数，宏，都不是函数调用
    - 另外，gcc在很多平台中，会自动把很短的函数变成inline函数，这也不产生函数调用
    - 还有一种是，fastcall函数，通过寄存器传递参数，不会产生调用栈，也有可能不产生调用栈
    - 部分平台使用简化的堆栈回溯机制，在堆栈中看见一个地址像是代码段的地址，就认为是调用栈

### 2.3 perf 的运行方式
perf_events有三种使用方式:
1. 计数模式: 
  - 对应 perf stat 命令，对内核上下文中的事件进行计数，并输出统计的摘要信息
  - 此模式不生成perf.data文件
  - 开销最小
2. 采样事件：
  - 通过采样的方式，将事件数据写入内核缓冲区；
  - 然后以异步的方式，将内核缓冲区的内容写入 perf.data 文件
  - perf report 或 perf script 命令读取 perf.data 并输出结果
  - 开销取决于正在跟踪的事件的频率
3. 事件上的bpf程序: 
  - 这是Linux 4.4+内核中的一个新特性，它可以在内核空间中执行自定义用户定义的程序，可以执行高效的数据筛选和总结。
  - bpf 是先筛选在写入内核缓冲区，相比于采样事件模式高效的多

下面是 perf 三种使用方式的一些示例，我们会在后面详细 perf 的使用。

```bash
# gzip命令的性能计数器总结，包括IPC:
perf stat gzip largefile

# 按照静态探针对进程调度事件进行计数，持续 5s
perf stat -e 'sched:sched_process_*' -a sleep 5

# 按照静态探针跟踪进程调度事件，持续 5s
perf record -e 'sched:sched_process_*' -a sleep 5
perf report

# 按照静态探针跟踪进程调度事件，持续 5s，并转储事件信息信息
perf record -e 'sched:sched_process_*' -a sleep 5
perf script

# 跟踪请求的字节小于10 的 read() 系统调用
perf record -e 'syscalls:sys_enter_read' --filter 'count < 10' -a

# 以 99hz 的频率抽样CPU堆栈
perf record -F 99 -ag -- sleep 5
perf report

# 添加 tcp_sendmsg 动态探针，追踪 5s，并记录堆栈
perf probe --add tcp_sendmsg
perf record -e probe:tcp_sendmsg -ag -- sleep 5
perf probe --del tcp_sendmsg
perf report
```

### 2.3 perf 命令概览
除此上面介绍的三种使用方式之外， perf 还有许多子命令提供特殊用途的功能。这些子命令都是在 perf 三种检测功能的基础上，记录特定的事件并以定制的方式报告，包括:

1. perf c2c (Linux 4.10+): cache-2-cache and cacheline false 共享分析
2. perf kmem: 内核内存分配分析。
3. perf kvm：KVM虚拟客户端分析。
4. perf lock: 锁分析
5. perf mem: 内存访问分析。
6. perf sched: 内核调度器的统计数据

下面是 perf 子命令的一个完整列表。

`perf [--version] [--help] [OPTIONS] COMMAND [ARGS]`

|子命令|作用|
|:---|:---|
|list            |List all symbolic event types<br>列出当前系统支持的所有事件名,可分为三类：硬件事件、软件事件，检查点|
|stat            |Run a command and gather performance counter statistics<br>对程序运行过程中的性能计数器进行统计|
|top             |System profiling tool.<br>对系统的性能进行分析，类似top命令|
|record          |Run a command and record its profile into perf.data<br>	对程序运行过程中的事件进行分析和记录，并写入perf.data|
|report          |Read perf.data (created by perf record) and display the profile<br>读取perf.data(由perf record生成) 并显示分析结果|
|sched           |Tool to trace/measure scheduler properties (latencies)<br>针对调度器子系统的分析工具|
|lock            |Analyze lock events<br>分析内核中的锁信息，包括锁的争用情况，等待延迟等|
|mem             |Profile memory accesses<br>分析内存访问|
|kmem            |Tool to trace/measure kernel memory properties<br>分析内核内存的使用|
|kvm             |Tool to trace/measure kvm guest os<br>分析kvm虚拟机上的guest os|
|timechart       |Tool to visualize total system behavior during a workload<br>对record结果进行可视化分析输出，record命令需要加上timechart记录|
|script          |Read perf.data (created by perf record) and display trace output<br>读取perf.data(由perf record生成)，生成trace记录，供其他分析工具使用|
|data            |Data file related processing<br>把perf.data文件转换成其他格式|
|diff            |Read perf.data files and display the differential profile<br>读取多个perf.data文件，并给出差异分析|
|evlist          |List the event names in a perf.data file<br>列出perf.data中采集的事件列表|
|bench           |General framework for benchmark suites<br>perf提供的基准套件的通用框架，可以对当前系统的调度，IPC，内存访问进行性能评估|
|test            |Runs sanity tests.<br>	perf对当前软硬件平台进行健全性测试，可用此工具测试当前的软硬件平台是否能支持perf的所有功能|
|probe           |Define new dynamic tracepoints<br>用于定义动态检查点|
|trace           |strace inspired tool<br>类似于strace，跟踪目标的系统调用，但开销比strace小|
|ftrace          |simple wrapper for kernel ftrace functionality<br>|
|annotate        |Read perf.data (created by perf record) and display annotated code<br>读取perf.data(由perf record生成)显示反汇编后的代码|
|archive         |Create archive with object files with build-ids found in perf.data file<br>根据perf.data(由perf record生成)文件中的build-id将相关的目标文件打包|
|buildid-cache   |Manage build-id cache.<br>|
|buildid-list    |List the buildids in a perf.data file<br>|
|c2c             |Shared Data C2C/HITM Analyzer.<br>|
|config          |Get and set variables in a configuration file.<br>|
|inject          |Filter to augment the events stream with additional information<br>|
|kallsyms        |Searches running kernel for symbols<br>|
|version         |display the version of perf binary<br>|

### 2.4 perf 一些重要的选项参数
perf 有一些重要的选项参数包括:
1. `-g/--child/--cal-graph`

下面我们来一一讲解
#### -g
perf record 和 perf report 都有 `-g` 选项。perf record 中 `-g` 用于启用堆栈追踪。perf report 中 `-g/--call-graph` 用于指定堆栈的显示方式，这是我们讲解的重点。

`-g/--call-graph` 参数格式为 `<print_type,threshold[,print_limit],order,sort_key[,branch],value>`
- print_type: 
  - 指定堆栈调用图的显示方式
  - 可选值包括 (graph|flat|fractal|folded|none)
  - 默认值为 graph 表示以调用关系图的方式显示堆栈，通常无须更改
- threshold: 
  - 一个百分比值，当函数调用所占用的CPU小于这个百分比值的时候，不显示堆栈信息
  - 默认值为 0.5(表示的是百分之0.5)
- print_limit: 调用关系图显示的最大行数，可不指定
- order: 
  - 调用关系图的显示方式，可选值包括 `(caller|callee)`
  - caller: 默认值，表示基于调用者的调用图
  - callee: caller 的反转，基于被调用者的调用图，也可以使用 `-G` 或者 `--children`
- sort_key: 调用关系图的排序键，可选值包括`(function|address)`，通常无须更改
- branch: 
  - include last branch info to call graph (branch)
  - 可不指定
- value: 
  - call graph value (percent|period|count)
  - 调用关系图中显示什么，CPU占用百分比，CPU周期数，还是调用总次数
  - 默认为 percent，同行无须更改
- 默认值为: graph,0.5,caller,function,percent

这之中最难理解的是 order。我们看下面这个例子

```bash
# perf report --stdio
# ========
# captured on: Mon Jan 26 07:26:40 2014
# hostname : dev2
# os release : 3.8.6-ubuntu-12-opt
# perf version : 3.8.6
# arch : x86_64
# nrcpus online : 8
# nrcpus avail : 8
# cpudesc : Intel(R) Xeon(R) CPU X5675 @ 3.07GHz
# cpuid : GenuineIntel,6,44,2
# total memory : 8182008 kB
# cmdline : /usr/bin/perf record -F 99 -a -g -- sleep 30 
# event : name = cpu-clock, type = 1, config = 0x0, config1 = 0x0, config2 = ...
# HEADER_CPU_TOPOLOGY info available, use -I to display
# HEADER_NUMA_TOPOLOGY info available, use -I to display
# pmu mappings: software = 1, breakpoint = 5
# ========
#
# Samples: 22K of event 'cpu-clock'
# Event count (approx.): 22751
#
# Overhead  Command      Shared Object                           Symbol
# ........  .......  .................  ...............................
#
    94.12%       dd  [kernel.kallsyms]  [k] _raw_spin_unlock_irqrestore
                 |
                 --- _raw_spin_unlock_irqrestore
                    |          
                    |--96.67%-- extract_buf
                    |          extract_entropy_user
                    |          urandom_read
                    |          vfs_read
                    |          sys_read
                    |          system_call_fastpath
                    |          read
                    |          
                    |--1.69%-- account
                    |          |          
                    |          |--99.72%-- extract_entropy_user
                    |          |          urandom_read
                    |          |          vfs_read
                    |          |          sys_read
                    |          |          system_call_fastpath
                    |          |          read
                    |           --0.28%-- [...]
                    |          
                    |--1.60%-- mix_pool_bytes.constprop.17
[...]
```

默认情况下 perf report 使用 caller 即显示基于调用者的调用图。
- 最顶端显示的是最终被调用的子函数。从上往下是调用它的父函数。
- 其中最热(最频繁)的堆栈跟踪发生频率是 90.99%(extract_buf 部分)，它是Overhead列的百分比和顶部堆栈叶(94.12% x 96.67%)的乘积。
- 96.67% 表示的是调用 _raw_spin_unlock_irqrestore 函数的相对百分比，即_raw_spin_unlock_irqrestore的调用次数中，extract_buf 占了 96.67%。
- Overhead 列显示的是这个进程的CPU占用百分比
- 通过使用-G， -g caller 或者 --children 来反转调用关系图

说明: 在我的Linux 上 perf 默认是按照绝对百分显示的 CPU 调用，即extract_buf 显示的是90.99%，不是 96.67%。

#### -s
-s 用于在 perf record 中指定调用关系图的排序字段。可选值包括:
1. overhead: 默认值，Overhead percentage of sample，抽样占比
2. overhead_sys: Overhead percentage of sample running in system mode
3. overhead_us: Overhead percentage of sample running in user mode
4. comm: command (name) of the task which can be read via /proc/<pid>/comm
5. pid: command and tid of the task
7. socket: processor socket number the task ran at the time of sample
6. ....

#### -F
-F 用于指定 perf report 中显示的字段，可选值与 -s 类似。

下面是一个跟踪进程创建的例子，使用-n来打印“Samples”列，使用`--sort comm`来定制其余的列。
```bash
# perf record -e sched:sched_process_exec -a
^C[ perf record: Woken up 1 times to write data ]
[ perf record: Captured and wrote 0.064 MB perf.data (~2788 samples) ]
# perf report -n --sort comm --stdio
[...]
# Overhead       Samples  Command
# ........  ............  .......
#
    11.11%             1    troff
    11.11%             1      tbl
    11.11%             1  preconv
    11.11%             1    pager
    11.11%             1    nroff
    11.11%             1      man
    11.11%             1   locale
    11.11%             1   grotty
    11.11%             1    groff
```

#### --filter
在使用 perf record 进行追踪时，可以通过 --filter 选项对堆栈进行过滤，只记录满足条件的堆栈信息。

```bash

```
