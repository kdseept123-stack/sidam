"""LLM 호출부. 지금은 Gemini(무료 티어)만. 나중에 Claude 등 추가 가능하도록 분리."""
from __future__ import annotations

import json
import re
import time

import requests

_RETRY_STATUS = {429, 500, 502, 503, 504}
_MAX_TRIES = 4


class LLMError(Exception):
    pass


def _loads_lenient(text: str):
    """```json 펜스나 앞뒤 잡음이 섞여도 JSON 을 뽑아낸다."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # 첫 배열/객체만 잘라서 재시도
    for opener, closer in (("[", "]"), ("{", "}")):
        i = text.find(opener)
        j = text.rfind(closer)
        if i != -1 and j != -1 and j > i:
            try:
                return json.loads(text[i : j + 1])
            except json.JSONDecodeError:
                continue
    raise LLMError(f"JSON 파싱 실패: {text[:300]}")


class GeminiClient:
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        self.endpoint = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent"
        )

    def generate_json(self, system: str, user: str):
        body = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {
                "temperature": 0.2,
                "response_mime_type": "application/json",
            },
        }
        last_err = ""
        for attempt in range(1, _MAX_TRIES + 1):
            try:
                resp = requests.post(
                    self.endpoint,
                    params={"key": self.api_key},
                    json=body,
                    timeout=90,
                )
            except requests.RequestException as exc:
                last_err = f"연결 실패: {exc}"
                if attempt == _MAX_TRIES:
                    raise LLMError(f"Gemini {last_err}") from exc
                time.sleep(2 ** attempt)
                continue

            if resp.status_code == 200:
                break

            last_err = f"HTTP {resp.status_code}: {resp.text[:200]}"
            if resp.status_code in _RETRY_STATUS and attempt < _MAX_TRIES:
                wait = 2 ** attempt
                retry_after = resp.headers.get("Retry-After")
                if retry_after and retry_after.isdigit():
                    wait = max(wait, int(retry_after))
                time.sleep(wait)
                continue
            raise LLMError(f"Gemini {last_err}")
        else:
            raise LLMError(f"Gemini 재시도 실패 - {last_err}")

        payload = resp.json()
        try:
            parts = payload["candidates"][0]["content"]["parts"]
            text = "".join(p.get("text", "") for p in parts)
        except (KeyError, IndexError) as exc:
            fb = payload.get("promptFeedback", {})
            raise LLMError(f"Gemini 응답 형식 이상: {json.dumps(fb, ensure_ascii=False)[:300]}") from exc
        return _loads_lenient(text)


def get_llm(cfg: dict):
    provider = cfg["provider"]
    if provider == "gemini":
        if not cfg["gemini_api_key"]:
            raise LLMError(
                "GEMINI_API_KEY 가 비어 있습니다.\n"
                "  1) https://aistudio.google.com/apikey 에서 무료 키 발급\n"
                "  2) config/.env 파일의 GEMINI_API_KEY= 뒤에 붙여넣기"
            )
        return GeminiClient(cfg["gemini_api_key"], cfg["gemini_model"])
    raise LLMError(f"알 수 없는 LLM_PROVIDER: {provider!r} (지원: gemini)")
