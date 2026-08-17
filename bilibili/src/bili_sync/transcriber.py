from __future__ import annotations

from pathlib import Path
from typing import Any


class FasterWhisperTranscriber:
    def __init__(
        self,
        *,
        model_name: str = "small",
        model_dir: Path,
        device: str = "cpu",
        compute_type: str = "int8",
        batch_size: int = 8,
    ) -> None:
        self.model_name = model_name
        self.model_dir = model_dir.resolve()
        self.device = device
        self.compute_type = compute_type
        self.batch_size = batch_size
        self._model: Any | None = None
        self._batched_model: Any | None = None

    def transcribe(self, media_path: Path, target_path: Path) -> Path:
        try:
            from faster_whisper import BatchedInferencePipeline, WhisperModel
        except ImportError as error:
            raise RuntimeError(
                "ASR is required but faster-whisper is not installed. "
                "Run: uv sync --extra asr"
            ) from error

        self.model_dir.mkdir(parents=True, exist_ok=True)
        if self._model is None:
            self._model = WhisperModel(
                self.model_name,
                device=self.device,
                compute_type=self.compute_type,
                download_root=str(self.model_dir),
            )
            self._batched_model = BatchedInferencePipeline(model=self._model)
        segments, _ = self._batched_model.transcribe(
            str(media_path),
            language="zh",
            beam_size=5,
            batch_size=self.batch_size,
            initial_prompt=(
                "科技周报，开源工具，GitHub，人工智能，大语言模型，"
                "开发框架，命令行工具，软件项目。"
            ),
        )
        target_path.parent.mkdir(parents=True, exist_ok=True)
        blocks: list[str] = []
        for index, segment in enumerate(segments, start=1):
            blocks.append(
                f"{index}\n{_srt_time(segment.start)} --> {_srt_time(segment.end)}\n"
                f"{segment.text.strip()}\n"
            )
        if not blocks:
            raise RuntimeError(f"ASR produced no transcript for {media_path}")
        target_path.write_text("\n".join(blocks), encoding="utf-8")
        return target_path.resolve()


def _srt_time(seconds: float) -> str:
    milliseconds = max(0, round(seconds * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
