---
title: 5 JavaScript 基础类型的包装类型
date: 2020-08-08
categories:
    - 前端
tags:
	- JavaScript
---
为了便于操作 JavaScript 中的基础类型，JavaScript 提供了基础类型的包装类型，包括 Number，Boolean，String，它们属于引用类型。
<!-- more -->


## 1. 基本类型类型的包装类型
每当读取一个基本类型值的时候，后台就会创建一个对应的基本包装类型的对象，从而让我们能够调用一些方法来操作这些数据。

```js
var s1 = "some text"
var s2 = s1.substring(2)
```

s1 是基本类型字符串，基本类型值不是对象，因而从逻辑上讲它们不应该有方法。为了方便操作基本类型，后台已经自动完成了一系列的处理。当第二行代码访问s1时，访问过程处于一种读取模式，也就是要从内存中读取这个字符串的值。

而在读取模式中访问字符串时，后台都会自动完成下列处理:
1. 创建String类型的一个实例
2. 在实例上调用指定的方法
3. 销毁这个实例

可以将以上三个步骤想象成是执行了下列ECMAScript代码。
```js
var s1 = new String("some text");
var s2 = s1.substring(2);
s1 = null;
```
### 1.1 基本包装类型的生命周期
引用类型与基本包装类型的主要区别就是对象的生存期:
1. 使用new操作符创建的引用类型的实例，在执行流离开当前作用域之前都一直保存在内存中
2. 自动创建的基本包装类型的对象，则只存在于一行代码的执行瞬间，然后立即被销毁，这意味着我们不能在运行时为基本类型值添加属性和方法

```js
var s1 = "some text"
s1.color = "red"   // 
console.log(s1.color) // null
```

第二行创建的String对象在执行第三行代码时已经被销毁了。第三行代码又创建自己的String对象，该对象是没有 color 属性的。

### 1.2 基本包装类型的使用注意
可以显式地调用Boolean、Number和String来创建基本包装类型的对象。不过，应该在绝对必要的情况下再这样做，因为这种做法很容易让人分不清自己是在处理基本类型还是引用类型的值。

对基本包装类型的实例调用typeof会返回"object"，而且所有基本包装类型的对象在转换为布尔类型时值都是true。

Object构造函数也会像工厂方法一样，根据传入值的类型返回相应基本包装类型的实例。

```js
var v = new Object("text");
v instanceof String;  // true
```

要注意的是，使用new调用基本包装类型的构造函数，与直接调用同名的转型函数是不一样的。因为一个是创建了新的对象，一个是类型转换。

## 2. Boolean 类型
Boolean类型是与布尔值对应的引用类型。因为 Boolean 包装对象没有什么可用方法，而且因为它是对象，对象的布尔值总为 true，在使用上返回会造成无解，因此永远不要使用 Boolean 包装对象。

```js
var b  = new Boolean(false)
console.log(b && true) // true
```

## 3. Number 类型
Number是与数字值对应的引用类型。Number 包装类型有如下属性和方法

|属性/方法|作用|
|:---|:---|:---|
|valueOf()|返回对象的基本类型的值||
|toString(base)|返回字符串形式的数值，base 表示数值的进制||
|toLocaleString(base)|同 toString()||
|toFixed(n)|按照指定的小数位返回数值的字符串表示，n 表示小数位个数||
|toExponential(n)|返回以指数表示法（也称e表示法）表示的数值的字符串形式，n 表示小数位个数||
|toPrecision(n)|返回数值的最合适表示方式，n 表示所有数字的位数||

## 4. String 类型
String类型是字符串的对象包装类型。String 包装类型有如下属性和方法

|属性/方法|作用|
|:---|:---|:---|
|length|返回字符串的长度||
|charAt(n)|以单字符字符串的形式返回给定位置的那个字符||
|charCodeAt(n)|获取指定位置字符的编码||
|[n]|可以使用方括号加数字索引来访问字符串中的特定字符||
|concat(s1, s2,..)|拼接字符串，不如 + 好用||
|indexOf(substr, start)|从start 位置开始，从前往后，查找子串的位置||
|lastIndexOf(substr, start)|从start 位置开始，从后往前，查找子串的位置||
|trim()|去除首尾空格|
|toLowerCase()|转小写||
|toLocaleLowerCase()|转小写||
|toUpperCase()|转大写||
|toLocaleUpperCase()|转大写||
|localeCompare(string)|字符串比较，-1 表示字符串在参数字符串前，0 表示相等，1 表示在之后，返回值取决于实现||
|String.fromCharCode(num1, num2)|将字符编码转换为字符串||

### 4.1 获取子串
slice, substring, substr 用于获取字符串的子串:

slice(start, [end]:
- 返回: 开始到结束位置的子串
- start: 负值会与字符串长度相加
- end: 负值会与字符串长度相加，省略表示到字符串结尾

substring(start, [end]):
- 返回: 开始到结束位置的子串，会自动把 start 和 end 中的较小值作为 start
- start: 负值转换成 0 
- end: 负值转换成 0，省略表示到字符串结尾

substr(start, [len])
- 返回: 开始位置，长度为 len 的子串
- start: 负值会与字符串长度相加
- len: 负值转换成 0，省略表示到字符串结尾

### 4.2 字符串模糊匹配
match(RegExp):
- 作用: 与调用RegExp的exec()方法相同

search(RegExp)
- 作用: 返回字符串中第一个匹配项的索引；如果没有找到匹配项，则返回-1
- 注意: search()方法始终是从字符串开头向后查找模式

### 4.3 字符串替换
replace(string|RegExp, string|function):
- 作用: 字符串替换
- 参数一:
    - 可以是一个RegExp对象或者一个字符串（这个字符串不会被转换成正则表达式）
    - 是字符串，那么只会替换第一个子字符串
    - 要想替换所有子字符串，唯一的办法就是提供一个正则表达式，而且要指定全局（g）标志
- 参数二:
    - 第二个参数可以是一个字符串或者一个函数
    - 可以使用特殊字符序列，引用最近一次匹配结果，这些特殊字符就是RegExp 中的短属性名
        - $$: $ 本身
        - $n: 第 n 个匹配组
        - $nn: 第 1-99 个匹配组
    - 如果是函数，在只有一个匹配项，会接收 3个参数：
        - 模式的匹配项
        - 模式匹配项在字符串中的位置
        - 原始字符串
    - 如果是函数，在正则表达式中定义了多个捕获组的情况下，传递给函数的参数依次是
        - 模式的匹配项、第一个捕获组的匹配项、第二个捕获组的匹配项……，
        - 最后两个参数仍然分别是模式的匹配项在字符串中的位置和原始字符串

```js
var text = "cat, bat, sat"
text.replace("at", "ood")

text.replace(/at/g, "ood")

text.replcae(/(.at)/g, "word ($1)")
```

### 4.4 字符串分割
split(string|RegExp, n):
- 作用: 分割字符串为数组
- 参数1: 字符串或者正则表达式，字符串不会自动转为 正则表达式
- 参数2: 指定数组的大小

```js
var color = "red,black,blue"
color.split(",")
color.split(",", 2) // [red, black]
color.split(/[^\,]+/) // ["", ",", ","]
```