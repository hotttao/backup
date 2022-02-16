---
title: 4. 图
date: 2020-07-04
categories:
    - Python
tags:
    - 好玩的数据结构与算法
---

图

<!-- more -->

## 1. 图的抽象
### 1.1 图的基本概念
在基础的数据结构中，图应该算的上最复杂的非线性数据结构了，包含了很多专业术语，比如:
1. 顶点，边，权
2. 顶点的度，入度，出度
概念比较好理解，就不在此叙述了，我们的重点是如何实现一个图以及图相关的众多算法。

### 1.2 图的存储
图有两种存储方式:
1. 邻接矩阵
2. 邻接表

邻接矩阵直观，将图的运算转换成了矩阵运算，快速但是对于稀疏图而言非常浪费空间。因为大多数情况下我们遇到的都是稀疏图，所以下面我们重点讲解邻接表的实现方式。

### 1.3 图的抽象表示
图是顶点和边的集合，我们将图的抽象模型定义为三种数据类型的组合: Vertex,Edge 和 Graph。
**Vertex**
Vertex ADT 用来表示顶点对象，有一个用来检索所存储元素的方法 element()

**Edge**
Edge ADT 用来表示边，并具有如下方法:
- `element()`: 返回保存的边的值
- `endpoint()`: 返回边对应的(u, v)，u为边起点，v为边的终点
- `opposite(u)`: 传入边的一个端点，返回边的另一个端点

**Graph**
Graph ADT 表示图，包含如下方法:
1. 图的实现:
    - `insert_vertex(v=None)`: 创建并返回一个顶点的 Vertex 对象
    - `insert_edge(u, v, x=None)`: 创建一个从顶点u 到顶点 v，存储元素 x 的 Edge 边对象
    - `remove_vertex(v)`: 删除顶点及与顶点关联的边
    - `remove_edge(e)`: 删除边 e
2. 图的使用:
    - `vertex_count()`: 返回图的顶点数量
    - `vertices()`: 迭代返回图中的所有顶点
    - `edge_count()`: 返回图的边的数量
    - `edges()`: 迭代返回图中的所有边
    - `get_edge(u, v)`: 
        - 返回从顶点 u 到顶点 v 的边，不存在返回 None
        - 对于无向图 get_edge(u, v)，get_edge(v, u) 没有区别
    - `degree(v, out=True)`: 返回顶点的出度，out=False 返回顶点的出度
    - `incident_edges(v, out=True)`: 迭代返回顶点 v 的输出边，out=False 迭代返回顶点的输入边


## 2. 图的邻接表实现
为了方便的索引，顶点的出度(输出边)与入度(输入边)，我们使用两个字典来记录边的指向关系:
1. outgoing={}: 来记录顶点的出度
2. incoming={}: 来记录顶点的入度

当我们插入有向边 (v, u, x) 和 (u, v, y) 时，需要执行:
```python
# 插入边(v, u)
outgoing[v][u]=x  # 记录顶点 v 的输出边
incoming[u][v]=x  # 记录顶点 u 的输入边

# 插入边(u, v)
outgoing[u][v]=y  
incoming[v][u]=y
```

所以当删除顶点 v 时，我们需要执行上述插入的逆过程:
```python
# 删除边 (v, u)，即删除 v 的输出边
for u in outgoing[v].keys():
    del incoming[u][v]
del outgoing[v]

# 删除边 (u, v)，即删除 v 的输入边
for u in incoming[v].keys():
    del outgoing[u][v]
del incomming[v]
```

为了统一有向图和无向图的处理，在无向的情况下，outgoing is incoming，并通过参数 is_directed 来决定图是否为有向图。所以对于无向图而言，上述删除操作执行一组即可(outgoing is incoming 时，上面的两组删除是重复操作)。下面是图邻接表的具体实现:

