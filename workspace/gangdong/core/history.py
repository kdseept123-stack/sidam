"""이전에 수집한 글/행사 기록 (SQLite). '이전에 봄' 표시에 사용."""
from __future__ import annotations

import hashlib
import re
import sqlite3
from datetime import datetime

from .models import Event, Post

_SCHEMA = """
CREATE TABLE IF NOT EXISTS posts (
    fp          TEXT PRIMARY KEY,
    source_url  TEXT,
    post_url    TEXT,
    title       TEXT,
    first_seen  TEXT,
    last_seen   TEXT
);
CREATE TABLE IF NOT EXISTS events (
    fp          TEXT PRIMARY KEY,
    name        TEXT,
    start_date  TEXT,
    location    TEXT,
    post_url    TEXT,
    first_seen  TEXT,
    last_report TEXT
);
"""


def _norm(text: str) -> str:
    return re.sub(r"[\s\W_]+", "", (text or "").lower())


def _hash(*parts: str) -> str:
    return hashlib.sha1("|".join(_norm(p) for p in parts).encode("utf-8")).hexdigest()


def post_fp(post: Post) -> str:
    return _hash(post.source_url, post.url, post.title)


def event_fp(ev: Event) -> str:
    return _hash(ev.name, ev.start_date or ev.date_text, ev.location or ev.dong)


class History:
    def __init__(self, path):
        self.conn = sqlite3.connect(str(path))
        self.conn.executescript(_SCHEMA)
        self.conn.commit()

    # ---- posts -------------------------------------------------------------
    def post_seen_before(self, post: Post) -> bool:
        fp = post_fp(post)
        row = self.conn.execute("SELECT 1 FROM posts WHERE fp = ?", (fp,)).fetchone()
        return row is not None

    def record_post(self, post: Post) -> None:
        fp = post_fp(post)
        now = datetime.now().isoformat(timespec="seconds")
        self.conn.execute(
            """INSERT INTO posts (fp, source_url, post_url, title, first_seen, last_seen)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(fp) DO UPDATE SET last_seen = excluded.last_seen""",
            (fp, post.source_url, post.url, post.title, now, now),
        )
        self.conn.commit()

    # ---- events ----------------------------------------------------------
    def event_seen_before(self, ev: Event) -> bool:
        row = self.conn.execute(
            "SELECT 1 FROM events WHERE fp = ?", (event_fp(ev),)
        ).fetchone()
        return row is not None

    def record_event(self, ev: Event, report_date: str) -> None:
        fp = event_fp(ev)
        now = datetime.now().isoformat(timespec="seconds")
        self.conn.execute(
            """INSERT INTO events (fp, name, start_date, location, post_url, first_seen, last_report)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(fp) DO UPDATE SET last_report = excluded.last_report""",
            (fp, ev.name, ev.start_date, ev.location, ev.post_url, now, report_date),
        )
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()
