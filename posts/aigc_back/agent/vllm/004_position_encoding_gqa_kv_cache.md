---
weight: 4
title: "大模型私有化部署（四）：位置编码、MHA、GQA 与 KV Cache"
date: 2026-08-12T21:00:00+08:00
lastmod: 2026-08-12T21:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "从部署角度理解位置编码、MHA、MQA、GQA，以及 KV Cache 的作用和显存占用。"
featuredImage:

tags: ["vllm", "大模型部署", "KV Cache", "FDE"]
categories: ["AIGC"]

lightgallery: true
---

本节从部署角度理解三个问题：模型如何知道 token 的顺序，为什么 Attention 有 MHA、MQA、GQA 等变体，以及自回归推理为什么需要 KV Cache。

<!-- more -->

## 1. Attention 为什么需要位置信息

先看两个句子：

```text
小猫追小狗
小狗追小猫
```

它们包含近似相同的词，但顺序改变后语义不同。

普通 Attention 根据 token 内容计算相关性。如果没有额外的位置信息，它本身不能充分区分 token 的先后顺序。因此模型需要把“第几个位置”编码进计算。

可以先直观理解为：

```text
token 表示：我是谁
位置编码：我在哪里
```

两者结合后，模型才能区分不同位置上的相同 token。

## 2. 绝对位置编码与相对位置

### 2.1 绝对位置编码

早期 Transformer 可以给每个位置准备一个位置向量：

```text
token embedding + position embedding
```

例如：

```text
“猫”的语义向量 + “位置 3”的位置向量
```

这种方式直接告诉模型当前位置编号。

### 2.2 相对位置思想

很多任务中，token 之间相隔多远比绝对编号更重要。例如模型需要知道：

```text
token A 在 token B 前面 3 个位置
```

现代大模型经常在 Attention 中注入相对位置信息。RoPE 是常见方案之一。

## 3. RoPE 的直观理解

RoPE 全称 Rotary Position Embedding，即旋转位置编码。

它不会简单地给输入加上一个位置向量，而是根据 token 的位置，对 Q 和 K 的部分维度进行不同角度的旋转：

```text
原始 Q、K
   ↓ 根据位置旋转
带位置信息的 Q、K
   ↓
计算 QKᵀ
```

可以把每一对数值想象成二维平面中的一个向量：

```text
位置越靠后 → 旋转角度越大
```

两个位置向量做点积时，其结果会自然包含二者的相对距离信息。

部署阶段不需要手算旋转矩阵，但需要知道：

- RoPE 通常作用于 Q 和 K，不直接作用于 V；
- 位置编号会影响 Q、K，因此影响 Attention；
- 最大上下文长度和 RoPE 配置有关；
- RoPE scaling 可以扩展上下文，但可能影响质量；
- 推理引擎必须正确支持模型所使用的 RoPE 变体。

## 4. 从 MHA 到 MQA、GQA

### 4.1 MHA：每个 Query Head 都有自己的 K、V Head

标准 Multi-Head Attention 可以表示为：

```text
Query heads：Q0 Q1 Q2 Q3 Q4 Q5 Q6 Q7
Key heads：  K0 K1 K2 K3 K4 K5 K6 K7
Value heads：V0 V1 V2 V3 V4 V5 V6 V7
```

每个 Query Head 对应自己的 Key 和 Value Head。

优点是表达能力强；缺点是 K、V 的计算量和缓存较大。

### 4.2 MQA：所有 Query Head 共享一组 K、V

Multi-Query Attention：

```text
Query heads：Q0 Q1 Q2 Q3 Q4 Q5 Q6 Q7
                    │
                    ▼
共享 Key：          K0
共享 Value：        V0
```

这样可以显著减少 K、V 参数量和 KV Cache，但共享程度较高，可能影响模型表达能力。

### 4.3 GQA：一组 Query Head 共享一组 K、V

Grouped-Query Attention 是两者之间的折中：

```text
Q0 Q1 ──共享── K0、V0
Q2 Q3 ──共享── K1、V1
Q4 Q5 ──共享── K2、V2
Q6 Q7 ──共享── K3、V3
```

如果有 8 个 Query Head、4 个 KV Head，则每 2 个 Query Head 共享一组 K、V。

三者对比：

| 方式 | Query Head 数 | KV Head 数 | KV Cache | 特点 |
| --- | ---: | ---: | --- | --- |
| MHA | H | H | 最大 | 表达能力强，缓存较大 |
| GQA | H | 小于 H | 中等 | 性能与内存折中 |
| MQA | H | 1 | 最小 | KV Cache 最省 |

