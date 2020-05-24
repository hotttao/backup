---
title: 28 贪心算法
date: 2018-11-04
categories:
    - Python
tags:
    - 数据结构与算法
---

编程思想之贪心算法

<!-- more -->

## 1. 贪心算法
前面我们讲完了字符串匹配相关的算法，接下来的几章与编程思想有关，包括贪心，分治，回溯和动态规划。它们都非常抽象，但是理解透了可以帮我们解决很多问题。这些算法在一定程度上很相近，因此学习过程中，我们首先要搞清楚它们的适用场景，其次是掌握怎么运用它们去解决问题。今天，我们先来学习贪心算法。

### 1.1 适用场景
贪心，回溯，动态规划都适合解决“分阶段决策问题”。而贪心算法不适合前面的选择，会影响后面的选择这类情景。贪心算法的求解过程中，只会保留每个阶段的最优解，不会保留其他非最优状态。对于后面的选择依赖前面选择的分阶段决策问题，如果考虑前面的选择，计算将无法回溯，不可行；如果只考虑每个阶段的最优，最后很可能无法得出最优解。

### 1.2 解决步骤
利用贪心算法，我们可以按照如下步骤去解决问题:
1. 第一步，当我们看到这类问题的时候，首先要联想到贪心算法，贪心算法格外适用于针对一组数据，我们定义了限制值和期望值，希望从中选出几个数据，在满足限制值的情况下，期望值最大。
2. 第二步，我们尝试看下这个问题是否可以用贪心算法解决：每次选择当前情况下，在对限制值同等贡献量的情况下，对期望值贡献最大的数据。
3. 第三步，我们举几个例子看下贪心算法产生的结果是否是最优的。大部分情况下，举几个例子验证一下就可以了。严格地证明贪心算法的正确性，是非常复杂的，需要涉及比较多的数学推理。而且，从实践的角度来说，大部分能用贪心算法解决的问题，贪心算法的正确性都是显而易见的，也不需要严格的数学推导证明。

## 2. 应用
贪心算法有很多经典应用包括钱币找零，区间覆盖，霍夫曼编码等等。我们就以其中几个例子来实战贪心算法的应用。

### 2.1 钱币找零
假设我们有 1 元、2 元、5 元、10 元、20 元、50 元、100 元面额的纸币， 张数分别是: c1、c2、c5、c10、c20、c50、c100。我们现在要用这些钱来支付 K 元，最少要用多少张纸币呢？

思路: 在贡献相同期望值（纸币数目）的情况下，我们希望多贡献点金额，这样就可以让纸币数更少，这就是一种贪心算法的解决思路。

```Python
def cion(k):
    coin = [100, 50, 20, 10, 5, 2, 1]
    coin_map = [(i, 20) for i in coin]
    i = 0
    coin_count = 0
    while i < len(coin) and k > 0:
        use = coin_map[i]
        c = min(use[1], k // use[0])
        k -= use[0] * c
        coin_count += c
        i += 1
    return coin_count

```

### 2.2 区间覆盖
假设我们有 n 个区间，区间的起始端点和结束端点分别是 [l1, r1]，[l2, r2]，[l3, r3]，……，[ln, rn]。我们从这 n 个区间中选出一部分区间，这部分区间满足两两不相交（端点相交的情况不算相交），最多能选出多少个区间呢？[lintcode-1242. 无重叠区间](https://www.lintcode.com/problem/non-overlapping-intervals/description)就是这个问题的变形。

思路：我们假设这 n 个区间中最左端点是 lmin，最右端点是 rmax。这个问题就相当于，我们选择几个不相交的区间，从左到右将 [lmin, rmax] 覆盖上。我们按照起始端点从小到大的顺序对这 n 个区间排序。我们每次选择的时候，左端点跟前面的已经覆盖的区间不重合的，右端点又尽量小的，这样可以让剩下的未覆盖区间尽可能的大，就可以放置更多的区间。这实际上就是一种贪心的选择方法。

![snake](/images/algo/greedy/span_choose.jpg)

```Python
class Solution(object):
    def eraseOverlapIntervals(self, intervals):
        """
        :type intervals: List[List[int]]
        :rtype: int
        """
        if not intervals:
            return 0
        intervals.sort(key=lambda x: x[0])
        collect = [intervals[0]]
        rm = 0
        for i in intervals[1:]:
            low, up = collect[-1]
            if i[0] >= up:
                collect.append(i)
            elif i[1] <= up:
                collect[-1] = i
                rm += 1
            else:
                rm += 1
        return rm
```

### 2.3 霍夫曼编码
霍夫曼编码不仅会考察文本中有多少个不同字符，还会考察每个字符出现的频率，根据频率的不同，选择不同长度的编码。霍夫曼编码试图用这种不等长的编码方法，来进一步增加压缩的效率。如何给不同频率的字符选择不同长度的编码呢？根据贪心的思想，我们可以把出现频率比较多的字符，用稍微短一些的编码；出现频率比较少的字符，用稍微长一些的编码。为了避免解压缩过程中的歧义，霍夫曼编码要求各个字符的编码之间，不会出现某个编码是另一个编码前缀的情况。

```Python

```

## 3. 练习
leetcode 上有很多贪心算法的练习题，下面是一些练习题以及它们的解答

### 3.1 练习一
在一个非负整数 a 中，我们希望从中移除 k 个数字，让剩下的数字值最小，如何选择移除哪 k 个数字呢？

```Python
class Solution:
    def removeKdigits(self, num, k):
        numStack = []
        
        # Construct a monotone increasing sequence of digits
        for digit in num:
            while k and numStack and numStack[-1] > digit:
                numStack.pop()
                k -= 1
        
            numStack.append(digit)
        
        # - Trunk the remaining K digits at the end
        # - in the case k==0: return the entire list
        finalStack = numStack[:-k] if k else numStack
        
        # trip the leading zeros
        return "".join(finalStack).lstrip('0') or "0"
```


**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
