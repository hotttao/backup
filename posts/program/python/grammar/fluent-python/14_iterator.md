---
weight: 1
title: "迭代器和生成器"
date: 2018-01-14T22:00:00+08:00
lastmod: 2018-01-14T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Python 迭代器和生成器"
featuredImage: 

tags: ["python 进阶"]
categories: ["Python"]

lightgallery: true
---

当我在自己的程序中发现用到了模式，我觉得这就表明某个地方出错了。程序的形式应该仅仅反映它所要解决的问题。代码中其他任何外加的形式都是一个信号，(至少对我来说)表明我对问题的抽象还不够深——这通常意味着自己正在手动完成的事情，本应该通过写代码来让宏的扩展自动实现 — Paul Graham

本章涵盖以下话题:
  - 迭代器与迭代协议
  - 生成器
  - 迭代器与生成器
  - 迭代器模式
  - yield from 语句，生成器和协程
  - 标准库中通用的生成器函数

## 1. python 的迭代模型
### 1.1 迭代协议
![collections.abc](/images/fluent_python/iterator_iterator.png)

```python
# abc.Iterator 类，摘自 Lib/_collections_abc.py
class Iterable(metaclass=ABCMeta):

    __slots__ = ()

    @abstractmethod
    def __iter__(self):
        while False:
            yield None

    @classmethod
    def __subclasshook__(cls, C):
        if cls is Iterable:
            if any("__iter__" in B.__dict__ for B in C.__mro__):
                return True
        return NotImplemented


class Iterator(Iterable):

    __slots__ = ()

    @abstractmethod
    def __next__(self):
        'Return the next item from the iterator. When exhausted, raise StopIteration'
        raise StopIteration

    def __iter__(self):
        return self

    @classmethod
    def __subclasshook__(cls, C):
        if cls is Iterator:
            if (any("__next__" in B.__dict__ for B in C.__mro__) and
                any("__iter__" in B.__dict__ for B in C.__mro__)):
                return True
        return NotImplemented
```
**迭代器**
  - 迭代器是这样的对象: 实现了无参数的 \_\_next\_\_ 方法，返回序列中的下一个元素；
  - 如果没有元素了，那么抛出 StopIteration 异常

**标准的迭代器接口**:
  - \_\_next\_\_: 返回下一个可用的元素，如果没有元素了，抛出 StopIteration 异常
  - \_\_iter\_\_: Iterator 抽象基类实现 \_\_iter\_\_ 方法的方式是返回实例本身，
  以便在需要可迭代对象的地方可以使用迭代器

**标准迭代器特性**:
  1. 因为迭代器只需 \_\_next\_\_ 和 \_\_iter\_\_ 两个方法，所以除了调用 next() 方法，
  以及捕获StopIteration 异常之外，没有办法检查是否还有遗留的元素，也没办法还原
  2. 想再次迭代，那就要调用 iter(...)，传入之前构建迭代器的可迭代对象
  3. 传入迭代器本身没用，因为 Iterator.\_\_iter\_\_ 方法的实现方式是返回实例本身，
  所以传入迭代器无法还原已经耗尽的迭代器

### 1.2 可迭代的对象与迭代器
1. 可迭代的对象:
  - 定义: 使用 iter 内置函数可以获取迭代器的对象
  - 原理:
    - 如果对象实现了能返回迭代器的 \_\_iter\_\_ 方法，那么对象就是可迭代的
    - 实现了 \_\_getitem\_\_ 方法，而且其参数是从零开始的索引，这种对象也可以迭代
2. 二者关系:
  - Python 从可迭代的对象中获取迭代器
  - 可迭代的对象可以迭代，但是可迭代的对象不是迭代器

**检查对象是否可迭代**:
  1. iter(x):
    - 原理: 通过捕获 TypeError 异常
    - 优点: iter(x) 函数会考虑到遗留的 \_\_getitem\_\_ 方法，而 abc.Iterable 类则不考虑
    - 适用: 从 Python 3.4 开始，检查对象 x 能否迭代，最准确的方法
  2. isinstance(f, **abc.Iterable**)
    - 原理: 如果实现了 \_\_iter\_\_ 方法，那么就认为对象是可迭代的，
    因为 abc.Iterable 类实现了 \_\_subclasshook\_\_ 方法
    - 适用: 如果要保存对象，等以后再迭代，可以显式检查，因为这种情况可能需要尽早捕获错误

