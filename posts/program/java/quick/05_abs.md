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

## 3. 内部类/匿名类
### 3.1 内部类 Inner Class

```java
class Outer {
    class Inner {
        // 定义了一个Inner Class
    }
}

public class Main {
    public static void main(String[] args) {
        Outer outer = new Outer("Nested"); // 实例化一个Outer

        // 首先创建一个Outer的实例，然后，调用Outer实例的new来创建Inner实例
        Outer.Inner inner = outer.new Inner(); // 实例化一个Inner
        inner.hello();
    }
}
```

Inner Class 与普通类有个最大的不同，就是Inner Class的实例不能单独存在，必须依附于一个Outer Class的实例。这是因为Inner Class除了有一个this指向它自己，还隐含地持有一个Outer Class实例，可以用Outer.this访问这个实例。所以，实例化一个Inner Class不能脱离Outer实例。

除了能引用Outer实例外，还有一个额外的“特权”，就是可以修改Outer Class的private字段，因为Inner Class的作用域在Outer Class内部，所以能访问Outer Class的private字段和方法。

观察Java编译器编译后的.class文件可以发现，Outer类被编译为Outer.class，而Inner类被编译为Outer$Inner.class。

### 3.2 匿名类 Anonymous Class
在Java中，可以使用匿名类来定义一个没有明确名称的类。匿名类通常用于创建只需要简单实现某个接口或继承某个类的情况，而不需要单独定义一个具名的类。**在定义匿名类的时候就必须实例化它**

匿名类的定义和使用方式如下：

1. 匿名类继承父类：
   ```java
   ParentClass obj = new ParentClass() {
       // 匿名类的实现代码
   };
   ```

2. 匿名类实现接口：
   ```java
   InterfaceName obj = new InterfaceName() {
       // 匿名类的实现代码
   };
   ```

在匿名类的定义中，可以重写父类的方法或实现接口的方法，并在其中编写具体的逻辑。匿名类可以访问外部类的成员变量和方法，以及`final`修饰的局部变量。

以下是一个使用匿名类的示例：

```java
public class Main {
    public static void main(String[] args) {
        // 匿名类继承父类
        ParentClass obj1 = new ParentClass() {
            @Override
            public void printMessage() {
                System.out.println("Hello from anonymous class!");
            }
        };
        obj1.printMessage(); // 输出: Hello from anonymous class!

        // 匿名类实现接口
        InterfaceName obj2 = new InterfaceName() {
            @Override
            public void printMessage() {
                System.out.println("Hello from anonymous class!");
            }
        };
        obj2.printMessage(); // 输出: Hello from anonymous class!
    }

    static class ParentClass {
        public void printMessage() {
            System.out.println("Hello from parent class!");
        }
    }

    interface InterfaceName {
        void printMessage();
    }
}

// 匿名类嵌入静态代码
import java.util.HashMap;

public class Main {
    public static void main(String[] args) {
        HashMap<String, String> map1 = new HashMap<>();
        HashMap<String, String> map2 = new HashMap<>() {}; // 匿名类!

        // map3也是一个继承自HashMap的匿名类实例，并且添加了static代码块来初始化数据
        HashMap<String, String> map3 = new HashMap<>() {
            {
                put("A", "1");
                put("B", "2");
            }
        };
        System.out.println(map3.get("A"));
    }
}

```

观察Java编译器编译后的.class文件可以发现，Outer类被编译为Outer.class，而匿名类被编译为Outer$1.class。如果有多个匿名类，Java编译器会将每个匿名类依次命名为Outer$1、Outer$2、Outer$3……

### 3.3 静态内部类 Static Nested Class
静态内部类是一种嵌套在其他类中并带有`static`修饰符的内部类。与普通的内部类（非静态内部类）相比，有以下特点：

1. 静态内部类可以直接访问外部类的静态成员，包括静态字段和静态方法，无需通过外部类的实例。
2. 静态内部类的对象可以独立于外部类的对象存在，即不再依附于Outer的实例，而是一个完全独立的类，因此无法引用Outer.this
3. 静态内部类可以拥有自己的静态字段、静态方法和实例字段，与普通的类类似。
4. 静态内部类对外部类的实例没有隐式引用，因此不会导致外部类的内存泄漏问题。

以下是静态内部类的示例代码：

```java
public class OuterClass {
    private static int staticField = 10;
    private int instanceField = 20;

    // 静态内部类
    public static class InnerClass {
        private static int innerStaticField = 30;
        private int innerInstanceField = 40;

        public void innerMethod() {
            // 可直接访问外部类的静态成员
            System.out.println("Static field in outer class: " + staticField);
            // 无法直接访问外部类的实例成员，需要通过对象引用
            // System.out.println("Instance field in outer class: " + instanceField);
            // 可直接访问自己的成员
            System.out.println("Static field in inner class: " + innerStaticField);
            System.out.println("Instance field in inner class: " + innerInstanceField);
        }
    }

    public static void main(String[] args) {
        // 创建静态内部类的对象
        InnerClass innerObj = new InnerClass();
        innerObj.innerMethod();
    }
}

public class Main {
    public static void main(String[] args) {
        Outer.StaticNested sn = new OuterClass.InnerClass();
        sn.hello();
    }
}
```

在上述示例中，`OuterClass`是外部类，`InnerClass`是静态内部类。静态内部类可以直接访问外部类的静态字段`staticField`，但无法直接访问外部类的实例字段`instanceField`。

