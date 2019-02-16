---
title: 04 实现一个通用装饰器
date: 2018-05-22
categories:
    - Python
tags:
    - wrapt
    - 函数装饰器
---
![Python decorator](/images/python/decorator.jpg)
本节我们将实现一个"通用装饰器"，它能够让用户提供的包装函数通过传入的参数判断其被使用的上下文，即确定，它是被应用在函数，实例方法，类方法，类对象中的哪一个。因为装饰器不是在各个环境种被单独实现，而是以一种更加统一的方式创建，所以将这种能确定上下文的装饰器称为通用装饰器。
<!-- more -->
## 1. 内容回顾
到目前为止，我们创建装饰器的方式已经经过了几次迭代:
1. 第一篇博客中我们介绍使用函数创建装饰器的传统方式，这种方式存在几个重大问题
2. 为解决函数创建装饰器的问题，我们在第二篇博客中使用了代理对象，并将装饰器实现成了描述符，这种方式有效的解决了之前的问题，但是存在大量的样板代码
3. 为了提高创建装饰器的效率，第三篇博客中我们使用了装饰器工厂函数，抽象了装饰器的创建过程，用户只需提供一个执行所需的包装函数即可。我们的目的是实现一个通用装饰器，能够让用户的包装函数通过传入参数确定其被使用的上下文。

```python
# 包装函数通过传入参数确定其被使用的上下文
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

目前为止我们已经能够区分装饰器是被用于普通函数和还是实例方法，但是当通过类调用类方法和静态方法时将出现问题。本文我们将继续探索如何调整我们的装饰器工厂函数，以区分类方法和静态方法，以便找到实现通用装饰器的模式


## 2. 区分普通函数和实例方法
目前为止，我们的通用装饰器模式实现如下:

```python
class bound_function_wrapper(object_proxy):  

    def __init__(self, wrapped, instance, wrapper):
        super(bound_function_wrapper, self).__init__(wrapped)
        self.instance = instance
        self.wrapper = wrapper

    def __call__(self, *args, **kwargs):
        if self.instance is None:
            instance, args = args[0], args[1:]
            wrapped = functools.partial(self.wrapped, instance)
            return self.wrapper(wrapped, instance, args, kwargs)
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

# 装饰器工厂函数
def decorator(wrapper):
    @functools.wraps(wrapper)
    def _decorator(wrapped):
        return function_wrapper(wrapped, wrapper)
    return _decorator
```

为了测试当前的模式能在任何情况下都能工作，我们需要使用装饰器工厂创建一个装饰器，它能在执行时打印绑定的 instance 对象，以及传递进来的参数。

```python
@decorator
def my_function_wrapper(wrapped, instance, args, kwargs):
    print('INSTANCE', instance)
    print('ARGS', args)
    return wrapped(*args, **kwargs)
```

当装饰器被应用到一个正常的函数和实例方法时，包括通过显式传入实例调用实例方法时，我们能够得到符合预期的结果

```python
@my_function_wrapper
def function(a, b):
    pass

>>> function(1, 2)
INSTANCE None
ARGS (1, 2)

class Class(object):
    @my_function_wrapper
    def function_im(self, a, b):
        pass

c = Class()

>>> c.function_im(1, 2)
INSTANCE <__main__.Class object at 0x1085ca9d0>
ARGS (1, 2)

>>> Class.function_im(c, 1, 2)
INSTANCE <__main__.Class object at 0x1085ca9d0>
ARGS (1, 2)
```

但是当装饰起被应用到类方法以及静态方法时，参数传递发生了错误。instance 按预期要么为空，要么接收的是类实例或类对象，现在却是传递给函数的第一个实参。并不符合我们通用装饰器的要求 。

```python
class Class(object):

    @my_function_wrapper
    @classmethod
    def function_cm(self, a, b):
        pass

    @my_function_wrapper
    @staticmethod
    def function_sm(a, b):
        pass

>>> Class.function_cm(1, 2)
INSTANCE 1
ARGS (2,)

