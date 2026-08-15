---
weight: 1
title: "Agent Skills 设计"
date: 2026-06-03T22:00:00+08:00
lastmod: 2026-06-03T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Agent Skills 设计"
featuredImage:

tags: ["agent 设计"]
categories: ["Agent"]

lightgallery: true
---

本节我们主要来了解 [Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) 的核心机制。

<!-- more -->

## 1. Skills

### 1.1 Skills 包含的内容

![skills 在什么位置](/images/aigc/agent_design/where_skills.png)

从图中可以看到一个 Skills 其实包含两部分内容:
1. 右侧 Skills 内容本身
2. 左边蓝色的部分是 skills 的元数据，即 skills 的名称和一个非常简短的描述，他们位于 System Prompt 里面，用于指导 Agent 如何使用Skills

### 1.2 Skills Spec

Skills 的唯一约束就是 Skills 目录下要包含一个 SKILL.md 的文件。这个文件有两个部分组成:

![skill spec](/images/aigc/agent_design/skill_spec.png)

1. 顶部yaml 格式定义的元数据:
    name: skills 的名称
    description: skills 的描述
2. 剩余的主体内容

剩余的主题内容以及 skills 目录还应该包含哪些内容都是松散的。

### 1.3 Skills 运行机制 - 按需加载

![skills 运行机制](/images/aigc/agent_design/addition_content.png)

skills 三层结构:
1. 第一层: 
    - skill.md入口文件里 yaml 深色部分
    - 始终会进入上下文
2. 第二层:
    - 浅色的skill.md的主体部分
    - 当主体部分不断的扩大，推荐按照内容相关性组织第三层
3. 第三层:
    - 黄色的这些引用文件也就是所谓的additional content

所以这是一个两层的懒加载。总共3层的文件结构。黄色部分也可以继续扩展到第四层。

skills技术规范，核心就是通过三层及以上的这种按需加载的能力，让agent可以比较高效的去把外部的拓展能力，给加载到自己的上下文来。通过懒加载的方式避免过度加载，也避免过多的内容去占满context

![load as need](/images/aigc/agent_design/load_as_need.png)