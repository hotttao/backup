---
weight: 1
title: "Rust 异常"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Rust 异常"
featuredImage: 

tags: ["rust 语法"]
categories: ["Rust"]

lightgallery: true

toc:
  auto: false
---

## 1. Rust 异常
在Rust中，我们将错误分为两大类：
1. 可恢复错误: 使用枚举类型 `Result<T, E>` 处理
2. 不可恢复错误: 使用 panic! 宏终止程序

### 1.1 panic!

```rust
fn divide(a: i32, b: i32) -> i32 {
    if b == 0 {
        panic!("Divisor cannot be zero");
    } else {
        a / b
    }
}

fn main() {
    let result = divide(10, 0);
    println!("Result: {}", result);
}

```

#### panic中的栈展开与终止
当panic发生时，程序有两种处理方式:
1. 栈展开:
    - Rust会沿着调用栈的反向顺序遍历所有调用函数，并依次清理这些函数中的数据。
    - 但是为了支持这种遍历和清理操作，我们需要在二进制中存储许多额外信息。
2. 立即终止: 
    - 直接结束程序且不进行任何清理工作，程序所使用过的内存只能由操作系统来进行回收
    - 有点是最终二进制包更小小

默认情况下，Rust 会使用栈展开来执行清理操作，这可以确保资源的正确释放，并提供更灵活的错误处理机制。可以通过在 Cargo.toml 文件中设置 panic 属性来控制 Rust 编译器在发生 panic 不执行栈展开。例如：

```toml
[profile.release]
panic = "abort"
```

栈展开和 panic 属性的设置只适用于 Release 模式。在 Debug 模式下，默认会执行栈展开，以便提供更多的调试信息。

#### 打印堆栈信息
在 Rust 中，可以通过设置 `RUST_BACKTRACE` 环境变量来启用堆栈信息的打印。以下是在 Rust 中查看异常时的堆栈信息的方法：

1. 通过命令行设置环境变量：

   在运行 Rust 程序之前，在命令行中设置 `RUST_BACKTRACE` 环境变量为 "1" 或 "full"。例如：

   ```shell
   RUST_BACKTRACE=1 cargo run
   ```

   或者

   ```shell
   RUST_BACKTRACE=full cargo run
   ```

   这样，当程序发生 panic 异常时，将会打印出完整的堆栈跟踪信息。

2. 在代码中设置环境变量：

   在 Rust 代码中，可以使用 `std::env::set_var` 函数来设置 `RUST_BACKTRACE` 环境变量。例如：

   ```rust
   use std::env;
   
   fn main() {
       env::set_var("RUST_BACKTRACE", "1");
   
       // Rust 代码逻辑
   }
   ```

在运行cargo build或cargo run命令时，如果没有附带--release标志，那么调试符号就是默认开启的。

### 1.2 Result
#### Result 定义
```rust
enum Result<T, E> {
    Ok(T),
    Err(E),
}

// Result枚举及其变体已经通过预导入模块被自动地引入当前作用域中
fn main() {
    let f = File::open("hello.txt");

    let f = match f {
        Ok(file) => file,
        Err(error) => {
            panic!("There was a problem opening the file: {:?}", error)
        },
    };
}
```

#### Result 处理
通常情况下，我们可以像下面这样，通过嵌套的 match 处理程序中的不同异常。

```rust
use std::fs::File;
use std::io::{self, Read};

fn read_file_contents(filename: &str) -> Result<String, io::Error> {
    let mut file = File::open(filename)?;

    let mut contents = String::new();
    file.read_to_string(&mut contents)?;

    Ok(contents)
}

fn main() {
    let filename = "example.txt";
    match read_file_contents(filename) {
        Ok(contents) => {
            println!("File contents: {}", contents);
        }
        Err(error) => match error.kind() {
            io::ErrorKind::NotFound => {
                eprintln!("File not found: {}", filename);
            }
            io::ErrorKind::PermissionDenied => {
                eprintln!("Permission denied for file: {}", filename);
            }
            _ => {
                eprintln!("Error reading file: {}", error);
            }
        },
    }
}

```
而处理错误时更加灵活和方便,Result 提供了很多方法:

