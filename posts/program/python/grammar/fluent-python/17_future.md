---
weight: 1
title: "futrue"
date: 2018-01-17T22:00:00+08:00
lastmod: 2018-01-17T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Python futrue"
featuredImage: 

tags: ["python 进阶"]
categories: ["Python"]

lightgallery: true
---

## 1. futrue 的概念
### 1.1 对 futrue 的理解
期物：
  - 包括：
    - concurrent.futures.Future 类
    - asyncio.Future 类
    - Twisted 的 Deferred 类
    - Tornado 的 Future 类
  - 作用：
    - 指一种对象, 表示异步执行的操作
    - 类的实例表示可能已经完成或者尚未完成的延迟计算
  - 理解：
    - 期物封装待完成的操作, 可以放入队列
    - 完成的状态可以查询, 得到结果(或抛出异常)后可以获取结果(或异常)


## 2. concurrent.futures
组成：
  - Executor 类：
    - 顶层接口类, 提供了多线程, 多进程并发执行的接口
    - 封装了实例化和操作 Future 对象的接口
  - Future 类：模块的基本组件, 用于实现并发操作的基本对象
  - 其他函数：直接操作 Future 实例的函数

文档：
  - <https://docs.python.org/3/library/concurrent.futures.html>
  - <https://www.python.org/dev/peps/pep-3148/>

### 2.1 Executor 类
 ThreadPoolExecutor 类
  - 作用：在不同线程中执行可调用的对象
  - 实现：在内部维护着一个 **工作线程池**, 以及要执行的任务队列
  - 适用：I/O 密集型应用
  - 初始化：
    - \_\_init\__(self,  max_workers=None):
      - max_workers:启用线程数

ProcessPoolExecutor 类
  - 作用：在不同进程中执行可调用的对象
  - 实现：在内部维护着一个 **工作进程池**, 以及要执行的任务队列
  - 适用： CPU 密集型处理, 使用这个模块能绕开 GIL, 利用所有可用的 CPU 核心
  - 初始化：
    - \_\_init\__(self,  max_workers=None):
      - max_workers:启用进程数, 可选, 默认是os.cpu_count() 函数返回的 CPU 数量

ThreadPoolExecutor 使用示例

```python
from concurrent import futures

def download_many(cc_list):
    workers = min(MAX_WORKERS,  len(cc_list))
    with futures.ThreadPoolExecutor(workers) as executor: ➎
        res = executor.map(download_one,  sorted(cc_list)) ➏
    return len(list(res)) ➐
```
1. ➎ executor.\_\_exit\_\_ 方法
  - 会调用executor.shutdown(wait=True) 方法, 在所有线程都执行完毕前阻塞线程
2. ➏ map 方法
  - 非阻塞调用, 作用与内置的 map 函数类似
  - 不过 download_one 函数会在多个线程中并发调用
  - 返回一个生成器
3. ➐ 返回获取的结果数量
  - 隐式调用 next()函数从 map 返回的迭代器中获取相应的返回值
  - 如果有线程抛出异常, 异常会在这里抛出
  - 迭代返回结果的顺序与调用开始的顺序一致

### 2.2 Future
#### 实例化
附注：
  - 通常情况下自己不应该创建期物, 只能由并发框架(concurrent.futures 或 asyncio)实例化
  - 原因是期物表示终将发生的事情, 而确定某件事会发生的唯一方式是执行的时间已经排定,
  因此只有排定把某件事交给concurrent.futures.Executor子类处理时,
  才会创建concurrent.futures.Future实例

Executor = futures.ThreadPoolExecutor(workers)  
Executor = futures.ProcessPoolExecutor(workers)
  - workers：并发线程或进程数

**从Executor获取 Future 实例**

|接口|参数|作用|返回值|
|:---|:---|:---|
|Executor.submit()|一个可调用的对象|为传入的可调用对象排期|一个期物(Future类实例)|

#### 可用方法
<!-- |接口|参数|作用| -->
<!-- |:---|:---|:---| -->
<!-- |.done()||不阻塞, 指明期物链接的可调用对象是否已经执行, 布尔值| -->
<!-- |.result()||在期物运行结束后调用, 返回可调用对象的结果, 或者重新抛出执行可调用的对象时抛出的异常|| -->
<!-- |.add_done_callback()|可调用对象|期物运行结束后会调用指定的可调用对象| -->
附注：
  - 客户端代码不应该改变期物的状态, 并发框架在期物表示的延迟计算结束后会改变期物的
状态, 而我们无法控制计算何时结束
  - 客户端代码通常不会询问期物是否运行结束, 而是会等待通知

方法：
1. Future.done()
  - 作用：不阻塞, 指明期物链接的可调用对象是否已经执行, 返回一个布尔值
2. Future.add_done_callback()：
  - 参数：可调用对象
  - 作用：期物运行结束后会调用传入的可调用对象