```python
class Vertex(object):
    __slots__ = '_element'

    def __init__(self, x):
        self._element = x

    def element(self):
        return self._element

    def __hash__(self):
        return hash(id(self))


class Edge(object):
    __slots__ = '_origin', '_destination', '_element'

    def __init__(self, u, v, x):
        self._origin = u
        self._destination = v
        self._element = x

    def opposite(self, v):
        return self._destination if v is self._origin else self._origin
    
    def endpoints(self):
        return self._origin, self._destination

    def __hash__(self):
        return hash((self._origin, self._destination))


class Graph(object):
    def __init__(self, directed=False):
        """
        :param directed: 是否创建有向图，默认为 False 表示创建无向图
        """
        self._outgoing = {}  # key 为起点，value 为终点的
        # 设计要点: key 为终点，value 为起点的，无向图_incoming 只是 _outgoing 的别名
        self._incoming = {} if directed else self._outgoing
    
    def is_directed(self):
        return self._incoming is not self._outgoing
    
    def vertex_count(self):
        return len(self._outgoing)
    
    def vertices(self):
        return self._outgoing.keys()

    def edge_count(self):
        total = sum(len(self._outgoing[u]) for u in self._outgoing)
        if not self.is_directed():
            total /= 2
        return total

    def edges(self):
        result = set()  # 对于无向图，需要去重
        for u in self._outgoing:
            result.update(u.values())
        return result

    def degree(self, v, outgoing=True):
        adj = self._outgoing if outgoing else self._incoming
        return len(adj[v])
    
    def incident_edge(self, v, outgoing=True):
        adj = self._outgoing if outgoing else self._incoming
        for edge in adj[v].values:
            yield edge

    ################  图实现的重点 ########################
    
    def insert_vertex(self, x=None):
        v = Vertex(x=x)
        self._outgoing[v] = {}
        if self.is_directed():
            self._incoming[v] = {}
        return v

    def insert_edge(self, u, v, x):
        e = Edge(u, v, x)
        self._outgoing[u][v] = e
        self._incoming[v][u] = e

    def remove_vertex(self, v):
        # 删除 v 的输出边
        for u in self._outgoing[v].keys():
            del self._incoming[u][v]
        del self._outgoing[v]

        # 删除以 v 输入边
        if self.is_directed():
            for u in self._incoming[v].keys():
                del self._outgoing[u][v]
            del self._incoming[v]
    
    def remove_edge(self, e):
        u, v = e.endpoints()
        del self._outgoing[u][v]
        del self._incoming[v][u]
```

## 3. 图的遍历算法
图的遍历算法是回答许多有关图可达性问题的关键。

无向图可达性的问题包括:
|无向图可达性问题|DFS 是否能解决|BFS 是否能解决|
|:---|:---|:---|
|计算 u->v 的路径|能|能|
|计算 G 中每一个顶点 s 与其他顶点之间的最小路径|不能|能|
|判断图 G 是否为连通图|能|能|
|如果 G 是连通的，计算的 G 的生成树|能|能|
|计算 G 的连通的分支|能|能|
|判断 G 是否存在循环|能|能|

有向图的可达性问题包括:
|有向图可达性问题|DFS 是否能解决|BFS 是否能解决|
|:---|:---|:---|
|计算 u->v 的路径|能|能|
|计算顶点间的最短路径|不能|能
|找出 G 从已知顶点 s 可达的顶点|能|能|
|判断 G 是否强连通|能|能|
|判断 G 是否存在循环|能|能|
|计算 G 的传递闭包|能||

#### DFS 深度优先遍历算法特性
深度优先遍历算法可以用来分析图的结构:
1. DFS 很自然的识别出以开始顶点 s 作为根的深度优先搜索树；如果边 e=(u, v) 发现了新顶点 v，那么边 e 叫作**发现边**或者**树的边**；除此之外的边叫作非树边
2. 无向图中: 非树边连通了当前顶点和DFS树中的它的祖先，我们称这样的边叫 back 边
3. 有向图中: DFS 过程中有三种非树边，假设边为非树边连接了 (u, v)
    - back 边   : u 为当前节点，v 是DFS 树中 u 的祖先节点
    - forward 边: u 为当前节点，v 是DFS 树中 u 的孩子
    - cross 边: v 既不是 u 的祖先，也不是 u 的孩子

许多图的研究都是通过将图 G 的边按照上面的规则分组获得的:
1. 发现边可以帮助我们解决树的可达性问题
2. 当且仅当存在 back 边时，图存在循环

#### BFS 广度优先遍历算法特性
广度优先遍历算法同样可以用来分析图的结构:
1. 无向图的 BFS 所有的非树边都是 cross 边
2. 有向图的 BFS，所有非树边都是 back 边或者 cross 边
3. 显而易见，广度优先遍历可以计算从顶点 s 到任意顶点的最短路径 


### 3.1 DFS 
下面是 DFS 相关算法的具体实现
#### DFS 实现
下面是按照输出边的 DFS 实现。在 DFS 的遍历过程中我们需要记录以下信息:
1. {"v": edge(u, v)}: 记录顶点 v 的发现边
2. 记录顶点的 back 边，以判断图是否存在循环(下面的实现未实现此功能)

