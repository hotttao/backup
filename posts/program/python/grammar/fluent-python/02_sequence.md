---
weight: 1
title: "序列"
date: 2018-01-02T22:00:00+08:00
lastmod: 2018-01-02T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Python 序列，迭代器与生成器"
featuredImage: 

tags: ["python 进阶"]
categories: ["Python"]

lightgallery: true
---

## 1. 内置序列类型概览
1. **容器序列**:
  - 能存放不同类型的数据
  - 序列内存放的是它们所包含的任意类型的对象的引用
  - 包括
    - list
    - tuple
    - collections.deque 这些序列  
2. **扁平序列**:
  - 只能容纳一种类型
  - 序列里存放的是值而不是引用
  - 扁平序列是一段连续的内存空间，更加紧凑
  - 但只能存放诸如字符、字节和数值这种基础类型
  - 包括
    - str、 bytes、 bytearray
    - memoryview
    - array.array
3. **可变序列**
  - 包括
    - list、 bytearray、
    - array.array、
    - collections.deque
    - memoryview
4. **不可变序列**
  - 包括
    - tuple、 str 和 bytes

![内置序列类型概览](/images/fluent_python/sequence_abc.png)

## 2. 内置序列类型
### 2.1 列表
#### 列表推导
  - list comprehension 简称为 listcomps
  - 适用: 只用列表推导来创建新的列表，并且尽量保持简短
  - 特点:
    - Python3 列表推导有局部作用域，不会有变量泄漏的问题
    - Python2 在列表推导中 for 关键词之后的赋值操作可能会影响列表推导上下文中的同名变量

```python
Python 2.7.6 (default, Mar 22 2014, 22: 59: 38)
[GCC 4.8.2] on linux2
Type "help", "copyright", "credits" or "license" for more information.
>>> x = 'my precious'
>>> dummy = [x for x in 'ABC']
>>> x
'C'
```
#### 生成器表达式
  - generator expression 简称为 genexps
  - 语法: 与列表推导类似，把方括号换成圆括号
  - 特点: 遵守了迭代器协议，可以逐个地产出元素

```python
>>> symbols = '$¢£¥€¤'
>>> tuple(ord(symbol) for symbol in symbols) ➊
(36, 162, 163, 165, 8364, 164)
>>> import array
>>> array.array('I', (ord(symbol) for symbol in symbols)) ➋
array('I', [36, 162, 163, 165, 8364, 164])
```

### 2.2 元组
#### 元组拆包
  - 适用: 可以应用到任何可迭代对象上
  - 要求: 被可迭代对象中的元素数量必须要跟接受这些元素的空档数一致
  - 语法:  Python3
    - \* 表示忽略多余元素
    - 平行赋值中， * 前缀只能用在一个变量名前面，但是这个变量可以出现在赋值表达式的任意位置
    - 可以是嵌套的，只要接受元组的嵌套结构符合表达式本身的嵌套结构

```python
>>> lax_coordinates = (33.9425, -118.408056)
>>> latitude, longitude = lax_coordinates # 元组拆包

>>> t = (20, 8)
>>> divmod(*t)

>>> import os
>>> _, filename = os.path.split('/home/luciano/.ssh/idrsa.pub')

>>> a, b, *rest = range(5)
>>> a, b, rest
(0, 1, [2, 3, 4])

>>> a, *body, c, d = range(5)
>>> a, body, c, d
(0, [1, 2], 3, 4)

>>> metro_areas = ('Tokyo','JP',36.933,(35.689722,139.691667))
>>> a, b, c, (d, e) =  metro_areas
```

#### 具名元组
collections.namedtuple
  - 作用: 工厂函数，用来构建一个带字段名的元组和一个有名字的类
  - 特点:
    - 实例所消耗的内存跟元组是一样的,因为字段名都被存在对应的类里面
    - 实例跟普通的对象实例比起来也要小一些，因为Python 不会用 \_\_dict\_\_ 来存放这些实例的属性
  - 专有属性:
    - 类属性 \_fields: 包含这个类所有字段名称的元组
    - 类方法 \_make(iterable): 接受一个可迭代对象来生成这类的实例
    - 实例方法 \_asdict(): 把具名元组以 collections.OrderedDict 的形式返回

