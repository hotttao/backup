---
weight: 1
title: "Solidity 简介"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Solidity 简介和 Solidity 中的基础术语"
featuredImage: 

tags: ["Solidity 语法"]
categories: ["Solidity"]

lightgallery: true

toc:
  auto: false
---

## 1. Solidity 简介
在我们学习一门语言之前，有一些专业名词是需要我们了解的。对于 Solidity，有一下基本的专业术语:


### 1. **合约（Contract）**
合约是Solidity的基本单位，包含代码和数据。合约在区块链上具有自己的地址，能够与其他合约和账户进行交互。

```solidity
contract MyContract {
    // 合约代码
}
```

### 5. **修饰符（Modifier）**
修饰符是可以用于修改函数行为的特殊函数。有点类似于装饰器。

```solidity
modifier onlyOwner() {
    require(msg.sender == owner);
    _;
}

function restrictedFunction() public onlyOwner {
    // 函数代码
}
```

### 6. **事件（Event）**
事件是用于记录合约操作的日志，可以被外部消费者（如DApp）捕获。

```solidity
event MyEvent(address indexed _from, uint _value);

function emitEvent() public {
    emit MyEvent(msg.sender, 100);
}
```

### 7. **映射（Mapping）**
映射是存储键值对的特殊数据结构。

```solidity
mapping(address => uint) public balances;
```

### 11. **修饰符**
修饰符用于定义函数和状态变量的访问控制。

- `public`: 任何人都可以访问
- `private`: 只有当前合约可以访问
- `internal`: 只有当前合约和继承的合约可以访问
- `external`: 只有外部账户和其他合约可以访问

### 12. **存储位置（Storage Location）**
Solidity中有三种存储位置，用于指定变量的存储位置：

- `storage`: 永久存储在区块链上
- `memory`: 临时存储在内存中
- `calldata`: 函数参数存储在只读存储区


### 16. **全局变量（Global Variable）**
全局变量提供区块链相关的信息。

- `msg.sender`: 调用者的地址
- `msg.value`: 发送的以太币数量
- `block.number`: 当前区块号
- `block.timestamp`: 当前区块的时间戳

### 17. **构造函数（Constructor）**
构造函数在合约部署时执行一次，用于初始化合约的状态。

```solidity
constructor() {
    owner = msg.sender;
}
```

### 18. **继承（Inheritance）**
合约可以从其他合约继承属性和方法。

```solidity
contract Base {
    // 基本合约代码
}

contract Derived is Base {
    // 派生合约代码
}
```

### 19. **接口（Interface）**
接口定义了一组函数，合约必须实现这些函数。

```solidity
interface MyInterface {
    function myFunction() external;
}
```

### 20. **抽象合约（Abstract Contract）**
抽象合约不能被实例化，必须被其他合约继承并实现其未实现的函数。

```solidity
abstract contract AbstractContract {
    function myFunction() public virtual;
}
```

这些术语和概念是Solidity中最常用和最重要的部分，理解它们对于编写和理解Solidity智能合约非常重要。