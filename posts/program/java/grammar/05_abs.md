---
weight: 1
title: "Java 抽象"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 接口、类与继承"
featuredImage: 

tags: ["java 语法"]
categories: ["Java"]

lightgallery: true

toc:
  auto: false
---

## 1. 接口和类定义
问: 以表格的形式，对比 Java 和Go 中的接口、实现、类、继承

| 概念      | Java                              | Go                                 |
|---------|---------------------------------|----------------------------------|
| 接口      |Java中的接口是一种抽象的类型，可以包含方法声明，但不能包含实现。类可以实现一个或多个接口。|Go中的接口是一组方法签名的集合，没有显式的关键字来声明实现。任何类型只要实现了接口中的方法，即被视为实现了该接口。|
| 实现      |Java中的实现是指类实现接口中声明的方法，并提供具体的实现逻辑。使用关键字```implements```来指定类实现接口。|Go中的实现是隐式的，不需要显式地声明实现接口。只要类型实现了接口中的所有方法，即被视为实现了该接口。|
| 类       |Java中的类是面向对象编程的基本单元，用于封装数据和行为。类可以有属性、方法、构造函数等。|Go中的类的概念与Java略有不同。在Go中，使用结构体（struct）来封装数据，并为结构体添加方法。|
| 继承      |Java中的继承允许子类继承父类的属性和方法，并可以扩展和重写父类的功能。使用关键字```extends```来指定子类继承父类。|Go中没有显式的继承概念。相反，可以使用组合（composition）来实现类似的功能，通过将一个类型嵌入到另一个类型中来达到代码复用的目的。|


| 功能     | Java                                                                                   | Go                                                                                     |
| -------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 接口     | <pre><code>interface Animal {<br>  public void makeSound();<br>}</code></pre>                  | <pre><code>type Animal interface {<br>  makeSound()<br>}</code></pre>                          |
| 实现     | <pre><code>class Dog implements Animal {<br>  public void makeSound() {<br>    System.out.println("Bark bark!");<br>  }<br>}</code></pre> | <pre><code>type Dog struct {}<br>func (d Dog) makeSound() {<br>  fmt.Println("Bark bark!")<br>}</code></pre> |
| 继承       | <pre><code>class Labrador extends Dog {<br>  public void fetch() {<br>    System.out.println("Fetching...");<br>  }<br>}</code></pre>      | <pre><code>type Labrador struct {<br>  Dog<br>}<br>func (l Labrador) fetch() {<br>  fmt.Println("Fetching...")<br>}</code></pre>                       |

Java示例：

```java
// 定义接口
interface MyInterface {
    void myMethod();
}

// 实现接口
class MyClass implements MyInterface {
    public void myMethod() {
        System.out.println("Implementation of myMethod in MyClass");
    }
}

// 继承
class MySubClass extends MyClass {
    public void myMethod() {
        System.out.println("Override of myMethod in MySubClass");
    }
}

// 类
public class Person {
  private String name;
  private int age;

  public Person(String name, int age) {
    this.name = name;
    this.age = age;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }
}
```

Go示例：

```go
// 定义接口
type MyInterface interface {
    myMethod()
}

// 结构体实现接口
type MyStruct struct{}

func (s MyStruct) myMethod() {
    fmt.Println("Implementation of myMethod in MyStruct")
}

// 结构体嵌入
type MySubStruct struct {
    MyStruct
}

func (s MySubStruct) myMethod() {
    fmt.Println("Override of myMethod in MySubStruct")
}

// 类
type Person struct {
  name string
  age int
}

func NewPerson(name string, age int) *Person {
  return &Person{name, age}
}

func (p *Person) GetName() string {
  return p.name
}

func (p *Person) SetName(name string) {
  p.name = name
}
```

## 2. 可见性规则
问: 以下是一个使用表格的形式说明Java中的可见性规则以及相应的访问修饰符


| 可见性规则   | 描述                                                         | 访问修饰符                |
| ------------ | ------------------------------------------------------------ | ------------------------- |
| 包级私有     | 在同一个包中可见，不同包不可见                                 | 默认（无修饰符）          |
| 公共         | 对所有类可见                                                | `public`                  |
| 私有         | 只对当前类可见                                              | `private`                 |
| 受保护       | 对同一包和所有子类可见                                       | `protected`               |

这些访问修饰符应用于类、字段和方法上，以定义其可见性。使用适当的访问修饰符可以控制代码的封装性和访问权限。以下是示例代码，演示了不同可见性规则的应用：

```java
package com.example;

public class MyClass {
    private int privateField;              // 私有字段，只在当前类可见
    public int publicField;                // 公共字段，对所有类可见
    int packagePrivateField;               // 包级私有字段，默认在同一包中可见
    protected int protectedField;          // 受保护字段，对同一包和子类可见

    private void privateMethod() {         // 私有方法，只在当前类可见
        // 执行私有逻辑
    }

    public void publicMethod() {           // 公共方法，对所有类可见
        // 执行公共逻辑
    }

    void packagePrivateMethod() {          // 包级私有方法，默认在同一包中可见
        // 执行包级私有逻辑
    }

    protected void protectedMethod() {     // 受保护方法，对同一包和子类可见
        // 执行受保护逻辑
    }
}
```
