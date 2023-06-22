---
weight: 1
title: "Rust 模块"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Rust 模块"
featuredImage: 

tags: ["rust 语法"]
categories: ["Rust"]

lightgallery: true

toc:
  auto: false
---

## 1. Rust 模块概述
问: rust 中 包、单元包及模块的区别

在 Rust 中，有三个相关的概念：包（Package）、单元包（Crate）和模块（Module）。它们之间的区别如下：

1. 包（Package）：包是一个由 Cargo 构建系统管理的代码项目单元。一个包通常对应一个完整的可执行程序或库。包由一个 Cargo.toml 文件和一个或多个模块组成。
2. 单元包（Crate）：单元包是 Rust 的编译单元，也可以称为编译单元包。一个单元包可以是一个二进制可执行文件、一个库或一个测试集。一个包可以由多个单元包组成，它们可以相互引用和依赖。
3. 模块（Module）：模块是代码组织和封装的单元。它可以包含函数、结构体、枚举、trait 和其他模块等项。模块允许将相关的代码组织在一起，并通过访问控制来限制对其中项的可见性。

简而言之，包是一个由 Cargo 管理的项目单元，单元包是 Rust 的编译单元，而模块是用于组织和封装代码的单元。一个包可以包含多个单元包，而一个单元包可以包含多个模块。

有几条规则决定了包可以包含哪些东西:
1. 首先，一个包中只能拥有最多一个库单元包
2. 其次，包可以拥有任意多个二进制单元包
3. 最后，包内必须存在至少一个单元包（库单元包或二进制单元包）。

### 1.1 包
问: 给出一个 Cargo 的完整目录结构，并说明每个目录的作用

```
project/
├─ Cargo.toml
├─ Cargo.lock
├─ src/
│   ├─ main.rs
│   ├─ lib.rs
│   ├─ bin/
│   │   └─ binary.rs
│       └─ main.rs
│   ├─ lib/
│   │   └─ module.rs
├─ examples/
│   └─ example1.rs
├─ tests/
│   └─ test.rs
├─ benches/
│   └─ bench.rs
├─ build.rs
├─ .gitignore
└─ target/
    ├─ debug/
    │   ├─ build/
    │   ├─ deps/
    │   └─ examples/
    └─ release/
        ├─ build/
        ├─ deps/
        └─ examples/
```

下面是每个目录及文件的作用：

1. `project/`: 项目的根目录，通常是项目的名称。
2. `Cargo.toml`: Cargo 的配置文件，其中包含项目的依赖项、构建选项和其他元数据。
3. `Cargo.lock`: Cargo 生成的锁定文件，记录了当前项目所使用的确切依赖项的版本信息。
4. `src/`: 包含项目的源代码文件夹。
   - `main.rs`: 主程序入口文件，对应于一个可执行文件的入口点。
   - `lib.rs`: 库模块的入口文件，定义了库的公共接口和功能。
   - `bin/`: 可选的二进制文件文件夹，可以包含多个独立的二进制文件。
     - `binary.rs`: 二进制文件的源代码文件。
     - `main.rs`: 二进制文件的源代码文件。
   - `lib/`: 可选的库模块文件夹，可以包含多个子模块。
     - `module.rs`: 库模块的源代码文件。
5. `examples/`: 包含示例代码文件夹，用于演示项目的使用方法和功能。
   - `example1.rs`: 示例代码文件。
6. `tests/`: 包含测试代码文件夹，用于编写单元测试。
   - `test.rs`: 单元测试文件。
7. `benches/`: 包含基准测试代码文件夹，用于性能测试。
   - `bench.rs`: 基准测试文件。
8. `build.rs`: 可选的构建脚本文件，用于在构建过程中执行自定义的构建任务。
9. `.gitignore`: Git 版本控制工具的忽略文件，用于指定不需要纳入版本控制的文件或目录。
10. `target/`: 用于存放构建输出和临时文件的目录。
    - `debug/`: 调试模式下的构建输出目录。
      - `build/`: 用于存放编译过程中生成的临时文件。
      - `deps/`: 存放调试模式下编译生成的依赖项库文件。
      - `examples/`: 存放调试模式下生成的示例代码可执行文件。
    - `release/`: 发布模式下的构建输出目录，结构与 `debug/` 类似。

