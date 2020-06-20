---
title: 3.5 Systemtap Python
date: 2020-01-12
categories:
    - 运维
tags:
    - Linux性能调优
---


<!-- more -->

## 1. 环境配置
从 Python 3.6 开始，CPython 可以使用嵌入式“标记”，也称为“探测器”，使得可以通过 DTrace 或 SystemTap 来追踪 Cpython。

在 Linux 上，为了Systemtap 能够动态追踪 Cpython 的执行，必须按照如下步骤配置系统环境:
1. 必须安装 SystemTap 开发工具
2. CPython 必须启用 --with-dtrace 编译选项

### 1.1 安装 SystemTap 开发工具
```bash
yum install systemtap-sdt-devel
```

### 1.2 Cpython 启用 --with-dtrace
默认情况下，通过 yum 安装的 Python 都已启用 --with-dtrace 编译选项。可使用如下方式进行确认

```bash
> import sysconfig
> sysconfig.get_config_vars()
> sysconfig.get_config_var('WITH_DTRACE')
```

## 1.3 验证 Cpython 支持 Systemtap 
在 Linux 上，可以通过查看程序是否包含“.note.stapsdt”部分来验证构建的二进制文件中是否存在 SystemTap 静态标记。

如果 Cpython 未启用 --enable-shared 选项，可使用如下两种方式进行确认:
```bash
> readelf -S ./python | grep .note.stapsdt
[30] .note.stapsdt        NOTE         0000000000000000 00308d78

> readelf -n ./python
# 显示的元数据或包含 SystemTap 的信息 stapsdt
```

通常情况下 yum 安装的 python 都会启用 --enable-shared 编译选项，因此需要通过下面的方式进行验证:
```bash
> readelf -S /usr/lib64/libpython3.6m.so.1.0 |grep -i .note.stapsdt
[28] .note.stapsdt     NOTE             0000000000000000  002f5bcc
```

## 2. 使用 Systemtap 追踪 Python 
### 2.1 直接使用 Python 的静态标记
使用 Systemtap 动态追踪 Python 的第一种方式是直接使用 Python 的静态标记。

```bash
# Python 未启用 --enable-shared 时
probe process("python").mark("function__entry") {
     filename = user_string($arg1);
     funcname = user_string($arg2);
     lineno = $arg3;

     printf("%s => %s in %s:%d\\n",
            thread_indent(1), funcname, filename, lineno);
}

# Python 启用 --enable-shared 时，静态标记包含在 libpython shared library 中
probe process("python").library("libpython3.6m.so.1.0").mark("function__entry") {
     filename = user_string($arg1);
     funcname = user_string($arg2);
     lineno = $arg3;

     printf("%s => %s in %s:%d\\n",
            thread_indent(1), funcname, filename, lineno);
}
```
Python 为 Systemtap 提供了以下静态标记:

`function__entry(str filename，str funcname，int lineno)`
- 作用: 表示开始 Python 函数调用
- 说明: 这个静态标记，等同于内核函数，可以通过目标变量访问静态标记内的变量
- 参数: filename，funcname，lineno，必须使用$arg1，$arg2，$arg3访问
    -  $arg1：(const char *) filename，使用user_string($arg1)获取 filename 的值
    -  $arg2：(const char *) function name，使用user_string($arg2)获取funcname的值
    -  $arg3：int 行号

`function__return(str filename，str funcname，int lineno)`
- 作用: 表示Python 函数调用结束，即return 或 exception
- 参数: 同 function__entry

`line(str filename，str funcname，int lineno)`
- 作用: 此标记表示即将执行 Python 脚本一行，相当于使用 Python 探查器进行 line-by-line 跟踪
- 参数: 同 function__entry

`gc__start(int generation)`
- 作用: Python interpreter 启动垃圾回收周期时触发

`gc__done(long collected)`
- 作用: Python interpreter 完成垃圾回收周期时触发
- 参数:
    - $arg0: int 回收的对象数量。

`import__find__load__start(str modulename)`
- 作用: 在importlib尝试查找并加载模块之前触发
- 参数:
    - $arg0: (const char *) modulename，使用user_string($arg0)获取modulename的值

`import__find__load__done(str modulename，int found)`
- 作用: 调用importlib的 find_and_load function 后触发。 
- 参数:
    - $arg0: (const char *) modulename，使用user_string($arg0)获取modulename的值
    - $arg1: int 表示模块是否已成功加载

#### 追踪示例
追踪Python调用的脚本
```stap
# stap 脚本
probe process("python3.6").library("/usr/lib64/libpython3.6m.so.1.0").mark("function__entry") {
     filename = user_string($arg1);
     funcname = user_string($arg2);
     lineno = $arg3;

     printf("%s => %s in %s:%d\n",
            thread_indent(1), funcname, filename, lineno);
}

probe process("python3.6").library("/usr/lib64/libpython3.6m.so.1.0").mark("function__return") {
    filename = user_string($arg1);
    funcname = user_string($arg2);
    lineno = $arg3;

    printf("%s <= %s in %s:%d\n",
           thread_indent(-1), funcname, filename, lineno);
}
```

试验的 Python 脚本
```python
# test.py
def two():
    c = 1 + 2
    return c

def one():
    d = two()
    return d


one()
```

执行 Python 动态追踪
```bash
# stap 监测
> stap stap_test.stp -c "python3.6 test.py"
......
0 python3.6(29732): => __init__ in <frozen importlib._bootstrap_external>:800
 4 python3.6(29732): <= __init__ in <frozen importlib._bootstrap_external>:804
 0 python3.6(29732): => <module> in test.py:2
 5 python3.6(29732):  => one in test.py:6
 8 python3.6(29732):   => two in test.py:2
10 python3.6(29732):   <= two in test.py:4
13 python3.6(29732):  <= one in test.py:8
16 python3.6(29732): <= <module> in test.py:11
```

### 2.2 使用 Systemtap 提供的 typeset
typeset 提供的函数库，可以帮助我们隐藏一些Python 静态标记的细节。从目前提供的 typeset 来看，提供的库还是很低级。

```bash
ll /usr/share/systemtap/tapset/|grep python
-rw-r--r--.  1 root root    522 8月   7 2019 libpython2.7-64.stp
-rw-r--r--.  1 root root  31021 10月 19 00:12 python2.stp
-rw-r--r--.  1 root root  30405 10月 19 00:12 python3.stp
```
