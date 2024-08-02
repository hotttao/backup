---
weight: 1
title: "空投合约"
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

## 1. 空投合约

以下是对代币水龙头、空投代币合约和荷兰拍卖的介绍，分别阐述它们的功能和用途：

### 代币水龙头（Token Faucet）

- **功能**: 代币水龙头是一种智能合约，允许用户免费领取特定数量的代币。通常用于推广新代币或帮助用户轻松获取代币以便进行试用。
- **用途**:
  - 吸引用户关注和参与新项目。
  - 允许用户测试代币功能而无需购买。
  - 提高代币的流动性和使用率。

### 空投代币合约（Airdrop Token Contract）

- **功能**: 空投合约用于将代币免费分发给特定用户或地址。通常是为了奖励持有者或在特定活动中激励用户。
- **用途**:
  - 激励用户持有代币，增强社区参与感。
  - 通过空投来推广项目，吸引新用户。
  - 用于特定事件或活动的营销推广，例如项目启动或社区庆典。

### 荷兰拍卖（Dutch Auction）

- **功能**: 荷兰拍卖是一种拍卖形式，起始价格较高，随着时间的推移逐渐降低，直到有买家愿意接受当前价格。用于销售代币或其他资产。
- **用途**:
  - 提供一种公平的定价机制，确保代币以市场价格出售。
  - 吸引投资者，通过价格下降激励他们购买。
  - 允许项目团队在一定时间内控制代币的销售过程，提高市场透明度。

这些机制各自有助于提升代币的使用价值和市场流通性，为项目的成功提供支持。

以下是一个表格，展示了代币水龙头（Token Faucet）、空投代币合约（Airdrop Token Contract）和荷兰拍卖（Dutch Auction）这三种常见合约类型的方法声明及其含义。


| 合约类型              | 方法声明                             | 方法含义                                                                                                     |
|-----------------------|--------------------------------------|--------------------------------------------------------------------------------------------------------------|
| **代币水龙头**        | `function requestTokens() public`    | 用户请求领取一定数量的代币。                                                                                  |
|                       | `function setTokenAddress(address _token) public` | 设置代币合约的地址。                                                                                         |
|                       | `function setAmount(uint256 _amount) public` | 设置每次领取的代币数量。                                                                                     |
|                       | `function setCooldown(uint256 _cooldown) public` | 设置用户请求代币的冷却时间。                                                                                 |
|                       | `function fundFaucet(uint256 _amount) public` | 向水龙头合约中注入代币。                                                                                     |
| **空投代币合约**      | `function airdrop() public`           | 向一组地址空投代币。                                                                                         |
|                       | `function setAirdropList(address[] memory _recipients) public` | 设置空投地址列表。                                                                                           |
|                       | `function setTokenAddress(address _token) public` | 设置代币合约的地址。                                                                                         |
|                       | `function setAmount(uint256 _amount) public` | 设置每个地址接收的代币数量。                                                                                 |
|                       | `function claimTokens() public`       | 用户从空投中领取他们的代币。                                                                                 |
|                       | `function withdrawTokens() public`    | 提取合约中的剩余代币。                                                                                       |
| **荷兰拍卖**          | `function startAuction(uint256 _initialPrice, uint256 _reservePrice, uint256 _duration) public` | 开始拍卖，设置初始价格、最低价格和拍卖持续时间。                                                             |
|                       | `function bid() public payable`       | 用户出价购买代币。                                                                                           |
|                       | `function finalizeAuction() public`   | 拍卖结束后，确认和分配代币及资金。                                                                           |
|                       | `function withdrawFunds() public`     | 提取拍卖所得资金。                                                                                           |
|                       | `function getCurrentPrice() public view returns (uint256)` | 获取拍卖当前价格。                                                                                           |



## 1.1 水龙头合约

