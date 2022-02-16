# 3.2 Python风格对象

内容概要:
  - 如何使用特殊方法和约定的结构，定义行为良好且符合 Python 风格的类
  - 符合 Python 风格的对象应该正好符合所需，而不是堆砌语言特性

## 1. 对象表示形式
|特殊方法|调用函数|作用|
|: ---|: ---|: ---|
|\_\_str\_\_|str()|以用户理解的方式返回对象的字符串表示形式|
|\_\_repr\_\_|repr()|以开发者理解的方式返回对象的字符串表示形式|
|\_\_bytes\_\_|bytes()|获取对象的字节序列表示形式|
|\_\_format\_\_|format() str.format()|使用特殊的格式代码显示对象的字符串表示形式|
|\_\_int\_\_ |int()|在某些情况下用于强制转换类型|
|\_\_float\_\_|float()|在某些情况下用于强制转换类型|
|\_\_complex\_\_|complex()|对象的复数形式|

Python 3:
  - \_\_repr\_\_、 \_\_str\_\_ 和 \_\_format\_\_ 都必须返回 Unicode 字符串（str 类型）
  - \_\_bytes\_\_ 方法应该返回字节序列（bytes 类型）

\_\_index\_\_:
  - 作用: 强制把对象转换成整数索引
  - 应用:
    - 特定的序列切片场景中使用，以及满足 NumPy 的一个需求
    - 在实际编程中，不用实现 \_\_index\_\_ 方法，除非决定新建一种数值类型，
并想把它作为参数传给 \_\_getitem\_\_ 方法
  - 参考:
    - What’s New in Python 2.5 https://docs.python.org/2.5/whatsnew/pep-357.html
    - PEP 357—Allowing Any Object to be Used for Slicing  https://www.python.org/dev/peps/pep-0357/


## 2. 类的两个装饰器
**classmethod**:
  - 作用: 定义操作类，而不是操作实例的方法
  - 参数: 类方法的第一个参数是类本身，而不是实例
  - 用途: 最常见的用途是定义备选构造方法

**staticmethod**:
  - 作用: 静态方法就是普通的函数，在类的定义体中，而不是在模块层定义
  - 用法: The Definitive Guide on How to Use Static, Class or Abstract Methods inPython
  https://julien.danjou.info/blog/2013/guide-python-static-class-abstract-methods）

## 3. 字符串格式化
**格式字符串句法**:
  - 作用: 字符串格式化使用的语法，又称**代换字段**表示法
  - 文档: Format String Syntax https://docs.python.org/3/library/string.html#formatspec
  - 语法: {字段名称: 格式说明符}
    - 字段名称: 与格式说明符无关，用于决定把 .format() 的哪个参数传给代换字段
    - 格式说明符: 使用的表示法叫格式规范微语言(Format Specification Mini-Language)
  - 附注:
    - format() 函数，只使用格式规范微语言
    -  str.format() 使用格式字符串句法

**格式规范微语言**
  - 文档: https://docs.python.org/3/library/string.html#formatspec
  - 特性:
    - 为一些内置类型提供了专用的表示代码
      - 浮点数使用的格式代码 'eEfFgGn%'， f 表示 float 类型，% 表示百分数形式
      - 整数使用的格式代码有 'bcdoxXn'，b 和 x 分别表示二进制和十六进制的 int 类型
      - 字符串使用的是 's'
    - 是可扩展的，方法是实现 \_\_format\_\_ 方法，对提供给内置函数 format(obj, format_spec)
的 format_spec，或者提供给 str.format 方法的 '{: «format_spec»}' 位于代换字段中的
«format_spec» 做简单的解析

```python
# datetime 模块中的类的 __format__ 方法使用的格式代码与 strftime() 函数一样
>>> from datetime import datetime
>>> now = datetime.now()
>>> format(now, '%H: %M: %S')  # %H 等是 datetime __format__ 扩展的规则
'18: 49: 05'
>>> "It's now {: %I: %M %p}".format(now)
"It's now 06: 49 PM"
```


## 4. 可散列对象
**需实现方法**:
1. \_\_hash\_\_:
  - 实现:
    - 应该返回一个整数
    - 还要考虑对象属性的散列值，因为相等的对象应该具有相同的散列值
    - 最好使用位运算符异或（ ^）混合各分量的散列值
  - 文档:  https://docs.python.org/3/reference/datamodel.html
2. \_\_eq\_\_: 检测相等性，若 a == b 为真，则 hash(a) == hash(b) 也为真
3. 对象不可变:
  - 实现: 要想创建可散列的类型，不一定要实现特性，也不一定要保护实例属性。只
