---
weight: 6
title: "大模型私有化部署（六）：一次推理中的 RAM 与 VRAM 生命周期"
date: 2026-08-12T22:00:00+08:00
lastmod: 2026-08-12T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "沿 H3 推理时间线理解磁盘、CPU RAM、GPU VRAM、权重、激活、latent 和工作区的生命周期。"
featuredImage:

tags: ["vllm", "大模型部署", "显存", "FDE"]
categories: ["AIGC"]

lightgallery: true
---

本节不再增加新的模型结构，而是沿一次 H3 请求的时间线，观察模型文件、权重、输入、conditioning、latent、激活和输出分别位于哪里、何时创建、何时释放。

<!-- more -->

## 1. 先区分四种容量

部署模型时经常同时看到四种容量：

| 资源 | 典型内容 | 是否断电保留 |
| --- | --- | --- |
| 磁盘 | 权重文件、配置、输入和输出文件 | 是 |
| CPU RAM | 模型加载缓冲、CPU 权重、预处理数据、offload | 否 |
| GPU VRAM | GPU 权重、激活、latent、工作区 | 否 |
| Swap | RAM 不足时换出的内存页 | 否，不能当作高性能 RAM |

磁盘容量足够，只说明模型文件能够下载；RAM 足够，只说明模型可能能够被 CPU 加载；VRAM 足够，才可能让目标 GPU 执行方案运行。

```text
能下载 ≠ 能加载 ≠ 能推理 ≠ 能达到生产性能
```

## 2. 两种生命周期

运行模型服务时，应区分服务生命周期和请求生命周期。

### 2.1 服务生命周期

从服务启动到服务退出：

```text
启动进程
→ 读取配置
→ 构建模型
→ 加载权重
→ 初始化运行时
→ 接收多个请求
→ 退出并释放资源
```

模型权重通常属于服务级资源，可以被多个请求复用。

### 2.2 请求生命周期

每次用户生成视频：

```text
接收输入
→ 预处理
→ 构造 conditioning
→ 创建 latent
→ 多步生成
→ VAE 解码
→ 后处理和编码
→ 返回文件
→ 清理请求数据
```

conditioning、latent、中间激活和输出帧通常属于请求级资源。并发请求越多，请求级资源越可能叠加。

## 3. 阶段零：模型仍在远程仓库

初始状态：

```text
远程模型仓库
├── config
├── 权重分片
├── tokenizer / processor
└── 推理代码
```

本机只需要很少的下载程序内存。此时模型主要占远程存储，还没有占用本机磁盘、RAM 或 VRAM。

## 4. 阶段一：下载到本地磁盘

```text
远程仓库
   ↓ 网络下载
本地缓存目录 / 模型目录
```

主要资源变化：

```text
磁盘：增加
RAM：只有下载缓冲等少量临时占用
VRAM：不变
```

需要额外预留：

- 临时下载文件；
- 断点续传文件；
- 多个模型版本；
- Docker 镜像；
- 输出视频和日志。

所以 60 GB 权重不代表准备 60 GB 空闲磁盘就足够，工程上通常需要明显更多余量。

## 5. 阶段二：创建模型骨架

运行时先根据代码和配置创建模型对象：

```text
config
  ↓
模型结构
├── 编码器
├── Transformer Blocks
├── VAE
└── 其他组件
```

朴素方式可能先在 CPU 上为所有参数分配内存，再加载权重：

```text
创建随机/空参数
       ↓
读取 checkpoint
       ↓
复制 checkpoint 数值到参数
```

这可能在加载瞬间出现两份数据：

```text
模型参数内存 + checkpoint 加载缓冲
```

更节省内存的加载方法会使用：

- meta device 创建不分配真实数据的参数骨架；
- safetensors 内存映射；
- low CPU memory loading；
- 按分片逐步加载；
- 直接加载到目标 device。

部署故障有时发生在“模型尚未开始推理”的加载阶段。

## 6. 阶段三：权重进入 CPU RAM 和 GPU VRAM

### 6.1 全部放入 GPU

```text
磁盘权重
  ↓
CPU RAM
  ↓ PCIe
GPU VRAM
```

稳定运行后可能是：

```text
CPU RAM
├── Python 进程
├── tokenizer / processor
├── 文件缓存
└── 少量请求数据

GPU VRAM
├── 全部模型权重
├── CUDA context
└── 运行时预留内存
```

