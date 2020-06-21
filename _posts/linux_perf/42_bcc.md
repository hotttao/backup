---
title: 5.2 bcc
date: 2020-02-12
categories:
    - 运维
tags:
    - Linux性能调优
---

<!-- more -->


## 1. bcc 简介
BCC 软件包是使用 eBPF 开发的工具包。这些工具是提供的编写 eBPF 工具的参考示例，并且很实用。它们的使用场景如下图所示：

![bcc_tracing_tools_2016](/images/linux_pf/bcc_tracing_tools_2016.png)

不过需要注意的是很多 eBPF 的新特性，都需要比较新的内核版本（如下图所示）

![bcc_linux](/images/linux_pf/bcc_linux.png)

### 1.2 安装
```bash
# 注意：bcc-tools 需要内核版本为 4.1 或者更新的版本， CentOS，需要手动升级内核版本后再安装。
yum install bcc -y
rpm -ql bcc-tools

# bcc 工具位于 /usr/share/bcc/tools/ 目录中
cd /usr/share/bcc/tools/
```

## 2. CPU 监测

## 3. 内存监测
### 3.1 cachestat
`cachestat [t [n]]`
- 作用: 查看整个操作系统缓存的读写命中情况
- 参数:

```bash

$ cachestat 1 3
   TOTAL   MISSES     HITS  DIRTIES   BUFFERS_MB  CACHED_MB
       2        0        2        1           17        279
       2        0        2        1           17        279
       2        0        2        1           17        279 
```

指标含义:
- TOTAL: 表示总的 I/O 次数；
- MISSES: 表示缓存未命中的次数；
- HITS: 表示缓存命中的次数；
- DIRTIES: 表示新增到缓存中的脏页数；
- BUFFERS_MB: 表示 Buffers 的大小，以 MB 为单位；
- CACHED_MB: 表示 Cache 的大小，以 MB 为单位。

### 3.2 cachetop
`cachetop  [interval]`
- 作用: 类似 top，实时查看间隔时间内每个进程的缓存命中情况
- 输出: 默认按照缓存的命中次数（HITS）排序
- 说明: cachetop 并不会把直接 I/O 算进来。因此观察缓存命中率的同时，我们也需要注意 HITS 命中次数，看起是否匹配应用程序实际I/O大小，以免遗漏直接I/O造成的影响

```bash

$ cachetop
11:58:50 Buffers MB: 258 / Cached MB: 347 / Sort: HITS / Order: ascending
PID      UID      CMD              HITS     MISSES   DIRTIES  READ_HIT%  WRITE_HIT%
13029  root     python                 1        0        0     100.0%       0.0%
```
指标含义:
- MISSES: 表示缓存未命中的次数；
- HITS: 表示缓存命中的次数；
- DIRTIES: 表示新增到缓存中的脏页数；
- READ_HIT: 表示读缓存命中率
- WRITE_HIT: 表示写缓存命中率


### 3.3 memleak
`memleak [t [c]]`
- 作用: 
    - memleak 可以跟踪系统或指定进程的内存分配、释放请求，然后定期输出一个**未释放内存**和相应调用栈的汇总情况（默认 5 秒）。
- 参数:
    - -p PID, --pid PID: 执行跟踪的进程，不指定跟踪内核的内存分配和释放
    - -a, --show-allocs: 表示显示每个内存分配请求的大小以及地址


