---
weight: 1
title: "面向对象"
date: 2024-09-01T10:11:12+08:00
lastmod: 2024-09-01T10:11:12+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "面向对象"
featuredImage: 

tags: ["javascript 语法"]
categories: ["javascript"]

lightgallery: true

toc:
  auto: false
---


## 1. 面向对象
以列表为展示方式，从以下方面对比 JavaScript ES6 和 Python，请尽可能详细
面向对象编程:
1. 类定义
2. 类的继承
3. 方法定义
4. 方法重写
5. 函数重载

以下是 JavaScript ES6 和 Python 在面向对象编程（OOP）方面的详细对比，包括类定义、类的继承、方法定义、方法重写、和函数重载：

### 1.1 类定义

**JavaScript ES6:**
- **类声明**:
  - 使用 `class` 关键字定义类，类可以包含构造函数和方法。
  - 构造函数使用 `constructor` 关键字定义，用于初始化类的实例。
  ```javascript
  class Animal {
    constructor(name) {
      this.name = name;
    }

    speak() {
      console.log(`${this.name} makes a sound.`);
    }
  }
  ```

- **实例化对象**:
  - 使用 `new` 关键字创建类的实例。
  ```javascript
  const dog = new Animal('Dog');
  dog.speak(); // Dog makes a sound.
  ```

**Python:**
- **类声明**:
  - 使用 `class` 关键字定义类，类可以包含构造函数和方法。
  - 构造函数使用 `__init__` 方法定义，用于初始化类的实例。
  ```python
  class Animal:
      def __init__(self, name):
          self.name = name

      def speak(self):
          print(f"{self.name} makes a sound.")
  ```

- **实例化对象**:
  - 直接调用类名创建类的实例。
  ```python
  dog = Animal('Dog')
  dog.speak()  # Dog makes a sound.
  ```

### 1.2 类的继承

**JavaScript ES6:**
- **继承**:
  - 使用 `extends` 关键字继承另一个类。
  - 子类可以使用 `super` 关键字调用父类的构造函数和方法。
  ```javascript
  class Dog extends Animal {
    constructor(name, breed) {
      super(name);
      this.breed = breed;
    }

    speak() {
      console.log(`${this.name} the ${this.breed} barks.`);
    }
  }
  ```

**Python:**
- **继承**:
  - 在类定义时，将父类名作为参数传递给子类，以实现继承。
  - 子类可以使用 `super()` 调用父类的构造函数和方法。
  ```python
  class Dog(Animal):
      def __init__(self, name, breed):
          super().__init__(name)
          self.breed = breed

      def speak(self):
          print(f"{self.name} the {self.breed} barks.")
  ```

### 1.3 方法定义

**JavaScript ES6:**
- **方法**:
  - 在类中直接定义方法，无需 `function` 关键字。
  - 方法在类的原型上定义（通过 `prototype` 实现）。
  ```javascript
  class Animal {
    constructor(name) {
      this.name = name;
    }

    speak() {
      console.log(`${this.name} makes a sound.`);
    }
  }
  ```

**Python:**
- **方法**:
  - 在类中定义方法，第一个参数通常为 `self`，用于引用类的实例。
  ```python
  class Animal:
      def speak(self):
          print(f"{self.name} makes a sound.")
  ```

### 1.4 方法重写

**JavaScript ES6:**
- **重写方法**:
  - 在子类中定义与父类方法同名的方法，即为重写。
  - 可以使用 `super` 关键字调用父类被重写的方法。
  ```javascript
  class Dog extends Animal {
    speak() {
      console.log(`${this.name} barks.`);
    }
  }
  ```

**Python:**
- **重写方法**:
  - 在子类中定义与父类方法同名的方法，即为重写。
  - 可以使用 `super()` 调用父类被重写的方法。
  ```python
  class Dog(Animal):
      def speak(self):
          print(f"{self.name} barks.")
  ```

### 1.5 函数重载

**JavaScript ES6:**
- **函数重载**:
  - JavaScript 不支持传统意义上的函数重载。同名函数会覆盖前一个定义。
  - 可以通过检查参数数量或类型在方法内部手动实现类似重载的行为。


