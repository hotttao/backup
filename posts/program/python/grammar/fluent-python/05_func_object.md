---
weight: 1
title: "函数"
date: 2018-01-05T22:00:00+08:00
lastmod: 2018-01-05T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Python 一等函数"
featuredImage: 

tags: ["python 进阶"]
categories: ["Python"]

lightgallery: true

---

## 1. 函数简介
一等对象:
1. 在运行时创建
2. 能赋值给变量或数据结构中的元素
3. 能作为参数传给函数
4. 能作为函数的返回结果

一等函数:
  - Python 函数是一等对象，又称一等函数
  - 函数对象本身是 **function 类** 的实例

## 2. 函数式风格编程
### 2.1 高阶函数
简介:
  - 定义: 接受函数为参数，或者把函数作为结果返回的函数是高阶函数
  - 典型函数: map、 filter、 reduce
  - 替代操作: 列表推导或生成器表达式具有 map 和 filter 两个函数的功能，而且更易于阅读

版本特性:
  - Python 3 中， map 和 filter 返回生成器（一种迭代器）
  - Python 2 中，这两个函数返回列表
  - Python 2 中， reduce 是内置函数，Python 3 中放到 functools 模块

常用函数:
  - reduce(function, iterable,initializer)
    - 作用：把某个操作连续应用到序列的元素上，累计之前的结果，把一系列值归约成一个值
    - initializer：
      - 如果 iterable 为空， initializer 是返回的结果；否则，在归约中使用它作为第一个参数
      - 因此应该使用恒等值，对 +、 | 和 ^ 来说，initializer 应该是 0；而对 * 和 & 来说，应该是 1
  - all(iterable): 如果 iterable 的每个元素都是真值，返回 True； all([]) 返回 True
  - any(iterable): 只要 iterable 中有元素是真值，就返回 True； any([]) 返回 False

### 2.2 匿名函数
lambda:
  - 语法:
    - Python 简单的句法限制了 lambda 函数的定义体只能使用纯表达式
    - 换句话说，lambda 函数的定义体中不能赋值，也不能使用 while 和 try 等 Python 语句
  - 应用: 作为参数传给高阶函数，除此之外 Python 很少使用匿名函数
  - 限制: 由于句法上的限制，非平凡的 lambda 表达式要么难以阅读，要么无法写出
  - 附注: lambda 句法只是语法糖，与 def 语句一样， lambda 表达式会创建函数对象

### 2.3 支持函数式编程的包
#### operator
```python
>>> [name for name in dir(operator) if not name.startswith('_')]
['abs', 'add', 'and_', 'attrgetter', 'concat', 'contains','countOf',
'delitem', 'eq', 'floordiv', 'ge', 'getitem', 'gt',
'iadd', 'iand', 'iconcat', 'ifloordiv', 'ilshift', 'imod', 'imul',
'index', 'indexOf', 'inv', 'invert', 'ior', 'ipow', 'irshift',
'is_', 'is_not', 'isub', 'itemgetter', 'itruediv', 'ixor', 'le',
'length_hint', 'lshift', 'lt', 'methodcaller', 'mod', 'mul', 'ne',
'neg', 'not_', 'or_', 'pos', 'pow', 'rshift', 'setitem', 'sub',
'truediv', 'truth', 'xor']
```

1. 算术运算符函数:
  - 以 i 开头、后面是另一个运算符的那些名称（如iadd、 iand 等），对应的是增量赋值运算符
  - 如果第一个参数是可变的，那么这些运算符函数会就地修改它；
  - 否则，作用与不带 i 的函数一样，直接返回运算结果。
