---
title: 06 递归
date: 2018-10-13
categories:
    - Python
tags:
    - 数据结构与算法
---
![linkedlist](/images/algo/recursion/recursion_image.jpg)

递归是一种应用非常广泛的算法（或者编程技巧）。很多数据结构和算法的编码实现都要用到递归，比如 DFS 深度优先搜索、前中后序二叉树遍历等等。所以，搞懂递归非常重要。

<!-- more -->

## 1 特性
基本上，所有的递归问题都可以用递推公式来表示。要想使用递归解决问题，必需满足三个前提条件:
1. 一个问题的解可以分解为几个子问题的解，子问题就是规模更小的问题
2. 这个问题与分解之后的子问题，除了数据规模不同，求解思路完全一样
3. 存在递归终止条件

### 1.1 如何写递归代码
写递归代码的关键就是找到如何将大问题分解为小问题的规律，并且基于此**写出递推公式**，然后再**找出终止条件**，最后将递推公式和终止条件翻译成代码。

编写递归代码的关键是，只要遇到递归，我们就把它抽象成一个递推公式，不用想一层层的调用关系，不要试图用人脑去分解递归的每个步骤。

### 1.2 递归存在的问题
使用递归时会存在很多问题，最常见的两个是:
1. 递归代码要警惕堆栈溢出
2. 递归代码要警惕重复计算

在时间效率上，递归代码里多了很多函数调用，当这些函数调用的数量较大时，就会积聚成一个可观的时间成本。在空间复杂度上，因为递归调用一次就会在内存栈中保存一次现场数据，所以在分析递归代码空间复杂度时，需要额外考虑这部分的开销。

### 1.3 应用
递归有利有弊，利是递归代码的表达力很强，写起来非常简洁；而弊就是空间复杂度高、有堆栈溢出的风险、存在重复计算、过多的函数调用会耗时较多等问题。所以，在开发过程中，我们要根据实际情况来选择是否需要用递归的方式来实现。

**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
