---
title: 4.3 CPU 动态追踪
date: 2020-01-18
categories:
    - 运维
tags:
    - Linux性能调优
---
本节我们来介绍 CPU 动态追踪技术，包括 perf，systemtap，dtrace
<!-- more -->

## 1. Systemtap 进行 CPU 分析
Systemtap 可以用来剖析用户级和内核级的 CPU 用量，也能跟踪
1. 函数执行
2. CPU 交叉调用
3. 中断
4. 内核调度器

这些功能支持负载特征分析、剖析、下钻分析和延时分析。

### 1.1 内核剖析
#### Dtrace
```bash
# solaris
# 1. 以 997Hz 频率取样内核栈
dtrace -n 'profile-997 /agr0/ { @[stack()] = count()}'

# 2. 以 997Hz 频率取样内核栈，仅输出最频繁的 10 个
dtrace -n 'profile-997 /agr0/ { @[stack()] = count()} END { trunc(@, 10); }'

# 3. 以 997Hz 频率取样内核栈，每个栈只取 5 个帧
dtrace -n 'profile-997 /agr0/ { @[stack(5)] = count()}'

# 4. 以 997Hz 频率取样在 CPU 上运行的函数
dtrace -n 'profile-997 /arg0/ @[func(arg0)] = count()'

# 5. 以 997Hz 频率取样在 CPU 上运行的模块
dtrace -n 'profile-997 /arg0/ @[mod(arg0)] = count()'
```

#### Systemtap
```bash
# 1.以 997Hz 频率取样内核栈
stap -d kernel -ve 'global s; probe timer.profile { s[backtrace()] <<< 1 }
                     probe end {foreach (i in s+){ print_stack(i);
                                                   printf("\t%d\n", @count(s[i]));}}'
# 2. 以 997Hz 频率取样内核栈，仅输出最频繁的 10 个
stap -d kernel -ve 'global s; probe timer.hz(997) { s[backtrace()] <<< 1 }
                    probe end { foreach (i in s- limit 10)
                                {print_stack(i); printf("\t%d\n", @count([s[i]]));}
                    }'

# 4. 以 997Hz 频率取样在 CPU 上运行的函数 - 未确认
stap -d kernel -ve 'global s; probe timer.profile { s[caller()] <<< 1 }
                     probe end {foreach (i in s+){printf("\t%s - %d\n", i, @count(s[i]));}}'

# 5. 以 997Hz 频率取样在 CPU 上运行的模块 - 未确认
stap -d kernel -ve 'global s; probe timer.profile { s[module_name()] <<< 1 }
                     probe end {foreach (i in s+){printf("\t%s - %d\n", i, @count(s[i]));}}'
```

### 2. 用户剖析
#### Dtrace
```bash
# solaris
# 1. 以 997Hz 频率取样进程的用户栈
dtrace -n 'profile-997 /agr1 && pid == 123/ { @[ustack()] = count()}'
dtrace -n 'profile-997 /agr1 && execname == "sshd"/ { @[ustack()] = count()}'
dtrace -n 'profile-997 /agr1/ { @[execname, ustack()] = count()}' # 取样所有进程的用户栈

# 无 arg1 筛选，此时统计将包括用户栈被冻结的时间(一般是系统调用期间)
dtrace -n 'profile-997 /pid == 123/ { @[ustack()] = count()}'

# 2. 以 997Hz 频率取样用户栈，仅输出最频繁的 10 个
dtrace -n 'profile-997 /agr1 && pid == 123/ { @[ustack()] = count()} END { trunc(@, 10); }'

# 3. 以 997Hz 频率取样用户栈，每个栈只取 5 个帧
dtrace -n 'profile-997 /agr1 && pid == 123/ { @[ustack(5)] = count()}'

# 4. 以 997Hz 频率取样用户栈，仅输出在 CPU 上运行的函数名
dtrace -n 'profile-997 /arg1 && pid == 123/ @[ufunc(arg1)] = count()'

# 5. 以 997Hz 频率取样用户栈，仅输出在 CPU 上运行的模块名
dtrace -n 'profile-997 /arg1 && pid == 123/ @[umod(arg1)] = count()'

# 6.以 997Hz 频率取样用户进程的运行 CPU
dtrace -n 'profile-997 /pid == 123/ {@[cpu] == count()}'
```

#### Systemtap
```bash
# 1. 未确认
stap -ve 'global s; probe timer.hz(97) {if (execname() == "mysqld") {s[ubacktrace()] <<< 1 }}
                probe end { foreach (i in s- limit 10)
                            {print_ustack(i); printf("\t%d\n", @count(s[i]));}
                }'
```

### 3. 函数跟踪
统计函数的 CPU 时间
```bash
# Dtrace
dtrace -n 'fbt::zio_checksum_generate:entry {self->v = vtimestamp;}
           fbt::zio_checksum_generate:return /self->v/ 
             {@["ns"] = quantize(vtimestamp - self->v);self->v=0 }'

# Systemtap
stap -ve 'global s; probe kernel.function("sys_open").return {s <<< gettimeofday_ns() - @entry(gettimeofday_ns());}
                    probe end {print(@hist_log(s))}'
```

### 4. CPU 交叉调用
打印CPU交叉调用以及这些调用的代码路径
```bash
# Dtrace
dtrace -n 'sysinfo:::xcalls { @[stack()] = count(); }'

# Systemtap
stap -d kernel -ve 'global s;probe scheduler.migrate {s[backtrace()] <<< 1}
                    probe end { foreach (i in s- limit 10)
                              {print_stack(i); printf("\t%d\n", @count([s[i]]));}
                    }'
```

### 5. 中断
```bash
# Dtrace 通过 intrstat 命令
intrstat 1

# Systemtap
cd /usr/share/systemtap/tapset/linux/
vim irq.stp
    probe irq_handler.exit = kernel.trace("irq_handler_exit") ?
        {
                irq = $irq
                // the tracepoint doesn't have the struct definition, so we must @cast
                action = & @cast($action, "irqaction", "kernel<linux/interrupt.h>")
                ret = $ret
                handler = action->handler
                flags = action->flags
                flags_str = irqflags_str(flags)
                dev_name = action->name
                dev_id = action->dev_id
                next_irqaction = action->next
                dir = action->dir
                thread_fn = action->thread_fn
                thread = action->thread
                thread_flags = action->thread_flags
        }

stap -ve 'global s; probe irq_handler.exit { s[dev_id] <<< 1}
                    probe end { foreach (i in s+) {printf("%s: %d\n", i, s[i])}}'
```

### 6. 调度器跟踪
#### Dtrace
sched provider 提供了对内核 CPU 调度器的跟踪操作。
```bash
# 跟踪 sshd 在 CPU 上的运行时间
dtrace -n 'sched::on-cpu /execname == "sshd"/ {self->ts = timestamp;}
           sched::off-cpu / self->ts / { @["ns"] = quantize(timestamp - self->ts);
               self->ts = 0;
           }'
```

##### Systemtap
```bash
# 跟踪 sshd 在 CPU 上的运行时间
stap -ve 'global s, t; probe scheduler.cpu_on { if (execname() == "sshd") { t[tid()] = gettimeofday_ns(); }}
                       probe scheduler.cpu_off { if (t[tid()]) {s <<< gettimeofday_ns() - t[tid()];delete t[tid()]}}
                       probe end{print(@hist_log(s))}'
```