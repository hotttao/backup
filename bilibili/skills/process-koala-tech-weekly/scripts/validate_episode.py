from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


def fail(message: str) -> None:
    raise ValueError(message)


def markdown_cell_count(line: str) -> int:
    return len(line.split("|")) - 2


def main() -> int:
    parser = argparse.ArgumentParser(
        description="校验一期视频的数据库缓存和工具目录文章行。"
    )
    parser.add_argument("--db", type=Path, required=True)
    parser.add_argument("--article", type=Path, required=True)
    parser.add_argument("--task-key", default="tool-summary:anything")
    parser.add_argument("--bvid", required=True)
    parser.add_argument(
        "--allowed-status",
        action="append",
        choices=("pending", "processing", "completed", "failed"),
        required=True,
    )
    args = parser.parse_args()

    if not args.db.is_file():
        parser.error(f"状态数据库不存在：{args.db}")
    if not args.article.is_file():
        parser.error(f"文章不存在：{args.article}")

    connection = sqlite3.connect(args.db)
    connection.row_factory = sqlite3.Row
    try:
        task = connection.execute(
            "SELECT * FROM processing_tasks WHERE task_key = ? AND bvid = ?",
            (args.task_key, args.bvid),
        ).fetchone()
        items = connection.execute(
            """
            SELECT * FROM processing_task_items
             WHERE task_key = ? AND bvid = ?
             ORDER BY item_key
            """,
            (args.task_key, args.bvid),
        ).fetchall()
    finally:
        connection.close()

    if task is None:
        fail("当前视频没有 processing_tasks 记录")
    if task["status"] not in args.allowed_status:
        fail(
            f"任务状态 {task['status']!r} 不在允许范围内：{args.allowed_status}"
        )
    if not items:
        fail("当前视频没有工具级缓存")

    article = args.article.read_text(encoding="utf-8")
    lines = article.splitlines()
    headers = [
        line
        for line in lines
        if line.startswith("| 工具名称 | 作用 | 发布时间 | Koala 给予的评价 |")
    ]
    if not headers:
        fail("文章中没有六列表格表头")

    malformed = []
    for number, line in enumerate(lines, start=1):
        if not line.startswith("|"):
            continue
        if line.startswith("| ---") or line.startswith("| 工具名称"):
            continue
        if markdown_cell_count(line) != 6:
            malformed.append(number)
    if malformed:
        fail(f"以下表格行不是六列：{malformed}")

    errors: list[str] = []
    for item in items:
        name = item["tool_name"]
        if item["lookup_status"] != "verified":
            errors.append(f"{name}：lookup_status 不是 verified")
        if not item["project_url"].startswith("https://"):
            errors.append(f"{name}：project_url 缺失或不是 HTTPS")
        if not item["project_date_source_url"].startswith("https://"):
            errors.append(f"{name}：日期来源 URL 缺失或不是 HTTPS")
        if args.bvid not in item["video_url"]:
            errors.append(f"{name}：video_url 不包含本期 BVID")
        for required in (
            name,
            item["project_published_at"],
            item["video_url"],
            item["project_url"],
        ):
            if required not in article:
                errors.append(f"{name}：文章缺少 {required!r}")
    if errors:
        fail("; ".join(errors))

    result = {
        "valid": True,
        "bvid": args.bvid,
        "task_status": task["status"],
        "cached_items": len(items),
        "tool_names": [item["tool_name"] for item in items],
        "table_headers": len(headers),
        "malformed_rows": 0,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
