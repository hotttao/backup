---
title: 2 JavaScript 的面向对象
date: 2020-10-01
categories:
    - 前端
tags:
	- 设计模式
---

动态语言和静态语言由于在类型上根深蒂固的差异，导致了它们在实现设计模式上也有着非常大的不同。

<!-- more -->

## 1. 类型与面向对象
面向对象有四大特性: 封装、抽象、继承、多态，这四大特性是与语言无关的，但是不同语言实现的方式会有或大或小的差异，而类型就是其中重要的影响因素。


在动态类型语言中:
1. 没有强制的类型检查: 在编译时没有类型检查的过程，既没有检查创建的对象类型，又没有检查传递的参数类型
2. 实现面向接口编程，主要通过鸭子类型
3. 不存在任何程度上的“类型耦合“

在静态类型语言中:
1. 由于强制的类型检查，需要通过抽象类或者接口将对象进行向上转型
2. 当对象的真正类型被隐藏在它的超类型身后，这些对象才能在类型检查系统的“监视”之下互相被替换使用
3. 多态的思想实际上是把“做什么”和“谁去做”分离开来，要实现这一点，归根结底先要消除类型之间的耦合关系，这在静态语言中是必须的

## 2. JavaScript 基于原型的面向对象
JavaScript 基于原型的面向对象与传统的面向对象有很大的不同:
1. 对象创建上:
    - 在以类为中心的面向对象编程语言中，对象总是从类中创建而来
    - 而在原型编程的思想中，类并不是必需的，一个对象是通过克隆另外一个对象所得到的
    - 原型模式的实现关键，是语言本身是否提供了clone方法
2. 实现继承上: 
    - 在原型编程的思想中，基于原型链的委托机制就是原型继承的本质
    - 如果对象无法响应某个请求，它会把这个请求委托给它自己的原型

### 2.1 JavaScript中的原型
作为一门基于原型的语言，JavaScript 遵守如下原型编程的基本规则:
1. 所有的数据都是对象
2. 要得到一个对象，不是通过实例化类，而是找到一个对象作为原型并克隆它
3. 对象会记住它的原型
4. 如果对象无法响应某个请求，它会把这个请求委托给它自己的原型

在 JavaScript中
1. 根对象是Object.prototype对象，在JavaScript遇到的每个对象，实际上都是从Object.prototype对象克隆而来的，Object.prototype对象就是它们的原型。
2. 用new运算符来创建对象的过程，实际上也只是先克隆Object.prototype对象，再进行一些其他额外操作的过程
3. 就JavaScript的真正实现来说，其实并不能说对象有原型，而只能说对象的构造器有原型。
4. 对象把请求委托给它自己的原型”这句话，更好的说法是对象把请求委托给它的构造器的原型
5. JavaScript给对象提供了一个名为__proto__的隐藏属性，某个对象的__proto__属性默认会指向它的构造器的原型对象

## 3. JavaScript 中 this 指向
跟别的语言大相径庭的是，JavaScript的this总是指向一个对象，而具体指向哪个对象是在运行时基于函数的执行环境动态绑定的，而非函数被声明时的环境。除去不常用的with和eval的情况，具体到实际应用中，this的指向大致可以分为以下4种。
1. 作为对象的方法调用: this 指向调用的对象
2. 作为普通函数调用: 
    - 指向全局对象
    - strict模式下，这种情况下的this已经被规定为不会指向全局对象，而是undefined
3. 构造器调用: 
    - 构造器在内部会通过 clone 创建一个新的对象，this 就执行这个创建的对象
    - 通常构造函数将返回这个 this 指向的对象
    - 如果构造器显式地返回了一个object类型的对象，那么此次运算结果最终会返回这个对象，而不是 this
    - 如果构造器不显式地返回任何数据，或者是返回一个非对象类型的数据，默认就会返回 this
4. Function.prototype.call或Function.prototype.apply调用: 
    - 动态地改变传入函数的this
    - 如果我们传入的第一个参数为null，函数体内的this会指向默认的宿主对象，在浏览器中则是window，但如果是在严格模式下，函数体内的this还是为null

this 指向的典型应用有两个:
1. 自己实现一个 bind 方法
2. 使用 Array 的原型方法操作 arguments 类数组对象

```js
// 1. bind 方法
Function.prototype.bind = function(){
    let self = this;
    context = [].shift.call(arguments);
    args = [].slice.call(arguments);

    return function(){
        return self.apply(context, [].concat.call(args, [].slice.call(arguments)));
    }
}
```

之所以可以将 arguments 作为this 对象传入 Array 的方法中，是因为 Array 的众多方法操作数组的方式是使用数组的 length 属性，我们Array.prototype.push为例，看看V8引擎中的具体实现：

```js
function ArrayPush(){
    var n = TO_UNIT32(this.length); // 被 push 的对象的 length
    var m = %_ArgumentsLength(); // push 的参数个数

    for (let i = 0; i < m; i++){
        this[i + n] = %_ArgumentsLength(i); // 复制元素
    }
    this.length = n + m;
    return this.length;
}
```

所以只要对象满足"对象本身要可以存取属性；对象的length属性可读写"，都可以像 bind 方法中操作 arguments 一样借用数组的方法。

```js
var a = {};

Array.prototype.push.call(a, "first");

alter(a.length); // 输出 1
alter(a[0]); // first
```


