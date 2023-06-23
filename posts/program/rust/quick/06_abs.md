---
weight: 1
title: "Rust 抽象"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 接口、类与继承"
featuredImage: 

tags: ["rust 语法"]
categories: ["Rust"]

lightgallery: true

toc:
  auto: false
---

## 1. Rust 中的抽象概设
问: 以表格形式，对比 java 和 rust 的结构体/类 、继承、接口、接口实现

下表对比了Java和Rust中的结构体/类、继承、接口和接口实现的特点：

| 特性         | Java                                     | Rust                                    |
| ------------ | ---------------------------------------- | --------------------------------------- |
| 结构体/类   | 使用`class`关键字定义                     | 使用`struct`关键字定义                   |
| 继承         | 支持单继承，使用`extends`关键字            | 不支持继承                               |
| 接口         | 使用`interface`关键字定义                 | 使用`trait`关键字定义                    |
| 接口实现     | 使用`implements`关键字实现接口             | 使用`impl`块实现接口                     |
| 默认实现     | 接口可以提供默认方法实现                   | 接口可以提供默认方法实现                 |
| 动态绑定     | 支持动态绑定（多态）                       | 不支持动态绑定（多态）                   |
| 方法重写     | 子类可以重写父类的方法                     | 结构体可以实现同名方法来覆盖默认实现       |
| 类型推断     | 需要显式声明类型                           | 可以使用类型推断，无需显式声明类型         |
| 所有权       | 不涉及所有权概念                           | 强调所有权和借用规则                       |

问: 用代码示例，说明 rust 中 结构体/类 、继承、接口、接口实现、方法定义

在Rust中，结构体/类使用`struct`关键字定义，继承使用组合和trait实现，接口使用`trait`关键字定义，接口实现使用`impl`块实现。以下是一些代码示例来说明这些概念：

```rust
// A. 结构体/类
#[derive(Debug)]
struct Person {
    
    name: String,
    age: u32,
}

// B. 方法定义
// 每个结构体可以拥有多个像下面的 impl 块
impl Person {
    // 关联函数/静态方法，使用 :: 引用，常常被用作构造器
    fn new(name: String, age: u32) -> Self {
        // 1. 使用大括号进行初始化
        // 2. 如同其他表达式一样，我们可以在函数体的最后一个表达式中构造结构体实例，来隐式地将这个实例作为结果返回。
        Person {
            name: name,
            age: age
        }
        // 3. 在变量名与字段名相同时，可以使用简化版的字段初始化方法
        Person { name, age }

        // 4. 结构体更新语法，从其他实例快速创建新的实例
        let p1 = Persion {
            name: "ab",
            age: 10
        }
        Persion {
            name,
            ..p1
        }
    }
    
    fn get_name(&self) -> &str {
        &self.name
    }

    fn get_age(&self) -> u32 {
        self.age
    }
}

// C. 继承和接口实现
trait Printable {
    fn print(&self);
}

struct Student {
    person: Person,
    student_id: u32,
}

impl Student {
    fn new(name: String, age: u32, student_id: u32) -> Self {
        Student {
            person: Person::new(name, age),
            student_id,
        }
    }
}

impl Printable for Student {
    fn print(&self) {
        println!("Student: {} (ID: {})", self.person.get_name(), self.student_id);
    }
}

fn main() {
    // 一旦实例可变，那么实例中的所有字段都将是可变的。Rust不允许我们单独声明某一部分字段的可变性。
    let mut student = Student::new("Alice".to_string(), 20, 12345);
    student.print();
    println!("student is {:?}", student)
    println!("student is {:#?}", student)
}
```

Rust中没有直接的继承机制，而是使用组合和trait实现来达到类似的效果。

## 2. 结构体
### 2.1 结构体

```rust
// A. 结构体/类
// 添加注解来派生Debug trait
// Rust提供了许多可以通过derive注解来派生的trait，它们可以为自定义的类型增加许多有用的功能。
#[derive(Debug)]
struct Person {
    // 使用了自持所有权的String类型而不是&str字符串切片类型。
    // 因为我们希望这个结构体的实例拥有自身全部数据的所有权。
    // 在这种情形下，只要结构体是有效的，那么它携带的全部数据也就是有效的。
    
    name: String,
    age: u32,

    // 我们也可以在结构体中存储指向其他数据的引用，不过这需要用到Rust中独有的生命周期功能
    // 生命周期保证了结构体实例中引用数据的有效期不短于实例本身。(注: 后面会详述)
}

// B. 方法定义
// 每个结构体可以拥有多个像下面的 impl 块
impl Person {
    // 关联函数/静态方法，使用 :: 引用，常常被用作构造器
    fn new(name: String, age: u32) -> Self {
        // 1. 使用大括号进行初始化
        // 2. 如同其他表达式一样，我们可以在函数体的最后一个表达式中构造结构体实例，来隐式地将这个实例作为结果返回。
        Person {
            name: name,
            age: age
        }
        // 3. 在变量名与字段名相同时，可以使用简化版的字段初始化方法
        Person { name, age }

        // 4. 结构体更新语法，从其他实例快速创建新的实例
        let p1 = Persion {
            name: "ab",
            age: 10
        }
        Persion {
            name,
            ..p1
        }
    }
    // 由于方法的声明过程被放置在 impl 块中，所以Rust能够将self的类型推导为 Person。
    // 其他任何普通的参数一样，self 可以使用 self、&self、&mut self 以控制 self 的所有权
    // 通常来说，将第一个参数标记为self并在调用过程中取得实例的所有权的方法并不常见。
    // 自动引用和解引用: 使用object.something()调用方法时，Rust会自动为调用者object添加&、&mut或*，以使其能够符合方法的签名
    fn get_name(&self) -> &str {
        &self.name
    }

    fn get_age(&self) -> u32 {
        self.age
    }
}
```

