---
weight: 1
title: "asyncio"
date: 2018-01-18T22:00:00+08:00
lastmod: 2018-01-18T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Python asyncio 处理并发"
featuredImage: 

tags: ["python 进阶"]
categories: ["Python"]

lightgallery: true
---


## 1. 操作系统知识
### 1.1 并发与并行
并行: 在某一时间点, 存在多于一个进程在运行

并发: 在某一段时间, 存在多于一个进程在运行

### 1.2 I/O 模型
1. 同步阻塞I/O
2. 同步非阻塞I/O
3. 异步阻塞I/O -- I/O多路复用
5. 异步非阻塞I/O -- I/O操作在操作系统内核中完成, 完成后通过应用程序
4. 信号驱动I/O - 向程序发送信号, I/O操作在用户空间完成
6. epoll - I/O多路复用的改进版本, 又称为事件驱动模型

附注:
  - 普通文件的读写不支持 epoll, 基于 epoll的 tornado 不适合大量的
  文件系统I/O, 耗时的任务只能通过采用异步 httpclient 交给后端server处理
  - asyncio 也不支持异步文件系统I/O, 只能通过多线程解决普通文件读写导致的阻塞

### I/O模型对比
> 详细见 18.5节

**信号驱动I/O**
  - 实现：通过sigaction系统调用注册一个SIGIO信号处理程序
  - 特点：
    - 通常，在UDP编程中使用信号驱动I/O，此时SIGIO信号产生于下面两种情况：
      - 套接字收到一个数据报
      - 套接字上发生了异步错误
    - 对于TCP编程，信号驱动I/O没有太大意义
      - 因为对于流式套接字而言，有很多情况都可以导致SIGIO产生
      - 而应用又无法区分是什么具体情况导致该信号产生的

**基于回调的事件驱动模型**：
  - 缺点:
    - 执行分成多步的异步任务时丢失上下文，共享状态管理困难
      - 不等待响应, 而是注册一个函数, 在发生某件事时调用
      - 每个函数做一部分工作, 设置下一个回调, 然后返回, 让事件循环继续运行, 所有本地的上下文都会丢失
    - 缺少处理错误所需的上下文，错误处理困难
     - 一连串的回调构成一个完整的调用链,其中任意一个异常整个调用链断掉，接力传递的状态也会丢失
     - 为了防止栈撕裂，异常必须以数据的形式返回，而不是直接抛出异常，
     然后每个回调中需要检查上次调用的返回值，以防错误吞没


**基于协程的事件驱动模型**：
  - 协程：
    - 是协作式的例程
    - 是非抢占式的多任务子例程的概括，允许有多个入口点在例程中确定的位置来控制程序的暂停与恢复执行
    - 例程是编程语言定义的可被调用的代码段，为了完成某个特定功能而封装在一起的一系列指令
  - 特点：
    - 每个协程具有自己的栈帧，保留了程序执行的上下文
    - 协程之间相互合作，相互通知，能将程序状态在不同的回调之间延续下去
  - 运行过程：
    - 所有I/O操作都是异步的，并在 yield 处暂停
    - 事件循环监听所有I/O事件，并在I/O事件发生时，调用send方法激活暂停协程继续运行
    - **总结**: **两种模型都是基于回调，只不过协程中的事件循环回调的是 send 方法，激活暂停的协程**

**应用**：
  - Node.js 是基于回调的事件
    - Node.js 不支持使用 JavaScript 编写的用户级线程,
    - 但是在背后却借助 libeio 库使用 C 语言实现了线程池, 以此提供基于回调的文件 API
    - 从 2014 年起, 大多数操作系统都不提供稳定且便携的异步文件处理 API 了，
    Node 提供了异步文件系统 API
  - asyncio 是基于协程的

### 1.3 协程与线程
  - 线程：
    - 因为调度程序任何时候都能中断线程。
    - 所以必须保留锁，保护程序中的重要部分，防止多步操作在执行的过程中中断，导致数据处于无效状态
  - 协程：
    - 协程默认会做好全方位保护，以防止中断，必须显式产出才能让程序的余下部分运行
    - 对协程来说，无需保留锁，协程自身就会同步，因为在任意时刻只有一个协程运行
    - 想交出控制权时，可以使用 yield 或 yield from 把控制权交还调度程序
    - 协程只能在暂停的 yield 处取消，因此可以处理 CancelledError 异常，执行清理操作，
    这就是能够安全地取消协程的原因

