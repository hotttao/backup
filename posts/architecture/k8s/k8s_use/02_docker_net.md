---
weight: 1
title: "容器网络"
date: 2020-08-25T22:00:00+08:00
lastmod: 2020-08-25T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "PV、PVC、StorageClass"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---

## 1. 容器网络
所谓“网络栈”，就包括了：
1. 网卡（Network Interface）
2. 回环设备（Loopback Device）
3. 路由表（Routing Table）
4. iptables 规则。

对于一个进程来说，这些要素，其实就构成了它发起和响应网络请求的基本环境。在大多数情况下，我们都希望容器进程能使用自己 Network Namespace 里的网络栈，即：拥有属于自己的 IP 地址和端口。这时候，一个显而易见的问题就是：这个被隔离的容器进程，该如何跟其他 Network Namespace 里的容器进程进行交互呢？

### 1.1 网络虚拟设备
在 Linux 中，能够起到虚拟交换机作用的网络设备，是 **网桥（Bridge）**。它是一个工作在数据链路层（Data Link）的设备，主要功能是根据 MAC 地址学习来将数据包转发到网桥的不同端口（Port）上。Docker 项目会默认在宿主机上创建一个名叫 docker0 的网桥，凡是连接在 docker0 网桥上的容器，就可以通过它来进行通信。

可是，我们又该如何把这些容器“连接”到 docker0 网桥上呢？这时候，我们就需要使用一种名叫 **Veth Pair** 的虚拟设备了。Veth Pair 设备的特点是：
1. 它被创建出来后，总是以两张虚拟网卡（Veth Peer）的形式成对出现的
2. 从其中一个“网卡”发出的数据包，可以直接出现在与它对应的另一张“网卡”上，哪怕这两个“网卡”在不同的 Network Namespace 里。

这就使得 Veth Pair 常常被用作连接不同 Network Namespace 的“网线”。

### 1.2 通过 Bridge/Veth Pair 进行通信的过程
#### 同一宿主机上不同容器互通
我们现在主机上创建两个 nginx 容器:

```bash
# 1. 创建两个 nginx 容器
$ sudo docker run -d  --rm  --name nginx1 nginx
$ sudo docker run -d  --rm  --name nginx2 nginx

# 2. 查看两个容器内的网络设备
$ sudo nsenter -t `sudo docker inspect -f '{{ .State.Pid }}' nginx1`  -n ip addr
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
42: eth0@if43: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default 
    link/ether 02:42:ac:11:00:03 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 172.17.0.3/16 brd 172.17.255.255 scope global eth0
       valid_lft forever preferred_lft forever

$ sudo nsenter -t `sudo docker inspect -f '{{ .State.Pid }}' nginx2`  -n ip addr
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
40: eth0@if41: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default 
    link/ether 02:42:ac:11:00:02 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 172.17.0.2/16 brd 172.17.255.255 scope global eth0
       valid_lft forever preferred_lft forever

# 3. 查看 nginx1 的路由表
$ sudo nsenter -t `sudo docker inspect -f '{{ .State.Pid }}' nginx1`  -n route -n
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         172.17.0.1      0.0.0.0         UG    0      0        0 eth0
172.17.0.0      0.0.0.0         255.255.0.0     U     0      0        0 eth0
```

可以看到 nginx1/nginx2 的容器内都有一个 eth0 的网卡，他们正是一个 Veth Pair 设备在容器里的这一端。通过 nginx1 容器的路由表，我们可以看到这个 eth0 网卡是这个容器里的默认路由设备；所有对 172.17.0.0/16 网段的请求，也会被交给 eth0 来处理（第二条 172.17.0.0 路由规则）。

nginx1 etho(`42: eth0@if43`) 对应的 Veth Pair 的另一端，是在宿主机上一个名为 veth0f40485 虚拟网卡，这张网卡被插在 docker0 网桥上。docker0 网桥上的另一个网卡 veth83be3fb 则是 nginx2 etho 的对端设备。 

```bash
# veth pair 对端的网卡设备名称 veth0f40485
$ ip link |grep 43: -A 10
43: veth0f40485@if42: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue master docker0 state UP mode DEFAULT group default 
    link/ether 06:87:2a:fd:33:b9 brd ff:ff:ff:ff:ff:ff link-netnsid 5

$ brctl show |grep veth0f40485 -C 3	
docker0		8000.024216fa6f5c	no		veth0f40485
							            veth83be3fb
```

