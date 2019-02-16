---
title: 05 带参数的装饰器
date: 2018-05-24
categories:
    - Python
tags:
    - wrapt
    - 函数装饰器
---
![Python decorator](/images/python/decorator.jpg)

在之前的博客，通过使用代理对象，装饰器工厂函数等技术，我们已经实现了一个通用装饰器。在这篇文章中，我们将使用前面文章中描述的装饰器工厂函数，介绍如何使用它来实现接受参数的装饰器，包括强制参数和可选的接收参数。
<!-- more -->

## 1. 装饰器创建模式
前面文章中描述的关键组件是一个函数包装器对象。我不打算复制代码，所以请参阅前面的帖子。简而言之，它是一个类类型，它接受要被包装的函数和一个用户提供的包装器函数。所得到的函数包装器对象的实例被用来代替被包装函数，当调用时，会将被包装函数的调用委托给用户提供的包装器函数。这允许用户修改调用的方式，在调用被包装函数之前或之后执行操作，或者修改输入参数或结果。`function_wrapper` 和装饰器工厂一起使用创建装饰器的方式如下:**

```python
# 装饰器工厂函数
def decorator(wrapper):
    @functools.wraps(wrapper)
    def _decorator(wrapped):
        return function_wrapper(wrapped, wrapper)
    return _decorator

# 使用工厂函数创建的装饰器
@decorator
def my_function_wrapper(wrapped, instance, args, kwargs):
    print('INSTANCE', instance)
    print('ARGS', args)
    print('KWARGS', kwargs)
    return wrapped(*args, **kwargs)

# 应用装饰器包装函数
@my_function_wrapper
def function(a, b):
    pass
```

在本例中，创建的最终装饰器不接受任何参数，但如果我们希望装饰器能够接受参数，在调用用户提供的包装器函数时可访问传入的参数，那么我们该如何做呢？

## 2. 使用函数闭包收集参数
最简单的实现一个能接收参数的装饰器的方式是使用函数闭包

```python
def with_arguments(arg):
    @decorator
    def _wrapper(wrapped, instance, args, kwargs):
        return wrapped(*args, **kwargs)
    return _wrapper

@with_arguments(arg=1)
def function():
    pass
```

实际上，外部函数本身是一个工厂函数，可根据传入的参数，返回不同的装饰器实例。因此，当外部工厂函数被应用到一个具有特定参数的函数时，它返回内部装饰器函数，实际上它是应用于被包装的函数。当包装器函数最终被调用时，它会调用被包装函数，并通过作为函数闭包的一部分来访问传递给外部工厂函数的原始参数。**

位置或关键字参数可以与外部装饰器工厂函数一起使用，但是我认为关键字参数可能是一个更好的惯例，我稍后会展示。现在，如果带有参数的装饰器具有默认值，使用这种方法来实现装饰器，即使不传递参数，也必需将其作为一个不同的调用来使用。也就是说，仍然需要提供空括号。

```python
def with_arguments(arg='default'):
    @decorator
    def _wrapper(wrapped, instance, args, kwargs):
        return wrapped(*args, **kwargs)
    return _wrapper

@with_arguments()
def function():
    pass
```

尽管这只是一个特例，但看起来不优雅。大多数更喜欢当所有参数都是可选，并没有被显示传递参数时，括号时可选的。换句话说，当没有参数被传递时，可以被写成

```python
@with_arguments
def function():
    pass
```

当我们从另一个角度看问题时，这个想法实际上是有价值的。如果一个装饰器最初不接收参数，但是之后又需要可选的接收参数。如果括号是可选的，那么原来不带参数调用装饰器的代码也无需改变。

## 3. 带可选参数的装饰器
允许装饰器添加可选参数，可以将上面的方法更改为:

```python
def optional_arguments(wrapped=None, arg=1):
    if wrapped is None:
        return functools.partial(optional_arguments, arg=arg)
    @decorator
    def _wrapper(wrapped, instance, args, kwargs):
        return wrapped(*args, **kwargs)

    return _wrapper(wrapped)

@optional_arguments(arg=2)
def function1():
    pass

@optional_arguments
def function2():
    pass
```

当具有默认的可选参数时，外部工厂函数将被包装函数作为第一个参数并默认为 None。第一次调用时，被包装函数是 None，通过 partical 函数再一次返回装饰器工厂函数。第二次调用，被包装函数将被传入并被装饰器包装。

将装饰器被直接装饰函数时，因为默认参数的存在，我们不需要显示传递参数。因为 wrapped 惨数值不是None，装饰器直接返回工厂函数，直接装饰函数。

此时工厂函数的参数必需是关键词参数，Python 3允许您使用新的关键字参数语法来强制使用关键词参数。

```python
def optional_arguments(wrapped=None, *, arg=1):
    if wrapped is None:
        return functools.partial(optional_arguments, arg=arg)  

    @decorator
    def _wrapper(wrapped, instance, args, kwargs):
        return wrapped(*args, **kwargs)

    return _wrapper(wrapped)
```