从部署角度看，不能只读取 `num_attention_heads`，还要关注：

```text
num_key_value_heads
```

例如：

```json
{
  "hidden_size": 4096,
  "num_attention_heads": 32,
  "num_key_value_heads": 8
}
```

这表示有 32 个 Query Head，但只有 8 个 KV Head，属于 GQA。

## 5. 自回归生成为什么会重复计算

文本大模型通常逐 token 生成：

```text
输入：我喜欢
生成：学
生成：习
生成：大
生成：模
生成：型
```

生成“习”时，模型仍需要关注“我、喜、欢、学”。如果每生成一个新 token，都重新为所有历史 token 计算 K 和 V，会产生大量重复工作。

没有 KV Cache 时：

```text
第 1 步：计算历史 1...N 的 K、V
第 2 步：重新计算历史 1...N+1 的 K、V
第 3 步：重新计算历史 1...N+2 的 K、V
```

使用 KV Cache 后：

```text
第 1 步：计算历史 token 的 K、V，并保存
第 2 步：只计算新 token 的 K、V，再追加到缓存
第 3 步：只计算下一个新 token 的 K、V，再追加
```

所以 KV Cache 本质上是：

> 保存每一层 Attention 已经为历史 token 计算出的 Key 和 Value，避免后续解码重复计算。

## 5.1 用一次真实生成顺序理解 KV Cache

假设用户输入：

```text
我 喜欢
```

模型准备继续生成：

```text
苹果 。
```

为了容易观察，假设模型只有：

```text
1 个 Transformer 层
1 个 Attention Head
head_dim = 2
```

所以每个 token 在这一层产生的 K 和 V 都只有两个数字。下面的数字完全是为解释机制虚构的，并非真实模型值。

### 阶段一：Prefill 处理用户输入

模型一次性处理 prompt 中的两个 token：

```text
token 1：我
token 2：喜欢
```

在当前 Transformer 层中，两个 token 分别产生自己的 Q、K、V：

```text
“我”：
Q_我 = [0.1, 0.7]
K_我 = [0.2, 0.8]
V_我 = [0.9, 0.1]

“喜欢”：
Q_喜欢 = [0.6, 0.3]
K_喜欢 = [0.7, 0.4]
V_喜欢 = [0.3, 0.8]
```

当前层计算完后，KV Cache 保存：

```text
K Cache = [K_我, K_喜欢]
V Cache = [V_我, V_喜欢]
```

也可以写成矩阵：

```text
K Cache = [
  [0.2, 0.8],  # 我
  [0.7, 0.4]   # 喜欢
]

V Cache = [
  [0.9, 0.1],  # 我
  [0.3, 0.8]   # 喜欢
]
```

模型根据 prompt 最后位置的输出概率，采样得到第一个新 token：

```text
苹果
```

需要特别注意：此时“苹果”只是刚刚被预测出来，还没有作为输入经过下一轮 Transformer。因此，这一时刻缓存中通常只有 prompt 的 K、V：

```text
缓存：[我, 喜欢]
输出：苹果
```

### 阶段二：用“苹果”预测下一个 token

模型把刚生成的“苹果”作为新一轮输入。这里只需为“苹果”计算新的 Q、K、V：

```text
Q_苹果 = [0.5, 0.9]
K_苹果 = [0.4, 0.6]
V_苹果 = [0.8, 0.7]
```

然后把新产生的 K、V 追加到缓存：

```text
K Cache = [K_我, K_喜欢, K_苹果]
V Cache = [V_我, V_喜欢, V_苹果]
```

这一轮中，`Q_苹果` 要与历史和当前的 Key 比较：

```text
Q_苹果 × K_我
Q_苹果 × K_喜欢
Q_苹果 × K_苹果
```

比较结果决定这一轮应该从哪些 Value 中取回更多信息：

```text
V_我、V_喜欢、V_苹果
```

这一轮结束后，模型预测下一个 token：

```text
。
```

此时状态为：

```text
缓存：[我, 喜欢, 苹果]
输出：。
```

### 阶段三：用“。”继续预测

如果还没遇到终止条件，模型将“。”送入下一轮，只计算它自己的 Q、K、V：

```text
Q_。 = [...]
K_。 = [...]
V_。 = [...]
```

缓存扩展为：

