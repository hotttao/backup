---
weight: 1
title: "Claude Code Tool 设计"
date: 2026-04-02T22:00:00+08:00
lastmod: 2026-04-02T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Claude Code Context Compact"
featuredImage:

tags: ["Claude Code"]
categories: ["Agent"]

lightgallery: true
---

这一节我们来学习 [Claude Code Tool 设计](https://github.com/Yuyz0112/claude-code-reverse/blob/main/results/tools/)。

<!-- more -->

## 1. Edit Tool
Edit Tool 的核心需求是实现精准修改。

```yaml
name: Edit
description: >-
  对文件执行精确的字符串替换。


  使用方式：

  - 在对话中编辑之前，必须至少使用一次 `Read` 工具。
  如果尝试未读取文件就编辑，此工具将报错。

  - 使用 Read 工具输出的文本进行编辑时，请确保保留行号前缀之后显示的确切缩进（制表符/空格）。
  行号前缀格式为：空格 + 行号 + 制表符。制表符之后的所有内容才是要匹配的实际文件内容。
  切勿在 old_string 或 new_string 中包含行号前缀的任何部分。

  - 始终优先编辑代码库中已存在的文件。除非有明确要求，绝不编写新文件。

  - 仅在用户明确要求时使用emoji。除非被要求，避免向文件添加emoji。

  - 如果 `old_string` 在文件中不唯一，编辑将会失败。
  请提供包含更多周边上下文的更长字符串使其唯一，或使用 `replace_all` 更改每一处 `old_string`。

  - 使用 `replace_all` 在整个文件中替换和重命名字符串。该参数适用于例如重命名变量的场景。
input_schema:
  type: object
  properties:
    file_path:
      type: string
      description: 待修改文件的绝对路径
    old_string:
      type: string
      description: 要替换的文本
    new_string:
      type: string
      description: 用来替换的文本（必须与 old_string 不同）
    replace_all:
      type: boolean
      default: false
      description: 替换所有 old_string 的匹配项（默认为 false）
  required:
    - file_path
    - old_string
    - new_string
  additionalProperties: false
  $schema: http://json-schema.org/draft-07/schema#
```
