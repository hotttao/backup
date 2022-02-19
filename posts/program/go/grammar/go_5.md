---
weight: 1
title: "go 函数"
date: 2021-01-05T22:00:00+08:00
lastmod: 2021-01-05T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go 函数的使用"
featuredImage: 

tags: ["go 语法"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

函数，代码封装的基本单元

<!-- more -->

### 1. 函数
函数通常使用起来并不复杂，定义或声明函数后，直接使用即可。但是为了函数更加易用，编程语言会为函数添加很多特性。在 Python 和 Go 中，函数都是一等"公民"，即函数可以用在任何变量可以使用的地方，并且具有类型。因此接下来我们按照下面的顺序来讲解 Go 函数的相关内容:
1. 第一部分: Go 函数作为基础数据类型的特性:
  - 函数声明
  - 函数的类型
  - 函数的零值
2. 第二部分: Go 函数语言层的特性
  - 匿名函数与闭包
  - 异常处理
  - `Deferred`


## 2. 函数
### 2.1 函数声明
Go 函数声明包括函数名、形式参数列表、返回值列表（可省略）以及函数体。函数的参数，返回值以及函数调用时的传值方式是函数的核心。

```Go
func name(parameter‐list) (result‐list) {
  body
}
```

下面是几个函数声明的示例:
```Go
func hypot(x, y float64) float64 {
  return math.Sqrt(x*x + y*y)
}

// 参数类型相同时，可以合并
func f(i, j, k int, s, t string) { /* ... */ }
func f(i int, j int, k int, s string, t string) { /* ... */ }

//
func add(x int, y int) int {return x + y}
func sub(x, y int) (z int) { z = x ‐ y; return}
func first(x int, _ int) int { return x }  // _ 可以强调某个参数未被使用
func zero(int, int) int { return 0 }

// 在返回值的类型都相同时， 返回值变量名可以传达函数返回值的含义
func Size(rect image.Rectangle) (width, height int)
func Split(path string) (dir, file string)
```

#### 返回值
与 Python 默认返回 None 不同，Go 有返回值列表，但是没有默认的返回值，返回值列表就是对函数返回值的约束:
1. 返回值列表描述了函数返回值的变量名以及类型
  - 如果没有返回值列表，函数不能返回任何值
  - 如果包含返回值列表，函数必须返回与返回值列表类型相符的值
2. 返回值可以被命名，此时每个返回值被声明成一个局部变量，并根据返回值的类型，被其初始化为 0
3. 当如果函数返回一个无名变量或者没有返回值，返回值列表的括号可以省略。

Go 的函数返回值符合 Go 强变量类型的约束。


#### 参数
Go 函数参数没有默认值，也不能通过参数名指定行参。每一次函数调用都必须按照声明顺序为所有参数提供实参（参数值）。因此形参和返回值的变量名对于函数调用者而言没有意义。

为了让函数更加通用，Go 和 Python 都提供了可变参数的特性。在 Go 中声明可变参数时，需要在参数列表的最后一个参数类型之前加上省略符号“...”，这表示该函数会接收任意数量的该类型参数。

```Go
func sum(vals...int) int {
total := 0
for _, val := range vals {
  total += val
  }
  return total
}

//
fmt.Println(sum()) // "0"
fmt.Println(sum(3)) // "3"
fmt.Println(sum(1, 2, 3, 4)) // "10"
```

在上面的代码中，调用者隐式的创建一个数组，并将原始参数复制到数组中，再把数组的一个切片作为参数传给被调函数。如果原始参数已经是切片类型，可以像下面这样向函数传递参数。

```Go
//
values := []int{1, 2, 3, 4}
fmt.Println(sum(values...)) // "10"
```

### 2.2 函数类型与值
Go 中函数的类型被称为函数的标识符，函数的取决于参数和返回值的类型:
1. 如果两个函数形式参数列表和返回值列表中的变量类型一一对应，那么它们有相同的类型和标识符
2. 形参和返回值的变量名不不会影响函数标识符

函数类型的零值是 `nil`。调用值为nil的函数值会引起panic错误。函数值可以与nil比较，但是函数值之间是不可比较的，也不能用函数值作为map的key。函数之间之所以不可比，是因为函数闭包，函数会保留定义函数时，存在的自由变量的绑定。我们会在下面讲解。

```Go
// 此处f的值为nil, 会引起panic错误
var f func(int) int
f(3)

// 函数与 nil 比较
var f func(int) int
if f != nil {
  f(3)
}
```

### 2.3 函数调用的传值方式
我们把调用函数时传递给函数的值称为实参，函数接收参数值的变量称为行参。

Go 中实参通过值的方式传递，因此函数的形参是实参的拷贝。对形参进行修改不会影响实参。但是，如果实参包括引用类型，如指针，slice(切片)、map、function、channel等类型，实参可能会由于函数的间接引用被修改。

在函数体中，函数的形参作为局部变量，被初始化为调用者提供的值。函数的形参和有名返回值作为函数最外层的局部变量，被存储在相同的词法块中。我们甚至可以直接修返回值变量，来修改函数的返回值。我们会在讲解 Deffer 时详述。

说完了函数作为基本类型的特性，我们再来看为了方便编程，Go 为函数提供的语言层特性。


## 3. 函数特性
### 3.1 函数闭包
Go 里面一个有意思的地方是拥有函数名的函数只能在包级语法块中被声明。即我们不能在函数内部使用，使用 `func name(parameter‐list) (result‐list)` 方式定义函数，但不带 name 的 `func (parameter‐list) (result‐list)` 匿名函数可以。`func (parameter‐list) (result‐list)` 是 Go 函数的函数字面量。函数值字面量是一种表达式，它的值被成为匿名函数（anonymousfunction）

说起来比较绕，即如果我们想在函数内定义命名函数必须使用下面这种方式；或者直接使用匿名函数。

```Go
// 1. 函数内定义命名函数
func f1(a, b int) (r int) {
	v := func() {
		r += b
	}
	defer v()
	return a + b
}

// 2. 直接使用匿名函数
func squares() func() int {
  var x int
  return func() int {
    x++
    return x * x
  }
}

f := squares()
fmt.Println(f()) // "1"
fmt.Println(f()) // "4"
```

注意在上面第二个示例中，squares中定义的匿名内部函数可以访问和更新squares中的局部变量，这意味着匿名函数和squares中存在变量引用。这就是函数闭包，也是函数值属于引用类型和函数值不可比较的原因。

需要注意的是函数闭包内保存的是变量的引用而不是变量的值。我们来看下面删除临时文件的示例:

```Go
var rmdirs []func()
for _, dir := range tempDirs() {
  // dir := d // NOTE: necessary!
  os.MkdirAll(dir, 0755)
  rmdirs = append(rmdirs, func() {
    os.RemoveAll(dir) // NOTE: incorrect!
  })
}
```

在上面的程序中，for循环语句引入了新的词法块，循环变量`dir`在这个词法块中被声明。在该循环中生成的所有函数值都共享相同的循环变量。需要注意，函数值中记录的是**循环变量的内存地址**，而不是循环变量某一时刻的值。以dir为例，后续的迭代会不断更新dir的值，当删除操作执行时，for循环已完成，dir中存储的值等于最后一次迭代的值。这意味着，每次对os.RemoveAll的调用删除的都是相同的目录。

如果你使用go语句或者defer语句会经常遇到此类问题。这不是go或defer本身导致的，而是因为它们都会等待循环结束后，再执行函数值。

### 3.2 Defer 机制
Go 的 Defer 机制与 Python 的上下文管理器有点类似，都是为了保证某些代码一定要执行，无论代码是否出现了异常。

defer 的语法很简单，只需要在调用普通函数或方法前加上关键字defer。
1. 当defer语句被执行时，跟在defer后面的函数会被延迟执行。
2. 直到包含该defer语句的函数执行完毕时，defer后的函数才会被执行，不论包含defer语句的函数是通过return正常结束，还是由于panic导致的异常结束。
3. 可以在一个函数中执行多条defer语句，它们的执行顺序与声明顺序相反。

通过defer机制，不论函数逻辑多复杂，都能保证在任何执行路径下，资源被释放。释放资源的defer应该直接跟在请求资源的语句后。需要注意的是跟在 defer 之后的是函数调用，而不是函数本身。

```Go
// defer 关闭文件
package ioutil
func ReadFile(filename string) ([]byte, error) {
  f, err := os.Open(filename)
  if err != nil {
    return nil, err
  }
  defer f.Close()
  return ReadAll(f)
}

// 释放锁
var mu sync.Mutex
var m = make(map[string]int)
func lookup(key string) int {
  mu.Lock()
  defer mu.Unlock()
  return m[key]
}
```

利用 defer中的函数会在return语句更新返回值变量后再执行，以及在函数中定义的匿名函数可以访问该函数包括返回值变量在内的所有变量，我们就可以上面说到的改变函数返回值的目的。

```Go
func triple(x int) (result int) {
  defer func() { result += x }()
  return double(x)
}

fmt.Println(triple(4)) // "12
```

### 3.3 错误与异常处理
严格的区分错误和异常，应该是 Go 编码风格一个最大的特点。在Go中，错误是程序运行的几个预期的结果之一。而异常是未被预料到的错误，即bug，而不是那些在健壮程序中应该被避免的程序错误。正因为如此，在 Go 的代码中你会看到很多类似下面的条件判断。Go 将对错误的处理放在了代码的逻辑控制中，让程序员更多的关注错误。

```Go
// 导致失败的原因只有一个，额外的返回值可以是一个布尔值，通常被命名为ok
value, ok := cache.Lookup(key)
  if !ok {
    // ...cache[key] does not exist…
}

// 导致失败的原因不止一种时，额外的返回值是error类型，
resp, err := http.Get(url)
if err != nil{
  return nill, err
}
```

#### 错误处理
对于那些将运行失败看作是预期结果的函数，它们会返回一个额外的返回值，通常是最后一个，来传递错误信息。调用者需要处理程序出现的潜在错误。因此Go中大部分函数的代码结构几乎相同，首先是一系列的初始检查，防止错误发生，之后是函数的实际逻辑。

对于函数返回的错误，通常有以下五种处理方式:
1. 传播错误
2. 重新尝试失败的操作
3. 输出错误信息并结束程序
4. 有时，只输出错误信息就足够了，不需要中断程序的运行
5. 直接忽略掉错误

需要注意的是，输出错误信息并结束程序只应在main中执行。对库函数而言，应仅向上传播错误，除非该错误意味着程序内部包含不一致性，即遇到了bug，才能在库函数中结束程序。

#### 异常处理
Go 中的异常称为 Panic。一般而言，当panic异常发生时，程序会中断运行，并立即执行在该goroutine 中被延迟的函数（defer 机制），在Go的panic机制中，延迟函数的调用在释放堆栈信息之前。直接调用内置的panic函数也会引发panic异常，panic函数接受任何值作为参数。

通常来说，不应该对panic异常做任何处理，但有时候我们需要从异常中恢复，此时就需要 Go 的 Recover 机制来捕获异常。

```Go
func Parse(input string) (s *Syntax, err error) {
  defer func() {
    if p := recover(); p != nil {
      err = fmt.Errorf("internal error: %v", p)
    }
  }()
// ...parser...
}
```
如上所示，如果在deferred函数中调用了内置函数`recover`，并且定义该defer语句的函数发生了panic异常，recover会使程序从panic中恢复，并返回panic value。导致panic异常的函数不会继续运行，但能正常返回。在未发生panic时调用recover，recover会返回nil。

通常我们不应该不加区分的恢复所有的panic异常，同时作为被广泛遵守的规范，也不应该试图去恢复其他包引起的panic。安全的做法是有选择性的recover。

为了标识某个panic是否应该被恢复，我们可以将panic value设置成特殊类型。在recover时对panic value进行检查，如果发现panic value是特殊类型，就将这个panic作为errror处理，如果不是，则按照正常的panic进行处理。

```Go
func soleTitle(doc *html.Node) (title string, err error) {
  type bailout struct{}
  defer func() {
    switch p := recover(); p {
      case nil: // no panic
      case bailout{}: // "expected" panic
        err = fmt.Errorf("multiple title elements")
      default:
        panic(p) // unexpected panic; carry on panicking
      }
  }()
}
```

最后某些致命错误会导致Go在运行时终止程序，无法恢复，比如内存不足。
