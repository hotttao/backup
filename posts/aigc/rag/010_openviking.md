---
title: OpenViking 深入理解：面向 Agent 的上下文数据库与虚拟文件系统
date: 2026-09-17
tags:
  - RAG
  - Agent
  - OpenViking
  - Memory
---

# OpenViking 深入理解：面向 Agent 的上下文数据库与虚拟文件系统

项目地址：<https://github.com/volcengine/OpenViking>

## 1. OpenViking 解决什么问题

传统 RAG 通常把数据切分成 Chunk，生成向量后放入向量数据库。Agent 查询时召回若干相似 Chunk，再将它们拼接到 Prompt 中。

这种方式有几个问题：

- Chunk 之间的目录和层级关系容易丢失；
- Agent 不知道一段内容属于哪个项目、模块或文档；
- 所有内容都以相似度排序，缺少确定性的路径访问；
- 每次都直接加载完整文本，容易浪费上下文窗口；
- 用户偏好、历史会话、Agent 经验和业务知识往往由不同系统分别管理。

OpenViking 的核心思路是：

> 把 Resource、Memory、Skill 和 Session 统一组织成一个面向 Agent 的虚拟文件系统，再在文件系统之上提供语义检索和渐进式上下文加载。

因此，它更准确的定位不是“向量数据库”，而是一个 Context Database，或者说面向 Agent 的 Context OS。

官方仓库的主要组成包括：

```text
openviking/       Python 服务、存储、检索、会话和记忆逻辑
bot/              VikingBot Agent Runtime
openviking_cli/   Python CLI 相关实现
crates/           Rust CLI 和底层组件
src/              底层索引/扩展代码
sdk/              多语言 SDK
examples/         集成示例
```