### 1.2 crate
问: 以上面的目录结构说明，cargo 中的文件如何组合成一个个 crate 模块和模块树

在 Cargo 中，文件组合成 crate（模块）和模块树的方式是通过源代码文件的组织和 `Cargo.toml` 文件中的配置来实现的。

首先，让我们来理解 crate 的概念。在 Cargo 中，一个 crate 可以是一个二进制可执行文件（binary crate），也可以是一个库（library crate）。每个 crate 通常由一个或多个源代码文件组成。

在上述的目录结构中，我们可以看到以下几个源代码文件：

- `src/main.rs`: 这是一个二进制 crate 的入口文件，定义了主程序的逻辑。它对应于一个可执行文件。
- `src/lib.rs`: 这是一个库 crate 的入口文件，定义了库的公共接口和功能。其他文件可以作为库的模块文件，与 `lib.rs` 文件一起构成库的模块树。

同时，我们可以通过 `Cargo.toml` 文件来指定 crate 的类型、依赖关系和模块树的组织。下面是一个示例的 `Cargo.toml` 配置：

```toml
[package]
name = "project"
version = "0.1.0"
edition = "2021"

[dependencies]
rand = "0.8"

[lib]
name = "mylib"
path = "src/lib.rs"

[[bin]]
name = "mybinary"
path = "src/main.rs"
```

上述配置指定了一个项目的名称、版本号和所使用的 Rust 版本。在 `[dependencies]` 下列出了该项目所依赖的其他 crate，例如 `rand` crate。在 `[lib]` 中指定了库 crate 的名称和入口文件路径，这里是 `src/lib.rs`。在 `[[bin]]` 中定义了一个二进制 crate，指定了二进制文件的名称和入口文件路径。

通过这样的配置，Cargo 知道如何将源代码文件组合成 crate，并构建模块树。例如，`src/lib.rs` 文件定义的模块可以通过 `mod` 关键字引入其他文件或目录中的模块，从而形成模块树。模块树的组织方式可以根据项目需求进行灵活调整。

Cargo 中:
1. 默认将 src/main.rs 视作一个二进制单元包的根节点而无须指定，这个二进制单元包与包拥有相同的名称
2. 默认将 src/lib.rs  视作一个库单元包的根节点而无须指定，这个库单元包与包拥有相同的名称
3. 这两个文件的内容各自组成了一个名为 crate 的模块，并位于单元包模块结构的根部。
3. Cargo会在构建库和二进制程序时将这些单元包的根节点文件作为参数传递给rustc

### 1.3 模块
为了演示 rust 如何定义和导入模块，我创建了一个如下结构的项目:

```bash
$ tree src/
src/
├── a.rs
├── lib.rs
├── main.rs
└── stock
    ├── b.rs
    ├── d
    │   ├── c.rs
    │   └── mod.rs
    └── mod.rs
```

我们先看 lib.rs:
1. `mod a;`: lib.rs 的同级目录下找 a.rs 并作为模块导入
2. `pub mod stock;`: 类似，但是 stock 是一个目录，此时需要在 stock 下面创建一个 mod.rs 标识整个目录是一个模块

```rust
mod a;
pub mod stock;

pub mod foo {
    pub fn hello() {
        println!("Hello from foo module!");
    }
}

```

我们再来看看 main.rs:
前面我们说过 src/main.rs 和 src/lib.rs 都会被视为 crate 的根，所以
- 在 main.rs 中 crate 就指向了 main.rs 自身
- 而在 lib.rs 中 crate 就指向的 lib.rs 自己
- lib.rs 和 main.rs 不在同一 crate 包内无法通过相对路径进行导入
- main.rs 要想导入 lib.rs 中的 mod，需要像导入其他外部包一样通过当前项目名(`rust_algo::foo`)导入

```rust

mod a;
mod stock;

use crate::stock::b;
use rust_algo::foo;

fn main() {
    println!("Hello, world!");
    a::greet();
    stock::d::goodbye();
    stock::d::c::hello();
    b::b_goodbye();
    foo::hello();
}


```



### 1.4 模块可见性规则
问: rust 中模块的可见性规则

在 Rust 中，模块的可见性规则遵循以下原则：