### 2.2 元组结构体
问: 用代码示例，说明 rust 中的元组结构体

在Rust中，元组结构体是一种特殊的结构体，它与元组类似，但具有命名的字段。以下是一个使用代码示例来说明Rust中的元组结构体的定义和使用：

```rust
// 定义一个元组结构体
struct Point2D(i32, i32);

impl Point2D {
    // 构造函数
    fn new(x: i32, y: i32) -> Self {
        Point2D(x, y)
    }

    // 计算距离的方法
    fn distance_to_origin(&self) -> f64 {
        let (x, y) = *self; // 解构元组结构体
        ((x * x + y * y) as f64).sqrt()
    }
}

fn main() {
    let point = Point2D::new(3, 4);
    println!("Point coordinates: ({}, {})", point.0, point.1);
    println!("Distance to origin: {}", point.distance_to_origin());
}
```
一般来说，当你想要给元组赋予名字，并使其区别于其他拥有同样定义的元组时，你就可以使用元组结构体。除此之外，元组结构体实例的行为就像元组一样：你可以通过模式匹配将它们解构为单独的部分，你也可以通过. 及索引来访问特定字段。

## 3. 枚举
### 3.1 枚举定义
问: 用代码示例，说明 rust 中的枚举类型

在 Rust 中，枚举类型（enum）是一种用于定义一组相关的值的数据类型:

```rust
// 定义一个枚举类型
enum Fruit {
    Apple,    // 枚举内的所有可能值称为，枚举变体（variant）
    Banana,   // 与其他语言不同的时，rust 的枚举值不是 0 开始的数字，而是类似变量的存在
    Orange,
}

fn process_fruit(fruit: Fruit) {
    match fruit {
        Fruit::Apple => println!("I love apples!"),
        Fruit::Banana => println!("Bananas are delicious!"),
        Fruit::Orange => println!("Oranges are refreshing!"),
    }
}

// 定义一个带有关联数据的枚举类型
// 枚举允许我们直接将其关联的数据嵌入枚举变体内
// 每个变体可以拥有不同类型和数量的关联数据
enum Message {
    Quit,                    // Quit没有任何关联数据
    Move { x: i32, y: i32 }, // 包含了一个匿名结构体。
    Write(String),           // 包含了一个String
    ChangeColor(u8, u8, u8), // ChangeColor包含了3个i32值
}

// 为枚举类型 Message 添加方法
impl Message {
    
    fn display(&self) {
        match self {
            Message::Quit => println!("Quitting..."),
            Message::Move { x, y } => println!("Moving to ({}, {})", x, y),
            Message::Write(text) => println!("Writing: {}", text),
            Message::ChangeColor(r, g, b) => println!("Changing color to RGB({}, {}, {})", r, g, b),
        }
    }

    fn log(&self) {
        match self {
            Message::Quit => println!("Logging quit message..."),
            _ => println!("Logging message..."),
        }
    }
}

fn main() {
    // 使用枚举变体创建实例，枚举的变体全都位于其标识符的命名空间中，需要使用 :: 引用
    let apple = Fruit::Apple;
    process_fruit(apple);

    let move_message = Message::Move { x: 10, y: 20 };
    move_message.display();

    let write_message = Message::Write("Hello, Rust!".to_string());
    write_message.display();

    let color_message = Message::ChangeColor(255, 0, 0);
    color_message.display();
}
```
Message 有些类似于定义多个不同类型的结构体。但与定义一个个 struct 的区别在于:
1. 枚举除了不会使用struct关键字，还将变体们组合到了同一个Message类型中
2. 假如我们使用了不同的结构体，那么每个结构体都会拥有自己的类型，我们无法轻易定义一个能够统一处理这些类型数据的函数