2. 工厂函数
  - itemgetter: 序列元素获取，会自行构建函数
    - itemgetter(1) == lambda fields:  fields[1]
    - itemgetter(1, 0) == lambda fields:  fields[1]，fields[0]
    - itemgetter 使用 [] 运算符，因此不仅支持序列，
    还支持映射和任何实现 \_\_getitem\_\_ 方法的类
  - attrgetter: 对象属性获取，会自行构建函数
    - attrgetter 与 itemgetter 作用类似，创建的函数根据名称提取对象的属性(使用 .运算符)
    - 如果把多个属性名传给 attrgetter，它也会返回提取的值构成的元组
    - 此外，如果参数名中包含 .（点号）， attrgetter 会深入嵌套对象，获取指定的属性
  - methodcaller: 对象方法调用，会自行创建函数
    -  methodcaller 创建的函数会在对象上调用参数指定的方法

```python
>>> from operator import methodcaller
>>> s = 'The time has come'
>>> upcase = methodcaller('upper')
>>> upcase(s)
'THE TIME HAS COME'
>>> hiphenate = methodcaller('replace', ' ', '-') # 冻结某些参数，也就是部分应用
>>> hiphenate(s)
'The-time-has-come'
```

#### functools
functools.partial
  - 作用: 冻结参数，部分应用一个函数
  - 参数: 第一个参数是一个可调用对象，后面跟着任意个要绑定的定位参数和关键字参数

functools.partialmethod
  - 作用:  Python 3.4 新增，与 partial 一样，不过是用于处理方法

```python
>>> from tagger import tag
>>> tag
<function tag at 0x10206d1e0>
>>> from functools import partial
>>> picture = partial(tag, 'img', cls='pic-frame')
>>> picture(src='wumpus.jpeg')
'<img class="pic-frame" src="wumpus.jpeg" />'
>>> picture
functools.partial(<function tag at 0x10206d1e0>, 'img', cls='pic-frame')
>>> picture.func # functools.partial 对象提供了访问原函数和固定参数的属性
<function tag at 0x10206d1e0>
>>> picture.args
('img',)
>>> picture.keywords
{'cls':  'pic-frame'}
```

## 3. 可调用对象
**判定**: 判断对象能否调用，可以使用内置的 callable() 函数

**Python 7 种可调用对象**:
  1. 用户定义的函数: 使用 def 语句或 lambda 表达式创建
  2. 内置函数: 使用 C 语言（CPython）实现的函数，如 len 或 time.strftime
  3. 内置方法: 使用 C 语言实现的方法，如 dict.get
  4. 方法: 在类的定义体中定义的函数
  5. 类:
    - 调用类时会运行类的 \_\_new\_\_ 方法创建一个实例，然后运行 \_\_init\_\_ 方法，
    初始化实例，最后把实例返回给调用方
    - 因为 Python 没有 new 运算符，所以调用类相当于调用函数
    - 通常，调用类会创建那个类的实例，不过覆盖 \_\_new\_\_ 方法的话，也可能出现其他行为
  6. 类的实例: 如果类定义了  \_\_call\_\_ 方法，那么它的实例可以作为函数调用
  7. 生成器函数:
    - 使用 yield 关键字的函数或方法
    - 调用生成器函数返回的是生成器对象
    - 生成器函数在很多方面与其他可调用对象不同

**自定义的可调用类型**
  - 实现: 只需实现实例方法 \_\_call\_\_
  - 实践: 实现 \_\_call\_\_ 方法的类是创建函数类对象的简便方式

```Python
import random

class BingoCage:

    def __init__(self, items):
        self._items = list(items)  # <1>
        random.shuffle(self._items)  # <2>

    def pick(self):   # <3>
        try:
            return self._items.pop()
        except IndexError:
            raise LookupError('pick from empty BingoCage')  # <4>

    def __call__(self):   # <5>
        return self.pick()
```


## 4. 函数自省
### 4.1 函数特有的属性
```python
>>> class C:  pass # ➊
>>> obj = C() # ➋
>>> def func():  pass # ➌
>>> sorted(set(dir(func)) - set(dir(obj))) # ➍
['__annotations__', '__call__', '__closure__', '__code__', '__defaults__',
'__get__', '__globals__', '__kwdefaults__', '__name__', '__qualname__']
>>>
```

