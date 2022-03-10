---
weight: 1
title: "属性描述符"
date: 2018-01-20T22:00:00+08:00
lastmod: 2018-01-20T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Python 属性描述符"
featuredImage: 

tags: ["python 进阶"]
categories: ["Python"]

lightgallery: true
---


本章内容
  - 描述符协议
  - 描述符与属性覆盖
  - 方法与特性
  - 描述符使用建议
  - 描述符使用示例

## 1. 描述符与描述符协议
### 1.1 描述符概述
  - 定义: 是实现了特定协议的类 -- 描述符协议
  - 作用: 管理数据属性，是**对多个属性运用相同存取逻辑**的一种方式
  - 用法: 创建一个描述符类实例，作为另一个类的类属性
  - 应用: property 类，方法， classmethod，staticmethod 装饰器等

### 1.2 相关名词
![collections.abc](/images/fluent_python/descriptor_eg.png)

|名词|定义|示例|
|: ---|: ---|: ---|
|描述符类|实现描述符协议的类|Quantity 类|
|托管类|把描述符实例声明为类属性的类|LineItem 类
|描述符实例|描述符类的各个实例，声明为托管类的类属性||
|托管实例|托管类的实例|LineItem 实例是托管实例|
|储存属性|托管实例中存储自身托管属性的属性(存储着实际值的属性)<br>与描述符属性不同，描述符属性都是类属性||
|托管属性|托管类中由描述符实例处理的公开属性<br>值存储在储存属性中<br>描述符实例和储存属性为托管属性建立了基础|..|

### 1.3 描述符协议
**\_\_get\_\_(self, instance, owner)**:
  - 调用: 通过**托管类或托管实例**获取属性时调用
  - 参数:
    - self: 描述符实例
    - instance: 托管实例,通过**托管类**调用时为None
    - owner: 托管类
  - 特性:
    - 如果 \_\_set\_\_ 方法同时存在，会覆盖对实例属性的读值操作
    - 如果 \_\_set\_\_ 方法不存在，无法覆盖对实例属性的读值操作
    - 会覆盖对类属性的读值操作

**\_\_set\_\_(self, instance, value)**:
  - 调用: 为托管属性赋值时调用
  - 作用: 把值存储在托管实例中
  - 参数:
    - self: 描述符实例   -- 描述符会成为类属性为所有实例共享
    - instance: 托管实例 -- 应该把值存储在托管实例中
    - value: 要设定的值
  - 特性:
    - 能覆盖对实例属性的赋值操作
    - 无法覆盖对类属性的赋值操作

**\_\_delete\_\_**
  - 调用: 删除托管属性时调用

### 1.4 描述符与属性覆盖
#### 描述符与实例属性
描述符分类:
  - 依据: 是否定义 \_\_set\_\_ 方法，描述符分为非覆盖性描述符和覆盖性描述符
  - 覆盖性描述 - A
  - 没有\_\_get\_\_方法的覆盖型描述符 - B
  - 非覆盖性描述符  - C
  - 附注:
    - 覆盖型描述符也叫数据描述符或强制描述符
    - 非覆盖型描述符也叫非数据描述符或遮盖型描述符

|描述符分类|实现方法|属性覆盖顺序|
|: ---|: ---|: ---|
|A|\_\_get\_\_<br>\_\_set\_\_|描述符会同时覆盖实例属性的读值和赋值操作|
|B|\_\_set\_\_|会覆盖实例属性的赋值操作<br>存在同名实例属性时读操作返回实例属性，因为描述符是类属性<br>不存在同名实例属性时，读值操作返回作为类属性的描述符实例本身<br>只能直接通过实例的\_\_dict\_\_ 属性创建同名实例属性|
|C|\_\_get\_\_|描述符会被同名的实例属性覆盖，属性的读值和赋值操作不会经描述符处理|


