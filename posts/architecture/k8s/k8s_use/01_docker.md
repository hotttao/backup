---
weight: 1
title: "容器基础"
date: 2020-08-01T22:00:00+08:00
lastmod: 2020-08-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "这个系列我们开始学习 k8s"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---

这个系列我们开始学习 k8s，但是想学好 k8s 并不容易，网络、操作系统、分布式原理都是 k8s 重要的组成部分。我自己将整个学习分成了如下几个系列:
1. k8s 的设计和使用: 这个系列我们从使用层次上，明白 k8s 高层次的抽象和设计，达到能高效使用 k8s 的目的
2. k8s 的源码解析: 这个系列我们从源码层次上，透析 k8s 的设计与实现，并学习 k8s 里面优秀的代码设计
3. k8s 的网络模型: 这个系列我们从网络层次上，学习 k8s 上不同的网络插件对应的网络模型及其实现

这篇文章开始，我们学习 k8s 的设计和使用，选用的教材是:
1. [极客时间张磊老师的专栏-深入剖析 Kubernetes](https://time.geekbang.org/column/intro/100015201?tab=catalog)
2. [Kubernetes in Action中文版](https://book.douban.com/subject/30418855/)

而今天的内容则是跟容器有关。容器技术的核心功能，就是通过约束和修改进程的动态表现，从而为其创造出一个“边界”，而使用到的核心技术就是:
1. Namespace: 修改进程视图，创建进程的边界
2. Cgroups: 限制容器的资源使用量
3. chroot/容器镜像: 容器镜像配合 chroot 更改容器看到的根目录

## 1. Namespace
### 1.1 Namespace 原理
Namespace 用来修改应用进程看待整个计算机“视图”，即应用进程的“视线”被操作系统做了限制，只能“看到”某些指定的内容。Linux 操作系统提供了六种 Namespace:
1. PID: 用于让被隔离进程只看到当前 Namespace 里启动的进程
2. Mount: 用于让被隔离进程只看到当前 Namespace 里的挂载点信息
5. Network: 用于让被隔离进程看到当前 Namespace 里的网络设备和配置
3. UTS: 隔离域名
4. IPC: 隔离进程间通信
6. User: 隔离用户

Namespace 是在操作系统发展的后期演化的，他们都是在已有的进程创建扩展而来。所以这些 Namespace 实际上是在创建容器进程时，指定的一组 Namespace 参数: `int pid = clone(main_function, stack_size, CLONE_NEWPID | SIGCHLD, NULL); `。这样，容器就只能“看”到当前 Namespace 所限定的资源、文件、设备、状态，或者配置。所以说，容器，其实是一种特殊的进程而已。对于宿主机来说，这些被“隔离”了的进程跟其他进程并没有太大区别。Namespace 的底层实现原理参见，耗子叔的博客:
1. [DOCKER基础技术：LINUX NAMESPACE（上）](https://coolshell.cn/articles/17010.html)
2. [DOCKER基础技术：LINUX NAMESPACE（下）](https://coolshell.cn/articles/17029.html)

### 1.2 进程 Namespace 查看
一个进程的每种 Linux Namespace，都在它对应的 `/proc/[进程号]/ns` 下有一个对应的虚拟文件，并且链接到一个真实的 Namespace 文件上。
```shell
# 1. 查看容器对应的进程 PID
$ docker inspect --format '{{ .State.Pid }}'  3cfcb77fe21b

# 2. 查看容器进程的所有 Namespace 对应的文件
$ ll /proc/82155/ns
总用量 0
lrwxrwxrwx. 1 root root 0 3月   5 21:05 cgroup -> 'cgroup:[4026531835]'
lrwxrwxrwx. 1 root root 0 3月   5 21:05 ipc -> 'ipc:[4026532619]'
lrwxrwxrwx. 1 root root 0 3月   5 21:05 mnt -> 'mnt:[4026532617]'
lrwxrwxrwx. 1 root root 0 3月   5 20:20 net -> 'net:[4026532622]'
lrwxrwxrwx. 1 root root 0 3月   5 21:05 pid -> 'pid:[4026532620]'
lrwxrwxrwx. 1 root root 0 3月   5 21:05 pid_for_children -> 'pid:[4026532620]'
lrwxrwxrwx. 1 root root 0 3月   5 21:05 time -> 'time:[4026531834]'
lrwxrwxrwx. 1 root root 0 3月   5 21:05 time_for_children -> 'time:[4026531834]'
lrwxrwxrwx. 1 root root 0 3月   5 21:05 user -> 'user:[4026531837]'
lrwxrwxrwx. 1 root root 0 3月   5 21:05 uts -> 'uts:[4026532618]'

```

正是因为 Namespace 对应的是一个个正是的文件，所以一个进程，可以选择加入到某个进程已有的 Namespace 当中，从而达到“进入”这个进程所在容器的目的，这正是 docker exec 的实现原理。而这个操作所依赖的，乃是一个名叫 `setns()` 的 Linux 系统调用。

Docker 专门提供了一个参数，可以在启动一个容器并“加入”到另一个容器的 Network Namespace 里，这个参数就是 -net，比如:

```shell
$ docker run -it --net container:4ddf4638572d busybox ifconfig
```

如果指定–net=host，就意味着这个容器不会为进程启用 Network Namespace，而共享宿主机的物理网络。

### 1.2 Cgroups
Linux Cgroups 是 Linux 内核中用来为进程设置资源限制的一个重要功能。Linux Cgroups 的全称是 Linux Control Group 用来限制一个进程组能够使用的资源上限，包括 CPU、内存、磁盘、网络带宽等等。此外，Cgroups 还能够对进程进行优先级设置、审计，以及将进程挂起和恢复等操作。

#### Cgroups 接口
在 Linux 中，**Cgroups 给用户暴露出来的操作接口是文件系统**，即它以文件和目录的方式组织在操作系统的 /sys/fs/cgroup 路径下。

```shell
# 查看 cgroup 挂载点
$ mount -t cgroup

$ pwd
/sys/fs/cgroup

$ ll
dr-xr-xr-x. 6 root root  0 10月 19 06:26 blkio
lrwxrwxrwx. 1 root root 11 10月 19 06:26 cpu -> cpu,cpuacct
lrwxrwxrwx. 1 root root 11 10月 19 06:26 cpuacct -> cpu,cpuacct
dr-xr-xr-x. 6 root root  0 10月 19 06:26 cpu,cpuacct
dr-xr-xr-x. 2 root root  0 10月 19 06:26 cpuset
dr-xr-xr-x. 6 root root  0 10月 19 06:26 devices
dr-xr-xr-x. 2 root root  0 10月 19 06:26 freezer
dr-xr-xr-x. 2 root root  0 10月 19 06:26 hugetlb
dr-xr-xr-x. 6 root root  0 10月 19 06:26 memory
lrwxrwxrwx. 1 root root 16 10月 19 06:26 net_cls -> net_cls,net_prio
dr-xr-xr-x. 2 root root  0 10月 19 06:26 net_cls,net_prio
lrwxrwxrwx. 1 root root 16 10月 19 06:26 net_prio -> net_cls,net_prio
dr-xr-xr-x. 2 root root  0 10月 19 06:26 perf_event
dr-xr-xr-x. 6 root root  0 10月 19 06:26 pids
dr-xr-xr-x. 2 root root  0 10月 19 06:26 rdma
dr-xr-xr-x. 6 root root  0 10月 19 06:26 systemd
```
/sys/fs/cgroup 目录下的每个子目录代表着一种资源的子系统，比如
1. blkio，为​​​块​​​设​​​备​​​设​​​定​​​I/O 限​​​制，一般用于磁盘等设备；
2. cpuset，为进程分配单独的 CPU 核和对应的内存节点；
3. memory，为进程设定内存使用的限制。

使用方法也很简单:
1. 首先进入到想限制的资源的目录，然后创建一个目录，这个目录就是一个**控制组**
2. cgroup 挂载的虚拟文件系统会在创建目录的同时，在目录内创建一系列资源限制文件
3. 往这些文件里面写入进程的资源使用限额即可
4. 当前目录下有一个 task 文件，将被限制进程 PID 写入 task，就可以指定资源限定的目标

Linux Cgroups 的设计还是比较易用的，简单粗暴地理解呢，它就是一个子系统目录加上一组资源限制文件的组合。而对于 Docker 等 Linux 容器项目来说，它们只需要在每个子系统下面，为每个容器创建一个控制组（即创建一个新目录），然后在启动容器进程之后，把这个进程的 PID 填写到对应控制组的 tasks 文件中就可以了。

而至于在这些控制组下面的资源文件里填上什么值，就靠用户执行 docker run 时的参数指定了，比如这样一条命令：

```
$ docker run -it --cpu-period=100000 --cpu-quota=20000 ubuntu /bin/bash

$ docker ps
CONTAINER ID   IMAGE           COMMAND        CREATED          STATUS          PORTS     NAMES
3cfcb77fe21b   ubuntu:latest   "sleep 3600"   19 seconds ago   Up 18 seconds             strange_leakey

$ ll /sys/fs/cgroup/cpu/docker/3cfcb77fe21b26db68d05aceaa6790ba998ac157a566bdd241b8fc0de13600a4/
总用量 0
-rw-r--r--. 1 root root 0 3月   5 20:21 cgroup.clone_children
-rw-r--r--. 1 root root 0 3月   5 20:20 cgroup.procs
-r--r--r--. 1 root root 0 3月   5 20:21 cpuacct.stat
-rw-r--r--. 1 root root 0 3月   5 20:21 cpuacct.usage
-r--r--r--. 1 root root 0 3月   5 20:21 cpuacct.usage_all
-r--r--r--. 1 root root 0 3月   5 20:21 cpuacct.usage_percpu
-r--r--r--. 1 root root 0 3月   5 20:21 cpuacct.usage_percpu_sys
-r--r--r--. 1 root root 0 3月   5 20:21 cpuacct.usage_percpu_user
-r--r--r--. 1 root root 0 3月   5 20:21 cpuacct.usage_sys
-r--r--r--. 1 root root 0 3月   5 20:21 cpuacct.usage_user
-rw-r--r--. 1 root root 0 3月   5 20:21 cpu.cfs_period_us
-rw-r--r--. 1 root root 0 3月   5 20:21 cpu.cfs_quota_us
-rw-r--r--. 1 root root 0 3月   5 20:21 cpu.rt_period_us
-rw-r--r--. 1 root root 0 3月   5 20:21 cpu.rt_runtime_us
-rw-r--r--. 1 root root 0 3月   5 20:21 cpu.shares
-r--r--r--. 1 root root 0 3月   5 20:21 cpu.stat
-rw-r--r--. 1 root root 0 3月   5 20:21 notify_on_release
-rw-r--r--. 1 root root 0 3月   5 20:21 tasks

$  cat /sys/fs/cgroup/cpu/docker/3cfcb77fe21b26db68d05aceaa6790ba998ac157a566bdd241b8fc0de13600a4/cpu.cfs_period_us
100000
$ cat /sys/fs/cgroup/cpu/docker/3cfcb77fe21b26db68d05aceaa6790ba998ac157a566bdd241b8fc0de13600a4/cpu.cfs_quota_us
20000
```

### 1.3 容器镜像
#### bootfs/rootfs

典型的 Linux 文件系统组成：
1. Bootfs（boot file system） 包括:
  - Bootloader: 引导加载 kernel
  - Kernel: 当 kernel 被加载到内存中后 umount bootfs
2. rootfs （root file system）包括:
  - /dev，/proc，/bin，/etc 等标准目录和文件

对于不同的 linux 发行版, bootfs 基本是一致的，但 rootfs 会有差别。

#### 容器镜像和 Mount Namespace
要理解容器镜像的关键是搞清楚**容器镜像与 Mount Namespace 之间的关系**。

首先 Mount Namespace 修改的，是容器进程对文件系统“挂载点”的认知。但是，这也就意味着，**只有在“挂载”这个操作发生之后，进程的视图才会被改变**。而在此之前，新创建的容器会直接继承宿主机的各个挂载点。这就是 Mount Namespace 跟其他 Namespace 的使用略有不同的地方：它对容器进程视图的改变，一定是伴随着挂载操作（mount）才能生效。

所以处理 Mount Namespace 我们还需要在容器进程启动之前**重新挂载它的整个根目录“/”**，而这个挂载在容器根目录上、用来为容器进程提供隔离后执行环境的文件系统，就是所谓的“容器镜像”。它还有一个更为专业的名字，叫作：**rootfs（根文件系统）**。

在 Linux 操作系统里，有一个名为 chroot 的命令可以帮助你在 shell 中方便地完成重新挂载整个根目录“/”。顾名思义，它的作用就是帮你“change root file system”，即改变进程的根目录到你指定的位置。实际上，Mount Namespace 正是基于对 chroot 的不断改良才被发明出来的，它也是 Linux 操作系统里的第一个 Namespace。

#### 容器镜像带来的改变
对一个应用来说，操作系统本身才是它运行所需要的最完整的“依赖库”。由于 rootfs 里打包的不只是应用，而是整个操作系统的文件和目录，也就意味着，应用以及它运行所需要的所有依赖，都被封装在了一起。这种深入到操作系统级别的运行环境一致性，打通了应用在本地开发和远端执行环境之间难以逾越的鸿沟。

另外，需要明确的是，rootfs 只是一个操作系统所包含的文件、配置和目录，并不包括操作系统内核。在 Linux 操作系统中，这两部分是分开存放的，操作系统只有在开机启动时才会加载指定版本的内核镜像。所以说，rootfs 只包括了操作系统的“躯壳”，并没有包括操作系统的“灵魂”。

### 1.4 容器启动过程
所以对 Docker 项目来说，它最核心的原理实际上就是为待创建的用户进程：
1. 启用 Linux Namespace 配置；
2. 设置指定的 Cgroups 参数；
3. 切换进程的根目录（Change Root）。

不过，Docker 项目在最后一步的切换上会优先使用 pivot_root 系统调用，如果系统不支持，才会使用 chroot。这两个系统调用虽然功能类似，但是也有细微的区别。另外，需要明确的是，rootfs 只是一个操作系统所包含的文件、配置和目录，并不包括操作系统内核。在 Linux 操作系统中，这两部分是分开存放的，操作系统只有在开机启动时才会加载指定版本的内核镜像。所以说，rootfs 只包括了操作系统的“躯壳”，并没有包括操作系统的“灵魂”。

### 1.5 容器的缺陷
容器的缺陷，根本原因在于**隔离不够彻底**。
1. 共享内核
  - 首先，既然容器只是运行在宿主机上的一种特殊的进程，那么多个容器之间使用的就还是同一个宿主机的操作系统内核。
  - 这意味着，如果你要在 Windows 宿主机上运行 Linux 容器，或者在低版本的 Linux 宿主机上运行高版本的 Linux 容器，都是行不通的。
  - 同时这也意味着，如果你的应用程序需要配置内核参数、加载额外的内核模块，以及跟内核进行直接的交互，你就需要注意了：这些操作和依赖的对象，都是宿主机操作系统的内核，它对于该机器上的所有容器来说是一个“全局变量”，牵一发而动全身。
2. Namespace 隔离粒度不够
  - 在 Linux 内核中，有很多资源和对象是不能被 Namespace 化的
  - 最典型的例子就是：时间。这就意味着，如果你的容器中的程序使用 settimeofday(2) 系统调用修改了时间，整个宿主机的时间都会被随之修改，这显然不符合用户的预期。新版本的 Linux 内核应该已经支持 time namespaces 了。
3. 资源统计不准确
  - 跟 Namespace 的情况类似，Cgroups 对资源的限制能力也有很多不完善的地方，被提及最多的自然是 /proc 文件系统的问题。
  - Linux 下的 /proc 目录存储的是记录当前内核运行状态的一系列特殊文件，用户可以通过访问这些文件，查看系统以及当前正在运行的进程的信息。
  - 如果在容器里执行 top 指令，就会发现，它显示的信息居然是宿主机的 CPU 和内存数据，而不是当前容器的数据。造成这个问题的原因就是，/proc 文件系统并不知道用户通过 Cgroups 给这个容器做了什么样的资源限制，即：/proc 文件系统不了解 Cgroups 限制的存在。
  - 在生产环境中，这个问题必须进行修正，否则应用程序在容器里读取到的 CPU 核数、可用内存等信息都是宿主机上的数据，这会给应用的运行带来非常大的困惑和风险。这也是在企业中，容器化应用碰到的一个常见问题，也是容器相较于虚拟机另一个不尽如人意的地方。注: 解决办法参见 lxcfs。
4. 安全限制不够
  - 此外，由于上述问题，尤其是共享宿主机内核的事实，容器给应用暴露出来的攻击面是相当大的，应用“越狱”的难度自然也比虚拟机低得多。
  - 尽管在实践中我们确实可以使用 `Seccomp` 等技术，对容器内部发起的所有系统调用进行过滤和甄别来进行安全加固，但这种方法因为多了一层对系统调用的过滤，必然会拖累容器的性能。默认情况下，谁也不知道到底该开启哪些系统调用，禁止哪些系统调用。
  - 所以，在生产环境中，没有人敢把运行在物理机上的 Linux 容器直接暴露到公网上。当然，我后续会讲到的基于虚拟化或者独立内核技术的容器实现，则可以比较好地在隔离与性能之间做出平衡。

### 1.6 容器的单进程模型
正因为容器的 Namespace 和 Cgroups 是施加在单个进程上的，所以容器技术中一个非常重要的概念，即：容器是一个“单进程”模型。

由于一个容器的本质就是一个进程，用户的应用进程实际上就是容器里 PID=1 的进程，也是其他后续创建的所有进程的父进程。这就意味着，在一个容器中，你没办法同时运行两个不同的应用，除非你能事先找到一个公共的 PID=1 的程序来充当两个不同应用的父进程，这也是为什么很多人都会用 systemd 或者 supervisord 这样的软件来代替应用本身作为容器的启动进程。

在容器的设计模式中，容器本身的设计，是**希望容器和应用能够同生命周期**，这个概念对后续的容器编排非常重要。否则，一旦出现类似于“容器是正常运行的，但是里面的应用早已经挂了”的情况，编排系统处理起来就非常麻烦了。


1. overlay2 文件系统使用
2. docker 架构，containerd

## 2. 联合文件系统
为了提高容器镜像的复用能力，Docker 在容器镜像的制作上采用了一个叫联合文件系统的新实现。联合文件系统（Union File System）的能力。Union File System 也叫 UnionFS，最主要的功能是将多个不同位置的目录联合挂载（union mount）到同一个目录下。联合文件系统有多种实现，后面我们以 Centos 上默认使用的是 overlay2 作为演示的核心:

![联合文件系统的对比](/images/k8s/k8s_use/union_fs.png)

### 2.1 overlay2 
#### overlay2 的基本原理
OverlayFS将单个Linux主机上的两个目录合并成一个目录。这些目录被称为层，统一过程被称为联合挂载 OverlayFS底层目录称为lowerdir， 高层目录称为upperdir,合并统一视图称为merged。

![overlay2 原理](/images/k8s/k8s_use/overlay2.image)

可以看到:
1. 最下层是lower层,也是只读/镜像层
2. upper是容器的读写层,采用了CoW(写时复制)机制,只有对文件进行修改才会将文件拷贝到upper层,之后所有的修改操作都会对upper层的副本进行修改
3. upper并列还有workdir层,它的作用是充当一个中间层的作用,每当对upper层里面的副本进行修改时,会先当到workdir,然后再从workdir移动upper层
4. 最上层是mergedir,是一个统一图层,从mergedir可以看到lower,upper,workdir中所有数据的整合,整个容器展现出来的就是mergedir层.

注：overlay2 原理摘录自 [高级小白 Docker原理剖析--文件系统](https://juejin.cn/post/6844903574137208839)

#### overlay2 使用

```bash 
# 以 overlay2 为例:
[tao@master overlay2]$ mkdir upper lower merged work
[tao@master overlay2]$ echo "from lower" > lower/in_lower.txt
[tao@master overlay2]$ echo "from upper" > upper/in_upper.txt
[tao@master overlay2]$ echo "from lower" > lower/in_both.txt
[tao@master overlay2]$ echo "from upper" > upper/in_both.txt
[tao@master overlay2]$ sudo mount -t overlay overlay -o lowerdir=`pwd`/lower,upperdir=`pwd`/upper,workdir=`pwd`/work `pwd`/merged
[tao@master overlay2]$ cat merged/in_both.txt
from upper
[tao@master overlay2]$ rm merged/in_both.txt 
[tao@master overlay2]$ ll lower/
总用量 8
-rw-rw-r--. 1 tao tao 11 2月  25 20:30 in_both.txt
-rw-rw-r--. 1 tao tao 11 2月  25 20:30 in_lower.txt
[tao@master overlay2]$ ll upper/
总用量 4
c---------. 1 root root 0, 0 2月  25 20:31 in_both.txt
-rw-rw-r--. 1 tao  tao    11 2月  25 20:30 in_upper.txt
[tao@master overlay2]$ cat upper/in_both.txt 
cat: upper/in_both.txt: 权限不够
```

### 2.2 容器的 rootfs 组成
overlay2 关键目录位于 /var/lib/docker/overlay2。我在前面运行了一个 ubuntu 的容器，docker 自动将 ubuntu 的镜像拉取了本地。

这个所谓的“镜像”，实际上就是一个 Ubuntu 操作系统的 rootfs，它的内容是 Ubuntu 操作系统的所有文件和目录。而这个 Ubuntu 的镜像实际上是由多个层组成的。

首先我们看一下上面我们启动的 8cc9715e0e9d rootfs 挂载在哪:

```
docker inspect 3cfcb77fe21b

        "GraphDriver": {
            "Data": {
                "LowerDir": "/var/lib/docker/overlay2/b09b7979ceab286d53ed72fe122c2807cb2145e14b60bdc33ab3de3267a73200-init/diff:/var/lib/docker/overlay2/7c200b7659c9c12d5ab0baeae54d03bbeb7d490c3d97f6a85d18c8ae8d1a2f0e/diff",
                "MergedDir": "/var/lib/docker/overlay2/b09b7979ceab286d53ed72fe122c2807cb2145e14b60bdc33ab3de3267a73200/merged",
                "UpperDir": "/var/lib/docker/overlay2/b09b7979ceab286d53ed72fe122c2807cb2145e14b60bdc33ab3de3267a73200/diff",
                "WorkDir": "/var/lib/docker/overlay2/b09b7979ceab286d53ed72fe122c2807cb2145e14b60bdc33ab3de3267a73200/work"
            },
            "Name": "overlay2"
        },
```

3cfcb77fe21b 容器的 rootfs 由下面三个层组成:
1. /var/lib/docker/overlay2/b09b7979ceab286d53ed72fe122c2807cb2145e14b60bdc33ab3de3267a73200/diff
1. /var/lib/docker/overlay2/b09b7979ceab286d53ed72fe122c2807cb2145e14b60bdc33ab3de3267a73200-init/diff
2. /var/lib/docker/overlay2/7c200b7659c9c12d5ab0baeae54d03bbeb7d490c3d97f6a85d18c8ae8d1a2f0e/diff

并被联合挂载在 /var/lib/docker/overlay2/b09b7979ceab286d53ed72fe122c2807cb2145e14b60bdc33ab3de3267a73200/merged 

而 7c200b7659c9c12d5ab0baeae54d03bbeb7d490c3d97f6a85d18c8ae8d1a2f0e/diff 正是 ubuntu 镜像的容器层:

```
$ docker image inspect  2b4cba85892a|less

"GraphDriver": {
            "Data": {
                "MergedDir": "/var/lib/docker/overlay2/7c200b7659c9c12d5ab0baeae54d03bbeb7d490c3d97f6a85d18c8ae8d1a2f0e/merged",
                "UpperDir": "/var/lib/docker/overlay2/7c200b7659c9c12d5ab0baeae54d03bbeb7d490c3d97f6a85d18c8ae8d1a2f0e/diff",
                "WorkDir": "/var/lib/docker/overlay2/7c200b7659c9c12d5ab0baeae54d03bbeb7d490c3d97f6a85d18c8ae8d1a2f0e/work"
            },
            "Name": "overlay2"
        },

```

通过系统的 mount 信息，可以看到同样的挂载信息:

```
$ cat /proc/mounts |grep overlay
overlay /var/lib/docker/overlay2/b09b7979ceab286d53ed72fe122c2807cb2145e14b60bdc33ab3de3267a73200/merged overlay rw,seclabel,relatime,lowerdir=/var/lib/docker/overlay2/l/72ZL2SJGZXEDYBHENYYYYXVRYS:/var/lib/docker/overlay2/l/GRNLLRA54UDERQYOS6AQFNC5K4,upperdir=/var/lib/docker/overlay2/b09b7979ceab286d53ed72fe122c2807cb2145e14b60bdc33ab3de3267a73200/diff,workdir=/var/lib/docker/overlay2/b09b7979ceab286d53ed72fe122c2807cb2145e14b60bdc33ab3de3267a73200/work 0 0

$ ll /var/lib/docker/overlay2/l
总用量 0
lrwxrwxrwx. 1 root root 72 3月   5 20:20 2QUYA4NJODHDXHYSIDH3TEFKSW -> ../b09b7979ceab286d53ed72fe122c2807cb2145e14b60bdc33ab3de3267a73200/diff
lrwxrwxrwx. 1 root root 77 3月   5 20:20 72ZL2SJGZXEDYBHENYYYYXVRYS -> ../b09b7979ceab286d53ed72fe122c2807cb2145e14b60bdc33ab3de3267a73200-init/diff
lrwxrwxrwx. 1 root root 72 3月   5 15:49 GRNLLRA54UDERQYOS6AQFNC5K4 -> ../7c200b7659c9c12d5ab0baeae54d03bbeb7d490c3d97f6a85d18c8ae8d1a2f0e/diff
```

从这个结构可以看出来，这个容器的 rootfs 由如下图所示的三部分组成：
1. 第一部分，只读层: 
  - 这个容器的 rootfs 最下面的一层，挂载方式都是只读的(ro+wh)
  - 所谓 wh 就是当删除只读层里的一个文件，联合文件系统会在可读写层创建一个 whiteout 文件，把只读层里的文件“遮挡”起来，比如删除只读层的 foo 的文件，那么这个删除操作实际上是在可读写层创建了一个名叫.wh.foo 的文件。这样，当这两个层被联合挂载之后，foo 文件就会被.wh.foo 文件“遮挡”起来，“消失”了。这个功能，就是“ro+wh”的挂载方式，即只读 +whiteout 的含义
2. 第二部分，可读写层: 
  - 这个容器的 rootfs 最上面的一层
  - 在没有写入文件之前，这个目录是空的。而一旦在容器里做了写操作，你修改产生的内容就会以增量的方式出现在这个层中。
  - 结合 copy-on-write 以及 whiteout 可读写层就可以用来存放所有修改 rootfs 后产生的增量，无论是增、删、改，都发生在这里
  - 我们使用 docker commit 和 push 指令，保存的正是这个被修改过的可读写层
3. 第三部分，Init 层:
  - Init 层是 Docker 项目单独生成的一个内部层，专门用来存放 /etc/hosts、/etc/resolv.conf 等信息
  - 这一部分属于私密信息，即便用户修改后也不希望被提交到 docker hub 上去，所以，Docker 做法是，在修改了这些文件之后，以一个单独的层挂载了出来。

![rootfs](/images/k8s/k8s_use/rootfs.webp)

注: 图片摘录自专栏，上面的 overlay2 就是如下三层:

```
b09b7979ceab286d53ed72fe122c2807cb2145e14b60bdc33ab3de3267a73200/diff
b09b7979ceab286d53ed72fe122c2807cb2145e14b60bdc33ab3de3267a73200-init/diff
7c200b7659c9c12d5ab0baeae54d03bbeb7d490c3d97f6a85d18c8ae8d1a2f0e/diff
```
### 2.3 copy-on-write
由于使用了联合文件系统，你在容器里对镜像只读层的 rootfs 所做的任何修改，都会被操作系统先复制到最上层的可读写层，然后再修改。这就是所谓的：Copy-on-Write。

## 3.Dockerfile
相比如手动制作 rootfs,Docker 为你提供了一种更便捷的方式，叫作 Dockerfile。

```dockerfile

# 使用官方提供的Python开发镜像作为基础镜像
FROM python:2.7-slim

# 将工作目录切换为/app
WORKDIR /app

# 将当前目录下的所有内容复制到/app下
ADD . /app

# 使用pip命令安装这个应用所需要的依赖
RUN pip install --trusted-host pypi.python.org -r requirements.txt

# 允许外界访问容器的80端口
EXPOSE 80

# 设置环境变量
ENV NAME World

# 设置容器进程为：python app.py，即：这个Python应用的启动命令
CMD ["python", "app.py"]
```

Dockerfile 描述了我们所要构建的 Docker 镜像，它使用一些标准的原语，docker build 命令会自动加载当前目录下的 Dockerfile 文件，然后按照顺序，执行文件中的原语。而这个过程，实际上可以等同于 Docker 使用基础镜像启动了一个容器，然后在容器中依次执行 Dockerfile 中的原语。

需要注意的是，Dockerfile 中的每个原语执行后，都会生成一个对应的镜像层。即使原语本身并没有明显地修改文件的操作（比如，ENV 原语），它对应的层也会存在。只不过在外界看来，这个层是空的。

## 4. docker exec
一个进程的每种 Linux Namespace，都在它对应的 `/proc/[进程号]/ns` 下有一个对应的虚拟文件，并且链接到一个真实的 Namespace 文件上。有了这些 Linux Namespace 的文件，我们就可以对 Namespace 做一些很有意义事情了，比如：加入到一个已经存在的 Namespace 当中。这也就意味着：一个进程，可以选择加入到某个进程已有的 Namespace 当中，从而达到“进入”这个进程所在容器的目的，这正是 docker exec 的实现原理。而这个操作所依赖的，乃是一个名叫 setns() 的 Linux 系统调用。

## 5. docker volume
### 5.1 volume 介绍
有了容器镜像，我们还有两个问题需要考虑:
1. 容器里进程新建的文件，怎么才能让宿主机获取到？
2. 宿主机上的文件和目录，怎么才能让容器里的进程访问到？

这正是 Docker Volume 要解决的问题：Volume 机制，允许你将宿主机上指定的目录或者文件，挂载到容器里面进行读取和修改操作。

在 Docker 项目里，它支持两种 Volume 声明方式
```shell

$ docker run -v /test ...
$ docker run -v /home:/test ...
```

而这两种声明方式的本质，实际上是相同的：只不过，在第一种情况下，由于你并没有显示声明宿主机目录，那么 Docker 就会默认在宿主机上创建一个临时目录 `/var/lib/docker/volumes/[VOLUME_ID]/_data`，然后把它挂载到容器的 /test 目录上。而在第二种情况下，Docker 就直接把宿主机的 /home 目录挂载到容器的 /test 目录上。

### 5.2 volume 原理
前面已经介绍过，当容器进程被创建之后，尽管开启了 Mount Namespace，但是在它执行 chroot（或者 pivot_root）之前，容器进程一直可以看到宿主机上的整个文件系统。而宿主机上的文件系统，也自然包括了我们要使用的容器镜像。在容器进程启动后这些容器的镜像层就会被联合挂载到 `/var/lib/docker/overlay2/[container_id]/merged` 下，这样容器所需的 rootfs 就准备好了。

我们只需要在 rootfs 准备好之后，**在执行 chroot 之前，把 Volume 指定的宿主机目录（比如 /home 目录），挂载到指定的容器目录（比如 /test 目录）在宿主机上对应的目录**（即 `/var/lib/docker/overlay2/[container_id]/merged/test`）上，这个 Volume 的挂载工作就完成了。

更重要的是，由于执行这个挂载操作时，“容器进程”已经创建了，也就意味着此时 Mount Namespace 已经开启了。所以，这个挂载事件只在这个容器里可见。你在宿主机上，是看不见容器内部的这个挂载点的。这就保证了容器的隔离性不会被 Volume 打破。

注意：这里提到的"容器进程"，是 Docker 创建的一个容器初始化进程 (dockerinit)，而不是应用进程 (ENTRYPOINT + CMD)。dockerinit 会负责完成根目录的准备、挂载设备和目录、配置 hostname 等一系列需要在容器内进行的初始化操作。最后，它通过 execv() 系统调用，让应用进程取代自己，成为容器里的 PID=1 的进程。

而这里要使用到的挂载技术，就是 Linux 的 **绑定挂载（bind mount）** 机制。它的主要作用就是，允许你将一个目录或者文件，而不是整个设备，挂载到一个指定的目录上。并且，这时你在该挂载点上进行的任何操作，只是发生在被挂载的目录或者文件上，而原挂载点的内容则会被隐藏起来且不受影响。

其实，如果你了解 Linux 内核的话，就会明白，绑定挂载实际上是一个 inode 替换的过程。在 Linux 操作系统中，inode 可以理解为存放文件内容的“对象”，而 dentry，也叫目录项，就是访问这个 inode 所使用的“指针”。

![绑定挂载原理](/images/k8s/k8s_use/bind.webp)

正如上图所示，mount --bind /home /test，会将 /home 挂载到 /test 上。其实相当于将 /test 的 dentry，重定向到了 /home 的 inode。这样当我们修改 /test 目录时，实际修改的是 /home 目录的 inode。这也就是为何，一旦执行 umount 命令，/test 目录原先的内容就会恢复：因为修改真正发生在的，是 /home 目录里。

所以，在一个正确的时机，进行一次绑定挂载，Docker 就可以成功地将一个宿主机上的目录或文件，不动声色地挂载到容器中。这样，进程在容器里对这个 /test 目录进行的所有操作，都实际发生在宿主机的对应目录里，而不会影响容器镜像的内容。

这个 /test 目录里的内容，既然挂载在容器 rootfs 的可读写层，它会不会被 docker commit 提交掉呢？也不会。这个原因其实我们前面已经提到过。容器的镜像操作，比如 docker commit，都是发生在宿主机空间的。而由于 Mount Namespace 的隔离作用，宿主机并不知道这个绑定挂载的存在。所以，在宿主机看来，容器中可读写层的 /test 目录，始终是空的。

不过，由于 **Docker 一开始还是要创建 /test 这个目录作为挂载点**，所以执行了 docker commit 之后，你会发现新产生的镜像里，会多出来一个空的 /test 目录。毕竟，新建目录操作，又不是挂载操作，Mount Namespace 对它可起不到“障眼法”的作用。

```shell
$ sudo docker run -it -v /test ubuntu:latest bash
$ docker volume ls
DRIVER    VOLUME NAME
local     a4c01d9046842c0f19addd9012c2f01556af04ea02fdb6a826d0d342ce35808e

$ ll /var/lib/docker/volumes/a4c01d9046842c0f19addd9012c2f01556af04ea02fdb6a826d0d342ce35808e/_data/
总用量 0
```

### 5.3 Docker copyData 功能
执行 docker run -v /home:/test 的时候，如果宿主机 /home 和 容器 /test 同时存在文件，最终以哪个为准，是可以设置的。(怎么设置未查到)

### 5.4 容器的总结
Docker 容器，我们就可以用下面这个“全景图”描述出来：

![容器全景图](/images/k8s/k8s_use/container.webp)

其包含如下几个部分:
1. 这个容器进程“python app.py”，运行在由 Linux Namespace 和 Cgroups 构成的隔离环境里；
2. 它运行所需要的各种文件，比如 python，app.py，以及整个操作系统文件，则由多个联合挂载在一起的 rootfs 层提供。
3. rootfs 层的最下层，是来自 Docker 镜像的只读层
4. 只读层之上，是 Docker 自己添加的 Init 层，用来存放被临时修改过的 /etc/hosts 等文件
5. rootfs 的最上层是一个可读写层，它以 Copy-on-Write 的方式存放任何对只读层的修改，容器声明的 Volume 的挂载点，也出现在这一层

从这个结构中我们不难看出，一个正在运行的 Linux 容器，其实可以被“一分为二”地看待：
1. 一组联合挂载在 /var/lib/docker/aufs/mnt 上的 rootfs，这一部分我们称为“容器镜像”（Container Image），是容器的静态视图；
2. 一个由 Namespace+Cgroups 构成的隔离环境，这一部分我们称为“容器运行时”（Container Runtime），是容器的动态视图。

## 6. Docker 引擎架构