## 2. asyncio
### 2.1 asyncio 简介
asyncio:
  - 实现: 使用 **事件循环驱动** 的协程实现并发, 注意不是实现并行
  - 版本:
    - python3: asyncio - <http://docs.python.org/3/library/asyncio.html>
    - python2: trollius - <http://trollius.readthedocs.io/using.html>
      - import asyncio 替换成 import trollius as asyncio
      - yield from ... 替换成 yield From(...)
      - yield from []  替换成 yield From(None)
      - 协程需要返回结果, return result 替换成 raise Return(result)
  - 讨论组: <http://groups.google.com/forum/#!forum/python-tulip>

### 2.2 异步原理:
  - 事件循环基于 I/O 多路复用
  - 委派链的底端是可以被 I/O 多路复用监听的 I/O 操作
  - yield from foo 能防止阻塞, 因为当前协程(委派生成器)因等待I/O操作暂停后,
  控制权回到事件循环手中, 再去驱动其他协程  -- 异步阻塞的
  - 事件循环监听期物或协程是否运行完毕, 并把结果返回给暂停的协程, 将其恢复,
  即调用 send 方法发送响应重启协程

### 2.3 语法:
Python3.4:   
asyncio 处理的协程
  1. 要使用 @asyncio.coroutine 装饰
    - 这样能在一众普通的函数中把协程凸显出来，
    - 有助于调试：如果还没从中产出值，协程就被垃圾回收了(意味着有操作未完成)那就可以发出警告
  2. 协程在定义体中必须使用 yield from, 而不能使用 yield
  3. 协程要由调用方驱动, 并由调用方通过 yield from 调用,
  或者把协程传给 asyncio 包中的某个函数, 例如 asyncio.async(...)

Python3.6  
新特性:
  - 添加了 async 和 await 关键字, 协程成为新的语法, 而不再是一种生成器类型

async:
  - 作用: 替代 asyncio.coroutine

await:
  - 作用: 替代 yield from

async with
  - 作用: 异步上下文管理

async for
  - 作用: 异步迭代器语法

### 2.4 调用过程:
  1. 使用 asyncio.Task 对象包装协程, 排定协程的运行时间  --  **获取 Task 对象**
  3. 获取一个事件循环 -- 替代了操作系统的调度职能  --  **获取事件循环**
  4. asyncio 事件循环依次激活各个协程  -- **激活所有协程**
  5. 客户代码中的协程使用 yield from 把职责委托给库里的协程(如aiohttp.request)时,
  控制权交还事件循环, 事件循环得以执行其他排定的协程 -- **执行底层协程**
  6. 事件循环通过基于回调的低层 API, 在阻塞的操作执行完毕后获得通知
  7. 获得通知后, 主循环把结果发给暂停的协程(.send()), 重启暂停的协程  -- **获取返回结果**
  8. 总结: 在一个单线程程序中使用主循环依次激活队列里的协程, 各个协程向前执行几步,
  然后把控制权让给主循环, 主循环再激活队列里的下一个协程

**调用方式**:
   - 只有驱动协程, 协程才能做事
   - 驱动协程要么使用 yield from,要么传给 asyncio包中某个参数为协程或期物的函数, 例如 run_until_complete
   - yeild from:
     - 使用 yield from 链接的多个协程最终必须由不是协程的调用方驱动，调用方显式或隐式
   （例如，在 for 循环中）在最外层委派生成器上调用 next(...) 函数或 .send(...) 方法
     - 链条中最内层的子生成器必须是简单的生成器（只使用 yield）或可迭代的对象
  - 使用 asyncio 包时，我们编写的代码不通过调用 next(...) 函数或 .send(...)
  方法驱动协程——这一点由 asyncio 包实现的事件循环去做

## 3. asyncio API
### 3.1 asyncio 主要对象
主要对象:
  - asyncio.Future:
    - 期物对象，表示异步执行的操作
    - 与 concurrent.futures.Future 类似
  - asyncio.Task: Future 对象的子类
    - 与 threading.Thread 对象等效，Task 用于驱动协程， Thread 用于调用可调用的对象
    - 像是实现协作式多任务的库(例如 gevent)中的绿色线程(green thread)
  - BaseEventLoop: I/O 事件循环
  - 其他函数

期物和协程:
  - 文档： https://docs.python.org/3/library/asyncio-task.html
  - 可以使用 yield from 驱动协程，也可以使用 yield from 从 asyncio.Future对象中产出结果
  - 因此如果 foo 是协程函数（调用后返回协程对象）, 抑或是返回 Future 或 Task
  实例的普通函数, 都可以写成:  res = yield from foo()
  - 这是asyncio 包的 API 中很多地方可以互换协程与期物的原因之一

### 3.2 asyncio.Future
- 作用: 与 concurrent.futures.Future 接口基本一致
- 类似方法:
  - .done()
  - .add_done_callback(...)