**检查对象 x 是否为迭代器**:
  - isinstance(x, **abc.Iterator**)
  - 得益于 Iterator.\_\_subclasshook\_\_ 方法，即使对象 x 所属的类不是 Iterator
  类的真实子类或虚拟子类，也能这样检查

### 1.3 iter() 函数
迭代器用于支持
  - for 循环
  - 构建和扩展集合类型
  - 逐行遍历文本文件
  - 列表推导、字典推导和集合推导
  - 元组拆包
  - 调用函数时，使用 * 拆包实参

iter():
- 触发: 解释器需要迭代对象 x 时，会自动调用 iter(x)，包括上述所有情形
- 文档: https://docs.python.org/3/library/functions.html#iter
- 作用:
  1. 如果对象实现了 \_\_iter\_\_ 方法，调用它，获取一个迭代器
  2. 如果没有实现，但是实现了 \_\_getitem\_\_ 方法 Python 会创建一个迭代器，
  尝试按顺序(从索引 0 开始)获取元素
  3. 如果尝试失败，Python 抛出 TypeError 异常
- 说明: 之所以对 \_\_getitem\_\_ 方法做特殊处理，是为了向后兼容，而未来可能不会再这么做
- 特殊用法: iter(x,y)
  - x: 必须是可调用的对象，用于不断调用（没有参数），产出各个值
  - y: 哨符，这是个标记值，当可调用的对象返回这个值时，触发迭代器抛出 StopIteration 异常，而不产出哨符

```Python
>>> def d6():
... return randint(1, 6)
...
>>> d6_iter = iter(d6, 1)
>>> d6_iter
<callable_iterator object at 0x00000000029BE6A0>
>>> for roll in d6_iter:
... print(roll)
...
4
3

with open('mydata.txt') as fp:
  for line in iter(fp.readline, '\n'):
      process_line(line)
```

### 1.4 迭代模式
迭代器模式可用来:
  - 访问一个聚合对象的内容而无需暴露它的内部表示
  - 支持对聚合对象的多种遍历
  - 为遍历不同的聚合结构提供一个统一的接口(即支持多态迭代)

迭代器模式解释:
  - 为了"支持多种遍历"，必须能从同一个可迭代的实例中获取多个独立的迭代器，各个迭代器能维护自身的内部状态
  - 可迭代的对象因此必须实现 \_\_iter\_\_ 方法，每次调用 iter(my\_iterable) 都返回一个独立的迭代器，
  但不能实现 \_\_next\_\_ 方法
  - 迭代器应该一直可以迭代，迭代器的 \_\_iter\_\_ 方法应该返回自身

## 2. 生成器
### 2.2 生成器对象
  - 创建: 使用含有 yield 关键字的函数，或者生成器表达式
  - 类型: types.GeneratorType (生成器－迭代器对象的类型)
  - 文档: https://docs.python.org/3/library/types.html#types.GeneratorType
  - 特性: 所有生成器都是迭代器，因为 GeneratorType 类型的实例实现了迭代器接口

```python
def __iter__(self):
    for match in RE_WORD.finditer(self.text):
        yield match.group()
```
re.finditer:
  - 作用: re.findall 的惰性版本，返回一个生成器，按需生成 re.MatchObject 实例

### 2.3 生成器与迭代器语义对比
1. 实现方式
  - 生成器: 所有生成器都是迭代器，因为 GeneratorType 类型的实例实现了迭代器接口
  - 迭代器: 可以编写不是生成器的迭代器，方法是实现经典的迭代器模式
  - eg: 从这方面看 **enumerate 对象不是生成器**
    ```python
    >>> import types
    >>> e = enumerate('ABC')
    >>> isinstance(e, types.GeneratorType)
    False
    ```
2. 接口
  - 迭代器协议定义了两个方法: \_\_next\_\_ 和 \_\_iter\_\_
  - 生成器对象实现了这两个方法，因此从这方面来看，所有生成器都是迭代器  
3. 迭代器设计模式
  - 迭代器:
    - 用于遍历集合，从中产出元素，是从现有的数据源中读取值
    - 调用 next(it) 时，迭代器不能修改从数据源中读取的值，只能原封不动地产出值
    - eg: 根据迭代器设计模式的原始定义， **enumerate 函数返回的生成器不是迭代器**，
    因为创建的是生成器产出的元组
  - 生成器
    - 可能无需遍历集合就能生成值
    - 即便依附了集合，生成器不仅能产出集合中的元素，还可能会产出派生自元素的其他值。
  - 始终可以使用生成器这个语言结构履行迭代器的基本职责: 遍历集合，并从中产出元素
  - 从概念方面来看，实现方式无关紧要，不使用 Python 生成器对象也能编写生成器  
    ```python
    class Fibonacci:
        def __iter__(self):
            return FibonacciGenerator()

    class FibonacciGenerator:
        def __init__(self):
            self.a = 0
            self.b = 1
        def __next__(self):
            result = self.a
            self.a, self.b = self.b, self.a + self.b
            return result
        def __iter__(self):
            return self
    ```
