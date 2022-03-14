---
weight: 1
title: 2.1 ftrace 的原理与使用
date: '2020-01-03T22:10:00+08:00'
lastmod: '2020-01-03T22:10:00+08:00'
draft: false
author: 宋涛
authorLink: https://hotttao.github.io/
description: 2.1 ftrace 的原理与使用
featuredImage: null
tags:
- Linux 性能调优
categories:
- Linux
lightgallery: true
---

最早 ftrace 是一个 function tracer，仅能够记录内核的函数调用流程。如今 ftrace 已经成为一个 framework，采用 plugin 的方式支持开发人员添加更多种类的 trace 功能。

<!-- more -->

## 1. ftrace 简介

Ftrace 最初是在 2.6.27 中出现，那时 systemTap 已经开始崭露头角，其他的 trace 工具包括 LTTng 等也已经发展多年。那为什么人们还要再开发一个 trace 工具呢？

SystemTap 目标是达到甚至超越 Dtrace 。因此 SystemTap 设计比较复杂，在真正的产品环境，人们依然无法放心的使用她。不当的使用和 SystemTap 自身的不完善都有可能导致系统崩溃。

Ftrace 的设计目标简单，本质上是一种静态代码插装技术，不需要支持某种编程接口让用户自定义 trace 行为。静态代码插装技术更加可靠，不会因为用户的不当使用而导致内核崩溃。 ftrace 代码量很小，稳定可靠。实际上，即使是 Dtrace，大多数用户也只使用其静态 trace 功能。因此 ftrace 的设计非常务实。


ftrace一个比较明显的缺点是没有用户态的跟踪点支持。perf-tools 对Ftrace的功能进行了很好的封装和集成，建议大家用perf-tools来使用Ftrace，则效果更佳更简单。后面会介绍 perf-tools 的使用，在此之前我们先来看看怎么使用 ftrace。 

## 2. ftrace 原理

![ftrace_arch](/images/linux_pf/ftrace_arch.png)
Ftrace 有两大组成部分:

1. 一是 framework
2. 二是一系列的 tracer， 每个 tracer 完成不同的功能，它们统一由 framework 管理
3. ftrace 的 trace 信息保存在 ring buffer(内存缓冲区) 中，由 framework 负责管理
4. ftrace有两种主要跟踪机制可以往缓冲区中写数据
    - 一是函数: 即动态探针，可以跟踪内核函数的调用栈，包括 function tracer，function graph tracer 两个 tracer
    - 二是事件: 即静态探针，包括其他大多数的 tracer
5. Framework 利用 debugfs 系统在 /debugfs 下建立 tracing 目录，对用户空间输出 trace 信息，并提供了一系列的控制文件
6. ftrace的目录设置和sysfs类似，都是把目录当作对象，把里面的文件当作这个对象的属性。debugfs/tracing 目录可以理解成一个独立的监控实例 instance，在 tracing 目录或者子目录创建任何目录相当于创建了一个新的 ftrace 实例，ftrace 会为这个 ftrace 实例自动创建 ring buffer 内存缓冲区，并在这个目录下创建 ftrace 实例所需的与 tracing 目录完全相同的文件。  

debugfs在大部分发行版中都mount在**/sys/kernel/debug**目录下，而ftrace就在这个目录下的tracing目录中。如果系统没有mount这个文件系统，可以手动 mount。

```bash

# 1. 重新挂在 debugfs  
mount -t debugfs none /debugs

# 2. debugfs/tracing 目录
ll /debugs/tracing

# 3. 创建新的 ftrace trace 实例
mkdir /debugs/tracing/instance/python

# ftrace 会创建新的内存缓冲区并生成 ftrace 相关文件
ll tracing/instances/python/
```

## 3. ftrace 控制机制

在讲解 ftrace 的 tracer 之前，我们先来看看 tracing 目录下的文件，它们提供了对 ftrace trace 过程的控制。

```bash
ls
available_events            free_buffer               printk_formats       snapshot            trace_stat
available_filter_functions  function_profile_enabled  README               stack_max_size    tracing_cpumask
available_tracers           hwlat_detector            saved_cmdlines       stack_trace   tracing_max_latency
buffer_size_kb              instances                 saved_cmdlines_size  stack_trace_filter  tracing_on
buffer_total_size_kb        kprobe_events             set_event            trace              tracing_thresh
current_tracer              kprobe_profile            set_ftrace_filter    trace_clock        uprobe_events
dyn_ftrace_total_info       max_graph_depth           set_ftrace_notrace   trace_marker       uprobe_profile
enabled_functions           options                   set_ftrace_pid       trace_options
events                      per_cpu                   set_graph_function   trace_pipe
```