- 差异方法:
  - .result():
    - 参数: 方法没有参数, 不能指定超时时间。
    - 作用: 如果调用 .result() 方法时期物还没运行完毕, 不会阻塞去等待结果,
    而是抛出 asyncio.InvalidStateError 异常

#### 使用方式:
  - 通常使用 yield from, 获取 asyncio.Future 对象的结果
  - 使用 yield from 处理期物, 等待期物运行完毕这一步无需我们关心, 而且不会阻塞事件循
  环, 因为在 asyncio 包中,  yield from 的作用是把控制权还给事件循环
  - 通常无需调用 my_future.add_done_callback(...), 因为
  可以直接把想在期物运行结束后执行的操作放在协程中
  yield from my_future 表达式的后面即可
  - 通常也无需调用 my_future.result(), 因为 yield from 从期物中产出的值就是结果

### 3.3 asyncio.Task
  - 作用: Future 的子类, 用于包装协程
  - 特性:
    - 为了执行操作，必须排定协程的运行时间，然后使用 asyncio.Task 对象包装协程
    - 因此**Task 实例相当于一个子线程**，但已排定运行时间, 可直接运行, 无需显示使用 yeild from 驱动
    - Thread 实例则必须调用 start 方法，明确告知让它运行
  - 方法：
    - .cancel():
      - 作用：终止协程, 在协程内部 yeild 处抛出 CancelledError 异常
      - 附注：协程可以捕获这个异常，也可以延迟取消，甚至拒绝取消

```python
def test_task():
    a = async(asyncio.sleep(100)) # 协程不会在此处暂停，因为相当于启动了一个新线程
    print('-------------')
    yield from async(asyncio.sleep(1)) # 协程会在此处暂停
    yield from asyncio.sleep(1) # 协程会在此暂停，yield from Future() 也是同样效果
    print('+++++') # 在上一个 sleep 返回时，输出
    a.cancel() # 当前协程运行完毕，a 被销毁，对应的协程也会被销毁，所以整个程序不会运行 100s

loop = asyncio.get_event_loop()
loop.run_until_complete(test_task())
```
附注：
  - 如果想获取 task 实例的返回结果，必需使用 yeild from task
  - 如果只是想启动另一协程，无需使用 yield from
  - Future 对象只是要执行的操作，与协程一样，必需使用 yield from 驱动

#### 实例化方式
1. asyncio.async(coro_or_future,  \*,  loop=None)
  - coro_or_future:
    - 如果是 Future 或Task 对象, 那就原封不动地返回
    - 如果是协程, 那么 async 函数会调用 loop.create_task(...) 方法创建 Task 对象
  - loop:
    - 关键字参数是可选的, 用于传入事件循环
    - 默认,  async 函数会通过调用 asyncio.get_event_loop() 函数获取循环对象
2. BaseEventLoop.create_task(...)
  - 参数: 一个协程
  - 作用: 排定协程的执行时间, 返回一个 asyncio.Task 对象
  - 附注: 如果在自定义的 BaseEventLoop 子类上调用, 返回的对象可以是外部库
  (如 Tornado)中与 Task 类兼容的某个类的实例
  - 版本：create_task(...) 方法只在 Python 3.4.2 及以上版本中可用。
  如果是 Python 3.3 或 Python 3.4 的旧版，要使用 asyncio.async(...) 函数
3. asyncio.wait(futures,  \*,  loop=None,  timeout=None,  return_when=ALL_COMPLETED):
  - 参数:
    - futures: 一个由期物或协程构成的可迭代对象
    - timeout, return_when 如果设定可能会返回未结束的期物
  - 作用:
    - 把各个协程分别包装进一个 Task 对象(内部使用了 async 函数)
    - wait 是协程, 返回一个协程或生成器对象, 会等待传给它的所有协程运行完毕后结束

```python
def download_many(cc_list):
    loop = asyncio.get_event_loop()  # 获取事件循环底层实现的引用
    to_do = [download_one(cc) for cc in sorted(cc_list)]  # <9>
    wait_coro = asyncio.wait(to_do)  # <10>
    res,  _ = loop.run_until_complete(wait_coro) # 执行事件循环, 直到 wait_coro 运行结束
    loop.close() # 关闭事件循环
```
附注：
  - run_until_complete 只接受一个欺物或协程，驱动多个协程需要先由 asyncio.wait 协程包装

### 3.4 BaseEventLoop
1. asyncio.get_event_loop():
  - 客户代码绝不会直接创建事件循环
  - 而是获取事件循环的引用
