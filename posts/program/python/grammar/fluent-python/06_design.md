---
weight: 1
title: "设计模式"
date: 2018-01-06T22:00:00+08:00
lastmod: 2018-01-06T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Python 中的设计模式"
featuredImage: 

tags: ["python 进阶"]
categories: ["Python"]

lightgallery: true

---

Norvig 建议在有一等函数的语言中重新审视"策略", "命令", "模板方法"和"访问者"模式;
即把实现单方法接口的类的实例替换成可调用对象, 因为每个 Python 可调用对象都实现了单方法接口，
这个方法就是 \_\_call\_\_

## 1. 重构"策略"模式
![策略模式UML](/images/fluent_python/design_strategy.png)

策略模式:
  - 定义：定义一系列算法，把它们一一封装起来，并且使它们可以相互替换。
  本模式使得算法可以独立于使用它的客户而变化
  - UML：
    - 上下文：把一些计算委托给实现不同算法的可互换组件，它提供服务 -- Order
    - 策略：实现不同算法的组件共同的接口 -- Promotion 抽象基类
    - 具体策略：策略的具体子类，实现特定的算法

### 1.1 经典策略模式示例
示例分析：
  - 每个具体策略都是一个类，而且都只定义了一个方法，即 discount
  - 策略实例没有状态（没有实例属性），它们看起来像是普通的函数


```python
# 示例 6-1　实现 Order 类，支持插入式折扣策略
from abc import ABC, abstractmethod
from collections import namedtuple

Customer = namedtuple('Customer', 'name fidelity')


class LineItem:

    def __init__(self, product, quantity, price):
        self.product = product
        self.quantity = quantity
        self.price = price

    def total(self):
        return self.price * self.quantity


class Order:  # the Context

    def __init__(self, customer, cart, promotion=None):
        self.customer = customer
        self.cart = list(cart)
        self.promotion = promotion

    def total(self):
        if not hasattr(self, '__total'):
            self.__total = sum(item.total() for item in self.cart)
        return self.__total

    def due(self):
        if self.promotion is None:
            discount = 0
        else:
            discount = self.promotion.discount(self) ## promotion 接受 order
        return self.total() - discount

    def __repr__(self):
        fmt = '<Order total: {:.2f} due: {:.2f}>'
        return fmt.format(self.total(), self.due())


class Promotion(ABC):  # the Strategy: an Abstract Base Class

    @abstractmethod
    def discount(self, order):
        """Return discount as a positive dollar amount"""


class FidelityPromo(Promotion):  # first Concrete Strategy
    """5% discount for customers with 1000 or more fidelity points"""

    def discount(self, order):
        return order.total() * .05 if order.customer.fidelity >= 1000 else 0


class BulkItemPromo(Promotion):  # second Concrete Strategy
    """10% discount for each LineItem with 20 or more units"""

    def discount(self, order):
        discount = 0
        for item in order.cart:
            if item.quantity >= 20:
                discount += item.total() * .1
        return discount


class LargeOrderPromo(Promotion):  # third Concrete Strategy
    """7% discount for orders with 10 or more distinct items"""

    def discount(self, order):
        distinct_items = {item.product for item in order.cart}
        if len(distinct_items) >= 10:
            return order.total() * .07
        return 0
```

### 1.2 重构策略模式示例
示例分析：
  - 把具体策略换成了简单的函数，而且去掉了 Promo抽象类
  - 没必要在新建订单时实例化新的促销对象，函数拿来即用

享元:
  - 定义：享元是可共享的对象，可以同时在多个上下文中使用
  - 作用：共享是推荐的做法，这样不必在每个新的上下文
  （这里是 Order 实例）中使用相同的策略时不断新建具体策略对象，从而减少消耗
  - 优化：具体策略一般没有内部状态，只是处理上下文中的数据。此时，一定要使用普
  通的函数，别去编写只有一个方法的类，再去实现另一个类声明的单函数接口。函数比用户
  定义的类的实例轻量，而且无需使用"享元"模式，因为各个策略函数在 Python 编译模块
  时只会创建一次。普通的函数也是"可共享的对象，可以同时在多个上下文中使用"

```python
# 示例 6-3 Order 类和使用函数实现的折扣策略
from collections import namedtuple

Customer = namedtuple('Customer', 'name fidelity')


class LineItem:

    def __init__(self, product, quantity, price):
        self.product = product
        self.quantity = quantity
        self.price = price

    def total(self):
        return self.price * self.quantity


class Order:  # the Context

    def __init__(self, customer, cart, promotion=None):
        self.customer = customer
        self.cart = list(cart)
        self.promotion = promotion

    def total(self):
        if not hasattr(self, '__total'):
            self.__total = sum(item.total() for item in self.cart)
        return self.__total

    def due(self):
        if self.promotion is None:
            discount = 0
        else:
            discount = self.promotion(self)  # <1>
        return self.total() - discount

    def __repr__(self):
        fmt = '<Order total: {:.2f} due: {:.2f}>'
        return fmt.format(self.total(), self.due())

# <2>

def fidelity_promo(order):  # <3>
    """5% discount for customers with 1000 or more fidelity points"""
    return order.total() * .05 if order.customer.fidelity >= 1000 else 0


def bulk_item_promo(order):
    """10% discount for each LineItem with 20 or more units"""
    discount = 0
    for item in order.cart:
        if item.quantity >= 20:
            discount += item.total() * .1
    return discount


def large_order_promo(order):
    """7% discount for orders with 10 or more distinct items"""
    distinct_items = {item.product for item in order.cart}
    if len(distinct_items) >= 10:
        return order.total() * .07
    return 0
```

