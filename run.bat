@echo off
setlocal
title Bot TikTok Runner - Windows

REM Jika tidak diberikan argumen, jalankan mode interaktif bawaan bot
if "%~1"=="" (
    call npm start
) else (
    call npm start -- %*
)

echo.
echo Selesai.
pause
