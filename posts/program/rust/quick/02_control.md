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


## 2. 条件判断和循环
问: 以表格的方式，对比 java 和 rust 中条件和循环，并给出代码示例

下面是Java和Rust中条件和循环的对比表格，包括代码示例：

|           | Java                                                      | Rust                                      |
|-----------|-----------------------------------------------------------|-------------------------------------------|
| 条件语句  | `if`、`else if`、`else`、`switch`                            | `if`、`else if`、`else`、`match`               |
| 循环语句  | `for`、`while`、`do-while`                                 | `for`、`while`、`loop`                             |
| 跳出循环  | `break`、`continue`                                         | `break`、`continue`                                 |
| 循环控制  | `for-each`循环（遍历数组或集合）                              | `for-each`循环（遍历数组或迭代器）                    |
| 迭代器    | 支持`Iterator`接口，使用`hasNext()`和`next()`方法来遍历元素       | 使用`Iterator` trait，通过`next()`方法来遍历元素         |
| 范围循环  | 在Java 5之后引入`for-each`循环，使用迭代器或数组访问循环中的元素 | 在Rust中没有直接的范围循环，可以使用`for`和`Range`类型来实现 |
| 条件表达式 | 三元运算符`condition ? trueValue : falseValue`                | `if`语句可以作为表达式使用                            |

代码中的条件表达式必须产生一个bool类型的值，否则就会触发编译错误。Rust不会自动尝试将非布尔类型的值转换为布尔类型。

下面是对应的代码示例：

**Java 示例：**

```java
// 条件语句
int x = 5;
if (x > 0) {
    System.out.println("x is positive");
} else if (x < 0) {
    System.out.println("x is negative");
} else {
    System.out.println("x is zero");
}

// 循环语句
for (int i = 0; i < 5; i++) {
    System.out.println(i);
}

int i = 0;
while (i < 5) {
    System.out.println(i);
    i++;
}

int j = 0;
do {
    System.out.println(j);
    j++;
} while (j < 5);

// 循环控制 - for-each循环
int[] nums = {1, 2, 3, 4, 5};
for (int num : nums) {
    System.out.println(num);
}

// 条件表达式
int a = 5;
int b = (a > 0) ? 10 : -10;
System.out.println(b);
```

**Rust 示例：**

```rust
// 条件语句
let x = 5;
if x > 0 {
    println!("x is positive");
} else if x < 0 {
    println!("x is negative");
} else {
    println!("x is zero");
}

// 循环语句

let mut i = 0;
while i < 5 {
    println!("{}", i);


    i += 1;
}

let mut j = 0;
loop {
    println!("{}", j);
    j += 1;
    if j >= 5 {
        break;
    }
}

// 循环控制 - for-each循环
let nums = [1, 2, 3, 4, 5];
for num in &nums {
    println!("{}", num);
}

for i in 0..5 {
    println!("{}", i);
}

for element in nums.iter() {
    println!("Array element: {}", element);
}
// 条件表达式
let a = 5;
let b = if a > 0 { 10 } else { -10 };
println!("{}", b);
```

## 3. 变量的生命周期与作用域
由于 Rust 并不像 Go 一样存在一些隐式作用域，所以在变量作用域上 Rust 基本上就是所见即所得，不存在类似 Go 语言中 for "陷阱的问题"

## 4. 数值运算的优先级

问: Rust 中数据运算的运算符和优先级，以表格形式展示，优先级从上到下优先级从高到低，并给出代码示例

以下是 Rust 中常见的数据运算符和它们的优先级，按照从高到低的顺序排列：

| 运算符          | 描述                               | 代码示例                          |
| --------------- | ---------------------------------- | --------------------------------- |
| `()`            | 用于函数调用                         | `function_name(arg1, arg2)`       |
| `.`             | 用于访问结构体和枚举成员             | `struct_instance.field_name`      |
| `[]`            | 用于访问数组和切片元素               | `array_name[index]`               |
| `()`            | 用于将值进行分组                     | `(a + b) * c`                     |
| `!`             | 逻辑非                             | `!condition`                      |
| `-`             | 一元负号                           | `-number`                         |
| `*`             | 乘法                               | `a * b`                           |
| `/`             | 除法                               | `a / b`                           |
| `%`             | 取模（取余数）                      | `a % b`                           |
| `+`             | 加法                               | `a + b`                           |
| `-`             | 减法                               | `a - b`                           |
| `<<`            | 左移                               | `a << b`                          |
| `>>`            | 右移                               | `a >> b`                          |
| `&`             | 按位与                             | `a & b`                           |
| `^`             | 按位异或                           | `a ^ b`                           |
| `|`             | 按位或                             | `a | b`                           |
| `==`, `!=`      | 相等、不相等                       | `a == b`, `a != b`                |
| `<`, `<=`       | 小于、小于等于                     | `a < b`, `a <= b`                 |
| `>`, `>=`       | 大于、大于等于                     | `a > b`, `a >= b`                 |
| `&&`            | 逻辑与                             | `condition1 && condition2`        |
| `||`            | 逻辑或                             | `condition1 \|\| condition2`      |
| `=`             | 赋值                               | `variable = value`                |
| `+=`, `-=`, ... | 复合赋值运算符（加法赋值、减法赋值等） | `variable += value`               |

下面是一些使用上述运算符的代码示例：

```rust
fn main() {
    let a = 10;
    let b = 5;
    let c = 2;

    let result1 = a + b * c;         // 10 + (5 * 2) = 20
    let result2 = (a + b) * c;       // (10 + 5) * 2 = 30
    let result3 = a % b;             // 10 % 5 = 0
    let result4 = a == b;            // 10 == 5 -> false
    let result5 = !(a > b);          // !(10 > 5) -> false

    println!("Result 1: {}", result1);
    println!("Result 
```
## 5. 表达式的求值顺序