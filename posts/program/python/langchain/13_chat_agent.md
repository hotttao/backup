---
weight: 1
title: "LangChain Chat Agent"
date: 2025-07-23T18:00:00+08:00
lastmod: 2025-07-23T18:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "langchain chat agent"
featuredImage: 

tags: ["langchain 源码"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

上一节我们介绍了 langchain agent 的核心抽象，这一节我们来学习 langchain 内置 agent 之一的 chat agent。

## 1. chat agent 使用示例
下面是一个使用 ChatAgent 的使用示例，国内环境比较难使用 OpenApi 这里使用的阿里通义，需要现申请一个 通义千问的 ApiKey ，并将其添加到 .env 文件中。

```python
from dotenv import load_dotenv, find_dotenv

# load tongyi 或者 openapi 的 SECRET_KEY
_ = load_dotenv(find_dotenv())  # read local .env file

import warnings

warnings.filterwarnings("ignore")

# AgentType 保存了所有内置 agent 名称
from langchain.agents import AgentType
from langchain.agents import load_tools, initialize_agent
# 导入需要使用的大语言模型
from langchain_community.chat_models import ChatTongyi, ChatOpenAI

# 初始化 tongyi
llm = ChatTongyi(temperature=0)
# load 内置 tool
tools = load_tools(["llm-math", "wikipedia"], llm=llm)

# 初始化 agent
agent = initialize_agent(
    tools,
    llm,
    agent=AgentType.CHAT_ZERO_SHOT_REACT_DESCRIPTION,
    handle_parsing_errors=True,
    verbose=True,
)
agent.invoke("What is the 25% of 300?")
```

我们讲解下面这些函数源码:
1. ChatTongyi
2. load_tools
3. initialize_agent
4. agent.invoke 调用链

## 1. ChatTongyi
通义大模型的封装
1. 继承自 BaseChatModel，invoke 方法最终将调用 _generate
2. 根据模型版本不同，使用不同的客户端:
  - v1: dashscope.MultiModalConversation
  - 新版: dashscope.Generation


### 1.1 ChatTongyi 初始化
```python
class ChatTongyi(BaseChatModel):
    client: Any = None  #: :meta private:
    model_name: str = Field(default="qwen-turbo", alias="model")
    """Model name to use.
    callable multimodal model:
    - qwen-vl-v1
    - qwen-vl-chat-v1
    - qwen-audio-turbo
    - qwen-vl-plus
    - qwen-vl-max
    """
    model_kwargs: Dict[str, Any] = Field(default_factory=dict)

    top_p: float = 0.8
    """Total probability mass of tokens to consider at each step."""

    dashscope_api_key: Optional[SecretStr] = Field(None, alias="api_key")
    """Dashscope api key provide by Alibaba Cloud."""

    streaming: bool = False
    """Whether to stream the results or not."""

    max_retries: int = 10
    """Maximum number of retries to make when generating."""

    model_config = ConfigDict(
        populate_by_name=True,
    )

    @pre_init
    def validate_environment(cls, values: Dict) -> Dict:
        """Validate that api key and python package exists in environment."""
        values["dashscope_api_key"] = convert_to_secret_str(
            get_from_dict_or_env(values, "dashscope_api_key", "DASHSCOPE_API_KEY")
        )
        try:
            import dashscope
        except ImportError:
            raise ImportError(
                "Could not import dashscope python package. "
                "Please install it with `pip install dashscope --upgrade`."
            )
        dashscope_multimodal_models = [
            "qwen-audio-turbo",
            "qwen-audio-turbo-latest",
            "qwen-vl-plus",
            "qwen-vl-plus-latest",
            "qwen-vl-max",
            "qwen-vl-max-latest",
        ]
        if (
            values["model_name"] in dashscope_multimodal_models
            or "vl" in values["model_name"]
        ):
            try:
                values["client"] = dashscope.MultiModalConversation
            except AttributeError:
                raise ValueError(
                    "`dashscope` has no `MultiModalConversation` attribute, this is "
                    "likely due to an old version of the dashscope package. Try "
                    "upgrading it with `pip install --upgrade dashscope`."
                )
        else:
            try:
                values["client"] = dashscope.Generation
            except AttributeError:
                raise ValueError(
                    "`dashscope` has no `Generation` attribute, this is likely "
                    "due to an old version of the dashscope package. Try upgrading it "
                    "with `pip install --upgrade dashscope`."
                )
        return values
```

## 2. load_tools
load_tools 用于通过名称加载内置 tools，这些 tool 与名称的映射关系都保存在 langchain_community.agent_toolkits.load_tools.py

代码比较简单，通过名称获取对应 tools 的初始化函数，实例化对应的 tools。我们来具体看一下实例代码使用到的 llm-math wikipedia 两个 tools

```python
def load_tools(
    tool_names: List[str],
    llm: Optional[BaseLanguageModel] = None,
    callbacks: Callbacks = None,
    allow_dangerous_tools: bool = False,
    **kwargs: Any,
) -> List[BaseTool]:

    tools = []
    callbacks = _handle_callbacks(
        callback_manager=kwargs.get("callback_manager"), callbacks=callbacks
    )
    for name in tool_names:
        if name in DANGEROUS_TOOLS and not allow_dangerous_tools:
            raise_dangerous_tools_exception(name)

        if name in {"requests"}:
            warnings.warn(
                "tool name `requests` is deprecated - "
                "please use `requests_all` or specify the requests method"
            )
        if name == "requests_all":
            # expand requests into various methods
            if not allow_dangerous_tools:
                raise_dangerous_tools_exception(name)
            requests_method_tools = [
                _tool for _tool in DANGEROUS_TOOLS if _tool.startswith("requests_")
            ]
            tool_names.extend(requests_method_tools)
        elif name in _BASE_TOOLS:
            tools.append(_BASE_TOOLS[name]())
        elif name in DANGEROUS_TOOLS:
            tools.append(DANGEROUS_TOOLS[name]())
        elif name in _LLM_TOOLS:
            if llm is None:
                raise ValueError(f"Tool {name} requires an LLM to be provided")
            tool = _LLM_TOOLS[name](llm)
            tools.append(tool)
        elif name in _EXTRA_LLM_TOOLS:
            if llm is None:
                raise ValueError(f"Tool {name} requires an LLM to be provided")
            _get_llm_tool_func, extra_keys = _EXTRA_LLM_TOOLS[name]
            missing_keys = set(extra_keys).difference(kwargs)
            if missing_keys:
                raise ValueError(
                    f"Tool {name} requires some parameters that were not "
                    f"provided: {missing_keys}"
                )
            sub_kwargs = {k: kwargs[k] for k in extra_keys}
            tool = _get_llm_tool_func(llm=llm, **sub_kwargs)
            tools.append(tool)
        elif name in _EXTRA_OPTIONAL_TOOLS:
            _get_tool_func, extra_keys = _EXTRA_OPTIONAL_TOOLS[name]
            sub_kwargs = {k: kwargs[k] for k in extra_keys if k in kwargs}
            tool = _get_tool_func(**sub_kwargs)
            tools.append(tool)
        else:
            raise ValueError(f"Got unknown tool {name}")
    if callbacks is not None:
        for tool in tools:
            tool.callbacks = callbacks
    return tools
```

### 2.1 llm-math
llm-math 的实现位于 langchain.chains.llm_math

```bash
langchain.chains.llm_math
    __init__
    base       # LLMMathChain 实现
    prompt     # llm_math 用到的 prompt 模板
```

llm-math 使用 Tool 类直接初始化的，接收单参数的函数，函数的实现是 LLMMathChain.from_llm(llm=llm).run。

```python
def _get_llm_math(llm: BaseLanguageModel) -> BaseTool:
    try:
        from langchain.chains.llm_math.base import LLMMathChain
    except ImportError:
        raise ImportError(
            "LLM Math tools require the library `langchain` to be installed."
            " Please install it with `pip install langchain`."
        )
    return Tool(
        name="Calculator",
        description="Useful for when you need to answer questions about math.",
        func=LLMMathChain.from_llm(llm=llm).run,
        coroutine=LLMMathChain.from_llm(llm=llm).arun,
    )

```

LLMMathChain 继承自 Chain 他需要实现 _call 方法，而且 run 方法最终调用也是 _call 方法

```python
class LLMMathChain(Chain):
    llm_chain: LLMChain
    llm: Optional[BaseLanguageModel] = None
    """[Deprecated] LLM wrapper to use."""
    prompt: BasePromptTemplate = PROMPT
    """[Deprecated] Prompt to use to translate to python if necessary."""
    input_key: str = "question"  #: :meta private:
    output_key: str = "answer"  #: :meta private:

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        extra="forbid",
    )

    @classmethod
    def from_llm(
        cls,
        llm: BaseLanguageModel,
        prompt: BasePromptTemplate = PROMPT,
        **kwargs: Any,
    ) -> LLMMathChain:
        llm_chain = LLMChain(llm=llm, prompt=prompt)
        return cls(llm_chain=llm_chain, **kwargs)
```

LLMMathChain 初始化时接收一个 prompt，是一个用于数学计算 prompt。这个 prompt 配合 `stop=["```output"]`。可以通过大模型获取数据计算表达式。

self._process_llm_result 会解析获取到的计算表达式，计算结果返回。

```python
    def _call(
        self,
        inputs: dict[str, str],
        run_manager: Optional[CallbackManagerForChainRun] = None,
    ) -> dict[str, str]:
        _run_manager = run_manager or CallbackManagerForChainRun.get_noop_manager()
        _run_manager.on_text(inputs[self.input_key])
        llm_output = self.llm_chain.predict(
            question=inputs[self.input_key],
            stop=["```output"],
            callbacks=_run_manager.get_child(),
        )
        return self._process_llm_result(llm_output, _run_manager)
