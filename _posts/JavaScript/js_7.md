---
title: 7 JavaScript 面向对象
date: 2020-08-10
categories:
    - 前端
tags:
	- JavaScript
---
JavaScript 中的面向对象编程。
<!-- more -->

本节我们我们要介绍的是 JavaScript 中如何实现面向对象编程。JavaScript 中对象的创建有多种方式，这是这门语言的灵活性导致。我们的最终目的是找到一种创建方式使得:
1. 使得同一类对象可以共享特定的属性和方法，通过共享可以减少对象占用的空间
2. 同一类的不同实例，可以定义私有属性和方法

这就是面向对象的核心，继承可以实现共享，也可以为实例定义私有属性和方法，JavaScript 使用原型来实现面向对象。不过在讲解如何实现面向对象前，我们需要先弄清楚 JavaScript 对象的属性。

## 1. 对象属性

ECMAScript 为属性定义了多个特征，这些特征表征了属性可以如何被操作，ECMAScript 规定有两种属性：数据属性和访问器属性。

### 1.1 数据属性
数据属性有4个描述其行为的特性。
1. `[[Configurable]]`：
    - 表示能否通过delete删除属性从而重新定义属性
    - 能否修改属性的特性
    - 或者能否把属性修改为访问器属性
    - 这个特性默认值为true
2. `[[Enumerable]]`：
    - 表示能否通过for-in循环返回属性
    - 这个特性默认值为true
3. `[[Writable]]`：
    - 表示能否修改属性的值
    - 这个特性默认值为true
4. `[[Value]]`：
    - 包含这个属性的数据值
    - 读取属性值的时候，从这个位置读
    - 写入属性值的时候，把新值保存在这个位置
    - 这个特性的默认值为undefined

像下面这样，直接在对象上定义的属性，他们的`[[Configurable]]`、`[[Enumerable]]`和`[[Writable]]`特性都被设置为true，而`[[Value]]`特性被设置为指定的值

```js
var person = {
    name: "abc" // [[Value]]特性将被设置为"abc"
}
```

#### 特性修改
要修改属性默认的特性，必须使用ECMAScript 5的Object.defineProperty()方法:

`Object.defineProperty(obj, property, descriptor)`:
- obj: 属性所在对象
- property: 属性名
- descriptor: 描述符对象，对象的属性必须是：configurable、enumerable、writable和value
- 在调用Object.defineProperty()方法时，如果不指定，configurable、enumerable和writable特性的默认值都是false

```js
var person = {}
object.defineProperty(person, "name", {
    writable: false,
    value: "abc"
})
```

### 1.2 访问器属性
访问器属性不包含数据值；它们包含一对儿getter和setter函数(都不是必须的):
1. 在读取访问器属性时，会调用getter函数，这个函数负责返回有效的值
2. 在写入访问器属性时，会调用setter函数并传入新值，这个函数负责决定如何处理数据

访问器属性有如下4个特性:
1. `[[Configurable]]`：
    - 表示能否通过delete删除属性从而重新定义属性
    - 能否修改属性的特性
    - 或者能否把属性修改为数据属性
    - 这个特性默认值为true
2. `[[Enumerable]]`：
    - 表示能否通过for-in循环返回属性
    - 这个特性默认值为true
3. `[[Get]]`：
    - 在读取属性时调用的函数。默认值为undefined
    - 只指定getter意味着属性是不能写
4. `[[Set]]`：
    - 在写入属性时调用的函数。默认值为undefined
    - 只指定setter函数的属性也不能读

访问器属性不能直接定义，必须使用Object.defineProperty()来定义:

```js
var book = {
    _year: 2014,
    edition: 1
};
Object.defineProperty(book, "year",{
    get: function(){
        return this._year;
    },
    set: function(year){
        if (year > 2014){
            this._year = year;
            this.edition = year - this._year;
        }
    }
});
```

## 1.3 属性特性修改
除了 Object.defineProperty 外，还有以下方法支持属性特性的修改和读取:
1. Object.definedProperties: 一次增加多个属性
2. Object.getOwnerPropertyDescriptor: 
    - 获取给定属性的描述符
    - 可以针对任何对象——包括DOM和BOM对象，使用Object.getOwnProperty-Descriptor()方法

