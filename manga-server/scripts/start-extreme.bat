@echo off
title Extreme Performance Manga Server v5.0

echo.
echo ██████╗ ██████╗ ██████╗ ██╗      ██████╗ ██████╗ ███████╗    
echo ██╔══██╗██╔══██╗██╔══██╗██║     ██╔═══██╗██╔══██╗██╔════╝    
echo ██████╔╝██████╔╝██║  ██║██║     ██║   ██║██║  ██║█████╗      
echo ██╔══██╗██╔══██╗██║  ██║██║     ██║   ██║██║  ██║██╔══╝      
echo ██║  ██║██║  ██║██████╔╝███████╗╚██████╔╝██████╔╝███████╗    
echo ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝ ╚═════╝ ╚═════╝ ╚══════╝    
echo.
echo         EXTREME Performance Manga Server v5.0
echo         Target: 20,000+ requests/second
echo.

:: Check if port is in use
echo Checking port 80...
netstat -an | findstr ":80" | findstr LISTENING >nul
if %errorlevel% == 0 (
    echo ⚠️ Port 80 is in use. Attempting to free it...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":80" ^| findstr LISTENING') do (
        echo Killing process %%a...
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
)

echo ✅ Port 80 is free

:: Ensure data directory exists
if not exist "data" mkdir data

:: Set optimal environment variables for extreme performance
set NODE_ENV=production
set PORT=80
set HOSTNAME=0.0.0.0
set CACHE_SIZE_MB=1024
set MAX_CONNECTIONS=20000
set WORKER_THREADS=8
set MEMORY_POOL_MB=512
set GC_THRESHOLD_MB=300
set STREAMING_THRESHOLD_KB=32
set ENABLE_HTTP2=true
set REQUEST_BATCH_SIZE=100

echo 🚀 Starting Extreme Performance Server...
echo    Cache: %CACHE_SIZE_MB%MB
echo    Workers: %WORKER_THREADS% threads  
echo    Memory Pool: %MEMORY_POOL_MB%MB
echo    Max Connections: %MAX_CONNECTIONS%
echo.

:: Start server with GC enabled and performance monitoring
bun run --expose-gc src/extreme-performance-server.ts

pause