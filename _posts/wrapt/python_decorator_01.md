---
title: 01 如何实现一个 Python 装饰器
date: 2018-05-04
categories:
    - Python
tags:
    - wrapt
---
![Python decorator](/images/python/decorator.jpg)

稍微对 Python 有所了解的程序员一定知道 Python 装饰器和函数闭包。我曾经也以为很了解，直到在《流畅的Python》中看到了 Wrapt 模块。
<!-- more -->

Wrapt 模块的作者 Graham Dumpleton 先生写了 14 篇博客详细讲解了如何在 Python 中实现一个能同时包装函数，类方法，实例方法的通用装饰器。本文以及接下来几篇文章是我对那 14 篇博客的整理和笔记。

Graham Dumpleton 先生的博文 和 Wrapt 模块请参阅:
- [GrahamDumpleton wrapt blog](https://github.com/GrahamDumpleton/wrapt/tree/master/blog)
- [wrapt 1.10.11 documentation](https://wrapt.readthedocs.io/en/latest/)

## 1. 通过函数闭包实现装饰器
装饰器的典型目的是为被包装函数附加的额外的处理逻辑。我遇到的使用装饰器的最典型场景是，大多数数据库对一次查询可设置的查询的条件有数量限制，大量查询时需要将多个查询条件分组进行多次查询在合并查询结果。比如我有100000 用户需要根据ID 查询其性别，查询条件太多，只能分批多次查询，然后将查询结果合并。这种分批查询不仅对 mysql，对其他任何数据库都适用，所以非常适用用装饰器将分批查询再合并的功能抽象出来。

### 1.1 实现原理
大多数人(我)都是通过闭包来创建一个装饰器，就像下面这样。
```python
def function_wrapper(wrapped):
    def _wrapper(*args, **kwargs):
        return wrapped(*args, **kwargs)
    return _wrapper

# @ 符应用一个装饰器在Python2.4 中被加入。它仅仅是如下方式的语法糖
@function_wrapper
def function():
    pass

function = function_wrapper(function)
```

整个包装的执行过程如下:
1. 包装函数(`function_wrapper`)接收被包装函数(`wrapped`)作为参数，并将内部的另一个内部函数(`_wrapper`) 作为返回值
2. 通过`@`装饰器或函数的调用赋值，使用 `_wrapper` 替换 `wrapped`，这样对 `wrapped` 的调用实际是调用的 `_wrapped`
3. `_wrapped` 通过函数闭包保留了对 `wrapped` 函数的引用，这样它就可以在内部调用 `wrapped` 函数并返回调用结果。
4. `_wrapped` 在调用 `wrapped` 之前或之后可以添加其他处理逻辑，以达到为 `wrapped` 附加功能的目的。

虽然通常都是适用函数闭包实现装饰器，但是能展示它工作原理的更好的示例是使用一个类实现它:
1. `function_wrapper` 类通过属性保留对被包装函数的引用
2. 当被包装函数被调用时，包装类的 `__call__` 方法被调用，并进而调用原始的被包装函数
2. `__call__` 包含了附加的通用处理逻辑。

```python
class function_wrapper(object):
    def __init__(self, wrapped):
        self.wrapped = wrapped
    def __call__(self, *args, **kwargs):
        return self.wrapped(*args, **kwargs)
@function_wrapper
def function():
    pass
```

### 1.2 局限
尽管通过闭包实现装饰器很简单，但是这种方式存在很多局限，其中最重要的是打断了 Python 内部的自省，也没有遵循 Python 对象模型的执行方式。

#### 猴子补丁
与装饰器十分相似的一个技术是 `monkey patching`(猴子打补丁)，猴子打补丁会进入并修改其他人的代码。二者不同的是装饰器作用的时间是函数定义完成之后，而猴子补订在函数导入模块时被应用。为了能同时使用函数包装器和猴子补丁，函数包装器必需是透明的，并且内部维护了一个堆，以便多个装饰器，猴子补订能按照预期的顺序执行。

## 2. 自省丢失
当我们讨论函数闭包时，我们会预期函数的自省属性和函数的外在表现相一致。这些包括`__name__`，`__doc__` 属性。但是当使用函数闭包时，原函数的自省属性会被内嵌函数所替代，因为函数闭包返回的是内嵌函数。

```python
def function_wrapper(wrapped):
    def _wrapper(*args, **kwargs):
        return wrapped(*args, **kwargs)
    return _wrapper

@function_wrapper
def function():
    pass

>>> print(function.__name__)
_wrapper
```

当使用类实现闭包时，类实例没有 `__name__` 属性，访问此属性时，会导致 AttributeError 异常

```python
class function_wrapper(object):
    def __init__(self, wrapped):
        self.wrapped = wrapped
    def __call__(self, *args, **kwargs):
        return self.wrapped(*args, **kwargs)

@function_wrapper
def function():
    pass

>>> print(function.__name__)
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
AttributeError: 'function_wrapper' object has no attribute '__name__'
```

此处的解决方式是，在函数闭包内，将被包装函数的内省属性复制到内嵌函数上。这样函数名称和文档字符串属性就能表现正常

```python
def function_wrapper(wrapped):
    def _wrapper(*args, **kwargs):
        return wrapped(*args, **kwargs)
    _wrapper.__name__ = wrapped.__name__
    _wrapper.__doc__ = wrapped.__doc__
    return _wrapper

@function_wrapper
def function():
    pass

>>> print(function.__name__)
function
```

手动复制属性是费劲的，如果未来扩展了其他自省属性，代码需要被更新。例如需要复制 `__module__` 属性，在Python3 中需要复制  `__qualname__` 和 `__annotations__` 属性。为了避免这么做，Python 标准库为我们提供了 `functools.wraps()` 装饰器，完成自省属性的复制

```python
import functools

def function_wrapper(wrapped):
    @functools.wraps(wrapped)
    def _wrapper(*args, **kwargs):
        return wrapped(*args, **kwargs)
    return _wrapper

@function_wrapper
def function():
    pass

>>> print(function.__name__)
function
```

使用类实现装饰器时，我们需要使用 `functools.update_wrapper()` 函数

```python
import functools

class function_wrapper(object):
    def __init__(self, wrapped):
        self.wrapped = wrapped
        functools.update_wrapper(self, wrapped)
    def __call__(self, *args, **kwargs):
        return self.wrapped(*args, **kwargs)
```

或许你已经认为通过 `functolls.wraps` 函数我们能确保函数的自省属性是正确的，但事实上它并不能一直有效。假如我们去访问函数的参数信息，返回的将是包装函数的参数信息而不是被包装函数的。即，在使用闭包的方式中，内嵌函数的参数信息被返回。因此包装器没能保留函数签名信息

```python
import inspect

def function_wrapper(wrapped): ...

@function_wrapper
def function(arg1, arg2): pass

>>> print(inspect.getargspec(function))
ArgSpec(args=[], varargs='args', keywords='kwargs', defaults=None)
```

类包装器更加严重，因为会触发异常，并解释称被包装函数不是一个函数。我们完全不能获取函数签名信息，即使被包装函数是可调用的

```python
class function_wrapper(object): ...

@function_wrapper
def function(arg1, arg2): pass

>>> print(inspect.getargspec(function))
Traceback (most recent call last):
  File "...", line XXX, in <module>
    print(inspect.getargspec(function))
  File ".../inspect.py", line 813, in getargspec
    raise TypeError('{!r} is not a Python function'.format(func))
TypeError: <__main__.function_wrapper object at 0x107e0ac90> is not a Python function
```

另外一个自省的示例是使用 `inspect.getsource()` 获取函数源代码。闭包装饰器返回的是内嵌函数的源代码，而类装饰器则会触发异常

## 3.描述符协议
同函数类似，装饰器也可以应用于类方法。Python 包含了两个特殊的装饰器`@classmethod` 和 `@staticmethod` 将实例方法转换为特殊的类方法。装饰器应用于类方法同样隐含着几个问题

```python
class Class(object):

    @function_wrapper
    def method(self):
        pass

    @classmethod
    def cmethod(cls):
        pass

    @staticmethod
    def smethod():
        pass
```

第一即使使用了 `functools.wraps` 或者 `functools.update_wrapper`，当装饰器被用在 `@classmethod`，`@staticmethod` 上时，仍然会导致异常。这是因为这两个特殊的装饰器没能将一些必要的属性复制过来。这是一个Python2 的bug，并在Python3中通过忽略丢失的属性修复了

```python
class Class(object):
    @function_wrapper
    @classmethod
    def cmethod(cls):
        pass

Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "<stdin>", line 3, in Class
  File "<stdin>", line 2, in wrapper
  File ".../functools.py", line 33, in update_wrapper
    setattr(wrapper, attr, getattr(wrapped, attr))
AttributeError: 'classmethod' object has no attribute '__module__'
```

即使我们运行在 Python3 上，我们依然会遇到问题。这是因为所有类型的装饰器都假设被包装函数是直接可调用的。事实上并非如此。Python classmethod 装饰器返回一个描述符，这个描述符不是直接可调用的，但是装饰器假设被包装函数直接可调用，因此会出错。

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

## 4. 总结
函数闭包实现的装饰器存在以下问题:
1. 无法保留函数的自省属性
2. 无法获取函数签名信息
3. 无法获取函数源代码
4. 无法将装饰器应用于另一个为实现描述符的装饰器之上.简单的装饰器实现不会遵守被包装对象的描述符协议，因而破坏了Python对象的执行模型

使用 `functools.wraps()` 和 `functools.update_wrapper()` 能保留常规的自省属性，但依旧无法保留函数签名信息和源代码，而且由于 Python2 的bug，无法将装饰器直接应用于类方法和静态方法(导入时即报错)

确实存在第三方包，尝试解决这些问题，例如PyPi上的decorator模块。这个模块虽然对前两类问题有所帮助，但仍然存在一些潜在的问题，当尝试通过猴子补丁动态应用函数包装时，可能会导致问题

这并不意味着这些问题是不可解决的，而且可以以一种不牺牲性能的方式解决。现在已经说明了要解决的问题，在随后的文章将会解释如何解决这些问题，以及提供哪些额外的功能。
