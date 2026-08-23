---
weight: 7
title: "从第一性原理理解生产级 PDF RAG：为什么需要多解析器、质量门禁与降级检索"
date: 2026-08-21T23:10:00+08:00
lastmod: 2026-08-21T23:10:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "不从具体框架出发，而从 PDF 的信息本质、RAG 的目标和不确定性约束出发，逐步推导统一文档 IR、多解析器、多候选树、质量门禁及混合检索为什么是必要的。"
featuredImage:

tags: ["RAG", "PageIndex", "PDF", "第一性原理", "架构设计"]
categories: ["AIGC"]

lightgallery: true
---

生产级 PDF RAG 的根本问题不是“选择哪个 PDF 转 Markdown 工具”，而是：**怎样在不知道文档来源、版式和质量的情况下，以可控成本恢复足以回答问题的证据，并且知道恢复结果是否可信。**

从这个目标出发，可以自然推导出多解析器、Canonical Document IR、多候选树、质量门禁、降级发布和混合检索。它们不是为了让系统显得复杂，而是分别对应 PDF RAG 中无法消除的几类不确定性。

<!-- more -->

## 1. 先把框架名称全部拿掉

暂时忘掉 PageIndex、Docling、MinerU、OCR、向量数据库和 Markdown，只保留三个对象：

```text
原始文档 D  ──解析──>  机器观察 O  ──建模──>  可检索结构 Z
                                              │
用户问题 Q  ──────────────────────────────────┘
                         │
                         ▼
                      证据 E
```

- `D`：用户上传的原始 PDF，是最终事实来源。
- `O`：程序从 PDF 中观察到的文字、坐标、字体、图片、线条和阅读顺序。
- `Z`：根据观察推断出的章节、标题、表格、段落和目录树。
- `Q`：用户问题。
- `E`：能够支持答案的原始证据。

RAG 真正要优化的不是 `O` 或 `Z` 看起来多漂亮，而是：

```text
在延迟、成本和上下文长度约束下，尽可能找到支持问题 Q 的正确证据 E。
```

可以把它简化为一个效用函数：

```text
Utility = EvidenceRecall × EvidencePrecision × Traceability
          - LatencyCost - ComputeCost - FailureRisk
```

这里已经出现了第一个重要结论：

> Markdown、目录树和向量都只是寻找证据的中间工具，不是最终目标，更不是事实来源。

## 2. 第一条基本事实：PDF 保存的是“怎样画”，不是“这是什么”

HTML 中有 `h1`、`p`、`table`；Markdown 中有 `#` 和列表；但大多数 PDF 页面本质上更接近一组绘图命令：

```text
在 (x1, y1) 位置使用 18px 黑体画“项目经历”
在 (x2, y2) 位置使用 10px 字体画一段项目描述
在页面右侧放置一张图片
从 (x3, y3) 到 (x4, y4) 画一条线
```

“18px 黑体”可能意味着一级标题，也可能只是封面大字；“两行文字横向接近”可能属于同一个段落，也可能是表格的两个单元格。PDF 通常没有义务告诉解析器它们的业务含义。

因此，从 PDF 到标题、段落和表格不是无损反序列化，而是一次推断：

```text
视觉绘制指令 + 字符流
        │
        ▼
对阅读顺序和语义角色的假设
```

这解释了为什么不存在对所有 PDF 都正确的单一解析器。不同解析器实际上编码了不同的先验假设：

- 原生文本解析器相信 PDF 的字符流和内部顺序基本正确。
- 版面解析器相信空间位置、字号和视觉区域更可靠。
- OCR 相信页面像素比损坏的字符编码更可靠。
- VLM 相信模型能够从整页视觉关系中恢复语义。
- Markdown 解析器相信上游已经正确写出了标题标记。

当输入文档满足某个假设时，对应解析器表现很好；假设不成立时，它就会稳定地产生错误，而不是随机偶尔出错。

由此推导出：**解析策略必须根据文档证据选择，不能在系统配置里永久固定。**

## 3. 第二条基本事实：同一份 PDF 内部也可能不是同一种文档

一份 200 页报告可能同时包含：

- 1～30 页原生文本；
- 31 页扫描的盖章页；
- 32～80 页双栏正文；
- 81 页横向大表；
- 82～150 页原生文本；
- 151～200 页扫描附件。

如果以整个文件为单位决定“使用 OCR”或者“不使用 OCR”，就会产生两个极端：

- 全文 OCR：成本高，而且可能把本来正确的原生文字识别错。
- 全文原生提取：扫描页完全没有文字，证据永久丢失。

