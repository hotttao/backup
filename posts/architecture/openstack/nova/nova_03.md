---
title: 3. setuptools.py 
date: 2021-03-04
categories:
    - 运维
tags:
	- Openstack
---

你可能很奇怪，为什么突然要讲 Python 的包管理工具 setuptools.py。因为通过 setuptools.py 的配置文件，我们可以快速知道一个模块提供的所有程序的入口。
<!-- more -->

## 1. Python 的包管理工具
Python 里面有多种 distutils、setuptools、distribute 等等。这些工具主要解决下面这些问题:
1. 版本管理
2. 依赖管理
3. 安装管理
4. ......

