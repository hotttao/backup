from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .database import StateDatabase


def audit_collection(
    data_dir: Path, database: StateDatabase, season_id: int
) -> dict[str, Any]:
    """Verify every recorded artifact for one collection without changing it."""
    data_dir = data_dir.resolve()
    summary = database.collection_summary(season_id)
    collection = summary.get("collection")
    rows = database.collection_rows(season_id)
    errors: list[dict[str, str]] = []
    years: dict[str, int] = {}

    if collection is None:
        errors.append({"bvid": "", "error": "Collection is not recorded."})
        expected_count = 0
    else:
        expected_count = int(collection["episode_count"])
        if len(rows) != expected_count:
            errors.append(
                {
                    "bvid": "",
                    "error": (
                        f"Expected {expected_count} episodes but database has "
                        f"{len(rows)}."
                    ),
                }
            )

    positions = [row.get("season_position") for row in rows]
    if any(position is None for position in positions):
        errors.append({"bvid": "", "error": "Missing season position."})
    elif len(set(positions)) != len(positions):
        errors.append({"bvid": "", "error": "Duplicate season position."})

    for row in rows:
        bvid = row["bvid"]
        published_at = row.get("published_at")
        year = str(published_at)[:4] if published_at else "unknown"
        if len(year) != 4 or not year.isdigit():
            year = "unknown"
        years[year] = years.get(year, 0) + 1
        expected_dir = (data_dir / "archive" / year / bvid).resolve()

        for field in ("title", "url", "published_at"):
            if not row.get(field):
                errors.append({"bvid": bvid, "error": f"Missing {field}."})
        if row.get("process_status") != "completed":
            errors.append(
                {
                    "bvid": bvid,
                    "error": f"Process status is {row.get('process_status')!r}.",
                }
            )
        if row.get("last_error"):
            errors.append({"bvid": bvid, "error": row["last_error"]})

        video = _artifact_path(row, "video_path", expected_dir, errors)
        subtitle = _artifact_path(row, "subtitle_path", expected_dir, errors)
        if video and video.stat().st_size == 0:
            errors.append({"bvid": bvid, "error": "Video file is empty."})
        if subtitle:
            if subtitle.stat().st_size == 0:
                errors.append({"bvid": bvid, "error": "Subtitle file is empty."})
            else:
                content = subtitle.read_text(encoding="utf-8", errors="replace")
                if " --> " not in content:
                    errors.append(
                        {"bvid": bvid, "error": "Subtitle has no SRT timeline."}
                    )

        metadata_path = expected_dir / "metadata.json"
        if not metadata_path.is_file() or metadata_path.stat().st_size == 0:
            errors.append({"bvid": bvid, "error": "Metadata file is missing."})
        else:
            try:
                payload = json.loads(metadata_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as error:
                errors.append(
                    {"bvid": bvid, "error": f"Invalid metadata JSON: {error}"}
                )
            else:
                if payload.get("bvid") != bvid:
                    errors.append(
                        {"bvid": bvid, "error": "Metadata BVID does not match."}
                    )
                if not payload.get("title") or not payload.get("url"):
                    errors.append(
                        {"bvid": bvid, "error": "Metadata title or URL is missing."}
                    )

    return {
        "season_id": season_id,
        "title": collection.get("title") if collection else None,
        "expected": expected_count,
        "checked": len(rows),
        "years": dict(sorted(years.items())),
        "valid": len(rows) == expected_count and not errors,
        "error_count": len(errors),
        "errors": errors,
    }


def _artifact_path(
    row: dict[str, Any],
    field: str,
    expected_dir: Path,
    errors: list[dict[str, str]],
) -> Path | None:
    bvid = row["bvid"]
    value = row.get(field)
    if not value:
        errors.append({"bvid": bvid, "error": f"Missing {field}."})
        return None
    path = Path(value)
    if not path.is_file():
        errors.append({"bvid": bvid, "error": f"File does not exist: {path}"})
        return None
    if path.resolve().parent != expected_dir:
        errors.append(
            {
                "bvid": bvid,
                "error": f"{field} is outside expected archive directory.",
            }
        )
    return path