2. BaseEventLoop.run_until_complete(...)
  - 参数: 一个期物或协程, 如果是协程, 把协程包装进一个 Task 对象中
  - 作用:
    - 事件循环运行的过程中, **阻塞主线程直至传入的协程运行结束**
    - 否则如果主线程结束，所有的协程都会被垃圾回收程序收回而提前终止
  - 返回:
    - 返回一个元组, 第一个元素是一系列结束的期物, 第二个元素是一系列未结束的期物
    - 返回值中未完成的期物受 wait 函数的 timeout, return_when 参数影响
  - 附注:
    - 因为参数只接受一个协程，同时启动多个协程时，需要使用 wait 函数将多个协程包装进一个 Task 对象


### 3.5 其他函数和对象
asyncio.as_completed:
  - 参数: 一个期物列表
  - 作用：获取协程运行的返回结果
  - 返回值: 一个迭代器,  在期物运行结束后产出期物
  - 附注:
    - asyncio.as_completed 函数返回的期物与传给 as_completed 函数的期物可能不同,
  在 asyncio 包内部, 我们提供的期物会被替换成生成相同结果的期物，原因参见
  Which other futures my come out of asyncio.as_completed?
  https://groups.google.com/forum/#!msg/python-tulip/PdAEtwpaJHs/7fqbQj2zJoJ
    - 必须使用 yield from 获取 asyncio.as_completed 函数产出的期物的结果，
    所以 as_completed 函数必须在协程中调用

asyncio.Semaphore(concur_req):
  - 参数: concur_req - 并发协程数
  - 作用: 同步装置, 用于限制并发请求数量
    - Semaphore 对象维护着一个内部计数器,
    若在对象上调用 .acquire() 协程方法, 计数器则递减;
    若在对象上调用 .release() 协程方法, 计数器则递增
    - 如果计数器大于零, 调用 .acquire() 方法不会阻塞; 如果计数器为零, 那.acquire() 方法
    会阻塞调用此方法的协程, 直到其他协程在同一个 Semaphore 对象上调用 .release()
    方法, 让计数器递增
  - 使用: 可以当作上下文管理器使用
```python
#  在 yield from 表达式中把 semaphore 当成上下文管理器使用
# 这段代码保证, 任何时候都不会有超过 concur_req 个 get_flag 协程启动
with (yield from semaphore):
    image = yield from get_flag(base_url,  cc)
```

### 3.6 使用Executor对象
背景:
  - 问题:
    - asyncio 不支持异步文件系统I/O
    - 访问本地文件系统会阻塞了客户代码与 asyncio 事件循环共用的唯一线程
  - 解决方法: 使用额外的线程进行文件系统操作

loop.run_in_executor(executor,  func,  \*args)
  - loop: asyncio 的事件循环对象, 其维护着一个 ThreadPoolExecutor 对象
  - 作用: 把可调用对象传递给 ThreadPoolExecutor 委托给线程池
  - 参数:
    - executor: Executor 实例; 如果设为 None, 使用事件循环默认的 ThreadPoolExecutor 实例
    - func: 可调用对象
    - args: 传递给可调用对象的参数
  - 文档:  https://docs.python.org/3/library/asyncio-eventloop.html#asyncio.BaseEventLoop.run_in_executor

```python
loop = asyncio.get_event_loop()
loop.run_in_executor(None,  save_flag,  image,  cc.lower() + '.gif')
```

### 3.7 asyncio 使用示例
#### aiohttp
```python
import asyncio
import collections
import contextlib

import aiohttp
from aiohttp import web
import tqdm

from flags2_common import main, HTTPStatus, Result, save_flag

# default set low to avoid errors from remote site, such as
# 503 - Service Temporarily Unavailable
DEFAULT_CONCUR_REQ = 5
MAX_CONCUR_REQ = 1000


class FetchError(Exception):
    # 用于包装其他 HTTP 或网络异常，并获取 country_code，以便报告错误
    def __init__(self, country_code):
        self.country_code = country_code


  # BEGIN FLAGS3_ASYNCIO
  @asyncio.coroutine
  def http_get(url):
      res = yield from aiohttp.request('GET', url)
      if res.status == 200:
          ctype = res.headers.get('Content-type', '').lower()
          if 'json' in ctype or url.endswith('json'):
              data = yield from res.json()  # <1>
          else:
              data = yield from res.read()  # <2>
          return data

      elif res.status == 404:
          raise web.HTTPNotFound()
      else:
          raise aiohttp.errors.HttpProcessingError(
              code=res.status, message=res.reason,
              headers=res.headers)


  @asyncio.coroutine
  def get_country(base_url, cc):
      url = '{}/{cc}/metadata.json'.format(base_url, cc=cc.lower())
      metadata = yield from http_get(url)  # <3>
      return metadata['country']


  @asyncio.coroutine
  def get_flag(base_url, cc):
      url = '{}/{cc}/{cc}.gif'.format(base_url, cc=cc.lower())
      # 必须在外层加上括号，直接写 return yield from， Python 解析器会报告句法错误
      return (yield from http_get(url)) # <4>

```
附注:
  - 最内层的子生成器是库中真正执行 I/O 操作的函数, 而不是我们自己编写的函数
  - 使用 asyncio 包时，我们编写的异步代码中包含由 asyncio 本身驱动的协程（即委派生成器），
  而生成器最终把职责委托给 asyncio 包或第三方库（如 aiohttp）中的协程。
  这种处理方式相当于架起了管道，让 asyncio 事件循环（通过我们编写的协程）
  驱动执行低层异步 I/O 操作的库函数

