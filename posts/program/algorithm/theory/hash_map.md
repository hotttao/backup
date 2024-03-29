---
title: 14 散列表
date: 2018-10-21
categories:
    - Python
tags:
    - 数据结构与算法
---
散列表原理

<!-- more -->

## 1. 特性
散列表是数组的一种扩展，利用的是数组支持按照下标随机访问的特性，其由三个核心部分组成:
1. key: 元素的键
2. hash func: 散列函数，将键隐射为底层数组的下标
3. table: 底层的数组

![linkedlist](/images/algo/hash/hash_map.jpg)

散列表通过散列函数把元素的键映射为数组的下标来实现在数组中保存和查询元素。在整个散列表的实现中，下面是我们要关注的核心问题：
1. 散列函数设计
2. 散列冲突的解决
3. 装载因子以及散列表的动态扩容

### 1.1 散列函数
散列函数在设计上有三点基本要求:
1. 因为数组下标是从 0 开始的的，所以散列函数计算得到的散列值必需是一个非负整数；
2. 如果 key1 = key2，那 hash(key1) == hash(key2)；
3. 如果 key1 ≠ key2，那 hash(key1) ≠ hash(key2)

第三点看起来合情合理，但是要想找到一个不同的 key 对应的散列值都不一样的散列函数，几乎是不可能的。因此散列过程中会产生散列冲突。而且数组的存储空间有限，也会加大散列冲突的概率。

### 1.2 散列冲突
常用的散列冲突解决方法有两类，开放寻址法（open addressing）和链表法（chaining）。

#### 开放寻址法
开放寻址法的核心思想是，如果出现了散列冲突，就重新探测一个空闲位置，将其插入。重新探测新的位置有很多方法，常见有线性探测，二次探测和双重散列，我们将其统称为探测函数。散列函数和探测函数一起，确定了元素的一系列可存储位置。
1. 插入过程就是按序探测第一个非空位置并存储
2. 查找过程就是按照相同的探测顺序，逐一比较数组中的元素和要查找的元素直至找到相等元素(找到)或一个空位置(不存在)。
3. 因为数组空闲位置是判断是查找的判定条件，所以不能通过直接将数组元素置空来删除散列表中的元素。我们可以将删除的元素，特殊标记为 deleted。当探测查找的时候，遇到标记为 deleted 的空间，并不是停下来，而是继续往下探测。

![linkedlist](/images/algo/hash/open_addressing.jpg)

不管采用哪种探测方法，当散列表中空闲位置不多的时候，散列冲突的概率就会大大提高。为了尽可能保证散列表的操作效率，我们会尽可能保证散列表中有一定比例的空闲槽位。我们用**装载因子**（load factor）来表示空位的多少。

`散列表的装载因子 = 填入表中的元素个数 / 散列表的长度`

装载因子越大，说明空闲位置越少，冲突越小，散列表的性能越好。

#### 链表法
![linkedlist](/images/algo/hash/chaining.jpg)

链表法是一种更加常用的散列冲突解决办法，在散列表中，每个“桶（bucket）”或者“槽（slot）”会对应一条链表，所有散列值相同的元素我们都放到相同槽位对应的链表中。
1. 插入时，通过散列函数计算出对应的散列槽位，将其插入到对应链表中，时间复杂度是 O(1)。
2. 查找、删除时，通过散列函数计算出对应的槽，然后遍历链表查找或者删除。时间复杂度跟链表的长度 k 成正比，也就是 O(k)。对于散列比较均匀的散列函数来说，理论上讲，k=n/m，其中 n 表示散列中数据的个数，m 表示散列表中“槽”的个数。

## 2. 实现
散列表的性能与散列函数，散列冲突和装载因子有关，要想实现一个工业级的散列表就要从这三个因素入手。

### 2.1 散列函数设计
散列函数的设计遵循以下几个要点:
1. 散列函数不能太复杂
2. 散列函数生成的值要尽可能随机并且均匀分布，这样才能避免或者最小化散列冲突
3. 实际工作中，还需要综合考虑包括关键字的长度、特点、分布、还有散列表的大小等在内的各个因素