4. Python 社区
  - 迭代器的完整定义: https://docs.python.org/3/glossary.html#term-iterator
  - 生成器的完整定义: https://docs.python.org/3/glossary.html#termgenerator
  - 在生成器的的定义中迭代器和生成器是同义词，"生成器"指代生成器函数，以及生成器函数构建的生成器对象。
  因此

### 2.2 生成器函数
- 定义: 只要 Python 函数的定义体中有 yield 关键字，该函数就是生成器函数
- 作用: 返回一个生成器对象
- 执行过程:
  1. 生成器函数会创建一个生成器对象，包装生成器函数的定义体
  2. 把生成器传给 next(...)函数时，生成器函数会向前，执行函数定义体中的下一个 yield 语句，
  返回产出的值，并在函数定义体的当前位置暂停
  3. 最终，函数的定义体返回时，外层的生成器对象会抛出 StopIteration 异常
- 版本差异:
  - Python<34: 生成器函数中的 return 语句有返回值，那么会报错
  - Python34: return 语句会导致 StopIteration 异常,调用方可以从异常对象中获取返回值

### 2.3 生成器表达式
理解:
- 可以理解为列表推导的惰性版本:
- 不会迫切地构建列表，而是返回一个生成器，按需惰性生成元素

对比:
  - 生成器表达式: 是语法糖，是创建生成器的简洁句法，这样无需先定义函数再调用
  - 生成器函数:
    - 灵活得多，可以使用多个语句实现复杂的逻辑，也可以作为协程使用
    - 生成器函数有名称，因此可以重用
  - 使用: 如果生成器表达式要分成多行写，倾向于定义生成器函数，以便提高可读性

```python
def __iter__(self):
    return (match.group() for match in RE_WORD.finditer(self.text))
```
示例分析:
  - 这里不是生成器函数了(没有 yield)，而是使用生成器表达式构建生成器
  - 最终的效果一样: 调用 \_\_iter\_\_ 方法会得到一个生成器对象

## 3. Python 新特性
### 3.1 yield from 句法
```python
>>> def chain(*iterables):
... for it in iterables:
... for i in it:
... yield i

>>> def chain(*iterables):
... for i in iterables:
... yield from i
...
>>> list(chain(s, t))
['A', 'B', 'C', 0, 1, 2]
```
yield from 作用:
  1. 语法糖: 从另一个生成器中产出值，避免使用嵌套 for 循化
  2. 协程: 创建通道，把内层生成器直接与外层生成器的客户端联系起来，
  不仅能为客户端代码生成值，还能使用客户端代码提供的值。

### 3.2 协程与迭代器
- 生成器用于生成供迭代的数据
- 协程是数据的消费者
- 虽然在协程中会使用 yield 产出值，但协程与迭代无关，不能这两个概念混为一谈

## 4. 标准库中的生成器函数
### 4.1 os 模块
os.walk:
  -  https://docs.python.org/3/library/os.html#os.walk

### 4.2 用于过滤的生成器函数
|模块|函数|说明|
|: ---|: ---|: ---|
|itertools|compress(it,selector_it)|并行处理两个可迭代的对象；如果selector_it中的元素是真值，产出 it 中对应的元素
|itertools|dropwhile(predicate,it)|处理 it，跳过 predicate 的计算结果为真值的元素，然后产出剩下的各个元素(不再进一步检查) -- 遇到False就直接迭代到最后|
|itertools|takewhile(predicate,it)|predicate 返回真值时产出对应的元素，然后立即停止，不再继续检查 -- 遇到False就会立即停止|
|(内置)|filter(predicate,it)|把 it 中的各个元素传给 predicate，如果 predicate(item) 返回真值，那么产出对应的元素；如果predicate 是 None 那么只产出真值元素|
|itertools|filterfalse(predicate,it)|与 filter 函数的作用类似，不过 predicate 的逻辑是相反的: predicate 返回假值时产出对应的元素|
|itertools|islice(it, stop) 或 islice(it,start,stop,step=1)|产出it的切片，作用类似于 s[: stop] 或 s[start: stop: step]，不过 it 可以是任何可迭代的对象，而且这个函数实现的是惰性操作|


