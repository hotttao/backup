---
title: 14 Channel 应用
date: 2019-02-12
categories:
    - Go
tags:
    - go并发编程
---
应用
<!-- more -->

## 1. 使用反射操作 Channel
在学习如何使用 Channel 之前，我们来看看如何通过反射的方式执行 select 语句，这在处理很多的 case clause，尤其是不定长的 case clause 的时候，非常有用。

为了便于操作 Select，reflect 提供了如下几个函数:
1. `Select(case []SelectCase)(chosen int, recv Value, recvOK bool)`:
    - 参数: SelectCase 表示 Select 语句的一个分支
    - 返回值:
        - chosen:  select 是伪随机的，它在执行的 case 中随机选择一个 case，并把选择的这个 case 的索引（chosen）返回
        - recvValue: 如果 select 选中的 recv case，recvValue 表示接收的元素
        - recvOK: 表示是否有 case 成功被选择，false 表示没有可用的 case 返回
2. `SelectCase`: struct 表示一个 select case 分支

```go
type SelectCase struct {
    Dir  SelectDir // case的方向
    Chan Value     // 使用的通道（收/发）
    Send Value     // 用于发送的值
}
```