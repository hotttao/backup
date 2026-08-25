---
weight: 1
title: "LLM 评估实战：评估 Prompt"
date: 2026-07-04T22:00:00+08:00
lastmod: 2026-08-23T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "通过真实的 Session 标题生成场景，评估模型、推理参数和 Prompt"
featuredImage:

tags: ["LLM 评估"]
categories: ["Agent"]

lightgallery: true
---

上一篇介绍了 LLM 评估的基本概念和方法。本篇进入实战：用一个真实的 Session 标题生成场景，评估不同模型、推理参数和 Prompt 的效果。

本次评估最终选出了两个方向完全不同的方案：

> Thinking 方案的质量提高约 **14%**。
>
> No-thinking 方案节省近 **200 倍 Token**，速度提升 **63 倍**。

业务最终选择了 No-thinking 方案。这个结果不是通过人工阅读 Prompt 得出的，而是经过 44 次自动化实验，在质量、Token 数量和延迟之间做出的选择。

下面不只介绍这次实验做了什么，还会把它整理成一套可以重复使用的 Prompt 评估流程。

<!-- more -->

## 1. 先看完整流程

![Prompt 评估流程](/images/aigc/evaluate/prompt_evaluate.png)

一次 Prompt 评估可以拆成七步：

```text
1. 定义任务、指标和预算
        ↓
2. 采集并清洗真实数据
        ↓
3. 构造不同用途的数据集
        ↓
4. 设计代码规则和 LLM Judge
        ↓
5. 跑通一次完整评估
        ↓
6. 分阶段缩小实验范围
        ↓
7. 根据业务目标选择方案
```

这七步可以再分成三层：

1. **准备评估基础**：确定目标、数据集和打分器；
2. **执行多轮实验**：不断调整模型、推理参数和 Prompt；
3. **形成业务决策**：同时比较质量、Token 数量和延迟。

不要一开始就编写几十个 Prompt，也不要直接在全部生产数据上测试。正确的顺序是先让一次评估能够稳定运行，再用小数据集快速筛选，最后才在接近生产分布的数据上验收。

## 2. 第一步：定义任务、指标和预算

### 2.1 明确评估对象

业务场景来自 Neutree AI Agent Platform（NAP）：根据 Agent Session 的第一条 user message 生成标题。标题帮助用户了解会话目标，并在会话列表中找到之前的任务。

这里不是评估完整 Agent，而是评估一次生成标题的 LLM API 调用。评估对象由三个变量组成：

```text
模型 + 是否开启 Thinking + Prompt 版本
```

每次实验只改变这三个变量中的一个或几个，数据集和打分方式保持不变，实验结果才可以相互比较。

### 2.2 把业务要求变成指标

标题需要满足三个要求：

1. **简短**：不能输出大段解释；
2. **准确**：必须忠于第一条 user message；
3. **有区分度**：相似任务的标题也应该体现日期、任务 ID 等差异。

“有区分度”是最容易被忽略的要求。例如，一个 Agent 每小时执行一次告警采集任务，如果所有标题都叫“采集告警信息”，用户仍然无法区分不同会话。

除了标题质量，本次实验还记录两个工程指标：

1. 输出 Token 数量；
2. 端到端请求延迟。

最终需要回答的不是“哪个质量分最高”，而是“质量提高多少，需要多付出多少 Token 和时间”。

### 2.3 事先确定实验预算

LLM 评估很难预先知道理论上的最佳结果。模型、参数和 Prompt 的组合几乎可以无限增加，因此停止条件不能是“找到世界上最好的 Prompt”。

更实际的方式是先确定预算，例如：

- 最多投入多少时间；
- 最多消耗多少 Token；
- 最多运行多少次实验；
- 达到什么质量分数即可接受。

本次评估把第一轮探索限制为 32 次，最终共完成 44 次实验。即使还可能存在更好的 Prompt，只要预算已经耗尽，并且当前结果满足业务需求，本轮评估就可以结束。

完成这一步后，应该得到一份类似下面的配置：

```yaml
task: generate_session_title
input: first_user_message
output: title

quality_requirements:
  - concise
  - faithful
  - distinctive

engineering_metrics:
  - output_tokens
  - latency_ms

experiment_budget: 44
```

## 3. 第二步：采集并清洗真实数据

### 3.1 从生产链路采集数据

数据来自 Neutree 模型网关的访问日志。模型网关能够统一记录：

