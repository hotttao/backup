---
weight: 4
title: "Go 装饰器"
date: 2021-03-06T22:00:00+08:00
lastmod: 2021-03-06T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Builder模式与Function Options"
featuredImage: 

tags: ["go 惯例"]
categories: ["Go"]

lightgallery: true
---
Go 的装饰器，这篇文章摘录自[耗子哥博客-Go编程模式](https://coolshell.cn/articles/17929.html)

<!-- more -->

## 1. 装饰器
装饰器是一种函数式编程的玩法——用一个高阶函数来包装一下。所以，Go语言的修饰器编程模式，其实也就是函数式编程的模式。

不过，Go 语言的“糖”不多，而且又是**强类型的静态无虚拟机的语言**，所以，无法做到像 Java 和 Python 那样优雅的装饰代码。

### 1.1 简单示例
我们先来看一个示例:

```go
package main

import "fmt"

func decorator(f func(s string)) func(s string) {

    return func(s string) {
        fmt.Println("Started")
        f(s)
        fmt.Println("Done")
    }
}

func Hello(s string) {
    fmt.Println(s)
}

func main() {
        decorator(Hello)("Hello, World!")
}
```

有些遗憾的是，Go 并不支持像 Python 那样的 @decorator 语法糖。所以代码调用上有些难看。

### 1.2 多个修饰器的 Pipeline
如果一个函数被装饰了多次，需要对函数一层层的调用，看上去不是很好看。我们可以使用一个工具函数，来辅助一一遍历并调用各个 decorator:

```go
type HttpHandlerDecorator func(http.HandlerFunc) http.HandlerFunc

func Handler(h http.HandlerFunc, decors ...HttpHandlerDecorator) http.HandlerFunc {
    for i := range decors {
        d := decors[len(decors)-1-i] // iterate in reverse
        h = d(h)
    }
    return h
}

// pipeline 的功能也就出来了
http.HandleFunc("/v4/hello", Handler(hello,
                WithServerHeader, WithBasicAuth, WithDebugLog))
```

### 1.3 泛型的装饰器
对于 Go 的修饰器模式，还有一个小问题 —— 好像无法做到泛型，其代码耦合了需要被修饰的函数的接口类型，无法做到非常通用。

因为 Go 语言不像 Python 和 Java，Python是动态语言，而 Java 有语言虚拟机，所以他们可以干好些比较变态的事，然而 Go 语言是一个静态的语言，这意味着其类型需要在编译时就要搞定，否则无法编译。不过，Go 语言支持的最大的泛型是 interface{} 还有比较简单的 reflection 机制，在上面做做文章，应该还是可以搞定的。

下面是用 reflection 机制写的一个比较通用的修饰器（为了便于阅读，我删除了出错判断代码）

```go
func Decorator(decoPtr, fn interface{}) (err error) {
    var decoratedFunc, targetFunc reflect.Value

    decoratedFunc = reflect.ValueOf(decoPtr).Elem()
    targetFunc = reflect.ValueOf(fn)

    v := reflect.MakeFunc(targetFunc.Type(),
            func(in []reflect.Value) (out []reflect.Value) {
                fmt.Println("before")
                out = targetFunc.Call(in)
                fmt.Println("after")
                return
            })

    decoratedFunc.Set(v)
    return
}
```
上面的代码动用了 reflect.MakeFunc() 函数制出了一个新的函数其中的 targetFunc.Call(in) 调用了被修饰的函数。上面这个 Decorator() 需要两个参数：
1. 第一个是出参 decoPtr ，就是完成修饰后的函数
2. 第二个是入参 fn ，就是需要修饰的函数


好的，让我们来看一下使用效果。首先假设我们有两个需要修饰的函数：

```go
func foo(a, b, c int) int {
    fmt.Printf("%d, %d, %d \n", a, b, c)
    return a + b + c
}

func bar(a, b string) string {
    fmt.Printf("%s, %s \n", a, b)
    return a + b
}
```

然后我们可以这样使用:

```go
type MyFoo func(int, int, int) int
var myfoo MyFoo
Decorator(&myfoo, foo)
myfoo(1, 2, 3)
```

你会发现，使用 Decorator() 时，还需要先声明一个函数签名，感觉好傻啊。一点都不泛型，不是吗？

嗯。如果你不想声明函数签名，那么你也可以这样：

```go
mybar := bar
Decorator(&mybar, bar)
mybar("hello,", "world!")
```

看上去依然不是那么的漂亮，但是可用。看样子 Go 语言目前本身的特性无法做成像 Java 或 Python 那样，对此，我们只能多求 Go 语言多放糖了！

最后 Go 的泛型编程参见 [laws-of-reflection](https://blog.golang.org/laws-of-reflection)
