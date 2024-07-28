---
weight: 1
title: "Solidity 流控"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Solidity 流程控制，作用域与表达式求值顺序"
featuredImage: 

tags: ["Solidity 语法"]
categories: ["Solidity"]

lightgallery: true

toc:
  auto: false
---

## 1. 条件判断和循环
问: 以表格的方式，对比 Solidity 和go 中条件和循环，表格中加入 Solidity 的 for-each 语法 和 go 的 for range 语法
以下是 Solidity 和 Go 中条件和循环语法的对比表格，包括 Solidity 的 `for-each` 语法和 Go 的 `for range` 语法：

| 语言     | 结构       | 语法示例                                                        | 描述                                                         |
| -------- | ---------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| **Solidity** | `if`        | ```solidity<br>if (condition) {<br>    // code<br>}<br>else if (condition) {<br>    // code<br>}<br>else {<br>    // code<br>}<br>``` | 条件语句，支持 `if-else if-else` 结构                         |
|            | `while`     | ```solidity<br>while (condition) {<br>    // code<br>}<br>``` | `while` 循环，直到条件为 `false` 时停止循环                  |
|            | `do-while`  | ```solidity<br>do {<br>    // code<br>}<br>while (condition);<br>``` | 先执行代码块，再检查条件                                     |
|            | `for`       | ```solidity<br>for (uint i = 0; i < n; i++) {<br>    // code<br>}<br>``` | `for` 循环，支持初始化语句、条件表达式和迭代语句             |
|            | `for-each`  | ```solidity<br>uint[] memory arr = [1, 2, 3];<br>for (uint i = 0; i < arr.length; i++) {<br>    uint value = arr[i];<br>    // code<br>}<br>``` | Solidity 没有直接的 `for-each` 语法，可以通过 `for` 循环实现 |
| **Go**      | `if`        | ```go<br>if condition {<br>    // code<br>} else if condition {<br>    // code<br>} else {<br>    // code<br>}<br>``` | 条件语句，支持 `if-else if-else` 结构                         |
|            | `while`     | 无直接的 `while` 语法，使用 `for` 实现                        | ```go<br>for condition {<br>    // code<br>}<br>``` |
|            | `do-while`  | 无直接的 `do-while` 语法，使用 `for` 实现                    | ```go<br>for {<br>    // code<br>    if !condition {<br>        break<br>    }<br>}<br>``` |
|            | `for`       | ```go<br>for i := 0; i < n; i++ {<br>    // code<br>}<br>``` | `for` 循环，支持初始化语句、条件表达式和迭代语句             |
|            | `for-each`  | ```go<br>arr := []int{1, 2, 3}<br>for _, value := range arr {<br>    // code<br>}<br>``` | `for range` 语法，用于遍历数组、切片、映射和通道            |

### 详细示例

#### Solidity 示例

```solidity
pragma solidity ^0.8.0;

contract Example {
    function conditionalAndLoops() public pure {
        // if-else
        uint x = 10;
        if (x < 10) {
            // code
        } else if (x == 10) {
            // code
        } else {
            // code
        }

        // while
        uint i = 0;
        while (i < 10) {
            // code
            i++;
        }

        // do-while
        i = 0;
        do {
            // code
            i++;
        } while (i < 10);

        // for
        for (uint j = 0; j < 10; j++) {
            // code
        }

        // for-each (simulated using for loop)
        uint ;
        arr[0] = 1;
        arr[1] = 2;
        arr[2] = 3;
        for (uint k = 0; k < arr.length; k++) {
            uint value = arr[k];
            // code
        }
    }
}
```



## 3. 数值运算的优先级

问: Solidity 中数据运算的运算符和优先级，以表格形式展示，优先级从上到下优先级从高到低，并给出代码示例


| 优先级 | 运算符                         | 描述                                     | 示例                                           |
|------|------------------------------|----------------------------------------|----------------------------------------------|
| 1    | `()`                         | 圆括号                                   | `a = (b + c) * d;`                           |
| 2    | `++`, `--`                   | 单目运算符（前缀和后缀）                       | `i++`, `--j`                                 |
| 3    | `+`, `-`                     | 一元加、一元减                               | `+a`, `-b`                                   |
| 4    | `**`                         | 指数运算符                                  | `a ** b`                                     |
| 5    | `*`, `/`, `%`                | 乘法、除法、取模                              | `a * b`, `a / b`, `a % b`                    |
| 6    | `+`, `-`                     | 加法、减法                                  | `a + b`, `a - b`                             |
| 7    | `<<`, `>>`                   | 左移、右移                                  | `a << b`, `a >> b`                           |
| 8    | `<`, `<=`, `>`, `>=`         | 小于、小于等于、大于、大于等于                       | `a < b`, `a <= b`, `a > b`, `a >= b`         |
| 9    | `==`, `!=`                   | 相等、不相等                                 | `a == b`, `a != b`                           |
| 10   | `&`                          | 按位与                                    | `a & b`                                      |
| 11   | `^`                          | 按位异或                                   | `a ^ b`                                      |
| 12   | `|`                          | 按位或                                    | `a | b`                                      |
| 13   | `&&`                         | 逻辑与                                    | `a && b`                                     |
| 14   | `||`                         | 逻辑或                                    | `a || b`                                     |
| 15   | `? :`                        | 条件运算符                                  | `a ? b : c`                                  |
| 16   | `=`, `+=`, `-=`, `*=`, `/=`, `%=`, `<<=`, `>>=`, `&=`, `^=`, |= | 赋值及复合赋值运算符                             | `a = b`, `a += b`, `a -= b`, 等。                 |

### 代码示例

```solidity
pragma solidity ^0.8.0;

contract OperatorPrecedence {
    function example() public pure returns (uint) {
        uint a = 2;
        uint b = 3;
        uint c = 4;
        uint d = 5;

        // 圆括号优先
        uint result1 = (a + b) * c; // result1 = 20

        // 单目运算符（后缀）
        uint result2 = a++; // result2 = 2, a = 3

        // 单目运算符（前缀）
        uint result3 = ++b; // result3 = 4, b = 4

        // 一元加、一元减
        int result4 = -int(a); // result4 = -3

        // 指数运算符
        uint result5 = a ** b; // result5 = 81 (3^4)

        // 乘法、除法、取模
        uint result6 = c * d / a; // result6 = 6 (20 / 3)

        // 加法、减法
        uint result7 = a + b - c; // result7 = 3 (3 + 4 - 4)

        // 左移、右移
        uint result8 = a << 1; // result8 = 6 (3 * 2)
        uint result9 = d >> 1; // result9 = 2 (5 / 2)

        // 小于、小于等于、大于、大于等于
        bool result10 = a < d; // result10 = true
        bool result11 = a >= b; // result11 = false

        // 相等、不相等
        bool result12 = a == b; // result12 = false
        bool result13 = a != c; // result13 = true

        // 按位与
        uint result14 = a & b; // result14 = 0 (0011 & 0100 = 0000)

        // 按位异或
        uint result15 = a ^ b; // result15 = 7 (0011 ^ 0100 = 0111)

        // 按位或
        uint result16 = a | b; // result16 = 7 (0011 | 0100 = 0111)

        // 逻辑与
        bool result17 = (a > 1) && (d < 10); // result17 = true

        // 逻辑或
        bool result18 = (a > 3) || (d < 10); // result18 = true

        // 条件运算符
        uint result19 = a > b ? a : b; // result19 = 4

        // 赋值及复合赋值运算符
        uint result20 = 1;
        result20 += a; // result20 = 4 (1 + 3)

        return result1;
    }
}
```