静态内部类的创建方式与普通的类类似，可以直接通过`new InnerClass()`创建静态内部类的对象，无需外部类的实例。


## 4. 枚举类型
```java
enum Weekday {
    SUN, MON, TUE, WED, THU, FRI, SAT;
}
```

### 4.1 枚举类型与 class 去呗
通过enum定义的枚举类，和其他的class有什么区别？

答案是没有任何区别。enum定义的类型就是class，只不过它有以下几个特点：

定义的enum类型总是继承自java.lang.Enum，且无法被继承；
只能定义出enum的实例，而无法通过new操作符创建enum的实例；
定义的每个实例都是引用类型的唯一实例；
可以将enum类型用于switch语句。
例如，我们定义的Color枚举类：

```java
public enum Color {
    RED, GREEN, BLUE;
}
```
编译器编译出的class大概就像这样：

```java
public final class Color extends Enum { // 继承自Enum，标记为final class
    // 每个实例均为全局唯一:
    public static final Color RED = new Color();
    public static final Color GREEN = new Color();
    public static final Color BLUE = new Color();
    // private构造方法，确保外部无法调用new操作符:
    private Color() {}
}
```

所以，编译后的enum类和普通class并没有任何区别。但是我们自己无法按定义普通class那样来定义enum，必须使用enum关键字，这是Java语法规定的。

因为enum本身是class，所以我们可以定义private的构造方法，并且，给每个枚举常量添加字段：

```java
enum Weekday {
    MON(1), TUE(2), WED(3), THU(4), FRI(5), SAT(6), SUN(0);

    public final int dayValue;

    private Weekday(int dayValue) {
        this.dayValue = dayValue;
    }
}
```

### 4.2 枚举类型的方法
因为enum是一个class，每个枚举的值都是class实例，因此，这些实例有一些方法：

以下是Java中枚举类型常用的方法的表格列举：

| 方法                   | 描述                                              |
|-----------------------|--------------------------------------------------|
| `values()`            | 返回枚举类型的所有枚举常量数组                      |
| `valueOf(String name)` | 返回指定名称的枚举常量                            |
| `name()`              | 返回枚举常量的名称                                |
| `ordinal()`           | 返回枚举常量在枚举类型中的位置（从0开始计数）       |
| `compareTo(E other)`  | 比较当前枚举常量与指定枚举常量的顺序               |
| `toString()`          | 返回枚举常量的字符串表示                          |

### 4.3 用于 switch


```java
enum DayOfWeek {
    MONDAY,
    TUESDAY,
    WEDNESDAY,
    THURSDAY,
    FRIDAY,
    SATURDAY,
    SUNDAY
}

public class Main {
    public static void main(String[] args) {
        DayOfWeek day = DayOfWeek.WEDNESDAY;
        
        switch (day) {
            case MONDAY:
                System.out.println("星期一");
                break;
            case TUESDAY:
                System.out.println("星期二");
                break;
            case WEDNESDAY:
                System.out.println("星期三");
                break;
            case THURSDAY:
                System.out.println("星期四");
                break;
            case FRIDAY:
                System.out.println("星期五");
                break;
            case SATURDAY:
                System.out.println("星期六");
                break;
            case SUNDAY:
                System.out.println("星期日");
                break;
            default:
                System.out.println("无效的日期");
                break;
        }
    }
}

```
注，由于day的类型已经声明为DayOfWeek枚举类型，因此在case语句中可以直接使用枚举常量WEDNESDAY，而不需要显式添加DayOfWeek.WEDNESDAY。

## 5. 记录类
从Java 14开始，引入了新的Record类。定义Record类时，使用关键字record。借助 Record 类，我们可以快速顶一个不变类型。

```java
record Point(int x, int y) {}
```

上面的代码就相当于定义了一个如下类:

```java
final class Point extends Record {
    private final int x;
    private final int y;

    public Point(int x, int y) {
        this.x = x;
        this.y = y;
    }

    public int x() {
        return this.x;
    }

    public int y() {
        return this.y;
    }

    public String toString() {
        return String.format("Point[x=%s, y=%s]", x, y);
    }

    public boolean equals(Object o) {
        ...
    }
    public int hashCode() {
        ...
    }
}
```

除了用final修饰class以及每个字段外，编译器还自动为我们创建了构造方法，和字段名同名的方法，以及覆写toString()、equals()和hashCode()方法。和enum类似，我们自己不能直接从Record派生，只能通过record关键字由编译器实现继承。

### 5.1 构造方法
编译器默认按照record声明的变量顺序自动创建一个构造方法，并在方法内给字段赋值。那我们如何自定义构造方法呢?

```java
public record Point(int x, int y) {
    public Point {
        if (x < 0 || y < 0) {
            throw new IllegalArgumentException();
        }
    }
}

// 方法public Point {...}被称为Compact Constructor，它的目的是让我们编写检查逻辑，编译器最终生成的构造方法如下：
public final class Point extends Record {
    public Point(int x, int y) {
        // 这是我们编写的Compact Constructor:
        if (x < 0 || y < 0) {
            throw new IllegalArgumentException();
        }
        // 这是编译器继续生成的赋值代码:
        this.x = x;
        this.y = y;
    }
    ...
}
```

作为record的Point仍然可以添加静态方法。一种常用的静态方法是of()方法，用来创建Point：

```java
public record Point(int x, int y) {
    public static Point of() {
        return new Point(0, 0);
    }
    public static Point of(int x, int y) {
        return new Point(x, y);
    }
}
```