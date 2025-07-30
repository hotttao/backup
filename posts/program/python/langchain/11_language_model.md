---
weight: 1
title: "LangChain Language Model"
date: 2025-07-23T14:00:00+08:00
lastmod: 2025-07-23T14:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langchain language model"
featuredImage: 

tags: ["langchain 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---


这一节我们来看 Langchain 的 Language Model。

## 1. Language Model 的 UML 类图
![Language Model 类图](/images/langchain/language_model.svg)

Language Model 有如下基类:
1. BaseLanguageModel
2. BaseChatModel
3. BaseLLM


Language Model 基类不多，让我们直接问大模型这些类的语义

```bash
我正在阅读  Language Model 子包的源代码，注意到包内，有如下类:
1. BaseLanguageModel
2. BaseChatModel
3. BaseLLM

请给我从语义上解释一下这些类的的作用

```

在 LangChain 中，`language_models` 子包是核心模块之一，负责抽象和实现对底层语言模型（如 OpenAI、Anthropic、Cohere 等）的调用逻辑。你提到的两个类：

1. `BaseLanguageModel`
2. `BaseChatModel`

它们是这一模块中的两个重要抽象基类。我们可以从**语义（功能定位）和继承关系**两个角度来解释它们的作用：

---

### `BaseLanguageModel` — 通用语言模型基类

🌐 语义说明：

`BaseLanguageModel` 是所有语言模型的**最基础抽象类**，它统一封装了“调用一个语言模型并返回生成结果”的基础行为，**不限制模型的交互方式**（即支持 completion、chat、function 调用等多种形式）。

> ✅ 它更偏底层、更抽象、更通用。

🧩 关键职责：

* 提供通用的接口定义，如：

  * `generate()`: 对多个提示进行批量生成。
  * `invoke()`: 对一个输入生成输出。
  * 输出 `LLMResult` / `ChatResult` 等结构化结果。
* 定义 tracing（运行追踪）、缓存、回调处理等底层机制的接口。
* 子类一般会重写 `_generate()` 来实现自己的核心逻辑。

🧬 典型子类有：

* `LLM`: 基于文本补全（text completion）模型。
* `ChatModel`: 基于多轮对话（chat-based）模型。

---

### `BaseChatModel` — 面向“对话模型”的抽象基类

💬 语义说明：

`BaseChatModel` 是 `BaseLanguageModel` 的一个子类，用于封装 **chat-based 模型的标准行为**，如 OpenAI 的 `gpt-3.5-turbo`、Anthropic Claude 等。它们都以多轮对话消息（如 user、system、assistant）为输入。

> ✅ 这是一个**对话风格模型（Chat Model）专用的抽象基类**。

🧩 关键职责：

* 将 `List[BaseMessage]` 类型作为输入（比如 SystemMessage、HumanMessage、AIMessage）。
* 实现 `generate()` 方法来处理多个 chat prompt。
* 提供 `predict_messages()` 接口，返回结构化的 AIMessage。
* 定义 `_generate()` 和 `_combine_messages()` 等钩子供子类实现。

🎯 使用场景：

当你希望封装一个聊天风格接口（如 OpenAI 的 ChatCompletion API），你应该继承这个类，而不是 `BaseLanguageModel`。


| 类名                  | 语义定位              | 输入类型                | 使用场景                | 子类示例                          |
| ------------------- | ----------------- | ------------------- | ------------------- | ----------------------------- |
| `BaseLanguageModel` | 所有语言模型的统一抽象       | Prompt（字符串或消息）      | 底层统一抽象层，主要定义接口与共性行为 | `LLM`, `BaseChatModel`        |
| `BaseChatModel`     | 面向 Chat 类型语言模型的抽象 | `List[BaseMessage]` | 构建支持多角色对话的模型（如 GPT） | `ChatOpenAI`, `ChatAnthropic` |



```
BaseLanguageModel
├── BaseLLM               # 面向补全文本（completion）类模型
    └── LLM               # 实际的某个实现
└── BaseChatModel    # 面向对话风格模型
    └── ChatOpenAI   # 实际的某个实现
```

LanguageModel 的实现比较复杂，我先来对比这几个类的抽象层次，再来看具体的代码。

## 2. 属性和抽象方法
### 2.1 BaseLanguageModel

```python
class BaseLanguageModel(
    RunnableSerializable[LanguageModelInput, LanguageModelOutputVar], ABC
):
    """Abstract base class for interfacing with language models.

    All language model wrappers inherited from BaseLanguageModel.
    """

    cache: Union[BaseCache, bool, None] = Field(default=None, exclude=True)
    """Whether to cache the response.

    * If true, will use the global cache.
    * If false, will not use a cache
    * If None, will use the global cache if it's set, otherwise no cache.
    * If instance of BaseCache, will use the provided cache.

    Caching is not currently supported for streaming methods of models.
    """
    verbose: bool = Field(default_factory=_get_verbosity, exclude=True, repr=False)
    """Whether to print out response text."""
    callbacks: Callbacks = Field(default=None, exclude=True)
    """Callbacks to add to the run trace."""
    tags: Optional[list[str]] = Field(default=None, exclude=True)
    """Tags to add to the run trace."""
    metadata: Optional[dict[str, Any]] = Field(default=None, exclude=True)
    """Metadata to add to the run trace."""
    custom_get_token_ids: Optional[Callable[[str], list[int]]] = Field(
        default=None, exclude=True
    )
    """Optional encoder to use for counting tokens."""

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )
```

| 属性名                    | 类型                                     | 默认值                            | 是否参与序列化                         | 语义解释                                                                                                                                    |
| ---------------------- | -------------------------------------- | ------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `cache`                | `Union[BaseCache, bool, None]`         | `None`                         | ❌ `exclude=True`                | 指定是否启用响应缓存：<br>- `True`: 使用全局缓存<br>- `False`: 不使用缓存<br>- `BaseCache` 实例：使用自定义缓存<br>- `None`: 若已设置全局缓存则使用，否则不缓存。**注意：不支持 streaming 缓存。** |
| `verbose`              | `bool`                                 | `_get_verbosity()`             | ❌ `exclude=True`, 不在 `repr` 中显示 | 控制是否打印模型返回的文本结果，适用于调试时查看生成内容。                                                                                                           |
| `callbacks`            | `Callbacks`                            | `None`                         | ❌ `exclude=True`                | 为 LLM 调用添加回调机制（如 tracing、logging、streaming 等），贯穿调用生命周期。                                                                                 |
| `tags`                 | `Optional[list[str]]`                  | `None`                         | ❌ `exclude=True`                | 附加到 run trace 的标签，可用于运行的标记和过滤。                                                                                                          |
| `metadata`             | `Optional[dict[str, Any]]`             | `None`                         | ❌ `exclude=True`                | 附加元数据到 run trace，支持记录运行的额外上下文信息。                                                                                                        |
| `custom_get_token_ids` | `Optional[Callable[[str], list[int]]]` | `None`                         | ❌ `exclude=True`                | 自定义的 tokenizer 函数，用于统计 token 数（常用于 token 限制或费用评估）。                                                                                      |


BaseLanguageModel 的主要作用是定义接口:

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

BaseLanguageModel 继承自 RunnableSerializable，但是并没有提供 invoke 的默认实现。

所以 BaseLanguageModel 主要有三个接口方法:
1. `generate_prompt`
2. `agenerate_prompt`
3. `invoke`

BaseLanguageModel 还有一些过期的接口，这里未列出。

### 2.2 BaseChatModel

```python
class BaseChatModel(BaseLanguageModel[BaseMessage], ABC):
    """Base class for chat models.
    """  # noqa: E501

    callback_manager: Optional[BaseCallbackManager] = deprecated(
        name="callback_manager", since="0.1.7", removal="1.0", alternative="callbacks"
    )(
        Field(
            default=None,
            exclude=True,
            description="Callback manager to add to the run trace.",
        )
    )

    rate_limiter: Optional[BaseRateLimiter] = Field(default=None, exclude=True)
    "An optional rate limiter to use for limiting the number of requests."

    disable_streaming: Union[bool, Literal["tool_calling"]] = False
    """Whether to disable streaming for this model.

    If streaming is bypassed, then ``stream()``/``astream()``/``astream_events()`` will
    defer to ``invoke()``/``ainvoke()``.

    - If True, will always bypass streaming case.
    - If ``'tool_calling'``, will bypass streaming case only when the model is called
      with a ``tools`` keyword argument. In other words, LangChain will automatically
      switch to non-streaming behavior (``invoke()``) only when the tools argument is
      provided. This offers the best of both worlds.
    - If False (default), will always use streaming case if available.

    The main reason for this flag is that code might be written using ``.stream()`` and
    a user may want to swap out a given model for another model whose the implementation
    does not properly support streaming.
    """

```

| 属性名                 | 类型                                     | 默认值     | 是否序列化            | 说明                                                                                                                               |
| ------------------- | -------------------------------------- | ------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `callback_manager`  | `Optional[BaseCallbackManager]`        | `None`  | ❌ `exclude=True` | **已废弃**，请使用 `callbacks`。用于管理回调函数生命周期，如 tracing、logging、token 统计等。                                                                |
| `rate_limiter`      | `Optional[BaseRateLimiter]`            | `None`  | ❌ `exclude=True` | 请求速率限制器，可限制调用频率，避免 API 超额。                                                                                                       |
| `disable_streaming` | `Union[bool, Literal["tool_calling"]]` | `False` | ✅                | 是否关闭流式输出：<br> - `True`: 始终关闭流式，改用普通调用<br> - `"tool_calling"`：仅当调用包含 `tools` 参数时关闭流式<br> - `False`（默认）：支持流式时使用流式返回（如 `.stream()`） |


BaseChatModel 重载了 Runnable 的大多数方法，因此代码比较长。我再次问了 chatgpt，在回答里摘录了下面有关所有方法的总结图。但是这个还不足以帮我们沥青方法之间的调用关系。所以我们先来看 BaseChatModel 抽象了哪些方法。

```python
BaseChatModel
├── 🔹 核心调用方法
│   ├── invoke / ainvoke
│   ├── generate / agenerate
│   ├── batch / abatch
│   └── batch_as_completed / abatch_as_completed
│
├── 🔹 流式输出
│   ├── stream / astream
│   └── astream_events
│
├── 🔹 声明式组合
│   ├── bind_tools / with_structured_output
│   ├── with_retry / with_fallbacks
│   └── configurable_fields / configurable_alternatives
│
├── 🔹 子类需实现
│   ├── _generate / _agenerate
│   ├── _stream / _astream
│   └── _llm_type / _identifying_params
│
└── 🔹 属性与配置
    ├── rate_limiter / disable_streaming
    └── callback_manager (deprecated)
```

通过搜索 abstractmethod 和 NotImplementedError 我找到 BaseChatModel 定义的如下方法。

```python
class BaseChatModel(BaseLanguageModel[BaseMessage], ABC):
    @property
    @abstractmethod
    def _llm_type(self) -> str:
        """Return type of chat model."""

    @abstractmethod
    def _generate(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        """Top Level call."""

    def _stream(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> Iterator[ChatGenerationChunk]:
        raise NotImplementedError

    def bind_tools(
        self,
        tools: Sequence[
            Union[typing.Dict[str, Any], type, Callable, BaseTool]  # noqa: UP006
        ],
        *,
        tool_choice: Optional[Union[str]] = None,
        **kwargs: Any,
    ) -> Runnable[LanguageModelInput, BaseMessage]:
        """Bind tools to the model.

        Args:
            tools: Sequence of tools to bind to the model.
            tool_choice: The tool to use. If "any" then any tool can be used.

        Returns:
            A Runnable that returns a message.
        """
        raise NotImplementedError
```

通过搜索这些方法可以找到如下的调用关系:

```bash
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

### 2.3 BaseLLM
我们对 BaseLLM 重复上述过程:

```python
class BaseLLM(BaseLanguageModel[str], ABC):
    """Base LLM abstract interface.

    It should take in a prompt and return a string.
    """

    callback_manager: Optional[BaseCallbackManager] = Field(default=None, exclude=True)
    """[DEPRECATED]"""

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

    @abstractmethod
    def _generate(
        self,
        prompts: list[str],
        stop: Optional[list[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> LLMResult:
        """Run the LLM on the given prompts."""

    @property
    @abstractmethod
    def _llm_type(self) -> str:
        """Return type of llm."""

    def _stream(
        self,
        prompt: str,
        stop: Optional[list[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> Iterator[GenerationChunk]:

        raise NotImplementedError
```

抽象方法的调用关系:

```bash
invoke
    generate_prompt
        generate
            _generate_helper
                _generate
            dict
                _llm_type

stream:
    _stream
```

通过对比我们可以发现:
1. BaseLLM、BaseChatModel 都将 BaseLanguageModel 的接口转换到了 _generate
2. 都要求子类实现 _stream 方法
3. 但是两者方法接受的参数不同，BaseLLM 接受 `list[str]`，BaseChatModel 接受 `list[BaseMessage]`
4. 两者的返回值不同，BaseLLM 返回 `LLMResult`，BaseChatModel 返回 `ChatResult`

下面我们先来看 BaseChatModel 的代码。
## 3. BaseChatModel
### 3.1 invoke
BaseChatModel invoke 需要关注以下实现细节:
1. invoke 内调用 `self._convert_input` 将输入标准化为 `list[PromptValue]`
2. generate_prompt 内将 `list[PromptValue]` 转化为 `list[list[BaseMessage]]` 子 list 代表一个完整的 Prompt
3. generate 完成多个独立的 Prompt 调用过程

```python
LanguageModelInput = Union[PromptValue, str, Sequence[MessageLikeRepresentation]]
LanguageModelOutput = Union[BaseMessage, str]
LanguageModelLike = Runnable[LanguageModelInput, LanguageModelOutput]
LanguageModelOutputVar = TypeVar("LanguageModelOutputVar", BaseMessage, str)

class BaseChatModel(BaseLanguageModel[BaseMessage], ABC):
    @override
    def invoke(
        self,
        input: LanguageModelInput,
        config: Optional[RunnableConfig] = None,
        *,
        stop: Optional[list[str]] = None,
        **kwargs: Any,
    ) -> BaseMessage:
        config = ensure_config(config)
        return cast(
            "ChatGeneration",
            self.generate_prompt(
                # 输入标准化
                [self._convert_input(input)],
                stop=stop,
                callbacks=config.get("callbacks"),
                tags=config.get("tags"),
                metadata=config.get("metadata"),
                run_name=config.get("run_name"),
                run_id=config.pop("run_id", None),
                **kwargs,
            ).generations[0][0],
        ).message

    @override
    def generate_prompt(
        self,
        prompts: list[PromptValue],
        stop: Optional[list[str]] = None,
        callbacks: Callbacks = None,
        **kwargs: Any,
    ) -> LLMResult:
        prompt_messages = [p.to_messages() for p in prompts]
        return self.generate(prompt_messages, stop=stop, callbacks=callbacks, **kwargs)
```
### 3.2 generate
generate 的调用过程分成了如下几个部分:
1. callback_manager 的调用，这一部分详见 ![CallBack Manager](./03_callback.md)
2. 遍历 messages 参数，执行 `_generate_with_cache` 获取 ChatResult
3. 合并 ChatResult 为 LLMResult 返回
4. 代码执行的过程中有两次 message 的转换，详见: ![CallBack Manager](./31_message_convert.md)

```python
    @abstractmethod
    def _generate(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        """Top Level call."""

    def generate(
        self,
        messages: list[list[BaseMessage]],
        stop: Optional[list[str]] = None,
        callbacks: Callbacks = None,
        *,
        tags: Optional[list[str]] = None,
        metadata: Optional[dict[str, Any]] = None,
        run_name: Optional[str] = None,
        run_id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ) -> LLMResult:

        ls_structured_output_format = kwargs.pop(
            "ls_structured_output_format", None
        ) or kwargs.pop("structured_output_format", None)
        # 从 ls_structured_output_format 获取 schema
        ls_structured_output_format_dict = _format_ls_structured_output(
            ls_structured_output_format
        )
        # 获取有关模型的参数信息
        params = self._get_invocation_params(stop=stop, **kwargs)
        options = {"stop": stop, **ls_structured_output_format_dict}
        inheritable_metadata = {
            **(metadata or {}),
            # 获取 LangSmithParams
            **self._get_ls_params(stop=stop, **kwargs),
        }

        callback_manager = CallbackManager.configure(
            callbacks,
            self.callbacks,
            self.verbose,
            tags,
            self.tags,
            inheritable_metadata,
            self.metadata,
        )

        messages_to_trace = [
            # 将Message转换为 open api 支持的格式，便于在 on_chat_model_start 中使用
            _format_for_tracing(message_list) for message_list in messages
        ]
        run_managers = callback_manager.on_chat_model_start(
            self._serialized,
            messages_to_trace,
            invocation_params=params,
            options=options,
            name=run_name,
            run_id=run_id,
            batch_size=len(messages),
        )
        results = []
        input_messages = [
            # 格式化为 langchain 标准消息格式
            _normalize_messages(message_list) for message_list in messages
        ]
        for i, m in enumerate(input_messages):
            try:
                results.append(
                    self._generate_with_cache(
                        m,
                        stop=stop,
                        run_manager=run_managers[i] if run_managers else None,
                        **kwargs,
                    )
                )
            except BaseException as e:
                if run_managers:
                    generations_with_error_metadata = _generate_response_from_error(e)
                    run_managers[i].on_llm_error(
                        e,
                        response=LLMResult(
                            generations=[generations_with_error_metadata]  # type: ignore[list-item]
                        ),
                    )
                raise
        flattened_outputs = [
            LLMResult(generations=[res.generations], llm_output=res.llm_output)  # type: ignore[list-item]
            for res in results
        ]
        llm_output = self._combine_llm_outputs([res.llm_output for res in results])
        generations = [res.generations for res in results]
        output = LLMResult(generations=generations, llm_output=llm_output)  # type: ignore[arg-type]
        if run_managers:
            run_infos = []
            for manager, flattened_output in zip(run_managers, flattened_outputs):
                manager.on_llm_end(flattened_output)
                run_infos.append(RunInfo(run_id=manager.run_id))
            output.run = run_infos
        return output
```

### 3.3 _generate_with_cache
generate 的调用过程分成了如下几个部分:
1. 检索缓存，限流(rate_limiter)，这一部分详见 ![Cache And RateLimit](./32_cache_memory.md)
3. 检查是不是应该使用 stream 方法获取结果，如果是调用 `self._stream`，否则调用 `self._generate`

```python
    def _generate_with_cache(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        llm_cache = self.cache if isinstance(self.cache, BaseCache) else get_llm_cache()
        # We should check the cache unless it's explicitly set to False
        # A None cache means we should use the default global cache
        # if it's configured.
        check_cache = self.cache or self.cache is None
        if check_cache:
            if llm_cache:
                llm_string = self._get_llm_string(stop=stop, **kwargs)
                prompt = dumps(messages)
                cache_val = llm_cache.lookup(prompt, llm_string)
                if isinstance(cache_val, list):
                    return ChatResult(generations=cache_val)
            elif self.cache is None:
                pass
            else:
                msg = "Asked to cache, but no cache found at `langchain.cache`."
                raise ValueError(msg)

        # Apply the rate limiter after checking the cache, since
        # we usually don't want to rate limit cache lookups, but
        # we do want to rate limit API requests.
        if self.rate_limiter:
            self.rate_limiter.acquire(blocking=True)

        # If stream is not explicitly set, check if implicitly requested by
        # astream_events() or astream_log(). Bail out if _stream not implemented
        if self._should_stream(
            async_api=False,
            run_manager=run_manager,
            **kwargs,
        ):
            chunks: list[ChatGenerationChunk] = []
            for chunk in self._stream(messages, stop=stop, **kwargs):
                chunk.message.response_metadata = _gen_info_and_msg_metadata(chunk)
                if run_manager:
                    if chunk.message.id is None:
                        chunk.message.id = f"{_LC_ID_PREFIX}-{run_manager.run_id}"
                    run_manager.on_llm_new_token(
                        cast("str", chunk.message.content), chunk=chunk
                    )
                chunks.append(chunk)
            result = generate_from_stream(iter(chunks))
        elif inspect.signature(self._generate).parameters.get("run_manager"):
            result = self._generate(
                messages, stop=stop, run_manager=run_manager, **kwargs
            )
        else:
            result = self._generate(messages, stop=stop, **kwargs)

        # Add response metadata to each generation
        for idx, generation in enumerate(result.generations):
            if run_manager and generation.message.id is None:
                generation.message.id = f"{_LC_ID_PREFIX}-{run_manager.run_id}-{idx}"
            generation.message.response_metadata = _gen_info_and_msg_metadata(
                generation
            )
        if len(result.generations) == 1 and result.llm_output is not None:
            result.generations[0].message.response_metadata = {
                **result.llm_output,
                **result.generations[0].message.response_metadata,
            }
        if check_cache and llm_cache:
            llm_cache.update(prompt, llm_string, result.generations)
        return result
```

### 4.3 SimpleChatModel
SimpleChatModel 假设模型只返回 str，并给了一个 _generate 的默认实现。

```python
class SimpleChatModel(BaseChatModel):
    """Simplified implementation for a chat model to inherit from.

    **Note** This implementation is primarily here for backwards compatibility.
        For new implementations, please use `BaseChatModel` directly.
    """

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        output_str = self._call(messages, stop=stop, run_manager=run_manager, **kwargs)
        message = AIMessage(content=output_str)
        generation = ChatGeneration(message=message)
        return ChatResult(generations=[generation])

    @abstractmethod
    def _call(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> str:
        """Simpler interface."""
```

## 4. BaseLLM 
### 4.1 invoke
BaseLLM invoke 需要关注以下实现细节:
1. invoke 内调用 `self._convert_input` 将输入标准化为 `list[PromptValue]`
2. generate_prompt 内将 `list[PromptValue]` 转化为 `list[str]` 调用 generate
3. generate 完成多个独立的 Prompt 调用过程

```python
    @override
    def invoke(
        self,
        input: LanguageModelInput,
        config: Optional[RunnableConfig] = None,
        *,
        stop: Optional[list[str]] = None,
        **kwargs: Any,
    ) -> str:
        config = ensure_config(config)
        return (
            self.generate_prompt(
                [self._convert_input(input)],
                stop=stop,
                callbacks=config.get("callbacks"),
                tags=config.get("tags"),
                metadata=config.get("metadata"),
                run_name=config.get("run_name"),
                run_id=config.pop("run_id", None),
                **kwargs,
            )
            .generations[0][0]
            .text
        )

    @override
    def generate_prompt(
        self,
        prompts: list[PromptValue],
        stop: Optional[list[str]] = None,
        callbacks: Optional[Union[Callbacks, list[Callbacks]]] = None,
        **kwargs: Any,
    ) -> LLMResult:
        prompt_strings = [p.to_string() for p in prompts]
        return self.generate(prompt_strings, stop=stop, callbacks=callbacks, **kwargs)
```

### 4.2 generate
generate:
1. 如果 callbacks 是多个，那么检查 callbacks、tags、metadata、run_name 这些元数据参数，是否与 prompts 数量是否相等，并为每一个 prompt 构造一个 CallbackManager
2. 如果 callbacks 是一个构造一个 CallbackManager 多个副本
3. 调用 get_prompts 函数，从 cache 中检索
4. 如果没有 cache 对所有输入 promts 调用 `_generate_helper`
5. 有缓存，对未命中缓存调用 `_generate_helper`
6. 合并结果输出


```python
def generate(
        self,
        prompts: list[str],
        stop: Optional[list[str]] = None,
        callbacks: Optional[Union[Callbacks, list[Callbacks]]] = None,
        *,
        tags: Optional[Union[list[str], list[list[str]]]] = None,
        metadata: Optional[Union[dict[str, Any], list[dict[str, Any]]]] = None,
        run_name: Optional[Union[str, list[str]]] = None,
        run_id: Optional[Union[uuid.UUID, list[Optional[uuid.UUID]]]] = None,
        **kwargs: Any,
    ) -> LLMResult:
        """Pass a sequence of prompts to a model and return generations.

        This method should make use of batched calls for models that expose a batched
        API.

        Use this method when you want to:
            1. take advantage of batched calls,
            2. need more output from the model than just the top generated value,
            3. are building chains that are agnostic to the underlying language model
                type (e.g., pure text completion models vs chat models).

        Args:
            prompts: List of string prompts.
            stop: Stop words to use when generating. Model output is cut off at the
                first occurrence of any of these substrings.
            callbacks: Callbacks to pass through. Used for executing additional
                functionality, such as logging or streaming, throughout generation.
            tags: List of tags to associate with each prompt. If provided, the length
                of the list must match the length of the prompts list.
            metadata: List of metadata dictionaries to associate with each prompt. If
                provided, the length of the list must match the length of the prompts
                list.
            run_name: List of run names to associate with each prompt. If provided, the
                length of the list must match the length of the prompts list.
            run_id: List of run IDs to associate with each prompt. If provided, the
                length of the list must match the length of the prompts list.
            **kwargs: Arbitrary additional keyword arguments. These are usually passed
                to the model provider API call.

        Returns:
            An LLMResult, which contains a list of candidate Generations for each input
                prompt and additional model provider-specific output.
        """
        if not isinstance(prompts, list):
            msg = (
                "Argument 'prompts' is expected to be of type list[str], received"
                f" argument of type {type(prompts)}."
            )
            raise ValueError(msg)  # noqa: TRY004
        # Create callback managers
        if isinstance(metadata, list):
            metadata = [
                {
                    **(meta or {}),
                    **self._get_ls_params(stop=stop, **kwargs),
                }
                for meta in metadata
            ]
        elif isinstance(metadata, dict):
            metadata = {
                **(metadata or {}),
                **self._get_ls_params(stop=stop, **kwargs),
            }
        if (
            isinstance(callbacks, list)
            and callbacks
            and (
                isinstance(callbacks[0], (list, BaseCallbackManager))
                or callbacks[0] is None
            )
        ):
            # We've received a list of callbacks args to apply to each input
            if len(callbacks) != len(prompts):
                msg = "callbacks must be the same length as prompts"
                raise ValueError(msg)
            if tags is not None and not (
                isinstance(tags, list) and len(tags) == len(prompts)
            ):
                msg = "tags must be a list of the same length as prompts"
                raise ValueError(msg)
            if metadata is not None and not (
                isinstance(metadata, list) and len(metadata) == len(prompts)
            ):
                msg = "metadata must be a list of the same length as prompts"
                raise ValueError(msg)
            if run_name is not None and not (
                isinstance(run_name, list) and len(run_name) == len(prompts)
            ):
                msg = "run_name must be a list of the same length as prompts"
                raise ValueError(msg)
            callbacks = cast("list[Callbacks]", callbacks)
            tags_list = cast(
                "list[Optional[list[str]]]", tags or ([None] * len(prompts))
            )
            metadata_list = cast(
                "list[Optional[dict[str, Any]]]", metadata or ([{}] * len(prompts))
            )
            run_name_list = run_name or cast(
                "list[Optional[str]]", ([None] * len(prompts))
            )
            callback_managers = [
                CallbackManager.configure(
                    callback,
                    self.callbacks,
                    self.verbose,
                    tag,
                    self.tags,
                    meta,
                    self.metadata,
                )
                for callback, tag, meta in zip(callbacks, tags_list, metadata_list)
            ]
        else:
            # We've received a single callbacks arg to apply to all inputs
            callback_managers = [
                CallbackManager.configure(
                    cast("Callbacks", callbacks),
                    self.callbacks,
                    self.verbose,
                    cast("list[str]", tags),
                    self.tags,
                    cast("dict[str, Any]", metadata),
                    self.metadata,
                )
            ] * len(prompts)
            run_name_list = [cast("Optional[str]", run_name)] * len(prompts)
        run_ids_list = self._get_run_ids_list(run_id, prompts)
        params = self.dict()
        params["stop"] = stop
        options = {"stop": stop}
        (
            existing_prompts,
            llm_string,
            missing_prompt_idxs,
            missing_prompts,
        ) = get_prompts(params, prompts, self.cache)
        new_arg_supported = inspect.signature(self._generate).parameters.get(
            "run_manager"
        )
        if (self.cache is None and get_llm_cache() is None) or self.cache is False:
            run_managers = [
                callback_manager.on_llm_start(
                    self._serialized,
                    [prompt],
                    invocation_params=params,
                    options=options,
                    name=run_name,
                    batch_size=len(prompts),
                    run_id=run_id_,
                )[0]
                for callback_manager, prompt, run_name, run_id_ in zip(
                    callback_managers, prompts, run_name_list, run_ids_list
                )
            ]
            return self._generate_helper(
                prompts,
                stop,
                run_managers,
                new_arg_supported=bool(new_arg_supported),
                **kwargs,
            )
        if len(missing_prompts) > 0:
            run_managers = [
                callback_managers[idx].on_llm_start(
                    self._serialized,
                    [prompts[idx]],
                    invocation_params=params,
                    options=options,
                    name=run_name_list[idx],
                    batch_size=len(missing_prompts),
                )[0]
                for idx in missing_prompt_idxs
            ]
            new_results = self._generate_helper(
                missing_prompts,
                stop,
                run_managers,
                new_arg_supported=bool(new_arg_supported),
                **kwargs,
            )
            llm_output = update_cache(
                self.cache,
                existing_prompts,
                llm_string,
                missing_prompt_idxs,
                new_results,
                prompts,
            )
            run_info = (
                [RunInfo(run_id=run_manager.run_id) for run_manager in run_managers]
                if run_managers
                else None
            )
        else:
            llm_output = {}
            run_info = None
        generations = [existing_prompts[i] for i in range(len(prompts))]
        return LLMResult(generations=generations, llm_output=llm_output, run=run_info)
```

### 4.3 _generate_helper

_generate_helper 实现比较简单，唯一需要注意的是，BaseLLM 的 `_generate` 方法与 BaseChatModel 有多区别:
1. `BaseLLM._generate` 处理的是多个独立 prompt，所以 `_generate_helper` 对结果进行了展开
2. `BaseChatModel._generate` 只处理一个 prompt，这个 prompt 包含多个 message

```python
    def _generate_helper(
        self,
        prompts: list[str],
        stop: Optional[list[str]],
        run_managers: list[CallbackManagerForLLMRun],
        *,
        new_arg_supported: bool,
        **kwargs: Any,
    ) -> LLMResult:
        try:
            output = (
                self._generate(
                    prompts,
                    stop=stop,
                    # TODO: support multiple run managers
                    run_manager=run_managers[0] if run_managers else None,
                    **kwargs,
                )
                if new_arg_supported
                else self._generate(prompts, stop=stop)
            )
        except BaseException as e:
            for run_manager in run_managers:
                run_manager.on_llm_error(e, response=LLMResult(generations=[]))
            raise
        flattened_outputs = output.flatten()
        for manager, flattened_output in zip(run_managers, flattened_outputs):
            manager.on_llm_end(flattened_output)
        if run_managers:
            output.run = [
                RunInfo(run_id=run_manager.run_id) for run_manager in run_managers
            ]
        return output
```

### 4.4 LLM 
在 BaseLLM 的基础上 langchain-core 还实现了一个 LLM 类。这个类对 BaseLLM 做了一个简单的接口转换。

```python
class LLM(BaseLLM):
    def _generate(
        self,
        prompts: list[str],
        stop: Optional[list[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> LLMResult:
        """Run the LLM on the given prompt and input."""
        # TODO: add caching here.
        generations = []
        new_arg_supported = inspect.signature(self._call).parameters.get("run_manager")
        for prompt in prompts:
            text = (
                self._call(prompt, stop=stop, run_manager=run_manager, **kwargs)
                if new_arg_supported
                else self._call(prompt, stop=stop, **kwargs)
            )
            generations.append([Generation(text=text)])
        return LLMResult(generations=generations)
```

### 5. Fake Model
有关 ChatGpt 具体的 Model实现在 langchain 库内，我们会在单独的章节里详细讲解。这里我们看一下 langchain-core 给我们提供的测试用 FakeModel 类。

FakeModel 有如下几个:
1. FakeListLLM
2. FakeStreamingListLLM
3. FakeMessagesListChatModel
4. FakeListChatModel
5. FakeChatModel
6. GenericFakeChatModel
7. ParrotFakeChatModel

这些 model 都比较简单，不在一一列出代码。