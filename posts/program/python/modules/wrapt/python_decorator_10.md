---
title: 10 装饰类的性能
date: 2018-06-01
categories:
    - Python
tags:
    - wrapt
---
![Python decorator](/images/python/decorator.jpg)

在上一篇文章中，我们对作为函数闭包实现的装饰器与前文描述的通用装饰器进行了性能比较。本节我们继续我们的性能测试，看看装饰一个类方法时，不同实现方式的性能表现。
<!-- more -->

## 1. 装饰函数的性能比较
在上一篇文章中，函数闭包实现的装饰器与前文描述的通用装饰器性能测试结果如下

对于2012年的MacBook Pro，直接调用函数的测试结果是:

`10000000 loops, best of 3: 0.132 usec per loop`

使用函数闭包实现的装饰器的测试结果是:

`1000000 loops, best of 3: 0.326 usec per loop`

最受，使用装饰器工厂函数的测试结果是:

`1000000 loops, best of 3: 0.771 usec per loop`

上述是代理对象，和 `function wrapper` 对象的Python实现测试结果，如果将它们以Python C扩展实现，可以降低至:

`1000000 loops, best of 3: 0.382 usec per loop`

这与使用函数闭包实现的装饰器，性能相差无几。

将装饰器应用在类方法会怎样？

## 2. 必须绑定函数的开销
将装饰器应用于类的方法的问题是，如果要遵守Python执行模型，则需要将装饰器实现为描述符，并在访问时正确地将方法绑定到类或类实例。在本系列文章中描述的装饰器中，我们正是实现了此机制，以便能够确定装饰器整被应用于与普通的函数、实例方法或类方法中的哪一个。

相比于使用函数闭包实现的装饰器不会遵守任何的Python 执行模型，这个绑定过程确保了正确的操作，但是也带来了额外的开销。为了查看发生了哪些额外的步骤，我们可以再次使用Python profile挂钩机制来跟踪修饰函数调用的执行。当前即跟踪实例方法的调用

首先，让我们来跟踪函数闭包实现的装饰器调用了哪些函数:

```python
def my_function_wrapper(wrapped):
    def _my_function_wrapper(*args, **kwargs):
        return wrapped(*args, **kwargs)
    return _my_function_wrapper

class Class(object):
    @my_function_wrapper
    def method(self):
        pass

instance = Class()

import sys

def tracer(frame, event, arg):
    print(frame.f_code.co_name, event)

sys.setprofile(tracer)

instance.method()
```

结果跟装饰器一个普通函数类似:

```python
_my_function_wrapper call
    method call
    method return
_my_function_wrapper return
```

因此，我们应该预期，当我们执行实际的时间测试时，开销不会有很大的不同。现在使用我们的装饰器工厂函数。为了提供上下文，我展示了完整的代码实现

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
                return function_wrapper(wrapped,
                        wrapper.__get__(None, instance))
            else:
                return function_wrapper(wrapped,
                        wrapper.__get__(instance, type(instance)))
        return _execute(*args, **kwargs)
    return function_wrapper(wrapper, _wrapper)
```

我们的装饰器实现如下:

```python
@decorator
def my_function_wrapper(wrapped, instance, args, kwargs):
    return wrapped(*args, **kwargs)
```

装饰实例方法的测试输出结果如下:

```python
('__get__', 'call') # function_wrapper
    ('__init__', 'call') # bound_function_wrapper
        ('__init__', 'call') # object_proxy
        ('__init__', 'return')
    ('__init__', 'return')
('__get__', 'return')

('__call__', 'call') # bound_function_wrapper
    ('my_function_wrapper', 'call')
        ('method', 'call')
        ('method', 'return')
    ('my_function_wrapper', 'return')
('__call__', 'return')
```

可以看到，由于方法与发生在 `__get__()` 中的类实例的绑定，现在发生了很多事情。因此，开销也会显著增加。

## 3. 执行类方法的开销
与前面一样，不再使用上面的实现，而是再次使用wrapt库中的实际实现。这次我们的测试代码是:

`$ python -m timeit -s 'import benchmarks; c=benchmarks.Class()' 'c.method()'`

没有被装饰的实例方法，直接运行的结果是:

`10000000 loops, best of 3: 0.143 usec per loop`

这比普通函数调用的情况要多一点，因为发生的了实例方法的绑定。

使用函数闭包实现的装饰器。测试结果如下:

`1000000 loops, best of 3: 0.382 usec per loop`

再一次，比未修饰的情况稍微多一点，与被应用到函数的装饰器相差无几。因此，当应用于普通函数与实例方法时，装饰器的开销并没有太大的差异。现在轮到我们的装饰器工厂函数和 `function wrapper`对象。首先测试Python 实现:

`100000 loops, best of 3: 6.67 usec per loop`

与使用函数闭包实现装饰器相比，这在运行时开销上增加了不少负担。虽然每次执行只需要额外的6个usec，但是您需要在上下文中考虑这个问题。特别是，如果在处理web请求的过程中对一个调用了1000次的函数应用了这样的装饰器，那么在该web请求的响应时间之上增加了6 ms。

在这一点上，许多人无疑会辩称，如果运行成本太高，那么正确是不值得的。但是，装饰函数和装饰器本身也不可能什么都不做，因此所产生的额外开销可能只是运行时成本的一小部分，因此在实践中并不明显。同样的，如果使用Python C扩展模块实现呢？对于作为C扩展实现的对象代理和函数包装器，结果是:

`1000000 loops, best of 3: 0.836 usec per loop`

所以不是6ms，而是小于1ms的额外开销如果修饰函数被调用1000次。它仍然比使用作为函数闭包实现的装饰器要多，但再次重申，在修饰类的方法时使用函数闭包不符合Python执行模型。

## 4. 需要大费周折么
我是在吹毛求疵、过于迂腐地想把事情做好吗？当然，对于你现在所使用的装饰器，闭包实现可能工作的很好。但是当您开始使用函数包装器执行任意代码的猴子补丁时，情况就不一样了。如果你在做猴子补丁时不遵守Python的执行模型，那么你很容易以非常微妙和晦涩的方式打破第三方代码。客户可不会喜欢你破坏了他们的web应用程序。所以至少我现在所作的是很重要的。

在本文中，我只考虑了修饰类实例方法时的开销。我没有涵盖在修饰静态方法和类方法时的开销。如果您对它们的不同之处感到好奇，您可以在wrapt文档中查看完整的案例的基准。

在下一篇文章中，我将再次讨论性能开销问题，但也将讨论实现装饰器的一些替代方法，以便尝试并解决我在第一篇文章中提出的问题。这些内容将作为，对博客中描述的实现和 PyPi 模块中的实现的对比的一部分。