```python
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

discovered 字典这里为两个目的服务:
1. 一是提供了用于判断顶点是否已被访问的机制
2. 二是字典内保存的边就是DFS树的边。

如果假设顶点可以用 0 到 n-1 进行编号，discovered可以用基于这些数子的数组替代。或者可以直接将所有顶点的发现状态以及顶点的发现边作为顶点的属性，成为顶点的一部分。

#### u 到 v 的路径重建
无向图和有向图的路径重建是相同的。

```python
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
1. 无向图: 在任意顶点开始 DFS，然后测试 len(discovered) 和图的顶点数是否相同。如果相等无向图就是连通
2. 有向图: 
    - 选择任意顶点 s
    - 对 s 按照输出边执行 DFS
    - 对 s 按照输入边执行 DFS
    - 如果两次 DFS，len(discovered) 和图的顶点数都相同则有向图是强连通的

上面的 DFS 函数已经按照输出边实现了深度优先遍历，下面是按照输入边的DFS函数

```python
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
```python
def DFS_complete(g):
    forest = {}
    for u in g.vertices():
        if u not in forest:
            forest[u] = None
            DFS(g, u, forest)
    return forest
```
无向图的连通分支数可以通过发现字典值为 None 的键的个数来判定。

找到有向图的强连通分支的情况更复杂，存在在 O(n+m)时间内计算这些连通分支的方法，使用两次单独的深度优先搜索遍历，本文未实现。

#### 发现循环
循环的存在当且仅当和 DFS 遍历相关的 back 边存在。
1. 无向图搜索 back 边是容易的，因为所有的边不是树的边就是 back 边
2. 无向图比较困难，DFS 代码内需要正确区分出 back 边，若被探索的有向边指向先前访问过的顶点，我们必须识别出改顶点是否是当前节点的祖先节点，这需要额外的记录。

### 3.2 BFS
如下两个版本的广度有限搜索代码都是正确的，都是我们常用的形式。BFS 同样会输出 discovered ，因此对于上面使用 discovered 的 DFS 相关算法，对 BFS 同样适用。 
```python
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


## 4. 树的其他算法
讲完了图的遍历，接下来我们就可以来看看与图应用相关的算法了:
1. 传递闭包
2. 有向非循环图的拓扑排序
3. 最短路径
4. 最小生成树

### 4.1 传递闭包
有向图 G 的传递闭包是有向图 G1 使得 G1 顶点与 G 的顶点一样，并且对于所有顶点对 (u, v) 能直接表示是否有从 u 到 v 的一条路径。传递闭包通过合并图 G 中的路径来快速回答图中顶点的可达性。

### 4.2 拓扑排序
拓扑排序是一种排序，使得图 G 的任何有向路径以增加的顺序遍历顶点。图 G 有拓扑排序当且仅当它是非循环的。

拓扑排序是有向无环图的经典应用，解决的问题的模型也非常一致。凡是需要通过局部顺序来推导全局顺序的，一般都能用拓扑排序来解决。其有两种实现方法，分别是Kahn 算法 和 DFS 深度优先搜索算法。

#### Kahn 算法
Kahn 算法实际上用的是贪心算法思想。

定义数据结构的时候，如果 s 需要先于 t 执行，那就添加一条 s 指向 t 的边。所以，如果某个顶点入度为 0， 也就表示，没有任何顶点必须先于这个顶点执行，那么这个顶点就可以执行了。

我们先从图中，找出一个入度为 0 的顶点，将其输出到拓扑排序的结果序列中，并且把这个顶点从图中删除（也就是把这个顶点可达的顶点的入度都减 1）。我们循环执行上面的过程，直到所有的顶点都被输出。最后输出的序列，就是满足局部依赖关系的拓扑排序。

Kahn 算法还能检测图是否存在环，如果最后输出出来的顶点个数，少于图中顶点个数，图中还有入度不是 0 的顶点，那就说明，图中存在环

```python
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
和图的遍历一样如果顶点可以用 0 到 n-1 进行编号，我们可以用数组代替 incount，或者将入度的计数作为顶点属性来记录。显然整个算法的时间复杂度为 O(n + m)

#### DFS 深度优先搜索算法
使用 DF 实现拓扑排序的方法不好理解。假设图上的一个路径是`A-->B-->C-->D`，如果我们按照输入边进行 DFS，那么顶点 A 一定在其他顶点之前输出。即所有入度为 0 的顶点一定在其他顶点之前输出，而递归调用的返回相当于对于顶点的入度减 1。最终的结果就是按照输入边对图的 DFS 和Kahn 算法一致。文字描述并不是很清楚，请结合代码查看。
```python
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

