---
title: 6.1 案例: NAT 优化
date: 2020-02-14
categories:
    - 运维
tags:
    - Linux性能调优
---

本节我们来学习Linux性能优化的第一案例 NAT 优化。来自[极客时间专栏-Linux性能优化实战-42讲](https://time.geekbang.org/column/article/83520)
<!-- more -->


## 1. NAT 基础
Linux 内核提供的 Netfilter 框架，允许对网络数据包进行修改（比如 NAT）和过滤（比如防火墙）。所以所谓防火墙并不是一个服务，而一个内核功能。而iptables、ip6tables、ebtables 等工具是管理和配置 Netfilter 上规则的工具。Netfilter 同样也是 LVS 四层负载均衡的基础

要掌握 iptables 的原理和使用方法，最核心的就是高清楚 Netfilter 的工作流向，即所谓的**四表五链**。下面是 Netfilter 工作流向的示意图

![Netfilter](/images/linux_pf/iptables.png)


说明:
1. 绿色背景的方框，表示表（table）
2. 跟 table 一起的白色背景方框，则表示链（chain）
3. 灰色的 conntrack ，表示连接跟踪模块。

conntrack 通过内核中的连接跟踪表（也就是哈希表），记录网络连接的状态，是 iptables 状态过滤（-m state）和 NAT 的实现基础。通过 conntrack 命令可以查看系统当前的连接跟踪表。内核的连接跟踪模块在维护每个连接状态的同时，也会带来很高的性能成本。

在使用 iptables 配置 NAT 规则时，Linux 需要转发来自其他 IP 的网络包，所以你千万不要忘记开启 Linux 的 IP 转发功能。

```bash
$ sysctl net.ipv4.ip_forward
net.ipv4.ip_forward = 1
```

## 2. NAT 优化
我们准备两个服务:
1. 一个是通过 host NetWork 直接启动的Nginx 服务，作为测试的基准，即对照组
2. 一个是通过 Docker NAT 启动的Nginx 服务作为实现组

### 2.1 对照组
```bash
# 1. 镜像准备
git clone https://github.com/feiskyer/linux-perf-examples.git
cd linux-perf-examples
cd nat
sudo make build
# 2. 运行对照组的Nginx 服务
docker run --name nginx-hostnet --privileged --network=host -itd feisky/nginx:80
curl 192.168.1.18

# 3. 更改 文件描述符限制，默认只有 1024
# 临时修改
ulimit -n 65536
# 永久修改
vi /etc/security/limits.conf

# 3. 执行 ab 基准测试
# -c表示并发请求数为5000，-n表示总的请求数为10万
# -r表示套接字接收错误时仍然继续执行，-s表示设置每个请求的超时时间为2s
 yum install httpd-tools
ab -c 2000 -n 10000 -r -s 2 http://192.168.1.18/
....
Total transferred:      8450000 bytes
HTML transferred:       6120000 bytes
Requests per second:    5291.69 [#/sec] (mean)
Time per request:       377.951 [ms] (mean)
....

# 4. 停止服务
docker rm -f nginx-hostnet
```

### 2.2 实验组服务
```bash
# 1. 启动实验组服务
$ docker run --name nginx --privileged -p 8080:8080 -itd feisky/nginx:nat
curl http://192.168.1.18:8080/

# 2. 查看 NAT 规则
iptables -nL -t nat
# 3. ab 测试
ab -c 2000 -n 10000 -r -s 2 http://192.168.1.18:8080/
...
Benchmarking 192.168.1.18 (be patient)
apr_pollset_poll: The timeout specified has expired (70007)
```

### 2.3 追踪内核丢包
实验组并发请求数大大降低，根据前面介绍的 NAT 原理，我们有理由相信内核发生了丢包。下面我们使用Systemtap
来跟踪内核的kfree_skb。Systemtap 中 kernel.trace("kfree_skb")表示内核释放了一个网络缓冲区的事件。

创建一个 dropwatch.stp 的脚本文件
```bash
#! /usr/bin/env stap

############################################################
# Dropwatch.stp
# Author: Neil Horman <nhorman@redhat.com>
# An example script to mimic the behavior of the dropwatch utility
# http://fedorahosted.org/dropwatch
############################################################

# Array to hold the list of drop points we find
global locations

# Note when we turn the monitor on and off
probe begin { printf("Monitoring for dropped packets\n") }
probe end { printf("Stopping dropped packet monitor\n") }

# increment a drop counter for every location we drop at
probe kernel.trace("kfree_skb") { locations[$location] <<< 1 }

# Every 5 seconds report our drop locations
probe timer.sec(5)
{
  printf("\n")
  foreach (l in locations-) {
    printf("%d packets dropped at %s\n",
           @count(locations[l]), symname(l))
  }
  delete locations
}
```

执行 kfree_skb 动态追踪

```bash
# 1. 执行 stap 动态追踪脚本
$ stap --all-modules dropwatch.stp

# 2. 执行 ab 测试，过一会就能看到上面 stap 脚本的输出
$ ab -c 5000 -n 10000 -r -s 30 http://192.168.1.18:8080/

# 3. dropwatch.stp 的输出
6120 packets dropped at nf_hook_slow
436 packets dropped at tcp_rcv_state_process
374 packets dropped at tcp_v4_rcv
10 packets dropped at netlink_broadcast_filtered
3 packets dropped at unix_stream_connect
```

大量丢包都发生在 nf_hook_slow 位置，我们还得再跟踪  nf_hook_slow 的执行过程。可以使用 stap，更简单的是通过 perf 来完成。

### 2.4 跟踪 nf_hook_slow 执行过程
```bash
$ ab -c 5000 -n 10000 -r -s 30 http://192.168.0.30:8080/

# 使用 perf 记录函数调用堆栈
$ perf record -a -g -- sleep 30

# 进入 perf 交互界面，输入查找命令 / 然后，在弹出的对话框中，输入 nf_hook_slow
$ perf report -g graph,0

# 实际: 实际情况是进入 nf_hook_slow 后看到的都是十六进制符号，而不是函数名，说明符号链接出现了问题。
```

进入 nf_hook_slow 调用栈，我们可以看到下面的调用栈:

![Netfilter](/images/linux_pf/nf_hook_track.png)

可以看到，nf_hook_slow 调用最多的有三个地方:
1. ipv4_conntrack_in: 接收网络包时，在连接跟踪表中查找连接，并为新的连接分配跟踪对象（Bucket）
2. br_nf_pre_routing: 在 Linux 网桥中转发包。这是因为案例 Nginx 是一个 Docker 容器，而容器的网络通过网桥来实现；
3. iptable_nat_ipv4_in: 接收网络包时，执行 DNAT，即把 8080 端口收到的包转发给容器

这三个来源，都是 Linux 的内核机制，所以接下来的优化，自然也是要从内核入手。

### 2.5 conntrack 内核参数
使用 sysctl 可以查看内核选项的各种参数，我们可以先看看，内核提供了哪些 conntrack 的配置选项。
```bash
$ sysctl -a | grep conntrack
net.netfilter.nf_conntrack_count = 180
net.netfilter.nf_conntrack_max = 1000
net.netfilter.nf_conntrack_buckets = 65536
net.netfilter.nf_conntrack_tcp_timeout_syn_recv = 60
net.netfilter.nf_conntrack_tcp_timeout_syn_sent = 120
net.netfilter.nf_conntrack_tcp_timeout_time_wait = 120
...
```
最重要的有三个:
1. net.netfilter.nf_conntrack_count，表示当前连接跟踪数；
2. net.netfilter.nf_conntrack_max，表示最大连接跟踪数；
3. net.netfilter.nf_conntrack_buckets，表示连接跟踪表的大小。

并发请求数是 5000，而请求数是 100000。显然，跟踪表设置成，只记录 1000 个连接，是远远不够的。

实际上，内核在工作异常时，会把异常信息记录到日志中。比如前面的 ab 测试，内核已经在日志中报出了 “nf_conntrack: table full” 的错误。执行 dmesg 命令，你就可以看到：

```bash

$ dmesg | tail
[104235.156774] nf_conntrack: nf_conntrack: table full, dropping packet
[104243.800401] net_ratelimit: 3939 callbacks suppressed
[104243.800401] nf_conntrack: nf_conntrack: table full, dropping packet
[104262.962157] nf_conntrack: nf_conntrack: table full, dropping packet
```
其中，net_ratelimit 表示有大量的日志被压缩掉了，这是内核预防日志攻击的一种措施。而当你看到 “nf_conntrack: table full” 的错误时，就表明 nf_conntrack_max 太小了。

接下来，我们将 nf_conntrack_max 改大一些，比如改成 131072（即 nf_conntrack_buckets 的 2 倍）：

```bash
$ sysctl -w net.netfilter.nf_conntrack_max=131072
$ sysctl -w net.netfilter.nf_conntrack_buckets=65536
```

然后再切换到终端二中，重新执行 ab 命令。

### 2.6 查看链接追踪表
conntrack 命令行工具，来查看连接跟踪表的内容
```bash

# -L表示列表，-o表示以扩展格式显示
$ conntrack -L -o extend|head
ipv4     2 tcp      6 27 TIME_WAIT src=192.168.1.18 dst=192.168.1.18 sport=60162 dport=8080 src=172.17.0.2 dst=192.168.1.18 sport=8080 dport=60162 [ASSURED] mark=0 secctx=system_u:object_r:unlabeled_t:s0 use=1
ipv4     2 tcp      6 27 TIME_WAIT src=192.168.1.18 dst=192.168.1.18 sport=60398 dport=8080 src=172.17.0.2 dst=192.168.1.18 sport=8080 dport=60398 [ASSURED] mark=0 secctx=system_u:object_r:unlabeled_t:s0 use=1

# 统计总的连接跟踪数
$ conntrack -L -o extended | wc -l

# 统计TCP协议各个状态的连接跟踪数
$ conntrack -L -o extended | awk '/^.*tcp.*$/ {sum[$6]++} END {for(i in sum) print i, sum[i]}'
conntrack v1.4.4 (conntrack-tools): 13852 flow entries have been shown.
CLOSE 2075
ESTABLISHED 4
SYN_SENT 3579
TIME_WAIT 8192

# 统计各个源IP的连接跟踪数
$ conntrack -L -o extended | awk '{print $7}' | cut -d "=" -f 2 | sort | uniq -c | sort -nr | head -n 10
```

可以看到，大部分 TCP 的连接跟踪，都处于 TIME_WAIT 状态，这些处于 TIME_WAIT 的连接跟踪记录，会在超时后清理，而默认的超时时间是 120s，你可以执行下面的命令来查看：

```bash
$ sysctl net.netfilter.nf_conntrack_tcp_timeout_time_wait
net.netfilter.nf_conntrack_tcp_timeout_time_wait = 120
```

所以，如果你的连接数非常大，确实也应该考虑，适当减小超时时间。更多 conntrack 选项参见[nf_conntrack文档](https://www.kernel.org/doc/Documentation/networking/nf_conntrack-sysctl.txt)

### 2.7 总结
Linux 这种通过连接跟踪机制实现的 NAT，也常被称为有状态的 NAT，而维护状态，也带来了很高的性能成本。所以，除了调整内核行为外，在不需要状态跟踪的场景下（比如只需要按预定的 IP 和端口进行映射，而不需要动态映射），我们也可以使用无状态的 NAT （比如用 tc 或基于 DPDK 开发），来进一步提升性能。