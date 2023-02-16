---
weight: 1
title: "Go unsafe包的安全使用模式"
date: 2023-01-09T22:00:00+08:00
lastmod: 2023-01-09T22:00:00+08:00
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

## 1. 类型安全
在Go语言中，我们是无法通过常规语法手段穿透Go在类型系统层面对内存数据的保护的：

```go
func main() {
    a := 0x12345678
    fmt.Printf("0x%x\n", a)

    var p *byte = (*byte)(&a)   // 错误！不允许将&a从*int类型显式转型为*byte类型
    *p = 0x23

    var b byte = byte(a)        // b是一个新变量，有自己所解释的内存空间
    b = 0x23                    // 即便强制进行类型转换，原变量a所解释的内存空间的数据依然不变
    fmt.Printf("0x%x\n", b)     // 0x23
    fmt.Printf("0x%x\n", a)     // 0x12345678
}
```

Go在常规操作下是类型安全的（注：并非绝对的类型安全，绝对的类型安全需要在数学上的形式化证明）。所谓类型安全是指一块内存数据一旦被特定的类型所解释（该内存数据与该类型变量建立关联，也就是变量定义），它就不能再被解释为其他类型，不能再与其他类型变量建立关联。

Go语言的类型安全是建立在Go编译器的静态检查以及Go运行时利用类型信息进行的运行时检查之上的。在语法层面，为了实现常规操作下的类型安全，Go对语法做了诸多限制。
1. 不支持隐式类型转换，所有类型转换必须显式进行
2. 只有底层类型（underlying type）相同的两个类型的指针之间才能进行类型转换
3. 不支持指针运算

```go
var i int = 17
var j uint64 = i             // 错误：int类型值不能直接赋值给uint64类型变量
var j uint64 = uint64(i)     // 没问题

var i int = 11
var p *uint64 = (*uint64)(&i)     // 错误：*int类型不能转换为*uint64类型
type MyInt int
var p *MyInt = (*MyInt)(&i)    // 没问题，MyInt的底层类型为int

// 不支持指针运算
var a [100]int
var p *int = &a[0]
*(p+1) = 10                    // 错误：*int类型与int类型无法相加，即不能跨越数组元素的边界
```

但是为了兼容性能以及如何实现与操作系统、C代码等互操作的低级代码等问题。最终，Go语言的设计者们选择了在类型系统上开一道“后门”的方案，即在标准库中内置一个特殊的Go包——unsafe包。使用unsafe包我们可以实现性能更高、与底层系统交互更容易的低级代码，但unsafe包的存在也让我们有了绕过Go类型安全屏障的“路径”。一旦使用该包不当，便可能会导致引入安全漏洞、引发程序崩溃（panic）等问题。为此，Go设计者们明确了unsafe包的安全使用模式。


## 2. unsafe 包使用
### 2.1 unsafe 包接口
unsafe包非常简洁:

```go
// $GOROOT/src/unsafe/unsafe.go
package unsafe
func Alignof(x ArbitraryType) uintptr
func Offsetof(x ArbitraryType) uintptr
func Sizeof(x ArbitraryType) uintptr
type ArbitraryType int
type Pointer *ArbitraryType
```

unsafe包定义了一个类型和三个函数:
1. ArbitraryType并不真正属于unsafe包，我们在Go代码中并**不能使用ArbitraryType来定义变量，它表示一个任意表达式的类型**，仅用于文档目的，Go编译器会对其做特殊处理。
2. Alignof、Offsetof和Sizeof这三个函数的使用是绝对安全的，这三个函数的有两个共同点:
    - 接受的参数都是一个表达式（x ArbitraryType），而不是一个类型，ArbitraryType表示任意表达式的类型
    - 返回值都是uintptr类型。之所以使用uintptr类型而不用uint64等整型类型，主要是因为这三个函数更多应用于有unsafe.Pointer和uintptr类型参与的指针运算，采用uintptr作为返回值类型可以减少指针运算表达式中的显式类型转换。

#### Sizeof
Sizeof用于获取一个表达式值的大小:

```go
var i int = 5

fmt.Println(unsafe.Sizeof(i))               // 8
fmt.Println(unsafe.Sizeof((*int)(nil)))     // 8
```

