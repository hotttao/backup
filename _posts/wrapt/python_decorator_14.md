---
title: 14 为 Python 应用自动打补丁
date: 2018-06-05
categories:
    - Python
tags:
    - wrapt
    - 函数装饰器
---
![Python decorator](/images/python/decorator.jpg)

前面我们已经决绝了猴子补丁的导入次序问题，但是这个解决方案有个前提，就是我们必需能修改应用程序代码，以在程序的最开始执行我们的注册函数。本节我们的目的是找到另一种解决方案取消这个限制。
<!-- more -->

## 1. 猴子补丁的问题所在
在之前关于猴子的文章中，我们讨论了导入次序问题。也就是说，正确使用猴子补丁取决于，我们能在任何其他代码导入我们想要修补的模块之前为其打上打补丁。换句话说就是在我们打补丁之前，其他代码是否已经按名称导入了对模块内函数的引用，并将其存储在它自己的名称空间中。即在打补丁之前，其他模块是否已经使用了

`from module import function`

如果我们不能尽早进入，那么就需要对目标函数的所有使用打补丁，这在一般情况下是不可能的，因为我们不知道函数在哪里被导入。我所描述的一种解决方案是使用导入后钩子机制，使我们能够在模块被任何代码导入之前访问模块并打补丁。这种技术仍然依赖于在有效运行其他代码之前安装导入后钩子机制本身。这意味着必须手动修改应用程序的主Python脚本文件，这并不总是实用的。本文的目的是研究如何避免修改主Python脚本文件来解决导入次序问题。

## 2. 在 .pth 文件中执行代码
作为Python导入系统的一部分，以及在哪些目录中搜索Python模块，有一种扩展机制，即可以将一个`.pth`扩展名文件安装到Python的`site-packages`目录中。用于指明Python包代码并不在默认的Python模块搜索路径上，而是存在于其他位置，通常是在`site-packages`的子目录中。`.pth`文件的目的是充当指向Python包的实际代码的指针。

在简单的情况下，`.pth`文件将包含与包含Python包代码的实际目录的名称相关的或绝对的路径名。如果它是一个相对路径名，那么它将相对于.pth文件所在的目录。

如果使用 `.pth`，当Python 解释器初始化时，它会创建Python模块的搜索路经，在添加所有默认搜索目录后，它将查找 `site-packages`内的所有目录，并解析每一个 `.pth` 文件，并将 `.pth` 内的目录添加到最后的搜索目录列表中。

现在，在Python的历史中，这个`.pth`机制被增强了，以支持一个特殊的情况。这种特殊情况是，如果`.pth`文件中的一行从导入开始，那么该行将作为Python代码执行，而不是简单地将其作为目录添加到要搜索模块的目录列表中。

这最初是为了允许为模块执行特殊的启动代码，以允许为Unicode注册一个非标准的编解码器。不过，它后来也被用于`easy_install`的实现中，如果您曾经运行过`easy-install`并查看了site-packages目录中的`easy-install.pth`文件，您会发现以下代码:

```python
import sys; sys.__plen = len(sys.path)
./antigravity-0.1-py2.7.egg
import sys; new=sys.path[sys.__plen:]; del sys.path[sys.__plen:]; p=getattr(sys,'__egginsert',0); sys.path[p:p]=new; sys.__egginsert = p+len(new)
```

因此，只要能够将代码放在一行上，就可以在每次运行Python解释器时，在`.pth`文件中做一些非常古怪的事情。我(作者)认为可执行代码在`.pth`文件中的概念是非常危险的，到目前为止，我(作者)一直避免依赖`.pth`文件的这个特性。

我(作者)对`.pth`文件中的可执行代码的担心是它总是在运行。这意味着，即使您已经将预构建的`RPM/DEB`包或`Python wheel` 安装到系统中的Python安装环境中，并且认为这样做更安全，因为避免了作为根用户运行 `setup.py`。但是.pth文件意味着包仍然可以在您不知情的情况下运行代码，甚至不需要将模块导入任何应用程序。考虑到安全性，Python真应该有一个白名单机制，用于确定信任哪些.pth文件，以允许其在每次运行Python解释器(特别是作为根用户)时执行代码。

如果有人关心的话，我将把这个讨论留给其他人来讨论，至少现在我将展示如何使用.pth文件的这个特性(滥用)来实现对正在运行的任何Python应用程序进行自动的猴子补丁的机制。

## 3. 添加导入勾子
在前一篇文章中，我们讨论的导入后钩子机制，在任何Python应用程序脚本文件的开头，我都需要手动添加如下代码:

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

