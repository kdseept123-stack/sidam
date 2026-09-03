"""포스터 이미지 내려받기."""
from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlparse

import requests

from .scraper import UA

_MAX_BYTES = 15 * 1024 * 1024


def _slug(text: str) -> str:
    text = re.sub(r"[\s]+", "_", (text or "").strip())
    text = re.sub(r"[^0-9A-Za-z가-힣_\-]", "", text)
    return text[:50] or "poster"


def download(url: str, dest_dir: Path, name_hint: str, timeout: int = 20) -> str:
    """성공하면 저장 경로(문자열), 실패하면 ""."""
    if not url:
        return ""
    try:
        resp = requests.get(
            url, headers={"User-Agent": UA}, timeout=timeout, stream=True
        )
        resp.raise_for_status()
        ctype = resp.headers.get("Content-Type", "")
        if "image" not in ctype and not re.search(r"\.(jpe?g|png|webp)", url, re.I):
            return ""
        ext = ".jpg"
        if "png" in ctype or url.lower().endswith(".png"):
            ext = ".png"
        elif "webp" in ctype or url.lower().endswith(".webp"):
            ext = ".webp"

        dest_dir.mkdir(parents=True, exist_ok=True)
        base = _slug(name_hint)
        path = dest_dir / f"{base}{ext}"
        n = 2
        while path.exists():
            path = dest_dir / f"{base}_{n}{ext}"
            n += 1

        total = 0
        with open(path, "wb") as fh:
            for chunk in resp.iter_content(8192):
                total += len(chunk)
                if total > _MAX_BYTES:
                    fh.close()
                    path.unlink(missing_ok=True)
                    return ""
                fh.write(chunk)
        if total < 2048:  # 너무 작으면 아이콘일 가능성
            path.unlink(missing_ok=True)
            return ""
        return str(path)
    except (requests.RequestException, OSError):
        return ""
