---
weight: 1
title: "函数"
date: 2024-09-01T10:11:12+08:00
lastmod: 2024-09-01T10:11:12+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "函数"
featuredImage: 

tags: ["javascript 语法"]
categories: ["javascript"]

lightgallery: true

toc:
  auto: false
---


## 函数
以列表为展示方式，从以下方面对比 JavaScript ES6 和 Python，请尽可能详细
函数:
1. 定义和声明
2. 传参方式
3. 匿名函数
4. 返回多个值
5. 异常处理

以下是 JavaScript ES6 和 Python 在函数方面的详细对比，涵盖了函数的定义和声明、传参方式、匿名函数、返回多个值、以及异常处理：

### 1. 定义和声明

**JavaScript ES6:**
- **函数声明**:
  - 使用 `function` 关键字声明函数。
  - 可以声明有名函数，也可以将函数表达式赋值给变量。
  - 函数声明会在代码执行前被提升（hoisting）。
  ```javascript
  function add(a, b) {
    return a + b;
  }

  let multiply = function(a, b) {
    return a * b;
  };
  ```

- **箭头函数**:
  - 使用 `=>` 箭头符号定义简洁的匿名函数。
  - 箭头函数不会绑定自己的 `this` 值，而是从外围作用域继承 `this`。
  ```javascript
  const subtract = (a, b) => a - b;
  ```

**Python:**
- **函数声明**:
  - 使用 `def` 关键字声明函数。
  - 函数名称必须是合法的 Python 标识符，可以在声明时指定默认参数。
  ```python
  def add(a, b):
      return a + b
  ```

- **函数定义是第一类对象**:
  - Python 中的函数是第一类对象，可以赋值给变量、作为参数传递，或返回给调用者。
  ```python
  multiply = lambda a, b: a * b
  ```

### 2. 传参方式

**JavaScript ES6:**
- **默认参数**:
  - 可以在函数定义中为参数指定默认值。
  ```javascript
  function greet(name = "Guest") {
    console.log("Hello, " + name);
  }
  ```

- **参数传递**:
  - JavaScript 的函数参数按值传递（对于对象是按引用的副本传递）。
  ```javascript
  let obj = {key: "value"};
  function modify(obj) {
    obj.key = "newValue";
  }
  modify(obj);
  console.log(obj.key); // "newValue"
  ```

- **剩余参数**:
  - 使用 `...` 语法收集函数的可变数量参数到数组中。
  ```javascript
  function sum(...numbers) {
    return numbers.reduce((total, num) => total + num, 0);
  }
  ```

**Python:**
- **默认参数**:
  - 可以在函数定义中为参数指定默认值，默认参数在传参时可以被覆盖。
  ```python
  def greet(name="Guest"):
      print(f"Hello, {name}")
  ```

- **参数传递**:
  - Python 函数参数按值传递（对于可变对象是按引用传递）。
  ```python
  obj = {"key": "value"}
  def modify(obj):
      obj["key"] = "newValue"
  modify(obj)
  print(obj["key"])  # "newValue"
  ```

- **可变参数**:
  - 使用 `*args` 收集位置参数到元组中，使用 `**kwargs` 收集关键字参数到字典中。
  ```python
  def sum(*numbers):
      return sum(numbers)
  ```

### 3. 匿名函数

**JavaScript ES6:**
- **箭头函数**:
  - 通过箭头函数实现匿名函数，可以简化函数表达式的语法。
  ```javascript
  let double = (n) => n * 2;
  ```

- **函数表达式**:
  - 可以将匿名函数赋值给变量或作为参数传递给其他函数。
  ```javascript
  let result = [1, 2, 3].map(function(n) {
    return n * 2;
  });
  ```

### 4. 返回多个值

**JavaScript ES6:**
- **数组或对象**:
  - 可以通过返回数组或对象来返回多个值。
  ```javascript
  function divide(a, b) {
    return [Math.floor(a / b), a % b];
  }
  let [quotient, remainder] = divide(10, 3);
  ```

- **解构赋值**:
  - 解构赋值可以将返回的数组或对象分解为多个变量。
  ```javascript
  function getCoordinates() {
    return {x: 10, y: 20};
  }
  let {x, y} = getCoordinates();
  ```


### 5. 异常处理

**JavaScript ES6:**
- **`try...catch` 语句**:
  - 使用 `try...catch` 块来捕获和处理异常。可以使用 `finally` 块来执行无论是否抛出异常都会执行的代码。
  ```javascript
  try {
    let result = riskyOperation();
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    console.log("Cleanup code");
  }
  ```

- **自定义异常**:
  - 使用 `throw` 语句手动抛出异常，并可以抛出任意类型的对象或值。
  ```javascript
  function checkValue(value) {
    if (value < 0) {
      throw new Error("Value cannot be negative");
    }
  }
  ```


这个对比展示了 JavaScript ES6 和 Python 在函数相关功能上的差异，涵盖了从基础定义到高级异常处理的各个方面。