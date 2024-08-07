---
weight: 1
title: "工具合约"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Solidity 简介和 Solidity 中的基础术语"
featuredImage: 

tags: ["Solidity 合约"]
categories: ["Solidity"]

lightgallery: true

toc:
  auto: false
---

## 1. 工具合约概述
这一节我们来介绍一些工具合约:
1. 获取随机数
2. 代币锁
3. 时间锁

## 2. 代币锁
### 2.1 LP 代币
LP 代币（Liquidity Provider Tokens）是指流动性提供者代币，它们在去中心化金融（DeFi）生态系统中扮演着重要角色。LP 代币的主要作用是代表用户在去中心化交易所（DEX）或流动性池中提供的流动性份额。以下是 LP 代币的详细解释：

#### 流动性池 (Liquidity Pool)
流动性池是去中心化交易所（如 Uniswap、SushiSwap、Balancer 等）的核心部分，允许用户在没有传统订单簿的情况下进行交易。流动性池中包含两种或多种代币，用户可以通过这些池子进行交易。

#### 流动性提供者 (Liquidity Providers)
流动性提供者是指那些向流动性池中注入代币的人。作为回报，流动性提供者会获得一部分交易手续费，并且在注入流动性时会获得相应的 LP 代币。

#### LP 代币的功能
- **所有权凭证**：LP 代币是用户在流动性池中的所有权凭证，代表用户在池子中的份额。
- **收益分配**：持有 LP 代币的用户可以获得交易手续费的分成。
- **质押与借贷**：在某些 DeFi 协议中，LP 代币可以被用作质押以获得额外的奖励，或者在借贷协议中作为抵押品进行借贷。

#### LP 代币的运作原理
当用户将一定数量的两种代币（例如 ETH 和 USDC）注入流动性池时，他们会收到相应数量的 LP 代币。LP 代币的数量通常是根据用户提供的流动性份额按比例计算的。例如，如果用户提供了池子总流动性的10%，那么用户将获得10%的LP代币。

#### LP 代币的使用
- **赎回**：流动性提供者可以随时用 LP 代币赎回他们在流动性池中的份额，这包括他们最初提供的代币和他们应得的交易手续费。
- **收益**：流动性提供者通过持有和赎回 LP 代币，可以赚取交易手续费。

#### 示例
以 Uniswap 为例：
1. 用户将 ETH 和 USDC 注入 Uniswap 的 ETH/USDC 流动性池。
2. 用户收到相应数量的 Uniswap LP 代币，代表他们在该池中的份额。
3. 每次有交易在 ETH/USDC 池中进行时，交易手续费的一部分会分配给所有的流动性提供者。
4. 用户可以随时赎回 LP 代币，获得他们应得的 ETH 和 USDC 以及所赚取的手续费。


### 2.2 锁定流动性
如果项目方毫无征兆的撤出流动性池中的LP代币(**我的理解是撤出流动性池中的 ETH**)，那么投资者手中的代币就无法变现，直接归零了。这种行为也叫rug-pull。

但是如果LP代币是锁仓在代币锁合约中，在锁仓期结束以前，项目方无法撤出流动性池，也没办法rug pull。因此代币锁可以防止项目方过早跑路（要小心锁仓期满跑路的情况）。

### 2.3 代币锁合约

代币锁合约（Token Locking Contract）是一种智能合约机制，用于防止 Rug pull 等欺诈行为。它通过锁定流动性或代币，确保在一段时间内无法随意提取或转移这些资产，从而增加了项目的可信度和安全性。以下是代币锁合约防范 Rug pull 的原因和工作原理：

#### 代币锁合约的工作原理

1. **流动性锁定**：
   - 项目创建者将一定数量的代币（通常是项目代币和基础货币，如 ETH、USDT 等）注入到流动性池中，并通过代币锁合约将这些流动性代币（LP 代币）锁定在智能合约中。
   - 在设定的锁定期限内，这些流动性代币无法被提取或转移。

2. **代币锁定**：
   - 项目团队的代币或预分配给团队成员的代币可以被锁定在智能合约中。
   - 锁定期限结束之前，团队成员无法转移或出售这些代币。

#### 防范 Rug pull 的原因

