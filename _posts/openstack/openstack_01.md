---
title: Openstack 入门开篇
date: 2021-03-01
categories:
    - 运维
tags:
	- Openstack
	- 入门指南
---

Openstack
<!-- more -->


## 1. 为什么要学 OpenResty
最近入职了新公司，接触到了 Openstack ，之前一直都是在学习 Go 和 k8s，没有怎么关注过 Openstack 的东西。现在工作需要，正式学习的好机会，把学习和工作结合起来，是学习最快的方式。Openstack 代表着通过虚拟机实现虚拟化的整个技术栈，需要对网络、存储、CPU 的虚拟化技术都要了解，技术栈其实非常的深，是一个非常值得深入的方向。

## 2. 怎么学 OpenResty
如果是对 Opentack 有了解的朋友应该知道 Openstack 有点类似云环境的操作系统，按照与操作系统类似的功能维度包含了很多组件，核心的组件有:
1. Keystone：认证服务
2. Glance：镜像服务
3. Nova：计算服务
4. Cinder：块存储服务
5. Neutorn：网络服务
6. Swift：对象存储服务

接下来我们将按照一个组件一个学习系列的方式去学习每个组件，这些核心组件中，最为核心的就是 nova，所以 nova 也是我们学习的第一组件，也将是介绍最为详细的组件。

这个系列的博客定位于源码解析，我们会深入到源码当中。希望通过这个系列的博客，我们不仅能深入了解 Openstack，更能学习到 Openstack 中 Python 编程的各种技巧。

## 3. 学习资料
要学习 Openstack 需要有虚拟化特别是网络虚拟化方面的知识储备，同时对硬件和 Linux 有一定基础，下面是我之前看过的一些学习资料和书，推荐给大家:
1. [极客时间专栏-趣谈网络协议](https://time.geekbang.org/column/intro/85): 网易超哥，我在这轮找工作前刷的这个极客专栏，对我帮助挺大的，里面详细介绍了传统网络以及当下几乎所有网络虚拟化的技术。不过后面有关虚拟化的部分不好懂，需要你有一些硬件的基础
2. [每天五分钟玩转Openstack](https://mp.weixin.qq.com/s/QtdMkt9giEEnvFTQzO9u7g): 对 Openstack 了解不深的同学，非常建议从这本书开始看起，可以快速让你了解 Openstack 的整体架构和设计思路
3. [int32bit](https://github.com/int32bit/openstack-workflow): 这个 github 仓库图形化OpenStack的所有操作流程，对于我们学习后期学习源码，了解 Openstack 是一个非常好的方式

硬件、Linux、Python 的知识也是需要的，这方面的资料就多了，就不一一推荐了。学习 Openstack 是一个长远的旅程，希望大家能坚持住。 

## 4. 环境搭建
学习源码的前提是先准备一个 Openstack 的环境，使用的是 [int32bit](https://github.com/int32bit/openstack-workflow)里面推荐的 [packstack](https://www.rdoproject.org/install/packstack/)。不过依旧遇到了很多坑，记录一下，防止大家再次踩到，下面是一个简单的安装步骤:

```bash
# 1. 安装 centos8 操作系统

# 2 按照 packstack 的安装步骤依次执行以下命令
# 2.1 配置网络服务
dnf install network-scripts -y
systemctl disable firewalld
systemctl stop firewalld
systemctl disable NetworkManager
systemctl stop NetworkManager
systemctl enable network
systemctl start network

# 2.2 配置 powertools
# 没深究这是干嘛，网上能查到的安装方式都试验了一次
dnf -y install dnf-plugins-core
dnf -y install https://dl.fedoraproject.org/pub/epel/epel-release-latest-8.noarch.rpm
dnf config-manager --set-enabled powertools

dnf config-manager --enable powertools
dnf install -y centos-release-openstack-victoria
dnf update -y

dnf install -y centos-release-openstack-ussuri

# 2.3 解决 puppet 依赖问题
dnf -y install https://yum.puppetlabs.com/puppet-release-el-8.noarch.rpm

# 2.4 安装 packstack
dnf install -y openstack-packstack

# 2.5 启动服务
packstack --allinone
```

按照上面的配置启动服务后，会遇到很多问题，如果你遇到了下面类似的问题可以参照解决:
1. puppet 版本过高的问题: 
    - 方法: 卸载 puppet，然后重新执行 `dnf install -y openstack-packstack`
    - 原因: openstack-packstack 的yum 仓库好像有版本依赖问题， puppet 安装不上，但是直接安装的 puppet，版本过高，所以先安装高版本，在卸载 puppet 依赖的包就能安装上
2. centos8 不支持 ovn:
    - 方法: 参考这篇[文章](https://mdickinson.dyndns.org/php/wordpress/?p=922)将 ovs 替换成 vxlan，也可以像下面这样预生成配置文件

```bash
# 1. 生成配置文件
packstack --gen-answer-file=answers_default_allin1.txt \
 --allinone --timeout=999999 --default-password=1234 \
 --os-neutron-ml2-type-drivers=vxlan,flat \
 --os-neutron-ml2-tenant-network-types=vxlan \
 --os-heat-install=y --os-heat-cfn-install=y \
 --os-magnum-install=y \
 --os-neutron-l2-agent=openvswitch

# 2. 修改 answers_default_allin1.txt 内的配置参数 CONFIG_NEUTRON_L2_AGENT

# 3.启动服务
packstack --timeout=99999 --answer-file=answers_default_allin1.txt
```

上面的安装过程是安装成功后回忆的内容，可能有出入有问题大家自行 google 查找解决方案即可。
