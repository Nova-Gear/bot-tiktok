@echo off
setlocal
title Bot TikTok Runner - Windows

REM Membaca parameter jika diberikan (contoh: run.bat 1 5 https://www.tiktok.com/@pojok.lamongan)
set RUNS=%1
set BROWSERS=%2
set TARGET_URL=%3

REM Jika tidak diberikan argumen, tanyakan secara interaktif
if "%RUNS%"=="" (
    set /p RUNS="Masukkan jumlah putaran (default: 1): "
)
if "%RUNS%"=="" set RUNS=1

if "%BROWSERS%"=="" (
    set /p BROWSERS="Masukkan jumlah browser paralel (default: 1): "
)
if "%BROWSERS%"=="" set BROWSERS=1

if "%TARGET_URL%"=="" (
    set /p TARGET_URL="Masukkan link/username profil TikTok (default: https://www.tiktok.com/@pojok.lamongan): "
)
if "%TARGET_URL%"=="" set TARGET_URL=https://www.tiktok.com/@pojok.lamongan

echo.
echo ======================================================
echo Target Profil   : %TARGET_URL%
echo Jumlah Putaran  : %RUNS%
echo Browser Paralel : %BROWSERS%
echo ======================================================
echo.

call npm start %RUNS% %BROWSERS% %TARGET_URL%

echo.
echo Selesai.
pause
