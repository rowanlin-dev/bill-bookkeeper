# Bill-Bookkeeper 新手安装指南

> **完全不懂命令行？没问题！** 日常操作只有双击和网页点按。

## 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | **≥ 22.5** | 后端使用 Node 内置 SQLite，无需任何原生编译 |
| pnpm | 无需 | 本项目统一用 npm（Node 自带） |
| Python | ≥ 3.9（仅迁移旧 Excel 时需要） | 只有 `scripts/migrate.bat` 用到，且需 `pip install openpyxl` |

---

## 安装步骤

### 第 1 步：安装依赖

运行 **`scripts/install.bat`**（只需一次）。它会自动检查环境并安装后端 / 前端两方依赖。

### 第 2 步：启动

双击 **`start.bat`**，等待显示：

```
✅ Server: READY      (http://localhost:3000)
✅ Frontend: READY    (http://localhost:5173)
```

浏览器打开 **http://localhost:5173**。

### 第 3 步：配置 AI（在网页里完成）

1. 打开「设置」页
2. 粘贴你的 **DeepSeek API Key**（https://platform.deepseek.com 申请）
3. 保存——配置会写入项目根目录的 `.env`（已被 git 忽略，不会泄露）

**没有 API Key**：AI 记账降级为离线规则解析，其余功能不受影响。

---

## 日常使用

| 操作 | 方式 |
|------|------|
| 启动 / 关闭 | 双击 `start.bat` / `stop.bat` |
| 服务状态、重启、日志 | 网页「设置 → 🖥️ 系统控制台」 |
| **开机自启动** | 系统控制台勾选"开机自动启动"（免管理员，登录 Windows 时静默拉起） |
| 修改 API Key / 模型 | 网页「设置」页 |
| 导入 Excel 账本 | `scripts/migrate.bat`（需系统 Python + `pip install openpyxl`） |

辅助脚本（安装/诊断/卸载等）都在 `scripts/` 目录。

---

## 记账小贴士（AI 智能记账页）

直接用自然语言，AI 会识别成不同操作：

| 你说 | AI 做什么 |
|------|-----------|
| "晚饭13，饮料7" | 记两笔支出 |
| "充值岭南通20" | 记**转账**（微信→岭南通），不会算成消费 |
| "坐公交刷岭南通5块" | 记岭南通账户支出 |
| "现在微信剩2156.33" | **校准余额**（更新锚点） |
| "酷狗会员以后不每月扣了" | 取消固定支出 + 未来预计流水 |
| "拼多多59.9先用后付还没扣" | 记"待生效"，不计入统计，确认后一键转正 |

解析结果会分组预览、逐项勾选，**疑似重复的条目自动标红**，确认后才入账。

---

## 常见问题

### Q1: 双击 start.bat 报错或闪退

1. 确认 Node.js ≥ 22.5（命令行输入 `node -v`）
2. 查看日志：`data/logs/server.log`
3. 端口被占用：先运行 `stop.bat`，再重新 `start.bat`

### Q2: 网页打不开 / 数据为空

1. 打开「设置 → 系统控制台」看两个服务是否都是 🟢
2. 点"重启全部服务"，等 10 秒自动刷新

### Q3: AI 记账不工作

1. 「设置」页确认 API Key 状态是 ✅ 已配置
2. 系统控制台查看"后端服务"日志
3. 检查网络（需要访问模型 API）

### Q4: 余额和实际钱包对不上

看板「账户余额」卡片 → 点"校准余额"，输入你实际看到的金额即可。之后新记的账会基于新锚点累计。

### Q5: 如何导入现有 Excel 账本？

1. 把 Excel 放到 `data/` 目录，文件名保持 `个人财务账本_2026.xlsx`
2. 运行 `scripts/migrate.bat`

### Q6: 忘记某个卡/账户的初始余额（如岭南通）

没关系。先正常记账，等哪天看了一眼实际余额，到看板点"校准余额"补上锚点即可，历史记录不受影响。

---

## 升级/重装

### 重装依赖

1. `stop.bat` 关闭服务
2. 删除 `packages/server/node_modules`、`packages/frontend/node_modules`
3. 重新运行 `scripts/install.bat`

### 更新代码（git）

```bash
git pull
npm --prefix packages/server install
npm --prefix packages/frontend install
```

然后 `stop.bat` → `start.bat`。

---

## 需要帮助？

1. 网页「设置 → 系统控制台」查看状态与日志
2. 日志文件：`data/logs/` 目录
3. 截图错误信息寻求帮助