参考：[OpenViking 仓库目录](https://github.com/volcengine/OpenViking/tree/main)

## 2. 总体架构

OpenViking 可以分成以下几层：

```text
┌─────────────────────────────────────────────┐
│ Agent / VikingBot / 外部 Agent               │
│ AgentLoop + ContextBuilder + ToolRegistry   │
└──────────────────┬──────────────────────────┘
                   │ HTTP / SDK / MCP / CLI
┌──────────────────▼──────────────────────────┐
│ Client / Service Layer                       │
│ FSService / SearchService / SessionService   │
│ ResourceService / PackService                │
└──────────────┬────────────────┬──────────────┘
               │                │
      ┌────────▼────────┐ ┌─────▼────────────┐
      │ Retrieval        │ │ Session/Memory  │
      │ Intent Analysis  │ │ Compression     │
      │ Hierarchical     │ │ Extraction      │
      │ Retrieval        │ │ Deduplication   │
      │ Rerank           │ └─────┬────────────┘
      └────────┬────────┘       │
               └────────────────┤
                       ┌────────▼────────┐
                       │ Storage Layer   │
                       │ VikingFS        │
                       │ AGFS            │
                       │ Vector Index    │
                       └─────────────────┘
```

官方架构文档将系统拆分为 Client、Service、Retrieve、Session、Parse、Compressor 和 Storage 模块。[Architecture](https://github.com/volcengine/OpenViking/blob/main/docs/en/concepts/01-architecture.md)

### 2.1 Client 层

Client 是统一入口，提供 Python、Go、TypeScript、HTTP 和 CLI 访问方式。

```python
client.ls("viking://resources/")
client.read("viking://resources/project/docs/api.md")
client.find("如何实现用户认证")
```

### 2.2 Service 层

Service 层负责业务编排，并且将业务逻辑与 HTTP、CLI 等传输方式解耦：

| Service | 作用 |
| --- | --- |
| FSService | `ls`、`mkdir`、`rm`、`mv`、`tree`、`stat`、`read`、`write` |
| SearchService | 语义搜索和目录范围搜索 |
| SessionService | 会话、消息、压缩和提交 |
| ResourceService | 导入 URL、Git 仓库、文件、目录和 Skill |
| PackService | 导入导出、备份恢复 |
| DebugService | 系统观测和调试 |

这样，HTTP API、SDK 和 CLI 都可以复用同一套 Service 逻辑。

## 3. 核心抽象一：Viking URI

OpenViking 使用 `viking://` 作为统一资源标识符：

```text
viking://{scope}/{path}
```

主要命名空间如下：

```text
viking://
├── resources/              # 公共知识资源
├── user/
│   └── {user_id}/
│       ├── memories/        # 用户记忆和 Agent 经验
│       ├── resources/       # 用户私有资源
│       ├── peers/           # 与其他交互对象有关的上下文
│       └── sessions/        # 会话数据
└── agent/
    ├── skills/             # 共享 Skill
    ├── endpoints/          # Agent 通信端点
    ├── tools/              # 工具配置
    └── payments/            # 支付相关配置
```

例如：

```text
viking://resources/my-project/docs/api.md
viking://~/memories/preferences/coding-style.md
viking://~/sessions/session-001/
viking://agent/skills/search-code/SKILL.md
```

`viking://~/...` 是当前用户的 home alias，服务端根据请求身份将其展开为：

```text
viking://user/{user_id}/...
```

因此 Agent 不需要自己拼接用户 ID，系统可以结合 API Key、User、Peer 和请求上下文做权限隔离。

参考：[Viking URI](https://github.com/volcengine/OpenViking/blob/main/docs/en/concepts/04-viking-uri.md)

## 4. 核心抽象二：Context Type

OpenViking 将上下文分成三类：

| 类型 | 作用 | 示例 |
| --- | --- | --- |
| Resource | 相对稳定的客观知识 | 文档、代码、FAQ、网页、项目资料 |
| Memory | 动态积累的用户和 Agent 认知 | 偏好、事件、实体、任务经验 |
| Skill | 完成某类任务的方法和流程 | `SKILL.md`、工具使用说明 |

三类对象最终都以文件或目录形式存在，所以 Agent 可以用相同的方式访问它们：

```text
viking://resources/media-platform/
viking://user/alice/memories/preferences/writing-style.md
viking://user/alice/memories/experiences/deploy-service.md
viking://agent/skills/write-xhs-post/SKILL.md
```

这种统一模型比单独维护“知识库、记忆库、Skill 仓库”更适合 Agent，因为 Agent 的实际任务经常需要同时使用这三类上下文。

## 5. 核心抽象三：L0/L1/L2 分层上下文

OpenViking 将上下文分为三个信息层级：

```text
L0 Abstract
    一句话摘要，用于快速判断相关性

L1 Overview
    目录结构、核心内容和使用场景

L2 Details
    原始的完整内容
```

一个目录在语义处理后可能类似于：

```text
viking://resources/my-project/
├── .abstract.md          # L0
├── .overview.md          # L1
├── docs/
│   ├── .abstract.md
│   ├── .overview.md
│   └── api.md            # L2
└── src/
    ├── .abstract.md
    ├── .overview.md
    └── main.py            # L2
```

Agent 的访问过程可以是：

```text
先读取目录 L0
      ↓
判断目录是否相关
      ↓
读取目录 L1
      ↓
选择具体文件
      ↓
读取需要的 L2 内容
```

这是一种上下文的 Progressive Loading，能够减少无关内容进入 Prompt，也让 Agent 在读取文件前先理解目录语义。

## 6. 资源导入和索引流程

导入一个 Git 仓库、网页、本地目录或文档时，主要流程如下：

```text
URL / Git / 本地文件
        ↓
Parser
        ↓
生成临时文件树
        ↓
TreeBuilder
        ↓
写入 AGFS
        ↓
Semantic Queue
        ↓
自底向上生成 L0/L1
        ↓
写入 Vector Index
```

官方给出的简化流程是：

```text
Input → Parser → TreeBuilder → AGFS → SemanticQueue → Vector Index
```

各步骤职责如下：

1. Parser 解析 Markdown、PDF、HTML、代码、目录和多媒体资源。
2. TreeBuilder 创建文件和目录结构。
3. 原始文件被写入 AGFS。
4. 语义处理任务进入异步队列。
5. 系统从叶子文件开始，自底向上生成目录摘要。
6. 文件和目录的语义表示进入向量索引。

这里有一个重要的存储原则：

> 向量索引只保存 URI、向量和元数据，真实内容始终从 AGFS 读取。

因此：

```text
AGFS：
  原始文件
  .abstract.md
  .overview.md
  图片、音频、视频等媒体

Vector Index：
  URI
  embedding
  metadata
  context_type
  tags
```

这避免了“向量数据库里有一份文本、文件存储里又有一份文本”导致的数据不一致。

## 7. 检索流程

### 7.1 `find`：语义检索

```bash
ov find "OpenViking 如何处理会话记忆"
```

其逻辑可以抽象为：

```text
用户问题
   ↓
Intent Analysis
   ↓
生成一个或多个类型化查询
   ↓
向量召回候选目录和文件
   ↓
按目录层级递归探索
   ↓
过滤和 Rerank
   ↓
返回相关 URI、摘要或内容
```

官方文档将这个过程概括为：

```text
Query → Intent Analysis → Hierarchical Retrieval → Rerank → Results
```

它的关键点不是只对平面 Chunk 做相似度排序，而是先找到相关目录，再在目录内部向下探索。

### 7.2 `grep` 和 `glob`：确定性检索

```bash
ov grep "TODO" --uri viking://resources/my-project/
ov glob "**/*.md" --uri viking://resources/my-project/
```

- `grep` 做内容匹配；
- `glob` 做路径匹配；
- `find` 做语义检索。

Agent 既可以用自然语言检索，也可以像开发者一样精确查找代码和配置文件。

## 8. VikingBot 如何集成 Agent

OpenViking 本身主要是 Context Database，VikingBot 是建立在它之上的 Agent Runtime。

VikingBot 的核心执行器是 `AgentLoop`，执行流程如下：

```text
Channel 输入
    ↓
转换为统一 InboundMessage
    ↓
确定 SessionKey / User / Peer
    ↓
ContextBuilder 构建上下文
    ↓
加载 Workspace 文件
    ↓
加载 Profile / Memory / Experience
    ↓
加载 Skill 摘要
    ↓
调用 LLM
    ↓
模型产生文本或 Tool Call
    ↓
ToolRegistry 执行工具
    ↓
将工具结果追加回上下文
    ↓
继续调用 LLM
    ↓
发送最终结果
    ↓
同步 Session / 提交长期记忆
```

`AgentLoop` 的核心职责是：接收消息、构建上下文、调用模型、执行工具并返回响应。[AgentLoop 源码](https://raw.githubusercontent.com/volcengine/OpenViking/main/bot/vikingbot/agent/loop.py)

### 8.1 ContextBuilder 的上下文顺序

每次调用模型前，ContextBuilder 可以组合：

```text
Bot 身份
+ Sandbox 描述
+ Workspace 启动文件
+ Always Skills
+ 其他 Skill 摘要
+ OpenViking Profile
+ Memories
+ Experiences
+ 历史对话
+ 当前用户消息
```

Workspace 中的典型文件包括：

```text
SOUL.md       Agent 人格和沟通方式
AGENTS.md     工作规则和任务约束
IDENTITY.md   Agent 身份
TOOLS.md      工具选择和安全边界
HEARTBEAT.md  周期性任务
skills/       Skill 定义
```

普通 Skill 不会每轮都注入完整内容，通常只先注入名称、描述和路径。Agent 决定使用某个 Skill 后，再读取完整的 `SKILL.md`。

### 8.2 Memory 的自动召回

启用 OpenViking 集成后，ContextBuilder 可以根据当前用户和 Peer 自动召回：

- 用户 Profile；
- 用户偏好；
- 历史事件；
- 相关实体；
- Agent 过去完成任务时形成的 Experience。

例如用户说“帮我部署一个 Go 服务”，Agent 可能召回：

```text
用户偏好：使用 Docker Compose，部署目标是 Linux ECS
历史事件：该项目曾经出现过端口冲突
Agent 经验：该服务需要先检查反向代理配置
```

此外，Agent 读取某个 Skill 后，`tool.post_call` Hook 还可以根据 Skill 名称检索相关 Experience，并将这些经验追加到 Skill 内容后面。[OpenViking 集成](https://github.com/volcengine/OpenViking/blob/main/bot/docs/en/concepts/04-openviking-integration.md)

### 8.3 OpenViking 本身是 Agent 吗？

严格来说，不是。

OpenViking 核心是一个上下文数据库和服务端，负责：

```text
存储资源、记忆、Skill 和 Session
生成 L0/L1/L2 摘要
执行语义检索和目录检索
提供文件系统 API
处理会话提交和记忆提取
```

它本身不等于一个完整的聊天 Agent。完整 Agent 还需要：

```text
消息入口
LLM Provider
Agent Loop
Tool Registry
Sandbox
Session 编排
```

仓库中的 VikingBot 才是建立在 OpenViking 之上的 Agent Runtime。VikingBot 可以从 CLI、HTTP、飞书、Slack、Telegram 等渠道接收消息，调用模型和工具，再使用 OpenViking 进行上下文召回和记忆沉淀。[VikingBot Architecture](https://github.com/volcengine/OpenViking/blob/main/bot/docs/en/concepts/01-architecture.md)

二者关系可以表示为：

```text
Codex / VikingBot / Claude Code / 自研 Agent
                 │
                 │  Agent Loop、工具调用、Prompt
                 ▼
          OpenViking Client / MCP
                 │
                 │  recall、read、write、remember
                 ▼
          OpenViking Server
                 │
                 ▼
          VikingFS + AGFS + Vector Index
```

### 8.4 OpenViking 如何集成 Codex

当前官方提供的是 Codex Memory Plugin，而不是把 Codex 替换成 VikingBot。Codex 仍然是负责推理和执行任务的 Agent，OpenViking 负责提供跨会话的 Profile、Memory、Experience、Session 和检索工具。

Codex 插件主要由两部分组成：

1. 生命周期 Hooks：在 Codex 的会话事件中自动召回、捕获和提交记忆。
2. MCP Proxy：让 Codex 可以主动调用 `find`、`search`、`read`、`remember` 等 OpenViking 工具。

核心生命周期如下：

```text
Codex SessionStart
    ↓
加载 profile.md，以及 preferences/entities 的 URI 和摘要索引

Codex UserPromptSubmit
    ↓
根据当前 Prompt 检索相关 OpenViking Memory
    ↓
将召回结果注入本轮 Prompt

Codex 产生响应
    ↓
Stop Hook 捕获本轮用户消息和 Agent 响应

Codex PreCompact
    ↓
上下文压缩前提交完整会话

Codex SessionEnd
    ↓
结束时提交会话，触发长期记忆提取
```

同时，Codex 可以通过 MCP 主动执行：

```text
find      语义检索
search    带会话上下文的检索
read      读取指定 URI
remember  显式写入长期记忆
```

安装方式和配置细节以官方 Codex 集成文档为准：[Codex Memory Plugin](https://github.com/volcengine/OpenViking/blob/main/docs/en/agent-integrations/04-codex.md)

因此 Codex 集成后的调用链不是：

```text
Codex → OpenViking Agent
```

而是：

```text
Codex Agent
  ├── Hooks：自动召回 / 捕获 / 提交
  └── MCP：主动调用 OpenViking 工具
              ↓
       OpenViking Server
```

## 9. Session 如何变成长期记忆

Session 也是 OpenViking 中的一种上下文对象。一个会话目录大致类似于：

```text
viking://user/alice/sessions/session-001/
├── .abstract.md
├── .overview.md
├── .meta.json
├── messages.jsonl
├── tools/
└── history/
```

提交会话时，流程是：

```text
Messages
   ↓
Compression
   ↓
Archive
   ↓
Memory Extraction
   ↓
Deduplication / Merge / Skip
   ↓
写入 AGFS + Vector Index
```

具体来说：

1. 当前消息和工具调用写入 `messages.jsonl`。
2. 对话过长时，旧消息被压缩为历史归档。
3. 历史归档生成 L0/L1 摘要。
4. Memory Extractor 从对话中提取长期记忆。
5. 新记忆与已有记忆比较，决定创建、合并或跳过。
6. 记忆最终写入 `viking://user/.../memories/`。

这使得 Agent 可以积累的不只是用户偏好，也包括可复用的任务经验：

```text
viking://user/alice/memories/experiences/
├── deploy-go-service.md
├── debug-nginx-proxy.md
└── resolve-port-conflict.md
```

## 10. 文件系统接口如何实现

这里需要区分两种文件系统。

### 10.1 OpenViking 虚拟文件系统

`viking://` 首先是 OpenViking 的逻辑文件系统。它不是操作系统默认能够识别的路径，因此下面这个命令本身不会访问 OpenViking：

```bash
ls viking://resources/
```

要访问逻辑文件系统，需要调用 `ov` CLI、HTTP API、SDK 或 OpenViking Tool。

它提供类 Unix 操作：

```text
ls
tree
stat
read
write
mkdir
rm
mv
grep
glob
abstract
overview
```

例如：

```bash
ov ls viking://resources/
ov tree viking://resources/project/
ov stat viking://resources/project/docs/api.md
ov read viking://resources/project/docs/api.md
ov write viking://user/alice/memories/preferences/style.md
ov mkdir viking://resources/project/new-module/
ov rm viking://resources/project/old-module/ --recursive
```

对应的 HTTP API 类似于：

```http
GET    /api/v1/fs/ls?uri=viking://resources/
GET    /api/v1/fs/tree?uri=viking://resources/project/
GET    /api/v1/fs/stat?uri=viking://resources/project/docs/api.md
GET    /api/v1/fs/read?uri=viking://resources/project/docs/api.md
POST   /api/v1/fs/mkdir
POST   /api/v1/fs/write
DELETE /api/v1/fs?uri=...
```

参考：[Filesystem API](https://github.com/volcengine/OpenViking/blob/main/docs/en/api/03-filesystem.md)

### 10.2 真正的 FUSE 挂载

OpenViking 仓库中确实存在 FUSE 实验实现，主要位于：

```text
bot/vikingbot/openviking_mount/
├── mount.py
├── viking_fuse.py
├── manager.py
└── session_integration.py
```

其中 `viking_fuse.py` 使用 `fusepy` 的 `FUSE`、`Operations` 和 `FuseOSError`，实现标准文件系统回调，例如：

```text
getattr
readdir
open
read
write
mkdir
unlink
rmdir
truncate
```

挂载时的核心调用类似于：

```python
FUSE(
    operations,
    str(config.mount_point),
    foreground=foreground,
    nothreads=True,
)
```

FUSE 的工作原理是：

```text
Shell: ls /mnt/openviking
          ↓
操作系统 VFS
          ↓
FUSE 内核接口
          ↓
OpenVikingFUSE.readdir()
          ↓
mount.list_dir()
          ↓
VikingClient.ls("viking://resources/")
          ↓
HTTP API / OpenViking Server
```

路径映射关系类似于：

```text
本地路径                         Viking URI
/mnt/openviking/resources/foo    viking://resources/foo
/mnt/openviking/user/alice/x     viking://user/alice/x
/mnt/openviking/session/bar      viking://session/bar
```

挂载成功后，普通命令才可以直接使用：

```bash
ls /mnt/openviking/resources/
find /mnt/openviking/resources/ -name "*.md"
cat /mnt/openviking/resources/project/README.md
grep -R "authentication" /mnt/openviking/resources/project/
mkdir /mnt/openviking/resources/project/new-module
```

这些命令不是由 OpenViking 自己解析的，而是由操作系统转成 FUSE 回调，再由回调转换成 Viking URI 和 OpenViking API。

不过需要注意当前实现状态：

- FUSE 代码在仓库中存在，但属于可选/实验能力；
- 默认 AgentLoop 不走 FUSE，而是通过 VikingClient 和 `openviking_*` 工具访问；
- 运行 FUSE 需要 `fusepy` 和系统级 `libfuse`；
- 当前 `mount.py` 的直接 `write_file` 仍然是受限实现，代码中明确抛出 `NotImplementedError`；
- `viking_fuse.py` 中的文件写缓存和回写逻辑不能简单等同于生产级 POSIX 文件系统一致性；
- FUSE 挂载是本地 Agent/进程的挂载点，不是让远程 Codex 直接获得一个网络盘。

因此，准确的说法应该是：

> OpenViking 提供了一个实验性的 FUSE 适配层，可以把部分 `viking://` 内容映射为本地挂载目录；但 OpenViking 的默认 Agent 集成仍然使用 HTTP/SDK/MCP/原生 Tool，而不是 FUSE。

参考：[openviking_mount 目录](https://github.com/volcengine/OpenViking/tree/main/bot/vikingbot/openviking_mount)、[FUSE 实现](https://github.com/volcengine/OpenViking/blob/main/bot/vikingbot/openviking_mount/viking_fuse.py)

### 10.3 VikingBot 的本地 Workspace 文件系统

VikingBot 还提供：

```text
read_file
write_file
edit_file
list_dir
exec
```

这些工具默认操作本地 Workspace，例如：

```text
~/.openviking/data/bot/workspace/shared/
```

而不是：

```text
viking://resources/
```

所以两种调用的含义不同：

```text
read_file("README.md")
    → 读取 Agent 本地 Workspace 文件

openviking_multi_read("viking://resources/project/README.md")
    → 读取 OpenViking 远程虚拟文件
```

官方 Agent 能力文档也明确区分了 Workspace 工具和 OpenViking 工具。[Agent Capabilities](https://github.com/volcengine/OpenViking/blob/main/bot/docs/en/concepts/02-agent-capabilities.md)

## 11. Agent 如何通过 Shell 操作 OpenViking

### 11.1 方式一：原生 OpenViking Tool

VikingBot 可以将 OpenViking 操作注册为结构化工具：

```text
openviking_list
openviking_search
openviking_grep
openviking_glob
openviking_multi_read
openviking_add_resource
openviking_memory_commit
```

模型看到的不是 Shell 字符串，而是 JSON Schema Tool：

```json
{
  "name": "openviking_list",
  "arguments": {
    "uri": "viking://resources/project/"
  }
}
```

优点是参数可校验、返回值结构化、身份信息可以从 `ToolContext` 传入，并且更容易记录调用轨迹。

### 11.2 方式二：Agent 通过 `exec` 执行 `ov`

如果 Agent 有 Shell 工具，也可以这样操作：

```bash
ov ls viking://resources/project/
ov grep "authentication" --uri viking://resources/project/
ov read viking://resources/project/docs/api.md
```

实际调用链是：

```text
Agent
  ↓
exec("ov ls ...")
  ↓
ov CLI
  ↓
HTTP API
  ↓
Service Layer
  ↓
VikingFS / AGFS / Vector Index
```

CLI 本身是 OpenViking 的客户端，不应该直接读取 AGFS 或向量数据库。

这种方式适合：

- Agent 已经具备 Shell 能力；
- 需要和 `grep`、`awk`、`jq` 等 Unix 工具组合；
- 需要在脚本或 CI 中调用；
- 希望 Agent 保持“像开发者一样操作目录”的使用体验。

例如：

```bash
ov ls viking://resources/project/ --simple | grep ".md"
```

这里的 `grep` 只是在处理 `ov ls` 输出的文本，不代表 `grep` 已经能够直接理解 `viking://`。如果希望使用标准 `ls`、`cat`、`find`、`grep` 直接访问 OpenViking 路径，必须先建立 FUSE 挂载：

```text
无挂载：
  ov ls viking://resources/project/
  → ov CLI 解析 viking://，调用 HTTP API

有挂载：
  ls /mnt/openviking/resources/project/
  → OS VFS → FUSE → VikingClient → OpenViking API
```

另外，FUSE 只提供 POSIX 文件系统语义，不能自然表达所有 OpenViking 能力。例如 `find` 可以映射目录遍历，但语义检索仍需要 `ov find` 或 `openviking_search`；L0/L1/L2 也通常要通过专门 API 或扩展属性暴露，而不是普通 `cat` 自动理解。

### 11.3 方式三：通过 MCP 集成

其他 Agent 也可以通过 MCP 使用 OpenViking：

```text
其他 Agent
   ↓ MCP Tool Call
MCP Server / Gateway
   ↓
OpenViking HTTP API
   ↓
VikingFS
```

对外暴露的工具可以是：

```text
list
tree
read
write
search
grep
glob
remember
```

## 12. 三种接口方式的取舍

| 方式 | 优点 | 缺点 |
| --- | --- | --- |
| 原生 Tool | 结构化、易鉴权、易观测 | 需要修改 Agent Tool Registry |
| `ov` CLI | 简单通用，可以和 Unix 命令组合 | 需要解析输出和管理 CLI 配置 |
| HTTP API | 跨语言、服务化清晰 | 需要自行封装 Agent 工具 |
| MCP | 适配多种 Agent 生态 | 需要维护 MCP Server |
| FUSE/真实挂载 | 接近本地文件系统体验 | 权限、缓存、一致性和语义索引更加复杂 |

OpenViking 当前的重点是“虚拟文件系统接口”，而不是将 `viking://` 强行挂载为本地目录。

## 13. 权限和隔离模型

OpenViking 的请求上下文通常包含：

```text
account
user
agent
actor_peer_id
role
namespace policy
```

在 VikingBot 中：

- API Key 对应 User；
- 当前聊天发送者对应 Peer；
- `actor_peer_id` 用于隔离不同聊天用户的记忆；
- Workspace ID 用于区分 shared、per-session 和 per-channel；
- Workspace ID 不能替代 OpenViking 的认证和权限系统。

因此：

```text
viking://user/alice/memories/
viking://user/bob/memories/
```

默认情况下属于两个不同的用户空间。

如果通过 Shell 执行 `ov`，实际上存在两套权限边界：

```text
Agent exec
  ↓
本地 Shell / Sandbox 权限
  ↓
ov CLI API Key
  ↓
OpenViking namespace 权限
```

所以不能因为 Agent 有 `exec`，就认为它可以无限访问 OpenViking 或本地文件。生产部署时需要使用合适的 Sandbox 后端和明确的文件、网络策略。

## 14. 多租户隔离如何实现

OpenViking 支持在同一个 Server 中服务多个团队、客户或应用。它的多租户并不是“每个租户部署一套服务”，而是通过 `account` 和 `user` 两层身份边界，在请求、存储、文件系统和检索链路中持续传递租户上下文。

官方多租户模型可以概括为：

```text
ROOT
 └── account（租户 / 团队 / 客户）
      ├── ADMIN
      │    └── 管理本 account 的用户和资源
      └── USER
           ├── user resources
           ├── memories
           ├── sessions
           └── peers
```

参考：[Multi-Tenant](https://github.com/volcengine/OpenViking/blob/main/docs/en/concepts/11-multi-tenant.md)

### 14.1 `account`：最外层租户边界

`account` 可以理解为一个团队、客户、工作区或 SaaS 租户：

```text
account-a
├── resources/
├── user/alice/
└── user/bob/

account-b
├── resources/
└── user/carol/
```

不同 `account` 之间默认完全隔离：

- 不能读取对方的文件；
- 不能列出对方的目录；
- 不能搜索到对方的向量记录；
- 不能读取对方的记忆和会话；
- 不能通过 ACL 跨租户共享资源。

公开 URI 仍然可以是：

```text
viking://resources/project-a/
```

但底层存储会自动带上租户前缀，概念上类似：

```text
/local/{account_id}/resources/project-a/
/local/{account_id}/user/alice/memories/
/local/{account_id}/user/alice/sessions/
```

也就是说，租户 ID 不要求暴露在 Agent 使用的公共 URI 中，而是由服务端从请求身份中解析并注入到底层路径和索引过滤条件中。

### 14.2 `user`：租户内的用户边界

`user` 是 account 内部的第二层隔离：

| 数据 | 默认隔离范围 |
| --- | --- |
| `viking://resources/` | account 内可共享 |
| `viking://user/{user}/resources/` | user |
| `viking://user/{user}/memories/` | user |
| `viking://user/{user}/sessions/` | user |
| `viking://user/{user}/peers/{peer}/` | user + peer |
| `viking://agent/skills/` | account 级共享能力 |

因此一个团队可以共享项目文档，但每个成员的用户偏好、会话和个人记忆仍然互相隔离。

### 14.3 `peer`：同一用户下的交互对象隔离

Peer 不是新的租户，也不会改变 account 或 user 身份，它用于区分同一个用户下的不同交互对象，例如不同聊天联系人、群聊或外部访客：

```text
viking://user/alice/peers/customer-001/memories/
viking://user/alice/peers/customer-002/memories/
```

请求可以携带：

```http
X-OpenViking-Actor-Peer: customer-001
```

这样文件系统和检索操作只能看到当前 Peer 的资源和记忆。Peer ID 只是当前 user 范围内的内容过滤条件，不能用来绕过租户权限。

### 14.4 认证模式

OpenViking 主要提供两种身份认证模式。

#### API Key 模式

```json
{
  "server": {
    "auth_mode": "api_key",
    "root_api_key": "your-secret-root-key"
  }
}
```

启用 `root_api_key` 后，系统进入正式多租户模式：

1. ROOT 使用 root key 创建 account。
2. ROOT 或 ADMIN 创建 account 内的用户。
3. Admin API 为用户生成 user key。
4. 普通业务请求携带 user key。
5. 服务端根据 user key 解析 `account_id`、`user_id` 和 role。

示例：

```bash
# ROOT 创建租户和第一个管理员
curl -X POST http://localhost:1933/api/v1/admin/accounts \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-root-key" \
  -d '{"account_id":"acme","admin_user_id":"alice"}'

# ADMIN 或 ROOT 创建普通用户
curl -X POST http://localhost:1933/api/v1/admin/accounts/acme/users \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <admin-or-root-key>" \
  -d '{"user_id":"bob","role":"user"}'

# 普通数据请求使用 bob 的 user key
curl "http://localhost:1933/api/v1/fs/ls?uri=viking://" \
  -H "X-API-Key: <bob-user-key>"
```

在 `api_key` 模式下，普通数据 API 不应该由调用方自行传递 `X-OpenViking-Account` 或 `X-OpenViking-User`，身份以 API Key 解析结果为准。

如果没有配置 `root_api_key`，服务通常处于开发模式，请求会被当作 ROOT，并使用 `default/default` 身份。这种模式只适合本机开发，不能用于真正的多租户部署。

#### Trusted 模式

如果 OpenViking 位于统一网关之后，可以使用：

```json
{
  "server": {
    "auth_mode": "trusted"
  }
}
```

由可信网关注入：

```http
X-OpenViking-Account: acme
X-OpenViking-User: bob
X-OpenViking-Role: user
```

这种模式适合已经有统一认证系统的企业部署，例如：

```text
用户登录 / JWT / SSO
        ↓
业务网关解析身份
        ↓
注入 OpenViking 身份 Header
        ↓
OpenViking 创建 RequestContext
```

Trusted 模式的前提是网关必须可信。不能让普通客户端自行提交这些 Header，否则客户端可以伪造租户和用户身份。非 localhost 部署时还需要配置 root key 或其他可信校验措施。

### 14.5 RequestContext 是权限控制的核心

一次请求进入服务端后，会被解析成类似下面的上下文：

```python
RequestContext(
    account_id="acme",
    user_id="bob",
    actor_peer_id="customer-001",
    role="user",
    group_ids=["engineering"],
)
```

之后这个上下文会贯穿：

```text
HTTP Router
    ↓
Service Layer
    ↓
VikingFS
    ↓
AGFS 路径访问

同时：

SearchService
    ↓
HierarchicalRetriever
    ↓
Vector Index 过滤
```

这点很重要：权限不能只在 `read_file` 时检查。如果检索阶段没有做相同的租户过滤，用户虽然不能读取文件，却可能通过搜索结果看到别的租户的标题、摘要或 URI。

因此 OpenViking 同时在两个地方隔离：

1. VikingFS 在文件系统操作时检查 account、user、peer 和 ACL。
2. Retrieval 在向量检索时应用相同的 account、user、peer 和 ACL 条件。

官方文档将其概括为：搜索结果必须和文件系统实际可读取的内容保持一致。[Multi-Tenant](https://github.com/volcengine/OpenViking/blob/main/docs/en/concepts/11-multi-tenant.md)

## 15. 权限控制如何实现

OpenViking 的权限控制可以分为三层：

```text
第一层：身份和角色
        ROOT / ADMIN / USER

第二层：命名空间边界
        account / user / peer

第三层：资源 ACL
        shared resources 下的 user / group 授权
```

### 15.1 角色权限

| 角色 | 范围 | 典型能力 |
| --- | --- | --- |
| ROOT | 全局 | 创建/删除 account、管理用户、系统管理 |
| ADMIN | 单个 account | 管理本租户用户、用户 key 和共享资源 |
| USER | 单个 account | 访问自己的用户数据和 account 内可访问的共享资源 |

角色主要控制“谁有资格执行管理操作”，而不是替代所有资源级权限判断。

例如：

- ROOT 可以创建 account；
- ADMIN 可以在自己的 account 中创建用户；
- USER 不能管理用户；
- USER 只能访问自己用户空间中的记忆和会话；
- account 内共享资源是否可写，还要继续经过资源 ACL 判断。

### 15.2 ACL 资源授权

ACL 当前主要应用于：

```text
viking://resources/...
```

也就是 account 内的共享资源。用户私有资源：

```text
viking://user/{user_id}/resources/...
```

默认不接受 ACL；如果需要共享，应将资源放入可写的共享目录中。

ACL 的主体可以是：

```text
user:{user_id}
group:{group_id}
user:*
```

权限级别有三种：

| 级别 | 能力 |
| --- | --- |
| `read` | 读取、列目录、`find`、`search`、`grep`、`glob` |
| `write` | `read` 能力，加写入、创建、文件删除、文件移动和标签更新 |
| `manage` | `write` 能力，加目录删除、目录移动和 ACL 管理 |

权限具有包含关系：

```text
manage ⊃ write ⊃ read
```

### 15.3 ACL 的目录继承

ACL 采用类似协同文档的继承模型：父目录授权会持续作用于子目录和文件，子节点可以增加直接授权，但不会覆盖父节点权限。

```text
viking://resources/project/
    read user:bob
        ↓ 继承
viking://resources/project/docs/
    write group:engineering
        ↓ 继承
viking://resources/project/docs/api.md
    read user:carol
```

最终 `api.md` 的有效权限是所有祖先直接授权和自身直接授权的并集：

```text
effective_acl(node)
  = union(direct_acl(each ancestor), direct_acl(node))
```

例如：

```bash
# Bob 可以读取整个目录树
ov acl grant viking://resources/project/ \
  --principal user:bob --level read

# engineering 组可以修改目录树
ov acl grant viking://resources/project/ \
  --principal group:engineering --level write

# 删除 Bob 在当前节点上的直接授权
ov acl revoke viking://resources/project/ \
  --principal user:bob
```

如果祖先目录仍然授权 Bob，那么撤销当前节点的直接授权后，Bob 仍然可能通过继承获得访问权。

参考：[Resource Access Control](https://github.com/volcengine/OpenViking/blob/main/docs/en/concepts/15-acl.md)

### 15.4 文件操作与权限级别映射

服务端会先规范化 URI，然后统一执行 account/user/peer 边界检查，再执行 ACL 检查：

| 操作 | 所需能力 |
| --- | --- |
| `read`、`stat`、`ls`、`tree` | `read` |
| `find`、`search`、`grep`、`glob` | `read` |
| `write`、`create`、`mkdir`、set tags | `write` |
| 删除或移动文件 | `write` |
| 删除或移动目录 | 目录和完整子树的 `manage` |
| 管理 ACL | `manage` |
| 移动到目标目录 | 目标父目录的 `write` |

目录删除比文件删除要求更高，是为了避免用户拥有某个文件的写权限后，可以通过删除父目录绕过权限模型。

### 15.5 向量检索中的 ACL 过滤

ACL 不只存在于文件系统层。向量索引中的 Context Record 会保存与 ACL 有关的字段，例如：

```text
acl_enabled
acl_direct_grants
acl_inherited_grants
```

检索请求会根据当前 RequestContext 构造主体集合：

```text
user:{ctx.user_id}
user:*
group:{ctx.group_ids}
```

然后在 `viking://resources` 范围内，只匹配当前用户实际有权访问的记录。否则会出现“搜索看到了标题，但读取时被拒绝”的信息泄漏问题。

### 15.6 存储加密是第二道防线

逻辑权限之外，OpenViking 还支持数据静态加密。不同 account 使用独立的 Account Key，VikingFS 在读写层透明地完成加解密，AGFS 和对象存储只看到密文。

```text
应用写入明文
    ↓
VikingFS 加密
    ↓
AGFS / Object Storage 保存密文
```

即使攻击者直接获得底层存储访问权限，也不能仅凭磁盘内容读取其他租户的数据。这属于存储层防护，不能替代 API 层的身份认证和 ACL。[Data Encryption](https://github.com/volcengine/OpenViking/blob/main/docs/en/concepts/10-encryption.md)

### 15.7 多租户部署的推荐配置

生产环境建议：

```text
1. 配置 root_api_key，关闭默认开发身份
2. ROOT key 只用于 Admin API，不用于普通业务请求
3. 为每个 account 创建独立用户 key
4. 普通 Agent 使用 user key
5. 网关场景使用 trusted 模式，但只允许可信网关注入身份 Header
6. 所有检索和文件操作都携带 RequestContext
7. 对 shared resources 使用 ACL，而不是把所有数据放进公共目录
8. 为 AGFS 配置静态加密和独立 Account Key
9. Agent Shell 使用 Sandbox，避免 ov CLI 拥有无边界的本地权限
```

一个适合 SaaS 场景的调用链如下：

```text
客户 A 登录
    ↓
网关解析 tenant_id=account-a, user_id=alice
    ↓
创建 OpenViking RequestContext
    ↓
Agent 调用 find / read / write
    ↓
VikingFS 检查 account-a / alice / ACL
    ↓
Retriever 使用相同条件过滤向量索引
    ↓
只返回客户 A 且 Alice 有权访问的上下文
```

## 16. 对自媒体 Agent 项目的借鉴

对于一个自媒体运营 Agent，可以将上下文组织成：

```text
viking://resources/media-platform/
├── xiaohongshu/
├── bilibili/
├── wechat/
└── douyin/

viking://user/{user}/
├── memories/
│   ├── preferences/
│   ├── entities/
│   ├── events/
│   └── experiences/
├── resources/
│   └── media-project/
└── sessions/

viking://agent/skills/
├── write-xhs-post/
├── generate-video-script/
├── analyze-hot-topic/
└── publish-content/
```

一次“写一篇小红书笔记”的调用过程可以是：

```text
用户提出任务
    ↓
读取用户画像和写作偏好
    ↓
读取小红书平台 Skill
    ↓
检索历史高表现文章
    ↓
生成文章草稿
    ↓
写入本地 Workspace
    ↓
通过 OpenViking write 保存结果或经验
    ↓
Session Commit 提取长期记忆
```

建议将工具边界设计为：

```text
本地 Workspace：
  read_file
  write_file
  edit_file
  exec

OpenViking Context：
  ov_list
  ov_find
  ov_read
  ov_write
  ov_search
  ov_memory_commit
```

不要让 Agent 直接通过 Shell 访问 AGFS 的真实路径。更合理的调用链是：

```text
Agent → ov CLI / HTTP API / MCP → VikingFS → AGFS
```

这样才能保留 URI 规范化、权限控制、用户隔离、语义索引、异步处理、Session 生命周期和调用轨迹。

## 17. 总结

OpenViking 的核心可以归纳为四点：

1. 用 `viking://` 把 Resource、Memory、Skill 和 Session 统一为文件系统。
2. 用 L0/L1/L2 将上下文从“全文召回”变成“逐级展开”。
3. 用目录级层次检索替代单纯的平面向量搜索。
4. 用 AgentLoop、ContextBuilder、ToolRegistry 和 Session Commit 将上下文数据库接入 Agent 生命周期。

Agent 通过 Shell 操作 OpenViking 有两种不同含义：

1. 通过 `exec` 执行 `ov`，由 CLI 调用 HTTP API；
2. 先使用实验性的 FUSE 适配层挂载本地目录，再让标准 Shell 命令通过操作系统 VFS 访问挂载点。

第一种方式执行的是：

```bash
ov ls
ov tree
ov read
ov write
ov grep
ov glob
ov find
```

无挂载时由 CLI 通过 HTTP API 调用 Service Layer，最终由 VikingFS 访问 AGFS 和向量索引。

如果使用 FUSE，则调用链变为：

```text
ls/cat/find/grep /mnt/openviking/...
    ↓
操作系统 VFS
    ↓
FUSE 回调
    ↓
OpenVikingMount / VikingClient
    ↓
OpenViking HTTP API
```

需要强调，FUSE 是仓库中可选的实验适配层，不是默认 AgentLoop，也不是当前最主要的 Codex 集成方式。Codex 默认通过生命周期 Hook 和 MCP Proxy 集成 OpenViking。

这套设计同时保留了文件系统的可理解性、数据库的索引能力，以及 Agent 所需要的上下文渐进加载和长期记忆能力。
