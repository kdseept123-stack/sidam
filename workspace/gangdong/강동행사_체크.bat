@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 강동구 행사 수집

echo ================================================
echo   강동구 행사 수집
echo ================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo [오류] Python 이 설치되어 있지 않습니다.
    echo        https://www.python.org 에서 설치 후 다시 실행하세요.
    pause
    exit /b 1
)

if not exist "config\.env" (
    echo [안내] config\.env 파일이 없습니다.
    echo        config\.env.example 을 복사해 config\.env 로 만들고
    echo        Gemini API 키를 넣은 뒤 다시 실행하세요.
    echo.
    pause
    exit /b 1
)

echo - 필요한 패키지 확인 중...
python -m pip install -q -r requirements.txt

echo - 브라우저 엔진 확인 중(최초 1회만 시간 걸림)...
python -m playwright install chromium >nul 2>nul

echo.
python main.py

echo.
echo ================================================
pause
