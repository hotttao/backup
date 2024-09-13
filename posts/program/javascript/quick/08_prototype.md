---
weight: 1
title: "基于原型的继承"
date: 2024-09-01T10:11:12+08:00
lastmod: 2024-09-01T10:11:12+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "基于原型的继承"
featuredImage: 

tags: ["javascript 语法"]
categories: ["javascript"]

lightgallery: true

toc:
  auto: false
---

## 1. 问: ES6 中 class 原型、对象之间的关系

在 JavaScript 中，构造函数（constructor function）是用来创建对象的函数。每一个构造函数都会自动拥有一个名为 `prototype` 的属性，这个属性指向一个对象（称为“原型对象”），这个对象包含了通过该构造函数创建的所有实例对象共享的属性和方法。

### 详细解释

1. **构造函数的 `prototype` 属性**:
   - 当你定义一个构造函数时，例如：
     ```javascript
     function Animal(name) {
       this.name = name;
     }
     ```
     JavaScript 会自动为这个 `Animal` 构造函数创建一个 `prototype` 对象。
   
   - 这个 `prototype` 对象是所有通过 `new Animal()` 创建的实例的共享对象。换句话说，所有 `Animal` 的实例都会从这个 `prototype` 对象继承属性和方法。

2. **`prototype` 对象的作用**:
   - 如果你在 `prototype` 对象上添加方法或属性，这些方法和属性将会被所有实例共享。例如：
     ```javascript
     Animal.prototype.speak = function() {
       console.log(`${this.name} makes a sound.`);
     };
     ```

   - 现在，当你创建一个 `Animal` 实例时：
     ```javascript
     const dog = new Animal('Dog');
     dog.speak(); // "Dog makes a sound."
     ```

   - `dog` 对象会通过它的内部原型链（`__proto__`）查找 `speak` 方法，并且发现这个方法存在于 `Animal.prototype` 上，从而调用它。

3. **原型继承**:
   - 当一个对象访问某个属性或方法时，JavaScript 引擎会首先检查该对象自身是否有这个属性或方法。如果没有，它会继续沿着原型链（从该对象的 `__proto__`，即其构造函数的 `prototype`）查找，直到找到属性或方法为止，或者达到原型链的顶端（通常是 `Object.prototype`），此时查找失败。

4. **构造函数的 `prototype` 与实例的 `__proto__`**:
   - 构造函数的 `prototype` 属性是一个对象，所有该构造函数创建的实例对象的 `__proto__` 属性都会指向这个 `prototype` 对象。
   - 例如：
     ```javascript
     console.log(dog.__proto__ === Animal.prototype); // true
     ```
     这说明 `dog` 实例的 `__proto__` 属性（内部原型）指向 `Animal` 的 `prototype` 对象。

小结: 
- **构造函数的 `prototype` 属性** 是一个对象，包含了通过这个构造函数创建的所有实例共享的方法和属性。
- **实例对象的 `__proto__`** 指向其构造函数的 `prototype` 对象，这形成了原型链，支持了 JavaScript 的原型继承模型。


## 问2: constructor 是什么语法的语法糖
在 JavaScript 中，`constructor` 是 ES6 中 `class` 语法的一部分，用于在类中定义一个构造函数。`constructor` 本质上是为类提供构造函数的语法糖，实际上它封装了 JavaScript 中已有的基于原型的构造函数模式。

### 2.1 **构造函数与 `constructor` 的关系**

在 ES6 之前，JavaScript 使用的是基于原型的构造函数模式来创建对象和实现继承。这个构造函数是一个普通的函数，用于初始化对象，并且通过原型链（`prototype`）实现方法的继承。

**ES5 构造函数模式**:
```javascript
function Animal(name) {
  this.name = name;
}

Animal.prototype.speak = function() {
  console.log(`${this.name} makes a sound.`);
};

const dog = new Animal('Dog');
dog.speak(); // "Dog makes a sound."
```

在这个例子中，`Animal` 是一个构造函数，通过 `new` 关键字调用时，会创建一个新对象并绑定到 `this` 上，同时将这个对象的 `__proto__` 属性指向 `Animal.prototype`。

**ES6 `class` 语法糖**:
```javascript
class Animal {
  constructor(name) {
    this.name = name;
  }

  speak() {
    console.log(`${this.name} makes a sound.`);
  }
}

const dog = new Animal('Dog');
dog.speak(); // "Dog makes a sound."
```

在 ES6 中，`class` 提供了一个更简洁的方式来定义类和构造函数。在 `class` 语法中，`constructor` 是用来定义构造函数的特殊方法。这个 `constructor` 方法的作用与 ES5 中构造函数模式的作用是一样的：初始化对象，并设置其属性。

### 2.2 **`constructor` 是什么的语法糖**

- **语法糖**:
  - `constructor` 是 ES6 `class` 的语法糖，它实际上是对 ES5 及之前 JavaScript 构造函数模式的一种封装和简化。
  - `class` 关键字和 `constructor` 方法让开发者以一种更接近传统面向对象编程的方式来定义类和对象，但底层仍然是基于 JavaScript 的原型继承模型在工作。

小结:
- **`constructor` 是一个特殊的方法**，用于 ES6 `class` 中初始化对象实例，实际是对传统构造函数的封装和语法糖。
- **底层机制不变**，`class` 语法只是提供了一个更易于理解和使用的接口，但 JavaScript 的原型继承模型依然是其基础。

