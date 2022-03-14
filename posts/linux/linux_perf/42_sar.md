---
weight: 1
title: 5.2 Sar
date: '2020-02-12T22:10:00+08:00'
lastmod: '2020-02-12T22:10:00+08:00'
draft: false
author: 宋涛
authorLink: https://hotttao.github.io/
description: 5.2 Sar
featuredImage: null
tags:
- Linux 性能调优
categories:
- Linux
lightgallery: true
---
sar 命令
<!-- more -->

![linux_observability_sar](/images/linux_pf/linux_observability_sar.png)

## 1. sar 
sar [options] [-A] [-o file] t [n]
- 作用：查看系统各种使用信息
- 控制参数：
  - -o file：将命令结果以二进制格式存放在文件中
  - t：采样间隔
    - =0 :表示统计系统启动以来的平均值
    - t被设置，n未被设置，会按照时间间隔循环输出
  - n：采样次数，可选，默认值是1
- 内容参数：
  - -A：等于 `-bBdFHqSvwWy -I SUM -m ALL -n ALL -r ALL -u ALL -I ALL -P ALL` 显示所以内容
  - CPU统计信息:
    - -u：CPU利用率 
    - -q: 查看系统平均负载
    - -w: 统计任务创建和上下文切换
  - 内存统计信息:  
    - -B：换页的统计信息
    - -H: 大页面统计信息
    - -r：内存使用率
    - -R: 内存分配和释放速率统计信息
    - -S: 交换空间统计信息
    - -W：swap分区交换速率统计信息
  - 磁盘统计信息
    - -b：磁盘 IO 传送速率
    - -d：块使用信息
    - -I：中断统计信息
  - 网络统计信息:    
    - -n: 统计网络使用情况
 

## 2. CPU 统计信息
### 2.1 sar -u
sar -u -P { cpu_list | ALL }
- 作用：CPU利用率
- -P { cpu_list | ALL }：选定要展示的 cpu，ALL 展示所有 CPU 及其合计

```bash
sar -u 1 1
Linux 3.10.0-862.el7.x86_64 (ZS-ISP) 	03/09/2020 	_x86_64_	(40 CPU)

06:32:44 PM     CPU     %user     %nice   %system   %iowait    %steal     %idle
06:32:45 PM     all     41.02      0.00      3.61      6.22      0.00     49.15
Average:        all     41.02      0.00      3.61      6.22      0.00     49.15
```

指标含义：
- CPU：
- %user：us，代表用户态 CPU 时间，包括应用运用虚拟化的时间
- %usr：表用户态 CPU 时间，不包括应用运用虚拟化的时间
- %nice：代表低优先级用户态 CPU 时间，也就是进程的 nice 值被调整为 1-19 之间时的 CPU 时间
- %system：代表内核态 CPU 时间，包括运行软终端，硬中断的时间
- %sys：代表内核态 CPU 时间，不包括运行软终端，硬中断的时间
- %iowait：wa，代表等待 I/O 的 CPU 时间    
- %steal：st，代表当系统运行在虚拟机中的时候，被其他虚拟机占用的 CPU 时间    
- %idle：id，代表空闲时间。注意，它不包括等待 I/O 的时间（iowait）
- %irq：hi，代表处理硬中断的 CPU 时间
- %softirq：si，代表处理软中断的 CPU 时间
- %guest：代表通过虚拟化运行其他操作系统的时间，也就是运行虚拟机的 CPU 时间
- %guest_nice：gnice，代表以低优先级运行虚拟机的时间

### 2.2 sar -q
sar -q
- 作用: 查看平均负载
```bash
sar -q 1 2
Linux 3.10.0-1062.el7.x86_64 (localhost.localdomain)    2020年04月01日  _x86_64_        (1 CPU)

00时34分09秒   runq-sz  plist-sz   ldavg-1   ldavg-5  ldavg-15   blocked
00时34分10秒         1       164      0.00      0.01      0.05         0
00时34分11秒         1       164      0.00      0.01      0.05         0
平均时间:         1       164      0.00      0.01      0.05         0

```