>>> Class.function_sm(1, 2)
INSTANCE 1
ARGS (2,)
```

## 3. 区分类方法和静态方法
因此，我们要指出的是，在实例被传递为None的情况下，我们需要能够区分这三种情况:
1. 通过类直接调用实例方法
2. 类方法被调用
3. 静态方法被调用

一种判断方法是查看绑定函数的`__self__`属性。该属性保存了函数在特定时间点绑定到的对象类型信息。我们先来看看通过类调用不同方法时，此属性的值。

```python
>>> print(Class.function_im.__self__)
None

>>> print(Class.function_cm.__self__)
<class '__main__.Class'>

>>> print(Class.function_sm.__self__)
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "test.py", line 19, in __getattr__
    return getattr(self.wrapped, name)
AttributeError: 'function' object has no attribute '__self__'
```

通过类调用实例方法的情况，`__self__` 值为 None，对于类方法，它将是类对象，在静态方法的情况下，不存在 `__self__` 属性。似乎检查 `__self__` 是一个有效的判断方法

在我们编写一个基于此的解决方案之前，我们先检查一下Python 3，以确保我们在那里没问题，并且没有任何变化。

```python
>>> print(Class.function_im.__self__)
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "dectest.py", line 19, in __getattr__
    return getattr(self.wrapped, name)
AttributeError: 'function' object has no attribute '__self__'

>>> print(Class.function_cm.__self__)
<class '__main__.Class'>

>>> print(Class.function_sm.__self__)
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "test.py", line 19, in __getattr__
    return getattr(self.wrapped, name)
AttributeError: 'function' object has no attribute '__self__'
```

Python 3 与 Python 2 表现并不相同，此方法无效。但是为什么会出现这种情况？发生这种情况的原因是，Pyhton3 已经没有未绑定对象这个对象，通过类直接调用实例方法时返回的也是函数。而Python2中通过类调用实例的返回值类型依赖于 `__self__` 是否为None，所以Python3中删除了此属性。因此，我们现在不能区分通过类调用实例方法和调用静态方法这两种情况。

另一个方法是在 `function_wrapper` 构造函数内，检查被包装对象的类型，并确定它是类方法还是静态方法。然后，将判定信息传递到 bound function wrapper 并进行进一步检查。

```python
class bound_function_wrapper(object_proxy):

    def __init__(self, wrapped, instance, wrapper, binding):
        super(bound_function_wrapper, self).__init__(wrapped)
        self.instance = instance
        self.wrapper = wrapper
        self.binding = binding

    def __call__(self, *args, **kwargs):
        if self.binding == 'function' and self.instance is None:
            instance, args = args[0], args[1:]
            wrapped = functools.partial(self.wrapped, instance)
            return self.wrapper(wrapped, instance, args, kwargs)
        return self.wrapper(self.wrapped, self.instance, args, kwargs)

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
                self.binding)

    def __call__(self, *args, **kwargs):
        return self.wrapper(self.wrapped, None, args, kwargs)
```

如果有人实际上在他们的decorator中实现了描述符协议，那么希望他们也可以在这里使用对象代理。因为对象代理拥有__class__属性，它将返回被包装对象的类，这意味着isinstance()检查仍然会成功，因为isinstance()会优先考虑__class__的返回结果，而不是对象的实际类型。

无论如何，更改后，我们重新测试如下

```python
>>> c.function_im(1,2)
INSTANCE <__main__.Class object at 0x101f973d0>
ARGS (1, 2)

>>> Class.function_im(c, 1, 2)
INSTANCE <__main__.Class object at 0x101f973d0>
ARGS (1, 2)

>>> c.function_cm(1,2)
INSTANCE <__main__.Class object at 0x101f973d0>
ARGS (1, 2)

>>> Class.function_cm(1, 2)
INSTANCE None
ARGS (1, 2)

>>> c.function_sm(1,2)
INSTANCE <__main__.Class object at 0x101f973d0>
ARGS (1, 2)

