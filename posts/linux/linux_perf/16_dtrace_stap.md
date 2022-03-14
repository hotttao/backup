---
weight: 1
title: 3.6 Systemtap 与 Dtrace 的语法比较
date: '2020-01-13T22:10:00+08:00'
lastmod: '2020-01-13T22:10:00+08:00'
draft: false
author: 宋涛
authorLink: https://hotttao.github.io/
description: 3.6 Systemtap 与 Dtrace 的语法比较
featuredImage: null
tags:
- Linux 性能调优
categories:
- Linux
lightgallery: true
---

《性能之巅》内对 Dtrace 和 Systemtap 的语法做了一个对比，对于学习二者是一个不错的资源，现整理如下。
<!-- more -->

## 1. DTrace To Systemtap
下面是一份 DTrace 转换成 Systemtap 的简易指南，包括如下几个部分
1. 语法
2. 探针
3. 内置变量
4. 函数
5. 转换示例

## 2. 语法
|DTrace|Systemtap|描述|
|:---|:---|:---|
|探针名|probe 探针名||
|探针名 {var[a] = }|global var;<br> probe 探针名 {var[a]=}|systemtap 的全局变量必须事先声明|
|/predicate/| {if (test) {}}||
|@a = count(x)<br>printa(@a)|a <<< x<br>print(count(a))|聚合变量使用|
|arg0 .... agrN<br>args[0] ... args[N]|目标变量 $var<br>全局变量 @var("file_stat@fs/file_table.c")|如何获取探针中的变量|

## 3. 探针
|DTrace|Systemtap|描述|
|:---|:---|:---|
|BEGIN<br>dtrace:::BEGIN|begin<br>probe begin||
|END<br>dtrace:::END|end<br>probe end||
|syscall:::entry|syscall.*||
|syscall:::return|syscall.*.return||
|syscall::read:entry|syscall.read||
|syscall::read:return|syscall.read.return||
|sched:::on-cpu|scheduler.cup_on||
|sched:::off-cpu|scheduler.cpu_off||
|profile:::profile-100|timer.profile||
|profile:::tick-10s|timer.s(10)||
|fbt::foo:entry|kernel.function("foo")||
|fbt::foo:return|kernel.function("foo").return||
|io:::start|ioblock.request||
|io:::done|ioblock.end||

## 4. 内置变量


|DTrace|Systemtap|描述|
|:---|:---|:---|
|execname|execname()|执行在CPU上的进程名|
|uid|uid()|执行在CPU上的用户ID|
|pid|pid()|执行在CPU上的进程PID
|cpu|cpu()|进程当前所在的 CPU|
|timestamp|gettimeofday_s()|自启动以来的纳秒数|
|vtimestamp||CPU上的线程时间，单位是纳秒|
|arg0..N|目标变量|探针参数(uint64_t)|
|args[0]...[N]|目标变量|探针参数(类型化的)|
|curthread|task_current()|指向当前线程内核结构的指针|
|probefunc|probefunc()|打印探针所在位置的内核函数名称|
|probename||当前探针名称|
|curpsinfo||当前进程信息|
|curpsinfo->pr_psargs|cmdline_str()|进程启动的命令|
|$target|target()|返回stap,dtrace 通过命令行设置的进程 pid|

## 5. 函数
|Dtrace|Systemtap|描述|
|:---|:---|:---|
|stringof(addr)|kernel_string()|返回来自内核空间的字符串|
|copyinstr(addr)|user_tring()|返回用户空间地址的字符串<br>内核会执行一次从用户空间到内核空间的复制|
|stack(count)|print_backtrace()|打印内核级别栈追踪|
|ustack(count)|print_ubacktrace()|打印用户级别栈追踪|
|exit(status)|exit()|退出DTrace并返回状态|
|quantize(value)|@hist_log()|用 2 的幂次方直方图统计 value|
|lquantize(value,min,max,step)|@hist_linear()|用给定最下值，最大值和步进值做线性直方图记录 value|

## 6. 转换示例
#### 列出系统调用入口探针
```bash
> dtrace  -ln syscall:::entry

> stap -l 'syscall.*'
syscall.accept
syscall.accept4
syscall.access
.....
```

