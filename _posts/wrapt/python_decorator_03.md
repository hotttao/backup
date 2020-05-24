---
title: 03 使用工厂函数创建装饰器
date: 2018-05-12
categories:
    - Python
tags:
    - wrapt
---
![Python decorator](/images/python/decorator.jpg)
上一篇文章描述了一种基于代理对象创建装饰器的模式，并且通过将装饰器实现为一个描述符，解决了当装饰器应用于类方法时，对象绑定问题。代理对象和描述符的组合自动确保了内省机制能正常进行。现在的问题是如何消除样本代码来解决代码复用的问题。
<!-- more -->
本文我们将进一步改进创建装饰器的方式，通过使用装饰器工厂函数，来抽象装饰器的创建，用户只需提供一个执行所需功能的的包装函数即可。


## 1. 装饰器的实现模式
如前所述，我们需要一个代理对象，其实现如下

```python
class object_proxy(object):

    def __init__(self, wrapped):
        self.wrapped = wrapped
        try:
            self.__name__= wrapped.__name__
        except AttributeError:
            pass

    @property
    def __class__(self):
        return self.wrapped.__class__  

    def __getattr__(self, name):
        return getattr(self.wrapped, name)
```

正如最后一次指出的那样，这是对它所做事情的最小表示。一个通用的对象代理需要做更多的工作。

描述符本身将按照如下模式实现

```python
class bound_function_wrapper(object_proxy):

    def __init__(self, wrapped):
        super(bound_function_wrapper, self).__init__(wrapped)

    def __call__(self, *args, **kwargs):
        return self.wrapped(*args, **kwargs)

class function_wrapper(object_proxy):

    def __init__(self, wrapped):
       super(function_wrapper, self).__init__(wrapped)

    def __get__(self, instance, owner):
        wrapped = self.wrapped.__get__(instance, owner)
        return bound_function_wrapper(wrapped)

    def __call__(self, *args, **kwargs):
        return self.wrapped(*args, **kwargs)
```

当将装饰器应用于一个正常的函数时，将使用包装器的 `__call__()`方法。如果将包装器应用于类的方法，则在属性访问时调用 `__get__()` 方法，返回一个新的绑定对象之后的装饰器，并在被调用时调用新的装饰器的`__call__()`方法。这使得我们的包装器能作为描述符来传递描述符协议，以根据需要对包装的对象进行绑定。

## 2. 创建装饰器的装饰器
正常工作的装饰器有一个固定的实现模式，因此，我们可以使用工场函数抽象装饰器创建的过程，工厂函数可以作为一个装饰器使用，创建一个装饰器的过程如下:

```python
@decorator
def my_function_wrapper(wrapped, args, kwargs):
    return wrapped(*args, **kwargs)

@my_function_wrapper
def function():
    pass
```

这个装饰器工厂函数 decorator 应该怎么实现呢？就像表现的一样，我们的装饰器工厂函数是非常简单的，与`partial()`函数并没有很大不同，在装饰器定义时接收用户提供的**包装函数**，在装饰器应用时接收**被包装函数**，并将他们传递到`function wrapper`对象中。

```python
def decorator(wrapper):
    @functools.wraps(wrapper)
    def _decorator(wrapped):
        return function_wrapper(wrapped, wrapper)
    return _decorator

```

我们现在只需要修改我们的装饰器 `function wrapper` 对象的实现，将包装对象的实际执行委托给用户提供的包装函数。

```python
class bound_function_wrapper(object_proxy):

    def __init__(self, wrapped, wrapper):
        super(bound_function_wrapper, self).__init__(wrapped)
        self.wrapper = wrapper

    def __call__(self, *args, **kwargs):
        return self.wrapper(self.wrapped, args, kwargs)

class function_wrapper(object_proxy):

    def __init__(self, wrapped, wrapper):
        super(function_wrapper, self).__init__(wrapped)
        self.wrapper = wrapper

    def __get__(self, instance, owner):
        wrapped = self.wrapped.__get__(instance, owner)
        return bound_function_wrapper(wrapped, self.wrapper)

    def __call__(self, *args, **kwargs):
        return self.wrapper(self.wrapped, args, kwargs)
```
`function_wrapper` 和 `bound_function_wrapper` 同时接收包装函数，和被包装函数，并将 `__call__()` 实际执行委托给用户提供的包装函数，由用户调用被包装函数并返回值。

因此，我们可以使用工厂来简化创建装饰器的过程。现在让我们来检查一下，在所有的情况下，这将在实际工作中发挥作用，并且看看我们还能找到什么其他的问题，以及我们是否能在这些情况下改进。

## 3. 装饰类方法
第一个可能导致问题的领域是创建一个单独的decorator，它可以同时处理类的正常函数和实例方法。为了测试我们的新decorator是如何工作的，我们可以在调用包装函数时打印传递给包装器的args，并可以比较结果。

```python
@decorator
def my_function_wrapper(wrapped, args, kwargs):
    print('ARGS', args)
    return wrapped(*args, **kwargs)
```

首先让我们尝试包装一个普通函数:

```python
@my_function_wrapper
def function(a, b):
    pass

>>> function(1, 2)
ARGS (1, 2)
```

正如所期望的那样，在函数被调用时，只有两个参数被输出。包装一个实例方法会如何？

```python
class Class(object):
    @my_function_wrapper
    def function_im(self, a, b):
        pass

c = Class()

>>> c.function_im()
ARGS (1, 2)
```

