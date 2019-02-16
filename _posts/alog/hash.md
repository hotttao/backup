---
title: 16 哈希算法
date: 2018-10-23
categories:
    - Python
tags:
    - 数据结构与算法
---
如何使用使用哈希算法？

<!-- more -->

## 1 特性
将任意长度的二进制值串映射为固定长度的二进制值串，这个映射的规则就是哈希算法，而通过原始数据映射之后得到的二进制值串就是哈希值。优秀的哈希算法必需满足如下几点要求:
1. 不能反向推导: 从哈希值不能反向推导出原始数据（所以哈希算法也叫单向哈希算法）；
2. 输入数据敏感: 对输入数据非常敏感，哪怕原始数据只修改了一个 Bit，最后得到的哈希值也大不相同；
3. 散列冲突小: 散列冲突的概率要很小，对于不同的原始数据，哈希值相同的概率非常小；
4. 执行效率高: 哈希算法的执行效率要尽量高效，针对较长的文本，也能快速地计算出哈希值。


### 1.1 应用
哈希算法的应用非常多，最常见的有如下七种:
1. 安全加密: 不能反向推导 + 散列冲突小，无法通过哈希值逆推出原文
2. 唯一标识: 输入数据敏感 + 散列冲突小，可以通过哈希值的比较间接判断，原文是否相等
3. 数据校验: 输入数据敏感 + 散列冲突小，数据损坏，哈希值就会发生变化
4. 散列函数: 散列函数对哈希算法更加看重的是散列的平均性和哈希算法的执行效率
5. 负载均衡:
  - 利用哈希算法的唯一标识功能，可以将同一客户端 IP 或 session 路由到同一服务器
  - 路由的服务器编号=hash(client_ip or session_id) % len(server_list)
6. 数据分片:
  - 利用哈希算法的唯一标识功能，无需比较就可以将相同的数据归类在一起
  - 分配到的机器编号=hash(keyword) /  len(server_list)
7. 分布式存储: 数据分片 + 一致性哈希算法


## 2. 实现
### 2.1 一致性哈希算法
![consistent_hash](/images/algo/hash/consistent_hash.png)

利用一致性哈希算法，可以解决缓存等分布式系统的扩容、缩容导致数据大量搬移的难题。下面是 [Python 实现](http://techspot.zzzeek.org/2012/07/07/the-absolutely-simplest-consistent-hashing-example/)

```python
'''consistent_hashing.py is a simple demonstration of consistent
hashing.'''

import bisect
import hashlib


class ConsistentHash:
    '''ConsistentHash(n,r) creates a consistent hash object for a
    cluster of size n, using r replicas.

    It has three attributes. num_machines and num_replics are
    self-explanatory.  hash_tuples is a list of tuples (j,k,hash),
    where j ranges over machine numbers (0...n-1), k ranges over
    replicas (0...r-1), and hash is the corresponding hash value,
    in the range [0,1).  The tuples are sorted by increasing hash
    value.

    The class has a single instance method, get_machine(key), which
    returns the number of the machine to which key should be
    mapped.'''

    def __init__(self, num_machines=1, num_replicas=1):
        self.num_machines = num_machines
        self.num_replicas = num_replicas
        hash_tuples = [(j, k, my_hash(str(j) + "_" + str(k))) \
                       for j in range(self.num_machines) \
                       for k in range(self.num_replicas)]
        # Sort the hash tuples based on just the hash values
        hash_tuples.sort(lambda x, y: cmp(x[2], y[2]))
        self.hash_tuples = hash_tuples

    def get_machine(self, key):
        '''Returns the number of the machine which key gets sent to.'''
        h = my_hash(key)
        # edge case where we cycle past hash value of 1 and back to 0.
        if h > self.hash_tuples[-1][2]: return self.hash_tuples[0][0]
        hash_values = map(lambda x: x[2], self.hash_tuples)
        index = bisect.bisect_left(hash_values, h)
        return self.hash_tuples[index][0]


def my_hash(key):
    '''my_hash(key) returns a hash in the range [0,1).'''
    return (int(hashlib.md5(key).hexdigest(), 16) % 1000000) / 1000000.0


def main():
    ch = ConsistentHash(7, 3)
    print "Format:"
    print "(machine,replica,hash value):"
    for (j, k, h) in ch.hash_tuples: print "(%s,%s,%s)" % (j, k, h)
    while True:
        print "\nPlease enter a key:"
        key = raw_input()
        print "\nKey %s maps to hash %s, and so to machine %s" \
              % (key, my_hash(key), ch.get_machine(key))
```


```python
import bisect
import md5

class ConsistentHashRing(object):
    """Implement a consistent hashing ring."""

    def __init__(self, replicas=100):
        """Create a new ConsistentHashRing.

        :param replicas: number of replicas.

        """
        self.replicas = replicas
        self._keys = []
        self._nodes = {}

    def _hash(self, key):
        """Given a string key, return a hash value."""

        return long(md5.md5(key).hexdigest(), 16)

    def _repl_iterator(self, nodename):
        """Given a node name, return an iterable of replica hashes."""

        return (self._hash("%s:%s" % (nodename, i))
                for i in xrange(self.replicas))

    def __setitem__(self, nodename, node):
        """Add a node, given its name.

        The given nodename is hashed
        among the number of replicas.

        """
        for hash_ in self._repl_iterator(nodename):
            if hash_ in self._nodes:
                raise ValueError("Node name %r is "
                            "already present" % nodename)
            self._nodes[hash_] = node
            bisect.insort(self._keys, hash_)

    def __delitem__(self, nodename):
        """Remove a node, given its name."""

        for hash_ in self._repl_iterator(nodename):
            # will raise KeyError for nonexistent node name
            del self._nodes[hash_]
            index = bisect.bisect_left(self._keys, hash_)
            del self._keys[index]

    def __getitem__(self, key):
        """Return a node, given a key.

        The node replica with a hash value nearest
        but not less than that of the given
        name is returned.   If the hash of the
        given name is greater than the greatest
        hash, returns the lowest hashed node.

        """
        hash_ = self._hash(key)
        start = bisect.bisect(self._keys, hash_)
        if start == len(self._keys):
            start = 0
        return self._nodes[self._keys[start]]
```

**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
- [《数据结构与算法：python语言实现》](https://book.douban.com/subject/30323938/)
