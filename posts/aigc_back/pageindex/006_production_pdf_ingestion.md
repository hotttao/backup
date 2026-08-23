---
weight: 6
title: "生产级 PDF RAG 接入方案：多解析器、质量门禁与自动降级"
date: 2026-08-21T22:50:00+08:00
lastmod: 2026-08-21T22:50:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "面向来源、版式和质量都不确定的 PDF，设计可落地的预检、多路解析、标准中间表示、结构评分、受约束修复和混合检索方案。"
featuredImage:

tags: ["RAG", "PageIndex", "PDF", "架构设计"]
categories: ["AIGC"]

lightgallery: true
---

当系统接收的 PDF 无法预知来源时，最佳实践不是在 Flash、Standard、Markdown 和 OCR 中固定选一个，而是把 PDF 接入建模成一个“文档编译器”：先识别文档特征，再运行一个或多个候选解析器，将结果统一到标准中间表示，经过确定性质量门禁后才发布索引。

<!-- more -->

## 1. 目标与非目标

### 1.1 目标

1. 支持原生文本 PDF、扫描 PDF、混合 PDF、多栏文档、表格/图片密集文档、乱码 PDF 和无目录文档。
2. 不因树构建失败而让整份文档不可检索。
3. 任何节点都能追溯到 PDF 页、文本块和坐标框。
4. LLM 只能提交结构修复操作，不能改写原文或伪造页码。
5. 解析器、OCR、模型或提示词升级时，能对已有文档定向重建索引。
6. 接入过程可观测：能回答“为什么选 OCR”、“为什么拒绝这棵树”。

### 1.2 非目标

- 不追求所有 PDF 都产生完美的章节树。
- 不将一次 LLM 输出当作可直接入库的事实。
- 不为了“纯无向量”而放弃可靠的字面或页级兜底检索。

## 2. 总体架构

```text
                    ┌─────────────┐
Upload/API ─────────▶│ Object Store │
                    └──────┬──────┘
                           │ sha256 + immutable source
                           ▼
                    ┌─────────────┐
                    │   Preflight   │
                    │ 页数/文本/图像/书签 │
                    └──────┬──────┘
                           │ routing plan
            ┌──────────────┬──────────────┐
            ▼              ▼              ▼
      Native/Layout       OCR/Layout       Embedded TOC
       PDFium/PyPDF2     local or cloud      bookmarks
            └──────────────┴──────────────┘
                           ▼
                  Canonical Document IR
                  Page/Block/Span/Provenance
                           │
             ┌──────────┬──────────┐
             ▼          ▼          ▼
        Flash tree   Standard tree  Markdown/source tree
             └──────────┴──────────┘
                           ▼
                 Validate + Score + Repair
                           │
             ┌──────────┬──────────┐
             ▼          ▼          ▼
          Tree index   Page index   Lexical/vector index
             └──────────┴──────────┘
                           ▼
                    Query Planner/Agent
```

核心原则：原始页文本是一等公民，树是可选的路由加速器。树失败时，页级检索仍必须可用。

## 3. 文档状态机

```text
UPLOADED
  -> PREFLIGHTING
  -> EXTRACTING
  -> BUILDING_CANDIDATES
  -> VALIDATING
  -> REPAIRING         # 可选
  -> INDEXING
  -> READY

任一阶段 -> DEGRADED_READY  # 树不可用，页检索可用
源文件无法解密/打开 -> BLOCKED
原文和 OCR 都不可读 -> FAILED
```

`DEGRADED_READY` 比直接 `FAILED` 重要。它表示“可以问答，但不能依赖树路由”。

## 4. 第一步：上传、去重与安全检查

### 4.1 必存的原始信息

```python
class SourceDocument(BaseModel):
    document_id: str
    tenant_id: str
    sha256: str
    original_name: str
    object_uri: str
    content_type: str
    byte_size: int
    created_at: datetime
```

