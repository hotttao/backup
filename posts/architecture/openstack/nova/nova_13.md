---
title: 13. Nova 的单元测试
date: 2021-03-14
categories:
    - 运维
tags:
	- Openstack
---

Nova 里的单元测试
<!-- more -->

## 1. Nova 单元测试架构
今天我们开始学习 Nova 单元测试的源码，还是按照一直以来的套路，我们先通过 UML 类图来看看 Nova 单元测试的代码结构。

Nova 所有的单元测试都在 nova/test 目录中，我们随便挑选两个单元测试文件
1. `nova/nova/tests/unit/api/openstack/compute/test_flavor_access.py` 
2. `nova/nova/tests/unit/api/openstack/compute/test_auth.py`

它们的UML 类图如 13-1,13-2 所示如下:

![13-1 test_flavor_access](/images/openstack/test_flavor_access.png)

![13-2 test_auth](/images/openstack/test_auth.png)

显然他们都继承了 nova.test 中的 NoDBTestCase 类，显然 nova.test 就是我们第一步需要研究的源码。

### 1.1 nova.test
nova.test 的 UML 类图如 13-2 所示:

![13-2 test](/images/openstack/test.png)

UML 类图显示，nova 单元测试使用到了如下模块:
1. unittest: 作 Python 开发的都知道，这是 Python 内置的单元测试框架
2. testtools: unittest 的扩展，提供了更好的断言方式和调试手段
3. oslotest: Openstack 抽象出来的单元测试的公共库
4. fixtures: 将测试代码与环境准备代码分离开来，提供了比 mock 更高一层的抽象

那我们要搞清楚 Nova 的单元测试，首先就要先清楚这些库的基本使用。下面我们来一一介绍。

