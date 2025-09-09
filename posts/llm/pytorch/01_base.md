---
weight: 1
title: "PyTorch 基础"
date: 2025-05-20T08:00:00+08:00
lastmod: 2025-05-20T08:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "PyTorch 基础"
featuredImage: 

tags: ["PyTorch"]
categories: ["LLM"]

lightgallery: true

toc:
  auto: false
---


## 1. PyTorch

![Pytorch 核心组件](/images/pytorch/core.png)

PyTorch 有三个核心组件:
1. 张量库: 扩展了 NumPy 基于数组的编程功能，增加了 GPU 加速特性，从而实现了 CPU 和 GPU 之间的无缝计算切换。
2. 自动微分引擎: 也称为 autograd，它能够自动计算张量操作的梯度，从而简化反向传播和模型优化。
3. 深度学习库: 它提供了模块化、灵活且高效的构建块（包括预训练模型、损失函数和优化器），能够帮助研究人员和开发人员轻松设计和训练各种深度学习模型。


### 1.1 张量

张量表示一个数学概念，可以通过其阶数（或秩）来表征的数学对象，其中阶数提供了维度的数量。比如标量是秩为 0 的张量，向量是秩为 1 的张量，矩阵是秩为 2 的张量。

从计算的角度来看，张量是一种数据容器，语法与 Numpy 的 API 类似:

```python

import torch
import numpy as np
# 1. 张量的创建
# create a 0D tensor (scalar) from a Python integer
tensor0d = torch.tensor(1)

# create a 1D tensor (vector) from a Python list
tensor1d = torch.tensor([1, 2, 3])

# create a 2D tensor from a nested Python list
tensor2d = torch.tensor([[1, 2], 
                         [3, 4]])


# create a 3D tensor from NumPy array
ary3d = np.array([[[1, 2], [3, 4]], 
                  [[5, 6], [7, 8]]])
tensor3d_2 = torch.tensor(ary3d)  # Copies NumPy array
tensor3d_3 = torch.from_numpy(ary3d)  # Shares memory with NumPy array

# 2. 张量的数据类型

tensor1d = torch.tensor([1, 2, 3])
print(tensor1d.dtype) # torch.int64

# 浮点数默认为 32 位，可以在精度和效率之间取得平衡，并且 GPU 对 32 位计算有优化
floatvec = torch.tensor([1.0, 2.0, 3.0])
print(floatvec.dtype) # torch.float32

# .to 修改张量类型
floatvec = tensor1d.to(torch.float32)
print(floatvec.dtype)
```

下面是 张量的常用方法列表:

