---
title: 3.4 Systemtap 用户空间探测
date: 2020-01-11
categories:
    - 运维
tags:
    - Linux性能调优
---


<!-- more -->


# 1. 用户空间探测
SystemTap从0.6版本开始也支持探测用户空间的进程。SystemTap可以探测用户空间进程内函数的调用和退出，可以探测用户代码中预定义的标记，可以探测用户进程的事件。

SystemTap进行用户空间探测需要uprobes模块。如果Linux内核版本大于等于3.5, 它已经内置了uprobes。

不过，SystemTap的用户空间事件跟踪功能依然需要你的内核支持[utrace](http://sourceware.org/systemtap/wiki/utrace)拓展。要想验证当前内核是否提供了必要的utrace支持，在终端中输入下面的命令：

```bash
> grep CONFIG_UTRACE /boot/config-`uname -r`
CONFIG_UTRACE=y  # 输出此，表示支持
```

## 2. 用户空间事件
所有的用户空间事件都以process开头:
1. 可以通过进程ID指定要检测的进程
2. 也可以通过可执行文件名的路径名指定

SystemTap会查看系统的PATH环境变量，所以既可以使用绝对路径，也可以使用在命令行中运行可执行文件时所用的名字。以下将两者统称为PATH。

下面列出的事件都需要进程ID或可执行文件的路径。不在其中的process事件不需要PID和可执行文件路径名。
1. `process("PATH").function("function")`
    - 进入可执行文件PATH的用户空间函数function
    - 相当于内核空间中的kernel.function("function")
    - 允许使用通配符和.return后缀
2. `process("PATH").statement("statement")`
    - 代码中第一次执行statement的地方
    - 相当于内核空间中的kernel.statement("statement")
3. `process("PATH").mark("marker")`
    - 在PATH中定义的静态探测点
    - 可以使用通配符
    - 有些用户空间下的可执行程序提供了这些静态探测点，比如Java
4. `process("PATH").begin`
    - 创建了一个用户空间下的进程
    - 可以限定某个进程ID或可执行文件的路径
    - 如果不限定，任意进程的创建都会触发该事件
5. `process("PATH").thread.begin`
    - 创建了一个用户空间下的线程
    - 可以限定某个进程ID或可执行文件的路径，也可以不限定
6. `process("PATH").end`
    - 销毁了一个用户空间下的进程
    - 可以限定某个进程ID或可执行文件的路径，也可以不限定
7. `process("PATH").thread.end`
    - 销毁了一个用户空间下的线程。你可以限定某个进程ID或可执行文件的路径。
8. `process("PATH").syscall`
    - 一个用户空间进程调用了系统调用
    - 可以通过上下文变量$syscall获取系统调用号
    - 还可以通过$arg1到$arg6分别获取前六个参数
    - 添加.return后缀后会捕获退出系统调用的事件
    - 在syscall.return中，可以通过上下文变量$return获取返回值
    - 可以用某个进程ID或可执行文件的路径进行限定

```bash
# java Hotspot 虚拟机，静态探测点 
probe hotspot.gc_begin =
  process("/usr/lib/jvm/java-1.6.0-openjdk-1.6.0.0.x86_64/jre/lib/amd64/server/libjvm.so").mark("gc__begin")
```

## 3.目标变量
访问用户空间目标变量，所用的语法与访问内核空间目标变量的语法相同。同样的对于指向基本类型（如整数和字符串）的指针，可以使用下列的函数访问用户空间的数据。这些函数都是在process(PATH).xxx事件的处理程序中使用的

|函数|作用|
|:---|:---|
|user_char(address)|从用户空间地址中获取char变量|
|user_short(address)||
|user_long(address)||
|user_int(address)||
|user_string(address)||
|user_string_n(address, n)|从用户空间地址中获取长为n的字符串|

## 4. 用户空间栈回溯
pp（probe point）函数可以返回触发当前处理程序的事件名（包含展开了的通配符和别名）。如果该事件与特定的函数相关，pp的输出会包括触发了该事件的函数名。

许多情况下触发同一个事件的函数可能来自于程序中不同的模块；特别是在该函数位于某个共享库的情况下。还好SystemTap提供了用户空间栈的回溯（backtrace）功能，便于查看事件是怎么被触发的。

编译器优化代码时会消除栈帧指针（stack frame pointers），这将混淆用户空间栈回溯的结果。所以要想查看栈回溯，需要有编译器生成的调试信息。

SystemTap用户空间栈回溯机制可以利用这些调试信息来重建栈回溯的现场。要想使用这些调试信息来重建栈回溯，给可执行文件加上-d executable选项，并给共享库加上-ldd选项。

```bash
# 需要安装 coreutils的debuginfo
stap -d /bin/ls --ldd \
-e 'probe process("ls").function("xmalloc") {print_usyms(ubacktrace())}' \
-c "ls /"
```

关于在用户空间栈回溯中可用的函数的更多内容，请查看ucontext-symbols.stp和ucontext-unwind.stp两个tapset。上述tapset中的函数的描述信息也可以在SystemTap Tapset Reference Manual找到。
