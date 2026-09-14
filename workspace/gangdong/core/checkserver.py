"""리포트(HTML)의 체크박스를 실시간으로 history.db 에 저장해주는 로컬 서버.

리포트는 로컬 파일(file://)로 브라우저에 열리는데, 체크박스를 누르면
자바스크립트가 이 서버(127.0.0.1)로 fetch 요청을 보내서
history.db 의 checked 테이블에 바로 기록한다. main.py 가 리포트를 연 뒤
사용자가 확인을 끝낼 때까지 이 서버를 띄워둔다.
"""
from __future__ import annotations

import json
import sqlite3
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def _make_handler(db_path: Path):
    class Handler(BaseHTTPRequestHandler):
        def _cors(self) -> None:
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

        def do_OPTIONS(self) -> None:  # CORS preflight
            self.send_response(204)
            self._cors()
            self.end_headers()

        def do_POST(self) -> None:
            if self.path != "/check":
                self.send_response(404)
                self._cors()
                self.end_headers()
                return

            length = int(self.headers.get("Content-Length", 0) or 0)
            body = self.rfile.read(length) if length else b""
            try:
                data = json.loads(body or b"{}")
                fp = str(data["fp"])
                checked = bool(data["checked"])
            except Exception:
                self.send_response(400)
                self._cors()
                self.end_headers()
                return

            conn = sqlite3.connect(str(db_path))
            try:
                if checked:
                    conn.execute(
                        "INSERT INTO checked (fp, checked_at) VALUES (?, datetime('now')) "
                        "ON CONFLICT(fp) DO UPDATE SET checked_at = excluded.checked_at",
                        (fp,),
                    )
                else:
                    conn.execute("DELETE FROM checked WHERE fp = ?", (fp,))
                conn.commit()
            finally:
                conn.close()

            self.send_response(204)
            self._cors()
            self.end_headers()

        def log_message(self, fmt, *args) -> None:  # 콘솔에 요청 로그 안 찍음
            pass

    return Handler


def start(db_path: Path) -> tuple[ThreadingHTTPServer, int]:
    """127.0.0.1 의 빈 포트에서 서버를 띄우고 (서버, 포트) 를 반환한다."""
    server = ThreadingHTTPServer(("127.0.0.1", 0), _make_handler(db_path))
    port = server.server_address[1]
    th = threading.Thread(target=server.serve_forever, daemon=True)
    th.start()
    return server, port