### 4.3 最短路径
广度优先算法可以计算连通图中，从一个顶点到另一顶点的最短路径，但前提是图上的每条边的权重相同。那如何计算全重不同的图的最短路径呢？最出名的莫过于 Dijkstra 算法。

Dijkstra 算法是贪心算法。贪心算法的递归过程差不多是这样:假设我们计算图 G 上顶点 u 到顶点 v 的最短距离；对于到顶点 v 的所有输入边的顶点集合 S，如果我们知道 u 到 S 中每个顶点的最短距离，那我们就能计算出 u 到 v 的最短距离。

#### Dijkstra
```python
def shortest_search(g, src):
    d = {}          # 从 src 到 顶点的最短距离
    cloud = {}      # 收集已经计算得到最短距离的所有顶点
    pre = {}        # 还原最短路径的路径
    pdlocator = {}  # 定位顶点在优先队列中位置
    pq = MinHeap() # 小对
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
            n = k + e.element() # 到顶点 v 新的距离
            if v not in cloud:
                if v not in pdlocator:
                    d[v] = n
                    # 插入堆
                    pdlocator[v] = pq.add(d[v], v)
                    pre[v] = u
                else:
                    if n < d[v]:
                        d[v] = n
                        # 更新堆
                        pq.update(pdlocator[v], n, v)
                        pre[v] = u
    return cloud, pre
```

整个代码的时间负载度分成两个部分:

1. 一是 while + for 内对顶点和边的迭代，因为每个顶点和每条边最多被迭代一次，所以时间负载度是`O(n+m)`;
2. 二是对优先队列的操作，包括: `add, remove_min, update` 这些操作的时间复杂度都是 logn，因此总的时间复杂度是 `O((n+m)logn)`。

MinHeap 还有其他实现方式，比如一个未排序的数组，此时 remove_min 为 `O(n)`，其他两个操作的时间复杂度都是`O(1)`，此时总体的时间复杂度就是 `O(n*n + m)`。因此使用哪种实现方式更优取决于图的稀疏程度。

需要注意的是与前面类似，对于 d，pre， pdlocator，cloud 如果顶点可以用 0 到 n-1 进行编号， 它们都可以用数组代替，或者将作为顶点属性来记录。

#### 重建最短路径树
上面我们计算出从 src 到各个顶点的最短距离，但是并没有明确计算出获取最短剧路的路径。最短路径的重建有两种方式:
1. 向上面代码中那样，使用 pre 记录到达每个顶点的前一个顶点。
2. 是直接从 cloud 的返回值进行重建。

```python
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

### 4.4 最小生成树
所谓最小生成树(简称MST)就是在一个无向，有权图G中，找到一颗连接所有顶点的树，并且树包含的边的权重总和最低。最小生成树有两种常见解法:
1. Prim-Jarnik 算法: 从单个根节点生成 MST，它和 Dijkstra有很多相似之处
2. Kruskal 算法: 通过按照边的权重的非递减去考虑边来成群的生成 MST

无论是哪种算法，它们都基于最小生成树这样一个事实。即 G 是一个有权重的连通图，另 V1 和 V2 是两个不相交的非空集合G的顶点的一部份。此外另 e 是那些一个顶点在 V1 一个顶点在V2的有最小权重的G的边，则 e 是最小生成树的一条边。

#### Prim-Jarnik
Prim-Jarnik 算法，我们以一某一顶点 s 开始，定义初始集合 C，然后每次迭代中，我们选择一个最小权重的边 e，将 C 中的顶点连接到 C 之外的顶点 v，之后在将 v 加入 C 中。此时 e 就是最小生成树的一条边。

```python
def MST_Prim_Jarnik(g):
    d = {}
    tree = []
    pq = MinHeap()  # 小堆
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

#### Kruskal
Kruskal 算法，首先每个顶点本身是单元素集合。算法按照权重增加的顺序轮流考察每条边。如果一条边连接了两个不同的集群，那么 e 就是最小生成树的一条边。Kruskal 的具体实现如下，其中 Partition 是一个不相交集合和联合查找结构的实现。

```python
def MST_Kruskal(g):
    tree = []
    pq = MinHeap()  # 优先队列
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

### 4.5 不相交集合和联合查找结构
不相交集合和联合查找结构的实现参见: [不相交集合](./union.md)