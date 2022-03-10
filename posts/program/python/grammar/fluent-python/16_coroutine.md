---
weight: 1
title: "协程"
date: 2018-01-16T22:00:00+08:00
lastmod: 2018-01-16T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Python 协程"
featuredImage: 

tags: ["python 进阶"]
categories: ["Python"]

lightgallery: true
---

## 1. 协程的概念
### 1.1 对协程的理解
协程理解：
  - 协程是用户空间的线程，编程语言必需提供接口实现线程调度
  - python 中 yield 是一种流程控制工具，使用它可以实现协程

生成器的编写风格：
  - 传统的拉取式 - 迭代器
  - 推送式 - 协程
  - 任务式 - 面向事件编程

### 1.2 协程状态
inspect.getgeneratorstate(gen):
  - GEN_CREATED - 等待开始执行
  - GEN_RUNNING - 解释器正在执行
  - GEN_SUSPENDED - 在 yield 表达式处暂停
  - GEN_CLOSED - 执行结束


## 2. 协程协议：
### 2.1 预激协程
**.next()**:
  - 作用：预激(prime)协程
  - 效果：让协程向前执行到第一个 yield 表达式，准备好作为活跃的协程使用
  - == .send(None)

```python
>>> my_coro = simple_coroutine()
>>> my_coro.send(1729)
Traceback (most recent call last):
    File "<stdin>", line 1, in <module>
    TypeError: can not send non-None value to a just-started generator
```

**预激协程的装饰器**
```python
from functools import wraps

def coroutine(func):
    """装饰器：向前执行到第一个`yield`表达式，预激`func`"""
    @wraps(func)
    def primer(*args,**kwargs): ➊
        gen = func(*args,**kwargs) ➋
        next(gen) ➌
        return gen ➍
    return primer
```

**其他预激方式**

框架：
  - Tornado - tornado.gen 装饰器 <http://tornado.readthedocs.org/en/latest/gen.html>

yield from: 调用协程时，会自动预激

### 2.2 数据传递
**.send(value)**:
  - 作用：调用方向协程发送数据，value 成为生成器函数中 yield 表达式的值
  - 要求：仅当协程处于暂停状态时才能调用，即必需先调用 next()方法预激协程
  - eg: b = yield a
    - 协程向调用者返回 a，并在 yeild 处暂停
    - 调用 .send(value)后，value 值被赋给 b，协程向下运行到另一个 yeild 表达式

```python
>>> def simple_coro2(a):
       print('-> Started: a =', a)
       b = yield a
       print('-> Received: b =', b)
       c = yield a + b
       print('-> Received: c =', c)

>>> my_coro2 = simple_coro2(14)
>>> from inspect import getgeneratorstate
>>> getgeneratorstate(my_coro2)
'GEN_CREATED'
>>> next(my_coro2)  # 预激(prime)协程
  Started: a = 14  # 协程返回 a 的值 14
14
>>> getgeneratorstate(my_coro2)
'GEN_SUSPENDED'
>>> my_coro2.send(28) # b 被赋值 28，协程返回 a+b 的值
   Received: b = 28   # 协程暂定在 c = yeild a + b 等号的左边，等待调用者发送值
42
```

### 2.3 异常处理
**协程中的异常**：
  - 如果协程内出现未处理异常，协程会终止; 重新激活协程，会抛出StopIteration异常
  - 协程中未处理的异常会向上冒泡，传给 next 函数或 send 方法的调用方
  - 从 Python 2.5 开始，调用方可以通过 **.throw** 和 **.close** 方法显式地把异常发给协程
  - 文档：<https://docs.python.org/3/reference/expressions.html#generator-iterator-methods>

.throw(exc_type[, exc_value[, traceback]])
  - 作用：显式地把异常发给协程，致使生成器在暂停的 yield 表达式处抛出指定的异常
  - 效果：
    - 如果生成器处理了抛出的异常，代码会向前执行到下一个 yield 表达式，
    而产出的值会成为调用 generator.throw 方法得到的返回值
    - 如果生成器没有处理抛出的异常，异常会向上冒泡，传到调用方的上下文中
  - 附注：如果不管协程如何结束都想做些清理工作，要把协程定义体中相关的代码放入 try/finally 块中

### 2.4 协程终止
**终止方式**
  1. 发送某个哨符值，让协程发生异常退出，内置的 None 和Ellipsis 等常量经常用作哨符值，
  甚至  StopIteration 类本身也可以作为哨符值
  2. 通过 .close() 方法协程传递 GeneratorExit 异常终止协程

