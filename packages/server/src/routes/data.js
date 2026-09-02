const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const { getDb } = require('../config/database');

const router = express.Router();

// 5 张业务表（顺序无关，这些表之间没有外键约束）
const TABLES = ['transactions', 'liabilities', 'fixed_expenses', 'utility_readings', 'accounts'];

/**
 * POST /api/data/reset
 * 一键清空所有账本数据并恢复初始状态。
 * 安全约束：
 *  - 严禁 DROP TABLE：会丢失 *_sync_uid 唯一索引与 ALTER 追加的列，破坏导入合并。
 *  - 严禁触碰 .env / config（含 API Key）。
 *  - 必须带 confirm='RESET'，避免误调用。
 *  - 清空 sqlite_sequence，使 AUTOINCREMENT 的 id 从 1 重新计。
 *  - 重新播种 5 个默认账户（中性锚点，不携带任何真实余额）。
 */
router.post('/reset', (req, res) => {
  try {
    if (req.body?.confirm !== 'RESET') {
      return res.status(400).json({ success: false, error: '缺少确认参数：body.confirm 必须为 "RESET"' });
    }
    const db = getDb();
    db.exec('BEGIN');
    try {
      for (const t of TABLES) db.prepare(`DELETE FROM ${t}`).run();
      // 清空自增计数器，让 id 从 1 重新计（不影响表结构与索引）
      try {
        db.prepare(
          "DELETE FROM sqlite_sequence WHERE name IN ('transactions','liabilities','fixed_expenses','utility_readings','accounts')"
        ).run();
      } catch {
        // sqlite_sequence 可能在极早期尚未创建，忽略
      }
      // 重新播种 5 个默认账户（中性锚点 0，避免把任何真实余额带入用户自己的账本）
      const seed = db.prepare(
        'INSERT INTO accounts (name, kind, anchor_balance, anchor_date, anchor_id, note, sync_id) VALUES (?, ?, ?, ?, ?, ?, uuid_v4())'
      );
      const defaults = [
        ['微信', '电子', 0, null, 0, ''],
        ['银行卡', '银行卡', 0, null, 0, ''],
        ['现金', '现金', 0, null, 0, ''],
        ['支付宝', '电子', 0, null, 0, ''],
        ['岭南通', '交通卡', 0, null, 0, '交通卡'],
      ];
      for (const row of defaults) seed.run(...row);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    res.json({ success: true, message: '已重置所有数据并恢复 5 个默认账户' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /api/data/demo
 * 返回内置演示数据（脱敏、通用化，位于仓库 demo/demo-data.json）。
 * 注意：演示数据仅用于项目演示，请勿用于真实记账。
 */
router.get('/demo', (req, res) => {
  try {
    const file = path.join(config.rootDir, 'demo', 'demo-data.json');
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    res.json(data);
  } catch (e) {
    res.status(500).json({ success: false, error: '读取演示数据失败：' + e.message });
  }
});

module.exports = router;