```solidity
// ERC20代币的水龙头合约
contract Faucet {

    uint256 public amountAllowed = 100; // 每次领 100单位代币
    address public tokenContract;   // token合约地址
    mapping(address => bool) public requestedAddress;   // 记录领取过代币的地址

    // SendToken事件    
    event SendToken(address indexed Receiver, uint256 indexed Amount); 

    // 部署时设定ERC20代币合约
    constructor(address _tokenContract) {
        tokenContract = _tokenContract; // set token contract
    }

    // 用户领取代币函数
    function requestTokens() external {
        require(!requestedAddress[msg.sender], "Can't Request Multiple Times!"); // 每个地址只能领一次
        IERC20 token = IERC20(tokenContract); // 创建IERC20合约对象
        require(token.balanceOf(address(this)) >= amountAllowed, "Faucet Empty!"); // 水龙头空了

        token.transfer(msg.sender, amountAllowed); // 发送token
        requestedAddress[msg.sender] = true; // 记录领取地址 
        
        emit SendToken(msg.sender, amountAllowed); // 释放SendToken事件
    }
}
```


### 1.2 空投合约

```solidity
/// @notice 向多个地址转账ERC20代币
contract Airdrop {
    mapping(address => uint) failTransferList;

    /// @notice 向多个地址转账ERC20代币，使用前需要先授权
    ///
    /// @param _token 转账的ERC20代币地址
    /// @param _addresses 空投地址数组
    /// @param _amounts 代币数量数组（每个地址的空投数量）
    function multiTransferToken(
        address _token,
        address[] calldata _addresses,
        uint256[] calldata _amounts
    ) external {
        // 检查：_addresses和_amounts数组的长度相等
        require(
            _addresses.length == _amounts.length,
            "Lengths of Addresses and Amounts NOT EQUAL"
        );
        IERC20 token = IERC20(_token); // 声明IERC合约变量
        uint _amountSum = getSum(_amounts); // 计算空投代币总量
        // 检查：授权代币数量 > 空投代币总量
        require(
            token.allowance(msg.sender, address(this)) > _amountSum,
            "Need Approve ERC20 token"
        );

        // for循环，利用transferFrom函数发送空投
        for (uint256 i; i < _addresses.length; i++) {
            token.transferFrom(msg.sender, _addresses[i], _amounts[i]);
        }
    }

    /// 向多个地址转账ETH
    function multiTransferETH(
        address payable[] calldata _addresses,
        uint256[] calldata _amounts
    ) public payable {
        // 检查：_addresses和_amounts数组的长度相等
        require(
            _addresses.length == _amounts.length,
            "Lengths of Addresses and Amounts NOT EQUAL"
        );
        uint _amountSum = getSum(_amounts); // 计算空投ETH总量
        // 检查转入ETH等于空投总量
        require(msg.value == _amountSum, "Transfer amount error");
        // for循环，利用transfer函数发送ETH
        for (uint256 i = 0; i < _addresses.length; i++) {
            // 注释代码有Dos攻击风险, 并且transfer 也是不推荐写法
            // Dos攻击 具体参考 https://github.com/AmazingAng/WTF-Solidity/blob/main/S09_DoS/readme.md
            // _addresses[i].transfer(_amounts[i]);
            (bool success, ) = _addresses[i].call{value: _amounts[i]}("");
            if (!success) {
                failTransferList[_addresses[i]] = _amounts[i];
            }
        }
    }

    // 给空投失败提供主动操作机会
    function withdrawFromFailList(address _to) public {
        uint failAmount = failTransferList[msg.sender];
        require(failAmount > 0, "You are not in failed list");
        failTransferList[msg.sender] = 0;
        (bool success, ) = _to.call{value: failAmount}("");
        require(success, "Fail withdraw");
    }

    // 数组求和函数
    function getSum(uint256[] calldata _arr) public pure returns (uint sum) {
        for (uint i = 0; i < _arr.length; i++) sum = sum + _arr[i];
    }
}

```

