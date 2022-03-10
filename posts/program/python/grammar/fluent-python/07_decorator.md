---
weight: 1
title: "函数装饰器和闭包"
date: 2018-01-07T22:00:00+08:00
lastmod: 2018-01-07T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Python 的函数装饰器和闭包"
featuredImage: 

tags: ["python 进阶"]
categories: ["Python"]

lightgallery: true

---

函数装饰器: 用于在源码中“标记”函数，以某种方式增强函数的行为
闭包: 函数装饰器，回调式异步编程，函数式编程风格的基础

## 1. 装饰器基础
### 1.1 装饰器简介
语法:
  - 装饰器是可调用的对象，其参数是另一个函数(被装饰的函数)

作用:
  - 可能会处理被装饰的函数，然后把它返回
  - 或者将其替换成另一个函数或可调用对象

使用:
  - 装饰器通常在一个模块中定义，然后应用到其他模块中的函数上
  - 大多数装饰器会在内部定义一个函数，然后将其返回

```python
# 以下两种写法的最终结果一样
@decorate
def target():
    print('running target()')

def target():
    print('running target()')
target = decorate(target)
```

### 1.2 装饰器执行
装饰器: 通常是在导入时，在被装饰的函数定义之后立即运行  -- 导入时

被装饰函数: 只在明确调用时运行  -- 运行时

### 1.3 使用装饰器改进“策略”模式
```Python
# 示例 7-3 promos 列表中的值使用 promotion 装饰器填充
promos = []  # <1>

def promotion(promo_func):   # <2>
    promos.append(promo_func)
    return promo_func

@promotion  # <3>
def fidelity(order):
    """5% discount for customers with 1000 or more fidelity points"""
    return order.total() * .05 if order.customer.fidelity >= 1000 else 0

@promotion
def bulk_item(order):
    """10% discount for each LineItem with 20 or more units"""
    discount = 0
    for item in order.cart:
        if item.quantity >= 20:
            discount += item.total() * .1
    return discount

def best_promo(order):   # <4>
    """Select best discount available
    """
    return max(promo(order) for promo in promos)
```


## 2. 变量作用域
```python
>>> def f2(a):
...     print(a)
...     print(b)
...     b = 9
...
>>> f2(3)
3
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "<stdin>", line 3, in f2
UnboundLocalError:  local variable 'b' referenced before assignment

>>> from dis import dis
>>> dis(f2) # 生成的字节码
```

作用域确定:
  - Python 编译函数的定义体时，会将 b 判定为局部变量，因为在它在函数体中赋值
  - 这不是缺陷，而是设计选择: Python 不要求声明变量，但假定在函数定义体中赋值的变量是局部变量

dis 模块
  - 作用: 为反汇编 Python 函数字节码提供了简单的方式
  - 文档:  http://docs.python.org/3/library/dis.html


## 3. 闭包  
![闭包](/images/fluent_python/decorator_closure.png)

```python
>>> avg = make_averager()
>>> avg.__code__.co_varnames
('new_value', 'total')
>>> avg.__code__.co_freevars
('series',)

>>> avg.__closure__
(<cell at 0x107a44f78:  list object at 0x107a91a48>,)
>>> avg.__closure__[0].cell_contents
[10, 11, 12]
```
**自由变量**(free variable):
  - 指未在本地作用域中绑定的变量

**闭包**:
  - 定义:
    - 闭包指延伸了作用域的函数，其中包含在函数定义体中引用、但是不在定义体中定义的非全局变量
    - 函数是不是匿名的没有关系，关键是它能访问定义体之外定义的非全局变量
  - 原理:
    - 闭包是一种函数，它会保留定义函数时，存在的自由变量的绑定
    - 这样调用函数时，虽然定义作用域不可用了，但是仍能使用那些绑定
    - \_\_code\_\_ 属性: 表示编译后的函数定义体
    - \_\_code\_\_.co_freevars: 保存着自由变量的名称
    - \_\_closure\_\_属性: cell 对象的列表，表示自由变量，一一对应于 co_freevars
    - cell.co_freevars: 保存着自由变量真正的值

