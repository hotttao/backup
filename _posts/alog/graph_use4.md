---
title: 39 最小生成树
date: 2018-11-21
categories:
    - Python
tags:
    - 数据结构与算法
---


最小生成树

<!-- more -->
## 1. 最小生成树
所谓最小生成树(简称MST)就是在一个无向，有权图G中，找到一颗连接所有顶点的树，并且树包含的边的权重总和最低。最小生成树有两种常见解法:
1. Prim-Jarnik 算法: 从单个根节点生成 MST，它和 Dijkstra有很多相似之处
2. Kruskal 算法: 通过按照边的权重的非递减去考虑边来成群的生成 MST

无论是哪种算法，它们都基于最小生成树这样一个事实。即 G 是一个有权重的连通图，另 V1 和 V2 是两个不相交的非空集合G的顶点的一部份。此外另 e 是那些一个顶点在 V1 一个顶点在V2的有最小权重的G的边，则 e 是最小生成树的一条边。

![topo](/images/algo/graph/mst.jpg)

### 1.1 Prim-Jarnik
Prim-Jarnik 算法，我们以一某一顶点 s 开始，定义初始集合 C，然后每次迭代中，我们选择一个最小权重的边 e，将 C 中的顶点连接到 C 之外的顶点 v，之后在将 v 加入 C 中。此时 e 就是最小生成树的一条边。

### 1.2 Kruskal
Kruskal 算法，首先每个顶点本身是单元素集合集权。算法按照权重增加的顺序轮流考察每条边。如果一条边连接了两个不同的集群，那么 e 就是最小生成树的一条边。


## 2. 实现
### 2.1 Prim-Jarnik
```Python
def MST_Prim_Jarnik(g):
    d = {}
    tree = []
    pq = AdaptableHeapPriorityQueue()  # 优先队列
    pdlocator = {} # pdlocator 此处还起到判断顶点是否已经迭代过的作用

    # 初始化
    for v in g.vertices():
        if len(d) == 0:
            d[v] = 0
        else:
            d[v] = float('inf')
        pdlocator[v] = pq.add(d[v], (v, None))

    while not pq.is_empty():
        key, value = pq.remove_min()
        u, edge = value
        if edge is not None:
            tree.append(edge)
        del pdlocator[u]
        for e in g.incident_edge(u):
            v = e.opposite(u)
            if v in pdlocator:
                wgt = e.element()
                if wgt < d[v]:
                    d[v] = wgt
                    pq.update(pdlocator[v], (v, e))
    return tree
```

Prim-Jarnik Dijkstra类似，时间复杂度分析也类似。


### 2.2 Kruskal
```Python
def MST_Kruskal(g):
    tree = []
    pq = AdaptableHeapPriorityQueue()  # 优先队列
    forest = Partition()
    position = {}

    for v in g.vertices():
        position[v] = forest.make_group(v)

    for e in g.edges():
        pq.add(e.element, e)

    size = g.vertice_count()
    while len(tree) != size - 1 and pq.is_empty():
        wgt, edge = pq.remove_min()
        u, v = edge.endpoints()
        a = forest.find(position[u])
        b = forest.find(position[v])
        if a != b:
            tree.append(edge)
            forest.union(a, b)
    return tree

```
`Partition` 是一个不相交集合和联合查找结构的实现。


### 2.3 不相交集合和联合查找结构
```Python
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
