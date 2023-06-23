---
weight: 1
title: "Rust 复合数据类型"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Rust 所有权"
featuredImage: 

tags: ["rust 语法"]
categories: ["Rust"]

lightgallery: true

toc:
  auto: false
---

## 1. 字符串
在 Rust 中有多种字符串类型:
1. Rust在语言核心部分只有一种字符串类型，那就是字符串切片str，它通常以借用的形式（&str）出现。字符串切片是一些指向存储在别处的UTF-8编码字符串的引用。例如，字符串字面量的数据被存储在程序的二进制文件中，而它们本身也是字符串切片的一种。
2. String类型被定义在了Rust标准库中而没有被内置在语言的核心部分。当Rust开发者们提到“字符串”时，他们通常指的是String与字符串切片&str这两种类型，他们都采用了UTF-8编码。
3. Rust的标准库中同时包含了其他一系列的字符串类型，比如OsString、OsStr、CString及CStr。某些第三方库甚至还提供了更多用于存储字符串数据的选择。类型名结尾的 String或Str 表明类型提供的是所有者版本还是借用者版本。

### 1.1 String 实现
问: 以简化代码的形式，描述 rust String 的数据结构

Rust 中的 `String` 数据结构可以简化为以下代码：

```rust
pub struct String {
    ptr: *mut u8,  // 指向字符串数据的指针
    len: usize,    // 字符串长度
    capacity: usize,  // 字符串当前分配的容量
}
```

在这个简化的表示中，`String` 结构体包含了三个字段：

- `ptr`：一个指向堆上存储字符串数据的指针，类型为 `*mut u8`。通过这个指针，可以访问字符串的字节数据。
- `len`：一个表示字符串的实际长度的字段，类型为 `usize`。它表示字符串的有效字符数，不包括结尾的空字符。
- `capacity`：一个表示当前分配的堆内存容量的字段，类型为 `usize`。它表示字符串目前可以容纳的最大字符数，超过这个容量时，需要重新分配更大的内存。

### 1.2 String 用法
问: 使用代码示例，列举 rust String 的用法

当涉及 Rust 中的字符串（String）时，以下是一个示例代码，展示了一些常见的 String 用法：

```rust
fn main() {
    // 创建一个空的字符串
    let mut s = String::new();

    // 从字符串字面量创建字符串
    let hello = String::from("Hello, ");

    // 连接两个字符串
    let world = "world!".to_string();
    // 注意这里的 hello 已经被移动且再也不能被使用了，这个是由 + 对应的调用的 add 方法签名决定的
    let hello_world = hello + &world;
    println!("Concatenated string: {}", hello_world);

    // 使用 format! 宏格式化字符串
    // 使用format! 的代码要更加易读，并且不会夺取任何参数的所有权。
    let formatted_string = format!("{} {} Rust", hello, world);
    println!("Formatted string: {}", formatted_string);

    // 获取字符串长度
    let len = hello_world.len();
    println!("String length: {}", len);

    // 检查字符串是否为空
    let is_empty = s.is_empty();
    println!("Is string empty? {}", is_empty);

    // 追加字符到字符串
    s.push('A');
    s.push_str("ppend");
    println!("Appended string: {}", s);

    // 需要注意的是 Rust中的 String 不支持索引，下面的代码会编译错误。
    let answer = &hello_world[0];
    // 获取字符串切片，因为 string 存储的是 utf8 编码的字符串，如果切片索引到的是非法字符，也会报错
    let slice = &hello_world[7..12];
    println!("String slice: {}", slice);
    

    // 遍历字符串中的原始字节
    for c in hello_world.chars() {
        println!("Character: {}", c);
    }

    // 遍历字符串中的字符
    for b in "".bytes() {
      println!("{}", b);
    }

    // 将字符串拆分成单词
    let words: Vec<&str> = hello_world.split_whitespace().collect();
    println!("Words: {:?}", words);

    // 替换字符串中的子串
    let replaced_string = hello_world.replace("world", "Rust");
    println!("Replaced string: {}", replaced_string);
}
```

