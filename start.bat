@echo off
echo.
echo ========================================
echo    SG Bus Timing - Starting App
echo ========================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Start the server
echo Starting SG Bus Timing...
echo.
node server.js

pause
