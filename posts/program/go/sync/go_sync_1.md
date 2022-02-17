---
weight: 1
title: "go 并发编程入门指南"
date: 2021-05-01T22:00:00+08:00
lastmod: 2021-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "这个系列我们开始学习 go 语言的并发"
featuredImage: 

tags: ["go 并发"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

这个系列我们开始学习 Go 语言的第四个部分: 并发编程。
<!-- more -->

## 1. 学习内容
Go 语言的并发编程，我们学习的核心内容来自于极客时间的专栏[Go 并发编程实战课](https://time.geekbang.org/column/intro/355)，作者网名[鸟窝](https://colobu.com/)。这个专栏在极客时间上的订阅并不多，但绝对是五星推荐。

## 2. 内容大纲
鸟叔的专栏设计了 5 个模块：
1. 基本并发原语: 包括 Mutex，RWMutex，WaitGroup，Cond，Pool，Context，这些都是传统的并发原语在其他语言中也很常见
2. 原子操作: Go 标准库提供的原子操作
3. Channel: Go 语言独有的类型，是 Go 实现消息传递的核心数据结构
4. 扩展并发原语： 包括信号量，SingleFlight，循环栅栏，ErrGroup
5. 分布式并发原语: 使用 etcd 实现一些分布式并发原语，比如 Leader选举，分布式互斥锁，分布式读写锁，分布式队列

我们基本上会按照这样的顺序循序渐进。并发编程的核心就是解决并发编程中的资源管理问题，通常包括如下场景:
1. 共享资源: 并发地读写共享资源，会出现数据竞争（data race）的问题，所以需要 Mutex、RWMutex 
2. 任务编排: 需要 goroutine 按照一定的规律执行，而 goroutine 之间有相互等待或者依赖的顺序关系，常常使用 WaitGroup 或者 Channel 来实现
3. 消息传递: 信息交流以及不同的 goroutine 之间的线程安全的数据交流，常常使用 Channel 来实现

我们学习这些并发原语，除了要深入学习它们的实现原理，更要搞清楚它们的使用场景，这样才能做到活学活用。

注: 并发原语和同步原语往往会同时出现，但是并发原语的通常指代的范围更大，包括任务的编排，这一点需要注意。
