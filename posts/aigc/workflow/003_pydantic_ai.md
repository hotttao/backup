---
weight: 3
title: "Pydantic AI 基本使用"
date: 2026-08-10T10:00:00+08:00
lastmod: 2026-08-10T10:00:00+08:00
draft: false
author: "tao"
description: "理解 Pydantic AI 的 Model、Profile、Message、结构化输出和 ToolDefinition，并实现完全自控的 AgentLoop"

tags: ["workflow"]
categories: ["agent_core"]

lightgallery: true
---

这一节我们来简单介绍 Pydantic AI 的基本使用。后面我们会基于 Pydantic AI 实现自己的 Agent。

<!-- more -->

## 1. 自定义 AgentLoop

我们不关心 Pydantic AI 提供的 Agent Loop 功能，所以我们只需要关心其如下抽象:

```text
业务 AgentLoop
  ├── ToolContract + Handler Registry   # 我们定义、我们执行
  ├── Pydantic TypeAdapter/BaseModel    # 参数和返回值校验
  ├── ModelMessage / MessagePart        # 跨供应商历史
  ├── ModelRequestParameters            # 工具与输出协议
  └── Model.request()                    # 供应商适配、请求和响应归一化
```

不要实例化 `pydantic_ai.Agent`，也不要调用 `Agent.run()`、`Agent.iter()` 或内部的 `_agent_graph`。`Tool` 也不是必需的：它同时封装了函数签名推导和执行期行为；自定义循环更适合把声明整理成 `ToolDefinition`，执行器由应用自己维护。

## 2. Model 的抽象

`pydantic_ai.models.Model` 是供应商无关的抽象基类。最小的非流式调用接口是：

```python
async def request(
    messages: list[ModelMessage],
    model_settings: ModelSettings | None,
    model_request_parameters: ModelRequestParameters,
) -> ModelResponse: ...
```

三个输入分别表示：

1. `messages`：完整的、供应商无关的会话历史；
2. `model_settings`：温度、最大 token、是否允许并行工具调用等通用设置，也可使用供应商专属的 Settings；
3. `model_request_parameters`：本次可用的函数工具、原生工具、输出工具和结构化输出模式。

具体实现如 `OpenAIChatModel`、`AnthropicModel`、`GoogleModel` 负责把这些对象翻译成供应商 SDK 的请求，再把 SDK 返回值归一化成 `ModelResponse`。`request_stream()` 是对应的流式接口，`count_tokens()` 是可选接口。

直接使用模型层时要留意两个准备步骤：

- 具体模型的 `request()` 会调用自己的 `prepare_request()`：合并默认设置与单次请求设置、根据 profile 处理工具和输出 schema、检查不支持的能力；调用者不应再提前调用一次，以免重复准备。
- `prepare_messages()` 不一定由具体模型的 `request()` 调用。它负责把跨供应商历史转换成当前供应商可接受的形状。自定义循环应在 `request()` 前显式调用它。

因此，底层调用的稳定形状是：

```python
wire_messages = model.prepare_messages(history, request_parameters)
response = await model.request(wire_messages, model_settings, request_parameters)
```

`model.prepare_messages()` 的结果是线上请求视图；持久化历史时仍应保存原始的规范化 `ModelMessage`，不要用供应商投影视图替换它。

## 3. 如何处理模型能力差别

Pydantic AI 没有把能力判断散落成一组模型名称判断，而是集中在 `Model.profile`。`ModelProfile` 中与本文最相关的字段有：

| 字段 | 含义 |
|---|---|
| `supports_tools` | 是否支持普通函数/输出工具 |
| `supports_tool_return_schema` | API 是否原生接受工具返回值 schema |
| `supports_json_schema_output` | 是否支持原生 JSON Schema 输出 |
| `supports_json_object_output` | 是否支持只约束为 JSON object |
| `supports_thinking` | 是否接受统一的 thinking 设置 |
| `supported_native_tools` | 实际支持的供应商原生工具集合 |
| `default_structured_output_mode` | `auto` 最终落到 `tool`、`native` 还是 `prompted` |
| `json_schema_transformer` | 将标准 JSON Schema 改写成供应商可接受的子集 |