**表5-1: 类的实例没有而函数有的属性列表**

|名称|类型|说明|
|---|---|---|
|\_\_annotations\_\_ |dict| 参数和返回值的注解|
|\_\_call\_\_ |method-wrapper| 实现 () 运算符；即可调用对象协议|
|\_\_closure\_\_ |tuple| 函数闭包，即自由变量的绑定（通常是 None）|
|\_\_code\_\_ |code| 编译成字节码的函数元数据和函数定义体|
|\_\_defaults\_\_ |tuple| 形式参数的默认值|
|\_\_get\_\_ |method-wrapper| 实现只读描述符协议（参见第 20 章）|
|\_\_globals\_\_ |dict| 函数所在模块中的全局变量|
|\_\_kwdefaults\_\_ |dict| 仅限关键字形式参数的默认值|
|\_\_name\_\_ |str| 函数名称|
|\_\_qualname\_\_ |str| 函数的限定名称<br>(https://www.python.org/dev/peps/pep-3155/ ）|

\_\_dict\_\_: 存储用户自定义的属性

### 4.2 获取函数参数信息
#### 参数内省:
  - \_\_defaults\_\_: 元组，保存着定位参数和关键字参数的默认值
  - \_\_kwdefaults\_\_: 元组，保存着仅限关键字参数的默认值
  - \_\_code\_\_: code 对象引用，有很多属性，包括参数的名称

使用示例:
```python
def clip(text, max_len=80):
    """Return text clipped at the last space before or after max_len
    """

>>> from clip import clip
>>> clip.__defaults__
(80,)
>>> clip.__code__ # doctest:  +ELLIPSIS
<code object clip at 0x...>
>>> clip.__code__.co_varnames # 包括参数名称和函数内创建的局部边量
('text', 'max_len', 'end', 'space_before', 'space_after')
>>> clip.__code__.co_argcount # 参数数量
2
```

1. \_\_code\_\_.co_varnames
  - 包括参数名称和函数内创建的局部边量
  - 参数名称是前 N 个字符串， N 的值由\_\_code\_\_.co_argcount 确定
  - 不包含前缀为 \* 或 \*\* 的变长参数
  - 参数的默认值只能通过它们在 \_\_defaults\_\_ 元组中的位置确定，
  因此要从后向前扫描才能把参数和默认值对应起来


#### inspect 模块

```python
>>> from clip import clip
>>> from inspect import signature
>>> sig = signature(clip) # 返回一个 inspect.Signature 对象，
>>> sig #
<inspect.Signature object at 0x...>
>>> str(sig)
'(text, max_len=80)'
>>> for name, param in sig.parameters.items():
... print(param.kind, ': ', name, '=', param.default)

POSITIONAL_OR_KEYWORD :  text = <class 'inspect._empty'>
POSITIONAL_OR_KEYWORD :  max_len = 80
```

inspect:
  - 作用: 函数参数自省
  - 附注:  特殊的 inspect.\_empty 值表示没有默认值

inspect 接口:
  - signature 函数: 返回一个 inspect.Signature 对象
  - Signature 对象:
    - 有一个 parameters属性，这是一个有序映射，
    把参数名和 inspect.Parameter 对象对应起来
    - 有个 bind 方法，它可以把任意个参数绑定到签名中的形参上,所
    用的规则与实参到形参的匹配方式一样。框架可以使用这个方法在真正调用函数前验证参数
  - Parameter 对象: 有 name、 default 和 kind 属性
      - kind是 \_ParameterKind 类中的 5 个值之一
        - POSITIONAL_OR_KEYWORD: 可以通过定位参数和关键字参数传入的形参
        - VAR_POSITIONAL: 定位参数元组
        - VAR_KEYWORD: 关键字参数字典
        - KEYWORD_ONLY: 仅限关键字参数（ Python 3 新增）
        - POSITIONAL_ONLY: 仅限定位参数；目前， Python 声明函数的句法不支持，
        但是有些使用 C 语言实现且不接受关键字参数的函数（如 divmod）支持
  - Parameter 对象还有一个 annotation（注解）属性，值通常是 inspect.\_empty，
  但是可能包含 Python 3 新的注解句法提供的函数签名元数据

Signature.bind 用法

```python
# 展示了 Python 数据模型把实参绑定给函数调用中的形参的机制，这与解释器使用的机制相同
# 框架和 IDE 等工具可以使用这些信息验证代码
>>> import inspect
>>> sig = inspect.signature(tag) # 获取 tag 函数（见示例 5-10）的签名
>>> my_tag = {'name':  'img', 'title':  'Sunset Boulevard',
... 'src':  'sunset.jpg', 'cls':  'framed'}
>>> bound_args = sig.bind(**my_tag) ➋
>>> bound_args # 得到一个 inspect.BoundArguments 对象
<inspect.BoundArguments object at 0x...>
# 迭代 bound_args.arguments（一个 OrderedDict 对象）
>>> for name, value in bound_args.arguments.items():  ➍
... print(name, '=', value)
...
name = img
cls = framed
attrs = {'title':  'Sunset Boulevard', 'src':  'sunset.jpg'}

>>> del my_tag['name'] # 把必须指定的参数 name 从 my_tag 中删除
>>> bound_args = sig.bind(**my_tag)
Traceback (most recent call last):
...
TypeError:  'name' parameter lacking default value
```

#### 框架应用
```python
import bobo

@bobo.query('/')
def hello(person):
  return 'Hello %s!' % person
```
HTTP 微框架 Bobo
  - bobo.query 装饰器把一个普通的函数与框架的请求处理机制集成起来了
  - 内省 hello 函数，发现它需要一个名为 person 的参数，然后从请求中获取那个名称对应的参数，
  将其传给hello 函数

## 5. 函数参数传递与解析
```Python
def tag(name, *content, cls=None, **attrs):
    """Generate one or more HTML tags"""

>>> my_tag = {'name':  'img', 'title':  'Sunset Boulevard',
... 'src':  'sunset.jpg', 'cls':  'framed'}
>>> tag(**my_tag)

>>> def f(a, *, b):  # b 仅限关键词参数，同时不支持数量不定的定位参数
... return a, b
```

参数传递与解析:
  - 调用函数时使用 \* 和 \*\* "展开" 可迭代对象，映射到单个参数
  - \*content 将捕获所有多余的定位参数
  - \*\*attrs 将捕获所有多余的关键词参数
  - cls 参数只能作为关键字参数传入 -- python3 新特性


## 6. 函数注解
注解:
  - 版本: Python 3
  - 作用:
    - 为函数声明中的参数和返回值附加元数据
    - 注解不会做任何处理，只是存储在函数的 \_\_annotations\_\_ 属性
    - 注解对Python 解释器没有任何意义。注解只是元数据
    - 为 IDE 和 lint 程序等工具中的静态类型检查功能提供额外的类型信息
  - 语法:
    - 函数声明中的各个参数可以在 :  之后增加注解表达式
    - 如果参数有默认值，注解放在参数名和 = 号之间
    - 如果想注解返回值，在 ) 和函数声明末尾的 :  之间添加 -> 和一个表达式
    - 注解中最常用的类型是类（如 str 或 int）和字符串（如'int > 0'）


