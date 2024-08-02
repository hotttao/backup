---
weight: 1
title: "代币"
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


## 1. 代币标准
以太坊 ERC（Ethereum Request for Comment）代币标准是为以太坊区块链上代币创建的一系列技术规范，其包括:
1. **ERC-20**
   - **父级**: 基础标准，定义了代币的基本功能。
   - **子级**:
     - **ERC-777**: 改进版本，增强了代币转账的功能和灵活性。
     - **ERC-4626**: 标准化的金库接口，用于收益率生成协议。

2. **ERC-721**
   - **父级**: 用于非同质化代币（NFT）的标准。
   - **子级**:
     - **ERC-998**: 复合的非同质化代币标准，允许将多个 NFT 组合成一个 NFT。

3. **ERC-1155**
   - 独立标准，支持同时创建和管理同质化和非同质化代币。

这些标准的继承关系如下:

```
#### ERC-20 家系
                    ┌───────────┐
                    │  ERC-20   │
                    └───────────┘
                    方法：
                    - totalSupply()
                    - balanceOf(address)
                    - transfer(address, uint256)
                    - transferFrom(address, address, uint256)
                    - approve(address, uint256)
                    - allowance(address, address)
                          │
        ┌─────────────────┼───────────────────┐
        │                                   │
   ┌───────────┐                         ┌───────────┐
   │  ERC-777  │                         │  ERC-4626 │
   └───────────┘                         └───────────┘
   方法：                                方法：
   - send(address, uint256, bytes)       - deposit(uint256, address)
   - authorizeOperator(address)          - withdraw(uint256, address, address)
   - revokeOperator(address)             - mint(uint256, address)
   - isOperatorFor(address, address)     - redeem(uint256, address, address)


#### ERC-721 家系

                    ┌───────────┐
                    │  ERC-721  │
                    └───────────┘
                    方法：
                    - ownerOf(uint256)
                    - safeTransferFrom(address, address, uint256)
                    - transferFrom(address, address, uint256)
                    - approve(address, uint256)
                    - getApproved(uint256)
                    - setApprovalForAll(address, bool)
                    - isApprovedForAll(address, address)
                          │
                          │
                     ┌───────────┐
                     │  ERC-998  │
                     └───────────┘
                     方法：
                     - ownerOfChild(address, uint256, uint256)
                     - onERC721Received(address, address, uint256, bytes)
                     - onERC1155Received(address, address, uint256, uint256, bytes)


#### 独立标准

                    ┌───────────┐
                    │ ERC-1155  │
                    └───────────┘
                    方法：
                    - balanceOf(address, uint256)
                    - balanceOfBatch(address[], uint256[])
                    - safeTransferFrom(address, address, uint256, uint256, bytes)
                    - safeBatchTransferFrom(address, address, uint256[], uint256[], bytes)
```


### ERC-20 家系

| 标准   | 方法                                      | 含义                                                         |
|--------|-------------------------------------------|--------------------------------------------------------------|
| ERC-20 | `totalSupply()`                           | 返回代币的总供应量。                                         |
|        | `balanceOf(address)`                      | 返回指定地址的余额。                                         |
|        | `transfer(address, uint256)`              | 转账指定数量的代币到指定地址。                               |
|        | `transferFrom(address, address, uint256)` | 从一个地址转移代币到另一个地址，使用授权机制。msg.sender 是被授权方|
|        | `approve(address, uint256)`               | 批准一个地址可以代表代币持有者花费指定数量的代币。           |
|        | `allowance(address, address)`             | 返回被批准地址可以花费的代币剩余数量。                       |
| ERC-777 | `send(address, uint256, bytes)`           | 发送指定数量的代币到指定地址，并附加数据。                   |
|        | `authorizeOperator(address)`              | 授权一个操作员地址可以管理代币持有者的代币。                 |
|        | `revokeOperator(address)`                 | 撤销一个操作员地址的授权。                                   |
|        | `isOperatorFor(address, address)`         | 查询一个地址是否被授权为另一个地址的操作员。                 |
| ERC-4626 | `deposit(uint256, address)`              | 存款指定数量的代币到金库地址。                               |
|        | `withdraw(uint256, address, address)`     | 从金库地址提取指定数量的代币到指定地址。                     |
|        | `mint(uint256, address)`                  | 铸造指定数量的新代币并分配给指定地址。                       |
|        | `redeem(uint256, address, address)`       | 从指定地址赎回指定数量的代币到另一个地址。                   |

### ERC-721 家系

