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

以下是Solidity和Go中接口、实现、类、抽象类、继承的对比，包含各自的定义、用法以及示例代码。

| 特性          | Solidity                                                | Go                                                    |
|---------------|----------------------------------------------------------|-------------------------------------------------------|
| **接口**      | 使用`interface`定义接口，只声明方法，不实现              | 使用`interface`定义接口，只声明方法，不实现           |
| **实现**      | 合约通过实现接口中的方法来实现接口                        | 类型通过实现接口中的方法来实现接口                     |
| **类**        | Solidity没有类的概念，但合约可以类比类                    | Go没有类的概念，但结构体可以类比类                     |
| **抽象类**    | 使用`abstract`定义抽象合约，包含未实现的方法              | Go没有抽象类的概念                                     |
| **继承**      | 使用`is`关键字实现继承，支持多重继承                      | 使用嵌套结构体模拟继承，不支持多重继承                 |

### Solidity

1. **接口**

```solidity
pragma solidity ^0.8.0;

interface MyInterface {
    function myFunction() external;
}
```

2. **实现**

```solidity
pragma solidity ^0.8.0;

contract MyContract is MyInterface {
    function myFunction() external override {
        // 实现方法
    }
}
```

3. **类（合约）**

```solidity
pragma solidity ^0.8.0;

contract MyContract {
    uint public value;

    function setValue(uint _value) public {
        value = _value;
    }
}
```

4. **抽象类**

```solidity
pragma solidity ^0.8.0;

abstract contract AbstractContract {
    function myFunction() public virtual;
}

contract ConcreteContract is AbstractContract {
    function myFunction() public override {
        // 实现抽象方法
    }
}
```

5. **继承**

```solidity
pragma solidity ^0.8.0;

contract Base {
    function baseFunction() public pure returns (string memory) {
        return "Base";
    }
}

contract Derived is Base {
    function derivedFunction() public pure returns (string memory) {
        return "Derived";
    }
}
```


## 2. 合约
Solidity 合约大体相当于其他语言的类的概念。



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

