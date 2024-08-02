---
weight: 1
title: "OpenZeppelin 简介"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Solidity 简介和 Solidity 中的基础术语"
featuredImage: 

tags: ["OpenZeppelin"]
categories: ["Solidity"]

lightgallery: true

toc:
  auto: false
---


以下是 OpenZeppelin 合约库（`openzeppelin/contracts`）中包含的主要合约和接口，以表格形式展示：

| 合约/接口类别    | 文件路径                                 | 描述                                                         |
|------------------|------------------------------------------|--------------------------------------------------------------|
| **访问控制**     |                                          |                                                              |
| Access Control   | `access/AccessControl.sol`               | 提供基于角色的权限管理机制。                                  |
| Ownable          | `access/Ownable.sol`                     | 简单的所有权管理，提供只有所有者才能执行的功能。              |
| **治理**         |                                          |                                                              |
| Governor         | `governance/Governor.sol`                | 实现治理机制的合约基础。                                      |
| TimelockController | `governance/TimelockController.sol`    | 提供时间锁机制的控制器。                                      |
| **代币标准**     |                                          |                                                              |
| ERC20            | `token/ERC20/ERC20.sol`                  | ERC-20 标准的代币实现。                                       |
| ERC721           | `token/ERC721/ERC721.sol`                | ERC-721 标准的不可替代代币实现。                              |
| ERC777           | `token/ERC777/ERC777.sol`                | ERC-777 标准的代币实现。                                      |
| ERC1155          | `token/ERC1155/ERC1155.sol`              | ERC-1155 标准的多代币类型实现。                                |
| **安全**         |                                          |                                                              |
| ReentrancyGuard  | `security/ReentrancyGuard.sol`           | 防止重入攻击的合约模块。                                      |
| Pausable         | `security/Pausable.sol`                  | 提供紧急停止机制的模块。                                      |
| **数学**         |                                          |                                                              |
| SafeMath         | `utils/math/SafeMath.sol`                | 提供安全数学运算，避免溢出和下溢。                           |
| **字符串**       |                                          |                                                              |
| Strings          | `utils/Strings.sol`                      | 提供字符串操作的实用函数。                                    |
| **合约工具**     |                                          |                                                              |
| Address          | `utils/Address.sol`                      | 提供与地址类型相关的实用函数。                                |
| Context          | `utils/Context.sol`                      | 提供当前执行环境的信息。                                      |
| **合约探测**     |                                          |                                                              |
| IERC165          | `utils/introspection/IERC165.sol`        | ERC-165 标准的接口定义。                                      |
| ERC165           | `utils/introspection/ERC165.sol`         | ERC-165 标准的实现。                                          |
| **支付**         |                                          |                                                              |
| PaymentSplitter  | `finance/PaymentSplitter.sol`            | 提供支付拆分功能的合约。                                      |
| **代理**         |                                          |                                                              |
| Proxy            | `proxy/Proxy.sol`                        | 代理合约的基础实现。                                          |
| TransparentUpgradeableProxy | `proxy/transparent/TransparentUpgradeableProxy.sol` | 可升级的透明代理合约实现。                                    |
| **库**           |                                          |                                                              |
| EnumerableSet    | `utils/structs/EnumerableSet.sol`        | 提供可枚举集合的数据结构。                                    |
| EnumerableMap    | `utils/structs/EnumerableMap.sol`        | 提供可枚举映射的数据结构。                                    |

此表格列出了 OpenZeppelin 库中一些主要的合约和接口，以帮助开发者快速找到所需的模块和功能。 OpenZeppelin 的合约库还包含更多的工具和实现，开发者可以通过查阅其官方文档获取更详细的信息。