```python
>>> from collections import namedtuple
>>> City = namedtuple('City', 'name country population coordinates') ➊
>>> tokyo = City('Tokyo', 'JP', 36.933, (35.689722, 139.691667)) ➋
>>> tokyo
City(name='Tokyo', country='JP', population=36.933, coordinates=(35.689722,
139.691667))
>>> tokyo.population ➌
36.933

>>> City._fields ➊
('name', 'country', 'population', 'coordinates')
>>> delhi_data = ('Delhi NCR', 'IN', 21.935, (28.613889, 77.208889))
>>> delhi = City._make(delhi_data) ➋
>>> delhi._asdict() ➌
OrderedDict([('name', 'Delhi NCR'), ('country', 'IN'), ('population',
21.935), ('coordinates', (lat=28.613889, long=77.208889))])
```

#### 列表与元组对比
|方法|列表|元组|作用|
|: ---|: ---|: ---|: ---|
|s.\_\_add\_\_(s2) |•| • |s + s2，拼接|
|s.\_\_iadd\_\_(s2)|•| |s += s2，就地拼接|
|s.append(e) |•| |在尾部添加一个新元素|
|s.clear() |•| |删除所有元素|
|s.\_\_contains\_\_(e)| •| •| s 是否包含 e|
|s.copy() |•| |列表的浅复制|
|s.count(e) |• |• |e 在 s 中出现的次数|
|s.\_\_delitem\_\_(p) |•| |把位于 p 的元素删除|
|s.extend(it) |•| |把可迭代对象 it 追加给 s|
|s.\_\_getitem\_\_(p) |•| •| s[p]，获取位置 p 的元素|
|s.\_\_getnewargs\_\_()| |•| 在 pickle 中支持更加优化的序列化|
|s.index(e) |•| •| 在 s 中找到元素 e 第一次出现的位置|
|s.insert(p, e) |•| |在位置 p 之前插入元素 e|
|s.\_\_iter\_\_() |•| •| 获取 s 的迭代器|
|s.\_\_len\_\_() |•| •| len(s)，元素的数量|
|s.\_\_mul\_\_(n) |•| •| s * n， n 个 s 的重复拼接|
|s.\_\_imul\_\_(n) |•| |s *= n，就地重复拼接|
|s.\_\_rmul\_\_(n) |•| •| n * s，反向拼接 *|
|s.pop([p]) |• | |删除最后或者是（可选的）位于 p 的元素，并返回它的值|
|s.remove(e) |•| |删除 s 中的第一次出现的 e|
|s.reverse() |•| |就地把 s 的元素倒序排列|
|s.\_\_reversed\_\_() |•| |返回 s 的倒序迭代器|
|s.\_\_setitem\_\_(p, e) |• | |s[p] = e，把元素 e放在位置 p，替代已经在那个位置的元素|
|s.sort([key], [reverse]) |•| |就地对 s 中的元素进行排序，可选的参数有键（ key）和是否倒序（ reverse）|

## 3. 序列用法
### 3.1 切片用法
#### 实现概览
seq[a\: b\: c]
  - a\: b\: c - 只能作为索引或者下标用在 [] 中来返回一个切片对象:  slice(a, b, c)
  - 求值的时候， Python会调用 seq.\_\_getitem\_\_(slice(start, stop, step))

#### 用法概览
1. 可以给切片命名,比用硬编码的数字区间要方便得多
2. 多维切片 - 以逗号分开的多个索引或者是切片
  - 实现: 要得到 a[i, j] 的值， Python 会调用 a.\_\_getitem\_\_((i, j))
  - 附注: Python 内置的序列类型都是一维的，只支持单一的索引
3. 省略
  - 语法: 正确书写方法是三个英语句号（...）
  - 实现: 省略在 Python 解析器眼里是一个符号，而实际上它是 Ellipsis 对