### 1.3 选择最佳策略
**模块对象**：
  - 在 Python 中，模块也是一等对象
  - 模块对象的使用: <http://wiki.jikexueyuan.com/project/the-python-study-notes-second-edition/module.html>

**模块自省**：
  - globals()
    - 返回：一个字典，表示当前的全局符号表
    - 说明：这个符号表始终针对当前模块（对函数或方法来说，是指定义它们的模块，而不是调用它们的模块）
  - inspect.getmembers()
    - 作用：用于获取对象的属性
    - 参数：第二个参数是可选的判断条件（一个布尔值函数）

```python
# 示例 6-7　内省模块的全局命名空间，构建 promos 列表
promos = [globals()[name] for name in globals()  # <1>
            if name.endswith('_promo')  # <2>
            and name != 'best_promo']   # <3>

def best_promo(order):
    """Select best discount available
    """
    return max(promo(order) for promo in promos)  # <4>
```

```python
# 示例 6-8　内省单独的 promotions 模块，构建 promos 列表
# 唯一重要的是， promotions 模块只能包含计算订单折扣的函数。当然，这是对代码的隐性假设
# 可以添加更为严格的测试，审查传给实例的参数，进一步过滤函数
import promotions

promos = [func for name, func in
          inspect.getmembers(promotions, inspect.isfunction)]

def best_promo(order):
    """Select best discount available
    """
    return max(promo(order) for promo in promos)
```

## 2. 重构"命令"模式
命令模式:
  - 目的：解耦调用操作的对象（调用者）和提供实现的对象（接收者）
  - 对比：命令模式是回调机制的面向对象替代品

### 2.1 重构命令模式示例
![命令模式UML](/images/fluent_python/design_command.png)

**示例分析**：
  - 调用者：是图形应用程序中的菜单项
  - 接收者：是被编辑的文档或应用程序自身
  - 实现：
    - 在二者之间放一个 Command 对象，让它实现只有一个方法(execute)的接口，
    调用接收者中的方法执行所需的操作；
    - 调用者有一个具体的命令，通过调用 execute 方法执行
  - 优化：
    - 可以不为调用者提供一个 Command 实例，而是给它一个函数。
    - 此时，调用者不用调用command.execute()，直接调用 command() 即可
    - MacroCommand 可以实现成定义了 \_\_call\_\_ 方法的类。这样， MacroCommand 的实例
    就是可调用对象，各自维护着一个函数列表，供以后调用

**复杂命令模式替代方案**：
  1. 可调用实例，可以保存任何所需的状态，而且除了 \_\_call\_\_ 之外还可以提供其他方法
  2. 使用闭包在调用之间保存函数的内部状态

```python
# 示例 6-9 MacroCommand 的各个实例都在内部存储着命令列表
class MacroCommand:
    """一个执行一组命令的命令"""
    def __init__(self, commands):
        self.commands = list(commands) # ➊
    def __call__(self):
        for command in self.commands: # ➋
        command()
```


## 延伸阅读
### Python:
1. Python 拥有一等函数和一等类型
2. Python 还有泛函数（ 7.8.2 节）。泛函数与 CLOS 中的多方法（ multimethod）类似

### blog:
Design Patterns in Dynamic Languages ：
  - Peter Norvig 展示了如何使用一等函数（和其他动态特性）简化几个经典的设计模式，
  或者根本不需要使用设计模式
  - http://www.norvig.com/design-patterns/index.htm）
  - http://norvig.com/design-patterns/

Alex Martelli 关于 Python 设计模式的演讲
  - http://pyvideo.org/europython-2011/python-design-patterns.html
  - http://www.aleax.it/gdd_pydp.pdf

### 实用工具  

### 书籍:
《设计模式：可复用面向对象软件的基础》
  - "对接口编程，而不是对实现编程"
  - "优先使用对象组合，而不是类继承"

《 Python Cookbook（第 3 版）中文版》
  - "8.21 实现访问者模式"使用优雅的方式实现了"访问者"模式，其中的 NodeVisitor 类把方法当作一等对象处理

《Learning Python Design Patterns》

《 Python 高级编程》
  - 第 14 章"有用的设计模式"从 Python 程序员的视角介绍了 7 种经典模式

《Python 3 Patterns,Recipes and Idioms》
  - http://www.mindviewinc.com/Books/Python3Patterns/Index.php

《 Head First 设计模式》
  - 有关 java 设计模式的书

《 Ruby 设计模式》
  -
## 附注