## 问3: 请详细解释一下，基于原型的面向对象

基于原型的面向对象编程（Prototype-based OOP）是一种不依赖于类的对象构造和继承方式。它不同于基于类的面向对象编程，不需要先定义一个类来创建对象，而是直接通过现有的对象创建新的对象。JavaScript 是基于原型的 OOP 的典型例子。

### 3.1 核心概念

1. **对象是中心**:
   - 在基于原型的 OOP 中，对象是最基本的构造块。一切皆为对象，甚至是函数也是对象。没有类的概念，新对象是从现有对象克隆而来的。

2. **原型对象 (`prototype`)**:
   - 每一个对象都有一个链接到另一个对象的隐藏属性，这个对象称为该对象的“原型”（`prototype`）。一个对象可以从它的原型继承属性和方法。通过这种方式，实现了对象之间的继承。
   - JavaScript 中可以使用 `Object.getPrototypeOf(obj)` 来获取对象 `obj` 的原型。

3. **原型链**:
   - 当访问对象的属性或方法时，JavaScript 引擎会首先查找该对象自身的属性。如果找不到，便会沿着原型链向上查找，直到找到为止，或者到达原型链的末端（通常是 `null`）。
   - 这种沿原型链查找属性的机制被称为“原型链继承”。

### 3.2 基于原型的对象创建

在基于原型的 OOP 中，对象通常通过以下方式创建：

1. **对象字面量**:
   - 这是创建对象的最常见方式。
   - 例子：
     ```javascript
     const animal = {
       name: 'Animal',
       speak() {
         console.log(`${this.name} makes a sound.`);
       }
     };
     ```

2. **`Object.create()`**:
   - 使用 `Object.create()` 方法可以从一个现有对象创建一个新的对象，新的对象的原型会被设置为这个现有对象。
   - 例子：
     ```javascript
     const dog = Object.create(animal);
     dog.name = 'Dog';
     dog.speak(); // "Dog makes a sound."
     ```
   - 在这个例子中，`dog` 对象继承了 `animal` 对象的 `speak` 方法。

3. **构造函数模式（与原型结合）**:
   - 虽然 JavaScript 是基于原型的，但也可以通过构造函数来创建对象。构造函数本质上是一个普通的函数，但通常用作初始化对象的“模板”。
   - 例子：
     ```javascript
     function Animal(name) {
       this.name = name;
     }

     Animal.prototype.speak = function() {
       console.log(`${this.name} makes a sound.`);
     };

     const dog = new Animal('Dog');
     dog.speak(); // "Dog makes a sound."
     ```
   - 这里，`Animal` 作为构造函数，用 `new` 关键字创建对象，并将 `speak` 方法添加到 `Animal.prototype` 上，这样所有 `Animal` 的实例都可以共享该方法。

### 3.3 原型继承

在基于原型的 OOP 中，继承是通过对象直接从其他对象继承属性和方法来实现的，而不是通过类的继承。

1. **直接原型继承**:
   - 一个对象可以直接从另一个对象继承，继承的对象成为原型，新的对象从它的原型继承所有属性和方法。
   - 例子：
     ```javascript
     const cat = Object.create(animal);
     cat.name = 'Cat';
     cat.speak(); // "Cat makes a sound."
     ```

2. **原型链**:
   - 多个对象可以通过原型链串联起来，实现更复杂的继承结构。
   - 例子：
     ```javascript
     const mammal = {
       hasFur: true
     };

     const rabbit = Object.create(mammal);
     rabbit.canHop = true;

     console.log(rabbit.hasFur); // true
     console.log(rabbit.canHop); // true
     ```
   - 在这个例子中，`rabbit` 对象通过原型链继承了 `mammal` 对象的 `hasFur` 属性。

### 3.4 动态继承和扩展

基于原型的 OOP 允许对象在创建后动态地添加、修改或删除属性和方法，这使得它非常灵活：

1. **动态添加属性和方法**:
   - 你可以在对象创建之后，随时为它添加新的属性或方法。
   - 例子：
     ```javascript
     rabbit.speak = function() {
       console.log("Rabbit squeaks.");
     };
     rabbit.speak(); // "Rabbit squeaks."
     ```

2. **方法重写**:
   - 对象可以重写它继承自原型链上某个对象的方法。
   - 例子：
     ```javascript
     cat.speak = function() {
       console.log(`${this.name} meows.`);
     };
     cat.speak(); // "Cat meows."
     ```

3. **动态原型继承**:
   - 对象可以在运行时改变它的原型，实现继承的动态调整。
   - 例子：
     ```javascript
     Object.setPrototypeOf(cat, rabbit);
     console.log(cat.canHop); // true
     ```

### 3.5 与基于类的 OOP 的区别

1. **类与对象**:
   - 基于类的 OOP 使用类作为模板创建对象，而基于原型的 OOP 直接使用现有对象作为模板来创建新对象。

2. **静态与动态**:
   - 在基于类的 OOP 中，类结构在定义后通常是固定的，而在基于原型的 OOP 中，对象的结构是动态的，可以随时修改。

3. **继承机制**:
   - 基于类的 OOP 通过类继承实现方法和属性的共享，而基于原型的 OOP 通过原型链来实现继承。
