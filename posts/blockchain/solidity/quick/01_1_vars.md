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


### 2.1 结构体
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
    
    // 构造函数初始化
    Person public person = Person("Alice", 30, 0x1234567890123456789012345678901234567890);
    // key value 初始化
    Person public person = Person({id: 4, score: 60});
}

```

### 2.2 枚举类型

```solidity
// 用enum将uint 0， 1， 2表示为Buy, Hold, Sell
enum ActionSet { Buy, Hold, Sell }
// 创建enum变量 action
ActionSet action = ActionSet.Buy;

// enum可以和uint显式的转换
function enumToUint() external view returns(uint){
    return uint(action);
}
```


### 2.3 `constant` 和 `immutable`

在 Solidity 中，`constant` 和 `immutable` 都用于定义不能在合约执行过程中更改的变量，但它们有一些重要的区别。以下是对 `constant` 和 `immutable` 关键字的详细比较：

| 特性                          | `constant`                                            | `immutable`                                             |
|-------------------------------|-------------------------------------------------------|---------------------------------------------------------|
| **值的设定**                  | 必须在声明时设定值                                    | 可以在声明时设定值，也可以在构造函数中设定值              |
| **修改时机**                  | 部署时不可更改                                        | 部署时可以设定值，但之后不可更改                          |
| **存储位置**                  | 存储在合约的字节码中                                   | 存储在合约的存储中                                      |
| **适用场景**                  | 适用于编译时已知的常量                                | 适用于部署时才知道的常量                                |
| **例子**                      | `constant uint256 MY_CONSTANT = 100;`                | `immutable uint256 MY_IMMUTABLE;` <br> `constructor(uint256 _value) { MY_IMMUTABLE = _value; }` |

详细说明:
- **值的设定**：`constant` 变量的值必须在声明时设定，并且在编译时必须已知。而 `immutable` 变量的值可以在声明时设定，也可以在构造函数中设定，这样在合约部署时确定值。 若immutable变量既在声明时初始化，又在constructor中初始化，会使用constructor初始化的值。
- **修改时机**：`constant` 变量一旦在声明时设定值后，就不能再修改。而 `immutable` 变量在合约部署时设定值后，也不能再修改。
- **存储位置**：`constant` 变量的值存储在合约的字节码中，这意味着它们在运行时不会消耗额外的存储空间。`immutable` 变量的值存储在合约的存储中，因此在合约运行时会占用存储空间。
- **适用场景**：`constant` 适用于那些在合约编译时就已确定且永不改变的值。`immutable` 适用于那些在合约部署时才知道且部署后不再改变的值。


`constant` 关键字用于定义在合约编译时已知并且不会改变的常量。

```solidity
pragma solidity ^0.8.0;

contract ConstantExample {
    // 定义一个常量
    uint256 public constant MY_CONSTANT = 100;

    // 由于 MY_CONSTANT 是常量，因此在合约的生命周期中不能改变
}
```

`immutable` 关键字用于定义在合约部署时可以设定但之后不可更改的变量。

```solidity
pragma solidity ^0.8.0;

contract ImmutableExample {
    // 定义一个不可变变量
    uint256 public immutable MY_IMMUTABLE;

    // 在构造函数中设定不可变变量的值
    constructor(uint256 _value) {
        MY_IMMUTABLE = _value;
    }
}
```


## 3. 隐式类型转换

在 Solidity 中，隐式类型转换是指编译器自动进行的类型转换，而不需要显式地指定转换。与其他一些编程语言不同，Solidity 对隐式类型转换有严格的限制，以避免潜在的错误和不安全的操作。以下是隐式类型转换的主要规则：

1. **同类型不同位宽的整数**：允许从较小位宽转换为较大位宽，不允许反过来。
2. **无符号和有符号整数**：不允许隐式转换。
3. **地址类型和整数类型**：允许 `address` 和 `uint160` 之间的转换。
4. **布尔类型和整数类型**：不允许隐式转换。

对于不允许隐式转换的情况，需要显式地进行类型转换，以确保数据的准确性和操作的安全性。

### 同类型不同位宽的整数转换

对于同类型但不同位宽的整数类型，Solidity 允许从较小位宽转换为较大位宽。这种转换是安全的，因为不会丢失数据。然而，反过来则不允许，因为可能会导致数据丢失。

```solidity
pragma solidity ^0.8.0;

contract TypeConversion {
    function implicitConversion() public pure returns (uint16, uint256) {
        uint8 a = 10;
        uint16 b = a; // 从 uint8 转换为 uint16，安全
        // uint8 c = b; // 错误：从 uint16 转换为 uint8，可能会丢失数据
        return (b, a);
    }
}
```

### 无符号和有符号整数之间的转换

Solidity 不允许无符号整数（`uint`）和有符号整数（`int`）之间进行隐式转换，因为它们的表示方法不同，可能会导致逻辑错误。

```solidity
pragma solidity ^0.8.0;

