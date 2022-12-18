---
weight: 1
title: "Go 声明、类型与初始化"
date: 2022-12-15T20:00:00+08:00
lastmod: 2022-12-15T20:00:00+08:00
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
 今天我们开始深入学习，Go 语言语法的基础: Go 声明、类型、初始化。
<!-- more -->

## 1. 变量声明
Go语言沿袭了静态编译型语言的传统：使用变量之前需要先进行变量的声明。Go语言有两类变量。
1. 包级变量（package variable）：在package级别可见的变量。如果是导出变量，则该包级变量也可以被视为全局变量，包级变量只能使用带有var关键字的变量声明形式
2. 局部变量（local variable）：函数或方法体内声明的变量，仅在函数或方法体内可见

Go 为这两种变量提供了两种不同的声明方式: var 关键字和短变量声明的方式。加上 var 声明块，Go 语言就有了多种命名变量的方式:

```go
var a int32
var s string = "hello"
var i = 13
n := 17
var (
    crlf       = []byte("\r\n")
    colonSpace = []byte(": ")
)
```

虽然声明多样，但是我们应尽量保持项目范围内一致。

### 1.1 var 声明
首先标准的 var 声明语法是这样的: `var variableName [type] [= InitExpression]`。type、InitExpression 可以省略就有了如下 var 声明的组合:

||无InitExpression|常量InitExpression|带类型信息的InitExpression|
|:---|:---|:---|:---|
|有type|变量 = type 类型的零值|变量 = type(常量)|变量 = type(类型常量)|
|无type|错误|变量的 type = 常量表达式的默认类型|变量 type = 常量类型|

```go
// 以整型值初始化的变量a，Go编译器会将之设置为默认类型int；
// 以浮点值初始化的变量f，Go编译器会将之设置为默认类型float64。
var a = 17
var f = 3.14
```

### 1.2 声明聚类
go 在提供 var 声明的同时，还提供了提供var块用于将多个变量声明语句放在一起。我们一般
1. 将同一类的变量声明放在一个var块中
2. 将不同类的声明放在不同的var块中；
3. 将延迟初始化的变量声明放在一个var块，而将声明并显式初始化的变量放在另一个var块中

目的是显而易见的，通过显示的代码块，让变量分门别类的聚合在一起。为了让声明更加规整，go 更推荐下面这种指定类型的声明方式:

```go
// 要显式为包级变量a和f指定类型
// 推荐:
var (
    a = 17
    f = float32(3.14)
)

// 不推荐:
var (
    a  = 17
    f float32 = 3.14
)
```

### 1.3 短变量声明
短变量声明只能用在局部变量上，以下场景更推荐短变量
1. 显式初始化的局部变量
3. 分支控制时使用的局部变量

```go
func (v *Buffers) WriteTo(w io.Writer) (n int64, err error) {
    // 显示初始化
    value := 10
    // 在if循环控制语句中使用短变量声明形式
    if wv, ok := w.(buffersWriter); ok {
        return wv.writeBuffers(v)
    }
    // 在for条件控制语句中使用短变量声明形式
    for _, b := range *v {
        nb, err := w.Write(b)
        n += int64(nb)
        if err != nil {
            v.consume(n)
            return n, err
        }
    }
    v.consume(n)
    return n, nil
}
```

以下场景则更推荐 var 声明:
1. 延迟初始化的局部变量
4. 要声明的变量很多，适合聚类时，应该使用var块来声明多个局部变量

```go

func Foo() {
    // 延迟初始化的局部变量
    var err error
    defer func() {
        if err != nil {
            ...
        }
    }()

    err = Bar()
```

## 2. 无类型常量
首先我们来看一下什么叫无类型常量。

```go
// 1. 形如下面，用在等号右边的，叫做字面量
"我是中国人"
1
3.14

// 2. 使用 var 关键字声明的叫变量
var a int = 10 // 这是有类型变量
var a = 10 // 这是无类型变量，无类型变量会赋予字面量的默认类型

// 3. 使用 const 关键字声明的，带类型的叫有类型常量
const b int = 30

// 4. 使用 const 关键字声明的，不带类型的叫无类型常量
const c = 40
```