Sizeof函数不支持直接传入无类型信息的nil值，我们必须显式告知Sizeof传入的nil究竟是什么类型，要么像上面代码那样进行显式转型，要么传入一个值为nil但类型明确的变量，比如var p *int = nil。

#### Alignof
Alignof用于获取一个表达式的内存地址对齐系数。不同的计算机体系结构下，处理器对变量地址都有着对齐要求，即变量的地址必须可被该变量的对齐系数整除。

```go
var x unsafe.ArbitraryType // unsafe.ArbitraryType表示任意类型
b := uintptr(unsafe.Pointer(&x)) % unsafe.Alignof(x) == 0
fmt.Println(b) // true

fmt.Println(unsafe.Alignof(i))           // 8
fmt.Println(unsafe.Alignof(struct{}{}))  // 1 (注：空结构体的对齐系数为1)
fmt.Println(unsafe.Alignof([0]int{}))    // 8 (注：长度为0的数组，其对齐系数依然与其元素
                                         // 类型的对齐系数相同)
```

#### Offsetof
Offsetof用于获取结构体中某字段的地址偏移量（相对于结构体变量的地址）。Offsetof函数应用面较窄，仅用于求结构体中某字段的偏移值。

```go
fmt.Println(unsafe.Offsetof(f.b))     // 8
fmt.Println(unsafe.Offsetof(f.d))     // 40
```

### 2.2 unsafe.Pointer类型
unsafe包之所以被命名为unsafe，主要是因为该包中定义了unsafe.Pointer类型。

unsafe.Pointer可用于表示任意类型的指针，并且它具备下面四条其他指针类型所不具备的性质。
1. 任意类型的指针值都可以被转换为unsafe.Pointer。
2. unsafe.Pointer也可以被转换为任意类型的指针值。
3. uintptr类型值可以被转换为一个unsafe.Pointer。
4. unsafe.Pointer也可以被转换为一个uintptr类型值。

```go
var a int = 5
var b  float64= 5.89
var arr [10]string
var f Foo
// 1. 任意类型的指针值都可以被转换为unsafe.Pointer
p1 := (unsafe.Pointer)(&a)     // *int -> unsafe.Pointer
p2 := (unsafe.Pointer)(&b)     // *float64 -> unsafe.Pointer
p3 := (unsafe.Pointer)(&arr)     // *[10]string -> unsafe.Pointer
p4 := (unsafe.Pointer)(&f)     // *Foo -> unsafe.Pointer

// 2. unsafe.Pointer也可以被转换为任意类型的指针值
var pa = (*int)(p1)         // unsafe.Pointer -> *int
var pb = (*float64)(p2)         // unsafe.Pointer -> *float64
var parr = (*[10]string)(p3) // unsafe.Pointer -> *[10]string
var pf = (*Foo)(p4) // unsafe.Pointer -> *Foo

// 3. uintptr类型值可以被转换为一个unsafe.Pointer
var i uintptr = 0x80010203
p := unsafe.Pointer(i)

// 4. unsafe.Pointer也可以被转换为一个uintptr类型值。
p := unsafe.Pointer(&a)
var i = uintptr(p)
```

有了 unsafe.Pointer，可以很容易穿透Go的类型安全保护:

```go
func main() {
    var a uint32 = 0x12345678
    fmt.Printf("0x%x\n", a)    // 0x12345678

    p := (unsafe.Pointer)(&a) // 利用unsafe.Pointer的性质1

    b := (*[4]byte)(p)        // 利用unsafe.Pointer的性质2
    b[0] = 0x23
    b[1] = 0x45
    b[2] = 0x67
    b[3] = 0x8a

    fmt.Printf("0x%x\n", a)   // 0x8a674523 (注：在小端字节序系统中输出此值)
}
```

可以看到原本被解释为uint32类型的一段内存（起始地址为&a，长度为4字节），通过unsafe.Pointer被重新解释成了[4]byte并且通过变量b（*[4]byte类型）可以对该段内存进行修改。

## 3. unsafe包的典型应用
Go核心团队也没有将unsafe包列入Go 1兼容性的承诺保护范围内，但unsafe包所具有的独一无二的穿透类型安全保护的能力对开发人员依旧充满了诱惑力。标准库和运行时中，reflect、sync、syscall和runtime包都是unsafe包的重度“用户”，这些包有的需要绕过Go类型保护直接操作内存，有的对性能敏感，还有的与操作系统或C语言低级代码交互频繁。

