---
weight: 1
title: "Java 变量与数据类型"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 变量与数据类型"
featuredImage: 

tags: ["java 语法"]
categories: ["Java"]

lightgallery: true

toc:
  auto: false
---

## 1. 变量定义和声明
问: 以表格的方式，对比 java 和go 中变量声明的方式，包括变量推导的声明语法

| 变量声明方式 | Java                                            | Go                                            |
| ------------ | ----------------------------------------------- | --------------------------------------------- |
| 声明变量     | `int x;`<br>`String name;`                      | `var x int;`<br>`var name string;`            |
| 声明并初始化 | `int x = 10;`<br>`String name = "John";`        | `x := 10`<br>`var name string = "abc"`                 |
| 声明多个变量 | `int x = 10, y = 20, z = 30;`<br>`String name1, name2;` | `x, y, z := 10, 20, 30`<br>`var name1, name2 string` <br>`var b, f, s = true, 2.3, "four"` |
| 变量推导     | `var x = 10;`<br>`var name = "John";`           | `x := 10`<br>`name := "John"`                 |

可以看到在变量声明上 Java 的语法基本与 Go 的语法完全相反:
1. Java 变量声明的类型在前
2. 使用 var 关键词才能完成类型推到

## 2. 常量以及类型转换

问: 以表格的形式对比 java 和 go 中的常量定义、类型重命名、类型转换

| 功能 | Java | Go |
| --- | --- | --- |
| 常量定义 | 使用 `final` 关键字定义常量，例如 `final int MAX_VALUE = 100;` | 使用 `const` 关键字定义常量，例如 `const MAX_VALUE = 100` |
| 类型重命名 | 使用 `typedef` 关键字定义类型别名，例如 `typedef int MyInt;` | 使用 `type` 关键字定义类型别名，例如 `type MyInt int` |
| 类型转换 | 使用强制类型转换运算符，例如 `(int) doubleValue` | 使用类型转换函数，例如 `int(doubleValue)` |

总的来说，Java 和 Go 中常量定义、类型重命名和类型转换的使用方式有些不同。在常量定义方面，Java 使用 `final` 关键字，而 Go 使用 `const` 关键字。在类型重命名方面，Java 使用 `typedef` 关键字，而 Go 使用 `type` 关键字。在类型转换方面，Java 使用强制类型转换运算符，而 Go 使用类型转换函数。不同的语言在这些方面的设计和语法有所不同，但是它们都提供了类似的功能，使得开发人员能够方便地定义常量、重命名类型和执行类型转换。

## 3. 基础类型
### 3.1 数值类型的范围
问: 以表格形式列举 java 中的中的基础数据类型，分为三列，分别是类型，长度，表示的含义，使用惯例的代码示例

| 类型 | 长度 | 含义 | 代码示例 |
| --- | --- | --- | --- |
| byte | 1 字节 | 有符号整数，范围为 -128 到 127 | `byte b = 100;` |
| short | 2 字节 | 有符号整数，范围为 -32768 到 32767 | `short s = 1000;` |
| int | 4 字节 | 有符号整数，范围为 -2147483648 到 2147483647 | `int i = 100000;` |
| long | 8 字节 | 有符号整数，范围为 -9223372036854775808 到 9223372036854775807 | `long l = 10000000000L;` |
| float | 4 字节 | 单精度浮点数，范围为约 -3.4E38 到 +3.4E38 | `float f = 3.14159f;` |
| double | 8 字节 | 双精度浮点数，范围为约 -1.7E308 到 +1.7E308 | `double d = 3.141592653589793;` |
| boolean | 1 位 | 布尔值，只能取 true 和 false 两个值 | `boolean b = true;` 或 `boolean b = false;` |
| char | 2 字节 | Unicode 字符，范围为 \u0000 到 \uffff | `char c = 'A';` |

需要注意的是，在 Java 中定义整型变量时，如果不加任何后缀，默认类型为 `int`；如果需要定义 `long` 类型的变量，需要在数值后面加上 `L` 或 `l` 后缀。在定义浮点型变量时，如果不加任何后缀，默认类型为 `double`；如果需要定义 `float` 类型的变量，需要在数值后面加上 `F` 或 `f` 后缀。


### 3.2 浮点数
问: Java 中的浮点数，有哪些特殊表示和使用方法，给出代码示例，包括如何表示无限大，表示NaN

