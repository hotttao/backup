---
weight: 1
title: "Docker 问题排查工具"
date: 2022-12-25T12:00:00+08:00
lastmod: 2022-12-25T12:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "这个系列我们开始学习 go 语言的第二部分-go语言进阶"
featuredImage: 

tags: ["工具集"]
categories: ["工具集"]

lightgallery: true

toc:
  auto: false
---

## 1. 工具简介
下面这些工具可以用来排查 Docker 相关的问题:

|分类|工具|作用|
|:---|:---|:---|
|NameSpace|`lsns`|查看系统上存在的 namespace|
||`ls -la /proc/<pid>/ns`|查看进程的 namespace|
||`nsenter -t <pid>`|进入某 namespace 运行命令|


## 2. NameSpace 类
### 2.1 lsns
```bash
$ lsns --help

用法：
 lsns [选项] [<名字空间>]

列出系统名字空间。

选项：
 -J, --json              使用 JSON 输出格式
 -l, --list             使用列表格式的输出
 -n, --noheadings       不打印标题
 -o, --output <list>    定义使用哪个输出列
 -p, --task <pid>       打印进程名字空间
 -r, --raw              使用原生输出格式
 -u, --notruncate       不截断列中的文本
 -W, --nowrap           don't use multi-line representation
 -t, --type <name>      名字空间类型(mnt, net, ipc, user, pid, uts, cgroup)

 -h, --help             display this help
 -V, --version          display version

Available output columns:
          NS  名字空间标识符 (inode 号)
        TYPE  名字空间类型
        PATH  名字空间路径
      NPROCS  名字空间中的进程数
         PID  名字空间中的最低 PID
        PPID  PID 的 PPID
     COMMAND  PID 的命令行
         UID  PID 的 UID
        USER  PID 的用户名
     NETNSID  namespace ID as used by network subsystem
        NSFS  nsfs mountpoint (usually used network subsystem)


```

### 2.2 nsenter
```bash
$ nsenter --help

用法：
 nsenter [选项] [<程序> [<参数>...]]

以其他程序的名字空间运行某个程序。

选项：
 -a, --all              enter all namespaces
 -t, --target <pid>     要获取名字空间的目标进程
 -m, --mount[=<文件>]   进入 mount 名字空间
 -u, --uts[=<文件>]     进入 UTS 名字空间(主机名等)
 -i, --ipc[=<文件>]     进入 System V IPC 名字空间
 -n, --net[=<文件>]     进入网络名字空间
 -p, --pid[=<文件>]     进入 pid 名字空间
 -C, --cgroup[=<文件>]  进入 cgroup 名字空间
 -U, --user[=<文件>]    进入用户名字空间
 -S, --setuid <uid>     设置进入空间中的 uid
 -G, --setgid <gid>     设置进入名字空间中的 gid
     --preserve-credentials 不干涉 uid 或 gid
 -r, --root[=<目录>]     设置根目录
 -w, --wd[=<dir>]       设置工作目录
 -F, --no-fork          执行 <程序> 前不 fork
 -Z, --follow-context  根据 --target PID 设置 SELinux 环境

 -h, --help             display this help
 -V, --version          display version


$ sudo docker inspect -f '{{ .State.Pid }}' bitbucket_drone_drone_1
4992

$ sudo nsenter -t 4992 -n ip addr
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
27: eth0@if28: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default 
    link/ether 02:42:ac:12:00:03 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 172.18.0.3/16 brd 172.18.255.255 scope global eth0
       valid_lft forever preferred_lft forever
```
