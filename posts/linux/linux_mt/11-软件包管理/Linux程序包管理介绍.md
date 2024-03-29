---
weight: 1
title: 10.1 Linux程序包管理介绍
date: '2018-02-03T22:10:00+08:00'
lastmod: '2018-02-03T22:10:00+08:00'
draft: false
author: 宋涛
authorLink: https://hotttao.github.io/
description: 10.1 Linux程序包管理介绍
featuredImage: null
tags:
- 马哥 Linux
categories:
- Linux
lightgallery: true
toc:
  auto: false
---

Linux程序包管理介绍

![linux-mt](/images/linux_mt/linux_mt.jpg)
<!-- more -->

本节是 Linux 包管里器的一些背景知识，目的是让大家对为什么会存在包管里器，包管理器本身有个大体上的了解。在这之后我们会详细介绍 Centos 的包管理器 rpm 的使用。本节主要包含以下内容:
1. 为什么会有包管里器
2. 包管理器简介
  - 包管理器的种类
  - 包的命令格式
  - 包依赖关系的解决
  - 包的可能来源

## 1. 为什么会有包管里器
大型程序的构建是一件非常复杂的使用，为了方便的程序的管理，我们不可能将几千甚至几万行的代码放在同一个文件中；如果有 C 程序的使用经验就会知道，在编译 C 的过程，如果程序文件存在依赖关闭，则必须按照依赖顺序进行编译，否则无法编译成功。因此出现了 make,cmake 这样的工具用于帮助实现程序的编译。于此同时编译需要特殊环境和工具，编译环境的准备也不是一件容易的事，因此为方便终端用户在 Linux 上安装使用程序出现了包管理器。

所谓包管理器就是预先将程序编译好；然后将其打包成程序包。程序包的安装过程，就是将编译好的目标程序(我们称之为目标二进制格式) 的二进制程序、库文件、配置文件、帮助文件放置到特定目录中即可，rpm 的数据库会记录每个程序的每个文件及其存放位置，因此通过我们也可以通过 程序包管理器轻松实现对程序的升级，卸载和查询。

二进制的 C 程序是与平台相关的，因此只能安装与自身平台架构相同的程序包。需要注意的是程序的特定功能是在程序编译时就确定的，因此为满足不同人对程序功能的定制需求，程序包通常会按照功能进行分包；即通用的功能放在主包中，其他额外的功能放在分包中。



## 2. 程序包管理器
### 2.1 程序包管里器的种类
不同的主流 Linux 发行版为自家开发了特有的包管里器，目前比较流行的有如下几个，Centos主要使用 rpm，我们的介绍也以 rpm 为主
1. debian：dpt(dpkg), 后缀名为 `.deb`
2. redhat：rpm(redhat package manager/rpm is package manager),后缀名为 `.rpm`
3. S.u.S.E：rpm, ".rpm"
4. Gentoo：ports
5. ArchLinux：dnf

### 2.1 包命名格式
程序包的命名方式遵循特定的规则，包含了很多信息，通过包名我们大体上就可以判断其是否符合我们需要。rpm 的包名由源代码的名称衍生而来。
1. 源代码名称: name-VERSION.tar.gz
    - VERSION：major.minor.release
    - eg: redis-3.0.2.targz
2. rpm 包名称: name-VERSION-ARCH.rpm
	- eg: redis-3.0.2-1.centos7.x64.rpm
    - VERSION：major.minor.release 源代码包的版本号，此处为 3.0.2
    - ARCH:release.os.arch rpm包的发行号，此处为 1.centos7.x64
        - release: rpm 包制作的版本号
        - os: 操作系统平台
        - arch: archetecture 硬件架构包括i386, x64(amd64), ppc, noarch 等
3. 由于 rpm 存在拆包的可能，支包的命名方式是在主包的基础上添加了支包的功能说明
    - 主包：name-VERSION-ARCH.rpm
    - 支包：name-function-VERSION-ARCH.rpm，function 可以是 devel, utils, libs, ...

### 2.2 依赖关系：
包管理不能自动解决程序的依赖关系，因此每个程序包都有与之对应的前端工具，能自动解决安装卸载过程中的依赖关系
- yum：rhel系列系统上rpm包管理器的前端工具；
- apt-get (apt-cache)：deb包管理器的前端工具；
- zypper：suse的rpm管理器前端工具；
- dnf：Fedora 22+系统上rpm包管理器的前端工具；

#### ldd
`ldd  /path/binary_file`
- 作用: 查看二进制文件依赖的库文件

#### ldconfig
`ldconfig`
- 作用: 管理和查看本机的挂载库文件
- `-p`: 显示本机已经缓存的所有可用库文件及文件路径映射关系
- 配置文件: `/etc/ld.so.conf`, `/etc/ld.so.conf.d/*.conf`
- 缓存文件: `/etc/ld.so.cache`


### 2.3 程序包的组成
程序包由如下几个部分组成:
1. 程序包的组成清单（每个程序包都单独 实现）；
    - 文件清单
    - 安装或卸载时运行的脚本
2. 数据库（公共）
    - 程序包的名称和版本；
    - 依赖关系；
    - 功能说明；
    - 安装生成的各文件的文件路径及校验码信息；
    - 等等等
    - /var/lib/rpm/

### 2.4 获取程序包的途径
我们的程序包基本都是从网络上下载获取，因此应该尽量从正规途径下载程序包，防止被植入后门。包下载之后应该尽量对其来源合法性，程序包完整性进行检查，确认没有问题后在使用。可靠的包获取途径如下所示:
1. 系统发行版的光盘或官方的文件服务器（或镜像站点）
    - http://mirrors.aliyun.com,
    - http://mirrors.sohu.com,
    - http://mirrors.163.com
2. 项目的官方站点
3. 第三方组织：
    - EPEL
    - 搜索引擎
        - http://pkgs.org
        - http://rpmfind.net
        - http://rpm.pbone.net
4. 自动动手，丰衣足食
