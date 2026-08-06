---
weight: 1
title: "Huggingface 基础"

date: 2025-07-16T9:00:00+08:00
lastmod: 2025-07-16T9:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Huggingface 基础"
featuredImage: 

tags: ["huggingface"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

## 1. Huggingface 生态

Huggingface 是一个完整的 **AI 开发生态系统**，涵盖模型、数据、工具、服务和社区。


### 1.1 **核心平台**

* **🤗 Hub（Model Hub）**

  * 超过百万个模型（NLP、CV、音频、多模态、大模型等）
  * 包含 `datasets`、`spaces`、`papers`、`organizations`
  * 类似“GitHub for ML”，每个模型/数据集都有版本控制、文档、权重存储。

---

### 1.2 **开源库**

Hugging Face 提供了多个功能层次的库：

| 库                    | 功能                                                          | 典型应用                          |
| -------------------- | ----------------------------------------------------------- | ----------------------------- |
| **transformers**     | 各类预训练模型（BERT, GPT, T5, CLIP, Whisper, LLaMA...）统一 API       | 加载/推理/微调模型                    |
| **datasets**         | 大规模数据集的标准加载、切分、预处理                                          | NLP/LLM 训练、评测                 |
| **tokenizers**       | 超快分词工具（Rust 实现）                                             | BPE, WordPiece, SentencePiece |
| **evaluate**         | 统一评估指标（BLEU, ROUGE, Accuracy, F1, perplexity）               | 模型性能评测                        |
| **peft**             | Parameter-Efficient Fine-Tuning (LoRA, Prefix-Tuning, etc.) | 大模型微调                         |
| **accelerate**       | 分布式训练、混合精度、设备管理                                             | LLM 训练、推理加速                   |
| **optimum**          | 硬件优化（ONNX, TensorRT, Intel, Habana 等）                       | 模型部署与推理加速                     |
| **trl**              | Transformers Reinforcement Learning                         | RLHF（强化学习对齐）                  |
| **gradio**           | Web UI 快速搭建工具                                               | 模型 Demo                       |
| **huggingface\_hub** | Python SDK 访问 Hugging Face Hub                              | 上传/下载模型和数据                    |

---

### 1.3 **服务与产品**

* **Inference API**：Hugging Face 官方托管推理服务（支持 Serverless）
* **Inference Endpoints**：企业级部署方案，可在 AWS、Azure、GCP 上一键部署模型
* **Spaces**：基于 Gradio 或 Streamlit 的在线 Demo 平台（很多模型作者会放交互演示）
* **AutoTrain**：自动化训练工具（零代码模型训练）
* **Evaluate Leaderboards**：如 **MTEB Leaderboard、Open LLM Leaderboard**

### 1.4 **典型生态流程**

一个 Hugging Face 开发生命链可以是：

1. **datasets** 加载数据
2. **tokenizers** 分词
3. **transformers** 加载预训练模型
4. **peft/accelerate** 微调
5. **evaluate** 评估效果
6. 模型上传到 **Hub**
7. 用 **spaces/gradio** 做 Demo
8. 用 **inference endpoints** 部署到生产环境


## 2. Leaderboard
### 2.1 MTEB Leaderboard
Hugging Face 的 [MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard) 是专门评测 文本嵌入（text embedding）模型 的榜单，它的任务都是 文本 → 向量 的能力（检索、分类、聚类、STS 等）

| 字段                            | 含义                                    | 说明                                                              |
| ----------------------------- | ------------------------------------- | --------------------------------------------------------------- |
| **Rank (Borda)**              | 排名（Borda 计分法）                         | 使用 Borda count 方法综合不同任务的排名得分，得到的整体排名。                           |
| **Model**                     | 模型名称                                  | 参评的模型标识，一般是 Hugging Face Hub 上的模型名（如 `BAAI/bge-large-en-v1.5`）。 |
| **Zero-shot**                 | 零样本能力                                 | 模型在 **没有微调/训练样本** 的情况下完成任务的表现。                                  |
| **Memory Usage (MB)**         | 内存占用                                  | 模型在推理时加载所需的显存/内存大小（单位 MB），反映部署资源消耗。                             |
| **Number of Parameters**      | 参数数量                                  | 模型的参数总数（通常为百万或十亿级），影响模型规模与复杂度。                                  |
| **Embedding Dimensions**      | 向量维度                                  | 模型输出的嵌入向量的维度大小（如 384, 768, 1024），影响向量检索性能和存储。                   |
| **Max Tokens**                | 最大输入长度                                | 模型一次可处理的最大 token 数，决定了输入文本的最大长度。                                |
| **Mean (Task)**               | 任务平均分                                 | 模型在所有任务上的平均得分。                                                  |
| **Mean (TaskType)**           | 任务类型平均分                               | 按任务类别（如分类、检索、聚类等）分组后的平均得分。                                      |
| **Bitext Mining**             | 双语挖掘                                  | 衡量模型在平行语料检索（跨语言句对匹配）上的表现。                                       |
| **Classification**            | 分类                                    | 衡量模型在单标签分类任务中的准确性（如情感分类）。                                       |
| **Clustering**                | 聚类                                    | 衡量模型在文本聚类任务中的表现（通常用 NMI、ARI 等指标）。                               |
| **Instruction Retrieval**     | 指令检索                                  | 衡量模型在 **自然语言指令匹配** 场景下的检索性能。                                    |
| **Multilabel Classification** | 多标签分类                                 | 衡量模型在多标签文本分类（一个文本可能对应多个类别）的表现。                                  |
| **Pair Classification**       | 句对分类                                  | 衡量模型在句子对任务（如自然语言推理、相似度判定）上的表现。                                  |
| **Reranking**                 | 重排序                                   | 衡量模型在检索后对候选结果进行重排序的效果。                                          |
| **Retrieval**                 | 检索                                    | 衡量模型在文本检索（如向量搜索、文档查找）上的性能。                                      |
| **STS**                       | 语义文本相似度 (Semantic Textual Similarity) | 衡量模型对两句文本语义相似度打分的能力。                                            |


### 2.2 LLM Open LLM Leaderboar
Hugging Face 的 [Open LLM Leaderboard](https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard#/) 主要评测 通用语言理解与推理能力，涵盖多个基准数据集。核心思路是：让 LLM zero-shot（零样本）在这些标准任务上回答，然后用自动化指标打分。

这个 Leaderboard 主要是通过 **知识、推理、数学、指令遵循、专业能力** 这几个维度来打分的，最后给出一个 **综合平均分 (Average)**。另外还考虑了 **计算代价 (CO₂ Cost)**，提醒使用者模型的能效。


| 字段           | 含义                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| **Rank**     | 排名，按照各项任务的综合得分或加权平均得出的名次。                                                                              |
| **Type**     | 模型类型，比如 Base（基础模型）、Instruct（指令调优模型）、Chat（对话优化模型）等。                                                     |
| **Model**    | 模型名称，例如 `LLaMA-2-70B-chat`、`Mistral-7B-Instruct`。                                                      |
| **Average**  | 模型在所选评测任务上的平均得分，作为综合指标。                                                                                |
| **IFEval**   | **Instruction Following Eval**，评测模型是否能够正确理解并执行自然语言指令，测试“指令遵循能力”。                                       |
| **BBH**      | **Big-Bench Hard**，来自 Google 的大规模基准数据集（Big-Bench）中最困难的一部分任务，测试复杂推理、多步骤思考能力。                            |
| **MATH**     | 高难度数学题测试集，评估模型的数学推理、公式计算、逐步解题能力。                                                                       |
| **GPQA**     | **Graduate-Level Google-Proof Q\&A**，研究生水平的问答测试，设计成不能通过简单搜索解决，评估深度知识与推理。                               |
| **MUSR**     | **Multi-Step Reasoning**，多步推理任务，测试模型能否在多轮逻辑推理中保持一致性。                                                   |
| **MMLU-PRO** | **Massive Multitask Language Understanding - Professional**，MMLU 的专业版，涵盖更高难度的学科（法律、医学、工程），测试专业知识与综合推理。 |
| **CO₂ Cost** | 模型运行时的碳排放估计（CO₂ 排放量），衡量计算开销和环保影响。                                                                      |


### 2.3 其他 Leaderboard

除了 **Open LLM Leaderboard** 和 **MTEB Leaderboard** 之外，Hugging Face 生态中还有其他[Leaderboards](https://huggingface.co/collections/open-llm-leaderboard/the-big-benchmarks-collection-64faca6335a7fc7d4ffe974a?utm_source=chatgpt.com)

常见 Leaderboards 如下:

1. **Big Code Models Leaderboard**

   * 专注代码生成模型（评测 HumanEval、MultiPL-E 等）。
   * 🔗 [Big Code Leaderboard 合集](https://huggingface.co/collections/clefourrier/leaderboards-and-benchmarks-64f99d2e11e92ca5568a7cce?utm_source=chatgpt.com)

2. **LLM-Perf Leaderboard**

   * 关注不同硬件上的性能（延迟、吞吐量、显存占用）。
   * 🔗 [LLM-Perf Leaderboard](https://huggingface.co/spaces/optimum/llm-perf-leaderboard)

3. **Open ASR Leaderboard**

   * 自动语音识别（ASR）模型排行榜，指标包括 WER（词错误率）、RTF（实时因子）。
   * 🔗 [Open ASR Leaderboard 合集](https://huggingface.co/collections/open-llm-leaderboard/the-big-benchmarks-collection-64faca6335a7fc7d4ffe974a?utm_source=chatgpt.com)

4. **LMArena Leaderboard**

   * 基于对话模型的对抗比赛（Elo 排名、MT-Bench）。
   * 🔗 [LMArena Leaderboard](https://huggingface.co/spaces/lmarena-ai/lmarena-leaderboard)

5. **GAIA Leaderboard**

   * 评测具备工具调用、检索增强能力的 LLM。
   * 🔗 [GAIA Leaderboard](https://huggingface.co/spaces/gaia-benchmark/leaderboard)

6. **Arabic AI Leaderboards**

   * 针对阿拉伯语生态（通用 LLM、语法、推理、安全等）。
   * 🔗 [Arabic AI Benchmarks & Leaderboards](https://huggingface.co/blog/silma-ai/arabic-ai-benchmarks-and-leaderboards)

7. **MEGA-Bench Leaderboard**

   * 综合多模态模型的评测（支持任务筛选）。
   * 🔗 [MEGA-Bench Leaderboard](https://huggingface.co/spaces/TIGER-Lab/MEGA-Bench)

8. **其他小众/专项 Leaderboards**

   * 如 Creator IQ、U-GI、EQ-Bench（创意智能、通用智能、情感智能）等。
   * 🔗 [50+ Leaderboards 合集](https://huggingface.co/collections/DavidAU/50-leaderboards-benchs-gguf-tools-and-utilities-672961dda4203ffb675e011a)


## 3. Task
Huggingface 在搜索页面归类了很多 Task。

### 3.1 Task 大类
大类其实是按照 **数据模态 / 应用领域** 来划分的。

---

#### **Multimodal（多模态）**

* **含义**：同时处理两种或多种模态的数据（文本、图像、音频、视频等）。
* **特点**：输入输出可能跨模态，例如输入图片 → 输出文字描述，输入音频 + 文本 → 输出文本。
* **应用场景**：图文问答、文档问答、视频字幕生成、跨模态检索等。

---

#### **Computer Vision（计算机视觉，CV）**

* **含义**：处理和理解图像、视频等视觉数据。
* **特点**：模型输入通常是图像或视频，输出可以是类别标签、像素级结果、关键点或生成的新图像/视频。
* **应用场景**：目标检测、人脸识别、图像生成、视频理解、3D 重建。

---

#### **Natural Language Processing（自然语言处理，NLP）**

* **含义**：处理和理解自然语言文本。
* **特点**：输入通常是纯文本，输出可能是标签（分类）、序列（翻译、生成）、向量（embedding）等。
* **应用场景**：机器翻译、问答系统、文本摘要、对话系统、搜索与推荐。

---

#### **Audio（音频处理）**

* **含义**：处理和生成音频数据（包括语音和非语音音频）。
* **特点**：输入是音频，输出可能是文本（ASR）、语音（TTS）、标签（分类）、或新的音频。
* **应用场景**：语音助手、音乐生成、环境声音识别、语音活动检测。

---

#### **Tabular（表格数据）**

* **含义**：处理结构化数据（表格、数值、时间序列）。
* **特点**：输入通常是数值型/类别型特征，输出是分类结果、回归值或预测的时间序列。
* **应用场景**：金融风控、医学预测、销售预测、推荐系统。

---

#### **Reinforcement Learning（强化学习）**

* **含义**：智能体通过与环境交互，学习策略来最大化奖励。
* **特点**：强调“试错”和“反馈”，不是单纯的数据映射。
* **应用场景**：机器人控制、游戏 AI、自动驾驶、推荐系统优化。

---

#### **Other（其他）**

* **含义**：主要是 **Graph Machine Learning（图机器学习）**，处理图结构数据（节点 + 边）。
* **特点**：输入是图结构（例如社交网络、分子结构），输出可以是节点分类、图分类或链路预测。
* **应用场景**：分子药物发现、社交关系预测、知识图谱建模。

---

👉 总结一下：

* **Multimodal**：跨模态输入输出
* **Computer Vision**：视觉领域
* **NLP**：文本领域
* **Audio**：语音 / 音频领域
* **Tabular**：结构化数据领域
* **Reinforcement Learning**：交互式学习
* **Other**：特殊数据类型（如图结构）

### 3.2 Task 二级分类

好的 👍
你给的这两张图展示了 Hugging Face Hub 上支持的 **Task（任务类型）**。我帮你整理成表格形式，每个 Task 的作用用简短说明。

---

#### **Multimodal**

同时处理两种或多种模态的数据（文本、图像、音频、视频等）

| Task                        | 说明                     |
| --------------------------- | ---------------------- |
| Audio-Text-to-Text          | 输入音频并转为文本（如语音问答）。      |
| Image-Text-to-Text          | 输入图像和文本，输出文本（如图片描述生成）。 |
| Visual Question Answering   | 给图片提问并生成答案。            |
| Document Question Answering | 针对文档（PDF、扫描件等）提问并回答。   |
| Video-Text-to-Text          | 输入视频并生成文本（如视频描述）。      |
| Visual Document Retrieval   | 基于图像内容检索文档。            |
| Any-to-Any                  | 多模态统一模型，可以处理任意输入输出模态。  |

---

#### **Computer Vision**

处理和理解图像、视频等视觉数据。

| Task                           | 说明                  |
| ------------------------------ | ------------------- |
| Depth Estimation               | 预测图像中的深度信息。         |
| Image Classification           | 将图像分到预定义类别中。        |
| Object Detection               | 检测并框出图像中的目标物体。      |
| Image Segmentation             | 为图像中每个像素分配类别标签。     |
| Text-to-Image                  | 文本生成图像。             |
| Image-to-Text                  | 图像生成文字描述。           |
| Image-to-Image                 | 输入图像并生成另一张修改后的图像。   |
| Image-to-Video                 | 输入图像生成视频。           |
| Unconditional Image Generation | 随机生成图像，不需要条件输入。     |
| Video Classification           | 视频分类任务。             |
| Text-to-Video                  | 输入文本生成视频。           |
| Zero-Shot Image Classification | 无需再训练，直接分类图像。       |
| Mask Generation                | 生成图像掩码，用于抠图等。       |
| Zero-Shot Object Detection     | 无需再训练，直接检测目标。       |
| Text-to-3D                     | 从文本生成 3D 模型。        |
| Image-to-3D                    | 从图像生成 3D 模型。        |
| Image Feature Extraction       | 提取图像的 embedding 特征。 |
| Keypoint Detection             | 检测图像中的关键点（如人体关节）。   |
| Video-to-Video                 | 视频转视频（风格迁移、修复等）。    |

---

#### **Natural Language Processing（自然语言处理，NLP）**

处理和理解自然语言文本

| Task                     | 说明                           |
| ------------------------ | ---------------------------- |
| Text Classification      | 将文本分类（情感分析等）。                |
| Token Classification     | 对序列中的每个 token 分类（NER 实体识别等）。 |
| Table Question Answering | 针对表格数据问答。                    |
| Question Answering       | 文本问答（如阅读理解）。                 |
| Zero-Shot Classification | 不依赖特定类别训练，直接做分类。             |
| Translation              | 机器翻译。                        |
| Summarization            | 文本摘要生成。                      |
| Feature Extraction       | 提取文本 embedding 特征。           |
| Text Generation          | 生成文本（对话、文章等）。                |
| Fill-Mask                | 预测文本中的 \[MASK] 填空。           |
| Sentence Similarity      | 判断两句文本的语义相似度。                |
| Text Ranking             | 对候选文本进行排序（如搜索相关性）。           |

---

#### **Audio**
处理和生成音频数据（包括语音和非语音音频）

| Task                         | 说明                      |
| ---------------------------- | ----------------------- |
| Text-to-Speech               | 文本转语音。                  |
| Text-to-Audio                | 文本生成音频（不仅限于语音，如音乐）。     |
| Automatic Speech Recognition | 语音识别（ASR），音频转文本。        |
| Audio-to-Audio               | 输入音频转换为另一种音频（如降噪、风格转换）。 |
| Audio Classification         | 音频分类（如环境声音识别）。          |
| Voice Activity Detection     | 检测语音片段（判断音频中是否有人声）。     |

---

#### **Tabular**
处理结构化数据（表格、数值、时间序列）。

| Task                    | 说明              |
| ----------------------- | --------------- |
| Tabular Classification  | 表格数据分类。         |
| Tabular Regression      | 表格数据回归预测。       |
| Time Series Forecasting | 时间序列预测（如股票、天气）。 |

---

#### **Reinforcement Learning**
强化学习，智能体通过与环境交互，学习策略来最大化奖励。

| Task                   | 说明              |
| ---------------------- | --------------- |
| Reinforcement Learning | 强化学习任务。         |
| Robotics               | 针对机器人控制的强化学习任务。 |

---

#### **Other**
（图机器学习），处理图结构数据（节点 + 边）

| Task                   | 说明                  |
| ---------------------- | ------------------- |
| Graph Machine Learning | 图神经网络任务（节点分类、图分类等）。 |

## 4. LLM的命名规范
当然可以！让我们以一个可能的 **最长的 Hugging Face 模型命名** 为例，来逐步解析每个部分的含义。假设我们有一个模型名称：

```
facebook/bart-large-mnli-finetuned-squad2-english
```

这个名称看起来相对复杂，实际上它包含了很多有用的信息。我们可以将其分解为以下几个部分：

**`facebook/`**:

* **来源组织/团队名称**：这一部分标明了模型的开发者或发布者。在 Hugging Face 上，模型名称通常以 `/` 分隔的格式表示，前面是发布该模型的组织名称或团队。

  * 例如，`facebook` 表示该模型由 Facebook AI Research 开发（这是 **Facebook** 的 AI 研究部门）。

**`bart`**:

* **模型架构**：这是该模型所使用的基础架构。`bart` 表示这个模型基于 **BART**（Bidirectional and Auto-Regressive Transformers）架构。

  * **BART** 是一种结合了编码器和解码器结构的模型，适用于多种生成任务，例如文本生成、摘要、翻译等。

**`large`**:

* **模型规模**：表示这个 BART 模型的规模。`large` 表示这是 BART 模型中的大规模版本，通常具有更多的参数和更深的层次。

  * 在 Hugging Face 上，通常有多个不同规模的版本，例如 `base`（小型版本）和 `large`（大型版本）。较大的模型通常能获得更好的性能，但需要更多的计算资源。

**`mnli`**:

* **预训练任务或数据集**：`mnli` 指的是该模型在 **MNLI**（Multi-Genre Natural Language Inference）数据集上进行的预训练或微调任务。

  * MNLI 是一个用于自然语言推理（NLI）的数据集，包含多种类型的文本和任务，旨在测试模型是否能够理解两个句子之间的关系（如蕴含、矛盾、无关）。

**`finetuned`**:

* **微调标记**：这一部分表示该模型经过了微调。微调（fine-tuning）是指在预训练模型的基础上，进一步在特定任务或数据集上训练，以提高该任务的性能。

  * 如果没有 `finetuned`，则表明该模型是一个原始的预训练模型，可能没有针对特定任务进行调整。

**`squad2`**:

* **微调任务或数据集**：`squad2` 指的是该模型在 **SQuAD 2.0**（Stanford Question Answering Dataset 2.0）数据集上进行了微调。SQuAD 2.0 是一个用于问答（QA）任务的数据集，包含了问题和答案的配对，并且一些问题没有对应的答案（即“无解问题”），这是 SQuAD 2.0 相较于原始 SQuAD 的一个重要区别。

  * 这表明该模型已经针对 SQuAD 2.0 数据集的问答任务进行了优化，能够回答给定的问题，或者判断问题是否无解。

**`english`**:

* **语言**：`english` 表示这个模型主要是针对英文文本进行训练的。许多模型是多语言的，但有时为了表明模型是专门针对某种语言的，会在名称中注明语言。

  * 例如，`english` 明确表示这个模型被训练或微调来处理英语语言的任务。如果是多语言模型，可能会标明 `multilingual` 或具体列出支持的语言。

---

总结：

`facebook/bart-large-mnli-finetuned-squad2-english` 这个模型名称可以拆解成以下几个部分：

* **`facebook/`**：模型的开发者是 Facebook AI Research。
* **`bart`**：该模型使用 BART 架构。
* **`large`**：这是 BART 的大型版本，具有更多的参数和更复杂的模型。
* **`mnli`**：预训练任务是在 MNLI 数据集上进行的，主要用于自然语言推理任务。
* **`finetuned`**：该模型经过微调。
* **`squad2`**：微调任务是在 SQuAD 2.0 数据集上进行的，主要用于问答任务。
* **`english`**：该模型是专门针对英语语言训练的。

通过这种命名方式，用户能够非常清晰地了解模型的结构、规模、训练任务、微调任务以及语言支持。


## 5. 大模型质量评价

大模型基准测试分为三种类型:
1. 自动化基准测试
2. 人工评分
3. LLM 为评价者

### 5.1 自动化基准测试
对大模型进行 **Benchmark** 测试时，通常会使用一些标准化的基准数据集，这些数据集可以评估模型的各种能力，比如推理能力、知识广度、理解力等。以下是一些常用的基准数据集：

#### **MMLU (Massive Multitask Language Understanding)**

* **描述**: MMLU 是一个广泛的自然语言理解基准，涵盖了多种任务，包括数学推理、常识推理、医学、法律、文学等多个领域。
* **任务**: 评估模型在多任务上的能力。
* **规模**: 包括约 57 个任务，覆盖了超过 100,000 个问题。

### 5.2 人工评分
人工评分一个流行主办方为 [LM Arena](https://lmarena.ai/leaderboard)
