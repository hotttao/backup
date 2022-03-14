---
weight: 1
title: 3.1 Systemp 简介
date: '2020-01-08T22:10:00+08:00'
lastmod: '2020-01-08T22:10:00+08:00'
draft: false
author: 宋涛
authorLink: https://hotttao.github.io/
description: 3.1 Systemp 简介
featuredImage: null
tags:
- Linux 性能调优
categories:
- Linux
lightgallery: true
---

从今天开始我们将学习第一个可编程的动态追踪工具 Systemtap。本节是 Systemtap 的一个基本介绍。
<!-- more -->

## 1. Systemtap 简介
动态追踪技术起源于 Solaris 系统的 DTrace。Dtrace 有 Linux  Mac OS X 等系统的移植版，但是实现的都差强人意，不支持很多高级特性。Systemtap 是 Redhat 开源的 Linux 上的动态追踪工具，是 Linux 上目前最成熟的动态追踪框架。

### 1.1 Systemtap 框架
![systemtap-works](/images/linux_pf/how-systemtap-works.webp)

Systemtap 的框架如上图所示:
1. Systemtap 并不是 Linux 内核的一部分，因此第一步需要把 Systemtap 自己的“小语言”脚本（有点像 D 语言）动态编译成一个 Linux 内核模块的 C 源码，并加载到内核才能运行
2. Systemtap 使用的我们前面介绍的内核工具框架
3. DWARF 是Linux的调试符号表格式

整个SystemTap脚本所做的，无非就是声明感兴趣的事件，然后添加对应的处理程序。当SystemTap脚本运行时，SystemTap会监控声明的事件；一旦事件发生，Linux内核会临时切换到对应的处理程序，完成后再重拾原先的工作。

可供监控的事件种类繁多：进入/退出某个函数，定时器到期，会话终止，等等。处理程序由一组SystemTap语句构成，指明事件发生后要做的工作。其中包括从事件上下文中提取数据，存储到内部变量中，输出结果。