Java 中的浮点数有一些特殊表示和使用方法:
1. 表示无限大的方法是使用 `Double.POSITIVE_INFINITY` 或 `Double.NEGATIVE_INFINITY` 来表示正无穷和负无穷。
2. 表示 NaN 的方法是使用 `Double.NaN` 来表示。NaN 表示不是一个数字，通常出现在浮点数计算中出现了非法操作的情况下
3. NaN 不等于任何数，包括它本身。因此，不能使用 `==` 或 `!=` 运算符来比较 NaN 和其他数。如果需要判断一个数是否为 NaN，可以使用 `Double.isNaN()` 方法

```java
double a = 1.0 / 0.0;  // 正无穷
double b = -1.0 / 0.0;  // 负无穷
double c = Double.POSITIVE_INFINITY;  // 正无穷
double d = Double.NEGATIVE_INFINITY;  // 负无穷

double a = 0.0 / 0.0;  // NaN
double b = Double.NaN;  // NaN

double a = 0.0 / 0.0;  // NaN
double b = 1.0 / 0.0;  // 正无穷
System.out.println(Double.isNaN(a));  // 输出 true
System.out.println(Double.isNaN(b));  // 输出 false
```

另外，由于浮点数采用二进制表示，无法精确地表示某些十进制数，因此在进行浮点数计算时可能会产生一些误差。为了避免这种误差，可以使用 `BigDecimal` 类来进行高精度计算。

```java
import java.math.BigDecimal;

public class BigDecimalExample {
    public static void main(String[] args) {
        BigDecimal a = new BigDecimal("0.1");
        BigDecimal b = new BigDecimal("0.2");
        BigDecimal c = a.add(b);  // 加法
        BigDecimal d = a.multiply(b);  // 乘法
        BigDecimal e = a.divide(b, 10, BigDecimal.ROUND_HALF_UP);  // 除法，保留 10 位小数

        System.out.println(c);  // 输出 0.3
        System.out.println(d);  // 输出 0.02
        System.out.println(e);  // 输出 0.5000000000
    }
}
```

## 4. 隐式类型转换
在 Java 中，隐式类型转换（implicit type conversion）是指将一个数据类型自动转换为另一个数据类型，而无需明确地进行类型转换操作。以下是 Java 中的一些常见隐式类型转换：

1. byte → short → int → long → float → double
   在数值类型之间，从小到大的顺序进行隐式转换。例如，将 byte 类型的值赋给 int 类型的变量时，编译器会自动将 byte 类型转换为 int 类型。
2. char → int
   将 char 类型隐式转换为 int 类型。例如，将 char 类型的值与 int 类型的值相加时，编译器会自动将 char 类型的值转换为 int 类型。
3. 自动装箱和拆箱
   自动装箱是指将基本数据类型自动转换为对应的包装类类型，例如将 int 类型的值赋给 Integer 类型的变量时，编译器会自动将 int 类型转换为 Integer 类型。自动拆箱是指将包装类类型自动转换为对应的基本数据类型，例如将 Integer 类型的值与 int类型的值相加时，编译器会自动将 Integer 类型转换为 int 类型。
4. 子类 → 父类
   将子类类型隐式转换为父类类型。例如，将子类对象赋给父类类型的变量时，编译器会自动将子类对象转换为父类类型。

## 5. 包装数据类型
与 Go 明显不同，但与 Python 类似，Java 中所有的基础类型都有与之对应的包装类型。基础类型与基础类型的包装类型之间的区别是，包装类型是一个类，这个类上有很多方法；而基础类型仅仅表示数值。

以下是 Java 中的包装类型和对应的基本类型的枚举和代码示例：

| 包装类型   | 对应的基本类型 | 代码示例                                                     |
| ---------- | -------------- | ------------------------------------------------------------ |
| Boolean    | boolean        | Boolean b1 = true;<br>Boolean b2 = new Boolean(false);       |
| Byte       | byte           | Byte b = 127;<br>Byte b2 = new Byte((byte)127);              |
| Short      | short          | Short s = 32767;<br>Short s2 = new Short((short)32767);      |
| Integer    | int            | Integer i = 10;<br>Integer i2 = new Integer(10);             |
| Long       | long           | Long l = 100000L;<br>Long l2 = new Long(100000L);            |
| Float      | float          | Float f = 3.14f;<br>Float f2 = new Float(3.14f);              |
| Double     | double         | Double d = 3.1415926;<br>Double d2 = new Double(3.1415926);   |
| Character  | char           | Character c = 'a';<br>Character c2 = new Character('a');     |

