---
weight: 2
title: "PageIndex Flash：基于 PDF 版式统计的启发式建树"
date: 2026-08-21T22:10:00+08:00
lastmod: 2026-08-21T22:10:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "实跑 PageIndex Flash 的 raw、merge 索引，详解字符级 PDF 解析、标题检测、树装配、成本优化与摘要。"
featuredImage:

tags: ["RAG", "PageIndex", "PDF"]
categories: ["AIGC"]

lightgallery: true
---

PageIndex Flash 的“Flash”不是全程不使用 LLM。准确说，它用确定性 PDF 版式管线生成初始树，再可选地用 LLM 拆分过大节点、为节点写摘要和文档描述。

<!-- more -->

## 1. 三种 Flash 运行档位

### 1.1 Raw：完全不用 LLM

```python
from pageindex.flash import page_index_flash

tree = page_index_flash(
    "宋涛-AI全栈开发-简历.pdf",
    summary=False,
    optimize=False,
)
```

CLI：

```bash
python run_pageindex.py \
  --mode flash \
  --pdf_path "宋涛-AI全栈开发-简历.pdf" \
  --no-summary \
  --optimize off
```

### 1.2 Merge：纯确定性搜索成本优化

```python
tree = page_index_flash(
    "宋涛-AI全栈开发-简历.pdf",
    summary=False,
    optimize="merge",
)
```

### 1.3 Full：当前默认

```python
tree = page_index_flash(
    "宋涛-AI全栈开发-简历.pdf",
    summary=True,
    optimize="full",
    optimize_model="gpt-5.6-luna",
    summary_model="gpt-5.6-luna",
)
```

Full 的顺序是：

```text
启发式初始树
  -> deterministic merge
  -> LLM expand
  -> 重新编号
  -> 自底向上 summary
```

摘要放在 optimize 之后，因为摘要应当描述最终的树，而不是随后会被合并或拆分的临时节点。

## 2. 入口验证

`page_index_flash()` 先检查：

1. 输入只能是 PDF 文件路径、`pathlib.Path` 或 `io.BytesIO`。
2. 文件头必须是 `%PDF-`。
3. PDFium 必须能打开文档，且至少有一页。
4. 加密或需要密码的 PDF 转成明确的 `ValueError`。

然后进入 `extract_toc()`。这个函数是 Flash 的主管线。

## 3. 第一阶段：PDF 字符级解析

Flash 不是简单调用 `page.extract_text()`。它用 `pypdfium2` 和自己的 char-level parser 读取：

- 字符和 glyph。
- 字体、Unicode/CMap 映射。
- 每个字符的几何框。
- 页面 viewport、MediaBox/CropBox 和 `/Rotate`。
- 文本内容流与显示坐标的关系。

页面会先转成一组平铺 `Span`，每页可并行解析。之后才是从几何坐标恢复阅读顺序。

## 4. 第二阶段：Span -> Line -> Block

每页经过两次行聚类：

1. 首次用较宽松的容差 `0.75` 恢复初始文本行。
2. 统计页面字体、字号、对齐和文本分布。
3. 检测分栏与 gutter，得到栏的 x 范围。
4. 用栏信息和更严格的容差 `0.5` 重新聚类。
5. 识别并移除论文中常见的行号栏。
6. 对清理后的行重新计算页面统计。
7. 把相邻文本行聚成 `Block`，按栏、纵坐标和横坐标生成阅读顺序。

这一步解决的是“先读左栏还是右栏”、“两行是一个段落还是两个区块”，不是章节层级。

## 5. 第三阶段：文档级版式统计

只看单页很难区分页眉和标题。Flash 会聚合全文档统计，比较：

- 字号与字体样式的频率。
- 文本在页顶、页底的重复情况。
- 正文主导样式。
- 页面是否有足够实质文本。
- 文档主要书写系统与字符类型。

如果文档过短、文本过少、字符系统不支持，或大部分是横向/空白页，Flash 不会硬造一棵树，而是返回空 `structure`。但如果 PDF 有可信的书签，仍可以用书签恢复结构。

## 6. 第四阶段：排除非标题内容

在找标题前，Flash 先给 Block 分类：

- 重复页眉和页脚。
- 水印。
- 目录页和模板化 boilerplate。
- 正文段落。
- 图表 caption 和其内容区域。
- 文档标题及后续页重复的 title echo。

