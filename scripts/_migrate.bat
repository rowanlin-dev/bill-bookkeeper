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
:: 注意：本脚本是数据迁移工具，不是 AI 服务；AI 已并入 Node 后端进程内。
:: 这里使用系统 Python（原 AI 服务的虚拟环境已随 Python 服务一并删除），需自备 openpyxl。
echo [1/2] Check environment...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo    [ERROR] Python not found
    echo    Install Python 3.9+ from https://python.org/
    pause
    exit /b 1
)
python -c "import openpyxl" >nul 2>&1
if %errorlevel% neq 0 (
    echo    [ERROR] openpyxl not found
    echo    Run: pip install openpyxl
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
python scripts\migrate-data.py

echo.
pause
