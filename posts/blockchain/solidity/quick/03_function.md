---
weight: 1
title: "Solidity 函数与异常控制"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Solidity 函数与异常控制"
featuredImage: 

tags: ["Solidity 语法"]
categories: ["Solidity"]

lightgallery: true

toc:
  auto: false
---


## 1. 函数
问: 以表格的形式，对比 Go 和 Solidity 的函数充分考虑，有关函数的各种特性，包括不限于 定义、传参方式、闭包、匿名函数、异常处理、函数重载、匿名参数、函数回调、高阶函数、函数式编程、方法重写、函数指针和函数返回多个值，并给出代码示例

下面是对Go和Solidity中函数特性进行的详细对比，包括定义、传参方式、闭包、匿名函数、异常处理、函数重载、匿名参数、函数回调、高阶函数、函数式编程、方法重写、函数指针和函数返回多个值。每个特性都包括一个简单的代码示例。

| 特性                  | Go                                                  | Solidity                                            |
|-----------------------|-----------------------------------------------------|-----------------------------------------------------|
| **定义**              | `func add(a int, b int) int { return a + b }`       | `function add(uint a, uint b) public pure returns (uint) { return a + b; }` |
| **传参方式**          | 值传递和引用传递                                      | 值传递和引用传递                                                |
| **闭包**              | `func adder() func(int) int { sum := 0; return func(x int) int { sum += x; return sum; } }` | 不支持闭包                                            |
| **匿名函数**          | `func(a int, b int) int { return a + b }`           | 不直接支持匿名函数，但可以用`function`类型变量来模拟    |
| **异常处理**          | `defer`, `panic`, `recover`                        | `require`, `assert`, `revert`                        |
| **函数重载**          | 不支持                                              | 不支持                                               |
| **匿名参数**          | `_` 可用于忽略不需要的返回值                         | 不支持                                               |
| **函数回调**          | 通过传递函数作为参数实现                               | 不支持（可以通过调用其他合约函数模拟）                |
| **高阶函数**          | 函数可以作为参数和返回值                             | 不支持                                               |
| **函数式编程**        | 支持匿名函数和高阶函数                                | 不支持                                               |
| **方法重写**          | 支持通过结构体嵌套和接口实现                          | 支持通过继承和`override`关键字实现                    |
| **函数指针**          | 函数类型变量可以存储函数                               | 不支持                                               |
| **函数返回多个值**    | `func swap(a, b int) (int, int) { return b, a }`    | 不直接支持多个返回值，但可以通过元组模拟               |


## 2. Solidity 的函数
Solidity 中函数的形式:

```solidity
function <function name>(<parameter types>) {internal|external|public|private} [pure|view|payable] [returns (<return types>)]
```

Solidity 中函数

1. `function`：声明函数时的固定用法。要编写函数，就需要以 `function` 关键字开头。
2. `<function name>`：函数名。
3. `(<parameter types>)`：圆括号内写入函数的参数，即输入到函数的变量类型和名称。
4. `{internal|external|public|private}`：函数可见性说明符，共有4种。
    - `public`：内部和外部均可见。
    - `private`：只能从本合约内部访问，继承的合约也不能使用。
    - `external`：只能从合约外部访问（但内部可以通过 `this.f()` 来调用，`f`是函数名）。
    - `internal`: 只能从合约内部访问，继承的合约可以用。

    **注意 1**：合约中定义的函数需要明确指定可见性，它们没有默认值。

    **注意 2**：`public|private|internal` 也可用于修饰状态变量。`public`变量会自动生成同名的`getter`函数，用于查询数值。未标明可见性类型的状态变量，默认为`internal`。
5. `[pure|view|payable]`：状态修饰符描述了函数如何与合约状态交互。
    - view: 函数不会修改状态变量
    - pure: 函数既不读取也不修改状态变量
    - payable: 函数可以接收以太币
6. `[returns ()]`：函数返回的变量类型和名称。


在以太坊中，以下语句被视为修改链上状态：
1. 写入状态变量。
2. 释放事件。
3. 创建其他合约。
4. 使用 selfdestruct.
5. 通过调用发送以太币。
6. 调用任何未标记 view 或 pure 的函数。
7. 使用低级调用（low-level calls）。
8. 使用包含某些操作码的内联汇编。


### 2.1 参数与返回值

函数可以接受参数，并返回一个或多个值。

```solidity
pragma solidity ^0.8.0;

contract Example {
    // 带参数和返回值的函数
    function add(uint a, uint b) public pure returns (uint) {
        return a + b;
    }
    
    // 返回多个值
    function swap(uint a, uint b) public pure returns (uint, uint) {
        return (b, a);
    }
}
```


### 2.2 修饰符（Modifiers）

修饰符有点类似于装饰器，用于更改函数的行为，通常用于访问控制和前置条件检查。

