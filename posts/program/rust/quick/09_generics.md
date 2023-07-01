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

#### 覆盖实现
所谓覆盖实现即为某个 trait 实现另一个 trait。比如标准库对所有满足Display trait约束的类型实现了ToString trait。

这样所有实现了 Display trait 的类型，都可以直接调用 ToString trait中的to_string方法。

```rust
// 表示为
impl<T: Display> ToString for T {
    // --略--
}
```

#### 有条件的使用方法
借助泛型和 trait 我们可以单独为实现了指定trait的类型编写方法。比如上面的 Point
1. 我们可以给所有类型实现 new 方法
2. 但是只给实现了PartialOrd（用于比较）与Display（用于打印）trait 的类型实现cmd_display方法

```rust
impl<T> Pair<T> {
    fn new(x: T, y: T) -> Self {
        Self {
            x,
            y,
        }
    }
}

impl<T: Display + PartialOrd> Pair<T> {
    fn cmp_display(&self) {
        if self.x >= self.y {
            println!("The largest member is x = {}", self.x);
        } else {
            println!("The largest member is y = {}", self.y);
        }
    }
}
```

### 2.2 trait 使用限制
在 Rust 中，对于使用 trait 有一些限制和约束：
1. 当为一个类型实现一个 trait 时，要么是当前 crate 的类型，要么是当前 crate 中定义的 trait。这是为了避免不受你控制的类型实现你的 trait。
2. 在一个 trait 中，不能有关联常量或关联类型与默认实现共存。也就是说，如果为关联常量或关联类型提供了默认值，那么不能为相关方法提供默认实现。

## 3. 生命周期
生命周期
1. 生命周期用来确保引用在我们的使用过程中一直有效。其最主要的目标在于避免悬垂引用。
2. Rust的每个引用都有自己的生命周期（lifetime），它对应着引用保持有效性的作用域。
3. Rust编译器拥有一个借用检查器（borrow checker），它被用于比较不同的作用域并确定所有借用的合法性。

### 3.1 生命周期标注语法
生命周期标注被用于描述多个引用生命周期之间的关系。
1. 它们的参数名称必须以撇号（'）开头，且通常使用全小写字符。
2. 'a被大部分开发者选择作为默认使用的名称
3. 生命周期参数的标注在&引用运算符之后，并通过一个空格符来将标注与引用类型区分开来。

| 语法                               | 描述                                                                                                   |
|----------------------------------|--------------------------------------------------------------------------------------------------------|
| `'a`、`'b`、`'c` 等              | 生命周期参数，用于函数签名或结构体/枚举定义中表示生命周期的参数名。                                       |
| `&'a T`                           | 带有显式生命周期标注的引用类型，表示引用的生命周期与标注的生命周期参数 `'a` 相关联。                          |
| `&'a mut T`                       | 带有显式生命周期标注的可变引用类型，表示引用的生命周期与标注的生命周期参数 `'a` 相关联。                      |
| `fn foo<'a>(x: &'a T)`            | 函数定义中使用生命周期参数 `'a`，表示参数 `x` 的生命周期与 `'a` 相关联。                                    |
| `struct MyStruct<'a> { ... }`     | 结构体定义中使用生命周期参数 `'a`，表示结构体内部字段的引用的生命周期与 `'a` 相关联。                        |
| `impl<'a> MyTrait for T<'a> { ... }` | 实现 trait 时使用生命周期参数 `'a`，表示 trait 中使用的引用的生命周期与 `'a` 相关联。                          |
| `where 'a: 'b`                    | 生命周期限定语法，表示生命周期 `'a` 至少与生命周期 `'b` 一样长，用于约束引用的生命周期关系。                   |
| `&'a T: 'b`、`&'a mut T: 'b`        | 生命周期限定语法，表示引用的生命周期 `'a` 需要至少与生命周期 `'b` 一样长，用于约束引用的生命周期关系。           |
| `for<'a> ...`                     | 用于函数、闭包或 trait 中，表示引入一个新的生命周期参数 `'a`，在范围内有效。                                 |
| `'static`                         | 特殊生命周期标识符，表示静态生命周期，表示引用的生命周期与整个程序的运行时间一样长。                           |
| `'_`                              | 匿名生命周期标识符，表示编译器自动推断的生命周期，用于省略生命周期标注时的默认推断。                           |

