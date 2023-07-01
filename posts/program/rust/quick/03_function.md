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

## 1. 函数
问: 给出rust 的代码示例，内容太包括不限于: 有关函数的各种特性，包括不限于 定义、传参方式、闭包、匿名函数、异常处理、函数重载、匿名参数、函数回调、高阶函数、函数式编程、方法重写、函数指针和函数返回多个值。单独给出代码示例

```rust
// 函数定义和传参方式
fn add(x: i32, y: i32) -> i32 {
    x + y
}

fn increment(x: &mut i32) {
    *x += 1;
}

// 闭包和匿名函数
fn calculate(callback: impl Fn(i32, i32) -> i32, x: i32, y: i32) -> i32 {
    callback(x, y)
}

fn main() {
    // 函数调用
    let result = add(3, 4);
    println!("Addition result: {}", result);

    // 异常处理
    let division_result = divide(10, 0);
    match division_result {
        Ok(value) => println!("Division result: {}", value),
        Err(error) => println!("Error: {}", error),
    }

    // 函数回调和高阶函数
    let multiply_result = calculate(|a, b| a * b, 5, 6);
    println!("Multiplication result: {}", multiply_result);

    // 函数指针和函数返回多个值
    let operation: fn(i32, i32) -> i32 = add;
    let function_result = operation(2, 3);
    println!("Function pointer result: {}", function_result);

    let (name, age) = get_name_age();
    println!("Name: {}, Age: {}", name, age);
}

// 异常处理
fn divide(x: i32, y: i32) -> Result<i32, &'static str> {
    if y == 0 {
        Err("Cannot divide by zero")
    } else {
        Ok(x / y)
    }
}

// 函数返回多个值
fn get_name_age() -> (&'static str, u32) {
    ("Alice", 25)
}
```

## 2. 闭包

### 2.1 闭包的类型推断和类型标注
和fn定义的函数不同，闭包并不强制要求你标注参数和返回值的类型：
1. 在函数定义中进行类型标注，是因为类型信息是暴露给用户的显式接口的一部分。
2. 严格定义接口有助于所有人对参数和返回值的类型取得明确共识。
3. 但是，闭包并不会被用于这样的暴露接口：它们被存储在变量中，在使用时既不需要命名，也不会被暴露给代码库的用户。
4. 闭包通常代码量很少，且只在狭窄的代码上下文中使用，在这种限定环境下，编译器能够可靠地推断出闭包参数的类型及返回值的类型，就像是编译器能够推断出大多数变量的类型一样。
5. 和变量一样，假如你愿意为了明确性而接受不必要的繁杂作为代价，仍然可以为闭包手动添加类型标注

```rust
// 为闭包添加类型标注
let expensive_closure = |num: u32| -> u32 {
    println!("calculating slowly...");
    thread::sleep(Duration::from_secs(2));
    num
};

// 下面的函数和闭包是等价的
fn  add_one_v1   (x: u32) -> u32     { x + 1 }
let add_one_v2 = |x: u32| -> u32     { x + 1 };
let add_one_v3 = |x|                 { x + 1 };
// 只有一个表达式的前提下省去了花括号
let add_one_v4 = |x|                   x + 1  ;
```

### 2.2 使用泛型参数和Fn trait来存储闭包
闭包的类型:
1. 每一个闭包实例都有它自己的匿名类型
2. 即便两个闭包拥有完全相同的签名，它们的类型也被认为是不一样的
3. 为了在结构体、枚举或函数参数中使用闭包，需要使用泛型及trait约束
4. 标准库中提供了一系列Fn trait，而所有的闭包都至少实现了Fn、FnMut及FnOnce中的一个trait。
5. 函数同样也可以实现这3个Fn trait

```rust
struct Cacher<T>
    // Fn的trait约束中添加代表了闭包参数和闭包返回值的类型
    where T: Fn(u32) -> u32
{
    calculation: T,
    value: Option<u32>,
}


impl<T> Cacher<T>
  where T: Fn(u32) -> u32
{
   fn new(calculation: T) -> Cacher<T> {
        Cacher {
            calculation,
            value: None,
        }
    }

   fn value(&mut self, arg: u32) -> u32 {
        match self.value {
            Some(v) => v,
            None => {
                let v = (self.calculation)(arg);
                self.value = Some(v);
                v
            },
        }
    }
}
```

### 2.3 Fn、FnMut及FnOnce
闭包可以引用自身封闭作用域中的变量，引用变量的方式与函数接收参数的3种方式是完全一致的：获取所有权、可变借用及不可变借用，分别对应下面 3 重 Fn 的 trait 中:
1. FnOnce
    - 获取变量所有权
    - 闭包在定义时取得这些变量的所有权并将它们移动至闭包中。
    - Once一词的含义：因为闭包不能多次获取并消耗掉同一变量的所有权，所以它只能被调用一次。