| 功能类别        | 方法1                               | 方法2                                     | 区别说明                                                           |
| ----------- | --------------------------------- | --------------------------------------- | -------------------------------------------------------------- |
| **创建张量**    | `torch.tensor(data)`              | `torch.Tensor(data)`                    | 推荐使用 `torch.tensor`（类型更明确，行为更稳定），`torch.Tensor` 是类构造函数，有时会引起歧义 |
| **初始化**     | `torch.zeros(size)`               | `torch.ones(size)`                      | 分别生成全 0 或全 1 张量                                                |
|             | `torch.empty(size)`               | `torch.full(size, value)`               | `empty` 只分配内存（值未初始化），`full` 用指定值填充                             |
|             | `torch.arange(start, end, step)`  | `torch.linspace(start, end, steps)`     | `arange` 用步长，`linspace` 用等分点数                                  |
|             | `torch.eye(n)`                    | `torch.diag(input)`                     | `eye` 生成单位矩阵，`diag` 可从向量生成对角矩阵或取出矩阵对角                          |
| **形状操作**    | `x.view(shape)`                   | `x.reshape(shape)`                      | 功能类似，`view` 需要内存连续，`reshape` 更灵活，会自动处理非连续内存                    |
|             | `x.unsqueeze(dim)`                | `x.squeeze(dim)`                        | `unsqueeze` 增加维度，`squeeze` 删除大小为 1 的维度                         |
|             | `x.permute(dims)`                 | `x.transpose(dim0, dim1)`               | `permute` 可交换多个维度，`transpose` 只交换两个维度                          |
|             | `x.flatten(start_dim, end_dim)`   | `x.ravel()`                             | `flatten` 可指定展开的维度范围，`ravel` 展开所有维度                            |
| **索引切片**    | `x[index]`                        | `x[mask]`                               | 前者是普通索引，后者是布尔索引/掩码选择                                           |
|             | `torch.gather(input, dim, index)` | `torch.index_select(input, dim, index)` | `gather` 可按索引张量收集，`index_select` 只在某个维度上选择                     |
| **拼接/分割**   | `torch.cat(tensors, dim)`         | `torch.stack(tensors, dim)`             | `cat` 在已有维度拼接，`stack` 新增维度后拼接                                  |
|             | `torch.split(tensor, size, dim)`  | `torch.chunk(tensor, chunks, dim)`      | `split` 按大小分割，`chunk` 按块数分割                                    |
| **数学运算**    | `x + y`                           | `torch.add(x, y)`                       | 前者是运算符，底层调用 `add`                                              |
|             | `x * y`                           | `torch.mul(x, y)`                       | 同理，运算符和函数等价                                                    |
|             | `torch.mm(x, y)`                  | `torch.matmul(x, y)`                    | `mm` 只支持二维矩阵，`matmul` 支持更高维度的批量矩阵乘法                            |
|             | `torch.bmm(x, y)`                 | `torch.matmul(x, y)`                    | `bmm` 是批量二维矩阵乘法，等价于 `matmul` 的特殊情况                             |
| **归约运算**    | `x.sum(dim)`                      | `x.mean(dim)`                           | 分别计算和与平均值                                                      |
|             | `x.max(dim)`                      | `x.argmax(dim)`                         | `max` 返回最大值和索引，`argmax` 只返回索引                                  |
|             | `x.min(dim)`                      | `x.argmin(dim)`                         | 同理，最小值与索引                                                      |
|             | `torch.norm(x, p)`                | `torch.linalg.norm(x, ord)`             | `torch.norm` 是旧接口，`linalg.norm` 更推荐，支持更多矩阵范数                   |
| **复制与共享内存** | `x.clone()`                       | `x.detach()`                            | `clone` 深拷贝（仍保留梯度关系），`detach` 共享数据但切断梯度                        |
|             | `x.data`                          | `x.detach()`                            | `x.data` 旧用法，不安全；推荐用 `detach`                                  |
| **设备与类型**   | `x.to(device)`                    | `x.cuda()`                              | `to(device)` 更通用，支持 `cpu/cuda/mps/dtype` 等，`cuda` 仅限 GPU       |
|             | `x.type(dtype)`                   | `x.to(dtype)`                           | 推荐 `to(dtype)`，更灵活、安全                                          |
| **随机数**     | `torch.rand(size)`                | `torch.randn(size)`                     | `rand` 生成 \[0,1) 均匀分布，`randn` 生成标准正态分布                         |
|             | `torch.randint(low, high, size)`  | `torch.bernoulli(p)`                    | `randint` 整数均匀分布，`bernoulli` 二项分布（0/1）                         |
| **梯度**      | `x.requires_grad_(True)`          | `x.detach().requires_grad_()`           | 前者直接开启梯度，后者先切断计算图再重新建图                                         |
|             | `x.backward()`                    | `torch.autograd.grad(outputs, inputs)`  | `backward` 自动从标量回传梯度，`grad` 可灵活指定张量间梯度关系                       |


### 1.2 自动微分
#### 计算图
PyTorch 的 autograd 系统能够在动态计算图中自动计算梯度。计算图是一种有向图，主要用于表达和可视化数学表达式。在深度学习的背景下，计算图列出了计算神经网络输出所需的计算顺序——我们需要用它来计算反向传播所需的梯度，这是神经网络的主要训练算法。

```python
import torch.nn.functional as F

y = torch.tensor([1.0])  # true label 真实标签
x1 = torch.tensor([1.1]) # input feature 输入特征
w1 = torch.tensor([2.2]) # weight parameter 权重参数
b = torch.tensor([0.0])  # bias unit 偏置单元

z = x1 * w1 + b          # net input 网络输入
a = torch.sigmoid(z)     # activation & output 激活和输出

# 损失是通过比较模型输出  a  与给定标签  y  来计算的
loss = F.binary_cross_entropy(a, y)
print(loss)
```

上面的示例实现了一个逻辑回归分类器，其对应的计算图如下，PyTorch 在后台构建了这样一个计算图，我们可以利用它来计算损失函数相对于模型参数（这里是 w1 和 b）的梯度，从而训练模型。

![前向传播的计算图](/images/pytorch/cal_graph.png)


通过添加 requires_grad=True，Pytorch 会在内部构建计算图。

```python
import torch.nn.functional as F
from torch.autograd import grad

y = torch.tensor([1.0])
x1 = torch.tensor([1.1])
w1 = torch.tensor([2.2], requires_grad=True)
b = torch.tensor([0.0], requires_grad=True)

z = x1 * w1 + b 
a = torch.sigmoid(z)

loss = F.binary_cross_entropy(a, y)

```

#### 自动微分
在训练神经网络时，需要使用**反向传播算法**计算梯度。反向传播可以被视为**微积分中链式法**则在神经网络中的应用:

