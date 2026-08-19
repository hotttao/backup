---
weight: 1
title: "Cluade 云上 Agent 记忆系统"
date: 2026-04-03T22:00:00+08:00
lastmod: 2026-04-03T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "深入拆解 Cluade 云上 Agent 记忆系统"
featuredImage:

tags: ["Claude Code"]
categories: ["agent_core"]

lightgallery: true
---

今天我们来学习 Claude Code 最新实现的记忆系统。内容来自: ![深度拆解 Cluade 云上 Agent 记忆系统](https://app.koala-oss.club/videos/6f968f84-cb35-4243-a0cb-eebc136d7ae9)

我个人觉得这篇内容是非常值得反复学习的，里面对如何实现记忆系统有非常深入的理解。接下来我们将详细介绍以下内容:
1. 什么是 CMA，它的记忆系统与 Claude Code 记忆系统的有何异同，Anthropic 始终坚持基于文件系统实现记忆系统而不是 RAG
2. 基于文件实现的记忆系统提供给 Agent 的 Interface
3. 对比文件实现的记忆系统与 RAG 优势与劣势
4. 如何实现记忆系统里文件到数据库的读写链路

<!-- more -->


## 1. Cloud Managed Agent（CMA）
### 1.1 什么是 CMA
CMA 是 Anthropic的 agent as a service这样的一个产品。他与 Claude Code 的区别在于这些托管的agent是跑在Anthropic的云上基础设施里边的，所以就更加接近于Saas service这样的一个形态。

![CMA 架构](/images/aigc/cc/image.png)

从架构图上可以看到，对于一个云上运行的 agent，Anthropic 要把一些内容给解耦开。
1. Harness: 核心大脑（Agent Core）就是 Claude Code；
2. cloud code 把所依赖的一些能力外置到平台上去，包括
    2. Session: Session 管理
    3. Sandbox: 沙箱执行
    4. Tools: 工具调用、MCP集成等能力
    4. Orchestration: 任务的编排 


### 1.2 新一代记忆系统
Anthropic 新一代的记忆系统，已经让 Claude code 还有它的CMA 彻底统一打通了。

#### CMA 记忆系统 vs Claude Code 记忆系统
首先他们之间绝大部分东西都是共享，因为核心 Harness 都是 Claude Code。

相同点:
1. 底层内核都是 Claude Code / Claude Agent SDK，接口实现相似；
2. **文件优先路线，不使用 Embedding、向量RAG做语义检索**，发挥 agent 对于文件的理解能力；规避向量带来的复杂度与不稳定问题；
3. 共用一套 `dreaming`后台记忆处理机制。



核心差异:
1. Claude Code：记忆保存在**用户本地**；
2. CMA：新增**记忆库抽象层**
    - 记忆库可绑定单个Agent，也支持**多个云上Agent挂载共享同一份记忆库**，同时每个Agent还可以保留自身独立记忆；
    - 为实现多Agent共享，CMA记忆读写的数据链路和本地Claude Code完全不同；
    - 逆向推断技术实现：大概率基于 **FUSE**，记忆实际存数据库，但Agent侧操作体验如同操作普通文件。


### 1.3 dreaming 机制

Dreaming 之所以重要，使用所有 Agent 系统都存在共同的痛点:
1. **记忆的读取（召回）**：我们希望的是按需读取，显然我们不希望一次性读取所有记忆，也不希望太懒惰始终不读取。可以通过提示词引导Agent按需读取记忆；读取的积极性和准确度，是可以通过提示词强调的。
2. **记忆的写入（整理）**：记忆的更新大多依赖用户手动指令“帮我记下来”。而 Agent 自我的记忆的写入触发是非常不积极的、记忆的整理也不够积极，

dreaming 机制的核心是它会定期的去扫描会话，然后用一个专有的写入的机制去对已有的所有记忆做一次整理。这样即便会话里边没有及时的记忆，但只要会话数据还在，就可以重新扫描一遍做一次记录。

## 2. 记忆系统 Agent 视角的 Interface

![CMA 记忆系统 Agent 视角的 Interface](/images/aigc/cc/agent_interface.png)

Agent 视角:
1. 每一个记忆库对应一个根目录
2. 每一个根目录下，都有一个索引文件，叫 MEMORY.md，他是对这个记忆库里边所有文件的一个概览(Short Summary)，并保存了每个文件的绝对路径。
3. System Prompt 会 Inline Agent 所能看到的所有记忆库的索引文件。所以记忆读取的整个过程中，系统提示词不会携带任何一条记忆的实际内容。

Agent 是否会读取某一个记忆条路，完全由agent自己来驱动了:
1. Agent 通过 Short Summary 判断内容相关就会读取
2. Agnet 判断这个short summary对他当前的会话已经无关或者已经足够，就不会召回。

对于 Agent 来说可能有多个记忆库，而基于文件系统的接口，Agent 可以有很多的文件的工具对多文件做 `拼接，关键词的检索，或者非全量的读取`。这对 TOKEN 来说非常的友好。这就是基于文件去做记忆的好处。

**索引文件的机制，从 skills 开始就被广泛使用**

#### System Prompt
![System Prompt](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/system-prompt-memory-instructions.md?plain=1)

<h4>Memory / 记忆</h4>

<table>
  <thead>
    <tr>
      <th>English</th>
      <th>中文</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><pre><code>&lt;!--
name: "System Prompt: Memory instructions"
description: "Instructions for using persistent file-based memory, including memory file format, scope, indexing, and stale-memory handling"
ccVersion: "2.1.227"
variables:
  - "MEMORY_LOCATION_CONTEXT"
  - "MEMORY_LINKING_INSTRUCTIONS"
  - "MEMORY_TYPE_DESCRIPTIONS"
  - "TEAM_MEMORY_SCOPE_NOTE"
  - "MEMORY_INDEX_POINTER_INSTRUCTIONS"
  - "MEMORY_SAVE_EXCLUSIONS"
  - "RECALLED_MEMORY_VERIFICATION_GUIDANCE"
  - "MEMORY_CITATION_INSTRUCTIONS"
  - "HAS_PROJECT_SKILL_UPKEEP_INSTRUCTIONS_FN"
  - "PROJECT_SKILL_UPKEEP_INSTRUCTIONS"
--&gt;</code></pre></td>
      <td><pre><code>&lt;!--
名称：系统提示词——记忆说明
描述：关于使用基于文件的持久化记忆的说明，包括记忆文件格式、作用域、索引和过期记忆处理
Claude Code 版本：2.1.227
变量：
  - "MEMORY_LOCATION_CONTEXT"：记忆存储位置上下文
  - "MEMORY_LINKING_INSTRUCTIONS"：记忆关联说明
  - "MEMORY_TYPE_DESCRIPTIONS"：记忆类型说明
  - "TEAM_MEMORY_SCOPE_NOTE"：团队记忆作用域说明
  - "MEMORY_INDEX_POINTER_INSTRUCTIONS"：记忆索引指针说明
  - "MEMORY_SAVE_EXCLUSIONS"：不应保存为记忆的内容
  - "RECALLED_MEMORY_VERIFICATION_GUIDANCE"：召回记忆的验证指南
  - "MEMORY_CITATION_INSTRUCTIONS"：记忆引用说明
  - "HAS_PROJECT_SKILL_UPKEEP_INSTRUCTIONS_FN"：判断是否包含项目技能维护说明的函数
  - "PROJECT_SKILL_UPKEEP_INSTRUCTIONS"：项目技能维护说明
--&gt;</code></pre></td>
    </tr>
    <tr>
      <td>You have a persistent file-based memory <code>&#36;{MEMORY_LOCATION_CONTEXT}</code>. Each memory is one file holding one fact, with the following frontmatter:</td>
      <td>你拥有基于文件的持久化记忆 <code>&#36;{MEMORY_LOCATION_CONTEXT}</code>。每条记忆对应一个文件，其中只保存一个事实，并包含以下 frontmatter：</td>
    </tr>
    <tr>
      <td><pre><code>---
name: &lt;short-kebab-case-slug&gt;
description: &lt;one-line summary, used to decide relevance during recall&gt;
metadata:
  type: user | feedback | project | reference
---

&lt;the fact; for feedback/project, follow with **Why:** and **How to apply:** lines. Link related memories with [[their-name]].&gt;</code></pre></td>
      <td><pre><code>---
name: &lt;使用 kebab-case 的简短名称&gt;
description: &lt;单行摘要，用于在召回时判断相关性&gt;
metadata:
  type: user | feedback | project | reference
---

&lt;记忆所记录的事实；对于 feedback/project 类型，后面需要添加 **Why:** 和 **How to apply:**。使用 [[记忆名称]] 链接相关记忆。&gt;</code></pre></td>
    </tr>
    
  </tbody>
</table>


#### 索引文件的维护
对于索引文件:
1. 索引文件在CMA里完全由 agent 维护，当agent每新增一个记忆去写入的时候，CMA的提示词都会要求它必须要同步地来刷新一下这个索引文件，来保持两者的一致性。

所以在CMA里，索引文件的有效性新鲜度非常依赖于 agent的智力和这个提示词引导的，它本身的这个程序化的约束是非常简单甚至可以说是非常弱的。dreaming机制会做一个兜底，当他发现整个记忆库里边有一些预期之外没有整理好的内容的时候呢，dreaming 会再次补偿再次修正。

#### 记忆文件格式

```yaml
name: <short-kebab-case-slug>
description: <one-line summary, used to decide relevance during recall>
metadata:
  type: user | feedback | project | reference
```

系统提示词里，约束了记忆文件需要包含的元数据:
1. name: 记忆条目的名字
2. description: 一个短的一行的总结
3. metadata.type: 记忆类型:
    - 用户类的记忆
    - 反馈类的记忆
    - 项目相关的记忆
    - 引用相关的记忆。
    
我们再次验证了CMA的这种宽松和约束的一个边界: **API程序化的部分宽松，提示词的部分约束**。

这样的灵活性就比较高，因为有可能它未来也会发现说这一套分类方法不够灵活，那就换一个。那这个时候他只要调整他的提示词，然后重新跑一遍他这个dream的整理，就可以把他的记忆重新整理成未来的格式了，而不需要去改造整个大的存储系统的 API系统。所以这也是一种面向agent的设计工具现在看来蛮灵活的一个思路。**这个思路也反应在当下 Agent的实现中。在提示词内实现 Workflow 而不是使用 Agent Framework框架。**

## 3. 两种类型记忆系统的对比

![记忆系统读写工具](/images/aigc/cc/mem_tool.png)

专门给 Agent 开发的记忆系统，比如说super memory、mem0:
1. 通常以`数据库+向量数据库`实现。
2. 需要一套 API，并进一步封装为 MCP 或者专用的SDK供 Agent 去读写记忆系统里边的信息，包括:
    1. read memory: 包括 read、list 等
    2. Update memory: 包括覆盖、追加
    
在这里就会发现，当你的记忆内容变得越来越长越来越多的时候，通常你的API都是不够用的，或者说你就需要拓展出非常非常多的API。

比如读可能需要:
1. 搜索的能力
2. 读几行的能力
3. 类似 GREP 抓取的能力。

写可能需要:
1. 替换的能力
2. 关键词匹配的能力
3. 也可能有追加、覆盖，拷贝(比如把另一个记忆拷贝到这个记忆里边)。

一旦你有这么多的需求之后，你最后会发现还不如文件系统的语义是更能够承接这些能力。因为在文件系统里边 bash 或者是 Agent 封装过的二次工具，都有非常强的能力完成文件的各种操作，而且 Agent 非常的熟悉，这就是它一个巨大的优势。

通过 API 去实现这些能力，不说别的，把 sed 包装成一套API，都是一个巨大的工作量，而且包装完之后，Agent还要去学习你那套API，或者说他也理解为那就是一个sed。如果你需要的是 sed，你为什么不直接用一个文件加上原生的sed呢。这就是anthropic的一种思路，所以他们一直都坚持就是万物皆文件，当然记忆也作为文件的方式来用来带来一个更好的 Agent 方面的性能。

## 4. 记忆文件系统的实现
### 4.1 分布式文件系统实现
对于 Claude Code 单机形态的应用，文件系统是很自然的形态。但是对于 CMA 的记忆库，他是有共享的需求的。也就是一套文件挂给两个agent。

最直观的实现是使用共享的文件系统，所有 CMA 运行单元通过挂载共享。但是这种实现有一些明显的问题:
1. 实现比较的重，因为一个分布式的文件系统其实还是相对来讲非常复杂的。而记忆文件这个场景呢相对来说又没有那么的啊强的必要性
2. CMA 从API上，可以看到它有版本管理的能力，具备回滚的能力。

agent是不会主动去帮你做这个文件管理的，所以如果在分布式文件系统上上叠加一套针对特定文件的自动化的多版本的管理实现起来难度就非常高了。

### 4.2 数据库 + FUSE
CMA 的实现: 
1. 把记忆存储在数据库
2. 通过 FUSE 挂载截获所有的文件操作，实现跟数据库的交互

实现的过程:
1. 一个记忆库对应一个特定的目录
2. 写一个fuse的程序，通过文件系统挂载，专门监听这个目录下边所有的文件的写入过程。
3. 劫持的这个位置是在非常底层的位置，上层不管是用什么样工具去写入的文件，都可以被正确地截取到。
4. 而且这个劫持的时机是可以阻塞这次写入的，业务逻辑先处理成功才放行这次文件的写入，如果业务逻辑没有处理成功那这次写入就会失败。这样就可以避免文件写入成功，但是数据库更新失败，两者不一致。

这样的逻辑下:
1. 文件系统被简化，Agent 可以继续去使用一个简单常规的单机的文件系统
2. 在数据库里，可以用各种的应用层的代码，甚至是数据库自己的能力去实现多版本的自动的产生和管理
3. dreaming 的运行不需要深入到文件系统层面去扫描文件，只需要在这个数据库层面就能够拉取到所有的消息然后和记忆去做一个汇总。


![fuse 截获更新数据库流程](/images/aigc/cc/fuse.png)


完整的读写流程如上，这里我们不再详细介绍。后面在介绍 Agent Platform 的实现的时候，我们会详解介绍里面的实现细节。

## 5. 个人总结
基于`文件系统+文件索引`实现的记忆系统具有明显的先进性。但是存在一个明显的局限性: **你的 Agent 首先必须有一个文件系统**。这个对你的 Agent 应用形态就有明显的限制。

CMA 基于 Claude Code 或者 Claude Code SDK 实现，Agent Core 本身以单独的进程存在。通常一个 Agent 对应一个虚拟机(虚拟机对用多种形态)。但是本质上，Agent Core 是运行在一个操作系统内的，向本地一样有一个可用的文件系统。

但是对于像 Langgraph 这些 Agent Framework 开发的 Agent，Agent 本身只是服务进程里的一个对象。他不会存在与之对应的文件系统。

Agent Core 独立进程的这种形态，本身实现比较重。比较适合企业级用户。同一部门内部，他们有共同的需求可以使用同一个 Agent。通过 Session 区分不同的用户。

但是对于 ToC 用户。不可能给每一个用户创建一个虚拟机。