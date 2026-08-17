from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(
        description="按处理中优先、发布时间倒序列出可恢复的 Koala 视频。"
    )
    parser.add_argument("--db", type=Path, required=True)
    parser.add_argument("--task-key", default="tool-summary:anything")
    parser.add_argument("--year", type=int)
    parser.add_argument("--limit", type=int, default=1)
    args = parser.parse_args()

    if not args.db.is_file():
        parser.error(f"状态数据库不存在：{args.db}")
    if args.limit < 1:
        parser.error("--limit 必须为正整数")

    connection = sqlite3.connect(args.db)
    connection.row_factory = sqlite3.Row
    try:
        rows = connection.execute(
            """
            SELECT
                v.bvid,
                v.title,
                v.url,
                v.published_at,
                v.subtitle_path,
                COALESCE(t.status, 'untracked') AS summary_status,
                COALESCE(t.item_count, 0) AS item_count,
                t.last_error,
                (SELECT COUNT(*) FROM processing_task_items i
                  WHERE i.task_key = ? AND i.bvid = v.bvid) AS cached_items
              FROM videos v
              LEFT JOIN processing_tasks t
                ON t.task_key = ? AND t.bvid = v.bvid
             WHERE v.subtitle_path IS NOT NULL
               AND COALESCE(t.status, 'untracked') != 'completed'
               AND (? IS NULL OR substr(v.published_at, 1, 4) = printf('%04d', ?))
             ORDER BY
                CASE COALESCE(t.status, 'untracked')
                    WHEN 'processing' THEN 0
                    WHEN 'failed' THEN 1
                    WHEN 'pending' THEN 2
                    ELSE 3
                END,
                v.published_at DESC,
                v.bvid ASC
             LIMIT ?
            """,
            (args.task_key, args.task_key, args.year, args.year, args.limit),
        ).fetchall()
    finally:
        connection.close()

    print(json.dumps([dict(row) for row in rows], ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