象的别名，而 Ellipsis 对象又是 ellipsis 类的单一实例;  可以当作切片规范的一部分，
也可以用在函数的参数清单中，比如 f(a, ..., z)，或 a[i: ...]
  - 应用: numpy  eg: 如果 x 是四维数组，那么 x[i, ...] 就是 x[i, : , : , : ]
  - 附注: 还未发现 Python 标准库里有任何 Ellipsis 或者是多维索引的用法
4. 给切片赋值
  - 用法: 把切片放在赋值语句的左边，或把它作为 del 操作的对象
  - 语法: 如果赋值的对象是一个切片，那么赋值语句的右侧必须是个可迭代对象
```python
>>> l = list(range(10))
>>> l
[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
>>> l[2: 5] = [20, 30]
>>> l
[0, 1, 20, 30, 5, 6, 7, 8, 9]
>>> del l[5: 7]
>>> l
[0, 1, 20, 30, 5, 8, 9]
>>> l[3: : 2] = [11, 22]
>>> l
[0, 1, 20, 11, 5, 22, 9]
>>> l[2: 5] = 100 ➊
Traceback (most recent call last):
File "<stdin>", line 1, in <module>
TypeError:  can only assign an iterable
>>> l[2: 5] = [100]
>>> l
[0, 1, 100, 22, 9]
```

### 3.2 对序列使用+和*
```Python
>>> board = [['_'] * 3 for i in range(3)]
>>> board[1][2] = 'X'
>>> board
[['_', '_', '_'], ['_', '_', 'X'], ['_', '_', '_']]

>>> weird_board = [['_'] * 3] * 3
>>> weird_board[1][2] = 'O'
>>> weird_board
[['_', '_', 'O'], ['_', '_', 'O'], ['_', '_', 'O']]
```

### 3.3 序列的增量赋值
#### 增量的实现
seq+=a:
  - 实现:
    - 如果seq实现了 \_\_iadd\_\_(就地加法)， 调用此方法
    - 未实现，表达式相当于 seq = seq + a，调用seq.\_\_add\_\_(a) 返回一个新对象
    并赋值给seq
  - 可变序列: 一般都实现了  \_\_iadd\_\_ 方法，因此 += 是就地加法
  - 不可变序列: 不支持这个操作，使用\_\_add\_\_方法返回一个新对象

#### 性能问题
1. 对不可变序列进行重复拼接操作的话，效率会很低，因为每次都有一个新对象，而解释器
需要把原来对象中的元素先复制到新的对象里，然后再追加新的元素
2. str 是一个例外，因为对字符串做 += 实在是太普遍了，所以 CPython 对它做了优化;  
为 str 初始化内存的时候，程序会为它留出额外的可扩展空间，因此进行增量操作的时候，
并不会涉及复制原有字符串到新位置这类操作

#### 关于+=的谜题
```Python
>>> t = (1, 2, [30, 40])
>>> t[2] += [50, 60]
Traceback (most recent call last):
File "<stdin>", line 1, in <module>
TypeError:  'tuple' object does not support item assignment
>>> t
(1, 2, [30, 40, 50, 60])

>>> dis.dis('s[a] += b')
1 0 LOAD_NAME 0(s)
3 LOAD_NAME 1(a)
6 DUP_TOP_TWO
7 BINARY_SUBSCR ➊  # 将 s[a] 的值存入 TOS（ Top Of Stack，栈的顶端）
8 LOAD_NAME 2(b)
11 INPLACE_ADD ➋  # 计算 TOS += b。这一步能够完成，是因为 TOS 指向的是一个可变对象
12 ROT_THREE
13 STORE_SUBSCR ➌ # s[a] = TOS 赋值。这一步失败，是因为 s 是不可变的元组
14 LOAD_CONST 0(None)
17 RETURN_VALUE
```

注意:
  - 不要把可变对象放在元组里面
  - 增量赋值不是一个原子操作
  - 写成 t[2].extend([50, 60]) 就能避免这个异常

### 3.4 list.sort方法和 sorted函数
1. list.sort 方法
  - 就地排序列表，不会把原列表复制一份，返回 None