- 请求使用的模型；
- System Prompt；
- 第一条 user message；
- 模型生成的 title；
- reasoning、Token 和延迟等调用信息。

本次一共采集到 8432 条成功的标题生成请求。

对于这个任务，一条原始数据可以简化为：

```json
{
  "system_prompt": "生成 Session 标题使用的 Prompt",
  "user_message": "Session 的第一条用户消息",
  "generated_title": "历史生成的标题"
}
```

### 3.2 根据输入去重

生产环境中存在定时任务和重复使用的固定指令，相同的 user message 可能出现很多次。

这次评估关心的是输入场景的多样性，而不是历史输出的多样性。因为后续会使用新的模型和 Prompt 重新生成标题，所以清洗时按照 `user_message` 去重，将 8432 条请求清洗为 4782 条有效输入。

下面是对应的示意代码：

```python
def deduplicate(rows):
    unique = {}

    for row in rows:
        key = row["user_message"].strip()
        if key not in unique:
            unique[key] = row

    return list(unique.values())
```

这一阶段最重要的经验是：数据量大不等于数据质量高。如果 8000 条数据中大部分内容重复，它仍然不是一个高质量数据集。

完成这一步后的产出是：一组已经去重、可以继续分类和抽样的真实输入。

## 4. 第三步：构造不同用途的数据集

一次评估不应该只准备一个数据集。实验早期需要低成本地大量探索，实验后期则需要更加接近生产分布的数据进行验收。

本次从 4782 条数据中构造了三个数据集：

| 数据集 | 数量 | 构造方式 | 用途 |
|---|---:|---|---|
| `regression-60` | 60 | 对数据分类后，每类均衡抽样 | 快速筛选和 Prompt 优化 |
| `challenge-60` | 60 | 挑选最复杂、最容易出错的用例 | 检查方案遇到难题时是否失效 |
| `production-300` | 300 | 按生产数据中的类别比例分层抽样 | 最终模拟生产验收 |

### 4.1 regression-60

先让 Agent 对 4782 条数据分类，例如基本信息、包含变量、长消息、任务 ID、链接和代码等，再从每个类别中均匀抽取一部分数据。

它的数据量小、类型比较全面，适合反复运行。实验方向还不确定时，优先使用这个数据集。

### 4.2 challenge-60

让能力更强的 Agent 从全部数据中挑选 60 条最复杂、最容易生成错误标题的用例。

它不是为了模拟日常生产比例，而是故意放大困难场景。一个方案在 `regression-60` 上表现很好，不代表它遇到长消息、复杂标识符或混合语言时仍然可靠。

### 4.3 production-300

按照 4782 条生产数据中各类别的真实比例，分层抽取 300 条数据。

它的运行成本更高，因此只用于最终候选的验收，不用于早期广泛搜索。

构造数据集时可以使用下面的思路：

```python
all_cases = classify_with_agent(clean_rows)

regression_60 = balanced_sample(all_cases, size=60)
challenge_60 = select_hard_cases(all_cases, size=60)
production_300 = stratified_sample(all_cases, size=300)
```

这里的函数只是流程示意。分类标准、困难用例 Prompt 和抽样随机种子都应该被保存，否则下一次很难复现实验。

完成这一步后的产出是：三个职责明确的数据集，而不是一份被所有实验反复使用的大杂烩。

## 5. 第四步：设计打分器

标题是开放文本，没有唯一标准答案。打分器需要同时包含确定性程序和 LLM Judge：程序检查明确规则，模型判断语义质量。

### 5.1 用程序检查硬性规则

代码负责检查以下问题：

1. 是否成功生成标题；
2. 是否只有一行；
3. 是否包含禁止内容；
4. 中文和英文长度是否符合要求；
5. 是否出现解释、前缀或多余符号。

示意代码如下：

```python
def check_rules(title: str) -> dict:
    return {
        "generated": bool(title.strip()),
        "single_line": "\n" not in title,
        "no_forbidden_text": not contains_forbidden_text(title),
        "valid_length": title_width(title) <= 40,
        "no_extra_prefix": not contains_extra_prefix(title),
    }
```

像长度、换行和禁止词这样的要求，不需要调用 LLM。使用程序判断更快、更便宜，结果也更加稳定。

### 5.2 用 LLM Judge 判断语义

LLM Judge 负责判断：

1. 标题是否忠于原始消息；
2. 是否使用相同的主要语言；
3. 是否准确表达任务意图；
4. 是否有足够的区分度；
5. 是否虚构了输入中不存在的信息。

