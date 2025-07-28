---
weight: 1
title: "LangChain Output Parser"
date: 2025-07-22T23:00:00+08:00
lastmod: 2025-07-22T23:00:00+08:00
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

## 1. OutPut Parser 的 UML 类图
![OutPut Parser 类图](/images/langchain/output_parser.svg)

如图，OutPut Parser 有如下抽象基类:
1. BaseLLMOutputParser
2. BaseGenerationOutputParser
3. BaseOutputParser
4. BaseTransformOutputParser
5. BaseCumulativeTransformOutputParser

### 1.1 提问
让我们问问大模型这三个基类代表的语义。

```bash
我正在阅读  langchain output parser 子包的源代码，注意到包内，有三个 base 的抽象类:
2. BaseGenerationOutputParser
3. BaseOutputParser
4. BaseTransformOutputParser
5. BaseCumulativeTransformOutputParser
请给我从语义上解释一下这些类的的作用

说明，最开始我是把 1. BaseLLMOutputParser 也作为内容之一提给了 ChatGPT 但是我觉得回答不太好所以删了
```

### 1.2 回答
`langchain.output_parsers` 子包中定义的这些 Base 抽象类（`BaseOutputParser`、`BaseGenerationOutputParser`、`BaseTransformOutputParser`、`BaseCumulativeTransformOutputParser`）是 LangChain 中构建输出解析器（output parsers）的基础组件，用于将 LLM 的原始输出（字符串或结构化数据）解析为用户需要的特定结构或对象。

下面我从**语义与职责**上解释这些基类的作用和区别：

---

### 1. `BaseOutputParser`

**语义：**
最基础的输出解析器抽象类，定义了“**如何从 LLM 输出中提取有用数据**”的核心接口。

**职责：**

* 接收 **字符串类型** 的 LLM 输出；
* 实现一个 `parse` 方法将字符串解析为结构化数据；
* 可以拓展为适用于 chat 或 completion 类型模型的解析器。

**适用场景：**
适用于对 **文本输出进行直接解析**，例如 JSON、列表、标量值提取等。

---

### 2. `BaseGenerationOutputParser`

**语义：**
解析 `Generation` 对象列表，而非单纯字符串。

**职责：**

* 解析 LLM 的输出 **`List[Generation]` 类型（每个元素包含 text/token/metadata）**；
* 实现 `parse_result(generations: list[Generation]) -> T` 方法；
* 支持更高级的解析逻辑（如从多个 generations 中选择、聚合等）。

**适用场景：**
当你用的是 `LLM.invoke()` 或 `ChatModel.generate()` 并返回了多个 `Generation`，需要从中抽取、分析结果时。

---

### 3. `BaseTransformOutputParser`

**语义：**
一个**中间转换器解析器**，用于将一个解析器的输出再进一步加工为另一种形式。

**职责：**

* 接收一个上游解析器的输出；
* 实现 `transform()` 方法对其进行转换；
* 典型的功能是 “**后处理**” 逻辑，例如从字典中提取字段、重命名字段、单位换算等。

**适用场景：**
可以在一个已有 `OutputParser` 的基础上，**做轻量级转换处理**，实现模块组合。

---

### 4. `BaseCumulativeTransformOutputParser`

**语义：**
用于在一个流式（streaming）上下文中，**逐步累积处理多个输出片段**。

**职责：**

* 每接收一个输出块（如 `str` 或 `GenerationChunk`），就调用一次 `transform()`；
* 保持一个状态，持续地累积结果（如构造 JSON 数组、聚合值等）；
* 实现 `get_format_instructions()` 说明如何格式化输出（可选）；
* 与流式处理（例如 OpenAI streaming responses）结合使用效果很好。

**适用场景：**
适用于**增量输出**或**流式消费**的场景，比如逐步构造结构、长文档汇总、连续对话等。

---

## 总结对比表：

| 类名                                    | 输入类型                      | 方法                       | 主要作用/特点            |
| ------------------------------------- | ------------------------- | ------------------------ | ------------------ |
| `BaseOutputParser`                    | `str`                     | `parse()`                | 解析字符串为结构化数据        |
| `BaseGenerationOutputParser`          | `List[Generation]`        | `parse_result()`         | 解析 LLM 多个输出项       |
| `BaseTransformOutputParser`           | 任意类型（上游 parser 输出）        | `transform()`            | 对已有 parser 输出进行再加工 |
| `BaseCumulativeTransformOutputParser` | `str` 或 `GenerationChunk` | `transform()`, `final()` | 流式地累积解析多个输出        |


## 2. 基础抽象类
我把这几个类的定义都摘了出来，从实现上可以更好的理解他们语义上的区别:
1. BaseLLMOutputParser 有 parse_result 抽象方法，处理 `list[Generation]`
2. BaseGenerationOutputParser 继承自 BaseLLMOutputParser，并实现了 Runnable 接口
3. BaseOutputParser 继承自 BaseLLMOutputParser，提供了默认的 parse_result 实现，只处理第一条 result，并把处理委托给了 parse。从语义上讲 **BaseOutputParser 只处理单条 llm 输出**
4. BaseTransformOutputParser 继承自 BaseOutputParser 实现了一个默认的 transform 方法用于处理 stream input
5. BaseCumulativeTransformOutputParser 重新实现了 BaseTransformOutputParser transform 方法，增加 diff 获取增量输出的语义。