#### 描述符与类属性
1. 读类属性的操作可以由依附在托管类上定义有 \_\_get\_\_ 方法的描述符处理
2. 写类属性的操作不会由依附在托管类上定义有 \_\_set\_\_ 方法的描述符处理
3. 类上的描述符无法控制为类属性赋值的操作，为类属性赋值会覆盖描述符
4. 若想控制设置类属性的操作，要把描述符依附在类的类上，即依附在元类上
5. 默认情况下，对用户定义的类来说，其元类是 type，不能为 type 添加属性，但可以自定义元类

### 1.5 特性工厂函数与描述符类比较
- 描述符类:
  - 代码复用: 可以使用子类扩展
  - 状态保持: 在类属性和实例属性中保持状态更易于理解
  - 代码逻辑: 描述符涉及了复杂的对象关系，和对象传递，如 self，instance 参数
- 特性工厂函数:
  - 代码复用: 函数中的代码很难复用
  - 状态保持: 使用函数属性和闭包保持状态，难以理解
  - 代码逻辑: 特性工厂函数的代码不依赖奇怪的对象关系，容易理解
- 结论: 从某种程度上来讲，特性工厂函数模式较简单，描述符类方式更易扩展，而且应用也更广泛


## 2. 方法和特性
**方法**:
  - 原理:
    - 用户定义的函数都有 \_\_get\_\_ 方法，所以依附到类上时，就相当于描述符
    - 函数没有实现 \_\_set\_\_ 方法，因此是非覆盖型描述符
  - 定义: 在类中定义的函数属于绑定方法（bound method）
  - 返回:
    - 通过托管类访问时，函数的 \_\_get\_\_ 方法会返回自身的引用
    - 通过实例访问时，函数的 \_\_get\_\_ 方法返回的是绑定方法对象: 一种可调用的对象
  - self 隐式绑定:
    - 绑定方法的 \_\_self\_\_ 属性是调用这个方法的实例的引用
    - 绑定方法的 \_\_func\_\_ 属性是依附在托管类上那个原始函数的引用
    - 绑定方法对象还有个 \_\_call\_\_ 方法，用于处理真正的调用过程
    - \_\_call\_\_ 会调用 \_\_func\_\_ 引用的原始函数，把函数的第一个参数设为绑定方法的
    \_\_self\_\_ 属性

```python
import collections


class Text(collections.UserString):

    def __repr__(self):
        return 'Text({!r})'.format(self.data)

    def reverse(self):
        return self[: : -1]

>>> word = Text('forward')
>>> word ➊
Text('forward')
>>> word.reverse() ➋
Text('drawrof')
>>> Text.reverse(Text('backward')) ➌
Text('drawkcab')
>>> type(Text.reverse), type(word.reverse) ➍
(<class 'function'>, <class 'method'>)
>>> list(map(Text.reverse, ['repaid', (10, 20, 30), Text('stressed')])) ➎
['diaper', (30, 20, 10), Text('desserts')]
>>> Text.reverse.__get__(word) ➏
<bound method Text.reverse of Text('forward')>
>>> Text.reverse.__get__(None, Text) ➐
<function Text.reverse at 0x101244e18>
>>> word.reverse ➑
<bound method Text.reverse of Text('forward')>
>>> word.reverse.__self__ ➒
Text('forward')
>>> word.reverse.__func__ is Text.reverse ➓
True
```
示例分析:
  - ➎ Text.reverse 相当于函数，甚至可以处理 Text 实例之外的其他对象
  - ➏ 函数是非覆盖型描述符,在函数上调用 \_\_get\_\_ 方法时传入实例，得到的是绑定到那个实例上的方法
  - ➐ 调用函数的 \_\_get\_\_ 方法时，如果 instance 参数的值是 None，那么得到的是函数本身

**特性**:
  - 特性是覆盖型描述符
  - 如果没提供设值函数，property 类的 \_\_set\_\_ 方法会抛出 AttributeError 异常，指明属性是只读的


## 3. 描述符用法建议
1. 使用特性以保持简单
  - 内置的 property 类创建的其实是覆盖型描述符
  - \_\_set\_\_ 方法和 \_\_get\_\_ 方法都实现了，即便不定义设值方法也是如此
  - 特性的 \_\_set\_\_ 方法默认抛出 AttributeError: can't set attribute
  - 因此创建只读属性最简单的方式是使用特性，这能避免下一条所述的问题
