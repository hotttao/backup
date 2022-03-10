---
weight: 1
title: "抽象基类"
date: 2018-01-11T22:00:00+08:00
lastmod: 2018-01-11T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "从协议到抽象基类"
featuredImage: 

tags: ["python 进阶"]
categories: ["Python"]

lightgallery: true

---

本章首先介绍了非正式接口（称为协议）的高度动态本性，然后讲解了抽象基类的静态接口声明，最后指出了抽象基类的动态特性：虚拟子类，以及使用 \_\_subclasshook\_\_ 方法动态识别子类

鸭子类型:
  - 非正式接口
  - 可部分实现，动态实现

抽象基类:
  - 正式接口
  - 必需完全实现

## 1. Python文化中的接口和协议
 对 Python 程序员来说，"X 类对象", "X 协议", "X 接口" 都是一个意思

**接口**:
  - 定义: 对象公开方法的子集，让对象在系统中扮演特定的角色,是 **实现特定角色的方法集合**
  - eg: Python 文档中的"文件类对象",指的不是特定的类，而是实现文件读写方法的集合

**协议**:
  - 定义: 非正式的接口(只由文档和约定定义)
  - 特点：不能像正式接口一样施加限制
  - 作用: 是让Python 这种动态类型语言实现多态的方式
  - 应用:
    - **Python 数据模型的哲学是尽量支持基本协议**
    - 因此如果遵守既定协议，很有可能增加利用现有的标准库和第三方代码的可能性

**Python 支持的协议**  
  1. 序列协议
    - 不可变的序列协议:  \_\_getitem\_\_， \_\_len\_\_
    - 可变的序列协议:  添加 \_\_setitem\_\_
  2. 缓冲协议
  3. 迭代协议

## 2. 协议的理解
### 2.1 协议与继承没有关系

```python
>>> class Foo:
... def __getitem__(self, pos):
... return range(0, 30, 10)[pos]
...
>>> f = Foo()
>>> f[1]
10
>>> for i in f:  print(i)
0
10
20
>>> 20 in f
True
```
协议后备机制:
  - 如果没有 \_\_iter\_\_ 和 \_\_contains\_\_ 方法， Python 会调用
  \_\_getitem\_\_ 方法，让迭代和 in 运算符可用
  - Python 中的迭代是鸭子类型的一种极端形式: 为了迭代对象，解释器会尝试调用两个不同的方法

协议与继承没有关系:
  - Foo 类没有继承 abc.Sequence，只实现了序列协议的一个方法:  \_\_getitem\_\_，
  - 这样足够访问元素、迭代和使用 in 运算符
  - 一个类可能会实现多个接口，以实现多个协议


## 2.2 协议是动态的
**协议是动态的**: 即对象的类型无关紧要，只要实现了特定的协议(特定方法集合)即可

**猴子补丁**: 在运行时修改类或模块，而不改动源码，可为对象动态添加协议所需方法

random.shuffle 函数
  - 作用: 就地打乱序列 x
  - 要求：传入对象部分实现可变序列协议 -- 协议是动态的
  - 文档:  https://docs.python.org/3/library/random.html#random.shuffle

## 2. 抽象基类的理解
### 2.1 引入抽象基类的原因
生物学类比
  - 属和种的分类:
    - 表型系统学: 关注的是表型系统学特征，即形态和举止的相似性
    - 支序系统学: 关注的是从共同祖先继承的特征，而不是单独进化的特征
  - 程序接口:
    - 鸭子类型，关注是否实现了特定方法的集合，类似表型系统学
    - 白鹅类型，关注是否是否具有内在的一致性，类似支序系统学
  - 引入原因:
    - `x.draw() 和 y.draw()`
      - 只因为 x 和 y 两个对象刚好都有一个名为 draw 的方法，而且调用时不用传入参数，
      远远不能确保二者可以相互调用，或者具有相同的抽象
      - 也就是说，从这样的调用中不能推导出语义相似性，需要程序员主动把这种等价维持在一定层次上

抽象基类
  - 定义: 正式的接口(由抽象基类规定)
  - 特点: 严格的接口规定和类型检查
  - 作用: 将相似对象维持在同一抽象层次上
  - 应用: 不应该在程序中过度使用它。 Python 的
