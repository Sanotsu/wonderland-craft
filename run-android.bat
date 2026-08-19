@echo off
title Wonderland Craft - Android debug install + logcat
cd /d "%~dp0"

where adb >nul 2>&1
if errorlevel 1 (
  echo [ERROR] adb not found in PATH. Add Android platform-tools to PATH.
  pause & exit /b 1
)

rem ---- pick first connected device ----
for /f "tokens=1" %%d in ('adb devices ^| findstr /r "device$" ^| findstr /v "List"') do set DEV=%%d
if "%DEV%"=="" (
  echo [ERROR] no device connected. Check: adb devices
  pause & exit /b 1
)
echo Device: %DEV%

rem ---- build ----
echo.
echo [1/3] Building debug APK...
pushd android
call gradlew.bat assembleDebug
if errorlevel 1 ( popd & echo [ERROR] build failed & pause & exit /b 1 )
popd

rem ---- install ----
echo.
echo [2/3] Installing...
adb -s %DEV% install -r android\app\build\outputs\apk\debug\app-debug.apk
if errorlevel 1 ( echo [ERROR] install failed & pause & exit /b 1 )

rem ---- launch + logs ----
echo.
echo [3/3] Launching app, streaming logs (Ctrl+C to stop)...
adb -s %DEV% logcat -c
adb -s %DEV% shell am start -n com.wonderland.craft/.MainActivity
adb -s %DEV% logcat Capacitor:V chromium:V chromium-console:V Console:V AndroidRuntime:E System.err:W *:S
