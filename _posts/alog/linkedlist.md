---
title: 03 链表
date: 2018-10-10
categories:
    - Python
tags:
    - 数据结构与算法
---
![linkedlist](/images/algo/linkedlist/single_linkedlist.jpg)

相比于数组必需使用连续的内存空间，链表通过“指针”将一组零散的内存块串联起来使用，因此更加灵活。

<!-- more -->

## 1. 特性
我们知道数组受限于保持数据的连续，插入和删除都需要移动大量的数据，而在链表中插入或者删除一个数据，我们并不需要为了保持内存的连续性而搬移结点，因为链表的存储空间本身就不是连续的。所以，在链表中插入和删除一个数据是非常快速的。

但是，有利就有弊。链表要想随机访问第 k 个元素，就没有数组那么高效了。因为链表中的数据并非连续存储的，所以无法像数组那样，根据首地址和下标，通过寻址公式就能直接计算出对应的内存地址，而是需要根据指针一个结点一个结点地依次遍历，直到找到相应的结点。

### 1.1 性能比较
由于数组和链表是两种截然不同的内存组织方式。正是因为内存存储的区别，它们插入、删除、随机访问操作的时间复杂度正好相反。不过，数组和链表的对比，并不能局限于时间复杂度。而且，在实际的软件开发中，不能仅仅利用复杂度分析就决定使用哪个数据结构来存储数据。

数组简单易用，在实现上使用的是连续的内存空间，可以借助 CPU 的缓存机制，预读数组中的数据，所以访问效率更高。而链表在内存中并不是连续存储，所以对 CPU 缓存不友好，没办法有效预读。

数组的缺点是大小固定，一经声明就要占用整块连续内存空间。如果声明的数组过大，系统可能没有足够的连续内存空间分配给它，导致“内存不足（out of memory）”。如果声明的数组过小，则可能出现不够用的情况。这时只能再申请一个更大的内存空间，把原数组拷贝进去，非常费时。链表本身没有大小的限制，天然地支持动态扩容，我觉得这也是它与数组最大的区别。

虽然常见的数组容器都支持动态扩容，但是当需要申请更大的内容容纳更多的数据，数据的拷贝操作是非常耗时的。

除此之外，如果你的代码对内存的使用非常苛刻，那数组就更适合你。因为链表中的每个结点都需要消耗额外的存储空间去存储一份指向下一个结点的指针，所以内存消耗会翻倍。而且，对链表进行频繁的插入、删除操作，还会导致频繁的内存申请和释放，容易造成内存碎片，如果是 Java 语言，就有可能会导致频繁的 GC（Garbage Collection，垃圾回收）。

## 2. 实现
链表有多种结构，常见的有单链表，双链表，循环链表。接下来我们就来介绍并实现这三种常见的链表。

### 2.1 单链表
![linkedlist](/images/algo/linkedlist/single_linkedlist.jpg)

单链表之所以叫"单"链表，是因为它的每个节点只保存了指向下一个节点的指针，而没有保存指向它自己的前一个节点的指针。因此在插入节点时，我们必需先获取插入位置之前的节点。

为了方便后续用链表去实现栈和队列，我们在单链表中显示的维护一个 `_head` 和`_tail` 的指针用于指向链表的首尾节点，并实现下面三个方法:
1. 在链表的头部插入一个节点
2. 删除链表的头节点
3. 在链表尾部添加一个节点

因为我们必需遍历整个链表才能获取尾节点的前一个节点，所以很难高效的从单链表的尾部删除元素，所以我们不会实现一个删除尾节点的方法。

```python
class Link(object):
    class _Node(object):
        __slots__ = "_next", "_element"

        def __init__(self, element, nxt=None):
            self._next = nxt
            self._element = element

        def __str__(self):
            a = self._next
            b = [str(self._element)]
            while a:
                b.append(str(a._element))
                a = a._next
            return '->'.join(b)

    def __init__(self):
        self._head = None
        self._tail = None
        self._size = 0

    def __len__(self):
        return self._size

    def is_empty(self):
        return self._size == 0

    def _insert_tail(self, element):
        """
        :param element:
        :return: 链表尾部追加元素
        """
        node = self._Node(element)
        if self.is_empty():
            self._head = self._tail = node
        else:
            self._tail._next = node
            self._tail = node
        self._size += 1

    def _remove_head(self):
        """
        :return: 链表首部删除元素
        """
        if self.is_empty():
            raise ValueError('link is empt')
        answer = self._head._element
        self._head = self._head._next
        self._size -= 1
        if self.is_empty():
            self._tail = None
        return answer

    def _insert_head(self):
        """
        :return: 链表首部添加元素
        """
        node = self._Node(element)
        if self.is_empty():
            self._head = self._tail = node
        else:
            node._next = self._head
            self._head = node
        self._size += 1

    # 栈方法
    pop = _remove_head
    push = _insert_head

    # 堆方法
    enqueue = _insert_tail
    dequeue = _remove_head

```

### 2.4 循环链表
![linkedlist](/images/algo/linkedlist/cycle_linkedlist.jpg)

循环链表跟单链表唯一的区别就在尾结点。单链表的尾结点指针指向空地址，表示这就是最后的结点了。而循环链表的尾结点指针是指向链表的头结点。

