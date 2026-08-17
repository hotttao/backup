from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from .models import CollectionMetadata, VideoMetadata


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class StateDatabase:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.migrate()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def migrate(self) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS collections (
                    season_id INTEGER PRIMARY KEY,
                    title TEXT NOT NULL,
                    source_bvid TEXT NOT NULL,
                    owner_mid TEXT,
                    owner_name TEXT,
                    episode_count INTEGER NOT NULL,
                    last_scanned_at TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS videos (
                    bvid TEXT PRIMARY KEY,
                    aid INTEGER,
                    cid INTEGER,
                    title TEXT NOT NULL,
                    url TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    duration_seconds INTEGER,
                    owner_mid TEXT,
                    owner_name TEXT,
                    video_status TEXT NOT NULL DEFAULT 'pending',
                    subtitle_status TEXT NOT NULL DEFAULT 'pending',
                    process_status TEXT NOT NULL DEFAULT 'pending',
                    video_path TEXT,
                    subtitle_path TEXT,
                    subtitle_source TEXT,
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT,
                    discovered_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    processed_at TEXT
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS processing_tasks (
                    task_key TEXT NOT NULL,
                    bvid TEXT NOT NULL,
                    output_path TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    item_count INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT,
                    processed_at TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (task_key, bvid),
                    FOREIGN KEY (bvid) REFERENCES videos(bvid)
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS processing_task_items (
                    task_key TEXT NOT NULL,
                    bvid TEXT NOT NULL,
                    item_key TEXT NOT NULL,
                    tool_name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    purpose TEXT NOT NULL,
                    project_published_at TEXT,
                    project_date_source_url TEXT,
                    video_url TEXT NOT NULL,
                    project_url TEXT NOT NULL,
                    koala_evaluation TEXT NOT NULL,
                    lookup_status TEXT NOT NULL DEFAULT 'pending',
                    lookup_notes TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (task_key, bvid, item_key),
                    FOREIGN KEY (task_key, bvid)
                        REFERENCES processing_tasks(task_key, bvid)
                )
                """
            )
            existing = {
                row[1] for row in connection.execute("PRAGMA table_info(videos)").fetchall()
            }
            additions = {
                "published_at": "TEXT",
                "season_id": "INTEGER",
                "season_position": "INTEGER",
            }
            for column, kind in additions.items():
                if column not in existing:
                    connection.execute(f"ALTER TABLE videos ADD COLUMN {column} {kind}")

    def upsert_collection(self, collection: CollectionMetadata) -> None:
        now = utc_now()
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO collections (
                    season_id, title, source_bvid, owner_mid, owner_name,
                    episode_count, last_scanned_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(season_id) DO UPDATE SET
                    title = excluded.title,
                    source_bvid = excluded.source_bvid,
                    owner_mid = excluded.owner_mid,
                    owner_name = excluded.owner_name,
                    episode_count = excluded.episode_count,
                    last_scanned_at = excluded.last_scanned_at,
                    updated_at = excluded.updated_at
                """,
                (
                    collection.season_id,
                    collection.title,
                    collection.source_bvid,
                    collection.owner_mid,
                    collection.owner_name,
                    collection.episode_count,
                    now,
                    now,
                    now,
                ),
            )

    def upsert_metadata(self, metadata: VideoMetadata) -> None:
        now = utc_now()
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO videos (
                    bvid, aid, cid, title, url, description, duration_seconds,
                    owner_mid, owner_name, published_at, season_id,
                    season_position, discovered_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(bvid) DO UPDATE SET
                    aid = excluded.aid,
                    cid = COALESCE(excluded.cid, videos.cid),
                    title = excluded.title,
                    url = excluded.url,
                    description = excluded.description,
                    duration_seconds = excluded.duration_seconds,
                    owner_mid = excluded.owner_mid,
                    owner_name = excluded.owner_name,
                    published_at = COALESCE(excluded.published_at, videos.published_at),
                    season_id = COALESCE(excluded.season_id, videos.season_id),
                    season_position = COALESCE(
                        excluded.season_position, videos.season_position
                    ),
                    updated_at = excluded.updated_at
                """,
                (
                    metadata.bvid,
                    metadata.aid,
                    metadata.cid,
                    metadata.title,
                    metadata.url,
                    metadata.description,
                    metadata.duration_seconds,
                    metadata.owner_mid,
                    metadata.owner_name,
                    metadata.published_at,
                    metadata.season_id,
                    metadata.season_position,
                    now,
                    now,
                ),
            )

    def collection_rows(self, season_id: int) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM videos
                 WHERE season_id = ?
                 ORDER BY season_position ASC, published_at ASC, bvid ASC
                """,
                (season_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def all_rows(self) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT * FROM videos ORDER BY published_at ASC, bvid ASC"
            ).fetchall()
        return [dict(row) for row in rows]

    def set_artifact_paths(
        self,
        bvid: str,
        *,
        video_path: Path | None,
        subtitle_path: Path | None,
    ) -> None:
        self._update(
            bvid,
            video_path=str(video_path.resolve()) if video_path else None,
            subtitle_path=str(subtitle_path.resolve()) if subtitle_path else None,
            updated_at=utc_now(),
        )

    def collection_summary(self, season_id: int) -> dict[str, Any]:
        with self.connect() as connection:
            collection = connection.execute(
                "SELECT * FROM collections WHERE season_id = ?", (season_id,)
            ).fetchone()
            counts = connection.execute(
                """
                SELECT
                    COUNT(*) AS discovered,
                    SUM(CASE WHEN subtitle_path IS NOT NULL THEN 1 ELSE 0 END)
                        AS subtitles,
                    SUM(CASE WHEN process_status = 'completed' THEN 1 ELSE 0 END)
                        AS completed,
                    SUM(CASE WHEN process_status = 'failed' THEN 1 ELSE 0 END)
                        AS failed
                FROM videos WHERE season_id = ?
                """,
                (season_id,),
            ).fetchone()
        return {
            "collection": dict(collection) if collection else None,
            "counts": dict(counts) if counts else {},
        }

    def get(self, bvid: str) -> dict[str, Any] | None:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT * FROM videos WHERE bvid = ?", (bvid,)
            ).fetchone()
        return dict(row) if row else None

    def set_processing_task(
        self,
        *,
        task_key: str,
        bvid: str,
        status: str,
        output_path: str | None = None,
        item_count: int = 0,
        error: str | None = None,
    ) -> None:
        now = utc_now()
        processed_at = now if status == "completed" else None
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO processing_tasks (
                    task_key, bvid, output_path, status, item_count,
                    last_error, processed_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(task_key, bvid) DO UPDATE SET
                    output_path = COALESCE(excluded.output_path, output_path),
                    status = excluded.status,
                    item_count = excluded.item_count,
                    last_error = excluded.last_error,
                    processed_at = CASE
                        WHEN excluded.status = 'completed' THEN excluded.processed_at
                        ELSE NULL
                    END,
                    updated_at = excluded.updated_at
                """,
                (
                    task_key,
                    bvid,
                    output_path,
                    status,
                    item_count,
                    error,
                    processed_at,
                    now,
                    now,
                ),
            )

    def processing_task_rows(
        self, task_key: str, bvid: str | None = None
    ) -> list[dict[str, Any]]:
        with self.connect() as connection:
            if bvid:
                rows = connection.execute(
                    """
                    SELECT t.*, v.title, v.url, v.published_at, v.season_position
                      FROM processing_tasks t
                      JOIN videos v ON v.bvid = t.bvid
                     WHERE t.task_key = ? AND t.bvid = ?
                    """,
                    (task_key, bvid),
                ).fetchall()
            else:
                rows = connection.execute(
                    """
                    SELECT t.*, v.title, v.url, v.published_at, v.season_position
                      FROM processing_tasks t
                      JOIN videos v ON v.bvid = t.bvid
                     WHERE t.task_key = ?
                     ORDER BY v.published_at DESC, v.bvid ASC
                    """,
                    (task_key,),
                ).fetchall()
        return [dict(row) for row in rows]

    def replace_processing_task_items(
        self, *, task_key: str, bvid: str, items: list[dict[str, Any]]
    ) -> None:
        """Replace the cached, verified tool list for one video atomically."""
        now = utc_now()
        with self.connect() as connection:
            connection.execute(
                "DELETE FROM processing_task_items WHERE task_key = ? AND bvid = ?",
                (task_key, bvid),
            )
            for item in items:
                connection.execute(
                    """
                    INSERT INTO processing_task_items (
                        task_key, bvid, item_key, tool_name, category, purpose,
                        project_published_at, project_date_source_url, video_url,
                        project_url, koala_evaluation, lookup_status,
                        lookup_notes, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        task_key,
                        bvid,
                        item["item_key"],
                        item["tool_name"],
                        item["category"],
                        item["purpose"],
                        item.get("project_published_at"),
                        item.get("project_date_source_url"),
                        item["video_url"],
                        item["project_url"],
                        item["koala_evaluation"],
                        item.get("lookup_status", "verified"),
                        item.get("lookup_notes"),
                        now,
                        now,
                    ),
                )

    def processing_task_item_rows(
        self, task_key: str, bvid: str | None = None
    ) -> list[dict[str, Any]]:
        with self.connect() as connection:
            if bvid:
                rows = connection.execute(
                    """
                    SELECT * FROM processing_task_items
                     WHERE task_key = ? AND bvid = ?
                     ORDER BY item_key ASC
                    """,
                    (task_key, bvid),
                ).fetchall()
            else:
                rows = connection.execute(
                    """
                    SELECT i.* FROM processing_task_items i
                      JOIN videos v ON v.bvid = i.bvid
                     WHERE i.task_key = ?
                     ORDER BY v.published_at DESC, i.item_key ASC
                    """,
                    (task_key,),
                ).fetchall()
        return [dict(row) for row in rows]

    def set_processing(self, bvid: str) -> None:
        self._update(
            bvid,
            process_status="processing",
            last_error=None,
            updated_at=utc_now(),
        )

    def set_video_downloaded(self, bvid: str, path: Path) -> None:
        self._update(
            bvid,
            video_status="downloaded",
            video_path=str(path.resolve()),
            updated_at=utc_now(),
        )

    def set_subtitle(
        self, bvid: str, *, status: str, path: Path | None, source: str | None
    ) -> None:
        self._update(
            bvid,
            subtitle_status=status,
            subtitle_path=str(path.resolve()) if path else None,
            subtitle_source=source,
            updated_at=utc_now(),
        )

    def set_completed(self, bvid: str) -> None:
        now = utc_now()
        self._update(
            bvid,
            process_status="completed",
            last_error=None,
            processed_at=now,
            updated_at=now,
        )

    def set_failed(self, bvid: str, error: str) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                UPDATE videos
                   SET process_status = 'failed',
                       retry_count = retry_count + 1,
                       last_error = ?,
                       updated_at = ?
                 WHERE bvid = ?
                """,
                (error, utc_now(), bvid),
            )

    def _update(self, bvid: str, **values: Any) -> None:
        columns = ", ".join(f"{key} = ?" for key in values)
        with self.connect() as connection:
            connection.execute(
                f"UPDATE videos SET {columns} WHERE bvid = ?",
                (*values.values(), bvid),
            )
