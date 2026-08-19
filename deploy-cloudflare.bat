@echo off
title Wonderland Craft - Cloudflare Pages Deploy
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is required. Install it from https://nodejs.org
  echo then run this script again.
  echo.
  pause
  exit /b 1
)

echo ==================================================
echo   Wonderland Craft - one-click Cloudflare Pages deploy
echo ==================================================
echo Project name: wcraft ^(falls back to wl-c if taken^)
echo FIRST RUN ONLY: a browser opens to log in to your
echo free Cloudflare account. After that every run is
echo fully automatic.
echo.

node tools\deploy-cloudflare.mjs

echo.
pause