profile 的合并顺序是：`DEFAULT_PROFILE` → provider 根据模型名给出的 profile → 用户传给模型构造器的覆盖值。原生工具还会与模型适配器真正实现的工具取交集，因此 profile 是“声明能力”和“适配器实现能力”合并后的有效结果。

最佳实践是：

1. 依据 `model.profile` 选择协议，不在 AgentLoop 中硬编码模型名称；
2. 让 `model.request()` 内的 `prepare_request()` 完成 schema 转换和最终能力校验；
3. 对核心语义做显式降级，不能可靠降级时尽早失败。

结构化输出通常有三种策略：

| 模式 | `output_mode` | 传输方式 | 适用场景 |
|---|---|---|---|
| 原生 schema | `native` | 供应商的 response format / JSON Schema | profile 声明 `supports_json_schema_output` |
| 输出工具 | `tool` | 模型调用一个 `kind='output'` 的工具 | 已有工具循环，跨供应商最容易统一 |
| 提示词 JSON | `prompted` | schema 写入提示词，再解析文本 | 不支持前两者时的弱约束回退 |

本文的完整示例选择“输出工具”。原因是循环本来就依赖工具能力，最终结果也走 `ToolCallPart`，路由、重试和校验只有一套逻辑。如果模型连 `supports_tools` 都不具备，则这个 AgentLoop 的核心能力不存在，应直接报错，而不是假装工具调用仍然可靠。

工具的返回 schema 是另一类能力。`ToolDefinition(return_schema=..., include_return_schema=True)` 表示我们希望把输出契约告诉模型：支持原生返回 schema 的供应商会使用结构化字段；不支持的供应商由模型准备阶段把 schema 以 JSON 文本加入工具描述。这只是帮助模型理解结果，不代替应用在运行时校验工具返回值。

## 4. 模型返回结果如何格式化

模型层只做两件事：

1. 把供应商响应归一化成 `ModelResponse.parts`；
2. 提供 `response.text`、`response.tool_calls`、`response.thinking`、`response.files` 等便捷视图。

它不会在直接调用 `Model.request()` 时自动把最终结果变成你的 `BaseModel`。内置 `Agent` 中的那部分工作属于 AgentLoop。自定义循环必须自己：

1. 给模型发送 JSON Schema；
2. 找到承载最终结果的 part；
3. 使用 `BaseModel.model_validate()` 或 `TypeAdapter.validate_python()` 校验；
4. 校验失败时构造 `RetryPromptPart`，把错误送回模型。

对工具输出模式，最终对象位于输出工具调用的 `ToolCallPart.args` 中；对原生和 prompted 模式，通常从 `response.text` 取得 JSON，再用 `TypeAdapter.validate_json()`。无论供应商是否宣称 strict，都应保留本地校验，因为线上配置、代理服务和模型行为仍可能偏离契约。

## 5. Message 的抽象

消息有两级可辨识联合类型。

第一级是消息方向：

```python
ModelMessage = ModelRequest | ModelResponse
```

- `ModelRequest.kind == 'request'`：应用发给模型的消息；
- `ModelResponse.kind == 'response'`：模型返回给应用的消息。

第二级是消息中的 part。常用类型如下：

| 方向 | Part | `part_kind` | 含义 |
|---|---|---|---|
| request | `SystemPromptPart` | `system-prompt` | 应用级系统指令 |
| request | `UserPromptPart` | `user-prompt` | 用户文本或多模态内容 |
| request | `ToolReturnPart` | `tool-return` | 本地函数工具执行结果 |
| request | `RetryPromptPart` | `retry-prompt` | 参数、输出或业务校验失败后的修正要求 |
| response | `TextPart` | `text` | 普通文本 |
| response | `ThinkingPart` | `thinking` | 可用时的推理内容 |
| response | `ToolCallPart` | `tool-call` | 应用需要执行/解析的普通工具调用 |
| response | `NativeToolCallPart` | `builtin-tool-call` | 供应商侧原生工具调用 |
| response | `NativeToolReturnPart` | `builtin-tool-return` | 供应商侧原生工具结果 |
| response | `FilePart` | `file` | 文件或图片输出 |

