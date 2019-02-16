---
title: 02 数组
date: 2018-10-08
categories:
    - Python
tags:
    - 数据结构与算法
---
![linkedlist](/images/algo/array/array_image.jpg)

数组和链表应该是数据结构与算法中最基础的数据结构。与链表相比，数组更加简单，所以相比于数组的实现和与之相关的算法，充分认识数组的内在特性反而更加重要。

<!-- more -->

## 1. 特性
数组（Array）是一种**线性表**数据结构，用一组**连续的内存空间**，来存储一组具有**相同类型**的数据。正是由于连续的内存空间和存储相同类型数据的特性，使得数组支持基于下标的“随机访问”。但是也正是为了维持这种连续的特性，使得数组的插入和删除操作必需作大量的数据移动，因为数组内不能"弯曲"也不能出现"空洞"。

### 1.1 插入
如果数组是有序的，插入一个新的元素到第 k 位置则必需移动 k 之后的所有数据；但是如果数组中的数据本身是无序的，我们可以直接将第 k 位的数据移动到数组元素的最后，再把新的元素插入到原来的第 k 位以避免大量的数据移动。

### 1.2 删除
数组的删除与插入类似，如果要删除第 k 位的元素，为了保证数组内的连续行，也需要移动大量的数据，不然数组就会出现空洞，内存就不连续了。如果数据内的数据是有序，则这种移动不可避免，如果是数组是无序的，可以直接用数组最后的元素覆盖第 k 位的元素。

实际上，在某些特殊场景下，我们并不一定非得追求数组中数据的连续性。我们可以将多次删除操作集中在一起执行，来提高删除的效率。我们可以先记录下已经删除的数据。每次的删除操作并不是真正地搬移数据，只是记录数据已经被删除。当数组没有更多空间存储数据时，我们再触发执行一次真正的删除操作，这样就大大减少了删除操作导致的数据搬移。

### 1.3 动态扩容
因为需要为数组分配连续的内存空间，因此数组在使用前就需要预先确定好大小。当需要向满的数组中插入数据时，我们就需要重新分配一块更大的空间，将原来的数据复制过去，然后再将新的数据插入。数组的插入，删除以及由此待来的动态扩容是非常基础的操作，因此大多数编程语言除了基本的底层数组之外，都提供了包含丰富接口的数组容器，方便程序员编程适用，比如 Python 中的列表(list)。

