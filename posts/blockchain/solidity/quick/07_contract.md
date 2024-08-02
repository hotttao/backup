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
交易分为发送 ETH 的一方和接收 ETH 的一方。

### 3.1 接收 ETH
Solidity 使用 receive()和fallback() 两个回调函数定义，合约接受 ETH 时的操作。


| 特性/区别       | `receive` 函数                                     | `fallback` 函数                                            |
|----------------|---------------------------------------------------|------------------------------------------------------------|
| 定义方式       | `receive() external payable { ... }`               | `fallback() external payable { ... }`                      |
| 定义要求       | 不能有任何的参数，不能返回任何值，必须包含external和payable| 必须由external修饰                      |
| 触发条件       | 合约接收到纯以太币（没有附带数据）时触发。               | 未能匹配其他函数签名的调用，或接收到附带数据的以太币。<br>可用于接收ETH，也可以用于代理合约proxy contract|
| 主要用途       | 处理纯以太币转账。                                  | 处理未知函数调用、带数据的以太币转账、以及没有定义 `receive` 函数时的纯以太币转账。 |
| 是否必须定义    | 否，如果没有定义，则会触发 `fallback` 函数。           | 否，但是建议定义以确保处理所有未匹配的调用。                        |
| 是否可以接收以太币 | 是                                                 | 是                                                          |
| 数据参数       | 否                                                 | 是，`msg.data` 包含调用时附带的数据。                               |
| Gas 消耗       | 较低（具体取决于函数内部逻辑）。                        | 较低（具体取决于函数内部逻辑）。                                     |

receive()最好不要执行太多的逻辑因为如果别人用send和transfer方法发送ETH的话，gas会限制在2300，receive()太复杂可能会触发Out of Gas报错；有些恶意合约，会在receive() 函数嵌入恶意消耗 gas 的内容或者使得执行故意失败的代码，导致一些包含退款和转账逻辑的合约不能正常工作，因此写包含退款等逻辑的合约时候，一定要注意这种情况。


receive()和payable fallback()均不存在的时候，向合约直接发送ETH将会报错（你仍可以通过带有payable的函数向合约发送ETH）。

### 代码示例

```solidity
pragma solidity ^0.8.0;

contract Example {
    // 事件用于记录收到的以太币
    event Received(address sender, uint amount);
    event FallbackCalled(address sender, uint amount, bytes data);

    // receive 函数：接收纯以太币时触发
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    // fallback 函数：处理未知函数调用和带数据的以太币转账
    fallback() external payable {
        emit FallbackCalled(msg.sender, msg.value, msg.data);
    }

    // 测试函数：允许直接调用以检查是否匹配
    function test() public pure returns (string memory) {
        return "Function test() called";
    }
}
```

### 示例说明

1. **发送纯以太币**：
   - 如果直接向合约地址发送以太币（例如，通过钱包发送），将触发 `receive` 函数。

2. **调用未知函数或附带数据的以太币**：
   - 如果调用一个不存在的函数（例如，`example.unknownFunction()`），将触发 `fallback` 函数。
   - 如果发送带有数据的交易（例如，使用 `call` 方法附带数据和以太币），将触发 `fallback` 函数。


### 3.2 发送 ETH
Solidity 中 `transfer()`, `send()` 和 `call()` 是三种用于发送以太币的方法，它们在行为和安全性上存在显著差异。以下是它们的对比表格和代码示例。

| 特性/区别           | `transfer()`                           | `send()`                               | `call()`                                    |
|--------------------|----------------------------------------|----------------------------------------|---------------------------------------------|
| 成功返回值         | 无返回值（失败时抛出异常）              | 返回布尔值（`true` 表示成功，`false` 表示失败） | 返回 (bool, bytes)（`true` 表示成功，`false` 表示失败） |
| Gas 限制           | 固定为 2300 gas                         | 固定为 2300 gas                         | 无固定限制，调用者可以指定                 |
| 安全性             | 较高，自动回滚(revert)                    | 较高，但需要手动处理失败                | 低，需要手动检查返回值和错误处理             |
| 调用方式           | `recipient.transfer(amount)`           | `recipient.send(amount)`                | `recipient.call{value: amount}("")`         |
| 使用场景           | 简单的以太币转账，建议用于大多数情况      | 简单的以太币转账，但需要处理失败          | 高度灵活的调用，包括合约间的复杂交互         |
| 支持发送数据       | 否                                      | 否                                      | 是                                         |
| 支持调用函数       | 否                                      | 否                                      | 是                                         |
| 推荐级别       | 有2300 gas限制，失败会自动revert交易，是次优选择 | 几乎没有人用它                         | 没有gas限制，最为灵活，是最提倡的方法 |


