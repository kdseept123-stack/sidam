"""데이터 구조 정의."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Post:
    """수집한 글 하나 (게시판 글 또는 페이지 하나)."""
    source: str              # sources.txt 에 적힌 소스 이름/도메인
    source_url: str          # 이 글이 나온 sources.txt 의 URL
    url: str                 # 이 글 자체의 URL
    title: str
    text: str                # 본문에서 뽑아낸 읽을 수 있는 텍스트
    published: Optional[str] = None          # 알 수 있으면 ISO 날짜
    images: list[str] = field(default_factory=list)   # 포스터 후보 이미지 URL


@dataclass
class Event:
    """글에서 뽑아낸 행사 하나."""
    name: str
    classification: str          # "행사" | "애매" | "행사아님"
    date_text: str = ""
    start_date: Optional[str] = None    # ISO yyyy-mm-dd
    end_date: Optional[str] = None
    time_text: str = ""
    location: str = ""
    dong: str = ""
    fee: str = ""
    kids_info: str = ""          # 원문에 근거 있을 때만
    summary: str = ""
    # 아래는 프로그램이 채움
    source: str = ""
    post_url: str = ""
    poster_url: str = ""
    poster_path: str = ""        # 리포트 파일 기준 상대 경로
    seen_before: bool = False
    event_fp: str = ""


@dataclass
class SourceResult:
    url: str
    ok: bool
    detail: str
    post_count: int = 0
