---
weight: 1
title: "Solidity 变量与数据类型"
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

## 1. 变量定义和声明
问: 以表格的方式，对比 Solidity 和go 中变量声明的方式，包括变量推导的声明语法

下面是对比 Solidity 和 Go 中变量声明方式的表格，包括变量推导的声明语法：

| 特性                 | Solidity                                                                 | Go                                                                 |
|----------------------|--------------------------------------------------------------------------|--------------------------------------------------------------------|
| **基本变量声明**     | `uint myVar;`                                                            | `var myVar int`                                                    |
| **初始化声明**       | `uint myVar = 10;`                                                       | `var myVar int = 10`                                               |
| **类型推导**         | 不支持                                                                 | `myVar := 10`                                                      |
| **多变量声明**       | `uint a; uint b;`                                                        | `var a, b int`                                                     |
| **多变量初始化声明** | `uint a = 1; uint b = 2;`                                                | `var a, b int = 1, 2`                                              |
| **常量声明**         | `uint constant myConst = 10;`                                            | `const myConst int = 10`                                           |
| **状态变量**         | `uint public myVar;` （状态变量，自动生成 getter 方法）                    | 不适用（Go 没有状态变量的概念）                                      |
| **局部变量**         | `function foo() { uint localVar = 10; }`                                  | `func foo() { var localVar int = 10 }`                             |
| **全局变量**         | 不适用（Solidity 没有全局变量的概念，只有状态变量）                        | `var globalVar int = 10`（在包级别声明）                           |
| **数组声明**         | `uint[] myArray;`                                                        | `var myArray []int`                                                |
| **数组初始化声明**   | `uint[] myArray = [1, 2, 3];`                                            | `var myArray = []int{1, 2, 3}`                                     |
| **映射声明**         | `mapping(address => uint) public balances;`                              | `var myMap map[string]int`                                         |
| **映射初始化声明**   | `mapping(address => uint) public balances;`（自动初始化为 empty mapping） | `myMap := make(map[string]int)`                                    |
| **结构体声明**       | `struct MyStruct { uint a; uint b; }`                                    | `type MyStruct struct { a int; b int }`                            |
| **结构体变量声明**   | `MyStruct myStruct;`                                                     | `var myStruct MyStruct`                                            |
| **结构体初始化声明** | `MyStruct memory myStruct = MyStruct(1, 2);`（内存分配）                    | `myStruct := MyStruct{a: 1, b: 2}`                                 |

### 解释

1. **基本变量声明**：两种语言都需要指定类型和变量名。
2. **初始化声明**：在声明时初始化变量，两种语言语法相似。
3. **类型推导**：Solidity 不支持类型推导，而 Go 支持使用 `:=` 来进行类型推导。
4. **多变量声明**：Go 支持在一行中声明多个变量，而 Solidity 需要分开声明。
5. **多变量初始化声明**：Go 支持在一行中初始化多个变量，而 Solidity 需要分开声明和初始化。
6. **常量声明**：两种语言都支持声明常量，但语法略有不同。
7. **状态变量**：Solidity 有状态变量的概念，Go 没有。
8. **局部变量**：两种语言的局部变量声明语法相似。
9. **全局变量**：Solidity 没有全局变量的概念，Go 支持在包级别声明全局变量。
10. **数组声明**：两种语言的数组声明语法相似。
11. **数组初始化声明**：两种语言的数组初始化语法相似。
12. **映射声明**：Solidity 有映射类型，Go 使用 map 类型。
13. **映射初始化声明**：Solidity 的映射在声明时自动初始化为空映射，Go 需要用 `make` 初始化映射。
14. **结构体声明**：两种语言的结构体声明语法相似。
15. **结构体变量声明**：两种语言的结构体变量声明语法相似。
16. **结构体初始化声明**：两种语言的结构体初始化语法略有不同。

## 2. 常量以及类型转换

问: 以表格的形式对比 Solidity 和 go 中的常量定义、类型重命名、类型转换、枚举类型、自定义类型

下面是对比 Solidity 和 Go 中常量定义、类型重命名、类型转换、枚举类型、自定义类型的表格：

| 特性                 | Solidity                                                          | Go                                                              |
|----------------------|-------------------------------------------------------------------|-----------------------------------------------------------------|
| **常量定义**         | `uint constant MY_CONST = 10;`                                    | `const MyConst int = 10`                                        |
| **类型重命名**       | `type MyUint = uint;`                                             | `type MyInt int`                                                |
| **类型转换**         | `uint8 a = uint8(b);`                                             | `a := int(b)`                                                   |
| **枚举类型**         | `enum Status { Pending, Shipped, Delivered }`                     | `type Status int` <br> `const (Pending Status = iota, Shipped, Delivered)` |
| **自定义类型**       | `struct MyStruct { uint a; uint b; }`                             | `type MyStruct struct { a int; b int }`                         |

### 解释

1. **常量定义**：
    - **Solidity**：使用 `constant` 关键字定义常量。
    - **Go**：使用 `const` 关键字定义常量。

