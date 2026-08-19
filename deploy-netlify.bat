@echo off
title Wonderland Craft - Netlify Deploy
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
echo   Wonderland Craft - one-click Netlify deploy
echo ==================================================
echo.
echo FIRST RUN ONLY (interactive, browser opens):
echo   1. Allow Netlify CLI to open the browser, log in
echo   2. Choose:  Create and configure a new site
echo   3. Site name: just press Enter (random name)
echo After that every run is fully automatic.
echo.

rem ---- fast path: use the globally installed CLI if present ----
where netlify >nul 2>&1
if not errorlevel 1 (
  echo Using globally installed Netlify CLI ^(fast^)...
  call netlify deploy --prod --dir=web
  goto :done
)

rem ---- fallback: npx cache channel (checks registry every run) ----
echo Netlify CLI not installed globally - using npx ^(slower^).
echo Tip: run this ONCE to make future deploys faster:
echo     npm install -g netlify-cli
echo.
call npx --yes netlify-cli@latest deploy --prod --dir=web

:done
echo.
echo ==================================================
echo Done. The "Website URL" printed above is your
echo public game link - open it on any phone or PC.
echo (Keep this link; re-run this script to redeploy)
echo ==================================================
echo.
pause