#### run_in_executor
```python
# BEGIN FLAGS2_ASYNCIO_EXECUTOR
@asyncio.coroutine
def download_one(cc, base_url, semaphore, verbose):
    try:  
        # 如果semaphore 计数器的值是所允许的最大值，只有这个协程会阻塞
        # 使用 一个 with 和使用 两个 with 有区别么？？？？
        with (yield from semaphore): # <5>
            image = yield from get_flag(base_url, cc)
        with (yield from semaphore):
            country = yield from get_country(base_url, cc)
    except web.HTTPNotFound:
        status = HTTPStatus.not_found
        msg = 'not found'
    except Exception as exc:
        # raise X from Y 句法链接原来的异常
        raise FetchError(cc) from exc
    else:
        country = country.replace(' ', '_')
        filename = '{}-{}.gif'.format(country, cc)
        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, save_flag, image, filename)
        status = HTTPStatus.ok
        msg = 'OK'

    if verbose and msg:
        print(cc, msg)

    return Result(status, cc)
# END FLAGS2_ASYNCIO_EXECUTOR
```

#### as_completed, Semaphore
```python
@asyncio.coroutine
def downloader_coro(cc_list, base_url, verbose, concur_req):
    counter = collections.Counter()
    # 最多允许激活 concur_req 个使用这个计数器的协程
    semaphore = asyncio.Semaphore(concur_req)
    to_do = [download_one(cc, base_url, semaphore, verbose)
             for cc in sorted(cc_list)]
    #  获取一个迭代器，这个迭代器会在期物运行结束后返回期物
    to_do_iter = asyncio.as_completed(to_do)
    if not verbose:
        to_do_iter = tqdm.tqdm(to_do_iter, total=len(cc_list))
    for future in to_do_iter:
        try:
            # 获取 asyncio.Future 对象的结果，
            # 最简单的方法是使用 yield from，而不是调用future.result() 方法
            res = yield from future  
        except FetchError as exc:
            # asyncio.as_completed 函数返回的期物与传给 as_completed 函数的期物可能不同
            # 因此通过 FetchError 包装网络异常，并关联相应的国家代码
            country_code = exc.country_code
            try:
                # 尝试从原来的异常（ __cause__）中获取错误消息
                error_msg = exc.__cause__.args[0]
            except IndexError:
                # 如果在原来的异常中找不到错误消息，使用所链接异常的类名作为错误消息
                error_msg = exc.__cause__.__class__.__name__
            if verbose and error_msg:
                msg = '*** Error for {}: {}'
                print(msg.format(country_code, error_msg))
            status = HTTPStatus.error
        else:
            status = res.status

        counter[status] += 1

    return counter
```

#### run_until_complete
```python
def download_many(cc_list, base_url, verbose, concur_req):
    loop = asyncio.get_event_loop()
    coro = downloader_coro(cc_list, base_url, verbose, concur_req)
    counts = loop.run_until_complete(coro)
    loop.close()
    return counts
```

### 3.8 协程与线程对比

线程版示例程序
```python
def slow_function():   # 假设这是耗时的计算
    time.sleep(3)  # 调用 sleep 阻塞主线程, 一定要这么做, 以便释放 GIL, 创建从属线程
    return 42

def supervisor():
    done = threading.Event()
    spinner = threading.Thread(target=spin,
                               args=('thinking!',  done))
    print('spinner object: ',  spinner)
    spinner.start()  # Thread 实例必须调用 start 方法, 明确告知让它运行
    # 相当于耗时操作阻塞了主线程。同时, 从属线程以动画形式显示旋转指针
    result = slow_function()
    done.set() # 向子线程发送终止信号
    spinner.join() # 等待 spinner 线程结束
    return result
```

