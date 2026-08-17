# bili-sync

当前版本只处理一个显式指定的 BV 号，用于验证下载、字幕归档和增量状态记录。
也支持从一个种子 BV 号扫描其所属 UGC 合集，并逐期增量处理。它不会更新博客文章。

## 依赖

- Python 3.11+
- `bili`（`uv tool install "bilibili-cli[audio]"`）
- `BBDown.exe`（默认位置：`tools/bbdown/BBDown.exe`）
- 可选 ASR：`uv sync --extra asr`

## 使用

```powershell
uv sync --extra asr
uv run bili-sync one BV1Fz3X62ETW

# 扫描并处理种子视频所属的完整合集
uv run bili-sync collection BV1Fz3X62ETW --continue-on-error
```

默认优先保存平台字幕；平台没有字幕时使用 `faster-whisper` 的 `small`
模型生成本地 SRT。重复执行同一命令时，如果视频、字幕和元数据都仍存在，
会直接跳过。

运行数据写入 `data/`：

```text
data/
  state.db
  archive/<发布年份>/<bvid>/
    metadata.json
    video.mp4
    subtitle.asr.zh-CN.srt
  temporary/<bvid>/...
```

## 状态检查

```powershell
uv run bili-sync status
uv run bili-sync status --bvid BV1Fz3X62ETW
uv run bili-sync status --season-id 6725872

# 将旧版平铺目录迁移为按发布年份归档
uv run bili-sync migrate-layout

# 逐条验证某个合集的本地视频、字幕、元数据和年份目录
uv run bili-sync audit --season-id 249279

# 与下载状态共用 data/state.db 的后处理断点
uv run bili-sync task-update tool-summary:anything BV1Fz3X62ETW \
  --status completed --output-path ../posts/tool/anything.md --item-count 6
uv run bili-sync task-status tool-summary:anything

# 将逐条联网核验结果作为 UTF-8 JSON 数组写入同一个 state.db
uv run bili-sync task-items-import tool-summary:anything BV1Fz3X62ETW \
  --input items.json
uv run bili-sync task-items-status tool-summary:anything --bvid BV1Fz3X62ETW
```
