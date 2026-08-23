---
weight: 3
title: "PageIndex Standard：用 LLM 从 PDF 全文生成树索引"
date: 2026-08-21T22:20:00+08:00
lastmod: 2026-08-21T22:20:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "详解 PageIndex Standard/Classic 如何检测目录、对齐物理页码、校验与修复节点，以及无目录简历的处理路径。"
featuredImage:

tags: ["RAG", "PageIndex", "LLM"]
categories: ["AIGC"]

lightgallery: true
---

Standard（源码文件名为 `page_index_classic.py`）不依赖 PDF 标题样式建树。它先按页提取文本，再让 LLM 识别目录、章节层级和节点的物理起始页。

<!-- more -->

## 1. 怎样调用

SDK：

```python
doc_id = client.submit_document(
    "宋涛-AI全栈开发-简历.pdf",
    mode="standard",
)["doc_id"]
```

CLI：

```bash
python run_pageindex.py \
  --mode standard \
  --pdf_path "宋涛-AI全栈开发-简历.pdf" \
  --index-model gpt-5.6-luna
```

本地 SDK 的 Standard 固定开启：

- `if_add_node_id="yes"`
- `if_add_node_summary="yes"`
- `if_add_node_text="yes"`
- `if_add_doc_description="yes"`

完成后存储时再移除 tree 中的 `text`，原文单独存在 `pages.json`。

## 2. Standard 与 Flash 的分工差异

| 环节 | Flash | Standard |
|---|---|---|
| PDF 文本 | PDFium 字符级解析 | Local SDK 先用 PyPDF2 提每页文本 |
| 标题发现 | 版式统计和启发式 | LLM 读目录或全文 |
| 页码对齐 | 标题 Block 所在物理页 | LLM 在 `<physical_index_n>` 标记中找起始页 |
| 校验 | 几何与结构规则 | LLM 再检查标题是否真在目标页出现 |
| 成本 | 初始树便宜 | 索引阶段会发生多次 LLM 调用 |

Standard 的优势是模型能理解“教育背景”、“工作经验”这种语义标题，不只依赖字号、字体和留白。代价是延迟、成本和不确定性都更高。

## 3. 页文本和物理页标签

Local SDK 先用 PyPDF2 得到：

```python
page_list = [
    (page_1_text, page_1_token_count),
    (page_2_text, page_2_token_count),
]
```

进入 LLM prompt 前，每页被包裹为：

```text
<physical_index_1>
宋涛
求职意向：AI Agent 应用开发工程师
...
<physical_index_1>

<physical_index_2>
2016-04 ~ 2019-02 云合数据 Python 工程师
...
<physical_index_2>
```

这些标记不是 PDF 原文，而是 PageIndex 人工加入的定位锚点。LLM 返回的 `physical_index` 必须来自当前 prompt 真实包含的 marker，不允许引用其他分组中的页码。

## 4. 第一步：前 20 页逐页检测目录

`toc_check_page_num` 默认为 20。`find_toc_pages()` 从第 1 页开始，对每页调用 LLM，要求返回：

```json
{
  "thinking": "...",
  "toc_detected": "yes"
}
```

它特别提示：摘要、符号表、图表清单等不是目录。

如果已经找到连续的目录页，遇到第一个非目录页就停止。如果前 20 页都没有目录，走“无目录”分支。

这份简历显然没有传统目录，所以预期路径是 `process_no_toc`。

## 5. 有目录且带页码的分支

对长报告，目录常使用文档内部页码，而 PDF 物理页前面可能有封面和前言。Standard 用两类页码做偏移对齐：

1. `toc_transformer()` 把目录变成 `{structure, title, page}` 的扁平 JSON。
2. 删掉其中的逻辑 `page`，将目录标题和主文一起交给 `toc_index_extractor()`。
3. LLM 找出若干目录标题对应的 `<physical_index_n>`。
4. 对每个匹配计算 `physical_index - page`。
5. 取出现次数最多的差值作为 offset。
6. 把偏移加到整个目录的逻辑页码上。
7. 对没有页码的个别节点，只在前后已知页码之间重新定位。

例如目录中“第 1 章”是第 1 页，但它实际位于 PDF 第 5 页，offset 就是 4。

## 6. 有目录但无页码的分支

1. LLM 先把目录文本转换为层级 JSON。
2. 全文按大约 20,000 tokens 分组，默认与前一组重叠 1 页。
3. 对每组询问“这些章节是否在当前文本开始”。
4. 只接受当前组真实包含的物理页 marker。
5. 不允许 LLM 更改目录条目数、标题或顺序。

分组的目的是控制上下文长度，一页重叠用于防止章节边界落在两组之间。

## 7. 无目录分支：简历会怎样处理

这是本例最关键的路径。

### 7.1 分组

简历只有 2 页，总 token 数远低于 20,000，因此会被作为一组交给 LLM。

### 7.2 初次生成

`generate_toc_init()` 要求 LLM 返回：

```json
[
  {
    "structure": "1",
    "title": "教育背景",
    "physical_index": "<physical_index_1>"
  },
  {
    "structure": "2",
    "title": "专业技能",
    "physical_index": "<physical_index_1>"
  },
  {
    "structure": "3",
    "title": "工作经验",
    "physical_index": "<physical_index_1>"
  },
  {
    "structure": "4",
    "title": "代表性项目",
    "physical_index": "<physical_index_2>"
  }
]
```

