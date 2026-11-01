---
weight: 2
title: "OpenViking 如何与 Codex 集成"
date: 2026-09-17T12:00:00+08:00
lastmod: 2026-09-17T12:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "从模型配置、Codex 插件、Hooks、MCP、Skills 和 FUSE 挂载理解 OpenViking 与 Codex 的集成"
featuredImage:

tags: ["RAG", "Agent", "Codex", "OpenViking"]
categories: ["Agent"]

lightgallery: true

toc:
  auto: false
---

# OpenViking 如何与 Codex 集成

## 1. 先给结论

OpenViking 本身不是 Codex，也不是一个必须替换 Codex 的 Agent。

更准确的关系是：

```text
Codex
  = 负责理解任务、调用模型、执行本地工具和驱动 Agent Loop

OpenViking
  = 负责资源、记忆、Skill、Session 的存储、索引、检索和语义摘要

Codex Memory Plugin
  = 把 Codex 生命周期和 OpenViking 的记忆/MCP 接口连接起来
```

完整调用链如下：

```text
用户 Prompt
    ↓
Codex
    ├── Session Hooks：自动召回、捕获、提交
    ├── MCP Proxy：让模型主动调用 find/read/search/remember
    └── Codex 自己的文件和 Shell 工具
            ↓
       OpenViking Server
            ├── VikingFS / AGFS
            ├── Vector Index
            ├── L0/L1/L2 语义上下文
            └── Session / Memory Extraction
```