```

调用链如下:

```bash
run
    __call__
        invoke
            prep_inputs
            _call
            prep_outputs
```


## 3. initialize_agent

initialize_agent 是一个工厂函数，用于初始化一个 AgentExecutor。代表比较简单，通过传入的 agent 名称找到对应的 Agent 类，调用 from_llm_and_tools 创建一个实例，最后返回 AgentExecutor。

```python
def initialize_agent(
    tools: Sequence[BaseTool],
    llm: BaseLanguageModel,
    agent: Optional[AgentType] = None,
    callback_manager: Optional[BaseCallbackManager] = None,
    agent_path: Optional[str] = None,
    agent_kwargs: Optional[dict] = None,
    *,
    tags: Optional[Sequence[str]] = None,
    **kwargs: Any,
) -> AgentExecutor:
    # 省略
    agent_obj = agent_cls.from_llm_and_tools(
            llm, tools, callback_manager=callback_manager, **agent_kwargs
    )
    return AgentExecutor.from_agent_and_tools(
        agent=agent_obj,
        tools=tools,
        callback_manager=callback_manager,
        tags=tags_,
        **kwargs,
    )
```

### 3.1 ChatAgent
示例中我们传入的是 AgentType.CHAT_ZERO_SHOT_REACT_DESCRIPTION，对应 ChatAgent。其位于

```bash
langchain\agents\chat
    __init__
    base           # ChatAgent 实现
    output_parser  # ChatAgent 输出解析器
    prompt         # ChatAgent 用到的 prompt 模板