![反向传播](/images/pytorch/backward.png)


梯度是一个向量，包含了一个多变量函数（输入变量超过一个的函数）的所有偏导数。偏导数测量的是一个函数相对于其中一个变量变化的速率。梯度提供了更新每个参数以最小化损失函数所需的信息。

PyTorch 的 autograd 引擎在后台通过跟踪在张量上执行的每个操作来构建计算图。然后，通过调用 grad 函数，可以计算损失相对于模型参数 w1 的梯度。

```python
# 默认情况下，pytorch 在计算梯度后会销毁计算图已释放内存
# 如果想重复使用计算图，需要添加 retain_graph=True
grad_L_w1 = grad(loss, w1, retain_graph=True)
# grad 函数，这在实验、调试和概念演示中很有用
grad_L_b = grad(loss, b, retain_graph=True)

print(grad_L_w1)
print(grad_L_b)
```

我们可以对损失函数调用 .backward 方法，随后 PyTorch 将计算计算图中所有叶节点的梯度，这些梯度将通过张量的 .grad 属性进行存储：

```python
loss.backward()
print(w1.grad)
print(b.grad)
```

### 1.3 多层神经网络

Pytorch 通过子类化 torch.nn.Module 类来定义神经网络模型:
1. `__init__`: 定义网络层
2. `forward` 方法: 指定层与层之间的交互，描述了输入数据如何通过网络传递，并形成计算图
3. `backward`: 继承子 Module，用于计算给定模型参数的损失函数的梯度

```python
class NeuralNetwork(torch.nn.Module):
    def __init__(self, num_inputs, num_outputs):
        super().__init__()
        # Sequential 表示按特定顺序执行的层
        self.layers = torch.nn.Sequential(
                
            # 1st hidden layer
            torch.nn.Linear(num_inputs, 30),
            torch.nn.ReLU(), # 激活层位于隐藏层之间

            # 2nd hidden layer
            torch.nn.Linear(30, 20),
            torch.nn.ReLU(),

            # output layer
            torch.nn.Linear(20, num_outputs),
        )

    def forward(self, x):
        logits = self.layers(x)
        return logits

model = NeuralNetwork(50, 3)
# 统计模型参数量
# 每一个 requires_grad=True 的参数都会被视为可训练参数，并在训练期间进行更新
num_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
print("Total number of trainable model parameters:", num_params)

# 训练参数包含在 torch.nn.Linear 层中。
# Linear 层会将输入与权重矩阵相乘，并加上一个偏置向量。
# 这有时被称为前馈层或全连接层。
# requires_gra 被设置为 True 是 torch.nn.Linear 中权重和偏置的默认设置
print(model.layers[0].weight)
print(model.layers[0].bias)
```

在深度学习中，会使用小的随机数初始化模型权重，目的是为了在训练过程中打破对称性。否则，各节点将执行相同的操作并在反向传播过程中进行相同的更新，导致网络无法学习从输入到输出的复杂映射关系。

```python
# 1. 前向传播
torch.manual_seed(123)
X = torch.rand((1, 50))
# 调用 model(x) 时，会自动执行模型的前向传播
# 前向传播是指从输入张量开始到计算获得输出张量的过程。
out = model(X)
print(out)
# grad_fn=<AddmmBackward0> 表示计算图中用于计算某个变量的最后一个函数
# PyTorch 会在反向传播期间使用这些信息来计算梯度
tensor([[-0.1262,  0.1080, -0.1792]], grad_fn=<AddmmBackward0>)

# 只推理，不训练，告诉 PyTorch 无须跟踪梯度
with torch.no_grad():
    out = model(X)
print(out)
tensor([[-0.1262,  0.1080, -0.1792]])

# 预测类别成员概率
with torch.no_grad():
    # 通常的做法是让模型返回最后一层的输出（logits）
    # 因为 PyTorch 常用的损失函数会将 softmax（或二分类时的 sigmoid）操作与负对数似然损失结合在一个类中。这样做是为了提高数值计算的效率和稳定性。
    # 需要显式调用 softmax 函数
    out = torch.softmax(model(X), dim=1)
print(out)
tensor([[0.3113, 0.3934, 0.2952]]))
```


## 2. 数据加载器
 Pytorch 中关于数据加载器的抽象 Dataset 和 DataLoader 是比较好理解的，比较难理解的是 DataLoader 的一些参数。

