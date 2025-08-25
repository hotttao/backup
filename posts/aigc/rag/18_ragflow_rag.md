---
weight: 1
title: "RagFlow 增强 Rag"
date: 2025-08-20T11:00:00+08:00
lastmod: 2025-08-20T11:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "RagFlow 增强 Rag"
featuredImage: 

tags: ["RAG", "RagFlow"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

内容很多，我们先回顾一下，在介绍 do_handle_task 的处理流程时，我们总结了五个问题:
1. `TenantLLMService.model_instance` 如何实例化模型
2. 如何根据文档的类型选择不同的 chunker
3. **关键词生成**、**问题生成**、**文档内容打标签** 的执行流程
4. 如何 embedding
5. 文件如何上传，如何下载。更一步是解析后的 chunk 如何在 MinIO 和 ES 中存储

前两节我们介绍了1、2，这一节我们来介绍与 Rag 增强相关的 **关键词生成**、**问题生成**、**文档内容打标签**。