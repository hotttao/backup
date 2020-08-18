---
title: 1 JavaScript 入门开篇
date: 2020-08-06
categories:
    - Go
tags:
	- JavaScript 入门
	- 入门指南
series: JavaScript 入门
---

要学的东西很多，其中有个叫 JavaScript

<!-- more -->

![JavaScript](/images/JavaScript/JavaScript.png)


## 1. 为什么要学 JavaScript
Web 开发一直是自己的“魔怔”，从转行做开发开始就一直想做 Web 开发，直到现在也不算入门，所以想好好学习一番，正好最近想做一个炒股软件。

## 2. 怎么学 JavaScript
有了前面学习 Python 和 Go 的经历，通过学习下面的知识我们可以快速的学习一门语言的语法:
1. 变量、数值类型和流控，包括
	- 变量及常量的命名，声明和创建
	- 基础数据类型
	- 自定义类型
	- 类型转换
	- 条件判断和循环
	- 变量的生命周期与作用域
2. 基础数据类型的使用
3. 模块和包
4. 异常处理
5. 函数，类与泛型
6. 协程
7. 标准库

## 3. 学习资料
ES6 标准出来之后 JS 的语法变动很大，市面上的大多数书籍集中于介绍这些差异，看了不少本书的前序和目录，最后决定选择以下基本详细阅读:
1. [《JavaScript高级程序设计（第3版）》](https://book.douban.com/subject/10546125/): 学习 JS 的基本语法(ES5)
2. [《学习JavaScript数据结构与算法（第3版）》](https://book.douban.com/subject/33441631/): 学习 JS 如何实现常见的数据结构与算法
3. [《JavaScript设计模式与开发实践》](https://book.douban.com/subject/26382780/): 学习 JS 如何实现常见的设计模式


## 4. 环境搭建
### 4.1 Chrom Web Serve
为了便于执行 JS，我们需要一台Web服务器。如果不需要请求后台接口，我们可以在Chrome 安装一个简单的Web服务器，叫做[Web Server for Chrome的扩展](https://chrome.google.com/webstore/detail/web-server-for-chrome/ofhbbkphhbklhfoeikjpcbhemlocgigb?hl=zh-CN),安装好之后，可以在浏览器地址栏中输入chrome://apps来找到它。

打开Web Server扩展后，可以点击CHOOSE FOLDER来选择需要在哪个文件夹中开启服务器，默认的IP和端口是 http://127.0.0.1:8887。

### 4.2 Vscode 调试工具配置
要直接在VSCode中调试JavaScript或ECMAScript代码，首先需要安装Debugger for Chrome扩展。然后，启动Web Server for Chrome扩展，并在浏览器中打开待调试的代码。下图展示了如何直接在 VScode 中进行调试。

![debug_in_vscode](/images/JavaScript/js_debug.png)


