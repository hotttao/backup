---
weight: 1
title: "Go 语句与控制结构"
date: 2022-12-27T22:00:00+08:00
lastmod: 2022-12-27T22:00:00+08:00
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
 今天我们开始深入学习，Go 语言语法的基础: 语句、控制结构。
<!-- more -->

## 1. 表达式的求值顺序
Go语言支持在同一行声明和初始化多个变量（不同类型也可以），也支持在同一行对多个变量进行赋值

```go
var a, b, c = 5, "hello", 3.45
a, b, c = 5, "hello", 3.4
```

但这就牵扯到另一个问题: 表达式求值顺序（evaluation order）。比如 `n0, n1 = n0+n1, n0`

### 1.1 包级别变量声明语句中的表达式求值顺序
包级别变量声明语句中的表达式求值顺序由变量的声明顺序和初始化依赖（initialization dependencies）规则决定

初始化依赖规则是:
1. 在Go包中，包级别变量的初始化按照变量声明的先后顺序进行。
2. 如果某个变量（如变量a）的初始化表达式中直接或间接依赖其他变量（如变量b），那么变量a的初始化顺序排在变量b后面。
3. 未初始化的且不含有对应初始化表达式或初始化表达式不依赖任何未初始化变量的变量，我们称之为“ready for initialization”变量。
4. **包级别变量的初始化是逐步进行的，每一步就是按照变量声明顺序找到下一个“ready for initialization”变量并对其进行初始化的过程**。反复重复这一步骤，直到没有“ready for initialization”变量为止。
5. 位于同一包内但不同文件中的变量的声明顺序依赖编译器处理文件的顺序：先处理的文件中的变量的声明顺序先于后处理的文件中的所有变量。

我们看下面这个例子，由于初始化的过程就是寻找 “ready for initialization，并对其进行初始化，所以整个初始化会经过如下几轮的查找
1. 第一轮: 按照a -> b -> c -> d的顺序，查找“ready for initialization”变量并对其进行初始化，d 被初始化
2. 第二轮: 继续按照a -> b -> c -> d的顺序，a 依赖 b 和 c，不满足初始化条件，b依赖函数f，函数f依赖d，d 已经初始化，b 具备成为 ready for initialization 的条件，所以次轮初始化 b
3. 第三轮: 初始化 c
4. 第四轮: 初始化 a

```go
// chapter3/sources/evaluation_order_1.go
var (
    a = c + b
    b = f()
    // _ = f()  // _ 空变量，会得到一视同仁的处理
    c = f()
    d = 3
)

func f() int {
    d++
    return d
}

func main() {
    fmt.Println(a, b, c, d)
}
```

还有一种比较特殊的情况，那就是当多个变量在声明语句左侧且**右侧为单一表达式**时的表达式求值情况。在这种情况下，无论左侧哪个变量被初始化，同一行的其他变量也会被一并初始化。

```go
// chapter3/sources/evaluation_order_3.go
var (
    a    = c
    b, c = f()
    d    = 3
)

func f() (int, int) {
    d++
    return d, d + 1
}

func main() {
    fmt.Println(a, b, c, d)
}
```

根据包级变量初始化规则，初始化过程将按照**a -> b&c -> d**顺序进行“ready for initialization”变量的查找:
1. 第一轮: d 初始化
2. 第二轮：变量b和c一起符合条件，以b被选出为例，b被初始化的同时，c也得到了初始化
3. 第三轮：a 初始化

### 1.2 普通求值顺序
普通求值顺序（usual order），用于规定表达式操作数中的函数、方法及channel操作的求值顺序。Go规定表达式操作数中的所有函数、方法以及channel操作按照从左到右的次序进行求值。

我们看这样一个表达式的求值顺序: `y[f()], _ = g(h(), i()+x[j()], <-c), k()`
1. 按照从左到右的顺序，先对等号左侧表达式操作数中的函数进行调用求值，因此第一个是y[f()]中的f()。
2. 接下来是等号右侧的表达式。第一个函数是g()，但g()依赖其参数的求值，其参数列表依然可以看成是一个多值赋值操作，其涉及的函数调用顺序从左到右依次为h()、i()、j()、<-c，这样该表达式操作数函数的求值顺序即为h() -> i() -> j() -> c取值操作 -> g()。
3. 最后还剩下末尾的k()。