需要注意的是，Java 中的包装类型是为了将基本类型转换为对象而存在的，它们提供了一些基本操作，例如转换值、比较值等。在使用包装类型时，需要注意自动装箱和拆箱的特性。自动装箱是指将基本类型自动转换为对应的包装类型；自动拆箱是指将包装类型自动转换为对应的基本类型。例如，可以使用下面的代码将 Integer 类型的值赋给 int 类型的变量：

```java
Integer i = 10;
int j = i;
```

这里的 i 是一个 Integer 类型的对象，但是可以直接将它赋给 int 类型的变量 j，这是因为 Java 中支持自动拆箱的特性。同样的，也可以使用下面的代码将 int 类型的值赋给 Integer 类型的变量：

```java
int k = 20;
Integer l = k;
```

这里的 k 是一个 int 类型的变量，但是可以直接将它赋给 Integer 类型的变量 l，这是因为 Java 中支持自动装箱的特性。在使用包装类型时，需要注意自动装箱和拆箱的操作可能会影响程序的性能，因此需要根据具体的情况进行选择和使用。

## 6. 复合数据类型
以下是 Java 和 Go 中常见的复合数据类型的对比以及对应的代码示例：

| 数据类型   | 描述                                                         | Java                                                         | Go                                                                 |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| 数组       | 一组同类型的数据元素的集合                                   | int[] arr = {1, 2, 3};<br>String[] strArr = new String[]{"Hello", "World"}; | var arr = []int{1, 2, 3}<br>strArr := []string{"Hello", "World"} |
| 切片       | 动态数组，可以根据需要动态增长或缩小                       | 不支持                                                       | arr := []int{1, 2, 3}<br>strArr := []string{"Hello", "World"}<br>arr = append(arr, 4) |
| 映射       | 存储键值对的集合，每个键唯一，值可以重复                   | Map<Integer, String> map = new HashMap<>();<br>map.put(1, "Hello");<br>map.put(2, "World"); | var map map[int]string<br>map = make(map[int]string)<br>map[1] = "Hello"<br>map[2] = "World" |
| 结构体     | 一种自定义的数据类型，包含多个字段，每个字段可以是不同的数据类型 | public class Person {<br>    private String name;<br>    private int age;<br>    public Person(String name, int age) {<br>        this.name = name;<br>        this.age = age;<br>    }<br>} | type Person struct {<br>    name string<br>    age int<br>}<br>func main() {<br>    p := Person{name: "Tom", age: 18}<br>} |

### 6.1 java 中的数组实现
问: Java 中有哪些数组实现，以表格形式对比他们的特点

在Java中，有多种数组实现，包括常见的数组类型和一些特殊的数组实现。下面以表格形式对比它们的特点：

| 数组实现          | 描述                                                         | 特点                                                                             |
| ----------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 原生数组          | Java语言提供的基本数组类型。                                   | - 固定长度，创建后无法改变大小。<br>- 可以存储任意类型的元素。<br>- 直接访问元素的性能最佳。<br>- 不具备扩容和自动管理内存的能力。 |
| ArrayList         | 基于动态数组实现的类，提供动态调整大小的功能。                   | - 动态调整大小，自动扩容。<br>- 支持快速的随机访问和插入/删除操作。<br>- 线程不安全。     |
| LinkedList        | 基于双向链表实现的类，支持动态添加和删除元素。                   | - 动态调整大小，不需要连续的内存空间。<br>- 插入和删除元素效率高。<br>- 随机访问性能较差。<br>- 线程不安全。 |
| CopyOnWriteArrayList | 基于数组实现的线程安全类，适用于读多写少的场景。                 | - 写操作会创建一个新的数组，不影响正在进行的读操作。<br>- 适用于并发读多写少的情况。 |
| Vector            | 基于数组实现的线程安全类，类似于ArrayList。                       | - 动态调整大小，自动扩容。<br>- 所有方法都使用`synchronized`关键字进行同步。<br>- 线程安全，但性能相对较低。 |

示例代码：