Go是对类型安全要求十分严格的编程语言。Go要求:
1. 两个类型即便拥有相同的底层类型（underlying type），也仍然是不同的数据类型，不可以被相互比较或混在一个表达式中进行运算，即不支持隐式的类型转换。
2. 而将 **有类型常量** 与变量混合在一起进行运算求值时也要遵循这一要求，即如果有类型常量与变量的类型不同，那么混合运算的求值操作会报错。

```go
type myInt int

func main() {
    var a int = 5
    var b myInt = 6
    fmt.Println(a + b) // 编译器会给出错误提示：invalid operation: a + b (mismatched  types int and myInt)
}
```

Go 中真正特殊的是无类型常量，Go的无类型常量拥有像字面值的特性:
1. 使得无类型常量在参与变量赋值和计算过程时**无须显式类型转换**
2. 拥有和字面量一样的**默认类型**：无类型的布尔型常量、整数常量、字符常量、浮点数常量、复数常量、字符串常量对应的默认类型分别为bool、int、int32(rune)、float64、complex128和string
3. 数值型无类型常量可以提供比基础类型更高精度的算术运算，至少有256 bit的运算精度。

在给无类型变量、接口变量赋值时，无类型常量和字面量的默认类型对于确定无类型变量的类型及接口对应的动态类型是至关重要的。

```go
type myInt int
type myFloat float32
type myString string

const (
    a  = 5
    pi = 3.1415926
    s  = "Hello, Gopher"
)

func main() {
    var j myInt = 5
    var f myFloat = 3.1415926
    var str myString = "Hello, Gopher"

    fmt.Println(j)    // 输出：5
    fmt.Println(f)    // 输出：3.1415926
    fmt.Println(str)  // 输出：Hello, Gopher
    // 字面量无需显示的类型转换，不必像下面这样
    var j myInt = myInt(5)
    var f myFloat = myFloat(3.1415926)
    var str myString = myString("Hello, Gopher")
    
    // 无类型常量，也无需显示类型转换
    var j myInt = a
    var f myFloat = pi
    var str myString = s
    var e float64 = a + pi // 注意 a 和 pi 属于混合数据类型
}
```

## 3. iota实现枚举常量
首先 Go 的 const 语法提供了“隐式重复前一个非空表达式”的机制。

```go
const (
    Apple, Banana = 11, 22
    Strawberry, Grape
    Pear, Watermelon
)

// 等同于

const (
    Apple, Banana = 11, 22
    Strawberry, Grape  = 11, 22
    Pear, Watermelon  = 11, 22
)
```

更高级的是使用 iota。iota 是 Go语言的一个预定义标识符，它表示的是const声明块（包括单行声明）中每个常量所处位置在块中的偏移值（从零开始）。同时，**每一行中的iota自身也是一个无类型常量，可以像无类型常量那样自动参与不同类型的求值过程，而无须对其进行显式类型转换操作**。

从实现上更容易看出来 iota 到底是个什么东西。

### 3.1 实现原理
在编译器代码中，每个常量或者变量的声明语句使用 ValueSpec 结构表示，ValueSpec 定义在 `src/go/ast/ast.go` 

```go
	ValueSpec struct {
		Doc     *CommentGroup // associated documentation; or nil
		Names   []*Ident      // value names (len(Names) > 0)
		Type    Expr          // value type; or nil
		Values  []Expr        // initial values; or nil
		Comment *CommentGroup // line comments; or nil
	}
```

ValueSpec 仅表示一行声明语句，比如:

```go
const (
	// 常量块注释
	a, b = iota, iota // 常量行注释
)
```

上面的常量声明中仅包括一行声明语句，对应一个 ValueSpec 结构:
1. Doc: 表示注释
2. Name: 常量的名字，使用切片表示当行语句中声明的多个变量
3. Type: 常量类型
4. Value: 常量值
5. Comment: 常量行注释

如果 const 包含多行常量声明，就会对应多个 ValueSpec，编译器在遍历时会使用类似下面的伪代码:

