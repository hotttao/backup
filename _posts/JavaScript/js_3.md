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
6. 函数:
	- 是一种引用类型的值，使用 function 关键词来申明
	- 默认没有返回值

### 1.1 严格模式
ES5 引入了严格模式（strict mode）的概念，在严格模式下可以避免 ES3 中一些不明确行为，对于不安全行为也会抛出异常。要在整个脚本中启用严格模式，可以在顶部添加 `"use strict";`。这是一个编译指示，用于告诉支持的JavaScript引擎切换到严格模式。在函数内部的上方包含这条编译指示，也可以指定函数在严格模式下执行：

```js
function doS(){
	"use strict";
	// TODO:
}
```

## 2. 流控
JavaScript 支持一下流控语句:
1. 判断: if/switch
2. 循环: 
	- do-while/while/for
	- lable/break/continue
3. 枚举: for-in
4. with


### 2.1 条件判断
```js
if (i > 25) {
    alert("Greater than 25.");
} else if (i < 0) {
	alert("Less than 0.");
} else {
    alert("Between 0 and 25, inclusive."); // 不要忘记结尾的分号
}

switch (i) {
    case 25: 
        /* 合并两种情形 */
    case 35: 
        alert("25 or 35");
        break;    // 必须显示使用 break 退出 case 语句
	default: 
        alert("Other");
}

var num = 25;
switch (true) {
    case num < 0: 
        alert("Less than 0.");
        break;
    case num >= 0 && num <= 10: 
        alert("Between 0 and 10.");
        break;
	default: 
        alert("More than 10.");
}
```

JS 的 switch 有以下特色:
1. 要退出 switch 必须在每个 case 语句显示使用 break，类似 shell
2. switch 可以使用任何类型，包括变量或者表达式
3. switch语句在比较值时使用的是全等操作符，因此不会发生类型转换


### 2.2 循环
```js
do {
	statement
} while(expression); // 不要忘记结尾的分号


while(expression){
	statement
}

var count = 10;
for (var i = 0; i < count; i++){
    alert(i);
}

for (;;) {     // 无限循环
    doSomething();
}


// label 用于执行类似 goto d的语句
var num = 0;
outermost:
for (var i=0; i < 10; i++) {
     for (var j=0; j < 10; j++) {
        if (i == 5 && j == 5) {
            break outermost;
        }
        num++;
    }
}
alert(num);    //5
```



### 2.3 枚举对象属性
```js
for (var propName in window) {
     document.write(propName);
}
```

在使用for-in循环时，返回的是所有能够通过对象访问的、可枚举的（enumerated）属性，其中既包括存在于实例中的属性，也包括存在于原型中的属性。屏蔽了原型中不可枚举属性（即将`[[Enumerable]]`标记为false的属性）的实例属性也会在for-in循环中返回。属性特性我们会在后面面向对象中详细介绍。

### 2.4 with
with语句的作用是将代码的作用域设置到一个特定的对象中

```js
with(location){
    var qs = search.substring(1);
    var hostName = hostname;
    var url = href;
}
```

在with语句的代码块内部，每个变量首先被认为是一个局部变量，而如果在局部环境中找不到该变量的定义，就会查询location对象中是否有同名的属性。如果发现了同名属性，则以location对象属性的值作为变量的值。

由于大量使用with语句会导致性能下降，同时也会给调试代码造成困难，不建议使用with语句。


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
in操作符会在通过对象能够访问给定属性时返回true，无论该属性存在于实例中还是原型中。

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
关系运算符运算符包括:
1. `><`:
	- 如果两个操作数都是字符串，则比较两个字符串对应的字符编码值。
	- 如果一个操作数是布尔值，则先将其转换为数值，然后再执行比较。
	- 在比较数值和字符串时，字符串都会被转换成数值，然后再以数值方式与另一个数值比较
2. `==/!=`: 相等/不相等 -- 先转换在比较
	- 布尔值->数值
	- 如果一个操作数是字符串，另一个操作数是数值，将字符串转换成数值
	- 如果一个操作数是对象，另一个操作数不是，则调用对象的valueOf()方法，用得到的基本类型值按照前面的规则进行比较；
	- null和undefined是相等的，要比较相等性之前，不能将null和undefined转换成其他任何值。
	- NaN 与任何值不等
	- 如果两个操作数都是对象，则比较它们是不是同一个对象