2. FnMut
    - 可变借用
3. Fn
    - 不可变借用


创建闭包时，Rust会基于闭包从环境中使用值的方式来自动推导出它需要使用的trait:
1. 所有闭包都自动实现了FnOnce，因为它们至少都可以被调用一次。
2. 只需可变借用的闭包还会实现FnMut
3. 只需不可变借用闭包则同时实现了 Fn 
3. 强制闭包获取变量所有权，可以在参数列表前添加move关键字。

## 3. 迭代器
所有的迭代器都实现了定义于标准库中的Iterator trait:
1. type Item和Self::Item，定义了trait的关联类型（associated type）。
2. 为了实现Iterator trait，必须定义一个具体的Item类型，而这个Item类型会被用作next方法的返回值类型。即Item类型将是迭代器返回元素的类型。

```rust
pub trait Iterator {
    // 
    type Item;

    fn next(&mut self) -> Option<Self::Item>;

    // 这里省略了由Rust给出的默认实现方法
}

fn iterator_demonstration() {
    let v1 = vec![1, 2, 3];

    // `let mut v1_iter `: v1_iter必须是可变的，因为调用next方法改变了迭代器内部用来记录序列位置的状态
    // for循环不要求v1_iter可变，因为循环取得了v1_iter的所有权并在内部使得它可变了。
    let mut v1_iter = v1.iter();

    assert_eq!(v1_iter.next(), Some(&1));
}
```

### 3.1 生成迭代器的方法

以下是 Rust 中常见的生成迭代器的方法：

| 方法                          | 描述                                                               |
|-------------------------------|--------------------------------------------------------------------|
| `iter()`                      | 将集合（数组、向量、哈希表等）转换为迭代器                             |
| `iter_mut()`                  | 将可变集合（数组、向量、哈希表等）转换为可变迭代器                       |
| `into_iter()`                 | 将所有权转移给迭代器，适用于拥有所有权的集合                          |
| `range()`                     | 生成一个升序或降序的范围迭代器，包含起始值和结束值                   |
| `repeat()`                    | 生成一个重复指定元素的迭代器                                         |
| `cycle()`                     | 生成一个无限循环指定集合的迭代器                                     |
| `empty()`                     | 生成一个空的迭代器                                                   |
| `once()`                      | 生成一个只包含一个元素的迭代器                                       |
| `from()`                      | 将一个可迭代对象转换为迭代器                                         |
| `chars()`                     | 对字符串生成字符迭代器                                               |
| `lines()`                     | 对字符串按行生成迭代器                                               |
| `split()`                     | 对字符串按指定分隔符生成迭代器                                       |
| `keys()`                      | 对哈希表生成键迭代器                                                 |
| `values()`                    | 对哈希表生成值迭代器                                                 |
| `enumerate()`                 | 将迭代器中的元素转换为元组，其中包含元素的索引和值                     |
| `filter()`                    | 根据指定条件过滤迭代器中的元素                                       |
| `map()`                       | 对迭代器中的元素进行映射转换                                         |
| `flat_map()`                  | 对迭代器中的每个元素执行指定的操作并展平结果                         |
| `zip()`                       | 将两个迭代器中的元素一对一地进行配对                                 |
| `chain()`                     | 将多个迭代器连接起来形成一个新的迭代器                               |
| `take()`                      | 从迭代器中获取指定数量的元素                                         |
| `skip()`                      | 跳过迭代器中指定数量的元素                                           |
| `cycle()`                     | 生成一个无限循环的迭代器                                             |
| `step_by()`                   | 以指定的步长遍历迭代器中的元素                                       |
| `inspect()`                   | 对迭代器中的元素执行指定的操作，同时保持元素不变                     |
| `scan()`                      | 对迭代器中的元素进行累积操作，并返回累积的结果                       |
| `rev()`                       | 反转迭代器中的元素                                                   |
| `cloned()`                    | 对迭代器中的引用类型进行克隆                                         |
| `copied()`                    | 对迭代器中的引用类型进行复制                                         |
| `filter_map()`                | 对迭代器中的元素进行过滤和映射转换                                   |
| `unzip()`                     | 将元组的迭代器拆分为多个迭代器                                       |
| `product()`                   | 计算迭代器中的元素的笛卡尔积                                         |
| `permutations()`              | 生成迭代器中元素的所有排列                                           |
| `combinations()`              | 生成迭代器中元素的所有组合                                           |
| `intersperse()`               | 在迭代器中的元素之间插入指定的分隔符                                 |
| `chunks()`                    | 将迭代器中的元素分组为固定大小的块                                   |
| `windows()`                   | 在迭代器中滑动窗口地获取连续的子序列                                 |
| `merge()`                     | 合并多个已排序的迭代器                                               |
| `dedup()`                     | 移除迭代器中连续的重复元素                                           |
| `chain()`                     | 将多个迭代器连接起来形成一个新的迭代器                               |
| `flatten()`                   | 将嵌套的迭代器展平为一个迭代器                                       |