## 2. testtools
对 testtools 一点不了解的铜须，推荐阅读一下它的[官方文档](https://testtools.readthedocs.io/en/latest)。内容不多，很快就能看完。

testtools 是 unittest 的扩展库，它为单元测试扩展了下面这些功能:
1. 更加丰富易用的断言，包括:
    - testtools 通过 TestCase.assertThat  和 Matcher 机制，可以让我们更好的水平扩展断言的方式以及更加容易组合已有的断言
    - 内置了更易用的断言方式
2. TestCase.addDetail 可以为测试用例添加更加详细的输出
3. 添加了更多的钩子函数，控制测试的执行，包括
    - addCleanup: 添加清理函数
    - skipTest: 跳过测试用例
    - addOnException: 只在测试失败时，执行的操作
4. fixtures， 即 fixtures 模块所提供的功能，定义了一组可用资源，从而能隔离测试代码和环境准备。
5. Test helpers，辅助测试的小功能，包括:
    - TestCase.patch: 即 mock 模块提供的对象模块
    - Test attributes: 给测试用例添加标签便于执行器对测试用例的过滤
    - 条件导入: try_import
    - 安全的属性测试 safe_hasattr，用于替代默认的 hasattr 函数
    - Nullary: 创建无参数函数的替代方式

### 1.1 Matcher
testtools 的 Matcher 提供了一种水平扩展断言的方式。testtools.matcher 的 UML 类图如下图 13-3 所示

![13-3 test_auth](/images/openstack/testtools_matcher.png)

通过继承关系我们可以看到 Matcher 的实现有三个核心基类:
1. _impl.Matcher
2. _basic._BinaryComparison
3. _impl.MisMatch

```python
class Matcher(object):
    """A pattern matcher.
    """

    def match(self, something):
        """Return None if this matcher matches something, a Mismatch otherwise.
        """
        raise NotImplementedError(self.match)

    def __str__(self):
        """Get a sensible human representation of the matcher.

        This should include the parameters given to the matcher and any
        state that would affect the matches operation.
        """
        raise NotImplementedError(self.__str__)


class _BinaryComparison(object):
    """Matcher that compares an object to another object."""

    def __init__(self, expected):
        self.expected = expected

    def __str__(self):
        return "%s(%r)" % (self.__class__.__name__, self.expected)

    def match(self, other):
        if self.comparator(other, self.expected):
            return None
        return _BinaryMismatch(other, self.mismatch_string, self.expected)

    def comparator(self, expected, other):
        raise NotImplementedError(self.comparator)


class Mismatch(object):
    """An object describing a mismatch detected by a Matcher."""

    def __init__(self, description=None, details=None):
        """Construct a `Mismatch`.

        :param description: A description to use.  If not provided,
            `Mismatch.describe` must be implemented.
        :param details: Extra details about the mismatch.  Defaults
            to the empty dict.
        """
        if description:
            self._description = description
        if details is None:
            details = {}
        self._details = details

    def describe(self):
        """Describe the mismatch.

        This should be either a human-readable string or castable to a string.
        In particular, is should either be plain ascii or unicode on Python 2,
        and care should be taken to escape control characters.
        """
        try:
            return self._description
        except AttributeError:
            raise NotImplementedError(self.describe)

    def get_details(self):
        """Get extra details about the mismatch.
        """
        return getattr(self, '_details', {})

    def __repr__(self):
        return  "<testtools.matchers.Mismatch object at %x attributes=%r>" % (
            id(self), self.__dict__)


```
可以看到:
1. _BinaryComparison 虽然没有继承自 Matcher，但是它们实现了同样的接口，_BinaryComparison 在 Matcher 基础上定义了一个通用的比较方式: comparator
2. _BinaryMismatchMismatch  是 Mismatch 的子类，其收集了断言失败时的详细信息

那 TestCase.assert 是如何使用 Matcher 的呢？

```python
class TestCase(unittest.TestCase):
    """Extensions to the basic TestCase.

    :ivar exception_handlers: Exceptions to catch from setUp, runTest and
        tearDown. This list is able to be modified at any time and consists of
        (exception_class, handler(case, result, exception_value)) pairs.
    :ivar force_failure: Force testtools.RunTest to fail the test after the
        test has completed.
    :cvar run_tests_with: A factory to make the ``RunTest`` to run tests with.
        Defaults to ``RunTest``.  The factory is expected to take a test case
        and an optional list of exception handlers.
    """

    skipException = TestSkipped

    run_tests_with = RunTest

    def assertThat(self, matchee, matcher, message='', verbose=False):
        """Assert that matchee is matched by matcher.

        :param matchee: An object to match with matcher.
        :param matcher: An object meeting the testtools.Matcher protocol.
        :raises MismatchError: When matcher does not match thing.
        """
        mismatch_error = self._matchHelper(matchee, matcher, message, verbose)
        if mismatch_error is not None:
            raise mismatch_error
    
    def _matchHelper(self, matchee, matcher, message, verbose):
        # 2. Annotate 只是为了测试失败时，额外显示输出传入的 message 
        matcher = Annotate.if_message(message, matcher)
        # 1. 调用 Matcher 的 match 方法，对 Matcher 包含的值和被测试值进行比较
        mismatch = matcher.match(matchee)
        if not mismatch:
            return
        for (name, value) in mismatch.get_details().items():
            self.addDetailUniqueName(name, value)
        return MismatchError(matchee, matcher, mismatch, verbose)


class Annotate(object):
    """Annotates a matcher with a descriptive string.

    Mismatches are then described as '<mismatch>: <annotation>'.
    """

    def __init__(self, annotation, matcher):
        self.annotation = annotation
        self.matcher = matcher

    @classmethod
    def if_message(cls, annotation, matcher):
        """Annotate ``matcher`` only if ``annotation`` is non-empty."""
        if not annotation:
            return matcher
        return cls(annotation, matcher)

    def __str__(self):
        return 'Annotate(%r, %s)' % (self.annotation, self.matcher)

    def match(self, other):
        mismatch = self.matcher.match(other)
        if mismatch is not None:
            return AnnotatedMismatch(self.annotation, mismatch)
```

### 1.2 Details 
Details 用于为测试添加更加详细的输出。输出的信息不仅可以是文本，可以使用 testtools.content.Content 和 testtools.content.ContentType 自定义输出的内容类型，可以是各种 Mime 类型。比如:

```python
from testtools.content import Content
from testtools.content_type import ContentType

text = Content(ContentType('text', 'plain'), lambda: ["some text"])

image = content_from_file('foo.png', ContentType('image', 'png'))
```

## 2. fixtures
相比 testtools，fixtures 和 mock 才是我们学习的重点，因为写单元测试绝大多数的代码都是在隔离代码的执行环境。

### 2.1 fixtures 是什么
fixture 到底是用来干嘛的？fixture 本质上就是一个资源包装器或者叫管理器，定义了资源的初始化和清理接口。它的用法参考[文档](https://pypi.org/project/fixtures/)，不过我建议你先直接看 fixtures 实现的基类 Fixture 的源码，然后在看文档，应该更容易看懂。

### 2.2 fixture UML 类图
fixture 的类层次结构并不复杂，核心类都在 fixtures.fixture 中，其 UML 类图如 13-4 所示:

![13-4 test_auth](/images/openstack/fixture.png)

可以看到大多数 fixture 实现都是直接继承自 fixtures.fixture.Fixture，所以我们就从 Fixture 看起，下面是其源码:

```python
class Fixture(object):

    def addCleanup(self, cleanup, *args, **kwargs):
        """添加 Fixture 结束后的资源清理函数

        :param cleanup: 可调用对象
        :param *args: 传递给  cleanup 的位置参数
        :param kwargs: 传递给  cleanup 的关键字参数
        :return: None
        """
        self._cleanups.push(cleanup, *args, **kwargs)

    def addDetail(self, name, content_object):
        """Add a detail to the Fixture.

        只能在 setUp 被调用后调用

        :param name: content_object 对应的名称，会覆盖同名 content_object
        :param content_object: 符合 testtools.content.Content 协议的对象
        """
        self._details[name] = content_object

    def cleanUp(self, raise_first=True):
        """资源清理
        逆序调用 addCleanup 添加的所有资源清理函数，清空此 Fixture 管理的所有资源 
        
        cleanUp 只能在 setUp 调用后调用，如果 setUp 调用失败，会自动调用 cleanUp

        :param raise_first: 为 True 触发遇到的第一个异常，如果为 False 使用 
        :return: A list of the exc_info() for each exception that occured if
            raise_first was False
        """
        try:
            return self._cleanups(raise_errors=raise_first)
        finally:
            self._remove_state()

    def _clear_cleanups(self):
        """重置清理函数
        """
        self._cleanups = CallMany()
        self._details = {}
        self._detail_sources = []

    def _remove_state(self):
        """Remove the internal state.

        Called from cleanUp to put the fixture back into a not-ready state.
        """
        self._cleanups = None
        self._details = None
        self._detail_sources = None

    def __enter__(self):
        self.setUp()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            self._cleanups()
        finally:
            self._remove_state()
        return False  # propagate exceptions from the with body.

    def getDetails(self):
        """
        返回注册的 details 信息，包括当前 fixture 和 useFixture 加入的其他 fixture
        """
        result = dict(self._details)
        # self._detail_sources 包含了注册到当前 fixture 的其他 fixture
        for source in self._detail_sources:
            # 组合 {"name": content}，如果存在重名 name，将 name重命名为 name-i
            combine_details(source.getDetails(), result)
        return result

    def setUp(self):
        """Prepare the Fixture for use.

        子类需要重载 _setup 方法

        :raises: MultipleExceptions if _setUp fails. The last exception
            captured within the MultipleExceptions will be a SetupError
            exception.
        """
        self._clear_cleanups()
        try:
            self._setUp()
        except:
            err = sys.exc_info()
            details = {}
            if gather_details is not None:
                # Materialise all details since we're about to cleanup.
                gather_details(self.getDetails(), details)
            else:
                details = self.getDetails()
            errors = [err] + self.cleanUp(raise_first=False)
            try:
                raise SetupError(details)
            except SetupError:
                errors.append(sys.exc_info())
            if issubclass(err[0], Exception):
                raise MultipleExceptions(*errors)
            else:
                six.reraise(*err)

    def _setUp(self):
        """
        """

    def reset(self):
        
        self.cleanUp()
        self.setUp()

    def useFixture(self, fixture):
        """
        添加其他 fixture，提供了组合 fixture 的功能
        """
        try:
            fixture.setUp()
        except MultipleExceptions as e:
            if e.args[-1][0] is SetupError:
                combine_details(e.args[-1][1].args[0], self._details)
            raise
        except:
            # The child failed to come up and didn't raise MultipleExceptions
            # which we can understand... capture any details it has (copying
            # the content, it may go away anytime).
            if gather_details is not None:
                gather_details(fixture.getDetails(), self._details)
            raise
        else:
            self.addCleanup(fixture.cleanUp)
            # Calls to getDetails while this fixture is setup will return
            # details from the child fixture.
            self._detail_sources.append(fixture)
            return fixture


class CallMany(object):
    """fixture 的 self._cleanups 实现
    """

    def __init__(self):
        self._cleanups = []

    def push(self, cleanup, *args, **kwargs):
        self._cleanups.append((cleanup, args, kwargs))

    def __call__(self, raise_errors=True):
        """运行所有 push 进来的 cleanup 函数

        :param raise_errors: 
            =True，如果在运行过程中发生异常，将在所有函数运行完成后重新触发异常
                如果有多个异常，将使用 MultipleExceptions 包装所有异常
            所以如果你要捕获 __call__ 发生的异常，需要同时捕捉特定异常和 MultipleExceptions
            异常，并判断 MultipleExceptions 是否包含特定异常
            =False 返回捕获的所有异常的列表
        :return: Either None or a list of the exc_info() for each exception
            that occured if raise_errors was False.
        """
        cleanups = reversed(self._cleanups)
        self._cleanups = []
        result = []
        for cleanup, args, kwargs in cleanups:
            try:
                cleanup(*args, **kwargs)
            except Exception:
                result.append(sys.exc_info())
        if result and raise_errors:
            if 1 == len(result):
                error = result[0]
                reraise(error[0], error[1], error[2])
            else:
                raise MultipleExceptions(*result)
        if not raise_errors:
            return result

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self()
        return False  # Propagate exceptions from the with body.
```

Fixture 的源码并不复杂，就是一个资源包装器，定义了资源初始化和清理的接口。Fixture 还有几个子类:
1. FunctionFixture: 传入 setup 和 cleanup 函数直接定义一个 fixture
2. MethodFixture: 从一个对象生成 fixture
3. CompoundFixture: 组合多个 fixture

这些类都是提供了一个创建 fixture 的便捷方式。接下来，我们以 StringStream 为例来看看 fixture 的具体应用。

### 2.3 StringStream 的源码和应用
fxiture.StringStream 源码如下:

```python
def StringStream(detail_name):
    """Provide a file-like object that accepts strings and expose as a detail.

    :param detail_name: The name of the detail.
    :return: A fixture which has an attribute `stream` containing the file-like
        object.
    """
    return Stream(detail_name, _string_stream_factory)

class Stream(Fixture):
    """Expose a file-like object as a detail.

    :attr stream: The file-like object.
    """

    def __init__(self, detail_name, stream_factory):
        """Create a ByteStream.

        :param detail_name: Use this as the name of the stream.
        :param stream_factory: Called to construct a pair of streams:
            (write_stream, content_stream).
        """
        self._detail_name = detail_name
        self._stream_factory = stream_factory

    def _setUp(self):
        write_stream, read_stream = self._stream_factory()
        self.stream = write_stream
        self.addDetail(self._detail_name,
            testtools.content.content_from_stream(read_stream, seek_offset=0))


def _string_stream_factory():
    lower = io.BytesIO()
    upper = io.TextIOWrapper(lower, encoding="utf8")
    # See http://bugs.python.org/issue7955
    upper._CHUNK_SIZE = 1
    # In theory, this is sufficient and correct, but on Python2,
    # upper.write(_b('foo")) will whinge louadly.
    if sys.version_info[0] < 3:
        upper_write = upper.write
        def safe_write(str_or_bytes):
            if type(str_or_bytes) is str:
                str_or_bytes = str_or_bytes.decode('utf8')
            return upper_write(str_or_bytes)
        upper.write = safe_write
    return upper, lower
```

代码并不复杂，Stream 继承 Fixture，并重载了 _setup 用于初始化 io.BytesIO()，并通过 addDetail 将写入 BytesIO 中的内容收集起来。

fixture 包装的资源对象通常要么直接使用，要么用于 mock 系统中的其他资源。StringStream 就通常用来 mock 标准输入输出。下面是官方文档给出的示例，mock 了标准输出，并能获取到输出到标准输出的具体内容。

```python
import fixtures

fixture = fixtures.StringStream('stdout')
with fixture:
    with fixtures.MonkeyPatch('sys.stdout', fixture.stream):
        print()
        print("test fixture")
    print(fixture.getDetails())
```


