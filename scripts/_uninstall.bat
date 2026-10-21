@echo off
:: Bill-Bookkeeper Uninstall Script
:: 改进版：添加UTF-8编码防止中文乱码

chcp 65001 >nul 2>&1
if %errorlevel% neq 0 chcp 936 >nul 2>&1

cd /d "%~dp0\.."

echo.
echo ============================================
echo    Bill-Bookkeeper Uninstall
echo ============================================
echo.
echo [WARNING] This will delete:
echo    - node_modules
echo    - Log files
echo.
echo [SAFE] Your data will be kept:
echo    - data\ledger.db
echo    - data\个人财务账本_2026.xlsx
echo    - data\config.json
echo.

set /p CONFIRM="Confirm cleanup? (yes/no): "
if /i not "%CONFIRM%"=="yes" (
    echo Cancelled
    pause
    exit /b 0
)

echo.
echo [1/3] Stop services...
node scripts\_core-stop.js >nul 2>&1

echo [2/3] Remove node_modules...
for %%d in (server frontend) do (
    if exist "packages\%%d\node_modules" rmdir /s /q "packages\%%d\node_modules"
)

echo [3/3] Clean logs and cache...
if exist "data\logs" rmdir /s /q "data\logs"
if exist "data\cache" rmdir /s /q "data\cache"
if exist ".pids" rmdir /s /q ".pids"

echo.
echo [OK] Cleanup complete!
echo.
echo To reinstall, run install.bat
echo.
pause