因此，最小合理决策单元通常不是文档，而是页面；对于表格、图片和混合页面，还可能进一步细化到区域。

这可以表示为：

```text
route(page_i) = argmax_parser ExpectedQuality(parser, features_i)
```

其中 `features_i` 可以包含：

- 原生字符数量和覆盖面积；
- 字符编码异常率；
- 图片覆盖率；
- 字体数量和字号分布；
- 多栏可能性；
- 页面旋转角度；
- 表格和公式密度；
- 原生文本与 OCR 文本的一致度。

这就是 Preflight 和页面级路由的底层依据：**先用便宜的观测减少不确定性，再决定是否支付昂贵的解析成本。**

## 4. 第三条基本事实：解析结果是“带置信度的观察”，不是事实

假设一个 Markdown 转换器输出：

```markdown
## 项目经历

### 基于 Agent 的智能问数平台

### 使用 LangGraph 编排多个 Agent

### 支持自然语言生成 SQL
```

最后两行很可能只是项目描述，却被错误标成标题。如果下游把 `#` 当作绝对事实，最终目录会变成大量只有一两句话的叶节点。

问题不在 Markdown 语法。语法完全合法，错误发生在更早的语义判断：上游把“视觉上突出的一行”错误解释成“结构标题”。

所以 Canonical IR 中不能只有：

```json
{"type": "heading", "text": "支持自然语言生成 SQL"}
```

至少还应记录：

```json
{
  "id": "block-127",
  "page": 2,
  "type": "heading",
  "text": "支持自然语言生成 SQL",
  "bbox": [72, 351, 486, 371],
  "font_size": 10.5,
  "source_parser": "layout-parser-v3",
  "source_kind": "native_text",
  "type_confidence": 0.43,
  "reading_order": 18
}
```

`heading` 是解释，`text + page + bbox` 才是更接近原始事实的观察。两者必须分开保存。

由此推导出 Canonical Document IR 的两个职责：

1. 统一不同解析器的输出，让后续建树和检索不绑定具体厂商。
2. 保留 provenance，使每一次语义判断都能追溯到页面、坐标、解析器和置信度。

这也是为什么 Markdown 适合展示和交换，却不适合作为唯一的系统真相。Markdown 会丢失坐标、候选类型、冲突关系和解析来源，信息一旦丢失，下游无法重新判断。

## 5. 为什么要保存不可变原始 PDF

解析器会升级，OCR 模型会变化，结构算法会调整，业务规则也会改变。如果只保存最终 Markdown，那么系统无法回答：

- 这句话究竟来自哪一页、哪个区域？
- 是原生文字还是 OCR 生成的？
- 新解析器是否比旧解析器更好？
- 用户投诉内容错误时，错误发生在哪一步？

因此必须建立事实层和派生层：

```text
事实层
  original.pdf
  sha256
  upload metadata

观察层
  page images
  native blocks
  OCR blocks
  layout blocks

解释层
  headings
  tables
  sections
  tree candidates

检索层
  page index
  lexical index
  vector index（可选）
  tree index
```

上层产物可以删除和重建，底层事实不能被覆盖。这与编译系统保留源代码、数据仓库保留原始层的原因相同：**只有不可变输入才能让派生结果可复现。**

## 6. 为什么多解析器不是“堆模型”

如果同时调用三个相似 OCR，然后随便选择最长结果，这不是可靠的多解析器系统，只是在增加成本。

多解析器真正的价值来自“错误模式不同”：

```text
Native parser  ──擅长──> 可选择文本、低成本、字符精确
Layout parser  ──擅长──> 多栏、阅读顺序、标题与区域
OCR            ──擅长──> 扫描页、图片文字
VLM            ──擅长──> 图表、复杂视觉语义
Bookmarks      ──擅长──> 作者显式提供的章节边界
```

假设三个解析器的错误完全相关，那么运行三次并不会增加信息；只有当它们基于不同信号、具有不同错误分布时，候选之间的比较才有意义。

工程上不应默认运行所有解析器，而应采用级联决策：

```text
低成本解析
   │
   ├── 质量足够 ──> 接受
   │
   └── 质量不足 ──> 更强的版面模型
                         │
                         ├── 质量足够 ──> 接受
                         │
                         └── 局部 OCR/VLM
```

其本质是序贯决策：每一步购买额外信息，只有预期收益高于成本时才继续。

```text
继续解析，当且仅当：

ExpectedQualityGain × BusinessValue > AddedLatency + AddedComputeCost
```

## 7. 为什么目录树只能是“候选假设”

