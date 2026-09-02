@echo off
:: Bill-Bookkeeper Migrate Script
:: 改进版：添加UTF-8编码防止中文乱码

chcp 65001 >nul 2>&1
if %errorlevel% neq 0 chcp 936 >nul 2>&1

cd /d "%~dp0\.."

echo.
echo ============================================
echo    Bill-Bookkeeper Migrate
echo    Excel -^> SQLite
echo ============================================
echo.

:: Check Python
echo [1/2] Check environment...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo    [ERROR] Python not found
    pause
    exit /b 1
)

if not exist "packages\ai\venv" (
    echo    [ERROR] venv not found, run install.bat first
    pause
    exit /b 1
)
echo    [OK] Environment OK
echo.

:: Check Excel
echo [2/2] Check data file...
if not exist "data\个人财务账本_2026.xlsx" (
    echo    [WARNING] Excel file not found
    echo    Please put file at: data\个人财务账本_2026.xlsx
    pause
    exit /b 1
)
echo    [OK] Found Excel file
echo.

:: Run migration
echo [MIGRATE] Start migrating...
packages\ai\venv\Scripts\python.exe scripts\migrate-data.py

echo.
pause