### 4. 作用域转换
global var: 把局部变量转换为全局变量  
nonlocal var: 把变量标记为自由变量

```python
def make_averager():
    count = 0
    total = 0

    def averager(new_value):
        # nonlocal count, total
        count += 1
        total += new_value
        return total / count

    return averager

>>> avg = make_averager()
>>> avg(10)
Traceback (most recent call last):
...
UnboundLocalError:  local variable 'count' referenced before assignment
```
说明:
  - 当 count 是数字或任何不可变类型时， (count += 1) == (count =count + 1)
  - count=count+1，会隐式创建局部变量 count, count 就不是自由变量，因此不会保存在闭包中
  - 为了解决这个问题， Python 3 引入了 nonlocal 声明。它的作用是把变量标记为自由变量
  - Python 2处理方式: PEP 3104—Access to Names in Outer Scopes


## 5. 装饰器进阶
装饰器典型行为:
  - 把被装饰的函数替换成新函数，二者接受相同的参数，
  - 通常返回被装饰的函数本该返回的值，同时还会做些额外操作
  - 即动态地给一个对象添加一些额外的职责

装饰器实现:
  1. 函数装饰器
  2. 通过实现 \_\_call\_\_ 方法的类实现 -- 最佳方式
  3. 构建工业级装饰器的技术， 参见Graham Dumpleton 的博客和 wrapt 模块

装饰器扩展模块
1. wrapt:
  - 文档: http://wrapt.readthedocs.org/en/latest/
  - 作用:
    - 简化装饰器和动态函数包装器的实现，即使多层装饰也支持内省，
    - 而且行为正确，既可以应用到方法上，也可以作为描述符使用

2. decorator
    - 文档:  http://pypi.python.org/pypi/decorator
    - 作用: 简化普通程序员使用装饰器的方式，并且通过各种复杂的示例推广装饰器

装饰器用法：
1. Graham Dumpleton
  - 写了一系列博客文章，深入剖析了如何实现行为良好的装饰器 http://github.com/GrahamDumpleton/wrapt/blob/develop/blog/README.md

2. Python Decorator Library 维基页面
  - http://wiki.python.org/moin/PythonDecoratorLibrary

3. Guido van Rossum
  - Five-Minute Multimethods in Python
    - 详细说明了如何使用装饰器实现泛函数（也叫多方法）
    -  http://www.artima.com/weblogs/viewpost.jsp?thread=101605

### 5.1 简单装饰器

```python
import time
import functools

def clock(func):
    @functools.wraps(func)
    def clocked(*args, **kwargs):
        t0 = time.time()
        result = func(*args, **kwargs)
        elapsed = time.time() - t0
        name = func.__name__
        arg_lst = []
        if args:
            arg_lst.append(', '.join(repr(arg) for arg in args))
        if kwargs:
            pairs = ['%s=%r' % (k, w) for k, w in sorted(kwargs.items())]
            arg_lst.append(', '.join(pairs))
        arg_str = ', '.join(arg_lst)
        print('[%0.8fs] %s(%s) -> %r ' % (elapsed, name, arg_str, result))
        return result
    return clocked
```

functools.wraps 装饰器
  - 作用: 把 func 的 \_\_name\_\_ 和 \_\_doc\_\_ 等相关属性复制到 clocked 中

### 5.2 标准库中的装饰器
**functools.lru_cache(maxsize, typed)**:
  - 作用: 备忘(memoization)功能，把耗时的函数的结果保存起来，避免传入相同的参数时重复计算
  - lru: Least Recently Used 的缩写，表明缓存不会无限增长，一段时间不用的缓存条目会被扔掉
  - 参数:
    - maxsize: 指定存储多少个调用的结果,为了得到最佳性能， maxsize 应该设为 2 的幂
    - typed:=True，把不同参数类型得到的结果分开保存，即把通常认为相等的浮点数和整数参数区分开
  - 应用:
    - 优化递归算法
    - 在从 Web 中获取信息的应用中也能发挥巨大作用
  - 附注: 因为 lru_cache 使用字典存储结果，而且键根据调用时传入的定位参数和关键字参数创建，
  所以被 lru_cache 装饰的函数，它的所有参数都必须是可散列的

