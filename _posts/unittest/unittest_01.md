---
title: Python 单元测试
date: 2017-09-22
categories:
    - Python
tags:
    - unittest
    - 单元测试
---
至关重要的单元测试
![Python decorator](/images/python/unittest.png)
<!-- more -->

## 1. 单元测试
Python 中有多个[单元测试框架](https://blog.csdn.net/zcabcd123/article/details/54892467)，最常用的应该是 `unittest`。本文的目的就是想系统介绍一下 `unittest` 的使用。

除了各种单元测试框架，Python 中还有不少可以用来辅助单元测试的模块，我看到的最有用但是却很少人使用的是 `wrapt`。`wrapt` 模块提供的功能可以部分替代`unittest.mock` ，简化单元测试的复杂度。这是我们将介绍的第二部分内容。

本文思路和部分内容借鉴自雨痕老师的[Python3 学习笔记](https://book.douban.com/subject/28509425/)，这应该是既[流畅的Python](https://book.douban.com/subject/27028517/) 之后我第二推荐的书，很适合有 Python经验的同学作为 Python 学习的补充。

下面我们就正式开始我们的内容。

## 2. Unittest
### 2.1 Unittest 框架
![tornado](/images/python/unittest_frame.png)

从上面的 Unittest 框架，我们大体上就能看出使用 Unittest 进行单元测试的整个流程:
1. 构建测试用例(`Suit`)
2. 通过加载器选择我们想要测试的测试用例(`Loader`)
3. 执行器执行测试返回结果(`Runner`)

下面是与框架对应的相关组件:
1. `TestLoader`: 加载器，查找测试方法
2. `Suit`: 测试构建组件
  - `TestCase`: 测试用例，实现一个到多个测试方法，测试的基础单元
  - `FunctionTestCase`: 继承自 `TestCase` 专门为函数准备的通用测试类型
  - `TestSuite`: 测试套件，组合多个用例或套件
3. `TestRunner`: 执行器，执行测试，返回测试结果
4. `TestResult`: 测试结果

我们目的是学习各个组件的常见使用，并了解各个组件之间调用的"钩子"，以帮助我们构建更好的单元测试。

### 2.2 调用钩子
#### TestCase
要想明白 `unittest` 各个组件之间的调用钩子，我们得从 `unittest.TestCase` 说起:
1. unittest 中所有的测试用例都必须继承自 `TestCase`
2. 通过实例化 `TestCase` 创建一个测试过程，其 `run` 方法是启动测试的钩子函数
3. `run` 方法只会执行在实例化 `TestCase` 通过 `methodName` 参数传入的方法(默认为`runTest`)
4. 因此要想测试 `TestCase` 内多个测试方法，需要为每个测试方法创建一个 `TestCase` 实例

```Python
class TestCase(object):
  def __init__(self, methodName='runTest'):
    pass
```

#### TestSuite
为了批量管理多个测试过程，`unittest` 提供了 `TestSuite` 测试套件。其内部的 `_tests` 属性和 `addTests` 方法用来收集和添加 `TestCase` 的实例(也包括`TestSuite`实例本身)；当其 `run` 被调用时，会依次调用 `_tests` 内收集的测试实例的 `run` 方法，启动每一个测试过程。

```Python
class BaseTestSuite(object):
    """A simple test suite that doesn't provide class or module shared fixtures.
    """
    def __init__(self, tests=()):
        self._tests = []
        self.addTests(tests)


    def addTests(self, tests):
        if isinstance(tests, basestring):
            raise TypeError("tests must be an iterable of tests, not a string")
        for test in tests:
            self.addTest(test)

class TestSuite(BaseTestSuite):
    def run(self, result, debug=False):
      pass
```

#### TestLoader
`TestLoader` 是 `unittest` 用来查找测试方法，批量创建测试用例实例的组件。其提供了多种发现机制，可递归扫描目录，查找符合匹配条件的测试模块；或指定具体的模块，用例类型甚至是某个测试方法。其完整的发现流程是:
1. `discover` 方法会递归目录，查找文件名与传入模式匹配的所有模块，
2. 用 `loadTestsFromModule` 在模块内获取所有的测试用例类型
3. 用 `loadTestsFromTestCase` 为发现的测试用例的全部测试方法创建实例
4. 最终，上面的所有的实例组合成测试套件交给执行器

`loadTestsFromTestCase` 调用 `getTestCaseNames` 查找类型中包含特定前缀的测试方法，没有找到时返回 `runTest`。这个特定前缀由 `TestLoader`的`testMethodPrefix`类属性限定。

`loadTestsFromModule` 按照加载协议约定，先调用 `load_tests` 函数返回自定义测试套件。仅在模块内没有 `load_tests` 函数时，返回模块内的所有用例类型。

`unittest` 内置了默认的加载器实例 `defaultTestLoader` 可直接使用。


```Python
class TestLoader(object):
    """
    This class is responsible for loading tests according to various criteria
    and returning them wrapped in a TestSuite
    """
    testMethodPrefix = 'test'
    sortTestMethodsUsing = cmp
    suiteClass = suite.TestSuite
    _top_level_dir = None

    def loadTestsFromTestCase(self, testCaseClass):
        """Return a suite of all tests cases contained in testCaseClass"""
        pass

    def loadTestsFromModule(self, module, use_load_tests=True):
        """Return a suite of all tests cases contained in the given module"""
        pass

    def loadTestsFromName(self, name, module=None):
        pass

    def loadTestsFromNames(self, names, module=None):
        """Return a suite of all tests cases found using the given sequence
        of string specifiers. See 'loadTestsFromName()'.
        """
        pass

    def getTestCaseNames(self, testCaseClass):
        """Return a sorted sequence of method names found within testCaseClass
        """
        pass

    def discover(self, start_dir, pattern='test*.py', top_level_dir=None):
        pass   

defaultTestLoader = TestLoader()  
```


#### TestRunner
`TestRunner`执行器用于启动测试过程并返回测试结果。其实例的`run`方法接受测试用例或套件作为参数，并调用它们的 `run` 方法，执行测试并返回测试结果。`TestRunner` 是默认的执行器类，其默认输出到 `sys.stderr`，可使用 `stream` 参数将结果保存到文件中。

```Python
class TextTestRunner(object):
    """A test runner class that displays results in textual form.

    It prints out the names of tests as they are run, errors as they
    occur, and a summary of the results at the end of the test run.
    """
    resultclass = TextTestResult

    def __init__(self, stream=sys.stderr, descriptions=True, verbosity=1,
                 failfast=False, buffer=False, resultclass=None):
        pass

    def run(self, test):
      pass
```

下面是 `unittest` 简单使用示例，现在你应该能明白整个测试的过程了。

```Python
from unittest import TestCase


class DemoTest(TestCase):
    def test_1(self):
        self.assertTrue(True)

    def test_2(self):
        self.assertFalse(False)

# 1. 直接启动测试用例
# 加载器
loader = unittest.defaultTestLoader
# 测试用例
suite = DemoTest('test_2')
# 实例化执行器，调用 run 方法，传入测试用例，启动测试过程
unittest.TextTestRunner(verbosity=2).run(suite) # unittest 默认的执行器

# 2. 通过加载器启动测试用例
# 加载器返回的测试套件
suite = loader.loadTestsFromTestCase(DemoTest)
unittest.TextTestRunner(verbosity=2).run(suite)
```


### 2.3 命令行
`unittest` 还提供了命令行，通常我们只需要编写测试用例，通过 `Python -m unittest` 可直接启动测试过程； `TestLoader` 提供的测试方法发现机制可通过命令参数直接使用。下面是命令行的使用示例:

```Python
# 启动方式二: 使用命令执行测试
cd /home/tao/project/algo/unittest_demo
python -m unittest demao
python -m unittest demao.DemoTest
python -m unittest demao.DemoTest.test_1

cd ..
python -m unittest discover unittest_demo/ "de*.py"
```

### 2.4 TestCase 使用
为了方便测试，`TestCase` 还提供了很多钩子函数和断言方法，下面是一个简单的说明:

```Python
import unittest


class TestCase(object):
    def setUp(self):
        # 每个测试方法执行前后，调用 setUp/tearDown
        pass

    def tearDown(self):
        #
        pass

    @classmethod
    def setUpClass(cls):
        # 无论多少个实例，setUpClass/tearDownClass 仅执行一次
        pass

    @classmethod
    def tearDownClass(cls):
        #
        pass

    def assertFalse(self, expr, msg=None):
        # 如果 expr 不为 False 测试失败
        pass

    def assertTrue(self, expr, msg=None):
        # 如果 expr 不为 True 测试失败
        pass

    def assertRaises(self, excClass, callableObj=None, *args, **kwargs):
        pass

    def assertEqual(self, first, second, msg=None):
        # 如果 first != second 测试失败
        pass


class DemoTest(TestCase):
    @unittest.expectedFailure   # 期望测试失败
    def test_1(self):
        self.assertTrue(False)

    @unittest.skip('reason....') # 忽略该测试，还有几个制定版本
    def test_2(self):
        self.assertFalse(True)

    def test_3(self):
        # 测试是否抛出指定异常
        with self.assertRaises(Exception):  
            raise Exception()
```

## 3. wrapt
`unittest` 框架中真正复杂的是 `unittest.mock`。如果测试目标依赖其他对象或模块，我们可能就需要模拟(mock)替代它。但是 `mock` 模块使用起来很复杂，不直观，所以这篇文章我不打算讲解 `mock`。我们来看看如何使用 `wrapt` 来替代 `mock`来简化我们的测试。

wrapt 是Python 装饰器的工业级实现。由于 Python 装饰器和单元测试中的模拟行为非常相似，因此 wrapt 在实现一个通用装饰器的同时附加了辅助单元测试的接口。wrapt 使用便利，但是实现却相当复杂。以至于 Wrapt 模块的作者 Graham Dumpleton 先生写了 14 篇博客详细讲述 wrapt 的实现，下面是Graham Dumpleton 先生的博文 和 Wrapt 模块的文档:
- [GrahamDumpleton wrapt blog](https://github.com/GrahamDumpleton/wrapt/tree/master/blog)
- [wrapt 1.10.11 documentation](https://wrapt.readthedocs.io/en/latest/)

在此我们只举例说明如何使用，有关 wrapt 的实现后续会翻译Graham Dumpleton先生写的 14 篇博文，其中会详细介绍([译文:使用 wrapt 辅助测试](https://hotttao.github.io/2018/06/03/wrapt/python_decorator_12/))。

### 3.1 使用 wrapt 辅助单元测试
wrapt 中有两个辅助单元测试的核心接口:
1. `transient_function_wrapper`: 用于创建一个作用范围受限的模拟行为，像下面这样我们可以轻松实现在 `cover_urlopen` 内对 `urllib2.urlopen` 函数的模拟，而 `cover_urlopen` 外 `urllib2.urlopen`不受影响
2. `wrapt.ObjectProxy`: 代理对象，可以非常直观的实现对类的模拟

#### transient_function_wrapper
```Python
# 模拟函数
import urllib2
from wrapt import transient_function_wrapper

@transient_function_wrapper('urllib2', 'urlopen')
def urllib_request_wrap(wrapped, instance, arg, kwarg):
    return b'覆盖 urllib2.urlopen 函数返回值'

# 对 urllib2.urlopen 函数的模拟，只会发生在 urllib_request_wrap 装饰的函数中
@urllib_request_wrap
def cover_urlopen():
    print urllib2.urlopen(url='http://www.baidu.com/')

cover_urlopen()
```

#### ObjectProxy
```Python
# 模拟类
from wrapt import ObjectProxy


class Production(object):
    def __init__(self):
        self.value = 1

    def run(self):
        print '%s running' % self.__class__.__name__


class ProductionProxy(ObjectProxy):
    def __init__(self, wrapped):
        super(ProductionProxy, self).__init__(wrapped)
        self._self_value = 10

    # 模拟类属性
    @property
    def value(self):
        return self._self_value

    @value.deleter
    def value(self):
        del self._self_value

    # 通过方法覆盖，模拟类方法
    def run(self):
        print 'proxy running'


p = Production()
print p.value
p_proxy = ProductionProxy(p)
print p_proxy.value
p.run()
p_proxy.run()
print p.value
print p_proxy.value
del p_proxy.value
print p_proxy.value
```
