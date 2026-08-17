from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from .backends import BBDownBackend, BiliCliBackend
from .database import StateDatabase
from .models import ProcessResult, VideoMetadata
from .transcriber import FasterWhisperTranscriber


class SingleVideoPipeline:
    def __init__(
        self,
        *,
        data_dir: Path,
        metadata_backend: BiliCliBackend,
        download_backend: BBDownBackend,
        transcriber: FasterWhisperTranscriber | None = None,
    ) -> None:
        self.data_dir = data_dir.resolve()
        self.metadata_backend = metadata_backend
        self.download_backend = download_backend
        self.transcriber = transcriber
        self.database = StateDatabase(self.data_dir / "state.db")

    def process(self, bvid: str, *, force: bool = False) -> ProcessResult:
        metadata, envelope = self.metadata_backend.fetch(bvid)
        self.database.upsert_metadata(metadata)
        state = self.database.get(bvid)
        archive_dir = self._archive_dir(metadata.bvid, state)
        self._write_metadata(metadata, envelope, archive_dir, state)
        if not force and state and self._is_complete(
            state, require_subtitle=self.transcriber is not None
        ):
            return ProcessResult(
                bvid=bvid,
                status="skipped",
                video_path=state.get("video_path"),
                subtitle_path=state.get("subtitle_path"),
                subtitle_source=state.get("subtitle_source"),
                message="Already completed and local artifacts still exist.",
            )

        self.database.set_processing(bvid)
        try:
            video_path, downloaded_subtitles = self._ensure_video(
                metadata, state, archive_dir, force=force
            )
            subtitle_path, subtitle_source = self._ensure_subtitle(
                metadata,
                envelope,
                downloaded_subtitles,
                state,
                video_path,
                archive_dir,
                force=force,
            )
            if subtitle_path is None:
                self.database.set_subtitle(
                    bvid, status="unavailable", path=None, source=None
                )
            self.database.set_completed(bvid)
            self._refresh_metadata_local(metadata, archive_dir)
            return ProcessResult(
                bvid=bvid,
                status="completed",
                video_path=str(video_path),
                subtitle_path=str(subtitle_path) if subtitle_path else None,
                subtitle_source=subtitle_source,
                message=(
                    "Video and subtitle saved."
                    if subtitle_path
                    else "Video saved; no downloadable subtitle was available."
                ),
            )
        except Exception as error:
            self.database.set_failed(bvid, str(error))
            raise

    def _ensure_video(
        self,
        metadata: VideoMetadata,
        state: dict | None,
        archive_dir: Path,
        *,
        force: bool,
    ) -> tuple[Path, list[Path]]:
        existing = Path(state["video_path"]) if state and state.get("video_path") else None
        if not force and existing and existing.is_file() and existing.stat().st_size > 0:
            return existing, []

        temporary = self.data_dir / "temporary" / metadata.bvid
        if temporary.exists():
            shutil.rmtree(temporary)
        temporary.mkdir(parents=True)
        downloaded_media, subtitles = self.download_backend.download(metadata.bvid, temporary)

        archive_dir.mkdir(parents=True, exist_ok=True)
        target = archive_dir / f"video{downloaded_media.suffix.lower()}"
        if target.exists():
            target.unlink()
        shutil.move(str(downloaded_media), target)
        if target.stat().st_size <= 0:
            raise RuntimeError(f"Downloaded video is empty: {target}")
        self.database.set_video_downloaded(metadata.bvid, target)
        return target.resolve(), subtitles

    def _ensure_subtitle(
        self,
        metadata: VideoMetadata,
        envelope: dict,
        downloaded_subtitles: list[Path],
        state: dict | None,
        video_path: Path,
        archive_dir: Path,
        *,
        force: bool,
    ) -> tuple[Path | None, str | None]:
        existing = (
            Path(state["subtitle_path"])
            if state and state.get("subtitle_path")
            else None
        )
        if not force and existing and existing.is_file() and existing.stat().st_size > 0:
            return existing, state.get("subtitle_source") or "official"

        subtitle_data = (envelope.get("data") or {}).get("subtitle") or {}
        items = subtitle_data.get("items") or []
        if items:
            content = timeline_to_srt(items)
            target = self._subtitle_target(archive_dir, "official", ".srt")
            target.write_text(content, encoding="utf-8")
            self.database.set_subtitle(
                metadata.bvid, status="extracted", path=target, source="official"
            )
            return target.resolve(), "official"

        if downloaded_subtitles:
            source = downloaded_subtitles[0]
            target = self._subtitle_target(
                archive_dir, "official", source.suffix.lower()
            )
            shutil.move(str(source), target)
            self.database.set_subtitle(
                metadata.bvid, status="extracted", path=target, source="official"
            )
            return target.resolve(), "official"

        if self.transcriber is not None:
            target = self._subtitle_target(archive_dir, "asr", ".srt")
            self.database.set_subtitle(
                metadata.bvid, status="transcribing", path=None, source="asr"
            )
            self.transcriber.transcribe(video_path, target)
            self.database.set_subtitle(
                metadata.bvid, status="transcribed", path=target, source="asr"
            )
            return target.resolve(), "asr"
        return None, None

    def _subtitle_target(
        self, archive_dir: Path, source: str, suffix: str
    ) -> Path:
        archive_dir.mkdir(parents=True, exist_ok=True)
        return archive_dir / f"subtitle.{source}.zh-CN{suffix}"

    def _write_metadata(
        self,
        metadata: VideoMetadata,
        envelope: dict,
        archive_dir: Path,
        state: dict | None,
    ) -> None:
        archive_dir.mkdir(parents=True, exist_ok=True)
        payload = {
            **metadata.as_dict(),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "source": envelope,
        }
        if state:
            for field in ("cid", "published_at", "season_id", "season_position"):
                if payload.get(field) is None:
                    payload[field] = state.get(field)
        (archive_dir / "metadata.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def _refresh_metadata_local(
        self, metadata: VideoMetadata, archive_dir: Path
    ) -> None:
        path = archive_dir / "metadata.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        state = self.database.get(metadata.bvid) or {}
        payload["local"] = {
            "video_path": state.get("video_path"),
            "subtitle_path": state.get("subtitle_path"),
            "subtitle_source": state.get("subtitle_source"),
            "video_status": state.get("video_status"),
            "subtitle_status": state.get("subtitle_status"),
            "process_status": state.get("process_status"),
            "processed_at": state.get("processed_at"),
        }
        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def _archive_dir(self, bvid: str, state: dict | None) -> Path:
        published_at = state.get("published_at") if state else None
        year = str(published_at)[:4] if published_at else "unknown"
        if len(year) != 4 or not year.isdigit():
            year = "unknown"
        return self.data_dir / "archive" / year / bvid

    @staticmethod
    def _is_complete(state: dict, *, require_subtitle: bool = False) -> bool:
        if state.get("process_status") != "completed":
            return False
        video_path = state.get("video_path")
        if not video_path or not Path(video_path).is_file():
            return False
        subtitle_status = state.get("subtitle_status")
        if subtitle_status == "unavailable":
            return not require_subtitle
        subtitle_path = state.get("subtitle_path")
        return bool(subtitle_path and Path(subtitle_path).is_file())


def timeline_to_srt(items: list[dict]) -> str:
    blocks: list[str] = []
    for index, item in enumerate(items, start=1):
        start = item.get("from", item.get("start", 0))
        end = item.get("to", item.get("end", start))
        content = item.get("content", item.get("text", ""))
        blocks.append(
            f"{index}\n{_srt_time(float(start))} --> {_srt_time(float(end))}\n{content}\n"
        )
    return "\n".join(blocks)


def _srt_time(seconds: float) -> str:
    milliseconds = max(0, round(seconds * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
