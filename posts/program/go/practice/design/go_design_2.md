---
weight: 4
title: "go 错误处理"
date: 2021-03-02T22:00:00+08:00
lastmod: 2021-03-02T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Go 错误处理"
featuredImage: 

tags: ["go 惯例"]
categories: ["Go"]

lightgallery: true
---

Go 错误处理。这篇文章摘录自[耗子哥博客-Go编程模式](https://coolshell.cn/articles/21128.html)
<!-- more -->

## 1.错误处理
错误处理一直以一是编程必需要面对的问题，不同的语言有不同的出现处理的方式，Go语言也一样。接下来我们来讨论一下Go语言的出错出处，尤其是那令人抓狂的 if err != nil 。不过在这之前，我们先来看看编程中的错误处理。这样可以在更高的层面理解编程中的错误处理。

### 1.1 C语言的错误检查
首先，我们知道，处理错误最直接的方式是通过错误码，这也是传统的方式，在过程式语言中通常都是用这样的方式处理错误的。比如 C 语言，基本上来说，其通过函数的返回值标识是否有错，然后通过全局的 errno 变量并配合一个 errstr 的数组来告诉你为什么出错。

为什么是这样的设计？道理很简单，除了可以共用一些错误，更重要的是这其实是一种妥协。比如：read(), write(), open() 这些函数的返回值其实是返回有业务逻辑的值。也就是说，这些函数的返回值有两种语义，一种是成功的值，比如 open() 返回的文件句柄指针 FILE* ，或是错误 NULL。这样会导致调用者并不知道是什么原因出错了，需要去检查 errno 来获得出错的原因，从而可以正确地处理错误。

这种用 返回值 + errno 的错误检查方式会有一些问题:
1. 程序员一不小心就会忘记返回值的检查，从而造成代码的 Bug；
2. 函数接口非常不纯洁，正常值和错误值混淆在一起，导致语义有问题。

所以，后来，有一些类库就开始区分这样的事情。比如，Windows 的系统调用开始使用 HRESULT 的返回来统一错误的返回值，这样可以明确函数调用时的返回值是成功还是错误。但这样一来，函数的 input 和 output 只能通过函数的参数来完成，于是出现了所谓的 **入参** 和 **出参** 这样的区别。

然而，这又使得函数接入中参数的语义变得复杂，一些参数是入参，一些参数是出参，函数接口变得复杂了一些。而且，依然没有解决函数的成功或失败可以被人为忽略的问题。

### 1.2 Java的错误处理
Java语言使用 try-catch-finally 通过使用异常的方式来处理错误，其实，这比起C语言的错处理进了一大步，使用抛异常和抓异常的方式可以让我们的代码有这样的一些好处：
1. 函数接口在 input（参数）和 output（返回值）以及错误处理的语义是比较清楚的。
2. 正常逻辑的代码可以与错误处理和资源清理的代码分开，提高了代码的可读性。
3. 异常不能被忽略（如果要忽略也需要 catch 住，这是显式忽略）。
4. 在面向对象的语言中（如 Java），异常是个对象，所以，可以实现多态式的 catch。
5. 与状态返回码相比，异常捕捉有一个显著的好处是，函数可以嵌套调用，或是链式调用。比如：
	- int x = add(a, div(b,c));
	- Pizza p = PizzaBuilder().SetSize(sz).SetPrice(p)...;

### 1.3 Go语言的错误处理
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

### 1.4 资源清理
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

### 1.5 Error Check  Hell
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

### 1.5 包装错误
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

## 2. Go Error 最佳实践
前面我们对 Go 的 Error 处理有了一个全面的介绍。除了这些还有一些最佳实践我们关注。由于在 Go 中 Error are values，Go 语言中 Error 也有多种处理方式:
1. sentinel error: 预定义错误
2. error types: 实现了 error 接口的自定义类型并结合断言进行使用
3. error wrapt: 错误包装
4. 错误行为特征检视策略: 将某个包中的错误类型归类，统一提取出一些公共的错误行为特征（behaviour），并将这些错误行为特征放入一个公开的接口类型

接下来我们会一一比较这几种处理方式得优劣，得出最佳得 Error 得处理实践。

### 2.2 sentinel error
预定义的特定错误，我们叫为 sentinel error，这个名字来源于计算机编程中使用一个特定值来表示不可能进行进一步处理的做法。所以对于 Go，我们使用特定的值来表示错误。`if err == ErrSomething { … }` 标准库中得 io.EOF，更底层的 syscall.ENOENT 都是 sentinel error 得用法。但是 sentinel error 有如下缺点:
1. 使用 sentinel 值是最不灵活的错误处理策略，因为调用方必须使用 == 将结果与预先声明的值进行比较。当您想要提供更多的上下文时，这就出现了一个问题，因为返回一个不同的错误将破坏相等性检查。甚至是一些有意义的 fmt.Errorf 携带一些上下文，也会破坏调用者的 == ，调用者将被迫查看 error.Error() 方法的输出，以查看它是否与特定的字符串匹配。
2. 而依赖 error.Error() 得字符串输出，是一种非常弱的协议，很容易被破坏。Error 方法存在于 error 接口主要用于方便程序员使用，但不是程序（编写测试可能会依赖这个返回）。这个输出的字符串用于记录日志、输出到 stdout 等。所以不应该依赖检测 error.Error 的输出
3. Sentinel errors 成为你 API 公共部分。
   - 如果您的公共函数或方法返回一个特定值的错误，那么该值必须是公共的，当然要有文档记录，这会增加 API 的表面积。
   - 如果 API 定义了一个返回特定错误的 interface，则该接口的所有实现都将被限制为仅返回该错误，即使它们可以提供更具描述性的错误。
   - 你的接口表面积越大，接口就越脆弱
4. Sentinel errors 在两个包之间创建了依赖。sentinel errors 最糟糕的问题是它们在两个包之间创建了源代码依赖关系。例如，检查错误是否等于 io.EOF，您的代码必须导入 io 包。这个特定的例子听起来并不那么糟糕，因为它非常常见，但是想象一下，当项目中的许多包导出错误值时，存在耦合，项目中的其他包必须导入这些错误值才能检查特定的错误条件（in the form of an import loop）。

所以 sentinel errors 可以在标准库中使用，因为每一个标注库的功能相对单一，不会形成复杂依赖，但不适合在一个业务层的 application 中使用。

### 2.3 error types
使用自定义错误类型，并结合类型断言，可以提供更多的上下文信息:

```go
type MyErr struct {
  Line string
  Msg string
}

func main() {
  err := test()
  switch err := err.(type) {
    case nil:
      // success
    case *MyErr:
      // handler MyErr
    default:
      // unkown err
  }
}
```
调用者要使用类型断言和类型 switch，就要让自定义的 error 变为 public。这种模型会导致和调用者产生强耦合，从而导致 API 变得脆弱。虽然错误类型比 sentinel errors 更好，因为它们可以捕获关于出错的更多上下文，但是 error types 共享 error values 许多相同的问题。因此应该避免使用错误类型，或者至少避免将它们作为公共 API 的一部分。同样的 error types 在标准库中有使用，但是在业务层的 application 中也不适合使用。

### 2.4 error wrap
错误包装就是我们前面介绍的内容，除了 Cause 方法，github.com/pkg/errors 还提供了其他 Error 处理的方法。再明白为什么要这么做之前，我们需要明白 Error 处理中的痛点。我们经常会写出下面这样的代码:

```go
func step2() error {

}

func step1() error{
  _, err := step2() 
  if err != nil {
    log.Printf("print error in step1: %v", err)
    return err
  }
  return nil
}

func main() {
   _, err := step1() 
  if err != nil {
    log.Printf("print error in main: %v", err)
  }
}
```

在函数的调用链中，每一 error 处理的地方都打印了日志，最终的结果就是日志中，写满了相同错误的日志。显然理想的情况下，我们的错误应该时这样的，日志中只记录一次错误处理的完整信息。所以像上面的代码，要么直接抛出 err，要么将error记录到日志中，并对 error 进行处理。

理想情况下，错误处理应该满足以下几个目标:
1. 满足程序员的需求: 能够打印 error 的完整日志以及调用的堆栈信息
2. 满足程序的需求: 对底层的异常，包括 sentinel error 和 sentinel error 进行特定异常的判断，从而完成对特定异常的处理

github.com/pkg/errors 提供的错误包装如何实现这两个目的呢，我们看下面这个简单示例:

```go
import "github.com/pkg/errors"

func Readfile(path string) ([]byte, error) {
	f, err := os.Open(path)
	if err != nil {
    // 1. 包装错误，附加错误信息，并且 Wrap 方法会包含调用的堆栈信息
		return nil, errors.Wrap(err, "open failed")
	}
	defer f.Close()
	return io.ReadAll(f)
}

func ReadConfig() ([]byte, error) {
	home := os.Getenv("HOME")
	config, err := Readfile(filepath.Join(home, "setting.yaml"))
  // 2. WithMessage 同样会包装错误，但是并不会包含堆栈信息，避免重复打印堆栈
	return config, errors.WithMessage(err, "can not read config")
}

func ReadMe() {
	_, err := ReadConfig()
	if err != nil {
    // 3. %T 打印错误类型，%v 打印错误值，Cause() 函数用于获取包装错误的根因
    // 函数的根因可以用于底层的错误判定
		fmt.Printf("origin error %T %v\n", errors.Cause(err), errors.Cause(err))
    // %+v 打印 wrap error 中包含的堆栈信息
		fmt.Printf("stack trace: \n %+v\n", err)
	}
}
```

#### github.com/pkg/errors 使用技巧
github.com/pkg/errors 提供了丰富的接口，有很多使用上的技巧:

在你的应用代码中自己触发的 error，使用 errors.New 或者  errros.Errorf 返回错误，这两个方法都会携带上堆栈信息

```go
func parseArg(args string[]) {
  if len(args) < 3 {
    return errors.Errorf("not enough args")
  }
}
```

如果调用其他包内的函数，通常简单的直接返回，无需包装，因为在约定好大家都使用错误包装的情况下，重复的错误包装会打印重复的堆栈信息

```go
if err != nil {
  return err
}
```

如果和其他库进行协作，考虑使用 errors.Wrap 或者 errors.Wrapf 保存堆栈信息。同样适用于和标准库协作的时候

```go
f, err := os.Open(path)
if err != nil {
  return errors.Wrapf(err, "failed to open %q", path)
}
```

在长的函数调用链中，直接返回错误，而不是每个错误产生的地方到处打日志。最后在程序的顶部或者是工作的 goroutine 顶部（请求入口），使用 %+v  把堆栈详情记录。

```go
func main() {
  err := app.Run()
  if err != nil {
    fmt.Printf("Fatal: %+v\n", err)
    os.Exit(1)
  }
}
```
使用 errors.Cause 获取 root error，再进行和 sentinel error 判定。

#### github.com/pkg/errors 使用限制
上面所有的一套错误包装，在使用上是由一定限制的。试想一下，一个第三方库也使用上面的方法进行错误包装，那么在应用层也以同样的方法包装错误时，就会重复打印堆栈信息。所以只有 applications 可以选择错误包装。具有可重用性的基础包只能返回根错误值，即 sentinel error 或者自定义错误。此机制与 Go 标准库中使用的相同。

最后一单错误已经被处理了，这个错误就不应该被继续上抛给调用方，应该只返回 nil。

### 2.5 错误行为特征检视策略
以标准库中的net包为例，它将包内的所有错误类型的公共行为特征抽象并放入net.Error这个接口中。而错误处理方仅需依赖这个公共接口即可检视具体错误值的错误行为特征信息，并根据这些信息做出后续错误处理分支选择的决策。

```go
// $GOROOT/src/net/net.go
type Error interface {
    error
    Timeout() bool   // 是超时类错误吗？
    Temporary() bool // 是临时性错误吗？
}
```
下面是http包使用错误行为特征检视策略进行错误处理的代码：

```go
// $GOROOT/src/net/http/server.go
func (srv *Server) Serve(l net.Listener) error {
    ...
    for {
        rw, e := l.Accept()
        if e != nil {
            select {
            case <-srv.getDoneChan():
                return ErrServerClosed
            default:
            }
            if ne, ok := e.(net.Error); ok && ne.Temporary() {
                // 这里对临时性错误进行处理
                ...
                time.Sleep(tempDelay)
                continue
            }
            return e
        }
        ...
    }

```

Accept方法实际上返回的错误类型为*OpError，它是net包中的一个自定义错误类型，实现了错误公共特征接口net.Error，因此可以被错误处理方通过net.Error接口的方法判断其行为是否满足Temporary或Timeout特征。

```go
// $GOROOT/src/net/net.go
type OpError struct {
    ...
    // Err is the error that occurred during the operation.
    Err error
}

type temporary interface {
    Temporary() bool
}

func (e *OpError) Temporary() bool {
    if ne, ok := e.Err.(*os.SyscallError); ok {
        t, ok := ne.Err.(temporary)
        return ok && t.Temporary()
    }
    t, ok := e.Err.(temporary)
    return ok && t.Temporary()
}
```
### 2.6 错误判定
前面我们提到了两种错误判定的方法:
1. 使用 == 进行 sentinel error 的错误判定
2. 通过断言进行自定义错误的判定

go1.13为 errors 和 fmt 标准库包引入了新特性，以简化处理包含其他错误的错误。其中最重要的是: 包含另一个错误的 error 可以实现返回底层错误的 Unwrap 方法。如果 e1.Unwrap() 返回 e2，那么我们说 e1 包装 e2，您可以展开 e1 以获得 e2。

结合 Unwrap() 方法 go1.13 errors 包提供了两个用于检查错误的新函数：Is 和 As。这两个方法会循环判断 err 是否有 Unwrap() 方法，返回错误的根因，并于传入的错误进行比较。

```go
if err == NotFound {} 
// 相比于等值判定，强依赖特定的错误值，Is 的判定方法更加灵活，我们可以对错误进行包装，添加更多的上下文信息，但是不影响错误的等值判定
if errors.Is(err, NotFound) {}

if e, ok := err.(*QueryError); ok {}
var e *QueryError
if errors.As(err, &e) {}
```

为了便于错误包装，go13 还扩展了 fmt 包，fmt.Errorf 支持新的 %w 谓词，用于包装错误。内部的实现方式类似于:

```go
type wrapError {
  msg string
  err error
}

func (e *wrapError) Error() string {
  return e.msg
}

func (e *wrapError) Unwrap() string {
  return e.err
}
```

使用新的 %w 谓词，就可以结合 Is/As 进行错误判定了:

```go
err := fmt.Errorf("access defined: %v: %w", name, ErrPermission)
....
if errors.Is(err, ErrPermission) {

}
```

#### Is/As 实现
Is/As 的实现并不复杂:

```go
package errors

import (
	"internal/reflectlite"
)

// Unwrap returns the result of calling the Unwrap method on err, if err's
// type contains an Unwrap method returning error.
// Otherwise, Unwrap returns nil.
func Unwrap(err error) error {
	u, ok := err.(interface {
		Unwrap() error
	})
	if !ok {
		return nil
	}
	return u.Unwrap()
}


func Is(err, target error) bool {
	if target == nil {
		return err == target
	}

	isComparable := reflectlite.TypeOf(target).Comparable()
	for {
		if isComparable && err == target {
			return true
		}
    // 自定义 error 如果实现了 Is 方法可以，实现自定义的 Is 错误判定逻辑
		if x, ok := err.(interface{ Is(error) bool }); ok && x.Is(target) {
			return true
		}
    // 循环调用 Unwrap 方法获取根因
		if err = Unwrap(err); err == nil {
			return false
		}
	}
}


func As(err error, target any) bool {
	if target == nil {
		panic("errors: target cannot be nil")
	}
	val := reflectlite.ValueOf(target)
	typ := val.Type()
	if typ.Kind() != reflectlite.Ptr || val.IsNil() {
		panic("errors: target must be a non-nil pointer")
	}
	targetType := typ.Elem()
	if targetType.Kind() != reflectlite.Interface && !targetType.Implements(errorType) {
		panic("errors: *target must be interface or implement error")
	}
	for err != nil {
		if reflectlite.TypeOf(err).AssignableTo(targetType) {
			val.Elem().Set(reflectlite.ValueOf(err))
			return true
		}
		if x, ok := err.(interface{ As(any) bool }); ok && x.As(target) {
			return true
		}
		err = Unwrap(err)
	}
	return false
}

var errorType = reflectlite.TypeOf((*error)(nil)).Elem()

```

自定义 error 如果实现了 Is 方法可以，实现自定义的 Is 错误判定逻辑，比如像下面这样:

```go
type MeError struct {
  Name string
  Path string
}

func (e *Merror) Is(target error) bool {
  t, ok := target.(*MeError)
  if !ok {
    return False
  }
  return e.User == t.User
}
```

虽然 go errors 标准库实现了错误包装的功能，但是不支持获取堆栈信息。同时在 go13 发布之后，github.com/pkg/errors 也兼容了 go13 这种 Unwrap 处理方式。所以目前我们还是要继续使用 github.com/pkg/errors。

```go
// +build go1.13

package errors

import (
	stderrors "errors"
)


func Is(err, target error) bool { return stderrors.Is(err, target) }


func As(err error, target interface{}) bool { return stderrors.As(err, target) }


func Unwrap(err error) error {
	return stderrors.Unwrap(err)
}

// Unwrap provides compatibility for Go 1.13 error chains.
type withMessage struct {
	cause error
	msg   string
}

func (w *withMessage) Unwrap() error { return w.cause }
```

### 2.7 错误处理的总结
Go社区中关于如何进行错误处理的讨论有很多，但唯一正确的结论是没有哪一种错误处理策略适用于所有项目或场合。综合上述的构造错误值方法及错误处理策略，请记住如下几点：
1. 尽量使用透明错误处理策略降低错误处理方与错误值构造方之间的耦合；
2. 如果可以通过错误值类型的特征进行错误检视，那么尽量使用错误行为特征检视策略；
3. 在上述两种策略无法实施的情况下，再用“哨兵”策略和错误值类型检视策略；
4. 在Go 1.13及后续版本中，尽量用errors.Is和errors.As方法替换原先的错误检视比较语句。

## 3. Go 的异常处理
Go的正常错误处理与异常处理之间是泾渭分明的，这与其他主流编程语言使用结构化错误处理统一处理错误与异常是两种不同的理念。Go提供了panic专门用于处理异常。

panic是一个Go内置函数，它用来停止当前常规控制流并启动panicking过程。当函数F调用panic函数时，函数F的执行停止，函数F中已进行了求值的defer函数都将得到正常执行，然后函数F将控制权返还给其调用者。对于函数F的调用者而言，函数F之后的行为就如同调用者调用的函数是panic一样，该panicking过程将继续在栈上进行下去，直到当前goroutine中的所有函数都返回为止，此时程序将崩溃退出。

在Go中，panic则是“不得已而为之”，即所有引发panic的情形，无论是显式的（我们主动调用panic函数引发的）还是隐式的（Go运行时检测到违法情况而引发的），都是我们不期望看到的。对这些引发的panic，我们很少有预案应对，更多的是让程序快速崩溃掉。因此一旦发生panic，就意味着我们的代码很大可能出现了bug。

使用recover可以捕获panic，防止goroutine意外退出

```go
func (s *ss) Token(skipSpace bool, f func(rune) bool) (tok []byte, err error) {
    defer func() {
        if e := recover(); e != nil {
            if se, ok := e.(scanError); ok {
                err = se.err
            } else {
                panic(e)
            }
        }
    }()
    if f == nil {
        f = notSpace
    }
    s.buf = s.buf[:0]
    tok = s.token(skipSpace, f)
    return
}

```