协程版示例程序
```python
@asyncio.coroutine  # <1>  asyncio 处理的协程要使用 @asyncio.coroutine 装饰
def spin(msg):   # <2>      不是强制要求, 但是强烈建议这么做
    write,  flush = sys.stdout.write,  sys.stdout.flush
    for char in itertools.cycle('|/-\\'):
        status = char + ' ' + msg
        write(status)
        flush()
        write('\x08' * len(status))
        try:
            yield from asyncio.sleep(.1)  # <3> 休眠不会阻塞事件循环
        except asyncio.CancelledError:   # <4> 发出了取消请求而触发的异常
            break
    write(' ' * len(status) + '\x08' * len(status))

@asyncio.coroutine
def slow_function():   # <5> 假装进行 I/O 操作时, 使用 yield from 继续执行事件循环
    # pretend waiting a long time for I/O
    yield from asyncio.sleep(3)  # <6> 控制权交给主循环, 在休眠结束后恢复这个协程
    return 42


@asyncio.coroutine
def supervisor():   # <7>
    # 排定 spin 协程的运行时间, 使用一个 Task 对象包装 spin 协程, 并立即返回
    spinner = asyncio.async(spin('thinking!'))  # 获取的 Task 对象已经排定了运行时间
    print('spinner object: ',  spinner)  # <9>
    # 使用 yield from 驱动 slow_function 函数, 同时, 事件循环继续运行
    result = yield from slow_function() # <10>
    # Task 对象可以取消; 取消后会在协程当前暂停的 yield 处抛出 asyncio.CancelledError异常
    # 协程可以捕获这个异常, 也可以延迟取消, 甚至拒绝取消
    spinner.cancel()  # <11>
    return result


def main():
    loop = asyncio.get_event_loop()  # <12> 获取事件循环的引用
    # 驱动 supervisor 协程, 让它运行完毕
    result = loop.run_until_complete(supervisor())  # <13>
    loop.close()
    print('Answer: ',  result)
```
附注:
  - 除非想阻塞主线程, 从而冻结事件循环或整个应用, 否则不要在 asyncio 协程中使用 time.sleep(...)
  - 如果协程需要在一段时间内什么也不做, 应该使用 yield from asyncio.sleep(DELAY)

## 4. 使用asyncio包编写服务器
### 4.1 编写TCP服务器
```python
#!/usr/bin/env python3

# BEGIN TCP_CHARFINDER_TOP
import sys
import asyncio

from charfinder import UnicodeNameIndex  # <1> 构建名称索引, 提供查询方法

CRLF = b'\r\n'
PROMPT = b'?> '

index = UnicodeNameIndex()  # <2>

@asyncio.coroutine
def handle_queries(reader,  writer):   # <3> 要传给 asyncio.start_server 的函数
    while True:   # <4> 两个参数是 asyncio.StreamReader 和 asyncio.StreamWriter 对象
        writer.write(PROMPT)  # 把数据写入缓冲, 通常不会阻塞, 因此不是协程, 只是普通的函数
        yield from writer.drain()  # 刷新 writer 缓冲; 执行真正的I/O操作, 所以是协程
        data = yield from reader.readline()  # <7> 协程, 返回一个 bytes 对象。
        try:
            query = data.decode().strip()
        except UnicodeDecodeError:   # <8>
            query = '\x00'
        client = writer.get_extra_info('peername')  # <9> 返回与套接字连接的远程地址
        print('Received from {}:  {!r}'.format(client,  query))  # <10>
        if query:
            if ord(query[: 1]) < 32:   # <11> 如果收到控制字符或者空字符, 退出循环
                break
            lines = list(index.find_description_strs(query)) # <12>
            if lines:
                writer.writelines(line.encode() + CRLF for line in lines) # <13>
            writer.write(index.status(query,  len(lines)).encode() + CRLF) # <14>

            yield from writer.drain()  # <15> 刷新输出缓冲
            print('Sent {} results'.format(len(lines)))  # <16>

    print('Close the client socket')  # <17>
    writer.close()  # <18> 关闭 StreamWriter 流
# END TCP_CHARFINDER_TOP

# BEGIN TCP_CHARFINDER_MAIN
def main(address='127.0.0.1',  port=2323):   # <1>
    port = int(port)
    loop = asyncio.get_event_loop()
    # 返回的协程对象是一个 asyncio.Server 实例, 即一个 TCP 套接字服务器
    server_coro = asyncio.start_server(handle_queries,  address,  port,
                                loop=loop) # <2>
    # 驱动 server_coro 协程, 启动服务器（ server）
    server = loop.run_until_complete(server_coro) # <3>

    host = server.sockets[0].getsockname()  # <4>
    print('Serving on {}. Hit CTRL-C to stop.'.format(host))  # <5>
    try:
        loop.run_forever()  # <6>  运行事件循环;  main 函数在这里阻塞
    except KeyboardInterrupt:   # CTRL+C pressed
        pass

    print('Server shutting down.')
    server.close()  # <7> 关闭服务器
    # server.wait_closed() 方法返回一个期物，调用 loop.run_until_complete 方法运行期物
    loop.run_until_complete(server.wait_closed())  # <8>  
    loop.close()  # <9> 终止事件循环


if __name__ == '__main__':
    main(*sys.argv[1: ])  # <10>
# END TCP_CHARFINDER_MAIN
```
控制权流动:
  - main 函数几乎会立即显示 Serving on... 消息，然后在调用 loop.run_forever() 时阻塞
  - 控制权流动到事件循环中, 而且一直待在那里
  - 偶尔会回到handle_queries 协程, 这个协程需要等待网络发送或接收数据时, 控制权又交还事件循环
  - 在事件循环运行期间, 只要有新客户端连接服务器就会启动一个 handle_queries 协程实例

