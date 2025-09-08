---
weight: 1
title: "自注意力机制"
date: 2025-08-20T08:00:00+08:00
lastmod: 2025-08-20T08:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "自注意力机制"
featuredImage: 

tags: ["LLM"]
categories: ["LLM"]

lightgallery: true

toc:
  auto: false
---

本节讨论如何实现注意力机制，这是大语言模型架构中的关键部分。最终目的是实现一种紧凑、高效的多头注意力机制。

我们将从一个简化版本的自注意力机制开始，然后逐步加入可训练的权重。因果注意力机制在自注意力的基础上增加了额外掩码，使得大语言模型可以一次生成一个单词。最后，多头注意力将注意力机制划分成多个头，从而使模型能够并行捕获输入数据的各种特征。

![自注意力机制的四种变体](/images/llm/self_attention.png)

## 1. 什么是自注意力机制

让我们首先实现一个不包含任何可训练权重的简化的自注意力机制变体，目标是在引入可训练权重之前，阐明自注意力中的一些关键概念。

在自注意力机制中，我们的目标是为输入序列中的每个元素  计算上下文向量 。**上下文向量**（context vector）可以被理解为一种包含了序列中所有元素信息的嵌入向量。

上下文向量的计算包括如下部分:
1. 注意力分数: 通过计算点击获取
2. 注意力分数缩放 + Softmax 归一化
3. 加权求和获得上下文向量

![注意力权重](/images/llm/context_var.png)
----
![加权求和](/images/llm/context_sum.png)


计算所有输入词元的注意力权重如下:

```python
# 1. 计算注意力分数
# inputs = 6 * 1，一行文本，6个词元
# attn_scores = 6 * 1 @ 1 * 6 = 6 * 6，每一行标识
attn_scores = inputs @ inputs.T

# 2. 对每一行进行归一化
# dim 设置为 -1 表示让 softmax 函数在 attn_scores 张量的最后一个维度上进行归一化
attn_weights = torch.softmax(attn_scores, dim=-1)

# 3. 计算上下文向量
# all_context_vecs = 6 * 6 @ 6 * 1 = 6 * 1
all_context_vecs = attn_weights @ inputs
```
注意力机制可以将输入元素转换为增强的上下文向量表示，这些表示涵盖了关于所有输入的信息。上下文向量就是某个特定输入元素对于序列中所有输入向量的加权和。

## 2. 带可训练权重的自注意力机制

### 2.1 可训练权重

带可训练权重的自注意力机制的核心是 **用 3 个权重矩阵 Wq、Wk 和 Wv 来变换输入矩阵 中的输入向量**。

通过 3 个可训练的权重矩阵，将输入词元，分别映射为查询向量（q）、键向量（k）和值向量（v），如下图所示:

![可训练权重](/images/llm/weight.png)


```python

x_2 = inputs[1] # 输入词元
d_in = inputs.shape[1] # 嵌入维度 d=3
d_out = 2 # 输出维度 d=2

# 1. 初始化权重矩阵
torch.manual_seed(123)
# requires_grad=False 以减少输出中的其他项，但如果要在模型训练中使用这些权重矩阵，就需要设置 requires_grad=Tru
W_query = torch.nn.Parameter(torch.rand(d_in, d_out), requires_grad=False)
W_key   = torch.nn.Parameter(torch.rand(d_in, d_out), requires_grad=False)
W_value = torch.nn.Parameter(torch.rand(d_in, d_out), requires_grad=False)

# 2. 计算查询向量、键向量、值向量
query = x_2 @ W_query
keys = inputs @ W_key
values = inputs @ W_value
print("keys.shape:", keys.shape)
print("values.shape:", values.shape)
```

### 2.2 计算注意力分数

接下来我们要基于查询向量和键向量计算注意力分数。以第二个输入词元为例，计算过程如下:
1. 取第二个输入词元的查询向量 q2
2. 每一个输入词元，计算 q2 与其键向量的点积， q2 @ Ki.T

![注意力分数](/images/llm/weight_dot.png)

```python
# 3. 计算第二个输入词元的注意力分数
attn_scores_2 = query_2 @ keys.T # All attention scores for given query
print(attn_scores_2)
```

### 2.3 计算注意力权重

![注意力权重](/images/llm/weight_softmax.png)

通过缩放注意力分数并应用 softmax 函数来计算注意力权重。缩放方式是将注意力分数除以键向量的嵌入维度的平方根。对嵌入维度进行归一化是为了避免梯度过小，从而提升训练性能。嵌入维度通常很大，这可能导致点积非常大，从而在反向传播时由于 softmax 函数的作用导致梯度非常小。当点积增大时，softmax 函数会表现得更像阶跃函数，导致梯度接近零。这些小梯度可能会显著减慢学习速度或使训练停滞。

