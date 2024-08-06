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

ERC20是以太坊上的代币标准，它实现了代币转账的基本逻辑。以下是以列表形式展示的 ERC20 包含的方法声明、方法的作用和事件：

1. **name**
   - **声明**: `function name() public view returns (string)`
   - **作用**: 返回代币的名称。

2. **symbol**
   - **声明**: `function symbol() public view returns (string)`
   - **作用**: 返回代币的符号。

3. **decimals**
   - **声明**: `function decimals() public view returns (uint8)`
   - **作用**: 返回代币的小数位数。

4. **totalSupply**
   - **声明**: `function totalSupply() public view returns (uint256)`
   - **作用**: 返回代币的总供应量。

5. **balanceOf**
   - **声明**: `function balanceOf(address account) public view returns (uint256)`
   - **作用**: 返回指定账户的代币余额。

6. **transfer**
   - **声明**: `function transfer(address recipient, uint256 amount) public returns (bool)`
   - **作用**: 将代币从调用者账户转移到指定的接收者账户。

7. **allowance**
   - **声明**: `function allowance(address owner, address spender) public view returns (uint256)`
   - **作用**: 返回授权给指定花费者的剩余代币数量。

8. **approve**
   - **声明**: `function approve(address spender, uint256 amount) public returns (bool)`
   - **作用**: 授权指定的花费者可以从调用者账户中花费的代币数量。

9. **transferFrom**
   - **声明**: `function transferFrom(address sender, address recipient, uint256 amount) public returns (bool)`
   - **作用**: 从一个账户转移代币到另一个账户，调用者必须被授权可以从发送者账户中花费代币。

### 事件

1. **Transfer**
   - **声明**: `event Transfer(address indexed from, address indexed to, uint256 value)`
   - **作用**: 当代币转移时触发，包括零值转移。

2. **Approval**
   - **声明**: `event Approval(address indexed owner, address indexed spender, uint256 value)`
   - **作用**: 当调用approve方法时触发，记录授权信息。


### 2.1 ERC20 实现

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
ERC721 用于定义非同质化代币（NFT）的标准。以下是ERC721 包含的方法声明、方法的作用和事件：

1. **balanceOf**
   - **声明**: `function balanceOf(address owner) external view returns (uint256)`
   - **作用**: 返回指定地址的代币余额。

2. **ownerOf**
   - **声明**: `function ownerOf(uint256 tokenId) external view returns (address)`
   - **作用**: 返回指定 tokenId 的所有者地址。

3. **safeTransferFrom (without data)**
   - **声明**: `function safeTransferFrom(address from, address to, uint256 tokenId) external`
   - **作用**: 安全地将 tokenId 的代币从一个地址转移到另一个地址。

4. **transferFrom**
   - **声明**: `function transferFrom(address from, address to, uint256 tokenId) external`
   - **作用**: 将 tokenId 的代币从一个地址转移到另一个地址。

5. **approve**
   - **声明**: `function approve(address to, uint256 tokenId) external`
   - **作用**: 授权地址对 tokenId 的代币进行操作。

6. **getApproved**
   - **声明**: `function getApproved(uint256 tokenId) external view returns (address)`
   - **作用**: 返回被授权地址对 tokenId 的代币进行操作。

7. **setApprovalForAll**
   - **声明**: `function setApprovalForAll(address operator, bool _approved) external`
   - **作用**: 批量授权/取消授权某个地址对调用者所有代币的操作权。

8. **isApprovedForAll**
   - **声明**: `function isApprovedForAll(address owner, address operator) external view returns (bool)`
   - **作用**: 检查 operator 是否被授权管理 owner 的所有代币。

9. **safeTransferFrom (with data)**
   - **声明**: `function safeTransferFrom(address from, address to, uint256 tokenId, bytes data) external`
   - **作用**: 安全地将 tokenId 的代币从一个地址转移到另一个地址，并附带额外数据。

1. **Transfer**
   - **声明**: `event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)`
   - **作用**: 当代币从一个地址转移到另一个地址时触发。

2. **Approval**
   - **声明**: `event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)`
   - **作用**: 当 tokenId 的代币授权给某个地址时触发。

3. **ApprovalForAll**
   - **声明**: `event ApprovalForAll(address indexed owner, address indexed operator, bool approved)`
   - **作用**: 当 owner 授权/取消授权 operator 操作其所有代币时触发。

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

那如何你想检查一个合约是否支持 ERC721，那首先你需要检查这个合约是否实现了 ERC165，然后再检查它是否实现了 ERC721：

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

## 4. ERC1155
ERC1155 是多代币标准，允许一个合约包含多个同质化和非同质化代币。ERC1155在GameFi应用最多，Decentraland、Sandbox等知名链游都使用它。

ERC1155 包含以下接口和事件:

