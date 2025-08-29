---
weight: 1
title: "prompts 基础"
date: 2025-07-14T9:00:00+08:00
lastmod: 2025-07-14T9:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "prompts 基础"
featuredImage: 

tags: ["prompts"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

## 1. 参考资料

prompts 最佳实践，目前找到了以下资料:
1. [吴恩达老师 chatgpt prompt engineering for developers](https://www.bilibili.com/video/BV1e8411o7NP/?vd_source=e51cd6df2226be5b731e6a1a575eb5b2) 对应中文版的翻译 [llm-cookbook](https://datawhalechina.github.io/llm-cookbook/#/)
2. [gemini for google workspace prompting guide](https://services.google.com/fh/files/misc/gemini-for-google-workspace-prompting-guide-101.pdf)

### 1.1 两个原则
chatgpt prompt engineering for developers 提出了设计高效 Prompt 的两个关键原则：
1. 编写清晰、具体的指令
    - 使用分隔符清晰地表示输入的不同部分
    - 寻求结构化的输出
    - 要求模型检查是否满足条件
    - 提供少量示例
2. 给模型时间去思考
    - 指定完成任务所需的步骤
    - 指导模型在下结论之前找出一个自己的解法

### 1.2 PTCF四要素
谷歌提出结构化提示词设计方法 **PTCF**，覆盖四大核心要素：  
- **P（Persona）角色设定**：指定AI扮演的专业角色（如“环境科学文献分析专家”），提升回答的专业性。  
- **T（Task）任务描述**：明确具体任务，使用动作动词（如“分析”“总结”“生成表格”）。  
- **C（Context）背景信息**：提供任务背景（如论文主题、目标读者、数据来源），确保输出针对性。  
- **F（Format）输出格式**：指定结构化输出（如Markdown表格、JSON、限字数段落）。

> **示例**（学术场景）：  
> “作为农业经济学专家，分析近五年气候变化对粮食安全的英文文献，输出包含标题、作者、年份的Markdown表格，并附400字综述。”


## 2. meta prompt

meta prompt 元提示词，用于生成提示词。我们来看OpenAI在Playground工具新中增[Meta-Prompt功能](https://platform.openai.com/docs/guides/prompt-generation?context=text-out)
