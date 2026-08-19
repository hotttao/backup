---
weight: 1
title: "Base Agent Context 管理"
date: 2026-07-03T23:00:00+08:00
lastmod: 2026-07-03T23:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Base Agent 如何实现上下文管理"
featuredImage:

tags: ["base_agent"]
categories: ["agent_core"]

lightgallery: true
---

Context 管理包括:
1. Context Compact

<!-- more -->

## 1. Compact 
### 1.1 Compact 的实现
上下文压缩一比一复刻了 ![Claude Code 的提示词](../claude_code/003_cc.md)。然后剔除了跟 Coding 强相关的内容。

为了压缩之后，用户可以看到完整的 message，Context 区分了 active_messages 和 messages。
1. active_messages: 模型正在使用的 message
2. messages: message 所有历史 

Compact 的过程就是使用压缩后的上下文覆盖 active_messages。

```python
class Context:
    def __init__(self, messages: Sequence[ModelMessage] = ()) -> None:
        self._messages: list[ModelMessage] = list(messages)
        self._copilot_responses: list[CopilotResponse] = []
        self._active_messages: list[ModelMessage] = list(messages)

    def add_messages(self, messages: Sequence[ModelMessage]) -> None:
        self._messages.extend(messages)
        self._active_messages.extend(messages)

    def add_copilot_responses(self, responses: Sequence[CopilotResponse]) -> None:
        self._copilot_responses.extend(responses)

    def get_messages(self) -> list[ModelMessage]:
        return list(self._messages)

    def get_copilot_responses(self, tool_call_ids: Sequence[str]) -> list[CopilotResponse]:
        ids = set(tool_call_ids)
        return [response for response in self._copilot_responses if response.tool.call_id in ids]

    def to_model_messages(self) -> list[ModelMessage]:
        return list(self._active_messages)

    async def compact(self, model: Model | None = None) -> dict[str, str]:
        compactor = model or models.compactor
        request_parameters = ModelRequestParameters(output_mode="text")
        messages: list[ModelMessage] = [
            ModelRequest(parts=[SystemPromptPart(SYSTEM_COMPACT)]),
            *self.to_model_messages(),
            ModelRequest(parts=[UserPromptPart(COMPACT_INSTRUCTION)]),
        ]
        wire_messages = compactor.prepare_messages(messages, request_parameters)
        response = await compactor.request(wire_messages, None, request_parameters)
        text = response.text or ""
        analysis, summary = parse_analysis_summary(text)

        self._active_messages = [
            ModelResponse(
                parts=[TextPart(summary.strip())],
                model_name=response.model_name,
                provider_name=response.provider_name,
            )
        ]
        return {"analysis": analysis, "summary": summary}
```

### 1.2 Compact 的触发时机
Compact 触发时机通常有两个:
1. 接近模型上下文窗口时，自动触发
    - 需要对 token 的解析和估算
    - 维护常见模型的上下文窗口大小
2. 通过 command 手动触发