它所做的是使用环境变量作为任何使用`setuptools`入口点注册的包的名称来源，这些入口点包含我们想要应用的猴子补丁。

了解了可以在.pth文件执行代码的能力,现在可以使用它，让这段代码在Python解释器启动时自动执行,从而避免了每次都需要手动修改每个Python应用程序，来应用我们的猴子补丁。

但是在实践中，我们需要的代码实际上要比这个稍微复杂一些，并且不能很容易地直接添加到`.pth`文件中，这是由于需要将所有代码写在一行上。因此，我们要做的是将所有代码放在一个单独的模块中，然后执行该模块。我们不希望每次都导入那个模块，也许用户看到它被导入时会感到害怕，即使它没有被使用，所以我们将通过环境变量的判断使用它。因此，我们可以在我们的`.pth`中使用的是:

```python
import os, sys; os.environ.get('AUTOWRAPT_BOOTSTRAP') and __import__('autowrapt.bootstrap') and sys.modules['autowrapt.bootstrap'].bootstrap()
```

也就是说，如果环境变量被设置为非空值，那么我们需要导入包含引导代码的模块并执行它。至于引导代码，这就有点麻烦了。我们不能只使用以前手动修改Python应用程序脚本文件时使用的代码。这是因为`.pth`文件的解析发生在Python解释器初始化。

问题有两个。第一个问题发生在执行导入钩子的发现，当.pth文件被执行时，它被处理的顺序是未知的，所以在我们的代码运行的时候，最终的Python模块搜索路径可能没有设置。第二个问题是`.pth`文件的处理发生在任何`sitecustomize.py`或`usercustomize.py`被处理完之前。因此，Python解释器可能不在其最终配置状态。因此，我们必须对我们所做的事情小心一点。

我们真正需要的是将任何操作延迟到Python解释器的初始化完成之后。问题是我们如何做到这一点。

## 4. site 模块
Python解释器初始化的最后部分是由`site` 模块的`main()`函数完成的

```python
def main():
    global ENABLE_USER_SITE
    abs__file__()
    known_paths = removeduppaths()
    if ENABLE_USER_SITE is None:
        ENABLE_USER_SITE = check_enableusersite()
    known_paths = addusersitepackages(known_paths)
    known_paths = addsitepackages(known_paths)     
    if sys.platform == 'os2emx':
        setBEGINLIBPATH()
    setquit()
    setcopyright()
    sethelper()
    aliasmbcs()
    setencoding()
    execsitecustomize()
    if ENABLE_USER_SITE:
        execusercustomize()    # .pth 在此之后执行
    # Remove sys.setdefaultencoding() so that users cannot change the
    # encoding after initialization. The test for presence is needed when
    # this module is run as a script, because this code is executed twice.
    if hasattr(sys, "setdefaultencoding"):
        del sys.setdefaultencoding
```

我们希望依赖的.pth解析和代码执行是在`addsitepackages()`函数中完成的。因此，我们真正需要的是将代码的任何执行推迟到`execsitecustomize()`中或`execusercustomize()`函数运行之后。实现这一点的方法是对这两个函数进行修改，并在它们完成时触发我们的代码。

我们需要都打上补丁，因为`usercustomize.py`的执行是可选的，取决于ENABLE_USER_SITE环境变量是否为真。因此，我们的`bootstrap()`函数应该如下

```python
def _execsitecustomize_wrapper(wrapped):
    def _execsitecustomize(*args, **kwargs):
        try:
            return wrapped(*args, **kwargs)
        finally:
            if not site.ENABLE_USER_SITE:       # 判断
                _register_bootstrap_functions()
    return _execsitecustomize

def _execusercustomize_wrapper(wrapped):
    def _execusercustomize(*args, **kwargs):
        try:
            return wrapped(*args, **kwargs)
        finally:
            _register_bootstrap_functions()
    return _execusercustomize

def bootstrap():
    site.execsitecustomize = _execsitecustomize_wrapper(site.execsitecustomize)
    site.execusercustomize = _execusercustomize_wrapper(site.execusercustomize)
```

尽管我曾经说过手工构建的猴子补丁有多糟糕，并且wrapt模块应该用于创建猴子补丁，但是在这种情况下，我们实际上不能使用wrapt模块。这是因为从技术上讲，作为用户安装的包，wrapt包此时可能不能使用。如果wrapt的安装方式是这样的，那么导入它的能力本身就依赖于`.pth`文件的处理。因此，我们使用一个函数闭包来使用简单的包装器。

