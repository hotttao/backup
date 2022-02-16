---
title: 13 猴子补丁在 Python 中的加载次序问题
date: 2018-06-04
categories:
    - Python
tags:
    - wrapt
---
![Python decorator](/images/python/decorator.jpg)

本节我们就来解决如何在 Python 中打补丁的问题。
<!-- more -->

## 1. 猴子补丁的加载次序问题
在第 11 篇博客中，我们提到了应用猴子补丁时可能存在的问题。具体地说，如果需要被打补丁的模块已经被导入并被其他代码使用，那么它可能已经在自己的名称空间中创建了一个被打补丁的目标函数的本地引用。因此，尽管猴子补丁可以正常工作，但是仍然无法覆盖这种原始函数已经导入，并过通过本地引用直接访问原始函数的情况。

导入次序问题的解决方案之一是所谓的导入钩子。这是在PEP 369中描述的一种机制，虽然它从未进入Python核心，但是仍然可以使用现有的api将这种能力移植到Python中。然后，在模块导入目标函数并在自己的名称空间中创建对函数的引用之前，我们可以添加其他功能来发现猴子补丁代码，并在导入模块时自动应用它。

### Post import hook mechanism
暂时将 "Post import hook" 称为导入后勾子。导入后勾子机制在 PEP 369 中有一个使用示例:

```python
import imp

@imp.when_imported('decimal')
def register(decimal):
    Inexact.register(decimal.Decimal)
```

其基本思想是，当看到这段代码时，它将导致在Python导入系统中注册一个回调，以便在导入`decimal`模块时，调用装饰器应用的`register()`函数。`register()`函数的参数是对被注册的模块的引用。然后，该函数可以对模块执行一些操作，最后再将模块返回到最初请求导入的代码中。除了使用作为装饰器的`@imp.where_imported`函数 ，还可以显式地使用`imp.register_post_import_hook()` 函数来注册导入后钩子。

```python
import imp

def register(decimal):
    Inexact.register(decimal.Decimal)

imp.register_post_import_hook(register, 'decimal')
```

尽管PEP 369从未被合并到Python中，但是wrapt 提供了类似功能的装饰器和函数。尽管装饰器和函数被用来解决导入次序问题。但如果目标模块在导入后钩子函数执行之前就已经被导入，我们仍会面临导入次序问题。

这个问题最简单的解决方案是修改应用程序的主Python脚本，并将您需要的所有的"导入后勾子"的注册设置为绝对的第一件事。也就是说，在从应用程序导入任何其他模块包括任何解析命令行参数的标准库之前注册"导入后勾子"。

尽管你确实可以做到这一点，但是由于注册函数会发生事实上的调用，这意味注册函数的执行可能转而导入那些将要被打补丁的模块，所以依然可能发生导入错误。

有一种间接的方式可以解决所有的问题，下面是应用这个原则的例子。方法是相对于导入猴子补丁代码，我们创建一个注册函数，只有当被补丁的模块被导入，猴子补丁才会被惰性加载，之后才会被执行。

```python
import sys

from wrapt import register_post_import_hook

def load_and_execute(name):
    def _load_and_execute(target_module):
        __import__(name)
        patch_module = sys.modules[name]
        getattr(patch_module, 'apply_patch')(target_module)
    return _load_and_execute

register_post_import_hook(load_and_execute('patch_tempfile'), 'tempfile')

```

patch_tempfile.py代码如下:

```python
from wrapt import wrap_function_wrapper

def _mkdtemp_wrapper(wrapped, instance, args, kwargs):
    print 'calling', wrapped.__name__
    return wrapped(*args, **kwargs)

def apply_patch(module):
    print 'patching', module.__name__
    wrap_function_wrapper(module, 'mkdtemp', _mkdtemp_wrapper)
```

使用交互式解释器运行第一个脚本，以便将我们留在解释器中，然后，我们可以显示导入`tempfile`模块并执行`mkdtemp()`函数，看看会发生什么。

```python
$ python -i lazyloader.py
>>> import tempfile
patching tempfile
>>> tempfile.mkdtemp()
calling mkdtemp
'/var/folders/0p/4vcv19pj5d72m_bx0h40sw340000gp/T/tmpfB8r20'
```

上述整个导入过程是这样的:
1. `register_post_import_hook` 为 `tempfile` 模块注册了 `_load_and_execute` 函数
2. `import tempfile` 时，会先执行 `_load_and_execute` 函数，此时会加载`patch_tempfile` 模块，并执行 `apply_patch` 函数
3. `apply_patch` 接收 `tempfile` 模块对象作为参数后执行，并使用 `wrap_function_wrapper` 函数为 `mkdtemp` 打上补丁。
4. `mkdtemp` 执行的就是打补丁之后的函数
4. 整个过程，`tempfile` 模块被导入时，猴子补丁才被惰性加载。