指标含义:
- runq-sz: 可运行线程数，所有等待加上正在运行的线程数，不包括处于不可中断睡眠状态的线程 
- plist-sz: 任务队列中的任务总数
- ldavg-1 最后1分钟的CPU平均负载
- ldavg-5 最后5分钟的CPU平均负载
- ldavg-15 最后15分钟的CPU平均负载

### 2.3 sar -w
```bash
sar -w 1
Linux 3.10.0-957.el7.x86_64 (lv)        2020年06月03日  _x86_64_        (2 CPU)

11时31分13秒    proc/s   cswch/s
11时31分14秒      0.00    136.00
11时31分15秒      0.00    157.00
11时31分16秒      0.00    142.57
```
指标含义:
1. proc/s: 每秒创建的任务数(进程数)
2. cswch/s: 每秒发生的上下文切换次数


## 3. 内存统计信息
### 3.1 sar -B
作用: 换页统计信息
```bash
sar -B 2 1
Linux 3.10.0-957.el7.x86_64 (lv) 	03/09/20 	_x86_64_	(2 CPU)

16:13:02     pgpgin/s pgpgout/s   fault/s  majflt/s  pgfree/s pgscank/s pgscand/s pgsteal/s    %vmeff
16:13:04         0.00      0.00     30.50      0.00     14.50      0.00      0.00      0.00      0.00
Average:         0.00      0.00     30.50      0.00     14.50      0.00      0.00      0.00      0.00
```

指标含义：
- pgpgin/s：操作系统每秒从磁盘换入的分页大小，单位 KB
- pgpgout/s：操作系统每秒从磁盘换出的分页大小，单位 KB
- fault/s：每秒的缺页异常，包括主次缺页异常(major + minor)
- majflt/s：每秒主缺页异常数(major 大小)
- pgfree/s：每秒放回空闲链表(free list)的页的数量
- pgscank/s：kswapd 后台进程每秒扫描的分页数
- pgscand/s：每秒直接扫描的分页数
- pgsteal/s：为了满足其他内存需求，每秒从 cache 缓存中回收的分页数 -- 包括页面及交换高速缓存
- %vmeff：=(pgsteal / pgscan), 用于衡量分页的回收效率
  - 高数值意味着成功从非活动列表回收了页(健康)
  - 接近 100%：高数值，健康
  - 接近 30%：标识虚拟内存很紧张，因为没有页可以被回收
  - =0：标识时间间隔内没有分页被扫描

内存分页机制:
- http://linuxperf.com/?p=97
- https://www.jianshu.com/p/ea7ed85918ac

### 3.2 sar -H
作用: 大页面统计信息
```bash
> sar -H 1 4

22时14分00秒 kbhugfree kbhugused  %hugused
22时14分01秒         0         0      0.00
22时14分02秒         0         0      0.00
22时14分03秒         0         0      0.00
22时14分04秒         0         0      0.00
```
指标含义:
- kbhugfree: 空闲大页面的大小
- kbhugused: 已经使用的大页面
- %hugused: 大页面使用百分比

### 3.3 sar -r
作用: 内存使用率，包括页缓存和可回收的slab 缓存

```bash
sar -r 1 1
Linux 3.10.0-862.el7.x86_64 (ZS-ISP) 	03/09/2020 	_x86_64_	(40 CPU)

07:14:04 PM kbmemfree kbmemused  %memused kbbuffers  kbcached  kbcommit   %commit  kbactive   kbinact   kbdirty
07:14:05 PM    721588 114505136     99.37         0  19673952 153573644    133.28  65880260  11269348    783372
Average:       721588 114505136     99.37         0  19673952 153573644    133.28  65880260  11269348    783372
```

