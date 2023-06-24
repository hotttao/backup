---
weight: 1
title: "Rust 泛型、trait与声明周期"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Rust 泛型、trait与声明周期"
featuredImage: 

tags: ["rust 语法"]
categories: ["Rust"]

lightgallery: true

toc:
  auto: false
---

## 1. 泛型
当使用泛型来定义一个函数时，我们需要将泛型放置在函数签名中通常用于指定参数和返回值类型的地方。

### 1.1 泛型的定义
问: 使用代码示例说明，rust 中如何使用泛型定义函数、结构体、枚举及方法

当使用泛型时，可以在 Rust 中使用 `<T>` 来定义泛型类型。以下是使用泛型定义函数、结构体、枚举和方法的示例代码：

**1. 使用泛型定义函数：**

```rust
// 类型名称的声明必须被放置在函数名与参数列表之间的一对尖括号<>中
fn print_value<T>(value: T) {
    println!("Value: {:?}", value);
}
```

上述代码定义了一个名为 `print_value` 的函数，它接受一个泛型参数 `T`。函数内部可以使用泛型类型 `T` 来操作参数 `value`。

**2. 使用泛型定义结构体：**

```rust
// 在结构名后的一对尖括号中声明泛型参数
struct Pair<T> {
    first: T,
    second: T,
}

struct Pair<T, U> {
    first: T,
    second: U,
}
```

上述代码定义了一个名为 `Pair` 的结构体，它有两个字段 `first` 和 `second`，这两个字段的类型都是泛型参数 `T`。

**3. 使用泛型定义枚举：**

```rust
enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

上述代码定义了一个名为 `Result` 的枚举，它有两个变体 `Ok` 和 `Err`。`Ok` 变体接受泛型参数 `T`，表示操作成功的结果；`Err` 变体接受泛型参数 `E`，表示操作失败的结果。

**4. 使用泛型定义方法：**

```rust
struct Point<T> {
    x: T,
    y: T,
}

// 必须紧跟着impl关键字声明T，以便能够在实现方法时指定类型Point<T>
// 通过在impl之后将T声明为泛型，Rust能够识别出Point尖括号内的类型是泛型而不是具体类型。
impl<T> Point<T> {
    fn new(x: T, y: T) -> Self {
        Point { x, y }
    }

    fn get_x(&self) -> &T {
        &self.x
    }

    fn get_y(&self) -> &T {
        &self.y
    }
}

// 我们可以单独为Point<f32>实例而不是所有的Point<T>泛型实例来实现方法。
// 意味着类型 Point<f32> 将会拥有一个名为distance_from_origin的方法，而其他的Point<T>实例则没有该方法的定义。
impl Point<f32> {
    fn distance_from_origin(&self) -> f32 {
        (self.x.powi(2) + self.y.powi(2)).sqrt()
    }
}
```

**5. 更复杂的泛型示例：**
方法使用了与结构体定义不同的泛型参数:

```rust
struct Point<T, U> {
    x: T,
    y: U,
}

impl<T, U> Point<T, U> {
    fn mixup<V, W> (self, other: Point<V, W>) -> Point<T, W> {
        Point {
            x: self.x,
            y: other.y,
        }
    }
}

```

### 1.2 Rust 泛型实现
Rust会在编译时执行泛型代码的单态化（monomorphization）。单态化是一个在编译期将泛型代码转换为特定代码的过程，它会将所有使用过的具体类型填入泛型参数从而得到有具体类型的代码。在这个过程中，编译器所做的工作与我们在创建泛型函数时相反：它会寻找所有泛型代码被调用过的地方，并基于该泛型代码所使用的具体类型生成代码。

## 2. trait
抛开实现，rust 中的 trait 就是接口。

### 2.1 trait 定义
问题: 举例说明 rust 中的 trait 如何作为函数参数使用

```rust
trait Printable {
    // trait 中的方法可以提供默认实现
    // 在默认实现中调用相同trait中的其他方法
    fn print(&self);
}

// 实现 Printable trait 的结构体
struct Person {
    name: String,
    age: u32,
}


impl Printable for Person {
    fn print(&self) {
        println!("Name: {}, Age: {}", self.name, self.age);
    }
}

// 接受实现了 Printable trait 的参数的函数
fn print_info(item: impl Printable) {
    item.print();
}

// 返回实现了trait的类型
// 只能在返回一个类型时使用impl Trait。比如 A，B都实现了 Printable。
// 不能在 returns_printable 返回 A 或者 B，要么返回 A 要么返回 B
// 要实现返回 A 或者 B 需要特殊实现
fn returns_printable() -> impl Printable {
}

fn main() {
    let person = Person {
        name: String::from("Alice"),
        age: 25,
    };

    print_info(person);
}
```

#### trait 约束
上面 `item: impl Printable` 只是下面 trait 约束的语法糖:

```rust
pub print_info<T: Printable>(item: T) {
    println!("Breaking news! {}", item.print());
}
```

impl Trait更适用于短小的示例，而trait约束则更适用于复杂情形。比如下面，如果你想约束 item1，item2 必须是相同的类型，impl 语法是无法实现的，必须使用 trait 约束。

```rust
pub fn notify(item1: impl Summary, item2: impl Summary) {

}

pub fn notify<T: Summary>(item1: T, item2: T) {
}
```

通过+语法来指定多个trait约束:

```rust
pub fn notify(item: impl Summary + Display) {}
pub fn notify<T: Summary + Display>(item: T) {}
```

#### where 从句
我们可以在函数签名之后使用where从句来指定trait约束。下面两种定义等价:

```rust
fn some_function<T: Display + Clone, U: Clone + Debug>(t: T, u: U) -> i32 {}

fn some_function<T, U>(t: T, u: U) -> i32
    where T: Display + Clone,
          U: Clone + Debug
{}
```

### 2.2 trait 使用限制
在 Rust 中，对于使用 trait 有一些限制和约束：
1. 当为一个类型实现一个 trait 时，要么是当前 crate 的类型，要么是当前 crate 中定义的 trait。这是为了避免不受你控制的类型实现你的 trait。
2. 在一个 trait 中，不能有关联常量或关联类型与默认实现共存。也就是说，如果为关联常量或关联类型提供了默认值，那么不能为相关方法提供默认实现。
