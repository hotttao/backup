---
title: 2 文件 IO 和字符操作
date: 2020-12-01
categories:
    - Go
tags:
	- go标准库及第三方库
	- 入门指南
series: go 语言入门
---

文件IO
<!-- more -->


## 1. 文件 IO 概述
Go 的标准库我们就从文件 IO 和字符操作(包括字符串和字节数组)。Go 标准库中为文件 IO 提供了如下这些包:
1. 文件操作的方法在 os 包中
2. 为了扩展"文本操作"的范围(类似 Linux 中一切接文件，可以把文本操作扩展到其他类型的资源上) io 包提供了对I/O原语的基本接口，io 包基本任务是包装这些原语已有的实现（如os包里的原语），使之成为共享的公共接口。
3. os 包内的文件IO 是不带语言层的缓存的， bufio 提供了语言层带缓存 IO，通过带缓存 IO，使得我们可以以特定的方式读取类文件中的内容，比如按特定分隔符读取等等
4. string，bytes 提供了对 string，bytes 操作的方法，为了扩展 string 和bytes 的操作，string 和 bytes 包为 string 和 bytes 实现部分文件 io 的公共接口。

所以接下来我们先从文件 IO 入手，学习 os，io，bufio 和 string/bytes 中的文件 io 操作，然后再顺带介绍一下 string 和 bytes 提供的字符操作函数。