一个容易混淆但非常重要的点是：工具调用属于模型响应，工具返回属于下一条模型请求。二者必须复用同一个 `tool_call_id`：

```text
ModelResponse(ToolCallPart)
        ↓ 应用执行
ModelRequest(ToolReturnPart 或 RetryPromptPart)
        ↓
下一次 Model.request()
```

不要按列表位置猜消息类型，使用 `isinstance()`；需要持久化时使用 `ModelMessagesTypeAdapter`，它会按照 `kind` 和 `part_kind` 的 discriminator 完成 JSON 往返：

```python
payload = ModelMessagesTypeAdapter.dump_json(history)
history = ModelMessagesTypeAdapter.validate_json(payload)
```

## 6. 工具声明和执行为什么要分开

Pydantic AI 自带的 `Tool` 可以从 Python 函数签名、类型标注和 docstring 推导 schema，也包含重试、超时、上下文等执行配置。这适合使用内置 `Agent`。

自定义 AgentLoop 更适合把工具拆成两层：

- `ToolContract`：纯声明，包含名称、描述、输入模型、输出模型，可转换成 `ToolDefinition`；
- Handler Registry：名称到业务函数的映射，只在执行器中使用，绝不发送给模型。

这带来几个好处：schema 可以被测试和版本化；同一个契约可对应本地函数、RPC 或队列任务；模型请求构造不会意外执行代码；执行器可以统一加入鉴权、超时、幂等、审计和异常脱敏。

推荐约束输入和输出都使用独立的 Pydantic 模型，并设置 `extra='forbid'`。工具描述写清楚“什么时候使用”和“不要在什么情况下使用”；字段描述解释参数语义，不要只重复字段名。工具返回值也必须本地校验，handler 违反输出契约应视为程序错误，而不是让模型重试输入。

## 7. 完整示例：完全自控 AgentLoop

下面的示例没有导入 `Agent`，也没有调用 Pydantic AI 的图循环。Pydantic AI 只负责模型请求、供应商适配和消息对象；循环、工具路由、工具执行、重试、步数上限、usage 累加及终止条件全部由我们控制。