需正确地实现 \_\_hash\_\_ 和 \_\_eq\_\_ 方法即可。但是，实例的散列值绝不应该变
化以保证散列值不可变，因此需要实现只读特性保证对象不可变
  - 方法:
    - 将属性值保存在私有属性中,再以只读特性公开
    - 使用 @property 装饰器把读取私有属性的读值方法标记为特性,读值方法与公开属性同名

**私有属性**
  - 定义: 两个前导下划线，尾部没有或最多有一个下划线命名的实例属性
  - 特性:
    - Python 会把属性名存入实例的 \_\_dict\_\_ 属性中，而且会在前面加上一个下划线和类名
    - 又称为名称改写，eg:  \_\_mood 会变成 \_Dog\_\_mood
  - 目的: 避免子类意外覆盖“私有”属性，不能防止故意做错事
  - 附注: Python 解释器不会对使用单个下划线的属性名做特殊处理


## 5. \_\_slots\_\_
实例属性:
  - 默认 Python 在实例中名为 \_\_dict\_\_ 的字典里存储实例属性
  - \_\_slots\_\_: 让解释器在元组中存储实例属性，而不用字典
  - 继承自超类的 \_\_slots\_\_ 属性没有效果,Python 只会使用各个类中定义的 slots 属性

\_\_slots\_\_:
  - 语法: 创建一个类属性 \_\_slots\_\_  eg:  `__slots__ = ('__x', '__y')`
  - 类型: 值为一个字符串构成的可迭代对象，其中各个元素表示各个实例属性
  - 作用: 告诉解释器，这个类中的所有实例属性都在这儿了，Python 会在各个实例中使用类似元组的
  结构存储实例变量，从而避免使用消耗内存的 \_\_dict\_\_ 属性
  - 特性:
    - 定义 \_\_slots\_\_ 属性之后，实例不能再有 \_\_slots\_\_ 中所列名称之外的其他属性
    - 如果把 \_\_dict\_\_ 添加到 \_\_slots\_\_中，实例会在元组中保存各个实例的属性，
    此外还支持动态创建属性，这些属性存储在常规的 \_\_dict\_\_ 中
    - 把 '\_\_dict\_\_' 添加到 \_\_slots\_\_ 中可能完全违背了初衷，这取决于各个实例的
    静态属性和动态属性的数量及其用法
  - 应用:
    - 处理列表数据时 \_\_slots\_\_ 属性最有用，例如模式固定的数据库记录，以及特大型数据集
    - 如果要处理数百万个数值对象，应该使用 NumPy 数组
      - NumPy 数组能高效使用内存，而且提供了高度优化的数值处理函数，其中很多都一次操作整个数组

\_\_slots\_\_问题:
  1. 每个子类都要定义 \_\_slots\_\_ 属性，因为解释器会忽略继承的 \_\_slots\_\_ 属性
  2. 实例只能拥有 \_\_slots\_\_ 中列出的属性，除非把 '\_\_dict\_\_' 加入 \_\_slots\_\_ 中
  3. 如果不把 '\_\_weakref\_\_' 加入 \_\_slots\_\_，实例就不能作为弱引用的目标
  4. 不要使用 \_\_slots\_\_ 属性禁止类的用户新增实例属性,\_\_slots\_\_ 是用于优化的，不是为了约束程序员
  5. 仅当权衡当下的需求并仔细搜集资料后证明确实有必要时，才应该使用 \_\_slots\_\_ 属性

\_\_weakref\_\_:
  - 为了让对象支持弱引用，必须有这个属性
  - 用户定义的类中默认就有 \_\_weakref\_\_ 属性
  - 如果类中定义了 \_\_slots\_\_ 属性，而且想把实例作为弱引用的目标，
  那么要把 '\_\_weakref\_\_'添加到 \_\_slots\_\_ 中


## 6. 符合 Python 风格的对象
### 6.1 \_\_slots\_\_
```python
from array import array
import math

class Vector2d:
    __slots__ = ('__x', '__y')
    typecode = 'd'
```

### 6.2 可散列与公开只读属性
```python
    def __init__(self, x, y):
        self.__x = float(x) # 把 x 和 y 转换成浮点数，尽早捕获错误
        self.__y = float(y)

    # 实现对象不可变
    @property           # 使用 @property 装饰器把读取私有属性的读值方法标记为特性
    def x(self):         #  读值方法与公开属性同名，都是 x
        return self.__x #  使用两个前导下划线，把属性标记为私有的

    @property  
    def y(self):
        return self.__y

    def __eq__(self, other):  # 若 a == b 为真，则 hash(a) == hash(b) 也为真
        return tuple(self) == tuple(other)  

    def __hash__(self):   # 通过 self.x 和 self.y 读取公开特性
        return hash(self.x) ^ hash(self.y) # 位运算符异或 (^) 混合各分量的散列值
```