通过嵌入维度的平方根进行缩放计算注意力的方式，又被称为缩放点积注意力（scaled dot-product attention）。


```python
d_k = keys.shape[-1]
# 除以键向量的嵌入维度的平方根来进行缩放
attn_weights_2 = torch.softmax(attn_scores_2 / d_k**0.5, dim=-1)
print(attn_weights_2)
```

### 2.4 计算上下文向量
通过对值向量进行加权求和来计算上下文向量。注意力权重作为加权因子，用于权衡每个值向量的重要性。

![上下文向量](/images/llm/weight_context.png)

```python
context_vec_2 = attn_weights_2 @ values
print(context_vec_2)
```

### 2.5 总结
为什么要用查询、键和值:
1. 查询、键和值借用自信息检索和数据库领域，这些领域使用类似的概念来进行信息存储、搜索和检索。
2. 查询（Query）：类似于数据库中的搜索查询。它代表了模型当前关注或试图理解的项（比如句子中的一个单词或词元）。查询用于探测输入序列中的其他部分，以确定对它们的关注程度。
3. 键（Key）：类似于用于数据库索引和搜索的键。在注意力机制中，输入序列中的每个项（比如句子中的每个单词）都有一个对应的键。这些键用于与查询进行匹配。
4. 值（Value）：类似于数据库中键-值对中的值。它表示输入项的实际内容或表示。一旦模型确定哪些键以及哪些输入部分与查询（当前关注的项）最相关，它就会检索相应的值。

至此我们可以实现一个简化的自注意 Python 类。

![自注意力机制 V1](/images/llm/attention_v1.png)

```python
import torch.nn as nn

class SelfAttention_v2(nn.Module):

    def __init__(self, d_in, d_out, qkv_bias=False):
        super().__init__()
        # nn.Linear 的一个重要优势是它提供了优化的权重初始化方案，从而有助于模型训练的稳定性和有效性
        self.W_query = nn.Linear(d_in, d_out, bias=qkv_bias)
        self.W_key   = nn.Linear(d_in, d_out, bias=qkv_bias)
        self.W_value = nn.Linear(d_in, d_out, bias=qkv_bias)

    def forward(self, x):
        keys = self.W_key(x)
        queries = self.W_query(x)
        values = self.W_value(x)
        
        attn_scores = queries @ keys.T
        attn_weights = torch.softmax(attn_scores / keys.shape[-1]**0.5, dim=-1)

        context_vec = attn_weights @ values
        return context_vec

torch.manual_seed(123)
sa_v1 = SelfAttention_v1(d_in, d_out)
print(sa_v1(inputs))
```

## 3. 因果注意力
什么事因果注意力:
1. 因果机制的作用是调整注意力机制，防止模型访问序列中未来的信息，这在语言建模等任务中尤为重要，因为每个词的预测只能依赖之前出现的词。
2. 因果注意力（也称为掩码注意力）是一种特殊的自注意力形式。它限制模型在处理任何给定词元时，只能基于序列中的先前和当前输入来计算注意力分数，而标准的自注意力机制可以一次性访问整个输入序列。

### 3.1 因果注意力实现
如图所示，我们会掩码对角线以上的注意力权重，并归一化未掩码的注意力权重。

![因果注意力](/images/llm/attention_causal.png)

实现因果注意力的方式有两种，第二种更为高效:

```python
# A. 方法一
# 1. 带权重的注意力机制
queries = sa_v2.W_query(inputs)
keys = sa_v2.W_key(inputs) 
attn_scores = queries @ keys.T

attn_weights = torch.softmax(attn_scores / keys.shape[-1]**0.5, dim=-1)
print(attn_weights)

# 2. 对注意力权重进行对角线掩码
context_length = attn_scores.shape[0]
mask_simple = torch.tril(torch.ones(context_length, context_length))
print(mask_simple)
masked_simple = attn_weights*mask_simple
print(masked_simple)

# 3. 重新归一化
row_sums = masked_simple.sum(dim=-1, keepdim=True)
masked_simple_norm = masked_simple / row_sums
print(masked_simple_norm)

# B. 方法二
mask = torch.triu(torch.ones(context_length, context_length), diagonal=1)
# 对角线以上注意力被替换为无穷大
masked = attn_scores.masked_fill(mask.bool(), -torch.inf)
print(masked)
# 无穷大值（）时，softmax 函数会将这些值视为零概率。
attn_weights = torch.softmax(masked / keys.shape[-1]**0.5, dim=1)
print(attn_weights)
```