asyncio.start_server:
  - 返回: start_server 协程运行结束后，返回的协程对象返回一个 asyncio.Server实例，
  即一个 TCP 套接字服务器
  - 高层流 API:
    - asyncio 包提供了高层流 API,有现成的服务器可用
    - <http://docs.python.org/3/library/asyncio-stream.html>
  - 底层流API:
    - asyncio 包受 Twisted 框架中抽象的传送和协议启发，还提供了低层传送和协议 API
    - <http://docs.python.org/3/library/asyncioprotocol.html>

loop.run_forever()
  -  运行事件循环； main 函数在这里阻塞，直到在服务器的控制台中按 CTRL-C 键才会关闭

### 4.2 编写Web服务器
```python
index = UnicodeNameIndex()
with open(TEMPLATE_NAME) as tpl:
    template = tpl.read()
template = template.replace('{links}',  LINKS_HTML)

# BEGIN HTTP_CHARFINDER_HOME
def home(request):   # 一个路由处理函数, 参数是一个 aiohttp.web.Request 实例
    query = request.GET.get('query',  '').strip()  # 获取查询字符串, 去掉首尾的空白
    print('Query:  {!r}'.format(query))  # <3>
    if query:   # <4>
        descriptions = list(index.find_descriptions(query))
        res = '\n'.join(ROW_TPL.format(**descr._asdict())
                        for descr in descriptions)
        msg = index.status(query,  len(descriptions))
    else:
        descriptions = []
        res = ''
        msg = 'Enter words describing characters.'

    html = template.format(query=query,  result=res,   # <5>
                           message=msg)
    print('Sending {} results'.format(len(descriptions)))  # <6>
    return web.Response(content_type=CONTENT_TYPE,  text=html) # <7>
# END HTTP_CHARFINDER_HOME


# BEGIN HTTP_CHARFINDER_SETUP
@asyncio.coroutine
def init(loop,  address,  port):   # init 协程产出一个服务器, 交给事件循环驱动
    app = web.Application(loop=loop)  #  aiohttp.web.Application 类表示 Web 应用
    app.router.add_route('GET',  '/',  home)  # 通过路由把 URL 模式映射到处理函数上
    # 返回一个 aiohttp.web.RequestHandler 实例, 根据 app 对象设置的路由处理 HTTP 请求
    handler = app.make_handler()  
    # create_server 方法创建服务器, 以 handler 为协议处理程序
    server = yield from loop.create_server(handler,
                                           address,  port)  # <5>
    return server.sockets[0].getsockname()  # <6>

def main(address="127.0.0.1",  port=8888):
    port = int(port)
    loop = asyncio.get_event_loop()
    # 运行 init 函数, 启动服务器, 获取服务器的地址和端口
    host = loop.run_until_complete(init(loop,  address,  port))  # <7>
    print('Serving on {}. Hit CTRL-C to stop.'.format(host))
    try:
        loop.run_forever()  # <8> main 函数会在这里阻塞
    except KeyboardInterrupt:   # CTRL+C pressed
        pass
    print('Server shutting down.')
    loop.close()  # <9>
```

Server 对象:
  - asyncio.start_server函数和loop.create_server方法都是协程, 返回的结果都是
  asyncio.Server对象
  - 为了启动服务器并返回服务器的引用, 这两个协程都要由他人驱动, 完成运行
    - 在 TCP 示例中，做法是调用 loop.run_until_complete(server_coro)，
    其中 server_coro 是 asyncio.start_server 函数返回的结果
    - 在 HTTP 示例中， create_server 方法在 init 协程中的一个 yield from 表达式里调用，
    而 init 协程则由 main 函数中的 loop.run_until_complete(init(...)) 调用驱动