| 方法                            | 描述                                                   |
| ------------------------------- | ------------------------------------------------------ |
| `is_ok`                         | 检查 `Result` 是否为 `Ok` 变体                          |
| `is_err`                        | 检查 `Result` 是否为 `Err` 变体                         |
| `ok`                            | 将 `Result` 转换为 `Option<Ok>`                          |
| `err`                           | 将 `Result` 转换为 `Option<Err>`                         |
| `unwrap`                        | 如果是 `Ok` 变体，返回 `Ok` 的值；否则触发 `panic`      |
| `expect`                        | 如果是 `Ok` 变体，返回 `Ok` 的值；否则触发自定义的 `panic` |
| `unwrap_or`                     | 如果是 `Ok` 变体，返回 `Ok` 的值；否则返回默认值         |
| `unwrap_or_else`                | 如果是 `Ok` 变体，返回 `Ok` 的值；否则执行自定义的闭包   |
| `map`                           | 如果是 `Ok` 变体，将 `Ok` 的值进行转换并返回新的 `Result` |
| `map_err`                       | 如果是 `Err` 变体，将 `Err` 的值进行转换并返回新的 `Result` |
| `and`                           | 如果当前是 `Ok` 变体，则返回另一个 `Result`              |
| `and_then`                      | 如果当前是 `Ok` 变体，则将值传递给闭包并返回新的 `Result` |
| `or`                            | 如果当前是 `Err` 变体，则返回另一个 `Result`              |
| `or_else`                       | 如果当前是 `Err` 变体，则将值传递给闭包并返回新的 `Result` |
| `unwrap_err`                    | 如果是 `Err` 变体，返回 `Err` 的值；否则触发 `panic`     |
| `expect_err`                    | 如果是 `Err` 变体，返回 `Err` 的值；否则触发自定义的 `panic` |
| `unwrap_err_or`                 | 如果是 `Err` 变体，返回 `Err` 的值；否则返回默认值        |
| `unwrap_err_or_else`            | 如果是 `Err` 变体，返回 `Err` 的值；否则执行自定义的闭包  |
| `transpose`                     | 交换 `Result` 中 `Ok` 和 `Err` 的位置                    |
| `unwrap_or_default`             | 如果是 `Ok` 变体，返回 `Ok` 的值；否则返回默认值的默认值   |
| `unwrap_or_default_with`        | 如果是 `Ok` 变体，返回 `Ok` 的值；否则返回自定义的默认值  |
| `unwrap_or_else_default`        | 如果是 `Ok` 变体，返回 `Ok` 的值；否则返回默认值的默认值   |
| `unwrap_or_else_default_with`   | 如果是 `Ok` 变体，返回 `Ok` 的值；否则返回自定义的默认值  |
| `unwrap_or_else_default_or`     | 如果是 `Ok` 变体，返回 `Ok` 的值；否则返回默认值或自定义的默认值 |
| `unwrap_or_else_default_with_or`| 如果是 `Ok` 变体，返回 `Ok` 的值；否则返回自定义的默认值或默认值 |
| `iter`                          | 返回一个迭代器，其中包含 `Ok` 变体的值                   |
| `iter_mut`                      | 返回一个可变迭代器，其中包含 `Ok` 变体的值               |
| `and_then_or_else`              | 如果当前是 `Ok` 变体，则将值传递给第一个闭包并返回新的 `Result`；否则将值传递给第二个闭包并返回新的 `Result` |

#### Result 传播
传播错误的模式在Rust编程中非常常见，所以Rust专门提供了一个问号运算符（?）来简化它的语法。

```rust
fn read_username_from_file() -> Result<String, io::Error> {
    let mut f = File::open("hello.txt")?;
    let mut s = String::new();
    f.read_to_string(&mut s)?;
    Ok(s)
}
```

通过将？放置于Result值之后:
1. 假如这个Result的值是Ok，那么包含在Ok中的值就会作为这个表达式的结果返回并继续执行程序。
2. 假如值是Err，那么这个值就会作为整个程序的结果返回，如同使用了return一样将错误传播给调用者。

?运算符还支持链式调用:

```rust
File::open("hello.txt")?.read_to_string(&mut s)?;

```

被？运算符所接收的错误值会隐式地被from函数处理，这个函数定义于标准库的From trait中，用于在错误类型之间进行转换。当？运算符调用from函数时，它就开始尝试将传入的错误类型转换为当前函数的返回错误类型。当一个函数拥有不同的失败原因，却使用了统一的错误返回类型来同时进行表达时，这个功能会十分有用。只要每个错误类型都实现了转换为返回错误类型的from函数，?运算符就会自动帮我们处理所有的转换过程。

? 运算符存在一些使用限制:
1. 使用了？运算符的函数必须返回Result、Option或任何实现了std::ops::Try的类型。
2. `?` 运算符只能在当前函数中的返回位置使用，它会将 `Err` 的值立即返回给调用者。因此，它不能在其他位置，如条件表达式、循环或闭包中使用。
