---
title: 2.4 perf 的使用
date: 2020-01-05
categories:
    - 运维
tags:
    - Linux性能调优
---

上一节我们学习了 perf 的基本原理，对 perf 有了一个整体上的认识，本节我们来学如何使用 perf 进行性能分析。
<!-- more -->

我们将按照如下几个部分来介绍 perf 的使用:
1. perf 的辅助性命令，包括 perf list，perf probe 等
2. perf 的三种使用方式，计数模式，采样事件，以及事件上的 bp 程序
4. perf 提供的特殊用途的子命令，包括 perf sched，perf mem 等等
3. perf.data 的处理，这一部分命令用于格式化输出 perf.data 的内容便于生成类似火焰图等更复杂的图表

![perf_events_flow](/images/linux_pf/perf_events_flow.png)

## 1. perf 命令概览
作为开始，我们先来回顾一下 perf 命令的一个概览

`perf [--version] [--help] [OPTIONS] COMMAND [ARGS]`

|子命令|作用|
|:---|:---|
|list            |List all symbolic event types<br>列出当前系统支持的所有事件名,可分为三类：硬件事件、软件事件，检查点|
|probe           |Define new dynamic tracepoints<br>用于定义动态检查点|
|stat            |Run a command and gather performance counter statistics<br>对程序运行过程中的性能计数器进行统计|
|record          |Run a command and record its profile into perf.data<br>	对程序运行过程中的事件进行分析和记录，并写入perf.data|
|report          |Read perf.data (created by perf record) and display the profile<br>读取perf.data(由perf record生成) 并显示分析结果|
|top             |System profiling tool.<br>对系统的性能进行分析，类似top命令|
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

## 1. perf 辅助性命令
### 1.1 perf list
`perf list [--no-desc] [--long-desc] [event_class]`

- 作用: 列出perf可以支持的所有事件
- event_class: 事件的分类，包括:
  - `hw|sw|cache|pmu|sdt|metric|metricgroup`
  - `tracepoint`: 静态探针
  - `event_glob`: 事件的通配符

```bash
perf list

List of pre-defined events (to be used in -e):

  alignment-faults                                   [Software event]
  bpf-output                                         [Software event]
  context-switches OR cs                             [Software event]
  cpu-clock                                          [Software event]
  cpu-migrations OR migrations                       [Software event]
  ..........
```

perf list给出的事件是厂家上传上去给Linux社区的，但有些厂家会有自己的事件统计，没有上传出去，这需要从厂家的用户手册中获得，这种事件称为原始事件，可以直接用编号表示，格式为:rUUEE，其中UU == umask, EE ==事件编号。比如在我们的芯片里面，0x13号表示跨芯片内存访问，你就可以用`-e r0013`来跟踪软件的跨片访问次数。

### 1.2 perf probe
perf probe 用来定义一个动态探针，定义的方式有如下几种:
1. 用户空间: 通过 -x 指定二进制文件的路径，可以为该二进制程序添加库函数的动态探针
2. 内核:
  - 通过符号表和寄存器来添加，这种方式不需要内核调试信息(即 kernel-debuginfo)
  - 通过 C 函数，C 函数中的特定行，并且可以附加函数上下文中的变量，这种方式需要内核调试信息。

#### 命令使用
```bash
Usage: perf probe [<options>] 'PROBEDEF' ['PROBEDEF' ...]
    or: perf probe [<options>] --add 'PROBEDEF' [--add 'PROBEDEF' ...]
    or: perf probe [<options>] --del '[GROUP:]EVENT' ...
    or: perf probe --list [GROUP:]EVENT ...
    or: perf probe [<options>] --line 'LINEDESC'
    or: perf probe [<options>] --vars 'PROBEPOINT'
    or: perf probe [<options>] --funcs

    -a, --add <[EVENT=]FUNC[@SRC][+OFF|%return|:RL|;PT]|SRC:AL|SRC;PT [[NAME=]ARG ...]>
                          probe point definition, where
                GROUP:  Group name (optional)
                EVENT:  Event name
                FUNC:   Function name
                OFF:    Offset from function entry (in byte)
                %return:        Put the probe at function return
                SRC:    Source code path
                RL:     Relative line number from function entry.
                AL:     Absolute line number in file.
                PT:     Lazy expression of line code.
                ARG:    Probe argument (local variable name or
                        kprobe-tracer argument format.)

    -D, --definition <[EVENT=]FUNC[@SRC][+OFF|%return|:RL|;PT]|SRC:AL|SRC;PT [[NAME=]ARG ...]>
                          Show trace event definition of given traceevent for k/uprobe_events.
    -d, --del <[GROUP:]EVENT>
                          delete a probe event.
    -f, --force           forcibly add events with existing name
    -F, --funcs <[FILTER]>
                          Show potential probe-able functions.
    -L, --line <FUNC[:RLN[+NUM|-RLN2]]|SRC:ALN[+NUM|-ALN2]>
    -V, --vars <FUNC[@SRC][+OFF|%return|:RL|;PT]|SRC:AL|SRC;PT>
                        Show accessible variables on PROBEDEF
```