3. Future.result():
  - 在期物运行结束后调用
    - 返回可调用对象的结果
    - 或者重新抛出执行可调用的对象时抛出的异常
  - 期物没有运行结束时调用
    - 会阻塞调用方所在的线程, 直到有结果可返回
    - result 可以接收可选的 timeout 参数, 如果在指定的时间内期物没有运行完毕,
    会抛出 TimeoutError 异常

### 2.3 其他函数
1. as_completed():
  - 参数：一个期物列表
  - 返回值：一个迭代器, 在期物运行结束后产出期物


### 2.4 使用示例
```python
def download_many(cc_list):
    cc_list = cc_list[:5] ➊
    with futures.ThreadPoolExecutor(max_workers=3) as executor: ➋
        # 创建并排定期物
        to_do = []
        for cc in sorted(cc_list): ➌
            future = executor.submit(download_one,  cc) ➍
            to_do.append(future) ➎
            msg = 'Scheduled for {}: {}'
            print(msg.format(cc,  future)) ➏
        # 获取期物的结果
        results = []
        for future in futures.as_completed(to_do): ➐
            res = future.result() ➑
            msg = '{} result: {!r}'
            print(msg.format(future,  res)) ➒
            results.append(res)
    return len(results)
```

### 2.5 Executor.map 与 as_completed 对比
Executor.map:
  - 返回一个迭代器, 迭代此生成器返回结果的顺序与调用开始的顺序一致,
  - eg：如果第一个调用生成结果用时 10秒, 而其他调用只用 1 秒,
  代码会阻塞 10 秒, 获取 map 方法返回的生成器产出的第一个结果
  - executor.map 只能处理参数不同的同一个可调用对象

Executor.submit 和 futures.as_complete 结合：
  - as_complete 返回的生成器在迭代时，不管提交的顺序, 只要有结果就获取
  - submit 方法能处理不同的可调用对象和参数
  - 传给 futures.as_completed 函数的期物集合也可以来自多个 Executor 实例



## 3. GIL
### 3.1 阻塞型I/O和GIL
GIL - 全局解释器锁:
  - CPython 解释器本身就不是线程安全的, 因此有全局解释器锁(GIL), 一次只允许使用一
个线程执行 Python 字节码
  - 编写 Python 代码时无法控制 GIL；不过, 执行耗时的任务时, 可以使用一个内置的函数
或一个使用 C 语言编写的扩展释放 GIL
  - 其实, 有个使用 C 语言编写的 Python 库能管理GIL, 自行启动操作系统线程,
  利用全部可用的 CPU 核心。这样做会极大地增加库代码的复杂度, 因此大多数库的作者都不这么做
  - **标准库中所有执行阻塞型 I/O 操作的函数, 在等待操作系统返回结果时都会释放GIL**
  - 这意味着在 Python 语言这个层次上可以使用多线程, 而 I/O 密集型 Python 程序能从
中受益：一个 Python 线程等待网络响应时, 阻塞型 I/O 函数会释放 GIL, 再运行一个线程

GIL 存在原因：
  - 简化了 CPython 解释器和 C 语言扩展的实现, 得益于 GIL,  Python 有很多 C 语言扩展



结论：I/O 密集型应用, 适合使用Python 多线程

附注：sleep 函数总会释放 GIL。因此, 即使休眠 0 秒, Python 也可能会切换到另一个线程

