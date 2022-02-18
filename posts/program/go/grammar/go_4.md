---
weight: 1
title: "go 复合数据类型"
date: 2021-01-04T22:00:00+08:00
lastmod: 2021-01-04T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go 提供的复合数据类型"
featuredImage: /images/go/grammar/go_type.jpg

tags: ["go 语法"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

Go 的类型系统

<!-- more -->

## 1. Go 的复合数据类型
接着上一篇，我们来继续讨论 Go 里面的复合数据类型，包括数组、slice、map和结构体。数组和结构体是聚合类型；它们的值由许多元素或成员字段的值组成。slice,map 分别与 Python 中的 `array.Array`,`dict` 相对应，它们是 Go 提供给我们容器数据类型。

编程语言提供的复合数据类型应该是数据结构与算法的基础内容，如果你熟悉常用的数据结构，对复合类型的特性和支持的操作应该很容易就能理解。因此接下来的内容，我们会先简单说一说数据结构的特点，然后在介绍它们在 Go 中的实现和支持的操作。

## 2. 数组
数组应该是最基本的数据结构，简单来说，数组具有如下特性:
1. 数组是一段连续的内存空间，用来存储一组具有相同类型的数据
2. 数组一经创建，大小便不能更改，连续的内存要求元素之间不能出现空洞

数组的特性决定了数组天然支持基于下标的“随机访问”(索引)。Go 中的数组我们需要关注以下几个知识点:
- 数组的长度是数组类型的一个组成部分，`[3]int`和`[4]int`是两种不同的数组类型
- 数组的长度必须是常量表达式，因为数组的长度需要在编译阶段确定
- 数组的可比性取决于数组的类型是否相同以及数组元素是否可比，只有当两个数组类型相同并且所有元素都是相等的时候数组才相等

下面是数组常用操作的代码示例:

```Go
// 1. 数组字面量
var q [3]int = [3]int{1, 2, 3}

q := [...]int{1, 2, 3} // “...”省略号，表示数组的长度是根据初始化值的个数来计算

r := [...]int{99: ‐1} // 直接按位置初始化，未初始化的为对应类型的零值

// 2. 索引和切片
fmt.Println(q[0])        // print the first element
fmt.Println(q[len(q)‐1]) // print the last element, q[2]

e := [3]int{1, 2, 3}
ff := e[0:2]            // 对数组切片返回的是 slice 而不是原数组类型
if ff == e {            // missmatch type []int and [3]int

}

// 3. for 循环迭代
for i, v := range q {
  fmt.Printf("%d %d\n", i, v)
}

// 4. 数组可比性
a := [2]int{1, 2}
d := [3]int{1, 2}
fmt.Println(a == d) // compile error: cannot compare [2]int == [3]int
```

## 3. slice 切片
因为数组的大小固定，类型限定严格，我们通常很少直接使用数组，使用更多的是数组的容器，Go 中数组的容器类型就是  slice (切片)。容器的最主要作用是能够根据元素大小对数组进行扩缩容。因此我们可以从 slice 的组成和扩缩容两个方面去理解 slice。

### 3.1 slice 组成
Go 的 slice由三个部分构成：
1. 指针: 指针指向第一个slice元素对应的底层数组元素的地址
3. 容量: 容量一般是从 slice 的开始位置到底层数据的结尾位置
2. 长度: 对应slice中元素的数目，长度不能超过容量

需要注意的是，因为 slice 底层数组是可以共享(通常是由于切片行为引起的)，因此slice 指针指向的第一个元素并不一定就是数组的第一个元素。内置的len和cap函数分别返回slice的长度和容量。下面是一个 slice 结构示意图:

![Hello World](/images/go/grammar/slice_base.png)

```Go
months := [...]string{1: "January", /* ... */, 12: "December"}

Q2 := months[4:7]
summer := months[6:9]
```

对数组 `months` 的切片操作返回的是 slice `[]int`，`Q2`和`summer` 共用了底层的 `months` 数组。

### 3.2 slice 扩缩容
slice 扩缩容策略由 `append` 函数实现，但 append 只能向slice追加元素，Go 并没有删除 slice 中元素的函数。`append`扩容的过程大体是这样的:
1. 在每次向 slice 添加时，`append` 会判断当前数组的大小是否足以容纳新增元素，足够则直接插入
2. 如果数组容量不够，`append` 将创建一个原有数组两倍大小的新数组，并将原数组中的元素拷贝到新数组中去
3. 最后将 slice 中的指针的指向新的底层数组

`append` 函数可以向 slice 追加多个元素，甚至追加一个slice:

```Go
var x []int
x = append(x, 1)
x = append(x, 2, 3)
x = append(x, 4, 5, 6)
x = append(x, x...) // append the slice x
fmt.Println(x) // "[1 2 3 4 5 6 1 2 3 4 5 6]"
```

需要注意的是，通常我们要将 append 的返回值直接赋值给输入的slice变量，这么做与 Go 中函数的参数传值方式有关:
1. Go 中的函数参数是按值传递的，因此传入 `append` 的是 slice 的副本，但是它们的指针指向了相同的底层数组
2. 如果 `append` 函数发生了扩容，函数内的 slice 副本将指向新的内存数组，此时 `append` 函数将不会影响到传入的 slice 变量，为了达到修改 slice 的目的，通常要对输入的slice变量重新赋值

### 3.3 slice 操作
说完了 slice 的实现，我们再来看看 slice 支持的操作:
1. slice 的字面量与数组类似，只是去掉长度声明
2. 对 slice 的切片操作如果超出`cap(s)`的上限将导致一个panic异常，但是超出`len(s)`则是意味着扩展了slice，新slice的长度会变长
2. 为了避免创建 slice 多次内存分配，内置的 `make` 函数可以创建指定长度和容量的 slice
3. slice之间不能比较，我们不能使用==操作符来判断两个slice是否含有全部相等元素，slice唯一合法的比较操作是和nil比较
5. 因为 Go 没有提供删除 slice 元素的函数，只能采用覆盖的方式进行 slice 元素删除

下面是 slice 常用操作的代码示例:

```Go
// 1. slice 字面量
var m = []int{3: 10}

// 2. slice 创建函数
// make创建了一个匿名的数组变量，然后返回一个slice
make([]T, len)
make([]T, len, cap) // same as make([]T, cap)[:len]

// 3. slice 与 nil 的比较和转换
if summer == nil { /* ... */ }

var s []int     // len(s) == 0, s == nil
s = nil         // len(s) == 0, s == nil
s = []int(nil)  // len(s) == 0, s == nil，类型转换
s = []int{}     // len(s) == 0, s != nil

// 4. slice 为空测试，不应该使用 s == nil
if len(s) == 0{

}

// 5. slice 复制
// copy函数可以方便地将一个slice复制另一个相同类型的slice
// copy函数将返回成功复制的元素的个数，等于两个slice中较小的长度
copy(m, s)  // 将 s 复制到 m

// 6. slice 元素删除
//如果要保持 slice 原来顺序
func remove(slice []int, i int) []int {
  copy(slice[i:], slice[i+1:])
  return slice[:len(slice)‐1]
}

//如果不用保持原来顺序的话，使用最后元素覆盖删除元素
func remove(slice []int, i int) []int {
  slice[i] = slice[len(slice)‐1]
  return slice[:len(slice)‐1]
}

// 7. slice 模拟栈操作
stack = append(stack, v) // push v
top := stack[len(stack)‐1] // top of stack
stack = stack[:len(stack)‐1] // pop
```

## 4. Map 散列表
在Go语言中，一个map就是一个散列表的引用，散列表是映射的一种实现方式，因此要想理清楚散列表，我们要从映射入手。所谓映射就是支持以下方法的键值对:
1. `M[k]`: 返回键 k 对应的值，对应 Python `__getitem__`
2. `M[k]=v`: 对应 Python `__setitem__`
3. `del M[k]`: 对应 Python `__delitem__`
4. `len(M)`: 对应 Python `__len__`
5. `iter(M)`: 迭代映射 M 中的所有键，对应 Python `__iter__`

我列出了 Python 中与之对应的方法，但是 Go 中实现方式有所不同，我们会在下面讲解。散列表是映射高效的实现方式，可以实现 `O(1)` 时间复杂度的元素查找。那散列表是如何实现的呢？

### 4.1 散列表的实现
散列表是数组的一种扩展，利用的是数组支持按照下标随机访问的特性，通过散列函数把元素的键映射为数组的下标来实现在数组中保存和查询元素。在整个散列表的实现中，有三个核心问题：
1. 散列函数设计
2. 散列冲突的解决
3. 装载因子以及散列表的动态扩容

下面是散列表实现映射的示意图:
![linkedlist](/images/algo/hash/hash_map.jpg)

限于篇幅的原因，有关散列表的实现，我就不过多解释，不了解的同学可以看看这篇文章[散列表实现](https://hotttao.github.io/2018/10/21/alog/hash_map/)。这里我们需要关注的是散列表在使用上的限制。

首先，由于映射过程以及散列冲突的存在，所有的编程语言的散列表都会有以下两点要求:
1. key 不可变，如果key 可变，元素的哈希值就会变化，查找就会失败
2. key 之间可比，当发生散列冲突时，要通过比较进行二次查找

而 Go 对散列表使用更加严格:
1. 散列表中所有的key必须是相同的类型，所有的value也必须是相同的类型，但是 key 和 value 的类型可以不同
2. 因为 Go 中可变的元素都是不可比的，所以上面的条件就退化成 key 必须是支持`==`比较运算符的数据类型,例如整数、数组或结构体等
3. 虽然浮点数类型也是支持相等运算符比较的，但是将浮点数用做key类型则是一个坏的想法，最坏的情况是可能出现的NaN和任
何浮点数都不相等

### 4.2 map 操作
说完了散列表的实现，接下来我们看看 Go map 支持的操作。在Go语言中，一个map就是一个哈希表的引用，map类型可以写为`map[K]V`，其中K和V分别对应`key`和`value`。与 `slice` 类似，我们可以使用字面量和 `make` 来创建 map。

map 支持上面所说的映射操作，但是与 Python 相比 Go map 有以下两个鲜明特点:
1. key 不存在时，执行 `M[key]`，不会触发异常，而是返回 value 类型对应的零值
2. map类型的零值是`nil`，也就是没有引用任何哈希表，map上的查找、删除、`len`和`range`循环都可以安全工作在`nil`值的map上，它们的行为和一个空的map类似。但是向一个nil值的map存入元素将导致一个panic异常

此外和slice一样，map之间也不能进行相等比较；唯一的例外是和nil进行比较。要判断两个map是否包含相同的`key`和`value`，我们必须通过一个循环实现。下面 map 操作的代码示例:

```Go
// 1. 字面量
ages := map[string]int{
  "alice": 31,
  "charlie": 34,
}

// 2. 初始化函数 make
ages := make(map[string]int)
ages["alice"] = 31
ages["charlie"] = 34

// 3. 元素访问与删除
ages["alice"] = 32
fmt.Println(ages["alice"]) // "32
delete(ages, "alice") // remove element ages["alice"]

// 元素不存在的判断
if age, ok := ages["bob"]; !ok { /* ... */ }  // 判断元素是否存在

// 4. 迭代和遍历，迭代总是随机和无序的
for name, age := range ages {
  fmt.Printf("%s\t%d\n", name, age)
}

// 有序遍历
import "sort"
var names []string
for name := range ages {
  names = append(names, name)
}

sort.Strings(names)
for _, name := range names {
  fmt.Printf("%s\t%d\n", name, ages[name])
}

// 5. 零值，以及是否为空的比较
var ages map[string]int
fmt.Println(ages == nil) // "true"
fmt.Println(len(ages) == 0) // "true"

// 6. 两个相同 map 判等
func equal(x, y map[string]int) bool {
  if len(x) != len(y) {
    return false
}

  for k, xv := range x {
      // 注意必须先判断，元素是否存在
      if yv, ok := y[k]; !ok || yv != xv {
        return false
      }
  }
  return true
}
```

最后，Go语言中并没有提供一个set类型，可以通过 map 实现类似set的功能，常用的 map 类型就是`map[string]bool`。


## 5. 结构体
结构体是一种聚合的数据类型由零个或多个任意类型的值聚合成的实体。每个值称为结构体的成员。结构体是 Go 提供给我们创建自定义类型的载体，下面是一个创建示例:

```Go
type Employee struct {
  ID int
  Name, Address string
  DoB time.Time
  Position string
  Salary int
  ManagerID int
}

var dilbert Employee
```

`struct` 定义了一个结构体，`type` 为这个结构体定义类型别名，便于引用，这种定义方式与 C 很接近。

在结构体的定义上，Go 中还有下面一些特性:
1. 结构体成员的输入顺序也有重要的意义，拥有相同成员但是成员顺序不同的结构体属于不同的结构体类型
2. 如果结构体成员名字是以大写字母开头的，那么该成员就是导出的；这是Go语言导出规则决定的。一个结构体可能同时包含导出和未导出的成员。

结构体的操作稍显复杂，我们分成下面两块来讲解
1. 结构体通用操作，包括成员变量的引用，结构体的创建和比较
3. 结构体的嵌入和匿名变量，这个是 Go 语言的特性，需要重点关注

### 5.1 结构体通用操作
#### 成员引用
结构体是一个变量，它所有的成员也同样是变量，可以赋值或者取址，然后通过指针访问。结构体变量的成员可以通过点操作符访问，点操作符也可以和指向结构体的指针一起工作：

```Go
// 通过点操作直接访问
var dilbert Employee
dilbert.Salary ‐= 5000

// 可以对成员变量取址，然后访问
position := &dilbert.Position
*position = "Senior " + *position // promoted, for outsourcing to Elbonia

// 点操作也可以直接用在结构体指针上
var employeeOfTheMonth *Employee = &dilbert
employeeOfTheMonth.Position += " (proactive team player)"  // 等同于
(*employeeOfTheMonth).Position += " (proactive team player)"
```

#### 结构体字面量
结构体字面值有两种语法格式:
1. 以结构体成员定义的顺序为每个结构体成员指定一个面值，这种方式在结构定义发生变化时就会导致编译错误，因此这种方式只在定义结构体的包内部使用，或者是在较小的结构体中使用，这些结构体的成员排列比较规则
2. 以成员名字和相应的值来初始化，可以包含部分或全部的成员,如果成员被忽略的话将默认用零值

需要注意的是两种不同形式的写法不能混合使用。而且，你不能企图在外部包中用第一种顺序赋值的技巧来偷偷地初始化结构体中未导出的成员。


```Go
// 方式一: 按照成员定义顺序，依次赋值
type Point struct{ X, Y int }
p := Point{1, 2}

// 方式二: 以成员名字和相应的值来初始化
f := Point{X: 1, Y: 2}

// 未导出变量，无法赋值
package p
type T struct{ a, b int } // a and b are not exported

package q
import "p"
var _ = p.T{a: 1, b: 2} // compile error: can't reference a, b
var _ = p.T{1, 2} // compile error: can't reference a, b
```

除了字面量外，我们还可以用前面介绍的 `new` 函数来创建结构体变量

```Go
pp := &Point{1, 2}

pp := new(Point)
*pp = Point{1, 2}
```

#### 结构体的零值与比较
结构体类型的零值是每个成员都是零值。如果结构体没有任何成员的话就是空结构体，写作`struct{}`。它的大小为0，也不包含任何信息，通常用作占位。

如果结构体的全部成员都是可以比较的，那么结构体也是可以比较的。可比较的结构体类型和其他可比较的类型一样，可以用于map的key类型。

```Go
type address struct {
  hostname string
  port int
}

hits := make(map[address]int)
hits[address{"golang.org", 443}]++
```

### 5.2 结构体的嵌入与匿名变量
#### 结构体嵌入
结构体嵌入是 Go 语言提供的类似类继承机制，形式上是让一个命名的结构体包含另一个结构体类型的匿名成员，目的是实现通过简单的点运算符x.f来访问匿名成员链中嵌套的x.d.e.f成员的机制。说起来很复杂，举个例子。考虑一个图形系统，我们需要定义点，线，圆。显然圆可以在点即园心的基础上添加半径来表示。在 Go 中可以使用下面的结构体表示这样的结构。

```Go
// 点
type Point struct {
  X, Y int
}
// 圆
type Circle struct {
  Center Point
  Radius int
}

type Wheel struct {
  Circle Circle
  Spokes int
}
// 创建圆
var w Wheel
w.Circle.Center.X = 8
w.Circle.Center.Y = 8
w.Circle.Radius = 5
w.Spokes = 20
```

如上所示，现在想访问Wheel的结构体成员 `X` 将变的异常繁琐。而结构嵌入就是为了在满足上面结构不变的情况，实现 `w.X` 成员快速访问。结构体声明如下所示:

```Go

type Point struct {
  X, Y int
}

type Circle struct {
  Point        // 匿名成员
  Radius int
}

type Wheel struct {
  Circle       // 匿名成员
  Spokes int
}

var w Wheel
w.X = 8 // equivalent to w.Circle.Point.X = 8
w.Y = 8 // equivalent to w.Circle.Point.Y = 8
w.Radius = 5 // equivalent to w.Circle.Radius = 5
w.Spokes = 20
```

`Point`，`Circle` 此时为匿名成员。所谓匿名成员，就是只声明一个成员对应的数据类型而不指名成员的名字。匿名成员并不是没有名字，其名字就是命名的类型名字，但是这些名字在点操作符中是可选的。上面 `w.Circle.Point.X = 8` 这样的访问方式依旧是合法的。

不幸的是，结构体字面值并没有简短表示匿名成员的语法， 因此下面的语句都不能编译通过。结构体字面值必须遵循形状类型声明时的结构

```Go
// 错误
w = Wheel{8, 8, 5, 20} // compile error: unknown fields
w = Wheel{X: 8, Y: 8, Radius: 5, Spokes: 20} // compile error: unknown fields

// 正确
w = Wheel{Circle{Point{8, 8}, 5}, 20}
w = Wheel{
  Circle: Circle{
    Point: Point{X: 8, Y: 8},
    Radius: 5,
  },
  Spokes: 20, // NOTE: trailing comma necessary here (and at Radius)
}
```

#### 匿名变量的使用要求
需要注意的是 Go 对匿名成员的使用存在一些约束:
1. 匿名成员的数据类型必须是命名的类型或指向一个命名的类型的指针
2. 因为匿名成员也有一个隐式的名字，因此不能同时包含两个类型相同的匿名成员，这会导致名字冲突
3. 因为成员的名字是由其类型隐式地决定的，所有匿名成员也有可见性的规则约束

~~比如将上面改成小写字母开头的point和circle），此时在包内依旧可以使用 `w.X = 8`；但是在包外部，因为circle和point没有导出不能访问它们的成员，因此简短的匿名成员访问语法也是禁止的。~~

匿名结构的可见性只与属性和方法的获取的表达式有关，比如将上面改成小写字母开头的point和circle），在包外部不能通过 `w.point.X` 访问成员 X，但是可以通过 `w.X` 直接访问成员 X。下面是另一个例子:

```go
//1. pkg 包内定义 animal 和 Dog

package pkg

type animal struct {
	Name string
}

type Dog struct {
	animal
	Weight int
}

func NewDog() Dog {
	return Dog{animal{"aaa"}, 100}
}
func (g Dog) GetName() string {
	return g.Name
}

func (g *Dog) GetWeight() int {
	return g.Weight
}

// 2 mian 包内使用
package main

import (
	"fmt"
	"mygo/pkg"
)

func main() {
	g := pkg.NewDog()
	fmt.Printf("%T, %#v\n", g, g)
	fmt.Println(g.Weight)  // 注意: 此处我们可以直接访问 g.Weight
	fmt.Println(g.Name)
	fmt.Printf("%T\n", (*pkg.Dog).GetName)   //  func(*pkg.Dog) string 
	fmt.Printf("%T\n", (*pkg.Dog).GetWeight) // func(*pkg.Dog) int
	fmt.Printf("%T\n", pkg.Dog.GetName)      // func(pkg.Dog) string
	// fmt.Printf("%T\n", pkg.Dog.GetWeight)

}
```

最后匿名成员并不要求是结构体类型；其实任何命名的类型都可以作为结构体的匿名成员。但是为什么要嵌入一个没有任何子成员类型的匿名成员类型呢？答案是匿名类型的方法集。

简短的点运算符语法可以用于选择匿名成员嵌套的成员，也可以用于访问它们的方法。实际上，外层的结构体不仅仅是获得了匿名成员类型的所有成员，而且也获得了该类型导出的全部的方法。

这个机制可以用于将一个有简单行为的对象组合成有复杂行为的对象。组合是Go语言中面向对象编程的核心。我们在下一章将方法时会再来讨论。
