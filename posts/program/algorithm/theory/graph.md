---
title: 34 图的表示
date: 2018-11-15
categories:
    - Python
tags:
    - 数据结构与算法
---


如何表示一个图

<!-- more -->

## 1. 特性
从本节开始，我们将进入图的学习。图是一种比树更复杂的非线性结构，图中有以下一些专用术语:
1. 顶点: 图中的节点被称为顶点
2. 边: 顶点之间存在链接关系，可以有方向，也可以有权重
4. 有向图: 边有方向的图
5. 带权图: 边存在权重的图
3. 度: 顶点包含的边数，在有向图中，度分为出度和入度
  - 出度表示以顶点作为起点的边，该边也称为顶点的输出边
  - 入度表示以顶点作为终点的边，该边也称为顶点的入射边

很显然在表示和存储一个图时，我们需要保存图的顶点，边，以及边的方向和权重。而图的存储有两个常见方法: 邻接矩阵和邻接表

### 1.1 邻接矩阵
邻接矩阵的底层是一个二维数组，`A[i][j]` 表示从节点 i 指向节点 j 的一条边，`A[i][j]`元素的值表示是否存在这条边或者在带权图中表示边的权重。

邻接矩阵的存储方式简单、直接，基于数组，在获取两个顶点的关系时，非常高效；可以将很多图的运算转换成矩阵之间的运算，计算方便。但是最大的缺点是浪费空间，在无向图中，有一半的空间是浪费的。如果我们存储的是稀疏图,也就是说，顶点很多，但每个顶点的边并不多，那邻接矩阵就更加浪费空间。通常我们遇到的都是稀疏图，所以邻接矩阵的存储方法并不常用。

### 1.2 邻接表

![linkedlist](/images/algo/graph/linked_graph.jpg)

如上图，在邻接表中每个顶点对应一条链表，链表中存储的是与此顶点直接先连的其他顶点。与邻接矩阵相比，邻接表更加节省空间，但是使用起来就比较耗时，如果我们想确定是否存在从 i 指向 j 的边，我们必需遍历顶点 i 上的整个链表。

为了提高查找效率，我们可以将邻接表中的链表改成红黑树、跳表、散列表，甚至将链表改成有序动态数组，通过二分查找的方法来快速定位两个顶点之间否是存在边。至于如何选择，还需要看具体的业务场景。

### 1.3 应用示例
我们以微博的用户关系为例，假设我们需要支持下面这样几个操作：
1. 判断用户 A 是否关注了用户 B；
2. 判断用户 A 是否是用户 B 的粉丝；
3. 根据用户名称的首字母排序，分页获取用户的粉丝列表；
4. 根据用户名称的首字母排序，分页获取用户的关注列表。

社交网络是一张稀疏图，更适合使用邻接表来存储。不过，此处我们需要两个图: 邻接表和逆邻接表。邻接表中存储了用户的关注关系，逆邻接表中存储的是用户的被关注关系，分别用于关注和粉丝两种关系的判断。因为我们有排序需求，而跳表存储的数据本身就是有序的，所以我们选择用跳表来替代链表。

但是对于拥有亿级别用户的微博，显然我们没法将图存在一台机器的内存上。我们可以通过哈希算法等数据分片方式，通过对顶点的哈希然后分片，将邻接表存储在不同的机器上。当要查询顶点与顶点关系的时候，我们就利用同样的哈希算法，先定位顶点所在的机器，然后再在相应的机器上查找。

此外借助于 mysql 这样的外部存储，我们可以将 `(user_id, follower_id)` 这样的关注关系存储在 mysql 中。相比于图这可能是更好的解决方案。

## 2. 实现
图是顶点和边的集合，我们将图的抽象模型定义为三种数据类型的组合: `Vertex`,`Edge` 和 `Graph`。

#### Vertex
Vertex ADT 用来表示顶点对象，有一个用来检索所存储元素的方法  `element()`

#### Edge
Edge ADT 用来表示边，并具有如下方法:
- `element()`: 返回保存的边的值
- `endpoint()`: 返回边对应的`(u, v)`，`u`为边起点，`v`为边的终点
- `opposite(u)`: 传入边的一个端点，返回边的另一个端点

#### Graph
Graph ADT 表示图，包含如下方法:
- `vertex_count()`: 返回图的顶点数量
- `vertices()`: 迭代返回图中的所有顶点
- `edge_count()`: 返回图的边的数量
- `edges()`: 迭代返回图中的所有边
- `get_edge(u, v)`: 返回从顶点 u 到顶点 v 的边，不存在返回 None，对于无向图 `get_edge(u, v)`，`get_edge(v, u)` 没有区别
- `degree(v, out=True)`: 返回顶点的出度，`out=False` 返回顶点的出度
- `incident_edges(v, out=True)`: 迭代返回顶点 v 的输出边，`out=False` 迭代返回顶点的输入边
- `insert_vertex(v=None)`: 创建并返回一个顶点的 Vertex 对象
- `insert_edge(u, v, x=None)`: 创建一个从顶点`u` 到顶点 `v`，存储元素 x 的 `Edge` 边对象
- `remove_vertex(v)`: 删除顶点及与顶点关联的边
- `remove_edge(e)`: 删除边 e

我们接下来就以邻接表，并使用哈希表代替链表的方式实现上述的抽象数据结构。

### 2.1 图的邻接表实现

#### Vertext 和 Edge 类
```Python
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

    def endpoints(self):
        return self._origin, self._destination

    def opposite(self, v):
        return self._destination if v is self._origin else self._origin

    def element(self):
        return self._element

    def __hash__(self):
        return hash((self._origin, self._destination))

```

### Graph 类
```Python
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

    def get_edge(self, u, v):
        return self._outgoing[u].get(v)

    def degree(self, v, outgoing=True):
        adj = self._outgoing if outgoing else self._incoming
        return len(adj[v])

    def incident_edge(self, v, outgoing=True):
        adj = self._outgoing if outgoing else self._incoming
        for edge in adj[v].values:
            yield edge

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
        # 有向图: u --> v ---> v1
        # 无向图: u---> v ---- u
        # 删除以 v 为起点的所有边
        for v1 in self._outgoing[v].keys():
            del self._incoming[v1][v]
        del self._outgoing[v]
        # 删除以 v 为终点的所有边
        if self.is_directed():
            for u in self._incoming[v].keys():
                del self._outgoing[u][v]
            del self._incoming[v]

    def remove_edge(self, e):
        u, v = e.endpoints()
        del self._outgoing[u][v]
        del self._incoming[v][u]

```
