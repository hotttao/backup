---
weight: 1
title: "精确的文本切分和 Source Check"
date: 2026-06-03T22:00:00+08:00
lastmod: 2026-06-03T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Agent Skills 设计"
featuredImage:

tags: ["agent 设计"]
categories: ["Agent"]

lightgallery: true
---

## SouceCheck Spec

``````md
## Goal
SourceCheck defines a machine‑readable format for attaching source citations to LLM output. It lets consumers programmatically check which parts of an answer are grounded in which document spans, without embedding full quoted text inside annotations.

## Session Model
A session is the top‑level container. It holds a set of documents and a list of annotations.

A session contains:
- an array of `documents`
- an array of `annotations`

```json
{
  "documents": [ ... ],
  "annotations": [ ... ]
}
```

### Session rules
- Within a session, every document has a unique `path`.
- References (`ref`) are resolved against documents inside the same session.
- Documents are immutable within a session.

## Document Model
A document is:
```json
{
  "path": "a",
  "content": "..."
}
```

Before being added to a session, **content MUST** be normalized to use LF (`\n`) line endings. CRLF and CR inputs are the caller's responsibility to convert. The resolver assumes LF‑only input.

For reference resolution, content is interpreted as ordered lines.

Example:
```
1 | Hello, I am GPT
2 | How are you feeling today?
3 | We can talk now.
```

## Ref Model
A ref identifies an exact text span inside a document.
```json
{
  "path": "a",
  "start": { "line": 1, "str": "I" },
  "end": { "line": 1, "str": "T" }
}
```

- `start.line` and `end.line` are 1‑based.
- `start.str` and `end.str` are boundary strings, not comments and not hints. They are part of the coordinate system.

### Ref Semantics
A ref resolves to a closed text span:
- the span starts at the first character of `start.str` on `start.line`
- the span ends at the last character of `end.str` on `end.line`
- the resolved span includes both boundary strings

For the example above:
```json
{
  "path": "a",
  "start": { "line": 1, "str": "I" },
  "end": { "line": 1, "str": "T" }
}
```
resolves to:
```
I am GPT
```

#### Resolution Rules
A resolver must:
1. look up the document in the current session by path
2. find `start.str` within `start.line`
3. find `end.str` within `end.line`
4. extract the span from the start boundary to the end boundary, inclusive

Multi‑line refs are allowed if `start.line ≤ end.line`.

### Validity
A ref is valid if:
- `path` exists in the current session
- `start.line` exists
- `end.line` exists
- `start.str` occurs in `start.line`
- `end.str` occurs in `end.line`
- `start.line ≤ end.line`
- the resolved start boundary does not come after the resolved end boundary
- the span can be determined uniquely

Otherwise the ref is invalid.

#### Uniqueness
If a boundary string appears multiple times and the resolver cannot determine a unique span, the ref is invalid.

SourceCheck does not define extra disambiguation fields. Ambiguous refs should fail instead of guessing.

**The only way to disambiguate is to extend str until it is unique on its line.** SourceCheck intentionally provides no occurrence index, no surrounding‑context field, and no other disambiguation mechanism. If a boundary is not unique, the ref author must choose a longer boundary string.

## Annotation
An annotation attaches evidence to a specific span of text. Both the annotated span and the evidence are expressed as refs into documents in the session — the annotation itself never repeats text.

```json
{
  "claim": {
    "path": "output",
    "start": { "line": 2, "str": "result" },
    "end": { "line": 2, "str": "positive" }
  },
  "sources": [
    {
      "path": "report",
      "start": { "line": 5, "str": "outcome" },
      "end": { "line": 5, "str": "positive" },
      "polarity": "supports",
      "confidence": 0.9
    }
  ]
}
```

- `claim` is a ref. It points at the span of text being annotated.
- `sources` is a non‑empty list of source refs. Each entry is a regular ref plus two required metadata fields:
  - `polarity` — `"supports"` or `"refutes"`
  - `confidence` — a number in `[0, 1]`

- The resolver treats `claim` and the spatial part of each source uniformly. `polarity` and `confidence` are not interpreted by the resolver — they are signals to consumers.

