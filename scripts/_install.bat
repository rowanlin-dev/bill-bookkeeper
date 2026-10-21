@echo off
:: Bill-Bookkeeper Install (Safe Version)

chcp 65001 >nul 2>&1
if %errorlevel% neq 0 chcp 936 >nul 2>&1

cd /d "%~dp0\.."

echo:
echo ============================================
echo    Bill-Bookkeeper 安装程序
echo ============================================
echo:

:: 1. Node.js
echo [1/4] 检测 Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo    [ERROR] Node.js 未找到
    pause
    exit /b 1
)
for /f "tokens=*" %%a in ('node -v') do echo    [OK] Node.js %%a

:: 2. pnpm
echo [2/4] 检测 pnpm...
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo    [INSTALL] 安装 pnpm...
    npm install -g pnpm --loglevel=info
    if %errorlevel% neq 0 (
        echo    [ERROR] pnpm 安装失败
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%a in ('pnpm -v') do echo    [OK] pnpm %%a

:: 3. Server deps
echo [3/4] 安装后端依赖...
if not exist "packages\server" (
    echo    [SKIP] packages\server 不存在
) else (
    cd packages\server
    echo    安装中...
    call pnpm install
    echo    批准构建脚本（better-sqlite3需要编译）...
    call pnpm approve-builds better-sqlite3
    echo    [OK] 后端依赖完成
    cd ..\..
)

:: 4. Frontend deps
echo [4/4] 安装前端依赖...
if not exist "packages\frontend" (
    echo    [SKIP] packages\frontend 不存在
) else (
    cd packages\frontend
    echo    安装中...
    call pnpm install
    echo    批准构建脚本（esbuild需要编译）...
    call pnpm approve-builds esbuild vue-demi
    echo    [OK] 前端依赖完成
    cd ..\..
)

echo:
echo ============================================
echo    安装完成！
echo ============================================
echo:
echo 下一步：双击 start.bat 启动服务
echo:
pause
