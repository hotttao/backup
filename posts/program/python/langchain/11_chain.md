---
weight: 1
title: "LangChain chain"
date: 2025-07-23T15:00:00+08:00
lastmod: 2025-07-23T15:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langchain chain"
featuredImage: 

tags: ["langchain 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

## 1. Chain
Chain 是 langchain 早期提供的链抽象。他正在被 LCEL 取代。但是 Chain 仍然是 langchain 中非常重要的一个组件。仍被广泛使用，所以我们也需要了解。Chain 的代码位于 langchain.chains 内。

### 1.1 BaseChain

```python
class Chain(RunnableSerializable[dict[str, Any], dict[str, Any]], ABC):
    """Abstract base class for creating structured sequences of calls to components.

    Chains should be used to encode a sequence of calls to components like
    models, document retrievers, other chains, etc., and provide a simple interface
    to this sequence.

    The Chain interface makes it easy to create apps that are:
        - Stateful: add Memory to any Chain to give it state,
        - Observable: pass Callbacks to a Chain to execute additional functionality,
            like logging, outside the main sequence of component calls,
        - Composable: the Chain API is flexible enough that it is easy to combine
            Chains with other components, including other Chains.

    The main methods exposed by chains are:
        - `__call__`: Chains are callable. The `__call__` method is the primary way to
            execute a Chain. This takes inputs as a dictionary and returns a
            dictionary output.
        - `run`: A convenience method that takes inputs as args/kwargs and returns the
            output as a string or object. This method can only be used for a subset of
            chains and cannot return as rich of an output as `__call__`.
    """

    memory: Optional[BaseMemory] = None
    """Optional memory object. Defaults to None.
    Memory is a class that gets called at the start
    and at the end of every chain. At the start, memory loads variables and passes
    them along in the chain. At the end, it saves any returned variables.
    There are many different types of memory - please see memory docs
    for the full catalog."""
    callbacks: Callbacks = Field(default=None, exclude=True)
    """Optional list of callback handlers (or callback manager). Defaults to None.
    Callback handlers are called throughout the lifecycle of a call to a chain,
    starting with on_chain_start, ending with on_chain_end or on_chain_error.
    Each custom chain can optionally call additional callback methods, see Callback docs
    for full details."""
    verbose: bool = Field(default_factory=_get_verbosity)
    """Whether or not run in verbose mode. In verbose mode, some intermediate logs
    will be printed to the console. Defaults to the global `verbose` value,
    accessible via `langchain.globals.get_verbose()`."""
    tags: Optional[list[str]] = None
    """Optional list of tags associated with the chain. Defaults to None.
    These tags will be associated with each call to this chain,
    and passed as arguments to the handlers defined in `callbacks`.
    You can use these to eg identify a specific instance of a chain with its use case.
    """
    metadata: Optional[dict[str, Any]] = None
    """Optional metadata associated with the chain. Defaults to None.
    This metadata will be associated with each call to this chain,
    and passed as arguments to the handlers defined in `callbacks`.
    You can use these to eg identify a specific instance of a chain with its use case.
    """
    callback_manager: Optional[BaseCallbackManager] = Field(default=None, exclude=True)
    """[DEPRECATED] Use `callbacks` instead."""

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )
```

| 属性名                | 类型                              | 默认值                               | 说明                                                                        |
| ------------------ | ------------------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| `memory`           | `Optional[BaseMemory]`          | `None`                            | 链的记忆模块。用于在执行链时引入上下文记忆，自动在调用前加载变量、调用后保存变量。适用于多轮对话、Agent 状态持久化等。            |
| `callbacks`        | `Callbacks`                     | `None`                            | 回调函数列表或回调管理器。贯穿链的生命周期（开始、结束、异常等），用于日志记录、追踪、调试、UI 更新等。                     |
| `verbose`          | `bool`                          | `langchain.globals.get_verbose()` | 控制是否开启“详细模式”。启用后会在控制台打印中间执行信息，便于调试。                                       |
| `tags`             | `Optional[list[str]]`           | `None`                            | 用于标记每一次链的调用，便于在日志或 trace 工具中识别用途或调用源（如 `"qa_chain"`, `"retriever_flow"`）。 |
| `metadata`         | `Optional[dict[str, Any]]`      | `None`                            | 附加元数据，用于跟踪链的调用上下文，可传给 callback。适合记录模型版本、实验标记等。                            |
| `callback_manager` | `Optional[BaseCallbackManager]` | `None`（已废弃）                       | **已废弃**的回调字段，请改用 `callbacks`。在旧版中用于管理回调函数。                                |
| `model_config`     | `ConfigDict`                    | `arbitrary_types_allowed=True`    | Pydantic v2 配置，允许包含任意类型（如函数、类实例等），使链具备高度灵活性。                              |


BaseChain 定义了如下抽象方法:

```python
class Chain(RunnableSerializable[dict[str, Any], dict[str, Any]], ABC):
    @property
    @abstractmethod
    def input_keys(self) -> list[str]:
        """Keys expected to be in the chain input."""

    @property
    @abstractmethod
    def output_keys(self) -> list[str]:
        """Keys expected to be in the chain output."""

    @abstractmethod
    def _call(
        self,
        inputs: dict[str, Any],
        run_manager: Optional[CallbackManagerForChainRun] = None,
    ) -> dict[str, Any]:
        """Execute the chain."""
      pass
```

BaseChain 已经继承自 Runnable，所以我们重点来看它的 invoke 方法。chain 原本提供的 run、`__call__` 都已经 deprecated，并在内部调用 invoke。

```python
class Chain(RunnableSerializable[dict[str, Any], dict[str, Any]], ABC):

    @deprecated("0.1.0", alternative="invoke", removal="1.0")
    def __call__(
        self,
        inputs: Union[dict[str, Any], Any],
        return_only_outputs: bool = False,
        callbacks: Callbacks = None,
        *,
        tags: Optional[list[str]] = None,
        metadata: Optional[dict[str, Any]] = None,
        run_name: Optional[str] = None,
        include_run_info: bool = False,
    ) -> dict[str, Any]:
        
        config = {
            "callbacks": callbacks,
            "tags": tags,
            "metadata": metadata,
            "run_name": run_name,
        }

        return self.invoke(
            inputs,
            cast(RunnableConfig, {k: v for k, v in config.items() if v is not None}),
            return_only_outputs=return_only_outputs,
            include_run_info=include_run_info,
        )

    def invoke(
        self,
        input: dict[str, Any],
        config: Optional[RunnableConfig] = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        config = ensure_config(config)
        callbacks = config.get("callbacks")
        tags = config.get("tags")
        metadata = config.get("metadata")
        run_name = config.get("run_name") or self.get_name()
        run_id = config.get("run_id")
        include_run_info = kwargs.get("include_run_info", False)
        return_only_outputs = kwargs.get("return_only_outputs", False)

        # 标准化输入 为 dict[str, str], 如果传入的是非字典，会使用 self.input_keys 作为键
        inputs = self.prep_inputs(input)
        callback_manager = CallbackManager.configure(
            callbacks,
            self.callbacks,
            self.verbose,
            tags,
            self.tags,
            metadata,
            self.metadata,
        )
        new_arg_supported = inspect.signature(self._call).parameters.get("run_manager")

        run_manager = callback_manager.on_chain_start(
            None,
            inputs,
            run_id,
            name=run_name,
        )
        try:
            # 验证 inputs 的keys 是否都在 self.input_keys 中
            self._validate_inputs(inputs)
            # 调用 _call 返回 dict[str, Any]
            outputs = (
                self._call(inputs, run_manager=run_manager)
                if new_arg_supported
                else self._call(inputs)
            )
            # 验证 outputs 的keys 是否都在 self.output_keys 中
            final_outputs: dict[str, Any] = self.prep_outputs(
                inputs, outputs, return_only_outputs
            )
        except BaseException as e:
            run_manager.on_chain_error(e)
            raise e
        run_manager.on_chain_end(outputs)

        if include_run_info:
            final_outputs[RUN_KEY] = RunInfo(run_id=run_manager.run_id)
        return final_outputs
```

Chain 的抽象并不复杂，我们来看一些常用的具体的 Chain 实现。
1. LLMChain

## 2. LLMChain
### 2.1 基本使用

```python
from langchain.chains import LLMChain
from langchain_community.llms import OpenAI
from langchain_core.prompts import PromptTemplate
prompt_template = "Tell me a {adjective} joke"
prompt = PromptTemplate(
    input_variables=["adjective"], template=prompt_template
)
llm = LLMChain(llm=OpenAI(), prompt=prompt)
```

### 2.2 LLMChain 实现
#### 接口实现
从 _call 可以看到，核心实现位于:
1. generate: generate 方法在 BaseLLm 中也被实现，这样就保证 LLMChain 也可以作为一个 LLM 来使用。
2. create_outputs: 解析 generate 返回的 LLMResult 为 dict

```python
class LLMChain(Chain):
    prompt: BasePromptTemplate
    """Prompt object to use."""
    llm: Union[
        Runnable[LanguageModelInput, str], Runnable[LanguageModelInput, BaseMessage]
    ]
    """Language model to call."""
    output_key: str = "text"  #: :meta private:
    output_parser: BaseLLMOutputParser = Field(default_factory=StrOutputParser)
    """Output parser to use.
    Defaults to one that takes the most likely string but does not change it 
    otherwise."""
    return_final_only: bool = True
    """Whether to return only the final parsed result. Defaults to True.
    If false, will return a bunch of extra information about the generation."""
    llm_kwargs: dict = Field(default_factory=dict)

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        extra="forbid",
    )

    @property
    def input_keys(self) -> list[str]:
        """Will be whatever keys the prompt expects.

        :meta private:
        """
        return self.prompt.input_variables

    @property
    def output_keys(self) -> list[str]:
        """Will always return text key.

        :meta private:
        """
        if self.return_final_only:
            return [self.output_key]
        else:
            return [self.output_key, "full_generation"]
    
    def _call(
        self,
        inputs: dict[str, Any],
        run_manager: Optional[CallbackManagerForChainRun] = None,
    ) -> dict[str, str]:
        response = self.generate([inputs], run_manager=run_manager)
        return self.create_outputs(response)[0]
```

#### generate
```python
    def generate(
        self,
        input_list: list[dict[str, Any]],
        run_manager: Optional[CallbackManagerForChainRun] = None,
    ) -> LLMResult:
        """Generate LLM result from inputs."""
        # 生成 prompts
        prompts, stop = self.prep_prompts(input_list, run_manager=run_manager)
        callbacks = run_manager.get_child() if run_manager else None
        # 调用 llm
        if isinstance(self.llm, BaseLanguageModel):
            return self.llm.generate_prompt(
                prompts,
                stop,
                callbacks=callbacks,
                **self.llm_kwargs,
            )
        else:
            # 如果 llm 是嵌套的 Runnable 对象调用 batch 方法
            results = self.llm.bind(stop=stop, **self.llm_kwargs).batch(
                cast(list, prompts), {"callbacks": callbacks}
            )
            generations: list[list[Generation]] = []
            for res in results:
                if isinstance(res, BaseMessage):
                    generations.append([ChatGeneration(message=res)])
                else:
                    generations.append([Generation(text=res)])
            # 收集返回结果
            return LLMResult(generations=generations)
```

### 对应的 LCEL 实现
看完了 LLMChain ，我们对比看一下 LCEL 的实现:

```python
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_openai import OpenAI

prompt_template = "Tell me a {adjective} joke"
prompt = PromptTemplate(
    input_variables=["adjective"], template=prompt_template
)
llm = OpenAI()
chain = prompt | llm | StrOutputParser()

chain.invoke("your adjective here")
```

此时 chain 是 RunnableSequence，RunnableSequence 的 invoke 方法会调用每一个 Runnable 的 invoke 方法，并且将上一个 Runnable 的输出作为下一个 Runnable 的输入。
1. prompt.invoke:
    - 调用连上会调用一个 _validate_input 方法，在 input_variables 长度为一是，把 input 包装为 `{"adjective": input}`
    - invoke 的调用链是 invoke -> format_prompt -> format 最终返回一个 StringPromptValue
2. OpenAI.invoke:
    - 参照 LanguageModel 的继承关系，llm.invoke 方法继承自 BaseLLM，最终调用的是 OpenAI._generate 方法
    - BaseLLM.invoke 方法接收 StringPromptValue 返回 str
3. StrOutputParser.invoke 接收 str 直接返回接收的 str