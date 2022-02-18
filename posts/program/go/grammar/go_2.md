---
weight: 1
title: "go 变量及流程控制"
date: 2021-01-02T22:00:00+08:00
lastmod: 2021-01-02T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go 变量与流程控制语法"
featuredImage: /images/go/grammar/hello_world.jpg

tags: ["go 语法"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

Golang Hello World!

<!-- more -->


## 1. Hello World
抛开数据结构，代码封装和复杂的库文件，我们接触一门新语言的第一步可能就是学会这门语言的基础语法。下面是我写的 go 的一个 “Hello World” 程序。在这个简单的代码中包含了很多 Go 基础语法的内容:
1. 变量及常量的命名，声明和创建
2. 条件判断和循环
3. 变量的生命周期与作用域

下面我们就分成这几块来讲讲 Go 的基础语法。

```Go
package main

import "fmt"

const defaultUser = "unsigned"

func main() {
	name := "A"
	if name == defaultUser {
		fmt.Println("Helll man")
	} else {
		fmt.Println("Hey it is you")
	}

	num := 100
	r := 0
	for i := 0; i <= num; i++ {
		r += i
	}
	fmt.Println(r)
}

```

## 2. 变量及常量的命名，声明和创建
### 2.1 命名规则
几乎所有的编程语言变量，常量，函数以及类型的命名规则都是相同的，即一个名字必须以一个字母或下划线开头，后面可以跟任意数量的字母、数字或下划线。

Go 与众不同的是名称中可以包含Unicode字母(不建议使用)，并且使用`名字的开头字母的大小写决定了名字在包外的可见性`。关于变量的导出我们会在模块的相关内容详述。

习惯上，Go语言程序员推荐使用`驼峰式`命名。

### 2.2 声明和创建
Go语言主要有四种类型的声明语句：`var、const、type和func`，分别对应变量、常量、类型和函数实体对象的声明。我们先说变量以及常量。

与 Python 这种动态语言不同的是，Go 是静态语言，变量必须先声名才能使用。Go 中变量可以看成一个“容器”，一个变量对应一个保存了变量对应类型值的内存空间；变量一经声明，其类型就不能再改变。下面是 Go 中声明和创建变量的几种方式:

```Go
//方式一: var 声明语句
var name string = "abc"
var i, j, k int
var b, f, s = true, 2.3, "four"

//方式二: 函数内的短变量声明，用于局部变量的声明和初始化
t := 10
i, j := 0, 1

//方式三: new 函数，创建变量，并返回对应变量的指针
p := new(int)   // 此处创建了两个变量: new 函数创建的匿名变量，以及指向匿名变量的指针变量 p
*p = 2
```

#### var
var声明语句可以创建一个特定类型的变量，然后给变量附加一个名字，并且设置变量的初始值。对于 `var 变量名字 类型 = 表达式`，“类型”或“= 表达式”两个部分可以省略其中的一个。
- 如果省略的是类型信息，那么将根据初始化表达式来推导变量的类型信息。
- 如果初始化表达式被省略，那么将用零值初始化该变量，规则如下
  - 数值类型变量对应的零值是0
  - 布尔类型变量对应的零值是false
  - 字符串类型对应的零值是空字符串
  - 接口或引用类型（包括slice、指针、map、chan和函数）变量对应的零值是nil
  - 数组或结构体等聚合类型对应的零值是每个元素或字段都是对应该类型的零值

常量的声明和创建使用 const 声明语句，用法与 var 类似。

#### 短变量声明
短变量声明语句用在函数内，用于声名和初始化局部变量，语法为`变量名:=表达式`，变量的类型根据表达式自动推导。Go 的短变量声明有一些微妙之处:
1. 首先“:=”是一个变量声明语句，而“=”是一个变量赋值操作
2. 其次，简短变量声明左边的变量可以包含已经声明过的变量，对于这些变量将只是赋值，而不是再声明
3. 最后，简短变量声明语句中必须至少要声明一个新的变量否则无法通过编译

### new 函数
`new` 是 Go 预定义的一个函数，`new(T)`将创建一个T类型的匿名变量，初始化为T类型的零值，然后返回变量地址。

用new创建变量和普通变量声明语句方式创建变量没有什么区别，除了不需要声明一个临时变量的名字外。因为 `new` 只是一个普通函数，因此可以使用在任何函数可用的地方，甚至`new`名字可以被重定义其他类型。


## 3. 条件判断和循环
看完了变量创建，我们再来看看 Go 为我们提供的逻辑控制语句: `if, switch, for`。Go 没有 while 语句，但是 for 语句包含了 while 语句的功能。除了 `if` 外，`switch` 和 `for` 的用法都不简单。

除了这些基础的逻辑控制语句外，Go 还有一个特殊的与 Go 高并发相关的多路复用器 `select`。

### 3.1 if
Go 应该是类 C 风格的语言，使用 `{}` 来分隔代码块。一个完整的 `if` 语句如下所示:
```Go
if r == 0 {
  fmt.Println("aaa")
} else if r == 1 {
  fmt.Println("bbbb")
} else {
  fmt.Println("cccc")
}
```

### 3.2 switch
switch 是多分支条件判断的便捷语法，用于基于不同条件执行不同动作，Go 的 switch 有如下三种使用方式。

```Go
//方式一: 变量值判断
switch var1 {          
    case v1:       // var1 变量与 case 语句中的值类型必须相同
        ...
    case v2,v3:    // 逗号分隔表示可匹配多个值
        ...
    default:
        ...
}

// 方式二: 条件判断的变形
switch  {
  case condition1:
    ...
  case condition2, condition3: // 逗号分隔表示可匹配多个条件
    ...
  default:
    ...
}

// 方式三:  type-switch 用来判断某个 interface 变量中实际存储的变量类型
// 我们会在后面讲接口类型时详述
switch x.(type) {
  case type1:
    ....
  case type2:
    ....
  default:
    ....
}
```

不同语言的 switch 语句差异很大，Go 的 switch 有如下特点:
1. switch 语句的执行过程是从上直下逐一测试，直到匹配就会停止
2. 每个 case 分支的最后不需要再加break，即默认只会执行第一个匹配到的 case 分支

Python 中没有 switch 语句，shell 脚本则必须在每个 case 分支之后添加 break，否则第一次匹配成功后后，会继续匹配之后的 case 分支。

### 3.3 select
select 类似于用于通信的switch语句，它的一个使用示例如下所示:
```Go
func main() {
   var c1, c2 chan int
   var i1, i2 int
   select {
      case i1 = <-c1:
         fmt.Printf("received ", i1, " from c1\n")
      case c2 <- i2:
         fmt.Printf("sent ", i2, " to c2\n")
      default:
         fmt.Printf("no communication\n")
 }    
```
在 select 中:
1. 每个case必须是一个通信操作，要么是发送要么是接收
2. 所有channel表达式都会被求值，如果有多个 case 可以运行，select会随机执行一个可运行的case
3. 如果没有case可运行，此时
  - 如果有default子句，则执行该语句，defalut 子句应该总是可运行的
  - 如果没有default字句，select将阻塞，直到某个通信可以运行；Go不会重新对channel或值进行求值

### 3.3 for
Go 的 for 循环有四种常见的使用方式，如下所示。最特殊的是第四种 `for 循环的 range 格式`，它可以对 slice、map、数组、字符串等进行迭代循环。

```Go
//方式一: 典型的类 C for 循环
for init; condition; post {

}

//方式二: 类 while 循环
for condition {

}

//方式三: 无限循环
for {

}

//无限循环的另一种方式
for true {

}

//方式四: 类Python 的迭代循环
for index, value := range oldMap {
  // index: 索引
  // value: 索引对应的值
}
```

## 4. 变量的生命周期与作用域
变量的生命周期指的是在程序运行期间变量有效存在的时间间隔，变量作用域是指源代码中可以有效使用这个名字的范围。虽然我将变量的生命周期与作用域放在一起，但是其实它们之间并没有什么联系。声明语句的作用域对应的是一个源代码的文本区域；它是一个
编译时的属性。一个变量的生命周期是指程序运行时变量存在的有效时间段，在此时间区域内它可以被程序的其他部分引用；是一个运行时的概念。

Go 与 Python 类似，通过引用计数的方式，解释器会自动实现对象内存的分配和释放。变量的生命周期取决于变量是否可达，即其引用计数是否为 0，而与变量的作用域无关。虽然大多数位于函数内的局部变量的生命周期都是函数调用的存续区间，但是函数内的局部变量可以"逃逸"成为全局变量，或者从函数返回，从而延长生命周期。

变量的作用域取决于变量声明语句所在的语法块(又称词法域)，语法块通常由花括号显示限定，除此之外还有一些特殊的语法块。对于 Go 作用域从大到小依次是:
1. 整个源代码，称为全局语法块
2. 每个包的包语法块
3. 每个源文件的源文件级的语法块
4. 由显示花括号限定的由外而内的语法块
5. 对于 `if,for,switch,select` 还有隐式的语法块

一个程序可能包含多个同名的声明，只要它们在不同的作用域。位于内部作用域的变量声明显然会覆盖外部的同名变量。对于大多数程序的作用于而言，都有类似规则。而 Go 比较特殊的是 `if,for,switch,select`引入的隐式作用域。

#### if, for 等的隐式作用域
```Go
if x := f(); x == 0 {
  fmt.Println(x)
} else if y := g(x); x == y {
  fmt.Println(x, y)
} else {
  fmt.Println(x, y)
}
fmt.Println(x, y) // compile error: x and y are not visible here
```

在上面的示例中存在多个作用域，从大到小依次是:
1. 全局作用域
2. 外层 if 语句条件部分创建隐式词法域
3. 外层 if 语句花括弧包含的显式作用域
4. 内层 if 语句条件部分创建隐式词法域
5. .....

因此内层 if 语句的条件测试部分，能访问到外层 if 语句条件部分声明的变量 x。for 语句循环的初始化部分，switch 语句的条件测试部分都会引入类似的隐式作用域。

变量的作用域问题说起来比较复杂，但是大多数情况下，只要我们不在不同的作用域内声明同名变量，导致变量覆盖，基本上都不会现问题。但是在 Go 中要特别注意短变量声明语句的作用域。

在下面的示例中，虽然cwd在外部已经声明过，但是 `:=` 语句还是将cwd和err重新声明为新的局部变量。因为内部声明的cwd将屏蔽外部的声明，因此上面的代码并不会正确更新包级声明的cwd变量。

```Go
var cwd string
func init() {
  cwd, err := os.Getwd() // compile error: unused: cwd
  if err != nil {
    log.Fatalf("os.Getwd failed: %v", err)
  }
}

// 正确做法
var cwd string
func init() {
  var err error  # 单独声明 err 变量
  cwd, err = os.Getwd()
  if err != nil {
    log.Fatalf("os.Getwd failed: %v", err)
  }
}
```

最后，Go 变量遵循先声明后使用的规则，但是在包级别，声明的顺序并不会影响作用域范围，因此一个先声明的可以引用它自身或者是引用后面的一个声明，这可以让我们定义一些相互嵌套或递归的类型或函数。
