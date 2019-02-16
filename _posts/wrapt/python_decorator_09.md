---
title: 09 装饰器性能比较
date: 2018-05-30
categories:
    - Python
tags:
    - wrapt
    - 函数装饰器
---
![Python decorator](/images/python/decorator.jpg)

前面我们探讨了装饰器的实现方式，并实现了一个所谓的通用装饰器模式，并用它创建了一个类似 Java 的 `@synchronized` 装饰器作为使用示例。本节我们来看看不同的装饰器实现方式的性能问题。在这篇关于装饰器的实现性能这篇文章之后，我们将开始深入探讨如何实现代理，它是通用装饰器机制中的基础组件。
<!-- more -->


## 1. 装饰一个普通函数
在这篇文章中，我将只讨论用装饰器修饰一个普通函数的开销。相关的装饰器代码如下:

```python
class function_wrapper(object_proxy):  

    def __init__(self, wrapped, wrapper):
        super(function_wrapper, self).__init__(wrapped)
        self.wrapper = wrapper
        ...

    def __get__(self, instance, owner):
        ...

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

如果你想回忆完整的代码，你可以去查看之前的文章，那里有完整描述。使用装饰器工厂函数，创建装饰器，并装饰器一个普通函数可以像下面这样:

```python
@decorator
def my_function_wrapper(wrapped, instance, args, kwargs):
    return wrapped(*args, **kwargs)  

@my_function_wrapper
def function():
    pass
```

这与使用函数闭包以更传统的方式创建的decorator不同。使用闭包创建一个函数装饰器如下所示:

```python
def my_function_wrapper(wrapped):
    def _my_function_wrapper(*args, **kwargs):
        return wrapped(*args, **kwargs)
    return _my_function_wrapper

@my_function_wrapper
def function():
    pass
```
在我们调用函数时`function()`，这两种情况各自会发生什么?


## 2. 追踪函数执行

为了跟踪代码的执行，我们可以使用Python的profile hook机制。

```python
import sys
def tracer(frame, event, arg):
    print(frame.f_code.co_name, event)

sys.setprofile(tracer)

function()
```

`profile hook`的目的是允许注册一个回调函数，该函数在所有函数的入口和出口调用。这样就可以追踪正在进行的函数调用的序列。对于函数闭包，输出如下:

```python
_my_function_wrapper call
    function call
    function return
_my_function_wrapper return
```

我们在这里看到的是函数闭包的嵌套函数被调用。这是因为在使用函数闭包的情况下，装饰器将函数替换为对嵌套函数的引用。当这个嵌套函数被调用时，它将依次调用原来的包装函数。对于我们的工厂函数，输出如下:

```python
__call__ call
    my_function_wrapper call
        function call
        function return
    my_function_wrapper return
__call__ return
```

这里的区别是，`decorator` 用 `function wrapper` 类的实例替换了函数。作为一个类，当它作为一个函数被调用时，`__call__()` 方法在类的实例上被调用。`__call__()` 方法随后调用用户提供的包装器函数，该函数反过来调用原始包装函数。

因此，结果是我们引入了额外的间接级别，或者换句话说，在执行路径中引入了额外的函数调用。记住，`__call__()`实际上是一个方法，而不仅仅是一个普通的函数。作为一种方法，实际上在幕后进行的工作要比普通的函数调用多得多。特别是，在调用未绑定方法之前，需要将其绑定到函数包装器类的实例。这不会出现在调用的跟踪中，但是它正在发生，并且会产生额外的开销。

## 3. 函数执行时间
通过执行上面的跟踪，我们知道我们的解决方案会带来额外的方法调用开销。但是这会产生多少额外的开销呢？为了尝试度量每个解决方案中开销的增加，我们可以使用timeit模块来执行我们的函数调用。作为基线，我们首先需要知道在不应用任何修饰符的情况下对函数进行调用的时间开销。

```python
# benchmarks.py
def function():
    pass
```

为记录时间，我们需要使用以下命令:

`$ python -m timeit -s 'import benchmarks' 'benchmarks.function()'`

以这种方式使用的timeit模块时，它将执行适当的大量函数调用，将所有调用的总时间除以调用次数，最后得到单个调用的时间值。对于2012年款的MacBook Pro来说，输出如下:

`10000000 loops, best of 3: 0.132 usec per loop`

接下来测试函数闭包，输出如下:

`1000000 loops, best of 3: 0.326 usec per loop`

最后测试我们的装饰器工厂函数:

`1000000 loops, best of 3: 0.771 usec per loop`

在这个最后的例子中，我使用的是wrapt模块实现，而不是本系列博文中迄今为止给出的代码。这个实现的工作方式略有不同，因为它在描述的内容上有一些额外的功能，设计也有一些不同。即便是最轻量级的实现，性能开销也差不多。

## 4. 加速包装器的执行
在这一点上毫无疑问会有人们想要指出,即使对于方法调用而言，它更加正确的实现了描述符协议，但是这所谓的的更好的方法实在是太慢，难以在实际生产环境中使用。因此，是否可以做些什么来加速实现呢?

此时可以采用的方法是将函数包装器和对象代理实现为Python C扩展模块。为了简单起见，我们可以将装饰器工厂函数本身作为纯Python代码来实现，因为工厂函数只在修饰符应用到函数时才调用，而不是修饰函数的每次调用时都会调用，因此它的时间开销并不重要。**

我绝对不会做的一件事是写博客，讨论如何将函数包装器和对象代理作为Python C扩展模块实现。不过请放心，它的工作方式与纯Python实现相同。显然，它的运行速度要快得多，因为它是使用Python C api实现的C代码，而不是纯粹的Python代码。

将函数包装器和对象代理作为Python C扩展模块实现的开销如何呢?测试如下:

`1000000 loops, best of 3: 0.382 usec per loop`

因此，尽管将函数包装器和对象代理作为Python C扩展模块实现需要付出更多的努力，但这些努力是值得的，结果时现在非常接近使用函数闭包的装饰器实现。

## 4. 装饰类方法性能
到目前为止，我们只考虑了装饰一个普通函数的情况。正如预期的那样，与`function wrapper`作为一个类实现类似，由于引入了额外的间接层，因此开销明显更多。尽管如此，它仍然只有半微秒。

尽管如此，通过实现我们的函数包装器和对象代理作为C代码，我们还是能够将性能达到同一量级，在这里，作为函数闭包实现的装饰器工厂函数的开销可以忽略不计。

那么装饰类方法的性能如何呢。将在下一篇博客揭晓。
