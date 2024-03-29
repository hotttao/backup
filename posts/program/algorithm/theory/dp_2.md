---
title: 32 动态规划理论
date: 2018-11-11
categories:
    - Python
tags:
    - 数据结构与算法
---

编程思想之动态规划理论

<!-- more -->

## 1. 再论动态规划
动态规划比起其三个算法思想更难懂。上一篇文章我们从实践角度介绍了如何利用动态规划解决问题。有了这个基础，接下来我们来解决如下几个问题:
1. 什么样的问题可以用动态规划解决？
2. 解决动态规划问题的一般思考过程是什么样的？
3. 贪心、分治、回溯、动态规划这四种算法思想又有什么区别和联系？

### 1.1 适用场景
动态规划适合解决的问题可以概括为“一个模型三个特征”。
1. 一个模型: 多阶段决策最优解模型。动态规划通常被用来解决最优问题，而解决问题的过程，需要经历多个决策阶段。每个决策阶段都对应着一组状态。然后我们寻找一组决策序列，经过这组决策序列，能够产生最终期望求解的最优值。
2. 三个特征:
  - 最优子结构
  - 无后效性
  - 重复子问题

#### 最优子结构
最优子结构指的是，问题的最优解包含子问题的最优解。反过来说就是，我们可以通过子问题的最优解，推导出问题的最优解。如果我们把最优子结构，对应到我们前面定义的动态规划问题模型上，那我们也可以理解为，后面阶段的状态可以通过前面阶段的状态推导出来。

#### 无后效性
无后效性有两层含义，第一层含义是，在推导后面阶段的状态的时候，我们只关心前面阶段的状态值，不关心这个状态是怎么一步一步推导出来的。第二层含义是，某阶段状态一旦确定，就不受之后阶段的决策影响。无后效性是一个非常“宽松”的要求。只要满足前面提到的动态规划问题模型，其实基本上都会满足无后效性。

#### 重复子问题
这个概念比较好理解。前面一节，我已经多次提过。如果用一句话概括一下，那就是，不同的决策序列，到达某个相同的阶段时，可能会产生重复的状态。

### 1.2 解题思路
解决动态规划问题，一般有两种思路。我把它们分别叫作，状态转移表法和状态转移方程法。

#### 状态转移表法
一般能用动态规划解决的问题，都可以使用回溯算法的暴力搜索解决。所以，这种方法与回溯算法相关，通常我们需要进行如下几步:
1. 使用回溯算法，定义状态，画出递归树；判断是否存在重复子问题，看是否能用动态规划解决
2. 画出状态转移表，根据递推关系，分阶段填充状态表中的每个状态
3. 最后，将递推填表的过程，翻译成代码，就是动态规划代码了

状态表一般都是二维的，所以可以把它想象成二维数组。其中，每个状态包含三个变量，行、列、数组值。尽管大部分状态表都是二维的，但是如果问题的状态比较复杂，需要很多变量来表示，那对应的状态表可能就是高维的，比如三维、四维。那这个时候，我们就不适合用状态转移表法来解决了。一方面是因为高维状态转移表不好画图表示，另一方面是因为人脑确实很不擅长思考高维的东西。

#### 状态转移方程法
状态转移方程法有点类似递归的解题思路。状态转移方程法的大致思路可以概括为，`找最优子结构 - 写状态转移方程 - 将状态转移方程翻译成代码`。我们需要分析，某个问题如何通过子问题来递归求解，也就是所谓的最优子结构。根据最优子结构，写出递归公式，也就是所谓的状态转移方程。有了状态转移方程，代码实现就非常简单了。一般情况下，我们有两种代码实现方法，一种是递归加“备忘录”，另一种是迭代递推。

状态转移方程是解决动态规划的关键。如果我们能写出状态转移方程，那动态规划问题基本上就解决一大半了，而翻译成代码非常简单。但是很多动态规划问题的状态本身就不好定义，状态转移方程也就更不好想到。


