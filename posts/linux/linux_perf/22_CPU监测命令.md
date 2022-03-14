---
weight: 1
title: 4.2 CPU 监测工具
date: '2020-01-17T22:10:00+08:00'
lastmod: '2020-01-17T22:10:00+08:00'
draft: false
author: 宋涛
authorLink: https://hotttao.github.io/
description: 4.2 CPU 监测工具
featuredImage: null
tags:
- Linux 性能调优
categories:
- Linux
lightgallery: true
---

本节我们来介绍 CPU 相关的监测工具，这类工具属于我们前面所说的第一类计数器类命令。
<!-- more -->


## 1. 命令总览

下面的图片摘录自[极客时间专栏-Linux性能优化实战](https://time.geekbang.org/column/intro/140)，分别从下面 3 个方面总结了 CPU 相关的性能检测工具:
1. 从 CPU 的性能指标出发，根据指标找工具
2. 从工具出发，根据工具找指标
3. 根据工具指标之间的内在联系，掌握 CPU 分析的套路

![cpu_quota](/images/linux_pf/cpu_quota.png) 
![cpu_command](/images/linux_pf/cpu_command.png)
![cpu_relation](/images/linux_pf/cpu_relation.png)

有些工具是通用的分析工具，后面会在单独的章节中详细说明他们的使用。本节会介绍 CPU 专用的分析工具的使用

|Linux|Solaris|作用|说明|
|:---|:---|:---|:---|
|uptime|uptime|平均负载||
|vmstat|vmstat|系统范围的CPU平均负载||
|mpstat|mpstat|单个CPU统计信息||
|time|ptime|命令计时，带CPU用量分解||
|dstat||等于 vmstat + iostat + ifstat<br>可同时观察CPU、磁盘 I/O、网络以及内存使用情况|通用命令，位于独立的一节中|
|sar|sar|可统计包括内存，磁盘，中断等各种信息|通用命令，位于独立的一节中|
|ps|ps|进程状态|通用命令，位于独立的一节中|
|top|prstat|监控每个进程的基本信息|通用命令，位于独立的一节中|
|pidstat|prstat|统计每个进程的内存，IO，上下文切换等信息|通用命令，位于独立的一节中|
|stap，perf|Dtrace|CPU剖析和跟踪|通用命令，位于独立的一节中|
|perf|cpustat|CPU性能计数器分析|通用命令，位于独立的一节中|

除了上述命令之外，还包括以下内容:
1. CPU 调度延迟统计
2. CPU 的调优手段

## 2. CPU 统计工具
### 2.1 uptime
```bash
> uptime
 23:51:13 up  1:34,  3 users,  load average: 0.00, 0.01, 0.05
```

输出:
- top - 14:58:20: 系统当前时间
- up 4:33: 系统已运行时间
- 3 users：当前在线用户
- load average：平均负载：最近1分钟、5分钟、15分钟系统的平均负载

说明：
- 平均负载：平均负载是指单位时间内，系统处于可运行状态和不可中断状态的平均进程数
- 可运行状态：正在使用 CPU 或者正在等待 CPU 的进程，对应 ps R 状态（Running 或 Runnable）进程
- 不可中断状态：正处于内核态关键流程中的进程，并且这些流程是不可打断的，对应 ps D 状态（Uninterruptible Sleep，也称为 Disk Sleep）进程

### 2.2 vmstat
```bash
> vmstat -w
procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st  
 2  0      0 1077816   2116 620312    0    0    65    43   34   53  0  0 99  0  0
# 说明:
# 除了 r 列外，第一行是系统启动以来的总结信息 -- 取决于 vmstat 的版本，最新的版本不是
```

`vmstat [t [n]]`
- 作用: 虚拟内存统计命令
- 说明: 完成的使用方法见内存相关部分的内容，CPU 中重点关注 procs 中 r 值的输出
- 参数:
  - -t：采样间隔
  - -n：采样次数，可选，默认值是1
  - -S: -Sm 以MB 为单位显示结果
  - -a: 输出非活动和活动页缓存的明细
  - -s: 以列表显示内存统计信息
  - -w: 以整齐格式显示
- 输出:
  - system:
    - in: **硬中断次数**
    - cs: **上下文切换次数**
  - procs:
    - r: 可运行线程数，所有等待加上正在运行的线程数，不包括处于不可中断睡眠状态的线程
    - b: 等待IO的进程数量
  - cpu: 
    - 系统全局范围内的平均负载
    - 第一行统计的系统启动以来的平均负载 -- 新版本可能不会显示
    - 其余行统计的是时间间隔周期内的平均负载
  - memory:
    - swpd: 交换出的内存量
    - free: 空闲可用内存
    - buff: 用于缓冲缓存的内存
    - cache: 用于页缓存的内存
  - swap: 
    - si: 换入的内存
    - so: 换出的内存

### 2.3 mpstat
```bash
> mpstat -P ALL 1 2
Linux 3.10.0-1062.el7.x86_64 (localhost.localdomain)    2020年04月01日  _x86_64_        (1 CPU)

00时22分51秒  CPU    %usr   %nice    %sys %iowait    %irq   %soft  %steal  %guest  %gnice   %idle
00时22分52秒  all    0.00    0.00    0.00    0.00    0.00    0.00    0.00    0.00    0.00  100.00
00时22分52秒    0    0.00    0.00    0.00    0.00    0.00    0.00    0.00    0.00    0.00  100.00

00时22分52秒  CPU    %usr   %nice    %sys %iowait    %irq   %soft  %steal  %guest  %gnice   %idle
00时22分53秒  all    0.00    0.00    0.00    0.00    0.00    0.00    0.00    0.00    0.00  100.00
00时22分53秒    0    0.00    0.00    0.00    0.00    0.00    0.00    0.00    0.00    0.00  100.00

平均时间:  CPU    %usr   %nice    %sys %iowait    %irq   %soft  %steal  %guest  %gnice   %idle
平均时间:  all    0.00    0.00    0.00    0.00    0.00    0.00    0.00    0.00    0.00  100.00
平均时间:    0    0.00    0.00    0.00    0.00    0.00    0.00    0.00    0.00    0.00  100.00

> mpstat -P ON -I SUM
00时22分51秒 CPU  intr/s
00时22分51秒 all  1009.18
```

`mpstat [t [n]]`
- 作用: 报告每个 CPU的统计信息
- 参数:
  - `-P {cpu [，...] | ON | ALL}`: 指示要报告统计信息的处理器编号，从 0 开始
    - ON: 表示在线的 CPU
    - ALL: 表示所有 CPU
  - `I {SUM | CPU | ALL}`: 报告中断统计信息
    - 使用SUM关键字，mpstat命令报告每个处理器的**软中断总数**
    - 使用CPU关键字，显示CPU或CPU每秒接收的每个中断的数量
    - ALL关键字等效于指定上面的所有关键字，因此显示所有中断统计信息。
  - `-A`: 等效于 `mpstat -I ALL -u -P ALL`
  - `-u`: 报告CPU使用率，默认参数

### 2.4 time
`time command` 
- 作用: 运行命令并报告 CPU用量
- 其他: `/usr/bin/time -v command` 可以输出更详细的信息

```bash
> time ls
docker_print.py

real    0m0.002s  # 实际耗时
user    0m0.001s  # 用户空间耗时
sys     0m0.001s  # 内核空间耗时

> /usr/bin/time -v ls
docker_print.py
        Command being timed: "ls"
        User time (seconds): 0.00
        System time (seconds): 0.00
        Percent of CPU this job got: 100%
        Elapsed (wall clock) time (h:mm:ss or m:ss): 0:00.00
        Average shared text size (kbytes): 0
        Average unshared data size (kbytes): 0
        Average stack size (kbytes): 0
        Average total size (kbytes): 0
        Maximum resident set size (kbytes): 968
        Average resident set size (kbytes): 0
        Major (requiring I/O) page faults: 0
        Minor (reclaiming a frame) page faults: 309
        Voluntary context switches: 1
        Involuntary context switches: 0
        Swaps: 0
        File system inputs: 0
        File system outputs: 0
        Socket messages sent: 0
        Socket messages received: 0
        Signals delivered: 0
        Page size (bytes): 4096
        Exit status: 0
```

## 3. CPU 延时统计
getdelays.c


## 4. CPU 调优
### 4.1 sysbench
CPU 性能测试

### 4.2 chrt
#### nice/renice

系统调用:
1. setpriority(): 调整优先级
2. sched_setscheduler(): 设置优先级和调度策略

### 4.3 调度器选项
/proc/sys/sched

### 4.4 进程绑定
taskset

### 4.5 独占CPU组

### 4.6 资源控制 cgroups


