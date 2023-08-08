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

### 1.1 通配符
在Java泛型中,通配符可以用来表示某个类型的全部潜在子类型。主要有三种通配符语法:

1. ? 无限制通配符
2. ? extends 上界通配符
3. ? super 下界通配符  
4. 多界限<? extends T & Interface & ...>


```java
// 表示List内可以是任意泛型类型。
List<?>

// 表示只接受Number或其子类型,如Integer。
List<? extends Number>

// 表示只接受Integer或其父类型,如Number。
List<? super Integer>

// 类型参数被多个上下限界限。
public static <T extends Number & Comparable> void sort(List<T> list) {}
```


通配符使用注意事项:
- 通配符不能用于泛型类的定义,只用于方法。
- 上下界不能混合使用。
- 通配符泛型不能用于传参类型定义。
- 使用时需注意类型安全问题。
- 多界限合并多个约束条件  
- 不变类型等价于Object类型

总之,泛型通配符增强了泛型的表达力,通过扩展或限制泛型类型之间的关系,使代码更加明确和安全。需要谨慎使用以避免类型不兼容。

### 1.2 类型擦除
#### 类型擦除
Java泛型的类型擦除(type erasure)是Java泛型实现的关键机制,主要特点是:

1. 擦除类型参数: 编译时擦除泛型中的类型信息,替换为原始类型(通常是Object)。
2. 添加类型转换: 需要时插入类型转换代码(强制转换或桥接方法)。
3. 保留运行时权限: 不能在运行时获得泛型类型信息。

以下代码演示类型擦除的效果:

```java
// 泛型类定义
public class Cache<T> {
  Map<String, T> storage = new HashMap<>();
  // ...
}

// 擦除后代码等价为
public class Cache {
  Map storage = new HashMap();
  // ... 
}
```

#### 原始类型
在Java泛型的类型擦除过程中,泛型类型会被擦除为原始类型(raw type)。

原始类型(raw type)指的是擦除泛型信息后的类型,通常情况下是:
- 类的原始类型是Object
- 接口的原始类型是接口自己

例如:

```java
List<String> list = new ArrayList<>();
```

类型擦除后:

```java 
List list = new ArrayList();
```

这里List和ArrayList变为原始类型,其中:
- List的原始类型是List接口本身
- ArrayList的原始类型是Object

另外, primitive类型(int, boolean等)的原始类型是对应的包装类型(Integer, Boolean)。

#### 类型转换
类型T被擦除为原始类型,类中使用T的地方都替换为原始类型。在Java的类型擦除后,编译器需要通过自动添加类型转换的方式来保证类型安全,常见的两种方式:

1. 强制类型转换: 编译器会根据泛型类型信息,添加强制类型转换代码。
2. 桥接方法: 对于具有泛型的方法实现,编译器会生成桥接方法。

```java
// 泛型方法
public <T> T method(T param) {}

// 调用时 
String s = method("str"); 

// 编译后添加强制转换
String s = (String)method("str");
```


```java  
// 接口方法 
<T> T execute(T t);

// 泛型方法实现
public <String> String execute(String s) {
  return s; 
}

// 编译后添加桥接方法
public Object execute(Object o) {
  return execute((String) o);
}
```

所以强制转换和桥接方法都是类型擦除后,编译器自动添加的保证类型安全的机制。这是Java泛型的重要实现原理之一。