指标含义：
- kbmemfree:这个值和free命令中的free值基本一致,所以它不包括buffer和cache的空间.
- kbmemused:这个值和free命令中的used值基本一致,所以它包括buffer和cache的空间.
- %memused:这个值是kbmemused和内存总量(不包括swap)的一个百分比.
- kbbuffers和kbcached:这两个值就是free命令中的buffer和cache.
- kbcommit:保证当前系统所需要的内存,即为了确保不溢出而需要的内存(RAM+swap)，估计值.
- %commit:这个值是kbcommit与内存总量(包括swap)的一个百分比.
- kbactive: 活跃内存，也就是最近使用过的内存，一般不会被系统回收
- kbinact: 表示非活跃内存，也就是不常访问的内存，有可能会被系统回收
- kbdirty：需要写入磁盘的脏页大小
- kbanonpg：用户控件的 non-file 内存大小
- kbslab：slab 内存大小
- kbkstack：内核栈空间大小

### 3.4 sar -R
作用: 内存分配和释放速率
```bash
sar -R 1 2

22时27分44秒   frmpg/s   bufpg/s   campg/s
22时27分45秒      0.00      0.00      0.00
22时27分46秒      0.00      0.00      0.00
```
指标含义:
- frmpg/s: 每秒释放的分页数，负数表示分配
- bufpg/s: 每秒增加的用于 buffer 的分页数
- campg/s: 每秒增加的用于 cache 的分页数

### 3.4 sar -S
作用: 交换空间统计信息
```bash
> sar -S 1 2

22时31分57秒 kbswpfree kbswpused  %swpused  kbswpcad   %swpcad
22时31分58秒   2097148         0      0.00         0      0.00
22时31分59秒   2097148         0      0.00         0      0.00
```
指标含义:
- kbswpfree: 释放的 swap 空间大小
- kbswpused: 占用的 swap 空间大小
- %swpused: swap 空间占用百分比
- kbswpcad: 高速缓存 cache 的交换空间大小，同时保存在主存和交换设备中，因此不需要磁盘IO就能被页面换出
- %swpcad: kbswpcad占用百分比

### 3.5 sar -W
作用: swap 交换速率
```bash
sar -W 1 2

22时35分27秒  pswpin/s pswpout/s
22时35分28秒      0.00      0.00
22时35分29秒      0.00      0.00
```
指标含义:
- pswpin/s: swap换入速率，页面/s
- pswpout/s: swap 换出速率，页面/s

## 4. 磁盘信息统计
### 4.1 sar -b
作用：磁盘 IO 传送速率
```bash
sar -b 1 1
Linux 3.10.0-957.el7.x86_64 (lv) 	03/09/20 	_x86_64_	(2 CPU)

16:53:21          tps      rtps      wtps   bread/s   bwrtn/s
16:53:22         0.00      0.00      0.00      0.00      0.00
Average:         0.00      0.00      0.00      0.00      0.00
```

指标含义：
- tps：每秒从物理磁盘I/O的次数.多个逻辑请求会被合并为一个I/O磁盘请求,一次传输的大小是不确定的，一般情况下tps=(rtps+wtps)
- rtps：每秒的读请求数
- wtps：每秒的写请求数
- bread/s: 每秒读磁盘的数据块数(in blocks  1 block = 512B, 2.4以后内核)
- bwrtn/s:每秒写磁盘的数据块数(in blocks  1 block = 512B, 2.4以后内核)
- bdscd/s：磁盘每秒丢失的数据块数

### 4.2 sar -d
sar -dp --dev=[dev_list]
- 作用：块设备(磁盘)统计信息
- 参数：
  - -p：显示磁盘名称，默认情况磁盘显示为devM-n(M-主设备号，n-次设备号)
  - --dev=[dev_list]：指定要显示的设备

```bash
 sar -dp 1 1
Linux 3.10.0-957.el7.x86_64 (lv) 	03/09/20 	_x86_64_	(2 CPU)

18:38:56          DEV       tps  rd_sec/s  wr_sec/s  avgrq-sz  avgqu-sz     await     svctm     %util
18:38:57          sda      0.00      0.00      0.00      0.00      0.00      0.00      0.00      0.00
18:38:57    centos-root      0.00      0.00      0.00      0.00      0.00      0.00      0.00      0.00
18:38:57    centos-swap      0.00      0.00      0.00      0.00      0.00      0.00      0.00      0.00
```

