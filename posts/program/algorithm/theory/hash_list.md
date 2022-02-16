---
title: 15 散列表与链表
date: 2018-10-22
categories:
    - Python
tags:
    - 数据结构与算法
---
“形影不离”的散列表与链表

<!-- more -->

## 1. 特性
散列表和链表，经常会被放在一起使用。原因是散列表虽然支持高效的数据插入、删除、查找操作，但是散列后的数据都是无序存储的，无法支持按照某种顺序快速地遍历数据。散列表是动态的数据结构，如果每次按序访问都要拷贝到数组，排序然后在遍历，效率太低了。而支持动态创建的链表刚好能解决散列表的有序遍历问题。

## 2. 散列表的实现
在讲解散列表与链表的应用之前，我们先来解决上一篇文章遗漏的散列表的实现问题。散列表的原理并复杂，但是一个高效的哈希函数可能数学家精心研究的结果。这里我们不弄的太过复杂，我们介绍两种哈希表的实现，一种使用分离链表，另一种使用包含线性探测的开放寻址。

虽然这两种实现解决冲突的方法差异很大，但是也存在很多共性，因此我们基于 `MapBase` 扩展一个新的 `HashMapBase` 类。

### 2.1 HashMapBase
```Python
from abc import abstractmethod
from random import randrange


class HashMapBase(MapBase):
    def __init__(self, cap=11, p=109345121):
        self._table = cap * [None]
        self._n = 0

        # 压缩函数 MAD 的参数
        # [(ai + b) mod p] mod N
        # - N: 散列表内部数组的大小
        # - p: 比 N 大的素数
        # - a，b 是从区间 [0, p-1] 任意选择的整数，并且 a > 0
        self._prime = p  # p
        self._scale = 1 + randrange(p - 1)  # a
        self._shift = randrange(p)  # b

    def _hash_function(self, k):
        return (hash(k) * self._scale + self._shift) % self._prime % len(self._table)

    def __len__(self):
        return self._n

    def __getitem__(self, k):
        j = self._hash_function(k)
        return self._bucket_setitem(j, k)

    def __setitem__(self, key, value):
        j = self._hash_function(key)
        self._bucket_setitem(j, key, value)
        if self._n > len(self._table) // 2:
            self._resize(2 * len(self._table) - 1)

    def __delitem__(self, key):
        j = self._hash_function(key)
        self._bucket_delitem(j, key)
        self._n -= 1

    def _resize(self, c):
        old = list(self.items())
        self._table = c * [None]
        self._n = 0
        for k, v in old:
            self[k] = v

    @abstractmethod
    def _bucket_getitem(self, j, k):
        pass

    @abstractmethod
    def _bucket_setitem(self, j, k, v):
        pass

    @abstractmethod
    def _bucket_delitem(self, j, k):
        pass

```

### 2.2 ChainHashMap
分离链表法的实现

```Python
class ChainHashMap(HashMapBase):
    def _bucket_getitem(self, j, k):
        bucket = self._table[j]
        if bucket is None:
            raise KeyError('Key error' + repr(k))
        return bucket[k]

    def _bucket_setitem(self, j, k, v):
        if self._table[j] is None:
            # 可以使用链表，红黑树，跳表优化,
            # 示例使用的是 <11 映射> 实现的 UnsortedTableMap
            self._table[j] = UnsortedTableMap()
        oldsize = len(self._table[j])
        self._table[j][k] = v
        if len(self._table[j]) > oldsize:
            self._n += 1

    def _bucket_delitem(self, j, k):
        bucket = self._table[j]
        if bucket is None:
            raise KeyError('Key error' + repr(k))
        del bucket[k]

    def __iter__(self):
        for bucket in self._table:
            if bucket is not None:
                for key in bucket:
                    yield key

```

### 2.3 ProbeHashMap
线性探测的开放寻址法

```Python
class ProbeHashMap(HashMapBase):
    # 标记删除的哨兵
    _AVAIL = object()

    def _is_available(self, j):
        return self._table[j] is None or self._table[j] is ProbeHashMap._AVAIL

    def _find_slot(self, j, k):
        # 位置探测
        first_avail = None
        while True:
            if self._is_available(j):
                if first_avail is None:
                    first_avail = j
                # 查找失败，探测到的第一个空位置
                if self._table[j] is None:
                    return False, first_avail
            # 查找成功，元素 k 的位置
            elif k == self._table[j]._key:
                return True, j
            j = (j + 1) % len(self._table)

    def _bucket_getitem(self, j, k):
        found, s = self._find_slot(j, k)
        if not found:
            raise KeyError('Key error' + repr(k))
        return self._table[s]._value

    def _bucket_setitem(self, j, k, v):
        found, s = self._find_slot(j, k)
        if not found:
            self._table[s] = self._Item(k, v)
            self._n += 1
        else:
            self._table[s]._value = v

    def _bucket_delitem(self, j, k):
        found, s = self._find_slot(j, k)
        if not found:
            raise KeyError('Key error' + repr(k))
        self._table[s] = self._AVAIL

    def __iter__(self):
        for j in range(len(self._table)):
            if not self._is_available(j):
                yield self._table[j]._key

```

## 3. 散列表与链表
### 3.1 LRU 缓存淘汰算法
借助于散列表和链表可以实现时间复杂度降为 O(1)的 LRU 缓存淘汰算法。这里我们使用 Python 内置的 `dict` 与 [链表](https://hotttao.github.io/2018/10/10/alog/linkedlist/)一章实现的 `DoubleLink`。

![linkedlist](/images/algo/hash_list/lru.jpg)

```python
class LRU(object):
    def __init__(self, capacity=3):
        assert capacity <= 0
        self.capacity = capacity
        self.num = 0
        self.link = DoubleLink()
        self.node_mp = {}

    def _re_cache(self, value):
        """
        :return: 值存在更新缓存
        """
        if value in self.node_mp:
            node = self.node_mp[value]
            self.link.delete_node(node)
            self.node_mp[value] = self.link.insert_head(value)
            return True
        return False

    def cache(self, value):
        if not self._re_cache(value):
            if self.num < self.capacity:
                # 缓存未满
                self.node_mp[value] = self.link.insert_head(value)
                self.num += 1
            else:
                # 缓存满
                node_tail = self.link._tail._pre
                del self.node_mp[node_tail._element]
                self.link.delete_node(node_tail)
                self.node_mp[value] = self.link.insert_head(value)

    def __str__(self):
        r = []
        s = self.link._head._next
        while s != self.link._tail:
            r.append(str(s._element))
            s = s._next
        return '-->'.join(r)

lru = LRU()
lru.cache(1)
lru.cache(2)
lru.cache(3)
print lru
lru.cache(1)
print lru
lru.cache(1)
print lru
lru.cache(4)
print lru
```

**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
- [《数据结构与算法：python语言实现》](https://book.douban.com/subject/30323938/)