### 1.3 四种算法思想比较
如果我们将这四种算法思想分一下类，那贪心、回溯、动态规划可以归为一类，而分治单独可以作为一类。前三个算法解决问题的模型，都可以抽象成我们今天讲的那个多阶段决策最优解模型，而分治算法解决的问题尽管大部分也是最优解问题，但是，大部分都不能抽象成多阶段决策模型。

回溯算法是个“万金油”。基本上能用的动态规划、贪心解决的问题，我们都可以用回溯算法解决。回溯算法相当于穷举搜索。穷举所有的情况，然后对比得到最优解。不过，回溯算法的时间复杂度非常高，是指数级别的，只能用来解决小规模数据的问题。对于大规模数据的问题，用回溯算法解决的执行效率就很低了。

尽管动态规划比回溯算法高效，但是，并不是所有问题，都可以用动态规划来解决。能用动态规划解决的问题，需要满足三个特征，最优子结构、无后效性和重复子问题。在重复子问题这一点上，动态规划和分治算法的区分非常明显。分治算法要求分割成的子问题，不能有重复子问题，而动态规划正好相反，动态规划之所以高效，就是因为回溯算法实现中存在大量的重复子问题。

贪心算法实际上是动态规划算法的一种特殊情况。它解决问题起来更加高效，代码实现也更加简洁。不过，它可以解决的问题也更加有限。它能解决的问题需要满足三个条件，`最优子结构、无后效性和贪心选择性`（这里我们不怎么强调重复子问题）。其中，最优子结构、无后效性跟动态规划中的无异。“贪心选择性”的意思是，通过局部最优的选择，能产生全局的最优选择。每一个阶段，我们都选择当前看起来最优的决策，所有阶段的决策完成之后，最终由这些局部最优解构成全局最优解。

## 2. 应用
有了上面的论述，接下来我们看看如何利用我们所说的动态规划的理论和方法来解决实际问题。

### 2.1 最小路经
假设我们有一个 n 乘以 n 的矩阵 `w[n][n]`。矩阵存储的都是正整数。棋子起始位置在左上角，终止位置在右下角。我们将棋子从左上角移动到右下角。每次只能向右或者向下移动一位。从左上角到右下角，会有很多不同的路径可以走。我们把每条路径经过的数字加起来看作路径的长度。那从左上角移动到右下角的最短路径长度是多少呢？

套用上面所讲的一个模型三个特征理论，我们来看看这个是否可以用动态规划来解:
1. 一个模型: 从左上角到右下角可以分成多个步骤移动，显然这是一个多阶段决策问题
2. 三个特征:
  - 首先位置`(i, j)` 只能由 `(i, j-1)`,`(i-1, j)` 移动得来，位置`(i, j)`的最短距离可以从这两个位置的最短距离得来，符合最优子结构，
  - 其次位置`(i, j)`之后得如何选择与位置`(i, j)`之前无任何关系符合无后效性特征
  - 最后，一个位置可以由两个位置移动得来，回溯求解中肯定会产生重复子问题
因此这个问题能用动态规划解决。

![0-1](/images/algo/dp/min_short.jpg)

```Python
def min_path_in_matrix(matrix):
    row = len(matrix)
    column = len(matrix[0])
    status = [[0] * column for i in range(row)]
    s = 0
    for c in range(column):
        s += matrix[0][c]
        status[0][c] = s
    s = 0
    for r in range(column):
        s += matrix[r][0]
        status[r][0] = s

    for i in range(1, row):
        for j in range(1, column):
            status[i][j] = min(status[i][j - 1], status[i - 1][j]) + matrix[i][j]
    print status
    return status[-1][-1]


ss = [
    [1,2,3],
    [4,5,6],
    [7,8,9]
]

min_path_in_matrix(ss)
```

### 2.2 硬币找零
我们今天来看一个新的硬币找零问题。假设我们有几种不同币值的硬币 v1，v2，……，vn（单位是元）。如果我们要支付 w 元，求最少需要多少个硬币。比如，我们有 3 种不同的硬币，1 元、3 元、5 元，我们要支付 9 元，最少需要 3 个硬币（3 个 3 元的硬币）。

```Python
pass
```

**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