1. **防止流动性撤出**：
   - 锁定流动性代币意味着项目创建者无法随意从流动性池中撤出资金。流动性池中的资金稳定，有助于维持市场的正常交易和代币的价格稳定。
   - 这种机制减少了项目创建者在短期内进行 Rug pull 的可能性，因为他们无法在锁定期内动用这些流动性代币。

2. **增加投资者信任**：
   - 锁定团队代币和流动性代币显示出项目方的长期承诺，表明他们对项目的未来发展有信心。
   - 投资者看到团队的代币被锁定，也会增加对项目的信任，降低投资风险。

3. **减少市场抛压**：
   - 团队代币被锁定，避免了团队成员在项目初期大量抛售代币的情况，减少了市场的抛压，有助于代币价格的稳定。
   - 投资者知道团队无法在短期内大量出售代币，也会更有信心持有代币。

### 2.4 代币锁合约实现
代币锁合约的逻辑很简单：
1. 开发者在部署合约时规定锁仓的时间，受益人地址，以及代币合约。
2. **开发者将代币转入TokenLocker合约**。
3. 在锁仓期满，受益人可以取走合约里的代币。

TokenLocker合约中共有4个状态变量。
1. token：锁仓代币地址。
2. beneficiary：受益人地址。
3. locktime：锁仓时间(秒)。
4. startTime：锁仓起始时间戳(秒)。

```solidity
// SPDX-License-Identifier: MIT
// wtf.academy
pragma solidity ^0.8.0;

import "../31_ERC20/IERC20.sol";
import "../31_ERC20/ERC20.sol";

/**
 * @dev ERC20代币时间锁合约。受益人在锁仓一段时间后才能取出代币。
 */
contract TokenLocker {

    // 事件
    event TokenLockStart(address indexed beneficiary, address indexed token, uint256 startTime, uint256 lockTime);
    event Release(address indexed beneficiary, address indexed token, uint256 releaseTime, uint256 amount);

    // 被锁仓的ERC20代币合约
    IERC20 public immutable token;
    // 受益人地址
    address public immutable beneficiary;
    // 锁仓时间(秒)
    uint256 public immutable lockTime;
    // 锁仓起始时间戳(秒)
    uint256 public immutable startTime;

    /**
     * @dev 部署时间锁合约，初始化代币合约地址，受益人地址和锁仓时间。
     * @param token_: 被锁仓的ERC20代币合约
     * @param beneficiary_: 受益人地址
     * @param lockTime_: 锁仓时间(秒)
     */
    constructor(
        IERC20 token_,
        address beneficiary_,
        uint256 lockTime_
    ) {
        require(lockTime_ > 0, "TokenLock: lock time should greater than 0");
        token = token_;
        beneficiary = beneficiary_;
        lockTime = lockTime_;
        startTime = block.timestamp;

        emit TokenLockStart(beneficiary_, address(token_), block.timestamp, lockTime_);
    }

    /**
     * @dev 在锁仓时间过后，将代币释放给受益人。
     */
    function release() public {
        require(block.timestamp >= startTime+lockTime, "TokenLock: current time is before release time");

        uint256 amount = token.balanceOf(address(this));
        require(amount > 0, "TokenLock: no tokens to release");

        token.transfer(beneficiary, amount);

        emit Release(msg.sender, address(token), block.timestamp, amount);
    }
}
```

## 3. 时间锁
时间锁，可以将智能合约的某些功能锁定一段时间。它的逻辑并不复杂：

- 在创建`Timelock`合约时，项目方可以设定锁定期，并把合约的管理员设为自己。

- 时间锁主要有三个功能：
    - 创建交易，并加入到时间锁队列。
    - 在交易的锁定期满后，执行交易。
    - 后悔了，取消时间锁队列中的某些交易。

- 项目方一般会把时间锁合约设为重要合约的管理员，例如金库合约，再通过时间锁操作他们。
- 时间锁合约的管理员一般为项目的多签钱包，保证去中心化。

要注意的是进入到时间锁队列的是交易参数的哈希，不包含所有实际的执行参数。合约也不自动在时间锁到期时自动执行。也是需要交易的发起方手动发起执行，所以有过期时间这个参数。

### 3.1 时间锁的接口
`Timelock`合约中共有`7`个函数。

