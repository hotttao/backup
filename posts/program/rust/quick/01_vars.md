---
weight: 1
title: "Rust 变量与数据类型"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Rust 变量与数据类型"
featuredImage: 

tags: ["rust 语法"]
categories: ["Rust"]

lightgallery: true

toc:
  auto: false
---

## 1. 变量定义和声明
问: 以表格的方式，对比 java 和 rust 中变量声明的方式，包括变量推导的声明语法

下面是Java和Rust中变量声明的方式的比较表格，包括变量推导的声明语法：

| 功能              | Java                                      | Rust                                      |
|-------------------|-------------------------------------------|-------------------------------------------|
| 变量声明          | 使用关键字声明变量，需指定类型             | 使用关键字声明变量，可自动推导类型            |
| 类型推导          | 需要显式指定变量类型                       | 可以使用自动类型推导                          |
| var 关键字        | Java 10+ 引入 var 关键字                     | Rust 不使用 var 关键字                      |
| 类型注解          | 类型注解是必需的                           | 类型注解是可选的                            |
| 代码示例          |                                           |                                           |
| 非推导声明示例    | int count = 10;                           | let count: i32 = 10;                       |
| 推导声明示例      | var message = "Hello";                    | let message = "Hello";                      |



## 2. 常量以及类型转换

问: 以表格的形式对比 java 和 rust 中的常量定义、类型重命名、类型转换、枚举类型、自定义类型

下面是Java和Rust中常量定义、类型重命名、类型转换、枚举类型和自定义类型的比较表格：

| 功能            | Java                                  | Rust                                           |
|-----------------|---------------------------------------|------------------------------------------------|
| 常量定义        | 使用关键字`final`定义不可变变量         | 使用关键字`const`或`static`定义不可变变量        |
| 类型重命名      | 使用关键字`typedef`或`import`语句       | 使用关键字`type`定义类型别名                     |
| 类型转换        | 使用强制类型转换或自动类型转换           | 使用`as`关键字进行类型转换                        |
| 枚举类型        | 使用`enum`关键字定义枚举类型             | 使用`enum`关键字定义枚举类型                      |
| 自定义类型      | 使用`class`或`interface`定义自定义类型   | 使用`struct`和`enum`定义自定义类型                  |
| 代码示例        |                                       |                                                |
| 常量定义示例    | `final int MAX_VALUE = 100;`           | `const MAX_VALUE: i32 = 100;`                   |
| 类型重命名示例  | `typedef int MyInt;`                   | `type MyInt = i32;`                            |
| 类型转换示例    | `int num = (int) doubleValue;`         | `let num: i32 = double_value as i32;`          |
| 枚举类型示例    | ```jenum Color { RED, GREEN, BLUE }``` | ```enum Color { RED, GREEN, BLUE }```    |
| 自定义类型示例  | ```class Person { }```             | ```struct Person { }```                   |

请注意，上述表格提供了Java和Rust中一些常用功能的对比，但并不穷尽所有功能和细节。实际上，Java和Rust在这些功能上还有更多的特性和用法，因此在具体使用时，建议参考官方文档或相关资源以获取更准确和详细的信息。


## 3. 基础类型
### 3.1 数值类型的范围
问: 以表格形式列举 rust 中的中的基础数据类型，分为三列，分别是类型，长度，表示的含义，使用惯例的代码示例

下面是Rust中常见的基础数据类型的表格，包括类型、长度和表示的含义，以及使用惯例的代码示例：