### 1.1 str 和 String
####  str 与 String
问: rust 中的 str 与 String

在 Rust 中，`str` 和 `String` 是用于表示文本数据的两种不同类型。

`str` 是一个不可变的字符串切片类型，它是对存储在其他位置的 UTF-8 编码字符串数据的引用。`str` 类型通常通过字符串字面量或通过引用其他 `String` 或 `str` 对象创建。

```rust
let s: &str = "Hello, world!";  // 字符串字面量创建 str
let s2: &str = &s[0..5];        // 从现有的 str 中创建子切片
```

`String` 是一个可变的、堆分配的字符串类型，它允许动态修改和拥有其内容。`String` 类型提供了多种方法来修改、追加、拼接字符串等操作。

```rust
let mut s = String::new();
let mut s: String = String::from("Hello"); // 使用 from 方法创建 String
s.push_str(", world!");                    // 追加字符串
```

`String` 类型可以根据需要动态调整大小，因为它在堆上分配了足够的内存来容纳字符串的内容。

需要注意的是，`String` 可以通过使用 `&` 运算符转换为 `&str`，这允许在某些情况下使用 `String` 对象的不可变引用。

```rust
// str 转为 String
let s: &str = "Hello, world!";
let string: String = s.to_string();

// String 转为 str
let string: String = String::from("Hello, world!");

// 注: 编译器可以自动将 &String 类型的参数强制转换为 &str 类型。
// rust使用了一种被称作解“引用强制转换”的技术，将&String转换为了&String[..]
let s: &str = &string;

```

总结起来，`str` 是不可变的字符串切片类型，而 `String` 是可变的、堆分配的字符串类型，用于动态处理和修改字符串数据。`str` 常用于函数参数和引用传递，而 `String` 常用于需要动态修改字符串内容的场景。

#### 字符串字面量、str 与 String
问: 表格形式对比 rust 中是字符串字面量、str、String，包括他们的特性、内部处理方式

下面是对 Rust 中字符串字面量、`str` 和 `String` 进行特性、内部处理方式的对比：

| 特性 | 字符串字面量 | `str` | `String` |
|-----|--------------|------|---------|
| 可变性 | 不可变 | 不可变 | 可变 |
| 存储位置 | 编译时决定，通常是静态存储区 | 可以是任何地方，通常是栈上或静态存储区 | 堆上 |
| 分配方式 | 字符串字面量在编译时直接分配 | 引用其他地方的 UTF-8 字符串数据 | 动态分配内存 |
| 大小调整 | 固定大小，不可修改 | 固定大小，不可修改 | 动态调整大小 |
| 内容修改 | 不可修改 | 不可修改 | 可以修改 |
| 长度计算 | 在编译时已知 | 在运行时计算 | 在运行时计算 |
| 生命周期 | 无需生命周期标注，编译器自动推断 | 有生命周期，与引用的对象绑定 | 有生命周期，与变量绑定 |
| 字符串连接 | 编译时可进行字符串字面量拼接 | 使用字符串切片的拼接操作或 `to_string` 方法 | 使用 `push_str`、`push` 或 `+` 等方法 |
| 复制 | 具有 `Copy` trait，可以进行值复制 | 不具备 `Copy` trait，只能通过引用传递 | 不具备 `Copy` trait，只能通过引用传递 |
| 适用场景 | 静态、不可变的字符串常量 | 不可变的字符串引用或切片 | 动态、可变的字符串，需要进行修改和拥有权 |

这些特性和内部处理方式的区别使得字符串字面量、`str` 和 `String` 在不同的情况下具有不同的用途。字符串字面量适用于静态且不可变的字符串常量，`str` 适用于引用和处理已有的字符串数据，而 `String` 则适用于需要动态修改和拥有字符串内容的场景。选择适当的类型取决于具体的需求和操作。

