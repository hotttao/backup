---
title: 5.1 top 
date: 2020-02-11
categories:
    - 运维
tags:
    - Linux性能调优
---
top 命令
<!-- more -->



## top
top [options]
- 选项：
  - -b：批处理模式
  - -n max：设置迭代数量，通常与 -b 一起使用
  - -d：屏幕刷新间隔
  - -u user：指定用户名
  - -p pid(s)：指定进程
- 交互命令：
  - h：显示帮助画面，给出一些简短的命令总结说明
  - k：终止一个进程
  - i：忽略闲置和僵死进程，这是一个开关式命令
  - q：退出程序
  - r：重新安排一个进程的优先级别
  - S：切换到累计模式
  - l：切换显示平均负载和启动时间信息
  - m：切换显示内存信息
  - t：切换显示进程和CPU状态信息
  - c：切换显示命令名称和完整命令行
  - M：根据驻留内存大小进行排序
  - P：根据CPU使用百分比大小进行排序
  - T：根据时间/累计时间进行排序
  - w：将当前设置写入~/.toprc文件中
- 缺陷:
  - top 自身的 CPU用量可能会变得很大，因为 top 会遍历 /proc 内的很多进程项目
  - top 会对 /proc 做快照，因此会错过一些寿命较短的进程，这些进程在快照之前已经退出了
  - 可以使用 atop 替代top，它使用进程核算技术来捕获短寿命进程并显示，也可以使用 pidstat 捕获短时进程


## 指标含义
```bash
top - 14:58:20 up  4:33,  3 users,  load average: 0.09, 0.11, 0.13
Tasks: 252 total,   3 running, 249 sleeping,   0 stopped,   0 zombie
%Cpu(s):  2.5 us,  0.8 sy,  0.0 ni, 95.9 id,  0.0 wa,  0.0 hi,  0.8 si,  0.0 st
KiB Mem : 16267424 total,  2198240 free, 12617508 used,  1451676 buff/cache
KiB Swap:        0 total,        0 free,        0 used.  3264332 avail Mem 

  PID USER      PR  NI    VIRT    RES    SHR S %CPU %MEM     TIME+ COMMAND            
 3653 analyzer  20   0 3214268 611932  17464 S  2.4  3.8   6:45.42 java               
 2994 analyzer  20   0 5456164 108580   9244 S  0.8  0.7   0:11.13 java
```

