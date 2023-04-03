
---
weight: 4
title: "领域驱动设计的示例和技巧"
date: 2021-05-01T22:00:00+08:00
lastmod: 2021-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "微服务设计之领域驱动设计"
featuredImage: 

tags: ["DDD"]
categories: ["design"]

lightgallery: true

---

上一篇文章我们介绍了领域驱动设计里面的概念和抽象，它给我们提供了一个思考的框架，当我们已经有领域模型之后应该去怎么设计我们的代码。今天我们来思考另一个问题: 如何得到符合业务的领域模型。

## 1. 为不太明显的概念建模
### 1.1 显示的约束
约束是概念模型中非常重要的类别。它们通常是隐式的，将它们显示的表现出来可以极大提高设计质量。下面是一些警告信号，表明约束的存在正在扰乱它的宿主对象的设计:
1. 计算约束所需的数据从定义上看并不属于这个对象
2. 相关规则在多个对象中出现，造成了代码重复活导致不属于同一族的对象之间产产生了继承关系
3. 很多设计和需求都是围绕这些约束进行的，而在代码实现中，它们却隐藏在过程代码中

如果约束的存在掩盖了对象的基本职责，或者如果约束在领域中非常突出单在模型中去不明显，那么久可以将其提取到一个显示的对象中，甚至可以把它建模为一个对象和关系的集合。

### 1.2 作为领域对象的过程
首先领域对象的作用是用来封装过程的，我们只要考虑对象的设计目的和意图就可以了。但是如果过程的执行有多种方式，或者执行过程异常复杂。那么我么可以用另一种方法来处理它，那就是将算法本身或其中的关键部分放到一个单独的对象中。这样选择不同的过程就编程了选择不同的对象，每个对象都表示一种不同的 Strategy 。

### 1.3  Specification 规格
约束和过程是模型概念中两个应用范围很广的概念。领域驱动设计在这两个的基础上提出了一个更专门但也非常常用的概念-规格(Specification)。规格提供了用于表达特定类型的规则的精确方式。它把这些规则从条件逻辑中提取出来，并在模型中把它们显示的表达出来。

业务规则通常不适合作为 ENTITY 或者 Value Object 的职责，而且规则的变化和组合也会掩盖领域对象的基本含义。但是将规则移出领域层的结果会更糟糕，因为这样一来，领域代码就不再表达模型了。

逻辑编程提供了一种概念，即"谓词"这种可分离可组合的规则对象，但是要把这种概念用对象完全实现是很麻烦的。同时，这种概念也非常笼统，在表达设计意图方面，它的针对性不如设计那么好。

幸运的是我们不需要完全实现逻辑编程即可从中受益。大部分规则都可以归类为集中特定的情况。我们可以借用谓词概念来创建 **可计算出布尔值** 的特殊对象。这个新对象可以用来计算另一个对象，看看谓词对那个对象的计算是否为真。换言之新对象就是一个规格。规格中声明的是限制另一个对象状态的约束，被约束对象可以存在也可以不存在。Specification 有多种用途，最基本的用途就是可以测试任何对象以检验它们是否满足指定的标准。

许多 Specification 都是具有简单目的的简岑测试，但是当规则很复杂时，对简单的规格进行组合，就像用逻辑运算符把多个谓词组合起来一样。

Specification 将规则保留在领域层。利用工厂，可以用来自其他资源的信息对规格进行配置。之所以使用 Factory 是为了避免在 Specification 作用的目标对象上访问不相关的资源。

### 1.4 Specification 的应用和实现
出于以下三个目的中的至少一个目的，我们可能需要使用 Specification:
1. 验证对象，检查它是否能满足某些需求或者是否已经为实现某个目标做好准备
2. 从集合中选择一个对象或子集
3. 指定在创建新对象时必须满足某种需求

这三种用法(验证、选择和根据要求来创建)从概念层面上来讲是相同的。如果没有  Specification 相同的规则可能分散在各处以不同的形式存在。

通常 Specification 会使用策略模式并结合谓词，进行组合，从而达到灵活表示规则的目的。书中有一个例子是这样:
1. 应收账款是否过期是一个规则，可以定义为一个 Specification
2. 但是如果要筛选所有的过期应用款，则需要编写 SQL 语句从数据中查询，如果此时把 SQL 语句放在 Repo 基础设施层内，则会导致规则被分散在多处。
3. 所以更好的做法是把 SQL 语句的生成规则放在  Specification 对象内，Repo 只接受完整的 SQL 语句进行查询。

但是这样又出现一个问题，表结构就从 Repo 基础设施层泄露到了领域模型层。书中又给出了另一个解决方案:
4. SQL 语句仍然放在 Repo 层，并暴露出筛选的参数
5. 在 Specification 中引用 Repo 对象，并将原来的方法委托给 Repo 对象，最终的目的是应该使用哪个查询由 Specification 控制。Specification 依旧包含了所有的规则。

