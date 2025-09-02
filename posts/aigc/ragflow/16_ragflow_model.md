---
weight: 1
title: "RagFlow 模型实例化"
date: 2025-08-20T14:00:00+08:00
lastmod: 2025-08-20T14:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "RagFlow 模型实例化"
featuredImage: 

tags: ["RagFlow"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

这一节我们看前一节遗留的第一个问题，`TenantLLMService.model_instance` 如何实例化模型。

## 1. TenantLLMService
### 1.1 用户模型配置获取
model_instance:
1. 首先获取 model_config
2. 根据 llm_type 从不同模型的全局映射(eg: EmbeddingModel/RerankModel) 中获取对应模型的类
3. 实例化模型


```python
# 大模型厂商，以及他们的模型提供的能力
class LLMFactoriesService(CommonService):
    model = LLMFactories

# 租户添加了哪些厂商的哪些大模型
class TenantLLMService(CommonService):
    model = TenantLLM

    @classmethod
    @DB.connection_context()
    def get_model_config(cls, tenant_id, llm_type, llm_name=None):
        """
        根据 tenant_id（租户）、llm_type（模型类型）、llm_name（可选模型名），
        获取该租户对应模型的配置信息（包含 api_key、llm_factory 等）。
        """

        from api.db.services.llm_service import LLMService

        # 从 Tenant 表获取用户配置的模型
        
        e, tenant = TenantService.get_by_id(tenant_id)
        if not e:
            raise LookupError("Tenant not found")  # 没有这个租户，抛异常

        # llm_type 是用户要实例化的模型类型
        # 除了 speech2text，优先使用 llm_name 传入的模型

        # embedding: BAAI/bge-large-zh-v1.5@BAAI
        if llm_type == LLMType.EMBEDDING.value:
            mdlnm = tenant.embd_id if not llm_name else llm_name
        # speech2text: qwen-audio-asr@Tongyi-Qianwen
        elif llm_type == LLMType.SPEECH2TEXT.value:
            mdlnm = tenant.asr_id
        elif llm_type == LLMType.IMAGE2TEXT.value:
            mdlnm = tenant.img2txt_id if not llm_name else llm_name
        elif llm_type == LLMType.CHAT.value:
            mdlnm = tenant.llm_id if not llm_name else llm_name
        elif llm_type == LLMType.RERANK:
            mdlnm = tenant.rerank_id if not llm_name else llm_name
        elif llm_type == LLMType.TTS:
            mdlnm = tenant.tts_id if not llm_name else llm_name
        else:
            # 类型错误，直接断言失败
            assert False, "LLM type error"

        # 从 TenantLLM 查询，模型配置
        # TenantLLM主键: ("tenant_id", "llm_factory", "llm_name")
        # model_config 保存了 api_key, max_token 等信息
        model_config = cls.get_api_key(tenant_id, mdlnm)

        # 按照 @ 分割模型名和工厂名
        mdlnm, fid = TenantLLMService.split_model_name_and_factory(mdlnm)

        # 如果没查到（可能是工厂 id 不匹配），再尝试仅用 mdlnm 重新查
        if not model_config:
            model_config = cls.get_api_key(tenant_id, mdlnm)

        if model_config:
            # 转为字典，便于后续操作
            model_config = model_config.to_dict()

            # 查 LLMService 表，补充模型信息（is_tools 是否支持使用工具）
            # LLMService 主键: ("fid", "llm_name")
            llm = LLMService.query(llm_name=mdlnm) if not fid else LLMService.query(llm_name=mdlnm, fid=fid)
            if not llm and fid:  # 如果查不到（可能 fid 不一致），再试一次不带 fid
                llm = LLMService.query(llm_name=mdlnm)
            if llm:
                model_config["is_tools"] = llm[0].is_tools

        # 如果还是没查到 model_config，进入 fallback（兜底逻辑）
        if not model_config:
            # 特殊情况：embedding / rerank 类模型，可能使用第三方无密钥服务
            if llm_type in [LLMType.EMBEDDING, LLMType.RERANK]:
                llm = LLMService.query(llm_name=mdlnm) if not fid else LLMService.query(llm_name=mdlnm, fid=fid)
                # 针对 Youdao, FastEmbed, BAAI，这些工厂可能不需要 api_key
                if llm and llm[0].fid in ["Youdao", "FastEmbed", "BAAI"]:
                    model_config = {"llm_factory": llm[0].fid, "api_key": "", "llm_name": mdlnm, "api_base": ""}

            # 如果还没找到，再兜底 flag-embedding 特殊处理（映射到 Tongyi-Qianwen）
            if not model_config:
                if mdlnm == "flag-embedding":
                    # 为什么这里传入的是 llm_name？
                    model_config = {"llm_factory": "Tongyi-Qianwen", "api_key": "", "llm_name": llm_name, "api_base": ""}
                else:
                    # 如果模型名为空，说明租户没设置
                    if not mdlnm:
                        raise LookupError(f"Type of {llm_type} model is not set.")
                    # 否则说明该模型没有授权
                    raise LookupError("Model({}) not authorized".format(mdlnm))
        return model_config


    @classmethod
    @DB.connection_context()
    def model_instance(cls, tenant_id, llm_type, llm_name=None, lang="Chinese", **kwargs):
        # model_config = {"llm_factory": "Tongyi-Qianwen", "api_key": "", "llm_name": llm_name, "api_base": "", "is_tools": 1}
        model_config = TenantLLMService.get_model_config(tenant_id, llm_type, llm_name)
        kwargs.update({"provider": model_config["llm_factory"]})

        # 从模型的全局映射中，按照厂商名索引模型类
        if llm_type == LLMType.EMBEDDING.value:
            if model_config["llm_factory"] not in EmbeddingModel:
                return
            return EmbeddingModel[model_config["llm_factory"]](model_config["api_key"], model_config["llm_name"], base_url=model_config["api_base"])

        if llm_type == LLMType.RERANK:
            if model_config["llm_factory"] not in RerankModel:
                return
            return RerankModel[model_config["llm_factory"]](model_config["api_key"], model_config["llm_name"], base_url=model_config["api_base"])

        if llm_type == LLMType.IMAGE2TEXT.value:
            if model_config["llm_factory"] not in CvModel:
                return
            return CvModel[model_config["llm_factory"]](model_config["api_key"], model_config["llm_name"], lang, base_url=model_config["api_base"], **kwargs)

        if llm_type == LLMType.CHAT.value:
            if model_config["llm_factory"] not in ChatModel:
                return
            return ChatModel[model_config["llm_factory"]](model_config["api_key"], model_config["llm_name"], base_url=model_config["api_base"], **kwargs)

        if llm_type == LLMType.SPEECH2TEXT:
            if model_config["llm_factory"] not in Seq2txtModel:
                return
            return Seq2txtModel[model_config["llm_factory"]](key=model_config["api_key"], model_name=model_config["llm_name"], lang=lang, base_url=model_config["api_base"])
        if llm_type == LLMType.TTS:
            if model_config["llm_factory"] not in TTSModel:
                return
            return TTSModel[model_config["llm_factory"]](
                model_config["api_key"],
                model_config["llm_name"],
                base_url=model_config["api_base"],
            )
```

### 1.2 模型类映射
EmbeddingModel 等位于 `rag\llm\__init__.py`

```python
ChatModel = globals().get("ChatModel", {})
CvModel = globals().get("CvModel", {})
EmbeddingModel = globals().get("EmbeddingModel", {})
RerankModel = globals().get("RerankModel", {})
Seq2txtModel = globals().get("Seq2txtModel", {})
TTSModel = globals().get("TTSModel", {})


MODULE_MAPPING = {
    "chat_model": ChatModel,
    "cv_model": CvModel,
    "embedding_model": EmbeddingModel,
    "rerank_model": RerankModel,
    "sequence2txt_model": Seq2txtModel,
    "tts_model": TTSModel,
}


# 获取当前包的名称
package_name = __name__

for module_name, mapping_dict in MODULE_MAPPING.items():
    # 拼接完整的模块路径，eg: rag.llm.chat_model
    full_module_name = f"{package_name}.{module_name}"
    module = importlib.import_module(full_module_name)

    base_class = None
    lite_llm_base_class = None

    # 遍历模块中的所有成员
    for name, obj in inspect.getmembers(module):
        if inspect.isclass(obj):  # 如果成员是类
            if name == "Base":  # 找到名为 Base 的基类
                base_class = obj
            elif name == "LiteLLMBase":  # 找到名为 LiteLLMBase 的类
                lite_llm_base_class = obj
                # 确保 LiteLLMBase 有 _FACTORY_NAME 属性
                assert hasattr(obj, "_FACTORY_NAME"), "LiteLLMbase should have _FACTORY_NAME field."
                if hasattr(obj, "_FACTORY_NAME"):
                    # 如果 _FACTORY_NAME 是列表，则遍历列表，将每个名称映射到类
                    if isinstance(obj._FACTORY_NAME, list):
                        for factory_name in obj._FACTORY_NAME:
                            mapping_dict[factory_name] = obj
                    else:  # 否则直接将单个名称映射到类
                        mapping_dict[obj._FACTORY_NAME] = obj

    # 如果找到了 Base 类
    if base_class is not None:
        # 再次遍历模块中的所有成员
        for _, obj in inspect.getmembers(module):
            # 如果成员是 Base 的子类（且不是 Base 本身），并且有 _FACTORY_NAME 属性
            if inspect.isclass(obj) and issubclass(obj, base_class) and obj is not base_class and hasattr(obj, "_FACTORY_NAME"):
                # 将 _FACTORY_NAME 映射到类，支持列表或单个名称
                if isinstance(obj._FACTORY_NAME, list):
                    for factory_name in obj._FACTORY_NAME:
                        mapping_dict[factory_name] = obj
                else:
                    mapping_dict[obj._FACTORY_NAME] = obj

```

我们以 ChatModel 为例，看一下模型类映射的过程。

```python
# 对应 base_class
class Base(ABC):
    def __init__(self, key, model_name, base_url, **kwargs):
        timeout = int(os.environ.get("LM_TIMEOUT_SECONDS", 600))
        self.client = OpenAI(api_key=key, base_url=base_url, timeout=timeout)
        self.model_name = model_name
        # Configure retry parameters
        self.max_retries = kwargs.get("max_retries", int(os.environ.get("LLM_MAX_RETRIES", 5)))
        self.base_delay = kwargs.get("retry_interval", float(os.environ.get("LLM_BASE_DELAY", 2.0)))
        self.max_rounds = kwargs.get("max_rounds", 5)
        self.is_tools = False
        self.tools = []
        self.toolcall_sessions = {}

# Base 的子类，有 _FACTORY_NAME 属性
class HuggingFaceChat(Base):
    _FACTORY_NAME = "HuggingFace"

    def __init__(self, key=None, model_name="", base_url="", **kwargs):
        if not base_url:
            raise ValueError("Local llm url cannot be None")
        base_url = urljoin(base_url, "v1")
        super().__init__(key, model_name.split("___")[0], base_url, **kwargs)

# LiteLLMBase 有 _FACTORY_NAME 属性
class LiteLLMBase(ABC):
    _FACTORY_NAME = ["Tongyi-Qianwen", "Bedrock", "Moonshot", "xAI", "DeepInfra", "Groq", "Cohere", "Gemini", "DeepSeek", "NVIDIA", "TogetherAI", "Anthropic"]

    def __init__(self, key, model_name, base_url=None, **kwargs):
        self.timeout = int(os.environ.get("LM_TIMEOUT_SECONDS", 600))
        self.provider = kwargs.get("provider", "")
        self.prefix = LITELLM_PROVIDER_PREFIX.get(self.provider, "")
        self.model_name = f"{self.prefix}{model_name}"
        self.api_key = key
        self.base_url = base_url or FACTORY_DEFAULT_BASE_URL.get(self.provider, "")
        # Configure retry parameters
        self.max_retries = kwargs.get("max_retries", int(os.environ.get("LLM_MAX_RETRIES", 5)))
        self.base_delay = kwargs.get("retry_interval", float(os.environ.get("LLM_BASE_DELAY", 2.0)))
        self.max_rounds = kwargs.get("max_rounds", 5)
        self.is_tools = False
        self.tools = []
        self.toolcall_sessions = {}

        # Factory specific fields
        if self.provider == SupportedLiteLLMProvider.Bedrock:
            self.bedrock_ak = json.loads(key).get("bedrock_ak", "")
            self.bedrock_sk = json.loads(key).get("bedrock_sk", "")
            self.bedrock_region = json.loads(key).get("bedrock_region", "")
```

## 2. 不同模型的抽象接口
### 2.1 ChatMode

```python
class Base(ABC):

    def bind_tools(self, toolcall_session, tools):
        pass

    def chat_with_tools(self, system: str, history: list, gen_conf: dict = {}):
        pass

    def chat(self, system, history, gen_conf={}, **kwargs):
        pass

    def chat_streamly_with_tools(self, system: str, history: list, gen_conf: dict = {}):
        pass

    def chat_streamly(self, system, history, gen_conf: dict = {}, **kwargs):
        pass

    def total_token_count(self, resp):
        pass
```


### 2.2 CvModel

`CvModel` 指的是 **计算机视觉（Computer Vision）模型**，也就是用于处理图像或视频的模型:

* **CV = Computer Vision（计算机视觉）**
* 目标是让计算机理解和分析图像或视频内容
* 常见任务：

  * 图像分类（Image Classification）：判断图片属于哪类
  * 目标检测（Object Detection）：检测图片中有哪些物体及位置
  * 图像分割（Segmentation）：像素级别区分物体
  * 图像生成 / 图像描述（Image Captioning）：生成文字描述或新图像


```python
class Base(ABC):
    def __init__(self, **kwargs):
        # Configure retry parameters
        self.max_retries = kwargs.get("max_retries", int(os.environ.get("LLM_MAX_RETRIES", 5)))
        self.base_delay = kwargs.get("retry_interval", float(os.environ.get("LLM_BASE_DELAY", 2.0)))
        self.max_rounds = kwargs.get("max_rounds", 5)
        self.is_tools = False
        self.tools = []
        self.toolcall_sessions = {}

    def describe(self, image):
        raise NotImplementedError("Please implement encode method!")

    def describe_with_prompt(self, image, prompt=None):
        raise NotImplementedError("Please implement encode method!")

    def chat(self, system, history, gen_conf, images=[], **kwargs):
        pass

    def chat_streamly(self, system, history, gen_conf, images=[], **kwargs):
        pass

    @staticmethod
    def image2base64(image):
        pass

    def prompt(self, b64):
        pass

    def vision_llm_prompt(self, b64, prompt=None):
        pass
```

### 2.3 EmbeddingModel

```python
class Base(ABC):
    def __init__(self, key, model_name, **kwargs):
        """
        Constructor for abstract base class.
        Parameters are accepted for interface consistency but are not stored.
        Subclasses should implement their own initialization as needed.
        """
        pass

    def encode(self, texts: list):
        raise NotImplementedError("Please implement encode method!")

    def encode_queries(self, text: str):
        raise NotImplementedError("Please implement encode method!")

    def total_token_count(self, resp):
        try:
            return resp.usage.total_tokens
        except Exception:
            pass
        try:
            return resp["usage"]["total_tokens"]
        except Exception:
            pass
        return 0

class DefaultEmbedding(Base):
    _FACTORY_NAME = "BAAI"
    _model = None
    _model_name = ""
    _model_lock = threading.Lock()


    def __init__(self, key, model_name, **kwargs):
        pass
```

### 2.4 ReRankModel
`ReRankModel` 是一个 **检索结果重排序（Reranking）模型**，根据用户查询，对 **retriever 返回的一系列候选文档或片段** 进行打分或排序。用于提升 RAG 系统返回结果的相关性和准确性。

```
[User Query]
      │
      ▼
[RAG Retriever] --> [Top-k Candidate Docs]
      │
      ▼
[ReRankModel] --> [Re-ranked Docs]
      │
      ▼
[sequence2txt_model] --> [Generated Answer]
```

```python
class Base(ABC):
    def __init__(self, key, model_name, **kwargs):
        """
        Abstract base class constructor.
        Parameters are not stored; initialization is left to subclasses.
        """
        pass

    def similarity(self, query: str, texts: list):
        raise NotImplementedError("Please implement encode method!")

    def total_token_count(self, resp):
        try:
            return resp.usage.total_tokens
        except Exception:
            pass
        try:
            return resp["usage"]["total_tokens"]
        except Exception:
            pass
        return 0


class DefaultRerank(Base):
    _FACTORY_NAME = "BAAI"
    _model = None
    _model_lock = threading.Lock()

```

### 2.5 Seq2Text
`sequence2txt_model` **负责将检索到的向量或结构化信息生成自然语言文本**。

```
[User Query] 
      │
      ▼
[RAG Retriever] --> [sequence of docs/vectors]
      │
      ▼
[sequence2txt_model] --> [Generated Text]
      │
      ▼
[ChatModel / Output]
```

```python
class Base(ABC):
    def __init__(self, key, model_name, **kwargs):
        """
        Abstract base class constructor.
        Parameters are not stored; initialization is left to subclasses.
        """
        pass

    def transcription(self, audio_path, **kwargs):
        audio_file = open(audio_path, "rb")
        transcription = self.client.audio.transcriptions.create(model=self.model_name, file=audio_file)
        return transcription.text.strip(), num_tokens_from_string(transcription.text.strip())

    def audio2base64(self, audio):
        if isinstance(audio, bytes):
            return base64.b64encode(audio).decode("utf-8")
        if isinstance(audio, io.BytesIO):
            return base64.b64encode(audio.getvalue()).decode("utf-8")
        raise TypeError("The input audio file should be in binary format.")
```

### 2.6 TTSModel
`TTSModel` 指的是 **文本转语音模型（Text-to-Speech Model）**，用于把生成的文本内容转换为可播放的语音：


* **TTS = Text-to-Speech（文本转语音）**
* 功能：将自然语言文本生成语音信号
* 常见用途：

  * 智能助手朗读回答
  * 有声书、播客自动生成
  * 辅助阅读或多模态输出

```
[User Query] 
      │
      ▼
[RAG Retriever] → [sequence2txt_model / ChatModel] → [Generated Text]
                                               │
                                               ▼
                                         [TTSModel] → [Audio Output]
```

```python
class Base(ABC):
    def __init__(self, key, model_name, base_url, **kwargs):
        """
        Abstract base class constructor.
        Parameters are not stored; subclasses should handle their own initialization.
        """
        pass

    def tts(self, audio):
        pass

    def normalize_text(self, text):
        return re.sub(r"(\*\*|##\d+\$\$|#)", "", text)
```