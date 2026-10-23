@echo off
setlocal
title Setup Bot TikTok - Playwright Automation

echo ======================================================
echo    Setup Otomatisasi Bot TikTok (Playwright) - Windows
echo ======================================================
echo.

REM 1. Periksa apakah Node.js sudah terinstal
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js tidak ditemukan di komputer ini!
    echo Silakan unduh dan install Node.js terlebih dahulu dari:
    echo https://nodejs.org/ (pilih versi LTS)
    echo Setelah install, buka kembali terminal atau jalankan script ini lagi.
    echo.
    pause
    exit /b 1
)

echo [1/3] Node.js terdeteksi:
node -v
npm -v
echo.

REM 2. Install dependensi Node (Playwright, TSX, TypeScript)
echo [2/3] Menginstal dependensi NPM...
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Gagal menginstal dependensi npm.
    pause
    exit /b 1
)
echo.

REM 3. Install browser Chromium untuk Playwright di Windows
echo [3/3] Mengunduh browser Chromium untuk Playwright...
call npx playwright install chromium
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Gagal memasang browser Playwright.
    pause
    exit /b 1
)
echo.

echo ======================================================
echo    Instalasi Selesai! Bot siap dijalankan di Windows.
echo ======================================================
echo.
echo Contoh menjalankan bot:
echo   - Dobel klik run.bat
echo   - Atau di Command Prompt / PowerShell:
echo       npm start 1 2
echo.
pause
