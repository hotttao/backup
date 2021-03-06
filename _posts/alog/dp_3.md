---
title: 33 动态规划实战
date: 2018-11-12
categories:
    - Python
tags:
    - 数据结构与算法
---

编程思想之动态规划实战

<!-- more -->

## 1. 动态规划总结
上一篇，我们总结了动态规划的使用场景，以及如何利用动态规划去解决问题了，总结了:
1. 一个模型三个特征: 多阶段决策最优解模型，最优子结构，无后效性，重复子问题
2. 状态转移表法
3. 状态转移方程法

并总结对比了四中编程思想之间的区别。这些东西都非常理论，需要慢慢消化。本文是动态规划的实战篇，也是编程思想系列的最后一篇。

## 2.应用
本节我们核心要解决的问题是如何量化两个字符串之间的相似程度呢？有一个非常著名的量化方法，那就是编辑距离（Edit Distance）。

编辑距离指的就是，将一个字符串转化成另一个字符串，需要的最少编辑操作次数（比如增加一个字符、删除一个字符、替换一个字符）。编辑距离越大，说明两个字符串的相似程度越小。

根据所包含的编辑操作种类的不同，编辑距离有多种不同的计算方式，比较著名的有莱文斯坦距离（Levenshtein distance）和最长公共子串长度（Longest common substring length）。其中，莱文斯坦距离允许增加、删除、替换字符这三个编辑操作，最长公共子串长度只允许增加、删除字符这两个编辑操作。莱文斯坦距离的大小，表示两个字符串差异的大小；而最长公共子串的大小，表示两个字符串相似程度的大小。

下面是两个方法的操作示例，我们的问题是如何计算两个字符串的莱文斯坦距离和最长公共子串长度。

![0-1](/images/algo/dp/string_matches.jpg)

### 2.1 计算莱文斯坦距离
首先我们来看回溯的处理过程。如果 a[i] 与 b[j] 匹配，我们递归考察 a[i+1] 和 b[j+1]。如果 a[i] 与 b[j] 不匹配，那我们有多种处理方式可选：
- 可以删除 a[i]，然后递归考察 a[i+1] 和 b[j]；
- 可以删除 b[j]，然后递归考察 a[i] 和 b[j+1]；
- 可以在 a[i] 前面添加一个跟 b[j] 相同的字符，然后递归考察 a[i] 和 b[j+1];
- 可以在 b[j] 前面添加一个跟 a[i] 相同的字符，然后递归考察 a[i+1] 和 b[j]；
- 可以将 a[i] 替换成 b[j]，或者将 b[j] 替换成 a[i]，然后递归考察 a[i+1] 和 b[j+1]。

反过来看状态 (i, j) 可能从 (i-1, j)，(i, j-1)，(i-1, j-1) 三个状态中的任意一个转移过来。我们可以尝试着将把状态转移的过程，用公式写出来。这就是我们前面讲的状态转移方程

![0-1](/images/algo/dp/Levenshtein.jpg)

```
如果：a[i]!=b[j]，那么：min_edist(i, j) 就等于：
min(min_edist(i-1,j)+1, min_edist(i,j-1)+1, min_edist(i-1,j-1)+1)

如果：a[i]==b[j]，那么：min_edist(i, j) 就等于：
min(min_edist(i-1,j)+1, min_edist(i,j-1)+1，min_edist(i-1,j-1))

其中，min 表示求三数中的最小值。     
```

### 2.2 计算最长公共子串长度
首先我们先来看回溯的处理思路。我们从 a[0] 和 b[0] 开始，依次考察两个字符串中的字符是否匹配。
- 如果 a[i] 与 b[j] 互相匹配，我们将最大公共子串长度加一，并且继续考察 a[i+1] 和 b[j+1]。
- 如果 a[i] 与 b[j] 不匹配，最长公共子串长度不变，这个时候，有两个不同的决策路线：
- 删除 a[i]，或者在 b[j] 前面加上一个字符 a[i]，然后继续考察 a[i+1] 和 b[j]；
- 删除 b[j]，或者在 a[i] 前面加上一个字符 b[j]，然后继续考察 a[i] 和 b[j+1]。

反过来也就是说，如果我们要求 a[0...i] 和 b[0...j] 的最长公共长度 max_lcs(i, j)，我们只有可能通过下面三个状态转移过来：
- (i-1, j-1, max_lcs)，其中 max_lcs 表示 a[0...i-1] 和 b[0...j-1] 的最长公共子串长度；
- (i-1, j, max_lcs)，其中 max_lcs 表示 a[0...i-1] 和 b[0...j] 的最长公共子串长度；
- (i, j-1, max_lcs)，其中 max_lcs 表示 a[0...i] 和 b[0...j-1] 的最长公共子串长度。

如果我们把这个转移过程，用状态转移方程写出来，就是下面这个样子：

```
如果：a[i]==b[j]，那么：max_lcs(i, j) 就等于：
max(max_lcs(i-1,j-1)+1, max_lcs(i-1, j), max_lcs(i, j-1))；

如果：a[i]!=b[j]，那么：max_lcs(i, j) 就等于：
max(max_lcs(i-1,j-1), max_lcs(i-1, j), max_lcs(i, j-1))；

其中 max 表示求三数中的最大值。
```

## 3. 练习
### 3.1 最长递增子序列
我们有一个数字序列包含 n 个不同的数字，如何求出这个序列中的最长递增子序列长度？比如 2, 9, 3, 6, 5, 1, 7 这样一组数字序列，它的最长递增子序列就是 2, 3, 5, 7，所以最长递增子序列的长度是 4。

```Python
class Solution(object):
    def lengthOfLIS(self, nums):
        """
        :type nums: List[int]
        :rtype: int
        """
        if not nums:
            return 0
        n = len(nums)
        status = [None] * (n)
        status[0] = nums[0]
        end = 0
        for i in range(1, n):
            end = max(end, self.binary_search(nums[i], status, end))
        return end + 1

    def binary_search(self, v, status, end, start=0):
        m = start
        if status[end] < v:
            end += 1
            status[end] = v
            return end
        while start <= end:
            mid = start + ((end - start) > 1)
            if status[mid] == v:
                return end
            elif status[mid] < v:
                start = mid + 1
            else:
                if mid == m or status[mid-1] < v:
                    status[mid] = v
                    return end
                else:
                    end = mid - 1
```
