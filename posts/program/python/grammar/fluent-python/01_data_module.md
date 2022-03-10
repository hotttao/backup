---
weight: 1
title: "Python 数据模型"
date: 2018-01-01T22:00:00+08:00
lastmod: 2018-01-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "这个系列我们开始学习 Python 语言的第二部分-进阶"
featuredImage: 

tags: ["python 进阶"]
categories: ["Python"]

lightgallery: true
---

## 1. 语言特性
1. Python 最好的品质之一是一致性，体现在 Python 的数据模型上

## 2. 数据模型
定义：是对 Python 框架的描述  
作用：规范了这门语言自身构建模块的接口(API)  
包括：不限于序列、迭代器、函数、类和上下文管理器


- 数据模型接口：
  - 实现： Python 解释器碰到**特殊的句法**时，会使用**特殊方法**去激活一些基本的对象操作
  - 特殊方法：以两个下划线开头，以两个下划线结尾


- 通过特殊方法可以实现的语言框架：
  - 迭代
  - 集合类
  - 属性访问
  - 运算符重载
  - 函数和方法的调用
  - 对象的创建和销毁
  - 字符串表示形式和格式化
  - 管理上下文（即 with 块）


- 通过实现特殊方法来利用 Python 数据模型的好处：
  - 作为你的类的用户，他们不必去记住标准操作的各式名称
  - 可以更加方便地利用 Python的标准库 eg:random.choice


## 3. 使用特殊方法
特殊方法调用：
  - 特殊方法的存在是为了被 Python 解释器调用的，不需要直接调用它们
  - 最好的选择是通过内置的函数（例如 len、 iter、 str，等等）  
    eg：len(obj) 会自动调用 obj.\_\_len\_\_()方法
  - Python 内置的类型， CPython可能直接从一个 C 结构体里读取数据

### \_\_repr\_\_
作用：
  - 方便程序员调试和记录日志
  - 所返回的字符串应该准确、无歧义，并且尽可能表达出如何用代码创建出这个被打印的对象  

调用：
  - repr() 函数
  - "%r" % obj
  - format('{name!r}', obj)
  - 交互式控制台和调试程序(debugger)用 repr 函数获取字符串表示形式
  - 如果对象没有 \_\_str\_\_ 函数，解释器会用 \_\_repr\_\_ 作为替代


### \_\_str\_\_
作用:
  - 终端用户使用  

调用:
  - str()
  - print


### \_\_bool\_\_
调用: bool()  
python 真假判断：
  -  为了判定值 x 真假， Python会调用 bool(x)，这个函数只能返回 True 或者 False
  - bool(x)默认调用 x.\_\_bool\_\_()，\_\_bool\_\_ **必须返回布尔型**
  - 如果不存在，bool(x) 尝试调用 x.\_\_len\_\_()返回 0则 bool 返回 False；否则返回 True
  - 两个方法都不存在，默认情况下，自定义的类的实例总是返回True


### 特殊方法概览
#### 1. 跟运算符无关的特殊方法
|类别 |方法名|
|---|---|
|字符串/字节序列表示形式| \_\_repr\_\_、 \_\_str\_\_、 \_\_format\_\_、 \_\_bytes\_\_|
|数值转换 |\_\_abs\_\_、 \_\_bool\_\_、 \_\_complex\_\_、 \_\_int\_\_、 \_\_float\_\_、 \_\_hash\_\_、 \_\_index\_\_|
|集合模拟 |\_\_len\_\_、 \_\_getitem\_\_、 \_\_setitem\_\_、 \_\_delitem\_\_、 \_\_contains\_\_|
|迭代枚举| \_\_iter\_\_、 \_\_reversed\_\_、 \_\_next\_\_|
|可调用模拟| \_\_call\_\_|
|上下文管理| \_\_enter\_\_、 \_\_exit\_\_|
|实例创建和销毁| \_\_new\_\_、 \_\_init\_\_、 \_\_del\_\_|
|属性管理| \_\_getattr\_\_、 \_\_getattribute\_\_、 \_\_setattr\_\_、 \_\_delattr\_\_、 \_\_dir\_\_|
|属性描述符| \_\_get\_\_、 \_\_set\_\_、 \_\_delete\_\_|
|跟类相关的服务| \_\_prepare\_\_、 \_\_instancecheck\_\_、 \_\_subclasscheck\_\_|