predicate:
  - 布尔函数，有一个参数，会应用到输入中的每个元素上，用于判断元素是否包含在输出中

```python
>>> def vowel(c):
... return c.lower() in 'aeiou'
...
>>> list(filter(vowel, 'Aardvark'))
['A', 'a', 'a']
>>> import itertools
>>> list(itertools.filterfalse(vowel, 'Aardvark'))
['r', 'd', 'v', 'r', 'k']
>>> list(itertools.dropwhile(vowel, 'Aardvark'))
['r', 'd', 'v', 'a', 'r', 'k']
>>> list(itertools.takewhile(vowel, 'Aardvark'))
['A', 'a']
>>> list(itertools.compress('Aardvark', (1,0,1,1,0,1)))
['A', 'r', 'd', 'a']
>>> list(itertools.islice('Aardvark', 4))
['A', 'a', 'r', 'd']
>>> list(itertools.islice('Aardvark', 4, 7))
['v', 'a', 'r']
>>> list(itertools.islice('Aardvark', 1, 7, 2))
['a', 'd', 'a']
```

## 4.3 用于映射的生成器函数
|模块|函数|说明|
|: ---|: ---|: ---|
|itertools| accumulate(it, [func]) |产出累积的总和；如果提供了 func，那么把前两个元素传给它，然后把计算结果和下一个元素传给它，以此类推，最后产出结果
|(内置)|enumerate(iterable, start=0)|产出由两个元素组成的元组，结构是 (index, item)，其中index 从 start 开始计数， item 则从 iterable 中获取
|(内置)|map(func, it1, [it2, ..., itN])|把 it 中的各个元素传给 func，产出结果；如果传入 N 个可迭代的对象，那么 func 必须能接受 N 个参数，而且要并行处理各个可迭代的对象
|itertools|starmap(func, it)|把 it 中的各个元素传给 func，产出结果；输入的可迭代对象应该产出可迭代的元素 iit，然后以 func(*iit) 这种形式调用 func
附注: 如果输入来自多个可迭代的对象，第一个可迭代的对象到头后就停止输出

```python
>>> sample = [5, 4, 2, 8, 7, 6, 3, 0, 9, 1]
>>> list(itertools.accumulate(sample, operator.mul)) # ➍
[5, 20, 40, 320, 2240, 13440, 40320, 0, 0, 0]
>>> list(enumerate('albatroz', 1)) # ➊
[(1, 'a'), (2, 'l'), (3, 'b'), (4, 'a'), (5, 't'), (6, 'r'), (7, 'o'), (8, 'z')]
>>> import operator
>>> list(map(operator.mul, range(11), range(11))) # ➋
[0, 1, 4, 9, 16, 25, 36, 49, 64, 81, 100]
>>> list(itertools.starmap(operator.mul, enumerate('albatroz', 1))) # ➎
['a', 'll', 'bbb', 'aaaa', 'ttttt', 'rrrrrr', 'ooooooo', 'zzzzzzzz']
```

### 4.4 用于合并的生成器函数
|模块|函数|说明|
|: ---|: ---|: ---|
|itertools|chain(it1, ..., itN)|先产出 it1 中的所有元素，然后产出 it2 中的所有元素，以此类推，无缝连接在一起|
|itertools|chain.from_iterable(it)|产出 it 生成的各个可迭代对象中的元素，一个接一个，无缝连接在一起； it 应该产出可迭代的元素，例如可迭代的对象列表
|itertools|product(it1, ...,itN, repeat=1)|计算笛卡儿积: 从输入的各个可迭代对象中获取元素，合并成由 N个元素组成的元组，与嵌套的 for 循环效果一样； repeat 指明重复 N 次处理输入的各个可迭代对象|
|(内置)|zip(it1, ..., itN)|并行从输入的各个可迭代对象中获取元素，产出由 N 个元素组成的元组，只要有一个可迭代的对象到头了，就默默地停止
|itertools|zip_longest(it1, ...,itN, fillvalue=None)|并行从输入的各个可迭代对象中获取元素，产出由 N 个元素组成的元组，等到最长的可迭代对象到头后才停止，空缺的值使用 fillvalue 填充|