核心在于它是一门动态语言，它带来了极大的灵活性。如果处处都强制实行类型约束，
那么会使代码变得更加复杂，而本不应该如此

## 3. 标准库中的抽象基类
### 3.1 collections.abc
![collections.abc](/images/fluent_python/abstract_collections.png)

|抽象基类|说明|支持的特殊方法|
|:  ---|:  ---|:  ---|
|Iterable |集合应该继承的抽象基类|通过 \_\_iter\_\_方法支持迭代|
|Container|集合应该继承的抽象基类|通过 \_\_contains\_\_ 方法支持 in 运算符|
|Sized    |集合应该继承的抽象基类|通过 \_\_len\_\_方法支持 len() 函数|
|Sequence<br>Mapping<br>Set |主要的不可变集合类型||
|MutableSequence<br>MutableMapping<br>MutableSet  |不可变集合类型的可变子类||
|MappingView|||
|ItemsView<br>KeysView<br>ValuesView|Python3 中映射方法 .items()、 .keys() 和 .values() 返回的对象||
|Callable<br>Hashable|为内置函数 isinstance 提供支持，以一种安全的方式判断对象能不能调用或散列|与集合没有太大的关系|
|Iterator|Iterable的子类|...|

附注:
  - ItemsView、KeysView 还从 Set 类继承了丰富的接口，包含 3.8.3 节所述的全部运算符
  - 若想检查是否能调用，可以使用内置的 callable() 函数；
  - 没有类似的 hashable() 函数，因此测试对象是否可散列，可使用 isinstance(my_obj, Hashable)

#### 序列的抽象基类
![序列抽象基类](/images/fluent_python/abstract_mutable_sequence.png)

#### 字典的抽象基类
![字典抽象基类](/images/fluent_python/maping_abc.png)

#### 集合的抽象基类
![集合抽象基类](/images/fluent_python/set_abc.png)

### 3.2 numbers
  - 文档: https://docs.python.org/3/library/numbers.html
  - 数字塔: 数值抽象基类的层次结构是线性的
    - Number  --  最顶端的超类
    - Complex  -- 复数
    - Real     -- 浮点型
    - Rational -- 有理数
    - Integral  -- 最底端的超类

`isinstance(x, numbers.Integral)`
  - 作用: 检查一个数是不是整数
  - 验证: 能接受 int、 bool（int 的子类），或者外部库使用 numbers 抽象基类注册的其他类型
  - 扩展: 为了满足检查的需要，API 用户始终可以把兼容的类型注册为 numbers.Integral 的虚拟子类

`isinstance(x, numbers.Real)`
  - 作用: 检查一个数是不是浮点数
  - 验证: 能接受 bool、 int、 float、 fractions.Fraction，或者其他注册的非复数类型
  - 附注:
    - decimal.Decimal 没有注册为 numbers.Real 的虚拟子类
    - 如果程序需要 Decimal 的精度，要防止与其他低精度数字类型混淆，尤其是浮点数

## 4. 抽象基类的使用
用法:
  1. 如何自定义抽象基类
  2. 如何检查具体子类是否符合接口定义
  3. 如何使用注册机制声明一个类实现了某个接口，而不进行子类化操作
  4. 如何让抽象基类自动“识别”任何符合接口的类——不进行子类化或注册

应用：
  - 创建现有抽象基类的子类
  - 使用现有的抽象基类注册
  - 如果必须检查参数的类型，使用 `isinstance(the_arg, collections.abc.Sequence)`
  - 需要从头编写新抽象基类的情况少之又少
  - 如果觉得需要创建新的抽象基类，先试着通过常规的鸭子类型来解决问题

### 4.1 自定义抽象基类
#### 抽象基类的实现
  - 语法要求: 因版本而异，见下
  - 抽象方法:
    - 使用 @abstractmethod 装饰器标记，而且定义体中通常只有文档字符串
    - 也可以有实现代码，即便有子类也必须覆盖，此时子类中可以使用 super() 函数调用抽象方法，
    为它添加功能，而不是从头开始实现
  - 具体方法:
    - 抽象基类可以包含具体方法，但具体方法只能依赖抽象基类定义的接口(即只能使用抽象基类中的
      其他具体方法、抽象方法或特性)
    -  具体子类知晓数据的存储结构，可以覆盖具体方法，以提供更高效的实现，但这不是强制要求

