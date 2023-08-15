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
### 1.1 泛型是什么
所谓泛型，就是定义一种模板，以 `ArrayList<T>` 为例:

```java
public class ArrayList<T> implements List<T> {
    private T[] array;
    private int size;
    public void add(T e) {...}
    public void remove(int index) {...}
    public T get(int index) {...}
}
```
编写一次模版，可以创建任意类型的ArrayList:

```java
ArrayList<String> strList = new ArrayList<String>();
ArrayList<Float> floatList = new ArrayList<Float>();
ArrayList<Integer> intList = new ArrayList<Integer>();
```


以下是Java中泛型的一些关键要点：

1. **泛型类：** 可以通过在类名后使用尖括号来声明类型参数。例如，`class ClassName<T>` 表示一个具有类型参数的泛型类。
2. **泛型方法：** 可以在普通类中定义泛型方法，以便在方法内部使用类型参数。类型参数可以在方法名前或返回类型前进行声明。
3. **通配符（Wildcards）：** 使用通配符可以增加灵活性，允许在参数或返回类型中使用不确定的类型。通配符分为上界通配符和无界通配符。
4. **类型擦除：** Java中的泛型是通过类型擦除来实现的。在运行时，泛型的类型参数信息会被擦除，以确保向后兼容性。
5. **类型参数限制：** 泛型可以限制类型参数的范围，例如指定参数为某个类的子类或实现了某个接口的类。
6. **泛型数组：** Java不支持创建泛型数组，因为数组在创建时必须具有确切的类型信息。