### 2.2 装载因子控制
对于没有频繁插入和删除的静态数据集合来说，因为数据是已知的，我们可以根据数据的特点、分布等，设计出完美的、极少冲突的散列函数。

对于动态数据集，我们可以动态扩缩容:
1. 装载因子过大时，重新申请一个更大的散列表，动态扩容。
2. 装载因子过小时，可以启动动态缩容。如果我们更加在意执行效率，能够容忍多消耗一点内存空间，也可以不缩容

需要注意的是动态扩缩容时，因为散列表的大小发生了变化，数据存储的位置就变了，所以需要通过散列函数重新计算每个数据的存储位置。在散列表的动态扩容中，装载因子阈值的设置非常重要，太小会导致内存浪费严重，太大会导致冲突过多，要权衡时间、空间复杂度。如果内存空间不紧张，对执行效率要求很高，可以降低负载因子的阈值；相反，如果内存空间紧张，对执行效率要求又不高，可以增加负载因子的值，甚至可以大于 1。


### 2.3 避免低效扩容
动态扩容一个 1G 的散列表依旧很慢，为了解决一次性扩容耗时过多的情况，我们可以将扩容操作穿插在插入操作的过程中，分批完成。

![linkedlist](/images/algo/hash/dynamic_hash.jpg)

当有新数据要插入时，我们将新数据插入新散列表中，并且从老的散列表中拿出一个到多个数据放入到新散列表。将扩容过程分散到每次的插入操作中。

### 2.4 冲突解决方法选择
#### 开放寻址法
开放寻址法中，散列表的数据都存储在数组中，所以开放寻址法的优点与使用数组类似
1. 可以有效地利用 CPU 缓存加快查询速度
2. 序列化起来比较简单。

但是缺点也很明显:
1. 删除数据的时候比较麻烦，需要特殊标记已经删除掉的数据
2. 所有的数据都存储在一个数组中，比起链表法来说，冲突的代价更高。

使用开放寻址法只能适用装载因子小于 1 的情况。接近 1 时，就可能会有大量的散列冲突，导致大量的探测、再散列等，性能会下降很多。所以比起链表法更浪费内存空间。当数据量比较小、装载因子小的时候，适合采用开放寻址法。这也是 Java 中的 ThreadLocalMap使用开放寻址法解决散列冲突的原因.

#### 链表法
链表法利用的是链表这种离散的内存空间，因此
1. 对内存的利用率更高。因为链表结点可以在需要的时候再创建，无需像开放寻址法那样事先申请好
2. 对大装载因子的容忍度更高。对于链表法来说，只要散列函数的值随机均匀，即便装载因子变成 10，也就是链表的长度变长了而已，虽然查找效率有所下降，但是比起顺序查找还是快很多。

但是缺点也很明显，链表对于存储小的数据会浪费很多空间(指针的存在)，离散的内存分布也无法利用 CPU 的缓存加速。

链表法中的链表可以改造为其他高效的动态数据结构，比如跳表、红黑树。这样，即便出现散列冲突，极端情况下，所有的数据都散列到同一个桶内，那最终退化成的散列表的查找时间也只不过是 O(logn)。这样也就有效避免了前面讲到的散列碰撞攻击。

所以基于链表的散列冲突处理方法比较适合存储大对象、大数据量的散列表，而且，比起开放寻址法，它更加灵活，支持更多的优化策略，比如用红黑树代替链表。

### 2.5 java 的 HashMap
我们以 java 中的 HashMap 来说一说如何实现一个工业及的散列表:
1. 初始大小: HashMap 默认的初始大小是 16，这个默认值是可以设置的
2. 装载因子和动态扩容: HashMap 最大装载因子默认是 0.75，当 HashMap 中元素个数超过 0.75*capacity（capacity 表示散列表的容量）的时候，就会启动扩容，每次扩容都会扩容为原来的两倍大小。
3. 散列冲突解决: HashMap 底层采用链表法，在 JDK1.8 版本中引入了红黑树。而当链表长度太长（默认超过 8）时，链表就转换为红黑树。当红黑树结点个数少于 8 个的时候，又会将红黑树转化为链表