| 标准   | 方法                                      | 含义                                                         |
|--------|-------------------------------------------|--------------------------------------------------------------|
| ERC-721 | `ownerOf(uint256)`                       | 返回指定 token ID 的所有者地址。                              |
|        | `safeTransferFrom(address, address, uint256)` | 安全地将指定的 token ID 从一个地址转移到另一个地址。         |
|        | `transferFrom(address, address, uint256)` | 将指定的 token ID 从一个地址转移到另一个地址。               |
|        | `approve(address, uint256)`               | 批准一个地址可以代表代币持有者管理指定的 token ID。          |
|        | `getApproved(uint256)`                    | 返回被批准管理指定 token ID 的地址。                         |
|        | `setApprovalForAll(address, bool)`        | 批准或撤销一个地址管理所有代币持有者的 token。               |
|        | `isApprovedForAll(address, address)`      | 查询一个地址是否被批准管理另一个地址的所有 token。           |
| ERC-998 | `ownerOfChild(address, uint256, uint256)` | 返回指定的父 token ID 和子 token ID 的所有者地址。           |
|        | `onERC721Received(address, address, uint256, bytes)` | 在接收到 ERC-721 代币时调用的钩子方法。                    |
|        | `onERC1155Received(address, address, uint256, uint256, bytes)` | 在接收到 ERC-1155 代币时调用的钩子方法。                  |

通过这个表格，可以清楚地看到各个 ERC 标准之间的继承关系以及它们的方法和含义。


## 2. ERC20

```solidity
pragma solidity ^0.8.21;

import "./IERC20.sol";

contract ERC20 is IERC20 {

    mapping(address => uint256) public override balanceOf;

    mapping(address => mapping(address => uint256)) public override allowance;

    uint256 public override totalSupply;   // 代币总供给

    string public name;   // 名称
    string public symbol;  // 符号
    
    uint8 public decimals = 18; // 小数位数

    // @dev 在合约部署的时候实现合约名称和符号
    constructor(string memory name_, string memory symbol_){
        name = name_;
        symbol = symbol_;
    }

    // @dev 实现`transfer`函数，代币转账逻辑
    function transfer(address recipient, uint amount) public override returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        emit Transfer(msg.sender, recipient, amount);
        return true;
    }

    // @dev 实现 `approve` 函数, 代币授权逻辑
    function approve(address spender, uint amount) public override returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    // @dev 实现`transferFrom`函数，代币授权转账逻辑
    function transferFrom(
        address sender,
        address recipient,
        uint amount
    ) public override returns (bool) {
        allowance[sender][msg.sender] -= amount;
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;
        emit Transfer(sender, recipient, amount);
        return true;
    }

    // @dev 铸造代币，从 `0` 地址转账给 调用者地址
    function mint(uint amount) external {
        balanceOf[msg.sender] += amount;
        totalSupply += amount;
        emit Transfer(address(0), msg.sender, amount);
    }

    // @dev 销毁代币，从 调用者地址 转账给  `0` 地址
    function burn(uint amount) external {
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
    }

}
```

## 3. ERC721
### 3.1 检查合约是否实现某个接口
通过ERC165标准，智能合约可以声明它支持的接口，供其他合约检查。

```solidity
interface IERC165 {
    /**
     * @dev 如果合约实现了查询的`interfaceId`，则返回true
     * 规则详见：https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[EIP section]
     *
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
```

那如何你想检查一个合约是否支持 ERC721，你首先要检查这个合约，那首先你需要检查这个合约是否实现了 ERC165，然后再检查它是否实现了 ERC721：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// 导入 IERC165 接口
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

contract MyContract {
    // 使用 IERC165 接口
    function checkERC165(address contractAddress) public view returns (bool) {
        IERC165 target = IERC165(contractAddress);

        // 使用 try/catch 捕获可能的异常
        // 这里也可以直接检查 IERC721
        try target.supportsInterface(type(IERC165).interfaceid) returns (bool supports) {
            return supports;
        } catch {
            // 如果调用失败，返回 false
            return false;
        }
    }
}
```

### 3.2 检查合约是否实现特定方法
这里我们以 IERC721Receiver 为例说明。如果一个合约没有实现ERC721的相关函数，转入的NFT就进了黑洞，ERC721实现了safeTransferFrom() 要求目标合约必须实现 IERC721Receiver 接口。其实就是要求目标合约必须实现 safeTransferFrom 函数。

实现的过程有一下步骤:
1. 定义只包含目标方法的接口
2. 尝试通过接口调用目标合约

```solidity
interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

contract ERC721 is IERC721, IERC721Metadata{
    function _checkOnERC721Received(address from, address to, uint256 tokenId, bytes memory data) private {
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
                if (retval != IERC721Receiver.onERC721Received.selector) {
                    revert ERC721InvalidReceiver(to);
                }
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert ERC721InvalidReceiver(to);
                } else {
                    /// @solidity memory-safe-assembly
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        }
    }

}
```

### 3.3 ERC721 实现
```solidity
contract ERC721 is IERC721, IERC721Metadata{
    using Strings for uint256; // 使用String库，

    // Token名称
    string public override name;
    // Token代号
    string public override symbol;
    // tokenId 到 owner address 的持有人映射
    mapping(uint => address) private _owners;
    // address 到 持仓数量 的持仓量映射
    mapping(address => uint) private _balances;
    // tokenID 到 授权地址 的授权映射
    mapping(uint => address) private _tokenApprovals;
    //  owner地址。到operator地址 的批量授权映射
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    // 错误 无效的接收者
    error ERC721InvalidReceiver(address receiver);

    /**
     * 构造函数，初始化`name` 和`symbol` .
     */
    constructor(string memory name_, string memory symbol_) {
        name = name_;
        symbol = symbol_;
    }
}
```