```python
from __future__ import annotations

import asyncio
import inspect
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    RetryPromptPart,
    SystemPromptPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.models import Model, ModelRequestParameters
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.settings import ModelSettings
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.usage import RunUsage


# ---------- 1. 契约：只有 schema，没有执行逻辑 ----------

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class WeatherArgs(StrictModel):
    city: str = Field(description="城市名，例如 Hangzhou")
    unit: Literal["celsius", "fahrenheit"] = Field(
        description="温度单位；中国城市通常使用 celsius"
    )


class WeatherResult(StrictModel):
    city: str
    temperature: float
    unit: Literal["celsius", "fahrenheit"]
    condition: str


class FinalAnswer(StrictModel):
    answer: str = Field(description="给用户的最终回答")
    data_source: list[str] = Field(description="本次回答实际使用的数据来源")


@dataclass(frozen=True, slots=True)
class ToolContract:
    name: str
    description: str
    input_model: type[BaseModel]
    output_model: type[BaseModel]

    def as_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name=self.name,
            description=self.description,
            parameters_json_schema=self.input_model.model_json_schema(),
            return_schema=self.output_model.model_json_schema(),
            include_return_schema=True,
            strict=True,
            kind="function",
        )


WEATHER = ToolContract(
    name="get_weather",
    description=(
        "查询指定城市的当前天气。用户询问实时天气时使用；"
        "不要用它查询历史天气或天气预报。"
    ),
    input_model=WeatherArgs,
    output_model=WeatherResult,
)

CONTRACTS: dict[str, ToolContract] = {WEATHER.name: WEATHER}


# 最终输出也是一份纯声明。输出对象放在调用参数中，因此使用 parameters schema。
FINAL_OUTPUT = ToolDefinition(
    name="final_answer",
    description="所有必要工具调用完成后，用此工具提交最终答案。",
    parameters_json_schema=FinalAnswer.model_json_schema(),
    strict=True,
    kind="output",
)


# ---------- 2. 实现：与 ToolDefinition 分开 ----------

ToolHandler = Callable[[BaseModel], Any | Awaitable[Any]]


async def get_weather(args: BaseModel) -> WeatherResult:
    assert isinstance(args, WeatherArgs)
    # 实际项目中替换为 HTTP/RPC 调用，并在这一层设置超时、鉴权和幂等。
    await asyncio.sleep(0)
    return WeatherResult(
        city=args.city,
        temperature=28.0 if args.unit == "celsius" else 82.4,
        unit=args.unit,
        condition="sunny",
    )


HANDLERS: dict[str, ToolHandler] = {"get_weather": get_weather}


class SafeToolError(Exception):
    """错误文本允许返回给模型；其他异常直接向上抛出，避免泄露内部信息。"""


def retry_for(call: ToolCallPart, content: str | list[dict[str, Any]]) -> RetryPromptPart:
    return RetryPromptPart(
        content=content,
        tool_name=call.tool_name,
        tool_call_id=call.tool_call_id,
    )


async def execute_function_call(call: ToolCallPart):
    """执行器是唯一能接触 handler 的地方。"""
    contract = CONTRACTS.get(call.tool_name)
    handler = HANDLERS.get(call.tool_name)
    if contract is None or handler is None:
        return retry_for(call, f"未知工具 {call.tool_name!r}，请只调用已声明的工具。")

    try:
        raw_args = call.args_as_dict(raise_if_invalid=True)
        args = contract.input_model.model_validate(raw_args)
    except ValidationError as exc:
        return retry_for(call, exc.errors(include_url=False))
    except (ValueError, AssertionError) as exc:
        return retry_for(call, f"工具参数不是合法 JSON object：{exc}")

    try:
        raw_result = handler(args)
        if inspect.isawaitable(raw_result):
            raw_result = await raw_result
    except SafeToolError as exc:
        return ToolReturnPart(
            tool_name=call.tool_name,
            tool_call_id=call.tool_call_id,
            content={"error": str(exc)},
            outcome="failed",
        )

    # handler 输出不符合契约是代码/服务错误，不应要求模型修改输入来掩盖它。
    try:
        result = contract.output_model.model_validate(raw_result)
    except ValidationError as exc:
        raise RuntimeError(f"工具 {call.tool_name!r} 返回值违反契约") from exc

    return ToolReturnPart(
        tool_name=call.tool_name,
        tool_call_id=call.tool_call_id,
        content=result.model_dump(mode="json"),
    )


# ---------- 3. 我们自己的状态、终止条件和循环 ----------

@dataclass(slots=True)
class LoopResult:
    output: FinalAnswer
    messages: list[ModelMessage]
    usage: RunUsage


async def run_agent_loop(
    model: Model,
    user_prompt: str,
    *,
    max_steps: int = 8,
) -> LoopResult:
    if not model.profile.get("supports_tools", True):
        raise RuntimeError(f"{model.model_id} 不支持工具，无法运行这个 AgentLoop")

    history: list[ModelMessage] = [
        ModelRequest(
            parts=[
                SystemPromptPart(
                    "你是天气助手。需要实时数据时先调用工具；完成后必须且只能调用 "
                    "final_answer 提交最终结果，不要用普通文本结束。"
                ),
                UserPromptPart(user_prompt),
            ]
        )
    ]
    usage = RunUsage()
    settings: ModelSettings = {"parallel_tool_calls": False}
    request_parameters = ModelRequestParameters(
        function_tools=[contract.as_definition() for contract in CONTRACTS.values()],
        output_tools=[FINAL_OUTPUT],
        output_mode="tool",
        allow_text_output=False,
    )

    for _step in range(1, max_steps + 1):
        # request() 会自行 prepare_request()；prepare_messages() 需要我们显式调用。
        wire_messages = model.prepare_messages(history, request_parameters)
        response: ModelResponse = await model.request(
            wire_messages,
            settings,
            request_parameters,
        )
        history.append(response)
        usage.requests += 1
        usage.incr(response.usage)

        calls = response.tool_calls
        if not calls:
            history.append(
                ModelRequest(
                    parts=[RetryPromptPart(
                        "不能用普通文本结束；请调用已声明的函数工具或 final_answer。"
                    )]
                )
            )
            continue

        final_calls = [call for call in calls if call.tool_name == FINAL_OUTPUT.name]

        # 最终输出必须独占一个模型回合，避免“结束”和有副作用工具同时发生。
        if len(calls) == 1 and len(final_calls) == 1:
            final_call = final_calls[0]
            try:
                output = FinalAnswer.model_validate(
                    final_call.args_as_dict(raise_if_invalid=True)
                )
            except (ValidationError, ValueError, AssertionError) as exc:
                content = (
                    exc.errors(include_url=False)
                    if isinstance(exc, ValidationError)
                    else f"最终输出参数无效：{exc}"
                )
                history.append(ModelRequest(parts=[retry_for(final_call, content)]))
                continue
            return LoopResult(output=output, messages=history, usage=usage)

        next_parts = []
        function_calls = []
        for call in calls:
            if call.tool_name == FINAL_OUTPUT.name:
                next_parts.append(
                    retry_for(call, "final_answer 必须是该回合唯一的工具调用。")
                )
            else:
                function_calls.append(call)

        # 即使某个 provider 忽略 parallel_tool_calls=False，也能安全处理多个只读工具。
        # 有副作用的工具应由执行器根据契约改为串行，并加入幂等键。
        executed = await asyncio.gather(
            *(execute_function_call(call) for call in function_calls)
        )
        next_parts.extend(executed)
        usage.tool_calls += sum(
            isinstance(part, ToolReturnPart) and part.outcome == "success"
            for part in executed
        )
        history.append(ModelRequest(parts=next_parts))

    raise RuntimeError(f"AgentLoop 超过最大步数 {max_steps}")


async def main() -> None:
    # 默认从 OPENAI_API_KEY 读取密钥。也可以给 OpenAIChatModel 传自定义 Provider。
    model = OpenAIChatModel("gpt-4.1-mini")
    async with model:  # 让 provider 正确管理 HTTP client 生命周期
        result = await run_agent_loop(model, "杭州现在天气怎么样？")
    print(result.output.model_dump_json(indent=2))
    print(result.usage)


if __name__ == "__main__":
    asyncio.run(main())
```

