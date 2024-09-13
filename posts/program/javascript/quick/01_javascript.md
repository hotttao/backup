---
weight: 1
title: "变量、类型"
date: 2024-09-01T09:42:19+08:00
lastmod: 2024-09-01T09:42:19+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "变量、类型、流控"
featuredImage: 

tags: ["javascript 语法"]
categories: ["javascript"]

lightgallery: true

toc:
  auto: false
---


## 变量、类型

## 1. 变量
以列表为展示方式，从以下方面对比 JavaScript ES6 和 Python，请尽可能详细
1. 变量常量的声明、初始化；多变量的声明和初始化
2. 变量类型推导
4. 变量作用域

我们可以更深入地探讨 JavaScript ES6 和 Python 在变量声明、初始化、多变量声明、类型推导及作用域方面的差异，并包括 `var` 关键字的变量提升（Hoisting）机制：

### 1. 变量和常量的声明、初始化；多变量的声明和初始化
**JavaScript ES6:**
- **变量声明**:
  - `let`：用于声明变量，具有块级作用域，可以重新赋值。如果在同一作用域内重新声明相同的 `let` 变量会导致错误。
  - `const`：用于声明常量，具有块级作用域，声明时必须初始化，不能重新赋值。常量的对象属性或数组元素是可变的，但引用本身不可更改。
  - `var`：较旧的声明方式，具有函数作用域或全局作用域，可以重新赋值和重新声明。它与 `let` 和 `const` 不同，会受到变量提升的影响。
  
- **变量提升 (Hoisting)**:
  - 使用 `var` 声明的变量会被提升至其作用域的顶部，但不会被初始化为 `undefined`。这意味着在声明之前可以访问该变量，但其值为 `undefined`。
  ```javascript
  console.log(x); // undefined
  var x = 10;
  console.log(x); // 10
  ```
  - `let` 和 `const` 变量也会提升，但在声明之前无法访问它们，这被称为“暂时性死区” (Temporal Dead Zone, TDZ)。
  ```javascript
  console.log(y); // ReferenceError: Cannot access 'y' before initialization
  let y = 20;
  ```

- **初始化**: 
  - 变量在声明时可以初始化，如果没有初始化，`let` 和 `var` 变量会被初始化为 `undefined`，而 `const` 必须在声明时初始化。
  ```javascript
  let a;
  console.log(a); // undefined
  a = 5;
  ```

- **多变量声明和初始化**:
  - 可以在同一行使用逗号分隔声明和初始化多个变量。
  ```javascript
  let x = 1, y = 2, z = 3;
  const a = 10, b = 20;
  var p = 4, q = 5;
  ```

**Python:**
- **变量声明**:
  - Python 直接通过赋值操作声明变量，没有专门的关键词。变量的类型由其初始值推断。
  - Python 没有像 JavaScript 中的 `const` 或 `let` 这样的关键词，但惯例上通过使用大写字母来命名常量（虽然常量并非语言强制不可变）。
  ```python
  VARIABLE = 100  # 这是一个惯例上的常量
  ```

- **初始化**: 
  - 在声明变量的同时必须进行初始化，否则会抛出错误。
  ```python
  x = 10
  print(x)  # 10
  ```

- **多变量声明和初始化**:
  - Python 可以通过一次赋值为多个变量同时进行初始化。
  ```python
  a, b, c = 1, 2, 3
  ```
  - 也可以使用相同的值初始化多个变量。
  ```python
  x = y = z = 10
  ```

### 2. 变量类型推导
**JavaScript ES6:**
- **动态类型**: JavaScript 是动态类型语言，变量的类型由赋值决定，且变量的类型可以在运行时改变。
  ```javascript
  let x = 42;    // x 是 Number 类型
  x = "Hello";   // x 现在是 String 类型
  ```
- **类型检查**:
  - 使用 `typeof` 操作符可以检查变量的类型。
  ```javascript
  let y = 3.14;
  console.log(typeof y);  // "number"
  ```

**Python:**
- **动态类型**: Python 也是动态类型语言，变量的类型由其初始值决定，并可以在运行时改变。
  ```python
  x = 42    # x 是 int 类型
  x = "Hello"  # x 现在是 str 类型
  ```
- **类型检查**:
  - 可以使用 `type()` 函数来检查变量的类型。
  ```python
  y = 3.14
  print(type(y))  # <class 'float'>
  ```

### 3. 变量作用域
**JavaScript ES6:**
- **全局作用域**:
  - `var` 声明的变量如果在函数外，则属于全局作用域，所有代码都可以访问。
  ```javascript
  var globalVar = "I'm global";
  ```
- **函数作用域**:
  - `var` 声明的变量在函数内可用，函数外不可访问。
  ```javascript
  function example() {
    var localVar = "I'm local";
  }
  console.log(localVar);  // ReferenceError: localVar is not defined
  ```