tracing 目录下的文件分成了下面四类:
1. 提示类：显示当前系统可用的event，tracer 列表
2. 控制类：控制 ftrace 的跟踪参数
3. 显示类：显示 trace 信息
4. 辅助类：一些不明或者不重要的辅助信息

#### 提示类

|ftrace 文件|作用
|:---|:---|
|available_events|可用事件列表，也可查看 events/ 目录|
|available_filter_functions|当前内核导出的可以跟踪的函数|
|dyn_ftrace_total_info|显示available_filter_functins中跟中函数的数目|
|available_tracers|可用的 tracer，不同的 tracer 有不同的功能|
|events|1. 查看可用事件列表以及事件参数(事件包含的内核上下文信息)<br>cat events/sched/sched_switch/format<br>2.设置事件的过滤条件<br>echo 'next_comm ~ "cs"' > events/sched/sched_switch/filter|

#### 控制类
|适用 tracer |ftrace 文件|作用
|:---|:---|:---|
|通用|tracing_on|用于控制跟踪打开或停止，0停止跟踪，1继续跟踪|
|通用|tracing_cpumask|设置允许跟踪特定CPU|
|通用|tracing_max_latency|记录Tracer的最大延时|
|通用|tracing_thresh|延时记录Trace的阈值，当延时超过此值时才开始记录Trace。单位是ms，只有非0才起作用|
|通用|events|1. 查看可用事件列表以及事件参数(事件包含的内核上下文信息)<br>cat events/sched/sched_switch/format<br>2.设置事件的过滤条件<br>echo 'next_comm ~ "cs"' > events/sched/sched_switch/filter|
|通用|set_event|设置跟踪的 event 事件，与通过events目录内的 filter 文件设置一致|
|通用|current_tracer|1. 设置或者显示当前使用的跟踪器列表<br>2. 系统缺省为nop，可以通过写入nop重置跟踪器<br>3. 使用echo将跟踪器名字写入即可打开<br>echo function_graph > current_tracer|
|通用|buffer_size_kb|设置单个CPU所使用的跟踪缓存的大小<br>如果跟踪太多，旧的信息会被新的跟踪信息覆盖掉<br>不想被覆盖需要先将current_trace设置为nop才可以|
|通用|buffer_total_size_kb|显示所有CPU ring buffer 大小之和|
|通用|trace_options|trace 过程的复杂控制选项<br>控制Trace打印内容或者操作跟踪器<br>也可通过 options/目录设置|
|通用|options/|显示 trace_option 的设置结果<br>也可以直接设置，作用同 trace_options|
|func|function_profile_enabled|打开此选项，trace_stat就会显示function的统计信息<br>echo 0/1 > function_profile_enabled|
|func|set_ftrace_pid|设置跟踪的pid|
|func|set_ftrace_filter|用于显示指定要跟踪的函数<br>|
|func|set_ftrace_notrace|用于指定不跟踪的函数，缺省为空|
|graph|max_graph_depth|函数嵌套的最大深度|
|graph|set_graph_function|设置要清晰显示调用关系的函数<br>缺省对所有函数都生成调用关系|
|Stack|stack_max_size|当使用stack跟踪器时，记录产生过的最大stack size|
|Stack|stack_trace|显示stack的back trace|
|Stack|stack_trace_filter|设置stack tracer不检查的函数名称|


#### 输出类
|ftrace 文件|作用
|:---|:---|
|printk_formats|提供给工具读取原始格式trace的文件|
|trace|查看 ring buffer 内跟踪信息<br>echo > trace可以清空当前RingBuffer|
|trace_pipe|输出和trace一样的内容，但输出Trace同时将RingBuffer清空<br>可避免RingBuffer的溢出<br>保存文件内容: cat trace_pipe > trace.txt &|
|snapshot|是对trace的snapshot<br>echo 0清空缓存，并释放对应内存<br>echo 1进行对当前trace进行snapshot，如没有内存则分配<br>echo 2清空缓存，不释放也不分配内存
|trace_clock|显示当前Trace的timestamp所基于的时钟，默认使用local时钟<br>local：默认时钟；可能无法在不同CPU间同步<br>global：不同CUP间同步，但是可能比local慢<br>counter：跨CPU计数器，需要分析不同CPU间event顺序比较有效|
|trace_marker|从用户空间写入标记到trace中，用于用户空间行为和内核时间同步|
|trace_stat|每个CPU的Trace统计信息|
|per_cpu/|trace等文件的输出是综合所有CPU的，如果你关心单个CPU可以进入per_cpu目录，里面有这些文件的分CPU版本|
|enabled_functions|显示有回调附着的函数名称|
|saved_cmdlines|放pid对应的comm名称作为ftrace的cache，这样ftrace中不光能显示pid还能显示comm|
|saved_cmdlines_size|  saved_cmdlines的数目|

