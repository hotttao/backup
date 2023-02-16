---
weight: 1
title: "Go reflect"
date: 2023-01-10T22:00:00+08:00
lastmod: 2023-01-10T22:00:00+08:00
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

## 1. 反射
Go在标准库中提供的reflect包让Go程序具备运行时的反射能力（reflection，又称为自省）。反射是程序在运行时访问、检测和修改它本身状态或行为的一种能力，各种编程语言所实现的反射机制各有不同。Go语言的**interface{}类型变量具有析出任意类型变量的类型信息（type）和值信息（value）的能力**，Go的反射本质上就是利用interface{}的这种能力在运行时对任意变量的类型和值信息进行检视甚至是对值进行修改的机制。

### 1.1 go 反射
反射让静态类型语言Go在运行时具备了某种基于类型信息的动态特性。利用这种特性:
1. fmt.Println在无法提前获知传入参数的真正类型的情况下依旧可以对其进行正确的格式化输出；
2. json.Marshal也是通过这种特性对传入的任意结构体类型进行解构并正确生成对应的JSON文本。

下面通过一个简单的构建SQL查询语句的例子来直观感受Go反射的“魔法”：

```go
func ConstructQueryStmt(obj interface{}) (stmt string, err error) {
    // 仅支持struct或struct指针类型
    typ := reflect.TypeOf(obj)
    if typ.Kind() == reflect.Ptr {
        typ = typ.Elem()
    }
    if typ.Kind() != reflect.Struct {
        err = errors.New("only struct is supported")
        return
    }

    buffer := bytes.NewBufferString("")
    buffer.WriteString("SELECT ")

    if typ.NumField() == 0 {
        err = fmt.Errorf("the type[%s] has no fields", typ.Name())
        return
    }

    for i := 0; i < typ.NumField(); i++ {
        field := typ.Field(i)

        if i != 0 {
            buffer.WriteString(", ")
        }
        column := field.Name
        if tag := field.Tag.Get("orm"); tag != "" {
            column = tag
        }
        buffer.WriteString(column)
    }

    stmt = fmt.Sprintf("%s FROM %s", buffer.String(), typ.Name())
    return
}

```

Go反射十分适合处理这一类问题，它们的典型特点包括：
1. 输入参数的类型无法提前确定；
2. 函数或方法的处理结果因传入参数（的类型信息和值信息）的不同而异。

反射在带来强大功能的同时，也是很多困扰你的问题的根源，比如：
1. 反射让你的代码逻辑看起来不那么清晰，难于理解；
2. 反射让你的代码运行得更慢；
3. 在编译阶段，编译器无法检测到使用反射的代码中的问题

如果必须使用反射，请牢记 Rob Pike还为Go反射的规范使用定义了三大法则:
1. 反射世界的入口：经由接口（interface{}）类型变量值进入反射的世界并获得对应的反射对象（reflect.Value或reflect.Type）
2. 反射世界的出口：反射对象（reflect.Value）通过化身为一个接口（interface{}）类型变量值的形式走出反射世界。
3. 修改反射对象的前提：反射对象对应的reflect.Value必须是可设置的（Settable）

![Go变量与反射对象之间的转换关系](/images/go/expert/reflect.png)

## 2. 反射世界的入口
### 2.1 reflect 的基本原理
反射世界的入口:
1. reflect.TypeOf  返回一个reflect.Type对象，该对象中包含了被反射的Go变量实例的所有类型信息；
2. reflect.ValueOf 返回一个reflect.Value对象。Value 对象不仅包含了被反射的Go变量实例的值信息，而且通过调用该对象的Type方法，我们还可以得到Go变量实例的类型信息，这与通过reflect.TypeOf获得类型信息是等价的

```go
var i int = 5
val := reflect.ValueOf(i)
typ := reflect.TypeOf(i)
fmt.Println(reflect.DeepEqual(typ, val.Type())) // true
```

反射世界入口可以获取Go变量实例的类型信息和值信息的关键在于，它们利用了interface{}类型的形式参数对传入的实际参数（Go变量实例）的析构能力，。两个入口函数分别将得到的值信息和类型信息存储在reflect.Value对象和reflect.Type对象中。

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

### 2.2 值/类型检视
通过reflect.Value实例和reflect.Type实例就可以进行值信息和类型信息的检视。

