from __future__ import annotations

import json
import os
import shutil
import subprocess
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .models import CollectionMetadata, CollectionSnapshot, VideoMetadata


class BackendError(RuntimeError):
    pass


def run_command(args: list[str], *, cwd: Path | None = None) -> str:
    environment = os.environ.copy()
    environment["PYTHONUTF8"] = "1"
    environment["PYTHONIOENCODING"] = "utf-8"
    process = subprocess.run(
        args,
        cwd=cwd,
        env=environment,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    output = "\n".join(part for part in (process.stdout, process.stderr) if part)
    if process.returncode != 0:
        raise BackendError(f"Command failed ({process.returncode}): {' '.join(args)}\n{output}")
    return output


def parse_first_json(value: str) -> dict[str, Any]:
    start = value.find("{")
    if start < 0:
        raise BackendError(f"Expected JSON output, received:\n{value}")
    try:
        result, _ = json.JSONDecoder().raw_decode(value[start:])
    except json.JSONDecodeError as error:
        raise BackendError(f"Invalid JSON output: {error}\n{value}") from error
    if not isinstance(result, dict):
        raise BackendError("Expected a JSON object from bili-cli")
    return result


class BiliCliBackend:
    def __init__(self, executable: str = "bili") -> None:
        self.executable = executable

    def fetch(self, bvid: str) -> tuple[VideoMetadata, dict[str, Any]]:
        output = run_command(
            [self.executable, "video", bvid, "--subtitle-timeline", "--json"]
        )
        envelope = parse_first_json(output)
        if not envelope.get("ok"):
            raise BackendError(f"bili-cli returned an error: {envelope}")

        data = envelope.get("data") or {}
        video = data.get("video") or {}
        owner = video.get("owner") or {}
        metadata = VideoMetadata(
            bvid=str(video.get("bvid") or video.get("id") or bvid),
            aid=_optional_int(video.get("aid")),
            cid=_optional_int(video.get("cid")),
            title=str(video.get("title") or bvid),
            url=str(video.get("url") or f"https://www.bilibili.com/video/{bvid}"),
            description=str(video.get("description") or ""),
            duration_seconds=_optional_int(video.get("duration_seconds")),
            owner_mid=str(owner.get("id")) if owner.get("id") is not None else None,
            owner_name=str(owner.get("name")) if owner.get("name") else None,
        )
        return metadata, envelope


class BilibiliCollectionBackend:
    VIEW_URL = "https://api.bilibili.com/x/web-interface/view?bvid={bvid}"

    def fetch(self, seed_bvid: str) -> CollectionSnapshot:
        request = urllib.request.Request(
            self.VIEW_URL.format(bvid=seed_bvid),
            headers={
                "User-Agent": "Mozilla/5.0 bili-sync/0.1",
                "Referer": f"https://www.bilibili.com/video/{seed_bvid}/",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                envelope = json.load(response)
        except (OSError, urllib.error.URLError, json.JSONDecodeError) as error:
            raise BackendError(f"Failed to fetch collection for {seed_bvid}: {error}") from error
        if envelope.get("code") != 0:
            raise BackendError(f"Bilibili collection API error: {envelope}")

        data = envelope.get("data") or {}
        season = data.get("ugc_season")
        if not season:
            raise BackendError(f"Video {seed_bvid} does not belong to a UGC season")
        owner = data.get("owner") or {}
        episodes: list[VideoMetadata] = []
        position = 0
        for section in season.get("sections") or []:
            for episode in section.get("episodes") or []:
                position += 1
                arc = episode.get("arc") or {}
                author = arc.get("author") or owner
                page = episode.get("page") or {}
                published = arc.get("pubdate")
                episodes.append(
                    VideoMetadata(
                        bvid=str(episode.get("bvid")),
                        aid=_optional_int(episode.get("aid")),
                        cid=_optional_int(episode.get("cid") or page.get("cid")),
                        title=str(episode.get("title") or arc.get("title") or ""),
                        url=f"https://www.bilibili.com/video/{episode.get('bvid')}",
                        description=str(arc.get("desc") or ""),
                        duration_seconds=_optional_int(
                            page.get("duration") or arc.get("duration")
                        ),
                        owner_mid=(
                            str(author.get("mid"))
                            if author.get("mid") is not None
                            else None
                        ),
                        owner_name=str(author.get("name") or "") or None,
                        published_at=(
                            datetime.fromtimestamp(int(published), timezone.utc).isoformat()
                            if published
                            else None
                        ),
                        season_id=int(season["id"]),
                        season_position=position,
                    )
                )
        expected = int((season.get("stat") or {}).get("ep_count") or len(episodes))
        if len(episodes) != expected:
            raise BackendError(
                f"Incomplete collection response: expected {expected}, got {len(episodes)}"
            )
        return CollectionSnapshot(
            collection=CollectionMetadata(
                season_id=int(season["id"]),
                title=str(season.get("title") or season["id"]),
                source_bvid=seed_bvid,
                owner_mid=str(season.get("mid") or owner.get("mid") or "") or None,
                owner_name=str(owner.get("name") or "") or None,
                episode_count=expected,
            ),
            episodes=episodes,
        )


class BBDownBackend:
    MEDIA_SUFFIXES = {".mp4", ".mkv", ".flv"}
    SUBTITLE_SUFFIXES = {".srt", ".ass", ".vtt"}

    def __init__(self, executable: Path, ffmpeg: Path) -> None:
        self.executable = executable.resolve()
        self.ffmpeg = ffmpeg.resolve()

    def download(self, bvid: str, work_dir: Path) -> tuple[Path, list[Path]]:
        work_dir.mkdir(parents=True, exist_ok=True)
        run_command(
            [
                str(self.executable),
                bvid,
                "--work-dir",
                str(work_dir.resolve()),
                "--ffmpeg-path",
                str(self.ffmpeg),
                "--file-pattern",
                bvid,
                "--multi-file-pattern",
                f"{bvid}/P<pageNumberWithZero>-<cid>",
                "--skip-cover",
                "--hide-streams",
            ]
        )
        media = [
            path
            for path in work_dir.rglob("*")
            if path.is_file() and path.suffix.lower() in self.MEDIA_SUFFIXES
        ]
        if not media:
            raise BackendError(f"BBDown completed but produced no media file in {work_dir}")
        media.sort(key=lambda path: path.stat().st_size, reverse=True)
        subtitles = [
            path
            for path in work_dir.rglob("*")
            if path.is_file() and path.suffix.lower() in self.SUBTITLE_SUFFIXES
        ]
        return media[0], subtitles


def find_executable(value: str | Path) -> Path:
    path = Path(value)
    if path.exists():
        return path.resolve()
    located = shutil.which(str(value))
    if located:
        return Path(located).resolve()
    raise BackendError(f"Executable not found: {value}")


def _optional_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    return int(value)