```python34
def clip(text: str, max_len: 'int > 0'=80) -> str:   # <1>
    """Return text clipped at the last space before or after max_len
    """

>>> from clip_annot import clip
>>> clip.__annotations__ # return 键保存的是返回值注解
{'text':  <class 'str'>, 'max_len':  'int > 0', 'return':  <class 'str'>}
```

### 6.2 提取注解
```python
>>> from clip_annot import clip
>>> from inspect import signature
>>> sig = signature(clip)
>>> sig.return_annotation
<class 'str'>
>>> for param in sig.parameters.values():
... note = repr(param.annotation).ljust(13)
... print(note, ': ', param.name, '=', param.default)
<class 'str'> :  text = <class 'inspect._empty'>
'int > 0' :  max_len = 80
```

## 延伸阅读
### Python:
Python3 专有特性:
  - PEP 3102—Keyword-Only Arguments https://www.python.org/dev/peps/pep-3102/
  - PEP 3107—Function Annotations  https://www.python.org/dev/peps/pep-3107/

注解的使用:
  - What are good uses for Python3’s‘ Function Annotations’
  http://stackoverflow.com/questions/3038033/what-are-good-uses-for-python3s-function-annotations
  - What good are Python function annotations?
  http://stackoverflow.com/questions/13784713/what-good-are-python-function-annotations

