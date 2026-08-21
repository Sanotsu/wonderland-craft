@echo off
title Wonderland Craft - Release APK (signed)
cd /d "%~dp0"

if not exist android\key.properties (
  echo [ERROR] android\key.properties not found.
  echo Fill it first: storeFile / storePassword / keyAlias / keyPassword
  echo ^(template comments inside; file is git-ignored, never commit it^)
  pause & exit /b 1
)

echo [1/3] Building release APK...
pushd android
call gradlew.bat assembleRelease
if errorlevel 1 ( popd & echo [ERROR] build failed & pause & exit /b 1 )
popd

set APK=android\app\build\outputs\apk\release\app-release.apk
if not exist %APK% (
  echo [ERROR] %APK% not found - signing may have failed, check key.properties
  pause & exit /b 1
)

echo.
echo [2/3] Verifying signature...
set APKS=
where apksigner.bat >nul 2>&1 && for /f "delims=" %%i in ('where apksigner.bat') do set APKS=%%i
if not defined APKS if defined ANDROID_HOME (
  for /d %%d in ("%ANDROID_HOME%\build-tools\*") do if exist "%%d\apksigner.bat" set APKS=%%d\apksigner.bat
)
if not defined APKS if exist "%LOCALAPPDATA%\Android\Sdk" (
  for /d %%d in ("%LOCALAPPDATA%\Android\Sdk\build-tools\*") do if exist "%%d\apksigner.bat" set APKS=%%d\apksigner.bat
)
if not defined APKS if exist android\local.properties (
  for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command "(Select-String -Path android\local.properties -Pattern '^sdk\.dir=(.+)').Matches[0].Groups[1].Value -replace '\\:',':' -replace '\\\\','\'"`) do (
    for /d %%d in ("%%p\build-tools\*") do if exist "%%d\apksigner.bat" set APKS=%%d\apksigner.bat
  )
)
if defined APKS (
  call "%APKS%" verify --print-certs %APK% | findstr /i "alias SHA-256"
) else (
  echo apksigner not found - skip standalone verify.
  echo ^(gradle validateSigningRelease already passed during build, signature is valid^)
)

echo.
echo [3/3] Copying release artifact...
set VN=
for /f "tokens=2" %%v in ('findstr /c:"versionName " android\app\build.gradle') do set VN=%%v
set VN=%VN:"=%
if not defined VN set VN=unknown
del /q wonderland-craft-release-*.apk 2>nul
copy /y %APK% wonderland-craft-release-%VN%.apk >nul
echo Done: wonderland-craft-release-%VN%.apk
certutil -hashfile wonderland-craft-release-%VN%.apk SHA256 | findstr /v /i "hash certutil"
echo.
echo Install on connected device:
echo   adb install -r wonderland-craft-release-%VN%.apk
echo ^(debug build stays at wonderland-craft.apk^)
pause
