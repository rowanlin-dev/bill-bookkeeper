# Bill-Bookkeeper 脚本架构说明

## 设计原则

**根目录 `.bat` = 用户入口（双击即用）**
**`scripts/` 下划线文件 = 核心实现**

这样设计的好处：
- 根目录整洁，用户一眼看到所有操作
- 核心逻辑集中在 scripts/，便于维护
- 根目录脚本只是简单的转发层

## 文件关系

```
bill-bookkeeper/
│
├── 📄 install.bat          → 调用 scripts/_install.bat
├── 📄 config.bat           → 调用 scripts/_config.bat
├── 📄 start.bat            → 调用 scripts/_core-start.js
├── 📄 stop.bat             → 调用 scripts/_core-stop.js
├── 📄 diagnose.bat         → 调用 scripts/_diagnose.bat
├── 📄 migrate.bat          → 调用 scripts/_migrate.bat
├── 📄 uninstall.bat        → 调用 scripts/_uninstall.bat
│
└── 📁 scripts/
    ├── 📄 _install.bat      ← 安装依赖（Node/pnpm）
    ├── 📄 _config.bat       ← 配置 API Key
    ├── 📄 _core-start.js    ← 核心启动（跨平台）
    ├── 📄 _core-stop.js     ← 核心关闭（跨平台）
    ├── 📄 _diagnose.bat     ← 诊断工具
    ├── 📄 _migrate.bat      ← 数据迁移
    ├── 📄 _uninstall.bat    ← 卸载清理
    └── 📄 migrate-data.py   ← Python 迁移脚本（需系统 Python + pip install openpyxl）
```

## 兼容性处理

### 1. 中文乱码

所有 `.bat` 文件开头都有：
```bat
chcp 65001 >nul 2>&1
```

这设置 UTF-8 编码，避免中文显示乱码。

### 2. 终端兼容性

`_core-start.js` 自动检测：
- Windows Terminal / VS Code 终端 → 显示 Unicode 图标 ✅❌⚠️
- 传统 cmd.exe → 显示 ASCII 替代 [OK] [ERR] [!]
- 无颜色终端 → 自动禁用 ANSI 颜色

### 3. PowerShell 兼容

根目录 `.bat` 文件可以在以下环境运行：
- ✅ 双击运行（explorer → cmd）
- ✅ cmd.exe 中运行
- ✅ PowerShell 中运行 `.\start.bat`
- ✅ Windows Terminal 中运行

### 4. 跨平台（未来）

`_core-start.js` 和 `_core-stop.js` 已经支持：
- Windows（检测 `win32`）
- macOS（检测 `darwin`）
- Linux（检测 `linux`）

未来只需添加 `start.sh` / `stop.sh` 调用相同的 `.js` 文件即可。

## 使用方式

| 用户类型 | 操作 |
|---------|------|
| **完全新手** | 双击 `install.bat` → 双击 `config.bat` → 双击 `start.bat` |
| **已安装过** | 双击 `start.bat` |
| **出问题** | 双击 `diagnose.bat` |
| **导入旧数据** | 双击 `migrate.bat` |
| **重装** | 双击 `uninstall.bat` → 双击 `install.bat` |