- 用 `tenant_id + sha256` 作为幂等键。
- 原文件只读，后续产物都指向源 hash。
- 文件名不参与真实类型判断，要检查 `%PDF-` 和 PDF parser。
- 限制文件大小、页数、解压后对象数、嵌入文件和 JavaScript/Launch action。
- 在隔离 worker 中解析，设 CPU、内存和超时限额。

### 4.2 加密 PDF

- 用户未提供密码：`BLOCKED/PASSWORD_REQUIRED`。
- 密码只进入短期任务 secret，不记录到日志和文档元数据。
- 解密后的中间 PDF 要按组织数据策略加密保存或立即销毁。

## 5. 第二步：Preflight 文档画像

Preflight 不构建完整树，只使用便宜、确定性的方法决定后续路由。

```python
class PageProfile(BaseModel):
    page_no: int
    width: float
    height: float
    rotation: int
    native_chars: int
    printable_chars: int
    replacement_chars: int
    image_count: int
    image_area_ratio: float
    drawing_count: int
    column_estimate: int

class DocumentProfile(BaseModel):
    page_count: int
    encrypted: bool
    has_bookmarks: bool
    bookmark_count: int
    bookmark_max_depth: int
    native_text_page_ratio: float
    median_chars_per_page: float
    unicode_health: float
    image_dominant_page_ratio: float
    mixed_page_ratio: float
    likely_scanned: bool
    likely_multicolumn: bool
    sampled_pages: list[int]
```

### 5.1 核心指标

```text
native_text_page_ratio
  = 有足够可打印文字的页数 / 总页数

unicode_health
  = 1 - (替换字符 + 孤立 surrogate + 异常控制字符) / 总字符

image_dominant_page_ratio
  = 图像覆盖面积 > 70% 且原生文字较少的页数 / 总页数
```

### 5.2 抽样页

长文档不必在 Preflight 渲染每页。建议抽取：

```text
前 3 页 + 后 2 页 + 等间隔 5~10 页 + 原生文字异常页
```

混合 PDF 的 OCR 决策必须是页级的，不能因为前两页是扫描封面就对 500 页全文 OCR。

## 6. 第三步：解析路由决策

```python
class ParsePlan(BaseModel):
    native_extract: bool
    layout_extract: bool
    ocr_pages: list[int]
    use_embedded_toc: bool
    build_flash_candidate: bool
    build_standard_candidate: bool
    build_source_markdown_candidate: bool
    reasons: list[str]
```

建议的初始规则：

| 文档特征 | 解析计划 |
|---|---|
| `native_text_page_ratio >= 0.9` 且 `unicode_health >= 0.98` | Native + layout，不默认 OCR |
| `0.3 <= native_text_page_ratio < 0.9` | Native + 仅异常页 OCR，页级合并 |
| `native_text_page_ratio < 0.3` 或 image-dominant 很高 | OCR-first + layout |
| 字符多但 `unicode_health < 0.9` | Native 保留作对照，OCR 作主文本 |
| 多栏/复杂排版 | 强制 layout parser，不使用纯 PyPDF2 阅读顺序 |
| 有深层书签 | 生成 embedded-TOC 候选，仍要验证 |
| 有可信 HTML/Markdown/业务源数据 | 生成 source-structure 候选，优先级高于 PDF 反推 |

路由不要只返回一个枚举值，而要生成可组合的执行计划。一份混合 PDF 可以同时执行 native page extraction 和部分页 OCR。

## 7. 第四步：标准中间表示 Document IR

不要让业务层直接依赖 PyPDF2、PDFium、OCR 供应商或 Markdown 的原始输出。

