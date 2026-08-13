---
weight: 3
title: "大模型私有化部署（三）：Transformer、QKV 与 Attention"
date: 2026-08-12T20:40:00+08:00
lastmod: 2026-08-12T20:40:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "拆解 Transformer Block 的权重和计算过程，理解 Q、K、V、Attention 与 MLP。"
featuredImage:

tags: ["vllm", "大模型部署", "Transformer", "FDE"]
categories: ["AIGC"]

lightgallery: true
---

本节拆开一个 Transformer Block，建立“权重张量—前向计算—中间激活—内存占用”的对应关系。

<!-- more -->

## 1. Transformer Block 的总体结构

不同模型的实现细节不同，一个简化的 Pre-Norm Transformer Block 可以表示为：

```text
输入 x
  │
  ├─────────────── residual ───────────────┐
  ▼                                        │
Norm                                       │
  ▼                                        │
Self-Attention                             │
  ▼                                        │
Add ◄──────────────────────────────────────┘
  │
  ├─────────────── residual ───────────────┐
  ▼                                        │
Norm                                       │
  ▼                                        │
MLP / FFN                                  │
  ▼                                        │
Add ◄──────────────────────────────────────┘
  │
  ▼
输出
```

可写成：

```text
h = x + Attention(Norm(x))
y = h + MLP(Norm(h))
```

其中：

- Norm 稳定数值分布；
- Attention 让不同 token 交换信息；
- MLP 对每个 token 的特征进行变换；
- Residual 残差连接保留原输入，并帮助深层网络传递信息。

## 2. Q、K、V 从哪里来

假设输入激活为：

```text
X.shape = [B, N, D]
```

- `B`：batch size；
- `N`：序列长度；
- `D`：hidden size。

模型保存三个训练得到的投影矩阵：

```text
Wq：Query 投影权重
Wk：Key 投影权重
Wv：Value 投影权重
```

前向计算：

```text
Q = XWq
K = XWk
V = XWv
```

需要区分：

```text
Wq、Wk、Wv = 模型权重，通常常驻内存
Q、K、V    = 当前输入产生的激活，大小随 B 和 N 改变
```

可以用一次资料检索来理解：

- Query 表示“当前位置想查什么”；
- Key 表示“每个位置提供什么索引特征”；
- Value 表示“匹配后实际取回什么内容”。

这只是直观类比，真实计算仍是矩阵运算。

## 2.1 为什么要设计 Q、K、V

QKV 的目的不是为了把模型结构故意变复杂，而是要解决一个问题：

> 当前 token 应该从其他 token 中寻找什么信息，并取回什么内容？

假设模型正在理解：

```text
小明把苹果放到桌上，因为它很重。
```

模型处理“它”时，需要判断“它”更可能指小明、苹果还是桌子。这个过程可以抽象为一次按内容检索：

```text
“它”提出需求：我要寻找一个可能被代词指代的对象
其他 token 展示自己的匹配特征
匹配完成后，取回相关 token 携带的语义信息
```

Q、K、V 分别承担这三个角色：

```text
Q（Query）：当前 token 想找什么
K（Key）：每个 token 可以用什么特征被找到
V（Value）：找到该 token 后，实际取回什么信息
```

可以类比搜索系统中的：

| Attention | 搜索系统类比 |
| --- | --- |
| Query | 用户输入的检索条件 |
| Key | 文档的检索索引或标签 |
| Value | 文档中真正需要取回的内容 |

整体过程是：

```text
当前 token 的 Q
      ↓
与所有 token 的 K 比较
      ↓
得到每个 token 的相关程度
      ↓
根据相关程度对所有 V 加权求和
      ↓
得到当前 token 从上下文收集的新信息
```

## 2.2 为什么不直接使用原始 X

输入 `X` 中混合了一个 token 的各种信息。模型在不同场景下需要使用不同方面：

