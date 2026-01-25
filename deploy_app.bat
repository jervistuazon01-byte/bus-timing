@echo off
echo ===================================================
echo      SG Bus Timing - Deploy to GitHub
echo ===================================================
echo.

REM 1. Ensure we are linked to the correct repo
git remote set-url origin https://github.com/jervistuazon01-byte/bus-timing.git 2>nul
if %errorlevel% neq 0 (
    echo Linking to repository...
    git remote add origin https://github.com/jervistuazon01-byte/bus-timing.git
)

REM 2. Pull latest changes (to avoid conflicts)
echo [1/3] Syncing with GitHub...
git pull origin main

REM 3. Add and Commit
echo.
echo [2/3] Saving changes...
git add .

REM explain to user that input is expected
echo.
echo ---------------------------------------------------
echo  PLEASE TYPE A MESSAGE BELOW AND PRESS ENTER
echo  (Or just press Enter to use default message)
echo ---------------------------------------------------
set /p msg="Enter commit message: "
if "%msg%"=="" set msg=Update

git commit -m "%msg%"

REM 4. Push
echo.
echo [3/3] Uploading to GitHub...
git push -u origin main

echo.
echo ===================================================
echo      DEPLOYMENT COMPLETE!
echo ===================================================
pause
