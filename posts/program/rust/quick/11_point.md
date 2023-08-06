---
weight: 1
title: "Rust 智能指针"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Rust 智能指针的区别"
featuredImage: 

tags: ["rust 语法"]
categories: ["Rust"]

lightgallery: true

toc:
  auto: false
---

# 1. Rust 引用与智能指针
| 特征         | 引用（Reference）                                   | 智能指针（Smart Pointer）                  |
|-------------|-------------------------------------------------|------------------------------------------|
| 所有权       | 非拥有，不获取数据的所有权                              | 拥有，可以获取数据的所有权                           |
| 生命周期     | 有生命周期概念，用于保证借用的有效性                        | 通常不涉及生命周期，因为拥有数据的所有权                    |
| 功能和特性    | 无特殊功能，仅用于借用数据的访问                          | 提供额外功能，如引用计数、内部可变性、线程安全等                |
| 内存安全性    | 遵循 Rust 的借用规则，静态检查所有权和借用的有效性                   | 需要显式管理内存，可能存在运行时错误或安全问题                     |
| 多重引用     | 允许同时存在多个不可变引用，但不允许可变引用和不可变引用同时存在               | 可以通过引用计数（如 `Rc`）实现多个共享不可变引用，但不能同时存在可变引用 |
| 可变性       | 可以有一个可变引用或多个不可变引用，但不允许同时存在多个可变引用              | 可以有一个可变指针（如 `Box`、`Cell`、`RefCell`），但不能同时存在多个可变引用 |
| 使用场景     | 临时借用数据、避免所有权转移、高效处理数据的情况                  | 需要拥有数据所有权、实现特定功能的场景                        |


智能指针:
1. 拥有指针的结构体
2. 区别于一般结构体的地方在于它们会实现Deref与Drop这两个trait，用于管理指针指向的数据

在 Rust 中，`Deref` 和 `Drop` 是两个重要的 trait，用于自定义类型的解引用和资源释放行为。

### 1.1 `Deref` trait
`Deref` trait：
- 用于重载解引用操作符 `*` 的行为。
- 定义了一个方法 `deref`，该方法返回类型 `&Self::Target`，表示对该类型进行解引用后的结果。
- 通过实现 `Deref` trait，可以使自定义类型具有解引用的能力，可以像操作原生类型一样使用解引用操作符 `*`。
- `Deref` trait 的实现需要显式调用解引用操作符 `*`，或者使用 `deref` 方法来实现解引用。

```rust
use std::ops::Deref;

// 自定义类型 MyBox 实现 Deref trait
struct My`Box<T>`(T);

impl<T> Deref for My`Box<T>` {
    type Target = T;
    
    // 假设deref方法直接返回了值而不是指向值的引用，那么这个值就会被移出self。
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

// 为 MyBox 定义实现 Deref 之后，我们就可以像下面这样使用
let x = 5;
let y = MyBox::new(x);

assert_eq!(5, x);

// *y会被Rust隐式地展开为：*(y.deref())。这种替换在代码中只会进行一次
assert_eq!(5, *y);
```

#### 函数和方法的隐式解引用转换
解引用转换（deref coercion）是Rust为函数和方法的参数提供的一种便捷特性：
1. 当某个类型T实现了Deref trait时，它能够将T的引用转换为T经过Deref操作后生成的引用
2. 当我们将某个特定类型的值引用作为参数传递给函数或方法，但传入的类型与参数类型不一致时，解引用转换就会自动发生。

正因为如此，我们可以像下面这样调用 hello 函数:
1. 为`My`Box<T>``实现了Deref trait Rust可以通过调用deref来将`&MyBox<String`>转换为`&String`
2. 标准库为String提供的Deref实现会返回字符串切片，所以Rust可以继续调用deref来将&String转换为&str
3. 只要代码涉及的类型实现了Deref trait，Rust就会自动分析类型并不断尝试插入Deref::deref来获得与参数类型匹配的引用。

