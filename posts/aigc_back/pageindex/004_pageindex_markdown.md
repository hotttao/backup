---
weight: 4
title: "PageIndex Markdown：从显式标题构建可控的树索引"
date: 2026-08-21T22:30:00+08:00
lastmod: 2026-08-21T22:30:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "将 PDF 简历转为 Markdown 后，详解 PageIndex 的标题提取、文本切片、树栈、节点瘦身和摘要流程。"
featuredImage:

tags: ["RAG", "PageIndex", "Markdown"]
categories: ["AIGC"]

lightgallery: true
---

Markdown 方式不是直接解析 PDF，而是先将 PDF/OCR/源数据转换为层级清晰的 Markdown，再根据 `#` ~ `######` 建树。

这是两阶段管线：

```text
PDF --(外部转换/OCR/业务数据)--> Markdown --(PageIndex md_to_tree)--> Tree
```

PageIndex 开源代码只实现第二段，并不提供“PDF 自动转 Markdown 再建树”的一体化 CLI。

<!-- more -->

## 1. 为什么要单独讲 Markdown

PDF 中的“标题”是需要推断的视觉语义，Markdown 中的“标题”是显式语法。

对这份简历，Flash 漏掉了四个一级章节。如果从简历源数据生成：

```markdown
# 宋涛

## 教育背景

### 2010-06 ~ 2014-06 东北大学 会计学（本科）

## 专业技能

### 编程能力
### Agent 开发
### 后端开发

## 工作经验

### 2026-06 ~ 至今 Media Agent 自媒体运营智能体

## 代表性项目

### 2023-05 ~ 2025-03 智能空调负荷预测平台
```

树层级就不需要再猜。

## 2. 调用方式

CLI：

```bash
python run_pageindex.py \
  --md_path resume.md \
  --if-add-node-id yes \
  --if-add-node-text yes
```

Python：

```python
import asyncio
from pageindex.page_index_md import md_to_tree

tree = asyncio.run(md_to_tree(
    md_path="resume.md",
    if_thinning=False,
    if_add_node_summary="no",
    if_add_node_text="yes",
    if_add_node_id="yes",
))
```

注意：`PageIndexClient.submit_document()` 的本地模式只接受 PDF。Markdown 目前主要通过 `run_pageindex.py --md_path` 或直接调 `md_to_tree()` 使用，不会自动进入 `.pageindex` 文档库。

## 3. 标题提取规则

`extract_nodes_from_markdown()` 逐行扫描，识别两种标题。

### 3.1 ATX 标题

```regex
^(#{1,6})\s+(.+)$
```

`#` 的数量就是 `level`。

### 3.2 独占一行的粗体

```regex
^\*\*(.+?)\*\*\s*$
```

它会被当成一级标题。这是一个有侵入性的兼容规则：如果原文用独立粗体表示提醒而非标题，树会多出顶层节点。

### 3.3 代码块保护

扫描器在遇到 `` ``` `` 时切换 `in_code_block`。代码块里的 `# comment` 或 `**value**` 不会被当成标题。

它目前不处理：

- Setext 标题（下划线形式）。
- HTML `<h1>` 标题。
- `~~~` 围栏代码块。
- 不规范或未闭合的 fenced code block。

## 4. 标题与自有文本的切分

每个标题先记录：

```json
{
  "node_title": "工作经验",
  "line_num": 25,
  "level": 2
}
```

`extract_node_text_content()` 把当前标题行到下一个任意标题前的文本作为该节点的“自有文本”。

例如：

```markdown
## 专业技能

以下为候选人的主要技能。

### 编程能力

精通 Python 和 Go。
```

则：

- `专业技能.text` 只包含标题和“以下为...”。
- `编程能力.text` 包含子标题和“精通 Python 和 Go”。

父节点的 `text` 默认不会重复包含子节点文本。只在计算 subtree token 或 thinning 时临时聚合后代内容。

## 5. 用栈构建树

`build_tree_from_nodes()` 从上到下遍历标题，维护 `(node, level)` 栈。

当新标题的 level 为 `L`：

1. 不断弹出栈顶，直到栈顶 level 小于 `L`。
2. 如果栈已空，新节点是根节点。
3. 否则新节点挂到栈顶节点下。
4. 把新节点入栈。

例如层级 `1 -> 2 -> 3 -> 2 -> 3`：

```text
# 宋涛
├── ## 教育背景
│   └── ### 东北大学
└── ## 工作经验
    └── ### Media Agent
```

如果 Markdown 从 `###` 直接跳到 `#####`，算法不会补一个虚构的 `####` 节点；`#####` 直接成为当前 `###` 的子节点。

## 6. 节点 ID 的两次分配

`build_tree_from_nodes()` 创建节点时先按文档顺序写入 `0001`、`0002`...。之后如果 `if_add_node_id == "yes"`，又调用 `write_node_id()` 做深度优先重编号。

当前树的构建顺序和深度优先顺序通常一致，所以实际结果稳定。但这也说明 `node_id` 是内部位置 ID，不应被当作持久业务 ID。

