@echo off
chcp 65001 >nul
title 영수증 프린터 고치기
echo.
echo ============================================
echo   영수증 프린터(SEWOO SLK-TS100) 고치기
echo ============================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo [!] 이 파일을 마우스 우클릭 - "관리자 권한으로 실행" 으로 다시 실행해주세요.
  echo.
  pause
  exit /b
)

echo [1/5] 인쇄 서비스 중지...
net stop spooler

echo.
echo [2/5] 밀려있는 인쇄 작업 모두 삭제...
del /Q /F "%systemroot%\System32\spool\PRINTERS\*.*" 2>nul

echo.
echo [3/5] 인쇄 서비스 다시 시작...
net start spooler

echo.
echo [4/5] 프린터 오프라인 상태 해제...
powershell -NoProfile -Command "$names=@('SEWOO SLK-TS100 (copy 1)','SEWOO SLK-TS100','SLK-TS100 (copy 1)','SLK-TS100'); foreach($n in $names){ $p=Get-WmiObject Win32_Printer -Filter (\"Name='\"+$n.Replace(\"'\",\"''\")+\"'\") -ErrorAction SilentlyContinue; if($p){ if($p.WorkOffline){ $p.SetWorkOffline($false) | Out-Null }; Write-Host ('   - '+$n+'  ->  ' + $(if($p.WorkOffline){'아직 오프라인 (USB 확인 필요)'}else{'온라인'})) } }"

echo.
echo [5/5] 현재 프린터 상태
powershell -NoProfile -Command "Get-Printer | Where-Object { $_.Name -like '*TS100*' } | Select-Object Name,PrinterStatus,PortName | Format-Table -AutoSize"

echo.
echo ============================================
echo   완료. 이제 앱에서 영수증 1건만 먼저 출력해보세요.
echo   여전히 오프라인이면 USB 케이블을 다른 포트에 다시 꽂고
echo   프린터 전원을 껐다 켠 뒤 이 파일을 한 번 더 실행하세요.
echo ============================================
echo.
pause