```text
作为查询者时，需要表达“我想找什么”；
作为候选对象时，需要表达“我为何值得被找到”；
被找到以后，需要提供“我实际贡献什么信息”。
```

因此模型用三个不同的、训练得到的矩阵进行转换：

```text
Q = XWq
K = XWk
V = XWv
```

同一个 token 经过不同投影后，可以形成三种不同表示。例如“苹果”这个 token：

```text
它的 Q：苹果当前想从上下文了解什么
它的 K：苹果具有“物体、名词、可被代词指代”等匹配特征
它的 V：苹果的具体语义、上下文属性等可供取回的信息
```

`Wq`、`Wk`、`Wv` 在训练中学习。人不会手工规定哪个维度表示“物体”，训练过程会调整这些矩阵，使正确的信息交换有助于模型降低预测误差。

## 2.3 为什么 Key 和 Value 要分开

“判断是否相关”与“相关后取回的内容”不一定相同。

以数据库为例：

```text
Key   = 用户 ID，用于查找记录
Value = 用户姓名、地址、订单等实际数据
```

用户 ID 适合比较和定位，但它不是最终想取回的业务内容。Attention 同样把“用于匹配的表示”和“用于传递的表示”分开：

```text
Q 与 K 决定关注谁；
V 决定从被关注者那里拿走什么。
```

如果 K 和 V 完全相同，模型用于匹配和用于传递信息的表达会受到同一套表示约束。分开以后，模型可以学到更灵活的信息路由方式。

## 2.4 QKV 并不是三份固定标签

需要避免一个误解：Q、K、V 不是给 token 人工贴上的三种标签，也不是磁盘中为每句话预先保存的数据。

它们是每次前向计算时，由当前输入临时计算出的激活：

```text
模型长期保存：Wq、Wk、Wv
当前请求产生：Q、K、V
```

输入句子不同，Q、K、V 就不同。模型训练真正得到的是“如何把 X 投影成 Q、K、V”的权重矩阵。

## 2.5 一个不带数字的最小例子

假设当前正在更新“它”的表示：

```text
候选 token：小明、苹果、桌子、它、很重
```

可以把模型内部过程想象为：

```text
Q(它) 与 K(小明) 比较  → 相关度较低
Q(它) 与 K(苹果) 比较  → 相关度较高
Q(它) 与 K(桌子) 比较  → 相关度中等
...
```

经过 softmax 后得到示意权重：

```text
小明：0.05
苹果：0.65
桌子：0.20
其他：0.10
```

然后模型不是把“苹果”这个词直接复制过来，而是对各 token 的 V 做加权组合：

```text
新表示(它)
= 0.05 × V(小明)
+ 0.65 × V(苹果)
+ 0.20 × V(桌子)
+ ...
```

于是“它”的新表示吸收了更多来自“苹果”的上下文信息。

这个例子只用于建立直觉。真实模型有多个 head，每个 head 都可能关注不同关系；模型也不保证某一个 head 必然执行人类可命名的“代词消解”任务。

## 3. Attention 如何计算

在看公式前，必须先区分“参数”“中间数据”“计算过程”和“计算结果”：

| 名称 | 类型 | 是否训练得到 | 是否随输入变化 |
| --- | --- | --- | --- |
| `Wq、Wk、Wv、Wo` | 模型参数 | 是 | 通常不变 |
| `Q、K、V` | 当前请求的中间激活 | 否，由输入和权重计算产生 | 是 |
| Attention | 一段计算过程 | 计算规则本身不是一份权重 | 使用当前 QKV 执行 |
| Attention 输出 `O` | 中间激活 | 否，由 Attention 计算产生 | 是 |

完整关系是：

```text
模型参数                       当前输入产生的数据
Wq、Wk、Wv
    ▲
    │
输入 X ──线性投影──> Q、K、V
                         │
                         ▼
                  Attention 计算
                         │
                         ▼
                   Attention 结果
                         │
                         ▼
                  Wo 输出投影（参数）
                         │
                         ▼
                  Attention 模块输出
```

