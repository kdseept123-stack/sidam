"""HTML 리포트 생성."""
from __future__ import annotations

import html
from datetime import date
from pathlib import Path

from .models import Event, SourceResult


def fact_text(ev: Event) -> str:
    """인스타에 복사해 넣을 사실 정보 블록."""
    lines = [f"📍 {ev.name}"]

    when = ev.date_text or ev.start_date or ""
    if ev.time_text:
        when = f"{when}  ⏰ {ev.time_text}".strip()
    lines.append(f"🗓 {when}" if when else "🗓 날짜 확인 필요")

    place = ev.location or "장소 확인 필요"
    if ev.dong:
        place = f"{place} (강동구 {ev.dong})"
    lines.append(f"📌 {place}")

    lines.append(f"💰 {ev.fee}" if ev.fee else "💰 요금 확인 필요")

    if ev.kids_info:
        lines.append(f"👶 {ev.kids_info}")

    lines.append(f"ℹ️ {ev.post_url}")
    return "\n".join(lines)


def _sort_key(ev: Event):
    return (ev.start_date is None, ev.start_date or "9999-99-99", ev.name)


def _card(ev: Event, idx: int) -> str:
    ft = fact_text(ev)
    ft_esc = html.escape(ft)

    if ev.poster_path:
        poster = f'<img class="poster" src="{html.escape(ev.poster_path)}" alt="포스터" loading="lazy">'
    else:
        poster = '<div class="poster empty">포스터 없음</div>'

    summary = f'<p class="summary">{html.escape(ev.summary)}</p>' if ev.summary else ""

    return f"""
    <article class="card">
      {poster}
      <div class="body">
        <h3>{html.escape(ev.name)}</h3>
        {summary}
        <pre id="ft{idx}" class="fact">{ft_esc}</pre>
        <div class="actions">
          <button onclick="copyFact({idx})">📋 정보 복사</button>
          <a href="{html.escape(ev.post_url)}" target="_blank" rel="noopener">원본 글 열기 ↗</a>
        </div>
      </div>
    </article>"""


def build(
    run_dir: Path,
    events: list[Event],
    sources: list[SourceResult],
    today: date,
) -> Path:
    real = sorted([e for e in events if e.classification == "행사"], key=_sort_key)
    maybe = sorted([e for e in events if e.classification == "애매"], key=_sort_key)

    cards = "\n".join(_card(e, i) for i, e in enumerate(real)) or (
        '<p class="empty-msg">이번에 새로 알려줄 행사가 없습니다. '
        '(이미 안내한 행사이거나, 소스에 새 글이 없음)</p>'
    )
    maybe_cards = "\n".join(_card(e, 1000 + i) for i, e in enumerate(maybe))

    src_rows = "\n".join(
        f"<tr class='{'ok' if s.ok else 'fail'}'>"
        f"<td>{'✅' if s.ok else '❌'}</td>"
        f"<td><a href='{html.escape(s.url)}' target='_blank' rel='noopener'>{html.escape(s.url)}</a></td>"
        f"<td>{html.escape(s.detail)}</td></tr>"
        for s in sources
    )

    doc = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>강동구 행사 정리 - {today.isoformat()}</title>
<style>
  :root {{ color-scheme: light dark; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; font: 15px/1.6 -apple-system, "Segoe UI", "Malgun Gothic", sans-serif;
         background:#f4f5f7; color:#1a1a1a; }}
  header {{ background:#2b5cff; color:#fff; padding:20px 24px; }}
  header h1 {{ margin:0 0 6px; font-size:20px; }}
  header .meta {{ opacity:.9; font-size:13px; }}
  main {{ max-width:900px; margin:0 auto; padding:20px 16px 60px; }}
  h2 {{ margin:32px 0 12px; font-size:16px; border-left:4px solid #2b5cff; padding-left:8px; }}
  .card {{ display:flex; gap:14px; background:#fff; border:1px solid #e3e5e8; border-radius:12px;
          padding:14px; margin:12px 0; }}
  .poster {{ width:120px; height:160px; object-fit:cover; border-radius:8px; flex:none; background:#eee; }}
  .poster.empty {{ display:flex; align-items:center; justify-content:center; font-size:12px;
                  color:#999; border:1px dashed #ccc; }}
  .body {{ flex:1; min-width:0; }}
  .body h3 {{ margin:0 0 6px; font-size:16px; }}
  .summary {{ margin:4px 0 8px; color:#444; font-size:13px; }}
  pre.fact {{ white-space:pre-wrap; word-break:break-all; background:#f7f8fa; border:1px solid #e3e5e8;
             border-radius:8px; padding:10px; font-size:13px; margin:6px 0; font-family:inherit; }}
  .actions {{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }}
  .actions button {{ background:#2b5cff; color:#fff; border:0; border-radius:6px; padding:7px 12px;
                     font-size:13px; cursor:pointer; }}
  .actions button.done {{ background:#28a745; }}
  .actions a {{ font-size:13px; color:#2b5cff; text-decoration:none; }}
  details {{ margin-top:20px; background:#fff; border:1px solid #e3e5e8; border-radius:12px; padding:12px 16px; }}
  summary {{ cursor:pointer; font-weight:600; font-size:14px; }}
  table {{ width:100%; border-collapse:collapse; margin-top:10px; font-size:12px; }}
  td {{ padding:6px 8px; border-top:1px solid #eee; vertical-align:top; word-break:break-all; }}
  tr.fail td {{ color:#b00020; }}
  .empty-msg {{ color:#888; padding:20px; text-align:center; }}
  @media (max-width:560px) {{ .card {{ flex-direction:column; }} .poster {{ width:100%; height:220px; }} }}
</style>
</head>
<body>
<header>
  <h1>강동구 행사 정리</h1>
  <div class="meta">{today.isoformat()} 생성 · 새 행사 {len(real)}건 · 확인 필요 {len(maybe)}건 · 이미 안내한 행사는 제외됨</div>
</header>
<main>
  <h2>행사 ({len(real)}건)</h2>
  {cards}

  {"<h2>확인 필요 — 행사인지 애매함 (" + str(len(maybe)) + "건)</h2>" + maybe_cards if maybe else ""}

  <details>
    <summary>소스별 수집 결과 ({sum(1 for s in sources if s.ok)}/{len(sources)} 성공)</summary>
    <table>{src_rows}</table>
  </details>
</main>
<script>
  function copyFact(i) {{
    var el = document.getElementById('ft' + i);
    var btn = event.currentTarget;
    navigator.clipboard.writeText(el.textContent).then(function() {{
      var old = btn.textContent;
      btn.textContent = '✅ 복사됨';
      btn.classList.add('done');
      setTimeout(function() {{ btn.textContent = old; btn.classList.remove('done'); }}, 1500);
    }});
  }}
</script>
</body>
</html>"""

    out = run_dir / "index.html"
    out.write_text(doc, encoding="utf-8")
    return out