### 3.2 CPU 密集型应用
CPU 密集型应用可用方案：
  - 可以使用多进程绕开 GIL, 利用所有可用的 CPU 核心,  eg：ProcessPoolExecutor
  - 使用PyPy(http://pypy.org)
  - Apache Spark:分布式计算引擎 <https://spark.apache.org/examples.html>

```python
JOBS = 12
SIZE = 2**20
STATUS = '{} workers,  elapsed time: {:.2f}s'

def sha(size):
    data = bytearray(randrange(256) for i in range(size))
    algo = hashlib.new('sha256')
    algo.update(data)
    return algo.hexdigest()

def main(workers=None):
    if workers:
        workers = int(workers)
    t0 = time.time()

    with futures.ProcessPoolExecutor(workers) as executor:
        actual_workers = executor._max_workers
        to_do = (executor.submit(sha,  SIZE) for i in range(JOBS))
        for future in futures.as_completed(to_do):
            res = future.result()
            print(res)
```

## 4. 完整示例
### 4.1 背景
示例说明：2.4 的示例扩展, 增加错误处理和进度条

TQDM：
  - 文档：<https://github.com/noamraph/tqdm>
  - 作用：实现的文本动画进度条
  - 接口：为了计算预计剩余时间,  tqdm 函数要获取一个能使用 len 函数确定大小的可迭代对象,
  或者在第二个参数中指定预期的元素数量

```python
def download_many(cc_list,  base_url,  verbose,  max_req):
    counter = collections.Counter()  
    cc_iter = sorted(cc_list)
    if not verbose:
        cc_iter = tqdm.tqdm(cc_iter) # 能使用 len 函数确定大小的可迭代对象
    for cc in cc_iter:    # 返回一个迭代器, 产出 cc_iter 中的元素, 还会显示进度条动画。
        .......
```

### 4.2 多线程版本
```python
import collections
from concurrent import futures

import requests
import tqdm  # <1>

from flags2_common import main,  HTTPStatus  # <2>
from flags2_sequential import download_one  # <3>

DEFAULT_CONCUR_REQ = 30  # <4>
MAX_CONCUR_REQ = 1000  # <5>


def download_many(cc_list,  base_url,  verbose,  concur_req):
    counter = collections.Counter()
    with futures.ThreadPoolExecutor(max_workers=concur_req) as executor:  # <6>
        # 构建并排定期物
        to_do_map = {}  # <7>
        for cc in sorted(cc_list):  # <8>
            future = executor.submit(download_one,
                            cc,  base_url,  verbose)  # <9>
            to_do_map[future] = cc  # 把各个期物映射到其他数据(期物运行结束后可能有用)
        # 获取期物的结果
        done_iter = futures.as_completed(to_do_map)  # <11>
        if not verbose:
            # done_iter 没有 len 函数, 必须通过 total 参数告诉 tqdm 函数预期的元素数量
            done_iter = tqdm.tqdm(done_iter,  total=len(cc_list))  # <12>
        for future in done_iter:  # <13> 迭代的是期物, 无法直接知道当前处理的是哪个国家
            try:
                res = future.result()  # <14>
            except requests.exceptions.HTTPError as exc:  # <15>
                error_msg = 'HTTP {res.status_code} - {res.reason}'
                error_msg = error_msg.format(res=exc.response)
            except requests.exceptions.ConnectionError as exc:
                error_msg = 'Connection error'
            else:
                error_msg = ''
                status = res.status

            if error_msg:
                status = HTTPStatus.error
            counter[status] += 1
            if verbose and error_msg:
                cc = to_do_map[future]  # <16>
                print('*** Error for {}: {}'.format(cc,  error_msg))

    return counter
```

## 5. 多线程, 多进程实现
concurrent.futures
  - 特点：只不过是使用线程的最新方式
  - 适用：线程或进程之间相互独立, 无需进行线程间或进程间通信(高度并行问题)
  - 缺点：缺乏灵活性

threading 模块：
  - 作用：Python 多线程原生库
  - 文档：<https://docs.python.org/3/library/threading.html>
  - 接口：
    - 基本组件：Thread、 Lock、 Semaphore 等
    - 通信：可以使用 queue 模块创建线程安全的队列, 在线程之间传递数据

multiprocessing 模块
  - 作用：Python 多进程原生库
  - 文档：<https://docs.python.org/3/library/multiprocessing.html>
  - 接口：
    - API：threading 模块相仿, 不过作业交给多个进程处理
    - 通信：支持基础设施的锁、队列、管道、共享内存, 等等

**lelo 库**
  - 文档：<https://pypi.python.org/pypi/lelo>
  - 作用：使用 **多进程** 处理并行任务
  - 接口：定义了一个 @parallel 装饰器, 可以应用到任何函数上, 把函数变成非阻塞：
  调用被装饰的函数时, 函数在一个新进程中执行

**python-parallelize**
  - 文档：<https://github.com/npryce/python-parallelize>
  - 作用：使用 **多进程** 处理并行任务
  - 接口：提供了一个 parallelize 生成器, 能把 for 循环分配给多个 CPU 执行

## 延伸阅读
### Python:
标准库
  - queue：
    - 作用：线程安全的队列
    - 文档：<https://docs.python.org/3/library/queue.html>

GIL：
  - 文档：<https://docs.python.org/3/faq/library.html#id18>
  - 其他：
    - It isn’t Easy to Remove the GIL:
    <http://www.artima.com/weblogs/viewpost.jsp?thread=214235>
    - Python Threadsand the Global Interpreter Lock:
    <http://jessenoller.com/2009/02/01/python-threads-and-the-globalinterpreter-lock/>
    - Understanding the Python GIL: <http://www.dabeaz.com/GIL/>

### blog:

### 实用工具  

### 书籍:
《Parallel Programming with Python》

《Python Cookbook(第 3 版)中文版》
  - 11.12 理解事件驱动型 I/O
  - 12.7 创建线程池
  - 12.8 实现简单的并行编程

《Effective Python：编写高质量 Python 代码的 59 个有效方法》
  - 协程；
  - 使用 concurrent.futures 库处理线程和进程；
  - 不使用 ThreadPoolExecutor 类, 而使用锁和队列做线程编程

《High Performance Python》

《Python 标准库》

《七周七并发模型》

## 杂谈
高度并行问题：<https://en.wikipedia.org/wiki/Embarrassingly_parallel>

Elixir 语言

Go 语言
  - Go 不支持宏, 句法比 Python 简单; 也不支持继承和运算符重载, 而且提
供的元编程支持没有 Python 多
  - 这些限制被认为是 Go 语言的特点, 因为行为和性能更可预料。这对高并发来说是好事

JavaScript：
  - 根本不支持用户层级的线程, 只能通过回调式异步编程实现并发