所以 QKV 并不是 Attention 之外突然出现的三个东西。设计 QKV 的目的，就是将它们作为 Attention 计算的输入。

### 3.0.1 Attention 到底做什么

Attention 只完成两件核心事情：

```text
第一件：用 Q 和 K 计算“应该关注谁”
第二件：按照关注比例，对 V 加权汇总
```

继续使用句子：

```text
小明拿起苹果，因为它很重。
```

当模型更新“它”的表示时：

```text
Q_它 与 K_小明 比较  → 得分
Q_它 与 K_苹果 比较  → 得分
Q_它 与 K_桌子比较   → 得分
```

假设转换成关注比例后为：

```text
小明：10%
苹果：70%
桌子：20%
```

Attention 随后使用这些比例汇总 Value：

```text
Attention 结果
= 10% × V_小明
+ 70% × V_苹果
+ 20% × V_桌子
```

这个结果是“它”从上下文收集到的新信息，是一个新的中间张量。它不是最终预测结果，还要继续经过输出投影、残差连接、MLP 和后续 Transformer 层。

### 3.0.2 为什么 Attention 模块有参数，但 Attention 计算本身不是参数

“Attention”这个词有两种常见用法，容易混淆：

1. **Attention 计算/机制**：指 Q 与 K 匹配，再汇总 V 的算法；
2. **Attention 模块/层**：指包含 QKV 投影、Attention 计算和输出投影的完整组件。

可以表示为：

```text
Attention 模块
├── Q 投影：使用参数 Wq
├── K 投影：使用参数 Wk
├── V 投影：使用参数 Wv
├── Attention 计算：QK 匹配并汇总 V
└── 输出投影：使用参数 Wo
```

因此：

```text
Attention 计算规则：不是模型权重
完整 Attention 模块：包含模型权重
Attention 的结果：当前请求的中间激活
```

### 3.0.3 一次前向过程的最小闭环

对于当前 token “它”，先暂时忽略多层和多头：

```text
1. 输入表示 X_它
2. X_它 × Wq → Q_它
3. 所有 token 的 X × Wk → 所有 K
4. 所有 token 的 X × Wv → 所有 V
5. Q_它 与所有 K 比较 → 注意力权重
6. 注意力权重 × 所有 V → 上下文结果 O_它
7. O_它 × Wo → Attention 模块输出
8. 继续进入残差连接、MLP 和下一层
```

这里的输出关系是：

```text
Q、K、V
  ↓ Attention
上下文结果 O
  ↓ 后续网络层
更深的 token 表示
  ↓ 最终 LM Head
下一个 token 的概率
```

所以 Attention 的结果只是模型内部的一站，不是模型最终回答。

缩放点积注意力公式为：

```text
Attention(Q, K, V)
= softmax(QKᵀ / √d) V
```

分为三步。

### 3.1 计算相关性分数

```text
Scores = QKᵀ / √d
```

如果单个 head 中：

```text
Q.shape = [N, d]
K.shape = [N, d]
```

那么：

```text
Scores.shape = [N, N]
```

第 `i` 行、第 `j` 列表示第 `i` 个 token 对第 `j` 个 token 的关注程度。

`√d` 用于缩放点积，避免维度较大时数值过大，使 softmax 过度饱和。

### 3.2 softmax 转换为权重

```text
P = softmax(Scores)
```

softmax 通常沿每一行进行，使一行的注意力权重之和为 1。

### 3.3 聚合 Value

```text
O = PV
```

输出 `O` 是对各位置 Value 的加权组合。

## 4. 为什么 Attention 会出现平方压力

`Scores` 的形状是 `[N, N]`，元素数量为：

```text
N²
```

如果序列长度从 `N` 增加到 `4N`：

```text
原来：N²
后来：(4N)² = 16N²
```