#### 简单原生类型
```go
// 简单原生类型
var b = true // 布尔型
val := reflect.ValueOf(b)
typ := reflect.TypeOf(b)
fmt.Println(typ.Name(), val.Bool()) // bool true
fmt.Println(typ.Name(), val.Int()) // int 23
fmt.Println(typ.Name(), val.Float()) // float64 3.14
fmt.Println(typ.Name(), val.String()) //string hello, reflection

var fn = func(a, b int) int { // 函数(一等公民)
    return a + b
}
val = reflect.ValueOf(fn)
typ = reflect.TypeOf(fn)
fmt.Println(typ.Kind(), typ.String()) // func func(int, int) int

var i = 17
val := reflect.ValueOf(i)
fmt.Println(val.Bool()) // panic: reflect: call of reflect.Value.Bool on int Value
```

reflect.Value类型拥有很多方便我们进行值检视的方法，比如Bool、Int、String等，但显然这些方法并非对所有的变量类型都适用。比如：Bool方法仅适用于对布尔型变量进行反射后得到的Value对象。一旦应用的方法与Value对象的值类型不匹配，我们将收到运行时panic。

reflect.Type是一个接口类型，它包含了很多用于检视类型信息的方法，而对于简单原生类型来说，通过Name、String或Kind方法就可以得到我们想要的类型名称或类型类别等信息。
1. Name方法返回有确定定义的类型的名字（不包括包名前缀），比如int、string。对于上面的函数类型变量，Name方法将返回空
2. String方法得到类型的描述字符串，比如上面的func(int, int) int。String方法返回的类型描述可能包含包名（一般使用短包名，即仅使用包导入路径的最后一段），比如main.Person。
3. Kind方法则返回类型的特定类别

```go
var pi = (*int)(nil)
var ps = (*string)(nil)
typ := reflect.TypeOf(pi)
fmt.Println(typ.Kind(), typ.String()) // ptr *int

typ = reflect.TypeOf(ps)
fmt.Println(typ.Kind(), typ.String()) // ptr *string
```

#### 原生复合类型
```go
var sl = []int{5, 6} // 切片
val = reflect.ValueOf(sl)
typ = reflect.TypeOf(sl)
fmt.Printf("[%d %d]\n", val.Index(0).Int(),
    val.Index(1).Int()) // [5, 6]
fmt.Println(typ.Kind(), typ.String()) // slice []int

var arr = [3]int{5, 6} // 数组
val = reflect.ValueOf(arr)
typ = reflect.TypeOf(arr)
fmt.Printf("[%d %d %d]\n", val.Index(0).Int(),
    val.Index(1).Int(), val.Index(2).Int()) // [5 6 0]
fmt.Println(typ.Kind(), typ.String()) // array [3]int

var m = map[string]int{ // map
    "tony": 1,
    "jim":  2,
    "john": 3,
}
val = reflect.ValueOf(m)
typ = reflect.TypeOf(m)
iter := val.MapRange()
fmt.Printf("{")
for iter.Next() {
    k := iter.Key()
    v := iter.Value()
    fmt.Printf("%s:%d,", k.String(), v.Int())
}
fmt.Printf("}\n")                     // {tony:1,jim:2,john:3,}
fmt.Println(typ.Kind(), typ.String()) // map map[string]int

type Person struct {
    Name string
    Age  int
}

var p = Person{"tony", 23} // 结构体
val = reflect.ValueOf(p)
typ = reflect.TypeOf(p)
fmt.Printf("{%s, %d}\n", val.Field(0).String(),
    val.Field(1).Int()) // {"tony", 23}

fmt.Println(typ.Kind(), typ.Name(), typ.String()) // struct Person main.Person

var ch = make(chan int, 1) // channel
val = reflect.ValueOf(ch)
typ = reflect.TypeOf(ch)
ch <- 17
v, ok := val.TryRecv()
if ok {
    fmt.Println(v.Int()) // 17
}
fmt.Println(typ.Kind(), typ.String()) // chan chan int

// 其他自定义类型
type MyInt int

var mi MyInt = 19
val = reflect.ValueOf(mi)
typ = reflect.TypeOf(mi)
fmt.Println(typ.Name(), typ.Kind(), typ.String(), val.Int()) // MyInt int main.MyInt 19
```

从上面的示例可以看到:
1. 通过Value提供的Index方法，可以获取到切片及数组类型元素所对应的Value对象值
2. 通过Value的MapRange、MapIndex等方法，可以获取到map中的key和value对象所对应的Value对象值
3. 对于结构体类型，Value提供了Field系列方法，通过下标的方式（Field方法）获取结构体字段所对应的Value对象

#### 函数对象
通过反射对象，我们还可以调用函数或对象的方法：