#### 添加动态探针
```bash
# 一: 基于 uprobes ，为用户空间库函数添加动态探针
# 想要查看普通应用的函数名称和参数，那么在应用程序的二进制文件中，同样需要包含调试信息。
# 为/bin/bash添加readline探针，获取其返回值，并作为 string 类型返回
$ perf probe -x /bin/bash 'readline'
$ perf probe -x /bin/bash 'readline%return +0($retval):string'
Added new event:
  probe_bash:readline__return (on readline%return in /usr/bin/bash with +0($retval):string)

You can now use it in all perf tools, such as:

        perf record -e probe_bash:readline__return -aR sleep 1


# 查询所有的函数
$ perf probe -x /bin/bash --funcs

# 查询函数的参数
$ perf probe -x /bin/bash -V readline
Available variables at readline
        @<readline+0>
                char*   prompt

# 二: 基于 kprobes，为内核函数添加动态探针
# 1. 通过符号表和寄存器添加 malloc 探针
$ perf probe -x /lib64/libc-2.17.so '--add=malloc'
$ perf probe --del "malloc"
$ perf probe -x /lib64/libc-2.17.so '--add=malloc size=%di'

# 2. 通过 C 扩展
$ yum --enablerepo=base-debuginfo install -y kernel-debuginfo-$(uname -r)
$ perf probe --add tcp_sendmsg
Added new event:
  probe:tcp_sendmsg    (on tcp_sendmsg)

You can now use it in all perf tools, such as:
        # 自动显示使用方式
        perf record -e probe:tcp_sendmsg -aR sleep 1  

# 获取 tcp_sendmsg 的返回值
$ perf probe 'tcp_sendmsg%return $retval'

# 2.1 列出tcp_sendmsg()可用的变量
$ perf probe -V tcp_sendmsg
Available variables at tcp_sendmsg
        @<tcp_sendmsg+0>
                size_t  size
                struct kiocb*   iocb
                struct msghdr*  msg
                struct sock*    sk

# 2.2 添加带参数的探针
$ perf probe --add 'tcp_sendmsg size'

# 2.3 列出tcp_sendmsg()可用的行探测:
$ perf probe -L tcp_sendmsg
<tcp_sendmsg@/mnt/src/linux-3.14.5/net/ipv4/tcp.c:0>
      0  int tcp_sendmsg(struct kiocb *iocb, struct sock *sk, struct msghdr *msg,
                        size_t size)
      2  {
                struct iovec *iov;
                struct tcp_sock *tp = tcp_sk(sk);
                struct sk_buff *skb;
      6         int iovlen, flags, err, copied = 0;
      7         int mss_now = 0, size_goal, copied_syn = 0, offset = 0;
                bool sg;
                long timeo;
[...]

# 2.4 检查在第81行有哪些变量可用
$ perf probe -V tcp_sendmsg:81
Available variables at tcp_sendmsg:81
        @<tcp_sendmsg+537>
                bool    sg
                int     copied
                int     copied_syn
                int     flags
                int     mss_now
                int     offset
                int     size_goal
                long int        timeo
                size_t  seglen
                struct iovec*   iov
                struct sock*    sk
                unsigned char*  from

# 2.5. 跟踪第81行，并使用循环中的seglen变量
$ perf probe --add 'tcp_sendmsg:81 seglen'
```

## 2. perf stat(计数模式)
perf stat 是 perf 三种使用模式中的第一种模式计数模式。