这就是上一节中视频 token 增加 4 倍时，完整 Attention 的相关性计算可能增加约 16 倍的原因。

朴素实现可能显式保存较大的 `Scores` 和 softmax 中间结果。FlashAttention 等优化会通过分块和融合计算减少高带宽显存读写及中间结果占用，但不会将完整 Attention 的数学计算关系自动变成线性复杂度。

## 5. Multi-Head Attention

模型不会只做一组 Attention，而是把特征划分到多个 head：

```text
hidden_size D = num_heads H × head_dim d
```

例如：

```text
D = 4096
H = 32
d = 128
```

计算过程可简化为：

```text
X
 ├─ head 0 Attention
 ├─ head 1 Attention
 ├─ ...
 └─ head 31 Attention
        ↓
拼接 Concatenate
        ↓
输出投影 Wo
```

不同 head 可以学习不同类型的关系。拼接后的结果还需经过输出投影矩阵 `Wo`。

标准 MHA 的主要 Attention 权重通常包括：

```text
Wq, Wk, Wv, Wo
```

如果它们都近似为 `[D, D]`，单层 Attention 投影部分大约有：

```text
4D² 个参数
```

真实模型还可能采用 MQA 或 GQA，使 K、V 的 head 数少于 Query，从而减少 K/V 计算和缓存。

## 6. MLP / FFN

Attention 后通常还有一个更宽的前馈网络。以常见门控 MLP 为例：

```text
gate = activation(XW_gate)
up   = XW_up
Y    = (gate ⊙ up) W_down
```

若中间维度为 `I`，主要权重为：

```text
W_gate.shape ≈ [I, D]
W_up.shape   ≈ [I, D]
W_down.shape ≈ [D, I]
```

参数量约为：

```text
3DI
```

因为 `I` 通常明显大于 `D`，MLP 往往占据单个 Transformer Block 很大一部分参数。Attention 是 token 间的信息混合，MLP 更像是每个 token 内部的特征变换。

## 7. 一个 Block 中什么占内存

### 7.1 长期存在的权重

```text
Norm 参数
Wq、Wk、Wv、Wo
W_gate、W_up、W_down
可选 bias
```

### 7.2 当前前向过程的激活和工作区

```text
输入 X
归一化结果
Q、K、V
Attention 临时结果
Attention 输出
MLP 的 gate/up 中间结果
残差结果
底层 kernel 工作区
```

推理框架会尽量释放或复用已经无用的激活内存，但某一执行阶段同时存活的张量决定了峰值内存。

## 8. H3 与文本模型的差异

以上公式描述的是通用 Attention 基础。H3 属于多模态音视频生成系统，而不是普通的逐 token 文本模型，因此还需要考虑：

- 视频时空 token 与多模态条件；
- 扩散或流匹配过程中的多步迭代；
- H3-VAE 编码和解码；
- 音视频联合表示；
- 特定的稀疏 Attention 或优化 kernel；
- 不同任务和输入长度造成的异构 workload。

但无论输入 token 来自文本还是视频 latent，核心仍包括权重投影、QKV 激活、token 间信息交换和中间内存管理。

## 9. 本节练习

1. 已知 `X.shape=[2, 1024, 4096]`：`2`、`1024`、`4096` 分别代表什么？如果 X 是 BF16，理论占用多少 MiB？
2. `Wq` 与 `Q` 有什么区别？哪一个主要随序列长度增长？
3. 单个 head 的 `Q.shape=[2048, 128]`、`K.shape=[2048, 128]`，那么 `QKᵀ` 的 shape 是什么？一共有多少个元素？
4. 假设 `hidden_size D=4096`、`num_heads H=32`，每个 head 的 `head_dim d` 是多少？
5. 为什么使用 FlashAttention 后仍然需要关注长视频的 token 数量？

> 当前状态：已理解部分概念，练习暂缓。后续学习 KV Cache、显存和通信时，再结合实际张量回顾本节。