## 2. 接口和抽象类
以列表为展示方式，从以下方面对比 JavaScript ES6 和 Python，请尽可能详细
接口和抽象类:
1. 接口定义和实现
2. 抽象类定义和实现

在 JavaScript ES6 中，"接口" 和 "抽象类" 这些概念并没有直接的语言支持，如在 TypeScript 或 Java 等语言中那样。但可以通过某些编程模式和技巧来模拟这些概念。以下是如何在 JavaScript ES6 中定义和实现类似接口和抽象类的总结：

### 2.1 **接口（Interface）**

JavaScript ES6 没有内置的接口（Interface）支持，但可以通过以下方式模拟接口的行为：

- **命名约定**:
  - 使用命名约定来定义一个接口对象，该对象定义了需要实现的方法和属性，但不提供具体实现。
  - 例子：
    ```javascript
    const Flyable = {
      fly: function() {
        throw new Error('Method "fly" should be implemented');
      }
    };
    ```

- **手动检查实现**:
  - 使用类或对象实现接口时，手动检查是否实现了所有接口方法。
  - 例子：
    ```javascript
    class Bird {
      fly() {
        console.log("Flying...");
      }
    }

    function implementsInterface(obj, interfaceObj) {
      for (let method in interfaceObj) {
        if (typeof obj[method] !== 'function') {
          throw new Error(`Class does not implement method: ${method}`);
        }
      }
    }

    const sparrow = new Bird();
    implementsInterface(sparrow, Flyable); // No error if "fly" is implemented
    ```

- **鸭子类型**:
  - 使用鸭子类型（Duck Typing）原则，即对象只要“看起来像”某个接口就可以被认为实现了该接口。
  - 例子：
    ```javascript
    const Plane = {
      fly() {
        console.log("Plane is flying");
      }
    };

    const FlyableObjects = [sparrow, Plane];
    FlyableObjects.forEach(obj => obj.fly()); // Both Bird and Plane can "fly"
    ```

### 2. **抽象类（Abstract Class）**

JavaScript ES6 也没有直接的抽象类支持，但可以通过一些模式模拟抽象类的行为：

- **模拟抽象类**:
  - 使用类和方法抛出未实现异常来创建抽象类。
  - 例子：
    ```javascript
    class Animal {
      constructor(name) {
        if (new.target === Animal) {
          throw new TypeError("Cannot instantiate an abstract class");
        }
        this.name = name;
      }

      speak() {
        throw new Error("Method 'speak()' must be implemented.");
      }
    }
    ```

- **子类继承与实现**:
  - 子类必须继承抽象类，并实现抽象方法。
  - 例子：
    ```javascript
    class Dog extends Animal {
      speak() {
        console.log(`${this.name} barks.`);
      }
    }

    const myDog = new Dog('Rex');
    myDog.speak(); // "Rex barks."
    ```

- **利用 `new.target`**:
  - 使用 `new.target` 可以防止直接实例化抽象类。
  - 例子：
    ```javascript
    class Shape {
      constructor() {
        if (new.target === Shape) {
          throw new TypeError("Cannot construct Shape instances directly");
        }
      }

      area() {
        throw new Error("Method 'area()' must be implemented.");
      }
    }

    class Circle extends Shape {
      constructor(radius) {
        super();
        this.radius = radius;
      }

      area() {
        return Math.PI * this.radius * this.radius;
      }
    }

    const circle = new Circle(5);
    console.log(circle.area()); // 78.53981633974483
    ```

总结:
- **接口（Interface）**: JavaScript 中没有内建的接口支持，可以通过命名约定和手动检查的方式来模拟接口，或者依赖鸭子类型原则进行接口实现的检测。

- **抽象类（Abstract Class）**: JavaScript ES6 中没有直接的抽象类，但可以通过类的构造函数中使用 `new.target` 防止直接实例化，并抛出未实现的错误来模拟抽象类行为。子类继承抽象类后，必须实现所有抽象方法。

这种模拟模式虽然不如在其他语言中使用接口和抽象类那么直接和安全，但在 JavaScript 的动态环境中已经能满足许多设计需求。