2. 只读描述符必须有 \_\_set\_\_ 方法
  - 如果使用描述符类实现只读属性，要记住， \_\_get\_\_ 和 \_\_set\_\_ 两个方法必须都定义
  - 否则，实例的同名属性会遮盖描述符
  - 只读属性的 \_\_set\_\_ 方法只需抛出 AttributeError 异常，并提供合适的错误消息
3. 用于验证的描述符可以只有 \_\_set\_\_ 方法
  - 对仅用于验证的描述符来说， \_\_set\_\_ 方法应该检查 value 参数获得的值
  - 如果有效，使用描述符实例的名称为键，直接在实例的 \_\_dict\_\_ 属性中设置
  - 从实例中读取同名属性的速度很快，因为不用经过 \_\_get\_\_ 方法处理
4. 仅有 \_\_get\_\_ 方法的描述符可以实现高效缓存
  - 如果只编写了 \_\_get\_\_ 方法，那么创建的是非覆盖型描述符
  - 这种描述符可用于执行某些耗费资源的计算，然后为实例设置同名属性，缓存结果
  - 同名实例属性会遮盖描述符，因此后续访问会直接从实例的 \_\_dict\_\_ 属性中获取值，
  而不会再触发描述符的 \_\_get\_\_ 方法
5. 非特殊的方法可以被实例属性遮盖
  - 由于函数和方法只实现了 \_\_get\_\_ 方法，它们不会处理同名实例属性的赋值操作
  - 同名实例属性会遮盖函数和方法，然而，特殊方法不受这个问题的影响
  - 解释器只会在类中寻找特殊的方法
6. 实例的非特殊方法可以被轻松地覆盖，如果要创建大量动态属性，属性名称从不受自己控制的数据中获取，
那么应该实现某种机制，过滤或转义动态属性的名称，以维持数据的健全性


### 4. 描述符使用示例
### 4.1 基础示例
```python
class Quantity: # 描述符基于协议实现，无需创建子类

    def __init__(self, storage_name):
        self.storage_name = storage_name  # 托管实例中存储值的属性的名称

    def __set__(self, instance, value): #
        if value > 0:
            # 必须直接处理托管实例的 __dict__ 属性，使用内置的 setattr 函数会递归调用
            instance.__dict__[self.storage_name] = value  # <4>
        else:
            raise ValueError('value must be > 0')


class LineItem:
    weight = Quantity('weight')  # <5>
    price = Quantity('price')  # <6>

    def __init__(self, description, weight, price): # <7>
        self.description = description
        self.weight = weight
        self.price = price

    def subtotal(self):
        return self.weight * self.price
```
示例分析
  - 必须直接处理托管实例的 \_\_dict\_\_ 属性；如果使用内置的 setattr 函数，会再
次触发 \_\_set\_\_ 方法，导致无限递归
  - 各个托管属性的名称与储存属性一样，而且读值方法不需要特殊的逻辑，
所以 Quantity 类不需要定义 \_\_get\_\_ 方法

### 2.2 自动获取储存属性的名称
```python
class Quantity:
    __counter = 0

    def __init__(self):
        cls = self.__class__  
        prefix = cls.__name__
        index = cls.__counter
        self.storage_name = '_{}#{}'.format(prefix, index)  
        cls.__counter += 1  

    def __get__(self, instance, owner):
        if instance is None:
            return self  
        else:
            return getattr(instance, self.storage_name)  

    def __set__(self, instance, value):
            if value > 0:
                setattr(instance, self.storage_name, value)
            else:
                raise ValueError('value must be > 0')

class LineItem:
    weight = Quantity()
    price = Quantity()
```
示例分析
  1. \_\_counter 是 Quantity 类的类属性，统计 Quantity 实例的数量
  2. 要实现 \_\_get\_\_ 方法，因为托管属性的名称与 storage_name 不同
  3. 这里可以使用内置的高阶函数 getattr 和 setattr 存取值，无需使用 instance.\_\_dict\_\_，
  因为托管属性和储存属性的名称不同，所以把储存属性传给 getattr 函数不会触发描述符
  4. 通过类访问托管属性时，最好让 \_\_get\_\_ 方法返回描述符实例

