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
| 接口      |Java中的接口是一种抽象的类型，可以包含方法声明，但不能包含实现。类可以实现一个或多个接口。接口定义的所有方法默认都是public abstract的。|Go中的接口是一组方法签名的集合，没有显式的关键字来声明实现。任何类型只要实现了接口中的方法，即被视为实现了该接口。|
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

这些访问修饰符应用于类、字段和方法上，以定义其可见性。**一个.java文件只能包含一个public类**，但可以包含多个非public类。如果有public类，**文件名必须和public类的名字相同**。Java在方法内部定义的变量是局部变量，局部变量的作用域从变量声明开始，到一个块结束；

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
#### final 关键字
Java还提供了一个final修饰符。final与访问权限不冲突，它有很多作用。

| 作用                       | 示例                                       |
|----------------------------|--------------------------------------------|
| 不可变变量                 | `final int x = 10;`                        |
| 常量定义                   | 定义常量使用`final`关键字                   |
| 不可重写的方法             | `public final void printMessage() { ... }` |
| 不可继承的类               | `public final class MyClass { ... }`        |


## 2. Java 面向对象
### 2.1 类与继承
问: 给出代码示例，说明 Java 多构造方法、方法重载、isinstance、final、如何覆写 Object 的方法、静态方法

下面是对Java中多构造方法、方法重载、instanceof、final、方法覆写以及静态方法的代码示例：

```java
// 抽象类
public abstract class Vehicle {
    private String model;
    private int year;
    // 定义静态字段number: 所有实例都会共享静态字段
    // 不推荐用实例变量.静态字段去访问静态字段，因为在Java程序中，实例对象并没有静态字段。
    // 在代码中，实例对象能访问静态字段只是因为编译器可以根据实例类型自动转换为类名.静态字段来访问静态对象。
    // 推荐用类名来访问静态字段。可以把静态字段理解为描述class本身的字段（非实例字段）。
    public static int number;
    
    // 抽象方法
    public abstract void calculateArea();
    
    // 多构造方法
    public Vehicle(String model, int year) {
        this.model = model;
        this.year = year;
    }

    public Vehicle(String model) {
        this.model = model;
        this.year = 0;
    }

    // 方法重载
    public void accelerate() {
        System.out.println("Vehicle is accelerating.");
    }

    public void accelerate(int speed) {
        System.out.println("Vehicle is accelerating at " + speed + " km/h.");
    }

    // instanceof
    public static void checkType(Object obj) {
        if (obj instanceof Vehicle) {
            System.out.println("obj is an instance of Vehicle");
        } else {
            System.out.println("obj is not an instance of Vehicle");
        }
    }

    // final
    public final void finalMethod() {
        // final方法不能被子类重写
        System.out.println("This is a final method.");
    }

    // 方法覆写(Object的toString方法)
    @Override
    public String toString() {
        return "Vehicle [model=" + model + ", year=" + year + "]";
    }

    // 静态方法
    public static void staticMethod() {
        System.out.println("This is a static method.");
    }
}

public class Car extends Vehicle {
    private int numberOfDoors;

    public Car(String model, int year, int numberOfDoors) {
        super(model, year);
        this.numberOfDoors = numberOfDoors;
    }

    // 方法重载(覆盖父类的方法)
    @Override
    public void accelerate() {
        System.out.println("Car is accelerating.");
    }

    public void accelerate(int speed, String direction) {
        System.out.println("Car is accelerating at " + speed + " km/h towards " + direction + ".");
    }

    public static void main(String[] args) {
        Vehicle vehicle = new Vehicle("Honda", 2021);
        Vehicle checkVehicle = new Car("Toyota", 2022, 4);

        // 方法重载
        vehicle.accelerate();
        vehicle.accelerate(100);

        // 方法覆写
        checkVehicle.accelerate();
        checkVehicle.accelerate(120, "north");

        // instanceof
        checkType(vehicle);
        checkType(checkVehicle);

        // final方法
        vehicle.finalMethod();

        // 方法覆写
        System.out.println(vehicle.toString());

        // 静态方法
        Vehicle.staticMethod();
    }
}
```

### 2.2 接口
问: 给出代码示例，说明 Java 的接口继承、default 方法、接口的静态字段

下面是一个代码示例，展示了Java中接口继承、default方法和接口的静态字段的使用：

```java
// 接口A
public interface A {
    void methodA(); // 抽象方法

    default void defaultMethod() {
        System.out.println("This is a default method in interface A");
    }

    // 静态字段
    String STATIC_FIELD_A = "Static Field A";
}

// 接口B继承自接口A
public interface B extends A {
    void methodB(); // 抽象方法

    @Override
    default void defaultMethod() {
        System.out.println("This is a default method in interface B");
    }

    // 静态字段
    String STATIC_FIELD_B = "Static Field B";
}

// 实现类C实现接口B
public class C implements B {
    @Override
    public void methodA() {
        System.out.println("Implementing methodA");
    }

    @Override
    public void methodB() {
        System.out.println("Implementing methodB");
    }
}

public class Main {
    public static void main(String[] args) {
        C c = new C();

        c.methodA(); // 调用接口A中的抽象方法
        c.methodB(); // 调用接口B中的抽象方法

        c.defaultMethod(); // 调用接口B中的default方法，覆盖了接口A中的default方法

        // 访问接口的静态字段
        System.out.println(A.STATIC_FIELD_A);
        System.out.println(B.STATIC_FIELD_B);
    }
}
```

在上面的示例中，接口`A`定义了一个抽象方法`methodA`和一个默认方法`defaultMethod`，并且声明了一个静态字段`STATIC_FIELD_A`。接口`B`继承自接口`A`，添加了一个抽象方法`methodB`，重写了默认方法`defaultMethod`，并且声明了一个静态字段`STATIC_FIELD_B`。类`C`实现了接口`B`，必须实现接口`A`和接口`B`中的所有抽象方法。

在`Main`类的`main`方法中，我们创建了一个`C`类的实例`c`。通过该实例，我们可以调用接口`A`和接口`B`中的抽象方法和默认方法。还可以通过接口名访问接口的静态字段。