```js
var book = {};
Object.defineProperties(book, {
    _year: {
        value: 24
    },

    year: {
        get: function(){
            return this._year;
        },
        set: function(year){
            if (year > 2014){
                this._year = year;
                this.edition = year - this._year;
            }
        }
    }
});

var desc = Object.getOwnerPropertyDescriptor(book, "_year");
alter(desc.value)

```

## 2. 对象创建
### 2.1 工厂模式
前面在介绍 Object 时，我们说到创建对象可以使用 Object 构造函数和对象字面量。但这有个明显的缺点：使用同一个接口创建很多对象，会产生大量的重复代码。为解决这个问题，人们开始使用工厂模式的一种变体。即使用函数封装对象的创建过程。

```js
function createPerson(){
    var o = new Object();
    o.name = "abc";
    return o;
}
```

工厂模式虽然解决了创建多个相似对象的问题，但却没有解决对象识别的问题（即怎样知道一个对象的类型）。

### 2.2 构造函数
ECMAScript中的构造函数可用来创建特定类型的对象。像Object和Array这样的原生构造函数，在运行时会自动出现在执行环境中，是语言内置的。我们也可以自定义构造函数:

```js
function Person(name){
    this.name = name;
    this.sayName = function(){
        alter(this.name)  
    };
}
var p1 = new Person("1");
var p2 = new Person("2");
var p3 = new Person(); // 等价于 p3 = new Person
```

在构造函数 Person 内:
1. 没有显式地创建对象；
2. 直接将属性和方法赋给了this对象；
3. 没有return语句

要创建Person的新实例，必须使用new操作符。以这种方式调用构造函数实际上会经历以下4个步骤：
1. 创建一个新对象；
2. 将构造函数的作用域赋给新对象（因此this就指向了这个新对象）；
3. 执行构造函数中的代码（为这个新对象添加属性）；
4. 返回新对象
5. 返回的对象都有一个constructor（构造函数）属性，该属性指向构造函数

创建自定义的构造函数意味着将来可以将它的实例标识为一种特定的类型，这正是构造函数模式胜过工厂模式的地方。为什么我们接下来将原型的时候会详细说明。

#### 函数的返回值
函数的返回值依其调用方式，有不同返回值
1. 如果函数只作为普通函数执行(不加 new)，return 即是其返回值，没有 return 语句时默认返回 undefined
2. 如果函数作为构造函数执行:
    - 没有返回值或者返回值不是一个对象，则返回函数内部创建的 this 对象
    - 如果返回值是一个对象，则返回该对象

#### 构造函数与函数
需要强调的是构造函数本身也是函数，类似于 Python 中的初始化函数 `__init__`，而对象的创建是通过 `new` 关键字。任何函数，只要通过new操作符来调用，那它就可以作为构造函数；而任何函数，如果不通过new操作符来调用，那它跟普通函数也不会有什么两样。

#### 构造函数的问题
使用构造函数的主要问题，就是每个方法都要在每个实例上重新创建一遍。即无法实现共享，同一构造函数返回的不同对象上的同名函数是不相等的。

## 2.3 原型模式
我们创建的每个函数都有一个prototype（原型）属性，这个属性是一个指针，指向一个对象，而这个对象的用途是包含可以由特定类型的所有实例共享的属性和方法。如果按照字面意思来理解，那么prototype就是通过调用构造函数而创建的那个对象实例的原型对象。原型模式创建对象的方式如下:

```js
function Person(){}

Person.prototype.name = "abc";
Person.prototype.sayName = function(){
        alter(this.name)  
    };

var p1 = new Person();
```

#### 构造函数，原型与对象
构造函数，原型与对象之间的关系是这样的:
1. 只要创建了一个新函数，就会根据一组特定的规则为该函数创建一个prototype属性，这个属性指向函数的原型对象
2. 所有原型对象都会自动获得一个constructor（构造函数）属性，这个属性是一个指向 prototype 属性所在函数的指针
3. 构造函数创建的实例的内部将包含一个指针（内部属性`[[Prototype]]`），指向构造函数的原型对象

每当代码读取某个对象的某个属性时，都会执行一次搜索，搜索的顺序按照: 对象实例本身->实例的原型->实例原型的原型直至 Object对象，以此构成了一条**原型链**。而这正是多个对象实例共享原型所保存的属性和方法的基本原理。

以前面使用Person构造函数和Person.prototype创建实例的代码为例，各个对象之间的关系如下图所示。

