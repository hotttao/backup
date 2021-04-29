---
title: 5. Go 代码生成和泛型
date: 2021-01-04
categories:
    - Go
tags:
    - Go设计模式
---
Go 的泛型和代码生成，这篇文章摘录自[耗子哥博客-Go编程模式](https://coolshell.cn/articles/21179.html)

<!-- more -->

## 1. 泛型
接下来我们学习一下Go语言的代码生成的玩法。Go语言代码生成主要还是用来解决编程泛型的问题，泛型编程主要解决的问题是因为**静态类型语言有类型**，所以，**相关的算法或是对数据处理的程序会因为类型不同而需要复制一份**，这样导致**数据类型和算法功能耦合**的问题。泛型编程可以解决这样的问题，就是说，在写代码的时候，不用关心处理数据的类型，只需要关心相当处理逻辑。泛型编程是静态语言中非常非常重要的特征，如果没有泛型，我们很难做到多态，也很难完成抽象，会导致我们的代码冗余量很大。

## 2. Go 语言的类型检查
Go语言目前并不支持真正的泛型，所以只能用 **`interface{}` 这样的类似于 void* 这种过度泛型** 来玩这就导致了我们在实际过程中就**需要进行类型检查**。Go语言的类型检查有两种技术，一种是 **Type Assert**，一种是**Reflection**。

### 2.1 Type Assert
Type Assert 在 Go 语言中称为断言，一般是对某个变量进行 `.(type)` 的转型操作，其会返回两个值， variable, error，第一个返回值是被转换好的类型，第二个是如果不能转换类型，则会报错。我们看下面这个示例:

```go
//Container is a generic container, accepting anything.
type Container []interface{}

//Put adds an element to the container.
func (c *Container) Put(elem interface{}) {
    *c = append(*c, elem)
}
//Get gets an element from the container.
func (c *Container) Get() interface{} {
    elem := (*c)[0]
    *c = (*c)[1:]
    return elem
}

intContainer := &Container{}
intContainer.Put(7)
intContainer.Put(42)
```

Container 是一个通用类型的容器，Put 和 Get 操作使用了 interface{}作泛型，这样我们就可以操作所有类型。

但是，在把数据取出来时，因为类型是 interface{} ，所以，你还要做一个转型，如果转型成功能才能进行后续操作（因为 interface{}太泛了，泛到什么类型都可以放）。下面是一个Type Assert的示例：

```go
// assert that the actual type is int
elem, ok := intContainer.Get().(int)
if !ok {
    fmt.Println("Unable to read an int from intContainer")
}

fmt.Printf("assertExample: %d (%T)\n", elem, elem)
```

### 2.2 Reflection
对于反射，我们需要把上面的代码修改如下：

```go
type Container struct {
    s reflect.Value
}
func NewContainer(t reflect.Type, size int) *Container {
    if size <=0  { size=64 }
    return &Container{
        s: reflect.MakeSlice(reflect.SliceOf(t), 0, size), 
    }
}
func (c *Container) Put(val interface{})  error {
    if reflect.ValueOf(val).Type() != c.s.Type().Elem() {
        return fmt.Errorf("Put: cannot put a %T into a slice of %s", 
            val, c.s.Type().Elem()))
    }
    c.s = reflect.Append(c.s, reflect.ValueOf(val))
    return nil
}
func (c *Container) Get(refval interface{}) error {
    if reflect.ValueOf(refval).Kind() != reflect.Ptr ||
        reflect.ValueOf(refval).Elem().Type() != c.s.Type().Elem() {
        return fmt.Errorf("Get: needs *%s but got %T", c.s.Type().Elem(), refval)
    }
    reflect.ValueOf(refval).Elem().Set( c.s.Index(0) )
    c.s = c.s.Slice(1, c.s.Len())
    return nil
}
```

这是完全使用 reflection的玩法，其中
1. 在 NewContainer()会根据参数的类型初始化一个Slice
2. 在 Put()时候，会检查 val 是否和Slice的类型一致。
3. 在 Get()时，我们**需要用一个入参的方式**，因为我们没有办法返回 reflect.Value 或是 interface{}，不然还要做Type Assert 但是有类型检查，所以，必然会有检查不对的道理 ，因此，需要返回 error

于是在使用上面这段代码的时候，会是下面这个样子：

```go
f1 := 3.1415926
f2 := 1.41421356237

c := NewMyContainer(reflect.TypeOf(f1), 16)

if err := c.Put(f1); err != nil {
  panic(err)
}
if err := c.Put(f2); err != nil {
  panic(err)
}

g := 0.0

if err := c.Get(&g); err != nil {
  panic(err)
}
fmt.Printf("%v (%T)\n", g, g) //3.1415926 (float64)
fmt.Println(c.s.Index(0)) //1.4142135623
```

我们可以看到，Type Assert是不用了，但是用反射写出来的代码还是有点复杂的。那么有没有什么好的方法？

### 2.3 Template
对于泛型编程最牛的语言 C++ 来说，这类的问题都是使用 Template来解决的。

```C++
//用<class T>来描述泛型
template <class T> 
T GetMax (T a, T b)  { 
    T result; 
    result = (a>b)? a : b; 
    return (result); 
} 

int i=5, j=6, k; 
//生成int类型的函数
k=GetMax<int>(i,j);
 
long l=10, m=5, n; 
//生成long类型的函数
n=GetMax<long>(l,m); 
```

C++的编译器会在编译时分析代码，根据不同的变量类型来自动化的生成相关类型的函数或类。C++叫模板的具体化。这个技术是编译时的问题，所以，不需要我们在运行时进行任何的运行的类型识别，我们的程序也会变得比较的干净。

go 里面我们同样可以这么做，只不过 Go 的编译器目前不会帮我们，我们需要自己实现。

### 2.4 Go Generator
要玩 Go的代码生成，你需要三件事：

1. 一个函数模板，其中设置好相应的占位符。
2. 一个脚本，用于按规则来替换文本并生成新的代码。
3. 一行注释代码

#### 函数模板
我们把我们之前的示例改成模板。取名为 container.tmp.go 放在 ./template/下

```go
package PACKAGE_NAME
type GENERIC_NAMEContainer struct {
    s []GENERIC_TYPE
}
func NewGENERIC_NAMEContainer() *GENERIC_NAMEContainer {
    return &GENERIC_NAMEContainer{s: []GENERIC_TYPE{}}
}
func (c *GENERIC_NAMEContainer) Put(val GENERIC_TYPE) {
    c.s = append(c.s, val)
}
func (c *GENERIC_NAMEContainer) Get() GENERIC_TYPE {
    r := c.s[0]
    c.s = c.s[1:]
    return r
}
```

我们可以看到函数模板中我们有如下的占位符：

1. PACKAGE_NAME – 包名
2. GENERIC_NAME – 名字
3. GENERIC_TYPE – 实际的类型

#### 函数生成脚本
然后，我们有一个叫gen.sh的生成脚本，如下所示：

```bash
#!/bin/bash

set -e

SRC_FILE=${1}
PACKAGE=${2}
TYPE=${3}
DES=${4}
#uppcase the first char
PREFIX="$(tr '[:lower:]' '[:upper:]' <<< ${TYPE:0:1})${TYPE:1}"

DES_FILE=$(echo ${TYPE}| tr '[:upper:]' '[:lower:]')_${DES}.go

sed 's/PACKAGE_NAME/'"${PACKAGE}"'/g' ${SRC_FILE} | \
    sed 's/GENERIC_TYPE/'"${TYPE}"'/g' | \
    sed 's/GENERIC_NAME/'"${PREFIX}"'/g' > ${DES_FILE}
```
其需要4个参数：

1. 模板源文件
2. 包名
3. 实际需要具体化的类型
4. 用于构造目标文件名的后缀

#### 生成代码
接下来，我们只需要在代码中打一个特殊的注释：

```go
//go:generate ./gen.sh ./template/container.tmp.go gen uint32 container
func generateUint32Example() {
    var u uint32 = 42
    c := NewUint32Container()
    c.Put(u)
    v := c.Get()
    fmt.Printf("generateExample: %d (%T)\n", v, v)
}

//go:generate ./gen.sh ./template/container.tmp.go gen string container
func generateStringExample() {
    var s string = "Hello"
    c := NewStringContainer()
    c.Put(s)
    v := c.Get()
    fmt.Printf("generateExample: %s (%T)\n", v, v)
}
```

其中，

1. 第一个注释是生成包名为 gen 类型为 uint32 目标文件名以 container 为后缀
2. 第二个注释是生成包名为 gen 类型为 string 目标文件名以 container 为后缀

然后，在工程目录中直接执行 go generate 命令，就会生成如下两份代码，一份文件名为uint32_container.go

这两份代码可以让我们的代码完全编译通过，所付出的代价就是需要多执行一步 go generate 命令。

#### 第三方工具
我们并不需要自己手写 gen.sh 这样的工具类，已经有很多第三方的已经写好的可以使用。下面是一个列表：
1. Genny –  https://github.com/cheekybits/genny
2. Generic – https://github.com/taylorchu/generic
3. GenGen – https://github.com/joeshaw/gengen
4. Gen – https://github.com/clipperhouse/gen
