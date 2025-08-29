@echo off
title Kill Bun Processes - Port 80 Recovery

echo 🛑 Bulletproof Bun Process Termination
echo =====================================

:: Kill all bun.exe processes
echo Terminating all bun.exe processes...
taskkill /F /IM bun.exe >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Bun processes terminated
) else (
    echo ⚠️ No bun processes found
)

:: Kill processes using port 80
echo Freeing port 80...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":80" ^| findstr LISTENING 2^>nul') do (
    echo Killing process using port 80: %%a
    taskkill /F /PID %%a >nul 2>&1
)

:: Wait a moment for cleanup
timeout /t 2 /nobreak >nul

:: Verify port is free
netstat -an | findstr ":80" | findstr LISTENING >nul
if %errorlevel% == 0 (
    echo ⚠️ Port 80 still in use
    netstat -ano | findstr ":80" | findstr LISTENING
) else (
    echo ✅ Port 80 is now free
)

echo.
echo Press any key to continue...
pause >nul