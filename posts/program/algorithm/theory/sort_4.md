---
title: 10 工业级的排序算法
date: 2018-10-18
categories:
    - Python
tags:
    - 数据结构与算法
---
![linkedlist](/images/algo/sort/all_sort.jpg)
实现一个通用的，高效的工业级排序函数

<!-- more -->

## 1. 排序算法对比
前面我们介绍了最常见最经典的几个排序算法，它们有不同的时间复杂度，空间复杂度与使用情景。那么如何用它们实现一个通用的、高效率的排序函数呢？
1. 线性排序算法的时间复杂度比较低，但适用场景太过比较特殊，所以几乎不会使用。
2. 为了兼顾任意规模数据的排序，一般都会首选时间复杂度是 O(nlogn) 的排序算法来实现排序函数。比如 Java 语言采用堆排序实现排序函数，C 语言使用快速排序实现排序函数。
3. 归并排序由于不是原地排序算法，空间复杂度为 O(n)，数剧集大时过于占用内存，所以很少使用。


## 1.2 快排优化
快速排序在最坏情况下的时间复杂度是 O(n2)，原因主要是我们的分区点选择不够合理。有两种比较常用合理的分区算法:
1. 三数取中法: 每间隔某个固定的长度，取数据出来比较，将中间值作为分区点
2. 随机法: 从要排序的区间中，随机选择一个元素作为分区点

此外快速排序是用递归来实现的，递归要警惕堆栈溢出。为了避免快速排序里，递归过深而堆栈过小，导致堆栈溢出，我们有两种解决办法：第一种是限制递归深度。一旦递归过深，超过了我们事先设定的阈值，就停止递归。第二种是通过在堆上模拟实现一个函数调用栈，手动模拟递归压栈、出栈的过程，这样就没有了系统栈大小的限制。


## 2. 实现
### 2.1 Glibc 的 qsort
我们以 Glibc 中的 `qsort()` 函数为例来说明如何实现一个排序函数:
1. `qsort()` 会优先使用归并排序来排序输入数据，因为小数据集下，归并排序不会占用多少内存，且排序快
2. 要排序的数据量比较大的时候，`qsort()` 会改为用快速排序算法来排序
3. `qsort()` 使用“三数取中法”选择分区点
4. `qsort()` 是通过自己实现一个堆上的栈，手动模拟递归来解决操作系统的堆栈溢出问题
5. 在快速排序的过程中，当排序区间的元素个数小于等于 4 时，`qsort()` 就退化为插入排序；因为我们前面也讲过，在小规模数据面前，插入排序比递归调用的快排更快
6. 在 `qsort()` 插入排序的算法实现中，还利用了哨兵技术，来减少判断的次数

### 2.2 Tim-Sort
```python
pass
```

**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
- [《数据结构与算法：python语言实现》](https://book.douban.com/subject/30323938/)