## 2. 动态数组 vector
问: 以表格的形式，使用代码示例给出 rust vector 的使用

以下是一个使用 Rust 中的向量（Vector）的示例，按照表格形式展示各种常见的操作和用法：

| 操作                                         | 代码示例                                                 |
| -------------------------------------------- | ------------------------------------------------------- |
| 创建一个空的向量                             | `let mut v: Vec<i32> = Vec::new();`                          |
| 创建并初始化一个向量                         | `let mut v = vec![1, 2, 3];`                                  |
| 添加元素到向量末尾                           | `v.push(4);`                                             |
| 获取向量中的元素数量                         | `let len = v.len();`                                     |
| 判断向量是否为空                             | `let is_empty = v.is_empty();`                           |
| 通过索引获取向量中的元素                     | `let first = v[0];`                                      |
| 通过索引获取向量中的元素（安全访问）         | `let maybe_first = v.get(0);`                            |
| 通过索引获取向量中的元素（处理越界情况）     | `let maybe_first = v.get(0).unwrap_or(&0);`              |
| 迭代遍历向量中的所有元素                     | `for item in &v { /* 处理每个元素 */ }`                   |
| 修改向量中的元素                             | `v[0] = 5;`                                              |
| 删除向量中的元素                             | `v.remove(0);`                                           |
| 清空向量中的所有元素                         | `v.clear();`                                             |
| 使用 `Vec::with_capacity` 创建具有初始容量  | `let v: Vec<i32> = Vec::with_capacity(10);`              |
| 向量的迭代器操作                             | `v.iter()`、`v.iter_mut()`、`v.into_iter()` 等           |
| 使用 `collect` 方法将迭代器转换为向量        | `let v: Vec<i32> = (0..5).collect();`                     |
| 使用 `join` 方法将向量中的元素连接为字符串   | `let joined_str: String = v.iter().map(|n| n.to_string()).collect::<Vec<String>>().join(", ");` |

下面是一些特殊用法的详细示例:

```rust
// 1. get方法则会返回一个Option<&T>
let v = vec![1, 2, 3, 4, 5];

// []方法会因为索引指向了不存在的元素而导致程序触发panic
let third: &i32 = &v[2];

// get 方法需要处理 Option<&T> 
println!("The third element is {}", third);
match v.get(2) {
    Some(third) => println!("The third element is {}", third),
    None => println!("There is no third element."),
}

// 2. 所有权规则
// 在同一个作用域中同时拥有可变引用与不可变引用
// 当持有了一个指向动态数组中首个元素的不可变引用，尝试向这个动态数组添加元素是不会成功的。
// 因为插入元素，可能会导致整个数组发生扩容，从而导致对首个元素的引用失效
let mut v = vec![1, 2, 3, 4, 5];
let first = &v[0];

v.push(6);

// 3. 在动态数组中存储不同类型的元素
// 可以定义并使用枚举来应对这种情况，因为枚举中的所有变体都被定义为了同一种枚举类型。
enum SpreadsheetCell {
    Int(i32),
    Float(f64),
    Text(String),
}

let row = vec![
    SpreadsheetCell::Int(3),
    SpreadsheetCell::Text(String::from("blue")),
    SpreadsheetCell::Float(10.12),
];
```

## 3. HashMap
问: 使用表格，给出 rust HashMap 的使用

下表是一个关于 Rust 中 HashMap 的使用的示例：

