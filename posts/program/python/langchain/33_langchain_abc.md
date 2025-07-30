---
weight: 1
title: "LangChain Cache And Memory"
date: 2025-07-30T23:00:00+08:00
lastmod: 2025-07-30T23:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langchain Cache And Memory"
featuredImage: 

tags: ["langchain 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

目前为止我们学习 langchain-core 中几乎所有的核心对象。现在我们对这些核心对象的抽象层次做一个总结，便于我们理解 LCEL 或者说 Agent 中对象的传递和调用链。


## Prompts
### 抽象层次
Prompts 抽象层次如下:
```python
BasePromptTemplate
    # 单条 Prompt
    StringPromptTemplate
        PromptTemplate
    ImagePromptTemplate
    PipelinePromptTemplate

    # Chat Promt
    BaseChatPromptTemplate
        ChatPromptTemplate
            StructuredPrompt


BaseMessagePromptTemplate
    _StringImageMessagePromptTemplate
        HumanMessagePromptTemplate
        AIMessagePromptTemplate
        SystemMessagePromptTemplate
```

这里把 PromptTemplate 分为:
1. 单条 Prompt: Prompt 的基础单元，处理不同类型的 Promt
2. Chat Prompt: 处理多种多个单条 Promt 的组合


### 顶层抽象
BasePromptTemplate 是顶层抽象类，继承自 RunnableSerializable 有默认实现。
BaseLanguageModel 主要有三个接口方法:
1. format_prompt
2. format

```python
class BasePromptTemplate(
    RunnableSerializable[dict, PromptValue], ABC, Generic[FormatOutputType]
):
    @abstractmethod
    def format_prompt(self, **kwargs: Any) -> PromptValue:
        """Create Prompt Value.

        Args:
            kwargs: Any arguments to be passed to the prompt template.

        Returns:
            PromptValue: The output of the prompt.
        """

    @abstractmethod
    def format(self, **kwargs: Any) -> FormatOutputType:
        """Format the prompt with the inputs.

        Args:
            kwargs: Any arguments to be passed to the prompt template.

        Returns:
            A formatted string.

        Example:

        .. code-block:: python

            prompt.format(variable1="foo")
        """

    @override
    def invoke(
        self, input: dict, config: Optional[RunnableConfig] = None, **kwargs: Any
    ) -> PromptValue:
        """Invoke the prompt.

        Args:
            input: Dict, input to the prompt.
            config: RunnableConfig, configuration for the prompt.

        Returns:
            PromptValue: The output of the prompt.
        """
        config = ensure_config(config)
        if self.metadata:
            config["metadata"] = {**config["metadata"], **self.metadata}
        if self.tags:
            config["tags"] = config["tags"] + self.tags
        return self._call_with_config(
            self._format_prompt_with_error_handling,
            input,
            config,
            run_type="prompt",
            serialized=self._serialized,
        )

    def _format_prompt_with_error_handling(self, inner_input: dict) -> PromptValue:
        inner_input_ = self._validate_input(inner_input)
        return self.format_prompt(**inner_input_)
```

调用链如下:

```bash
input -> PromptValue
invoke
    _format_prompt_with_error_handling
        format_prompt
```

### 业务抽象
单条 Prompt 将 format_prompt 实现在 format 方法之上，所以它们有如下的调用链:

```bash
invoke
    _format_prompt_with_error_handling
        format_prompt
            format
```

Chat Prompt 把 format 方法实现在 format_prompt 方法之上，并且添加了一个 format_messages 抽象方法来实现 format_prompt。所以它的调用链如下:

```bash
invoke
    _format_prompt_with_error_handling
        format_prompt
            format_messages
format
    format_prompt
        format_messages
```

### BaseMessagePromptTemplate
为什么有 BaseMessagePromptTemplate？
1. 参数 -> BasePromptTemplate -> PromptValue -> message/text
3. BaseMessagePromptTemplate 接收更通用的输入，根据输入的不同解析成不同的 PromptTemplate，并生成特定类型的 Message(由 _msg_class 决定生成什么类型的消息)。相当于一个 prompt 生成和聚合的入口。

```python
class _StringImageMessagePromptTemplate(BaseMessagePromptTemplate):
    """Human message prompt template. This is a message sent from the user."""

    prompt: Union[
        StringPromptTemplate,
        list[Union[StringPromptTemplate, ImagePromptTemplate, DictPromptTemplate]],
    ]
    """Prompt template."""
    additional_kwargs: dict = Field(default_factory=dict)
    """Additional keyword arguments to pass to the prompt template."""

    _msg_class: type[BaseMessage]
    @classmethod
    def from_template(
        cls: type[Self],
        template: Union[
            str,
            list[Union[str, _TextTemplateParam, _ImageTemplateParam, dict[str, Any]]],
        ],
        template_format: PromptTemplateFormat = "f-string",
        *,
        partial_variables: Optional[dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Self:
```


## Language Model
### 抽象层次
Language Model 抽象层次如下:
```python
BaseLanguageModel
    BaseLLM
    BaseChatModel
```
### 顶层抽象
BaseLanguageModel 是顶层抽象，继承自 RunnableSerializable，但是并没有提供 invoke 的默认实现。
BaseLanguageModel 主要有三个接口方法:
1. `generate_prompt`
2. `agenerate_prompt`
3. `invoke`

### 业务抽象

```python
class BaseLanguageModel(
    RunnableSerializable[LanguageModelInput, LanguageModelOutputVar], ABC
):
    @abstractmethod
    def generate_prompt(
        self,
        prompts: list[PromptValue],
        stop: Optional[list[str]] = None,
        callbacks: Callbacks = None,
        **kwargs: Any,
    ) -> LLMResult:

    @abstractmethod
    async def agenerate_prompt(
        self,
        prompts: list[PromptValue],
        stop: Optional[list[str]] = None,
        callbacks: Callbacks = None,
        **kwargs: Any,
    ) -> LLMResult:
```

### 业务抽象
BaseLLM、BaseChatModel 是实际业务继承类，抽象接口为:
1. _generate
2. _llm_type
3. _stream

调用链如下:

```bash
# BaseLLM
# LanguageModelInput = Union[PromptValue, str, Sequence[MessageLikeRepresentation]]
LanguageModelInput -> str
invoke
    generate_prompt            
        generate
            _generate_helper
                _generate
            dict
                _llm_type

stream:
    _stream

# BaseChatModel
LanguageModelInput -> Message
invoke:
    generate_prompt
        generate
            _get_invocation_params
                dict
                    _llm_type
            _generate_with_cache
                _generate
stream:
    _stream

with_structured_output:
    bind_tools
```

## OutPut
### 抽象层次
```bash
Generation
    GenerationChunk
    ChatGeneration
        ChatGenerationChunk
ChatResult
LLMResult
```
Output 代表模型的输出:
1. Generation 表示最简单文本输出
2. ChatGeneration 表示 Chat Model 的单条输出，包含一条 Message 表示输出的内容
3. ChatResult 表示 Chat Model call 调用结果
4. LLMResult 表示 LLM Model call 调用结果

## OutPut Parser
### 抽象层次
```python
BaseLLMOutputParser
    BaseGenerationOutputParser
    BaseOutputParser
        StrOutputParser
        BaseTransformOutputParser
            BaseCumulativeTransformOutputParser
                JsonOutPutParser
```
### 顶层抽象
BaseLLMOutputParser 是顶层抽象，定义 parse_result 抽象方法

```python
class BaseLLMOutputParser(ABC, Generic[T]):
    """Abstract base class for parsing the outputs of a model."""

    @abstractmethod
    def parse_result(self, result: list[Generation], *, partial: bool = False) -> T:
```

### 业务抽象
BaseGenerationOutputParser

```bash
Union[str, BaseMessage] -> T
invoke
    parse_result

```

BaseOutputParser

```bash
Union[str, BaseMessage] -> T
invoke
    parse_result
        parse
```

## Chain
Chain 只有 Chain 抽象，调用链如下:

```bash
dict[str, Any] -> dict[str, Any]
invoke
    _call
        generate
```