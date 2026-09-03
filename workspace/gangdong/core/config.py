"""설정 로딩: config/.env, config/sources.txt."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"
OUTPUT_DIR = ROOT / "output"
DB_PATH = ROOT / "history.db"

ENV_PATH = CONFIG_DIR / ".env"
SOURCES_PATH = CONFIG_DIR / "sources.txt"


def load_env() -> None:
    load_dotenv(ENV_PATH)


def get_sources() -> list[str]:
    if not SOURCES_PATH.exists():
        return []
    out: list[str] = []
    for raw in SOURCES_PATH.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        out.append(line)
    return out


def _int_env(key: str, default: int) -> int:
    try:
        return int(os.getenv(key, str(default)).strip())
    except (TypeError, ValueError):
        return default


def settings() -> dict:
    return {
        "provider": os.getenv("LLM_PROVIDER", "gemini").strip().lower(),
        "gemini_api_key": os.getenv("GEMINI_API_KEY", "").strip(),
        "gemini_model": os.getenv("GEMINI_MODEL", "gemini-3.5-flash").strip(),
        "max_posts_per_source": _int_env("MAX_POSTS_PER_SOURCE", 12),
        "request_timeout": _int_env("REQUEST_TIMEOUT", 20),
        "use_playwright_fallback": os.getenv("USE_PLAYWRIGHT_FALLBACK", "1").strip()
        not in ("0", "false", "False", "no", ""),
    }