```bash
./memleak -h
usage: memleak [-h] [-p PID] [-t] [-a] [-o OLDER] [-c COMMAND]
               [--combined-only] [-s SAMPLE_RATE] [-T TOP] [-z MIN_SIZE]
               [-Z MAX_SIZE] [-O OBJ] [--percpu]
               [interval] [count]

Trace outstanding memory allocations that weren\'t freed.
Supports both user-mode allocations made with libc functions and kernel-mode
allocations made with kmalloc/kmem_cache_alloc/get_free_pages and corresponding
memory release functions.

positional arguments:
  interval              interval in seconds to print outstanding allocations
  count                 number of times to print the report before exiting

optional arguments:
  -h, --help            show this help message and exit
  -p PID, --pid PID     the PID to trace; if not specified, trace kernel
                        allocs
  -t, --trace           print trace messages for each alloc/free call
  -a, --show-allocs     show allocation addresses and sizes as well as call
                        stacks
  -o OLDER, --older OLDER
                        prune allocations younger than this age in
                        milliseconds
  -c COMMAND, --command COMMAND
                        execute and trace the specified command
  --combined-only       show combined allocation statistics only
  -s SAMPLE_RATE, --sample-rate SAMPLE_RATE
                        sample every N-th allocation to decrease the overhead
  -T TOP, --top TOP     display only this many top allocating stacks (by size)
  -z MIN_SIZE, --min-size MIN_SIZE
                        capture only allocations larger than this size
  -Z MAX_SIZE, --max-size MAX_SIZE
                        capture only allocations smaller than this size
  -O OBJ, --obj OBJ     attach to allocator functions in the specified object
  --percpu              trace percpu allocations

EXAMPLES:

./memleak -p $(pidof allocs)
        Trace allocations and display a summary of "leaked" (outstanding)
        allocations every 5 seconds
./memleak -p $(pidof allocs) -t
        Trace allocations and display each individual allocator function call
./memleak -ap $(pidof allocs) 10
        Trace allocations and display allocated addresses, sizes, and stacks
        every 10 seconds for outstanding allocations
./memleak -c "./allocs"
        Run the specified command and trace its allocations
./memleak
        Trace allocations in kernel mode and display a summary of outstanding
        allocations every 5 seconds
./memleak -o 60000
        Trace allocations in kernel mode and display a summary of outstanding
        allocations that are at least one minute (60 seconds) old
./memleak -s 5
        Trace roughly every 5th allocation, to reduce overhead

```

下面是 memleak 定位内存泄漏的一个示例:
```bash
$ /usr/share/bcc/tools/memleak -p $(pidof app) -a
Attaching to pid 12512, Ctrl+C to quit.
[03:00:41] Top 10 stacks with outstanding allocations:
    addr = 7f8f70863220 size = 8192
    addr = 7f8f70861210 size = 8192
    addr = 7f8f7085b1e0 size = 8192
    addr = 7f8f7085f200 size = 8192
    addr = 7f8f7085d1f0 size = 8192
    40960 bytes in 5 allocations from stack
        fibonacci+0x1f [app]
        child+0x4f [app]
        start_thread+0xdb [libpthread-2.27.so] 
```

## 4. 磁盘I/O分析
### 4.1 filetop
`filetop`
- 作用: 主要跟踪内核中文件的读写情况，并输出线程 ID（TID）、读写大小、读写类型以及文件名称。

```bash

# 切换到工具目录 
$ cd /usr/share/bcc/tools 

# -C 选项表示输出新内容时不清空屏幕 
$ ./filetop -C 

TID    COMM             READS  WRITES R_Kb    W_Kb    T FILE 
514    python           0      1      0       2832    R 669.txt 
514    python           0      1      0       2490    R 667.txt 
...

TID    COMM             READS  WRITES R_Kb    W_Kb    T FILE 
514    python           2      0      5957    0       R 651.txt 
514    python           2      0      5371    0       R 112.txt 
```
 指标含义: 输出了 8 列内容，分别是线程 ID、线程命令行、读写次数、读写的大小（单位 KB）、文件类型以及读写的文件名称。

### 4.2 opensnoop
`opensnoop`:s
- 作用: 动态跟踪内核中的 open 系统调用

```bash
$ opensnoop 
12280  python              6   0 /tmp/9046db9e-fe25-11e8-b13f-0242ac110002/650.txt 
12280  python              6   0 /tmp/9046db9e-fe25-11e8-b13f-0242ac110002/651.txt 
12280  python              6   0 /tmp/9046db9e-fe25-11e8-b13f-0242ac110002/652.txt 
```