当你在 nginx-1 容器里访问 nginx-2 容器的 IP 地址时(172.17.0.2):
1. 目的 IP 地址会匹配到 nginx-1 容器里的第二条路由规则，这条路由规则的网关（Gateway）是 0.0.0.0，这就意味着这是一条直连规则，即：凡是匹配到这条规则的 IP 包，应该经过本机的 eth0 网卡，通过二层网络直接发往目的主机。
2. 要通过二层网络到达 nginx-2 容器，就需要有 172.17.0.3 这个 IP 地址对应的 MAC 地址。所以 nginx-1 容器的网络协议栈，就需要通过 eth0 网卡发送一个 ARP 广播，来通过 IP 地址查找对应的 MAC 地址。
3. 这个 eth0 网卡，是一个 Veth Pair，它的一端在这个 nginx-1 容器的 Network Namespace 里，而另一端则位于宿主机上（Host Namespace），并且被“插”在了宿主机的 docker0 网桥上。**一旦一张虚拟网卡被“插”在网桥上，它就会变成该网桥的“从设备” 。从设备会被“剥夺”调用网络协议栈处理数据包的资格，从而“降级”成为网桥上的一个端口**。而这个端口唯一的作用，就是接收流入的数据包，然后把这些数据包的“生杀大权”（比如转发或者丢弃），全部交给对应的网桥。所以，在收到这些 ARP 请求之后，docker0 网桥就会扮演二层交换机的角色，把 ARP 广播转发到其他被“插”在 docker0 上的虚拟网卡上。这样，同样连接在 docker0 上的 nginx-2 容器的网络协议栈就会收到这个 ARP 请求，从而将 172.17.0.2 所对应的 MAC 地址回复给 nginx-1 容器。
4. 有了这个目的 MAC 地址，nginx-1 容器的 eth0 网卡就可以将数据包发出去。而根据 Veth Pair 设备的原理，这个数据包会立刻出现在宿主机上的 veth0f40485 虚拟网卡上。不过，此时这个 veth0f40485 网卡的网络协议栈的资格已经被“剥夺”，所以这个数据包就直接流入到了 docker0 网桥里。
5. docker0 处理转发的过程，则继续扮演二层交换机的角色。此时，docker0 网桥根据数据包的目的 MAC 地址（也就是 nginx-2 容器的 MAC 地址），在它的 CAM 表（即交换机通过 MAC 地址学习维护的端口和 MAC 地址的对应表）里查到对应的端口（Port）为：veth83be3fb，然后把数据包发往这个端口。而这个端口，正是 nginx-2 容器“插”在 docker0 网桥上的另一块虚拟网卡，当然，它也是一个 Veth Pair 设备。这样，数据包就进入到了 nginx-2 容器的 Network Namespace 里。所以，nginx-2 容器看到的情况是，它自己的 eth0 网卡上出现了流入的数据包。这样，nginx-2 的网络协议栈就会对请求进行处理，最后将响应（Pong）返回到 nginx-1。

以上，就是同一个宿主机上的不同容器通过 docker0 网桥进行通信的流程了:

![同一个宿主机上的不同容器通过 docker0 网桥进行通信的流程](/images/k8s/k8s_use/net_local_container.png)

需要注意的是，在实际的数据传递时，上述数据的传递过程在网络协议栈的不同层次，都有 Linux 内核 Netfilter 参与其中。所以，如果感兴趣的话，你可以通过打开 iptables 的 TRACE 功能查看到数据包的传输过程，具体方法如下所示，设置后你就可以在 /var/log/syslog 里看到数据包传输的日志了。

```bash
# 在宿主机上执行
$ iptables -t raw -A OUTPUT -p icmp -j TRACE
$ iptables -t raw -A PREROUTING -p icmp -j TRACE
```
#### 宿主机链接容器
与之类似地，当你在一台宿主机上，访问该宿主机上的容器的 IP 地址时，这个请求的数据包，也是**先根据路由规则到达 docker0 网桥(宿主机上的路由规则)**，然后被转发到对应的 Veth Pair 设备，最后出现在容器里。宿主机上路由规则如下:

```bash
$ route -n
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         192.168.2.1     0.0.0.0         UG    100    0        0 ens33
# 转发到 docker0 网桥的网段
172.17.0.0      0.0.0.0         255.255.0.0     U     0      0        0 docker0
172.18.0.0      0.0.0.0         255.255.0.0     U     0      0        0 br-e9bded9defe4
172.19.0.0      0.0.0.0         255.255.0.0     U     0      0        0 br-25af924c88b8
```
#### 容器链接外部物理机
同样地，当一个容器试图连接到另外一个宿主机时，比如：ping 10.168.0.3，它发出的请求数据包，首先经过 docker0 网桥出现在宿主机上( **容器内的第一条路由规则** )。然后根据 **宿主机的路由表** 里的直连路由规则（10.168.0.0/24 via eth0)），对 10.168.0.3 的访问请求就会交给宿主机的 eth0 处理。

所以说，当你遇到容器连不通“外网”的时候，你都应该先试试 docker0 网桥能不能 ping 通，然后查看一下跟 docker0 和 Veth Pair 设备相关的 iptables 规则是不是有异常，往往就能够找到问题的答案了。

## 2. 容器的“跨主通信”问题
在 Docker 的默认配置下，一台宿主机上的 docker0 网桥，和其他宿主机上的 docker0 网桥，没有任何关联，它们互相之间也没办法连通。所以，连接在这些网桥上的容器，自然也没办法进行通信了。

不过，万变不离其宗。如果我们通过软件的方式，创建一个整个集群“公用”的网桥，然后把集群里的所有容器都连接到这个网桥上，不就可以相互通信了吗？

![Overlay Network（覆盖网络）](/images/k8s/k8s_use/overlay_net.webp)

可以看到，构建这种容器网络的核心在于：我们需要在已有的宿主机网络上，再通过软件构建一个覆盖在已有宿主机网络之上的、可以把所有容器连通在一起的虚拟网络。所以，这种技术就被称为：Overlay Network（覆盖网络）。

而这个 Overlay Network 本身，可以由每台宿主机上的一个“特殊网桥”共同组成。比如，当 Node 1 上的 Container 1 要访问 Node 2 上的 Container 3 的时候，Node 1 上的“特殊网桥”在收到数据包之后，能够通过某种方式，把数据包发送到正确的宿主机，比如 Node 2 上。而 Node 2 上的“特殊网桥”在收到数据包后，也能够通过某种方式，把数据包转发给正确的容器，比如 Container 3。
