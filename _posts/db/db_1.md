---
title: 1. 构建数据密集型应用
date: 2019-04-01
categories:
    - 分布式
tags:
    - 数据密集型应用
---

《构建数据密集型应用》读书笔记

<!-- more -->

## 1. 写在开始
2014 年我开始自学编程的时候，在各种培训机构的课程里 Mysql 几乎还是唯一的数据库系统。现如今每一个工程师可能都听过 NoSQL，hadoop，Elasticsearch。"大数据"已经成为了几乎所有公司看中的技能。

然后当我尝试去学习所谓的"大数据"时，却只能用不知所措去形容我所面临的处境。到处都是有关大数据的零散知识点(诸如CAP, Paxos,Mapreduce)，以及无处不在推荐的 Google 三大论文。很难弄清楚充斥在这些文章中的专业术语到底是什么含义。

显然对于相我这样的初学者，需要有一本系统的书来帮我们搭建起“大数据”学习的知识框架。而[《构建数据密集型应用》](https://book.douban.com/subject/30329536/)正是我梦寐以求的书。

我想我也无需去吹赞这本书，只想把他推荐给需要的人。好记性不如烂笔头，这个系列的博客就是《构建数据密集型应用》的读书笔记。

## 2. 本书结构
什么是数据密集型应用，一个应用，如果数据是其主要挑战**(数据量，数据复杂度和数据变化速度)** ，它就被称为数据密集型应用。本书就是围绕应用中的数据问题展开的，分为如下三个部分：

![big data](/images/db/db_frame.jpg)


#### 1. 第一部分
讨论了设计数据密集型应用所赖的基本思想。这些事数据系统底层的基础概念，无论是在单台机器上运行的单点数据系统，还是分布在多台机器上的分布式数据系统都适用:
- 第一章: 介绍应用设计的目标。可靠性，可扩展性和可维护性 ，这些词汇到底意味着什么，如何实现这些目标
- 第二章: 将对几种不同的数据模型和查询语言进行比较。从程序员的角度看，这是数据库之间最明显的区别。不同的数据模型适用于不同的应用场景
- 第三章: 将深入存储引擎内部，研究数据库如何在磁盘上摆放数据。不同的存储引擎针对不同的负载进行优化，选择合适的存储引擎对系统性能有巨大影响
- 第四章: 将对几种不同的 数据编码进行比较。特别研究了这些格式在应用需求经常变化、模式需要随时间演变的环境中表现如何

#### 2. 第二部分
我们从讨论存储在一台机器上的数据转向讨论分布在多台机器上的数据。这对于可扩展性通常是必需的，但带来了各种独特的挑战。我们首先讨论复制（ 第5章） ，分区/分片（ 第6章） 和事务（ 第7章） 。然后我们将探索关于分布式系统问题的更多细节（ 第8章） ，以及在分布式系统中实现一致性与共识意味着什么（ 第9章） 。

#### 3. 第三部分
我们讨论那些从其他数据集衍生出一些数据集的系统。衍生数据经常出现在异构系统中：当没有单个数据库可以把所有事情都做的很好时，应用需要集成几种不同的数据库，缓存，索引等。在第10章中我们将从一种衍生数据的批处理方法开始，然后在此基础上建立在第11章中讨论的流处理。最后，在第12章中，我们将所有内容汇总，讨论在将来构建可靠，可伸缩和可维护的应用程序的方法。

## 3. 资源收录
除了内容外，本书还引用了大量的论文，博客，这些都是扩展学习非常好的学习资料。下面是与本书相关的学习资源:
1. [书中引用持续维护的github仓库](https://github.com/ept/ddia-references)
2. [原著的开源翻译版本](https://vonng.gitbooks.io/ddia-cn/content/)，对于英文不好的同学真是福音
3. [耗子叔](https://www.coolshell.cn/)在极客时间的专栏[左耳听风](https://time.geekbang.org/column/intro/48)，《构建数据密集型应用》是这个专栏推荐的书，也推荐这个专栏。
4. [可扩展的Web架构和分布式系统](http://nettee.github.io/posts/2016/Scalable-Web-Architecture-and-Distributed-Systems/)
