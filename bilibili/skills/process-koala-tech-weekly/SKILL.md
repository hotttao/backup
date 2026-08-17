---
name: process-koala-tech-weekly
description: 逐期处理 Koala 的 Bilibili《科技周报》：从本地归档字幕提取工具，逐条联网核验官网或 GitHub、项目发布时间和 Koala 评价，使用 SQLite 保存视频级与工具级断点，更新 posts/tool/anything.md，并严格做到一期视频一次 Git 提交。适用于继续、恢复、审计或批量执行 bilibili 项目中已下载的 Koala 科技周报工具目录维护任务。
---

# 处理 Koala 科技周报

除非用户明确要求批量处理，否则每次只处理一期。即使执行批量任务，也必须逐期完成、验证和提交，当前一期成功后才能开始下一期。

## 必读文档

采取任何任务操作前，完整阅读以下三个引用文档：

1. [环境与状态](references/environment-and-state.md)：环境准备、目录、命令、SQLite 字段和断点状态流转。
2. [联网核验与文章规范](references/research-and-catalog.md)：字幕提取、逐条联网搜索、分类、发布时间和文章表格结构。
3. [提交与恢复](references/commit-and-recovery.md)：一期一提交、失败处理和中断恢复规则。

这些文档是强制操作规程，不是可选背景资料。

## 不可破坏的约束

- 使用 `bilibili/data/state.db` 统一保存下载、单期总结和逐工具联网核验状态。
- 禁止提交 `bilibili/data/`、`bilibili/tools/`、`.venv/`、媒体、模型、数据库、缓存、可执行文件或压缩包。
- 优先读取 `bilibili/data/archive/<year>/<bvid>/` 中的本地字幕；已有可用字幕时不得重新下载或重复执行 ASR。
- 对新处理视频中提取出的每个工具分别联网搜索，并优先采用官方来源。
- 不限定具体联网 Skill、连接器、浏览器、CLI 或搜索服务；根据当前 Agent 实际拥有的能力选择工具。
- 每个已核验条目必须先写入 `processing_task_items`，再作为文章内容使用。
- Koala 的评价只能来自本期字幕，禁止用网上他人的观点代替。
- 工具目录内容只更新 [posts/tool/anything.md](../../../posts/tool/anything.md)。
- 所有分类表格固定使用六列：`工具名称`、`作用`、`发布时间`、`Koala 给予的评价`、`Koala 视频`、`GitHub / 项目地址`。
- 每处理一期，都必须单独提交一次 `posts/tool/anything.md`，禁止把两期合并到一个 commit。
- 当前一期文章 commit 成功且任务状态更新为 `completed` 后，才能开始下一期。

## 工作流程

### 1. 明确范围并检查工作区

从 Git 仓库根目录执行。编辑前检查 Git 状态。

- 保留用户已有修改。
- 不暂存无关路径。
- 如果 `posts/tool/anything.md` 已有不属于当前视频的未提交修改，停止并请用户决定如何拆分；禁止混入本期 commit。
- 用户要求一期时只能处理一期。
- 用户要求批量时，仍要串行重复完整流程，并在每期结束后单独 commit。

### 2. 检查环境、联网能力和状态

按照 `references/environment-and-state.md` 完成环境检查。

盘点当前 Agent 可用的联网能力。至少需要：搜索公开网页、打开结果页面、核验官方项目身份、查看仓库或版本发布时间。如果缺少合适能力，先寻找当前环境可用或可安装的工具/Skill；需要安装或额外授权时申请用户许可。如果最终仍不具备能力，明确报告缺失能力并停止，禁止跳过逐条搜索。

使用随 Skill 提供的只读脚本选择下一期：

```powershell
python bilibili/skills/process-koala-tech-weekly/scripts/next_pending_episode.py `
  --db bilibili/data/state.db --task-key tool-summary:anything --year 2026 --limit 1
```

如果仓库中的 `python` 是无法在沙箱启动的 `uv` 跳板程序，改用 `bilibili/.venv/Scripts/python.exe` 并申请正常执行授权。不要为了绕过权限另装 Python。

从存在字幕的候选中选择最新的 `pending`、`failed`、`processing` 或 `untracked` 视频。为了优先恢复断点，`processing` 视频优先级最高。

### 3. 搜索历史并恢复已有进度

同时检查视频级和工具级状态：

```powershell
Set-Location bilibili
uv run bili-sync task-status tool-summary:anything --bvid <BVID>
uv run bili-sync task-items-status tool-summary:anything --bvid <BVID>
```

在 Git 历史中搜索 BVID：

```powershell
git log --all --format="%H %ad %s" --date=iso-strict -- posts/tool/anything.md | Select-String <BVID>
```

按照 `references/commit-and-recovery.md` 中的恢复矩阵处理。复用已经标记为 `verified` 的条目；除非链接失效或明显核验错误，否则禁止重复联网搜索。

### 4. 将当前视频标记为处理中

对新任务或重试任务，先创建/更新断点：

```powershell
uv run bili-sync task-update tool-summary:anything <BVID> `
  --status processing --output-path ../posts/tool/anything.md --item-count 0
```