当普通求值顺序与包级变量的初始化依赖顺序一并使用时，后者优先级更高，但每个单独表达式中的操作数求值依旧按照普通求值顺序的规则。

我们看这样一个表达式的求值顺序: 

```go
var a, b, c = f() + v(), g(), sqr(u()) + v()

func f() int {
    fmt.Println("calling f")
    return c
}
```

单行的多变量赋值，可以转换为如下等价形式(注意，这里不是右侧为单一表达式)

```go
var (
    a = f() + v() // f 依赖 c
    b = g()  // g() 不依赖其他变量
    c = sqr(u()) + v()
)
```

根据包级变量初始化规则，初始化过程将按照"a -> b -> c"顺序进行“ready for initialization”变量的查找:
1. 第一轮：变量a依赖c，b符合条件，b被选出并初始化。依据普通求值顺序规则，g被调用。
2. 第二轮：变量c符合条件，c被选出并初始化。依据普通求值顺序规则，**u、sqr**、v先后被调用。
3. 第三轮：变量a符合条件，a被选出并初始化。依据普通求值顺序规则，f、v先后被调用。

## 1.3 赋值语句的求值
Go语言规定，赋值语句求值分为两个阶段：
1. 第一阶段，**对于等号左边的下标表达式、指针解引用表达式和等号右边表达式中的操作数，按照普通求值规则从左到右进行求值**；
2. 第二阶段，按从左到右的顺序对变量进行赋值。

所以对于 `n0, n1 = n0 + n1, n0` 假定 `n0, n1 = 1, 2`
1. 第一阶段：等号两端表达式求值。上述问题中，等号左边没有需要求值的下标表达式、指针解引用表达式等，只有右端有n0+n1和n0两个表达式，但表达式的操作数(n0，n1)都是已初始化了的，因此直接将值代入，得到求值结果。求值后，语句可以看成n0, n1 = 3, 1
2. 第二阶段：从左到右赋值，即n0 =3，n1 = 1

### 1.4 switch/select语句中的表达式求值
#### switch
先来看switch-case语句中的表达式求值，这类求值属于“惰性求值”范畴。惰性求值指的就是需要进行求值时才会对表达值进行求值。

```go
func Expr(n int) int {
    fmt.Println(n)
    return n
}

func main() {
    switch Expr(2) {
        case Expr(1), Expr(2), Expr(3):
            fmt.Println("enter into case1")
            fallthrough
        case Expr(4):
            fmt.Println("enter into case2")
   }
}

$go run evaluation_order_7.go
2
1
2
enter into case1
enter into case2
```

从输出可以看出:
1. 对于switch-case语句而言，首先进行求值的是switch后面的表达式Expr(2)
2. 接下来将按照从上到下、从左到右的顺序对case语句中的表达式进行求值。如果某个表达式的结果与switch表达式结果一致，那么求值停止，后面未求值的case表达式将被忽略。
3. fallthrough 将执行权直接转移到下一个case执行语句中了，略过了case表达式Expr(4)的求值。

#### select
select 的求值顺序，直接看下面这个例子:

```go
func getAReadOnlyChannel() <-chan int {
    fmt.Println("invoke getAReadOnlyChannel")
    c := make(chan int)

    go func() {
        time.Sleep(3 * time.Second)
        c <- 1
    }()

    return c
}

func getASlice() *[5]int {
    fmt.Println("invoke getASlice")
    var a [5]int
    return &a
}

func getAWriteOnlyChannel() chan<- int {
    fmt.Println("invoke getAWriteOnlyChannel")
    return make(chan int)
}

func getANumToChannel() int {
    fmt.Println("invoke getANumToChannel")
    return 2
}

func main() {
    select {
    // 从channel接收数据
    case (getASlice())[0] = <-getAReadOnlyChannel():
       fmt.Println("recv something from a readonly channel")
    // 将数据发送到channel
    case getAWriteOnlyChannel() <- getANumToChannel():
        fmt.Println("send something to a writeonly channel")
    }
}

$go run evaluation_order_8.go
invoke getAReadOnlyChannel
invoke getAWriteOnlyChannel
invoke getANumToChannel
```

