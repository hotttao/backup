---
weight: 1
title: "go 文本操作"
date: 2021-06-02T22:00:00+08:00
lastmod: 2021-06-02T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go 字符操作"
featuredImage: 

tags: ["go 库"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

## 1. 字符操作
strings 和 bytes 提供了 go 语言中的字符操作，因为还不不支持泛型，所以这两个包提供了几乎一样的函数和类型，区别仅仅在于一个操作 string，其中大致可分为如下几类：
1. 查找与替换；
2. 比较；
3. 拆分；
4. 拼接；
5. 修剪和变换；
6. 快速创建实现了io.Reader接口的实例

## 2. 查找与替换
### 2.1 定性查找
所谓“定性查找”就是指返回有（true）和无（false）的查找。strings/bytes 提供 3 类 API，包括 Contains系列、HasPrefix和HasSuffix。

#### Contains 函数
Contains函数返回的是第一个参数代表的字符串/字节切片中是否包含第二个参数代表的字符串/字节切片

```go
fmt.Println(strings.Contains("Golang", "Go")) // true
fmt.Println(strings.Contains("Golang", "go")) // false
fmt.Println(strings.Contains("", ""))         // true

fmt.Println(bytes.Contains([]byte("Golang"), []byte("Go"))) // true
fmt.Println(bytes.Contains([]byte("Golang"), []byte("go"))) // false
fmt.Println(bytes.Contains([]byte("Golang"), []byte("")))   // true
fmt.Println(bytes.Contains([]byte("Golang"), nil))          // true
fmt.Println(bytes.Contains([]byte("Golang"), []byte{}))     // true
fmt.Println(bytes.Contains(nil, nil))                       // true
```

在这个函数的语义中，**任意字符串都包含空串（""），任意字节切片也都包含空字节切片（[]byte{}）及nil切片。**

#### ContainsAny 函数
ContainsAny函数的语义是，将其两个参数看成两个Unicode字符的集合，如果两个集合存在不为空的交集，则返回true

```go
fmt.Println(strings.ContainsAny("Golang", "java"))   // true
fmt.Println(strings.ContainsAny("Golang", "c"))      // false
fmt.Println(strings.ContainsAny("Golang", ""))       // false    注意
fmt.Println(strings.ContainsAny("", ""))             // false    注意

fmt.Println(bytes.ContainsAny([]byte("Golang"), "java")) // true
fmt.Println(bytes.ContainsAny([]byte("Golang"), "c"))    // false
fmt.Println(bytes.ContainsAny([]byte("Golang"), ""))     // false  注意
fmt.Println(bytes.ContainsAny(nil, ""))                  // false  注意
```

#### ContainsRune 函数
ContainsRune用于判断某一个Unicode字符（以码点形式即rune类型值传入）是否包含在第一个参数代表的字符串或字节切片中。

```go
fmt.Println(strings.ContainsRune("Golang", 97))            // true，字符[a]的Unicode码点 = 97
fmt.Println(strings.ContainsRune("Golang", rune('中')))    // false

fmt.Println(bytes.ContainsRune([]byte("Golang"), 97))      // true，字符[a]的Unicode码点 = 97
fmt.Println(bytes.ContainsRune([]byte("Golang"), rune('中')))    // f
```

#### HasPrefix 和 HasSuffix 函数
HasPrefix函数用于判断第二个参数代表的字符串/字节切片是不是第一个参数的前缀，同理，HasSuffix函数则用于判断第二个参数是不是第一个参数的后缀。

```go
fmt.Println(strings.HasPrefix("Golang", "Go"))     // true
fmt.Println(strings.HasPrefix("Golang", "lang"))   // false
fmt.Println(strings.HasPrefix("Golang", ""))       // true
fmt.Println(strings.HasPrefix("", ""))             // true

fmt.Println(strings.HasSuffix("Golang", "Golang")) // true
fmt.Println(strings.HasSuffix("Golang", ""))       // true
fmt.Println(strings.HasSuffix("", ""))             // true

fmt.Println(bytes.HasPrefix([]byte("Golang"), []byte("Go")))     // true
fmt.Println(bytes.HasPrefix([]byte("Golang"), []byte{}))         // true
fmt.Println(bytes.HasPrefix([]byte("Golang"), nil))              // true
fmt.Println(bytes.HasPrefix(nil, nil))                           // true

fmt.Println(bytes.HasSuffix([]byte("Golang"), []byte("lang")))   // true
fmt.Println(bytes.HasSuffix([]byte("Golang"), []byte{}))         // true
fmt.Println(bytes.HasSuffix([]byte("Golang"), nil))              // true
fmt.Println(bytes.HasSuffix(nil, nil))                           // true
```

要注意的是，在这两个函数的语义中，空字符串（""）是任何字符串的前缀和后缀，空字节切片（[]byte{}）和nil切片也是任何字节切片的前缀和后缀。

### 2.2 定位查找
定位相关查找函数会给出第二个参数代表的字符串/字节切片在第一个参数中第一次出现的位置（下标），如果没有找到，则返回-1。另外定位查找还有方向性，从左到右为正向定位查找（Index系列），反之为反向定位查找（LastIndex系列）。

```go
// 定位查找（string）
fmt.Println(strings.Index("Learn Golang, Go!", "Go"))          // 6
fmt.Println(strings.Index("Learn Golang, Go!", ""))            // 0
fmt.Println(strings.IndexAny("Learn Golang, Go!", "Java"))     // 2
fmt.Println(strings.IndexRune("Learn Golang, Go!", rune('a'))) // 2

// 定位查找（[]byte）
fmt.Println(bytes.Index([]byte("Learn Golang, Go!"), []byte("Go")))   // 6
fmt.Println(bytes.Index([]byte("Learn Golang, Go!"), nil))            // 0
fmt.Println(bytes.IndexAny([]byte("Learn Golang, Go!"), "Java"))      // 2
fmt.Println(bytes.IndexRune([]byte("Learn Golang, Go!"), rune('a')))  // 2

// 反向定位查找（string）
fmt.Println(strings.LastIndex("Learn Golang, Go!", "Go"))      // 14
fmt.Println(strings.LastIndex("Learn Golang, Go!", ""))        // 17
fmt.Println(strings.LastIndexAny("Learn Golang, Go!", "Java")) // 9

// 反向定位查找（[]byte）
fmt.Println(bytes.LastIndex([]byte("Learn Golang, Go!"), nil))            // 17
fmt.Println(bytes.LastIndexAny([]byte("Learn Golang, Go!"), "Java"))      // 9
```

IndexAny函数返回非空交集中第一个字符在第一个参数中的位置信息。另外要注意，**反向查找空串或nil切片，返回的是第一个参数的长度，但作为位置（下标）信息，这个值已经越界了**。

### 2.3 替换
strings包中提供了两种进行字符串替换的方法：Replace函数与Replacer类型。bytes包中则只提供了Replace函数用于字节切片的替换。
1. Replace 最后一个参数是一个整型数，用于控制替换的次数。如果传入-1，则全部替换。
2. ReplaceAll函数本质上等价于最后一个参数传入-1的Replace函数
3. Replacer类型实例化时则可以传入多组old和new参数，这样后续在使用Replacer.Replace方法对原字符串进行替换时，可以一次实施多组不同字符串的替换。

```go
// $GOROOT/src/strings/strings.go

func Replace(s, old, new string, n int) string {
    ...
}
func ReplaceAll(s, old, new string) string {
    return Replace(s, old, new, -1)
}
```

下面是使用示例:
```go
// 替换（string）

fmt.Println(strings.Replace("I love java, java, java!!",  "java", "go", -1))  // I love go, go, go!!
fmt.Println(strings.Replace("math", "", "go", -1)) // gomgoagotgohgo
fmt.Println(strings.ReplaceAll("I love java, java, java!!", "java", "go"))    // I love go, go, go!!

replacer := strings.NewReplacer("java", "go", "python", "go")
fmt.Println(replacer.Replace("I love java, python, go!!"))
                        // I love go, go, go!!

// 替换([]byte)
fmt.Printf("%s\n", bytes.Replace([]byte("I love java, java, java!!"),
    []byte("java"), []byte("go"), -1))    // I love go, go, go!!
fmt.Printf("%s\n", bytes.Replace([]byte("math"), nil,
    []byte("go"), -1))            // gomgoagotgohgo
fmt.Printf("%s\n", bytes.ReplaceAll([]byte("I love java, java, java!!"),
    []byte("java"), []byte("go")))        // I love go, go, go!!
```

当参数old传入空字符串""或nil（仅字节切片）时，Replace会将new参数所表示的要替入的字符串/字节切片插入原字符串/字节切片的每两个字符（字节）间的“空隙”中。当然原字符串/字节切片的首尾也会被各插入一个new参数值。

## 3. 比较
### 3.1 等值比较
根据Go语言规范，切片类型变量之间不能直接通过操作符进行等值比较，但可以与nil做等值比较。但Go语言原生支持通过操作符==或!=对string类型变量进行等值比较，因此strings包未像bytes包一样提供Equal函数。而bytes包的Equal函数的实现也是基于原生字符串类型的等值比较的：

```go
func main() {
    var a = []byte{'a', 'b', 'c'}
    var b = []byte{'a', 'b', 'd'}

    if a == b { // 错误：invalid operation: a == b
        fmt.Println("slice a is equal to slice b")
    } else {
        fmt.Println("slice a is not equal to slice b")
    }

    if a != nil { // 正确：valid operation
        fmt.Println("slice a is not nil")
    }
}

// $GOROOT/src/bytes/bytes.go
func Equal(a, b []byte) bool {
  // Go编译器会为上面这个函数实现中的显式类型转换提供默认优化，不会额外为显式类型转换分配内存空间。
    return string(a) == string(b)
}

fmt.Println(bytes.Equal([]byte{'a', 'b', 'c'}, []byte{'a', 'b', 'd'}))
                            // false "abc" != "abd"

```

strings和bytes包还共同提供了 EqualFold 函数，用于进行不区分大小写的Unicode字符的等值比较。字节切片在比较时，切片内的字节序列将被解释成字符的UTF-8编码表示后再进行比较：

```go
fmt.Println(strings.EqualFold("GoLang", "golang"))               // true
fmt.Println(bytes.Equal([]byte("GoLang"), []byte("Golang")))     // false
fmt.Println(bytes.EqualFold([]byte("GoLang"), []byte("Golang"))) // true
```

### 2.2 排序比较
bytes包和strings包均提供了Compare方法来对两个字符串/字节切片做排序比较。但Go原生支持通过操作符>、>=、<和<=对字符串类型变量进行排序比较，因此strings包中Compare函数存在的意义更多是为了与bytes包尽量保持API一致，其自身也是使用原生排序比较操作符实现的：

```go
// $GOROOT/src/strings/compare.go
func Compare(a, b string) int {
    if a == b {
        return 0
    }
    if a < b {
        return -1
    }
    return +1
}
```

实际应用中，我们很少使用strings.Compare，更多的是直接使用排序比较操作符对字符串类型变量进行比较。下面是 bytes.Compare 的使用示例:

```go
var a = []byte{'a', 'b', 'c'}
var b = []byte{'a', 'b', 'd'}
var c = []byte{} //empty slice
var d []byte     //nil slice

fmt.Println(bytes.Compare(a, b))     // -1 (a < b)
fmt.Println(bytes.Compare(b, a))     // 1 (b < a)
fmt.Println(bytes.Compare(c, d))     // 0
fmt.Println(bytes.Compare(c, nil))   // 0
fmt.Println(bytes.Compare(d, nil))   // 0
fmt.Println(bytes.Compare(nil, nil)) // 0 (nil == nil)
```

### 2.3 分割
字符串/字节切片分割使用 Split API。

#### Fields相关函数
Fields 使用空白分割字符串，Fields函数采用了Unicode空白字符的定义，下面的字符均会被识别为空白字符：

```go
// $GOROOT/src/unicode/graphic.go
'\t', '\n', '\v', '\f', '\r', ' ', U+0085 (NEL), U+00A0 (NBSP)

fmt.Printf("%q\n", strings.Fields("go java python"))     // ["go" "java" "python"]
fmt.Printf("%q\n", strings.Fields("\tgo  \f \u0085 \u00a0 java \n\rpython"))
                                                         // ["go" "java" "python"]
fmt.Printf("%q\n", strings.Fields(" \t \n\r   "))        // []

fmt.Printf("%q\n", bytes.Fields([]byte("go java python")))
                                                         // ["go" "java" "python"]
fmt.Printf("%q\n", bytes.Fields([]byte("\tgo  \f \u0085 \u00a0 java \n\rpython")))
                                                         // ["go" "java" "python"]
fmt.Printf("%q\n", bytes.Fields([]byte(" \t \n\r  ")))   // []
```

从示例中我们看到，Fields会忽略输入数据前后的空白字符以及中间连续的空白字符；如果输入数据仅包含空白字符，那么该函数将返回一个空的string类型切片。

Go标准库还提供了灵活定制分割逻辑的FieldsFunc函数，通过传入一个用于指示是否为“空白”字符的函数，我们可以实现按自定义逻辑对原字符串进行分割：

```go
// go-bytes-and-strings/split_and_fields.go
splitFunc := func(r rune) bool {
    return r == rune('\n')
}
// ["\tgo  \f \u0085 \u00a0 java " "\rpython"]
fmt.Printf("%q\n", strings.FieldsFunc("\tgo  \f \u0085 \u00a0 java \n\n\rpython", splitFunc)) 
// ["\tgo  \f \u0085 \u00a0 java " "\rpython"]
fmt.Printf("%q\n", bytes.FieldsFunc([]byte("\tgo  \f \u0085 \u00a0 java \n\n\rpython"), splitFunc)) 
```

#### Split 相关函数
Split相关函数，可以使用更通用的字符对字符串或字节切片进行分割：

```go
// 使用Split相关函数分割字符串
fmt.Printf("%q\n", strings.Split("a,b,c", ","))    // ["a" "b" "c"]
fmt.Printf("%q\n", strings.Split("Go社区欢迎你", ""))    // ["G" "o" "社" "区" "欢" "迎" "你"]
fmt.Printf("%q\n", strings.Split("abc", "de"))    // ["abc"]
fmt.Printf("%q\n", strings.SplitN("a,b,c,d", ",", 2))    // ["a" "b,c,d"]
fmt.Printf("%q\n", strings.SplitAfter("a,b,c,d", ","))    // ["a," "b," "c," "d"]
fmt.Printf("%q\n", strings.SplitAfterN("a,b,c,d", ",", 2))    // ["a," "b,c,d"]

// 使用Split相关函数分割字节切片
fmt.Printf("%q\n", bytes.Split([]byte("a,b,c"), []byte("b")))    // ["a," ",c"]
fmt.Printf("%q\n", bytes.Split([]byte("Go社区欢迎你"), nil))    // ["G" "o" "社" "区" "欢" "迎" "你"]
fmt.Printf("%q\n", bytes.Split([]byte("abc"), []byte("de")))    // ["abc"]
fmt.Printf("%q\n", bytes.SplitN([]byte("a,b,c,d"), []byte(","), 2))    // ["a" "b,c,d"]
fmt.Printf("%q\n", bytes.SplitAfter([]byte("a,b,c,d"), []byte(",")))    // ["a," "b," "c," "d"]
fmt.Printf("%q\n", bytes.SplitAfterN([]byte("a,b,c,d"), []byte(","), 2))    // ["a," "b,c,d"]
```

通过上面的示例，可以看到：
1. Split函数当传入空串（或bytes.Split被传入nil切片）作为分隔符时，Split函数会按UTF-8的字符编码边界对Unicode进行分割，即每个Unicode字符都会被视为一个分割后的子字符串。如果原字符串中没有传入的分隔符，那么Split会将原字符串作为返回的字符串切片中的唯一元素。
2. SplitN函数的最后一个参数表示对原字符串进行分割后产生的分段数量，Split函数等价于SplitN函数的最后一个参数被传入-1。
3. SplitAfter不同于Split的地方在于它对原字符串/字节切片的分割点在每个分隔符的后面，由于分隔符并未真正起到分隔的作用，因此它不会被剔除，而会作为子串的一部分返回。
4. SplitAfterN函数的最后一个参数表示对原字符串进行分割后产生的分段数量，SplitAfter函数等价于SplitAfterN函数的最后一个参数被传入-1。

## 2.4 拼接
拼接（Concatenate）是分割的逆过程，使用 Join 函数。

```go
s := []string{"I", "love", "Go"}
fmt.Println(strings.Join(s, " ")) // I love Go
b := [][]byte{[]byte("I"), []byte("love"), []byte("Go")}
fmt.Printf("%q\n", bytes.Join(b, []byte(" "))) // "I love Go"
```

string.Builder 和 bytes.Buffer 用于高效地构建字符串:

```go
s := []string{"I", "love", "Go"}
var builder strings.Builder
for i, w := range s {
    builder.WriteString(w)
    if i != len(s)-1 {
          builder.WriteString(" ")
    }
}
fmt.Printf("%s\n", builder.String()) // I love Go

b := [][]byte{[]byte("I"), []byte("love"), []byte("Go")}
var buf bytes.Buffer
for i, w := range b {
    buf.Write(w)
    if i != len(b)-1 {
        buf.WriteString(" ")
    }
}
fmt.Printf("%s\n", buf.String()) // I love Go
```

### 2.5 修剪
去除输入数据中首部和尾部多余的空白、去掉特定后缀信息等使用 Trip 相关函数:
1. TrimSpace: 去除输入字符串/字节切片首部和尾部的空白字符(对空白字符的定义通 Fields 函数)
2. Trim: 从输入数据的首尾两端分别找到第一个不在修剪字符集合（cutset）中的字符，然后将位于这两个字符中间的内容连同这两个字符作为返回值返回
3. TrimRight和TrimLeft 通 Trim，不过一个去除右侧，一个去除左侧
4. TrimPrefix和TrimSuffix: 修剪输入数据中的前缀字符串和后缀字符串

```go
// TrimSpace
fmt.Println(strings.TrimSpace("\t\n\f I love Go!! \n\r")) // I love Go!!
fmt.Printf("%q\n", bytes.TrimSpace([]byte("\t\n\f I love Go!! \n\r"))) // "I love Go!!"

// Trim、TrimRight和TrimLeft
fmt.Println(strings.Trim("\t\n fffI love Go!!\n \rfff", "\t\n\r f"))
                                // I love Go!!

// $GOROOT/src/strings/strings.go
func TrimLeft(s, cutset string) string
func TrimPrefix(s, prefix string) string
```

注意 Trim 的第二个参数应理解为一个字符的集合，而TrimPrefix的第二个参数应理解为一个整体的字符串。

### 2.6 变换
#### 大小写转换
ToUpper和ToLower函数：

```go
strings.ToUpper("i LoVe gOlaNg!!")
strings.ToLower("i LoVe gOlaNg!!")
```

#### Map函数
Map 于将原字符串/字节切片中的部分数据按照传入的映射规则变换为新数据：

```go
trans := func(r rune) rune {
    switch {
    case r == 'p':
       return 'g'
    }
    return r
}
fmt.Printf("%q\n", strings.Map(trans, "I like python!!"))
fmt.Printf("%q\n", bytes.Map(trans, []byte("I like python!!")))
```

### 2.7 快速对接I/O模型
标准库中大多数的 I/O操作都以 io.Writer/io.Reader这两个接口类型作为参数，字符串类型/字节切片没有实现 io.Reader 接口，不能直接作为这些 I/O 操作的入参。strings/bytes 的 NewReader 函数可以讲字符串/字节切片保包装成满足 io.Reader 接口的可读数据源。 

```go
func main() {
    var buf bytes.Buffer
    var s = "I love Go!!"

    _, err := io.Copy(&buf, strings.NewReader(s))
    if err != nil {
        panic(err)
    }
    fmt.Printf("%q\n", buf.String()) // "I love Go!!"

    buf.Reset()
    var b = []byte("I love Go!!")
    _, err = io.Copy(&buf, bytes.NewReader(b))
    if err != nil {
        panic(err)
    }
    fmt.Printf("%q\n", buf.String()) // "I love Go!!"
}
```
