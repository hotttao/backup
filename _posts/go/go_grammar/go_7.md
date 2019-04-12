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

## 1. 接口概述
接口是 Go 语言提供的泛型的核心概念。所谓泛型就是允许程序员在强类型程序设计语言中编写代码时使用一些以后才指定的类型，目的是增加函数的通用性。当然我们没必要去纠结概念，最重要的是搞明白，Go 如何通过接口来提高程序的灵活性。

在学习接口之前，我们需要对它有如下一个整体的认识，以把握住接口的整体脉络:
1. Go 的接口类型是抽象类型，与 Python 中鸭子类型类似，通过类型支持的方法来约束对象的适用范围。我们将学些如何在 Go 定义接口，如何判断一个具体类型实现了哪些接口。
2. 接口不仅是对类型的抽象和限定，也代表了将接口作为参数的函数和函数调用者之间的一个约定(正是通过这种约定提高了函数的可用性):
	- 调用者需要提供符合接口的具体类型作为参数
	- 函数在接受任何满足接口的值时都可以工作，函数不会调用接口限定之外的任何其他方法

有了上面的铺垫，我们将按照下面的顺序介绍接口的相关内容:
1. 接口类型
	- 接口的定义
	- 接口归属判断
	- 接口的约定
2. 接口值
3. 类型断言

## 2. 接口类型
### 2.1 接口定义
接口类型是一种抽象的类型，与字符串，整数这些具体类型相比，我们并不知道接口类型代表的具体值；它只包含方法声明，描述了一系列方法的集合。下面是 Go 接口类型的定义示例: 

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

与结构体嵌入类似，我们也可以通过类似的方式进行接口内嵌，实现接口组合。在接口的定义中方法的定义顺序没有影响，唯一重要的是接口内的方法集合。

### 2.2 接口归属判断
如果一个类型拥有一个接口需要的所有方法，那么这个类型就实现了这个接口，我们称这个具体类型是这个接口类型的实例。正如我们在 go 方法一章所描述的，一个自定义数据类型的方法集合中仅会包含它的所有值方法，而该类型的指针类型的方法集合却囊括了所有值方法和所有指针方法。因此对于一个自定义类型，他的类型和他的指针类型实现的接口并不相同。

```Go
// 1. 表达一个类型属于某个接口只要这个类型实现这个接口
var rwc io.ReadWriteCloser
rwc = os.Stdout         // OK: *os.File has Read, Write, Close methods
rwc = new(bytes.Buffer) // compile error: *bytes.Buffer lacks Close method

// 2. 接口归属的判断同样适合接口之间
w = rwc   // OK: io.ReadWriteCloser has Write method
rwc = w   // compile error: io.Writer lacks Close method

// 3. 类型 与 类型的指针类型，实现的接口并不相同，后者可能实现了更多的接口
type IntSet struct { /* ... */ }
func (*IntSet) String() string
var _ fmt.Stringer = &s // OK
var _ fmt.Stringer = s // compile error: IntSet lacks String method
```

每一个具体类型的组基于它们相同的行为可以表示成一个接口类型。接口不止是一种有用的方式来分组相关的具体类型和表示他们之间的共同特定。在Go语言中我们可以在需要的时候定义一个新的抽象或者特定特点的组，而不需要修改具体类型的定义。

### 2.3 接口的约定
正如我们开篇所说的，接口类型不仅是对类型的约束，也代表着函数和调用者之间的约定。

```Go
type Writer interface {
	Write(p []byte) (n int, err error)
}

func Fprintf(w io.Writer, format string, args ...interface{}) (int, error)

type ByteCounter int
func (c *ByteCounter) Write(p []byte) (int, error) {
	*c += ByteCounter(len(p)) // convert int to ByteCounter
	return len(p), nil
}

var c ByteCounter
c.Write([]byte("hello"))
fmt.Println(c)           // "5", = len("hello")
c = 0                    // reset the counter

var name = "Dolly"
fmt.Fprintf(&c, "hello, %s", name)
fmt.Println(c) // "12", = len("hello, Dolly")
```

如上例所述，`io.Writer` 接口约定了，函数调用者必须提供实现了 `io.Writer` 接口的具体类型作为函数参数，而 `Fprintf` 函数只能调用 `io.Writer` 接口暴露出来的方法，即使具体类型有其它的方法也不能调用。