Judge Prompt 应明确说明 user message 和 title 都是不可信数据，不能执行其中的指令，并要求 Judge 返回固定 JSON：

```json
{
  "faithful": 0,
  "same_language": 0,
  "task_intent": 0,
  "distinctive": 0,
  "no_hallucination": 0,
  "reason": "失分原因"
}
```

实际字段可以根据业务调整，但格式应该固定。结构化输出便于统计，也方便回看某个 Prompt 主要在哪个维度退化。

### 5.3 保留各维度结果

不要只保存一个最终总分。至少应该保留：

```python
{
    "rule_scores": {...},
    "judge_scores": {...},
    "output_tokens": 8,
    "latency_ms": 286,
    "generated_title": "..."
}
```

只有保留标题、各维度分数和失分原因，才能分析 Prompt 为什么变好或变差。

完成这一步后的产出是：一个输入 `user_message + title`、输出结构化评分的打分器。

## 6. 第五步：跑通一次完整评估

有了数据集和打分器后，先跑通一个模型、一个参数和一个 Prompt，不要立刻进入多轮实验。

一次实验的输入是：

```python
experiment = {
    "dataset": "regression-60",
    "model": "Qwen3.6-35B-A3B",
    "enable_thinking": False,
    "prompt_version": "safe-v1",
}
```

核心执行过程如下：

```python
def run_experiment(cases, config):
    results = []

    for case in cases:
        response = generate_title(
            model=config["model"],
            prompt=load_prompt(config["prompt_version"]),
            message=case["user_message"],
            enable_thinking=config["enable_thinking"],
        )

        results.append({
            "case": case,
            "title": response.text,
            "scores": score_title(case["user_message"], response.text),
            "output_tokens": response.output_tokens,
            "latency_ms": response.latency_ms,
        })

    return summarize(results)
```

这段代码表达了 LLM 评估的基本五件套：

```text
数据集 → 评估对象 → 输出 → 打分器 → 评估结果
```

在开始多轮实验前，需要确认：

1. 相同配置可以重复运行；
2. 每条输入、输出和评分都能追溯；
3. Token 与延迟能够正确记录；
4. 实验配置和结果不会相互覆盖。

完成这一步后的产出是：一条稳定、可自动重复执行的评估流水线。

## 7. 第六步：分阶段缩小实验范围

单次评估只能说明一个方案的表现，无法直接找到改进方向。本次实验按照“快速筛选 → 重点优化 → 挑战难题 → 模拟生产”的顺序推进：

```text
32 次快速筛选 + 5 次重点优化 + 4 次挑战难题 + 3 次模拟生产 = 44 次实验
```

每一阶段都使用上一阶段的结果缩小范围，而不是在所有变量上一直盲目搜索。

### 7.1 快速筛选：先确定模型和 Thinking 方向

**目标**：快速判断哪种模型和推理模式值得继续投入。

**数据集**：`regression-60`。

**实验组合**：

- 2 个模型：27B Dense、35B-A3B MoE；
- 每个模型运行 10 个 No-thinking Prompt；
- 每个模型运行 6 个 Thinking Prompt；
- 合计 32 次实验。

**得到的结果**：

1. 27B 与 A3B 在这个任务上的质量基本没有差别；
2. Thinking 比 No-thinking 高约 20%；
3. A3B 的推理速度明显更快；
4. 20% 的质量差距有可能通过优化 Prompt 缩小。

**下一步决策**：固定 A3B + No-thinking，把实验重点转向 Prompt。

这个方向本质上是把成本从输出侧转移到输入侧。Thinking 增加的是昂贵的 decoding 和输出 Token；补充 Prompt 增加的主要是相对便宜的 prefill 和输入 Token。

### 7.2 重点优化：只改变 Prompt

**目标**：在最快的 A3B + No-thinking 组合上提高标题质量。

**数据集**：继续使用 `regression-60`。

**固定项**：模型和 Thinking 参数不变。

**实验变量**：5 个 Prompt 方向。

1. 强制复制标识符；
2. 增加 Few-shot 示例；
3. 只强调任务意图；
4. 将“标识符必须复制”改为建议；
5. 使用更安全、更简洁的通用 Prompt。

**得到的结果**：

1. 强制复制标识符容易把请求元数据也复制到标题中；
2. 只输出标识符可能丢失真正的任务意图；
3. Few-shot 不一定更好，也可能引入示例中的错误模式；
4. 将标识符作为建议，比作为强制规则更安全。

