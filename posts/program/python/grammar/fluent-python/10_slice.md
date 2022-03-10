---
weight: 1
title: "鸭子类型"
date: 2018-01-10T22:00:00+08:00
lastmod: 2018-01-10T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Python 的序列的散列和切片"
featuredImage: 

tags: ["python 进阶"]
categories: ["Python"]

lightgallery: true

---

## 1. 协议和鸭子类型
协议:
  - 理解:
    - 在面向对象编程中，协议是非正式的接口，即按照所需的行为实现所需的方法
    - 协议是非正式的，没有强制力，因此如果知道类的具体使用场景，通常只需要实现一个协议的部分
    - eg: 为了支持迭代，只需实现 \_\_getitem\_\_ 方法，没必要提供 \_\_len\_\_ 方法

## 2. 符合Python风格的序列
### 2.1 对象表示形式
```python
from array import array
import reprlib
import math
import numbers
import functools
import operator
import itertools  # <1>


class Vector:
    typecode = 'd'

    def __init__(self, components):   # self._components 是“受保护的”实例属性
        self._components = array(self.typecode, components) # 分量保存在一个数组中

    def __iter__(self):
        return iter(self._components) # 支持迭代协议

    def __repr__(self):
        components = reprlib.repr(self._components) # reprlib.repr()获取有限长度表示
        components = components[components.find('['): -1]
        return 'Vector({})'.format(components)

    def __str__(self):
        return str(tuple(self))

    def __bytes__(self):
        return (bytes([ord(self.typecode)]) +
                bytes(self._components))

    def __abs__(self):
        return math.sqrt(sum(x * x for x in self))

    def __bool__(self):
        return bool(abs(self))

    @classmethod
    def frombytes(cls, octets):
        typecode = chr(octets[0])
        memv = memoryview(octets[1: ]).cast(typecode)
        return cls(memv)
```
**reprlib**
  - 作用: 可以生成长度有限的表示形式
  - 版本:
    - Pythno3 - reprlib
    - Python2 - repr
  - 附注: 2to3 工具能自动重写 repr 导入的内容
  - 接口:
    - reprlib.repr(): 用于生成大型结构或递归结构的安全表示形式，
    它会限制输出字符串的长度，用 '...' 表示截断的部分

**\_\_repr\_\_**
  - 调用 repr() 函数的目的是调试，因此绝对不能抛出异常。如果 \_\_repr\_\_ 方
  法的实现有问题，那么必须处理，尽量输出有用的内容，让用户能够识别目标对象


### 2.2 可散列对象
```Python
    def __eq__(self, other):
        return (len(self) == len(other) and
                all(a == b for a, b in zip(self, other))) # 归约函数 all

    def __hash__(self):
        hashes = (hash(x) for x in self)
        return functools.reduce(operator.xor, hashes, 0) # 归约各分量散列值
```
**reduce(function, iterable,initializer)**
  - initializer
    - 如果 iterable 为空， initializer 是返回的结果；否则，在归约中使用它作为第一个参数
    - 因此应该使用恒等值。比如，对 +、 | 和 ^ 来说，initializer 应该是 0；而对 * 和 & 来说，应该是 1

### 2.3 序列协议
```python
    def __len__(self):
        return len(self._components) # 委托给对象中的序列属性，以支持序列协议

    def __getitem__(self, index):  # 切片得到的应该是当前类型的新实例，而不是其他类型
        cls = type(self)          # 所以不能把切片简单地委托给数组切片
        if isinstance(index, slice):
            return cls(self._components[index])
        elif isinstance(index, numbers.Integral):
            return self._components[index]
        else:
            msg = '{.__name__} indices must be integers'
            raise TypeError(msg.format(cls))
```
**序列协议**:
  - 只需实现 \_\_len\_\_ 和 \_\_getitem\_\_ 两个方法

**切片原理**

```python
>>> class MySeq:
      def __getitem__(self, index):
         return index # ➊

>>> s = MySeq()
>>> s[1]
1
>>> s[1: 4]
slice(1, 4, 2)

>>> s[1: 4: 2, 9]   # 如果 [] 中有逗号，那么 __getitem__ 收到的是元组
(slice(1, 4, 2), 9)
>>> s[1: 4: 2, 7: 9] # 元组中甚至可以有多个切片对象
(slice(1, 4, 2), slice(7, 9, None))

>> help(slice.indices)
S.indices(len) -> (start, stop, stride)
# 给定长度为 len 的序列，计算 S 表示的扩展切片的起始（ start）和结尾（ stop）索
# 引，以及步幅（ stride）。超出边界的索引会被截掉，这与常规切片的处理方式一样

# 假设有个长度为 5 的序列，例如 'ABCDE'
>>> slice(None, 10, 2).indices(5) # 'ABCDE'[: 10: 2] 等同于 'ABCDE'[0: 5: 2]
(0, 5, 2)
>>> slice(-3, None, None).indices(5) # 'ABCDE'[-3: ] 等同于 'ABCDE'[2: 5: 1]
(2, 5, 1)
```

