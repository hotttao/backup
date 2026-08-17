# 提交与恢复

## 一期视频一次提交

每成功处理一期都必须提交文章；批量处理也不能例外。这样才能精确回退某一期。

Commit 标题使用以下格式，其中 `<POSITION>` 是视频的 `videos.season_position`：

```text
docs(tools): add Koala weekly #<POSITION> YYYY-MM-DD (<BVID>)
```

标题中的日期使用 Bilibili 视频发布日期，不是某个工具的发布日期。

Commit 正文使用：

```text
Episode: <完整视频标题>
Season-Position: <合集期数>
Published: <YYYY-MM-DD，能够获得时保留完整时间和时区>
BVID: <BVID>
Tools: <数量> (<用英文逗号分隔的核验后工具名>)
State-Key: tool-summary:anything
```

示例：

```text
docs(tools): add Koala weekly #1 2026-08-02 (BV1Fz3X62ETW)

Episode: 科技周报｜DeepSeek 正式版 V4-Flash；2G 内存跑 26B 模型；自托管的迷你 Heroku
Season-Position: 1
Published: 2026-08-02T04:22:20+00:00
BVID: BV1Fz3X62ETW
Tools: 6 (DeepSeek V4-Flash-0731, TurboFieldfare, Dokku, GitHub Stacked Pull Requests, Supapool, Buzz)
State-Key: tool-summary:anything
```

## 安全暂存

任务开始前，要求 `posts/tool/anything.md` 没有未提交修改，或者其中所有修改都属于当前视频。如果存在无关用户修改，请用户先决定如何拆分。

只暂存文章：

```powershell
git add -- posts/tool/anything.md
git diff --cached --name-only
git diff --cached --check
git diff --cached -- posts/tool/anything.md
```

暂存列表必须恰好为：

```text
posts/tool/anything.md
```

禁止使用 `git add -A`、`git add .`，禁止暂存 `bilibili/data/state.db`。运行状态和二进制文件必须保持忽略。

使用非交互方式提交。PowerShell 可使用：

```powershell
git commit `
  -m "docs(tools): add Koala weekly #<POSITION> <DATE> (<BVID>)" `
  -m "Episode: <TITLE>`nSeason-Position: <POSITION>`nPublished: <TIMESTAMP>`nBVID: <BVID>`nTools: <COUNT> (<NAMES>)`nState-Key: tool-summary:anything"
```

检查提交结果：

```powershell
git show --stat --oneline --summary HEAD
git show --format=fuller --no-patch HEAD
```

只有 commit 成功后，才把当前视频状态标记为 `completed`。

## 失败与中断处理

- 联网核验只完成一部分：保持 `processing`；每完成一项就导入完整累计数组。
- 项目身份或来源无法确认：把状态设为 `failed`，保留已经核验的缓存，并在 `--error` 中记录精确阻塞原因。
- 文章校验失败：保持 `processing`，禁止暂存或提交。
- Commit 失败：保持 `processing`，解决 Git 问题后重试同一期。
- Commit 成功但完成状态更新失败：禁止再创建 commit，只重试状态更新。

记录真实失败：

```powershell
uv run bili-sync task-update tool-summary:anything <BVID> `
  --status failed --output-path ../posts/tool/anything.md `
  --item-count <VERIFIED_COUNT> --error "<可操作的错误原因>"
```

## 恢复矩阵

继续任务前，同时检查数据库状态、缓存条目、文章内容和 Git 历史。

| 数据库状态 | 文章中有对应行 | Git 中有包含 BVID 的 commit | 操作 |
| --- | --- | --- | --- |
| `completed` | 有 | 有 | 跳过本期。 |
| `processing` / `failed` | 无 | 无 | 复用缓存，从未完成的提取或搜索继续。 |
| `processing` / `failed` | 有 | 无 | 校验文章、补齐缺失内容，然后创建本期唯一 commit。 |
| `processing` / `failed` | 有 | 有 | 禁止重复提交；校验后只把状态修复为 `completed`。 |
| `completed` | 有 | 无 | 状态不一致；检查历史并在补建 commit 前询问用户。 |
| 任意 | 无 | 有 | 检查该 commit 是否被回退，禁止直接重新添加。 |

使用稳定的 BVID 搜索历史：

```powershell
git log --all --grep="<BVID>" --format="%H %ad %s" --date=iso-strict
```

## 批量处理约束

用户授权批量处理后，严格循环：

1. 选择一期。
2. 完整提取并核验。
3. 更新文章。
4. 校验。
5. 只提交本期。
6. 标记本期完成。
7. 重新读取状态后再选择下一期。

禁止让多期内容同时留在未提交的文章 diff 中。发生校验或 commit 失败时立即停止批量任务，除非用户明确允许跳过失败项。
