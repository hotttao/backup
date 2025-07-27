---
weight: 1
title: "LangChain Output Parser"
date: 2025-07-22T22:00:00+08:00
lastmod: 2025-07-22T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langchain output_parsers"
featuredImage: 

tags: ["langchain 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---
## 1. Outputs 和 Output Parser
看代码会发现 langchain-core 有两个 outputs 和 output_parsers 两个包。

提问: langchain 源码包内 outputs 和 output_parsers 两个package，请从语义上解释下这两个包的作用
回答: 这两个包名称相近但语义和作用不同，在 LangChain 中分别承担着 **“结构化输出”** 的不同阶段。我们来逐一从**语义、功能定位、关系与区别**几个方面进行解释：


| 包名               | 语义              | 作用                                                              |
| ---------------- | --------------- | --------------------------------------------------------------- |
| `output_parsers` | “**输出解析器**”     | 负责**把语言模型的原始输出（字符串）解析成结构化对象**                                   |
| `outputs`        | “**输出规范 & 类型**” | 定义结构化输出的**类型体系、运行包装器、输出值对象**等（如 `ChatGeneration`、`PromptValue`） |

---

### `output_parsers` 的语义和作用

> `output_parsers` 是指一组用于**将 LLM 原始返回的文本或消息格式解析为结构化数据的组件**。

这些组件的工作类似于：

* 提取 JSON、代码块、Markdown 表格
* 正则匹配、列表分割、键值提取
* 模型输出到 Pydantic 实例的映射

🔧 常见类

* `StrOutputParser`: 输出原样返回字符串
* `JsonOutputParser`: 输出解析为 JSON 字典
* `PydanticOutputParser`: 输出变为一个指定 Pydantic 类的实例
* `OutputFixingParser`: 尝试修复错误输出（如 JSON 不合法）
* `RetryOutputParser`: 输出错误时进行重试

🧪 示例用途

```python
from langchain.output_parsers import JsonOutputParser

parser = JsonOutputParser()
result = parser.parse('{"name": "Tom", "age": 18}')
# result => {'name': 'Tom', 'age': 18}
```

主要用于：

* `Runnable` 链末尾解析器（`.with_config({"output_parser": ...})`）
* Agent 的工具调用结果解析
* Prompt + LLM 后的结构化处理

---

### 📦 二、`outputs` 的语义和作用

> `outputs` 是指 LangChain 中用于**描述语言模型响应结果的类型体系与封装对象**，比如一个模型输出了多条消息、某条消息的来源是谁等。

🧱 功能定位

* 封装原始模型输出的结构（比如：多条回答、角色、消息内容）
* 支撑链条式调用的数据类型传递
* 作为 `Runnable` 和 `LCEL` 构建管道的输入/输出结构

📌 常见对象

* `LLMResult`: 封装一个 LLM 多次调用的结果（包含多个 generations）
* `Generation`: 模型输出的一条文本
* `ChatGeneration`: 包含消息角色信息的输出（用于 ChatModel）
* `PromptValue`: 一个 prompt 输入值（用于多种格式）
* `ChatMessage`: 带角色的消息

🧪 示例用途

```python
from langchain_core.outputs import ChatGeneration

gen = ChatGeneration(message=AIMessage(content="你好"))
print(gen.message.content)
# => "你好"
```

✅ 用于哪里？

* LLM 调用的返回值结构
* `Runnable.invoke()` 的中间值
* `Runnable.map()`、`Runnable.each()` 处理多个 generations
* Agent memory、tracer 日志记录等

---

### 🔄 三、两者之间的关系与区别

| 维度   | `output_parsers`                      | `outputs`                                |
| ---- | ------------------------------------- | ---------------------------------------- |
| 语义   | “把字符串变成结构化对象”                         | “定义结构化对象的结构和类型”                          |
| 本质   | 解析器工具集                                | 类型定义模块                                   |
| 上游输入 | LLM 输出字符串或消息                          | PromptTemplate、LLM、Parser 等的返回值          |
| 下游用途 | RAG 解析、Agent 工具调用、Pydantic 转换         | 链中间值传递、结果封装、日志记录                         |
| 示例类  | `JsonOutputParser`, `StrOutputParser` | `Generation`, `PromptValue`, `LLMResult` |

## 2. OutPut 的 UML 类图
![OutPut 类图](/images/langchain/output.svg)

如图，OutPut 的代表比较简单，有如下类:
1. Generation
2. GenerationChunk
3. ChatGeneration
4. ChatGenerationChunk
5. ChatResult
6. LLMResult
7. RunInfo

### 2.1 提问
让我们问问大模型这三个基类代表的语义。

```bash
我正在阅读  langchain output 子包的源代码，注意到包内，有如下类:
1. Generation
2. GenerationChunk
3. ChatGeneration
4. ChatGenerationChunk
5. ChatResult
6. LLMResult
7. RunInfo
请给我从语义上解释一下这些类的的作用

```


| 类名                      | 类型归类      | 语义解释                                     | 主要字段                                                | 典型用途场景                                           |
| ----------------------- | --------- | ---------------------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| **Generation**          | Output 单元 | 表示一次基础 LLM 生成结果（适用于非对话模型）                | `text: str`, `generation_info: Optional[dict]`      | 用于 `LLM.invoke()` 或 `LLM.generate()` 输出          |
| **GenerationChunk**     | 流式输出片段    | 表示流式输出过程中的一个文本片段                         | 同上（不一定完整）                                           | `stream=True` 时，逐步构建完整输出                         |
| **ChatGeneration**      | Output 单元 | 表示 Chat 模型（如 GPT）的一条完整消息输出               | `message: BaseMessage`, `generation_info`           | 用于 `ChatModel.invoke()` 或 `ChatModel.generate()` |
| **ChatGenerationChunk** | 流式输出片段    | 表示 Chat 模型流式输出中的一段消息片段                   | `message: BaseMessageChunk`                         | 用于 `ChatModel.stream()` 场景下的增量消息输出               |
| **ChatResult**          | 聚合结果      | 表示 Chat 模型一次完整调用的聚合结果（多条 ChatGeneration） | `generations: list[ChatGeneration]`, `llm_output`   | 用于封装多条 message 输出及其附加元信息                         |
| **LLMResult**           | 聚合结果      | 表示非 Chat 模型一次完整调用的聚合结果（多条 Generation）    | `generations: list[list[Generation]]`, `llm_output` | 多轮输出封装，用于 `LLM.generate()`                       |
| **RunInfo**             | 元信息结构体    | 记录一次模型调用的运行 ID（可用于追踪）                    | `run_id: UUID`                                      | 支持 tracing、logging、chain 追踪等功能                   |

这个对比就比较清楚了，不同的 Ouput 对应不同的 model 不同的输出方式下的输出。这里我们举其中几个字段较多的类说明一下每个字段的含义:

```python
class Generation(Serializable):

    text: str
    """Generated text output."""

    generation_info: Optional[dict[str, Any]] = None
    """Raw response from the provider.

    May include things like the reason for finishing or token log probabilities.
    """
    type: Literal["Generation"] = "Generation"
    """Type is used exclusively for serialization purposes.
    Set to "Generation" for this class."""

class ChatGeneration(Generation):

    text: str = ""
    """The text contents of the output message.

    .. warning::
        SHOULD NOT BE SET DIRECTLY!
    """
    message: BaseMessage
    """The message output by the chat model."""
    # Override type to be ChatGeneration, ignore mypy error as this is intentional
    type: Literal["ChatGeneration"] = "ChatGeneration"  # type: ignore[assignment]
    """Type is used exclusively for serialization purposes."""


class LLMResult(BaseModel):
    """A container for results of an LLM call.

    Both chat models and LLMs generate an LLMResult object. This object contains the
    generated outputs and any additional information that the model provider wants to
    return.
    """

    generations: list[
        list[Union[Generation, ChatGeneration, GenerationChunk, ChatGenerationChunk]]
    ]
    
    llm_output: Optional[dict] = None
    """For arbitrary LLM provider specific output.

    This dictionary is a free-form dictionary that can contain any information that the
    provider wants to return. It is not standardized and is provider-specific.

    Users should generally avoid relying on this field and instead rely on accessing
    relevant information from standardized fields present in AIMessage.
    """
    run: Optional[list[RunInfo]] = None
    """List of metadata info for model call for each input."""

    type: Literal["LLMResult"] = "LLMResult"
    """Type is used exclusively for serialization purposes."""

```

下面是对你给出的三个类 —— `Generation`、`ChatGeneration`、`LLMResult` 中**每个字段的含义**的表格化解释：

---

#### ✅ `Generation` 字段说明

| 字段名               | 类型                         | 含义说明                                   |
| ----------------- | -------------------------- | -------------------------------------- |
| `text`            | `str`                      | 模型生成的文本输出。通常是 `LLM` 模型生成的正文内容。         |
| `generation_info` | `Optional[dict[str, Any]]` | 模型提供商返回的原始附加信息，如停止原因、token logprobs 等。 |
| `type`            | `Literal["Generation"]`    | 用于序列化目的的标识字段，指明这是 `Generation` 类型的实例。  |

---

#### ✅ `ChatGeneration` 字段说明（继承自 `Generation`）

| 字段名               | 类型                          | 含义说明                                                 |
| ----------------- | --------------------------- | ---------------------------------------------------- |
| `text`            | `str`                       | 提供快捷访问消息内容的方式（通常为 `message.content` 的别名）。**不应直接设置**。 |
| `message`         | `BaseMessage`               | Chat 模型生成的消息对象（如 `AIMessage`），是推荐的访问入口。              |
| `generation_info` | `Optional[dict[str, Any]]`  | 同 `Generation`，附加信息如 stop\_reason、logprobs（可能为空）。    |
| `type`            | `Literal["ChatGeneration"]` | 用于序列化，表明这是 Chat 模型生成的结果。                             |

---

#### ✅ `LLMResult` 字段说明

| 字段名           | 类型                                                                                    | 含义说明                                                           |
| ------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `generations` | `list[list[Union[Generation, ChatGeneration, GenerationChunk, ChatGenerationChunk]]]` | 外层 list 对应多个输入；内层 list 为该输入的多个候选输出。每个输出是一次 Generation 或 Chunk。 |
| `llm_output`  | `Optional[dict]`                                                                      | 模型供应商提供的原始输出信息，如 token 用量、模型版本等。结构不统一，建议不要直接依赖。                |
| `run`         | `Optional[list[RunInfo]]`                                                             | 每个输入调用的运行元信息（如 run\_id），用于 tracing、调试等。                        |
| `type`        | `Literal["LLMResult"]`                                                                | 用于序列化标识该对象为 `LLMResult` 类型。                                    |

---

#### ✅ 图示结构关系补充

```text
LLMResult
├── generations (List[List[Generation/ChatGeneration]])
│   ├── Generation
│   └── ChatGeneration
│       └── message (AIMessage or other BaseMessage)
├── llm_output
└── run (List[RunInfo])
```

