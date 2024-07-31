---
weight: 1
title: "Solidity 类"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Solidity 类"
featuredImage: 

tags: ["Solidity 语法"]
categories: ["Solidity"]

lightgallery: true

toc:
  auto: false
---

## 1. 接口和类定义
问: 以表格的形式，对比 Solidity 和Go 中的接口、实现、类、抽象类、继承
以下是对比 Solidity 和 Go 中的接口、实现、类、抽象类、继承的表格：

| 特性                   | Solidity                                      | Go                                        |
|------------------------|-----------------------------------------------|-------------------------------------------|
| **接口**               | `interface`                                   | `interface`                               |
| **实现接口**           | 合约可以实现多个接口                           | 类型隐式实现接口，通过实现所有接口方法      |
| **类**                 | Solidity 没有类的概念，但合约类似类            | Go 没有类的概念，通过结构体和方法模拟      |
| **抽象类**             | `abstract contract`                           | Go 没有抽象类，使用接口和具体类型实现抽象   |
| **继承**               | 单继承：`contract A is B`                      | 没有类继承，通过组合实现重用                |
| **多继承**             | 支持接口和合约的多继承                         | 不支持多继承，使用组合和接口实现            |
| **构造函数**           | `constructor`                                 | 没有构造函数概念，通过结构体初始化实现      |
| **方法重写**           | `virtual` 和 `override` 关键字                 | 不支持方法重写，通过接口实现多态            |


问: 以一个示例说清楚，Solidity 中的多继承、 方法重写、构造函数重写、父方法调用、函数重载

### 1.1 继承示例
以下是一个详细的示例，展示了 Solidity 中的抽象合约、多继承、方法重写、构造函数重写、父方法调用和函数重载。

### 1. 抽象合约
如果一个合约的某个函数缺少主体 `{}`，取而代之的是`;` 则这个函数为未实现。包含未实现函数的合约为抽象合约，必须标记为 abstract。

首先，我们定义两个抽象合约 `A` 和 `B`，它们包含抽象方法和具体方法。

```solidity
pragma solidity ^0.8.0;

abstract contract A {
    uint256 public value;

    // 抽象方法（没有实现）
    function setValue(uint256 _value) public virtual;

    // 具体方法
    function getValue() public view returns (uint256) {
        return value;
    }

    // 构造函数
    constructor(uint256 _value) {
        value = _value;
    }
}

abstract contract B {
    string public name;

    // 抽象方法（没有实现）
    function setName(string memory _name) public virtual;

    // 具体方法
    function getName() public view returns (string memory) {
        return name;
    }

    // 构造函数
    constructor(string memory _name) {
        name = _name;
    }
}
```

### 2. 派生合约 `C`，继承自 `A` 和 `B`

合约 `C` 继承了 `A` 和 `B`，并实现了它们的抽象方法。

```solidity
pragma solidity ^0.8.0;

import "./A.sol";
import "./B.sol";

contract C is A, B {
    // 派生合约构造函数，重写并调用父构造函数
    constructor(uint256 _value, string memory _name) A(_value) B(_name) {}

    // 实现父合约 A 的抽象方法
    function setValue(uint256 _value) public override {
        value = _value;
    }

    // 实现父合约 B 的抽象方法
    function setName(string memory _name) public override {
        name = _name;
    }

    // 函数重载
    function setValue(uint256 _value, uint256 _multiplier) public {
        value = _value * _multiplier;
    }
}
```


### 1.2 接口示例
以下是一个简单的例子，说明在 Solidity 中如何定义接口、实现接口以及使用接口。

#### 定义接口

首先，我们定义一个接口 `IMyInterface`，其中包含两个函数声明。

```solidity
pragma solidity ^0.8.0;

interface IMyInterface {
    function setValue(uint256 _value) external;
    function getValue() external view returns (uint256);
}
```

#### 实现接口

接下来，我们创建一个合约 `MyContract` 来实现这个接口。这个合约必须实现接口中的所有函数。

```solidity
pragma solidity ^0.8.0;

import "./IMyInterface.sol";

contract MyContract is IMyInterface {
    uint256 private value;

    // 实现接口中的 setValue 方法
    function setValue(uint256 _value) external override {
        value = _value;
    }

    // 实现接口中的 getValue 方法
    function getValue() external view override returns (uint256) {
        return value;
    }
}
```