![JavaScript](/images/JavaScript/prototype.jpg)


```js
Person.prototype.isPrototype(p1) // 判断实例的[[Prototype]] 是否指向该原型
Object.getPrototypeOf(p1) == Person.prototype // 获取实例的原型
p1.hasOwnPrototype("name") // 如果给定属性存在于对象实例中时返回 true

Object.keys(p1.prototype)
Object.keys(p1) // 取得对象上所有可枚举的实例属性，注意实例是相对而言的
Object.getOwnPropertyNames(p1) // 获取所有实例属性，无论是否可枚举
```

注: ECMAScript 5的Object.getOwnPropertyDescriptor()方法只能用于实例属性，要取得原型属性的描述符，必须直接在原型对象上调用Object.getOwnPropertyDescriptor()方法。

#### 原型模式的简化
更常见的做法是用一个包含所有属性和方法的对象字面量来重写整个原型对象，

```js
function Person();

Person.prototype = {
    // constructor: Person, 
    name: "12"
}
```

这么写法有个例外，constructor属性不再指向Person了。每创建一个函数，就会同时创建它的prototype对象，这个对象也会自动获得constructor属性。而这里重写了默认的 prototype 对象，因此 constructor 属性也就变成了新对象的constructor属性（指向Object构造函数），不再指向Person函数。

可以像注释一样，重设 constructor 属性，那么此时 constructor 的`[[Enumerable]]` 特性被设置为true。所以完备的写法应该像下面这样:

```js
function Person(){};

Person.prototype = {
    // constructor: Person, 
    name: "12"
}

Object.definePrototype(Person.prototype, "constructor", {
    enumerable: false,
    value: Person
})
```

#### 原型模式的缺点
在原型模式下我们无法为实例自定义属性，因为构造函数是空的。

### 2.4 组合构造函数和原型
构造函数模式用于定义实例属性，而原型模式用于定义方法和共享的属性。这应该是目前的标准实现方式。

```js
function Person(age){
    this.age = age;
};

Person.prototype = {
    // constructor: Person, 
    name: "12"
}

Object.definePrototype(Person.prototype, "constructor", {
    enumerable: false,
    value: Person
})
```

当然我们可以把原型的赋值也放到构造函数中:

```js
function Person(age){
    this.age = age;

    if (typeof this.name != "string"){
        Person.prototype = {
            // constructor: Person, 
            name: "12"
        }

        Object.definePrototype(Person.prototype, "constructor", {
            enumerable: false,
            value: Person
        });
    };
};
```

### 2.5 寄生函数模式
没看懂这种创建模式存在的必要。下面是这种模式的一个示例:

```js
function SpecialArray(){
    var arr = new Array();
    arr.push(arguments);
    arr.toShow = function(){
        alter(this.join("|"))
    };
    return arr;
}

var colors = new SpecialArray("red");
colors.toShow();
```

除了使用new操作符并把使用的包装函数叫做构造函数之外，这个模式跟工厂模式其实是一模一样的。。构造函数在不返回值的情况下，默认会返回新对象实例。而通过在构造函数的末尾添加一个return语句，可以重写调用构造函数时返回的值。

返回的对象与构造函数或者与构造函数的原型属性之间没有关系；也就是说，构造函数返回的对象与在构造函数外部创建的对象没有什么不同。所以为什么不直接用工厂模式？

### 2.6 稳妥构造函数模式
所谓稳妥对象，指的是没有公共属性，而且其方法也不引用this的对象。这种构造函数，实际上是一种函数闭包的应用。

```js
function Person(age){
    var o = Object();
    o.sayAge = function(){ // 方法通过闭包而不是 this 引用 age 的值
        alter(age);
    };
    return o
};

var p1 = Person(15); // 不适用 new
p1.sayAge();
```

## 3. 原型链与继承
所谓原型链就是，对象实例本身->实例的原型->实例原型的原型直至 Object对象构成的链条。而继承就是原型链上的搜索顺序。

```js
function Super(){
    this.A = true;
}

Super.prototype.getA = function(){
    return this.A;
};

function Sub(){
    this.B = false;
}

Sub.prototype = new Super();

// 新方法必须在原型替换之后定义
Sub.prototype.getB = function(){
    return this.B;
}

var t = new Sub();
alter(t.getA());
```