## 4. JavaScript 闭包和高阶函数
### 4.1 闭包和面向对象
过程与数据的结合是形容面向对象中的“对象”时经常使用的表达。对象以方法的形式包含了过程，而闭包则是在过程中以环境的形式包含了数据。通常用面向对象思想能实现的功能，用闭包也能实现。

### 4.2 高阶函数和面向对象
高阶函数指的是函数可以作为参数被传递，也可以作为返回值被输出。
1. 把函数当作参数传递，这代表我们可以抽离出一部分容易变化的业务逻辑，把这部分业务逻辑放在函数参数中，这样一来可以分离业务代码中变化与不变的部分。最常见的应用就是回调函数
2. 让函数继续返回一个可执行的函数，意味着运算过程是可延续的，典型的应用包括:
    - 结合闭包实现单例，缓存等等
    - 实现AOP(面向切面编程)

#### 高阶函数实现 AOP
在JavaScript中实现AOP，都是指把一个函数“动态织入”到另外一个函数之中，具体的实现技术很多，典型的我们可以通过扩展Function.prototype来做到这一点。

```js
Function.prototype.before = function(beforefn){
    let _self = this;
    return function(){
        beforefn.apply(this, arguments);
        _self.apply(this, arguments);
    }
}


Function.prototype.after = function(afterfn){
    let _self = this;
    return function(){
        let result = _self.apply(this, arguments);
        afterfn.apply(this, arguments);
        return result
    }
}

var func = function(){
    console.log(2);
}

func = func.before(function(){
    console.log(1);
    }).after(function(){
        console.log(3);
    })

func()
```

这种使用AOP的方式来给函数添加职责，也是JavaScript语言中一种非常特别和巧妙的装饰者模式实现。

### 4.3 高阶函数的应用
#### 函数柯里化
函数柯里化（function currying），又称部分求值，其只在特定的条件下求值，其他时候调用只是将参数收集起来。接下来我们编写一个通用的function currying(){}, function currying(){}接受一个参数，即将要被currying的函数。

```js
function currying(fn){
    let args = [];
    return function(){
        if (arguments.length === 0){
            return fn.apply(this, args)            
        } else {
            [].push.apply(args, arguments)
            console.log(args)
            return arguments.callee
        }
    }
}

var cost = (function(){
    let money = 0;
    return function(){
        for (let i = 0, m= arguments.length;i<m;i++){
            money += arguments[i]
        }
        return money
    }
}())
```

#### uncurrying
```js
// 实现一
Function.prototype.uncurrying = function(){
    let self = this;
    return function(){
        obj = [].shift.apply(arguments)
        return self.apply(obj, arguments);

    }
}

// 实现二
Function.prototype.uncurrying = function(){
    let self = this;
    return function(){
        return Function.prototype.apply(self, arguments)
    }
}
// 应用
let push = Array.prototype.push.uncurrying()

(funciton(){
    push(arguments, 4);
    console.log(arguments);
})(1,2,3)

```

#### 函数节流
函数节流降低类似 window.onresize/mousemove 等由用户触发事件的调用频率。原理是将即将被执行的函数用setTimeout延迟一段时间执行。如果该次延迟执行还没有完成，则忽略接下来调用该函数的请求。

```js
function throttle(fn, interval){
    let __self = fn,
    timer,              // 定时器
    firstTime = true;  // 是否第一次调用

    return function(){
        var args = arguments;
        __me = this;

        // 第一次调用不用延时
        if (firstTime){
            __self.apply(__me, args);
            return firstTime = false;
        }

        // 如果定时器还在，说明之前的调用还未完成
        if (timer){
            return false;
        }

        // 延时一段时间执行
        timer = setTimeout(function(){
            clearTimeout(timer);
            console.log(timer, 10);
            timer = null; // 清除定时器 timer 不会被置为 null，需要手动置为 null
            __self.apply(__me, args);
        }, interval||500)
    }
}

window.onresize = throttle(function(){
    console.log(1);
})
```

#### 分时函数
分时函数用于将一个函数的执行分批进行，比如把1秒钟创建1000个节点，改为每隔200毫秒创建8个节点。以此来缓解短时大量操作导致的浏览器卡死。
```js
function timeChunk(ary, fn, count){
    let obj, t;
    let len = ary.length;

    let start = function(){
        for (let i=0; i<Math.min(count|| 1, ary.length); i++){
            obj = ary.shift()
            fn(obj)
        }
    }
    return function(){
        t = setInterval(function(){
            if (ary.length === 0){
                return clearTimeout(t);
            }
            start();
        }, 200)
    }
}

let ary = [];
for (let i = 1; i< 100;i++){
    ary.push(i)
}

let renderDiv = timeChunk(ary, function(n){
    let div = document.createElement("div");
    div.innerHTML = n;
    document.body.appendChild(div);
}, 8)

renderDiv()
```

#### 惰性加载函数
```js
function addEvent(elem, type, handler){
    // 1. addEvent 只有在执行时才会进行逻辑判断
    // 2. 第一次进入条件分支之后，在函数内部会重写这个函数，后续执行就无需再次判断 
    if (window.addEventListener){
        addEvent = function(elem, type, handler){
            elem.addEventListener(type, handler)
        }
    } else if (window.attachEvent){
        addEvent = function(elem, type, handler){
            elem.addEventListener('on' +type, handler)
        }
    }
    addEvent(elem, type, handler);
}
```