上面是根据原文展示“理想的数据形状”，不是本次实验的真实 LLM 返回值。

### 7.3 续写

长文档有多组时，后续每组使用 `generate_toc_continue()`，传入旧树和当前文本，只要求返回新增节点。

### 7.4 标记验证

模型如果在第 1 组中返回 `<physical_index_200>`，会被 `_validate_chunk_physical_indices()` 立即置为 `None`。之后还要检查整个 PDF 的页码上下界。

## 8. 校验、修复与降级

Standard 不盲信第一次生成的树。

### 8.1 逐标题验证

`verify_toc()` 对每个节点询问 LLM：该标题是否真的在指定页出现。

- 正确率 100%：直接接受。
- 正确率高于 60% 且有错项：定向修复，最多 3 轮。
- 正确率不足 60%：放弃当前路径，降级到更弱的假设。

### 8.2 定向修复

对一个错位节点，先找它前后最近的正确节点，只把这个缩小页码范围交给 LLM 重新定位，然后再验证一次。

### 8.3 降级链

```text
有目录 + 目录页码对齐
    失败
      ↓
保留目录结构，从正文重新找起始页
    失败
      ↓
忽略目录，直接从全文生成树
    失败
      ↓
报错
```

这条链体现了 Standard 的思路：优先利用文档已有结构，但当目录不完整、页码错乱或模型判断不稳定时，不让错误继续传播。

## 9. 扁平目录怎样变成树

LLM 先产生扁平列表：

```json
[
  {"structure": "1", "title": "工作经验", "physical_index": 1},
  {"structure": "1.1", "title": "Media Agent", "physical_index": 1},
  {"structure": "1.2", "title": "北京志翔科技", "physical_index": 1},
  {"structure": "2", "title": "代表性项目", "physical_index": 2}
]
```

`post_processing()` 先将 `physical_index` 转为 `start_index`，再根据下一节起始页计算 `end_index`，最后按 `structure` 中的点号层级转成嵌套树。

它还检查标题是否一开始就出现在起始页，以决定前一节的结束页是 `next_start - 1` 还是与下一节共享该页。

## 10. 超大节点的递归拆分

默认配置：

```yaml
max_page_num_each_node: 10
max_token_num_each_node: 20000
```

当节点同时超过页数与 token 阈值时，Standard 把该节点覆盖的页面当作一份局部“无目录文档”，再跑一次建树。子节点仍太大时继续递归。

这使得 Standard 不会把一个 100 页章节永久留为一个叶子。

## 11. 节点 ID、原文、摘要和文档描述

树骨架稳定后：

1. `merge_tree()` 用确定性成本函数删掉不划算的子树。
2. `write_node_id()` 深度优先分配 `0000`、`0001`...。
3. `add_node_text()` 按页码范围把原文加到每个节点。
4. `generate_summaries_for_structure()` 并发对所有节点生成摘要。
5. 将不含大段原文的干净树交给 LLM，生成文档级 description。

注意 Standard 的旧摘要实现与 Flash 的 `summarize_tree()` 不同：Standard 是直接对每个节点覆盖的原文并发写摘要；Flash 新路径是自底向上复用子摘要。

## 12. 安全与输出验证

文档原文可能包含“忽略上述指令”等 prompt injection。Standard 在多个 prompt 前加入系统强化，并把文档内容包装为不可信数据。

它还对 LLM 输出做多层验证：

- JSON 提取和类型转换。
- `physical_index` 必须是真实 marker。
- 页码不得超出 PDF。
- 目录条目数、标题和顺序不得在定位阶段被篡改。
- 标题实际出现位置要再校验。

## 13. 对简历示例的预期与限制

没有 API Key，本次不能提供这份简历的 Standard 真实树。但从调用链可以确定：

- 它会走无目录分支。
- 两页会作为一个文本组交给模型。
- 模型有机会利用“01/教育背景”、“04/代表性项目”的语义恢复四个一级节点，这正是 Flash 的薄弱处。
- 但它仍可能误判简历中的日期行、“技术栈”和“项目描述”层级；结果取决于模型、提供商与当次采样。

Standard 更像一个“带验证和降级的 LLM 文档结构编译器”，不是单次 prompt 转 JSON。

## 14. 何时用 Standard

适合：

- Flash 返回空树。
- 标题主要依赖内容语义，而非稳定版式。
- PDF 的目录与实际页码有复杂偏移。
- 对索引质量的要求高于对建库成本和速度的要求。

不适合：

- 没有可提取文本的扫描 PDF；本地 Standard 没有 OCR。
- 需要严格可重现的零 LLM 建树。
- 大量文档、成本预算非常敏感，且 Flash 结构已经足够好。

## 15. 源码导读

- `pageindex/local_api.py::_index_standard()`：Local SDK 入口和强制配置。
- `pageindex/page_index_classic.py::tree_parser()`：主分支。
- `check_toc()` / `find_toc_pages()`：目录检测。
- `process_toc_with_page_numbers()`：目录页码偏移。
- `process_toc_no_page_numbers()`：有结构、无定位。
- `process_no_toc()`：从全文生成树。
- `verify_toc()` / `fix_incorrect_toc_with_retries()`：校验和修复。
- `process_large_node_recursively()`：大节点递归拆分。

