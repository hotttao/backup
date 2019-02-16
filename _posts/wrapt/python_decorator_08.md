---
title: 08 将 @synchronized 实现为上下文管理器
date: 2018-05-29
categories:
    - Python
tags:
    - wrapt
    - 函数装饰器
---
![Python decorator](/images/python/decorator.jpg)

在前一篇文章中，我们描述了如何使用新的通用装饰器模式来实现Python的 `@synchronized` 同步原语装饰器。在Java提供的两个同步机制中，同步方法和同步原语，目前为止我们只实现了同步方法。本文将描述如何将其扩展为上下文管理器，从而等效的实现Java的同步原语。
<!-- more -->

## 1. @synchronized 当前实现
到目前为止，我们的@synchronized 装饰器的实现是。

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

通过确定装饰器被用于包装普通函数、实例方法或类的方法中的哪一个，我们可以在许多场景中使用同一一个装饰器。

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

我们现在想要实现的是让同步装饰器也能完成如下操作:

```python
class Object(object):  

    @synchronized
    def function_im_1(self):
        pass  

    def function_im_2(self):
        with synchronized(self):
            pass
```

也就是说，除了可以用作装饰器之外，它还能与with语句一起用作上下文管理器。通过这样做，它就能够对函数中的部分语句加锁，而不是整个函数。用作上下文管理器时，如果需要与实例方法同步，我们需要将把self参数或类实例传递给`synchronized`。如果需要与类方法同步，则传递类对象本身。

## 2. 将 function_wrapper 实现为上下文管里器
在现有的synchronized实现上，当使用synchronized作为函数调用时，它将返回函数包装器类的一个实例。

```python
>>> synchronized(None)
<__main__.function_wrapper object at 0x107b7ea10>
```

这个函数包装器没有实现作为上下文管理器的对象所需的`__enter__()`和`__exit__()`函数。函数包装器是我们自己的类，所以我们只需要创建子类并为其添加这两个方法即可。同时这个函数包装器的创建是在`@decorator`的定义中绑定的，所以我们需要绕过`@decorator`并直接使用函数包装器。因此，第一步是重写我们的 `@synchronized decorator`，不使用`@decorator`。

```python
def synchronized(wrapped):
    def _synchronized_lock(owner):
        lock = vars(owner).get('_synchronized_lock', None)

        if lock is None:
            meta_lock = vars(synchronized).setdefault(
                    '_synchronized_meta_lock', threading.Lock())

            with meta_lock:
                lock = vars(owner).get('_synchronized_lock', None)
                if lock is None:
                    lock = threading.RLock()
                    setattr(owner, '_synchronized_lock', lock)

        return lock

    def _synchronized_wrapper(wrapped, instance, args, kwargs):
        with _synchronized_lock(instance or wrapped):
            return wrapped(*args, **kwargs)

    return function_wrapper(wrapped, _synchronized_wrapper)
```

这与我们最初的实现相同，但是我们现在可以访问到创建函数包装器对象 `function_wrapper`。因此我们可以创建一个满足上下文管里器协议的 `function_wrapper` 的子类来替换 `function_wrapper`。

```python
def synchronized(wrapped):
    def _synchronized_lock(owner):
        lock = vars(owner).get('_synchronized_lock', None)

        if lock is None:
            meta_lock = vars(synchronized).setdefault(
                    '_synchronized_meta_lock', threading.Lock())

            with meta_lock:
                lock = vars(owner).get('_synchronized_lock', None)
                if lock is None:
                    lock = threading.RLock()
                    setattr(owner, '_synchronized_lock', lock)

        return lock

    def _synchronized_wrapper(wrapped, instance, args, kwargs):
        with _synchronized_lock(instance or wrapped):
            return wrapped(*args, **kwargs)

    class _synchronized_function_wrapper(function_wrapper):

        def __enter__(self):
            self._lock = _synchronized_lock(self.wrapped)
            self._lock.acquire()
            return self._lock

        def __exit__(self, *args):
            self._lock.release()

    return _synchronized_function_wrapper(wrapped, _synchronized_wrapper)
```

## 3. 两种调用方式
当 `synchronized` 作为装饰器使用时，新的`function wrapper`子类被用于包装被包装函数和方法。当函数或类方法被调用时，`function wrapper` 基类中的 `__call__` 方法被调用。装饰器将在尝试获取锁之后执行被包装函数。

当synchronized作为上下文管里器使用时。子类将用于包装类实例或类本身。没有方法会被调用，取而代之的是在进入上下文时，`__enter__()` 会获取锁，离开上下文时，`__exit__()` 会释放锁。

与在之前的文章中形容的复杂度相比，现在的实现简单明了。

## 4. 不只是个装饰器
希望这能说明的一点是，尽管`@decorator`被用来创建自定义装饰器，但这并不总是最合适的方式。`function wrapper` 对象的单独存在为修改被包装对象的行为提供了很大的灵活性。在某些情况下，还可以直接删除和使用对象代理。所有这些都提供了一个通用的工具集，用于进行任何类型的包装或修补，而不仅仅是用于装饰。现在，我将开始将这一系列博客文章的焦点转移到更一般的包装和猴子补丁上。

在此之前，在下一篇文章中，我将首先讨论与使用函数闭包实现装饰器的更传统方式相比，使用 `function wrapper` 隐含的性能影响。以及使用Python C扩展实现完整的对象代理和 `function wrapper` 后，性能改善的大小。