2. 内置函数 sorted
  - 新建一个列表作为返回值
  - 可以接受任何形式的可迭代对象作为参数，甚至包括不可变序列或生成器
  - 不管接受的是怎样的参数，最后都会返回一个列表
3. 可选参数(二者都有)
  - reverse - 默认为False，升序输出;  True 降序输出
  - key - 只有一个参数的函数，用于产生排序比较的对比关键字，默认用元素自己的值来排序
  - 附注: 排序算法是稳定的

### 3.5 用bisect来管理已排序的序列
bisect(a, x[, lo[, hi]])
  - a: 一个有序的序列
  - x: 待查找元素
  - lo: 默认值是 0，用于限定搜索的下线
  - hi: 默认值是序列的长度，用于限定搜索的上线
  - 作用: 返回一个位置，该位置前面的 a 的值，都小于或等于 needle 的值
  - 应用: 在很长的有序序列中作为 index 的替代，用来更快地查找一个元素的位置
  - bisect_right==bisect - 返回跟它相等的元素之后的位置
  - bisect_left - 返回跟它相等的元素之前的位置
```python
>>> def grade(score, breakpoints=[60, 70, 80, 90], grades='FDCBA'):
... i = bisect.bisect(breakpoints, score)
... return grades[i]
...
>>> [grade(score) for score in [33, 99, 77, 70, 89, 90, 100]]
['F', 'A', 'C', 'C', 'B', 'A', 'A']
```

insort(seq, item[, lo[, hi]]):
  - 作用: 有序插入，把变量 item 插入到序列 seq 中，并能保持 seq 的升序顺序
  - insort_right == insort - 在 insect_right 返回的位置插入
  - insort_left - 在bisect_left 返回的位置插入

## 4. 列表的可替换类型
### 4.1 数组
array.array:
  - 只允许存放指定类型数字，通过构造函数中的类型码参数指定
  - 直接存放的数字的字节，而不是对象的引用，效率更高，内存更小
  - 支持所有跟可变序列有关的操作

**表2-2: 列表和数组的属性和方法**  

|方法|列表|数组|作用|
|: ---|: ---|: ---|: ---|
|s.\_\_add(s2)\_\_ |•| •| s + s2 ，拼接|
|s.\_\_iadd(s2)\_\_ |•| •| s += s2 ，就地拼接|
|s.append(e) |• |• |在尾部添加一个元素|
|s.byteswap ||• |翻转数组内每个元素的字节序列，转换字节序|
|s.clear() |• | |删除所有元素|
|s.\_\_contains\_\_(e) |• |• |s 是否含有 e|
|s.copy() |• | |对列表浅复制|
|s.\_\_copy\_\_() | |•| 对 copy.copy 的支持|
|s.count(e) |• |• |s 中 e 出现的次数|
|s.\_\_deepcopy\_\_() |•| |对 copy.deepcopy 的支持|
|s.\_\_delitem\_\_(p) |•| •| 删除位置 p 的元素|
|s.extend(it) |• |• |将可迭代对象 it 里的元素添加到尾部|
|s.frombytes(b)  | |• |将压缩成机器值的字节序列读出来添加到尾部|
|s.fromfile(f, n) ||•| 将二进制文件 f 内含有机器值读出来添加到尾部，最多添加 n 项|
|s.fromlist(l) | |•| 将列表里的元素添加到尾部，如果其中任何一个元素导致了TypeError 异常，那么所有的添加都会取消|
|s.\_\_getitem\_\_(p) |• |• |s[p]，读取位置 p 的元素|
|s.index(e) |• |• |找到 e 在序列中第一次出现的位置|
|s.insert(p, e) |• |• |在位于 p 的元素之前插入元素 e|
|s.itemsize | |• |数组中每个元素的长度是几个字节|
|s.\_\_iter\_\_() |• |• |返回迭代器|
|s.\_\_len\_\_() |• |• |len(s)，序列的长度|
|s.\_\_mul\_\_(n) |• |•| s * n，重复拼接|
|s.\_\_imul\_\_(n) |• |• |s *= n ，就地重复拼接|
|s.\_\_rmul\_\_(n) |• |• |n * s ，反向重复拼接 *|
|s.pop([p]) |• |• |删除位于 p 的值并返回这个值， p 的默认值是最后一个元素的位置|
|s.remove(e) |• |• |删除序列里第一次出现的 e 元素|
|s.reverse() |• |• |就地调转序列中元素的位置|
|s.\_\_reversed\_\_() |• | |返回一个从尾部开始扫描元素的迭代器|
|s.\_\_setitem\_\_(p, e) |•| •| s[p] = e，把位于 p 位置的元素替换成 e|
|s.sort([key], [revers]) |•| | 就地排序序列，可选参数有 key 和 reverse|
|s.tobytes() ||• | 把所有元素的机器值用 bytes 对象的形式返回|
|s.tofile(f) | |• | 把所有元素以机器值的形式写入一个文件|
|s.tolist() | |•| 把数组转换成列表，列表里的元素类型是数字对象|
|s.typecode | |• | 返回只有一个字符的字符串，代表数组元素|

