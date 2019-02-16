---
title: 17 树的存储与遍历
date: 2018-10-24
categories:
    - Python
tags:
    - 数据结构与算法
---
如何表示和存储一颗树？

![tree_concept](/images/algo/tree_base/tree_concept.jpg)

<!-- more -->
## 1. 特性
树是我们接触的第一种非线性结构，在树中一个"父"元素可以有一个或多个"子"元素，这种组织关系要比一个序列中两个元素之间简单的"前","后"关系更加复杂。

最常用的树是二叉树，即一个父节点最多只有两个子节点，在二叉树的基础上如果我们按照特定的数据分布在树的各个节点组织数据，我们就可以得到诸如二叉搜索树，堆，红黑二叉树等多种具有特定用途的数据结构。

下面就是从树到二叉树的抽象层次结构，本节我们就来介绍如何存储和实现一个树。

```
                                Tree(树)
           BinaryTree(二叉树)                      LinkedTree
ArrayBinaryTree  LinkedBinaryTree
```

我们将 Tree，BinaryTree 实现为抽象基类，来定义和抽象普通树和二叉树可执行操作，并以二叉树的链式存储为例来实现一颗二叉树。我们会在堆章节中实现一个基于数组的二叉树。一颗普通树的链式存储与基于数组的存储与二叉树类似，我们会简单阐述它们的实现方式。



## 2. 实现
### 2.1 Tree
Tree 被实现为 Python 抽象基类，我们使用一种叫作 Position 的位置对象作为对树节点访问的代理。通过 Position 对象提供的辅助功能，我们可以验证待操作节点是否属于被操作的树，并抽象树的节点所表达的"父子"，以及迭代过程中的前后关系。

一个普通树能执行的操作有限，通过包括以下几种:
1. 获取和判断树的根节点
2. 获取节点的子节点树，并借此判断节点是否为叶子节点
3. 获取节点的父节点和所有子节点
4. 获取树的所有节点
5. 获取树中节点个数，判断树是否未空
6. 获取树或节点的高度和深度
7. 树的前序遍历和后序遍历

需要注意的是中序是二叉树特有的遍历方式，一颗普通的树没有中序遍历。下面是一个普通树的抽象实现。

```python
import abc


class Tree(object):
    __metaclass__ = abc.ABCMeta

    class Position(object):
        __metaclass__ = abc.ABCMeta

        @abc.abstractmethod
        def element(self):
            """
            :return: 返回存储在 p 中的元素值
            """

        @abc.abstractmethod
        def __eq__(self, other):
            pass

        @abc.abstractmethod
        def __ne__(self, other):
            return not self == other

    @abc.abstractmethod
    def root(self):
        """
        :return: 返回树的根节点
        """
        pass

    @abc.abstractmethod
    def parent(self, p):
        """
        :param p:
        :return: 返回 p 节点的父节点
        """
        pass

    @abc.abstractmethod
    def children(self, p):
        """
        :param p:
        :return: 返回 p 节点孩子的迭代
        """


    @abc.abstractmethod
    def num_children(self, p):
        """
        :param p:
        :return: 返回节点 p 孩子的个数
        """
        pass

    @abc.abstractmethod
    def __len__(self):
        pass

    def is_root(self, p):
        """
        :param p:
        :return: 判断位置 p 表示的节点是否是根节点
        """
        return self.root() == p

    def is_leaf(self, p):
        """
        :param p:
        :return: 判断位置 p 表示的节点是否是叶子节点
        """
        return self.num_children(p) == 0

    def is_empty(self):
        """
        :return: 判断树是否为空
        """
        return len(self) == 0

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
```

### 2.2 BinaryTree
相对于普通树，二叉树是具有如下属性的树:
1. 每个节点至多两个节点
2. 每个节点被命名为左右子节点
3. 在顺序上，同一个节点左孩子优于右孩子

因此二叉树与普通的树相比多了如下3个操作:
1. 获取节点的左右孩子
2. 获取节点的兄弟节点

需要注意的是虽然封装原则表名类的外部行为不需要依赖类的内部实现，而操作的效率却极大的依赖实现方式，所以我们更倾向于在 Tree 类的每个更具体的子类中提供合适的更新操作。因此我们不会在基类中限制树的更新操作。

```python
class BinaryTree(Tree):
    __metaclass__ = abc.ABCMeta

    @abc.abstractmethod
    def left(self, p):
        """
        :param p:
        :return: 返回节点的左孩子
        """
        pass

    @abc.abstractmethod
    def right(self, p):
        """
        :param p:
        :return: 返回节点的右孩子
        """
        pass

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
```

### 2.3 LinkedBinaryTree
LinkedBinaryTree 是我们第一个具体实现的链式二叉树。除了必需实现的抽象方法，更新操作外，我们还提供了树的四中遍历方式，用来迭代树中的元素。

