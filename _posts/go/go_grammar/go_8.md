---
title: 8 go 的委托模式
date: 2019-01-08
categories:
    - Go
tags:
    - go语言入门
---

Go 接口的应用
<!-- more -->

![Hello World](/images/go/grammar/go_func.jpg)


## 接口的值
### 接口赋值
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

通常在编译期，我们不知道接口值的动态类型是什么，所以一个接口上的调用必须使用动态分配。

**`w = nil`**
这个重置将它所有的部分都设为nil值，把变量w恢复到和它之前定义时的状态。

一个接口值可以持有任意大的动态值。从概念上讲，不论接口值多大，动态值总是可以容下它。（这只是一个概念上的模型；具体的实现可能会非常不同）

### 接口比较
接口值可以使用`==`和`!＝`来进行比较。两个接口值相等仅当它们都是nil值或者它们的动态类型相同并且动态值也根据这个动态类型的＝＝操作相等。因为接口值是可比较的，所以它们可以用在map的键或者作为switch语句的操作数。

然而，如果两个接口值的动态类型相同，但是这个动态类型是不可比较的（比如切片），将它们进行比较就会失败并且panic:
```Go
var x interface{} = []int{1, 2, 3}
fmt.Println(x == x) // panic: comparing uncomparable type []int
```

考虑到这点，接口类型是非常与众不同的。其它类型要么是安全的可比较类型（如基本类型和指针）要么是完全不可比较的类型（如切片，映射类型，和函数），但接口的可比性取决接口包含的动态类型。但是在比较接口值或者包含了接口值的聚合类型时，我们必须要意识到潜在的panic。同样的风险也存在于使用接口作为map的键或者switch的操作数。只能比较你非常确定它们的动态值是可比较类型的接口值。

通过 fmt包的`%T` 动作，我们可以获取接口值的动态类型，在fmt包内部，使用反射来获取接口动态类型的名称。关于反射，我们后在在详述。

```Go
var w io.Writer
fmt.Printf("%T\n", w) // "<nil>"
w = os.Stdout
fmt.Printf("%T\n", w) // "*os.File"
w = new(bytes.Buffer)
fmt.Printf("%T\n", w) // "*bytes.Buffer"
```

## 类型断言
类型断言是我们使用 Go 语言中接口的另一种方式。前面的第一个方式中，一个接口的方法表达了实现这个接口的具体类型间的相似性，但是隐藏了代表的细节和这些具体类型本身的操作。重点在于方法上，而不是具体的类型上。

类型断言属于第二个方式，即利用一个接口值可以持有各种具体类型值的能力并且将这个接口认为是这些类型的 union（联合）。类型断言用来动态地区别出接口包含的每一个类型，做不同处理。在这个方式中，重点在于具体的类型满足这个接口，而不是在于接口的方法（如果它确实有一些的话），并且没有任何的信息隐藏。我们将以这种方式使用的接口描述为discriminated unions（可辨识联合）。

### 语法
`x.(T)`:
1. 如果断言的类型T是一个具体类型，然后类型断言检查x的动态类型是否和T相同
2.

```Go
//
var w io.Writer
w = os.Stdout
rw := w.(io.ReadWriter) // success: *os.File has both Read and Write
w = new(ByteCounter)
rw = w.(io.ReadWriter) // panic: *ByteCounter has no Read method

//
var w io.Writer = os.Stdout
f, ok := w.(*os.File) // success: ok, f == os.Stdout
b, ok := w.(*bytes.Buffer) // failure: !ok, b == nil
```

如果断言操作的对象是一个nil接口值，那么不论被断言的类型是什么这个类型断言都会失败。我们
几乎不需要对一个更少限制性的接口类型（更少的方法集合）做断言，因为它表现的就像赋值操作
一样，除了对于nil接口值的情况。

```
w = rw // io.ReadWriter is assignable to io.Writer
w = rw.(io.Writer) // fails only if rw == nil
```

```Go
if w, ok := w.(*os.File); ok {
// ...use w...
}
```
需要注意的是，if 引出了新的作用域，因此这里发生的是对 变量名的重新，发生了变量的覆盖，不是变量的重新赋值。这个在第一篇文章就说过，自己看到这困惑了下，所以写了出来。

## 作用
基于类型断言区别错误类型
通过类型断言询问行为

## 类型开关

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

一个类型开关像普通的switch语句一样，它的运算对象是x.(type)－它使用了
关键词字面量type－并且每个case有一到多个类型。一个类型开关基于这个接口值的动态类型使一
个多路分支有效。

，类型开关语句有一个扩展的形式，它可以将提取的值绑定到一个在每个case范围内的
新变量。

`switch x := x.(type) { /* ... */ }`

在这个版本的函数中，在每个单一类型的case内部，变量x和这个case的类型相同。例如，变量x
在bool的case中是bool类型和string的case中是string类型。在所有其它的情况中，变量x是switch
运算对象的类型（接口）；在这个例子中运算对象是一个interface{}。当多个case需要相同的操作
时，比如int和uint的情况，类型开关可以很容易的合并这些情况。
