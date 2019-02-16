---
title: 04 栈
date: 2018-10-11
categories:
    - Python
tags:
    - 数据结构与算法
---
![linkedlist](/images/algo/stack/stack_image.jpg)

后进者先出，先进者后出，这就是典型的“栈”结构。

<!-- more -->

## 1. 特性
栈是一种“操作受限”的线性表，只允许在一端插入和删除数据。主要包含两个操作，入栈和出栈，也就是在栈顶插入一个数据和从栈顶删除一个数据。

## 2. 实现
栈既可以用数组来实现，也可以用链表来实现。用数组实现的栈，我们叫作顺序栈，用链表实现的栈，我们叫作链式栈。如果要实现一个支持动态扩容的栈，我们只需要底层依赖一个支持动态扩容的数组就可以了。当栈满了之后，我们就申请一个更大的数组，将原来的数据搬移到新数组中。

### 2.1 顺序栈
顺序栈依赖一个能自动扩缩容的数组容器，我们可以像数组章节一样，自己实现一个数组容器，也可以直接使用 Python 内置的 list。list 的接口已经包含并大大超过了栈的可操作范围，这里我们采用一种称为"适配器模式"的通用方法，将栈操作委托给一个内部的 list 实例，来实现一个顺序栈。

这个实现起来很简单，就不写的过于复杂了。

```python
class ArrayStack(object):
    def __init__(self):
        self._buf = []

    def __len__(self):
        return len(self._buf)

    def pop(self):
        if len(self._buf) < 1:
            raise ValueError('stack is empty')
        return self._buf.pop()

    def push(self, value):
        self._buf.append(value)
```

### 2.2 链式栈
在链表的头部插入和删除一个节点的时间复杂度都是 O(1)，因此我们很容易的就可以将链表的头部作为栈顶实现一个链式栈，并且我们的都不管链表的尾，链表只要维护一个指向头节点指针和自身大小的计数即可。

注意不要将链表的尾作为栈顶，虽然可以实现 O(1) 向链尾插入节点，但是删除尾节点需要遍历整个链表。在链表章节，我们已经实现了一个"超纲的"链式栈，这里就不再累述了。

## 3. 相关算法
操作系统给每个线程分配了一块独立的内存空间，这块内存被组织成“栈”这种结构, 用来存储函数调用时的临时变量。每进入一个函数，就会将临时变量作为一个栈帧入栈，当被调用函数执行完成，返回之后，将这个函数对应的栈帧出栈。这种栈被称为函数调用栈。除此之外诸如表达式求值，括号匹配以及实现浏览器的前进后退功能都与栈有关。

### 3.1 表达式求值
对一个类似于 `3-(1/4+7)*3` 中缀表达式进行求值分成两步:
1. 将中缀表达式转换为后缀表达式
2. 对后缀表达式进行求值

这两步都用到了栈。为了简单起见，我们只处理`+ - * / ()` 四种运算

```python
from stack import ArrayStack
from operator import add, div, mul, sub

op_priority = {
    '(': 1,
    '+': 2,
    '-': 2,
    '*': 3,
    '/': 3,
    ')': 4
}

op_func = {
    '+': add,
    '-': sub,
    '*': mul,
    '/': div
}


def infix_to_postfix(expression):
    s = ArrayStack()
    r = []
    expression = expression.split(' ')
    for e in expression:
        if e not in op_priority:
            r.append(e)
        elif e == '(':
            s.push(e)
        elif e == ')':
            if s.top() != '(':
                r.append(s.pop())
            s.pop()
        else:
            while len(s) > 0:
                t = s.top()
                if op_priority[t] >= op_priority[e]:
                    r.append(s.pop())
                else:
                    break
            s.push(e)
    while len(s) > 0:
        r.append(s.pop())
    return ''.join(r)


def calculate_postfix(expression):
    s = ArrayStack()
    expression = expression.split(' ')
    for e in expression:
        if e not in op_priority:
            s.push(e)
        else:
            right = float(s.pop())
            left = float(s.pop())
            # print left, right
            value = op_func[e](left, right)
            s.push(value)
    return s.pop()


def main():
    print infix_to_postfix('( A + B ) * ( C + D )')
    print infix_to_postfix('A + B * C')
    print calculate_postfix('7 8 + 3 2 + /')
    print infix_to_postfix('6 / 3')
    print calculate_postfix('15 3 /')
```

### 3.2 括号匹配
括号匹配有两个类似的问题，一个是类似于对形如 `(1 + 2) + (10)` 表达式检测括号是否成对出现；另一个更加常用的是检测 HTML 标签是否完整匹配。

```python
from stack import ArrayStack

# 括号匹配
def per_check(expression):
    left = '({['
    right = ')}]'
    s = ArrayStack()
    expression = expression.replace(' ', '')
    for e in expression:
        if e in left:
            s.push(left.index(e))
        elif e in right:
            i = right.index(e)
            if len(s) <=0:
                return False
            elif i != s.pop():
                return False
    if len(s) > 0:
        return False
    return True

# html 标签匹配
def html_match(html_string):
    start = 0
    s = ArrayStack()
    while start != -1:
        start = html_string.find('<', start)
        if start == -1:
            break
        end = html_string.find('>', start + 1)
        tag = html_string[start + 1: end]
        print tag
        if tag.startswith('/'):
            if len(s) <= 0:
                return False
            else:
                top = s.pop()
                # print top, tag[1:]
                if top != tag[1:]:
                    return False
        else:
            s.push(tag)
        start = end

    if len(s) > 0:
        return False
    return True


def main():
    # print per_check('{{([][])}()}')
    # print per_check('()]')
    print html_match('<a></a>')

if __name__ == "__main__":
    main()

```

### 3.3 浏览器的前进后退功能
```python
from stack import ArrayStack


class Browser(object):
    def __init__(self):
        self._back = ArrayStack()
        self._forward = ArrayStack()

    def back(self):
        """
        :return: 后退
        """
        if len(self._back) > 0:
            self._forward.push(self._back.pop())

    def forward(self):
        """
        :return: 前进
        """
        if len(self._forward) > 0:
            self._back.push(self._forward.pop())

    def new_click(self):
        """
        :return: 打开新连接
        """
        while len(self._forward) > 0:
            self._forward.pop()
```

## 4. linkcode 习题


**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
- [《数据结构与算法：python语言实现》](https://book.douban.com/subject/30323938/)
