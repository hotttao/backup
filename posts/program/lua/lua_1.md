---
title: 1 lua 入门开篇
date: 2020-08-06
categories:
    - Go
tags:
	- lua 语言入门
	- 入门指南
series: lua 入门
---

要学的东西很多，其中有个叫 lua

<!-- more -->

![lua](/images/lua/lua.png)


## 1. 为什么要学 lua
想要学 lua 是因为最近才发现越来越多的中间件诸如 ElasticSearch，Redis，Openresty 都把 lua 作为内嵌的脚本语言。Openresty 是我进一步学习性能优化的关键，lua 是一个无法绕过的坎。

## 2. 怎么学 lua
有了前面学习 Python 和 Go 的经历，通过学习下面的知识我们可以快速的学习一门语言的语法:
1. 变量、类型和流控，包括
	- 变量及常量的命名，声明和创建
	- 条件判断和循环
	- 变量的生命周期与作用域
2. 基础数据类型的使用
	- 基础数据类型
	- 自定义类型
	- 类型转换
3. 模块和包
4. 异常处理
5. 函数，类与泛型
6. 协程
7. 标准库
8. C 扩展

## 3. 学习资料
书选的
1. [《自己动手实现Lua》](https://book.douban.com/subject/30348061/)
2. [《Lua程序设计》](https://book.douban.com/subject/30262035/)

## 4. 环境搭建
### 4.1 Linux
Linux & Mac上安装 Lua 安装非常简单，只需要下载源码包并在终端解压编译即可，本文使用了5.3.0版本进行安装：
```bash
curl -R -O http://www.lua.org/ftp/lua-5.3.0.tar.gz
tar zxf lua-5.3.0.tar.gz
cd lua-5.3.0
make linux test
make install
```

### 4.2 Windows
从 [Git Lua](https://github.com/rjpcomputing/luaforwindows/releases) 下载安装包安装即可。