perf stat:
- 命令格式:
  - `perf stat [-e <EVENT> | --event=EVENT] [-a] <command>`
  - `perf stat [-e <EVENT> | --event=EVENT] [-a] — <command> [<options>]`
  - `perf stat [-e <EVENT> | --event=EVENT] [-a] record [-o file] — <command> [<options>]`
  - `perf stat report [-i file]`
- 作用: 可以对程序运行过程中的性能计数器(包括Hardware，software counters)进行统计，分析程序的整体消耗情况
- 参数:
    - `-d, -dd, -ddd` 输出更详细的信息

### 2.1 perf stat 默认输出
默认情况 perf stat 只会对 Software Events 和 Hardware Events 进行计数分析。下面是 perf stat 的使用示例

```bash
$ perf stat ls
Performance counter stats for 'ls':

          2.164836      task-clock (msec)         #    0.808 CPUs utilized
                51      context-switches          #    0.024 M/sec
                 4      cpu-migrations            #    0.002 M/sec
               333      page-faults               #    0.154 M/sec
           5506056                                #    2.543 GHz
                 0      stalled-cycles-frontend   #    0.00% frontend cycles idle
                 0      stalled-cycles-backend    #    0.00% backend  cycles idle
           6100570      instructions              #    1.11  insns per cycle
           1298744      branches                  #  599.927 M/sec
             18509      branch-misses             #    1.43% of all branches

       0.002679758 seconds time elapsed
```

指标含义:

1. task-clock (msec): 
  - cpu处理task所消耗的时间，单位ms
  - 0.808 CPUs utilized的表示cpu使用率为80.8%，该值越高代表程序是CPU bound而非IO bound 类型
2. instructions：
  - 执行的指令条数， 
  - insns per cycle: 即IPC，每个cpu周期执行的指令条数，IPC比上面的CPU使用率更能说明CPU的使用情况
  - 更高的IPC值意味着更高的指令吞吐量，更低的值表示更多的停顿周期。
  - 一般来说，我认为IPC值越高(例如，超过1.0)就越好，表示工作的最佳处理。但是，需要检查执行指令是什么，以防这是一个旋转循环: 指令率高，但实际完成的工作率低。
3. stalled-cycles-frontend和stalled-cycles-backend: 表示CPU停滞统计
  - 前端和后端指标指的是CPU管道，统计的是它们的停顿次数
  - 前端按顺序处理CPU指令。它包括指令获取，以及分支预测和解码。
  - 解码后的指令成为后端处理的微操作(uops)，并且可能会乱序地执行。
  - 每条指令的停滞周期类似于IPC(反向)，但是，只计算停滞周期，这将用于内存或资源总线访问。
4. branches：这段时间内发生分支预测的次数。现代的CPU都有分支预测方面的优化。
5. branches-misses：这段时间内分支预测失败的次数，这个值越小越好。

#### 详细模式
可以使用 -d 选项输出更详细的信息，带 `-d` 选项的输出会包含用于一级数据缓存事件和最后一级缓存(LLC)事件的额外计数器。`-dd,-ddd`可输出更加详细的信息。

```bash
$ perf stat -d gzip file1

 Performance counter stats for 'gzip file1':

       1610.719530 task-clock                #    0.998 CPUs utilized          
                20 context-switches          #    0.012 K/sec                  
                 0 CPU-migrations            #    0.000 K/sec                  
               258 page-faults               #    0.160 K/sec                  
     5,491,605,997 cycles                    #    3.409 GHz                     [40.18%]
     1,654,551,151 stalled-cycles-frontend   #   30.13% frontend cycles idle    [40.80%]
     1,025,280,350 stalled-cycles-backend    #   18.67% backend  cycles idle    [40.34%]
     8,644,643,951 instructions              #    1.57  insns per cycle        
                                             #    0.19  stalled cycles per insn [50.89%]
     1,492,911,665 branches                  #  926.860 M/sec                   [50.69%]
        53,471,580 branch-misses             #    3.58% of all branches         [51.21%]
     1,938,889,736 L1-dcache-loads           # 1203.741 M/sec                   [49.68%]
       154,380,395 L1-dcache-load-misses     #    7.96% of all L1-dcache hits   [49.66%]
                 0 LLC-loads                 #    0.000 K/sec                   [39.27%]
                 0 LLC-load-misses           #    0.00% of all LL-cache hits    [39.61%]

       1.614165346 seconds time elapsed
```

