@echo off
:: Bill-Bookkeeper Diagnose Script
:: 改进版：添加UTF-8编码防止中文乱码

chcp 65001 >nul 2>&1
if %errorlevel% neq 0 chcp 936 >nul 2>&1
setlocal EnableDelayedExpansion

cd /d "%~dp0\.."

echo.
echo ============================================
echo    Bill-Bookkeeper Diagnose
echo ============================================
echo.

:: Check env
echo [1/5] Check environment...
node -v >nul 2>&1 && echo    Node.js: OK || echo    Node.js: MISSING
pnpm -v >nul 2>&1 && echo    pnpm: OK || echo    pnpm: MISSING
echo.

:: Check install
echo [2/5] Check install status...
if exist "packages\server\node_modules" (echo    Server deps: OK) else (echo    Server deps: MISSING)
if exist "packages\frontend\node_modules" (echo    Frontend deps: OK) else (echo    Frontend deps: MISSING)
if exist "data\config.json" (echo    Config: OK) else (echo    Config: MISSING)
echo.

:: Check running
echo [3/5] Check service status...
for %%p in (3000 5173) do (
    netstat -ano | findstr ":%%p" >nul 2>&1
    if !errorlevel! equ 0 (
        echo    Port %%p: RUNNING
    ) else (
        echo    Port %%p: STOPPED
    )
)
echo.

:: Show logs
echo [4/5] Recent logs...
for %%s in (server frontend) do (
    echo    [%%s.log]
    if exist "data\logs\%%s.log" (
        powershell -Command "Get-Content data\logs\%%s.log -Tail 3 -ErrorAction SilentlyContinue" 2>nul
    ) else (
        echo        (no log file)
    )
)
echo.

:: Check data
echo [5/5] Check data...
if exist "data\ledger.db" (echo    SQLite: OK) else (echo    SQLite: MISSING)
if exist "data\个人财务账本_2026.xlsx" (echo    Excel: OK) else (echo    Excel: MISSING)
echo.

pause