```solidity
pragma solidity ^0.8.0;

contract Example {
    address public owner;

    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the contract owner");
        _; // 如果是的话，继续运行函数主体；否则报错并revert交易
    }
    
    modifier validAddress(address _address) {
        require(_address != address(0), "Invalid address");
        _; 
    }
    
    function restrictedFunction(address _address) public onlyOwner validAddress(_address) pure returns(uint, uint){
        // 仅限所有者且地址有效时执行的代码
    }
}
```


### 内联汇编（Inline Assembly）

Solidity允许在函数中使用内联汇编来编写低级别代码。

```solidity
pragma solidity ^0.8.0;

contract Example {
    function assemblyFunction(uint a, uint b) public pure returns (uint) {
        assembly {
            let result := add(a, b)
            mstore(0x40, result)
            return(0x40, 32)
        }
    }
}
```


## 3. 异常处理
Solidity有 三种抛出异常的方法：error，require和assert，下面是他们使用的简单示例:


```solidity
pragma solidity ^0.8.0;

contract Example {

    error ValueTooLow(uint256 value, uint256 minValue);

    function testRequire(uint a) public pure {
        require(a > 10, "Value must be greater than 10");
    }

    function testAssert(uint a) public pure {
        assert(a != 0);
    }

    function testRevert(uint a) public pure {
        if (a <= 10) {
            revert("Value must be greater than 10");
        }
    }

    function check(uint _value) public pure {
        uint minValue = 1;
        if (_value < minValue) {
            revert ValueTooLow(_value, minValue); // 使用自定义错误类型
        }
    }
}
```

### 3.1 error
error 可以自定义异常，error 必须搭配 revert（回退）命令使用。

### 3.2 require
require 使用方法：require(检查条件，"异常的描述")，当检查条件不成立的时候，就会抛出异常。唯一的缺点就是gas随着描述异常的字符串长度增加，比error命令要高。

### 3.3 assert
`assert(检查条件）`，当检查条件不成立的时候，就会抛出异常。

### 3.4 try-catch
Solidity中，try-catch只能被用于external函数或创建合约时constructor（被视为external函数）的调用。基本语法如下：

```solidity
// this.f() 可以替代 externalContract.f()，this.f()也被视作为外部调用
try externalContract.f() {
    // call成功的情况下 运行一些代码
} catch {
    // call失败的情况下 运行一些代码
}
```

如果调用的函数有返回值，那么必须在try之后声明returns(returnType val)，并且在try模块中可以使用返回的变量；如果是创建合约，那么返回值是新创建的合约变量。

```solidity
try externalContract.f() returns(returnType){
    // call成功的情况下 运行一些代码
} catch Error(string memory /*reason*/) {
    // 捕获revert("reasonString") 和 require(false, "reasonString")
} catch Panic(uint /*errorCode*/) {
    // 捕获Panic导致的错误 例如assert失败 溢出 除零 数组访问越界
} catch (bytes memory /*lowLevelData*/) {
    // 如果发生了revert且上面2个异常类型匹配都失败了 会进入该分支
    // 例如revert() require(false) revert自定义类型的error
}
```


#### 捕获函数调用异常
```solidity
pragma solidity ^0.8.0;

contract CalledContract {
    function mightFail(uint _value) public pure returns (uint) {
        require(_value != 0, "Value cannot be zero");
        return _value;
    }
}

pragma solidity ^0.8.0;

contract CallerContract {
    function callMightFail(address calledContractAddress, uint _value) public returns (string memory) {
        CalledContract calledContract = CalledContract(calledContractAddress);
        try calledContract.mightFail(_value) returns (uint result) {
            return "Success";
        } catch Error(string memory reason) {
            // This is executed in case revert was called with a reason string
            return reason;
        } catch (bytes memory lowLevelData) {
            // This is executed in case revert() was used or there was a failing assertion
            return "Low level error";
        }
    }
}

interface CalledContract {
    function mightFail(uint _value) external returns (uint);
}

```

#### 捕获合约创建异常

```solidity
pragma solidity ^0.8.0;

contract DeployableContract {
    constructor(uint _value) {
        require(_value != 0, "Value cannot be zero");
    }
}

pragma solidity ^0.8.0;

contract DeployerContract {
    event DeploymentResult(bool success, string reason);

    function deployContract(uint _value) public {
        try new DeployableContract(_value) returns (DeployableContract deployedContract) {
            emit DeploymentResult(true, "Contract deployed successfully");
        } catch Error(string memory reason) {
            // This is executed in case revert was called with a reason string
            emit DeploymentResult(false, reason);
        } catch (bytes memory lowLevelData) {
            // This is executed in case revert() was used or there was a failing assertion
            emit DeploymentResult(false, "Low level error");
        }
    }
}

```