```python
class BBox(BaseModel):
    x0: float
    y0: float
    x1: float
    y1: float

class TextSpan(BaseModel):
    span_id: str
    text: str
    bbox: BBox | None
    font_name: str | None
    font_size: float | None
    bold: bool | None
    source: Literal["native", "ocr", "source_markdown"]
    confidence: float

class Block(BaseModel):
    block_id: str
    page_no: int
    kind: Literal[
        "title", "heading_candidate", "paragraph", "list",
        "table", "caption", "header", "footer", "image"
    ]
    text: str
    bbox: BBox | None
    reading_order: int
    spans: list[TextSpan]
    provenance_ids: list[str]

class Page(BaseModel):
    page_no: int
    width: float
    height: float
    rotation: int
    blocks: list[Block]
    native_text: str
    ocr_text: str | None
    canonical_text: str
    text_source: Literal["native", "ocr", "merged"]

class DocumentIR(BaseModel):
    document_id: str
    source_sha256: str
    parser_versions: dict[str, str]
    pages: list[Page]
    bookmarks: list[dict]
    warnings: list[str]
```

### 7.1 为什么必须保留 provenance

如果节点标题为“工作经验”，系统应能找到：

```text
tree node
  -> heading block id
  -> page 1
  -> native spans / OCR words
  -> bbox
```

这样才能实现引用、视觉高亮、错误调试和重新校验。

## 8. Native 与 OCR 文本如何合并

不要在整份文档上做“Native 或 OCR”二选一。先按页决策，再在页内按块对齐。

### 8.1 页级选择

```python
def choose_page_text(native: ExtractedPage, ocr: OCRPage | None) -> str:
    if ocr is None:
        return native.text
    if native.printable_chars < 30:
        return ocr.text
    if native.unicode_health < 0.90:
        return ocr.text
    if ocr.confidence < 0.70:
        return native.text
    return merge_by_geometry(native, ocr)
```

### 8.2 几何合并

1. 将 Native span 和 OCR word 的 bbox 归一化到同一页坐标系。
2. 用 IoU、中心点距离和字符相似度对齐。
3. 已匹配且 Native Unicode 健康时保留 Native。
4. Native 乱码、OCR 高置信时使用 OCR。
5. OCR 独有且不是水印/图像伪字符时补入。
6. 不要把两份全文直接拼接，否则会产生重复段落。

## 9. 第五步：并行构建结构候选

不要在 Preflight 阶段就永久锁定一种建树算法。对不确定文档，并行生成少量候选再评分。

```python
class TreeNode(BaseModel):
    node_id: str
    title: str
    start_page: int
    end_page: int
    heading_block_id: str | None
    source: Literal["flash", "standard", "bookmark", "markdown", "repaired"]
    heading_confidence: float
    key_items: list[str]
    children: list["TreeNode"]

class TreeCandidate(BaseModel):
    candidate_id: str
    builder: str
    builder_version: str
    root_nodes: list[TreeNode]
    llm_model: str | None
    prompt_version: str | None
    build_warnings: list[str]
```

### 9.1 候选生成策略

1. 原生文本健康：运行 Flash raw/full 候选。
2. Flash 为空或预评分不足：运行 Standard 候选。
3. 书签层次足够：运行 bookmark 候选。
4. 有可信源 Markdown/HTML/业务 JSON：运行 source candidate。
5. PDF-to-Markdown 生成的 Markdown 只是候选，不因为格式叫 Markdown 就获得最高信任。

### 9.2 控制成本

- 明显的原生文本长报告：先 Flash，通过门禁则不跑 Standard。
- 只对不确定文档跑多候选。
- Standard 使用文档 hash + parser version + model + prompt version 做缓存键。
- OCR 使用页图像 hash 缓存，不因树算法升级重做 OCR。

## 10. 第六步：确定性结构验证

LLM 修复之前先做确定性验证。

### 10.1 强约束

```python
def validate_tree(tree: TreeCandidate, page_count: int) -> list[Issue]:
    # 1. 页码必须在 1..page_count
    # 2. start_page <= end_page
    # 3. child range 必须是 parent range 的子集
    # 4. 同层节点按文档顺序单调
    # 5. 不允许循环、重复 node_id
    # 6. heading_block_id 必须真实存在
    # 7. 如果声称标题来自原文，必须在相应页/block 中可验证
    ...
```