指标含义：
- DEV：设备名称       
- tps：每秒从物理磁盘I/O的次数.多个逻辑请求会被合并为一个I/O磁盘请求,一次传输的大小是不确定的
- rd_sec/s：每秒从磁盘读取的数据量，扇区数
- wr_sec/s：每秒写入磁盘的数据量，扇区数
- avgrq-sz：I/O 请求的平均大小，单位 KB
- avgqu-sz：平均请求队列的长度
- await：I/O 请求的平均时间，包括等待时间，单位 milliseconds
- svctm：IO的处理时间，不包括等待时间，推断值，可能不准确
- %util：磁盘处理IO的时间百分比，即使用率，因此可能存在并行，100% 不一定代表磁盘饱和

### 4.3 sar -I 
sar -I { int_list | SUM | ALL }
- 作用：统计中断信息

## 5. 网络统计信息
### 5.1 sar -n
sar -n { keyword [,...] | ALL }
- 作用：统计网络使用情况
- keyword: 统计对象，可选值包括 
    - DEV, EDEV, FC, ICMP, EICMP, ICMP6,EICMP6
    - IP, EIP, IP6, EIP6, NFS, NFSD
    - SOCK, SOCK6, SOFT, TCP,ETCP, UDP and UDP6
- 常用选项:
    - -n DEV: 网络接口统计信息
    - -n EDEV: 网络接口错误
    - -n IP: IP 数据报统计信息
    - -n EIP: IP 错误统计信息
    - -n TCP: TCP 统计信息
    - -n ETCP: TCP 错误统计信息
    - -n SOCK: 套接字使用

#### sar -n DEV 
统计网卡的PPS与发送速率

```bash
sar -n DEV 1 1
Linux 3.10.0-862.el7.x86_64 (ZS-ISP) 	03/09/2020 	_x86_64_	(40 CPU)

06:21:04 PM     IFACE   rxpck/s   txpck/s    rxkB/s    txkB/s   rxcmp/s   txcmp/s  rxmcst/s
06:21:05 PM veth934832e      0.00      0.00      0.00      0.00      0.00      0.00      0.00
06:21:05 PM vethc869b5c      0.00      0.00      0.00      0.00      0.00      0.00      0.00
06:21:05 PM      eth0  10287.00   6519.00  13892.42   7946.05      0.00      0.00     20.00
06:21:05 PM      eth1      2.00      0.00      0.12      0.00      0.00      0.00      1.00
06:21:05 PM        lo   2958.00   2958.00  31135.78  31135.78      0.00      0.00      0.00
06:21:05 PM virbr0-nic      0.00      0.00      0.00      0.00      0.00      0.00      0.00
06:21:05 PM    virbr0      0.00      0.00      0.00      0.00      0.00      0.00      0.00
06:21:05 PM veth145e746      0.00      0.00      0.00      0.00      0.00      0.00      0.00
06:21:05 PM   docker0      0.00      0.00      0.00      0.00      0.00      0.00      0.00
```
指标含义：
- rxpck/s：接收的 PPS，单位为包 / 秒
- txpck/s：发送的 PPS，单位为包 / 秒
- rxkB/s： 接收的吞吐量，单位是 KB/ 秒
- txkB/s： 发送的吞吐量，单位是 KB/ 秒
- rxcmp/s：接收的压缩数据包数，单位是包 / 秒
- txcmp/s：发送的压缩数据包数，单位是包 / 秒
- rxmcst/s：广播包的 PPS，单位为包 / 秒
- %ifutil 是网络接口的使用率，即半双工模式下为 (rxkB/s+txkB/s)/Bandwidth，而全双工模式下为 max(rxkB/s, txkB/s)/Bandwidth。

