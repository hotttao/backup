---
title: 2.2 perf 的原理与使用
date: 2020-01-04
categories:
    - 运维
tags:
    - Linux性能调优
---

perf 感觉像是一个完全版的 top，可以帮助我们看到操作系统运行的全貌。perf 的使用非常复杂，本文只是一个入门，推荐大家去阅读大神 Brendangregg 的文章[perf Examples](http://www.brendangregg.com/perf.html)。

<!-- more -->

## 1. perf 简介

perf的原理是这样的：每隔一个固定的时间，就在CPU上（每个核上都有）产生一个中断，在中断上看看，当前是哪个pid，哪个函数，然后给对应的pid和函数加一个统计值，这样，我们就知道CPU有百分几的时间在某个pid，或者某个函数上了。

这种方式可以推广到各种事件，比如上一个博文我们介绍的ftrace的事件，你也可以在这个事件发生的时候上来冒个头，看看击中了谁，然后算出分布，我们就知道谁会引发特别多的那个事件了。

所以本质上 perf 属于一种抽样统计。既然是抽样统计我们就要警惕抽样带来的抽样误差。每次看perf report的报告，首先要去注意一下总共收集了多少个点，如果你只有几十个点，你这个报告就可能很不可信了。

## 2. perf 的原理

![perf_events_map](/images/linux_pf/perf_events_map.png)

perf 可以利用我们所说的所有四种 event，可以直接跟踪到整个系统的所有程序（而不仅仅是内核），所以perf通常是我们分析的第一步。上面是 perf 的架构图。

### 2.1 idle

现代CPU基本上已经不用忙等的方式进入等待了，所以，如果CPU在idle，击中任务也会停止，所以，在Idle上是没有点的。看到Idle函数本身的点并非CPU Idle的点，而是准备进入Idle前后花的时间。所以，perf的统计不能用来让你分析CPU占用率的。ftrace和top等工具才能看CPU占用率，perf是不行的。

### 2.2 中断

perf还有一个问题是对中断的要求，perf很多事件都依赖中断，但Linux内核是可以关中断的，关中断以后，你就无法击中关中断的点了，你的中断会被延迟到开中断的时候，所以，在这样的平台上，你会看到很多开中断之后的函数被密集击中。但它们是无辜的。但更糟糕的是，如果在关中断的时候，发生了多个事件，由于中断控制器会合并相同的中断，你就会失去多次事件，让你的统计发生错误。

现代的Intel平台，基本上已经把PMU中断都切换为NMI中断了（不可屏蔽），所以前面这个问题不存在。但在大部分ARM/ARM64平台上，这个问题都没有解决，所以看这种平台的报告，都要特别小心，特别是你看到_raw_spin_unlock()一类的函数击中极高，你就要怀疑一下你的测试结果了（注意，这个结果也是能用的，只是看你怎么用）。

### 3. perf 的使用

### 3.1 perf 安装

perf的源代码就是Linux的源代码目录中，因为它在相当程度上和内核是关联的。一般Linux 的各种发行版本都会安装好与内核相对应的 perf 命令。perf 有两种安装方式

1. 通过包管理进行安装，perf工具在 linux-tools-common工具包里，通过包管理软件安装的时候还需要依赖linux-tools-kernelversion包
2. 源码编译：找到对应内核版本的源码包，在tools/perf目录下进行编译

### 2.2 perf

`perf [--version] [--help] [OPTIONS] COMMAND [ARGS]`

|子命令|作用|
|:---|:---|
|list            |List all symbolic event types<br>列出当前系统支持的所有事件名,可分为三类：硬件事件、软件事件，检查点|
|top             |System profiling tool.<br>对系统的性能进行分析，类似top命令|
|record          |Run a command and record its profile into perf.data<br>	对程序运行过程中的事件进行分析和记录，并写入perf.data|
|report          |Read perf.data (created by perf record) and display the profile<br>读取perf.data(由perf record生成) 并显示分析结果|
|sched           |Tool to trace/measure scheduler properties (latencies)<br>针对调度器子系统的分析工具|
|lock            |Analyze lock events<br>分析内核中的锁信息，包括锁的争用情况，等待延迟等|
|mem             |Profile memory accesses<br>分析内存访问|
|kmem            |Tool to trace/measure kernel memory properties<br>分析内核内存的使用|
|kvm             |Tool to trace/measure kvm guest os<br>分析kvm虚拟机上的guest os|
|stat            |Run a command and gather performance counter statistics<br>对程序运行过程中的性能计数器进行统计|
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

#### perf list

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

perf list给出的事件是厂家上传上去给Linux社区的，但有些厂家会有自己的事件统计，没有上传出去，这需要从厂家的用户手册中获得，这种事件，可以直接用编号表示，比如格式是rXXXX，比如在我们的芯片里面，0x13号表示跨芯片内存访问，你就可以用`-e r0013`来跟踪软件的跨片访问次数

#### perf top

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

#### perf stat

perf stat:

- 命令格式:
  - `perf stat [-e <EVENT> | --event=EVENT] [-a] <command>`
  - `perf stat [-e <EVENT> | --event=EVENT] [-a] — <command> [<options>]`
  - `perf stat [-e <EVENT> | --event=EVENT] [-a] record [-o file] — <command> [<options>]`
  - `perf stat report [-i file]`
- 作用: 可以对程序运行过程中的性能计数器(包括Hardware，software counters)进行统计，分析程序的整体消耗情况

```bash
$perf stat ls
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

1. task-clock (msec): cpu处理task所消耗的时间，单位ms，0.808 CPUs utilized的表示cpu使用率为80.8%，该值越高代表程序是CPU bound而非IO bound 类型
2. instructions：执行的指令条数， insns per cycle: 即IPC，每个cpu周期执行的指令条数，IPC比上面的CPU使用率更能说明CPU的使用情况
3. stalled-cycles-frontend和stalled-cycles-backend表示CPU停滞统计
4. branches：这段时间内发生分支预测的次数。现代的CPU都有分支预测方面的优化。
5. branches-misses：这段时间内分支预测失败的次数，这个值越小越好。

#### perf record/report

perf-record用来启动一次跟踪，而perf-report用来输出跟踪结果。

1. perf record在当前目录产生一个perf.data文件，用来记录过程数据
2. 如果这个文件已经存在，旧的文件会被改名为perf.data.old
3. perf.data只包含原始数据，perf report 需要访问本地的符号表，pid和进程的对应关系等信息来生成报告。
4. 所以perf.data不能直接拷贝，可以通过perf-archive命令把所有这些数据打包，然后复制

```bash
sudo perf record -e 'cycles' - myapplication arg1 arg2
sudo perf report

perf record -e probe:schedule -a sleep 1 
```

**perf record**

- 命令格式:
  - `perf record [-e <EVENT> | --event=EVENT] [-a] <command>`
  - `perf record [-e <EVENT> | --event=EVENT] [-a] — <command> [<options>]`
- 参数:
  - `-p, --pid <pid>`: 指定跟踪固定的一组进程，即仅仅跟踪发生在特定pid的事件
  - -a, --all-cpus: 跟踪整个系统的性能，常用选项
  - `-c, --count <n>`: 累计多少个事件记录一次
  - -g: 开启堆栈追踪，通常无需使用
  - -F: 事件采样的频率, 单位HZ, 更高的频率会获得更细的统计，但会带来更多的开销
  - sleep: 采样的时间
  - `-g, --call-graph`: 展示调用栈
    - 格式: `<print_type,threshold[,print_limit],order,sort_key[,branch],value>`
      - print_type:     call graph printing style (graph|flat|fractal|folded|none)
      - threshold:      minimum call graph inclusion threshold (`<percent>`)
      - print_limit:    maximum number of call graph entry (`<number>`)
      - order:          call graph order (caller|callee)
      - sort_key:       call graph sort key (function|address)
      - branch:         include last branch info to call graph (branch)
      - value:          call graph value (percent|period|count)


```bash
# 跟踪 Python 进程以及整个系统的性能
# 但不会包括其他用户进程占用的资源
perf record -e 'cycles' -a python3.6 test.py
```

**perf report**
`perf report [-i <file> | --input=file]`

- 使用: 显示的是一个菜单项，回车可以查看折叠的代码，esc 或者 q 可以退出返回上一级
- 参数:
  - --pid=: 指定 pid
  - --tid=: 指定 tid
  - -S, --symbols=: Only consider these symbols. 

```bash
# Show perf.data as a text report, with data coalesced and percentages:
perf report --stdio

# Report, with stacks in folded format: one line per stack (needs 4.4):
perf report --stdio -n -g folded
```

#### perf diff

`perf diff [baseline file] [data file1] [[data file2] ... ]`

- 作用: 比较两次运行的区别
- 场景: 可以用不同参数运行程序，看看两次运行的差别

#### perf script

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

#### perf chart

perf timechart输出的是进程运行过程中系统调度的情况，无法对程序的具体代码段进行性能分析，但可以看出总结运行情况：running，idle，I/O等，

```bash
perf timechart record ./a.out     # 记录数据
perf timechart                    # 生成 output.svg
```

### 2.3 堆栈追踪

假设 A 函数调用了函数 B，默认情况下在 perf record 的记录中，A 的运行时间是不包含 B 函数的运行时间的。大多数情况下这么记录是正确的，因为 report 才能够显示出真正耗时的位置。

假设我们想将 B 的耗时记录到 A 中，可以启动堆栈跟踪 -g，也就是每次击中的时候，向上回溯一下调用栈，让调用者的计数也加一。

使用堆栈跟踪要注意的是:

1. 堆栈跟踪受扫描深度的限制，太深的堆栈可能回溯不过去，这是有可能影响结果的。
2. 有些我们从源代码看来是函数调用的，其实在汇编一级并不是函数调用
    - 比如inline函数，宏，都不是函数调用
    - 另外，gcc在很多平台中，会自动把很短的函数变成inline函数，这也不产生函数调用
    - 还有一种是，fastcall函数，通过寄存器传递参数，不会产生调用栈，也有可能不产生调用栈
    - 部分平台使用简化的堆栈回溯机制，在堆栈中看见一个地址像是代码段的地址，就认为是调用栈

## 3. perf 火焰图

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