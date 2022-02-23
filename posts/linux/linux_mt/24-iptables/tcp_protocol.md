---
weight: 1
title: 21.6 TCP 协议简述
date: '2018-04-03T22:10:00+08:00'
lastmod: '2018-04-03T22:10:00+08:00'
draft: false
author: 宋涛
authorLink: https://hotttao.github.io/
description: 21.6 TCP 协议简述
featuredImage: null
tags:
- 马哥 Linux
categories:
- Linux
lightgallery: true
toc:
  auto: false
---

TCP 协议简述

![linux-mt](/images/linux_mt/linux_iptables.jpg)
<!-- more -->

tcp 连接是由两个有来有往的半个连接组成的

## 1. 连接建立与拆除
### 1.1 三此握手
![tcp](/images/linux_mt/tcp_connect.png)

### 1.2 四次挥手
![tcp](/images/linux_mt/tcp_close.png)

### 1.3 连接重置
tcp 连接过程中可能因为网络抖动导致双方无法通信，但是连接未拆除，过了一段时间后网络又恢复正常，双方的连接状态依旧存在，此时需要发送 RST 标识位的报文实现 tcp 连接重置。

### 1.4 连接过程
![tcp](/images/linux_mt/tcp.gif)
