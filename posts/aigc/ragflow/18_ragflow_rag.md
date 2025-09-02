---
weight: 1
title: "RagFlow 增强 Rag"
date: 2025-08-20T16:00:00+08:00
lastmod: 2025-08-20T16:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "RagFlow 增强 Rag"
featuredImage: 

tags: ["RagFlow"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

内容很多，我们先回顾一下，在介绍 do_handle_task 的处理流程时，我们总结了五个问题:
1. `TenantLLMService.model_instance` 如何实例化模型
2. 如何根据文档的类型选择不同的 chunker
3. **关键词生成**、**问题生成**、**文档内容打标签** 的执行流程
4. 如何 embedding
5. 文件如何上传，如何下载。更一步是解析后的 chunk 如何在 MinIO 和 ES 中存储

前两节我们介绍了1、2，这一节我们来介绍与 Rag 增强相关的 **关键词生成**、**问题生成**、**文档内容打标签**。

## 1. prompts 模块
ragflow 使用大模型增强 RAG 的实现，定义在 prompts 模块。

```bash
s -lX rag/prompts/
总用量 116
-rw-r--r-- 1 tao tao   357  8月 21 12:39 analyze_task_system.md
-rw-r--r-- 1 tao tao   750  8月 21 12:39 analyze_task_user.md
-rw-r--r-- 1 tao tao   575  8月 21 12:39 ask_summary.md
-rw-r--r-- 1 tao tao   384  8月 21 12:39 citation_plus.md
-rw-r--r-- 1 tao tao  5436  8月 21 12:39 citation_prompt.md
-rw-r--r-- 1 tao tao   873  8月 21 12:39 content_tagging_prompt.md
-rw-r--r-- 1 tao tao   751  8月 21 12:39 cross_languages_sys_prompt.md
-rw-r--r-- 1 tao tao    70  8月 21 12:39 cross_languages_user_prompt.md
-rw-r--r-- 1 tao tao  1373  8月 21 12:39 full_question_prompt.md
-rw-r--r-- 1 tao tao   410  8月 21 12:39 keyword_prompt.md
-rw-r--r-- 1 tao tao  2225  8月 21 12:39 meta_filter.md
-rw-r--r-- 1 tao tao  2414  8月 21 12:39 next_step.md
-rw-r--r-- 1 tao tao   523  8月 21 12:39 question_prompt.md
-rw-r--r-- 1 tao tao   857  8月 21 12:39 rank_memory.md
-rw-r--r-- 1 tao tao  1191  8月 21 12:39 reflect.md
-rw-r--r-- 1 tao tao  2235  8月 21 12:39 related_question.md
-rw-r--r-- 1 tao tao  1247  8月 21 12:39 summary4memory.md
-rw-r--r-- 1 tao tao   964  8月 21 12:39 tool_call_summary.md
-rw-r--r-- 1 tao tao  1215  8月 21 12:39 vision_llm_describe_prompt.md
-rw-r--r-- 1 tao tao  1552  8月 21 12:39 vision_llm_figure_describe_prompt.md
-rw-r--r-- 1 tao tao   173  8月 21 12:39 __init__.py
-rw-r--r-- 1 tao tao 16658  8月 21 12:39 prompts.py
-rw-r--r-- 1 tao tao   504  8月 21 12:39 prompt_template.py
```

可以看到 prompts 下面除了 prompts.py、prompt_template.py 其他都是 Prompts 提示词文件。

`prompts.__init__.py` 导出了 prompts.py 中所有非 `_` 开头的变量。

```python
from . import prompts

__all__ = [name for name in dir(prompts)
           if not name.startswith('_')]

globals().update({name: getattr(prompts, name) for name in __all__})
```


## 2. 关键词生成

```python
async def build_chunks(task, progress_callback):
    # 如果开启了 auto_keywords 配置，则对每个 chunk 自动生成关键词
    if task["parser_config"].get("auto_keywords", 0):
        st = timer()  # 记录开始时间
        progress_callback(msg="Start to generate keywords for every chunk ...")

        # 初始化一个 Chat 类型的大语言模型
        # tenant_id: 租户 ID
        # llm_name: 使用的 LLM 名称
        # lang: 文档语言
        chat_mdl = LLMBundle(
            task["tenant_id"],
            LLMType.CHAT,
            llm_name=task["llm_id"],
            lang=task["language"]
        )

        # 定义异步函数：对单个文档 d 进行关键词提取
        async def doc_keyword_extraction(chat_mdl, d, topn):
            # 先检查缓存，避免重复调用 LLM
            cached = get_llm_cache(
                chat_mdl.llm_name,
                d["content_with_weight"],  # 文档文本（带权重信息）
                "keywords",
                {"topn": topn}  # 关键词数量
            )
            if not cached:  # 如果没有缓存
                async with chat_limiter:  # 控制并发（避免超量请求 LLM）
                    # 在线程池中同步运行关键词提取函数
                    cached = await trio.to_thread.run_sync(
                        lambda: keyword_extraction(chat_mdl, d["content_with_weight"], topn)
                    )
                # 将结果写入缓存
                set_llm_cache(
                    chat_mdl.llm_name,
                    d["content_with_weight"],
                    cached,
                    "keywords",
                    {"topn": topn}
                )
            if cached:
                # 将关键词存到文档 d 中
                d["important_kwd"] = cached.split(",")
                # 使用 rag_tokenizer 对关键词进行分词，存储为 tokens
                d["important_tks"] = rag_tokenizer.tokenize(" ".join(d["important_kwd"]))
            return

        # 使用 Trio 的并发任务调度器并发运行多个关键词提取任务
        async with trio.open_nursery() as nursery:
            for d in docs:  # docs 是所有文档块
                nursery.start_soon(
                    doc_keyword_extraction,
                    chat_mdl,
                    d,
                    task["parser_config"]["auto_keywords"]  # 提取的关键词数量 topn
                )

        # 提示处理完成，并打印耗时
        progress_callback(
            msg="Keywords generation {} chunks completed in {:.2f}s".format(
                len(docs), timer() - st
            )
        )

```
### 2.1 关键词生成入口

关键词生成的核心函数是 keyword_extraction，位于 `ragflow/rag/prompts.py`。

```python
KEYWORD_PROMPT_TEMPLATE = load_prompt("keyword_prompt")
PROMPT_JINJA_ENV = jinja2.Environment(autoescape=False, trim_blocks=True, lstrip_blocks=True)


def keyword_extraction(chat_mdl, content, topn=3):
    template = PROMPT_JINJA_ENV.from_string(KEYWORD_PROMPT_TEMPLATE)
    rendered_prompt = template.render(content=content, topn=topn)

    # 那么 "Output: " 为什么是空的？
    # 这是一种 prompt engineering 小技巧：
    # "Output: " 其实不是让用户真的输入内容，而是 给模型一个输出锚点，告诉它：接下来应该生成 output，而不是继续闲聊
    msg = [{"role": "system", "content": rendered_prompt}, {"role": "user", "content": "Output: "}]
    # 控制对话消息 (msg) 的总 token 数不要超过 max_length。
    _, msg = message_fit_in(msg, chat_mdl.max_length)
    # chat 的方法里，会合并，所以要传入 ms[1:]
    kwd = chat_mdl.chat(rendered_prompt, msg[1:], {"temperature": 0.2})
    if isinstance(kwd, tuple):
        kwd = kwd[0]
    kwd = re.sub(r"^.*</think>", "", kwd, flags=re.DOTALL)
    if kwd.find("**ERROR**") >= 0:
        return ""
    return kwd
```

下面是 keyword_prompt 提示词文件的内容：

```md
## Role
You are a text analyzer.

## Task
Extract the most important keywords/phrases of a given piece of text content.

## Requirements
- Summarize the text content, and give the top {{ topn }} important keywords/phrases.
- The keywords MUST be in the same language as the given piece of text content.
- The keywords are delimited by ENGLISH COMMA.
- Output keywords ONLY.

---

## Text Content
{{ content }}
```

### 2.2 `chat_mdl.chat`
chat_mdl.chat 的内容也比较简单，就是调用大模型，获取输出大模型总结的关键词。

```python
class Base(ABC):
    def chat(self, system, history, gen_conf={}, **kwargs):
        if system:
            history.insert(0, {"role": "system", "content": system})
        gen_conf = self._clean_conf(gen_conf)

        # Implement exponential backoff retry strategy
        for attempt in range(self.max_retries + 1):
            try:
                return self._chat(history, gen_conf, **kwargs)
            except Exception as e:
                e = self._exceptions(e, attempt)
                if e:
                    return e, 0
        assert False, "Shouldn't be here."

    def _chat(self, history, gen_conf, **kwargs):
        logging.info("[HISTORY]" + json.dumps(history, ensure_ascii=False, indent=2))
        if self.model_name.lower().find("qwen3") >= 0:
            kwargs["extra_body"] = {"enable_thinking": False}
        response = self.client.chat.completions.create(model=self.model_name, messages=history, **gen_conf, **kwargs)

        if any([not response.choices, not response.choices[0].message, not response.choices[0].message.content]):
            return "", 0
        ans = response.choices[0].message.content.strip()
        if response.choices[0].finish_reason == "length":
            ans = self._length_stop(ans)
        return ans, self.total_token_count(response)
```

## 3. 问题生成
```python
async def build_chunks(task, progress_callback):
    if task["parser_config"].get("auto_questions", 0):
        st = timer()
        progress_callback(msg="Start to generate questions for every chunk ...")

        # 初始化一个对话模型 (Chat 类型)
        chat_mdl = LLMBundle(
            task["tenant_id"],
            LLMType.CHAT,
            llm_name=task["llm_id"],
            lang=task["language"]
        )

        # 定义异步任务：对单个 chunk 生成问题
        async def doc_question_proposal(chat_mdl, d, topn):
            """
            参数：
                chat_mdl: 用于生成问题的 LLM 实例
                d: 当前文档的一个 chunk（dict）
                topn: 需要生成的问题数目（由 parser_config["auto_questions"] 控制）

            逻辑：
                1. 先检查缓存 (get_llm_cache)，是否已有对该 chunk 的问题生成结果。
                2. 如果没有缓存，则调用 LLM（放到线程池里执行，避免阻塞 async）来生成问题。
                3. 将生成结果写入缓存。
                4. 把问题保存到 d["question_kwd"]，并进行分词，结果存到 d["question_tks"]。
            """
            cached = get_llm_cache(
                chat_mdl.llm_name,
                d["content_with_weight"],  # chunk 的内容
                "question",                # 缓存类型: question
                {"topn": topn}             # 参数: 生成 topn 个问题
            )

            if not cached:  # 如果缓存没有
                async with chat_limiter:  # 控制并发，避免同时发太多请求
                    # LLM 调用放到线程池中执行
                    cached = await trio.to_thread.run_sync(
                        lambda: question_proposal(chat_mdl, d["content_with_weight"], topn)
                    )
                # 把结果写入缓存
                set_llm_cache(
                    chat_mdl.llm_name,
                    d["content_with_weight"],
                    cached,
                    "question",
                    {"topn": topn}
                )

            # 如果得到了问题（缓存的或新生成的）
            if cached:
                d["question_kwd"] = cached.split("\n")  # 按行拆成问题列表
                d["question_tks"] = rag_tokenizer.tokenize("\n".join(d["question_kwd"]))  # 分词

        # 逐个 chunk 并发生成问题
        async with trio.open_nursery() as nursery:
            for d in docs:
                nursery.start_soon(
                    doc_question_proposal, chat_mdl, d, task["parser_config"]["auto_questions"]
                )

        progress_callback(
            msg="Question generation {} chunks completed in {:.2f}s".format(len(docs), timer() - st)
        )

```

与关键词生成类似，问题生成的核心函数是 question_proposal ,位于 `ragflow/rag/prompts.py`。

### 3.1 问题生成入口

```python
QUESTION_PROMPT_TEMPLATE = load_prompt("question_prompt")

def question_proposal(chat_mdl, content, topn=3):
    template = PROMPT_JINJA_ENV.from_string(QUESTION_PROMPT_TEMPLATE)
    rendered_prompt = template.render(content=content, topn=topn)

    msg = [{"role": "system", "content": rendered_prompt}, {"role": "user", "content": "Output: "}]
    _, msg = message_fit_in(msg, chat_mdl.max_length)
    kwd = chat_mdl.chat(rendered_prompt, msg[1:], {"temperature": 0.2})
    if isinstance(kwd, tuple):
        kwd = kwd[0]
    kwd = re.sub(r"^.*</think>", "", kwd, flags=re.DOTALL)
    if kwd.find("**ERROR**") >= 0:
        return ""
    return kwd
```

下面是提示词模板:

```md
## Role
You are a text analyzer.

## Task
Propose {{ topn }} questions about a given piece of text content.

## Requirements
- Understand and summarize the text content, and propose the top {{ topn }} important questions.
- The questions SHOULD NOT have overlapping meanings.
- The questions SHOULD cover the main content of the text as much as possible.
- The questions MUST be in the same language as the given piece of text content.
- One question per line.
- Output questions ONLY.

---

## Text Content
{{ content }}

```

## 4. 文档内容打标签
```python
async def build_chunks(task, progress_callback):
    if task["kb_parser_config"].get("tag_kb_ids", []):
        progress_callback(msg="Start to tag for every chunk ...")

        kb_ids = task["kb_parser_config"]["tag_kb_ids"]     # 指定的知识库 ID 列表
        tenant_id = task["tenant_id"]
        topn_tags = task["kb_parser_config"].get("topn_tags", 3)  # 每个 chunk 选多少标签，默认 3
        S = 1000  # 检索标签时的分片大小（限制一次取多少标签）
        st = timer()

        examples = []   # 存放 (chunk, 已有标签) 的示例，供后续 LLM few-shot 使用

        # 先从缓存里取知识库标签
        all_tags = get_tags_from_cache(kb_ids)
        if not all_tags:
            # 如果没有缓存，就从 retrievaler 批量拉取所有标签
            all_tags = settings.retrievaler.all_tags_in_portion(tenant_id, kb_ids, S)
            set_tags_to_cache(kb_ids, all_tags)  # 写入缓存
        else:
            all_tags = json.loads(all_tags)

        # 初始化 LLM 模型，用于补充标签
        chat_mdl = LLMBundle(task["tenant_id"], LLMType.CHAT,
                            llm_name=task["llm_id"], lang=task["language"])

        docs_to_tag = []   # 存放需要 LLM 参与打标签的 chunk
        for d in docs:
            # 检查任务是否被取消
            task_canceled = has_canceled(task["id"])
            if task_canceled:
                progress_callback(-1, msg="Task has been canceled.")
                return

            # 先尝试用 retrievaler 的快速方法打标签
            success = settings.retrievaler.tag_content(
                tenant_id, kb_ids, d, all_tags,
                topn_tags=topn_tags, S=S
            )

            if success and len(d[TAG_FLD]) > 0:
                # 如果打标签成功且有结果，就把它作为 few-shot 示例保存下来
                examples.append({
                    "content": d["content_with_weight"],
                    TAG_FLD: d[TAG_FLD]
                })
            else:
                # 否则丢进待 LLM 打标签的队列
                docs_to_tag.append(d)

        # 定义异步任务：用 LLM 给 chunk 打标签
        async def doc_content_tagging(chat_mdl, d, topn_tags):
            """
            逻辑：
            1. 先查缓存，是否已有 d 的标签结果。
            2. 如果没缓存：
                - 随机选几个 examples 作为 few-shot 提示。
                - 调用 LLM（放到线程池里执行，避免阻塞）生成标签。
                - 把结果 JSON 化，写入缓存。
            3. 将结果写回 d[TAG_FLD]。
            """
            cached = get_llm_cache(
                chat_mdl.llm_name,
                d["content_with_weight"],
                all_tags,
                {"topn": topn_tags}
            )

            if not cached:
                # few-shot 示例：从已有 examples 里随机取 2 个
                picked_examples = random.choices(examples, k=2) if len(examples) > 2 else examples
                if not picked_examples:
                    picked_examples.append({
                        "content": "This is an example",
                        TAG_FLD: {'example': 1}
                    })

                async with chat_limiter:
                    cached = await trio.to_thread.run_sync(
                        lambda: content_tagging(
                            chat_mdl,
                            d["content_with_weight"],
                            all_tags,
                            picked_examples,
                            topn=topn_tags
                        )
                    )
                if cached:
                    cached = json.dumps(cached)

            if cached:
                set_llm_cache(
                    chat_mdl.llm_name,
                    d["content_with_weight"],
                    cached,
                    all_tags,
                    {"topn": topn_tags}
                )
                d[TAG_FLD] = json.loads(cached)

        # 并发执行 LLM 打标签
        async with trio.open_nursery() as nursery:
            for d in docs_to_tag:
                nursery.start_soon(doc_content_tagging, chat_mdl, d, topn_tags)

        progress_callback(
            msg="Tagging {} chunks completed in {:.2f}s".format(len(docs), timer() - st)
        )

```

标签生成，分为两步:

* **快速路径**：`retrievaler.tag_content`，直接用已有知识库标签匹配。
* **慢速路径**：如果快速路径失败 → 调用 LLM (`content_tagging`) 来推断标签。
* **few-shot 学习**: LLM 打标签时，会从已经成功打过标签的 chunks (`examples`) 里，随机挑几个作为提示。如果一个都没有，就构造一个伪示例。

retriver 的实现详见 [retriver](./22_retriver.md)

### 4.1 标签生成入口

```python
CONTENT_TAGGING_PROMPT_TEMPLATE = load_prompt("content_tagging_prompt")

def content_tagging(chat_mdl, content, all_tags, examples, topn=3):
    # 用 Jinja2 模板引擎加载标签提示词模板
    template = PROMPT_JINJA_ENV.from_string(CONTENT_TAGGING_PROMPT_TEMPLATE)

    # 把示例的 TAG_FLD（标签结果）转成 JSON 格式字符串，方便模板渲染
    for ex in examples:
        ex["tags_json"] = json.dumps(ex[TAG_FLD], indent=2, ensure_ascii=False)

    # 渲染 prompt，把所有候选标签、示例和待标注文本填充进去
    rendered_prompt = template.render(
        topn=topn,           # 模型需要输出前 topn 个标签
        all_tags=all_tags,   # 所有可选标签
        examples=examples,   # 少量带标签的示例
        content=content,     # 当前需要打标签的文本
    )

    # 构建消息，system 里放提示词，user 只是告诉模型“输出结果”
    msg = [{"role": "system", "content": rendered_prompt}, {"role": "user", "content": "Output: "}]

    # 检查消息长度是否超过 LLM 限制，必要时截断
    _, msg = message_fit_in(msg, chat_mdl.max_length)

    # 调用 LLM 生成结果
    # 注意这里既把 prompt 作为 system 指令传入，也把 user msg[1:] 传入
    kwd = chat_mdl.chat(rendered_prompt, msg[1:], {"temperature": 0.5})

    # 如果 LLM 返回的是元组，取第一个结果
    if isinstance(kwd, tuple):
        kwd = kwd[0]

    # 去掉模型可能输出的 `<think>` 思维链部分，只保留结论
    kwd = re.sub(r"^.*</think>", "", kwd, flags=re.DOTALL)

    # 如果模型输出包含 "**ERROR**"，直接抛异常
    if kwd.find("**ERROR**") >= 0:
        raise Exception(kwd)

    # 解析 JSON 格式结果
    try:
        # 优先用 json_repair（比标准 json.loads 更鲁棒，能修复常见错误）
        obj = json_repair.loads(kwd)
    except json_repair.JSONDecodeError:
        # 如果失败，尝试手动截取 { ... } 部分再修复
        try:
            result = kwd.replace(rendered_prompt[:-1], "").replace("user", "").replace("model", "").strip()
            result = "{" + result.split("{")[1].split("}")[0] + "}"
            obj = json_repair.loads(result)
        except Exception as e:
            logging.exception(f"JSON parsing error: {result} -> {e}")
            raise e

    # 过滤结果：只保留值为正整数的标签
    res = {}
    for k, v in obj.items():
        try:
            if int(v) > 0:   # 标签权重必须大于 0
                res[str(k)] = int(v)   # key 强制转为字符串，value 转为 int
        except Exception:
            pass

    # 返回最终标签结果，形如 {"tagA": 1, "tagB": 2}
    return res

```

用到的提示词模板如下:

```md
## Role
You are a text analyzer.

## Task
<!-- 根据示例和整个标签集，为给定的文本内容添加标签（标签）。 -->
Add tags (labels) to a given piece of text content based on the examples and the entire tag set.

## Steps
<!-- 
- 审查标签/类别集。
- 审查示例，这些示例均包含文本内容以及以 JSON 格式给出的相关性评分的已分配标签。
- 概括文本内容，并使用标签/类别集中最相关的前 {{ topn }} 个标签对其进行标记，同时附上相应相关性评分。 
-->
- Review the tag/label set.
- Review examples which all consist of both text content and assigned tags with relevance score in JSON format.
- Summarize the text content, and tag it with the top {{ topn }} most relevant tags from the set of tags/labels and the corresponding relevance score.

## Requirements
<!-- 
- 标签必须来自标签集。
- 输出必须仅以 JSON 格式呈现，键为“tag”，值为其相关性得分。
- 相关性得分必须在 1 到 10 之间。
- 仅输出关键词。 
-->
- The tags MUST be from the tag set.
- The output MUST be in JSON format only, the key is tag and the value is its relevance score.
- The relevance score must range from 1 to 10.
- Output keywords ONLY.

# TAG SET
{{ all_tags | join(', ') }}

{% for ex in examples %}
# Examples {{ loop.index0 }}
### Text Content
{{ ex.content }}

Output:
{{ ex.tags_json }}

{% endfor %}
# Real Data
### Text Content
{{ content }}

```

## 5. 总结

经过索引增强后，doc 会添加如下字段:

```python
# 关键词
d["important_kwd"] = cached.split(",")
d["important_tks"] = rag_tokenizer.tokenize(" ".join(d["important_kwd"]))

# 问题生成
d["question_kwd"] = cached.split("\n")  # 按行拆成问题列表
d["question_tks"] = rag_tokenizer.tokenize("\n".join(d["question_kwd"]))  # 分词

# 标签
d["tag_feas"] = {"tag1": 1, "tag2": 2} # value是tag 的权重
```
