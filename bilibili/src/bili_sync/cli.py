from __future__ import annotations

import argparse
import json
import shutil
import sys
from dataclasses import asdict
from pathlib import Path

import imageio_ffmpeg

from .backends import (
    BBDownBackend,
    BiliCliBackend,
    BilibiliCollectionBackend,
    find_executable,
)
from .audit import audit_collection
from .database import StateDatabase
from .pipeline import SingleVideoPipeline
from .transcriber import FasterWhisperTranscriber


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="bili-sync")
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    subparsers = parser.add_subparsers(dest="command", required=True)

    one = subparsers.add_parser("one", help="Process exactly one Bilibili video")
    one.add_argument("bvid")
    one.add_argument("--force", action="store_true")
    one.add_argument("--no-asr", action="store_true")
    one.add_argument("--asr-model", default="small")
    one.add_argument("--asr-device", choices=("cpu", "cuda"), default="cpu")
    one.add_argument(
        "--bbdown",
        type=Path,
        default=Path("tools/bbdown/BBDown.exe"),
    )

    status = subparsers.add_parser("status", help="Show recorded processing state")
    status.add_argument("--bvid")
    status.add_argument("--season-id", type=int)

    audit = subparsers.add_parser(
        "audit", help="Verify all local artifacts for one recorded collection"
    )
    audit.add_argument("--season-id", type=int, required=True)

    task_status = subparsers.add_parser(
        "task-status", help="Show resumable post-processing state"
    )
    task_status.add_argument("task_key")
    task_status.add_argument("--bvid")

    task_update = subparsers.add_parser(
        "task-update", help="Create or update one post-processing checkpoint"
    )
    task_update.add_argument("task_key")
    task_update.add_argument("bvid")
    task_update.add_argument(
        "--status", choices=("pending", "processing", "completed", "failed"), required=True
    )
    task_update.add_argument("--output-path")
    task_update.add_argument("--item-count", type=int, default=0)
    task_update.add_argument("--error")

    task_items_status = subparsers.add_parser(
        "task-items-status", help="Show cached per-item lookup results"
    )
    task_items_status.add_argument("task_key")
    task_items_status.add_argument("--bvid")

    task_items_import = subparsers.add_parser(
        "task-items-import", help="Replace one video's cached items from JSON stdin"
    )
    task_items_import.add_argument("task_key")
    task_items_import.add_argument("bvid")
    task_items_import.add_argument(
        "--input", type=Path, help="UTF-8 JSON file; defaults to stdin"
    )

    collection = subparsers.add_parser(
        "collection", help="Scan and process every episode in one UGC season"
    )
    collection.add_argument("seed_bvid")
    collection.add_argument("--asr-model", default="small")
    collection.add_argument("--asr-device", choices=("cpu", "cuda"), default="cpu")
    collection.add_argument("--continue-on-error", action="store_true")
    collection.add_argument(
        "--bbdown", type=Path, default=Path("tools/bbdown/BBDown.exe")
    )

    subparsers.add_parser(
        "migrate-layout", help="Move existing artifacts into archive/<year>/<bvid>"
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "status":
        database = StateDatabase(args.data_dir / "state.db")
        if args.season_id:
            print(
                json.dumps(
                    database.collection_summary(args.season_id),
                    ensure_ascii=False,
                    indent=2,
                )
            )
            return 0
        if not args.bvid:
            print(json.dumps({"database": str(database.path.resolve())}, indent=2))
            return 0
        print(json.dumps(database.get(args.bvid), ensure_ascii=False, indent=2))
        return 0

    if args.command == "audit":
        database = StateDatabase(args.data_dir / "state.db")
        result = audit_collection(args.data_dir, database, args.season_id)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result["valid"] else 3

    if args.command == "task-status":
        database = StateDatabase(args.data_dir / "state.db")
        rows = database.processing_task_rows(args.task_key, args.bvid)
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0

    if args.command == "task-update":
        database = StateDatabase(args.data_dir / "state.db")
        if database.get(args.bvid) is None:
            raise SystemExit(f"Unknown BVID in state database: {args.bvid}")
        database.set_processing_task(
            task_key=args.task_key,
            bvid=args.bvid,
            status=args.status,
            output_path=args.output_path,
            item_count=args.item_count,
            error=args.error,
        )
        print(
            json.dumps(
                database.processing_task_rows(args.task_key, args.bvid)[0],
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0

    if args.command == "task-items-status":
        database = StateDatabase(args.data_dir / "state.db")
        rows = database.processing_task_item_rows(args.task_key, args.bvid)
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0

    if args.command == "task-items-import":
        database = StateDatabase(args.data_dir / "state.db")
        if database.get(args.bvid) is None:
            raise SystemExit(f"Unknown BVID in state database: {args.bvid}")
        if args.input:
            items = json.loads(args.input.read_text(encoding="utf-8"))
        else:
            items = json.load(sys.stdin)
        if not isinstance(items, list):
            raise SystemExit("Expected a JSON array on stdin")
        database.replace_processing_task_items(
            task_key=args.task_key, bvid=args.bvid, items=items
        )
        rows = database.processing_task_item_rows(args.task_key, args.bvid)
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0

    if args.command == "migrate-layout":
        database = StateDatabase(args.data_dir / "state.db")
        moved = _migrate_layout(args.data_dir.resolve(), database)
        print(json.dumps({"migrated": moved}, ensure_ascii=False, indent=2))
        return 0

    bbdown = find_executable(args.bbdown)
    ffmpeg = Path(imageio_ffmpeg.get_ffmpeg_exe())
    transcriber = FasterWhisperTranscriber(
        model_name=args.asr_model,
        model_dir=args.data_dir / "models",
        device=args.asr_device,
        compute_type="float16" if args.asr_device == "cuda" else "int8",
    )
    pipeline = SingleVideoPipeline(
        data_dir=args.data_dir,
        metadata_backend=BiliCliBackend(),
        download_backend=BBDownBackend(bbdown, ffmpeg),
        transcriber=None if getattr(args, "no_asr", False) else transcriber,
    )
    if args.command == "one":
        result = pipeline.process(args.bvid, force=args.force)
        print(json.dumps(asdict(result), ensure_ascii=False, indent=2))
        return 0

    snapshot = BilibiliCollectionBackend().fetch(args.seed_bvid)
    pipeline.database.upsert_collection(snapshot.collection)
    for episode in snapshot.episodes:
        pipeline.database.upsert_metadata(episode)
    results = []
    failures = []
    for index, episode in enumerate(snapshot.episodes, start=1):
        print(
            f"[{index}/{len(snapshot.episodes)}] {episode.bvid} {episode.title}",
            flush=True,
        )
        try:
            result = pipeline.process(episode.bvid)
            results.append(asdict(result))
            print(f"  -> {result.status}: {result.subtitle_path}", flush=True)
        except Exception as error:
            failures.append({"bvid": episode.bvid, "error": str(error)})
            print(f"  -> failed: {error}", flush=True)
            if not args.continue_on_error:
                raise
    summary = pipeline.database.collection_summary(snapshot.collection.season_id)
    print(
        json.dumps(
            {"summary": summary, "results": results, "failures": failures},
            ensure_ascii=False,
            indent=2,
        )
    )
    if failures:
        return 2
    return 0


def _migrate_layout(data_dir: Path, database: StateDatabase) -> int:
    moved = 0
    for row in database.all_rows():
        published_at = row.get("published_at")
        year = str(published_at)[:4] if published_at else "unknown"
        if len(year) != 4 or not year.isdigit():
            year = "unknown"
        target_dir = data_dir / "archive" / year / row["bvid"]
        target_dir.mkdir(parents=True, exist_ok=True)

        video_path = _move_artifact(row.get("video_path"), target_dir, "video")
        subtitle_path = _move_artifact(
            row.get("subtitle_path"), target_dir, "subtitle"
        )
        old_metadata = data_dir / "metadata" / f"{row['bvid']}.json"
        metadata_path = target_dir / "metadata.json"
        if old_metadata.is_file() and old_metadata.resolve() != metadata_path.resolve():
            if metadata_path.exists():
                metadata_path.unlink()
            shutil.move(str(old_metadata), metadata_path)
            moved += 1

        database.set_artifact_paths(
            row["bvid"], video_path=video_path, subtitle_path=subtitle_path
        )
        if metadata_path.is_file():
            payload = json.loads(metadata_path.read_text(encoding="utf-8"))
            for field in ("cid", "published_at", "season_id", "season_position"):
                if payload.get(field) is None:
                    payload[field] = row.get(field)
            local = payload.setdefault("local", {})
            local["video_path"] = str(video_path.resolve()) if video_path else None
            local["subtitle_path"] = (
                str(subtitle_path.resolve()) if subtitle_path else None
            )
            metadata_path.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
            )
    return moved


def _move_artifact(
    source_value: str | None, target_dir: Path, stem: str
) -> Path | None:
    if not source_value:
        return None
    source = Path(source_value)
    if not source.is_file():
        return None
    target = target_dir / f"{stem}{source.suffix.lower()}"
    if source.resolve() == target.resolve():
        return target.resolve()
    if target.exists():
        target.unlink()
    shutil.move(str(source), target)
    return target.resolve()
