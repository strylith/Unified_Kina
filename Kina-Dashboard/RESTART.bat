@echo off
echo ================================================
echo Kina Resort System - Restarting Server
echo ================================================
echo.
echo Stopping server on port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
    if errorlevel 0 (
        echo Stopped process on port 3000 (PID: %%a)
    )
)
timeout /t 2 /nobreak >nul
echo.
echo Checking for .env file...
if not exist .env (
    echo [WARNING] .env file not found!
    echo Please copy env.example.txt to .env and configure it.
    echo.
    pause
    exit /b 1
)
echo .env file found!
echo.
echo Starting server...
echo.
echo Server will start at: http://localhost:3000
echo.
echo ================================================
call npm start
pause