从上述例子可以看出以下两点：
1. select执行开始时，首先所有case表达式都会被按出现的先后顺序求值一遍
2. 有一个例外，位于case等号左边的从channel接收数据的表达式（RecvStmt）不会被求值，即这里的 getASlice()。如果**选择要执行的是一个从channel接收数据的case，那么该case等号左边的表达式在接收前才会被求值**。比如在上面的例子中，在getAReadOnlyChannel创建的goroutine在3s后向channel中写入一个int值后，select选择了第一个case执行，此时对等号左侧的表达式(getASlice())[0]进行求值，这也算是一种惰性求值。

## 2. 代码块与作用域
### 2.1 Go 的代码块与作用域
Go语言中有两类代码块，一类是我们在代码中直观可见的由一堆大括号包裹的显式代码块，比如函数的函数体、for循环的循环体、if语句的某个分支等。

另一类则是没有大括号包裹的隐式代码块。Go规范定义了如下几种隐式代码块:
1. 宇宙（Universe）代码块：所有Go源码都在该隐式代码块中，就相当于所有Go代码的最外层都存在一对大括号
2. 包代码块：每个包都有一个包代码块，其中放置着该包的所有Go源码
3. 文件代码块：每个文件都有一个文件代码块，其中包含着该文件中的所有Go源码
4. **每个if、for和switch语句均被视为位于其自己的隐式代码块中**
5. **switch或select语句中的每个子句都被视为一个隐式代码块**

Go标识符的作用域是基于代码块定义的，作用域规则描述了标识符在哪些代码块中是有效的。下面是标识符作用域规则。
1. 预定义标识符，make、new、cap、len等的作用域范围是宇宙块。
2. 顶层（任何函数之外）声明的常量、类型、变量或函数（但不是方法）对应的标识符的作用域范围是包代码块。比如：包级变量、包级常量的标识符的作用域都是包代码块。
3. Go源文件中**导入的包名称**的作用域范围是文件代码块。
4. 方法接收器（receiver）、函数参数或返回值变量对应的标识符的作用域范围是函数体（显式代码块），虽然它们并没有被函数体的大括号所显式包裹。
5. 在函数内部声明的常量或变量对应的标识符的作用域范围**始于常量或变量声明语句的末尾，止于其最里面的那个包含块的末尾**
6. 在函数内部声明的类型标识符的作用域范围始于类型定义中的标识符，止于其最里面的那个包含块的末尾

### 2.2 if 语句的代码块
我们先来了解一下 if 条件控制语句的代码块分布规则。

#### 单if型
单if型，即

```go
if SimpleStmt; Expression {
    ...
}
```

根据代码块规则，if语句自身在一个隐式代码块中，因此单if类型的控制语句中有两个代码块：一个隐式代码块和一个显式代码块。所以上面的 if 语句等价于:

```go
{ // 隐式代码块开始
    SimpleStmt

    if Expression { // 显式代码块开始
            ...
    } // 显式代码块结束

} // 隐式代码块结束
```

### if { } else { }型
```go
if Simplestmt; Expression {
    ...
} else {
    ...
}
```

等价于:

```go
{ // 隐式代码块开始
    SimpleStmt

    if Expression { // 显式代码块1开始
        ...
        // 显式代码块1结束
    }  else  { // 显式代码块2开始
        ...
    }   // 显式代码块2结束

} // 隐式代码块结束
```

所以在SimpleStmt中声明的变量，其作用域范围可以延伸到else后面的显式代码块中。

#### if {} else if {} else {} 型
```go
if SimpleStmt1; Expression1 {
    ...
} else if SimpleStmt2; Expression2 {
    ...
} else {
    ...
}
```

等价于:

```go
{ // 隐式代码块1开始
    SimpleStmt1

    if Expression1 { // 显式代码块1开始
        ...
    } else { // 显式代码块1结束；显式代码块2开始
        {  // 隐式代码块2开始
            SimpleStmt2

            if Expression2 { // 显式代码块3开始
                ...
            } else { // 显式代码块3结束；显式代码块4开始
                ...
            } // 显式代码块4结束
        } // 隐式代码块2结束
    } // 显式代码块2结束
} // 隐式代码块1结束
```

### 2.3 for 语句的代码块
#### 第一种 for 语句

```go
for InitStmt; Condition; PostStmt {
    ...
}
```

等价于:

