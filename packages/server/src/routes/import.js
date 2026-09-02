const express = require('express');
const { getDb } = require('../config/database');
const { randomUUID } = require('node:crypto');

const router = express.Router();

// 各表的"合并键"：accounts 以 name 为身份（天然唯一），其余以 sync_id（UUID）为身份
const TABLES = {
  transactions: 'sync_id',
  fixed_expenses: 'sync_id',
  utility_readings: 'sync_id',
  liabilities: 'sync_id',
  accounts: 'name',
};

// POST /api/import - 将导出的账本 JSON 合并进在线 SQLite（按合并键 upsert，不删已有数据）
// 语义是"合并"而非"镜像"：已存在的键更新字段，不存在的键插入；本地独有行保留。
router.post('/', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.data) {
      return res.status(400).json({ success: false, error: '请求体缺少 data 字段' });
    }
    const db = getDb();
    const report = {};

    for (const t of Object.keys(TABLES)) {
      const key = TABLES[t];
      const rows = payload.data[t];
      if (!Array.isArray(rows)) {
        report[t] = { skipped: true };
        continue;
      }
      const colsInfo = db.prepare(`SELECT name FROM pragma_table_info('${t}')`).all().map((r) => r.name);
      let inserted = 0;
      let updated = 0;
      let errors = 0;

      for (const raw of rows) {
        const row = { ...raw };
        if (row.id != null) delete row.id; // 主键由目标库自管，避免跨库 id 冲突
        if (!row.sync_id) row.sync_id = randomUUID();
        const cols = Object.keys(row).filter((c) => colsInfo.includes(c));
        if (cols.length === 0) {
          errors += 1;
          continue;
        }
        const placeholders = cols.map(() => '?').join(',');
        const updateCols = cols.filter((c) => c !== key).map((c) => `${c}=excluded.${c}`).join(', ');
        const sql = `INSERT INTO ${t} (${cols.join(',')}) VALUES (${placeholders}) ON CONFLICT(${key}) DO UPDATE SET ${updateCols}`;
        const vals = cols.map((c) => row[c]);
        try {
          const keyVal = row[key];
          const exists = keyVal != null ? db.prepare(`SELECT 1 FROM ${t} WHERE ${key} = ?`).get(keyVal) : undefined;
          db.prepare(sql).run(...vals);
          if (exists) updated += 1;
          else inserted += 1;
        } catch (e) {
          errors += 1;
        }
      }
      report[t] = { inserted, updated, errors };
    }

    res.json({ success: true, report });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