违反强约束的候选不能直接入库。

### 10.2 软约束

- 根节点数量是否异常。
- 树深度是否超过预期，一般文档深度 2~5 更常见。
- 大量叶子是否只有几十 tokens。
- 同页叶子是否过多。
- 是否存在过大的无标题页码空洞。
- 标题是否过长、像完整正文句子。
- 文档 title 是否来自封面/页首高置信区域。

## 11. 第七步：结构质量评分

建议将文本质量和树质量分开评分。

### 11.1 文本质量

```text
T = 0.35 * page_text_coverage
  + 0.30 * unicode_health
  + 0.20 * reading_order_consistency
  + 0.15 * cross_parser_agreement
```

- `page_text_coverage`：有可用正文的页比例。
- `reading_order_consistency`：多栏页中是否出现大量跨栏串行。
- `cross_parser_agreement`：抽样页 Native 与 OCR/layout parser 在规范化后的一致性。

### 11.2 树质量

```text
S = 0.25 * heading_evidence
  + 0.20 * page_coverage
  + 0.15 * ordering_score
  + 0.15 * granularity_score
  + 0.10 * hierarchy_consistency
  + 0.10 * title_quality
  + 0.05 * bookmark_agreement
```

#### heading_evidence

每个标题按来源赋权：

```text
业务源结构 + 页面文本验证        1.00
深层书签 + 页面文本验证          0.95
PDF 版式候选 + 原文 block 证据           0.90
LLM 标题 + 原文逐字验证               0.80
PDF-to-Markdown 标题，但无版式证据        0.60
LLM 改写标题，原文不存在               0.00
```

#### granularity_score

动态评估，不使用全局固定 5000-token 阈值：

```text
ideal_leaf_tokens = clamp(total_tokens / 50, 300, 3000)
```

然后惩罚：

- 过多 `< 100 tokens` 的叶子。
- 过多 `> 8000 tokens` 的叶子。
- 同一页上完全重叠的多个叶子。
- 单个父节点下超过 15~20 个短子节点。

### 11.3 发布门禁

```text
T >= 0.85 and S >= 0.82  -> READY，直接发布
T >= 0.75 and S >= 0.65  -> REPAIRING，修复后重评
T >= 0.75 and S <  0.65  -> DEGRADED_READY，不发布树
T <  0.75                -> 换 OCR/parser 重做文本
```

阈值要通过真实文档集校准，不应将上述数值直接当作永久标准。

## 12. 第八步：标题错误与过度切分修复

### 12.1 错误类型

```python
IssueType = Literal[
    "false_heading",
    "missing_heading",
    "wrong_level",
    "wrong_parent",
    "duplicate_heading",
    "fragmented_siblings",
    "oversized_leaf",
    "uncovered_pages",
]
```

### 12.2 先规则，后 LLM

确定性规则可直接处理：

- 同页且范围完全相同的短叶子合并。
- 页眉、页脚、表格列名不得作为标题。
- 子节点页码超出父节点时拒绝。
- Markdown 层级跳跃可规范到最近有效父层级。
- 只有“技术栈/项目描述/个人职责”等字段标签的短节点，默认并入所属项目。

### 12.3 结构修复操作协议

LLM 不返回新树，只返回操作：

```json
{
  "operations": [
    {
      "op": "demote_to_text",
      "node_id": "0017",
      "reason": "该内容是项目属性标签，不是可独立检索章节"
    },
    {
      "op": "move",
      "node_id": "0021",
      "new_parent_id": "0008",
      "position": 2
    },
    {
      "op": "merge",
      "node_ids": ["0030", "0031", "0032"],
      "target_id": "0030"
    },
    {
      "op": "promote_block",
      "block_id": "p2-b14",
      "parent_id": "0011",
      "title": "2023-05 ~ 2025-03 智能空调负荷预测平台"
    }
  ]
}
```

