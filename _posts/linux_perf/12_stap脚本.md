---
title: 3.2 stap 脚本
date: 2020-01-09
categories:
    - 运维
tags:
    - Linux性能调优
---

本节我们来看看 stap 脚本的基本语法。
<!-- more -->

## 1. Systemtap 执行细节
SystemTap脚本运行时，会启动一个对应的SystemTap会话。整个会话大致流程如下：
1. 首先，SystemTap会检查脚本中用到的tapset，确保它们都存在于tapset库中（通常是/usr/share/systemtap/tapset/）
2. SystemTap会把找到的tapset替换成在tapset库中对应的定义
3. [tapset](https://sourceware.org/systemtap/tapsets/)是tap（听诊器）的集合，指一些预定义的SystemTap事件或函数
4. SystemTap接着会把脚本转化成C代码，运行系统的C编译器编译出一个内核模块。
5. SystemTap随即加载该模块，并启用脚本中所有的探,这一步由system-runtime包的staprun完成
6. 每当被监控的事件发生，对应的处理程序就会被执行。
7. 一旦SystemTap会话终止，探针会被禁用，内核模块也会被卸载。

### 1.1 tapsets
tapsets是一些包含常用的探针和函数的内置脚本，你可以在SystemTap脚本中复用它们。当用户运行一个SystemTap脚本时，SystemTap会检测脚本中的事件和处理程序，并在翻译脚本成C代码之前，加载用到的tapset。

与 SystemTap脚本一样，tapset的拓展名也是.stp。默认情况下tapset位于`/usr/share/systemtap/tapset/`。跟SystemTap脚本不同的是，tapset不能被直接运行；它只能作为库使用。 

tapset库让用户能够在更高的抽象层次上定义事件和函数。tapset提供了一些常用的内核函数的别名，这样用户就不需要记住完整的内核函数名了（尤其是有些函数名可能会因内核版本的不同而不同）。另外tapset也提供了常用的辅助函数，比如下面将介绍的 thread_indent()。

### 1.2 SystemTap脚本
SystemTap脚本由两部分组成：事件和处理程序。一旦SystemTap会话准备就绪，SystemTap会监控操作系统中特定的事件，并在事件发生的时候触发对应的处理程序。

一个事件和它对应的处理程序合称探针。一个SystemTap脚本可以有多个探针。 一个探针的处理程序部分通常称之为探针主体（probe body）

下面是一个 Systemtap 脚本的简单示例。需要注意的是 SystemTap脚本会一直运行，直到执行了exit()函数。如果你想中途退出一个脚本，可以用Ctrl+c中断

```bash
probe begin
{
  printf ("hello world\n")
  exit ()
}
```

## 2. SystemTap脚本的基本语法
### 2.1 Systemtap 探针定义
SystemTap脚本的后缀是.stp，并以这样的语句表示一个探针：`probe event,event1 {statment}`

```bash
# 1. 定义探针
# 一个探针指定多个事件；每个事件以逗号隔开
# 语句块由花括号（{}）括住，语句间通常不需要特殊的分隔符或终止符
probe event,event1 {statment}
```

### 2.2 Systemtap 事件
SystemTap事件大致分为两类：同步事件和异步事件。

![probe-event](/images/linux_pf/probe-event.png)

同步事件会在任意进程执行到内核特定位置时触发。
1. `syscall.system_call`: 
    - 作用: 名为 system_call 的系统调用的调用事件
    - syscall.system_call.return: .return 表示 system_call 系统调用的退出事件
3. `vfs.file_operation`:
    - 作用: 进入虚拟文件系统（VFS）名为file_operation的文件操作
    - vfs.file_operation.return: .return 表示 file_operation 的退出事件
    - file_operation取值的范畴，取决于当前内核中struct file_operations的定义的操作（可能位于include/linux/fs.h中，不同版本位置不同，建议上http://lxr.free-electrons.com/ident 查找
3. `kernel.function("func_name@file_name[:line_num]")`:
    - 作用: 内核调用和返回事件
    - 参数:
        - func_name: 函数名，可使用 `*` 通配
        - file_name: 文件名
        - `[:line_num]`: 指定行号，可选，如从行x到y，使用`:x-y`这样格式作为行号
    - eg: kernel.function("sys_open")即内核函数sys_open被调用时所触发的事件
    - eg: kernel.function("sys_open")即内核函数sys_open被调用时所触发的事件
    - eg: `kernel.function("*@net/socket.c")`: net/socket.c中的所有函数的调用事件
4. `kernel.trace("tracepoint")`:
    - 作用: 
        - 跟踪内核的静态探测点。 
        - 表示到达名为tracepoint的静态内核探测点
    - eg: kernel.trace("kfree_skb")表示内核释放了一个网络缓冲区的事件
    - `sudo perf list`: 列出所有的静态内核探测点
5. `module("module").function("function")`
    - 作用: 进入指定模块module的function函数
    - eg: `module("ext3").function("*")` 表示 ext3 模块中的每个函数调用
    - 系统内的所有内核模块通常都在`/lib/modules/$(uname -r)`
    - `find -name '*.ko' -printf '%f\n' | sed 's/\.ko$//'`: 列出所有的内核模块

除了上面的这些基础事件，Systemtap 按照特定的功能集合，创建了不同的 [tapset](https://sourceware.org/systemtap/tapsets/)，常见的包括:
6. ioblock:
    - 作用: 块设备接口和 I/O 调度器
7. scheduler:
    - 作用: 内核 CPU 调度器事件
8. memeory:
    - 进程和虚拟内存的使用
9. scsi:
    - 作用: SCSI 目标的事件
10. networking:
    - 作用: 网络设备事件，包括接收和传输
11. tcp
    - 作用: TCP 协议事件，包括发送和接收事件
12. socket
    - 作用: 套接字事件

异步事件跟特定的指令或代码的位置无关。 这部分事件主要包含计数器、定时器和其它类似的东西
1. begin:
    - 作用: SystemTap会话的启动事件，会在脚本开始时触发
2. end:
    - 作用: SystemTap会话的结束事件，会在脚本结束时触发。
3. timer events
    - 作用: 用于周期性执行某段处理程序
    - 说明: 定时事件总是跟其它事件搭配使用。其它事件负责收集信息，而定时事件定期输出当前状况，让你看到数据随时间的变化情况。
    - eg: `probe timer.s(4) { printf("hello world\n") }`: 每隔4秒就会输出hello world
    - 其它规格的定时器:
        - timer.ms(milliseconds)
        - timer.us(microseconds)
        - timer.ns(nanoseconds)
        - timer.hz(hertz)
        - timer.jiffies(jiffies): jiffies 表示时钟中断
        - timer.profile: 按照内核时钟频率对所有 CPU 都触发的探针，用于采样/剖析

### 2.3 函数
#### 内置函数
|函数|作用|
|:---|:---|
|printf|格式化输出|
|execname|获取触发事件的进程名，下面将触发时间发生的进程称为当前进程|
|pid|当前进程ID|
|tid|当前线程ID|
|uid|当前进程的UID|
|cpu|当前CPU|
|gettimeofday_s|自epoch以来的秒数|
|ctime|将 gettimeofday_s 返回的秒数转化成时间字符串|
|pp|返回描述当前处理的探测点的字符串|
|thread_indent|打印空白，组织输出，以反映函数的调用次序和调用层级|
|name|返回系统调用的名字。只能在syscall.system_call触发的处理程序中使用|
|target|返回 `-x PID` 或 `-c command` 指定的PID或命令名|

#### 自定义函数
SystemTap允许你编写函数来提取探针间公共的逻辑，函数的定义和使用如下所示: 
```bash
# 函数定义
function function_name(arguments) {statements}

# 函数使用
# arguments是传递给函数的可选的入参
probe event {function_name(arguments)}
```
下面是Systemtap 脚本的使用示例:
```
# 示例1 
probe syscall.open
{
  printf ("%s(%d) open\n", execname(), pid())
}

# 示例2
probe kernel.function("*@net/socket.c").call
{
  printf ("%s -> %s\n", thread_indent(1), probefunc())
}
probe kernel.function("*@net/socket.c").return
{
  printf ("%s <- %s\n", thread_indent(-1), probefunc())
}
```

### 2.4 变量定义
下面是 Systemtap 脚本内使用变量的一个示例，通过示例可以发现:
1. global 用于定义全局变量，可在所有探针内使用
2. 探针内的局部变量(eg: hz) 仅限探针内使用
2. SystemTap可以自动判定变量的类型，且属于强类型语言

```bash
# 计算内核的CONFIG_HZ配置
global count_jiffies, count_ms
probe timer.jiffies(100) { count_jiffies ++ }
probe timer.ms(100) { count_ms ++ }
probe timer.ms(12345)
{
  hz=(1000*count_jiffies) / count_ms
  printf ("jiffies:ms ratio %d:%d => CONFIG_HZ=%d\n",
    count_jiffies, count_ms, hz)
  exit ()
}
```
### 2.5 关联数组
关联数组即字典，Systemtap 中关联数组需要定义为全局变量。在一个数组语句中你最多可以指定九个表达式，每个表达式间以,隔开。这样做可以给单个键附加多个信息。

```bash
# 1. 数组赋值
foo["tom"] = 23
foo["dick"] = 24
foo["harry"] = 25



# 2. 数组读取
# 如果数组中没有对应的键，默认情况下在数值计算中返回 0，在字符串操作中返回空字符串
printf("%s", foo["harry"]) 

# 3. 删除数组和数组中的元素
delete foo
delete foo['tom']

# 4. 数组的键可以指定多个表达式
device[pid(),execname(),uid(),ppid(),"W"] = devname

global reads
probe vfs.read
{
  reads[execname(),pid()] <<< 1
}

probe timer.s(3)
{
  foreach([var1,var2] in reads)
    printf("%s (%d) : %d \n", var1, var2, @count(reads[var1,var2]))
}
```

### 2.6 条件与循环
SystemTap支持C风格的条件语句，另外对于数组还支持foreach (VAR in ARRAY) {}形式的遍历。
```bash
# 1. if 条件
probe syscall.*{
    if (pid() == target())
        printf("if condition")
}

# 2. 判断键是否在数组中
if (index_expression in array_name) 

# 3. foreach 循环
global reads
probe vfs.read
{
  reads[execname()] ++
}

probe timer.s(3)
{
  foreach (count in reads)
    printf("%s : %d \n", count, reads[count])
}

# 4. foreach 遍历控制
# 可以给数组名加个后缀+来表示按升序遍历，或-按降序遍历。
# 可以用limit加一个数字来限制迭代的次数
probe timer.s(3)
{
  foreach (count in reads- limit 10)
    printf("%s : %d \n", count, reads[count])
}
```

### 2.7 聚合变量
聚合变量用于实现对数据的流式处理，其可以是全局变量，也可以是数组中的值。使用<<<运算符可以往聚集变量中添加新数据。

```bash
global reads
probe vfs.read
{
  reads[execname()] <<< $count
}
```

在上面示例中:
1. $count的值是一段时间内当前进程的读次数
2. <<<会把$count的值存储到reads数组execname()关联的聚集变量中
3. <<< 是把值存储在聚集变量里面；它们既没有加到原来的值上，也没有覆盖掉原来的值,就像是reads数组值每个键都有多个关联的值

要想从聚集变量中获取汇总的结果，使用这样的语法`@extractor(variable/array_index _expression)`, eg： `@sum(reads[execname()])`。extractor可以取以下的函数：
1. @count
2. @sum
3. @min
4. @max
5. @avg

```bash
global reads
probe vfs.read
{
  reads[execname(),pid()] <<< 1
}

probe timer.s(3)
{
  foreach([var1,var2] in reads)
    printf("%s (%d) : %d \n", var1, var2, @count(reads[var1,var2]))
}
```

### 2.8 命令行参数
通过$或@加个数字的形式可以访问对应位置的命令行参数
1. $会把用户输入当作整数，eg: $1,$2
2. @会把用户输入当作字符串, eg: @1,@2

### 2.9 @表示的操作符
在Systemtap 中 @cast,@entry，表示的是一个操作符，操作符就是我们程序中的 "<>=&" 等等操作:
1. @cast 表示的是一个类型转换的操作符
2. @entry 在.return探针中，有一个特殊的操作符@entry，用于存储该探针的入口处的表达式的值
3. @hist_log,@count 等等，都是用来操作聚合变量的操作符

下面是 @entry 的一个使用示例
```bash
> stap2: 在.return探针中，有一个特殊的操作符@entry，用于存储该探针的入口处的表达式的值
> stap -ve 'global s; probe syscall.read.return {if (execname() == "mysqld")
           {s  <<< gettimeofday_ns() - @entry(gettimeofday_ns());}}
           probe end{print(@hist_log(s))}'
```