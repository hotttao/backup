---
title: 37 拓扑排序
date: 2018-11-19
categories:
    - Python
tags:
    - 数据结构与算法
---

拓扑排序

<!-- more -->


## 1. 拓扑排序的背景
拓扑排序是一种排序，假设完成一项任务需要 n 个步骤，这 n 个步骤之间存在依赖关系，拓扑排序就是确定一个满足依赖关系的执行步骤。典型的拓扑排序用于解决如下问题:
1. 大学课程之间的选修课的顺序
2. 面向对象编程的类之间的继承
3. 编译器在编译项目，按照编译的依赖关系确定编译顺序

拓扑排序是有向无环图的经典应用，解决的问题的模型也非常一致。凡是需要通过局部顺序来推导全局顺序的，一般都能用拓扑排序来解决。其有两种实现方法，分别是Kahn 算法 和 DFS 深度优先搜索算法。

![topo](/images/algo/graph/topo.jpg)

### 1.1 Kahn 算法
Kahn 算法实际上用的是贪心算法思想。

定义数据结构的时候，如果 s 需要先于 t 执行，那就添加一条 s 指向 t 的边。所以，如果某个顶点入度为 0， 也就表示，没有任何顶点必须先于这个顶点执行，那么这个顶点就可以执行了。

我们先从图中，找出一个入度为 0 的顶点，将其输出到拓扑排序的结果序列中，并且把这个顶点从图中删除（也就是把这个顶点可达的顶点的入度都减 1）。我们循环执行上面的过程，直到所有的顶点都被输出。最后输出的序列，就是满足局部依赖关系的拓扑排序。

Kahn 算法还能检测图是否存在环，如果最后输出出来的顶点个数，少于图中顶点个数，图中还有入度不是 0 的顶点，那就说明，图中存在环

### 1.2 DFS 深度优先搜索算法
使用 DF 实现拓扑排序的方法不好理解。假设图上的一个路径是`A-->B-->C-->D`，如果我们按照输入边进行 DFS，那么顶点 A 一定在其他顶点之前输出。即所有入度为 0 的顶点一定在其他顶点之前输出，而递归调用的返回相当于对于顶点的入度减 1。最终的结果就是按照输入边对图的 DFS 和Kahn 算法一致。文字描述并不是很清楚，请结合代码查看。

## 2. 实现
### 2.1 Kahn 算法
```Python
def topologic_sort(g):
    topo = []   # 拓扑排序的结果
    ready = []   # 入度为 0 待加入 topo 的顶点
    incount = {}  # 记录每个顶点的入度
    for u in g.vertices():
        c = g.degree(u, False)
        if c == 0:
            ready.append(u)
        else:
            incount[u] = c
    while ready:
        u = ready.pop()
        topo.append(u)
        # 获取 u 的输出边，减少对应顶点的入度
        for e in g.incident_edge(u):  # 迭代所有顶点的传出边
            v = e.opposite(u)
            incount[v] -= 1
            if incount[v] == 0:
                incount.pop(v)
                ready.append(v)
    return topo
```

和图的遍历一样如果顶点可以用 0 到 n-1 进行编号，我们可以用数组代替 `incount`，或者将入度的计数作为顶点属性来记录。显然整个算法的时间复杂度为 `O(n + m)`

### 2.2 DFS 深度优先搜索算法
```Python
def DFS_income(g, u, discovered, topo):
    for e in g.incident_edge(u, False):
        v = e.opposite(u)
        if v not in discovered:
            discovered[v] = e
            DFS_income(g, v, discovered, topo)
    # 类似于后序遍历, 顶点 A 会优先加入 topo
    topo.append(u)


def topologic_dfs(g):
    discovered = {}
    topo = []
    for u in g.vertices:
        if u not in discovered:
            discovered[u] =  None
            DFS_income(g, u, discovered, topo)
    return topo

```