```go
func Add(i, j int) int {
    return i + j
}

type Calculator struct{}

func (c Calculator) Add(i, j int) int {
    return i + j
}

func main() {
    // 函数调用
    f := reflect.ValueOf(Add)
    var i = 5
    var j = 6
    vals := []reflect.Value{reflect.ValueOf(i), reflect.ValueOf(j)}
    ret := f.Call(vals)
    fmt.Println(ret[0].Int()) // 11

    // 方法调用
    c := reflect.ValueOf(Calculator{})
    m := c.MethodByName("Add")
    ret = m.Call(vals)
    fmt.Println(ret[0].Int()) // 11
}
```

通过函数类型变量或包含有方法的类型实例反射出的Value对象，可以通过其Call方法调用该函数或类型的方法。函数或方法的参数以reflect.Value类型切片的形式提供，函数或方法的返回值也以reflect.Value类型切片的形式返回。不过务必保证Value参数的类型信息与原函数或方法的参数的类型相匹配，否则会导致运行时panic。

## 3. 反射世界的出口
reflect.Value.Interface()是reflect.ValueOf()的逆过程，通过Interface方法我们可以将reflect.Value对象恢复成一个interface{}类型的变量值。这个离开反射世界的过程实质是将reflect.Value中的类型信息和值信息重新打包成一个interface{}的内部表示。之后，我们就可以通过类型断言得到一个反射前的类型变量值：

```go
func main() {
    var i = 5
    val := reflect.ValueOf(i)
    r := val.Interface().(int)
    fmt.Println(r) // 5
    r = 6
    fmt.Println(i, r) // 5 6

    val = reflect.ValueOf(&i)
    q := val.Interface().(*int)
    fmt.Printf("%p, %p, %d\n", &i, q, *q) // 0xc0000b4008, 0xc0000b4008, 5
    *q = 7
    fmt.Println(i) // 7
}
```

从上述例子中我们看到:
1. 通过 reflect.Value.Interface() 函数重建后得到的新变量（如例子中的r）与原变量（如例子中的i）是两个不同的变量，它们的唯一联系就是值相同。
2. 如果我们反射的对象是一个指针（如例子中的&i），那么我们通过reflect.Value.Interface()得到的新变量（如例子中的q）也是一个指针，且它所指的内存地址与原指针变量相同。通过新指针变量对所指内存值的修改会反映到原变量上（变量i的值由5变为7）

## 4. 输出参数、interface{}类型变量及反射对象的可设置性

在学习传统编程语言（如C语言）的函数概念时，我们通常还会学习到输入参数和输出参数的概念，Go语言也支持这些概念，比如下面的例子：

```go
func myFunc(in int, out *int) {
    in = 1
    *out = in + 10
}

func main() {
    var n = 17
    var m = 23
    fmt.Printf("n=%d, m=%d\n", n, m) // n=17, m=23
    myFunc(n, &m)
    fmt.Printf("n=%d, m=%d\n", n, m) // n=17, m=11
}
```

上例中:
1. in是输入参数，函数体内对in的修改不会影响到作为实参传入myFunc的变量n，因为Go函数参数的传递是传值，即值复制；
2. out是输出参数，它的传递也是值复制，但这里复制的却是指针值，即作为实参myFunc的变量m的地址，这样函数体内通过解引用对out所指内存地址上的值的修改就会同步到变量m。

对于以interface{}类型变量i作为形式参数的reflect.ValueOf和reflect.TypeOf函数来说，i自身是被反射对象的“复制品”，就像上面函数的输入参数那样。而新创建的反射对象又复制了i中所包含的值信息，因此当被反射对象以值类型（T）传递给reflect.ValueOf时，在反射世界中对反射对象值信息的修改不会对被反射对象产生影响。Go的设计者们认为这种修改毫无意义，并禁止了这种行为。一旦发生这种行为，将会导致运行时panic：

```go
var i = 17
val := reflect.ValueOf(i)
val.SetInt(27) // panic: reflect: reflect.flag.mustBeAssignable using unaddressable value
```

reflect.Value提供了**CanSet、CanAddr及CanInterface等方法来帮助我们判断反射对象是否可设置（Settable）、可寻址、可恢复为一个interface{}类型变量**