```

#### ChatAgent 定义
ChatAgent 继承自 Agent，我们先看看其如何实现 Agent 接口。最重要的是
1. _get_default_output_parser: 返回 ChatOutputParser
2. create_prompt: 为传入的 tools 创建 prompt 提示模型使用这些 tool

```python
class ChatAgent(Agent):
    output_parser: AgentOutputParser = Field(default_factory=ChatOutputParser)
    """Output parser for the agent."""

    @property
    def observation_prefix(self) -> str:
        """Prefix to append the observation with."""
        return "Observation: "

    @property
    def llm_prefix(self) -> str:
        """Prefix to append the llm call with."""
        return "Thought:"

    @classmethod
    def _get_default_output_parser(cls, **kwargs: Any) -> AgentOutputParser:
        return ChatOutputParser()
    
    @classmethod
    def create_prompt(
        cls,
        tools: Sequence[BaseTool],
        system_message_prefix: str = SYSTEM_MESSAGE_PREFIX,
        system_message_suffix: str = SYSTEM_MESSAGE_SUFFIX,
        human_message: str = HUMAN_MESSAGE,
        format_instructions: str = FORMAT_INSTRUCTIONS,
        input_variables: Optional[list[str]] = None,
    ) -> BasePromptTemplate:
        """Create a prompt from a list of tools.

        Args:
            tools: A list of tools.
            system_message_prefix: The system message prefix.
                Default is SYSTEM_MESSAGE_PREFIX.
            system_message_suffix: The system message suffix.
                Default is SYSTEM_MESSAGE_SUFFIX.
            human_message: The human message. Default is HUMAN_MESSAGE.
            format_instructions: The format instructions.
                Default is FORMAT_INSTRUCTIONS.
            input_variables: The input variables. Default is None.

        Returns:
            A prompt template.
        """

        tool_strings = "\n".join([f"{tool.name}: {tool.description}" for tool in tools])
        tool_names = ", ".join([tool.name for tool in tools])
        format_instructions = format_instructions.format(tool_names=tool_names)
        template = "\n\n".join(
            [
                system_message_prefix,
                tool_strings,
                format_instructions,
                system_message_suffix,
            ]
        )
        messages = [
            SystemMessagePromptTemplate.from_template(template),
            HumanMessagePromptTemplate.from_template(human_message),
        ]
        if input_variables is None:
            input_variables = ["input", "agent_scratchpad"]
        return ChatPromptTemplate(input_variables=input_variables, messages=messages)