CPU 中是否仍保留完整权重副本取决于加载实现。不能默认权重复制到 GPU 后，RAM 中一定没有副本。

### 6.2 CPU Offload

显存不足时，可以只把当前需要的组件或层放入 GPU：

```text
CPU RAM：大部分权重
GPU VRAM：当前层/当前组件权重
```

计算过程可能变成：

```text
Layer 0：RAM → VRAM → 计算 → 卸载
Layer 1：RAM → VRAM → 计算 → 卸载
...
```

优点：降低 VRAM 门槛。

代价：

- 需要更大的 RAM；
- 权重反复经过 PCIe；
- 推理速度可能大幅下降；
- 传输和计算的同步更复杂。

### 6.3 阶段式组件加载

多模态生成管线中的组件不一定需要同时驻留 GPU：

```text
条件编码阶段：编码器在 GPU
生成阶段：Transformer 在 GPU
解码阶段：VAE 在 GPU
```

若框架支持，可以在阶段之间切换组件，从而降低峰值显存。

## 7. 阶段四：接收并预处理请求

假设请求包含 prompt、参考图片、视频和音频：

```text
网络请求
  ↓
上传文件写入内存或临时磁盘
  ↓
CPU 解码和规范化
  ↓
CPU 输入张量
```

此时主要增加的是：

```text
磁盘：可选的上传临时文件
RAM：解码后的图像帧、视频帧、音频波形
VRAM：尚未增加，或只有预处理加速数据
```

压缩文件很小，不代表解码后也很小。例如一个 MP4 文件在磁盘上可能只有几十 MB，但解码为大量 RGB 帧后可能占用数百 MB 或数 GB RAM。

粗略计算一段未压缩 RGB 视频帧：

```text
字节数
≈ frames × height × width × channels × 每通道字节数
```

例如 120 帧、1920×1080、RGB uint8：

```text
120 × 1920 × 1080 × 3 × 1
= 746,496,000 bytes
≈ 712 MiB
```

这还不包括音频、临时副本和转换成浮点张量后的膨胀。

## 8. 阶段五：生成 Conditioning

预处理张量进入相应编码器：

```text
输入张量
  ↓ 编码器权重
编码器中间激活
  ↓
conditioning
```

这一阶段 VRAM 中可能同时存在：

```text
编码器权重
+ 输入张量
+ 编码器激活
+ conditioning
+ kernel workspace
```

编码完成后：

- 输入 GPU 张量可以释放；
- 编码器临时激活可以释放；
- conditioning 需要保留到生成完成；
- 编码器权重可以继续驻留或卸载。

这里体现了生命周期的重要性：不是所有创建过的张量都必须保留到请求结束。

## 9. 阶段六：创建初始 latent

根据任务创建初始 latent：

```text
T2V：随机 latent
I2V/V2V：由输入编码、加噪或变换得到的 latent
```

此时 VRAM 可能是：

```text
Transformer 权重
+ conditioning
+ 当前 latent
+ 调度器/时间步状态
+ 运行时开销
```

latent 大小通常随以下变量增长：

```text
batch
帧数
latent 高度
latent 宽度
latent channels
dtype 字节数
```

## 10. 阶段七：Transformer 多步更新

每一个生成步骤可以简化为：

```text
当前 latent + conditioning + step
               ↓
        Transformer 前向
               ↓
       本步预测 / 更新量
               ↓
          更新 latent
```

在某一步内部，VRAM 中可能同时存在：

```text
模型权重（长期）
conditioning（请求级）
当前 latent（请求级）
Q/K/V（本层临时激活）
Attention 中间结果（临时）
MLP 中间激活（临时）
本步输出（临时或请求级）
kernel workspace（临时）
```

一层计算完成后，许多中间激活可以释放或复用；但下一生成步骤还要再次执行 Transformer。

要区分：

```text
峰值显存：某一瞬间同时存活的数据总和
累计计算量：所有生成步骤计算工作的总和
```

执行 30 步不意味着需要同时保存 30 份完整激活。推理模式通常不会像训练反向传播那样保留每一步的全部计算图。它主要增加总计算时间，而不一定让显存乘以 30。

## 11. 阶段八：VAE 解码

生成得到最终 latent 后，需要解码为高分辨率音视频：

```text
最终 latent
  ↓ VAE Decoder
高分辨率视频帧 + 音频
```