附注: python3.4 后数组不再支持 array.sort()方法
`a = array.array(a.typecode, sorted(a))`

```python
>>> from array import array ➊
>>> from random import random
>>> floats = array('d', (random() for i in range(10**7))) ➋
>>> floats[-1] ➌
0.07802343889111107
>>> fp = open('floats.bin', 'wb')
>>> floats.tofile(fp)
>>> fp.close()

>>> floats2 = array('d') ➎
>>> fp = open('floats.bin', 'rb')
>>> floats2.fromfile(fp, 10**7) ➏
>>> fp.close()
>>> floats2[-1] ➐
0.07802343889111107
>>> floats2 == floats ➑
True
```

### 4.2 内存视图
memoryview:
  - 作用：允许在二进制数据结构之间共享内存,
    - 通过其他二进制序列、打包的数组构建 memoryvideo对象时，不会复制字节序列
    - 对 memoryview 对象的切片，也不会复制字节序列
  - 介绍:
    - <http://stackoverflow.com/questions/4845418/when-should-a-memoryview-be-used/>
    - <https://docs.python.org/3/library/stdtypes.html#memory-views>

memoryview.cast
  - 类似于类型转换，能用不同的方式读写同一块内存数据

```python
# 通过改变数组中的一个字节来更新数组里某个元素的值 44 页
>>> numbers = array.array('h', [-2, -1, 0, 1, 2])
>>> memv = memoryview(numbers) ➊
>>> len(memv)
5
>>> memv[0] ➋
-2
>>> memv_oct = memv.cast('B') ➌
>>> memv_oct.tolist() ➍
[254, 255, 255, 255, 0, 0, 1, 0, 2, 0]
>>> memv_oct[5] = 4 ➎
>>> numbers
array('h', [-2, -1, 1024, 1, 2])
```

### 4.3 Numpy 和 Scipy
Numpy:
  - 实现了多维同质数组(homogeneous array)和矩阵
  - 这些数据结构不但能处理数字，还能存放其他由用户定义的记录
```python
>>> import numpy
>>> floats = numpy.loadtxt('floats-10M-lines.txt') ➊
>>> floats[-3: ] ➋
array([ 3016362.69195522, 535281.10514262, 4566560.44373946])
>>> floats *= .5 ➌
>>> floats[-3: ]
array([ 1508181.34597761, 267640.55257131, 2283280.22186973])
>>> from time import perf_counter as pc ➍ # 导入精度和性能都比较高的计时器 >=3.3
>>> t0 = pc();  floats /= 3;  pc() - t0 ➎
0.03690556302899495
>>> numpy.save('floats-10M', floats) ➏ # 把数组存入后缀为 .npy 的二进制文件
# load 方法利用了一种叫作内存映射的机制，在内存不足的情况下仍然可以对数组做切片
>>> floats2 = numpy.load('floats-10M.npy', 'r+') ➐
>>> floats2 *= 6
>>> floats2[-3: ] ➑
memmap([3016362.69195522, 535281.10514262, 4566560.44373946])
```