```Python
from collections import deque
from tree import BinaryTree


class LinkedBinaryTree(BinaryTree):
    class _Node(object):
        __slots__ = "element", "parent", "left", "right"

        def __init__(self, element, parent=None, left=None, right=None):
            self.element = element
            self.parent = parent
            self.left = left
            self.right = right

    class Position(BinaryTree.Position):
        def __init__(self, container, node):
            self._node = node
            self._container = container

        def element(self):
            return self._node.element

        def __eq__(self, other):
            return type(other) is type(self) and self._node is other._node

    def _make_position(self, node):
        if node is not None:
            return self.Position(self, node)

    def _validate(self, p):
        if not isinstance(p, self.Position):
            raise TypeError('p must be proer Position type')
        if p._container is not self:
            raise ValueError('p not belong to this container')
        if p._node.parent is p._node:
            raise ValueError('p will no longer valid')
        return p._node

    def __init__(self):
        self._root = None
        self._size = 0

    def __len__(self):
        return self._size

    def root(self):
        return self._make_position(self._root)

    def parent(self, p):
        node = self._validate(p)
        return self._make_position(node.parent)

    def left(self, p):
        node = self._validate(p)
        return self._make_position(node.left)

    def right(self, p):
        node = self._validate(p)
        return self._make_position(node.right)

    def num_children(self, p):
        node = self._validate(p)
        count = 0
        if node.left is not None:
            count += 1
        if node.left is not None:
            count += 1
        return count

    def _add_root(self, e):
        """
        :param e:
        :return: 向树添加根节点
        """
        if self._root is not None:
            raise ValueError('Root exists')
        self._root = self._Node(e)
        self._size += 1
        return self._make_position(self._root)

    def _add_left(self, p, e):
        """
        :param p:
        :param e:
        :return: 为节点添加左子节点
        """
        node = self._validate(p)
        if node.left is not None:
            raise ValueError('Left child exists')
        self._size += 1
        left_node = self._Node(e, node)
        node.left = left_node
        return self._make_position(left_node)

    def _add_right(self, p, e):
        """
        :param p:
        :param e:
        :return: 为节点添加左子节点
        """
        node = self._validate(p)
        if node.right is not None:
            raise ValueError('right child exists')
        self._size += 1
        right_node = self._Node(e, node)
        node.right = right_node
        return self._make_position(right_node)

    def _replace(self, p, e):
        """
        :param p:
        :param e:
        :return: 替换节点的元素值
        """
        node = self._validate(p)
        old = node.element
        node.element = e
        return old

    def _delete(self, p):
        """
        :param p:
        :return: 删除节点，
        不能通过移动元素值来删除元素，因为 Position 内部是通过 Node 判断是否相等的
        """
        node = self._validate(p)
        if node.left and node.right:
            raise ValueError('p must leaf')
        child = node.left if node.left else node.right
        if child is not None:
            child.parent = node.parent
        if node is self._root:
            self._root = child
        else:
            if node is node.parent.left:
                node.parent.left = child
            else:
                node.parent.right = child
        node.parent = node
        self._size -= 1
        return node.element

    def attach(self, p, t1, t2):
        """
        :param p:
        :param t1:
        :param t2:
        :return: 在叶子节点附加左右子树
        """
        node = self._validate(p)
        if not type(self) is type(t1) is type(t2):
            raise TypeError()
        if not self.is_leaf(p):
            raise ValueError('p must leaf')
        self._size += len(t1) + len(t2)
        if not t1.is_empty():
            node.left = t1._root
            t1._root.parent = node
            t1._size = 0
            t1._root = None
        if not t2.is_empty():
            node.right = t2._root
            t2._root.parent = node
            t2._size = 0
            t2._root = None


    def positions(self):
        """
        :return: 返回树所有位置的一个迭代
        """
        return self.preorder()

    def __iter__(self):
        for p in self.positions():
            yield p.element()

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
        :return: 广度优先遍历
        """
        if not self.is_empty():
            queue = deque()
            queue.append(self.root())
            while len(queue) > 0:
                p = queue.popleft()
                for c in self.children(p):
                    queue.append(c)
                yield p

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

## 3.相关算法
不考虑特殊的树，仅仅是普通的二叉树就有很多应用，比如计算目录的容量，表达式树。与树相关的递归也是经常考的算法题。但是考虑篇幅的原因，我会在讲解完所有的树之后，用几篇单独的文章来说明与树相关的算法。

### 3.1 表达式树
作为二叉树的第一个例子，我们将使用二叉树来表示算数表达式的结构。我们将定义一个 BinaryTree 的子类 ExpressionTree，在其内部的每个节点必需存储一个操作符，每个叶子节点则必需存储一个数字。

```Python
from expression import infix_to_postfix
from linked_tree import LinkedBinaryTree