可以看到实现继承的本质是重写了原型对象。最终结果就是这样的：t 指向Sub的原型(即 Super的实例)，Sub的原型又指向Super的原型。

![JavaScript](/images/JavaScript/subtype.jpg)

我们知道，所有引用类型默认都继承了 Object，而这个继承也是通过原型链实现的。所有函数的默认原型都是Object的实例，因此默认原型都会包含一个内部指针，指向Object.prototype。这也正是所有自定义类型都会继承toString()、valueOf()等默认方法的根本原因。

### 3.1 原型与类型判断

可以通过两种方式来确定原型和实例之间的关系
1. 第一种方式是使用instanceof操作符，只要用这个操作符来测试实例与原型链中出现过的构造函数，结果就会返回true
2. 第二种方式是使用isPrototypeOf()方法。同样，只要是原型链中出现过的原型，都可以说是该原型链所派生的实例的原型

```js
alter(t instanceof Super);
alter(Super.prototype.isPrototype(t))
```

### 3.2 原型链的问题
上面使用原型链的主要问题是在创建子类型的实例时，不能向超类型的构造函数中传递参数。实际上，应该说是没有办法在不影响所有对象实例的情况下，给超类型的构造函数传递参数。

所以我们需要更好的方式去利用原型实现继承。

## 4. 继承的实现
### 4.1 组合继承
组合继承组合了构造函数和原型链:
1. 构造函数的技巧是在子类型构造函数的内部调用超类型构造函数，这样可以实现为子类对象定义独立的属性和方法
2. 通过在原型上定义方法实现了函数复用，又能够保证每个实例都有它自己的属性
3. 最终使用原型链实现了对原型属性和方法的继承，而通过借用构造函数来实现对实例属性的继承

这是目前最常用的继承模式。说的比较抽象，我们来看下面这个示例

```js
function Super(name){
    this.A = true;
    this.name = name;
}

Super.prototype.getA = function(){
    return this.A;
};

function Sub(name, age){
    // 
    Super.call(this, name)   // 二次调用
    this.age = age
}

Sub.prototype = new Super();  // 一次调用
Sub.prototype.constructor = Sub;
// 新方法必须在原型替换之后定义
Sub.prototype.getB = function(){
    return this.B;
}
```

组合继承最大的问题就是无论什么情况下，都会调用两次超类型构造函数。一次是在创建子类型原型的时候，另一次是在子类型构造函数内部。像上面这样， name 属性也会创建两次，一次在 Sub 的原型上，一次是Sub 对象上。整个原型链与继承关系就变成下图这个样子:

![JavaScript](/images/JavaScript/inherit.jpg)

### 4.3 原型式继承
原型式继承的核心思想是借助原型可以基于已有的对象创建新对象，同时还不必因此创建自定义类型。能这么做的前提是必须有一个对象可以作为另一个对象的基础。下面是这种实现的示例:

```js
// object()对传入其中的对象执行了一次浅复制
function object(o){
    function F(){}
    F.prototype = o;
    return new F(); 
}
```

ECMAScript 5通过新增Object.create()方法规范化了原型式继承。这个方法接收两个参数：
1. 一个用作新对象原型的对象
2. （可选的）一个为新对象定义额外属性的对象，与Object.defineProperties()方法的第二个参数格式相同：每个属性都是通过自己的描述符定义的

在传入一个参数的情况下，Object.create()与object()方法的行为相同。

```js
var person = {
    name: "abc",
    friends: ["a", "b"] // 浅复制，引用类型值的属性始终都会共享相应的值
};

var pp = Object.create(person, {
    name: {
        value: "tt"
    }
});
```

### 4.4 寄生组合式继承
所谓寄生组合式继承，即通过借用构造函数来继承属性，通过原型链的混成形式来继承方法。其背后的基本思路是：不必为了指定子类型的原型而调用超类型的构造函数，我们所需要的无非就是超类型原型的一个副本而已。

```js
function inheritPrototype(sub, super){
    // 第一步是创建超类型原型的一个副本。
    var prototype = Object(super.prototype);
    prototype.constructor = sub;
    sub.prototype = prototype;
}


function Super(name){
    this.color = [];
    this.name = name;
}

function Sub(name, age){
    // 
    Super.call(this, name)   // 二次调用
    this.age = age
}
inheritPrototype(Sub, Super);
```

开发人员普遍认为寄生组合式继承是引用类型最理想的继承范式。