```

#### create_template
create_template 会生成两个 template，HumanMessage 比较简单，SystemMessage 比较复杂。下面是生成的 SystemMessage promptemplate

``````python
Answer the following questions as best you can. You have access to the following tools:
# 下面是 tool 的 name:desc
Calculator: Useful for when you need to answer questions about math.
wikipedia: A wrapper around Wikipedia. Useful for when you need to answer general questions about people, places, companies, facts, historical events, or other subjects. Input should be a search query.
# 下面是: function instructions
The way you use the tools is by specifying a json blob.
Specifically, this json should have a `action` key (with the name of the tool to use) and a `action_input` key (with the input to the tool going here).

The only values that should be in the "action" field are: Calculator, wikipedia

The $JSON_BLOB should only contain a SINGLE action, do NOT return a list of multiple actions. Here is an example of a valid $JSON_BLOB:

```
{{
  "action": $TOOL_NAME,
  "action_input": $INPUT
}}
```

ALWAYS use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action:
```
$JSON_BLOB
```
Observation: the result of the action
... (this Thought/Action/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Begin! Reminder to always use the exact characters `Final Answer` when responding.
``````

HumanMessagePromptTemplate 如下:

```python
"{input}\n\n{agent_scratchpad}"
```

#### ChatAgent 初始化
ChatAgent 初始化使用的 Agent.from_llm_and_tools 方法，这个方法正式依赖上面定义的 create_prompt、_get_default_output_parser

```python
class Agent(BaseSingleActionAgent):
    @classmethod
    def from_llm_and_tools(
        cls,
        llm: BaseLanguageModel,
        tools: Sequence[BaseTool],
        callback_manager: Optional[BaseCallbackManager] = None,
        output_parser: Optional[AgentOutputParser] = None,
        **kwargs: Any,
    ) -> Agent:
        """Construct an agent from an LLM and tools.

        Args:
            llm: Language model to use.
            tools: Tools to use.
            callback_manager: Callback manager to use.
            output_parser: Output parser to use.
            kwargs: Additional arguments.

        Returns:
            Agent: Agent object.
        """
        # 检查 tool 是否都是单参数输入
        cls._validate_tools(tools)
        llm_chain = LLMChain(
            llm=llm,
            # 调用抽象方法 create_prompt
            prompt=cls.create_prompt(tools),
            callback_manager=callback_manager,
        )
        tool_names = [tool.name for tool in tools]
        # 调用抽象方法 _get_default_output_parser
        _output_parser = output_parser or cls._get_default_output_parser()
        return cls(
            llm_chain=llm_chain,
            allowed_tools=tool_names,
            output_parser=_output_parser,
            **kwargs,
        )
