---
title: 8. Go Visitor 模式
date: 2021-01-08
categories:
    - Go
tags:
    - Go设计模式
---

K8S Visitor 模式，这篇文章摘录自[耗子哥博客-Go编程模式](https://coolshell.cn/articles/21263.html)

<!-- more -->

## 1. K8S Visitor 模式
本篇文章主要想讨论一下，Kubernetes 的 kubectl 命令中的使用到到的一个编程模式 – Visitor 。本来，Visitor 是面向对象设计模式中一个很重要的设计模式，这个模式是一种**将算法与操作对象的结构分离的一种方法**。这种分离的实际结果是能够在不修改结构的情况下向现有对象结构添加新操作，是遵循开放/封闭原则的一种方法。这篇文章我们重点看一下 kubelet 中是怎么使用函数式的方法来实现这个模式的。

### 1.1 简单示例

```go
package main

import (
    "encoding/json"
    "encoding/xml"
    "fmt"
)

type Visitor func(shape Shape)

type Shape interface {
    accept(Visitor)
}

type Circle struct {
    Radius int
}

func (c Circle) accept(v Visitor) {
    v(c)
}

type Rectangle struct {
    Width, Heigh int
}

func (r Rectangle) accept(v Visitor) {
    v(r)
}
```

在上面的示例中:
1. 有一个 Visitor 的函数定义，还有一个Shape接口
2. Shape 需要使用 Visitor函数做为参数，Visitor 则接受 Shape
3. 整个调用过程是 Shape 通过 accept 方法接收 Visitor，并调用 Visitor(Shape)

然后，我们实现两个Visitor，一个是用来做JSON序列化的，另一个是用来做XML序列化的:

```go
func JsonVisitor(shape Shape) {
    bytes, err := json.Marshal(shape)
    if err != nil {
        panic(err)
    }
    fmt.Println(string(bytes))
}

func XmlVisitor(shape Shape) {
    bytes, err := xml.Marshal(shape)
    if err != nil {
        panic(err)
    }
    fmt.Println(string(bytes))
}
```

下面是我们的使用Visitor这个模式的代码：

```go
func main() {
  c := Circle{10}
  r :=  Rectangle{100, 200}
  shapes := []Shape{c, r}

  for _, s := range shapes {
    s.accept(JsonVisitor)
    s.accept(XmlVisitor)
  }
}
```

其实，这段代码的目的就是想解耦 数据结构和 算法，使用 Strategy 模式也是可以完成的，而且会比较干净。但是在有些情况下，**多个Visitor是来访问一个数据结构的不同部分，这种情况下，数据结构有点像一个数据库，而各个Visitor会成为一个个小应用**。 kubectl就是这种情况。

## 2. K8S  Visitor

### 2.1 k8s 背景知识

接下来，我们再来了解一下相关的知识背景：

1. 对于Kubernetes，其抽象了很多种的Resource，比如：Pod, ReplicaSet, ConfigMap, Volumes, Namespace, Roles …. 种类非常繁多，这些东西构成为了Kubernetes的数据模型（点击 [Kubernetes Resources](https://github.com/kubernauts/practical-kubernetes-problems/blob/master/images/k8s-resources-map.png) 地图 查看其有多复杂）
2. kubectl 是Kubernetes中的一个客户端命令，操作人员用这个命令来操作Kubernetes。kubectl 会联系到 Kubernetes 的API Server，API Server会联系每个节点上的 kubelet ，从而达到控制每个结点。
3. kubectl 主要的工作是处理用户提交的东西（包括，命令行参数，yaml文件等），然后其会把用户提交的这些东西组织成一个数据结构体，然后把其发送给 API Server。
4. 相关的源代码在 [src/k8s.io/cli-runtime/pkg/resource/visitor.go](https://github.com/kubernetes/kubernetes/blob/cea1d4e20b4a7886d8ff65f34c6d4f95efcb4742/staging/src/k8s.io/cli-runtime/pkg/resource/visitor.go) 中

下面我们来看看 kubectl 的实现(示例实现，而不是直接分析复杂的源码）。

### 2.2 Visitor 模式定义
首先，kubectl 主要是用来处理 Info结构体，下面是相关的定义：

```go
type VisitorFunc func(*Info, error) error

type Visitor interface {
    Visit(VisitorFunc) error
}

type Info struct {
    Namespace   string
    Name        string
    OtherThings string
}
func (info *Info) Visit(fn VisitorFunc) error {
  return fn(info, nil)
}
```

我们可以看到:
1. 有一个 VisitorFunc 的函数类型的定义
2. 一个 Visitor 的接口，其中需要 Visit(VisitorFunc) error  的方法（这就像是我们上面那个例子的 Shape ）
3. 最后，为Info 实现 Visitor 接口中的 Visit() 方法，实现就是直接调用传进来的方法（与前面的例子相仿）

我们再来定义几种不同类型的 Visitor。

### 2.3 Name Visitor
这个Visitor 主要是用来访问 Info 结构中的 Name 和 NameSpace 成员:

```go
type NameVisitor struct {
  visitor Visitor
}

func (v NameVisitor) Visit(fn VisitorFunc) error {
  return v.visitor.Visit(func(info *Info, err error) error {
    fmt.Println("NameVisitor() before call function")
    err = fn(info, err)
    if err == nil {
      fmt.Printf("==> Name=%s, NameSpace=%s\n", info.Name, info.Namespace)
    }
    fmt.Println("NameVisitor() after call function")
    return err
  })
}
```
**重点在这**，上面的代码：
1. 声明了一个 NameVisitor 的结构体，这个结构体里有一个 Visitor 接口成员，这里意味着多态
2. 在**实现 Visit() 方法时，其调用了自己结构体内的那个 Visitor的 Visitor() 方法***，这其实是一种**修饰器的模式**，用另一个Visitor修饰了自己
3. 个人觉得跟组合模式也很像

### 2.4 Other Visitor 和 Log Visitor

Other Visitor主要用来访问 Info 结构中的 OtherThings 成员， Log Visitor 是做日志记录的。

```go
type OtherThingsVisitor struct {
  visitor Visitor
}

func (v OtherThingsVisitor) Visit(fn VisitorFunc) error {
  return v.visitor.Visit(func(info *Info, err error) error {
    fmt.Println("OtherThingsVisitor() before call function")
    err = fn(info, err)
    if err == nil {
      fmt.Printf("==> OtherThings=%s\n", info.OtherThings)
    }
    fmt.Println("OtherThingsVisitor() after call function")
    return err
  })
}

type LogVisitor struct {
  visitor Visitor
}

func (v LogVisitor) Visit(fn VisitorFunc) error {
  return v.visitor.Visit(func(info *Info, err error) error {
    fmt.Println("LogVisitor() before call function")
    err = fn(info, err)
    fmt.Println("LogVisitor() after call function")
    return err
  })
}
```

### 2.5 使用方代码

现在我们看看如果使用上面的代码：

```go
func main() {
  info := Info{}
  var v Visitor = &info
  v = LogVisitor{v}
  v = NameVisitor{v}
  v = OtherThingsVisitor{v}

  loadFile := func(info *Info, err error) error {
    info.Name = "Hao Chen"
    info.Namespace = "MegaEase"
    info.OtherThings = "We are running as remote team."
    return nil
  }
  v.Visit(loadFile)
}
```


我们可以看到

1. Visitor们一层套一层
2. 我用 loadFile 假装从文件中读如数据
3. 最后一条 v.Visit(loadfile) 我们上面的代码就全部开始激活工作了。

上面的代码输出如下的信息，你可以看到代码的执行顺序是怎么执行起来了:

```txt
LogVisitor() before call function
NameVisitor() before call function
OtherThingsVisitor() before call function
==> OtherThings=We are running as remote team.
OtherThingsVisitor() after call function
==> Name=Hao Chen, NameSpace=MegaEase
NameVisitor() after call function
LogVisitor() after call function
```

我们可以看到，上面的代码有以下几种功效：

1. 解耦了数据和程序。
2. 使用了装饰器模式
3. 还做出来pipeline的模式

所以，其实，我们是可以把上面的代码重构一下的。

### 2.6 Visitor装饰器

下面，我们用修饰器模式来重构一下上面的代码。

```go
type DecoratedVisitor struct {
  visitor    Visitor
  decorators []VisitorFunc
}

func NewDecoratedVisitor(v Visitor, fn ...VisitorFunc) Visitor {
  if len(fn) == 0 {
    return v
  }
  return DecoratedVisitor{v, fn}
}

// Visit implements Visitor
func (v DecoratedVisitor) Visit(fn VisitorFunc) error {
  return v.visitor.Visit(func(info *Info, err error) error {
    if err != nil {
      return err
    }
    if err := fn(info, nil); err != nil {
      return err
    }
    for i := range v.decorators {
      if err := v.decorators[i](info, nil); err != nil {
        return err
      }
    }
    return nil
  })
}
```

上面的代码并不复杂，
1. 用一个 DecoratedVisitor 的结构来存放所有的VistorFunc函数
2. NewDecoratedVisitor 可以把所有的 VisitorFunc转给它，构造 DecoratedVisitor 对象。
3. DecoratedVisitor实现了 Visit() 方法，里面就是来做一个for-loop，顺着调用所有的 VisitorFunc
4. 这个DecoratedVisitor 同样可以成为一个Visitor来使用

最终，我们的代码就可以这样运作了：

```go
info := Info{}
var v Visitor = &info
v = NewDecoratedVisitor(v, NameVisitor, OtherVisitor)

v.Visit(LoadFile)
```