#### Python 版本差异
  - Python34
    - 方法: 直接继承 abc.ABC 或其他抽象基类
    - 附注: abc.ABC 是 Python 3.4 新增的类
  - Python3
    - 方法: 必须在 class 语句中使用 metaclass= 关键字，把值设为 abc.ABCMeta(元类)
    - eg: `class Tombola(metaclass=abc.ABCMeta): `
    - 附注:
      - 旧版 Python，无法继承现有的抽象基类
      - metaclass= 关键字参数是 Python 3 引入的
  - Python2
    - 方法: 必须使用 \_\_metaclass\_\_ 类属性
    ```python
    class Tombola(object):  # 这是Python 2！！！
        __metaclass__ = abc.ABCMeta
    ```

#### abc 模块的其他装饰器
 @abstractmethod 用法参见 https://docs.python.org/3/library/abc.html

其他装饰器:
  - 包括: @abstractclassmethod，@abstractstaticmethod，@abstractproperty
  - 状态: 从 Python 3.3 起废弃了，因为装饰器可以在 @abstractmethod 上堆叠
  - 使用: 与其他方法描述符一起使用时， abstractmethod() 应该放在最里层，
  即在 @abstractmethod 和 def 语句之间不能有其他装饰器

```python
# 声明抽象类方法的推荐方式是
class MyABC(abc.ABC):
    @classmethod
    @abc.abstractmethod  # 在 @abstractmethod 和 def 语句之间不能有其他装饰器
    def an_abstract_classmethod(cls, ...):
        pass
```

#### 自定义抽象基类示例
![自定义抽象基类示例](/images/fluent_python/abstract_example.png)

**抽象基类 Tombola**
```python
# Tombola 是抽象基类，有两个抽象方法和两个具体方法
import abc

class Tombola(abc.ABC):   # <1>

    @abc.abstractmethod
    def load(self, iterable):   # <2>
        """从可迭代对象中添加元素。"""

    @abc.abstractmethod
    def pick(self):   # <3>
    """随机删除元素，然后将其返回。
       如果实例为空，这个方法应该抛出`LookupError`。
    """

    def loaded(self):   # <4>
        """如果至少有一个元素，返回`True`，否则返回`False`。"""
        return bool(self.inspect())  # <5>


    def inspect(self):
        """返回一个有序元组，由当前元素构成。"""
        items = []
        while True:   # 抽象基类可以提供具体方法，只要依赖接口中的其他方法就行
            try:
                items.append(self.pick())
            except LookupError:   # self.pick() 抛出 LookupError 这一事实也是接口的一部分，
                break            # 但是在 Python 中没办法声明，只能在文档中说明
        self.load(items)  # <7>
        return tuple(sorted(items))
```

**子类 BingoCage**
```python
import random
from tombola import Tombola


class BingoCage(Tombola):

    def __init__(self, items):
        self._randomizer = random.SystemRandom()
        self._items = []
        self.load(items)  # 委托 .load(...) 方法实现初始加载

    def load(self, items):
        self._items.extend(items)
        # 使用 SystemRandom 实例的 .shuffle() 方法
        self._randomizer.shuffle(self._items)  

    def pick(self):   # <5>
        try:
            return self._items.pop()
        except IndexError:
            raise LookupError('pick from empty BingoCage')

    def __call__(self):   # <7>
        self.pick()
```
 random.SystemRandom()
  -  使用 os.urandom(...) 函数实现 random API
  - 根据 os 模块的文档 http://docs.python.org/3/library/os.html#os.urandom ,
  os.urandom(...) 函数生成“适合用于加密”的随机字节序列

BingoCage
  - 从 Tombola 中继承了耗时的 loaded 方法和笨拙的 inspect 方法,这两个方法都可以覆盖
  - 我们可以偷懒，直接从抽象基类中继承不是那么理想的具体方法
  - 不过只要 Tombola 的子类正确实现 pick 和 load 方法，就能提供正确的结果