验证器必须检查：

1. 所有 node/block ID 真实存在。
2. `promote_block.title` 必须是原 block 的规范化子串，不允许发明标题。
3. move 后页码范围仍满足父子约束。
4. merge 后原标题进入 `key_items`，原文 block 零丢失。
5. 修复后重新运行完整验证和评分。

### 12.4 基于检索收益的合并

对节点 `v`：

```text
scan_cost(v) = 节点覆盖页数或规范化 token 数

tree_cost(v) = routing_cost
             + max(residual_cost, max(tree_cost(child)))
```

当 `scan_cost(v) <= tree_cost(v)` 时合并子树。短文档用 token 成本比页数更精确，长 PDF 可使用页数成本。

不要仅根据“小于 5000 tokens”合并，否则 2 页简历和 1000 页教科书会使用同一粒度。

## 13. 第九步：选择、融合候选树

### 13.1 不确定时不做节点级强行拼接

两棵树的节点范围和层级可能完全不同。第一版实现建议：

1. 各候选独立验证和评分。
2. 选总分最高且通过门禁的一棵。
3. 只把其他候选用作交叉验证信号，不直接合并。

第二版才考虑以页码范围 + 标题文本对齐进行节点级融合。

### 13.2 同分决策

两个候选得分接近时，优先：

1. 标题有原始 block/bbox 证据的候选。
2. 无 LLM 改写标题的候选。
3. 搜索复杂度更低的候选。
4. 与可信书签/业务源结构一致的候选。

## 14. 第十步：索引产物不能只有树

```text
artifacts/{document_id}/{pipeline_version}/
├── source.json
├── profile.json
├── parse_plan.json
├── document_ir.json.zst
├── pages.json.zst
├── tree_candidates/
│   ├── flash.json
│   ├── standard.json
│   └── bookmark.json
├── validation.json
├── selected_tree.json
├── retrieval_units.json
└── manifest.json
```

`manifest.json` 记录：

```json
{
  "source_sha256": "...",
  "pipeline_version": "pdf-ingest-v3",
  "native_parser": "pdfium-5.x",
  "ocr_provider": "...",
  "ocr_model": "...",
  "tree_builder": "pageindex-flash-0.2.10",
  "llm_model": "...",
  "prompt_version": "standard-tree-v4",
  "text_score": 0.94,
  "tree_score": 0.78,
  "status": "READY"
}
```

这是重建、回归对比和问题定位的基础。

## 15. 第十一步：查询时的混合路由

最佳实践是“树优先，页级兜底”，而不是“只能树搜索”。

### 15.1 文档长度策略

| 文档 | 默认策略 |
|---|---|
| `<= 20` 页 | 直接读全文或小范围页，树只用于展示/引用 |
| `21~200` 页 | 树选节点 + 字面/BM25 页级兜底 |
| `> 200` 页 | 文档/文件夹路由 -> 树路由 -> 目标页，同时运行页级兜底 |

### 15.2 树置信度策略

```python
def choose_query_plan(doc: IndexedDocument, query: str) -> QueryPlan:
    if doc.page_count <= 20:
        return QueryPlan(mode="direct_pages", pages=f"1-{doc.page_count}")

    if doc.tree_score >= 0.82:
        return QueryPlan(mode="tree_first_with_page_fallback")

    if doc.tree_score >= 0.65:
        return QueryPlan(mode="parallel_tree_and_page_search")

    return QueryPlan(mode="page_search_only")
```

### 15.3 页级兜底

可选实现：

- BM25/全文检索：可解释、便宜，适合专有名词、数字和精确措辞。
- 向量页/段检索：处理同义改写。
- 如果必须严格 vectorless，使用 BM25 + LLM rerank，不要取消所有兜底。