```

#### ChatOutputParser
ChatOutputParser 继承关系如下，BaseOutputParser 要求实现 parse 方法。

```bash
BaseOutputParser
    AgentOutputParser    # 空壳
        ChatOutputParser
```

```python
class ChatOutputParser(AgentOutputParser):
    """Output parser for the chat agent."""

    format_instructions: str = FORMAT_INSTRUCTIONS
    """Default formatting instructions"""
    # 从一个 Markdown 字符串中提取出被三个反引号包裹的代码块内容
    pattern: Pattern = re.compile(r"^.*?`{3}(?:json)?\n(.*?)`{3}.*?$", re.DOTALL)
    """Regex pattern to parse the output."""


    def parse(self, text: str) -> Union[AgentAction, AgentFinish]:
        """Parse the output from the agent into
        an AgentAction or AgentFinish object.

        Args:
            text: The text to parse.

        Returns:
            An AgentAction or AgentFinish object.

        Raises:
            OutputParserException: If the output could not be parsed.
            ValueError: If the action could not be found.
        """
        # 检查是否包含 Final Answer 这是是跟之前的提示词对应的
        includes_answer = FINAL_ANSWER_ACTION in text
        try:
            found = self.pattern.search(text)
            if not found:
                # Fast fail to parse Final Answer.
                raise ValueError("action not found")
            action = found.group(1)
            response = json.loads(action.strip())
            includes_action = "action" in response
            if includes_answer and includes_action:
                raise OutputParserException(
                    "Parsing LLM output produced a final answer "
                    f"and a parse-able action: {text}"
                )
            return AgentAction(
                response["action"], response.get("action_input", {}), text
            )

        except Exception as exc:
            if not includes_answer:
                raise OutputParserException(
                    f"Could not parse LLM output: {text}"
                ) from exc
            output = text.split(FINAL_ANSWER_ACTION)[-1].strip()
            return AgentFinish({"output": output}, text)
```


我们来看 ChatOutputParser 的实现:
1. format_instructions: 没具体用，应该是提示 parse 是为了解析什么提问的回复。
1. pattern: 从大模型的回答中提取回答内容。这个默认的正则表达式对应提取如下内容

``````bash
```
{
  "action": "Calculator",
  "action_input": "300 * 0.25"
}
```
``````

## 4. agent.invoke 调用链
initialize_agent 返回的是 AgentExecutor，前面我们已经解析过 AgentExecutor.invoke 的调用链如下:

```bash
invoke
    _call
        _take_next_step
            action_agent.plan
            _perform_agent_action
                tool.run
```

### 4.1 对象

现在我们把 AgentExecutor 包含的所有对象展开，解析调用过程。我们先看一下 AgentExecutor 中的对象包含关系:

```bash
AgentExecutor(Chain)
    ChatAgent(Agent)
        LLMChain
            ChatTongyi
            ChatPromptTemplate
        ChatOutputParser
    List[Tool]
