---
title: 38 最短路经
date: 2018-11-20
categories:
    - Python
tags:
    - 数据结构与算法
---


最短路经

<!-- more -->
## 1. 最短路径
广度优先算法可以计算连通图中，从一个顶点到另一顶点的最短路径，但前提是图上的每条边的权重相同。那如何计算全重不同的图的最短路径呢？最出名的莫过于 Dijkstra 算法。

### 1.1 Dijkstra
Dijkstra 算法是贪心算法。贪心算法的递归过程差不多是这样:假设我们计算图 G 上顶点 u 到顶点 v 的最短距离；对于到顶点 v 的所有输入边的顶点集合 S，如果我们知道 u 到 S 中每个顶点的最短距离，那我们就能计算出 u 到 v 的最短距离。整个 Dijkstra 算法计算过程比较复杂，我们结合代码来看。


## 2. 实现
### 2.1 Dijkstra
```Python
def shortest_search(g, src):
    d = {}          # 从 src 到 顶点的最短距离
    cloud = {}      # 收集已经计算得到最短距离的所有顶点
    pre = {}        # 还原最短路径的路径
    pdlocator = {}  # 定位顶点在优先队列中位置
    pq = AdaptableHeapPriorityQueue() # 优先队列
    # 初始化
    for u in g.vertices():
        d[u] = float('inf')
    d[src] = 0
    pre[src] = None
    pdlocator[src] = pq.add(0, src)

    # 迭代优先队列，不断从中取出距离最小的顶点
    while not pq.is_empty():
        k, u = pq.remove_min()  # 删除堆顶元素
        cloud[u] = k
        del pdlocator[u]
        for e in g.incident_edge(u):
            v = e.opposite(u)
            n = k + e.element()
            if v not in cloud:
                if v not in pdlocator:
                    d[v] = n
                    # 插入堆
                    pdlocator[v] = pq.add(d[v], v)
                    src[v] = u
                else:
                    if n < d[v]:
                        d[v] = n
                        # 更新堆
                        pq.update(pdlocator[v], n, v)
                        src[v] = u
    return cloud, pre

```
`AdaptableHeapPriorityQueue` 是我们在[堆](https://hotttao.github.io/2018/10/28/alog/heap/)中实现的优先队列。之所以使用这个优先队列，是因为我们要不断的在队列中更新顶点的距离，以保证从优先队列取出的是当前距离最小的顶点。

整个代码的时间负载度分成两个部分:
1. 一是 while + for 内对顶点和边的迭代，因为每个顶点和每条边最多被迭代一次，所以时间负载度是O(n+m);
2. 二是对优先队列的操作，包括:
  - `add`
  - `remove_min`
  - `update`

在[堆](https://hotttao.github.io/2018/10/28/alog/heap/)一节中`AdaptableHeapPriorityQueue`被实现为一个堆，上述所有操作的时间复杂度都是 `logn`，因此总的时间复杂度是 `O((n+m)logn)`。

`AdaptableHeapPriorityQueue` 还有其他实现方式，比如一个未排序的数组，此时 `remove_min` 为 `O(n)`，其他两个操作的时间复杂度都是`O(1)`，此时总体的时间复杂度就是 `O(n*n + m)`。因此使用哪种实现方式更优取决于图的稀疏程度。

需要注意的是与前面类似，对于 `d`，`pre`， `pdlocator`，`cloud` 如果顶点可以用 0 到 n-1 进行编号， 它们都可以用数组代替，或者将作为顶点属性来记录。

### 2.2 重建最短路径树
上面我们计算出从 src 到各个顶点的最短距离，但是并没有明确计算出获取最短剧路的路径。最短路径的重建有两种方式:
1. 向上面代码中那样，使用 `pre` 记录到达每个顶点的前一个顶点。
2. 是直接从 `cloud` 的返回值进行重建。

```Python
# 重建最短路径树
def shortest_path_tree(g, s, d):
    """
    :param g:
    :param s: src 顶点
    :param d: cloud 的返回值
    :return:
    """
    tree = {}
    for v in d:
        if v is not s:
            for e in g.incident_edge(v, False):
                u = e.opposite(v)
                wgt = e.element()
                if d[v] == d[u] + wgt:
                    tree[v] = e
    return tree   

# 计算到顶点 v 的最短路径
def shortest_path(pre, v):
    """
    :param pre: pre
    :return:
    """
    p = [v]
    while v in pre and pre[v] is not None:
        v = pre[v]
        p.append(v)
    return p.reverse()
```
