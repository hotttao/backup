---
weight: 1
title: "LangChain Context 和 RunnableConfig"
date: 2025-07-21T22:00:00+08:00
lastmod: 2025-07-21T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langchain 的 context 和 RunnableConfig"
featuredImage: 

tags: ["langchain 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

上一篇我们讲到了 RunnableSequence invoke 方法。这个方法里调用的 config_with_context 方法比较难理解。所以在讲解 invoke 方法之前，我们先来了解一下 langchain 中的 Context 和 RunnableConfig。

## 1. RunnableConfig
RunnableConfig 的定义很简单:

```python
class RunnableConfig(TypedDict, total=False):
    """Configuration for a Runnable."""

    tags: list[str]
    """
    Tags for this call and any sub-calls (eg. a Chain calling an LLM).
    You can use these to filter calls.
    """

    metadata: dict[str, Any]
    """
    Metadata for this call and any sub-calls (eg. a Chain calling an LLM).
    Keys should be strings, values should be JSON-serializable.
    """

    callbacks: Callbacks
    """
    Callbacks for this call and any sub-calls (eg. a Chain calling an LLM).
    Tags are passed to all callbacks, metadata is passed to handle*Start callbacks.
    """

    run_name: str
    """
    Name for the tracer run for this call. Defaults to the name of the class.
    """

    max_concurrency: Optional[int]
    """
    Maximum number of parallel calls to make. If not provided, defaults to
    ThreadPoolExecutor's default.
    """

    recursion_limit: int
    """
    Maximum number of times a call can recurse. If not provided, defaults to 25.
    """

    configurable: dict[str, Any]
    """
    Runtime values for attributes previously made configurable on this Runnable,
    or sub-Runnables, through .configurable_fields() or .configurable_alternatives().
    Check .output_schema() for a description of the attributes that have been made
    configurable.
    """

    run_id: Optional[uuid.UUID]
    """
    Unique identifier for the tracer run for this call. If not provided, a new UUID
        will be generated.
    """
```

这里面大多数是元数据和控制参数，其中最重要的是 configurable 属性。通过注释可以看到，configurable 与 Runnable 的 configurable_fields、configurable_alternatives 方法有关。

核心逻辑主要有以下三点
1. 参数配置: 配置参数的信息
1. 参数保存: 参数是如何保存到 configurable 内的
2. 参数解析: Runnable 在运行时，如何从 configurable 解析到需要的参数


## 2. RunnableConfig 参数设置过程

```python
# 1. 参数最简单的方法是直接传递:
prompt.invoke(
    {"question": "foo", "context": "bar"},
    config={"configurable": {"hub_commit": "rlm/rag-prompt-llama"}},
)

# 2. 更通用的方式是通过 Runnable.with_config 方法
model.with_config(
    configurable={"llm": "openai"}
).invoke
```

with_config 方法，本质上是将传入的参数保存在 RunnableBinding 的实例参数中，RunnableBinding 也是一个 Runnable，在调用 invoke 方法时，将通过参数传递的 config 与保存在实例中的 config 合并后进行传递。下面是源码。 

```python
class Runnable(ABC, Generic[Input, Output]):
    name: Optional[str]
    """The name of the Runnable. Used for debugging and tracing."""

    def with_config(
        self,
        config: Optional[RunnableConfig] = None,
        # Sadly Unpack is not well-supported by mypy so this will have to be untyped
        **kwargs: Any,
    ) -> Runnable[Input, Output]:
        """Bind config to a Runnable, returning a new Runnable.

        Args:
            config: The config to bind to the Runnable.
            kwargs: Additional keyword arguments to pass to the Runnable.

        Returns:
            A new Runnable with the config bound.
        """
        return RunnableBinding(
            bound=self,
            config=cast(
                "RunnableConfig",
                {**(config or {}), **kwargs},
            ),
            kwargs={},
        )

class RunnableBinding(RunnableBindingBase[Input, Output]):
    pass

class RunnableBindingBase(RunnableSerializable[Input, Output]):
    bound: Runnable[Input, Output]
    """The underlying Runnable that this Runnable delegates to."""

    kwargs: Mapping[str, Any] = Field(default_factory=dict)
    """kwargs to pass to the underlying Runnable when running.

    For example, when the Runnable binding is invoked the underlying
    Runnable will be invoked with the same input but with these additional
    kwargs.
    """

    config: RunnableConfig = Field(default_factory=RunnableConfig)  # type: ignore[arg-type]
    """The config to bind to the underlying Runnable."""

    config_factories: list[Callable[[RunnableConfig], RunnableConfig]] = Field(
        default_factory=list
    )
    """The config factories to bind to the underlying Runnable."""

    # Union[Type[Input], BaseModel] + things like list[str]
    custom_input_type: Optional[Any] = None
    """Override the input type of the underlying Runnable with a custom type.

    The type can be a pydantic model, or a type annotation (e.g., `list[str]`).
    """
    # Union[Type[Output], BaseModel] + things like list[str]
    custom_output_type: Optional[Any] = None
    """Override the output type of the underlying Runnable with a custom type.

    The type can be a pydantic model, or a type annotation (e.g., `list[str]`).
    """

    @override
    def invoke(
        self,
        input: Input,
        config: Optional[RunnableConfig] = None,
        **kwargs: Optional[Any],
    ) -> Output:
        return self.bound.invoke(
            input,
            self._merge_configs(config),
            **{**self.kwargs, **kwargs},
        )
```

## 3. 参数配置
RunnableConfig 参数配置调用的是 Runnable 的 configurable_fields 和 configurable_alternatives 方法

```python
class RunnableSerializable(Serializable, Runnable[Input, Output]):
    """Runnable that can be serialized to JSON."""

    name: Optional[str] = None

    model_config = ConfigDict(
        # Suppress warnings from pydantic protected namespaces
        # (e.g., `model_`)
        protected_namespaces=(),
    )

    def configurable_fields(
        self, **kwargs: AnyConfigurableField
    ) -> RunnableSerializable[Input, Output]:
        """Configure particular Runnable fields at runtime.

        Args:
            **kwargs: A dictionary of ConfigurableField instances to configure.

        Returns:
            A new Runnable with the fields configured.

        .. code-block:: python

            from langchain_core.runnables import ConfigurableField
            from langchain_openai import ChatOpenAI

            model = ChatOpenAI(max_tokens=20).configurable_fields(
                max_tokens=ConfigurableField(
                    id="output_token_number",
                    name="Max tokens in the output",
                    description="The maximum number of tokens in the output",
                )
            )

            # max_tokens = 20
            print(
                "max_tokens_20: ",
                model.invoke("tell me something about chess").content
            )

            # max_tokens = 200
            print("max_tokens_200: ", model.with_config(
                configurable={"output_token_number": 200}
                ).invoke("tell me something about chess").content
            )
        """
        from langchain_core.runnables.configurable import RunnableConfigurableFields

        model_fields = type(self).model_fields
        for key in kwargs:
            if key not in model_fields:
                msg = (
                    f"Configuration key {key} not found in {self}: "
                    f"available keys are {model_fields.keys()}"
                )
                raise ValueError(msg)

        return RunnableConfigurableFields(default=self, fields=kwargs)

    def configurable_alternatives(
        self,
        which: ConfigurableField,
        *,
        default_key: str = "default",
        prefix_keys: bool = False,
        **kwargs: Union[Runnable[Input, Output], Callable[[], Runnable[Input, Output]]],
    ) -> RunnableSerializable[Input, Output]:
        """Configure alternatives for Runnables that can be set at runtime.

        Args:
            which: The ConfigurableField instance that will be used to select the
                alternative.
            default_key: The default key to use if no alternative is selected.
                Defaults to "default".
            prefix_keys: Whether to prefix the keys with the ConfigurableField id.
                Defaults to False.
            **kwargs: A dictionary of keys to Runnable instances or callables that
                return Runnable instances.

        Returns:
            A new Runnable with the alternatives configured.

        .. code-block:: python

            from langchain_anthropic import ChatAnthropic
            from langchain_core.runnables.utils import ConfigurableField
            from langchain_openai import ChatOpenAI

            model = ChatAnthropic(
                model_name="claude-3-sonnet-20240229"
            ).configurable_alternatives(
                ConfigurableField(id="llm"),
                default_key="anthropic",
                openai=ChatOpenAI()
            )

            # uses the default model ChatAnthropic
            print(model.invoke("which organization created you?").content)

            # uses ChatOpenAI
            print(
                model.with_config(
                    configurable={"llm": "openai"}
                ).invoke("which organization created you?").content
            )
        """
        from langchain_core.runnables.configurable import (
            RunnableConfigurableAlternatives,
        )

        return RunnableConfigurableAlternatives(
            which=which,
            default=self,
            alternatives=kwargs,
            default_key=default_key,
            prefix_keys=prefix_keys,
        )

```

||configurable_fields|configurable_alternatives|
|:---|:---|:---|
|入参|AnyConfigurableField|RunnableConfigurableFields|
|出参|ConfigurableField|RunnableConfigurableAlternatives
|语义|在运行时配置特定的 Runnable 字段|为 Runnable 配置可在运行时设置的替代项|


有关 RunnableConfigurableAlternatives 的使用我们看一下注释里的示例:
1. configurable_alternatives 在调用时，通过 `openai=ChatOpenAI()` 传递了可选的替代项
2. `configurable={"llm": "openai"}` 通过 llm 参数选择了 ChatOpenAI 作为替代项


```python
model = ChatAnthropic(
    model_name="claude-3-sonnet-20240229"
).configurable_alternatives(
    ConfigurableField(id="llm"),
    default_key="anthropic",
    openai=ChatOpenAI()
)

# uses the default model ChatAnthropic
print(model.invoke("which organization created you?").content)

# uses ChatOpenAI
print(
    model.with_config(
        configurable={"llm": "openai"}
    ).invoke("which organization created you?").content
)
```

## 4. 参数解析

```bash
                         RunnableSerializable
                            DynamicRunnable 
RunnableConfigurableFields                   RunnableConfigurableAlternatives
```

从上面两个类的初始化过程可以看到，configurable_fields、configurable_alternatives 方法传递过来的参数配置信息，分别保存在 RunnableConfigurableFields、RunnableConfigurableAlternatives 的实例属性中。代码逻辑都是类似的，后面以 RunnableConfigurableFields 为例讲解参数解析过程。

```python
class RunnableConfigurableFields(DynamicRunnable[Input, Output]):
    fields: dict[str, AnyConfigurableField]


class RunnableConfigurableAlternatives(DynamicRunnable[Input, Output]):
    which: ConfigurableField
    """The ConfigurableField to use to choose between alternatives."""

    alternatives: dict[
        str,
        Union[Runnable[Input, Output], Callable[[], Runnable[Input, Output]]],
    ]
    """The alternatives to choose from."""

    default_key: str = "default"
    """The enum value to use for the default option. Defaults to "default"."""

    prefix_keys: bool
    """Whether to prefix configurable fields of each alternative with a namespace
    of the form <which.id>==<alternative_key>, eg. a key named "temperature" used by
    the alternative named "gpt3" becomes "model==gpt3/temperature"."""


class DynamicRunnable(RunnableSerializable[Input, Output]):
    """Serializable Runnable that can be dynamically configured.

    A DynamicRunnable should be initiated using the `configurable_fields` or
    `configurable_alternatives` method of a Runnable.

    Parameters:
        default: The default Runnable to use.
        config: The configuration to use.
    """

    default: RunnableSerializable[Input, Output]

    config: Optional[RunnableConfig] = None

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

    @override
    def invoke(
        self, input: Input, config: Optional[RunnableConfig] = None, **kwargs: Any
    ) -> Output:
        runnable, config = self.prepare(config)
        return runnable.invoke(input, config, **kwargs)

    def prepare(
        self, config: Optional[RunnableConfig] = None
    ) -> tuple[Runnable[Input, Output], RunnableConfig]:
        """Prepare the Runnable for invocation.

        Args:
            config: The configuration to use. Defaults to None.

        Returns:
            tuple[Runnable[Input, Output], RunnableConfig]: The prepared Runnable and
            configuration.
        """
        runnable: Runnable[Input, Output] = self
        while isinstance(runnable, DynamicRunnable):
            runnable, config = runnable._prepare(merge_configs(runnable.config, config))  # noqa: SLF001
        return runnable, cast("RunnableConfig", config)

    @abstractmethod
    def _prepare(
        self, config: Optional[RunnableConfig] = None
    ) -> tuple[Runnable[Input, Output], RunnableConfig]: ...
```

RunnableConfig 参数解析隐藏在 RunnableConfigurableFields.invoke 调用过程中。invoke 的调用链如下:
1. DynamicRunnable.invoke
2. DynamicRunnable.prepare
3. RunnableConfigurableFields._prepare

```python
    def _prepare(
        self, config: Optional[RunnableConfig] = None
    ) -> tuple[Runnable[Input, Output], RunnableConfig]:
        config = ensure_config(config)
        # 解析参数配置信息
        specs_by_id = {spec.id: (key, spec) for key, spec in self.fields.items()}
        configurable_fields = {
            specs_by_id[k][0]: v
            # 从 configurable 读取参数
            for k, v in config.get("configurable", {}).items()
            if k in specs_by_id and isinstance(specs_by_id[k][1], ConfigurableField)
        }
        configurable_single_options = {
            k: v.options[(config.get("configurable", {}).get(v.id) or v.default)]
            for k, v in self.fields.items()
            if isinstance(v, ConfigurableFieldSingleOption)
        }
        configurable_multi_options = {
            k: [
                v.options[o]
                for o in config.get("configurable", {}).get(v.id, v.default)
            ]
            for k, v in self.fields.items()
            if isinstance(v, ConfigurableFieldMultiOption)
        }
        configurable = {
            **configurable_fields,
            **configurable_single_options,
            **configurable_multi_options,
        }

        if configurable:
            # 初始化 default Runnable 传入从 configurable 解析的参数
            init_params = {
                k: v
                for k, v in self.default.__dict__.items()
                if k in type(self.default).model_fields
            }
            return (
                self.default.__class__(**{**init_params, **configurable}),
                config,
            )
        return (self.default, config)
```

## 5. Context 
我们先看一个 Context 的使用示例:

```python
chain = (
    Context.setter("input")
    | {
        "context": RunnablePassthrough()
                | Context.setter("context"),
        "question": RunnablePassthrough(),
    }
    | PromptTemplate.from_template("{context} {question}")
    | FakeListLLM(responses=["hello"])
    | StrOutputParser()
    | {
        "result": RunnablePassthrough(),
        "context": Context.getter("context"),
        "input": Context.getter("input"),
    }
)

# Use the chain
output = chain.invoke("What's your name?")
print(output["result"])  # Output: "hello"
print(output["context"])  # Output: "What's your name?"
print(output["input"])  # Output: "What's your name?
```

Context 作用是提供 setter 和 getter 方法。

```python
class Context(Runnable[Input, Output]):
    @staticmethod
    def getter(key: Union[str, list[str]], /) -> ContextGet:
        """Return a context getter.

        Args:
            key: The context getter key.
        """
        return ContextGet(key=key)

    @staticmethod
    def setter(
        _key: Optional[str] = None,
        _value: Optional[SetValue] = None,
        /,
        **kwargs: SetValue,
    ) -> ContextSet:
        """Return a context setter.

        Args:
            _key: The context setter key.
            _value: The context setter value.
            **kwargs: Additional context setter key-value pairs.
        """
        return ContextSet(_key, _value, prefix="", **kwargs)
```
从类的继承关系上，可以看到 ContextSet， ContextGet 都是 Runnable 的子类。
![context](/images/langchain/context.svg)

ContextSet， ContextGet 的 invoke 需要结合 langchain_core.beta.runnables.context. config_with_context 函数。

### 5.1 config_with_context

config_with_context 的核心是在 config configurable 中添加 context key 对应的设置和获取函数。

```python
def config_with_context(
    config: RunnableConfig,
    steps: list[Runnable],
) -> RunnableConfig:
    """Patch a runnable config with context getters and setters.

    Args:
        config: The runnable config.
        steps: The runnable steps.

    Returns:
        The patched runnable config.
    """
    return _config_with_context(config, steps, _setter, _getter, threading.Event)


class ConfigurableFieldSpec(NamedTuple):
    """Field that can be configured by the user. It is a specification of a field.

    Parameters:
        id: The unique identifier of the field.
        annotation: The annotation of the field.
        name: The name of the field. Defaults to None.
        description: The description of the field. Defaults to None.
        default: The default value for the field. Defaults to None.
        is_shared: Whether the field is shared. Defaults to False.
        dependencies: The dependencies of the field. Defaults to None.
    """

    id: str
    annotation: Any

    name: Optional[str] = None
    description: Optional[str] = None
    default: Any = None
    is_shared: bool = False
    dependencies: Optional[list[str]] = None


def _config_with_context(
    config: RunnableConfig,
    steps: list[Runnable],
    setter: Callable,
    getter: Callable,
    event_cls: Union[type[threading.Event], type[asyncio.Event]],
) -> RunnableConfig:
    # config 已经包含 context 配置信息，直接返回
    if any(k.startswith(CONTEXT_CONFIG_PREFIX) for k in config.get("configurable", {})):
        return config

    context_specs = [
        (spec, i)
        for i, step in enumerate(steps)
        # spec 是 ConfigurableFieldSpec 
        for spec in step.config_specs
        if spec.id.startswith(CONTEXT_CONFIG_PREFIX)
    ]
    # 按 context id 分组
    grouped_by_key = {
        key: list(group)
        for key, group in groupby(
            sorted(context_specs, key=lambda s: s[0].id),
            # context id 的拼接规则是 f"{CONTEXT_CONFIG_PREFIX}{prefix}{k}{CONTEXT_CONFIG_SUFFIX_GET}"
            # _key_from_id 反向解析出 {prefix}{k}
            key=lambda s: _key_from_id(s[0].id),
        )
    }
    # 
    deps_by_key = {
        key: {
            _key_from_id(dep) for spec in group for dep in (spec[0].dependencies or [])
        }
        for key, group in grouped_by_key.items()
    }

    values: Values = {}
    events: defaultdict[str, Union[asyncio.Event, threading.Event]] = defaultdict(
        event_cls
    )
    context_funcs: dict[str, Callable[[], Any]] = {}
    for key, group in grouped_by_key.items():
        getters = [s for s in group if s[0].id.endswith(CONTEXT_CONFIG_SUFFIX_GET)]
        setters = [s for s in group if s[0].id.endswith(CONTEXT_CONFIG_SUFFIX_SET)]

        for dep in deps_by_key[key]:
            if key in deps_by_key[dep]:
                msg = f"Deadlock detected between context keys {key} and {dep}"
                raise ValueError(msg)
        # 保证每一个 get 都有对应的 set
        if len(setters) != 1:
            msg = f"Expected exactly one setter for context key {key}"
            raise ValueError(msg)
        setter_idx = setters[0][1]
        # 检查 setter 是否在所有 getter 之前
        if any(getter_idx < setter_idx for _, getter_idx in getters):
            msg = f"Context setter for key {key} must be defined after all getters."
            raise ValueError(msg)

        # 在 config 中添加 context key 对应的设置和获取函数
        if getters:
            context_funcs[getters[0][0].id] = partial(getter, events[key], values)
        context_funcs[setters[0][0].id] = partial(setter, events[key], values)

    return patch_config(config, configurable=context_funcs)

```

### 5.2 ContextSet

```python
@beta()
class ContextSet(RunnableSerializable):
    """Set a context value."""

    prefix: str = ""

    keys: Mapping[str, Optional[Runnable]]

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )

    def __init__(
        self,
        key: Optional[str] = None,
        value: Optional[SetValue] = None,
        prefix: str = "",
        **kwargs: SetValue,
    ):
        """Create a context setter.

        Args:
            key: The context setter key.
            value: The context setter value.
            prefix: The context setter prefix.
            **kwargs: Additional context setter key-value pairs.
        """
        if key is not None:
            kwargs[key] = value
        super().__init__(  # type: ignore[call-arg]
            keys={
                k: _coerce_set_value(v) if v is not None else None
                for k, v in kwargs.items()
            },
            prefix=prefix,
        )

    @override
    def invoke(
        self, input: Any, config: Optional[RunnableConfig] = None, **kwargs: Any
    ) -> Any:
        config = ensure_config(config)
        configurable = config.get("configurable", {})
        for id_, mapper in zip(self.ids, self.keys.values()):
            if mapper is not None:
                configurable[id_](mapper.invoke(input, config))
            else:
                configurable[id_](input)
        return input
```

ContextSet.invoke 调用的 `configurable[id_]` 正式上面 `config_with_context` 中添加的 `context_funcs[setters[0][0].id]`。所以 Context.setter("input") 的结果是，在 `_config_with_context` 的局部变量 values 内设置  {"input 这个key 对应的 event实例": input}

### 5.3 ContextGet

```python
@beta()
class ContextGet(RunnableSerializable):
    """Get a context value."""

    prefix: str = ""

    key: Union[str, list[str]]

    @override
    def invoke(
        self, input: Any, config: Optional[RunnableConfig] = None, **kwargs: Any
    ) -> Any:
        config = ensure_config(config)
        configurable = config.get("configurable", {})
        if isinstance(self.key, list):
            return {key: configurable[id_]() for key, id_ in zip(self.key, self.ids)}
        return configurable[self.ids[0]]()
```

ContextGet.invoke 则是调用对应函数，从 values 局部变量中获取值。
