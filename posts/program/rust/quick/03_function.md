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