.close():
  - 作用：致使生成器在暂停的 yield 表达式处抛出 GeneratorExit 异常
  - 效果：
    - 如果生成器没有处理这个异常，或者抛出了 StopIteration 异常(通常是指运行到结尾)，
    调用方不会报错
    - 如果收到 GeneratorExit 异常，生成器一定不能产出值，否则解释器会抛出RuntimeError 异常
    - 生成器抛出的其他异常会向上冒泡，传给调用方

```python
class DemoException(Exception):
"""为这次演示定义的异常类型。"""

def demo_exc_handling():
    print('-> coroutine started')
    try:
        while True:
            try:
                x = yield
            except DemoException: ➊
                print('*** DemoException handled. Continuing...')
            else: ➋
                print('-> coroutine received: {!r}'.format(x))
        # 最后一行代码不会执行，因为只有未处理的异常才会中止无限循环，
        # 而一旦出现未处理的异常，协程会立即终止
        raise RuntimeError('This line should never run.') ➌
    finally:
        print('-> coroutine ending')

>>> exc_coro = demo_exc_handling()
>>> next(exc_coro)
coroutine started
>>> exc_coro.send(11)
coroutine received: 11
>>> exc_coro.close()  # 协程关闭
>>> from inspect import getgeneratorstate
>>> getgeneratorstate(exc_coro)
'GEN_CLOSED'

>>> exc_coro = demo_exc_handling()
>>> next(exc_coro)
coroutine started
>>> exc_coro.throw(DemoException)  # 异常管理 - 异常在协程内得到处理
DemoException handled. Continuing
>>> getgeneratorstate(exc_coro)
'GEN_SUSPENDED'

>>> exc_coro = demo_exc_handling()
>>> next(exc_coro)
coroutine started
>>> exc_coro.throw(ZeroDivisionError) # 异常管理 - 异常在协程内未处理
Traceback (most recent call last):
ZeroDivisionError
>>> getgeneratorstate(exc_coro)
'GEN_CLOSED'
```

### 2.5 让协程返回值
值返回方式：
  - 生成器中的 return expr 表达式会触发 StopIteration(expr)异常
  - return 表达式的值通过 StopIteration 异常的 value 属性返回给调用方
  - 这样做保留了生成器对象的常规行为 —— 耗尽时抛出 StopIteration 异常

```python
from collections import namedtuple
Result = namedtuple('Result', 'count average')
def averager():
    total = 0.0
    count = 0
    average = None
    while True:
        term = yield
        if term is None:
            break       #  为了返回值，协程必须正常终止
        total += term
        count += 1
        average = total/count  # Python 3.3 之前，如果生成器返回值，解释器会报句法错误
    return Result(count, average)  

>> coro_avg = averager()
>>> next(coro_avg)
>>> coro_avg.send(10)
>>> coro_avg.send(30)
>>> coro_avg.send(6.5)
>>> try:
...    coro_avg.send(None) #  发送 None 会终止循环，导致协程结束，返回结果
... except StopIteration as exc:
...    result = exc.value # 生成器对象会抛出StopIteration 异常
...                       # 异常对象的 value 属性保存着返回的值
>>> result
Result(count=3, average=15.5)
```


## 3. yeild from 新句法
### 3.1 语法：
yeild from
  - 只能用在函数内部，在函数外部使用（以及 yield）会导致句法出错

await 关键字：
  - 文档：<https://www.python.org/dev/peps/pep-0492/>
  - 作用：await 关键字的作用与 yield from 结构类似，不过只能在以 async def 定义的协程
  （禁止使用 yield 和 yield from）中使用

async 关键字：
  - 作用：async 与其他现有的关键字结合使用，用于定义新的语言结构
  - async def 用于定义协程，
  - async for 用于使用异步迭代器（实现 \_\_aiter\_\_ 和 \_\_anext\_\_ 方法，
  这是协程版的 \_\_iter\_\_ 和 \_\_next\_\_方法）迭代可迭代的异步对象

### 3.2 控制流程
```python
def gen():
    ....
    yield from  x
    ....
```

yield from x：
  - 首先调用 iter(x)，从中获取迭代器 iter
  - yield from 会把 iter 产出的值传给 gen 的调用方，即调用方可以直接控制 iter
  - gen 会阻塞，等待 iter 终止

iter(x)返回值:
  - 可以是只实现了 \_\_next\_\_ 方法的简单迭代器  --  让协程方便返回值
  - 可以是实现了 \_\_next\_\_、send、 close 和 throw 方法的生成器 -- 职责委托

