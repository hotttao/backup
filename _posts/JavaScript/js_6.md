---
title: 6 JavaScript 函数
date: 2020-08-09
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

注: 不带标识符的 function 声明的是匿名函数，而带标识符 function 也可以作为表达式，叫命名函数表达式，但是必须使用括号包裹函数声明像下面这样(ES6中已经不是必须):
```js
var factorial = (function f(num){
    if (num <=1){
        return 1;
    } else {
        return num * factorial(num - 1); 
        return num * arguments.callee(num - 1) 
    }
});  // function 外的括号必不可少，ES6中已经不是必须

f(3); // 命名函数表达式中的函数名 f，有点类似函数的形参,只能在函数的内部使用，不能在函数外部使用
```

### 1.1 函数调用
函数在声明后，有四种调用方式:
1. 函数调用模式: 直接调用
2. 方法调用模式: 作为对象的方法调用
3. 构造函数调用模式: 使用 new 关键字调用
4. 间接调用模式: 使用函数的 call 和 aplly 方法进行调用

要注意的是，不同的调用方式会影响`函数内部 this 的指向`，以及`函数的返回值`。这个非常重要，我们会在后面详细介绍它们的区别。

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
4. length: 表示函数希望接收的形参个数
5. prototype: 函数对象的原型，不仅函数有，所有引用类型都存在
6. name: 当前函数的名称，对于匿名函数就是函数赋值的变量名称，对于命名好函数就是命名函数的名称

### 3.1 this
arguments 我们已经说过了，而 this 引用的是函数执行的环境对象。this 的是在函数被调用时决定的。原因也很简单，环境对象也是函数调用时创建的。

当在全局作用域中调用sayColor()时，this引用的是全局对象window(严格模式下 this 为 undefined)；当把函数赋值给某个对象时，this 指向的就是该对象。

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
    - 在非严格模式下，如果这个值是 null 或者 undefined 将会被转换成全局的 window 对象
    - 在严格模式下，null 或者 undefined 不会转换成 window 对象，函数内的 this 此时就是 null 或 undefined
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

// apply 与 call 方法的应用
// 1.求数组最大值
var arr = [1, 2, 4]
Math.max.apply(null, marr)

// 2. 将类数组转换为真正的数组
function add(){
    // 这里的 arguments 是作为作用域对象传入的，不是参数，所以前面不用传 null
    // slice 方法修改就是作用域对象，作用域对象必须是类数组，即包含数值索引和 length 方法
    var arr = Array.prototype.slice.apply(arguments);
}
// 3. 数组追加
Array.prototype.push.apply(arr, [1,4,10])

// 4. 使用 log 替代 console.log
function log(){
    console.log.apply(console, arguments);
}
log(arr);
```

### 4.1 bind
ECMAScript 5还定义了一个方法：bind()。这个方法会创建一个函数的实例，其this值会被绑定到传给bind()函数的值。bind 通常用来实现函数式编程中的函数柯里化技术

```js
window.color = "red"
var o = {"color": "blue"};

function sayColor(){
    alter(this.color);
}

var oSay = sayColor.bind(o); //  oSay()函数的this值等于o
oSay(); // blue

// 函数柯里化
function getConfig(color, size, other){
    console.log(color, size, other);
}
var defaultConfig = getConfig.bind(null, "red", 100);
defaultConfig("tt");
defaultConfig("dd");
```

## 5. 作用域链与闭包
### 5.1 执行环境和变量对象
要搞清楚 JavaScript 变量的作用域，我们首先要明白两个概念: 执行环境和变量对象:
1. 当某个函数被调用时，会创建一个执行环境（execution context）
2. 后台的每个执行环境都有一个表示变量的对象——变量对象，所有变量和函数都保存在变量对象中
3. 全局环境的变量对象始终存在，而像compare()函数这样的局部环境的变量对象，则只在函数执行的过程中存在
4. 在 Web 浏览器中，全局执行环境被认为是 window 对象，因此所有的全局变量和函数都是作为 window 对象的属性和方法创建的
5. 当执行流进入一个函数时，函数的环境就被推入一个**环境栈**中，函数执行完毕栈被弹出，环境对象被销毁，保存在其中的变量和函数也随之销毁

### 5.2 作用域链的创建
作用域链的创建要从函数的创建和调用说起:
1. 在**创建函数**时会创建一个预先包含全局变量对象的作用域链，这个作用域链被保存在内部的`[[Scope]]`属性中
2. 当调用函数时，会为函数创建一个执行环境，然后通过复制函数的`[[Scope]]`属性中的对象构建起执行环境的作用域链

```js
function compare(v1, v2){
    if (v1 > v2){
        return -1;
    } else if (v1 < v2){
        return 1;
    }
    return 0;
}

