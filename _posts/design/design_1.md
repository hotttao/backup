---
title: 1 设计模式入门开篇
date: 2020-10-01
categories:
    - 前端
tags:
	- 设计模式
	- 入门指南
---

这个系列是设计模式的系列，掌握如何使用编程语言实现 23 种常见设计模式是精通一门语言的"捷径"。那么这个系列我们就以 JavaScript 和 Go 为例来看，这两种经典的动态和静态语言都是如何实现常见的设计模式的。

<!-- more -->

## 1. 学习资料
到目前为止为了学习设计模式，我已经看过不少的书和视频，其中我觉得很好的有下面这些:
1. [王铮老师在极客时间的专栏-设计模式之美](https://time.geekbang.org/column/intro/250): 以 Java 为基础，非常详细的讲解了设计模式和编程设计思想的方方面面
2. [JavaScript设计模式与开发实践](https://book.douban.com/subject/26382780/): JavaScript 如何实现常见的设计模式
3. [B站面向加薪学习的 Go 设计模式](https://www.bilibili.com/video/BV1GD4y1D7D3): 用 Go 实现了常见的设计模式
4. 4. [深入设计模式](https://refactoringguru.cn/design-patterns)：这是一本包含了各种语言23种常见设计模式实现的一本书，很值得参考

我也看过[设计模式](https://book.douban.com/subject/1052241/)，当初完全没接触过设计模式，看这本书完全是懵逼的，看完了也就忘记了。个人建议如下的学习路线:
1. 首先是先跟着王铮老师的专栏，系统的学习设计模式以及其中包含的各种设计原则和编程思想
2. 然后读一读《JavaScript设计模式与开发实践》，这本书在开头对比了静态语言跟动态语言在实现设计模式上的差异，并举例介绍了 JavaScript 如何实现常见的设计模式
3. 最后结合 Go 如何实现设计模式，并与 JavaScript 进行对比

希望经过这个系列，大家可以详细掌握设计模式，并对 JavaScript 和 Go 有一个更深入的理解。接下来我们会详细介绍如何使用 JavaScript 和 Go 语言实现常见的 23 中设计模式，但是设计模式与面向对象所包含的定义，设计思想不在讲述的范围，这些内容是需要反复阅读上面的学习资料，思考体会。

### 2. 内容概述
常用的 23 中设计模式主要分为:
1. 创建型模式
	- 简单工厂模式（Simple Factory）
	- 工厂方法模式（Factory Method）
	- 抽象工厂模式（Abstract Factory）
	- 创建者模式（Builder）
	- 原型模式（Prototype）
	- 单例模式（Singleton）
2. 结构型模式
	- 外观模式（Facade）
	- 适配器模式（Adapter）
	- 代理模式（Proxy）
	- 组合模式（Composite）
	- 享元模式（Flyweight）
	- 装饰模式（Decorator）
	- 桥模式（Bridge）
3. 行为型模式
	- 中介者模式（Mediator）
	- 观察者模式（Observer）
	- 命令模式（Command）
	- 迭代器模式（Iterator）
	- 模板方法模式（Template Method）
	- 策略模式（Strategy）
	- 状态模式（State）
	- 备忘录模式（Memento）
	- 解释器模式（Interpreter）
	- 职责链模式（Chain of Responsibility）
	- 访问者模式（Visitor）

我们大致上会按照上面的次序依次讲解各个设计模式的实现。