### 2.4 空接口
`interface{}`被称为空接口，空接口类型是不可或缺的。因为空接口类型对实现它的类型没有要求，所以我们可以将任意一个值赋给空接口类型。当然我们不能直接对它持有的值做操作，因为`interface{}`没有任何方法。我们会在稍后介绍一种用类型断言来获取`interface{}`中值的方法。

```Go
var any interface{}
any = true
any = 12.34
any = "hello"
any = map[string]int{"one": 1}
any = new(bytes.Buffer)
```


## 3. 接口的值
### 3.1 接口赋值
概念上讲一个接口的值，由两个部分组成，一个具体的类型和那个类型的值。它们被称为接口的动态类型和动态值。对于像Go语言这种静态类型的语言，类型是编译期的概念；因此一个类型不是一个值。在我们的概念模型中，一些提供每个类型信息的值被称为类型描述符，比如类型的名称和方法。在一个接口值中，类型部分代表与之相关类型的描述符。

我们通过下面一个赋值的示例来了解接口的值

```Go
var w io.Writer
w = os.Stdout
w = new(bytes.Buffer)
w = nil
```

**`var w io.Writer`**
定义了变量w，变量总是被一个定义明确的值初始化，即使接口类型也不例外。对于一个接口的零值就是它的类型和值的部分都是nil。一个接口值仅基于**它的动态类型**被描述为空或非空，因此一个不包含任何值的nil接口值和一个刚好包含nil指针的接口值是不同的，后者不为 nil。

![Hello World](/images/go/grammar/interface_nil.png)

你可以通过使用`w==nil`或者`w!=nil`来判读接口值是否为空。调用一个空接口值上的任意方法都会产生panic。调用一个包含 nil 指针的接口上的方法是否会报错，取决于接口内包含的动态类型。

```Go
// w，f 都是特定类型的空值，将他们赋值给 w 都将得到一个  包含nil指针的接口值
var w io.Writer
var f *os.File
var buf *bytes.Buffer

// 对 *os.File的类型，nil是一个有效的接收者，所以不会报错
w = f       
w.Writer()

// (*bytes.Buffer).Write方法的接收者必须非空，调用会报错
w = buf
buf，Writer()
```

**`w = os.Stdout`**
这个赋值过程调用了一个具体类型到接口类型的隐式转换，这和显式的使用`io.Writer(os.Stdout)`是等价的。此时这个接口值的动态类型被设为`*os.File`指针的类型描述符，它的动态值持有`os.Stdout`的拷贝；

![Hello World](/images/go/grammar/interface_file.png)


**`w = nil`**
这个重置将它所有的部分都设为nil值，把变量w恢复到和它之前定义时的状态。

一个接口值可以持有任意大的动态值。从概念上讲，不论接口值多大，动态值总是可以容下它。（这只是一个概念上的模型；具体的实现可能会非常不同）

### 3.2 接口比较
接口值可以使用`==`和`!＝`来进行比较。两个接口值相等仅当它们都是nil值或者它们的动态类型相同并且动态值也根据这个动态类型的`==`操作相等。因为接口值是可比较的，所以它们可以用在map的键或者作为switch语句的操作数。

然而，如果两个接口值的动态类型相同，但是这个动态类型是不可比较的（比如切片），将它们进行比较就会失败并且panic:

```Go
var x interface{} = []int{1, 2, 3}
fmt.Println(x == x) // panic: comparing uncomparable type []int
```

考虑到这点，接口类型是非常与众不同的。其它类型要么是安全的可比较类型（如基本类型和指针）要么是完全不可比较的类型（如切片，映射类型，和函数），但接口的可比性取决接口包含的动态类型。但是在比较接口值或者包含了接口值的聚合类型时，我们必须要意识到潜在的panic。同样的风险也存在于使用接口作为map的键或者switch的操作数。只能比较你非常确定它们的动态值是可比较类型的接口值。

通过 fmt包的`%T` 动作，我们可以获取接口值的动态类型，在fmt包内部，使用反射来获取接口动态类型的名称。关于反射，我们后面在详述。

