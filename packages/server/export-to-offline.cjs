// 把在线版 SQLite 账本导出为离线版可导入的 JSON
// 用法：node packages/server/export-to-offline.cjs
// 产物：<项目根>/offline-import.json  —— 在离线版「设置 → 导入账本」里选择此文件即可
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const dbPath = path.join(ROOT, 'data', 'ledger.db');

if (!fs.existsSync(dbPath)) {
  console.error('找不到数据库文件:', dbPath, '\n请先确认在线版已运行过且数据在 data/ledger.db。');
  process.exit(1);
}

const db = new DatabaseSync(dbPath, { readOnly: true });

const TABLES = ['transactions', 'accounts', 'fixed_expenses', 'utility_readings', 'liabilities'];
const data = {};
for (const t of TABLES) {
  try {
    data[t] = db.prepare(`SELECT * FROM ${t}`).all();
  } catch (e) {
    console.warn(`读取 ${t} 失败（表可能不存在）:`, e.message);
    data[t] = [];
  }
}

// 去掉离线版无用的审计字段（保留也无妨，但更干净）
for (const t of TABLES) for (const row of data[t]) delete row.created_at;

const payload = {
  app: 'bill-bookkeeper',
  version: 1,
  exportedAt: new Date().toISOString(),
  source: 'online-sqlite',
  data,
};

const outPath = path.join(ROOT, 'offline-import.json');
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');

const counts = TABLES.map((t) => `${t}=${data[t].length}`).join(', ');
console.log('已导出:', counts);
console.log('输出文件:', outPath);