```go
package main

import (
	"fmt"
	"reflect"
)

type Person struct {
	Name string
	age  int
}

func main() {
	var n = 17
	fmt.Println("int:")
	val := reflect.ValueOf(n)
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val.CanSet(), val.CanAddr(), val.CanInterface()) // false false true

	fmt.Println("\n*int:")
	val = reflect.ValueOf(&n)
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val.CanSet(), val.CanAddr(), val.CanInterface()) // false false true
	val = reflect.ValueOf(&n).Elem()
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val.CanSet(), val.CanAddr(), val.CanInterface()) // true true true

	fmt.Println("\nslice:")
	var sl = []int{5, 6, 7}
	val = reflect.ValueOf(sl)
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val.CanSet(), val.CanAddr(), val.CanInterface()) // false false true
	val = val.Index(0)
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val.CanSet(), val.CanAddr(), val.CanInterface()) // true true true

	fmt.Println("\narray:")
	var arr = [3]int{5, 6, 7}
	val = reflect.ValueOf(arr)
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val.CanSet(), val.CanAddr(), val.CanInterface()) // false false true
	val = val.Index(0)
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val.CanSet(), val.CanAddr(), val.CanInterface()) // false false true

	fmt.Println("\nptr to array:")
	var pArr = &[3]int{5, 6, 7}
	val = reflect.ValueOf(pArr)
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val.CanSet(), val.CanAddr(), val.CanInterface()) // false false true
	val = val.Elem()
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val.CanSet(), val.CanAddr(), val.CanInterface()) // true true true
	val = val.Index(0)
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val.CanSet(), val.CanAddr(), val.CanInterface()) // true true true

	fmt.Println("\nstruct:")
	p := Person{"tony", 33}
	val = reflect.ValueOf(p)
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val.CanSet(), val.CanAddr(), val.CanInterface()) // false false true
	val1 := val.Field(0) // Name
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val1.CanSet(), val1.CanAddr(), val1.CanInterface()) // false false true
	val2 := val.Field(1) // age
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val2.CanSet(), val2.CanAddr(), val2.CanInterface()) // false false false

	fmt.Println("\nptr to struct:")
	pp := &Person{"tony", 33}
	val = reflect.ValueOf(pp)
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val.CanSet(), val.CanAddr(), val.CanInterface()) // false false true
	val = val.Elem()
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val.CanSet(), val.CanAddr(), val.CanInterface()) // true true true
	val1 = val.Field(0) // Name
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val1.CanSet(), val1.CanAddr(), val1.CanInterface()) // true true true
	val2 = val.Field(1) // age
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val2.CanSet(), val2.CanAddr(), val2.CanInterface()) // false true false

	fmt.Println("\ninterface:")

	var i interface{} = &Person{"tony", 33}
	val = reflect.ValueOf(i)
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val.CanSet(), val.CanAddr(), val.CanInterface()) // false false true

	val = val.Elem()
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val.CanSet(), val.CanAddr(), val.CanInterface()) // true true true

	fmt.Println("\nmap:")
	var m = map[string]int{
		"tony": 23,
		"jim":  34,
	}
	val = reflect.ValueOf(m)
	fmt.Printf("Settable = %v, CanAddr = %v, CanInterface = %v\n",
		val.CanSet(), val.CanAddr(), val.CanInterface()) // false false true

	val.SetMapIndex(reflect.ValueOf("tony"), reflect.ValueOf(12))
	fmt.Println(m) // map[jim:34 tony:12]
}
```
从上面的示例可以看到:
1. 当被反射对象以值类型（T）传递给reflect.ValueOf时，所得到的反射对象（Value）是不可设置和不可寻址的。
2. 当被反射对象以指针类型（*T或&T）传递给reflect.ValueOf时，通过reflect.Value的Elem方法可以得到代表该指针所指内存对象的Value反射对象。而这个反射对象是可设置和可寻址的，对其进行修改（比如利用Value的SetInt方法）将会像函数的输出参数那样直接修改被反射对象所指向的内存空间的值。
3. 当传入结构体或数组指针时，通过Field或Index方法得到的代表结构体字段或数组元素的Value反射对象也是可设置和可寻址的。如果结构体中某个字段是非导出字段，则该字段是可寻址但不可设置的（比如上面例子中的age字段）。
4. 当被反射对象的静态类型是接口类型时（就像上面的interface{}类型变量i），该被反射对象的动态类型决定了其进入反射世界后的可设置性。如果动态类型为*T或&T时，就像上面传给变量i的是&Person{}，那么通过Elem方法获得的反射对象就是可设置和可寻址的。
5. map类型被反射对象比较特殊，它的key和value都是不可寻址和不可设置的。但我们可以通过Value提供的SetMapIndex方法对map反射对象进行修改，这种修改会同步到被反射的map变量中。
