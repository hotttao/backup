---
title: 7 Mariadb MHA
date: 2020-03-06
categories:
    - 存储
tags:
    - mysql运维
---

Mariadb MHA 高可用

<!-- more -->

## 1. MHA
Mairadb 主从复制，需要读写分离，还需要 MHA 做高可用，配置起来较为麻烦。建议使用 PXC 或 AliSQL 做多主集群，这样只需要使用 Nginx 进行负载均衡即可。