### 代码示例

```solidity
pragma solidity ^0.8.0;

contract SendExample {

    function transferEther(address payable recipient) public payable {
        // 使用 transfer 发送以太币，失败时会自动回滚
        recipient.transfer(msg.value);
    }

    function sendEther(address payable recipient) public payable {
        // 使用 send 发送以太币，需要手动检查返回值
        bool success = recipient.send(msg.value);
        if(!success){
            revert SendFailed();
        }
        require(success, "Send failed");
    }

    function callEther(address payable recipient) public payable {
        // 使用 call 发送以太币，需要手动检查返回值
        (bool success, ) = recipient.call{value: msg.value}("");
        require(success, "Call failed");
    }
}
```

## 4. 调用合约
调用合约有两种方式:
1. 获取目标合约的引用，然后直接调用合约上的方法
2. 利用 address 类型提供的底层 call 和 delegatecall 方法。

### 4.1 获取目标合约引用
1. 不带转账的合约调用: `_Name(_Address).f(param...)`
1. 带转账的合约调用: 
    - `_Name(_Address).f{value: _Value}(param...)`
    - _Value是要转的ETH数额（以wei为单位）


```solidity
function callSetX(address _Address, uint256 x) external{
    OtherContract(_Address).setX(x);
}

// OtherContract _Address底层类型仍然是address
function callGetX(OtherContract _Address) external view returns(uint x){
    x = _Address.getX();
}

function callGetX2(address _Address) external view returns(uint x){
    OtherContract oc = OtherContract(_Address);
    x = oc.getX();
}

function setXTransferETH(address otherContract, uint256 x) payable external{
    OtherContract(otherContract).setX{value: msg.value}(x);
}
```

### 4.2 call
`address.call{value: msg.value, gas: gasLimit}(bytes memory) returns (bool, bytes memory)`
1. 参数:
    - bytes: 函数选择器和参数编码
    - value（可选）：指定发送的以太币数量。
    - gas（可选）：指定调用时的 gas 限制。
2. 返回值:
    - bool success：表示调用是否成功。
    - bytes memory returnData：包含返回的数据（如果有）
3. 注意:
    - call是Solidity官方推荐的通过触发fallback或receive函数发送ETH的方法。
    - 不推荐用call来调用另一个合约，因为当你调用不安全合约的函数时，你就把主动权交给了它。推荐的方法仍是声明合约变量后调用函数
    - 当我们不知道对方合约的源代码或ABI，就没法生成合约变量；这时，我们仍可以通过call调用对方合约的函数
    - 给call输入的函数不存在于目标合约，那么目标合约的fallback函数会被触发


### 4.3 函数选择器(selector)和函数签名
selector和函数签名:
1. 函数签名 = `函数名（逗号分隔的参数类型)`
2. selector = `函数签名的Keccak哈希后的前4个字节`
3. msg.data = calldata = 函数选择器和参数编码(调用 abi.encodeWithSignature 或 abi.encodeWithSelector 生成的值)


```solidity
// 函数签名：functionName(paramType1, paramType2, ...)
// 在函数签名中，uint和int要写为uint256和int256。
bytes memory data = abi.encodeWithSignature("setValue(uint256)", 42);

// 函数选择器：bytes4(keccak256(bytes("functionName(paramType1,paramType2,...)")))
bytes4 selector = bytes4(keccak256(bytes("setValue(uint256)")));
bytes memory data = abi.encodeWithSelector(selector, 42);

```

### 4.3 delegatecall
`address.delegatecall{gas: gasLimit}(bytes memory) returns (bool, bytes memory)`
- 用法: delegatecall 语法和 call 类似，不同的是 dlegatecall 不能指定发送的ETH数额
- 区别: delegatecall 与 call 的区别在于，执行的上下文
    - call 会将控制权转移到另一个合约，并在那个合约的上下文中执行，eg: B call C，C 在执行时使用的是 C 自己的上下文
    - delegatecall 只调用另一个合约的代码，不切换合约的上下文，eg: B delegatecall C，C 在执行时使用的 B 的上下文

