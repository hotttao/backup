---
weight: 1
title: virtualenv
date: '2018-06-09T22:10:00+08:00'
lastmod: '2018-06-09T22:10:00+08:00'
draft: false
author: 宋涛
authorLink: https://hotttao.github.io/
description: "virtualenv 基本使用"
featuredImage: null
tags:
- python 库
categories:
- Python
lightgallery: true
---

## 1. 环境创建
`virtualenv dirname` -- 创建虚拟环境  
`source dirname/bin/activate` -- 启用虚拟环境

virtualenv 可用选项 | 作用
:--- | :---
--distribute dirname|创建新的虚拟环境，并安装 pip
--no-site-packages|使系统环境的包对虚拟环境不可见

## 2.virtualenvwrapper
作用：virtualenv 管理工具，方便的创建/激活/管理/销毁虚拟环境

命令 | 作用
:---|:---
mkvirtualenv virname|新建虚拟环境
workon virname|激活
deactivate|关闭
rmvirtualenv virname|删除
