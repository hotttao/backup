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


#### 示例 2：从有符号类型到无符号类型的转换

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


## 4. 变量类型
Solidity 中的值类型和值类型和引用类型包含的范围如下表所示：

| 类型     | 范围                                                   |
|----------|--------------------------------------------------------|
| **值类型** |                                                        |
| 布尔型   | `bool`，可以是 `true` 或 `false`                        |
| 整数型   | 有符号整数 (`int8` 到 `int256`，步长为 8)              |
|          | 无符号整数 (`uint8` 到 `uint256`，步长为 8)            |
| 地址型   | `address`，用于存储以太坊地址                            |
| 枚举型   | `enum`，定义一组有命名的常量                             |
| 定长字节 | 固定大小的字节数组 (`bytes1` 到 `bytes32`)              |
| 固定点数 | `fixed` 和 `ufixed`（当前尚未完全实现）                 |
| **引用类型** |                                                      |
| 字符串   | `string`，动态大小的 UTF-8 编码字符串                    |
| 动态数组 | 可以存储相同类型元素的数组，例如 `uint[]`              |
| 定长数组 | 固定大小的数组，例如 `uint[10]`                        |
| 结构体   | `struct`，可以定义复杂的数据类型                         |
| 映射     | `mapping`，键值对集合，例如 `mapping(address => uint)` |


## 5. 变量可见性和存储
在Solidity中，变量的可见性和存储位置是合约设计的重要部分。可见性控制谁可以访问变量或函数，而存储位置决定数据在内存、存储或调用数据中的位置。以下是对Solidity中变量可见性和存储位置的详细介绍：

Solidity提供四种可见性修饰符，控制函数和状态变量的访问权限：

### 5.1 `public`

- 任何人都可以访问。
- 自动生成一个getter函数。

```solidity
pragma solidity ^0.8.0;

contract VisibilityExample {
    uint public publicVar = 1;

    function publicFunction() public view returns (uint) {
        return publicVar;
    }
}
```

### 5.2. `private`

- 只能在当前合约内访问。
- 不能被派生合约访问。

```solidity
pragma solidity ^0.8.0;

contract VisibilityExample {
    uint private privateVar = 2;

    function privateFunction() private view returns (uint) {
        return privateVar;
    }
}
```

### 5.3 `internal`

- 只能在当前合约和继承的合约内访问。
- 默认可见性（如果未指定修饰符）。

```solidity
pragma solidity ^0.8.0;

contract Parent {
    uint internal internalVar = 3;
}

contract Child is Parent {
    function internalFunction() internal view returns (uint) {
        return internalVar;
    }
}
```

### 5.4 `external`

- 只能通过外部合约和交易访问。
- 不能在合约内部调用（除非使用`this`关键字）。

```solidity
pragma solidity ^0.8.0;

contract VisibilityExample {
    function externalFunction() external view returns (uint) {
        return 42;
    }

    function callExternalFunction() public view returns (uint) {
        return this.externalFunction();
    }
}
```


Solidity中有三种主要的存储位置：

### 1. `storage`

- 变量存储在区块链上
- 数据持久化，默认用于状态变量。

```solidity
pragma solidity ^0.8.0;

contract StorageExample {
    uint public storedData = 123;

    function setStoredData(uint _data) public {
        storedData = _data;
    }
}
```

### 2. `memory`

- 变量存储在内存中。尤其是如果返回数据类型是变长的情况下，必须加memory修饰
- 函数调用时临时使用，函数执行完后即销毁。
- 默认用于函数参数和局部变量。

```solidity
pragma solidity ^0.8.0;

contract MemoryExample {
    function getMemoryArray() public pure returns (uint[] memory) {
        uint[] memory memArray = new uint[](3);
        memArray[0] = 1;
        memArray[1] = 2;
        memArray[2] = 3;
        return memArray;
    }
}
```

### 3. `calldata`

- 只读数据存储位置。
- 主要用于外部函数的参数。
- 更省gas。

```solidity
pragma solidity ^0.8.0;

contract CalldataExample {
    function getCalldataArray(uint[] calldata inputArray) public pure returns (uint) {
        return inputArray[0];
    }
}
```

### 示例表格

| 可见性修饰符 | 作用范围                           | 示例代码                                    |
|--------------|------------------------------------|---------------------------------------------|
| `public`     | 任何人都可以访问                    | `uint public publicVar;`                    |
| `private`    | 仅当前合约内部访问                  | `uint private privateVar;`                  |
| `internal`   | 当前合约和继承的合约访问            | `uint internal internalVar;`                |
| `external`   | 通过外部合约和交易访问              | `function externalFunction() external;`     |