树候选页和页级搜索结果取并集，再由 reranker/Agent 基于问题判断最终读取页面。

## 16. 回答阶段的证据协议

不要只返回一段文本给模型。

```python
class Evidence(BaseModel):
    document_id: str
    page_no: int
    block_ids: list[str]
    bbox: list[BBox]
    text: str
    source: Literal["native", "ocr", "merged"]
    retrieval_path: list[str]
    confidence: float
```

`retrieval_path` 例如：

```text
宋涛简历 -> 代表性项目 -> 智能空调负荷预测平台 -> page 2
```

回答中只允许引用 Evidence 包含的文本。树摘要用于路由，不应被当成最终事实证据，除非再读了对应原文。

## 17. Prompt Injection 与不可信 PDF

PDF 文本必须被当作不可信数据。

### 17.1 索引阶段

- 文档内容放入明确的 data delimiter。
- 系统提示词声明文档中的指令不可执行。
- LLM 只返回受限 JSON schema。
- 标题、页码和操作对象都要与 Document IR 验证。

### 17.2 查询阶段

- 文档 Agent 的工具必须是只读的。
- 文档内容不能改变 `doc_id` 作用域。
- 不让文档内文本触发外部网络、删除文件或管理操作。
- 工具层强制文档允许列表，不仅靠 prompt 约束。

## 18. 任务编排与服务拆分

### 18.1 建议组件

```text
ingest-api
  负责上传、幂等、状态查询、租户鉴权

document-orchestrator
  负责状态机、路由、重试、超时和产物版本

pdf-native-worker
  PDFium/PyPDF2、字符、block、书签和渲染

ocr-worker
  页级 OCR，可接本地或 Cloud provider

tree-worker
  Flash、Standard、Markdown/source candidate

quality-worker
  验证、评分、修复操作审核

index-writer
  原子发布 tree/page/search index
```

### 18.2 重试策略

- PDF 格式/密码错误：不重试。
- OCR/LLM 429、5xx、超时：指数退避 + jitter，设最大次数。
- LLM JSON 语法错：可做一次 schema repair；对象 ID/页码不合法则不盲目修补。
- 单页 OCR 失败：标记页级 warning，其他页继续。
- 树失败：转 `DEGRADED_READY`，不阻塞页索引发布。

## 19. 对外 API

### 19.1 上传

```http
POST /v1/documents
Idempotency-Key: <tenant-id>:<sha256>
Content-Type: multipart/form-data

file=<pdf>
metadata={...}
```

```json
{
  "document_id": "doc_123",
  "status": "UPLOADED"
}
```

### 19.2 状态

```http
GET /v1/documents/doc_123/status
```

```json
{
  "status": "DEGRADED_READY",
  "text_score": 0.93,
  "tree_score": 0.58,
  "capabilities": {
    "page_search": true,
    "tree_search": false,
    "image_search": false
  },
  "warnings": [
    "Flash structure failed quality gate",
    "Using page-level retrieval"
  ]
}
```

### 19.3 结构和页证据

```http
GET /v1/documents/doc_123/tree
GET /v1/documents/doc_123/pages/2
POST /v1/documents/doc_123/search
```

## 20. 主管线伪代码