目录树不是原始 PDF 中天然存在的对象。即使 PDF 有书签，书签也可能缺失、过时或只覆盖部分页面。

一棵树实际表达了三个假设：

1. 哪些文本是标题；
2. 标题之间是什么父子关系；
3. 每个节点覆盖哪些页面或文本块。

因此可以把真实但不可直接观测的结构记为 `Z`，解析观察记为 `O`，建树是在估计：

```text
P(Z | O)
```

Flash、PDF 书签、Markdown 标题、版面规则和 LLM 建树只是对 `P(Z | O)` 的不同近似，没有任何一种天然等于真值。

合理的系统会生成多个候选：

```text
TreeCandidate A：PDF bookmarks
TreeCandidate B：字号和空间关系
TreeCandidate C：PageIndex Flash
TreeCandidate D：LLM 根据正文推断
TreeCandidate E：业务源数据直接生成
```

然后用不依赖候选生成器主观判断的规则进行验证。候选生成和候选裁判必须尽量解耦，否则生成器会给自己的错误打高分。

## 8. 为什么质量门禁应以确定性规则为主

如果让另一个 LLM 回答“这棵树好不好”，系统只是把一次不确定判断换成另一次不确定判断，而且很难回归测试。

树结构中有大量可以直接计算的约束。

### 8.1 强约束

强约束违反时，结果不能直接发布：

- 节点页码必须位于文档范围内；
- `start_page <= end_page`；
- 子节点页码范围不能无理由越过父节点；
- 节点引用的 block 必须真实存在；
- 同一 block 不能同时归属多个互斥叶节点；
- 标题文本必须能在原文、书签或高置信版面块中找到依据；
- 树不能存在环。

这些约束不需要 LLM，因为它们属于数据一致性问题。

### 8.2 软约束

软约束用于比较候选优劣：

```text
coverage_score       文档内容被有效节点覆盖的比例
heading_evidence     标题拥有原文或版面证据的比例
granularity_score    节点大小是否适合检索
hierarchy_score      层级是否稳定、是否频繁跳级
range_score          页面范围是否连续且少冲突
fragmentation_score  是否出现大量微小节点
```

总分可以从简单可解释的线性模型开始：

```text
tree_score =
    0.25 × coverage_score
  + 0.20 × heading_evidence
  + 0.20 × granularity_score
  + 0.15 × hierarchy_score
  + 0.15 × range_score
  + 0.05 × parser_confidence
  - hard_violation_penalty
```

权重不是普适真理，应该根据自己的问答评测集校准。关键不在具体数字，而在于每一项都必须能解释、能记录、能回归。

## 9. “内容太细太碎”为什么可以被计算

节点是否过碎，不能简单用“字符少于 200”判断，因为法规条款可能很短但语义完整，简历中的一个项目也可能只有三行。

第一性原理仍然是检索效用。一个节点应该保留，当它能够：

- 提供独立的导航价值；
- 对应可辨认的用户问题；
- 拥有足够上下文让模型正确理解；
- 与兄弟节点存在真实语义边界。

可以构造以下特征：

```text
node_size              节点字符数或 token 数
body_to_title_ratio    正文与标题长度之比
sibling_similarity     与相邻兄弟节点的语义相似度
heading_style_support  字号、粗体、间距是否支持标题判断
query_separability     测试问题能否稳定只命中该节点
orphan_rate            只有标题、几乎没有正文的节点比例
```

当一个小节点与相邻节点高度相似、标题证据弱、无法独立回答问题时，合并的预期收益大于保留收益：

```text
merge(a, b)，如果：

RetrievalUtility(a ∪ b) > RetrievalUtility(a) + RetrievalUtility(b)
```

生产中不必在线精确计算这个公式，可以用可解释规则近似：

```python
def should_merge(node, previous):
    return (
        node.token_count < 80
        and node.heading_confidence < 0.55
        and node.semantic_similarity(previous) > 0.82
        and node.page_start <= previous.page_end + 1
    )
```

LLM 可以建议 `merge`，但不能直接重写原文。程序仍需验证节点、页码和 block 引用后再执行。

## 10. 为什么不能只依赖树检索

树是对文档的有损压缩。它用少量标题和摘要换取低成本导航，但压缩必然丢信息。

例如简历树上可能只有：

```text
项目经历
  └── 智能问数平台
```

用户却问：“这个项目有没有使用 PostgreSQL 的向量扩展？”如果摘要没有提到 PostgreSQL，纯树检索可能不会进入正确节点；而页级 BM25 可以直接命中原文词语。

不同检索器利用的是不同信号：

