@echo off
:: Bill-Bookkeeper Config Script
:: 改进版：添加UTF-8编码防止中文乱码

chcp 65001 >nul 2>&1
if %errorlevel% neq 0 chcp 936 >nul 2>&1

cd /d "%~dp0\.."

echo.
echo ============================================
echo    Bill-Bookkeeper Config
echo ============================================
echo.

:: Ensure data dir
if not exist data mkdir data

set CONFIG_FILE=data\config.json

:: Check existing config
if exist %CONFIG_FILE% (
    echo Existing config:
    type %CONFIG_FILE%
    echo.
    set /p OVERWRITE="Overwrite? (y/n): "
    if /i not "%OVERWRITE%"=="y" (
        echo Keep existing config
        exit /b 0
    )
)

echo.
echo How to get Deepseek API Key:
echo   1. Visit https://platform.deepseek.com/
echo   2. Sign up / Login
echo   3. Click "API Keys" on the left
echo   4. Click "Create API Key"
echo   5. Copy the key (starts with sk-)
echo.

set /p API_KEY="Enter API Key: "

if "%API_KEY%"=="" (
    echo [ERROR] API Key cannot be empty
    exit /b 1
)

:: Write config
echo {> %CONFIG_FILE%
echo   "aiProvider": "deepseek",>> %CONFIG_FILE%
echo   "aiApiKey": "%API_KEY%",>> %CONFIG_FILE%
echo   "aiBaseUrl": "https://api.deepseek.com/v1",>> %CONFIG_FILE%
echo   "aiModel": "deepseek-chat">> %CONFIG_FILE%
echo }>> %CONFIG_FILE%

echo.
echo [OK] Config saved
echo.