### 2.2 指定 Hardware Events 计数器
下面是对 Hardware Events 指定计数的示例。如果 -e 指定的硬件事件包含“ cycle ”和“ instructions ”计数器，那么 perf 的输出中将包含 IPC。硬件事件通常是特定于处理器模型的，许多可能无法从虚拟化环境中获得。

```bash
# 指定硬件计数器
$ perf stat -e L1-dcache-loads,L1-dcache-load-misses,L1-dcache-stores gzip file1

 Performance counter stats for 'gzip file1':

     1,947,551,657 L1-dcache-loads
                                            
       153,829,652 L1-dcache-misses
         #    7.90% of all L1-dcache hits  
     1,171,475,286 L1-dcache-stores
                                           

       1.538038091 seconds time elapsed

# 使用原始事件
$ perf stat -e cycles,instructions,r80a2,r2b1 gzip file1

 Performance counter stats for 'gzip file1':

     5,586,963,328 cycles                    #    0.000 GHz                    
     8,608,237,932 instructions              #    1.54  insns per cycle        
         9,448,159 raw 0x80a2                                                  
    11,855,777,803 raw 0x2b1                                                   

       1.588618969 seconds time elapsed

# PMCs: counting cycles and frontend stalls via raw specification:
$ perf stat -e cycles -e cpu/event=0x0e,umask=0x01,inv,cmask=0x01/ -a sleep 5
```

### 2.3 通过静态探针统计系统调用
通过 -e 指定 Kernel Tracepoint Events，perf stat 可以统计程序执行的系统调用:

```
# 统计系统调用统计系统调用并打印摘要(非零计数)
$ perf stat -e 'syscalls:sys_enter_*' gzip file1 2>&1 | awk '$1 != 0'

Performance counter stats for 'gzip file1':

                 1 syscalls:sys_enter_utimensat               
                 1 syscalls:sys_enter_unlink                  
                 5 syscalls:sys_enter_newfstat                
             1,603 syscalls:sys_enter_read                    
             3,201 syscalls:sys_enter_write      
```

使用系统调用跟踪程序`strace -c`可以看到类似的报告，但是它可能导致比perf高得多的开销，因为perf在内核中缓冲数据。strace的当前实现使用ptrace(2)附加到目标进程并在系统调用期间停止它，就像调试器一样。这是暴力的，并可能导致严重的开销。

perf trace 子命令提供与 strace 类似的功能，但开销要低得多。perf trace 还可以进行系统级的系统调用跟踪（即跟踪所有进程），而 strace 只能跟踪特定的进程。

## 3. 采样事件
perf record 是perf 的第二种使用方式，采样事件，他包含如下几种模式:
1. Timed Profiling，以固定间隔采样，使用 -F 选项
2. Event Profiling，基于事件采样(通常是硬件事件，软件事件较少)，使用 -e 指定采样事件
3. Static Kernel Tracing: 基于内核的静态探针，使用 -e 指定静态探针类型。

perf-record用来启动一次跟踪:
1. perf record在当前目录产生一个perf.data文件，用来记录过程数据
2. 如果这个文件已经存在，旧的文件会被改名为perf.data.old
3. perf.data只包含原始数据，perf report 需要访问本地的符号表，pid和进程的对应关系等信息来生成报告。
4. 所以perf.data不能直接拷贝，可以通过perf-archive命令把所有这些数据打包，然后复制

### 3.1 perf record/report 命令
`perf record`
- 命令格式:
  - `perf record [-e <EVENT> | --event=EVENT] [-a] <command>`
  - `perf record [-e <EVENT> | --event=EVENT] [-a] — <command> [<options>]`
- 参数:
  - `-p, --pid <pid>`: 指定跟踪固定的一组进程，即仅仅跟踪发生在特定pid的事件
  - `-a, --all-cpus`: 跟踪整个系统的性能，常用选项
  - `-c, --count <n>`: 累计多少个事件记录一次
  - `-g`: 开启堆栈追踪，通常无需使用
  - `-F`: 事件采样的频率, 单位HZ, 更高的频率会获得更细的统计，但会带来更多的开销
  - `sleep`: 采样的时间

perf.data 文件可以用多种方法处理。perf report命令启动ncurses导航器来检查调用图。或者使用 --stdio 选项将调用图打印成树状，并标注百分比:

`perf report [-i <file> | --input=file]`

