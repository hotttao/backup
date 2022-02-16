---
title: 3. 树
date: 2020-07-03
categories:
    - Python
tags:
    - 好玩的数据结构与算法
---

树

<!-- more -->

## 1. 树的抽象
我们都知道树是一种数组组织形式，通过限定树中数据的组织方式，我们可以得到很多树的变种。因此要想学好树，我们就要从最基本的树开始，逐一去了解每种特殊的树的数据组织方式以及他们能提供的操作。

### 1.1 数的组织方式
我们所说的数据组织方式本质上应该包括两个方面:
1. 底层数据的存储方式: 包括链表和数组，因此就有了链表实现的树，与数组实现的树
2. 父子节点的排列方式: 排列方式包括如下几个层次:
    - 每个节点的子节点个数
    - 父子节点之间的大小顺序
    - 每一个节点的子节点之间的大小顺序
    - 树为否为完全二叉树

通常链表是实现树的通用方式，而数组实现的树通常仅限于完全二叉树。父子节点的排列方式决定了树的搜索属性，决定了每种树的特定用途。

### 1.2 树的抽象层次
下面是树的一个类层次结构，接下来我们会一一介绍下面的各种树。
```bash
Tree
|------- BinaryTree
|            | 
|            |--------ArraryBinaryTree
|            | 
|            |--------LinkedBinaryTree
|            |                    |-------TreeMap
|            |                    |          |------------ AVLTree
|            |                    |          |------------ SplayTree
|            |                    |          |------------ RedBlackTree
```
## 2. 树
### 2.1 Tree
Tree 最普通的树，可以有任意的分叉和孩子数，支持如下操作:
1. `root()`: 返回树的根节点
2. `parent(p)`: 返回节点 p 的父节点
3. `children(p)`: 返回节点 p 的子节点
4. `is_root(p)`: 判断节点 p 是否为根节点
5. `is_leaf(p)`: 判断节点 p 是否是叶节点
5. `is_empty()`: 判断树是否为空
6. `depth(p)`: 计算节点 p 的深度
7. `height(p)`: 计算节点 p 的高度
8. `preorder(p)`: 先序遍历
9. `postorder(p)`: 后序遍历
10. `breadthfirst()`: 层序遍历，又称广度优先遍历

说明: 树的遍历按照父节点被访问的次序分为:
1. 先序遍历: 先访问树的父节点，在访问子节点
2. 后序遍历: 先访问树的子节点，在访问父节点
3. 层序遍历: 按树的层遍历所有节点

```python
class Tree(object):
    
    def depth(self, p):
        """
        :param p:
        :return: 返回 p 节点的深度
        """
        if self.is_root(p):
            return 0
        else:
            return 1 + self.depth(self.parent(p))

    def height(self, p=None):
        """
        :return: 返回树的高度
        """
        p = p or self.root()
        return self._height(p)

    def _height(self, p):
        if self.is_leaf(p):
            return 0
        else:
            return 1 + max(self._height(c) for c in self.children(p))
    def preorder(self):
        """
        :return: 树的前序遍历
        """
        if not self.is_empty():
            for p in self._subtree_preorder(self.root()):
                yield p

    def _subtree_preorder(self, p):
        yield p
        for i in self.children(p):
            for other in self._subtree_preorder(i):
                yield other

    def postorder(self):
        """
        :return: 后序遍历
        """
        if not self.is_empty():
            for p in self._subtree_postorder(self.root()):
                yield p

    def _subtree_postorder(self, p):
        for i in self.children(p):
            for other in self._subtree_preorder(i):
                yield other
        yield p

    def breadthfirst(self):
        """
        :return: 中序遍历
        """
        if not self.is_empty():
            queue = deque()
            queue.append(self.root())
            while len(queue) > 0:
                p = queue.popleft()
                yield p
                for c in self.children(p):
                    queue.append(c)
```

### 2.2 BinaryTree
BinaryTree 二叉树是每个节点最多只有两个分叉的树，他在 Tree 的基础上增加了如下几个操作:
1. `left(p)`: 返回节点 p 的左子节点
2. `right(p)`: 返回节点 p 的右子节点
3. `sibling(p)`: 返回节点 p 的兄弟节点
4. `inorder(p)`: 中序遍历
    - 中序遍历是二叉树特有的遍历方式
    - 节点的访问次序是左子节点->父节点->右子节点

```python
class BinaryTree(Tree):
    def slide(self, p):
        """
        :param p:
        :return: 返回节点的兄弟节点
        """
        parent = self.parent(p)
        if parent is not None:
            left = self.left(parent)
            right = self.right(parent)
            if left == p:
                return right
            else:
                return left

    def children(self, p):
        """
        :param p:
        :return: 返回节点的所有子节点
        """
        left = self.left(p)
        if p is not None:
            yield left
        right = self.right(p)
        if right is not None:
            yield right
    
    def inorder(self):
        """
        :return: 中序遍历
        """
        if not self.is_empty():
            return self._subtree_inorder(self.root())

    def _subtree_inorder(self, p):
        left = self.left(p)
        if left is not None:
            for other in self._subtree_inorder(left):
                yield other
        yield p
        right = self.right(p)
        if right is not None:
            for other in self._subtree_inorder(right):
                yield other
```