## 3. Python 的 dict
上面我们介绍了散列表的实现原理，但是实现一个工业及的散列表是在大量数学和实验的基础上实现的。因为我主要用的还是 Python ，因此我就以 Python 中的dict 实现来介绍当前工业级的散列表的最佳实践，并着手实现一个简单的散列表。

### 3.1 散列函数
Python 中的散列函数通常有两个部分组成:
1. 哈希码: 将一个键映射到一个整数
2. 压缩函数: 将哈希码映射到散列表内部数组的索引

这么做的目的是将哈希码的计算与具体的散列表大小相独立，这样就可以为每个对象开发一个通用的哈希码，并且可以用于任意大小的散列表，只有压缩函数与散列表的大小有关。

### 3.2 哈希码
不同对象的哈希码有如下几种实现方式:
1. 对于数值类型的对象，我们可以简单的把用于表示数值 X 的各个位所表示的值作为它的哈希码。如果数值的位数超过哈希码的长度，比如将 64 位浮点数哈希为 32 位的整数，可以对前后 32 求和或做异或处理
2. 对于字符串或元组形式表示的可变长度对象，通常使用多项式哈希和循环移位哈希，这两种方式都会考虑字符串中字符的位置

多项式哈希码的计算方式如下，其中 i 表示字符串中第 i 个字符，a 是非 0 常数。在处理英文字符串时 33，37，39，41 是合适 a 值。

```
p(t)=x1 + a(x2 + a(x3 + .... + a(xn−1 + axn)))
```

循环移位的 Python 算法如下，在处理英文字符串时 5 位移动能产生最少的散列冲突。

```python
def hash_code(s):
    mask = (1 << 32) - 1
    h = 0
    for c in s:
        h = (h << 5 & mask) | (h >> 27)
        h += ord(c)
    return h

```

#### Python 中的哈希码
Python 中只有不可变的数据类型可以哈希，以确保一个对象的生命周期中其哈希码不变。对于字符串 Python 使用类似于多项式哈希码的技术，精心设计了字符串的哈希码，没有使用异或和相加。使用相似的基于元组每个元素的哈希码的组合技术计算元组的哈希码。对于 frozenset 对象，元素的顺序是无关的，因此一个自然的选择是用异或值计算单个哈希码而不用任何移位。

用户自定义对象默认是不可哈希的，除非自定义 `__hash__` 内置函数，`hash()` 函数会调用此方法获取对象的哈希码。通过计算组合属性的哈希码作为自定义对象的哈希码是常见方法。

```python

def __hash__():
  return hash(self._red, self._green, self._blue)

```

一个重要的规则是，`__eq__` 与 `__hash__` 的实现必需一致，即如果`x==y`，则 `hash(x)==hash(y)`。比如 `hash(1)==hash(1.0)`


### 3.3 压缩函数
一个好的压缩函数应该确保两个不同的哈希码映射到相同索引的可能性为 1/N，工业级别最常用的压缩函数是 MAD(Multiply-Add-Divide)。选择这个压缩函数是为了消除在哈希码集合中的重复模式，并且得到更好的哈希函数。

```
[(ai + b) mod p] mod N
- N: 散列表内部数组的大小
- p: 比 N 大的素数
- a，b 是从区间 [0, p-1] 任意选择的整数，并且 a > 0
```

### 3.4 散列冲突处理
散列冲突解决方案中的开放寻址法，有多个变种。常见的包括线性探测，二次探测，双哈希策略。Python 中采用的是迭代地探测桶。这种方法下散列表的负载因子可以达到 2/3。
```
# 迭代地探测桶
A[(h(k) + f(i)) mod N]
- h(k): 哈希码
- f(i): 基于伪随机数产生器的函数，它提供一个基于原始哈希码位的可重复的但是随机
        的，连续的地址探测序列
```

## 4. 散列表的简单实现
作为散列表实现的简单示例，我们将介绍散列表的两种实现，链表法和线性探测的开放寻址法。限于篇幅，我们把这部分内容放到下一篇文章来讲解。

**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
- [《数据结构与算法：python语言实现》](https://book.douban.com/subject/30323938/)
