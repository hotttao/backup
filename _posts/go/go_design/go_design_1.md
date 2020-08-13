---
title: 11 go 设计模式-创建型
date: 2019-01-13
categories:
    - Go
tags:
    - go语言入门
---

前面我们学习了 go 的基本语法，接下来的内容我们来看看如何使用 go 实现常见的 23 种设计模式。深入学习一种语言的最快方式就是使用它实现常见的数据结构与算法以及设计模式。
<!-- more -->

## 1. Go 实现的设计模式
Go 编程一个很大的特点就是"接口先行"，因为接口是 go 实现泛型的标准方法。因为 Go 没有面型对象中继承的概念，因此当我们为实现某个设计模式去创建一个类时，第一反应应该是先创建接口。

本节我们来学习创建型中的三种设计模式:
1. 简单工厂函数
2. 工厂方法
3. 抽象工厂
4. 创建者模式（Builder）
5. 原型模式（Prototype）
6. 单例模式（Singleton）

## 2. 简单工厂函数
go 语言没有构造函数一说，所以一般会定义NewXXX函数来初始化相关类。 NewXXX 函数返回接口时就是简单工厂模式。这是 Go 中创建对象的标准方式。下面是一个简单示例:
1. 首先我们为类定义接口 API
2. 定义具体的类 HiAPI 实现接口 API
3. 定义 NewHi() 创建HiAPI对象

```go
package mode

import "fmt"

// API hello interface
type API interface {
	Say(name string) string
}

// NewAPI API 接口的工厂函数
func NewAPI() API {
	return &HiAPI{}
}

// HiAPI API 实现一
type HiAPI struct{}

// Say say hi
func (*HiAPI) Say(name string) string {
	return fmt.Sprintf("Hi %s", name)
}
```

## 3. 工厂方法
与简单工厂在一个函数内创建多种不同的对象相比，工厂为每个待创建的对象使用单独的函数。然后再使用类似简单工厂函数的load 函数进行整合。形式上就是就是将简单工厂函数内创建不同对象的逻辑拆分到额外的不同函数中。工厂方法适用于对象创建逻辑非常复杂的场景。

比如，我们现在需要解析不同格式的配置文件:
1. 首先我们要为配置文件的解析定义接口 ConfigParse
2. 因为我们要为不同的对象定义不同的工场函数，所以我们要为工厂函数定义一个接口 Factory
3. 最后创建简单的工厂函数整合对象的创建逻辑

```go
// ConfigParse 定义配置文件解析接口
type ConfigParse interface {
	Parse(path string) map[string]int
}

//JSONParse 解析 json
type JSONParse struct {
}

// Parse 解析json
func (*JSONParse) Parse(path string) map[string]int {
	return map[string]int{"json": 1}
}

// XMLParse 解析 XML
type XMLParse struct {
}

// Parse 解析 xml
func (*XMLParse) Parse(path string) map[string]int {
	return map[string]int{"XML": 2}
}

// ConfigFactory 工厂函数创建接口
type ConfigFactory interface {
	Create(path string) ConfigParse
}

type XMLFactory struct {
}

func (*XMLFactory) Create(path string) XMLParse {
	return XMLParse{}
}

type JSONFactor struct {
}

func (*JSONFactor) Create(path string) JSONParse {
	return JSONParse{}
}

func NewParser(path string) ConfigParse {
	if path == ".json" {
		return JSONFactor{}.Create(path)
	}
	return XMLFactory{}.Create(path)

}
```

## 4. 抽象工厂
抽象工厂用于创建一组相关的对象。比如我们现在需要为一组关联的主订单对象 OrderMain 和订单详情对象 OrderDetail 定义不同的保存格式:
1. 首先我们要为 OrderMain，OrderDetail 对象定义保存接口
3. 实现 OrderMain，OrderDetail 的关系数据库和 XML 的保存方式
4. 定义创建工厂函数的接口
5. 实现创建不同保存方式的工厂函数

```go
// 1. 为 OrderMain，OrderDetail 的保存定义接口
import "fmt"

//OrderMainDAO 为订单主记录
type OrderMainDAO interface {
	SaveOrderMain()
}

//OrderDetailDAO 为订单详情纪录
type OrderDetailDAO interface {
	SaveOrderDetail()
}

// 2.  OrderMain，OrderDetail 的保存实现
//RDBMainDAP 为关系型数据库的OrderMainDAO实现
type RDBMainDAO struct{}

//SaveOrderMain ...
func (*RDBMainDAO) SaveOrderMain() {
	fmt.Print("rdb main save\n")
}

//RDBDetailDAO 为关系型数据库的OrderDetailDAO实现
type RDBDetailDAO struct{}

// SaveOrderDetail ...
func (*RDBDetailDAO) SaveOrderDetail() {
	fmt.Print("rdb detail save\n")
}

// 3. 定义抽象工厂的接口
//DAOFactory DAO 抽象模式工厂接口
type DAOFactory interface {
	CreateOrderMainDAO() OrderMainDAO
	CreateOrderDetailDAO() OrderDetailDAO
}
// 4. 抽象工厂函数的实现
//RDBDAOFactory 是RDB 抽象工厂实现
type RDBDAOFactory struct{}

func (*RDBDAOFactory) CreateOrderMainDAO() OrderMainDAO {
	return &RDBMainDAO{}
}

func (*RDBDAOFactory) CreateOrderDetailDAO() OrderDetailDAO {
	return &RDBDetailDAO{}
}
```

## 5. 创建者模式
创建模式用来解决对象构造参数过多，参数验证逻辑复杂的对象创建问题，通过将参数收集和验证放在创建者中来创建不可变对象或者避免创建的对象处于未定义的中间状态。

比如，我们现在要创建一个 Car 对象，它包含各种属性比如颜色，核载人数，并且核载人数有限制:
1. 定义 Car 对象
2. 定义创建 Car 的创建者接口 CarBuild
3. 实现一个创建小汽车的创建者 BuildSmallCar

```go
/*
创建者模式
*/

type Car struct {
	Num   int
	Color string
}

type CarBuild interface {
	SetNum(int)Build
	SetColor(string)
	Build() Car
}

type BuildSmallCar struct {
	Num   int
	Color string
}

func (b *BuildSmallCar) SetNum(num int) {
	if num < 10 {
		b.Num = num
	}
}

func (b *BuildSmallCar) SetColor(color string) {
	b.Color = color
}

func (b *BuildSmallCar) Build() Car{
	return Car{
		Num: b.Num,
		Color: b.Color,
	}
}

```

## 6. 原型链
原型链表示的是一种对象属性查找次序，是实现面向对象的另一种方式，像 JavaScript、Lua 就是使用原型链来实现面向对象，Go 语言使用的比较少，在此补在详述。

## 6. 单例模式
单例模式用于创建系统唯一对象，需要使用加锁保证并发情况下对象创建唯一。

```go
import "sync"
type Singleton struct{}
var singleton *Singleton
var once sync.Once

//GetInstance 用于获取单例模式对象
func GetInstance() *Singleton {
	once.Do(func() {
		singleton = &Singleton{}
	})

	return singleton
}
```