>>> Class.function_sm(1, 2)
INSTANCE None
ARGS (1, 2)
```

成功，我们已经修复了调用类方法和静态方法时参数列表问题。现在的问题是，虽然对通过实例调用方法时， instance 参数没有问题。但是无论是通过实例还是类，传递给类方法和静态方法的 instance 参数都没有什么用。并且我们不能将它同其他情形区别开。理想情况下，我们希望调用类方法时 instance 参数始终为类对象，而调用静态方法时，则使用为 None。因此
1. 对于静态方法，我们只需要在检查被包装类型时，判断 'staticmethod' 即可
2. 对于类方法的情况，如果我们回头看一下我们的测试，看看是否可以使用`__self__`属性，我们发现，对于类方法，`__self__`是类实例，对于静态方法，属性不存在。因此，我们可以做的是，如果包装对象的类型不是一个函数，那么我们可以查找`__self__`的值，如果它不存在的话，就会默认为None。这将满足这两种情况。进一步改进后如下

```python
class bound_function_wrapper(object_proxy):

    def __init__(self, wrapped, instance, wrapper, binding):
        super(bound_function_wrapper, self).__init__(wrapped)
        self.instance = instance
        self.wrapper = wrapper
        self.binding = binding

    def __call__(self, *args, **kwargs):
        if self.binding == 'function':
            # 通过类调用的实例方法
            if self.instance is None:  
                instance, args = args[0], args[1:]
                wrapped = functools.partial(self.wrapped, instance)
                return self.wrapper(wrapped, instance, args, kwargs)
            else:
                # 通过实例调用的实例方法
                return self.wrapper(self.wrapped, self.instance, args, kwargs)
        else:
            # 调用静态方法，__self__ 属性不存在，instance 为 None
            # 调用类方法时，__self__ 为类对象， instance 为类对象
            instance = getattr(self.wrapped, '__self__', None)
            return self.wrapper(self.wrapped, instance, args, kwargs)
```

如果我们重新测试一次，我们将得到我们想要得结果

```python
>>> c.function_im(1,2)
INSTANCE <__main__.Class object at 0x10c2c43d0>
ARGS (1, 2)

>>> Class.function_im(c, 1, 2)
INSTANCE <__main__.Class object at 0x10c2c43d0>
ARGS (1, 2)

>>> c.function_cm(1,2)
INSTANCE <class '__main__.Class'>
ARGS (1, 2)

>>> Class.function_cm(1, 2)
INSTANCE <class '__main__.Class'>
ARGS (1, 2)

>>> c.function_sm(1,2)
INSTANCE None
ARGS (1, 2)

>>> Class.function_sm(1, 2)
INSTANCE None
ARGS (1, 2)
```
现在万事大吉了？可惜并不是。

## 4. 多层绑定
还有一个我们还没有考虑到的特殊情况，即为方法创建别名，并通过别名调用时。

```python
>>> Class.function_rm = Class.function_im

>>> c.function_rm(1, 2)
INSTANCE 1
ARGS (2,)
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "test.py", line 132, in __call__
    return self.wrapper(wrapped, instance, args, kwargs)
  File "test.py", line 58, in my_function_wrapper
    return wrapped(*args, **kwargs)
TypeError: unbound method function_im() must be called with Class instance as first argument (got int instance instead)

>>> Class.function_rm = Class.function_cm

>>> c.function_rm(1, 2)
INSTANCE <class '__main__.Class'>
ARGS (1, 2)