### 3.1 dropout 掩码额外的注意力权重
dropout 是深度学习中的一种技术，通过在训练过程中随机忽略一些隐藏层单元来有效地“丢弃”它们。这种方法有助于减少模型对特定隐藏层单元的依赖，从而避免过拟合。需要强调的是，dropout 仅在训练期间使用，训练结束后会被取消。

在 Transformer 架构中，一些包括 GPT 在内的模型通常会在两个特定时间点使用注意力机制中的 dropout：一是计算注意力权重之后，二是将这些权重应用于值向量之后。我们将在计算注意力权重之后应用 dropout 掩码，因为这是实践中更常见的做法。

![dropout](/images/llm/dropout.png)

```python
torch.manual_seed(123)
dropout = torch.nn.Dropout(0.5) # dropout rate of 50%
example = torch.ones(6, 6) # create a matrix of ones

print(dropout(example))
# 矩阵中剩余元素的值会按 1/0.5 = 2 的比例进行放大
tensor([[2., 2., 0., 2., 2., 0.],
        [0., 0., 0., 2., 0., 2.],
        [2., 2., 2., 2., 0., 2.],
        [0., 2., 2., 0., 0., 2.],
        [0., 2., 0., 2., 0., 2.],
        [0., 2., 2., 2., 2., 0.]])
```

### 3.3 因果注意力类

```python
# 唯一的不同是增加了 dropout 和因果掩码组件。
class CausalAttention(nn.Module):

    def __init__(self, d_in, d_out, context_length,
                 dropout, qkv_bias=False):
        super().__init__()
        self.d_out = d_out
        self.W_query = nn.Linear(d_in, d_out, bias=qkv_bias)
        self.W_key   = nn.Linear(d_in, d_out, bias=qkv_bias)
        self.W_value = nn.Linear(d_in, d_out, bias=qkv_bias)
        self.dropout = nn.Dropout(dropout) # New
        # 缓冲区会与模型一起自动移动到适当的设备（CPU 或 GPU）
        self.register_buffer('mask', torch.triu(torch.ones(context_length, context_length), diagonal=1)) # New

    def forward(self, x):
        b, num_tokens, d_in = x.shape # New batch dimension b
        # For inputs where `num_tokens` exceeds `context_length`, this will result in errors
        # in the mask creation further below.
        # In practice, this is not a problem since the LLM (chapters 4-7) ensures that inputs  
        # do not exceed `context_length` before reaching this forward method. 
        # 在 PyTorch 中，输入张量的最后一维会被当作「特征维度」自动和权重做矩阵乘法。
        keys = self.W_key(x)
        queries = self.W_query(x)
        values = self.W_value(x)

        attn_scores = queries @ keys.transpose(1, 2) # Changed transpose
        # PyTorch 会自动广播 (broadcasting)
        attn_scores.masked_fill_(  # New, _ ops are in-place
            self.mask.bool()[:num_tokens, :num_tokens], -torch.inf)  # `:num_tokens` to account for cases where the number of tokens in the batch is smaller than the supported context_size
        attn_weights = torch.softmax(
            attn_scores / keys.shape[-1]**0.5, dim=-1
        )
        # torch.nn.Dropout(p) 的作用是：生成一个与输入 形状完全一致 的伯努利分布掩码（0/1）。
        attn_weights = self.dropout(attn_weights) # New

        context_vec = attn_weights @ values
        return context_vec

torch.manual_seed(123)

context_length = batch.shape[1]
ca = CausalAttention(d_in, d_out, context_length, 0.0)

context_vecs = ca(batch)

print(context_vecs)
print("context_vecs.shape:", context_vecs.shape)
```

## 4. 多头注意力
多头机制涉及将注意力机制分成多个“头”。每个头会学习数据的不同特征，使模型能够在不同的位置同时关注来自不同表示子空间的信息。这能够提升模型在复杂任务中的性能。

### 4.1 通过叠加实现多头注意力

通过堆叠多个 CausalAttention 模块来构建多头注意力模块。

![堆叠多个 CausalAttention](/images/llm/attention_dup.png)

```python
class MultiHeadAttentionWrapper(nn.Module):

    def __init__(self, d_in, d_out, context_length, dropout, num_heads, qkv_bias=False):
        super().__init__()
        self.heads = nn.ModuleList(
            [CausalAttention(d_in, d_out, context_length, dropout, qkv_bias) 
             for _ in range(num_heads)]
        )

    def forward(self, x):
        return torch.cat([head(x) for head in self.heads], dim=-1)


torch.manual_seed(123)

context_length = batch.shape[1] # This is the number of tokens
d_in, d_out = 3, 2
mha = MultiHeadAttentionWrapper(
    d_in, d_out, context_length, 0.0, num_heads=2
)

context_vecs = mha(batch)

print(context_vecs)
print("context_vecs.shape:", context_vecs.shape)
```

