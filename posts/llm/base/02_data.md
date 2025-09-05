---
weight: 1
title: "文本嵌入"
date: 2025-08-20T08:00:00+08:00
lastmod: 2025-08-20T08:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "文本嵌入"
featuredImage: 

tags: ["LLM"]
categories: ["LLM"]

lightgallery: true

toc:
  auto: false
---

本章将学习如何为训练大语言模型准备数据。

## 1. 内容该要

这一节我们将学习一下内容:
1. 如何为训练大语言模型准备输入文本
  - 将文本分割为独立的单词词元和子词词元，然后将其编码为大语言模型所使用的向量表示。
  - 了解高级的分词技术，比如**字节对编码**（byte pair encoding，BPE）
  - 实现一种采样和数据加载策略，来生成训练大语言模型所需的输入-输出对。

## 2. 嵌入

嵌入:
1. 文本、音频、视频这些数据是离散的，无法执行神经网络训练所需的数学运算。
2. 将数据转换为向量格式的过程通常称为嵌入（embedding）。
3. 嵌入的本质是将离散对象（如单词、图像甚至整个文档）映射到连续向量空间中的点，其主要目的是将非数值的数据转换为神经网络可以处理的格式。
4. 嵌入通常是通过特定的神经网络层或利用另一个预训练的神经网络模型来实现的。不同的数据格式需要使用不同的嵌入模型

![嵌入](/images/llm/embedding.png)


词嵌入:
1. 词嵌入，word2vec 是早期流行的方法
2. 大语言模型通常会自行生成嵌入。这些嵌入是输入层的一部分，并且会在训练过程中进行更新。
3. 与使用 word2vec 相比，将嵌入作为大语言模型训练的一部分进行优化的优势在于，嵌入可以针对特定的任务和数据进行优化。


如下图所示，为大语言模型生成嵌入向量包括如下步骤:
1. 将文本分割为词元，并将词元转换为词元 ID
2. 词元 ID 转换为嵌入向量
3. 添加与之大小相同的位置嵌入
4. 输入文本由加载器生成

![嵌入](/images/llm/embedding_all.png)

### 2.1 文本分词

将输入文本分割为独立的词元，这些词元既可以是单词，也可以是诸如标点符号之类的特殊字符

![词元](/images/llm/tokenize.png)

#### 词汇表

将词元映射到词元 ID，首先需要构建一张词汇表。词汇表定义了如何将每个唯一的单词和特殊字符映射到一个唯一的整数。

为了将大语言模型的输出从数值形式转换回文本，还需要一种将词元 ID 转换为文本的方法。为此，可以创建逆向词汇表，将词元 ID 映射回它们对应的文本词元。

![词汇表](/images/llm/vocab.png)


#### 文本分词器实现

```python
class SimpleTokenizerV1:
    def __init__(self, vocab):
        # 1. 词汇表
        self.str_to_int = vocab
        self.int_to_str = {i:s for s,i in vocab.items()}
    
    def encode(self, text):
        # 2. 文本分词
        preprocessed = re.split(r'([,.:;?_!"()\']|--|\s)', text)
                                
        preprocessed = [
            item.strip() for item in preprocessed if item.strip()
        ]
        # 3. 词元转换为 词元 ID
        ids = [self.str_to_int[s] for s in preprocessed]
        return ids
        
    def decode(self, ids):
        # 4. 词元 ID 转换为 词元
        text = " ".join([self.int_to_str[i] for i in ids])
        # Replace spaces before the specified punctuations
        text = re.sub(r'\s+([,.?!"()\'])', r'\1', text)
        return text
```

#### 特殊词元

特殊词元用于增强模型对上下文和其他相关信息的理解，包括:
1. 标识未知词汇的词元
2. 标识文档边界的词元

![文本边界词元](/images/llm/endoftext.png)

如上图，在处理多个独立的文本源时，我们在这些文本之间插入 <|endoftext|> 词元。这些 <|endoftext|> 词元作为标记，可以指示出特定文本片段的开始或结束，从而有助于大语言模型更有效地处理和理解文本。

通常可能会有如下特殊词元:

| 名称        | 符号                  | 主要作用                      | GPT 是否默认使用            |
| --------- | ------------------- | ------------------------- | --------------------- |
| 序列开始      | **`[BOS]`**          | 标记文本起点，提示模型序列开始           | ❌ 不使用                 |
| 序列结束      | **`[EOS]`**          | 标记文本结束，适合拼接多个不相关文本        | ❌ 不使用                 |
| 填充        | **`[PAD]`**          | 使批量数据中文本长度对齐，短文本补齐        | ❌ 不使用                 |
| 文本结束 / 填充 | **`<\|endoftext\|>`** | GPT 唯一的特殊词元，既可标记结束，也可作为填充 | ✅ 使用                  |
| 未知词元      | **`<\|unk\|>`**       | 表示词表外单词（OOV）              | ❌ 不使用（GPT 用 BPE 拆词替代） |