ERC-1155 标准定义了一个多代币标准，可以在同一个合约中管理多种类型的代币。以下是 ERC-1155 中包含的主要接口和事件：

接口
1. **`balanceOf(address account, uint256 id) external view returns (uint256)`**
   - 返回指定账户在特定代币 ID 下的余额。
2. **`balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) external view returns (uint256[] memory)`**
   - 批量查询多个账户在多个代币 ID 下的余额。
3. **`setApprovalForAll(address operator, bool approved) external`**
   - 批准或撤销第三方操作员的权限，允许其管理所有代币。
4. **`isApprovedForAll(address account, address operator) external view returns (bool)`**
   - 检查账户是否授予操作员管理所有代币的权限。
5. **`safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external`**
   - 安全地转移指定数量的某种类型的代币。
6. **`safeBatchTransferFrom(address from, address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata data) external`**
   - 安全地批量转移多种类型的代币。

事件:
1. **`event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)`**
   - 在单次转移代币时触发。
2. **`event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)`**
   - 在批量转移代币时触发。
3. **`event ApprovalForAll(address indexed account, address indexed operator, bool approved)`**
   - 在账户批准或撤销操作员权限时触发。
4. **`event URI(string value, uint256 indexed id)`**
   - 当代币的 URI 被设置或更新时触发。

### 4.1 ERC1155 实现

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC1155.sol";
import "./IERC1155Receiver.sol";
import "./IERC1155MetadataURI.sol";
import "https://github.com/AmazingAng/WTF-Solidity/blob/main/34_ERC721/Address.sol";
import "https://github.com/AmazingAng/WTF-Solidity/blob/main/34_ERC721/String.sol";
import "https://github.com/AmazingAng/WTF-Solidity/blob/main/34_ERC721/IERC165.sol";

/**
 * @dev ERC1155多代币标准
 * 见 https://eips.ethereum.org/EIPS/eip-1155
 */
contract ERC1155 is IERC165, IERC1155, IERC1155MetadataURI {
    using Address for address; // 使用Address库，用isContract来判断地址是否为合约
    using Strings for uint256; // 使用String库
    // Token名称
    string public name;
    // Token代号
    string public symbol;
    // 代币种类id 到 账户account 到 余额balances 的映射
    mapping(uint256 => mapping(address => uint256)) private _balances;
    // address 到 授权地址 的批量授权映射
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    /**
     * 构造函数，初始化`name` 和`symbol`, uri_
     */
    constructor(string memory name_, string memory symbol_) {
        name = name_;
        symbol = symbol_;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == type(IERC1155).interfaceId ||
            interfaceId == type(IERC1155MetadataURI).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }

    // @dev ERC1155的批量安全转账检查
    function _doSafeBatchTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) private {
        if (to.isContract()) {
            try IERC1155Receiver(to).onERC1155BatchReceived(operator, from, ids, amounts, data) returns (
                bytes4 response
            ) {
                if (response != IERC1155Receiver.onERC1155BatchReceived.selector) {
                    revert("ERC1155: ERC1155Receiver rejected tokens");
                }
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("ERC1155: transfer to non-ERC1155Receiver implementer");
            }
        }
    }
```


## 5. WETH 简介
WETH (Wrapped ETH)是ETH的带包装版本。我们常见的WETH，WBTC，WBNB，都是带包装的原生代币。就像是给原生代币穿了一件智能合约做的衣服：穿上衣服的时候，就变成了WETH，符合ERC20同质化代币标准，可以跨链，可以用于dApp；脱下衣服，它可1:1兑换ETH。

WETH符合ERC20标准，它比普通的ERC20多了两个功能：
1. 存款：包装，用户将ETH存入WETH合约，并获得等量的WETH。
2. 取款：拆包装，用户销毁WETH，并获得等量的ETH。


### 5.1 WETH 实现

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WETH is ERC20{
    // 事件：存款和取款
    event  Deposit(address indexed dst, uint wad);
    event  Withdrawal(address indexed src, uint wad);

    // 构造函数，初始化ERC20的名字和代号
    constructor() ERC20("WETH", "WETH"){
    }

    // 回调函数，当用户往WETH合约转ETH时，会触发deposit()函数
    fallback() external payable {
        deposit();
    }
    // 回调函数，当用户往WETH合约转ETH时，会触发deposit()函数
    receive() external payable {
        deposit();
    }

    // 存款函数，当用户存入ETH时，给他铸造等量的WETH
    function deposit() public payable {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    // 提款函数，用户销毁WETH，取回等量的ETH
    function withdraw(uint amount) public {
        require(balanceOf(msg.sender) >= amount);
        _burn(msg.sender, amount);
        payable(msg.sender).transfer(amount);
        emit Withdrawal(msg.sender, amount);
    }
}
```