```text
K Cache = [K_我, K_喜欢, K_苹果, K_。]
V Cache = [V_我, V_喜欢, V_苹果, V_。]
```

接着使用 `Q_。` 查询缓存中的所有 K，并从所有 V 聚合信息，预测再下一个 token。

完整时间线如下：

| 阶段 | 本轮输入 | 本轮结束后的 KV Cache | 本轮预测结果 |
| --- | --- | --- | --- |
| Prefill | 我、喜欢 | 我、喜欢 | 苹果 |
| Decode 1 | 苹果 | 我、喜欢、苹果 | 。 |
| Decode 2 | 。 | 我、喜欢、苹果、。 | 下一个 token |

## 5.2 为什么通常缓存 K、V，却不缓存 Q

每一轮只需要当前新 token 的 Query 去查找全部历史内容：

```text
当前 Q × 全部历史 K
          ↓
注意力权重 × 全部历史 V
```

历史 token 的 Q 在它们自己的计算轮次已经使用过。下一轮查询由新的 token 发起，所以通常不需要重新使用历史 Q。

相反，历史 K 和 V 仍然分别承担“可被查找的特征”和“被找到后提供的信息”，后续每一轮都可能再次使用。因此缓存 K 和 V 最有价值。

```text
Q：当前查询，用过即结束
K：以后仍需被新 token 匹配
V：以后仍需向新 token 提供信息
```

## 5.3 缓存的不是 token ID，也不是原始单词

KV Cache 并不是简单保存：

```text
[“我”, “喜欢”, “苹果”]
```

token ID 本身会由请求状态保存，但 KV Cache 特指这些 token 经过当前 Transformer 层的投影和位置编码等处理后产生的 K、V 数值张量。

并且每层都有不同的 K、V：

```text
Layer 0：K_我^(0), V_我^(0), K_喜欢^(0), V_喜欢^(0) ...
Layer 1：K_我^(1), V_我^(1), K_喜欢^(1), V_喜欢^(1) ...
...
Layer 31：对应这一层自己的 K、V
```

因此一个 token 不是只有一对全模型通用的 K、V，而是在每一个 Attention 层都有该层产生的一对 K、V。

## 5.4 没有 KV Cache 会发生什么

为了用“苹果”预测“。”，模型仍需要“我”和“喜欢”的 K、V。

没有缓存时，第二轮必须重新输入：

```text
我 喜欢 苹果
```

并重新计算三个 token 的历史 K、V。

第三轮又要重新输入：

```text
我 喜欢 苹果 。
```

并重新计算更多历史内容。

有缓存后，每一轮只需计算新 token：

```text
Prefill：计算“我、喜欢”
Decode 1：只新增“苹果”
Decode 2：只新增“。”
```

代价是 KV Cache 随历史 token 数、层数、并发请求数和 KV Head 数持续增长。这是一种典型的：

```text
用显存换取计算时间
```

## 6. Prefill 与 Decode

自回归推理通常分为两个阶段。

### 6.1 Prefill

一次处理用户输入的所有 token：

```text
输入 prompt
  ↓ 并行处理多个 token
生成每层历史 token 的 K、V
  ↓
写入 KV Cache
```

Prefill 的特点：

- 计算量大；
- 矩阵通常较大；
- GPU 计算单元更容易得到充分利用；
- 长 prompt 会显著增加首 token 延迟。

### 6.2 Decode

之后每次通常只生成一个新 token：

```text
新 token
  ↓ 计算它的 Q、K、V
Q 与所有历史 K 计算 Attention
  ↓ 使用历史 V
产生下一个 token
```

Decode 的特点：

- 每一步计算规模较小；
- 必须反复读取模型权重和 KV Cache；
- 通常更容易受显存带宽限制；
- 输出越长，执行的 decode 步数越多。

因此服务指标通常区分：

```text
TTFT：Time To First Token，首 token 延迟
TPOT：Time Per Output Token，后续每 token 时间
```

## 7. KV Cache 在显存中的位置

单 GPU 推理时可以暂时理解为：

```text
GPU VRAM
├── 模型权重：相对固定
├── KV Cache：随请求数和 token 数增长
├── 当前激活：随 batch 和当前计算变化
├── kernel workspace
└── CUDA/框架开销
```

KV Cache 通常按“层”保存：

```text
Layer 0：历史 K、历史 V
Layer 1：历史 K、历史 V
...
Layer L-1：历史 K、历史 V
```

它不是只保存一份，因为每个 Transformer 层产生的 K、V 都不同。

## 8. KV Cache 的粗略估算

