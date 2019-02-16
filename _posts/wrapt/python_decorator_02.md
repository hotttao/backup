---
title: 02 装饰器与描述符协议
date: 2018-05-08
categories:
    - Python
tags:
    - wrapt
    - 函数装饰器
---
![Python decorator](/images/python/decorator.jpg)
上一篇文章说明了普通函数实现的装饰器存在的问题。本文我们将着眼于之前阐述的最后一个问题，如何将装饰器应用到一个描述符上。
<!-- more -->

## 1. 描述符协议
有关 Python 的对象模型和底层设计原理推荐大家读一读《流畅的Python》，这里不会详细解释描述符是什么以及他们的工作原理。简而言之，描述符就是存在绑定行文的对象，即属性访问会被描述符协议实现的方法所覆盖。实现描述符协议的特殊方法包括 `__get__()`, `__set__()`, 和 `__delete__()`。如果任意一中方法在一个对象中被定义，就可以说该对象是一个描述符**

```python
obj.attribute                  attribute.__get_(obj.type(obj))
obj.attribute = value          attribute.__set_(obj, value)
del obj.attribute              attribute.__delete_(obj, value)
```

上述描述的是，如果一个类的属性包含上述任意一中特殊方法，当相应操作在类属性被执行时，这些特殊方法将取代默认方法被调用。这就允许一个属性去覆盖将发生默认操作。

也许你以为你从未使用过描述符，事实上，函数对象就是描述符。当在类中定义函数时，函数就是普通的函数。当你通过'.'属性访问函数时，你将调用函数的 `__get__()`方法，将函数与一个类实例绑定，进而返回一个绑定方法对象**

```python
def f(obj): pass

>>> hasattr(f, '__get__')
True

>>> f
<function f at 0x10e963cf8>

>>> obj = object()

>>> f.__get__(obj, type(obj))
<bound method object.f of <object object at 0x10e8ac0b0>>
```

所以当你调用类方法时，调用的不是原始函数的 `__call__()`，而是访问函数时临时创建的绑定方法对象的 `__call__()` 方法，当然，你通常不会看到所有这些中间步骤，只看到结果。

```python
>>> class Object(object):
...   def f(self): pass

>>> obj = Object()

>>> obj.f
<bound method Object.f of <__main__.Object object at 0x10abf29d0>>
```

现在回想一下在第一个博客文章中给出的例子，当我们对一个类方法应用了装饰器时，我们遇到了如下错误:

```python
class Class(object):
    @function_wrapper
    @classmethod
    def cmethod(cls):
        pass

>>> Class.cmethod()
Traceback (most recent call last):
  File "classmethod.py", line 15, in <module>
    Class.cmethod()
  File "classmethod.py", line 6, in _wrapper
    return wrapped(*args, **kwargs)
TypeError: 'classmethod' object is not callable
```

示例中的问题在于 `@classmethod` 装饰器返回的 classmethod 对象本身并没有 `__call__()` 方法，`__call__()` 方法仅存在于 classmethod 对象`__get__()`被调用时返回的结果中。

更具体的说， 人们使用的简单装饰器，并没有对被包装的描述符对象执行描述符协议以产生的一个可调用对象。想反，只是简单的直接调用被包装对象。因为其没有 `__call__()` 方法，结果当然会失败。

那为什么将装饰器应用在普通的实例方法上仍然可以运行呢？原因是一个普通函数本身具有 `__call__()` 方法，包装函数直接调用的是此方法。而且尽管绑定步骤被跳过，但是包装函数将 `self` 包含的实例对象通过第一参数显示传递给了原始的未绑定函数对象。因此对于一个普通的实例方法包装前后调用实际上是相同的，只有当被包装的对象(如`@classmethod`)依赖于正确应用的描述符协议时，才会崩溃。

## 2. 包装描述符对象
解决包装器不能在类方法执行描述符协议获取绑定对象的方法是，让包装器也成为一个描述符对象。

```python
class bound_function_wrapper(object):
    def __init__(self, wrapped):
        self.wrapped = wrapped
    def __call__(self, *args, **kwargs):
        return self.wrapped(*args, **kwargs)

class function_wrapper(object):
    def __init__(self, wrapped):
        self.wrapped = wrapped
    def __get__(self, instance, owner):
        wrapped = self.wrapped.__get__(instance, owner)
        return bound_function_wrapper(wrapped)
    def __call__(self, *args, **kwargs):
        return self.wrapped(*args, **kwargs)
```