```go
for iota, spec := range ValueSpecs {
	for i, name := range spec.Names }{
		obj := NewConst(name, iota)
	}
}
```

从上面的代码就可以看出，iota 的本质: 仅代表常量声明的索引。

### 3.2 iota 的使用
借助 iota 我们可以实现更灵活的枚举常量定义。

```go
const (
    mutexLocked = 1 << iota  //1 = 1 << 0
    // “隐式重复前一个非空表达式”
    mutexWoken               //2 = 1 << 1
    mutexStarving            //4 = 1 << 2
    mutexWaiterShift = iota  //3 = 3  
    starvationThresholdNs = 1e6
)

// 位于同一行的iota即便出现多次，其值也是一样的：
const (
    Apple, Banana = iota, iota + 10 // 0, 10 (iota = 0)
    Strawberry, Grape               // 1, 11 (iota = 1)
    Pear, Watermelon                // 2, 12 (iota = 2)
)

// 如果要定义非连续枚举值
const (
    _ = iota                        // 0
    Pin1
    Pin2
    Pin3
    _                               // 相当于_ = iota，略过了4这个枚举值
    Pin5                            // 5
)

// 枚举常量多数是无类型常量，如果要严格考虑类型安全，也可以定义有类型枚举常量
type Weekday int

const (
    Sunday Weekday = iota
    // “隐式重复前一个非空表达式”，下面常量都是 Weekday 类型
    Monday
    Tuesday
    Wednesday
    Thursday
    Friday
    Saturday
)
```    

## 4. 零值可用类型
定义零值可用的类型是Go语言积极倡导的最佳实践之一。首先我们来看什么是零值。

### 4.1 零值
所谓零值，就是未对变量进行显示初始化时，变量会被赋予的默认值。当通过声明或调用new为变量分配存储空间，或者通过复合文字字面量或调用make创建新值，且不提供显式初始化时，Go会为变量或值提供默认值。

Go语言中的每个原生类型都有其默认值，这个默认值就是这个类型的零值。
1. 所有整型类型：0
2. 浮点类型：0.0
3. 布尔类型：false
4. 字符串类型：""
5. 指针、interface、切片（slice）、channel、map、function：nil

另外，Go的零值初始是递归的，即数组、结构体等类型的零值初始化就是对其组成元素逐一进行零值初始化。

而所谓零值可用，就是变量未显示初始化被赋予的默认值是可以操作的，包括调用它的自定义方法。

```go
var zeroSlice []int
zeroSlice = append(zeroSlice, 1)

```

我们声明了一个[]int类型的切片zeroSlice，但并没有对其进行显式初始化，这样zeroSlice这个变量就被Go编译器置为零值nil。由于Go中的切片类型具备零值可用的特性，我们可以直接对其进行append操作，而不会出现引用nil的错误。

零值可用自定义类型示例，可以参考 sync.Mutex和bytes.Buffer

```go
var mu sync.Mutex
mu.Lock()
mu.Unlock()

func main() {
    var b bytes.Buffer
    b.Write([]byte("Effective Go"))
    fmt.Println(b.String()) // 输出：Effective Go
}

// $GOROOT/src/bytes/buffer.go
type Buffer struct {
    buf      []byte  // 字段buf支持零值可用策略的切片类型
    off      int
    lastRead readOp
}
```

不过Go并非所有类型都是零值可用的，并且零值可用也有一定的限制

```go
// 在append场景下，零值可用的切片类型不能通过下标形式操作数据：
s[0] = 12         // 报错！
s = append(s, 12) // 正确

// map 这样的原生类型也没有提供对零值可用的支持：
var m map[string]int
m["go"] = 1 // 报错！

m1 := make(map[string]int)
m1["go"] = 1 // 正确

// 零值可用的类型要注意尽量避免值复制：
var mu sync.Mutex
mu1 := mu // 错误: 避免值复制
foo(mu) // 错误: 避免值复制
```

持与Go一致的理念，给自定义的类型一个合理的零值，并尽量保持自定义类型的零值可用，这样我们的Go代码会更加符合Go语言的惯用法。这就要求我们，当我们为自定义类型添加各种方法时，都需要判断当前操作在当前状态下是不是是可执行的。比如:

