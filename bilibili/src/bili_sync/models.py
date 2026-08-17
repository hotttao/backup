from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class VideoMetadata:
    bvid: str
    aid: int | None
    cid: int | None
    title: str
    url: str
    description: str
    duration_seconds: int | None
    owner_mid: str | None
    owner_name: str | None
    published_at: str | None = None
    season_id: int | None = None
    season_position: int | None = None

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ProcessResult:
    bvid: str
    status: str
    video_path: str | None
    subtitle_path: str | None
    subtitle_source: str | None
    message: str


@dataclass(frozen=True)
class CollectionMetadata:
    season_id: int
    title: str
    source_bvid: str
    owner_mid: str | None
    owner_name: str | None
    episode_count: int


@dataclass(frozen=True)
class CollectionSnapshot:
    collection: CollectionMetadata
    episodes: list[VideoMetadata]