- 树检索：结构关系、全局语义和推理相关性；
- BM25：精确词、编号、姓名、错误码和专有名词；
- 向量检索：语义近似表达；
- 页面扫描：短文档的近乎无损读取。

不存在一种信号在所有查询上都占优。因此查询计划应根据文档和问题动态选择：

```text
短文档             ──> 直接读取全文或全部页面
结构清晰的长文档   ──> 树优先，页级检索兜底
结构低置信长文档   ──> BM25/向量优先，树作为辅助
精确词查询         ──> BM25 优先
跨章节综合问题     ──> 树检索优先并多节点读取
```

这不是对 PageIndex 思路的否定。恰恰相反，PageIndex 提供了传统相似度检索缺少的全局导航信号；混合检索只是承认任何有损索引都存在盲区。

## 11. 为什么结构失败时仍要“降级可用”

假设一份 PDF 已经正确提取了每页文字，但目录树质量只有 0.58。系统有两个选择：

1. 整个任务标记失败，用户完全无法查询；
2. 发布页级索引，把树标记为低置信度，查询走全文或页级召回。

第二种选择通常具有更高业务效用，因为“没有理想结构”不等于“没有可用证据”。

状态不能只有成功和失败，而应表达能力等级：

```text
READY
  解析和树都通过质量门禁

DEGRADED_READY
  原文和页级索引可用，树缺失或低置信

REVIEW_REQUIRED
  有证据，但重要页面存在冲突，需要人工检查

FAILED
  加密、损坏或所有解析路径都无法获得基本证据
```

这是可靠性工程中的故障隔离：树模块失败不应拖垮已经成功的文本提取和页面检索模块。

## 12. 为什么 LLM 应该做受约束修复

LLM 擅长判断：

- “教育背景”和“工作经历”更可能是同级标题；
- 某一句更像正文而不是标题；
- 三个碎片节点表达的是同一个项目；
- 一个过大的章节可以按哪些语义边界拆分。

但 LLM 不擅长保证：

- 页码永远合法；
- block ID 永远存在；
- 原文一个字不变；
- 每次输出都满足数据约束。

因此，不应让模型返回一棵可以任意改写的完整新树，而应该让它返回有限操作：

```json
[
  {
    "op": "merge_nodes",
    "node_ids": ["n-21", "n-22", "n-23"],
    "target_title": "智能问数平台"
  },
  {
    "op": "demote_heading",
    "node_id": "n-31",
    "to": "body"
  }
]
```

允许的操作可以限定为：

```text
merge_nodes
split_node_at_block
promote_node
demote_node
rename_from_existing_text
attach_orphan_blocks
```

执行器再验证：

- 操作对象是否存在；
- 新标题是否来自已有文本；
- 操作后是否仍为无环树；
- 页面范围是否覆盖且合法；
- 是否真的提升质量分。

底层原则是：**让概率模型提出语义判断，让确定性程序维护事实边界。**

## 13. 用这份简历重新推导一次

目标 PDF：

```text
job/resume-html/宋涛-AI全栈开发-简历.pdf
```

已知它只有 2 页、包含健康的原生文本，并且版面经过设计。由前面的原则可以逐步得到决策。

### 13.1 为什么不先 OCR

原生字符存在且可读，OCR 不会创造新信息，只会增加延迟并引入识别错误。因此首先使用 native/layout 路径。

### 13.2 为什么 Flash 结果不能直接当真

Flash 从字号、位置和版面统计推断标题。简历为了视觉效果使用卡片、加粗、时间和技术关键词，这些视觉特征未必等于章节层级。因此 Flash 是低成本候选，而非权威结构。

### 13.3 为什么 Markdown 能改善结果却仍不是事实层

如果从简历源数据生成正确 Markdown，`## 教育背景`、`## 工作经历` 和 `## 项目经历` 是强结构证据，建树会很稳定。但如果 Markdown 来自另一个 PDF 转换模型，错误标题仍然只是另一个解析器的判断。

因此要记录 Markdown 的来源：

```text
业务源数据生成 Markdown：高置信结构候选
PDF 转换生成 Markdown：普通结构候选，必须校验
人工编辑 Markdown：高置信，但仍保留变更记录
```

### 13.4 为什么两页简历不值得强求完美树

用户查询最多只需要读取两页，读取成本极低。即使树完全失败，直接把两页文本交给模型仍能取得很高证据召回。

所以合理策略是：

```text
1. Native + layout 提取，生成 Canonical IR
2. 运行 Flash，得到低成本结构候选
3. 验证候选覆盖率和标题证据
4. 树合格则发布 READY
5. 树不合格则发布 DEGRADED_READY
6. 查询默认直接读取第 1～2 页
7. 只有产品需要结构化展示时，才运行 Standard/LLM 修复
```