| 类型                   | 长度           | 含义                                                         | 代码示例                                |
|------------------------|----------------|--------------------------------------------------------------|-----------------------------------------|
| bool                   | 1 字节         | 布尔类型，表示真或假                                          | ```let is_true = true;```               |
| u8                     | 1 字节         | 无符号 8 位整数（0 到 255）                                    | ```let number: u8 = 42;```              |
| i8                     | 1 字节         | 有符号 8 位整数（-128 到 127）                                 | ```let number: i8 = -42;```             |
| u16                    | 2 字节         | 无符号 16 位整数（0 到 65535）                                 | ```let number: u16 = 1000;```           |
| i16                    | 2 字节         | 有符号 16 位整数（-32768 到 32767）                            | ```let number: i16 = -1000;```          |
| u32                    | 4 字节         | 无符号 32 位整数（0 到 4294967295）                            | ```let number: u32 = 1000000;```        |
| i32                    | 4 字节         | 有符号 32 位整数（-2147483648 到 2147483647）                  | ```let number: i32 = -1000000;```       |
| u64                    | 8 字节         | 无符号 64 位整数（0 到 18446744073709551615）                  | ```let number: u64 = 1000000000;```     |
| i64                    | 8 字节         | 有符号 64 位整数（-9223372036854775808 到 9223372036854775807） | ```let number: i64 = -1000000000;```    |
| f32                    | 4 字节         | 单精度浮点数                                                  | ```let number: f32 = 3.14;```           |
| f64                    | 8 字节         | 双精度浮点数                                                  | ```let number: f64 = 3.14;```           |
| char                   | 4 字节         | 单个 Unicode 字符                                             | ```let ch = 'A';```                     |
| str                    | 动态长度       | 字符串 slice（不可变字符串）                                   | ```let message: &str = "Hello";```      |
| String                 | 动态长度       | 堆分配的可变字符串                                            | ```let message: String = String::from("Hello");``` |
| 数组                   | 固定长度       | 具有相同类型的固定长度序列                                     | ```let arr: [i32; 3] = [1, 2, 3];```    |
| 元组                   | 动态长度       | 具有不同类型的固定长度序列                                     | ```let tuple: (i32, f64, char) = (42, 3.14, 'A');``` |
| 指针                   | 平台相关       | 存储内存地址的类型                                             | ```let ptr: *const i32 = &number;```    |
| Option<T>              | 动态长度       | 表示可选值的类型                                               | ```let maybe_number: Option<i32> = Some(42);``` |
| Result<T, E>           | 动态长度       | 表示可能产生错误的操作的结果                                   | ```let result: Result<i32, String> = Ok(42);``` |




### 3.2 浮点数
问: rust 中的浮点数，有哪些特殊表示和使用方法，给出代码示例，包括如何表示无限大，表示NaN

在Rust中，浮点数类型（f32和f64）具有一些特殊的表示和使用方法，包括表示无限大和NaN（非数字）。下面是相关的代码示例：

1. 表示无限大：

```rust
let infinity: f64 = f64::INFINITY;
let neg_infinity: f32 = f32::NEG_INFINITY;

println!("无限大：{}", infinity);
println!("负无限大：{}", neg_infinity);
```

2. 表示NaN（非数字）：

```rust
let nan: f32 = f32::NAN;

println!("NaN：{}", nan);
```

此外，还可以使用浮点数的方法和特性来进行比较和处理，例如：

```rust
let x: f64 = 3.14;
let y: f64 = 2.71;

// 比较
if x > y {
    println!("x 大于 y");
} else if x < y {
    println!("x 小于 y");
} else {
    println!("x 等于 y");
}

// 四舍五入
let rounded: f64 = x.round();
println!("四舍五入后的值：{}", rounded);

// 取绝对值
let abs_value: f64 = y.abs();
println!("绝对值：{}", abs_value);

// 幂运算
let power: f64 = x.powf(2.0);
println!("平方：{}", power);
```


## 4. 隐式类型转换
问: rust 中的隐式类型转换

在Rust中，存在一些隐式的类型转换规则，使得某些类型之间的转换可以在不显式指定类型转换的情况下自动发生。以下是Rust中常见的隐式类型转换情况：

1. 数字类型的隐式类型转换：
   - 整数类型之间的隐式转换（例如：u8到u16、i32到i64等）。
   - 浮点数类型之间的隐式转换（例如：f32到f64）。

2. 引用和借用类型的隐式类型转换：
   - 不可变引用（&T）可以隐式转换为共享引用（&'a T，其中'a是合适的生命周期）。
   - 可变引用（&mut T）可以隐式转换为可变的共享引用（&'a mut T，其中'a是合适的生命周期）。

3. 标准库中的隐式类型转换：
   - 从字符串字面量到String类型的隐式转换。

下面是使用隐式类型转换的代码示例：

