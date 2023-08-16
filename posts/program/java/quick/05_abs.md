---
weight: 1
title: "Java 类"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 类"
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

### 1.1 java 接口与类的使用示例

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
// Java只允许一个class继承自一个类，因此，一个类有且仅有一个父类。只有Object特殊，它没有父类。
class MySubClass extends MyClass {
    public void myMethod() {
        System.out.println("Override of myMethod in MySubClass");
    }
}

// 类
public class Person {
    private String name;
    private int age;

    // 构造方法: 构造方法的名称就是类名
    // 构造方法没有返回值（也没有void），调用构造方法，必须用new操作符。
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

### 1.2 可见性规则
问: 以下是一个使用表格的形式说明Java中的可见性规则以及相应的访问修饰符


| 可见性规则   | 描述                                                         | 访问修饰符                |
| ------------ | ------------------------------------------------------------ | ------------------------- |
| 包级私有     | 在同一个包中可见，不同包不可见                                 | 默认（无修饰符）          |
| 公共         | 对所有类可见                                                | `public`                  |
| 私有         | 只对当前类可见(class 没有被定义为 private)                   | `private`                 |
| 受保护       | 对同一包和所有子类可见                                       | `protected`               |

这些访问修饰符应用于类、字段和方法上，以定义其可见性，针对可见性规则，java 还有一些特殊的限制:
1. 定义为public的field、method可以被其他类访问，前提是首先有访问class的权限
2. 由于Java支持嵌套类，如果一个类内部还定义了嵌套类，那么，嵌套类拥有访问private的权限
2. **一个.java文件只能包含一个public类**，但可以包含多个非public类。如果有public类，**文件名必须和public类的名字相同**。
3. Java在方法内部定义的变量是局部变量，局部变量的作用域从变量声明开始，到一个块结束；

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
| 常量定义                   | `final int x = 10;`                   |
| 不可重写的方法             | `public final void printMessage() { ... }` |
| 不可继承的类               | `public final class MyClass { ... }`        |


## 2. 类与继承
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

### 2.1 this 变量
在方法内部，可以使用一个隐含的变量this，它始终指向当前实例。因此，通过this.field就可以访问当前实例的字段。如果没有命名冲突，可以省略this。例如：

```java
class Person {
    private String name;

    public String getName() {
        return name; // 相当于this.name
    }
}
```

### 2.2 可变参数
可变参数用`类型...`定义，可变参数相当于数组类型：


```java
class Group {
    private String[] names;

    public void setNames(String... names) {
        this.names = names;
    }
}
```

可变参数可以与其他参数一起使用，但它必须是方法的最后一个参数。

### 2.3 构造方法
java 中构造方法的名称就是类名。和普通方法相比，构造方法没有返回值（也没有void），调用构造方法，必须用new操作符。如果一个类没有定义构造方法，编译器会自动为我们生成一个默认构造方法，它没有参数，也没有执行语句，类似这样：

```java
class Person {
    public Person() {
    }
}
```

### 2.4 多构造方法(方法重载)
可以定义多个构造方法，在通过new操作符调用的时候，编译器通过构造方法的参数数量、位置和类型自动区分：

```java
class Person {
    private String name;
    private int age;

    public Person(String name, int age) {
        this.name = name;
        this.age = age;
    }
    // 一个构造方法可以调用其他构造方法，调用其他构造方法的语法是this(…)：
    public Person(String name) {
        this(name, 18); // 调用另一个构造方法Person(String, int)
    }

    public Person() {
    }
}
```

这种多构造方法就是方法重载，另外重载方法返回值类型应该相同。

### 2.5 protected 
在Java中，`protected` 是一种访问修饰符（Access Modifier），用于控制类成员（字段、方法、内部类等）的可访问性范围。`protected` 关键字的主要特点是：

1. **在同一包内可访问：** 类的成员被声明为 `protected` 后，在同一个包内的其他类可以访问这些成员，无论这些类是否是该类的子类。
2. **子类可访问：** 子类（继承关系中的子类）可以访问父类中被声明为 `protected` 的成员，无论这些子类是否在同一个包内。
3. **不同包中的子类可访问：** 如果子类位于不同的包中，它只能访问父类中声明为 `protected` 的成员，前提是子类和父类之间存在继承关系。
4. **其他包中的类不可访问：** 在不同包中的非子类类（无继承关系）不能访问父类中被声明为 `protected` 的成员。

总之，`protected` 关键字允许子类和同一包中的类访问父类的成员，但不允许其他包中的非子类类访问。

#### super 
在Java中，`super` 是一个关键字，用于引用父类（超类）的成员（字段、方法、构造函数）。它主要用于子类中，用于与父类的成员进行交互或覆盖父类的方法。`super` 关键字有以下几个用途：

1. **调用父类构造函数：** 当子类构造函数被调用时，可以使用 `super()` 来调用父类的构造函数。这在确保正确的继承关系和初始化顺序时很有用。

   ```java
   public class Child extends Parent {
       public Child() {
           super(); // 调用父类的无参构造函数
       }
   }
   ```

2. **访问父类的成员：** 使用 `super` 可以在子类中访问父类的字段和方法。这对于在子类中重写方法并调用父类的实现非常有用。

   ```java
   public class Child extends Parent {
       void someMethod() {
           int parentField = super.parentField; // 访问父类的字段
           super.parentMethod();               // 调用父类的方法
       }
   }
   ```

3. **在方法覆盖时调用父类方法：** 在子类中覆盖（重写）父类的方法时，可以使用 `super` 来调用父类的方法实现。

   ```java
   public class Child extends Parent {
       @Override
       void parentMethod() {
           super.parentMethod(); // 在子类中调用父类的方法实现
           // 子类特定的逻辑
       }
   }
   ```

另外需要注意的是，在Java中，任何class的构造方法，第一行语句必须是调用父类的构造方法。如果没有明确地调用父类的构造方法，编译器会帮我们自动加一句super();如果父类没有默认的构造方法，子类就必须显式调用super()并给出参数以便让编译器定位到父类的一个合适的构造方法。

```java
class Person {
    protected String name;
    protected int age;

    public Person(String name, int age) {
        this.name = name;
        this.age = age;
    }
}

class Student extends Person {
    protected int score;

    public Student(String name, int age, int score) {
        // 编译器默认会在这里加上 super(); 但是 Person 没有无参数的构造方法，所以会报编译错误。
        this.score = score;
    }
}
```

这里还顺带引出了另一个问题：即子类不会继承任何父类的构造方法。子类默认的构造方法是编译器自动生成的，不是继承的。

### 2.6 final

**`final` 关键字：**
   - 当应用于类、方法或字段时，表示这些元素是不可继承、重写或修改的。
   - 当应用于类时，该类不能被其他类继承，即它是一个最终类。
   - 当应用于方法时，该方法不能被子类重写，即它是一个最终方法。
   - 当应用于字段时，该字段的值在初始化后不能再修改，即它是一个常量。
   
示例：
```java
final class FinalClass {
    // ...
}

class Parent {
    final void finalMethod() {
        // ...
    }

    final int finalField = 10;
}
```

### 2.7 instanceof
从Java 14开始，判断instanceof后，可以直接转型为指定变量，避免再次强制转型:

```java
public class Main {
    public static void main(String[] args) {
        Object obj = "hello";
        if (obj instanceof String s) {
            // 可以直接使用变量s:
            System.out.println(s.toUpperCase());
        }
    }
}
```