2. **类型重命名**：
    - **Solidity**：使用 `type` 关键字进行类型重命名。
    - **Go**：使用 `type` 关键字进行类型重命名。

3. **类型转换**：
    - **Solidity**：使用显式转换，例如 `uint8(a)`。
    - **Go**：使用显式转换，例如 `int(a)`。

4. **枚举类型**：
    - **Solidity**：使用 `enum` 关键字定义枚举类型。
    - **Go**：通过定义一个新的类型并使用 `iota` 实现枚举。

5. **自定义类型**：
    - **Solidity**：使用 `struct` 关键字定义结构体。
    - **Go**：使用 `struct` 关键字定义结构体。


## 3. 隐式类型转换
在 Solidity 中，隐式类型转换指的是编译器在不显式转换的情况下自动进行类型转换。这种转换通常发生在某些特定的情况下，例如操作数类型不同的算术运算或赋值过程中。了解隐式类型转换以及其限制和规则非常重要，以避免潜在的错误和意外行为。

### 隐式类型转换的规则

Solidity 的隐式类型转换遵循以下规则：

1. **从较小范围类型到较大范围类型的转换**：例如，从 `uint8` 到 `uint256` 的转换是允许的。
2. **从有符号类型到无符号类型的转换**：例如，从 `int8` 到 `uint8` 的转换是不允许的，因为可能导致数据丢失或变化。
3. **从较低精度到较高精度的转换**：例如，从 `fixed` 到 `ufixed` 的转换是允许的，但反之则不允许。

当隐式类型转换不适用时，可以使用显式类型转换来进行类型转换。

#### 示例 1：从较小范围类型到较大范围类型的转换

```solidity
pragma solidity ^0.8.0;

contract ImplicitConversion {
    function convertSmallToLarge() public pure returns (uint256) {
        uint8 smallNumber = 42;
        uint256 largeNumber = smallNumber; // 隐式转换
        return largeNumber;
    }
}
```

在上述示例中，`uint8` 类型的变量 `smallNumber` 可以隐式转换为 `uint256` 类型的变量 `largeNumber`。


#### 示例 3：从有符号类型到无符号类型的转换

```solidity
pragma solidity ^0.8.0;

contract ImplicitConversion {
    function invalidConversion() public pure returns (uint8) {
        int8 signedNumber = -42;
        // uint8 unsignedNumber = signedNumber; // 编译错误：不允许隐式转换
        return 0;
    }
}
```

在上述示例中，从 `int8` 到 `uint8` 的隐式转换是不允许的，因为可能导致数据丢失或变化。


## 3. 基础类型
### 3.1 数值类型的范围
问: 以表格形式列举 Solidity 中的中的基础数据类型，分为三列，分别是类型，长度，表示的含义，使用惯例的代码示例

下面是 Solidity 中的基础数据类型，以表格形式分别列出类型、长度、表示的含义和使用惯例的代码示例：

| 类型          | 长度               | 表示的含义                           | 使用惯例的代码示例                 |
| --------------| -------------------| -------------------------------------| ---------------------------------- |
| `bool`        | 1 byte             | 布尔值（`true` 或 `false`）           | `bool isTrue = true;`              |
| `int`         | 8 到 256 bits（8 位递增） | 有符号整数                           | `int256 num = -10;`                |
| `uint`        | 8 到 256 bits（8 位递增） | 无符号整数                           | `uint256 num = 10;`                |
| `address`     | 20 bytes           | 以太坊地址                           | `address addr = 0x123...456;`      |
| `bytes`       | 动态长度           | 动态大小的字节数组                   | `bytes data = "hello";`            |
| `bytes1` 到 `bytes32` | 1 到 32 bytes     | 固定大小的字节数组                   | `bytes32 data = "hello";`          |
| `string`      | 动态长度           | UTF-8 编码的字符串                   | `string name = "Alice";`           |
| `fixed`       | 8 到 256 bits（8 位递增） | 固定点数，有符号                     | `fixed128x18 f = 1.5;`             |
| `ufixed`      | 8 到 256 bits（8 位递增） | 固定点数，无符号                     | `ufixed128x18 uf = 1.5;`           |
| `enum`        | N/A                | 枚举类型                             | `enum Status { Pending, Shipped }` |
| `struct`      | N/A                | 结构体类型                           | `struct MyStruct { uint a; }`      |
| `mapping`     | N/A                | 映射类型                             | `mapping(address => uint) balances;` |

### 解释


3. **地址类型** (`address`):
    - **长度**：20 bytes
    - **表示的含义**：以太坊地址
    - **使用惯例的代码示例**：`address addr = 0x123...456;`

4. **字节数组类型** (`bytes` 和 `bytes1` 到 `bytes32`):
    - **长度**：动态长度和 1 到 32 bytes 固定长度
    - **表示的含义**：动态大小和固定大小的字节数组
    - **使用惯例的代码示例**：
        - 动态大小的字节数组：`bytes data = "hello";`
        - 固定大小的字节数组：`bytes32 data = "hello";`

5. **字符串类型** (`string`):
    - **长度**：动态长度
    - **表示的含义**：UTF-8 编码的字符串
    - **使用惯例的代码示例**：`string name = "Alice";`