这些生命周期标注语法使得 Rust 编译器能够进行准确的借用检查和生命周期推断，确保引用的有效性和安全性。


```rust
// 这里的函数签名表明：参数与返回值中的所有引用都必须拥有相同的生命周期。
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
}
```

#### 函数定义中的生命周期

可以这么理解生命周期的标注语法:
1. `'a`、`'b`、`'c` 代表不同的生命周期长度
2. 当不同参数和变量，被相同的标注修饰时(`'a`)，表明这些变量将拥有至少等同于 `'a` 的生命周期。
3. 当我们在函数签名中指定生命周期参数时，我们并没有改变任何传入值或返回值的生命周期。我们只是向借用检查器指出了一些可以用于检查非法调用的约束。
4. 对于上面的 longest 函数，当我们将具体的引用传入longest时，被用于替代'a的具体生命周期就是作用域x与作用域y重叠的那一部分。换句话说，泛型生命周期'a会被具体化为x与y两者中生命周期较短的那一个。因为我们将返回的引用也标记为了生命周期参数'a，所以返回的引用在具化后的生命周期范围内都是有效的。

在下面的示例中:
1. longest 中 `'a` 指代的生命周期是 string1、string2 中较小的即 string2 的生命周期
2. longest 的返回值拥有与 `'a` 相同的生命周期
3. 但是 result 的生命周期要大于 `'a` 对应的 string2 的生命周期，所以这个引用将出现悬垂引用

```rust
fn main() {
    let string1 = String::from("long string is long");
    let result;
    {
        let string2 = String::from("xyz");
        result = longest(string1.as_str(), string2.as_str());
    }
    println!("The longest string is {}", result);
}
```

#### 结构体定义中的生命周期
我们可以在结构体中定义自持有类型。我们也可以在结构体中存储引用，不过需要为结构体定义中的每一个引用都添加生命周期标注。

```rust
// 'a 标注意味着ImportantExcerpt实例的存活时间不能超过存储在part字段中的引用的存活时间
struct ImportantExcerpt<'a> {
  part: &'a str,
}

```

#### 方法定义中的生命周期标注
为某个拥有生命周期的结构体实现方法时:
1. 声明和使用生命周期参数的位置取决于它们是与结构体字段相关，还是与方法参数、返回值相关。
2. 结构体字段中的生命周期名字总是需要被声明在impl关键字之后，并被用于结构体名称之后，因为这些生命周期是结构体类型的一部分。

```rust
struct StringStorage<'a> {
    data: &'a str,
}

impl<'a> StringStorage<'a> {
    fn new(data: &'a str) -> StringStorage<'a> {
        StringStorage { data }
    }

    fn get_length(&self) -> usize {
        self.data.len()
    }
}

```

### 3.2 生命周期省略规则
函数参数或方法参数中的生命周期被称为输入生命周期（input lifetime），而返回值的生命周期则被称为输出生命周期（output lifetime）。

在没有显式标注的情况下，编译器目前使用了3种规则来计算引用的生命周期:
1. 每一个引用参数都会拥有自己的生命周期参数。换句话说，单参数函数拥有一个生命周期参数：fn foo<'a>(x: &'a i32)；双参数函数拥有两个不同的生命周期参数：fn foo<'a, 'b>(x: &'a i32, y: &'b i32)；以此类推。
2. 当只存在一个输入生命周期参数时，这个生命周期会被赋予给所有输出生命周期参数，例如fn foo<'a>(x: &'a i32) -> &'a i32。
3. 当拥有多个输入生命周期参数，而其中一个是&self或&mut self时，self的生命周期会被赋予给所有的输出生命周期参数。

如果编译器已经使用了全部生命周期省略规则，却依然无法计算出签名中所有引用的生命周期，那么编译器就会报错。

### 3.3 静态生命周期
Rust中还存在一种特殊的生命周期'static，它表示整个程序的执行期。所有的字符串字面量都拥有'static生命周期，我们可以像下面一样显式地把它们标注出来：

```rust
let s: &'static str = "I have a static lifetime.";
```

### 3.4 同时使用泛型参数、trait约束与生命周期

```rust
use std::fmt::Display;

fn longest_with_an_announcement<'a, T>(x: &'a str, y: &'a str, ann: T) -> &'a str
    where T: Display
{
    println!("Announcement! {}", ann);
    if x.len() > y.len() {
        x
    } else {
        y
    }
}
```