### 3.3 作用：
#### 让协程更方便地返回值
  - yield from 结构会在内部自动捕获 StopIteration 异常，
  并把 value 属性的值变成 yield from 表达式的值
  - 这种处理方式与for 循环处理 StopIteration 异常的方式一样

```python
from collections import Iterable

def flatten(items, ignore_types=(str, bytes)):
    for x in items:
        if isinstance(x, Iterable) and not isinstance(x, ignore_types):
            yield from flatten(x)
        else:
            yield x    # 只需实现 __next__ 方法的简单迭代器

items = [1, 2, [3, 4, [5, 6], 7], 8]
# Produces 1 2 3 4 5 6 7 8
for x in flatten(items):
    print(x)
```

#### 职责委派
  - yeild from 打开了双向通道，把最外层的调用方与最内层的子生成器连接起来
  - 这样二者可以直接发送和产出值，还可以直接传入异常，而不用在位于中间的协程中添加
大量处理异常的样板代码

专用术语：
  - 子生成器：从 yield from 表达式中 <iterable> 部分获取的生成器
  - 委派生成器：
    - 定义：包含yield from <iterable> 表达式的生成器函数
    - 使用：
      - 因为委派生成器相当于管道，所以可以把任意数量个委派生成器连接在一起
      - 这个链条要以一个只使用 yield 表达式的简单生成器结束，也能以任何可迭代的对象结束
  - 调用方：
    - 定义：调用委派生成器的客户端代码
    - 使用：
      - 任何 yield from 链条都必须由调用方驱动
      - 在最外层委派生成器上调用 next(...) 函数或 .send(...) 方法
      - 也可以隐式调用，例如使用 for 循环

### 3.4 示例说明
![yield from职责委派详解](/images/fluent_python/yield_from.png)
  - 委派生成器在 yield from 表达式处暂停时
  - 调用方可以直接把数据发给子生成器
  - 子生成器再把产出的值发给调用方
  - 子生成器返回之后，解释器会抛出 StopIteration 异常，并把返回值附加到异常对象上
  - yield from 提取出异常中的返回值作为整个表达式的值，委派生成器恢复
  - 如果子生成器不终止，委派生成器会在 yield from 表达式处永远暂停，
  因为 yield from（与 yield 一样）把控制权转交给客户代码（即，委派生成器的调用方）

```python
# 子生成器
def averager():
  # 同上
  ....
  return Result(count, average)  # return 值会成为 yeild from 表达式的值

# 委派生成器
def grouper(results, key):
  while True:  # 每次迭代时会新建一个 averager 实例；每个实例都是作为协程使用的生成器对象
      results[key] = yield from averager() # grouper 接受值，通过管道传递给 averager 实例

# 客户端代码，即调用方
def main(data):
  results = {}
  for key, values in data.items():
      group = grouper(results, key) #  group 是调用 grouper 函数得到的委派生成器对象
      next(group)    # 预激委派生成器 group，此时进入 while True 循环，调用子生成
                      # 器 averager 后，在 yield from 表达式处暂
      for value in values:
          group.send(value)
      group.send(None) # 重要！
  report(results)
```

main 运行说明：
  - 外层 for循环每次迭代会新建一个 grouper实例，赋值给 group变量；group是委派生成器。
  - 调用 next(group)，预激委派生成器 grouper，此时进入 while True 循环，调用子生成
器 averager 后，在 yield from 表达式处暂停。
  - 内层 for 循环调用 group.send(value)，直接把值传给子生成器 averager。同时，当前
的 grouper 实例（ group）在 yield from 表达式处暂停。
  - 内层循环结束后， group 实例依旧在 yield from 表达式处暂停，因此， grouper 函数定
义体中为 results[key] 赋值的语句还没有执行。
  - 如果外层 for 循环的末尾没有 group.send(None)，那么 averager 子生成器永远不会终止，
委派生成器 group 永远不会再次激活，因此永远不会为 results[key] 赋值。
  - 外层 for 循环重新迭代时会新建一个 grouper 实例，然后绑定到 group 变量上。前一个
grouper 实例（以及它创建的尚未终止的 averager 子生成器实例）被垃圾回收程序回收
  - group 内的 while 循环不是必需，作用是不让 委托生成器终止触发 StopIteration 异常