### 1.2 Systemtap 的优缺点
Systemtap 有如下的优缺点:
1. 首先，它并不是 Linux 内核的一部分，就是说它并没有与内核紧密集成，所以它需要一直不停地追赶主线内核的变化。
2. 另一个缺点是，它需要动态编译，因此经常需要在线部署 C 编译器工具链和 Linux 内核的头文件。出于这些原因，SystemTap 脚本的启动相比 DTrace 要慢得多
3. 无论是 DTrace 还是 SystemTap，其实都不支持编写完整的调试工具，因为它们都缺少方便的命令行交互的原语。所以我们才看到现实世界中许多基于它们的工具，其实最外面都有一个 Perl、Python 或者 Shell 脚本编写的包裹。比如 [stap++](https://github.com/openresty/stapxx)
4. SystemTap 的优点是它有非常成熟的用户态调试符号的自动加载，同时也有循环这样的语言结构可以去编写比较复杂的探针处理程序，可以支持很多很复杂的分析处理。

 GitHub 上面，有很多针对像 Nginx、LuaJIT 和操作系统内核这样的系统软件，也有一些是针对更高层面的像 OpenResty 这样的 Web 框架。有兴趣的朋友可以查看 GitHub 上面的 [nginx-systemtap-toolkit](https://github.com/openresty/nginx-systemtap-toolkit)、[perl-systemtap-toolkit](https://github.com/agentzh/perl-systemtap-toolkit) 和 [stappxx](https://github.com/openresty/stapxx) 这几个代码仓库。
 
## 2. stap 安装
SystemTap需要内核信息，这样才能注入指令。此外，这些信息还能帮助SystemTap生成合适的检测代码。
这些必要的内核信息分别包括在特定内核版本所对应的-devel，-debuginfo和-debuginfo-common包中。对于“标准版”内核（指按照常规配置编译的内核），所需的-devel和-debuginfo等包命名为：
- kernel-debuginfo
- kernel-debuginfo-common
- kernel-devel: 通常已经安装

下面是Centos7 安装过程的示例：

```bash
# 方法一，直接执行 stap-prep，如果不起作用，需要手动安装方法二中的包
stap-prep

## 方法二
# 1. 配置yum 源
[debug]
name=CentOS-$releasever - DebugInfo
baseurl=http://debuginfo.centos.org/$releasever/$basearch/
gpgcheck=0
enabled=1
protect=1
priority=1

# 2.安装 kernel-debuginfo
yum --enablerepo=debug install -y kernel-debuginfo-$(uname -r)

# 3. rpm 包位置，可直接下载手动 yum install 
http://debuginfo.centos.org/7/x86_64/kernel-debuginfo-common-x86_64-3.10.0-957.el7.x86_64.rpm
http://debuginfo.centos.org/7/x86_64/kernel-debuginfo-3.10.0-957.el7.x86_64.rpm

http://debuginfo.centos.org/7/x86_64/kernel-debuginfo-common-x86_64-3.10.0-1062.el7.x86_64.rpm
http://debuginfo.centos.org/7/x86_64/kernel-debuginfo-3.10.0-1062.el7.x86_64.rpm

## 4. 运行下面命令开始检查，显示 pass 5 表示运行成功
stab-prep
stap -v -e 'probe vfs.read {printf("read performed\n"); exit()}'

Pass 1: parsed user script and 474 library scripts using 251936virt/49240res/3488shr/45992data kb, in 80usr/330sys/411real ms.
Pass 2: analyzed script: 1 probe, 1 function, 7 embeds, 0 globals using 416832virt/210188res/4872shr/210888data kb, in 1100usr/960sys/2058real ms.
Pass 3: translated to C into "/tmp/stapdYWPVH/stap_5e2f013414e74a4de164b8e5c7459ef6_2765_src.c" using 416832virt/210444res/5128shr/210888data kb, in 10usr/70sys/85real ms.
Pass 4: compiled C into "stap_5e2f013414e74a4de164b8e5c7459ef6_2765.ko" in 1090usr/660sys/1643real ms.
Pass 5: starting run.
read performance
Pass 5: run completed in 10usr/70sys/373real ms.
```

### 2.1 为其他计算机生成检测模块
为了避免为所有带监测机器配置 Systemtap 环境的问题，SystemTap提供了交叉检测（cross-instrumentaion）的功能:
1. 在一台计算机上运行SystemTap脚本，生成在另一台机器上可用的SystemTap检测模块
2. 目标机器仅需安装 systemtap-runtime 来使用生成的SystemTap检测模块

创建和分发的过程如下:
```bash
# 1. 创建检测模块
stap -r kernel_version script -m module_name
> stap -r `uname -r` -e 'probe vfs.read {printf("read performance\n"); exit()}' -m test
> ll test.ko
-rw-r--r-- 1 root root 97392 4月   9 10:23 test.ko

# 2. 分发运行检测模块
> staprun test.ko
```

## 3. stap 
stap
- 作用: 从SystemTap脚本中读取探测指令，把它们转化为C代码，构建一个内核模块，并加载到当前的Linux内核中运行
- 参数:
  - `-v` 让SystemTap会话输出更加详细的信息.重复该选项多次来提高执行信息的详尽程度 
  - `-o file_name`: 将输出重定向到file_name
  - `-S size[,count]`: 将输出文件的最大大小限制成sizeMB，存储文件的最大数目为count
  - `-x process_id`: 设置SystemTap处理函数target()为指定PID，target() 是 systemtap 脚本的内置函数 
  - `-c 'command'`: 运行command，并在command结束时退出。同时会把target()设置成command运行时的PID
  - `-e script`: 直接执行给定的脚本
  - `-F`: 进入SystemTap的飞行记录仪模式，并在后台运行该脚本
- man: `man probe::ioblock.request`

### 3.1 stap 飞行记录模式
SystemTap的飞行记录仪模式允许你长时间运行一个SystemTap脚本，并关注最新的输出。飞行记录仪模式会限制输出的生成量。

飞行记录仪模式还可以分成两种：内存型（in-memory）和文件型（file）。无论哪一种 SystemTap脚本都是作为后台进程运行。

#### 内存型: 
有 `-F` 选项，但没有指定 `-o` 选项时启用，SystemTap会把脚本输出结果存储在内核内存的缓冲区内。默认情况下，缓冲区大小为1MB.你可以使用-s(小s)来调整这个值

```bash
> stap -F iotime.stp

Disconnecting from systemtap module.
To reconnect, type "staprun -A stap_5dd0073edcb1f13f7565d8c343063e68_19556"

# 重连，得到输出结果
> staprun -A stap_5dd0073edcb1f13f7565d8c343063e68_19556
```

#### 文件型
同时指定 `-F`,`-o` 选项时启用，-S选项来控制输出文件的大小和数目-S选项来控制输出文件的大小和数目。

```bash
> stap -F -o /tmp/pfaults.log -S 1,2  pfaults.stp
7590  # stap 进程的 PID

# 终止 stap 进程
> kill -s SIGTERM 7590
```