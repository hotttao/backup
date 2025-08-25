---
weight: 1
title: "RagFlow Chunk"
date: 2025-08-20T11:00:00+08:00
lastmod: 2025-08-20T11:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "RagFlow Chunk"
featuredImage: 

tags: ["RAG", "RagFlow"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

前面我们介绍了 RagFlow 的模型实例化，这篇文章我们来介绍一下 RagFlow 的 Chunk 的过程。

## 1. Parser
ragflow 会根据不同的文档类型，选择不同的 Parser 进行处理。所有的解析器定义在 `rag\app` 模块下。

```python
chunker = FACTORY[task["parser_id"].lower()]

FACTORY = {
    "general": naive,
    ParserType.NAIVE.value: naive,
    ParserType.PAPER.value: paper,
    ParserType.BOOK.value: book,
    ParserType.PRESENTATION.value: presentation,
    ParserType.MANUAL.value: manual,
    ParserType.LAWS.value: laws,
    ParserType.QA.value: qa,
    ParserType.TABLE.value: table,
    ParserType.RESUME.value: resume,
    ParserType.PICTURE.value: picture,
    ParserType.ONE.value: one,
    ParserType.AUDIO.value: audio,
    ParserType.EMAIL.value: email,
    ParserType.KG.value: naive,
    ParserType.TAG.value: tag
}
```

ragflow 支持解析的文档类型定义在 ParserType 枚举类中。


```python
class ParserType(StrEnum):
    PRESENTATION = "presentation"
    LAWS = "laws"
    MANUAL = "manual"
    PAPER = "paper"
    RESUME = "resume"
    BOOK = "book"
    QA = "qa"
    TABLE = "table"
    NAIVE = "naive"
    PICTURE = "picture"
    ONE = "one"
    AUDIO = "audio"
    EMAIL = "email"
    KG = "knowledge_graph"
    TAG = "tag"
```

| 类型               | 描述 / 使用场景                                  |
| ---------------- | ------------------------------------------ |
| **PRESENTATION** | 演示文稿（如 PowerPoint、Keynote），通常按页/幻灯片解析文本与结构 |
| **LAWS**         | 法律法规文档，通常含条款、章节，解析需保留结构化条目                 |
| **MANUAL**       | 说明书、操作手册，结构化层次分明，可能包含列表、步骤                 |
| **PAPER**        | 论文或学术文章，通常有标题、摘要、段落、公式等                    |
| **RESUME**       | 简历/履历，关注个人信息、经历、技能、联系方式等字段                 |
| **BOOK**         | 书籍，按章节/段落解析文本，可能需要保留页码/目录结构                |
| **QA**           | 问答对话或 FAQ 文档，用于知识问答系统的解析                   |
| **TABLE**        | 表格数据，通常解析成结构化表格或 DataFrame                 |
| **NAIVE**        | 通用/默认解析类型，没有特定结构，按纯文本处理                    |
| **PICTURE**      | 图片/图像，通常需要 OCR 或图像识别来提取文字信息                |
| **ONE**          | 单文本文件，整个文件作为一个片段解析，不做分块                    |
| **AUDIO**        | 音频文件，通常先做语音识别 (ASR) → 文本解析                 |
| **EMAIL**        | 邮件内容，可能包含发件人、收件人、主题、正文、附件等                 |
| **KG**           | 知识图谱数据，通常从文本中抽取实体关系构建图谱                    |
| **TAG**          | 标签/分类信息，可能用于元数据标注或快速分类                     |

以 nave 为例子，其定义在 `rag\app\naive.py`。每个类似的文件内，都定义了一个 chunk 函数，是这一类文档的分块的执行入口。

```python
from deepdoc.parser import DocxParser, ExcelParser, HtmlParser, JsonParser, MarkdownParser, PdfParser, TxtParser


def chunk(filename, binary=None, from_page=0, to_page=100000,
          lang="Chinese", callback=None, **kwargs):
    """
        Supported file formats are docx, pdf, excel, txt.
        This method apply the naive ways to chunk files.
        Successive text will be sliced into pieces using 'delimiter'.
        Next, these successive pieces are merge into chunks whose token number is no more than 'Max token number'.
    """

class Docx(DocxParser):
    def __init__(self):
        pass


class Pdf(PdfParser):
    def __init__(self):
        super().__init__()

class Markdown(MarkdownParser):
  pass
```

可以看到 navie 定义的各种格式解析类，都是基于 deepdoc 实现的 parser 实现的。

deepdoc 是 ragflow 实现的文档解析库，支持解析 docx, pdf, excel, txt 等格式的文档。因为 pdf 等格式涉及到 ocr，代码比较复杂。这里我们先讲解 markdown 的解析。

我们的目的是先理解 ragflow 文档解析和索引的过程，在理解各种文档如何解析，以及 workflow 、agent 如何构建。

## 2. navie.chunk 解析
**`navie.chunk`**：
1. 根据文件类型（docx/pdf/excel/txt/md/html/json/doc...），用不同的解析器把文件解析成文本片段（sections）
2. 再按照一定规则（分隔符 + 最大 token 数）把这些文本合并成“块（chunks）”，最终返回一个便于后续处理的分词结果。
3. 它的核心思想是“**多格式文档统一切块**”。

```python
def chunk(filename, binary=None, from_page=0, to_page=100000,
          lang="Chinese", callback=None, **kwargs):
    """
    对指定文件进行分块处理，支持 docx, pdf, excel, txt 等格式。
    功能：
        1. 根据语言判断是否为英文，决定后续分词策略。
        2. 解析文件内容，提取文本、表格、图片信息。
        3. 将文本切分为小块（chunks），每块的 token 数量不超过 parser_config 中的限制。
        4. 支持可视化增强（使用 LLM 的 IMAGE2TEXT 模型增强表格/图像识别）。
        5. 可选只返回章节级别分块。
    
    参数：
        filename: 文件路径或名称。
        binary: 文件二进制内容（可选）。
        from_page/to_page: 针对 pdf 文件的页码范围。
        lang: 语言标记，主要用于判断分词方式（中文/英文）。
        callback: 进度回调，用来报告进度，比如 `"Start to parse."`。
        kwargs: 额外配置，比如 `parser_config`、`tenant_id`、`section_only`。   
    """
    
    # 判断是否英文文档
    is_english = lang.lower() == "english"  
    
    # 获取解析器配置，默认 chunk_token_num=512, delimiter="\n!?。；！？", layout_recognize="DeepDOC"
    # chunk_token_num ：每个 chunk 最大 token 数（默认 512）。
    # delimiter：       切分分隔符（句号/问号/换行等）。
    # layout_recognize：版面识别模式，默认 `"DeepDOC"`。
    parser_config = kwargs.get(
        "parser_config", {
            "chunk_token_num": 512, 
            "delimiter": "\n!?。；！？", 
            "layout_recognize": "DeepDOC"
        }
    )

    # 初始化文档信息
    doc = {
        "docnm_kwd": filename,  # 文档名关键词
        "title_tks": rag_tokenizer.tokenize(re.sub(r"\.[a-zA-Z]+$", "", filename))  # 对文件名去掉后缀并分词
    }
    # 对标题进行细粒度分词
    doc["title_sm_tks"] = rag_tokenizer.fine_grained_tokenize(doc["title_tks"])

    # 结果列表
    res = []

    # pdf_parser 和 section_images 初始化
    pdf_parser = None
    section_images = None

    # ===========================
    # DOCX 文件处理
    # ===========================
    if re.search(r"\.docx$", filename, re.IGNORECASE):
        pass

    # ===========================
    # PDF 文件处理
    # ===========================
    elif re.search(r"\.pdf$", filename, re.IGNORECASE):
        pass
    # ===========================
    # Excel 文件处理
    # ===========================
    elif re.search(r"\.(csv|xlsx?)$", filename, re.IGNORECASE):
        pass

    # ===========================
    # 文本或代码文件处理
    # ===========================
    elif re.search(r"\.(txt|py|js|java|c|cpp|h|php|go|ts|sh|cs|kt|sql)$", filename, re.IGNORECASE):
        pass

    # ===========================
    # Markdown 文件处理
    # ===========================
    elif re.search(r"\.(md|markdown)$", filename, re.IGNORECASE):
        callback(0.1, "Start to parse.")
        markdown_parser = Markdown(int(parser_config.get("chunk_token_num", 128)))
        sections, tables = markdown_parser(filename, binary, separate_tables=False)

        # 处理每个 section 的图片
        section_images = []
        for section_text, _ in sections:
            images = markdown_parser.get_pictures(section_text) if section_text else None
            if images:
                combined_image = reduce(concat_img, images) if len(images) > 1 else images[0]
                section_images.append(combined_image)
            else:
                section_images.append(None)

        res = tokenize_table(tables, doc, is_english)
        callback(0.8, "Finish parsing.")

    # ===========================
    # HTML 文件处理
    # ===========================
    elif re.search(r"\.(htm|html)$", filename, re.IGNORECASE):
        pass

    # ===========================
    # JSON 文件处理
    # ===========================
    elif re.search(r"\.(json|jsonl|ldjson)$", filename, re.IGNORECASE):
        pass

    # ===========================
    # DOC 文件处理
    # ===========================
    elif re.search(r"\.doc$", filename, re.IGNORECASE):
        pass

    else:
        # 不支持的文件类型
        raise NotImplementedError(
            "file type not supported yet(pdf, xlsx, doc, docx, txt supported)"
        )

    # ===========================
    # 最终分块与分词
    # ===========================
    st = timer()
    if section_images:
        # 如果所有图片都为 None，则不使用图片增强
        if all(image is None for image in section_images):
            section_images = None

    if section_images:
        # 合并文本和图片生成 chunks
        chunks, images = naive_merge_with_images(
            sections, section_images,
            int(parser_config.get("chunk_token_num", 128)), 
            parser_config.get("delimiter", "\n!?。；！？")
        )
        if kwargs.get("section_only", False):
            return chunks

        res.extend(tokenize_chunks_with_images(chunks, doc, is_english, images))
    else:
        # 只处理文本
        chunks = naive_merge(
            sections, 
            int(parser_config.get("chunk_token_num", 128)), 
            parser_config.get("delimiter", "\n!?。；！？")
        )
        if kwargs.get("section_only", False):
            return chunks

        res.extend(tokenize_chunks(chunks, doc, is_english, pdf_parser))

    logging.info("naive_merge({}): {}".format(filename, timer() - st))
    return res
```

navie.chunk 的实现分成了三个部分:
1. doc 元数据初始化，元数据会包含三个字段:
    - docnm_kwd: 文件名
    - title_tks: 文件名去掉后缀后的分词
    - title_sm_tks: 文件名去掉后缀后的细粒度分词
    - rag_tokenizer 是 ragflow 中的分词模块，用于将文本转换为 tokens。具体的实现见 [rag_tokenizer](./21_tokenizer.md)。
2. 根据文档类型，选择不同的解析器，对文档进行解析，解析后的结果包括三个部分:
    - sections: 文档的段落列表，每个段落是一个元组，包含段落文本和段落类型（如标题、段落等）。
    - tables: 文档中包含的表格。
    - section_images: 文档中每个段落对应的图片列表，每个图片是一个 PIL.Image.Image 对象。
3. 解析后的统一处理，包括:
    - 按照统一的规则执行 chunk

以 Markdown 为例，处理过程会经过如下调用链:

```python
navie.chunk
    parser_config={}
    doc={}
    markdown_parser = Markdown(int(parser_config.get("chunk_token_num", 128)))
    sections, tables = markdown_parser(filename, binary, separate_tables=False)
    section_images = [markdown_parser.get_pictures(section_text)]
    res = tokenize_table(tables, doc, is_english)
    naive_merge_with_images/naive_merge
    res.extend(tokenize_chunks_with_images(chunks, doc, is_english, images))
```

### 2.1 解析结果示例
我们通过断点，查看 Markdown的每一步的解析结果。下面是一个示例的 Markdown 文件:

```md
# 第一章 简介

这是一个测试文档。

![本地图片](D:\Code\rag\ragflow\demo\tool.jpg)

# 表格

## 第二章 数据表

这是一个表格：

| 姓名 | 年龄 |
| ---- | ---- |
| 张三 | 20   |
| 李四 | 30   |

## 第三章 多个表格

再来一个表格：

| 商品 | 价格 |
| ---- | ---- |
| 苹果 | 3    |
| 香蕉 | 2    |

以及另一个表格：

| 城市 | 人口    |
| ---- | ------- |
| 北京 | 2000 万 |
| 上海 | 1800 万 |


```

### 2.2 markdown_parser 解析后
#### sections:
可以看到 sections 中包含了 4 个段落，段落的划分以 Markdown 标题区分。

```json
[
	[
		"# 第一章 简介\n\n这是一个测试文档。\n\n![本地图片](D:\\Code\\rag\\ragflow\\demo\\tool.jpg)\n",
		""
	],
	[
		"# 表格\n",
		""
	],
	[
		"## 第二章 数据表\n\n这是一个表格：\n<table>\n<thead>\n<tr>\n<th>姓名</th>\n<th>年龄</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>张三</td>\n<td>20</td>\n</tr>\n<tr>\n<td>李四</td>\n<td>30</td>\n</tr>\n</tbody>\n</table>\n\n\n\n",
		""
	],
	[
		"## 第三章 多个表格\n\n再来一个表格：\n<table>\n<thead>\n<tr>\n<th>商品</th>\n<th>价格</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>苹果</td>\n<td>3</td>\n</tr>\n<tr>\n<td>香蕉</td>\n<td>2</td>\n</tr>\n</tbody>\n</table>\n\n\n\n\n以及另一个表格：\n<table>\n<thead>\n<tr>\n<th>城市</th>\n<th>人口</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>北京</td>\n<td>2000 万</td>\n</tr>\n<tr>\n<td>上海</td>\n<td>1800 万</td>\n</tr>\n</tbody>\n</table>\n\n\n\n\n",
		""
	]
]
```

#### tables tokenize 解析后
tables tokenize 解析后，包括:
1. docnm_kwd: 文件名
2. title_tks: 文件名去掉后缀后的分词
3. title_sm_tks: 文件名去掉后缀后的细粒度分词
4. content_with_weight: 表格的原始文本
5. content_ltks: 表格的原始文本分词
6. content_sm_ltks: 表格的原始文本细粒度分词


```json
[{
		"docnm_kwd": "D:\\Code\\rag\\ragflow\\demo\\a.md",
		"title_tks": "d code rag ragflow demo a",
		"title_sm_tks": "d code rag ragflow demo a",
		"content_with_weight": "<table>\n<thead>\n<tr>\n<th>姓名</th>\n<th>年龄</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>张三</td>\n<td>20</td>\n</tr>\n<tr>\n<td>李四</td>\n<td>30</td>\n</tr>\n</tbody>\n</table>",
		"content_ltks": "thead 姓名 年龄 thead tbodi 张 三 20 李四 30 tbodi",
		"content_sm_ltks": "thead 姓名 年龄 thead tbodi 张 三 20 李四 30 tbodi"
	},
	{
		"docnm_kwd": "D:\\Code\\rag\\ragflow\\demo\\a.md",
		"title_tks": "d code rag ragflow demo a",
		"title_sm_tks": "d code rag ragflow demo a",
		"content_with_weight": "<table>\n<thead>\n<tr>\n<th>商品</th>\n<th>价格</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>苹果</td>\n<td>3</td>\n</tr>\n<tr>\n<td>香蕉</td>\n<td>2</td>\n</tr>\n</tbody>\n</table>",
		"content_ltks": "thead 商品 价格 thead tbodi 苹果 3 香蕉 2 tbodi",
		"content_sm_ltks": "thead 商品 价格 thead tbodi 苹果 3 香蕉 2 tbodi"
	},
	{
		"docnm_kwd": "D:\\Code\\rag\\ragflow\\demo\\a.md",
		"title_tks": "d code rag ragflow demo a",
		"title_sm_tks": "d code rag ragflow demo a",
		"content_with_weight": "<table>\n<thead>\n<tr>\n<th>城市</th>\n<th>人口</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>北京</td>\n<td>2000 万</td>\n</tr>\n<tr>\n<td>上海</td>\n<td>1800 万</td>\n</tr>\n</tbody>\n</table>",
		"content_ltks": "thead 城市 人口 thead tbodi 北京 2000 万 上海 1800 万 tbodi",
		"content_sm_ltks": "thead 城市 人口 thead tbodi 北京 2000 万 上海 1800 万 tbodi"
	},
	{
		"docnm_kwd": "D:\\Code\\rag\\ragflow\\demo\\a.md",
		"title_tks": "d code rag ragflow demo a",
		"title_sm_tks": "d code rag ragflow demo a",
		"content_with_weight": "<table>\n<thead>\n<tr>\n<th>姓名</th>\n<th>年龄</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>张三</td>\n<td>20</td>\n</tr>\n<tr>\n<td>李四</td>\n<td>30</td>\n</tr>\n</tbody>\n</table>",
		"content_ltks": "thead 姓名 年龄 thead tbodi 张 三 20 李四 30 tbodi",
		"content_sm_ltks": "thead 姓名 年龄 thead tbodi 张 三 20 李四 30 tbodi"
	},
	{
		"docnm_kwd": "D:\\Code\\rag\\ragflow\\demo\\a.md",
		"title_tks": "d code rag ragflow demo a",
		"title_sm_tks": "d code rag ragflow demo a",
		"content_with_weight": "<table>\n<thead>\n<tr>\n<th>商品</th>\n<th>价格</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>苹果</td>\n<td>3</td>\n</tr>\n<tr>\n<td>香蕉</td>\n<td>2</td>\n</tr>\n</tbody>\n</table>",
		"content_ltks": "thead 商品 价格 thead tbodi 苹果 3 香蕉 2 tbodi",
		"content_sm_ltks": "thead 商品 价格 thead tbodi 苹果 3 香蕉 2 tbodi"
	},
	{
		"docnm_kwd": "D:\\Code\\rag\\ragflow\\demo\\a.md",
		"title_tks": "d code rag ragflow demo a",
		"title_sm_tks": "d code rag ragflow demo a",
		"content_with_weight": "<table>\n<thead>\n<tr>\n<th>城市</th>\n<th>人口</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>北京</td>\n<td>2000 万</td>\n</tr>\n<tr>\n<td>上海</td>\n<td>1800 万</td>\n</tr>\n</tbody>\n</table>",
		"content_ltks": "thead 城市 人口 thead tbodi 北京 2000 万 上海 1800 万 tbodi",
		"content_sm_ltks": "thead 城市 人口 thead tbodi 北京 2000 万 上海 1800 万 tbodi"
	}
]
```

#### section_images
section_images 是从每个 section 中解析出的图片，与 section 一一对应。

```python
[<PIL.Image.Image image mode=RGB size=151x148 at 0x151071969E0>, None, None, None]
```

### 2.3 naive_merge_with_images 解析后
```python
chunks, images = naive_merge_with_images(
            sections, section_images,
            int(parser_config.get("chunk_token_num", 128)), 
            parser_config.get("delimiter", "\n!?。；！？")
        )
```

naive_merge_with_images 接收 sections 和 section_images，按照固定的 chunk_token_num 对 sections 进行 chunk，并合并 image。


经过 naive_merge_with_images 处理后，得到的 chunks 是这样的：

```python
[
	"",
	"# 第一章 简介这是一个测试文档[本地图片](D:\\Code\\rag\\ragflow\\demo\\tool.jpg)# 表格## 第二章 数据表这是一个表格：<table><thead><tr><th>姓名</th><th>年龄</th></tr></thead><tbody><tr><td>张三</td><td>20</td></tr><tr><td>李四</td><td>30</td></tr></tbody></table>## 第三章 多个表格再来一个表格：<table><thead><tr><th>商品</th><th>价格</th></tr></thead><tbody><tr><td>苹果</td><td>3</td></tr><tr><td>香蕉</td><td>2</td></tr></tbody></table>以及另一个表格：<table><thead><tr><th>城市</th><th>人口</th></tr></thead><tbody><tr><td>北京</td><td>2000 万</td></tr><tr><td>上海</td><td>1800 万</td></tr></tbody></table>"
]
[None, <PIL.Image.Image image mode=RGB size=151x148 at 0x27F8867B6A0>]
```

因为示例文件，每一个section 都较小，所以合并到了一个 chunk 中。多个 chunk 中的 image 会合并成一张。

### 2.4 tokenize_chunks_with_images 解析后

tokenize_chunks_with_images:
1. 对分块之后的 chunk 进行分词，并把 chunk 和 image 合并到一个 doc

```python
tokenize_chunks_with_images(chunks, doc, is_english, images)
```

tokenize_chunks_with_images 处理后的得到的 doc 如下。相比于 table 解析后的 doc，这个 doc 多了位置信息和图片。

```python
[{
	"docnm_kwd": "D:\\Code\\rag\\ragflow\\demo\\a.md",
	"title_tks": "d code rag ragflow demo a",
	"title_sm_tks": "d code rag ragflow demo a",
	"image": <PIL.Image.Image image mode=RGB size=151x148 at 0x27F8867B6A0>,
	"page_num_int": [
		2
	],
	"position_int": [
		[
			2,
			1,
			1,
			1,
			1
		]
	],
	"top_int": [
		1
	],
	"content_with_weight": "# 第一章 简介这是一个测试文档[本地图片](D:\\Code\\rag\\ragflow\\demo\\tool.jpg)# 表格## 第二章 数据表这是一个表格：<table><thead><tr><th>姓名</th><th>年龄</th></tr></thead><tbody><tr><td>张三</td><td>20</td></tr><tr><td>李四</td><td>30</td></tr></tbody></table>## 第三章 多个表格再来一个表格：<table><thead><tr><th>商品</th><th>价格</th></tr></thead><tbody><tr><td>苹果</td><td>3</td></tr><tr><td>香蕉</td><td>2</td></tr></tbody></table>以及另一个表格：<table><thead><tr><th>城市</th><th>人口</th></tr></thead><tbody><tr><td>北京</td><td>2000 万</td></tr><tr><td>上海</td><td>1800 万</td></tr></tbody></table>",
	"content_ltks": "第一章 简介 这 是 一个 测试 文档 本地 图片 d code rag ragflow demo tool jpg 表格 第二章 数据表 这 是 一个 表格 thead 姓名 年龄 thead tbodi 张 三 20 李四 30 tbodi 第三章 多个 表格 再来一个 表格 thead 商品 价格 thead tbodi 苹果 3 香蕉 2 tbodi 以及 另 一个 表格 thead 城市 人口 thead tbodi 北京 2000 万 上海 1800 万 tbodi",
	"content_sm_ltks": "第一 章 简介 这 是 一个 测试 文档 本地 图片 d code rag ragflow demo tool jpg 表格 第二 章 数据 表 这 是 一个 表格 thead 姓名 年龄 thead tbodi 张 三 20 李四 30 tbodi 第三 章 多个 表格 再 来 一个 表格 thead 商品 价格 thead tbodi 苹果 3 香蕉 2 tbodi 以及 另 一个 表格 thead 城市 人口 thead tbodi 北京 2000 万 上海 1800 万 tbodi"
}]
```

下面我们来详细介绍 Markdown 的解析过程。


## 3. Markdown 解析
Markdown 的解析有两个类组成:

```python
class Markdown(MarkdownParser):
    
    # 从 Markdown 文本中提取图片 URL
    def get_picture_urls(self, sections):
        pass

    # 从文本中提取图片
    def get_pictures(self, text):
        pass

    def __call__(self, filename, binary=None, separate_tables=True):
        pass

class RAGFlowMarkdownParser:
    def __init__(self, chunk_token_num=128):
        self.chunk_token_num = int(chunk_token_num)

    # 提取 Markdown 文本中的表格和剩余文本
    def extract_tables_and_remainder(self, markdown_text, separate_tables=True):
        pass
```

### 3.1 RagflowMarkdownParser

RAGFlowMarkdownParser 用于 **提取 Markdown 文本中的表格**，并返回剩余文本。
* 支持三类表格：

  1. 标准 Markdown 表格（带 `|` 和分隔行）
  2. 无边框 Markdown 表格
  3. HTML 表格（可能有 `<html>` 或 `<body>` 包裹）
* `separate_tables=True` → 将表格移除并替换为空行
* `separate_tables=False` → 保留表格（可渲染为 HTML）

但是这段代码是有问题的，如果 separate_tables=False:
1. table 会在 replace_tables_with_rendered_html 中被转换为 html，并被保存在tables 内
2. replace_html_tables 内，因为已经转换为 html 了又会被解析保存到 tables，重复保存了

上面的示例也验证了这个结论。


```python
class RAGFlowMarkdownParser:
    # 初始化方法，设置默认的每个分块的 token 数量
    def __init__(self, chunk_token_num=128):
        self.chunk_token_num = int(chunk_token_num)  # 确保 chunk_token_num 为整数

    # 提取 Markdown 文本中的表格，同时返回剩余文本
    # markdown_text: 输入的完整 Markdown 文本
    # separate_tables: 是否将表格单独分离，True 表示移除表格，False 表示替换为 HTML
    def extract_tables_and_remainder(self, markdown_text, separate_tables=True):
        tables = []  # 用于存储解析出的表格
        working_text = markdown_text  # 当前处理的文本副本，用于逐步替换表格

        # 内部函数：根据给定的正则 pattern 提取表格，并根据 separate_tables 决定处理方式
        def replace_tables_with_rendered_html(pattern, table_list, render=True):
            new_text = ""  # 构建替换后的文本
            last_end = 0  # 记录上一个匹配的结束位置
            for match in pattern.finditer(working_text):  # 遍历匹配到的每个表格
                raw_table = match.group()  # 获取原始匹配文本
                table_list.append(raw_table)  # 将原始表格添加到表格列表
                if separate_tables:
                    # 如果需要单独分离表格，则在文本中用空行替代表格
                    new_text += working_text[last_end:match.start()] + "\n\n"
                else:
                    # 否则，将表格渲染为 HTML（如果 render=True）并替换文本中的表格
                    html_table = markdown(raw_table, extensions=['markdown.extensions.tables']) if render else raw_table
                    new_text += working_text[last_end:match.start()] + html_table + "\n\n"
                last_end = match.end()  # 更新 last_end 为当前匹配结束位置
            new_text += working_text[last_end:]  # 添加最后一段未匹配的文本
            return new_text  # 返回处理后的文本

        # 如果文本中包含 "|"，才有可能是 Markdown 表格，优化性能
        if "|" in markdown_text:
            # -------------------------------
            # 标准 Markdown 表格匹配模式
            # -------------------------------
            border_table_pattern = re.compile(
                r'''
                (?:\n|^)                       # 换行或文本开头
                (?:\|.*?\|.*?\|.*?\n)          # 表格表头至少两列
                (?:\|(?:\s*[:-]+[-| :]*\s*)\|.*?\n)  # 表格分隔线
                (?:\|.*?\|.*?\|.*?\n)+         # 表格数据行，至少一行
            ''', re.VERBOSE)
            working_text = replace_tables_with_rendered_html(border_table_pattern, tables)

            # -------------------------------
            # 无边框 Markdown 表格匹配模式
            # -------------------------------
            no_border_table_pattern = re.compile(
                r'''
                (?:\n|^)                        # 换行或文本开头
                (?:\S.*?\|.*?\n)                # 表格表头
                (?:(?:\s*[:-]+[-| :]*\s*).*?\n) # 表格分隔符
                (?:\S.*?\|.*?\n)+               # 表格数据行
                ''', re.VERBOSE)
            working_text = replace_tables_with_rendered_html(no_border_table_pattern, tables)

        # -------------------------------
        # HTML 表格匹配
        # -------------------------------
        if "<table>" in working_text.lower():  # 优化性能，只有包含 <table> 才处理
            # HTML 表格匹配正则，支持多种情况（有 html/body 包裹或只有 table）
            html_table_pattern = re.compile(
            r'''
            (?:\n|^)                       # 换行或文本开头
            \s*                             # 可选空白字符
            (?:
                # case1: <html><body><table>...</table></body></html>
                (?:<html[^>]*>\s*<body[^>]*>\s*<table[^>]*>.*?</table>\s*</body>\s*</html>)
                |
                # case2: <body><table>...</table></body>
                (?:<body[^>]*>\s*<table[^>]*>.*?</table>\s*</body>)
                |
                # case3: 只有 <table>...</table>
                (?:<table[^>]*>.*?</table>)
            )
            \s*
            (?=\n|$)                        # 结尾为换行或文本末尾
            ''',
            re.VERBOSE | re.DOTALL | re.IGNORECASE
            )

            # 内部函数：替换 HTML 表格
            def replace_html_tables():
                nonlocal working_text  # 使用外部 working_text 变量
                new_text = ""
                last_end = 0
                for match in html_table_pattern.finditer(working_text):
                    raw_table = match.group()  # 获取匹配到的 HTML 表格
                    tables.append(raw_table)  # 保存到表格列表
                    if separate_tables:
                        # 分离表格，则用空行替代
                        new_text += working_text[last_end:match.start()] + "\n\n"
                    else:
                        # 保留原始 HTML 表格文本
                        new_text += working_text[last_end:match.start()] + raw_table + "\n\n"
                    last_end = match.end()
                new_text += working_text[last_end:]  # 添加剩余文本
                working_text = new_text  # 更新 working_text

            replace_html_tables()  # 调用函数处理 HTML 表格

        # 返回最终文本（去掉或替换表格）以及表格列表
        return working_text, tables
```


### 3.2 Markdown

```python
class Markdown(MarkdownParser):
    # =========================
    # 获取 Markdown 文本中的图片 URL
    # =========================
    def get_picture_urls(self, sections):
        # 如果 sections 为空，直接返回空列表
        if not sections:
            return []
        
        # 如果 sections 是字符串类型，直接赋值给 text
        if isinstance(sections, type("")):
            text = sections
        # 如果 sections 是列表且第一个元素是字符串，取第一个元素作为 text
        elif isinstance(sections[0], type("")):
            text = sections[0]
        # 否则无法解析，返回空列表
        else:
            return []

        from bs4 import BeautifulSoup
        # 将 Markdown 文本转换为 HTML
        html_content = markdown(text)
        # 使用 BeautifulSoup 解析 HTML
        soup = BeautifulSoup(html_content, 'html.parser')
        # 查找所有 <img> 标签，并提取 src 属性不为空的 URL
        html_images = [img.get('src') for img in soup.find_all('img') if img.get('src')]
        return html_images  # 返回图片 URL 列表

    # =========================
    # 下载或打开 Markdown 文本中的图片
    # =========================
    def get_pictures(self, text):
        """Download and open all images from markdown text."""
        import requests
        # 获取文本中所有图片 URL
        image_urls = self.get_picture_urls(text)
        images = []  # 用于存储 PIL.Image 对象

        # 遍历所有图片 URL
        for url in image_urls:
            try:
                # 判断 URL 是远程 URL 还是本地文件路径
                if url.startswith(('http://', 'https://')):
                    # 对远程 URL，使用 requests 下载图片
                    response = requests.get(url, stream=True, timeout=30)
                    # 如果下载成功且 Content-Type 是 image/*
                    if response.status_code == 200 and response.headers['Content-Type'].startswith('image/'):
                        # 使用 PIL 打开图片并转为 RGB 模式
                        img = Image.open(BytesIO(response.content)).convert('RGB')
                        images.append(img)  # 加入图片列表
                else:
                    # 对本地文件路径
                    from pathlib import Path
                    local_path = Path(url)
                    # 如果文件不存在，记录警告并跳过
                    if not local_path.exists():
                        logging.warning(f"Local image file not found: {url}")
                        continue
                    # 打开本地图片并转为 RGB
                    img = Image.open(url).convert('RGB')
                    images.append(img)
            except Exception as e:
                # 下载或打开失败，记录错误并跳过
                logging.error(f"Failed to download/open image from {url}: {e}")
                continue

        # 如果 images 列表为空，返回 None，否则返回图片列表
        return images if images else None

    # =========================
    # 类实例可调用接口
    # 解析 Markdown 文件或二进制文本，提取 sections 和表格
    # =========================
    def __call__(self, filename, binary=None, separate_tables=True):
        # 如果提供了二进制内容，尝试检测编码并解码为文本
        if binary:
            encoding = find_codec(binary)
            txt = binary.decode(encoding, errors="ignore")
        else:
            # 否则直接从文件读取文本
            with open(filename, "r") as f:
                txt = f.read()

        # 调用父类方法或同类方法，提取表格及剩余文本
        remainder, tables = self.extract_tables_and_remainder(f'{txt}\n', separate_tables=separate_tables)

        sections = []  # 用于存储最终的文本分块
        tbls = []      # 用于存储表格块

        # =========================
        # 将剩余文本按换行拆分，并组合成 sections
        # =========================
        for sec in remainder.split("\n"):
            # 如果以 '#' 开头，表示标题行，单独作为一个 section
            if sec.strip().find("#") == 0:
                sections.append((sec, ""))
            # 如果上一段也是标题行，则与当前行合并（标题下可能有内容行）
            elif sections and sections[-1][0].strip().find("#") == 0:
                sec_, _ = sections.pop(-1)
                sections.append((sec_ + "\n" + sec, ""))
            else:
                # 普通行单独作为 section
                sections.append((sec, ""))

        # =========================
        # 将表格转换为 HTML 并存储到 tbls
        # =========================
        for table in tables:
            # markdown(table, extensions=['markdown.extensions.tables']) 将 Markdown 表格渲染为 HTML
            tbls.append(((None, markdown(table, extensions=['markdown.extensions.tables'])), ""))

        # 返回文本 sections 和表格 blocks
        return sections, tbls

```

## 4. Markdown 解析流程
借助于 Markdown 类提供的解析能力，navie.chunk 对  Markdown 的解析代码如下:

```python
    # 如果文件名以 .md 或 .markdown 结尾（不区分大小写），说明是 Markdown 文件
    elif re.search(r"\.(md|markdown)$", filename, re.IGNORECASE):

        # 通知外部回调，当前进度是 0.1，并提示开始解析
        callback(0.1, "Start to parse.")

        # 创建一个 Markdown 解析器对象
        # 其中参数 chunk_token_num 表示分块时的最大 token 数（默认 128）
        markdown_parser = Markdown(int(parser_config.get("chunk_token_num", 128)))

        # 调用解析器解析 Markdown 文件，返回：
        #   sections: 文本内容部分（按标题/段落切分）
        #   tables:   表格部分
        # 参数 separate_tables=False 表示不要把表格单独拆分成独立 section
        sections, tables = markdown_parser(filename, binary, separate_tables=False)

        # 用于存储每个 section 对应的图片（如果有的话）
        section_images = []

        # 遍历所有 section（每个 section 是 (text, placeholder) 的形式）
        for section_text, _ in sections:

            # 如果 section 有内容，则提取其中的图片
            # get_pictures 会解析 markdown 中的 ![](url)，并下载/读取成 PIL.Image
            images = markdown_parser.get_pictures(section_text) if section_text else None

            if images:
                # 如果有多张图，则通过 reduce(concat_img, images) 把它们拼接成一张大图
                # 如果只有一张，直接取第一张
                combined_image = reduce(concat_img, images) if len(images) > 1 else images[0]
                section_images.append(combined_image)
            else:
                # 如果没有图片，则在结果中填 None（保持和 sections 对齐）
                section_images.append(None)

        # 对表格数据进行分词处理：
        #   - tables: 从 markdown 解析出来的表格
        #   - doc: 当前文档的元信息（id、来源等）
        #   - is_english: 是否英文，决定分词时的连接符号
        res = tokenize_table(tables, doc, is_english)

        # 通知外部回调，进度推进到 0.8，并提示解析结束
        # 注意这里不是 1.0，说明还有后续步骤（如向量化/入库）
        callback(0.8, "Finish parsing.")



def tokenize_table(tbls, doc, eng, batch_size=10):
    res = []   # 用于存放最终结果，每个元素是一个处理后的文档片段字典
    
    # 遍历输入的所有表格数据
    # tbls 的元素结构：((img, rows), poss)
    # - img: 可能是表格截图/相关图片（可以为空）
    # - rows: 表格的行数据，可能是字符串，也可能是 list
    # - poss: 表格的位置信息（例如在原始文档中的位置索引）
    for (img, rows), poss in tbls:
        
        # 如果表格没有行数据，跳过
        if not rows:
            continue
        
        # 情况一：表格行数据是字符串
        if isinstance(rows, str):
            d = copy.deepcopy(doc)   # 复制一份 doc（避免修改原始 doc）
            tokenize(d, rows, eng)   # 调用 tokenize 函数对表格文本分词（英语/非英语由 eng 控制）
            d["content_with_weight"] = rows  # 保存原始表格文本到 "content_with_weight"
            
            # 如果有图像，则保存图像信息
            if img:
                d["image"] = img
                d["doc_type_kwd"] = "image"  # 标记文档类型是 image
            
            # 如果有位置信息，则添加位置信息
            if poss:
                add_positions(d, poss)
            
            res.append(d)   # 将处理后的结果加入结果列表
            continue        # 结束当前表格的处理，进入下一个
        
        # 情况二：表格行数据是 list（通常表示多行）
        # de 是行与行之间的分隔符：英文用 "; "，中文或其他用 "； "
        de = "; " if eng else "； "
        
        # 按 batch_size 进行分批，将多行合并成一个字符串进行处理
        for i in range(0, len(rows), batch_size):
            d = copy.deepcopy(doc)   # 再复制一份 doc
            r = de.join(rows[i:i + batch_size])  # 将当前批次的多行拼接成一个字符串
            
            tokenize(d, r, eng)  # 分词处理
            
            # 如果有图片，记录图片信息
            if img:
                d["image"] = img
                d["doc_type_kwd"] = "image"
            
            # 添加位置信息
            add_positions(d, poss)
            
            # 加入结果
            res.append(d)
    
    return res   # 返回所有处理过的表格结果


def tokenize(d, t, eng):
    d["content_with_weight"] = t
    t = re.sub(r"</?(table|td|caption|tr|th)( [^<>]{0,12})?>", " ", t)
    d["content_ltks"] = rag_tokenizer.tokenize(t)
    d["content_sm_ltks"] = rag_tokenizer.fine_grained_tokenize(d["content_ltks"])
```


## 5. 解析完之后的统一处理
经过解析之后，所有类型的文件都会被分为:
- sections: 文档的段落列表，每个段落是一个元组，包含段落文本和段落类型（如标题、段落等）。
- tables: 文档中包含的表格。已经完成分词
- section_images: 文档中每个段落对应的图片列表，每个图片是一个 PIL.Image.Image 对象。

剩下的就是对 section/image 进行 chunk 和分词处理。
1. 如果有 image，执行
    - naive_merge_with_images
    - tokenize_chunks_with_images
2. 没有 images，执行:
    - naive_merge
    - tokenize_chunks

```python
    # ===========================
    # 最终分块与分词
    # ===========================
    st = timer()
    if section_images:
        # 如果所有图片都为 None，则不使用图片增强
        if all(image is None for image in section_images):
            section_images = None

    if section_images:
        # 合并文本和图片生成 chunks
        chunks, images = naive_merge_with_images(
            sections, section_images,
            int(parser_config.get("chunk_token_num", 128)), 
            parser_config.get("delimiter", "\n!?。；！？")
        )
        if kwargs.get("section_only", False):
            return chunks

        res.extend(tokenize_chunks_with_images(chunks, doc, is_english, images))
    else:
        # 只处理文本
        chunks = naive_merge(
            sections, 
            int(parser_config.get("chunk_token_num", 128)), 
            parser_config.get("delimiter", "\n!?。；！？")
        )
        if kwargs.get("section_only", False):
            return chunks

        res.extend(tokenize_chunks(chunks, doc, is_english, pdf_parser))

    logging.info("naive_merge({}): {}".format(filename, timer() - st))
    return res
```
### 5.1 有 image 的处理
#### naive_merge_with_images
naive_merge_with_images 执行流程如下:
1. 循环每一个 section
2. 按分隔符拆分句子
3. 调用 `add_chunk(sub_sec, image)` add_chunk 会按照固定长度合并文本和图片
4. 返回合并后的文本和图片


```python
def naive_merge_with_images(texts, images, chunk_token_num=128, delimiter="\n。；！？"):
    # 如果 texts 为空，或者 texts 和 images 数量不一致，直接返回空结果
    if not texts or len(texts) != len(images):
        return [], []

    # 初始化结果存储：
    cks = [""]              # 保存合并后的文本块（chunks）
    result_images = [None]  # 每个 chunk 对应的一张合并图（可能是 None）
    tk_nums = [0]           # 每个 chunk 的 token 数（用来控制分块大小）

    # 内部函数：往 chunk 里添加一段文本和图片
    def add_chunk(t, image, pos=""):
        nonlocal cks, result_images, tk_nums, delimiter
        tnum = num_tokens_from_string(t)  # 计算文本的 token 数

        # pos 是位置信息（可能是 Markdown section 的标题等）
        if not pos:
            pos = ""
        if tnum < 8:  # 如果 token 太短，就不记录 pos，避免影响内容
            pos = ""

        # 规则1：如果当前 chunk 为空，或者 token 数超过了上限 -> 新开一个 chunk
        if cks[-1] == "" or tk_nums[-1] > chunk_token_num:
            if t.find(pos) < 0:  # 如果文本里没有包含位置信息，就补上
                t += pos
            cks.append(t)        # 新增一个文本块
            result_images.append(image)  # 关联图片
            tk_nums.append(tnum)         # 记录 token 数

        # 规则2：否则，追加到上一个 chunk
        else:
            if cks[-1].find(pos) < 0:
                t += pos
            cks[-1] += t
            if result_images[-1] is None:  # 如果之前没图片，直接赋值
                result_images[-1] = image
            else:  # 如果已有图片，把多张图拼接起来
                result_images[-1] = concat_img(result_images[-1], image)
            tk_nums[-1] += tnum  # 累计 token 数

    # 获取分隔符的正则模式，例如 "\n|。|；|！|？"
    dels = get_delimiters(delimiter)

    # 遍历每一段文本及其对应的图片
    for text, image in zip(texts, images):
        # 如果 text 是一个 tuple，说明带有 (正文, 位置信息)
        if isinstance(text, tuple):
            text_str = text[0]
            text_pos = text[1] if len(text) > 1 else ""

            # 按分隔符拆分句子
            splited_sec = re.split(r"(%s)" % dels, text_str)
            for sub_sec in splited_sec:
                # 如果只是分隔符（纯 "。/！/？"），跳过
                if re.match(f"^{dels}$", sub_sec):
                    continue
                add_chunk(sub_sec, image, text_pos)

        # 否则就是普通字符串
        else:
            # 从这个地方可以看到，从 Markdown 解析出来的 section 在chunk 时不会维持原来的结构
            # 所有内容都是最后都是合并在一起 chunk 的，因为 add_chunk 没有考虑 sections
            splited_sec = re.split(r"(%s)" % dels, text)
            for sub_sec in splited_sec:
                if re.match(f"^{dels}$", sub_sec):
                    continue
                add_chunk(sub_sec, image)

    # 返回结果：分好的文本块 & 每个块对应的合并图
    return cks, result_images

```


#### tokenize_chunks_with_images
对 chunk 进行 tokenize，把 chunk 和 image 合并到一个 doc 中。

```python

def tokenize_chunks_with_images(chunks, doc, eng, images):
    """
    将文本块(chunks)与对应图片(images)合并为文档条目，并对文本进行分词。
    
    参数：
        chunks: 文本块列表，每个元素是已经按 token 数分好的文本字符串
        doc: 当前文档的元信息 dict，例如 {"doc_id": 1, "title": "示例文档"}
        eng: 是否英文，决定 tokenize 分词规则
        images: 对应每个 chunk 的图片列表（PIL.Image 或 None）
    
    返回：
        res: list，包含每个 chunk 的文档条目，每条包含分词结果、图片、位置信息等
    """

    res = []  # 最终存储处理好的文档条目

    # 遍历每个文本块及其对应的图片
    for ii, (ck, image) in enumerate(zip(chunks, images)):
        if len(ck.strip()) == 0:  # 如果文本块为空或仅空格，则跳过
            continue
        logging.debug("-- {}".format(ck))  # 调试输出当前 chunk 文本内容
        d = copy.deepcopy(doc)  # 深拷贝原文档信息，确保每个 chunk 独立
        d["image"] = image  # 给文档条目绑定当前 chunk 对应的图片（可能为 None）
        add_positions(d, [[ii] * 5])  # 添加位置信息，[[ii]*5] 表示当前 chunk 的索引重复5次
        tokenize(d, ck, eng)  # 对 chunk 文本进行 tokenize 分词，结果存入 d
        res.append(d)  # 将处理好的文档条目加入最终结果列表

    return res  # 返回所有处理后的文档条目

```



#### get_delimiters
naive_merge_with_images 用到了一个 get_delimiters 函数，这个函数用于获取分词字符对应的正则表达式，不太好理解，这里简单解释一下。


```python
def get_delimiters(delimiters: str):
    dels = []   # 存放分隔符
    s = 0
```

* `delimiters` 是一个字符串，里面定义了分隔符，比如：
  `"\n。；！？"`  → 换行、句号、分号、感叹号、问号。
* `dels` 用来收集所有分隔符（可能有单个字符，也可能有多字符）。

---

```python
    for m in re.finditer(r"`([^`]+)`", delimiters, re.I):
        f, t = m.span()
        dels.append(m.group(1))
        dels.extend(list(delimiters[s: f]))
        s = t
```

* **正则 `r"`(\[^`]+)`" \`**：匹配 **用反引号括起来的内容**，例如：

  * 输入：``"\n。`||`！？"``
  * 匹配：`` `||` `` → `group(1)` = `"||"`
* 作用：允许用户在 `delimiters` 里定义 **多字符分隔符**，比如 `"||"`、`"--"` 等。
* `dels.append(m.group(1))` → 把多字符分隔符加进去。
* `dels.extend(list(delimiters[s: f]))` → 把当前多字符分隔符前面的字符拆分出来也作为分隔符。
* `s = t` → 更新索引位置。

---

```python
    if s < len(delimiters):
        dels.extend(list(delimiters[s:]))
```

* 如果最后还有剩余的字符（没有被反引号包裹），也要当作分隔符。

---

```python
    dels.sort(key=lambda x: -len(x))
```

* 把分隔符按长度 **从长到短排序**，避免正则匹配时，短分隔符先吃掉长分隔符的一部分。

  * 例如：`["||", "|"]` 必须排成 `["||", "|"]`，否则 `"||"` 会被拆成两个 `"|"`。

---

```python
    dels = [re.escape(d) for d in dels if d]
    dels = [d for d in dels if d]
    dels_pattern = "|".join(dels)
```

* `re.escape(d)`：对特殊符号转义，保证可以安全放进正则里。
* 拼接成 `"分隔符1|分隔符2|..."` 的正则模式，便于 `re.split` 使用。

---

```python
    return dels_pattern
```

* 返回正则模式。


### 5.2 没有 image 的处理

#### naive_merge
naive_merge 处理流程:
1. 遍历每个 section
2. 如果 section 本身小于最大 token， 不用分隔符拆分句子，直接调用 `add_chunk(chunk, pos)`
3. 按分隔符拆分句子，调用 `add_chunk(sub_sec, image)`

navie_merge 有一个特殊的参数 overlapped_percent。用于 **控制相邻 chunks 之间重叠文本的比例**，它的主要作用是 **保证上下文连续性**，尤其在 RAG（检索增强生成）或者大模型输入中很常用。


当你把一篇长文档切分成多个 chunk 时，如果完全不重叠：

```
Chunk 1: 文本第 1 ~ 128 tokens
Chunk 2: 文本第 129 ~ 256 tokens
```

* Chunk 2 开头的信息可能与 Chunk 1 的上下文脱节，LLM 生成或检索时可能丢失前文信息。

使用 `overlapped_percent=20`：

```
Chunk 1: 文本第 1 ~ 128 tokens
Chunk 2: 文本第 103 ~ 230 tokens  （保留前面 25 tokens 与 Chunk 1 重叠）
```

* Chunk 之间有 20% 重叠（128\*20%=25.6 → 取整 25 tokens）
* 模型在处理 Chunk 2 时，还能看到前一个 chunk 的部分上下文。


```python
def naive_merge(
    sections, chunk_token_num=128, delimiter="\n。；！？", overlapped_percent=0
):
    """
    将输入的文本 sections 切分并合并成 chunks，保证每个 chunk 的 token 数不超过阈值，
    并支持 chunk 间的重叠 (overlap)。

    参数：
        sections: list，[(text, pos), ...] 或者 [text, ...]，文本片段及其位置信息
        chunk_token_num: 每个 chunk 最大 token 数（默认 128）
        delimiter: 切分文本时使用的分隔符（默认句号、分号、感叹号、问号等）
        overlapped_percent: 邻接 chunks 的重叠比例，避免上下文丢失（0~100）

    返回：
        cks: list，每个元素是一个合并后的文本 chunk
    """
    
    from deepdoc.parser.pdf_parser import RAGFlowPdfParser  # 用于清理文本中的标签

    if not sections:  # 如果没有输入，直接返回
        return []

    # 如果输入只是纯文本字符串列表，则补充位置为空字符串
    if isinstance(sections[0], type("")):
        sections = [(s, "") for s in sections]

    cks = [""]      # 存放最终合并的 chunk 列表，初始化一个空串
    tk_nums = [0]   # 对应每个 chunk 的 token 数，初始化 0

    # 内部函数：向当前 chunks 中添加新的文本片段
    def add_chunk(t, pos):
        nonlocal cks, tk_nums, delimiter
        tnum = num_tokens_from_string(t)  # 计算文本片段的 token 数

        if not pos:  # 如果没有位置信息，则为空
            pos = ""
        if tnum < 8:  # 如果 token 太少(<8)，则位置标记清空
            pos = ""

        # 条件 1：当前 chunk 为空
        # 条件 2：当前 chunk 的 token 数超过限制（考虑 overlap 后的阈值）
        if (
            cks[-1] == ""
            or tk_nums[-1] > chunk_token_num * (100 - overlapped_percent) / 100.0
        ):
            if cks:  # 如果已经有 chunk，则计算重叠部分
                overlapped = RAGFlowPdfParser.remove_tag(cks[-1])  # 去掉标签，取纯文本
                # 从已有 chunk 的后部分截取 overlap 的比例，拼接到新 chunk 前
                t = (
                    overlapped[
                        int(len(overlapped) * (100 - overlapped_percent) / 100.0) :
                    ]
                    + t
                )
            if t.find(pos) < 0:  # 确保位置信息存在
                t += pos
            cks.append(t)   # 新建一个 chunk
            tk_nums.append(tnum)
        else:
            # 如果当前 chunk 还没超限，则直接拼接到最后一个 chunk
            if cks[-1].find(pos) < 0:
                t += pos
            cks[-1] += t
            tk_nums[-1] += tnum  # 更新 token 数

    # 获取分隔符正则模式（比如 "。|；|！|？"）
    dels = get_delimiters(delimiter)

    # 遍历每个 section
    for sec, pos in sections:
        if num_tokens_from_string(sec) < chunk_token_num:
            # 如果 section 本身小于最大 token 限制，直接作为一个 chunk
            add_chunk(sec, pos)
            continue

        # 否则，按分隔符切分 section
        splited_sec = re.split(r"(%s)" % dels, sec, flags=re.DOTALL)
        for sub_sec in splited_sec:
            # 跳过分隔符本身
            if re.match(f"^{dels}$", sub_sec):
                continue
            # 递归调用 add_chunk
            add_chunk(sub_sec, pos)

    return cks  # 返回最终 chunks

```

#### tokenize_chunks
将 chunk 转换为 doc

```python
def tokenize_chunks(chunks, doc, eng, pdf_parser=None):
    """
    将文本 chunks 转换为文档条目，并对每个 chunk 进行 tokenize。
    与 tokenize_chunks_with_images 类似，但这里可能涉及 PDF 特殊处理。

    参数：
        chunks: list，每个元素是一个文本 chunk
        doc: 文档元信息 dict，如 {"doc_id": 1, "title": "示例文档"}
        eng: 是否英文，用于 tokenize 时选择分词规则
        pdf_parser: 可选，如果提供，则尝试对 chunk 进行 PDF 特有的裁剪和标签处理

    返回：
        res: list，每个元素是处理好的文档条目，包含分词结果、图片/位置等
    """

    res = []  # 最终存储处理好的文档条目

    # 遍历每个 chunk
    for ii, ck in enumerate(chunks):
        if len(ck.strip()) == 0:  # 如果 chunk 为空或仅空格，则跳过
            continue

        logging.debug("-- {}".format(ck))  # 打印调试信息，显示当前 chunk 文本

        d = copy.deepcopy(doc)  # 深拷贝文档元信息，保证每个 chunk 独立

        if pdf_parser:  # 如果提供了 PDF parser
            try:
                # 尝试对 chunk 进行裁剪（crop），返回图片和位置信息
                d["image"], poss = pdf_parser.crop(ck, need_position=True)
                # 将位置信息加入文档条目
                add_positions(d, poss)
                # 去掉 chunk 中可能存在的 HTML/Markdown 标签
                ck = pdf_parser.remove_tag(ck)
            except NotImplementedError:
                # 如果 crop 方法未实现，则忽略，继续处理
                pass
        else:
            # 如果没有 PDF parser，则直接给每个 chunk 添加位置索引
            add_positions(d, [[ii] * 5])

        # 对 chunk 文本进行 tokenize，将分词结果写入文档条目 d
        tokenize(d, ck, eng)

        # 将处理好的文档条目加入最终结果列表
        res.append(d)

    return res  # 返回所有处理后的文档条目
```