```go
{ // 隐式代码块开始
    InitStmt
    for Condition; PostStmt {
        // for显式代码块
        ...
    }
} // 隐式代码块结束
```

#### 第二种 for 语句

```go
for IndentifierList := range Expression {
    ...
}

```

等价于:

```go
{ // 隐式代码块开始
    IndentifierList := InitialValueList
    for IndentifierList = range Expression {
        // for的显式代码块
        ...
    }
} // 隐式代码块结束
```

### 2.4 switch-case语句的代码块

```go
switch SimpleStmt; Expression {
    case ExpressionList1:
        ...
    case ExpressionList2:
        ...
    default:
        ...
}
```

等价于:

```go
{ // 隐式代码块1开始
    SimpleStmt
    switch Expression { // 显式代码块1开始
        case ExpressionList1:
        { // 隐式代码块2开始
            ...
        } // 隐式代码块2结束
        case ExpressionList2:
        { // 隐式代码块3开始
            ...
        } // 隐式代码块3结束
        default:
        { // 隐式代码块4开始
            ...
        } // 隐式代码块4结束
    } // 显式代码块1结束
} // 隐式代码块1结束
```

### 2.5 select-case语句的代码块
和switch-case无法在case子句中声明变量不同的是，select-case可以在case字句中通过短变量声明定义新变量，但该变量依然被纳入case的隐式代码块中。

```go
select {
    case SendStmt:
        ...
    case RecvStmt:
        ...
    default:
        ...
}
```

等价于:

```go
select { // 显式代码块开始
    case SendStmt:
    { // 隐式代码块1开始
        ...
    } // 隐式代码块1结束
    case RecvStmt:
    { // 隐式代码块2开始，如果RecvStmt声明了新变量，那么该变量也应包含在隐式代码块2中
      // 等同于 RecvStmt 声明在这
        ...
    } // 隐式代码块2结束
    default:
    { // 隐式代码块3开始
        ...
    } // 隐式代码块3结束
} // 显式代码块结束
```

## 3. 控制语句最佳实践
最后我们来介绍一些 Go 控制语句的惯用法，掌握这些，可以让我们写出更符合 go 思维的代码。

### 3.1 使用if控制语句时应遵循“快乐路径”原则
```go
func doSomething() error {
    if errorCondition1 {
        // 错误逻辑
        ...
        return err1
    }

    // 成功逻辑
    ...

    if errorCondition2 {
        // 错误逻辑
        ...
        return err2
    }

    // 成功逻辑
    ...
    return nil
}

```

所谓“快乐路径”即成功逻辑的代码执行路径，这个原则要求：
1. 当出现错误时，快速返回；
2. 成功逻辑不要嵌入if-else语句中；
3. “快乐路径”的执行逻辑在代码布局上始终靠左，这样读者可以一眼看到该函数的正常逻辑流程；
4. “快乐路径”的返回值一般在函数最后一行，就像上面伪代码段中的那样

### 3.2 for range的避“坑”指南
#### 迭代变量的重用
for range的惯用法是使用短变量声明方式（:=）在for的initStmt中声明迭代变量（iteration variable）。但需要注意的是，这些迭代变量在for range的每次循环中都会被重用，而不是重新声明。这是因为根据for 语句的代码块作用域的说明: 

```go
for InitStmt; Condition; PostStmt {
    ...
}
```

等价于:

```go
{ // 隐式代码块开始
    InitStmt
    for Condition; PostStmt {
        // for显式代码块
        ...
    }
} // 隐式代码块结束
```
我们就可以清晰地看到迭代变量的重用。典型的错误，就是像下面这样:

```go
func demo1() {
    var m = [...]int{1, 2, 3, 4, 5}

    for i, v := range m {
        go func() {
            time.Sleep(time.Second * 3)
            fmt.Println(i, v)
        }()
        // }(i, v) 正确的方式是讲 i,v 作为参数传入
    }
    time.Sleep(time.Second * 10)

}
```

goroutine执行的闭包函数引用了它的外层包裹函数中的变量i、v，这样变量i、v在主goroutine和新启动的goroutine之间实现了共享。而i、v值在整个循环过程中是重用的，仅有一份。所有的 goroutine 都会输出 4,5。

