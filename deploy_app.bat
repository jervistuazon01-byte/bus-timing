@echo off
setlocal EnableDelayedExpansion
title Portfolio Tracker Deployer
color 0A

echo ===================================================
echo      Stock Tracker - Deployment Automation
echo ===================================================
echo.

REM Navigate into the project folder
cd stock-tracker || (
    color 0C
    echo [ERROR] Could not find 'stock-tracker' folder!
    pause
    exit /b 1
)

REM 1. Check/Install Dependencies
if not exist node_modules (
    echo [INFO] Installing dependencies...
    call npm install
)

REM 2. Git Initialization
if not exist .git (
    echo [INFO] Initializing Git...
    git init
    git branch -M main
)

REM 3. Check Remote Origin
git remote get-url origin >nul 2>&1
if %errorlevel% neq 0 goto :SETUP_REMOTE
goto :BUILD_AND_DEPLOY

:SETUP_REMOTE
echo.
echo [IMPORTANT] No GitHub repository linked.
echo.

REM Check for GitHub CLI
where gh >nul 2>&1
if %errorlevel% equ 0 goto :AUTO_CREATE_REPO

REM Manual Repo Setup
echo [INFO] GitHub CLI not found. Manual input required.
echo.
echo Please create a new repository at: https://github.com/new
echo Name it 'portfolio-tracker'
echo.
set /p REPO_URL="Enter the GitHub Repository URL (e.g., https://github.com/user/repo.git): "
echo.
echo Linking to: !REPO_URL!
git remote add origin !REPO_URL!
goto :BUILD_AND_DEPLOY

:AUTO_CREATE_REPO
echo [INFO] GitHub CLI found. Attempting to create repository...
echo.
echo Creating 'stock-tracker' repository on GitHub...
call gh repo create portfolio-tracker --public --source=. --remote=origin
goto :BUILD_AND_DEPLOY

:BUILD_AND_DEPLOY
echo.
echo [INFO] Building Project...
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Build failed! 
    echo Please check the error messages above.
    pause
    exit /b %errorlevel%
)

echo.
echo [INFO] Deploying to GitHub Pages...
call npm run deploy
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Deployment failed!
    echo Please check the error messages above.
    pause
    exit /b %errorlevel%
)

echo.
echo [INFO] Pushing Source Code to Main...
git add .
git commit -m "Automated deployment update"
git push -u origin main

echo.
echo ===================================================
echo      DEPLOYMENT COMPLETE!
echo ===================================================
echo.
echo Your app should be live in a few minutes at:
echo https://jervistuazon01-byte.github.io/portfolio-tracker/
echo.
pause
endlocal