## 3. 树遍历的抽象-欧拉图和模板方法
前面我们实现了树的四种遍历方式，以按照不同的顺序获取树中的元素。但是这提供的抽象能力还不够，更多时候，我们需要获取树遍历过程中的更多信息，比如当前位置的深度，或者从根节点到当前位置的完整路径，或者返回下一层信息到上一层。因此我们需要一个更通用的框架，即基于概念实现树的遍历--欧拉遍历。

什么是欧拉遍历，我们来看下面的伪代码:
```python
Algorithm eulertour(T, p)
    pre visit for p                         # 第一访问节点 p，前序遍历可执行的操作位于此处
    for each child c in T.children(p) do
        eulertour(T, c)
    post visit for p                        # 第二次访问节点 p，后续遍历可执行的操作位于此处
```

显然我们可以把 eulertour 定义为模板方法，让继承自 eulertour 的子类去实现需要的前序后续遍历需要执行的操作。下面是 eulertour 的具体实现:

```python
class EulerTour(object):
    # 一般欧拉遍历的实现
    def __init__(self, tree):
        self._tree = tree

    def execute(self):
        if not self._tree.is_empty():
            return self._tour(self._tree.root(), 0, [])

    def _tour(self, p, d, path):
        """
        :param p: 当前遍历的节点
        :param d: 节点所处的树的深度
        :param path: 从根到达当前节点的路径
        :return: 后续遍历的返回值
        """
        self._hook_previsit(p, d, path) # 先序遍历需实现的抽象方法
        path.append(0)                  # path 最后一个索引记录了，当前节点所有子节点的排序
        result = []
        for c in self._tree.children(p):
            result.append(self._tour(c, d + 1, path))
            path[-1] += 1
        path.pop()
        value = self._hook_postvisit(p, d, path, result)
        return value

    def _hook_previsit(self, p, d, path):
        pass

    def _hook_postvisit(self, p, d, path, result):
        """
        :param p: 当前遍历的节点
        :param d: 节点所处的树的深度
        :param path: 从根到达当前节点的路径
        :param result: 子节点后续遍历返回值的列表
        :return: 后续遍历的返回值
        """


class BinaryEulerTour(BinaryEulerTour):
    # 二叉树的欧拉遍历
    def __init__(self, tree):
        super(BinaryEulerTour, self).__init__(tree)

    def _tour(self, p, d, path):
        self._hook_previsit(p, d, path)
        result = [None, None]
        if self._tree.left(p):
            path.append(0)
            result[0] = self._tour(self._tree.left(p), d + 1, path)
            path.pop()
        
        self._hook_invisit(p, d, path)
        
        if self._tree.right(p):
            path.append(1)
            result[1] = self._tour(self._tree.right(p), d + 1, path)
            path.pop()

        value = self._hook_postvisit(p, d, path, result)
        return value
    
    def _hook_invisit(self, p, d, path):
        pass
```

利用 BinaryEulerTour 我们可以开发一个用于计算二叉树的图形布局的子类，该算法用以下两条规则为二叉树的每个节点指定 x，坐标：
1. x(p): 在节点 p 之前，中序遍历访问的节点数量
2. y(p): 是 T 中 p 的深度

```python
class BinaryLayout(BinaryEulerTour)
    def __init__(self, tree):
        super().__init__(tree)
        self._count = 0
    
    def _hook_invisit(self, p, d, path):
        p.element().setX(self._count)
        p.element().setY(d)
        self._count+=1
```
除了 BinaryEulerTour 提供的钩子函数外，我们以 _count 实例变量的形式引入了额外的状态，从而调整了 BinaryEulerTour 框架，扩展了框架提供的功能。

## 4. 二叉搜索树与 AVL 平衡树
### 4.1
TreeMap 二叉搜索树是一种特殊的二叉树，其满足以下条件:
1. 存储在 p 的左子树的键都小于 p 的键
2. 存储在 p 的右子树的键都大于 p 的键

这个特性使得树的中序遍历可以按升序的方式输出键。这个特性使得二叉搜索树增加了如下方法:
1. `first()`: 返回一个包含最小键的节点，即最左子节点
2. `last()`: 返回一个包含最大键的节点，即最右子节点
3. `before(p)`: 
    - 返回比节点 p 的键小的所有节点中的键最大的节点
    - 即中序遍历中在 p 之前最后一个被访问的节点
    - 如果 p 是第一个节点，则返回 None