1. 原生数组示例：
```java
int[] array = new int[5]; // 声明一个长度为5的整数数组
array[0] = 1; // 设置数组元素的值
int value = array[0]; // 获取数组元素的值
```

2. ArrayList示例：
```java
import java.util.ArrayList;

public class ArrayListExample {
    public static void main(String[] args) {
        ArrayList<Integer> arrayList = new ArrayList<>();
        arrayList.add(1); // 添加元素
        int value = arrayList.get(0); // 获取元素
        arrayList.remove(0); // 移除元素
    }
}
```

3. LinkedList示例：
```java
import java.util.LinkedList;

public class LinkedListExample {
    public static void main(String[] args) {
        LinkedList<String> linkedList = new LinkedList<>();
        linkedList.add("Apple");
        linkedList.add("Banana");
        linkedList.add("Orange");
        String firstElement = linkedList.getFirst(); // 获取首个元素
        linkedList.removeLast(); // 移除最后一个元素
    }
}
```

4. CopyOnWriteArrayList示例：
```java
import java.util.concurrent.CopyOnWriteArrayList;

public class CopyOnWriteArrayListExample {
    public static void main(String[] args) {
        Copy

OnWriteArrayList<String> list = new CopyOnWriteArrayList<>();
        list.add("Apple");
        list.add("Banana");
        list.add("Orange");
        String element = list.get(0);
        list.remove(2);
    }
}
```

5. Vector示例：
```java
import java.util.Vector;

public class VectorExample {
    public static void main(String[] args) {
        Vector<Integer> vector = new Vector<>();
        vector.add(1);
        vector.add(2);
        vector.add(3);
        int element = vector.get(0);
        vector.remove(2);
    }
}
```

### 6.2 java 中的哈希实现
问: Java 中有哪些 HashMap 实现，以表格形式对比他们的特点

在Java中，有多个HashMap的实现，包括常见的HashMap、LinkedHashMap和ConcurrentHashMap。下面以表格形式对比它们的特点：

| HashMap 实现        | 描述                                                                                         | 特点                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| HashMap             | 基于哈希表的Map实现，不保证迭代顺序。                                                         | - 快速的插入和查找操作。<br>- 不保证元素的顺序。<br>- 可能存在哈希冲突。<br>- 非线程安全。 |
| LinkedHashMap       | 基于哈希表和双向链表的Map实现，按插入顺序或访问顺序迭代元素。                                   | - 具有HashMap的所有特点。<br>- 迭代顺序可选择按插入顺序或访问顺序（LRU近似顺序）。            |
| ConcurrentHashMap  | 线程安全的Map实现，支持高并发操作。                                                          | - 在读操作上提供并发访问性能。<br>- 使用分段锁机制来实现线程安全。<br>- 适用于多线程环境。    |

示例代码：

1. HashMap示例：
```java
import java.util.HashMap;

public class HashMapExample {
    public static void main(String[] args) {
        HashMap<String, Integer> hashMap = new HashMap<>();
        hashMap.put("Apple", 1);
        hashMap.put("Banana", 2);
        hashMap.put("Orange", 3);
        
        System.out.println(hashMap.get("Banana")); // 输出: 2
        System.out.println(hashMap.containsKey("Orange")); // 输出: true
    }
}
```

2. LinkedHashMap示例：
```java
import java.util.LinkedHashMap;

public class LinkedHashMapExample {
    public static void main(String[] args) {
        LinkedHashMap<String, Integer> linkedHashMap = new LinkedHashMap<>();
        linkedHashMap.put("Apple", 1);
        linkedHashMap.put("Banana", 2);
        linkedHashMap.put("Orange", 3);
        
        System.out.println(linkedHashMap.get("Banana")); // 输出: 2
        System.out.println(linkedHashMap.containsKey("Orange")); // 输出: true
    }
}
```

3. ConcurrentHashMap示例：
```java
import java.util.concurrent.ConcurrentHashMap;

public class ConcurrentHashMapExample {
    public static void main(String[] args) {
        ConcurrentHashMap<String, Integer> concurrentHashMap = new ConcurrentHashMap<>();
        concurrentHashMap.put("Apple", 1);
        concurrentHashMap.put("Banana", 2);
        concurrentHashMap.put("Orange", 3);
        
        System.out.println(concurrentHashMap.get("Banana")); // 输出: 2
        System.out.println(concurrentHashMap.containsKey("Orange")); // 输出: true
    }
}
```
