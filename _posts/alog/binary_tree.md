---
title: 18 二叉查找树与完全二叉树
date: 2018-10-25
categories:
    - Python
tags:
    - 数据结构与算法
---
有散列表了，为什么还要"一颗树"

![binary_tree](/images/algo/binary_tree/binary_tree_search.jpg)

<!-- more -->

## 1. 特性


## 2. 实现
### 2.1 二叉搜索树
我们实现的二叉搜索树将支持:
1. 标准映射操作:
  - `__setitem__`
  - `__getitem__`
  - `__delitem__`
2. 有序映射操作:
  - `find_lt`
  - `find_range`
3. 基于位置操作
  - `after(p)`
  - `before(p)`


```python
from collections import MutableMapping
from linked_tree import LinkedBinaryTree


class MapBase(MutableMapping):
    class _Item(object):
        __slots__ = '_key', '_value'

        def __init__(self, k, v):
            self._key = k
            self._value = v

        def __eq__(self, other):
            return self._key == other._key

        def __lt__(self, other):
            return self._key < other._key

        def __gt__(self, other):
            return self._key > other._key


class TreeMap(LinkedBinaryTree, MapBase):
    class Position(LinkedBinaryTree.Position):
        def key(self):
            return self.element()._key

        def value(self):
            return self.element()._value

    def _subtree_search(self, p, k):
        """
        :param p:
        :param k:
        :return: 在子树中搜索值为 k 的节点，未搜索到返回最后搜索路经的最终位置
        """
        p_value = p.key()
        if p_value == k:
            return p
        elif p_value > k:
            if self.left(p):
                return self._subtree_search(self.left(p), k)
        else:
            if self.right(p):
                return self._subtree_search(self.right(p), k)
        return p

    def _subtree_first_position(self, p):
        """
        :return: 返回子树迭代时，第一个位置节点
        """
        walk = p
        while self.left(walk):
            walk = self.left(walk)
        return walk

    def _subtree_last_position(self, p):
        """
        :param p:
        :return: 返回子树迭代时，最后一个位置节点
        """
        walk = p
        while self.right(walk):
            walk = self.right(walk)
        return walk

    ################# 引导方法 #######################
    def first(self):
        """
        :return: 返回树迭代序列的第一个节点
        """
        return self._subtree_first_position(self.root()) if len(self) > 0 else None

    def last(self):
        """
        :return: 返回树迭代序列的最后一个节点
        """
        return self._subtree_last_position(self.root()) if len(self) > 0 else None

    def before(self, p):
        """
        :param p:
        :return: 返回迭代序列中位于 p 之前的，最大节点
        """
        self._validate(p)
        if self.left(p):
            return self._subtree_last_position(self.left(p))
        else:
            walk = p
            ancestor = self.parent(walk)
            while ancestor and self.left(ancestor) is walk:
                walk = ancestor
                ancestor = self.parent(ancestor)
            return ancestor

    def after(self, p):
        """
        :param p:
        :return: 返回迭代序列中位于 p 之后的，最小节点
        """
        self._validate(p)
        if self.right(p):
            self._subtree_first_position(self.right(p))
        else:
            walk = p
            ancestor = self.parent(walk)
            while ancestor and self.right(ancestor) is walk:
                walk = ancestor
                ancestor = self.parent(ancestor)
            return ancestor

    def find_position(self, k):
        """
        :param k:
        :return: 查找值等于 k 的位置节点
        """
        if self.is_empty():
            return None
        else:
            p = self._subtree_search(self.root(), k)
            # avl 平衡树的钩子函数
            self._rebalance_access(p)
            return p

    ####################### 有序映射 ######################

    def find_min(self):
        """
        :return: 查找树中的最小值
        """
        if self.is_empty():
            return None
        else:
            p = self.first()
            return p.key(), p.value()

    def find_ge(self, k):
        """
        :param k:
        :return: 查找大于等于 k 的最小节点
        """
        p = self.find_position(k)
        if p and p.key() < k:
            p = self.after(p)
        return p.key(), p.value() if p else None, None

    def find_range(self, start, stop):
        """
        :param start:
        :param stop:
        :return: 查找值位于 start <= k < stop 的节点
        """
        if not self.is_empty():
            if start is None:
                p = self.first()
            else:
                p = self.find_position(start)
                if p and p.key() < start:
                    p = self.after(p)
            while p and (stop is None or p.key() < stop):
                yield p.key(), p.value()
                p = self.after(p)

    ########################### 增删改查节点操作 ################

    def __getitem__(self, item):
        """
        :param item:
        :return: 查找 item 映射的值  
        """
        if not self.is_empty():
            p = self.find_position(item)
            self._rebalance_access(p)
            if p.key() == item:
                return p.value()
        raise KeyError('Key Error:' + repr(item))

    def __setitem__(self, key, value):
        """
        :param key:
        :param value:
        :return: 设置键 key 的值为 value
        """
        if self.is_empty():
            leaf = self._add_root(self._Item(key, value))
        else:
            p = self.find_position(key)
            if p.key() == key:
                p.element()._value = value
                self._rebalance_access(p)
                return
            else:
                item = self._Item(key, value)
                if p.key() < key:
                    leaf = self._add_right(p, item)
                else:
                    leaf = self._add_left(p, item)
        self._rebalance_insert(leaf)

    def __iter__(self):
        """
        :return: 产生键的一个迭代
        """
        p = self.first()
        while p:
            yield p.key()
            p = self.after(p)

    def delete(self, p):
        """
        :param p:
        :return: 删除位置节点 p
        """
        self._validate(p)
        if self.left(p) and self.right(p):
            r = self._subtree_last_position(self.left(p))
            self._replace(p, r.element())
            p = r
        parent = self.parent(p)
        self._delete(p)
        self._rebalance_delete(parent)

    def __delitem__(self, key):
        """
        :param key:
        :return: 删除键 key
        """
        if not self.is_empty():
            p = self._subtree_search(self.root(), key)
            if p.key() == key:
                self.delete(p)
                return
            self._rebalance_access(p)
        raise KeyError('Key Error: ' + repr(key))

    ################### 平衡二叉树的钩子函数 ###############
    def _rebalance_delete(self, p):
        pass

    def _rebalance_insert(self, p):
        pass

    def _rebalance_access(self, p):
        pass

```

**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
- [《数据结构与算法：python语言实现》](https://book.douban.com/subject/30323938/)