### 3.1 标准库中的典型应用
#### reflect

ValueOf和TypeOf函数是reflect包中用得最多的两个API，它们是进入运行时反射层、获取反射层信息的入口。这两个函数均将任意类型变量转换为一个interface{}类型变量，再**利用unsafe.Pointer将这个变量绑定的内存区域重新解释为reflect.emptyInterface类型**，以获得传入变量的类型和值的信息。

```go
。
// $GOROOT/src/reflect/value.go

// emptyInterface用于表示一个interface{}类型的值的头部
type emptyInterface struct {
    typ  *rtype
    word unsafe.Pointer
}

func ValueOf(i interface{}) Value {
    ...
    return unpackEface(i)
}

// unpackEface将empty interface变量i转换成一个reflect.Value
func unpackEface(i interface{}) Value {
    e := (*emptyInterface)(unsafe.Pointer(&i))
    ...
    return Value{t, e.word, f}
}

// $GOROOT/src/reflect/type.go

// TypeOf返回interface{}类型变量i的动态类型信息
func TypeOf(i interface{}) Type {
    eface := *(*emptyInterface)(unsafe.Pointer(&i))
    return toType(eface.typ)
}
```

#### syscall
标准库中的syscall包封装了与操作系统交互的系统调用接口，比如Stat、Listen、Select等：

```go
// $GOROOT/src/syscall/zsyscall_linux_amd64.go
func Listen(s int, n int) (err error) {
    _, _, e1 := Syscall(SYS_LISTEN, uintptr(s), uintptr(n), 0)
    if e1 != 0 {
        err = errnoErr(e1)
    }
    return
}

func Select(nfd int, r *FdSet, w *FdSet, e *FdSet, timeout *Timeval) (n int, err error) {
    r0, _, e1 := Syscall6(SYS_SELECT, uintptr(nfd), uintptr(unsafe.Pointer(r)),
       uintptr(unsafe.Pointer(w)), uintptr(unsafe.Pointer(e)),
       uintptr(unsafe.Pointer(timeout)), 0)
    n = int(r0)
    if e1 != 0 {
        err = errnoErr(e1)
    }
    return
}
```

我们看到，这类封装的高级调用最终都会落到调用下面一系列Syscall和RawSyscall函数上：

```go
// $GOROOT/src/syscall/syscall_unix.go
func Syscall(trap, a1, a2, a3 uintptr) (r1, r2 uintptr, err Errno)
func Syscall6(trap, a1, a2, a3, a4, a5, a6 uintptr) (r1, r2 uintptr, err Errno)
func RawSyscall(trap, a1, a2, a3 uintptr) (r1, r2 uintptr, err Errno)
func RawSyscall6(trap, a1, a2, a3, a4, a5, a6 uintptr) (r1, r2 uintptr, err Errn
```

而这些Syscall系列函数接受的参数类型均为uintptr，这样当封装的系统调用的参数为指针类型时（比如上面Select的参数r、w、e等），我们只能通过unsafe.Pointer将这些指针指向的地址值转换为uintptr值

### 3.2 第三方库的典型应用
Go binding项目（与不是用Go实现的项目进行集成，如gocv、gotk3等）、网络领域项目和数据库领域项目是unsafe的重度“用户”。unsafe包在这些项目中主要被用于如下两个场景
1. 与操作系统以及非Go编写的代码的通信
2. 高效类型转换

#### 与操作系统以及非Go编写的代码的通信
与操作系统的通信主要通过系统调用进行，这在之前已提过。而与非Go编写的代码的通信则主要通过cgo方式，如下面的示例：

```go
func SetIcon(iconBytes []byte) {
    // 转换成一个C char类型
    cstr := (*C.char)(unsafe.Pointer(&iconBytes[0]))
    // 调用来自systray.h的函数
    C.setIcon(cstr, (C.int)(len(iconBytes)))
}
```

#### 高效类型转换
通过unsafe包实现性能更好的类型转换。最常见的类型转换是string与[]byte类型间的相互转换：

