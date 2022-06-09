---
weight: 4
title: "go 面向接口编程"
date: 2021-03-01T22:00:00+08:00
lastmod: 2021-03-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Go 面向接口编程"
featuredImage: 

tags: ["go 惯例"]
categories: ["Go"]

lightgallery: true
---

这个系列是 Go 语言设计模式的系列，掌握如何使用编程语言实现 23 种常见设计模式是精通一门语言的"捷径"。这个系列我们就来学习 Go 设计模式的最佳实践。

<!-- more -->

## 1. 学习资料
到目前为止为了学习设计模式，我已经看过不少的书和视频，其中我觉得很好的有下面这些:
1. [王铮老师在极客时间的专栏-设计模式之美](https://time.geekbang.org/column/intro/250): 以 Java 为基础，非常详细的讲解了设计模式和编程设计思想的方方面面
2. [JavaScript设计模式与开发实践](https://book.douban.com/subject/26382780/): JavaScript 如何实现常见的设计模式
3. [耗子哥博客系列](https://coolshell.cn/articles/21128.html)
4. [深入设计模式](https://refactoringguru.cn/design-patterns)

目前还没找到一本专门讲解 Go 设计模式的书，网上包括 github 虽然有不少人已经将 23 中设计模式使用 Go 总结实现了一遍，但基本上都是照"葫芦画瓢"，看不出实现方式与其他语言有什么不同。

这个系列的目的就是为了收集 Go 语言设计模式中的最佳实践，写出更优雅的 Go 代码。这一节我们先来介绍 Go 语言中最常用的面向接口编程。

## 2. 面向接口编程
Go 语言不支持传统的面向对象编程，结构体嵌入看似是面向对象，其实只是 Go 实现的语法糖。而接口才是 Go 语言中实现多态和泛型的主要方式。这就带来了 Go 语言与其他面向对象语言在实现 23 种设计模式上的差异。那 Go 语言中面向接口编程体现在哪呢？

### 2.1 何为接口编程
我们来看段代码，其中是两个方法，它们都是要输出一个结构体，其中一个使用一个函数，另一个使用一个“成员函数”。

```go
func PrintPerson(p *Person) {
    fmt.Printf("Name=%s, Sexual=%s, Age=%d\n",
  p.Name, p.Sexual, p.Age)
}
func (p *Person) Print() {
    fmt.Printf("Name=%s, Sexual=%s, Age=%d\n",
  p.Name, p.Sexual, p.Age)
}
func main() {
    var p = Person{
        Name: "Hao Chen",
        Sexual: "Male",
        Age: 44,
    }
    PrintPerson(&p)
    p.Print()
}
```

这两种方式，你更喜欢哪一种？在 Go 语言中，使用 **“成员函数”的方式叫“Receiver”，这种方式是一种封装** ，因为 PrintPerson()本来就是和 Person强耦合的，所以，理应放在一起。更重要的是，这种方式可以进行接口编程，**对于接口编程来说，也就是一种抽象，主要是用在“多态”**。

那面向接口的编程应该怎么写呢？我们来看一下这段代码: 

```go
type Country struct {
    Name string
}
type City struct {
    Name string
}
type Printable interface {
    PrintStr()
}
func (c Country) PrintStr() {
    fmt.Println(c.Name)
}
func (c City) PrintStr() {
    fmt.Println(c.Name)
}
c1 := Country {"China"}
c2 := City {"Beijing"}
c1.PrintStr()
c2.PrintStr()
```

我们使用了一个 Printable 的接口，而 Country 和 City 都实现了接口方法 PrintStr() 而把自己输出。然而，这些代码都是一样的。能不能省掉呢？我们可以使用“结构体嵌入”的方式来完成这个事。(**我的理解，这里代表的思想与面向对象类似，将公共代码提升到父类中，以达到代码复用的目的。**)

```go
type WithName struct {
    Name string
}

type Country struct {
    WithName
}

type City struct {
    WithName
}

type Printable interface {
    PrintStr()
}

func (w WithName) PrintStr() {
    fmt.Println(w.Name)
}

c1 := Country {WithName{ "China"}}
c2 := City { WithName{"Beijing"}}
c1.PrintStr()
c2.PrintStr()
```

引入一个叫 WithName的结构体，然而，所带来的问题就是，**在初始化的时候，变得有点乱**。那么，我们有没有更好的方法？下面是另外一个解。

```go
type Country struct {
    Name string
}

type City struct {
    Name string
}

type Stringable interface {
    ToString() string
}
func (c Country) ToString() string {
    return "Country = " + c.Name
}
func (c City) ToString() string{
    return "City = " + c.Name
}

func PrintStr(p Stringable) {
    fmt.Println(p.ToString())
}

d1 := Country {"USA"}
d2 := City{"Los Angeles"}
PrintStr(d1)
PrintStr(d2)
```


上面这段代码，我们可以看到:
1. 我们使用了一个叫Stringable 的接口，我们用这个接口把“业务类型” Country 和 City 和“控制逻辑” Print() 给解耦了。
2. 于是，只要实现了Stringable 接口，都可以传给 PrintStr() 来使用。

这就是面向对象编程方法的黄金法则：面向接口编程而不是实现。这里我的理解是: **所有的控制逻辑都面向接口编程，这样对象仅需实现接口**。

### 1.2 接口完整性检查
Go 语言中的接口检查是一种运行时检查，只有我们在作多态赋值时，才会进行接口完整性检查。否则 Go语言的编译器不会严格检查一个对象是否实现了某接口所有的接口方法，比如下面这个示例:

```go
type Shape interface {
    Sides() int
    Area() int
}
type Square struct {
    len int
}
func (s* Square) Sides() int {
    return 4
}
func main() {
    s := Square{len: 5}
    fmt.Printf("%d\n",s.Sides())
}
```

这里的 Shape 接口和 Square 结构没有任何关系，Go 编译器不会去检查 Square 是否实现了 Shape 接口的所有方法。如果我们需要强制实现接口的所有方法，那么我们应该怎么办呢？

在Go语言编程圈里有一个比较标准的作法：

```go
var _ Shape = (* Square)(nil)
```
声明一个 _ 变量（没人用），其会把一个 nil 的空指针，从 Square 转成 Shape，这样，如果没有实现完相关的接口方法，编译器就会报错，这样就做到了个强验证的方法。