- **块级作用域**:
  - `let` 和 `const` 变量有块级作用域，只在定义它们的块 `{}` 内有效。
  ```javascript
  if (true) {
    let blockVar = "I'm block scoped";
    const blockConst = "I'm a block scoped constant";
  }
  console.log(blockVar);  // ReferenceError: blockVar is not defined
  ```

**Python:**
- **全局作用域**:
  - 在函数或类外部定义的变量属于全局作用域，可以被整个模块访问。
  ```python
  global_var = "I'm global"
  ```
- **局部作用域**:
  - 在函数内部定义的变量属于局部作用域，只能在函数内访问。
  ```python
  def example():
      local_var = "I'm local"
  print(local_var)  # NameError: name 'local_var' is not defined
  ```
- **块级作用域**:
  - Python 没有块级作用域，变量在定义所在的块（如 if、for 内）外依然可以访问。
  ```python
  if True:
      block_var = "I'm not block scoped"
  print(block_var)  # "I'm not block scoped"
  ```

这些对比展示了 JavaScript ES6 和 Python 在变量声明、初始化、类型推导、作用域及 `var` 关键字的变量提升机制上的具体差异。JavaScript 中的 `var` 带来了较为复杂的作用域管理，而 Python 则更为简洁和直观。


## 2. 类型
以列表为展示方式，从以下方面对比 JavaScript ES6 和 Python，请尽可能详细
类型:
4. 类型转换，包括显示转换和隐式转换
5. 类型重命名
6. 自定义类型、枚举类型定义
8. 类型、子类型判断、接口实现判断

以下是 JavaScript ES6 和 Python 在类型转换、类型重命名、自定义类型、枚举类型定义、类型与子类型判断，以及接口实现判断方面的详细对比：

### 4. 类型转换（包括显式转换和隐式转换）
**JavaScript ES6:**
- **隐式转换**:
  - JavaScript 在需要时会自动进行类型转换（通常称为类型强制），如将字符串与数字相加时，字符串会被自动转换为数字。
  ```javascript
  let x = '5' + 2;  // "52" (数字 2 被转换为字符串)
  let y = '5' - 2;  // 3   (字符串 '5' 被转换为数字)
  let z = '5' * 2;  // 10  (字符串 '5' 被转换为数字)
  ```
  - 布尔值 `true` 和 `false` 在需要时会转换为 `1` 和 `0`。

- **显式转换**:
  - 使用 `Number()`, `String()`, `Boolean()`, `parseInt()`, `parseFloat()` 等函数进行显式类型转换。
  ```javascript
  let a = Number('42');  // 42
  let b = String(123);   // "123"
  let c = Boolean(0);    // false
  let d = parseInt('42px'); // 42
  let e = parseFloat('3.14'); // 3.14
  ```

**Python:**
- **隐式转换**:
  - Python 进行类型转换时更加严格，不会自动转换不兼容的类型，操作不同类型的变量时通常会抛出错误。
  ```python
  x = 5 + "2"  # TypeError: unsupported operand type(s) for +: 'int' and 'str'
  ```
  - 但某些情况下，Python 会自动进行类型提升，比如在浮点数和整数运算时，将整数提升为浮点数。
  ```python
  x = 5 + 2.0  # 7.0
  ```

- **显式转换**:
  - 使用 `int()`, `float()`, `str()`, `bool()` 等函数进行显式类型转换。
  ```python
  a = int("42")    # 42
  b = str(123)     # "123"
  c = bool(0)      # False
  d = float("3.14") # 3.14
  ```

### 5. 类型重命名
**JavaScript ES6:**
- JavaScript 不支持类型重命名，因为 JavaScript 是一种动态类型语言，没有像 TypeScript 那样的类型别名功能。

**Python:**
- **类型别名**:
  - Python 通过赋值可以创建类型别名，通常用于增加代码可读性。使用 `typing` 模块的 `TypeAlias` 关键字（Python 3.10 及更高版本）来表示类型别名。
  ```python
  from typing import TypeAlias

  MyStrType: TypeAlias = str
  name: MyStrType = "Alice"
  ```

### 6. 自定义类型、枚举类型定义
**JavaScript ES6:**
- **自定义类型**:
  - JavaScript 没有内置的类或类型定义方式，通常通过对象字面量或构造函数来创建自定义类型。
  ```javascript
  function Person(name, age) {
    this.name = name;
    this.age = age;
  }
  let person1 = new Person("Alice", 30);
  ```
  - 通过 ES6 的 `class` 语法，可以定义类似于其他面向对象语言的类。
  ```javascript
  class Person {
    constructor(name, age) {
      this.name = name;
      this.age = age;
    }
  }
  let person2 = new Person("Bob", 25);
  ```