```python
async def ingest_pdf(source: SourceDocument) -> PublishedDocument:
    profile = await preflight(source)
    plan = build_parse_plan(profile)

    native_task = run_native_parser(source) if plan.native_extract else None
    ocr_task = run_ocr(source, plan.ocr_pages) if plan.ocr_pages else None

    native, ocr = await gather_optional(native_task, ocr_task)
    document_ir = build_document_ir(source, profile, native, ocr)

    text_score = score_text(document_ir)
    if text_score < 0.75 and not plan.ocr_pages:
        ocr = await run_ocr(source, pages_needing_ocr(document_ir))
        document_ir = build_document_ir(source, profile, native, ocr)
        text_score = score_text(document_ir)

    if text_score < 0.75:
        raise UnreadableDocument(text_score=text_score)

    candidates: list[TreeCandidate] = []

    if plan.use_embedded_toc:
        candidates.append(build_bookmark_candidate(document_ir))

    if plan.build_source_markdown_candidate:
        candidates.append(build_source_candidate(document_ir))

    if plan.build_flash_candidate:
        flash = await build_flash_candidate(document_ir)
        candidates.append(flash)

    # 先评 Flash，只在需要时支付 Standard 成本
    preliminary = evaluate_candidates(candidates, document_ir)
    if should_run_standard(preliminary, plan):
        candidates.append(await build_standard_candidate(document_ir))

    evaluations = evaluate_candidates(candidates, document_ir)
    selected = select_best(evaluations)

    if selected.score < 0.82 and selected.score >= 0.65:
        operations = await propose_repairs(selected, document_ir)
        repaired = apply_validated_operations(selected, operations, document_ir)
        repaired_eval = evaluate_tree(repaired, document_ir)
        if repaired_eval.score > selected.score:
            selected = repaired_eval

    page_index = build_page_index(document_ir)

    if selected.score < 0.65:
        return await publish_atomically(
            source=source,
            document_ir=document_ir,
            page_index=page_index,
            tree=None,
            status="DEGRADED_READY",
        )

    optimized_tree = optimize_granularity(selected.tree, document_ir)
    summarized_tree = await summarize_bottom_up(optimized_tree, document_ir)

    return await publish_atomically(
        source=source,
        document_ir=document_ir,
        page_index=page_index,
        tree=summarized_tree,
        status="READY",
    )
```

## 21. 配置示例

```yaml
ingestion:
  max_file_mb: 200
  max_pages: 5000
  parser_timeout_seconds: 600

preflight:
  min_native_chars_per_page: 30
  native_text_ratio_good: 0.90
  unicode_health_good: 0.98
  image_dominant_area_ratio: 0.70
  sample_pages: 10

ocr:
  mode: page_selective
  min_confidence: 0.70
  max_concurrency: 8
  cache_by_page_hash: true

tree:
  flash_first: true
  run_standard_below_score: 0.75
  accept_score: 0.82
  repair_score: 0.65
  max_depth: 6
  max_short_children: 15
  short_leaf_tokens: 100
  oversized_leaf_tokens: 8000

retrieval:
  direct_read_max_pages: 20
  tree_first_min_score: 0.82
  parallel_tree_min_score: 0.65
  lexical_fallback: true
  vector_fallback: optional
```

## 22. 数据库表设计

```sql
create table documents (
    id                varchar primary key,
    tenant_id         varchar not null,
    source_sha256     varchar not null,
    original_name     varchar not null,
    object_uri        varchar not null,
    status            varchar not null,
    active_version_id varchar null,
    created_at        timestamp not null,
    unique (tenant_id, source_sha256)
);

create table document_versions (
    id                varchar primary key,
    document_id       varchar not null,
    pipeline_version  varchar not null,
    manifest_uri      varchar not null,
    text_score        decimal(5,4),
    tree_score        decimal(5,4),
    status            varchar not null,
    created_at        timestamp not null,
    foreign key (document_id) references documents(id)
);

create table ingestion_jobs (
    id                varchar primary key,
    document_id       varchar not null,
    version_id        varchar not null,
    stage             varchar not null,
    attempt           integer not null,
    error_code        varchar null,
    error_detail_uri  varchar null,
    started_at        timestamp,
    finished_at       timestamp
);
```

`documents.active_version_id` 只在所有新产物写入成功后原子切换，避免重建时让用户读到半成品。

## 23. 可观测性

### 23.1 指标