>>> Class.function_rm = Class.function_sm
>>> c.function_rm(1, 2)
INSTANCE None
ARGS (1, 2)
```
对于类方法或静态方法来说，一切都很好，但是对于实例方法来说却失败了。这里的问题是由于在第一次访问实例方法时，它将返回绑定的bound_function wrapper对象。然后把它作为类的属性分配回来。当通过新名称进行后续查找时，在正常情况下，绑定将再次发生，以将其绑定到实际实例。在我们的绑定函数包装器的实现中，我们不提供`__get__()`方法，因此不会发生这种重新绑定。结果是，在随后的调用中，它全部崩溃。

`Class.function_rm = Class.function_im` 设置别名时，发生第一次描述符协议，function_rm 绑定得是 bound_function_wrapper 对象，第二次通过别名调用实例方法时会发生第二次描述符协议，进行第二次绑定。

因此，解决方案是我们需要向 bound_function_wrapper 添加`__get__()`方法，为其提供了执行进一步绑定的能力。我们只希望在实例为None的地方执行这个操作，这表明我们处理的是实例方法，而不是类方法或静态方法。

(注: Class.function_rm = Class.function_im 第一次绑定时，self.binding 为 function，并且由于时通过类直接调用实例方法，因此 instance 参数是 None。包装普通函数时也符合此类情况，但是不会触发描述符协议，只有通过实例调用发生第二次绑定时，才会调用bound_function_wrapper 的`__get__`方法)

另一个问题是，我们需要绑定的是原始的被包装函数，而不是绑定后的包装函数。最简单的处理方法是将对原始函数包装器 `function_wrapper` 的引用传递给绑定的函数包装器`bound_function_wrapper`，并通过它获得原始的被包装函数。


```python
class bound_function_wrapper(object_proxy):

    def __init__(self, wrapped, instance, wrapper, binding, parent):
        super(bound_function_wrapper, self).__init__(wrapped)
        self.instance = instance
        self.wrapper = wrapper
        self.binding = binding
        self.parent = parent    # 目的是获取原始的被包装函数

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
        # 仅在通过类调用实例方法时才会发生第二次绑定
        if self.instance is None and self.binding == 'function':
            descriptor = self.parent.wrapped.__get__(instance, owner)
            # instance 是第二次绑定传入的实例对象
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
```

再次运行测试得到如下所示

```python
>>> Class.function_rm = Class.function_im

>>> c.function_rm(1, 2)
INSTANCE <__main__.Class object at 0x105609790>
ARGS (1, 2)

# 不会发生二次绑定
>>> Class.function_rm = Class.function_cm
>>> c.function_rm(1, 2)
INSTANCE <class '__main__.Class'>
ARGS (1, 2)

# 不会发生二次绑定
>>> Class.function_rm = Class.function_sm
>>> c.function_rm(1, 2)
INSTANCE None
ARGS (1, 2)
```

## 5. 装饰器应用顺序
目前为止，我们的装饰器一直被放置在将方法标记为类方法或静态方法的装饰器之外。如果我们颠倒顺序会怎样？

```python
class Class(object):

    @classmethod
    @my_function_wrapper
    def function_cm(self, a, b):
        pass

    @staticmethod
    @my_function_wrapper
    def function_sm(a, b):
        pass

c = Class()

>>> c.function_cm(1,2)
INSTANCE None
ARGS (<class '__main__.Class'>, 1, 2)

>>> Class.function_cm(1, 2)
INSTANCE None
ARGS (<class '__main__.Class'>, 1, 2)

>>> c.function_sm(1,2)
INSTANCE None
ARGS (1, 2)

>>> Class.function_sm(1, 2)
INSTANCE None
ARGS (1, 2)
```
静态方法按预期运行，但是类方法不行。在这个特殊的例子中，它实际上可以被看作是Python本身的一个bug。具体地说，classmethod 装饰器本身并不能对它包装的所有对象都遵守描述符协议。这也是为什么当使用闭包实现装饰器会发生错误的原因。如果classmethod 装饰器能正常工作，一起都是OK 的。对于那些对细节感兴趣的人，您可以在Python bug跟踪器中查看19072。

## 6. 装饰器一个类
除了与类方法的装饰器顺序之外，我们实现的通用装饰器的模式看起来很好。我在上一篇文章中提到过，我们的目标是，我们也可以区分什么时候装饰器被应用到一个类中。所以让我们试试

```python
@my_function_wrapper
class Class(object):
    pass