- **枚举类型**:
  - JavaScript 没有原生的枚举类型，但可以通过 `Object.freeze()` 或使用常量对象来模拟枚举。
  ```javascript
  const Colors = Object.freeze({
    RED: "red",
    GREEN: "green",
    BLUE: "blue"
  });
  console.log(Colors.RED);  // "red"
  ```

**Python:**
- **自定义类型**:
  - Python 使用类（class）定义自定义类型。
  ```python
  class Person:
      def __init__(self, name, age):
          self.name = name
          self.age = age
  person1 = Person("Alice", 30)
  ```

- **枚举类型**:
  - Python 从 3.4 版本开始支持枚举类型，使用 `enum` 模块定义。
  ```python
  from enum import Enum

  class Color(Enum):
      RED = 1
      GREEN = 2
      BLUE = 3
  print(Color.RED)  # Color.RED
  ```

### 7. 类型、子类型判断、接口实现判断
**JavaScript ES6:**
- **类型判断**:
  - 使用 `typeof` 运算符检查基本类型。适用于 `number`, `string`, `boolean`, `function`, `undefined`, `object`。
  ```javascript
  console.log(typeof 42);       // "number"
  console.log(typeof "hello");  // "string"
  console.log(typeof {});       // "object"
  ```

- **子类型判断**:
  - 使用 `instanceof` 运算符来检查对象是否是某个构造函数的实例，适用于类和构造函数创建的对象。
  ```javascript
  class Animal {}
  class Dog extends Animal {}

  let pet = new Dog();
  console.log(pet instanceof Dog);    // true
  console.log(pet instanceof Animal); // true
  ```

- **接口实现判断**:
  - JavaScript 没有原生的接口（interface）概念，也无法直接判断接口实现。通常使用 duck typing（即“如果它走起来像鸭子，叫起来像鸭子，那么它就是鸭子”）来判断一个对象是否符合预期的接口。

**Python:**
- **类型判断**:
  - 使用 `type()` 函数检查变量的类型。
  ```python
  print(type(42))       # <class 'int'>
  print(type("hello"))  # <class 'str'>
  print(type({}))       # <class 'dict'>
  ```

- **子类型判断**:
  - 使用 `isinstance()` 函数来检查对象是否是某个类的实例，或其子类的实例。
  ```python
  class Animal:
      pass

  class Dog(Animal):
      pass

  pet = Dog()
  print(isinstance(pet, Dog))     # True
  print(isinstance(pet, Animal))  # True
  ```

- **接口实现判断**:
  - Python 没有接口的概念，但可以通过抽象基类（Abstract Base Classes, ABCs）实现类似接口的功能。使用 `abc` 模块定义抽象类，并通过 `isinstance()` 判断子类是否实现了该接口。
  ```python
  from abc import ABC, abstractmethod

  class Animal(ABC):
      @abstractmethod
      def sound(self):
          pass

  class Dog(Animal):
      def sound(self):
          return "Bark"

  pet = Dog()
  print(isinstance(pet, Animal))  # True
  ```

这些对比展示了 JavaScript ES6 和 Python 在类型转换、类型重命名、自定义类型、枚举类型定义以及类型和子类型判断方面的细节。JavaScript 更加动态和灵活，而 Python 提供了更结构化和明确的类型系统，尤其是在接口实现和自定义类型方面。

## 类型

以列表为展示方式，从以下方面对比 JavaScript ES6 和 Python，请尽可能详细
基础类型:
1. 类型、长度、字面量表示
2. 浮点数
3. 字符和字符串

以下是 JavaScript ES6 和 Python 在基础类型方面的详细对比，涵盖了类型、长度、字面量表示，浮点数，字符和字符串：

### 1. 类型、长度、字面量表示
问: 以表格形式展示 ES5 中 类型、长度、字面量表示

下面是 ES5 中常见数据类型、它们的长度（如果适用）以及字面量表示的对比表：

| **类型**        | **长度**                                   | **字面量表示**              | **示例**                                      |
|-----------------|--------------------------------------------|-----------------------------|------------------------------------------------|
| **Number**      | 64-bit 浮点数                              | 数字字面量                   | `42`, `3.14`, `-0.5`, `1e3`                    |
| **String**      | 每个字符 2 字节                            | 字符串字面量（使用引号）     | `'Hello'`, `"World"`                           |
| **Boolean**     | 1 bit                                      | 布尔字面量                   | `true`, `false`                                |
| **Null**        | N/A                                        | `null`                      | `null`                                         |
| **Undefined**   | N/A                                        | `undefined`                 | `undefined`                                    |
| **Object**      | N/A                                        | 对象字面量                  | `{}`（空对象），`{key: 'value'}`（带属性）     |
| **Array**       | N/A（数组长度为元素个数）                  | 数组字面量                  | `[]`（空数组），`[1, 2, 3]`（带元素）         |
| **Function**    | N/A（函数体长度不固定）                    | 函数字面量                  | `function() {}`，`function(a, b) { return a+b; }` |
| **RegExp**      | N/A                                        | 正则表达式字面量            | `/\d+/`, `/[a-z]/i`                            |
| **Date**        | N/A                                        | 使用 `new` 关键字创建实例    | `new Date()`                                    |
| **Error**       | N/A                                        | 使用 `new` 关键字创建实例    | `new Error('message')`                         |