#### sar -n EDEV
```bash
sar -n EDEV 1 2
Linux 3.10.0-1062.el7.x86_64 (localhost.localdomain)    2020年04月22日  _x86_64_        (1 CPU)

15时36分56秒     IFACE   rxerr/s   txerr/s    coll/s  rxdrop/s  txdrop/s  txcarr/s  rxfram/s  rxfifo/s  txfifo/s
15时36分57秒    enp0s3      0.00      0.00      0.00      0.00      0.00      0.00      0.00      0.00      0.00
15时36分57秒        lo      0.00      0.00      0.00      0.00      0.00      0.00      0.00      0.00      0.00
15时36分57秒 virbr0-nic      0.00      0.00      0.00      0.00      0.00      0.00      0.00      0.00      0.00
15时36分57秒    virbr0      0.00      0.00      0.00      0.00      0.00      0.00      0.00      0.00      0.00
```
指标:
1. rxerr/s: 接收数据包错误，数据包/s
2. txerr/s: 传输数据包错误，数据包/s
3. coll/s: 碰撞，数据包/s
4. rxdrop/s: 接收数据包丢包(缓冲满)，数据包/s
5. txdrop/s: 传输数据包丢包，数据包/s
6. txcarr/s: 发送数据包时，每秒载波错误数
7. rxfram/s: 每秒接收数据包的帧对齐错误数
8. rxfifo/s: 接收的数据包 FIFO 超限错误，数据包/s
9. txfifo/s: 传输的数据包 FIFO 超限错误，数据包/s

### sar -n IP
```bash
sar -n IP 1 2
Linux 3.10.0-1062.el7.x86_64 (localhost.localdomain)    2020年04月22日  _x86_64_        (1 CPU)

15时42分15秒    irec/s  fwddgm/s    idel/s     orq/s   asmrq/s   asmok/s  fragok/s fragcrt/s
15时42分16秒      1.00      0.00      1.00      1.00      0.00      0.00      0.00      0.00
15时42分17秒      1.01      0.00      1.01      1.01      0.00      0.00      0.00      0.00
平均时间:      1.01      0.00      1.01      1.01      0.00      0.00      0.00      0.00
```
指标:
1. irec/s: [ipInReceives] 输入的数据报文(接收)，数据报文/s
2. fwddgm/s:[ipForwDatagrams] 转发的数据报文，数据报文/s
3. idel/s: [ipInDelivers] 每秒向应用程序传输的数据报文数量
4. orq/s: [ipOutRequests] 输出/传输的数据报文，数据报文/s
5. asmrq/s: [ipReasmReqds] 每秒收到需要被重新组装的 IP fragments 数量
6. asmok/s: [ipReasmOKs] 每秒成功重新组装的(re-assembled)的数据报数量
7. fragok/s: [ipFragOKs] 每秒成功被分段(fragmented )的数据包数量
8. fragcrt/s: [ipFragCreates] 每秒对数据包成功分段产生的IP分段数


#### sar -n EIP
```bash
sar -n EIP 1 2
Linux 3.10.0-1062.el7.x86_64 (localhost.localdomain)    2020年04月22日  _x86_64_        (1 CPU)

15时48分42秒 ihdrerr/s iadrerr/s iukwnpr/s   idisc/s   odisc/s   onort/s    asmf/s   fragf/s
15时48分43秒      0.00      0.00      0.00      0.00      0.00      0.00      0.00      0.00
15时48分44秒      0.00      0.00      0.00      0.00      0.00      0.00      0.00      0.00
平均时间:      0.00      0.00      0.00      0.00      0.00      0.00      0.00      0.00
```
指标:
1. ihdrerr/s: [ipInHdrErrors]  每秒由于 IP Header 错误而丢弃的数据包数量
2. iadrerr/s: [ipInAddrErrors] 每秒由于 IP header's 里的IP地址不合法而丢弃的数据包数量
3. iukwnpr/s:  [ipInUnknownProtos] 每秒由于未知的网络协议而丢弃的数据包数量
4. idisc/s: [ipInDiscards] 数据包本身没有问题，因为其他原因比如缓冲满而丢弃的`输入数据包`数量
5. odisc/s: [ipOutDiscards] 数据包本身没有问题，因为其他原因比如缓冲满而丢弃的`输出数据包`数量
6. onort/s: [ipOutNoRoutes] 由于没有转发的路由而丢弃的数据包数量
7. asmf/s: [ipReasmFails] The number of failures detected per second by the IP re-assembly algorithm (for whatever reason: timed out, errors, etc) 
8. fragf/s: [ipFragFails] 因为需要分片但无法分片(fragmented)，而被丢弃的数据包数量