1. 默认情况下，模块、结构体、枚举和函数对外部是不可见的。只有在显式声明为公共（`pub`）时才对外可见。
2. `pub` 关键字可以应用于模块、结构体、枚举和函数。使用 `pub` 将它们标记为公共，从而使其对外部可见。
3. 在一个模块中，模块内的所有项对模块本身和其子模块可见，除非明确标记为私有。
4. 处于父级模块中的条目无法使用子模块中的私有条目，但子模块中的条目可以使用它所有祖先模块中的条目
5. 当我们使用use关键字将名称引入作用域时，这个名称会以私有的方式在新的作用域中生效
6. 模块可以使用 `pub use` 语句重新导出项。这样，可以在模块的外部通过模块路径直接访问这些项，而不需要通过中间模块层级。

下面是一个示例，说明模块可见性规则的应用：

```rust
// modules.rs

pub mod my_module {
    pub fn public_function() {
        println!("This is a public function.");
    }

    fn private_function() {
        println!("This is a private function.");
    }

    pub struct PublicStruct {
        pub name: String,
        age: u32,  // 私有字段
    }

    // 将一个枚举声明为公共的时，它所有的变体都自动变为了公共状态
    pub enum PublicEnum {
        Option1,
        Option2,
        Option3,
    }

    impl PublicStruct {
        pub fn new(name: String, age: u32) -> PublicStruct {
            PublicStruct { name, age }
        }

        pub fn get_age(&self) -> u32 {
            self.age
        }

        fn private_method(&self) {
            println!("This is a private method.");
        }
    }
}

fn main() {
    // 可以访问公共模块和公共项
    my_module::public_function();

    let public_struct = my_module::PublicStruct::new("Alice".to_string(), 25);
    println!("Name: {}", public_struct.name);
    println!("Age: {}", public_struct.get_age());

    // 私有项对外部不可见
    // my_module::private_function();  // 错误！不可访问私有函数
    // println!("Age: {}", public_struct.age);  // 错误！不可访问私有字段
    // public_struct.private_method();  // 错误！不可访问私有方法
}
```

在上述示例中，`public_function`、`PublicStruct` 和 `PublicEnum` 被标记为公共，可以在模块的外部访问。`private_function`、`age` 字段和 `private_method` 被标记为私有，只能在模块内部访问。

标准库（std）实际上也同样被视作当前项目的外部包。由于标准库已经被内置到了Rust语言中，所以我们不需要特意修改Cargo.toml来包含std。但是，我们同样需要使用use来将标准库中特定的条目引入当前项目的作用域。

```rust
use std::collections::HashMap;

// 将std::io与std::io::Write引入作用域
use std::io::{self, Write};
```

### 1.5 :: 和 .
问: 对比 rust 中 :: 和 . 各自适用的场景

在 Rust 中，`::` 和 `.` 是两种不同的运算符，用于不同的场景。

1. `::` 运算符：
   - 用于访问模块、结构体、枚举等定义的命名空间。
   - 用于访问静态方法、关联函数、常量和枚举成员。
   - 用于访问嵌套的命名空间，如 `std::cmp::Ordering`。
   - 用于引用其他模块中的项，如 `use crate::module::Item`。

   例如：
   ```rust
   mod my_module {
       pub const MY_CONSTANT: u32 = 42;

       pub struct MyStruct {
           // ...
       }

       impl MyStruct {
           pub fn new() -> Self {
               // ...
           }
       }
   }

   fn main() {
       let val = my_module::MY_CONSTANT;
       let my_struct = my_module::MyStruct::new();
   }
   ```

2. `.` 运算符：
   - 用于访问结构体和枚举实例的字段和方法。
   - 用于访问结构体实例的成员变量和方法。
   - 用于访问枚举实例的关联函数。

   例如：
   ```rust
   struct MyStruct {
       field: u32,
   }

   impl MyStruct {
       fn new() -> Self {
           // ...
       }

       fn method(&self) {
           // ...
       }
   }

   fn main() {
       let my_struct = MyStruct::new();
       let field_value = my_struct.field;
       my_struct.method();
   }
   ```

总结：
- `::` 运算符用于访问命名空间、模块和静态项。
- `.` 运算符用于访问实例的字段和方法。

需要根据具体的场景和语义要求选择使用适当的运算符。
