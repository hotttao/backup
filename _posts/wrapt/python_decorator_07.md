---
title: 07 实现 java 的 @synchronized 装饰器
date: 2018-05-26
categories:
    - Python
tags:
    - wrapt
---
![Python decorator](/images/python/decorator.jpg)

在之前的博客中，我们讨论了装饰器的实现，并实现了一个通用装饰器模式。作为这种模式的使用示例，本节我们来实现 java 中的 `@synchronized` 装饰器。
<!-- more -->

## 1. Java @synchronized 装饰器
java 的同步原语有两种形式，分别是同步方法和同步代码块。在Java 中创建同步方法，只需要在其定义时添加synchronized关键字即可。

```java
public class SynchronizedCounter {
    private int c = 0;
    public synchronized void increment() {
        c++;
    }
    public synchronized void decrement() {
        c--;
    }
    public synchronized int value() {
        return c;
    }
}
```
使一个方法同步意味着不可能在**同一个对象**上同时调用多个同步方法。当一个线程正在执行一个对象的同步方法时，所有其他调用相同对象的同步方法的线程将阻塞直至当前同步方法调用完成。

换句话说，类的每个实例都有一个内在的锁对象，并且在进入一个方法时，锁会被获取，当方法返回时它会被释放。锁是所谓的重入锁，这意味着线程可以在它持有锁的同时，再次获得它，而不会阻塞。正因为如此，一个同步的方法可以调用同一个对象上的另一个同步方法。

在Java中创建同步代码的第二种方法是同步代码块。与同步方法不同，同步代码块必须指定提供内在锁的对象。

```java
public void addName(String name) {
    synchronized(this) {
        lastName = name;
        nameCount++;
    }
    nameList.add(name);
}
```

值得注意的是，在Java中，可以使用任何对象作为锁的源，不需要创建特定锁类型的实例来同步。如果在类中需要更细粒度的锁，那么可以简单地创建或使用现有的任意对象进行同步。

```java
public class MsLunch {
    private long c1 = 0;
    private long c2 = 0;
    private Object lock1 = new Object();
    private Object lock2 = new Object();
    public void inc1() {
        synchronized(lock1) {
            c1++;
        }
    }
    public void inc2() {
        synchronized(lock2) {
            c2++;
        }
    }
}
```

这些同步原语使用起来相对简单，因此，如何才能通过装饰器在Python中让类似操作以同样简单的方式实现呢。


## 2.同步线程的互斥锁
在Python中，不可能使用任意对象做同步。相反必要创建一个特定的锁对象，该对象内部持有一个线程互斥锁。锁对象提供了一个 `acquire()`和`release()` 方法来操作锁。同时由于上下文管理器被引入到 Python 中，所以锁也支持与with语句一起使用。使用这个特定的特性，用于实现Python的`@synchronized` 装饰器的典型实现是:

```python
def synchronized(lock=None):
    def _decorator(wrapped):
        @functools.wraps(wrapped)
        def _wrapper(*args, **kwargs):
            with lock:
                return wrapped(*args, **kwargs)
        return _wrapper
    return _decorator

lock = threading.RLock()

@synchronized(lock)
def function():
    pass
```
使用此方法在一段时间后变得很烦人，因为对于需要同步的每个不同的函数，必须首先创建一个线程锁。替代方法是，为每个装饰器自动创建一个线程锁。

```python
def synchronized(wrapped):
    lock = threading.RLock()
    @functools.wraps(wrapped)
    def _wrapper(*args, **kwargs):
        with lock:
            return wrapped(*args, **kwargs)
    return _wrapper

@synchronized
def function():
    pass
```

我们甚至可以使用前面描述的模式，为每次调用提供一个可选的参数

```python
def synchronized(wrapped=None, lock=None):
    if wrapped is None:
        return functools.partial(synchronized, lock=lock)
    if lock is None:
        lock = threading.RLock()
    @functools.wraps(wrapped)
    def _wrapper(*args, **kwargs):
        with lock:
            return wrapped(*args, **kwargs)
    return _wrapper

@synchronized
def function1():
    pass

lock = threading.Lock()

@synchronized(lock=lock)
def function2():
    pass
```

无论方法如何，基于函数闭包的装饰器都会遇到我们已经列出的所有问题。因此，我们可以采取的第一步是使用我们新的装饰器工厂函数替代它。

```python
def synchronized(wrapped=None, lock=None):
    if wrapped is None:
        return functools.partial(synchronized, lock=lock)

    if lock is None:
        lock = threading.RLock()

    @decorator
    def _wrapper(wrapped, instance, args, kwargs):
        with lock:
            return wrapped(*args, **kwargs)

    return _wrapper(wrapped)
```

