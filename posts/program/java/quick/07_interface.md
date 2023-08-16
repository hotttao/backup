---
weight: 1
title: "Java 接口"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 接口"
featuredImage: 

tags: ["java 语法"]
categories: ["Java"]

lightgallery: true

toc:
  auto: false
---
## 1. 接口
### 1.1 java 中的接口
java 中:
1. 一个类只能继承自另一个类，不能从多个类继承。但是，一个类可以实现多个interface
2. 接口定义的所有方法默认都是public abstract的，所以这两个修饰符不需要写出来（写不写效果都一样）
3. interface是一个纯抽象类，所以它不能定义实例字段。但是，interface是可以有静态字段的，并且静态字段必须为final类型

```java
public interface Person {
    public static final int MALE = 1;
    public static final int FEMALE = 2;
}
```

因为interface的字段只能是public static final类型，所以我们可以把这些修饰符都去掉，上述代码可以简写为：

```java
public interface Person {
    // 编译器会自动加上public statc final:
    int MALE = 1;
    int FEMALE = 2;
}
```

### 1.2 java 接口的定义
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

Java 中接口定义的所有方法默认都是public abstract的，所以这两个修饰符不需要写出来。

### 1.3 接口与抽象基类
合理设计interface和abstract class的继承关系，可以充分复用代码。可以参考Java的集合类定义的一组接口、抽象类以及具体子类的继承关系：

```java
┌───────────────┐
│   Iterable    │
└───────────────┘
        ▲                ┌───────────────────┐
        │                │      Object       │
┌───────────────┐        └───────────────────┘
│  Collection   │                  ▲
└───────────────┘                  │
        ▲     ▲          ┌───────────────────┐
        │     └──────────│AbstractCollection │
┌───────────────┐        └───────────────────┘
│     List      │                  ▲
└───────────────┘                  │
              ▲          ┌───────────────────┐
              └──────────│   AbstractList    │
                         └───────────────────┘
                                ▲     ▲
                                │     │
                                │     │
                     ┌────────────┐ ┌────────────┐
                     │ ArrayList  │ │ LinkedList │
                     └────────────┘ └────────────┘

```

在使用的时候，实例化的对象永远只能是某个具体的子类，但总是通过接口去引用它，因为接口比抽象类更抽象：

```java
List list = new ArrayList(); // 用List接口引用具体子类的实例
Collection coll = list; // 向上转型为Collection接口
Iterable it = coll; // 向上转型为Iterable接口
```