# 4.2 上下文管理器和 else 块
本章内容
- for、while 和 try 语句的 else 子句
- EAFP 与 LBYL
- 上下文管理器协议
- with 语句和上下文管理器
- contextlib 模块

## 1. else 子句
作用：
  1. 能让代码更易于阅读
  2. 不用设置控制标志或者添加额外的 if 语句

控制逻辑：
  - for ：仅当 for 循环运行完毕时（没有被 break 语句中止）才运行 else 块
  - while：仅当 while 循环因为条件为假值而退出时（没有被 break 语句中止）才运行 else 块
  - try：
    - 仅当 try 块中没有异常抛出时才运行 else 块
    - else 子句抛出的异常不会由前面的 except 子句处理
  - 如果异常、return、break 或 continue 导致控制权跳到了复合语句的主块之外，else 子句就会被跳过


```python
try:
    dangerous_call()
    # after_call()   不应该放在这
except OSError:
    log('OSError...')
else:
    after_call()
```
示例分析：
  - try 块中应该只捕获预期的异常
  - 这里捕获的是 dangerous_call() 可能出现的错误，而不是 after_call()
  - 只有 try 块不抛出异常，才会执行 after_call()

## 2. EAFP 与 LBYL
Python 官方词汇表：https://docs.python.org/3/glossary.html#term-eafp

**EAFP**:
  - 取得原谅比获得许可容易（easier to ask for forgiveness than permission）。这是一
种常见的 Python 编程风格，先假定存在有效的键或属性，如果假定不成立，那
么捕获异常。这种风格简单明快，特点是代码中有很多 try 和 except 语句。与
其他很多语言一样（如 C 语言），这种风格的对立面是 LBYL 风格。

**LBYL**:
  - 三思而后行（look before you leap）。这种编程风格在调用函数或查找属性或键之
前显式测试前提条件。与 EAFP 风格相反，这种风格的特点是代码中有很多 if
语句。在多线程环境中， LBYL 风格可能会在“检查”和“行事”的空当引入条
件竞争。例如，对 if key in mapping: return mapping[key] 这段代码来说，如
果在测试之后，但在查找之前，另一个线程从映射中删除了那个键，那么这段代
码就会失败。这个问题可以使用锁或者 EAFP 风格解决


## 2. 上下文管理器和with
 上下文管理器对象存在的目的是管理 with 语句，就像迭代器的存在是为了管理 for 语句一样

### 2.1 with 语句
- 作用：
  1. 简化 try/finally 模式
    - 这种模式用于保证一段代码运行完毕后执行某项操作，
    - 即便那段代码由于异常、return 语句或 sys.exit() 调用而中止，也会执行指定的操作
    - finally 子句中的代码通常用于释放重要的资源，或者还原临时变更的状态
  2. 不仅能管理资源，还能用于去掉常规的设置和清理代码，或者在另一个过程前后执行的操作
- 特性：与函数和模块不同， with 块没有定义新的作用域
- 原理：
  - with 语句会设置一个临时的上下文，交给上下文管理器对象控制
  - 上下文管理器对象实现了上下文管理器协议，在 with 语句执行的前后执行特定操作

**执行过程**
  1. 执行 with 后面的表达式，得到上下文管理器对象
  2. 执行上下文管理器对象的\_\_enter\_\_方法，返回值被绑定到目标变量上(as 子句)
  3. 不管控制流程以哪种方式退出 with 块，都会在上下文管理器对象上调用 \_\_exit\_\_ 方法
  4. with 语句的 as 子句是可选的

```python
>>> with open('mirror.py') as fp:
... src = fp.read(60)
```
示例解析
  - open() 函数返回的 TextIOWrapper 类实例是上下文管理器对象
  - 该实例的 \_\_enter\_\_ 方法返回 self 赋值给 as 子句中的变量 fp
  - 在 with 块的末尾，调用 TextIOWrapper.\_\_exit\_\_ 方法把文件关闭
  - \_\_enter\_\_ 方法除了返回上下文管理器之外，还可能返回其他对象