```Go
var w io.Writer
fmt.Printf("%T\n", w) // "<nil>"
w = os.Stdout
fmt.Printf("%T\n", w) // "*os.File"
w = new(bytes.Buffer)
fmt.Printf("%T\n", w) // "*bytes.Buffer"
```

## 4. 类型断言
类型断言是我们使用 Go 语言中接口的另一种方式。前面的第一个方式中，一个接口的方法表达了实现这个接口的具体类型间的相似性，但是隐藏了代表的细节和这些具体类型本身的操作。重点在于方法上，而不是具体的类型上。

第二种使用方式利用了一个接口值可以持有各种具体类型值的能力并且将这个接口认为是这些类型的 union（联合）。类型断言用来动态地区别出接口包含的每一个类型，做不同处理。在这个方式中，重点在于具体的类型满足这个接口，而不是在于接口的方法（如果它确实有一些的话），并且没有任何的信息隐藏。我们将以这种方式使用的接口描述为discriminated unions（可辨识联合）。

通过类型断言，我们至少可以实现下面这些目标:
1. 区别错误类型
2. 判断对象是否支持特定的方法


### 4.1 语法
`x.(T)`:
1. x - 表示待判断的接口类型，T - 表示断言的类型 
1. 如果 T 是一个具体类型，类型断言检查 x 的动态类型是否和T相同，相同，返回 x 的动态值
2. 如果 T 是一个接口类型，类型断言检查 x 的动态类型是否满足T，满足，返回包含 x 动态类型和动态值的接口 T 的值

```Go
// 具体类型断言
var w io.Writer
w = os.Stdout
rw := w.(io.ReadWriter) // success: *os.File has both Read and Write
w = new(ByteCounter)    
rw = w.(io.ReadWriter) // panic: *ByteCounter has no Read method， 断言失败触发 panic

// 接口类型断言
var w io.Writer = os.Stdout
f, ok := w.(*os.File) // success: ok, f == os.Stdout
b, ok := w.(*bytes.Buffer) // failure: !ok, b == nil

// 通过第二个变量接受断言是否成功，替代断言失败时的异常
if w, ok := w.(*os.File); ok {  // if 引出了新的作用域，因此这里发生的是对变量名的重新，发生了变量的覆盖，不是变量的重新赋值。
// ...use w...
}
```

换句话说，对一个接口类型的断言改变了类型的表述方式，改变了可以获取的方法集合（通常更大），我们几乎不需要对一个更少限制性的接口类型（更少的方法集合）做断言，因为它表现的就像赋值操作一样，除了对于nil接口值的情况。如果断言操作的对象是一个nil接口值，那么不论被断言的类型是什么这个类型断言都会失败。

```
// 对更小的接口无需断言，可直接赋值
w = rw // io.ReadWriter is assignable to io.Writer
w = rw.(io.Writer) // fails only if rw == nil
```

## 4.2 类型开关
类型断言有一个 Switch 的便捷语法，称为类型开关，一个类型开关像普通的switch语句一样，它的运算对象是`x.(type)`－它使用了关键词字面量`
type`－并且每个case有一到多个类型。一个类型开关基于这个接口值的动态类型使一个多路分支有效。一个使用示例如下所示:

```Go
func sqlQuote(x interface{}) string {
  switch x := x.(type) {
  case nil:
    return "NULL"
  case int, uint:
    return fmt.Sprintf("%d", x) // x has type interface{} here.
  case bool:
    if x {
      return "TRUE"
    }
    return "FALSE"
  case string:
    return sqlQuoteString(x) // (not shown)
  default:
    panic(fmt.Sprintf("unexpected type %T: %v", x, x))
  }
}
```

这个示例还展示了，类型开关语句的一个扩展的形式，它可以将提取的值绑定到一个在每个case范围内的新变量 `switch x := x.(type) { /* ... */ }`。在这个版本的函数中，在每个单一类型的case内部，变量`x`和这个case的类型相同。例如:
- 变量 x 在bool的case中是bool类型和string的case中是string类型
- 在所有其它的情况中，变量x是 switch 运算对象的类型（接口）；在这个例子中运算对象是一个interface{}
- 当多个 case 需要相同的操作时，比如int和uint的情况，类型开关可以很容易的合并这些情况