#### 2. 跟运算符相关的特殊方法
|类别| 方法名和对应的运算符|
|---|---|
|一元运算符| \_\_neg\_\_ -、 \_\_pos\_\_ +、 \_\_abs\_\_ abs()|
|众多比较运算符| \_\_lt\_\_ <、 \_\_le\_\_ <=、 \_\_eq\_\_ ==、 \_\_ne\_\_ !=、 \_\_gt\_\_ >、 \_\_ge\_\_ >=|
|算术运算符| \_\_add\_\_ +、 \_\_sub\_\_ -、 \_\_mul\_\_ *、 \_\_truediv\_\_ /、 \_\_floordiv\_\_ //、 \_\_mod\_\_ %、 \_\_divmod\_\_ divmod()、 \_\_pow\_\_ ** 或 pow()、 \_\_round\_\_ round()|
|反向算术运算符| \_\_radd\_\_、 \_\_rsub\_\_、 \_\_rmul\_\_、 \_\_rtruediv\_\_、 \_\_rfloordiv\_\_、 \_\_rmod\_\_、\_\_rdivmod\_\_、 \_\_rpow\_\_|
|增量赋值算术运算符| \_\_iadd\_\_、 \_\_isub\_\_、 \_\_imul\_\_、 \_\_itruediv\_\_、 \_\_ifloordiv\_\_、 \_\_imod\_\_、\_\_ipow\_\_|
|位运算符| \_\_invert\_\_ ~、 \_\_lshift\_\_ <<、 \_\_rshift\_\_ >>、 \_\_and\_\_ &、 \_\_or\_\_ 、 \_\_xor\_\_ ^|
|反向位运算符| \_\_rlshift\_\_、 \_\_rrshift\_\_、 \_\_rand\_\_、 \_\_rxor\_\_、 \_\_ror\_\_|
|增量赋值位运算符| \_\_ilshift\_\_、 \_\_irshift\_\_、 \_\_iand\_\_、 \_\_ixor\_\_、 \_\_ior\_\_|


## 附注
**len 为什么不是普通方法**
  - 对于内置类型，len() 直接从C 结构体里读取对象长度，完全不会调用任何方法
  - len 之所以不是一个普通方法，是为了让 Python 自带的数据结构
  可以走后门，其他内置函数也是同样道理
  - 同时由于它是特殊方法，也可以把 len 用于自定义数据类型
  - 这种处理方式在保持内置类型的效率和保证语言的一致性之间找到了一个平衡点


## 4. 常用模块
|模块|作用|
|:---|:---|
|collection.namedtuple()|构建只有少数属性但是没有方法的对象，比如数据库条目|
|random.choice(seq)|从一个序列中随机选出一个元素|
|sorted()|内置排序函数|
|decimal.Decimal|高精度浮点数|
|fractions.Fraction|分数数值类型|

## 延伸阅读
Python:
  - Data Model:<https://docs.python.org/3/reference/datamodel.html>  
  - format: <https://docs.python.org/2/library/string.html#formatstring-syntax>
  - \_\_str\_\_:<http://stackoverflow.com/questions/1436703/difference-between-str-and-repr-in-python>

书籍：
  - 《 Python 技术手册（第 2 版）》-  对属性访问机制的描述
  - 《 Python 参考手册（第 4 版）》
  - 《 Python Cookbook（第 3版）中文版》
  - 《The Art of the Metaobject Protocol》 -  元对象协议(metaobject protocol， MOP)  

blog:
  - Alex Martelli: <http://stackoverflow.com/users/95810/alex-martelli>

## 杂谈
**元对象协议**
  - 元对象所指的是那些对建构语言本身来讲很重要的对象，
  - 以此为前提， 协议也可以看作接口
  - 也就是说，元对象协议是对象模型的同义词，它们的意思都是构建核心语言的 API

**面向方面编程**
  - java: AspectJ
  - pyhton: zope.interface <http://docs.zope.org/zope.interface/>


## 示例代码
```python
from math import hypot

class Vector:

    def __init__(self, x=0, y=0):
        self.x = x
        self.y = y

    def __repr__(self):
        return 'Vector(%r, %r)' % (self.x, self.y)

    def __abs__(self):
        return hypot(self.x, self.y)

    def __bool__(self):
        return bool(abs(self))

    def __add__(self, other):
        x = self.x + other.x
        y = self.y + other.y
        return Vector(x, y)

    def __mul__(self, scalar):
        return Vector(self.x * scalar, self.y * scalar)
```