web.Application.add_route:
  - 文档: <http://aiohttp.readthedocs.org/en/v0.14.4/web_reference.html#aiohttp.web.UrlDispatcher.add_route>
  - 附注: 如果处理程序是普通的函数, 在内部会将其转换成协程

### 4.3 服务器设计可用工具
 aiopg:
  - 作用:
    - 提供了一个异步 PostgreSQL 驱动
    - 与 asyncio 包兼容, 支持使用 yield from 发送查询和获取结果
  - 文档: <http://aiopg.readthedocs.org/en/stable/>

## 延伸阅读
### Python:
asyncio:
  - 主页: <http://www.kancloud.cn/kindjeff/asyncio-zh/217030>
  - 使用模式介绍: <http://docs.python.org/3/library/asyncio-dev.html>

asyncio 学习资源:
  - <http://haypo-notes.readthedocs.org/asyncio.html>
  - <http://asyncio.org/>
  - <http://github.com/aio-libs>
    - 说明: 在这两个网站中能找到 PostgreSQL、 MySQL 和多种 NoSQL 数据库的异步驱动

aiohttp:
  - 文档: <http://aiohttp.readthedocs.org/en/>

Vaurien
  - 作用:
    - 在程序与后端服务器（eg: 数据库和Web 服务提供方）之间的 TCP 流量中引入延迟和随机错误
    - 为 Mozilla Services 项目开发
  - 文档: <http://vaurien.readthedocs.org/en/1.8/>
  - Mozilla Services 项目:  <http://mozilla-services.github.io/>

### blog:
演讲视频:
  - <http://speakerdeck.com/pycon2014/fan-in-and-fan-out-the-crucial-components-of-concurrency-bybrett-slatkin>
  - <http://www.youtube.com/watch?v=CWmq-jtkemY>
  - <http://pyvideo.org/video/1667/keynote-1>
  - <http://www.youtube.com/watch?v=1coLC-MUCJc>
  - <http://www.youtube.com/watch?v=MS1L2RGKYyY>
    - ppt: <http://www.slideshare.net/saghul/asyncio>
  - <http://pyvideo.org/video/1762/using-futures-for-async-guiprogramming-in-python>

文章:
  - 标题: Python’s asyncio Is for Composition,  Not Raw
  - 链接: <http://www.onebigfluke.com/2015/02/asyncio-is-for-composition.html>

Using futures for asyncGUI programming in Python 3.3”
  - 说明: 如何把 asyncio 包集成到 Tkinter 事件循环中
  - http://pyvideo.org/video/1762/using-futures-for-async-guiprogramming-in-python
  - http://github.com/fluentpython/asyncio-tkinter

### 实用工具  

### 文章:
相关文章:
1. https://mp.weixin.qq.com/s/E-7bMIdmzerr7xpSqD0YXg
2. http://aosabook.org/en/500L/a-web-crawler-with-asyncio-coroutines.html

![collections.abc](../image/async_summary.png)

## 附注
Python 异步库
  - Twisted 是 Node.js 的灵感来源之一
  - Tornado 拥护使用协程做面向事件编程

异步库兼容:
  - 设计 asyncio 包时考虑到了使用外部包替换自身的事件循环, 因此才有
  asyncio.get_event_loop 和 set_event_loop 函数——二者是抽象的事件循环策略API <http://docs.python.org/3/library/asyncio-eventloops.html#event-loop-policies-and-thedefault-policy>
  - Tornado 已经有实现 asyncio.AbstractEventLoop 接口的类 AsyncIOMainLoop <http://tornado.readthedocs.org/en/latest/asyncio.html>
  - 因此在同一个事件循环中可以使用这两个库运行异步代码

Quamash 项目:
  - 文档: <http://pypi.python.org/pypi/Quamash/>
  - 把 asyncio 包集成到 Qt 事件循环中, 以便使用 PyQt 或 PySide 开发 GUI 应用

Django:
  - 传统框架的目的是渲染完整的 HTML 网页, 而且不支持异步访问数据库

WebSockets 协议:
  - 作用是为始终连接的客户端（例如游戏和流式应用）提供实时更新
  -  asyncio 包的架构能很好地支持 WebSockets, 以下包在 asyncio 基础上实现了 WebSockets
    - Autobahn|Python: <http://autobahn.ws/python/>
    - WebSockets: <http://aaugustin.github.io/websockets/>

异步数据库 API 3.0: <http://www.python.org/dev/peps/pep-0249/>

asyncio.Future 类与 Twisted 中的Deferred 类不同的原因:  <http://groups.google.com/forum/#!msg/python-tulip/ut4vTG-08k8/PWZzUXX9HYIJ>