### 1.3 荷兰式拍卖

```solidity
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../34_ERC721/ERC721.sol";

contract DutchAuction is Ownable, ERC721 {
    uint256 public constant COLLECTION_SIZE = 10000; // NFT总数
    uint256 public constant AUCTION_START_PRICE = 1 ether; // 起拍价
    uint256 public constant AUCTION_END_PRICE = 0.1 ether; // 结束价（最低价）
    uint256 public constant AUCTION_TIME = 10 minutes; // 拍卖时间，为了测试方便设为10分钟
    uint256 public constant AUCTION_DROP_INTERVAL = 1 minutes; // 每过多久时间，价格衰减一次
    uint256 public constant AUCTION_DROP_PER_STEP =
        (AUCTION_START_PRICE - AUCTION_END_PRICE) /
        (AUCTION_TIME / AUCTION_DROP_INTERVAL); // 每次价格衰减步长
    
    uint256 public auctionStartTime; // 拍卖开始时间戳
    string private _baseTokenURI;   // metadata URI
    uint256[] private _allTokens; // 记录所有存在的tokenId 

    //设定拍卖起始时间：我们在构造函数中会声明当前区块时间为起始时间，项目方也可以通过`setAuctionStartTime(uint32)`函数来调整
    constructor() Ownable(msg.sender) ERC721("WTF Dutch Auction", "WTF Dutch Auction") {
        auctionStartTime = block.timestamp;
    }

    /**
     * ERC721Enumerable中totalSupply函数的实现
     */
    function totalSupply() public view virtual returns (uint256) {
        return _allTokens.length;
    }

    /**
     * Private函数，在_allTokens中添加一个新的token
     */
    function _addTokenToAllTokensEnumeration(uint256 tokenId) private {
        _allTokens.push(tokenId);
    }

    // 拍卖mint函数
    function auctionMint(uint256 quantity) external payable{
        uint256 _saleStartTime = uint256(auctionStartTime); // 建立local变量，减少gas花费
        require(
        _saleStartTime != 0 && block.timestamp >= _saleStartTime,
        "sale has not started yet"
        ); // 检查是否设置起拍时间，拍卖是否开始
        require(
        totalSupply() + quantity <= COLLECTION_SIZE,
        "not enough remaining reserved for auction to support desired mint amount"
        ); // 检查是否超过NFT上限

        uint256 totalCost = getAuctionPrice() * quantity; // 计算mint成本
        require(msg.value >= totalCost, "Need to send more ETH."); // 检查用户是否支付足够ETH
        
        // Mint NFT
        for(uint256 i = 0; i < quantity; i++) {
            uint256 mintIndex = totalSupply();
            _mint(msg.sender, mintIndex);
            _addTokenToAllTokensEnumeration(mintIndex);
        }
        // 多余ETH退款
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost); //注意一下这里是否有重入的风险
        }
    }

    // 获取拍卖实时价格
    function getAuctionPrice()
        public
        view
        returns (uint256)
    {
        if (block.timestamp < auctionStartTime) {
        return AUCTION_START_PRICE;
        }else if (block.timestamp - auctionStartTime >= AUCTION_TIME) {
        return AUCTION_END_PRICE;
        } else {
        uint256 steps = (block.timestamp - auctionStartTime) /
            AUCTION_DROP_INTERVAL;
        return AUCTION_START_PRICE - (steps * AUCTION_DROP_PER_STEP);
        }
    }

    // auctionStartTime setter函数，onlyOwner
    function setAuctionStartTime(uint32 timestamp) external onlyOwner {
        auctionStartTime = timestamp;
    }

    // BaseURI
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }
    // BaseURI setter函数, onlyOwner
    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }
    // 提款函数，onlyOwner
    function withdrawMoney() external onlyOwner {
        (bool success, ) = msg.sender.call{value: address(this).balance}("");
        require(success, "Transfer failed.");
    }
}
```