contract TypeConversion {
    function implicitConversion() public pure returns (int) {
        uint8 a = 10;
        // int b = a; // 错误：从无符号整数转换为有符号整数
        return int(a); // 需要显式转换
    }
}
```

### 地址类型和整数类型

Solidity 允许将 `address` 类型转换为 `uint160`，反之亦然，因为地址在底层表示为 160 位的无符号整数。

```solidity
pragma solidity ^0.8.0;

contract TypeConversion {
    function implicitConversion() public pure returns (address, uint160) {
        address addr = 0x1234567890123456789012345678901234567890;
        uint160 addrInt = uint160(addr); // 从 address 转换为 uint160
        address newAddr = address(addrInt); // 从 uint160 转换为 address
        return (newAddr, addrInt);
    }
}
```

### 布尔类型和整数类型

Solidity 不允许布尔类型（`bool`）与整数类型之间的隐式转换，需要显式地进行转换。

```solidity
pragma solidity ^0.8.0;

contract TypeConversion {
    function implicitConversion() public pure returns (bool, uint8) {
        bool flag = true;
        // uint8 num = flag; // 错误：从布尔类型转换为整数类型
        uint8 num = flag ? 1 : 0; // 需要显式地进行转换
        return (flag, num);
    }
}
```


## 4. 变量类型
Solidity 中的值类型和值类型和引用类型包含的范围如下表所示：

以下是 Solidity 中的值类型和引用类型的对比表格：

| 类型      | 分类       | 示例                                                      | 描述                                                       |
| --------- | ---------- | --------------------------------------------------------- | ---------------------------------------------------------- |
| **值类型** | 布尔型     | `bool flag = true;`                                       | 取值为 `true` 或 `false`                                   |
|            | 整数型     | `int8 a = -1;` `uint256 b = 100;`                         | 有符号整数（`int`）和无符号整数（`uint`），不同位宽       |
|            | 地址型     | `address addr = 0x1234567890123456789012345678901234567890;` | 用于存储以太坊地址                                         |
|            | 枚举型     | `enum Status { Pending, Shipped, Delivered }`             | 定义一组命名常量                                           |
|            | 字节型     | `bytes1 b1 = 0x01;` `bytes32 b32 = 0x0123456789abcdef...;` | 固定大小的字节数组                                         |
|            | 定长数组   | `uint[3] arr = [1, 2, 3];`                                | 长度固定的数组                                             |
| **引用类型** | 动态数组   | `uint[] dynamicArray = [1, 2, 3];`                       | 长度可变的数组                                             |
|            | 映射       | `mapping(address => uint) balances;`                      | 类似于哈希表，用于存储键值对                               |
|            | 结构体     | `struct Person { string name; uint age; } Person p = ...;` | 自定义的数据结构                                           |
|            | 字符串     | `string greeting = "Hello, World!";`                      | 动态大小的 UTF-8 编码字符串                                 |


## 5. 变量可见性

Solidity 中的变量可见性决定了变量在智能合约中的访问权限。变量可见性有四种类型：

1. **Public**: 
   - 任何人都可以访问，包括外部合约和区块链上的所有用户。
   - 编译器会为公共状态变量自动生成一个 getter 函数。

   ```solidity
   uint public myVar;
   ```

2. **Internal**:
   - 只能在当前合约及其继承的合约中访问。
   - 是默认的可见性修饰符（如果未明确指定可见性）。

   ```solidity
   uint internal myVar;
   ```

3. **Private**:
   - 只能在当前合约中访问，不能在继承的合约中访问。
   - 适用于需要严格控制访问权限的变量。

   ```solidity
   uint private myVar;
   ```

4. **External**:
   - 主要用于函数，而不是状态变量。
   - 只能通过消息调用（transactions）从外部合约或用户调用。

   ```solidity
   function myFunc() external { ... }
   ```

## 6. 变量存储位置

在 Solidity 中，变量的存储位置决定了变量的生命周期和存储效率。主要有三种存储位置：

1. **Storage**:
   - 存储在区块链的永久存储中。
   - 适用于状态变量（合约的成员变量）。
   - 访问和修改存储变量需要消耗较多的 gas。

   ```solidity
   uint public myVar; // 存储在 storage 中
   ```

2. **Memory**:
   - 临时存储，仅在函数调用期间有效。
   - 适用于函数内部的局部变量。
   - 操作内存变量比存储变量消耗的 gas 少。
   - 如果返回数据类型是变长的情况下，必须加memory修饰，例如：string, bytes, array和自定义结构。

   ```solidity
   function myFunc() {
       uint myVar = 1; // 存储在 memory 中
   }
   ```

3. **Calldata**:
   - 专用于函数参数，尤其是外部函数的参数。
   - 是只读的，不能修改。
   - 适用于传入大数据（如数组）的情况下，以节省 gas。

   ```solidity
   function myFunc(uint[] calldata myArray) external {
       // myArray 是 calldata 类型
   }
   ```

```solidity
pragma solidity ^0.8.0;