### 2.3 描述符扩展
![collections.abc](/images/fluent_python/descriptor_abc.png)

- AutoStorage: 自动管理储存属性的描述符类。
- Validated: 扩展 AutoStorage 类的抽象子类，覆盖 \_\_set\_\_ 方法，调用必须由子类实现的 validate方法
- NonBlank: 继承 Validated 类，只编写 validate 方法
- 这三个类之间的关系体现了模板方法设计模式
- 模板方法设计模式: **一个模板方法用一些抽象的操作定义一个算法，而子类将重定义这些操作以提供具体的行为**

```python
import abc

class AutoStorage:
    __counter = 0

    def __init__(self):
        cls = self.__class__
        prefix = cls.__name__
        index = cls.__counter
        self.storage_name = '_{}#{}'.format(prefix, index)
        cls.__counter += 1

    def __get__(self, instance, owner):
        if instance is None:
            return self
        else:
            return getattr(instance, self.storage_name)

    def __set__(self, instance, value):
        setattr(instance, self.storage_name, value)  # 验证除外


class Validated(abc.ABC, AutoStorage): # 抽象类，不过也继承自 AutoStorage 类

    def __set__(self, instance, value):
        value = self.validate(instance, value)  # 把验证操作委托给 validate 方法
        super().__set__(instance, value)

    @abc.abstractmethod
    def validate(self, instance, value):
        """return validated value or raise ValueError"""


class Quantity(Validated):
    """a number greater than zero"""

    def validate(self, instance, value):
        if value <= 0:
            raise ValueError('value must be > 0')
        return value


class NonBlank(Validated):
    """a string with at least one non-space character"""

    def validate(self, instance, value):
        value = value.strip()
        if len(value) == 0:
            raise ValueError('value cannot be empty or blank')
        return value

class LineItem:
    description = NonBlank()  # 用户只需知道，可以使用 NonBlank 自动验证实例属性
    weight = Quantity()
    price = Quantity()

```
### 2.4 特性工厂函数
```python
def quantity():
    try:
        quantity.counter += 1  # 定义成工厂函数对象的属性，以便在多次调用之间持续存在
    except AttributeError:
        quantity.counter = 0

    storage_name = '_{}: {}'.format('quantity', quantity.counter) # 借助闭包保持值

    def qty_getter(instance):
        return getattr(instance, storage_name)

    def qty_setter(instance, value):
        if value > 0:
            setattr(instance, storage_name, value)
        else:
            raise ValueError('value must be > 0')

    return property(qty_getter, qty_setter)
```

## 延伸阅读
### Python:
Data model 一章
  - https://docs.python.org/3/reference/datamodel.html

### blog:
Descriptor HowTo Guide
  - https://docs.python.org/3/howto/descriptor.html

Python 官方文档 HowTo 合集
  - https://docs.python.org/3/howto/

Python’s Object Model
  - 深入探讨了特性和描述符
  - 幻灯片: http://www.aleax.it/Python/nylug05_om.pdf
  - 视频: https://www.youtube.com/watch?v=VOzvpHoYQoo）

### 实用工具

### 书籍:
《 Python Cookbook（第 3 版）中文版》有很多说明描述符的诀窍
  - 6.12 读取嵌套型和大小可变的二进制结构
  - 8.10 让属性具有惰性求值的能力
  - 8.13 实现一种数据模型或类型系统
  - 9.9 把装饰器定义成类，解决了函数装饰器、描述符和方法之间相互作用的深层次问题，
  说明了如何使用有 \_\_call\_\_ 方法的类实现函数装饰器；
  如果既想装饰方法又想装饰函数，还要实现 \_\_get\_\_ 方法

## 附注