### 3.2 消耗迭代器的方法

以下是 Rust 中常见的消耗迭代器的方法：

| 方法                          | 描述                                                               |
|-------------------------------|--------------------------------------------------------------------|
| `collect()`                   | 将迭代器中的元素收集到一个集合中                                     |
| `count()`                     | 计算迭代器中的元素个数                                               |
| `for_each()`                  | 对迭代器中的每个元素执行指定的操作                                   |
| `min()`                       | 获取迭代器中的最小值                                                 |
| `max()`                       | 获取迭代器中的最大值                                                 |
| `sum()`                       | 计算迭代器中的元素的总和                                             |
| `product()`                   | 计算迭代器中的元素的乘积                                             |
| `any()`                       | 判断迭代器中是否存在满足指定条件的元素                               |
| `all()`                       | 判断迭代器中的所有元素是否都满足指定条件                             |
| `find()`                      | 查找迭代器中满足指定条件的第一个元素                                 |
| `position()`                  | 查找迭代器中满足指定条件的第一个元素的索引                           |
| `nth()`                       | 获取迭代器中指定索引的元素                                           |
| `last()`                      | 获取迭代器中的最后一个元素                                           |
| `next()`                      | 获取迭代器中的下一个元素                                             |
| `partition()`                 | 将迭代器中的元素按指定条件分割成两个迭代器                           |
| `fold()`                      | 对迭代器中的元素进行累积操作                                         |
| `reduce()`                    | 对迭代器中的元素进行二元操作的累积                                   |
| `max_by()`                    | 根据指定的比较函数获取迭代器中的最大值                               |
| `min_by()`                    | 根据指定的比较函数获取迭代器中的最小值                               |
| `partition_map()`             | 将迭代器中的元素根据指定的映射函数分割成两个迭代器                     |
| `unzip()`                     | 将元组的迭代器拆分为多个迭代器                                       |
| `collect_into()`              | 将迭代器中的元素收集到指定的集合中                                   |
| `sum_by()`                    | 根据指定的映射函数计算迭代器中的元素的总和                           |
| `try_fold()`                  | 对迭代器中的元素进行累积操作，可处理可能出现的错误                   |
| `try_reduce()`                | 对迭代器中的元素进行二元操作的累积，可处理可能出现的错误             |
| `group_by()`                  | 根据指定的键生成一个分组迭代器                                       |
| `try_for_each()`              | 对迭代器中的每个元素执行指定的操作，可处理可能出现的错误             |
| `try_rfold()`                 | 对迭代器中的元素进行反向累积操作，可处理可能出现的错误               |
| `try_scan()`                  | 对迭代器中的元素进行扫描操作，可处理可能出现的错误                   |
| `try_last()`                  | 获取迭代器中的最后一个元素，可处理可能出现的错误                     |
| `try_fold_while()`            | 对迭代器中的元素进行累积操作，同时处理可能出现的错误和中止条件       |
| `try_find_map()`              | 查找迭代器中满足指定条件的第一个元素，并执行映射函数，可处理可能出现的错误 |
| `try_filter_map()`            | 过滤迭代器中的元素，并执行映射函数，可处理可能出现的错误               |
| `try_partition_map()`         | 将迭代器中的元素根据指定的映射函数分割成两个迭代器，可处理可能出现的错误 |
| `try_unzip()`                 | 将元组的迭代器拆分为多个迭代器，可处理可能出现的错误                   |

### 3.3 自定义迭代器

```rust
struct MyIterator {
    start: u32,
    end: u32,
    current: u32,
}

impl MyIterator {
    fn new(start: u32, end: u32) -> Self {
        Self {
            start,
            end,
            current: start,
        }
    }
}

impl Iterator for MyIterator {
    // 将迭代器的关联类型Item指定为了u32
    type Item = u32;

    fn next(&mut self) -> Option<Self::Item> {
        if self.current <= self.end {
            let value = self.current;
            self.current += 1;
            Some(value)
        } else {
            None
        }
    }
}
```

现在，使用自定义的迭代器 `MyIterator` 来进行迭代操作，例如：

```rust
fn main() {
    let my_iterator = MyIterator::new(1, 5);

    for num in my_iterator {
        println!("{}", num);
    }
}
```