#### sar -n TCP
```bash
sar -n TCP 1 2
Linux 3.10.0-1062.el7.x86_64 (localhost.localdomain)    2020年04月22日  _x86_64_        (1 CPU)

15时50分54秒  active/s passive/s    iseg/s    oseg/s
15时50分55秒      0.00      0.00      1.00      1.00
15时50分56秒      0.00      0.00      1.01      1.01
平均时间:      0.00      0.00      1.01      1.01
```
指标:
1. active/s: [tcpActiveOpens] 新的主动 TCP 连接(connect()) 
2. passive/s: [tcpPassiveOpens] 新的被动 TCP 连接(listen())
3. iseg/s: [tcpInSegs] 输入的段，段/s
4. oseg/s: [tcpOutSegs] 输出的段，段/s

#### sar -n ETCP
```bash
sar -n ETCP 1 2
Linux 3.10.0-1062.el7.x86_64 (localhost.localdomain)    2020年04月22日  _x86_64_        (1 CPU)

15时51分29秒  atmptf/s  estres/s retrans/s isegerr/s   orsts/s
15时51分30秒      0.00      0.00      0.00      0.00      0.00
15时51分31秒      0.00      0.00      0.00      0.00      0.00
平均时间:      0.00      0.00      0.00      0.00      0.00
```
1. atmptf/s: [tcpAttemptFails] 每秒发生的以下状态转换的连接数 
    - `SYN-SENT or SYN-RCVD ->CLOSED` 
    - `SYN-RCVD -> LISTEN `
2. estres/s: [tcpEstabResets]每秒由 `ESTABLISHED or CLOSE-WAIT -> CLOSED` 状态的连接数
3. retrans/s: [tcpRetransSegs]每秒重发的段数 
4. isegerr/s: [tcpInErrs]每秒收到的错误段数 
5. orsts/s:   [tcpOutRsts]每秒收到的包含 RST flag TCP段数

#### sar -n SOCK
统计套接字的使用情况

```bash
sar -n SOCK 1 1
Linux 3.10.0-862.el7.x86_64 (ZS-ISP) 	03/09/2020 	_x86_64_	(40 CPU)

06:25:57 PM    totsck    tcpsck    udpsck    rawsck   ip-frag    tcp-tw
06:25:58 PM      4957       821        47         0         0       201
Average:         4957       821        47         0         0       201
```
指标含义：
- totsck：在使用的 socket 数量    
- tcpsck：在使用的 tcp socket 数量    
- udpsck：在使用的 udp socket 数量    
- rawsck：在使用的 raw socket 数量    
- ip-frag：当前队列中的 IP 数据片 
- tcp-tw：处于 TIME_WAIT 状态的 TCP数量


## 6. 文件系统
### 6.1 sar -v
报告文件系统缓存
```bash
>  sar -v 1
Linux 3.10.0-1062.el7.x86_64 (localhost.localdomain)    2020年04月21日  _x86_64_        (1 CPU)

18时08分59秒 dentunusd   file-nr  inode-nr    pty-nr
18时09分00秒     14637      2080     24198         1
18时09分01秒     14637      2080     24198         1
```
指标含义:
1. dentunusd: 目录项缓存未用计数
2. file-nr: 使用中的文件描述符个数
3. inode-nr: 使用中的 inode 个数
