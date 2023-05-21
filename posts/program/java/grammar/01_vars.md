---
weight: 1
title: "Java 变量及流程控制"
date: 2021-01-02T22:00:00+08:00
lastmod: 2021-01-02T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 变量及流程控制"
featuredImage: 

tags: ["go 语法"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

## 1. 变量定义和声明

| 变量声明方式 | Java                                            | Go                                            |
| ------------ | ----------------------------------------------- | --------------------------------------------- |
| 声明变量     | `int x;`<br>`String name;`                      | `var x int;`<br>`var name string;`            |
| 声明并初始化 | `int x = 10;`<br>`String name = "John";`        | `x := 10`<br>`name := "John"`                 |
| 声明多个变量 | `int x = 10, y = 20, z = 30;`<br>`String name1, name2;` | `x, y, z := 10, 20, 30`<br>`var name1, name2 string` <br>`var b, f, s = true, 2.3, "four"` |
| 变量推导     | `var x = 10;`<br>`var name = "John";`           | `x := 10`<br>`name := "John"`                 |

## 2. 条件判断和循环

| 条件和循环语句 | Java                                                         | Go                                                            |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| if语句         | `if (x > 0) {`<br>`    System.out.println("x is positive");`<br>`} else if (x < 0) {`<br>`    System.out.println("x is negative");`<br>`} else {`<br>`    System.out.println("x is zero");`<br>`}` | `if x > 0 {`<br>`    fmt.Println("x is positive")`<br>`} else if x < 0 {`<br>`    fmt.Println("x is negative")`<br>`} else {`<br>`    fmt.Println("x is zero")`<br>`}` |
| for循环        | `for (int i = 0; i < 10; i++) {`<br>`    System.out.println(i);`<br>`}`<br>`for (int i : arr) {`<br>`    System.out.println(i);`<br>`}` | `for i := 0; i < 10; i++ {`<br>`    fmt.Println(i)`<br>`}`<br>`for _, num := range arr {`<br>`    fmt.Println(num)`<br>`}` |
| while和do-while循环   | `while (condition) {`<br>`    // 循环体`<br>`}`<br>`do {`<br>`    // 循环体`<br>`} while (condition);` | Go中没有`while`和`do-while`循环 |

需要注意的是，Java和Go中的条件和循环语句基本相同，但在语法上有一些差异。例如:
1. 在Java中使用for循环时可以使用for-each循环来遍历数组,而Go中则使用range关键字来遍历数组。
3. 在Java中有while和do-while循环，而在Go中则没有这两种循环语句。



## 3. switch

| `switch`语法 | Java                                                         | Go                                                            |
| ------------ | ------------------------------------------------------------ | ------------------------------------------------------------- |
| 基本语法     | <pre lang="java">switch (expression) {<br>    case value1:<br>        // 当expression的值等于value1时执行的代码块<br>        break;<br>    case value2:<br>        // 当expression的值等于value2时执行的代码块<br>        break;<br>    default:<br>        // 当expression的值都不等于任何一个case语句的值时执行的代码块<br>}</pre> | <pre lang="go">switch expression {<br>    case value1:<br>        // 当expression的值等于value1时执行的代码块<br>    case value2:<br>        // 当expression的值等于value2时执行的代码块<br>    default:<br>        // 当expression的值都不等于任何一个case语句的值时执行的代码块<br>}</pre> |
| 多个值的匹配 | <pre lang="java">switch (expression) {<br>    case value1:<br>    case value2:<br>        // 当expression的值等于value1或value2时执行的代码块<br>        break;<br>    default:<br>        // 当expression的值都不等于任何一个case语句的值时执行的代码块<br>}</pre> | <pre lang="go">switch expression {<br>    case value1, value2:<br>        // 当expression的值等于value1或value2时执行的代码块<br>    default:<br>        // 当expression的值都不等于任何一个case语句的值时执行的代码块<br>}</pre> |
| 表达式匹配   | <pre lang="java">switch (day) {<br>    case MONDAY, FRIDAY, SUNDAY:<br>        // 当day的值等于MONDAY、FRIDAY或SUNDAY时执行的代码块<br>        break;<br>    case TUESDAY:<br>        // 当day的值等于TUESDAY时执行的代码块<br>        break;<br>    case THURSDAY:<br>        // 当day的值等于THURSDAY时执行的代码块<br>        break;<br>    case SATURDAY:<br>    case WEDNESDAY:<br>        // 当day的值等于SATURDAY或WEDNESDAY时执行的代码块<br>        break;<br>    default:<br>        // 当day的值都不等于任何一个case语句的值时执行的代码块<br>}</pre> | <pre lang="go">switch day {<br>    case MONDAY, FRIDAY, SUNDAY:<br>        // 当day的值等于MONDAY、FRIDAY或SUNDAY时执行的代码块<br>    case TUESDAY:<br>        // 当day的值等于TUESDAY时执行的代码块<br>    case THURSDAY:<br>        // 当day的值等于THURSDAY时执行的代码块<br>    case SATURDAY, WEDNESDAY:<br>        // 当day的值等于SATURDAY或WEDNESDAY时执行的代码块<br>    default:<br>        // 当day的值都不等于任何一个case语句的值时执行的代码块<br>}</pre> |

需要注意的是，Java和Go中的`switch`语句有一些差异。在Java中，`switch`语句的每个`case`语句末尾必须使用`break`语句来结束该`case`语句，否则代码会继续执行下一个`case`语句的代码块。而在Go中，`case`语句的末尾不需要使用`break`语句，代码会自动跳出`switch`语句。此外，Go中的`switch`语句可以接受多个值的匹配，可以更加简洁地编写代码。