**下一步决策**：保留表现最好和次好的两个 Prompt 方向，用更困难的数据继续验证。

### 7.3 挑战难题：确认早期结论没有失效

**目标**：检查在普通数据上得到的模型结论，遇到困难任务后是否仍然成立。

**数据集**：`challenge-60`。

**实验组合**：

1. A3B No-thinking；
2. 27B No-thinking；
3. A3B Thinking；
4. 27B Thinking。

**得到的结果**：

1. A3B 与 27B 的标题质量仍然接近；
2. 27B 的推理延迟明显更高；
3. Thinking 的质量高约 15%～20%；
4. Thinking 平均需要额外输出约 1500 个 Token；
5. 27B 在两种模式下都没有明显优势。

**下一步决策**：淘汰 27B，只保留 A3B 的候选组合进入模拟生产。

### 7.4 模拟生产：只验收最终候选

**目标**：用更接近真实生产分布的数据做最后决策。

**数据集**：`production-300`。

**实验组合**：

1. A3B No-thinking，Prompt 方向 1；
2. A3B No-thinking，Prompt 方向 2；
3. A3B Thinking，Prompt 方向 2。

**最终结果**：

| 方案 | 质量分数 | 输出 Token | 平均延迟 |
|---|---:|---:|---:|
| A3B No-thinking，Prompt 方向 1 | 66.9 | 个位数到约 10 个 | 约 200～300 毫秒 |
| A3B No-thinking，Prompt 方向 2 | 81.2 | 个位数到约 10 个 | 约 200～300 毫秒 |
| A3B Thinking，Prompt 方向 2 | 95.8 | 平均 1000 多个 | 十几秒 |

两个 No-thinking Prompt 方向的质量分别为 66.9 和 81.2。同一个 Prompt 方向开启 Thinking 后，质量从 81.2 提高到 95.8。

Thinking 最终只输出一个很短的标题，但在此之前需要生成大量 reasoning。平均输出在 1000 个 Token 以上，部分场景甚至达到 3000～4000 个 Token。

完成这一步后的产出不是唯一的“最佳模型”，而是两种边界清晰的候选：质量最高的 Thinking 方案，以及性能最好的 No-thinking 方案。

## 8. 第七步：根据业务目标做决策

最终两个方案的差异是：

1. **Thinking**：质量从 81.2 提高到 95.8，适合更加关注标题质量的场景；
2. **No-thinking**：节省近 200 倍 Token，速度提升 63 倍，适合更加关注成本和延迟的场景。

这两个方案没有脱离业务的绝对优劣。

在 Session 标题场景中，标题质量有一定容错空间，用户不满意时也可以自行修改。相比之下，接近 200 倍的 Token 差异和 63 倍的速度差异过于明显，因此业务最终选择了质量为 81.2 的 A3B No-thinking 方案。

这里的 81.2 来自比较严格的打分器。剩余未得分的用例不一定完全不可用，也可能只是多了一两个字，或者区分度没有达到最佳。因此，评估分数需要结合评分标准和业务容忍度理解，不能机械地把它当成可用请求的比例。

## 9. 一套可以复用的 Prompt 评估模板

在其他任务中，可以按照下面的清单执行。

### 9.1 准备阶段

- [ ] 明确输入、输出和评估对象；
- [ ] 把业务要求拆成质量指标；
- [ ] 确定需要记录的 Token、延迟和成本指标；
- [ ] 设置时间、Token 或实验次数预算；
- [ ] 从生产链路采集真实输入；
- [ ] 去重、过滤无效数据并保存清洗规则。

### 9.2 数据集阶段

- [ ] 准备一个小而全面的回归集，用于快速试错；
- [ ] 准备一个困难集，检查方案的薄弱点；
- [ ] 准备一个接近真实比例的生产集，用于最终验收；
- [ ] 保存分类标准、抽样方法和随机种子。

### 9.3 打分阶段

- [ ] 明确哪些要求由代码判断；
- [ ] 明确哪些语义要求由 LLM Judge 判断；
- [ ] 固定 Judge Prompt 和输出 JSON；
- [ ] 保存每个维度的分数与原因，而不是只保存总分。

### 9.4 实验阶段

