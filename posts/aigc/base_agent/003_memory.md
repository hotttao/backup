---
weight: 1
title: "Base Agent 记忆提取"
date: 2026-07-03T22:00:00+08:00
lastmod: 2026-07-03T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Base Agent 如何实现记忆提取"
featuredImage:

tags: ["base_agent"]
categories: ["agent_core"]

lightgallery: true
---

记忆的实现包含如下的核心逻辑:
1. 记忆提取的提示词
2. 记忆的召回
3. 记忆的更新

<!-- more -->

## 1. 记忆提取提示词设计

记忆提取不是一个工作流，而是一个工具，类似与程序里的函数，所以他的提示词核心部分是：

1. Input: 已有记忆+用户反馈
2. Rules: 提取规则
3. Output: 提取结果

```md
# Role

You are a memory engine that extracts durable user preferences from the current feedback
and updates the memory base in one pass (extract → decide → upsert).

# Input

<feedback>
Status: ${res.status}
FileID: ${req.file_id}
${
  res.status === "refined"
    ? `User adjusted the LLM input.
<from>
${req.translate_string}
</from>
<to>
${res.translated_string}
</to>`
    : ""
}
${
  res.status === "reject"
    ? `User rejected the LLM output. Reason: ${res.reason}`
    : ""
}
</feedback>

<previous_profile>
${currentMemory}
</previous_profile>

# Rules

- Extract only durable, reusable preferences (terminology mapping, style/tone rules, stable choices).
- Ignore temporary or one-off details.
- For each memory item, write the 'text' as a full instruction sentence
  that already includes when/where this rule applies, and give a short inline example.
- Keep the text concise but self-contained (≤120 chars).
- Tags: use a small fixed set to reduce options:
  ["terminology","style","preference"].

# Output

Return strict JSON:
{
"ops": [
{
"action": "add" | "update" | "delete",
"index": number, // index of the existing memory item to update/delete; for add use -1
"text": "string", // for add or update: the new or updated memory text
"tags": ["terminology"|"style"|"preference"] // for add or update
}
]
}

Rules for actions

- "add": for a new stable preference not in current_memory (index = -1).
- "update": when a current memory needs refinement or correction.
- "delete": when a current memory is invalid or contradicted.
- Do not output anything else except the JSON above.

Return strict JSON only, no commentary.
```

提示词里使用的是结构化提取记忆:
1. 每一条记忆都有索引
2. 索引更新不是简单的添加，而是会根据已有记忆做合并，对应的更新有`add`、`update`、`delete`三种操作


## 2. Memory 的接口设计

```python
class MemoryProtocol(Protocol):
    """AgentLoop 依赖的最小记忆接口，具体实现可以是文件、数据库或远程服务。"""

    async def init(self) -> None:
        """加载持久化数据并建立当前会话使用的内存快照。"""
        ...

    async def extract_memory(self, *, req: CopilotRequest, res: CopilotResponse) -> bool:
        """从一次翻译请求和人工反馈中提取偏好，更新并保存记忆。"""
        ...

    def provide_memory(self) -> str:
        """把当前记忆格式化成可直接加入模型系统提示词的文本。"""
        ...
```

## 3. 记忆的召回
记忆的召回是在 system.workflow 的 Prompt 中添加记忆内容实现的:

```md
${
  currentMemory
    ? `# User preferences

The following preferences were emphasized in prior interactions; please follow them:
${currentMemory}`
    : ""
}
```

## 4. 记忆的更新
记忆的更新时机我们在 Copilot Handler 已经介绍过了，在每次 Copilot Response 后，都会调用 extract_memory，从用户反馈中提取偏好。