class ExpressionTree(LinkedBinaryTree):
    def __init__(self, token, left=None, right=None):
        super(ExpressionTree, self).__init__()
        if not isinstance(token, (str, unicode)):
            raise TypeError('Token must be a string')
        self._add_root(token)
        if left or right:
            if token not in '+-*/':
                raise ValueError('token must be in +-*/')
            self.attach(self.root(), left, right)

    def __str__(self):
        result = []
        if not self.is_empty():
            self._parenthesize_recur(self.root(), result)
        return ''.join(result)

    def _parenthesize_recur(self, p, result):
        if self.is_leaf(p):
            result.append(p.element())
        else:
            result.append('(')
            self._parenthesize_recur(self.left(p), result)
            result.append(p.element())
            self._parenthesize_recur(self.right(p), result)
            result.append(')')

    def evaluate(self):
        """
        :return: 计算表达式树的值
        """
        return self._evaluate_cur(self.root())

    def _evaluate_cur(self, p):
        if self.is_leaf(p):
            return float(p.element())
        else:
            left = self._evaluate_cur(self.left(p))
            op = p.element()
            right = self._evaluate_cur(self.right(p))
            if op == '+':
                return left + right
            elif op == '-':
                return left - right
            elif op == '/':
                return left / right
            else:
                return left * right

    @staticmethod
    def build_expression_tree(expression):
        """
        :param expression: 表达式默认以空格分隔
        :return: 构建表达式树
        """
        stack = []
        postfix = infix_to_postfix(expression)
        for i in postfix:
            if i not in '+-*/':
                stack.append(ExpressionTree(i))
            else:
                right = stack.pop()
                left = stack.pop()
                stack.append(ExpressionTree(i, left, right))
        t = stack.pop()
        return t


if __name__ == '__main__':
    expression = '10 / 5 + 1 + ( 100 / 10 )'
    t = ExpressionTree.build_expression_tree(expression)
    print t
    print t.evaluate()
```

在原书 [《数据结构与算法：python语言实现》](https://book.douban.com/subject/30323938/) 中，通过 `build_expression_tree` 方法构建表达式树时，要求传入的表达式必需是完全括号，即形如 `2 * 6 + 2` 的表达式必需写成`(2 * 6) + 2` 才能正确执行。对于一般的算数表达式必需先借助栈，将中缀表达式转换为后缀表达式才能正确构建表达式树，整个过程类似于[栈](https://hotttao.github.io/2018/10/11/alog/stack/)中表达式的求值过程。


## 3.2 树遍历的应用
树的遍历有很多应用，但是这些应用都有一个共通的特点，即他们都是在树的遍历过程的前后附加一些特殊操作。利用面向对象编程中的模板方法模式，我们可以将树的遍历过程定义为一个通用的计算机制，并在迭代的过程中定义好钩子函数。所有类似的应用都可以通过继承并自定义钩子函数的方式快速实现。

对于树的遍历而言，通常有四个变量是我们会利用的信息，我们需要在遍历的前后将它们传递给钩子函数:
- `p`: 当前节点的位置对象
- `d`: p 的深度
- `path`: 从根到 p 的路经
- `result`: p 所有子节点的遍历结果

下面是树遍历过程的模板方法的实现。

```Python
class EulerTour(object):
    def __init__(self, tree):
        self._tree = tree

    def execute(self):
        if not self._tree.is_empty():
            return self._tour(self._tree.root(), 0, [])

    def _tour(self, p, d, path):
        """
        :param p:
        :param d:
        :param path:
        :param result:
        :return:
        """
        self._hook_previsit(p, d, path)
        path.append(0)
        result = []
        for c in self._tree.children(p):
            result.append(self._tour(c, d + 1, path))
            path[-1] += 1
        value = self._hook_postvisit(p, d, path, result)
        path.pop()
        return value

    def _hook_previsit(self, p, d, path):
        pass

    def _hook_postvisit(self, p, d, path, result):
        pass


class BinaryEulerTour(BinaryEulerTour):
    def __init__(self, tree):
        super(BinaryEulerTour, self).__init__(tree)

    def execute(self):
        if not self._tree.is_empty():
            return self._tour(self._tree.root(), 0, [])

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

此时如果我们想构建一个表示目录结构的目录树，并计算目录的大小，借助于 `EulerTour` 可以很容易的实现

```Python
class DiskSpace(EulerTour):
    def __init__(self, tree):
        super(DiskSpace, self).__init__(tree)

    def _hook_postvisit(self, p, d, path, result):
        return p.element() + sum(result)
```

## 4. linkcode 习题


**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
- [《数据结构与算法：python语言实现》](https://book.douban.com/subject/30323938/)