Slice.indices
  - 说明: https://docs.python.org/3/reference/datamodel.html?highlight=indices#slice.indices
  - 作用: 如果不能把切片委托给底层序列类型，那么使用这个方法能节省大量时间

### 2.4 动态存取属性
```python
    shortcut_names = 'xyzt'

    def __getattr__(self, name):
        cls = type(self)
        if len(name) == 1:
            pos = cls.shortcut_names.find(name)
            if 0 <= pos < len(self._components):
                return self._components[pos]
        msg = '{.__name__!r} object has no attribute {!r}'
        raise AttributeError(msg.format(cls, name))

    def __setattr__(self, name, value):
            cls = type(self)
            if len(name) == 1:   # <1>
                if name in cls.shortcut_names:   # <2>
                    error = 'readonly attribute {attr_name!r}'
                elif name.islower():   # <3>
                    error = "can't set attributes 'a' to 'z' in {cls_name!r}"
                else:
                    error = ''  # <4>
                if error:   # <5>
                    msg = error.format(cls_name=cls.__name__, attr_name=name)
                    raise AttributeError(msg)
            # 在超类上调用 __setattr__ 方法，提供标准行为
            super().__setattr__(name, value)  # <6>
```
**my\_obj.x**
  1. Python会检查 my\_obj 实例有没有名为 x 的属性；
  2. 如果没有，到类 my\_obj.\_\_class\_\_ 中查找；
  3. 如果还没有，顺着继承树继续查找。
  4. 如果依旧找不到，调用 my\_obj 所属类中定义的 \_\_getattr\_\_ 方法，
  传入 self 和属性名称的字符串形式

**super()**
  - 作用:
    - 用于动态访问超类的方法
    - 程序员经常使用这个函数把子类方法的某些任务委托给超类中适当的方法

**\_\_getattr\_\_**
  - 多数时候，如果实现了 \_\_getattr\_\_ 方法，那么也要定义 \_\_setattr\_\_ 方法，以防对象的行为不一致
  - 如果想允许修改分量，可以使用 \_\_setitem\_\_ 方法，以支持 v[0] = 1.1
  - 或者实现 \_\_setattr\_\_ 方法，以支持 v.x = 1.1

### 2.5 自定义格式
```python
    def angle(self, n):   # <2>
        r = math.sqrt(sum(x * x for x in self[n: ]))
        a = math.atan2(r, self[n-1])
        if (n == len(self) - 1) and (self[-1] < 0):
            return math.pi * 2 - a
        else:
            return a

    def angles(self):   # <3>
        return (self.angle(n) for n in range(1, len(self)))

    def __format__(self, fmt_spec=''):
        if fmt_spec.endswith('h'):   # hyperspherical coordinates
            fmt_spec = fmt_spec[: -1]
            coords = itertools.chain([abs(self)],
                                     self.angles())  # <4>
            outer_fmt = '<{}>'  # <5>
        else:
            coords = self
            outer_fmt = '({})'  # <6>
        components = (format(c, fmt_spec) for c in coords)  # <7>
        return outer_fmt.format(', '.join(components))  # <8>
```


## 延伸阅读
### Python:
reprlib
  - 作用: 可以生成长度有限的表示形式
  - 版本:
    - Pythno3 - reprlib
    - Python2 - repr
  - 附注: 2to3 工具能自动重写 repr 导入的内容


### blog:
函数式语言
  - 维基百科- Fold (higher-order function)
  - https://en.wikipedia.org/wiki/Fold_(higher-order_function)
  - 这篇文章展示了高阶函数的用途，着重说明了具有递归数据结构的函数式语言

### 实用工具  

### 书籍:

## 附注
向量空间模型
  - 介绍: https://en.wikipedia.org/wiki/Vector_space_model
  - 相关包:
    - 向量运算: 应该使用 NumPy 和 SciPy。
    - gensim包:
      -  https://pypi.python.org/pypi/gensim
      - 作用: 使用 NumPy 和 SciPy 实现了用于处理自然语言和检索信息的向量空间模型

把协议当作非正式的接口
  - 模仿内置类型实现类时，记住一点: 模仿的程度对建模的对象来说合理即可，
  例如，有些序列可能只需要获取单个元素，而不必提取切片
  - 不要为了满足过度设计的接口契约和让编译器开心，而去实现不需要的方法，我们要
遵守 KISS 原则 http://en.wikipedia.org/wiki/KISS_principle