官方提供的是 Codex Memory Plugin。它不会把 Codex 变成 VikingBot，也不会让 OpenViking 接管 Codex 的主推理循环。[Codex Memory Plugin](https://github.com/volcengine/OpenViking/blob/main/docs/en/agent-integrations/04-codex.md)

## 2. OpenViking 导入文档为什么需要大模型

导入文档或代码仓库时，OpenViking 不仅保存原始文件，还需要生成语义摘要并建立向量索引。

流程大致是：

```text
文档 / Git 仓库 / 本地目录
        ↓
Parser：解析文件和目录结构
        ↓
TreeBuilder：构建虚拟文件树
        ↓
AGFS：保存原始内容
        ↓
VLM：生成 L0 Abstract 和 L1 Overview
        ↓
Embedding Model：生成向量
        ↓
Vector Index：保存 URI、向量和元数据
```

所以 OpenViking 至少需要两类模型：

| 模型 | 作用 |
| --- | --- |
| VLM/LLM | 解析内容、生成目录和文件的 L0/L1 摘要 |
| Embedding Model | 将文件、摘要和查询转换为向量 |

这两者不是同一个接口，也不一定使用同一个模型。

例如：

```text
VLM：OpenAI Codex / GPT 模型
Embedding：Volcengine Embedding / OpenAI Embedding / 本地模型
```

官方 Quickstart 也明确要求 VLM 和 Embedding 两类能力。[Quickstart](https://github.com/volcengine/OpenViking/blob/main/docs/en/getting-started/02-quickstart.md)

## 3. OpenViking 能否共用 Codex 的模型

可以，但要区分“共用 Codex OAuth”与“直接调用正在运行的 Codex 会话”。

### 3.1 使用 `openai-codex` 作为 OpenViking 的 VLM Provider

OpenViking 当前支持将 `vlm.provider` 配置为 `openai-codex`。典型配置类似：

```json
{
  "vlm": {
    "provider": "openai-codex",
    "model": "gpt-5.6-terra",
    "api_base": "https://chatgpt.com/backend-api/codex",
    "reasoning_effort": "xhigh"
  },
  "embedding": {
    "dense": {
      "provider": "volcengine",
      "model": "doubao-embedding-vision-251215",
      "dimension": 1024,
      "api_key": "<embedding-api-key>"
    }
  }
}
```

通过 `openviking-server init` 可以完成 Codex OAuth 登录或导入已有 Codex 认证状态。对于 `openai-codex`，如果本机已经有有效 Codex OAuth，`vlm.api_key` 可以不配置。[Configuration](https://github.com/volcengine/OpenViking/blob/main/docs/en/guides/01-configuration.md)

这里的“共用”是：

```text
OpenViking Server
    ↓ 使用 openai-codex Provider 和 Codex OAuth
Codex 后端模型服务
```

而不是：

```text
OpenViking 直接复用 Codex 当前对话的上下文
OpenViking 直接调用 Codex AgentLoop
OpenViking 直接读取 Codex 当前 Prompt
```

OpenViking 仍然是独立的 Server 进程，导入任务中的摘要请求由 OpenViking 自己发起。

### 3.2 Embedding 不能直接用 Codex 对话模型替代

Codex 的对话模型主要用于生成和推理，Embedding 模型需要提供向量化接口和固定维度。

因此通常是：

```text
VLM：可以使用 openai-codex
Embedding：仍需单独配置 Embedding Provider
```

除非 Codex 后端同时提供兼容的 Embedding API，否则不能把 Codex 对话模型直接当作 Embedding Model。

### 3.3 成本和工程上的注意点

如果使用 Codex OAuth 作为 VLM，要注意导入大量仓库会产生大量摘要请求。实际部署时可以：

- 让 VLM 使用适合批量摘要的模型；
- 让 Embedding 使用独立的高吞吐模型；
- 设置 `vlm.max_concurrent` 控制并发；
- 对已经处理过的目录只做必要的 reindex；
- 将导入处理放入异步任务队列，不阻塞 Codex 当前对话。

## 4. Codex 插件由什么组成

官方 Codex Plugin 的结构大致是：

```text
examples/codex-memory-plugin/
├── .codex-plugin/
│   └── plugin.json
├── hooks/
│   └── hooks.json
├── skills/
│   ├── openviking-memory/
│   ├── ov-experience-memory/
│   └── ov-memory-doctor/
├── scripts/
│   ├── config.mjs
│   ├── capture-utils.mjs
│   └── debug-log.mjs
├── .mcp.json
├── DESIGN.md
└── README.md
```

它包含：

1. Codex Plugin Manifest；
2. Codex 生命周期 Hooks；
3. MCP 配置和 stdio Proxy；
4. 教 Codex 如何使用 OpenViking 的 Skill；
5. 凭证、会话和调试脚本。

官方 README 明确说明，这些 Hook 和 MCP Proxy 是零依赖的 JavaScript 文件，由 Codex 自带的 Node.js 或系统 Node.js 执行。[Codex Plugin README](https://github.com/volcengine/OpenViking/blob/main/examples/codex-memory-plugin/README.md)

## 5. OpenViking 的 Skill 是否会放进 Codex 指令目录

这里需要区分两类 Skill。

### 5.1 集成 Skill：放在 Codex Plugin 内

例如：

```text
skills/openviking-memory/
skills/ov-experience-memory/
skills/ov-memory-doctor/
```

这些 Skill 是“如何使用 OpenViking”的说明，不是业务知识本身。它们随着 Codex Plugin 安装，成为 Codex 可以发现的本地 Plugin Skill。

它们会告诉 Codex：

- OpenViking MCP 工具是什么；
- 何时应该调用 `find` 或 `search`；
- 如何通过 URI 读取内容；
- 如何显式保存长期记忆；
- 如何诊断 OpenViking 连接问题。

### 5.2 业务 Skill：默认保存在 OpenViking 中

例如一个自媒体 Skill：

```text
viking://agent/skills/write-xhs-post/SKILL.md
viking://user/alice/skills/analyze-hot-topic/SKILL.md
```

这些是远程 Skill，默认不等于 Codex 本地指令目录中的文件，也不会因为上传到了 OpenViking 就自动出现在 Codex 的本地 `skills/` 目录里。

典型使用方式是：

```text
Codex Plugin Skill
    ↓ 教 Codex 使用 OpenViking
Codex 调用 openviking MCP
    ↓
find/search Skill
    ↓
read SKILL.md
    ↓
按 Skill 内容执行任务
```

如果某个 Skill 需要本地脚本、模板或辅助文件，才需要明确下载、同步或安装到 Codex 的本地工作区。不能把“OpenViking 的远程 Skill”和“Codex Plugin 的本地 Skill”视为同一个目录。

可以用下面的方式理解：

```text
Codex 本地 Plugin Skill
  = 如何使用 OpenViking

OpenViking 远程 Skill
  = 具体业务任务应该如何完成
```

OpenViking 的 Skill API 也将 Skill 存储和 Skill 激活区分开：OpenViking 负责存储、检索和管理，消费 Skill 的 Agent/Harness 负责激活、工具策略和实际执行。[Skills API](https://github.com/volcengine/OpenViking/blob/main/docs/en/api/04-skills.md)

## 6. OpenViking 的搜索和更新路径写在哪里

它不只是写在 VikingBot 内。

OpenViking 的访问能力有多个消费方：

```text
VikingBot
Codex Plugin
Claude Code Plugin
Cursor Integration
OpenClaw Plugin
自研 Agent
MCP Client
HTTP Client
CLI
```

VikingBot 内部确实有 `openviking_*` 工具，例如：

```text
openviking_list
openviking_search
openviking_grep
openviking_glob
openviking_multi_read
openviking_add_resource
openviking_memory_commit
```

但 Codex 并不依赖 VikingBot 才能使用 OpenViking。Codex 使用的是 Codex Plugin 自己的 MCP Proxy：

```text
Codex
  ↓
本地 stdio MCP Proxy
  ↓ HTTP / MCP
OpenViking Server /mcp
  ↓
VikingFS / Retrieval / Session
```

因此：

```text
VikingBot 的 OpenViking 工具
    ≠ Codex 的 OpenViking MCP 工具
```

两者最终访问同一个 OpenViking Server，但工具注册和调用运行时不同。

## 7. Codex 如何知道要搜索 `.abstract.md` 和 `.overview.md`

通常不是 Codex 自己扫描本地目录后“猜出来”的，而是由 OpenViking 的协议、插件提示和服务端检索逻辑共同完成。

### 7.1 导入阶段生成摘要文件

当资源导入并完成语义处理后，OpenViking 会在对应目录中生成：

```text
viking://resources/project/
├── .abstract.md
├── .overview.md
├── docs/
│   ├── .abstract.md
│   ├── .overview.md
│   └── api.md
└── src/
    ├── .abstract.md
    ├── .overview.md
    └── main.py
```

它们是 OpenViking 的语义上下文层：

- `.abstract.md` 对应 L0，用于快速判断目录相关性；
- `.overview.md` 对应 L1，用于理解目录结构和核心内容；
- 普通文件对应 L2，保存完整细节。

### 7.2 普通 Codex 集成路径：服务端负责选择摘要

Codex 的 UserPromptSubmit Hook 会把当前 Prompt 发送到 OpenViking 的 recall 接口。服务端的 Retrieval Pipeline 再负责：

```text
当前 Prompt
    ↓
Query Expansion / Intent Analysis
    ↓
搜索目录和摘要向量
    ↓
优先读取 L0
    ↓
必要时读取 L1
    ↓
选择相关 L2 文件
    ↓
压缩后注入 Codex Prompt
```

所以 Codex 并不需要在本地执行：

```bash
find . -name .abstract.md
find . -name .overview.md
```

它只需要知道 OpenViking 的召回规则和 MCP 工具。插件通过 Hook 注入相关上下文，OpenViking Server 负责选择哪些摘要和详情应该返回。

### 7.3 Codex 主动检索路径：MCP Tool

当模型认为自动召回不足时，可以调用 MCP：

```text
find("如何实现 OpenViking 的多租户")
    ↓
返回相关 URI 和摘要

read("viking://resources/openviking/docs/.../api.md")
    ↓
读取具体 L2 内容
```

这时 Codex 是通过 MCP Tool Description 和本地 `openviking-memory` Skill 知道如何检索的，而不是依赖它自己理解 `.abstract.md` 的特殊含义。

### 7.4 如果使用 FUSE，Codex 才能看到本地文件路径

如果额外启用 OpenViking 的实验性 FUSE 挂载，则可以把：

```text
viking://resources/project/
```

映射成本地：

```text
/mnt/openviking/resources/project/
```

此时 Codex 的 Shell 工具可以执行：

```bash
ls /mnt/openviking/resources/project/
cat /mnt/openviking/resources/project/.abstract.md
cat /mnt/openviking/resources/project/.overview.md
grep -R "authentication" /mnt/openviking/resources/project/
```

调用链变为：

```text
Codex exec("cat /mnt/openviking/resources/project/.overview.md")
    ↓
操作系统 VFS
    ↓
FUSE 回调
    ↓
OpenVikingMount / VikingClient
    ↓
OpenViking API
```

但这不是 Codex 默认集成路径。当前仓库中的 FUSE 实现位于 `bot/vikingbot/openviking_mount/viking_fuse.py`，依赖 `fusepy` 和系统 `libfuse`；官方也将其标记为可选能力。默认 Codex 插件不要求安装或启动 FUSE。[FUSE implementation](https://github.com/volcengine/OpenViking/blob/main/bot/vikingbot/openviking_mount/viking_fuse.py)

还要注意，当前 `mount.py` 的直接 `write_file` 仍然有限制，因此 FUSE 更适合作为实验性的读取和 POSIX 访问适配层，不能简单当成已经成熟的远程可写网络盘。

## 8. Codex 集成的完整时序

将各部分合起来，一次 Codex 任务可以是：

```text
1. 启动 Codex
        ↓
2. SessionStart Hook
   加载用户 Profile、偏好和实体摘要
        ↓
3. 用户提交 Prompt
        ↓
4. UserPromptSubmit Hook
   调用 OpenViking recall 接口
   将相关 Memory 和摘要注入 Codex 上下文
        ↓
5. Codex 推理
   需要更多信息时调用 OpenViking MCP
        ↓
6. 读取 Skill 或资源详情
   find/search → read SKILL.md 或具体 L2 文件
        ↓
7. Codex 使用本地工具完成任务
   read_file / edit / exec / git 等
        ↓
8. Stop Hook
   捕获用户消息和 Agent 响应
        ↓
9. PreCompact Hook
   上下文压缩前提交完整会话
        ↓
10. SessionEnd Hook
    会话结束时提交，触发 Memory Extraction
```

这条链路中有三个不同的“写入位置”：

```text
Codex Plugin skills/
    保存集成说明和诊断 Skill

Codex 本地 workspace/
    保存当前任务产生的代码、草稿和临时文件

OpenViking viking://...
    保存长期资源、Memory、远程 Skill 和 Session
```

## 9. 对自研 Agent 的启示

如果在 `media_agent` 中复用这个思路，建议将集成分成三层：

```text
media_agent Agent Loop
    ↓
OpenViking Adapter
    ├── recall(query)
    ├── read(uri)
    ├── search(query)
    ├── write(uri, content)
    └── commit_session(session)
        ↓
OpenViking Server
```

模型配置可以是：

```text
OpenViking VLM：openai-codex 或其他 LLM
OpenViking Embedding：独立 Embedding 服务
media_agent Agent Model：根据业务单独配置
```

不要假设 Agent 当前使用的模型就是 OpenViking 导入资源时使用的模型。两者可以使用同一个 Provider 或 OAuth，但在架构上仍然是两次独立调用：

```text
资源导入：OpenViking → VLM → 生成摘要
用户任务：media_agent → LLM → 生成业务结果
```

对于 Skill，也建议分成两类：

```text
本地 Skill：如何调用 media_agent 的工具和 OpenViking Adapter
远程 Skill：平台规则、内容生产流程和业务知识
```

## 10. 总结

最容易混淆的几个结论如下：

1. OpenViking 是上下文数据库和服务端，VikingBot 才是其仓库中的 Agent Runtime，Codex 则是另一种 Agent Consumer。
2. OpenViking 导入文档需要 VLM 和 Embedding 两类模型；VLM 可以配置为 `openai-codex` 并使用 Codex OAuth，但 Embedding 通常仍要单独配置。
3. Codex Plugin 中的 Skill 主要负责教 Codex 如何使用 OpenViking；OpenViking 中的业务 Skill 默认是远程资源，不会自动复制到 Codex 本地指令目录。
4. Codex 通过 Hooks 自动召回和提交记忆，通过 MCP 主动调用 OpenViking，不依赖 VikingBot。
5. `.abstract.md` 和 `.overview.md` 由 OpenViking 导入流程生成；默认情况下由 OpenViking Server 的检索流程选择和返回，Codex 不需要自己扫描它们。
6. 只有启用实验性 FUSE 挂载后，`ls`、`cat`、`find`、`grep` 等标准 Shell 命令才可以直接对本地挂载目录操作；默认的 `ov ls` 是 CLI/API 调用，不是系统级 `ls`。