delegatecall 适用于以下场景: 
1. 代理合约（`Proxy Contract`）：将智能合约的存储合约和逻辑合约分开：代理合约（`Proxy Contract`）存储所有相关的变量，并且保存逻辑合约的地址；所有函数存在逻辑合约（`Logic Contract`）里，通过`delegatecall`执行。当升级时，只需要将代理合约指向新的逻辑合约即可。
2. EIP-2535 Diamonds（钻石）：钻石是一个支持构建可在生产中扩展的模块化智能合约系统的标准。钻石是具有多个实施合约的代理合约。 更多信息请查看：[钻石标准简介](https://eip2535diamonds.substack.com/p/introduction-to-the-diamond-standard)。


## 5. 工厂合约
有两种方法可以在合约中创建新合约，create和create2。

### 5.1 create
`Contract x = new Contract{value: _value}(params)`
- Contract: 要创建的合约名
- _value: 如果构造函数是p ayable，可以创建时转入 _value 数量的ETH
- params: 是新合约构造函数的参数
- x: 是合约对象（地址）

### 5.2 create2
CREATE2 在智能合约部署之前就能预测合约的地址。
1. create 合约地址 = hash(创建者地址, nonce)
2. create2 合约地址 = hash("0xFF",创建者地址, salt, initcode)
    - 0xFF：一个常数，避免和CREATE冲突
    - salt：一个创建者指定的bytes32类型的值，它的主要目的是用来影响新创建的合约的地址
    - initcode: 新合约的初始字节码（合约的Creation Code和构造函数的参数）
        - 无参数: `keccak256(type(Pair).creationCode)`
        - 有参数: `keccak256(abi.encodePacked(type(Pair).creationCode, abi.encode(address(this))))`

`Contract x = new Contract{salt: _salt, value: _value}(params)`
- create2 的用法与 create 基本类似，多了 salt 参数

```solidity
contract PairFactory2{
    mapping(address => mapping(address => address)) public getPair; // 通过两个代币地址查Pair地址
    address[] public allPairs; // 保存所有Pair地址

    function createPair2(address tokenA, address tokenB) external returns (address pairAddr) {
        require(tokenA != tokenB, 'IDENTICAL_ADDRESSES'); //避免tokenA和tokenB相同产生的冲突
        // 用tokenA和tokenB地址计算salt
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA); //将tokenA和tokenB按大小排序
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        Pair pair = new Pair{salt: salt}(); 
    }
}
```

### 5.3 删除合约

`selfdestruct(_addr)；`
- _addr: 接收合约中剩余ETH的地址。_addr 地址不需要有receive()或fallback()也能接收ETH。
- 说明: 
    - selfdestruct命令可以用来删除智能合约，并将该合约剩余ETH转到指定地址。
    - 在 v0.8.18 版本中，selfdestruct 关键字被标记为不再建议使用。但由于目前还没有代替方案，目前只是对开发者做了编译阶段的警告，相关内容可以查看 EIP-6049。
    - 根据[EIP-6780](https://eips.ethereum.org/EIPS/eip-6780)提案描述，当前SELFDESTRUCT仅会被用来将合约中的ETH转移到指定地址，而原先的删除功能只有在`合约创建-自毁`这两个操作处在同一笔交易时才能生效。
    - 当合约中有selfdestruct功能时常常会带来安全问题和信任问题，合约中的selfdestruct功能会为攻击者打开攻击向量(例如使用selfdestruct向一个合约频繁转入token进行攻击，这将大大节省了GAS的费用，虽然很少人这么做)，此外，此功能还会降低用户对合约的信心。

所以目前来说：
1. 已经部署的合约无法被SELFDESTRUCT了。
2. 如果要使用原先的SELFDESTRUCT功能，必须在同一笔交易中创建并SELFDESTRUCT。

```solidity
contract DeployContract {

    struct DemoResult {
        address addr;
        uint balance;
        uint value;
    }

    constructor() payable {}

    function getBalance() external view returns(uint balance){
        balance = address(this).balance;
    }

    function demo() public payable returns (DemoResult memory){
        DeleteContract del = new DeleteContract{value:msg.value}();
        DemoResult memory res = DemoResult({
            addr: address(del),
            balance: del.getBalance(),
            value: del.value()
        });
        del.deleteContract();
        return res;
    }
}
```
