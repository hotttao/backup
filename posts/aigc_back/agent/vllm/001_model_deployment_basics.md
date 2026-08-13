---
weight: 1
title: "大模型私有化部署（一）：部署的到底是什么"
date: 2026-08-12T20:00:00+08:00
lastmod: 2026-08-12T20:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "以 MiniMax H3 为例，理解模型代码、配置、权重、预后处理和推理运行时。"
featuredImage:

tags: ["vllm", "大模型部署", "FDE"]
categories: ["AIGC"]

lightgallery: true
---

本文是私有化部署型 FDE 学习记录的第一部分。我们以 MiniMax H3 建立理论上的部署心智模型，最终使用 VoxCPM 完成一次可复现的实际部署。

<!-- more -->

## 1. 学习路线

```text
模型是什么
→ 张量、参数与精度
→ Transformer / VAE
→ 磁盘、RAM、显存映射
→ 一次推理如何执行
→ 显存如何估算
→ 量化与 CPU Offload
→ 多 GPU 与通信
→ 推理引擎与服务化
→ VoxCPM 实际部署
→ 监控、压测与故障排查
```

## 2. 部署包的五个部分

模型部署包不只是一个模型文件，而是五类内容的组合：

```text
模型部署
├── 代码：定义计算过程
├── 配置：描述模型结构
├── 权重：模型训练得到的参数
├── 预处理/后处理：在人类数据和张量之间转换
└── 推理运行时：执行计算并管理硬件资源
```

### 2.1 模型代码

代码定义有哪些层、组件怎样连接，以及张量如何流动。极度简化的伪代码如下：

```python
class Model:
    def forward(self, input):
        x = preprocess(input)
        x = encoder(x)

        for block in self.transformer_blocks:
            x = block(x)

        output = decoder(x)
        return postprocess(output)
```

仅有代码不能得到训练后的能力，因为代码中还没有模型学到的参数。

### 2.2 模型配置

配置文件通常包含模型的结构参数，例如：

```json
{
  "hidden_size": 4096,
  "num_hidden_layers": 32,
  "num_attention_heads": 32,
  "vocab_size": 128000,
  "torch_dtype": "bfloat16"
}
```

代码定义“怎么搭”，配置定义“搭多大”。

### 2.3 模型权重

权重是模型训练得到的大量矩阵，例如：

```text
embedding.weight                 [128000, 4096]
layers.0.attention.q_proj.weight [4096, 4096]
layers.0.attention.k_proj.weight [1024, 4096]
layers.0.mlp.up_proj.weight      [14336, 4096]
```

它们通常保存在多个 `safetensors` 文件中：

```text
model-00001-of-00020.safetensors
model-00002-of-00020.safetensors
model.safetensors.index.json
```

`safetensors` 保存的是张量数据，不是可以独立执行的程序。

### 2.4 预处理与后处理

GPU 不能直接理解文字、图像和声音，只能处理数值张量。文本模型首先使用 tokenizer：

```text
“你好”
  ↓ tokenizer
[108386, 451]
  ↓ embedding
浮点数张量
```

H3 是全模态音视频生成模型，其流程可暂时抽象为：

```text
文本 / 图片 / 视频 / 音频
          ↓
各模态预处理和编码
          ↓
条件表示 conditioning
          ↓
H3-Omni Transformer
          ↓
音视频 latent
          ↓
H3-VAE 解码
          ↓
视频帧与音频
          ↓
封装为视频文件
```

`latent` 是经过压缩、适合模型计算的表示。VAE 负责在原始数据和 latent 之间转换：

```text
原始音视频 ──VAE Encoder──> 压缩 latent
压缩 latent ──VAE Decoder──> 原始音视频
```

### 2.5 推理运行时

常见运行时或模型框架包括：

- PyTorch
- Transformers
- Diffusers
- vLLM
- SGLang
- TensorRT-LLM
- llama.cpp

它们负责创建张量、加载权重、选择计算 kernel、管理内存、调度请求，以及进行多 GPU 通信。同一个模型采用不同运行时，速度、内存占用和并发能力可能明显不同。

## 3. 模型从磁盘到运行的过程

```text
模型仓库
   ↓ 下载
本地磁盘
   ↓ 读取
CPU RAM
   ↓ 加载或复制
GPU VRAM
   ↓ 执行算子
中间张量
   ↓
最终输出
```

| 位置 | 用途 | 特点 |
| --- | --- | --- |
| 磁盘 | 长期保存权重 | 容量大、速度较慢 |
| CPU RAM | 加载、缓存、CPU offload | 比磁盘快 |
| GPU VRAM | 存放 GPU 权重和计算张量 | 容量较小、带宽高 |
| CPU/GPU Cache | 芯片当前使用的数据 | 极快、容量极小 |

一个 20 GB 的权重文件并不意味着 20 GB 显存一定可以运行，因为还需要容纳中间激活、输入输出张量、Attention 工作区、框架开销、视频 latent 和 VAE 解码工作区等内容。

## 4. 权重大小的基础公式

```text
权重理论大小 = 参数数量 × 每个参数的字节数
```

| 精度 | 每参数理论大小 |
| --- | ---: |
| FP32 | 4 字节 |
| FP16 | 2 字节 |
| BF16 | 2 字节 |
| INT8 | 1 字节 |
| INT4 | 约 0.5 字节，另有量化元数据 |

例如 10B 参数模型：

```text
FP32：10B × 4 bytes ≈ 40 GB
BF16：10B × 2 bytes ≈ 20 GB
INT8：10B × 1 byte  ≈ 10 GB
INT4：10B × 0.5 byte ≈ 5 GB
```

这只是权重下限，而不是推理所需总内存。

## 5. 练习与复盘

### 问题

1. 一个 7B 参数的 BF16 模型，权重理论大小约是多少？
2. 为什么一个 20 GB 的模型文件不代表 20 GB 显存一定能运行？
3. 模型下载并加载到 GPU 时，模型仓库、磁盘、CPU RAM、GPU VRAM 的顺序是什么？

### 回答

1. `14 GB`。
2. 模型文件只代表运行内存的一个下限，加载和运行还会产生中间数据。
3. `模型仓库 → 磁盘 → CPU RAM → GPU VRAM`。

三个答案均正确。更完整的推理内存关系是：

```text
推理内存
≈ 权重
+ 中间激活
+ 输入/输出张量
+ Attention 工作区
+ 框架与设备开销
+ 缓存
```

`7B × 2 bytes ≈ 14 GB` 使用十进制单位；换算成二进制单位约为 `13.0 GiB`。