## 7. Tree Thinning：小子树合并

Markdown 可以开启：

```bash
--if-thinning yes --thinning-threshold 5000
```

算法分两步。

### 7.1 计算子树 token

从后向前处理每个节点，将它的自有文本与所有后代的自有文本拼接，计算 `text_token_count`。

### 7.2 合并太小的子树

如果子树总 token 少于阈值：

- 把所有后代的自有文本拼到当前节点。
- 从节点列表删掉这些后代。
- 当前节点变成叶子。

这里要注意：thinning 不是只合并“直接子节点”，而是合并整个后代集合。对简历这种整份文档可能都不到 5000 tokens 的输入，默认阈值很可能把整棵树瘦身成根节点，因此不应开启或应大幅调低阈值。

## 8. Markdown 摘要

开启：

```bash
--if-add-node-summary yes --summary-token-threshold 200
```

每个节点只根据自有 `text` 生成摘要：

- 少于 200 tokens：直接复用原文，不调模型。
- 大于等于 200 tokens：调用 `generate_node_summary()`。
- 叶子写入 `summary`。
- 有子节点的父节点写入 `prefix_summary`。

`prefix_summary` 只摘要父节点在第一个子标题之前的引言，不表示整个子树。这与 Flash 新摘要管线的“父摘要覆盖整个子树”不同。

## 9. 简历 Markdown 实跑结果

使用一份带 `# / ## / ###` 的 48 行简历 Markdown，不启用 thinning 和 summary，实际结果是：

```text
宋涛 [0001]
├── 教育背景 [0002]
│   └── 2010-06 ~ 2014-06 东北大学 会计学（本科）[0003]
├── 专业技能 [0004]
│   ├── 编程能力 [0005]
│   ├── Agent 开发 [0006]
│   └── 后端开发 [0007]
├── 工作经验 [0008]
│   ├── Media Agent 自媒体运营智能体 [0009]
│   └── 北京志翔科技 高级 Python 开发工程师 [0010]
└── 代表性项目 [0011]
    ├── 智能空调负荷预测平台 [0012]
    ├── 运维部署平台 [0013]
    └── 窃电大数据应用 [0014]
```

与 Flash 的真实输出相比，Markdown 方式正确保留了四个核心一级分类和各自的子类。原因不是 Markdown 算法更“聪明”，而是结构信息已经在上游被人或转换器显式编码了。

## 10. Markdown 索引没有页码

PDF 树使用 `start_index/end_index`，Markdown 树使用 `line_num`。这会影响检索集成：

- PDF Agent 工具天然按页读取。
- Markdown 树需要一个按节点、行号或原文范围读取的工具。
- 当前 Local `PageIndexClient` 存储和 `get_page_content()` 是 PDF 页模型，不能不加改造地将 Markdown CLI 结果接入同一套问答 Agent。

如果要在自己的 RAG 中使用 Markdown 树，可以将工具改为：

```text
get_document_structure(doc_id)
get_node_content(doc_id, node_id)
get_line_content(doc_id, start_line, end_line)
```

这也是为什么 README 将 Markdown 放在 CLI 的“生成结构”范畴，而 Quickstart 的端到端 Client 只接 PDF。

## 11. 如何为简历生成高质量 Markdown

优先级从高到低：

1. 从简历的结构化源数据生成，例如 JSON/JS 中的教育、技能、工作和项目数组。
2. 从语义良好的 HTML 标题和 section 转换。
3. 使用版式感知 PDF-to-Markdown/OCR，再做标题校对。
4. 最后才是纯文本提取后让 LLM 重写 Markdown 结构。

要特别验证：

- 一级分类不能丢失。
- 日期 + 公司/项目名不要被拆成多个标题。
- 列表项不要误转为标题。
- 页头、页脚和重复姓名要去重。
- 如果后续需要 PDF 引用，要在转换时保留 page marker，不能只剩行号。

## 12. 何时选 Markdown

适合：

- 文档原本就是 Markdown。
- 业务系统有结构化源数据，可以稳定生成 Markdown。
- 需要人工编辑、审查和修正树结构。
- PDF 视觉结构复杂，Flash 错误较多。

不适合：

- 只有海量 PDF，没有稳定的高质量 PDF-to-Markdown 管线。
- 必须保留 PDF 精确页码和行级引用，但转换器没有保留定位映射。
- 想直接使用当前 `PageIndexClient.chat()` 的 PDF 页级工具，不准备自己写适配层。

## 13. 源码导读

- `run_pageindex.py`：`--md_path` CLI 入口。
- `pageindex/page_index_md.py::extract_nodes_from_markdown()`：标题语法。
- `extract_node_text_content()`：自有文本切分。
- `update_node_list_with_text_token_count()`：子树 token 计算。
- `tree_thinning_for_index()`：小子树合并。
- `build_tree_from_nodes()`：栈式建树。
- `generate_summaries_for_structure_md()`：`summary/prefix_summary` 生成。