这样，就可以避免有人不小心将装饰器参数作为位置参数传递给 wrapped。对于一致性，关键字参数也可以被强制执行，即使它不是必需的。

```python
def required_arguments(*, arg):
    @decorator
    def _wrapper(wrapped, instance, args, kwargs):
        return wrapped(*args, **kwargs)
    return _wrapper  
```

## 4. 在调用之间保持状态
某些时候，装饰器可能需要在函数调用之间保持状态。一个典型的例子是缓存装饰器。此时，由于包装器函数本身没有任何状态收集器，所以只能借助于装饰器能够访问到的外部数据结构作为状态收集器进行状态保持。

有几种方法可以做到这一点。

第一个是将保持状态的对象作为显式参数传递给装饰器

```python
def cache(d):
    @decorator
    def _wrapper(wrapped, instance, args, kwargs):
        try:
            key = (args, frozenset(kwargs.items()))
            return d[key]
        except KeyError:
            result = wrapped(*args, **kwargs)
            return result
    return _wrapper

_d = {}

@cache(_d)
def function():
    return time.time()
```

除非有特定的需要能够传入状态对象，否则第二个更好的方法是在外部函数的调用中创建状态对象。

```python
def cache(wrapped):
    d = {}

    @decorator
    def _wrapper(wrapped, instance, args, kwargs):
        try:
            key = (args, frozenset(kwargs.items()))
            return d[key]
        except KeyError:
            result = d[key] = wrapped(*args, **kwargs)
            return result

    return _wrapper(wrapped)

@cache
def function():
    return time.time()
```

这种情况下，外部包装函数在函数内部自定状态对象，而不是通过参数显示传递。如果这是一个合理的默认值，但是在某些情况下，仍然需要将状态对象作为参数传递进来，那么可以使用可选的装饰数参数。

```python
def cache(wrapped=None, d=None):
    if wrapped is None:
        return functools.partial(cache, d=d)

    if d is None:
        d = {}

    @decorator
    def _wrapper(wrapped, instance, args, kwargs):
        try:
            key = (args, frozenset(kwargs.items()))
            return d[key]
        except KeyError:
            result = d[key] = wrapped(*args, **kwargs)
            return result

    return _wrapper(wrapped)

@cache
def function1():
    return time.time()

_d = {}

@cache(d=_d)
def function2():
    return time.time()

@cache(d=_d)
def function3():
    return time.time()
```

## 5. 使用类创建装饰器
在第一篇文章中，我们说过可以使用类实现装饰器。

```python
class function_wrapper(object):

    def __init__(self, wrapped):
        self.wrapped = wrapped

    def __call__(self, *args, **kwargs):
        return self.wrapped(*args, **kwargs)
```

就像之前已经阐述的，这种通过类实现的装饰器存在缺陷，但是作为一种替代模式，这种原始的方法也能保持状态。具体地说，类的构造函数可以将状态对象连同被包装函数保存为类实例的属性。

```python
class cache(object):

    def __init__(self, wrapped):
        self.wrapped = wrapped
        self.d = {}

    def __call__(self, *args, **kwargs):
        try:
            key = (args, frozenset(kwargs.items()))
            return self.d[key]
        except KeyError:
            result = self.d[key] = self.wrapped(*args, **kwargs)
            return result

@cache
def function():
    return time.time()
```

在装饰器逻辑特别复杂时，这种通过类实现的装饰器也存在一些好处。可以拆分封装在不同的类方法中。那么使用我们的新函数包装器和装饰器工厂，能否将装饰器实现为类呢？一种可能的方式是这样:

```python
class with_arguments(object):

    def __init__(self, arg):
        self.arg = arg

    @decorator
    def __call__(self, wrapped, instance, args, kwargs):
        return wrapped(*args, **kwargs)

@with_arguments(arg=1)
def function():
    pass
```

装饰器执行逻辑是这样的，当带参数的装饰器被使用时，将创建一个类实例。在被包装函数被调用时，将调用 `@decorator` 装饰的实例方法 `__call__()`，`__call__()`进而调用被包装函数。因为`__call__()`是实例的绑定方法，所以能够访问到类实例拥有的状态对象。

那么事实上是否能正常运行呢？

```python
Traceback (most recent call last):
  File "test.py", line 483, in <module>
    @with_arguments(1)
TypeError: _decorator() takes exactly 1 argument (2 given)
```

理想很丰满，显示很骨干。失败的原因就在于装饰器工厂函数的实现方式，我们将在下一篇文章种解释并解决这个特别的问题。

```python
def decorator(wrapper):
    @functools.wraps(wrapper)
    def _decorator(wrapped):
        return function_wrapper(wrapped, wrapper)
    return _decorator
```

作为另一种一种替代方式是，仍然使用类封装所需的逻辑，并在函数闭包类创建实例供包装函数使用。装饰器将功能委托给类实例，但是本身不作为类实现。这种方式需要额外创建一个类，使用起来并不优雅。
