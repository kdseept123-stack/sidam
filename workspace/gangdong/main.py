"""강동구 행사 수집 - 메인 실행 파일.

실행:  python main.py      (또는  강동행사_체크.bat  더블클릭)
"""
from __future__ import annotations

import sys
import time
import webbrowser
from datetime import date, datetime
from pathlib import Path

from core import config
from core.extract import extract_events
from core.history import History, event_fp
from core.images import download as download_image
from core.llm import LLMError, get_llm
from core.models import Event, SourceResult
from core.report import build as build_report
from core.scraper import ScrapeError, collect_posts

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass


def _is_past(ev: Event, today: date) -> bool:
    """지난 게 확실할 때만 True (애매하면 남긴다)."""
    raw = ev.end_date or ev.start_date
    if not raw:
        return False
    try:
        return date.fromisoformat(raw) < today
    except ValueError:
        return False


def main() -> int:
    config.load_env()
    cfg = config.settings()

    sources = config.get_sources()
    if not sources:
        print("config/sources.txt 에 사이트 주소가 없습니다.")
        return 1

    try:
        llm = get_llm(cfg)
    except LLMError as exc:
        print("\n[LLM 설정 오류]")
        print(exc)
        return 1

    today = date.today()
    run_dir = config.OUTPUT_DIR / f"강동행사_{today:%Y%m%d}"
    run_dir.mkdir(parents=True, exist_ok=True)
    poster_dir = run_dir / "posters"

    hist = History(config.DB_PATH)

    print(f"== 강동구 행사 수집 시작 ({datetime.now():%Y-%m-%d %H:%M}) ==")
    print(f"   소스 {len(sources)}개, 결과 폴더: {run_dir}\n")

    all_events: list[Event] = []
    source_results: list[SourceResult] = []
    seen_fp_this_run: set[str] = set()

    for si, src in enumerate(sources, 1):
        print(f"[{si}/{len(sources)}] {src}")
        try:
            posts = collect_posts(src, cfg, log=lambda m: print(m))
        except ScrapeError as exc:
            print(f"    -> 실패: {exc}\n")
            source_results.append(SourceResult(src, False, f"수집 실패: {exc}"))
            continue
        except Exception as exc:  # noqa: BLE001
            print(f"    -> 예상치 못한 오류: {exc}\n")
            source_results.append(SourceResult(src, False, f"오류: {exc}"))
            continue

        found_here = 0
        for pi, post in enumerate(posts, 1):
            try:
                events = extract_events(llm, post, today.isoformat())
            except LLMError as exc:
                print(f"    ({pi}/{len(posts)}) LLM 오류: {exc}")
                time.sleep(2)
                continue

            for ev in events:
                if ev.classification == "행사아님":
                    continue
                if _is_past(ev, today):
                    continue
                fp = event_fp(ev)
                if fp in seen_fp_this_run:
                    continue
                seen_fp_this_run.add(fp)
                ev.event_fp = fp

                # 이전 실행에서 이미 리포트에 나온 행사는 다시 보여주지 않는다
                if hist.event_seen_before(ev):
                    hist.record_event(ev, today.isoformat())  # 마지막 확인일만 갱신
                    continue

                if ev.poster_url:
                    saved = download_image(
                        ev.poster_url, poster_dir, ev.name, cfg["request_timeout"]
                    )
                    if saved:
                        ev.poster_path = Path(saved).relative_to(run_dir).as_posix()

                hist.record_event(ev, today.isoformat())
                all_events.append(ev)
                found_here += 1

            hist.record_post(post)
            time.sleep(1.0)  # LLM/사이트 예의상 간격

        print(f"    -> 행사 {found_here}건 추출\n")
        source_results.append(
            SourceResult(src, True, f"글 {len(posts)}개 확인, 행사 {found_here}건", len(posts))
        )

    report_path = build_report(run_dir, all_events, source_results, today)
    hist.close()

    real = [e for e in all_events if e.classification == "행사"]
    maybe = [e for e in all_events if e.classification == "애매"]

    print("=" * 50)
    if not real and not maybe:
        print("완료: 새로 알려줄 행사가 없습니다 (이미 다 안내한 행사들).")
    else:
        print(f"완료: 새 행사 {len(real)}건, 확인 필요 {len(maybe)}건")
    print(f"리포트: {report_path}")
    try:
        webbrowser.open(report_path.resolve().as_uri())
    except Exception:
        print("(브라우저 자동 열기 실패 - 위 경로의 index.html 을 직접 여세요)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