**子类 LotteryBlower**
```python
import random
from tombola import Tombola

class LotteryBlower(Tombola):

    def __init__(self, iterable):
        self._balls = list(iterable)  # 初始化方法接受任何可迭代对象

    def load(self, iterable):
        self._balls.extend(iterable)

    def pick(self):
        try:
            position = random.randrange(len(self._balls))
        except ValueError:  # 为了兼容 Tombola，我们捕获它，抛出 LookupError
            raise LookupError('pick from empty BingoCage')
        return self._balls.pop(position)

    def loaded(self):   # 覆盖 loaded 方法，避免调用 inspect 方法,从而提升速度
        return bool(self._balls)

    def inspect(self):
        return tuple(sorted(self._balls))
```

### 4.2 检查具体子类
  - 导入时(加载并编译),不会检查
  - 在运行时实例化类时，Python 才会真正检查抽象方法的实现

```python
>>> from tombola import Tombola
>>> class Fake(Tombola):
       def pick(self):
           return 13

>>> Fake
<class '__main__.Fake'>
>>> f = Fake()  #实例化类时检查抽象方法是否实现
Traceback (most recent call last):
File "<stdin>", line 1, in <module>
TypeError:  Can't instantiate abstract class Fake with abstract methods load
```

### 4.3 使用 register 方法声明虚拟子类
注册虚拟子类
  - 语法: abstract_abc.register - 在抽象基类上调用 register 方法
  - 效果:
    - issubclass 和 isinstance 等函数都能识别继承关系，
    - 但是注册的类不会从抽象基类中继承任何方法或属性
  - 检查:
    - Python 不作检查，即便是在实例化时
    - 被注册的类必须满足抽象基类对方法名称和签名的要求，最重要的是要满足底层语义契约

.register:
  - 版本:
    - Python34: 通常作为普通的函数调用，也可以作为装饰器使用
    - Python<34: 只能作为普通函数调用
  - 附注: 更常见的做法是当作函数使用，用于注册其他地方定义的类
  - 使用示例: 注册内置类型
    - https://hg.python.org/cpython/file/3.4/Lib/_collections_abc.py
  ```python
  # 把内置类型 tuple、 str、 range 和 memoryview 注册为 Sequence 的虚拟子类
  Sequence.register(tuple)
  Sequence.register(str)
  Sequence.register(range)
  Sequence.register(memoryview)
  ```

**注册示例**
![声明虚拟子类](/images/fluent_python/abstract_register.png)

```python
from random import randrange
from tombola import Tombola

@Tombola.register           # 把 Tombolist 注册为 Tombola 的虚拟子类
class TomboList(list):      # Tombolist 扩展 list
    def pick(self):
        if self:            # Tombolist 从 list 中继承 __bool__ 方法
            position = randrange(len(self))
            return self.pop(position)  # 调用继承自 list 的 self.pop 方法
        else:
            raise LookupError('pop from empty TomboList')

    load = list.extend

    def loaded(self):
        return bool(self)  # loaded 方法委托 bool 函数

    def inspect(self):
        return tuple(sorted(self))

# Tombola.register(TomboList)

>>> issubclass(TomboList, Tombola)
True
>>> t = TomboList(range(100))
>>> isinstance(t, Tombola)
True
>>> TomboList.__mro__
# (<class 'tombolist.TomboList'>, <class 'list'>, <class 'object'>)
```

分析:
  -  loaded 方法不能采用 load 方法的那种方式，因为 list 类型没有实现 loaded 方法所需的
  \_\_bool\_\_ 方法。而内置的 bool 函数不需要 \_\_bool\_\_ 方法，因为它还可以使用 \_\_len\_\_ 方法
  -  如果是 Python<34，不能把 .register 当作类装饰器使用，必须使用标准的调用句法

\_\_mro\_\_
  - 作用：此类属性指定了类的继承关系，即方法解析顺序
  - 说明：
    - 这个属性的作用很简单，按顺序列出类及其超类， Python 会按照这个顺序搜索方法
    - Tombolist.\_\_mro\_\_ 中没有 Tombola，因此 Tombolist 没有从 Tombola 中继承任何方法

