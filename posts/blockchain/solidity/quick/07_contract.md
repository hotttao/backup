---
weight: 1
title: "Solidity 中的地址和合约"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Solidity 如何定义和导入模块"
featuredImage: 

tags: ["Solidity 语法"]
categories: ["Solidity"]

lightgallery: true

toc:
  auto: false
---

Solidity 中的 Contract 相比于其他语言中的类，多了很多的"交易属性"。
1. 首先合约有地址，相当于账户，可以交易
2. 交易过程中可以释放事件，相当于交易日志
3. 交易可以回退和撤销。

## 1. 地址类型
在 Solidity 中，`address` 类型用于表示以太坊地址:
- **长度**: `address` 类型的长度为 20 字节（160 位）。
- **存储**: 地址类型用于存储以太坊地址，例如用户账户地址或合约地址。
- **操作**: 可以对 `address` 类型进行一些特定的操作。

Solidity 中有两种地址类型：
1. **address**: 普通的地址类型。
2. **address payable**: 可支付的地址类型，允许接收以太币。

### 1.1 地址类型的内置方法
`address` 和 `address payable` 类型都包含一些内置的方法和属性。公共方法和属性（适用于 `address` 和 `address payable`）
- `balance`: 返回地址的以太币余额（单位为 wei）。
- `code`: 返回该地址上存储的代码（如果地址是一个合约）。
- `codehash`: 返回该地址上存储的代码的哈希值。
- `transfer(uint256 amount)`: 向该地址发送指定数量的以太币（仅适用于 `address payable`）。
- `send(uint256 amount) returns (bool)`: 向该地址发送指定数量的以太币，返回一个布尔值表示成功或失败（仅适用于 `address payable`）。
- `call(bytes memory) returns (bool, bytes memory)`: 调用该地址上的合约函数，传递数据并返回布尔值和返回数据。
- `delegatecall(bytes memory) returns (bool, bytes memory)`: 使用调用者的上下文调用该地址上的合约函数，传递数据并返回布尔值和返回数据。
- `staticcall(bytes memory) returns (bool, bytes memory)`: 进行静态调用，不允许修改状态，传递数据并返回布尔值和返回数据。

### 示例代码
以下是一些使用 `address` 类型的示例代码，后面我们详细介绍每一个函数的使用。

```solidity
pragma solidity ^0.8.0;

contract AddressExample {
    address public owner;
    address payable public recipient;

    constructor() {
        owner = msg.sender;
        recipient = payable(0x1234567890123456789012345678901234567890);
    }

    function transferToRecipient() public {
        recipient.transfer(1 ether);
    }

    function getOwnerBalance() public view returns (uint256) {
        return owner.balance;
    }

    function callAnotherContract(address _contract, bytes memory _data) public returns (bool, bytes memory) {
        (bool success, bytes memory result) = _contract.call(_data);
        return (success, result);
    }
}
```

## 2. 事件
在 Solidity 中，事件（Events）是合约日志的一种机制，用于在 EVM（以太坊虚拟机）中存储特定的信息。事件允许智能合约将数据存储在交易日志中，这些日志可以由客户端（如 DApp）进行监听和处理。事件通常用于记录合约的重要活动，如状态变化、函数调用结果等。相比与在链上存储一个新变量，使用事件更加经济。


### 2.1 定义和释放事件

事件使用 `event` 关键字定义。事件可以包含多个参数，这些参数可以在事件释放时传递。

```solidity
pragma solidity ^0.8.0;

contract MyContract {
    // 定义事件
    event ValueChanged(address indexed author, uint256 oldValue, uint256 newValue);

    uint256 public value;

    // 修改值的方法，并释放事件
    function setValue(uint256 _value) public {
        uint256 oldValue = value;
        value = _value;

        // 释放事件
        emit ValueChanged(msg.sender, oldValue, _value);
    }
}
```

### 2.2 客户端监听事件

在客户端（如 DApp）中，可以监听和处理已释放的事件。以下是使用 Web3.js 监听事件的示例：

```javascript
const MyContract = new web3.eth.Contract(abi, contractAddress);

// 监听 ValueChanged 事件
MyContract.events.ValueChanged({
    filter: {author: '0x1234567890abcdef1234567890abcdef12345678'}, // 可选的过滤条件
    fromBlock: 0
}, (error, event) => {
    if (error) {
        console.error(error);
    } else {
        console.log(event.returnValues);
    }
});
```


### 2.3 `indexed` 关键字

以太坊虚拟机（EVM）用日志Log来存储Solidity事件，每条日志记录都包含主题topics和数据data两部分。


![EVM LOG](/images/solidity/event_log.png)

#### topics

日志的第一部分是主题数组，用于描述事件，长度不能超过4。它的第一个元素是事件的签名（哈希）。对于上面的Transfer事件，它的事件哈希就是：

```
keccak256("Transfer(address,address,uint256)")
//0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
```

除了事件哈希，主题还可以包含至多3个indexed参数:
1. indexed标记的参数可以理解为检索事件的索引“键”，方便之后搜索。
2. 每个 indexed 参数的大小为固定的256比特，如果参数太大了（比如字符串），就会自动计算哈希存储在主题中。

#### data
事件中不带 indexed的参数会被存储在 data 部分中，可以理解为事件的“值”
1. data 部分的变量不能被直接检索，但可以存储任意大小的数据
2. 因此一般 data 部分可以用来存储复杂的数据结构，例如数组和字符串等等，因为这些数据超过了256比特，即使存储在事件的 topics 部分中，也是以哈希的方式存储
3. data 部分的变量在存储上消耗的gas相比于 topics 更少

## 3. 交易

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