var result = compare(2, 3)
```

对于像上面这样在全局环境中调用的 compare 函数，其执行环境与作用域如下图所示: 

![JavaScript](/images/JavaScript/var_scope.jpg)

compare 函数的本地变量对象被创建，并被推入执行环境作用域链的前端。显然，作用域链本质上是一个指向变量对象的指针列表，它只引用但不实际包含变量对象。

显然每个执行的函数都有自己的执行环境，每个执行环境都关联着自己的作用于连，标识符解析沿着作用域链进行，作用域链的前端始终是当前执行的代码所在环境的变量对象。

使用 var 声明的变量会自动被添加到最接近的环境中，函数内这个最接近的环境就是函数的局部环境，如果没有使用 var 声明，则自动被添加到全局环境。

### 5.3 作用域粒度
JavaScript 执行环境只有全局和局部(函数)两种，因此 JS 中没有块级作用域。有些语句可以延长作用域链，因为这些语句可以在**作用域链的前端**临时增加一个变量对象，该变量对象会在代码执行后移除，这些语句包括: 
- **with**: 将指定的对象添加到作用域链的前端，with 对象中的属性会覆盖作用域链中的同名对象 
- try-catch 语句的 **catch** 块: 创建一个新的变量对象添加到作用域的前端，其中包含的是被抛出的错误对象的声明

```js
function buildUrl(){
	var qs= "?debug=true";
	with(location){
		var url = href + qs; // href 引用的是 location.href
	}
	return url;
}
```

ES6 通过 let 关键词引入了块级作用域，我们在后面在详述。

### 5.4 闭包
一般来讲，当函数执行完毕后，函数执行环境中的变量对象会随着执行环境的销毁而销毁。但是闭包(函数内定义的函数):
1. 内部函数会将外部函数的变量对象添加到自己的作用域链中，这样内部函数就能访问外部函数中定义的变量
2. 由于外部函数的变量对象存在引用，也不会随着外部函数执行环境销毁而销毁，直至内部函数执行环境被销毁

```js

function createCompareFunc(propertyName){
    return function(obj1, obj2){
        var v1 = obj1[propertyName];
        var v1 = obj1[propertyName];

        if (v1 > v2){
        return -1;
    } else if (v1 < v2){
        return 1;
    }
    return 0;
    }
};
var compare = createCompareFunc("age");
var result = compare({"age": 10}, {"age": 20});
```

对于上面的闭包函数，在匿名函数从 createCompareFunc()中被返回后，它的作用域链被初始化为包含 createCompareFunc() 函数的活动对象和全局变量对象。这样，匿名函数就可以访问在createComparisonFunction()中定义的所有变量。compare 函数的作用域链如下图所示:

![JavaScript](/images/JavaScript/closure.jpg)

### 5.5 闭包的 this 对象
前面我们提到过，函数内部的 this 对象是在运行时基于函数的执行环境绑定的：在全局函数中，this等于window，而当函数被作为某个对象的方法调用时，this等于那个对象。不过，**匿名函数的执行环境具有全局性**，因此其this对象通常指向window。怎么理解这句话呢，我们来看下面这个例子:

```js
var name = "window";

var obj = {
    name: "object",

    getName: function(){
        return this.name;
    },

    getFunc: function(){
        return function(){
            return this.name;
        };
    },

    getFuncObj: function(){
        var that = this;
        return function(){
            return that.name;
        };
    }
    
}

object.getName(); // object
(object.getName)() // object
(object.getName = object.getName)(); // window
object.getFunc()(); // window
object.getFuncObj()(); // Object
```

第三行代码先执行了一条赋值语句，然后再调用赋值后的结果。因为这个赋值表达式的值是函数本身，所以this的值不能得到维持，结果就返回了"The Window"。

类比 Python 就是 JavaScript 对于对象方法不会执行对象绑定，所以才会出现 this 值丢失的情况。因此我们说匿名函数的执行环境具有全局性。

## 6. 模拟块级作用域
由于 ES5 没有块级作用域，所以经常能看到那种立即定义执行的函数，ES6 通过 let 关键字引入了块级作用域，因此这里我们就不再介绍这部分知识了(过期了)。一个立即定义执行的函数就像下面这样:

```js
(function(){
    // 块级作用域
})();
```

注意最外层的括号不可省略，因为函数声明后不能跟`()`，因此需要将函数声明转换成函数表达式。这种技术经常在全局作用域中被用在函数外部，从而限制向全局作用域中添加过多的变量和函数。