trace、trace_pipe和snapshot的区别:
1. trace是从RingBuffer中取出内容
2. trace_pipe会一直读取Buffer流。
3. snapshot是trace的一个瞬间快照：

#### 辅助类
|ftrace 文件|作用
|:---|:---|
|free_buffer|此文件用于在一个进程被关闭后，同时释放RingBuffer内存，并将调整大小到最小值|
|instances|空目录，可在此目录创建新的 ftrace 实例|
|hwlat_detector|||
|kprobe_events|||
|kprobe_profile|||
|uprobe_events||
|uprobe_profile||

### 4. ftrace tracer
下面是 ftrace tracer 的不完全列表，每一个 tracer 输出的内容和格式都不一样，对于我们比较常用的是 Function，Graph，Schedule switch，softirq。

|ftrace |作用
|:---|:---|
|Function|跟踪函数调用|
|Function graph tracer|跟踪函数调用，显示调用关系|
|**Schedule switch**| 跟踪进程调度情况|
|Wakeup|跟踪进程的调度延迟，即高优先级进程从进入 ready 状态到获得 CPU 的延迟时间。该 tracer 只针对实时进程|
|Irqsoff|当中断被禁止时，系统无法相应外部事件，比如键盘和鼠标，时钟也无法产生 tick 中断。这意味着系统响应延迟，irqsoff 这个 tracer 能够跟踪并记录内核中哪些函数禁止了中断，对于其中中断禁止时间最长的，irqsoff 将在 log 文件的第一行标示出来，从而使开发人员可以迅速定位造成响应延迟的罪魁祸首|
|Preemptoff|和前一个 tracer 类似，preemptoff tracer 跟踪并记录禁止内核抢占的函数，并清晰地显示出禁止抢占时间最长的内核函数|
|Preemptirqsoff| 同上，跟踪和记录禁止中断或者禁止抢占的内核函数，以及禁止时间最长的函数|
|Branch|跟踪内核程序中的 likely/unlikely 分支预测命中率情况。 Branch tracer 能够记录这些分支语句有多少次预测成功。从而为优化程序提供线索|
|Hardware branch|利用处理器的分支跟踪能力，实现硬件级别的指令跳转记录。在 x86 上，主要利用了 BTS 这个特性|
|Initcall|记录系统在 boot 阶段所调用的 init call |
|Mmiotrace|记录 memory map IO 的相关信息|
|Power|记录系统电源管理相关的信息|
|Sysprof|缺省情况下，sysprof tracer 每隔 1 msec 对内核进行一次采样，记录函数调用和堆栈信息|
|Kernel memory| 内存 tracer 主要用来跟踪 slab allocator 的分配情况。包括 kfree，kmem_cache_alloc 等 API 的调用情况，用户程序可以根据 tracer 收集到的信息分析内部碎片情况，找出内存分配最频繁的代码片断，等等|
|Workqueue statistical|这是一个 statistic tracer，统计系统中所有的 workqueue 的工作情况，比如有多少个 work 被插入 workqueue，多少个已经被执行等。开发人员可以以此来决定具体的 workqueue 实现，比如是使用 single threaded workqueue 还是 per cpu workqueue|
|Event| 跟踪系统事件，比如 timer，系统调用，中断等|

## 5. ftrace 的实战
### 5.1 跟踪进程调度
示例一我们来看看如何跟踪 Python 进程执行过程发生的进程调度:

```bash
# 1. 假设我们要跟踪一个 Python 文件执行中的进程调度
> vim run.py
with open("./content.csv") as bf:
    print(bf.readlines())

# 2. 将 ftrace 的选项写入脚本中
> vim ftrace.sh
py=/home/tao/debugs/tracing/
mkdir -pv $py
echo nop > $py/current_tracer
echo 0 > $py/tracing_on
echo $$ > $py/set_ftrace_pid
echo "sched:*" > $py/set_event
#replace test_proc_show by your function name
#echo test_proc_show > $py/set_graph_function
echo 1 > $py/tracing_on
exec "$@"

# 3.启动跟踪并查看结果
> bash ftrace.sh python ftrace.py && echo 0 > /home/tao/debugs/tracing/tracing_on
> vim /home/tao/debugs/tracing/trace
```

### 5.2 跟踪系统调用
示例2 我们来看看如何跟踪系统调用。以 ls 命令为例，显示 do_sys_open 调用栈。 