1. drop_last: 如果一个训练轮次的最后一个批次显著小于其他批次，那么可能会影响训练过程中的收敛。为此，可以设置 drop_last=True，这将在每轮中丢弃最后一个批次
2. num_workers: 
    - 为 0 时，数据加载将在主进程而不是单独的工作进程中进行
    - 大于 0 的数值时，会启动多个工作进程并行加载数据，从而释放主进程专注于训练模型
    - 数据量较小，或者在 Jupyter Notebook 中需要设置为 0

![num_workers](/images/pytorch/num_worker.png)

## 3. 训练循环

```python
import torch.nn.functional as F


torch.manual_seed(123)
model = NeuralNetwork(num_inputs=2, num_outputs=2)
# model.parameters() 优化器需要知道哪些参数需要优化
# 学习率（lr）为 0.5 的随机梯度下降（SGD）优化器
optimizer = torch.optim.SGD(model.parameters(), lr=0.5)

num_epochs = 3

for epoch in range(num_epochs):
    # 将模型置于训练模式
    model.train()
    for batch_idx, (features, labels) in enumerate(train_loader):

        logits = model(features)
        # logits 传递给 cross_entropy 损失函数
        # 后者会在内部应用 softmax 函数，以提高效率并增强数值稳定性
        loss = F.cross_entropy(logits, labels) # Loss function
        # 将上一轮梯度置为 0，以防止意外的梯度累计
        optimizer.zero_grad()
        # 计算损失函数梯度
        loss.backward()
        # 优化器使用梯度更新模型参数以最小化损失
        optimizer.step()
    
        ### LOGGING
        print(f"Epoch: {epoch+1:03d}/{num_epochs:03d}"
              f" | Batch {batch_idx:03d}/{len(train_loader):03d}"
              f" | Train/Val Loss: {loss:.2f}")
    # 切换到评估模式
    model.eval()
    # 插入可选的模型评估代码
    # Optional model evaluation

# 2. 预测
with torch.no_grad():
    outputs = model(X_train)
probas = torch.softmax(outputs, dim=1)
print(probas)

# 一个计算预测准确率的函数
def compute_accuracy(model, dataloader):

    model = model.eval()
    correct = 0.0
    total_examples = 0
    
    for idx, (features, labels) in enumerate(dataloader):
        
        with torch.no_grad():
            logits = model(features)
        
        predictions = torch.argmax(logits, dim=1)
        compare = labels == predictions
        correct += torch.sum(compare)
        total_examples += len(compare)
    # .item 会将张量的值以 Python 浮点数返回
    return (correct / total_examples).item()
```

## 4. 保存和加载模型

```python
torch.save(model.state_dict(), "model.pth")
model = NeuralNetwork(2, 2) # needs to match the original model exactly
model.load_state_dict(torch.load("model.pth", weights_only=True))
```

## 5. 使用 GPU
在 PyTorch 中，设备是执行计算和存储数据的地方。CPU 和 GPU 都是设备。

```python
tensor_1 = torch.tensor([1., 2., 3.])
tensor_2 = torch.tensor([4., 5., 6.])

# 将这些张量转移到 GPU 上并在那里执行加法操作
# 可以指定具体的 GPU to("cuda:0")、.to("cuda:1")
tensor_1 = tensor_1.to("cuda")
tensor_2 = tensor_2.to("cuda")

print(tensor_1 + tensor_2)
```

### 5.1 单个 GPU 训练

```python
import torch.nn.functional as F


torch.manual_seed(123)
model = NeuralNetwork(num_inputs=2, num_outputs=2)

# 定义默认使用的 GPU 设备
device = torch.device("cuda" if torch.cuda.is_available() else "cpu") # NEW
# 将模型移动到 GPU 上
model.to(device) # NEW


optimizer = torch.optim.SGD(model.parameters(), lr=0.5)

num_epochs = 3

for epoch in range(num_epochs):

    model.train()
    for batch_idx, (features, labels) in enumerate(train_loader):
        # 将输入数据移动到 GPU 上
        features, labels = features.to(device), labels.to(device) # NEW
        logits = model(features)
        loss = F.cross_entropy(logits, labels) # Loss function

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        ### LOGGING
        print(f"Epoch: {epoch+1:03d}/{num_epochs:03d}"
              f" | Batch {batch_idx:03d}/{len(train_loader):03d}"
              f" | Train/Val Loss: {loss:.2f}")

    model.eval()
    # Optional model evaluation
```

### 5.2 多个 GPU 训练
PyTorch 的分布式数据并行（DistributedDataParallel，DDP）策略
1. 首先，在每个 GPU 上创建模型的副本
2. 然后，将输入数据划分为独特的小批次，分别传递给每个模型副本
3. 梯度在训练过程中会被平均和同步，以便更新模型


![DDP 数据分发](/images/pytorch/ddp_1.png)

![DDP 同步梯度](/images/pytorch/ddp_2.png)