- 使用: 显示的是一个菜单项，回车可以查看折叠的代码，esc 或者 q 可以退出返回上一级
- 参数:
  - `--pid=`: 指定 pid
  - `--tid=`: 指定 tid
  - `-S, --symbols`=: Only consider these symbols. 
  - `--stdio`: 在终端将调用图以树状图打印

### 3.2 Timed Profiling
perf 可以基于对指令指针或堆栈跟踪的固定间隔采样(定时分析)来分析CPU使用情况。入下例所示以99赫兹(-F 99)，对整个系统(-a，对所有CPU)采样CPU堆栈，采样10秒，并记录堆栈(-g，调用图):

```bash
$ perf record -F 99 -a -g -- sleep 30
```

选择99赫兹而不是100赫兹，是为了避免偶然地与某些周期性活动同步采样，以免产生扭曲的结果。这也是粗糙的:你可能想要增加到更高的速率(例如，高达997赫兹)以获得更好的分辨率，请记住，更高的频率意味着更高的开销。

### 3.3 Event Profiling
除了按时间间隔采样外，由CPU硬件计数器触发的采样是CPU分析的另一种形式。某些事件发生的频率非常高，在每次出现时都收集堆栈会导致过多的开销并降低系统速度并改变目标的性能特征。通常，只测量它们出现的一小部分，而不是全部，就足够了。这可以通过使用“-c” 指定触发事件收集的阈值来实现。“-c count”机制是由处理器实现的，它只在达到阈值时中断内核。

例如，下面的一行程序统计 1级数据缓存加载失败次数，每10000次失败收集一次堆栈跟踪:

```bash
# 每 1000 次收集一次堆栈跟踪
perf record -e L1-dcache-load-misses -c 10000 -ag -- sleep 5
```

### 3.4 Static Kernel Tracing
通过内核静态探针，可以跟踪内核的系统调用。

#### 跟踪新进程的创建
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

#### 跟踪出站连接
```bash
$ perf record -e syscalls:sys_enter_connect -a
^C[ perf record: Woken up 1 times to write data ]
[ perf record: Captured and wrote 0.057 MB perf.data (~2489 samples) ]
# perf report --stdio
# ========
# Samples: 21  of event 'syscalls:sys_enter_connect'
# Event count (approx.): 21
#
 Overhead  Command       Shared Object                       Symbol
 ........  .......  ..................  ...........................

    52.38%     sshd  libc-2.15.so        [.] __GI___connect_internal
    19.05%   groups  libc-2.15.so        [.] __GI___connect_internal
     9.52%     sshd  libpthread-2.15.so  [.] __connect_internal     
     9.52%     mesg  libc-2.15.so        [.] __GI___connect_internal
     9.52%     bash  libc-2.15.so        [.] __GI___connect_internal
```

记录connect()的堆栈跟踪可以解释为什么会出现这些出站连接:

```bash
$ perf record -e syscalls:sys_enter_connect -ag
^C[ perf record: Woken up 1 times to write data ]
[ perf record: Captured and wrote 0.057 MB perf.data (~2499 samples) ]
$ perf report --stdio
```

#### 跟踪套接字缓冲区消耗
跟踪套接字缓冲区的消耗和堆栈跟踪是识别导致套接字或网络I/O的原因的一种方法。

```bash
$ perf record -e 'skb:consume_skb' -ag
^C[ perf record: Woken up 1 times to write data ]
[ perf record: Captured and wrote 0.065 MB perf.data (~2851 samples) ]
$ perf report
```

### 3.4 Static User Tracing
在4.x 的内核中，添加了用户态静态追踪机制。下面演示了Linux 4.10(附加了一个补丁集)，如何跟踪Node.js 的USDT探针:
```bash
# perf buildid-cache --add `which node`
# perf list | grep sdt_node
  sdt_node:gc__done                                  [SDT event]
  sdt_node:gc__start                                 [SDT event]
  sdt_node:http__client__request                     [SDT event]
  sdt_node:http__client__response                    [SDT event]
  sdt_node:http__server__request                     [SDT event]
  sdt_node:http__server__response                    [SDT event]
  sdt_node:net__server__connection                   [SDT event]
  sdt_node:net__stream__end                          [SDT event]
# perf record -e sdt_node:http__server__request -a
^C[ perf record: Woken up 1 times to write data ]
[ perf record: Captured and wrote 0.446 MB perf.data (3 samples) ]
# perf script
            node  7646 [002]   361.012364: sdt_node:http__server__request: (dc2e69)
            node  7646 [002]   361.204718: sdt_node:http__server__request: (dc2e69)
            node  7646 [002]   361.363043: sdt_node:http__server__request: (dc2e69)
```

