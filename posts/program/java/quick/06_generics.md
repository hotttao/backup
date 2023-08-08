---
weight: 1
title: "Java 泛型"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 如何使用泛型"
featuredImage: 

tags: ["java 语法"]
categories: ["Java"]

lightgallery: true

toc:
  auto: false
---

## 1. 泛型
Java中的泛型是一种类型参数化的机制，允许您编写具有通用性的类、接口和方法，以便在编译时指定具体的类型。泛型可以增加代码的重用性、类型安全性和可读性，同时减少类型转换的需要。

以下是Java中泛型的一些关键要点：

1. **泛型类：** 可以通过在类名后使用尖括号来声明类型参数。例如，`class ClassName<T>` 表示一个具有类型参数的泛型类。
2. **泛型方法：** 可以在普通类中定义泛型方法，以便在方法内部使用类型参数。类型参数可以在方法名前或返回类型前进行声明。
3. **通配符（Wildcards）：** 使用通配符可以增加灵活性，允许在参数或返回类型中使用不确定的类型。通配符分为上界通配符和无界通配符。
4. **类型擦除：** Java中的泛型是通过类型擦除来实现的。在运行时，泛型的类型参数信息会被擦除，以确保向后兼容性。
5. **类型参数限制：** 泛型可以限制类型参数的范围，例如指定参数为某个类的子类或实现了某个接口的类。
6. **泛型数组：** Java不支持创建泛型数组，因为数组在创建时必须具有确切的类型信息。


```java
class Box<T> {
    private T value;

    public Box(T value) {
        this.value = value;
    }

    public T getValue() {
        return value;
    }

    public void setValue(T value) {
        this.value = value;
    }
}

class Pair<K, V> {
    private K key;
    private V value;

    public Pair(K key, V value) {
        this.key = key;
        this.value = value;
    }

    public K getKey() {
        return key;
    }

    public V getValue() {
        return value;
    }
}

public class GenericsExample {
    // 泛型方法示例
    public static <E> void printArray(E[] array) {
        for (E element : array) {
            System.out.print(element + " ");
        }
        System.out.println();
    }

    // 通配符使用示例
    public static void processBox(Box<?> box) {
        // 通过通配符处理Box，可以读取值但不能写入新值
        Object value = box.getValue();
        System.out.println("Value in the box: " + value);
    }

    // 类型参数限制示例
    public static <T extends Number> double sumOfList(Box<T>[] list) {
        double sum = 0.0;
        for (Box<T> box : list) {
            sum += box.getValue().doubleValue();
        }
        return sum;
    }

    public static void main(String[] args) {
        // 泛型类示例
        Box<Integer> intBox = new Box<>(42);
        intBox.setValue(24);
        System.out.println("Value in the box: " + intBox.getValue()); // 输出：Value in the box: 24

        // 泛型方法示例
        String[] strArray = {"Hello", "Generics"};
        printArray(strArray); // 输出：Hello Generics

        // 通配符使用示例
        Box<String> stringBox = new Box<>("Hello");
        processBox(stringBox); // 输出：Value in the box: Hello

        // 类型参数限制示例
        Box<Integer>[] intBoxes = new Box[]{new Box<>(1), new Box<>(2), new Box<>(3)};
        double sum = sumOfList(intBoxes);
        System.out.println("Sum of integers: " + sum); // 输出：Sum of integers: 6.0

        // 类型擦除示例
        Box<String> stringBox2 = new Box<>("Type Erasure");
        Box rawBox = stringBox2;
        String value = (String) rawBox.getValue(); // 需要手动强制转换类型
        System.out.println("Value in the raw box: " + value); // 输出：Value in the raw box: Type Erasure
    }
}
```

在这个示例中，涵盖了泛型类的创建、泛型方法的使用、通配符的处理、类型参数限制、以及类型擦除的效果。这些都是Java泛型的核心概念和用法。通过这个示例，您可以更全面地了解Java中泛型的使用方法。