---
weight: 1
title: "Go 函数、方法和接口"
date: 2022-12-17T22:00:00+08:00
lastmod: 2022-12-17T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "这个系列我们开始学习 go 语言的第二部分-go语言进阶"
featuredImage: 

tags: ["go 进阶"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

今天我们开始深入学习，Go 语言的函数、方法和接口
<!-- more -->

## 1. 函数
Go 语言里函数是"一等公民"，简单来讲函数可以像变量值那样被赋值给变量、作为参数传递、作为返回值返回和在函数内部创建等。概念我们就不过介绍，我们把关注在放在 Go 语言函数的一些典型应用上。

### 1.1 函数的显示类型转换
这个示例来自 net/http 的 http.HandlerFunc:
1. ListenAndServe 接收 Handler 接口作为参数
2. 自定义的类型 HandlerFunc 实现了 Handler 接口
3. 通过显示的类型转换 http.HandlerFunc(greeting)，将函数greeting显式转换为HandlerFunc类型，转型后的greeting就满足了ListenAndServe函数第二个参数的要求


```go
func greeting(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Welcome, Gopher!\n")
}

func main() {
    http.ListenAndServe(":8080", http.HandlerFunc(greeting))
}

// $GOROOT/src/net/http/server.go
func ListenAndServe(addr string, handler Handler) error {
    server := &Server{Addr: addr, Handler: handler}
    return server.ListenAndServe()
}

// $GOROOT/src/net/http/server.go
type Handler interface {
    ServeHTTP(ResponseWriter, *Request)
}

type HandlerFunc func(ResponseWriter, *Request)

// ServeHTTP调用f(w, r)
func (f HandlerFunc) ServeHTTP(w ResponseWriter, r *Request) {
    f(w, r)
}
```

### 1.2 函子
函子是函数式编程利的概念，函子非常适合用来对容器集合元素进行批量同构处理。我们直接来看示例:

```go
// 函子
type IntSliceFunctor interface {
    Fmap(fn func(int) int) IntSliceFunctor
}

// 函子的载体，这个载体包含了要处理的数据，并将处理数据的框架暴露通过 Fmap 暴露出去
type intSliceFunctorImpl struct {
    ints []int
}

func (isf intSliceFunctorImpl) Fmap(fn func(int) int) IntSliceFunctor {
    newInts := make([]int, len(isf.ints))
    for i, elt := range isf.ints {
        retInt := fn(elt)
        newInts[i] = retInt
    }
    return intSliceFunctorImpl{ints: newInts}
}

func NewIntSliceFunctor(slice []int) IntSliceFunctor {
    return intSliceFunctorImpl{ints: slice}
}

// 使用
func main() {
    // 原切片
    intSlice := []int{1, 2, 3, 4}
    f := NewIntSliceFunctor(intSlice)
    fmt.Printf("original functor: %+v\n", f)

    mapperFunc1 := func(i int) int {
        return i + 10
    }

    mapped1 := f.Fmap(mapperFunc1)
    fmt.Printf("mapped functor1: %+v\n", mapped1)

    mapperFunc2 := func(i int) int {
        return i * 3
    }
    mapped2 := mapped1.Fmap(mapperFunc2)
    fmt.Printf("mapped functor2: %+v\n", mapped2)
    fmt.Printf("original functor: %+v\n", f) // 原函子没有改变
    fmt.Printf("composite functor: %+v\n", f.Fmap(mapperFunc1).Fmap(mapperFunc2))
}
```

### 1.2 变长参数函数
变长参数函数就是可以接收任意个参数的函数，比如 fmt.Println: `func Println(a ...interface{}) (n int, err error)`。

形参a的类型是一个比较奇特的组合：... interface{}。这种接受“...T”类型形式参数的函数就被称为变长参数函数:
1. 一个变长参数函数只能有一个“...T”类型形式参数，并且该形式参数应该为函数参数列表中的最后一个形式参数
2. 变长参数函数的“...T”类型形式参数在函数体内呈现为[]T类型的变量
3. 在函数外部，“...T”类型形式参数可匹配和接受的实参类型有两种
    - 多个T类型变量；
    - t...（t为[]T类型变量）
    - 只能选择上述两种实参类型中的一种

变长参数函数时最容易出现的一个问题是实参与形参不匹配:

```go
func dump(args ...interface{}) {
    for _, v := range args {
        fmt.Println(v)
    }
}

func main() {
    s := []string{"Tony", "John", "Jim"}
    dump(s...)
}

$ go run variadic_function_2.go
./variadic_function_2.go:14:6: cannot use s (type []string) as type []interface {} in argument to dump
```

编译器给出了“类型不匹配”的错误。dump函数的变长参数类型为“...interface{}”，因此匹配该形参的要么是interface{}类型的变量，要么为“t...”（t类型为`[]interface{}`）。在例子中给dump传入的实参为“s...”，但s的类型为`[]string`，并非`[]interface{}`，导致不匹配。这里要注意的是，虽然string类型变量可以直接赋值给interface{}类型变量，但是`[]string类型变量并不能直接赋值给[]interface{}类型变量`。

不过有个例外，那就是Go内置的append函数，它支持通过下面的方式将字符串附加到一个字节切片后面：

```go
func main() {
    b := []byte{}
    b = append(b, "hello"...)
    fmt.Println(string(b))
}

$ go run variadic_function_3.go
hello
```
string类型本是不满足类型要求的（append本需要`[]byte...`），这算是Go编译器的一个优化，编译器自动将string隐式转换为了[]byte。如果是我们自定义的函数，那么是无论如何都不能支持这样的用法的。

## 2. defer
defer的运作离不开函数，这至少有两层含义：
1. 在Go中，只有在函数和方法内部才能使用defer；
2. defer关键字后面只能接函数或方法，这些函数被称为deferred函数。defer将它们注册到其所在goroutine用于存放deferred函数的栈数据结构中，这些deferred函数将在执行defer的函数退出(无论是正常退出，还是 panic)前被按后进先出（LIFO）的顺序调度执行

![defer 执行顺序](/images/go/expert/defer.png)

defer 有一些关键问题需要了解，否则很容掉进一些坑里:
1. 对于有返回值的自定义函数或方法，返回值会在deferred函数被调度执行的时候被自动丢弃。
2. Go语言中除了有自定义的函数或方法，还有内置函数
    - 支持用在 defer: close、copy、delete、print、recover
    - 不支持用在 defer: append、cap、len、make、new
    - 不能直接作为deferred函数的内置函数，可以使用一个包裹它的匿名函数来间接满足要求
3. defer关键字后面的表达式是在将deferred函数注册到deferred函数栈的时候进行求值的

```go
// append 不支持在 defer 中使用，可以使用匿名函数包裹
defer func (){
    append(sl, 11)
}()

// defer 的求值时机
func foo1() {
    for i := 0; i <= 3; i++ {   
        // defer将fmt.Println注册到deferred函数栈的时候，都会对Println后面的参数 i 进行求值
        // 在foo1返回后,将输出 3 2 1
        defer fmt.Println(i)
    }
}

func foo3() {
    for i := 0; i <= 3; i++ {
        // 匿名函数以闭包的方式访问外围函数的变量i
        // foo3返回后，将输出 4 4 4 4
        defer func() {
            fmt.Println(i)
        }()
    }
}

```

在上面的示例中:
1. foo1中，defer后面直接接的是fmt.Println函数，每当defer将fmt.Println注册到deferred函数栈的时候，都会对Println后面的参数进行求值。根据上述代码逻辑，依次压入deferred函数栈的函数是：
    - fmt.Println(0)
    - fmt.Println(1)
    - fmt.Println(2)
    - fmt.Println(3)
2. foo3中，defer后面接的是一个不带参数的匿名函数。根据上述代码逻辑，依次压入deferred函数栈的函数是：
    - func()
    - func()
    - func()
    - func()

### 2.1 defer 常用用法
#### 拦截panic
defer + recover 可以从 panic 中恢复:
```go
// $GOROOT/src/bytes/buffer.go
func makeSlice(n int) []byte {
    // If the make fails, give a known error.
    defer func() {
        if recover() != nil {
            panic(ErrTooLarge) // 触发一个新panic
        }
    }()
    return make([]byte, n)
}
```

deferred函数虽然可以拦截绝大部分的panic，但无法拦截并恢复一些运行时之外的致命问题。

#### 修改函数的具名返回值
```go
// $GOROOT/src/fmt/scan.go
func (s *ss) Token(skipSpace bool, f func(rune) bool) (tok []byte, err error) {
    defer func() {
        if e := recover(); e != nil {
            if se, ok := e.(scanError); ok {
                // 修改了 err 的返回值
                err = se.err
            } else {
                panic(e)
            }
        }
    }()
...
}

```

#### 输出调试信息
deferred函数被注册及调度执行的时间点使得它十分适合用来输出一些调试信息。

比如 net 包中的hostLookupOrder方法就使用deferred函数在特定日志级别下输出一些日志以便于程序调试和跟踪。

```go
// $GOROOT/src/net/conf.go

func (c *conf) hostLookupOrder(r *Resolver, hostname string) (ret hostLookupOrder) {
    if c.dnsDebugLevel > 1 {
        defer func() {
            print("go package net: hostLookupOrder(", hostname, ") = ", ret.String(), "\n")
        }()
    }
    ...
}
```

另一个用法是在在出入函数时打印留痕日志:

```go
func trace(s string) string {
    fmt.Println("entering:", s)
    return s
}

func un(s string) {
    fmt.Println("leaving:", s)
}

func a() {
    defer un(trace("a"))
    fmt.Println("in a")
}

func b() {
    defer un(trace("b"))
    fmt.Println("in b")
    a()
}
```

#### 还原变量旧值

```go
// $GOROOT/src/syscall/fs_nacl.go
func init() {
    oldFsinit := fsinit
    defer func() { fsinit = oldFsinit }()
    fsinit = func() {}
    ....
}
```

## 2. 方法
和函数相比，Go语言中的方法在声明形式上仅仅多了一个参数，Go称之为receiver参数。

```go
func (receiver T/*T) MethodName(参数列表) (返回值列表) {
    // 方法体
}
```

上面方法声明中的T称为receiver的基类型。通过receiver，上述方法被绑定到类型T上。Go方法具有如下特点:
1. 方法名的首字母是否大写决定了该方法是不是导出方法
2. 方法定义要与类型定义放在同一个包内。由此我们可以推出：
    - 不能为原生类型（如int、float64、map等）添加方法，只能为自定义类型定义方法
    - 不能横跨Go包为其他包内的自定义类型定义方法
3. 每个方法只能有一个receiver参数，不支持多receiver参数列表或变长receiver参数。一个方法只能绑定一个基类型，Go语言不支持同时绑定多个类型的方法
4. receiver参数的基类型本身不能是指针类型或接口类型

```go
type MyInt *int
func (r MyInt) String() string { // 编译器错误：invalid receiver type MyInt (MyInt  is a pointer type)
    return fmt.Sprintf("%d", *(*int)(r))
}

type MyReader io.Reader
func (r MyReader) Read(p []byte) (int, error) { // 编译器错误：invalid receiver  type MyReader (MyReader is an  interface type)
    return r.Read(p)
}
```

### 2.1 方法的本质
```go
type T struct {
    a int
}

func (t T) Get() int {
    return t.a
}

func (t *T) Set(a int) int {
    t.a = a
    return t.a
}
}
```

C++的对象在调用方法时，编译器会自动传入指向对象自身的this指针作为方法的第一个参数。而对于Go来说，receiver其实也是同样道理，我们将receiver作为第一个参数传入方法的参数列表。上面示例中类型T的方法可以等价转换为下面的普通函数：

```go
func Get(t T) int {
    return t.a
}

func Set(t *T, a int) int {
    t.a = a
    return t.a
}
```

这种转换后的函数就是方法的原型。只不过在Go语言中，这种等价转换是由Go编译器在编译和生成代码时自动完成的。

#### 方法表达式
Go方法的一般使用方式如下：
```go
var t T
t.Get()
t.Set(1)
```
我们可以用如下方式等价替换上面的方法调用：

```go
var t T
T.Get(t)
(*T).Set(&t, 1)
```

这种直接以类型名T调用方法的表达方式被称为方法表达式（Method Expression）。**类型T只能调用T的方法集合**（Method Set）中的方法，同理，**\*T只能调用\*T的方法集合中的方法**。

这种通过方法表达式对方法进行调用的方式与我们之前所做的方法到函数的等价转换如出一辙。这就是Go方法的本质：**一个以方法所绑定类型实例为第一个参数的普通函数**。**Go方法自身的类型就是一个普通函数**，甚至可以将其作为右值赋值给函数类型的变量：

```go
var t T
f1 := (*T).Set // f1的类型，也是T类型Set方法的原型：func (t *T, int)int
f2 := T.Get    // f2的类型，也是T类型Get方法的原型：func (t T)int
f1(&t, 3)
fmt.Println(f2(t))
```

### 2.2 选择正确的receiver类型
方法和函数的等价变换公式：
```go
func (t T) M1() <=>  M1(t T)
func (t *T) M2() <=> M2(t *T)

func (t T) M1() <=>     T.M1(t T)
func (t *T) M2() <=> (*T).M2(t *T)
```

可以看到:
1. 当receiver参数的类型为T时，选择值类型的receiver，即: M1函数体中的t是T类型实例的一个副本
2. 当receiver参数的类型为*T时，选择指针类型的receiver，即: 给M2函数的t是T类型实例的地址

无论是T类型实例还是\*T类型实例，都既可以调用receiver为T类型的方法，也可以调用receiver为\*T类型的方法。这都是Go语法糖，Go编译器在编译和生成代码时为我们自动做了转换:

```go
func main() {
    var t T
    t.M1() // ok
    t.M2() // <=> (&t).M2()
    var pt = &T{}
    pt.M1() // <=> (*pt).M1()
    pt.M2() // ok
}
```

到这里，我们可以得出receiver类型选用的初步结论。
1. 如果要对类型实例进行修改，那么为receiver选择*T类型。
2. 如果没有对类型实例修改的需求，那么为receiver选择T类型或\*T类型均可
3. 考虑到Go方法调用时，receiver是以值复制的形式传入方法中的，如果类型的size较大，以值形式传入会导致较大损耗，这时选择*T作为receiver类型会更好些
3. 关于receiver类型的选择其实还有一个重要因素，那就是类型是否要实现某个接口

## 3. 方法集合
在 Go 中方法集合决定接口实现。要判断一个自定义类型是否实现了某接口类型，我们首先要识别出自定义类型的方法集合和接口类型的方法集合。Go语言规范：
1. 对于非接口类型的自定义类型T，其方法集合由所有receiver为T类型的方法组成；
2. 类型\*T的方法集合则包含所有receiver为T和*T类型的方法

不过方法集合的判断有时候并不容器，特别是存在结构体嵌入、接口嵌入和类型别名时。与接口类型和结构体类型相关的类型嵌入有三种组合：
1. 在接口类型中嵌入接口类型
2. 在结构体类型中嵌入接口类型
3. 结构体类型中嵌入结构体类型

### 3.1 接口类型中嵌入接口类型
嵌入其他接口类型的新接口类型的方法集合包含了被嵌入接口类型（如io.Reader）的方法集合。不过在Go 1.14之前的版本中这种方式有一个约束，那就是**被嵌入的接口类型的方法集合不能有交集**，同时**被嵌入的接口类型的方法集合中的方法不能与新接口中其他方法同名**。

```go
type Interface2 interface {
    M1()
    M2()
}

type Interface3 interface {
    Interface1
    Interface2 // Go 1.14之前版本报错：duplicate method M1
}

type Interface4 interface {
    Interface2
    M2() // Go 1.14之前版本报错：duplicate method M2
}

```
自Go 1.14版本开始，Go语言去除了这个约束。

### 3.2 在结构体类型中嵌入接口类型
在结构体类型中嵌入接口类型后，结构体类型的方法集合中将包含被嵌入接口类型的方法集合。

但有些时候结果并非这样，比如当结构体类型中嵌入多个接口类型且这些接口类型的方法集合存在交集时。这里不得不提一下嵌入了其他接口类型的结构体类型的实例在调用方法时，**Go选择方法的次序**:
1. 优先选择结构体自身实现的方法。
2. 如果结构体自身并未实现，那么将查找结构体中的嵌入接口类型的方法集合中是否有该方法，如果有，则提升（promoted）为结构体的方法
3. 如果结构体嵌入了多个接口类型且这些接口类型的方法集合存在交集，那么Go编译器将报错，除非结构体自己实现了交集中的所有方法

```go
type Interface interface {
    M1()
    M2()
    M3()
}

type Interface1 interface {
    M1()
    M2()
    M4()
}

type T struct {
    Interface
    Interface1
}

func main() {
    t := T{}
    t.M1()
    t.M2()
}

$ go run method_set_7.go
./method_set_7.go:22:3: ambiguous selector t.M1
./method_set_7.go:23:3: ambiguous selector t.M2
```
编译器在结构体类型内部的嵌入接口类型中寻找M1/M2方法时发现两个接口类型Interface和Interface1都包含M1/M2，于是编译器因无法做出选择而报错。

结构体类型在嵌入某接口类型的同时，也实现了这个接口。这一特性在单元测试中尤为有用:

```go
type Stmt interface {
    Close() error
    NumInput() int
    Exec(stmt string, args ...string) (Result, error)
    Query(args []string) (Rows, error)
}

// 返回男性员工总数
func MaleCount(s Stmt) (int, error) {
    result, err := s.Exec("select count(*) from employee_tab where gender=?", "1")
    if err != nil {
        return 0, err
    }
    return result.Int(), nil
}

// 我们要测试 MaleCount
import "testing"

type fakeStmtForMaleCount struct {
    Stmt
}

func (fakeStmtForMaleCount) Exec(stmt string, args ...string) (Result, error) {
    return Result{Count: 5}, nil
}

func TestEmployeeMaleCount(t *testing.T) {
    f := fakeStmtForMaleCount{}
    c, _ := MaleCount(f)
    if c != 5 {
        t.Errorf("want: %d, actual: %d", 5, c)
        return
    }
}
```
我们为TestEmployeeMaleCount测试用例建立了一个fakeStmtForMaleCount的伪对象，在该结构体类型中嵌入Stmt接口类型，这样fakeStmtForMaleCount就实现了Stmt接口，我们达到了快速建立伪对象的目的。之后，我们仅需为fakeStmtForMaleCount实现MaleCount所需的Exec方法即可。

### 3.3 在结构体类型中嵌入结构体类型
在结构体类型中嵌入结构体类型，外部的结构体类型T可以“继承”嵌入的结构体类型的所有方法的实现，并且无论是T类型的变量实例还是*T类型变量实例，都可以调用所有“继承”的方法。

```go
type T1 struct{}

func (T1) T1M1()   { println("T1's M1") }
func (T1) T1M2()   { println("T1's M2") }
func (*T1) PT1M3() { println("PT1's M3") }

type T2 struct{}

func (T2) T2M1()   { println("T2's M1") }
func (T2) T2M2()   { println("T2's M2") }
func (*T2) PT2M3() { println("PT2's M3") }

type T struct {
    T1
    *T2
}
```

虽然无论通过T类型变量实例还是\*T类型变量实例都可以调用所有“继承”的方法（这也是Go语法糖），但是T和*T类型的方法集合是有差别的：
1. T类型的方法集合 = T1的方法集合 + *T2的方法集合；
2. *T类型的方法集合 = *T1的方法集合 + *T2的方法集合

当结构中嵌入的多个结构体的方法集合存在交集时，依旧按照上面所说的 Go选择方法的次序进行处理。

### 3.4 defined类型的方法集合
```go
type MyInterface I
type Mystruct T
```
已有的类型（比如上面的I、T）被称为underlying类型，而新类型被称为defined类型。

新定义的defined类型与原underlying类型是完全不同的类型:
1. 基于接口类型创建的defined类型与原接口类型的方法集合是一致
2. 基于自定义非接口类型创建的defined类型则并没有“继承”原类型的方法集合，新的defined类型的方法集合是空的

```go
package main

type T struct{}

func (T) M1()  {}
func (*T) M2() {}

type Interface interface {
    M1()
    M2()
}

// T 的方法集合为空
type T1 T
// Interface 的方法集合与 Interface1 一致
type Interface1 Interface

```

### 3.5 类型别名的方法集合
Go在1.9版本中引入了类型别名，支持为已有类型定义别名:

```go
type MyInterface = I
type Mystruct = T
```

类型别名与原类型拥有完全相同的方法集合，无论原类型是接口类型还是非接口类型。

## 4. 接口
### 4.1 接口类型变量的内部表示
在看接口的内部表示之前，我们先看一个示例:

```go
type MyError struct {
    error
}


func returnsError() error {
    var p *MyError = nil
    return p
}

func main() {
    e := returnsError()
    // 注意: returnsError 返回值是 error 接口变量
    if e != nil {
        fmt.Printf("error: %+v\n", e)
        return
    }
    fmt.Println("ok")
}

$go run interface-internal-1.go
error: <nil>
```

returnsError 返回值是 error 接口变量，因此 returnsError 在返回时，存在一个隐式的转换 error(p)。所以虽然 p 是 nil，但是 error(p) != nil。这就涉及到接口类型变量的内部表示了。我们可以在$GOROOT/src/runtime/runtime2.go中找到接口类型变量在运行时的表示：

```go
// $GOROOT/src/runtime/runtime2.go
type iface struct {
    tab  *itab
    data unsafe.Pointer
}

type eface struct {
    _type *_type
    data  unsafe.Pointer
}
```

我们看到在运行时层面，接口类型变量有两种内部表示——eface和iface，这两种表示分别用于不同接口类型的变量。
1. eface：用于表示没有方法的空接口（empty interface）类型变量，即interface{}类型的变量。
2. iface：用于表示其余拥有方法的接口（interface）类型变量。
eface/iface 都有两个指针字段，并且第二个指针字段都指向当前赋值给该接口类型变量的动态类型**变量的值**。

#### eface
eface 所表示的空接口类型并无方法列表，因此其第一个指针字段指向一个_type类型结构，该结构为该接口类型变量的动态类型的信息：

```go
// $GOROOT/src/runtime/type.go

type _type struct {
    size       uintptr
    ptrdata    uintptr
    hash       uint32
    tflag      tflag
    align      uint8
    fieldalign uint8
    kind       uint8
    alg        *typeAlg
    gcdata    *byte
    str       nameOff
    ptrToThis typeOff
}
```

#### iface
iface除了要存储动态类型信息之外，还要存储接口本身的信息（接口的类型信息、方法列表信息等）以及动态类型所实现的方法的信息，因此iface的第一个字段指向一个itab类型结构：


```go
// $GOROOT/src/runtime/runtime2.go

type itab struct {
    inter *interfacetype
    _type *_type
    hash  uint32
    _     [4]byte
    fun   [1]uintptr
}
```
itab结构包括:
1. _type: 存储着该接口类型变量的动态类型的信息
2. fun: 动态类型已实现的接口方法的调用地址数组
3. inter: 指向的interfacetype结构存储着该**接口类型自身的信息**

```go
// $GOROOT/src/runtime/type.go
type interfacetype struct {
    typ     _type
    pkgpath name
    mhdr    []imethod
}
```

interfacetype结构由三个字段组成:
1. 类型信息（typ）
2. 包路径名（pkgpath）
3. 接口方法集合切片（mhdr）


#### 接口类型内部表示的示例

```go
// interface-internal-4.go
type T struct {
    n int
    s string
}

func (T) M1() {}
func (T) M2() {}

type NonEmptyInterface interface {
    M1()
    M2()
}


func main() {
    var t = T {
        n: 17,
        s: "hello, interface",
    }
    var ei interface{} = t // Go运行时使用eface结构表示ei
    var i NonEmptyInterface = t

}
```
首先看一个用eface表示空接口类型变量的例子：`var ei interface{} = t`

![eface 结构示意图](/images/go/expert/eface.png)

iface的表示稍复杂些: `var i NonEmptyInterface = t`

![iface 结构示意图](/images/go/expert/iface.png)

虽然eface和iface的第一个字段有所差别，但tab和_type可统一看作动态类型的类型信息。Go语言中每种类型都有唯一的_type信息，无论是内置原生类型，还是自定义类型。Go运行时会为程序内的全部类型建立只读的共享_type信息表，因此拥有相同动态类型的同类接口类型变量的_type/tab信息是相同的。

接口类型变量的data部分则指向一个动态分配的内存空间，该内存空间存储的是赋值给接口类型变量的动态类型变量的值。**未显式初始化的接口类型变量的值为nil，即该变量的_type/tab和data都为nil**。这样，我们要**判断两个接口类型变量是否相同，只需判断_type/tab是否相同以及data指针所指向的内存空间所存储的数据值是否相同**（注意：不是data指针的值）。

eface和iface是runtime包中的非导出结构体定义，我们不能直接在包外使用，也就无法直接访问两个结构体中的数据。不过Go语言提供了**println预定义函数**，可以用来输出eface或iface的两个指针字段的值。println在编译阶段会由编译器根据要输出的参数的类型将println替换为特定的函数，这些函数都定义在$GOROOT/src/runtime/print.go文件中，而针对eface和iface类型的打印函数实现如下：

```go
// $GOROOT/src/runtime/print.go
func printeface(e eface) {
    print("(", e._type, ",", e.data, ")")
}

func printiface(i iface) {
    print("(", i.tab, ",", i.data, ")")
}

func printNilInterface() {
    // nil接口变量
    var i interface{} // 空接口类型
    var err error     // 非空接口类型
    println(i)        // (0x0,0x0)
    println(err)      // (0x0,0x0)
    println("i = nil:", i == nil) // true
    println("err = nil:", err == nil) // true
    println("i = err:", i == err) // false
    println("")
}
```

### 4.2 接口等值判断
前面已经提到了，接口变量，无论是空接口还是非空接口，只有在tab/_type和data所指数据内容一致的情况下，两个接口类型变量之间才能画等号。

对于 `var err1 error= (*T)(nil)` err1 接口类型变量的类型信息并不为空，所以 `err1 !=nil`。上面的 returnsError 就属于这种情况。

空接口类型变量和非空接口类型变量内部表示的结构有所不同（第一个字段：_type vs. tab），似乎一定不能相等。但Go在进行等值比较时，类型比较使用的是eface的_type和iface的tab._type，所以下面的 eif(空接口) err(非空接口) 两个接口类型变量是相等的。

```go
var eif interface{} = T(5)
var err error = T(5)
println("eif = err:", eif == err) // True
```

### 4.3 接口类型的赋值原理
在Go语言中，将任意类型赋值给一个接口类型变量都是装箱操作。接口类型的装箱实则就是创建一个eface或iface的过程。我们以上面的 interface-internal-4.go 为例，输出其汇编代码:

`go tool compile -S interface-internal-4.go > interface-internal-4.s`

```
// 对应ei = t一行的汇编如下
...
0x00b6 00182 (interface-internal-4.go:24)       PCDATA  $0, $1
0x00b6 00182 (interface-internal-4.go:24)       PCDATA  $1, $1
0x00b6 00182 (interface-internal-4.go:24)        LEAQ    ""..autotmp_15+408(SP), AX
0x00be 00190 (interface-internal-4.go:24)       PCDATA  $0, $0
0x00be 00190 (interface-internal-4.go:24)       MOVQ    AX, 8(SP)
0x00c3 00195 (interface-internal-4.go:24)       CALL    runtime.convT2E(SB)
...

// 对应i = t一行的汇编如下

0x0128 00296 (interface-internal-4.go:27)       PCDATA  $0, $1
0x0128 00296 (interface-internal-4.go:27)       PCDATA  $1, $4
0x0128 00296 (interface-internal-4.go:27)       LEAQ    ""..autotmp_15+408(SP), AX
0x0130 00304 (interface-internal-4.go:27)       PCDATA  $0, $0
0x0130 00304 (interface-internal-4.go:27)       MOVQ    AX, 8(SP)
0x0135 00309 (interface-internal-4.go:27)       CALL    runtime.convT2I(SB)

```

我们看到了convT2E和convT2I两个runtime包的函数。这两个函数的实现位于$GOROOT/src/runtime/iface.go中：

```go
// $GOROOT/src/runtime/iface.go
func convT2E(t *_type, elem unsafe.Pointer) (e eface) {
    if raceenabled {
        raceReadObjectPC(t, elem, getcallerpc(), funcPC(convT2E))
    }
    if msanenabled {
        msanread(elem, t.size)
    }
    x := mallocgc(t.size, t, true)
    typedmemmove(t, x, elem)
    e._type = t
    e.data = x
    return
}

func convT2I(tab *itab, elem unsafe.Pointer) (i iface) {
    t := tab._type
    if raceenabled {
        raceReadObjectPC(t, elem, getcallerpc(), funcPC(convT2I))
    }
    if msanenabled {
        msanread(elem, t.size)
    }
    x := mallocgc(t.size, t, true)
    typedmemmove(t, x, elem)
    i.tab = tab
    i.data = x
    return
}
```

convT2E用于将任意类型转换为一个eface，convT2I用于将任意类型转换为一个iface。两个函数的实现逻辑相似，主要思路就是根据传入的类型信息（convT2E的_type和convT2I的tab._type）分配一块内存空间，并将elem指向的数据复制到这块内存空间中，最后传入的类型信息作为返回值结构中的类型信息，返回值结构中的数据指针（data）指向新分配的那块内存空间。

经过装箱后，箱内的数据（存放在新分配的内存空间中）与原变量便无瓜葛了，除非是指针类型。

那么convT2E和convT2I函数的类型信息从何而来？这些都依赖Go编译器的工作。编译器知道每个要转换为接口类型变量（toType）的动态类型变量的类型（fromType），会根据这一类型选择适当的convT2X函数（见下面代码中的convFuncName），并在生成代码时使用选出的convT2X函数参与装箱操作：

装箱是一个有性能损耗的操作，因此Go在不断对装箱操作进行优化，包括对常见类型（如整型、字符串、切片等）提供一系列快速转换函数：

```
/ 实现在 $GOROOT/src/runtime/iface.go中
func convT16(val any) unsafe.Pointer     // val必须是一个uint-16相关类型的参数
func convT32(val any) unsafe.Pointer     // val必须是一个unit-32相关类型的参数
func convT64(val any) unsafe.Pointer     // val必须是一个unit-64相关类型的参数
func convTstring(val any) unsafe.Pointer // val必须是一个字符串类型的参数
func convTslice(val any) unsafe.Pointer  // val必须是一个切片类型的参数
```

这些函数去除了typedmemmove操作，增加了零值快速返回等。同时Go建立了staticbytes区域，对byte大小的值进行装箱操作时不再分配新内存，而是利用staticbytes区域的内存空间，如bool类型等。

```go
// $GOROOT/src/runtime/iface.go
// staticbytes用来避免对字节大小的值进行convT2E转换
var staticbytes = [...]byte{
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
    0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
    ...
}
```