### 3.5 总结
1. 子生成器产出的值都直接传给委派生成器的调用方（即客户端代码）
2. 使用 send() 方法发给委派生成器的值都直接传给子生成器
  - 如果发送的值是 None，那么会调用子生成器的 \_\_next\_\_() 方法
  - 如果发送的值不是 None，那么会调用子生成器的 send() 方法
  - 如果调用的方法抛出 StopIteration 异常，那么委派生成器恢复运行
  - 任何其他异常都会向上冒泡，传给委派生成器
3. 生成器退出时，生成器（或子生成器）中的 return expr 表达式会触发 StopIteration(expr)异常
4. yield from 表达式的值是子生成器终止时传给 StopIteration 异常的第一个参数
5. 传入委派生成器的异常，除了 GeneratorExit 之外都传给子生成器的 throw() 方法，
  - 如果调用 throw() 方法时抛出 StopIteration 异常，委派生成器恢复运行
  - StopIteration之外的异常会向上冒泡，传给委派生成器
6. 把 GeneratorExit 异常传入委派生成器，或者在委派生成器上调用 close() 方法
  - 如果子生成器有 close() 方法，则调用，如果调用 close() 方法导致异常抛出，
  那么异常会向上冒泡，传给委派生成器
  - 子生成器没有 close()方法，或close() 正常终止，委派生成器抛出 GeneratorExit异常

```python
# RESULT = yield from EXPR 伪代码
_i = iter(EXPR)  # <1>
try:
    _y = next(_i)  # <2>
except StopIteration as _e:
    _r = _e.value  # <3>
else:
    while 1:  # <4>
        try:
            _s = yield _y  # <5>
        except GeneratorExit as _e:  # <6>
            try:
                _m = _i.close
            except AttributeError:
                pass
            else:
                _m()
            raise _e
        except BaseException as _e:  # <7>
            _x = sys.exc_info()
            try:
                _m = _i.throw
            except AttributeError:
                raise _e
            else:  # <8>
                try:
                    _y = _m(*_x)
                except StopIteration as _e:
                    _r = _e.value
                    break
        else:  # <9>
            try:  # <10>
                if _s is None:  # <11>
                    _y = next(_i)
                else:
                    _y = _i.send(_s)
            except StopIteration as _e:  # <12>
                _r = _e.value
                break

RESULT = _r  # <13>
# END YIELD_FROM_EXPANSION
````
## 4. 使用案例：使用协程做离散事件仿真
面向事件的编程技术:
  - 包括：
    - 事件循环驱动的回调
    - 事件循环驱动的协程
  - 基于回调
    - 相关框架：Twisted
  - 基于协程:
    - 相关框架：Tornado 和 asyncio
    - 运作方式：在单个线程中使用一个主循环驱动协程执行并发活动
    - 并发特点：协程会不断把控制权让步给主循环，激活并向前运行其他协程，从而执行各个并发活动，
    这是一种协作式多任务：协程显式自主地把控制权让步给中央调度程序
    - 对比：多线程实现的是抢占式多任务,调度程序可以在任何时刻暂停线程（即使在执行一个语句的过
    程中），把控制权让给其他线程

### 4.1 背景介绍
事件仿真：
1. 离散事件仿真：
  - 定义：仿真钟向前推进的量不是固定的，而是直接推进到下一个事件
  - 实现：协程为实现离散事件仿真提供了合理的抽象
  - SimPy 是一个实现离散事件仿真的 Python 包
2. 连续事件仿真：
  - 定义：仿真钟以固定的量（通常很小）不断向前推进
  - 实现：为了实现连续仿真,在多个线程中处理实时并行的操作更自然

示例作用：
  - 增进对使用协程管理并发操作的感性认知
  - 洞悉 asyncio、 Twisted 和 Tornado 等库是如何在单个线程中管理多个并发活动的
  - 说明如何在一个主循环中处理事件，以及如何通过发送数据驱动协程

### 4.2 程序解析
<!-- ![出租车模拟输出](/images/fluent_python/flup_1603.png) -->
辅助函数：
  - compute_delay 函数:返回单位为分钟的时间间隔
  - Event = collections.namedtuple('Event', 'time proc action')
    - time 字段是事件发生时的仿真时间
    - proc 字段是出租车进程实例的编号
    - action 字段是描述活动的字符串

taxi_process
  - 作用：一个协程

```python
def taxi_process(ident, trips, start_time=0): ➊
    """每次改变状态时创建事件，把控制权让给仿真器"""
    time = yield Event(start_time, ident, 'leave garage') ➋
    for i in range(trips): ➌
        time = yield Event(time, ident, 'pick up passenger') ➍
        time = yield Event(time, ident, 'drop off passenger') ➎
    yield Event(time, ident, 'going home')