```go
func Bytes2String(b []byte) string {
    return *(*string)(unsafe.Pointer(&b))
}

func String2Bytes(s string) []byte {
    // 必须在一个表达式内，原因见 unsafe 的安全使用模式
    sh := (*reflect.StringHeader)(unsafe.Pointer(&s))
    bh := reflect.SliceHeader{
        Data: sh.Data,
        Len:  sh.Len,
        Cap:  sh.Len,
    }
    return *(*[]byte)(unsafe.Pointer(&bh))
}
```
在上面的转换中:
1. string 类型变量是不可变的（immutable），通过常规方法将一个 string 类型变量转换为`[]byte`类型，Go会为`[]byte`类型变量分配一块新内存，并将string类型变量的值复制到这块新内存中
2. 通过上面基于unsafe包实现的String2Bytes函数，这种转换并不需要额外的内存复制：转换后的`[]byte`变量与输入参数中的string类型变量共享底层存储（但注意，我们依旧无法通过对返回的切片的修改来改变原字符串）
3. 将`[]byte` 变量转换为string类型则更为简单，因为`[]byte`的内部表示是一个三元组(ptr, len, cap)，string的内部表示为一个二元组(ptr, len)，通过unsafe.Pointer将`[]byte`的内部表示重新解释为string的内部表示，这就是Bytes2String的原理

## 4. 正确理解unsafe.Pointer与uintptr
Go语言内存管理是基于垃圾回收的，垃圾回收例程会定期执行。如果一块内存没有被任何对象引用，它就会被垃圾回收器回收。而对象引用是通过指针实现的。

unsafe.Pointer 与 uintptr:
1. unsafe.Pointer和其他常规类型指针一样，可以作为对象引用。如果一个对象仍然被某个unsafe.Pointer变量引用着，那么该对象是不会被垃圾回收的。
2. 但是uintptr并不是指针，它仅仅是一个整型值，即便它存储的是某个对象的内存地址，它也不会被算作对该对象的引用。如果认为将对象地址存储在一个uintptr变量中，该对象就不会被垃圾回收器回收，那就是对uintptr的最大误解。
3. 使用uintptr类型变量保存栈上变量的地址同样是有风险的，因为Go使用的是连续栈的栈管理方案，每个goroutine的默认栈大小为2KB（_StackMin = 2048）。当goroutine当前剩余栈空间无法满足函数/方法调用对栈空间的需求时，Go运行时就会新分配一块更大的内存空间作为该goroutine的新栈空间，并将该goroutine的原有栈整体复制过来，这样原栈上分配的变量的地址就会发生变化。unsafe.Pointer 类型变量的值会被 Go 运行时做同步变更；但 uintptr 类型变量只是一个整型值，它的值是不变的。

## 5. unsafe.Pointer的安全使用模式
Go（1.14版本）在unsafe的文档中定义了6条安全使用模式:

### 5.1 模式 1
- 使用: *T1 -> unsafe.Pointer -> *T2
- 作用: 本质就是内存块的重解释：将原本解释为T1类型的内存重新解释为T2类型
- 注意: 不能忽略内存对齐问题，转换后类型T2的对齐系数不能比转换前类型T1的对齐系数更严格，即Alignof(T1) >= Alignof(T2)

```go
// 1. 模式 1 
// $GOROOT/src/math/unsafe.go
func Float64bits(f float64) uint64 {
    return *(*uint64)(unsafe.Pointer(&f))
}
```

### 5.2 模式 2
- 使用: unsafe.Poiner -> uintptr
- 作用: 就是将unsafe.Pointer显式转换为uintptr，并且转换后的uintptr类型变量不会再转换回unsafe.Pointer，只用于打印输出，并不参与其他操作。

```go
// 1. 模式 2 
var x = [10]int{1, 2, 3, 4, 5, 6, 7, 8, 9, 0}
var p = uintptr(unsafe.Pointer(&x))
println(p)
```

### 5.3 模式 3 
- 使用: unsafe.Pointer(uintptr(unsafe.Pointer(&b)) + offset) 
- 作用: 模拟指针运算，用于访问结构体内字段或数组中的元素，也常用于实现对某内存对象的步进式检查
- 注意:
    - 不要越界
    - unsafe.Pointer -> uintptr -> unsafe.Pointer的转换要在一个表达式中

