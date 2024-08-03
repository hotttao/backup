---
weight: 1
title: "Java 流控"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 流程控制，作用域与表达式求值顺序"
featuredImage: 

tags: ["java 语法"]
categories: ["Java"]

lightgallery: true

toc:
  auto: false
---

## 1. 条件判断和循环
问: 以表格的方式，对比 java 和go 中条件和循环，表格中加入 java 的 for-each 语法 和 go 的 for range 语法

| 条件和循环语句 | Java                                                         | Go                                                            |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| if语句         | `if (x > 0) {`<br>`    System.out.println("x is positive");`<br>`} else if (x < 0) {`<br>`    System.out.println("x is negative");`<br>`} else {`<br>`    System.out.println("x is zero");`<br>`}` | `if x > 0 {`<br>`    fmt.Println("x is positive")`<br>`} else if x < 0 {`<br>`    fmt.Println("x is negative")`<br>`} else {`<br>`    fmt.Println("x is zero")`<br>`}` |
| for循环        | `for (int i = 0; i < 10; i++) {`<br>`    System.out.println(i);`<br>`}`<br>`for (int i : arr) {`<br>`    System.out.println(i);`<br>`}` | `for i := 0; i < 10; i++ {`<br>`    fmt.Println(i)`<br>`}`<br>`for _, num := range arr {`<br>`    fmt.Println(num)`<br>`}` |
| while和do-while循环   | `while (condition) {`<br>`    // 循环体`<br>`}`<br>`do {`<br>`    // 循环体`<br>`} while (condition);` | Go中没有`while`和`do-while`循环 |

需要注意的是，Java和Go中的条件和循环语句基本相同，但在语法上有一些差异。例如:
1. 在Java中使用for循环时可以使用for-each循环来遍历数组,而Go中则使用range关键字来遍历数组。
3. 在Java中有while和do-while循环，而在Go中则没有这两种循环语句。

另外 java 中判断引用类型的变量是否相等，==表示“引用是否相等”，要判断引用类型的变量内容是否相等，必须使用equals()方法。

## 2. switch
问: 对比一下 java 和 go 的 switch 语法，以表格形式展示