```

Simulator:
  - .run：执行仿真主循环
  - .events:PriorityQueue 对象，保存 Event 实例,能按照时间顺序取出放入队列中的事件
  - .procs:一个字典，把出租车的编号映射到仿真过程中激活的进程

```python
class Simulator:
    def __init__(self, procs_map):
        self.events = queue.PriorityQueue()
        self.procs = dict(procs_map)

    def run(self, end_time): ➊
        """排定并显示事件，直到时间结束"""
        # 排定各辆出租车的第一个事件
        for _, proc in sorted(self.procs.items()): ➋
            first_event = next(proc) ➌
            self.events.put(first_event)
            # 这个仿真系统的主循环
        sim_time = 0 ➎
        while sim_time < end_time: ➏
            if self.events.empty(): ➐
                print('*** end of events ***')
                break
            current_event = self.events.get() ➑
            sim_time, proc_id, previous_action = current_event ➒
            print('taxi:', proc_id, proc_id * ' ', current_event) ➓
            active_proc = self.procs[proc_id]
            next_time = sim_time + compute_duration(previous_action)
            try:
                next_event = active_proc.send(next_time)
            except StopIteration:
                del self.procs[proc_id]
            else:
                self.events.put(next_event)
        else:
            msg = '*** end of simulation time: {} events pending ***'
            print(msg.format(self.events.qsize()))

> taxis = {i: taxi_process(i, (i + 1) * 2, i * DEPARTURE_INTERVAL)
           for i in range(num_taxis)}
> sim = Simulator(taxis)
```

## 延伸阅读
### Python:
标准库-协程：
  - <https://www.python.org/dev/peps/pep-0380/>
  - <https://groups.google.com/forum/#!msg/pythontulip/bmphRrryuFk/aB45sEJUomYJ>
  - <https://mail.python.org/pipermail/python-dev/2009-March/087382.html>

协程示例：
  - <https://mail.python.org/pipermail/tutor/2015-February/104200.html>
  - <http://nbviewer.ipython.org/github/wardi/iterables-iterators-generators/blob/master/Iterables,%20Iterators,%20Generators.ipynb>

Python3 新特性
  - 在 Python 3.3 之前，如果生成器返回值，解释器会报句法错误

离散事件：
  - <https://en.wikipedia.org/wiki/Discrete_event_simulation>
  - <http://www.cs.northwestern.edu/~agupta/_projects/networking/QueueSimulation/mm1.html>
  - SimPy: <https://simpy.readthedocs.org/en/latest/>

### blog:
Beazley:
  - <http://www.dabeaz.com/generators/>
  - <http://www.dabeaz.com/finalgenerator/>
  - <http://www.dabeaz.com/coroutines/>
    - <http://pyvideo.org/video/213>
    - <http://pyvideo.org/video/215>
    - <http://pyvideo.org/video/214>

James Powell:
  - <http://seriously.dontusethiscode.com/2013/05/01/greedy-coroutine.html>
  - 说明：使用协程重写了经典的算法

ActiveState:
  - <https://code.activestate.com/recipes/>
  - <https://code.activestate.com/recipes/tags/coroutine/>
  - 说明：ActiveState Code 诀窍数据库

Paul Sokolovsky:
   - <https://dl.dropboxusercontent.com/u/44884329/yield-from.pdf>
   - <http://flupy.org/resources/yield-from.pdf>
   - 说明：解说 yield from 结构的工作原理

Greg Ewing
  - <http://www.cosc.canterbury.ac.nz/greg.ewing/python/yield-from/yield_from.html>
  - 说明： yield from 的使用示例，BinaryTree 类、 一个简单的 XML 解析器和一个任务调度程序

其他：
  - <https://groups.google.com/forum/#!msg/pythontulip/bmphRrryuFk/aB45sEJUomYJ>
  - 说明：The difference between yield and yield-from

### 实用工具  

### 书籍:
Python Cookbook（第 3 版）中文版

Effective Python：编写高质量 Python 代码的 59 个有效方法
  - 书中的第 40 条短小精辟，题为“考虑用协程来并发地运行多个函数”
  - 代码：
    - <https://github.com/bslatkin/effectivepython>
    - <https://github.com/bslatkin/effectivepython>
    - <https://gist.github.com/ramalho/da5590bc38c973408839>


## 附注