4. `after(p)`: 
    - 返回比节点 p 的键大的所有节点中最小的节点
    - 即中序遍历中在 p 之后第一个被访问的节点
    - 如果 p 是最后一个节点，返回 None
5. `search(k)`: 在树中搜索键 k，返回搜索路径的最终位置，这样get，set，del 方法可以复用 search 方法
5. `find_le(k)`: 小于等于 k 的节点，可以基于 search(k) 和 before(p) 实现 
6. `find_ge(k)`: 大于等于 k 的节点，可以基于 search(k) 和 after(p) 实现 
7. `find_range(start, end)`: 位于 start, end 之间的节点
8. `T[k]`: 查找键 k 对应的 value
9. `T[k]=v`: 设置键 k 的值
10. `del T[k]`: 删除键 k
11. `_rebalance_delete(p)`: AVL 和 红黑树实现树平衡的钩子函数
12. `_rebalance_insert(p)`: AVL 和 红黑树实现树平衡的钩子函数
13. `_rebalance_access(p)`: AVL 和 红黑树实现树平衡的钩子函数

下面是 TreeMap 的具体实现:

```Python
class TreeMap(LinkedBinaryTree, MapBase):

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

### 4.2 AVL 树
二叉搜索树的问题在于在不断的插入和删除之后树就会变得不平衡，从而导致增删改查的时间复杂度不断变高。而 AVL 树就是能保持树平衡的二叉树。AVL 树要求，对于树中每一个节点 p，p 的孩子的高度最多相差 1。伸展树和红黑树都能维持树的平衡，虽然它们与 AVL 树维持平衡的方法有所差别，但是核心操作都是树的旋转。因此要想写好这些树，首先我们要实现如下几个树的旋转操作:
1. `_relink(parent, child, make_left_child)`: 关联父子节点
2. `_rotate(p)`: 旋转过程中，重新定义父子关系
3. `_restructure(x)`: 执行旋转操作

```python

```

TreeMap 中我们已经预留了维持树平衡的接口，AVL 实现中我们需要做的是
1. 记录每个节点的高度
2. 实现钩子函数 `_rebalance_insert` 和 `_rebalance_delete`(两个方法的实现相同)以保证在插入和删除节点后，AVL 树的高度满足树中每一个节点 p，p 的孩子的高度最多相差 1。

下面是 AVL 树的具体实现:
```python
```

### 4.3 红黑树
红黑树相较于 AVL 树，增删改查操作更加稳定，因此比 AVL 树更常用，但是其实现起来更为复杂。红黑树有现成的实现，手写他们不是我们的目的，我们的目的是明白树的整个抽象层次，并在需要的时候知道使用什么树。

## 5. 树的序列化与反序列化
序列化和反序列化是所有数据结构通用的操作，对于树也是如此，树的序列化与反序列化主要使用的是树的前序，层序遍历。

### 5.1 二叉树序列化
我们先来看如何使用先序遍历实现二叉树的序列化和反序列化。

#### 先序遍历实现的序列化
```python
from collections import deque

class Codec:

    def serialize(self, root):
        """Encodes a tree to a single string.
        
        :type root: TreeNode
        :rtype: str
        """
        if root is None:
            return "null"
        return str(root.val) + "," + self.serialize(root.left) + "," + self.serialize(root.right)
        

    def deserialize(self, data):
        """Decodes your encoded data to tree.
        
        :type data: str
        :rtype: TreeNode
        """
        collect = deque(data.split(","))
        def dfs():
            if len(collect) == 0:
                return None
            node = collect.popleft()
            if node == "null":
                return None
            root = TreeNode(int(node))
            root.left = dfs()
            root.right = dfs()
            return root
        return dfs()
```

#### 中序遍历实现的序列化
```python
from collections import deque

class Codec:

    def serialize(self, root):
        """Encodes a tree to a single string.
        
        :type root: TreeNode
        :rtype: str
        """
        if not root:
            return ""
        collect = []
        queue = deque([root])
        while len(queue) > 0:
            node = queue.popleft()
            if node:
                queue.append(node.left)
                queue.append(node.right)
                collect.append(str(node.val))
            else:
                collect.append("null")
        return ",".join(collect)


    def deserialize(self, data):
        """Decodes your encoded data to tree.
        
        :type data: str
        :rtype: TreeNode
        """
        if data == "":
            return None
        print(data)
        collect = deque(data.split(","))
        root = TreeNode(int(collect.popleft()))
        queue = deque([root])
        while len(queue) > 0:
            parent = queue.popleft()
            left, right = collect.popleft(), collect.popleft()
            if left != "null":
                left_node = TreeNode(int(left))
                queue.append(left_node)
                parent.left = left_node
            if right != "null":
                right_node = TreeNode(int(right))
                queue.append(right_node)
                parent.right = right_node
        return root
```

### 5.1 普通树的序列化
```python
```