#### BPE

BPE 算法的原理是将不在预定义词汇表中的单词分解为更小的子词元甚至单个字符，从而能够处理词汇表之外的单词。

![BPE 分解未知词元](/images/llm/bpe.png)

```python
import tiktoken

tokenizer = tiktoken.get_encoding("gpt2")
text = (
    "Hello, do you like tea? <|endoftext|> In the sunlit terraces"
     "of someunknownPlace."
)

# encode
integers = tokenizer.encode(text, allowed_special={"<|endoftext|>"})
print(integers)

# decode
strings = tokenizer.decode(integers)
print(strings)
```

### 2.2 数据加载器

分词器将文本转换为词元 ID 序列，接下来的步骤是生成用于训练模型的输入-目标对。
1. 给定一个文本样本，我们从中提取子样本，作为输入块提供给大语言模型。
2. 我们使用滑动窗口（sliding window）方法从训练数据集中提取输入-目标对。
2. 在训练过程中，模型的任务是预测输入块之后的下一个词，我们会屏蔽目标词之后的所有单词。

![输入-目标对](/images/llm/token_sample.png)

我们需要实现一个数据加载器（data loader）。遍历输入数据集，并返回输入和目标对应的 Pytorch 张量。
1. 输入: 包含大语言模型所见的文本输入的输入张量
2. 目标: 包含大语言模型需要预测的目标词元的目标张量

如图所示:
1. x 中每行代表一个输入上下文
2. y 包含相应的预测目标（下一个词），它们是通过将输入移动一个位置创建的
![输入-目标 对应的张量](/images/llm/input_output.png)

使用 Pytorch DataSet、DataLoader 实现的数据加载器如下:

```python
import torch
from torch.utils.data import Dataset, DataLoader


class GPTDatasetV1(Dataset):
    def __init__(self, txt, tokenizer, max_length, stride):
        self.input_ids = []
        self.target_ids = []

        # Tokenize the entire text
        # 1. 文本分词
        token_ids = tokenizer.encode(txt, allowed_special={"<|endoftext|>"})
        assert len(token_ids) > max_length, "Number of tokenized inputs must at least be equal to max_length+1"

        # Use a sliding window to chunk the book into overlapping sequences of max_length
        # 2. 使用滑动窗口，将文本划分为 max_length 的序列
        # stride 滑动窗口的移动步长
        for i in range(0, len(token_ids) - max_length, stride):
            input_chunk = token_ids[i:i + max_length]
            target_chunk = token_ids[i + 1: i + max_length + 1]
            self.input_ids.append(torch.tensor(input_chunk))
            self.target_ids.append(torch.tensor(target_chunk))

    def __len__(self):
        return len(self.input_ids)

    def __getitem__(self, idx):
        return self.input_ids[idx], self.target_ids[idx]

  
def create_dataloader_v1(txt, batch_size=4, max_length=256, 
                         stride=128, shuffle=True, drop_last=True,
                         num_workers=0):

    # Initialize the tokenizer
    # 初始化分词器
    tokenizer = tiktoken.get_encoding("gpt2")

    # Create dataset
    # 创建数据集
    dataset = GPTDatasetV1(txt, tokenizer, max_length, stride)

    # Create dataloader
    # 3. 创建 dataloader
    dataloader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        # drop_last 为 True 时，若最后一个 batch 长度小于 batch_size，则最后一个批次
        # 防止在训练期间损失剧增
        drop_last=drop_last,
        num_workers=num_workers
    )

    return dataloader
```


### 2.3 词元嵌入
为大语言模型训练准备输入文本的最后一步是将词元 ID 转换为嵌入向量，如下图所示:

![词元嵌入](/images/llm/embedding_token.png)


在初始阶段，必须用随机值初始化这些嵌入权重，方法如下:

```python
import torch

vocab_size = 6 # 词汇表长度
output_dim = 3 # 嵌入向量维度

torch.manual_seed(123)
embedding_layer = torch.nn.Embedding(vocab_size, output_dim)

# 嵌入层的权重矩阵由小的随机值构成
# 
print(embedding_layer.weight)
Parameter containing:
# 权重矩阵具有 6 行 3 列的结构，其中每一行对应词汇表中的一个词元，每一列则对应一个嵌入维度。
tensor([[ 0.3374, -0.1778, -0.1690],
        [ 0.9178,  1.5810,  1.3010],
        [ 1.2753, -0.2010, -0.1606],
        [-0.4015,  0.9666, -1.1481],
        [-1.1589,  0.3255, -0.6315],
        [-2.8400, -0.7849, -1.4096]], requires_grad=True)

```

