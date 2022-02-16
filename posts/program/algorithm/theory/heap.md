---
title: 21 堆
date: 2018-10-28
categories:
    - Python
tags:
    - 数据结构与算法
---
能找到"最好学生"的堆

![heap](/images/algo/heap/heap.jpg)

<!-- more -->

## 1. 特性
堆是一种特殊的二叉树，它满足如下两个属性:
1. 堆是一完全二叉树
2. 堆中每个节点的值都必需大于等于(或小于等于)其子树中每个节点的值，下称为 `Heap-Order`

完全二叉树被定义为除了最后一层，其他层的节点个数都是满的，最后一层的节点都靠左排列。所以完全二叉树具有如下一些特性:
1. 非常适合使用数组进行存储，不会出现空间浪费
2. 如果下标从 1 开始，下标为 `i` 的节点的左右子节点的下标是 `2*i`，`2*i+1`；
3. 对于一个有 n 个元素的完全二叉树，树的高度为 `logn`

为了维护堆的`Heap-Order`，当我们更改堆中的元素时，我们需要在堆中上下交换堆的元素，额外交换的次数不会超过树的高度即 `logn`，所以堆的更新操作的时间复杂度为 `O(logn)`。

### 1.1 支持的操作
堆支持以下一些常用操作:
1. 添加一个元素: 将元素添加到数组的末尾，并对其从下往上的堆化，时间复杂度为 `logn`
2. 删除堆顶元素: 删除堆顶元素，并用数组末尾元素填充堆顶，对新的堆顶元素从上往下的堆化，时间复杂度为 `logn`
3. 构建堆: 自底向上的构建堆，时间复杂度为`O(n)`
4. 堆排序: 包括建堆和排序，排序的时间复杂度为`O(nlogn)`


### 1.2 堆排序与快速排序
堆排序与快速排序都是原地排序算法，排序的平均时间复杂度都是`O(nlogn)`，甚至堆排序比快排更加稳定。但是快排的性能还是比堆排序要好，原因有两个:
1. 堆排序数据访问的方式没有快排友好。快排中数据是顺序访问的，但是堆排序是按照指数跳越访问的，对 CPU 缓存不友好
2. 对于同样的数据，在排序过程中，堆排序算法的数据交换次数要多于快速排序。对于基于比较的排序算法来说，整个排序过程就是由两个基本的操作组成的，比较和交换（或移动）。快速排序数据交换的次数不会比逆序度多。但是堆排序的第一步是建堆，建堆的过程会打乱数据原有的相对先后顺序，导致原数据的有序度降低。

## 2. 实现
### 2.1 小堆的实现
我们选择小堆作为堆实现的示例，大堆的实现类似。对于堆而言最核心的就是从下往上和从上往下的堆化操作。

```Python

class PriorityQueueBase(object):

    class _Item(object):
        __slots__ = '_key', '_value'

        def __init__(self, key, value):
            self._key = key
            self._value = value

        def __gt__(self, other):
            return self._key > other._key

        def __lt__(self, other):
            return self._key < other._key

        def __eq__(self, other):
            return self._key == other._key


class HeapPriorityQueue(PriorityQueueBase):
    def __init__(self, content=()):
        """
        :return: 构建堆
        """
        self._data = [self._Item(k,v) for k, v in content]
        if self._data:
            self._heap()

    def _heap(self):
        """
        """
        i = self._parent(len(self._data) - 1)
        while i >= 0:
            self._downheap(i)
            i -= 1

    def _parent(self, i):
        """
        :param i:
        :return: 父节点索引
        """
        return (i - 1) // 2

    def _left(self, i):
        """
        :param i:
        :return: 左子节点索引
        """
        return i * 2 + 1

    def _right(self, i):
        """
        :param i:
        :return: 右子节点索引
        """
        return i * 2 + 2

    def has_left(self, i):
        return self._left(i) < len(self._data)

    def has_right(self, i):
        return self._right(i) < len(self._data)

    def _swap(self, i, j):
        """
        :return: 数据交换
        """
        self._data[i], self._data[i] = self._data[j], self._data[i]

    def _upheap(self, i):
        """
        :param i:
        :return: 从下往上堆化
        """
        parent = self._parent(i)
        while self._data[parent] > self._data[i] and i > 0:
            self._swap(parent, i)
            i = parent
            parent = self._parent(parent)

    def _downheap(self, i):
        """
        :param i:
        :return: 从上往下堆化
        """
        while self.has_left(i):
            small_child = self._left(i)
            if self.has_right(i):
                right = self._right(i)
                if self._data[small_child] > self._data[right]:
                    small_child = right
            if self._data[i] > self._data[small_child]:
                self._swap(i, small_child)
                i = small_child
            else:
                break

    def __len__(self):
        return len(self._data)

    def is_empty(self):
        return len(self) == 0

    def add(self, key, value):
        """
        :param key:
        :param value:
        :return: 向堆中添加元素
        """
        self._data.append(self._Item(key, value))
        self._upheap(len(self._data) - 1)

    def min(self):
        """
        :return: 获取堆顶元素，但不删除
        """
        if not self.is_empty():
            item = self._data[0]
            return item._key, item._value
        raise ValueError('Priority Queue is empty')

    def remove_min(self):
        """
        :return: 获取并删除堆顶元素
        """
        if self.is_empty():
            ValueError('Priority Queue is empty')
        item = self._data[0]
        self._data[0] = self._data.pop()
        self._downheap(0)
        return item._key, item._value

```

