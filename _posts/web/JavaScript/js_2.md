---
title: 2 JavaScript 变量和类型系统
date: 2020-08-05
categories:
    - 前端
tags:
	- JavaScript
---
本节我们来介绍 JavaScript 中的数据类型
<!-- more -->

![JavaScript](/images/JavaScript/JavaScript.png)

## 1. JavaScript 的变量和类型
JavaScript 有 6 种基本类型:
1. Undefined: 未定义，变量已经声明但未赋值
2. Null: 
3. Boolean
4. Number
5. String
6. Object: 对象，本质上是一组无序的键值对

JavaScript 中的变量是松散类型，可以用来保存任意类型的数据，即变量没有类型，值具有类型。每个变量仅仅是一个用于保存值的占位符而已。变量的定义有如下几种方式:

```js
message = 10; // 无论在何处都会声明一个全局变量，不建议使用
var message;  
var a = "hi";

```

### 1.1 值与引用
按照值在变量中的保存方式，类型又分为:
1. 基础类型值: 
	- 除 Object 外其他类型都是基础类型值，变量中保存的是实际的值
	- 占据固定大小的空间，因此被保存在栈内存中
2. 引用类型值: 
	- Object 是引用类型值，变量中保存的是对象的引用，Object 实际保存在堆内存中

在 JavaScript 中变量的赋值和参数的传递是按值传递的，这意味着:
1. 对于基础类型的值，在赋值和传参时会创建一个新值
2. 对于引用类型的值，赋值和传参时创建的是对象的引用，它们指向的是相同的对象，类似 Python 中的共享引用

```js
// 基础类型值无法动态添加属性
var a=10
a.age=10
console.log(a.age) // undefined

var a = new object()
a.age=10
console.log(a.age) // 10
```

### 1.2 基本类型与基本类型的包装类型
除了特殊的 Undefined 和 Null，Number，String，Boolean 都有与之对应的包装类型。包装类型属于引用类型，用于为这三种类型添加属性和方法，便于对他们的操作。


除此之外我们只能给引用类型的值可以动态的添加属性，不能给基础类型的值动态的添加属性。

接下来我们会一一讲解这六种类型的使用以及用于变量类型检测的 typeof 操作符。Object 对象与 JavaScript 的原型链密切相关我们之后在作更详细介绍。之所以要先介绍 JavaScript 里面的数据类型，是因为 JavaScript 里面数据类型有一套非常复杂的转换关系，在后面介绍的操作符等语法知识时需要它们的转换规则。

## 2. 变量类型检测
确定一个值是哪种基本类型可以使用typeof操作符，而确定一个值是哪种引用类型可以使用instanceof操作符。

### 2.1 检测变量类型
使用 typeof 关键字可以检测给定变量的数据类型(准确来说是变量中存储值的数据类型)。

对一个值使用**typeof操作符**可能返回下列某个字符串：
1. "undefined": Undefined
2. "boolean": Boolean
3. "string": String
4. "number": Number
5. "object": **对象或null**
6. "function": **函数**

注意调用`typeof null`会返回"object"，因为特殊值null被认为是一个空的对象引用。从技术角度讲，函数在ECMAScript中是对象，不是一种数据类型。然而，函数也确实有一些特殊的属性，因此通过typeof操作符来区分函数和其他对象是有必要的。

### 2.2 检测对象所属的原型
使用 instanceof 操作符可以检测对象所属的原型，通过原型链来识别。后面我们会详细介绍原型以及原型的实例。按照规定所有引用类型的值都是 Object 的实例，Object 是原型链的起点。instanceof 语法如下:

```js
var result  variable instanceof constructor
```

## 2. Undefined
在使用var声明变量但未对其加以初始化时，这个变量的值就是undefined。不过值为 undefined 的变量与未声明的变量还是不一样的，对于尚未声明过的变量，只能执行一项操作，即使用typeof操作符检测其数据类型。对未初始化和未声明的变量执行 typeof 操作符都会返回 undefined。所以除非显示初始化，否则无法通过 typeof 判断对象是未声明，还是未初始化。

```js
var message 
alter(message == undefined) // true

// var age
alter(age) // 产生错误

alter(typeof message) // undefined
alter(typeof age) // undefined
```

## 3. Null
从逻辑角度来看，null值表示一个空对象指针，而这也正是使用typeof操作符检测null值时会返回"object"的原因。如果定义的变量准备在将来用于保存对象，那么最好将该变量初始化为null而不是其他值。实际上，undefined值是派生自null值，`undefined == null` 相等性测试总是返回 true。


```js
var car=null;
alter(typeof car) // "object"

alter(undefined == null) // true
```

## 4. Boolean
JavaScript 中的布尔值是小写的 true 和 false。

使用 Boolean() 函数可以将任意其他类型转换为布尔类型。下面是转换的规则:
1. string: 空字符串->false
2. number: 0/NaN->false
3. 对象: ->true
4. null/undefined: ->false

除了显示类型转换，在所有的条件判断中都会发生上述的类型转换。

