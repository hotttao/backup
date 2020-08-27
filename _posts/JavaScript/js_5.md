---
title: 4 JavaScript 函数
date: 2020-08-06
categories:
    - 前端
tags:
	- JavaScript
---
JS 中的函数是一个引用类型的值，所有函数都是 Function 类型的实例。
<!-- more -->

## 1. 函数创建
JavaScript 中函数有三种创建方式:
1. 函数声明语法
2. 函数表达式
3. Function 构造函数: 接收多个参数，最后一个参数为函数体(很少使用)

```js
function sum(n1, n2){
    return n1 + n2; // 注意分号不要省略
}

var sum = function(n1, n2){
    return n1 + n2; 
};                 // 还要注意函数末尾有一个分号，就像声明其他变量时一样。

var sum = new Function("n1",  "n2", "return n1+n2");
```

函数声明和函数表达式并不完全一致:
1. 解析器会率先读取函数声明，并使其在执行任何代码之前可用 -- 函数声明提升
2. 函数表达式，则必须等到解析器执行到它所在的代码行，才会真正被解释执行
3. 除了什么时候可以通过变量访问函数这一点区别之外，函数声明与函数表达式的语法其实是等价的。

注: 不带标识符的 function 声明的是匿名函数，而带标识符 function 也可以作为表达式，叫命名函数表达式，但是必须使用括号包裹函数声明像下面这样:
```js
var factorial = (function f(num){
    if (num <=1>){
        return 1;
    } else {
        return num * factorial(num - 1); 
        return num * arguments.callee(num - 1) 
    }
});  // function 外的括号必不可少
```

## 2. 函数参数
JavaScript 的函数参数非常诡异:
1. 函数内部有一个特殊的对象 arguments 它是一个类数组对象，收集了传入函数中的所有参数
2. 命名的参数只提供便利，但不是必需的，解析器不会验证命名参数。意味着 JavaScript 的函数直接就可以接收任意数量的参数。
3. 没有传递值的命名参数将自动被赋予undefined值
3. arguments对象可以与命名参数一起使用，arguments的值永远与对应命名参数的值保持同步
4. arguments 与命名参数值同步，并不是说读取这两个值会访问相同的内存空间；它们的内存空间是独立的，但它们的值会同步。
5. 如果只传入了一个参数，那么为`arguments[1]`设置的值不会反映到命名参数中。这是因为arguments对象的长度是由传入的参数个数决定的，不是由定义函数时的命名参数的个数决定的

在下面这个示例中:
1. num1的值与`arguments[0]`的值相同，因此它们可以互换使用
2. 修改 `arguments[0]` num1 的值会自动同步
3. 如果只传入一个参数，对`arguments[1]` 的赋值不会反映到 num2 中，num2 仍然为 undefined

```js
funciton doAdd(num1, num2){
    if (arguments.length == 1){
        return num1 + 10;
    } else if (arguments.length == 2){
        return arguments[0] + num2;
    }
}
```

### 2.1 arguments 的其他属性
arguments 还有如下一些特殊的属性:
1. callee: 是一个指针，指向拥有这个arguments对象的函数，可用于将函数与函数名解耦

```js
function factorial(num){
    if (num <=1>){
        return 1;
    } else {
        return num * factorial(num - 1); // 如果 factorial 函数名被重新赋值就会发生错误
        return num * arguments.callee(num - 1) // 正确写法
    }
}

var trueF = factorial;
factorial = function(num){
    return 0;
};
```

使用命名函数表达式可以达到同样的效果:

```js
var factorial = (function f(num){
    if (num <=1>){
        return 1;
    } else {
        return num * factorial(num - 1); 
        return num * arguments.callee(num - 1) 
    }
});  // function 外的括号必不可少
```



## 3. 函数内部属性
在函数内部，有多个特殊的对象：
1. arguments
2. this
3. caller
4. length: 表示函数希望接收的命名参数的个数
5. prototype: 函数对象的原型，不仅函数有，所有引用类型都存在

### 3.1 this
arguments 我们已经说过了，而 this 引用的是函数执行的环境对象。this 的是在函数被调用时决定的。原因也很简单，环境对象也是函数调用时创建的。

当在全局作用域中调用sayColor()时，this引用的是全局对象window；当把函数赋值给某个对象时，this 指向的就是该对象。

```js
window.color = "red";
var o = {"color": "blue"};
function sayColor(){
    alter(this.color);
}

sayColor(); // red
o.sayColor = sayColor();
o.sayColor(); // blue
```

### 3.2 caller
caller 属性中保存着调用当前函数的函数的引用，如果是在全局作用域中调用当前函数，它的值为null。为了实现更松散的耦合，也可以通过arguments.callee.caller来访问相同的信息。

### 3.3 prototype
prototype 原型，与JavaScript 原型链和面向对象编程相关，我们在后面介绍 JavaScript 面向对象编程时在详细介绍。在ECMAScript 5中，prototype属性是不可枚举的，因此使用for-in无法发现。

## 4. 函数方法
每个函数都包含两个非继承而来的方法：apply()和call()。这两个方法的用途都是在特定的作用域中调用函数，实际上等于设置函数体内this对象的值。

apply()方法接收两个参数：
1. 一个是在其中运行函数的作用域
2. 另一个是参数数组，可以是Array的实例，也可以是arguments对象

call()方法与apply()方法的作用相同，它们的区别仅在于接收参数的方式不同。对于call()方法而言
1. 第一个参数是this值没有变化，变化的是其余参数都直接传递给函数
2. 在使用call()方法时，传递给函数的参数必须逐个列举出来

apply()和call() 真正强大的地方是能够扩充函数赖以运行的作用域。

```js
window.color = "red"
var o = {"color": "blue"};

function sayColor(){
    alter(this.color);
}

sayColor(); // red
sayColor.apply(window); // red
sayColor.apply(o); // blue 
// sayColor 函数不需要与任何对象发生耦合
```

### 4.1 bind
ECMAScript 5还定义了一个方法：bind()。这个方法会创建一个函数的实例，其this值会被绑定到传给bind()函数的值。

```js
window.color = "red"
var o = {"color": "blue"};

function sayColor(){
    alter(this.color);
}

var oSay = sayColor.bind(o); //  oSay()函数的this值等于o
oSay(); // blue
```

## 5. 作用域链与闭包