```

### 4.2 调用链

完整调用链如下:

```bash
Chain.invoke
    Chain.prep_inputs  # input -> {"input": input}
    AgentExecutor._call # output -> dict
        # intermediate_steps: list[tuple[AgentAction, str]] = []
        # next_step_output = _take_next_step()
            _take_next_step
                _consume_next_step   # return Union[AgentFinish, list[tuple[AgentAction, str]]]
                    _iter_next_step  # yield Union[AgentAction, AgentFinish]
                        Agent.plan   # output = Union[AgentAction, AgentFinish]
                            # input = {"agent_scratchpad": thoughts, "stop": self._stop, "input": input}
                            Agent.get_full_inputs 
                                ChatAgent._construct_scratchpad(intermediate_steps)
                                ChatAgent._stop
                            LLMChain.predict     # return output[LLMChain.output_key] -> str
                                Chain.__call__
                                    Chain.invoke # output = {}
                            ChatOutputParser.parse # input=str output=Union[AgentAction, AgentFinish]
                        _perform_agent_action  # input=AgentAction
                            tool.run           # input=AgentAction.tool_input
                                LLMMathChain.run

        # intermediate_steps.extend(next_step_output)
            AgentExecutor._return # output:dict = AgentFinish.return_values
    Chain.prep_outputs # outpu -> dict

Chain.prep_inputs: # 获取 input_keys 对参数，将输入从 str 转换为 dict
    AgentExecutor.input_keys
        Agent.input_keys
            LLMChain.input_keys - "agent_scratchpad"
                # create_template 中初始化
                ChatPromptTemplate.input_variables  # ["input", "agent_scratchpad"]

Chain.invoke               # 
    LLMChain._call         # return output[0] -> {"text": "", "full_generation": ""}
        LLMChain.generate  # input -> [input], output=LLMResult
            prompts, stop = prep_prompts
                LLMChain.prep_prompts
                    ChatPromptTemplate.format_prompt
                        # prompt = ChatPromptValue(messages=messages)
                        ChatPromptTemplate.format_messages 
            ChatTongyi.generate_prompt # 输入 prompts, stop，返回 LLMResult
        LLMChain.create_outputs # input=LLMResult，output={"text": "", "full_generation": ""}
            BaseOutputParser.parse_result
                StrOutputParser.parse(result[0].text)
            LLMChain.output_key # =text
    prep_outputs # input={"text": "", "full_generation": ""} 
```

### 4.3 prompt 合并
调用链中 prompt 的生成逻辑如下:
1. AgentExecutor._call 会使用一个 intermediate_steps 收集已经执行的 AgentStep，AgentStep 包含他执行的 action 和结果
2. intermediate_steps 最终会传递给 Agent.plan
3. Agent.plan 会调用 Agent.get_full_inputs 合并已经发生的 AgentAction，合并函数是 ChatAgent._construct_scratchpad，合并的 AgentAction，保存在 input 的 agent_scratchpad key 中。最终input={"agent_scratchpad": "", "input": ""}
5. Agent.LLMChain 保存的 ChatPromptTemplate 会使用 agent_scratchpad 生成 prompt 传递给大模型。
6. 大模型选择使用 Tool 之后，会调用 Tool.run 方法，返回 AgentStep
7. 回到第一步，直至 Agent.plan 判断是否是 AgentFinish，是则返回，不是则继续。


完整的对话过程如下:

```bash
--- Agent -----
`input` {'input': 'What is the 25% of 300?', 'agent_scratchpad': '', 'stop': ['Observation:']}
`output` Thought: I need to calculate 25% of 300. I can use the Calculator tool for this.
Action:
```
{
  "action": "Calculator",
  "action_input": "300 * 0.25"
}
```

--- Agent end-----
++++++++ llm-math +++++++
`llm_input` {'question': '300 * 0.25'}
`llm_output` ```text
300 * 0.25
```
...numexpr.evaluate("300 * 0.25")...

`process_llm_result` {'answer': 'Answer: 75.0'}
++++++++ llm-math +++++++
--- Agent -----
`input` {'input': 'What is the 25% of 300?', 'agent_scratchpad': 'This was your previous work (but I haven\'t seen any of it! I only see what you return as final answer):\nThought: I need to calculate 25% of 300. I can use the Calculator tool for this.\nAction:\n```\n{\n  "action": "Calculator",\n  "action_input": "300 * 0.25"\n}\n```\n\nObservation: Answer: 75.0\nThought:', 'stop': ['Observation:']}
`output` The calculation shows that 25% of 300 is 75. 

Final Answer: 75
--- Agent end-----
{'input': 'What is the 25% of 300?', 'output': '75'}
```