区分和理解这些类的差别，可以从方法接受的输入类型上入手。


```python
class BaseLLMOutputParser(ABC, Generic[T]):
    """Abstract base class for parsing the outputs of a model."""

    @abstractmethod
    def parse_result(self, result: list[Generation], *, partial: bool = False) -> T:
        """Parse a list of candidate model Generations into a specific format.

        Args:
            result: A list of Generations to be parsed. The Generations are assumed
                to be different candidate outputs for a single model input.
            partial: Whether to parse the output as a partial result. This is useful
                for parsers that can parse partial results. Default is False.

        Returns:
            Structured output.
        """

  
class BaseGenerationOutputParser(
    BaseLLMOutputParser, RunnableSerializable[LanguageModelOutput, T]
):
    """Base class to parse the output of an LLM call."""

    @override
    def invoke(
        self,
        input: Union[str, BaseMessage],
        config: Optional[RunnableConfig] = None,
        **kwargs: Any,
    ) -> T:
        if isinstance(input, BaseMessage):
            return self._call_with_config(
                lambda inner_input: self.parse_result(
                    [ChatGeneration(message=inner_input)]
                ),
                input,
                config,
                run_type="parser",
            )
        return self._call_with_config(
            lambda inner_input: self.parse_result([Generation(text=inner_input)]),
            input,
            config,
            run_type="parser",
        )


class BaseOutputParser(
    BaseLLMOutputParser, RunnableSerializable[LanguageModelOutput, T]
):
    """Base class to parse the output of an LLM call.

    Output parsers help structure language model responses.
    """
    @override
    def invoke(
        self,
        input: Union[str, BaseMessage],
        config: Optional[RunnableConfig] = None,
        **kwargs: Any,
    ) -> T:
        if isinstance(input, BaseMessage):
            return self._call_with_config(
                lambda inner_input: self.parse_result(
                    [ChatGeneration(message=inner_input)]
                ),
                input,
                config,
                run_type="parser",
            )
        return self._call_with_config(
            lambda inner_input: self.parse_result([Generation(text=inner_input)]),
            input,
            config,
            run_type="parser",
        )


    @override
    def parse_result(self, result: list[Generation], *, partial: bool = False) -> T:
        """Parse a list of candidate model Generations into a specific format.

        The return value is parsed from only the first Generation in the result, which
            is assumed to be the highest-likelihood Generation.

        Args:
            result: A list of Generations to be parsed. The Generations are assumed
                to be different candidate outputs for a single model input.
            partial: Whether to parse the output as a partial result. This is useful
                for parsers that can parse partial results. Default is False.

        Returns:
            Structured output.
        """
        return self.parse(result[0].text)

    @abstractmethod
    def parse(self, text: str) -> T:
        """Parse a single string model output into some structure.

        Args:
            text: String output of a language model.

        Returns:
            Structured output.
        """

class BaseTransformOutputParser(BaseOutputParser[T]):
    """Base class for an output parser that can handle streaming input."""
    @override
    def transform(
        self,
        input: Iterator[Union[str, BaseMessage]],
        config: Optional[RunnableConfig] = None,
        **kwargs: Any,
    ) -> Iterator[T]:
        """Transform the input into the output format.

        Args:
            input: The input to transform.
            config: The configuration to use for the transformation.
            kwargs: Additional keyword arguments.

        Yields:
            The transformed output.
        """
        yield from self._transform_stream_with_config(
            input, self._transform, config, run_type="parser"
        )
    
    def _transform(
        self,
        input: Iterator[Union[str, BaseMessage]],  # noqa: A002
    ) -> Iterator[T]:


class BaseCumulativeTransformOutputParser(BaseTransformOutputParser[T]):
    """Base class for an output parser that can handle streaming input."""

    diff: bool = False
    """In streaming mode, whether to yield diffs between the previous and current
    parsed output, or just the current parsed output.
    """

    @override
    def _transform(self, input: Iterator[Union[str, BaseMessage]]) -> Iterator[Any]:
      pass
```

## 3. JsonOutputParser/PydanticOutputParser 
JsonOutputParser/PydanticOutputParser 都可以通过定义 schema 来解析模型输出，而且他们都提供了一个 get_format_instructions 用于在 Prompt 中添加定义输出的提示。

### 3.1 JsonOutputParser