### 3.5 Dynamic Tracing
使用动态追踪需要启用如下的内核参数:
1. 内核动态跟踪需要启用CONFIG_KPROBES=y和CONFIG_KPROBE_EVENTS=y
3. 用户级动态跟踪需要启用 CONFIG_UPROBES=y和CONFIG_UPROBE_EVENTS=y
2. 为避免内核栈指针优化，需要启用 CONFIG_FRAME_POINTER=y

下面是几个在 Linux 使用 perf 进行动态追踪的示例

#### 检测内核tcp_sendmsg()函数
```bash
# 1. 添加动态探针
$ perf probe --add tcp_sendmsg
Failed to find path of kernel module.
Added new event:
  probe:tcp_sendmsg    (on tcp_sendmsg)

You can now use it in all perf tools, such as:

	perf record -e probe:tcp_sendmsg -aR sleep 1

# 2. 使用动态探针
$  perf record -e probe:tcp_sendmsg -a -g -- sleep 5

# 3. 输出追踪报告
$ perf report --stdio

# 如果内核有debuginfo (CONFIG_DEBUG_INFO=y)，那么可以从函数中提取内核变量。
# 这是在Linux 3.13.1上检查size_t(整数)的一个简单示例。

# 5.列出tcp_sendmsg()可用的变量
$  perf probe -V tcp_sendmsg
Available variables at tcp_sendmsg
        @<tcp_sendmsg+0>
                size_t  size
                struct kiocb*   iocb
                struct msghdr*  msg
                struct sock*    sk

# 6. 使用变量“size”为tcp_sendmsg()创建一个探针:
$ perf probe --add 'tcp_sendmsg size'

# 7. 跟踪此探针
$ perf record -e probe:tcp_sendmsg -a
$ perf script
# 内核:将显示 tcp_sendmsg()行号和本地变量值
# ========
#
            sshd  1301 [001]   502.424719: probe:tcp_sendmsg: (ffffffff81505d80) size=b0

# 使用debuginfo, perf_events可以为内核函数中的行创建跟踪点。
# 必须安装 kernel-debuginfo 包，或者启用CONFIG_DEBUG_INFO=y
# 8. 列出tcp_sendmsg()可用的行探测:
$ perf probe -L tcp_sendmsg
<tcp_sendmsg@/mnt/src/linux-3.14.5/net/ipv4/tcp.c:0>
      0  int tcp_sendmsg(struct kiocb *iocb, struct sock *sk, struct msghdr *msg,
                        size_t size)
      2  {
                struct iovec *iov;
                struct tcp_sock *tp = tcp_sk(sk);
                struct sk_buff *skb;
      6         int iovlen, flags, err, copied = 0;
      7         int mss_now = 0, size_goal, copied_syn = 0, offset = 0;
                bool sg;
                long timeo;
[...]

# 9. 检查在第81行有哪些变量可用
$ perf probe -V tcp_sendmsg:81
Available variables at tcp_sendmsg:81
        @<tcp_sendmsg+537>
                bool    sg
                int     copied
                int     copied_syn
                int     flags
                int     mss_now
                int     offset
                int     size_goal
                long int        timeo
                size_t  seglen
                struct iovec*   iov
                struct sock*    sk
                unsigned char*  from
# 10. 跟踪第81行，并使用循环中的seglen变量
$ perf probe --add 'tcp_sendmsg:81 seglen'
$ perf record -e probe:tcp_sendmsg -a
$ perf script
            sshd  4652 [001] 2082360.931086: probe:tcp_sendmsg: (ffffffff81642ca9) seglen=0x80
   app_plugin.pl  2400 [001] 2082360.970489: probe:tcp_sendmsg: (ffffffff81642ca9) seglen=0x20
        postgres  2422 [000] 2082360.970703: probe:tcp_sendmsg: (ffffffff81642ca9) seglen=0x52
[...]
```

