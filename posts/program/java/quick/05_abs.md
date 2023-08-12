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

## 3. Java 中的抽象类
问: Java 中的抽象类

在Java中，抽象类（Abstract Class）是一种特殊的类，它不能被实例化，而是被设计为用作其他类的基类。抽象类可以包含抽象方法（方法没有实现，只有方法声明），以及普通的具体方法。其他类可以继承抽象类并实现其中的抽象方法，从而完成抽象类的功能。

以下是一些关键点来理解Java中的抽象类：

1. **抽象类的声明：** 使用`abstract`关键字来声明抽象类。抽象类可以有构造方法，但不能直接实例化。

   ```java
   abstract class AbstractClass {
       // 抽象方法
       abstract void abstractMethod();
       
       // 具体方法
       void concreteMethod() {
           // 实现具体逻辑
       }
   }
   ```

2. **抽象方法：** 抽象方法没有方法体，只有方法声明，即方法名、参数列表和返回类型。子类继承抽象类时，必须实现其抽象方法。

3. **继承和实现：** 子类继承抽象类使用`extends`关键字，如果子类是一个具体类，那么它必须实现抽象类中的所有抽象方法。如果子类本身也是抽象类，可以选择性地实现或继续声明抽象方法。

   ```java
   abstract class ConcreteSubclass extends AbstractClass {
       @Override
       void abstractMethod() {
           // 实现抽象方法
       }
   }
   ```

4. **抽象类的用途：** 抽象类通常用于定义一组相关类的共同特性和方法。它们可以提供一些通用的方法实现，从而避免子类重复编写相同的代码。

5. **多继承限制：** Java中的类只能单继承，即一个类只能直接继承一个父类。但是，一个类可以实现多个接口，从而达到多继承的效果。

## 4. 匿名类
问: Java 中的匿名类

在Java中，匿名类是一种特殊的类，它没有显式的类名，通常用于创建临时的、单次使用的类实例。匿名类通常用于实现接口、抽象类或者继承自其他类，并且在创建实例时同时提供类的实现。

匿名类的语法结构如下：

```java
// 创建匿名类实例
SuperType instance = new SuperType() {
    // 实现接口方法或重写父类方法
    // 可以在这里定义属性和方法
};
```

这里的`SuperType`可以是接口、抽象类或者普通类。匿名类实际上是一个子类的实例，它继承了`SuperType`的结构，并可以实现其方法或者添加自己的属性和方法。

以下是一个简单的例子，展示如何在Java中使用匿名类：

```java
interface Greeting {
    void greet();
}

public class AnonymousClassExample {
    public static void main(String[] args) {
        Greeting anonymousGreeting = new Greeting() {
            @Override
            public void greet() {
                System.out.println("Hello from anonymous class!");
            }
        };

        anonymousGreeting.greet();
    }
}
```

需要注意的是，**匿名类具有一些限制和注意事项，例如它不能有显式的构造函数，只能继承一个类或实现一个接口**，等等。此外，随着Java版本的演进，Java 8以后引入的Lambda表达式提供了更为简洁的方式来实现函数式接口，通常可以用于替代匿名类。

## 5. Lambda 表达式
问: java Lambda 表达式

Lambda表达式是Java SE 8引入的一个重要特性，它使得在Java中可以更简洁地实现函数式编程风格。Lambda表达式允许您像参数传递一样传递代码块，通常用于实现函数式接口（只有一个抽象方法的接口）的实例。

Lambda表达式的基本语法如下：

```java
(parameters) -> expression
```

或者

```java
(parameters) -> { statements; }
```

其中：
- `parameters` 是Lambda表达式的参数列表。可以为空，或者包含一个或多个参数。
- `->` 是Lambda操作符，将参数列表和表达式或代码块分隔开。
- `expression` 是单个表达式，通常用于返回某个值。
- `{ statements; }` 是一个代码块，可以包含多个语句，并可以用于执行更复杂的操作。

以下是一个简单的Lambda表达式的例子，展示了如何在一个集合中使用Lambda表达式来排序：

```java
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class LambdaExample {
    public static void main(String[] args) {
        List<String> names = new ArrayList<>();
        names.add("Alice");
        names.add("Bob");
        names.add("Charlie");

        // 使用Lambda表达式排序
        Collections.sort(names, (s1, s2) -> s1.compareTo(s2));

        System.out.println(names); // 输出排序后的列表
    }
}

// Lambda表达式示例
public class Main {
    public static void main(String[] args) {
        Runnable runnable = () -> {
            System.out.println("Hello, World!");
        };
        runnable.run();
    }
}

// 对应的匿名类示例
public class Main {
    public static void main(String[] args) {
        Runnable runnable = new Runnable() {
            @Override
            public void run() {
                System.out.println("Hello, World!");
            }
        };
        runnable.run();
    }
}
```