```python
import functools

from clockdeco import clock

@functools.lru_cache() #  lru_cache 可以接受配置参数
@clock                 # @lru_cache() 应用到 @clock 返回的函数上
def fibonacci(n):
    if n < 2:
        return n
    return fibonacci(n-2) + fibonacci(n-1)

if __name__=='__main__':
    print(fibonacci(6))
```

**functools.singledispatch**:
  - 作用: 将普通函数变成泛函数(generic function),
  - 泛函数: 根据第一个参数的类型，以不同方式执行相同操作的一组函数
  - 特性:
    - 可以在系统的任何地方和任何模块中注册专门函数
    - 如果后来在新的模块中定义了新的类型，可以轻松地添加一个新的专门函数来处理那个类型
    - 还可以为不是自己编写的或者不能修改的类添加自定义函数
  - 文档:  http://www.python.org/dev/peps/pep-0443/
  - 版本:
    - python34: functools.singledispatch
    - python<34: singledispatch包
  - 特性对比:
    - Python 不支持 **重载方法或函数**，所以不能使用不同的签名定义函数的变体，
  也无法使用不同的方式处理不同的数据类型
    - @singledispatch 不是为了把 Java 的那种方法重载带入 Python
    - 在一个类中为同一个方法定义多个重载变体，比在一个函数中使用一长串
    if/elif/elif/elif 块要更好
    - 但是这两种方案都有缺陷，因为它们让代码单元（类或函数）承担的职责太多
    - @singledispath 的优点是支持模块化扩展: 各个模块可以为它支持的各个类型注册一个专门函数

```python
from functools import singledispatch
from collections import abc
import numbers
import html

@singledispatch ➊  #  @singledispatch 标记处理 object 类型的基函数
def htmlize(obj):
    content = html.escape(repr(obj))
    return '<pre>{}</pre>'.format(content)

@htmlize.register(str) ➋ # 各个专门函数使用 @«base_function».register(«type») 装饰
def _(text):  ➌
    content = html.escape(text).replace('\n', '<br>\n')
    return '<p>{0}</p>'.format(content)

@htmlize.register(numbers.Integral) ➍ # numbers.Integral 是 int 的虚拟超类
def _(n):
    return '<pre>{0} (0x{0: x})</pre>'.format(n)

@htmlize.register(tuple) ➎ # 可以叠放多个 register 装饰器，让同一个函数支持不同类型
@htmlize.register(abc.MutableSequence)
def _(seq):
    inner = '</li>\n<li>'.join(htmlize(item) for item in seq)
    return '<ul>\n<li>' + inner + '</li>\n</ul>'
```
分析:
  - ➊ @singledispatch 标记处理 object 类型的基函数
  - ➋ 各个专门函数使用 @«base_function».register(«type») 装饰
  - ➍ 为每个需要特殊处理的类型注册一个函数, numbers.Integral 是 int 的虚拟超类
  - ➎ 可以叠放多个 register 装饰器，让同一个函数支持不同类型
  - 只要可能，注册的专门函数应该处理抽象基类（如 numbers.Integral，abc.MutableSequence）
  不要处理具体实现（如 int 和 list）。这样，代码支持的兼容类型更广泛

### 5.3 叠放装饰器
```python
@d1
@d2
def f():
    print('f')

#等同于
def f():
    print('f')

f = d1(d2(f))
```

### 5.4 参数化装饰器
实现方式:
  - 创建一个 **装饰器工厂函数**，把参数传给它，
  - 返回一个装饰器，然后再把它应用到要装饰的函数上