### 2.2 上下文管理器协议
**协议接口**
1. \_\_enter\_\_(self)
  - 运行：with 语句开始运行时，在上下文管理器对象上调用
  - 参数：
2. \_\_exit\_\_ (self, exc_type, exc_value, traceback)  
  - 运行：with 语句运行结束后，在上下文管理器对象上调用，扮演着 finally 子句的角色
  - 异常：返回 None，或者 True 之外的值， with 块中的任何异常都会向上冒泡
  - 参数：  
    - exc_type:异常类（例如 ZeroDivisionError）
    - exc_value 异常实例。有时会有参数传给异常构造方法，例如错误消息，这些参数可以使用 exc_value.args 获取
    - traceback：traceback 对象
  - 附注：
    - 如果一切正常， Python 调用 \_\_exit\_\_ 方法时传入的参数是 None, None, None
    - 在finally 块中调用 sys.exc_info()，得到的就是 \_\_exit\_\_ 接收的这三个参数

### 2.3 上下文管理器的应用
1. 在 sqlite3 模块中用于管理事务
  - 参见“12.6.7.3. Using the connection as a context manager”
  https://docs.python.org/3/library/sqlite3.html#using-the-connection-as-a-context-manager
2. 在 threading 模块中用于维护锁、条件和信号
  - 参见“17.1.10. Using locks, conditions,and semaphores in the with statement”
  - https://docs.python.org/3/library/threading.html#using-locks-conditions-and-semaphores-in-the-with-statement
3. 为 Decimal 对象的算术运算设置环境
  - 参见 decimal.localcontext 函数的文档
  - https://docs.python.org/3/library/decimal.html#decimal.localcontext
4. 为了测试临时给对象打补丁
  - 参见 unittest.mock.patch 函数的文档
  - https://docs.python.org/3/library/unittest.mock.html#patch


## 3. contextlib模块
### 2.1 实用工具
文档：https://docs.python.org/3/library/contextlib.html

|对象|说明|
|: ---|: ---|
|redirect_stdout|只需传入类似文件的对象，用于替代 sys.stdout|
|closing|如果对象提供了 close() 方法，但没有实现 \_\_enter\_\_/\_\_exit\_\_ 协议，<br>那么可以使用这个函数构建上下文管理器|
|suppress|构建临时忽略指定异常的上下文管理器|
|ContextDecorator|这是个基类，用于定义基于类的上下文管理器<br>这种上下文管理器也能用于装饰函数，在受管理的上下文中运行整个函数|
|ExitStack|这个上下文管理器能进入多个上下文管理器<br>with 块结束时，按照后进先出的顺序调用栈中各个上下文管理器的 \_\_exit\_\_ 方法<br>如果事先不知道 with 块要进入多少个上下文管理器，可以使用这个类<br>例如，同时打开任意一个文件列表中的所有文件|


### 2.2 @contextmanager
  - 作用：
    - 把简单的生成器函数变成上下文管理器，不用创建类去实现管理器协议
  - 方法：
    1. 只需实现有一个 yield 语句的生成器，生成想让\_\_enter\_\_ 方法返回的值
    2. yield 语句的作用是把函数的定义体分成两部分
      - yield 语句前面的所有代码在 with 块开始时（即解释器调用 \_\_enter\_\_ 方法时）执行
      - yield 语句后面的代码在 with 块结束时（即调用 \_\_exit\_\_ 方法时）执行
    3. 装饰器会把函数包装成实现 \_\_enter\_\_ 和 \_\_exit\_\_ 方法的类
      - 类的 \_\_enter\_\_ :
        - 调用生成器函数，保存生成器对象（这里把它称为 gen）。
        - 调用 next(gen)，执行到 yield 关键字所在的位置。
        - 返回 next(gen) 产出的值，以便把产出的值绑定到 with/as 语句中的目标变量上
      - \_\_exit\_\_ 方法
        - 检查有没有把异常传给 exc_type；如果有，调用 gen.throw(exception)，
        在生成器函数定义体中包含 yield 关键字的那一行抛出异常。
        - 否则，调用 next(gen)，继续执行生成器函数定义体中 yield 语句之后的代码
        - 因此使用 @contextmanager 装饰器时，要把 yield 语句放在 try/finally
        语句中（或者放在 with 语句中）
  - 异常管理:
    - 使用 @contextmanager 装饰器时，异常的处理与上下文管理器协议是相反的
    - 装饰器提供的 \_\_exit\_\_ 方法假定发给生成器的所有异常都得到处理了，因此应该压制异常。
    - 如果不想让 @contextmanager 压制异常，必须在被装饰的函数中显式重新抛出异常
  - 附注：
    - 在 @contextmanager 装饰器装饰的生成器中， yield 与迭代没有任何关系
    - 生成器函数的作用更像是协程：执行到某一点时暂停，让客户代码运行，直到客户让协程继续做事

