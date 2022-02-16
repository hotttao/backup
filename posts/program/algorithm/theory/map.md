---
title: 11 映射
date: 2018-10-19
categories:
    - Python
tags:
    - 数据结构与算法
---
无处不在的映射

<!-- more -->

## 1. 映射
前面我们讲解了基于数组和链表最基础的数据结构。在继续下面的内容之前，我们先来说一说映射。因为映射与我们接下来的很多数据结构与算法相关。映射可以看作是搜索或查找的扩展，后面介绍的很多数据结构都是为实现快速的增删改查。因此在继续其他数据结构的介绍之前，我想先介绍一下映射的抽象数据类型以及它的常见几种实现方式。

### 1.1 映射的抽象数据类型
#### 抽象基类
Python 中使用抽象基类来表达抽象数据类型。如下所示，抽象基类包含两类方法
- 一是由 `abc.abstractmethod` 装饰的抽象方法，这些方法必需由继承自抽象基类的子类来提供具体实现
- 二是在抽象方法基础上定义的具体方法，基类上的具体方法通过继承可以实现最大化代码复用

```Python
import abc


class ADT(object):
    __metaclass__ = abc.ABCMeta

    @abc.abstractmethod
    def abstract_method(self):
        pass

    def specific_method(self):
        return self.abstract_method()

```

Python 中 映射 map 的 ADT 与 MutableMapping 抽象基类相对应。

#### 映射的抽象方法
映射 M 有如下五个抽象方法，这些方法必需由子类提供具体实现:
1. `M[k]`: 返回键 k 对应的值，键不存在则触发异常，对应 Python `__getitem__`
2. `M[k]=v`: 对应 Python `__setitem__`
3. `del M[k]`: 对应 Python `__delitem__`
4. `len(M)`: 对应 Python `__len__`
5. `iter(M)`: 迭代映射 M 中的所有键，对应 Python `__iter__`

#### 映射的具体方法
为了方便其他功能实现，映射包含了如下具体方法，子类通过继承 MutableMapping 可以自动获取:
1. `K in M`
2. `M.get(k, d=None)`
3. `M.setdefault(k, d)`
4. `M.pop(k, d=None)`
5. `M.popitem()`
6. `M.clear()`
7. `M.keys()`
8. `M.values()`
9. `M.items()`
10. `M.update(M2)`
11. `M == M2`
12. `M ！= M2`

因为这些方法很容易做到见名知意，我就不再一一解释了。

### 1.2 map 的实现层次
map ADT 有众多的实现方式，为了方便代码重用，我们使用如下层次结构
![consistent_hash](/images/algo/hash/map_adt.png)

1. `MutableMapping` 是 Python 提供的映射的抽象，提供了现成的映射具体方法
2. `MapBase`: 继承自 MutableMapping，为自定义的映射类型提供扩展支持
3. `UnsortedMap`: 基于未排序数组的映射实现
4. `HashMapBase`: 映射的散列表实现
5. `SortedTableMap`: 基于二分查找的映射实现
6. `SkipList`: 映射的跳表实现
8. `TreeMap`: 二叉搜索树木及其变种的映射实现

## 2. 实现
本节我们就以最简单的 `UnsortedMap` 为例，实现一个最简单的映射。更加高级的实现我们会在后面一一讲解。

### 2.1 MapBase
`MapBase` 是我们在 `MutableMapping` 基础上自定义的抽象基类，它提供了一个 `_Item` 类用于保存键与值的映射关系。
```python
class MapBase(MutableMapping):
    class _Item(object):
        __slots__ = '_key', '_value'

        def __init__(self, k, v):
            self._key = k
            self._value = v

        def __eq__(self, other):
            return self._key == other._key

        def __ne__(self, other):
            return not (self == other)

        def __lt__(self, other):
            return self._key < other._key

        def __gt__(self, other):
            return self._key > other._key

```

### 2.2 UnsortedMap
```python
class UnsortedTableMap(MapBase):
    def __init__(self):
        self._table = []

    def __getitem__(self, k):
        for item in self._table:
            if k == item._key:
                return item._value
        raise KeyError('Key error' + repr(k))

    def __setitem__(self, k, v):
        for item in self._table:
            if k == item._key:
                item._value = v
                return
        self._table.append(self._Item(k, v))

    def __delitem__(self, k):
        for j in range(len(self._table)):
            if k == self._table[j]._key:
                self._table.pop(j)
                return
        raise KeyError('Key error' + repr(k))

    def __len__(self):
        return len(self._table)

    def __iter__(self):
        for item in self._table:
            yield item._key

```
