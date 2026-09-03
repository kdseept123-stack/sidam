"""글(Post) 하나에서 행사(Event) 목록을 뽑아낸다."""
from __future__ import annotations

from .llm import LLMError
from .models import Event, Post

SYSTEM = """너는 서울 강동구의 지역 행사 정보를 정리하는 도우미다.
입력으로 웹에서 가져온 글(제목 + 본문)이 주어진다.
이 글에서 '일반 주민이 참여할 수 있는 행사'를 모두 찾아 JSON 배열로만 반환한다.

[지역 규칙 — 가장 중요]
- 서울 강동구에서 열리거나 강동구민 대상인 행사만 다룬다.
- 강동구가 아닌 곳(예술의전당, 세종문화회관, 롯데콘서트홀, 타 구/타 도시 등)에서 열리는 행사는 classification 을 "행사아님" 으로 한다.

[분류 규칙] 각 항목의 classification 은 다음 중 하나:
- "행사": (강동구에서) 축제, 공연, 전시, 체험, 강좌, 교실, 마켓, 플리마켓, 캠페인, 나눔행사, 걷기대회 등 주민이 직접 참여/관람하는 행사
- "애매": 주민설명회, 공청회, 위원 모집, 봉사자 모집처럼 행사인지 아닌지 애매한 것
- "행사아님": 강동구 밖 행사, 그리고 채용/임용, 입찰/낙찰/계약, 도로통제, 단수/단전, 인사발령, 조례/규칙 개정, 정책 브리핑, 통계 발표 등

[날짜 규칙]
- 오늘 날짜가 함께 주어진다. 한국 시간 기준으로 해석한다.
- "2026.10.17.~10.19.", "10월 매주 토요일", "상시 운영", "9/5(금) 14:00" 같은 표기를 최대한 해석한다.
- start_date, end_date 는 특정 가능하면 "YYYY-MM-DD" 문자열, 특정 불가하면 null.
- 하루짜리면 start_date 와 end_date 를 같게 둔다.

[정보 규칙]
- 글 하나에 행사가 여러 개면 각각 별도 항목으로 나눈다.
- kids_info: 본문에 영유아/어린이 프로그램, 유모차, 수유실, 참가 연령 제한, 아이 동반 관련 언급이 있을 때만 그 내용을 짧게 적는다. 없으면 빈 문자열 "". 추측 금지.
- summary: 행사 내용을 사실 위주로 한 문장. 없으면 "".
- location: 장소 이름(예: "강동아트센터 대극장 한강"). dong: 강동구 안의 동 이름만(예: "상일동"), 모르면 "".
- fee: "무료" / "유료(R석 77,000원)" 등. 모르면 "".
- 본문에 없는 정보는 절대 지어내지 않는다. 모르면 빈 값.

[출력]
JSON 배열만 출력한다. 다른 설명 텍스트 금지.
각 원소 형식:
{"name": "", "classification": "행사|애매|행사아님", "date_text": "", "start_date": null, "end_date": null, "time_text": "", "location": "", "dong": "", "fee": "", "kids_info": "", "summary": ""}
행사가 하나도 없으면 [] 를 반환한다.
"""

_MAX_BODY = 8000


def _one(raw: dict, post: Post) -> Event | None:
    name = (raw.get("name") or "").strip()
    if not name:
        return None
    cls = (raw.get("classification") or "").strip()
    if cls not in ("행사", "애매", "행사아님"):
        cls = "애매"

    def s(key: str) -> str:
        v = raw.get(key)
        return v.strip() if isinstance(v, str) else ""

    def d(key: str):
        v = raw.get(key)
        if isinstance(v, str) and len(v) == 10 and v[4] == "-" and v[7] == "-":
            return v
        return None

    return Event(
        name=name,
        classification=cls,
        date_text=s("date_text"),
        start_date=d("start_date"),
        end_date=d("end_date"),
        time_text=s("time_text"),
        location=s("location"),
        dong=s("dong"),
        fee=s("fee"),
        kids_info=s("kids_info"),
        summary=s("summary"),
        source=post.source,
        post_url=post.url,
        poster_url=post.images[0] if post.images else "",
    )


def extract_events(llm, post: Post, today: str) -> list[Event]:
    body = post.text[:_MAX_BODY]
    user = (
        f"오늘 날짜: {today}\n"
        f"글 제목: {post.title}\n"
        f"글 주소: {post.url}\n"
        f"--- 본문 ---\n{body}\n--- 끝 ---"
    )
    try:
        data = llm.generate_json(SYSTEM, user)
    except LLMError:
        raise
    if isinstance(data, dict):
        data = data.get("events") or data.get("items") or [data]
    if not isinstance(data, list):
        return []

    events: list[Event] = []
    for raw in data:
        if not isinstance(raw, dict):
            continue
        ev = _one(raw, post)
        if ev is not None:
            events.append(ev)
    return events