```Python
>>> list(itertools.chain('ABC', range(2))) # ➊
['A', 'B', 'C', 0, 1]
>>> list(itertools.chain.from_iterable(enumerate('ABC'))) # ➌
[0, 'A', 1, 'B', 2, 'C']
>>> list(itertools.product('ABC', repeat=2)) # ➍
[('A', 'A'), ('A', 'B'), ('A', 'C'), ('B', 'A'), ('B', 'B'),
('B', 'C'), ('C', 'A'), ('C', 'B'), ('C', 'C')]
>>> rows = itertools.product('AB', range(2), repeat=2)
>>> for row in rows: print(row)
...
('A', 0, 'A', 0)
('A', 0, 'A', 1)
('A', 0, 'B', 0)
...
```
### 4.5 扩展可迭代对象的生成器函数
**把各个元素扩展成多个输出元素的生成器函数**

|模块|函数|说明|
|: ---|: ---|: ---|
|itertools|combinations(it,out_len)|把 it 产出的 out_len 个元素组合在一起，然后产出|
|itertools|combinations_with_replacement(it, out_len)|把 it 产出的 out_len 个元素组合在一起，然后产出，包含相同元素的组合|
|itertools|count(start=0, step=1)|从 start 开始不断产出数字，按 step 指定的步幅增加|
|itertools|cycle(it)|从 it 中产出各个元素，存储各个元素的副本，然后按顺序重复不断地产出各个元素|
|itertools|permutations(it,out_len=None)|把 out_len 个 it 产出的元素排列在一起，然后产出这些排列； out_len 的默认值等于 len(list(it))|
|itertools|repeat(item, [times])|重复不断地产出指定的元素，除非提供 times，指定次数|

```python
>>> list(itertools.islice(itertools.count(1, .3), 3)) # ➍
[1, 1.3, 1.6]
>>> cy = itertools.cycle('ABC') # ➎
>>> next(cy)
'A'
>>> list(itertools.islice(cy, 7)) # ➏
['B', 'C', 'A', 'B', 'C', 'A', 'B']
>>> list(map(operator.mul, range(11), itertools.repeat(5))) # ➒
[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]

# 组合学生成器
>>> list(itertools.combinations('ABC', 2)) #  每两个元素的各种组合，顺序无关紧要
[('A', 'B'), ('A', 'C'), ('B', 'C')]     
>>> list(itertools.combinations_with_replacement('ABC', 2)) # 包括相同元素的组合
[('A', 'A'), ('A', 'B'), ('A', 'C'), ('B', 'B'), ('B', 'C'), ('C', 'C')]
>>> list(itertools.permutations('ABC', 2)) # 元素的顺序有重要意义
[('A', 'B'), ('A', 'C'), ('B', 'A'), ('B', 'C'), ('C', 'A'), ('C', 'B')]
>>> list(itertools.product('ABC', repeat=2)) # 笛卡儿积
[('A', 'A'), ('A', 'B'), ('A', 'C'), ('B', 'A'), ('B', 'B'), ('B', 'C'),
('C', 'A'), ('C', 'B'), ('C', 'C')]
```

### 4.6 重新排列元素的生成器函数
|模块|函数|说明|
|: ---|: ---|: ---|
|itertools|groupby(it,key=None)|产出由两个元素组成的元素，形式为 (key, group)，其中 key 是分组标准，group 是生成器，用于产出分组里的元素
|itertools|tee(it, n=2)|产出一个由 n 个生成器组成的元组，每个生成器用于单独产出输入的可迭代对象中的元素|
|(内置)|reversed(seq)|从后向前，倒序产出seq中的元素；seq必须是序列，或者是实现了 \_\_reversed\_\_ 特殊方法的对象

reversed
  - 函数从后向前产出元素，而只有序列的长度已知时才能工作
  - 这个函数会按需产出各个元素，因此无需创建反转的副本

```python
>>> list(itertools.groupby('LLLLAAGGG')) # ➊
[('L', <itertools._grouper object at 0x102227cc0>),
('A', <itertools._grouper object at 0x102227b38>),
('G', <itertools._grouper object at 0x102227b70>)]
>>> for char, group in itertools.groupby('LLLLAAAGG'): # ➋
... print(char, '->', list(group))
...
L -> ['L', 'L', 'L', 'L']
A -> ['A', 'A',]
G -> ['G', 'G', 'G']

>>> animals = ['duck', 'eagle', 'rat', 'giraffe', 'bear',
... 'bat', 'dolphin', 'shark', 'lion']
>>> animals.sort(key=len)  #  为了使用 groupby 函数，要排序输入
>>> for length, group in itertools.groupby(animals, len): # ➍
... print(length, '->', list(group))
...
3 -> ['rat', 'bat']
4 -> ['duck', 'bear', 'lion']
5 -> ['eagle', 'shark']
7 -> ['giraffe', 'dolphin']
```

