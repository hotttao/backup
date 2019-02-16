---
title: 05 队列
date: 2018-10-12
categories:
    - Python
tags:
    - 数据结构与算法
---
![linkedlist](/images/algo/queue/queue.jpg)

先进者先出，这就是典型的"队列"。

<!-- more -->

## 1. 特性
我们知道，栈只支持两个基本操作：入栈 push()，出栈 pop()，队列与栈类似基本操作只有两个: 入队 enqueue() 向对尾添加一个数据，出队 dequeue() 从队列头部取出一个数据。

### 1.1 应用
队列的应用非常广泛，特别是一些具有某些额外特性的队列，比如循环队列、阻塞队列、并发队列。它们在很多偏底层系统、框架、中间件的开发中，起着关键性的作用。比如高性能队列 Disruptor、Linux 环形缓存，都用到了循环并发队列；Java concurrent 并发包利用 ArrayBlockingQueue 来实现公平锁等。

队列可以应用在任何有限资源池中，用于排队请求。对于大部分资源有限的场景，当没有空闲资源时，基本上都可以通过“队列”这种数据结构来实现请求排队。

### 1.2 阻塞队列
阻塞队列其实就是在队列基础上增加了阻塞操作。它有两个显著特征:
1. 队列空时，从队头取数据会被阻塞，直到队列中有了数据才能返回
2. 队列满时，向队尾插入数据会被阻塞，直到队列中有空闲位置后再插入数据，然后再返回我们可以使用阻塞队列轻松实现一个“生产者，消费者模型”。

### 1.3 并发队列
线程安全的队列我们叫作并发队列，最简单直接的实现方式是直接在 enqueue()、dequeue() 方法上加锁，但是锁粒度大并发度会比较低，同一时刻仅允许一个存或者取操作。

实际上，基于数组的循环队列，利用 CAS 原子操作，可以实现非常高效的并发队列。这也是循环队列比链式队列应用更加广泛的原因。

### 1.4 双端对列
双端对列是一种类对列数据结构，支持在对列的头部和尾部都能进行插入和删除操作。Python 中的 collections.deque 就是一个双端对列的实现。

## 2. 实现
跟栈一样，队列可以用数组来实现，也可以用链表来实现。用数组实现的队列叫作顺序队列，用链表实现的队列叫作链式队列。

基于链表的实现方式，可以实现一个支持无限排队的无界队列（unbounded queue），但是可能会导致过多的请求排队等待，请求处理的响应时间过长。所以，针对响应时间比较敏感的系统，基于链表实现的无限排队的线程池是不合适的。

而基于数组实现的有界队列（bounded queue），队列的大小有限，所以线程池中排队的请求超过队列大小时，接下来的请求就会被拒绝，这种方式对响应时间敏感的系统来说，就相对更加合理。不过，设置一个合理的队列大小，也是非常有讲究的。队列太大导致等待的请求太多，队列太小会导致无法充分利用系统资源、发挥最大性能。


### 2.1 顺序队列
顺序队列的实现需要两个指针，head 指针指向队列头部，tail 指针指向队列尾部，即下一个入队元素将被保存的位置索引。显然随着不断的入队，出队 tail 指针出超过数组的索引范围，此时即便数组还有空闲位置也无法继续添加数据。此时借鉴在数组删除中介绍的方法，如果没有空间，我们只需要在下一次入队时集中触发以此数据移动操作，队列中的数据集中移动数组最前方即可。另一种解决方案则是使用循环队列。

![linkedlist](/images/algo/queue/queue_move.jpg)

```python
class ArrayQueue(object):
    __CAPACITY__ = 10

    def __init__(self):
        self.head = self.tail = 0
        self._capacity = self.__CAPACITY__
        self._buf = [0] * self._capacity

    def __len__(self):
        return self.tail - self.head

    def is_empty(self):
        return len(self) == 0

    def is_end(self):
        return self.tail == self._capacity

    def is_full(self):
        return len(self) == self._capacity

    def enqueue(self, value):
        if self.is_full():
            self._resize(self._capacity * 2)
        elif self.is_end():
            self._move()
        self._buf[self.tail] = value
        self.tail += 1

    def dequeue(self):
        if self.is_empty():
            raise ValueError('queue is empty')
        h = self._buf[self.head]
        self._buf[self.head] = 0
        self.head += 1
        if len(self) < self._capacity / 4:
            self._resize(self._capacity / 2)
        return h

    def _resize(self, size):
        buf = [0] * size
        base = len(self)
        for i in range(base):
            vi = self.head + i
            buf[i] = self._buf[vi]
        self._capacity = size
        self._buf = buf
        self.head = 0
        self.tail = base

    def _move(self):
        i = 0
        base = len(self)
        while i < base:
            self._buf[i] = self._buf[self.head + i]
            i ++
        self.head = 0
        self.tail = base

```


