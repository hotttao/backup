---
weight: 1
title: 11 在 Python 中安全的使用猴子补丁
date: '2018-06-02T22:10:00+08:00'
lastmod: '2018-06-02T22:10:00+08:00'
draft: false
author: 宋涛
authorLink: https://hotttao.github.io/
description: 11 在 Python 中安全的使用猴子补丁
featuredImage: null
tags:
- python 库
categories:
- Python
lightgallery: true
---


在之前 10 篇博客中，我们几乎完整的讨论了装饰器的实现。现在我们将焦点从装饰器转移到猴子补丁上来。
<!-- more -->

## 1. 猴子补丁
通常在Python中永远不应该做的事情之一就是编写猴子补丁。但有些人认为这是一种有用的必需品，你可能无法避免修补第三方代码中的错误。其他人则可能会争辩说，现在有这么多的软件是开源的，所以您应该简单地向上游包维护人员提交一个补丁。

猴子补丁除了补丁还有其他用途。在Python中最常用的两种形式的猴子补丁是装饰器和使用模拟库来帮助执行单元测试，甚至你可能不把它与猴子补丁等同起来。另一个不常见的猴子补丁的例子是对现有的Python代码添加性能监视功能。

前面我们介绍了装饰器可能会导致什么问题。主要的问题就是，装饰器的实现方式可能没有保留适当的自省能力，当应用于类的方法时，它们可能也没有保留Python描述符协议的正确语义。当人们开始讨论如何修改任意代码，而不是简单地对自己的代码应用装饰器时，这两个问题就变得更加重要了，因为可能很容易地干扰现有代码的行为，或者以意想不到的方式打补丁。

典型的案例是，对一个类方法打补丁。与装饰器在类被创建时即运行不同，补丁代码运行时，类已经被创建，因此需要额外处理一些潜在问题。

我打算用这篇博文来解释wrapt包的猴补丁功能。尽管 wrapt 模块提供了创建装饰器的良好方式，但这并不是创建该包的主要目标。创建wrapt包的真正原因实际上是为猴子补丁代码实现健壮的机制。碰巧，安全执行猴子补丁所需的基本原则和机制也适用于实现装饰器。

## 2. 创建一个装饰器
在开始修改任意代码之前，我们首先需要重新复述一下wrapt包如何用于创建装饰器。主要模式是:

```python
import wrapt
import inspect

@wrapt.decorator
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

wrapt包创建装饰器的一个特性是，在装饰器中，可以确定装饰器所使用的上下文。即可以确定修饰符是被应用于类、函数或静态方法、类方法或实例方法中的哪一个。对于将装饰器应用于实例方法的情况，为类的实例提供了一个单独的参数。对于类方法，单独的参数是对类本身的引用。在这两种情况下，它们都与“args”和“kwargs”参数相分离，因此不需要自己动手提取它们。因此，我将使用wrapt创建的装饰器称为通用装饰器。换句话说，可以创建一个单独的装饰器，它可以跨函数、方法和类使用，可以在不同的调用场景中相应地调整装饰器的行为。而不再需要创建一个装饰器的多个实现，并确保在每个场景中都使用了正确的实现。

这种装饰器的使用与其他方式创建的装饰器无异。

```python
class Example(object):

    @universal
    def name(self):
        return 'name'
```

需要注意的是 `@` 符应用一个装饰器在Python2.4 中被加入。它仅仅是如下方式的语法糖

```python
class Example(object):

    def name(self):
        return 'name'
    name = universal(name)
```

这么写仍然可行，当以这种方式编写时，它使装饰者在某种程度上成为一种猴子补丁。这是因为猴子补丁通常所做的就是在一些现有函数周围引入一个包装器，这样就可以对原始函数进行拦截。然后，包装器函数允许在调用原始函数之前或之后执行操作，或者允许修改传递给包装函数的参数，或者以某种方式修改结果，或者甚至完全替换结果。

**与装饰器的一个重要区别是，装饰器在类被创建时即运行。相比之下，猴子补丁更随意，通常在类创建一段时间之后再执行。**

事实上你所作的是:

```python
class Example(object):
    def name(self):
        return 'name'

