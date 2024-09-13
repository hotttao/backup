---
weight: 1
title: "流控"
date: 2024-09-01T10:11:12+08:00
lastmod: 2024-09-01T10:11:12+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "流控"
featuredImage: 

tags: ["javascript 语法"]
categories: ["javascript"]

lightgallery: true

toc:
  auto: false
---


## 流控
以列表为展示方式，从以下方面对比 JavaScript ES6 和 Python，请尽可能详细
流控:
1. 条件
2. 循环
3. switch
3. 运算符和优先级
4. 表达式的求值顺序

以下是 JavaScript ES6 和 Python 在流控方面的详细对比，涵盖了条件语句、循环、`switch` 语句、运算符和优先级、以及表达式的求值顺序：

### 1. 条件

**JavaScript ES6:**
- **`if` 语句**:
  - JavaScript 使用 `if`, `else if`, 和 `else` 关键字进行条件判断。
  - 条件语句支持多种数据类型的隐式转换，如非空字符串、非零数字和非空对象都被视为 `true`。
  ```javascript
  let x = 10;
  if (x > 5) {
    console.log("x is greater than 5");
  } else if (x === 5) {
    console.log("x is 5");
  } else {
    console.log("x is less than 5");
  }
  ```

- **三元运算符**:
  - 使用 `condition ? expr1 : expr2` 进行简单的条件判断和赋值。
  ```javascript
  let result = x > 5 ? "greater" : "not greater";
  ```

**Python:**
- **`if` 语句**:
  - Python 使用 `if`, `elif`, 和 `else` 关键字进行条件判断。
  - Python 条件判断同样支持多种数据类型的隐式转换，如非空字符串、非零数字和非空对象都被视为 `True`。
  ```python
  x = 10
  if x > 5:
      print("x is greater than 5")
  elif x == 5:
      print("x is 5")
  else:
      print("x is less than 5")
  ```

- **三元运算符**:
  - 使用 `expr1 if condition else expr2` 进行简单的条件判断和赋值。
  ```python
  result = "greater" if x > 5 else "not greater"
  ```

### 2. 循环

**JavaScript ES6:**
- **`for` 循环**:
  - JavaScript 的 `for` 循环有三种形式：
    1. **传统的 `for` 循环**，使用初始化、条件和递增/递减表达式。
    ```javascript
    for (let i = 0; i < 5; i++) {
      console.log(i);
    }
    ```
    2. **`for...of` 循环**，用于遍历数组、字符串、集合、映射等可迭代对象。
    ```javascript
    let arr = [1, 2, 3];
    for (let value of arr) {
      console.log(value);
    }
    ```
    3. **`for...in` 循环**，用于遍历对象的可枚举属性。
    ```javascript
    let obj = {a: 1, b: 2, c: 3};
    for (let key in obj) {
      console.log(key, obj[key]);
    }
    ```

- **`while` 和 `do...while` 循环**:
  - `while` 循环在条件为真时执行循环体。
  - `do...while` 循环至少执行一次循环体，然后根据条件决定是否继续执行。
  ```javascript
  let i = 0;
  while (i < 5) {
    console.log(i);
    i++;
  }

  do {
    console.log(i);
    i--;
  } while (i > 0);
  ```

**Python:**
- **`for` 循环**:
  - Python 的 `for` 循环用于遍历序列（如列表、元组、字符串）或其他可迭代对象。
  ```python
  for i in range(5):
      print(i)
  ```

- **`while` 循环**:
  - `while` 循环在条件为真时执行循环体。Python 没有 `do...while` 循环。
  ```python
  i = 0
  while i < 5:
      print(i)
      i += 1
  ```

- **`else` 子句**:
  - Python 的 `for` 和 `while` 循环支持 `else` 子句，只有当循环正常结束（没有被 `break` 中断）时才会执行。
  ```python
  for i in range(5):
      print(i)
  else:
      print("Loop completed without break")
  ```

### 3. `switch` 语句

**JavaScript ES6:**
- **`switch` 语句**:
  - `switch` 语句用于执行多个条件的不同代码块。使用 `break` 防止执行落空（fall-through）。
  ```javascript
  let day = 2;
  switch (day) {
    case 1:
      console.log("Monday");
      break;
    case 2:
      console.log("Tuesday");
      break;
    default:
      console.log("Invalid day");
  }
  ```

**Python:**
- **`match` 语句（Python 3.10+）**:
  - Python 3.10 引入了 `match` 语句，类似于 `switch`，用于模式匹配。
  ```python
  day = 2
  match day:
      case 1:
          print("Monday")
      case 2:
          print("Tuesday")
      case _:
          print("Invalid day")
  ```

### 4. 运算符和优先级

以下是 JavaScript ES6 中的运算符及其优先级的表格展示，优先级从高到低排序：

| 优先级 | 运算符                          | 描述                                     |
|-------|--------------------------------|------------------------------------------|
| 20    | `()`                           | 圆括号，用于提升表达式的优先级                |
| 19    | `.` `[]` `()`                  | 成员访问、数组下标、函数调用                    |
| 18    | `new`                          | 创建实例                                   |
| 17    | `++` `--`                      | 前置/后置自增和自减运算符                        |
| 16    | `!` `~` `+` `-` `typeof` `void` `delete` | 逻辑非、按位非、一元加、一元减、类型、未定义值、删除 |
| 15    | `**`                           | 幂运算符                                   |
| 14    | `*` `/` `%`                    | 乘法、除法、取模                              |
| 13    | `+` `-`                        | 加法、减法                                  |
| 12    | `<<` `>>` `>>>`                | 按位左移、按位右移、无符号右移                     |
| 11    | `<` `<=` `>` `>=` `in` `instanceof` | 小于、小于等于、大于、大于等于、是否包含、实例检查      |
| 10    | `==` `!=` `===` `!==`          | 等于、不等于、严格等于、严格不等于                  |
|  9    | `&`                            | 按位与                                     |
|  8    | `^`                            | 按位异或                                    |
|  7    | `\|`                            | 按位或                                     |
|  6    | `&&`                           | 逻辑与                                     |
|  5    | `\|\|`                           | 逻辑或                                     |
|  4    | `??`                           | 空值合并操作符                               |
|  3    | `?:`                           | 条件（三元）运算符                             |
|  2    | `=` `+=` `-=` `*=` `/=` `%=` `<<=` `>>=` `>>>=` `&=` `^=` `\|=` | 赋值及复合赋值运算符  |
|  1    | `yield` `yield*`               | 生成器函数中的生成值                           |
|  0    | `,`                            | 逗号运算符（用于多表达式求值）                    |

该表格列出了 JavaScript ES6 中的常见运算符，按优先级从高到低排列。优先级越高，运算符在表达式中被首先计算。

### 5. 表达式的求值顺序

**JavaScript ES6:**
- **从左到右**:
  - 大多数运算符按从左到右的顺序进行求值，除了赋值运算符和三元运算符。
  - `++` 和 `--` 运算符根据前缀或后缀位置决定求值顺序。
  ```javascript
  let a = 1;
  let b = a++ + 2;  // b = 3, a = 2
  let c = ++a + 2;  // c = 5, a = 3
  ```

- **短路求值**:
  - `&&` 和 `||` 运算符使用短路求值，即在已确定结果时停止评估剩余表达式。
  ```javascript
  let x = false && (y = 5);  // y 不会被赋值
  let z = true || (a = 6);   // a 不会被赋值
  ```