顺序是加载的：标题检测依赖前面的正文样式、页眉、caption 和文档标题标记。

## 7. 第五阶段：标题候选与层级推断

标题不是只看“字号更大”。Flash 组合多类信号：

- 字号、粗体、字体等样式与正文的差异。
- 居中、左对齐和垂直留白。
- 是否位于页顶或新段落起点。
- `1`、`1.2`、`A.`、`Chapter 3` 等编号模式。
- 同一标题样式是否在文档中反复出现。
- 相邻候选是否构成一个自洽的样式 clique。
- 字符系统、句子长度和标点，用于排除把正文句子当成标题。

候选经过筛选后，通过层级栈装配成 `OutlineNode`。标题深度主要由样式关系、编号关系和文档顺序共同决定。

## 8. 第六阶段：树有效性门禁

树组装完之后不会立即输出。管线还会检查：

- 结构化章节是否覆盖足够的文档范围。
- 标题之间是否出现过大的页码空洞。
- 检测出的“章节”是否过于稀疏，以至不值得作为索引。
- 目录是否可能只由表格标签或显著标题组成。

不通过时返回空树，而不是保留一棵高度可疑的树。

## 9. 书签与检测结构的融合

`use_embedded_toc=True` 时，Flash 会评估 PDF bookmarks：

- 层次深且可信：把书签当作主骨架，把缺失的检测节点嫁接回去。
- 只有粗粒度章节：把书签当章框架，把检测标题挂到对应章下。
- 稀疏或乱码：只在页文本可验证时补全/修复。
- 垃圾书签：忽略，使用纯检测结构。

本例输出为 `toc_source: "detected"`，表明最终使用的是版式检测结构。

## 10. 简历 Raw 实跑结果

实际运行 raw 管线后，核心结果是：

```json
{
  "doc_title": "2010-06 ~ 2014-06 东北大学 会计学（本科）",
  "structure": [
    {
      "title": "2021-10 ~ 2025-03 北京志翔科技 高级 Python 开发工程师",
      "node_id": "0000",
      "start_index": 1,
      "end_index": 1
    },
    {
      "title": "2016-04 ~ 2019-02 云合数据 Python 工程师",
      "node_id": "0001",
      "start_index": 2,
      "end_index": 2
    },
    {
      "title": "2023-05 ~ 2025-03 智能空调负荷预测平台 平台架构负责人",
      "node_id": "0004",
      "start_index": 2,
      "end_index": 2
    }
  ],
  "toc_source": "detected"
}
```

原始树共 7 个顶层节点：第 1 页 1 个，第 2 页 6 个。结果不理想：

1. 把“东北大学 会计学（本科）”当成文档标题，没有识别页首的姓名“宋涛”。
2. 漏掉“教育背景/专业技能/工作经验/代表性项目”这四个真正的一级标题。
3. 漏掉第 1 页的 Media Agent、百度、窃电大数据等多个工作经历标题。
4. 第 2 页中，工作经历和代表性项目被放在同一层级。

这不是 Unicode 文本提取失败：PDFium 可以正确提取中文。问题发生在“从版式信号推断文档结构”。

这份简历的一级标题字号不大，颜色偏灰绿，而公司/项目行更粗、更长、视觉显著。人能利用水平线、编号、颜色和整体设计理解层级，启发式检测器则对字体样式重复性、字号和正文关系更敏感。

## 11. Merge 的搜索成本模型

Flash 的优化目标不是让树“看起来更漂亮”，而是降低最坏检索成本。

对节点 `v`：

```text
S(v) = subtree_end(v) - start(v) + 1
```

`S(v)` 表示不使用子树、线性扫描该节点时需读的页数。每路由一层的成本 `R=1` 页。

```text
tree_cost(v) = S(v)                                      # 叶子
tree_cost(v) = R + max(residual(v), tree_cost(child_i)) # 非叶子
```

当：

```text
S(v) <= tree_cost(v)
```

说明继续维护子树并不比直接扫页更便宜，就删除子节点。被删除的标题放入父节点 `key_items`，避免丢掉路由线索。

另外，页级检索无法区分页码范围完全相同的多个叶子。`merge_same_page()` 会优先合并这些同页兄弟。