Example.name = universal(Example.name)
```

尽管使用wrapt包创建的装饰器函数可以以这种方式使用，并且仍将按预期工作，但总体而言，我不建议以这种模式给类的现有方法添加补丁。这是因为这种方式实际上并不等同于当类被定义时在类的主体内做同样的事情。特别是`Example.name`的访问实际上调用了描述符协议，因此返回了实例方法。我们可以通过运行代码看到这一点:

```python
class Example(object):
    def name(self):
        return 'name'
    print type(name)

print type(Example.name)
which produces:

<type 'function'>
<type 'instancemethod'>
```

一般来说，这可能并不重要，但我看到过一些非常奇怪的情况，它们的区别很重要。因此，为了解决这个问题，wrapt包提供了执行猴子补丁的另一种实现机制。在上面为类的方法添加包装器的情况下，使用这种机制可以避免由这种细微差别所引起的任何问题。

## 3. 猴子补丁创建
猴子补丁的创建与装饰器创建类似，首先需要创建一个包装函数，猴子补丁的包装函数与装饰器是一样的，如下图所示

```python
def wrapper(wrapped, instance, args, kwargs):
    return wrapped(*args, **kwargs)
```

不同的是不是使用装饰器工厂函数 `@wrapt.decorator` 创建装饰器并将其应用到被包装对象上，而是使用 `wrapt.wrap_function_wrapper()` 函数。

```python
class Example(object):
    def name(self):
        return 'name'

import wrapt

wrapt.wrap_function_wrapper(Example, 'name', wrapper)
```

在这种情况下，我们将类放在同一个代码文件中，但是我们也可以这样做:**

```python
import example
import wrapt

wrapt.wrap_function_wrapper(example, 'Example.name', wrapper)
```
也就是说，我们将目标所在的模块作为第一参数，第二个参数则是我们希望应用包装器的目标方法对象的路径。我们也可以完全跳过导入模块，只使用模块的名称。

```python
import wrapt

wrapt.wrap_function_wrapper('example', 'Example.name', wrapper)
```

为了证明任何东西都可以被装饰器简化，我们最终可以把整个东西写成:

```python
import wrapt

@wrapt.patch_function_wrapper('example', 'Example.name')
def wrapper(wrapped, instance, args, kwargs):
    return wrapped(*args, **kwargs)
```

在这个最后的示例中，将会发生的事情是，一旦导入了包含上述代码的模块，在“示例”模块中定义的指定目标函数将自动地使用包装器函数进行修补。

## 4. 延迟补丁问题
现在需要着重提醒的是。在上述的操作之后应用补丁并不总是有效的。

问题的核心在于，是否正在对一个已导入的模块应用补丁。如果模块没有导入，`wrap .wrap_function_wrapper()` 调用将确保模块被导入，但是如果模块已经被代码的其他部分或第三方包导入，那么可能就会有问题。

特别的是，您尝试打补丁的目标函数是模块的一个正常的全局函数，其他一些代码可以通过以下步骤直接获取对它的引用:

`from example import function`

如果你后来来了

```python
import wrapt

@wrapt.patch_function_wrapper('example', 'function')
def wrapper(wrapped, instance, args, kwargs):
    return wrapped(*args, **kwargs)
```

最后，目标模块中包含的函数的副本将应用包装器，但是其他代码创建的对它的引用将没有包装器。即在打补丁之后导入的目标函数都是被包装的，之前的都是未被包装的。

为了确保在此场景中始终使用包装器，您不仅需要在原始模块中，而且还需要在存储引用的任何模块中对其进行补丁。这只在非常有限的情况下是可行的因为在现实中，如果函数是一个普通的函数，你将不知道函数在哪里被使用。

这个问题的一个确切体现就是对`gevent`或`eventlet`等包打补丁时存在的问题。这两个包都延迟了功能的修补，因此对导入模块的顺序非常敏感。要解决这个问题，至少对于Python标准库中的模块来说，要打补丁的`time.sleep()`函数不仅需要在`time`模块中进行修补，还需要在`threading`模块中进行修补。

有一些技术可以用来尝试和避免这些问题，但我将把这些解释推迟到以后的一段时间。在我的下一篇博客文章中，我想介绍一些使用使用猴子补丁示例，看看如何在进行测试时使用wrapt替代 mock 模块。