```rust
fn hello(name: &str) {
    println!("Hello, {}!", name);
}

let m = MyBox::new(String::from("Rust"));
hello(&m);
// 如果Rust没有解引用转换功能，就必须这么写代码
hello(&(*m)[..]);

```

#### 解引用转换与可变性
使用Deref trait能够重载不可变引用的`*`运算符。与之类似，使用DerefMut trait能够重载可变引用的`*`运算符。Rust会在类型与trait满足下面3种情形时执行解引用转换：
1. 当T: `Deref<Target=U>`时，允许&T转换为&U。
2. 当T: `DerefMut<Target=U>`时，允许&mut T转换为&mut U。
3. 当T: `Deref<Target=U>`时，允许&mut T转换为&U。

```rust
use std::ops::DerefMut;

// 自定义类型
struct MyVec<T> {
    data: Vec<T>,
}

impl<T> MyVec<T> {
    fn new() -> Self {
        MyVec { data: Vec::new() }
    }
}

// 实现 DerefMut Trait
impl<T> DerefMut for MyVec<T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.data
    }
}

fn main() {
    let mut my_vec = MyVec::new();

    *my_vec = vec![1, 2, 3];

    println!("{:?}", my_vec);  // 输出: MyVec { data: [1, 2, 3] }
}

```

### 1.2 `Drop` trait
`Drop` trait：
- 用于定义类型在离开作用域时释放资源的行为。
- 定义了一个方法 `drop`，该方法在值离开作用域时自动调用，用于执行资源的释放操作。
- 通过实现 `Drop` trait，可以在类型离开作用域时执行自定义的清理逻辑，比如关闭文件、释放内存等操作。
- `Drop` trait 的实现是隐式的，编译器会自动调用 `drop` 方法。

需要注意的是，`Drop` trait 的实现是自动的，编译器会在值离开作用域时自动调用 `drop` 方法。

示例代码：

```rust

// 自定义类型 MyType 实现 Drop trait
struct MyType {
    // 一些资源
}

impl Drop for MyType {
    fn drop(&mut self) {
        // 资源的释放操作
    }
}

fn main() {
    let value = MyBox(5);
    println!("Value: {}", *value);  // 解引用操作
    
    let _obj = MyType;  // 值离开作用域时自动调用 Drop trait 的 drop 方法
}
```
#### std::mem::drop
`std::mem::drop` 是 Rust 标准库中的一个函数，用于显式释放一个值的所有权并调用其析构函数。它接受一个值作为参数，并在当前作用域中立即调用该值的 `Drop` 实现。使用 `std::mem::drop` 可以手动触发一个值的析构函数，并在当前作用域中释放它的所有权。这在需要手动管理资源的情况下特别有用，例如释放内存或关闭文件句柄等。


示例用法：
```rust
struct MyStruct {
    data: String,
}

impl Drop for MyStruct {
    fn drop(&mut self) {
        println!("Dropping MyStruct with data: {}", self.data);
    }
}

fn main() {
    let my_struct = MyStruct {
        data: String::from("Hello, World!"),
    };

    // 使用 drop 函数释放 my_struct 的所有权
    std::mem::drop(my_struct);

    // 这里不再拥有 my_struct 的所有权
    // 无法再使用 my_struct
}
```

接下来，我们会将讨论的重点集中到标准库中最为常见的那些智能指针上：
- ``Box<T>``，可用于在堆上分配值。
- ```Rc<T>```，允许多重所有权的引用计数类型。
- `Ref<T>`和`RefMut<T>`，可以通过``RefCell<T>``访问，是一种可以在运行时而不是编译时执行借用规则的类型。

## 2. Box
``Box<T>`` 将数据存储在堆上，并在栈中保留一个指向堆数据的指针。装箱常常被用于下面的场景中：
1. 当你拥有一个无法在编译时确定大小的类型，但又想要在一个要求固定尺寸的上下文环境中使用这个类型的值时。
2. 当你需要传递大量数据的所有权，但又不希望产生大量数据的复制行为时。
3. 当你希望拥有一个实现了指定trait的类型值，但又不关心具体的类型时。