```bash
# 这次使用系统默认挂载的 debugfs
$ cd /sys/kernel/debug/tracing/

# 1. 设置要显示调用栈的函数
$ echo do_sys_open > set_graph_function 

# 2. 配置跟踪选项，开启函数调用跟踪，并跟踪调用进程
$ echo function_graph > current_tracer
$ echo funcgraph-proc > trace_options

# 3. 开启追踪
$ echo 1 > tracing_on

# 4. 执行一个 ls 命令后，再关闭跟踪：
$ ls
$ echo 0 > tracing_on

# 5.查看追踪结果

$ cat trace
# tracer: function_graph
#
# CPU  TASK/PID         DURATION                  FUNCTION CALLS
# |     |    |           |   |                     |   |   |   |
 0)    ls-12276    |               |  do_sys_open() {
 0)    ls-12276    |               |    getname() {
 0)    ls-12276    |               |      getname_flags() {
 0)    ls-12276    |               |        kmem_cache_alloc() {
 0)    ls-12276    |               |          _cond_resched() {
 0)    ls-12276    |   0.049 us    |            rcu_all_qs();
 0)    ls-12276    |   0.791 us    |          }
 0)    ls-12276    |   0.041 us    |          should_failslab();
 0)    ls-12276    |   0.040 us    |          prefetch_freepointer();
 0)    ls-12276    |   0.039 us    |          memcg_kmem_put_cache();
 0)    ls-12276    |   2.895 us    |        }
 0)    ls-12276    |               |        __check_object_size() {
 0)    ls-12276    |   0.067 us    |          __virt_addr_valid();
 0)    ls-12276    |   0.044 us    |          __check_heap_object();
 0)    ls-12276    |   0.039 us    |          check_stack_object();
 0)    ls-12276    |   1.570 us    |        }
 0)    ls-12276    |   5.790 us    |      }
 0)    ls-12276    |   6.325 us    |    }
...
```
输出: 第三列是函数执行延迟；最后一列，则是函数调用关系图。

## 6. trace-cmd
trace-cmd 可以把上面这些步骤给包装起来，通过同一个命令行工具，就可完成上述所有过程。下面是示例2 中跟踪 do_sys_open 的 trace-cmd 版本。

```bash
# 1. 安装
$ yum install trace-cmd
# 2. 启动追踪
$ trace-cmd record -p function_graph -g do_sys_open -O funcgraph-proc ls

# 3. 查看追踪结果
$ trace-cmd report
...
              ls-12418 [000] 85558.075341: funcgraph_entry:                   |  do_sys_open() {
              ls-12418 [000] 85558.075363: funcgraph_entry:                   |    getname() {
              ls-12418 [000] 85558.075364: funcgraph_entry:                   |      getname_flags() {
              ls-12418 [000] 85558.075364: funcgraph_entry:                   |        kmem_cache_alloc() {
              ls-12418 [000] 85558.075365: funcgraph_entry:                   |          _cond_resched() {
              ls-12418 [000] 85558.075365: funcgraph_entry:        0.074 us   |            rcu_all_qs();
              ls-12418 [000] 85558.075366: funcgraph_exit:         1.143 us   |          }
              ls-12418 [000] 85558.075366: funcgraph_entry:        0.064 us   |          should_failslab();
              ls-12418 [000] 85558.075367: funcgraph_entry:        0.075 us   |          prefetch_freepointer();
              ls-12418 [000] 85558.075368: funcgraph_entry:        0.085 us   |          memcg_kmem_put_cache();
              ls-12418 [000] 85558.075369: funcgraph_exit:         4.447 us   |        }
              ls-12418 [000] 85558.075369: funcgraph_entry:                   |        __check_object_size() {
              ls-12418 [000] 85558.075370: funcgraph_entry:        0.132 us   |          __virt_addr_valid();
              ls-12418 [000] 85558.075370: funcgraph_entry:        0.093 us   |          __check_heap_object();
              ls-12418 [000] 85558.075371: funcgraph_entry:        0.059 us   |          check_stack_object();
              ls-12418 [000] 85558.075372: funcgraph_exit:         2.323 us   |        }
              ls-12418 [000] 85558.075372: funcgraph_exit:         8.411 us   |      }
              ls-12418 [000] 85558.075373: funcgraph_exit:         9.195 us   |    }
...
```

## 参考

- [ftrace 简介](https://www.ibm.com/developerworks/cn/linux/l-cn-ftrace/index.html)
- [在Linux下做性能分析2：ftrace](https://zhuanlan.zhihu.com/p/22130013)
- [Linux ftrace框架介绍及运用](https://www.cnblogs.com/arnoldlu/p/7211249.html)
- [宋宝华：关于Ftrace的一个完整案例](https://juejin.im/post/5dc4235ce51d456e300e0a8f)