>>> c = Class()
INSTANCE None
ARGS ()
```

基于此，我们无法将其与普通函数或类方法区分开来。如果我们再考虑一下，在这个例子中传递给包装器函数的包装对象将是类本身。让我们输出传递给用户包装函数的 wrapped参数，看看是否能区分出这种情景

```python
@decorator
def my_function_wrapper(wrapped, instance, args, kwargs):
    print('WRAPPED', wrapped)
    print('INSTANCE', instance)
    print('ARGS', args)
    return wrapped(*args, **kwargs)

@my_function_wrapper
def function(a, b):
    pass

>>> function(1, 2)
WRAPPED <function function at 0x10e13bb18>
INSTANCE None
ARGS (1, 2)

class Class(object):

    @my_function_wrapper
    def function_im(self, a, b):
        pass

    @my_function_wrapper
    @classmethod
    def function_cm(self, a, b):
        pass

    @my_function_wrapper
    @staticmethod
    def function_sm(a, b):
        pass

c = Class()

>>> c.function_im(1,2)
WRAPPED <bound method Class.function_im of <__main__.Class object at 0x107e90950>>
INSTANCE <__main__.Class object at 0x107e90950>
ARGS (1, 2)

>>> Class.function_im(c, 1, 2)
WRAPPED <functools.partial object at 0x107df3208>
INSTANCE <__main__.Class object at 0x107e90950>
ARGS (1, 2)

>>> c.function_cm(1,2)
WRAPPED <bound method type.function_cm of <class '__main__.Class'>>
INSTANCE <class '__main__.Class'>
ARGS (1, 2)

>>> Class.function_cm(1, 2)
WRAPPED <bound method type.function_cm of <class '__main__.Class'>>
INSTANCE <class '__main__.Class'>
ARGS (1, 2)

>>> c.function_sm(1,2)
WRAPPED <function function_sm at 0x107e918c0>
INSTANCE None
ARGS (1, 2)

>>> Class.function_sm(1, 2)
WRAPPED <function function_sm at 0x107e918c0>
INSTANCE None
ARGS (1, 2)

@my_function_wrapper
class Class(object):
    pass

c = Class()

>>> c = Class()
WRAPPED <class '__main__.Class'>
INSTANCE None
ARGS ()
```
答案是肯定的，因为它是唯一一个被包装对象是类型对象的情况。

## 7. 通用装饰器结构
我们的目标是，一个装饰器能同时被应用在普通函数，示例方法，类方法以及类上。比较特殊的是静态方法，但是实践中，静态方法与函数并没有本质上的不同，只是它被放在不同的地方。在装饰器的执行过程中区分出静态方法是必要的，但是静态方法不会包含任何连接到它所在的类的参数。如果需要，在开始更应该创建一个类方法。最后我们的通用装饰器可以被展示如下:

```python
@decorator
def universal(wrapped, instance, args, kwargs):
    if instance is None:
        if inspect.isclass(wrapped):
            # Decorator was applied to a class.
            return wrapped(*args, **kwargs)
        else:
            # Decorator was applied to a function or staticmethod.
            return wrapped(*args, **kwargs)
    else:
        if inspect.isclass(instance):
            # Decorator was applied to a classmethod.
            return wrapped(*args, **kwargs)
        else:
            # Decorator was applied to an instancemethod.
            return wrapped(*args, **kwargs)
```

这样的通用装饰器有实际用途吗?我相信有一些很好的例子，我将在随后的博客文章中特别提到其中一个。其他一些框架，比如Django，也使用了一些技巧来创建同时适用于函数和实例方法的装饰器。事实证明，他们使用的方法是不正确的，因为它不遵守描述符协议。如果您对此感兴趣，请参见Django bug跟踪器中的第21247号问题。下一篇博客中将介绍一些具有可选参数的装饰器的问题，通用装饰器的使用实例留在以后展示。