### 5.1 Lambda 与匿名类
虽然Lambda表达式在许多场景下可以替代匿名类，但也有一些场景它们并不能完全替代匿名类。以下是一些Lambda表达式无法替代匿名类的场景：

1. **多个抽象方法的接口：** Lambda表达式只能用于实现函数式接口，即只有一个抽象方法的接口。如果一个接口有多个抽象方法，Lambda表达式无法处理这种情况，而匿名类可以。
2. **需要访问外部变量的情况：** Lambda表达式要求引用的外部变量必须是`final`或`effectively final`。然而，匿名类可以访问外部的任何变量，不管是否是`final`。
4. **抛出受检异常的情况：** Lambda表达式的异常处理机制与匿名类不同。Lambda表达式不能抛出比其函数式接口方法更多的异常类型，而匿名类可以在其实现方法中抛出受检异常。
5. **需要明确的this引用：** 在匿名类中，`this`关键字指代的是匿名类实例本身，而在Lambda表达式中，`this`引用指的是包含Lambda表达式的外部类实例。
6. **需要方法重载的情况：** 如果在匿名类中存在重载的方法，可以在匿名类中实现多个版本的方法。Lambda表达式只能实现接口的单个抽象方法，无法实现方法重载。
7. **需要继承和覆盖的情况：** 如果需要继承一个父类并覆盖其方法，匿名类可以提供更大的灵活性，而Lambda表达式不适用于继承。

#### **多个抽象方法的接口：**

假设有一个自定义的接口`MyInterface`包含多个抽象方法：

```java
interface MyInterface {
    void method1();
    void method2();
}
```

在这种情况下，Lambda表达式无法直接实现这个接口，但可以使用匿名类来实现：

```java
MyInterface anonymousInstance = new MyInterface() {
    @Override
    public void method1() {
        // 实现method1
    }

    @Override
    public void method2() {
        // 实现method2
    }
};
```

#### **需要访问外部变量的情况：**

假设需要在匿名类或Lambda表达式中访问外部变量，并且这些变量不是`final`或者 effectively final：

```java
int externalValue = 42;

Runnable anonymousRunnable = new Runnable() {
    @Override
    public void run() {
        System.out.println("External value: " + externalValue);
    }
};
```

在Lambda表达式中，`externalValue`必须是`final`或者 effectively final：

```java
int externalValue = 42;

Runnable lambdaRunnable = () -> {
    System.out.println("External value: " + externalValue);
};
```

在Java中，`final`变量是指一旦赋予初始值后，其值不可更改的变量。`effectively final`变量是指虽然没有使用`final`关键字声明，但在变量被赋值后没有被再次改变的变量。

Lambda表达式在访问外部变量时，要求这些变量要么是`final`，要么是`effectively final`，以确保在Lambda表达式中的代码块中不会引发并发问题。

以下是关于`final`和`effectively final`变量的一些要点：

- **`final`变量：** 一旦一个变量被声明为`final`，它的值在赋值后就不能再次改变。这是一种编译期常量，Lambda表达式可以在其中引用。
- **`effectively final`变量：** 即使没有使用`final`关键字，如果一个变量在赋值后没有再次改变，它被认为是`effectively final`。这允许您在Lambda表达式中引用这些变量。

以下是示例来说明这两种类型的变量：

```java
public class FinalExample {
    public static void main(String[] args) {
        int num = 10; // effectively final
        
        // Lambda表达式引用`num`
        Runnable runnable = () -> {
            System.out.println("Value of num: " + num);
        };
        
        // 使用`final`关键字声明变量
        final int finalNum = 20;
        
        // Lambda表达式引用`finalNum`
        Runnable finalRunnable = () -> {
            System.out.println("Value of finalNum: " + finalNum);
        };
        
        // 无法改变`finalNum`的值
        // finalNum = 30; // 编译错误
    }
}
```

在上面的示例中，`num`被认为是`effectively final`，因为它在Lambda表达式中被引用，但没有被重新赋值。而`finalNum`则是一个明确的`final`变量，无法在之后被重新赋值。

在Lambda表达式中，如果引用的是`final`或`effectively final`变量，编译器可以保证这些变量的值不会在Lambda表达式内被修改，从而确保了线程安全性。


#### **抛出受检异常的情况：**

当需要在实现方法中抛出受检异常时，匿名类可以更灵活地处理：

```java
Runnable anonymousRunnable = new Runnable() {
    @Override
    public void run() {
        try {
            throw new Exception("Checked exception");
        } catch (Exception e) {
            // 处理异常
        }
    }
};
```

在Lambda表达式中，不能抛出超出其函数式接口方法声明的受检异常：

```java
Runnable lambdaRunnable = () -> {
    // 无法抛出受检异常
};
```

## 6. 接口
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
