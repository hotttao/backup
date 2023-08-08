---
weight: 1
title: "Java 函数与异常控制"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 函数与异常控制"
featuredImage: 

tags: ["java 语法"]
categories: ["Java"]

lightgallery: true

toc:
  auto: false
---

虽然 Java 的新版本中加入了 Lambda 表达式，但是从根本上 Java 中函数不是一等公民，函数编程的支持本质上是通过接口实现的。 

## 1. 函数
问: 以表格的形式，对比 Go 和 Java 的函数充分考虑，有关函数的各种特性，包括不限于 定义、传参方式、闭包、匿名函数、异常处理、函数重载、匿名参数、函数回调、高阶函数、函数式编程、方法重写、函数指针和函数返回多个值，并给出代码示例

下面是 Go 和 Java 函数特性的综合对比表格，包括定义、传参方式、闭包、匿名函数、异常处理、函数重载、可变参数、函数类型、函数回调、高阶函数、函数式编程、方法重写、函数指针和函数返回多个值，并附带代码示例：

| 特性             | Go                                                              | Java                                                                 |
|-----------------|-----------------------------------------------------------------|----------------------------------------------------------------------|
| 定义             | 使用关键字 `func`                                               | 使用关键字 `public`、`private` 等修饰符声明方法                          |
| 传参方式         | 支持值传递和指针传递                                             | 仅支持值传递                                                          |
| 闭包             | 支持闭包                                                         | 支持闭包                                                              |
| 匿名函数         | 支持匿名函数                                                     | 支持匿名内部类                                                        |
| 异常处理         | 使用多返回值和错误类型处理错误                                     | 使用 try-catch 块捕获和处理异常                                       |
| 函数重载         | 不支持函数重载                                                   | 支持函数重载                                                          |
| 可变参数         | 支持可变参数                                                     | 支持可变参数                                                          |
| 函数类型         | 函数是一等公民，可以赋值给变量和作为参数传递                          | 函数不是一等公民，无法赋值给变量或作为参数传递                          |
| 函数回调         | 支持通过函数类型参数实现回调机制                                    | 支持通过接口实现回调机制                                                |
| 高阶函数         | 支持高阶函数（函数可以作为参数或返回值）                              | 不支持高阶函数                                                         |
| 函数式编程       | 支持函数式编程特性，如匿名函数和闭包                                 | 支持部分函数式编程特性，如Lambda表达式和Stream API                    |
| 方法重写         | 使用接收者声明方法，支持类型的方法调用                               | 使用类声明方法，通过实例调用方法                                        |
| 函数指针         | 支持函数指针                                                     | 不支持函数指针                                                        |
| 函数返回多个值   | 支持函数返回多个值                                               | 仅支持通过封装对象、数组或Map等方式返回多个值                           |


### 1.1 Go示例代码

```go
// 定义函数
func add(a, b int) int {
    return a + b
}

// 闭包示例
func getCounter() func() int {
    count := 0
    return func() int {
        count++
        return count
    }
}

// 匿名函数示例
func main() {
    greeting := func() {
        fmt.Println("Hello, World!")
    }
    greeting()
}

// 异常处理示例
func divide(a, b int) (int, error) {
    if b == 0 {
        return 0, errors.New("division by zero")
    }
    return a / b, nil
}
```

### 1.2 Java示例代码
#### 闭包（Closure）

```java
interface Closure {
    void execute();
}

public class Main {
    public static void main(String[] args) {
        int count = 0;
        Closure closure = new Closure() {
            public void execute() {
                count++;
                System.out.println("Closure count: " + count);
            }
        };

        closure.execute(); // Output: Closure count: 1
        closure.execute(); // Output: Closure count: 2
    }
}
```

#### 匿名函数（Anonymous Function）

```java
interface MathOperation {
    int operate(int a, int b);
}

public class Main {
    public static void main(String[] args) {
        MathOperation add = (a, b) -> a + b;
        int result = add.operate(2, 3);
        System.out.println("Result: " + result); // Output: Result: 5
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

// 匿名内部类示例
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

#### 异常处理（Exception Handling）

```java
public class Main {
    public static void main(String[] args) {
        try {
            int result = divide(10, 0);
            System.out.println("Result: " + result);
        } catch (ArithmeticException e) {
            System.out.println("Error: Division by zero");
        // 捕获多个异常
        } catch (IOException | NumberFormatException e) {
            System.out.println("IO error");
        } finally {
            System.out.println("END");
        }
    }

    public static int divide(int a, int b) {
        if (b == 0) {
            throw new ArithmeticException("Division by zero");
        }
        return a / b;
    }
}
```

某些情况下，可以没有catch，只使用try ... finally结构。例如：
```java
void process(String file) throws IOException {
    try {
        ...
    } finally {
        System.out.println("END");
    }
}
因为方法声明了可能抛出的异常，所以可以不写catch。
```

#### 函数重载（Function Overloading）

```java
public class Calculator {
    public int add(int a, int b) {
        return a + b;
    }

    public double add(double a, double b) {
        return a + b;
    }
}
```

#### 匿名参数（Varargs）

```java
public class Main {
    public static void main(String[] args) {
        printNames("Alice", "Bob", "Charlie");
        printNames("Dave", "Eve");
    }

    public static void printNames(String... names) {
        for (String name : names) {
            System.out.println(name);
        }
    }
}
```

#### 函数回调（Callback）

```java
interface Callback {
    void onCompletion();
}

public class Processor {
    public void process(Callback callback) {
        // 执行一些操作
        callback.onCompletion();
    }
}

public class Main {
    public static void main(String[] args) {
        Processor processor = new Processor();
        processor.process(() -> System.out.println("Processing complete"));
    }
}

// 函数回调
interface Multiplier {
    int multiply(int x);
}

public class Main {
    public static Multiplier multiplyBy(final int factor) {
        return new Multiplier() {
            public int multiply(int x) {
                return x * factor;
            }
        };
    }
}
```

#### 高阶函数（Higher-order Function）

```java
interface MathOperation {
    int operate(int a, int b);
}

public class Calculator {
    public int operate(int a, int b, MathOperation operation) {
        return operation.operate(a, b);
    }
}

public class Main {
    public static void main(String[] args) {
        Calculator calculator = new Calculator();
        MathOperation add = (a, b) -> a + b;
        int result = calculator.operate(2, 3, add);
        System.out.println("Result: " + result); // Output: Result: 5
    }
}
```

#### 函数式编程（Functional Programming）

```java
import java.util.Arrays;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5);

        // 使用Lambda表达式和Stream API进行函数式编程操作
        int sum = numbers.stream()
                .filter(n -> n % 2 == 0)
                .mapToInt(n -> n * 2)
                .sum();

        System.out.println("Sum: " + sum); // Output: Sum: 12
    }
}
```

#### 方法重写（Method Overriding）

```java
class Shape {
    public void draw() {
        System.out.println("Drawing a shape");
    }
}

class Circle extends Shape {
    @Override
    public void draw() {
        System.out.println("Drawing a circle");
    }
}

public class Main {
    public static void main(String[] args) {
        Shape shape = new Circle();
        shape.draw(); // Output: Drawing a circle
    }
}
```

函数指针（Function Pointer）和函数返回多个值：
Java不直接支持函数指针的概念。函数返回多个值的常见做法是使用封装对象、数组或Map等方式来返回多个值。