因为使用了我们的装饰器工厂函数，这意味着相同的代码可以安全的应在实例、类或静态方法上。需要强调的是在类方法上使用此装饰器看似简单，但并不是很有用。因为锁仅仅对被装饰的方法有用，并且会对类的所有实例在同一方法上施加同步锁。这并不是我们想要的，也不能同java的同步方法相对应。

在次重申我们要实现的目标是，被装饰器标识为同步的所有实例方法，我们希望每个类实例都有一个独立的同步锁来实现实例内的方法同步。不同类实例之间不要同步。

过去已经有一些文章描述了如何改进这一点，包括这个很复杂的尝试。个人觉得它的实现方式是相当笨拙的，甚至怀疑它实际上不是线程安全的，因为在创建一些锁的过程中有一个竞争条件。因为它使用了函数闭包，并且没有我们的通用装饰器的概念，所以还需要创建大量不同的装饰器，然后在一个装饰器入口点上尝试将它们整合在一起。显然，我们现在应该能够做得更好。

## 3. 将互斥锁存储在被包装对象上
解决这个问题的关键在于我们可以在哪里存储线程锁。在被包装对象调用之间存储任何数据的惟一选项将是被包装对象本身，包括被包装的函数，类实例方法和类方法。因此相对于需要传入锁，或者在函数闭包中创建锁，让我们尝试在包装器本身中的创建和管理锁。**

首先考虑一个正常函数的情况。在这种情况下，我们所能做的就是将所需的线程锁存储在包装的函数对象本身上。

```python
@decorator
def synchronized(wrapped, instance, args, kwargs):
    lock = vars(wrapped).get('_synchronized_lock', None)
    if lock is None:
        lock = vars(wrapped).setdefault('_synchronized_lock', threading.RLock())
    with lock:
        return wrapped(*args, **kwargs)

@synchronized
def function():
    pass

>>> function()
>>> function._synchronized_lock
<_RLock owner=None count=0>
```

我们要处理的一个关键问题是如何第一次创建线程锁。为此我们需要做的是查看线程锁是否已被创建。**

`lock = vars(wrapped).get('_synchronized_lock', None)`

如果返回一个有效的线程锁对象，那么我们就可以继续尝试获取锁。如果锁不存在我们需要创建锁,但是我们必需小心避免竞态条件，因为当两个线程同时进入这部分代码时，它们都会判断需要第一次创建锁。我们用来解决这个问题的窍门是:

`lock = vars(wrapped).setdefault('_synchronized_lock', threading.RLock())`

当两个线程同时尝试创建锁时，它们都可能创建一个锁实例，但是由于使用了dict.setdefault()，只会有一个进程会成功。因为 `dict.setdefault()` 总是返回它第一次存储的值。所以所有的线程都会继续运行并且尝试获取相同的锁对象。其中一个线程对象会被丢弃也不存在任何问题，因为这只会在初始化并出现竞争条件时才会发生。

因此，我们已经成功地复制了最初的内容，不同之处在于线程锁存储在被包装的函数上，而不是存储在一个封闭函数的堆栈上。我们仍然有一个问题，即每个实例方法都有一个不同的锁。(而不是一个实例内的所有同步方法共用一个锁)。简单的解决方案是利用我们的通用装饰器，它提供了判断装饰器被使用的上下文的能力。

具体点说，我们需要判断当前是否在装饰一个类方法或实例方法，如果是，则将锁对象存储在 instance 参数上。

```python
@decorator
def synchronized(wrapped, instance, args, kwargs):
    if instance is None:
        context = vars(wrapped)
    else:
        context = vars(instance)

    lock = context.get('_synchronized_lock', None)

    if lock is None:
        lock = context.setdefault('_synchronized_lock', threading.RLock())

    with lock:
        return wrapped(*args, **kwargs)

class Object(object):

    @synchronized
    def method_im(self):
        pass

    @synchronized
    @classmethod
    def method_cm(cls):
        pass

o1 = Object()
o2 = Object()

>>> o1.method_im()
>>> o1._synchronized_lock
<_RLock owner=None count=0>
>>> id(o1._synchronized_lock)
4386605392

>>> o2.method_im()
>>> o2._synchronized_lock
<_RLock owner=None count=0>
>>> id(o2._synchronized_lock)
4386605456
```

这个简单的改变实际上已经达到了我们想要的结果。如果同步的装饰器被用于一个正常的函数，那么线程锁将被存储在函数本身上，并且它将单独存在，并且只在调用相同的函数之间进行同步。

对于实例方法，线程锁将被存储在类的实例上，实例方法会绑定到类，因此在该类上标记为同步的任何实例方法都将在该线程锁上同步，从而模拟Java的行为

那类方法呢。在这种情况下，instance 参数实际上是类。如果线程锁被存储在类上，那么结果将是，如果有多个类方法，并且它们都被标记为synchronized，那么它们将相互排斥。这种情况下线程锁的使用方式将不同于实例方法，但这实际上也是我们想要的。