### 3.2 Option
空值（Null）本身是一个值，但它的含义却是没有值。在设计有空值的语言中，一个变量往往处于这两种状态：空值或非空值。空值的问题在于，当你尝试像使用非空值那样使用空值时，就会触发某种程度上的错误。但是空值本身所尝试表达的概念仍然是有意义的：它代表了因为某种原因而变为无效或缺失的值。Rust并没有像许多其他语言一样支持空值。而是通过标准库提供了一个叫 Option 的枚举类型用于表示一种值可能不存在的情形。

Option 的定义如下，由于`Option<T>`枚举非常常见且很有用，所以它以及它的变体都包含在了预导入模块中。其中:
1. 有了一个Some值时，我们就可以确定值是存在的，并且被Some所持有。
2. 有了一个None值时，我们就知道当前并不存在一个有效的值。

```rust
enum Option<T> {
    Some(T),
    None,
}

// 由于预导入，我们可以在不加Option::前缀的情况下直接使用Some或None
let some_number = Some(5);
let some_string = Some("a string");

// 使用了None而不是Some变体来进行赋值，那么我们需要明确地告知Rust这个Option<T>的具体类型。
// 因为单独的None变体值与持有数据的Some变体不一样，编译器无法根据这些信息来正确推导出值的完整类型。
let absent_number: Option<i32> = None;

// 编译错误:
let x: i8 = 5;
let y: Option<i8> = Some(5);
let sum = x + y;
```

在 Rust 中:
1. `Option<T>`和 `T` 是不同的类型
2. 当变量是类型 T ,编译器可以确保变量持有的值是有效，无需在使用前进行空值检查
2. 当变量的类型是 `Option<T>` 时，我们必须考虑值不存在的情况，即为了使用`Option<T>`中可能存在的T，必须要编写处理每个变体的代码。这种约束是编译器级别的。
3. 这能帮助我们避免使用空值时最常见的一个问题：假设某个值存在，实际上却为空。

### 3.3 match 表达式
match，它允许将一个值与一系列的模式相比较，并根据匹配的模式执行相应代码。可以天然的处理枚举：它允许我们基于枚举拥有的变体来决定运行的代码分支，并允许代码通过匹配值来获取变体内的数据。

问: 用代码示例，列举 rust match 的所有用法

Rust 的 `match` 表达式用于模式匹配，可以处理各种不同的情况。下面是一个示例，展示了 `match` 表达式的各种用法：

```rust
enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
    ChangeColor(u8, u8, u8),
}

fn main() {
    let message = Message::Move { x: 10, y: 20 };

    // 1. 匹配枚举值
    match message {
        Message::Quit => {
            println!("Quitting...");
        }
        Message::Move { x, y } => {
            println!("Moving to ({}, {})", x, y);
        }
        Message::Write(text) => {
            println!("Writing: {}", text);
        }
        Message::ChangeColor(r, g, b) => {
            println!("Changing color to RGB({}, {}, {})", r, g, b);
        }
    }

    // 2. 使用通配符 `_` 匹配其他情况
    let number = 5;
    match number {
        1 => println!("One"),
        2 => println!("Two"),
        // match 的所有分支必须返回相同的类型，函数的默认返回值是空数组
        _ => (),
    }

    // 3. 多个模式的匹配
    let age = 30;
    match age {
        1 | 2 => println!("Child"),
        18..=30 => println!("Youth"),
        _ => println!("Adult"),
    }

    // 4. 使用变量绑定
    let value = Some(42);
    match value {
        Some(x) => println!("Value: {}", x),
        None => println!("No value"),
    }

    // 5. 匹配引用
    let name = "Alice";
    match &name {
        "Bob" => println!("Hello, Bob!"),
        _ => println!("Hello, stranger!"),
    }
}

fn plus_one(x: Option<i32>) -> Option<i32> {
    match x {
      None => None,
      Some(i) => Some(i + 1),
    }
}

```

上述代码示例演示了 `match` 表达式的多种用法：
1. 匹配枚举值的不同情况。
2. 使用通配符 `_` 匹配其他情况。
3. 多个模式的匹配，使用 `|` 分隔多个模式。
4. 使用变量绑定，将匹配的值绑定到变量。
5. 匹配引用，可以对引用进行模式匹配。

### 3.4 if let
if let 用于简化处理只用关心某一种匹配而忽略其他匹配的情况。可以将if let视作match的语法糖，其使用一对以=隔开的模式与表达式，表示只在值满足某一特定模式时运行代码，而忽略其他所有的可能性。

```rust
// 匹配 Option 类型：
let maybe_number = Some(42);

if let Some(number) = maybe_number {
    println!("Found a number: {}", number);
} else {
    println!("No number found");
}

enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
}

// 匹配枚举类型的特定变体：
let message = Message::Write(String::from("Hello"));

if let Message::Write(text) = message {
    println!("Received a write message: {}", text);
} else {
    println!("Received a different type of message");
}

```