### 4.1 通过权重划分实现多头注意力

相比于叠加实现，下面的 MultiHeadAttention 通过重新调整投影后的查询张量、键张量和值张量的形状，将输入分为多个头，然后在内部将这个层分割成单独的注意力头。

![权重划分实现多头注意力](/images/llm/attention_multi.png)


```python
class MultiHeadAttention(nn.Module):
    def __init__(self, d_in, d_out, context_length, dropout, num_heads, qkv_bias=False):
        super().__init__()
        assert (d_out % num_heads == 0), \
            "d_out must be divisible by num_heads"

        self.d_out = d_out
        self.num_heads = num_heads
        self.head_dim = d_out // num_heads # Reduce the projection dim to match desired output dim

        self.W_query = nn.Linear(d_in, d_out, bias=qkv_bias)
        self.W_key = nn.Linear(d_in, d_out, bias=qkv_bias)
        self.W_value = nn.Linear(d_in, d_out, bias=qkv_bias)
        self.out_proj = nn.Linear(d_out, d_out)  # Linear layer to combine head outputs
        self.dropout = nn.Dropout(dropout)
        self.register_buffer(
            "mask",
            torch.triu(torch.ones(context_length, context_length),
                       diagonal=1)
        )

    def forward(self, x):
        b, num_tokens, d_in = x.shape
        # As in `CausalAttention`, for inputs where `num_tokens` exceeds `context_length`, 
        # this will result in errors in the mask creation further below. 
        # In practice, this is not a problem since the LLM (chapters 4-7) ensures that inputs  
        # do not exceed `context_length` before reaching this forwar

        keys = self.W_key(x) # Shape: (b, num_tokens, d_out)
        queries = self.W_query(x)
        values = self.W_value(x)

        # We implicitly split the matrix by adding a `num_heads` dimension
        # Unroll last dim: (b, num_tokens, d_out) -> (b, num_tokens, num_heads, head_dim)
        # 1. (b, num_tokens, d_out) -> (b, num_tokens, num_heads, head_dim)
        keys = keys.view(b, num_tokens, self.num_heads, self.head_dim) 
        values = values.view(b, num_tokens, self.num_heads, self.head_dim)
        queries = queries.view(b, num_tokens, self.num_heads, self.head_dim)

        # 2. Transpose: (b, num_tokens, num_heads, head_dim) -> (b, num_heads, num_tokens, head_dim)
        keys = keys.transpose(1, 2)
        queries = queries.transpose(1, 2)
        values = values.transpose(1, 2)

        # Compute scaled dot-product attention (aka self-attention) with a causal mask
        # 3. (b, num_heads, num_tokens, head_dim) @ (b, num_heads, head_dim, num_tokens) -> (b, num_heads, num_tokens, num_tokens)
        attn_scores = queries @ keys.transpose(2, 3)  # Dot product for each head

        # Original mask truncated to the number of tokens and converted to boolean
        mask_bool = self.mask.bool()[:num_tokens, :num_tokens]

        # Use the mask to fill attention scores
        attn_scores.masked_fill_(mask_bool, -torch.inf)
        
        attn_weights = torch.softmax(attn_scores / keys.shape[-1]**0.5, dim=-1)
        attn_weights = self.dropout(attn_weights)

        # Shape: (b, num_tokens, num_heads, head_dim)
        # 4. (b, num_heads, num_tokens, num_tokens) @ (b, num_heads, num_tokens, head_dim) -> (b, num_heads, num_tokens, head_dim)
        # 5. (b, num_heads, num_tokens, head_dim) -> (b, num_tokens, num_heads, head_dim)
        context_vec = (attn_weights @ values).transpose(1, 2) 
        
        # Combine heads, where self.d_out = self.num_heads * self.head_dim
        context_vec = context_vec.contiguous().view(b, num_tokens, self.d_out)
        # 这个输出投影层并不是必需的但它在许多大语言模型架构中被广泛使用，这就是我们在这里添加它以保持完整性的原因。
        context_vec = self.out_proj(context_vec) # optional projection

        return context_vec

torch.manual_seed(123)

batch_size, context_length, d_in = batch.shape
d_out = 2
mha = MultiHeadAttention(d_in, d_out, context_length, 0.0, num_heads=2)

context_vecs = mha(batch)

print(context_vecs)
print("context_vecs.shape:", context_vecs.shape)

```