```python
import contextlib

@contextlib.contextmanager
def looking_glass():
    import sys
    original_write = sys.stdout.write

    def reverse_write(text):
        original_write(text[::-1])

    sys.stdout.write = reverse_write
    msg = ''
    try:
        yield 'JABBERWOCKY' ➊
    except ZeroDivisionError:
        msg = 'Please DO NOT divide by zero!'
    finally:
        sys.stdout.write = original_write
        if msg:
            print(msg)

>>> with looking_glass() as what:
... print('Alice, Kitty and Snowdrop')
```
➊ yield 'JABBERWOCKY'
  - 这个值会绑定到 with 语句中 as 子句的目标变量上
  - 执行 with 块中的代码时，这个函数会在这一点暂停
  - 控制权跳出 with 块，继续执行 yield 语句之后的代码

### 2.3 原地文件重写
  - http://www.zopatista.com/python/2013/11/26/inplace-file-rewriting/
  - 使用  @contextmanager 实现的原地文件重写上下文管理器

```python
# 用于原地重写文件的上下文管理器
import csv
with inplace(csvfilename, 'r', newline='') as (infh, outfh):
    reader = csv.reader(infh)
    writer = csv.writer(outfh)
    for row in reader:
        row += ['new', 'columns']
        writer.writerow(row)
```
inplace 函数
  - 是个上下文管理器，为同一个文件提供了两个句柄（这个示例中的 infh 和outfh），以便同时读写同一个文件

## 延伸阅读
### Python:
Compound statements
  - 全面说明了 if、 for、 while 和 try 语句的 else 子句
  - https://docs.python.org/3/reference/compound_stmts.html

上下文管理器的类型
  - 4. Built-in Types
  -  https://docs.python.org/3/library/stdtypes.html#typecontextmanager

上下文管里器
  - PEP 343—The‘ with’ Statement”
  - https://www.python.org/dev/peps/pep-0343/

\_\_enter\_\_/\_\_exit\_\_
  - 3.3.8. With Statement Context Managers
  - https://docs.python.org/3/reference/datamodel.html#with-statement-context-managers

### blog:
What Makes Python Awesome?
  - http://pyvideo.org/video/1669/keynote-3

Is it a good practice to use try-except-else in Python
  - 讨论了 try/except 语句（有 else 子句，或者没有）是否符合 Python 风格
  -  http://stackoverflow.com/questions/16138232/is-it-a-good-practice-to-use-try-except-else-in-python

Transforming Code into Beautiful, Idiomatic Python
  -  https://speakerdeck.com/pyconslides/transforming-code-into-beautiful-idiomatic-python-by-raymond-hettinger-1?slide=34

### 实用工具
The Python with Statement by Example
  - http://preshing.com/20110920/the-python-with-statement-by-example/），
  - 举例说明了 pycairo 图形库中的上下文管理器  

### 书籍:
《 Python 技术手册（第 2 版）》
  - 有一章是关于异常的，那一章极好地讨论了 EAFP 风格

《 Python Cookbook（第 3 版）中文版》
  - 8.3 让对象支持上下文管理协议
  - 9.22 以简单的方式定义上下文管理器

## 附注