### 2.1 使用装箱定义递归类型
Rust必须在编译时知道每一种类型占据的空间大小，但是递归（recursive）的类型却无法在编译时被确定具体大小。装箱有一个固定的大小，我们只需要在递归类型的定义中使用装箱便可以创建递归类型了。

在 rust 中定义递归数据结构可以使用如下这种方式，这种方式语法是完全对的，但是因为 rust 无法在编译时确定类型的具体大小，所以会编译错误:

```rust
enum List {
    Cons(i32, List),
    Nil,
}
```

所以这里可以使用 ``Box<T>``，实现与其他语言类似的，在递归数据结构中保存指向下一个值的指针，而不是引用。

```rust
enum List {
    Cons(i32, Box<List>),
    Nil,
}

use crate::List::{Cons, Nil};

fn main() {
    let list = Cons(1,
        Box::new(Cons(2,
            Box::new(Cons(3,
                Box::new(Nil))))));
}
```

其实这里更有意思的点是为什么这里不能使用引用，我觉得有以下几个原因:
1. 首先 rust 里面引用与生命周期关联，如果这里使用引用，就会导致定义一个递归数据结构的语法非常复杂
2. rust 里的引用，语义表示的是一种借用关系，但是这里的语义是 List 直接持有数据，所以语义也不符合
3. 所以使用一个全新 ``Box<T>`` 表示这种持有数据的指针是最适合的。


### 2.2 Rc
Rust提供了一个名为``Rc<T>``的类型来支持多重所有权。``Rc<T>``类型的实例会在内部维护一个用于记录值引用次数的计数器，从而确认这个值是否仍在使用。需要注意的是，``Rc<T>``只能被用于单线程场景中。

### 2.2 RefCell
`RefCell<T>`和内部可变性模式:
1. 内部可变性（interior mutability）是Rust的设计模式之一，它允许你在只持有不可变引用的前提下对数据进行修改；
2. 通常而言，类似的行为会被借用规则所禁止。为了能够改变数据，内部可变性模式在它的数据结构中使用了unsafe（不安全）代码来绕过Rust正常的可变性和借用规则。
3. 假如我们能够保证自己的代码在运行时符合借用规则，那么就可以在即使编译器无法在编译阶段保证符合借用规则的前提下，也能使用那些采取了内部可变性模式的类型。

与`Rc<T>`不同，`RefCell<T>`类型代表了其持有数据的唯一所有权。那么，`RefCell<T>`和`Box<T>`的区别究竟在哪里呢？
1. 对于使用一般引用和`Box<T>`的代码，Rust会在编译阶段强制代码遵守这些借用规则。
2. 而对于使用`RefCell<T>`的代码，Rust则只会在运行时检查这些规则，并在出现违反借用规则的情况下触发panic来提前中止程序。

与`Rc<T>`相似，`RefCell<T>`只能被用于单线程场景中。下面是选择使用`Box<T>`、`Rc<T>`还是`RefCell<T>`的依据：
- `Rc<T>`允许一份数据有多个所有者，而`Box<T>`和`RefCell<T>`都只有一个所有者。
- `Box<T>`允许在编译时检查的可变或不可变借用，`Rc<T>`仅允许编译时检查的不可变借用，`RefCell<T>`允许运行时检查的可变或不可变借用。
- 由于`RefCell<T>`允许我们在运行时检查可变借用，所以即便`RefCell<T>`本身是不可变的，我们仍然能够更改其中存储的值。
内部可变性模式允许用户更改一个不可变值的内部数据。

我们会在创建不可变和可变引用时分别使用语法&与&mut。对于RefCell<T>而言，我们需要使用borrow与borrow_mut方法来实现类似的功能，这两者都被作为RefCell<T>的安全接口来提供给用户。borrow方法和borrow_mut方法会分别返回Ref<T>与RefMut<T>这两种智能指针。