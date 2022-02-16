---
title: 31 初识动态规划
date: 2018-11-10
categories:
    - Python
tags:
    - 数据结构与算法
---

编程思想之动态规划初识

<!-- more -->

## 1. 动态规划
动态规划是几个编程思想中最难的一个，它与回溯密切相关。回溯问题是在一组可能的解中，搜索满足期望的解；采用的方法类似枚举，找出所有解，筛选符合要求的解；而动态规划比较适合用来求解最优问题，比如求最大值、最小值等等。基本上所有的动态规划问题都能用回溯算法解决，但是动态规划能有效避免回溯算法中的重复计算，提高代码执行效率。

### 1.1 解决思路
上一节我们用回溯算法解决了0-1背包问题，并阐述了回溯算法中可能存在重复计算的问题，借助于对子问题的缓存，我们能有效避免重复计算。但是需要注意的是这种方法并不是总是有效。

与回溯算法类似，动态规划中，我们同样把问题分解为多个阶段，每个阶段对应一个决策。我们记录每一个阶段可达的状态集合并去重，然后通过当前阶段的状态集合，来推导下一个阶段的状态集合，直至达到最终状态，并从中选择一个最优解。通过记录每个阶段的所有可达状态并去重来避免重复计算。

尽管动态规划的执行效率提高了，但是动态规划的空间复杂度也提高了，所以，很多时候，我们会说，动态规划是一种空间换时间的算法思想。

## 2.1 应用
### 2.1 动态规划解0-1背包问题
现在我们用动态规划来解决上一节的0-1背包问题，我们把整个求解过程分为 n 个阶段，每个阶段会决策一个物品是否放到背包中。每个物品决策（放入或者不放入背包）完之后，背包中的物品的重量会有多种情况，也就是说，会达到多种不同的状态，对应到递归树中，就是有很多不同的节点。

我们把每一层重复的状态（节点）合并，只记录不同的状态，然后基于上一层的状态集合，来推导下一层的状态集合。我们可以通过**合并每一层重复的状态**，这样就保证每一层不同状态的个数都不会超过 w 个（w 表示背包的承载重量），也就是例子中的 9。于是，我们就成功避免了每层状态个数的指数级增长。

我们用一个二维数组 `states[n][w+1]`，来记录每层可以达到的不同状态。`n`表示第n个物品，`w+1` 表示当前背包的重量。
![0-1](/images/algo/dp/0_1.jpg)
![0-1](/images/algo/dp/0_1_a.jpg)

```Python
def rucksack_hold(items, weight):
    status = [[0] * (weight + 1) for i in range(len(items))]
    status[0][0] = 1
    status[0][items[0]] = 1
    for i in range(1, len(items)):
        for j in range(weight + 1):
            if status[i - 1][j]:
                status[i][j] = status[i - 1][j]
                if j + items[i] <= weight:
                    status[i][j + items[i]] = 1
    for l in status:
        print l

    # 判断可放置的最大重量
    j = weight
    n = len(items) - 1
    while j >= 0:
        if status[n][j]:
            break
    print j
    # 打印最大重量，放置的物品
    for i in range(n, 1, -1):
        if j - items[i] >= 0 and status[i - 1][j - items[i]]:
            print i, items[i]
            j -= items[i]


rucksack_hold([2, 2, 4, 6, 3], 9)
```

实际上我们可以有一个比上面空间复杂度更小的解法，代码如下:
```Python
def rucksack_hold_2(items, weight):
    status = [0] * (weight + 1)
    status[0] = 1
    status[items[0]] = 1
    print status
    for i in range(1, len(items)):
        for j in range(weight - items[i], -1, -1):
            if status[j]:
                status[j + items[i]] = 1
        print status


rucksack_hold_2([2, 2, 4, 6, 3], 9)
```

### 2.2 升级的 0-1 背包问题
这次我们引入物品价值，要求计算在满足背包最大重量限制的前提下，背包中可装入物品的最大总价值。

使用动态规划的求解过程与上面类似，只不过现在 status 数组记录的不再是0或1，而是当前状态对应的最大总价值。我们把每一层中 `(i, cw)` 重复的状态（节点）合并，只记录 cv 值最大的那个状态，然后基于这些状态来推导下一层的状态。如果用回溯算法，这个问题就没法再用“备忘录”解决了。

 ```Python
 def rucksack_hold_3(items, weight, values):
    status = [[None] * (weight + 1) for i in range(len(items))]
    status[0][0] = 0
    status[0][items[0]] = values[0]
    for i in range(1, len(items)):
        for j in range(weight + 1):
            if status[i - 1][j] >= 0:
                status[i][j] = status[i - 1][j]
                if j + items[i] <= weight:
                    v = status[i - 1][j] + values[i]
                    if status[i][j + items[i]] < v:
                        status[i][j + items[i]] = v
    for l in status:
        print l

print '------------------'
a = [3, 4, 8, 9, 6]
# a = [1, 1, 1, 1, 1]
rucksack_hold_3([2, 2, 4, 6, 3], 9, a)
```

## 3. 练习
### 3.1 练习一杨辉三角
我们对杨辉三角进行一些改造。每个位置的数字可以随意填写，经过某个数字只能到达下面一层相邻的两个数字。假设你站在第一层，往下移动，我们把移动到最底层所经过的所有数字之和，定义为路径的长度。请你编程求出从最高层移动到最底层的最短路径长度。

![0-1](/images/algo/dp/yang.jpg)

```Python
def path_pascal_triangle(pt):
    """
    :param pt:
    :return: 计算杨辉三角的最短路径
    """
    n = len(pt)
    status = []
    for i in range(0, n):
        s = [float('inf')] * (i + 1)
        row = pt[i]
        if i == 0:
            s[0] = row[0]
            s[-1] = row[-1]
        else:
            s[0] = row[0] + status[i - 1][0]
            s[-1] = row[-1] + status[i - 1][-1]
        status.append(s)
    print status

    for i in range(2, n):
        for j in range(1, i):
            left = j - 1
            right = j
            status[i][j] = min(status[i - 1][left], status[i-1][right]) + pt[i][j]
    print status
    return min(status[-1])

ss = [
    [3],
    [1, 2],
    [5, 6, 7],
    [1, 1, 1, 1]
]

print path_pascal_triangle(ss)

```


**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
