---
title: 3 字符操作
date: 2020-12-03
categories:
    - Go
tags:
	- go标准库及第三方库
	- 入门指南
series: go 语言入门
---

文件IO
<!-- more -->


## 1. 字符操作
strings 和 bytes 提供了 go 语言中的字符操作，因为还不不支持泛型，所以这两个包提供了几乎一样的函数和类型，区别仅仅在于一个操作 string，一个操作 []byte。

