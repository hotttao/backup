---
weight: 1
title: "Pocket Flow 实现 Deep Coder"
date: 2026-05-01T10:00:00+08:00
lastmod: 2026-05-01T10:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Pocket Flow 流的抽象"
featuredImage:

tags: ["工程实践"]
categories: ["Agent"]

lightgallery: true
---

前面我们介绍了 Pocket Flow 这个 Agent Framework。今天我们来介绍一个基于 Pocket Flow 实现的工具 Deep Coder。

目的有如下几个:

1. 学习 Pocket Flow 的使用
2. 学习如何设计和实现一个 Workflow
3. 学习提示词的设计

<!-- more -->

## 1. Deep Coder 简介

Deep Coder 是一个基于 OpenAPI 生成通用代码的工具。这个 Workflow 遵循跟人类 Coder 一样的开发流程

```mermaid
graph LR
    subgraph Flow
        N2["RequirementAnalysisNode<br/>需求分析"]
        N3["AskClarificationNode<br/>询问澄清"]
        N4["ReadApiDocNode<br/>阅读接口文档"]
        N5["WriteDesignDocNode<br/>编写设计文档"]
        N6["WriteCodeNode<br/>代码编写"]
        N7["ExportToFileNode<br/>导出文件"]

        N2 --> N3
        N3 --> N2
        N2 --> N4
        N4 --> N5
        N5 --> N6
        N6 --> N7
    end
```

这里面比较复杂的节点是 N4，思想类似于 skills，通过文档分级和索引，分步骤缩小搜索范围，最终找到完成用户需求所需要的文档。