### 2.2 堆的原排序
堆的原排序排序包括两个过程: 建堆+排序。建堆就是上面 `_heap` 方法展示的过程，通过由底向上构建堆，我们可以在 `O(n)` 的时间复杂度内实现堆构建。

排序时，我们将堆顶元素与数组最后的元素交换，然后对前 `n-1` 个元素组成的堆堆化，然后再将堆顶元素与数组倒数第二个元素交换，以此类推，当堆中只剩下一个元素时排序即完成。

很可惜的是，我们上面的小堆实现无法实现堆的原地排序，因为我们无法控制堆中的元素个数，以达到缩减堆范围的目的。但是实现起来也很简单，通过添加额外的可控的计数器作为堆元素个数的记录，而不是直接使用 `len(self._data)` 我们就可以很容易实现。


### 2.2 可删除和修改任意位置的堆
最后我们介绍一种可更新和删除任意位置的堆。我们使用一个叫作定位器 `Locator` 对象作为堆中的元素，`Locator`记录了元素在堆中数组的索引，在执行更新和删除操作时，将`Locator`作为参数传递给函数，就可以直接定位元素位置，并对其执行更新操作。

```Python
class AdaptHeapPriorityQueue(HeapPriorityQueue):
    class Locator(HeapPriorityQueue._Item):
        __slots__ = '_index'

        def __init__(self, key, value, index):
            super(AdaptHeapPriorityQueue.Locator, self).__init__(key, value)
            self._index = index

    def __init__(self):
        super(AdaptHeapPriorityQueue, self).__init__()

    def add(self, key, value):
        token = self.Locator(key, value, len(self._data))
        self._data.append(token)
        self._upheap(len(self._data) - 1)
        return token

    def _swap(self, i, j):
        super(AdaptHeapPriorityQueue, self)._swap(i, j)
        self._data[i]._index = i
        self._data[j]._index = j

    def _bubble(self, j):
        if j > 0 and self._data[j] < self._data[self._parent(j)]:
            self._upheap(j)
        else:
            self._downheap(j)

    def update(self, loc, key, value):
        j = loc._index
        if not (0 < j < len(self) and self._data[j] is loc):
            raise ValueError('invalid locator')
        loc._key = key
        loc._value = value
        self._bubble(j)

    def remove(self, loc):
        j = loc._index
        if not (0 < j < len(self) and self._data[j] is loc):
            raise ValueError('invalid locator')
        if j == len(self) - 1:
            self._data.pop()
        else:
            self._data[j] = self._data.pop()
            self._bubble(j)
        return loc._key, loc._value

```

## 3 算法
堆有众多应用，限于篇幅，我们在接下来的一节来专门讲解。


**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
- [《数据结构与算法：python语言实现》](https://book.douban.com/subject/30323938/)
