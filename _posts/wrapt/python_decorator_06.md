---
title: 06 装饰器的类实现
date: 2018-05-25
categories:
    - Python
tags:
    - wrapt
---
![Python decorator](/images/python/decorator.jpg)

上一篇文章中，我们讨论了如何实现一个带参数的装饰器，以及如何让装饰器可选的接收参数而不是必需输入参数。也讨论了如何让装饰器能在被包装函数的不同调用之间保持状态。保持状态的一种可用方法是使用类实现装饰器。然而我们实现的通用装饰器模式在使用类实现装饰器还存在一些问题，本文我们将来探讨问题出现的根源以及如何解决。
<!-- more -->

## 1. 装饰器工厂函数
正如前文所述，我们通过类实现装饰器的模式如下

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

当我们这么做时，装饰器在被应用时发生了如下错误:

```python
Traceback (most recent call last):
  File "test.py", line 483, in <module>
    @with_arguments(1)
TypeError: _decorator() takes exactly 1 argument (2 given)
```

`_decorator()` 是我们装饰器工厂函数的内部函数。

```python
def decorator(wrapper):
    @functools.wraps(wrapper)
    def _decorator(wrapped):
        return function_wrapper(wrapped, wrapper)
    return _decorator
```

错误的原因是我们使用函数闭包实现装饰器工厂函数，却希望它能同时工作在普通函数和类方法上。当类方法被访问时，将触发描述符协议，绑定将会发生；类实例的引用将自动作为第一个参数传递给类方法。而 `_decorator()` 却没有被定义成同时接收 self和wrapped 作为参数，所以调用失败。我们可以创建一个仅用于类实例的装饰器工厂函数。但是这与我们之前要为类方法和函数创建统一的装饰器的初衷相违背。

解决问题的方法是，使用我们的 function_wrapper 作为装饰器工厂的返回对象，而不是函数闭包。

```python
def decorator(wrapper):
    def _wrapper(wrapped, instance, args, kwargs):
        def _execute(wrapped):
            return function_wrapper(wrapped, wrapper)
        return _execute(*args, **kwargs)
    return function_wrapper(wrapper, _wrapper)

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

这种方式特别巧妙，但是很不容易理解，我们再来看看整个调用的发生过程
1. `with_arguments(arg=1)` 带参数的装饰器被使用时，将创建一个类实例 ins
2. 在 `@decorator` 装饰下, ins 的 `__call__` 方法此时是 `function_wrapper(__call__, _wrapper)` 对象
3. `@` 将 `function` 对象作为参数传递给创建的类实例，将调用 `ins.__call__(function)` 方法，此时将触发`function_wrapper`的描述符协议，并进一步调用 `_wrapper(__call__, ins)` 函数，`functions` 对象则通过 arg 传递给 `_execute` 函数，`_execute` 执行返回新的 `function_wrapper(functions, __call__)` 对象
4. 装饰的最终结果是，我们现在不必担心 `@decorator` 被应用在普通函数，实例方法还是一个类方法上。因为在所有的情况下，被绑定的实例对象不会通过 `args` 被传递

细心的读者很快就会发现另一个问题，在 `__call__` 在被调用时，需要传入装饰器类的实例即 `self` 参数，而在上述的实现中并没有此步骤。(不过我没懂为什么作者在 `_wrapper` 内多嵌套一层`_execute`函数，应该是想说名这是要被执行的部分。)

## 2. 类的绑定要求
更改之后，重新进行测试，我们遇到了一个新的问题。这次发生在被被包装函数被调用的时候。

```python
>>> function()
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "test.py", line 243, in __call__
    return self.wrapper(self.wrapped, None, args, kwargs)
TypeError: __call__() takes exactly 5 arguments (4 given)
```

现在这个问题是`__call__()`方法传递给@decorator发生在 类初始化，此时它是未绑定方法，任何类实例远还没被创建。通常情况下，类实例的引用在方法被绑定时被提供，但是因为我们的装饰器实际是一个工厂函数，因此这里涉及到了两层绑定。外部包装函数的类实例被传递给工厂函数内部的 `_wrapper` 函数的instance参数。但是它在 function wrapper 对象被创建的时候，完全没有被使用。为了解决这个问题，我们需要根据是否绑定了一个实例方法，显示使用类实例绑定我们的包装函数

```python
def decorator(wrapper):
    def _wrapper(wrapped, instance, args, kwargs):
        def _execute(wrapped):
            if instance is None:
                return function_wrapper(wrapped, wrapper)
            elif inspect.isclass(instance):
                return function_wrapper(wrapped, wrapper.__get__(None, instance))
            else:
                return function_wrapper(wrapped, wrapper.__get__(instance, type(instance)))
        return _execute(*args, **kwargs)
    return function_wrapper(wrapper, _wrapper)