同样，当调用实例方法时传入的两个参数被输出。因此，装饰器对正常函数和实例方法的工作方式是相同的。

这里的问题是，用户如何在他们的包装函数中获取类的实例。当函数被绑定到类的实例时，我们丢失了这个信息，因为类实例现在与传入的绑定函数关联，而不是参数列表。要解决这个问题，我们可以记住在调用绑定函数时传递给 `__get__()` 方法的实例是什么。在 bound wrapper被创建，作为参数传递给bound wrapper。

```python
class bound_function_wrapper(object_proxy):

    def __init__(self, wrapped, instance, wrapper):
        super(bound_function_wrapper, self).__init__(wrapped)
        self.instance = instance
        self.wrapper = wrapper

    def __call__(self, *args, **kwargs):
        return self.wrapper(self.wrapped, self.instance, args, kwargs)

class function_wrapper(object_proxy):

    def __init__(self, wrapped, wrapper):
        super(function_wrapper, self).__init__(wrapped)
        self.wrapper = wrapper

    def __get__(self, instance, owner):
        wrapped = self.wrapped.__get__(instance, owner)
        return bound_function_wrapper(wrapped, instance, self.wrapper)

    def __call__(self, *args, **kwargs):
        return self.wrapper(self.wrapped, None, args, kwargs)
```

在bound wrapper中，类实例作为额外的参数传给用户创建的包装函数。对于普通函数，在顶级包装器中，对于这个新的实例参数，我们没有传递任何内容。现在，我们可以修用户的包装函数，以输出实例和传递的参数。

```python
@decorator
def my_function_wrapper(wrapped, instance, args, kwargs):
    print('INSTANCE', instance)
    print('ARGS', args)
    return wrapped(*args, **kwargs)

>>> function(1, 2)
INSTANCE None
ARGS (1, 2)

>>> c.function_im(1, 2)
INSTANCE <__main__.Class object at 0x1085ca9d0>
ARGS (1, 2)
```

因此，这种变化能让我们在包装器函数中区分出一个普通函数调用和一个的实例方法调用。对实例的引用甚至是单独传递的，在调用原始被包装函数时，我们不必为一个实例方法去判断并移除额外的类实例参数。对于类，原始的被包装函数已经是绑定对象，所以不能在传入类实例对象。

需要注意的是实例方法可以通过类，显示传递类实例来调用，我们需要验证这种情况是否仍然符合我们的要求。

```python
>>> Class.function_im(c, 1, 2)
INSTANCE None
ARGS (<__main__.Class object at 0x1085ca9d0>, 1, 2)
```

不幸的是，将实例显式地传递给类中的函数作为参数时，类实例没有通过 `instance` 传递给包装函数，而是作为 arg 的第一个参数被传递。这并不是一个理想的结果

为了处理这种变化，我们可以在调用`bound_function_wrapper.__call__()`之前检查实例，并从参数列表的开头弹出实例。然后使用 `partcial` 函数将实例绑定到被包装函数上，并调用用户的包装函数。

```python
class bound_function_wrapper(object_proxy):

    def __call__(self, *args, **kwargs):
        if self.instance is None:
            instance, args = args[0], args[1:]
            wrapped = functools.partial(self.wrapped, instance)
            return self.wrapper(wrapped, instance, args, kwargs)
        return self.wrapper(self.wrapped, self.instance, args, kwargs)

# We then get the same result no matter whether the instance method is called via the class or not.

>>> Class.function_im(c, 1, 2)
INSTANCE <__main__.Class object at 0x1085ca9d0>
ARGS (1, 2)
```

对于实例方法，一切都可以正常执行，被包装函数无论是实例方法和还是普通函数接收参数完全相同。得益与 instance 参数，在将装饰器应用于实例方法时，我们可以按需调用类方法。

对于类可以拥有的其他方法类型，特别是类方法和静态方法会怎样？

```python
class Class(object):

    @my_function_wrapper
    @classmethod
    def function_cm(cls, a, b):
        pass

>>> Class.function_cm(1, 2)
INSTANCE 1
ARGS (2,)
```

正如所看见得，装饰器对类方法和静态方法有非常严重得问题。这两种情况下，在函数被绑定时，instance 参数将为空。此时传递给函数的第一实参将被传递给 instance，这显然是不正确的，应该怎么做？

## 4. 通用装饰器
所以我们并没有完成一个通用的装饰器，但我们到底想要达到什么目的呢?我们最初的装饰模式有什么问题?这里的终极目标是我所说的“通用装饰器”。一个可以应用于普通函数、实例方法、类方法、静态方法甚至是类的修饰符，修饰符能够在使用的时候自动适用它被使用的上下文。

目前为止，实现装饰器的所有方法想达到上述目标是不可能了。只能通过复制代码，或者通过某种技巧转换装饰器，以便装饰器能在不同的上下文中使用。我的目标是能实现如下功能:

```python
@decorator
def universal(wrapped, instance, args, kwargs):
    if instance is None:
        if inspect.isclass(wrapped):
            # class.
        else:
            # function or staticmethod.
    else:
        if inspect.isclass(instance):
            # classmethod.
        else:
            # instancemethod.
```

本文中，我们已经实现了让装饰器在普通函数和实例方法上正确执行，我们现在需要了解如何处理类方法、静态方法以及将装饰器应用于类的场景。本系列的下一篇文章将继续追求这个目标，并描述如何进一步调整我们的装饰器。