### 8.1 公式中的每个参数是什么意思

先看示例：

```text
层数              = 32
token 数           = 4096
KV Head 数         = 8
head_dim           = 128
KV dtype           = BF16，即 2 bytes
```

这些参数共同描述：

> 一个请求的 4096 个历史 token，在 32 层 Transformer 中，分别保存了多少个 K、V 数字。

#### 层数：32

模型由 32 个 Transformer Block 依次组成：

```text
输入
 ↓
Layer 0
 ↓
Layer 1
 ↓
...
 ↓
Layer 31
 ↓
输出
```

每一层都有自己的 `Wk` 和 `Wv`，所以同一个 token 进入不同层时，会产生不同的 K、V：

```text
“我”在 Layer 0：K_我^(0)、V_我^(0)
“我”在 Layer 1：K_我^(1)、V_我^(1)
...
“我”在 Layer 31：K_我^(31)、V_我^(31)
```

因此 KV Cache 不是全模型只保存一份，而是 32 层各保存一份。

#### token 数：4096

这里表示当前一个请求已经进入模型上下文的 token 数量，包括 prompt 和已经参与后续计算的输出 token。

例如：

```text
prompt：3000 tokens
已进入 decode 的输出：1096 tokens
当前缓存长度：4096 tokens
```

每个历史 token 在每一层都需要留下 K、V。因此 token 数增加一倍，其他条件不变时，KV Cache 大致也增加一倍。

这不是词数或字符数。一个中文字符、英文单词或标点经过 tokenizer 后，可能对应一个或多个 token。

#### KV Head 数：8

Attention 可以同时从多个特征子空间处理信息，这些并行分组称为 head。

假设模型有：

```text
Query Head 数 = 32
KV Head 数    = 8
```

这是 GQA。32 个 Query Head 分为 8 组：

```text
Q0  Q1  Q2  Q3   → 共享 K0、V0
Q4  Q5  Q6  Q7   → 共享 K1、V1
...
Q28 Q29 Q30 Q31  → 共享 K7、V7
```

所以每 4 个 Query Head 共享一组 K、V。KV Cache 只需保存 8 个 KV Head 的数据，而不是保存 32 份。

对每一个 token、每一层来说，需要保存：

```text
8 个 K 向量
8 个 V 向量
```

#### head_dim：128

`head_dim` 是每一个 head 向量包含多少个数。

例如某个 token 在某一层、某一个 KV Head 中：

```text
K = [k0, k1, k2, ..., k127]  # 128 个数
V = [v0, v1, v2, ..., v127]  # 128 个数
```

有 8 个 KV Head，因此该 token 在这一层的 K 包含：

```text
8 × 128 = 1024 个数
```

V 同样包含 1024 个数。K 和 V 合计：

```text
2 × 8 × 128 = 2048 个数
```

常见情况下：

```text
Query Head 数 × head_dim = hidden_size
32 × 128 = 4096
```

但使用 GQA 时：

```text
KV Head 数 × head_dim = 8 × 128 = 1024
```

因此 K、V 的总宽度可以小于 Query 的总宽度。

#### KV dtype：BF16，每个数 2 bytes

K、V 是数值张量。dtype 决定每个元素占多少字节：

```text
FP32：4 bytes
FP16：2 bytes
BF16：2 bytes
FP8：1 byte
```

此例使用 BF16，所以刚才一个 token 在一层中的 2048 个 K/V 数值需要：

```text
2048 × 2 bytes = 4096 bytes = 4 KiB
```

### 8.2 从一个 token 逐步算到整个请求

现在逐级扩大范围。

#### 一个 token、一个 KV Head、一层

```text
K：128 个数
V：128 个数
BF16：每个数 2 bytes

大小 = 2 × 128 × 2 bytes
     = 512 bytes
```

第一个 `2` 表示 K 和 V 两份数据，最后一个 `2 bytes` 表示每个 BF16 数值的大小。

#### 一个 token、8 个 KV Head、一层

```text
512 bytes × 8 = 4096 bytes = 4 KiB
```

#### 一个 token、8 个 KV Head、32 层

```text
4 KiB × 32 = 128 KiB
```

因此，这个模型每缓存一个 token，大约需要 128 KiB KV Cache。

#### 4096 个 token、8 个 KV Head、32 层

```text
128 KiB × 4096
= 524,288 KiB
= 512 MiB
```

所以完整公式为：