6. **固定点数类型** (`fixed` 和 `ufixed`):
    - **长度**：8 到 256 bits，以 8 位递增
    - **表示的含义**：固定点数，有符号和无符号
    - **使用惯例的代码示例**：
        - 有符号固定点数：`fixed128x18 f = 1.5;`
        - 无符号固定点数：`ufixed128x18 uf = 1.5;`


### 3.2 浮点数
问: Solidity 中的浮点数，有哪些特殊表示和使用方法，给出代码示例，包括如何表示无限大，表示NaN

截至目前（2023年），Solidity 不支持传统意义上的浮点数。Solidity 主要支持整数类型（`int` 和 `uint`）和固定点数类型（`fixed` 和 `ufixed`）。然而，固定点数类型在当前版本的 Solidity 也未完全实现。因此，开发者通常使用整数来模拟浮点数运算，例如使用更大的单位来表示小数部分（如使用 `wei` 表示 `ether`）。

由于 Solidity 不支持浮点数，也没有内置的表示无限大或 NaN 的方法。

## 4. 字符和字符串
在 Solidity 中，字符和字符串的使用和实现有其独特之处。Solidity 主要使用 `string` 和 `bytes` 类型来处理文本数据。

### 字符类型

Solidity 并没有单独的字符类型（如 `char`），但可以通过 `bytes1` 类型表示单个字节的字符。

### 字符串类型

Solidity 支持两种主要的字符串类型：

1. `string`：用于动态长度的 UTF-8 编码字符串。
2. `bytes`：用于动态长度的字节数组。

此外，还有 `bytes1` 到 `bytes32` 的固定长度字节数组类型。

### 使用 `string` 类型

`string` 类型适用于存储和操作文本数据。需要注意的是，`string` 类型在 Solidity 中是 UTF-8 编码的。

#### 示例：存储和返回字符串

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

### 使用 `bytes` 类型

`bytes` 类型用于存储任意长度的字节数组，适合需要直接操作字节数据的场景。

#### 示例：存储和操作字节数组

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

### 字符串和字节数组的转换

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

### 字符串比较

Solidity 不支持直接的字符串比较操作，但可以通过哈希比较来实现。

```solidity
pragma solidity ^0.8.0;

contract StringComparison {
    function compareStrings(string memory a, string memory b) public pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
```

### 字符串拼接

Solidity 中没有内置的字符串拼接函数，可以通过将多个字符串转换为字节数组，再进行拼接。

```solidity
pragma solidity ^0.8.0;

contract StringConcatenation {
    function concatenate(string memory a, string memory b) public pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }
}
```

## 5. 数组类型
问: Solidity 中的数组

在 Solidity 中，数组是用于存储多个相同类型数据的集合。Solidity 支持静态数组和动态数组，并提供了一些内置函数和操作来管理和操作数组。下面我们详细介绍 Solidity 中数组的使用方法和实现，并提供相应的代码示例。

### 数组类型

1. **静态数组**：长度固定的数组。
2. **动态数组**：长度可变的数组。

### 声明数组

#### 静态数组

静态数组的长度在编译时确定，不能改变。

```solidity
pragma solidity ^0.8.0;

contract StaticArrayExample {
    // 声明一个长度为 5 的 uint 类型静态数组
    uint[5] public myArray = [1, 2, 3, 4, 5];
}
```

#### 动态数组

动态数组的长度可以在运行时改变。

```solidity
pragma solidity ^0.8.0;

contract DynamicArrayExample {
    // 声明一个 uint 类型动态数组
    uint[] public myArray;

    // 添加元素到数组末尾
    function addElement(uint element) public {
        myArray.push(element);
    }

    // 获取数组长度
    function getLength() public view returns (uint) {
        return myArray.length;
    }

    // 获取数组元素
    function getElement(uint index) public view returns (uint) {
        require(index < myArray.length, "Index out of bounds");
        return myArray[index];
    }

    // 删除数组末尾元素
    function removeLastElement() public {
        require(myArray.length > 0, "Array is empty");
        myArray.pop();
    }
}
```

### 多维数组

Solidity 也支持多维数组的声明和使用。

```solidity
pragma solidity ^0.8.0;

contract MultiDimensionalArrayExample {
    // 声明一个二维 uint 类型静态数组
    uint[2][3] public myArray = [[1, 2], [3, 4], [5, 6]];

    // 声明一个二维 uint 类型动态数组
    uint[][] public dynamicArray;

    // 添加二维数组的一行
    function addRow(uint[] memory row) public {
        dynamicArray.push(row);
    }

    // 获取二维数组的一行
    function getRow(uint index) public view returns (uint[] memory) {
        require(index < dynamicArray.length, "Index out of bounds");
        return dynamicArray[index];
    }
}
```

### 数组的内置函数

Solidity 提供了一些内置函数来操作数组：

- `push()`: 向动态数组的末尾添加一个元素。
- `pop()`: 从动态数组的末尾移除一个元素。
- `length`: 获取数组的长度。