contract Example {
    uint public storedData; // 存储在 storage 中，public 可见性
    uint private privateData; // 存储在 storage 中，private 可见性

    function set(uint x) public {
        storedData = x; // 存储在 storage 中
    }

    function get() public view returns (uint) {
        return storedData; // 存储在 storage 中
    }

    function processData(uint[] memory data) public pure returns (uint) {
        uint sum = 0; // 存储在 memory 中
        for (uint i = 0; i < data.length; i++) {
            sum += data[i]; // data 是 memory 类型
        }
        return sum;
    }

    function externalFunction(uint[] calldata data) external pure returns (uint) {
        uint sum = 0; // 存储在 memory 中
        for (uint i = 0; i < data.length; i++) {
            sum += data[i]; // data 是 calldata 类型
        }
        return sum;
    }
}
```


## 6. 基础类型
### 6.1 数值类型的范围
问: 以表格形式列举 Solidity 中的中的基础数据类型，分为三列，分别是类型，长度，表示的含义，使用惯例的代码示例

下面是 Solidity 中的基础数据类型，以表格形式分别列出类型、长度、表示的含义和使用惯例的代码示例：

| 类型          | 长度               | 表示的含义                           | 使用惯例的代码示例                 |
| --------------| -------------------| -------------------------------------| ---------------------------------- |
| `bool`        | 1 byte             | 布尔值（`true` 或 `false`）           | `bool isTrue = true;`              |
| `int`         | 8 到 256 bits（8 位递增） | 有符号整数                           | `int256 num = -10;`                |
| `uint`        | 8 到 256 bits（8 位递增） | 无符号整数                           | `uint256 num = 10;`                |
| `address`     | 20 bytes           | 以太坊地址                           | `address addr = 0x123...456;`      |
| `bytes1` 到 `bytes32` | 1 到 32 bytes     | 固定大小的字节数组                   | `bytes32 data = "hello";`          |
| `fixed`       | 8 到 256 bits（8 位递增） | 固定点数，有符号                     | `fixed128x18 f = 1.5;`             |
| `ufixed`      | 8 到 256 bits（8 位递增） | 固定点数，无符号                     | `ufixed128x18 uf = 1.5;`           |


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
6. **固定点数类型** (`fixed` 和 `ufixed`):
    - **长度**：8 到 256 bits，以 8 位递增
    - **表示的含义**：固定点数，有符号和无符号
    - **使用惯例的代码示例**：
        - 有符号固定点数：`fixed128x18 f = 1.5;`
        - 无符号固定点数：`ufixed128x18 uf = 1.5;`


### 6.2 浮点数
问: Solidity 中的浮点数，有哪些特殊表示和使用方法，给出代码示例，包括如何表示无限大，表示NaN

截至目前（2023年），Solidity 不支持传统意义上的浮点数。Solidity 主要支持整数类型（`int` 和 `uint`）和固定点数类型（`fixed` 和 `ufixed`）。然而，固定点数类型在当前版本的 Solidity 也未完全实现。因此，开发者通常使用整数来模拟浮点数运算，例如使用更大的单位来表示小数部分（如使用 `wei` 表示 `ether`）。

由于 Solidity 不支持浮点数，也没有内置的表示无限大或 NaN 的方法。


## 7. 变量初始值
在Solidity中，声明但没赋值的变量都有它的初始值或默认值。

### 值类型初始值

- `boolean`: `false`
- `string`: `""`
- `int`: `0`
- `uint`: `0`
- `enum`: 枚举中的第一个元素
- `address`: `0x0000000000000000000000000000000000000000` (或 `address(0)`)
- `function`
  - `internal`: 空白函数
  - `external`: 空白函数

### 引用类型初始值

- 映射`mapping`: 所有元素都为其默认值的`mapping`
- 结构体`struct`: 所有成员设为其默认值的结构体
- 数组`array`
  - 动态数组: `[]`
  - 静态数组（定长）: 所有成员设为其默认值的静态数组

### delete操作符
delete a会让变量a的值变为初始值。
