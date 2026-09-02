@echo off
:: 环境诊断：只检测，不安装，不闪退

chcp 65001 >nul 2>&1
if %errorlevel% neq 0 chcp 936 >nul 2>&1

cd /d "%~dp0"

echo:
echo ============================================
echo    环境诊断测试
echo ============================================
echo:

echo [1/5] 当前目录: %cd%
echo [2/5] 检测 Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (echo    [ERROR] Node.js 未找到) else (for /f "tokens=*" %%a in ('node -v') do echo    [OK] Node.js %%a)

echo [3/5] 检测 Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (echo    [ERROR] Python 未找到) else (for /f "tokens=*" %%a in ('python --version') do echo    [OK] %%a)

echo [4/5] 检测 pnpm...
where pnpm >nul 2>&1
if %errorlevel% equ 0 (for /f "tokens=*" %%a in ('pnpm -v') do echo    [OK] pnpm %%a) else (echo    [WARN] pnpm 未在 PATH 中)

echo [5/5] 检测项目目录...
if exist "scripts" (echo    [OK] scripts 存在) else (echo    [MISS] scripts 不存在)
if exist "packages" (echo    [OK] packages 存在) else (echo    [MISS] packages 不存在)

echo:
echo ============================================
echo    诊断完成
echo ============================================
echo:
echo 如果窗口没有关闭，说明环境正常
echo:
pause
