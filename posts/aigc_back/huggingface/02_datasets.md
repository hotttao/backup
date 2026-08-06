---
weight: 1
title: "Huggingface Datasets"

date: 2025-07-16T9:00:00+08:00
lastmod: 2025-07-16T9:00:00+08:00
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

Hugging Face Datasets 是一个高效、可扩展的数据处理库，主要用于 NLP 和其他 ML 任务的数据管理与处理。它的核心目标是让数据 **易获取、易处理、可迭代、可复用**。

## 1. Datasets 的组成和结构

主要组成部分：

| 组件              | 描述                                                                        |
| --------------- | ------------------------------------------------------------------------- |
| **Dataset**     | 一个数据集对象，类似于 `pandas.DataFrame`，可以包含多条数据记录，每条记录是一个 dict。                   |
| **DatasetDict** | 多个 `Dataset` 的集合，通常用于训练/验证/测试分割。例如 `{'train': Dataset, 'test': Dataset}`。 |
| **Features**    | 描述数据的 schema（字段类型和结构）。类似于数据库的字段定义。                                        |
| **Arrow Table** | `datasets` 底层使用 Apache Arrow 作为存储和传输格式，高效处理大规模数据，支持列式存储和零拷贝操作。            |
| **Splits**      | 数据集分割，例如 `'train'`、`'validation'`、`'test'`。每个 split 本质上是一个 `Dataset`。     |
| **Metrics**     | 与数据集配套的评估指标（可选），通常通过 `evaluate` 库提供。                                      |

---

## 2. 核心抽象

理解 `datasets` 的核心抽象有助于高效使用：

### 2.1 Dataset

* **本质**：一张表格，每行是一个样本，每列是一个字段。
* **访问方式**：

  ```python
  dataset[0]         # 第一条记录
  dataset['text']    # 获取 text 列
  dataset[:10]       # 前10条记录
  ```

### 2.2 DatasetDict

* **本质**：多个 `Dataset` 的字典集合
* **用途**：训练/验证/测试分割
* **示例**：

  ```python
  dataset_dict = load_dataset("imdb")
  train_ds = dataset_dict["train"]
  test_ds = dataset_dict["test"]
  ```

### 2.3 Features

* 描述字段类型
* 内置类型：`Value('string')`、`Value('int32')`、`Sequence(Value('float32'))` 等
* 支持嵌套结构
* 示例：

  ```python
  from datasets import ClassLabel, Features, Value
  features = Features({
      'text': Value('string'),
      'label': ClassLabel(names=['neg', 'pos'])
  })
  ```

### 2.4 Arrow Table

* 底层存储使用 Apache Arrow
* 支持高效列操作、内存映射、大数据处理
* 使得数据可以**零拷贝**传给 PyTorch/TensorFlow

---

## 3. 如何使用 Datasets

### 3.1 安装

```bash
pip install datasets
```

### 3.2 加载公开数据集

```python
from datasets import load_dataset

# 加载 IMDB 数据集
dataset = load_dataset("imdb")
print(dataset)  # 输出 DatasetDict
```

### 3.3 查看数据

```python
print(dataset['train'][0])
print(dataset['train'].features)
```

### 3.4 数据处理

```python
train_texts = dataset['train']['text']

# map
def tokenize(batch):
    return {'input_ids': [len(x.split()) for x in batch['text']]}

tokenized_ds = dataset['train'].map(tokenize, batched=True)

# filter
small_train = dataset['train'].filter(lambda x: x['label'] == 1)

# 分割
train_test = dataset['train'].train_test_split(test_size=0.1)
```

### 3.5 与深度学习框架集成

#### PyTorch

```python
import torch

dataset.set_format(type='torch', columns=['input_ids', 'label'])
dataloader = torch.utils.data.DataLoader(dataset['train'], batch_size=8)
```

#### TensorFlow

```python
dataset.set_format(type='tensorflow', columns=['input_ids', 'label'])
tf_dataset = dataset['train'].to_tf_dataset(
    columns=['input_ids'],
    label_cols=['label'],
    batch_size=8
)
```

### 3.6 常见的 datasets

## 4. 核心对象
### 4.1 load_dataset

