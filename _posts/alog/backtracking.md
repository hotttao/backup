---
title: 30 回溯算法
date: 2018-11-07
categories:
    - Python
tags:
    - 数据结构与算法
---

编程思想之回溯算法

<!-- more -->

## 1. 回溯算法
回溯算法很多时候都应用在“搜索”这类问题上。即在一组可能的解中，搜索满足期望的解。

回溯的处理思想，有点类似枚举搜索。我们枚举所有的解，找到满足期望的解。为了有规律地枚举所有可能的解，避免遗漏和重复，我们把**问题求解的过程分为多个阶段**。每个阶段，我们都会面对一个岔路口，我们先**随意选一条路**走，当发现这条路走不通的时候（**不符合期望的解**），就**回退**到上一个岔路口，另选一种走法继续走。

很多经典的数学问题都可以用回溯算法解决，比如数独、八皇后、0-1 背包、图的着色、旅行商问题、全排列等等。我们将以其中的几个问题为例来讲解如何使用回溯算法解决问题。


### 1.1 解决步骤
回溯算法非常适合用递归来实现，在实现的过程中，剪枝操作是提高回溯效率的一种技巧。利用剪枝，我们并不需要穷举搜索所有的情况，从而提高搜索效率。

与递归算法一样，回溯算法容易理解，但是写起来丝毫不容易。个人觉得，相比于找到递归终止条件和递推公式，更难的是确定递归函数的变量和函数的返回值。关于函数变量的选择有一个可参考的经验，就是始终关注的是在计算中会使用到的随着计算不断变动的量；对于函数返回值，回溯算法是枚举所有的解，期望的解通常不是通过函数直接返回，而通常位于递归终止条件中。

## 2. 应用
### 2.1 八皇后问题
所谓八皇后问题是这样的，我们往一个 8x8 的棋盘中放 8 个棋子（皇后），每个棋子所在的行、列、对角线都不能有另一个棋子，找出所有满足要求的摆放方式。下面是一个满足条件和不满足条件的示例。

![queens8](/images/algo/backtracking/queens8.jpg)

我们把这个问题划分成 8 个阶段，依次将 8 个棋子放到第一行、第二行、第三行……第八行。在放置的过程中，我们不停地检查当前的方法，是否满足要求。如果满足，则跳到下一行继续放置棋子；如果不满足，那就再换一种方法，继续尝试。

```Python
def queens_eight(num=8):
    def cal_queens(row):
        if row == num:
            output_chessboard(chessboard, num)
            return
        for column in range(num):
            if is_ok(chessboard, row, column, num):
                # print chessboard, row, column
                chessboard[row] = column
                cal_queens(row + 1)

    # 下标表示行，值表示列
    chessboard = [0] * num
    cal_queens(0)
    return chessboard


def is_ok(chessboard, row, column, num):
    """
    :param chessboard:
    :param row:
    :param column:
    :return: 检查最新的(row, column)摆放是否符合规则
    """
    left_up, right_up = column - 1, column + 1
    last = row - 1
    # 从最后一行往上检查
    while last >= 0:
        # 检查同列
        if chessboard[last] == column:
            return False
        # 检查左上角对角线
        if 0 <= left_up == chessboard[last]:
            return False
        # 检查右上角对角线
        if num > right_up == chessboard[last]:
            return False
        last -= 1
        left_up -= 1
        right_up += 1
    return True


def output_chessboard(result, num):
    print result
    for i in range(num):
        column = result[i]
        c = ['*'] * num
        c[column] = '1'
        print ' '.join(c)


queens_eight()

```

### 2.2 0-1 背包问题
0-1 背包是非常经典的算法问题，这个问题的经典解法是动态规划，不过还有一种简单但没有那么高效的解法，那就是回溯算法。因此这个示例将是我们理解回溯算法和动态规划区别的很重要一个例子。

0-1 背包问题有很多变体，我这里介绍一种比较基础的。背包总的承载重量是 Wkg，有 n 个物品，每个物品的重量不等，并且不可分割。期望在不超过背包所能装载重量的前提下，让背包中物品的总重量最大。

对于每个物品来说，都有两种选择，装或者不装。n 个物品共有 2^n 种装法，去掉超过 Wkg，从剩下的选择种选择总重量最接近 Wkg 的。不过，我们如何才能不重复地穷举出这 2^n 种装法呢？

我们可以把物品依次排列，整个问题就分解为了 **n 个阶段**，每个阶段对应一个物品怎么选择。先对第一个物品进行处理，选择装进去或者不装进去，然后再递归地处理剩下的物品。下面是代码实现:

```Python
class RucksackHold(object):
    def __init__(self, weight, items):
        self.weight = weight
        self.items = items
        self.hold = 0

    def _get_max_hold(self, i, cw):
        """
        :param i: 考察的第 i 个物品
        :param cw: 当前背包的总重量
        :return:
        """
        if i == len(self.items) or cw == self.weight:
            if cw > self.hold:
                self.hold = cw
            return
        self._get_max_hold(i + 1, cw)
        if self.items[i] + cw <= self.weight:
            self._get_max_hold(i + 1, cw + self.items[i])

    def __call__(self, *args, **kwargs):
        self._get_max_hold(0, 0)
        return self.hold

pk = RucksackHold(items=[1, 2, 4], weight=10)
print pk()
```

#### 回溯中的重复计算
在回溯算法中，有些子问题的求解可能是重复的。假设背包的最大承载重量是 9，有 5 个不同的物品，重量分别是 2，2，4，6，3。如果我们把这个例子的回溯求解过程，用递归树画出来，就是下面这个样子：
![0-1](/images/algo/backtracking/0_1.jpg)

递归树中的`f(i, cw）`表示一次函数调用。从递归树中可以发现，有些子问题的求解是重复的，比如图中的 `f(2, 2)` 和 `f(3,4)` 都被重复计算了两次。借助于对子问题结果的缓存，我们可以有效避免冗余计算提高计算效率。


### 2.3 正则表达式
正则表达式中，最重要的就是通配符，简单期间，假设正表达式中只包含“\*”和“\?”这两种通配符，并且“\*”匹配任意多个（大于等于 0 个）任意字符，“\?”匹配零个或者一个任意字符。基于如上假设，如何用回溯算法，判断一个给定的文本，能否跟给定的正则表达式匹配？

正则表达式中的特殊字符就是所谓的岔路口，比如“\*”可以匹配任意个文本串中的字符，我们就先随意的选择一种匹配方案，然后继续考察剩下的字符。如果中途发现无法继续匹配下去了，我们就回到这个岔路口，重新选择一种匹配方案，然后再继续匹配剩下的字符。

```Python
class Pattern():
    def __init__(self, pattern):
        self.pattern = pattern
        self.is_match = False

    def _match(self, S, i, j):
        pass

    def match(self, S):
        return self._match(S, 0, 0)

```

### 2.4 图的着色
```python
```

### 2.5 旅行商问题
```python
```

### 2.6 全排列
```python
```

### 2.7 数独
```python
```

**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