#### 根据要求来创建(生成)
生成是给为创建的对象指定标准，从概念上将都是一组规则，但是生成的 Specification 实现大不相同。与查询不同，它不是用来过滤已经存在的对象；与验证不同，他不用来测试已有对象。我们要创建和重新配置满足 Specification 的全新对象和对象结合。

如果不使用 Specification 可以编写一个生成器，其中包含可创建所需对象的过程或指令集。这种代码隐式的定义了生成器的行为。反过来我们也可以根据 Specification 来定义生成器接口，这个接口就显示的约束了生成器产生的结果。这种方法有以下几个有点:
1. 生成器的实现与接口分离。Specification 声明了输出的需求，但没有定义如何得到输出结果
2. 接口把规则显示地表示出来，开发人员无需理解所有操作细节即可知晓生成器产生的结果。
3. 接口更加灵活，生成器的唯一职责就是实现 Specification 的需求
4. 这种接口更加便于测试，因为接口显示的定义了生成器的输入。

根据需求来创建可以从头创建全新对象，也可以是配置已有对象来满足Specification。

文中举了一个化学品需要分装到不同容器的一个示例:
1. 化学品有易挥发、易爆等属性，需要分装到不同单独器皿中
2. 实现上，化学品是一个个对象，有 require_feature 字段，器皿有 feature 字段
3. 使用一个 ContainerSpecification 对象，接受化学品和容器对象，并进行是否可以在容器中防止化学品的规则判断

## 2. 柔性设计
所谓柔性设计，我个人理解是我们有了领域模型之后，应该如何组织和设计我们的代码，有点偏向于设计模式的内容，以便我们能更容易的组合得到的领域模型来满足更多的应用场景。下面的设计模式可以帮助我们实现柔性设计:

![柔性设计的设计模式](/images/ddd/flexible_design.jpeg)

### 2.1 Intention-Revealing Interfaces
在领域驱动设计中，我们希望看到有意义的领域逻辑。如果代码只是在执行规则后得到结果，而没有把规则显示的表达出来，那么我们就不得一步步的去思考软件的执行步骤。

对象的强大功能就是它能够把所有这些细节封装起来，但是如果其他人想复用这些对象，就必须知道对象的一些信息，如果接口没有告诉开发人员这些信息，他就必须深入研究对象的内部机制，这样就失去了封装的大部分价值。我们需要避免"认知过载"。

当我们把概念显示的建模为类或方法时，为了真正从中获取价值，必须为这些程序元素赋予一个能够反映出他们的概念的名字。

类型名称、方法名称和参数名称组合在一起，共同形成了一个 Intention Revealing Interface(释意接口)。

因此在命名类和操作对象时要描述他们的效果和目的，而不要表露她们是通过何种方式达到目的的。所有复杂的机制都应该封装到抽象接口的后面，接口只表明意图，而不表明方式。

### 2.2 Side-Effect-Free Function
我们可以宽泛的把操作分成两个类别:
1. 命令: 修改系统的操作，我们把任何对未来操作产生影响的系统状态的改变称为副作用
2. 查询: 从系统中获取信息

如果一个操作把逻辑或计算与状态改变混合在一起，那么我们就应该把这个操作重构为两个独立的操作。在这之后可以进一步把复杂计算的职责转移到 Value Object 中。严格的把命令隔离到不反回领域信息的、非常简单的操作中可以帮助我们控制副作用。Value Object 和 Function 都是不可变的，因此可以安全的组合。

Value Object 所表达的含义跟 Go 里面通过消息传递来共享内存，而不是共享内存来传递消息是一样的。通过一定的冗余，来减少对象的共享和修改。

### 2.3 Assertion
使用断言把副作用明显表示出来。Intention Revealing Interface(释意接口) 可以从名称上给出操作的用途，但这常常是不够的。契约式设计(design by contract)向前推进了一步:
1. 通过给出类的方法的断言，使得开发人员知道肯定会发生的结果
2. 这种设计风格分成了，前置条件和后置条件
3. 后置条件描述了操作的副作用，也就是调用这个方法后必然会发生的结果
4. 前置条件像是合同条款，即为了满足后置条件必须满足的前置条件
5. 类的固定规则规定了在操作结束时对象的状态

### 2.4 Conceptual Contour(概念轮廓)
模型要与对外表达的概念一致

### 2.5 Standalone Class
精简类与类的依赖关系

### 2.6 Closure Of Operation(闭合操作)
在适当的情况下，在定义操作时让它的返回类型与其参数的类型相同。这样的操作就是在该类型的实例集合中的闭合操作。闭合操作提供了一个高层接口，同时也不会引入对其他概念的任何依赖性。这种模式更常用于 Value Object 的操作。

## 3. 声明式设计
声明式设计，软件实际上是由一些非常明确的属性描述来控制的。声明式设计的饿最大价值是用一个范围非常窄的框架来自动处理设计中某个特别单调且易出错的方面，例如持久化和对象关系隐射。最好的声明设计能够使开发人员不必去做那些单调乏味的工作，同时又完全不限制他们的设计自由。