#### 使用接口

最后，我们创建一个合约 `TestContract` 来使用 `IMyInterface` 接口。

```solidity
pragma solidity ^0.8.0;

import "./IMyInterface.sol";

contract TestContract {
    IMyInterface private myContract;

    // 在构造函数中传入实现了 IMyInterface 接口的合约地址
    constructor(address _myContractAddress) {
        myContract = IMyInterface(_myContractAddress);
    }

    // 调用 setValue 方法
    function testSetValue(uint256 _value) public {
        myContract.setValue(_value);
    }

    // 调用 getValue 方法
    function testGetValue() public view returns (uint256) {
        return myContract.getValue();
    }
}
```


## 2. Solidity 中的继承
### 规则

- `virtual`: 父合约中的函数，如果希望子合约重写，需要加上`virtual`关键字。

- `override`：子合约重写了父合约中的函数，需要加上`override`关键字。

**注意**：用`override`修饰`public`变量，会重写与变量同名的`getter`函数，例如：

```solidity
mapping(address => uint256) public override balanceOf;
```

### 简单继承

我们先写一个简单的爷爷合约`Yeye`，里面包含1个`Log`事件和3个`function`: `hip()`, `pop()`, `yeye()`，输出都是”Yeye”。

```solidity
contract Yeye {
    event Log(string msg);

    // 定义3个function: hip(), pop(), man()，Log值为Yeye。
    function hip() public virtual{
        emit Log("Yeye");
    }

    function pop() public virtual{
        emit Log("Yeye");
    }

    function yeye() public virtual {
        emit Log("Yeye");
    }
}
```

我们再定义一个爸爸合约`Baba`，让他继承`Yeye`合约，语法就是`contract Baba is Yeye`，非常直观。在`Baba`合约里，我们重写一下`hip()`和`pop()`这两个函数，加上`override`关键字，并将他们的输出改为`”Baba”`；并且加一个新的函数`baba`，输出也是`”Baba”`。

```solidity
contract Baba is Yeye{
    // 继承两个function: hip()和pop()，输出改为Baba。
    function hip() public virtual override{
        emit Log("Baba");
    }

    function pop() public virtual override{
        emit Log("Baba");
    }

    function baba() public virtual{
        emit Log("Baba");
    }
}
```

我们部署合约，可以看到`Baba`合约里有4个函数，其中`hip()`和`pop()`的输出被成功改写成`”Baba”`，而继承来的`yeye()`的输出仍然是`”Yeye”`。

### 多重继承

`Solidity`的合约可以继承多个合约。规则：

1. 继承时要按辈分最高到最低的顺序排。比如我们写一个`Erzi`合约，继承`Yeye`合约和`Baba`合约，那么就要写成`contract Erzi is Yeye, Baba`，而不能写成`contract Erzi is Baba, Yeye`，不然就会报错。

2. 如果某一个函数在多个继承的合约里都存在，比如例子中的`hip()`和`pop()`，在子合约里必须重写，不然会报错。

3. 重写在多个父合约中都重名的函数时，`override`关键字后面要加上所有父合约名字，例如`override(Yeye, Baba)`。

例子：

```solidity
contract Erzi is Yeye, Baba{
    // 继承两个function: hip()和pop()，输出值为Erzi。
    function hip() public virtual override(Yeye, Baba){
        emit Log("Erzi");
    }

    function pop() public virtual override(Yeye, Baba) {
        emit Log("Erzi");
    }
}
```

我们可以看到，`Erzi`合约里面重写了`hip()`和`pop()`两个函数，将输出改为`”Erzi”`，并且还分别从`Yeye`和`Baba`合约继承了`yeye()`和`baba()`两个函数。

### 修饰器的继承

`Solidity`中的修饰器（`Modifier`）同样可以继承，用法与函数继承类似，在相应的地方加`virtual`和`override`关键字即可。