```go
// 访问数组a的第4个元素
var p = unsafe.Pointer(uintptr(unsafe.Pointer(&a)) + 3*unsafe.Sizeof(a[0]))
fmt.Println(*(*int)(p)) // 4

// 访问Foo结构体的字段c
p = unsafe.Pointer(uintptr(unsafe.Pointer(&foo)) + unsafe.Offsetof(foo.c))
fmt.Println(*(*float64)(p)) // 3.1415

// 对数组a的第一个元素进行逐字节步进式检查
for i := uintptr(0); i < unsafe.Sizeof((*int)(nil)); i++ {
    p = unsafe.Pointer(uintptr(unsafe.Pointer(&a)) + i)
    fmt.Printf("0x%x\n", *(*byte)(p))
}
```

下面是一个存在风险的例子：

```go
func NewArray() *[10]int {
    a := [10]int{10, 11, 12, 13, 14, 15, 16, 17, 18, 19}
    return &a
}

func main() {
    a := uintptr(unsafe.Pointer(NewArray()))
    // 存在风险：这个时间空隙，GC可能随时回收掉NewArray()返回的数组实例
    p := unsafe.Pointer(a + unsafe.Sizeof(int(0)))
    fmt.Printf("%d\n", *(*int)(p)) // 输出：???
}


// 正确做法
func main() {
    p := unsafe.Pointer(uintptr(unsafe.Pointer(NewArray())) + unsafe.Sizeof(int(0)))
    fmt.Printf("%d\n", *(*int)(p)) // 11
}
```

unsafe.Pointer -> uintptr -> unsafe.Pointer的转换不在一个表达式中。NewArray函数返回的数组对象在转换为 uintptr 后已经失去了所有对其的引用，它随时可能被GC回收掉。正确的处理方式是将这两次转换放在一个表达式中，Go编译器会保证两次转换期间NewArray函数返回的数组对象的有效性

### 5.4 模式 4
- 使用: 调用syscall.Syscall系列函数时指针类型到uintptr类型参数的转换
- 作用: 特定用法
- 注意: 转换要在一个表达式中

Go标准库的syscall包的Syscall系列函数的参数都是uintptr类型，就像下面这样：

```go
// $GOROOT/src/syscall/syscall_unix.go
func Syscall(trap, a1, a2, a3 uintptr) (r1, r2 uintptr, err Errno)
func Syscall6(trap, a1, a2, a3, a4, a5, a6 uintptr) (r1, r2 uintptr, err Errno)
```

要传给Syscall系列函数的变量的类型为指针，那么我们就需要将其转换为uintptr类型。下面是不安全的做法：

```go
var p *T // 待传给Syscall系列函数的指针变量
...
a := uintptr(unsafe.Pointer(p))
syscall.Syscall(SYS_READ, uintptr(fd), a, uintptr(n))
```

不能保证传入的a值所表示的内存地址上对象的有效性，这个内存对象很可能已经在某个时间被GC回收掉或者在栈扩张或收缩时内存对象的地址发生了变更。正确的做法是将转换操作放入Syscall的参数表达式中，Go编译器会识别出这种特殊的使用模式，并保证在这个转换过程中原内存对象（p）的有效性。

```go
var p *T // 待传给Syscall系列函数的指针变量
syscall.Syscall(SYS_READ, uintptr(fd), uintptr(unsafe.Pointer(p)), uintptr(n))
```

### 5.5 模式 5
将reflect.Value.Pointer或reflect.Value.UnsafeAddr转换为指针

Go标准库的reflect包的Value类型有两个返回uintptr类型值的方法：
```go
// $GOROOT/src/reflect/value.go
func (v Value) Pointer() uintptr
func (v Value) UnsafeAddr() uintptr
```

unsafe包文档中明确了reflect.Value.Pointer或reflect.Value.UnsafeAddr返回值的安全转换方法：和模式3一样，在一个表达式中完成转换，而不要将返回值赋值给一个uintptr类型变量再在后续的语句中进行转换。

```go
// 错误! 在两条语句的执行间隙，T类型对象可能被垃圾回收
u := reflect.ValueOf(new(T)).Pointer()
p := (*T)(unsafe.Pointer(u)) 

// 正确
p := (*T)(unsafe.Pointer(reflect.ValueOf(new(T)).Pointer()))
```

### 5.6 模式 6
reflect.SliceHeader和reflect.StringHeader必须通过模式1构建

