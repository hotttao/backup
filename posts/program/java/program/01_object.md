---
weight: 1
title: "Java 核心类"
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

## 1. Object
问: 以表格形式，输出 java Object 上定义的默认方法

| 方法签名                                | 描述  |
| --------------------------------------- | -------------------------- |
| `boolean equals(Object obj)`            | 比较对象是否相等。默认实现比较对象引用。          |
| `int hashCode()`                        | 返回对象的哈希码值。默认实现返回对象的内存地址的哈希码。       |
| `String toString()`                     | 返回对象的字符串表示。默认实现返回对象的类名，后跟 "@"，然后是对象的哈希码十六进制表示。|
| `Class<?> getClass()`                   | 返回对象的运行时类。                 |
| `void notify()`                         | 唤醒正在等待该对象的单个线程。                                                     |
| `void notifyAll()`                      | 唤醒正在等待该对象的所有线程。                              |
| `void wait()`                           | 导致当前线程等待，直到另一个线程调用 `notify()` 或 `notifyAll()` 方法。   |
| `void wait(long timeout)`                | 导致当前线程等待，最多等待 `timeout` 毫秒，直到另一个线程调用 `notify()` 或 `notifyAll()` 方法，或超时。   |
| `void wait(long timeout, int nanos)`     | 导致当前线程等待，最多等待 `timeout` 毫秒加上 `nanos` 纳秒，直到另一个线程调用 `notify()` 或 `notifyAll()` 方法，或超时。 |

## 2. String

### 2.1 String

### 2.2 StringBuilder

### 2.3 StringJoiner

## 3. 包装类型

## 4. JavaBean
JavaBean是一种符合命名规范的class，它通过getter和setter来定义属性；
```java
public class Person {
    private String name;
    private int age;

    public String getName() { return this.name; }
    public void setName(String name) { this.name = name; }

    public int getAge() { return this.age; }
    public void setAge(int age) { this.age = age; }

    // 读方法:
    public boolean isChild()
    // 写方法:
    public void setChild(boolean value)
}
```

JavaBean主要用来传递数据，即把一组数据组合成一个JavaBean便于传输。

### 4.1 枚举JavaBean属性
要枚举一个JavaBean的所有属性，可以直接使用Java核心库提供的Introspector：

```java
import java.beans.*;

public class Main {
    public static void main(String[] args) throws Exception {
        BeanInfo info = Introspector.getBeanInfo(Person.class);
        for (PropertyDescriptor pd : info.getPropertyDescriptors()) {
            System.out.println(pd.getName());
            System.out.println("  " + pd.getReadMethod());
            System.out.println("  " + pd.getWriteMethod());
        }
    }
}
```

## 5. 枚举类型
```java
enum Weekday {
    SUN, MON, TUE, WED, THU, FRI, SAT;
}
```

### 5.1 枚举类型与 class 区别
通过enum定义的枚举类，和其他的class有什么区别？

答案是没有任何区别。enum定义的类型就是class，只不过它有以下几个特点：
1. 定义的enum类型总是继承自java.lang.Enum，且无法被继承；
2. 只能定义出enum的实例，而无法通过new操作符创建enum的实例；
3. 定义的每个实例都是引用类型的唯一实例；
4. 可以将enum类型用于switch语句。

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

### 5.2 枚举类型的方法
因为enum是一个class，每个枚举的值都是class实例，因此，这些实例有一些方法：

以下是Java中枚举类型常用的方法的表格列举：

| 方法                   | 描述                                              |
|-----------------------|--------------------------------------------------|
| `values()`            | 返回枚举类型的所有枚举常量数组                      |
| `valueOf(String name)` | 返回指定名称的枚举常量                            |
| `name()`              | 返回枚举常量的名称，不可被覆写                     |
| `ordinal()`           | 返回枚举常量在枚举类型中的位置（从0开始计数）       |
| `compareTo(E other)`  | 比较当前枚举常量与指定枚举常量的顺序               |
| `toString()`          | 返回枚举常量的字符串表示                          |
| equals(Object other) | 判断是否为相同枚举值 |
| getDeclaringClass() | 返回枚举类的Class对象 |
| hashCode() | 返回枚举值的哈希值 |

### 5.3 用于 switch


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

## 6. 记录类
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

### 6.1 构造方法
编译器默认按照 record 声明的变量顺序自动创建一个构造方法，并在方法内给字段赋值。那我们如何自定义构造方法呢?

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