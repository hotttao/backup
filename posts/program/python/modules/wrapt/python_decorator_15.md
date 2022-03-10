---
weight: 1
title: 15 wrapt 模块使用
date: '2018-06-06T22:10:00+08:00'
lastmod: '2018-06-06T22:10:00+08:00'
draft: false
author: 宋涛
authorLink: https://hotttao.github.io/
description: 15 wrapt 模块使用
featuredImage: null
tags:
- python 库
categories:
- Python
lightgallery: true
---

[GrahamDumpleton wrapt blog](https://github.com/GrahamDumpleton/wrapt/tree/master/blog) 的翻译部分到此就结束。很可惜的是作者并没有把猴子补丁部分写完，查阅了 wrapt 的官方文档，上面只介绍了 wrapt 的装饰器，代理对象以及 synchronized 同步装饰器，也没有介绍猴子补丁相关内容。不过已经介绍的内容足够用了，接下来我想结合 wrapt 的文档介绍一下 wrapt 模块的使用，算是整个博客的总结。
<!-- more -->

## 1. 前文回顾
在阐述 wrapt 的使用之前，有必要对之前的内容做一个简单总结，因为 wrapt 模块的接口正是与之前的内容一一对应的。GrahamDumpleton 编码 wrapt 的本意是想实现为 Python 代码中添加猴子补丁，然而 Python 中装饰器，辅助测试的模拟库与猴子补丁的实现方式极其相似，因此 GrahamDumpleton 就按照如下的方式为将我们讲解了 wrapt 模块的功用。
1. 如何在 Python 实现一个通用的装饰器
2. 如何使用 wrapt 实现模拟库来辅助单元测试
3. 如何为 Python 添加猴子补丁

装饰器，模拟库，猴子补丁的实现是递进的。装饰器通常是在导入时，在被装饰的函数定义之后立即运行，且永久全局有效；模拟库作用的范围变窄，需要实现只作用于特定范围，比如特定的测试函数中；猴子补丁更随意，通常在类创建一段时间之后再执行，这种延迟性导致猴子补丁存在相对导入的次序问题。对于我们而言搞清楚装饰器与模拟库的使用即可，能使用到猴子补丁的情景少之又少。

### 装饰器
那如何实现一个装饰器？传统的通过闭包实现的装饰器存在以下问题:
1. 无法保留函数的自省属性和签名信息，无法获取函数源代码
4. 无法将装饰器应用于另一个为实现描述符的装饰器之上.简单的装饰器实现不会遵守被包装对象的描述符协议，因而破坏了Python对象的执行模型

为解决这些问题和解决代码复用问题，wrapt 创建了以下对象或函数:
1. 代理对象: ObjectProxy，解决了自省问题
2. 包装对象: FunctionWrapper, BoundFunctionWrapper 继承自 ObjectProxy，并为装饰行为实现了描述符协议
3. 工厂函数: decorator 解决了创建装饰器的代码复用问题。

wrapt 为辅助单元测试提供了另外一个工厂函数 `transient_function_wrapper`，其能创建一个仅仅限于特定范围的临时补丁。

装饰器实现的核心就是包装器对象，它同时接收包装函数，和被包装函数，并作为装饰结果的返回值替换被包装函数。在被包装函数被调用时，实际调用包装函数。所以包装对象同时实现了对象代理和描述符协议。


## 2. wrapt 接口
```python
# wrapt.__init__
from .wrappers import (ObjectProxy, CallableObjectProxy, FunctionWrapper,
        BoundFunctionWrapper, WeakFunctionProxy, resolve_path, apply_patch,
        wrap_object, wrap_object_attribute, function_wrapper,
        wrap_function_wrapper, patch_function_wrapper,
        transient_function_wrapper)

from .decorators import (adapter_factory, AdapterFactory, decorator,
        synchronized)

from .importer import (register_post_import_hook, when_imported,
        notify_module_loaded, discover_post_import_hooks)
```

wrapt 模块提供的接口大体上分成了以下几类:
1. 代理对象: `ObjectProxy`, `CallableObjectProxy`, `WeakFunctionProxy`
2. 包装对象: `FunctionWrapper`, `BoundFunctionWrapper`
3. 装饰器工厂函数: `function_wrapper`, `decorator`
4. 辅助测试的工厂函数: `wrap_function_wrapper`, `patch_function_wrapper`, `transient_function_wrapper`
5. 猴子补丁相关: `.importer`
6. `synchronized`: java synchronized 的 Python 实现

接下来我们会详细介绍上述典型接口的使用方式。


## 2. 代理对象 ObjectProxy
所谓代理包含两个层面的意思:
1. 将上层的请求传递给后端的对象
2. 将后端对象的返回值返回给上层的调用方

wrapt 模块的底层实现就是基于透明对象代理的包装器类。这种代理对象不仅代理了普通方法和属性的访问，也代理了众多内置方法和自省属性。这使得代理对象和被代理对象在 Python 的数据模型层面是完全一致。使用代理对象去代替被代理对象不会打破 Python 的内省机制。并且我们可以在代理对象上自定义属性和方法，以此来重载被代理对象的默认功能。

### 2.1 对象联动
```python
class ObjectProxy(with_metaclass(_ObjectProxyMetaType)):

    __slots__ = '__wrapped__'

    def __init__(self, wrapped):
      object.__setattr__(self, '__wrapped__', wrapped)
```

ObjectProxy 是 wrapt 代理功能实现的基类，通常不直接使用，而是作为自定义代理对象的基类使用。代理对象实现了如下功能:
1. 所有对代理对象的访问都会传递给被代理对象，包括比较操作，哈希这些 Python 的内置方法
1. 在代理对象上自定义的方法会覆盖被代理对象同名方法，因此我们可以通过代理对象实现对被代理对象的方法重载
2. 所有对代理对象**属性**的修改都会传递并修改后端的被代理对象
3. 对后端被代理对象**属性**的直接修改也会直接反映在代理对象之上

也就是说默认情况下，对 ObjectProxy 的操作，方法是重载的，而对属性的修改，是直接作用在被代理对象上的。

```python
>>> table = {}
>>> proxy = wrapt.ObjectProxy(table)
>>> proxy['key-1'] = 'value-1'
>>> proxy['key-2'] = 'value-2'

>>> proxy.keys()
['key-2', 'key-1']
>>> table.keys()
['key-2', 'key-1']

>>> isinstance(proxy, dict)
True
```


### 2.2 不可变对象
上述操作对于不可变对象的自操作是特例。

```python
>>> value = 1
>>> proxy = wrapt.ObjectProxy(value)
>>> type(proxy)
<type 'ObjectProxy'>

>>> proxy += 1

>>> type(proxy)
<type 'ObjectProxy'>

>>> print(proxy)
2
>>> print(value)
1
```

对于不可变对象，被代理对象保存的被代理对象的副本，因此对其自身的修改不会影响到后端的被代理对象。

### 2.3 类型比较
由于 Python 复杂的对象模型和底层设计，以及 instance 函数内在比较逻辑，想把 ObjectProxy 类型比较的原理说清楚实在不容易。这里就不深入见解了，简而言之 ObjectProxy 类实例的`__class__` 属性返回的是被代理对象的`__class__` 属性值，`instance()`在进行类型检查时，首先比较的是 `__class__`，所以对代理对象进行类型比较的结果与以被代理对象本身进行比较的结果完全一致。同时由于抽象基类机制，ObjectProxy 实例与 ObjectProxy 类的类型比较也能正常进行。

```python
>>> value = 1
>>> proxy = wrapt.ObjectProxy(value)
>>> type(proxy)
<type 'ObjectProxy'>

>>> class CustomProxy(wrapt.ObjectProxy):
...     pass

>>> proxy = CustomProxy(1)

>>> type(proxy)
<class '__main__.CustomProxy'>

# 与被代理对象的类型比较
>>> proxy.__class__
<type 'int'>

>>> isinstance(proxy, int)
True

# 与代理对象的类型比较
>>> isinstance(proxy, wrapt.ObjectProxy)
True
>>> isinstance(proxy, CustomProxy)
True
```

### 2.4 方法重载
方法重载只要在自定义代理对象上自定义同名的方法即可，在代理对象内，通过 `__wrapped__` 属性可以访问到原始的被代理的对象。

```python
def function():
    print('executing', function.__name__)

class CallableWrapper(wrapt.ObjectProxy):

    def __call__(self, *args, **kwargs):
        print('entering', self.__wrapped__.__name__)
        try:
            return self.__wrapped__(*args, **kwargs)
        finally:
            print('exiting', self.__wrapped__.__name__)

>>> proxy = CallableWrapper(function)

>>> proxy()
('entering', 'function')
('executing', 'function')
('exiting', 'function')
```

### 2.5 属性重载
因为对 ObjectProxy 属性的访问都会直接代理至后端被代理对象，那如何自定义 ObjectProxy 自身的属性呢？

方法一，任何以 `_self_` 开头的属性只会保存在 ObjectProxy 上，不会传递给后端的被代理对象

```python
def function():
    print('executing', function.__name__)

class CallableWrapper(wrapt.ObjectProxy):

    def __init__(self, wrapped, wrapper):
        super(CallableWrapper, self).__init__(wrapped)
        self._self_wrapper = wrapper

    def __call__(self, *args, **kwargs):
        return self._self_wrapper(self.__wrapped__, args, kwargs)

def wrapper(wrapped, args, kwargs):
      print('entering', wrapped.__name__)
      try:
          return wrapped(*args, **kwargs)
      finally:
          print('exiting', wrapped.__name__)

>>> proxy = CallableWrapper(function, wrapper)

>>> proxy._self_wrapper
<function wrapper at 0x1005961b8>

>>> function._self_wrapper
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
AttributeError: 'function' object has no attribute '_self_wrapper'
```

方法二，借助于 `@property`，定义属性描述符
```python
class CustomProxy(wrapt.ObjectProxy):

    def __init__(self, wrapped):
        super(CustomProxy, self).__init__(wrapped)
        self._self_attribute = 1

    @property
    def attribute(self):
        return self._self_attribute

    @attribute.setter
    def attribute(self, value):
        self._self_attribute = value

    @attribute.deleter
    def attribute(self):
       del self._self_attribute

>>> proxy = CustomProxy(1)
>>> print proxy.attribute
1
>>> proxy.attribute = 2
>>> print proxy.attribute
2
>>> del proxy.attribute
>>> print proxy.attribute
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
AttributeError: 'int' object has no attribute 'attribute'
```

方法三，将属性定义为类属性
```python
>>> class CustomProxy(ObjectProxy):
...     attribute = None
...
>>> def function():
...     print('executing', function.__name__)
...
>>> j = CustomProxy(function)
>>> j.attribute = 2
>>>
>>> function.attribute = 5

>>> print(j.attribute)
2
>>> print(function.attribute)
5
```

## 3. 扩展的代理对象
除了默认 ObjectProxy 代理基类，wrapt 还提供了另外两个通用的代理对象。

### 3.1 CallableObjectProxy
```python
class CallableObjectProxy(ObjectProxy):

    def __call__(self, *args, **kwargs):
        return self.__wrapped__(*args, **kwargs)
```

CallableObjectProxy 代理对象专用于代理函数，只是额外的附加了`__call__`方法，让代理对象成为可调用对象。


### 3.2 WeakFunctionProxy
```python
# 代理有点长，不粘了，有兴趣查看 wrapt 的源码
class WeakFunctionProxy(ObjectProxy):

    __slots__ = ('_self_expired', '_self_instance')

    def __init__(self, wrapped, callback=None):
```

默认情况下，代理对象通过 `__wrapped__` 属性保存了对被代理对像的引用，这样会导致被代理对象始终被引用而无法被垃圾处理器收回，WeakFunctionProxy 的作用就是实现在代理对象中实现对被代理对象的弱引用。在代理对象中实现弱引用并不容易，特别是对绑定方法对象的处理，以及要避免在回调函数中出现循环引用。有兴趣的同学可以看看 wrapt 的源代码。

### 3.3 自定义代理对象
如上述两个内置扩展的代理对象，通过继承 ObjectProxy，我们也可以自定代理对象。代理对象中的方法会覆盖被代理对象的同名方法，利用这个特性我们可以重载被代理对象的行为，这在单元测试中经常使用，待会会有使用的详细示例。

## 4. 包装对象
下面是在代理对象基础上实现包装器的简单示例，包装器继承自 wrapt.ObjectProxy，并将被代理对象作为参数传递给 ObjectProxy，从而具备了代理功能，并在此基础上附加了描述协议的处理逻辑。我们需要使用或者自定义包装对象的情景很少，此处不再对其作过多描述。

```python
class CallableWrapper(wrapt.ObjectProxy):

    def __init__(self, wrapped, wrapper):
        super(CallableWrapper, self).__init__(wrapped)
        self._self_wrapper = wrapper

    def __get__(self, instance, owner):
        function = self.__wrapped__.__get__(instance, owner)
        return BoundCallableWrapper(function, self._self_wrapper)

    def __call__(self, *args, **kwargs):
        return self._self_wrapper(self.__wrapped__, args, kwargs)
```

## 5. 辅助测试
### 5.1 工厂函数
wrapt 中有三个辅助测试的包装对象
5. `wrapt.wrap_function_wrapper`: 创建猴子补丁的工厂函数，会创建永久有效的补丁
6. `wrapt.patch_function_wrapper`: 简化 `wrapt.wrap_function_wrapper` 的装饰器函数
7. `wrapt.transient_function_wrapper`: 创建一个仅仅限于特定范围的临时补丁

下面是它们的使用实例

```python
def wrapper(wrapped, instance, args, kwargs):
    return wrapped(*args, **kwargs)

class Example(object):
    def name(self):
        return 'name'

import wrapt

# 版本一
wrapt.wrap_function_wrapper(Example, 'name', wrapper) # 等同于
wrapt.wrap_function_wrapper('example', 'Example.name', wrapper)

# 版本二
@wrapt.patch_function_wrapper('example', 'Example.name')
def wrapper(wrapped, instance, args, kwargs):
    return wrapped(*args, **kwargs)

# 版本三，wrapper 只对 test_method() 函数有效
@transient_function_wrapper('example', 'Example.name')
def wrapper(wrapped, instance, args, kwargs):
    return wrapped(*args, **kwargs)

@wrapper                        
def test_method():
    pass
```

### 5.2 高阶用法
除了上述简单的使用示例外，[12 使用 wrapt 辅助测试](/wrapt/python_decorator_12.md/) 还有更高级的使用示例，下面是示例代码。

#### 包装一个返回函数的被包装对象
```python
from wrapt import transient_function_wrapper, function_wrapper

def function():
    pass

class ProductionClass(object):
    def method(self, a, b, c, key):
        return function

@function_wrapper
def result_function_wrapper(wrapped, instance, args, kwargs):
    return wrapped(*args, **kwargs)

@transient_function_wrapper(__name__, 'ProductionClass.method')
def apply_ProductionClass_method_wrapper(wrapped, instance, args, kwargs):
    return result_function_wrapper(wrapped(*args, **kwargs))

@apply_ProductionClass_method_wrapper
def test_method():
    real = ProductionClass()
    func = real.method(3, 4, 5, key='value')
    result = func()
```

#### 包装一个类示例的被包装对象
```python
from wrapt import transient_function_wrapper, function_wrapper

class StorageClass(object):
    def run(self):
        pass

storage = StorageClass()

class ProductionClass(object):
    def method(self, a, b, c, key):
        return storage

@function_wrapper
def run_method_wrapper(wrapped, instance, args, kwargs):
    return wrapped(*args, **kwargs)

@transient_function_wrapper(__name__, 'ProductionClass.method')
def apply_ProductionClass_method_wrapper(wrapped, instance, args, kwargs):
    storage = wrapped(*args, **kwargs)
    storage.run = run_method_wrapper(storage.run)
    return storage

@apply_ProductionClass_method_wrapper
def test_method():
    real = ProductionClass()
    data = real.method(3, 4, 5, key='value')
    result = data.run()
```

## 6. synchronized
`synchronized` 装饰器实现了 java 中的同步原语 synchronized 功能。`synchronized` 功能和实现请参阅 [07 实现 java 的 @synchronized 装饰器](/wrapt/python_decorator_07.md/)，下面是其使用方式

### 6.1 作为装饰器
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

### 6.2 作为上下文管里器
```python
class Class(object):

    @synchronized
    def function_im_1(self):
        pass

    def function_im_2(self):
        with synchronized(self):
            pass

class Class(object):

    @synchronized
    @classmethod
    def function_cm(cls):
        pass

    def function_im(self):
        with synchronized(Class):
            pass
```

### 6.3 基于任意对象作同步
除了使用默认的内置锁，`synchronized` 支持接收任意对象实现同步。但是作为同步而传入的对象必需能添加属性，因为 `synchronized` 会在传入的对象上保存创建的锁对象。因此为解除这个限制，`synchronized` 也支持传入支持 `.require` 和 `.release` 的类锁对象实现同步。

```python
class Data(object):
    pass

data = Data()

def function_1():
    with synchronized(data):
        pass

def function_2():
    with synchronized(data):
        pass

# synchronized 使用到了 vars(data)，任何没有 `__dict__` 属性的对象，都会调用失败
>>> vars({})
Traceback (most recent call last):
  File "/usr/lib/python2.7/site-packages/IPython/core/interactiveshell.py", line 2882, in run_code
    exec(code_obj, self.user_global_ns, self.user_ns)
  File "<ipython-input-3-880c6250c41c>", line 1, in <module>
    vars({})
TypeError: vars() argument must have __dict__ attribute
```

### 6.4 基于传入的类锁对象作同步
```python
semaphore = threading.Semaphore(2)

@synchronized(semaphore)
def function():
    pass
```

任何支持 `acquire()` 和 `release()` 对象均可作为 `synchronized`的参数，因此用户可传入包含这两个方法的自定义对象来实现额外的功能。

## 7. decorator
```python
def decorator(wrapper=None, enabled=None, adapter=None):
    pass
```

`decorator` 工厂函数是 `function_wrapper` 工厂函数的升级版本，在装饰器基础上添加了另外两个控制功能，`enabled` 和 `adapter`参数必需作为关键词参数被使用。

### 7.1 装饰启动开关
#### 静态控制
`enabled` 参数用于控制装饰器是否被启用，接收布尔值作为参数，`enabled=True` 时，装饰器正常启用，
`enabled=False` 时不会应用任何包装器。因此，这提供了一种方便的方法，可以全局禁用特定的decorator，而不必删除decorator的所有用法，或者使用decorator函数的特殊变体。

```python
ENABLED = False

@wrapt.decorator(enabled=ENABLED)
def pass_through(wrapped, instance, args, kwargs):
    return wrapped(*args, **kwargs)

@pass_through
def function():
    pass

>>> type(function)
<type 'function'>
```
#### 动态控制
在定义修饰符时为启用的选项提供一个布尔值，从而控制修饰符是否应该应用。因此，这是一个全局开关，一旦禁用，就无法在运行时在进程执行时动态地重新启用它。类似地，一旦启用，就不能禁用它。

提供布尔值的另一种方法是为enabled提供一个可调用对象 callable，该值返回一个布尔值。每次调用修饰函数时都将调用callable。如果callable返回True，表示decorator是活动的，则将调用包装器函数。如果callable返回False，包装器函数将被绕过，原始包装函数将被直接调用。

如果enabled不是None、布尔值或可调用值，则将对提供的对象执行布尔检查。这允许使用支持逻辑操作的定制对象。如果定制对象计算为False，包装器函数将再次被绕过。

```python
def _enabled():
    return True

@wrapt.decorator(enabled=_enabled)
def pass_through(wrapped, instance, args, kwargs):
    return wrapped(*args, **kwargs)
```

### 7.2 更改签名信息
默认的包装函数的签名来自被包装对象，`adapter` 参数的作用用于修改包装函数的签名信息。其接收一个函数作为参数，此函数的签名信息将作为包装函数的签名信息被返回。这个用的很少，就不再累述了。

## 实战
有关 wrapt 的模块的实现和接口到此就介绍完了，在本系列博客的开篇我提到了我使用装饰器的一个典型应用场景: 对数据库查询实现分批操作。在接下来的的博客中，作为实战篇，我们来看看如何通过 wrapt 实现这个比较通用的需求。
