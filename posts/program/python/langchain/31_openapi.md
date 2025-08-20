---
weight: 1
title: "LangChain ChatOpenAI"
date: 2025-07-23T14:00:00+08:00
lastmod: 2025-07-23T14:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langchain ChatOpenAI"
featuredImage: 

tags: ["langchain 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---


## 1. Open Api

Langchain 与 chatgpt 的交互实现在 langchain_openai.ChatOpenAI。内部通过 [openai](https://platform.openai.com/docs/api-reference/responses/create) 提供的 Client 与 ChatGpt 的 API Server 进行交互。我们先来看一下 openai 的接口。

### 1.1 openai create
Langchain 内部使用的是 create 接口。其输入和输出如下：

#### 输入
```json
{
  "model": "gpt-4.1",
  "messages": [
    {
      "role": "user",
      "content": "What is the weather like in Boston today?"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_current_weather",
        "description": "Get the current weather in a given location",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "The city and state, e.g. San Francisco, CA"
            },
            "unit": {
              "type": "string",
              "enum": ["celsius", "fahrenheit"]
            }
          },
          "required": ["location"]
        }
      }
    }
  ],
  "tool_choice": "auto"
}
```

#### 输出

```json
// function call
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1699896916,
  "model": "gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "get_current_weather",
              "arguments": "{\n\"location\": \"Boston, MA\"\n}"
            }
          }
        ]
      },
      "logprobs": null,
      "finish_reason": "tool_calls"
    }
  ],
  "usage": {
    "prompt_tokens": 82,
    "completion_tokens": 17,
    "total_tokens": 99,
    "completion_tokens_details": {
      "reasoning_tokens": 0,
      "accepted_prediction_tokens": 0,
      "rejected_prediction_tokens": 0
    }
  }
}

// 标准回复
{
  "id": "chatcmpl-B9MBs8CjcvOU2jLn4n570S5qMJKcT",
  "object": "chat.completion",
  "created": 1741569952,
  "model": "gpt-4.1-2025-04-14",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I assist you today?",
        "refusal": null,
        "annotations": []
      },
      "logprobs": null,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 19,
    "completion_tokens": 10,
    "total_tokens": 29,
    "prompt_tokens_details": {
      "cached_tokens": 0,
      "audio_tokens": 0
    },
    "completion_tokens_details": {
      "reasoning_tokens": 0,
      "audio_tokens": 0,
      "accepted_prediction_tokens": 0,
      "rejected_prediction_tokens": 0
    }
  },
  "service_tier": "default"
}
```

### 1.2 对象转换
Api 接口接收和返回的都是 Dict，因为 ChatOpenApi 需要完成对象转换:
1. dict -> Message: `_convert_dict_to_message`
2. Message -> dict: `_convert_message_to_dict`
3. Tool -> dict: ` convert_to_openai_tool`

```python
# langchain_openai.chat_models.base
def _convert_dict_to_message(_dict: Mapping[str, Any]) -> BaseMessage:
    """Convert a dictionary to a LangChain message.

    Args:
        _dict: The dictionary.

    Returns:
        The LangChain message.
    """

def _convert_message_to_dict(message: BaseMessage) -> dict:
    """Convert a LangChain message to a dictionary.

    Args:
        message: The LangChain message.

    Returns:
        The dictionary.
    """

# langchain_core.utils.function_calling
def convert_to_openai_tool(
    tool: Union[dict[str, Any], type[BaseModel], Callable, BaseTool],
    *,
    strict: Optional[bool] = None,
) -> dict[str, Any]:
    """Convert a tool-like object to an OpenAI tool schema.

    OpenAI tool schema reference:
    https://platform.openai.com/docs/api-reference/chat/create#chat-create-tools

    Args:
        tool:
            Either a dictionary, a pydantic.BaseModel class, Python function, or
            BaseTool. If a dictionary is passed in, it is
            assumed to already be a valid OpenAI function, a JSON schema with
            top-level 'title' key specified, an Anthropic format
            tool, or an Amazon Bedrock Converse format tool.
        strict:
            If True, model output is guaranteed to exactly match the JSON Schema
            provided in the function definition. If None, ``strict`` argument will not
            be included in tool definition.

    Returns:
        A dict version of the passed in tool which is compatible with the
        OpenAI tool-calling API.
    """
    if isinstance(tool, dict):
        if tool.get("type") in _WellKnownOpenAITools:
            return tool
        # As of 03.12.25 can be "web_search_preview" or "web_search_preview_2025_03_11"
        if (tool.get("type") or "").startswith("web_search_preview"):
            return tool
    oai_function = convert_to_openai_function(tool, strict=strict)
    return {"type": "function", "function": oai_function}

_WellKnownOpenAITools = (
    "function",
    "file_search",
    "computer_use_preview",
    "code_interpreter",
    "mcp",
    "image_generation",
    "web_search_preview",
)
```

### 1.3 tools 使用过程
这里以 ChatTongyi 为例说明一下 ChatModel 使用 tools 的过程:

#### 使用示例
先来看使用示例:

```python
tool = TavilySearch(max_results=2)
tools = [tool]
# 绑定 tools
llm_with_tools = llm.bind_tools(tools)
llm_with_tools.invoke("北京天气")
```


#### bind_tools
bind_tools 会将 tools 转换为 OpenAI 格式的 tools，然后调用 bind 方法绑定到 llm 上。在执行 invoke 时:
1. 转换后的 tool，会以 tools 参数传递给 invoke 方法，被收集在 kwargs 中 `{"tools": formatted_tools}`
2. 随着其他参数，原样传递给 api 接口。


```python

class Runnable(ABC, Generic[Input, Output]):
    def bind(self, **kwargs: Any) -> Runnable[Input, Output]:
        # tools 会放到 kwargs 参数内保存下来，在 invoke 调用时合并传入
        return RunnableBinding(bound=self, kwargs=kwargs, config={})

class ChatTongyi(BaseChatModel):
    def bind_tools(
        self,
        tools: Sequence[Union[Dict[str, Any], Type[BaseModel], Callable, BaseTool]],
        **kwargs: Any,
    ) -> Runnable[LanguageModelInput, BaseMessage]:
        """Bind tool-like objects to this chat model.

        Args:
            tools: A list of tool definitions to bind to this chat model.
                Can be  a dictionary, pydantic model, callable, or BaseTool. Pydantic
                models, callables, and BaseTools will be automatically converted to
                their schema dictionary representation.
            **kwargs: Any additional parameters to pass to the
                :class:`~langchain.runnable.Runnable` constructor.
        """

        formatted_tools = [convert_to_openai_tool(tool) for tool in tools]
        return super().bind(tools=formatted_tools, **kwargs)

    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        generations = []
        if self.streaming:
            generation_chunk: Optional[ChatGenerationChunk] = None
            for chunk in self._stream(
                messages, stop=stop, run_manager=run_manager, **kwargs
            ):
                if generation_chunk is None:
                    generation_chunk = chunk
                else:
                    generation_chunk += chunk
            assert generation_chunk is not None
            generations.append(self._chunk_to_generation(generation_chunk))
        else:
            params: Dict[str, Any] = self._invocation_params(
                messages=messages, stop=stop, **kwargs
            )
            resp = self.completion_with_retry(**params)
            generations.append(
                ChatGeneration(**self._chat_generation_from_qwen_resp(resp))
            )
```

### 1.4 with_structured_output
with_structured_output 也与 tools 相关，用于从 llm 中提取结构化输出。

```python
    def with_structured_output(
        self,
        schema: Union[Dict, Type[BaseModel]],
        *,
        include_raw: bool = False,
        **kwargs: Any,
    ) -> Runnable[LanguageModelInput, Union[Dict, BaseModel]]:
        """Model wrapper that returns outputs formatted to match the given schema.

        """
        if kwargs:
            raise ValueError(f"Received unsupported arguments {kwargs}")
        is_pydantic_schema = isinstance(schema, type) and is_basemodel_subclass(schema)
        llm = self.bind_tools([schema])
        if is_pydantic_schema:
            output_parser: OutputParserLike = PydanticToolsParser(
                tools=[schema],  # type: ignore[list-item]
                first_tool_only=True,
            )
        else:
            key_name = convert_to_openai_tool(schema)["function"]["name"]
            output_parser = JsonOutputKeyToolsParser(
                key_name=key_name, first_tool_only=True
            )

        if include_raw:
            parser_assign = RunnablePassthrough.assign(
                parsed=itemgetter("raw") | output_parser, parsing_error=lambda _: None
            )
            parser_none = RunnablePassthrough.assign(parsed=lambda _: None)
            parser_with_fallback = parser_assign.with_fallbacks(
                [parser_none], exception_key="parsing_error"
            )
            return RunnableMap(raw=llm) | parser_with_fallback
        else:
            return llm | output_parser

```


`llm = self.bind_tools([schema])`:
1. 调用 `convert_to_openai_tool(schema)`
2. 调用 `convert_to_openai_function(tool, strict=strict)`
4. 最终 `llm = self.bind_tools([schema])` 最终会作为 tools 提交给 api 接口。

我们看下面这个示例:

```python
from typing import Annotated
from dotenv import load_dotenv, find_dotenv
from langchain_community.chat_models import ChatTongyi
from pydantic import BaseModel, Field


import sys, langchain_community

print(sys.executable)
print(langchain_community.__file__)


class Joke(BaseModel):
    topic: Annotated[str, Field(description="笑话主题，如：编程、猫咪")]
    joke: Annotated[str, Field(description="笑话正文")]


_ = load_dotenv(find_dotenv())  # read local .env file

llm = ChatTongyi(temperature=0.0)

llm_sturct = llm.with_structured_output(Joke)

j = llm_sturct.invoke("给我讲一个关于猫的笑话")
print(j.topic)
```

对 ChatTongyi._generate 打上断点，可以看到发送给 tongyi 的请求参数:

```python
# 请求
{
	"model": "qwen-turbo",
	"top_p": 0.8,
	"result_format": "message",
	"tools": [{
		"type": "function",
		"function": {
			"name": "Joke",
			"description": "",
			"parameters": {
				"properties": {
					"topic": {
						"description": "笑话主题，如：编程、猫咪",
						"type": "string"
					},
					"joke": {
						"description": "笑话正文",
						"type": "string"
					}
				},
				"required": [
					"topic",
					"joke"
				],
				"type": "object"
			}
		}
	}],
	"messages": [{
		"role": "user",
		"content": "给我讲一个关于猫的笑话"
	}]
}
# model 的响应
{
	'lc': 1,
	'type': 'constructor',
	'id': ['langchain', 'schema', 'messages', 'AIMessage'],
	'kwargs': {
		'content': '',
		'additional_kwargs': {
			'tool_calls': [{
				'function': {
					'name': 'Joke',
					'arguments': '{"topic": "猫", "joke": "为什么猫不喜欢玩捉迷藏？因为它们总是被发现躲在沙发下面！"}'
				},
				'index': 0,
				'id': 'call_d3d9831f639345de87d8d1',
				'type': 'function'
			}]
		},
		'type': 'ai',
		'tool_calls': [{
			'name': 'Joke',
			'args': {
				'topic': '猫',
				'joke': '为什么猫不喜欢玩捉迷藏？因为它们总是被发现躲在沙发下面！'
			},
			'id': 'call_d3d9831f639345de87d8d1',
			'type': 'tool_call'
		}],
		'invalid_tool_calls': []
	}
}
```

可以看到返回的 AIMessage content 是空，返回的值包含在 tool_calls 中。而 PydanticToolsParser 实例化时包含 schema，会从 tool_calls 中提取出结构化输出。

我比较好奇，为什么大模型一定会用 tools 来实现结构化输出，问了 ChatGpt 得到下面的回答:


> **现象**：当你把「回答格式化的 schema」作为 **tool** 提供给大模型时，大模型几乎总是会去调用它。
> **疑问**：为什么？

---

🔎 背后的机制

1. **Tool 的语义**

   * 在 OpenAI / LangChain / LangGraph 这类框架里，给大模型定义一个 **tool**，就是在提示词层面告诉模型：

     > 你具备这些工具，必要时可以调用它们来完成任务。
   * 如果你把「输出必须符合某个 schema」包装成一个 tool，模型会认为：

     * 「哦，我要生成一个符合格式的结果，那我最好用这个工具。」

2. **系统提示词的影响**

   * LangChain / LangGraph 在调用模型时，会自动把工具列表写进系统 prompt，大概像这样：

     ```
     You can call the following tools:
     - generate_structured_response: use this to format your answer into the required schema.
     ```
   * 这在模型看来，意味着格式化输出 **唯一正确的方法** 就是调用这个 tool。
   * 所以大模型会「强制」使用它，而不是直接在正常输出里生成 JSON。

3. **函数调用（tool call）的偏好**

   * 目前的 GPT 系列模型对 `function_call`（tool 调用）有很强的偏好：

     * 一旦检测到 schema / function signature，模型会更倾向于用它来组织输出。
     * 这是因为模型在训练阶段被强化过 —— 当用户提供工具时，调用工具比直接输出更「安全」。
   * 所以哪怕任务本身可以直接完成，它也会习惯性走 `tool call`。

4. **区别于 response\_format**

   * 如果你用的是 `response_format`（比如 `{"type": "json_schema", "schema": {...}}`），那是底层 API 的约束，模型会直接生成符合 schema 的结果。
   * 如果你把 schema 包成一个「tool」，那模型就会：

     * 先调用这个工具（相当于「我要输出这个格式化结果」），
     * 然后由 LangChain / LangGraph 帮你走 tool 逻辑返回结果。
