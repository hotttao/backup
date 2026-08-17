from __future__ import annotations

import tempfile
import unittest
import json
from pathlib import Path

from bili_sync.database import StateDatabase
from bili_sync.filenames import safe_filename
from bili_sync.models import VideoMetadata
from bili_sync.pipeline import SingleVideoPipeline, timeline_to_srt
from bili_sync.backends import BilibiliCollectionBackend
from bili_sync.audit import audit_collection


class FilenameTests(unittest.TestCase):
    def test_windows_reserved_characters_are_replaced(self) -> None:
        self.assertEqual(safe_filename('a<b>:c/"d"? '), "a_b__c__d__")


class SubtitleTests(unittest.TestCase):
    def test_timeline_is_rendered_as_srt(self) -> None:
        rendered = timeline_to_srt(
            [{"from": 1.25, "to": 3.5, "content": "hello"}]
        )
        self.assertIn("00:00:01,250 --> 00:00:03,500", rendered)
        self.assertIn("hello", rendered)


class DatabaseTests(unittest.TestCase):
    def test_metadata_upsert_preserves_processing_state(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database = StateDatabase(Path(directory) / "state.db")
            metadata = VideoMetadata(
                bvid="BV1234567890",
                aid=1,
                cid=2,
                title="first",
                url="https://example.test",
                description="",
                duration_seconds=3,
                owner_mid="4",
                owner_name="owner",
            )
            database.upsert_metadata(metadata)
            video = Path(directory) / "video.mp4"
            video.write_bytes(b"video")
            database.set_video_downloaded(metadata.bvid, video)
            database.set_subtitle(
                metadata.bvid, status="unavailable", path=None, source=None
            )
            database.set_completed(metadata.bvid)

            database.upsert_metadata(
                VideoMetadata(**{**metadata.as_dict(), "title": "renamed"})
            )
            state = database.get(metadata.bvid)
            self.assertEqual(state["title"], "renamed")
            self.assertEqual(state["process_status"], "completed")
            self.assertTrue(SingleVideoPipeline._is_complete(state))
            self.assertFalse(
                SingleVideoPipeline._is_complete(state, require_subtitle=True)
            )

    def test_post_processing_state_is_stored_with_video_state(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database = StateDatabase(Path(directory) / "state.db")
            metadata = VideoMetadata(
                bvid="BV1234567890",
                aid=1,
                cid=2,
                title="episode",
                url="https://example.test",
                description="",
                duration_seconds=3,
                owner_mid="4",
                owner_name="owner",
            )
            database.upsert_metadata(metadata)
            database.set_processing_task(
                task_key="tool-summary:anything",
                bvid=metadata.bvid,
                status="completed",
                output_path="posts/tool/anything.md",
                item_count=6,
            )
            row = database.processing_task_rows(
                "tool-summary:anything", metadata.bvid
            )[0]
            self.assertEqual(row["status"], "completed")
            self.assertEqual(row["item_count"], 6)
            self.assertEqual(row["title"], "episode")

            items = [
                {
                    "item_key": "example",
                    "tool_name": "Example",
                    "category": "开发工具",
                    "purpose": "Example purpose",
                    "project_published_at": "2026-01-02",
                    "project_date_source_url": "https://example.test/releases",
                    "video_url": "https://example.test/video?t=1",
                    "project_url": "https://example.test/project",
                    "koala_evaluation": "Useful",
                    "lookup_status": "verified",
                    "lookup_notes": "Official site",
                }
            ]
            database.replace_processing_task_items(
                task_key="tool-summary:anything", bvid=metadata.bvid, items=items
            )
            cached = database.processing_task_item_rows(
                "tool-summary:anything", metadata.bvid
            )
            self.assertEqual(len(cached), 1)
            self.assertEqual(cached[0]["project_url"], "https://example.test/project")
            self.assertEqual(cached[0]["lookup_status"], "verified")

    def test_archive_year_is_derived_from_publication_time(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            pipeline = object.__new__(SingleVideoPipeline)
            pipeline.data_dir = Path(directory)
            path = pipeline._archive_dir(
                "BV1234567890", {"published_at": "2025-12-31T00:00:00+00:00"}
            )
            self.assertEqual(path.parts[-2:], ("2025", "BV1234567890"))


class CollectionBackendTests(unittest.TestCase):
    def test_rejects_video_without_ugc_season(self) -> None:
        backend = BilibiliCollectionBackend()
        self.assertIn("view?bvid=", backend.VIEW_URL)


class AuditTests(unittest.TestCase):
    def test_complete_collection_artifacts_pass_audit(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            data_dir = Path(directory)
            database = StateDatabase(data_dir / "state.db")
            metadata = VideoMetadata(
                bvid="BV1234567890",
                aid=1,
                cid=2,
                title="episode",
                url="https://www.bilibili.com/video/BV1234567890",
                description="",
                duration_seconds=3,
                owner_mid="4",
                owner_name="owner",
                published_at="2025-01-02T00:00:00+00:00",
                season_id=7,
                season_position=1,
            )
            from bili_sync.models import CollectionMetadata

            database.upsert_collection(
                CollectionMetadata(
                    season_id=7,
                    title="collection",
                    source_bvid=metadata.bvid,
                    owner_mid="4",
                    owner_name="owner",
                    episode_count=1,
                )
            )
            database.upsert_metadata(metadata)
            target = data_dir / "archive" / "2025" / metadata.bvid
            target.mkdir(parents=True)
            video = target / "video.mp4"
            video.write_bytes(b"video")
            subtitle = target / "subtitle.asr.zh-CN.srt"
            subtitle.write_text(
                "1\n00:00:00,000 --> 00:00:01,000\nhello\n", encoding="utf-8"
            )
            (target / "metadata.json").write_text(
                json.dumps(metadata.as_dict()), encoding="utf-8"
            )
            database.set_video_downloaded(metadata.bvid, video)
            database.set_subtitle(
                metadata.bvid, status="transcribed", path=subtitle, source="asr"
            )
            database.set_completed(metadata.bvid)

            result = audit_collection(data_dir, database, 7)
            self.assertTrue(result["valid"])
            self.assertEqual(result["checked"], 1)


if __name__ == "__main__":
    unittest.main()
