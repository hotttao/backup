---
title: 24 字符串匹配之 KMP 算法
date: 2018-10-31
categories:
    - Python
tags:
    - 数据结构与算法
---

优雅的的 KMP 算法

<!-- more -->
## 1. KMP 算法
BM（Boyer-Moore）和 KMP(Knuth-Morris-Pratt) 都是非常高效的字符串匹配算法。BM 比 KMP 更高效，有实验统计 BM 的性能 是 KMP 3-4 倍。但是他们都非常复杂难懂。除了专栏，我也非常推荐你看一看阮一峰老师有关 [BM](http://www.ruanyifeng.com/blog/2013/05/boyer-moore_string_search_algorithm.html) 和 [KMP](http://www.ruanyifeng.com/blog/2013/05/Knuth%E2%80%93Morris%E2%80%93Pratt_algorithm.html) 算法的介绍。因为 BM 算法利用到了KMP的算法思想，本节我们就先来介绍 KMP 的实现。

### 1.1 优化思路
KMP 算法基于这样一个实现思路: 如下图所示，对于字符串匹配过程中已经匹配的部分，我们是已知的；利用这个已知的信息，我们可以把模式串往后移动更多位，而不是 BR 算法中的一位。而最终移动的位数取决于已匹配部分的`"前缀"和"后缀"的最长的共有元素的长度`，我们将这个最长的公共子串称为`最长可匹配(前缀/后缀)子串`

![kmp_match](/images/algo/string/kmp_match.png)

在上面的图例中，已匹配部分是 `ABCDAB`，前后缀最长匹配的元素是 `AB`，因此前缀 `AB`就可以直接来到后缀`AB`的位置，直接向后移动 4 位继续匹配，如下图所示。

![kmp_match](/images/algo/string/kmp_match2.png)

字符串已匹配部分永远是模式串的前缀子串，因此`最长可匹配(前缀/后缀)子串`我们可以提前计算出来，这个就是 KMP 中的 `部分匹配表`。因此，整个 KMP 的计算过程就分成了两步:
1. 计算部分匹配表
2. 根据部分匹配表计算每次不匹配时，模式串的移动位数，进行字符串匹配

### 1.2 部分匹配表
部分匹配表，被称为失效函数，又称为 next 数组。在计算 next 数组之前，首先我们需要明确两个概念: "前缀"和"后缀":
1. "前缀"指除了最后一个字符以外，一个字符串的全部头部组合
2. "后缀"指除了第一个字符以外，一个字符串的全部尾部组合

```
以"ABCDAB"为例
0.　"A"的前缀和后缀都为空集，共有元素的长度为0；
1.　"AB"的前缀为[A]，后缀为[B]，共有元素的长度为0；
2.　"ABC"的前缀为[A, AB]，后缀为[BC, C]，共有元素的长度0；
3.　"ABCD"的前缀为[A, AB, ABC]，后缀为[BCD, CD, D]，共有元素的长度为0；
4.　"ABCDA"的前缀为[A, AB, ABC, ABCD]，后缀为[BCDA, CDA, DA, A]，共有元素为"A"，长度为1；
5.　"ABCDAB"的前缀为[A, AB, ABC, ABCD, ABCDA]，后缀为[BCDAB, CDAB, DAB, AB, B]，共有元素为"AB"，长度为2；
6.　"ABCDABD"的前缀为[A, AB, ABC, ABCD, ABCDA, ABCDAB]，后缀为[BCDABD, CDABD, DABD, ABD, BD, D]，共有元素的长度为0。
```

即"ABCDAB" 的 next 数组为 `[0, 0, 0, 0, 1, 2, 0]`。其中
1. next 数组的下标对应每个前缀子串结尾字符的下标
2. next 数组的值则是最长可匹配子串的长度

### 1.3 KMP 复杂度分析
KMP 的空间复杂度是 O(m)，时间复杂度为 O(m+n)。分析过程在我们讲解完 KMP 的实现之后再来讲解。


## 2. KMP 算法实现
### 2.1 计算部分匹配表
部分匹配表的计算非常巧妙，下面是代码：

```python
def kmp_next(P):
    m = len(P)
    fail = [0] * m
    j = 1  # 按照下标从小到大的子串
    k = 0  # 上一个子串最长可匹配子串的长度
    while j < m:
        if P[j] == P[k]:     
            fail[j] = k + 1
            j += 1
            k += 1
        elif k > 0:
            k = fail[k - 1]
        else:
            j += 1
    return fail
```
我们以"ABCDAB"为例来讲解计算过程，大家需要牢记的是`P[j]` 表示当前子串的最后一个字符，`P[k]` 表示上一个子串的最长可匹配子串的下一个字符，此时分为三种情况:
1. `P[j] == P[k]`: 对应`ABCDAB`，前一个子串是`ABCDA`，最长可匹配子串是 `A`，此时`P[5]==P[1]==B，即AB=AB`,所以 `ABCDAB`的最长可匹配子串长度就是 2
2. `P[j] != P[k] and k > 0`: 对应`ABCDABD`，`P[6]!=P[2]，即D!=C`，此时可以确定的是`ABCDABD`的最长可匹配子串，只能从`ABD`进行匹配，进而问题转换为已知`AB`的最长可匹配子串，求`ABD`的最长可匹配子串问题。
3. `P[j] != P[k] and k == 0`: 显然此时就没有任何可匹配到的子串。

这个计算过程很巧妙，不多看几次很难明白。

在next 的计算过程中，使用了一个额外的数组，因此这一部份的空间复杂度是 O(m)。在 while 循环中 j 执行的次数一定不会超过 m，而 k 变量无论是增加累计的量，还是减少累计的量都不会超过 m，因此这一部分的时间复杂度为 O(m)。

### 2.2 KMP 字符串匹配过程
字符串匹配的过程中，最重要的一步是确定不匹配时，后移的位数，代码如下:

```python
def kmp_match(T, P):
    fail = kmp_next(P)
    n, m = len(T), len(P)
    k = 0
    j = 0
    while j < n:
        if T[j] == P[k]:
            if k == m - 1:
                return j - (m - 1)
            k += 1
            j += 1
        elif k > 0:
            k = fail[k - 1]  # 后移表示为 k 索引的变化
        else:
            j += 1
    return -1

```

整个匹配过程中，j 变量的执行次数不会超过 n，而变量 k，无论是增加的累计量还是减少的累计量都不会超过 n，因此这一部分的时间复杂度不会超过 O(n)。因此总的时间复杂度不会超过O(m+n)。


**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
- [阮一峰-KMP算法](http://www.ruanyifeng.com/blog/2013/05/Knuth%E2%80%93Morris%E2%80%93Pratt_algorithm.html)
- [《数据结构与算法：python语言实现》](https://book.douban.com/subject/30323938/)