提取、搜索、编辑、验证和提交期间均保持 `processing`。Git commit 成功前不得标记为 `completed`。

### 5. 从完整字幕提取所有工具

完整阅读 SRT，不能只看视频标题或开头。按出现顺序建立工作清单，至少记录：

- 工具介绍开始时的字幕时间点；
- ASR 转写出的原始名称；
- 工具功能描述的上下文；
- Koala 明确表达的优点、缺点、适用对象、权衡或保留意见；
- 用于识别官方项目的公司、语言、平台、模型规模、协议等线索。

视频中作为独立项目介绍的模型、库、开发工具、托管服务、基础设施和协作产品都应纳入。重复提及同一项目时合并为一条。除非视频正在介绍某个通用技术本身，否则不要把描述中顺带出现的 Docker 等技术名误当成新条目。

### 6. 逐条联网核验并保存断点

严格遵循 `references/research-and-catalog.md`。即使 ASR 名称看起来正确，也必须对每个条目单独搜索。

不要假设其他 Agent 拥有相同工具。只约定所需动作：根据字幕线索搜索、打开权威页面、检查仓库或版本元数据、保存证据 URL。具体调用方式适配当前 Agent 的实际能力。

将当前视频已经核验的所有条目累计保存为 UTF-8 JSON 数组：

```text
bilibili/data/temporary/tool-summary/<bvid>.json
```

每核验完一个条目，就更新累计数组并写入数据库：

```powershell
uv run bili-sync task-items-import tool-summary:anything <BVID> `
  --input data/temporary/tool-summary/<bvid>.json
```

JSON 字段必须符合 `references/environment-and-state.md`。`task-items-import` 是整体替换语义，因此每次必须传入当前视频的完整累计数组，不能只传最新一项。

如果任务中断，保留累计 JSON 和数据库记录，后续 Agent 应从这些断点恢复。

### 7. 完成整期核验后更新文章

只有确认本期全部工具后，才编辑 `posts/tool/anything.md`。

- 每个已核验项目只添加一行。
- 优先放入最符合主要用途的现有分类。
- 只有确实没有合适分类时才新增分类。
- 避免在不同分类重复同一个工具。
- 当前视频范围外的旧条目保持不变，除非本期字幕明确补齐了它的来源。
- `发布时间` 使用工具或具体版本的真实公开日期，禁止填写 B 站视频发布日期。
- `Koala 视频` 链接必须定位到该工具开始介绍的时间点。
- 最后一列填写官方 GitHub；没有公开仓库时填写官网或官方项目页面。
- 保留 frontmatter；内容发生变化时将 `lastmod` 更新为当前日期。

### 8. 提交前验证

任务状态仍为 `processing` 时运行校验脚本：

```powershell
python bilibili/skills/process-koala-tech-weekly/scripts/validate_episode.py `
  --db bilibili/data/state.db `
  --article posts/tool/anything.md `
  --task-key tool-summary:anything `
  --bvid <BVID> `
  --allowed-status processing
```

然后运行项目测试：

```powershell
Set-Location bilibili
uv run python -B -m unittest discover -s tests -v
```

必须修复所有校验和测试失败。部分成功时禁止提交。

### 9. 只提交当前一期

严格执行 `references/commit-and-recovery.md` 中的暂存和 commit 规范。

只暂存文章：

```powershell
git add -- posts/tool/anything.md
git diff --cached --name-only
git diff --cached --check
```

暂存文件列表必须只有 `posts/tool/anything.md`。commit 标题必须包含合集期数、视频发布日期和 BVID；正文必须包含完整标题、精确发布时间、工具数量和状态键。

### 10. Commit 成功后再标记完成

只有 `git commit` 成功返回后，才能执行：

```powershell
Set-Location bilibili
uv run bili-sync task-update tool-summary:anything <BVID> `
  --status completed --output-path ../posts/tool/anything.md --item-count <COUNT>
```

使用 `--allowed-status completed` 再运行一次校验脚本，并确认下一期仍是 `pending` 或 `untracked`。除非用户明确授权批量处理，否则处理一期后立即停止。

## 完成报告

向用户报告：

- 合集期数、视频标题、发布日期和 BVID；
- 新增工具数量与名称；
- 文章路径；
- 状态数据库路径和最终状态；
- commit 哈希与标题；
- 测试和校验结果；
- 任何来源不确定性，尤其是只有官网、没有公开仓库的项目。

只处理一期时，禁止声称批量任务已经完成。