- 构造函数：初始化交易锁定时间（秒）和管理员地址。
- `queueTransaction()`：创建交易并添加到时间锁队列中。参数比较复杂，因为要描述一个完整的交易：
    - `target`：目标合约地址
    - `value`：发送ETH数额
    - `signature`：调用的函数签名（function signature）
    - `data`：交易的call data
    - `executeTime`：交易执行的区块链时间戳。
    
    调用这个函数时，要保证交易预计执行时间`executeTime`大于当前区块链时间戳+锁定时间`delay`。交易的唯一标识符为所有参数的哈希值，利用`getTxHash()`函数计算。进入队列的交易会更新在`queuedTransactions`变量中，并释放`QueueTransaction`事件。
- `executeTransaction()`：执行交易。它的参数与`queueTransaction()`相同。要求被执行的交易在时间锁队列中，达到交易的执行时间，且没有过期。执行交易时用到了`solidity`的低级成员函数`call`，在[第22讲](https://github.com/AmazingAng/WTF-Solidity/blob/main/22_Call/readme.md)中有介绍。
- `cancelTransaction()`：取消交易。它的参数与`queueTransaction()`相同。它要求被取消的交易在队列中，会更新`queuedTransactions`并释放`CancelTransaction`事件。
- `changeAdmin()`：修改管理员地址，只能被`Timelock`合约调用。
- `getBlockTimestamp()`：获取当前区块链时间戳。
- `getTxHash()`：返回交易的标识符，为很多交易参数的`hash`。


### 3.2 时间锁包含的事件
`Timelock`合约中共有`4`个事件。
- `QueueTransaction`：交易创建并进入时间锁队列的事件。
- `ExecuteTransaction`：锁定期满后交易执行的事件。
- `CancelTransaction`：交易取消事件。
- `NewAdmin`：修改管理员地址的事件。

```solidity
    // 事件
    // 交易取消事件
    event CancelTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature,  bytes data, uint executeTime);
    // 交易执行事件
    event ExecuteTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature,  bytes data, uint executeTime);
    // 交易创建并进入队列 事件
    event QueueTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature, bytes data, uint executeTime);
    // 修改管理员地址的事件
    event NewAdmin(address indexed newAdmin);
```

### 3. 时间锁的实现
```solidity
    /**
     * @dev 构造函数，初始化交易锁定时间 （秒）和管理员地址
     */
contract Timelock{
   // 状态变量
    address public admin; // 管理员地址
    uint public constant GRACE_PERIOD = 7 days; // 交易有效期，过期的交易作废
    uint public delay; // 交易锁定时间 （秒）
    mapping (bytes32 => bool) public queuedTransactions; // txHash到bool，记录所有在时间锁队列中的交易


   function executeTransaction(address target, uint256 value, string memory signature, bytes memory data, uint256 executeTime) public payable onlyOwner returns (bytes memory) {
        bytes32 txHash = getTxHash(target, value, signature, data, executeTime);
        // 检查：交易是否在时间锁队列中
        require(queuedTransactions[txHash], "Timelock::executeTransaction: Transaction hasn't been queued.");
        // 检查：达到交易的执行时间
        require(getBlockTimestamp() >= executeTime, "Timelock::executeTransaction: Transaction hasn't surpassed time lock.");
        // 检查：交易没过期
       require(getBlockTimestamp() <= executeTime + GRACE_PERIOD, "Timelock::executeTransaction: Transaction is stale.");
        // 将交易移出队列
        queuedTransactions[txHash] = false;

        // 获取call data
        bytes memory callData;
        if (bytes(signature).length == 0) {
            callData = data;
        } else {
// 这里如果采用encodeWithSignature的编码方式来实现调用管理员的函数，请将参数data的类型改为address。不然会导致管理员的值变为类似"0x0000000000000000000000000000000000000020"的值。其中的0x20是代表字节数组长度的意思.
            callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
        }
        // 利用call执行交易
        (bool success, bytes memory returnData) = target.call{value: value}(callData);
        require(success, "Timelock::executeTransaction: Transaction execution reverted.");

        emit ExecuteTransaction(txHash, target, value, signature, data, executeTime);

        return returnData;
    }
}
