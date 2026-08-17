---
weight: 1
title: "一个持续更新的工具集"
date: 2026-03-25T12:00:00+08:00
lastmod: 2026-08-17T00:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "一个持续更新的工具集"
featuredImage:

tags: ["工具集"]
categories: ["工具集"]

lightgallery: true

toc:
  auto: false
---

本文按用途归类整理 Koala《科技周报》中介绍的工具。“发布时间”优先采用项目首次公开或对应版本正式发布的日期，并通过官方仓库、官网或作者发布记录核验；“Koala 给予的评价”是对字幕中观点的转述，不代表本文作者背书。原文已有但尚未进入本轮字幕与联网核验流程的条目，暂保留“原文未记录”标记。

## 备份与数据保护

| 工具名称 | 作用 | 发布时间 | Koala 给予的评价 | Koala 视频 | GitHub / 项目地址 |
| --- | --- | --- | --- | --- | --- |
| GoBackup | Go 实现的数据库与文件备份工具 | —（原文未记录） | —（原文未记录） | —（原文未记录） | [GitHub](https://github.com/gobackup/gobackup) |

## 终端与桌面 UI

| 工具名称 | 作用 | 发布时间 | Koala 给予的评价 | Koala 视频 | GitHub / 项目地址 |
| --- | --- | --- | --- | --- | --- |
| GPUI | Rust UI 框架 | —（原文未记录） | —（原文未记录） | —（原文未记录） | —（原文未记录） |
| gpui-component | GPUI 组件库 | —（原文未记录） | —（原文未记录） | —（原文未记录） | [GitHub](https://github.com/longbridge/gpui-component) |

## 代码质量与 Code Review

| 工具名称 | 作用 | 发布时间 | Koala 给予的评价 | Koala 视频 | GitHub / 项目地址 |
| --- | --- | --- | --- | --- | --- |
| 0github | Code Review 工具 | —（原文未记录） | —（原文未记录） | —（原文未记录） | —（原文未记录） |
| GitHub Stacked Pull Requests | 通过 `gh stack` 把大改动拆成相互依赖、可独立评审和合并的小 PR | 2026-02-06 | Agent 生成的代码量暴涨后，评审正成为新瓶颈；把大改动切成可消化的小块正好对症。 | [BV1Fz3X62ETW · 02:35](https://www.bilibili.com/video/BV1Fz3X62ETW?t=155) | [GitHub](https://github.com/github/gh-stack) |

## Web 与 JavaScript 开发

| 工具名称 | 作用 | 发布时间 | Koala 给予的评价 | Koala 视频 | GitHub / 项目地址 |
| --- | --- | --- | --- | --- | --- |
| ArkRegex | 带类型限定的正则表达式库 | —（原文未记录） | —（原文未记录） | —（原文未记录） | [项目文档](https://arktype.io/docs/blog/arkregex) |
| Navcat | 3D 场景寻路库 | —（原文未记录） | —（原文未记录） | —（原文未记录） | [GitHub](https://github.com/isaac-mason/navcat) |

## 测试与质量保障

| 工具名称 | 作用 | 发布时间 | Koala 给予的评价 | Koala 视频 | GitHub / 项目地址 |
| --- | --- | --- | --- | --- | --- |
| Vitest 4.0 | 支持浏览器模式和视觉回归测试的测试框架 | —（原文未记录） | —（原文未记录） | —（原文未记录） | [项目文档](https://vitest.dev/guide/) |

## 运维、部署与基础设施

| 工具名称 | 作用 | 发布时间 | Koala 给予的评价 | Koala 视频 | GitHub / 项目地址 |
| --- | --- | --- | --- | --- | --- |
| Dokku | 基于 Docker、Buildpack 和插件的轻量自托管 PaaS | 2013-06-08 | 花几十元租一台 VPS 即可获得约八成 Heroku 体验；适合个人项目、内部工具和小团队，以自管运维换取零锁定和成本可控。 | [BV1Fz3X62ETW · 01:37](https://www.bilibili.com/video/BV1Fz3X62ETW?t=97) | [GitHub](https://github.com/dokku/dokku) |
| Supapool | 为并行开发的 Agent 临时创建隔离 Supabase 实例，自动执行迁移并注入环境变量 | 2026-07-30 | 这是典型的 Agent 催生的基础设施；相比长期维护数据库分支，它主打快速、便宜、用完即抛。 | [BV1Fz3X62ETW · 03:22](https://www.bilibili.com/video/BV1Fz3X62ETW?t=202) | [官网](https://supapool.io/) |
| evanhahn 的常用脚本 | 日常运维与自动化脚本合集 | —（原文未记录） | —（原文未记录） | —（原文未记录） | [项目页面](https://evanhahn.com/scripts-i-wrote-that-i-use-all-the-time/) |

## AI 模型与推理

| 工具名称 | 作用 | 发布时间 | Koala 给予的评价 | Koala 视频 | GitHub / 项目地址 |
| --- | --- | --- | --- | --- | --- |
| DeepSeek V4-Flash-0731 | 面向 Agent 场景、支持多档推理强度的 MoE 模型正式版 | 2026-07-31 | 正式版把模型私有化部署的能力边界推到新高度，也提高了大家对 V4 Pro 正式版的期待。 | [BV1Fz3X62ETW · 00:09](https://www.bilibili.com/video/BV1Fz3X62ETW?t=9) | [Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731) |
| TurboFieldfare | 在 Apple Silicon 上按需从 SSD 流式读取 MoE 专家权重，以约 2 GB 内存运行 Gemma 4 26B-A4B | 2026-07-17 | 真正价值是发挥 MoE 特点并降低资源需求；依赖苹果统一内存和高速 NVMe，换到普通 PC 后收益可能明显缩水。 | [BV1Fz3X62ETW · 00:48](https://www.bilibili.com/video/BV1Fz3X62ETW?t=48) | [GitHub](https://github.com/drumih/turbo-fieldfare) |

## AI Agent 与智能体开发

| 工具名称 | 作用 | 发布时间 | Koala 给予的评价 | Koala 视频 | GitHub / 项目地址 |
| --- | --- | --- | --- | --- | --- |
| MCPJam Inspector | MCP 测试与调试框架 | —（原文未记录） | —（原文未记录） | —（原文未记录） | [GitHub](https://github.com/MCPJam/inspector) |

## 数据工程与存储

| 工具名称 | 作用 | 发布时间 | Koala 给予的评价 | Koala 视频 | GitHub / 项目地址 |
| --- | --- | --- | --- | --- | --- |
| Apache Iceberg | 开放式数据湖表格式 | —（原文未记录） | —（原文未记录） | —（原文未记录） | [GitHub](https://github.com/apache/iceberg) |

## 协作与项目管理

| 工具名称 | 作用 | 发布时间 | Koala 给予的评价 | Koala 视频 | GitHub / 项目地址 |
| --- | --- | --- | --- | --- | --- |
| Buzz | 基于 Nostr 事件模型的自托管协作平台，覆盖聊天、画布、代码评审和工作流 | 2026-03-06 | 选择 Nostr 很大胆：天然去中心化且可验证，但生态工具链弱于成熟 IM 协议，自托管也要求运维者理解相关概念。 | [BV1Fz3X62ETW · 04:05](https://www.bilibili.com/video/BV1Fz3X62ETW?t=245) | [GitHub](https://github.com/block/buzz) |

## 多媒体与图形

| 工具名称 | 作用 | 发布时间 | Koala 给予的评价 | Koala 视频 | GitHub / 项目地址 |
| --- | --- | --- | --- | --- | --- |
| WebAV | Web 端音视频处理库 | —（原文未记录） | —（原文未记录） | —（原文未记录） | [GitHub](https://github.com/WebAV-Tech/WebAV) |
