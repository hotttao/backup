---
weight: 1
title: "Huggingface Datasets"
date: 2025-07-17T9:00:00+08:00
lastmod: 2025-07-17T9:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Huggingface Datasets"
featuredImage: 

tags: ["huggingface"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

这一节我们来学习 Huggingface Transformers 库。

## 1. Transformers
### 1.1 组成

Hugging Face 的 **Transformers** 是一个 **NLP / CV / Audio 通用预训练模型库**，主要由以下几部分组成：

| 模块                              | 作用                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| **Model Hub 接口**                | 提供与 Hugging Face Hub 的集成，方便加载/上传模型（如 `AutoModel.from_pretrained("bert-base-uncased")`）。       |
| **Auto Classes**                | 统一的入口类，根据模型名称自动选择合适的架构（如 `AutoTokenizer`, `AutoModel`, `AutoModelForSequenceClassification`）。 |
| **Tokenizer**                   | 分词器模块，将文本转成 token，再转成模型可用的 `input_ids`。同时负责反向解码。                                              |
| **Model Classes**               | 不同任务的模型定义（BERT, GPT, T5, CLIP 等），并且细分为不同下游任务（分类、生成、问答等）。                                      |
| **Pipelines**                   | 高层封装的任务接口，如 `pipeline("sentiment-analysis")`，几行代码完成推理。                                        |
| **Trainer / TrainingArguments** | 提供了训练/评估/微调的高层 API，支持分布式训练。                                                                   |
| **Datasets / Tokenizers 集成**    | 与 `datasets`、`tokenizers` 等 Hugging Face 生态无缝结合。                                              |

---

### 1.2 核心抽象

Transformers 的设计哲学是：
**Tokenizer → Model → Pipeline**

* **Tokenizer (分词器)**

  * 输入：原始文本
  * 输出：`input_ids`, `attention_mask` 等张量

* **Model (模型类)**

  * 输入：`input_ids` 等张量
  * 输出：隐藏层、logits、loss 等
  * 主要分为两类：

    * **Encoder-only**（如 BERT，用于分类、检索）
    * **Decoder-only**（如 GPT，用于生成）
    * **Encoder-Decoder**（如 T5/BART，用于翻译、摘要）

* **Pipeline (任务流水线)**

  * 输入：文本（或图像/音频）
  * 自动调用分词器 + 模型 + 后处理，得到结果
  * 适合快速推理 demo，但训练/微调一般直接用 `Trainer`

---

### 1.3 基础使用

下面给你几个常见的入门示例：

#### 加载预训练模型 & 分词器

```python
from transformers import AutoTokenizer, AutoModel

# 加载 tokenizer
tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")

# 加载模型
model = AutoModel.from_pretrained("bert-base-uncased")

# 编码文本
inputs = tokenizer("Hello Hugging Face!", return_tensors="pt")

# 前向计算
outputs = model(**inputs)

print(outputs.last_hidden_state.shape)  # [batch_size, seq_len, hidden_size]
```

---

#### 使用 Pipeline 快速推理

```python
from transformers import pipeline

classifier = pipeline("sentiment-analysis")

result = classifier("I love using Hugging Face Transformers!")
print(result)
# [{'label': 'POSITIVE', 'score': 0.9998}]
```

---

#### 下游任务模型

```python
from transformers import AutoModelForSequenceClassification

model = AutoModelForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=2)
```

这里的 `AutoModelForSequenceClassification` 就是为 **文本分类** 封装好的模型头。

---

#### 微调训练（使用 Trainer）

```python
from transformers import Trainer, TrainingArguments

training_args = TrainingArguments(
    output_dir="./results",
    evaluation_strategy="epoch",
    per_device_train_batch_size=8,
    num_train_epochs=3,
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,  # 🤗 datasets 格式
    eval_dataset=eval_dataset,
)

trainer.train()
```


### 1.4 pipeline 参数

```python
def pipeline(
    task: Optional[str] = None,
    model: Optional[Union[str, "PreTrainedModel", "TFPreTrainedModel"]] = None,
    config: Optional[Union[str, PretrainedConfig]] = None,
    tokenizer: Optional[Union[str, PreTrainedTokenizer, "PreTrainedTokenizerFast"]] = None,
    feature_extractor: Optional[Union[str, PreTrainedFeatureExtractor]] = None,
    image_processor: Optional[Union[str, BaseImageProcessor]] = None,
    processor: Optional[Union[str, ProcessorMixin]] = None,
    framework: Optional[str] = None,
    revision: Optional[str] = None,
    use_fast: bool = True,
    token: Optional[Union[str, bool]] = None,
    device: Optional[Union[int, str, "torch.device"]] = None,
    device_map: Optional[Union[str, dict[str, Union[int, str]]]] = None,
    torch_dtype: Optional[Union[str, "torch.dtype"]] = "auto",
    trust_remote_code: Optional[bool] = None,
    model_kwargs: Optional[dict[str, Any]] = None,
    pipeline_class: Optional[Any] = None,
    **kwargs: Any,
) -> Pipeline:
    pass
```

| 参数                  | 类型                                                | 含义                                                                |
| ------------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| `task`              | `str`                                             | 指定任务类型，如 `"text-generation"`, `"summarization"` 等。                |
| `model`             | `str` \| `PreTrainedModel` \| `TFPreTrainedModel` | 模型 ID 或模型实例。若不传，会加载 `task` 的默认模型。                                 |
| `config`            | `str` \| `PretrainedConfig`                       | 模型配置对象或 ID。控制模型结构和超参数。                                            |
| `tokenizer`         | `str` \| `PreTrainedTokenizer`                    | 文本分词器，用于 NLP 任务。                                                  |
| `feature_extractor` | `str` \| `PreTrainedFeatureExtractor`             | 特征提取器（用于语音/图像输入）。                                                 |
| `image_processor`   | `str` \| `BaseImageProcessor`                     | 图像预处理器。                                                           |
| `processor`         | `str` \| `ProcessorMixin`                         | 多模态输入的预处理器（比如图文结合）。                                               |
| `revision`          | `str`                                             | 模型版本（Git 分支/Tag/Commit ID），默认 `"main"`。                           |
| `use_fast`          | `bool`                                            | 是否使用快速分词器（`tokenizers` Rust 实现）。                                  |
| `token`             | `str` \| `bool`                                   | Hugging Face Hub 授权 token（True 表示使用 `hf auth login` 里的 token）。    |
| `device`            | `int` \| `str` \| `torch.device`                  | 指定运行设备，如 `"cpu"`, `"cuda:0"`, `"mps"`（Mac M1/M2）。                 |
| `device_map`        | `str` \| `dict`                                   | 大模型的分布式部署策略（Accelerate 库支持）。                                      |
| `torch_dtype`       | `str` \| `torch.dtype`                            | PyTorch 精度类型，支持 `"float32"`, `"float16"`, `"bfloat16"`, `"auto"`。 |
| `trust_remote_code` | `bool`                                            | 是否允许执行 Hugging Face Hub 上的自定义 Python 代码。                          |
| `model_kwargs`      | `dict`                                            | 额外传递给 `from_pretrained` 的参数（如 `low_cpu_mem_usage=True`）。          |
| `pipeline_class`    | `Any`                                             | 强制指定要使用的 `Pipeline` 类。                                            |
| `kwargs`            | `dict`                                            | 传递给具体 pipeline 的其他参数（不同任务支持不同）。                                   |

---


#### `task`（任务类型枚举）

| 取值                                               | 对应 Pipeline                           | 功能              |
| ------------------------------------------------ | ------------------------------------- | --------------- |
| `"text-generation"`                              | `TextGenerationPipeline`              | 文本生成（如 GPT 模型）。 |
| `"text2text-generation"`                         | `Text2TextGenerationPipeline`         | 文本到文本生成（如 T5）。  |
| `"summarization"`                                | `SummarizationPipeline`               | 文本摘要。           |
| `"translation_xx_to_yy"`                         | `TranslationPipeline`                 | 翻译（xx→yy）。      |
| `"text-classification"` / `"sentiment-analysis"` | `TextClassificationPipeline`          | 文本分类/情感分析。      |
| `"token-classification"` / `"ner"`               | `TokenClassificationPipeline`         | 命名实体识别。         |
| `"question-answering"`                           | `QuestionAnsweringPipeline`           | 问答。             |
| `"fill-mask"`                                    | `FillMaskPipeline`                    | 掩码填充（BERT 类模型）。 |
| `"feature-extraction"`                           | `FeatureExtractionPipeline`           | 提取向量表示。         |
| `"zero-shot-classification"`                     | `ZeroShotClassificationPipeline`      | 零样本文本分类。        |
| `"automatic-speech-recognition"`                 | `AutomaticSpeechRecognitionPipeline`  | 语音转文本。          |
| `"text-to-audio"` / `"text-to-speech"`           | `TextToAudioPipeline`                 | 文本转语音。          |
| `"audio-classification"`                         | `AudioClassificationPipeline`         | 音频分类。           |
| `"zero-shot-audio-classification"`               | `ZeroShotAudioClassificationPipeline` | 零样本音频分类。        |
| `"image-classification"`                         | `ImageClassificationPipeline`         | 图像分类。           |
| `"object-detection"`                             | `ObjectDetectionPipeline`             | 目标检测。           |
| `"image-segmentation"`                           | `ImageSegmentationPipeline`           | 图像分割。           |
| `"image-to-text"`                                | `ImageToTextPipeline`                 | 图像描述。           |
| `"image-to-image"`                               | `ImageToImagePipeline`                | 图像到图像转换。        |
| `"zero-shot-image-classification"`               | `ZeroShotImageClassificationPipeline` | 零样本图像分类。        |
| `"zero-shot-object-detection"`                   | `ZeroShotObjectDetectionPipeline`     | 零样本目标检测。        |
| `"document-question-answering"`                  | `DocumentQuestionAnsweringPipeline`   | 文档问答。           |
| `"table-question-answering"`                     | `TableQuestionAnsweringPipeline`      | 表格问答。           |
| `"video-classification"`                         | `VideoClassificationPipeline`         | 视频分类。           |
| `"visual-question-answering"`                    | `VisualQuestionAnsweringPipeline`     | 视觉问答。           |
| `"mask-generation"`                              | `MaskGenerationPipeline`              | 生成图像掩码。         |
| `"depth-estimation"`                             | `DepthEstimationPipeline`             | 深度估计。           |
| `"image-feature-extraction"`                     | `ImageFeatureExtractionPipeline`      | 提取图像 embedding。 |
| `"image-text-to-text"`                           | `ImageTextToTextPipeline`             | 图像+文本 → 文本。     |

---

#### `framework`（框架枚举）

| 取值     | 含义               |
| ------ | ---------------- |
| `"pt"` | 使用 PyTorch       |
| `"tf"` | 使用 TensorFlow    |
| `None` | 自动检测（优先 PyTorch） |

---

#### `device_map`（设备分配策略）

| 取值             | 含义                                         |
| -------------- | ------------------------------------------ |
| `"auto"`       | 使用 Accelerate 自动推理设备分配（大模型分片到 CPU/GPU/磁盘）。 |
| `"sequential"` | 按层顺序分配。                                    |
| `"balanced"`   | 尽量均衡分配。                                    |
| `dict`         | 手动指定每层放在哪个设备。                              |

---

#### `torch_dtype`（精度类型）

| 取值              | 含义                        |
| --------------- | ------------------------- |
| `"float32"`     | 单精度，最高精度，显存占用大。           |
| `"float16"`     | 半精度，常用于推理，加速 & 节省显存。      |
| `"bfloat16"`    | bfloat16 精度，兼容 TPU/新 GPU。 |
| `"auto"`        | 自动选择（根据模型权重 & 硬件）。        |
| `torch.float16` | 等价于 `"float16"`。          |


## 2. 使用示例

学习资料:
1. [吴恩达老师 Huggingface 课程](https://www.bilibili.com/video/BV1UQt9zsEUx/?p=4&vd_source=e51cd6df2226be5b731e6a1a575eb5b2)
2. [课程代码](https://github.com/ksm26/Open-Source-Models-with-Hugging-Face)

### 2.1 对话
Natural Language Processing

```python
from transformers import pipeline
from transformers import Conversation
# conversational 现版本叫 text-generation
chatbot = pipeline(task="conversational",
                   model="facebook/blenderbot-400M-distill")
user_message = """
What are some fun activities I can do in the winter?
"""
conversation = Conversation(user_message)
conversation = chatbot(conversation)
# Add a message to the conversation
conversation.add_message(
    {"role": "user",
     "content": """What else do you recommend?"""
    })
conversation = chatbot(conversation)
```

### 2.2 翻译和摘要
Translation and Summarization

```python
# 翻译
from transformers import pipeline
# Create the translator pipeline using a model from Meta
translator = pipeline(task="translation",
                      model="facebook/nllb-200-distilled-600M",
                      torch_dtype=torch.bfloat16)
text = """\
My puppy is adorable, 
Your kitten is cute.
Her panda is friendly.
His llama is thoughtful. 
We all have nice pets!"""

text_translated = translator(text,
                             src_lang="eng_Latn",
                             tgt_lang="fra_Latn")

# summary
summarizer = pipeline(task="summarization",
                      model="facebook/bart-large-cnn",
                      torch_dtype=torch.bfloat16)
text = """Paris is the capital and most populous city of France, with
          an estimated population of 2,175,601 residents as of 2018,
          in an area of more than 105 square kilometres (41 square
          miles). The City of Paris is the centre and seat of
          government of the region and province of Île-de-France, or
          Paris Region, which has an estimated population of
          12,174,880, or about 18 percent of the population of France
          as of 2017."""
summary = summarizer(text,
                     min_length=10,
                     max_length=100)
```


### 2.3 embedding 和文本相似度检测
Sentence Embeddings

```python
from sentence_transformers import SentenceTransformer
from sentence_transformers import util

model = SentenceTransformer("all-MiniLM-L6-v2")

sentences1 = ['The cat sits outside',
              'A man is playing guitar',
              'The movies are awesome']
embeddings1 = model.encode(sentences1, convert_to_tensor=True)

sentences2 = ['The dog plays in the garden',
              'A woman watches TV',
              'The new movie is so great']
embeddings2 = model.encode(sentences2, 
                           convert_to_tensor=True)

# 余旋相似度
cosine_scores = util.cos_sim(embeddings1,embeddings2)
for i in range(len(sentences1)):
    print("{} \t\t {} \t\t Score: {:.4f}".format(sentences1[i],
                                                 sentences2[i],
                                                 cosine_scores[i][i]))
```

### 2.4 零样本音频分类

Zero-Shot Audio Classification

```python
from datasets import load_dataset, load_from_disk
from datasets import Audio

dataset = load_dataset("ashraq/esc50",
                      split="train[0:10]")
# dataset = load_from_disk("./models/ashraq/esc50/train")
audio_sample = dataset[0]
# 查看音频采样率
audio_sample["audio"]["sampling_rate"]

zero_shot_classifier = pipeline(
    task="zero-shot-audio-classification",
    model="./models/laion/clap-htsat-unfused")
# 模型支持的采样率
print(zero_shot_classifier.feature_extractor.sampling_rate)

# 采样率对其
dataset = dataset.cast_column(
    "audio",
     Audio(sampling_rate=48_000))

# 音频分类

candidate_labels = ["Sound of a dog",
                    "Sound of vacuum cleaner"]
zero_shot_classifier(audio_sample["audio"]["array"],
                     candidate_labels=candidate_labels)
# 音频分类概率
# [{'score': 0.9985589385032654, 'label': 'Sound of a dog'},
#  {'score': 0.0014411062002182007, 'label': 'Sound of vacuum cleaner'}]
```


### 2.5 ASR（自动语音识别）
Automatic Speech Recognition

```python
from transformers import pipeline

from datasets import load_dataset
dataset = load_dataset("librispeech_asr",
                       split="train.clean.100",
                       streaming=True,
                       trust_remote_code=True)
# openAI whisper 模型
asr = pipeline(task="automatic-speech-recognition",
               model="distil-whisper/distil-small.en")

# 对其采样率
asr.feature_extractor.sampling_rate
example['audio']['sampling_rate']

# 语音转文字
asr(example["audio"]["array"])["text"]
# 分块并行处理
asr(
    audio_16KHz,
    chunk_length_s=30, # 30 seconds
    batch_size=4,
    return_timestamps=True,
)["text"]
```

### 2.6 TTS（文本转语音）
Text to Speech

```python
from transformers import pipeline

narrator = pipeline("text-to-speech",
                    model="kakao-enterprise/vits-ljs")
narrated_text = narrator(text)

from IPython.display import Audio as IPythonAudio

IPythonAudio(narrated_text["audio"][0],
             rate=narrated_text["sampling_rate"])
```

### 2.7 物体检测
Object Detection

```python
from transformers import pipeline
od_pipe = pipeline("object-detection", "facebook/detr-resnet-50")
```

### 2.8 图像分割(抠图)
Image Segmentation

```python
from transformers import pipeline
sam_pipe = pipeline("mask-generation",
    "Zigeng/SlimSAM-uniform-77")
```