Scipy:
  - 提供了很多跟科学计算有关的算法，专为线性代数、数值积分和统计学而设计
  - Netlib: <http: //www.netlib.org>
  -  SciPy 把基于C 和 Fortran 的工业级数学计算功能用交互式且高度抽象的 Python 包装起来

扩展包:
  - pandas:  <http: //pandas.pydata.org>
  - Blaze:  <http: //blaze.pydata.org>

### 4.4 队列
collections.deque: 双向队列
  - 优势:
    - 线程安全，可以快速从两端添加或者删除元素
    - 新建一个双向队列时，可指定队列的大小，队列满时在一端新增元素会自动删除另一端的顶端元素
    - append 和 popleft 都是原子操作
    - 即 deque 可以在多线程程序中安全地当作先进先出的栈使用，无需担心资源锁的问题
  - 劣势:
    - 从队列中间删除元素的操作会慢一些，因为它只对在头尾的操作进行了优化
```python
>>> from collections import deque
>>> dq = deque(range(10), maxlen=10) ➊ # maxlen 一旦设定，不能修改
>>> dq
deque([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], maxlen=10)
>>> dq.rotate(3) ➋
>>> dq
deque([7, 8, 9, 0, 1, 2, 3, 4, 5, 6], maxlen=10)
>>> dq.rotate(-4)
>>> dq
deque([1, 2, 3, 4, 5, 6, 7, 8, 9, 0], maxlen=10)
>>> dq.appendleft(-1) ➌
>>> dq
deque([-1, 1, 2, 3, 4, 5, 6, 7, 8, 9], maxlen=10)
>>> dq.extend([11, 22, 33]) ➍
>>> dq
deque([3, 4, 5, 6, 7, 8, 9, 11, 22, 33], maxlen=10)
>>> dq.extendleft([10, 20, 30, 40]) ➎ # 逐个添加到双向队列的左边
>>> dq
deque([40, 30, 20, 10, 3, 4, 5, 6, 7, 8], maxlen=10)
```

表2-3: 列表和双向队列的方法

|方法|列表|双向队列|作用|
|: ---|: ---|: ---|: ---|
|s.\_\_add\_\_(s2) |•| |s + s2，拼接|
|s.\_\_iadd\_\_(s2) |• |•| s += s2，就地拼接|
|s.append(e) |•| • |添加一个元素到最右侧（到最后一个元素之后）|
|s.appendleft(e) | |• |添加一个元素到最左侧（到第一个元素之前）|
|s.clear() |•| •| 删除所有元素|
|s.\_\_contains\_\_(e) |•| |s 是否含有 e|
|s.copy() |•| |对列表浅复制|
|s.\_\_copy\_\_() | |•|对 copy.copy（浅复制）的支持|
|s.count(e) |•| •| s 中 e 出现的次数|
|s.\_\_delitem\_\_(p) |• |• |把位置 p 的元素移除|
|s.extend(i) |• |• |将可迭代对象 i 中的元素添加到尾部|
|s.extendleft(i)  ||•|将可迭代对象 i 中的元素添加到头部|
|s.\_\_getitem\_\_(p) |• |• |s[p]，读取位置 p 的元素|
|s.index(e) |• | |找到 e 在序列中第一次出现的位置|
|s.insert(p, e) |• | |在位于 p 的元素之前插入元素 e|
|s.\_\_iter\_\_() |• |•| 返回迭代器|
|s.\_\_len\_\_() |• |•| len(s)，序列的长度|
|s.\_\_mul\_\_(n) |•| |s * n，重复拼接|
|s.\_\_imul\_\_(n) |•| |s *= n，就地重复拼接|
|s.\_\_rmul\_\_(n) |•| |n * s，反向重复拼接 *|
|s.pop() |• |• |移除最后一个元素并返回它的值 #|
|s.popleft() ||•| 移除第一个元素并返回它的值|
|s.remove(e) |• |• |移除序列里第一次出现的 e 元素|
|s.reverse() |• |• |调转序列中元素的位置|
|s.\_\_reversed\_\_() |• |• |返回一个从尾部开始扫描元素的迭代器|
|s.rotate(n) | |• | 把 n 个元素从队列的一端移到另一端|
|s.\_\_setitem\_\_(p, e) |• |• |s[p] = e，把位于 p 位置的元素替换成 e|
|s.sort([key], [revers]) |• | |就地排序序列，可选参数有 key 和 reverse|