代码是否对类方法有效?

```python
>>> Object.method_cm()
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "test.py", line 38, in __call__
    return self.wrapper(self.wrapped, instance, args, kwargs)
  File "synctest.py", line 176, in synchronized
    lock = context.setdefault('_synchronized_lock'),
AttributeError: 'dictproxy' object has no attribute 'setdefault'
```

很不幸，有错。这种情况的原因是，类 `__dict__` 不是一个普通的字典，而是一个 `dictproxy` 。一个 `dictproxy` 不与普通的dict共享相同的方法，特别是它不提供`setdefault()`方法。因此，我们需要一种不同的方法来为类创建同步线程锁。`dictproxy` 还导致了另一个问题，即它不支持属性设置。但是类本身支持属性设置

```python
>>> vars(Object)['_synchronized_lock'] = threading.RLock()
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
TypeError: 'dictproxy' object does not support item assignment
```

```python
>>> setattr(Object, '_synchronized_lock', threading.RLock())
>>> Object._synchronized_lock
<_RLock owner=None count=0>
```

由于函数对象和类实例都可以，所以我们需要切换更新属性的方法。

## 4. 存储在装饰器上的元线程锁
作为`dict.setdefault()`第一次设置锁的原子方式的替代方法，我们可以做的是使用存储在`@synchronized` 装饰器本身上的元线程锁。由于元线程锁的创建仍存在竞争条件，因此需要使用`dict.setdefault()`实现元线程锁的原子性创建。

```python
@decorator
def synchronized(wrapped, instance, args, kwargs):
    if instance is None:
        owner = wrapped
    else:
        owner = instance

    lock = vars(owner).get('_synchronized_lock', None)

    if lock is None:
        meta_lock = vars(synchronized).setdefault(
                '_synchronized_meta_lock', threading.Lock())

        with meta_lock:
            lock = vars(owner).get('_synchronized_lock', None)
            if lock is None:
                lock = threading.RLock()
                setattr(owner, '_synchronized_lock', lock)

    with lock:
        return wrapped(*args, **kwargs)
```
请注意，由于对封装函数的锁存在的检查与创建元锁之间的间隙，在我们获得了元锁之后，我们需要再次检查锁是否存在。这是为了避免两个线程同时在尝试创建锁而发生竞争条件。

这里有一点很重要，我们仅仅在更新被包装对象上的锁时使用了属性访问方法。而在查找被包装对象上是否存在锁时，没有使用getattr()方法，而是继续在`vars()`返回的`__dict__`中查找它。这是必要的，因为当在类的实例上使用`getattr()`时，如果该属性在类的实例中不存在，那么查找规则意味着如果该属性在类本身上存在，那么将返回该属性。

如果一个同步的类方法是第一个被调用的，这会导致问题，因为它会在类本身上留下一个锁。当随后调用实例方法时，如果使用了`getattr()`，它会找到类类型的锁并返回它，并且会被错误地使用。因此，我们继续通过 `__dict__` 寻找锁，因为它只包含实例中实际存在的内容。

有了这些修改，所有锁的创建都可以自动完成，并在不同的上下文中创建一个适当的锁。

```python
@synchronized
def function():
    pass

class Object(object):

    @synchronized
    def method_im(self):
        pass

    @synchronized
    @classmethod
    def method_cm(cls):
        pass

o = Object()

>>> function()
>>> id(function._synchronized_lock)
4338158480

>>> Object.method_cm()
>>> id(Object._synchronized_lock)
4338904656

>>> o.method_im()
>>> id(o._synchronized_lock)
4338904592
```

代码也适用于在静态方法或类中使用@synchronized。综上所述，`@synchronized` 可以被应用的场景如下:

```python
@synchronized # lock bound to function1
def function1():
    pass

@synchronized # lock bound to function2
def function2():
    pass

@synchronized # lock bound to Class
class Class(object):

    @synchronized # lock bound to instance of Class
    def function_im(self):
        pass

    @synchronized # lock bound to Class
    @classmethod
    def function_cm(cls):
        pass

    @synchronized # lock bound to function_sm
    @staticmethod
    def function_sm():
        pass
```

## 5. 实现同步代码块
所以，我们已经完成了对同步方法的支持，如何实现同步代码块呢。要实现的目标是能按照下面的方式编写代码:

```python
class Object(object):

    @synchronized
    def function_im_1(self):
        pass

    def function_im_2(self):
        with synchronized(self):
            pass
```

也就是说，我们需要 `synchronized` 装饰器不仅可以用作装饰器，而且还可以作为上下文管理器使用。在`synchronized`作为上下文管理器时，类似于Java，需要提供给它执行同步操作的对象，对于实例方法而言，这个对象是 `self` 参数或者类的实例。为了解释我们如何做到这一点，需要等待下一篇文章。