| `switch`语法 | Java                                                         | Go                                                            |
| ------------ | ------------------------------------------------------------ | ------------------------------------------------------------- |
| 基本语法     | <pre lang="java">switch (expression) {<br>    case value1:<br>        // 当expression的值等于value1时执行的代码块<br>        break;<br>    case value2:<br>        // 当expression的值等于value2时执行的代码块<br>        break;<br>    default:<br>        // 当expression的值都不等于任何一个case语句的值时执行的代码块<br>}</pre> | <pre lang="go">switch expression {<br>    case value1:<br>        // 当expression的值等于value1时执行的代码块<br>    case value2:<br>        // 当expression的值等于value2时执行的代码块<br>    default:<br>        // 当expression的值都不等于任何一个case语句的值时执行的代码块<br>}</pre> |
| 多个值的匹配 | <pre lang="java">switch (expression) {<br>    case value1:<br>    case value2:<br>        // 当expression的值等于value1或value2时执行的代码块<br>        break;<br>    default:<br>        // 当expression的值都不等于任何一个case语句的值时执行的代码块<br>}</pre> | <pre lang="go">switch expression {<br>    case value1, value2:<br>        // 当expression的值等于value1或value2时执行的代码块<br>    default:<br>        // 当expression的值都不等于任何一个case语句的值时执行的代码块<br>}</pre> |
| 表达式匹配   | <pre lang="java">switch (day) {<br>    case MONDAY, FRIDAY, SUNDAY:<br>        // 当day的值等于MONDAY、FRIDAY或SUNDAY时执行的代码块<br>        break;<br>    case TUESDAY:<br>        // 当day的值等于TUESDAY时执行的代码块<br>        break;<br>    case THURSDAY:<br>        // 当day的值等于THURSDAY时执行的代码块<br>        break;<br>    case SATURDAY:<br>    case WEDNESDAY:<br>        // 当day的值等于SATURDAY或WEDNESDAY时执行的代码块<br>        break;<br>    default:<br>        // 当day的值都不等于任何一个case语句的值时执行的代码块<br>}</pre> | <pre lang="go">switch day {<br>    case MONDAY, FRIDAY, SUNDAY:<br>        // 当day的值等于MONDAY、FRIDAY或SUNDAY时执行的代码块<br>    case TUESDAY:<br>        // 当day的值等于TUESDAY时执行的代码块<br>    case THURSDAY:<br>        // 当day的值等于THURSDAY时执行的代码块<br>    case SATURDAY, WEDNESDAY:<br>        // 当day的值等于SATURDAY或WEDNESDAY时执行的代码块<br>    default:<br>        // 当day的值都不等于任何一个case语句的值时执行的代码块<br>}</pre> |

需要注意的是，Java和Go中的`switch`语句有一些差异。在Java中，`switch`语句的每个`case`语句末尾必须使用`break`语句来结束该`case`语句，否则代码会继续执行下一个`case`语句的代码块。而在Go中，`case`语句的末尾不需要使用`break`语句，代码会自动跳出`switch`语句。此外，Go中的`switch`语句可以接受多个值的匹配，可以更加简洁地编写代码。

### 2.2 枚举 + switch
```java
public class EnumSwitchExample {
    // 定义一个枚举类型
    enum Day {
        MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY
    }

    public static void main(String[] args) {
        // 选择一个星期几
        Day day = Day.MONDAY;

        // 使用 switch 语句匹配多个值的情况
        switch (day) {
            case MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY:
                System.out.println("It's a weekday.");
                break;
            case SATURDAY, SUNDAY:
                System.out.println("It's a weekend.");
                break;
            default:
                System.out.println("Invalid day!");
        }
    }
}

```

### 2.2 java switch 新语法
从Java 12开始，switch语句升级为更简洁的表达式语法，使用类似模式匹配（Pattern Matching）的方法，保证只有一种路径会被执行，并且不需要break语句：

```java
public class Main {
    public static void main(String[] args) {
        String fruit = "apple";
        switch (fruit) {
        case "apple","test" -> System.out.println("Selected apple");
        case "pear" -> System.out.println("Selected pear");
        case "mango" -> {
            System.out.println("Selected mango");
            System.out.println("Good choice!");
        }
        default -> System.out.println("No fruit selected");
        }
    }
}
```

### 2.3 yield
yield 可以从 switch 内部返回一个值:

```java
public class Main {
    public static void main(String[] args) {
        String fruit = "orange";
        int opt = switch (fruit) {
            case "apple" -> 1;
            case "pear", "mango" -> 2;
            default -> {
                int code = fruit.hashCode();
                yield code; // switch语句返回值
            }
        };
        System.out.println("opt = " + opt);
    }
}
```

## 3. 数值运算的优先级

问: Java 中数据运算的运算符和优先级，以表格形式展示，优先级从上到下优先级从高到低，并给出代码示例

| 运算符 | 优先级 | 含义 | 代码示例 |
| --- | --- | --- | --- |
| () |  | 括号 | `(a + b) * c` |
| ++ -- |  | 前缀自增自减 | `++a` |
| ++ -- |  | 后缀自增自减 | `a++` |
| + - |  | 正负号 | `+a` |
| * |  | 乘法 | `a * b` |
| / |  | 除法 | `a / b` |
| % |  | 取模（求余） | `a % b` |
| + |  | 加法 | `a + b` |
| - |  | 减法 | `a - b` |
| << >> >>> |  | 位运算 | `a << b` |
| < <= > >= |  | 比较运算 | `a < b` |
| == != |  | 相等性比较 | `a == b` |
| & |  | 位与 | `a & b` |
| ^ |  | 位异或 | `a ^ b` |
| \| |  | 位或 | `a \| b` |
| && |  | 逻辑与 | `a && b` |
| \|\| |  | 逻辑或 | `a \|\| b` |
| ?: |  | 条件运算 | `a > b ? a : b` |
| = += -= *= /= %= <<= >>= &= ^= \|= |  | 赋值运算 | `a += b` |


需要注意的是
1. Java 中的 `==` 运算符比 `=` 运算符优先级高
2. Java 中的位运算符包括左移运算符 `<<`、右移运算符 `>>` 和无符号右移运算符 `>>>` 都比比较运算符和相等性比较运算符的优先级要高。

下面是一些示例代码：

```java
int a = 10, b = 5, c = 2;
int result = (a + b) * c;  // 使用括号改变优先级
int x = 5, y = ++x;        // 前缀自增运算符
int m = 5, n = m++;        // 后缀自增运算符
int p = +a, q = -b;        // 正负号运算符
int r = a * b, s = a / b, t = a % b;  // 乘除取模运算符
int u = a << 2, v = a >> 2, w = a >>> 2;  // 位运算符
boolean flag =a > b && c < d;  // 逻辑运算符
int max = a > b ? a : b;  // 条件运算符
a += b;  // 赋值运算符
```

Java还提供一个三元运算符b ? x : y，它根据第一个布尔表达式的结果，分别返回后续两个表达式之一的计算结果。示例：

```java
public class Main {
    public static void main(String[] args) {
        int n = -100;
        int x = n >= 0 ? n : -n;
        System.out.println(x);
    }
}
```

## 4. 表达式的求值顺序