```

在这个示例中，有三种情况需要我们处理。
1. 第一种情况是 instance 为 None。这对应于decorator函数被应用在普通函数，类静态方法或一个类上
2. 第二种情况是 instance 不为 None，但是是一个类对象。这对应用于一个类方法。这种情况下，我们需要通过包装函数的__get__()将包装函数显示绑定到一个类对象。
3. 第三种即最后一种情况下，instance 不是None，也不是一个类对象。这对应于实例方法。在这种情况我们仍然需要绑定包装函数，只不过这次绑定的是类实例。

## 3. 总结
改进之后，我们解决了所有问题，而且很大程度上完善了我们的装饰器模式。所以，目前我们的通用装饰器解决方案如下:

```python
class object_proxy(object):
    def __init__(self, wrapped):
        self.wrapped = wrapped
        try:
            self.__name__ = wrapped.__name__
        except AttributeError:
            pass
    @property
    def __class__(self):
        return self.wrapped.__class__
    def __getattr__(self, name):
        return getattr(self.wrapped, name)


class bound_function_wrapper(object_proxy):  
    def __init__(self, wrapped, instance, wrapper, binding, parent):
        super(bound_function_wrapper, self).__init__(wrapped)
        self.instance = instance
        self.wrapper = wrapper
        self.binding = binding
        self.parent = parent  
    def __call__(self, *args, **kwargs):
        if self.binding == 'function':
            if self.instance is None:
                instance, args = args[0], args[1:]
                wrapped = functools.partial(self.wrapped, instance)
                return self.wrapper(wrapped, instance, args, kwargs)
            else:
                return self.wrapper(self.wrapped, self.instance, args, kwargs)
        else:
            instance = getattr(self.wrapped, '__self__', None)
            return self.wrapper(self.wrapped, instance, args, kwargs)  
    def __get__(self, instance, owner):
        if self.instance is None and self.binding == 'function':
            descriptor = self.parent.wrapped.__get__(instance, owner)
            return bound_function_wrapper(descriptor, instance, self.wrapper,
                    self.binding, self.parent)
        return self  


class function_wrapper(object_proxy):  
    def __init__(self, wrapped, wrapper):
        super(function_wrapper, self).__init__(wrapped)
        self.wrapper = wrapper
        if isinstance(wrapped, classmethod):
            self.binding = 'classmethod'
        elif isinstance(wrapped, staticmethod):
            self.binding = 'staticmethod'
        else:
            self.binding = 'function'  
    def __get__(self, instance, owner):
        wrapped = self.wrapped.__get__(instance, owner)
        return bound_function_wrapper(wrapped, instance, self.wrapper,
                self.binding, self)  
    def __call__(self, *args, **kwargs):
        return self.wrapper(self.wrapped, None, args, kwargs)


def decorator(wrapper):
    def _wrapper(wrapped, instance, args, kwargs):
        def _execute(wrapped):
            if instance is None:
                return function_wrapper(wrapped, wrapper)
            elif inspect.isclass(instance):
                return function_wrapper(wrapped, wrapper.__get__(None, instance))
            else:
                return function_wrapper(wrapped, wrapper.__get__(instance, type(instance)))
        return _execute(*args, **kwargs)
    return function_wrapper(wrapper, _wrapper)
```

尽管在之前的文章中提到过。这里给出的对象代理实现并不是一个完美实现。因此，不要使用这段代码。如果你使用了，就会发现。在被包装函数上的部分内省操作不会按照我们所预期的执行。特别的，访问函数的__doc__属性总是返回 None。类似Python3中的新增变量 `__qualname__` 和 `__module__` 也不能正确显示。

正确处理像`__doc__`这样的内置属性是比较费劲的，因为内置属性的获取逻辑与普通属性有时候并不相同。上述实现中我们期望的是，无论从代理对象还是代理对象的子类，我们都是从被包装函数获取并返回属性值，但是对于`__doc__`属性，即便是代理对象的子类没有`__doc__`属性，它也同样会覆盖父类的`__doc__`，结果是代理对象的子类拦截了对 `__doc__` 属性的获取。所以这里展示的代理对象仅仅是一个参照实现。

大体上说，这里所有的代码都仅仅是参照实现。目的不是使用而是展示如何实现一个更加通用的装饰器。它只是提供给你一个学习的途径。不要期望通过简单的几行代码就能实现，事情不会那么简单。

## 4. wrapt 模块
如果我告诉你不要使用这里的代码，那你应该怎么做呢？答案是在PyPi上已经有现成的 wrapt 模块。wrapt 模块已经上线几个月了，但是目前为止并没有广为人知。它实现了这里描述的所有细节，甚至更多。这个模块实现了一个完整的代理对象，能使所有代码正确执行。并且提供了很多和装饰器工厂函数相关的特性，也提供了很多和猴子补丁相关的特性。

虽然我指出了wrapt 模块的存在，但是博客内容不会就此停止，因为我还有其他一些主题想要阐述。这些内容包括通用装饰器的应用，启用和关闭装饰器，装饰器执行性能问题，以及代理对象，猴子补丁的实现问题等等。

接下来的博客，我将举一个通用装饰器应用的特殊示例，来说明Python 装饰器如此强大，为什么Pyhton不提供一个@synchronized装饰器。在装饰器第一次被引入编程语言时，这个装饰器被当作是如何使用装饰器的经典示例。然而我能找到的所有实现都是半成品，很少在现实世界中被使用。我相信这里的通用装饰器能帮助我们实现一个可用的`@synchronized`装饰器。我将在下一篇博客中详述它。
