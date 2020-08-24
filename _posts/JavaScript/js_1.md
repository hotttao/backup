---
title: 1 JavaScript 入门开篇
date: 2020-08-06
categories:
    - 前端
tags:
	- JavaScript
	- 入门指南
---

要学的东西很多，其中有个叫 JavaScript

<!-- more -->

![JavaScript](/images/JavaScript/JavaScript.png)


## 1. 为什么要学 JavaScript
Web 开发一直是自己的“魔怔”，从转行做开发开始就一直想做 Web 开发，直到现在也不算入门。正好最近想做一个炒股软件，把自己的一些验证想法实现出来，正好借此机会学习一下前端开发。

## 2. 前端开发的技术栈
JavaScript 与我之前学习的 Go 和 Python 还不一样，HTML、CSS 和 JavaScript 是密切相关的。在我们学习JavaScript 之前有必要去了解它们之间的关系。下面是一段 HTML 代码:

```html
<!DOCTYPE html>
<html>

<head>
  <meta charset="UTF-8">
  <title>Data Structures and Algorithms with JavaScript</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">
  <link rel="stylesheet" href="https://code.getmdl.io/1.3.0/material.indigo-pink.min.css">
  <script defer src="https://code.getmdl.io/1.3.0/material.min.js"></script>
  <base target="myFrame" />
  <style>
    .mdl-layout__content {
      padding: 10px;
    }

    .mdl-layout__drawer {
      width: 290px;
    }
  </style>
</head>

<body>
  <!-- Simple header with scrollable tabs. -->
  <div class="mdl-layout mdl-js-layout mdl-layout--fixed-header">
    <header class="mdl-layout__header">
      <div class="mdl-layout__header-row">
        <!-- Title -->
        <span class="mdl-layout-title">Learning JavaScript Data Structures and Algorithms</span>
      </div>
      <!-- Chapters -->
      <div class="mdl-layout__tab-bar mdl-js-ripple-effect">
        <a href="#scroll-tab-1" class="mdl-layout__tab is-active">01_02</a>
        <a href="#scroll-tab-3" class="mdl-layout__tab">03</a>
      </div>
    </header>
  </div>
</body>
```

HTML、CSS 和 JavaScritp 通过如下的方式结合在一起:
1. HTML: 
	- 静态网页，Web 展示的具体的内容
	- 浏览器在读取完 HTML 代码之后，会将其加载成 DOM 树
	- DOM: 文档对象模型，提供了访问和操作网页的方法和接口
2. CSS:
	- 通过 CSS 选择器选择 HTML 中的特定标签为其添加样式(布局，颜色和格式)
	- CSS 选择器是浏览器提供了声明式查询语言，用于选择页面的特定节点
	- CSS 通过 `<link>` 和 `<style>` 标签插入到 HTML 中
3. JavaScript:
	- 动态网页通过 JavaScript 实现动态交互部分
	- 包括语言、文档对象模型(DOM)和浏览器对象模型(BOM)三个部分
		- 语言: JavaScript 作为编程语言的部分
		- DOM: 提供访问和操作网页内容的方法和接口
		- BOM: 提供与浏览器交互的方法和接口
	- JavaScript 通过 `<script>` 标签插入到HTML页面中


## 3. 怎么学 JavaScript
JavaScript 在标准化的过程经历过很多次变化，目前主要以 ES6 为主。我们主要学习 JavaScript 的语言部分，BOM 和 DOM 在现在的诸如 Vue 等高级框架中都有更高级的抽象来解决不同浏览器的差异问题。

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
5. 函数
6. 基于原型的面向对象开发

## 4. 学习资料
ES6 标准出来之后 JS 的语法变动很大，市面上的大多数书籍集中于介绍这些差异，看了不少本书的前序和目录，最后决定选择以下基本详细阅读:
1. [《JavaScript高级程序设计（第3版）》](https://book.douban.com/subject/10546125/): 学习 JS 的基本语法(ES5)
2. [《学习JavaScript数据结构与算法（第3版）》](https://book.douban.com/subject/33441631/): 学习 JS 如何实现常见的数据结构与算法
3. [《JavaScript设计模式与开发实践》](https://book.douban.com/subject/26382780/): 学习 JS 如何实现常见的设计模式


## 5. 环境搭建
### 5.1 Chrom Web Serve
为了便于执行 JS，我们需要一台Web服务器。如果不需要请求后台接口，我们可以在Chrome 安装一个简单的Web服务器，叫做[Web Server for Chrome的扩展](https://chrome.google.com/webstore/detail/web-server-for-chrome/ofhbbkphhbklhfoeikjpcbhemlocgigb?hl=zh-CN),安装好之后，可以在浏览器地址栏中输入chrome://apps来找到它。

打开Web Server扩展后，可以点击CHOOSE FOLDER来选择需要在哪个文件夹中开启服务器，默认的IP和端口是 http://127.0.0.1:8887。

### 5.2 Vscode 调试工具配置
要直接在VSCode中调试JavaScript或ECMAScript代码，首先需要安装Debugger for Chrome扩展。然后，启动Web Server for Chrome扩展，并在浏览器中打开待调试的代码。下图展示了如何直接在 VScode 中进行调试。

![debug_in_vscode](/images/JavaScript/js_debug.png)