```go
package algo

type Product struct {
	Name       string
	Attributes map[string]string
}

func (p *Product) AddAttr(attr, value string) {
	if p.Attributes == nil {
		p.Attributes = make(map[string]string)
	}
	p.Attributes[attr] = value
}

var p Product
p.AddAttr("color", "red")
```

为了保证自定义类型 Product 是零值可用的，我们在 AddAttr 方法中，必须判断其 Attributes 字段是否已经初始化，否则 Product 就会因为默认的 map 类型不支持零值可用导致，Product 本身不支持零值可用。

## 5. 复合字面值
Go提供的复合字面值（composite literal）语法可以作为复合类型变量的初值构造器。合字面值由两部分组成：**一部分是类型，另一部分是由大括号{}包裹的字面值**。比如:

```go
a := [5]int{13, 14, 15, 16, 17}
m := map[int]string {1:"hello", 2:"gopher", 3:"!"}
```

Go 的复合字面值还有一些高级用法。

### 5.1 结构体复合字面值
go vet工具中内置了一条检查规则：composites。此规则用于检查源码中使用复合字面值对结构体类型变量赋值的行为。

如果源码中使用了从另一个包中导入的struct类型，但却未使用field:value形式的初值构造器，则该规则认为这样的复合字面值是脆弱的。因为一旦该结构体类型增加了一个新的字段，即使是未导出的，这种值构造方式也将导致编译失败。

显然，Go推荐使用field:value的复合字面值形式对struct类型变量进行值构造:

```go
// $GOROOT/src/net/http/transport.go
var DefaultTransport RoundTripper = &Transport{
    Proxy: ProxyFromEnvironment,
    DialContext: (&net.Dialer{
        Timeout:   30 * time.Second,
        KeepAlive: 30 * time.Second,
        DualStack: true,
    }).DialContext,
    MaxIdleConns:          100,
    IdleConnTimeout:       90 * time.Second,
    TLSHandshakeTimeout:   10 * time.Second,
    ExpectContinueTimeout: 1 * time.Second,
}

```

复合字面值作为结构体值构造器的大量使用，使得即便采用类型零值时我们也会使用字面值构造器形式，而较少使用new这一个Go预定义的函数来创建结构体变量实例：

```go
s := myStruct{} // 常用
s := new(myStruct) // 较少使用
```

### 5.2 数组/切片/map复合字面值
组/切片使用下标（index）作为field:value形式中的field，从而实现数组/切片初始元素值的高级构造形式：

```go
numbers := [256]int{'a': 8, 'b': 7, 'c': 4, 'd': 3, 'e': 2, 'y': 1, 'x': 5}

// [10]float{-1, 0, 0, 0, -0.1, -0.1, 0, 0.1, 0, -1}
fnumbers := [...]float{-1, 4: -0.1, -0.1, 7:0.1, 9: -1}
```

对于数组/切片类型而言，当元素为复合类型时，可以省去元素复合字面量中的类型：

```go
type Point struct {
    x float64
    y float64
}

sl := []Point{
    {1.2345, 6.2789}, // Point{1.2345, 6.2789}
    {2.2345, 19.2789}, // Point{2.2345, 19.2789}
}
```

对于 对于map类型（这一语法糖在Go 1.5版本中才得以引入），当key或value的类型为复合类型时，我们也可以省去key或value中的复合字面量中的类型：

```go
// Go 1.5及之后版本
m := map[Point]string{
    {29.935523, 52.891566}:   "Persepolis",
    {-25.352594, 131.034361}: "Uluru",
    {37.422455, -122.084306}: "Googleplex",
}
```

对于key或value为指针类型的情况，也可以省略“&T”：

```go
m2 := map[string]*Point{
    "Persepolis": {29.935523, 52.891566},   // 相当于value为&Point{29.935523, 52.891566}
    "Uluru":      {-25.352594, 131.034361}, // 相当于value为&Point{-25.352594, 131.034361}
    "Googleplex": {37.422455, -122.084306}, // 相当于value为&Point{37.422455, -122.084306}
}
```