- [ ] 先跑通一个可重复的 baseline；
- [ ] 第一轮广泛探索模型和参数；
- [ ] 第二轮固定模型和参数，只优化 Prompt；
- [ ] 使用困难集复查早期结论；
- [ ] 只让最终候选进入生产分布数据集；
- [ ] 根据预先确定的预算停止实验。

### 9.5 决策阶段

- [ ] 同时比较质量、Token、延迟和成本；
- [ ] 结合业务容错空间解释分数；
- [ ] 保存最终配置、Prompt、数据集版本和评估结果；
- [ ] 上线后继续采集新数据，为下一轮评估提供输入。

## 10. 总结

这次实验真正可复用的不是某一段 Prompt，而是整个评估顺序：先准备真实数据和稳定的打分器，再跑通单次评估；然后用小数据集探索方向，固定一部分变量后继续优化；最后才使用困难数据和生产分布数据进行验收。

如果一开始就在所有模型、所有参数、所有 Prompt 和全部生产数据上同时搜索，实验成本会迅速失控，也很难知道改动为什么有效。

通过分阶段缩小范围，本次使用 44 次自动化实验，最终获得了明确的量化结果：Thinking 提高质量，No-thinking 大幅降低 Token 和延迟。评估把“哪个 Prompt 看起来更好”，变成了“为了多少质量，业务愿意付出多少成本”。

## 11. 附录：如何看懂千问最新系列的模型

> 本节资料更新于 2026 年 8 月 23 日。千问官方将 Qwen3.5、Qwen3.6 和 Qwen3.8 放在同一条 Qwen3.5 开源模型系列中，其中最新版本是 Qwen3.8。

### 11.1 先看懂模型名称

千问模型名称里的 `B` 表示十亿参数。例如，`27B` 表示大约 270 亿参数。

`35B-A3B` 则需要拆成两个数字：

- `35B`：模型总共保存约 350 亿参数；
- `A3B`：处理每个 Token 时，只激活约 30 亿参数。

只有一个参数数字的模型通常是 Dense，也就是稠密模型。每生成一个 Token，模型的大部分参数都会参与计算。

带有 `A` 的模型是 MoE，也就是混合专家模型。模型内部有很多“专家”，但每个 Token 只会由路由器挑选少数专家参与计算。因此，MoE 可以保留较大的总参数容量，同时把单次计算量压到接近激活参数规模。

这也解释了正文中的实验结果：27B 是稠密模型，每个 Token 都需要使用约 27B 参数；35B-A3B 虽然总参数更多，但每个 Token 只激活约 3B 参数，所以推理通常更快。需要注意，激活参数少不代表显存只需要容纳 3B 参数，部署时仍然需要保存整个 35B 模型的权重。

### 11.2 共同的实现原理

这一代模型的主要实现可以概括为四点：

1. **Gated DeltaNet + Gated Attention**：大部分层使用 Gated DeltaNet 处理长上下文，定期插入完整 Attention 层，兼顾推理效率与长距离信息召回；
2. **Dense 或 MoE**：Dense 模型在每个 Token 上使用全部 FFN 参数，MoE 模型则通过路由器只激活部分专家；
3. **原生多模态**：除 Qwen3.8-2.4T-A95B 开源权重外，表中的模型都带 Vision Encoder，可以处理文本、图片和视频；
4. **MTP**：训练时加入 Multi-Token Prediction，让推理框架可以通过推测解码一次预测多个 Token，提高生成吞吐。

这些模型的原生上下文长度都是 262,144 Token，并可以扩展到约 100 万 Token。这里的“可以扩展”不等于部署后默认就是 100 万上下文，实际还取决于推理框架、显存和部署参数。

### 11.3 全部主要模型

下表只列不同能力和参数规模的主模型。`Base` 是只完成预训练、主要用于继续训练的版本；`FP8`、`GPTQ-Int4` 和 `GGUF` 是同一个模型的不同量化或存储格式，因此没有重复列出。

