---
weight: 1
title: "Solidity 复合数据类型"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Solidity 变量与数据类型"
featuredImage: 

tags: ["Solidity 语法"]
categories: ["Solidity"]

lightgallery: true

toc:
  auto: false
---


## 1. 字符和字符串
在 Solidity 中，字符和字符串的使用和实现有其独特之处。Solidity 主要使用 `string` 和 `bytes` 类型来处理文本数据。

1. Solidity 并没有单独的字符类型（如 `char`），但可以通过 `bytes1` 类型表示单个字节的字符。
2. Solidity 支持两种主要的字符串类型：
    1. `string`：用于动态长度的 UTF-8 编码字符串。
    2. `bytes`：用于动态长度的字节数组。

此外，还有 `bytes1` 到 `bytes32` 的固定长度字节数组类型。

### 1.1 使用 `string` 类型

`string` 类型适用于存储和操作文本数据。需要注意的是，`string` 类型在 Solidity 中是 UTF-8 编码的。


```solidity
pragma solidity ^0.8.0;

contract StringExample {
    string public greeting = "Hello, Solidity!";

    function setGreeting(string memory _greeting) public {
        greeting = _greeting;
    }

    function getGreeting() public view returns (string memory) {
        return greeting;
    }
}
```

### 1.2 使用 `bytes` 类型

`bytes` 类型用于存储任意长度的字节数组，适合需要直接操作字节数据的场景。


```solidity
pragma solidity ^0.8.0;

contract BytesExample {
    bytes public data;

    function setData(bytes memory _data) public {
        data = _data;
    }

    function getData() public view returns (bytes memory) {
        return data;
    }
}
```

### 1.3 字符串和字节数组的转换

在 Solidity 中，可以在字符串和字节数组之间进行转换。

```solidity
pragma solidity ^0.8.0;

contract StringBytesConversion {
    function stringToBytes(string memory s) public pure returns (bytes memory) {
        return bytes(s);
    }

    function bytesToString(bytes memory b) public pure returns (string memory) {
        return string(b);
    }
}
```

## 2. 数组类型
问: Solidity 中的数组

在 Solidity 中，数组是用于存储多个相同类型数据的集合。Solidity 支持静态数组和动态数组，并提供了一些内置函数和操作来管理和操作数组。下面我们详细介绍 Solidity 中数组的使用方法和实现，并提供相应的代码示例。

### 2.1 数组类型

1. **静态数组**：长度固定的数组。
2. **动态数组**：长度可变的数组。

#### 2.1.1 静态数组

静态数组的长度在编译时确定，不能改变。

```solidity
pragma solidity ^0.8.0;

contract StaticArrayExample {
    // 声明一个长度为 5 的 uint 类型静态数组
    uint[5] public myArray = [1, 2, 3, 4, 5];
}
```

#### 2.1.2 动态数组
在 Solidity 中，动态数组可以通过多种方式进行初始化。以下是常见的初始化方法：

1. **直接声明并初始化为空数组**

   ```solidity
   uint[] public dynamicArray;
   ```

2. **在声明时使用字面量初始化**

   ```solidity
   uint[] public dynamicArray = [1, 2, 3];
   ```

3. **使用 `new` 关键字初始化指定长度的数组**
   ```solidity
    uint[] public dynamicArray = new uint[](5); // 初始化一个长度为 5 的数组
   ```

4. **在函数内初始化**

   ```solidity
    // 对于memory修饰的动态数组，可以用new操作符来创建，但是必须声明长度，并且声明后长度不能改变

   function initializeArray() public {
       // memory动态数组 的长度不可改变
       uint[] memory dynamicArray = new uint[](5);
       dynamicArray[0] = 1;
       dynamicArray[1] = 2;
       dynamicArray[2] = 3;
       // 其他元素默认初始化为 0
   }
   ```

5. **通过函数参数初始化**

   ```solidity
   function setArray(uint[] memory _array) public {
       dynamicArray = _array;
   }
   ```

6. **使用 `push` 方法逐个元素添加**

   ```solidity
   uint[] public dynamicArray;

   function addElements() public {
       dynamicArray.push(1);
       dynamicArray.push(2);
       dynamicArray.push(3);
   }
   ```


### 2.3 数组的内置函数

Solidity 提供了一些内置函数来操作数组：

- `push()`: 向动态数组的末尾添加一个元素。
- `pop()`: 从动态数组的末尾移除一个元素。
- `length`: 获取数组的长度。

## 3. mappiing

`mapping(_KeyType => _ValueType)`
1. 规则1：映射的_KeyType只能选择Solidity内置的值类型，_ValueType可以使用自定义的类型
2. 规则2：映射的存储位置必须是storage，不能用于public函数的参数或返回结果中
3. 规则3：如果映射声明为public，那么Solidity会自动给你创建一个getter函数，可以通过Key来查询对应的Value
4. 原理1: 映射使用keccak256(abi.encodePacked(key, slot))当成offset存取value，其中slot是映射变量定义所在的插槽位置。