### Annotation Rules
- `sources` **MUST** contain at least one entry. An annotation with no sources is invalid — the way to express “this region is unsourced” is to not annotate it at all.
- The same claim span **MAY** appear in multiple annotations (for example, when independently supported by multiple evidence sets). SourceCheck does not merge them; that is left to the caller.
- `claim.path` **MAY** refer to any document in the session. SourceCheck does not distinguish “output” documents from “source‑of‑truth” documents — that role is decided by the caller.

A model’s output is a list of annotations. The annotated text itself lives in the session as a document; it is never reproduced in the annotation payload. If a region of a document carries no annotations, that absence is a meaningful signal — it means the region is unsourced — and should not be silently treated as sourced.

### Polarity
Each source declares its relationship to the claim:
- `"supports"` — the cited span, read on its own, evidences the claim.
- `"refutes"` — the cited span contradicts the claim.

A source that is merely topically related but does neither **MUST NOT** be cited. SourceCheck has no “loosely related” role; topic match is not evidence.

Multiple polarities for the same claim are explicit, not exceptional: a claim’s annotation may carry both supports and refutes sources. Aggregating these into a verdict (“net supported”, “contested”, “refuted”) is the consumer’s responsibility.

### Confidence
`confidence` is the citing party’s assessment of how authoritative the source is for this claim, in `[0, 1]`. The resolver enforces only the type and range; the meaning is conventional:
- **0.9‑1.0** — primary / authoritative source: official spec, peer‑reviewed paper, primary data, the entity being described.
- **0.6‑0.8** — reputable secondary source: mainstream press, named‑author technical post.
- **0.3‑0.5** — anecdotal / forum / unverified source.
- **<0.3** — weak; usually omit instead of citing.

Confidence is per‑source, not per‑claim. A claim may be supported by a primary source at 0.95 and a forum post at 0.4 in the same annotation; consumers can weigh them.

## Design Principle
SourceCheck follows a DRI (**Do Not Repeat Input**) rule:
- the model should output minimal reference metadata
- the model should not repeat document text in order to cite it — not even the text it has just produced
- the external program resolves and verifies refs against the original document content

> The model’s job is to point at text. The resolver’s job is to produce it.

``````

## 整体概念总结
1. **Session会话**：顶层容器，存放一批Document文档 + Annotation注解，文档不可变更，ref引用全部在会话内解析。
2. **Document文档**：path唯一标识，content强制LF换行，按行组织文本。
3. **Ref引用定位**：`path + 行号(1开始) + 行内边界字符串str`定位文本片段，**不用字符偏移**；边界字符串必须在行内唯一，出现多次直接判定ref无效，通过加长str消除歧义；支持跨行。
4. **Annotation注解**：把claim（待核验的文本片段ref）绑定多个source证据ref；
   - sources数组不能为空，**无来源则直接不加注解，禁止空数组**；
   - polarity只允许`supports`/`refutes`，仅话题相关不能引用；
   - confidence置信度作用于单条source，不是作用于claim；同一个claim可以同时有支持/反驳证据，结果聚合交给上层业务。
5. **DRI核心设计原则**：模型只输出索引元数据，**绝不拷贝原文**；外部Resolver负责根据ref回原始文档解析、提取、校验文本。


## SourceCheck Skills

``````md
# SourceCheck
name: `sourcecheck`
> Yanzhen Yu, 2 weeks ago

description: Produce machine‑verifiable source‑span citations for LLM output using the SourceCheck protocol.
Use when a task requires attaching references that point at exact text in source documents (fact‑checking, grounded generation, citation emission).

## SourceCheck
A protocol for pointing at exact text spans in source documents and declaring whether each source **supports** or **refutes** a specific claim. SourceCheck is about **coordinates plus polarity**, not quotes — annotations never repeat the cited text.

### Core model
```ts
Document = { path: string, content: string }      // content is LF‑separated
Session  = { documents: Document[] }              // paths unique within a session

RefBoundary = { line: number, str: string }       // str must occur exactly once on its line
Ref         = { path: string, start: RefBoundary, end: RefBoundary }

SourceRef = Ref & {
    polarity: "supports" | "refutes"              // required
    confidence: number                            // required, in [0, 1]
}

Annotation = { claim: Ref, sources: SourceRef[] }  // sources non‑empty
```

