---
weight: 1
title: "继承"
date: 2018-01-12T22:00:00+08:00
lastmod: 2018-01-12T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Python 继承"
featuredImage: 

tags: ["python 进阶"]
categories: ["Python"]

lightgallery: true
---

本章重点
  - 子类化内置类型的缺点
  - 多重继承和方法解析顺序
  - 讨论构建类层次结构方面好的做法和不好的做法

### 1. 子类化内置类型
版本差异:
  - 在 Python 2.2 之前，内置类型（如 list 或 dict）不能子类化。
  - 在 Python 2.2 之后，内置类型可以子类化了，

**子类化内置类型**:
  - 问题: 内置类型的原生方法使用 C 语言实现，不会调用子类中覆盖的特殊方法
    1. 内置类型的特殊方法不会**隐式调用**子类覆盖的特殊方法，\_\_missing\_\_ 是个特例
    2. 类实例内部调用的其他特殊方法，如果被覆盖也不会被调用
    （self.get() 不调用 self.\_\_getitem\_\_())
  - 原因：
    - 与这些内置类型有关的任何性能问题几乎都会对其他所有代码产生重大影响
    - 于是，CPython 走了捷径，故意让内置类型的方法行为不当，即不调用被子类覆盖的方法
  - 影响:
    - 原生类型的这种行为违背了面向对象编程的一个基本原则: 始终应该从实例（self）所
    属的类开始搜索方法，即使在超类实现的类中调用也是如此
  - 解决:
    - 不要子类化内置类型，用户自己定义的类应该继承 collections 模块中的类，
    例如 UserDict、 UserList 和 UserString
    - 它们其实是对内置类型的包装，会把操作委托给内置类型
  - 参考说明: Differences between PyPy andCPython 中  Subclasses of built-in types 一节 http://pypy.readthedocs.io/en/latest/cpython_differences.html#subclasses-of-built-in-types

```python
# 内置类型的方法不会隐式调用子类覆盖的方法
>>> class DoppelDict(dict):
... def __setitem__(self, key, value):
... super().__setitem__(key, [value] * 2) # ➊
...
>>> dd = DoppelDict(one=1) # 问题1: __init__ 方法忽略了覆盖的 __setitem__ 方法
>>> dd
{'one':  1}
>>> dd['two'] = 2         # [] 运算符调用了覆盖的 __setitem__ 方法
>>> dd
{'one':  1, 'two':  [2, 2]}
>>> dd.update(three=3)    # 问题2: update 方法也没有使用覆盖的 __setitem__ 方法
>>> dd
{'three':  3, 'one':  1, 'two':  [2, 2]}
```


## 2. 多重继承和方法解析顺序
![collections.abc](/images/fluent_python/inherit_order.png)

**方法解析顺序**
  - 名称：Method Resolution Order， MRO，
  - 解析算法：C3 算法
  - \_\_mro\_\_ 类属性: 一个元组，按照方法解析顺序列出各个超类，从当前类一直向上，直到object 类

**超类方法调用**
  1. 直接调用某个超类的方法
    - 可以绕过方法解析顺序
    - 必须显式传入 self 参数，因为这样访问的是未绑定方法（unbound method）
  2. super() 函数:
    - 会遵守方法解析顺序，最安全，也不易过时
    - 调用框架或不受自己控制的类层次结构中的方法时，尤其适用

```python
class D(B, C):
    def ping(self):
        super().ping()
        print('post-ping: ', self)

> super().ping()          # Python3 中的super()函数
> super(D, self).ping()   # Python2 中的super()函数
> C.ping(self)            # 直接在类上调用实例方法时，必须显式传入 self 参数

>>> def print_mro(cls):  ➋
... print(', '.join(c.__name__ for c in cls.__mro__))
...
>>> print_mro(bool)
bool, int, object
>>> print_mro(io.BytesIO)
BytesIO, _BufferedIOBase, _IOBase, object
```


## 3. 正确构建类层次结构
### 3.1 避免把类图搅乱的建议
1. 把接口继承和实现继承区分开
  - 继承接口: 创建子类型，实现"是什么"关系，是框架的支柱
  - 继承实现: 通过重用避免代码重复，是实现细节，通常可以换用组合和委托模式
2. 使用抽象基类显式表示接口
  - 如果类的作用是定义接口，应该明确把它定义为抽象基类
3. 通过混入重用代码
  - 如果一个类的作用是为多个不相关的子类提供方法实现，从而实现重用，但不体现"是什么"关系，
  应该把那个类明确地定义为混入类（mixin class）
  - 混入不定义新类型，只是打包方法，便于重用
  - 混入类绝对不能实例化，而且具体类不能只继承混入类。混入类应该提供某方面的特定行为，
  只实现少量关系非常紧密的方法
4. 在名称中明确指明混入
  - 在混入类名称中加入 ...Mixin后缀
5. 抽象基类可以作为混入， 反过来则不成立
  - 抽象基类:
    - 可以定义类型，作为其他类的唯一基类
    - 可以实现具体方法，因此可以作为混入使用
    - 但实现的具体方法只能与抽象基类及其超类中的方法协作，因此只是一种便利措施
  - 混入类: 不能定义类型，不能作为唯一的超类，除非继承另一个更具体的混入——很少这样做
6. 不要子类化多个具体类
  - 具体类的超类中最多只能有一个具体超类，其余的都应该是抽象基类或混入