### 4.5 其他队列
queue:
  - 提供了同步（线程安全）类 Queue、 LifoQueue 和PriorityQueue，
  - 不同的线程可以利用这些数据类型来交换信息
  - 可选参数 maxsize用来限定队列的大小
  - 队列满了，它就会被锁住，直到另外的线程移除了某个元素而腾出了位置
  - 特性让这些类很适合用来控制活跃线程的数量

multiprocessing:
  - 实现了自己的 Queue，与 queue.Queue 类似，用于进程间通信用
  - 专门的 multiprocessing.JoinableQueue 类型，可以让任务管理更方便

asyncio:
  - Python 3.4 新提供的包，里面有 Queue、 LifoQueue、 PriorityQueue 和 JoinableQueue
  - 受 queue 和 multiprocessing 模块影响，但是为异步编程里的任务管理提供了专门的便利

heapq:
  - heapq 没有队列类，而是提供了 heappush 和 heappop 方法
  - 让用户可以把可变序列当作堆队列或者优先队列来使用


## 附注
### Python 版本差异
1. Python3 之前，元组可以作为形参放在函数声明中，
例如 def fn(a, (b,c), d)，Python 3 不再支持这种格式

## 常用模块
bisect:
  - url: <https: //docs.python.org/3/library/bisect.html>
  - 介绍: 二分查找

sortedcollection:
  - url: < http: //code.activestate.com/recipes/577197-sortedcollection/>
  - 介绍: 排序集合模块。集成了 bisect 功能，比独立的 bisect 更易用

pickle:
  - url: <https: //docs.python.org/3/library/pickle.html>
  - 介绍: 快速序列化数字类型 eg: pickle.dump
  - 附注: 可以处理几乎所有的内置数字类型，包含复数、嵌套集合，甚至用户自定义的类


## 延伸阅读
Python:
  - sorted 用法: <https: //docs.python.org/3/howto/sorting.html>
  - \*extra 句法: <https: //www.python.org/dev/peps/pep-3132/>
  - 可迭代对象拆包:
    - <http: //bugs.python.org/issue2292>
    - <https: //www.python.org/dev/peps/pep-0448/>
  - collections: <https: //docs.python.org/3/library/collections.html>

blog:
- memoryview: <http: //eli.thegreenplace.net/2011/11/28/less-copies-in-python-with-the-buffer-protocol-and-memoryviews/>

实用工具
  - Python Tutor:
    - url:  <http: //www.pythontutor.com>
    - 介绍:  对 Python 运行原理进行可视化分析的工具
  - IPython:
    - url:  <http: //ipython.org/notebook.html>

书籍:
  - 《 Python Cookbook（第 3 版）中文版》重点放在了 Python 的语义上
  - 《 Python Cookbook（第 2 版）中文版》把重点放在如何解决实际问题上

## 杂谈
**扁平序列和容器序列**
  - 容器序列可以嵌套着使用，因为容器里的引用可以针对包括自身类型在内的任何类型
  - 扁平序列因为只能包含原子数据类型，比如整数、浮点数或字符，所以不
能嵌套使用

**混合类型列表**
  - 我们之所以用列表来存放东西，是期待在稍后使用它的时候，其中的元素有一些通用的特性
  - 元组则恰恰相反，它经常用来存放不同类型的的元素,也符合它的本质，元组就是用作存放彼此之间没有关系的数据的记录

**Timesort**
  - sorted 和 list.sort 背后的排序算法是 Timsort
  - 它是一种自适应算法，会根据原始数据的顺序特点交替使用插入排序和归并排序，以达到最佳效率 <https: //en.wikipedia.org/wiki/Timsort>
