---
title: 1 OpenResty 入门开篇
date: 2021-02-01
categories:
    - Go
tags:
	- OpenResty
	- 入门指南
---

性能优化篇之 OpenResty

<!-- more -->

![lua](/images/openresty/openresty_first.jpg)


## 1. 为什么要学 OpenResty
想要学 OpenResty 起因是想深入学习性能优化。在学习这个专栏之前，我已经看完了 [《性能之巅》](https://book.douban.com/subject/26586598/) 和 [极客时间专栏-Linux性能优化实战](https://time.geekbang.org/column/intro/140)。对Linux 的性能优化算是入了门，但是距离实战还很远，恰逢在极客时间看到温格老师的专栏 [极客时间专栏-OpenResty从入门到实战(温格)](https://time.geekbang.org/column/intro/186)。里面将 OpenResty、Lua、性能优化很好的集合在一起，偏实战。所以决定深入学习一下，这个系列的博客就是[极客时间专栏-OpenResty从入门到实战(温格)](https://time.geekbang.org/column/intro/186)的学习笔记。

## 2. 怎么学 OpenResty
温格老师的专栏将 OpenResty 的学习分成了如下几个模块，我们就按此循序渐进一一学习:
1. 同步非阻塞的编程模式；
2. 不同阶段的作用；
3. LuaJIT 和 Lua 的不同之处；
4. OpenResty API 和周边库；
5. 协程和 cosocket；
6. 单元测试框架和性能测试工具；
7. 火焰图和周边工具链；
8. 性能优化

## 3. 学习资料
1. [极客时间专栏-OpenResty从入门到实战(温格)](https://time.geekbang.org/column/intro/186)

## 4. 环境搭建
### 4.1 Linux
Linux & Mac上安装 OpenResty 安装非常简单，安装步骤如下

```bash
# 1. 添加 OpenResty 仓库
wget https://openresty.org/package/centos/openresty.repo
sudo mv openresty.repo /etc/yum.repos.d/

# 2. update the yum index:
sudo yum check-update

# 3. 安装
sudo yum install -y openresty openresty-resty openresty-opm openresty-doc

# 列出所有 openresty 仓库里头的软件包：
sudo yum --disablerepo="*" --enablerepo="openresty" list available
```

### 4.2 Windows
官方为 OpenResty windows 提供了可直接使用的安装包，从 [OpenResty官网](http://openresty.org/cn/download.html) 下载即可。不过由于 resty 命令行工具是使用 perl 编写的，要想使用 resty 命令行工具需要安装 perl。完整的安装步骤如下:

```bash
# 1. 下载安装包
# 2. 将 openresty 添加到 PATH 环境变量
# 3. 安装 perl https://strawberryperl.com/download/5.32.1.1/strawberry-perl-5.32.1.1-64bit.msi
```