#### 跟踪 malloc 函数调用
```bash
# 1. 添加 malloc 探针
$ perf probe -x /lib64/libc-2.17.so '--add=malloc'
$ perf record -e probe_libc:malloc -a
$ perf report -n

# 2. 添加带 size 参数的 malloc 探针
# size 保存的寄存器信息，依赖于你的处理器架构
$ perf probe -x /lib64/libc-2.17.so '--add=malloc size=%di'
```

malloc()调用非常频繁，因此需要考虑跟踪这样的调用的开销。

## 4. perf eBPF


## 5. perf 特殊功能子命令 
说完了 perf 的三种基础使用方式，我们来看perf 提供特殊功能的子命令。

### 5.1 perf trace
perf trace 类似于 strace 用于跟踪进程的系统调用，前面我们也提到了，相对于 strace 使用的 ptrace 机制来说，perf trace 基于内核事件，比进程跟踪的性能好很多。perf trace 还可以进行系统级的系统调用跟踪（即跟踪所有进程），而 strace 只能跟踪特定的进程。

```bash
Usage: perf trace [<options>] [<command>]
    or: perf trace [<options>] -- <command> [<options>]
    or: perf trace record [<options>] [<command>]
    or: perf trace record [<options>] -- <command> [<options>]

    -a, --all-cpus        system-wide collection from all CPUs
    -C, --cpu <cpu>       list of cpus to monitor
    -D, --delay <n>       ms to wait before starting measurement after program start
    -e, --event <event>   event/syscall selector. use 'perf list' to list available events
    -f, --force           don't complain, do it
    -F, --pf <all|maj|min>
                          Trace pagefaults
    -G, --cgroup <name>   monitor event in cgroup name only
    -i, --input <file>    Analyze events in file
    -m, --mmap-pages <pages>
                          number of mmap data pages
    -o, --output <file>   output file name
    -p, --pid <pid>       trace events on existing process id
    --sched           show blocking scheduler events
    --syscalls        Trace syscalls

```

下面是 perf trace 的使用示例:
```bash
$ perf trace --syscalls ls
```

### 5.1 perf top

`perf top [-e <EVENT> | --event=EVENT] [<options>]`

- 作用: 可以动态收集和更新统计列表
- options:
  - -e:
    - 指定跟踪的事件，包括 perf list提供的所有事件以及 tracepoint
    - 可以多次使用，也可以一次指定多个事件，事件使用逗号分隔
    - 对于厂家为上传的事件可以直接是用编号，eg: `-e r0013` 
    - 事件可以指定后缀，用于限定跟踪范围
  - -s:
    - 指定按什么参数来进行分类 
    - 默认会按函数进行分类，按照 pid 分类需要指定 -s pid
    - -s也可以指定多个域（用逗号隔开）
    - 可选值包括:
      - pid, comm, dso, symbol, parent, srcline, weight, 
      - local_weight, abort, in_tx, transaction, overhead, sample, period
  - -a：显示在所有CPU上的性能统计信息
  - -p：指定进程PID
  - -t：指定线程TID
  - -K：隐藏内核统计信息
  - -U：隐藏用户空间的统计信息
  - -S, --symbols: Only consider these symbols
  - -g, --call-graph: 得到函数的调用关系图
    - 格式: `<print_type,threshold[,print_limit],order,sort_key[,branch],value>`
    - print_type:
      - flat: single column, linear exposure of call chains.
      - graph: use a graph tree, displaying absolute overhead rates. (default)
      - fractal: like graph, but displays relative rates. Each branch of the tree is considered as a new profiled object.
      - folded: call chains are displayed in a line, separated by semicolons
      - none: disable call chain display.

```bash
# 1. -e 指定多个事件
> sudo perf top -e branch-misses,cycles

# 2. 指定后缀，只跟踪用户态发生的分支预测失败
> sudo perf top -e branch-misses:u,cycles
> sudo perf top -e '{branch-misses,cycles}:u'

# 3. 指定分类
> sudo perf top -e 'cycle' -s comm,pid,dso
```

### 5.2 perf sched
perf sched子命令提供了许多用于分析内核CPU调度器行为的工具。您可以使用它来识别和量化调度器延迟的问题。

