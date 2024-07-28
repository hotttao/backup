---
weight: 1
title: "Solidity 类"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Solidity 类"
featuredImage: 

tags: ["Solidity 语法"]
categories: ["Solidity"]

lightgallery: true

toc:
  auto: false
---

## 1. 接口和类定义
问: 以表格的形式，对比 Solidity 和Go 中的接口、实现、类、抽象类、继承
以下是对比 Solidity 和 Go 中的接口、实现、类、抽象类、继承的表格：

| 特性                   | Solidity                                      | Go                                        |
|------------------------|-----------------------------------------------|-------------------------------------------|
| **接口**               | `interface`                                   | `interface`                               |
| **实现接口**           | 合约可以实现多个接口                           | 类型隐式实现接口，通过实现所有接口方法      |
| **类**                 | Solidity 没有类的概念，但合约类似类            | Go 没有类的概念，通过结构体和方法模拟      |
| **抽象类**             | `abstract contract`                           | Go 没有抽象类，使用接口和具体类型实现抽象   |
| **继承**               | 单继承：`contract A is B`                      | 没有类继承，通过组合实现重用                |
| **多继承**             | 支持接口和合约的多继承                         | 不支持多继承，使用组合和接口实现            |
| **构造函数**           | `constructor`                                 | 没有构造函数概念，通过结构体初始化实现      |
| **方法重写**           | `virtual` 和 `override` 关键字                 | 不支持方法重写，通过接口实现多态            |


## 2. 类与继承
问: 给出代码示例，说明 Solidity 多构造方法、方法重载、isinstance、final、如何覆写 Object 的方法、静态方法


### 构造函数（Constructor）

构造函数在合约部署时执行一次，用于初始化合约的状态。

```solidity
pragma solidity ^0.8.0;

contract Example {
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
}
```

### 函数重载（Function Overloading）

Solidity支持函数重载，即同名函数可以有不同的参数列表。

```solidity
pragma solidity ^0.8.0;

contract Example {
    function overloadedFunction(uint a) public pure returns (uint) {
        return a;
    }
    
    function overloadedFunction(uint a, uint b) public pure returns (uint) {
        return a + b;
    }
}
```

### 回退函数（Fallback Function）

回退函数是在合约接收以太币或调用不存在的函数时执行的函数。Solidity 0.6.0及之后版本区分了`fallback`和`receive`函数。

```solidity
pragma solidity ^0.8.0;

contract Example {
    // receive函数：仅用于接收以太币
    receive() external payable {
        // 接收以太币时执行的代码
    }
    
    // fallback函数：当调用不存在的函数或发送数据但没有指定函数时执行
    fallback() external payable {
        // 接收以太币或调用不存在的函数时执行的代码
    }
}
```

### 2.1 this 变量
在方法内部，可以使用一个隐含的变量this，它始终指向当前实例。因此，通过this.field就可以访问当前实例的字段。如果没有命名冲突，可以省略this。例如：

```Solidity
class Person {
    private String name;

    public String getName() {
        return name; // 相当于this.name
    }
}
```