The resolved span starts at the first character of `start.str` on `start.line` and ends at the last character of `end.str` on `end.line`, inclusive. Multi‑line spans are allowed if `start.line ≤ end.line`.

The resolver does not interpret `polarity` or `confidence`. Both are signals for the consumer (e.g. a UI, a downstream verifier, an aggregating script).

### What counts as a source
A source is **evidence the claim is true or false**. It is **not** topically related material.

A span qualifies as `supports` only if a careful reader, reading **only that span**, would conclude that the specific factual claim is correct. Echoing the same topic, naming the same entity, or asserting an unrelated fact about the same domain does not qualify.

A span qualifies as `refutes` only if it directly contradicts the claim. "The source doesn't mention this" is not refutation; it is absence of evidence — leave the claim unannotated.

If you cannot find evidence in either direction, **do not annotate**. The empty annotation set for a region is a meaningful signal: "I looked and could not substantiate this." Filling in citations to look thorough is the failure mode this protocol exists to prevent.

#### Anti‑patterns (do NOT cite)
- **Topic match.** Article says "Kubernetes 2.0 introduces …", source mentions "Kubernetes 1.36 release". Same project, different fact. ❌
- **Negation match without polarity flag.** Article says "no YAML anywhere", source says "objects are configured in YAML or JSON". This is contradictory evidence — cite it as `refutes`, not `supports`. ❌ when emitted as supports.
- **Vague endorsement.** Article: "79% of outages from YAML, per 2025 CNCF report". Source: a 2025 CNCF report that discusses Kubernetes adoption but never gives that number. The report exists; the number is not in it. ❌
- **Self‑quote.** Article quotes itself, or quotes a press release that the article is summarizing, as if the press release independently confirms it. Tautological – cite the underlying primary source, not the restatement.

### Polarity
| polarity | meaning |
|---|---|
| `supports` | The cited span, read alone, evidences the claim. |
| `refutes` | The cited span directly contradicts the claim. |

A claim may be supported by some sources and refuted by others in the same annotation. That is expressive, not a contradiction in the data — record both.

### Confidence
`confidence` is your assessment of how authoritative this source is **for this claim**, in `[0, 1]`. Use these bands:

| band | tier | examples |
|---|---|---|
| 0.9‑1.0 | primary / authoritative | the entity being described, official spec / standard, peer‑reviewed paper, primary dataset, original release notes |
| 0.6‑0.8 | reputable secondary | mainstream press, named‑author technical post, well‑maintained docs by a third party |
| 0.3‑0.5 | anecdotal / unverified | forum, social media, blog without attribution |
| < 0.3 | weak | usually OMIT instead of citing |

A primary source is one that **originated** the fact (e.g. a release note for a release, the paper for a research result). Secondary sources reference it. If you can find the primary source, prefer it.

The same source may have different confidence for different claims. A vendor's marketing page is 0.9 for "what the vendor says about itself" but 0.4 for "how the product compares to competitors".

### Self‑check rubric
Before emitting any annotation, ask:
1. **Standalone test.** If a reader saw only the source span (no surrounding context, no other sources), would they conclude the claim is true (or false, for `refutes`)? If unsure → don't cite.
2. **Specificity test.** Does the source span assert the **same fact**, not just touch the same topic? A span that mentions "Kubernetes" doesn't support every Kubernetes claim.
3. **Authority test.** Is this source authoritative for this kind of claim? If you wouldn't trust this source on this question, lower confidence — or omit.
4. **Primary check.** Is there a more primary source? If yes, swap or add it.
5. **Contradiction check.** Did you find evidence that contradicts the claim? Cite it as `refutes`, not silence.

If a claim survives this rubric with no qualifying sources, leave it unannotated.

