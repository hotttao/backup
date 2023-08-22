---
weight: 1
title: "Java 函数式编程"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 函数式编程"
featuredImage: 

tags: ["java 语法"]
categories: ["Java"]

lightgallery: true

toc:
  auto: false
---

## 1. Lambda 表达式
从Java 8开始，我们可以用Lambda表达式替换单方法接口。

### 1.1 单方法接口
单方法接口，即一个接口只定义了一个方法：

1. Comparator
2. Runnable
3. Callable

我们把只定义了单方法的接口称之为FunctionalInterface，用注解@FunctionalInterface标记。例如，Callable接口：

```java
@FunctionalInterface
public interface Callable<V> {
    V call() throws Exception;
}
```

### 1.2 Lambda 表达式语法
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

### 1.3 方法引用
对于单方法接口，除了Lambda表达式，我们还可以直接传入方法引用。

#### 静态方法
如下，因为`Comparator<String>`接口定义的方法是`int compare(String, String)`，和静态方法`int cmp(String, String)` 方法签名是一致的。可以直接把方法名作为Lambda表达式传入。

```java
public class Main {
    public static void main(String[] args) {
        String[] array = new String[] { "Apple", "Orange", "Banana", "Lemon" };
        Arrays.sort(array, Main::cmp);
        System.out.println(String.join(", ", array));
    }

    static int cmp(String s1, String s2) {
        return s1.compareTo(s2);
    }
}
```

#### 实例方法
除了静态方法，我们还可以传入实例方法:

```java
public final class String {
    public int compareTo(String o) {
        ...
    }
}
```
能这么做是因为，实例方法有一个隐含的this参数，`String.compareTo()` 方法的定义相当于:

```java
public static int compareTo(String this, String o);
```

#### 构造方法
构造方法的引用写法是`类名::new`，其作为 Lambda表达式 通常有用在 Java 的 Stream API 上。

```java
import java.util.*;
import java.util.stream.*;

public class Main {
    public static void main(String[] args) {
        List<String> names = List.of("Bob", "Alice", "Tim");
        List<Person> persons = names.stream().map(Person::new).collect(Collectors.toList());
        System.out.println(persons);
    }
}

class Person {
    String name;
    public Person(String name) {
        this.name = name;
    }
    public String toString() {
        return "Person:" + this.name;
    }
}
```


## 2. Stream API
Java从8开始，不但引入了Lambda表达式，还引入了一个全新的流式API：Stream API。它位于java.util.stream包中。

### 2.1 Stream 初始化
在Java中,可以通过以下几种常见方式构造一个Stream:

1. 从集合构造

```java
List<Integer> list = Arrays.asList(1,2,3);
Stream<Integer> stream = list.stream(); 
```

2. 从数组或Collection构造

```java
String[] arr = new String[]{"a","b","c"}; 
Stream<String> stream = Arrays.stream(arr);
Stream<String> stream2 = List.of("X", "Y", "Z").stream();
```

3. 通过Stream的静态方法of()

```java
Stream<Integer> stream = Stream.of(1,2,3);
```

4. 创建无限流

```java
Stream<Integer> stream = Stream.iterate(0, i -> i + 1); 
```

5. 通过生成器generate()

```java
// 基于 Supplier 创建的Stream会不断调用Supplier.get()方法来不断产生下一个元素
Stream<String> s = Stream.generate(Supplier<String> sp);
// 使用 Lambda 表达式代替 Supplier
Stream<Double> stream = Stream.generate(Math::random);
```

6. 创建空流

```java
Stream<String> stream = Stream.empty();
```

7. 其他方法

```java
// Files类的lines()方法可以把一个文件变成一个Stream，每个元素代表文件的一行内容
try (Stream<String> lines = Files.lines(Paths.get("/path/to/file.txt"))) {
    ...
}

// 正则表达式的Pattern对象有一个splitAsStream()方法，可以直接把一个长字符串分割成Stream序列而不是数组
Pattern p = Pattern.compile("\\s+");
Stream<String> s = p.splitAsStream("The quick brown fox jumps over the lazy dog");
s.forEach(System.out::println);
```

#### 基本类型的 Stream
因为Java的范型不支持基本类型，所以我们无法用`Stream<int>`这样的类型，会发生编译错误。为了保存int，只能使用`Stream<Integer>`，但这样会产生频繁的装箱、拆箱操作。为了提高效率，Java标准库提供了`IntStream`、`LongStream`和`DoubleStream` 这三种使用基本类型的Stream:

```java
// 将int[]数组变为IntStream:
IntStream is = Arrays.stream(new int[] { 1, 2, 3 });
// 将Stream<String>转换为LongStream:
LongStream ls = List.of("1", "2", "3").stream().mapToLong(Long::parseLong);
```

### 2.2 Stream 的转换和输出
好的,我用表格的形式来整理Java Stream中的主要方法:

| 分类 | 方法 | 作用 |
|-|-|-|  
| 中间操作 | map | 元素映射转换 |
|  | flatMap | 元素流展开打平 |  
|  | filter | 元素过滤 |
|  | distinct | 去重 |
|  | sorted | 排序 |
|  | peek | 元素查看 |
|  | limit | 限制元素个数 |
|  | skip | 跳过元素 | 
|  | parallel | 并行执行 |
| 终止操作 | forEach | 遍历元素 |
|  | count | 统计元素个数 |
|  | collect | 收集为集合 |
|  | reduce | 归约为单值 |
|  | min/max | 最小最大值 | 
|  | anyMatch | 是否至少匹配一个元素 |
|  | allMatch | 是否全部匹配 | 
|  | findFirst | 获取第一个元素 |
| 收集器 | toList/Set/Map | 收集为集合 | 
|  | joining | 元素连接字符串 |
|  | groupingBy | 按属性分组 |

#### 中间操作
中间操作用于把一个 Stream 转换成另一个 Stream。以 map、filter 为例：

```java
<R> Stream<R> map(Function<? super T, ? extends R> mapper);

@FunctionalInterface
public interface Function<T, R> {
    // 将T类型转换为R:
    R apply(T t);
}

Stream<T> filter(Predicate<? super T> predicate);
@FunctionalInterface
public interface Predicate<T> {
    // 判断元素t是否符合条件:
    boolean test(T t);
}
```

#### 终止操作
终止操作有用于从 Stream 生成值，以 reduce/collect 为例：

reduce:

```java
T reduce(T identity, BinaryOperator<T> accumulator);

@FunctionalInterface
public interface BinaryOperator<T> {
    // Bi操作：两个输入，一个输出
    T apply(T t, T u);
}

import java.util.*;
public class Main {
    public static void main(String[] args) {
        // 按行读取配置文件:
        List<String> props = List.of("profile=native", "debug=true", "logging=warn", "interval=500");
        Map<String, String> map = props.stream()
                // 把k=v转换为Map[k]=v:
                .map(kv -> {
                    String[] ss = kv.split("\\=", 2);
                    return Map.of(ss[0], ss[1]);
                })
                // 把所有Map聚合到一个Map:
                .reduce(new HashMap<String, String>(), (m, kv) -> {
                    m.putAll(kv);
                    return m;
                });
        // 打印结果:
        map.forEach((k, v) -> {
            System.out.println(k + " = " + v);
        });
    }
}
```
