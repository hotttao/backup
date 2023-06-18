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

## 2. Rust 中的语句和表达式
由于Rust是一门基于表达式的语言，所以它将语句（statement）与表达式（expression）区别为两个不同的概念
1. 语句指那些执行操作但不返回值的指令
2. 表达式则是指会进行计算并产生一个值作为结果的指令

下面是 Rust 中语句（Statements）和表达式（Expressions）的对比列表：

语句（Statements）                  | 表达式（Expressions）                                           
-----------------------------------|-----------------------------------
执行一个操作，不返回值               | 生成一个值作为表达式的结果                                      
以分号结尾                         | 以表达式的结果作为值，不需要分号                                  
不能被赋值给变量                   | 可以被赋值给变量                                               
不具有返回值                       | 具有返回值                                                      
不产生新的作用域                   | 产生新的作用域，可以嵌套使用                                    
不能作为函数或方法的返回值         | 可以作为函数或方法的返回值                                      
不能用于条件语句、循环和函数体等   | 可以用于条件语句、循环和函数体等|


问: 举出 rust 哪些属于语句，哪些不属于语句

在 Rust 中，以下是常见的属于语句（Statements）和不属于语句的构造：

属于语句（Statements）             | 不属于语句（Expressions）                       
---------------------------------|---------------------------------
变量绑定 (let)                    | 数值计算                                    
....      | 函数调用                                      
....              | 匿名函数 (闭包)                             
....       | 方法调用                                     
模式匹配 (match)                   | 运算符表达式 (例如 +、-、*、/)               
赋值表达式 (例如 x = 5)           | 字符串操作 (例如拼接、格式化)                
返回语句 (return)                 | 结构体实例化                                  
打印语句 (例如 println!)           | 枚举变体的构造                              
断言语句 (例如 assert!)           | 闭包调用 (例如闭包作为函数参数)                
引用借用、解引用等语句 (例如 &、* ) | 数组或向量的访问 (例如 array[index])           
语句块 (使用花括号包围的一组语句)    | 条件表达式 (例如三元运算符)                    
类型声明语句 (例如 let x: i32;)    | 类型转换表达式 (例如 as、into、from等)   
...                                | 创建新作用域的花括号（{}）同样也是表达式      

语句不会返回值。因此像 `let x = (let y = 6);` 在 rust 是错误的。例如C语言或Ruby语言中的赋值语句会返回所赋的值，在这些语言中，你可以编写类似于x = y = 6这样的语句

#### 花括号（{}）作为表达式
创建新作用域的花括号（{}）同样也是表达式:
```rust

// 表达式示例
fn expression_example() -> i32 {
    let x = 5;                             // 赋值语句
    let y = {                              // 块表达式
        let z = 10;
        // z + 5 没有添加分号，有分号就会变成语句
        z + 5                              // 表达式作为值返回
    };
    x + y                                  // 表达式作为函数返回值
}

fn main() {
    statement_example();
    let result = expression_example();
    println!("Result: {}", result);
}

```
注意上面的代码中 `z + 5`, `x + y` 没有添加分号，有分号就会变成语句:

```rust
// 会出现编译错误
let y = {                              // 块语句
        let z = 10;
        z + 5;                         
    };
```

所以 Rust 中的 if、else 和 while 既可以作为语句使用，也可以作为表达式使用，具体取决花括号的最后一行是表达式还是语句。另外 rust 中是可以从循环中返回值的:

```rust
let condition = true; 
    let number = if condition { 
        5 
    } else { 
        6 
    }; 

let mut counter = 0; 
let result = loop { 
    counter += 1; 

    if counter == 10 { 
        break counter * 2; 
    } 
}; 

```

在Rust中:
1. 函数的返回值等同于函数体最后一个表达式的值**。
2. 可以使用return关键字并指定一个值来提前从函数中返回，但大多数函数都隐式地返回了最后的表达式。
3. 如果函数没有 return，最后一行也不是表达式，Rust 将默认返回一个空元组
