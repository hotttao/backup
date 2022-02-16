---
title: 2. Go面向接口编程和错误处理
date: 2021-01-02
categories:
    - Go
tags:
    - Go设计模式
---

Go接口和错误处理。这篇文章摘录自[耗子哥博客-Go编程模式](https://coolshell.cn/articles/21128.html)
<!-- more -->

## 1. 面向接口编程
Go 语言不支持传统的面向对象编程，结构体嵌入看似是面向对象，其实只是 Go 实现的语法糖。而接口才是 Go 语言中实现多态和泛型的主要方式。这就带来了 Go 语言与其他面向对象语言在实现 23 种设计模式上的差异。那 Go 语言中面向接口编程体现在哪呢？

### 1. 何为接口编程
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

## 2.错误处理
错误处理一直以一是编程必需要面对的问题，不同的语言有不同的出现处理的方式，Go语言也一样。接下来我们来讨论一下Go语言的出错出处，尤其是那令人抓狂的 if err != nil 。不过在这之前，我们先来看看编程中的错误处理。这样可以在更高的层面理解编程中的错误处理。

### 2.1 C语言的错误检查
首先，我们知道，处理错误最直接的方式是通过错误码，这也是传统的方式，在过程式语言中通常都是用这样的方式处理错误的。比如 C 语言，基本上来说，其通过函数的返回值标识是否有错，然后通过全局的 errno 变量并配合一个 errstr 的数组来告诉你为什么出错。

为什么是这样的设计？道理很简单，除了可以共用一些错误，更重要的是这其实是一种妥协。比如：read(), write(), open() 这些函数的返回值其实是返回有业务逻辑的值。也就是说，这些函数的返回值有两种语义，一种是成功的值，比如 open() 返回的文件句柄指针 FILE* ，或是错误 NULL。这样会导致调用者并不知道是什么原因出错了，需要去检查 errno 来获得出错的原因，从而可以正确地处理错误。

这种用 返回值 + errno 的错误检查方式会有一些问题:
1. 程序员一不小心就会忘记返回值的检查，从而造成代码的 Bug；
2. 函数接口非常不纯洁，正常值和错误值混淆在一起，导致语义有问题。

所以，后来，有一些类库就开始区分这样的事情。比如，Windows 的系统调用开始使用 HRESULT 的返回来统一错误的返回值，这样可以明确函数调用时的返回值是成功还是错误。但这样一来，函数的 input 和 output 只能通过函数的参数来完成，于是出现了所谓的 **入参** 和 **出参** 这样的区别。

然而，这又使得函数接入中参数的语义变得复杂，一些参数是入参，一些参数是出参，函数接口变得复杂了一些。而且，依然没有解决函数的成功或失败可以被人为忽略的问题。

### 2.2 Java的错误处理
Java语言使用 try-catch-finally 通过使用异常的方式来处理错误，其实，这比起C语言的错处理进了一大步，使用抛异常和抓异常的方式可以让我们的代码有这样的一些好处：
1. 函数接口在 input（参数）和 output（返回值）以及错误处理的语义是比较清楚的。
2. 正常逻辑的代码可以与错误处理和资源清理的代码分开，提高了代码的可读性。
3. 异常不能被忽略（如果要忽略也需要 catch 住，这是显式忽略）。
4. 在面向对象的语言中（如 Java），异常是个对象，所以，可以实现多态式的 catch。
5. 与状态返回码相比，异常捕捉有一个显著的好处是，函数可以嵌套调用，或是链式调用。比如：
	- int x = add(a, div(b,c));
	- Pizza p = PizzaBuilder().SetSize(sz).SetPrice(p)...;

### 2.3 Go语言的错误处理
Go 语言的函数支持多返回值，所以，可以在返回接口把 **业务语义（业务返回值）** 和 **控制语义（出错返回值）** 区分开来。Go 语言的很多函数都会返回 result, err 两个值，于是:
1. 参数上基本上就是入参，而返回接口把**结果和错误分离**，这样使得**函数的接口语义清晰**；
2. 而且，Go 语言中的**错误参数如果要忽略，需要显式地忽略**，用 _ 这样的变量来忽略；
3. 另外，因为返回的 **error 是个接口**（其中只有一个方法 Error()，返回一个 string ），所以你可以扩展自定义的错误处理。

另外，如果一个函数返回了多个不同类型的 error，你也可以使用下面这样的方式：

```go
if err != nil {
  switch err.(type) {
    case *json.SyntaxError:
      ...
    case *ZeroDivisionError:
      ...
    case *NullPointerError:
      ...
    default:
      ...
  }
}
```

Go语言的错误处理的的方式，本质上是**返回值检查**，但是也兼顾了异常的一些好处 – **对错误的扩展**。

### 2.4 资源清理
出错后是需要做资源清理的，不同的编程语言有**不同的资源清理的编程模式**：
1. C语言 – 使用的是 goto fail; 的方式到一个集中的地方进行清理（有篇有意思的文章可以看一下[《由苹果的低级BUG想到的》](https://coolshell.cn/articles/11112.html)）
2. C++语言- 一般来说使用 [RAII模式](https://en.wikipedia.org/wiki/Resource_acquisition_is_initialization)，通过面向对象的代理模式，把需要清理的资源交给一个代理类，然后在析构函数来解决。
3. Java语言 – 可以在finally 语句块里进行清理。
4. Go语言 – 使用 defer 关键词进行清理。

下面是一个Go语言的资源清理的示例：

```go
func Close(c io.Closer) {
  err := c.Close()
  if err != nil {
    log.Fatal(err)
  }
}

func main() {
  r, err := Open("a")
  if err != nil {
    log.Fatalf("error opening 'a'\n")
  }
  defer Close(r) // 使用defer关键字在函数退出时关闭文件。

  r, err = Open("b")
  if err != nil {
    log.Fatalf("error opening 'b'\n")
  }
  defer Close(r) // 使用defer关键字在函数退出时关闭文件。
}
```

### 2.4 Error Check  Hell
我们先看如下的一个令人崩溃的代码。`if err !=nil` 的代码的确能让人写到吐。

```go
func parse(r io.Reader) (*Point, error) {

    var p Point

    if err := binary.Read(r, binary.BigEndian, &p.Longitude); err != nil {
        return nil, err
    }
    if err := binary.Read(r, binary.BigEndian, &p.Latitude); err != nil {
        return nil, err
    }
    if err := binary.Read(r, binary.BigEndian, &p.Distance); err != nil {
        return nil, err
    }
    if err := binary.Read(r, binary.BigEndian, &p.ElevationGain); err != nil {
        return nil, err
    }
    if err := binary.Read(r, binary.BigEndian, &p.ElevationLoss); err != nil {
        return nil, err
    }
}
```

解决这个问题的一种方法是**函数式编程的方式**，比如:

```go
func parse(r io.Reader) (*Point, error) {
    var p Point
    var err error
    // 函数式编程，对错误处理的代码进行抽象
	read := func(data interface{}) {
        if err != nil {
            return
        }
        err = binary.Read(r, binary.BigEndian, data)
    }

    read(&p.Longitude)
    read(&p.Latitude)
    read(&p.Distance)
    read(&p.ElevationGain)
    read(&p.ElevationLoss)

    if err != nil {
        return &p, err
    }
    return &p, nil
}
```

Closure 的方式把相同的代码给抽出来重新定义一个函数，这样大量的  if err!=nil 处理的很干净了。但是会带来一个问题，那就是有一个 err 变量和一个内部的函数，感觉不是很干净。那么，我们还能不能搞得更干净一点呢，我们从Go 语言的 bufio.Scanner()中似乎可以学习到一些东西：

```go
scanner := bufio.NewScanner(input)

for scanner.Scan() {
    token := scanner.Text()
    // process token
}

if err := scanner.Err(); err != nil {
    // process the error
}
```

scanner在操作底层的I/O的时候，那个for-loop中没有任何的 if err !=nil 的情况，退出循环后有一个 scanner.Err() 的检查。看来**使用了结构体的方式**。模仿它，我们可以把我们的代码重构成下面这样：

```go
type Reader struct {
    r   io.Reader
    err error // 错误收集
}

func (r *Reader) read(data interface{}) {
    if r.err == nil {
        r.err = binary.Read(r.r, binary.BigEndian, data)
    }
}

func parse(input io.Reader) (*Point, error) {
    var p Point
    r := Reader{r: input}

    r.read(&p.Longitude)
    r.read(&p.Latitude)
    r.read(&p.Distance)
    r.read(&p.ElevationGain)
    r.read(&p.ElevationLoss)

    if r.err != nil {
        return nil, r.err
    }

    return &p, nil
}
```

有了上面这个技术，我们的“流式接口 Fluent Interface”，也就很容易处理了。如下所示：

```go
package main

import (
  "bytes"
  "encoding/binary"
  "fmt"
)

// 长度不够，少一个Weight
var b = []byte {0x48, 0x61, 0x6f, 0x20, 0x43, 0x68, 0x65, 0x6e, 0x00, 0x00, 0x2c} 
var r = bytes.NewReader(b)

type Person struct {
  Name [10]byte
  Age uint8
  Weight uint8
  err error
}

func (p *Person) read(data interface{}) {
  if p.err == nil {
    p.err = binary.Read(r, binary.BigEndian, data)
  }
}

func (p *Person) ReadName() *Person {
  p.read(&p.Name) 
  return p
}
func (p *Person) ReadAge() *Person {
  p.read(&p.Age) 
  return p
}
func (p *Person) ReadWeight() *Person {
  p.read(&p.Weight) 
  return p
}
func (p *Person) Print() *Person {
  if p.err == nil {
    fmt.Printf("Name=%s, Age=%d, Weight=%d\n",p.Name, p.Age, p.Weight)
  }
  return p
}

func main() {   
  p := Person{}
  p.ReadName().ReadAge().ReadWeight().Print()
  fmt.Println(p.err)  // EOF 错误
}
```

**但是，其使用场景也就只能在对于同一个业务对象的不断操作下可以简化错误处理，对于多个业务对象的话，还是得需要各种 if err != nil的方式。**

### 2.5 包装错误
错误的传递，我们们需要包装一下错误，而不是干巴巴地把err给返回到上层，我们需要把一些执行的上下文加入。通常来说，我们会使用 fmt.Errorf()来完成这个事，比如：

```go
if err != nil {
   return fmt.Errorf("something failed: %v", err)
}
```

另外，在Go语言的开发者中，更为普遍的做法是将错误包装在另一个错误中，同时保留原始内容：

```go
type authorizationError struct {
    operation string
    err error   // original error
}

func (e *authorizationError) Error() string {
    return fmt.Sprintf("authorization failed during %s: %v", e.operation, e.err)
}
```

当然，更好的方式是通过一种标准的访问方法，这样，我们最好使用一个接口，比如 causer接口中实现 Cause() 方法来暴露原始错误，以供进一步检查：

```go
type causer interface {
    Cause() error
}

func (e *authorizationError) Cause() error {
    return e.err
}
```

有一个第三方的错误库（github.com/pkg/errors）已经帮我做了这个事情，这个库基本上来说就是事实上的标准了:

```go
import "github.com/pkg/errors"

//错误包装
if err != nil {
    return errors.Wrap(err, "read failed")
}

// Cause接口
switch err := errors.Cause(err).(type) {
case *MyError:
    // handle specifically
default:
    // unknown error
}
```
