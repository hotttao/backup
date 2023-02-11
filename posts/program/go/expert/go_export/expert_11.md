---
weight: 1
title: "expvar"
date: 2023-01-03T22:00:00+08:00
lastmod: 2023-01-03T22:00:00+08:00
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

## 1. expvar
应用运行状态一般以度量数据的形式呈现。通过了解应用关键路径上的度量数据，我们可以确定在某个度量点上应用的性能是符合预期性能指标还是较大偏离预期，这样就可以最大限度地缩小性能瓶颈点的搜索范围，从而快速定位应用中的瓶颈点并进行优化。这些可以反映应用运行状态的数据也被称为应用的内省（introspection）数据。相比于通过查询应用外部特征而获取的探针类（probing）数据（比如查看应用某端口是否有响应并返回正确的数据或状态码），内省数据可以传达更为丰富、更多的有关应用程序状态的上下文信息。这些上下文信息可以是应用对各类资源的占用信息，比如应用运行占用了多少内存空间，也可以是自定义的性能指标信息，比如单位时间处理的外部请求数量、应答延迟、队列积压量等。我们可以轻松地使用Go标准库提供的expvar包按统一接口、统一数据格式、一致的指标定义方法输出自定义的度量数据。

expvar包不仅可用于辅助缩小定位性能瓶颈的范围，还可以用来输出度量数据以对应用的运行状态进行监控，这样当程序出现问题时，我们可以快速发现问题并利用输出的度量数据对程序进行诊断并快速定位问题。

### 1.1 expvar包的工作原理
expvar包提供了一种输出应用内部状态信息的标准化方案，这个方案标准化了以下三方面内容：
1. 数据输出接口形式；
2. 输出数据的编码格式；
3. 用户自定义性能指标的方法。

整个流程如下图所示:

![expvar包工作原理](/images/go/expert/expvar.png)

expvar 与 net/http/pprof类似，也是向默认“路由器”DefaultServeMux注册一个服务端点/debug/vars，如果没有使用默认路由，可以自行注册:

```go
package main

import (
    "expvar"
    "fmt"
    "net/http"
)

func main() {
    mux := http.NewServeMux()
    mux.Handle("/hi", http.HandlerFunc(func(w http.ResponseWriter,
        r *http.Request) {
        w.Write([]byte("hi"))
    }))
    // expvar包提供了Handler函数，该函数可用于其内部expvarHandler的注册。
    mux.Handle("/debug/vars", expvar.Handler())
    fmt.Println(http.ListenAndServe("localhost:8080", mux))
}
```
这个服务端点就是expvar提供给外部的获取应用内部状态的唯一标准接口，通过 http get 请求，这个接口返回的是标准的JSON格式数据。样例如下：

```json
{
    "cmdline": ["/var/folders/cz/sbj5kg2d3m3c6j650z0qfm800000gn/T/go-build507091832/ b001/exe/expvar_demo2"],
    "memstats": {
        "Alloc": 223808,
        "TotalAlloc": 223808,
        "Sys": 71387144,
        "Lookups": 0,
        "Mallocs": 743,
        "Frees": 11,
        ...
    }
}
```

在默认返回的状态数据中包含了两个字段：cmdline和memstats。这两个输出数据是expvar包在init函数中就已经发布（Publish）了的变量：
1. cmdline字段的含义是输出数据的应用名
2. memstats输出的数据对应的是runtime.Memstats结构体，反映的是应用在运行期间堆内存分配、栈内存分配及GC的状态。runtime.Memstats结构体的字段可能会随着Go版本的演进而发生变化

```go
func init() {
    http.HandleFunc("/debug/vars", expvarHandler)
    Publish("cmdline", Func(cmdline))
    Publish("memstats", Func(memstats))
}
```

expvar包为Go应用输出内部状态提供了标准化方案，前面已经提到了其中的两个标准。
标准的接口：通过http get（默认从/debug/vars服务端点获取数据）。
标准的数据编码格式：JSON。
在这一节中，我们来介绍一下第三个标准：自定义输出的度量数据的标准方法。

### 1.2 输出自定义状态数据
前面的内容可以看到 expvar 已经标准化了两个方面:
1. 标准的接口：通过http get（默认从/debug/vars服务端点获取数据）。
2. 标准的数据编码格式：JSON。

接下来我们来看第三个标准：自定义输出的度量数据的标准方法。

expvar包提供了Publish函数，该函数用于发布通过debug/vars服务端点输出的数据:

```go
// $GOROOT/src/expvar/expvar.go
func Publish(name string, v Var)

// $GOROOT/src/expvar/expvar.go
type Var interface {
    String() string
}
```

