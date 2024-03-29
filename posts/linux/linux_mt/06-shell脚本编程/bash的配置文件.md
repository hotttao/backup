---
weight: 1
title: 6.8 bash 配置文件
date: '2018-01-17T22:10:00+08:00'
lastmod: '2018-01-17T22:10:00+08:00'
draft: false
author: 宋涛
authorLink: https://hotttao.github.io/
description: 6.8 bash 配置文件
featuredImage: null
tags:
- 马哥 Linux
categories:
- Linux
lightgallery: true
toc:
  auto: false
---

bash 配置文件

![linux-mt](/images/linux_mt/linux_mt.jpg)
<!-- more -->

bash 的配置文件也是 shell 脚本，用于定义环境变量，别名或运行一些特殊用途的脚本。比如一些特殊用途的别名，我们不想每次登陆 shell 后都重新设置，可以定义在配置文件中；又比如想将一些特定目录添加到 PATH 环境变量中等等。要理解 bash 的配置文件，我们首先需要明白 bash 的两种登陆类型，它们会分别读取不同的配置文件，所以本节的内容如下:
1. bash 中的登陆类型
2. bash 配置文件类型
3. 配置文件的生效过程

## 1. bash 中的登陆类型
bash 中配置文件大致分为**交互式登录**和**非交互式登录** 两种类型。每种类型发生的情景对应如下:
1. 交互式登录shell进程：
	- 直接通过某终端输入账号和密码后登录打开的shell进程；
	- 使用su命令：`su - USERNAME`, 或 `su -l USERNAME` 执行的登录切换；
2. 非交互式登录shell进程：
	- `su USERNAME`执行的登录切换；
	- 图形界面下打开的终端；
	- 运行脚本

## 2. bash的配置文件类型
针对两种登陆类型，配置文件也分成了两类：
1. profile类：为交互式登录的shell进程提供配置
2. bashrc类：为非交互式登录的shell进程提供配置

### 2.1 profile类配置文件
profile:
- 作用:
	- 用于定义环境变量；
	- 运行命令或脚本；
- 位置:
	1. 全局配置：对所有用户都生效；
		- `/etc/profile`
		- `/etc/profile.d/*.sh`
	2. 用户个人：仅对当前用户有效；
		- `~/.bash_profile`
- 注意：仅管理员可修改全局配置文件；

### 2.2 bashrc类配置文件
bashrc:
- 作用:
	- 定义本地变量；
	- 定义命令别名；
- 位置:
	- 全局配置：`/etc/bashrc`
	- 用户个人：`~/.bashrc`
- 注意：仅管理员可修改全局配置文件；

## 3. 配置文件的生效过程
1. **交互式登录**: `/etc/profile --> /etc/profile.d/* --> ~/.bash_profile --> ~/.bashrc --> /etc/bashrc`
2. **非交互式登录**: `~/.bashrc --> /etc/bashrc --> /etc/profile.d/*`

需要注意的配置文件和命令行定义的配置具有不同的生效时间:
- 对于命令行，例如变量和别名作用域为当前shell进程的生命周期；
- 对于配置文件，虽然可以永久有效，但是只对随后新启动的shell进程才有效，对当前shell 无效；
因此让配置文件定义的特性立即生效需要额外操作，有两种方法可供选择
1. 通过命令行重复定义一次；
2. 让shell进程重读配置文件；
	- `source /PATH/FROM/CONF_FILE`
	- `. /PATH/FROM/CONF_FILE`
