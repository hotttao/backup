---
title: 1 Go 设计模式
date: 2021-01-01
categories:
    - Go
tags:
	- Go设计模式
	- 入门指南
---

这个系列是 Go 语言设计模式的系列，掌握如何使用编程语言实现 23 种常见设计模式是精通一门语言的"捷径"。这个系列我们就来学习 Go 设计模式的最佳实践。

<!-- more -->

## 1. 学习资料
到目前为止为了学习设计模式，我已经看过不少的书和视频，其中我觉得很好的有下面这些:
1. [王铮老师在极客时间的专栏-设计模式之美](https://time.geekbang.org/column/intro/250): 以 Java 为基础，非常详细的讲解了设计模式和编程设计思想的方方面面
2. [JavaScript设计模式与开发实践](https://book.douban.com/subject/26382780/): JavaScript 如何实现常见的设计模式
3. [耗子哥博客系列](https://coolshell.cn/articles/21128.html)
4. [深入设计模式](https://refactoringguru.cn/design-patterns)

目前还没找到一本专门讲解 Go 设计模式的书，网上包括 github 虽然有不少人已经将 23 中设计模式使用 Go 总结实现了一遍，但基本上都是照"葫芦画瓢"，看不出实现方式与其他语言有什么不同。

这个系列的目的就是为了收集 Go 语言设计模式中的最佳实践，写出更优雅的 Go 代码。