```python
>>> list(itertools.tee('ABC'))
[<itertools._tee object at 0x10222abc8>, <itertools._tee object at 0x10222ac08>]
>>> list(zip(*itertools.tee('ABC')))
[('A', 'A'), ('B', 'B'), ('C', 'C')]
```

## 5. 可迭代的归约函数
归约函数: 接受一个可迭代的对象，然后返回单个结果

|模块|函数|说明|
|: ---|: ---|: ---|
|(内置)|all(it)|it 中的所有元素都为真值时返回 True，否则返回 False； all([]) 返回 True|
|(内置)|any(it)|只要 it 中有元素为真值就返回 True，否则返回 False； any([]) 返回 False|
|(内置)|max(it, [key=,][default=])|返回 it 中值最大的元素； key 是排序函数，与 sorted 函数中的一样；如果可迭代的对象为空，返回 default|
|(内置)|min(it, [key=,][default=])|返回 it 中值最小的元素； key 是排序函数，与 sorted 函数中的一样；如果可迭代的对象为空，返回 default|
|functools|reduce(func, it,[initial])|把前两个元素传给 func，然后把计算结果和第三个元素传给 func，以此类推，返回最后的结果；如果提供了 initial，把它当作第一个元素传入|
|(内置)|sum(it, start=0)| it 中所有元素的总和，如果提供可选的 start，会把它加上(计算浮点数的加法时，可以使用 math.fsum 函数提高精度)|

附注:
  - 也可以像这样调用: max(arg1, arg2, ..., [key=?])， 此时返回参数中的最大值。
  - 也可以像这样调用: min(arg1, arg2, ..., [key=?])， 此时返回参数中的最小值。
  - sorted:
    - 接受一个可迭代的对象
    - 构建并返回真正的列表。

```python
>>> g = (n for n in [0, 0.0, 7, 8])
>>> any(g)
True
>>> next(g)
8
```

## 延伸阅读
### Python:
Yield expressions
  - 从技术层面深入说明了生成器 https://docs.python.org/3/reference/expressions.html#yieldexpr
  - 定义生成器函数的 PEP 是 " PEP 255—Simple Generators" https://www.python.org/dev/peps/pep-0255/

itertools
  - https://docs.python.org/3/library/itertools.html
  - "Itertools Recipes" https://docs.python.org/3/library/itertools.html#itertools-recipes
  说明如何使用 itertools 模块中的现有函数实现额外的高性能函数

### blog:
协程:
  - 作者: David Beazley（可能是 Python 社区中在协程方面最多产的作者和演讲者）
  - URL: http://www.dabeaz.com/coroutines/

yeild from
  - " What’s New in Python 3.3"通过示例说明了 yield from 句法
  - 参见" PEP 380: Syntax for Delegating to a Subgenerator"， https://docs.python.org/3/whatsnew/3.3.html#pep-380-syntax-for-delegating-to-a-subgenerator）

### 实用工具  
文档数据库
  - " From ISIS to CouchDB: Databases and Data Models for Bibliographic Records"
  http://journal.code4lib.org/articles/4893

### 书籍:
《 Python Cookbook（第 3 版）中文版》
  - 第 4章有 16 个诀窍涵盖了这个话题

## 附注
```python
def f():
  def do_yield(n):
    yield n
  x = 0
  while True:
    x += 1
    do_yield(x)

def f():
  def do_yield(n):
    yield n
  x = 0
  while True:
    x += 1
    yeild from do_yield(x)
```
示例分析:
  - 如果调用示例 14-24 中的 f()，会得到一个无限循环，而不是生成器，因为 yield
  关键字只能把最近的外层函数变成生成器函数。
  - 虽然生成器函数看起来像函数，可是我们不能通过简单的函数调用把职责委托给另一个生成器函数
  - Python 新引入的 yield from 句法允许生成器或协程把工作委托给第三方完成
  - 沿用 def 声明生成器犯了可用性方面的错误，而 Python 2.5 引入的协程（也写成包含
  yield 关键字的函数）把这个问题进一步恶化了。
  - 尽管有一些相同之处，但是生成器和协程基本上是两个不同的概念
  - 协程经常会用到特殊的装饰器，这样就能与其他的函数区分开。可是，生成器函数不常使用装饰器，因此我们不
得不扫描函数的定义体，看有没有 yield 关键字，以此判断它究竟是普通的函数，还是完全不同的洪水猛兽
