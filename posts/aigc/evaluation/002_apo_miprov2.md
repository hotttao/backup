---
weight: 1
title: "APO - MIPROv2"
date: 2026-07-04T22:00:00+08:00
lastmod: 2026-08-11T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "APO - MIPROv2"
featuredImage:

tags: ["APO"]
categories: ["Agent"]

lightgallery: true
---

上一篇中，我们了解了 LLM 评估和 APO 的基本概念。本篇学习 DSPy 提供的一种 APO 实现 MIPROv2。

MIPROv2 把 Prompt 优化分为两个阶段：第一阶段生成 few-shot examples 和 instruction candidates，第二阶段将它们组合起来，在控制成本的前提下尽快找到比较好的组合。

MIPROv2 是 Prompt 优化的算法和机制，DSPy 则是对它的具体代码实现。

<!-- more -->

## 1. APO 的适用场景

APO 的优化目标可以是提高特定任务的成功率，也可以是在保持性能的同时减少 Token 数量和调用成本。

它不太适合一次性或者完全随机的对话，更适合会长期、大量重复执行的 Prompt，例如 Coding Agent 的 System Prompt、AI 应用的 System Prompt，以及 Workflow 中的固定 Prompt。因为 APO 本身也有开发成本和执行成本，只有 Prompt 会被重复使用时，优化才更有价值。当 AI 应用的 Prompt 扩展到成百上千甚至成千上万时，人工逐个维护和迭代会非常费时费力，这正是 APO 在规模化、工业化场景中的价值。

APO 的另一个重要前提是数据集。它不像模型训练或后训练那样需要大量数据；在真实应用中，人工收集十条左右真实、有价值的用例，就可以用来开始优化。


## 2. MIPROv2 整体流程

MIPROv2 整体分为两大阶段：**候选生成阶段 → 组合挑选阶段**。

### 2.1 文本流程简图（ASCII）

![MIPROv2 执行过程](/images/aigc/evaluate/miprov2.png)

```text
输入材料（初始Program、训练数据集、打分器）
        ↓
【第一阶段：生成候选】
        ├─从训练集随机抽取few-shot examples
        ├─Teacher检查examples是否够随机、够分散
        ├─结合Program、少量训练数据和Prompt技巧生成instruction candidates
        └─将few-shot examples和instruction candidates组合成多种方案
        ↓
【第二阶段：挑选组合】
        ├─对部分组合进行评估
        ├─根据已有分数判断哪些examples和instructions更值得继续尝试
        ├─把更多评估次数用在表现趋势更好的组合上
        └─达到设定轮次后，返回其中得分最高的组合
        ↓
在独立验证数据集上评估优化结果
```

## 3. 第一阶段：生成候选

### 1. 生成few-shot examples

- 怎么做：
    1. 从训练数据集中随机抽取少量用例，尽量打散抽样，而不是固定取前几条或后几条
    2. 将抽样结果交给teacher模型，检查用例是否够随机、够分散，是否存在重复或都指向同一类场景
    3. 如果抽样质量不好，就丢弃并重新抽取，直到获得足够数量、足够质量的examples
- 为什么这么做：
    1. 少量示例可以帮助模型更好地完成一类任务
    2. 示例太多反而可能约束模型的思考
    3. teacher模型用GPT-5.1，任务模型用GPT-5 Nano，形成高阶teacher帮助较弱student的模式

### 2. 生成instruction candidates

instruction candidates 是由teacher模型写出的候选 Prompt。生成时会参考四类内容：

1. **program-aware**：感知初始 Program 的意图，也就是理解当前最原始的 Prompt 想要做什么；
2. **data-aware**：从训练数据集中获取少量信息，用来完善 Prompt；
3. **tip-aware**：使用逐步思考、先输出reasoning、few-shot等 Prompt 写作技巧；
4. **静态模板**：按照通用描述、输出格式和 guidance 等固定结构组织内容。

MIPROv2 只会轻度使用训练数据的信息，不会在 Prompt 中硬编码大量训练用例。目的是避免 Prompt 只在训练集上表现很好，到更广泛的场景就失效。

### 3. 组合候选材料

如果第一阶段得到 5 组few-shot examples和 8 个instruction candidates，就会产生 40 种可选组合。第二阶段的任务，就是从这些组合中找到比较好的结果。

## 4. 第二阶段：挑选候选组合

### 1. 成本与质量的取舍

对 40 种组合各运行 3 次并计算平均分，需要评估 120 次。这种方法有机会找到全部组合中最好的一个，但成本也最高。

另一种极端是随机挑 5 种组合，各运行 3 次，只评估 15 次。成本下降了，但随机选中高质量组合的概率也会下降。

MIPROv2 在两者之间做取舍：不穷举所有组合，也不完全随机挑选，而是利用已有的评估结果，尽快找到表现趋势比较好的组合。

### 2. 根据评分趋势继续尝试

不同few-shot example和instruction之间可能存在稳定趋势：某一组example与不同instruction组合时都表现较好，说明它可能是高质量example；某个instruction与不同example组合时都表现较好，说明它可能是高质量instruction。

MIPROv2 会根据前几轮的打分结果判断这些趋势，将更多尝试次数用在看起来更有效的组合上，并根据新的评分结果继续调整判断。

原文把这个过程称为贝叶斯优化，把其中负责分析趋势的组件称为 `surrogate model`。DSPy 中使用基于 Optuna 的 TPE sampler 完成这个趋势分析。在理解整体流程时，只需要知道它会根据已有分数，判断哪些组合更值得继续尝试。

### 3. 在有限预算内找到足够好的结果

原文中举了一个例子：穷举所有组合时，最高分可能是 85；在只运行 40 或 60 次的情况下，MIPROv2 找到了 83 分的组合。83 不是最高分，但已经足够好，同时大幅减少了评估成本。

因此，MIPROv2 的目标不是在无限成本下找到最好的 Prompt，而是在有限成本内让 Prompt 足够快地变好。

### 4. 设置停止轮次

MIPROv2 提供低、中、高三个档次，每个档次对应固定的运行轮次。可以手动选择档次，也可以使用 `auto`，让大模型判断当前任务的难易程度并选择档次。

无论自动还是手动选择，最终都会得到一个固定轮次数。运行完这些轮次后，其中得分最高的组合就是本次优化结果。

## 5. MIPROv2 的局限

MIPROv2 的所有候选都在第一阶段生成并固定下来。第二阶段虽然会得到很多分数、输入和输出信息，但这些信息不会再反馈给第一阶段，也无法用来生成新的候选 Prompt。

如果所有候选 Prompt 都忽略了同一个问题，导致它们在某个项目上的分数都不高，第二阶段能够通过打分发现这个现象，却不能据此再生成一轮新候选。对于更复杂的场景，这种缺少动态反馈的两阶段设计存在局限，也由此引出了后续的 GEPA。