### 6.3 对象表示形式
```python
    def __iter__(self):   # 把 Vector2d 实例变成可迭代的对象，这样才能拆包
        return (i for i in (self.x, self.y))

    def __repr__(self):
        class_name = type(self).__name__ # 为支持类继承
        return '{}({!r}, {!r})'.format(class_name, *self)  # 拆包

    def __str__(self):
        return str(tuple(self)) #  从可迭代的 Vector2d 实例中可以轻松地得到一个元组

    def __bytes__(self):
        return (bytes([ord(self.typecode)]) +
                bytes(array(self.typecode, self))) # 迭代 Vector2d 实例，得到一个数组

    def __abs__(self):
        return math.hypot(self.x, self.y)

    def __bool__(self):  
        return bool(abs(self)) # 可以直接使用 abs()
```

### 6.4 自定义格式代码
```python
    def angle(self):
        return math.atan2(self.y, self.x)

    def __format__(self, fmt_spec=''):
        if fmt_spec.endswith('p'):
            fmt_spec = fmt_spec[: -1]
            coords = (abs(self), self.angle())
            outer_fmt = '<{}, {}>'
        else:
            coords = self
            outer_fmt = '({}, {})'
        components = (format(c, fmt_spec) for c in coords)
        return outer_fmt.format(*components)
```

**\_\_format\_\_**
  - 如果类没有定义 \_\_format\_\_ 方法
    - 会从 object 继承的方法会返回 str(my_object)
    - 如果传入格式说明符， object.\_\_format\_\_ 方法会抛出 TypeError

```python
>>> v1 = Vector2d(3, 4)
>>> format(v1) # 等同于调用 Vector2d 类的 \_\_str\_\_
'(3.0, 4.0)'

>>> format(v1, '.3f')
Traceback (most recent call last):
...
TypeError:  non-empty format string passed to object.__format__
```

### 6.5 备选构造方法
```python
    @classmethod
    def frombytes(cls, octets):
        typecode = chr(octets[0])
        memv = memoryview(octets[1: ]).cast(typecode)
        return cls(*memv)
```


## 7. 覆盖类属性
1. 类属性可用于为实例属性提供默认值
2. 实例属性会覆盖同名类属性
2. 类属性是公开的，因此会被子类继承，可以通过创建子类，用于定制类属性


## 延伸阅读
### Python:
NumPy:
  - http://www.numpy.org

Pandas:
  - http://pandas.pydata.org

### blog:

### 实用工具  

### 书籍:
Python 语言参考手册中
  - “ Data Model” 一章 https://docs.python.org/3/reference/datamodel.html
  - 3.3.1. Basic customization” https://docs.python.org/3/reference/datamodel.html#basic-customization

《 Python 技术手册（第 2 版）》

《 Python Cookbook（第 3 版）中文版》

《 Python 参考手册（第 4 版）》

## 附注
特性:
  - 可以先以最简单的方式定义类，也就是使用公开属性
  - 如果以后需要对读值方法和设值方法增加控制，那就可以实现特性
  - 这样做对一开始通过公开属性的名称与对象交互的代码没有影响
  - Java:
    - 没有特性
    - API 不能从简单的公开属性变成读值方法和设值方法，同时又不影响使用那些属性的代码

私有属性的安全性和保障性
  -  Java 的 private 和 protected 修饰符往往只是为了防止意外
（即一种安全措施）。只有使用安全管理器部署应用时才能保障绝对安全，防止恶意访
问；但是，实际上很少有人这么做，即便在企业中也少见


```python
import importlib
import sys
import resource

NUM_VECTORS = 10**7

if len(sys.argv) == 2:
    module_name = sys.argv[1].replace('.py', '')
    module = importlib.import_module(module_name)
else:
    print('Usage: {} <vector-module-to-test>'.format())
    sys.exit(1)

fmt = 'Selected Vector2d type: {.__name__}.{.__name__}'
print(fmt.format(module, module.Vector2d))

mem_init = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
print('Creating {:,} Vector2d instances'.format(NUM_VECTORS))

vectors = [module.Vector2d(3.0, 4.0) for i in range(NUM_VECTORS)]

mem_final = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
print('Initial RAM usage: {:14,}'.format(mem_init))
print('  Final RAM usage: {:14,}'.format(mem_final))
```