### 2.2 链式队列
基于单链表的队列，我们在链表那一章已经包含在单链表的实现中。这里我们就基于双链表来实现一个队列，也把之前遗留的循环链表的实现补上。

```python
class LinkedCircularQueue(object):
    class _Node(object):
        __slots__ = "_element", "_next", "_pre"

        def __init__(self, element, nxt=None):
            self._element = element
            self._next = nxt

    def __init__(self):
        self._tail = None
        self._size = 0

    def __len__(self):
        return self._size

    def is_empty(self):
        return self._size == 0

    def dequeue(self):
        if self.is_empty():
            raise ValueError('queue is empty')
        self._size -= 1
        node = self._tail._next
        if self.is_empty():
            self._tail = None
        else:
            self._tail._next = node._next
        node._next = None
        value = node.element
        return value

    def enqueue(self, value):
        node = self._Node(value)
        if self.is_empty():
            node._next = node
        else:
            node._next = self._tail._next
            self._tail._next = node
        self._tail = node
        self._size += 1

```

### 2.3 循环对列
循环对列与顺序队列类似，但是通过循环利用底层的数组有效的避免了数据移动。循环队列实现相比顺序队列更复杂，有以下几点需要注意:
1. 追加到队尾的元素的位置不在是 tail 而是要判断 tail 是否大于 n，如果大于插入位置则为 `tail % n`，同时更新 tail 应该更新为 `tail % n + 1`
2. 队空的条件仍然是 `tail == head` 但是队列满的条件则为 `(tail + 1) % n == head`

下面是另外一种类似的实现方式，记录头节点和队列中的元素个数，而不是尾节点，个人觉得这种实现方式更加直观。

```python
class ArrayCircularQueue(object):
    __CAPACITY__ = 10

    def __init__(self):
        self._head = 0
        self._size = 0
        self._capacity = self.__CAPACITY__
        self._buf = [0] * self._capacity

    def __len__(self):
        return self._size

    def is_empty(self):
        return self._size == 0

    def is_full(self):
        return self._size == len(self._buf)

    def enqueue(self, value):
        if self.is_full():
            self._resize(self._capacity * 2)
        vi = (self._head + self._size) % self._capacity
        self._buf[vi] = value
        self._size += 1

    def dequeue(self):
        if self.is_empty():
            raise ValueError('queue is empty')
        value = self._buf[self._head]
        self._buf[self._head] = 0
        self._head = (self._head + 1) % self._capacity
        if self._size < self._capacity / 4:
            self._resize(self._capacity / 2)
        self._size -= 1
        return value

    def _resize(self, size):
        buf = [0] * size
        for i in range(self._size):
            vi = (i + self._head) % self._capacity
            buf[i] = self._buf[vi]
        self._capacity = size
        self._buf = buf
        self._head = 0

```

### 2.4 双端对列
链表那一章，我们实现了一个双向链表，在此基础上我们来实现一个双端队列。前面对双向链表的抽象实现是非常重要的，因为我们后面很多数据结构都是建立在双向链表的基础上。

```python
from double_link import DoubleLink


class LinkedDeque(DoubleLink):
    def __init__(self):
        super(LinkedDeque, self).__init__()

    def insert_first(self, value):
        self.insert_between(value, self._head, self._head._next)

    def insert_last(self, value):
        self.insert_between(value, self._tail._pre, self._tail)

    def delete_first(self):
        if self.is_empty():
            raise ValueError('Deque is empty')
        self.delete_node(self._head._next)

    def delete_last(self):
        if self.is_empty():
            raise ValueError('Deque is empty')
        self.delete_node(self._tail._pre)

```

### 2.5 并发对列
一个基于 CAS 的无锁并发队列实现起来是很复杂的，我们暂时先把这个放一放，在这个系列的结尾会用专门的一篇文章来讲解实现。


**参考:**
- [王争老师专栏-数据结构与算法之美](https://time.geekbang.org/column/126)
- [《数据结构与算法：python语言实现》](https://book.douban.com/subject/30323938/)
