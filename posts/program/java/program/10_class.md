---
weight: 1
title: "Java 中的类"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 核心类"
featuredImage: 

tags: ["java 语法"]
categories: ["Java"]

lightgallery: true

toc:
  auto: false
---

在 java 快速入门中，我们已经简单介绍了 Java 中类的用法，这一节我们来详细介绍一下 Java 类的一些特殊用法，包括:
1. Java 的抽象类
2. 匿名类
3. Lambda 表达式
4. 内部类
5. 枚举
6. 记录类

## 1. Java 中的抽象类
问: Java 中的抽象类

在Java中，抽象类（Abstract Class）是一种特殊的类，它不能被实例化，而是被设计为用作其他类的基类。抽象类可以包含抽象方法（方法没有实现，只有方法声明），以及普通的具体方法。其他类可以继承抽象类并实现其中的抽象方法，从而完成抽象类的功能。

以下是一些关键点来理解Java中的抽象类：

1. **抽象类的声明：** 使用`abstract`关键字来声明抽象类。抽象类可以有构造方法，但不能直接实例化。

   ```java
   abstract class AbstractClass {
       // 抽象方法
       public abstract void abstractMethod();
       
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

## 2. 匿名类
要介绍匿名类，首先我们需要了解 java 中的内部类
### 4.1 Inner Class
如果一个类定义在另一个类的内部，这个类就是Inner Class：

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

Inner Class 与普通类有个最大的不同，就是Inner Class的实例不能单独存在，必须依附于一个Outer Class的实例。这是因为Inner Class除了有一个this指向它自己，还***隐含地持有一个Outer Class实例**，可以用Outer.this访问这个实例。所以，实例化一个Inner Class不能脱离Outer实例。

除了能引用Outer实例外，还有一个额外的“特权”，就是可以修改Outer Class的private字段，因为Inner Class的作用域在Outer Class内部，所以能访问Outer Class的private字段和方法。

观察Java编译器编译后的.class文件可以发现，Outer类被编译为Outer.class，而Inner类被编译为Outer$Inner.class。

### 4.2 匿名类
匿名类是另一种定义 Inner Class 的方法。因此它与 Inner Class 一样隐含地持有Outer.this实例，并拥有Outer Class的private访问权限。

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

匿名类和Inner Class一样，可以访问Outer Class的private字段和方法。观察Java编译器编译后的.class文件可以发现，Outer类被编译为Outer.class，而匿名类被编译为Outer$1.class。如果有多个匿名类，Java编译器会将每个匿名类依次命名为Outer$1、Outer$2、Outer$3……

除了接口外，匿名类也完全可以继承自普通类。观察以下代码：

```java
import java.util.HashMap;

public class Main {
    public static void main(String[] args) {
        HashMap<String, String> map1 = new HashMap<>();
        HashMap<String, String> map2 = new HashMap<>() {}; // 匿名类!
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
其中:
1. map1是一个普通的HashMap实例，
2. map2是一个匿名类实例，只是该匿名类继承自HashMap
3. map3也是一个继承自HashMap的匿名类实例，并且添加了static代码块来初始化数据。

观察编译输出可发现Main$1.class和Main$2.class两个匿名类文件。

需要注意的是，**匿名类具有一些限制和注意事项，例如它不能有显式的构造函数，只能继承一个类或实现一个接口**，等等。此外，随着Java版本的演进，Java 8以后引入的Lambda表达式提供了更为简洁的方式来实现函数式接口，通常可以用于替代匿名类。

## 3. Lambda 表达式
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

### 3.1 Lambda 与匿名类
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

## 4. 内部类
InnerClass 和匿名类都属于内部类，前面都已经介绍。java 还有一种特殊的内部类叫 Static Nested Class，其与Inner Class类似，但是使用static修饰，称为静态内部类（Static Nested Class）：

### 4.1 静态内部类 Static Nested Class
用static修饰的内部类和Inner Class有很大的不同:
2. 它不再依附于Outer的实例，而是一个完全独立的类，因此无法引用Outer.this
2. 但它可以访问Outer的private静态字段和静态方法
3. 可以拥有自己的静态字段、静态方法和实例字段，与普通的类类似。
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