#### 示例1: 一个参数化的注册装饰器
```python
# 示例 7-23 为了接受参数，新的 register 装饰器必须作为函数调用
registry = set()  # set 对象，这样添加和删除函数的速度更快

def register(active=True):
    def decorate(func):   # 内部函数是真正的装饰器；注意，它的参数是一个函数
        print('running register(active=%s)->decorate(%s)'
              % (active, func))
        if active:
            registry.add(func)
        else:
            registry.discard(func)

        return func  #  decorate 是装饰器，必须返回一个函数
    return decorate  #  register 是装饰器工厂函数，因此返回 decorate

@register(active=False)  # @register 工厂函数必须作为函数调用，并且传入所需的参数
def f1():
    print('running f1()')

@register()  #  即使不传入参数， register 也必须作为函数调用
def f2():
    print('running f2()')

>>> from registration_param import *
>>> register()(f3)
>>> register(active=False)(f2)
```

#### 示例2: 参数化clock装饰器
```python
import time

DEFAULT_FMT = '[{elapsed: 0.8f}s] {name}({args}) -> {result}'

def clock(fmt=DEFAULT_FMT):   
    def decorate(func):       
        def clocked(*_args):
            t0 = time.time()
            _result = func(*_args)
            elapsed = time.time() - t0
            name = func.__name__
            args = ', '.join(repr(arg) for arg in _args)  
            result = repr(_result)
            # 使用 **locals() 是为了在 fmt 中引用 clocked 的局部变量
            print(fmt.format(**locals()))
            return _result  
        return clocked
    return decorate  

if __name__ == '__main__':

    @clock()  # <11>
    def snooze(seconds):
        time.sleep(seconds)

    for i in range(3):
        snooze(.123)
```

#### 示例3: 通过实现\_\_call\_\_方法的类实现装饰器
```python
# BEGIN CLOCKDECO_CLS
import time

DEFAULT_FMT = '[{elapsed: 0.8f}s] {name}({args}) -> {result}'

class clock:

    def __init__(self, fmt=DEFAULT_FMT):
        self.fmt = fmt

    def __call__(self, func):
        def clocked(*_args):
            t0 = time.time()
            _result = func(*_args)
            elapsed = time.time() - t0
            name = func.__name__
            args = ', '.join(repr(arg) for arg in _args)
            result = repr(_result)
            print(self.fmt.format(**locals()))
            return _result
        return clocked
```

## 6. 泛函数用法
### 6.1 单分派泛函数
原理解析：
  - 文档:  http://www.python.org/dev/peps/pep-0443/
  - 文档说明：对单分派泛函数的基本原理和细节做了说明

使用示例：
  - Guido van Rossum 写的博客 Five-Minute Multimethods in Python，
  详细说明了如何使用装饰器实现泛函数（也叫多方法）
  - http://www.artima.com/weblogs/viewpost.jsp?thread=101605

### 6.2 泛函数扩展模块
Reg
  - 文档: http://reg.readthedocs.io/en/latest/
  - 作用: 使用现代的技术实现多分派泛函数，并支持在生产环境中使用

## 延伸阅读
### Python:
wrapt:
  - 文档: http://wrapt.readthedocs.org/en/latest/
  - 作用:
    - 简化装饰器和动态函数包装器的实现，即使多层装饰也支持内省，
    - 而且行为正确，既可以应用到方法上，也可以作为描述符使用

decorator
  - 文档:  http://pypi.python.org/pypi/decorator
  - 作用: 简化普通程序员使用装饰器的方式，并且通过各种复杂的示例推广装饰器

单分派泛函数
  - 文档:  http://www.python.org/dev/peps/pep-0443/
  - 文档说明：对单分派泛函数的基本原理和细节做了说明

Reg
  - 文档: http://reg.readthedocs.io/en/latest/
  - 作用: 使用现代的技术实现多分派泛函数，并支持在生产环境中使用