### 1.4 数组与数组容器的使用选择
何时使用数组何时使用编程语言提供的数组容器，[专栏-数据结构与算法之美](https://time.geekbang.org/column/126)给了下面的一些建议:
1. 容器都有额外的性能损耗，如果特别关注性能，或者希望使用基本类型，就可以选用数组。
2. 如果数据大小事先已知，并且对数据的操作非常简单，用不到 ArrayList 提供的大部分方法，也可以直接使用数组。
3. 对于业务开发，直接使用容器就足够了，省时省力。毕竟损耗一丢丢性能，完全不会影响到系统整体的性能。但如果你是做一些非常底层的开发，比如开发网络框架，性能的优化需要做到极致，这个时候数组就会优于容器，成为首选。

## 2. 实现
列表和元组是 Python 提供的数组容器，它们都是引用结构，即 list 内部的底层数组存储的不是元素本身，而是列表元素的内存地址，这些内存地址指向每个列表元素。

除了数组容器之外，array 和 ctypes 提供了创建**原始底层数组**(即保存的不是内存地址而是元素本身的原始数组)的方法。array 模块提供的 array 类只支持基于 C 语言的原始数据类型，不支持用户自定义的数据类型，自定义类型的底层数组由 ctypes 这个底层模块提供。

下面我们就以 ctypes 提供的底层数组为基础创建了一个类似 list 的数组容器。这里的实现并不完备，目的是为了展示 Python list 的底层实现。

```python

import ctypes


class DynamicArray(object):
    def __init__(self):
        self._n = 0  # 列表当中实际存储的元素个数
        self._capacity = 1  # 当前分配的底层数组，能存储的元素个数
        self._buf = self._make_array(self._capacity)  # 底层数组的引用

    def __len__(self):
        return self._n

    def __getitem__(self, item):
        """
        :param item:
        :return: 简单起见，只支持简单的正向索引
        """
        if 0 <= item < self._n:
            return self._buf[item]
        raise IndexError('%s out of range' % self.__class__.__name__)

    def append(self, value):
        if self._n == self._capacity:
            self._resize(size= 2 * self._capacity)
        self._buf[self._n] = value
        self._n += 1

    def _resize(self, size):
        """
        :param c:
        :return: 底层数组的动态扩容
        """
        buf = self._make_array(size)
        for i in xrange(self._n):
            buf[i] = self._buf[i]
        self._buf = buf
        self._capacity = size

    @staticmethod
    def _make_array(size):
        """创建一个指定大小的底层数组"""
        return (size * ctypes.py_object)()

    def insert(self, k, value):
        if self._n == self._capacity:
            self._resize(2 * self._capacity)
        for i in xrange(self._n, k, -1):
            self._buf[i] = self._buf[i - 1]
        self._buf[k] = value
        self._n += 1

    def remove(self, value):
        """
        :param value:
        :return: 删除第一值等于 value 的元素
        """
        for i in xrange(self._n):
            if self._buf[i] == value:
                for j in xrange(i, self._n - 1):
                    self._buf[j] = self._buf[j + 1]
                self._buf[self._n - 1] = None  # 删除最后一个元素的引用，以便被回收
                self._n -= 1
                return
        raise ValueError('value not found')
```


## 3. 相关算法
与数组专门相关的算法并不多，因为太底层了。这里我们介绍两个: 用数组实现的**位图**以及**凯撒密码**

### 3.1 位图
```python
import array
import numbers


class BitMap(object):
    def __init__(self):
        self._buf = array.array('L')  # 'L' 表示 32 位无符号的整数

    @staticmethod
    def __check(num):
        if not (isinstance(num, numbers.Integral) and num >= 0):
            raise ValueError("num is not unsigned int")
        return num / 32, num % 32

    def __len__(self):
        return len(self._buf)

    def __getitem__(self, item):
        return self._buf[item]

    def __iter__(self):
        return iter(self._buf)

    def __contains__(self, item):
        i, b = self.__check(item)
        return i < len(self._buf) and (self._buf[i] & (1 << b))

    def __str__(self):
        r = []
        # print self._buf
        for i in xrange(len(self._buf)):
            if self._buf[i]:
                for j in xrange(32):
                    if self._buf[i] & (1 << j):
                        r.append(32 * i + j)
        return str(r)

    def add(self, num):
        i, b = self.__check(num)
        while i >= len(self._buf):
            self._buf.append(0)
        self._buf[i] |= (1 << b)

    def union(self, bit_map):
        for i, v in enumerate(bit_map):
            if i < len(self._buf):
                self._buf[i] |= v
            else:
                self._buf.append(v)


def main():
    bm = BitMap()
    bm.add(1)
    bm.add(144)
    bm.add(9)
    bm.add(9)

    print bm
    print 9 in bm
    print 8 in bm

    y = BitMap()
    y.add(9)
    y.add(42)
    print y

    bm.union(y)
    print bm
```

### 3.2 凯撒密码
有关凯撒密码的说明，大家可以看看百科的说明:[凯撒密码](https://baike.baidu.com/item/%E6%81%BA%E6%92%92%E5%AF%86%E7%A0%81/4905284?fr=aladdin)

```python
class CaesarCipher(object):
    def __init__(self, shift):
        self.encode = [(chr(ord('A') + (i + shift) % 26)) for i in range(26)]
        self.decode = [(chr(ord('A') + (i - shift) % 26)) for i in range(26)]
        print self.encode
        print self.decode

    def encrypt(self, message):
        return self._transform(message, self.encode)

    def decrypt(self, message):
        return self._transform(message, self.decode)

    @staticmethod
    def _transform(message, code):
        m = list(message)
        r = []
        for i in m:
            if i.isupper():
                t = code[ord(i) - ord('A')]
                r.append(t)
        return ''.join(r)
```

## 4. linkcode 习题


**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
- [《数据结构与算法：python语言实现》](https://book.douban.com/subject/30323938/)
