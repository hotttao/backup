---
weight: 1
title: "一个持续更新的工具集"
date: 2026-03-25T12:00:00+08:00
lastmod: 2026-08-17T10:30:00+08:00
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
| Databasement | 自托管数据库备份管理 Web 应用，集中管理 MySQL/PostgreSQL/MariaDB/MSSQL/MongoDB/SQLite/Firebird/Redis 八种数据库的定时备份、保留策略与跨服务器恢复，支持 SSH 隧道、Slack/Telegram 告警及 REST API、MCP 接口 | 2025-11-14 | 数据库备份是每个团队都要做却很少做好的事，常见状态是散落各处的 cron 脚本、坏了没人知道；Databasement 更产品化，多数据库加多存储后端的覆盖面在同类开源工具里突出，MCP 接口也体现了对 AI 运维趋势的敏感。 | [BV1KK3J6cE5J · 02:54](https://www.bilibili.com/video/BV1KK3J6cE5J?t=174) | [GitHub](https://github.com/David-Crty/databasement) |

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
| Topcoat | Tokio 团队的 Rust 全栈响应式 Web 框架，服务端渲染异步组件，通过宏把 Rust 表达式交叉编译为 JavaScript 实现客户端响应式，无需 WASM，内置组件库与文件路由 | 2026-07-22 | Rust 后端已成熟但全栈体验一直是短板；Topcoat 由 Tokio 这一 Rust 生态核心团队打造，路线更接近 Rust 的一体化哲学而非 Leptos 那种 WASM 优先思路，不过项目仍处于早期实验阶段。 | [BV1KK3J6cE5J · 02:00](https://www.bilibili.com/video/BV1KK3J6cE5J?t=120) | [GitHub](https://github.com/tokio-rs/topcoat) |

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
| OpenShip | 开源自托管部署平台，自动识别 Node/Python/Go/Rust 等技术栈，一键配置 PostgreSQL/Redis 等服务与 SSL，部署为不可变快照、支持零停机回滚，可云服务或自有服务器自托管 | 2026-03-05 | 仅作功能介绍，未给出明确评价。 | [BV1KK3J6cE5J · 00:32](https://www.bilibili.com/video/BV1KK3J6cE5J?t=32) | [GitHub](https://github.com/oblien/openship) |

## AI 模型与推理

| 工具名称 | 作用 | 发布时间 | Koala 给予的评价 | Koala 视频 | GitHub / 项目地址 |
| --- | --- | --- | --- | --- | --- |
| DeepSeek V4-Flash-0731 | 面向 Agent 场景、支持多档推理强度的 MoE 模型正式版 | 2026-07-31 | 正式版把模型私有化部署的能力边界推到新高度，也提高了大家对 V4 Pro 正式版的期待。 | [BV1Fz3X62ETW · 00:09](https://www.bilibili.com/video/BV1Fz3X62ETW?t=9) | [Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731) |
| TurboFieldfare | 在 Apple Silicon 上按需从 SSD 流式读取 MoE 专家权重，以约 2 GB 内存运行 Gemma 4 26B-A4B | 2026-07-17 | 真正价值是发挥 MoE 特点并降低资源需求；依赖苹果统一内存和高速 NVMe，换到普通 PC 后收益可能明显缩水。 | [BV1Fz3X62ETW · 00:48](https://www.bilibili.com/video/BV1Fz3X62ETW?t=48) | [GitHub](https://github.com/drumih/turbo-fieldfare) |
| Kimi K3 | 月之暗面（Moonshot AI）发布的开源旗舰大模型，总参数 2.8 万亿（MoE，896 专家、每步激活 16 个），采用 KDA（Kimi Delta Attention）混合线性注意力与注意力残差，原生多模态并支持百万 token（1,048,576）上下文，以 MXFP4 权重交付 | 2026-07-16 | 开源模型的参数规模第一次摸到 3T 这个量级，标志着开源阵营与闭源旗舰的差距进一步收窄；官方也坦诚整体仍略逊于 Claude Fable 5 和 GPT-5.6。真正值得关注的是 KDA 加线性注意力这套组合在百万上下文下的推理成本控制，这决定了它在大规模推理场景下的实用性。 | [BV17vKB6sEYR · 00:28](https://www.bilibili.com/video/BV17vKB6sEYR?t=28) | [Hugging Face](https://huggingface.co/moonshotai/kimi-k3) |
| Bonsai 27B | PrismML 对阿里巴巴 Qwen3.6-27B 的极端量化产物，提供 1-bit（1.125 比特/权重、3.9GB）与三元（1.71 比特/权重、5.9GB）两个版本，首次让 27B 级模型跑进 iPhone 17 Pro，保留完整多模态能力与 262K 上下文，支持工具调用与计算机操作循环 | 2026-07-14 | 首次让 27B 级模型跑进 iPhone 17 Pro，保留完整多模态能力和 262K 上下文、支持工具调用与计算机操作循环，数学基准从 95.3 只降到 91.7；数学和工具调用这两项 Agent 关键能力在量化后保持得最好，说明选型经过仔细权衡。本地模型的竞争正从参数规模转向它们提出的“智能密度”——也就是每 GB 体积能装下多少能力。 | [BV17vKB6sEYR · 01:27](https://www.bilibili.com/video/BV17vKB6sEYR?t=87) | [Hugging Face](https://huggingface.co/collections/prism-ml/bonsai-27b) |

## AI Agent 与智能体开发

| 工具名称 | 作用 | 发布时间 | Koala 给予的评价 | Koala 视频 | GitHub / 项目地址 |
| --- | --- | --- | --- | --- | --- |
| MCPJam Inspector | MCP 测试与调试框架 | —（原文未记录） | —（原文未记录） | —（原文未记录） | [GitHub](https://github.com/MCPJam/inspector) |
| OneCLI | 面向 AI Agent 的开源凭证网关，Agent 只持占位凭证、真实密钥由网关在网络层按请求注入，支持端点封禁、按分钟/小时/天限流、敏感操作人工审批与按项目隔离 | 2026-03-08 | 过去一年 Agent 安全的最大共识是靠 Prompt 约束模型行为根本靠不住，规则必须放到模型管不到的地方执行；OneCLI 选择网络层拦截，覆盖面比在 MCP Server 里做权限校验更广，连 LLM 写代码直接发 API 请求这条路也堵住了；但局限在于所有流量走一个代理，网关本身成了单点。 | [BV1KK3J6cE5J · 03:48](https://www.bilibili.com/video/BV1KK3J6cE5J?t=228) | [GitHub](https://github.com/onecli/onecli) |
| codex-plugin-cc | OpenAI 官方开源的 Claude Code 插件，让用户在 Claude Code 工作流内直接调用本机 Codex，用于代码审查、对抗式 review、任务委派与后台任务管理，复用本机 Codex CLI 与认证 | 2026-03-30 | OpenAI 亲自给竞争对手的产品写官方插件，在以前难以想象，说明 Claude Code 的强势仍然难以挑战；OpenAI 宁可把 Codex 嵌进去，也不愿失去这批用户的使用量。对开发者是好事——用一个模型写代码、换另一个模型做对抗审查的双模型工作流，确实能捕捉到单一模型的盲区。这种巨头间的互操作能维持多久是个问号，但至少现在用户是赢家。 | [BV17vKB6sEYR · 00:58](https://www.bilibili.com/video/BV17vKB6sEYR?t=58) | [GitHub](https://github.com/openai/codex-plugin-cc) |
| Destructive Command Guard | 用 Rust 编写的安全防护工具（简称 dcg），在 AI 编程助手执行 rm -rf、git push --force、DROP TABLE 等毁灭性命令前直接拦截，覆盖十多种主流 Agent，内置 50 多个规则包，并扩展到数据库、Kubernetes、云平台等场景 | 2026-07-13 | Agent 误删代码的事故几乎每个重度用户都遇到过，各家 CLI 自带的确认机制又常被自动批准模式绕过；dcg 把防护做成跨 Agent 的统一钩子层，解决的是真实痛点。它用 SIMD 做到亚毫秒级延迟，还能识别藏在 Python 代码和 heredoc 里的危险调用，并智能区分命令是为执行还是只做文本出现。不过规则天然存在绕过空间，把它当最后一道保险而不是唯一防线才是正确认知，配合容器隔离和 Git 备份使用更稳妥。 | [BV17vKB6sEYR · 02:22](https://www.bilibili.com/video/BV17vKB6sEYR?t=142) | [GitHub](https://github.com/Dicklesworthstone/destructive_command_guard) |

## 数据工程与存储

| 工具名称 | 作用 | 发布时间 | Koala 给予的评价 | Koala 视频 | GitHub / 项目地址 |
| --- | --- | --- | --- | --- | --- |
| Apache Iceberg | 开放式数据湖表格式 | —（原文未记录） | —（原文未记录） | —（原文未记录） | [GitHub](https://github.com/apache/iceberg) |

## 协作与项目管理

| 工具名称 | 作用 | 发布时间 | Koala 给予的评价 | Koala 视频 | GitHub / 项目地址 |
| --- | --- | --- | --- | --- | --- |
| Buzz | 基于 Nostr 事件模型的自托管协作平台，覆盖聊天、画布、代码评审和工作流 | 2026-03-06 | 选择 Nostr 很大胆：天然去中心化且可验证，但生态工具链弱于成熟 IM 协议，自托管也要求运维者理解相关概念。 | [BV1Fz3X62ETW · 04:05](https://www.bilibili.com/video/BV1Fz3X62ETW?t=245) | [GitHub](https://github.com/block/buzz) |
| Chatto | Hendrik Mans 开源的自托管群聊平台，整个服务端是单个约 50MB 的二进制文件、零依赖一步部署，内置端到端加密的音视频通话与屏幕共享，不依赖第三方服务，提供 GraphQL 与 NATS API，房间类型覆盖自由聊天、论坛与社交信息流，符合 GDPR | 2026-07-08 | 这个赛道上有 Mattermost、Rocket.Chat 等老玩家，但它们部署起来都不轻；Chatto 用单文件零依赖把自托管门槛降到极致，很对个人开发者和小团队的胃口。 | [BV17vKB6sEYR · 04:09](https://www.bilibili.com/video/BV17vKB6sEYR?t=249) | [GitHub](https://github.com/chattocorp/chatto) |

## 多媒体与图形

| 工具名称 | 作用 | 发布时间 | Koala 给予的评价 | Koala 视频 | GitHub / 项目地址 |
| --- | --- | --- | --- | --- | --- |
| WebAV | Web 端音视频处理库 | —（原文未记录） | —（原文未记录） | —（原文未记录） | [GitHub](https://github.com/WebAV-Tech/WebAV) |
| Decoy Font | Mixfont 推出的 TTF 字体，利用混合图像（hybrid image）原理制作隐写效果：每个字母近看是诱饵文字、远看或眯眼则显示另一段隐藏信息，基于 DejaVu Sans Mono，免费用于个人与商业项目 | 2026-07-17 | 作者实测能骗过 ChatGPT、Gemini 等主流大模型的 OCR 识别，却作为普通字体文件即可使用。在 AI 抓取无处不在的今天，这类对抗性设计正在从学术界走向实用工具，验证码、隐私水印都是可能的落地方向；它更大的价值也许是作为视觉语言模型的基准测试素材，探出模型在感知层面和人眼的差距。当然作者也承认这不是可靠的保护手段，指令得当的模型依然可能识破，把它当安全方案不如当一个精巧的视觉实验。 | [BV17vKB6sEYR · 03:17](https://www.bilibili.com/video/BV17vKB6sEYR?t=197) | [项目页](https://www.mixfont.com/experiments/decoy-font) |

## 办公与演示

| 工具名称 | 作用 | 发布时间 | Koala 给予的评价 | Koala 视频 | GitHub / 项目地址 |
| --- | --- | --- | --- | --- | --- |
| Bento | 把完整 PPT 编辑器、演示器塞进单个约 560KB 的 HTML 文件，浏览器打开即用，支持 AES-GCM 端到端加密协作，且文档为明文 JSON 可被 Agent 直接编辑 | 2026-07-17 | 单个 HTML 文件配合浏览器能力足以胜任很多本地化使用场景，在满足需求的同时还提供了良好的隐私保护与离线体验。 | [BV1KK3J6cE5J · 00:02](https://www.bilibili.com/video/BV1KK3J6cE5J?t=2) | [GitHub](https://github.com/nyblnet/bento) |

## 开发者认证与招聘

| 工具名称 | 作用 | 发布时间 | Koala 给予的评价 | Koala 视频 | GitHub / 项目地址 |
| --- | --- | --- | --- | --- | --- |
| Redential | 把私有代码库转换为可分享、可验证的技术能力凭证，通过 CLI 或 GitHub 应用分析代码并辅以技术答辩，NDA 安全，只暴露必要信息 | 2026-07-14 | 瞄准 AI 原生时代的招聘信任问题，用已交付的真实项目为能力背书是合理方向，尤其适合没有传统学历但有实战作品的开发者；但凭证价值取决于雇主是否认可，且 AI 大量参与写代码后，代码分析能否区分个人贡献仍是未解问题。 | [BV1KK3J6cE5J · 01:01](https://www.bilibili.com/video/BV1KK3J6cE5J?t=61) | [GitHub](https://github.com/Redential/redential-cli) |