### 系统运行时间
```bash
top - 14:58:20 up  4:33,  3 users,  load average: 0.09, 0.11, 0.13
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


### tasks
```bash
Tasks: 252 total,   3 running, 249 sleeping,   0 stopped,   0 zombie
```
输出：
- 标准：
  - 基于线程转态切换的任务数统计，统计的是线程数
  - shows total tasks or threads, depending on the state of the Threads-mode toggle.
- total：总的线程数
- running：处于运行状态的线程数
- sleeeping：处于休眠状态的线程数
- stopped：被跟踪或已停止 Stopped的线程数
- zombie：僵尸进程数


### CPU
```bash
%Cpu(s):  2.5 us,  0.8 sy,  0.0 ni, 95.9 id,  0.0 wa,  0.0 hi,  0.8 si,  0.0 st
```
输出：
|名称|缩写|含义|
|:--|:--|:--|
|user|us|用户态 CPU 时间，不包括下面的 nice 时间，但包括 guest 时间。|
|nice|ni|代表低优先级用户态 CPU 时间，也就是进程的 nice 值被调整为 1-19 之间时的 CPU 时间。 nice 可取值范围是 -20 到 19，数值越大，优先级反而越低。|
|system|sys,sy|代表内核态 CPU 时间。|
|idle|id|代表空闲时间。注意，它不包括等待 I/O 的时间（iowait）|
|iowait|wa|代表等待 I/O 的 CPU 时间，出现 iowait 有两个条件，一是进程在等io，二是等io时没有进程可运行|
|irq|hi|代表处理硬中断的 CPU 时间。|
|softirq|si|代表处理软中断的 CPU 时间。|
|steal|st|代表当系统运行在虚拟机中的时候，被其他虚拟机占用的 CPU 时间|
|guest|guest|代表通过虚拟化运行其他操作系统的时间，也就是运行虚拟机的 CPU 时间|
|guest_nice|gnice|代表以低优先级运行虚拟机的时间|

注意：通常我们收的 CPU 使用率，就是除了空闲时间外的其他时间占总 CPU 时


### memery swap
```bash
KiB Mem : 16267424 total,  2198240 free, 12617508 used,  1451676 buff/cache
KiB Swap:        0 total,        0 free,        0 used.  3264332 avail Mem 
```

输出:
- total: 总的内存或 swap 分区大小
- free：处于空闲状态的内存或 swap 分区大小
- used：已经的内存或 swap 分区大小
- buff/cache: 用于buff/cache 的内存大小
- avail Mem：可用内存，包括 free，以及可回收的页缓存，内存，和slab 缓存


### 进程信息
||||
|:---|:---|:---|
|PID     |Process Id          |进程ID|
|USER    |Effective User Name |进程的有效属主，用于判断进程对文件系统的访问权限|
|PR      |Priority            |进程优先级|
|NI      |Nice Value          |nice值|
|VIRT    |Virtual Image (KiB) |进程使用的虚拟内存大小，包括换到 swap 分区，以及隐射了但未分配内存|
|RES     |Resident Size (KiB) |实际占用的物理内存大小|
|SHR     |Shared Memory (KiB) |共享内存大小|
|S       |Process Status      |进程状态|
|%CPU    |CPU Usage           |基于CPU时间片计算的CPU使用率<br>并没有细分进程的用户态 CPU 和内核态 CPU|
|%MEM    |Memory Usage (RES)  |内存占用百分比|
|TIME+   |CPU Time, hundredths|进程使用的CPU时间总计，单位1/100秒|
|COMMAND |Command Name/Line   |进程名称及命令|
|PPID    |Parent Process pid  |父进程ID|
|UID     |Effective User Id   ||
|RUID    |Real User Id        |由启动进程的用户决定|
|RUSER   |Real User Name      ||
|SUID    |Saved User Id       ||
|SUSER   |Saved User Name     ||
|GID     |Group Id            ||
|GROUP   |Group Name          ||
|PGRP    |Process Group Id    ||
|TTY     |Controlling Tty     |所属终端|
|TPGID   |Tty Process Grp Id  ||
|SID     |Session Id          |会话ID|
|nTH     |Number of Threads   |包含的线程数|
|P       |Last Used Cpu (SMP) |最后运行该进程的CPU|
|TIME    |CPU Time            |同TIME+，但没有TIME+精确|
|SWAP    |Swapped Size (KiB)  |使用的swap分区大小|
|CODE    |Code Size (KiB)     |代码段占用内存大小|
|DATA    |Data+Stack (KiB)    |数据段占用内存大小|
|nMaj    |Major Page Faults   |累计主缺页异常次数|
|nMin    |Minor Page Faults   |累计次缺页异常次数|
|nDRT    |Dirty Pages Count   |待刷新的脏页数|
|WCHAN   |Sleeping in Function||
|Flags   |Task Flags <sched.h>|进程调度标识|
|CGROUPS |Control Groups      ||
|SUPGIDS |Supp Groups IDs     ||
|SUPGRPS |Supp Groups Names   ||
|TGID    |Thread Group Id     |所属线程组ID|
|ENVIRON |Environment vars    |进程依赖的环境变量|
|vMj     |Major Faults delta  |当前时间间隔内的主缺页异常|
|vMn     |Minor Faults delta  ||
|USED    |Res+Swap Size (KiB) ||
|nsIPC   |IPC namespace Inode |进程所属的IPC命令空间|
|nsMNT   |MNT namespace Inode ||
|nsNET   |NET namespace Inode ||
|nsPID   |PID namespace Inode ||
|nsUSER  |USER namespace Inode||
|nsUTS   |UTS namespace Inode||