## 2. 泛型定义
下面是 java 中泛型定义的一些示例:

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

        // 静态泛型方法应该使用其他类型区分:
    public static <S, T> Pair<S, T> create(S first, T last) {
        return new Pair<K>(first, last);
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

### 2.1 通配符
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

### 2.2 泛型接口
还可以在接口中使用泛型:

```java
public interface Comparable<T> {
    /**
     * 返回负数: 当前实例比参数o小
     * 返回0: 当前实例与参数o相等
     * 返回正数: 当前实例比参数o大
     */
    int compareTo(T o);
}

class Person implements Comparable<Person> {
    public int compareTo(Person other) {
        return this.name.compareTo(other.name);
    }
}
```

## 3. 泛型使用
首先如果泛型在使用时，如果不定义泛型类型，泛型类型实际上是 Object，在使用时需要添加强制的类型转换:

```java
// 编译器警告:
// 只能把<T>当作Object使用
List list = new ArrayList();
list.add("Hello");
list.add("World");
String first = (String) list.get(0);
String second = (String) list.get(1);
```

在 Java 标准库中 `ArrayList<T>`实现了`List<T>`接口，它可以向上转型为`List<T>`：

```java
public class ArrayList<T> implements List<T> {
    ...
}

List<String> list = new ArrayList<String>();
```

但是要特别注意：不能把`ArrayList<Integer>`向上转型为`ArrayList<Number>`或`List<Number>`。原因是:

```java
// 创建ArrayList<Integer>类型：
ArrayList<Integer> integerList = new ArrayList<Integer>();
// 添加一个Integer：
integerList.add(new Integer(123));
// “向上转型”为ArrayList<Number>：
ArrayList<Number> numberList = integerList;
// 添加一个Float，因为Float也是Number：
numberList.add(new Float(12.34));
// 从ArrayList<Integer>获取索引为1的元素（即添加的Float）：
Integer n = integerList.get(1); // ClassCastException!
```



## 3. 类型擦除
Java语言的泛型实现方式是擦拭法（Type Erasure）。所谓擦拭法是指，虚拟机对泛型其实一无所知，所有的工作都是编译器做的，主要特点是:
1. 擦除类型参数: 编译时擦除泛型中的类型信息,替换为原始类型(通常是Object)。
2. 添加类型转换: 需要时插入类型转换代码(强制转换或桥接方法)。
3. 保留运行时权限: 不能在运行时获得泛型类型信息。

以下代码演示类型擦除的效果:

```java
// 泛型类定义
public class Pair<T> {
    private T first;
    private T last;
    public Pair(T first, T last) {
        this.first = first;
        this.last = last;
    }
}

// 擦除后代码等价为
public class Pair {
    private Object first;
    private Object last;
    public Pair(Object first, Object last) {
        this.first = first;
        this.last = last;
    }
}

// 使用泛型编译器看到的代码：
Pair<String> p = new Pair<>("Hello", "world");
String first = p.getFirst();

// 虚拟机执行的代码并没有泛型：
Pair p = new Pair("Hello", "world");
String first = (String) p.getFirst();
```

在Java泛型的类型擦除过程中,泛型类型会被擦除为原始类型(raw type)。原始类型(raw type)指的是擦除泛型信息后的类型,通常情况下是:
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

### 3.1 类型转换
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

### 3.2 java 泛型的局限
#### 局限一
`<T>`不能是基本类型，例如int，因为实际类型是Object，Object类型无法持有基本类型：

```java
Pair<int> p = new Pair<>(1, 2); // compile error!
```

#### 局限二
无法取得带泛型的Class。观察以下代码：

```java
Pair<String> p1 = new Pair<>("Hello", "world");
Pair<Integer> p2 = new Pair<>(123, 456);
Class c1 = p1.getClass();
Class c2 = p2.getClass();
System.out.println(c1==c2); // true
System.out.println(c1==Pair.class); // true
```

因为T是Object，我们对`Pair<String>`和`Pair<Integer>`类型获取Class时，获取到的是同一个Class，也就是Pair类的Class。所有泛型实例，无论T的类型是什么，getClass()返回同一个Class实例，因为编译后它们全部都是`Pair<Object>`。

#### 局限三
无法判断带泛型的类型：

```java
Pair<Integer> p = new Pair<>(123, 456);
// Compile error:
if (p instanceof Pair<String>) {
}
```

原因和前面一样，并不存在Pair<String>.class，而是只有唯一的Pair.class。

### 局限四
不能实例化T类型：

```java
public class Pair<T> {
    private T first;
    private T last;
    public Pair() {
        // Compile error:
        first = new T();
        last = new T();
    }
}

// 上述代码无法通过编译，因为构造方法的两行语句：
first = new T();
last = new T();

// 擦拭后实际上变成了，显然编译器要阻止这种类型不对的代码。
first = new Object();
last = new Object();
```

要实例化T类型，我们必须借助额外的`Class<T>`参数：

```java
public class Pair<T> {
    private T first;
    private T last;
    public Pair(Class<T> clazz) {
        first = clazz.newInstance();
        last = clazz.newInstance();
    }
}

// 上述代码借助Class<T>参数并通过反射来实例化T类型，使用的时候，也必须传入Class<T>。例如：
Pair<String> pair = new Pair<>(String.class);
```

#### 局限五
不恰当的覆写方法

有些时候，一个看似正确定义的方法会无法通过编译。例如：

```java
// 编译错误
public class Pair<T> {
    public boolean equals(T t) {
        return this == t;
    }
}
// 正确写法，换个方法名
public class Pair<T> {
    public boolean same(T t) {
        return this == t;
    }
}
```

这是因为，定义的equals(T t)方法实际上会被擦拭成equals(Object t)，而这个方法是继承自Object的，编译器会阻止一个实际上会变成覆写的泛型方法定义。

### 3.3 泛型继承
一个类可以继承自一个泛型类:

```java
public class IntPair extends Pair<Integer> {
}

// 使用的时候，因为子类IntPair并没有泛型类型，所以，正常使用即可：
IntPair ip = new IntPair(1, 2);
```

前面讲了，我们无法获取`Pair<T>`的T类型，即给定一个变量`Pair<Integer>` p，无法从p中获取到Integer类型。但是，在父类是泛型类型的情况下，编译器就必须把类型T（对IntPair来说，也就是Integer类型）保存到子类的class文件中，不然编译器就不知道IntPair只能存取Integer这种类型。

在继承了泛型类型的情况下，子类可以获取父类的泛型类型。获取父类的泛型类型代码比较复杂：

```java
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;

public class Main {
    public static void main(String[] args) {
        Class<IntPair> clazz = IntPair.class;
        Type t = clazz.getGenericSuperclass();
        if (t instanceof ParameterizedType) {
            ParameterizedType pt = (ParameterizedType) t;
            Type[] types = pt.getActualTypeArguments(); // 可能有多个泛型类型
            Type firstType = types[0]; // 取第一个泛型类型
            Class<?> typeClass = (Class<?>) firstType;
            System.out.println(typeClass); // Integer
        }
    }
```

因为Java引入了泛型，所以，只用Class来标识类型已经不够了。实际上，Java的类型系统结构如下：
```shell

                      ┌────┐
                      │Type│
                      └────┘
                         ▲
                         │
   ┌────────────┬────────┴─────────┬───────────────┐
   │            │                  │               │
┌─────┐┌─────────────────┐┌────────────────┐┌────────────┐
│Class││ParameterizedType││GenericArrayType││WildcardType│
└─────┘└─────────────────┘└────────────────┘└────────────┘
```

以下是这些类型的解释：
1. **Class 类：** 
    - `java.lang.Class` 是 Java 类型系统的基础，用于表示类、接口、枚举类等的类型。
    - 每个类在运行时都有一个对应的 `Class` 对象，可以使用这个对象来获取类的信息，如名称、字段、方法等。
2. **ParameterizedType 接口：** 
    - `java.lang.reflect.ParameterizedType` 表示带有参数的类型，即泛型类型。
    - 例如，`List<String>` 中的 `List` 就是一个泛型类型，`ParameterizedType` 用于表示这种类型并提供类型参数的信息。
3. **GenericArrayType 接口：** 
    - `java.lang.reflect.GenericArrayType` 表示数组类型，其中数组的元素可以是普通类型或者泛型类型。
    - 它允许您获取数组元素类型的信息，包括维度。
4. **WildcardType 接口：** 
    - `java.lang.reflect.WildcardType` 表示通配符类型，通常在泛型类型中使用。
    - 它表示一个类型参数可以是某个特定类型或其子类型。通配符类型可以是无界的（例如 `?`）或有界的（例如 `? extends Number`）。
