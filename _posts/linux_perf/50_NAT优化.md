---
title: 6.1 案例-NAT 优化和丢包分析
date: 2020-02-22
categories:
    - 运维
tags:
    - Linux性能调优
---

本节我们来学习Linux性能优化的第一个案例 NAT 优化。来自[极客时间专栏-Linux性能优化实战-42讲](https://time.geekbang.org/column/article/83520)
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

## 3. 网络丢包分析
前面我们分析了由于连接跟踪导致的网络丢包，但这只是网络丢包众多原因中的一个。如下图所示，可能发生丢包的位置，实际上贯穿了整个网络协议栈

![package_lose](/images/linux_pf/package_lose.png)

从下往上:
1. 在两台 VM 连接之间，可能会发生**传输失败**的错误，比如网络拥塞、线路错误等；
2. 在网卡收包后，**环形缓冲区**可能会因为溢出而丢包；
3. 在链路层，可能会因为网络帧校验失败、**QoS** 等而丢包；
4. 在 IP 层，可能会因为路由失败、组包大小**超过 MTU** 等而丢包；
5. 在传输层，可能会因为端口未监听、**资源**占用超过内核限制等而丢包；
6. 在套接字层，可能会因为**套接字缓冲区溢出**而丢包；
7. 应用层，可能会因为应用程序异常而丢包；
8. 此外，如果配置了 **iptables** 规则，这些网络包也可能因为 iptables 过滤规则而丢包。

### 3.1 实践案例
本次我们使用一个存在丢包的 Nginx 服务作为案例。

```bash
# 1. 镜像构建
git clone https://github.com/feiskyer/linux-perf-examples.git
cd linux-perf-examples
cd packet-drop
sudo make build
make run

# 2. 问题发现，验证 nginx 服务是否可以访问
# -c表示发送10个请求，-S表示使用TCP SYN，-p指定端口为80
$ hping3 -c 10 -S -p 80 192.168.0.30
HPING 192.168.0.30 (eth0 192.168.0.30): S set, 40 headers + 0 data bytes
len=44 ip=192.168.0.30 ttl=63 DF id=0 sport=80 flags=SA seq=3 win=5120 rtt=7.5 ms
len=44 ip=192.168.0.30 ttl=63 DF id=0 sport=80 flags=SA seq=4 win=5120 rtt=7.4 ms
len=44 ip=192.168.0.30 ttl=63 DF id=0 sport=80 flags=SA seq=5 win=5120 rtt=3.3 ms
len=44 ip=192.168.0.30 ttl=63 DF id=0 sport=80 flags=SA seq=7 win=5120 rtt=3.0 ms
# 3s 的 RTT ，很可能是因为丢包后重传导致的
len=44 ip=192.168.0.30 ttl=63 DF id=0 sport=80 flags=SA seq=6 win=5120 rtt=3027.2 ms

--- 192.168.0.30 hping statistic ---
10 packets transmitted, 5 packets received, 50% packet loss # 50% 丢包
round-trip min/avg/max = 3.0/609.7/3027.2 ms
```

接下来我们就按照上面的排查思路，看看到底是哪里发生了丢包？


### 3.2 链路层
#### 网卡丢包
首先，来看最底下的链路层。当缓冲区溢出等原因导致网卡丢包时，Linux 会在网卡收发数据的统计信息中，记录下收发错误的次数。通过 ethtool 或者 netstat ，来查看网卡的丢包记录。

```bash
root@nginx:/# netstat -i
Kernel Interface table
Iface      MTU    RX-OK RX-ERR RX-DRP RX-OVR    TX-OK TX-ERR TX-DRP TX-OVR Flg
eth0       100       31      0      0 0             8      0      0      0 BMRU
lo       65536        0      0      0 0             0      0      0      0 LRU
```

RX-OK、RX-ERR、RX-DRP、RX-OVR ，分别表示接收时的总包数、总错误数、进入 Ring Buffer 后因其他原因（如内存不足）导致的丢包数以及 Ring Buffer 溢出导致的丢包数。 `netstat -i` 的输出表明容器的虚拟网卡没有丢包。 

注意，由于 Docker 容器的虚拟网卡，实际上是一对 veth pair，一端接入容器中用作 eth0，另一端在主机中接入 docker0 网桥中。veth 驱动并没有实现网络统计的功能，所以使用 ethtool -S 命令，无法得到网卡收发数据的汇总信息。

#### Qos
接下来，我们还要检查一下 eth0 上是否配置了 tc 规则，并查看有没有丢包。

```bash
root@nginx:/# tc -s qdisc show dev eth0
qdisc netem 800d: root refcnt 2 limit 1000 loss 30%
 Sent 432 bytes 8 pkt (dropped 4, overlimits 0 requeues 0)
 backlog 0b 0p requeues 0
```

tc 输出显示， eth0 上面配置了一个网络模拟排队规则（qdisc netem），并且配置了丢包率为 30%（loss 30%）。netem 模块导致了 Nginx 丢包，我们直接删掉 netem 模块就可以

```bash
root@nginx:/# tc qdisc del dev eth0 root netem loss 30%


$ hping3 -c 10 -S -p 80 192.168.0.30
HPING 192.168.0.30 (eth0 192.168.0.30): S set, 40 headers + 0 data bytes
len=44 ip=192.168.0.30 ttl=63 DF id=0 sport=80 flags=SA seq=0 win=5120 rtt=7.9 ms
len=44 ip=192.168.0.30 ttl=63 DF id=0 sport=80 flags=SA seq=2 win=5120 rtt=1003.8 ms
len=44 ip=192.168.0.30 ttl=63 DF id=0 sport=80 flags=SA seq=5 win=5120 rtt=7.6 ms
len=44 ip=192.168.0.30 ttl=63 DF id=0 sport=80 flags=SA seq=6 win=5120 rtt=7.4 ms
len=44 ip=192.168.0.30 ttl=63 DF id=0 sport=80 flags=SA seq=9 win=5120 rtt=3.0 ms

--- 192.168.0.30 hping statistic ---
10 packets transmitted, 5 packets received, 50% packet loss
round-trip min/avg/max = 3.0/205.9/1003.8 ms
```

但是 hping3 显示丢包问题仍然存在。既然链路层已经排查完了，我们就继续向上层分析，看看网络层和传输层有没有问题。

### 3.3 网络层和传输层
`netstat -s`，可以查看各网络协议的收发汇总，以及错误信息:

```bash

root@nginx:/# netstat -s
Ip:
    Forwarding: 1               //开启转发
    31 total packets received    //总收包数
    0 forwarded                  //转发包数
    0 incoming packets discarded  //接收丢包数
    25 incoming packets delivered  //接收的数据包数
    15 requests sent out         //发出的数据包数
Icmp:
    0 ICMP messages received    //收到的ICMP包数
    0 input ICMP message failed    //收到ICMP失败数
    ICMP input histogram:
    0 ICMP messages sent      //ICMP发送数
    0 ICMP messages failed      //ICMP失败数
    ICMP output histogram:
Tcp:
    0 active connection openings  //主动连接数
    0 passive connection openings  //被动连接数
    11 failed connection attempts  //失败连接尝试数  +
    0 connection resets received  //接收的连接重置数
    0 connections established    //建立连接数
    25 segments received      //已接收报文数
    21 segments sent out      //已发送报文数
    4 segments retransmitted    //重传报文数
    0 bad segments received      //错误报文数
    0 resets sent          //发出的连接重置数
Udp:
    0 packets received
    ...
TcpExt:
    11 resets received for embryonic SYN_RECV sockets  //半连接重置数 +
    0 packet headers predicted
    TCPTimeouts: 7    //超时数     +
    TCPSynRetrans: 4  //SYN重传数  +
  ...
```

TCP 协议有多次超时和失败重试，并且主要错误是半连接重置。换句话说，主要的失败，都是三次握手失败。netstat -s 告诉了我们出错的位置，但是没有告诉我们具体的出错原因，我们还要继续向下进行分析。

### 3.4 iptables
除了网络层和传输层的各种协议，iptables 和内核的连接跟踪机制也可能会导致丢包。

#### 连接追踪
要确认是不是连接跟踪导致的问题，其实只需要对比当前的连接跟踪数和最大连接跟踪数即可。

```bash
# 容器终端中执行exit，连接追踪是操作系统级的，需要在宿主机上查看
root@nginx:/# exit
exit

# 主机终端中查询内核配置
$ sysctl net.netfilter.nf_conntrack_max
net.netfilter.nf_conntrack_max = 262144

$ sysctl net.netfilter.nf_conntrack_count
net.netfilter.nf_conntrack_count = 182
```

262144 > 182 没有问题

#### iptables
对于丢包问题来说，最大的可能就是被 filter 表中的规则给丢弃了。要弄清楚这一点，就需要我们确认，那些目标为 DROP 和 REJECT 等会弃包的规则，有没有被执行到。`iptables -nvL` 命令，查看各条规则的统计信息。

```bash
# 在主机中执行
$ docker exec -it nginx bash

# 在容器中执行
root@nginx:/# iptables -t filter -nvL
Chain INPUT (policy ACCEPT 25 packets, 1000 bytes)
 pkts bytes target     prot opt in     out     source               destination
    6   240 DROP       all  --  *      *       0.0.0.0/0            0.0.0.0/0            statistic mode random probability 0.29999999981

Chain FORWARD (policy ACCEPT 0 packets, 0 bytes)
 pkts bytes target     prot opt in     out     source               destination

Chain OUTPUT (policy ACCEPT 15 packets, 660 bytes)
 pkts bytes target     prot opt in     out     source               destination
    6   264 DROP       all  --  *      *       0.0.0.0/0            0.0.0.0/0            statistic mode random probability 0.29999999981
```

statistic 模块，执行了 30% 的随机丢包。并且 pkts 显示的确有包被丢弃了。显然把这两条规则直接删除即可:

```bash
root@nginx:/# iptables -t filter -D INPUT -m statistic --mode random --probability 0.30 -j DROP
root@nginx:/# iptables -t filter -D OUTPUT -m statistic --mode random --probability 0.30 -j DROP


$ hping3 -c 10 -S -p 80 192.168.0.30
HPING 192.168.0.30 (eth0 192.168.0.30): S set, 40 headers + 0 data bytes
len=44 ip=192.168.0.30 ttl=63 DF id=0 sport=80 flags=SA seq=0 win=5120 rtt=11.9 ms
len=44 ip=192.168.0.30 ttl=63 DF id=0 sport=80 flags=SA seq=1 win=5120 rtt=7.8 ms
...
len=44 ip=192.168.0.30 ttl=63 DF id=0 sport=80 flags=SA seq=9 win=5120 rtt=15.0 ms

--- 192.168.0.30 hping statistic ---
10 packets transmitted, 10 packets received, 0% packet loss
round-trip min/avg/max = 3.3/7.9/15.0 ms
```

hping3 显示已经没有丢包了。不过，到目前为止，我们只能验证案例 Nginx 的 80 端口处于正常监听状态，却还没有访问 Nginx 的 HTTP 服务。

```bash
$ curl --max-time 3 http://192.168.0.30
curl: (28) Operation timed out after 3000 milliseconds with 0 bytes received
```

http 连接超时了，说明我们的服务还有问题。

### 3.5 应用层抓包
对于应用层，抓包工具就是我们的大杀器了。

```bash
# 1. 抓包
root@nginx:/# tcpdump -i eth0 -nn port 80
tcpdump: verbose output suppressed, use -v or -vv for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), capture size 262144 bytes

# 2.发送请求
$ curl --max-time 3 http://192.168.0.30/
curl: (28) Operation timed out after 3000 milliseconds with 0 bytes received

# 3. 抓包输出
# seq
14:40:00.589235 IP 10.255.255.5.39058 > 172.17.0.2.80: Flags [S], seq 332257715, win 29200, options [mss 1418,sackOK,TS val 486800541 ecr 0,nop,wscale 7], length 0
# ack
14:40:00.589277 IP 172.17.0.2.80 > 10.255.255.5.39058: Flags [S.], seq 1630206251, ack 332257716, win 4880, options [mss 256,sackOK,TS val 2509376001 ecr 486800541,nop,wscale 7], length 0
# seq，ack 三次握手完成
14:40:00.589894 IP 10.255.255.5.39058 > 172.17.0.2.80: Flags [.], ack 1, win 229, options [nop,nop,TS val 486800541 ecr 2509376001], length 0
# 时间超过 3 秒，客户端发起来断开连接请求 FIN
14:40:03.589352 IP 10.255.255.5.39058 > 172.17.0.2.80: Flags [F.], seq 76, ack 1, win 229, options [nop,nop,TS val 486803541 ecr 2509376001], length 0
# 服务器端重复ACK
14:40:03.589417 IP 172.17.0.2.80 > 10.255.255.5.39058: Flags [.], ack 1, win 40, options [nop,nop,TS val 2509379001 ecr 486800541,nop,nop,sack 1 {76:77}], length 0
```

使用 Wireshark 显示TCP交互流程图:
![package_lose_wireshark](/images/linux_pf/package_lose_wireshark.png)

服务器端回应了两次相同的ACK，说明中间出现了丢包。并且也没有看到 curl 发送的 GET 请求。那么，究竟是网卡丢包了，还是客户端压根儿就没发过来呢？

netstat -i 命令，确认一下网卡有没有丢包问题：
```bash
root@nginx:/# netstat -i
Kernel Interface table
Iface      MTU    RX-OK RX-ERR RX-DRP RX-OVR    TX-OK TX-ERR TX-DRP TX-OVR Flg
eth0       100      157      0    344 0            94      0      0      0 BMRU
lo       65536        0      0      0 0             0      0      0      0 LRU
```

接收丢包数（RX-DRP）是 344。不过问题也来了，为什么刚才用 hping3 时不丢包，现在换成 GET 就收不到了呢？

其实，仔细观察上面 netstat 的输出界面，第二列正是每个网卡的 MTU 值。eth0 的 MTU 只有 100，而以太网的 MTU 默认值是 1500。HTTP GET ，本质上也是一个 TCP 包，但跟 SYN 包相比，它还携带了 HTTP GET 的数据。因此其大小超过 MTU 所以被丢包了。

```bash
root@nginx:/# ifconfig eth0 mtu 1500
```

修改完成后，再次执行 curl 命令，问题得到了解决。