```text
pdf_ingest_duration_seconds{stage, parser}
pdf_ingest_documents_total{status}
pdf_pages_total{source=native|ocr|merged}
pdf_ocr_page_ratio
pdf_text_quality_score
pdf_tree_quality_score{builder}
pdf_tree_candidate_selected_total{builder}
pdf_tree_repair_operations_total{operation}
pdf_degraded_ready_total{reason}
pdf_query_retrieval_path_total{mode}
pdf_query_evidence_pages
```

### 23.2 日志

每条日志至少包含：

```text
tenant_id, document_id, version_id, job_id,
source_sha256, stage, parser_version, model, prompt_version
```

不要把 PDF 原文、密码、API Key 或完整 LLM prompt 默认写入普通日志。

## 24. 评测与回归测试

### 24.1 文档测试集

至少覆盖：

1. 原生中英文单栏 PDF。
2. 中英文多栏论文。
3. 有完整目录与书签的长报告。
4. 逻辑页码与物理页码有偏移的书籍。
5. 纯扫描 PDF。
6. 前几页扫描、后面原生文本的混合 PDF。
7. 乱码 ToUnicode/CMap PDF。
8. 表格和图片密集报告。
9. 只有 1~3 页的简历/合同。
10. 标题故意错标、过细和缺失的 Markdown。
11. 带 prompt injection 的 PDF。
12. 损坏、加密、超大 PDF。

### 24.2 标注内容

- 每页文本是否可读。
- 标题文本、层级、起始页、结束页。
- 哪些标签应该是段落而不是节点。
- 检索问题的最小证据页集。

### 24.3 指标

```text
Text Character Error Rate / Word Error Rate
Heading precision / recall
Heading level accuracy
Start-page / end-page accuracy
Tree path accuracy
Evidence page recall@k
Answer correctness with citation
Average indexing cost per page
P50/P95 ingestion latency
Degraded-ready rate
```

不能只评估最终问答正确率，否则无法判断错误发生在 OCR、建树、路由还是回答阶段。

## 25. 上线路线图

### Phase 1：可用性优先

- 原文件存储、hash 幂等。
- Preflight + Native/OCR 页级路由。
- Canonical pages/block IR。
- Flash-first，失败则页级 `DEGRADED_READY`。
- 页级 BM25/全文兜底。

### Phase 2：结构质量

- 树强约束验证和质量分。
- 低分时跑 Standard 候选。
- 动态粒度优化和 `key_items`。
- 不同候选树的回归对比。

### Phase 3：受约束修复与高级证据

- LLM 结构操作协议。
- bbox/行级引用。
- 图像、表格和 caption 证据。
- 文件级路由和多文档问答。

## 26. 对这份简历的实际路由

`宋涛-AI全栈开发-简历.pdf` 的预期决策是：

```text
Preflight
  - 2 pages
  - native text healthy
  - not scanned
  - visually designed layout

Parse plan
  - native_extract = true
  - layout_extract = true
  - ocr_pages = []
  - Flash candidate = true

Validation
  - Flash title evidence low
  - misses major section headings
  - tree score below accept threshold

Decision
  - 因为只有 2 页，立即发布 page index
  - 默认查询直接读 pages 1-2
  - 如果产品需要结构展示，再跑 Standard 或使用简历源数据树
```

这个决策不会因 Flash 树不好而影响问答可用性，也不会为了两页文本无条件支付 Standard/OCR 成本。

## 27. 最终建议

1. 将 PageIndex 当作结构候选生成器和树路由组件，不要将它当作唯一 PDF 解析真理。
2. 原始 PDF、Canonical Page IR 和页级索引永远保留。
3. 结构必须经过可量化质量门禁，不通过就降级，而不是带病发布。
4. OCR 按页路由，Standard 按质量路由，避免对所有文档支付最高成本。
5. LLM 只做受约束结构修复，原文、页码和坐标必须由程序验证。
6. 查询使用树优先 + 页级兜底，最终答案必须回到原始 Evidence，不能只引用树摘要。

