---
weight: 1
title: "Solidity 中的全局变量"
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

全局变量是全局范围工作的变量，都是solidity预留关键字。他们可以在函数内不声明直接使用，完整的全局变量参见: [单位和全局变量](https://learnblockchain.cn/docs/solidity/units-and-global-variables.html#special-variables-and-functions)


## 1. 以太币单位
以太币Ether 单位之间的换算就是在数字后边加上 wei ， gwei 或 ether 来实现的，如果后面没有单位，缺省为 wei。

```solidity
assert(1 wei == 1);
assert(1 gwei == 1e9);
assert(1 ether == 1e18);
```

## 2. 时间单位
秒是缺省时间单位:
- 1 == 1 seconds
- 1 minutes == 60 seconds
- 1 hours == 60 minutes
- 1 days == 24 hours
- 1 weeks == 7 days

这些后缀不能直接用在变量后边。如果想用时间单位（例如 days）来将输入变量换算为时间:

```solidity
function f(uint start, uint daysAfter) public {
    if (block.timestamp >= start + daysAfter * 1 days) {
        // ...
    }
}
```

## 3. 区块和交易属性
- `blockhash(uint blockNumber) returns (bytes32)`：指定区块的区块哈希 —— 仅可用于最新的 256 个区块且不包括当前区块，否则返回 0 。
- `block.basefee (uint)`: 当前区块的基础费用，参考： (EIP-3198 和 EIP-1559)
- `block.chainid (uint)`: 当前链 id
- `block.coinbase (address)`: 挖出当前区块的矿工地址
- `block.difficulty (uint)`: 当前区块难度
- `block.gaslimit (uint)`: 当前区块 gas 限额
- `block.number (uint)`: 当前区块号
- `block.timestamp (uint)`: 自 unix epoch 起始当前区块以秒计的时间戳
- `gasleft() returns (uint256)` ：剩余的 gas
- `msg.data (bytes)`: 完整的 calldata
- `msg.sender (address)`: 消息发送者（当前调用）
- `msg.sig (bytes4)`: calldata 的前 4 字节（也就是函数标识符）
- `msg.value (uint)`: 随消息发送的 wei 的数量
- `tx.gasprice (uint)`: 交易的 gas 价格
- `tx.origin (address)`: 交易发起者（完全的调用链）

## 4. ABI 编码及解码函数
在 Solidity 中，ABI（应用二进制接口）编码和解码函数用于将数据打包成字节数组，或从字节数组中解包数据。这在合约之间进行数据传输以及与外部应用程序进行交互时非常重要。以下是 Solidity 中的 ABI 编码及解码函数的详细介绍：

### `abi.encode`

`abi.encode` 函数用于将给定的参数打包成一个字节数组。它支持动态和静态类型的数据。

```solidity
pragma solidity ^0.8.0;

contract AbiEncodeExample {
    function encodeData(uint256 num, string memory str) public pure returns (bytes memory) {
        return abi.encode(num, str);
    }
}
```

### `abi.encodePacked`

`abi.encodePacked` 函数也用于编码数据，但它会进行更紧凑的打包，这样可能会导致不同数据打包成相同的字节数组（哈希冲突），所以通常用于计算哈希值。

```solidity
pragma solidity ^0.8.0;

contract AbiEncodePackedExample {
    function encodePackedData(uint256 num, string memory str) public pure returns (bytes memory) {
        return abi.encodePacked(num, str);
    }
}
```

### `abi.encodeWithSelector`

`abi.encodeWithSelector` 用于将函数选择器和参数一起编码。函数选择器是前四个字节的哈希值，用于识别要调用的函数。

```solidity
pragma solidity ^0.8.0;

contract AbiEncodeWithSelectorExample {
    function encodeWithSelector() public pure returns (bytes memory) {
        return abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), 0x1234567890123456789012345678901234567890, 100);
    }
}
```

### `abi.encodeWithSignature`

`abi.encodeWithSignature` 与 `abi.encodeWithSelector` 类似，但它接受函数签名字符串作为输入，并自动计算选择器。

```solidity
pragma solidity ^0.8.0;

contract AbiEncodeWithSignatureExample {
    function encodeWithSignature() public pure returns (bytes memory) {
        return abi.encodeWithSignature("transfer(address,uint256)", 0x1234567890123456789012345678901234567890, 100);
    }
}
```

## ABI 解码函数

### `abi.decode`

`abi.decode` 函数用于从字节数组中解码数据。解码时需要提供数据的类型。

```solidity
pragma solidity ^0.8.0;

contract AbiDecodeExample {
    function decodeData(bytes memory data) public pure returns (uint256, string memory) {
        return abi.decode(data, (uint256, string));
    }
}
```


## 5. 类型信息

| 类型信息                   | 描述                                                    |
|---------------------------|---------------------------------------------------------|
| `type(T).creationCode`    | 返回创建合约类型 `T` 所需的字节码                        |
| `type(T).runtimeCode`     | 返回合约类型 `T` 的运行时字节码                          |
| `type(T).interfaceId`     | 返回接口类型 `T` 的接口标识符                            |
| `type(T).min`             | 返回整数类型 `T` 的最小值                                |
| `type(T).max`             | 返回整数类型 `T` 的最大值                                |


## 6. 数学和密码学函数
`addmod(uint x, uint y, uint k) returns (uint)`
- 作用: 计算 (x + y) % k，加法会在任意精度下执行，并且加法的结果即使超过 2**256 也不会被截取


`mulmod(uint x, uint y, uint k) returns (uint)`
- 作用: 计算 (x * y) % k，乘法会在任意精度下执行，并且乘法的结果即使超过 2**256 也不会被截取。

`keccak256((bytes memory) returns (bytes32)`
- 作用: 计算 Keccak-256 哈希。

`sha256(bytes memory) returns (bytes32)`
- 作用: 计算参数的 SHA-256 哈希。

`ripemd160(bytes memory) returns (bytes20)`
- 作用: 计算参数的 RIPEMD-160 哈希。

`ecrecover(bytes32 hash, uint8 v, bytes32 r, bytes32 s) returns (address)`
- 作用: 利用椭圆曲线签名恢复与公钥相关的地址，错误返回零值。
- 参数: 函数参数对应于 ECDSA签名的值:
  - r = 签名的前 32 字节
  - s = 签名的第2个32 字节
  - v = 签名的最后一个字节
- 注意: ecrecover 返回一个 address, 而不是 address payable
