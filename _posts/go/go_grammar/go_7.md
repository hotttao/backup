---
title: 7 go 接口
date: 2019-01-07
categories:
    - Go
tags:
    - go语言入门
---

Go 的泛型编程
<!-- more -->

![Hello World](/images/go/grammar/go_func.jpg)

## 1. 接口
接口类型是对其它类型行为的抽象和概括。接口类型具体描述了一系列方法的集合，一个实现了这些方法的具体类型是这个接口类型的实例。从这一点来看，接口与Python 中广泛使用的“鸭子类型”很相似，只通过行为来约束对象的适用范围。

接口类型只包含方法声明，与结构体嵌入类似，我们也可以通过类似的方式进行接口嵌入，实现接口组合。

```Go
package io
type Reader interface {
  Read(p []byte) (n int, err error)
}

type Closer interface {
  Close() error
}

type Writer interface {
  Write(p []byte) (n int, err error)
}

type ReadWriter interface {
  Reader
  Writer
}
```
