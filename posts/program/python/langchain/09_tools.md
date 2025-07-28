---
weight: 1
title: "LangChain Tools"
date: 2025-07-23T13:00:00+08:00
lastmod: 2025-07-23T13:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langchain tools"
featuredImage: 

tags: ["langchain 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

## 1. Function Call

提问: 能不能想写给我介绍一下 OpenAI Function Calling 

回答: 当然可以，下面我会从 **初衷、语法结构、工作机制、代码示例、进阶用法和与 LangChain 结合方式** 六个方面，全面介绍 **OpenAI Function Calling** 的机制。

---

### 🧠 1. 什么是 OpenAI Function Calling？

**Function Calling** 是 OpenAI 在 2023 年引入的一项特性，允许你把本地/服务器端的函数描述发送给 LLM，让模型「决定是否调用这些函数」，并输出函数调用所需的参数。

> 模型不直接输出自然语言，而是返回一段结构化的数据：**我要调用哪个函数、用什么参数**。

这让语言模型：

* 能够具备 **工具调用能力**；
* 可与 **数据库、API、插件** 等进行对接；
* 更像一个 **智能编排器（Orchestrator）**，而不仅仅是语言生成器。

---

### 🧩 2. Function Calling 的典型场景

| 场景       | 描述                                        |
| -------- | ----------------------------------------- |
| 天气助手     | 用户问「北京天气」，模型调用 `get_weather(location=北京)` |
| RAG 检索   | 用户提问，模型调用 `search_docs(query=...)` 检索资料   |
| Agent 工具 | 模型自主选择工具如「翻译」「计算器」「爬虫」                    |
| 多轮对话调取数据 | 模型根据上下文决定是否再次调用                           |

---

### 🧪 3. 基本调用结构

✅ 你需要向模型提供函数定义（Function Schema）：

```json
{
  "name": "get_weather",
  "description": "获取指定城市的天气情况",
  "parameters": {
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "description": "要查询的城市名"
      }
    },
    "required": ["location"]
  }
}
```

---

### 🔁 4. 工作机制：Function Calling 的 3 步流程

```
用户输入 --> 模型决定调用哪个函数 --> 你执行函数并将结果反馈给模型
```

步骤 1：用户提问

```python
messages = [{"role": "user", "content": "北京今天天气如何？"}]
```

步骤 2：模型返回「我要调用函数」

```json
{
  "role": "assistant",
  "content": null,
  "function_call": {
    "name": "get_weather",
    "arguments": "{ \"location\": \"北京\" }"
  }
}
```

步骤 3：你拿到函数名和参数，自己调用对应函数并把结果发回去

```python
function_result = get_weather("北京")

# 然后作为 FunctionMessage 发给模型：
messages.append({
  "role": "function",
  "name": "get_weather",
  "content": "{\"temperature\": \"30°C\", \"desc\": \"晴天\"}"
})
```

接着模型就可以基于这个结果给出自然语言回复。

---

### 🧑‍💻 5. Python 使用示例（openai 官方 SDK）

```python
import openai

openai.api_key = "sk-..."

functions = [
    {
        "name": "get_weather",
        "description": "获取城市天气",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {"type": "string"}
            },
            "required": ["location"]
        }
    }
]

# 第一步：模型决定是否要调用函数
response = openai.ChatCompletion.create(
    model="gpt-4-0613",
    messages=[{"role": "user", "content": "北京天气怎么样？"}],
    functions=functions,
    function_call="auto"
)

# 判断是否是 function_call
message = response.choices[0].message
if "function_call" in message:
    name = message.function_call.name
    arguments = json.loads(message.function_call.arguments)
    result = get_weather(**arguments)

    # 第二步：返回函数结果，继续交互
    messages = [
        {"role": "user", "content": "北京天气怎么样？"},
        message,  # assistant function_call
        {"role": "function", "name": name, "content": json.dumps(result)}
    ]

    final_response = openai.ChatCompletion.create(
        model="gpt-4-0613",
        messages=messages
    )
    print(final_response.choices[0].message["content"])
```

---

### 🧠 6. LangChain 中的 Function Calling 支持

LangChain 会自动将你定义的 `@tool`, `@function` 或 `StructuredTool` 转换成 Function Schema，注册给模型使用。

比如你写一个工具：

```python
@tool
def get_weather(location: str) -> str:
    ...
```

LangChain 会自动转换为：

```json
{
  "name": "get_weather",
  "parameters": {
    "type": "object",
    "properties": {
      "location": {"type": "string"}
    },
    "required": ["location"]
  }
}
```

并在 chain 或 agent 执行中，自动：

* 注册 tool schema；
* 检测模型是否返回了 function\_call；
* 调用函数并反馈结果；
* 构造完整对话链条。

## 2. Tool Call
提问: 能不能从 初衷、语法结构、工作机制、代码示例、进阶用法和与 LangChain 结合方式 六个方面

回答: 当然可以！下面我将从你指定的六个方面，系统地讲解 **OpenAI Tool Calling**：

---

### 🧭 1. 初衷（为什么引入 Tool Calling）

OpenAI 推出 **Tool Calling** 的初衷是为了让语言模型更像一个“智能体（Agent）”，具备以下能力：

* **结构化调用外部工具**：模型可以理解用户意图，并主动调用你提供的函数、API、数据库查询器等。
* **支持多个工具协同**：不是只能调用一个函数，而是可以在一次回复中调用多个工具。
* **统一 Agent API**：构建对话型 Agent 时，减少接口差异。
* **提高可靠性与可控性**：比自然语言更准确地传参、更容易监控、更利于调试。

简而言之：Tool Calling 让 LLM 不止“说话”，而是能\*\*“动手做事”\*\*，具备“工具使用”能力，进入智能体（Agent）时代的核心支撑。

---

### 🧱 2. 语法结构（Prompt 接口与 JSON Schema）

✅ 请求结构（精简版）

```python
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[...],
    tools=[{...}],  # 定义工具
    tool_choice="auto"  # 自动选择是否调用工具
)
```

✅ 工具定义结构

每个 Tool 是一个 JSON Schema 描述的函数：

```jsonc
{
  "type": "function",
  "function": {
    "name": "search_products",
    "description": "Search products from the catalog",
    "parameters": {
      "type": "object",
      "properties": {
        "keyword": { "type": "string" },
        "limit": { "type": "integer", "default": 10 }
      },
      "required": ["keyword"]
    }
  }
}
```

---

### ⚙️ 3. 工作机制（调用流程）

🌐 全流程步骤

1. **你定义好工具列表 `tools`**，传给 `chat.completions.create`
2. **用户提问**（如：“上海天气怎么样？”）
3. **模型分析意图**，决定是否调用工具（根据 `tool_choice`）
4. 如果模型调用工具，返回结果类似：

```jsonc
{
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "get_weather",
        "arguments": "{ \"location\": \"Shanghai\" }"
      }
    }
  ]
}
```

5. **你拿到参数 `arguments`，执行实际函数调用**
6. **把执行结果作为 Tool Message 回传**，例如：

```python
{
  "tool_call_id": "call_abc123",
  "role": "tool",
  "content": "The weather in Shanghai is 30°C and sunny."
}
```

7. **模型基于工具返回值生成最终回复**

---

### 💻 4. 代码示例（完整 end-to-end）

🎯 示例目标：模型调用工具获取天气

```python
from openai import OpenAI

client = OpenAI()

# 1. 工具定义
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather in a city",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "City name"},
                },
                "required": ["location"]
            }
        }
    }
]

# 2. 用户输入
messages = [{"role": "user", "content": "今天天津天气怎么样？"}]

# 3. 请求模型
response = client.chat.completions.create(
    model="gpt-4o",
    messages=messages,
    tools=tools,
    tool_choice="auto"
)

tool_calls = response.choices[0].message.tool_calls

# 4. 执行真实函数（模拟）
location = eval(tool_calls[0].function.arguments)["location"]
tool_result = f"{location} 今天天气晴，30°C。"

# 5. 构造 tool 消息再次发送
messages.append({
    "tool_call_id": tool_calls[0].id,
    "role": "tool",
    "content": tool_result
})

# 6. 再次请求，生成最终回复
final = client.chat.completions.create(
    model="gpt-4o",
    messages=messages
)

print(final.choices[0].message.content)
```

---

### 🚀 5. 进阶用法

✅ 支持多个工具调用

```jsonc
"tool_calls": [
  { "function": { "name": "get_user_info", ... } },
  { "function": { "name": "get_order_status", ... } }
]
```

可以并行调用多个函数，再统一生成回复。

---

✅ 控制调用方式

* `"tool_choice": "auto"`：模型自由决定是否调用哪个工具
* `"tool_choice": {"type": "function", "function": {"name": "xxx"}}`：强制调用某个函数
* `"tool_choice": "none"`：不让模型调用工具


如果模型觉得无需调用工具，可以直接返回回答，这种灵活性很高。


### 🔗 6. 与 LangChain 的结合方式

LangChain 构建了封装好的 `OpenAIToolAgent` 类型，基于 Tool Calling 驱动 Agent 调用。

✅ 核心类

* `Tool`：封装了一个函数，提供 name、description、arg\_schema
* `initialize_agent(..., agent_type="openai-tools")`：使用 Tool Calling 构造 Agent

✅ 示例代码

```python
from langchain.agents import initialize_agent, Tool
from langchain.chat_models import ChatOpenAI

def get_weather(location: str) -> str:
    return f"{location} 天气晴，30°C"

llm = ChatOpenAI(model="gpt-4o")

tools = [Tool.from_function(fn=get_weather)]

agent = initialize_agent(
    tools=tools,
    llm=llm,
    agent_type="openai-tools"
)

# 使用 Agent
agent.invoke("请问成都天气如何？")
```

LangChain 会自动解析模型的 `tool_calls`，执行对应函数，并组装消息传回模型。

---

### 🧩 总结

| 部分             | 内容                                                                 |
| -------------- | ------------------------------------------------------------------ |
| 初衷             | 让模型能结构化调用工具，走向智能体                                                  |
| 语法结构           | 使用 `tools` 注册函数，用 JSON Schema 描述参数                                 |
| 工作机制           | 模型 -> Tool Calls -> 你执行 -> Tool Message -> 模型回复                    |
| 代码示例           | 全流程 end-to-end 示例                                                  |
| 进阶用法           | 多工具调用、自定义调用策略、嵌套参数                                                 |
| 与 LangChain 结合 | 用 `Tool` + `initialize_agent(..., agent_type="openai-tools")` 封装使用 |

## 3. AIMessage
Function Call 和 Tool Call 的调用信息都保存在 model 返回的 AIMessage 中:

```python
class AIMessage(BaseMessage):
    """Message from an AI.

    AIMessage is returned from a chat model as a response to a prompt.

    This message represents the output of the model and consists of both
    the raw output as returned by the model together standardized fields
    (e.g., tool calls, usage metadata) added by the LangChain framework.
    """

    example: bool = False
    """Use to denote that a message is part of an example conversation.

    At the moment, this is ignored by most models. Usage is discouraged.
    """

    tool_calls: list[ToolCall] = []
    """If provided, tool calls associated with the message."""
    invalid_tool_calls: list[InvalidToolCall] = []
    """If provided, tool calls with parsing errors associated with the message."""
    usage_metadata: Optional[UsageMetadata] = None
    """If provided, usage metadata for a message, such as token counts.

    This is a standard representation of token usage that is consistent across models.
    """

    type: Literal["ai"] = "ai"
    """The type of the message (used for deserialization). Defaults to "ai"."""

```

| 字段名                  | 类型                                | 含义                                                               |
| -------------------- | --------------------------------- | ---------------------------------------------------------------- |
| `example`            | `bool`（默认值：`False`）               | 标识该消息是否是“示例对话”中的一部分。虽然目前大多数模型会忽略此字段，但用于训练数据示例场景，LangChain 不推荐使用。 |
| `tool_calls`         | `list[ToolCall]`（默认值：`[]`）        | 表示与该消息关联的有效工具调用信息，如函数调用、API请求等，用于支持 Tool/Function Calling。       |
| `invalid_tool_calls` | `list[InvalidToolCall]`（默认值：`[]`） | 包含解析失败的工具调用（例如格式错误的 tool call 结构），便于调试或回退逻辑处理。                   |
| `usage_metadata`     | `Optional[UsageMetadata]`         | 可选字段，表示该消息的资源使用信息，如 token 数等。这个结构在不同模型间是统一的，便于监控和计费。             |
| `type`               | `Literal["ai"]`（默认值：`"ai"`）       | 消息类型标识字段，固定为 `"ai"`，用于序列化/反序列化和消息分类判断。LangChain 框架内部使用。          |


AIMessage 继承自 BaseMessage，BaseMessage 还有多个字段，具体请查看前面的 BaseMessage 定义。


### 3.1 ToolCall

```python
class ToolCall(TypedDict):
    """Represents a request to call a tool.

    Example:

        .. code-block:: python

            {
                "name": "foo",
                "args": {"a": 1},
                "id": "123"
            }

        This represents a request to call the tool named "foo" with arguments {"a": 1}
        and an identifier of "123".
    """

    name: str
    """The name of the tool to be called."""
    args: dict[str, Any]
    """The arguments to the tool call."""
    id: Optional[str]
    """An identifier associated with the tool call.

    An identifier is needed to associate a tool call request with a tool
    call result in events when multiple concurrent tool calls are made.
    """
    type: NotRequired[Literal["tool_call"]]


class InvalidToolCall(TypedDict):
    """Allowance for errors made by LLM.

    Here we add an `error` key to surface errors made during generation
    (e.g., invalid JSON arguments.)
    """

    name: Optional[str]
    """The name of the tool to be called."""
    args: Optional[str]
    """The arguments to the tool call."""
    id: Optional[str]
    """An identifier associated with the tool call."""
    error: Optional[str]
    """An error message associated with the tool call."""
    type: NotRequired[Literal["invalid_tool_call"]]
```

| 字段名    | 类型                                  | 是否必填 | 含义                                          |
| ------ | ----------------------------------- | ---- | ------------------------------------------- |
| `name` | `str`                               | 是    | 要调用的工具名称，例如 `"get_weather"`。                |
| `args` | `dict[str, Any]`                    | 是    | 工具调用所需的参数，键值对形式传递，例如 `{"city": "Beijing"}`。 |
| `id`   | `Optional[str]`                     | 否    | 工具调用的唯一标识符，用于将请求与返回结果关联（特别是在并发调用多个工具时）。     |
| `type` | `NotRequired[Literal["tool_call"]]` | 否    | 可选字段，类型固定为 `"tool_call"`，用于指明该结构是一个工具调用。    |



## 3. Tool Call Message And OutputParser
### 3.1 Message

ToolMessage 是 LangChain 中用于表示工具调用结果的专用消息类型，主要用于 OpenAI Tool Calling 工作流中，表示某个工具调用完成后的结果，并作为上下文的一部分传递回模型。


```python
class ToolMessage(BaseMessage, ToolOutputMixin):
    """Message for passing the result of executing a tool back to a model.

    ToolMessages contain the result of a tool invocation. Typically, the result
    is encoded inside the `content` field.
    """

    tool_call_id: str
    """Tool call that this message is responding to."""

    type: Literal["tool"] = "tool"
    """The type of the message (used for serialization). Defaults to "tool"."""

    artifact: Any = None
    """Artifact of the Tool execution which is not meant to be sent to the model.

    Should only be specified if it is different from the message content, e.g. if only
    a subset of the full tool output is being passed as message content but the full
    output is needed in other parts of the code.

    .. versionadded:: 0.2.17
    """

    status: Literal["success", "error"] = "success"
    """Status of the tool invocation.

    .. versionadded:: 0.2.24
    """

    additional_kwargs: dict = Field(default_factory=dict, repr=False)
    """Currently inherited from BaseMessage, but not used."""
    response_metadata: dict = Field(default_factory=dict, repr=False)
    """Currently inherited from BaseMessage, but not used."""
```

| 字段名                 | 类型                            | 含义说明                                                                        |
| ------------------- | ----------------------------- | --------------------------------------------------------------------------- |
| `tool_call_id`      | `str`                         | 表示该消息对应的 **工具调用 ID**，用于将返回结果与之前的 `tool_call` 建立关联（如：AIMessage 中的 ToolCall）。 |
| `type`              | `Literal["tool"]`             | 表示消息类型为 `"tool"`，用于序列化标识。固定值。                                               |
| `artifact`          | `Any`（可选）                     | 工具执行产生的完整输出，**不用于发送给模型**，仅供后续代码逻辑使用。例如：content 是摘要，artifact 是全文。            |
| `status`            | `Literal["success", "error"]` | 工具调用的执行状态。用于标记是否调用成功，默认为 `"success"`。                                       |
| `additional_kwargs` | `dict`（默认空字典）                 | 来自 `BaseMessage`，暂时未使用，保留字段。                                                |
| `response_metadata` | `dict`（默认空字典）                 | 同上，当前未被实际用作消息处理，仅用于扩展。                                                      |

### 3.2 OutputParser
![OutPut Parser 类图](/images/langchain/output_parser.svg)

Tool 相关的 Parser主要有:
2. `JsonOutputToolsParser`
3. `PydanticToolsParser`: 在 JsonOutputToolsParser 的基础上添加了参数校验

#### JsonOutputToolsParser
```python
class JsonOutputToolsParser(BaseCumulativeTransformOutputParser[Any]):
    """Parse tools from OpenAI response."""

    strict: bool = False
    """Whether to allow non-JSON-compliant strings.

    See: https://docs.python.org/3/library/json.html#encoders-and-decoders

    Useful when the parsed output may include unicode characters or new lines.
    """
    return_id: bool = False
    """Whether to return the tool call id."""
    first_tool_only: bool = False
    """Whether to return only the first tool call.

    If False, the result will be a list of tool calls, or an empty list
    if no tool calls are found.

    If true, and multiple tool calls are found, only the first one will be returned,
    and the other tool calls will be ignored.
    If no tool calls are found, None will be returned.
    """

    def parse_result(self, result: list[Generation], *, partial: bool = False) -> Any:
        """Parse the result of an LLM call to a list of tool calls.

        Args:
            result: The result of the LLM call.
            partial: Whether to parse partial JSON.
                If True, the output will be a JSON object containing
                all the keys that have been returned so far.
                If False, the output will be the full JSON object.
                Default is False.

        Returns:
            The parsed tool calls.

        Raises:
            OutputParserException: If the output is not valid JSON.
        """
        generation = result[0]
        if not isinstance(generation, ChatGeneration):
            msg = "This output parser can only be used with a chat generation."
            raise OutputParserException(msg)
        message = generation.message
        if isinstance(message, AIMessage) and message.tool_calls:
            tool_calls = [dict(tc) for tc in message.tool_calls]
            for tool_call in tool_calls:
                if not self.return_id:
                    _ = tool_call.pop("id")
        else:
            try:
                raw_tool_calls = copy.deepcopy(message.additional_kwargs["tool_calls"])
            except KeyError:
                return []
            tool_calls = parse_tool_calls(
                raw_tool_calls,
                partial=partial,
                strict=self.strict,
                return_id=self.return_id,
            )
        # for backwards compatibility
        for tc in tool_calls:
            tc["type"] = tc.pop("name")

        if self.first_tool_only:
            return tool_calls[0] if tool_calls else None
        return tool_calls


def parse_tool_call(
    raw_tool_call: dict[str, Any],
    *,
    partial: bool = False,
    strict: bool = False,
    return_id: bool = True,
) -> Optional[dict[str, Any]]:
    """Parse a single tool call.

    Args:
        raw_tool_call: The raw tool call to parse.
        partial: Whether to parse partial JSON. Default is False.
        strict: Whether to allow non-JSON-compliant strings.
            Default is False.
        return_id: Whether to return the tool call id. Default is True.

    Returns:
        The parsed tool call.

    Raises:
        OutputParserException: If the tool call is not valid JSON.
    """
    if "function" not in raw_tool_call:
        return None
    if partial:
        try:
            function_args = parse_partial_json(
                raw_tool_call["function"]["arguments"], strict=strict
            )
        except (JSONDecodeError, TypeError):  # None args raise TypeError
            return None
    else:
        try:
            function_args = json.loads(
                raw_tool_call["function"]["arguments"], strict=strict
            )
        except JSONDecodeError as e:
            msg = (
                f"Function {raw_tool_call['function']['name']} arguments:\n\n"
                f"{raw_tool_call['function']['arguments']}\n\nare not valid JSON. "
                f"Received JSONDecodeError {e}"
            )
            raise OutputParserException(msg) from e
    parsed = {
        "name": raw_tool_call["function"]["name"] or "",
        "args": function_args or {},
    }
    if return_id:
        parsed["id"] = raw_tool_call.get("id")
        parsed = create_tool_call(**parsed)  # type: ignore[assignment,arg-type]
    return parsed

```

#### PydanticToolsParser

```python
TypeBaseModel = type[BaseModel]

class PydanticToolsParser(JsonOutputToolsParser):
    """Parse tools from OpenAI response."""

    tools: Annotated[list[TypeBaseModel], SkipValidation()]
    """The tools to parse."""

    # TODO: Support more granular streaming of objects. Currently only streams once all
    # Pydantic object fields are present.
    def parse_result(self, result: list[Generation], *, partial: bool = False) -> Any:
        """Parse the result of an LLM call to a list of Pydantic objects.

        Args:
            result: The result of the LLM call.
            partial: Whether to parse partial JSON.
                If True, the output will be a JSON object containing
                all the keys that have been returned so far.
                If False, the output will be the full JSON object.
                Default is False.

        Returns:
            The parsed Pydantic objects.

        Raises:
            OutputParserException: If the output is not valid JSON.
        """
        json_results = super().parse_result(result, partial=partial)
        if not json_results:
            return None if self.first_tool_only else []

        json_results = [json_results] if self.first_tool_only else json_results
        name_dict = {tool.__name__: tool for tool in self.tools}
        pydantic_objects = []
        for res in json_results:
            if not isinstance(res["args"], dict):
                if partial:
                    continue
                msg = (
                    f"Tool arguments must be specified as a dict, received: "
                    f"{res['args']}"
                )
                raise ValueError(msg)
            try:
                # res["type"] 记录的是调用的哪个函数
                pydantic_objects.append(name_dict[res["type"]](**res["args"]))
            except (ValidationError, ValueError):
                if partial:
                    continue
                has_max_tokens_stop_reason = any(
                    generation.message.response_metadata.get("stop_reason")
                    == "max_tokens"
                    for generation in result
                    if isinstance(generation, ChatGeneration)
                )
                if has_max_tokens_stop_reason:
                    logger.exception(_MAX_TOKENS_ERROR)
                raise
        if self.first_tool_only:
            return pydantic_objects[0] if pydantic_objects else None
        return pydantic_objects
```

下面是 PydanticOutputFunctionsParser 的使用示例。需要注意的 PydanticToolsParser 中输入的 Model 必须是与 Tool 对应的 args_schema，这样 `name_dict[res["type"]](**res["args"])` 的索引关系才能满足。

```python
from audioop import mul
from langchain_core.output_parsers.openai_tools import PydanticToolsParser
from langchain_core.messages import AIMessage, ToolCall
from langchain_core.outputs import ChatGeneration
from langchain_core.tools import tool
from pydantic import BaseModel


# 1. 定义工具输入模型
class MultiplyInput(BaseModel):
    x: int
    y: int


class AddInput(BaseModel):
    a: int
    b: int


# 2. 使用 @tool 装饰函数
@tool
def multiply_tool(input: MultiplyInput) -> str:
    """计算乘法"""
    return str(input.x * input.y)


@tool
def add_tool(input: AddInput) -> str:
    """计算加法"""
    return str(input.a + input.b)


# ✅ 3. 从 StructuredTool 拿到绑定后的 Pydantic 模型类
multiply_model = multiply_tool.args_schema
add_model = add_tool.args_schema
print(multiply_model.__name__, multiply_model.model_json_schema())

# 4. 模拟 LLM 返回 tool 调用结果
fake_tool_call = ToolCall(
    # 注意这里的 args 
    name="multiply_tool", args={"input": {"x": 6, "y": 7}}, id="tool_call_1"
)
ai_message = AIMessage(content="", tool_calls=[fake_tool_call])
generation = ChatGeneration(message=ai_message)

# ✅ 5. 使用 PydanticToolsParser（传入的是 Pydantic 模型类）
parser = PydanticToolsParser(tools=[multiply_model, add_model])
parsed = parser.parse_result([generation])

# 6. 输出结构化结果
print("✅ 解析后的 Pydantic 对象:")
print(parsed)

```


## 4. Function Call Message And OutputParser
### 4.1 Message
FunctionMessage 专门用于封装 OpenAI Function Calling 或 Tool Calling 中函数返回结果的消息。

```python
class FunctionMessage(BaseMessage):
    """Message for passing the result of executing a tool back to a model.

    FunctionMessage are an older version of the ToolMessage schema, and
    do not contain the tool_call_id field.

    The tool_call_id field is used to associate the tool call request with the
    tool call response. This is useful in situations where a chat model is able
    to request multiple tool calls in parallel.
    """

    name: str
    """The name of the function that was executed."""

    type: Literal["function"] = "function"
    """The type of the message (used for serialization). Defaults to "function"."""
```


```python
from langchain_core.messages import AIMessage, FunctionMessage, HumanMessage

history = [
    HumanMessage(content="给我推荐一个北京的景点"),
    AIMessage(content=None, tool_calls=[{
        "name": "get_beijing_attraction",
        "args": {"type": "文化类"}
    }]),
    FunctionMessage(name="get_beijing_attraction", content="颐和园"),
]

```

### 4.2 OutputParser 

![OutPut Parser 类图](/images/langchain/output_parser.svg)

Function Call 有很多的 Parser 但是核心是:
1. JsonOutputFunctionsParser
2. PydanticOutputFunctionsParser

解析逻辑是这样的:
1. 从 model 返回的 message 中返回 function_call： `function_call = message.additional_kwargs["function_call"]`
2. 将 function_call 解析为 Python 字典： `function_call = json.loads(function_call)`
3. 从 function_call 中获取 name 和 arguments
4. 有没有 Pydantic 模型？如果有，就用 Pydantic 模型解析 arguments

#### JsonOutputFunctionsParser
```python
class JsonOutputFunctionsParser(BaseCumulativeTransformOutputParser[Any]):
    """Parse an output as the Json object."""

    strict: bool = False
    """Whether to allow non-JSON-compliant strings.

    See: https://docs.python.org/3/library/json.html#encoders-and-decoders

    Useful when the parsed output may include unicode characters or new lines.
    """

    args_only: bool = True
    """Whether to only return the arguments to the function call."""

    @property
    def _type(self) -> str:
        return "json_functions"

    @override
    def _diff(self, prev: Optional[Any], next: Any) -> Any:
        return jsonpatch.make_patch(prev, next).patch

    def parse_result(self, result: list[Generation], *, partial: bool = False) -> Any:
        """Parse the result of an LLM call to a JSON object.

        Args:
            result: The result of the LLM call.
            partial: Whether to parse partial JSON objects. Default is False.

        Returns:
            The parsed JSON object.

        Raises:
            OutputParserException: If the output is not valid JSON.
        """
        if len(result) != 1:
            msg = f"Expected exactly one result, but got {len(result)}"
            raise OutputParserException(msg)
        generation = result[0]
        if not isinstance(generation, ChatGeneration):
            msg = "This output parser can only be used with a chat generation."
            raise OutputParserException(msg)
        message = generation.message
        try:
            function_call = message.additional_kwargs["function_call"]
        except KeyError as exc:
            if partial:
                return None
            msg = f"Could not parse function call: {exc}"
            raise OutputParserException(msg) from exc
        try:
            if partial:
                try:
                    if self.args_only:
                        return parse_partial_json(
                            function_call["arguments"], strict=self.strict
                        )
                    return {
                        **function_call,
                        "arguments": parse_partial_json(
                            function_call["arguments"], strict=self.strict
                        ),
                    }
                except json.JSONDecodeError:
                    return None
            elif self.args_only:
                try:
                    return json.loads(function_call["arguments"], strict=self.strict)
                except (json.JSONDecodeError, TypeError) as exc:
                    msg = f"Could not parse function call data: {exc}"
                    raise OutputParserException(msg) from exc
            else:
                try:
                    return {
                        **function_call,
                        "arguments": json.loads(
                            function_call["arguments"], strict=self.strict
                        ),
                    }
                except (json.JSONDecodeError, TypeError) as exc:
                    msg = f"Could not parse function call data: {exc}"
                    raise OutputParserException(msg) from exc
        except KeyError:
            return None
```

#### PydanticOutputFunctionsParser
PydanticOutputFunctionsParser 接受的 BaseModel 是为了校验 Function Call 的 arguments 字段。

```python
class PydanticOutputFunctionsParser(OutputFunctionsParser):
    """Parse an output as a pydantic object.

    This parser is used to parse the output of a ChatModel that uses
    OpenAI function format to invoke functions.

    The parser extracts the function call invocation and matches
    them to the pydantic schema provided.

    An exception will be raised if the function call does not match
    the provided schema.

    Example:
        ... code-block:: python

            message = AIMessage(
                content="This is a test message",
                additional_kwargs={
                    "function_call": {
                        "name": "cookie",
                        "arguments": json.dumps({"name": "value", "age": 10}),
                    }
                },
            )
            chat_generation = ChatGeneration(message=message)

            class Cookie(BaseModel):
                name: str
                age: int

            class Dog(BaseModel):
                species: str

            # Full output
            parser = PydanticOutputFunctionsParser(
                pydantic_schema={"cookie": Cookie, "dog": Dog}
            )
            result = parser.parse_result([chat_generation])
    """

    pydantic_schema: Union[type[BaseModel], dict[str, type[BaseModel]]]
    """The pydantic schema to parse the output with.

    If multiple schemas are provided, then the function name will be used to
    determine which schema to use.
    """

    @model_validator(mode="before")
    @classmethod
    def validate_schema(cls, values: dict) -> Any:
        """Validate the pydantic schema.

        Args:
            values: The values to validate.

        Returns:
            The validated values.

        Raises:
            ValueError: If the schema is not a pydantic schema.
        """
        schema = values["pydantic_schema"]
        if "args_only" not in values:
            values["args_only"] = (
                isinstance(schema, type)
                and not isinstance(schema, GenericAlias)
                and issubclass(schema, BaseModel)
            )
        elif values["args_only"] and isinstance(schema, dict):
            msg = (
                "If multiple pydantic schemas are provided then args_only should be"
                " False."
            )
            raise ValueError(msg)
        return values

    @override
    def parse_result(self, result: list[Generation], *, partial: bool = False) -> Any:
        """Parse the result of an LLM call to a JSON object.

        Args:
            result: The result of the LLM call.
            partial: Whether to parse partial JSON objects. Default is False.

        Returns:
            The parsed JSON object.
        """
        result_ = super().parse_result(result)
        if self.args_only:
            if hasattr(self.pydantic_schema, "model_validate_json"):
                pydantic_args = self.pydantic_schema.model_validate_json(result_)
            else:
                pydantic_args = self.pydantic_schema.parse_raw(result_)  # type: ignore[attr-defined]
        else:
            fn_name = result_["name"]
            args = result_["arguments"]
            if isinstance(self.pydantic_schema, dict):
                pydantic_schema = self.pydantic_schema[fn_name]
            else:
                pydantic_schema = self.pydantic_schema
            if issubclass(pydantic_schema, BaseModel):
                pydantic_args = pydantic_schema.model_validate_json(args)
            elif issubclass(pydantic_schema, BaseModelV1):
                pydantic_args = pydantic_schema.parse_raw(args)
            else:
                msg = f"Unsupported pydantic schema: {pydantic_schema}"
                raise ValueError(msg)
        return pydantic_args

```