reflect包的SliceHeader和StringHeader两个结构体分别代表着切片类型和string类型的内存表示。可以通过模式1的内存块重解释来构造这两个结构体类型的实例。

```go
type SliceHeader struct {
	Data uintptr
	Len  int
	Cap  int
}

type StringHeader struct {
	Data uintptr
	Len  int
}
```

下面示例代码中通过 **模式1构建的reflect.SliceHeader实例bh对newSlice返回的切片对象具有对象引用作用**，这样可以保证newSlice返回的对象不会被垃圾回收掉，后续反向转换成*[]byte依旧有效。

```go
func newSlice() *[]byte {
    var b = []byte("hello, gopher")
    return &b
}

func main() {
    // 注意虽然 SliceHeader 中的 Data 是 uintptr，但是使用模式 1 的转换，引用依然有效
    bh := (*reflect.SliceHeader)(unsafe.Pointer(newSlice())) // 模式1
    var p = (*[]byte)(unsafe.Pointer(bh))
    fmt.Printf("%q\n", *p) // "hello, gopher"

    var a = [...]byte{'I', ' ', 'l', 'o', 'v', 'e', ' ', 'G', 'o', '!', '!'}
    bh.Data = uintptr(unsafe.Pointer(&a))
    bh.Len = len(a)
    bh.Cap = len(a)

    fmt.Printf("%q\n", *p) // "I love Go!!"
}
```

如果通过常规语法定义一个reflect.SliceHeader类型实例并赋值，那么后续反向转换成*[]T时存在SliceHeader.Data的值对应的地址上的对象已经被回收的风险：

```go
func finalizer(p *[11]byte) {
    fmt.Println("数组对象被垃圾回收")
}

func newArray() *[11]byte {
    var a = [...]byte{'I', ' ', 'l', 'o', 'v', 'e', ' ', 'G', 'o', '!', '!'}
    runtime.SetFinalizer(&a, finalizer)
    return &a
}

func main() {
    var bh reflect.SliceHeader
    // 这一步转换之后，newArray() 返回的数组就已经没有对象引用了
    bh.Data = uintptr(unsafe.Pointer(newArray()))
    bh.Len = 11
    bh.Cap = 11
    var p = (*[]byte)(unsafe.Pointer(&bh))
    for i := 0; i < 3; i++ {
        runtime.GC() // 数组对象在此处被垃圾回收
        time.Sleep(1 * time.Second)
    }
    fmt.Printf("%q\n", *p) //
}
```

这种错误非常隐蔽，在 Go1.20 起，在 unsafe 标准库新增了 3 个函数来替代前面这两个类型的使用:
1. `func String(ptr *byte, len IntegerType) string`：根据数据指针和字符长度构造一个新的 string。
2. `func StringData(str string) *byte`：返回指向该 string 的字节数组的数据指针。
3. `func SliceData(slice []ArbitraryType) *ArbitraryType`：返回该 slice 的数据指针。
4. `func Slice(ptr *ArbitraryType, len IntegerType) []ArbitraryType`

新版本的用法将会变成：

```go
func StringToBytes(s string) []byte {
    return unsafe.Slice(unsafe.StringData(s), len(s))
}

func BytesToString(b []byte) string {
    return unsafe.String(&b[0], len(b))
}
```

## 6. unsafe 包的安全使用检查
Go核心团队一直在完善工具链，加强对代码中unsafe使用安全性的检查。通过go vet可以检查unsafe.Pointer和uintptr之间的转换是否符合上述六种安全模式。

Go 1.14编译器在-race 或 -msan命令行选型开启的情况下，会执行 -d=checkptr 检查，即对unsafe.Pointer进行下面两项合规性检查。
1. 当将`*T1`类型按模式1通过 unsafe.Pointer 转换为 `*T2` 时，T2的内存地址对齐系数不能高于T1的对齐系数。
2. 做完指针运算后，转换后的unsafe.Pointer仍应指向原先的内存对象，相当于越界检查。

```go
func main() {
    var n = 5
    b := make([]byte, n)
    end := unsafe.Pointer(uintptr(unsafe.Pointer(&b[0])) + uintptr(n+10))
    _ = end
}

// 使用-race选项运行的结果如下（Ubuntu 18.04）：
$go run -race  go_unsafe_compile_checkptr.go
fatal error: checkptr: unsafe pointer arithmetic
...
exit status 2
```