#### 参与迭代的是range表达式的副本
for range语句中，range后面接受的表达式的类型可以是数组、指向数组的指针、切片、字符串、map和channel（至少需具有读权限）。我们以数组为例，看一个示例:

```go
func arrayRangeExpression() {
    var a = [5]int{1, 2, 3, 4, 5}
    var r [5]int

    fmt.Println("arrayRangeExpression result:")
    fmt.Println("a = ", a)

    for i, v := range a {
        if i == 0 {
            a[1] = 12
            a[2] = 13
        }

        r[i] = v
    }

    fmt.Println("r = ", r)
    fmt.Println("a = ", a)
}

// 实际运行该程序的输出结果
a =  [1 2 3 4 5]
r =  [1 2 3 4 5]
a =  [1 12 13 4 5]
```

出现这个结果的原因是：**参与循环的是range表达式的副本**。

Go中的数组在内部表示为连续的字节序列，虽然长度是Go数组类型的一部分，但长度并不包含在数组类型在Go运行时的内部表示中，数组长度是由编译器在编译期计算出来。这个例子中，对range表达式的复制即对一个数组的复制。因此无论a被如何修改，其参与循环的副本a'依旧保持原值。因为是副本，所以当 for change 迭代的对象是数组，会有性能损耗。

对于其他类型，比如切片，在迭代时修改被迭代对象的效果需要结合被迭代对象的具体实现来看

1. slice: 
    - slice 由(*T, len, cap)三元组组成，虽然是副本，但是底层数据是共享的，但是长度信息是独立，增加长度的修改，不会反应在副本上
2. string: 
    - string 表示为struct {*byte, len}，并且string本身是不可改变的（immutable），因此其行为和消耗与切片作为range表达式时类似
    - 不过 for range对于string来说，每次循环的单位是一个rune，而不是一个byte，返回的第一个值为迭代字符码点的第一字节的位置
    - 如果作为range表达式的字符串s中存在非法UTF8字节序列，那么v将返回0xfffd这个特殊值，并且在下一轮循环中，v将仅前进一字节
3. map:
    - map在Go运行时内部表示为一个hmap的描述符结构指针，因此 map 的副本也会指向同一个 hmap
    - for range无法保证每次迭代的元素次序是一致的。如果在循环的过程中对map进行修改，那么这样修改的结果是否会影响后续迭代过程也是不确定的
4. channel:
    - channel在Go运行时内部表示为一个channel描述符的指针，channel的副本也指向原channel 描述符
    - 当channel作为range表达式类型时，for range最终以阻塞读的方式阻塞在channel表达式上，即便是带缓冲的channel亦是如此：当channel中无数据时，for range也会阻塞在channel上，直到channel关闭

## 3.3 break
Go break语法的一个“小坑”，Go语言规范中明确规定 break语句（不接label的情况下）结束执行并跳出的是同一函数内break语句所在的最内层的for、**switch或select**的执行。

```go
func main() {
    exit := make(chan interface{})

    go func() {
    loop:
        for {
            select {
            case <-time.After(time.Second):
                fmt.Println("tick")
            case <-exit:
                fmt.Println("exiting...")
                break loop
            }
        }
        fmt.Println("exit!")
    }()

    time.Sleep(3 * time.Second)
    exit <- struct{}{}

    // 等待子goroutine退出
    time.Sleep(3 * time.Second)
}
```

上面例子中的，如果 break 不加 loop，实际上跳出了的是 select语句，不会跳出 for 循环。程序会一直执行。类似的 continue 也支持标签:

```go
outerLoop:
    for i := 0; i < n; i++ {
        // ...
        for j := 0; j < m; j++ {
            // 当不满足某些条件时，直接终止最外层循环的执行
            break outerLoop

            // 当满足某些条件时，直接跳出内层循环，回到外层循环继续执行
            continue outerLoop
        }
    }
```

### 3.4 switch case 的 fallthrough
go 提供了 fallthrough 关键字，将执行权直接转移到下一个switch case执行语句中。不过在实际编码过程中，fallthrough的应用依然不多，而且Go的switch-case语句还提供了case表达式列表来支持多个分支表达式处理逻辑相同的情况：

```go
switch n {
case 1, 3, 5, 7:
    odd()
case 2, 4, 6, 8:
    even()
default:
    unknown()
}
```
