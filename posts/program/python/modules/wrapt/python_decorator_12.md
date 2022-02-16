---
title: 12 使用 wrapt 辅助测试
date: 2018-06-03
categories:
    - Python
tags:
    - wrapt
---
![Python decorator](/images/python/decorator.jpg)

前面我们说道过 Python 中使用猴子补丁典型情景之一就是使用模拟库来帮助执行单元测试，本节我们先把补丁和模块导入的相对次序问题放一放，先来看看如何使用 wrapt 模块辅助单元测试。
<!-- more -->

## 1. 使用 wrapt 进行测试
在Python中讨论单元测试时，用于辅助该任务的比较流行的包之一是 mock 包。但是我(wrapt 的作者)觉得 mock 包不符合我的思维方式。

也可能只是我试图应用它的东西不太适合。在我想要测试的内容中，通常我不仅想要模拟更低的层，而且我想要验证传递到下一层的数据，或者修改结果。换句话说，我通常仍然需要系统作为一个整体来结束，并可能在很长一段时间内。

因此，对于我需要做的更复杂的测试，我实际上一直在依靠wrapt的猴子补丁功能。很有可能，因为我写了wrapt，我更熟悉它的范例，或者我更倾向于更明确的方式。不管怎样，至少对我来说，wrapt 能帮助我更快地完成工作。

为了进一步解释 wrapt 的猴子补丁功能，我在这篇博客文章中向大家展示了用wrapt模块实现部分 Mock 包的功能。只要记住，对于Mock模块我是一个绝对的新手，也可能也我太笨了，不能理解如何正确简单地使用它来做我想做的事情。

### Return values and side effects
如果你正在使用Mock，并且希望在调用时临时覆盖类的方法返回的值，一种方法是:

```python
from mock import Mock, patch

class ProductionClass(object):
    def method(self, a, b, c, key):
        print a, b, c, key

@patch(__name__+'.ProductionClass.method', return_value=3)
def test_method(mock_method):
    real = ProductionClass()
    result = real.method(3, 4, 5, key='value')
    mock_method.assert_called_with(3, 4, 5, key='value')
    assert result == 3
```

就我迄今为止提出的wrapt包而言，一种类似的做法是:

```python
from wrapt import patch_function_wrapper

class ProductionClass(object):
    def method(self, a, b, c, key):
        print a, b, c, key

@patch_function_wrapper(__name__, 'ProductionClass.method')
def wrapper(wrapped, instance, args, kwargs):
    assert args == (3, 4, 5) and kwargs.get('key') == 'value'
    return 3

def test_method():
    real = ProductionClass()
    result = real.method(3, 4, 5, key='value')
    assert result == 3
```

不过，这里的一个问题是，`wrapt.patch_function_wrapper()`函数应用了一个永久补丁。在这个过程的生命周期中，这是可以的，但是在测试的情况下，我们通常希望一个补丁只应用于当时正在运行的单个单元测试函数。因此，补丁应该在测试结束时和调用下一个函数之前应该被删除。

对于该场景，wrapt包提供了另一个装饰器`@wrapt.transient_function_wrapper`。用来创建一个包装函数，该函数只应用于修饰函数所应用的特定调用的范围。因此，我们可以把上面写为:

```python
from wrapt import transient_function_wrapper

class ProductionClass(object):
    def method(self, a, b, c, key):
        print a, b, c, key

@transient_function_wrapper(__name__, 'ProductionClass.method')
def apply_ProductionClass_method_wrapper(wrapped, instance, args, kwargs):
    assert args == (3, 4, 5) and kwargs.get('key') == 'value'
    return 3

@apply_ProductionClass_method_wrapper
def test_method():
    real = ProductionClass()
    result = real.method(3, 4, 5, key='value')
    assert result == 3
```

尽管这个示例展示了如何临时覆盖类的方法返回的值，但更典型的情况是，我们仍然希望能够调用原始的被覆盖的函数。可能验证传入的参数或从底层返回的返回值。当我尝试用Mock解决这个问题时，我想到的一般方法如下。

```python
from mock import Mock, patch

class ProductionClass(object):
    def method(self, a, b, c, key):
        print a, b, c, key

def wrapper(wrapped):
    def _wrapper(self, *args, **kwargs):
        assert args == (3, 4, 5) and kwargs.get('key') == 'value'
        return wrapped(self, *args, **kwargs)
    return _wrapper

@patch(__name__+'.ProductionClass.method', autospec=True,
        side_effect=wrapper(ProductionClass.method))
def test_method(mock_method):
    real = ProductionClass()
    result = real.method(3, 4, 5, key='value')
```

这里有两个技巧
1. 第一个是`@Mock.path` 的 `autospec=True`参数，用于执行方法绑定
2. 第二个是需要在对它应用任何mock之前从'ProductionClass'捕获原始方法，这样当调用mock的副作用函数时，我就可以反过来调用它。

