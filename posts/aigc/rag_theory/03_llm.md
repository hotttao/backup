---
weight: 1
title: "Rag LLM 使用"
date: 2025-08-20T11:00:00+08:00
lastmod: 2025-08-20T11:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Rag LLM 使用"
featuredImage: 

tags: ["RAG"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

## 1. LLM 参数配置

```python
{
    "temperature": 0.5,
    "top_k": 50,
    "top_p": 0.9,
    "repetition_penalty": 1.2,
    # 对数几率偏差，永久调整 token 被选中的概率，比如说避免脏话
    "logit_bias":  {   
        "50256": -100
    }
}
```


这些参数通常出现在基于生成模型的 LLM（大语言模型） API 请求中，用于控制生成文本的多样性、质量和风格。下面逐一解释这些参数：

1. **`temperature`**:

   * 控制模型生成的文本的随机性。值通常在 0 到 1 之间，较低的温度（如 0.5）会使生成的文本更加确定和一致，较高的温度（如 1.0 或更高）会让文本更加多样化和随机。通常，较低的值适合需要更准确、严谨输出的场景，而较高的值适用于需要更创意和多样性的文本生成。

2. **`top_k`**:

   * 限制模型每次选择 token 时只从前 `k` 个最可能的候选词中选择。`top_k=50` 表示模型在生成下一个 token 时，只会从概率最高的 50 个候选词中选一个。这个参数有助于控制生成文本的多样性和质量。

3. **`top_p`**:

   * 也叫核采样（nucleus sampling），它控制选取 token 时考虑的累计概率分布的阈值。`top_p=0.9` 表示模型会选择那些累积概率总和超过 0.9 的 token，即仅选择总概率前 90% 的词。这种方式可以更灵活地控制生成的多样性，避免模型过度偏向高概率词。

4. **`repetition_penalty`**:

   * 用于惩罚模型在生成时重复使用相同的 token。如果设置了 `repetition_penalty=1.2`，这意味着模型会在生成文本时，对那些已经生成过的 token 增加惩罚，从而减少重复词的出现。值越大，惩罚越强，生成的文本就越少重复。

5. **`logit_bias`**:

   * 这是一个偏向调整的参数，通常用于控制某些特定 token 的生成概率。`logit_bias` 通过直接调整 token 的对数几率（logit）来使模型更倾向于或更排斥某些 token。例如，`"50256": -100` 会使得 token ID 为 50256 的词（通常是某个不希望出现的词，如脏话、敏感词等）几乎不可能被选中生成。这个参数允许开发者进行细粒度的控制，避免生成某些不希望出现的内容。

这些参数的组合使用可以让你在使用 LLM 进行文本生成时，精确控制输出的风格、质量和内容。

## 2. 如何选择 LLM
如何选择 LLM 核心是三点:
1. 模型大小
2. 调用成本
3. 上下文窗口大小
4. 性能
5. 模型质量

## 3. 提示词工程
有很多提示词工程的方法:
1. 添加示例:
    - 除了硬编码示例，还可以把成功的示例当做知识库，根据用户输入的问题，动态选择合适的示例。
    - 假如你正在开发一个聊天机器人，可以将成功的客户聊天记录索引到向量数据库中，当用户就某个特定主题留言时，可以检索该主题的历史对话内容，并将其作为示例添加 Prompt 中
2. 提示 LLM 逐步推理得到结论:
    - 比如可以让 LLM 逐步思考解决问题的最佳方法，再给出最终答案。
    - 核心思想是，给 LLM 一个 scratch pad，让其回答千整理思路
3. 思维链提示法:
    - 要求 LLM 先生成回答问题所需的步骤，在遵循这些步骤回答问题
    - 这样大模型会展示其思考过程

以下是一些可供学习的 提示词工程的仓库:
1. [system-prompts-and-models-of-ai-tools](https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools/tree/main)
2. [Prompt-Engineering-Guide](https://github.com/dair-ai/Prompt-Engineering-Guide)

## 3. 幻觉处理机制
减少幻觉:
1. 可以修改系统提示，让大语言模型只能基于检索到的信息做事实性陈述
2. 可以进一步要求大语言模型引用来源，即要求大模型在每个句子或者段落末尾引用来源

```bash
Cite your sources at the end of each sentence using [1], [2], etc.

```

但是这么做仍然有风险，大模型可能虚构引用。如果想对引用更有信心，就需要使用外部系统。比如上下文评分系统可以对响应基于一组来源材料的程度进行评分。

用针对幻觉的基准测试系统、可以评估 Rag 出现幻觉的概率。ALCE 基础测试旨在衡量系统引用来源的效果。

### 3.1 ALCE

**ALCE** 是普林斯顿大学（Princeton University）提出的首个用于评估大语言模型（LLMs）在生成文本过程中提供准确引用能力的 **自动化基准（benchmark）**，在其 EMNLP 2023 论文中首次提出。该项目旨在增强 LLM 输出的可验证性和事实准确性，尤其聚焦于引用机制的有效性。

ALCE 的任务设置为：给定一个问题，系统不仅需从大规模检索语料中检索证据，还要生成带有引用的答案文本，让每个陈述都附带相应的引用段落。


## 4. 大模型性能评估
RAGAS 库（全称 RAGAs，Retrieval-Augmented-Generation Assessment）是一个专门用于评估 RAG（Retrieval-Augmented Generation，检索增强生成）系统的开源框架。


## 5. LLM Quantization

### 5.1 背景

大语言模型（LLM，比如 GPT、LLaMA、Qwen）通常有上百亿甚至上千亿参数。
这些参数本质上是**浮点数（通常是 FP32 或 FP16）**，存储和推理时需要巨大的显存和计算资源。

为了让模型能在更便宜的硬件（如单张消费级显卡、甚至 CPU）上运行，就引入了 **量化（Quantization）** 技术。

---

### 5.2 什么是量化

量化就是 **把原本的高精度浮点数参数，用更低精度的数据类型（int8、int4、甚至 int2）来近似表示**。

* 例如：

  * 原始参数：`0.123456789 (FP32)`
  * 量化后：`0.12 (INT8 对应的缩放表示)`

这样可以：

* **减少模型大小**（比如 4bit 量化能让模型体积缩小到 1/8）
* **降低内存带宽压力**
* **加速推理**（低精度矩阵乘法更快）

---

### 5.3 量化方法分类

常见的 LLM 量化方法有以下几类：

#### （1）Post-training Quantization（PTQ，训练后量化）

* 不需要重新训练
* 直接把训练好的模型参数转换成低精度
* 常见方法：

  * **per-tensor quantization**：一个张量用同一缩放因子
  * **per-channel quantization**：每个通道（比如权重矩阵的每一列/行）用不同缩放因子，精度更高
* 缺点：可能精度损失明显，尤其在极低比特（int4、int2）时

#### （2）Quantization-aware Training（QAT，量化感知训练）

* 在训练阶段就模拟量化效果，让模型学会在低精度下保持精度
* 精度更高，但需要重新训练，成本大

#### （3）混合精度量化（Mixed Precision）

* 不同部分用不同精度
* 例如：

  * **Embedding 层 / 输出层** → FP16（防止信息损失过大）
  * **Attention / MLP 权重** → INT4 或 INT8

#### （4）近年常见优化方法

* **GPTQ**（Post-training）：逐步量化权重并最小化误差
* **AWQ**（Activation-aware Weight Quantization）：对激活分布友好的量化
* **SmoothQuant**：通过平滑激活和权重分布，使量化更稳定
* **ZeroQuant**：针对超大模型的自动量化方法

---

### 5.4 精度 vs 性能权衡

* **FP16**（16-bit float）：几乎无损，推理速度和存储减半
* **INT8**：常见于 CPU/GPU 部署，精度损失可控
* **INT4**：目前最流行的 LLM 量化方案，可以让 70B 模型在单机 GPU 上运行
* **INT2 / Binary**：极端情况，通常只用于研究，精度损失大

---

### 5.5 实际应用举例

* **Hugging Face** 上很多 LLaMA、Qwen 模型都提供了 **GPTQ / AWQ 量化版**，显存占用直接减少 4-8 倍
* **GGUF 格式（llama.cpp 社区）**：支持 `q8_0`, `q4_k`, `q2_k` 等不同量化等级，可以在 MacBook / PC CPU 上跑大模型
* **Inference Frameworks**：

  * GPU 上：bitsandbytes、TensorRT-LLM、vLLM（部分支持）
  * CPU 上：llama.cpp、MLC-LLM