和单链表相比，循环链表的优点是从链尾到链头比较方便。当要处理的数据具有环型结构特点时，就特别适合采用循环链表。比如著名的[约瑟夫问题](https://zh.wikipedia.org/wiki/%E7%BA%A6%E7%91%9F%E5%A4%AB%E6%96%AF%E9%97%AE%E9%A2%98)

双向链表的实现与单向链表大体上相同，除了尾节点的特殊处理。因此，我们暂时忽略循环链表的实现，等到下一章我们使用一个循环链表来实现一个队列，再来展示循环链表的实现。

### 2.3 双链表
![linkedlist](/images/algo/linkedlist/prev_linkedlist.jpg)

双向链表需要额外的两个空间来存储后继结点和前驱结点的地址。可以支持双向遍历，这样也带来了双向链表操作的灵活性。链表在插入和删除时必需先找到被操作节点的前驱节点，而单链表并不支持直接获取其前驱节点，必需从头开始重新遍历链表。而双向链表支持双向便利可直接获取，所以操作起来更加灵活。

除了插入、删除操作有优势之外，对于一个有序链表，双向链表的按值查询的效率也要比单链表高一些。因为，我们可以记录上次查找的位置 p，每次查询时，根据要查找的值与 p 的大小关系，决定是往前还是往后查找，所以平均只需要查找一半的数据。

在双链表的实现中，我们将引入头哨兵和尾哨兵；使用哨兵可以帮助我们避免处理链表中没有节点时的特殊情况帮助我们简化双向链表的实现。这里可以与上面不使用哨兵的单向链表作对比。

```python
class DoubleLink(object):
    class _Node(object):
        __slots__ = "_element", "_next", "_pre"

        def __init__(self, element, pre=None, nxt=None):
            self._element = element
            self._next = nxt
            self._pre = pre

    def __init__(self):
        self._head = self._Node(None)
        self._tail = self._Node(None)
        self._head._next = self._tail
        self._tail._pre = self._head
        self._size = 0

    def __len__(self):
        return self._size

    def is_empty(self):
        return self._size == 0

    def insert_between(self, element, pre_node, next_node):
        """
        :param element:
        :param pre_node:
        :param next_node:
        :return: 在两个节点之间插入一个节点
        """
        node = self._Node(element, pre=pre_node, nxt=next_node)
        pre_node._next = node
        next_node._pre = node
        self._size += 1
        return node

    def insert_head(self, element):
        return self.insert_between(element, self._head, self._head._next)

    def delete_node(self, node):
        """
        :param node:
        :return: 删除节点
        """
        element = node._element
        node._pre._next = node._next
        node._next._pre = node._pre
        self._size -= 1
        node._pre = node._next = node._element = None
        return element

```

## 3. 相关算法
相比与数组，链表写起来就很复杂，有如下一些算法，可以帮助我们练习链表。为了简化代码实现，下面所有函数的参数 `link` 都是 下面 `Node` 类的实例

```python
class Node(object):
    def __init__(self, data=None, nxt=None):
        self.data = data
        self.nxt = nxt

    def __str__(self):
        a = self.nxt
        b = [str(self.data)]
        while a:
            b.append(str(a.data))
            a = a.nxt
        return '->'.join(b)
```

### 3.1 单链表反转

```python
def reverse(link):
    pre = None
    pwd = link
    while pwd:
        # print pre.data, pwd.data
        # pwd.nxt, pwd, pre = pre, pwd.nxt, pwd
        pwd.nxt, pre, pwd = pre, pwd, pwd.nxt
        # pre, pwd.nxt, pwd = pwd, pre, pwd.nxt
    return pre
```


### 3.2 链表中环的检测

```python
def has_cycle(link):
    one = double = link
    while double.nxt and double.nxt.nxt:
        one = one.nxt
        double = double.nxt.nxt
        if one is double:
            return True
    return False
```

### 3.3 两个有序链表的合并
```python
def merge(link_one, link_two):
    link = Node()
    a = link_one
    b = link_two
    c = link
    while a and b:
        if a.data < b.data:
            c.nxt = a
            a = a.nxt
        else:
            c.nxt = b
            b = b.nxt
        c = c.nxt
    if a is not None:
        c.nxt = a
    if b is not None:
        c.nxt = b
    return link.nxt
```

### 3.4 删除链表倒数第 n 个节点
```python
def delete_last(link, n):
    if link is None:
        return link
    pre = None
    first = link
    second = link
    for i in range(1, n):
        second = second.nxt
        if second is None:
            return None
    while second.nxt:
        second = second.nxt
        pre = first
        first = first.nxt
    if pre is None:
        return first.nxt
    else:
        pre.nxt = first.nxt
        return link
```

### 3.5 求链表的中间节点
```python
def get_middle(link):
    if link is None or link.nxt is None:
        return link, None
    one = link
    double = link
    while double.nxt and double.nxt.nxt:
        one = one.nxt
        double = double.nxt.nxt
    if double.nxt is None:
        return one, None
    else:
        return one, one.nxt
```

### 3.6 基于链表实现 LRU 缓存算法
实现思路如下:
1. 我们维护一个有序单链表，越靠近链表尾部的结点是越早之前访问的。当有一个新的数据被访问时，我们从链表头开始顺序遍历链表。
2. 如果此数据之前已经被缓存在链表中了，我们遍历得到这个数据对应的结点，并将其从原来的位置删除，然后再插入到链表的头部。
3. 如果此数据没有在缓存链表中，又可以分为两种情况：
  - 如果此时缓存未满，则将此结点直接插入到链表的头部；
  - 如果此时缓存已满，则链表尾结点删除，将新的数据结点插入链表的头部。

实际上，我们可以继续优化这个实现思路，比如引入（Hash table）来记录每个数据的位置，将缓存访问的时间复杂度降到 O(1)，具体实现会在[散列表与连表](https://hotttao.github.io/2018/10/22/alog/hash_list)相关章节给出。

## 4. linkcode 习题


**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
- [《数据结构与算法：python语言实现》](https://book.douban.com/subject/30323938/)