如果将包装器应用于一个正常的函数，则使用包装器的 `__call__()`方法。如果将包装器应用于类的方法，则调用`__get__()`方法，该方法返回一个新的绑定包装器，并调用该方法的 `__call__()` 方法。这样我们的包装器就可以在描述符的传播过程中使用。

因为将装饰器实现为一个描述符对象时，使用闭包总是会失败，因此这种情况下为了让所有的事都能正常工作，我们必需总是使用类实现装饰器。装饰器类将实现描述符协议，如上所式。

现在的问题是，我们如何解决我们列出的其他问题。我们使用`functools.wrap()` 和 `functools.update_wrapper()` 解决命名问题，现在我们应该怎么做以便继续使用他们。因为 `functools.wrap()` 内部使用 `update_wrapper()`,所以我们只需要看看它如何实现。

```python
WRAPPER_ASSIGNMENTS = ('__module__',
       '__name__', '__qualname__', '__doc__',
       '__annotations__')
WRAPPER_UPDATES = ('__dict__',)

def update_wrapper(wrapper, wrapped,
        assigned = WRAPPER_ASSIGNMENTS,
        updated = WRAPPER_UPDATES):
    wrapper.__wrapped__ = wrapped
    for attr in assigned:
        try:
            value = getattr(wrapped, attr)
        except AttributeError:
            pass
        else:
            setattr(wrapper, attr, value)
    for attr in updated:
        getattr(wrapper, attr).update(
                getattr(wrapped, attr, {}))
```

如上展示的是Python3.3中的代码，事实上它还存在一个bug，在Python3.4中已经修复。

在函数体中，3件事需要被做。
1. 第一件是将被包装函数保存为包装函数的`__wrapped__`属性。这就是那个bug，因为它应该在最后实现
2. 第二步，复制诸如 `__name__` 和 `__doc__` 属性；
3. 最后一步，复制被包装函数__dict__属性值到包装函数，结果是很多对象需要被复制

如果我们使用的是一个函数闭包或直接的类包装器，那么这个复制就可以在decorator应用的时候完成。当装饰器被实现为描述符时，也需要在 bound wrapper 中完成上述工作。

```python
class bound_function_wrapper(object):
    def __init__(self, wrapped):
        self.wrapped = wrapped
        functools.update_wrapper(self, wrapped)

class function_wrapper(object):
    def __init__(self, wrapped):
        self.wrapped = wrapped
        functools.update_wrapper(self, wrapped)
```

因为bound wrapper 在包装器每次被作为类的绑定方法调用时都会被创建，所有将非常慢。我们需要更高效的方式处理它。

## 2. 代理对象
性能问题的解决方法是，使用代理对象。这是一个特殊的包装类，因为它的行为跟它包装的东西看起来很像。

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

一个完全透明的对象代理本身就是一个复杂的怪物，所以我打算暂时把细节掩盖起来，并在一个单独的博客文章中讨论它。上面的例子是它所做事情的最小表示。实际上，它实际上需要做更多的工作。简而言之，它将有限的属性从包装的对象复制到自身，并使用特殊的方法、属性和 `__getattr__()` 来从包装对象中获取属性，从而避免需要复制许多可能永远不会被访问的属性。

我们现在要做的是从对象代理中派生出包装器类，并取消调用`update_wrapper()`。

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

现在从包装器中查询像 `__name__` 和 `__doc__` 这样的属性时，将从被包装函数直接返回。使用透明的对象代理也意味着像  `inspect.getargspec()` 和 `inspection.getsource()` 这样的调用也将按照预期正常工作。

## 3. 代码复用
尽管这种模式解决了最初确定的问题，但它包含了大量的重复样板代码。此外，在现在的代码中有两个位置，调用被包装函数。因而需要在两个地方重复实现包装逻辑。因此，每次需要实现一个装饰器时都要复制这一点，因此会有点痛苦。

我们可以做的是将整个过程打包到一个装饰器工厂函数中，从而避免每次都需要手工完成这一切。如何做到这一点将成为本系列下一篇博客文章的主题。从这一点开始，我们可以开始研究如何进一步改进功能，并引入新的功能，这些都是使用常规的装饰器实现方法难以实现的。