## 12. 简历 Merge 实跑结果

本例的优化统计：

```json
{
  "merges": 0,
  "expands": 0,
  "same_page_merges": 1,
  "same_page_dropped": 5,
  "before": {
    "frontier_nodes": 7,
    "worst_case_search_complexity": 2,
    "average_search_complexity": 7.0
  },
  "after": {
    "frontier_nodes": 2,
    "worst_case_search_complexity": 2,
    "average_search_complexity": 2.0
  }
}
```

第 2 页的 6 个叶子完全覆盖同一页，因此合并成：

```json
{
  "title": "2016-04 ...; 2015-05 ...; 2014-06 ...; 2023-05 ...; 2021-11 ...; 2019-03 ...",
  "start_index": 2,
  "end_index": 2,
  "key_items": [
    "2016-04 ~ 2019-02 云合数据 Python 工程师",
    "2015-05 ~ 2016-02 星图数据 数据运营",
    "2014-06 ~ 2014-12 PICC 广州 总账会计师",
    "2023-05 ~ 2025-03 智能空调负荷预测平台",
    "2021-11 ~ 2022-11 运维部署平台",
    "2019-03 ~ 2021-06 窃电大数据应用"
  ]
}
```

`average_search_complexity` 从 7.0 降到 2.0，但这不代表结构语义变准了。它只说明：对页级读取而言，在同一页保留 6 个独立叶子是冗余的。

## 13. LLM Expand 怎样决定是否拆分

Full optimize 只考察大于 5 页的折叠节点。本例每个节点最多 1 页，因此即使有 API Key，expand 也不会运行。

对长节点，expand 会：

1. 把节点页面以 `<page_n>...</page_n>` 交给 LLM，每页最多 6000 字符。
2. 要求只返回页面上真实印刷的子标题和起始页，不得改写或发明标题。
3. 校验页码范围、顺序、重复标题，并确认标题文本确实出现在目标页。
4. 同时考察启发式缓存候选和 LLM 候选，计算各自的拆分成本。
5. 只有 `expand_cost < S(v)` 且达到最低收益率时，才真正写入子节点；平局时保持折叠。

```text
expand_cost = R + max(residual_pages, max(child_span))
```

所以 expand 不是“LLM 说有标题就拆”，而是“LLM 提案 + 文本验证 + 成本函数决策”。

## 14. 摘要为什么是自底向上

Flash 的 `summarize_tree()` 先处理叶子，再处理父节点。

### 14.1 叶子

- 读 `start_index..end_index` 原文。
- 少于 200 tokens 时，直接把原文当摘要，不调模型。
- 较长时，要求 LLM 返回 `points` 和 `summary`。
- 如果是同页合并节点，可顺便把过长的并集标题改写为最多 12 个英文单词的短标题。

### 14.2 父节点

父节点不重新把整个子树原文交给模型，而是传入：

- 节点标题。
- 父节点开头但尚未被第一个子节点覆盖的页面，最多 3 页。
- 各子节点的标题和已有摘要。

这就是一种层次式压缩：叶子把原文压缩成摘要，父节点再把子摘要压缩成更高层语义。

## 15. 对这份简历的结论

Flash 在这个样本上的优点是快、可离线、能稳定给出页码，但结构准确性不足。它特别适合标题样式稳定、篇幅较长的论文、财报和教科书，不一定适合高度设计化的短简历。

对本例，更合理的处理是：

1. 小文档问答直接读 1-2 页，不依赖错误的 Flash 树。
2. 如果必须有结构，使用 Standard，让 LLM 从文本内容推断层级。
3. 更稳定的方案是从简历源数据生成 Markdown，直接使用 Markdown 标题建树。

## 16. 源码导读

- `pageindex/flash/api.py`：Flash 对外入口。
- `pageindex/flash/main.py`：12 步管线编排。
- `pageindex/flash/parser_pdfium_charlevel/`：PDF 字符级解析。
- `pageindex/flash/phases/page_view.py`：每页的行聚类、分栏和阅读顺序。
- `pageindex/flash/heading_detection/`：标题候选。
- `pageindex/flash/outline_assembly/`：层级装配与质量门禁。
- `pageindex/tree_optimize.py`：merge/expand 成本模型。
- `pageindex/utils.py`：`summarize_tree()` 自底向上摘要。
