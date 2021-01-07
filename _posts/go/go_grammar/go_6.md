---
title: 6 go 方法
date: 2019-01-06
categories:
    - Go
tags:
    - go语言入门
---

Go 的对象组合技术
<!-- more -->

![Hello World](/images/go/grammar/go_func.jpg)

## 1. 内容概要
方法是面向对象编程(OOP)中的概念。有关 OOP 的定义我也说不清楚。但是与概念相比，更重要的是OOP的两个关键点:**封装和组合**。我们的目的是看看 Go 语言如何通过**结构体嵌入**等技术实现这两个关键点。

Go 语言中的方法和接口密切相关，接口是 Go 语言提供的用来支持泛型编程的核心组件，我们会在下一章详细讨论。现在我们只需要明白:
1. 方法是与特定类型关联的函数，可以被声明到任意命名类型，包括 Go 的内置类型;但不能是一个指针或者一个接口类型
2. 方法分为值方法和指针方法两类，这会影响到类型是否属于特定接口的判断

## 2. 方法
### 2.1 方法声明
在函数声明时，在其名字之前放上一个变量，即是一个方法。这个附加的参数会将该函数附加到这种类型上，即相当于为这种类型定义了一个独占的方法。

```Go
type Point struct{ X, Y float64 }

// 1. 为 Point 定义一个值方法
// 参数p，叫做方法的接收器(receiver)
func (p Point) Distance(q Point) float64 {
  return math.Hypot(q.X‐p.X, q.Y‐p.Y)
}

// 2. 调用方法
p := Point{1, 2}
q := Point{4, 6}
fmt.Println(p.Distance(q)) // "5", method call
```

从上面的示例可以看出来，在方法的定义和调用等行为上，Go 与 Python 并没有什么太大差别。有一点不同的是，当出现命名冲突时，Python 的默认行为是覆盖，而 Go 在编译阶段就直接失败。此外需要注意的是方法和属性在同一命名空间，因此它们之间的命名冲突也是不允许的。


### 2.2 值方法与指针方法
前面函数的部分我们说过，Go 中实参通过值的方式传递。类似的，传递给方法接收器的对象也是按值传递。在上面的 `Distance` 内接收器 `p` 是外部 `p` 对象的拷贝。相对应的我们可以像下面这样，用其指针而不是对象来声明方法。

```Go
func (p *Point) ScaleBy(factor float64) {
  p.X *= factor
  p.Y *= factor
}
```

### 2.3 接收器限制
只有类型`(Point)`和指向他们的指针`(*Point)`，才是可能会出现在接收器声明里的两种接收器。为了避免歧义，在声明方法时，如果一个类型名本身是一个指针的话，是不允许其出现在接收器中的，比如下面这个例子。即我们不能为指针定义方法。

```Go
type P *int
func (P) f() { /* ... */ } // compile error: invalid receiver type
```

### 2.4 方法调用中的隐式转换
原则上，类型 `Point`只能调用其值方法，`*Point`只能调用其指针方法。这样在方法的调用中会有很多转换操作。幸运的是，Go 为我们提供了隐示的转换，就像我们直接通过指针去访问结构的成员变量一样。

```Go
p := Point{1, 2}
pptr := &p

// type --> *type
p.ScaleBy(2) // 等同于
(&p).ScaleBy(2)

// *type --> type
pptr.Distance(q)  // 等同于
(*pptr).Distance(q)
```

需要特别注意的是 `type --> *type` 转换的前提是对象是可取址的。我们不能通过一个无法取到地址的接收器来调用指针方法，比如临时变量：

```Go
Point{1, 2}.ScaleBy(2) // compile error: can't take address of Point literal
```