## 5. Number
JavaScript 种以下几个特殊的数值:
1. Number.MIN_VALUE: 表示浮点数的下限，最小值
2. Number:MAX_VALUE: 表示浮点数的上限，最大值
3. -+Infinity: 
	- 表示超出数值范围的值
	- Number.POSITIVE_INFINITY 表示 +Infinity
	- Number.NEGATIVE_INFINITY 表示 -Infinity
	- 使用 isFinite()函数可判断值是否在数值范围内
4. NaN: 
	- 非数值，用于表示本来要返回数值的操作为返回数值的情况，例如除 0 操作
	- NaN 与任何值的操作都返回 NaN
	- NaN 与任何值不相等，包括自身
	- isNaN() 函数用于判断值是否为 NaN

JavaScript 中有三个函数可以把非数值转换为数值:
1. Number(num): 任意类型转换为数值
2. parseInt(num, base): 将字符串转换为整型
3. parseFloat(num): 将字符串转换成整数或浮点数

Number() 函数有一套复杂的转换规则，简单总结起来:
1. true/false -> 1/0
2. null -> 0
3. undefined -> NaN
4. string -> 忽略空格和前缀 0，并按数值进行解析

而 paseInt 和 parseFloat 在解析字符串时，会忽略字符串前面的空格，直至找到第一个非空字符，如果第一个非空字符不是数字或负号就返回 NaN(`parseInt("")` 会返回 NaN)。paseInt/parseFloat 会解析到最后或遇到一个非数字字符。例如 `parseInt(123blue)->123`

## 6. String
在 JavaScript 中 String 可以使用单引号或双引号表示，并且是不可变类型，其包含如下属性或方法:
1. length(): 返回字符串的长度

有两种方法可以将其他类型转换为 String:
1. 值的 toString() 方法:
	- 除了 null/undefined 其他所有的值都有 toString() 方法，该方法返回值的字符串表示
	- 对于数值，toString()，还可以指定返回值的进制
2. String() 函数:
	- 值有 toString() 方法: 返回 toString() 的返回值
	- null: 返回 "null"
	- undefined: 返回 "undefined"

## 6. 对象
Object 是引用类型，类似传统面向对象中的类。对象是 Object 的实例，是一组数据和功能的集合。JavaScript 使用原型的方式来实现面向对象编程。Object 有点类似 Python 中的 Object，它是所有对象的原型的启点，提供了一些基础公共方法。

JavaScript 中内置了很多有引用类型，比如 Array(数组)，RegExp(正则表达式)，Date(日期时间)，我们也可以自定义引用类型。如何使用这些引用类型以及自定义引用类型我们会一一介绍，我们先来看看如何使用 Object。

### 6.1 对象创建
对于 Object 和内置引用类型的实例一般都有两种创建方式:
1. `new + 构造函数()` 
2. 对象字面量: 不会调用 Object 构造函数

```js
// 创建 Object类型的实例并为其添加属性或方法，就可以创建自定义对象
var person=Object()
person.name="tsong"
person.age=30

// 对象字面量
var person = {
	name: "tsong", // 属性名可以加引号，也可以不加，默认都会转为字符串
	age: 30,      // 最后一个属性不能有逗号 
	5: "test"     // 数值属性名会自动转换为字符串
}
```

### 6.2 属性访问
对象属性可以通过 `.`，也可以通过`[]` 进行访问，使用方括号的主要优点是可以通过变量来访问属性，对于存在语法错误的属性只能通过方括号进行访问。

```js
pernon["name"]
person.name
```

### 6.3 Object 提供的默认方法和属性
Object 具有如下属性和方法:
1. Constructor: 保存用于创建当前对象的函数
2. hasOwnProperty(propertyName): 
	- 用于检查给定的属性在当前对象实例中是否存在
	- 注意不是在对象的原型中是否存在
3. isPrototypeOf(object): 检查传入的对象是否是另一个对象的原型
4. propertyIsEnumerable(propertyName): 用于检查给定的属性是否能够使用 for-in 语句来枚举
5. toLocaleString(): 返回对象的字符串表示，该字符串与执行环境的地区对应
6. toString(): 返回对象的字符串表示
7. valueOf(): 返回对象的字符串、数值或者布尔值表示，通常与 toString() 返回值相同

由于在ECMAScript中Object是所有对象的基础，因此所有对象都具有这些基本的属性和方法，通常会重载这些方法。但是从技术角度讲，ECMA-262中对象的行为不一定适用于JavaScript中的其他对象。浏览器环境中的对象，比如BOM和DOM中的对象，都属于宿主对象，因为它们是由宿主实现提供和定义的。ECMA-262不负责定义宿主对象，因此宿主对象可能会也可能不会继承Object

### 6.3 对象的类型转换
JavaScript 中的对象存在类似 Python 中运算符重载的功能，对对象作的值类型转换或判断基本都会首先调用对象的valueOf()方法，然后确定该方法返回的值是否可以转换。如果不能，则基于这个返回值再调用toString()方法，再测试返回值。

由于 Object 对象与 JavaScript 原型链密切相关，更详细的内容我们后面介绍 JavaScript 面向对象时再来详述。