| 步骤 | 代码示例 | 说明 |
|-----|----------|------|
| 1 | `use std::collections::HashMap;` | 导入 HashMap 模块 |
| 2 | `let mut map: HashMap<String, i32> = HashMap::new();` | 创建一个空的 HashMap，键是字符串类型，值是整数类型 |
| 3 | `map.insert("A".to_string(), 1);` | 插入键值对 "A" -> 1 |
| 4 | `map.insert("B".to_string(), 2);` | 插入键值对 "B" -> 2 |
| 5 | `map.insert("C".to_string(), 3);` | 插入键值对 "C" -> 3 |
| 6 | `if let Some(value) = map.get("A") { ... }` | 使用 get 方法获取键 "A" 对应的值 |
| 7 | `for (key, value) in &map { ... }` | 使用迭代器遍历 HashMap 中的键值对 |
| 8 | `map.remove("B");` | 移除键 "B" 及其对应的值 |
| 9 | `map.contains_key("C");` | 检查 HashMap 中是否包含键 "C" |
| 10 | `map.len();` | 获取 HashMap 的长度（键值对的数量） |
| 11 | `map.is_empty();` | 检查 HashMap 是否为空 |

下面是一些特殊用法的详细示例:

```rust
use std::collections::HashMap;

fn main() {
    // 创建一个空的 HashMap，键是字符串类型，值是整数类型
    let mut map: HashMap<String, i32> = HashMap::new();
    // 声明带容量的 HashMap
    let mut map: HashMap<KeyType, ValueType> = HashMap::with_capacity(capacity);

    // 插入键值对 "A" -> 1
    map.insert("A".to_string(), 1);

    // 使用 get 方法获取键 "A" 对应的值
    if let Some(value) = map.get("A") {
        println!("Value for key 'A': {}", value);
    }
}

// 使用 from_iter 方法从一个迭代器生成 HashMap：
let vec = vec![("key1", 1), ("key2", 2), ("key3", 3)];
let map: HashMap<&str, i32> = vec.into_iter().collect();

let teams  = vec![String::from("Blue"), String::from("Yellow")];
let initial_scores = vec![10, 50];
let scores: HashMap<_, _> =
teams.iter().zip(initial_scores.iter()).collect();
```

### 3.1 哈希映射与所有权
在 Rust 中，哈希映射（HashMap）对所有权有一定的影响。让我们看看哈希映射与所有权之间的关系。

1. 所有权转移：当向哈希映射插入键值对时，如果值的类型实现了 `Copy` 特性，那么值将被复制并转移所有权到哈希映射中。如果值的类型没有实现 `Copy` 特性，所有权将被移动到哈希映射中。这意味着插入后，原始值的所有权将被转移，它们在原始位置将不再可用。
2. 所有权借用：当通过键获取哈希映射中的值时，返回的是对值的借用（引用）。借用的生命周期受限于哈希映射本身的生命周期，不允许在哈希映射被释放之后继续使用这些借用。

以下是一个示例，展示了哈希映射与所有权之间的交互：

```rust
use std::collections::HashMap;

fn main() {
    let mut map: HashMap<String, i32> = HashMap::new();

    // 值类型实现了 Copy 特性，复制值并插入哈希映射
    let value1 = 10;
    map.insert("key1".to_string(), value1);

    // 值类型没有实现 Copy 特性，所有权被移动到哈希映射
    let value2 = "value2".to_string();
    map.insert("key2".to_string(), value2);

    // 键和值的所有权已转移到哈希映射中，原始值不再可用

    // 获取哈希映射中的值的借用
    if let Some(value) = map.get("key1") {
        println!("Value for key1: {}", value);
    }

    // 获取哈希映射中的值的可变借用
    if let Some(value) = map.get_mut("key2") {
        *value += 1;
        println!("Updated value for key2: {}", value);
    }

    // 遍历哈希映射的键值对
    for (key, value) in &map {
        println!("Key: {}, Value: {}", key, value);
    }

    // 键不存在时更新
    // entry 返回一个叫作Entry的枚举作为结果。
    map.entry("key2".to_string()).or_insert(30);

    // Entry的 or_insert 方法被定义为返回一个 Entry 键所指向值的可变引用
    let count = map.entry(word).or_insert(0);
    *count += 1;

}
```