这个命令的开销很大。如果开销是一个问题，可以使用[eBPF/bcc工具](http://www.brendangregg.com/ebpf.html#bcc)。其中runqlat和runqlen，只记录内核内的调度器事件摘要，进一步减少开销。perf sched转储所有事件的一个优点是不局限于摘要，对于分析问题而言可以获取更全面的信息。

```bash
# perf sched -h

 Usage: perf sched [] {record|latency|map|replay|script|timehist}

    -D, --dump-raw-trace  dump raw trace in ASCII
    -f, --force           don't complain, do it
    -i, --input     input file name
    -v, --verbose         be more verbose (show symbol address, etc)
```

perf sched 有`{record|latency|map|replay|script|timehist}`使用模式，我们来一一介绍。

#### perf sched record

#### perf sched latency 
perf sched latency  将按任务统计调度程序延迟，包括平均延迟和最大延迟:

```bash
# perf sched latency

 -----------------------------------------------------------------------------------------------------------------
  Task                  |   Runtime ms  | Switches | Average delay ms | Maximum delay ms | Maximum delay at       |
 -----------------------------------------------------------------------------------------------------------------
  cat:(6)               |     12.002 ms |        6 | avg:   17.541 ms | max:   29.702 ms | max at: 991962.948070 s
  ar:17043              |      3.191 ms |        1 | avg:   13.638 ms | max:   13.638 ms | max at: 991963.048070 s
  rm:(10)               |     20.955 ms |       10 | avg:   11.212 ms | max:   19.598 ms | max at: 991963.404069 s
```

#### perf sched map
perf sched map 显示所有CPU和上下文切换事件，其中的列表示每个CPU正在做什么以及何时做。

```bash
# perf sched map
                      *A0           991962.879971 secs A0 => perf:16999
                       A0     *B0   991962.880070 secs B0 => cc1:16863
          *C0          A0      B0   991962.880070 secs C0 => :17023:17023
  *D0      C0          A0      B0   991962.880078 secs D0 => ksoftirqd/0:6
   D0      C0 *E0      A0      B0   991962.880081 secs E0 => ksoftirqd/3:28
   D0      C0 *F0      A0      B0   991962.880093 secs F0 => :17022:17022
```

#### perf sched replay

#### perf sched script

#### perf sched timehist

### 5.3 perf mem

## 6. perf.data 处理
### 6.1 perf diff

`perf diff [baseline file] [data file1] [[data file2] ... ]`

- 作用: 比较两次运行的区别
- 场景: 可以用不同参数运行程序，看看两次运行的差别

### 6.2 perf script

`perf script [<options>]`

- 作用: 对 perf.data 数据做格式转换

```bash
# 1. 导出原始分析数据
> perf record
> perf script # 导出 perf record 中记录的原始数据
> perf script | ./stackcollapse-perf.pl | ./flamegraph.pl > perf-kernel.svg

# List all perf.data events, with customized fields (< Linux 4.1):
perf script -f time,event,trace

# List all perf.data events, with customized fields (>= Linux 4.1):
perf script -F time,event,trace

# List all perf.data events, with my recommended fields (needs record -a; newer kernels):
perf script --header -F comm,pid,tid,cpu,time,event,ip,sym,dso 

# List all perf.data events, with my recommended fields (needs record -a; older kernels):
perf script -f comm,pid,tid,cpu,time,event,ip,sym,dso

# Dump raw contents from perf.data as hex (for debugging):
perf script -D
```

## 7. perf 数据可视化
### 7.1 perf chart

perf timechart输出的是进程运行过程中系统调度的情况，无法对程序的具体代码段进行性能分析，但可以看出总结运行情况：running，idle，I/O等，

```bash
perf timechart record ./a.out     # 记录数据
perf timechart                    # 生成 output.svg
```

### 7.2 火焰图
Brendangregg写了两款对perf采样结果进行可视化分析的开源工具：

1. FlameGraphs即所谓的火焰图，能清晰的展示程序各个函数的性能消耗
2. HeatMap可以从采样数据中的延迟数据来进行消耗展示

```bash
# 生成火焰图
git clone https://github.com/brendangregg/FlameGraph  # or download it from github
cd FlameGraph
perf record -F 99 -ag -- sleep 60
perf script | ./stackcollapse-perf.pl > out.perf-folded
cat out.perf-folded | ./flamegraph.pl > perf-kernel.svg
```

## 参考

- [brendangregg-perf](http://www.brendangregg.com/perf.html)
- [在Linux下做性能分析3：perf](https://zhuanlan.zhihu.com/p/22194920)

