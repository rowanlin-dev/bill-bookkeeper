@echo off
chcp 65001 >nul 2>&1
if %errorlevel% neq 0 chcp 936 >nul 2>&1

cd /d "%~dp0"

echo.
echo ============================================
echo    修复 better-sqlite3 编译问题
echo ============================================
echo.

echo [1/3] Node.js 版本...
node -v
echo.

echo [2/3] 强制重新安装 better-sqlite3...
cd packages\server

echo    删除旧编译...
if exist "node_modules\.pnpm\better-sqlite3@11.0.0" (
    rmdir /s /q "node_modules\.pnpm\better-sqlite3@11.0.0"
)
if exist "node_modules\better-sqlite3" (
    rmdir /s /q "node_modules\better-sqlite3"
)
if exist "pnpm-lock.yaml" del "pnpm-lock.yaml"

echo    重新安装并编译...
call pnpm add better-sqlite3@11.0.0

echo [3/3] 验证...
node -e "const db = require('better-sqlite3')(':memory:'); console.log('better-sqlite3 OK:', db.prepare('SELECT 1').get()); db.close();"
if %errorlevel% neq 0 (
    echo    [ERROR] 验证失败
    pause
    exit /b 1
)

echo    [OK] 编译成功
echo.
echo 请重新运行 start.bat
echo.
pause