### 4.4 抽象基类自动识别虚拟子类
\_\_subclasshook\_\_
  - 作用: 子类检查的钩子，实现抽象基类的动态接口检查
  - 返回:
    - True: 表示是抽象基类的子类
    - NotImplemented: 让子类检查
  - 限制: 只限于抽象基类
  - 理解:
    - 抽象基类的本质就是几个特殊方法，因此可以不继承或注册虚拟子类，而只要实现特定的方法即可
    - 只要实现的特殊方法能让 \_\_subclasshook\_\_ 返回 True 就可以判定为抽象基类的子类
    - 注意只有提供了 \_\_subclasshook\_\_ 方法的抽象基类才能这么做
  - 源码：
    - 在 Python源码中只只有 Sized 这一个抽象基类实现了 \_\_subclasshook\_\_ 方法，
  而 Sized 只声明了一个特殊方法，因此只用检查这么一个特殊方法。鉴于 \_\_len\_\_ 方法的“特殊性”，我们基
本可以确定它能做到该做的事。但是对其他特殊方法和基本的抽象基类来说，很难这么肯定
  - 自定义：
    - 自己编写的抽象基类中实现 \_\_subclasshook\_\_ 方法，可靠性很低
    - 自己实现的 \_\_subclasshook\_\_ 方法还可以检查方法签名和其他特性，但我觉得不值得这么做

```python
class Sized(metaclass=ABCMeta):
    __slots__ = ()

    @abstractmethod
    def __len__(self):
        return 0

    @classmethod
    def __subclasshook__(cls, C):
        if cls is Sized:
            if any("__len__" in B.__dict__ for B in C.__mro__):  # ➊
                return True  # 返回 True，表明 C 是 Sized 的虚拟子类
        return NotImplemented  # 否则，返回 NotImplemented，让子类检查

>>> class Struggle:
... def __len__(self):  return 23
...
>>> from collections import abc
>>> isinstance(Struggle(), abc.Sized)
True
>>> issubclass(Struggle, abc.Sized)
True
```
示例分析:
  - C.\_\_mro\_\_: C 及其超类
  - 子类检查的细节:  ABCMeta.\_\_subclasscheck\_\_方法的源码
  https://hg.python.org/cpython/file/3.4/Lib/abc.py#l194

Sized:
  - 文档: https://hg.python.org/cpython/file/3.4/Lib/_collections_abc.py#l127

## 5. 利用抽象基类的 API 编写 doctest
**内省类的继承关系**:
  - \_\_subclasses\_\_(): 返回类的直接子类列表，不含虚拟子类
  - \_abc\_registry:
    - 只有抽象基类有这个数据属性，
    - 值是一个 WeakSet 对象，即抽象类注册的虚拟子类的弱引用

```python
# tombola_runner.py:  Tombola 子类的测试运行程序
import doctest
from tombola import Tombola
import bingo, lotto, tombolist, drum  # 用不到也要导入，因为要把那些类载入内存

TEST_FILE = 'tombola_tests.rst'
TEST_MSG = '{0: 16} {1.attempted: 2} tests, {1.failed: 2} failed - {2}'

def main(argv):
    verbose = '-v' in argv
    real_subclasses = Tombola.__subclasses__()  # 内存中存在的直接子代
    virtual_subclasses = list(Tombola._abc_registry)  # 虚拟子类
    for cls in real_subclasses + virtual_subclasses:
        test(cls, verbose)

def test(cls, verbose=False):
    res = doctest.testfile(
            TEST_FILE,
            globs={'ConcreteTombola':  cls},
            verbose=verbose,
            optionflags=doctest.REPORT_ONLY_FIRST_FAILURE)
    tag = 'FAIL' if res.failed else 'OK'
    print(TEST_MSG.format(cls.__name__, res, tag))


if __name__ == '__main__':
    import sys
    main(sys.argv)
```


## 延伸阅读
### Python:
异常的层次结构:
  - 参见 Python 标准库文档中的 5.4. Exception hierarchy
  - https://docs.python.org/dev/library/exceptions.html#exception-hierarchy

```
# 异常类的部分层次结构
BaseException
  ├── SystemExit
  ├── KeyboardInterrupt
  ├── GeneratorExit
  └── Exception
      ├── StopIteration
      ├── ArithmeticError
      │ ├── FloatingPointError
      │ ├── OverflowError
      │ └── ZeroDivisionError
      ├── AssertionError
      ├── AttributeError
      ├── BufferError
      ├── EOFError
      ├── ImportError
      ├── LookupError ➊
      │ ├── IndexError ➋
      │ └── KeyError ➌
      ├── MemoryError
      ... etc.
```

PEP 3119—Introducing Abstract Base Classes
  - https://www.python.org/dev/peps/pep-3119）
  - 讲解了抽象基类的基本原理

