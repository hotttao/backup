---
weight: 1
title: "生产环境上的 Rag "
date: 2025-08-20T13:00:00+08:00
lastmod: 2025-08-20T13:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "生产环境上的 Rag"
featuredImage: 

tags: ["RAG"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

## 1. RAG 可观测性平台
RAG 可用的可观测性平台包括:
1. Phoenix
2. LangSmith  
3. Langfuse

系统监控工具: DataDog 和 Grafana。

## 2. 自定义数据集

创建包含系统处理过的系统提示词的自定义数据集，可以让你
1. 深入理解系统过去的表现
2. 通过在系统中重新运行，可以看到系统优化后，如何改变真实场景提示词上的性能

自定义数据集，应该包含 RAG 系统中每个组件的输出，这样可以评估系统中每一个组件的质量。

## 3. PDF Rag
