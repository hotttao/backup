---
title: 1 Go 进阶学习开篇
date: 2021-01-01
categories:
    - Go
tags:
	- Go语言进阶
	- 入门指南
---

前面 Go语言入门中我们学习了 Go 语言的基础语法和使用。这个系列我们来深入到 Go 语言内部，看看Go 中常见的对象的实现原理，帮助我们对 Go 的理解更深一步。

<!-- more -->

## 1. 学习材料
Go 语言这一两年的发展真是势如破竹，相关的书和视频初版的非常快，其中我觉得很好的有下面这些:
1. [《Go专家编程》](https://book.douban.com/subject/35144587/): 在 GitBook 中找到一本书，可能太受欢迎了，作者已经初版了书，对 Go 基本上所有部分的实现都做了解释，深入浅出
2. [《Go RPC 开发指南》](http://www.topgoer.com/): 重点介绍高性能的分布式全功能的RPC框架 rpcx
3. [Go夜读](): Go 夜读是面向 Go 语言的专业分享组织，每期都会邀请很多 Go 方面的大牛做一些分享，我抽选了如下几期作为示例:
4. [一个介绍了Go语言方方面面的Gitbook](http://www.topgoer.com/)


除了上面这些，我还找到一些其他相关的学习材料，还没深入读过，先记录于此:
1. [《Go 语言设计与实现》](https://draveness.me/golang/)：本书的主要内容可以分成四个主要部分，分别是编译原理、运行时、基础知识和进阶知识
1. [《Go 语言原本》](https://golang.design/under-the-hood/)：也有一本有关 Go 实现很深的书
1. [《Go语法树入门》](https://github.com/chai2010/go-ast-book)：Go 编译原理的书，详细介绍了Go语言语法树结构
1. [《Go2编程指南》](https://github.com/chai2010/go2-book)：重点讲解Go2新特性

GitHup 上还有很多类似的收集了很多学习资源的仓库，列在下面供大家学习参考
1. https://github.com/KeKe-Li/books