PEP 3141—A Type Hierarchy for Numbers
  - https://www.python.org/dev/peps/pep-3141/）
  - 提出了 numbers 模块 https://docs.python.org/3/library/numbers.html 中的抽象基类

### blog:
PyMOTW.com
  - Python Module of the Week, http://pymotw.com
  - abc 模块: https://pymotw.com/2/abc/index.html#why-use-abstract-base-classes

动态类型的优缺点
  -  http://www.artima.com/intv/pycontract.html

### 实用工具  
zope.interface 包
  - 文档：http://docs.zope.org/zope.interface/
  - 作用：提供了一种声明接口的方式(检查对象是否实现了接口，注册提供方，然后查询指定接口的提供方)
  - 应用：这个包为大型 Python 项目（如 Twisted、 Pyramid 和 Plone）的组件式架构提供了灵活的基础
  - blog：A Python Component Architecture 一 文 https://regebro.wordpress.com/2007/11/16/a-python-component-architecture/
   对 zope.interface 包做了介绍
  - 相关书籍：A Comprehensive Guide to Zope Component Architecture http://muthukadan.net/docs/zca.html

### 书籍:
《 Python Cookbook（第 3 版）中文版》
  - 8.12 节定义了一个抽象基类

《 Python 标准库》

## 附注
函数注解：
  - 目的：让程序员在函数定义中使用注解声明参数和返回值的类型，但这是可选的
  - 特性：仅当你想得到注解的好处和限制时才需要添加注解，而且可以在一些函数中添加，在另一些函数中不添加
  - 应用：这个功能主要供 lint 程序、 IDE 和文档生成工具使用。这些工具有个共同点：
  即使类型检查失败了，程序仍能运行
  - 类型提示：
    - PEP 484—Type Hints” https://www.python.org/dev/peps/pep-0484/
    - PEP 482—Literature Overview for Type Hints” https://www.python.org/dev/peps/pep-0482/
      - 概述了第三方 Python 工具和其他语言实现类型提示的方式
    - 支持 PEP 484 的 typing 模块已经纳入Python 3.5

语言类型：
  -  Python 是动态强类型语言
  - 强类型和弱类型：
    - 如果一门语言很少隐式转换类型，说明它是强类型语言；如果经常这么做，说明它是弱类型语言
    - 强类型能及早发现缺陷
    - Java、 C++ 和 Python 是强类型语言。
    - PHP、 JavaScript 和 Perl 是弱类型语言

  - 静态类型和动态类型
    - 在编译时检查类型的语言是静态类型语言，在运行时检查类型的语言是动态类型语言
    - 静态类型需要声明类型
    - 静态类型使得一些工具（编译器和 IDE）便于分析代码、找出错误和提供其他服务（优化、重构，等)
    - 动态类型便于代码重用，代码行数更少，而且能让接口自然成为协议而不提早实行

猴子补丁
  - 优缺点：
    - 补丁通常与目标紧密耦合，因此很脆弱
    - 打了猴子补丁的两个库可能相互牵绊，因为第二个库可能撤销了第一个库的补丁
    - 不过猴子补丁也有它的作用，例如可以在运行时让类实现协议。适配器设计模式通过实现全新的类解决这种问题
  - python：不允许为内置类型打猴子补丁，这一局限能减少外部库打的补丁有冲突的概率

Java、 Go 和 Ruby 的接口
  - java：
    - 不支持类的多重继承，排除了使用抽象类作为接口规范的可能性，因为一个类通常会实现多个接口
    - 但是 Java 添加了 interface 语言结构，而且允许一个类实现多个接口——这是一种多重继承。
    - 以更为明确的方式定义接口是 Java 的一大贡献
    - 在 Java 8 中，接口可以提供方法实现，这叫默认方法，有了这个功能， Java 的接口与
    C++ 和Python 中的抽象类更像了
    https://docs.oracle.com/javase/tutorial/java/IandI/defaultmethods.html
  - GO：
    - 与 Python 相比，对 Go 来说就好像每个抽象基类都实现了 \_\_subclasshook\_\_ 方法，
  它会检查函数的名称和签名，而我们自己从不需要继承或注册抽象基类。如果想让
  Python 更像 Go，可以对所有函数参数做类型检查。