| 版本 | 模型 | 架构 | 总参数 / 激活参数 | 输入 | Thinking |
|---|---|---|---|---|---|
| Qwen3.5 | Qwen3.5-0.8B | Dense | 0.8B / 0.8B | 文本、图片、视频 | 支持开关 |
| Qwen3.5 | Qwen3.5-2B | Dense | 2B / 2B | 文本、图片、视频 | 支持开关 |
| Qwen3.5 | Qwen3.5-4B | Dense | 4B / 4B | 文本、图片、视频 | 支持开关 |
| Qwen3.5 | Qwen3.5-9B | Dense | 9B / 9B | 文本、图片、视频 | 支持开关 |
| Qwen3.5 | Qwen3.5-27B | Dense | 27B / 27B | 文本、图片、视频 | 支持开关 |
| Qwen3.5 | Qwen3.5-35B-A3B | MoE | 35B / 3B | 文本、图片、视频 | 支持开关 |
| Qwen3.5 | Qwen3.5-122B-A10B | MoE | 122B / 10B | 文本、图片、视频 | 支持开关 |
| Qwen3.5 | Qwen3.5-397B-A17B | MoE | 397B / 17B | 文本、图片、视频 | 支持开关 |
| Qwen3.6 | Qwen3.6-35B-A3B | MoE | 35B / 3B | 文本、图片、视频 | 默认开启，可以关闭 |
| Qwen3.6 | Qwen3.6-27B | Dense | 27B / 27B | 文本、图片、视频 | 默认开启，可以关闭 |
| Qwen3.8 | Qwen3.8-27B | Dense | 27B / 27B | 文本、图片、视频 | 默认开启，可以关闭，还可调节推理深度 |
| Qwen3.8 | Qwen3.8-2.4T-A95B | MoE | 2.4T / 95B | 仅文本 | 必须开启，不能关闭 |

从部署角度，可以把这些模型分成几组：

1. **0.8B～9B Dense**：参数较少，适合端侧、本地开发和资源有限的场景；
2. **27B Dense**：每个 Token 都使用全部 27B 参数，质量更稳定，但单 Token 计算成本更高；
3. **35B-A3B**：总容量为 35B，每个 Token 只激活约 3B，适合重视吞吐和延迟的自部署场景；
4. **122B-A10B、397B-A17B**：总容量和激活参数更大，需要多卡部署，面向更高质量要求；
5. **2.4T-A95B**：Qwen3.8 的旗舰开源模型，总参数达到 2.4T，每个 Token 激活 95B，只支持文本和 Thinking，部署成本最高。

### 11.4 Thinking 到底是不是模型自带的

表中的“支持 Thinking”是指模型经过了相应的后训练，能够先生成 `<think>...</think>` 中的推理过程，再输出最终答案。它不是在模型外面额外套一段普通 Prompt，也不会改变模型的参数量。

Qwen3.5 和 Qwen3.6 都通过 API 参数 `enable_thinking` 控制是否思考，而不是切换成另一个模型。Qwen3.6 默认开启 Thinking，可以通过 `enable_thinking=false` 关闭；Qwen3.5 则应根据所用推理框架显式设置。它们不支持 Qwen3 时代的 `/think` 和 `/nothink` 文本指令软切换。

Qwen3.6 还增加了 `preserve_thinking`：多轮对话时可以保留历史消息中的推理过程，减少 Agent 在后续步骤中重复思考。

Qwen3.8-27B 在此基础上增加了更细的推理控制：

- `enable_thinking=false`：完全关闭 Thinking，直接回答；
- `reasoning_effort=low | medium | xhigh`：开启 Thinking 时调整推理深度；
- `preserve_thinking`：决定是否保留历史推理过程。

Qwen3.8-2.4T-A95B 开源权重比较特殊：它是仅文本、仅 Thinking 模型，不能关闭推理。官方托管的 Qwen3.8-Max 基于它提供服务，但额外增加了视觉输入、No-thinking 和内置工具等能力，不能把托管版的能力直接等同于开源权重。

因此，“模型支持 Thinking”并不代表生产环境中应该始终开启。简单、短输出、高频调用的任务，可以像本文一样同时评估 Thinking 和 No-thinking；复杂推理、Coding Agent 和长链路任务，则还需要关注关闭 Thinking 后是否会增加失败和重试，避免只优化单次请求延迟，却增加整个任务的成本。

资料来源：

- [Qwen3.8 官方仓库：版本范围与模型列表](https://github.com/QwenLM/Qwen3.8)
- [Qwen3.5 官方模型集合](https://huggingface.co/collections/Qwen/qwen35)
- [Qwen3.6-35B-A3B 官方模型卡](https://huggingface.co/Qwen/Qwen3.6-35B-A3B)
- [Qwen3.6-27B 官方模型卡](https://huggingface.co/Qwen/Qwen3.6-27B)
- [Qwen3.8-27B 官方模型卡](https://huggingface.co/Qwen/Qwen3.8-27B)
- [Qwen3.8-2.4T-A95B 官方模型卡](https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B)
