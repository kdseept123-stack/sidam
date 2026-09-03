"""사이트에서 글을 수집한다.

흐름:
  1) URL 을 받아 requests 로 내려받는다.
  2) RSS/Atom 이면 항목을 그대로 Post 로 만든다.
  3) 일반 페이지면:
     - 상세글 링크로 보이는 것들을 찾아 각각 내려받아 Post 로 만든다.
     - 상세 링크를 못 찾으면 그 페이지 자체를 Post 하나로 본다.
  4) 내용이 자바스크립트로만 뜨는 것 같으면 Playwright 로 다시 시도한다.
"""
from __future__ import annotations

import re
import time
from urllib.parse import urljoin, urlparse

import feedparser
import requests
from bs4 import BeautifulSoup

from .models import Post

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
)

# 상세글 링크로 보이는 href 패턴
DETAIL_HINT = re.compile(
    r"(view\.do|/view|read\.do|/read|show/view|selectBoard|boardView|"
    r"nttId=|bbsId=|articleNo=|art_seq=|show_seq=|seq=|idx=|[?&]no=|"
    r"cultcode=|/bbs/[a-z0-9_]+/\d+|contentsView|display/region/content|"
    r"/home/display/)",
    re.IGNORECASE,
)

# 포스터가 아닐 가능성이 높은 이미지
IMG_SKIP = re.compile(
    r"(icon|logo|btn|button|sprite|blank|spacer|common|bg_|_bg|banner_top|"
    r"favicon|loading|arrow|dot\.|bullet)",
    re.IGNORECASE,
)
IMG_OK_EXT = re.compile(r"\.(jpe?g|png|webp)(\?|$)", re.IGNORECASE)

BROKEN_HINTS = ("{{", "요청하신 페이지를 찾을 수 없습니다", "잠시 후 다시")


class ScrapeError(Exception):
    pass


def _domain(url: str) -> str:
    return urlparse(url).netloc.lower()


def _http_get(url: str, timeout: int) -> str:
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9"},
            timeout=timeout,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise ScrapeError(f"내려받기 실패: {exc}") from exc
    # 인코딩 보정
    if not resp.encoding or resp.encoding.lower() == "iso-8859-1":
        resp.encoding = resp.apparent_encoding or "utf-8"
    return resp.text


def _looks_broken(html: str) -> bool:
    if not html or len(html) < 400:
        return True
    text = BeautifulSoup(html, "lxml").get_text(" ", strip=True)
    if len(text) < 120:
        return True
    head = html[:6000]
    return any(h in head for h in BROKEN_HINTS)