3. `===/!===`: 全等和不全等 -- 仅比较不转换
	- 不转换类型条件下相等
	- null == undefined会返回true，因为它们是类似的值；但null === undefined会返回false，因为它们是不同类型的值。

### 3.7 条件操作符
```js
variable = boolean_expression ? true_value : false_value;
```

### 3.8 逗号操作符
逗号在 JS 中有以下几个作用:
1. 使用逗号操作符可以在一条语句中执行多个操作，多用于声明多个变量；
2. 除此之外，逗号操作符还可以用于赋值。在用于赋值时，逗号操作符总会返回表达式中的最后一项

```js
var num1=1,num2=2
var num = (5, 1, 4, 8, 0); // num的值为0
```

## 4. 错误处理
JavaScript 中使用 `try-catch-finally` 和 `throw` 来处理和触发异常，他们的语法如下:

```js

try {
	// code
} catch(error){
	// 错误处理
} finally {
	// 无论如何都会执行的代码
}
```

### 4.1 try-catch-finally
1. catch块会接收到一个包含错误信息的对象，错误对象包含如下属性:
	- message: 保存着错误消息的message属性
	- name: 保存着错误类型
	- 其他属性因浏览器而异
2. 只要代码中包含finally子句，则无论try或catch语句块中包含什么代码——甚至return语句，都不会阻止finally子句的执行
3. catch或finally有一个即可

所以下面的函数执行返回的是 0 而不是 2，因为 finally 语句无论如何都会执行

```js
function finallyTest(){
	try{
		return 0
	} catch {
		return 1
	} finally {
		return 2
	}
}
```

### 4.2 错误类型
ECMA-262定义了下列7种错误类型：
1. Error:
	- 基类型，其他错误类型都继承自该类型
	- 很少直接使用，主要用于自定义异常类型
2. EvalError
3. RangeError: 索引或数值超过范围
4. ReferenceError: 找不到对象
5. SyntaxError: 语法错误
6. TypeError: 类型不支持要求的属性或方法
7. URIError: 使用encodeURI()或decodeURI()，URI格式不正确

可以像下面这样在try-catch语句的catch语句中使用instanceof操作符来判断具体的错误类型

```js
try {
	// code
} catch(error){
	if (error instanceof ReferenceError){

	}
}
```

### 4.3 自定义和抛出异常
利用原型链还可以通过继承Error来创建自定义错误类型。需要为新创建的错误类型指定name和message属性。

```js
function CustomError(message){
	this.name = "CustomError";
	this.message = message;
}

CustomError.prototype =  new Error();
thro new CustomError("custom error");
```

throw操作符，用于抛出异常:
1. 抛出错误时，必须要给throw操作符指定一个值，这个值是什么类型，没有要求
2. 在遇到throw操作符时，代码会立即停止执行。仅当有try-catch语句捕获到被抛出的值时，代码才会继续执行

```js
// throw 必须指定一个值
throw 123445
throw True
```

抛出自定义异常的另一种方式是使用 assert() 函数，其接受两个参数:
1. 一个是求值结果应该为true的条件
2. 另一个是条件为false时要抛出的错误

```js
assert(condition, err_msg);
```

### 4.4 错误事件
事件的具体内容我们会在后面详细介绍，此处只需要知道: 任何没有通过try-catch处理的错误都会触发window对象的error事件。

### 4.5 如何避免错误
避免发生错误有如下建议:
1. 类型判断: 在使用变量前进行变量类型检测，基本类型的值应该使用typeof来检测，而对象的值则应该使用instanceof来检测
2. 对于查询字符串，必须要使用encodeURIComponent()函数进行编码

### 4.6 如何把错误记录到服务器
可以使用下面的函数把页面错误记录到后台服务器:

```js
function logError(sev, msg){
	var img = new Image();
	img.src = "log.php?sev=" + encodeURIComponent(sev) + "&msg=" + encodeURIComponent(msg);
}
```

使用了Image对象来发送请求，这样做非常灵活，主要表现如下几方面
1. 所有浏览器都支持Image对象，包括那些不支持 XMLHttpRequest 对象的浏览器
2. 可以避免跨域限制，通常都是一台服务器要负责处理多台服务器的错误，而这种情况下使用XMLHttpRequest是不行的