### 2. 浮点数

**JavaScript ES6:**
- **浮点数表示**:
  - 浮点数使用 `Number` 类型表示，遵循 IEEE 754 双精度标准。
  - 可以使用 `.` 或 `e` 表示法表示浮点数。
  ```javascript
  let a = 3.14;      // 常规浮点数
  let b = 2.5e6;     // 科学计数法，表示 2.5 * 10^6
  ```

- **特殊值**:
  - `Infinity` 和 `-Infinity`：表示正无穷大和负无穷大，超出浮点数范围时产生。
  - `NaN`（Not a Number）：表示无法进行数学运算的结果。
  ```javascript
  let x = 1 / 0;  // Infinity
  let y = 0 / 0;  // NaN
  ```

- **精度问题**:
  - JavaScript 中浮点数运算可能导致精度问题，例如：
  ```javascript
  let sum = 0.1 + 0.2;  // 结果为 0.30000000000000004
  ```

- **转换**:
  - 使用 `parseFloat()` 函数将字符串转换为浮点数。
  ```javascript
  let num = parseFloat("3.14");  // 3.14
  ```

**Python:**
- **浮点数表示**:
  - 浮点数使用 `float` 类型表示，遵循 IEEE 754 双精度标准。
  - 可以使用 `.` 或 `e` 表示法表示浮点数。
  ```python
  a = 3.14      # 常规浮点数
  b = 2.5e6     # 科学计数法，表示 2.5 * 10^6
  ```

- **特殊值**:
  - `inf` 和 `-inf`：表示正无穷大和负无穷大，使用 `float('inf')` 和 `float('-inf')` 表示。
  - `nan`（Not a Number）：表示无效的数学运算结果，使用 `float('nan')` 表示。
  ```python
  x = float('inf')  # inf
  y = float('nan')  # nan
  ```

- **精度问题**:
  - Python 中同样存在浮点数精度问题：
  ```python
  sum = 0.1 + 0.2  # 结果为 0.30000000000000004
  ```

- **转换**:
  - 使用 `float()` 函数将字符串转换为浮点数。
  ```python
  num = float("3.14")  # 3.14
  ```

### 3. 字符和字符串

**JavaScript ES6:**
- **字符串表示**:
  - 使用单引号 `'...'` 或双引号 `"..."` 表示字符串。字符串是不可变的。
  - ES6 引入了模板字面量，使用反引号 `` `...` `` 表示，可以嵌入表达式 `${expression}`。
  ```javascript
  let str1 = 'Hello';
  let str2 = "World";
  let str3 = `Hello, ${str2}`;  // "Hello, World"
  ```

- **字符串操作**:
  - 字符串可以通过 `+` 进行拼接。
  ```javascript
  let fullName = 'John' + ' ' + 'Doe';  // "John Doe"
  ```
  - 使用 `length` 属性获取字符串长度。
  ```javascript
  console.log(str1.length);  // 5
  ```

- **字符处理**:
  - JavaScript 没有独立的字符类型，单个字符只是一个长度为 1 的字符串。
  - 可以通过字符串索引获取单个字符。
  ```javascript
  let char = str1[0];  // 'H'
  ```

**Python:**
- **字符串表示**:
  - 使用单引号 `'...'` 或双引号 `"..."` 表示字符串。字符串是不可变的。
  - 三引号 `'''...'''` 或 `"""..."""` 用于多行字符串。
  ```python
  str1 = 'Hello'
  str2 = "World"
  str3 = '''This is
  a multi-line
  string.'''
  ```

- **字符串操作**:
  - 字符串可以通过 `+` 进行拼接。
  ```python
  fullName = 'John' + ' ' + 'Doe'  # "John Doe"
  ```
  - 使用 `len()` 函数获取字符串长度。
  ```python
  length = len(str1)  # 5
  ```

- **字符处理**:
  - Python 同样没有独立的字符类型，单个字符是一个长度为 1 的字符串。
  - 可以通过字符串索引获取单个字符。
  ```python
  char = str1[0]  # 'H'
  ```

这些对比详细展示了 JavaScript ES6 和 Python 在基础类型、浮点数以及字符和字符串处理方面的差异。JavaScript 和 Python 在处理基础数据类型时有很多相似之处，但在细节上如类型系统、字符串处理和特殊值处理上仍有显著不同。

