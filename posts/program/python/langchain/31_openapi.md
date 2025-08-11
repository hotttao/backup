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