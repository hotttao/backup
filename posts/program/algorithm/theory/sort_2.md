---
title: 08 基于比较的排序(下)
date: 2018-10-16
categories:
    - Python
tags:
    - 数据结构与算法
---
![linkedlist](/images/algo/sort/merge_quick.jpg)
基于分治编程思想的归并排序和快速排序

<!-- more -->

## 1. 分治
前面讲到的三种排序算法，平均时间复杂度都是 O(n2)，只是适合规模较小的数剧集，接下来要讲的归并排序和快速排序，平均时间复杂度都是 O(nlogn)，它们都用到了分治思想。

分治，顾名思义，就是分而治之，将一个大问题分解成小的子问题来解决。小的子问题解决了，大问题也就解决了。分治与我们前面提到的递归很像，分治算法一般都是通过递归实现的。

虽然快排和归并排序都采用了分治的思想，但是它们完全不一样。归并排序的处理过程是由下到上的，先处理子问题，然后再合并。而快排正好相反，快排的处理过程是由上到下的，先分区，然后再处理子问题。归并排序虽然是稳定的但是它是非原地排序算法。快速排序通过设计巧妙的原地分区函数，可以实现原地排序，解决了归并排序占用太多内存的问题。正因为此，归并排序没有快排应用广泛。

## 2. 实现
### 2.1 归并排序
归并排序的核心是将数组从中间分成前后两个部分，然后对前后两个部分分别排序，再将它们合并起来。

![linkedlist](/images/algo/sort/merge_sort.jpg)

```python
def merge(a, b, c):
    i = j = 0
    while i + j < len(c):
        if i == len(a) or (j < len(b) and a[i] > b[j]):
            c[i + j] = b[j]
            j += 1
        else:
            c[i + j] = a[i]
            i += 1


def sort_merge(alist):
    if len(alist) <= 1:
        return alist
    mid = len(alist) // 2
    left = alist[:mid]
    right = alist[mid:]
    sort_merge(left)
    sort_merge(right)
    merge(left, right, alist)

```

归并排序并不是原地排序算法，原因很简单 `merge` 函数在合并两个已排序数组时使用了额外的存储空间，其空间复杂度为 O(n)。最好最坏和平均时间复杂度都是 O(nlogn)，在整个比较过程并没有发生数据交换，只要 `merge` 函数保持元素的相对顺序，归并排序是稳定的排序算法。

### 2.2 快速排序
#### 快排的算法描述
快排排序由以下 3 个步骤组成:
1. 分解: 如果待排序列 S 有至少两个元素，从 S 中选择一个特定的元素 x 作为基准，将 S 中的元素分别放置在 3 个序列中:
  - L 存储 S 中小于 x 的元素
  - E 存储 S 中等于 x 的元素
  - G 存储 S 中大于 x 的元素
2. 递归: 递归的排序序列 L 和 G
3. 合并: 按照 L,E,G 的顺序将元素放回 S 中

```python
def sort_quick(S):
    n = len(S)
    if len(S) <= 1:
        return
    x = S.first()    # 基准 x
    L = LinkedQueue()
    E = LinkedQueue()
    G = LinkedQueue()
    # 分解
    while not S.empty():
        if S.first() < x:
            L.enqueue(S.dequeue())
        elif S.first() > x:
            G.enqueue(S.dequeue())
        else:
            E.enqueue(S.dequeue())
    # 递归
    sort_quick(L)
    sort_quick(G)

    # 合并
    while not L.is_empty():
        S.enqueue(L.dequeue())
    while not E.is_empty():
        S.enqueue(E.dequeue())
    while not G.is_empty():
        S.enqueue(G.dequeue())
```

#### 快排的原地排序
快排的原地排序的核心是选择数组中的一个数据项作为分区点 `x`，然后遍历数组通过数据交换，使得 `x` 左边的数据都小于 `x`，`x` 右边的数据都大于 `x`。`x` 将数组分成了两个区间，然后对这两个区间递归执行此过程直至区间长度为 1 ，完成排序。

```python
def sort_quick(alist, left, right):
    if left >= right:
        return alist
    l = left + 1
    r = right
    x = alist[left]
    while l <= r:
        while l <= r and alist[l] < x:
            l += 1
        while l <= r and alist[r] > x:
            r -= 1
        if l <= r:
            alist[l], alist[r] = alist[r], alist[l]
    alist[left], alist[r] = alist[r], alist[left]

    sort_quick(alist, left, r - 1)
    sort_quick(alist, r + 1, right)

```

显然这个过程发生了数据交换，但是并没有使用额外的存储空间，所以快排并不是稳定的排序算法，但是原地排序算法。

快排的最好和平均时间复杂度都是O(nlogn)，但是极端情况下，如果数组本身是有序的，并且我们选择最大或者最小(两端)的数据作为分区点，我们需要大约 n 次分区才能完成排序过程。快排的时间复杂度就会退化为 O(n2)。但是退化到 O(n2) 的概率非常小，我们可以通过合理的选择分区点来避免这种情况。


## 3. 算法
### 3.1 求无序数组中的第 K 大元素
利用快排的分区思想，我们可以在O(n) 时间复杂度内求无序数组中的第 K 大元素。

我们选择数组区间 `A[0…n-1]` 的最后一个元素 `A[n-1]` 作为 `pivot`，对数组 `A[0…n-1]` 原地分区，这样数组就分成了三部分，`A[0…p-1]`、`A[p]`、`A[p+1…n-1]`。如果 `p+1=K`，那 `A[p]` 就是要求解的元素；如果 `K>p+1`, 说明第 K 大元素出现在 `A[p+1…n-1]` 区间，我们再按照上面的思路递归地在 `A[p+1…n-1]` 这个区间内查找。同理，如果 `K<p+1`，那我们就在 `A[0…p-1]` 区间查找。

```python
def quick_select(S, left, right, k):
    r = right
    l = left + 1
    pivot = S[left]
    while l <= r:
        while l <= r and S[l] <= pivot:
            l += 1
        while l <= r and S[r] >= pivot:
            r -= 1
        if l <= r:
            S[l], S[r] = S[r], S[l]
    S[left], S[r] = S[r], S[left]

    if r + 1 == k:
        return S[r]
    elif r + 1 > k:
        return quick_select(S, left, r - 1, k)
    else:
        return quick_select(S, r + 1, right, k)

```

**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
- [《数据结构与算法：python语言实现》](https://book.douban.com/subject/30323938/)
