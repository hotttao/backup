---
title: 12 二分查找
date: 2018-10-19
categories:
    - Python
tags:
    - 数据结构与算法
---
![linkedlist](/images/algo/binary_search/binary_image.jpg)
不简单的简单二分查找

<!-- more -->

## 1. 特性
二分查找针对的是一个有序的数据集合，查找思想有点类似分治思想。每次都通过跟区间的中间元素对比，将待查找的区间缩小为之前的一半，直到找到要查找的元素，或者区间被缩小为 0。

二分查找看似简单，但是二分查找的变体一点都不简单，“你”经常看到的二分查找其实是最简单的二分查找即: **有序数组中不存在重复元素**，通过二分查找**值等于**给定值的数据。注意**不重复**和**等于**，这里存在很多的变体。

其次二分查找存在很大的局限性:
1. 二分查找依赖的是顺序表结构，简单点说就是数组。
  - 主要原因是二分查找算法需要按照下标随机访问元素。数组按照下标随机访问数据的时间复杂度是 O(1)
  - 如果是链表，随机访问的时间复杂度是 O(n)。如果数据使用链表存储，二分查找的时间复杂就会变得很高。
  - 其他数据结构存储的数据，则无法应用二分查找。
2. 二分查找针对的是有序数据。如果数据没有序，就要先排序。
  - 所以，二分查找只能用在插入、删除操作不频繁，一次排序多次查找的场景中
  - 针对频繁插入删除的动态数据集合二分查找将不再适，快速查找需要使用二叉树
3. 数据量太大不适合二分查找: 二分查找依赖数组，而数组为了支持随机访问，需要**连续**的内存空间，对内存的要求苛刻。


要注意数组要求的连续内存意味着即便系统上有零散的 2G 内存也无法申请到连续的 1G 内存。虽然数组对内存要求苛刻，但是同等条件下数组却是最省内存空间的存储方式，因为除了数据本身之外，不需要额外存储其他信息。

## 1.1 二分查找的变形
如果放开**不重复**和**等于**的限制，二分查找有很多变形，典型的包括:
1. 查找第一个值等于给定值的元素
2. 查找最后一个值等于给定值的元素
3. 查找第一个大于等于给定值的元素
4. 查找最后一个小于等于给定值的元素

凡是用二分查找能解决的，绝大部分我们更倾向于用散列表或者二叉查找树。即便是二分查找在内存使用上更节省，但是毕竟内存如此紧缺的情况并不多。实际上，“值等于给定值”的二分查找确实不怎么会被用到，二分查找更适合用在“近似”查找问题，在这类问题上，二分查找的优势更加明显。比如今天讲的这几种变体问题，用其他数据结构，比如散列表、二叉树，就比较难实现了。

## 2. 实现
### 2.1 最简单的二分查找
```python

def binary_search(A, value):
  start  = 0
  end = len(A) - 1
  while start <= end:
    mid = start + ((end -start) >> 1)
    if A[mid] == value:
      return mid
    elif A[mid] < value:
      start = mid + 1
    else:
      end = mid -1
```
最简单的二分查找实现中有以下几个需要注意的点:
1. 循环退出条件是 `start <= end` 不是 `start < end`
2. 使用 `mid=(low+high)/2` 对mid取值是有问题的。因为如果 low 和 high 比较大的话，两者之和就有可能会溢出。改进的方法是将 mid 的计算方式写成 `low+(high-low)/2`。更进一步，如果要将性能优化到极致的话，我们可以将这里的除以 2 操作转化成位运算 `low+((high-low)>>1)`。因为相比除法运算来说，计算机处理位运算要快得多。
3. start 和 end 的更新，如果直接写成 `low=mid` 或者 `high=mid`，就可能会发生死循环。比如，当 `high=3，low=3` 时，如果 `a[3]` 不等于 value，就会导致死循环。

### 2.2 查找第一个值等于给定值的元素
```python
def bs_first(A, value):
  start = 0
  n = end = len(A) - 1
  while start <= end:
    mid = start + ((end - start) >> 1)
    if A[mid] < value:
      start = mid + 1
    elif A[mid] > value:
      end = mid - 1
    else:
      # 判断当前 mid 是否为第一个出现的值
      if mid == 0 or (A[mid-1] != value): return mid
      end = mid - 1
```

### 2.3 查找最后一个值等于给定值的元素
```python
def bs_end(A, value):
  start = 0
  n = end = len(A) - 1
  while start <= end:
    mid = start + ((end - start) >> 1)
    if A[mid] < value:
      start = mid + 1
    elif A[mid] > value:
      end = mid - 1
    else:
      # 判断当前 mid 是否为最后一个出现的值
      if mid == n or (A[mid + 1] != value): return mid
      end = mid + 1
```

### 2.4 查找第一个大于等于给定值的元素
```python
def bs_gte_first(A, value):
  start = 0
  n = end = len(A) - 1
  while start <= end:
    mid = start + ((end - start) >> 1)
    if A[mid] >= value:
      # 判断是否为第一个
      if mid == 0 or (A[mid - 1] < value): return mid
      end = mid - 1
    else:
      start  = mid + 1
```

### 2.5 查找最后一个小于等于给定值的元素
```python
def bs_lte_end(A, value):
  start = 0
  n = end = len(A) - 1
  while start <= end:
    mid = start + ((end - start) >> 1)
    if A[mid] > value:
      end = mid -1
    else:
      # 判断是否为最后一个
      if mid == n or (A[mid + 1] > value): return mid
      start = mid + 1
```

**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
- [《数据结构与算法：python语言实现》](https://book.douban.com/subject/30323938/)