def _rendered_get(url: str, timeout: int) -> str:
    """Playwright 로 자바스크립트 렌더링 후 HTML 반환. 실패 시 ScrapeError."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:  # pragma: no cover
        raise ScrapeError("playwright 미설치 (pip install playwright)") from exc

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                page = browser.new_page(user_agent=UA, locale="ko-KR")
                page.goto(url, timeout=timeout * 1000, wait_until="domcontentloaded")
                try:
                    page.wait_for_load_state("networkidle", timeout=8000)
                except Exception:
                    pass
                time.sleep(1.0)
                return page.content()
            finally:
                browser.close()
    except Exception as exc:
        msg = str(exc)
        if "Executable doesn" in msg or "playwright install" in msg:
            raise ScrapeError(
                "Playwright 브라우저가 없습니다. 명령창에서 다음을 한 번 실행하세요:\n"
                "    python -m playwright install chromium"
            ) from exc
        raise ScrapeError(f"렌더링 실패: {msg}") from exc


def _get_html(url: str, timeout: int, use_pw: bool) -> str:
    html = _http_get(url, timeout)
    if use_pw and _looks_broken(html):
        try:
            rendered = _rendered_get(url, timeout)
            if not _looks_broken(rendered):
                return rendered
        except ScrapeError:
            pass
    return html


# --------------------------------------------------------------------------- #
# RSS
# --------------------------------------------------------------------------- #
def _try_feed(raw: str, source_url: str) -> list[Post] | None:
    parsed = feedparser.parse(raw)
    if parsed.bozo and not parsed.entries:
        return None
    if not parsed.entries:
        return None
    version = getattr(parsed, "version", "") or ""
    if not version.startswith(("rss", "atom")):
        return None

    dom = _domain(source_url)
    posts: list[Post] = []
    for entry in parsed.entries:
        title = (entry.get("title") or "").strip()
        link = (entry.get("link") or source_url).strip()
        body_html = ""
        if entry.get("content"):
            body_html = entry["content"][0].get("value", "")
        body_html = body_html or entry.get("summary", "") or ""
        text = BeautifulSoup(body_html, "lxml").get_text("\n", strip=True)
        published = None
        if entry.get("published_parsed"):
            t = entry["published_parsed"]
            published = f"{t.tm_year:04d}-{t.tm_mon:02d}-{t.tm_mday:02d}"
        images = []
        soup = BeautifulSoup(body_html, "lxml")
        for img in soup.find_all("img"):
            src = img.get("src")
            if src:
                images.append(urljoin(link, src))
        posts.append(
            Post(
                source=dom,
                source_url=source_url,
                url=link,
                title=title or "(제목 없음)",
                text=text,
                published=published,
                images=_clean_images(images),
            )
        )
    return posts


# --------------------------------------------------------------------------- #
# 일반 HTML
# --------------------------------------------------------------------------- #
def _clean_images(urls: list[str]) -> list[str]:
    out: list[str] = []
    seen = set()
    for u in urls:
        if not u or u.startswith("data:"):
            continue
        if IMG_SKIP.search(u):
            continue
        if not IMG_OK_EXT.search(u):
            continue
        if u in seen:
            continue
        seen.add(u)
        out.append(u)
    return out[:4]


def _readable(html: str, base_url: str) -> tuple[str, str, list[str]]:
    soup = BeautifulSoup(html, "lxml")

    title = ""
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    og = soup.find("meta", property="og:title")
    if og and og.get("content"):
        title = og["content"].strip()
    h1 = soup.find("h1")
    if h1 and h1.get_text(strip=True):
        title = h1.get_text(strip=True)

    for tag in soup(["script", "style", "noscript", "nav", "footer", "header", "aside", "form"]):
        tag.decompose()

    text = soup.get_text("\n", strip=True)
    text = re.sub(r"\n{2,}", "\n", text)

    images: list[str] = []
    ogimg = soup.find("meta", property="og:image")
    if ogimg and ogimg.get("content"):
        images.append(urljoin(base_url, ogimg["content"]))
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or img.get("data-original")
        if src:
            images.append(urljoin(base_url, src))

    return title or "(제목 없음)", text, _clean_images(images)


def _find_detail_links(html: str, base_url: str, limit: int) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    base_dom = _domain(base_url)
    out: list[str] = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("#", "javascript:", "mailto:")):
            continue
        full = urljoin(base_url, href)
        if _domain(full) != base_dom:
            continue
        if not DETAIL_HINT.search(full):
            continue
        label = a.get_text(" ", strip=True)
        if len(label) < 6:
            continue
        if full in seen:
            continue
        seen.add(full)
        out.append(full)
        if len(out) >= limit:
            break
    return out


# --------------------------------------------------------------------------- #
# 공개 함수
# --------------------------------------------------------------------------- #
def _resolve_egangdong(url: str, timeout: int, log) -> str:
    """egangdong.kr 루트는 JS 로 최신 호(volNNN)로 이동한다.
    그 번호를 읽어 '문화' 섹션(sub_04.html) 주소로 바꿔준다."""
    try:
        raw = _http_get(url.rstrip("/") + "/", timeout)
    except ScrapeError:
        return url
    vols = re.findall(r"vol(\d+)/index\.html", raw)
    if not vols:
        return url
    latest = max(int(v) for v in vols)
    new_url = f"https://egangdong.kr/vol{latest}/sub_04.html"
    log(f"    egangdong 최신호 vol{latest} -> {new_url}")
    return new_url


def collect_posts(source_url: str, cfg: dict, log=print) -> list[Post]:
    timeout = cfg["request_timeout"]
    use_pw = cfg["use_playwright_fallback"]
    limit = cfg["max_posts_per_source"]

    if "egangdong.kr" in source_url and not re.search(r"/vol\d+/", source_url):
        source_url = _resolve_egangdong(source_url, timeout, log)

    raw = _http_get(source_url, timeout)

    feed_posts = _try_feed(raw, source_url)
    if feed_posts is not None:
        log(f"    RSS 인식: {len(feed_posts)}개 항목")
        return feed_posts[:limit]

    # 자바스크립트 렌더링이 필요한지 확인
    if use_pw and _looks_broken(raw):
        try:
            rendered = _rendered_get(source_url, timeout)
            if not _looks_broken(rendered):
                raw = rendered
                log("    (자바스크립트 렌더링 사용)")
        except ScrapeError as exc:
            log(f"    렌더링 건너뜀: {exc}")

    links = _find_detail_links(raw, source_url, limit)
    if not links:
        log("    상세 링크 못 찾음 -> 페이지 전체를 글 1개로 처리")
        title, text, images = _readable(raw, source_url)
        return [
            Post(
                source=_domain(source_url),
                source_url=source_url,
                url=source_url,
                title=title,
                text=text,
                images=images,
            )
        ]

    log(f"    상세글 링크 {len(links)}개 발견")
    posts: list[Post] = []
    for i, link in enumerate(links, 1):
        try:
            detail_html = _get_html(link, timeout, use_pw)
            title, text, images = _readable(detail_html, link)
            if len(text) < 40:
                continue
            posts.append(
                Post(
                    source=_domain(source_url),
                    source_url=source_url,
                    url=link,
                    title=title,
                    text=text,
                    images=images,
                )
            )
        except ScrapeError as exc:
            log(f"      [{i}/{len(links)}] 실패: {exc}")
        time.sleep(0.7)
    return posts