毫无疑问，有人会告诉我，我做错了，有一种更简单的方法，但这是我在阅读模拟文档10分钟后所能想到的最好的方法。

当使用wrapt执行相同的操作时，使用的方式与模拟返回值没有什么不同。这是因为wrapt函数包装器能同时适用普通函数或方法，所以在包装方法时不需要额外处理。此外，当调用wrapt包装函数时，它总是传递被包装的原始函数，因此不需要使用任何魔法来隐藏它。

```python
from wrapt import transient_function_wrapper

class ProductionClass(object):
    def method(self, a, b, c, key):
        print a, b, c, key

@transient_function_wrapper(__name__, 'ProductionClass.method')
def apply_ProductionClass_method_wrapper(wrapped, instance, args, kwargs):
    assert args == (3, 4, 5) and kwargs.get('key') == 'value'
    return wrapped(*args, **kwargs)

@apply_ProductionClass_method_wrapper
def test_method():
    real = ProductionClass()
    result = real.method(3, 4, 5, key='value')
```

使用此功能可以轻松地拦截调用，来执行传递的数据的验证，但仍然可调用原始函数，我可以相对轻松地创建一大堆装饰器，以便对数据执行验证，因为数据可能是通过系统的不同部分传递的。然后，我可以将这些装饰器堆叠在任何需要添加它们的测试函数上。

## 2. 包装不同类型的返回值
### 返回函数
上面的示例包括能够返回一个假的返回值，返回原始值，或者在部分原始数据类型或集合上进行一些轻微的修改。但在某些情况下，我实际上希望在返回值周围放置一个包装器，以修改后续代码与返回值的交互方式。

第一个例子是包装函数返回另一个函数，这个函数将被调用链中更高的函数调用。在这里，我可能想在返回的函数周围放置一个包装器，以便在调用它时拦截它。

Mock 包的使用方式如下
```python
from mock import Mock, patch

def function():
    pass

class ProductionClass(object):
    def method(self, a, b, c, key):
        return function

def wrapper2(wrapped):
    def _wrapper2(*args, **kwargs):
        return wrapped(*args, **kwargs)
    return _wrapper2

def wrapper1(wrapped):
    def _wrapper1(self, *args, **kwargs):
        func = wrapped(self, *args, **kwargs)
        return Mock(side_effect=wrapper2(func))
    return _wrapper1

@patch(__name__+'.ProductionClass.method', autospec=True,
        side_effect=wrapper1(ProductionClass.method))
def test_method(mock_method):
    real = ProductionClass()
    func = real.method(3, 4, 5, key='value')
    result = func()
```

整个包装过程说明如下:
1. `ProductionClass.method` 函数返回值是另一个函数
2. `side_effect` 指定了第一层的包装函数 `wrapper1`，截获了`ProductionClass.method` 返回的 function 函数
3. `wrapper1` 将 function 包装再 `wrapper2` 内返回给了调用链中更高层的函数
4. 更高层的函数调用 function 时，调用的则是 `wrapper2`


wrapt 包的使用方式:

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
整个包装过程说明如下:
1. `apply_ProductionClass_method_wrapper` 装饰了原始的 `ProductionClass.method` 方法
2. `apply_ProductionClass_method_wrapper` 内 `wrapped(*args, **kwargs)` 返回结果就是 function，其又被 `result_function_wrapper` 装饰
3. 调用链中更高层的函数调用 `ProductionClass.method`，实际调用的是 `result_function_wrapper`

本例使用了一个名为`@wrapt.function_wrapper`的新装饰器。还可以使用`@wrapt.decorator`。`@wrapt.function_wrapper` 实际上只是`@wrapt.decorator`的一个简化版本，它缺少一些在做显式的猴子补丁时通常不需要的铃铛和口子，但除此之外，它也可以用同样的方式使用。因此，我可以对结果返回的函数应用一个包装器。我甚至可以应用相同的原理应用在当函数作为参数传递给另一个函数的情况。

#### 返回类的实例
返回函数的另一个场景是返回类的实例。在这种情况下，我可能想要对类的实例的特定方法应用一个包装器。在mock 包中，需要再次使用“Mock”类，并且必须以不同的方式应用它来实现您想要的结果。现在我将不再关注mock，只关注wrapt的实现方式。

所以，根据需求，有几种方法可以用wrapt来实现。第一个方法是用封装原始方法的包装器直接替换实例上的方法

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
包装过程是:
1. `apply_ProductionClass_method_wrapper` 包装了 `ProductionClass.method`
2. `run_method_wrapper` 包装 `ProductionClass.method` 的返回值 `storage.run`