换句话说，与大多数猴子补丁不同，我们并不是强行导入一个模块，以便在可能使用的基础上应用猴子补丁。相反，猴子补丁代码保持休眠和未使用，直到目标模块稍后被导入。如果没有导入目标模块，则该模块的猴子补丁代码本身甚至没有导入。

## 3. 发现导入后勾子
如上所述，导入后钩子提供了一种稍微更好的方法来设置猴子补丁，以便应用它们。这是因为只有当包含要修补的函数的目标模块被导入时，它们才会被激活。这避免了不必要地导入可能不使用的模块，否则会增加应用程序的内存使用。

导入次序仍然很重要，因此，要确保在导入任何其他模块之前设置所有导入后钩子。并且在每次更改应用的猴子补丁后，需要修改应用程序代码。如果只是为了调试问题而频繁地添加猴子补丁，则可能不太方便。

后一个问题的解决方案是将猴子补丁分离到单独的模块中，并使用一个注册机制来宣布它们的可用性。然后，Python应用程序可以在一开始就执行通用的模板代码，该代码根据提供的配置发现应该应用哪些猴子补丁。注册机制将允许在运行时发现猴子补丁模块。

这里可以使用的一种特殊的注册机制是`setuptools`入口点。使用这个我们可以打包猴子补丁，这样它们就可以被单独安装以备使用。这样一套方案的结构是:

```python
setup.py
src/__init__.py
src/tempfile_debugging.py
```

这个包的 setup.py 代码将会是:

```python
from setuptools import setup

NAME = 'wrapt_patches.tempfile_debugging'

def patch_module(module, function=None):
    function = function or 'patch_%s' % module.replace('.', '_')
    return '%s = %s:%s' % (module, NAME, function)

ENTRY_POINTS = [
    patch_module('tempfile'),
]

setup_kwargs = dict(
    name = NAME,
    version = '0.1',
    packages = ['wrapt_patches'],
    package_dir = {'wrapt_patches': 'src'},
    entry_points = { NAME: ENTRY_POINTS },
)

setup(**setup_kwargs)
```

作为一种约定，我们使用命名空间包，以便我们的猴子补丁模块易于识别。在本例中，父包将是`wrapt_patch`，因为我们专门使用wrapt。这个特定包的名称将是`wrapt_patch.tempfile_debug`,表示我们将创建一些猴子补丁，以帮助我们调试使用`tempfile`模块。

`setup.py`的关键部分是定义`entry_points`。它将被设置成程序包名到猴子补丁映射的列表，这个列表包含了这个补丁模块要作用的所有目标Python模块。此处 `ENTRY_POINTS` 的值为

```python
ENTRY_POINTS = [
    'tempfile = wrapt_patches.tempfile_debugging:patch_tempfile',
]
```

`src/init.py` 将包含:

```python
import pkgutil
__path__ = pkgutil.extend_path(__path__, __name__)
```

这是创建命名空间包的要求。最后，猴子补丁实际上包含在`src/tempfile_debug`中。代码跟以前很像。

```python
from wrapt import wrap_function_wrapper

def _mkdtemp_wrapper(wrapped, instance, args, kwargs):
    print 'calling', wrapped.__name__
    return wrapped(*args, **kwargs)

def patch_tempfile(module):
    print 'patching', module.__name__
    wrap_function_wrapper(module, 'mkdtemp', _mkdtemp_wrapper)
```

定义了包后，我们将它安装到正在使用的Python安装或虚拟环境中。现在，我们可以在Python应用程序主脚本文件的开头添加显式的注册，我们将添加:

```python
import os

from wrapt import discover_post_import_hooks

patches = os.environ.get('WRAPT_PATCHES')

if patches:
    for name in patches.split(','):
        name = name.strip()
        if name:
            print 'discover', name
            discover_post_import_hooks(name)
```

如果我们在没有为猴子补丁特定配置的情况下运行应用程序，那么什么也不会发生。如果它们是启用的，那么它们将被自动发现并根据需要应用。

```python
$ WRAPT_PATCHES=wrapt_patches.tempfile_debugging python -i entrypoints.py
discover wrapt_patches.tempfile_debugging
>>> import tempfile
patching tempfile
```

理想的情况是，如果PEP 369真的进入了Python的核心，那么将类似的引导机制合并到Python本身中，以便在解释器初始化过程中尽早强制对猴子补丁进行注册。有了这一点，我们就有了一种有保证的方法来解决在做猴子补丁时的导入次序问题。

由于现在PEP 369还未进入Python的核心，所以我们在本例中所做的是修改Python应用程序自己添加引导代码，以便在应用程序执行的最开始执行注册。当应用程序归自己管理时这是可以的，但是如果想要对第三方应用程序进行打补丁，并且不希望修改其代码，那该怎么办呢?在这种情况下有什么选择?

在这种情况下可以使用一些技巧。下一篇关于猴子补丁主题的博文中我们将讨论为应用程序打补丁的可用选项。
