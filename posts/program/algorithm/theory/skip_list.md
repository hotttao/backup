---
title: 13 跳表
date: 2018-10-20
categories:
    - Python
tags:
    - 数据结构与算法
---
跳表: 链表上的“二分查找”

<!-- more -->

## 1. 特性
跳表是一种动态数据结构，支持快速的插入、删除、查找操作，时间复杂度都是 O(logn)。实现上跳表使用空间换时间的思想，通过构建多级索引来提高查询的效率，实现了基于链表的“二分查找”。

### 1.1 跳表的结构
跳表就是在**有序**链表的基础上添加了多层"索引"。通过每隔几个节点提取一个节点形成上层索引，每层索引的节点个数成等比数列分布，从顶向下的每次查询都会将查询区间“折半”，从而达到 O(logN) 的时间复杂度。每次查询对查询区间的缩减取决于索引构建策略，通过改变索引构建策略，有效平衡执行效率和内存消耗。待会我们会看到更加具体的分析过程。

![linkedlist](/images/algo/skip_list/skip_show.jpg)

跳表是一种各方面性能都比较优秀的动态数据结构，可以支持快速的插入、删除、查找操作，写起来也不复杂，甚至可以替代红黑树。Redis 中的有序集合（Sorted Set）就是在跳表的基础上实现的。

### 1.2 跳表的查找
假设我们每隔两个节点构建一层索引，最上层有两个节点，总共有 N 个节点。则第 h 层的节点个数为 N/2^h，包含最底层的链表在内总共有 logN 层。如果每一层都要遍历 m 个结点，那在跳表中查询一个数据的时间复杂度就是 `O(m*logn)`。对于每隔两个节点构建的索引 m=3。

原因是，假设我们要查找的数据是 x，在第 k 级索引中，我们遍历到 y 结点之后，发现 x 大于 y，小于后面的结点 z，所以我们通过 y 的 down 指针，从第 k 级索引下降到第 k-1 级索引。在第 k-1 级索引中，y 和 z 之间只有 3 个结点（包含 y 和 z），所以，我们在 K-1 级索引中最多只需要遍历 3 个结点，依次类推，每一级索引都最多只需要遍历 3 个结点。

![linkedlist](/images/algo/skip_list/skip_list_image.jpg)

所以在跳表中查询任意数据的时间复杂度就是 O(logn)。而整个跳表需要额外添加的节点数为`n/2+n/4+n/8…+8+4+2=n-2`，所以空间复杂度为 O(n)。

如果我们每三个结点或五个结点，抽一个结点到上级索引。总的索引结点大约就是 `n/3+n/9+n/27+…+9+3+1=n/2`，而查询时间复杂度的系数就会从 3 变成 4。因此通过改变索引构建策略，有效平衡执行效率和内存消耗。

### 1.3 跳表的插入
跳表的插入有两个要点:
1. 要保证原始链表中数据的有序性
2. 要维护索引与原始链表大小之间的平衡，避免复杂度退化

因此在插入前需要先找到插入位置，然后通过一个随机函数，来决定将这个结点插入到哪几级索引中。整个过程的时间复杂度= O(logn)(查找) + O(1)(链表的插入)

### 1.4 跳表的删除
删除的过程只是在查找的基础上多了链表的删除操作，对于双向链表而言删除的时间复杂度也是 O(logn)。需要注意的是删除的节点也可能出现在索引中，需要一并删除。

### 1.5 跳表与红黑树
跳表和红黑树都是非常高效的动态数据结构，在插入、删除、查找以及迭代输出有序序列上，时间复杂度都是 O(logn)。但是存在以下不同:
1. 按照区间来查找数据，跳表比红黑树更加高效，跳表可以在 O(logn) 的时间复杂度定位区间的起点，然后在原始链表中顺序往后遍历即可
2. 相对于红黑树跳表更加简单灵活，通过改变索引构建策略，可以有效平衡执行效率和内存消耗
3. 红黑树出现的更早，很多编程语言中的 Map 类型都是通过红黑树实现的。可以直接拿来用，但是跳表并没有一个现成的实现，想要使用必须自己实现。

## 2. 实现
跳表的实现有以下几个关键点:
1. SkipNode 表示调表中的一个节点，每个SkipNone都包含一个 `next=[SkipNone]`:
	- len(next) 就是当前节点的层高
	- next[i] 表示第 i 层的后继节点
2. 通过随机法，来决定一个节点的层数
3. 无论查找，插入，还是删除，我们都需要获取带查找节点的前驱节点
4. 查找前驱节点，必须从最顶层查找到最底层，因为需要保留每一层的前驱节点
4. Go 语言中，我们还需要为保存的值实现接口

下面是调表的 Python 与 Go 实现。

### 2.1 Python 实现
下面是 Python 的跳表实现。

```python

```

### 2.2 Go 实现

```Go

```

**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
- [《数据结构与算法：python语言实现》](https://book.douban.com/subject/30323938/)