这里最重要的不是省下一次 LLM 调用，而是检索策略与文档规模相匹配：对两页文档建立精密路由树的收益几乎为零。

## 14. 从原理落到最小可行接口

解析器只负责产生观察，不负责宣布最终真相：

```python
class ParserAdapter(Protocol):
    name: str

    def supports(self, profile: DocumentProfile) -> bool: ...

    def parse(
        self,
        source: ImmutableDocument,
        pages: list[int],
    ) -> ParseCandidate: ...
```

统一 IR 保存事实、观察和解释：

```python
@dataclass
class Block:
    id: str
    page: int
    bbox: tuple[float, float, float, float]
    text: str
    observed_kind: str       # native_text / ocr_text / image
    semantic_role: str       # heading / paragraph / table / unknown
    parser: str
    confidence: float


@dataclass
class CanonicalDocument:
    source_sha256: str
    pages: list[Page]
    blocks: list[Block]
    parse_warnings: list[str]
```

树生成器消费统一 IR，而不是直接绑定 PDF：

```python
class TreeBuilder(Protocol):
    name: str

    def build(self, document: CanonicalDocument) -> TreeCandidate: ...
```

质量门禁只接受能够解释的评分结果：

```python
@dataclass
class ValidationResult:
    hard_errors: list[str]
    warnings: list[str]
    metrics: dict[str, float]
    score: float


def publish(candidate, validation):
    if validation.hard_errors:
        return "REJECTED"
    if validation.score >= 0.80:
        return "READY"
    if candidate.document.page_text_available:
        return "DEGRADED_READY"
    return "REVIEW_REQUIRED"
```

查询规划器根据能力而不是产品宣传选择路径：

```python
def plan_query(document, question):
    if document.page_count <= 5:
        return FullDocumentPlan()

    if looks_like_exact_lookup(question):
        return LexicalFirstPlan(tree_fallback=True)

    if document.tree_score >= 0.80:
        return TreeFirstPlan(page_fallback=True)

    return HybridPagePlan(use_vector=True, use_bm25=True)
```

## 15. 这套架构真正优化的是什么

表面上，它增加了很多组件；实际上，它是在分别控制四类风险：

| 风险 | 对应设计 |
|---|---|
| PDF 的表达方式不统一 | Preflight + 页面级解析路由 |
| 不同解析器会犯不同错误 | 多解析候选 + Canonical IR |
| 目录树是有损且不确定的推断 | 多候选树 + 确定性质量门禁 |
| 单一索引存在召回盲区 | 树、BM25、向量和全文读取的混合路由 |
| 某个高级能力失败会拖垮整个文档 | `DEGRADED_READY` 降级发布 |
| LLM 可能改写事实或伪造位置 | provenance + 受约束修复 + Evidence 引用 |

所以它不是“选择更多开源框架”，而是在构造一条具有以下性质的信息生产线：

```text
原始信息不丢失
推断过程可追溯
质量可以被度量
错误可以被隔离
成本可以按需支付
索引可以重新生成
回答可以回到证据
```

## 16. 最终结论

从第一性原理看，生产级 PDF RAG 应遵守七条原则：

1. **PDF 是事实载体，不是现成的语义结构。** 标题、段落和表格都是解析器根据证据作出的判断。
2. **RAG 的目标是找回可验证证据，不是生成漂亮 Markdown。** 中间格式必须服务于证据召回。
3. **解释与事实必须分离。** 原文、页码、bbox 和来源不可被标题分类、摘要或目录树覆盖。
4. **不确定性无法靠一个更大的模型彻底消除。** 应通过不同信号的候选、评分和回退进行管理。
5. **树是导航索引，不是文档真相。** 它必须经过覆盖、粒度、层级和引用范围验证。
6. **LLM 负责语义建议，程序负责事实约束。** 模型只能提交受约束、可验证、可回滚的修复操作。
7. **高级索引失败不等于文档不可用。** 页面证据存在时，应降级到页级或全文检索，而不是让整个任务失败。

因此，`Docling/ MinerU + PageIndex + Quality Gate + 混合检索` 不是随意拼装出来的技术栈。它是从 PDF 的非结构化本质、解析的不确定性、树索引的有损性和线上系统的可用性要求逐层推导出来的工程结果。

具体字段、状态机、评分公式、数据库表和部署步骤，可以继续参见上一篇《生产级 PDF RAG 接入方案：多解析器、质量门禁与自动降级》。
