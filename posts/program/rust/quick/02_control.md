---
weight: 1
title: "Rust 流控"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Rust 流程控制，作用域与表达式求值顺序"
featuredImage: 

tags: ["rust 语法"]
categories: ["Rust"]

lightgallery: true

toc:
  auto: false
---

## 1. 条件判断和循环
问: 以表格的方式，对比 java 和 rust 中条件和循环

下面是Java和Rust中条件和循环的对比表格，包括语法和代码示例：

| 功能       | Java                                   | Rust                                                          |
|------------|----------------------------------------|---------------------------------------------------------------|
| 条件语句   | ```if (condition) { ... } else { ... }``` | ```if condition { ... } else { ... }```                        |
|            | ```switch (variable) { case value: ... }``` | ```match variable { value => ... }```                      |
| 循环语句   | ```for (int i = 0; i < 5; i++) { ... }``` | ```for i in 0..5 { ... }```                                 |
|            | ```while (condition) { ... }```         | ```while condition { ... }```                               |
|            | ```do { ... } while (condition);```     | ```loop { ...; if condition { break; } }```                 |
|            |                                        | ```for item in iterable { ... }```                           |
|            |                                        | ```for (index, item) in iterable.enumerate() { ... }```      |


## 2. switch
问: 对比一下 Rust 和 java 的 switch 语法，以表格形式展示



## 3. 变量的生命周期与作用域
由于 Rust 并不像 Go 一样存在一些隐式作用域，所以在变量作用域上 Rust 基本上就是所见即所得，不存在类似 Go 语言中 for "陷阱的问题"

## 4. 数值运算的优先级

问: Rust 中数据运算的运算符和优先级，以表格形式展示，优先级从上到下优先级从高到低，并给出代码示例

| 运算符 | 优先级 | 含义 | 代码示例 |
| --- | --- | --- | --- |
| () |  | 括号 | `(a + b) * c` |
| ++ -- |  | 前缀自增自减 | `++a` |
| ++ -- |  | 后缀自增自减 | `a++` |
| + - |  | 正负号 | `+a` |
| * |  | 乘法 | `a * b` |
| / |  | 除法 | `a / b` |
| % |  | 取模（求余） | `a % b` |
| + |  | 加法 | `a + b` |
| - |  | 减法 | `a - b` |
| << >> >>> |  | 位运算 | `a << b` |
| < <= > >= |  | 比较运算 | `a < b` |
| == != |  | 相等性比较 | `a == b` |
| & |  | 位与 | `a & b` |
| ^ |  | 位异或 | `a ^ b` |
| \| |  | 位或 | `a \| b` |
| && |  | 逻辑与 | `a && b` |
| \|\| |  | 逻辑或 | `a \|\| b` |
| ?: |  | 条件运算 | `a > b ? a : b` |
| = += -= *= /= %= <<= >>= &= ^= \|= |  | 赋值运算 | `a += b` |


需要注意的是
1. Rust 中的 `==` 运算符比 `=` 运算符优先级高
2. Rust 中的位运算符包括左移运算符 `<<`、右移运算符 `>>` 和无符号右移运算符 `>>>` 都比比较运算符和相等性比较运算符的优先级要高。

下面是一些示例代码：

```Rust
int a = 10, b = 5, c = 2;
int result = (a + b) * c;  // 使用括号改变优先级
int x = 5, y = ++x;        // 前缀自增运算符
int m = 5, n = m++;        // 后缀自增运算符
int p = +a, q = -b;        // 正负号运算符
int r = a * b, s = a / b, t = a % b;  // 乘除取模运算符
int u = a << 2, v = a >> 2, w = a >>> 2;  // 位运算符
boolean flag =a > b && c < d;  // 逻辑运算符
int max = a > b ? a : b;  // 条件运算符
a += b;  // 赋值运算符
```

## 5. 表达式的求值顺序