---
title: 1. 编程思想
date: 2020-07-01
categories:
    - Python
tags:
    - 好玩的数据结构与算法
---

编程思想

<!-- more -->

## 1. 原理
基础的数据结构与算法中，有几块非常难懂，贪心，分治，回溯和动态规划这四个编程思想应该算是"名列前茅"了。本文希望通过详细解答几个经典示例来帮助大家搞懂他们。在进入实战之前，我们先来看看他们的区别。

### 1.1 动态规划
动态规划适合解决的问题可以概括为“一个模型三个特征”。
1. 一个模型: **多阶段决策最优解模型**。动态规划通常被用来解决最优问题，而解决问题的过程，需要经历多个决策阶段。每个决策阶段都对应着一组状态。然后我们寻找一组决策序列，经过这组决策序列，能够产生最终期望求解的最优值。
2. 三个特征:
    - 最优子结构: 我们可以通过子问题的最优解，推导出问题的最优解
    - 无后效性: 某阶段状态一旦确定，就不受之后阶段的决策影响
    - 重复子问题: 不同的决策序列，到达某个相同的阶段时，可能会产生重复的状态

了解了动态，接下我们就以动态为标杆，看看其他编程思想有什么不同

### 1.2 分治
贪心、回溯、动态规划可以归为一类，都可以抽象成我们今天讲的那个多阶段决策最优解模型，而分治算法解决的问题尽管大部分也是最优解问题，但是，大部分都不能抽象成多阶段决策模型。

在重复子问题这一点上，动态规划和分治算法的区分非常明显。分治算法要求分割成的子问题，不能有重复子问题，而动态规划正好相反，动态规划之所以高效，就是因为回溯算法实现中存在大量的重复子问题。

### 1.3 贪心
它能解决的问题需要满足三个条件，最优子结构、无后效性和贪心选择性。**贪心选择性**的意思是，通过局部最优的选择，能产生全局的最优选择。每一个阶段，我们都选择当前看起来最优的决策，所有阶段的决策完成之后，最终由这些局部最优解构成全局最优解。贪心算法实际上是动态规划算法的一种特殊情况。

### 1.4 回溯
回溯算法是个“万金油”。基本上能用的动态规划、贪心解决的问题，我们都可以用回溯算法解决。回溯算法相当于穷举搜索。不过，回溯算法的时间复杂度非常高，是指数级别的，只能用来解决小规模数据的问题。

它们之间的区别讲完了，接下来我们就来看看如何用它们来解决我们的编程问题。