这样可以得到想要的结果，但在本例中，实际上是一种糟糕的方法。问题是返回的对象是一个在测试之外有生命时间的对象。也就是说，我们正在修改一个存储在全局范围内的对象，该对象可能用于其他测试。通过简单地替换实例上的方法，我们进行了永久性的更改。

如果它是一个仅为一次调用而按需创建的类的临时实例，那么这是可以的，但是在其他情况下不行，因为它的影响是持久的。因此，我们不能修改实例本身，需要以其他方式封装实例来拦截方法调用。

为此，我们使用了所谓的对象代理。这是一个特殊的对象类型，我们可以创建一个实例来包装另一个对象。当访问代理对象时，任何访问属性的尝试都会从包装对象返回属性。类似地，调用代理上的方法将调用包装对象上的方法。

但是，拥有一个不同的代理对象允许我们更改代理对象上的行为，从而更改代码与包装对象的交互方式。因此，我们可以避免更改原始对象本身。因此，对于这个例子，我们可以做的是:

```python
from wrapt import transient_function_wrapper, ObjectProxy

class StorageClass(object):
    def run(self):
        pass

storage = StorageClass()

class ProductionClass(object):
    def method(self, a, b, c, key):
        return storage

class StorageClassProxy(ObjectProxy):
    def run(self):
        return self.__wrapped__.run()

@transient_function_wrapper(__name__, 'ProductionClass.method')
def apply_ProductionClass_method_wrapper(wrapped, instance, args, kwargs):
    storage = wrapped(*args, **kwargs)
    return StorageClassProxy(storage)

@apply_ProductionClass_method_wrapper
def test_method():
    real = ProductionClass()
    data = real.method(3, 4, 5, key='value')
    result = data.run()
```
整个包装过程如下:
1. `apply_ProductionClass_method_wrapper` 包装了 `ProductionClass.method`
2. 使用代理对象 `StorageClassProxy` 代理了对 `storage` 实例属性和方法的访问
3. `StorageClassProxy` 覆盖了 `storage` 的 `run` 方法

也就是说，我们在代理对象上定义`run()`方法，以拦截原始对象上相同方法的调用。然后我们可以继续返回假值，验证参数或结果，或者根据需要修改它们。通过代理，我们甚至可以通过向代理对象添加属性来拦截对原始对象属性的访问。

```python
from wrapt import transient_function_wrapper, ObjectProxy

class StorageClass(object):
    def __init__(self):
        self.name = 'name'

storage = StorageClass()

class ProductionClass(object):
    def method(self, a, b, c, key):
        return storage

class StorageClassProxy(ObjectProxy):
    @property
    def name(self):
        return self.__wrapped__.name

@transient_function_wrapper(__name__, 'ProductionClass.method')
def apply_ProductionClass_method_wrapper(wrapped, instance, args, kwargs):
    storage = wrapped(*args, **kwargs)
    return StorageClassProxy(storage)

@apply_ProductionClass_method_wrapper
def test_method():
    real = ProductionClass()
    data = real.method(3, 4, 5, key='value')
    assert data.name == 'name'
```

## 3. 更好的使用 Mock 模块
这时你可能会说Mock做的远不止这些。你甚至可能想指出 mock 如何保存了调用的细节，这样就可以回溯，而不需要进行打点测试，这样甚至可以避免打点测试触发的异常被意外捕获的情况。

这是正确的，我们的意思是不要局限于使用基本的构建块本身，可以将多个模块结合使用，wrapt 是构建更好的模拟库进行测试的一个很好的基础。因此，我留给你们最后一个例子来让你们思考，如何使用 mock 来实现。

```python
from wrapt import transient_function_wrapper

class ProductionClass(object):
    def method(self, a, b, c, key):
        pass

def patch(module, name):
    def _decorator(wrapped):
        class Wrapper(object):
            @transient_function_wrapper(module, name)
            def __call__(self, wrapped, instance, args, kwargs):
                self.args = args
                self.kwargs = kwargs
                return wrapped(*args, **kwargs)
        wrapper = Wrapper()
        @wrapper
        def _wrapper():
            return wrapped(wrapper)
        return _wrapper
    return _decorator

@patch(__name__, 'ProductionClass.method')
def test_method(mock_method):
    real = ProductionClass()
    result = real.method(3, 4, 5, key='value')
    assert real.method.__name__ == 'method'
    assert mock_method.args == (3, 4, 5)
    assert mock_method.kwargs.get('key') == 'value'

```

这是 wrapt 包实现猴子补丁的概览。还有一些其他的东西，但这是核心部分。我使用猴子补丁将工具添加到现有代码中以支持性能监视，但是我在这里展示了如何将相同的技术用于编写代码测试，以替代Mock等包。

正如我在上一篇文章中提到的，猴子补丁的一个主要问题是模块的导入结果与打补丁完成的时间相关。我将在下一篇文章中进一步讨论这个问题。