```python
def load_dataset(
    path: str,
    name: Optional[str] = None,
    data_dir: Optional[str] = None,
    data_files: Optional[Union[str, Sequence[str], Mapping[str, Union[str, Sequence[str]]]]] = None,
    split: Optional[Union[str, Split, list[str], list[Split]]] = None,
    cache_dir: Optional[str] = None,
    features: Optional[Features] = None,
    download_config: Optional[DownloadConfig] = None,
    download_mode: Optional[Union[DownloadMode, str]] = None,
    verification_mode: Optional[Union[VerificationMode, str]] = None,
    keep_in_memory: Optional[bool] = None,
    save_infos: bool = False,
    revision: Optional[Union[str, Version]] = None,
    token: Optional[Union[bool, str]] = None,
    streaming: bool = False,
    num_proc: Optional[int] = None,
    storage_options: Optional[dict] = None,
    **config_kwargs,
) -> Union[DatasetDict, Dataset, IterableDatasetDict, IterableDataset]:
    pass


dataset = load_dataset("ashraq/esc50",
                      split="train[0:10]")
```

| 参数                  | 类型                                                    | 默认值                       | 说明                                                                   |        |                                 |
| ------------------- | ----------------------------------------------------- | ------------------------- | -------------------------------------------------------------------- | ------ | ------------------------------- |
| `path`              | `str`                                                 | -                         | 数据集名称或本地路径，可为 HF Hub 上的数据集、本地目录或指定 builder 类型（如 `"csv"`、`"parquet"`） |        |                                 |
| `name`              | `Optional[str]`                                       | `None`                    | 数据集的子配置名称（某些数据集有多个配置）                                                |        |                                 |
| `data_dir`          | `Optional[str]`                                       | `None`                    | 数据所在目录，作用类似于 `data_files=所有文件`                                       |        |                                 |
| `data_files`        | \`Optional\[str                                       | Sequence\[str]            | Mapping\[str, Union\[str, Sequence\[str]]]]\`                        | `None` | 指定数据文件路径或列表，可为单文件、多文件或 split 映射 |
| `split`             | `Optional[Union[str, Split, list[str], list[Split]]]` | `None`                    | 指定加载的数据集分割，如 `'train'`，默认返回所有 split                                  |        |                                 |
| `cache_dir`         | `Optional[str]`                                       | `None`                    | 数据缓存目录，默认 `~/.cache/huggingface/datasets`                            |        |                                 |
| `features`          | `Optional[Features]`                                  | `None`                    | 指定字段类型 schema                                                        |        |                                 |
| `download_config`   | `Optional[DownloadConfig]`                            | `None`                    | 下载配置对象，控制下载行为                                                        |        |                                 |
| `download_mode`     | `Optional[Union[DownloadMode, str]]`                  | `REUSE_DATASET_IF_EXISTS` | 下载模式，可覆盖已有缓存                                                         |        |                                 |
| `verification_mode` | `Optional[Union[VerificationMode, str]]`              | `BASIC_CHECKS`            | 验证模式，检查数据完整性（校验和、大小、split 等）                                         |        |                                 |
| `keep_in_memory`    | `Optional[bool]`                                      | `None`                    | 是否将数据加载到内存中，默认根据 `datasets.config.IN_MEMORY_MAX_SIZE` 决定             |        |                                 |
| `save_infos`        | `bool`                                                | `False`                   | 是否保存数据集信息（infos.json）                                                |        |                                 |
| `revision`          | `Optional[Union[str, Version]]`                       | `None`                    | 指定 HF Hub 上的数据集版本，可使用 commit SHA 或 tag                               |        |                                 |
| `token`             | `Optional[Union[bool, str]]`                          | `None`                    | Bearer token，用于访问私有数据集，`True` 表示从本地读取 token                          |        |                                 |
| `streaming`         | `bool`                                                | `False`                   | 是否流式加载数据，不下载文件，返回 `IterableDataset`                                  |        |                                 |
| `num_proc`          | `Optional[int]`                                       | `None`                    | 本地生成数据集时使用的进程数，多进程处理                                                 |        |                                 |
| `storage_options`   | `Optional[dict]`                                      | `None`                    | 文件系统后端选项，实验性功能                                                       |        |                                 |
| `**config_kwargs`   | -                                                     | -                         | 传给 `DatasetBuilder` 的额外配置参数                                          |        |                                 |