在实际的包装器中，您可以看到两个包装器中哪个最终调用 `_register_bootstrap_functions()` 取决于ENABLE_USER_SITE是否为真，如果启用了对`usersitecustomize()`的支持，那么只能在`execsitecustomize()`中调用它。

最后，我们现在将`_register_bootstrap_functions()` 定义为:

```python
_registered = False

def _register_bootstrap_functions():
    global _registered
    if _registered:
        return
    _registered = True

    from wrapt import discover_post_import_hooks
    for name in os.environ.get('AUTOWRAPT_BOOTSTRAP', '').split(','):
        discover_post_import_hooks(name)
```
## 5. 初始化包
我们已经解决了所有问题，但是如何安装它，特别是如何安装自定义的.pth文件。为此我们使用一个设置`.py`文件:

```python
import sys
import os

from setuptools import setup
from distutils.sysconfig import get_python_lib

setup_kwargs = dict(
    name = 'autowrapt',
    packages = ['autowrapt'],
    package_dir = {'autowrapt': 'src'},
    data_files = [(get_python_lib(prefix=''), ['autowrapt-init.pth'])],
    entry_points = {'autowrapt.examples': ['this = autowrapt.examples:autowrapt_this']},
    install_requires = ['wrapt>=1.10.4'],
)

setup(**setup_kwargs)
```

为了安装`.pth`，我们使用了`setup()`调用的`data_files`参数。使用`distutils.sysconfig`模块中的`get_python_lib()`函数确定安装文件的实际位置。前缀“空字符串”的参数确保了Python包安装的路经为 `site-packages` 的相对路径，而不是绝对路径。**

安装这个包时非常重要的一点是，您不能使用`easy_install`或`python setup.py`安装。只能使用`pip`安装这个包。

这样做的原因是，如果不使用pip，那么包安装工具可以将包安装为egg。在这种情况下，自定义`.pth`文件实际上将安装在egg目录中，而不是实际安装在`site-packages`目录中。

`.pth`文件只有被添加到 `site-packages` 目录中，才能用于映射`autowrapt`包存在的子目录。从`site`模块调用的`addsitepackages()`函数并不会处理包含在`.pth`文件添加的目录中的`.pth`文件，因此我们的自定义`.pth`文件将被跳过。**

在使用“pip”时，默认情况下不使用eggs，所以可行。

还要注意的是，这个包不能与`buildout`一起工作，因为它总是将包作为`eggs`安装，并且在Python 安装环境中安装任何脚本时，都会显式地设置Python模块搜索路径本身。

## 6. 使用示例
此软件包的实际完整源代码可在:

https://github.com/GrahamDumpleton/autowrapt

这个包也在PyPi上作为autowrapt发布，因此您可以尝试它，如果您真的想使用它的话。为了方便快速地测试它是否有效，autowrapt包打包了一个示例`monkey patch`。在上面的setyp.py被设置如下:**

```python
entry_points = {'autowrapt.examples': ['this = autowrapt.examples:autowrapt_this']},
```

这个`entry point` 定义了一个名为`autowrapt.examples`的猴子补丁。定义了当导入 this 模块时，模块`autowrapt.examples`中的猴子补丁函数`autowrapt_this()`将被执行。**

所以要运行这个测试需要:

`pip install autowrapt`

如果没有所需的最小版本，也应该安装wrapt模块。现在正常运行命令行解释器，并在提示符处执行:

`import this`

这应该会显示Python的Zen。退出Python解释器，现在运行:

`AUTOWRAPT_BOOTSTRAP=autowrapt.examples python`

这将再次运行Python解释器，并将环境变量`AUTOWRAPT_BOOTSTRAP`设置为`autowrapt.examples`,以匹配在setup.py中为`autowrapt`定义的`entry point`。autowrapt_this()”函数的实际代码是:

```python
from __future__ import print_function

def autowrapt_this(module):
    print('The wrapt package is absolutely amazing and you should use it.')
```

所以如果我们再一次运行:

`import this`

我们现在应该看到Python Zen的扩展版本。在本例中，我们实际上并没有对目标模块中的任何代码打补丁，但它显示了补丁函数实际上是按预期被触发。

## 7. 其他机制
虽然这种机制相当干净，并且只需要设置环境变量，但是不能像前面提到的那样与buildout一起使用。对于buildout，我们需要研究其他可以实现同样效果的方法。我将在下一篇关于这一主题的博文中讨论这些其他选择。