## 8. 生产环境还要补哪些边界

上面的循环已经完整，但有意没有复制内置 AgentLoop 的全部复杂度。生产环境通常还应明确加入：

1. **请求限制**：最大步数之外，再限制总 token、成本、单次输入 token 和 wall-clock deadline；
2. **工具策略**：鉴权、审批、有副作用工具的串行执行、幂等键、超时、重试和熔断；
3. **历史修复**：保证每个 `ToolCallPart` 都有同 ID 的 return/retry，崩溃恢复时修复悬空调用；
4. **持久化**：用 `ModelMessagesTypeAdapter` 序列化规范历史，同时单独保存循环状态和工具执行记录；
5. **可观测性**：记录 step、模型 ID、provider response ID、usage、工具耗时和脱敏后的失败原因；
6. **暂停/恢复**：不要把等待人工审批的时间占在一次 HTTP 请求中，应把 pending tool call 作为业务状态持久化；
7. **模型切换**：跨 provider 恢复前调用目标模型的 `prepare_messages()`，不要持久化供应商 SDK 的原始 message 对象。

还要特别注意：内置图循环在 `prepare_messages()` 前后会清理相邻同角色消息、修复悬空工具调用，并处理 suspended response、延迟工具和动态工具可见性。本文示例只使用普通函数工具和输出工具，所以不需要复制这些私有逻辑。如果要支持 native tools、deferred loading、tool search 或供应商后台任务，应把它们当作新的协议能力逐项设计，而不是调用 `_agent_graph` 中的私有函数。

## 9. 最佳实践总结

最终推荐的职责边界是：

- `Model` / provider adapter：供应商协议、能力 profile、请求和响应归一化；
- `ModelMessage`：唯一的跨供应商会话历史格式；
- `ToolDefinition`：发送给模型的纯工具声明；
- Pydantic model：工具输入、工具输出和最终结果的单一事实来源；
- Handler Registry：业务实现；
- 自定义 AgentLoop：路由、并发、审批、重试、终止、usage、持久化和恢复。

这条边界让 Pydantic AI 做它最有价值也最难重复实现的部分——不同模型 API 的适配——同时把 Agent 的控制流完整留在应用手中。