### 2.5 类型的方法集合
如上所述，正因为我们总是可以通过对一个地址解引用(\*)来获取变量，但是却不一定能获取一个对象的地址(临时对象)，所以一个自定义数据类型的方法集合中仅会包含它的所有值方法，而该类型的指针类型的方法集合却囊括了前者的所有方法，包括所有值方法和所有指针方法。

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
	fmt.Println(g.Weight)                    // 注意: 此处我们可以直接访问 g.Weight
	fmt.Println(g.Name)
	fmt.Printf("%T\n", (*pkg.Dog).GetName)   //  func(*pkg.Dog) string 
	fmt.Printf("%T\n", (*pkg.Dog).GetWeight) // func(*pkg.Dog) int
	fmt.Printf("%T\n", pkg.Dog.GetName)      // func(pkg.Dog) string
	// fmt.Printf("%T\n", pkg.Dog.GetWeight)

}
```

在上面的示例中:
1. 通过结构体直接访问方法，我们将获取一个方法值，值方法是一个函数，其接受的参数与调用的方式有关，以结构体调用，返回的函数需要接受结构体，以结构体指针调用，返回的函数需要接受结构体的指针
2. 所有的值方法可以通过结构体，也可以通过结构体的指针进行访问，所有的指针方法只能通过结构体指针进行访问
3. 这里也反应出一个自定义数据类型的方法集合中仅会包含它的所有值方法，而该类型的指针类型的方法集合却囊括了前者的所有方法，包括所有值方法和所有指针方法。

## 3. 结构体嵌入
### 3.1 结构体嵌入与类的继承
在结构体一节中，我们就已经提到了，结构体中通过匿名字段嵌入的不仅仅是结构体的成员还是其方法。以下面嵌入了 `Point` 的 `ColoredPoint` 为例，我们可以把ColoredPoint类型当作接收器来调用Point里的方法，即使ColoredPoint里没有声明这些方法。

```Go
import "image/color"
type Point struct{ X, Y float64 }
type ColoredPoint struct {
  Point
  Color color.RGBA
}

red := color.RGBA{255, 0, 0, 255}
blue := color.RGBA{0, 0, 255, 255}
var p = ColoredPoint{Point{1, 1}, red}
var q = ColoredPoint{Point{5, 4}, blue}

fmt.Println(p.Distance(q.Point)) // "5"
p.ScaleBy(2)
q.ScaleBy(2)
fmt.Println(p.Distance(q.Point)) // "10"
```

这种行为看起来跟 OOP 类的继承一样，但是有本质区别。最明显的地方是，在类的继承中，子类的实例也是基类的实例，但是在结构体嵌入中，`ColoredPoint` 类型的"实例"，并不是 `Point` 的"实例"。

请注意上面例子中对Distance方法的调用。尽管q有着Point这个内嵌类型，但是q并不是一个Point类，我们必须要显式地选择它。

```Go
p.Distance(q.Point) // right
p.Distance(q) // compile error: cannot use q (ColoredPoint) as Point
```

在 Go 的结构体嵌入中，我们只能说 `ColoredPoint  has a Point` 而不能说 `ColoredPoint 继承自 Point`。内嵌可以使我们将复杂类型的定义拆分，将字段先按小类型分组，然后定义小类型的方法，之后再把它们组合起来。

### 3.2 嵌入命名类型的指针
在类型中内嵌的匿名字段也可能是一个命名类型的指针，添加这一层间接关系让我们可以共享通用的结构并动态地改变对象之间的关系。

```Go
type ColoredPoint struct {
  *Point
  Color color.RGBA
}

p := ColoredPoint{&Point{1, 1}, red}
q := ColoredPoint{&Point{5, 4}, blue}

// 注意访问 *q.Point 的区别
fmt.Println(p.Distance(*q.Point)) // "5"
q.Point = p.Point // p and q now share the same Point
p.ScaleBy(2)
fmt.Println(*p.Point, *q.Point) // "{2 2} {2 2}"
```

### 3.3 多匿名字段的查找顺序
如果结构体中嵌入了多个匿名字段，将遵循下面的字段和方法查找顺序:
1. 直接定义在类型里方法
2. 内嵌字段引入的方法
3. 内嵌字段的内嵌字段引入的方法，然后一直递归向下找
4. 如果在**同一级**里有两个同名的方法，编译器会报错

上面说的**同一级**可以理解为，由内嵌所构成的树的同一层。

```Go
type A struct {
  A1
}

type A1 struct {
}

type B struct {
  B1
}

type B1 struct{

}

func (a A1) name() {
  fmt.Println("a1")
}

func (b B1) name() {
  fmt.Println("b1")
}

type C struct {
  A
  B
}

c := C{}
// 同一级的  A1，B1 的 同名 name 方法导致编译错误
c.name() // ambiguous selector c.name
```

## 4. 封装
一个对象的变量或者方法如果对调用方是不可见的话，一般就被定义为“封装”。封装有时候也被叫做信息隐藏，同时也是面向对象编程最关键的一个方面。

Go语言只有一种控制可见性的手段：大写首字母的标识符会从定义它们的包中被导出，小写字母的则不会。这种限制包内成员的方式同样适用于struct或者一个类型的方法。因而如果我们想要封装一个对象，我们必须将其定义为一个struct。

这种基于名字的手段使得在语言中最小的封装单元是package。一个struct类型的字段对同一个包的所有代码都有可见性，无论你的代码是写在一个函数还是一个方法里。
