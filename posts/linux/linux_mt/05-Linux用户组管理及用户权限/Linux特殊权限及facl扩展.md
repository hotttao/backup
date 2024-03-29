---
weight: 1
title: 5.4 Linux特殊权限及facl扩展
date: '2018-01-09T22:10:00+08:00'
lastmod: '2018-01-09T22:10:00+08:00'
draft: false
author: 宋涛
authorLink: https://hotttao.github.io/
description: 5.4 Linux特殊权限及facl扩展
featuredImage: null
tags:
- 马哥 Linux
categories:
- Linux
lightgallery: true
toc:
  auto: false
---

Linux特殊权限及facl扩展

![linux-mt](/images/linux_mt/linux_mt.jpg)
<!-- more -->

Linux 默认的访问控制模型是通过将用户划分为三类，每类用户都可设置读写执行权限实现的。但是某些特殊情况下，此模型可能不太适用，因为其控制的粒度不够。所谓特殊权限及facl 扩展就是用来扩展Linux 的访问控制模型的。本节内容包括:
1. 安全上下文，即程序的访问控制执行环节
2. SUID
3. SGID
4. STICKY
5. facl

## 1. 安全上下文：
所谓安全上下文即怎么决定一个用户是否某一文件具有什么权限:
1. 进程以某用户的身份运行； 进程是发起此进程用户的代理，因此以此用户的身份和权限完成所有操作；
2. 权限匹配模型：
	- 判断进程的属主，是否为被访问的文件属主；如果是，则应用属主的权限；否则进入第2步；
	- 判断进程的属主，是否属于被访问的文件属组；如果是，则应用属组的权限；否则进入第3步；
	- 应用other的权限；

## 2. SUID
默认情况下，用户发起的进程，进程的属主是其发起者；因此，其以发起者的身份在运行。存在 SUID时，用户运行某程序时，如果此程序拥有SUID权限，那么程序运行为进程时，进程的属主不是发起者，而程序文件自己的属主；

#### SUID 特性
- 进程发起者对程序文件具有可执行权限
- 进程的属主为程序文件的属主，而非程序发起者
- SUID 权限展示在属主的执行权限位上
	- rws------:小写 s 表示属主原有 x 权限
	- rwS------:大写 S 表示属主原没有 x 权限

#### SUID 权限管理
- `chmod u+s FILE.....`: 添加 SUID 权限
- `chmod u-s FILE.....`: 删除 SUID 权限


## 2. SGID：
默认情况下，新创建文件的数组为用户的有效用户组。当文件目录的属组有写权限，且有SGID权限时，那么所有属于此目录的属组，且以属组身份在此目录中新建文件或目录时，新文件的属组不是用户的基本组，而是此目录的属组；

#### SGID 特性		
- 默认情况下，用户创建文件时，其属组为此用户的基本组
- 一旦目录具有 SGID 权限，则对此目录具有写权限的用户，在此目录中创建的文件所属的组为目录的属组
- SGID 权限展示在属组的执行权限位
	- ---rws---: 小写 s 表示属组有 x 权限
	- ---rwS---: 大写 S 表示属组没有 x 权限


#### SGID 权限管理
- `chmod g+s DIR.....`: 添加 SGID 权限
- `chmod g-s DIR.....`: 删除 SGID 权限


## 3. Sticky
对于属组或全局可写的目录，组内的所有用户或系统上的所有用户对在此目录中都能创建新文件或删除所有的已有文件；如果为此类目录设置Sticky权限，则每个用户能创建新文件，且只能删除自己的文件；

#### Sticky 特性
- 对于一个多人可写目录，如果此目录设置了 Sticky 权限，则每个用户仅能删除自己的文件
- Sticky 权限展示在其它用户的执行权限位
	- ------rwt: other 拥有 x 权限
	- ------rwT: other 没有 x 权限
- 系统上的/tmp和/var/tmp目录默认均有sticky权限；

#### Sticky 权限管理
- `chmod o+t DIR....`: 添加 Sticky 权限
- `chmod o-t DIR....`: 删除 Sticky 权限

基于八进制方式赋权时，可于默认的三位八进制数字左侧再加一位八进制数字 `chmod 1777`

## 4. facl
facl - file access control lists 指的是文件的额外赋权机制，在原来的u,g,o之外，另一层让普通用户能控制赋权给另外的用户或组的赋权机制。facl 包含两个命令，getfacl 用于查看文件访问控制列表，setfacl 用户设置文件访问控制列表

#### getfacl命令
`getfacl FILE...`

```
> getfacl README.md
# file: README.md
# owner: tao
# group: 197121 <unknown>
user::rw-    # 属主
user:centos:rw-    # facl 赋权给 centos 的权限
group::r--   # 属组
other:r--    # 其他

```		

#### setfacl命令：
1. 赋权:
	- 赋权给用户：`setfacl  -m  u:USERNAME:MODE  FILE...`
	- 赋权给组  ：`setfacl  -m  g:GROUPNAME:MODE FILE...`
2. 撤权：
	- 撤销用户赋权: `setfacl  -x  u:USERNAME  FILE...`
	- 撤销组赋权:   `setfacl  -x  g:GROUPNAME  FILE...`