nonlocal 声明
  - 文档:  http://www.python.org/dev/peps/pep-3104/
  - 文档作用:
    - 说明了引入 nonlocal 声明的原因: 重新绑定既不在本地作用域中也不在全局作用域中的名称
    - 这份 PEP 还概述了其他动态语言（ Perl、 Ruby、 JavaScript，等等）解决这个问题的方
    式，以及 Python 中可用设计方案的优缺点

词法作用域
  - 文档: PEP 227—Statically Nested Scopes http://www.python.org/dev/peps/pep-0227/
  - 文档说明:
    - 更偏重于理论，说明了 Python 2.1 引入的词法作用域。
    - 词法作用域在这一版里是一种方案，到Python 2.2 就变成了标准
    - 这份 PEP 还说明了 Python 中闭包的基本原理和实现方式的选择

### blog:
Graham Dumpleton
  - 写了一系列博客文章，深入剖析了如何实现行为良好的装饰器
  - http://github.com/GrahamDumpleton/wrapt/blob/develop/blog/README.md

Python Decorator Library 维基页面
  - http://wiki.python.org/moin/PythonDecoratorLibrary

Guido van Rossum
  - Five-Minute Multimethods in Python
    - 详细说明了如何使用装饰器实现泛函数（也叫多方法）
    -  http://www.artima.com/weblogs/viewpost.jsp?thread=101605

Fredrik Lundh
  - Closures in Python
    - 解说了闭包这个术语
    -  http://effbot.org/zone/closure.htm

### 实用工具  
Morepath
  - 作用: 模型驱动型 REST 式 Web 框架
  -  http://morepath.readthedocs.org/en/latest/

### 书籍:
《 Python Cookbook（第 3 版）中文版》:
  - 第 9 章“元编程”有几个诀窍构建了基本的装饰器和特别复杂的装饰器

## 附注
一等函数
  - 任何把函数当作一等对象的语言，它的设计者都要面对一个问题: 作为一等对象的函
  数在某个作用域中定义，但是可能会在其他作用域中调用
  - 问题是，如何计算自由变量？

如何计算自由变量
  1. 动态作用域:
    - 定义: 根据函数调用所在的环境计算自由变量
    - 缺点: 对动态作用域来说，如果函数使用自由变量，程序员必须知道函数的内部细节，
    这样才能搭建正确运行所需的环境
    - 优点: 动态作用域易于实现
    - 应用: Lisp
      -  http://www.paulgraham.com/rootsoflisp.html
      - http://www-formal.stanford.edu/jmc/recursive/recursive.html
  2. 词法作用域:
    - 定义: 根据定义函数的环境计算自由变量。
    - 缺点: 词法作用域让人更难实现支持一等函数的语言，因为需要支持闭包
    - 优点: 词法作用域让代码更易于阅读
    - 应用: Algol 之后出现的语言大都使用词法作用域

Python 装饰器和装饰器设计模式
  - 功能: Python 函数装饰器符合 Gamma 等人在《设计模式: 可复用面向对象软件的基础》一
  书中对“装饰器”模式的一般描述: “动态地给一个对象添加一些额外的职责。就扩展
  功能而言，装饰器模式比子类化更灵活
  - 实现: Python 装饰器与“装饰器”设计模式不同
    - 在设计模式中:
      - Decorator 和 Component 是抽象类。
      - 为了给具体组件添加行为，具体装饰器的实例要包装具体组件的实例
    - 在 Python 中:
      - 装饰器函数相当于 Decorator 的具体子类，
      - 而装饰器返回的内部函数相当于装饰器实例。
      - 返回的函数包装了被装饰的函数，这相当于“装饰器”设计模式中的组件。
      - 返回的函数是透明的，因为它接受相同的参数，符合组件的接口
      - 返回的函数把调用转发给组件，可以在转发前后执行额外的操作
      - 不是建议在 Python 程序中使用函数装饰器实现“装饰器”模式。在特定情况下确实可以这么做，
      但是一般来说，实现“装饰器”模式时最好 **使用类表示装饰器和要包装的组件**