Publish 接收两个参数：name和v。name是对应字段在输出结果中的字段名，而v是字段值。v的类型为Var，是一个接口类型。我们看下面这个示例:

```go
type CustomVar struct {
    value int64
}
// 实现 Var 接口
func (v *CustomVar) String() string {
    return strconv.FormatInt(atomic.LoadInt64(&v.value), 10)
}

// 业务对自定义状态进行变更
func (v *CustomVar) Add(delta int64) {
    atomic.AddInt64(&v.value, delta)
}

func (v *CustomVar) Set(value int64) {
    atomic.StoreInt64(&v.value, value)
}

func init() {
    customVar := &CustomVar{
        value: 17,
    }
    expvar.Publish("customVar", customVar)
}

func main() {
    http.Handle("/hi", http.HandlerFunc(func(w http.ResponseWriter,
        r *http.Request) {
        w.Write([]byte("hi"))
    }))
    fmt.Println(http.ListenAndServe("localhost:8080", nil))
}
```

### 1.3 expvar 内置指标类型
我们在设计能反映Go应用内部状态的自定义指标时，经常会设计下面两类指标:
1. 测量型: 可增减
2. 计数型：只能递增，可以计算速率

针对上述两类常见指标，expvar包提供了对常用指标类型的原生支持，比如整型指标、浮点型指标以及像memstats那样的Map型复合指标等。

#### 整型指标
整型指标的实现如下:
```go
// $GOROOT/src/expvar/expvar.go
type Int struct {
    i int64
}

func (v *Int) Value() int64 {
    return atomic.LoadInt64(&v.i)
}

func (v *Int) String() string {
    return strconv.FormatInt(atomic.LoadInt64(&v.i), 10)
}

func (v *Int) Add(delta int64) {
    atomic.AddInt64(&v.i, delta)
}

func (v *Int) Set(value int64) {
    atomic.StoreInt64(&v.i, value)
}
```
针对expvar.Int类型，expvar包还提供了创建即发布的NewInt函数，这样我们就无须再自行调用Publish函数发布指标了：

```go
func NewInt(name string) *Int {
    v := new(Int)
    Publish(name, v)
    return v
}
```

所以上面的示例可以改成:

```go
var customVar *expvar.Int

func init() {
    customVar = expvar.NewInt("customVar")
    customVar.Set(17)
}
// ...
```

#### Map型复合指标
使用expvar.Map类型可以定义一个像memstats那样的复合指标:

```go
var customVar *expvar.Map

func init() {
    customVar = expvar.NewMap("customVar")

    var field1 expvar.Int
    var field2 expvar.Float
    customVar.Set("field1", &field1)
    customVar.Set("field2", &field2)
}

// customVar.Add("field1", 1)
// customVar.AddFloat("field2", 0.001)
```
如以上示例所示，定义一个expvar.Map类型变量后，可以向该复合指标变量中添加指标，比如示例中的“field1”。在业务逻辑中，可以通过expvar.Map提供的Add、AddFloat等方法对复合指标内部的单个指标值进行更新。

如果想将一个结构体类型当作一个复合指标直接输出，expvar包也提供了很好的支持。

```go
type CustomVar struct {
    Field1 int64   `json:"field1"`
    Field2 float64 `json:"field2"`
}

var (
    field1 expvar.Int
    field2 expvar.Float
)

func exportStruct() interface{} {
    return CustomVar{
        Field1: field1.Value(),
        Field2: field2.Value(),
    }
}

func init() {
    expvar.Publish("customVar", expvar.Func(exportStruct))
}
```

针对结构体类型，通过实现一个返回interface{}类型的函数（这里是exportStruct），并通过Publish函数将该函数发布出去的（expvar.Func(exportStruct)）。注意，这个返回interface{}类型的函数的返回值底层类型必须是一个支持序列化为JSON格式的类型。显然这种方法更加灵活，可以发布任何类型的自定义指标。

### 1.4 输出数据的展示
/debug/vars服务端点输出的 json 数据很容被各种监控工具集成。Go开发者Ivan Daniluk开发了一款名为expvarmon的开源工具，该工具支持将从expvar输出的数据以基于终端的图形化方式展示出来。使用方法如下:

```bash
$go get github.com/divan/expvarmon
$expvarmon -ports="8080" -vars="custom:customVar.field1,custom:customVar.field2,mem:memstats.Alloc,mem:memstats.Sys,mem:memstats.HeapAlloc,mem:memstats.HeapInuse,duration:memstats.PauseNs,duration:memstats.PauseTotalNs"
```