如果没有卸载 Transformer，VRAM 可能同时存在：

```text
Transformer 权重
+ VAE 权重
+ conditioning
+ 最终 latent
+ VAE 解码激活
+ 解码输出张量
```

这可能成为新的显存峰值。因此常见优化包括：

- 生成完成后卸载 Transformer；
- VAE tiling：分块解码空间区域；
- VAE slicing：分批解码 batch；
- 将部分解码过程放在 CPU；
- 解码完成一部分就转移到 RAM。

分块通常降低峰值显存，但会增加运行时间，并可能引入边界处理复杂性。

## 12. 阶段九：后处理和封装

GPU 结果复制到 CPU：

```text
GPU 视频/音频张量
   ↓ device-to-host copy
CPU RAM
   ↓ 数值、色彩、格式转换
FFmpeg 编码和封装
   ↓
磁盘 MP4
```

此时资源变化可能是：

```text
VRAM：输出被复制后可逐步释放
RAM：暂时持有原始帧、音频和编码缓冲
CPU：执行视频编码
磁盘：写入最终文件
```

如果一次性在 RAM 中保存所有未压缩帧，可能造成 RAM 峰值。更稳健的方式是边生成/边解码/边编码，使用有界缓冲区。

## 13. 阶段十：请求结束和内存回收

请求完成后，通常应释放：

```text
conditioning
latent
输入 GPU 张量
输出 GPU 张量
临时 CPU 帧
上传临时文件
```

模型权重通常保留，以服务下一请求。

注意以下三个概念不同：

```text
张量已无引用：程序可以回收
框架 allocator 已缓存：显存仍显示被进程 reserved
显存归还操作系统/驱动：监控中占用才可能下降
```

例如 PyTorch 为提升性能，会缓存已释放的显存块供后续张量复用。因此 `nvidia-smi` 显示的进程占用不一定等于当前存活张量大小。

常见指标：

```python
torch.cuda.memory_allocated()      # 当前张量实际占用
torch.cuda.memory_reserved()       # PyTorch allocator 已预留
torch.cuda.max_memory_allocated()  # 历史峰值实际占用
```

调用 `empty_cache()` 只能尝试把未使用的缓存块归还给 CUDA allocator/驱动，不能释放仍被 Python 对象引用的张量。

## 14. 一张完整时间线

| 阶段 | 磁盘 | CPU RAM | GPU VRAM |
| --- | --- | --- | --- |
| 下载 | 权重增加 | 下载缓冲 | 基本不变 |
| 加载 | 读取权重 | 权重和加载缓冲 | 权重逐步增加 |
| 预处理 | 输入临时文件 | 解码帧和音频 | 可选预处理张量 |
| 条件编码 | 不变 | CPU 输入 | 编码器权重、激活、conditioning |
| 生成 | 不变 | offload 权重等 | Transformer、conditioning、latent、激活 |
| VAE 解码 | 不变 | 可选 offload | VAE、latent、解码激活、输出 |
| 封装 | 写入 MP4 | 原始帧和编码缓冲 | 输出逐步释放 |
| 请求结束 | 保留结果 | 请求数据释放 | 请求数据释放，权重保留 |

## 15. 为什么会 OOM

OOM 不是只由“模型太大”造成。常见原因包括：

```text
权重本身放不下
加载时出现双份权重
输入分辨率或帧数过大
batch 或并发过高
Attention/算子需要较大工作区
VAE 解码激活达到峰值
旧请求张量仍被引用
显存碎片导致找不到足够大的连续块
框架版本选择了内存效率较差的 kernel
```

排查时需要知道 OOM 发生在哪个阶段，而不是只看总显存。

## 16. 本节练习

1. 模型权重通常属于服务级资源还是请求级资源？conditioning 和 latent 呢？
2. 一个 100 MiB 的 MP4 文件为什么解码后可能占用远大于 100 MiB 的 RAM？
3. 执行 30 个生成步骤，为什么通常不意味着需要同时保存 30 份完整激活？
4. 为什么 VAE 解码阶段可能形成不同于 Transformer 阶段的新显存峰值？
5. `memory_allocated` 和 `memory_reserved` 的区别是什么？为什么请求结束后 `nvidia-smi` 中的显存可能没有明显下降？

> 本节练习尚未作答。回答后将在这里追加讲评。
