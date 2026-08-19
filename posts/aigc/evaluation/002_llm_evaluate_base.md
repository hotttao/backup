---
weight: 1
title: "LLM 评估基础"
date: 2026-07-04T22:00:00+08:00
lastmod: 2026-08-11T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "LLM 评估基础"
featuredImage:

tags: ["APO"]
categories: ["Agent"]

lightgallery: true
---

## 1. 为什么当下需要 LLM 评估
模型的能力，已经在超出很多任务的需求，这意味着不一定更好的模型就是最适用的，因为模型还会继续进化，但是任务不会无限的变难。因为这些问题是人类世界长期积累下来的。

我们开始需要从其他方面开始考虑如何筛选模型，包括:
1. 降低成本
2. 提升速度
3. 防止回退

## 2. LLM  优化途径

LLM 的优化有多种途径:
1. 切换模型: 不一定是无条件的向上切换，开始出现更多的场景向下切换。
2. 修改提示词: 能不能用更少的提示词完成任务。成本考量的基础应该转向 task price 上。因为有可能 A 模型比 B 模型便宜，但是 A 模型需要更多的提示词才能完成任务，最终 B 模型更划算。
3. 更换 Agent: 从 Claude Code 切换到 goose 或者 Deepseek 以满足合规需求。

每一种优化方式，都需要工程化的 LLM 评估，来判断优化效果。

## 3. LLM 评估流程
![LLM 评估流程](/images/aigc/evaluate/llm_evaluate_base.png)

### 3.1 基础概念 
1. **数据集**：最重要的元素。在网关和 Agent 平台采集真实数据势在必行
2. 评估对象：例如 LLM API、Agent 或其他形态的 LLM 应用。需要关注评估对象的可控性，特别是对于 Agent 的评估。如果每次评估，Agent 与外部交互获取的结果都在变化，评估的结果就会变得不可控。
3. 输出: 数据集进入到评估对象产出的结果
4. **打分器**：工程挑战性最大的环节
5. 打分结果: 打分器输出的结果，基于结果进行评估对象的优化

#### 数据集
**CMMLU**: 
- 选择题数据集，输入是开放的，输出的收敛成具体的有限类比。
- 这种数据集对应的 output 天然就是结构化的，打分器的设计也比较简单。

**BFCL**: 
- 工具调用的数据集
- output 是模型输出的工具调用的参数，其格式是结构化的。但是参数可能有动态参数。比如调用的 write 工具，但是 写入的 content 是动态化的内容。
- 打分器的设计就开始需要一些技巧了，打分的结果需要是**多个维度**的以详细区分不同的模型的完成程度，提供更好的**区分度**。

**BFCL-multiturn**:
- Agent 式多轮工具调用数据集，跟单次工具调用数据集的区别是，工具调用是需要返回结果的，否则上下文是不完整的，所以这里需要保证工具调用结果的**可控性**

这三种数据集和打分器的设计思路都是把**开发式的问题转换成收敛式的答案**。

**Alpaca**
- 动态开放式数据集，问题和答案都是开放式的
- 使用 LLM 评估，用更强的模型去评估弱模型
- 评估的技巧是模型输出的问题，和数据集里的文本谁更好。因为评估好不好是一个不好量化的指标，模型更擅长回答的是这一次跟之前的基线相比是提升了，还是下降了，提升和下降的比例是多少。这是一个更好量化的指标。

| 数据集 | 数据集路径 (URL) | 结果评估代码 (URL) |
|---|---|---|
| **CMMLU**（中文多任务语言理解） | GitHub 仓库（含 data/ 数据）: https://github.com/haonan-li/CMMLU <br> HuggingFace 数据集: https://huggingface.co/datasets/haonan-li/cmmlu | 同一仓库，评估脚本在 `script/evaluate.py`、`src/mp_utils/`: https://github.com/haonan-li/CMMLU |
| **BFCL**（Berkeley Function Calling Leaderboard，单轮函数调用） | HuggingFace 数据集: https://huggingface.co/datasets/gorilla-llm/Berkeley-Function-Calling-Leaderboard <br> 介绍博客: https://gorilla.cs.berkeley.edu/blogs/8_berkeley_function_calling_leaderboard.html | GitHub（gorilla 仓库 `berkeley-function-call-leaderboard/` 目录，含 `openfunctions_evaluation.py`）: https://github.com/ShishirPatil/gorilla/tree/main/berkeley-function-call-leaderboard |
| **BFCL-multiturn**（即 BFCL V3，多轮/多步函数调用） | 同一 HuggingFace 数据集（含 multi-turn 类别）: https://huggingface.co/datasets/gorilla-llm/Berkeley-Function-Calling-Leaderboard <br> V3 介绍博客: https://gorilla.cs.berkeley.edu/blogs/13_bfcl_v3_multi_turn.html | 同一 GitHub 仓库（与 BFCL 共用评估代码，支持 multi-turn 评测）: https://github.com/ShishirPatil/gorilla/tree/main/berkeley-function-call-leaderboard |
| **AlpacaEval**（指令遵循自动评测） | HuggingFace 数据集: https://huggingface.co/datasets/tatsu-lab/alpaca_eval <br> 官网: https://tatsu-lab.github.io/alpaca_eval/ | GitHub（核心代码在 `src/alpaca_eval/`，通过 `alpaca_eval` CLI 运行）: https://github.com/tatsu-lab/alpaca_eval |


#### 真实系统评估
真实系统的评估，会从两个方向深入:
1. 如何把一个真实的复杂任务拆分成多个方法，让他们分别评估
2. 如何把评估变成一种循环，每一次评估的结果作为下一次评估的基线。或者有多个后选方向的时候，如何让他们并行的跑，逐渐找出正确的改进方向。