嵌入权重:
1. 嵌入层的权重矩阵由小的随机值构成
2. 作为模型优化工作的一部分，这些值将在大语言模型训练过程中被优化。
3. 权重矩阵中的每一行代表词汇表中的一个词元

有了嵌入权重，我们就可以将输入文本中的词元 ID 转换为嵌入向量。

```python
# input_ids 就是加载器返回的输入、输出
input_ids = torch.tensor([2, 3, 5, 1])
print(embedding_layer(input_ids))
```

![嵌入层查找](/images/llm/embedding_search.png)


### 2.4 位置编码
为什么需要位置编码？
1. 首先嵌入层的工作机制是，无论词元 ID 在输入序列中的位置如何，相同的词元 ID 始终被映射到相同的向量表示，不受其在输入序列中的位置的影响。
2. 原则上，带有确定性且与位置无关的词元 ID 嵌入能够提升其可再现性。然而，由于大语言模型的自注意力机制本质上与位置无关，因此向模型中注入额外的位置信息是有帮助的。


####  自注意力机制是“与位置无关”

* 自注意力 (self-attention) 的核心是通过 **query-key 相似度** 计算序列中任意两个词元的相关性。
* 在数学上，注意力只是计算一堆向量的加权平均，本身不关心“顺序”或“位置”。

  > 举个例子：如果你把输入序列 `[猫, 吃, 鱼]` 打乱成 `[鱼, 猫, 吃]`，在没有位置编码的情况下，模型看到的只是三个 embedding 向量，它完全分不清哪个在前哪个在后。
* 所以 **纯 attention 是 permutation-invariant（对输入顺序不敏感）**。

---

#### 为什么要注入位置信息

语言显然是有顺序结构的：

* “猫吃鱼”和“鱼吃猫”语义差异很大。
* 语法规则（主语 → 谓语 → 宾语）依赖顺序。
* 文本中的上下文理解需要知道“谁修饰谁”，而这通常由位置关系决定。

如果模型只有词元 ID 的 embedding（确定且位置无关），那模型只能学到词之间的语义相似性，却无法区分它们在句子中的排列方式。

因此，**我们需要给模型额外的“位置信息”**，最常见的方式有：

* **绝对位置编码（absolute positional encoding）**：给第 1、2、3、… 个词加上一个位置向量（最早的 Transformer 用正弦函数编码）。
* **相对位置编码（relative positional encoding）**：建模“词 A 和词 B 的距离”而不是绝对位置。
* **旋转位置编码（RoPE）**：通过复数旋转，把向量映射到能表示相对位置信息的空间。

这些方法的本质目的就是：
👉 提升大语言模型对词元顺序及其相互关系的理解能力，从而实现更准确、更具上下文感知力的预测。


#### 绝对位置嵌入
绝对位置嵌入（absolute positional embedding）
1. 直接与序列中的特定位置相关联。对于输入序列的每个位置
2. 该方法都会向对应词元的嵌入向量中添加一个独特的位置嵌入，以明确指示其在序列中的确切位置。
3. 例如，序列中的第一个词元会有一个特定的位置嵌入，第二个词元则会有另一个不同的位置嵌入，以此类推，如图所示。

![绝对位置嵌入](/images/llm/embedding_pos.png)

OpenAI 的 GPT 模型使用的是绝对位置嵌入，这些嵌入会在训练过程中被优化。

#### 相对位置嵌入
相对位置嵌入（relative positional embedding）
1. 关注的是词元之间的相对位置或距离，而非它们的绝对位置。
2. 这意味着模型学习的是词元之间的“距离”关系，而不是它们在序列中的“具体位置”。
3. 这种方法使得模型能够更好地适应不同长度（包括在训练过程中从未见过的长度）的序列。


#### 初始化位置嵌入

```python
# 1. 词元嵌入向量
max_length = 4
dataloader = create_dataloader_v1(
    raw_text, batch_size=8, max_length=max_length,
    stride=max_length, shuffle=False
)
data_iter = iter(dataloader)
inputs, targets = next(data_iter)
token_embeddings = token_embedding_layer(inputs)

# 2. 位置嵌入向量
context_length = max_length
# 位置嵌入的维度要与词元嵌入的维度相同
pos_embedding_layer = torch.nn.Embedding(context_length, output_dim)
pos_embeddings = pos_embedding_layer(torch.arange(context_length))
print(pos_embeddings.shape)

# 3. 输入嵌入向量
input_embeddings = token_embeddings + pos_embeddings
```

input_embeddings 是可以被大语言模型核心模块处理的嵌入输入。
