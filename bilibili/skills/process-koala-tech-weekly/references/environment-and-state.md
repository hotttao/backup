# 环境与状态

## 仓库目录

先解析 Git 仓库根目录，不要假设固定盘符。下列路径均相对于仓库根目录：

```text
bilibili/
  .gitignore
  pyproject.toml
  uv.lock
  src/bili_sync/
  tests/
  data/                         # 运行状态，已忽略，禁止提交
    state.db
    archive/<year>/<bvid>/
      metadata.json
      video.<ext>
      subtitle*.srt
    temporary/tool-summary/    # 临时 JSON 断点，已忽略
  tools/                        # 本地二进制工具，已忽略，禁止提交
posts/tool/anything.md
```

## 环境准备

安装任何内容前先检查：

```powershell
git rev-parse --show-toplevel
Get-Command uv
Get-Command bili
Test-Path bilibili/tools/bbdown/BBDown.exe
Test-Path bilibili/data/state.db
```

只有 Python 环境缺失时才执行：

```powershell
Set-Location bilibili
uv sync --extra asr
```

状态脚本运行前，先执行一次只读状态命令。该命令会通过 `StateDatabase` 打开数据库，并应用 `processing_task_items` 等数据库迁移：

```powershell
uv run bili-sync status
```

只有 Bilibili 元数据 CLI 缺失时才安装：

```powershell
uv tool install "bilibili-cli[audio]"
```

只有确实需要下载时，才把 `BBDown.exe` 放到 `bilibili/tools/bbdown/`。该目录已被 Git 忽略。禁止把二进制文件移动到受版本控制的目录。

## 联网能力约定

不要假设其他 Agent 拥有相同的联网 Skill、连接器、浏览器、CLI、API 或搜索后端。

无论具体实现方式如何，都必须具备以下能力：

- 使用 ASR 名称和字幕上下文线索搜索公开网页；
- 打开并读取搜索结果页面；
- 区分官方仓库、官网、官方账号与镜像或第三方报道；
- 查看仓库创建时间、release/tag、模型页面、官方文档或作者首发记录；
- 保存能够证明项目身份和发布日期的稳定 URL。

开始任务时，先检查当前环境提供的能力和 Skills，选择权限影响最小且能够完成核验的方案，并遵守对应说明。如果没有合适能力，寻找当前环境可用或可安装的 Skill/工具；安装或外部访问需要授权时向用户申请。如果仍无法获得所需能力，明确报告阻塞，禁止发布未经核验的条目。

禁止把某个 Agent 专有的联网工具名称或命令写死在工作流中。证据标准固定，获取证据的机制可以变化。

## 下载与字幕命令

已有可用本地字幕时禁止执行以下下载/转写命令：

```powershell
Set-Location bilibili

# 处理一个明确指定的视频。
uv run bili-sync one <BVID>

# 扫描并处理种子视频所属的 UGC 合集。
uv run bili-sync collection <SEED_BVID> --continue-on-error

# 查看下载状态。
uv run bili-sync status --bvid <BVID>
```

流水线优先保存平台字幕；平台无字幕时才回退到本地 faster-whisper ASR。除非显式强制，重复运行时会跳过本地文件完整的视频。

## 状态数据库

统一使用 `bilibili/data/state.db`。禁止在数据库外另建平行的正式 JSON 状态账本。

相关表：

- `videos`：视频元数据、下载状态、字幕状态和处理状态。
- `processing_tasks`：每个 `(task_key, bvid)` 一条文章处理进度。
- `processing_task_items`：每个 `(task_key, bvid, item_key)` 一条工具联网核验结果。

`posts/tool/anything.md` 固定使用任务键 `tool-summary:anything`。

### 视频级字段

`processing_tasks` 记录：

- `status`：`pending`、`processing`、`completed` 或 `failed`；
- `output_path`：从 `bilibili/` 执行时通常为 `../posts/tool/anything.md`；
- `item_count`：本期最终写入的已核验工具数量；
- `last_error`：简洁且可操作的失败原因；
- `processed_at`：完成时间；
- `created_at`、`updated_at`。

从视频与任务的关联状态中读取 `season_position`、标题、URL 和精确的 `published_at`。Git commit 使用 `season_position` 作为合集期数。

### 逐工具 JSON 必填字段

`item_key` 使用稳定的小写 kebab-case。每项保存以下结构：

```json
{
  "item_key": "project-slug",
  "tool_name": "核验后的官方项目名称",
  "category": "文章中的分类标题",
  "purpose": "一句话说明主要作用",
  "project_published_at": "YYYY-MM-DD",
  "project_date_source_url": "https://能够证明日期的来源",
  "video_url": "https://www.bilibili.com/video/<BVID>?t=<SECONDS>",
  "project_url": "https://官方仓库或官网",
  "koala_evaluation": "仅根据字幕转述的评价",
  "lookup_status": "verified",
  "lookup_notes": "核验依据、歧义处理或未找到 GitHub 的说明"
}
```

项目 URL、日期证据或项目身份仍是猜测时，禁止把 `lookup_status` 标记为 `verified`。保持任务为 `processing` 并继续搜索；如果确实无法解决，使用清晰错误把本期标记为 `failed`，禁止把猜测写入文章。

### 断点更新顺序

1. 将视频创建/更新为 `processing`。
2. 每核验完一个工具，就通过 `task-items-import` 导入完整累计 JSON 数组。
3. 整期全部核验后再更新文章。
4. 校验并提交文章。
5. 使用最终条目数把视频标记为 `completed`。

`task-items-import` 会替换本期已有的全部工具缓存。每次禁止只传最新条目，必须传当前完整累计数组。