functools.partial:
  - Python:  Why is functools.partial necessary?
  - http://stackoverflow.com/questions/3252228/python-why-is-functools-partial-necessary

inspect:
  - PEP 362—Function Signature Object https://www.python.org/dev/peps/pep-0362/

### blog:
Python 函数式编程:
  - Python Functional Programming HOWTO
  http://docs.python.org/3/howto/functional.html

### 实用工具  
fn.py:
  - https://github.com/kachayev/fn.py
  - 是为 Python 2 和 Python 3 提供函数式编程支持的包
  - 提供了 Python“所缺少的函数式特性
  - 这个包提供的 @recur.tco 装饰器为 Python 中的无限递归实现了尾调用优化
  - 此外， fn.py 还提供了很多其他函数、数据结构和诀窍

Bobo:
  - 或许是第一个称得上是面向对象的 Web 框架
  - 进一步学习它最近的重写版本，先从“ Introduction” http://bobo.readthedocs.io/en/latest/ 入手
  - Bobo 的一些早期历史 http://discuss.fogcreek.com/joelonsoftware/default.asp?cmd=show&ixPost=94006

### 书籍:
《Python 语言参考手册》:
  - https://docs.python.org/3/reference/datamodel.html#the-standard-type-hierarchy
  对 7 种可调用类型和其他所有内置类型做了介绍

## 杂谈
关于 Bobo
  - 1997 年， Bobo 开创了对象发布概念: 直接把 URL 映射到对象层次结构上，无需配置路由
  - Bobo 还能通过分析处理请求的方法或函数的签名来自动处理 HTTP 查询

Zope:
  - Zope 是 Plone CMS、 SchoolTool、 ERP5 和其他大型Python 项目的基础

ZODB（ Zope Object Database）
  - 事务型对象数据库，提供了 ACID（atomicity, consistency, isolation, and durability，
  原子性、一致性、隔离性和耐久性），它的设计目的是简化 Python 的使用

Krishnamurthi 指出，不要试图把语言归为某一类；相反，把它们视作特性的聚合更有用

Python 函数式编程
  - 从另一门函数式语言（ Haskell）中借用列表推导之后， Python 对 map、
  filter，以及 lambda 表达式的需求极大地减少了
  - 除了匿名函数句法上的限制之外，影响函数式编程惯用法在 Python 中广泛使用的最大
  障碍是缺少尾递归消除（ tail-recursion elimination），这是一项优化措施，在函数的定义体
“末尾”递归调用，从而提高计算函数的内存使用效率
  - Guido 在另一篇博客文章（TailRecursion Elimination， http://neopythonic.blogspot.com/2009/04/tail-recursion-elimination.html）
  中解释了为什么这种优化措施不适合 Python
  - 这篇文章详细讨论了技术论证，不过前三个也是最重要的原因与易用性有关
  Python 作为一门易于使用、学习和教授的语言并非偶然，有 Guido 在为我们把关
  - 综上，从设计上看，不管函数式语言的定义如何， Python 都不是一门函数式语言。
  Python 只是从函数式语言中借鉴了一些好的想法

匿名函数缺陷:
  - 匿名函数都有一个严重的缺点: 没有名称
  - 匿名函数嵌套的层级太深，不利于调试和处理错误
