---
title: 35 深度和广度优先搜索
date: 2018-11-16
categories:
    - Python
tags:
    - 数据结构与算法
---


图的深度和广度优先搜索

<!-- more -->

## 1. 特性
上一节我们讲解了图的存储和表示，这一节我们来介绍图上的搜索算法。图的搜索方法有很多，最常见的就是深度和广度优先搜索，除此之外还有 A*、IDA* 等启发式搜索算法。因为邻接表更加常用，我们就以邻接表作为图的存储方式来讲解最基础的深度和广度优先算法。

形式上，遍历是通过检查所有的边和顶点来探索图的系统化的步骤。图的遍历算法是回答许多涉及可达性概念的有关图的问题的关键，即在图中决定如何从一个顶点到达另一个顶点。

在无向图中处理可达性的问题包括:
1. 计算从顶点 u 到顶点 v 的路经，或者报告这样的路经不存在
2. 已知 G 的开始顶点，对每个 G 的顶点 v 计算 s 和 v 之间的边的最小数目的路经，或者报告有没有这样的路经
3. 测试 G 是否是连通的
4. 如果 G 是连通的，计算 G 的生成树
5. 计算 G 的连通分支
6. 计算 G 中的循环，或者报告 G 没有循环

在有向图中处理可达性的问题包括:
1. 计算从顶点 u 到顶点 v 的有向路经，或者报告这样的路经不存在
2. 找出 G 中从已知顶点 s 可达的顶点
3. 判断 G 是否是非循环的
4. 判断 G 是否是强连通的

### 1.1 深度优先搜索
深度优先搜索（Depth-First-Search），简称 DFS。最直观的例子就是“走迷宫”，每次迭代时任意选择一个分岔的"顶点"进行搜索，直至没有顶点时退回到上一个顶点重新选择新的顶点继续遍历，直到所有顶点都被遍历结束。下面是一个深度优先搜索的示意图

![deep_search](/images/algo/graph/deep_search.jpg)

深度优先搜索对是否从一个顶点到另一个顶点有路径和是否该图是一个连通图非常有用。

### 1.2 广度优先搜索
广度优先搜索（Breadth-First-Search），简称为 BFS，就是一种“地毯式”层层推进的搜索策略，即先查找离起始顶点最近的，然后是次近的，依次往外搜索。所有的顶点按照从左往右，从上往下的顺序依次迭代。为了保证迭代的次序需要用到队列，整个过程就是从顶点入队开始，将队首元素出队，并将出队顶点的下一层顶点依次入队，迭代直至队列为空的过程。为了防止顶点被重复遍历，需要对已经遍历的顶点进行表识。


## 2. 应用
### 2.1 深度优先搜索
```Python
def DFS(g, u, discovered):
    """
    :param g: 图
    :param u: 开始顶点
    :param discovered: 将图的顶点映射到用于发现那个顶点的边
    :return:
    """
    for e in g.incident_edge(u):
        v = e.opposite(u)
        if v not in discovered:
            discovered[v] = e
            DFS(g, v, discovered)

# u 为开始顶点，值为 None，用于标识其为开始顶点
result = {u: None}
DFS(g, u, result)
```

`discovered` 字典这里为两个目的服务，一是提供了用于判断顶点是否已被访问的机制，二是字典内保存的边就是DFS树的边。如果假设顶点可以用 0 到 n-1 进行编号，`discovered`可以用基于这些数子的数组替代。或者可以直接将所有顶点的发现状态以及顶点的发现边作为顶点的属性，成为顶点的一部分。

#### 顶点 u 到 v 的可达路经
基于`discovered` 字典我们可以很容易基于这个字典来提供从顶点 u 到达顶点 v 的可达路经的顶点列表。

```Python
def construct_path(u, v, discovered):
    path = []
    if v in discovered:
        path.append(v)
        walk = v
        while walk is not u:
            parent = discovered[walk].opposite[walk]
            path.append(parent)
            walk = parent
        path.reverse()
    return path
```

#### 连通性测试
基于 DFS 函数，我们可以很容判断图是否是连通的。在无向图的情况下，我们在任意顶点简单的开始深度有限搜索，然后测试 `len(discovered)` 和图的顶点数是否相同。如果相等无向图就是连通。

对于有向图，我们可能想测试它是否是强连通的。我们可以对任意顶点 s 执行深度优先搜索。注意在我们的 DFS 实现中，我们是以顶点的输出边为基础的，我们可以重新实现一个深度优先搜索函数 DFS_IN，这次以输入边作为遍历图的基础。对顶点 s 重新执行 DFS_IN。如果两次 DFS 遍历，所有顶点都是可达的则图是强连通的。

```Python
def DFS_IN(g, u, discovered):
    """
    :param g: 图
    :param u: 开始顶点
    :param discovered: 将图的顶点映射到用于发现那个顶点的边
    :return:
    """
    # 以输入边执行反向的深度优先搜索
    for e in g.incident_edge(u, outgoing=False):
        v = e.opposite(u)
        if v not in discovered:
            discovered[v] = e
            DFS(g, v, discovered)

```
#### 计算所有的连通分支
当图是不连通的时候，我们的下一个目标是识别无向图的所有连通分支，或有向图的强连通分支。我们首先来看无向图。

```Python
def DFS_complete(g):
    forest = {}
    for u in g.vertices():
        if u not in forest:
            forest[u] = None
            DFS(g, u, forest)
    return forest
```
`DFS_complete` 函数返回的发现字典代表了整个图的 DFS 森林。连通分支数可以通过发现字典值为 None 的键的个数来判定。

找到有向图的强连通分支的情况更复杂，存在在 O(n+m)时间内计算这些连通分支的方法，使用两次单独的深度优先搜索遍历，细节我们之后在详述。

#### 判断图是否存在循环
循环的存在当且仅当和 DFS 遍历相关的 back 边存在。无向图搜索 back 边是容易的，因为所有的边不是树的边就是 back 边。而无向图比较困难。代码实现如下

```Python
def is_cycle():
    pass

def is_cycle_directed():
    pass
```

### 2.1 广度优先搜索
如下两个版本的广度有限搜索代码都是正确的，都是我们常用的形式。

```Python
def BFS(g, s, discovered):
    queue = deque()
    queue.append(s)
    discovered[s] = None
    while queue:
        u = queue.popleft()
        for e in g.incident_edge(u):
            v = e.opposite(u)
            if v not in discovered:
                discovered[v] = e
                queue.append(v)


def BFS_1(g, s, discovered):
    level = []
    while level:
        next_level = []
        for u in level:
            for e in g.incident_edge(u):
                v = e.opposite(u)
                if v not in discovered:
                    discovered[v] = e
                    next_level.append(v)
        level = next_level
```

#### 广度优先搜索的应用
BFS 可以遍历 s 所有的可达顶点，要探索整个图，可以从另一顶点重新开始，和代码 DFS_complete 类似。同样从顶点 s 到顶点 v 的实际路经可以使用代码段 construct_path 函数重建。

### 2.3 对比
DFS 和 BFS 都能很高效的找到从给定源可达顶点的集合，然后判定到这些顶点的路经。然而 BFS 可保证这些路经尽可能少的使用边。对于无向图，两个算法都能用来测试连通性，识别连通分支或找出循环。对于有向图而言，DFS 可能更适合一些任务，比如在图中寻找有向循环，或识别强连通分支。