```text
K 和 V 两份             2
× Transformer 层数      32
× 历史 token 数          4096
× 每层的 KV Head 数      8
× 每个 head 的元素数     128
× 每元素字节数           2
= 536,870,912 bytes
= 512 MiB
```

### 8.3 用张量 shape 看这个缓存

忽略推理框架具体采用的维度排列，可以把逻辑结构想成：

```text
KV Cache.shape
≈ [2, 32, 4096, 8, 128]
```

各维度含义：

```text
2     ：K 和 V
32    ：层数
4096  ：历史 token 数
8     ：KV Head 数
128   ：每个 head 的向量长度
```

真实实现可能将 K、V 分成两个张量，或按 block/page、layer、device 使用不同维度顺序，但元素总量的基本来源相同。

对于常见文本模型，一个请求的 KV Cache 可以粗略估算为：

```text
KV Cache 字节数
≈ 2
× 层数
× token 数
× KV Head 数
× head_dim
× 每元素字节数
```

最前面的 `2` 表示同时保存 K 和 V。

假设：

```text
层数              = 32
token 数           = 4096
KV Head 数         = 8
head_dim           = 128
KV dtype           = BF16，即 2 bytes
```

那么：

```text
2 × 32 × 4096 × 8 × 128 × 2
= 536,870,912 bytes
= 512 MiB
```

这只是一个请求。若 20 个请求都占满 4096 token，理论上仅 KV Cache 就可能达到约 10 GiB。

这解释了一个常见现象：

> 模型权重明明能装进显存，但并发或上下文长度增加后仍然会 OOM。

## 9. GQA 为什么有利于部署

继续使用上面的模型。如果采用 MHA，KV Head 数从 8 变成 32：

```text
MHA KV Cache
= 2 × 32 × 4096 × 32 × 128 × 2
= 2048 MiB
```

同样条件下：

```text
GQA（8 个 KV Head）：512 MiB
MHA（32 个 KV Head）：2048 MiB
```

GQA 的 KV Cache 只有该 MHA 示例的四分之一。这也是现代生成模型广泛使用 GQA 的重要工程原因。

## 10. PagedAttention 解决什么问题

实际服务中，不同请求长度不同，并且随生成过程持续增长：

```text
请求 A：128 tokens
请求 B：2048 tokens
请求 C：刚生成到 513 tokens
```

如果为每个请求预留一大块连续显存，容易造成：

- 预留但未使用的空间浪费；
- 连续空间难以分配；
- 显存碎片；
- 请求扩展时搬迁数据。

PagedAttention 将 KV Cache 切成固定大小的块，并通过映射关系组织逻辑上连续的 token：

```text
逻辑 KV Cache：block 0 → block 1 → block 2
                         ↓ 映射
物理显存页：      page 7    page 2    page 11
```

它的思想类似操作系统的虚拟内存分页。它主要改善 KV Cache 的分配、复用和碎片问题，并不会让每个 token 的 K、V 数据凭空消失。

## 11. H3 是否也使用文本式 KV Cache

需要谨慎区分模型类型：

- 自回归文本模型逐 token 解码，KV Cache 是核心部署资源；
- H3 是音视频生成系统，推理流程包含视频 latent 和多步生成，并不等同于普通聊天模型逐 token decode；
- H3 仍然使用 Attention，也可能有条件缓存、特定状态复用和 Attention 优化，但不能直接套用文本 vLLM 的 KV Cache 公式估算整个 H3；
- 对 H3，视频 latent、Attention 工作区、VAE 和多步迭代通常是更需要重点分析的资源。

学习 KV Cache 的原因是：私有化部署型 FDE 必须理解文本 LLM 的服务容量，同时借此掌握“缓存计算结果，以内存换计算”的通用思想。

## 12. 本节练习

1. 为什么 Attention 需要位置编码？
2. 32 个 Query Head、8 个 KV Head 属于 MHA、MQA 还是 GQA？每几个 Query Head 共享一组 K、V？
3. KV Cache 保存的是模型权重，还是当前请求产生的运行状态？它主要随哪些变量增长？
4. 一个请求的 KV Cache 为 512 MiB，若同时有 10 个相同长度的请求，暂不考虑共享和其他优化，大约需要多少 GiB？
5. PagedAttention 的主要作用是减少每个 K、V 元素的大小，还是改善 KV Cache 的分配、复用和碎片问题？

> 当前状态：已理解部分概念，练习暂缓。后续结合真实推理服务的 KV Cache 指标、显存变化和并发实验再次回顾。