```solidity
contract Base1 {
    modifier exactDividedBy2And3(uint _a) virtual {
        require(_a % 2 == 0 && _a % 3 == 0);
        _;
    }
}

contract Identifier is Base1 {

    //计算一个数分别被2除和被3除的值，但是传入的参数必须是2和3的倍数
    function getExactDividedBy2And3(uint _dividend) public exactDividedBy2And3(_dividend) pure returns(uint, uint) {
        return getExactDividedBy2And3WithoutModifier(_dividend);
    }

    //计算一个数分别被2除和被3除的值
    function getExactDividedBy2And3WithoutModifier(uint _dividend) public pure returns(uint, uint){
        uint div2 = _dividend / 2;
        uint div3 = _dividend / 3;
        return (div2, div3);
    }
}
```

`Identifier`合约可以直接在代码中使用父合约中的`exactDividedBy2And3`修饰器，也可以利用`override`关键字重写修饰器：

```solidity
modifier exactDividedBy2And3(uint _a) override {
    _;
    require(_a % 2 == 0 && _a % 3 == 0);
}
```

### 构造函数的继承

子合约有两种方法继承父合约的构造函数。举个简单的例子，父合约`A`里面有一个状态变量`a`，并由构造函数的参数来确定：

```solidity
// 构造函数的继承
abstract contract A {
    uint public a;

    constructor(uint _a) {
        a = _a;
    }
}
```

1. 在继承时声明父构造函数的参数，例如：`contract B is A(1)`
2. 在子合约的构造函数中声明构造函数的参数，例如：

    ```solidity
    contract C is A {
        constructor(uint _c) A(_c * _c) {}
    }
    ```

### 调用父合约的函数

子合约有两种方式调用父合约的函数，直接调用和利用`super`关键字。

1. 直接调用：子合约可以直接用`父合约名.函数名()`的方式来调用父合约函数，例如`Yeye.pop()`

    ```solidity
    function callParent() public{
        Yeye.pop();
    }
    ```

2. `super`关键字：子合约可以利用`super.函数名()`来调用最近的父合约函数。`Solidity`继承关系按声明时从右到左的顺序是：`contract Erzi is Yeye, Baba`，那么`Baba`是最近的父合约，`super.pop()`将调用`Baba.pop()`而不是`Yeye.pop()`：

    ```solidity
    function callParentSuper() public{
        // 将调用最近的父合约函数，Baba.pop()
        super.pop();
    }
    ```

### 钻石继承

在面向对象编程中，钻石继承（菱形继承）指一个派生类同时有两个或两个以上的基类。

在多重+菱形继承链条上使用`super`关键字时，需要注意的是使用`super`会调用继承链条上的每一个合约的相关函数，而不是只调用最近的父合约。

我们先写一个合约`God`，再写`Adam`和`Eve`两个合约继承`God`合约，最后让创建合约`people`继承自`Adam`和`Eve`，每个合约都有`foo`和`bar`两个函数。

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/* 继承树：
  God
 /  \
Adam Eve
 \  /
people
*/

contract God {
    event Log(string message);

    function foo() public virtual {
        emit Log("God.foo called");
    }

    function bar() public virtual {
        emit Log("God.bar called");
    }
}

contract Adam is God {
    function foo() public virtual override {
        emit Log("Adam.foo called");
        super.foo();
    }

    function bar() public virtual override {
        emit Log("Adam.bar called");
        super.bar();
    }
}

contract Eve is God {
    function foo() public virtual override {
        emit Log("Eve.foo called");
        super.foo();
    }

    function bar() public virtual override {
        emit Log("Eve.bar called");
        super.bar();
    }
}

contract people is Adam, Eve {
    function foo() public override(Adam, Eve) {
        super.foo();
    }

    function bar() public override(Adam, Eve) {
        super.bar();
    }
}

```

在这个例子中，调用合约`people`中的`super.bar()`会依次调用`Eve`、`Adam`，最后是`God`合约。

虽然`Eve`、`Adam`都是`God`的子合约，但整个过程中`God`合约只会被调用一次。原因是`Solidity`借鉴了Python的方式，强制一个由基类构成的DAG（有向无环图）使其保证一个特定的顺序。更多细节你可以查阅[Solidity的官方文档](https://solidity-cn.readthedocs.io/zh/develop/contracts.html?highlight=%E7%BB%A7%E6%89%BF#index-16)。


## 参考
上面内容摘录自: [AmazingAng/WTF-Solidity/](https://github.com/AmazingAng/WTF-Solidity/)