#### How to produce annotations
Given a session containing the text to verify (let's call its path `output` or `article`) and one or more source documents:

1. Walk one factual claim at a time. For each:
    - Locate the span in the article that expresses the claim. That's `claim`.
    - Search the sources. Apply the rubric above to each candidate.
    - For each candidate that survives, emit a `SourceRef` with `polarity` and `confidence` set explicitly.
2. For `start.str` / `end.str`: pick the **shortest substring that is unique on its line**. If ambiguous, extend it. There is no occurrence‑index field.
3. Skip claims with no qualifying evidence. Coverage gaps are correct, not failure.
4. Validate via `sourcecheck --json`. Iterate until exit 0.

### Uniqueness, spelled out
The only disambiguation mechanism is extending `str`. If the word "the" appears five times on a line and you want the fourth one, choose a longer boundary like `"the report"` that occurs once. If every candidate is ambiguous, pick a longer boundary on adjacent words.

### Validity checklist
A `Ref` is valid iff:
- `path` exists in the session (and is unique within it)
- `start.line` and `end.line` are within the document
- `start.str` occurs exactly once on `start.line`
- `end.str` occurs exactly once on `end.line`
- `start.line ≤ end.line`, and on a single‑line span, the start boundary does not come after the end boundary

A `SourceRef` is valid iff its `Ref` part is valid AND `polarity ∈ {"supports", "refutes"}` AND `confidence ∈ [0, 1]`.

An `Annotation` is valid iff `claim` is valid, every `SourceRef` is valid, and `sources` has at least one entry.

### CLI
```bash
sourcecheck input.json          # human‑readable
sourcecheck --json input.json   # machine‑readable
cat input.json | sourcecheck    # stdin
```

Input shape — check a batch of annotations:
```json
{
  "session": { "documents": [ ... ] },
  "annotations": [
    {
      "claim": { "path": "article", "start": { ... }, "end": { ... } },
      "sources": [
        {
          "path": "report",
          "start": { ... }, "end": { ... },
          "polarity": "supports",
          "confidence": 0.9
        }
      ]
    }
  ]
}
```

**Exit codes:**
- `0` = all refs resolved
- `1` = at least one resolution failure
- `2` = invalid JSON or schema (missing/invalid polarity, confidence out of range, etc.)

After emitting annotations, **always run `sourcecheck --json`** before returning. If anything fails, fix the coordinates or metadata — do not guess.

### Common mistakes
- **Citing a topically related span as `supports`.** This is the dominant failure mode. Apply the standalone test.
- **Treating contradictory evidence as `supports`.** If the source says the opposite of the claim, the polarity is `refutes`.
- **Omitting `polarity` or `confidence`.** Both are required. Schema validation will reject the annotation.
- **Over‑citing weak sources.** A forum post at confidence 0.4 may be honest, but if it's the only thing you have for a strong claim, the strong claim is unsourced — omit the annotation.
- **Repeating cited text in the annotation.** Forbidden. Metadata is coordinates only.
- **Empty `sources` array.** Invalid. To express "unsourced", do not annotate that region.
- **Ambiguous boundary.** Extend `str` until unique. There is no occurrence index.
- **Off‑by‑one line number.** Lines are 1‑based and split on LF. Blank lines count.
- **CRLF input.** The resolver assumes LF. Normalize before adding to the session.
- **Path not in session.** Every ref's `path` must match a document in the session. Quoting an external URL is not a valid ref.

#### Tiny worked example
Session:
```json
{
  "documents": [
    {"path": "article", "content": "# Orbit 2.4\n\nOrbit 2.4 improves cold‑start latency by 37%."},
    {"path": "bench", "content": "2.3.0: 820ms\n2.4.0: 517ms\ndelta: -37%"}
  ]
}
```

Annotation — the "37%" claim, supported by primary benchmark data:
```json
{
  "claim": {
    "path": "article",
    "start": { "line": 3, "str": "37%" },
    "end":   { "line": 3, "str": "37%" }
  },
  "sources": [
    {
      "path": "bench",
      "start": { "line": 3, "str": "delta" },
      "end":   { "line": 3, "str": "-37%" },
      "polarity": "supports",
      "confidence": 0.95
    }
  ]
}
```

The benchmark file is the primary source for the number → confidence 0.95. The article and the annotation never restate the text "‑37%"; the resolver reconstructs it from coordinates.

#### Authority
This skill is a working summary. The normative definition lives in `SPEC.md`. When in doubt, defer to SPEC.

`````