---
title: 3 JavaScript 基本语法
date: 2020-08-06
categories:
    - 前端
tags:
	- JavaScript
---
本节我们来介绍 J avaScript 中的基本概念，包括语法、变量，数据类型，操作符，流控以及函数，这些基础概念构成了一门编程语言的骨架。
<!-- more -->

![JavaScript](/images/JavaScript/JavaScript.png)

## 1. 语法

```js

```

JavaScript 是一门类 C 语言，语法具有如下特性:
1. 区分大小写
2. 标识符: 
	- 标识符，是指变量、函数、属性的名字，或者函数的参数
	- 与其 Python/Go 不同的是，JavaScript 的标识符可以包含或者以 $ 开头
	- 官方推荐使用驼峰命名方式
3. 注释:
	- 单行注释: `//`
	- 多行注释: `/* */`
4. 语句: 
	- 以分号结尾，可省略，但不建议省略
	- 代码结尾处没有分号会导致压缩错误
5. 代码块: `{}`

### 1.1 严格模式
ES5 引入了严格模式（strict mode）的概念，在严格模式下可以避免 ES3 中一些不明确行为，对于不安全行为也会抛出异常。要在整个脚本中启用严格模式，可以在顶部添加 `"use strict";`。这是一个编译指示，用于告诉支持的JavaScript引擎切换到严格模式。在函数内部的上方包含这条编译指示，也可以指定函数在严格模式下执行：

```js
function doS(){
	"use strict";
	// TODO:
}
```


## 3. 操作符
与其他语言不同的是 JavaScript 的操作符包含了复杂的类型转换，总体上:
1. 数值运算法需要将其他类型转换为数值类型在进行运算，比如一元运算，位运算，乘除取模运算，但是不包括加法运算
2. 布尔运算支持短路逻辑，在用于条件判断时，总是将其他类型转换为布尔值在进行运算
3. NaN，Infinity, Null, Undefined 需要特殊对待

### 3.1 一元运算符
一元运算符包括:
1. +/-/后置++/后置--/前置++/前置--: 会执行同 Number() 函数一样的转换逻辑
2. delete: 删除对象
3. typeof: 检测变量类型
4. void: 
5. in

#### delete
delete:
- 删除一个对象或一个对象的属性或者一个数组中某一个键值
- 能使用 delete 删除各种各样的隐式声明， 但是被var声明的除外
- 如果 delete可行会返回true，如果不成功返回false

```js
delete objectName;
delete objectName.property;
delete objectName[index];
delete property; // legal only within a with statement
```

#### void

#### in

#### instanceof


### 3.2 位运算符
位运算符包括:
1. `a & b`: 按位与 AND
1. `a | b`: 按位或 OR
1. `a ^ b`: 按位异或 XOR
1. `~a`: 按位非 NOT
1. `a << b`: 左移 shift
1. `a >> b`: 算术右移
1. `a >>> b`: 无符号右移

### 3.3 布尔运算
JS 的布尔运算支持短路逻辑，跟 Python 一样，如果操作数不是布尔值，逻辑运算符不一定返回布尔值。

布尔运算符包括:
1. 逻辑与 (&&): `expr1 && expr2`
	- 如果第一个操作数是对象，则返回第二个操作数；
	- 如果有一个操作数是null，则返回null；如果有一个操作数是NaN，则返回NaN；如果有一个操作数是undefined，则返回undefined。
2. 逻辑或 (||): `expr1 || expr2`
	- 如果第一个操作数是对象，则返回第一个操作数；
	- 如果两个操作数都是null，则返回null；如果两个操作数都是NaN，则返回NaN；如果两个操作数都是undefined，则返回undefined。
3. 逻辑非 (!): `!expr`
	- 如果操作数是任意非0数值（包括Infinity），返回false；
	- 如果操作数是null，返回true；如果操作数是NaN，返回true；如果操作数是undefined，返回true。
	
### 3.5 算术运算
乘法(*)遵循如下转换规则:
1. 如果有一个操作数是NaN，则结果是NaN；
2. 如果是Infinity与0相乘，则结果是NaN；
3. 如果是Infinity与非0数值相乘，则结果是Infinity或-Infinity，取决于有符号操作数的符号；
4. 如果是Infinity与Infinity相乘，则结果是Infinity；
5. 如果有一个操作数不是数值，则在后台调用Number()将其转换为数值，然后再应用上面的规则。

除法(*)遵循如下转换规则:
1. 如果有一个操作数是NaN，则结果是NaN；
2. 如果是Infinity被Infinity除，则结果是NaN；
3. 如果是零被零除，则结果是NaN；
4. 如果是非零的有限数被零除，则结果是Infinity或-Infinity，取决于有符号操作数的符号；
5. 如果是Infinity被任何非零数值除，则结果是Infinity或-Infinity，取决于有符号操作数的符号；

求模(%)遵循如下转换规则:
1. 如果被除数是无穷大值而除数是有限大的数值，则结果是NaN；
2. 如果被除数是有限大的数值而除数是零，则结果是NaN；
3. 如果是Infinity被Infinity除，则结果是NaN；
4. 果被除数是有限大的数值而除数是无穷大的数值，则结果是被除数；

减法(-)遵循如下转换规则:
- 如果是Infinity减Infinity，则结果是NaN；
- 如果是+0减+0，则结果是+0；如果是+0减-0，则结果是-0；如果是-0减-0，则结果是+0；

JS 加法运算符的转换逻辑更加复杂，针对不同类型有不同的计算逻辑:
1. 数值类型:
	- 如果有一个操作数是NaN，则结果是NaN；
	- 如果是Infinity加-Infinity，则结果是NaN；
	- 如果是+0加+0，则结果是+0；如果是-0加-0，则结果是-0；如果是+0加-0，则结果是+0。
2. 字符串类型:
	- 如果两个操作数都是字符串，则将第二个操作数与第一个操作数拼接起来；
	- 如果只有一个操作数是字符串，则将另一个操作数转换为字符串，然后再将两个字符串拼接 
3. 其他运算:
	- 如果有一个操作数是对象、数值或布尔值，则调用它们的toString()方法取得相应的字符串值，然后再应用前面关于字符串的规则。
	- 对于undefined和null，则分别调用String()函数并取得字符串"undefined"和"null"。

```js
var num1 = 5;
var num2 = 10;
var message = "The sum of 5 and 10 is " + num1 + num2;
alert(message);    // "The sum of 5 and 10 is 510"
```

### 3.6 关系运算符
