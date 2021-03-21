---
title: 5. 不相交集合
date: 2020-07-05
categories:
    - Python
tags:
    - 好玩的数据结构与算法
---

不相交集合

<!-- more -->

## 1. 不相交集合的抽象
在图的最小生成树算法(Kruskal 算法)中我们看到了一个有趣的数据结构，不相交集合(`Group ADT`)。不相交集合用来对数据进行分组和合并，但不同于Python Set:
1. 我们不期望遍历分组的内容
2. 也不能有效的测试给定集合是否包含给定的元素
3. 甚至每一个分组都是不相同的，不明确的结构
4. 为了区分不同的组，每个组都有指定的条目，我们称之为组的领导

Group ADT 包含以下操作:
1. `make_group`: 创建一个包含新元素 x 的组，并返回存储 x 的位置
1. `union(p, q)`: 合并包含位置 p, q 的组
1. `find(p)`: 返回包含位置 p 的组的领导的位置

## 2. 不相交集合实现
下面是基于树的 Group ADT 具体实现:

```python
class Partition(object):
    __slots__ = '_container', '_element', '_size', '_parent'

    class Position(object):
        def __init__(self, container, e):
            self._container = container
            self._element = e
            self._size = 1
            self._parent = self

        def element(self):
            return self._element
    
    def make_group(self, e):
        return self.Position(self, e)

    def find(self, p):
        if p._parent != p:
            # 路径压缩
            p._parenet = self.find(p._parent)
        return p._parent

    def union(self, p, q):
        a = self.find(p)
        b = self.find(q)

        if a is not b:
            if a._size > b._size:
                b._parent = a
                a._size += b._size
            else:
                a._parent = b._parent
                b._size += a._size
```

在上面的实现过程中，我们使用了一个非常惊奇的启发式方法，路径压缩:
1. 在 find 操作中，对每个 find 函数访问过的位置 q，对根重置 q 的父节点
2. 使得对 n 个元素，执行 k 次 make，union，find 操作的时间复杂度是 O(klog*n)
3. 注: log*n=3 --> n=2^2^2