```python

class JsonOutputParser(BaseCumulativeTransformOutputParser[Any]):
    """Parse the output of an LLM call to a JSON object.

    When used in streaming mode, it will yield partial JSON objects containing
    all the keys that have been returned so far.

    In streaming, if `diff` is set to `True`, yields JSONPatch operations
    describing the difference between the previous and the current object.
    """

    pydantic_object: Annotated[Optional[type[TBaseModel]], SkipValidation()] = None  # type: ignore[valid-type]
    """The Pydantic object to use for validation.
    If None, no validation is performed."""

    def get_format_instructions(self) -> str:
        """Return the format instructions for the JSON output.

        Returns:
            The format instructions for the JSON output.
        """
        if self.pydantic_object is None:
            return "Return a JSON object."
        # Copy schema to avoid altering original Pydantic schema.
        schema = dict(self._get_schema(self.pydantic_object).items())

        # Remove extraneous fields.
        reduced_schema = schema
        if "title" in reduced_schema:
            del reduced_schema["title"]
        if "type" in reduced_schema:
            del reduced_schema["type"]
        # Ensure json in context is well-formed with double quotes.
        schema_str = json.dumps(reduced_schema, ensure_ascii=False)
        return JSON_FORMAT_INSTRUCTIONS.format(schema=schema_str)

    def parse_result(self, result: list[Generation], *, partial: bool = False) -> Any:
        """Parse the result of an LLM call to a JSON object.

        Args:
            result: The result of the LLM call.
            partial: Whether to parse partial JSON objects.
                If True, the output will be a JSON object containing
                all the keys that have been returned so far.
                If False, the output will be the full JSON object.
                Default is False.

        Returns:
            The parsed JSON object.

        Raises:
            OutputParserException: If the output is not valid JSON.
        """
        text = result[0].text
        text = text.strip()
        if partial:
            try:
                return parse_json_markdown(text)
            except JSONDecodeError:
                return None
        else:
            try:
                return parse_json_markdown(text)
            except JSONDecodeError as e:
                msg = f"Invalid json output: {text}"
                raise OutputParserException(msg, llm_output=text) from e
```

### 3.2 PydanticOutputParser

```python
class PydanticOutputParser(JsonOutputParser, Generic[TBaseModel]):
    """Parse an output using a pydantic model."""

    pydantic_object: Annotated[type[TBaseModel], SkipValidation()]
    """The pydantic model to parse."""

    def get_format_instructions(self) -> str:
        """Return the format instructions for the JSON output.

        Returns:
            The format instructions for the JSON output.
        """
        # Copy schema to avoid altering original Pydantic schema.
        schema = dict(self.pydantic_object.model_json_schema().items())

        # Remove extraneous fields.
        reduced_schema = schema
        if "title" in reduced_schema:
            del reduced_schema["title"]
        if "type" in reduced_schema:
            del reduced_schema["type"]
        # Ensure json in context is well-formed with double quotes.
        schema_str = json.dumps(reduced_schema, ensure_ascii=False)

        return _PYDANTIC_FORMAT_INSTRUCTIONS.format(schema=schema_str)

    def _parse_obj(self, obj: dict) -> TBaseModel:
        try:
            if issubclass(self.pydantic_object, pydantic.BaseModel):
                return self.pydantic_object.model_validate(obj)
            if issubclass(self.pydantic_object, pydantic.v1.BaseModel):
                return self.pydantic_object.parse_obj(obj)
            msg = f"Unsupported model version for PydanticOutputParser: \
                        {self.pydantic_object.__class__}"
            raise OutputParserException(msg)
        except (pydantic.ValidationError, pydantic.v1.ValidationError) as e:
            raise self._parser_exception(e, obj) from e

    def parse_result(
        self, result: list[Generation], *, partial: bool = False
    ) -> Optional[TBaseModel]:
        """Parse the result of an LLM call to a pydantic object.

        Args:
            result: The result of the LLM call.
            partial: Whether to parse partial JSON objects.
                If True, the output will be a JSON object containing
                all the keys that have been returned so far.
                Defaults to False.

        Returns:
            The parsed pydantic object.
        """
        try:
            json_object = super().parse_result(result)
            return self._parse_obj(json_object)
        except OutputParserException:
            if partial:
                return None
            raise
```

## 4. ListOutputParser

```python
class ListOutputParser(BaseTransformOutputParser[list[str]]):
    """Parse the output of an LLM call to a list."""

    @property
    def _type(self) -> str:
        return "list"

    @abstractmethod
    def parse(self, text: str) -> list[str]:
        """Parse the output of an LLM call.

        Args:
            text: The output of an LLM call.

        Returns:
            A list of strings.
        """

class CommaSeparatedListOutputParser(ListOutputParser):
    """Parse the output of an LLM call to a comma-separated list."""

def get_format_instructions(self) -> str:
        """Return the format instructions for the comma-separated list output."""
        return (
            "Your response should be a list of comma separated values, "
            "eg: `foo, bar, baz` or `foo,bar,baz`"
        )

    def parse(self, text: str) -> list[str]:
        """Parse the output of an LLM call.

        Args:
            text: The output of an LLM call.

        Returns:
            A list of strings.
        """
        try:
            reader = csv.reader(
                StringIO(text), quotechar='"', delimiter=",", skipinitialspace=True
            )
            return [item for sublist in reader for item in sublist]
        except csv.Error:
            # keep old logic for backup
            return [part.strip() for part in text.split(",")]
```