7. 为用户提供聚合类
  - 定义: 如果一个类的结构主要继承自混入，自身没有添加结构或行为，那么这样的类称为聚合类
  - 作用: 打包有用的服务，便于用户使用
8. 优先使用对象组合， 而不是类继承
  - 优先使用对象组合，通过委托使用相关方法，实现代码复用
  - 因为子类化是一种紧耦合，而且较高的继承树容易倒
  - 附注: 组合和委托可以代替混入，把行为提供给不同的类，但不能取代接口继承去定义类型层次结构

### 3.2 Django通用视图中的混入
**Django 视图**:
  - 视图: 可调用的对象，参数是表示 HTTP 请求的对象，返回值是一个表示 HTTP 响应的对象
  - 视图实现:
    - 通用视图:
      - Django 提供的一系列函数，实现常见的用例
      - 缺点是函数不能扩展，如果需求与列表视图相似但不完全一样，那么不得不自己从头实现
    - 基于类的视图:
      - 通过基类、混入和拿来即用的具体类提供了可扩展的视图逻辑
  - 附注: http://ccbv.co.uk  -- Django 类层次结构详解
  - 优点: 混入类易于理解，各个混入的目的明确，而且名称的后缀都是 ...Mixin

**Django 类视图展示**
![collections.abc](/images/fluent_python/inherit_django.png)
  - View 是所有视图（可能是个抽象基类）的基类，提供核心功能
  - View 的具体子类应该实现处理方法，但它们为什么不在 View 接口中呢？原因是: 子类只
  需实现它们想支持的处理方法
  - TemplateResponseMixin 提供的功能只针对需要使用模板的视图

![collections.abc](/images/fluent_python/inherit_django_list.png)
  - ListView 聚合类，不含任何代码
  -  ListView 实例有个 object_list 属性，模板会迭代它显示页面的内容
  - 生成这个可迭代对象列表的相关功能由 MultipleObjectMixin 提供。这个混入还提供了分页逻辑


## 延伸阅读
### Python:


### blog:
Python’s Super is nifty, but you can’t use it
  - https://fuhm.net/super-harmful/

Python’s super() considered super!
  - https://rhettinger.wordpress.com/2011/05/26/super-considered-super/
  - 从积极的角度解说了 Python 的 super 和多重继承的运作原理
  - 也是对上文的一个回应

Setting Multiple Inheritance Straight
  - http://www.artima.com/weblogs/viewpost.jsp?thread=246488
  - 实现了性状（trait），这是一种受限的混入

Simionato 写的有关Python 多继承的文章
  - "The wonders of cooperative inheritance, or using super in Python 3"  
    - http://www.artima.com/weblogs/viewpost.jsp?thread=281127）
  - "Mixinsconsidered harmful"
    - 第一部分 http://www.artima.com/weblogs/viewpost.jsp?thread=246341
    - 第二部分 http://www.artima.com/weblogs/viewpost.jsp?thread=246483
  - "Things to KnowAbout Python Super"
    - 第一部分 http://www.artima.com/weblogs/viewpost.jsp?thread=236275
    - 第二部分 http://www.artima.com/weblogs/viewpost.jsp?thread=236278
    - 第三部分 http://www.artima.com/weblogs/viewpost.jsp?thread=237121

### 实用工具  
GUI 编程
  - Tkinter 和 Tcl/Tk
  - Python 3.1提供的 tkinter.ttk 包

### 书籍:
《面向对象分析与设计（第 3 版）》

## 附注
**哪些类是真正需要的**
  - 编写应用程序时，我们通常不用设计类的层次结构。我们至多会编写子类、
  继承抽象基类或框架提供的其他类
  - 作为应用程序开发者，我们极少需要编写作为其他类的超类的类

**内置类型**
  - 与这些内置类型有关的任何性能问题几乎都会对其他所有代码产生重大影响。于是， CPython 走了
捷径，故意让内置类型的方法行为不当，即不调用被子类覆盖的方法
  - 解决这一困境的可能方式之一是，为这些类型分别提供两种实现: 一种供内部使用，为解释器做了
优化；另一种供外部使用，便于扩展
  - 我们也要在自己的应用程序中使用做了优化但是难以子类化的实现

**其他语言对继承的支持**
  - C++:  是第一门实现多重继承的流行语言，但是这一功能被滥用了
  - Java:
    - 意欲取代 C++的 Java 不支持多重继承
    - Java 8 引入了默认方法，这使得接口与 C++ 和 Python 用于定义接口的抽象类十分相似
    - 但是它们之间有个关键的区别: Java 的接口没有状态
  -  Scala:
    - 实现了性状，
    - 支持性状的其他语言还有最新稳定版 PHP 和 Groovy，以及正在开发的 Rust 和Perl 6
    - 因此可以说，性状是目前的趋势
  - Ruby:
    - 对多重继承的态度很明确: 对其不支持，但是引入了混入
    -  Ruby 类的定义体中可以包含模块，这样模块中定义的方法就变成了类实现的一部分。
    这是"纯粹"的混入，不涉及继承，因此 Ruby 混入显然不会影响所在类的类型
  - GO: 完全不支持继承，但是它实现的接口与静态鸭子类型相似
  - Julia:
    - 有类型层次结构，但是子类型不能继承结构，只能继承行为，
    - 而且只能为抽象类型创建子类型。此外， Julia 的方法使用多重分派