| 存储位置   | 说明                                           | 示例代码                                    |
|------------|------------------------------------------------|---------------------------------------------|
| `storage`  | 数据持久化存储在区块链中                        | `uint storedData;`                          |
| `memory`   | 数据存储在内存中，函数执行完后即销毁            | `uint[] memory memArray = new uint[](3);`   |
| `calldata` | 只读数据存储位置，主要用于外部函数的参数        | `function example(uint[] calldata data);`   |

通过以上表格和示例，可以全面了解Solidity中变量的可见性和存储位置及其用法。

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


### 3.3 地址类型
在 Solidity 中，`address` 类型用于表示以太坊地址。以下是关于 `address` 类型的详细信息：

#### 地址类型的特点
- **长度**: `address` 类型的长度为 20 字节（160 位）。
- **存储**: 地址类型用于存储以太坊地址，例如用户账户地址或合约地址。
- **操作**: 可以对 `address` 类型进行一些特定的操作。

#### 地址类型的分类
Solidity 中有两种地址类型：
1. **address**: 普通的地址类型。
2. **address payable**: 可支付的地址类型，允许接收以太币。

#### 地址类型的内置方法
`address` 和 `address payable` 类型都包含一些内置的方法和属性：

#### 公共方法和属性（适用于 `address` 和 `address payable`）
- `balance`: 返回地址的以太币余额（单位为 wei）。
- `code`: 返回该地址上存储的代码（如果地址是一个合约）。
- `codehash`: 返回该地址上存储的代码的哈希值。
- `transfer(uint256 amount)`: 向该地址发送指定数量的以太币（仅适用于 `address payable`）。
- `send(uint256 amount) returns (bool)`: 向该地址发送指定数量的以太币，返回一个布尔值表示成功或失败（仅适用于 `address payable`）。
- `call(bytes memory) returns (bool, bytes memory)`: 调用该地址上的合约函数，传递数据并返回布尔值和返回数据。
- `delegatecall(bytes memory) returns (bool, bytes memory)`: 使用调用者的上下文调用该地址上的合约函数，传递数据并返回布尔值和返回数据。
- `staticcall(bytes memory) returns (bool, bytes memory)`: 进行静态调用，不允许修改状态，传递数据并返回布尔值和返回数据。

### 示例代码
以下是一些使用 `address` 类型的示例代码：

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


## 4. 字符和字符串
在 Solidity 中，字符和字符串的使用和实现有其独特之处。Solidity 主要使用 `string` 和 `bytes` 类型来处理文本数据。

1. Solidity 并没有单独的字符类型（如 `char`），但可以通过 `bytes1` 类型表示单个字节的字符。
2. Solidity 支持两种主要的字符串类型：
    1. `string`：用于动态长度的 UTF-8 编码字符串。
    2. `bytes`：用于动态长度的字节数组。

此外，还有 `bytes1` 到 `bytes32` 的固定长度字节数组类型。

### 使用 `string` 类型

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

### 使用 `bytes` 类型

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

动态数组的长度可以在运行时改变。solidity 中动态数组无法直接初始化。可使用 new 关键字在 内存memory 中基于运行时创建动态长度数组。与存储storage 数组相反的是，不能通过修改成员变量 .push 改变 内存memory 数组的大小。必须提前计算所需的大小或者创建一个新的内存数组并复制每个元素。

```solidity
pragma solidity >=0.4.16 <0.9.0;

contract TX {
    function f(uint len) public pure {
        uint[] memory a = new uint[](7);
        bytes memory b = new bytes(len);

        assert(a.length == 7);
        assert(b.length == len);

        a[6] = 8;
    }
}
```


### 数组的内置函数

Solidity 提供了一些内置函数来操作数组：

- `push()`: 向动态数组的末尾添加一个元素。
- `pop()`: 从动态数组的末尾移除一个元素。
- `length`: 获取数组的长度。


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

## 6. 结构体
可以在声明结构体变量时直接初始化。

```solidity
pragma solidity ^0.8.0;

contract StructExample {
    // 声明结构体类型
    struct Person {
        string name;
        uint age;
        address wallet;
    }
    
    // 结构体类型变量
    Person public person = Person("Alice", 30, 0x1234567890123456789012345678901234567890);
}

```



## 全局变量
全局变量是全局范围工作的变量，都是solidity预留关键字。他们可以在函数内不声明直接使用，完整的全局变量参见: [单位和全局变量](https://learnblockchain.cn/docs/solidity/units-and-global-variables.html#special-variables-and-functions)