```rust
let x: u16 = 42;
let y: u32 = x; // 隐式将u16转换为u32

let mut value: i32 = 10;
let ref_value: &i32 = &value; // 隐式将可变引用转换为不可变引用

let str_literal: &str = "Hello, Rust!";
let string: String = str_literal.into(); // 隐式将字符串字面量转换为String类型
```

需要注意的是，Rust强调类型安全和显式的类型转换，因此隐式类型转换的情况相对有限。在某些情况下，需要显式地进行类型转换以确保代码的清晰性和安全性。

## 5. 包装数据类型
问: 以表格形式列举 rust 中的包装数据类型，并给出代码示例

下面是Rust中常见的包装数据类型以及相应的代码示例的表格：

| 类型                   | 描述                                                        | 代码示例                                          |
|------------------------|-------------------------------------------------------------|---------------------------------------------------|
| Option<T>              | 表示可能为空的值的类型                                        | ```let some_value: Option<i32> = Some(42);```     |
| Result<T, E>           | 表示可能产生错误的操作的结果                                  | ```let result: Result<i32, String> = Ok(42);```   |
| Vec<T>                 | 可变长度的动态数组                                           | ```let numbers: Vec<i32> = vec![1, 2, 3];```      |
| Box<T>                 | 堆分配的值的所有权包装器                                     | ```let boxed_value: Box<i32> = Box::new(42);```   |
| Rc<T>                  | 引用计数智能指针，用于多个所有者的共享所有权                   | ```let shared_value: Rc<i32> = Rc::new(42);```    |
| Arc<T>                 | 原子引用计数智能指针，用于多个线程的共享所有权                 | ```let atomic_shared_value: Arc<i32> = Arc::new(42);``` |
| Cell<T>                | 可变的内部可变容器，允许在不可变引用中修改值                   | ```let cell_value: Cell<i32> = Cell::new(42);``` |
| RefCell<T>             | 可变的内部可变容器，允许在运行时检查借用规则并修改值           | ```let ref_cell_value: RefCell<i32> = RefCell::new(42);``` |
| Mutex<T>               | 互斥锁，用于多线程间的同步                                   | ```let mutex_value: Mutex<i32> = Mutex::new(42);``` |
| RwLock<T>              | 读写锁，允许多个读者或单个写者对值进行并发访问                | ```let rw_lock_value: RwLock<i32> = RwLock::new(42);``` |

这些包装类型提供了一些额外的功能或语义，例如处理可选值、错误处理、所有权管理、并发访问等。它们在不同的场景下具有不同的用途和限制，因此在具体使用时，需要仔细考虑其特性和适用性。

## 6. 复合数据类型
问: 以表格形式对比 Java 和 Rust 中常见的复合数据类型，并给出代码示例：

下面是Java和Rust中常见的复合数据类型的对比表格，包括类型名称和代码示例：

| 类型               | Java                           | Rust                                      |
|--------------------|--------------------------------|-------------------------------------------|
| 数组               | ```int[] numbers = {1, 2, 3};``` | ```let numbers: [i32; 3] = [1, 2, 3];```   |
| 列表（动态数组）   | ```List<Integer> list = new ArrayList<>();``` | ```let list: Vec<i32> = vec![1, 2, 3];``` |
| 集合               | ```Set<String> set = new HashSet<>();``` | ```let set: HashSet<String> = HashSet::new();``` |
| 映射               | ```Map<String, Integer> map = new HashMap<>();``` | ```let map: HashMap<String, i32> = HashMap::new();``` |
| 元组               | 不适用                           | ```let tuple: (i32, f64, char) = (42, 3.14, 'A');``` |
| 结构体             | 不适用                           | ```struct Person { name: String, age: i32 }``` |
| 枚举               | ```enum Color { RED, GREEN, BLUE }``` | ```enum Color { RED, GREEN, BLUE }``` |
| 类                 | ```class Person { String name; int age; }``` | ```struct Person { name: String, age: i32 }``` |
| 泛型               | ```List<Integer> list = new ArrayList<>();``` | ```let list: Vec<i32> = Vec::new();``` |
| 包装类型（Optional） | ```Optional<Integer> optional = Optional.of(42);``` | ```let optional: Option<i32> = Some(42);``` |

