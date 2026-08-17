from __future__ import annotations

import re


_WINDOWS_RESERVED = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_TRAILING = re.compile(r"[ .]+$")


def safe_filename(value: str, *, limit: int = 140) -> str:
    cleaned = _WINDOWS_RESERVED.sub("_", value)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    cleaned = _TRAILING.sub("", cleaned)
    if not cleaned:
        cleaned = "untitled"
    return cleaned[:limit].rstrip(" .")