## 2. 实战
### 2.1 最少加油次数
[leecode 871](https://leetcode-cn.com/problems/minimum-number-of-refueling-stops/)

#### 回溯
```python
class Solution(object):
    def minRefuelStops(self, target, startFuel, stations):
        """
        :type target: int
        :type startFuel: int
        :type stations: List[List[int]]
        :rtype: int
        """
        self.min_station = len(stations) + 1
        if startFuel >= target:
            return 0
        self.refuel_stop(target, stations, 0, startFuel, 0)
        self.min_station = self.min_station \
            if self.min_station <= len(stations) else -1
        return self.min_station


    def refuel_stop(self, target, station, i, fuel, c):
        """
        :param target: 距离目标地点还有多远
        :param station:
        :param i: 表示到达第 i 个加油站，i 从 0 开始计数
        :param fuel: 能走多远
        :param c: 加油次数
        :return:
        """
        # 已经到最有一个加油站了
        if i == len(station):
            if fuel >= target:
                self.min_station = min(c, self.min_station)
            return

        # 剩下的油走不到下一站了，也无法到达 target
        if fuel < min(station[i][0], target):
            return

        # 已经足够达到终点
        if fuel >= target:
            self.min_station = min(c, self.min_station)
            return
        # 没到达终点，油够到下一站
        # 不加油
        self.refuel_stop(target, station, i + 1, fuel, c)
        # 加油
        if fuel >= station[i][0]:
            self.refuel_stop(target, station, i + 1, fuel + station[i][1], c + 1)
```

#### 动态规划
如果我们仔细思考上面的回溯代码，我们会发现递归调用过程中如下几个变化的量:
1. self.min_station: 加油次数，这是我们要求的结果变量
2. i: 第 i 个加油站
3. fuel: 能够达到的最远距离

看起来我们可以创建一个二维状态转移表，y 轴方向表示第 i 个加油站，x 轴方向表示加了几次油，二维表中的值表示能达到的最远距离。这里动态规划的解法需要我们稍微专变一下思路，求到达指定距离的最少加油次数，跟求指定加油次数能达到的最远距离是同一问题。

整个决策过程设计多个阶段，我们要决定在每个加油站是否加油，并求出能达到的最远距离。第二次加油能走的最远距离显然由上次能走的最远距离决定。符合多阶段最优解模型。

最后根据回溯算法的代码实现，我们可以画出递归树，看是否存在重复子问题。假设输入参数分别是:
1. target = 100, 
2. startFuel = 20, 
3. stations = [[10,60],[20,30],[30,30],[60,40]]

```bash
              f(0, 20)
     f(1, 20)          f(1, 80)
f(2, 0)   f(2, 50) f(2, 80)  f(2, 110)
```
递归树中的每个节点表示一种状态，我们用（i, fuel）来表示。其中，i 表示是否在第 i 个加油站加油，fuel 表示能达到的最远距离。看起来没有重复子问题，但是我们要计算的是加油一次能够达到的最远距离，所以上面的 f(1, 80) 和 f(2, 50) 表示我在第 1 个加油站加油最远可以走 80 ，在第 2 个加油站加油最远可以走 50 公里。显示我们会在第 1 个加油站。当然不容易想到。

接下来我们就可以画出状态转移表，并写出代码。在写代码的过程中，你就会发现二维表在这里并没有用，如果我们计算出了第 i 次油能走的最远距离dp[i]，那么 dp[i+1] 加油能达到的最远距离，就取决于 dp[i] 能达到的加油站以及每个加油站能加的油即: `if dp[t] >= station[i+1][0]; dp[t+1]=dp[t]+station[i+1][1]`。下面就是代码实现:

```python
class Solution(object):
    def minRefuelStops(self, target, startFuel, stations):
        dp = [startFuel] + [0] * len(stations)
        for i, (location, capacity) in enumerate(stations):
            for t in xrange(i, -1, -1): 
                if dp[t] >= location:
                    dp[t+1] = max(dp[t+1], dp[t] + capacity)

        for i, d in enumerate(dp):
            if d >= target: return i
        return -1
```

注意 `xrange(i, -1, -1)` 不能改成 `xrange(0, x + 1)`。

### 2.2 最长递增子序列长度
[leecode 300](https://leetcode-cn.com/problems/longest-increasing-subsequence/)

#### 回溯
下面是最长递增子序列长度回溯的非完整实现。
```python
class Solution(object):
    def lengthOfLIS(self, nums):
        """
        :type nums: List[int]
        :rtype: int
        """
        self.nums = nums
        self.len = 1
        self.get_lis(0, 1, self.nums[0])

    def get_lis(self, i, l, m):
        """
        :param i: 表示这是第几个数
        :param l: l 当前的最长子序列长度
        :param m: m 子序列中最大的书
        :return:
        """
        self.len = max(l, self.len)
        p = self.nums[i]
        if p >= m:
            self.get_lis(i + 1, l + 1, p)
        else:
            self.get_lis(i + 1, 1, p)
            self.get_lis(i + 1, l, m)
```

#### 动态规划实现

回溯过程显示了以下几个递归变化量:

1. i：第 i 个数
2. l: 最长子序列的长度
3. m：最长子序列中的最大值

同样的，我们可以通过一个二维数组，画出上面三个变量的状态转移表:

- y轴方向：数组中的第 i 个数
- x轴方向: 标识最长子序列的长度
- 二维数组的值记录了对应位置最长子序列中的最大值

当我们找不到解题思路时，一定要画出上面上面的状态转移表，这样能帮我我们找到解题思路，写出状态转移方程。

```python
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