#### 统计 read() 返回大小
```bash
# dtrae1: arg1 作为系统调用 read() 的返回
> dtrace -n 'syscall::read:return { @bytes = quantize(arg1); }'

# stap1: 查看 stap 目标变量，$return 是read() 的返回
>  stap -L 'syscall.read.return'
syscall.read.return name:string retval:long retstr:string 
$return:long int $fd:long int $buf:long int $count:long int $ret:long int

# stap2: 
> stap -e 'global bytes;probe syscall.read.return { bytes <<< $return } 
    probe end { print(@hist_log(bytes)); }'
```

#### 根据进程名统计系统调用
```bash
# dtrace1:
> dtrace -n 'syscall:::entry { @x[execname] = count(); }'

# stap1: 不便阅读
> stap -e 'global x; probe syscall.* { x[execname()] <<< 1 } '

# stap2: 格式化输出
> stap -ve 'global x; probe syscall.* { x[execname()] <<< 1 }
    probe end { foreach (k in x+) {printf("%-36s %8d\n", k, @count(x[k])); } }'
```

#### 对 PID 为 123 的进程，根据系统调用名统计系统调用次数
```bash
# dtrace1: pid
> dtrace -n 'syscall:::entry /pid == 123/ { @x[probefunc] == count(); }'

# stap1:
> stap -ve 'global x; probe syscall.* { if (pid() == 123) { x[probefunc()] <<< 1 }; } 
    probe end { foreach (k in x+) {printf("%-36s %8d\n", k, @count(x[k])); } }'
```

#### 对 httpd 进程，根据系统调用名统计系统调用次数
```bash
# dtrace1: execname
> dtrace -n 'syscall:::entry /execname == "httpd"/ { @x[probefunc] == count(); }'

# stap1:
> stap -ve 'global x; probe syscall.* { if (execname() == "httpd") { x[probefunc()] <<< 1 }; }
    probe end { foreach (k in x+) {printf("%-36s %8d\n", k, @count(x[k])); } }'
```

#### 用进程名和路径名跟踪文件的open()
```bash
# dtrace
> dtrace -l 'syscall::open.entry { printf("%s, %s", execname, copyinstr(arg0)); }'

# stap
> stap -ve 'probe syscall.open { filename = user_string_quoted($filename);
        printf("%s %s\n", execname(), filename); }'
```

#### 对 mysqld 进程统计 read() 延时
```bash
# dtrace1:
> dtrace -n 'syscall::read:entry /execname == "mysqld"/ {self->ts = timestamp;} 
             syscall::read:return /self->ts/ { @["ns"] =  quantize(timestamp - self->ts);self->ts=0}'
> stap1: 
gobal t,s; 
probe syscall.read {
    if (execname() == "mysqld"){
        t[tid()] = gettimeofday_ns();
    }
} 

probe syscall.read.return {
    if (t[tid()]){
        s <<< gettimeofday_ns() - t[tid()];
        delete t[tid()];
    }
}

probe end {
    printf("ns\n");
    print(@hist_log(s))
}

> stap2: 在.return探针中，有一个特殊的操作符@entry，用于存储该探针的入口处的表达式的值
> stap -ve 'global s; probe syscall.read.return {if (execname() == "mysqld")
           {s  <<< gettimeofday_ns() - @entry(gettimeofday_ns());}}
           probe end{print(@hist_log(s))}'
```


#### 根据进程名和参数跟踪新进程
```bash
# dtrace: 
> dtrace -n 'proc::exec-success { trace(curpsinfo->pr_psargs) }'

# stap
> stap -ve 'probe process.begin { printf("%s\n", cmdline_str()) }'
```

#### 以100Hz对内核栈采样
```bash
# dtrace
> dtrace -n 'profile-100 { @[stack()]=count() }'

# stap
> stap -e 'global s; probe timer.profile { s[backtrace()] <<< 1 }
                     probe end {foreach (i in s+){ print_stack(i);
                                                   printf("\t%d\n", @count(s[i]));}}'
```
